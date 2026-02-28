# 7. Open Questions for You to Decide

These are decisions that require your **product or business input** — I cannot make them purely on technical grounds.

---

### 1. Which NCERT class and subject for MVP?

**Decision needed:** Which specific class (6th? 8th? 10th?) and which subject (Science? Maths? Social Science?) for the MVP?

**Implications:**
- **Class 10 Science** → highest demand (board exam pressure), most complex content, best demo impact
- **Class 7-8 Science** → simpler content, easier to validate AI teaching quality, better for first iteration
- **Maths** → requires LaTeX/MathJax rendering (adds ~2 hours of work), equation-heavy prompts are harder for LLMs

**My recommendation:** Class 8 Science (manageable complexity, still impressive, no LaTeX needed).

---

### 2. Which 1-2 chapters specifically?

**Decision needed:** Which chapters should we fully load into the system?

**Implication:** We need the actual PDF + we need to manually author the chapter roadmap JSON (subtopics, prereqs, key concepts). Choose chapters you have easy access to and that showcase the platform well (ideally one with diagrams).

---

### 3. Mascot character — purchase or custom design?

**Decision needed:** Do we buy a Lottie character pack from LottieFiles marketplace (~$20-50) or commission a custom mascot?

**Implications:**
- **Purchase:** Instant, many options, but won't be unique to Axon. Good for MVP.
- **Custom:** Unique branding, 2-3 day design turnaround, $100-300 for a freelance animator. Delays MVP.

**My recommendation:** Purchase for MVP, commission custom for v2.

---

### 4. Language of instruction — English only or Hindi support?

**Decision needed:** For MVP, is the LLM teaching in English only, or do we need Hindi (or Hinglish)?

**Implications:**
- **English only:** Simpler prompts, better LLM performance, less testing
- **Hindi/Hinglish:** Wider reach (many NCERT students prefer Hindi medium), but GPT-4o's Hindi teaching quality needs validation, TTS in Hindi is available but less natural than English
- **Hinglish (code-mixing):** Actually most natural for Indian students, but tricky to prompt consistently

**My recommendation:** English for MVP with instructions to the LLM to use simple English and occasional Hindi words naturally. Full Hindi support in v2.

---

### 5. Assessment passing threshold — 60% or adjustable?

**Decision needed:** Is 60% the universal pass mark, or should instructors set this per chapter/subtopic?

**Implications:**
- **Fixed 60%:** Simpler implementation, consistent experience
- **Adjustable:** More flexibility, but adds UI to instructor dashboard and complexity to state machine

**My recommendation:** Fixed 60% for MVP, instructor-adjustable in v2.

---

### 6. WhatsApp notification — every session or daily digest?

**Decision needed:** Should parents get a WhatsApp message after EVERY session, or a once-daily summary?

**Implications:**
- **Every session:** More immediate, parents feel connected, but could be spammy if student does 3 sessions/day
- **Daily digest:** Less noise, but loses the real-time feel
- **Hybrid:** Real-time for the first session of the day, digest for subsequent ones

**My recommendation:** Every session for MVP (simpler to implement). Add digest option in parent settings later.

---

### 7. Session time limit — hard 30 min or flexible?

**Decision needed:** Is 30 minutes a hard cap (session auto-ends) or a soft guideline (session can continue)?

**Implications:**
- **Hard cap:** Prevents cost overrun, encourages focused learning, simpler state management
- **Soft guideline:** More flexible, but risks cost blowout and overly long sessions that lose engagement
- **Compromise:** Hard cap with "extend by 10 min" button (max 1 extension)

**My recommendation:** Hard 30-minute cap for MVP. Extension feature in v2.

---

### 8. Student authentication — email/password or phone OTP?

**Decision needed:** How do students sign up and log in?

**Implications:**
- **Email/password:** Standard, simple with NextAuth, but young students may not have email
- **Phone OTP:** More India-friendly (kids have parents' phone), but requires SMS provider (Twilio, ~₹0.15/OTP), and signup flow needs parent phone
- **Google OAuth:** Easiest UX, many school students have Google accounts, but no phone number captured automatically

**My recommendation:** Google OAuth as primary + optional phone number for WhatsApp link. Email/password as fallback.

---

### 9. Data retention policy — how long to keep session conversations?

**Decision needed:** Should we store full conversation logs indefinitely, or prune after N days?

**Implications:**
- **Indefinite:** Better for analytics and persona refinement, but storage grows (each session ≈ 50-100KB of text)
- **Prune after 90 days:** Keep summaries forever, delete raw messages. Saves storage, complies with data minimization
- At MVP scale this is irrelevant, but the schema design should account for it

**My recommendation:** Keep everything for MVP. Add configurable retention in v2.

---

### 10. Pricing model — are you charging per session, per month, or freemium?

**Decision needed:** This affects whether we need a payments integration in MVP and how aggressively we optimize costs.

**Implications:**
- **Free MVP / pilot:** No payments needed. Focus on UX. But need to cap usage manually.
- **Subscription:** Need Razorpay/Stripe integration, plan management in admin dashboard. Adds ~4 hours.
- **Per-session credits:** Most granular, aligns with costs, but complex UX.

**My recommendation:** Free for MVP pilot with a daily session cap (e.g., 3 sessions/day). Add Razorpay subscription later.

---

*These 10 decisions will directly shape the MVP scope and implementation priorities. Please decide on each before development begins.*
