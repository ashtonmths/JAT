"""Which round rejections came after: the last round reached before each rejection that stands."""

from __future__ import annotations

from sqlalchemy import text

from jat.db import db_path, make_engine

from .factories import post

URL = "/api/v1/insights/rejections/rounds"


def _app(client, seeded):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})["id"]


def _move(client, app_id, to_stage, when):
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": to_stage, "occurred_at": when})
    assert r.status_code == 200, r.text


def _round(client, app_id, kind, starts_at=None, status="scheduled", **more):
    body = {"kind": kind, "status": status, "starts_at": starts_at, **more}
    return post(client, f"/api/v1/applications/{app_id}/interviews", body)["id"]


def _counts(client, **query):
    r = client.get(URL, params=query)
    assert r.status_code == 200, r.text
    return r.json()


def test_nothing_rejected(client, seeded):
    _app(client, seeded)
    assert _counts(client) == {"rejections": 0, "no_rounds": 0, "unnumbered": 0, "by_kind": [], "by_number": []}


def test_rejected_before_any_round(client, seeded):
    early = _app(client, seeded)
    _round(client, early, "technical", "2026-10-20T09:00:00Z")  # booked for after the rejection: not reached
    _move(client, early, "rejected", "2026-10-10T09:00:00Z")
    cancelled = _app(client, seeded)
    _round(client, cancelled, "screen", "2026-10-01T09:00:00Z", status="cancelled")
    _move(client, cancelled, "rejected", "2026-10-10T09:00:00Z")
    assert _counts(client) == {"rejections": 2, "no_rounds": 2, "unnumbered": 0, "by_kind": [], "by_number": []}


def test_the_last_round_reached_by_kind_and_number(client, seeded):
    a = _app(client, seeded)
    _round(client, a, "technical", "2026-10-01T09:00:00Z", status="done")
    _round(client, a, "coding_task", deadline_at="2026-10-05T17:00:00Z")  # a take-home, due before
    _round(client, a, "final", "2026-10-30T09:00:00Z")  # booked after: not reached
    _move(client, a, "rejected", "2026-10-08T09:00:00Z")
    b = _app(client, seeded)
    _round(client, b, "screen", "2026-10-01T09:00:00Z", status="done")
    _round(client, b, "coding_task", "2026-10-03T09:00:00Z")
    _move(client, b, "rejected", "2026-10-04T09:00:00Z")
    c = _app(client, seeded)
    _round(client, c, "system_design", status="done")  # done with no time, added before: reached
    _move(client, c, "rejected", "2099-01-01T09:00:00Z")
    assert _counts(client) == {
        "rejections": 3,
        "no_rounds": 0,
        "unnumbered": 0,
        "by_kind": [{"kind": "coding_task", "count": 2}, {"kind": "system_design", "count": 1}],
        "by_number": [{"round": 1, "count": 1}, {"round": 2, "count": 2}],
    }


def test_a_take_home_handed_in_early_counts(client, seeded):
    a = _app(client, seeded)
    _round(client, a, "coding_task", status="done", deadline_at="2099-03-01T17:00:00Z")  # due after, done
    _move(client, a, "rejected", "2099-02-01T09:00:00Z")
    b = _app(client, seeded)
    _round(client, b, "coding_task", deadline_at="2099-03-01T17:00:00Z")  # due after, not done: not reached
    _move(client, b, "rejected", "2099-02-01T09:00:00Z")
    counts = _counts(client)
    assert (counts["rejections"], counts["no_rounds"], counts["by_kind"]) == (
        2,
        1,
        [{"kind": "coding_task", "count": 1}],
    )


def _sql(app, statement, **values):
    """Reach a state the API won't make (older data, or a round added long ago)."""
    engine = make_engine(db_path(app.state.jat.data_dir))
    with engine.begin() as conn:
        conn.execute(text(statement), values)
    engine.dispose()


def test_a_take_home_handed_in_after_a_reopening_doesnt_count_against_the_first_rejection(app, client, seeded):
    a = _app(client, seeded)
    task = _round(client, a, "coding_task", deadline_at="2099-03-01T17:00:00Z")
    _sql(app, "UPDATE interviews SET created_at = '2026-01-01T09:00:00Z' WHERE id = :id", id=task)
    _move(client, a, "rejected", "2026-02-01T09:00:00Z")
    _move(client, a, "interviewing", "2026-02-10T09:00:00Z")  # they came back
    r = client.patch(f"/api/v1/interviews/{task}", json={"status": "done"})  # handed in now, after the rejection
    assert r.status_code == 200, r.text
    counts = _counts(client)
    assert (counts["rejections"], counts["no_rounds"], counts["by_kind"]) == (1, 1, [])


def test_a_round_done_with_nothing_on_its_timeline_goes_by_when_it_was_added(app, client, seeded):
    a = _app(client, seeded)
    task = _round(client, a, "system_design", status="done")
    # Older data: no timeline entry says it was done, and it was added before the rejection.
    _sql(app, "UPDATE interviews SET created_at = '2026-01-01T09:00:00Z' WHERE id = :id", id=task)
    _sql(app, "DELETE FROM events WHERE kind = 'interview' AND application_id = :id", id=a)
    _move(client, a, "rejected", "2026-02-01T09:00:00Z")
    assert _counts(client)["by_kind"] == [{"kind": "system_design", "count": 1}]


def test_a_round_waiting_for_a_new_time_wasnt_reached(client, seeded):
    a = _app(client, seeded)
    _round(client, a, "screen", "2099-01-01T09:00:00Z", status="done")
    waiting = _round(client, a, "technical", "2099-01-05T09:00:00Z")
    r = client.post(f"/api/v1/interviews/{waiting}/needs-new-time", json={"by": "them"})
    assert r.status_code == 200, r.text
    _move(client, a, "rejected", "2099-02-01T09:00:00Z")  # after it started waiting
    counts = _counts(client)
    assert (counts["by_kind"], counts["by_number"]) == ([{"kind": "screen", "count": 1}], [{"round": 1, "count": 1}])


def test_a_round_with_no_number_counts_by_kind(app, client, seeded):
    a = _app(client, seeded)
    unnumbered = _round(client, a, "pairing", "2026-10-01T09:00:00Z")
    _move(client, a, "rejected", "2026-10-02T09:00:00Z")
    _sql(app, "UPDATE interviews SET round = NULL WHERE id = :id", id=unnumbered)  # rounds get a number when added
    counts = _counts(client)
    assert (counts["unnumbered"], counts["by_kind"], counts["by_number"]) == (
        1,
        [{"kind": "pairing", "count": 1}],
        [],
    )


def test_an_undone_rejection_isnt_counted(client, seeded):
    a = _app(client, seeded)
    _round(client, a, "technical", "2026-10-01T09:00:00Z")
    _move(client, a, "rejected", "2026-10-08T09:00:00Z")
    assert client.post(f"/api/v1/applications/{a}/undo").status_code == 200
    assert _counts(client)["rejections"] == 0


def test_reopened_counts_only_rounds_up_to_the_rejection(client, seeded):
    a = _app(client, seeded)
    _round(client, a, "technical", "2026-10-01T09:00:00Z")
    _move(client, a, "rejected", "2026-10-02T09:00:00Z")
    _move(client, a, "interviewing", "2026-10-10T09:00:00Z")  # they came back
    _round(client, a, "coding_task", "2026-10-12T09:00:00Z")
    counts = _counts(client)
    assert (counts["rejections"], counts["by_kind"], counts["by_number"]) == (
        1,
        [{"kind": "technical", "count": 1}],
        [{"round": 1, "count": 1}],
    )
    # Rejected again after the second round: that rejection is the one that stands.
    _move(client, a, "rejected", "2026-10-15T09:00:00Z")
    counts = _counts(client)
    assert (counts["rejections"], counts["by_kind"], counts["by_number"]) == (
        1,
        [{"kind": "coding_task", "count": 1}],
        [{"round": 2, "count": 1}],
    )


def test_a_period_goes_by_the_rejection_date(client, seeded):
    old = _app(client, seeded)
    _move(client, old, "rejected", "2026-01-10T09:00:00Z")
    new = _app(client, seeded)
    _round(client, new, "pairing", "2026-10-01T09:00:00Z")
    _move(client, new, "rejected", "2026-10-02T09:00:00Z")
    counts = _counts(client, since="2026-09-01T00:00:00Z")
    assert (counts["rejections"], counts["no_rounds"], counts["by_kind"]) == (1, 0, [{"kind": "pairing", "count": 1}])
    assert _counts(client, until="2026-09-01T00:00:00Z")["no_rounds"] == 1
