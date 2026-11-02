"""A call that needs a new time: it can't go ahead at its time and no new one is agreed yet."""

import shutil
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.datadir import init_data_dir
from jat.db.models import Todo
from jat.snapshot import export_data_dir, restore_data_dir

from .factories import post


def _iso(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _app(client, seeded):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "interviewing"})


def _call(client, seeded, days=3, **extra):
    body = {"contact_id": seeded["recruiter"]["id"], "title": "Catch-up", "starts_at": _iso(days), **extra}
    return post(client, "/api/v1/meetings", body)


def _mark(client, call, status=200, **body):
    r = client.post(f"/api/v1/meetings/{call['id']}/needs-new-time", json={"by": "them", **body})
    assert r.status_code == status, r.text
    return r.json()


def _get(client, call):
    return client.get(f"/api/v1/meetings/{call['id']}").json()


def _todo(client, todo_id):
    return next((t for t in client.get("/api/v1/todos", params={"status": "all"}).json() if t["id"] == todo_id), None)


def _waiting(client):
    nxt = client.get("/api/v1/next-actions").json()
    ahead = [m["id"] for m in nxt["meetings"] + nxt["meetings_to_close"]]
    return [m["id"] for m in nxt["meetings_needs_new_time"]], ahead


BOOK = {"text": "Book a new time with Alex", "due_on": "2030-01-09"}


def test_marking_keeps_the_old_time_starts_the_move_and_adds_a_to_do_on_the_person(client, seeded):
    call = _call(client, seeded)
    out = _mark(client, call, reason="  Their manager   is away\n", todo=BOOK)
    assert (out["status"], out["starts_at"], out["needs_new_time_by"]) == ("scheduled", call["starts_at"], "them")
    assert out["needs_new_time_since"] is not None and out["rescheduled_count"] == 0
    assert out["moves"] == [
        {"from_at": call["starts_at"], "to_at": None, "by": "them", "reason": "Their manager is away"}
    ]
    todo = _todo(client, out["rebook_todo_id"])
    assert (todo["text"], todo["due_on"], todo["done_at"]) == (BOOK["text"], "2030-01-09", None)
    assert (todo["entity_type"], todo["entity_id"]) == ("contact", seeded["recruiter"]["id"])

    # It's waiting on Today, not coming up, and not booked ahead on the person's list.
    assert _waiting(client) == ([call["id"]], [])
    assert client.get("/api/v1/meetings", params={"upcoming": True}).json() == []
    # The Timeline doesn't show it at its old time, nor the move it hasn't made yet.
    items = client.get("/api/v1/timeline").json()["items"]
    assert not [i for i in items if call["id"] in i["id"] or i["reschedule"] is not None]


def test_a_call_on_an_application_gets_its_to_do_there(client, seeded):
    app = _app(client, seeded)
    out = _mark(client, _call(client, seeded, application_id=app["id"]), todo=BOOK)
    todo = _todo(client, out["rebook_todo_id"])
    assert (todo["entity_type"], todo["entity_id"]) == ("application", app["id"])
    assert _mark(client, _call(client, seeded), by="me")["rebook_todo_id"] is None  # no to-do asked for


def test_what_can_t_be_marked(client, seeded, app):
    done = _call(client, seeded, days=-1, status="done")
    assert _mark(client, done, status=409)["code"] == "call_not_booked"
    cancelled = _call(client, seeded, status="cancelled")
    assert _mark(client, cancelled, status=409)["detail"] == "only a booked call can need a new time"
    twice = _call(client, seeded)
    _mark(client, twice)
    assert _mark(client, twice, status=409)["code"] == "call_needs_new_time_already"
    blank = _call(client, seeded)
    assert _mark(client, blank, status=422, todo={"text": "   "})["code"] == "todo_text_required"
    assert client.post(f"/api/v1/meetings/{blank['id']}/needs-new-time", json={}).status_code == 422  # who
    assert _get(client, blank)["needs_new_time_since"] is None and _get(client, blank)["moves"] == []

    closed, archived = _app(client, seeded), _app(client, seeded)
    assert client.post(f"/api/v1/applications/{closed['id']}/move", json={"to_stage": "rejected"}).status_code == 200
    client.patch(f"/api/v1/applications/{archived['id']}", json={"archived": True})
    for application in (closed, archived):
        out = _mark(client, _call(client, seeded, application_id=application["id"]), status=409, todo=BOOK)
        assert out["code"] == "call_application_closed"

    person = post(client, "/api/v1/contacts", {"name": "Sam Gone"})
    with_them = _call(client, seeded, contact_id=person["id"])
    client.patch(f"/api/v1/contacts/{person['id']}", json={"closed_as": "not_interested"})
    out = _mark(client, with_them, status=409, todo=BOOK)
    assert (out["code"], out["detail"]) == (
        "call_person_closed",
        "the conversation with them is closed, so there's no new time to book",
    )
    with app.state.sessions.begin() as session:  # nothing was saved: no to-do left open
        assert session.query(Todo).count() == 0


def test_setting_the_new_time_is_the_one_move_with_the_marked_who_and_why(client, seeded):
    app = _app(client, seeded)
    call = _call(client, seeded, application_id=app["id"], ends_at=_iso(3).replace("Z", "") + "Z")
    call = client.patch(f"/api/v1/meetings/{call['id']}", json={"ends_at": None}).json()
    out = _mark(client, call, reason="A clash", todo=BOOK)
    later = _iso(6)
    booked = client.patch(f"/api/v1/meetings/{call['id']}", json={"starts_at": later}).json()
    assert (booked["rescheduled_count"], booked["rescheduled_from"], booked["starts_at"]) == (
        1,
        call["starts_at"],
        later,
    )
    assert (booked["needs_new_time_since"], booked["needs_new_time_by"], booked["rebook_todo_id"]) == (None, None, None)
    assert booked["moves"] == [{"from_at": call["starts_at"], "to_at": later, "by": "them", "reason": "A clash"}]
    assert _todo(client, out["rebook_todo_id"])["done_at"] is not None
    assert _waiting(client) == ([], [call["id"]])
    event = client.get(f"/api/v1/applications/{app['id']}").json()["events"][-1]
    assert event["summary"] == "Call with Alex Recruiter: Catch-up rescheduled (they needed the change): A clash"
    assert event["reschedule"] == booked["moves"][0]
    # Shown once on the Timeline: the application's entry.
    moves = [i for i in client.get("/api/v1/timeline").json()["items"] if i["reschedule"] is not None]
    assert [i["id"] for i in moves] == [f"event:{event['id']}"]


def test_a_who_sent_when_booking_replaces_the_marked_one(client, seeded):
    call = _call(client, seeded)
    _mark(client, call, reason="A clash")
    body = {"starts_at": _iso(5), "reschedule_by": "me", "reschedule_reason": "My fault"}
    booked = client.patch(f"/api/v1/meetings/{call['id']}", json=body).json()
    assert [(m["by"], m["reason"]) for m in booked["moves"]] == [("me", "My fault")]


@pytest.mark.parametrize("status", ["done", "cancelled"])
def test_happening_or_not_settles_it_without_a_move(client, seeded, status):
    call = _call(client, seeded)
    out = _mark(client, call, todo=BOOK)
    after = client.patch(f"/api/v1/meetings/{call['id']}", json={"status": status, "starts_at": _iso(5)}).json()
    assert (after["needs_new_time_since"], after["rescheduled_count"], after["moves"]) == (None, 0, [])
    assert _todo(client, out["rebook_todo_id"])["done_at"] is not None


def test_removing_it_ticks_its_to_do_off(client, seeded):
    call = _call(client, seeded)
    out = _mark(client, call, todo=BOOK)
    assert client.delete(f"/api/v1/meetings/{call['id']}").status_code == 204
    assert _todo(client, out["rebook_todo_id"])["done_at"] is not None


def test_undo_deletes_an_unchanged_to_do_and_keeps_one_you_ve_changed(client, seeded, app):
    plain, edited, ticked, gone = (_call(client, seeded, days=d) for d in (3, 4, 5, 6))
    ids = {c["id"]: _mark(client, c, todo=BOOK)["rebook_todo_id"] for c in (plain, edited, ticked, gone)}
    # Made a minute ago: an edit by hand can't come in the same second the to-do was made.
    with app.state.sessions.begin() as session:
        for todo in session.query(Todo):
            todo.created_at = todo.updated_at = todo.created_at - timedelta(minutes=1)
    client.patch(f"/api/v1/todos/{ids[edited['id']]}", json={"text": "Book it after Friday"})
    client.patch(f"/api/v1/todos/{ids[ticked['id']]}", json={"done": True})
    assert client.delete(f"/api/v1/todos/{ids[gone['id']]}").status_code == 204  # deleted by hand
    for call in (plain, edited, ticked, gone):
        r = client.delete(f"/api/v1/meetings/{call['id']}/needs-new-time")
        assert r.status_code == 200, r.text
        out = r.json()
        assert (out["needs_new_time_since"], out["moves"], out["starts_at"]) == (None, [], call["starts_at"])
    assert _todo(client, ids[plain["id"]]) is None
    assert _todo(client, ids[edited["id"]])["done_at"] is not None
    assert _todo(client, ids[ticked["id"]])["done_at"] is not None
    again = client.delete(f"/api/v1/meetings/{plain['id']}/needs-new-time")
    assert (again.status_code, again.json()["code"]) == (409, "call_needs_new_time_not")
    assert _waiting(client) == ([], [c["id"] for c in (plain, edited, ticked, gone)])


def test_closing_the_application_ticks_the_to_do_and_keeps_the_mark(client, seeded):
    closed, archived = _app(client, seeded), _app(client, seeded)
    calls = [_call(client, seeded, application_id=a["id"]) for a in (closed, archived)]
    todos = [_mark(client, c, todo=BOOK)["rebook_todo_id"] for c in calls]
    client.post(f"/api/v1/applications/{closed['id']}/move", json={"to_stage": "rejected"})
    client.patch(f"/api/v1/applications/{archived['id']}", json={"archived": True})
    assert all(_todo(client, t)["done_at"] is not None for t in todos)
    assert all(_get(client, c)["needs_new_time_since"] is not None for c in calls)
    assert _waiting(client) == ([], [])  # nothing left to book, so not on Today


@pytest.mark.parametrize("closed_as", ["not_interested", "ghosted"])
def test_closing_the_conversation_ticks_the_to_do_and_keeps_the_mark(client, seeded, closed_as):
    call = _call(client, seeded)
    todo_id = _mark(client, call, todo=BOOK)["rebook_todo_id"]
    r = client.patch(f"/api/v1/contacts/{seeded['recruiter']['id']}", json={"closed_as": closed_as})
    assert r.status_code == 200, r.text
    assert _todo(client, todo_id)["done_at"] is not None
    assert _get(client, call)["needs_new_time_since"] is not None
    assert _waiting(client) == ([], [])


def test_a_to_do_that_s_gone_is_skipped_when_it_s_booked(client, seeded):
    call = _call(client, seeded)
    todo_id = _mark(client, call, todo=BOOK)["rebook_todo_id"]
    assert client.delete(f"/api/v1/todos/{todo_id}").status_code == 204
    booked = client.patch(f"/api/v1/meetings/{call['id']}", json={"starts_at": _iso(7)})
    assert booked.status_code == 200 and booked.json()["rescheduled_count"] == 1


def test_a_waiting_call_survives_export_and_restore_and_can_still_be_undone(client, seeded, tmp_path):
    call = _call(client, seeded)
    marked = _mark(client, call, reason="A clash", todo=BOOK)
    data = tmp_path / "data"
    export_data_dir(data)
    fresh = tmp_path / "fresh"
    init_data_dir(fresh, commit=False)
    shutil.copytree(data / "export", fresh / "export", dirs_exist_ok=True)
    restore_data_dir(fresh)
    restored = TestClient(base_url="http://127.0.0.1", app=create_app(fresh, dist=tmp_path / "no-dist"))
    back = _get(restored, call)
    for field in ("needs_new_time_since", "needs_new_time_by", "rebook_todo_id", "moves", "starts_at"):
        assert back[field] == marked[field], field
    # The to-do came back as made, so Undo still deletes it.
    assert restored.delete(f"/api/v1/meetings/{call['id']}/needs-new-time").status_code == 200
    assert _todo(restored, marked["rebook_todo_id"]) is None
