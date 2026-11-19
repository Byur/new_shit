---
name: remotion-video-director
description: Direct a Remotion explainer into narration, storyboard, visual language, pacing, caption intent, and creative acceptance criteria. Use when a Remotion video needs creative direction or creative review. Collaborate with remotion-best-practices, which owns code, APIs, Studio, media, debugging, rendering, and upgrades.
---

# Remotion Video Director

Turn a learning direction into a Remotion video that has something clear to say, gives the viewer a reason to keep watching, and makes the idea easier to understand than narration alone could.

## Responsibility

Own the narrative, full spoken explanation (narration script), storyboard, visual language, caption wording and editorial cue intent, pacing, creative implementation intent, and creative review criteria. Preserve the learning promise, scope boundary, essential proof, and the reasoning bridges from the planning brief. Do not trade explanation depth for a shorter runtime or a cleaner-looking frame.

Do not own Remotion API choices, caption synchronization code, frame calculations, code review, Studio operation, media handling, debugging, render commands, package upgrades, or technical delivery validation. Use `remotion-best-practices` for those responsibilities, `remotion-technical-guardrails` for project-specific continuity and render-mode constraints, and `remotion-studio-qa` for systematic playback, transition, flicker, and frame-level verification.

Use the approved learning direction and evidence as the factual basis for audiovisual production. Do not reopen topic selection, subject research, or lesson scope to fill the video. If the brief lacks an essential explanation or a visual choice exposes a disputed teaching claim, return that specific question to `knowledge-planner` for a targeted revision; do not silently turn the gap into a decorative scene.

## Collaboration Order

1. Confirm the learning direction. Use `knowledge-planner` when the audience, teaching scope, or essential evidence still needs to be established.
2. Develop the explanatory track and the visual argument together. Set the format proposition, storyboard, editorial cues, and creative review criteria. Assess timing under Duration Derived From Teaching.
3. Hand composition work to `remotion-best-practices` with `remotion-technical-guardrails`. When playback can resolve open decisions about the order or pacing of several scenes, use an early rough cut in the production composition. Play the authored explanatory track with representative visuals. Settle the sequence and timing decisions that detailed scene work depends on.
4. Implement the creative direction and apply Effective-Content Review During Coding as the actual material takes shape. Fine-cut the assembled material in playback with its actual visuals and explanatory track. Adjust cuts, holds, and reveals where they affect how the viewer follows the explanation. If the fix changes the sequence across scenes, revisit the sequence and its affected handoffs before refining local timing.
5. Review the assembled cut under Review And Delivery. Use `remotion-studio-qa` for technical verification.

For a technical-only request, leave creative decisions unchanged and let `remotion-best-practices` lead. For a creative-only request, produce the creative brief without starting Studio, editing code, or rendering unless the user also asks for implementation.

## Creative Direction

Direct for clarity and feeling. Find the visual event that embodies the idea: a reveal, transformation, contrast, consequence, accumulation, or simplification. Do not default to generic screens, cards, or motion that merely repeats the narration.

Aim by default for visual expression with tension, emotional pull, and memorable images. It should make the viewer feel a shift in scale, clarity, urgency, surprise, relief, or consequence when the idea calls for it, while keeping the concept easy to follow. Let the topic decide the form, scene count, pace, and asset mix. A good video may be spare or dense; it should never look like it is following a stock sequence.

Do not interpret simplicity as short duration, fewer words, or fewer causal steps. Compress repeated explanations and visual clutter; protect the time and screen space needed to make a consequential idea comprehensible. When the idea needs a slower demonstration, let it unfold.

Treat every line, visual, and transition as a choice. It should add meaning, direct attention, create rhythm, or give the viewer time to form the intended inference. Let important moments breathe rather than racing to cover material.

Keep on-screen text economical and complementary to narration. Economical on-screen text does not imply terse narration, and short scene labels are not a substitute for a teaching script. Use the project's established visual system, scene primitives, caption treatment, and package manager. Keep Remotion frame state as the source of timing; add another animation runtime only when it solves a specific need the existing system cannot.

## Visual Evidence And Asset Exploration

Choose visual media according to what the audience needs to observe, not according to what is easiest to construct in code. Treat Remotion as the composition and rendering medium, not as a creative boundary.

When the subject involves physical objects, environments, people, or real-world processes, consider whether authentic footage, photography, existing illustrations, diagrams, or 3D assets can reveal appearance, scale, behavior, context, or mechanism more faithfully than a procedural reconstruction. The medium itself is not proof of a claim. Distinguish whether an asset is being used as evidence, illustration, or simulation, and communicate that distinction to viewers when confusion would affect understanding.

Explore potentially useful visual references and assets early when their availability or constraints could materially inform the format or resolve a concrete scene decision. Let compelling evidence or source material inspire scenes, not merely fill predefined placeholders. Combine real-world material with animation, overlays, cutaways, or transformations when the combination makes otherwise hidden mechanisms understandable. Keep this exploration focused on visual direction and the established factual basis.

Consider changes of perspective, spatial scale, or visual medium when the underlying knowledge calls for them. A shift from a real object to an internal mechanism, or from an observable phenomenon to an explanatory model, can itself become a meaningful narrative event.

Choose assets for their explanatory value, not for variety or spectacle. Identify source and usage-rights considerations for proposed assets; leave verification and clearance to the relevant technical or media workflow. Do not make footage, 3D, or multiple media types mandatory; the Director defines the asset's explanatory role while acquisition, processing, and rights clearance remain with the relevant technical or media workflow.

## Narrative Continuity And Explanatory Momentum

Direct an unfolding experience rather than illustrating an outline. Identify the persistent question, subject, object, or changing system carried across the video, and state what the viewer should newly notice, understand, anticipate, or feel as the sequence unfolds. When a beat ends, show what has changed, what remains uncertain, and why the next beat is worth watching. Where an evolving example is used, preserve its concrete state and consequences across scenes: do not reset the example each time a new term appears.

A recurring object, continuous chart, or shared storyline is only a carrier of continuity; its changing state should alter the viewer's understanding, expectations, or attention. If scenes remain interchangeable despite apparent continuity, reconsider their audiovisual relationship and prefer meaningful development over extra motion, decorative variation, or artificial drama. Continuity may emerge through a story, experiment, contrast, spatial transformation, montage, or another form appropriate to the material.

Use explanation at the moment it becomes necessary. Let a visible event or meaningful question create demand for the next concept, then deliver the causal explanation with enough detail that the viewer can follow what happened and why. Do not postpone indispensable explanations for the sake of suspense, or add a story wrapper that contributes nothing to understanding.

Maintain a continuous argument in the explanatory track as well as a continuous visual thread. Narration should connect consequences, decisions, discoveries, and qualifications across scene boundaries; avoid writing isolated mini-lectures with interchangeable scene introductions. A complete narration script is not a series of longer definitions. If the material becomes more thorough but loses its sense of progression, revise the structure rather than simply shortening the speech.

Different subjects may call for a worked transaction, investigation, experiment, changing mental model, or conceptual proof. Choose the narrative device because it clarifies the subject, not because every lesson needs a protagonist or plot twist. Where a real-world process is simulated, keep the simplifying assumptions and factual limitations explicit.

## Explanatory Narration And Text Roles

Own a complete, naturally spoken explanation rather than an outline of scene headings, slogans, or labels. Narration should carry the question being investigated, necessary assumptions, reasoning transitions, mechanism, limitations, and the conclusion where these need verbal explanation. The visual track should make the important claims observable and easier to grasp; it may carry spatial or perceptual information more efficiently than speech. Neither track should be a mere echo of the other.

Treat these as distinct deliverables:

- **Narration script:** the full words intended to be spoken, or an explicitly designated full explanatory text track if the project is deliberately silent. It must convey the main argument rather than merely introduce graphics.
- **Captions:** readable transcription or intentional accessibility treatment of that narration; the technical skill owns synchronization.
- **On-screen text:** economical labels, figures, headings, and editorial cues that support the image. Do not confuse these with the narration script.

For a deliberately silent video, make the required explanation actually available to viewers through readable text and visual reasoning, with enough time to absorb it; summary slogans and scene headings alone cannot stand in for the full teaching content. A silent visual explanation need not mimic spoken prose when a demonstration communicates more clearly. If a commissioned video calls for speech but the current pipeline cannot produce audio, retain the complete narration in the composition’s authoritative content, flag the missing audio, and do not claim that an unvoiced script has been communicated to viewers.

Before approving the script, read it continuously rather than as separate scene cards: does each passage follow from an unresolved question or consequence, and does the explanation work without relying on scene titles or unseen animations? does it establish the key causal transitions? Then check the joint audio-visual sequence for what is best shown rather than said. Avoid padding speech with information that the visual already makes unambiguously clear.

## Effective-Content Review During Coding

The approved object is the explanation actually used by the composition, not a separate script document. Do not require an independently maintained `narration.md` or a duplicate transcript as the source of truth. If the project already uses an authoritative narration or scene-data module, inspect that module and its consumers. If text is embedded in components, trace the rendered data and relevant conditions so review covers what viewers will actually hear or read, in the order they encounter it. A temporary extraction for inspection is acceptable, but it is not a second editable source of truth.

Before the coding workflow finishes a substantive creative revision, review the effective narration as one continuous argument, in addition to scene-level text. Verify that essential concepts, explanations, evidence, and qualifications supplied in the creative direction survive adaptation; that the narration is natural and connected; and that any recurring example progresses coherently. Review what the actual captions and silent-video text communicate when no audio is present. If the audience only receives brief takeaways while the substantive narration remains unvoiced, treat that as an expressive delivery failure, even when the full script exists in code. Do not infer spoken narration from subtitles or claim that an unvoiced script is audible.

A failed creative review returns a specific expressive or fidelity defect to the coding agent: identify the affected passage or time range, what was lost or communicated poorly, and what the revision must preserve without prescribing code structure. Ask for the smallest meaningful repair and review its result; do not rewrite technical implementation or conduct a full technical QA pass. Do not approve on the basis of a script proposal if the content consumed by the composition has changed since review. Where practical, inspect the authoritative source after the final creative edit; this is a content-fidelity check, not a mandate for duplicate artifact synchronization or a separate agent.

Review the parts of the explanation affected by the revision, including passages that depend on changed reasoning or evidence.

## Counterfactual Creative Review

Before creative sign-off, assume the current cut is not yet teaching the intended idea and actively look for evidence that could overturn completion. Do not accept intention, a polished visual system, a successful compile, or a complete scene list as proof.

Run the smallest set of falsification tests that fits the cut, and name the actual scene, frame, line, or learner behavior involved:

- **Topic-noun swap:** if the nouns are replaced with another subject and the scene still works unchanged, the visual is probably decorative rather than subject-specific evidence.
- **State-removal test:** remove a scene or reset the recurring situation. If the viewer loses no causal understanding, that beat may be a glossary card or ornament.
- **Pause / fresh-case test:** at a paused frame, is the intended relationship legible, and can the viewer use the explanation on a new case rather than merely recognize the term?
- **Readability test:** can the longest on-screen passage be read and understood at playback speed without racing or relying on unseen narration?

One concrete counterexample is enough to withhold creative sign-off and return the smallest meaningful repair. Artistic value is present when rhythm, contrast, material, scale, or reveal makes the subject's specific transformation easier to perceive; it is not a substitute for the missing mechanism and not a reward for visual polish. After repair, rerun the failed test instead of replacing it with a more favorable checklist answer.

## Duration Derived From Teaching

Estimate duration from the explanatory track the composition will use, the time viewers need to interpret the visuals, and deliberate pauses. An outline can support an initial estimate. Revisit it against the authored content and check timing in playback. Account for text complexity, visual density, and viewer familiarity.

Use any requested runtime to guide scope and editing. If the cut runs long, consolidate repetition and cut optional material while preserving the essential reasoning and evidence. If those essentials still need more time, surface the trade-off in scope, presentation, or runtime to the content owner or user.

## Format Identity And Teaching Bridges

Reuse the project's visual system as infrastructure, not as a default story shape. Before production, find a visual grammar that belongs to this subject: its scale, material, place, system, conflict, or point of view. Let that choice determine the composition, pacing, spatial logic, and moments of interruption. Do not carry a familiar title-left, diagram-right, caption-bottom layout from one topic to the next merely because it is available.

For the pivotal teaching moments, consider genuinely different ways to carry the idea (for example an unfolding event, an object or spatial metaphor, a real artifact, or a diagram). Judge them by explanatory force, emotional effect, continuity, asset feasibility, and the opportunity for the viewer to infer the claim. Do this selectively, not as a mandatory multi-option worksheet for every scene. If the first convenient layout is best, use it deliberately.

Write a short format proposition before storyboarding: what should the viewer see, feel, or follow in order to understand this subject, and what familiar explanatory treatment would fail to do it justice? Use it to make an affirmative creative choice, not to justify novelty for its own sake.

For each important beat, name the visual evidence that is specific to the claim: an object, behavior, constraint, environment, trace, or transformation that lets the viewer infer the point. A generic comparison, process, or card layout is only useful when it is the clearest carrier of that evidence. If the topic nouns could be replaced with those of another video while the scene still works unchanged, revisit the scene's point of view, material, or action.

Do not equate a teaching point with a new slide or scene. When several terms describe parts of one event or mechanism, consider letting the same situation evolve so the learner sees their relationship, rather than restarting the visual language for each definition.

When a teaching claim crosses a meaningful conceptual distance, direct the bridge rather than presenting only its endpoints. Give the viewer enough of the condition, mechanism, result, and trade-off to follow the change. The bridge may be a sequence, a live transformation, a comparison, or a pause; choose the form that makes causality perceptible.

## Visual Variety And Scene Rhythm

Preserve visual continuity through meaningful relationships, not merely through persistent layouts or reusable scene shells.

As the explanation develops, reconsider whether the current visual representation still offers the clearest view of what the audience needs to observe. A representation that works for introducing a system may become insufficient for explaining an internal mechanism, a change of scale, or a consequence.

When that happens, change the viewer's perspective, focus, scale, or representation as needed. A transition from an overview to a detailed mechanism, and back to the system when useful, can preserve conceptual continuity without preserving the same composition.

Do not introduce visual variation merely to avoid repetition. A sustained view is valuable when it continues to reveal meaningful changes. Change the visual approach when the explanation demands it, not according to a predetermined rhythm.

Avoid repetitive scene construction. Do not let consecutive scenes fall into the same composition, motion pattern, or information shape unless repetition is intentionally used for comparison, continuity, or rhythm.

Prefer meaningful visual progression over decorative variation. When narration introduces a relationship, process, comparison, quantity, transformation, or consequence, look for a visual representation rather than defaulting to another text-first scene.

Reuse established visual primitives when they remain the clearest expression of the idea. Do not invent a new visual device merely to avoid repetition.

## Focus States And Scene Handoffs

When multiple layers share the screen, describe the intended focus, the context the viewer still needs, and how attention shifts. Specify deliberate overlap or suppression when it matters to that intent.

At significant handoffs, specify what should carry through and what the viewer should recognize first in the incoming scene. Preserve the relevant state of a recurring example across that handoff.

## Evidence And Data

Use data as evidence, never as a badge of research. Place a number only when it changes the viewer's confidence in a claim or makes a relationship observable. Introduce the claim or question first, then show the measure, its time and unit, and the inference the viewer should draw. Add a comparison only when it is necessary to make the number meaningful.

If you cannot say why a number is on screen in one clear sentence, remove it. A useful data treatment makes its evidentiary job legible: what it measures, what it proves here, and what it does not prove.

## Review And Delivery

Review the effective explanation, visual argument, and attention order against the approved learning direction. Return an expressive problem to the implementation workflow with the affected passage and the intended result. Return a gap in the learning direction to its content owner.

Use continuous playback at the intended speed for editorial timing and progression. Watch the entire cut when the decisions span the composition. For a local timing change, watch the affected passage and its handoffs. Sampled frames can support spatial review. The same playback can support creative and technical judgments. If playback needed for the review is unavailable, report the pacing review as incomplete.

During the review, ask whether the viewer can follow the essential reasoning in order, whether each change of focus supports that reasoning, and whether the text and visuals leave enough time for interpretation. Use the applicable tests in Counterfactual Creative Review. Route suspected rendering and layout defects to `remotion-studio-qa`.
