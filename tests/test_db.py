from datetime import UTC, date, datetime, timedelta, timezone

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import inspect, text

from jat.db import Base, current_revision, head_revision, make_engine, migrate, session_factory
from jat.db.models import Application, Company, Event, Role


@pytest.fixture
def engine(tmp_path):
    path = tmp_path / "t.sqlite3"
    migrate(path)
    eng = make_engine(path)
    yield eng
    eng.dispose()


def test_migrations_match_models(engine):
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == []
    assert current_revision(engine) == head_revision()
    assert "applications" in inspect(engine).get_table_names()


def test_pragmas(engine):
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert conn.execute(text("PRAGMA journal_mode")).scalar() == "wal"


def test_models_roundtrip_types(engine):
    Session = session_factory(engine)
    bst = timezone(timedelta(hours=1))
    with Session.begin() as s:
        company = Company(name="Contoso")
        s.add(company)
        s.flush()
        role = Role(company_id=company.id, title="Backend Engineer", salary_min=70000, currency="GBP")
        s.add(role)
        s.flush()
        app = Application(role_id=role.id, stage="applied", applied_on=date(2026, 9, 30), tags=["python"])
        s.add(app)
        s.flush()
        s.add(
            Event(
                application_id=app.id,
                kind="stage_change",
                to_stage="applied",
                occurred_at=datetime(2026, 9, 30, 15, 0, tzinfo=bst),
                data={"note": "via site"},
            )
        )
        app_id = app.id
    with Session() as s:
        app = s.get(Application, app_id)
        assert app.applied_on == date(2026, 9, 30) and app.tags == ["python"]
        (event,) = s.query(Event).all()
        assert event.occurred_at == datetime(2026, 9, 30, 14, 0, tzinfo=UTC)
        assert event.data == {"note": "via site"}
        raw = s.execute(text("select occurred_at from events")).scalar()
        assert raw == "2026-09-30T14:00:00Z"
        assert len(app.id) == 36


def test_naive_datetime_rejected(engine):
    Session = session_factory(engine)
    with pytest.raises(Exception, match="naive"), Session.begin() as s:
        s.add(Company(name="X", created_at=datetime(2026, 1, 1)))


def test_foreign_keys_enforced(engine):
    Session = session_factory(engine)
    with pytest.raises(Exception, match="FOREIGN KEY"), Session.begin() as s:
        s.add(Role(company_id="missing", title="x"))


def test_datetime_precision_is_fixed(engine):
    Session = session_factory(engine)
    with Session.begin() as s:
        s.add(Company(name="A", created_at=datetime(2026, 9, 30, 14, 5, 7, 123456, tzinfo=UTC)))
    with engine.connect() as conn:
        assert conn.execute(text("select created_at from companies")).scalar() == "2026-09-30T14:05:07Z"


def test_date_column_rejects_datetime(engine):
    Session = session_factory(engine)
    with pytest.raises(Exception, match="expected a date"), Session.begin() as s:
        company = Company(name="C")
        s.add(company)
        s.flush()
        role = Role(company_id=company.id, title="t")
        s.add(role)
        s.flush()
        s.add(Application(role_id=role.id, stage="applied", applied_on=datetime(2026, 9, 30, tzinfo=UTC)))
        s.flush()


def test_0002_backfills_seq_in_insert_order(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0001")
    eng = make_engine(path)
    with eng.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO companies (id, name, created_at, updated_at) "
                "VALUES ('c', 'C', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO roles (id, company_id, title, created_at, updated_at) "
                "VALUES ('r', 'c', 'T', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO applications (id, role_id, route, stage, last_activity_at, tags, archived, created_at, "
                "updated_at) VALUES ('a', 'r', 'direct', 'applied', '2026-01-01T00:00:00Z', '[]', 0, "
                "'2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
        )
        for eid in ("zzz", "aaa", "mmm"):  # ids deliberately not in insert order
            conn.execute(
                text(
                    "INSERT INTO events (id, application_id, kind, occurred_at, data, created_at) "
                    f"VALUES ('{eid}', 'a', 'note', '2026-01-01T00:00:00Z', '{{}}', '2026-01-01T00:00:00Z')"
                )
            )
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        rows = conn.execute(text("SELECT id, seq FROM events ORDER BY seq")).all()
    eng.dispose()
    assert rows == [("zzz", 1), ("aaa", 2), ("mmm", 3)]


def test_0003_numbers_existing_interviews_per_application(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0002")
    eng = make_engine(path)
    ts = "'2026-01-01T00:00:00Z'"
    with eng.begin() as conn:
        conn.execute(text(f"INSERT INTO companies (id, name, created_at, updated_at) VALUES ('c', 'C', {ts}, {ts})"))
        conn.execute(
            text(
                f"INSERT INTO roles (id, company_id, title, created_at, updated_at) VALUES ('r', 'c', 'T', {ts}, {ts})"
            )
        )
        for app_id in ("a", "b"):
            conn.execute(
                text(
                    "INSERT INTO applications (id, role_id, route, stage, last_activity_at, tags, archived, "
                    f"created_at, updated_at) VALUES ('{app_id}', 'r', 'direct', 'interviewing', {ts}, '[]', 0, "
                    f"{ts}, {ts})"
                )
            )
        for iid, app_id, starts in [
            ("i3", "a", "'2026-03-01T10:00:00Z'"),
            ("i1", "a", "'2026-01-05T10:00:00Z'"),
            ("i2", "a", "NULL"),  # no time yet: falls back to created_at (2026-01-01), so first
            ("j1", "b", "'2026-02-01T10:00:00Z'"),
        ]:
            conn.execute(
                text(
                    "INSERT INTO interviews (id, application_id, kind, status, starts_at, created_at, updated_at) "
                    f"VALUES ('{iid}', '{app_id}', 'technical', 'scheduled', {starts}, {ts}, {ts})"
                )
            )
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        rows = dict(conn.execute(text("SELECT id, round FROM interviews")).all())
    eng.dispose()
    assert rows == {"i2": 1, "i1": 2, "i3": 3, "j1": 1}


def test_failed_migration_rolls_back(tmp_path):
    from jat.db import MigrationError

    path = tmp_path / "m.sqlite3"
    with pytest.raises(MigrationError):
        migrate(path, "nonexistent")
    eng = make_engine(path)
    assert "companies" not in inspect(eng).get_table_names()
    eng.dispose()


def test_0012_existing_people_are_not_favourites(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0011")
    eng = make_engine(path)
    ts = "'2026-01-01T00:00:00Z'"
    with eng.begin() as conn:
        conn.execute(text(f"INSERT INTO contacts (id, name, created_at, updated_at) VALUES ('p', 'P', {ts}, {ts})"))
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        assert conn.execute(text("SELECT favourite FROM contacts WHERE id = 'p'")).scalar_one() == 0
    eng.dispose()


def _old_history(path, rows):
    """A database at 0012 with one application per (id, first stage, summary)."""
    migrate(path, "0012")
    eng = make_engine(path)
    ts = "'2026-01-01T09:00:00Z'"
    with eng.begin() as conn:
        conn.execute(text(f"INSERT INTO companies (id, name, created_at, updated_at) VALUES ('c', 'C', {ts}, {ts})"))
        conn.execute(
            text(
                f"INSERT INTO roles (id, company_id, title, created_at, updated_at) VALUES ('r', 'c', 'T', {ts}, {ts})"
            )
        )
        for seq, (app_id, stage) in enumerate(rows, start=1):
            conn.execute(
                text(
                    "INSERT INTO applications (id, role_id, route, stage, last_activity_at, tags, archived, "
                    f"created_at, updated_at) VALUES ('{app_id}', 'r', 'direct', '{stage}', {ts}, '[]', 0, {ts}, {ts})"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO events (id, seq, application_id, kind, occurred_at, to_stage, summary, data, "
                    f"created_at) VALUES ('e-{app_id}', {seq}, '{app_id}', 'stage_change', {ts}, '{stage}', "
                    f"'Application created', '{{}}', {ts})"
                )
            )
    eng.dispose()


def _stage_events(path):
    eng = make_engine(path)
    with eng.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT application_id, from_stage, to_stage, occurred_at, summary, data FROM events "
                "ORDER BY application_id, occurred_at, seq"
            )
        ).all()
    eng.dispose()
    out: dict[str, list[tuple]] = {}
    for r in rows:
        out.setdefault(r.application_id, []).append((r.from_stage, r.to_stage, r.occurred_at, r.summary, r.data))
    return out


def test_0013_fills_in_interested_before_applications_added_later_on(tmp_path):
    path = tmp_path / "old.sqlite3"
    _old_history(path, [("a", "applied"), ("b", "interested"), ("c", "rejected"), ("d", "gone")])
    migrate(path)
    events = _stage_events(path)
    implied = '{"implied": true}'
    assert events["a"] == [
        (None, "interested", "2026-01-01T08:59:59Z", "Application created", implied),
        ("interested", "applied", "2026-01-01T09:00:00Z", None, implied),
    ]
    assert events["c"][0][:2] == (None, "interested") and events["c"][1][:2] == ("interested", "rejected")
    assert len(events["b"]) == 1  # already started at Interested
    assert len(events["d"]) == 1  # a stage no longer in the workflow: left alone

    # Down again: the history is as it was.
    from alembic import command

    from jat.db.engine import alembic_config

    command.downgrade(alembic_config(path), "0012")
    events = _stage_events(path)
    assert events["a"] == [(None, "applied", "2026-01-01T09:00:00Z", "Application created", "{}")]
    assert len(events["c"]) == 1


def test_0013_uses_the_data_folders_first_stage(tmp_path):
    (tmp_path / "config.toml").write_text(
        '[workflow]\ninitial = "spotted"\n'
        '[[workflow.stages]]\nid = "spotted"\nname = "Spotted"\n'
        '[[workflow.stages]]\nid = "applied"\nname = "Applied"\n'
    )
    path = tmp_path / "tracker.sqlite3"
    _old_history(path, [("a", "applied")])
    migrate(path)
    assert [e[:2] for e in _stage_events(path)["a"]] == [(None, "spotted"), ("spotted", "applied")]


def test_0013_stops_when_config_toml_doesnt_load(tmp_path):
    from jat.db import MigrationError

    (tmp_path / "config.toml").write_text('[workflow]\ninitial = "spotted"\n[[workflow.stages]\n')  # a typo
    path = tmp_path / "tracker.sqlite3"
    _old_history(path, [("a", "applied")])
    with pytest.raises((RuntimeError, MigrationError), match="config.toml"):
        migrate(path)
    eng = make_engine(path)
    assert current_revision(eng) == "0012"
    eng.dispose()
    assert [e[:2] for e in _stage_events(path)["a"]] == [(None, "applied")]


def test_0013_leaves_unreadable_history_alone(tmp_path):
    path = tmp_path / "old.sqlite3"
    _old_history(path, [("a", "applied"), ("b", "applied")])
    eng = make_engine(path)
    with eng.begin() as conn:
        conn.execute(text("UPDATE events SET occurred_at = 'yesterday' WHERE application_id = 'a'"))
        conn.execute(text("UPDATE events SET data = 'not json' WHERE application_id = 'b'"))
    eng.dispose()
    migrate(path)
    events = _stage_events(path)
    assert (len(events["a"]), len(events["b"])) == (1, 1)


def test_0014_counts_reschedules_already_on_the_timeline(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0013")
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
        for iid in ("i1", "i2"):
            conn.execute(
                text(
                    "INSERT INTO interviews (id, application_id, round, kind, status, created_at, updated_at) "
                    f"VALUES ('{iid}', 'a', 1, 'technical', 'scheduled', {ts}, {ts})"
                )
            )
        for seq, (summary, data) in enumerate(
            [
                ("Round 1 rescheduled", '{"interview_id": "i1", "round": 1, "status": "scheduled"}'),
                ("Round 1 rescheduled: a clash", '{"interview_id": "i1", "round": 1, "status": "scheduled"}'),
                ("Round 1 rescheduled", '{"interview_id": "i1", "round": 1, "status": "scheduled"}'),
                ("Round 1 scheduled", '{"interview_id": "i2"}'),
                ("Round 1 rescheduled", "not json"),
                # Near misses: a title ending in the word, another change, a hand-logged entry.
                ("Round 1 · Not rescheduled scheduled", '{"interview_id": "i2", "round": 1, "status": "scheduled"}'),
                ("Round 1 · Not rescheduled removed", '{"interview_id": "i2", "round": 1, "status": "scheduled"}'),
                ("Call about Round 1 RESCHEDULED", '{"interview_id": "i2"}'),
            ],
            start=1,
        ):
            conn.execute(
                text(
                    "INSERT INTO events (id, seq, application_id, kind, occurred_at, summary, data, created_at) "
                    f"VALUES ('e{seq}', {seq}, 'a', 'interview', {ts}, :summary, :data, {ts})"
                ),
                {"summary": summary, "data": data},
            )
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        rows = dict(conn.execute(text("SELECT id, rescheduled_count FROM interviews")).all())
        assert conn.execute(text("SELECT rescheduled_from FROM interviews WHERE id = 'i1'")).scalar_one() is None
    eng.dispose()
    assert rows == {"i1": 2, "i2": 0}


def test_0016_leaves_every_call_as_it_was_and_never_moved(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0015")
    eng = make_engine(path)
    ts = "'2026-01-01T09:00:00Z'"
    with eng.begin() as conn:
        conn.execute(text(f"INSERT INTO contacts (id, name, created_at, updated_at) VALUES ('p', 'Sam', {ts}, {ts})"))
        for mid, status in (("m1", "scheduled"), ("m2", "done")):
            conn.execute(
                text(
                    "INSERT INTO meetings (id, contact_id, kind, title, status, starts_at, ends_at, agenda, "
                    f"created_at, updated_at) VALUES ('{mid}', 'p', 'call', 'Catch-up ✓', '{status}', {ts}, "
                    f"'2026-01-01T09:30:00Z', 'Rates', {ts}, {ts})"
                )
            )
        before = conn.execute(text("SELECT * FROM meetings ORDER BY id")).mappings().all()
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        after = conn.execute(text("SELECT * FROM meetings ORDER BY id")).mappings().all()
        moves = conn.execute(text("SELECT COUNT(*) FROM meeting_moves")).scalar_one()
    eng.dispose()
    new = {"rescheduled_count": 0, "rescheduled_from": None, "needs_new_time_since": None}
    new |= {"needs_new_time_by": None, "rebook_todo_id": None}
    assert [dict(row) for row in after] == [{**row, **new} for row in before]
    assert len(before) == 2 and moves == 0
