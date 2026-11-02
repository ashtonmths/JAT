"""applications: rejection feedback, what they said when they turned you down

Additive: one empty, nullable text column. Nothing existing is rewritten or backfilled: no
application had feedback before this.

Revision ID: 0017
Revises: 0016
Create Date: 2026-11-02 20:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.add_column(sa.Column("rejection_feedback", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.drop_column("rejection_feedback")
