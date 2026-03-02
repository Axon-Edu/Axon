"""
Seed script — populates the database with initial data for development.
Uses SYNC connection to avoid asyncpg pooler issues.
Run: python seed.py
"""

import uuid
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.database import Base
from app.models.models import (
    User, StudentProfile, Subject, Chapter
)

load_dotenv()

SYNC_URL = os.getenv("DATABASE_SYNC_URL")

SCIENCE_SUBJECT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
CARBON_CHAPTER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
ELECTRICITY_CHAPTER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")


def seed():
    """Create initial seed data using sync engine."""
    engine = create_engine(SYNC_URL, echo=True)

    with engine.connect() as conn:
        # Enable pgvector extension
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    # Create all tables
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Check if already seeded
        existing = session.query(User).filter_by(email="student@axon.dev").first()
        if existing:
            print("⚠️  Seed data already exists. Skipping.")
            engine.dispose()
            return

        # ── Users (one per role) ──
        student = User(
            firebase_uid="seed_student_001",
            email="student@axon.dev",
            full_name="Arjun Sharma",
            role="student",
        )
        parent = User(
            firebase_uid="seed_parent_001",
            email="parent@axon.dev",
            full_name="Priya Sharma",
            role="parent",
            phone="+919876543210",
        )
        instructor = User(
            firebase_uid="seed_instructor_001",
            email="instructor@axon.dev",
            full_name="Dr. Meera Patel",
            role="instructor",
        )
        admin = User(
            firebase_uid="seed_admin_001",
            email="admin@axon.dev",
            full_name="Admin User",
            role="admin",
        )
        session.add_all([student, parent, instructor, admin])
        session.flush()

        # ── Student Profile ──
        profile = StudentProfile(
            user_id=student.id,
            grade=10,
            interests=["cricket", "gaming", "music"],
            learning_preferences={"pace": "moderate", "style": "visual"},
        )
        session.add(profile)

        # ── Subject ──
        science = Subject(
            id=SCIENCE_SUBJECT_ID,
            name="Science",
            grade=10,
            description="NCERT Class 10 Science — Physics, Chemistry, Biology",
        )
        session.add(science)

        # ── Chapters ──
        carbon = Chapter(
            id=CARBON_CHAPTER_ID,
            subject_id=SCIENCE_SUBJECT_ID,
            chapter_number=4,
            title="Carbon and its Compounds",
            roadmap={
                "subtopics": [
                    {"name": "Bonding in Carbon", "key_concepts": ["covalent bond", "electron sharing", "tetravalency"], "estimated_minutes": 8},
                    {"name": "Versatile Nature of Carbon", "key_concepts": ["chains", "branches", "rings", "single/double/triple bonds"], "estimated_minutes": 8},
                    {"name": "Homologous Series", "key_concepts": ["general formula", "alkanes", "alkenes", "alkynes"], "estimated_minutes": 7},
                    {"name": "Chemical Properties of Carbon Compounds", "key_concepts": ["combustion", "oxidation", "substitution", "addition"], "estimated_minutes": 7},
                ],
                "prerequisites": ["atomic structure", "chemical bonds basics"],
            },
            prerequisites=["atomic structure", "chemical bonds basics"],
        )

        electricity = Chapter(
            id=ELECTRICITY_CHAPTER_ID,
            subject_id=SCIENCE_SUBJECT_ID,
            chapter_number=12,
            title="Electricity",
            roadmap={
                "subtopics": [
                    {"name": "Electric Current and Circuit", "key_concepts": ["current", "voltage", "circuit", "conductors", "insulators"], "estimated_minutes": 8},
                    {"name": "Ohm's Law", "key_concepts": ["V=IR", "resistance", "ohm", "V-I graph"], "estimated_minutes": 8},
                    {"name": "Resistance and Resistivity", "key_concepts": ["factors affecting resistance", "resistivity", "series", "parallel"], "estimated_minutes": 7},
                    {"name": "Heating Effect of Current", "key_concepts": ["Joule's law", "electric power", "P=VI", "kWh"], "estimated_minutes": 7},
                ],
                "prerequisites": ["basic math", "units and measurements"],
            },
            prerequisites=["basic math", "units and measurements"],
        )
        session.add_all([carbon, electricity])

        session.commit()
        print("✅ Seed data created successfully!")
        print(f"   Student: {student.email} (ID: {student.id})")
        print(f"   Parent: {parent.email}")
        print(f"   Instructor: {instructor.email}")
        print(f"   Admin: {admin.email}")
        print(f"   Subject: {science.name} (Grade {science.grade})")
        print(f"   Chapters: {carbon.title}, {electricity.title}")

    engine.dispose()


if __name__ == "__main__":
    seed()
