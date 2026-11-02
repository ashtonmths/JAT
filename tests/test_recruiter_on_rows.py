"""Rounds and offers carry their application's recruiter, so every card can name them."""

from datetime import UTC, date, datetime, timedelta

from .factories import post


def _iso(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def test_rounds_and_offers_name_the_recruiter(client, seeded):
    role, recruiter = seeded["role"]["id"], seeded["recruiter"]
    via = post(
        client,
        "/api/v1/applications",
        {"role_id": role, "route": "agency", "recruiter_id": recruiter["id"], "stage": "interviewing"},
    )
    direct = post(client, "/api/v1/applications", {"role_id": role, "stage": "interviewing"})
    rounds = {}
    for a in (via, direct):
        url = f"/api/v1/applications/{a['id']}/interviews"
        rounds[a["id"]] = [
            post(client, url, {"title": "Soon", "starts_at": _iso(2)}),
            post(client, url, {"title": "Missed", "starts_at": _iso(-1)}),
        ]
        respond_by = str(date.today() + timedelta(days=3))
        post(client, f"/api/v1/applications/{a['id']}/offers", {"salary": 80_000, "respond_by": respond_by})

    # Created, fetched and listed: all say who, or nobody when there's no recruiter.
    assert rounds[via["id"]][0]["recruiter_id"] == recruiter["id"]
    assert rounds[via["id"]][0]["recruiter_name"] == "Alex Recruiter"
    assert rounds[direct["id"]][0]["recruiter_id"] is None
    assert rounds[direct["id"]][0]["recruiter_name"] is None
    one = client.get(f"/api/v1/interviews/{rounds[via['id']][1]['id']}").json()
    assert one["recruiter_name"] == "Alex Recruiter"

    def names(items):
        return {(i["application_id"], i["recruiter_id"], i["recruiter_name"]) for i in items}

    expected = {(via["id"], recruiter["id"], "Alex Recruiter"), (direct["id"], None, None)}
    assert names(client.get("/api/v1/interviews").json()) == expected
    assert names(client.get("/api/v1/offers").json()) == expected
    na = client.get("/api/v1/next-actions").json()
    assert names(na["upcoming"]) == expected
    assert names(na["awaiting_outcome"]) == expected
    assert names(na["offer_deadlines"]) == expected

    # A round waiting for a new time says who too.
    client.post(f"/api/v1/interviews/{rounds[via['id']][0]['id']}/needs-new-time", json={"by": "them"})
    na = client.get("/api/v1/next-actions").json()
    assert [i["recruiter_name"] for i in na["needs_new_time"]] == ["Alex Recruiter"]

    # A new recruiter shows straight away.
    other = post(client, "/api/v1/contacts", {"name": "Sam Sourcer", "agency_id": seeded["agency"]["id"]})
    client.patch(f"/api/v1/applications/{via['id']}", json={"recruiter_id": other["id"]})
    assert client.get(f"/api/v1/interviews/{rounds[via['id']][1]['id']}").json()["recruiter_name"] == "Sam Sourcer"
