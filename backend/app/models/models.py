"""SQLAlchemy ORM models for the Axon database — all 14 tables."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, ForeignKey,
    Numeric, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship
from app.core.database import Base


# ──────────────────────────────────────────────
# Group A: Auth & Users
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(String(128), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    phone = Column(String(20))
    avatar_url = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    sessions = relationship("LearningSession", back_populates="student")

    __table_args__ = (
        CheckConstraint(
            "role IN ('student', 'parent', 'instructor', 'admin')",
            name="ck_users_role"
        ),
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
    )


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    grade = Column(Integer, nullable=False)
    interests = Column(JSONB, nullable=False, default=list)
    learning_preferences = Column(JSONB, default=dict)
    persona_summary = Column(Text)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="student_profile")

    __table_args__ = (
        CheckConstraint("grade >= 6 AND grade <= 12", name="ck_student_grade"),
    )


class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    whatsapp_number = Column(String(20), nullable=False)
    notifications_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_psl_parent", "parent_id"),
        Index("idx_psl_student", "student_id"),
    )


# ──────────────────────────────────────────────
# Group B: Content & RAG
# ──────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    grade = Column(Integer, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    chapters = relationship("Chapter", back_populates="subject")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    roadmap = Column(JSONB, nullable=False, default=dict)
    prerequisites = Column(JSONB, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="chapters")
    chunks = relationship("ContentChunk", back_populates="chapter")
    assets = relationship("ContentAsset", back_populates="chapter")

    __table_args__ = (
        Index("idx_chapters_subject", "subject_id"),
    )


class ContentChunk(Base):
    __tablename__ = "content_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.id"), nullable=False)
    subtopic = Column(String(255))
    chunk_type = Column(String(20))
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))  # all-MiniLM-L6-v2 dimensions
    page_number = Column(Integer)
    source_file = Column(Text)
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="chunks")

    __table_args__ = (
        CheckConstraint(
            "chunk_type IN ('text', 'diagram_caption', 'solution', 'question')",
            name="ck_chunk_type"
        ),
        Index("idx_chunks_chapter", "chapter_id"),
        Index("idx_chunks_subtopic", "chapter_id", "subtopic"),
    )


class ContentAsset(Base):
    __tablename__ = "content_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.id"), nullable=False)
    asset_type = Column(String(20))
    file_path = Column(Text, nullable=False)  # local path or URL
    caption = Column(Text)
    page_number = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="assets")

    __table_args__ = (
        CheckConstraint(
            "asset_type IN ('diagram', 'image', 'pdf')",
            name="ck_asset_type"
        ),
    )


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.id"), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")
    source_file_path = Column(Text, nullable=False)
    chunks_created = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name="ck_ingestion_status"
        ),
    )


# ──────────────────────────────────────────────
# Group C: Sessions & AI Context
# ──────────────────────────────────────────────

class StudentSubjectContext(Base):
    __tablename__ = "student_subject_contexts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    comfort_level = Column(String(20))
    weak_areas = Column(JSONB, default=list)
    preferred_modalities = Column(JSONB, default=list)
    fears_confusions = Column(Text)
    rolling_summary = Column(Text)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", name="uq_student_subject"),
    )


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.id"), nullable=False)
    status = Column(String(20), default="active")
    termination_reason = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    duration_seconds = Column(Integer)
    final_state = Column(String(30))
    subtopics_completed = Column(JSONB, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="sessions")
    messages = relationship("SessionMessage", back_populates="session")
    assessments = relationship("SessionAssessment", back_populates="session")
    summary = relationship("SessionSummary", back_populates="session", uselist=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'completed', 'terminated')",
            name="ck_session_status"
        ),
        Index("idx_sessions_student", "student_id"),
        Index("idx_sessions_chapter", "chapter_id"),
        Index("idx_sessions_status", "status"),
    )


class SessionMessage(Base):
    __tablename__ = "session_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"), nullable=False)
    role = Column(String(10), nullable=False)
    content = Column(Text, nullable=False)
    message_metadata = Column(JSONB, default=dict)
    sequence_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("LearningSession", back_populates="messages")

    __table_args__ = (
        CheckConstraint(
            "role IN ('system', 'assistant', 'user')",
            name="ck_message_role"
        ),
        Index("idx_messages_session_seq", "session_id", "sequence_number"),
    )


class SessionAssessment(Base):
    __tablename__ = "session_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"), nullable=False)
    assessment_type = Column(String(20))
    subtopic = Column(String(255))
    questions = Column(JSONB, nullable=False)
    responses = Column(JSONB, nullable=False, default=dict)
    score = Column(Numeric(5, 2))
    passed = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("LearningSession", back_populates="assessments")

    __table_args__ = (
        CheckConstraint(
            "assessment_type IN ('prerequisite', 'comprehension', 'subtopic')",
            name="ck_assessment_type"
        ),
    )


class SessionSummary(Base):
    __tablename__ = "session_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"), unique=True)
    summary_text = Column(Text, nullable=False)
    key_learnings = Column(JSONB, default=list)
    weak_areas_identified = Column(JSONB, default=list)
    engagement_level = Column(String(20))
    notable_moments = Column(JSONB, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("LearningSession", back_populates="summary")


# ──────────────────────────────────────────────
# Group D: Notifications
# ──────────────────────────────────────────────

class NotificationLog(Base):
    __tablename__ = "notification_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id"))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    channel = Column(String(20), default="whatsapp")
    message_content = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    external_id = Column(String(100))  # WhatsApp message ID
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'sent', 'delivered', 'failed')",
            name="ck_notification_status"
        ),
        Index("idx_notif_parent", "parent_id"),
        Index("idx_notif_session", "session_id"),
    )
