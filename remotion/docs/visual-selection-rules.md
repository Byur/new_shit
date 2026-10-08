# Visual Selection Rules

Use these rules when creating Remotion knowledge videos in this project.

## Content To Scene

- Single concept or definition: `KeyPointScene` or `ConceptMapScene`
- Two ideas that must be distinguished: `ComparisonScene`
- Step-by-step action or workflow: `ProcessScene`
- Time development or cause/effect over time: `TimelineScene`
- One decisive number: `BigNumberScene`
- Boundary, disclaimer, or external phrasing: `QuoteScene`

## Complexity Limits

- One scene should teach one primary idea.
- Use at most two major motion primitives per scene.
- Motion must reveal information, show causality, or highlight a teaching point.
- Do not add decorative motion when a static component is clearer.
- Prefer existing scene components before creating new layouts.
- Keep captions stable in height and position across adjacent cues.

## Dependency Positions

- Remotion owns the frame timeline and render.
- `@remotion/gsap` is for complex timeline choreography only.
- `@remotion/shapes` and local SVG primitives are for arrows, callouts, highlights, and concept diagrams.
- `@remotion/transitions` is for scene-to-scene transitions.
- Phosphor icons are concept markers, not decorative UI chrome.
