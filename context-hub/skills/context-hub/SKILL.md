---
name: context-hub
description: Use the local Context Hub MCP service to manage scheduled-workspace memory, report archives, and URL/title deduplication without loading historical HTML into the prompt.
---

# Context Hub

Use this skill when an Agent needs to read or update the structured data behind a scheduled report workspace, especially the `ai` and `ai-trending` workspaces from 「优化是个好事」.

## Endpoint and lifecycle

The MCP endpoint is `http://127.0.0.1:7777/mcp`. It uses local Streamable HTTP JSON-RPC and stores data in `data/context-hub.sqlite`.

For a one-shot local task, start it from the project directory with `npm run mcp`, perform the MCP calls, then stop the process with `Ctrl-C`/SIGTERM. Do not leave the service running after generation or verification unless the user explicitly asks for a persistent service.

## Operating contract

1. Start with `context_hub_list_workspaces` or `context_hub_overview` to resolve the workspace.
2. Use `context_hub_get_compact_context` for prompt context. It is the default input for deduplication and planning.
3. Use `context_hub_search_sources` to check URL/title reuse and `context_hub_search_reports` to locate prior runs.
4. Only call `context_hub_get_report` with `includeContent: true` when one specific report is needed for evidence. Do not scan the original `memory.md` or all historical HTML.
5. After a new report is written, call `context_hub_sync_workspace` sequentially with the exact local `sourcePath`, `memoryPath`, workspace, and report `kind`. This updates SQLite, compact memory, and fixed-template samples.
6. Use `context_hub_export_fixed_report` when one normalized report needs to be rendered again. The tool does not delete source files.

## Workspace routing

- `ai` / `deepread`: OpenAI, Google/Gemini, and Anthropic technical deep-read reports; memory source is `/Users/byur/.codex/automations/ai/memory.md`.
- `ai-trending` / `trending`: GitHub AI application and engineering trend reports; memory source is `/Users/byur/.codex/automations/ai-trending/memory.md`.

Keep these workspaces separate. SQLite writes should be sequential because two imports against the same local database can contend on the write lock. The service is local-only; do not add cloud sync, credentials, or external network actions to this skill.
