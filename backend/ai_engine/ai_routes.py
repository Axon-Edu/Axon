"""AI Engine API routes — wires the tutor, companion, and progress endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import verify_firebase_token
from app.models.models import User, Chapter, ChapterLearningState

from ai_engine.schemas import (
    CompanionTurnRequest, CompanionTurnResponse,
    CompanionEndSessionRequest, CompanionEndSessionResponse,
    TutorStartSessionRequest, TutorStartSessionResponse,
    TutorTurnRequest, TutorTurnResponse,
    StudentProgressResponse, ChapterProgress, NodeProgress,
    RoadmapJSON,
)
from ai_engine.state_machine import TutorStateMachine
from ai_engine.companion import CompanionHandler

router = APIRouter(prefix="/ai", tags=["AI Engine"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _get_user_id(token: dict, db: AsyncSession) -> str:
    """Resolve Firebase token to internal user ID."""
    result = await db.execute(
        select(User).where(User.firebase_uid == token["uid"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Register first.")
    return str(user.id)


# ──────────────────────────────────────────────
# Companion Endpoints
# ──────────────────────────────────────────────

@router.post("/companion/turn", response_model=CompanionTurnResponse)
async def companion_turn(
    req: CompanionTurnRequest,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the companion and get a response.

    If session_id is null, a new companion session is created.
    First message also generates a greeting from the companion.
    """
    student_id = await _get_user_id(token, db)
    handler = CompanionHandler(student_id, db)
    session_id = await handler.load_or_create_session(req.session_id)

    # If new session, generate greeting first
    if not req.session_id:
        await handler.generate_greeting()

    response = await handler.process_turn(req.message)

    return CompanionTurnResponse(
        message=response,
        session_id=session_id,
    )


@router.post("/companion/end", response_model=CompanionEndSessionResponse)
async def companion_end(
    req: CompanionEndSessionRequest,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """End a companion session and extract structured context.

    Updates student profile with interests, learning style, and confidence data.
    """
    student_id = await _get_user_id(token, db)
    handler = CompanionHandler(student_id, db)
    await handler.load_or_create_session(req.session_id)
    extracted = await handler.end_session()

    return CompanionEndSessionResponse(extracted_context=extracted)


# ──────────────────────────────────────────────
# Tutor Endpoints
# ──────────────────────────────────────────────

@router.post("/tutor/start", response_model=TutorStartSessionResponse)
async def tutor_start(
    req: TutorStartSessionRequest,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Start or resume a teaching session for a chapter.

    If the student has an active session for this chapter, it resumes.
    Otherwise, a new session is created, starting with prerequisites.
    """
    student_id = await _get_user_id(token, db)
    # Check for existing active session
    from app.models.models import LearningSession
    result = await db.execute(
        select(LearningSession).where(
            LearningSession.student_id == student_id,
            LearningSession.chapter_id == req.chapter_id,
            LearningSession.session_type == "teaching",
            LearningSession.status == "active",
        )
    )
    existing_session = result.scalar_one_or_none()

    is_resuming = existing_session is not None
    session_id = str(existing_session.id) if existing_session else None

    # Initialize state machine
    sm = TutorStateMachine(student_id, req.chapter_id, db)
    await sm.load_state(session_id=session_id)

    # Generate opening message
    response = await sm.generate_opening()

    return TutorStartSessionResponse(
        message=response,
        session_id=sm.session_id,
        is_resuming=is_resuming,
    )


@router.post("/tutor/turn", response_model=TutorTurnResponse)
async def tutor_turn(
    req: TutorTurnRequest,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Process a single teaching turn.

    The state machine handles doubt detection, evaluation,
    state transitions, and generates the tutor's response.
    """
    student_id = await _get_user_id(token, db)
    sm = TutorStateMachine(student_id, req.chapter_id, db)
    await sm.load_state(session_id=req.session_id)

    response = await sm.process_turn(req.message)

    return TutorTurnResponse(
        message=response,
        session_id=sm.session_id,
        current_state=sm.snapshot.current_state.value,
        node_index=sm.snapshot.current_node_index,
    )


# ──────────────────────────────────────────────
# Progress Endpoint
# ──────────────────────────────────────────────

@router.get("/progress/{student_id}", response_model=StudentProgressResponse)
async def get_progress(
    student_id: str,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Get the student's progress across all chapters.

    Returns completion percentage, node details, and session counts
    for each chapter the student has started.
    """
    # Get all learning states for this student
    result = await db.execute(
        select(ChapterLearningState).where(
            ChapterLearningState.student_id == student_id
        )
    )
    states = result.scalars().all()

    chapters = []
    for state in states:
        # Load chapter for roadmap info
        result = await db.execute(
            select(Chapter).where(Chapter.id == state.chapter_id)
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            continue

        # Parse roadmap for total nodes
        roadmap = RoadmapJSON(**chapter.roadmap) if chapter.roadmap else RoadmapJSON(chapter_name=chapter.title)
        total_nodes = len(roadmap.teaching_nodes)

        # Build node details from completion log
        node_details = []
        log = state.node_completion_log or []
        for entry in log:
            if isinstance(entry, dict):
                node_details.append(NodeProgress(
                    node_id=entry.get("node_id", ""),
                    topic=_get_node_topic(roadmap, entry.get("node_id", "")),
                    understood=entry.get("understood", False),
                    attempts=entry.get("attempts", 0),
                ))

        # Calculate completion
        completed_count = state.current_node_index
        completion_pct = (completed_count / total_nodes * 100) if total_nodes > 0 else 0

        chapters.append(ChapterProgress(
            chapter_id=str(state.chapter_id),
            chapter_name=chapter.title,
            current_node_index=state.current_node_index,
            total_nodes=total_nodes,
            completion_percentage=round(completion_pct, 1),
            prerequisite_status=state.prerequisite_status or "not_started",
            session_count=state.session_count or 0,
            last_session_at=state.last_session_at,
            node_details=node_details,
        ))

    return StudentProgressResponse(
        student_id=student_id,
        chapters=chapters,
    )


def _get_node_topic(roadmap: RoadmapJSON, node_id: str) -> str:
    """Get topic name for a node ID from the roadmap."""
    for node in roadmap.teaching_nodes:
        if node.node_id == node_id:
            return node.topic
    return ""
