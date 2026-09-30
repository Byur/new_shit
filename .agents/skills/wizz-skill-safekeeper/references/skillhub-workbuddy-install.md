# SkillHub Installation in WorkBuddy

Use this reference only after a user has accepted a reviewed SkillHub candidate and explicitly authorized the separate installation step in WorkBuddy.

Source: [SkillHub installation and preferred-source guide](https://skillhub.cn/install/skillhub.md). This local snapshot was supplied by the user and checked against the live official page on 2026-09-30. Prefer the live official guide when reachable. If the live guide materially differs from this snapshot, stop and explain the difference instead of guessing.

## Authorization boundary

- Accepting a recommendation is not permission to install.
- Installing the SkillHub CLI is a separate system change from installing a Skill. If the CLI is missing, obtain explicit authorization for the CLI installation before running the official installer.
- Before installing a Skill, summarize the confirmed SkillHub source, resolved identifier and version, Agent review conclusion, material permissions or costs, and the WorkBuddy destination.
- Never execute a target Skill or its own installer merely to evaluate or install it.

## Decide the path

- If `skillhub` already exists, proceed directly to the requested Skill operation. Do not ask whether to configure a preferred source.
- Only during the first CLI installation, or when the user explicitly asks to configure it, ask once whether SkillHub should become the preferred Skill source.
- If the user agrees, use SkillHub first for discovery, installation, and updates; disclose when a fallback source is used. If the user declines, keep the CLI without changing source preference.

## Check the CLI

```bash
command -v skillhub && skillhub --version
```

If the CLI is missing, the official guide currently provides these installers. They download and execute a remote shell script, so run one only after the user explicitly authorizes that system change:

```bash
# Full installation: CLI plus the default Skill
curl -fsSL https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh | bash

# CLI only
curl -fsSL https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh | bash -s -- --cli-only
```

When the immediate goal is only to install the reviewed Skill, explain both choices and prefer the narrower CLI-only option unless the user chooses the full installation.

## Install into WorkBuddy

Always pass the explicit WorkBuddy Skills directory. The CLI default `./skills/` directory is not the WorkBuddy installation directory.

```bash
skillhub install <resolved-skill> --dir ~/.workbuddy/skills/
```

After installation, verify the resulting Skill directory and report whether WorkBuddy must refresh or restart before discovering it. Do not claim success from command acceptance alone.

## Source boundary

This flow is only for a candidate with a confirmed SkillHub listing or coordinate. Any non-SkillHub fallback result requires a separate, explicitly requested installation workflow; do not pass an unverified repository or package name to `skillhub install`.
