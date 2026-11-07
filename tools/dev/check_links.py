"""Check relative Markdown links and #anchors (GitHub-style) in the README, the guide and other docs.

usage: python3 tools/dev/check_links.py [file.md ...]   (from the checkout's root; default: README.md and docs/guide/)
Prints each broken link and "bad links: N"; exits 1 if any.
"""

import re
import sys
from pathlib import Path


def slug(heading: str) -> str:
    h = heading.strip().lower()
    h = re.sub(r"[^\w\- ]", "", h)
    return h.replace(" ", "-")


def anchors(path: Path) -> set[str]:
    return {slug(m.group(1)) for line in path.read_text().splitlines() if (m := re.match(r"#+ (.*)", line))}


def broken(f: Path) -> list[str]:
    out = []
    for target in re.findall(r"\]\(([^)\s]+)\)", f.read_text()):
        if re.match(r"https?:|mailto:", target):
            continue
        file_part, _, anchor = target.partition("#")
        dest = (f.parent / file_part).resolve() if file_part else f.resolve()
        if not dest.exists():
            out.append(f"{f}: missing file {target}")
        elif anchor and dest.suffix == ".md" and anchor not in anchors(dest):
            out.append(f"{f}: missing anchor {target}")
    return out


def main() -> None:
    files = [Path(a) for a in sys.argv[1:]] or [Path("README.md"), *sorted(Path("docs/guide").glob("*.md"))]
    bad = [line for f in files for line in broken(f)]
    for line in bad:
        print(line)
    print("bad links:", len(bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
