"""meetings: rescheduling calls, as rounds can be, with each move kept in meeting_moves

Additive: five columns on meetings (the count starts at 0, the rest empty) and a new empty
table. Nothing existing is rewritten or backfilled: no call could be rescheduled before this.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-02 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("meetings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("rescheduled_count", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("rescheduled_from", jat.db.types.UTCDateTime(length=32), nullable=True))
        batch_op.add_column(sa.Column("needs_new_time_since", jat.db.types.UTCDateTime(length=32), nullable=True))
        batch_op.add_column(sa.Column("needs_new_time_by", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("rebook_todo_id", sa.String(length=36), nullable=True))
    op.create_table(
        "meeting_moves",
        sa.Column("meeting_id", sa.String(length=36), nullable=False),
        sa.Column("from_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.Column("to_at", jat.db.types.UTCDateTime(length=32), nullable=True),
        sa.Column("by", sa.String(length=20), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("meeting_moves", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_meeting_moves_meeting_id"), ["meeting_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("meeting_moves", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_meeting_moves_meeting_id"))
    op.drop_table("meeting_moves")
    with op.batch_alter_table("meetings", schema=None) as batch_op:
        batch_op.drop_column("rebook_todo_id")
        batch_op.drop_column("needs_new_time_by")
        batch_op.drop_column("needs_new_time_since")
        batch_op.drop_column("rescheduled_from")
        batch_op.drop_column("rescheduled_count")
