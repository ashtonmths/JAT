"""Leave one line per task id in docs/ROADMAP.yaml after a merge kept both sides of a conflict.

Of two copies, the one with the longer text wins, in the first copy's place. Check the statuses afterwards:
the longer line isn't always the newer one. usage: roadmap_dedupe.py [path]
"""

import re
import sys
from collections import Counter
from pathlib import Path

import yaml

ID = re.compile(r"\s*- \{id: ([\w-]+),")


def dedupe(text: str) -> str:
    lines = text.splitlines(keepends=True)
    best: dict[str, str] = {}
    for line in lines:
        m = ID.match(line)
        if m and len(line) > len(best.get(m.group(1), "")):
            best[m.group(1)] = line
    seen: set[str] = set()
    out = []
    for line in lines:
        m = ID.match(line)
        if not m:
            out.append(line)
        elif m.group(1) not in seen:
            seen.add(m.group(1))
            out.append(best[m.group(1)])
    return "".join(out)


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/ROADMAP.yaml")
    text = dedupe(path.read_text())
    yaml.safe_load(text)
    dupes = [k for k, v in Counter(ID.findall(text)).items() if v > 1]
    if dupes:
        sys.exit(f"still duplicated: {dupes}")
    path.write_text(text)
    print("roadmap ok")


if __name__ == "__main__":
    main()
