"""API route definitions — organized by domain."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.auth import verify_firebase_token
from app.models.models import User, StudentProfile, Subject, Chapter

router = APIRouter()


# ──────────────────────────────────────────────
# Auth & User Management
# ──────────────────────────────────────────────

@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user after Firebase authentication.
    Creates a user record linked to Firebase UID.
    Expects role and full_name in the request body (set as custom claims or passed).
    """
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.firebase_uid == token["uid"])
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"user_id": str(existing.id), "role": existing.role, "message": "User already exists"}

    user = User(
        firebase_uid=token["uid"],
        email=token.get("email", ""),
        full_name=token.get("name", "Unknown"),
        role=token.get("role", "student"),
    )
    db.add(user)
    await db.flush()

    # If student, create empty profile
    if user.role == "student":
        profile = StudentProfile(
            user_id=user.id,
            grade=10,  # Default for MVP (Class 10)
            interests=[],
        )
        db.add(profile)

    return {"user_id": str(user.id), "role": user.role}


@router.get("/auth/me")
@router.get("/student/profile")
async def get_current_user(
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Get the current authenticated user's profile."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile))
        .where(User.firebase_uid == token["uid"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please register first.")

    response = {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
    }

    # Include student profile if applicable
    if user.role == "student" and user.student_profile:
        response["student_profile"] = {
            "grade": user.student_profile.grade,
            "interests": user.student_profile.interests,
            "onboarding_completed": user.student_profile.onboarding_completed,
        }

    return response


# ──────────────────────────────────────────────
# Content (subjects & chapters)
# ──────────────────────────────────────────────

@router.get("/subjects")
async def list_subjects(
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """List all available subjects."""
    result = await db.execute(select(Subject))
    subjects = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "grade": s.grade,
            "description": s.description,
        }
        for s in subjects
    ]


@router.get("/subjects/{subject_id}/chapters")
async def list_chapters(
    subject_id: str,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """List chapters for a subject."""
    result = await db.execute(
        select(Chapter).where(Chapter.subject_id == subject_id).order_by(Chapter.chapter_number)
    )
    chapters = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "chapter_number": c.chapter_number,
            "title": c.title,
            "roadmap": c.roadmap,
        }
        for c in chapters
    ]


# ──────────────────────────────────────────────
# Health (extended)
# ──────────────────────────────────────────────

@router.get("/health/db")
async def db_health(db: AsyncSession = Depends(get_db)):
    """Check database connectivity."""
    try:
        await db.execute(select(1))
        return {"database": "ok"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")


@router.get("/health/redis")
async def redis_health():
    """Check Redis connectivity."""
    from app.core.redis import redis_client
    try:
        pong = await redis_client.ping()
        return {"redis": "ok" if pong else "error"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Redis error: {str(e)}")


@router.post("/student/onboarding")
async def student_onboarding(
    payload: dict,
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    """Save student onboarding data."""
    # Resolve user
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile))
        .where(User.firebase_uid == token["uid"])
    )
    user = result.scalar_one_or_none()
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    if not user.student_profile:
        # Create profile if not exists
        from app.models.models import StudentProfile
        user.student_profile = StudentProfile(user_id=user.id)
        db.add(user.student_profile)

    # Update fields
    user.student_profile.grade = int(payload.get("grade", user.student_profile.grade))
    user.student_profile.interests = payload.get("interests", user.student_profile.interests)
    user.student_profile.learning_style_signals = {
        "board": payload.get("board"),
        "hobbies": payload.get("hobbies"),
    }
    user.student_profile.onboarding_completed = True

    await db.commit()
    return {"status": "success"}


@router.post("/auth/register")
async def register_user(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user (Postgres record) after Firebase signup."""
    # Check if user already exists
    result = await db.execute(select(User).where(User.firebase_uid == payload.get("firebase_uid")))
    user = result.scalar_one_or_none()
    
    if user:
        return {"status": "exists", "id": str(user.id)}
    
    # Create new user
    new_user = User(
        firebase_uid=payload.get("firebase_uid"),
        email=payload.get("email"),
        full_name=payload.get("full_name"),
        role=payload.get("role", "student"),
    )
    db.add(new_user)
    await db.flush()
    
    if new_user.role == "student":
        from app.models.models import StudentProfile
        profile = StudentProfile(user_id=new_user.id)
        db.add(profile)
    
    await db.commit()
    return {"status": "created", "id": str(new_user.id)}
