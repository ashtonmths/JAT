"""Platform detection and platform-specific primitives (docs/rfc/windows.md)."""

from __future__ import annotations

import contextlib
import sys
from collections.abc import Iterator
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None  # None on Windows; step 1 treats lock as no-op until step 2 adds msvcrt lock

IS_WINDOWS: bool = sys.platform == "win32"
LOCK_NAME: str = "jat-snapshot.lock"


def snapshots_allowed(windows_snapshots: bool = False) -> bool:
    """Whether automatic git snapshots and scaffold commits are allowed on this platform.

    On Linux and macOS, snapshots are always allowed.
    On Windows (step 1), snapshots are off by default unless explicitly enabled
    for testing via JAT_WINDOWS_SNAPSHOTS=1. Step 2 re-enables them on Windows.
    """
    if not IS_WINDOWS:
        return True
    return bool(windows_snapshots)


@contextlib.contextmanager
def process_lock(data_dir: Path) -> Iterator[None]:
    """Exclusive process lock around data directory snapshots and exports.

    On Linux and macOS, takes an exclusive flock via fcntl.
    On Windows in step 1, this is a no-op until step 2 adds the msvcrt lock.
    """
    if fcntl is not None:
        git_dir = data_dir / ".git"
        lock_path = (git_dir if git_dir.is_dir() else data_dir) / LOCK_NAME
        with open(lock_path, "w") as fh:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                fcntl.flock(fh, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(fh, fcntl.LOCK_UN)
    else:
        yield
