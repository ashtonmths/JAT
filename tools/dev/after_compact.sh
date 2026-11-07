#!/bin/bash
# Tell the session, right after a compaction, to read the maintainer's notes (docs/agents/) before anything else.
# Run by a Claude Code SessionStart hook on "compact": .claude/settings.json for sessions started in the repo, and
# with --user from Kai's user settings for a session started elsewhere that works in this repo. Hook input (JSON with
# "cwd") arrives on stdin. It prints a short instruction with absolute paths rather than the files themselves: hook
# output past about 10,000 characters is cut to a preview, and the five files are about 35,000.
# Test: echo '{"cwd":"<a path in the repo>"}' | tools/dev/after_compact.sh [--user]
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
input="$(cat)"
if [ "$1" = "--user" ]; then
  # The project hook covers sessions started in the repo; don't print twice.
  case "$(cd "${CLAUDE_PROJECT_DIR:-/}" 2>/dev/null && pwd -P)" in "$HERE" | "$HERE"/*) exit 0 ;; esac
  cwd="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)"
  case "$(cd "${cwd:-/}" 2>/dev/null && pwd -P)" in "$HERE" | "$HERE"/*) ;; *) exit 0 ;; esac
fi
# The main checkout has the latest merged notes.
MAIN="$(git -C "$HERE" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')"
DOCS="${MAIN:-$HERE}/docs/agents"
[ -f "$DOCS/README.md" ] || DOCS="$HERE/docs/agents"
cat <<EOF
# After compaction: read the maintainer's notes first

Before replying or doing anything else, read these five files in full with the Read tool (CLAUDE.md wins on any
conflict). They hold what the summary leaves out on purpose:

- $DOCS/README.md (what to read for which task)
- $DOCS/now.md (state and live plan; its "Next" section is the default next action)
- $DOCS/working-with-kai.md (Kai's standing instructions)
- $DOCS/gotchas.md (mistakes already made once)
- $DOCS/decisions.md (decisions not to re-litigate)

Then check \`gh pr list\`, \`git worktree list\` and \`git log --oneline -5\`, and carry on with Kai's latest request.
EOF
