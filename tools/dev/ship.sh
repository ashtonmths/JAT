#!/bin/bash
# After a PR merged: update the main checkout, remove the PR's worktree and branch, then (with a version) tag the
# merge commit, publish the GitHub release with that version's CHANGELOG section, and rebuild the frontend so
# Kai's tracker serves it. Run from the main checkout's root.
# usage: tools/dev/ship.sh <version|-> <pr> <worktree folder> [<branch>]
#   "-" for the version skips the tag and release (internal PRs, draft translations).
#   A worktree folder that doesn't exist (e.g. keep-agent-worktree) leaves a builder's worktree in place.
set -e
source "$(dirname "$0")/env.sh"
[ "$(pwd -P)" = "$MAIN" ] || { echo "Run this from the main checkout ($MAIN)." >&2; exit 2; }
V=${1#v} N=$2 W=$3
[ -n "$W" ] || { echo "usage: ship.sh <version|-> <pr> <worktree folder> [<branch>]" >&2; exit 2; }
SHA=$(gh pr view "$N" --json mergeCommit -q .mergeCommit.oid)
[ -n "$SHA" ] || { echo "PR $N has no merge commit"; exit 1; }
git pull -q --ff-only
git worktree remove --force ".claude/worktrees/$W" 2>/dev/null || echo "worktree $W not removed (missing or locked)"
git branch -D "${4:-worktree-$W}" >/dev/null 2>&1 || true
git fetch -q --prune
if [ "$V" != "-" ]; then
  NOTES=$(mktemp)
  trap 'rm -f "$NOTES"' EXIT
  uv run python "$DEV/release_notes.py" "$V" "$NOTES"
  git tag -a "v$V" "$SHA" -m "v$V"
  git push -q origin "v$V"
  gh release create "v$V" --title "v$V" --notes-file "$NOTES" --verify-tag
  rm -f "$NOTES"
fi
pnpm --dir frontend install --frozen-lockfile --silent
pnpm --dir frontend build 2>&1 | tail -1
git log --oneline -1
curl -s -o /dev/null -w "tracker %{http_code}\n" http://127.0.0.1:8770/api/v1/health || true
git worktree list
