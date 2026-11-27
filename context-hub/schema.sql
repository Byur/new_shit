-- Context Hub 初始 schema（v1）。只在新库上执行；版本由 PRAGMA user_version 记录。
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  root_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  source_path TEXT,
  automation_id TEXT,
  schedule TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  prompt TEXT,
  memory_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(slug)
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  run_date TEXT,
  status TEXT NOT NULL DEFAULT 'imported',
  source_path TEXT,
  input_chars INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, run_key)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  source_path TEXT NOT NULL,
  title TEXT NOT NULL,
  report_date TEXT,
  content_json TEXT NOT NULL DEFAULT '{}',
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, source_path)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  provider TEXT,
  title TEXT,
  url TEXT,
  published_at TEXT,
  fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, document_id, url)
);

CREATE TABLE IF NOT EXISTS memory_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  source_chars INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  compact_path TEXT,
  compact_sha256 TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, source_path)
);

CREATE INDEX IF NOT EXISTS idx_runs_workspace_date ON runs(workspace_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_date ON documents(workspace_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_items_workspace_kind ON items(workspace_id, kind);
CREATE INDEX IF NOT EXISTS idx_items_url ON items(url);

CREATE TABLE IF NOT EXISTS automation_tasks (
  task_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  paused_reason TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_runs (
  run_key TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  upstream_run TEXT,
  status TEXT NOT NULL,
  prompt_hash TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  exit_code INTEGER,
  log_dir TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS automation_units (
  id TEXT PRIMARY KEY,
  run_key TEXT NOT NULL REFERENCES automation_runs(run_key) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  batch TEXT,
  dsh_session_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  exit_code INTEGER,
  node TEXT,
  failure_reason TEXT,
  artifacts_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS automation_alerts (
  id TEXT PRIMARY KEY,
  run_key TEXT,
  level TEXT NOT NULL,
  kind TEXT NOT NULL,
  dedupe_key TEXT,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_leases (
  task_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  pid INTEGER NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_task_started ON automation_runs(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status_retry ON automation_runs(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_automation_units_run ON automation_units(run_key);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_dedupe ON automation_alerts(dedupe_key, sent_at DESC);
