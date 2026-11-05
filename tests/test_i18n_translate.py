"""The translation helpers in scripts/i18n/translate (pure parts only: no files, servers or agents)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "i18n" / "translate"))

import apply_review  # noqa: E402
import assemble  # noqa: E402
import prepare  # noqa: E402
from common import fill, flatten, problems  # noqa: E402


def test_flatten_and_fill_round_trip():
    tree = {"title": "x", "board": {"round": "y", "drag": {"over": "z"}}}
    flat = flatten(tree)
    assert flat == {"title": "x", "board.round": "y", "board.drag.over": "z"}
    assert fill(tree, {k: v.upper() for k, v in flat.items()}) == {
        "title": "X",
        "board": {"round": "Y", "drag": {"over": "Z"}},
    }


def test_a_good_translation_has_no_problems():
    english = {"a": "Open {{role}} at {{company}}", "b": "<b>Route:</b> <route/>", "c": "{{count}} days"}
    assert (
        problems(english, {"a": "打开 {{company}} 的 {{role}}", "b": "<b>渠道：</b><route/>", "c": "{{count}} 天"})
        == []
    )


def test_count_may_be_written_in_words():
    assert problems({"c": "{{count}} days"}, {"c": "three days"}) == []


def test_missing_extra_and_marked_keys():
    found = problems({"a": "A", "b": "B"}, {"a": "[TRANSLATE] A", "z": "Z"})
    assert "missing: b" in found
    assert "not in English: z" in found
    assert "still marked: a" in found


def test_a_changed_placeholder_or_tag():
    assert problems({"a": "Hi {{name}}"}, {"a": "你好 {{who}}"})
    assert problems({"b": "<b>Route:</b> <route/>"}, {"b": "渠道：<route/>"})
    assert problems({"b": "<route/>"}, {"b": "<route>"})


def test_areas_merge_groups_in_order_up_to_the_limit():
    flat = {f"a.{i}": "" for i in range(4)} | {f"b.{i}": "" for i in range(3)} | {f"c.{i}": "" for i in range(5)}
    got = prepare.areas(flat, "ns", max_size=8)
    assert [(a["id"], a["prefixes"], len(a["keys"])) for a in got] == [("ns-1", ["a", "b"], 7), ("ns-2", ["c"], 5)]


def test_a_group_bigger_than_the_limit_is_one_area():
    got = prepare.areas({f"big.{i}": "" for i in range(40)}, "ns", max_size=30)
    assert len(got) == 1 and len(got[0]["keys"]) == 40


def test_index_ts_lists_exactly_the_files():
    text = prepare.index_ts(["applications", "stages"])
    assert 'import applications from "./applications.json";' in text
    assert 'import stages from "./stages.json";' in text
    assert text.endswith("export default {\n  applications,\n  stages,\n};\n")


def test_assemble_lets_later_fixes_win():
    result = {
        "results": [
            {"translations": [{"key": "a", "text": "1"}, {"key": "b", "text": "1"}, {"key": "c", "text": "1"}]}
        ],
        "consistency": {"changes": [{"key": "b", "to": "2"}, {"key": "c", "to": "2"}]},
    }
    assert assemble.collect(result, [{"c": "3"}]) == {"a": "1", "b": "2", "c": "3"}


def test_review_decisions_one_per_key_and_unknown_keys():
    review = {
        "judged": [
            {
                "decisions": [
                    {"key": "stages:a", "verdict": "change", "final": "x"},
                    {"key": "nope", "verdict": "keep", "final": ""},
                ]
            },
            {"decisions": [{"key": "a", "verdict": "keep", "final": "y"}]},
        ]
    }
    decided, unknown = apply_review.decisions(review, "stages", {"a"})
    assert [(d["key"], d["final"]) for d in decided] == [("a", "x")]
    assert unknown == ["nope"]


def test_review_table_escapes_pipes_and_says_who():
    md = apply_review.table(
        [
            {"key": "a", "severity": "nit", "verdict": "keep", "final": "x|y", "agreed": True, "why": "fine"},
            {
                "key": "b",
                "severity": "must_fix",
                "verdict": "change",
                "final": "z",
                "agreed": False,
                "disagreement": "only Opus",
                "why": "wrong",
            },
        ]
    )
    assert "| `a` | nit | kept: x/y | both | fine |" in md
    assert "| `b` | must_fix | changed: z | only Opus | wrong |" in md
    assert apply_review.table([]) == "No findings.\n"
