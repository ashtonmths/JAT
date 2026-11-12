"""The pure parts of the maintainer scripts in tools/dev."""

from pathlib import Path

import pytest

from tools.dev import bump, check_links, release_notes, roadmap_dedupe


def test_dedupe_keeps_the_longer_line_in_the_first_place():
    text = (
        "phases:\n"
        "  - id: P7\n"
        "    tasks:\n"
        "      - {id: a, name: A, status: done}\n"
        "      - {id: b, name: B, status: planned}\n"
        "      - {id: a, name: A with more detail, status: building}\n"
    )
    out = roadmap_dedupe.dedupe(text)
    assert out.splitlines()[3] == "      - {id: a, name: A with more detail, status: building}"
    assert out.count("{id: a,") == 1
    assert "{id: b," in out


def test_release_notes_make_relative_links_absolute():
    changelog = (
        "# Changelog\n\n## 1.2.0 (2026-11-07)\n\n- New [guide](docs/guide/README.md), "
        "[site](https://example.com), [here](#top) (#5).\n\n## 1.1.0 (2026-11-01)\n\n- Old.\n"
    )
    notes = release_notes.section(changelog, "1.2.0")
    assert "](https://github.com/waddington/job-application-tracker/blob/main/docs/guide/README.md)" in notes
    assert "](https://example.com)" in notes
    assert "](#top)" in notes
    assert "Old." not in notes


def test_bump_versions_and_changelog():
    assert bump.next_version("1.19.3", minor=False) == "1.19.4"
    assert bump.next_version("1.19.3", minor=True) == "1.20.0"
    text = "# Changelog\n\n## 1.19.3 (2026-11-06)\n\n- Old.\n"
    out = bump.changelog_with(text, "1.19.3", "1.19.4", "Fixes a thing", "12", "2026-11-07")
    assert out.startswith("# Changelog\n\n## 1.19.4 (2026-11-07)\n\n- Fixes a thing (#12).\n\n## 1.19.3 (")
    with pytest.raises(SystemExit):
        bump.changelog_with(text, "1.0.0", "1.0.1", "x", "1", "2026-11-07")


def test_check_links_finds_missing_files_and_anchors(tmp_path: Path):
    (tmp_path / "b.md").write_text("# Getting started, quickly\n")
    a = tmp_path / "a.md"
    a.write_text("[ok](b.md#getting-started-quickly) [gone](c.md) [bad](b.md#nope) [web](https://example.com)\n")
    assert check_links.slug("Getting started, quickly") == "getting-started-quickly"
    assert check_links.broken(a) == [f"{a}: missing file c.md", f"{a}: missing anchor b.md#nope"]


UV_LOCK = (
    '[[package]]\nname = "anyio"\nversion = "1.24.7"\n\n'
    '[[package]]\nname = "job-application-tracker"\nversion = "1.24.7"\nsource = { editable = "." }\n'
)


def test_version_only_accepts_just_the_bump_line():
    from tools.dev import version_only

    want = version_only.expected("uv.lock", UV_LOCK, "1.24.7", "1.24.8")
    assert want is not None
    assert 'name = "anyio"\nversion = "1.24.7"' in want  # a dependency sharing the number stays as it was
    assert 'name = "job-application-tracker"\nversion = "1.24.8"' in want
    init = '"""jat."""\n\n__version__ = "1.24.7"\n'
    assert version_only.expected("src/jat/__init__.py", init, "1.24.7", "1.24.8") == init.replace("1.24.7", "1.24.8")
    pkg = '{\n  "name": "jat",\n  "version": "1.24.7",\n  "dependencies": { "x": "1.24.7" }\n}\n'
    out = version_only.expected("frontend/package.json", pkg, "1.24.7", "1.24.8")
    assert out == pkg.replace('"version": "1.24.7"', '"version": "1.24.8"')


def test_version_only_refuses_unknown_files_and_a_missing_or_doubled_line():
    from tools.dev import version_only

    assert version_only.expected("frontend/src/App.tsx", "x", "1.0.0", "1.0.1") is None
    assert version_only.expected("pyproject.toml", 'name = "x"\n', "1.0.0", "1.0.1") is None
    doubled = 'version = "1.0.0"\nversion = "1.0.0"\n'
    assert version_only.expected("pyproject.toml", doubled, "1.0.0", "1.0.1") is None
    assert version_only.expected("frontend/src/api/schema.d.ts", "types", "1.0.0", "1.0.1") == "types"


def test_version_only_refuses_anything_but_a_plain_version():
    from tools.dev import version_only

    init = '__version__ = "1.24.7"\n'
    sneaky = '1.24.8"; import os; x = "'
    assert version_only.expected("src/jat/__init__.py", init, "1.24.7", sneaky) is None
    assert version_only.expected("src/jat/__init__.py", init, "1.24", "1.24.8") is None
