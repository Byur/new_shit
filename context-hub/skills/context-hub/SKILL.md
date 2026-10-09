---
name: context-hub
description: Use the local Context Hub MCP service to manage scheduled-workspace memory, report archives, and URL/title deduplication without loading historical HTML into the prompt.
---

# Context Hub

Use this skill when an Agent needs to read or update the structured data behind a scheduled report workspace, especially the `ai` and `ai-trending` workspaces from 「优化是个好事」.

The ownership boundary is strict: the Agent owns research, content synthesis, the fixed HTML template, and the final HTML file. Context Hub owns only compact context, URL/title deduplication, SQLite serialization, and report metadata. It is a data service, not a report renderer.

## Endpoints and lifecycle

The Context Hub MCP endpoint is `http://127.0.0.1:7777/mcp`. It uses local Streamable HTTP JSON-RPC and stores data in `data/context-hub.sqlite`.

The same local process also registers a separate GitHub CLI data MCP at `http://127.0.0.1:7777/github/mcp`. It does not read or write the Context Hub database. It provides fixed read-only tools: `github_cli_auth_status`, `github_repo_evidence`, `github_star_history`, `github_monthly_star_growth`, `github_monthly_trending_snapshot`, `github_weekly_trending_snapshot`, and `github_rank_trending_candidates`.

For AI Trending, first use the Context Hub endpoint for compact context and 60-day deduplication. Use the GitHub CLI endpoint after candidate discovery: `github_monthly_trending_snapshot` is the preferred source for the previous complete calendar month's visible GitHub Trending equivalent ranking; it returns the concrete period and visible count, and must never be described as a global Top 500. If the live weekly page is unavailable or stale, `github_weekly_trending_snapshot` is a bounded fallback; disclose its captured period and visible count rather than claiming a complete Top 30. Use `github_repo_evidence` to verify selected candidates. `github_monthly_star_growth` reports GitHub UTC daily buckets for one specified repository plus `expectedDays` and `coverageComplete`; only `coverageComplete: true` can validate that repository's monthly growth. Star history for a few candidates does not establish a global monthly Top 500. Community signals are supplemental evidence, never a replacement for the ranking order.

For deterministic selection, the Agent must prepare the complete visible ranking items plus its reviewed boolean/evidence fields, pass the snapshot `count` as `visibleCount`, and list every non-source field actually verified in each item's `verifiedFields`. The MCP service rejects partial pools and unverified auxiliary fields, then performs the only hard filters, normalization, weighted score, tie-breaks, cross-list exclusions, and weekly/monthly selection limit. Read `ranking`, `excluded`, `selected`, `scores`, `weights`, and `shortfall` from the response; do not reproduce the arithmetic in the prompt or in Agent prose. The score only orders eligible candidates: it must never remove a candidate or replace the requested 3 weekly / 2 monthly slots with a stricter threshold. Never fill missing slots with a lower-confidence or unverified repository.

Trending interpretation belongs to the Agent: `近期热门` is short-window rank and `period_stars`; `持续热门` requires repeated appearances across snapshots; `主流` requires stronger total-star, fork, maturity, documentation, release, community, or adoption signals. A high growth rate alone is not mainstream evidence. Each report item should state its primary trend dimension and the separate evidence for recent heat and mainstream status.

These dimensions are explanatory, not extra admission gates. A weighted score is implemented by `github_rank_trending_candidates`, not by the prompt: do not add fixed H/M thresholds, a minimum composite score, or a balance rule to remove a candidate that already passes the scope, evidence, and 60-day dedup checks. Missing stars, forks, repeat appearances, maturity, or adoption signals are `unknown` and the MCP returns their neutral contribution; they are not zero and not an automatic exclusion. The MCP response is the source of truth for the score and ordering.

Never request, print, store, or pass through a GitHub token. The GitHub endpoint delegates authentication to an existing local `gh auth login` session, and the agent must call `github_cli_auth_status` first. If it is unavailable or not authenticated, treat star history as not verifiable; do not fall back to scraping credentials, GitHub Desktop, Keychain, browser sessions, or unauthenticated quota evasion.

For a one-shot local task, start it from the project directory with `npm run mcp`, perform the MCP calls, then stop the process with `Ctrl-C`/SIGTERM. If the host does not expose `/github/mcp` as named tools, do not infer that GitHub MCP is unavailable: use the local HTTP JSON-RPC endpoint with `curl` to call `tools/list` and `tools/call`, or start the project service first. Do not leave the service running after generation or verification unless the user explicitly asks for a persistent service.

## Operating contract

1. Start with `context_hub_list_workspaces` or `context_hub_overview` to resolve the workspace.
2. Use `context_hub_get_compact_context` for a small recent-context preview. It is the default input for planning, not a replacement for querying the permanent dedup index.
3. Use `context_hub_search_sources` to check URL/title reuse and `context_hub_search_reports` to locate prior runs.
4. For `ai-trending`, use `context_hub_check_sources` with the candidate repository URLs/titles and `windowDays: 60`. The permanent index includes both serialized items and report links, so a report link remains authoritative even if an item row was removed. Treat `eligible: false` as a hard exclusion; use `nextEligibleOn` when explaining why.
5. Only call `context_hub_get_report` with `includeContent: true` when one specific report is needed for evidence. Do not scan the original `memory.md` or all historical HTML.
6. After candidate evidence and 60-day checks are ready, call `github_rank_trending_candidates` with the complete visible ranking pool, `visibleCount` equal to the source snapshot `count`, and per-item `verifiedFields` containing only fields actually checked. Use its selected candidates and score breakdown as the source of truth; do not recalculate or apply another threshold.
7. Let the Agent generate the final HTML using its existing fixed template. Do not ask Context Hub to create or restyle the report.
8. After the HTML is written, call `context_hub_sync_workspace` sequentially with the exact local `sourcePath`, `memoryPath`, workspace, report `kind`, and `dbPath: /Volumes/Project/new_shit/context-hub/data/context-hub.sqlite`. The explicit absolute `dbPath` prevents a scheduler working-directory or stale-server path from causing `unable to open database file`. This indexes the report in SQLite and updates only compact memory pointers.
9. Keep full source URLs/titles in SQLite. Do not copy the permanent dedup list or historical report body into `memory.md`; use `context_hub_search_sources`, `context_hub_check_sources`, and `context_hub_get_report` when needed.

## Workspace routing

- `ai` / `deepread`: OpenAI, Google/Gemini, and Anthropic technical deep-read reports; memory source is `/Users/byur/.codex/automations/ai/memory.md`.
- `ai-trending` / `trending`: GitHub AI application and engineering trend reports; memory source is `/Users/byur/.codex/automations/ai-trending/memory.md`.

Keep these workspaces separate. SQLite writes should be sequential because two imports against the same local database can contend on the write lock. The Context Hub endpoint remains local-only and does not make external network calls; the separate `/github/mcp` route is the explicit, bounded GitHub CLI adapter.
