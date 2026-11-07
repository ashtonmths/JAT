#!/bin/bash
# Format, typecheck and lint the browser tests, build once if needed, then run one spec and show only the failures.
# usage: tools/dev/e2e_spec.sh <spec file name, e.g. people.spec.ts> [max lines, default 60]
# The output is cut down: read all of it before trusting a pass.
# It runs through `pnpm e2e`, so it takes the test lock and limits workers like any browser run.
source "$(dirname "$0")/env.sh"
[ -n "$1" ] || { echo "usage: e2e_spec.sh <spec file name> [max lines]" >&2; exit 2; }
cd "$(git rev-parse --show-toplevel)/frontend" || exit 1
[ -d node_modules ] || pnpm install --frozen-lockfile --silent
pnpm exec prettier --write e2e >/dev/null
pnpm exec tsc --noEmit | cut -c1-220 | head -12
pnpm exec eslint e2e | cut -c1-200 | head -12
[ -f dist/index.html ] || pnpm build 2>&1 | tail -1
pnpm e2e "e2e/$1" 2>&1 \
  | grep -E "^\s+✘|^\s+[0-9]+ (passed|failed|flaky|skipped)|^\s+(Error|Locator|Expected|Received|Timed out)|strict mode|waiting for|nothing should|^\s+\+ +\"" \
  | cut -c1-190 | head -"${2:-60}"
