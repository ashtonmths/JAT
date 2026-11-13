"""Marking a round done starts waiting to hear back, so Today lists the application under Waiting."""

from datetime import UTC, datetime, timedelta

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
