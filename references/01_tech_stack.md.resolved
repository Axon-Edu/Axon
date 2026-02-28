# 1. Tech Stack Recommendation

## Summary Table

| Layer | Choice | Alternative Considered |
|-------|--------|----------------------|
| Frontend | **Next.js 14 (App Router)** | Vite + React |
| Backend | **FastAPI (Python)** | Node.js / Express |
| Primary LLM | **GPT-4o (OpenAI)** | Gemini 1.5 Pro |
| Secondary LLM | **GPT-4o-mini** | Gemini 1.5 Flash |
| Embedding Model | **text-embedding-3-small (OpenAI)** | Cohere embed-v3 |
| Vector Database | **pgvector (PostgreSQL extension)** | Pinecone |
| Relational DB | **PostgreSQL 16** | MySQL |
| Session State | **Redis** | In-memory + DB |
| TTS | **ElevenLabs** | OpenAI TTS |
| Image Generation | **DALL·E 3 (via OpenAI API)** | Stable Diffusion XL |
| WhatsApp | **Twilio WhatsApp API** | WhatsApp Business Cloud API |
| Mascot Rendering | **Lottie (lottie-react)** | Rive |
| File Storage | **AWS S3 (or MinIO for dev)** | Cloudinary |
| Auth | **NextAuth.js v5** | Clerk |
| Hosting | **Vercel (frontend) + Railway (backend + Postgres + Redis)** | AWS EC2 |

---

## Detailed Justifications

### Frontend — Next.js 14 (App Router)
**Why:** SSR for SEO on marketing pages, file-based routing, React Server Components reduce bundle size, built-in API routes for lightweight proxying, excellent Vercel deployment story. The App Router's streaming support pairs perfectly with our SSE-based LLM streaming requirement.
**Why not Vite + React:** Vite is faster for pure SPAs but we lose SSR, built-in streaming, and the deployment convenience. For a 3-day MVP, Next.js's conventions save time.

### Backend — FastAPI (Python)
**Why:** Python-native AI ecosystem (LangChain, OpenAI SDK, sentence-transformers), async-first, automatic OpenAPI docs, Pydantic models for request/response validation, WebSocket/SSE support out of the box. The entire AI orchestration layer (RAG, prompt assembly, session state machine) is dramatically simpler in Python.
**Why not Node.js:** AI libraries in Node are wrappers around Python originals. Prompt engineering, embedding pipelines, and chunking strategies all have first-class Python support. The cost of maintaining two languages isn't worth it when the backend is fundamentally an AI orchestration service.

### Primary LLM — GPT-4o
**Why:** Best-in-class instruction following, strong persona adherence over long conversations, native structured JSON output mode, excellent at maintaining teaching tone. 128K context window handles long sessions. The `response_format: { type: "json_object" }` capability is critical for our session state machine signals.
**Why not Gemini 1.5 Pro:** Comparable quality and longer context, but weaker structured output guarantees and less mature function-calling. OpenAI's JSON mode is more reliable for state machine transitions. Cost is similar.

### Secondary LLM — GPT-4o-mini
**Why:** 15× cheaper than GPT-4o, fast (typically <2s for summary-length responses), same API interface (zero code changes to swap). Ideal for background summarization and WhatsApp message generation where top-tier teaching quality isn't needed.
**Why not Gemini Flash:** Would require a second SDK and auth flow. Keeping both models on OpenAI simplifies the codebase.

### Embedding Model — text-embedding-3-small
**Why:** 1536 dimensions, excellent retrieval quality for education content, very cheap ($0.02/1M tokens), same OpenAI API key. Dimensions can be reduced to 512 for cost savings with minimal quality loss.
**Why not Cohere embed-v3:** Marginally better on some benchmarks but adds another vendor and API key. Not worth the complexity for MVP.

### Vector Database — pgvector (PostgreSQL extension)
**Why:** Runs inside the same PostgreSQL instance we already need for relational data. Zero additional infrastructure. HNSW index support for fast ANN search. For MVP scale (1 subject, 1-2 chapters ≈ a few hundred chunks), pgvector is more than sufficient. Eliminates the operational burden of a separate vector DB.
**Why not Pinecone:** Overkill for MVP. Adds a service dependency, a separate billing account, and network latency for retrieval. When we scale past ~1M vectors, we revisit.

### Relational DB — PostgreSQL 16
**Why:** Industry standard, JSONB for flexible schema where needed (persona, context blobs), pgvector extension, excellent tooling, free tier on Railway. Handles both structured data and vector search in one place.

### Session State — Redis
**Why:** The teaching session has real-time state (current subtopic, session phase, conversation buffer) that must survive page refreshes but doesn't need permanent storage. Redis gives sub-ms reads, TTL-based expiry, and pub/sub if we need real-time features later. Railway offers a managed Redis add-on.
**Why not in-memory only:** Server restart loses all active sessions. Unacceptable even for MVP.

### TTS — ElevenLabs
**Why:** Most natural-sounding voices available, excellent for educational narration. Streaming API (chunks arrive in ~200ms), Hindi and Indian-English voices available. The "turbo v2.5" model optimizes for low latency.
**Why not OpenAI TTS:** Good quality but fewer voice options, no Indian-English accent options, and slightly higher latency. ElevenLabs is the clear leader in voice naturalness.

### Image Generation — DALL·E 3 (via OpenAI)
**Why:** Same API key, high-quality output, good at educational diagrams when prompted well. For MVP, we use it sparingly (only when LLM flags a visual would help). Most images will be pre-uploaded NCERT diagrams served from S3.
**Why not Stable Diffusion:** Requires self-hosting a GPU instance or using a separate API (Replicate). Adds infrastructure complexity. DALL·E 3 via API is the simplest path for MVP.

### WhatsApp — Twilio WhatsApp API
**Why:** Well-documented, reliable delivery, easy template message approval, Python SDK. Webhook support for delivery receipts. Predictable pricing (~₹0.50/message).
**Why not WhatsApp Business Cloud API (Meta):** More complex setup, requires Facebook Business verification, webhook configuration is more involved. Twilio abstracts this away.

### Mascot — Lottie Animations (lottie-react)
**Why:** Lottie files are lightweight JSON, render at 60fps, support interactive triggers (play on scroll, on click, on state change). Massive library of free/purchasable animations on LottieFiles marketplace. A designer can create custom mascot animations in After Effects → Bodymovin → Lottie. For MVP, we purchase a character animation pack.
**Why not Rive:** More powerful (state machines, interactive bones) but steeper learning curve and fewer pre-made assets. Lottie wins on speed-to-implement.

### File Storage — AWS S3
**Why:** Industry standard, cheap, CDN-ready via CloudFront, presigned URLs for secure access. Store NCERT PDFs, processed chunks, NCERT diagrams, generated images, TTS audio files.
**Why not Cloudinary:** Optimized for image transformation, not general file storage. We need to store PDFs, audio, and JSON — S3 is more appropriate.

### Auth — NextAuth.js v5
**Why:** First-party Next.js integration, supports email/password + OAuth, JWT sessions, role-based access via middleware, database adapter for PostgreSQL. Free, open-source.
**Why not Clerk:** Excellent DX but adds a paid dependency and external service. For 4 roles with simple RBAC, NextAuth is sufficient and self-hosted.

### Hosting — Vercel + Railway
**Why for MVP:** Vercel gives zero-config Next.js deployment with edge functions and streaming support. Railway gives managed PostgreSQL, Redis, and a simple container deploy for FastAPI. Both have generous free tiers. Total MVP hosting cost: ~$5-10/month.
**Why not AWS EC2:** Full control but massive setup overhead (VPC, security groups, load balancer, SSL, CI/CD). Unacceptable for a 3-day MVP.

---

## Per-Session Cost Estimate

| Component | Usage per 30-min session | Cost |
|-----------|------------------------|------|
| GPT-4o (teaching) | ~15K input + 5K output tokens | ~₹5.00 ($0.06) |
| GPT-4o-mini (summary + WhatsApp) | ~4K input + 1K output tokens | ~₹0.30 ($0.004) |
| Embeddings (retrieval) | ~2K tokens for queries | ~₹0.02 ($0.0002) |
| ElevenLabs TTS | ~2,000 characters | ~₹3.00 ($0.036) |
| DALL·E 3 (0-1 images) | 0.5 images avg | ~₹3.50 ($0.04) |
| Twilio WhatsApp | 1 message | ~₹0.50 ($0.006) |
| **Total** | | **~₹12.30 ($0.15)** |

> [!TIP]
> Well within the ₹15-20 budget. The main cost lever is TTS — if we limit audio to key explanations only (not every paragraph), cost drops to ~₹8-10/session.
