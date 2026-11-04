---
name: context-hub
description: Use the local Context Hub MCP service to manage scheduled-workspace memory, report archives, and URL/title deduplication without loading historical HTML into the prompt.
---

# Context Hub

Use this skill when an Agent needs to read or update the structured data behind a scheduled report workspace, especially the `ai` and `ai-trending` workspaces from 「优化是个好事」.

The ownership boundary is strict: the Agent owns research, content synthesis, the fixed HTML template, and the final HTML file. Context Hub owns only compact context, URL/title deduplication, SQLite serialization, and report metadata. It is a data service, not a report renderer.

## Endpoints and lifecycle

The Context Hub MCP endpoint is `http://127.0.0.1:7777/mcp`. It uses local Streamable HTTP JSON-RPC and stores data in `data/context-hub.sqlite`.

The same process exposes the separate read-only GitHub CLI MCP at `http://127.0.0.1:7777/github/mcp`. It does not read or write the Context Hub database. Discover its actual schemas with `tools/list`.

## AI Trending: daily discovery

The purpose is to broaden the reader's view of AI applications, developer tools and important product/workflow ecosystems, including open-source plugins, integrations, Skills and MCP tools. Early-stage or small projects are allowed. Do not require direct AI implementation, mainstream adoption or production maturity when an evidenced ecosystem relationship establishes relevance.

Use `github_select_discoveries` (`discovery-v1`) for new daily runs, with a target of 5 and no weekly/monthly quotas. `github_rank_trending_candidates` is a legacy compatibility tool, not the daily selection path. Weekly/monthly Trending snapshots are optional discovery sources, not the universe of eligible projects. `github_search_repositories`, scoped official catalogues and dated first-party announcements can supply other candidates. Read the current implementation contract in `/Volumes/Project/new_shit/context-hub/README.md`, section “每日发现（discovery-v1）”, before constructing the request; the live tool schema owns parameter definitions.

Declare meaningful product/topic scopes before comparing candidates. Submit the full bounded observed membership of each scope, including excluded or unknown entries; do not claim these searches cover an entire field. Keep ecosystem names consistent. The service compares only matching metrics/windows within a scope, then combines scopes for breadth. Do not compare total stars across ecosystems or invent editorial numeric scores.

Every admitted project needs recent verified attention or recognition evidence. A positive count of new stars/downloads/participants in a completely observed window proves new attention; a complete adjacent equal-length baseline is additionally required to claim acceleration. `github_attention_window` checks daily star-history coverage and calculates both windows; copy only fields accepted by the selection schema. A newly dated official listing, integration or adoption statement by an independent product/user can prove new recognition. A project's own release, current presence in a directory, total stars, commits or one rank does not establish this change. Missing evidence is unknown, never neutral eligibility. Read the cited original pages; a `verifiedFields` claim is not source authentication by the service.

`github_select_discoveries` checks recent windows, completeness, reviewed fields, scope membership and deterministic selection. It returns the only authoritative `selected` order, exclusions and shortfall. Do not apply another Agent-side score or threshold. Explain the actual evidence dimension in natural prose; ecosystem importance and interesting capabilities cannot replace trend evidence. The service deliberately does not certify arbitrary web content or predict future growth.

Never request, print, store, or pass through a GitHub token. The GitHub endpoint delegates authentication to an existing local `gh auth login` session, and the agent must call `github_cli_auth_status` first. If it is unavailable or not authenticated, treat star history as not verifiable; do not fall back to scraping credentials, GitHub Desktop, Keychain, browser sessions, or unauthenticated quota evasion.

For a one-shot local task, start it from the project directory with `npm run mcp`, perform the MCP calls, then stop only the process started for this task with `Ctrl-C`/SIGTERM. If the host does not expose `/github/mcp` as named tools, do not infer that GitHub MCP is unavailable: use the local HTTP JSON-RPC endpoint with `curl` to call `tools/list` and `tools/call`, or start the project service first. Do not leave the service running after generation or verification unless the user explicitly asks for a persistent service.

## Operating contract

1. Start with `context_hub_list_workspaces` or `context_hub_overview` to resolve the workspace.
2. Use `context_hub_get_compact_context` for a small recent-context preview. It is the default input for planning, not a replacement for querying the permanent dedup index.
3. Use `context_hub_search_sources` to check URL/title reuse and `context_hub_search_reports` to locate prior runs.
4. For `ai-trending`, use `context_hub_check_sources` with the candidate repository URLs/titles and `windowDays: 60`. The permanent index includes both serialized items and report links, so a report link remains authoritative even if an item row was removed. Treat `eligible: false` as a hard exclusion; use `nextEligibleOn` when explaining why.
5. Only call `context_hub_get_report` with `includeContent: true` when one specific report is needed for evidence. Do not scan the original `memory.md` or all historical HTML.
6. After evidence and 60-day checks are ready, call `github_select_discoveries` with all declared scope members and genuinely reviewed fields. Save its exact response temporarily for HTML/Markdown contract validation. Use its selected identities and order; missing sources must not be filled with old or unevidenced projects.
7. Let the Agent generate HTML with the existing CSS and the stable `ai-trending/1` semantic contract in `/Volumes/Project/new_shit/context-hub/README.md`, section “AI Trending HTML 归档契约 v1”. Run `node --experimental-strip-types /Volumes/Project/new_shit/context-hub/src/cli.ts validate-report --file <HTML> --selection <exact-service-response.json>` before archive/sync. After the configured MarkItDown CLI and default Hook conversion, run the same command with `--markdown <actual-MD>` to verify preserved content and source identity. Remove temporary selection files after completion. These contract rules apply only to new Trending reports, not historical files or deepreads. Context Hub validates/indexes, never renders or restyles reports.
8. After the HTML is written, call `context_hub_sync_workspace` sequentially with the exact local `sourcePath`, `memoryPath`, workspace, report `kind`, and `dbPath: /Volumes/Project/new_shit/context-hub/data/context-hub.sqlite`. The explicit absolute `dbPath` prevents a scheduler working-directory or stale-server path from causing `unable to open database file`. This indexes the report in SQLite and updates only compact memory pointers.
9. Keep full source URLs/titles in SQLite. Do not copy the permanent dedup list or historical report body into `memory.md`; use `context_hub_search_sources`, `context_hub_check_sources`, and `context_hub_get_report` when needed.

## Workspace routing

- `ai` / `deepread`: OpenAI, Google/Gemini, and Anthropic technical deep-read reports; memory source is `/Users/byur/.codex/automations/ai/memory.md`.
- `ai-trending` / `trending`: GitHub AI application and engineering trend reports; memory source is `/Users/byur/.codex/automations/ai-trending/memory.md`.

Keep these workspaces separate. SQLite writes should be sequential because two imports against the same local database can contend on the write lock. The Context Hub endpoint remains local-only and does not make external network calls; the separate `/github/mcp` route is the explicit, bounded GitHub CLI adapter.
