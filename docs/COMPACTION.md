# Compacting the build session

The Claude Code session that builds this repo compacts its context now and then. To compact, run `/compact` followed by
everything under [The prompt](#the-prompt). It's short on purpose: what must survive lives in files, not in the summary.

- [docs/agents/](agents/README.md) holds the state and live plan (`now.md`), Kai's standing instructions
  (`working-with-kai.md`), lessons (`gotchas.md`) and decisions (`decisions.md`), plus a list of what else to read for
  which task.
- After a compaction, a SessionStart hook (`tools/dev/after_compact.sh`, set in `.claude/settings.json`, and in Kai's
  user settings for a session started outside the repo) prints those four files into the new context, so they're read
  for certain rather than when the summary remembers to.
- Before compacting, refresh `docs/agents/now.md` in a small docs PR (internal: no bump, no release).

This repo is public: nothing here may contain Kai's job-search data (no real companies, people, salaries or notes).

---

## The prompt

Summarise this session so the work carries on without asking Kai anything a sensible default answers.

**Keep, exactly:**
- Kai's messages since the last compaction, word for word, oldest first, each with what was done about it (PR number,
  merged or not). Kai's last few messages matter most.
- Work in flight: open PRs and worktrees (number, branch, folder, what's left), background jobs (what they are, their ids,
  ports), running reviewers or builders and what they were asked.
- Anything promised to Kai and not yet done, and anything Kai is waiting on or was asked.
- Ids, paths, ports, branch names, PR numbers, commit hashes and commands, exactly.
- Anything learned this session that isn't in `docs/agents/` yet (a new standing instruction, decision or gotcha), so it
  can be written there.

**Drop:** tool output, diffs and file contents that are on disk; step-by-step narration; reviewer reports already
handled; screenshots already looked at; anything `docs/agents/`, `CLAUDE.md` or the repo already records. Don't restate
those files: they're printed into the next context.

**End with:**
1. "Resume: the after-compaction hook prints docs/agents/README.md, now.md, working-with-kai.md, gotchas.md and
   decisions.md. If they're not in the context, read them first. Then run `gh pr list`, `git worktree list` and
   `git log --oneline -5`, check the PM dashboard (8767) and Kai's tracker (8770), and finish any open PR before new
   work."
2. One line: "Next action: …", Kai's latest instruction if it's unfinished, otherwise the next item in
   `docs/agents/now.md`.

---

## Resuming after compaction

1. Read what the hook printed (or read `docs/agents/README.md` and the four files it lists yourself). `CLAUDE.md` wins
   on any conflict.
2. Check the state: `gh pr list`, `git worktree list`, `git branch -a`, `git log --oneline -5`; the dashboard
   (`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8767/board`, restart `python3 -m tools.pm` from the main
   checkout if it's down); Kai's tracker (`…/api/v1/health` on 8770: if it answers, leave it alone).
3. Finish open PRs and unfinished worktrees, then Kai's latest request, then [now.md](agents/now.md)'s *Next*.
4. Need a detail the summary dropped? `grep` the transcript it names for a quote, PR number or file name; `gh pr view N`
   for what a PR did and why.
