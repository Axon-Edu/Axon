"""AI Engine database helpers — CRUD operations for all AI-engine-related tables.

Uses the existing async SQLAlchemy session factory from app.core.database.
Each function accepts an AsyncSession and operates within the caller's transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    User,
    StudentProfile,
    StudentSubjectContext,
    Chapter,
    ContentChunk,
    LearningSession,
    SessionMessage,
    ChapterLearningState,
)


# ──────────────────────────────────────────────
# Student Profile Helpers
# ──────────────────────────────────────────────

async def get_student_profile(db: AsyncSession, student_id: str) -> Optional[StudentProfile]:
    """Get a student's profile by their user ID."""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == student_id)
    )
    return result.scalar_one_or_none()


async def get_student_with_profile(db: AsyncSession, student_id: str) -> Optional[dict]:
    """Get a student's full context: user + profile merged."""
    result = await db.execute(
        select(User, StudentProfile)
        .outerjoin(StudentProfile, User.id == StudentProfile.user_id)
        .where(User.id == student_id)
    )
    row = result.first()
    if not row:
        return None
    user, profile = row
    return {
        "student_id": str(user.id),
        "name": user.full_name,
        "grade": profile.grade if profile else 10,
        "interests": profile.interests if profile else [],
        "learning_style_signals": profile.learning_style_signals if profile else {},
        "companion_summary": profile.companion_summary if profile else "",
        "persona_summary": profile.persona_summary if profile else "",
    }


async def update_student_profile_fields(
    db: AsyncSession,
    student_id: str,
    *,
    interests: Optional[list] = None,
    learning_style_signals: Optional[dict] = None,
    companion_summary: Optional[str] = None,
) -> None:
    """Update specific AI-engine-related fields on the student profile."""
    values = {}
    if interests is not None:
        values["interests"] = interests
    if learning_style_signals is not None:
        values["learning_style_signals"] = learning_style_signals
    if companion_summary is not None:
        values["companion_summary"] = companion_summary
    if not values:
        return
    await db.execute(
        update(StudentProfile)
        .where(StudentProfile.user_id == student_id)
        .values(**values)
    )


# ──────────────────────────────────────────────
# Subject Context Helpers
# ──────────────────────────────────────────────

async def get_subject_context(
    db: AsyncSession, student_id: str, subject_id: str
) -> Optional[StudentSubjectContext]:
    """Get a student's context for a specific subject."""
    result = await db.execute(
        select(StudentSubjectContext).where(
            StudentSubjectContext.student_id == student_id,
            StudentSubjectContext.subject_id == subject_id,
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_subject_context(
    db: AsyncSession, student_id: str, subject_id: str
) -> StudentSubjectContext:
    """Get or create a student's subject context record."""
    ctx = await get_subject_context(db, student_id, subject_id)
    if ctx:
        return ctx
    ctx = StudentSubjectContext(
        id=uuid.uuid4(),
        student_id=student_id,
        subject_id=subject_id,
    )
    db.add(ctx)
    await db.flush()
    return ctx


async def update_subject_context_fields(
    db: AsyncSession,
    student_id: str,
    subject_id: str,
    *,
    confidence_level: Optional[str] = None,
    anxiety_signals: Optional[str] = None,
    engagement_pattern: Optional[str] = None,
    raw_sentiment_response: Optional[str] = None,
    rolling_summary: Optional[str] = None,
) -> None:
    """Update AI-engine-related fields on the subject context."""
    values = {"updated_at": datetime.utcnow()}
    if confidence_level is not None:
        values["confidence_level"] = confidence_level
    if anxiety_signals is not None:
        values["anxiety_signals"] = anxiety_signals
    if engagement_pattern is not None:
        values["engagement_pattern"] = engagement_pattern
    if raw_sentiment_response is not None:
        values["raw_sentiment_response"] = raw_sentiment_response
    if rolling_summary is not None:
        values["rolling_summary"] = rolling_summary
    await db.execute(
        update(StudentSubjectContext)
        .where(
            StudentSubjectContext.student_id == student_id,
            StudentSubjectContext.subject_id == subject_id,
        )
        .values(**values)
    )


# ──────────────────────────────────────────────
# Chapter Helpers
# ──────────────────────────────────────────────

async def get_chapter(db: AsyncSession, chapter_id: str) -> Optional[Chapter]:
    """Get a chapter by ID."""
    result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    return result.scalar_one_or_none()


async def update_chapter_roadmap(
    db: AsyncSession, chapter_id: str, roadmap: dict
) -> None:
    """Update a chapter's roadmap JSON."""
    await db.execute(
        update(Chapter).where(Chapter.id == chapter_id).values(roadmap=roadmap)
    )


async def update_chapter_question_bank(
    db: AsyncSession, chapter_id: str, question_bank: list
) -> None:
    """Update a chapter's question bank."""
    await db.execute(
        update(Chapter)
        .where(Chapter.id == chapter_id)
        .values(question_bank=question_bank)
    )


async def get_chapter_content_chunks(
    db: AsyncSession, chapter_id: str, subtopic: Optional[str] = None
) -> list[ContentChunk]:
    """Get content chunks for a chapter, optionally filtered by subtopic."""
    query = select(ContentChunk).where(ContentChunk.chapter_id == chapter_id)
    if subtopic:
        query = query.where(ContentChunk.subtopic == subtopic)
    query = query.order_by(ContentChunk.page_number)
    result = await db.execute(query)
    return list(result.scalars().all())


# ──────────────────────────────────────────────
# Chapter Learning State Helpers
# ──────────────────────────────────────────────

async def get_learning_state(
    db: AsyncSession, student_id: str, chapter_id: str
) -> Optional[ChapterLearningState]:
    """Get a student's learning state for a chapter."""
    result = await db.execute(
        select(ChapterLearningState).where(
            ChapterLearningState.student_id == student_id,
            ChapterLearningState.chapter_id == chapter_id,
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_learning_state(
    db: AsyncSession, student_id: str, chapter_id: str
) -> ChapterLearningState:
    """Get or create a learning state for a student + chapter."""
    state = await get_learning_state(db, student_id, chapter_id)
    if state:
        return state
    state = ChapterLearningState(
        id=uuid.uuid4(),
        student_id=student_id,
        chapter_id=chapter_id,
        current_node_index=0,
        prerequisite_status="not_started",
        node_completion_log=[],
        session_count=0,
    )
    db.add(state)
    await db.flush()
    return state


async def update_learning_state(
    db: AsyncSession,
    student_id: str,
    chapter_id: str,
    *,
    current_node_index: Optional[int] = None,
    prerequisite_status: Optional[str] = None,
    node_completion_log: Optional[list] = None,
    session_count: Optional[int] = None,
    last_session_at: Optional[datetime] = None,
) -> None:
    """Update fields on a chapter learning state."""
    values = {"updated_at": datetime.utcnow()}
    if current_node_index is not None:
        values["current_node_index"] = current_node_index
    if prerequisite_status is not None:
        values["prerequisite_status"] = prerequisite_status
    if node_completion_log is not None:
        values["node_completion_log"] = node_completion_log
    if session_count is not None:
        values["session_count"] = session_count
    if last_session_at is not None:
        values["last_session_at"] = last_session_at
    await db.execute(
        update(ChapterLearningState)
        .where(
            ChapterLearningState.student_id == student_id,
            ChapterLearningState.chapter_id == chapter_id,
        )
        .values(**values)
    )


async def get_all_learning_states(
    db: AsyncSession, student_id: str
) -> list[ChapterLearningState]:
    """Get all chapter learning states for a student (for progress endpoint)."""
    result = await db.execute(
        select(ChapterLearningState).where(
            ChapterLearningState.student_id == student_id
        )
    )
    return list(result.scalars().all())


# ──────────────────────────────────────────────
# Session Helpers (unified teaching + companion)
# ──────────────────────────────────────────────

async def create_session(
    db: AsyncSession,
    student_id: str,
    session_type: str = "teaching",
    chapter_id: Optional[str] = None,
    is_onboarding: bool = False,
) -> LearningSession:
    """Create a new learning session (teaching or companion)."""
    session = LearningSession(
        id=uuid.uuid4(),
        student_id=student_id,
        chapter_id=chapter_id,
        session_type=session_type,
        is_onboarding=is_onboarding,
        status="active",
    )
    db.add(session)
    await db.flush()
    return session


async def get_session(db: AsyncSession, session_id: str) -> Optional[LearningSession]:
    """Get a session by ID."""
    result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def get_active_session(
    db: AsyncSession,
    student_id: str,
    session_type: str = "teaching",
    chapter_id: Optional[str] = None,
) -> Optional[LearningSession]:
    """Get the most recent active session for a student."""
    query = (
        select(LearningSession)
        .where(
            LearningSession.student_id == student_id,
            LearningSession.session_type == session_type,
            LearningSession.status == "active",
        )
        .order_by(LearningSession.started_at.desc())
        .limit(1)
    )
    if chapter_id:
        query = query.where(LearningSession.chapter_id == chapter_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def end_session(
    db: AsyncSession,
    session_id: str,
    *,
    state_at_end: Optional[dict] = None,
    extracted_context: Optional[dict] = None,
) -> None:
    """Mark a session as completed."""
    now = datetime.utcnow()
    values = {
        "status": "completed",
        "ended_at": now,
    }
    if state_at_end is not None:
        values["state_at_end"] = state_at_end
    if extracted_context is not None:
        values["extracted_context"] = extracted_context
    await db.execute(
        update(LearningSession)
        .where(LearningSession.id == session_id)
        .values(**values)
    )


async def update_session_state(
    db: AsyncSession, session_id: str, state_at_end: dict
) -> None:
    """Update the state snapshot on a teaching session (called after each turn)."""
    await db.execute(
        update(LearningSession)
        .where(LearningSession.id == session_id)
        .values(state_at_end=state_at_end)
    )


# ──────────────────────────────────────────────
# Session Message Helpers
# ──────────────────────────────────────────────

async def get_session_messages(
    db: AsyncSession, session_id: str, limit: Optional[int] = None
) -> list[SessionMessage]:
    """Get all messages for a session, ordered by sequence number."""
    query = (
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.sequence_number)
    )
    if limit:
        query = query.limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def add_session_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    metadata: Optional[dict] = None,
) -> SessionMessage:
    """Add a message to a session. Auto-increments sequence number."""
    # Get max sequence number
    from sqlalchemy import func
    result = await db.execute(
        select(func.coalesce(func.max(SessionMessage.sequence_number), 0))
        .where(SessionMessage.session_id == session_id)
    )
    next_seq = result.scalar() + 1

    msg = SessionMessage(
        id=uuid.uuid4(),
        session_id=session_id,
        role=role,
        content=content,
        message_metadata=metadata or {},
        sequence_number=next_seq,
    )
    db.add(msg)
    await db.flush()
    return msg


async def get_session_turns_as_dicts(
    db: AsyncSession, session_id: str
) -> list[dict]:
    """Get session messages as a list of dicts (for context assembly)."""
    messages = await get_session_messages(db, session_id)
    return [
        {
            "role": msg.role,
            "content": msg.content,
            "sequence": msg.sequence_number,
        }
        for msg in messages
    ]
