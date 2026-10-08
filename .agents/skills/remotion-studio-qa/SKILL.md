---
name: remotion-studio-qa
description: Run an evidence-first, heuristic source preflight for Remotion timing, visibility, continuity, layout, media, and determinism, then guide human Studio review; perform encoded-output acceptance only when the user explicitly requests it.
---

# Remotion Studio QA

Use this project Skill after implementing or revising a Remotion composition when visual QA, polish, flicker investigation, motion review, or delivery acceptance matters. It supplements the official Remotion Skills without modifying or replacing them. This is a temporal and visual QA workflow, not a general code-style review.

Apply `remotion-technical-guardrails` before this review. Any still, frame export, or video render used during QA remains headless unless the user explicitly requests non-headless rendering.

## Choose The QA Level

- **Source preflight comes first.** Use deterministic checks plus heuristic questions to inspect frame calculations, visibility, transforms, scene boundaries, captions, layout, media, and rendering determinism before rendering or relying on image recognition. A heuristic match creates a candidate, not a defect; only evidence-backed findings may drive a repair.
- **Human Studio confirmation is the default perceptual review.** Open the composition in Studio when available, direct the user to the risky moments found during preflight, and leave Studio available for interactive verification. Do not render, inspect, or accept an MP4 by default.
- **Targeted stills are diagnostic, not the primary method.** Render or extract boundary frames only when source inspection cannot explain a defect or the user explicitly asks for visual evidence. Keep these checks narrow and do not substitute them for motion playback.
- **Rendered-output acceptance is explicit-only.** Perform MP4 playback, encoded-frame extraction, media-integrity checks, or final-delivery acceptance only when the user explicitly asks to render, inspect, verify, or accept the exported artifact. The mere presence of an existing MP4 does not trigger this level.

## Preflight The Source

Perform this pass before opening Studio:

1. Establish the composition FPS, duration, scene start and end frames, and whether each scene receives global or scene-local frames.
2. Evaluate the actual code state at video frame `0` and at every scene boundary `N-1`, `N`, `N+1`, `N+6`, and `N+12`. Calculate the resulting values; do not stop at noticing an `interpolate()`, `spring()`, or progress helper.
3. Trace visibility and spatial continuity for the background, primary subject, captions, overlays, and high-contrast decorative elements. Inspect `opacity`, `display`, conditional rendering, scale, translation, clipping, masks, and layer order together.
4. Flag a video-global frame-0 element that is fully absent and starts changing immediately at frame 1 when its appearance can read as a startup flash. A first-frame assembly may be intentional, so classify it as a Studio verification item unless the code also removes every visual anchor or creates a definite blank frame.
5. At scene boundaries, detect hard cuts combined with all-zero incoming states, disappearing shared backplates, simultaneous caption replacement and container animation, or one progress value reused for incompatible entrance and exit behavior.
6. Separate conclusions into:
   - **Deterministic source defect:** the evaluated code necessarily creates a blank frame, missing anchor, discontinuity, overlap, or invalid timing state.
   - **Source-level risk:** the code can plausibly create shimmer, flash, unclear focus, or uncomfortable pacing, but perception must be confirmed in Studio.
   - **Studio-only question:** the source is structurally valid and the remaining judgment concerns perceived smoothness, attention, or readability.

Do not request screenshots or rendered frames to prove a deterministic source defect. Source preflight cannot prove final font rasterization, browser or GPU behavior, media decoding, player poster behavior, or encoded-output integrity; route those uncertainties to the appropriate later level.

### Probe With Heuristic Questions

After the deterministic pass, challenge the composition with relevant questions instead of relying only on a fixed rule list. Answer these questions from inspected source, local assets, and calculated frame states; do not ask the user unless creative intent is genuinely required. Select the questions that fit the composition rather than mechanically reporting every item.

- **Timeline and frame domains:** Are scene ranges exhaustive and non-overlapping where intended? Does any component confuse global and scene-local frames? What breaks if FPS, duration, or a scene start changes? Are `Sequence`, transition, caption, and audio ranges aligned?
- **Frame 0 and boundaries:** What changes between frames `0` and `1`? At `N-1`, `N`, `N+1`, `N+6`, and `N+12`, which anchors appear, disappear, or reset together? Can a hard cut combine with an all-zero incoming state or a missing shared backplate?
- **Animation math:** What values can progress, opacity, scale, translation, rotation, and path length actually reach? Are interpolation ranges ordered and clamped where needed? Can `NaN`, division by zero, overshoot, negative local frames, or one progress value reused for incompatible entrance and exit behavior create an invalid state?
- **Determinism and async state:** Does any visible result depend on unseeded randomness, wall-clock time, CSS animation or transition, timers, network timing, DOM measurement, font readiness, or an async resource without an explicit Remotion loading boundary?
- **Visibility, focus, and layers:** Can primary subject, caption, and background anchors all become hidden together? Can overlays, clipping, masks, stacking order, transforms, or translucent detail panels expose competing content or place important content outside the canvas?
- **Subtitles and narration:** Are cue ranges complete and unambiguous? Can the caption container unmount, jump, resize, or go blank at a cue boundary? Is stable reading time plausible, and do known narration and caption ranges disagree?
- **Geometry, charts, and diagrams:** Do connected segments share the same underlying points and endpoints? Can thin lines land on unstable fractional pixels? Are duplicate arrows, markers, or independently animated segments expressing the same relationship without a distinct purpose?
- **Assets and media:** Do referenced local files exist? Are trim, start, end, and duration values within known media bounds? Can loading, decoding, font fallback, aspect ratio, or media timing change the first visible state?
- **Performance-sensitive code:** Is expensive layout, SVG construction, filtering, blur, shadow, or data transformation repeated every frame? Are many fine elements continuously transformed when they are intended to look static?
- **Counterexamples:** What happens with the longest caption, missing optional content, the first and last frame, the shortest scene, an interrupted transition, or a changed FPS? Which hidden assumption would fail first?

A question that cannot be answered with evidence remains an unverified hypothesis. It may become a targeted Studio checkpoint, but it is not a defect and must not trigger a code change.

### Require Evidence Before Action

Do not repair, refactor, retime, or recommend an adjustment merely because a heuristic, pattern match, or generic best practice suggests one. Every reported defect or source-level risk must include an evidence chain appropriate to the claim:

1. the source file and symbol or tight line location;
2. the triggering frame range, boundary, input, or runtime condition;
3. the relevant expression, state flow, geometry, cue range, or asset reference;
4. calculated values or concrete states at the relevant frames, when the claim is frame-dependent;
5. the affected visual role and the specific continuity, timing, layout, determinism, or media invariant at issue;
6. classification as deterministic defect, source-level risk, or Studio-only question, with confidence and remaining uncertainty; and
7. for a source-level risk, the exact Studio frame or time range and observation needed to confirm or reject it.

Acceptable evidence includes traced source logic and evaluated values, verified local file or media metadata, user-confirmed Studio playback observations, and—only when explicitly requested—encoded-output evidence. A keyword match, the mere presence of an animation API, an unanswered heuristic question, or a generic guideline is not evidence. A screenshot or playback symptom can prove the symptom but does not by itself prove the source-level cause.

If the evidence chain is incomplete, record only the specific verification question when it would help the user; otherwise omit it. Do not present an unsupported candidate as a finding, do not propose a speculative repair, and do not modify the composition until evidence supports the change and the current request authorizes implementation.

## Review The Composition

1. Open the target composition in Remotion Studio when Studio is available and give the user the exact timecodes or frames that remain uncertain after source preflight.
2. Ask the user to check the composition at 100% scale first, then at the actual viewing size used by the learner.
3. For every risky scene whose first frame is `N`, review `N-1`, `N`, `N+1`, `N+6`, and `N+12`, expanding the range only when the defect lasts longer.
4. Within each risky scene, review the entrance, one fully assembled stable moment, and the exit.
5. Use timeline playback and frame stepping. Do not infer smoothness from a single still frame.
6. Leave Studio available for user verification and state whether the user confirmed the preview or confirmation remains pending. Never infer user confirmation from successfully opening Studio.

If Studio is unavailable, record that limitation. Do not silently substitute an MP4 review or claim that Studio review occurred unless the user explicitly authorizes rendered-output acceptance.

## What To Check

### Focus And Spatial Ownership

- When a detail opens over an overview, the detail must be the unmistakable primary subject.
- The overview must be deliberately suppressed with the treatment chosen in the Director's focus contract; active labels, connectors, and nodes must not compete through a translucent panel.
- Independent panels, nodes, captions, and legends need their own readable territory. Accidental overlap is a failure.
- Connectors must terminate at intentional object boundaries and must not cross unrelated text or surfaces.

### Subtitles

- The caption container must not disappear for a frame when text changes.
- A new cue may change text cleanly, but must not create a one-frame blank, flash, or vertical jump.
- Keep caption position, height, and wrapping stable across adjacent cues.
- Check long Chinese lines and mixed Latin text separately.

### Fine Visuals

- Fine lines, borders, labels, and small cards must not shimmer while the main composition is static.
- Look for accidental trigonometric jitter, fractional-pixel movement, and repeated rotate or scale on thin shapes.
- Decorative backgrounds should normally be static. If they move, the movement must be intentional and visually stable.

### Charts And Diagrams

- A continuous line must come from one shared point list or one SVG path.
- Adjacent segments must share exactly the same endpoint.
- Use round line caps and joins for teaching diagrams.
- Do not express one connection simultaneously with a continuous line, overlapping circles, and redundant arrows unless each mark has a distinct meaning.
- During reveal, the line should grow along its path rather than resize each segment independently.

### Timing And Transitions

- The incoming scene does not need to be fully readable at `N`. A brief low-contrast, partial, or assembling state is acceptable when it is visibly intentional and becomes clear over the short entrance beat.
- Judge `N`, `N+1`, `N+6`, and `N+12` as a motion trajectory rather than treating `N` as an isolated redline. Fail the transition when it produces a black frame, unintended flash, disappearance of every visual anchor, or a persistently unclear subject—not merely because the first frame carries less information.
- Separate scene presence from internal drawing, entering, or assembling progress.
- A scene's exit fade must not reverse the internal animation.
- Use short, deliberate entrances and leave enough stable time for the learner to read.
- A scene should have a clear entrance, readable hold, and intentional exit.

## Failure Diagnosis

Classify a defect before changing code:

- Blank, flashing, or persistently unclear scene start: a hard cut combined with an all-zero incoming state, disappearing anchors, or an entrance that does not resolve into a clear subject.
- Subtitle flash at a cue boundary: caption opacity or replacement timing.
- Whole-frame shimmer: moving background, subpixel transform, or repeated rasterization.
- Local panel flicker: jitter, rotating thin geometry, nested opacity or scale, or competing layers.
- Broken or ambiguous connector: independent geometry, duplicate connection marks, or missing spatial ownership.
- Slow or hesitant motion: scene duration and animation duration are coupled, or the scene spends too long in a static hold.
- Reversed motion at scene end: one progress value controls both scene presence and internal animation.

## Delivery Acceptance

Do not perform this section unless the user explicitly requests rendered-output inspection or final-delivery acceptance.

When requested, play the encoded MP4 once from start to finish at normal speed and extract encoded boundary frames for risky transitions. A full FFmpeg decode proves that the file is decodable; it does not prove that the video has no flicker, overlap, empty transition frames, unclear attention order, or pacing defects. Studio inspection does not replace final-artifact playback when this explicit acceptance level applies.

Record a short QA note with:

- composition id and review date;
- source-preflight results, including evidence chains, evaluated boundary values, deterministic defects, rejected heuristic candidates, and risks routed to Studio;
- every scene boundary and the results for `N-1`, `N`, `N+1`, `N+6`, and `N+12`;
- focus-state and spatial-ownership result;
- subtitle, chart, timing, and transition results;
- whether the result covers only the composition, includes user Studio confirmation, or includes explicitly requested rendered-output acceptance;
- for rendered-output acceptance, the final encoded MP4 playback result and any extracted boundary frames;
- remaining issues and whether they block delivery.

Do not describe Studio-only QA as final MP4 acceptance. When rendered-output acceptance is explicitly requested, do not mark the video clean merely because it renders or decodes successfully; final acceptance requires both media-integrity evidence and perceptual review of the encoded output.
