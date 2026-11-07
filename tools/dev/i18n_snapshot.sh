#!/bin/bash
# The before/after text check: snapshot every view's text with main's build, then with this branch's, on one
# throwaway demo folder, and diff them. It must print "0 view parts differ" (or only intended changes) and no
# view "couldn't open". Build both frontends first (pnpm --dir frontend build, here and in the main checkout).
# usage: [SNAP_PORT=8889] tools/dev/i18n_snapshot.sh   (from the branch's worktree root)
# A run across the top of an hour can differ on the call form's default time, and across midnight on "Today".
source "$(dirname "$0")/env.sh"
need_root
clean_env
WT=$(pwd -P)
DIR=$(mktemp -d /tmp/jat-snap-XXXXXX)
PORT=${SNAP_PORT:-8889}
SNAP="$WT/scripts/i18n/text_snapshot.py"
uv run python scripts/seed_demo.py "$DIR/demo" >/dev/null 2>&1
take() { # <checkout to serve from> <output file>
  cd "$1" || exit 1
  setsid uv run jat --data-dir "$DIR/demo" serve --host 127.0.0.1 --port "$PORT" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null && break; sleep 0.1; done
  (cd "$WT" && uv run --with playwright python "$SNAP" "http://127.0.0.1:$PORT" "$2") 2>&1 | tail -3 | cut -c1-160
  kill -- -"$pid" 2>/dev/null
  sleep 1
}
take "$MAIN" "$DIR/before.json"
take "$WT" "$DIR/after.json"
cd "$WT" && python3 scripts/i18n/text_diff.py "$DIR/before.json" "$DIR/after.json" | cut -c1-220 | tail -25
rm -rf "$DIR"
