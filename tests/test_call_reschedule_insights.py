"""Recruiter conversations count calls moved, by who, and leave waiting calls out of held and booked."""

from datetime import UTC, datetime, timedelta

from jat.db.models import MeetingMove

from .factories import post

URL = "/api/v1/insights/conversations"
MOVES = ("calls_moved", "call_moves", "moves_by_me", "moves_by_them", "moves_by_mutual")
MOVES += ("moves_by_neither", "moves_not_recorded")


def _at(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _call(client, contact_id, days, **extra):
    return post(client, "/api/v1/meetings", {"contact_id": contact_id, "starts_at": _at(days), **extra})


def _move(client, call, days, by=None):
    body = {"starts_at": _at(days), **({"reschedule_by": by} if by else {})}
    assert client.patch(f"/api/v1/meetings/{call['id']}", json=body).status_code == 200


def _counts(tally, *fields):
    return tuple(tally[f] for f in fields)


def test_calls_moved_by_who_and_waiting_calls(client, seeded):
    alex = seeded["recruiter"]["id"]
    sam = post(client, "/api/v1/contacts", {"name": "Sam Patel"})["id"]
    twice = _call(client, alex, 3)
    _move(client, twice, 4, by="them")
    _move(client, twice, 5)  # Edit form: no who
    once = _call(client, sam, 6)
    _move(client, once, 7, by="me")
    # Waiting: one ahead, one whose old time has passed; each has started a move, with its who.
    for days in (2, -1):
        waiting = _call(client, alex, days)
        r = client.post(f"/api/v1/meetings/{waiting['id']}/needs-new-time", json={"by": "mutual"})
        assert r.status_code == 200, r.text
    _call(client, alex, 8)  # booked, never moved
    held = _call(client, sam, -2, status="done")
    _move(client, held, -3)  # a done call's time changed: not a move

    total = client.get(URL).json()["total"]
    assert _counts(total, "calls_held", "calls_booked", "calls_waiting") == (1, 3, 2)
    assert _counts(total, *MOVES) == (4, 5, 1, 1, 2, 0, 1)
    people = {p["name"]: p for p in client.get(URL).json()["people"]}
    assert _counts(people["Alex Recruiter"], "calls_moved", "call_moves", "calls_waiting") == (3, 4, 2)
    assert _counts(people["Sam Patel"], "calls_moved", "moves_by_me") == (1, 1)
    [agency] = client.get(URL).json()["agencies"]  # Alex's
    assert _counts(agency, "calls_moved", "moves_by_them", "moves_by_mutual", "calls_waiting") == (3, 1, 2, 2)


def test_booking_a_waiting_call_counts_the_same_move_once(client, seeded):
    alex = seeded["recruiter"]["id"]
    call = _call(client, alex, 3)
    client.post(f"/api/v1/meetings/{call['id']}/needs-new-time", json={"by": "neither"})
    before = client.get(URL).json()["total"]
    _move(client, call, 9)
    after = client.get(URL).json()["total"]
    assert _counts(before, "calls_moved", "call_moves", "moves_by_neither", "calls_waiting", "calls_booked") == (
        1,
        1,
        1,
        1,
        0,
    )
    assert _counts(after, "calls_moved", "call_moves", "moves_by_neither", "calls_waiting", "calls_booked") == (
        1,
        1,
        1,
        0,
        1,
    )
    # Taken back instead: it didn't move.
    other = _call(client, alex, 4)
    client.post(f"/api/v1/meetings/{other['id']}/needs-new-time", json={"by": "me"})
    client.delete(f"/api/v1/meetings/{other['id']}/needs-new-time")
    assert client.get(URL).json()["total"]["call_moves"] == 1


def test_moves_count_with_their_call_s_period_and_odd_data_is_not_recorded(client, seeded, app):
    alex = seeded["recruiter"]["id"]
    old = _call(client, alex, -40, status="done")
    recent = _call(client, alex, 2)
    _move(client, recent, 3, by="them")
    with app.state.sessions.begin() as session:  # a move saved for the old call, with a hand-edited who
        session.add(
            MeetingMove(
                meeting_id=old["id"],
                from_at=datetime(2026, 1, 1, tzinfo=UTC),
                to_at=datetime(2026, 1, 2, tzinfo=UTC),
                by="blame",
            )
        )
    since = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    recent_only = client.get(URL, params={"since": since}).json()["total"]
    assert _counts(recent_only, "calls_moved", "moves_by_them", "moves_not_recorded") == (1, 1, 0)
    everything = client.get(URL).json()["total"]
    assert _counts(everything, "calls_moved", "moves_by_them", "moves_not_recorded") == (2, 1, 1)
