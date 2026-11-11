import subprocess

import pytest

from jat.cli import main
from jat.config import ConfigError, Settings, resolve_data_dir
from jat.datadir import CODE_ROOT, GITATTRIBUTES_ENTRIES, DataDirError, init_data_dir
from jat.db import head_revision


def git_log(repo):
    return subprocess.run(["git", "-C", str(repo), "log", "--format=%s"], capture_output=True, text=True).stdout


def test_init_creates_layout_and_is_idempotent(tmp_path):
    path = tmp_path / "data"
    report = init_data_dir(path)
    assert {"export/", "notes/", "files/", "config.toml"} <= set(report.created)
    assert (path / "notes" / ".gitkeep").exists()
    assert "tracker.sqlite3" in (path / ".gitignore").read_text()
    assert (path / ".gitattributes").read_text(encoding="utf-8").splitlines()[1:] == list(GITATTRIBUTES_ENTRIES)
    assert not report.is_git_repo and not report.committed

    (path / "config.toml").write_text("# edited\n")
    again = init_data_dir(path)
    assert again.created == [] and again.gitignore_added == [] and again.gitattributes_added == []
    assert (path / "config.toml").read_text() == "# edited\n"


def test_gitignore_keeps_existing_lines(tmp_path):
    path = tmp_path / "data"
    path.mkdir()
    (path / ".gitignore").write_text(".idea/\ntracker.sqlite3\n")
    report = init_data_dir(path)
    text = (path / ".gitignore").read_text()
    assert text.startswith(".idea/\n")
    assert text.count("tracker.sqlite3\n") == 1
    assert "tracker.sqlite3" not in report.gitignore_added


def test_gitignore_covers_the_snapshot_lock(tmp_path):
    """Without a .git folder the snapshot lock sits in the data folder itself, so it must be ignored."""
    from jat.platform import LOCK_NAME

    path = tmp_path / "data"
    init_data_dir(path)
    assert LOCK_NAME in (path / ".gitignore").read_text().splitlines()

    # An older data folder gets the entry added on the next run.
    (path / ".gitignore").write_text("tracker.sqlite3\n")
    assert LOCK_NAME in init_data_dir(path).gitignore_added


def test_gitattributes_keeps_existing_lines(tmp_path):
    path = tmp_path / "data"
    path.mkdir()
    (path / ".gitattributes").write_text("*.pdf binary\nexport/** text eol=lf\n", encoding="utf-8-sig")  # Notepad
    report = init_data_dir(path)
    raw = (path / ".gitattributes").read_bytes()
    assert raw.startswith(b"*.pdf binary\nexport/** text eol=lf\n")  # theirs first, BOM gone
    assert b"\r" not in raw
    assert report.gitattributes_added == [e for e in GITATTRIBUTES_ENTRIES if e != "export/** text eol=lf"]


def test_gitattributes_keeps_text_lf_and_uploads_byte_for_byte_under_windows_git(git_repo):
    """Git for Windows converts line endings (core.autocrlf=true); set that here and check what git stores."""
    subprocess.run(["git", "-C", str(git_repo), "config", "core.autocrlf", "true"], check=True)
    init_data_dir(git_repo)
    eml = b"From: a@example.com\r\nSubject: hi\r\n\r\nbody\r\n"
    (git_repo / "files" / "2026").mkdir()
    (git_repo / "files" / "2026" / "mail.eml").write_bytes(eml)
    (git_repo / "files" / "top.eml").write_bytes(eml)
    (git_repo / "notes" / "call.md").write_bytes(b"# Call\r\n\r\nnotes\r\n")  # say an editor saved it with CRLF
    (git_repo / "own.txt").write_bytes(b"the user's own file\r\n")
    subprocess.run(["git", "-C", str(git_repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(git_repo), "commit", "-q", "-m", "x"], check=True)

    def stored(path: str) -> bytes:
        return subprocess.run(
            ["git", "-C", str(git_repo), "show", f"HEAD:{path}"], capture_output=True, check=True
        ).stdout

    assert stored("files/2026/mail.eml") == eml  # byte for byte, nested
    assert stored("files/top.eml") == eml  # and at the top of files/
    assert stored("notes/call.md") == b"# Call\n\nnotes\n"  # LF
    assert stored("own.txt") == b"the user's own file\n"  # the user's own: git's own setting, not ours


def test_a_data_folder_from_before_gets_gitattributes_with_its_next_snapshot(git_repo):
    from jat.db import db_path, make_engine, migrate
    from jat.snapshot.git import SnapshotService

    init_data_dir(git_repo, windows_snapshots=True)
    migrate(db_path(git_repo))
    (git_repo / ".gitattributes").unlink()  # as a folder made before .gitattributes existed
    subprocess.run(["git", "-C", str(git_repo), "commit", "-qam", "no attributes"], check=True)
    SnapshotService(git_repo, make_engine(db_path(git_repo)), debounce_seconds=0, windows_snapshots=True).snapshot_now()
    tracked = subprocess.run(["git", "-C", str(git_repo), "ls-files"], capture_output=True, text=True).stdout
    assert ".gitattributes" in tracked.splitlines()


def test_init_says_it_added_gitattributes(tmp_path, capsys):
    assert main(["--data-dir", str(tmp_path / "d"), "init"]) == 0
    assert "  .gitattributes: added export/** text eol=lf" in capsys.readouterr().out


def test_refuses_data_dir_inside_code_repo():
    with pytest.raises(DataDirError):
        init_data_dir(CODE_ROOT / "data")
    with pytest.raises(DataDirError):
        init_data_dir(CODE_ROOT)


def test_commits_scaffold_in_git_repo(git_repo):
    (git_repo / "README.md").write_text("mine\n")  # untracked user file must not be committed
    report = init_data_dir(git_repo, windows_snapshots=True)  # on Windows only with the switch (test_snapshots)
    assert report.is_git_repo and report.committed
    assert "initialise job-application-tracker data layout" in git_log(git_repo)
    tracked = subprocess.run(["git", "-C", str(git_repo), "ls-files"], capture_output=True, text=True).stdout
    assert "README.md" not in tracked
    assert "config.toml" in tracked and ".gitattributes" in tracked and "notes/.gitkeep" in tracked
    assert init_data_dir(git_repo).committed is False


def test_resolve_data_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("JAT_DATA_DIR", raising=False)
    monkeypatch.chdir(tmp_path)  # no .env here
    with pytest.raises(ConfigError):
        resolve_data_dir(Settings())
    monkeypatch.setenv("JAT_DATA_DIR", str(tmp_path / "d"))
    assert resolve_data_dir(Settings()) == (tmp_path / "d").resolve()


def test_cli_init_and_errors(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("JAT_DATA_DIR", raising=False)
    monkeypatch.chdir(tmp_path)
    assert main(["init"]) == 2
    assert "No data directory configured" in capsys.readouterr().err
    assert main(["--data-dir", str(tmp_path / "d"), "init"]) == 0
    assert "not a git repo" in capsys.readouterr().out
    assert main(["--data-dir", str(CODE_ROOT), "init"]) == 2


def test_cli_init_creates_db_and_export_restore(tmp_path, capsys):
    d = str(tmp_path / "d")
    assert main(["--data-dir", d, "init"]) == 0
    assert (tmp_path / "d" / "tracker.sqlite3").exists()
    assert main(["--data-dir", d, "export"]) == 0
    assert main(["--data-dir", d, "restore"]) == 2  # refuses: database exists
    assert main(["--data-dir", d, "restore", "--force"]) == 0
    assert main(["--data-dir", d, "info"]) == 0
    assert f"schema {head_revision()}" in capsys.readouterr().out


def test_cli_init_restores_fresh_clone(tmp_path, capsys):
    d = tmp_path / "d"
    assert main(["--data-dir", str(d), "init"]) == 0
    assert main(["--data-dir", str(d), "export"]) == 0
    (d / "tracker.sqlite3").unlink()
    for extra in d.glob("tracker.sqlite3-*"):
        extra.unlink()
    capsys.readouterr()
    assert main(["--data-dir", str(d), "init"]) == 0
    assert "restored from export/" in capsys.readouterr().out


def test_cli_export_needs_db(tmp_path):
    assert main(["--data-dir", str(tmp_path / "none"), "export"]) == 2
