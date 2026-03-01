"""Companion session handler — manages the friendly companion flow.

The companion is a warm, friendly AI that:
  - Onboarding: discovers student interests, learning style, science feelings
  - Post-onboarding: open chat, emotional support, check-ins
  - End of session: extracts structured context via Haiku
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Optional

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import (
    LearningSession, SessionMessage, StudentProfile, User,
    StudentSubjectContext,
)
from ai_engine.schemas import ContextExtractorOutput, ConfidenceLevel
from ai_engine.context_assembler import (
    assemble_companion_context,
    assemble_context_extractor_context,
)


# ──────────────────────────────────────────────
# Async Claude client (shared with state_machine)
# ──────────────────────────────────────────────

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


async def _call_haiku(system: str, messages: list[dict]) -> str:
    """Call Haiku with full messages array."""
    model = os.environ.get("ANTHROPIC_HELPER_MODEL", "claude-haiku-4-5-20251001")
    resp = await _get_client().messages.create(
        model=model,
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return resp.content[0].text


async def _call_haiku_oneshot(system: str, user_msg: str) -> str:
    """Call Haiku with a single user message."""
    return await _call_haiku(system, [{"role": "user", "content": user_msg}])


# ──────────────────────────────────────────────
# Companion Handler
# ──────────────────────────────────────────────

class CompanionHandler:
    """Manages companion (friendly AI friend) conversation sessions."""

    def __init__(self, student_id: str, db: AsyncSession):
        self.student_id = student_id
        self.db = db
        self.session_id: Optional[str] = None
        self.student_profile: dict = {}
        self.is_onboarding: bool = False
        self.messages: list[dict] = []

    async def load_or_create_session(self, session_id: Optional[str] = None) -> str:
        """Load existing companion session or create a new one."""
        # Load student profile
        result = await self.db.execute(
            select(User).where(User.id == self.student_id)
        )
        user = result.scalar_one()
        result = await self.db.execute(
            select(StudentProfile).where(StudentProfile.user_id == self.student_id)
        )
        profile = result.scalar_one_or_none()

        self.student_profile = {
            "name": user.full_name,
            "grade": profile.grade if profile else 10,
            "interests": profile.interests if profile else [],
            "companion_summary": profile.companion_summary if profile else "",
        }

        # Check if this is first companion session (onboarding)
        self.is_onboarding = not (profile and profile.onboarding_completed)

        if session_id:
            # Resume existing session
            result = await self.db.execute(
                select(LearningSession).where(LearningSession.id == session_id)
            )
            session = result.scalar_one()
            self.session_id = str(session.id)
            self.is_onboarding = session.is_onboarding

            # Load conversation history
            result = await self.db.execute(
                select(SessionMessage)
                .where(SessionMessage.session_id == self.session_id)
                .order_by(SessionMessage.created_at)
            )
            msgs = result.scalars().all()
            self.messages = [{"role": m.role, "content": m.content} for m in msgs]
        else:
            # Create new companion session
            session = LearningSession(
                student_id=self.student_id,
                chapter_id=None,  # companion sessions have no chapter
                session_type="companion",
                is_onboarding=self.is_onboarding,
                status="active",
            )
            self.db.add(session)
            await self.db.flush()
            self.session_id = str(session.id)

        return self.session_id

    async def process_turn(self, student_message: str) -> str:
        """Process a companion turn and return the response."""
        # Save student message
        msg = SessionMessage(
            session_id=self.session_id,
            role="user",
            content=student_message,
        )
        self.db.add(msg)
        self.messages.append({"role": "user", "content": student_message})

        # Assemble companion context
        system_prompt = assemble_companion_context(
            student_profile=self.student_profile,
            is_onboarding=self.is_onboarding,
            conversation_history=self.messages,
        )

        # Call Haiku with full conversation
        response = await _call_haiku(system_prompt, self.messages)

        # Save assistant response
        msg = SessionMessage(
            session_id=self.session_id,
            role="assistant",
            content=response,
        )
        self.db.add(msg)
        self.messages.append({"role": "assistant", "content": response})

        await self.db.commit()
        return response

    async def generate_greeting(self) -> str:
        """Generate the first message (companion starts the conversation)."""
        system_prompt = assemble_companion_context(
            student_profile=self.student_profile,
            is_onboarding=self.is_onboarding,
            conversation_history=[],
        )

        # Companion starts with a greeting
        greeting_hint = "Start the conversation with a warm, friendly greeting."
        response = await _call_haiku(
            system_prompt,
            [{"role": "user", "content": greeting_hint}],
        )

        # Save as assistant message (the greeting_hint is internal, not stored)
        msg = SessionMessage(
            session_id=self.session_id,
            role="assistant",
            content=response,
        )
        self.db.add(msg)
        self.messages.append({"role": "assistant", "content": response})

        await self.db.commit()
        return response

    async def end_session(self) -> ContextExtractorOutput:
        """End companion session, extract context, and update student profile."""
        # Extract context from conversation
        sys_prompt, user_msg = assemble_context_extractor_context(self.messages)
        raw = await _call_haiku_oneshot(sys_prompt, user_msg)

        # Parse JSON
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        extracted = ContextExtractorOutput(**json.loads(raw.strip()))

        # Update student profile with extracted data
        result = await self.db.execute(
            select(StudentProfile).where(StudentProfile.user_id == self.student_id)
        )
        profile = result.scalar_one_or_none()

        if profile:
            # Merge interests (don't overwrite, append new ones)
            existing_interests = set(profile.interests or [])
            new_interests = set(extracted.interests)
            profile.interests = list(existing_interests | new_interests)

            # Update learning style signals (merge)
            existing_signals = profile.learning_style_signals or {}
            existing_signals.update(extracted.learning_style_signals)
            profile.learning_style_signals = existing_signals

            # Update companion summary (append or replace)
            if extracted.companion_summary_update:
                if profile.companion_summary:
                    profile.companion_summary = (
                        profile.companion_summary + " | " + extracted.companion_summary_update
                    )
                else:
                    profile.companion_summary = extracted.companion_summary_update

            # Mark onboarding as completed
            if self.is_onboarding:
                profile.onboarding_completed = True

        # Update subject context (science-specific)
        result = await self.db.execute(
            select(LearningSession).where(LearningSession.id == self.session_id)
        )
        session = result.scalar_one()

        # Find the science subject context (if exists)
        from app.models.models import Subject
        result = await self.db.execute(
            select(Subject).where(Subject.name == "Science")
        )
        science = result.scalar_one_or_none()

        if science and (extracted.science_confidence or extracted.science_anxiety):
            result = await self.db.execute(
                select(StudentSubjectContext).where(
                    StudentSubjectContext.student_id == self.student_id,
                    StudentSubjectContext.subject_id == science.id,
                )
            )
            ctx = result.scalar_one_or_none()
            if not ctx:
                ctx = StudentSubjectContext(
                    student_id=self.student_id,
                    subject_id=science.id,
                )
                self.db.add(ctx)

            ctx.confidence_level = extracted.science_confidence.value if extracted.science_confidence else ctx.confidence_level
            if extracted.science_anxiety:
                ctx.anxiety_signals = extracted.science_anxiety
            if self.is_onboarding:
                ctx.onboarding_completed = True

        # Update session
        session.status = "completed"
        session.ended_at = datetime.utcnow()
        session.extracted_context = extracted.model_dump()

        await self.db.commit()
        return extracted
