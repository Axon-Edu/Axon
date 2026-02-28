# 5. Phased Development Roadmap

> **Total timeline: 3 days.** Phases overlap where independent. Estimated hours per phase are development hours, not wall-clock.

---

## Phase 0: Project Scaffold, Auth & Schema (4 hours)

**Objective:** A running app with auth, role-based routing, and an empty database ready for data.

**What gets built:**
1. Next.js 14 project with App Router, project structure, ESLint, Prettier
2. FastAPI project with poetry/pip, project structure, CORS config
3. PostgreSQL schema migration (all tables from Section 3) via Alembic
4. pgvector extension enabled
5. NextAuth.js v5 with email/password provider, JWT sessions, role field in token
6. Role-based middleware: `/student/*`, `/parent/*`, `/instructor/*`, `/admin/*` routes protected
7. Seed script: 1 user per role, 1 subject (Science), 1 chapter stub
8. Redis connection setup (session state utilities)
9. S3 bucket creation with presigned URL utility
10. Environment config (`.env.example` with all required vars)

**Implementation notes:**
- Use Alembic for schema migrations — never raw SQL in production
- NextAuth adapter: use the Prisma adapter with PostgreSQL (Prisma only for auth; FastAPI uses SQLAlchemy/asyncpg for everything else)
- Set up a shared types file for roles and session states (used by both frontend routing and API validation)

**Success criteria:**
- [ ] `npm run dev` starts frontend at localhost:3000 without errors
- [ ] `uvicorn main:app` starts backend at localhost:8000 with `/docs` accessible
- [ ] All 14 tables exist in PostgreSQL (`\dt` shows them)
- [ ] Login with seeded student account → redirected to `/student/dashboard`
- [ ] Login with seeded instructor account → redirected to `/instructor/dashboard`
- [ ] Accessing `/admin/dashboard` without admin role → 403 redirect
- [ ] Redis `PING` returns `PONG` from backend health check

**NOT built:** Any dashboard UI beyond a placeholder "Welcome, {role}" page. No AI features.

---

## Phase 1: Instructor Dashboard + RAG Ingestion Pipeline (4 hours)

**Objective:** An instructor can upload a PDF + chapter roadmap, and the system chunks, embeds, and stores it for retrieval.

**What gets built:**
1. Instructor dashboard page: file upload form (PDF + roadmap JSON textarea)
2. FastAPI endpoint: `POST /api/content/ingest` — accepts PDF + roadmap
3. PDF → S3 upload
4. Async ingestion pipeline: PyMuPDF extraction → chapter-aware chunking (512 tokens, 64 overlap) → OpenAI embedding → pgvector INSERT
5. Diagram extraction: images pulled from PDF, stored in S3, captions linked to chunks
6. Ingestion job status tracking (polling endpoint: `GET /api/content/jobs/{id}`)
7. Instructor dashboard: job status display (pending/processing/complete/failed)
8. Chapter roadmap saved to `chapters.roadmap` JSONB column
9. Simple content viewer: list chunks for a chapter (for instructor verification)

**Implementation notes:**
- Chunking strategy: split by paragraph first, then by token count. Respect page boundaries. Tag each chunk with subtopic (extracted from nearest section heading in PDF).
- Use `tiktoken` for accurate token counting (OpenAI's tokenizer).
- Background processing via FastAPI `BackgroundTasks` — no Celery needed at MVP scale.

**Success criteria:**
- [ ] Upload a 20-page NCERT PDF → job shows "processing" → eventually "completed"
- [ ] `SELECT count(*) FROM content_chunks WHERE chapter_id = X` returns >0 chunks
- [ ] Each chunk has a non-null embedding vector of dimension 1536
- [ ] `SELECT * FROM content_assets WHERE chapter_id = X` shows extracted diagrams
- [ ] Chapter roadmap JSON is queryable: `SELECT roadmap->'subtopics' FROM chapters`
- [ ] Re-uploading same chapter replaces old chunks (idempotent ingestion)

**NOT built:** Student-facing features. No retrieval queries yet (only storage).

---

## Phase 2: Student Onboarding + Persona System + Dashboard UI (4 hours)

**Objective:** A new student goes through animated onboarding, and the system stores their persona. Student dashboard shows subject cards.

**What gets built:**
1. Student onboarding flow: animated mascot (Lottie) asks name, grade, interests (predefined list with multi-select), learning preferences
2. Onboarding state stored in `student_profiles` table
3. Subject onboarding flow: mascot asks subject-specific questions → stored in `student_subject_contexts`
4. Student dashboard UI: learning streak (placeholder 0), subject cards, "Start Session" CTA, greeting with student name
5. Lottie mascot component: idle animation, talking animation, celebration animation
6. Gen-Z aesthetic: dark mode, vibrant accent colors, glassmorphism cards, smooth page transitions
7. API endpoints: `POST /api/student/onboarding`, `POST /api/student/subject-onboarding`, `GET /api/student/profile`

**Implementation notes:**
- Onboarding is a multi-step form with mascot animations synced to each step
- Interests list (predefined): cricket, music, cooking, gaming, movies, art, dance, animals, space, cars, fashion, fitness, photography
- Subject onboarding questions: "How do you feel about {subject}?", "What confuses you most?", "Do you prefer reading, listening, or watching?"
- Dashboard uses CSS Grid for subject cards, Framer Motion for transitions

**Success criteria:**
- [ ] New student signup → onboarding flow triggers automatically
- [ ] Complete onboarding → `student_profiles.onboarding_completed = true`
- [ ] Interests saved in `student_profiles.interests` as JSONB array
- [ ] First time clicking Science → subject onboarding flow triggers
- [ ] Complete subject onboarding → `student_subject_contexts.onboarding_completed = true`
- [ ] Dashboard shows subject card with "Start Session" button
- [ ] Mascot animations play smoothly (no jank, 60fps)
- [ ] Returning student → skips onboarding, goes directly to dashboard

**NOT built:** Active learning sessions. No LLM calls yet (onboarding is frontend form + DB writes).

---

## Phase 3: Session State Machine + Core LLM Teaching Loop — Text Only (5 hours)

**Objective:** A student can start a session, and the LLM teaches a chapter subtopic with text-only responses, following the state machine. Streaming works.

**What gets built:**
1. Session creation endpoint: `POST /api/session/start`
2. Redis session state management (create, read, update, transition)
3. Full state machine implementation (all states from architecture doc)
4. Prompt Assembly Engine: loads `.jinja2` templates, injects persona + context + RAG
5. RAG retrieval: embed query → pgvector cosine search → top-5 chunks filtered by chapter + subtopic
6. OpenAI streaming call with structured JSON output
7. SSE streaming endpoint: `GET /api/session/{id}/stream`
8. Frontend chat UI: streaming text display, chat bubbles, typing indicator
9. Session message persistence to `session_messages` table
10. Session end logic: `POST /api/session/{id}/end`
11. Early termination with reason capture

**Implementation notes:**
- **This is the hardest phase.** The state machine + prompt assembly + streaming pipeline is the core IP.
- Use an enum class for states with explicit transition rules (e.g., `TEACHING` can only go to `COMPREHENSION_CHECK` or `RE_EXPLANATION`)
- Streaming JSON parsing: use a buffered parser that extracts `response_text` as it arrives and accumulates the rest
- Conversation history: keep last 10 messages in Redis for prompt context; full history in PostgreSQL
- Prompt template selection is a simple dict mapping: `state → template_file`

**Success criteria:**
- [ ] Start session → LLM asks prerequisite questions (text streamed to UI)
- [ ] Answer prereq questions → LLM evaluates and either teaches gaps or proceeds
- [ ] Teaching state → LLM explains subtopic using NCERT RAG content
- [ ] RAG chunks visible in backend logs (correct chapter + subtopic filtered)
- [ ] Student persona and interests present in system prompt (verify via logging)
- [ ] Student says "I don't understand" → LLM re-explains differently
- [ ] Complete all subtopics → session summary generated
- [ ] Early termination → reason saved in DB, session status = "terminated"
- [ ] All messages persisted in `session_messages` with correct sequence numbers
- [ ] Streaming latency: first token appears in <1.5s

**NOT built:** Audio, images, assessments (beyond basic LLM evaluation), WhatsApp.

---

## Phase 4: Multimodal Layer — Audio + Images (3 hours)

**Objective:** The LLM can trigger audio narration and image generation/serving during teaching.

**What gets built:**
1. ElevenLabs TTS integration: text → audio → S3 upload → URL returned
2. DALL·E 3 integration: image prompt → generation → S3 upload → URL returned
3. NCERT diagram serving: lookup `content_assets` by chapter + subtopic → serve S3 URL
4. SSE event types: `audio_url`, `image_url` alongside `text_delta`
5. Frontend: inline audio player component (play/pause, auto-play option)
6. Frontend: inline image display with zoom/expand
7. LLM structured output parsing: when `needs_audio: true` → trigger TTS pipeline
8. When `needs_image: true` + no matching NCERT diagram → trigger DALL·E; else serve NCERT diagram

**Implementation notes:**
- TTS is called AFTER the text response is complete (not during streaming) — we buffer `response_text`, then synthesize
- Audio is generated in chunks (paragraph-level) for faster time-to-first-audio
- Image generation is async — send placeholder "Generating visual..." → SSE `image_url` event when ready
- Cache generated images in S3 keyed by prompt hash — avoid regenerating same concept twice

**Success criteria:**
- [ ] LLM flags `needs_audio: true` → audio player appears with natural voice narration
- [ ] Audio matches the text content (not garbled or truncated)
- [ ] LLM flags `needs_image: true` for a concept with NCERT diagram → diagram served (no DALL·E call)
- [ ] LLM flags `needs_image: true` with no existing diagram → DALL·E generates an educational image
- [ ] Generated image is relevant to the subtopic being taught
- [ ] Audio latency: playable within 3s of text completion
- [ ] Image generation: displayed within 8s of request

**NOT built:** Assessment scoring engine, WhatsApp, parent dashboard.

---

## Phase 5: Assessment Engine (3 hours)

**Objective:** Structured assessments with scoring, weakness detection, and re-teaching loops work end-to-end.

**What gets built:**
1. Prerequisite assessment: LLM generates questions → student answers → LLM evaluates → backend scores
2. Comprehension check: quick single-question check after each teaching block
3. Subtopic assessment: 2-3 questions after each subtopic → scored → pass/fail
4. `session_assessments` table populated with questions, responses, scores
5. Weakness detection: failed assessments → weak areas added to session state
6. Re-teaching trigger: failed subtopic assessment → loop back to TEACHING (same subtopic, different prompt)
7. Assessment UI: quiz-style cards, answer input, immediate feedback display
8. Progress indicators: subtopics completed vs. remaining shown in session UI

**Implementation notes:**
- Assessment evaluation is done by LLM with a rubric in the prompt — not keyword matching
- Pass threshold: 60% (configurable per chapter in roadmap JSON)
- Max re-teach attempts per subtopic: 2 (after that, note weakness and proceed)
- Assessment results feed into subject context `weak_areas` for future sessions

**Success criteria:**
- [ ] Prereq assessment: 4 questions generated, answers evaluated, score calculated
- [ ] Score < 60% → prereq teaching triggers → re-assessment → pass → proceed
- [ ] Subtopic assessment after teaching → score saved in `session_assessments`
- [ ] Failed subtopic → re-taught with different analogy → re-assessed
- [ ] Weak areas written to session state and visible in subsequent prompts
- [ ] Assessment UI shows correct/incorrect with feedback for each question
- [ ] Progress bar updates as subtopics are completed

**NOT built:** WhatsApp, parent dashboard, background summarization.

---

## Phase 6: Session Summary + WhatsApp Notification (2.5 hours)

**Objective:** Sessions end with a rich summary, and parents receive a WhatsApp message.

**What gets built:**
1. Session summary generation (GPT-4o, end of session): summary text, reflection questions, real-world application
2. Session summary UI: dedicated summary screen with download/share option
3. WhatsApp message generation (GPT-4o-mini): parent-friendly summary
4. Twilio WhatsApp API integration: send template message
5. `notification_log` table populated, delivery status tracking via Twilio webhooks
6. Twilio webhook endpoint: `POST /api/webhooks/twilio`
7. Early termination handling: reason included in WhatsApp message with neutral framing

**Implementation notes:**
- Twilio requires pre-approved message templates for WhatsApp Business. For MVP: use the Twilio Sandbox (no template approval needed) — production migration later
- WhatsApp message is generated by LLM, then sent as a freeform sandbox message
- Delivery webhook updates `notification_log.status` (sent → delivered)

**Success criteria:**
- [ ] Complete a full session → summary screen shows with all 3 components
- [ ] Reflection questions are open-ended and thought-provoking
- [ ] Real-world application connects to student's interests
- [ ] Parent receives WhatsApp message within 30s of session end
- [ ] Message is under 100 words, warm, positive, no jargon
- [ ] Early termination → reason in WhatsApp message, neutrally framed
- [ ] `notification_log` entry created with `status: sent` or `delivered`

**NOT built:** Parent dashboard UI, background summarization, admin dashboard.

---

## Phase 7: Parent Dashboard + Admin Dashboard (3 hours)

**Objective:** Parents see their child's activity; admins manage users and see system analytics.

**What gets built:**
1. Parent dashboard: child's activity today, weekly streak, subject progress, notification log, upcoming topics
2. Parent dashboard API: `GET /api/parent/child-activity`, `GET /api/parent/notifications`
3. Admin dashboard: user management CRUD, role assignment, system health, token usage tracking
4. Admin UI: use a component library (shadcn/ui) — no custom design
5. Token usage tracking: log input/output tokens per API call → aggregate per day/student
6. Basic billing analytics: cost per session, cost per student, daily totals

**Implementation notes:**
- Parent dashboard is read-only — no actions except toggling WhatsApp notifications
- Admin dashboard uses dataTables or similar for user lists
- Token usage: middleware in FastAPI that logs OpenAI response metadata (usage field)
- Token cost calculation: hardcoded price-per-token constants, updated manually

**Success criteria:**
- [ ] Parent logs in → sees child's latest session summary
- [ ] Weekly streak count is accurate
- [ ] Notification log shows all WhatsApp messages with delivery status
- [ ] Admin can list all users, filter by role
- [ ] Admin can deactivate a user account
- [ ] Token usage dashboard shows today's total tokens and estimated cost
- [ ] System health endpoint returns OK with DB + Redis connectivity check

**NOT built:** Background summarization, advanced analytics, context evolution.

---

## Phase 8: Background Summarization + Context Update Loop (2.5 hours)

**Objective:** After each session, background processes update student persona and subject context for continuous improvement.

**What gets built:**
1. Background summarization task: triggered post-session, uses GPT-4o-mini
2. `session_summaries` table populated with structured summary JSON
3. Rolling persona update: extract insights from summary → merge into `student_profiles.persona_summary`
4. Rolling subject context update: merge into `student_subject_contexts.rolling_summary`
5. Context evolution logic: append new insights, prune old/redundant ones, keep under 500 tokens
6. Session history view: student can see past session summaries on dashboard

**Implementation notes:**
- Summarization runs as a FastAPI BackgroundTask — fire-and-forget after session end
- Context merging: use a simple LLM call "Merge this new insight into the existing summary, keeping it under 500 tokens"
- Failure handling: if summarization fails, log error but don't block session completion
- Session history: paginated, most recent first

**Success criteria:**
- [ ] Complete a session → `session_summaries` row created within 30s
- [ ] `student_profiles.persona_summary` updated with new insights
- [ ] `student_subject_contexts.rolling_summary` updated with subject-specific notes
- [ ] Rolling summary stays under 500 tokens even after 5+ sessions
- [ ] Second session → system prompt includes updated persona/context (visible in logs)
- [ ] Student dashboard → session history shows past summaries

**NOT built:** Advanced analytics, ML-based learning path optimization, multi-chapter progression.

---

## Phase 9: Integration, Polish, E2E Testing, Deployment (3 hours)

**Objective:** The full system works end-to-end, looks polished, and is deployed to production.

**What gets built:**
1. End-to-end flow testing: signup → onboard → ingest content → session → summary → WhatsApp → parent view
2. Error handling: graceful fallbacks for API failures (LLM timeout, TTS failure, S3 errors)
3. Loading states and error boundaries on all frontend pages
4. Mobile responsiveness for student and parent dashboards
5. Rate limiting on LLM endpoints (prevent abuse)
6. Vercel deployment (frontend) + Railway deployment (backend, Postgres, Redis)
7. Environment variable configuration for production
8. Domain setup and SSL
9. Final polish: animations, transitions, empty states, 404 pages

**Success criteria:**
- [ ] Full user journey works with zero errors: student signup → 3-subtopic session → parent WhatsApp received
- [ ] Session with TTS + image generation → all media loads correctly
- [ ] Backend handles OpenAI timeout gracefully (retry once, then friendly error)
- [ ] Student dashboard renders correctly on mobile (375px viewport)
- [ ] Deployed frontend loads at production URL < 3s
- [ ] Deployed backend health check returns OK
- [ ] Per-session cost within ₹15-20 budget (verify from token logs)

**NOT built:** CI/CD pipeline, automated testing suite, multi-chapter support, production WhatsApp templates (using sandbox), advanced analytics.
