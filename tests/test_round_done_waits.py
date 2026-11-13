"""Marking a round done starts waiting to hear back, so Today lists the application under Waiting."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from jat.db.models import Event
from jat.domain.interviews import WAITING_SINCE

from .factories import post

TODAY = "2026-10-05"


def _iso(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _app(client, seeded, stage="interviewing", **extra):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": stage, **extra})


def _round(client, app_id: str, title="Technical", days=-1, **extra) -> dict:
    url = f"/api/v1/applications/{app_id}/interviews"
    return post(client, url, {"title": title, "starts_at": _iso(days), **extra})


def _mark(client, round_id: str, status: str) -> dict:
    r = client.patch(f"/api/v1/interviews/{round_id}", params={"today": TODAY}, json={"status": status})
    assert r.status_code == 200, r.text
    return r.json()


def _detail(client, app_id: str) -> dict:
    return client.get(f"/api/v1/applications/{app_id}").json()


def _waiting_ids(client) -> list[str]:
    return [a["id"] for a in client.get("/api/v1/next-actions", params={"today": TODAY}).json()["waiting"]]


def test_marking_a_round_done_waits_to_hear_back_from_your_today(client, seeded):
    app = _app(client, seeded)
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    detail = _detail(client, app["id"])
    assert detail["awaiting_reply_since"] == TODAY
    assert _waiting_ids(client) == [app["id"]]
    # The round's own entry says it; no "Replied; waiting" line, which would be untrue.
    summaries = [e["summary"] for e in detail["events"]]
    assert "Replied; waiting to hear back" not in summaries
    # Heard back works on it as on any wait.
    r = client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": None})
    assert r.json()["awaiting_reply_since"] is None and r.json()["events"][-1]["summary"] == "Heard back"
    assert _waiting_ids(client) == []


def test_an_existing_wait_is_left_as_it_is(client, seeded):
    app = _app(client, seeded)
    client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": "2026-09-20"})
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    assert _detail(client, app["id"])["awaiting_reply_since"] == "2026-09-20"


def test_a_reply_to_read_is_left_as_it_is(client, seeded):
    app = _app(client, seeded)
    client.patch(f"/api/v1/applications/{app['id']}", json={"reply_to_read_since": "2026-10-01"})
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    detail = _detail(client, app["id"])
    assert (detail["awaiting_reply_since"], detail["reply_to_read_since"]) == (None, "2026-10-01")


def test_another_round_still_to_come_means_not_waiting(client, seeded):
    app = _app(client, seeded)
    one = _round(client, app["id"])
    _round(client, app["id"], "Onsite", days=3)  # booked ahead
    _mark(client, one["id"], "done")
    assert _detail(client, app["id"])["awaiting_reply_since"] is None
    other = _app(client, seeded)
    first = _round(client, other["id"])
    post(client, f"/api/v1/applications/{other['id']}/interviews", {"title": "Final"})  # not booked yet
    _mark(client, first["id"], "done")
    assert _detail(client, other["id"])["awaiting_reply_since"] is None


def test_archived_or_closed_applications_dont_wait(client, seeded):
    archived = _app(client, seeded)
    client.patch(f"/api/v1/applications/{archived['id']}", json={"archived": True})
    _mark(client, _round(client, archived["id"])["id"], "done")
    assert _detail(client, archived["id"])["awaiting_reply_since"] is None
    closed = _app(client, seeded, stage="rejected")
    _mark(client, _round(client, closed["id"])["id"], "done")
    assert _detail(client, closed["id"])["awaiting_reply_since"] is None


def test_putting_the_round_back_ends_the_wait_done_started(client, seeded):
    app = _app(client, seeded, recruiter_id=seeded["recruiter"]["id"], route="agency", agency_id=seeded["agency"]["id"])
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] is None
    assert client.get(f"/api/v1/contacts/{seeded['recruiter']['id']}").json()["replies"] == 0
    # Not a reply: nothing towards the recruiter's reply times, and no Heard back line.
    assert "Heard back" not in [e["summary"] for e in _detail(client, app["id"])["events"]]
    _mark(client, one["id"], "done")
    _mark(client, one["id"], "cancelled")  # it didn't happen after all
    assert _detail(client, app["id"])["awaiting_reply_since"] is None


def test_putting_the_round_back_keeps_a_wait_you_changed(client, seeded):
    app = _app(client, seeded)
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": None})  # heard back
    client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": TODAY})  # waiting again
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY
    # Nor one that was there before the round was marked done.
    other = _app(client, seeded)
    client.patch(f"/api/v1/applications/{other['id']}", json={"awaiting_reply_since": "2026-09-20"})
    two = _round(client, other["id"])
    _mark(client, two["id"], "done")
    _mark(client, two["id"], "scheduled")
    assert _detail(client, other["id"])["awaiting_reply_since"] == "2026-09-20"


def test_booking_the_next_round_is_hearing_back(client, seeded):
    app = _app(client, seeded, recruiter_id=seeded["recruiter"]["id"], route="agency", agency_id=seeded["agency"]["id"])
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    url = f"/api/v1/applications/{app['id']}/interviews"
    r = client.post(url, params={"today": "2026-10-07"}, json={"title": "Onsite", "starts_at": _iso(4)})
    assert r.status_code == 201, r.text
    detail = _detail(client, app["id"])
    assert detail["awaiting_reply_since"] is None
    assert detail["events"][-1]["summary"] == "Heard back"
    assert _waiting_ids(client) == []
    # As with Heard back, it counts towards the recruiter's reply times: Monday 5th to Wednesday 7th.
    person = client.get(f"/api/v1/contacts/{seeded['recruiter']['id']}").json()
    assert (person["replies"], person["usual_reply_days"]) == (1, 2)


def test_booking_a_round_leaves_a_wait_you_set(client, seeded):
    app = _app(client, seeded)
    client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": "2026-09-20"})
    _round(client, app["id"], "Onsite", days=4)
    assert _detail(client, app["id"])["awaiting_reply_since"] == "2026-09-20"


def test_the_wait_starts_on_the_day_the_round_happened(client, seeded):
    app = _app(client, seeded)
    # 23:30 UTC on 1 Oct is 00:30 on 2 Oct in London (summer time): your day, not the server's.
    one = _round(client, app["id"], starts_at="2026-10-01T23:30:00+00:00")
    r = client.patch(
        f"/api/v1/interviews/{one['id']}", params={"today": TODAY, "tz": "Europe/London"}, json={"status": "done"}
    )
    assert r.status_code == 200, r.text
    assert _detail(client, app["id"])["awaiting_reply_since"] == "2026-10-02"
    # Taking it back still knows the wait was this round's.
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] is None
    # A take-home handed in before its deadline waits from the day it was done.
    other = _app(client, seeded)
    task = _round(client, other["id"], "Take-home", days=5)
    _mark(client, task["id"], "done")
    assert _detail(client, other["id"])["awaiting_reply_since"] == TODAY


def test_a_bad_day_or_time_zone_is_refused(client, seeded):
    app = _app(client, seeded)
    one = _round(client, app["id"])
    url = f"/api/v1/interviews/{one['id']}"
    assert client.patch(url, params={"today": "bad"}, json={"status": "done"}).status_code == 422
    r = client.patch(url, params={"tz": "Not/AZone"}, json={"status": "done"})
    assert r.status_code == 422 and r.json()["code"] == "time_zone_unknown"
    adding = f"/api/v1/applications/{app['id']}/interviews"
    assert client.post(adding, params={"today": "bad"}, json={"title": "Onsite"}).status_code == 422
    # Nothing was saved by the refused requests.
    assert client.get(url).json()["status"] == "scheduled"
    assert len(client.get("/api/v1/interviews", params={"application_id": app["id"]}).json()) == 1
    assert _detail(client, app["id"])["awaiting_reply_since"] is None


def test_editing_a_done_round_neither_starts_nor_ends_a_wait(client, seeded):
    app = _app(client, seeded)
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    for change in ({"title": "Renamed"}, {"starts_at": _iso(-2)}, {"status": "done"}):
        assert client.patch(f"/api/v1/interviews/{one['id']}", json=change).status_code == 200
        assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY
    other = _app(client, seeded)
    done = _round(client, other["id"], status="done")  # added as done: no wait
    client.patch(f"/api/v1/interviews/{done['id']}", json={"title": "Renamed"})
    assert _detail(client, other["id"])["awaiting_reply_since"] is None


def _waiting_after_done(client, seeded) -> tuple[dict, dict]:
    app = _app(client, seeded, recruiter_id=seeded["recruiter"]["id"], route="agency", agency_id=seeded["agency"]["id"])
    one = _round(client, app["id"])
    _mark(client, one["id"], "done")
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY
    return app, one


def test_adding_a_round_filled_in_afterwards_isnt_hearing_back(client, seeded):
    app, _ = _waiting_after_done(client, seeded)
    _round(client, app["id"], "Done already", status="done")
    _round(client, app["id"], "Called off", status="cancelled")
    _round(client, app["id"], "Earlier chat", days=-5)  # left at scheduled, but already past
    detail = _detail(client, app["id"])
    assert detail["awaiting_reply_since"] == TODAY
    assert "Heard back" not in [e["summary"] for e in detail["events"]]
    assert client.get(f"/api/v1/contacts/{seeded['recruiter']['id']}").json()["replies"] == 0
    # Undated, it's still to come: that's hearing back.
    _round(client, app["id"], "Next one", starts_at=None)
    assert _detail(client, app["id"])["awaiting_reply_since"] is None


def test_booking_on_another_application_leaves_this_one_waiting(client, seeded):
    app, _ = _waiting_after_done(client, seeded)
    other = _app(client, seeded)
    _round(client, other["id"], "Onsite", days=4)
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY


def test_a_stage_move_since_keeps_the_wait_when_the_round_is_put_back(client, seeded):
    app, one = _waiting_after_done(client, seeded)
    client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "final"})
    assert _detail(client, app["id"])["awaiting_reply_since"] is None  # a move clears it, as ever
    client.post(f"/api/v1/applications/{app['id']}/undo", json={})
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY  # the undo puts it back
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY


def test_a_reply_or_a_follow_up_since_keeps_it_when_the_round_is_put_back(client, seeded):
    app, one = _waiting_after_done(client, seeded)
    client.patch(f"/api/v1/applications/{app['id']}", json={"reply_to_read_since": TODAY})
    _mark(client, one["id"], "scheduled")
    detail = _detail(client, app["id"])
    assert (detail["awaiting_reply_since"], detail["reply_to_read_since"]) == (None, TODAY)

    app, one = _waiting_after_done(client, seeded)
    r = client.post(
        f"/api/v1/applications/{app['id']}/activities",
        params={"app_text": "followed_up"},
        json={"kind": "manual", "summary": "Followed up", "data": {}},
    )
    assert r.status_code == 201, r.text
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY


def test_putting_back_another_round_keeps_the_wait(client, seeded):
    app, one = _waiting_after_done(client, seeded)
    earlier = _round(client, app["id"], "Earlier chat", status="done")  # didn't start the wait
    _mark(client, earlier["id"], "cancelled")
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY
    # The round that did start it still can end it.
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] is None


def test_a_done_entry_from_before_this_doesnt_count(client, seeded):
    """A round marked done before waits started with it has no `waiting_since`: putting it back
    leaves a wait alone, even one on the same day."""
    app, one = _waiting_after_done(client, seeded)
    with client.app.state.sessions.begin() as session:
        for event in session.scalars(select(Event).where(Event.application_id == app["id"])):
            if WAITING_SINCE in (event.data or {}):
                event.data = {k: v for k, v in event.data.items() if k != WAITING_SINCE}
    _mark(client, one["id"], "scheduled")
    assert _detail(client, app["id"])["awaiting_reply_since"] == TODAY
