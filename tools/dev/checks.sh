#!/bin/bash
# Every check CLAUDE.md (Git) lists, on the current commit, printing PASS or FAIL for each.
# usage: tools/dev/checks.sh [--no-e2e]   (from the checkout's root; --no-e2e when every changed
# file is on CLAUDE.md's browser-test skip list). Takes about 10 minutes with e2e: run it in the background.
source "$(dirname "$0")/env.sh"
case "$*" in
  "" | --no-e2e) ;;
  *) echo "usage: checks.sh [--no-e2e]" >&2; exit 2 ;;
esac
need_root
clean_env
# One heavy run at a time across worktrees, at the lowest CPU and disk priority.
if [ -z "$HEAVY_TESTS_LOCKED" ]; then
  export HEAVY_TESTS_LOCKED=1
  exec flock /tmp/jat-heavy-tests.lock nice -n 19 ionice -c 3 bash "$0" "$@"
fi
echo "commit $(git rev-parse --short HEAD), dirty files: $(git status --short | wc -l)"
pnpm --dir frontend install --frozen-lockfile --silent
fail=0
check() {
  local name=$1 out
  shift
  if out=$("$@" 2>&1); then
    echo "PASS $name: $(echo "$out" | tail -1 | cut -c1-100)"
  else
    echo "FAIL $name"
    echo "$out" | tail -25
    fail=1
  fi
}
check pytest uv run pytest -q
check ruff uv run ruff check src tests scripts tools
check format pnpm --dir frontend format:check
check lint pnpm --dir frontend lint
check typecheck pnpm --dir frontend typecheck
check unit pnpm --dir frontend test
if [ "$1" = "--no-e2e" ]; then
  echo "SKIP e2e (--no-e2e)"
else
  check e2e pnpm --dir frontend e2e
fi
echo "ALL DONE fail=$fail"
exit $fail
