#!/bin/bash
# Wait for a PR to be mergeable, merge it (merge commit, branch deleted) and print "MERGED <sha>".
# usage: tools/dev/merge.sh <pr>
# Retries while GitHub rechecks after a push, or answers 504. Only after the review-fix cycle and the checks
# (CLAUDE.md, Git); a major bump needs Kai's yes first. If a permission check refuses the merge, ask Kai.
source "$(dirname "$0")/env.sh"
N=$1
[ -n "$N" ] || { echo "usage: merge.sh <pr>" >&2; exit 2; }
R="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
sleep 10 # right after a push GitHub can still report the previous state
r=""
for _ in 1 2 3 4 5 6; do
  for _ in $(seq 1 90); do
    s=$(gh pr view "$N" -R "$R" --json mergeStateStatus -q .mergeStateStatus)
    case "$s" in
      CLEAN) break ;;
      DIRTY | BLOCKED) echo "state $s"; exit 1 ;;
    esac
    sleep 8
  done
  gh pr merge "$N" -R "$R" --merge --delete-branch 2>&1 | grep -v "already used by worktree" | grep . || true
  sleep 3
  r=$(gh pr view "$N" -R "$R" --json state,mergeCommit -q '.state+" "+.mergeCommit.oid')
  case "$r" in MERGED*) echo "$r"; exit 0 ;; esac
  sleep 15
done
echo "not merged: $r"
exit 1
