export type TaskId = 'wizz-a' | 'wizz-b' | 'wizz-c';

export type RunStatus = 'running' | 'ok' | 'partial' | 'failed' | 'timeout' | 'skipped';

// 一个任务一次运行只建一个会话（父会话），子会话由父会话自己 session_spawn。
// 单元类型因此是「整条流水线」粒度，而不是把任务书拆成子单元。
export type UnitType = 'a-run' | 'b-run' | 'c-run';

export type PermissionMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export type ApprovalPolicy = 'ask' | 'never';

/** auto：桥可用就走桌面，否则回退 headless；headless：一次性 CLI；desktop：必须走桌面宿主，桥不可用时 fail-closed。 */
export type RuntimePreference = 'auto' | 'desktop' | 'headless';

export interface ResolvedRuntime {
  preference: RuntimePreference;
  resolved: 'headless' | 'desktop';
  /** resolved 是否真的可执行。desktop 依赖 dsh-context-hub-bridge 的发现文件与存活进程。 */
  supported: boolean;
  desktopDetected: boolean;
  desktopPid: number | null;
  /** 桥的发现信息；桥不可用时为 null。 */
  bridge: {stateFile: string; port: number; pid: number} | null;
  detail: string;
}

export interface TaskTriggerConfig {
  kind: 'cron' | 'cascade';
  cron?: string;
  tz?: string;
  misfireMinutes?: number;
  after?: TaskId;
  readiness?: string;
}

export interface TaskConfig {
  id: TaskId;
  name: string;
  enabled: boolean;
  promptDoc: string;
  /** 工作区环境变量名；真实环境变量优先于 workspaceDir。 */
  workspaceEnv: string;
  /** 显式工作区默认值：绝对路径或相对 context-hub 根目录。未配置且环境变量为空时报错，不做路径猜测。 */
  workspaceDir?: string;
  /** 执行运行时偏好，默认 auto。 */
  runtime?: RuntimePreference;
  permissionMode: PermissionMode;
  approvalPolicy: ApprovalPolicy;
  timeoutMinutes: number;
  unitConcurrency: number;
  stalledMinutes: number;
  trigger: TaskTriggerConfig;
  preflight: string[];
  retry: {
    infra: {
      max: number;
      backoffMinutes: number;
      beforeRetry?: string;
    };
  };
  notify: {
    success: {
      images: boolean;
      maxImages: number;
    };
    failure: {
      node: boolean;
    };
  };
}

export interface FailedNodeRecord {
  node: string;
  job_key?: string;
  batch?: string;
  phase: string;
  reason: string;
  retryable?: boolean;
}

export interface UnitResultContract {
  status: 'ok' | 'partial' | 'failed';
  failed_nodes?: FailedNodeRecord[];
  failed_jobs?: unknown[];
  needs_human?: unknown[];
  artifacts?: string[];
  summary: string;
  proposals?: Array<{
    source: 'idea' | 'random';
    ideaId?: string;
    work: string;
    character: string;
    slug: string;
    batch: string;
    materialsDir?: string;
    concept: string;
    diffNote: string;
  }>;
  blocked_ideas?: Array<{
    ideaId: string;
    reason: string;
  }>;
  batch?: string;
  materialsDir?: string;
  layout?: 'standard' | 'legacy' | 'mixed' | 'unknown';
  files?: {
    research?: string;
    refs?: string[];
    demos?: string[];
  };
  decisions?: Array<{
    batch: string;
    verdict: 'pass' | 'revised' | 'reject';
    notes: string;
    reason?: string;
  }>;
  batches?: {
    done: number;
    failed: number;
  };
  jobs?: Array<{
    jobKey: string;
    verdict?: string;
    style?: string;
    status: 'done' | 'failed';
    bestRound?: number;
    refined?: boolean;
    promoted?: boolean;
    deliveryPath?: string;
  }>;
  feedback_count?: number;
  /** 整条流水线的汇总字段（文档驱动模式下不再有单元级 proposals/jobs 拆分）。 */
  enqueued_batches?: number;
  delivery_images?: Array<{path: string; label: string}>;
  batch_rows?: Array<{batch: string; style?: string; status?: string}>;
}

export interface RunEnvelope {
  runId: string;
  unitId: string;
  taskId: TaskId;
  unitType: UnitType;
  triggeredAt: string;
  workspaceDir: string;
  materialsRoot?: string;
  materialsDir?: string;
  layout?: string;
  batch?: string;
  timeoutMinutes: number;
  stalledMinutes: number;
  /** parent：宿主会话，可用 session_spawn 自建子会话；inline：一次性进程，只能自己做。 */
  mode?: 'parent' | 'inline';
  /** 父会话允许同时运行的子会话上限（来自任务的 unitConcurrency）。 */
  concurrency?: number;
  snapshot?: Record<string, unknown>;
  recentSummary?: string;
}

export interface DshEvent {
  type?: string;
  phase?: string;
  sessionId?: string;
  text?: string;
  message?: string;
  tool?: string;
  reason?: {
    kind?: string;
    error?: {
      message?: string;
    };
  };
  [key: string]: unknown;
}

export interface DshRunResult {
  ok: boolean;
  sessionId: string;
  text: string;
  turnEndKind: string;
  error: string;
  exitCode: number | null;
  durationMs: number;
  timedOut?: boolean;
  stalled?: boolean;
  tools: string[];
  contract: UnitResultContract | null;
  contractParseError?: string;
  logDir: string;
  runtime?: ResolvedRuntime;
}

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
  level?: 'P1' | 'P2';
}

export interface PreflightReport {
  ok: boolean;
  checkedAt: string;
  checks: PreflightCheck[];
}
