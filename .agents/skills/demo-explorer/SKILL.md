---
name: demo-explorer
description: Use when the user wants to quickly understand a tool, library, framework, platform, or technical stack by creating a small runnable demo that reveals its core value. Do not use for production implementation, ordinary bug fixes, migrations, or work where the user already specified a non-demo deliverable.
---

# Demo Explorer

Use this skill to turn early technical curiosity into a real, inspectable artifact. The point is not to build a production app; the point is to help the user learn what a tool is for, how it feels to use, and what its core abstractions do by making a small demo that actually runs.

## When To Use

Use this skill when the user asks to explore, understand, evaluate, try, learn, or get a feel for a technology through a demo project.

Good fits:

- "帮我快速了解 Remotion 是做什么的，做个 demo"
- "我想看看 Convex/LangChain/Tauri/Three.js 的核心价值"
- "用一个小项目让我理解这个工具能解决什么问题"

Avoid using this skill when the request is already a production feature, bug fix, refactor, migration, deployment, or repository-specific task that is not primarily about learning through a demo.

## Outcome

Deliver a minimal but complete demo project or demo slice that produces a real observable result:

- a running web page, app view, video, CLI output, generated file, API response, screenshot, or other tangible artifact;
- commands needed to install, run, preview, test, or render it;
- a concise explanation of what the demo proves about the technology.

The final explanation should answer:

- what the tool or stack is for;
- what its core abstraction or workflow feels like;
- what this demo shows well;
- where the demo is intentionally shallow;
- what the user should explore next if they want to go deeper.

## Working Style

Start by identifying the exploration target and the user's learning intent. If the intent is ambiguous but a safe assumption is possible, proceed with the smallest useful demo and state the assumption. Ask only when the missing choice would materially change the project shape, such as frontend vs backend, local-only vs cloud, or paid API vs no paid API.

Prefer this shape:

1. Inspect the current directory and git state before creating files.
2. Create the demo in an isolated directory unless the user explicitly wants the current project used.
3. Start from the official quickstart, template, or canonical example when available.
4. Add one small custom scenario that demonstrates the tool's distinctive value.
5. Run the minimum meaningful verification: install, build, typecheck, lint, test, render, preview, or a direct smoke command, depending on the stack.
6. Summarize the artifact and the learning takeaways.

Keep the demo small. Avoid adding auth, databases, deployments, CI, elaborate architecture, broad test suites, or polish that does not help the user understand the tool's core value.

## Workspace Boundaries

Protect the user's existing work:

- If the current directory is an existing repository, inspect `git status --short --branch` before editing.
- Do not mix an exploratory demo into a real codebase unless the user explicitly asks for that.
- Prefer a clearly named directory such as `demos/<tool-name>-demo` inside the workspace, or a temporary directory for disposable experiments.
- Do not revert, overwrite, or clean unrelated files.

## Authorization Boundaries

This skill does not grant permission for external side effects. Follow normal user authorization requirements for:

- installing dependencies when network access or package downloads are required;
- using paid APIs, cloud resources, external accounts, or hosted services;
- creating GitHub repositories or other remote resources;
- committing, pushing, publishing, deploying, or sharing artifacts publicly.

When an external service is central to the tool, first try to create a local or mocked demo that teaches the same core idea. If that would misrepresent the tool, explain the limitation and ask before using the external service.

## Handling Friction

Expect starter projects and docs to drift. If a template fails because of version skew, package availability, runtime compatibility, or platform differences, diagnose narrowly and choose the smallest fix that gets the demo running. Record the issue in the final summary so the user learns something real about the stack.

If the full demo cannot be completed quickly, preserve a useful partial result: a runnable scaffold, a focused reproduction, a documented blocker, or a smaller artifact that still teaches the central concept.
