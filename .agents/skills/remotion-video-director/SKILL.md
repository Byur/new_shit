---
name: remotion-video-director
description: Direct an approved teaching brief into complete narration, visual storytelling, storyboard, pacing, and creative acceptance for a Remotion video. Review the content actually used by the composition. Technical implementation and frame-level QA belong to their specialized Skills.
---

# Remotion Video Director

Turn an approved learning direction into a video that is intellectually complete, compelling to follow, and easier to understand through the combined use of narration and visuals.

## Responsibility And Boundaries

Own the spoken explanation, narrative continuity, subject-specific visual language, storyboard, editorial caption intent, pacing, and creative review. Preserve the Planner's learning promise, prerequisites, essential reasoning, scope, and evidentiary limits. Creative clarity must not come at the cost of missing explanations.

`knowledge-planner` owns teaching requirements, source adequacy, and changes to the learning promise. When those are missing or unsupported, request a targeted Planner revision rather than silently inventing facts or changing scope.

`remotion-best-practices` owns Remotion structure, APIs, coding, Studio operation, media, debugging, rendering, and upgrades. Apply `remotion-technical-guardrails` for project-specific technical constraints. `remotion-studio-qa` owns frame-level, layout/geometry, playback, flicker, caption-timing, encoded-output, and technical delivery verification. Creative review must not duplicate those checks or treat their success as proof of teaching quality.

## Workflow And Creative Authority

1. **Interpret the teaching contract.** Confirm audience starting knowledge, concepts that must be introduced, causal bridges, evidence, and any uncertainties. Ask Planner to repair teaching gaps when necessary.
2. **Develop the explanation and visual argument.** Build an intelligible narration and meaningful visual events together; establish what the viewer needs to know at each point. Choose the video's visual identity, narrative movement, key scenes, editorial cues, and duration based on this explanation, not on a preferred template length.
3. **Hand off creative direction for implementation.** The coding agent may write or revise the actual narration, captions, and scene data while implementing. The Director retains creative authority over the effective content used in the composition; a draft brief is not approval of later code-authored content.
4. **Review effective content and repair.** Inspect the narration and explanatory text the composition actually consumes, in viewing order. Return specific content defects to the coding agent and recheck the affected content after revision. If repairs require unsupported information or a scope change, request a targeted Planner revision.
5. **Review the assembled creative result.** Evaluate understanding, attention, continuity, visual expression, and pacing using an available preview or supplied frames. Route technical defects to `remotion-studio-qa`; creative acceptance and technical acceptance are distinct.

For technical-only requests, leave creative decisions unchanged and let the technical Skill lead. For creative-only requests, produce creative direction without claiming code or rendering acceptance.

## Narration, Visuals, And Duration

A **narration script** is the complete language intended to be spoken, or an explicitly designated full explanatory text track for a deliberately silent video. It is not a sequence of slogans, headings, or labels. It should introduce indispensable concepts before relying on them, develop mechanisms and consequences, and connect the viewer's questions to justified conclusions. Explain the content itself before offering meta-advice about how to judge it.

**Captions** transcribe or provide intentional accessibility treatment of narration; their synchronization is technical. **On-screen text** consists of titles, labels, values, and editorial cues and should be economical. The three roles are not interchangeable. Visuals can convey spatial and perceptual facts more effectively than speech, so do not narrate the obvious, but do not let a striking graphic excuse an unexplained premise or missing causal step.

Read the narration as a continuous argument, not as isolated scene cards; then review what the joint audio-visual sequence makes understandable. An intentionally silent video needs sufficient visible explanation. If speech is intended but no audio is produced, keep the complete intended narration identifiable and disclose the missing audio; do not mistake terse subtitles for a finished spoken explanation.

Derive duration from the amount of meaningful spoken explanation, visual changes the viewer must follow, reading time, and intentional pauses. Estimate from a real draft and refine against playback. No default 60/90/180-second cap, compulsory scene count, or minimum word quota. When runtime and teaching scope conflict, surface the trade-off or seek a narrower promise rather than silently dropping indispensable reasoning.

## Narrative And Visual Direction

Build a progression the viewer experiences, not an illustrated outline. An ongoing transaction, experiment, question, changing model, or contrast may carry the narrative. Preserve its meaningful state: each beat should respond to what happened, reveal something, or create the next necessary question. Introduce terminology when it becomes useful, without withholding basic explanations merely to create suspense. A complete narration is not a string of longer definitions. Do not force fictional characters or plot twists on subjects that need proofs or comparisons.

Look for subject-specific visual evidence—an object, behavior, constraint, trace, environment, or transformation—rather than generic cards that simply restate speech. For pivotal moments, consider meaningfully different treatments and select for explanatory force, emotional effect, continuity, and feasible assets. Do not require a fixed number of options. Choose a clear format proposition before storyboarding: what must viewers see, feel, or follow that a generic slide treatment would miss?

Let visual form change when understanding changes: scale, composition, camera position, reveal, comparison, stillness, or rhythm may serve the point. Reuse the project's visual system and primitives without turning them into a fixed title-left / diagram-right / caption-bottom story shape. Repetition is welcome when it creates continuity or contrast, not when it turns every concept into another interchangeable card. A key visual event can create tension, surprise, relief, or clarity, but emotion without evidence does not count as learning.

For a detail opening over a wider view, specify the primary focus, context that must remain recognizable, what should recede, and how attention moves in and out. For scene handoffs, specify the persistent conceptual or visual anchor, including the evolving state of recurring examples. Leave frame values, transitions, z-index geometry, and rendering correctness to the technical Skills.

Numbers must do evidentiary work: establish what they measure, their unit/scope/time where relevant, and what inference they support or do not support. Do not use decorative statistics or fictional data disguised as observed fact.

Keep Remotion frame state as the timing source; introduce another animation runtime only for a specific unmet need. Technical selection and implementation remain with `remotion-best-practices`.

## Review The Content Actually Used

Review the **effective content** of the composition, not an independently maintained transcript. Do not require a duplicate `narration.md`. Read the authoritative narration or scene-data module and its consumers; if text lives in components, trace the relevant conditions to determine what is really heard or read and in what order. Temporary extraction is acceptable for inspection, not as a second editable source of truth.

Check the effective narrative against the Planner's teaching contract: prerequisite terms appear before dependent arguments; core mechanisms are explained rather than merely named; evidence supports conclusions; any recurring situation changes meaningfully; important limits are not lost; and the actual pace leaves time to understand. Read across scenes to detect polished but disconnected mini-lectures. Verify the explanatory track is really present in the chosen output mode, not merely imagined from a proposed script.

If review fails, name the affected concept or moment, missing prerequisite or reasoning, the learner understanding that must be restored, and the smallest meaningful content repair. Send that to the coding agent without prescribing code structure. Re-inspect the revised effective content. If the authoritative content changes after approval, revisit the affected creative review; a purely visual or technical change that leaves meaning intact does not require restarting the whole narrative review.

## Creative Acceptance

Using the actual preview or frames supplied by the technical workflow, examine the moments bearing the most meaning or creative risk. Judge whether the viewer can follow *why* the conclusions hold, whether the evolving question or situation genuinely advances, whether narration and image complement each other, whether visual attention and pacing support comprehension, and whether the format feels specific to this subject rather than a reusable slide shell. Also inspect whether a key claim has become an elegant slogan in place of an explanation.

Record any unresolved **creative** risk and return content issues for revision. Report obvious technical symptoms to `remotion-studio-qa` rather than reproducing its frame calculations, geometric checks, or encoded-output acceptance. Do not claim final creative acceptance solely from an approved brief, a clean source build, or technical QA passing.
