"""README.zh-CN.md keeps step with README.md (CLAUDE.md "Languages: keep them in step").

A light check, not a translation check: the same number of ## sections, and the same images, the
Chinese README's from docs/screenshots/zh-CN/ wherever there's a Chinese one. Skipped until
README.zh-CN.md exists.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
ENGLISH = ROOT / "README.md"
CHINESE = ROOT / "README.zh-CN.md"
ZH_SHOTS = "docs/screenshots/zh-CN/"
# Images the Chinese README may show in English: the language menu lists each language in itself.
SHARED = {"docs/screenshots/language-menu.png"}

IMAGE = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)|<img\b[^>]*\bsrc=[\"']([^\"']+)", re.IGNORECASE)
FENCE = re.compile(r"^(```|~~~).*?^\1", re.MULTILINE | re.DOTALL)
HINT = (
    "A PR that changes README.md changes README.zh-CN.md to match, and the other way round "
    "(CLAUDE.md, CONTRIBUTING.md 'Pull requests')."
)


def sections(text: str) -> list[str]:
    """The ## headings, leaving out lines in code blocks (a shell comment there starts with #)."""
    return re.findall(r"^## .+$", FENCE.sub("", text), re.MULTILINE)


def images(text: str) -> list[str]:
    """Local image paths (badges and other URLs left out), in order."""
    found = (m.group(1) or m.group(2) for m in IMAGE.finditer(FENCE.sub("", text)))
    return [path.removeprefix("./") for path in found if "://" not in path]


def shared(path: str) -> str:
    """A Chinese copy of a shared image counts as the shared one."""
    english = path.replace(ZH_SHOTS, "docs/screenshots/", 1)
    return english if english in SHARED else path


def problems(english: str, chinese: str) -> list[str]:
    out = []
    ours, theirs = sections(english), sections(chinese)
    if len(ours) != len(theirs):
        out.append(f"README.md has {len(ours)} ## sections and README.zh-CN.md {len(theirs)}")
    want = {path if path in SHARED else path.replace("docs/screenshots/", ZH_SHOTS, 1) for path in images(english)}
    have = {shared(path) for path in images(chinese)}
    if missing := sorted(want - have):
        out.append(f"README.zh-CN.md lacks images README.md shows: {', '.join(missing)}")
    if extra := sorted(have - want):
        out.append(
            f"README.zh-CN.md shows images README.md doesn't (or an English path for a Chinese one): {', '.join(extra)}"
        )
    return out


@pytest.mark.skipif(not CHINESE.exists(), reason="README.zh-CN.md isn't in the repo yet")
def test_the_two_readmes_match():
    found = problems(ENGLISH.read_text(encoding="utf-8"), CHINESE.read_text(encoding="utf-8"))
    assert not found, "\n".join([*found, HINT])


EN = """# Title
![Tour](docs/screenshots/demo.gif)
## One
<img src="docs/screenshots/board.png" width="400">
## Two
```bash
## not a section
```
![Menu](docs/screenshots/language-menu.png)
[![Badge](https://img.shields.io/badge/x.svg)](https://example.com)
"""


def test_matching_readmes_pass():
    zh = EN.replace("docs/screenshots/demo.gif", "docs/screenshots/zh-CN/demo.gif").replace(
        "docs/screenshots/board.png", "docs/screenshots/zh-CN/board.png"
    )
    assert problems(EN, zh) == []
    # The language menu may be retaken in Chinese too.
    assert problems(EN, zh.replace("screenshots/language-menu", "screenshots/zh-CN/language-menu")) == []


def test_a_missing_section_or_image_fails():
    zh = EN.replace("docs/screenshots/demo.gif", "docs/screenshots/zh-CN/demo.gif")
    zh = zh.replace("## Two\n", "").replace('<img src="docs/screenshots/board.png" width="400">', "")
    assert problems(EN, zh) == [
        "README.md has 2 ## sections and README.zh-CN.md 1",
        "README.zh-CN.md lacks images README.md shows: docs/screenshots/zh-CN/board.png",
    ]


def test_an_english_screenshot_in_the_chinese_readme_fails():
    zh = EN.replace("docs/screenshots/board.png", "docs/screenshots/zh-CN/board.png")
    assert problems(EN, zh) == [
        "README.zh-CN.md lacks images README.md shows: docs/screenshots/zh-CN/demo.gif",
        "README.zh-CN.md shows images README.md doesn't (or an English path for a Chinese one): "
        "docs/screenshots/demo.gif",
    ]
