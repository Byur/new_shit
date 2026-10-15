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

When this Skill and `remotion-best-practices` both apply, treat them as consecutive roles rather than competing owners:

1. Confirm the approved learning direction; use `knowledge-planner` first if the topic, audience, evidence, or teaching scope is unresolved.
2. Identify the supplied learning direction and its essential explanations. Develop the substantive narration and subject-specific visual argument together, with the actual explanatory passages drafted before treating any runtime or scene-duration estimate as settled. A concept outline, scene list, or visual dwell-time estimate is not a substitute for narration. Then determine the format proposition, storyboard, pacing, caption intent, and creative acceptance criteria before technical implementation choices are finalized.
3. Hand the approved creative direction to the coding workflow. The coding agent may author or revise the actual narration and captions while implementing, but the director retains creative authority over what is actually used in the composition. Apply `remotion-technical-guardrails` alongside `remotion-best-practices` for implementation; neither technical skill replaces creative review.
4. Before treating creative implementation as accepted, inspect the effective narration and text that the composition actually consumes for fidelity to the supplied content and for spoken clarity, narrative flow, and visual coordination. Return focused expressive or fidelity changes to the coding agent when needed and re-inspect the result. Do not independently redefine content depth, facts, or teaching scope.
5. Review the assembled preview for meaning, attention order, visual identity, and pacing. Let `remotion-studio-qa` own systematic playback stability, encoded-output review, and frame-level defect verification. Passing technical QA never substitutes for creative approval.

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

Maintain a continuous spoken argument as well as a continuous visual thread. Narration should connect consequences, decisions, discoveries, and qualifications across scene boundaries; avoid writing isolated mini-lectures with interchangeable scene introductions. A complete narration script is not a series of longer definitions. If the material becomes more thorough but loses its sense of progression, revise the structure rather than simply shortening the speech.

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

Keep gates proportional: a narrow visual-only code change need not reopen the entire narrative; changes to narration, timing that removes explanation, scene order, or core teaching visuals do. If the user explicitly asks for a draft only, provide the creative work without claiming implementation acceptance.

## Counterfactual Creative Review

Before creative sign-off, assume the current cut is not yet teaching the intended idea and actively look for evidence that could overturn completion. Do not accept intention, a polished visual system, a successful compile, or a complete scene list as proof. Use the earlier market-slang cut as negative evidence: its visual completion was judged 7.5/10 while depth, continuity, and reading pace were judged 4/10, 4/10, and 3/10 because attractive cards did not create enough causal progression or reading room.

Run the smallest set of falsification tests that fits the cut, and name the actual scene, frame, line, or learner behavior involved:

- **Topic-noun swap:** if the nouns are replaced with another subject and the scene still works unchanged, the visual is probably decorative rather than subject-specific evidence.
- **State-removal test:** remove a scene or reset the recurring situation. If the viewer loses no causal understanding, that beat may be a glossary card or ornament.
- **Pause / fresh-case test:** at a paused frame, is the intended relationship legible, and can the viewer use the explanation on a new case rather than merely recognize the term?
- **Readability test:** can the longest on-screen passage be read and understood at playback speed without racing or relying on unseen narration?

One concrete counterexample is enough to withhold creative sign-off and return the smallest meaningful repair. Artistic value is present when rhythm, contrast, material, scale, or reveal makes the subject's specific transformation easier to perceive; it is not a substitute for the missing mechanism and not a reward for visual polish. After repair, rerun the failed test instead of replacing it with a more favorable checklist answer.

## Duration Derived From Teaching

Do not begin with a preferred 60-, 90-, or 180-second format unless the user explicitly requests one. A total runtime inferred from teaching headings, perceived difficulty, scene count, or anticipated animation holds is provisional only. First establish the actual words to be delivered (or the full on-screen explanation in an intentionally silent format), while iterating with the visual demonstrations. Judge duration against what the viewer must actually process, not merely against text volume or animation hold time. Review narration, visible explanatory text, visual evidence, and scene timing as one experience: can the viewer follow the intended explanation while attending to the relevant visual changes? Only then estimate spoken or reading time and add the time needed for interpretation and intentional pauses. Scene count and template length are consequences, not budgets to fill.

If the coding agent authors the actual narration during implementation, do not freeze scene durations from an earlier outline: estimate against the content the composition really consumes and revise the timeline to accommodate it. Check the estimate against assembled playback; adjust the audiovisual presentation and timing for pacing and comprehension rather than automatically trimming explanatory passages to preserve the current length. A longer script does not automatically justify a longer video, and a longer video does not automatically provide sufficient explanation. If essential information competes for attention or passes before it can be understood, surface the trade-off to the content owner or user: revise the presentation, narrow the promise, or extend the runtime rather than silently dropping indispensable reasoning. Do not apply a fixed reading-speed limit; account for text complexity, visual density, and viewer familiarity. For a silent video, judge explanation only through what the audience can actually see and read; do not assume missing or inaudible narration supplies understanding.

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

When an overview remains visible while a detail opens, define a focus contract in the storyboard:

- Name the primary subject, the context that must remain recognizable, and the elements that must be visually suppressed.
- Keep the overview as context rather than a competing foreground. Choose an appropriate treatment such as a mask, dimming, blur, crop, scale change, or camera shift; do not leave every label, connector, node, and detail panel at equal emphasis.
- Give the focused detail its own readable territory. Do not place independent cards or panels over active overview labels, connectors, or nodes unless the overlap itself carries meaning.
- State how attention enters and leaves the focus state so the implementation can preserve continuity.

For every scene boundary, specify the persistent visual anchor or the first readable state of the incoming scene. When a recurring situation is the teaching thread, carry its actual state into the next scene instead of starting another generic example. A hard cut must not intentionally create a moment where all primary information disappears and then fades back in. Leave frame calculations and transition APIs to the technical Skills, but make the intended continuity explicit in the creative brief.

## Evidence And Data

Use data as evidence, never as a badge of research. Place a number only when it changes the viewer's confidence in a claim or makes a relationship observable. Introduce the claim or question first, then show the measure, its time and unit, and the inference the viewer should draw. Add a comparison only when it is necessary to make the number meaningful.

If you cannot say why a number is on screen in one clear sentence, remove it. A useful data treatment makes its evidentiary job legible: what it measures, what it proves here, and what it does not prove.

## Review And Delivery

Creative sign-off covers the effective content used by the composition: fidelity to the supplied meaning and reasoning, narrative continuity, spoken expression, visual clarity, and runtime adequacy. If implementation drops an essential prerequisite, cause, consequence, or qualification from the supplied direction, restore it. If the direction itself lacks the needed content, flag the gap to its content owner rather than independently defining or approving a deeper lesson.

Source review alone is not enough for creative sign-off. Using the preview or sampled frames supplied by the technical workflow, intentionally inspect the scenes and moments carrying the most meaning or creative risk, including fully assembled states and transitions where relevant. Apply judgment rather than a mechanical quota:

- Is the intended attention order immediately clear?
- Where the creative direction calls for progression, does each major scene grow from the previous event, inference, or unanswered question?
- Does each major scene change what the viewer understands, anticipates, notices, or feels, rather than merely carrying the same object or chart forward?
- If a recurring transaction, experiment, or situation was promised, does its state actually progress on screen and in narration?
- Has stronger narration turned the video into disconnected illustrated lectures rather than one developing explanation?
- Does the video faithfully communicate the supplied explanation, rather than replacing it with a polished definition?
- Did any essential causal step disappear between the planning brief, full narration, and final visual sequence?
- Does the actual authored content preserve the supplied prerequisite order, rather than depending on an unexplained term?
- Has the director inspected the narration/text actually consumed by the composition after substantive coding changes, rather than only an upstream proposal?
- Is there a complete narration script (or an explicitly sufficient silent-video explanation), clearly distinguished from captions and labels?
- Can the viewer follow each important mechanism at the actual playback pace, or did the edit squeeze it into the available seconds?
- Do narration, visible explanation, visual evidence, and scene timing compete for attention in a way that prevents understanding, including in a silent version?
- Does the composition remain legible, balanced, and uncluttered?
- Does the visual progression feel varied and purposeful, or has the video fallen into repetitive layouts and motion patterns?
- When the visual approach changes, does the shift respond to a new mechanism, scale, consequence, or observational need rather than merely to variety? When it stays stable, does it continue to reveal meaningful change?
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
