#!/usr/bin/env python3
"""Read-only static auditor and local report generator for Codex Skills."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse


VERSION = "0.9.0"
SELF_SKILL_ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {
    ".md", ".txt", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".json", ".yaml", ".yml", ".toml", ".sh", ".zsh", ".bash", ".ps1",
    ".rb", ".go", ".rs", ".java", ".kt", ".html", ".css",
}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}
SEVERITY_RANK = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
CONFIDENCE_RANK = {"heuristic": 0, "probable": 1, "confirmed": 2}
COMMON_TOKENS = {
    "skill", "skills", "use", "using", "with", "from", "when", "this", "that",
    "用户", "使用", "进行", "支持", "用于", "需要", "内容", "分析", "生成", "处理",
}


@dataclass
class Finding:
    skillId: str
    tag: str
    severity: str
    confidence: str
    evidenceType: str
    source: str
    line: int
    excerpt: str
    title: str
    plainExplanation: str
    technicalExplanation: str
    trigger: str = "When the matching instruction or code path is used"
    affectedData: list[str] = field(default_factory=list)
    destination: str | None = None
    linguisticFeatures: list[str] = field(default_factory=list)
    claimedPriority: str | None = None
    actualPriority: str | None = None
    recommendation: str = "keep-with-notice"
    id: str = ""

    def finalize(self) -> "Finding":
        material = "|".join(
            [self.skillId, self.tag, self.source, str(self.line), self.excerpt[:160]]
        )
        self.id = "finding-" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:12]
        return self


@dataclass
class FileRecord:
    path: str
    size: int
    sha256: str
    text: str | None
    truncated: bool = False


def stable_id(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def clean_scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def split_frontmatter(text: str) -> tuple[dict[str, object], str, int]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text, 1
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return {}, text, 1

    raw = lines[1:end]
    flat: dict[str, object] = {}
    stack: list[tuple[int, str]] = []
    i = 0
    while i < len(raw):
        line = raw[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        match = re.match(r"^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not match:
            i += 1
            continue
        indent = len(match.group(1).replace("\t", "  "))
        key, value = match.group(2), match.group(3).strip()
        while stack and stack[-1][0] >= indent:
            stack.pop()
        path = ".".join([item[1] for item in stack] + [key])
        if value in {"|", ">", "|-", ">-", "|+", ">+"}:
            chunks: list[str] = []
            i += 1
            while i < len(raw):
                child = raw[i]
                child_indent = len(child) - len(child.lstrip())
                if child.strip() and child_indent <= indent:
                    i -= 1
                    break
                chunks.append(child.strip())
                i += 1
            flat[path] = ("\n" if value.startswith("|") else " ").join(chunks).strip()
        elif value == "":
            stack.append((indent, key))
        else:
            scalar = clean_scalar(value)
            inline = re.fullmatch(r"\{(.*)\}", scalar)
            if inline:
                for item in inline.group(1).split(","):
                    child = re.match(r"\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$", item)
                    if not child:
                        continue
                    child_value: object = clean_scalar(child.group(2))
                    if str(child_value).lower() in {"true", "false"}:
                        child_value = str(child_value).lower() == "true"
                    flat[f"{path}.{child.group(1)}"] = child_value
                i += 1
                continue
            if scalar.lower() in {"true", "false"}:
                flat[path] = scalar.lower() == "true"
            else:
                flat[path] = scalar
        i += 1
    return flat, "\n".join(lines[end + 1 :]), end + 2


def discover_skills(scopes: Iterable[Path]) -> list[Path]:
    found: dict[str, Path] = {}

    def remember(root: Path) -> None:
        resolved = root.resolve()
        if resolved != SELF_SKILL_ROOT:
            found[str(resolved)] = resolved

    for raw_scope in scopes:
        scope = raw_scope.expanduser().resolve()
        if scope.is_file() and scope.name == "SKILL.md":
            remember(scope.parent)
            continue
        if scope.is_dir() and (scope / "SKILL.md").is_file():
            remember(scope)
            continue
        if not scope.exists():
            raise FileNotFoundError(f"Scope does not exist: {scope}")
        for current, dirs, files in os.walk(scope, followlinks=False):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not Path(current, d).is_symlink()]
            if "SKILL.md" in files:
                root = Path(current).resolve()
                remember(root)
                dirs[:] = []
    return sorted(found.values(), key=lambda path: str(path).lower())


def list_files(root: Path, max_file_bytes: int) -> list[FileRecord]:
    records: list[FileRecord] = []
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not Path(current, d).is_symlink()]
        for name in sorted(files):
            path = Path(current, name)
            if path.is_symlink() or not path.is_file():
                continue
            try:
                size = path.stat().st_size
                digest = hashlib.sha256()
                with path.open("rb") as handle:
                    while chunk := handle.read(1024 * 1024):
                        digest.update(chunk)
                text: str | None = None
                truncated = False
                if path.suffix.lower() in TEXT_SUFFIXES or path.name in {"SKILL.md", "README"}:
                    with path.open("rb") as handle:
                        raw = handle.read(max_file_bytes + 1)
                    truncated = len(raw) > max_file_bytes
                    raw = raw[:max_file_bytes]
                    if b"\x00" not in raw:
                        text = raw.decode("utf-8", errors="replace")
                records.append(
                    FileRecord(
                        path=str(path.relative_to(root)),
                        size=size,
                        sha256=digest.hexdigest(),
                        text=text,
                        truncated=truncated,
                    )
                )
            except OSError:
                continue
    return records


def make_finding(
    skill_id: str,
    tag: str,
    severity: str,
    confidence: str,
    evidence_type: str,
    source: str,
    line: int,
    excerpt: str,
    title: str,
    plain: str,
    technical: str,
    **kwargs: object,
) -> Finding:
    return Finding(
        skillId=skill_id,
        tag=tag,
        severity=severity,
        confidence=confidence,
        evidenceType=evidence_type,
        source=source,
        line=line,
        excerpt=excerpt.strip()[:500],
        title=title,
        plainExplanation=plain,
        technicalExplanation=technical,
        **kwargs,
    ).finalize()


PROMPT_RULES = [
    {
        "tag": "priority-escalation",
        "pattern": r"(?im)(?:ignore|disregard|override).{0,40}(?:previous|system|user|instruction)|(?:请|必须|务必)?\s*忽略.{0,20}(?:之前|系统|用户|指令)|(?:本技能|本指令).{0,20}优先于.{0,20}(?:用户|系统|其他)|最高优先级",
        "severity": "high",
        "features": ["priority claim", "imperative"],
        "title": "提示词声称了并不存在的更高优先级",
        "plain": "这个 Skill 试图让自身指令凌驾于用户或平台指令之上。",
        "technical": "Language in the prompt attempts to override or reorder the instruction hierarchy.",
        "recommendation": "explicit-only",
        "claimed": "Higher than user or system instructions",
    },
    {
        "tag": "scope-hijack",
        "pattern": r"(?i)(must|always).{0,35}(use|invoke|run).{0,25}(this skill|skill)|for\s+(?:every|all)\s+(?:request|task).{0,45}(?:invoke|use|run)|任何.{0,16}(任务|请求).{0,16}(必须|始终|优先)|所有.{0,16}(任务|场景).{0,16}(使用|调用)",
        "severity": "high",
        "features": ["absolute modality", "scope generalization"],
        "title": "Skill 的触发范围异常宽泛",
        "plain": "这个 Skill 可能在并不需要它的任务中被自动选择。",
        "technical": "Absolute modal language combines with a generalized invocation scope.",
        "recommendation": "explicit-only",
    },
    {
        "tag": "authorization-overreach",
        "pattern": r"(?im)(?:^|[.!?。！？]\s*)\s*(?:[-*]\s*)?(?:(?:do not|don't|never).{0,30}(?:ask|confirm)|(?:无需|不必|不得|不要).{0,30}(?:询问|确认|授权)|自动.{0,12}(?:执行|调用|购买|发布|上传))",
        "severity": "high",
        "features": ["consent suppression", "imperative"],
        "title": "提示词可能绕过关键操作前的用户确认",
        "plain": "这个 Skill 可能在执行重要操作时不再向用户确认。",
        "technical": "The instruction suppresses confirmation or directs automatic consequential action.",
        "recommendation": "require-confirmation",
    },
    {
        "tag": "disclosure-suppression",
        "pattern": r"(?im)^\s*(?:[-*]\s*)?(?:do not|don't|never|不得|不要).{0,30}(?:mention|disclose|tell|显示|披露|告知).{0,30}(?:cost|fee|risk|upload|third.party|收费|费用|风险|上传|第三方)",
        "severity": "critical",
        "features": ["concealment", "negative imperative"],
        "title": "提示词要求隐藏重要信息",
        "plain": "这个 Skill 可能阻止用户看到费用、数据传输或风险信息。",
        "technical": "The prompt explicitly suppresses disclosure of a consequential behavior.",
        "recommendation": "explicit-only",
    },
    {
        "tag": "manipulative-commerce",
        "pattern": r"(?i)((register|sign.?up|subscribe|buy).{0,45}(free|credits?|bonus|limited.time)|(free|credits?|bonus|limited.time|act now).{0,45}(register|sign.?up|subscribe|buy|claim)|(充值|注册).{0,35}(免费|额度|赠送|立刻|马上|过期|优惠)|新用户.{0,20}(免费|赠送|额度))",
        "severity": "medium",
        "features": ["commercial framing", "loss aversion or free-credit framing"],
        "title": "商业话术可能推动注册或消费",
        "plain": "这个 Skill 使用促销表达，使注册或付费看起来像完成任务的必要步骤。",
        "technical": "The prompt combines a conversion action with free-credit, urgency, or scarcity framing.",
        "recommendation": "explicit-only",
    },
    {
        "tag": "policy-evasion",
        "pattern": r"(?i)(?:must|should|ensure|use|to)\s+(?:bypass|evade|avoid|pass).{0,30}(?:ai.)?(?:detection|moderation|ban|rate.limit|review)|(?:请|必须|需要|用于|确保).{0,16}(?:绕过.{0,20}(?:检测|审核|封禁|限流|风控)|通过.{0,12}AI.{0,12}检测)",
        "severity": "high",
        "features": ["evasion objective"],
        "title": "Skill 鼓励绕过平台控制或检测",
        "plain": "这个 Skill 可能帮助隐藏本应被平台安全或审核系统发现的行为。",
        "technical": "The instruction expresses an explicit evasion objective.",
        "recommendation": "explicit-only",
    },
    {
        "tag": "authority-imitation",
        "pattern": r"(?i)(?:this skill|this tool|this|it|本技能|本工具).{0,12}(?:is\s+)?(?!not\s+|unofficial)(?:official|system-owned|platform required|官方指定|系统级|平台强制|官方认证)|officially\s+(?:certified|designated)|官方(?:指定|认证|强制).{0,20}(?:skill|能力|工具|接口)",
        "severity": "medium",
        "features": ["authority cue"],
        "title": "Skill 可能暗示未经证实的官方身份",
        "plain": "检查范围内没有证据支持它所暗示的官方或强制身份。",
        "technical": "Authority-signaling language is used without a verifiable provenance field.",
        "recommendation": "keep-with-notice",
    },
]


CODE_RULES = [
    {
        "tag": "credential-access",
        "pattern": r"""(?i)(os\.(getenv|environ)|process\.env|get-environmentvariable).{0,80}(api[_-]?key|token|secret|password|cookie)|(?:\.zshrc|\.bashrc|\.profile|\.ssh|credentials|keychain)""",
        "severity": "high",
        "title": "Skill 可以访问凭据或可能包含凭据的文件",
        "plain": "这个 Skill 可能读取密钥、令牌或含有敏感信息的配置文件。",
        "technical": "Credential environment variables or common credential-bearing paths are referenced.",
        "recommendation": "restrict",
        "affected": ["credentials"],
    },
    {
        "tag": "broad-file-access",
        "pattern": r"""(?i)(Path\.home\(|expanduser\(["']~|os\.walk\([^\n]*(home|expanduser)|glob\([^\n]*\*\*)""",
        "severity": "medium",
        "title": "Skill 可以读取较大范围的本地文件",
        "plain": "这个 Skill 可能读取超出当前任务必要范围的本地内容。",
        "technical": "Home-directory or recursive filesystem traversal is present.",
        "recommendation": "restrict",
        "affected": ["local files"],
    },
    {
        "tag": "destructive-action",
        "pattern": r"""(?i)(rm\s+-rf|shutil\.rmtree|os\.(remove|unlink)|Path\([^\n]+\)\.unlink|git\s+reset\s+--hard|drop\s+table|delete\s+from)""",
        "severity": "critical",
        "title": "Skill 包含可能造成破坏的操作",
        "plain": "这个 Skill 可能删除或不可逆地覆盖本地或远程数据。",
        "technical": "A destructive filesystem, repository, or data command is present.",
        "recommendation": "require-confirmation",
        "affected": ["files or data"],
    },
    {
        "tag": "arbitrary-code-execution",
        "pattern": r"""(?i)(\beval\s*\(|\bexec\s*\(|shell\s*=\s*True|subprocess\.(run|call|Popen)\s*\(\s*(?!\[|\()|child_process\.exec\s*\(|child_process\.spawn\s*\(\s*[^\[\"']|curl[^\n|]*\|\s*(bash|sh))""",
        "severity": "high",
        "confidence": "probable",
        "title": "发现需要核验的动态执行汇点",
        "plain": "这个 Skill 含有动态代码或命令执行能力，但尚未证明外部输入可以控制执行内容。",
        "technical": "An execution primitive is present; input control, reachability, and effective constraints require Agent review.",
        "recommendation": "restrict",
        "affected": ["local system"],
    },
    {
        "tag": "unsafe-url-fetch",
        "pattern": r"""(?i)(requests\.(?:request|get|post|put|patch|delete)|urllib\.request\.urlopen|httpx\.(?:request|get|post|put|patch|delete)|axios\.(?:request|get|post|put|patch|delete)|fetch)\s*\(\s*(?:[\"'][A-Z]+[\"']\s*,\s*)?(url|uri|link|target)|page\.goto\(\s*(url|uri|link)""",
        "severity": "high",
        "title": "用户提供的 URL 可能在没有白名单时被访问",
        "plain": "输入的链接可能被用于访问本机、内网或其他不应访问的地址。",
        "technical": "A URL-like variable flows directly into a network or browser fetch call.",
        "recommendation": "restrict",
        "affected": ["network resources"],
    },
    {
        "tag": "obfuscated-behavior",
        "pattern": r"""(?is)((base64\.(b64decode|decodebytes)|atob\().{0,180}(eval|exec|subprocess|Function\()|(eval|exec|Function\().{0,100}(base64\.(b64decode|decodebytes)|atob\())""",
        "severity": "critical",
        "title": "经过编码或隐藏的内容可能被执行",
        "plain": "重要行为可能先被隐藏或解码，然后在本机执行。",
        "technical": "Decoded content is combined with an execution primitive.",
        "recommendation": "restrict",
        "affected": ["local system"],
    },
]


NETWORK_RE = re.compile(
    r"""(?i)\b(?:https?|wss?)://(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:/[^\s"'<>)]*)?"""
)
ENV_RE = re.compile(
    r"\b[A-Z][A-Z0-9_]{2,}(?:API_KEY|TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIALS?)\b|\b(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN)\b"
)
NETWORK_CALL_RE = re.compile(
    r"(?i)(requests\.(?:request|get|post|put|patch|delete)|urllib\.request\.(?:urlopen|Request)|"
    r"httpx\.(?:request|get|post|put|patch|delete)|aiohttp\.[^\n]{0,60}(?:get|post)|"
    r"axios\.(?:request|get|post|put|patch|delete)|fetch\s*\(|curl\s+|WebSocket|page\.goto)"
)
CONTENT_RE = re.compile(r"(?i)(content|text|prompt|document|file|payload|body|user_input|文案|内容|文件|用户输入)")
PAID_RE = re.compile(
    r"(?i)\b(?:requires?\s+(?:a\s+)?paid|paid\s+(?:plan|account|call|service|operation|quota|credits?)|"
    r"consumes?\s+(?:credits?|quota)|charges?|billing|purchase\s+credits?)\b|"
    r"(?:扣费|收费|付费|充值|余额|消耗.{0,15}(?:额度|积分)|"
    r"(?:额度|积分).{0,15}(?:消耗|扣除|购买))"
)
FREE_CLAIM_RE = re.compile(r"(?i)(completely free|no cost|free to use|完全免费|不收费|永久免费)")
LOCAL_CLAIM_RE = re.compile(r"(?i)(runs? (?:entirely )?locally|offline only|never leaves|仅在?本地运行|完全离线运行|不会上传|不发送到第三方)")


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, max(offset, 0)) + 1


def line_excerpt(text: str, offset: int) -> str:
    start = text.rfind("\n", 0, offset) + 1
    end = text.find("\n", offset)
    if end < 0:
        end = len(text)
    return re.sub(r"\s+", " ", text[start:end]).strip()


def strip_markdown_examples(text: str) -> str:
    text = re.sub(r"(?:\x60){3}.*?(?:\x60){3}", "", text, flags=re.DOTALL)
    return "\n".join(
        line
        for line in text.splitlines()
        if not line.lstrip().startswith(">")
        and not re.match(r"^\s{4,}\S", line)
    )


def is_test_or_generated(path: str, text: str) -> bool:
    normalized = "/" + path.replace("\\", "/").lower()
    name = Path(path).name.lower()
    return (
        "/tests/" in normalized
        or "/test/" in normalized
        or "/fixtures/" in normalized
        or name.startswith("test_")
        or ".test." in name
        or ".spec." in name
        or name.endswith(".min.js")
        or (len(text) > 20_000 and text.count("\n") < 5)
    )


def is_rule_definition(excerpt: str) -> bool:
    stripped = excerpt.strip()
    return (
        '"pattern":' in excerpt
        or "'pattern':" in excerpt
        or "re.compile(" in excerpt
        or bool(re.match(r"^-\s*\x60[a-z0-9-]+\x60\s*:", stripped))
        or stripped.startswith('r"')
        or stripped.startswith("r'")
    )


def first_behavior_match(pattern: re.Pattern[str], text: str) -> re.Match[str] | None:
    for match in pattern.finditer(text):
        if not is_rule_definition(line_excerpt(text, match.start())):
            return match
    return None


def prompt_match_is_qualified(tag: str, excerpt: str) -> bool:
    """Return true when the same sentence clearly restores the safety boundary."""
    if tag == "authorization-overreach":
        return bool(
            re.search(
                r"(?i)(?:always|must|will|required\s+to)\s+(?:ask|confirm).{0,35}"
                r"(?:upload|purchase|publish|edit|delete)",
                excerpt,
            )
            or re.search(
                r"(?i)(?:upload|purchase|publish|edit|delete).{0,35}"
                r"(?:requires?|after|with).{0,12}(?:confirmation|permission|approval)",
                excerpt,
            )
            or re.search(
                r"(?:必须|需要|应当|务必).{0,10}(?:询问|确认|授权).{0,25}"
                r"(?:上传|购买|发布|编辑|删除)|(?:上传|购买|发布|编辑|删除).{0,25}"
                r"(?:必须|需要|应当|务必).{0,10}(?:询问|确认|授权)",
                excerpt,
            )
        )
    if tag == "disclosure-suppression":
        return bool(
            re.search(
                r"(?i)(?:do|must|will|仍|必须|需要|应当).{0,12}"
                r"(?:disclose|mention|tell|披露|说明|告知).{0,35}"
                r"(?:actual|selected|real|实际|当前|所选)",
                excerpt,
            )
        )
    if tag == "priority-escalation":
        return bool(
            re.search(
                r"(?i)(?:audit|detect|scan|review|flag|untrusted|审查|检测|扫描|识别|不可信)"
                r".{0,80}(?:ignore|override|忽略|覆盖)",
                excerpt,
            )
            or re.search(
                r"(?i)(?:text|content|file|instruction|文本|内容|文件|指令).{0,40}"
                r"(?:asks?|contains?|says?|要求|包含|写有).{0,30}(?:ignore|override|忽略|覆盖)",
                excerpt,
            )
        )
    return False


def network_call_context(text: str, match: re.Match[str]) -> str:
    """Extract the call expression, bounded to avoid unrelated URLs in the file."""
    start = text.rfind("\n", 0, match.start()) + 1
    end = text.find("\n", match.end())
    if end < 0:
        end = len(text)
    cursor = match.end()
    depth = 0
    seen_open = False
    quote: str | None = None
    escaped = False
    limit = min(len(text), match.start() + 1600)
    while cursor < limit:
        char = text[cursor]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in {'"', "'"}:
            quote = char
        elif char == "(":
            depth += 1
            seen_open = True
        elif char == ")" and seen_open:
            depth -= 1
            if depth <= 0:
                end = cursor + 1
                break
        cursor += 1
    return text[start:end]


def network_destinations(text: str, match: re.Match[str], context: str) -> list[str]:
    urls = list(NETWORK_RE.findall(context))
    if not urls:
        call_tail = context[max(0, match.start() - (text.rfind("\n", 0, match.start()) + 1)):]
        argument = re.search(r"\(\s*(?:[\"'][A-Z]+[\"']\s*,\s*)?([A-Za-z_][A-Za-z0-9_]*)", call_tail)
        if argument:
            variable = re.escape(argument.group(1))
            assignments = list(re.finditer(rf"(?m)^\s*{variable}\s*=\s*(.+)$", text[:match.start()]))
            if assignments:
                urls.extend(NETWORK_RE.findall(assignments[-1].group(1)))
    destinations = {
        urlparse(url.rstrip(".,;")).hostname.lower()
        for url in urls
        if urlparse(url.rstrip(".,;")).hostname
    }
    return sorted(destinations)


def is_definitive_local_claim(text: str, match: re.Match[str]) -> bool:
    excerpt = line_excerpt(text, match.start())
    before = excerpt[: max(0, excerpt.lower().find(match.group(0).lower()))]
    return not bool(
        re.search(
            r"(?i)(?:if|when|want|option|mode|troubleshoot|如果|若|想|希望|如需|模式|选项|排障)\s*$",
            before,
        )
    )


def audit_rules(
    skill_id: str,
    source: str,
    text: str,
    rules: list[dict[str, object]],
    evidence_type: str,
    base_line: int = 0,
) -> list[Finding]:
    findings: list[Finding] = []
    for rule in rules:
        pattern = re.compile(str(rule["pattern"]), re.MULTILINE)
        for match in list(pattern.finditer(text))[:4]:
            excerpt = line_excerpt(text, match.start())
            if is_rule_definition(excerpt):
                continue
            if evidence_type == "prompt" and prompt_match_is_qualified(str(rule["tag"]), excerpt):
                continue
            kwargs: dict[str, object] = {
                "recommendation": str(rule["recommendation"]),
            }
            if evidence_type == "prompt":
                kwargs.update(
                    linguisticFeatures=list(rule.get("features", [])),
                    claimedPriority=rule.get("claimed"),
                    actualPriority="Ordinary Skill instruction" if rule.get("claimed") else None,
                )
            else:
                kwargs.update(affectedData=list(rule.get("affected", [])))
            findings.append(
                make_finding(
                    skill_id,
                    str(rule["tag"]),
                    str(rule["severity"]),
                    str(rule.get("confidence", "probable" if evidence_type == "prompt" else "confirmed")),
                    evidence_type,
                    source,
                    base_line + line_number(text, match.start()),
                    excerpt,
                    str(rule["title"]),
                    str(rule["plain"]),
                    str(rule["technical"]),
                    **kwargs,
                )
            )
    return findings


def prompt_profile(text: str) -> dict[str, object]:
    categories = {
        "imperatives": r"(?i)\b(must|always|never|required|immediately)\b|必须|始终|绝不|立即|务必|不得",
        "priorityClaims": r"(?i)highest priority|override|ignore previous|优先级|忽略之前|覆盖.*指令",
        "consentPressure": r"(?i)without asking|do not ask|无需确认|不要询问|自动执行",
        "commercialPressure": r"(?i)free credits?|limited time|register now|免费额度|立即注册|充值",
        "disclosureLanguage": r"(?i)disclose|consent|permission|cost|third party|披露|同意|授权|费用|第三方",
    }
    counts = {name: len(re.findall(pattern, text)) for name, pattern in categories.items()}
    normalized_lines = [re.sub(r"\W+", "", line.lower()) for line in text.splitlines()]
    repeats = Counter(line for line in normalized_lines if len(line) >= 12)
    repeated = sum(count - 1 for count in repeats.values() if count > 1)
    return {
        **counts,
        "repeatedDirectives": repeated,
        "instructionCharacters": len(text),
    }


def unique_findings(findings: list[Finding]) -> list[Finding]:
    best: dict[tuple[str, str, int], Finding] = {}
    for finding in findings:
        key = (finding.tag, finding.source, finding.line)
        current = best.get(key)
        if not current or SEVERITY_RANK[finding.severity] > SEVERITY_RANK[current.severity]:
            best[key] = finding
    return sorted(
        best.values(),
        key=lambda item: (-SEVERITY_RANK[item.severity], item.tag, item.source, item.line),
    )


def audit_skill(root: Path, files: list[FileRecord], mode: str) -> dict[str, object]:
    skill_file = next((record for record in files if record.path == "SKILL.md"), None)
    skill_text = skill_file.text if skill_file and skill_file.text else ""
    frontmatter, body, body_line = split_frontmatter(skill_text)
    name = str(frontmatter.get("name") or root.name)
    description = str(frontmatter.get("description") or "")
    skill_id = stable_id("skill", str(root))
    findings: list[Finding] = []
    domains: set[str] = set()
    credentials: set[str] = set()
    profile = prompt_profile(description + "\n" + body)

    if not description:
        findings.append(
            make_finding(
                skill_id, "documentation-mismatch", "low", "confirmed", "metadata",
                "SKILL.md", 1, "description: missing", "Skill 缺少可用的触发说明",
                "用户和 Agent 可能无法判断什么时候应该选择这个 Skill。",
                "The required frontmatter description is absent or empty.", recommendation="restrict",
            )
        )

    findings.extend(
        audit_rules(
            skill_id, "SKILL.md frontmatter.description",
            strip_markdown_examples(description),
            PROMPT_RULES, "prompt", 1,
        )
    )
    if mode == "standard":
        findings.extend(
            audit_rules(
                skill_id, "SKILL.md", strip_markdown_examples(body),
                PROMPT_RULES, "prompt", body_line - 1,
            )
        )

    for record in files:
        if record.text is None:
            continue
        text = record.text
        excluded_source = is_test_or_generated(record.path, text)
        code_suffix = Path(record.path).suffix.lower() in {
            ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
            ".sh", ".zsh", ".bash", ".ps1", ".rb",
        }
        network_match = (
            first_behavior_match(NETWORK_CALL_RE, text)
            if code_suffix and not excluded_source
            else None
        )
        if not excluded_source:
            for env_match in ENV_RE.finditer(text):
                if not is_rule_definition(line_excerpt(text, env_match.start())):
                    credentials.add(env_match.group(0))

        if (
            record.path != "SKILL.md"
            and mode == "standard"
            and Path(record.path).suffix.lower() in {".md", ".txt", ".yaml", ".yml"}
        ):
            findings.extend(
                audit_rules(
                    skill_id, record.path, strip_markdown_examples(text),
                    PROMPT_RULES, "prompt",
                )
            )
        if code_suffix and not excluded_source:
            findings.extend(audit_rules(skill_id, record.path, text, CODE_RULES, "code"))
            if network_match:
                match = network_match
                call_context = network_call_context(text, match)
                destinations = network_destinations(text, match, call_context)
                domains.update(destination for destination in destinations if destination != "www.w3.org")
                carries_content = bool(CONTENT_RE.search(call_context))
                findings.append(
                    make_finding(
                        skill_id, "external-data-transfer",
                        "high" if carries_content else "medium",
                        "probable", "code", record.path, line_number(text, match.start()),
                        line_excerpt(text, match.start()),
                        "Skill 可以与外部站点通信",
                        "这个 Skill 处理的信息可能会离开当前设备。",
                        "A network client is present; static analysis cannot prove every runtime payload.",
                        affectedData=["processed input"] if carries_content else ["request metadata"],
                        destination=", ".join(destinations) if destinations else "dynamic destination",
                        recommendation="require-confirmation",
                    )
                )
        paid = PAID_RE.search(text)
        if paid and record.path.lower().endswith((".md", ".yaml", ".yml")):
            excerpt = line_excerpt(text, paid.start())
            if is_rule_definition(excerpt) or re.search(
                r"(?i)\b(audit|detect|scan|review|flag).{0,80}\b(paid|billing|charge)",
                excerpt,
            ):
                continue
            findings.append(
                make_finding(
                    skill_id, "paid-operation", "medium", "confirmed", "contract",
                    record.path, line_number(text, paid.start()), excerpt,
                    "Skill 描述了付费或消耗额度的操作",
                    "部分操作可能消耗余额、积分、额度或付费账号资源。",
                    "Commercial or quota language is present in the inspected documentation.",
                    affectedData=["account balance or quota"],
                    recommendation="require-confirmation",
                )
            )

    active_text = "\n".join(
        record.text or ""
        for record in files
        if record.text is not None
        and not is_test_or_generated(record.path, record.text)
    )
    has_network = bool(first_behavior_match(NETWORK_CALL_RE, active_text) or domains)
    claim_text = description + "\n" + body
    local_claim = next(
        (
            match for match in LOCAL_CLAIM_RE.finditer(claim_text)
            if is_definitive_local_claim(claim_text, match)
        ),
        None,
    )
    if local_claim and has_network:
        offset = skill_text.lower().find(local_claim.group(0).lower())
        findings.append(
            make_finding(
                skill_id, "documentation-mismatch", "high", "probable", "contract",
                "SKILL.md", line_number(skill_text, offset), local_claim.group(0),
                "“仅本地运行”的声明与联网能力存在冲突",
                "这个 Skill 的说明可能让用户形成与真实实现不同的预期。",
                "A local or offline claim coexists with network endpoints or network clients.",
                recommendation="restrict",
            )
        )
    free_claim = first_behavior_match(FREE_CLAIM_RE, active_text)
    paid_claim = first_behavior_match(PAID_RE, active_text)
    if free_claim and paid_claim:
        findings.append(
            make_finding(
                skill_id, "documentation-mismatch", "medium", "probable", "contract",
                "multiple files", 1, free_claim.group(0),
                "免费使用声明与付费或额度说明同时存在",
                "这个 Skill 可能没有清楚说明免费与付费能力的边界。",
                "Static documentation contains both unconditional-free and paid/quota language.",
                recommendation="require-confirmation",
            )
        )

    findings = unique_findings(findings)
    candidate_highest = max((SEVERITY_RANK[f.severity] for f in findings), default=0)
    candidate_severity = next(
        name for name, rank in SEVERITY_RANK.items() if rank == candidate_highest
    )
    candidate_confidence = max(
        (CONFIDENCE_RANK[f.confidence] for f in findings), default=0
    )
    candidate_confidence_label = next(
        name for name, rank in CONFIDENCE_RANK.items() if rank == candidate_confidence
    )
    candidate_tags = sorted({finding.tag for finding in findings})

    prompt_risk_tags = {
        finding.tag for finding in findings if finding.evidenceType in {"prompt", "metadata"}
    }
    if not description:
        description_summary = "没有提供清晰的用途说明。"
    elif prompt_risk_tags:
        description_summary = "用途说明包含需要注意的触发范围、优先级或授权表达。"
    else:
        description_summary = "已提供用途说明；下方结论基于静态证据，不代表运行时保证。"

    return {
        "id": skill_id,
        "name": name,
        "path": root.name,
        "description": description_summary,
        "verificationStatus": "pending-agent-review",
        "severity": "pending",
        "confidence": "pending",
        "recommendation": "agent-review",
        "candidateSeverity": candidate_severity,
        "candidateConfidence": candidate_confidence_label,
        "candidateTags": candidate_tags,
        "findings": public_findings(findings),
        "findingCount": len(findings),
        "fileCount": len(files),
        "totalBytes": sum(record.size for record in files),
        "externalServiceCount": len(domains),
        "credentialReferenceCount": len(credentials),
        "implicitInvocation": frontmatter.get("policy.allow_implicit_invocation"),
        "technicalAnalysisAvailable": True,
        "_description": description,
        "_domains": sorted(domains),
        "_credentials": sorted(set(credentials)),
        "_promptProfile": profile,
        "_contentHash": hashlib.sha256(
            "".join(record.sha256 for record in files).encode("ascii")
        ).hexdigest(),
        "_technicalFindings": findings,
    }


def public_finding(finding: Finding) -> dict[str, object]:
    return {
        "id": finding.id,
        "tag": finding.tag,
        "status": "candidate",
        "candidateSeverity": finding.severity,
        "candidateConfidence": finding.confidence,
        "title": "候选信号：" + finding.title,
        "explanation": "静态扫描发现相关信号，尚未完成 Agent 语义核验。",
        "trigger": "需要 Agent 结合原文和代码上下文复核",
        "affectedData": finding.affectedData,
        "destination": "外部站点" if finding.destination else None,
        "needsAgentReview": True,
    }


def public_findings(findings: list[Finding]) -> list[dict[str, object]]:
    groups: dict[tuple[str, str], list[Finding]] = defaultdict(list)
    for finding in findings:
        if finding.severity != "info":
            groups[(finding.tag, finding.title)].append(finding)
    result: list[dict[str, object]] = []
    for grouped in groups.values():
        strongest = max(
            grouped,
            key=lambda item: (
                SEVERITY_RANK[item.severity],
                CONFIDENCE_RANK[item.confidence],
            ),
        )
        public = public_finding(strongest)
        public["evidenceCount"] = len(grouped)
        public["affectedData"] = sorted(
            {value for finding in grouped for value in finding.affectedData}
        )
        public["destination"] = (
            "外部站点" if any(finding.destination for finding in grouped) else None
        )
        result.append(public)
    return sorted(
        result,
        key=lambda item: (
            -SEVERITY_RANK[str(item["candidateSeverity"])],
            str(item["tag"]),
        ),
    )


def tokenize_description(text: str) -> set[str]:
    tokens = {token.lower() for token in re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text)}
    for block in re.findall(r"[\u4e00-\u9fff]{2,}", text):
        tokens.update(block[i : i + 2] for i in range(len(block) - 1))
    return {token for token in tokens if token not in COMMON_TOKENS}


def build_graph(skills: list[dict[str, object]]) -> dict[str, object]:
    nodes: list[dict[str, object]] = []
    edges: list[dict[str, object]] = []
    node_ids: set[str] = set()

    def add_node(node: dict[str, object]) -> None:
        node_id = str(node["id"])
        if node_id not in node_ids:
            nodes.append(node)
            node_ids.add(node_id)

    domain_labels = {
        domain: f"外部站点 {index + 1}"
        for index, domain in enumerate(
            sorted({str(domain) for skill in skills for domain in skill.get("_domains", [])})
        )
    }
    credential_labels = {
        credential: f"敏感凭据 {index + 1}"
        for index, credential in enumerate(
            sorted({str(value) for skill in skills for value in skill.get("_credentials", [])})
        )
    }

    for skill in skills:
        add_node(
            {
                "id": skill["id"], "label": skill["name"], "type": "skill",
                "severity": skill["candidateSeverity"],
                "recommendation": "agent-review",
            }
        )
        for domain in skill.get("_domains", []):
            domain_id = stable_id("domain", str(domain))
            add_node(
                {
                    "id": domain_id, "label": domain_labels[str(domain)],
                    "type": "domain", "severity": "info",
                }
            )
            edges.append(
                {"source": skill["id"], "target": domain_id, "type": "uses-domain", "weight": 1}
            )
        for credential in skill.get("_credentials", []):
            credential_id = stable_id("credential", str(credential))
            add_node(
                {
                    "id": credential_id, "label": credential_labels[str(credential)],
                    "type": "credential", "severity": "high",
                }
            )
            edges.append(
                {
                    "source": skill["id"], "target": credential_id,
                    "type": "accesses-credential", "weight": 1,
                }
            )

    token_index: dict[str, list[int]] = defaultdict(list)
    token_sets: list[set[str]] = []
    for index, skill in enumerate(skills):
        tokens = tokenize_description(str(skill.get("_description", skill["description"])))
        token_sets.append(tokens)
        for token in tokens:
            if len(token_index[token]) < 40:
                token_index[token].append(index)
    pair_common: Counter[tuple[int, int]] = Counter()
    for indices in token_index.values():
        for left_pos, left in enumerate(indices):
            for right in indices[left_pos + 1 :]:
                pair_common[(left, right)] += 1
    for (left, right), common in pair_common.most_common(1000):
        union = len(token_sets[left] | token_sets[right]) or 1
        score = common / union
        if common >= 3 and score >= 0.12:
            edges.append(
                {
                    "source": skills[left]["id"], "target": skills[right]["id"],
                    "type": "capability-overlap", "weight": round(score, 3),
                }
            )
    return {"nodes": nodes, "edges": edges}


def estimate_resources(
    skill_count: int, file_count: int, total_bytes: int, mode: str
) -> dict[str, object]:
    megabytes = total_bytes / (1024 * 1024)
    mode_factor = 0.55 if mode == "quick" else 1.0
    estimated_seconds = max(
        0.2, mode_factor * (0.08 * skill_count + 0.003 * file_count + 0.025 * megabytes)
    )
    estimated_memory = round(48 + min(1536, megabytes * 3.2 + file_count * 0.018))
    technical_tokens = round(min(2_000_000, total_bytes / 3.7))
    if skill_count <= 20 and file_count <= 500 and total_bytes <= 20 * 1024 * 1024:
        complexity = "low"
    elif skill_count <= 100 and file_count <= 5000 and total_bytes <= 200 * 1024 * 1024:
        complexity = "medium"
    else:
        complexity = "high"
    return {
        "complexity": complexity,
        "mode": mode,
        "estimatedLocalSeconds": round(estimated_seconds, 1),
        "estimatedPeakMemoryMB": estimated_memory,
        "estimatedTechnicalReviewTokens": technical_tokens,
        "tokenNote": (
            "Approximate tokens only if an Agent later loads all inspected text; "
            "the local scanner does not consume model tokens."
        ),
    }


def summarize(skills: list[dict[str, object]]) -> dict[str, object]:
    severity_counts = Counter(str(skill["candidateSeverity"]) for skill in skills)
    tag_counts = Counter(tag for skill in skills for tag in skill["candidateTags"])
    return {
        "skillCount": len(skills),
        "candidateSeverityCounts": dict(severity_counts),
        "candidateTagCounts": dict(tag_counts),
        "topCandidateTags": [
            {"tag": tag, "count": count} for tag, count in tag_counts.most_common(10)
        ],
        "verificationStatus": "pending-agent-review",
    }


def collect_inventory(
    scopes: list[Path], max_file_bytes: int
) -> tuple[list[Path], dict[str, list[FileRecord]]]:
    roots = discover_skills(scopes)
    inventories = {str(root): list_files(root, max_file_bytes) for root in roots}
    return roots, inventories


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def render_html(
    template_path: Path, output_path: Path, public_report: dict[str, object]
) -> None:
    template = template_path.read_text(encoding="utf-8")
    encoded = json.dumps(public_report, ensure_ascii=False).replace("</", "<\\/")
    output_path.write_text(
        template.replace("__WISE_SKILL_KEEPER_REPORT__", encoded), encoding="utf-8"
    )


def scan(args: argparse.Namespace) -> int:
    started = time.perf_counter()
    scopes = [Path(scope) for scope in args.scopes]
    roots, inventories = collect_inventory(scopes, args.max_file_bytes)
    if not roots:
        print("No SKILL.md files found in the requested scope.", file=sys.stderr)
        return 2

    file_count = sum(len(records) for records in inventories.values())
    total_bytes = sum(record.size for records in inventories.values() for record in records)
    estimate_data = estimate_resources(len(roots), file_count, total_bytes, args.mode)
    print(
        f"Inventory: {len(roots)} Skills, {file_count} files, {total_bytes} bytes; "
        f"complexity={estimate_data['complexity']}, "
        f"estimated_local_seconds={estimate_data['estimatedLocalSeconds']}"
    )

    skills = [audit_skill(root, inventories[str(root)], args.mode) for root in roots]
    technical_findings = [
        asdict(finding)
        for skill in skills
        for finding in skill.pop("_technicalFindings")
    ]
    candidate_graph = build_graph(skills)
    technical_skills = [
        {
            "id": skill["id"],
            "path": str(root),
            "description": skill.pop("_description"),
            "domains": skill.pop("_domains"),
            "credentials": skill.pop("_credentials"),
            "promptProfile": skill.pop("_promptProfile"),
            "contentHash": skill.pop("_contentHash"),
        }
        for root, skill in zip(roots, skills)
    ]
    finished = time.perf_counter()
    generated_at = datetime.now(timezone.utc).isoformat()
    scope_strings = [path.expanduser().resolve().name or "本地范围" for path in scopes]
    technical_scope_strings = [str(path.expanduser().resolve()) for path in scopes]
    public_report = {
        "schemaVersion": 2,
        "scannerVersion": VERSION,
        "generatedAt": generated_at,
        "scope": scope_strings,
        "mode": args.mode,
        "summary": summarize(skills),
        "resourceEstimate": estimate_data,
        "actual": {
            "elapsedSeconds": round(finished - started, 4),
            "fileCount": file_count,
            "totalBytes": total_bytes,
        },
        "skills": skills,
        "graph": {
            "status": "pending-agent-review",
            "nodes": [],
            "edges": [],
            "message": "关系图将在 Agent 完成语义核验后生成。",
        },
        "review": {
            "status": "pending-agent-review",
            "evidenceCoverage": "pending",
            "owner": "agent",
            "contract": "references/agent-review.md",
        },
        "limitations": [
            "本报告来自只读静态分析，没有执行被审查的 Skill。",
            "候选信号不是最终风险判断，必须由 Agent 结合上下文复核。",
            "本次没有联网核验外部站点的信誉或公开声明。",
            "Agent 复核前不会生成关系图、最终风险等级或处置建议。",
        ],
        "technicalAnalysisAvailable": True,
    }
    evidence_report = {
        "schemaVersion": 2,
        "scannerVersion": VERSION,
        "generatedAt": generated_at,
        "scope": technical_scope_strings,
        "skills": technical_skills,
        "findings": technical_findings,
        "candidateGraph": candidate_graph,
        "reviewContract": {
            "path": "references/agent-review.md",
            "status": "awaiting-agent-review",
        },
        "files": [
            {
                "skillPath": skill_root,
                "path": record.path,
                "size": record.size,
                "sha256": record.sha256,
                "truncated": record.truncated,
            }
            for skill_root, records in inventories.items()
            for record in records
        ],
    }

    output = Path(args.output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "report.json", public_report)
    write_json(output / "evidence.json", evidence_report)
    if not args.no_html:
        template = (
            Path(__file__).resolve().parent.parent
            / "assets"
            / "report-viewer"
            / "template.html"
        )
        render_html(template, output / "index.html", public_report)
    print(f"Report: {output / 'index.html'}")
    print(f"Evidence for Agent review: {output / 'evidence.json'}")
    return 0


def estimate_command(args: argparse.Namespace) -> int:
    roots, inventories = collect_inventory(
        [Path(scope) for scope in args.scopes], args.max_file_bytes
    )
    file_count = sum(len(records) for records in inventories.values())
    total_bytes = sum(record.size for records in inventories.values() for record in records)
    payload = {
        "skillCount": len(roots),
        "fileCount": file_count,
        "totalBytes": total_bytes,
        "resourceEstimate": estimate_resources(
            len(roots), file_count, total_bytes, args.mode
        ),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


FINAL_SEVERITIES = {"info", "low", "medium", "high", "critical"}
FINAL_CONFIDENCES = {"heuristic", "probable", "confirmed"}
FINAL_RECOMMENDATIONS = {
    "keep", "keep-with-notice", "require-confirmation", "restrict",
    "explicit-only", "isolate", "uninstall",
}
EXTERNAL_SITE_SCALES = {"unknown", "small", "medium", "large"}
EXTERNAL_SITE_RECOGNITION = {"unknown", "niche", "regional", "widely-known"}
EXTERNAL_SITE_SAFETY = {
    "not-reviewed", "no-material-concern-found", "concerns-found"
}


def validate_final_recommendation(result: dict[str, object], skill_id: str) -> None:
    recommendation = str(result.get("recommendation", ""))
    if recommendation not in {"isolate", "uninstall"}:
        return
    assessment = result.get("harmAssessment")
    valid = (
        isinstance(assessment, dict)
        and assessment.get("status") == "confirmed"
        and bool(str(assessment.get("explanation", "")).strip())
        and assessment.get("narrowerControlsInsufficient") is True
    )
    if not valid:
        raise ValueError(
            f"Agent recommendation {recommendation} requires confirmed harm and "
            f"insufficient narrower controls for Skill: {skill_id}"
        )


def validate_plain_recommendation(result: dict[str, object], skill_id: str) -> None:
    severity = str(result.get("severity", ""))
    if severity in FINAL_SEVERITIES and SEVERITY_RANK[severity] >= SEVERITY_RANK["medium"]:
        if not str(result.get("plainRecommendation", "")).strip():
            raise ValueError(
                f"Agent review requires a plainRecommendation for medium-or-higher risk: {skill_id}"
            )


def validate_arbitrary_code_classification(
    result: dict[str, object], skill_id: str
) -> None:
    tags = {str(tag) for tag in result.get("riskTags", [])}
    finding_tags = {
        str(item.get("tag"))
        for item in result.get("findings", [])
        if isinstance(item, dict)
    }
    if "arbitrary-code-execution" not in tags | finding_tags:
        return
    assessment = result.get("executionAssessment")
    valid_scopes = {"host", "agent-runtime", "browser-privileged-bridge"}
    valid = (
        isinstance(assessment, dict)
        and assessment.get("status") == "agent-verified"
        and bool(str(assessment.get("sink", "")).strip())
        and bool(str(assessment.get("inputSource", "")).strip())
        and bool(str(assessment.get("dataFlow", "")).strip())
        and assessment.get("reachable") is True
        and assessment.get("constraintsInsufficient") is True
        and assessment.get("unexpectedOrUncontrolled") is True
        and assessment.get("executionScope") in valid_scopes
    )
    if not valid:
        raise ValueError(
            "Agent arbitrary-code-execution classification requires a verified "
            f"controllable execution path for Skill: {skill_id}"
        )


def validate_unsafe_rendering_classification(
    result: dict[str, object], skill_id: str
) -> None:
    tags = {str(tag) for tag in result.get("riskTags", [])}
    finding_tags = {
        str(item.get("tag"))
        for item in result.get("findings", [])
        if isinstance(item, dict)
    }
    if "unsafe-content-rendering" not in tags | finding_tags:
        return
    assessment = result.get("renderingAssessment")
    valid = (
        isinstance(assessment, dict)
        and assessment.get("status") == "agent-verified"
        and bool(str(assessment.get("inputSource", "")).strip())
        and bool(str(assessment.get("renderingContext", "")).strip())
        and bool(str(assessment.get("breakoutValue", "")).strip())
        and bool(str(assessment.get("generatedEffect", "")).strip())
        and assessment.get("reachable") is True
        and assessment.get("constraintsInsufficient") is True
    )
    if not valid:
        raise ValueError(
            "Agent unsafe-content-rendering classification requires a concrete "
            f"derived rendering breakout for Skill: {skill_id}"
        )


def sanitize_external_site(raw: object) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise ValueError(
            "Agent review findings with an external destination require an externalSite assessment"
        )
    category = str(raw.get("category", "")).strip()
    scale = str(raw.get("scale", ""))
    recognition = str(raw.get("recognition", ""))
    safety = str(raw.get("safetyAssessment", ""))
    basis = str(raw.get("basis", "")).strip()
    if not category or not basis:
        raise ValueError("External site assessment requires category and basis")
    if scale not in EXTERNAL_SITE_SCALES:
        raise ValueError("External site assessment has invalid scale")
    if recognition not in EXTERNAL_SITE_RECOGNITION:
        raise ValueError("External site assessment has invalid recognition")
    if safety not in EXTERNAL_SITE_SAFETY:
        raise ValueError("External site assessment has invalid safetyAssessment")
    return {
        "category": category,
        "scale": scale,
        "recognition": recognition,
        "safetyAssessment": safety,
        "basis": basis,
    }


def sanitize_review_finding(raw: object) -> dict[str, object]:
    if not isinstance(raw, dict):
        raise ValueError("Agent review findings must be objects")
    tag = str(raw.get("tag", "agent-review"))
    severity = str(raw.get("severity", "medium"))
    confidence = str(raw.get("confidence", "probable"))
    if severity not in FINAL_SEVERITIES or confidence not in FINAL_CONFIDENCES:
        raise ValueError("Agent review finding has invalid severity or confidence")
    is_external = bool(raw.get("destination"))
    external_site = sanitize_external_site(raw.get("externalSite")) if is_external else None
    return {
        "tag": tag,
        "severity": severity,
        "confidence": confidence,
        "title": str(raw.get("title", "Agent 核验出的风险")),
        "explanation": str(raw.get("explanation", "Agent 根据证据完成了核验。")),
        "affectedData": [str(item) for item in raw.get("affectedData", [])],
        "destination": "外部站点" if is_external else None,
        "externalSite": external_site,
        "evidenceCount": int(raw.get("evidenceCount", 1)),
        "status": "agent-verified",
    }


def validate_evidence_review(
    result: dict[str, object], skill_id: str, expected_ids: set[str]
) -> None:
    evidence_review = result.get("evidenceReview")
    if not isinstance(evidence_review, dict) or evidence_review.get("status") != "completed":
        raise ValueError(
            f"Agent review must attest completed evidence review for Skill: {skill_id}"
        )
    raw_ids = evidence_review.get("reviewedEvidenceIds")
    if not isinstance(raw_ids, list) or any(not isinstance(item, str) for item in raw_ids):
        raise ValueError(
            f"Agent review must list reviewedEvidenceIds for Skill: {skill_id}"
        )
    reviewed_ids = set(raw_ids)
    if len(raw_ids) != len(reviewed_ids) or reviewed_ids != expected_ids:
        missing = sorted(expected_ids - reviewed_ids)
        extra = sorted(reviewed_ids - expected_ids)
        raise ValueError(
            f"Agent evidence review is incomplete for Skill: {skill_id}; "
            f"missing={missing}, extra={extra}"
        )


def review_command(args: argparse.Namespace) -> int:
    input_dir = Path(args.input).expanduser().resolve()
    review_path = Path(args.review).expanduser().resolve()
    base = json.loads((input_dir / "report.json").read_text(encoding="utf-8"))
    evidence = json.loads((input_dir / "evidence.json").read_text(encoding="utf-8"))
    base_skill_ids = {str(skill["id"]) for skill in base.get("skills", [])}
    evidence_ids_by_skill: dict[str, set[str]] = defaultdict(set)
    for index, finding in enumerate(evidence.get("findings", [])):
        if not isinstance(finding, dict):
            raise ValueError(f"Evidence finding at index {index} must be an object")
        skill_id = str(finding.get("skillId", ""))
        evidence_id = str(finding.get("id", ""))
        if not skill_id or not evidence_id:
            raise ValueError(f"Evidence finding at index {index} requires skillId and id")
        if skill_id not in base_skill_ids:
            raise ValueError(f"Evidence finding references an unknown Skill: {skill_id}")
        if evidence_id in evidence_ids_by_skill[skill_id]:
            raise ValueError(f"Duplicate evidence ID for Skill {skill_id}: {evidence_id}")
        evidence_ids_by_skill[skill_id].add(evidence_id)
    review = json.loads(review_path.read_text(encoding="utf-8"))
    if review.get("status") != "agent-reviewed":
        raise ValueError("Agent review must set status to agent-reviewed")
    graph_review = review.get("candidateGraphReview")
    if not isinstance(graph_review, dict) or graph_review.get("status") != "completed":
        raise ValueError("Agent review must complete candidateGraphReview before final output")
    review_skills = {
        str(item.get("skillId")): item
        for item in review.get("skills", [])
        if isinstance(item, dict) and item.get("skillId")
    }
    unknown_review_skills = set(review_skills) - base_skill_ids
    if unknown_review_skills:
        raise ValueError(
            f"Agent review contains unknown Skills: {sorted(unknown_review_skills)}"
        )
    for skill in base.get("skills", []):
        result = review_skills.get(str(skill["id"]))
        if not result:
            raise ValueError(f"Agent review is missing Skill: {skill['id']}")
        severity = str(result.get("severity", ""))
        confidence = str(result.get("confidence", ""))
        recommendation = str(result.get("recommendation", ""))
        plain_recommendation = str(result.get("plainRecommendation", "")).strip()
        if severity not in FINAL_SEVERITIES:
            raise ValueError(f"Invalid Agent severity for Skill: {skill['id']}")
        if confidence not in FINAL_CONFIDENCES:
            raise ValueError(f"Invalid Agent confidence for Skill: {skill['id']}")
        if recommendation not in FINAL_RECOMMENDATIONS:
            raise ValueError(f"Invalid Agent recommendation for Skill: {skill['id']}")
        validate_evidence_review(
            result,
            str(skill["id"]),
            evidence_ids_by_skill.get(str(skill["id"]), set()),
        )
        validate_plain_recommendation(result, str(skill["id"]))
        validate_final_recommendation(result, str(skill["id"]))
        validate_arbitrary_code_classification(result, str(skill["id"]))
        validate_unsafe_rendering_classification(result, str(skill["id"]))
        skill["verificationStatus"] = "agent-reviewed"
        skill["severity"] = severity
        skill["confidence"] = confidence
        skill["recommendation"] = recommendation
        skill["reviewedRecommendation"] = plain_recommendation
        skill["riskTags"] = [str(tag) for tag in result.get("riskTags", [])]
        skill["reviewedConclusion"] = str(result.get("plainConclusion", ""))
        skill["findings"] = [sanitize_review_finding(item) for item in result.get("findings", [])]

    base["review"] = {
        "status": "agent-reviewed",
        "evidenceCoverage": "complete",
        "owner": "agent",
        "reviewedAt": review.get("reviewedAt"),
    }
    base["summary"] = {
        "skillCount": len(base.get("skills", [])),
        "severityCounts": dict(Counter(str(skill["severity"]) for skill in base["skills"])),
        "recommendationCounts": dict(Counter(str(skill["recommendation"]) for skill in base["skills"])),
        "topRiskTags": [
            {"tag": tag, "count": count}
            for tag, count in Counter(
                tag for skill in base["skills"] for tag in skill.get("riskTags", [])
            ).most_common(10)
        ],
        "verificationStatus": "agent-reviewed",
    }
    graph = review.get("graph")
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list) or not isinstance(graph.get("edges"), list):
        raise ValueError("Agent review must provide graph nodes and edges")
    base["graph"] = {
        "status": "agent-reviewed",
        "nodes": graph["nodes"],
        "edges": graph["edges"],
    }
    base["limitations"] = [
        "结论由 Agent 基于本地静态证据复核得出，没有执行被审查的 Skill。",
        "Agent 结论仍可能受上下文缺失影响，严重处置前需要人工确认。",
        "本次没有联网核验外部站点的信誉或公开声明。",
    ]

    output = Path(args.output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "report.json", base)
    template = Path(__file__).resolve().parent.parent / "assets" / "report-viewer" / "template.html"
    render_html(template, output / "index.html", base)
    print(f"Reviewed report: {output / 'index.html'}")
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Read-only local Skill safety auditor")
    subparsers = root.add_subparsers(dest="command", required=True)
    for command in ("estimate", "scan"):
        sub = subparsers.add_parser(command)
        sub.add_argument(
            "scopes", nargs="+",
            help="Skill folder, SKILL.md, workspace, or Skill directory",
        )
        sub.add_argument("--mode", choices=("quick", "standard"), default="standard")
        sub.add_argument("--max-file-bytes", type=int, default=1_500_000)
        if command == "scan":
            sub.add_argument(
                "--output", required=True,
                help="Directory for index.html, report.json, and evidence.json",
            )
            sub.add_argument("--no-html", action="store_true")
    review = subparsers.add_parser("review")
    review.add_argument("--input", required=True, help="Directory produced by scan")
    review.add_argument("--review", required=True, help="Agent-produced review JSON")
    review.add_argument("--output", required=True, help="Directory for the reviewed report")
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "estimate":
            return estimate_command(args)
        if args.command == "scan":
            return scan(args)
        return review_command(args)
    except (OSError, ValueError) as exc:
        print(f"wise-skill-keeper: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
