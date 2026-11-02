"""interviews: a round that needs a new time, who needed that, and the to-do to book it

Additive: three empty columns. Every existing round starts as not needing a new time.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-02 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("interviews", schema=None) as batch_op:
        batch_op.add_column(sa.Column("needs_new_time_since", jat.db.types.UTCDateTime(length=32), nullable=True))
        batch_op.add_column(sa.Column("needs_new_time_by", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("rebook_todo_id", sa.String(length=36), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("interviews", schema=None) as batch_op:
        batch_op.drop_column("rebook_todo_id")
        batch_op.drop_column("needs_new_time_by")
        batch_op.drop_column("needs_new_time_since")
