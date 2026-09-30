# Recommendation Policy

Recommendations communicate proportionate next steps after Agent review. The local scanner must
not derive or publish a final recommendation; its rule matches are candidates only. Recommendations
never authorize mutation.

For `medium`, `high`, or `critical` results, the Agent must also provide a user-facing
`plainRecommendation` that says exactly what to confirm, limit, replace, or stop. The interface does not
show recommendations for `info` or `low` results. Write user-facing guidance in the user's language,
defaulting to Simplified Chinese when no reliable preference exists.

## Actions

- `keep`: No material risk found in the inspected scope.
- `keep-with-notice`: Keep the Skill, with a one-time disclosure of the specific low-impact behavior. This internal category is not shown as a recommendation for low-risk results.
- `require-confirmation`: State which data, site, account, cost, publication, or destructive change requires confirmation immediately before it happens.
- `restrict`: Name the exact invocation, file scope, site, account key, budget, or request rate to limit.
- `explicit-only`: Tell the user to disable automatic invocation and run the Skill only when they explicitly name it.
- `isolate`: Temporarily stop normal use only when the review confirms a genuinely harmful path under realistic
  use and narrower controls cannot reduce the risk adequately.
- `uninstall`: Recommend removal only for confirmed, unacceptable harmful behavior such as credential theft,
  concealed exfiltration, destructive execution, or persistent instruction manipulation, when continued safe
  use is not reasonably achievable.

## Decision Guidance

- Prefer `require-confirmation` for legitimate but consequential capabilities.
- Prefer `explicit-only` for scope hijacking or optional paid services.
- Prefer `explicit-only` for a useful Skill whose optional commercial prompts are repeated or mandatory.
  Commercial pressure, even at high severity, does not by itself justify isolation. Combine `explicit-only`,
  `restrict`, or `require-confirmation` with clear disclosure when credential, execution, or cost risks remain.
- Prefer `restrict` when a narrow allowlist can preserve useful behavior.
- Severity alone never selects the disposition. High or critical findings can still result in `restrict`,
  `explicit-only`, or `require-confirmation` when those controls address the realistic harm path.
- When intent, trigger conditions, reach, or downstream harm is uncertain, do not recommend isolation solely
  as a precaution. Prefer the least disruptive effective control and state the remaining uncertainty.
- Before recommending `isolate`, confirm all three conditions: a concrete harmful consequence, a credible
  trigger under expected use, and the insufficiency or unavailability of narrower controls.
- Use `uninstall` more sparingly than `isolate` and state the exact confirmed evidence supporting it.
- If only heuristic or unverified candidates exist, do not recommend uninstall solely from the aggregate score.

## Evidence Gate For Isolation Or Removal

An Agent review that recommends `isolate` or `uninstall` must include:

- `harmAssessment.status: "confirmed"`;
- a plain-language `harmAssessment.explanation` describing the concrete harm and realistic trigger; and
- `harmAssessment.narrowerControlsInsufficient: true`, with the conclusion explaining why confirmation,
  explicit invocation, allowlists, credential scoping, or other restrictions are not enough.

A confirmed vulnerability, risky primitive, documentation mismatch, or alarming prompt is not automatically
confirmed harm. If exploitation, activation, destination, or user impact remains conditional, use a narrower
recommendation while keeping the appropriate risk severity.

Always state whether the host can enforce the proposed control. A diagnostic Skill cannot itself guarantee runtime interception.
