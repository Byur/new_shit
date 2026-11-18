/** 常量：插件名、配置键、凭据引用名、飞书 API 限制、默认文案。 */

/** Cordis 插件名，也是 loader 条目的 name。 */
export const PLUGIN_NAME = 'dsh-feishu-agent';

/** 插件的日志命名空间。 */
export const LOGGER_NAME = 'feishu-agent';

/** 凭据引用名：飞书自建应用的 App ID。 */
export const APP_ID_REF = 'FEISHU_AGENT_APP_ID';

/** 凭据引用名：飞书自建应用的 App Secret。 */
export const APP_SECRET_REF = 'FEISHU_AGENT_APP_SECRET';

/** 环境变量：没有凭据服务时的退路。 */
export const APP_ID_ENV = 'DSH_FEISHU_AGENT_APP_ID';

/** 环境变量：没有凭据服务时的退路。 */
export const APP_SECRET_ENV = 'DSH_FEISHU_AGENT_APP_SECRET';

/** 状态目录的环境变量覆盖（默认 `$DSH_HOME/feishu-agent`）。 */
export const STATE_DIR_ENV = 'DSH_FEISHU_AGENT_STATE_DIR';

/** 状态文件名。 */
export const STATE_FILE = 'state.json';

/** 回答卡状态文件名。 */
export const CARDS_FILE = 'cards.json';

/** 飞书卡片的体积上限（官方 30KB）。 */
export const CARD_MAX_BYTES = 30 * 1024;

/** 回答正文在卡片上最多占多少字符，超过就截断并提示去桌面端看。 */
export const ANSWER_MAX_CHARS = 8000;

/** 一帧正文停顿这么久（毫秒）才推一次卡片更新，避免每段都打一次 API。 */
export const CARD_PATCH_DEBOUNCE_MS = 800;

/** 飞书发送限频：单用户/单群的 QPS 上限是 5，这里留余量。 */
export const SEND_MIN_INTERVAL_MS = 250;

/** 事件迟到多久（毫秒）就不再处理：飞书重连补推的旧消息不能当新指令。 */
export const STALE_EVENT_MS = 3000;

/** 去重窗口里保留多少个最近事件 ID。 */
export const SEEN_EVENT_LIMIT = 2000;

/** 发送失败的最大重试次数。 */
export const SEND_MAX_ATTEMPTS = 3;

/** 重试退避基数（毫秒），第 n 次等 `base * n`。 */
export const SEND_RETRY_BASE_MS = 400;

/** 会话等待超时：一轮跑这么久还没结束就不再等事件，交给兜底收尾（毫秒）。 */
export const TURN_WATCHDOG_MS = 30 * 60 * 1000;

/** 反问/审批卡片的默认有效期（毫秒）；超过就把卡片收回成「已失效」。 */
export const DECISION_TTL_MS = 30 * 60 * 1000;

/** 默认 agent preset：与桌面端新建会话保持一致，避免 preset 冲突。 */
export const DEFAULT_AGENT_PRESET = 'standard';

/** 默认权限预设。 */
export const DEFAULT_PERMISSION_PRESET = 'workspace-write';

/** 默认标题前缀。 */
export const DEFAULT_TITLE_PREFIX = '[飞书]';

/** 一轮结束原因映射：宿主 `turn/end` 的 `reason.kind` → 状态标题。 */
export const TURN_END_TITLES = {
  completed: '已完成',
  aborted: '已停止',
  error: '失败',
};

/** 卡片标题颜色（飞书 `header.template`）。 */
export const CARD_COLORS = {
  queued: 'wathet',
  running: 'blue',
  stopping: 'grey',
  done: 'green',
  stopped: 'orange',
  failed: 'red',
  notice: 'grey',
  question: 'blue',
  approval: 'orange',
  closed: 'grey',
};
