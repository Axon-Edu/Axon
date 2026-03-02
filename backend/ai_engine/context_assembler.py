"""Context Assembly Engine — builds system prompts for all 5 LLM call types.

This module contains NO LLM calls. It only assembles prompt strings.
The state machine and API layer make the actual Claude API calls.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from ai_engine.schemas import (
    TeachingState,
    StateMachineSnapshot,
    RoadmapJSON,
    TeachingNode,
)

# ──────────────────────────────────────────────
# Prompt file loader
# ──────────────────────────────────────────────

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(filename: str) -> str:
    """Load a prompt text file from the prompts/ directory."""
    path = _PROMPTS_DIR / filename
    return path.read_text().strip()


# ──────────────────────────────────────────────
# State-specific behavioral instructions
# ──────────────────────────────────────────────

def _get_state_instructions(
    state: TeachingState,
    node: Optional[TeachingNode],
    student_interests: list[str],
    analogy: str = "",
    prereq_question: str = "",
    prereq_topic: str = "",
    remediation_content: str = "",
    next_topic: str = "",
    evaluator_result: Optional[dict] = None,
) -> str:
    """Return state-specific behavioral instructions for the tutor."""
    interest_str = ", ".join(student_interests[:3]) if student_interests else "everyday life"
    topic = node.topic if node else "the current concept"
    core_concept = node.core_concept if node else ""
    teaching_hint = node.teaching_hint if node else ""
    check_question = node.check_question if node else ""
    expected_signals = ", ".join(node.expected_understanding_signals) if node else ""

    instructions = {
        TeachingState.PREREQUISITE_CHECK: (
            f"Ask the following prerequisite question: \"{prereq_question}\"\n"
            f"Evaluate their response to gauge their foundational understanding. "
            f"Be encouraging regardless of their answer."
        ),
        TeachingState.REMEDIATE: (
            f"The student struggled with the prerequisite topic: '{prereq_topic}'.\n"
            f"Explain it simply, connecting it to their interest in {interest_str}.\n"
            f"Use this remediation content as your guide:\n{remediation_content}\n"
            f"After explaining, ask a simple verification question to confirm they got it."
        ),
        TeachingState.TEACH: (
            f"Teach the concept: '{core_concept}'\n"
            f"Teaching hint: {teaching_hint}\n"
            f"Connect it to the student's interest in {interest_str} if natural.\n"
            f"Break it into small steps. After explaining, naturally lead into the check question."
        ),
        TeachingState.CHECK_UNDERSTANDING: (
            f"Ask this check question: \"{check_question}\"\n"
            f"Wait for their answer. Do not give hints yet — just ask clearly and warmly."
        ),
        TeachingState.HINT: (
            f"The student's understanding is partial (medium). Give a Socratic hint.\n"
            f"Use their interest in {interest_str} to create a nudge.\n"
            f"Do NOT reveal the answer directly.\n"
            f"Guide them toward these signals: {expected_signals}"
        ),
        TeachingState.RETEACH_WITH_ANALOGY: (
            f"The student still doesn't understand after a hint. Time to reteach from scratch.\n"
            f"Use this analogy: \"{analogy}\"\n"
            f"Reteach '{core_concept}' from a completely different angle.\n"
            f"Make it vivid and relatable. Then ask if it clicks."
        ),
        TeachingState.DOUBT_RESPONSE: (
            f"The student asked a doubt or question. Respond to it clearly and patiently.\n"
            f"After resolving the doubt, smoothly return to what you were doing before.\n"
            f"If the doubt is about the current topic, that's great — it shows engagement."
        ),
        TeachingState.NODE_COMPLETE: (
            f"Great! The student understood '{topic}'! 🎉\n"
            f"Briefly celebrate their achievement (be genuine, not mechanical).\n"
            f"Then smoothly transition to the next topic: '{next_topic}'.\n"
            f"Give a brief preview of what's coming next to build curiosity."
        ),
        TeachingState.CHAPTER_EVALUATION: (
            f"The student has finished all teaching nodes! Now run a chapter evaluation.\n"
            f"Ask them questions from the question bank (application-based, critical thinking).\n"
            f"Include CBSE PYQ-style questions if relevant.\n"
            f"Ask practical questions about where these concepts are used in real life.\n"
            f"Connect to their interest in {interest_str} where possible.\n"
            f"Ask ONE question at a time, evaluate their answer, then ask the next."
        ),
        TeachingState.CHAPTER_COMPLETE: (
            f"The student completed all topics in this chapter! 🏆\n"
            f"Summarize the key concepts they learned.\n"
            f"Congratulate them warmly.\n"
            f"Let them know they can always come back to review."
        ),
    }

    return instructions.get(state, "Continue the teaching conversation naturally.")


# ──────────────────────────────────────────────
# Function 1: Tutor Context (Sonnet)
# ──────────────────────────────────────────────

def assemble_tutor_context(
    student_profile: dict,
    subject_context: dict,
    roadmap: dict,
    current_node_index: int,
    state_snapshot: dict,
    relevant_content: str = "",
    analogy: str = "",
    prereq_question: str = "",
    prereq_topic: str = "",
    remediation_content: str = "",
) -> str:
    """Assemble the full system prompt for the science tutor (Sonnet).

    Args:
        student_profile: Dict with name, grade, interests, learning_style_signals, companion_summary
        subject_context: Dict with confidence_level, anxiety_signals, engagement_pattern
        roadmap: The chapter's roadmap dict (RoadmapJSON shape)
        current_node_index: Index into roadmap.teaching_nodes
        state_snapshot: StateMachineSnapshot as dict
        relevant_content: Text content chunk for the current topic
        analogy: Pre-generated analogy (if HINT or RETEACH state)
        prereq_question: Current prerequisite question (if PREREQ_CHECK state)
        prereq_topic: Current prerequisite topic (if REMEDIATE state)
        remediation_content: Remediation text (if REMEDIATE state)

    Returns:
        Complete system prompt string for Claude Sonnet
    """
    # Parse roadmap
    parsed_roadmap = RoadmapJSON(**roadmap) if roadmap else RoadmapJSON(chapter_name="Unknown")
    nodes = parsed_roadmap.teaching_nodes
    current_node = nodes[current_node_index] if current_node_index < len(nodes) else None
    next_node = nodes[current_node_index + 1] if (current_node_index + 1) < len(nodes) else None
    next_topic = next_node.topic if next_node else "chapter review"

    # Parse state
    current_state = TeachingState(state_snapshot.get("current_state", "teach"))
    evaluator_result = state_snapshot.get("last_evaluator_output")

    # Build blocks
    blocks = []

    # Block 1: Persona
    blocks.append(_load_prompt("tutor_persona.txt"))

    # Block 2: Student Profile
    name = student_profile.get("name", "Student")
    grade = student_profile.get("grade", 10)
    interests = student_profile.get("interests", [])
    learning_style = student_profile.get("learning_style_signals", {})
    companion_summary = student_profile.get("companion_summary", "")

    profile_block = f"""
STUDENT PROFILE:
- Name: {name}
- Grade: Class {grade} (age ~{grade + 5})
- Interests: {', '.join(interests) if interests else 'not yet known'}
- Learning style: {_format_learning_style(learning_style)}
- What the companion learned: {companion_summary if companion_summary else 'No companion session yet'}"""
    blocks.append(profile_block.strip())

    # Block 3: Subject Context
    confidence = subject_context.get("confidence_level", "unknown")
    anxiety = subject_context.get("anxiety_signals", "")
    engagement = subject_context.get("engagement_pattern", "")

    subject_block = f"""
SUBJECT CONTEXT (Science):
- Confidence level: {confidence}
- Anxiety signals: {anxiety if anxiety else 'none noted'}
- Engagement pattern: {engagement if engagement else 'not yet observed'}"""
    blocks.append(subject_block.strip())

    # Block 4: Teaching State
    node_desc = f"'{current_node.topic}: {current_node.core_concept}'" if current_node else "none"
    last_question = state_snapshot.get("last_check_question", "")
    evaluator_summary = ""
    if evaluator_result:
        evaluator_summary = (
            f"  Understanding: {evaluator_result.get('understanding', '?')}\n"
            f"  Got right: {evaluator_result.get('what_they_got_right', '')}\n"
            f"  Needs reinforcement: {evaluator_result.get('needs_reinforcement', '')}"
        )

    state_block = f"""
CURRENT TEACHING STATE:
- State: {current_state.value}
- Current node: {node_desc}
- Node index: {current_node_index} of {len(nodes)}
- Last check question: {last_question if last_question else 'none yet'}
- Last evaluator result:
{evaluator_summary if evaluator_summary else '  No evaluation yet'}"""
    blocks.append(state_block.strip())

    # Block 5: Chapter Content
    if relevant_content:
        content_block = f"""
RELEVANT CHAPTER CONTENT:
{relevant_content}"""
        blocks.append(content_block.strip())

    # Block 6: Roadmap Node Details
    if current_node:
        misconceptions = ", ".join(current_node.common_misconceptions) if current_node.common_misconceptions else "none noted"
        signals = ", ".join(current_node.expected_understanding_signals) if current_node.expected_understanding_signals else "general understanding"

        node_block = f"""
ROADMAP NODE DETAILS:
- Topic: {current_node.topic}
- Core concept: {current_node.core_concept}
- Teaching hint: {current_node.teaching_hint}
- Expected understanding signals: {signals}
- Common misconceptions to watch for: {misconceptions}"""
        blocks.append(node_block.strip())

    # Block 7: State-specific behavioral instructions
    instructions = _get_state_instructions(
        state=current_state,
        node=current_node,
        student_interests=interests,
        analogy=analogy,
        prereq_question=prereq_question,
        prereq_topic=prereq_topic,
        remediation_content=remediation_content,
        next_topic=next_topic,
        evaluator_result=evaluator_result,
    )
    blocks.append(f"YOUR TASK RIGHT NOW:\n{instructions}")

    return "\n\n---\n\n".join(blocks)


def _format_learning_style(signals: dict) -> str:
    """Format learning style signals into readable text."""
    if not signals:
        return "not yet assessed"
    parts = []
    for key, value in signals.items():
        if isinstance(value, bool) and value:
            parts.append(key)
        elif isinstance(value, str) and value:
            parts.append(f"{key}: {value}")
    return ", ".join(parts) if parts else "not yet assessed"


# ──────────────────────────────────────────────
# Function 2: Evaluator Context (Haiku)
# ──────────────────────────────────────────────

EVALUATOR_SYSTEM_PROMPT = """You are an understanding evaluator for a CBSE Class 10 Science tutor system.
Given a question, expected understanding signals, and a student's response,
evaluate their understanding level.

Output ONLY valid JSON matching this schema:
{
  "understanding": "high|medium|low",
  "misconceptions": ["list of misconceptions detected, empty if none"],
  "what_they_got_right": "brief description of correct understanding",
  "needs_reinforcement": "what concept needs more work, empty if none"
}

Rules:
- "high" = student clearly understands the core concept and can explain it
- "medium" = partial understanding, on the right track but with gaps
- "low" = fundamental misunderstanding or unable to answer
- Be GENEROUS but honest — a student who's partially right is "medium", not "low"
- A student saying "I don't know" is "low"
- Consider the age group (14-16 years) — don't expect textbook-perfect answers"""


def assemble_evaluator_context(
    question: str,
    expected_signals: list[str],
    student_response: str,
) -> tuple[str, str]:
    """Assemble context for the understanding evaluator.

    Returns:
        Tuple of (system_prompt, user_message)
    """
    signals_str = "\n".join(f"- {s}" for s in expected_signals) if expected_signals else "- General understanding of the concept"

    user_message = f"""Question asked: "{question}"

Expected understanding signals:
{signals_str}

Student's response: "{student_response}"

Evaluate their understanding and output JSON."""

    return EVALUATOR_SYSTEM_PROMPT, user_message


# ──────────────────────────────────────────────
# Function 3: Analogy Context (Haiku)
# ──────────────────────────────────────────────

ANALOGY_SYSTEM_PROMPT = """You generate simple, vivid analogies for CBSE Class 10 Science concepts.

Rules:
- The analogy MUST connect the science concept to something the student already knows and enjoys
- Output ONLY the analogy — 1-3 sentences maximum
- Use simple language appropriate for a 14-16 year old
- Use natural Hindi-English code-mixing if it makes the analogy feel more relatable
- Make it visual and concrete, not abstract
- Do NOT include any preamble like "Here's an analogy:" — just the analogy itself"""


def assemble_analogy_context(
    concept: str,
    student_interests: list[str],
    age: int = 15,
) -> tuple[str, str]:
    """Assemble context for one-shot analogy generation.

    Returns:
        Tuple of (system_prompt, user_message)
    """
    interests_str = ", ".join(student_interests) if student_interests else "cricket, movies, everyday life"

    user_message = f"""Science concept to explain: {concept}
Student's interests: {interests_str}
Student's age: {age} years

Generate a relatable analogy."""

    return ANALOGY_SYSTEM_PROMPT, user_message


# ──────────────────────────────────────────────
# Function 4: Companion Context (Haiku)
# ──────────────────────────────────────────────

def assemble_companion_context(
    student_profile: dict,
    is_onboarding: bool,
    conversation_history: list[dict],
) -> str:
    """Assemble the system prompt for the companion (Haiku).

    Args:
        student_profile: Dict with name, grade, interests
        is_onboarding: Whether this is the first companion session
        conversation_history: List of {"role": str, "content": str} dicts
            (included in messages array, not in system prompt)

    Returns:
        System prompt string for Claude Haiku
    """
    blocks = []

    # Block 1: Persona
    blocks.append(_load_prompt("companion_persona.txt"))

    # Block 2: Student Profile
    name = student_profile.get("name", "the student")
    grade = student_profile.get("grade", 10)
    interests = student_profile.get("interests", [])

    profile_block = f"""
STUDENT INFO:
- Name: {name}
- Grade: Class {grade}
- Known interests: {', '.join(interests) if interests else 'not yet known — discover them!'}"""
    blocks.append(profile_block.strip())

    # Block 3: Mode-specific instructions
    if is_onboarding:
        mode_block = """
MODE: ONBOARDING (first conversation)
This is your first time meeting this student. Your goal is to naturally learn about them.
Weave these topics into a natural conversation (don't ask them all at once!):
1. What they enjoy doing (hobbies, games, shows, sports)
2. What subjects they find interesting vs boring
3. How they feel about Science specifically
4. Whether they prefer reading, watching, doing, or discussing to learn
5. What makes them nervous or excited about school

Start with a warm greeting and ask about something fun — NOT school."""
    else:
        companion_summary = student_profile.get("companion_summary", "")
        mode_block = f"""
MODE: OPEN CONVERSATION (returning student)
You already know this student. Continue being a warm, supportive friend.
Previous context: {companion_summary if companion_summary else 'Just be friendly and curious.'}
You can check in on how they're feeling, chat about their interests, or just hang out."""

    blocks.append(mode_block.strip())

    return "\n\n---\n\n".join(blocks)


# ──────────────────────────────────────────────
# Function 5: Context Extractor (Haiku)
# ──────────────────────────────────────────────

CONTEXT_EXTRACTOR_SYSTEM_PROMPT = """You are a context extractor for an AI tutoring system. 
Analyze the following companion conversation with a student and extract structured information.

Output ONLY valid JSON matching this schema:
{
  "interests": ["list of hobbies, interests, and things they enjoy"],
  "learning_style_signals": {
    "visual": true/false,
    "auditory": true/false,
    "reading_writing": true/false,
    "kinesthetic": true/false,
    "prefers_examples": true/false,
    "prefers_discussion": true/false,
    "notes": "any other learning preference observations"
  },
  "science_confidence": "low|medium|high",
  "science_anxiety": "description of any anxiety, stress, or negative feelings about science (empty string if none)",
  "companion_summary_update": "2-3 sentence summary of what was learned about this student in this conversation"
}

Rules:
- Only include interests the student actually mentioned
- For learning style, infer from how they talk about learning (e.g., "I like watching videos" → visual=true)
- If they didn't discuss science feelings, set confidence to "medium" and anxiety to ""
- The summary should be written as if briefing another tutor about this student"""


def assemble_context_extractor_context(
    companion_turns: list[dict],
) -> tuple[str, str]:
    """Assemble context for post-session context extraction.

    Args:
        companion_turns: List of {"role": str, "content": str} message dicts

    Returns:
        Tuple of (system_prompt, user_message)
    """
    # Format conversation
    formatted_turns = []
    for turn in companion_turns:
        role = "Student" if turn.get("role") == "user" else "Companion"
        formatted_turns.append(f"{role}: {turn.get('content', '')}")

    conversation_text = "\n".join(formatted_turns)

    user_message = f"""Analyze this companion conversation and extract structured context:

{conversation_text}

Output the JSON extraction."""

    return CONTEXT_EXTRACTOR_SYSTEM_PROMPT, user_message


# ──────────────────────────────────────────────
# Doubt Detection Prompt (used by state machine)
# ──────────────────────────────────────────────

DOUBT_DETECTOR_SYSTEM_PROMPT = """You are a doubt/question detector for a tutoring system.
Given a student's message in a teaching session, determine if they are asking a doubt/question 
or if they are responding to a question the tutor asked.

Output ONLY one word: "doubt" or "response"

Rules:
- If the student asks "why", "how", "what if", "I don't understand", "can you explain" → "doubt"
- If the student is answering a question (even incorrectly) → "response"
- If the student says "ok", "yes", "hmm", "continue" → "response"
- When in doubt, classify as "response" (don't over-detect doubts)"""


def assemble_doubt_detector_context(student_message: str) -> tuple[str, str]:
    """Assemble context for the doubt detector (fast Haiku call).

    Returns:
        Tuple of (system_prompt, user_message)
    """
    return DOUBT_DETECTOR_SYSTEM_PROMPT, f'Student said: "{student_message}"'
