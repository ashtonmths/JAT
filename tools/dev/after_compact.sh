#!/bin/bash
# Print the maintainer's resume notes (docs/agents/) so they're in the context after a compaction.
# Run by a Claude Code SessionStart hook on "compact": .claude/settings.json for sessions started in the repo, and
# with --user from Kai's user settings for a session started elsewhere that works in this repo. Hook input (JSON with
# "cwd") arrives on stdin. It reads the main checkout's copy, which has the latest merged notes.
# Test: echo '{"cwd":"<a path in the repo>"}' | tools/dev/after_compact.sh [--user]
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
input="$(cat)"
if [ "$1" = "--user" ]; then
  # The project hook covers sessions started in the repo; don't print twice.
  case "$(cd "${CLAUDE_PROJECT_DIR:-/}" 2>/dev/null && pwd -P)" in "$HERE" | "$HERE"/*) exit 0 ;; esac
  cwd="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)"
  case "$(cd "${cwd:-/}" 2>/dev/null && pwd -P)" in "$HERE" | "$HERE"/*) ;; *) exit 0 ;; esac
fi
MAIN="$(git -C "$HERE" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')"
DOCS="${MAIN:-$HERE}/docs/agents"
[ -f "$DOCS/README.md" ] || DOCS="$HERE/docs/agents"
echo "# After compaction: the maintainer's notes ($DOCS)"
echo "Read these before doing anything else; CLAUDE.md wins on any conflict."
for f in README.md now.md working-with-kai.md gotchas.md decisions.md; do
  [ -f "$DOCS/$f" ] || continue
  printf '\n===== docs/agents/%s =====\n\n' "$f"
  cat "$DOCS/$f"
done
