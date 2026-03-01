"""Teaching State Machine — the brain of the AI tutor.

Manages the full teaching flow:
  PREREQUISITE_CHECK → TEACH → CHECK_UNDERSTANDING → NODE_COMPLETE
  with detours through HINT, RETEACH_WITH_ANALOGY, DOUBT_RESPONSE,
  REMEDIATE, CHAPTER_EVALUATION, and CHAPTER_COMPLETE.
"""

from __future__ import annotations

import json
import os
import random
from datetime import datetime
from typing import Optional

from google import genai
from google.genai import types
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import (
    Chapter, ChapterLearningState, LearningSession, SessionMessage,
    ContentChunk, StudentProfile, User, StudentSubjectContext,
)
from ai_engine.schemas import (
    TeachingState, StateMachineSnapshot, RoadmapJSON,
    PrerequisiteStatus, EvaluatorOutput, TeachingNode,
)
from ai_engine.context_assembler import (
    assemble_tutor_context,
    assemble_evaluator_context,
    assemble_analogy_context,
    assemble_doubt_detector_context,
)


# ──────────────────────────────────────────────
# Gemini Client Setup (google.genai SDK)
# ──────────────────────────────────────────────

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


async def _call_gemini_pro(system: str, messages: list[dict]) -> str:
    """Call Gemini Pro (main tutor model) with conversation history."""
    model = os.environ.get("GEMINI_PRO_MODEL", "gemini-2.0-flash")
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))

    response = _get_client().models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=1024,
        ),
    )
    return response.text


async def _call_gemini_flash(system: str, user_msg: str) -> str:
    """Call Gemini Flash (helper model) — single user message."""
    model = os.environ.get("GEMINI_FLASH_MODEL", "gemini-2.0-flash-lite")
    response = _get_client().models.generate_content(
        model=model,
        contents=user_msg,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=1024,
        ),
    )
    return response.text


async def _call_flash_json(system: str, user_msg: str) -> dict:
    """Call Gemini Flash and parse JSON response."""
    raw = await _call_gemini_flash(system, user_msg)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    return json.loads(raw.strip())


# ──────────────────────────────────────────────
# Serper web search (for remediation)
# ──────────────────────────────────────────────

async def _web_search(topic: str) -> str:
    """Search for remediation content using Serper.dev."""
    try:
        api_key = os.environ.get("SERPER_API_KEY", "")
        if not api_key:
            return ""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={
                    "q": f"CBSE class 10 {topic} simple explanation site:ncert.nic.in OR site:byjus.com",
                    "num": 3,
                },
                timeout=10.0,
            )
            data = resp.json()
            snippets = []
            for result in data.get("organic", [])[:3]:
                snippets.append(result.get("snippet", ""))
            return "\n\n".join(snippets)[:2000]
    except Exception as e:
        print(f"  ⚠️  Serper search failed: {e}")
        return ""


# ──────────────────────────────────────────────
# Teaching State Machine
# ──────────────────────────────────────────────

class TutorStateMachine:
    """Manages the full teaching flow for a student + chapter pair."""

    def __init__(self, student_id: str, chapter_id: str, db: AsyncSession):
        self.student_id = student_id
        self.chapter_id = chapter_id
        self.db = db

        # Loaded from DB
        self.session_id: Optional[str] = None
        self.chapter: Optional[Chapter] = None
        self.roadmap: Optional[RoadmapJSON] = None
        self.learning_state: Optional[ChapterLearningState] = None
        self.student_profile: dict = {}
        self.subject_context: dict = {}

        # State snapshot (in-memory during processing)
        self.snapshot = StateMachineSnapshot()

        # Conversation history (for Sonnet calls)
        self.messages: list[dict] = []

    # ── Load / Save ──────────────────────────

    async def load_state(self, session_id: Optional[str] = None) -> None:
        """Load all state from DB. If session_id given, resume that session."""
        # Load chapter + roadmap
        result = await self.db.execute(
            select(Chapter).where(Chapter.id == self.chapter_id)
        )
        self.chapter = result.scalar_one()
        self.roadmap = RoadmapJSON(**self.chapter.roadmap) if self.chapter.roadmap else RoadmapJSON(chapter_name="Unknown")

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
            "learning_style_signals": profile.learning_style_signals if profile else {},
            "companion_summary": profile.companion_summary if profile else "",
        }

        # Load subject context
        result = await self.db.execute(
            select(StudentSubjectContext).where(
                StudentSubjectContext.student_id == self.student_id,
                StudentSubjectContext.subject_id == self.chapter.subject_id,
            )
        )
        ctx = result.scalar_one_or_none()
        self.subject_context = {
            "confidence_level": ctx.confidence_level if ctx else "medium",
            "anxiety_signals": ctx.anxiety_signals if ctx else "",
            "engagement_pattern": ctx.engagement_pattern if ctx else "",
        }

        # Load or create chapter learning state
        result = await self.db.execute(
            select(ChapterLearningState).where(
                ChapterLearningState.student_id == self.student_id,
                ChapterLearningState.chapter_id == self.chapter_id,
            )
        )
        self.learning_state = result.scalar_one_or_none()
        if not self.learning_state:
            self.learning_state = ChapterLearningState(
                student_id=self.student_id,
                chapter_id=self.chapter_id,
            )
            self.db.add(self.learning_state)
            await self.db.flush()

        # Resume session or create new
        if session_id:
            result = await self.db.execute(
                select(LearningSession).where(LearningSession.id == session_id)
            )
            session = result.scalar_one()
            self.session_id = str(session.id)
            # Restore snapshot from session
            if session.state_at_end:
                self.snapshot = StateMachineSnapshot(**session.state_at_end)
            else:
                self.snapshot.current_node_index = self.learning_state.current_node_index
        else:
            # Create new session
            session = LearningSession(
                student_id=self.student_id,
                chapter_id=self.chapter_id,
                session_type="teaching",
                status="active",
            )
            self.db.add(session)
            await self.db.flush()
            self.session_id = str(session.id)
            self.learning_state.session_count += 1
            self.snapshot.current_node_index = self.learning_state.current_node_index

        # Load conversation history
        result = await self.db.execute(
            select(SessionMessage)
            .where(SessionMessage.session_id == self.session_id)
            .order_by(SessionMessage.created_at)
        )
        msgs = result.scalars().all()
        self.messages = [{"role": m.role, "content": m.content} for m in msgs]

    async def save_state(self) -> None:
        """Persist current state to DB."""
        # Update learning state
        self.learning_state.current_node_index = self.snapshot.current_node_index
        self.learning_state.prerequisite_status = self.snapshot.prerequisite_status.value if isinstance(self.snapshot.prerequisite_status, PrerequisiteStatus) else self.snapshot.prerequisite_status
        self.learning_state.updated_at = datetime.utcnow()
        self.learning_state.last_session_at = datetime.utcnow()

        # Update session snapshot
        result = await self.db.execute(
            select(LearningSession).where(LearningSession.id == self.session_id)
        )
        session = result.scalar_one()
        session.state_at_end = self.snapshot.model_dump()

        await self.db.commit()

    async def _save_message(self, role: str, content: str) -> None:
        """Save a message to DB and local history."""
        msg = SessionMessage(
            session_id=self.session_id,
            role=role,
            content=content,
        )
        self.db.add(msg)
        self.messages.append({"role": role, "content": content})
        await self.db.flush()

    # ── Content Retrieval ────────────────────

    async def _get_relevant_content(self, topic: str) -> str:
        """Get content chunks matching the current topic."""
        result = await self.db.execute(
            select(ContentChunk).where(
                ContentChunk.chapter_id == self.chapter_id,
                ContentChunk.subtopic.ilike(f"%{topic}%"),
            )
        )
        chunks = result.scalars().all()
        if chunks:
            return "\n\n".join(c.content for c in chunks)

        # Fallback: get first few chunks
        result = await self.db.execute(
            select(ContentChunk)
            .where(ContentChunk.chapter_id == self.chapter_id)
            .limit(3)
        )
        chunks = result.scalars().all()
        return "\n\n".join(c.content for c in chunks) if chunks else ""

    def _current_node(self) -> Optional[TeachingNode]:
        """Get the current teaching node."""
        idx = self.snapshot.current_node_index
        if idx < len(self.roadmap.teaching_nodes):
            return self.roadmap.teaching_nodes[idx]
        return None

    # ── Doubt Detection ──────────────────────

    async def _check_for_doubt(self, message: str) -> bool:
        """Detect if the student is asking a doubt."""
        sys_prompt, user_msg = assemble_doubt_detector_context(message)
        result = await _call_gemini_flash(sys_prompt, user_msg)
        return result.strip().lower() == "doubt"

    # ── Evaluator ────────────────────────────

    async def _evaluate_response(self, question: str, student_response: str) -> EvaluatorOutput:
        """Evaluate student understanding."""
        node = self._current_node()
        expected = node.expected_understanding_signals if node else []
        sys_prompt, user_msg = assemble_evaluator_context(question, expected, student_response)
        data = await _call_flash_json(sys_prompt, user_msg)
        return EvaluatorOutput(**data)

    # ── Analogy Generator ────────────────────

    async def _generate_analogy(self, concept: str) -> str:
        """Generate an interest-based analogy."""
        interests = self.student_profile.get("interests", [])
        age = self.student_profile.get("grade", 10) + 5
        sys_prompt, user_msg = assemble_analogy_context(concept, interests, age)
        return await _call_gemini_flash(sys_prompt, user_msg)

    # ── Tutor Call ───────────────────────────

    async def _call_tutor(self, **extra_context) -> str:
        """Assemble full tutor context and call Sonnet."""
        node = self._current_node()
        relevant_content = await self._get_relevant_content(node.topic if node else "")

        system_prompt = assemble_tutor_context(
            student_profile=self.student_profile,
            subject_context=self.subject_context,
            roadmap=self.roadmap.model_dump(),
            current_node_index=self.snapshot.current_node_index,
            state_snapshot=self.snapshot.model_dump(),
            relevant_content=relevant_content,
            **extra_context,
        )

        return await _call_gemini_pro(system_prompt, self.messages)

    # ── Node Completion Log ──────────────────

    def _log_node_completion(self, node_id: str, understood: bool, attempts: int, misconceptions: list[str]) -> None:
        """Add entry to the node completion log."""
        log = self.learning_state.node_completion_log or []
        log.append({
            "node_id": node_id,
            "understood": understood,
            "attempts": attempts,
            "misconceptions_noted": misconceptions,
            "timestamp": datetime.utcnow().isoformat(),
        })
        self.learning_state.node_completion_log = log

    # ── Generate Opening ─────────────────────

    async def generate_opening(self) -> str:
        """Generate the first message of a teaching session."""
        prereq_status = self.learning_state.prerequisite_status

        if prereq_status == "not_started" and self.roadmap.prerequisites:
            # Start with prerequisite check
            self.snapshot.current_state = TeachingState.PREREQUISITE_CHECK
            prereqs = self.roadmap.prerequisites
            sample_size = min(3, len(prereqs))
            sampled = random.sample(prereqs, sample_size)

            # Pick first question from first prereq
            first_prereq = sampled[0]
            if first_prereq.check_questions:
                q = first_prereq.check_questions[0].question
                self.snapshot.prereq_questions_asked = [
                    {"topic": p.topic, "questions": [cq.question for cq in p.check_questions]}
                    for p in sampled
                ]
                self.snapshot.last_check_question = q

                response = await self._call_tutor(
                    prereq_question=q,
                    prereq_topic=first_prereq.topic,
                )
            else:
                # No questions, skip prereqs
                self.snapshot.prerequisite_status = PrerequisiteStatus.PASSED
                self.snapshot.current_state = TeachingState.TEACH
                response = await self._call_tutor()
        elif prereq_status in ("passed", "remediated") or not self.roadmap.prerequisites:
            # Jump to teaching
            self.snapshot.prerequisite_status = PrerequisiteStatus.PASSED
            self.snapshot.current_state = TeachingState.TEACH
            response = await self._call_tutor()
        else:
            # Resume from current state
            response = await self._call_tutor()

        await self._save_message("assistant", response)
        await self.save_state()
        return response

    # ── Main Process Turn ────────────────────

    async def process_turn(self, student_message: str) -> str:
        """Process a single student turn through the state machine.

        Returns the tutor's response.
        """
        # Save student message
        await self._save_message("user", student_message)

        # Step 1: Doubt detection (on every turn)
        is_doubt = await self._check_for_doubt(student_message)
        if is_doubt and self.snapshot.current_state not in (
            TeachingState.PREREQUISITE_CHECK,
            TeachingState.CHAPTER_COMPLETE,
            TeachingState.CHAPTER_EVALUATION,
        ):
            # Push current state and handle doubt
            self.snapshot.state_stack.append(self.snapshot.current_state.value)
            self.snapshot.current_state = TeachingState.DOUBT_RESPONSE

            response = await self._call_tutor()
            await self._save_message("assistant", response)

            # Pop back to previous state
            if self.snapshot.state_stack:
                prev = self.snapshot.state_stack.pop()
                self.snapshot.current_state = TeachingState(prev)

            await self.save_state()
            return response

        # Step 2: State-specific logic
        state = self.snapshot.current_state
        response = ""

        if state == TeachingState.PREREQUISITE_CHECK:
            response = await self._handle_prerequisite_check(student_message)

        elif state == TeachingState.REMEDIATE:
            response = await self._handle_remediate(student_message)

        elif state == TeachingState.TEACH:
            response = await self._handle_teach(student_message)

        elif state == TeachingState.CHECK_UNDERSTANDING:
            response = await self._handle_check_understanding(student_message)

        elif state == TeachingState.HINT:
            response = await self._handle_hint(student_message)

        elif state == TeachingState.RETEACH_WITH_ANALOGY:
            response = await self._handle_reteach(student_message)

        elif state == TeachingState.NODE_COMPLETE:
            response = await self._handle_node_complete(student_message)

        elif state == TeachingState.CHAPTER_EVALUATION:
            response = await self._handle_chapter_evaluation(student_message)

        elif state == TeachingState.CHAPTER_COMPLETE:
            response = await self._handle_chapter_complete(student_message)

        else:
            # Fallback
            response = await self._call_tutor()

        await self._save_message("assistant", response)
        await self.save_state()
        return response

    # ── State Handlers ───────────────────────

    async def _handle_prerequisite_check(self, message: str) -> str:
        """Handle student response during prerequisite checking."""
        # Evaluate their answer to the current prereq question
        evaluation = await self._evaluate_response(
            self.snapshot.last_check_question, message
        )
        self.snapshot.prereq_results.append({
            "question": self.snapshot.last_check_question,
            "understanding": evaluation.understanding.value,
        })

        # Check if more questions remain
        all_questions = []
        for pq in self.snapshot.prereq_questions_asked:
            for q in pq.get("questions", []):
                all_questions.append({"topic": pq["topic"], "question": q})

        asked_count = len(self.snapshot.prereq_results)

        if asked_count < len(all_questions):
            # Ask next question
            next_q = all_questions[asked_count]
            self.snapshot.last_check_question = next_q["question"]
            return await self._call_tutor(
                prereq_question=next_q["question"],
                prereq_topic=next_q["topic"],
            )
        else:
            # All prereq questions asked — evaluate collectively
            high_count = sum(
                1 for r in self.snapshot.prereq_results
                if r["understanding"] == "high"
            )
            total = len(self.snapshot.prereq_results)

            if high_count >= (total * 2 / 3):
                # Passed!
                self.snapshot.prerequisite_status = PrerequisiteStatus.PASSED
                self.snapshot.current_state = TeachingState.TEACH
                self.learning_state.prerequisite_status = "passed"
                return await self._call_tutor()
            else:
                # Need remediation — find weakest topic
                weak_topics = [
                    r["question"] for r in self.snapshot.prereq_results
                    if r["understanding"] != "high"
                ]
                weak_topic = ""
                for pq in self.snapshot.prereq_questions_asked:
                    for q in pq.get("questions", []):
                        if q in weak_topics:
                            weak_topic = pq["topic"]
                            break
                    if weak_topic:
                        break

                # Get remediation content (web search if needed)
                remediation = ""
                for prereq in self.roadmap.prerequisites:
                    if prereq.topic == weak_topic:
                        remediation = prereq.remediation_content
                        break

                if len(remediation) < 100:
                    web_content = await _web_search(weak_topic)
                    remediation = (remediation + "\n\n" + web_content).strip()

                self.snapshot.current_state = TeachingState.REMEDIATE
                return await self._call_tutor(
                    prereq_topic=weak_topic,
                    remediation_content=remediation,
                )

    async def _handle_remediate(self, message: str) -> str:
        """Handle response during remediation. Transition to TEACH."""
        # Student responded to remediation — evaluate loosely and move on
        self.snapshot.prerequisite_status = PrerequisiteStatus.REMEDIATED
        self.snapshot.current_state = TeachingState.TEACH
        self.learning_state.prerequisite_status = "remediated"
        return await self._call_tutor()

    async def _handle_teach(self, message: str) -> str:
        """Student responded during teaching. Transition to CHECK."""
        self.snapshot.current_state = TeachingState.CHECK_UNDERSTANDING
        node = self._current_node()
        if node and node.check_question:
            self.snapshot.last_check_question = node.check_question
        return await self._call_tutor()

    async def _handle_check_understanding(self, message: str) -> str:
        """Evaluate student's answer to check question."""
        evaluation = await self._evaluate_response(
            self.snapshot.last_check_question, message
        )
        self.snapshot.last_evaluator_output = evaluation.model_dump()
        self.snapshot.hint_attempts = 0
        self.snapshot.reteach_attempted = False

        if evaluation.understanding.value == "high":
            # Understood! Move to next node
            node = self._current_node()
            if node:
                self._log_node_completion(
                    node.node_id, True, 1,
                    evaluation.misconceptions,
                )
            self.snapshot.current_state = TeachingState.NODE_COMPLETE
            return await self._call_tutor()

        elif evaluation.understanding.value == "medium":
            # Give a hint
            self.snapshot.current_state = TeachingState.HINT
            self.snapshot.hint_attempts += 1
            analogy = await self._generate_analogy(
                self._current_node().core_concept if self._current_node() else ""
            )
            return await self._call_tutor(analogy=analogy)

        else:  # low
            # Give a hint first (don't jump to reteach)
            self.snapshot.current_state = TeachingState.HINT
            self.snapshot.hint_attempts += 1
            analogy = await self._generate_analogy(
                self._current_node().core_concept if self._current_node() else ""
            )
            return await self._call_tutor(analogy=analogy)

    async def _handle_hint(self, message: str) -> str:
        """Evaluate after hint. Escalate if needed."""
        evaluation = await self._evaluate_response(
            self.snapshot.last_check_question, message
        )
        self.snapshot.last_evaluator_output = evaluation.model_dump()

        if evaluation.understanding.value == "high":
            # Got it after hint!
            node = self._current_node()
            if node:
                self._log_node_completion(
                    node.node_id, True, self.snapshot.hint_attempts + 1,
                    evaluation.misconceptions,
                )
            self.snapshot.current_state = TeachingState.NODE_COMPLETE
            return await self._call_tutor()

        elif not self.snapshot.reteach_attempted:
            # Escalate to reteach with analogy
            self.snapshot.current_state = TeachingState.RETEACH_WITH_ANALOGY
            self.snapshot.reteach_attempted = True
            analogy = await self._generate_analogy(
                self._current_node().core_concept if self._current_node() else ""
            )
            return await self._call_tutor(analogy=analogy)

        else:
            # Already tried reteach — flag and move on
            node = self._current_node()
            if node:
                self._log_node_completion(
                    node.node_id, False, self.snapshot.hint_attempts + 2,
                    evaluation.misconceptions,
                )
            self.snapshot.current_state = TeachingState.NODE_COMPLETE
            return await self._call_tutor()

    async def _handle_reteach(self, message: str) -> str:
        """Evaluate after reteach with analogy."""
        evaluation = await self._evaluate_response(
            self.snapshot.last_check_question, message
        )
        self.snapshot.last_evaluator_output = evaluation.model_dump()

        node = self._current_node()
        if evaluation.understanding.value == "high":
            if node:
                self._log_node_completion(
                    node.node_id, True, self.snapshot.hint_attempts + 2,
                    evaluation.misconceptions,
                )
        else:
            # Still struggling — flag but advance
            if node:
                self._log_node_completion(
                    node.node_id, False, self.snapshot.hint_attempts + 2,
                    evaluation.misconceptions,
                )

        self.snapshot.current_state = TeachingState.NODE_COMPLETE
        return await self._call_tutor()

    async def _handle_node_complete(self, message: str) -> str:
        """Advance to next node or chapter evaluation."""
        self.snapshot.current_node_index += 1
        self.snapshot.hint_attempts = 0
        self.snapshot.reteach_attempted = False
        self.snapshot.last_evaluator_output = None
        self.snapshot.last_check_question = ""

        if self.snapshot.current_node_index < len(self.roadmap.teaching_nodes):
            # More nodes remain
            self.snapshot.current_state = TeachingState.TEACH
            return await self._call_tutor()
        else:
            # All nodes done → chapter evaluation
            self.snapshot.current_state = TeachingState.CHAPTER_EVALUATION
            return await self._call_tutor()

    async def _handle_chapter_evaluation(self, message: str) -> str:
        """Handle chapter evaluation — ask questions from question bank, PYQs, application Qs."""
        # Build rich evaluation context with question bank
        question_bank = self.chapter.question_bank or []

        # Select a mix of questions (application-based, critical thinking)
        eval_questions = []
        for q in question_bank:
            if isinstance(q, dict):
                qtype = q.get("type", "")
                if qtype in ("mcq", "short_answer", "long_answer"):
                    eval_questions.append(q)

        # Sample up to 5 questions for evaluation
        if eval_questions:
            sample_size = min(5, len(eval_questions))
            eval_questions = random.sample(eval_questions, sample_size)

        # Enrich the system prompt with question bank context
        qbank_text = ""
        if eval_questions:
            qbank_text = "\n\nQUESTION BANK FOR EVALUATION:\n"
            for i, q in enumerate(eval_questions, 1):
                qbank_text += f"{i}. [{q.get('type', 'short_answer')}] [{q.get('difficulty', 'medium')}] {q.get('question', '')}\n"
                qbank_text += f"   Model answer: {q.get('model_answer', 'N/A')}\n"

        node = self._current_node()
        relevant_content = await self._get_relevant_content(
            self.roadmap.chapter_name if self.roadmap else ""
        )

        system_prompt = assemble_tutor_context(
            student_profile=self.student_profile,
            subject_context=self.subject_context,
            roadmap=self.roadmap.model_dump(),
            current_node_index=max(0, self.snapshot.current_node_index - 1),
            state_snapshot=self.snapshot.model_dump(),
            relevant_content=relevant_content + qbank_text,
        )

        response = await _call_gemini_pro(system_prompt, self.messages)

        # After a few evaluation turns, transition to complete
        # Count how many evaluation turns we've done
        eval_turns = sum(1 for m in self.messages if m["role"] == "user") - len(self.roadmap.teaching_nodes) * 2
        if eval_turns >= 5:
            self.snapshot.current_state = TeachingState.CHAPTER_COMPLETE

        return response

    async def _handle_chapter_complete(self, message: str) -> str:
        """Final summary and congratulations."""
        # End the session
        result = await self.db.execute(
            select(LearningSession).where(LearningSession.id == self.session_id)
        )
        session = result.scalar_one()
        session.status = "completed"
        session.ended_at = datetime.utcnow()
        session.final_state = "chapter_complete"

        # Calculate completion
        log = self.learning_state.node_completion_log or []
        completed_topics = [
            entry["node_id"] for entry in log
            if isinstance(entry, dict) and entry.get("understood", False)
        ]
        session.subtopics_completed = completed_topics

        return await self._call_tutor()

    # ── End Session ──────────────────────────

    async def end_session(self, reason: str = "user_ended") -> None:
        """Gracefully end the current session."""
        result = await self.db.execute(
            select(LearningSession).where(LearningSession.id == self.session_id)
        )
        session = result.scalar_one()
        session.status = "ended"
        session.ended_at = datetime.utcnow()
        session.termination_reason = reason
        session.state_at_end = self.snapshot.model_dump()
        await self.db.commit()
