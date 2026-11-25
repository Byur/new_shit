/** 群聊接入：@ 检测、白名单、未配置群的确认卡注册、历史绑定键迁移。 */

import { mkdir } from 'node:fs/promises';

import { bindingKeyOf } from '../core/binding.js';
import { buildCard, button, buttonRow, markdown, toastResponse } from '../core/cards.js';
import { errorMessage } from './services.js';

/**
 * 建群聊门禁。
 *
 * @param deps.store 状态存储
 * @param deps.binder 绑定器
 * @param deps.outbound 出站句柄
 * @param deps.logger 日志
 * @param deps.getOwner 取 owner open_id
 * @param deps.getGroupWorkspace 取群默认工作区
 * @param deps.notice 发提示卡
 * @param deps.registrationEnabled 是否允许「未配置群 → 确认卡」
 * @returns 门禁句柄：`gate` / `handleCard` / `adopt` / `mentioned`
 */
export function createGroupGate({ store, binder, outbound, logger, getOwner, getGroupWorkspace, notice, registrationEnabled }) {
  let botIdentityCache;

  /**
   * 取机器人身份（只读一次）。
   *
   * @returns `{ openId, name }`；读不到时 openId 为空
   */
  async function botIdentity() {
    if (botIdentityCache !== undefined) return botIdentityCache;
    const info = await outbound.getBotInfo();
    botIdentityCache = info ?? { openId: '', name: '' };
    if (info === undefined) logger.warn('读不到机器人信息：群里只能按“有人被 @”粗略判断');
    return botIdentityCache;
  }

  /**
   * 按 chatId 兜底找回群绑定，并把旧键修正成当前算出来的键。
   *
   * 历史版本在卡片回调里拿不到 app_id/tenant_key，注册出来的键是 `::oc_xxx:-`，
   * 和消息事件算出来的键对不上，于是每 @ 一次就再问一次授权。
   *
   * @param key 当前消息算出来的绑定键
   * @param chatId 群会话 ID
   * @returns 绑定；没有时 undefined
   */
  function adopt(key, chatId) {
    let kept;
    for (const [oldKey, record] of Object.entries(store.state.bindings)) {
      if (record?.chatId !== chatId || record?.chatType !== 'group') continue;
      if (oldKey === key) {
        kept = record;
        continue;
      }
      delete store.state.bindings[oldKey];
      if (kept === undefined) {
        record.key = key;
        store.state.bindings[key] = record;
        kept = record;
        logger.info(`群 ${chatId} 的绑定键已修正：${oldKey} → ${key}`);
      } else {
        logger.warn(`群 ${chatId} 有多余的旧绑定 ${oldKey}，已删除`);
      }
    }
    if (kept !== undefined) store.touch();
    return kept;
  }

  /**
   * 这条群消息里有没有 @ 机器人。
   *
   * @param event 归一化后的消息事件
   * @returns 是否 @ 了机器人
   */
  async function mentioned(event) {
    if (!Array.isArray(event.mentions) || event.mentions.length === 0) return false;
    const bot = await botIdentity();
    // 读不到机器人身份时按「有任意 @」放行：能 @ 到它的群，通常就是它在场的群。
    if (bot.openId === '') return true;
    return event.mentions.some((item) => item.openId === bot.openId);
  }

  /**
   * 未配置的群第一次被 owner @ 时，私聊给 owner 发一张接入确认卡。
   *
   * @param event 归一化后的消息事件
   */
  async function requestRegistration(event) {
    const workspacePath = getGroupWorkspace();
    if (workspacePath === '') {
      await notice(event.chatId, '还没有群工作区', '先设 FEISHU_AGENT_GROUP_WORKSPACE（或本机配置里的 groupWorkspace），再 @ 我一次。');
      return;
    }
    const card = buildCard({
      title: '把这个群接入 Agent？',
      color: 'blue',
      elements: [
        markdown(
          `群：\`${event.chatId}\`\n工作区：\`${workspacePath}\`\n\n接入后，群里 @ 我 会用这个工作区开一条独立会话；群成员默认只有你能触发。`,
        ),
        buttonRow([
          button({
            name: 'allow-read-only',
            text: '允许（只读）',
            type: 'primary',
            value: {
              tag: 'group-register',
              action: 'allow',
              chatId: event.chatId,
              preset: 'read-only',
              appId: event.appId,
              tenantKey: event.tenantKey,
            },
          }),
          button({
            name: 'allow-write',
            text: '允许（可写）',
            value: {
              tag: 'group-register',
              action: 'allow',
              chatId: event.chatId,
              preset: 'workspace-write',
              appId: event.appId,
              tenantKey: event.tenantKey,
            },
          }),
          button({
            name: 'ignore',
            text: '忽略',
            value: { tag: 'group-register', action: 'ignore', chatId: event.chatId, appId: event.appId, tenantKey: event.tenantKey },
          }),
        ]),
      ],
    });
    const sent = await outbound.sendCardToOpenId({ openId: getOwner(), card });
    if (sent === undefined) {
      await notice(event.chatId, '确认卡没发出去', '检查机器人可见范围，或直接在配置里写下这个群的 chat_id。');
      return;
    }
    await notice(event.chatId, '已私聊确认', '已经私聊问 owner 要不要接入这个群。');
    logger.info(`群 ${event.chatId} 未配置，已向 owner 发接入确认卡`);
  }

  /**
   * 群消息的门禁：配置/绑定、@ 机器人、成员白名单。
   *
   * @param event 归一化后的消息事件
   * @param key 绑定键
   * @returns `continue` 继续处理；`stop` 到此为止
   */
  async function gate(event, key) {
    const existing = binder.get(key) ?? adopt(key, event.chatId);
    const groupConfig = binder.chatConfigOf(event.chatId, 'group');
    const mentionedBot = await mentioned(event);

    // 既没在配置里，也没确认过：只有 owner @ 我时才发接入确认卡。
    if (existing === undefined && groupConfig === undefined) {
      if (!mentionedBot) {
        logger.info('群聊消息没有 @ 机器人，忽略');
        return 'stop';
      }
      if (event.senderOpenId !== getOwner()) {
        logger.info(`群 ${event.chatId} 还没接入，且发言不是 owner（${event.senderOpenId || '未知'}）`);
        return 'stop';
      }
      if (!registrationEnabled()) {
        logger.info('群接入已关闭（FEISHU_AGENT_GROUP_REGISTRATION=off）');
        return 'stop';
      }
      await requestRegistration(event);
      return 'stop';
    }

    const requireMention = groupConfig === undefined ? true : groupConfig.requireMention !== false;
    if (requireMention && !mentionedBot) {
      logger.info('群聊消息没有 @ 机器人，忽略');
      return 'stop';
    }
    const allowed = new Set(
      [getOwner(), ...(groupConfig?.allowSenders ?? existing?.allowSenders ?? [])].filter((id) => id !== ''),
    );
    if (allowed.size === 0 || !allowed.has(event.senderOpenId)) {
      logger.info(`群聊里拒绝非授权成员的消息（${event.senderOpenId || '未知'}）`);
      return 'stop';
    }
    return 'continue';
  }

  /**
   * 接入确认卡的按钮回调。
   *
   * @param event 归一化后的卡片事件
   * @param value 按钮回传值
   * @returns 回调响应
   */
  async function handleCard(event, value) {
    const chatId = String(value.chatId ?? '');
    if (value.action === 'ignore') return toastResponse('已忽略，这个群不会接入', 'info');
    if (value.action !== 'allow' || chatId === '') return toastResponse('不认识的操作', 'warning');
    const workspacePath = getGroupWorkspace();
    if (workspacePath === '') return toastResponse('还没配置群工作区', 'warning');
    const preset = value.preset === 'workspace-write' ? 'workspace-write' : 'read-only';
    // 真实的 card.action.trigger 事件 header 不带 app_id/tenant_key：优先用按钮里带的，
    // 再退回已有绑定（同一个 app 的私聊绑定一定有），保证绑定键和消息事件算出来的一致。
    const known = Object.values(store.state.bindings).find((item) => item.appId !== '' && item.appId !== undefined);
    const appId = String(value.appId ?? event.appId ?? known?.appId ?? '');
    const tenantKey = String(value.tenantKey ?? event.tenantKey ?? known?.tenantKey ?? '');
    try {
      // 群工作区目录可能还不存在：注册要求目录真实存在，先建出来。
      await mkdir(workspacePath, { recursive: true }).catch(() => {});
      await binder.registerGroup({
        key: bindingKeyOf({ appId, tenantKey, chatId, threadId: '' }),
        appId,
        tenantKey,
        chatId,
        workspacePath,
        permissionPreset: preset,
      });
    } catch (error) {
      return toastResponse(`接入失败：${errorMessage(error)}`, 'error');
    }
    await notice(chatId, '已接入', `这个群现在有独立会话\n工作区：${workspacePath}\n权限：${preset}\n\n@ 我说句话开始。`);
    return toastResponse('已接入', 'success');
  }

  return { gate, handleCard, adopt, mentioned, botIdentity, requestRegistration };
}
