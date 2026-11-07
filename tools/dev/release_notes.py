"""Write one version's CHANGELOG section as release notes, with repo-relative links made absolute.

usage: release_notes.py <X.Y.Z> <out file> [changelog path]
"""

import re
import sys
from pathlib import Path

BASE = "https://github.com/waddington/job-application-tracker/blob/main/"


def section(changelog: str, version: str) -> str:
    start = changelog.index(f"## {version} ")
    body = changelog[start:].split("\n", 1)[1]
    end = body.find("\n## ")
    body = body if end < 0 else body[:end]
    body = re.sub(r"\]\((?!https?://|#|mailto:)([^)]+)\)", lambda m: f"]({BASE}{m.group(1)})", body)
    return body.strip() + "\n"


def main() -> None:
    version, out = sys.argv[1:3]
    path = Path(sys.argv[3] if len(sys.argv) > 3 else "CHANGELOG.md")
    Path(out).write_text(section(path.read_text(), version))


if __name__ == "__main__":
    main()
