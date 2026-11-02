"""Rejection feedback: what they said when they turned you down, one per application, as written."""

from __future__ import annotations

from jat.api.schemas import REJECTION_FEEDBACK_MAX

from .factories import post

FEEDBACK = "  Strong systems design ✓\n\nWanted more Go.  "


def _application(client, seeded, stage="applied"):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": stage})


def _move(client, app, to_stage, status=200, **body):
    r = client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": to_stage, **body})
    assert r.status_code == status, r.text
    return r.json()


def _put(client, app, feedback, status=200):
    r = client.put(f"/api/v1/applications/{app['id']}/rejection-feedback", json={"feedback": feedback})
    assert r.status_code == status, r.text
    return r.json()


def test_moving_to_rejected_keeps_the_feedback_as_written(client, seeded):
    app = _application(client, seeded)
    assert app["rejection_feedback"] is None
    moved = _move(client, app, "rejected", rejection_feedback=FEEDBACK)
    assert (moved["stage"], moved["rejection_feedback"]) == ("rejected", FEEDBACK)
    # On the list and the application, too.
    [row] = client.get("/api/v1/applications").json()
    assert row["rejection_feedback"] == FEEDBACK
    assert client.get(f"/api/v1/applications/{app['id']}").json()["rejection_feedback"] == FEEDBACK
    # The move's own timeline entry says nothing of it: the feedback can change, the history can't.
    assert all(FEEDBACK not in str(ev) for ev in moved["events"])


def test_a_move_without_feedback_saves_none_and_blank_saves_none(client, seeded):
    plain = _move(client, _application(client, seeded), "rejected")
    assert plain["rejection_feedback"] is None
    blank = _move(client, _application(client, seeded), "rejected", rejection_feedback=" \n ")
    assert blank["rejection_feedback"] is None


def test_feedback_only_goes_with_a_move_to_rejected(client, seeded):
    app = _application(client, seeded)
    r = client.post(
        f"/api/v1/applications/{app['id']}/move", json={"to_stage": "withdrawn", "rejection_feedback": "Nope"}
    )
    assert (r.status_code, r.json()) == (
        422,
        {
            "detail": "rejection feedback only goes with a move to 'rejected', not 'withdrawn'",
            "code": "rejection_feedback_wrong_stage",
            "params": {"to_stage": "'withdrawn'"},
        },
    )
    # Nothing moved.
    after = client.get(f"/api/v1/applications/{app['id']}").json()
    assert (after["stage"], after["rejection_feedback"], len(after["events"])) == ("applied", None, len(app["events"]))


def test_add_edit_and_clear_it_on_its_own(client, seeded):
    app = _move(client, _application(client, seeded), "rejected")
    quiet_since = app["last_activity_at"]
    added = _put(client, app, FEEDBACK)
    assert added["rejection_feedback"] == FEEDBACK
    edited = _put(client, app, "Went with someone local.")
    assert edited["rejection_feedback"] == "Went with someone local."
    assert _put(client, app, "   ")["rejection_feedback"] is None
    assert _put(client, app, "Back again")["rejection_feedback"] == "Back again"
    cleared = _put(client, app, None)
    assert cleared["rejection_feedback"] is None
    # A detail, not contact with anyone: no timeline entry, and it's still as quiet as it was.
    assert (cleared["last_activity_at"], len(cleared["events"])) == (quiet_since, len(app["events"]))


def test_an_application_never_rejected_cant_have_feedback(client, seeded):
    app = _application(client, seeded)
    r = client.put(f"/api/v1/applications/{app['id']}/rejection-feedback", json={"feedback": "Hmm"})
    assert (r.status_code, r.json()) == (
        422,
        {
            "detail": "this application hasn't been rejected, so it can't have rejection feedback",
            "code": "rejection_feedback_not_rejected",
            "params": {},
        },
    )
    # Clearing what isn't there does nothing, and is fine.
    assert _put(client, app, None)["rejection_feedback"] is None
    assert client.put("/api/v1/applications/nope/rejection-feedback", json={"feedback": "x"}).status_code == 404


def test_undoing_the_rejection_keeps_the_feedback_which_stays_editable(client, seeded):
    app = _move(client, _application(client, seeded), "rejected", rejection_feedback=FEEDBACK)
    undone = client.post(f"/api/v1/applications/{app['id']}/undo").json()
    assert (undone["stage"], undone["rejection_feedback"]) == ("applied", FEEDBACK)
    # What's there can still be edited or cleared, though it's no longer rejected...
    assert _put(client, app, "Edited")["rejection_feedback"] == "Edited"
    assert _put(client, app, None)["rejection_feedback"] is None
    # ...but with nothing there, there's no rejection to add feedback about.
    _put(client, app, "New", status=422)
    # Rejected again, it can take some.
    assert _move(client, app, "rejected", rejection_feedback="New")["rejection_feedback"] == "New"


def test_reopening_keeps_it_and_rejected_again_replaces_it_only_when_given(client, seeded):
    app = _move(client, _application(client, seeded), "rejected", rejection_feedback=FEEDBACK)
    reopened = _move(client, app, "interviewing")  # transitions = "any": they came back
    assert reopened["rejection_feedback"] == FEEDBACK
    # It was rejected once, so feedback can be added or edited while it's open again, even from none.
    assert _put(client, app, None)["rejection_feedback"] is None
    assert _put(client, app, "First time: wanted more Go")["rejection_feedback"] == "First time: wanted more Go"
    again = _move(client, app, "rejected")  # nothing said this time: the earlier feedback stays
    assert again["rejection_feedback"] == "First time: wanted more Go"
    replaced = _move(client, _move(client, app, "interviewing"), "rejected", rejection_feedback="Second time")
    assert replaced["rejection_feedback"] == "Second time"
    cleared = _move(client, _move(client, app, "interviewing"), "rejected", rejection_feedback="")
    assert cleared["rejection_feedback"] is None


def test_an_application_added_straight_at_rejected_takes_feedback(client, seeded):
    app = _application(client, seeded, stage="rejected")
    assert _put(client, app, FEEDBACK)["rejection_feedback"] == FEEDBACK


def test_feedback_has_a_length_limit(client, seeded):
    app = _move(client, _application(client, seeded), "rejected")
    longest = "x" * REJECTION_FEEDBACK_MAX
    assert _put(client, app, longest)["rejection_feedback"] == longest
    too_long = longest + "x"
    body = _put(client, app, too_long, status=422)
    assert body["detail"][0]["type"] == "string_too_long"
    r = client.post(
        f"/api/v1/applications/{app['id']}/move", json={"to_stage": "interviewing", "rejection_feedback": too_long}
    )
    assert r.status_code == 422
    assert client.get(f"/api/v1/applications/{app['id']}").json()["rejection_feedback"] == longest


def test_a_workflow_without_a_rejected_stage_takes_none(app, client, seeded):
    (app.state.jat.data_dir / "config.toml").write_text(
        '[workflow]\ninitial = "applied"\ntransitions = "any"\n'
        '[[workflow.stages]]\nid = "applied"\n'
        '[[workflow.stages]]\nid = "turned_down"\nkind = "closed"\n'
    )
    application = _application(client, seeded)
    moved = _move(client, application, "turned_down")
    assert moved["rejection_feedback"] is None
    refused = _move(client, application, "applied", status=422, rejection_feedback="x")
    assert refused["code"] == "rejection_feedback_wrong_stage"
    assert _put(client, application, "x", status=422)["code"] == "rejection_feedback_not_rejected"
