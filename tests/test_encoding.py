"""Tests for UTF-8 encoding across files, settings, git, and schema."""

from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

from jat.config import Settings
from jat.datadir import _ensure_gitignore, init_data_dir
from jat.db import head_revision
from jat.domain.workflow import load_workflow
from jat.openapi import main as openapi_main
from jat.snapshot.export import _read_export
from jat.snapshot.git import _git, debounce_from_config
from jat.storage.notes import NoteStore


def test_source_code_text_io_names_encoding():
    """Fail on any text read or write in src/jat that doesn't name an encoding.

    Ensures that code written on Linux/macOS (where UTF-8 is the system default)
    never accidentally relies on the default encoding, keeping Windows working.
    """
    root = Path(__file__).resolve().parents[1] / "src" / "jat"
    violations: list[str] = []

    for path in sorted(root.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            if func_name in ("read_text", "write_text"):
                has_encoding = any(kw.arg == "encoding" for kw in node.keywords) or (
                    func_name == "read_text" and len(node.args) >= 1
                )
                if not has_encoding:
                    violations.append(f"{path.relative_to(root)}:{node.lineno}: {func_name}() missing encoding")

            elif func_name == "open":
                # Check mode argument to see if it's binary mode.
                # Builtin open(file, mode="r", ...) has mode at args[1].
                # Path.open(mode="r", ...) has mode at args[0].
                is_binary = False
                for arg in node.args[:2]:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str) and "b" in arg.value:
                        is_binary = True
                for kw in node.keywords:
                    if (
                        kw.arg == "mode"
                        and isinstance(kw.value, ast.Constant)
                        and isinstance(kw.value.value, str)
                        and "b" in kw.value.value
                    ):
                        is_binary = True

                if not is_binary:
                    has_encoding = any(kw.arg == "encoding" for kw in node.keywords)
                    if not has_encoding:
                        violations.append(f"{path.relative_to(root)}:{node.lineno}: open() missing encoding")

    assert not violations, "Found text I/O calls without explicit encoding:\n" + "\n".join(violations)


def test_config_toml_utf8_and_bom(tmp_path: Path):
    """config.toml can contain non-ASCII characters and may start with a UTF-8 BOM."""
    config_content = (
        "[workflow]\n"
        'initial = "candidature"\n'
        "[[workflow.stages]]\n"
        'id = "candidature"\n'
        'name = "Candidature déposée"\n'
        "[[workflow.stages]]\n"
        'id = "entretien"\n'
        'name = "Entretien technique — café & démo"\n'
    )
    # 1. Plain UTF-8 without BOM
    config_file = tmp_path / "config.toml"
    config_file.write_text(config_content, encoding="utf-8")
    wf1 = load_workflow(tmp_path)
    assert len(wf1.stages) == 2
    assert wf1.stages[1].name == "Entretien technique — café & démo"

    # 2. UTF-8 with BOM (Notepad on Windows adds \ufeff)
    config_file.write_text(config_content, encoding="utf-8-sig")
    assert config_file.read_bytes().startswith(b"\xef\xbb\xbf")
    wf2 = load_workflow(tmp_path)
    assert len(wf2.stages) == 2
    assert wf2.stages[1].name == "Entretien technique — café & démo"


def test_debounce_from_config_utf8_and_bom(tmp_path: Path):
    """debounce_from_config handles UTF-8 BOM from Windows editors."""
    config_file = tmp_path / "config.toml"
    config_content = "[snapshot]\ndebounce_seconds = 42\n# Commentaire: réactivité\n"
    config_file.write_text(config_content, encoding="utf-8-sig")
    assert debounce_from_config(tmp_path) == 42.0


def test_env_file_utf8(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Settings reads .env files with UTF-8 characters."""
    monkeypatch.chdir(tmp_path)
    env_file = tmp_path / ".env"
    # Write a .env file with UTF-8 comments and values
    env_file.write_text("JAT_HOST=127.0.0.1\n# Données d'application: Montréal\n", encoding="utf-8")
    settings = Settings()
    assert settings.host == "127.0.0.1"


def test_ensure_gitignore_utf8_and_bom(tmp_path: Path):
    """.gitignore can be read with BOM and preserves UTF-8 characters."""
    gitignore = tmp_path / ".gitignore"
    gitignore.write_text("# Fichiers ignorés: temporaires\n.custom_cache\n", encoding="utf-8-sig")
    added = _ensure_gitignore(tmp_path)
    assert "tracker.sqlite3" in added
    content = gitignore.read_text(encoding="utf-8")
    assert "# Fichiers ignorés: temporaires" in content
    assert "tracker.sqlite3" in content
    # Ensure line endings are LF
    raw = gitignore.read_bytes()
    assert b"\r\n" not in raw


def test_init_data_dir_writes_utf8_and_lf(tmp_path: Path):
    """init_data_dir writes config.toml with UTF-8 and LF endings."""
    data_dir = tmp_path / "test_data"
    init_data_dir(data_dir, commit=False)
    config_bytes = (data_dir / "config.toml").read_bytes()
    assert b"\r\n" not in config_bytes
    assert (data_dir / "config.toml").read_text(encoding="utf-8")


def test_export_meta_utf8(tmp_path: Path):
    """_read_export loads _meta.json containing non-ASCII UTF-8 characters."""
    meta = {
        "format": 1,
        "schema_revision": head_revision(),
        "exported_at": "2026-11-09T12:00:00Z",
        "note": "Sauvegarde des candidatures — Zürich",
        "tables": {},
    }
    (tmp_path / "_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    rev, rows = _read_export(tmp_path)
    assert rev == head_revision()
    assert rows == {}


def test_notes_storage_utf8_and_bom(tmp_path: Path):
    """NoteStore reads notes with UTF-8 and UTF-8 BOM from Windows editors."""
    notes_dir = tmp_path / "notes" / "2026/11"
    notes_dir.mkdir(parents=True)
    note_path = notes_dir / "note-1-test.md"

    # Note with frontmatter and BOM
    raw_content = (
        "---\n"
        "id: note-1\n"
        "title: Entretien d'embauche — Zürich & München\n"
        "links: []\n"
        "created: '2026-11-09T10:00:00Z'\n"
        "updated: '2026-11-09T10:00:00Z'\n"
        "---\n"
        "Compte rendu de l'échange avec l'équipe d'ingénierie.\n"
    )
    note_path.write_text(raw_content, encoding="utf-8-sig")
    assert note_path.read_bytes().startswith(b"\xef\xbb\xbf")

    store = NoteStore(tmp_path)
    note = store.read("2026/11/note-1-test.md")
    assert note.id == "note-1"
    assert note.title == "Entretien d'embauche — Zürich & München"
    assert "Compte rendu" in note.body


def test_openapi_main_writes_utf8_and_lf(tmp_path: Path):
    """jat.openapi writes openapi.json in UTF-8 with LF line endings."""
    out_file = tmp_path / "openapi.json"
    openapi_main([str(out_file)])
    raw_bytes = out_file.read_bytes()
    assert b"\r\n" not in raw_bytes
    text = out_file.read_text(encoding="utf-8")
    assert "Job Application Tracker" in text


def test_git_output_decodes_utf8(tmp_path: Path):
    """_git correctly decodes non-ASCII UTF-8 output from git commands."""
    import subprocess

    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "config", "user.name", "Test User"], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "config", "user.email", "test@example.com"], check=True)

    test_file = tmp_path / "test.txt"
    test_file.write_text("Données de test\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(tmp_path), "add", "test.txt"], check=True)
    commit_msg = "feat: ajout des données de test — résumé & notes"
    subprocess.run(["git", "-C", str(tmp_path), "commit", "-q", "-m", commit_msg], check=True)

    result = _git(tmp_path, "log", "-1", "--pretty=%B")
    assert result.returncode == 0
    assert "résumé & notes" in result.stdout
