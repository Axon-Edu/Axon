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

    # Supabase Client (for Storage, etc.)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "ServiceAccountKey.json"

    # Google Gemini (existing free-tier + AI Engine via GCP $300 credits)
    GEMINI_API_KEY: str = ""
    GEMINI_PRO_MODEL: str = "gemini-2.0-flash"  # primary tutor (Sonnet-equivalent)
    GEMINI_FLASH_MODEL: str = "gemini-2.0-flash-lite"  # evaluator, analogy, companion (Haiku-equivalent)

    # Groq (LLM inference)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Serper (web search for remediation)
    SERPER_API_KEY: str = ""

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
