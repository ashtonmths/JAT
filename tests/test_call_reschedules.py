"""Rescheduling a call (a meeting), as a round can be: each move kept with its who and why."""

from datetime import UTC, datetime, timedelta

import pytest

from jat.db.models import MeetingMove

from .factories import post

THEN = "2030-01-07T10:00:00Z"
LATER = "2030-01-08T10:00:00Z"
LATEST = "2030-01-09T15:30:00Z"


def _call(client, seeded, **body):
    return post(client, "/api/v1/meetings", {"contact_id": seeded["recruiter"]["id"], "starts_at": THEN, **body})


def _patch(client, call, **body):
    r = client.patch(f"/api/v1/meetings/{call['id']}", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _app(client, seeded):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})["id"]


def _events(client, app_id):
    return client.get(f"/api/v1/applications/{app_id}").json()["events"]


def test_a_new_time_for_a_booked_call_is_a_move_with_its_who_and_why(client, seeded):
    call = _call(client, seeded, ends_at="2030-01-07T10:30:00Z")
    assert (call["rescheduled_count"], call["rescheduled_from"], call["moves"]) == (0, None, [])
    moved = _patch(client, call, starts_at=LATER, reschedule_by="them", reschedule_reason="  A  clash\n")
    assert (moved["rescheduled_count"], moved["rescheduled_from"]) == (1, "2030-01-07T10:00:00Z")
    assert moved["ends_at"] == "2030-01-08T10:30:00Z"  # it lasts as long as before
    assert moved["moves"] == [{"from_at": THEN, "to_at": LATER, "by": "them", "reason": "A clash"}]

    # A second move keeps the first one's who and why, and one with no who says nothing about it.
    again = _patch(client, call, starts_at=LATEST, ends_at="2030-01-09T17:00:00Z")
    assert (again["rescheduled_count"], again["rescheduled_from"]) == (2, LATER)
    assert again["ends_at"] == "2030-01-09T17:00:00Z"  # sent with it: kept as sent
    assert again["moves"] == [
        {"from_at": THEN, "to_at": LATER, "by": "them", "reason": "A clash"},
        {"from_at": LATER, "to_at": LATEST, "by": None, "reason": None},
    ]
    # Every reader of calls has the moves.
    [listed] = client.get("/api/v1/meetings", params={"contact_id": seeded["recruiter"]["id"]}).json()
    assert listed["moves"] == again["moves"] and client.get(f"/api/v1/meetings/{call['id']}").json() == again


@pytest.mark.parametrize(
    "change",
    [
        {"title": "Catch-up", "reschedule_by": "me", "reschedule_reason": "Nothing moved"},  # who and why alone
        {"starts_at": THEN, "reschedule_by": "me"},  # the same time again
        {"starts_at": "2030-01-07T11:00:00+01:00"},  # the same time, written in another zone
        {"status": "done", "starts_at": LATER},  # it happened: a change of status isn't a move
        {"status": "cancelled", "starts_at": LATER},
    ],
)
def test_what_isnt_a_move(client, seeded, change):
    after = _patch(client, _call(client, seeded), **change)
    assert (after["rescheduled_count"], after["rescheduled_from"], after["moves"]) == (0, None, [])


@pytest.mark.parametrize("status", ["done", "cancelled"])
def test_a_call_that_isnt_booked_doesnt_move(client, seeded, status):
    after = _patch(client, _call(client, seeded, status=status), starts_at=LATER, reschedule_by="them")
    assert after["starts_at"] == LATER and (after["rescheduled_count"], after["moves"]) == (0, [])


def test_who_must_be_one_of_the_four(client, seeded):
    call = _call(client, seeded)
    r = client.patch(f"/api/v1/meetings/{call['id']}", json={"starts_at": LATER, "reschedule_by": "blame"})
    assert r.status_code == 422
    assert client.get(f"/api/v1/meetings/{call['id']}").json()["starts_at"] == THEN  # nothing saved


def test_a_call_with_no_application_has_no_timeline_entry(client, seeded):
    app_id = _app(client, seeded)
    before = _events(client, app_id)
    _patch(client, _call(client, seeded), starts_at=LATER, reschedule_by="me")
    assert _events(client, app_id) == before


def test_a_call_on_an_application_puts_each_move_on_its_timeline(client, seeded):
    app_id = _app(client, seeded)
    call = _call(client, seeded, application_id=app_id, title="Market catch-up")
    _patch(client, call, starts_at=LATER, reschedule_by="them", reschedule_reason="A clash")
    event = _events(client, app_id)[-1]
    assert event["kind"] == "call"
    assert event["summary"] == "Call with Alex Recruiter: Market catch-up rescheduled (they needed the change): A clash"
    assert event["reschedule"] == {"from_at": THEN, "to_at": LATER, "by": "them", "reason": "A clash"}
    assert (event["data"]["meeting_id"], event["data"]["status"]) == (call["id"], "scheduled")

    # The Timeline page files it with calls, not with calls that happened, and shows the move.
    [item] = [i for i in client.get("/api/v1/timeline").json()["items"] if i["id"] == f"event:{event['id']}"]
    assert item["category"] == "meeting" and item["reschedule"] == event["reschedule"]


def test_a_move_isnt_news_from_the_recruiter(client, seeded):
    """The scorecard's first update and last contact count calls that happened, not moved ones."""
    app_id = post(
        client,
        "/api/v1/applications",
        {
            "role_id": seeded["role"]["id"],
            "stage": "applied",
            "route": "agency",
            "recruiter_id": seeded["recruiter"]["id"],
        },
    )["id"]
    soon = (datetime.now(UTC) + timedelta(days=2)).replace(microsecond=0)
    call = _call(client, seeded, application_id=app_id, starts_at=soon.isoformat())
    _patch(client, call, starts_at=(soon + timedelta(days=1)).isoformat(), reschedule_by="them")
    [alex] = client.get("/api/v1/insights/scorecard").json()["recruiters"]
    assert (alex["median_first_update_days"], alex["last_contact"]) == (None, None)


def test_a_moves_record_read_back_from_odd_data_is_never_a_500(client, seeded, app):
    call = _call(client, seeded)
    _patch(client, call, starts_at=LATER, reschedule_by="them")
    with app.state.sessions.begin() as session:  # a hand-edited export
        session.query(MeetingMove).update({"by": "blame", "reason": ""})
    moves = client.get(f"/api/v1/meetings/{call['id']}").json()["moves"]
    assert moves == [{"from_at": THEN, "to_at": LATER, "by": None, "reason": None}]


def test_removing_a_call_removes_its_moves(client, seeded, app):
    call = _call(client, seeded)
    _patch(client, call, starts_at=LATER)
    assert client.delete(f"/api/v1/meetings/{call['id']}").status_code == 204
    with app.state.sessions.begin() as session:
        assert session.query(MeetingMove).count() == 0
