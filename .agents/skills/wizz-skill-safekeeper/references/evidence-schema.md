# Evidence Schema

`evidence.json` contains technical details that remain hidden from the default report.

The public `report.json` and `index.html` must not contain absolute paths, source excerpts,
real endpoint names, credential identifiers, content hashes, or prompt-profile counters.
Those fields belong only in `evidence.json`, which is read after an explicit technical-analysis request.

The scanner's findings and `candidateGraph` are collection output. They are not final findings or
the user-facing relationship graph. An Agent must review the evidence and provide a separate
`agent-reviewed` document before final severity, recommendation, or graph edges are rendered.

Each finding should include:

```json
{
  "id": "stable-finding-id",
  "skillId": "stable-skill-id",
  "tag": "external-data-transfer",
  "severity": "high",
  "confidence": "confirmed",
  "evidenceType": "code",
  "source": "scripts/check.py",
  "line": 42,
  "excerpt": "requests.post(endpoint, json={...})",
  "title": "Content can be sent to a third party",
  "plainExplanation": "The Skill can send supplied content outside this computer.",
  "technicalExplanation": "A POST request includes the content field.",
  "trigger": "When the check command runs",
  "affectedData": ["user content"],
  "destination": "example.com",
  "linguisticFeatures": [],
  "claimedPriority": null,
  "actualPriority": null,
  "recommendation": "require-confirmation"
}
```

## Evidence Types

- `metadata`: YAML frontmatter and invocation policy.
- `prompt`: Natural-language instructions, human factors, and claimed priority.
- `code`: Scripts, commands, file access, or network behavior.
- `contract`: Difference between declared and implemented behavior.
- `relationship`: Shared domains, credentials, files, triggers, or dependencies.

Candidate relationships help the Agent find comparisons; they are not formal conclusions. For a local-system
review, the Agent must also compare all in-scope Skills directly across capability overlap, trigger conflict,
shared dependency, behavioral interaction, and combined risk. This full comparison is required even when the
scanner's token or resource heuristics emit no candidate edge.

Do not convert shared resource-node labels into Skill-to-Skill relationships. Labels such as “公开搜索服务”,
“外部站点”, “API Key”, or “本地文件” are categories and may refer to unrelated implementations. A formal
relationship must be an Agent-authored Skill-to-Skill edge backed by public-safe evidence from both source
packages, a concrete impact diagnosis, and a recommendation. `shared-dependency` additionally requires proof
that both Skills resolve to the same named dependency or resource, not merely the same resource category.

## Evidence Chain

Keep these three claims separate:

1. Prompt evidence: what the Skill asks the agent to do.
2. Code evidence: what inspected scripts appear capable of doing.
3. Contract evidence: what the Skill tells the user it does.

When all three agree, confidence may be high. When they conflict, emit a separate `documentation-mismatch` finding rather than silently choosing one source.
