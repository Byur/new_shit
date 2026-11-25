/** 文本命令：`/new`、`/switch`、`/stop`、`/status`、`/help`。只对 owner 生效。 */

import { DEFAULT_PERMISSION_PRESET } from '../common/constants.js';

/**
 * 建命令处理器。
 *
 * @param deps.binder 绑定器
 * @param deps.store 状态存储
 * @param deps.notice 发提示卡
 * @param deps.runningRuns 正在跑的执行表（停止用）
 * @param deps.getOwner 取 owner open_id
 * @param deps.isConnected 长连接是否已建立
 * @returns 处理函数 `(event, key, command) => Promise<void>`
 */
export function createCommandHandler({ binder, store, notice, runningRuns, getOwner, isConnected }) {
  return async function handleCommand(event, key, command) {
    const binding = binder.get(key);
    switch (command.name) {
      case 'new': {
        // CLI 路径下"新建会话"= 清空绑定里的 sessionId，下一条消息会让 CLI 建一条新会话。
        if (binding === undefined) {
          await notice(event.chatId, '还没有绑定', '先发一条消息建绑定。');
          return;
        }
        binding.dshSessionId = '';
        binding.updatedAt = new Date().toISOString();
        store.touch();
        await notice(event.chatId, '已新建会话', `下一条消息会开一条新会话\n工作区：${binding.workspacePath}`);
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
      case 'status': {
        const lines = [
          `owner：${getOwner() || '（未绑定）'}`,
          `绑定：${binding ? `${binding.dshSessionId}` : '（还没有）'}`,
          binding ? `工作区：${binding.workspacePath}` : '',
          binding ? `权限预设：${binding.permissionPreset || DEFAULT_PERMISSION_PRESET}` : '',
          `连接：${isConnected() ? '已连接' : '未连接'}`,
        ].filter((line) => line !== '');
        await notice(event.chatId, '状态', lines.join('\n'));
        return;
      }
      case 'help':
      default: {
        await notice(event.chatId, '可用命令', [
          '/new —— 在当前工作区新建会话',
          '/switch <会话ID前缀> —— 切换到这个工作区里的另一条会话',
          '/stop —— 停止当前这一轮',
          '/status —— 看当前绑定与连接状态',
          '/help —— 这份说明',
        ].join('\n'));
      }
    }
  };
}
