#!/bin/bash
# The browser suite alone on the current commit: a rerun after a failure that wasn't the PR's (a known flaky test).
source "$(dirname "$0")/env.sh"
need_root
clean_env
echo "commit $(git rev-parse --short HEAD), dirty files: $(git status --short | wc -l)"
pnpm --dir frontend e2e 2>&1 | tail -15
