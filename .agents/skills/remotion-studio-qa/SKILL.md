---
name: remotion-studio-qa
description: Verify technical and perceptual quality for Remotion compositions and requested exports, including timing, continuity, layout, media, and rendering defects.
---

# Remotion Studio QA

Use this project Skill after implementing or revising a Remotion composition when visual QA, polish, flicker investigation, motion review, or delivery acceptance matters. It supplements the official Remotion Skills without modifying or replacing them. This is a temporal and visual QA workflow, not a general code-style review.

Use `remotion-technical-guardrails` for implementation constraints and render mode.

## Review Scope

Match coverage to the request and the reach of the change. A full composition review covers startup and every scene boundary. A scoped revision covers the changed material and any dependent states, including affected shared components and timing. Reuse existing evidence for unchanged states when it still applies.

For composition review, start with source preflight when matching source is available and use Studio for perceptual checks. Use targeted stills for spatial evidence and playback for motion and timing.

Verify the encoded output when the user requests a final exported video or explicitly asks for encoded-output inspection. Use the scope in Encoded Output. A preview or diagnostic render has the scope of its stated purpose.

## Preflight The Source

When matching source is available, preflight it before confirming a source diagnosis. Studio may already be open.

1. Establish the composition FPS and duration, the relevant scene ranges, and which frame domain those scenes use.
2. Evaluate frame `0` if startup is in scope. For an in-scope handoff, evaluate the boundary and its immediate neighbors, then choose additional frames from the actual transition duration and frame rate. Calculate the effect of the actual frame logic.
3. Trace visibility and spatial continuity for the background, primary subject, captions, overlays, and high-contrast decorative elements. Inspect `opacity`, `display`, conditional rendering, scale, translation, clipping, masks, and layer order together.
4. When startup is in scope, flag a video-global frame-0 element that is fully absent and starts changing immediately at frame 1 when its appearance can read as a startup flash. A first-frame assembly may be intentional, so classify it as a Studio verification item unless the code also removes every visual anchor or creates a definite blank frame.
5. At scene boundaries, detect hard cuts combined with all-zero incoming states, disappearing shared backplates, simultaneous caption replacement and container animation, or one progress value reused for incompatible entrance and exit behavior.
6. Separate conclusions into:
   - **Deterministic source defect:** the evaluated code necessarily creates a blank frame, missing anchor, discontinuity, unintended overlap, or invalid timing state.
   - **Source-level risk:** the code can plausibly create shimmer, flash, unclear focus, or uncomfortable pacing, but perception must be confirmed in Studio.
   - **Perceptual question:** the result depends on rendered behavior such as perceived smoothness, attention, or readability.

Do not request screenshots or rendered frames to prove a deterministic source defect. Source preflight cannot prove final font rasterization, browser or GPU behavior, media decoding, player poster behavior, or encoded-output integrity; route those uncertainties to the appropriate later level.

### Probe With Heuristic Questions

After the deterministic pass, challenge the composition with relevant questions instead of relying only on a fixed rule list. Answer these questions from inspected source, local assets, and calculated frame states; do not ask the user unless creative intent is genuinely required. Select the questions that fit the composition rather than mechanically reporting every item.

- **Timeline and frame domains:** Are scene ranges exhaustive and non-overlapping where intended? Does any component confuse global and scene-local frames? What breaks if FPS, duration, or a scene start changes? Are `Sequence`, transition, caption, and audio ranges aligned?
- **Startup and handoffs:** Which anchors appear, disappear, or reset together at the probed states? Can a hard cut combine with an all-zero incoming state or a missing shared backplate?
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

Do not repair, refactor, retime, or recommend an adjustment merely because a heuristic, pattern match, or generic best practice suggests one. Support a source diagnosis or risk with the applicable parts of this evidence chain:

1. the source file and symbol or tight line location;
2. the triggering frame range, boundary, input, or runtime condition;
3. the relevant expression, state flow, geometry, cue range, or asset reference;
4. calculated values or concrete states at the relevant frames, when the claim is frame-dependent;
5. the affected visual role and the specific continuity, timing, layout, determinism, or media invariant at issue;
6. classification and remaining uncertainty; and
7. for a source-level risk, the exact Studio frame or time range and observation needed to confirm or reject it.

Acceptable evidence includes traced source logic and evaluated values, verified local file or media metadata, Studio observations, and encoded evidence within the requested scope. Attribute user confirmation only when actually received. A keyword match, the mere presence of an animation API, an unanswered heuristic question, or a generic guideline is not evidence. A screenshot or playback symptom can prove the symptom but does not by itself prove the source-level cause.

Report an observed playback defect with its frame or timecode, the affected element, and the visible symptom. Keep its source cause open until supported by matching source evidence. An unconfirmed candidate is a verification question. Repair confirmed defects within the authorized scope.

## Review The Composition

Use Studio when available. Verify the states identified by preflight at the intended output resolution and viewing size as relevant. For a risky transition, use playback and frame stepping from entrance through the settled state and exit. Give the user exact times for any states that need their confirmation and distinguish their confirmation from your observations.

If Studio is unavailable, report what could be verified and which perceptual checks remain open. Apply Review Scope to any export.

## What To Check

### Focus And Spatial Ownership

Inspect the actual content in the states most likely to stress its layout, including assembled and overlapping states where relevant. Check that text fits its assigned space and required content stays visible and readable. Canvas bounds establish only outer-frame coverage. Judge deliberate layering against the intended focus and the visibility of required context. Connectors should meet their intended targets and keep unrelated content clear.

### Subtitles

- Check cue changes for unintended blanks, flashes, and position or wrapping jumps. Compare gaps and movement with the intended caption timing.
- Use the captions most likely to stress the actual layout or font rendering.

### Fine Visuals

- Inspect fine lines, borders, labels, and small cards for unintended shimmer.
- Look for accidental trigonometric jitter, fractional-pixel movement, and repeated rotate or scale on thin shapes.
- Decorative backgrounds should normally be static. If they move, the movement must be intentional and visually stable.

### Charts And Diagrams

Check that the diagram communicates the intended relationships as it builds. Inspect intended joins for gaps or misalignment, and verify that a reveal preserves the shape of the path it exposes.

### Timing And Transitions

Judge the transition over its playback trajectory. Check whether the intended continuity cues survive and the incoming subject resolves into a readable state without unintended blanks, flashes, or reversals. Allow deliberate entrances and gradual assembly when they preserve the intended focus.

## Failure Diagnosis

Use these possible causes to guide diagnosis before changing code.

- Blank, flashing, or persistently unclear scene start: a hard cut combined with an all-zero incoming state, disappearing anchors, or an entrance that does not resolve into a clear subject.
- Subtitle flash at a cue boundary: caption opacity or replacement timing.
- Whole-frame shimmer: moving background, subpixel transform, or repeated rasterization.
- Local panel flicker: jitter, rotating thin geometry, nested opacity or scale, or competing layers.
- Broken or ambiguous connector: independent geometry, duplicate connection marks, or missing spatial ownership.
- Slow or hesitant motion: scene duration and animation duration are coupled, or the scene spends too long in a static hold.
- Reversed motion at scene end: one progress value controls both scene presence and internal animation.

## Encoded Output

For final delivery acceptance, verify media integrity and play the encoded video once from start to finish at normal speed. Inspect encoded boundary frames where a transition needs frame-level evidence. For a targeted encoded review, inspect the requested interval and enough surrounding context to evaluate it.

Report media integrity and perceptual results according to the evidence actually obtained. Studio preview establishes composition evidence. Decoding and file metadata establish media-integrity evidence.

## Report

Summarize the scope, evidence used, and results. Cite the relevant frames, timecodes, or conditions for defects and unresolved checks. Distinguish the checks performed in source, Studio, and the encoded output, and state whether user confirmation or final acceptance is pending when applicable.
