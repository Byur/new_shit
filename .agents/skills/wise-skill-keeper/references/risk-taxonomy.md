# Risk Taxonomy

Use tags as evidence-backed descriptions, not accusations of malicious intent.

This taxonomy is broader than the first-stage detector. A tag listed here is not evidence
that automated detection exists for every form of that risk; unsupported or ambiguous cases
must remain an analysis limitation rather than being inferred from absence.

## Data And Permissions

- `external-data-transfer`: User or workspace data can be sent to a third party.
- `credential-access`: Tokens, cookies, passwords, shell profiles, or credential stores are accessed.
- `broad-file-access`: File access is broader than the declared task requires. Necessary local-only reads
  are capability context, not this risk; apply the tag only when the scope exceeds the declared feature or
  feeds another consequential path.
- `unsafe-url-fetch`: User-controlled URLs can reach local, private, or metadata endpoints.
- `silent-telemetry`: Usage or content is reported without timely disclosure.

## Execution And Integrity

- `arbitrary-code-execution`: A reachable and insufficiently constrained flow lets user-controlled or
  untrusted input determine code or commands executed by the host, Agent runtime, or a privileged browser
  bridge. A fixed command, an execution primitive without a controllable input path, or ordinary browser
  content injection does not satisfy this tag.
- `content-rendering-boundary`: Untrusted content reaches HTML, DOM, Markdown, SVG, or script-data output,
  but the evidence does not yet establish that it can escape the intended context. This is neutral capability
  context, normally `info` or `low`, and must not be described as unsafe by itself.
- `unsafe-content-rendering`: The Agent has derived a concrete value that escapes its intended rendering
  context and changes the generated artifact into active HTML or browser script under realistic use, with
  missing or insufficient mitigation. The review must include `renderingAssessment`. Escalate this to
  `arbitrary-code-execution` only when a verified privileged bridge or another path reaches the host or
  Agent runtime.
- `destructive-action`: Files, repositories, accounts, or published content can be irreversibly changed.
- `obfuscated-behavior`: Encoded or intentionally obscured behavior prevents ordinary inspection.
- `supply-chain-risk`: Mutable or unpinned remote dependencies materially affect execution.
- `documentation-mismatch`: User-facing claims conflict with implementation or requirements.

## Prompt And Human Factors

- `scope-hijack`: Trigger metadata or instructions claim unrelated or excessively broad tasks.
- `priority-escalation`: The Skill claims authority above the user, system, or other instructions.
- `instruction-conflict`: Instructions directly conflict with user choice or platform safety boundaries.
- `authorization-overreach`: One action or approval is treated as permission for additional actions.
- `disclosure-suppression`: The Skill asks the agent to hide behavior, limitations, cost, or risk.
- `delayed-disclosure`: Material cost or data transfer is disclosed only after commitment.
- `authority-imitation`: The Skill presents itself as official, mandatory, or system-owned without evidence.
- `manipulative-commerce`: Urgency, loss aversion, free-credit framing, or other pressure drives registration or payment.
- `policy-evasion`: Instructions encourage bypassing review, detection, moderation, rate limits, or platform controls.
- `cognitive-overload`: Important consent information is obscured by excessive or poorly structured instructions.

## Cost And Product Claims

- `paid-operation`: A call can consume money, credits, quota, or a paid account.
- `unverified-claims`: Official status, coverage, ranking, safety, or accuracy is asserted without verifiable support.

## Severity And Confidence

Severity describes potential user impact: `info`, `low`, `medium`, `high`, `critical`.

Confidence describes evidence strength: `heuristic`, `probable`, `confirmed`.

Never increase confidence merely because wording is alarming. Confirmed static evidence means the behavior is explicit in inspected files; it does not mean the behavior was executed.

### Commercial-pressure calibration

- `info` or `low`: A one-time, clearly optional offer with material costs disclosed before commitment.
- `medium`: Repeated promotional framing or incomplete cost disclosure, but no instruction forces the
  Agent to present it in every relevant response.
- `high`: Operative instructions make registration, free-credit, upgrade, or subscription prompts
  mandatory or repeated across success and no-result states, especially when pricing, credit consumption,
  renewal, or cancellation is not disclosed before the user engages.
- `critical`: Reserve for coercion combined with confirmed unauthorized charging, credential theft, or
  another critical-impact action; pressure language alone is not critical.

Commercial-pressure severity is independent of payment confidence. The prompt pattern can be confirmed
while the existence or amount of an actual charge remains only probable or unverified.
