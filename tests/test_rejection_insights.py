"""Insights' rejection feedback: every application with feedback, its rejection's date and stage, newest first."""

from __future__ import annotations

from .factories import post

URL = "/api/v1/insights/rejections"


def _app(client, seeded, stage="applied", **fields):
    body = {"role_id": seeded["role"]["id"], "stage": stage, **fields}
    return post(client, "/api/v1/applications", body)["id"]


def _move(client, app_id, to_stage, when=None, **body):
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": to_stage, "occurred_at": when, **body})
    assert r.status_code == 200, r.text


def _listed(client, **query):
    r = client.get(URL, params=query)
    assert r.status_code == 200, r.text
    return r.json()


def test_lists_feedback_with_its_rejection_newest_first(client, seeded):
    older = _app(
        client, seeded, route="agency", agency_id=seeded["agency"]["id"], recruiter_id=seeded["recruiter"]["id"]
    )
    _move(client, older, "screen", "2026-10-01T09:00:00Z")
    _move(client, older, "rejected", "2026-10-03T09:00:00Z", rejection_feedback="  Wanted Go ✓\nKind words.")
    newer = _app(client, seeded)
    _move(client, newer, "rejected", "2026-10-20T09:00:00Z", rejection_feedback="Too senior")
    _move(client, _app(client, seeded), "rejected", "2026-10-25T09:00:00Z")  # no feedback: not listed
    rows = _listed(client)
    assert [r["application_id"] for r in rows] == [newer, older]
    first = rows[1]
    assert first == {
        "application_id": older,
        "company_id": seeded["company"]["id"],
        "company_name": "Contoso",
        "role_title": "Senior Backend Engineer",
        "recruiter_id": seeded["recruiter"]["id"],
        "recruiter_name": "Alex Recruiter",
        "stage": "rejected",
        "stage_name": "Rejected",
        "feedback": "  Wanted Go ✓\nKind words.",
        "rejected_at": "2026-10-03T09:00:00Z",
        "rejected_from": "screen",
        "rejected_from_name": "Screen",
        "added_at_rejected": False,
    }
    assert rows[0]["recruiter_id"] is None and rows[0]["rejected_from"] == "applied"


def test_a_period_goes_by_the_rejection_date(client, seeded):
    early = _app(client, seeded)
    _move(client, early, "rejected", "2026-09-01T09:00:00Z", rejection_feedback="Early")
    late = _app(client, seeded)
    _move(client, late, "rejected", "2026-10-15T09:00:00Z", rejection_feedback="Late")
    assert [r["feedback"] for r in _listed(client, since="2026-10-01T00:00:00Z")] == ["Late"]
    assert [r["feedback"] for r in _listed(client, until="2026-10-01T00:00:00Z")] == ["Early"]
    # until is exclusive
    assert _listed(client, since="2026-09-01T09:00:01Z", until="2026-10-15T09:00:00Z") == []


def test_an_undone_rejection_keeps_its_feedback_listed_without_a_date(client, seeded):
    app_id = _app(client, seeded)
    _move(client, app_id, "rejected", rejection_feedback="Said no, then took it back")
    assert client.post(f"/api/v1/applications/{app_id}/undo").status_code == 200
    [row] = _listed(client)
    assert (row["stage"], row["rejected_at"], row["rejected_from"]) == ("applied", None, None)
    assert row["feedback"] == "Said no, then took it back"
    # With a period there's no date to go by: it's left out.
    assert _listed(client, since="2000-01-01T00:00:00Z") == []


def test_reopened_shows_where_it_is_now_and_the_rejection_that_stands(client, seeded):
    app_id = _app(client, seeded)
    _move(client, app_id, "screen", "2026-10-01T09:00:00Z")
    _move(client, app_id, "rejected", "2026-10-02T09:00:00Z", rejection_feedback="First")
    _move(client, app_id, "interviewing", "2026-10-05T09:00:00Z")  # they came back
    [row] = _listed(client)
    assert (row["stage"], row["stage_name"], row["rejected_at"], row["rejected_from"]) == (
        "interviewing",
        "Interviewing",
        "2026-10-02T09:00:00Z",
        "screen",
    )


def test_rejected_twice_takes_the_latest_by_when_it_happened(client, seeded):
    app_id = _app(client, seeded)
    _move(client, app_id, "screen", "2026-10-01T09:00:00Z")
    _move(client, app_id, "rejected", "2026-10-10T09:00:00Z", rejection_feedback="Once")
    _move(client, app_id, "interviewing", "2026-10-11T09:00:00Z")
    _move(client, app_id, "rejected", "2026-10-20T09:00:00Z")
    [row] = _listed(client)
    assert (row["rejected_at"], row["rejected_from"], row["feedback"]) == (
        "2026-10-20T09:00:00Z",
        "interviewing",
        "Once",
    )
    # A second rejection recorded later but dated earlier doesn't count as the latest: time order, not recording order.
    other = _app(client, seeded)
    _move(client, other, "screen", "2026-10-01T09:00:00Z")
    _move(client, other, "rejected", "2026-10-20T09:00:00Z", rejection_feedback="Twice")
    _move(client, other, "final", "2026-10-21T09:00:00Z")
    _move(client, other, "rejected", "2026-10-05T09:00:00Z")  # backdated
    row = next(r for r in _listed(client) if r["application_id"] == other)
    assert (row["rejected_at"], row["rejected_from"]) == ("2026-10-20T09:00:00Z", "screen")


def test_added_straight_at_rejected_says_so(client, seeded):
    app_id = _app(client, seeded, stage="rejected")
    client.put(f"/api/v1/applications/{app_id}/rejection-feedback", json={"feedback": "By phone"})
    [row] = _listed(client)
    assert (row["added_at_rejected"], row["rejected_from"], row["stage"]) == (True, "interested", "rejected")


def test_none_at_all(client, seeded):
    _app(client, seeded)
    assert _listed(client) == []
