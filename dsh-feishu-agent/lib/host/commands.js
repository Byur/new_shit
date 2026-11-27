/** 文本命令：`/new`、`/switch`、`/stop`、`/status`、`/router`、`/help`。只对 owner 生效。 */

import { DEFAULT_PERMISSION_PRESET } from '../common/constants.js';
import { NOTE_MODE_DEFAULT_MINUTES } from '../core/note-mode.js';
import { button } from '../core/cards.js';

/**
 * 建命令处理器。
 *
 * @param deps.binder 绑定器
 * @param deps.store 状态存储
 * @param deps.notice 发提示卡
 * @param deps.runningRuns 正在跑的执行表（停止用）
 * @param deps.getOwner 取 owner open_id
 * @param deps.isConnected 长连接是否已建立
 * @param deps.getRouterConfig 取当前意图路由配置（可选）
 * @param deps.setRouterEnabled 运行期开关意图路由（可选）
 * @param deps.getRouterStatus 取意图路由状态与命中统计（可选）
 * @param deps.ollama Ollama 客户端（健康探测用，可选）
 * @returns 处理函数 `(event, key, command) => Promise<void>`
 */
export function createCommandHandler({
  binder,
  store,
  notice,
  runningRuns,
  getOwner,
  isConnected,
  getRouterConfig,
  setRouterEnabled,
  getRouterStatus,
  ollama,
}) {
  /**
   * 清空指定槽位的会话 ID（兼容未提供 `clearSessionId` 的旧测试替身）。
   */
  function clearSlot(binding, key, slot) {
    if (typeof binder.clearSessionId === 'function') {
      binder.clearSessionId(key, slot);
      return;
    }
    const field = slot === 'local' ? 'localSessionId' : 'dshSessionId';
    binding[field] = '';
    binding.updatedAt = new Date().toISOString();
    store.touch();
  }

  return async function handleCommand(event, key, command) {
    const binding = binder.get(key);
    // 速记入口直接挂在帮助卡与状态卡上：群聊不参与速记模式，所以只在私聊放。
    const noteEntry = event.chatType === 'group'
      ? undefined
      : [button({
          name: 'note_mode_on',
          text: `开启速记 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`,
          type: 'primary',
          value: { tag: 'note-mode', action: 'on' },
        })];
    switch (command.name) {
      case 'new': {
        // CLI 路径下"新建会话"= 清空绑定里的 sessionId，下一条消息会让 CLI 建一条新会话。
        if (binding === undefined) {
          await notice(event.chatId, '还没有绑定', '先发一条消息建绑定。');
          return;
        }
        const target = (command.arg || '').trim().toLowerCase();
        if (target === 'local') {
          clearSlot(binding, key, 'local');
          await notice(event.chatId, '已新建本地会话', `下一条本地路由消息会开一条新会话\n工作区：${binding.workspacePath}`);
          return;
        }
        if (target === 'all') {
          clearSlot(binding, key, 'dsh');
          clearSlot(binding, key, 'local');
          await notice(event.chatId, '已新建全部会话', `主会话与本地会话已清空，下一条消息会各自开新会话\n工作区：${binding.workspacePath}`);
          return;
        }
        if (target === '' || target === 'dsh') {
          clearSlot(binding, key, 'dsh');
          await notice(event.chatId, '已新建会话', `下一条消息会开一条新会话\n工作区：${binding.workspacePath}`);
          return;
        }
        await notice(event.chatId, '用法', '/new [dsh|local|all]');
        return;
      }
      case 'switch': {
        const result = await binder.switchSession(key, command.arg);
        await notice(event.chatId, '切换会话', result.error ?? `现在绑定到 ${result.binding.dshSessionId}（${result.binding.title || '无标题'}）`);
        return;
      }
      case 'stop': {
        let cancelled = 0;
        for (const controller of runningRuns.values()) {
          controller.abort();
          cancelled += 1;
        }
        await notice(event.chatId, '停止', cancelled > 0 ? `已请求停止 ${cancelled} 个执行` : '当前没有在跑的任务');
        return;
      }
      case 'router': {
        const sub = (command.arg || 'status').trim().toLowerCase();
        if (sub === 'on') {
          setRouterEnabled?.(true);
          await notice(event.chatId, '意图路由已开启', '本次运行期间将由意图路由器自动分流（支持 /note、/loc、/dsh 强制指定）。');
          return;
        }
        if (sub === 'off') {
          setRouterEnabled?.(false);
          await notice(event.chatId, '意图路由已暂停', '本次运行期间所有普通消息直接交由主会话（DSH）处理；仍可使用 /note、/loc、/dsh。');
          return;
        }
        if (sub !== '' && sub !== 'status') {
          await notice(event.chatId, '用法', '/router [status|on|off]');
          return;
        }
        if (typeof getRouterStatus !== 'function') {
          await notice(event.chatId, '意图路由', '路由状态不可用。');
          return;
        }
        const { config: cfg, override, stats, health: healthSnapshot } = getRouterStatus();
        const probe = ollama
          ? await ollama.healthCheck({ baseUrl: cfg.ollamaBaseUrl })
          : { ok: false, error: '未初始化 Ollama 客户端' };
        const overrideNote = override === undefined ? '' : '（运行时覆盖）';
        const switchLine = `开关：${cfg.enabled ? '开启' : '关闭'}${overrideNote}${cfg.groupEnabled ? ' · 群聊已启用' : ''}`;
        const modelList = Array.isArray(probe.models) && probe.models.length > 0
          ? `：${probe.models.slice(0, 6).join(', ')}${probe.models.length > 6 ? '…' : ''}`
          : '';
        const ollamaLine = probe.ok
          ? `Ollama：在线（${cfg.ollamaBaseUrl}，已装 ${probe.models?.length ?? 0} 个模型${modelList}）`
          : `Ollama：离线（${cfg.ollamaBaseUrl}，${probe.error || '不可用'}）`;
        const classifierLine = `分类模型：${cfg.classifierModel}（超时 ${cfg.timeoutMs}ms，保活 ${cfg.keepAlive}）`;
        const noteRuleLine = cfg.enabled === false
          ? '记事规则：未生效（路由已关闭）'
          : !cfg.routes?.obsidian?.inboxDir
            ? '记事规则：未生效（未配置待整理目录）'
            : '记事规则：开启（“记一下/备忘/灵感…” 直达待整理，不经过分类器）';
        // 健康快照来自 createHealthMonitor：熔断打开时给剩余冷却秒数，命令层不用自己再探一次。
        const localHealthLine = healthSnapshot === undefined || healthSnapshot === null
          ? '本地模型：未知'
          : `本地模型：${healthSnapshot.state === 'open' ? 'open' : 'closed'}（连续失败 ${healthSnapshot.failures ?? 0} 次，剩余 ${Math.max(
            0,
            Math.ceil((Number(healthSnapshot.openUntil ?? 0) - Date.now()) / 1000),
          )}s 后重试）`;
        const dshDesc = [cfg.routes?.dsh?.provider, cfg.routes?.dsh?.model].filter(Boolean).join('/') || '默认';
        const localDesc = [cfg.routes?.local?.provider, cfg.routes?.local?.model].filter(Boolean).join('/') || '默认';
        const obsidianDesc = cfg.routes?.obsidian?.inboxDir || '（未配置 inboxDir）';
        const routesLine = [
          '路由配置：',
          `- dsh（${cfg.routes?.dsh?.label || '4.1 Flash'}）：${dshDesc}`,
          `- local（${cfg.routes?.local?.label || '本地模型'}）：${localDesc}`,
          `- obsidian（${cfg.routes?.obsidian?.label || '待整理'}）：${obsidianDesc}`,
        ].join('\n');
        const statsLine = `命中统计：dsh ${stats?.dsh ?? 0} · local ${stats?.local ?? 0} · obsidian ${stats?.obsidian ?? 0} · fallback ${stats?.fallback ?? 0} · note ${stats?.note ?? 0} · override ${stats?.override ?? 0}`;
        await notice(event.chatId, '意图路由状态', [switchLine, ollamaLine, classifierLine, noteRuleLine, localHealthLine, routesLine, statsLine].join('\n'));
        return;
      }
      case 'status': {
        const routerCfg = typeof getRouterConfig === 'function' ? getRouterConfig() : undefined;
        const lines = [
          `owner：${getOwner() || '（未绑定）'}`,
          `绑定：${binding ? `${binding.dshSessionId}` : '（还没有）'}`,
          binding?.localSessionId ? `本地会话：${binding.localSessionId}` : '',
          binding ? `工作区：${binding.workspacePath}` : '',
          binding ? `权限预设：${binding.permissionPreset || DEFAULT_PERMISSION_PRESET}` : '',
          routerCfg !== undefined ? `意图路由：${routerCfg.enabled ? '已开启' : '未开启'}` : '',
          `连接：${isConnected() ? '已连接' : '未连接'}`,
        ].filter((line) => line !== '');
        await notice(event.chatId, '状态', lines.join('\n'), noteEntry);
        return;
      }
      case 'help':
      default: {
        await notice(event.chatId, '可用命令', [
          '/new [local|all] —— 在当前工作区新建会话（默认主会话，local 重置本地会话）',
          '/switch <会话ID前缀> —— 切换到这个工作区里的另一条会话',
          '/stop —— 停止当前这一轮',
          '/status —— 看当前绑定与连接状态',
          '/help —— 这份说明',
          '/note <内容> —— 直接追加到 Obsidian 待整理',
          `/note on|off|status —— 速记模式：窗口内每条消息直接写入待整理（默认 ${NOTE_MODE_DEFAULT_MINUTES} 分钟）`,
          '/loc <内容> —— 直接交给本地模型回答',
          '/dsh <内容> —— 直接交给远端 4.1 Flash 处理',
          '/router [on|off|status] —— 查看或开关意图路由',
        ].join('\n'), noteEntry);
      }
    }
  };
}
