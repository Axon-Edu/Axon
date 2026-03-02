"""AI engine schema extensions and chapter_learning_states table.

Revision ID: 20260301_ai_engine
Revises: None (manual migration — apply after existing schema is in place)
Create Date: 2026-03-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260301_ai_engine'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. student_profiles: add AI engine columns ──
    op.add_column('student_profiles', sa.Column('learning_style_signals', postgresql.JSONB(), server_default='{}'))
    op.add_column('student_profiles', sa.Column('companion_summary', sa.Text(), nullable=True))

    # ── 2. chapters: add question_bank ──
    op.add_column('chapters', sa.Column('question_bank', postgresql.JSONB(), server_default='[]'))

    # ── 3. student_subject_contexts: rename + add columns ──
    # Rename comfort_level → confidence_level
    op.alter_column('student_subject_contexts', 'comfort_level', new_column_name='confidence_level')
    op.alter_column('student_subject_contexts', 'confidence_level', type_=sa.String(10))
    # Rename fears_confusions → anxiety_signals
    op.alter_column('student_subject_contexts', 'fears_confusions', new_column_name='anxiety_signals')
    # Add new columns
    op.add_column('student_subject_contexts', sa.Column('engagement_pattern', sa.Text(), nullable=True))
    op.add_column('student_subject_contexts', sa.Column('raw_sentiment_response', sa.Text(), nullable=True))
    # Add check constraint for confidence_level
    op.create_check_constraint(
        'ck_confidence_level',
        'student_subject_contexts',
        "confidence_level IN ('low', 'medium', 'high') OR confidence_level IS NULL"
    )

    # ── 4. learning_sessions: add AI engine columns ──
    # Make chapter_id nullable (companion sessions don't need a chapter)
    op.alter_column('learning_sessions', 'chapter_id', nullable=True)
    op.add_column('learning_sessions', sa.Column('session_type', sa.String(20), server_default='teaching'))
    op.add_column('learning_sessions', sa.Column('is_onboarding', sa.Boolean(), server_default='false'))
    op.add_column('learning_sessions', sa.Column('extracted_context', postgresql.JSONB(), nullable=True))
    op.add_column('learning_sessions', sa.Column('state_at_end', postgresql.JSONB(), nullable=True))
    # Add check constraint and index
    op.create_check_constraint(
        'ck_session_type',
        'learning_sessions',
        "session_type IN ('teaching', 'companion')"
    )
    op.create_index('idx_sessions_type', 'learning_sessions', ['session_type'])

    # ── 5. chapter_learning_states: new table ──
    op.create_table(
        'chapter_learning_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chapters.id'), nullable=False),
        sa.Column('current_node_index', sa.Integer(), server_default='0'),
        sa.Column('prerequisite_status', sa.String(20), server_default='not_started'),
        sa.Column('node_completion_log', postgresql.JSONB(), server_default='[]'),
        sa.Column('session_count', sa.Integer(), server_default='0'),
        sa.Column('last_session_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.UniqueConstraint('student_id', 'chapter_id', name='uq_student_chapter_learning'),
        sa.CheckConstraint(
            "prerequisite_status IN ('not_started', 'passed', 'remediated')",
            name='ck_prereq_status'
        ),
    )
    op.create_index('idx_cls_student', 'chapter_learning_states', ['student_id'])
    op.create_index('idx_cls_chapter', 'chapter_learning_states', ['chapter_id'])


def downgrade() -> None:
    # ── Reverse: chapter_learning_states ──
    op.drop_index('idx_cls_chapter', 'chapter_learning_states')
    op.drop_index('idx_cls_student', 'chapter_learning_states')
    op.drop_table('chapter_learning_states')

    # ── Reverse: learning_sessions ──
    op.drop_index('idx_sessions_type', 'learning_sessions')
    op.drop_constraint('ck_session_type', 'learning_sessions', type_='check')
    op.drop_column('learning_sessions', 'state_at_end')
    op.drop_column('learning_sessions', 'extracted_context')
    op.drop_column('learning_sessions', 'is_onboarding')
    op.drop_column('learning_sessions', 'session_type')
    op.alter_column('learning_sessions', 'chapter_id', nullable=False)

    # ── Reverse: student_subject_contexts ──
    op.drop_constraint('ck_confidence_level', 'student_subject_contexts', type_='check')
    op.drop_column('student_subject_contexts', 'raw_sentiment_response')
    op.drop_column('student_subject_contexts', 'engagement_pattern')
    op.alter_column('student_subject_contexts', 'anxiety_signals', new_column_name='fears_confusions')
    op.alter_column('student_subject_contexts', 'confidence_level', new_column_name='comfort_level')
    op.alter_column('student_subject_contexts', 'comfort_level', type_=sa.String(20))

    # ── Reverse: chapters ──
    op.drop_column('chapters', 'question_bank')

    # ── Reverse: student_profiles ──
    op.drop_column('student_profiles', 'companion_summary')
    op.drop_column('student_profiles', 'learning_style_signals')
