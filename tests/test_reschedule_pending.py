"""A round that needs a new time: it can't go ahead at its time and no new one is agreed yet."""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import text

from jat.db import make_engine, migrate
from jat.db.models import Todo

from .factories import post


def _iso(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _app(client, seeded, stage="interviewing"):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": stage})


def _round(client, app, days=3, **extra):
    url = f"/api/v1/applications/{app['id']}/interviews"
    return post(client, url, {"kind": "technical", "starts_at": _iso(days), **extra})


def _mark(client, made, status=200, **body):
    r = client.post(f"/api/v1/interviews/{made['id']}/needs-new-time", json={"by": "them", **body})
    assert r.status_code == status, r.text
    return r.json()


def _events(client, app):
    return client.get(f"/api/v1/applications/{app['id']}").json()["events"]


def _todos(client, app, status="all"):
    params = {"entity_type": "application", "entity_id": app["id"], "status": status}
    return client.get("/api/v1/todos", params=params).json()


def test_marking_keeps_the_old_time_and_says_who_and_why(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app, ends_at=None)
    out = _mark(client, made, reason="  Their manager   is away\n", todo={"text": "Book a new time", "due_on": None})
    assert out["status"] == "scheduled" and out["starts_at"] == made["starts_at"]
    assert out["needs_new_time_by"] == "them" and out["needs_new_time_since"] is not None
    assert (out["rescheduled_count"], out["moves"]) == (0, [])  # not a whole move yet
    event = _events(client, app)[-1]
    assert event["summary"] == "Round 1 · Technical needs a new time (they needed the change): Their manager is away"
    assert event["data"]["reschedule"] == {
        "from": made["starts_at"].replace("Z", "+00:00"),
        "to": None,
        "by": "them",
        "reason": "Their manager is away",
    }
    assert event["reschedule"] is None  # the typed field only holds whole moves
    [todo] = _todos(client, app)
    assert (todo["text"], todo["due_on"], todo["done_at"]) == ("Book a new time", None, None)
    assert out["rebook_todo_id"] == todo["id"]


def test_the_to_do_is_optional_and_can_be_dated(client, seeded):
    app = _app(client, seeded)
    out = _mark(client, _round(client, app))
    assert out["rebook_todo_id"] is None and _todos(client, app) == []
    other = _round(client, app, days=5)
    _mark(client, other, todo={"text": "Book it", "due_on": "2030-01-09"})
    assert [t["due_on"] for t in _todos(client, app)] == ["2030-01-09"]


def test_only_a_booked_round_waiting_for_nothing_can_be_marked(client, seeded):
    app = _app(client, seeded)
    unbooked = post(client, f"/api/v1/applications/{app['id']}/interviews", {"kind": "screen"})
    assert _mark(client, unbooked, status=409)["code"] == "round_not_booked"
    done = _round(client, app, days=-2, status="done")
    assert _mark(client, done, status=409)["code"] == "round_not_booked"
    made = _round(client, app)
    _mark(client, made)
    assert _mark(client, made, status=409)["code"] == "round_needs_new_time_already"
    assert len([e for e in _events(client, app) if "needs a new time" in (e["summary"] or "")]) == 1


def test_who_is_required_and_a_blank_to_do_saves_nothing(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    r = client.post(f"/api/v1/interviews/{made['id']}/needs-new-time", json={"reason": "x"})
    assert r.status_code == 422
    assert _mark(client, made, status=422, todo={"text": "   "})["code"] == "todo_text_required"
    assert client.get(f"/api/v1/interviews/{made['id']}").json()["needs_new_time_since"] is None
    assert _todos(client, app) == []


def test_the_new_time_is_the_move_from_the_old_one_and_ticks_the_to_do_off(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    marked = _mark(client, made, reason="A clash", todo={"text": "Book it"})
    later = _iso(6)
    out = client.patch(f"/api/v1/interviews/{made['id']}", json={"starts_at": later}).json()
    assert (out["needs_new_time_since"], out["needs_new_time_by"], out["rebook_todo_id"]) == (None, None, None)
    assert out["rescheduled_count"] == 1 and out["rescheduled_from"] == made["starts_at"]
    [move] = out["moves"]
    assert (move["by"], move["reason"]) == ("them", "A clash")
    assert (move["from_at"], move["to_at"]) == (made["starts_at"], later)
    assert _events(client, app)[-1]["summary"] == "Round 1 · Technical rescheduled (they needed the change): A clash"
    [todo] = _todos(client, app)
    assert todo["id"] == marked["rebook_todo_id"] and todo["done_at"] is not None


def test_the_end_moves_with_the_start_when_booked(client, seeded):
    app = _app(client, seeded)
    start = datetime.now(UTC).replace(microsecond=0) + timedelta(days=3)
    made = _round(client, app, starts_at=start.isoformat(), ends_at=(start + timedelta(hours=1)).isoformat())
    _mark(client, made)
    new = start + timedelta(days=2)
    out = client.patch(f"/api/v1/interviews/{made['id']}", json={"starts_at": new.isoformat()}).json()
    assert datetime.fromisoformat(out["ends_at"]) == new + timedelta(hours=1)


def test_who_and_why_sent_with_the_new_time_win(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    _mark(client, made, reason="Ill")
    body = {"starts_at": _iso(8), "reschedule_by": "me", "reschedule_reason": "Better day"}
    [move] = client.patch(f"/api/v1/interviews/{made['id']}", json=body).json()["moves"]
    assert (move["by"], move["reason"]) == ("me", "Better day")


def test_the_same_time_or_other_edits_dont_book_it(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    _mark(client, made, todo={"text": "Book it"})
    out = client.patch(
        f"/api/v1/interviews/{made['id']}", json={"starts_at": made["starts_at"], "prep": "Read up"}
    ).json()
    assert out["needs_new_time_since"] is not None and out["rescheduled_count"] == 0
    assert _todos(client, app, "open")


def test_undo_keeps_the_time_and_deletes_the_open_to_do(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    _mark(client, made, todo={"text": "Book it"})
    r = client.delete(f"/api/v1/interviews/{made['id']}/needs-new-time")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["needs_new_time_since"] is None and out["starts_at"] == made["starts_at"]
    assert out["rescheduled_count"] == 0 and _todos(client, app) == []
    assert _events(client, app)[-1]["summary"] == "Round 1 · Technical no longer needs a new time"
    again = client.delete(f"/api/v1/interviews/{made['id']}/needs-new-time")
    assert (again.status_code, again.json()["code"]) == (409, "round_needs_new_time_not")


def test_undo_leaves_a_to_do_already_ticked_off(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    todo_id = _mark(client, made, todo={"text": "Book it"})["rebook_todo_id"]
    client.patch(f"/api/v1/todos/{todo_id}", json={"done": True})
    client.delete(f"/api/v1/interviews/{made['id']}/needs-new-time")
    assert [t["id"] for t in _todos(client, app, "done")] == [todo_id]


def test_cancelling_or_removing_the_round_ticks_the_to_do_off(client, seeded):
    app = _app(client, seeded)
    cancelled, removed = _round(client, app), _round(client, app, days=4)
    _mark(client, cancelled, todo={"text": "Book round 1"})
    _mark(client, removed, todo={"text": "Book round 2"})
    out = client.patch(f"/api/v1/interviews/{cancelled['id']}", json={"status": "cancelled"}).json()
    assert out["needs_new_time_since"] is None and out["rescheduled_count"] == 0
    assert client.delete(f"/api/v1/interviews/{removed['id']}").status_code == 204
    assert _todos(client, app, "open") == [] and len(_todos(client, app, "done")) == 2


def test_closing_the_application_ticks_the_to_do_off_but_the_round_still_needs_a_time(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    _mark(client, made, todo={"text": "Book it"})
    r = client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "rejected"})
    assert r.status_code == 200, r.text
    assert _todos(client, app, "open") == []
    assert client.get(f"/api/v1/interviews/{made['id']}").json()["needs_new_time_by"] == "them"
    # Undoing the close brings the round back to Today; its to-do stays ticked off.
    assert client.post(f"/api/v1/applications/{app['id']}/undo").status_code == 200
    assert [i["id"] for i in client.get("/api/v1/next-actions").json()["needs_new_time"]] == [made["id"]]
    assert _todos(client, app, "open") == []


def test_today_lists_it_as_yours_and_not_as_coming_up_or_gone_quiet(client, seeded):
    app = _app(client, seeded)
    soon, past = _round(client, app), _round(client, app, days=-1)
    _mark(client, soon, todo={"text": "Book it"})
    _mark(client, past)
    today = client.get("/api/v1/next-actions").json()
    assert [i["id"] for i in today["needs_new_time"]] == [soon["id"], past["id"]]
    assert today["upcoming"] == [] and today["awaiting_outcome"] == []
    assert [t["text"] for t in today["todos"]] == ["Book it"]
    with client.app.state.sessions.begin() as session:  # quiet for a year: still yours, not gone quiet
        session.execute(text("UPDATE applications SET last_activity_at = '2025-01-01T00:00:00Z'"))
    row = client.get(f"/api/v1/applications/{app['id']}").json()
    assert row["stale"] is False and row["current_round"]["needs_new_time_by"] == "them"
    assert client.get("/api/v1/next-actions").json()["stale"] == []
    upcoming = client.get("/api/v1/interviews", params={"upcoming": True}).json()
    assert upcoming == []


def test_the_timeline_page_doesnt_show_it_at_its_old_time(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    _mark(client, made)
    items = client.get("/api/v1/timeline").json()["items"]
    assert f"interview:{made['id']}" not in {i["id"] for i in items}
    assert any((i.get("title") or "").endswith("needs a new time (they needed the change)") for i in items)


def test_insights_count_a_waiting_round_as_booked_and_moved_once(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    url = "/api/v1/insights/rescheduling"
    _mark(client, made, by="me")
    stats = client.get(url).json()
    assert (stats["booked_rounds"], stats["moved_rounds"], stats["moves"], stats["by_me"]) == (1, 1, 1, 1)
    assert stats["not_recorded"] == 0
    client.patch(f"/api/v1/interviews/{made['id']}", json={"starts_at": _iso(9)})
    assert client.get(url).json() == stats  # booking completes the same move
    other = _round(client, app, days=4)
    _mark(client, other)
    client.delete(f"/api/v1/interviews/{other['id']}/needs-new-time")
    assert client.get(url).json() == {**stats, "booked_rounds": 2}  # taken back: booked, no move


def test_rounds_from_before_have_none_of_it(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0014")
    eng = make_engine(path)
    ts = "'2026-01-01T09:00:00Z'"
    with eng.begin() as conn:
        conn.execute(text(f"INSERT INTO companies (id, name, created_at, updated_at) VALUES ('c', 'C', {ts}, {ts})"))
        conn.execute(
            text(
                f"INSERT INTO roles (id, company_id, title, created_at, updated_at) VALUES ('r', 'c', 'T', {ts}, {ts})"
            )
        )
        conn.execute(
            text(
                "INSERT INTO applications (id, role_id, route, stage, last_activity_at, tags, archived, created_at, "
                f"updated_at) VALUES ('a', 'r', 'direct', 'applied', {ts}, '[]', 0, {ts}, {ts})"
            )
        )
        conn.execute(
            text(
                "INSERT INTO interviews (id, application_id, round, kind, status, starts_at, rescheduled_count, "
                f"created_at, updated_at) VALUES ('i', 'a', 1, 'technical', 'scheduled', {ts}, 2, {ts}, {ts})"
            )
        )
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        row = conn.execute(
            text(
                "SELECT starts_at, rescheduled_count, needs_new_time_since, needs_new_time_by, rebook_todo_id "
                "FROM interviews"
            )
        ).one()
    eng.dispose()
    assert tuple(row) == ("2026-01-01T09:00:00Z", 2, None, None, None)


def test_a_todo_made_for_it_is_an_ordinary_to_do(client, seeded):
    """It's on the application, editable, and listed like any other."""
    app = _app(client, seeded)
    todo_id = _mark(client, _round(client, app), todo={"text": "Book it", "due_on": str(date(2030, 1, 9))})[
        "rebook_todo_id"
    ]
    with client.app.state.sessions.begin() as session:
        todo = session.get(Todo, todo_id)
        assert (todo.entity_type, todo.entity_id) == ("application", app["id"])
