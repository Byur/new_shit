from __future__ import annotations

import hashlib
import importlib.util
import json
import ssl
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.error import URLError


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "skillhub_client.py"
SPEC = importlib.util.spec_from_file_location("skillhub_client", SCRIPT)
assert SPEC and SPEC.loader
skillhub_client = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = skillhub_client
SPEC.loader.exec_module(skillhub_client)


class FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def read(self, size: int = -1) -> bytes:
        return self.payload if size < 0 else self.payload[:size]


class RecordingOpener:
    def __init__(self, payload: dict) -> None:
        self.payload = json.dumps(payload).encode("utf-8")
        self.urls: list[str] = []

    def open(self, request, timeout: int):
        self.urls.append(request.full_url)
        return FakeResponse(self.payload)


class CertificateFailingOpener:
    def open(self, request, timeout: int):
        raise URLError(ssl.SSLCertVerificationError("CERTIFICATE_VERIFY_FAILED"))


class SnapshotClient(skillhub_client.SkillHubClient):
    def __init__(self, files: dict[str, bytes]) -> None:
        self.source_files = files

    def detail(self, slug: str, *, namespace: str = "") -> dict:
        return {
            "skill": {"slug": slug, "summary": "Remote test Skill"},
            "namespace": {"handle": namespace or "remote-owner"},
            "latestVersion": {"version": "1.2.3"},
        }

    def files(self, slug: str, *, namespace: str = "", version: str = "") -> dict:
        return {
            "files": [
                {
                    "path": path,
                    "size": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
                for path, content in self.source_files.items()
            ]
        }

    def file_bytes(
        self,
        slug: str,
        remote_path: str,
        *,
        namespace: str = "",
        version: str = "",
        max_bytes: int = skillhub_client.DEFAULT_MAX_FILE_BYTES,
    ) -> bytes:
        return self.source_files[remote_path]


class SkillHubClientTests(unittest.TestCase):
    def test_search_uses_fixed_public_api_and_encoded_query(self) -> None:
        opener = RecordingOpener({"results": []})
        client = skillhub_client.SkillHubClient(opener=opener)
        self.assertEqual(client.search("PDF 中文", limit=7), {"results": []})
        self.assertEqual(len(opener.urls), 1)
        self.assertTrue(opener.urls[0].startswith("https://api.skillhub.cn/api/v1/search?"))
        self.assertIn("q=PDF+%E4%B8%AD%E6%96%87", opener.urls[0])
        self.assertIn("limit=7", opener.urls[0])

    def test_list_supports_marketplace_filters(self) -> None:
        opener = RecordingOpener({"code": 0, "data": {"skills": [], "total": 0}})
        client = skillhub_client.SkillHubClient(opener=opener)
        result = client.list_skills(
            page=2,
            page_size=15,
            sort_by="score",
            order="desc",
            keyword="PDF",
            category="office-efficiency",
            source="community",
        )
        self.assertEqual(result["data"]["total"], 0)
        url = opener.urls[0]
        self.assertIn("/api/skills?", url)
        self.assertIn("page=2", url)
        self.assertIn("pageSize=15", url)
        self.assertIn("sortBy=score", url)
        self.assertIn("category=office-efficiency", url)

    def test_certificate_failure_uses_verified_system_transport(self) -> None:
        requests: list[tuple[str, int, int]] = []

        def system_transport(url: str, *, timeout: int, max_bytes: int) -> bytes:
            requests.append((url, timeout, max_bytes))
            return b'{"results": []}'

        client = skillhub_client.SkillHubClient(
            opener=CertificateFailingOpener(),
            curl_transport=system_transport,
        )
        self.assertEqual(client.search("remote skill"), {"results": []})
        self.assertEqual(len(requests), 1)
        self.assertTrue(requests[0][0].startswith("https://api.skillhub.cn/api/v1/search?"))

    def test_remote_paths_and_redirect_hosts_are_restricted(self) -> None:
        with self.assertRaisesRegex(skillhub_client.SkillHubError, "unsafe remote file path"):
            skillhub_client._validate_remote_path("../SKILL.md")
        with self.assertRaisesRegex(skillhub_client.SkillHubError, "refused"):
            skillhub_client._validate_https_url("https://example.com/skill.zip")
        skillhub_client._validate_https_url(
            "https://skillhub-123.cos.accelerate.myqcloud.com/skills/a/SKILL.md"
        )

    def test_fetch_snapshot_verifies_hashes_and_writes_inert_source(self) -> None:
        source = {
            "SKILL.md": b"---\nname: remote-test\ndescription: Test remote Skill.\n---\n",
            "scripts/check.py": b"print('not executed')\n",
        }
        client = SnapshotClient(source)
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "snapshot"
            result = client.fetch_snapshot(
                "remote-test",
                destination,
                namespace="remote-owner",
            )
            self.assertEqual(result["downloadedFileCount"], 2)
            self.assertEqual((destination / "SKILL.md").read_bytes(), source["SKILL.md"])
            self.assertEqual(
                (destination / "scripts" / "check.py").read_bytes(),
                source["scripts/check.py"],
            )
            metadata = json.loads(
                (destination / ".skillhub-source.json").read_text(encoding="utf-8")
            )
            self.assertIs(metadata["fetchedAsUntrustedData"], True)
            self.assertEqual(metadata["source"], "skillhub.cn")

    def test_fetch_snapshot_refuses_nonempty_output(self) -> None:
        source = {"SKILL.md": b"---\nname: remote-test\n---\n"}
        client = SnapshotClient(source)
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "snapshot"
            destination.mkdir()
            (destination / "existing.txt").write_text("keep", encoding="utf-8")
            with self.assertRaisesRegex(skillhub_client.SkillHubError, "not empty"):
                client.fetch_snapshot("remote-test", destination)
            self.assertEqual(
                (destination / "existing.txt").read_text(encoding="utf-8"),
                "keep",
            )


if __name__ == "__main__":
    unittest.main()
