# SkillHub Remote Discovery

Use this reference only for public SkillHub search, one-remote-Skill semantic review, category recommendation, and source retrieval.

## Remote cases

### R1: one remote Skill

Enter this case only after the read-only local-presence check in `SKILL.md` finds no matching local package, or when the user explicitly targets a remote listing, repository, or version. The Agent determines this classification; do not ask the user whether the Skill is local or remote. Retrieve the identified Skill's metadata, file inventory, and source snapshot. The Agent then reads the material source files directly and produces a concise semantic and safety assessment. Do not run the local scanner or create `evidence.json`, a relationship graph, or HTML unless the user explicitly requests an evidence package or visual report.

### R2: category search and recommendation

Search SkillHub first, shortlist by relevance, then retrieve and directly inspect the source of the finalists that affect the recommendation. Metadata-only results remain preliminary. Default to a concise comparison and recommendation, not a local-system report.

## Source order

1. “Search SkillHub” means invoking this Skill's bundled local command: `remote-search` for semantic keywords or `remote-list` for marketplace filters. These commands call the paired public service read-only. Do not substitute browser or general web search at this stage.
2. If SkillHub has no relevant result or is unavailable, continue with online search. Prioritize GitHub repositories; a suitable query normally combines the user's scenario with `SKILL.md`, `skills`, or the relevant Agent name.
3. Other online sources may be considered only when they expose complete, reviewable source and clear provenance. Do not broaden the fallback to opaque download sites or executable packages.
4. Preserve the exact source URL and revision when available. Confirm that the source contains a coherent Skill package and fetch the material files read-only for Agent review.
5. Label the discovery source accurately. A GitHub or other online fallback is not a SkillHub result even when it has the same name, author, or upstream project.
6. If online search still has no reviewable candidate, stop and ask the user for the details most likely to disambiguate the request: business scenario, target Agent or platform, expected inputs and outputs, known Skill name or author, or a possible link. Do not fabricate or weakly match a recommendation.

## Verified public endpoints

The following unauthenticated HTTPS endpoints were verified on 2026-09-30:

| Capability | Endpoint | Parameters used by this Skill |
| --- | --- | --- |
| Marketplace list | `GET https://api.skillhub.cn/api/skills` | `page`, `pageSize`, `sortBy`, `order`, `keyword`, `category`, `source`, `labels` |
| Semantic search | `GET https://api.skillhub.cn/api/v1/search` | `q`, `limit` |
| Skill detail | `GET https://api.skillhub.cn/api/v1/skills/{slug}` | optional `namespace` |
| File inventory | `GET https://api.skillhub.cn/api/v1/skills/{slug}/files` | optional `namespace`, `version` |
| File content | `GET https://api.skillhub.cn/api/v1/skills/{slug}/file` | `path`; optional `namespace`, `version` |

The file-content endpoint can redirect to SkillHub-managed Tencent Cloud object storage. The client accepts only HTTPS redirects to the fixed SkillHub API host or known Tencent Cloud storage suffixes.

These are observed public interfaces, not a stability guarantee. On `4xx`, schema drift, or malformed responses, stop and report the limitation rather than guessing an alternate endpoint.

## Commands

Search by natural-language keywords:

```bash
python3 scripts/wizz_skill_keeper.py remote-search --query "PDF OCR" --limit 10
```

Browse the marketplace with filters:

```bash
python3 scripts/wizz_skill_keeper.py remote-list \
  --page 1 --page-size 20 --sort-by score --order desc \
  --keyword "PDF" --category office-efficiency
```

Resolve ambiguous slugs with the `namespace.handle` returned by search or list results:

```bash
python3 scripts/wizz_skill_keeper.py remote-detail <slug> \
  --namespace <namespace-handle> --include-files
```

Fetch source into a new or empty directory:

```bash
python3 scripts/wizz_skill_keeper.py remote-fetch <slug> \
  --namespace <namespace-handle> --version <version> \
  --output <empty-snapshot-directory>
```

Only when the user explicitly requests a remote visual report or evidence package, scan the snapshot:

```bash
python3 scripts/wizz_skill_keeper.py scan <snapshot-directory> --output <scan-directory>
```

For the default remote workflow, the Agent reviews the fetched source directly. For an explicitly requested evidence/report workflow, complete the scanner's Agent-review stage before presenting the generated report as formal.

## Retrieval controls

- No API key, cookie, authorization header, or user credential is sent.
- API origins are fixed in code; user-supplied base URLs are not accepted.
- HTTPS certificate verification remains mandatory. If Python's bundled CA store cannot validate a managed local trust chain, the client may retry with system `curl`; it never disables TLS verification, and it validates each redirect before following it.
- Slugs, namespaces, versions, and sort fields accept only conservative identifier characters.
- Remote paths must be relative, canonical POSIX paths without empty, `.` or `..` components.
- Defaults: 300 files, 1.5 MB per file, 20 MB total, and 20-second requests.
- Every downloaded file is checked against the SHA-256 value in SkillHub's file inventory when present.
- Existing non-empty output directories are never overwritten.
- Remote source is stored as untrusted data and must never be imported or executed.

Increase retrieval limits only when the user needs a deeper review and the expected local resource cost has been disclosed.

## Recommendation policy

Separate discovery signals from reviewed evidence:

1. Search relevance, marketplace score, downloads, installs, stars, verification labels, and platform security reports help shortlist candidates.
2. Candidate descriptions and publisher claims describe intent; they do not prove implementation.
3. Fetch source for one-Skill review targets and serious recommendation finalists; directly review the actual `SKILL.md`, scripts, references, permissions, external destinations, cost language, and conflicts.
4. Compare candidates using the user's scenario, verified capability, material risks, maintenance signals, and analysis limitations.
5. Mark the result as preliminary when a candidate cannot be fully fetched or reviewed. Never present marketplace metadata alone as an Agent-verified recommendation.
6. Do not create a local evidence bundle, relationship graph, or HTML report for remote work unless the user explicitly asks for one.

Searching and reviewing do not authorize installation. Installation remains a separate explicit user action.

When the current host is WorkBuddy and the user explicitly authorizes installation of a reviewed SkillHub result, follow [skillhub-workbuddy-install.md](skillhub-workbuddy-install.md). Do not apply that handoff to non-SkillHub fallback results.
