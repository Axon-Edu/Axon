# Axon — AI-Powered Personalized Learning Platform

> Personalized NCERT learning powered by AI. Class 10 Science.

## Project Structure

```
Axon/
├── frontend/          # Next.js 14 (App Router)
│   ├── src/
│   │   ├── app/       # Pages (login, student, parent, instructor, admin)
│   │   ├── lib/       # Firebase config, AuthContext
│   │   └── components/# Shared components (ProtectedRoute)
│   └── .env.example
│
├── backend/           # FastAPI (Python)
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── core/      # Config, DB, Redis, Auth
│   │   ├── models/    # SQLAlchemy ORM models
│   │   ├── services/  # Business logic (future)
│   │   └── prompts/   # Jinja2 prompt templates (future)
│   ├── alembic/       # Database migrations
│   ├── seed.py        # Initial data seeder
│   ├── main.py        # FastAPI app entry point
│   └── .env.example
│
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- [Supabase](https://supabase.com/) account (free tier — PostgreSQL + pgvector)
- Redis

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com/) → **New Project**
2. Choose a region close to you (e.g. Mumbai `ap-south-1`)
3. Set a database password — **save it**
4. Once created, go to **Settings → Database** → copy the **Connection string (URI)**
   - Use the **Transaction mode** pooler URL (port `6543`)
5. Enable pgvector: go to **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 2. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy env and paste your Supabase connection string
cp .env.example .env
# Edit .env → set DATABASE_URL and DATABASE_SYNC_URL

# Run seed (creates tables + initial data)
python seed.py

# Start server
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Copy env and add Firebase credentials
cp .env.example .env.local

# Start dev server
npm run dev
```

### 4. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication** → Email/Password + Google provider
4. Go to **Project Settings** → **General** → **Your apps** → Add Web App
5. Copy the Firebase config values into `frontend/.env.local`
6. Go to **Project Settings** → **Service Accounts** → Generate new private key
7. Save the JSON file as `backend/firebase-credentials.json`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Firebase Auth |
| Backend | FastAPI, SQLAlchemy, pgvector |
| Database | Supabase (PostgreSQL + pgvector) |
| LLM | Google Gemini 2.0 Flash (free) |
| Embeddings | sentence-transformers (local) |
| TTS | Edge TTS (free) |
| Cache | Redis |
