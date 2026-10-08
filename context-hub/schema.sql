PRAGMA foreign_keys = ON;

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
  UNIQUE(project_id, slug)
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
