"""Pydantic schemas for the AI engine — request/response models and internal data shapes."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PrerequisiteStatus(str, Enum):
    NOT_STARTED = "not_started"
    PASSED = "passed"
    REMEDIATED = "remediated"


class SessionType(str, Enum):
    TEACHING = "teaching"
    COMPANION = "companion"


class UnderstandingLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TeachingState(str, Enum):
    """States in the teaching state machine."""
    PREREQUISITE_CHECK = "prerequisite_check"
    REMEDIATE = "remediate"
    TEACH = "teach"
    CHECK_UNDERSTANDING = "check_understanding"
    HINT = "hint"
    RETEACH_WITH_ANALOGY = "reteach_with_analogy"
    DOUBT_RESPONSE = "doubt_response"
    NODE_COMPLETE = "node_complete"
    CHAPTER_EVALUATION = "chapter_evaluation"  # end-of-chapter assessment
    CHAPTER_COMPLETE = "chapter_complete"


class QuestionType(str, Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    TRUE_FALSE = "true_false"
    FILL_IN_BLANK = "fill_in_blank"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ──────────────────────────────────────────────
# Roadmap Structures (stored in chapters.roadmap)
# ──────────────────────────────────────────────

class PrereqCheckQuestion(BaseModel):
    question: str
    model_answer: str


class Prerequisite(BaseModel):
    topic: str
    check_questions: list[PrereqCheckQuestion] = []
    remediation_content: str = ""


class TeachingNode(BaseModel):
    node_id: str
    topic: str
    core_concept: str
    teaching_hint: str = ""
    check_question: str = ""
    expected_understanding_signals: list[str] = []
    common_misconceptions: list[str] = []


class RoadmapJSON(BaseModel):
    """Complete roadmap structure stored in chapters.roadmap."""
    chapter_name: str
    prerequisites: list[Prerequisite] = []
    teaching_nodes: list[TeachingNode] = []


# ──────────────────────────────────────────────
# Content Chunk (stored in content_chunks table)
# ──────────────────────────────────────────────

class ContentChunkSchema(BaseModel):
    chunk_id: str
    topic_hint: str = ""
    text: str
    image_refs: list[str] = []
    page_range: list[int] = []


# ──────────────────────────────────────────────
# Question Bank (stored in chapters.question_bank)
# ──────────────────────────────────────────────

class QuestionBankItem(BaseModel):
    question: str
    type: QuestionType = QuestionType.SHORT_ANSWER
    difficulty: Difficulty = Difficulty.MEDIUM
    topic_tag: str = ""
    model_answer: str = ""


# ──────────────────────────────────────────────
# Node Completion Log Entry
# ──────────────────────────────────────────────

class NodeCompletionEntry(BaseModel):
    node_id: str
    understood: bool = False
    attempts: int = 0
    misconceptions_noted: list[str] = []
    timestamp: str = ""  # ISO format


# ──────────────────────────────────────────────
# Evaluator Output
# ──────────────────────────────────────────────

class EvaluatorOutput(BaseModel):
    """Structured output from the understanding evaluator."""
    understanding: UnderstandingLevel
    misconceptions: list[str] = []
    what_they_got_right: str = ""
    needs_reinforcement: str = ""


# ──────────────────────────────────────────────
# Context Extractor Output (after companion session)
# ──────────────────────────────────────────────

class ContextExtractorOutput(BaseModel):
    """Structured output from the companion context extractor."""
    interests: list[str] = []
    learning_style_signals: dict = {}
    science_confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    science_anxiety: str = ""
    companion_summary_update: str = ""


# ──────────────────────────────────────────────
# State Machine Snapshot (stored in sessions.state_at_end)
# ──────────────────────────────────────────────

class StateMachineSnapshot(BaseModel):
    """Serializable snapshot of the teaching state machine."""
    current_state: TeachingState = TeachingState.PREREQUISITE_CHECK
    current_node_index: int = 0
    prerequisite_status: PrerequisiteStatus = PrerequisiteStatus.NOT_STARTED
    state_stack: list[str] = []  # for doubt detection push/pop
    hint_attempts: int = 0
    reteach_attempted: bool = False
    last_evaluator_output: Optional[dict] = None
    last_check_question: str = ""
    prereq_questions_asked: list[dict] = []
    prereq_results: list[dict] = []


# ──────────────────────────────────────────────
# API Request / Response Schemas
# ──────────────────────────────────────────────

# --- Companion ---

class CompanionTurnRequest(BaseModel):
    student_id: str
    message: str
    session_id: Optional[str] = None  # null = start new session


class CompanionTurnResponse(BaseModel):
    response: str
    session_id: str


class CompanionEndSessionRequest(BaseModel):
    student_id: str
    session_id: str


class CompanionEndSessionResponse(BaseModel):
    extracted_context: ContextExtractorOutput


# --- Tutor ---

class TutorTurnRequest(BaseModel):
    student_id: str
    chapter_id: str
    message: str
    session_id: Optional[str] = None


class TutorTurnResponse(BaseModel):
    response: str
    session_id: str
    current_state: str
    node_index: int


class TutorStartSessionRequest(BaseModel):
    student_id: str
    chapter_id: str


class TutorStartSessionResponse(BaseModel):
    response: str
    session_id: str
    is_resuming: bool


# --- Progress ---

class NodeProgress(BaseModel):
    node_id: str
    topic: str = ""
    understood: bool = False
    attempts: int = 0


class ChapterProgress(BaseModel):
    chapter_id: str
    chapter_name: str = ""
    current_node_index: int = 0
    total_nodes: int = 0
    completion_percentage: float = 0.0
    prerequisite_status: str = "not_started"
    session_count: int = 0
    last_session_at: Optional[datetime] = None
    node_details: list[NodeProgress] = []


class StudentProgressResponse(BaseModel):
    student_id: str
    chapters: list[ChapterProgress] = []


# ──────────────────────────────────────────────
# Student Profile (read-only, for context assembly)
# ──────────────────────────────────────────────

class StudentContext(BaseModel):
    """Assembled student context for LLM calls."""
    student_id: str
    name: str = ""
    grade: int = 10
    interests: list[str] = []
    learning_style_signals: dict = {}
    companion_summary: str = ""
    confidence_level: Optional[ConfidenceLevel] = None
    anxiety_signals: str = ""
    engagement_pattern: str = ""
