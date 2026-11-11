"""Fill a throwaway data directory with fictional demo data (for screenshots and trying things out).

    uv run python scripts/seed_demo.py /tmp/jat-demo
    uv run python scripts/seed_demo.py --lang zh-CN /tmp/jat-demo-zh   # the same demo in Chinese
    uv run jat --data-dir /tmp/jat-demo serve

Every name here is invented; example.com addresses only. Refuses any directory that isn't
new or empty, so it can't mix demo data into real data. The words are in `demo_content.py`,
one table per language; the shape of the data (stages, rounds, dates) is here and the same in each.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from pathlib import Path

from demo_content import CONTENT

from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import (
    Agency,
    Application,
    ApplicationDocument,
    Attachment,
    Company,
    Contact,
    ContactDetail,
    Document,
    DocumentVersion,
    Event,
    Interview,
    Link,
    Meeting,
    Offer,
    Reply,
    Role,
    Todo,
)
from jat.domain.applications import create_application, history, log_activity, log_message, move
from jat.domain.interviews import record
from jat.domain.offers import record as record_offer
from jat.domain.workflow import DEFAULT_WORKFLOW as W
from jat.storage.files import FileStore
from jat.storage.notes import NoteStore

NOW = datetime.now(UTC).replace(microsecond=0)


def tiny_pdf(text: str) -> bytes:
    """A one-page PDF saying `text`, small and made up, for demo attachments."""
    stream = f"BT /F1 24 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


def add_moves(s, apps: dict[str, Application], reasons: tuple[str, str]) -> None:
    """Moved rounds for Insights' Rescheduling block: three at one company and recruiter, one from
    the round's Edit form (no who) and one from before moves kept a record (only the count)."""
    s.flush()
    away, clash = reasons

    def move_round(key: str, round_no: int, by: str | None, reason: str = "", pushed_days: int = 2) -> None:
        app = apps[key]
        interview = s.query(Interview).filter_by(application_id=app.id, round=round_no).one()
        was = interview.starts_at - timedelta(days=pushed_days)
        interview.rescheduled_count += 1
        interview.rescheduled_from = was
        last_activity = app.last_activity_at
        record(s, app, interview, "rescheduled", reason=reason, by=by, moved_from=was)
        s.flush()
        ev = s.query(Event).filter(Event.application_id == app.id).order_by(Event.seq.desc()).first()
        ev.occurred_at = was - timedelta(days=3)  # in the past, so it isn't today's news
        app.last_activity_at = last_activity

    move_round("wideworld", 1, "them", away)
    # Moved twice: two days early to a day early, then to its final time.
    twice = s.query(Interview).filter_by(application_id=apps["wideworld"].id, round=2).one()
    final_time = twice.starts_at
    twice.starts_at = final_time - timedelta(days=1)
    move_round("wideworld", 2, "me", clash, 1)
    twice.starts_at = final_time
    move_round("wideworld", 2, "them", pushed_days=1)
    move_round("wideworld", 3, "mutual", pushed_days=3)
    move_round("litware", 1, None)
    older = s.query(Interview).filter_by(application_id=apps["contoso"].id, round=1).one()
    older.rescheduled_count = 1


# Interview rounds held on the day an application reached a stage: (stage, kind). The titles are
# in the content table, under the stage.
ROUNDS = [("screen", "screen"), ("interviewing", "hiring_manager"), ("final", "final")]

# (application, company, route, agency, recruiter, path through stages with days-ago). The keys
# look up the names, titles and tags in the content table.
APPLICATIONS = [
    ("contoso", "contoso", "agency", "northwind", "alex", [("applied", 24), ("screen", 18), ("interviewing", 9)]),
    ("fabrikam", "fabrikam", "direct", None, None, [("applied", 12)]),
    ("tailspin", "tailspin", "agency", "northwind", "alex", [("applied", 30), ("rejected", 20)]),
    (
        "wideworld",
        "wideworld",
        "agency",
        "blue",
        "sam",
        [("applied", 15), ("screen", 11), ("interviewing", 6), ("final", 2), ("offer", 1)],
    ),
    ("adventure", "adventure", "direct", None, None, [("applied", 3)]),
    (
        "litware",
        "litware",
        "referral",
        None,
        None,
        [("applied", 40), ("screen", 35), ("interviewing", 28), ("final", 21), ("offer", 3)],
    ),
    ("proseware", "proseware", "agency", "blue", "sam", [("applied", 26), ("ghosted", 4)]),
    ("northwind", "northwind", "direct", None, None, []),
    ("coho", "coho", "agency", "northwind", "jordan", [("applied", 9)]),
    # The same job applied for twice: directly first, then through a recruiter (duplicate warning).
    ("coho_direct", "coho", "direct", None, None, [("applied", 14)]),
    ("alpine", "alpine", "direct", None, None, [("applied", 50), ("screen", 45), ("withdrawn", 40)]),
]


def seed(path: Path, lang: str = "en") -> None:
    c = CONTENT[lang]
    # Only ever a missing or empty directory, so demo data can't land in real data (or ~).
    if path.exists() and any(path.iterdir()):
        sys.exit(f"{path} isn't empty; pick a new or empty directory for demo data.")
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    engine = make_engine(db_path(path))
    with session_factory(engine).begin() as s:
        agencies: dict[str, Agency] = {}
        recruiters: dict[str, Contact] = {}
        companies: dict[str, Company] = {}
        first_app: dict[str, Application] = {}  # company key -> its first application
        apps: dict[str, Application] = {}  # application key -> application
        for key, company, route, agency_key, recruiter_key, path_ in APPLICATIONS:
            title, tags = c["apps"][key]
            if company not in companies:
                name, website = c["companies"][company]
                companies[company] = Company(name=name, website=website)
                s.add(companies[company])
            agency = recruiter = None
            if agency_key:
                agency = agencies.get(agency_key)
                agency_name, domain = c["agencies"][agency_key]
                if agency is None:
                    agency = agencies[agency_key] = Agency(name=agency_name)
                    s.add(agency)
                    s.flush()
                recruiter = recruiters.get(recruiter_key)
                if recruiter is None:
                    recruiter_name, handle = c["recruiters"][recruiter_key]
                    recruiter = recruiters[recruiter_key] = Contact(
                        name=recruiter_name, agency_id=agency.id, title=c["recruiter_title"]
                    )
                    s.add(recruiter)
                    s.flush()
                    s.add(
                        ContactDetail(
                            contact_id=recruiter.id,
                            kind="email",
                            label=c["detail_labels"][0],
                            value=f"{handle}@{domain}.example.com",
                        )
                    )
                    s.add(
                        ContactDetail(
                            contact_id=recruiter.id,
                            kind="phone",
                            label=c["detail_labels"][1],
                            value=c["phone"].format(n=len(recruiters)),
                            position=1,
                        )
                    )
            s.flush()
            role = Role(
                company_id=companies[company].id, title=title, work_mode="hybrid", location=c["locations"].get(key)
            )
            if recruiter:  # their pitch, added just before the application
                role.contact_id = recruiter.id
                role.created_at = days_ago((path_[0][1] if path_ else 5) + 3)
            s.add(role)
            s.flush()
            first_day = path_[0][1] + 2 if path_ else 5
            app = create_application(
                s,
                W,
                role_id=role.id,
                route=route,
                tags=tags,
                agency_id=agency.id if agency else None,
                recruiter_id=recruiter.id if recruiter else None,
            )
            for ev in history(s, app.id):  # the creation event
                ev.occurred_at = days_ago(first_day)
            app.last_activity_at = days_ago(first_day)
            for stage, ago in path_:
                if stage == "applied":
                    app.applied_on = date.today() - timedelta(days=ago)
                move(s, W, app, stage, occurred_at=days_ago(ago))
            if recruiter and path_:
                log_activity(
                    s,
                    app,
                    "call",
                    summary=c["intro_call"].format(name=recruiter.name),
                    occurred_at=days_ago(path_[0][1] + 1),
                )
            apps[key] = app
            # Interview rounds for the stages it went through, and the next one if it's mid-process.
            reached = dict(path_)
            rounds = [(reached[stage], c["rounds"][stage], kind) for stage, kind in ROUNDS if stage in reached]
            if path_ and path_[-1][0] == "interviewing":
                rounds.append((-2, c["rounds"]["system_design"], "system_design"))  # in two days
            for n, (ago, round_title, kind) in enumerate(rounds, start=1):
                s.add(
                    Interview(
                        application_id=app.id,
                        round=n,
                        title=round_title,
                        kind=kind,
                        status="done" if ago >= 0 else "scheduled",
                        starts_at=days_ago(ago),
                        format="video",
                        meeting_url="https://meet.example.com/demo",
                    )
                )
            first_app.setdefault(company, app)
        add_moves(s, apps, c["move_reasons"])
        # Notes are Markdown files under notes/, indexed in the database.
        store = NoteStore(path)
        (call_title, call_body), (plan_title, plan_body) = c["notes"]
        for title, body, links in [
            (
                call_title,
                call_body,
                [f"application:{first_app['contoso'].id}", f"company:{companies['contoso'].id}"],
            ),
            (plan_title, plan_body, []),
        ]:
            store.index(s, store.create(title, body, links))
        # Two offers to compare: a permanent package and a contract.
        s.add_all(
            [
                Offer(
                    application_id=first_app["litware"].id,
                    employment_type="permanent",
                    currency=c["currency"],
                    received_on=date.today() - timedelta(days=3),
                    respond_by=date.today() + timedelta(days=4),
                    **c["offer_permanent"],
                ),
                Offer(
                    application_id=first_app["wideworld"].id,
                    employment_type="contract",
                    currency=c["currency"],
                    contract_months=6,
                    received_on=date.today() - timedelta(days=1),
                    respond_by=date.today() + timedelta(days=9),
                    **c["offer_contract"],
                ),
            ]
        )
        # Calls with a recruiter that aren't about one application: one had, one booked.
        first_recruiter = next(iter(recruiters.values()))
        catch_up_title, catch_up_notes = c["catch_up"]
        catch_up = Meeting(
            contact_id=first_recruiter.id,
            kind="call",
            title=catch_up_title,
            status="done",
            starts_at=days_ago(6),
            notes=catch_up_notes,
        )
        s.add(catch_up)
        s.flush()
        # The roles from that call: two still to decide, one passed on.
        startup_name, startup_website = c["companies"]["startup"]
        startup = Company(name=startup_name, website=startup_website)
        s.add(startup)
        s.flush()
        pitched = dict(contact_id=first_recruiter.id, meeting_id=catch_up.id, created_at=days_ago(6))
        contract_role = Role(company_id=companies["fabrikam"].id, work_mode="remote", **c["role_contract"], **pitched)
        founding_role = Role(company_id=startup.id, **c["role_founding"], **pitched)
        s.add_all(
            [
                contract_role,
                founding_role,
                Role(
                    company_id=companies["proseware"].id,
                    decision="passed",
                    decided_on=date.today() - timedelta(days=5),
                    **c["role_passed"],
                    **pitched,
                ),
            ]
        )
        earlier_title, earlier_notes = c["earlier_catch_up"]
        new_year_title, new_year_agenda = c["new_year"]
        s.add_all(
            [
                Meeting(
                    contact_id=first_recruiter.id,
                    kind="call",
                    title=earlier_title,
                    status="done",
                    starts_at=days_ago(30),
                    notes=earlier_notes,
                ),
                Meeting(
                    contact_id=first_recruiter.id,
                    kind="video",
                    title=new_year_title,
                    starts_at=days_ago(-1),
                    meeting_url="https://meet.example.com/catch-up",
                    agenda=new_year_agenda,
                ),
            ]
        )
        sam, jordan = recruiters["sam"], recruiters["jordan"]
        sam_call = Meeting(contact_id=sam.id, kind="call", title=c["sam_call"], status="done", starts_at=days_ago(19))
        jordan_call = Meeting(
            contact_id=jordan.id, kind="video", title=c["jordan_call"], status="done", starts_at=days_ago(12)
        )
        s.add_all([sam_call, jordan_call])
        s.flush()
        s.add_all(
            [
                Role(
                    company_id=companies["adventure"].id,
                    employment_type="contract",
                    decision="passed",
                    decided_on=date.today() - timedelta(days=17),
                    contact_id=sam.id,
                    meeting_id=sam_call.id,
                    created_at=days_ago(19),
                    **c["role_sre"],
                ),
                Role(
                    company_id=companies["tailspin"].id,
                    work_mode="hybrid",
                    contact_id=jordan.id,
                    meeting_id=jordan_call.id,
                    created_at=days_ago(12),
                    **c["role_frontend"],
                ),
            ]
        )
        # They've replied and it's waiting to be read: on an application, and from a recruiter.
        first_app["fabrikam"].reply_to_read_since = date.today()
        other_recruiter = [r for r in recruiters.values() if r.id != first_recruiter.id][0]
        other_recruiter.reply_to_read_since = date.today() - timedelta(days=1)
        # Waiting to hear back: one just sent, one past its stage's limit (red: time to chase),
        # and a recruiter taking longer than they usually do.
        apps["adventure"].awaiting_reply_since = date.today() - timedelta(days=2)
        apps["coho"].awaiting_reply_since = date.today() - timedelta(days=8)
        first_recruiter.awaiting_reply_since = date.today() - timedelta(days=4)
        recruiters["jordan"].favourite = True
        # A follow-up that's due, a call whose time has passed (How did it go?), and a round
        # that isn't booked yet, so every section of Today has something in it.
        apps["northwind"].follow_up_on = date.today() - timedelta(days=1)
        s.add(Meeting(contact_id=recruiters["sam"].id, kind="call", title=c["feedback_call"], starts_at=days_ago(1)))
        s.add(
            Interview(
                application_id=apps["contoso"].id,
                round=4,
                title=c["rounds"]["final"],
                kind="final",
                status="scheduled",
            )
        )
        # To-dos in your own words: about a person, a company, a role, and one about nothing.
        s.flush()
        todo_person, todo_company, todo_role, todo_done = c["todos"]
        s.add_all(
            [
                Todo(text=todo_person, entity_type="contact", entity_id=first_recruiter.id),
                Todo(text=todo_company, entity_type="company", entity_id=startup.id, due_on=date.today()),
                Todo(
                    text=todo_role,
                    entity_type="role",
                    entity_id=contract_role.id,
                    due_on=date.today() + timedelta(days=2),
                ),
                Todo(text=todo_done, done_at=days_ago(2)),
                # Alex usually gets back within a couple of working days; Sam takes longer.
                *(
                    Reply(contact_id=recruiters[key].id, waited_since=start, replied_on=start + timedelta(days=gap))
                    for key, start, gap in (
                        ("alex", date(2026, 9, 7), 2),
                        ("alex", date(2026, 9, 18), 3),
                        ("alex", date(2026, 9, 28), 1),
                        ("sam", date(2026, 9, 8), 6),
                        ("sam", date(2026, 9, 22), 9),
                    )
                ),
            ]
        )
        # A CV with two versions and a cover letter, recorded against most applications, so
        # Insights can compare them.
        cv_name, v2_label, v3_label, v3_notes = c["cv"]
        letter_name, plain_label = c["letter"]
        cv = Document(kind="cv", name=cv_name)
        letter = Document(kind="cover_letter", name=letter_name)
        s.add_all([cv, letter])
        s.flush()
        v2 = DocumentVersion(document_id=cv.id, label=v2_label, created_at=days_ago(60))
        v3 = DocumentVersion(document_id=cv.id, label=v3_label, notes=v3_notes, created_at=days_ago(45))
        plain = DocumentVersion(document_id=letter.id, label=plain_label, created_at=days_ago(60))
        s.add_all([v2, v3, plain])
        s.flush()
        sent = {
            v2: ["tailspin", "proseware", "fabrikam", "coho_direct", "alpine"],
            v3: ["contoso", "wideworld", "litware", "adventure", "coho"],
            plain: ["litware", "fabrikam", "alpine"],
        }
        for version, keys in sent.items():
            for key in keys:
                s.add(ApplicationDocument(application_id=apps[key].id, document_version_id=version.id))
        # A document with no versions yet, so its empty state shows.
        s.add(Document(kind="other", name=c["portfolio"]))
        # Files: a CV attached to an application with none recorded and to its role (waiting to be
        # adopted on Documents), a job description on a role (shown on its application too), and
        # a rate card from a recruiter. Tiny made-up PDFs.
        files = FileStore(path)
        lead = apps["northwind"]
        for entity_type, entity_id, (name, text) in [
            ("application", lead.id, c["files"]["cv"]),
            ("role", lead.role_id, c["files"]["cv"]),
            ("role", apps["fabrikam"].role_id, c["files"]["jd"]),
            ("contact", recruiters["sam"].id, c["files"]["rates"]),
        ]:
            stored = files.save(BytesIO(tiny_pdf(text)), name)
            s.add(
                Attachment(
                    id=stored.id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    path=stored.path,
                    original_name=name,
                    content_type="application/pdf",
                    size=stored.size,
                    sha256=stored.sha256,
                    created_at=days_ago(2),
                )
            )
            if entity_type == "application":  # as uploading one does: "File added" on its timeline
                log_message(
                    s,
                    lead,
                    "file",
                    key="event.fileAdded",
                    params={"name": name},
                    summary=f"File added: {name}",
                    occurred_at=days_ago(2),
                    data={"attachment_id": stored.id},
                )
        # Links on an application, a role, a company and a person.
        on_app, on_role, on_company, on_person = c["links"]
        s.add_all(
            [
                Link(entity_type="application", entity_id=apps["contoso"].id, url=on_app[0], title=on_app[1]),
                Link(entity_type="role", entity_id=founding_role.id, url=on_role[0], title=on_role[1]),
                Link(entity_type="company", entity_id=companies["contoso"].id, url=on_company[0], title=on_company[1]),
                Link(entity_type="contact", entity_id=recruiters["alex"].id, url=on_person[0], title=on_person[1]),
            ]
        )
        # Two offers that ended: one you turned down before withdrawing, one the company took back
        # before rejecting you. Each on its application's timeline, as the app records it.
        for key, ended_ago, offer in [
            (
                "alpine",
                41,
                Offer(
                    status="declined",
                    employment_type="permanent",
                    currency=c["currency"],
                    received_on=date.today() - timedelta(days=43),
                    **c["offer_declined"],
                ),
            ),
            (
                "tailspin",
                21,
                Offer(
                    status="withdrawn",
                    employment_type="fixed_term",
                    currency=c["currency"],
                    contract_months=12,
                    received_on=date.today() - timedelta(days=23),
                    **c["offer_withdrawn"],
                ),
            ),
        ]:
            app = apps[key]
            offer.application_id = app.id
            s.add(offer)
            s.flush()
            before = app.last_activity_at
            record_offer(s, app, offer, offer.status)
            event = s.query(Event).filter_by(application_id=app.id).order_by(Event.seq.desc()).first()
            event.occurred_at = days_ago(ended_ago)
            app.last_activity_at = max(before, event.occurred_at)
    engine.dispose()
    print(f"Seeded {len(APPLICATIONS)} demo applications in {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("dir", help="a new or empty folder for the demo data")
    parser.add_argument("--lang", choices=sorted(CONTENT), default="en", help="the language of the demo's words")
    args = parser.parse_args()
    seed(Path(args.dir).expanduser().resolve(), args.lang)
