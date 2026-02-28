# 3. Database Schema

> All tables use `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` and `created_at TIMESTAMPTZ DEFAULT now()` unless noted.

---

## Group A: Auth & Users

### `users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen_random_uuid() | Primary key |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| full_name | VARCHAR(255) | NOT NULL | Display name |
| role | VARCHAR(20) | NOT NULL, CHECK (role IN ('student','parent','instructor','admin')) | User role |
| phone | VARCHAR(20) | | Phone (required for parents — WhatsApp) |
| avatar_url | TEXT | | Profile image |
| is_active | BOOLEAN | DEFAULT true | Soft disable |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_users_email` on (email), `idx_users_role` on (role)

### `student_profiles`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK → users(id), UNIQUE | 1:1 with users |
| grade | INTEGER | NOT NULL, CHECK (6-12) | Class/grade |
| interests | JSONB | NOT NULL DEFAULT '[]' | Array of interest tags |
| learning_preferences | JSONB | DEFAULT '{}' | Preferred modalities, pace |
| persona_summary | TEXT | | Rolling summary of student persona |
| onboarding_completed | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### `parent_student_links`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| parent_id | UUID | FK → users(id) | Parent user |
| student_id | UUID | FK → users(id) | Child user |
| whatsapp_number | VARCHAR(20) | NOT NULL | Notification target |
| notifications_enabled | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_psl_parent` on (parent_id), `idx_psl_student` on (student_id)

---

## Group B: Content & RAG

### `subjects`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| name | VARCHAR(100) | NOT NULL | e.g. "Science" |
| grade | INTEGER | NOT NULL | Target grade |
| description | TEXT | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### `chapters`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| subject_id | UUID | FK → subjects(id) | |
| chapter_number | INTEGER | NOT NULL | Ordering |
| title | VARCHAR(255) | NOT NULL | Chapter title |
| roadmap | JSONB | NOT NULL | Lesson plan: subtopics, prereqs, key concepts |
| prerequisites | JSONB | DEFAULT '[]' | List of prerequisite concept IDs |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_chapters_subject` on (subject_id)

### `content_chunks`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| chapter_id | UUID | FK → chapters(id) | |
| subtopic | VARCHAR(255) | | Subtopic label for filtered retrieval |
| chunk_type | VARCHAR(20) | CHECK IN ('text','diagram_caption','solution','question') | |
| content | TEXT | NOT NULL | Raw text content |
| embedding | vector(1536) | NOT NULL | pgvector embedding |
| page_number | INTEGER | | Source PDF page |
| source_file | TEXT | | S3 key of source PDF |
| metadata | JSONB | DEFAULT '{}' | Extra metadata |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_chunks_chapter` on (chapter_id), `idx_chunks_subtopic` on (chapter_id, subtopic), HNSW index on (embedding) using `vector_cosine_ops`

### `content_assets`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| chapter_id | UUID | FK → chapters(id) | |
| asset_type | VARCHAR(20) | CHECK IN ('diagram','image','pdf') | |
| s3_key | TEXT | NOT NULL | S3 object key |
| caption | TEXT | | Alt text / description |
| page_number | INTEGER | | Source page |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### `ingestion_jobs`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| chapter_id | UUID | FK → chapters(id) | |
| uploaded_by | UUID | FK → users(id) | Instructor who triggered |
| status | VARCHAR(20) | CHECK IN ('pending','processing','completed','failed') | |
| source_s3_key | TEXT | NOT NULL | Uploaded PDF location |
| chunks_created | INTEGER | DEFAULT 0 | Count |
| error_message | TEXT | | If failed |
| started_at | TIMESTAMPTZ | | |
| completed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

---

## Group C: Sessions & AI Context

### `student_subject_contexts`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| student_id | UUID | FK → users(id) | |
| subject_id | UUID | FK → subjects(id) | |
| comfort_level | VARCHAR(20) | | self-reported |
| weak_areas | JSONB | DEFAULT '[]' | Identified weak topics |
| preferred_modalities | JSONB | DEFAULT '[]' | visual/audio/text |
| fears_confusions | TEXT | | Free-text from onboarding |
| rolling_summary | TEXT | | Continuously updated by summarizer |
| onboarding_completed | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_ssc_student_subject` UNIQUE on (student_id, subject_id)

### `learning_sessions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| student_id | UUID | FK → users(id) | |
| chapter_id | UUID | FK → chapters(id) | |
| status | VARCHAR(20) | CHECK IN ('active','completed','terminated') | |
| termination_reason | TEXT | | If student ended early |
| started_at | TIMESTAMPTZ | DEFAULT now() | |
| ended_at | TIMESTAMPTZ | | |
| duration_seconds | INTEGER | | Computed on end |
| final_state | VARCHAR(30) | | Last state machine phase |
| subtopics_completed | JSONB | DEFAULT '[]' | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_sessions_student` on (student_id), `idx_sessions_chapter` on (chapter_id), `idx_sessions_status` on (status)

### `session_messages`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| session_id | UUID | FK → learning_sessions(id) | |
| role | VARCHAR(10) | CHECK IN ('system','assistant','user') | |
| content | TEXT | NOT NULL | Message content |
| message_metadata | JSONB | DEFAULT '{}' | Flags: audio_url, image_url, state_change |
| sequence_number | INTEGER | NOT NULL | Ordering |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_messages_session_seq` on (session_id, sequence_number)

### `session_assessments`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| session_id | UUID | FK → learning_sessions(id) | |
| assessment_type | VARCHAR(20) | CHECK IN ('prerequisite','comprehension','subtopic') | |
| subtopic | VARCHAR(255) | | Which subtopic |
| questions | JSONB | NOT NULL | Questions asked |
| responses | JSONB | NOT NULL | Student answers |
| score | DECIMAL(5,2) | | Percentage |
| passed | BOOLEAN | | Met threshold? |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### `session_summaries`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| session_id | UUID | FK → learning_sessions(id), UNIQUE | |
| summary_text | TEXT | NOT NULL | Human-readable summary |
| key_learnings | JSONB | DEFAULT '[]' | Extracted learnings |
| weak_areas_identified | JSONB | DEFAULT '[]' | Gaps found |
| engagement_level | VARCHAR(20) | | high/medium/low |
| notable_moments | JSONB | DEFAULT '[]' | Highlights |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

---

## Group D: Notifications

### `notification_log`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| session_id | UUID | FK → learning_sessions(id) | |
| parent_id | UUID | FK → users(id) | |
| channel | VARCHAR(20) | DEFAULT 'whatsapp' | |
| message_content | TEXT | NOT NULL | Sent message |
| status | VARCHAR(20) | CHECK IN ('pending','sent','delivered','failed') | |
| twilio_sid | VARCHAR(50) | | Twilio message SID |
| sent_at | TIMESTAMPTZ | | |
| delivered_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_notif_parent` on (parent_id), `idx_notif_session` on (session_id)

---

## Entity Relationship Summary

```
users ──1:1──▶ student_profiles
users ──1:N──▶ parent_student_links (as parent)
users ──1:N──▶ parent_student_links (as student)
users ──1:N──▶ student_subject_contexts
users ──1:N──▶ learning_sessions
subjects ──1:N──▶ chapters
chapters ──1:N──▶ content_chunks
chapters ──1:N──▶ content_assets
chapters ──1:N──▶ ingestion_jobs
chapters ──1:N──▶ learning_sessions
learning_sessions ──1:N──▶ session_messages
learning_sessions ──1:N──▶ session_assessments
learning_sessions ──1:1──▶ session_summaries
learning_sessions ──1:1──▶ notification_log
```
