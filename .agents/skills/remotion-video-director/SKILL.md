---
name: remotion-video-director
description: Direct an approved technical-explainer plan into narration, storyboard, visual language, pacing, caption intent, and creative acceptance criteria. Use when a Remotion video needs creative direction or creative review. Collaborate with remotion-best-practices, which owns code, APIs, Studio, media, debugging, rendering, and upgrades.
---

# Remotion Video Director

Turn an approved learning direction into a Remotion video that has something clear to say, gives the viewer a reason to keep watching, and makes the idea easier to understand than narration alone could.

## Responsibility

Own the narrative, script, storyboard, visual language, caption wording and editorial cue intent, pacing, creative implementation intent, and creative review criteria. Preserve the learning promise, scope boundary, and essential proof from the planning brief.

Do not own Remotion API choices, caption synchronization code, frame calculations, code review, Studio operation, media handling, debugging, render commands, package upgrades, or technical delivery validation. Use `remotion-best-practices` for those responsibilities, `remotion-technical-guardrails` for project-specific continuity and render-mode constraints, and `remotion-studio-qa` for systematic playback, transition, flicker, and frame-level verification.

Do not reopen topic selection, source research, or lesson scope simply to fill the video. Use `knowledge-planner` first when those decisions are unresolved.

## Collaboration Order

When this Skill and `remotion-best-practices` both apply, treat them as consecutive roles rather than competing owners:

1. Confirm the approved learning direction; use `knowledge-planner` first if the topic, audience, evidence, or teaching scope is unresolved.
2. Define the format proposition, narration, storyboard, subject-specific visual evidence, pacing, caption intent, and creative acceptance criteria before technical implementation choices are finalized.
3. Hand the approved creative brief to `remotion-best-practices` for Remotion structure, APIs, animation code, Studio operation, media handling, debugging, and rendering. Apply `remotion-technical-guardrails` alongside that implementation; it supplements rather than replaces the official Skill.
4. Review the assembled preview for meaning, attention order, visual identity, and pacing. Let `remotion-studio-qa` own systematic playback stability, encoded-output review, and frame-level defect verification.

For a technical-only request, leave creative decisions unchanged and let `remotion-best-practices` lead. For a creative-only request, produce the creative brief without starting Studio, editing code, or rendering unless the user also asks for implementation.

## Creative Direction

Direct for clarity and feeling. Find the visual event that embodies the idea: a reveal, transformation, contrast, consequence, accumulation, or simplification. Do not default to generic screens, cards, or motion that merely repeats the narration.

Aim by default for visual expression with tension, emotional pull, and memorable images. It should make the viewer feel a shift in scale, clarity, urgency, surprise, relief, or consequence when the idea calls for it, while keeping the concept easy to follow. Let the topic decide the form, scene count, pace, and asset mix. A good video may be spare or dense; it should never look like it is following a stock sequence.

Treat every line, visual, and transition as a choice. It should add meaning, direct attention, create rhythm, or give the viewer time to form the intended inference. Let important moments breathe rather than racing to cover material.

Keep on-screen text economical and complementary to narration. Use the project's established visual system, scene primitives, caption treatment, and package manager. Keep Remotion frame state as the source of timing; add another animation runtime only when it solves a specific need the existing system cannot.

## Format Identity And Teaching Bridges

Reuse the project's visual system as infrastructure, not as a default story shape. Before production, find a visual grammar that belongs to this subject: its scale, material, place, system, conflict, or point of view. Let that choice determine the composition, pacing, spatial logic, and moments of interruption. Do not carry a familiar title-left, diagram-right, caption-bottom layout from one topic to the next merely because it is available.

Write a short format proposition before storyboarding: what should the viewer see, feel, or follow in order to understand this subject, and what familiar explanatory treatment would fail to do it justice? Use it to make an affirmative creative choice, not to justify novelty for its own sake.

For each important beat, name the visual evidence that is specific to the claim: an object, behavior, constraint, environment, trace, or transformation that lets the viewer infer the point. A generic comparison, process, or card layout is only useful when it is the clearest carrier of that evidence. If the topic nouns could be replaced with those of another video while the scene still works unchanged, revisit the scene's point of view, material, or action.

When a teaching claim crosses a meaningful conceptual distance, direct the bridge rather than presenting only its endpoints. Give the viewer enough of the condition, mechanism, result, and trade-off to follow the change. The bridge may be a sequence, a live transformation, a comparison, or a pause; choose the form that makes causality perceptible.

## Visual Variety And Scene Rhythm

Avoid repetitive scene construction. Do not let consecutive scenes fall into the same composition, motion pattern, or information shape unless repetition is intentionally used for comparison, continuity, or rhythm.

Prefer meaningful visual progression over decorative variation. When narration introduces a relationship, process, comparison, quantity, transformation, or consequence, look for a visual representation rather than defaulting to another text-first scene.

Across a sequence, let the visual language evolve when the idea evolves: through composition, scale, emphasis, spatial relationship, reveal, transformation, or asset type. Change is valuable only when it clarifies a new thought, shifts attention, or creates an intentional emotional beat. Motion itself is not required.

Reuse established visual primitives when they remain the clearest expression of the idea. Do not invent a new visual device merely to avoid repetition.

## Focus States And Scene Handoffs

When an overview remains visible while a detail opens, define a focus contract in the storyboard:

- Name the primary subject, the context that must remain recognizable, and the elements that must be visually suppressed.
- Keep the overview as context rather than a competing foreground. Choose an appropriate treatment such as a mask, dimming, blur, crop, scale change, or camera shift; do not leave every label, connector, node, and detail panel at equal emphasis.
- Give the focused detail its own readable territory. Do not place independent cards or panels over active overview labels, connectors, or nodes unless the overlap itself carries meaning.
- State how attention enters and leaves the focus state so the implementation can preserve continuity.

For every scene boundary, specify the persistent visual anchor or the first readable state of the incoming scene. A hard cut must not intentionally create a moment where all primary information disappears and then fades back in. Leave frame calculations and transition APIs to the technical Skills, but make the intended continuity explicit in the creative brief.

## Evidence And Data

Use data as evidence, never as a badge of research. Place a number only when it changes the viewer's confidence in a claim or makes a relationship observable. Introduce the claim or question first, then show the measure, its time and unit, and the inference the viewer should draw. Add a comparison only when it is necessary to make the number meaningful.

If you cannot say why a number is on screen in one clear sentence, remove it. A useful data treatment makes its evidentiary job legible: what it measures, what it proves here, and what it does not prove.

## Review And Delivery

Source review alone is not enough for creative sign-off. Using the preview or sampled frames supplied by the technical workflow, intentionally inspect the scenes and moments carrying the most meaning or creative risk, including fully assembled states and transitions where relevant. Apply judgment rather than a mechanical quota:

- Is the intended attention order immediately clear?
- Does the composition remain legible, balanced, and uncluttered?
- Does the visual progression feel varied and purposeful, or has the video fallen into repetitive layouts and motion patterns?
- Can the format proposition still be felt in the assembled scenes, or has the video fallen back to the project's default explanatory shell?
- Would a topic-noun replacement leave a key scene essentially unchanged? If so, strengthen the subject-specific visual evidence rather than adding decorative variation.
- Do connectors, masks, and moving elements respect the spatial ownership of the objects they describe? Treat every connected object as a bounded surface: connectors must be computed or drawn edge-to-edge between intentional anchors, not center-to-center. Never rely on z-index alone to hide a connector behind a translucent surface; sample its assembled state and its draw-in motion.
- Do independently meaningful nodes have their own visible territory? Treat accidental overlap as a rendering failure unless the scene explicitly depicts containment, collision, or replacement.
- Does every number state its measurement, scope or time, and evidentiary purpose? Remove decorative statistics rather than asking the viewer to infer why they matter.
- Does the creative timing of animation, captions, or temporary states create competing focal points or weaken the intended meaning? Report obvious collisions, clipping, or flicker to `remotion-studio-qa` for systematic verification.
- When a detail opens over an overview, is the primary subject unmistakable, is the background deliberately suppressed, and does the detail occupy independent space?
- At each scene boundary, does a meaningful anchor persist or does the incoming scene begin in a readable state without an unintended empty flash?
- Would a paused frame still communicate the intended relationship?


Record the creative states that need inspection and any remaining creative risk. When an implementation exists, assess the supplied preview or sampled frames against these criteria; leave systematic playback checks, rendering, and output verification to the relevant technical Skill.
