"""Turn the review workflow's result into fixes, a list of what changed, and the PR's table.

Usage: uv run python scripts/i18n/translate/apply_review.py <lang> <ns>

Reads var/i18n/<lang>/<ns>/review.json (save the workflow's result there). Writes, beside it:
fixes.json (key -> final text, for assemble.py), changed.json (for the re-review workflow) and
table.md (every finding the judges decided, who raised it, and why). Prints a summary.
"""

import sys
from collections import Counter

from common import read_json, work_dir, write_json


def decisions(review: dict, ns: str, keys: set[str]) -> tuple[list[dict], list[str]]:
    """One decision per key (the first judge to decide it wins), and keys the reviewers got wrong."""
    seen: set[str] = set()
    out, unknown = [], []
    for area in review["judged"]:
        for d in area.get("decisions") or []:
            key = d["key"].removeprefix(f"{ns}:").removeprefix(f"{ns}.")
            if key not in keys:
                unknown.append(d["key"])
            elif key not in seen:
                seen.add(key)
                out.append({**d, "key": key})
    return out, unknown


def cell(text: str, limit: int = 300) -> str:
    text = (text or "").replace("|", "/").replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def table(decided: list[dict]) -> str:
    if not decided:
        return "No findings.\n"
    rows = [
        f"| `{d['key']}` | {d.get('severity', '')} | {'changed' if d['verdict'] == 'change' else 'kept'}: "
        f"{cell(d['final'])} | {'both' if d.get('agreed') else cell(d.get('disagreement', ''))} | {cell(d['why'])} |"
        for d in decided
    ]
    return (
        "| Key | Severity | Decision | Who raised it / disagreement | Why |\n|---|---|---|---|---|\n"
        + "\n".join(rows)
        + "\n"
    )


def main(lang: str, ns: str) -> None:
    work = work_dir(lang, ns)
    review = read_json(work / "review.json")
    english = read_json(work / "flat.json")
    decided, unknown = decisions(review, ns, set(english))
    counts = Counter(
        (r["model"], f["severity"]) for r in review["text"] + review["screens"] for f in r.get("findings") or []
    )
    changes = [d for d in decided if d["verdict"] == "change"]
    write_json(work / "fixes.json", {d["key"]: d["final"] for d in changes})
    write_json(
        work / "changed.json",
        [{"key": d["key"], "en": english[d["key"]], "now": d["final"], "why_changed": d["why"]} for d in changes],
    )
    (work / "table.md").write_text(table(decided))
    print("findings by model and severity:", dict(counts))
    for d in decided:
        who = "both" if d.get("agreed") else "one "
        print(f"  {d['verdict']:6} {d.get('severity', ''):10} {who} {d['key']} => {d['final']}")
    for area in review["judged"]:
        for g in area.get("glossary_changes") or []:
            print("  glossary:", g)
    if unknown:
        print("keys not in this file (check by hand):", unknown)
    by_severity = dict(Counter(d.get("severity") for d in changes))
    print(f"{len(changes)} changed ({by_severity}), {len(decided) - len(changes)} kept")


if __name__ == "__main__":
    main(*sys.argv[1:3])
