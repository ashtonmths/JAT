"""The Sankeys with Interviewing expanded into its rounds (?rounds=true): Round 1 → Round 2 → what came next."""

from __future__ import annotations

from .factories import post


def _app(client, seeded):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})["id"]


def _move(client, app_id, to_stage, when):
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": to_stage, "occurred_at": when})
    assert r.status_code == 200, r.text


def _round(client, app_id, kind, starts_at, status="scheduled", **more):
    body = {"kind": kind, "status": status, "starts_at": starts_at, **more}
    return post(client, f"/api/v1/applications/{app_id}/interviews", body)["id"]


def _flow(client, path="flow", rounds=True):
    r = client.get(f"/api/v1/insights/{path}", params={"rounds": rounds})
    assert r.status_code == 200, r.text
    body = r.json()
    return body, {(link["source"], link["target"]): link["value"] for link in body["links"]}


R1, R2, R3 = "interviewing#round-1", "interviewing#round-2", "interviewing#round-3"


def test_off_by_default_and_unchanged(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, a, "technical", "2026-10-02T09:00:00Z")
    body = client.get("/api/v1/insights/flow").json()
    assert body["rounds"] is False
    assert not any("#round-" in n["id"] for n in body["nodes"])


def test_rejected_after_round_2_flows_through_both_rounds(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, a, "technical", "2026-10-02T09:00:00Z", status="done")
    _round(client, a, "coding_task", "2026-10-05T09:00:00Z")
    _move(client, a, "rejected", "2026-10-08T09:00:00Z")
    body, links = _flow(client)
    assert body["rounds"] is True
    assert links[("interviewing", R1)] == 1 and links[(R1, R2)] == 1 and links[(R2, "rejected")] == 1
    assert ("interviewing", "rejected") not in links
    nodes = {n["id"]: n for n in body["nodes"]}
    assert {k: nodes[R2][k] for k in ("name", "kind", "code", "round", "reached", "current")} == {
        "name": "Round 2",
        "kind": "active",
        "code": "round",
        "round": 2,
        "reached": 1,
        "current": 0,
    }
    ids = [n["id"] for n in body["nodes"]]
    assert ids.index("interviewing") < ids.index(R1) < ids.index(R2) < ids.index("rejected")


def test_no_rounds_goes_straight_on(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _move(client, a, "rejected", "2026-10-08T09:00:00Z")
    _, links = _flow(client)
    assert links[("interviewing", "rejected")] == 1
    assert not any("#round-" in a or "#round-" in b for a, b in links)


def test_skipped_numbers_go_from_one_to_the_next_there_is(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, a, "screen", "2026-10-02T09:00:00Z", round=1)
    _round(client, a, "final", "2026-10-06T09:00:00Z", round=3)
    _move(client, a, "rejected", "2026-10-08T09:00:00Z")
    _, links = _flow(client)
    assert links[(R1, R3)] == 1 and links[(R3, "rejected")] == 1
    assert not any(R2 in pair for pair in links)


def test_still_interviewing_waits_after_its_last_round(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, a, "technical", "2026-10-02T09:00:00Z", status="done")
    _round(client, a, "final", "2099-01-01T09:00:00Z")  # booked ahead: not reached yet
    _round(client, a, "pairing", "2026-10-03T09:00:00Z", status="cancelled")
    body, links = _flow(client)
    assert links[(R1, "holding:interviewing")] == 1
    assert ("interviewing", "holding:interviewing") not in links
    nodes = {n["id"]: n for n in body["nodes"]}
    assert (nodes[R1]["current"], nodes["holding:interviewing"]["name"]) == (1, "Still interviewing")
    assert R2 not in nodes


def test_rounds_count_only_up_to_the_move_on(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, a, "technical", "2026-10-02T09:00:00Z")
    _move(client, a, "final", "2026-10-04T09:00:00Z")
    _round(client, a, "final", "2026-10-06T09:00:00Z")  # held at Final: after Interviewing
    _, links = _flow(client)
    assert links[("interviewing", R1)] == 1 and links[(R1, "final")] == 1
    assert R2 not in {b for _, b in links}


def test_nothing_is_lost_or_made_up_with_rounds_on(client, seeded):
    """Over a mix of applications, every node passes on what reaches it, and the outcomes and
    Interviewing's total are the same with rounds on and off."""
    plain = _app(client, seeded)  # no rounds, rejected from Interviewing
    _move(client, plain, "interviewing", "2026-10-01T09:00:00Z")
    _move(client, plain, "rejected", "2026-10-03T09:00:00Z")
    skipped = _app(client, seeded)  # Round 1, then Round 3
    _move(client, skipped, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, skipped, "screen", "2026-10-02T09:00:00Z", round=1)
    _round(client, skipped, "final", "2026-10-04T09:00:00Z", round=3)
    _move(client, skipped, "rejected", "2026-10-05T09:00:00Z")
    reopened = _app(client, seeded)  # rejected after Round 1, reopened, a second round since
    _move(client, reopened, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, reopened, "technical", "2026-10-02T09:00:00Z")
    _move(client, reopened, "rejected", "2026-10-03T09:00:00Z")
    _move(client, reopened, "interviewing", "2026-10-06T09:00:00Z")
    _round(client, reopened, "coding_task", "2026-10-07T09:00:00Z")
    waiting = _app(client, seeded)  # still interviewing, a round booked ahead
    _move(client, waiting, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, waiting, "technical", "2026-10-02T09:00:00Z", status="done")
    _round(client, waiting, "final", "2099-01-01T09:00:00Z")
    on = _app(client, seeded)  # moved on to Final, with a round held there
    _move(client, on, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, on, "technical", "2026-10-02T09:00:00Z")
    _move(client, on, "final", "2026-10-04T09:00:00Z")
    _round(client, on, "final", "2026-10-06T09:00:00Z")

    expanded, links = _flow(client)
    nodes = {n["id"]: n for n in expanded["nodes"]}
    assert any("#round-" in n for n in nodes)
    for nid, node in nodes.items():
        ins = sum(v for (a, b), v in links.items() if b == nid)
        outs = sum(v for (a, b), v in links.items() if a == nid and not b.startswith("holding:"))
        if nid.startswith("holding:"):
            assert outs == 0 and node["reached"] == ins, nid
            continue
        assert (ins or node["reached"]) == node["reached"], nid  # what reaches it is what flows in
        # What flows in flows on, or is still there (spurring off to where it's waiting, or ending).
        assert node["reached"] == outs + node["current"], nid

    folded, _ = _flow(client, rounds=False)
    plain_nodes = {n["id"]: n for n in folded["nodes"]}
    ends = {"rejected", "final", "holding:interviewing", "holding:final"}
    assert {k: nodes[k]["reached"] for k in ends} == {k: plain_nodes[k]["reached"] for k in ends}
    assert nodes["interviewing"]["reached"] == plain_nodes["interviewing"]["reached"] == 5
    assert expanded["applications"] == folded["applications"]


def test_the_whole_picture_expands_too(client, seeded):
    a = _app(client, seeded)
    _move(client, a, "interviewing", "2026-10-01T09:00:00Z")
    _round(client, a, "technical", "2026-10-02T09:00:00Z")
    _move(client, a, "rejected", "2026-10-08T09:00:00Z")
    body, links = _flow(client, "whole-flow")
    assert body["rounds"] is True
    assert links[("interviewing", R1)] == 1 and links[(R1, "rejected")] == 1
    plain = client.get("/api/v1/insights/whole-flow").json()
    assert plain["rounds"] is False and ("interviewing", "rejected") in {
        (link["source"], link["target"]) for link in plain["links"]
    }
