# 2. Architecture Overview

## Two-Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL (Edge)                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Next.js 14 Frontend (App Router)                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │  │
│  │  │ Student  │ │ Parent   │ │ Instructor │ │    Admin     │   │  │
│  │  │Dashboard │ │Dashboard │ │ Dashboard  │ │  Dashboard   │   │  │
│  │  └──────────┘ └──────────┘ └────────────┘ └──────────────┘   │  │
│  │  ┌──────────────────┐  ┌─────────────────────────────────┐   │  │
│  │  │ NextAuth.js v5   │  │ API Route Proxy (/api/ai/*)     │   │  │
│  │  │ (JWT sessions)   │  │ (forwards to FastAPI backend)   │   │  │
│  │  └──────────────────┘  └─────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS / SSE stream
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       RAILWAY (Container)                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  FastAPI Backend (Python)                      │  │
│  │                                                               │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ Session    │  │ Prompt       │  │ RAG Retrieval        │  │  │
│  │  │ State      │  │ Assembly     │  │ Engine               │  │  │
│  │  │ Machine    │  │ Engine       │  │ (pgvector queries)   │  │  │
│  │  └─────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │  │
│  │        │                │                      │              │  │
│  │        ▼                ▼                      ▼              │  │
│  │  ┌──────────────────────────────────────────────────────┐     │  │
│  │  │              LLM Orchestrator                        │     │  │
│  │  │  (assembles prompt → calls OpenAI → streams back)    │     │  │
│  │  └──────────────────────────────────────────────────────┘     │  │
│  │                                                               │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ Ingestion  │  │ Background   │  │ Notification         │  │
│  │  │ Pipeline   │  │ Summarizer   │  │ Service (WhatsApp)   │  │
│  │  │ (PDF→chunk │  │ (GPT-4o-mini)│  │ (Twilio)             │  │
│  │  │  →embed)   │  │              │  │                      │  │
│  │  └────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐    │
│  │ PostgreSQL 16  │  │    Redis       │  │   S3 / MinIO       │    │
│  │ + pgvector     │  │ (session state │  │ (PDFs, images,     │    │
│  │                │  │  + cache)      │  │  audio files)      │    │
│  └────────────────┘  └────────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## RAG Pipeline — End to End

### Ingestion (Instructor-triggered)

```
PDF Upload → S3 Storage → PyMuPDF text extraction
    → Chunking (512 tokens, 64 token overlap, chapter-aware boundaries)
    → OpenAI text-embedding-3-small → pgvector INSERT
    → Metadata tagged: subject_id, chapter_id, subtopic, page_number, chunk_type (text/diagram_caption)
```

- Instructor uploads PDF + chapter roadmap JSON via dashboard
- Backend validates, stores raw PDF in S3, triggers async ingestion (FastAPI BackgroundTasks)
- Chunks are stored in `content_chunks` table with embedding vector column
- NCERT diagrams: extracted as images via PyMuPDF, stored in S3, referenced in chunk metadata
- Ingestion status tracked in `ingestion_jobs` table (pending → processing → complete → failed)

### Retrieval (During teaching session)

```
Session context (current subtopic + student question)
    → Embed query via text-embedding-3-small
    → pgvector cosine similarity search (top-5 chunks, filtered by chapter_id + subtopic)
    → Retrieved chunks injected into system prompt as [TEXTBOOK_CONTEXT] block
```

- Retrieval is scoped: always filtered by current `chapter_id`, optionally by `subtopic`
- Reranking: not needed at MVP scale; simple cosine similarity suffices for <500 chunks

---

## Session State Machine

The session follows a **finite state machine** enforced entirely by the backend. The LLM never decides the current phase — the backend tells it.

```
┌──────────────┐
│  ONBOARDING  │ (first time in subject only)
└──────┬───────┘
       ▼
┌──────────────┐     fail      ┌──────────────────┐
│  PREREQ      │──────────────▶│  PREREQ_TEACHING │
│  ASSESSMENT  │               │  (teach gaps)     │
└──────┬───────┘               └────────┬──────────┘
       │ pass                           │ re-assess
       ▼                                ▼
┌──────────────┐               ┌──────────────────┐
│  TEACHING    │◀──────────────│  RE_EXPLANATION  │
│  (subtopic N)│               │  (diff modality) │
└──────┬───────┘               └──────────────────┘
       │                               ▲
       ▼                               │ student confused
┌──────────────┐───────────────────────┘
│  COMPREHENSION│
│  CHECK       │
└──────┬───────┘
       │ pass
       ▼
┌──────────────┐
│  SUBTOPIC    │──── weak ────▶ loop to TEACHING (same subtopic)
│  ASSESSMENT  │
└──────┬───────┘
       │ pass
       ▼
  (next subtopic or SESSION_SUMMARY)
       │
       ▼
┌──────────────┐
│  SESSION     │ → generate summary, reflection Qs, real-world discussion
│  SUMMARY     │ → trigger WhatsApp notification
└──────┬───────┘
       ▼
┌──────────────┐
│  TERMINATED  │ (natural or early exit with reason)
└──────────────┘
```

**Where state lives:**
- **Redis:** Active session state (current phase, subtopic index, conversation buffer, assessment scores). Key: `session:{session_id}`. TTL: 2 hours.
- **PostgreSQL:** Persisted session record on completion (full conversation log, scores, summary).

**How it works:**
1. Frontend sends student message to `/api/session/{id}/message`
2. Backend reads session state from Redis
3. Backend determines the current phase → selects the correct prompt template
4. Assembles full prompt (system prompt + RAG chunks + conversation history + student message)
5. Calls OpenAI streaming API
6. Streams response tokens to frontend via SSE
7. Parses LLM's structured output flags (if present) to detect state transitions
8. Updates session state in Redis

---

## Persona & Subject Context Injection

Every LLM call includes these context blocks in the system prompt:

```
[STUDENT_PERSONA]
Name: {name}
Grade: {grade}
Interests: {interests_list}
Learning preferences: {preferences}
Overall notes: {rolling_summary_excerpt}

[SUBJECT_CONTEXT]
Subject: {subject_name}
Comfort level: {comfort}
Known weak areas: {weak_areas}
Preferred modalities: {preferred_modalities}
Subject-specific notes: {subject_summary_excerpt}

[TEXTBOOK_CONTEXT]
{rag_retrieved_chunks}

[SESSION_STATE]
Current phase: {phase}
Current subtopic: {subtopic_name}
Subtopics completed: {list}
Assessment results so far: {scores}
```

This context is assembled fresh for every LLM call by the Prompt Assembly Engine.

---

## Background Summarization

- **Trigger:** Fires after every session ends (async background task)
- **Model:** GPT-4o-mini
- **Input:** Full conversation log of the just-completed session
- **Output:** Structured summary (JSON): `{key_learnings, weak_areas, engagement_level, notable_moments, updated_persona_notes}`
- **Storage:** Appended to `session_summaries` table; relevant fields merged into `student_subject_context.rolling_summary`
- The rolling summary is a **condensed, ever-updated** paragraph that captures the student's evolving understanding — not a raw log

---

## WhatsApp Notification Flow

```
Session ends → Backend triggers notification task
    → GPT-4o-mini generates parent-friendly message using:
        - Session summary
        - Student performance (positive framing)
        - Highlight moment
        - Early termination reason (if applicable)
    → Twilio WhatsApp API sends template message to parent's number
    → Delivery status webhook updates notification_log
```

---

## Streaming Architecture

```
Frontend (EventSource) ←── SSE ←── Next.js API route ←── SSE ←── FastAPI endpoint
                                                                      │
                                                        OpenAI stream ──┘
```

- FastAPI uses `StreamingResponse` with `text/event-stream` content type
- Each SSE event is a JSON object: `{ "type": "text_delta" | "audio_url" | "image_url" | "state_change" | "assessment", "data": ... }`
- Frontend renders incrementally: text streams into a chat bubble, audio/image URLs trigger media embeds
- Connection timeout: 5 minutes (covers a long LLM response)

---

## Complete Data Flow: One Learning Session

1. Student clicks "Start Session" on Science Ch. 2
2. Frontend calls `POST /api/session/start` with `{student_id, chapter_id}`
3. Backend creates session in Redis (state = `PREREQ_ASSESSMENT`), creates DB record
4. Backend assembles prerequisite assessment prompt (persona + subject context + chapter prereqs from roadmap JSON)
5. LLM generates 3-4 prerequisite questions → streamed to student
6. Student answers → backend evaluates (via LLM with rubric) → updates Redis state
7. If prereqs weak → state = `PREREQ_TEACHING` → brief teaching → re-assess → loop
8. If prereqs OK → state = `TEACHING` → subtopic 1 begins
9. LLM teaches using RAG-retrieved NCERT content, persona-based analogies
10. LLM output includes structured flags: `{"needs_audio": true, "needs_image": false}`
11. If audio needed → backend calls ElevenLabs TTS → streams audio URL in SSE event
12. After explanation → state = `COMPREHENSION_CHECK` → LLM asks if understood
13. If not → state = `RE_EXPLANATION` → different modality/analogy
14. If yes → state = `SUBTOPIC_ASSESSMENT` → quick quiz
15. Cycle repeats for each subtopic in chapter roadmap
16. After all subtopics (or 30 min elapsed) → state = `SESSION_SUMMARY`
17. LLM generates summary, reflection questions, real-world discussion
18. Session persisted to PostgreSQL, Redis key deleted
19. Background task: GPT-4o-mini summarizes session → updates rolling context
20. Background task: GPT-4o-mini generates WhatsApp message → Twilio sends to parent
