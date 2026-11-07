#!/bin/bash
# Merge origin/main into this branch. A conflict in docs/ROADMAP.yaml keeps both sides, then one line per id
# (the longer one), so afterwards ALWAYS check `git diff origin/main -- docs/ROADMAP.yaml`: a task that is
# done on main can come back as building or planned. Other conflicts are left for you.
source "$(dirname "$0")/env.sh"
need_root
git fetch -q
git merge --no-edit origin/main 2>&1 | tail -1
conflicts="$(git diff --name-only --diff-filter=U)"
[ -z "$conflicts" ] && exit 0
echo "$conflicts"
if [ "$conflicts" != "docs/ROADMAP.yaml" ]; then
  echo "Conflicts beyond the roadmap: resolve them by hand." >&2
  exit 1
fi
sed -i -E '/^(<<<<<<<|=======|>>>>>>>)( |$)/d' docs/ROADMAP.yaml
uv run python "$DEV/roadmap_dedupe.py" || exit 1
git add docs/ROADMAP.yaml
git commit -q --no-edit
