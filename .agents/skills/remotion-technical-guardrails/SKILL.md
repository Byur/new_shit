---
name: remotion-technical-guardrails
description: Supplement official Remotion skills with project-specific scene-continuity, research-context, and headless-rendering guardrails. Use alongside remotion-best-practices when implementing or rendering a multi-scene Remotion video; do not use for creative direction or as an API reference.
---

# Remotion Technical Guardrails

Apply these project rules after the creative brief and alongside the official `remotion-best-practices` implementation workflow. Do not replace, fork, or rewrite the official Remotion Skills; they remain the source for APIs, markup, media, Studio, debugging, and render commands.

## Scene-Boundary Continuity

Do not combine a hard scene cut with an unintended incoming state in which every primary subject disappears and the result reads as a blank or flash. The incoming scene does not need to be fully readable on its first frame: a brief low-contrast or partially assembled state is acceptable when it is an intentional entrance, retains visual continuity, and resolves promptly into a clear subject.

Choose the smallest implementation that preserves continuity:

- keep a shared shell, background, or overview outside the scene sequences and transition only the focus layer;
- overlap or crossfade adjacent scenes when both need to be present during the handoff;
- use `TransitionSeries` when a real transition is intended; or
- keep a hard cut with a visible anchor or clearly directed entrance, then let the primary subject become readable over the short opening beat.

Separate scene presence from internal progress. An entrance animation may assemble the primary subject and supporting details, but it must not create an unintended black frame, flash, or moment where all visual anchors disappear. Preserve the intended focus and continuity through the transition into its settled state.

At handoff, convey the intended states for boundaries where QA needs them to judge the result. Follow `remotion-studio-qa` for review scope and frame probes.

## Headless Rendering

Render, still, frame-export, and other non-interactive output steps must use headless browser mode by default. Do not pass `--disable-headless`, open a visible browser window for rendering, or switch to a non-headless fallback unless the user explicitly requests non-headless rendering.

If headless rendering fails, diagnose the failure and try a headless-compatible browser executable or configuration when appropriate. An old operating system, a missing downloaded browser, a timeout, or a previous local workaround is not permission to switch to non-headless mode. If no headless path succeeds, report the blocker and stop before claiming that the deliverable was rendered.

Interactive Remotion Studio preview is not a render step and may remain visible when preview or user steering is needed.

## Research Context And Token Use

Use the approved learning direction and creative brief during implementation. When a factual or asset question arises, consult the relevant prior evidence or source excerpt before starting another search or rereading a full research archive. Return an unsupported essential claim to `knowledge-planner`, or a material change to visual intent to `remotion-video-director`, as a specific question.

When the runtime provides token usage data, inspect input and tool-result volume by phase and look for repeated large source reads. If repeated retrievals or rising context use do not resolve an essential question or implementation decision, stop exploratory searches and broad rereads. Continue targeted checks needed for accuracy or selected assets, and surface any remaining uncertainty. Do not impose a fixed token ceiling or shorten indispensable explanation to reduce usage. Without usage data, do not attribute high consumption to a particular step.

## Handoff

Use `remotion-studio-qa` after implementation for technical verification of the requested deliverable.
