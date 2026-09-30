#!/usr/bin/env python3
"""Read-only SkillHub client used by Wizz Skill Safekeeper.

The client talks only to SkillHub's public HTTPS API, never sends credentials,
and stores fetched Skill files as an inert local snapshot for later static
analysis. Remote Skill content must never be imported or executed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


API_BASE = "https://api.skillhub.cn"
USER_AGENT = "wizz-skill-safekeeper/1.0"
DEFAULT_TIMEOUT = 20
DEFAULT_MAX_RESPONSE_BYTES = 8_000_000
DEFAULT_MAX_FILE_BYTES = 1_500_000
DEFAULT_MAX_TOTAL_BYTES = 20_000_000
DEFAULT_MAX_FILES = 300
REDIRECT_HOST_SUFFIXES = (
    "api.skillhub.cn",
    ".myqcloud.com",
    ".tencent-cloud.com",
    ".tencentcs.com",
)
SAFE_TOKEN = re.compile(r"^[A-Za-z0-9._-]+$")


class SkillHubError(ValueError):
    """Raised when a public SkillHub response cannot be used safely."""


def _is_allowed_host(hostname: str | None) -> bool:
    if not hostname:
        return False
    host = hostname.lower().rstrip(".")
    return any(host == suffix or host.endswith(suffix) for suffix in REDIRECT_HOST_SUFFIXES)


def _validate_https_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not _is_allowed_host(parsed.hostname):
        raise SkillHubError(f"refused non-SkillHub redirect: {url}")


class SkillHubRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        _validate_https_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _validate_coordinate(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not SAFE_TOKEN.fullmatch(normalized):
        raise SkillHubError(f"invalid {label}: {value!r}")
    return normalized


def _validate_remote_path(value: str) -> str:
    raw = value.strip().replace("\\", "/")
    if not raw or raw.startswith("/") or "\x00" in raw:
        raise SkillHubError(f"invalid remote file path: {value!r}")
    raw_parts = raw.split("/")
    if any(part in {"", ".", ".."} for part in raw_parts):
        raise SkillHubError(f"unsafe remote file path: {value!r}")
    normalized = PurePosixPath(raw).as_posix()
    if normalized != raw:
        raise SkillHubError(f"non-canonical remote file path: {value!r}")
    return normalized


def _sanitize_folder_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-.")
    return cleaned or "remote-skill"


def _curl_request_bytes(url: str, *, timeout: int, max_bytes: int) -> bytes:
    """Fetch one HTTPS resource with curl's system trust store.

    Redirects are followed manually so every destination is checked against the
    SkillHub/CDN allowlist before any second request is made. This is a secure
    compatibility fallback for Python installations whose bundled CA store does
    not include the host system's managed trust chain.
    """

    _validate_https_url(url)
    current_url = url
    for redirect_count in range(4):
        with tempfile.TemporaryDirectory(prefix="wizz-skillhub-") as temp:
            temp_root = Path(temp)
            headers_path = temp_root / "headers.txt"
            body_path = temp_root / "body.bin"
            command = [
                "curl",
                "-sS",
                "--proto",
                "=https",
                "--max-time",
                str(timeout),
                "--max-redirs",
                "0",
                "--max-filesize",
                str(max_bytes),
                "--user-agent",
                USER_AGENT,
                "--header",
                "Accept: application/json",
                "--dump-header",
                str(headers_path),
                "--output",
                str(body_path),
                "--write-out",
                "%{http_code}",
                current_url,
            ]
            try:
                completed = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=timeout + 5,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise SkillHubError(f"system HTTPS transport failed: {exc}") from exc

            if completed.returncode != 0:
                message = completed.stderr.strip() or f"curl exit {completed.returncode}"
                raise SkillHubError(f"system HTTPS transport failed: {message}")
            try:
                status = int(completed.stdout.strip())
            except ValueError as exc:
                raise SkillHubError("system HTTPS transport returned no HTTP status") from exc

            header_text = headers_path.read_text(encoding="iso-8859-1", errors="replace")
            if 300 <= status < 400:
                locations = re.findall(r"(?im)^location:\s*(.+?)\s*$", header_text)
                if not locations:
                    raise SkillHubError(f"SkillHub HTTP {status} without a redirect location")
                if redirect_count >= 3:
                    raise SkillHubError("SkillHub exceeded the redirect limit")
                current_url = urljoin(current_url, locations[-1])
                _validate_https_url(current_url)
                continue
            if status >= 400:
                detail = body_path.read_bytes()[:1024].decode("utf-8", errors="replace").strip()
                raise SkillHubError(f"SkillHub HTTP {status}: {detail or 'request failed'}")

            size = body_path.stat().st_size
            if size > max_bytes:
                raise SkillHubError(f"SkillHub response exceeds {max_bytes} bytes")
            return body_path.read_bytes()
    raise SkillHubError("SkillHub exceeded the redirect limit")


class SkillHubClient:
    def __init__(
        self,
        *,
        timeout: int = DEFAULT_TIMEOUT,
        max_response_bytes: int = DEFAULT_MAX_RESPONSE_BYTES,
        opener=None,
        curl_transport=None,
    ) -> None:
        self.timeout = timeout
        self.max_response_bytes = max_response_bytes
        self.opener = opener or build_opener(SkillHubRedirectHandler())
        self.curl_transport = curl_transport or _curl_request_bytes

    def _request_bytes(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        max_bytes: int | None = None,
    ) -> bytes:
        if not path.startswith("/api/") or path.startswith("//"):
            raise SkillHubError(f"invalid SkillHub API path: {path!r}")
        query = urlencode(
            {key: value for key, value in (params or {}).items() if value not in {None, ""}},
            doseq=True,
        )
        url = f"{API_BASE}{path}{'?' + query if query else ''}"
        _validate_https_url(url)
        request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
        limit = max_bytes if max_bytes is not None else self.max_response_bytes
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                data = response.read(limit + 1)
        except HTTPError as exc:
            detail = exc.read(1024).decode("utf-8", errors="replace").strip()
            raise SkillHubError(f"SkillHub HTTP {exc.code}: {detail or exc.reason}") from exc
        except URLError as exc:
            reason = exc.reason
            is_certificate_error = isinstance(reason, ssl.SSLCertVerificationError) or (
                "CERTIFICATE_VERIFY_FAILED" in str(reason)
            )
            if not is_certificate_error:
                raise SkillHubError(f"SkillHub request failed: {reason}") from exc
            data = self.curl_transport(
                url,
                timeout=self.timeout,
                max_bytes=limit,
            )
        if len(data) > limit:
            raise SkillHubError(f"SkillHub response exceeds {limit} bytes")
        return data

    def _request_json(
        self,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = self._request_bytes(path, params)
        try:
            result = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SkillHubError("SkillHub returned malformed JSON") from exc
        if not isinstance(result, dict):
            raise SkillHubError("SkillHub returned an unexpected JSON shape")
        return result

    def list_skills(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "score",
        order: str = "desc",
        keyword: str = "",
        category: str = "",
        source: str = "",
        labels: str = "",
    ) -> dict[str, Any]:
        if page < 1 or not 1 <= page_size <= 100:
            raise SkillHubError("page must be >= 1 and page_size must be between 1 and 100")
        sort_by = _validate_coordinate(sort_by, "sort field")
        if order not in {"asc", "desc"}:
            raise SkillHubError("order must be asc or desc")
        response = self._request_json(
            "/api/skills",
            {
                "page": page,
                "pageSize": page_size,
                "sortBy": sort_by,
                "order": order,
                "keyword": keyword.strip(),
                "category": category.strip(),
                "source": source.strip(),
                "labels": labels.strip(),
            },
        )
        if response.get("code") != 0 or not isinstance(response.get("data"), dict):
            raise SkillHubError(str(response.get("message") or "SkillHub list request failed"))
        return response

    def search(self, query: str, *, limit: int = 10) -> dict[str, Any]:
        normalized = query.strip()
        if not normalized:
            raise SkillHubError("search query cannot be empty")
        if not 1 <= limit <= 100:
            raise SkillHubError("search limit must be between 1 and 100")
        response = self._request_json("/api/v1/search", {"q": normalized, "limit": limit})
        if not isinstance(response.get("results"), list):
            raise SkillHubError("SkillHub search response has no results list")
        return response

    def detail(self, slug: str, *, namespace: str = "") -> dict[str, Any]:
        slug = _validate_coordinate(slug, "slug")
        params = {"namespace": _validate_coordinate(namespace, "namespace") if namespace else ""}
        response = self._request_json(f"/api/v1/skills/{quote(slug, safe='')}", params)
        if not isinstance(response.get("skill"), dict):
            raise SkillHubError("SkillHub detail response has no skill object")
        return response

    def files(
        self,
        slug: str,
        *,
        namespace: str = "",
        version: str = "",
    ) -> dict[str, Any]:
        slug = _validate_coordinate(slug, "slug")
        params = {
            "namespace": _validate_coordinate(namespace, "namespace") if namespace else "",
            "version": _validate_coordinate(version, "version") if version else "",
        }
        response = self._request_json(f"/api/v1/skills/{quote(slug, safe='')}/files", params)
        if not isinstance(response.get("files"), list):
            raise SkillHubError("SkillHub files response has no files list")
        return response

    def file_bytes(
        self,
        slug: str,
        remote_path: str,
        *,
        namespace: str = "",
        version: str = "",
        max_bytes: int = DEFAULT_MAX_FILE_BYTES,
    ) -> bytes:
        slug = _validate_coordinate(slug, "slug")
        remote_path = _validate_remote_path(remote_path)
        params = {
            "path": remote_path,
            "namespace": _validate_coordinate(namespace, "namespace") if namespace else "",
            "version": _validate_coordinate(version, "version") if version else "",
        }
        return self._request_bytes(
            f"/api/v1/skills/{quote(slug, safe='')}/file",
            params,
            max_bytes=max_bytes,
        )

    def fetch_snapshot(
        self,
        slug: str,
        output: Path,
        *,
        namespace: str = "",
        version: str = "",
        max_files: int = DEFAULT_MAX_FILES,
        max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
        max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES,
    ) -> dict[str, Any]:
        detail = self.detail(slug, namespace=namespace)
        resolved_namespace = namespace or str((detail.get("namespace") or {}).get("handle") or "")
        resolved_version = version or str((detail.get("latestVersion") or {}).get("version") or "")
        listing = self.files(
            slug,
            namespace=resolved_namespace,
            version=resolved_version,
        )
        remote_files = listing["files"]
        if len(remote_files) > max_files:
            raise SkillHubError(
                f"remote Skill contains {len(remote_files)} files; limit is {max_files}"
            )

        destination = output.expanduser().resolve()
        if destination.exists() and any(destination.iterdir()):
            raise SkillHubError(f"output directory is not empty: {destination}")
        destination.mkdir(parents=True, exist_ok=True)

        downloaded: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        total_bytes = 0
        for item in remote_files:
            if not isinstance(item, dict):
                skipped.append({"path": "", "reason": "malformed file record"})
                continue
            remote_path = _validate_remote_path(str(item.get("path") or ""))
            declared_size = int(item.get("size") or 0)
            if declared_size > max_file_bytes:
                skipped.append({"path": remote_path, "reason": "file exceeds size limit"})
                continue
            if total_bytes + declared_size > max_total_bytes:
                raise SkillHubError(
                    f"remote Skill exceeds total download limit of {max_total_bytes} bytes"
                )

            data = self.file_bytes(
                slug,
                remote_path,
                namespace=resolved_namespace,
                version=resolved_version,
                max_bytes=max_file_bytes,
            )
            if total_bytes + len(data) > max_total_bytes:
                raise SkillHubError(
                    f"remote Skill exceeds total download limit of {max_total_bytes} bytes"
                )
            expected_hash = str(item.get("sha256") or "").lower()
            actual_hash = hashlib.sha256(data).hexdigest()
            if expected_hash and expected_hash != actual_hash:
                raise SkillHubError(f"SHA-256 mismatch for remote file: {remote_path}")

            target = destination.joinpath(*PurePosixPath(remote_path).parts).resolve()
            if destination not in target.parents:
                raise SkillHubError(f"remote path escapes snapshot directory: {remote_path}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            total_bytes += len(data)
            downloaded.append({
                "path": remote_path,
                "size": len(data),
                "sha256": actual_hash,
            })

        if not (destination / "SKILL.md").is_file():
            raise SkillHubError("remote snapshot does not contain SKILL.md")

        metadata = {
            "source": "skillhub.cn",
            "apiBase": API_BASE,
            "slug": _validate_coordinate(slug, "slug"),
            "namespace": resolved_namespace,
            "version": resolved_version,
            "fetchedAsUntrustedData": True,
            "downloadedFiles": downloaded,
            "skippedFiles": skipped,
            "totalBytes": total_bytes,
            "detail": detail,
        }
        (destination / ".skillhub-source.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return {
            "snapshot": str(destination),
            "slug": metadata["slug"],
            "namespace": resolved_namespace,
            "version": resolved_version,
            "downloadedFileCount": len(downloaded),
            "skippedFileCount": len(skipped),
            "totalBytes": total_bytes,
        }


def execute(args: argparse.Namespace) -> int:
    client = SkillHubClient(timeout=args.timeout)
    if args.command == "remote-search":
        result = client.search(args.query, limit=args.limit)
    elif args.command == "remote-list":
        result = client.list_skills(
            page=args.page,
            page_size=args.page_size,
            sort_by=args.sort_by,
            order=args.order,
            keyword=args.keyword,
            category=args.category,
            source=args.source,
            labels=args.labels,
        )
    elif args.command == "remote-detail":
        result = client.detail(args.slug, namespace=args.namespace)
        if args.include_files:
            result = {
                "detail": result,
                "files": client.files(
                    args.slug,
                    namespace=args.namespace,
                    version=args.version,
                ),
            }
    elif args.command == "remote-fetch":
        result = client.fetch_snapshot(
            args.slug,
            Path(args.output),
            namespace=args.namespace,
            version=args.version,
            max_files=args.max_files,
            max_file_bytes=args.max_file_bytes,
            max_total_bytes=args.max_total_bytes,
        )
    else:
        raise SkillHubError(f"unknown remote command: {args.command}")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0
