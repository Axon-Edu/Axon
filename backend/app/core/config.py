"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Central configuration for the Axon backend."""

    # App
    APP_NAME: str = "Axon Learning Platform"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres.xxxxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    DATABASE_SYNC_URL: str = "postgresql://postgres.xxxxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "ServiceAccountKey.json"

    # Google Gemini (free tier)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Groq (LLM inference)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Anthropic Claude (AI Engine)
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_TUTOR_MODEL: str = "claude-sonnet-4-6"  # main tutor
    ANTHROPIC_HELPER_MODEL: str = "claude-haiku-4-5-20251001"  # evaluator, analogy, companion

    # Tavily (web search for remediation)
    TAVILY_API_KEY: str = ""

    # File Storage
    UPLOAD_DIR: str = "uploads"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Session
    SESSION_TTL_SECONDS: int = 7200  # 2 hours
    SESSION_SOFT_LIMIT_MINUTES: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
