"""Content Ingestion Pipeline — parses roadmap PDFs, chapter PDFs, and question banks.

Usage:
    python -m ai_engine.ingest \
        --chapter-id <uuid> \
        --roadmap-pdf path/to/roadmap.pdf \
        --chapter-pdf path/to/chapter.pdf \
        --question-bank path/to/questions.json

Each flag is optional — run any subset of the 3 tasks.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv

# Load environment before any app imports
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Add backend to path for app imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anthropic import Anthropic
from supabase import create_client, Client as SupabaseClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.models import Chapter, ContentChunk
from ai_engine.schemas import RoadmapJSON, QuestionBankItem


# ──────────────────────────────────────────────
# Clients (lazy init)
# ──────────────────────────────────────────────

_anthropic: Anthropic | None = None
_supabase: SupabaseClient | None = None
_db_engine = None


def get_anthropic() -> Anthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _anthropic


def get_supabase() -> SupabaseClient:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_ANON_KEY"],
        )
    return _supabase


def get_db_session() -> Session:
    global _db_engine
    if _db_engine is None:
        _db_engine = create_engine(os.environ["DATABASE_SYNC_URL"])
    return Session(_db_engine)


def call_haiku(system_prompt: str, user_prompt: str) -> str:
    """Call Claude Haiku and return the text response."""
    model = os.environ.get("ANTHROPIC_HELPER_MODEL", "claude-haiku-4-5-20251001")
    resp = get_anthropic().messages.create(
        model=model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return resp.content[0].text


# ──────────────────────────────────────────────
# Task A: Roadmap PDF Parser
# ──────────────────────────────────────────────

ROADMAP_SYSTEM_PROMPT = """You are a structured data extractor. You will receive raw text extracted from an educational roadmap PDF for CBSE Class 10 Science. 
Parse it into the following JSON schema EXACTLY. Output ONLY valid JSON, no markdown fences, no explanations.

Schema:
{
  "chapter_name": "<string>",
  "prerequisites": [
    {
      "topic": "<string>",
      "check_questions": [{"question": "<string>", "model_answer": "<string>"}],
      "remediation_content": "<string>"
    }
  ],
  "teaching_nodes": [
    {
      "node_id": "<string like 'node_1', 'node_2', ...>",
      "topic": "<string>",
      "core_concept": "<string>",
      "teaching_hint": "<string>",
      "check_question": "<string>",
      "expected_understanding_signals": ["<string>"],
      "common_misconceptions": ["<string>"]
    }
  ]
}

Rules:
- Generate sequential node_ids (node_1, node_2, etc.)
- If a section is missing, use empty arrays/strings
- Keep all text concise but preserve pedagogical intent
- Every teaching node MUST have at least a topic and core_concept"""


def parse_roadmap_pdf(pdf_path: str) -> RoadmapJSON:
    """Extract text from a roadmap PDF and parse into structured RoadmapJSON."""
    print(f"  📄 Extracting text from: {pdf_path}")
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    doc.close()

    if not full_text.strip():
        raise ValueError(f"No text extracted from {pdf_path}")

    print(f"  🤖 Sending {len(full_text)} chars to Haiku for parsing...")
    raw_json = call_haiku(ROADMAP_SYSTEM_PROMPT, full_text)

    # Clean up potential markdown fences
    raw_json = raw_json.strip()
    if raw_json.startswith("```"):
        raw_json = raw_json.split("\n", 1)[1]
    if raw_json.endswith("```"):
        raw_json = raw_json.rsplit("```", 1)[0]
    raw_json = raw_json.strip()

    # Parse and validate
    try:
        data = json.loads(raw_json)
        roadmap = RoadmapJSON(**data)
    except (json.JSONDecodeError, Exception) as e:
        print(f"  ⚠️  First parse failed ({e}), retrying...")
        raw_json = call_haiku(
            ROADMAP_SYSTEM_PROMPT + "\n\nIMPORTANT: Your previous response was not valid JSON. Please output ONLY pure JSON.",
            full_text,
        )
        raw_json = raw_json.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(raw_json)
        roadmap = RoadmapJSON(**data)

    print(f"  ✅ Parsed roadmap: {roadmap.chapter_name}")
    print(f"     Prerequisites: {len(roadmap.prerequisites)}")
    print(f"     Teaching nodes: {len(roadmap.teaching_nodes)}")
    return roadmap


def ingest_roadmap(session: Session, chapter_id: str, pdf_path: str) -> None:
    """Task A: Parse roadmap PDF and write to chapter."""
    print("\n─── Task A: Roadmap PDF Parser ───")
    roadmap = parse_roadmap_pdf(pdf_path)

    chapter = session.query(Chapter).filter(Chapter.id == chapter_id).one()
    chapter.roadmap = roadmap.model_dump()
    session.commit()
    print(f"  💾 Roadmap saved to chapter '{chapter.title}'")


# ──────────────────────────────────────────────
# Task B: Chapter PDF Chunker
# ──────────────────────────────────────────────

def detect_headings(page_blocks: list[dict]) -> list[dict]:
    """Detect heading blocks by comparing font sizes to the median."""
    font_sizes = []
    for block in page_blocks:
        if block.get("type") == 0:  # text block
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    font_sizes.append(span.get("size", 12))

    if not font_sizes:
        return page_blocks

    # Sort to find median
    sorted_sizes = sorted(font_sizes)
    median_size = sorted_sizes[len(sorted_sizes) // 2]
    heading_threshold = median_size * 1.3

    # Tag blocks
    for block in page_blocks:
        block["_is_heading"] = False
        if block.get("type") == 0:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span.get("size", 12) >= heading_threshold:
                        block["_is_heading"] = True
                        break
    return page_blocks


def extract_text_from_block(block: dict) -> str:
    """Get plain text from a PyMuPDF text block."""
    parts = []
    if block.get("type") == 0:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                parts.append(span.get("text", ""))
    return " ".join(parts).strip()


def chunk_chapter_pdf(pdf_path: str, chapter_id: str) -> list[dict]:
    """Extract semantic chunks from a chapter PDF using heading detection."""
    print(f"  📄 Extracting structured content from: {pdf_path}")
    doc = fitz.open(pdf_path)

    chunks = []
    current_heading = "Introduction"
    current_text_parts = []
    current_start_page = 0

    for page_num in range(len(doc)):
        try:
            page = doc[page_num]
            page_dict = page.get_text("dict")
            blocks = detect_headings(page_dict.get("blocks", []))

            for block in blocks:
                if block.get("type") != 0:
                    continue

                text = extract_text_from_block(block)
                if not text:
                    continue

                if block.get("_is_heading"):
                    # Save previous chunk
                    if current_text_parts:
                        full_text = "\n".join(current_text_parts)
                        if full_text.strip():
                            chunks.append({
                                "subtopic": current_heading,
                                "content": full_text.strip(),
                                "chunk_type": "text",
                                "page_number": current_start_page + 1,
                                "metadata": {
                                    "topic_hint": current_heading,
                                    "page_range": [current_start_page + 1, page_num + 1],
                                },
                            })
                    # Start new chunk
                    current_heading = text
                    current_text_parts = []
                    current_start_page = page_num
                else:
                    current_text_parts.append(text)
        except Exception as e:
            print(f"  ⚠️  Skipping page {page_num + 1}: {e}")
            continue

    # Final chunk
    if current_text_parts:
        full_text = "\n".join(current_text_parts)
        if full_text.strip():
            chunks.append({
                "subtopic": current_heading,
                "content": full_text.strip(),
                "chunk_type": "text",
                "page_number": current_start_page + 1,
                "metadata": {
                    "topic_hint": current_heading,
                    "page_range": [current_start_page + 1, len(doc)],
                },
            })

    doc.close()
    print(f"  ✅ Created {len(chunks)} text chunks")
    return chunks


def extract_and_upload_images(pdf_path: str, chapter_id: str) -> list[dict]:
    """Extract images from a PDF and upload to Supabase Storage."""
    print(f"  🖼️  Extracting images...")
    doc = fitz.open(pdf_path)
    image_chunks = []
    bucket_name = "chapter-images"

    sb = get_supabase()

    # Ensure bucket exists (ignore error if already exists)
    try:
        sb.storage.create_bucket(bucket_name, options={"public": True})
    except Exception:
        pass  # bucket already exists

    image_count = 0
    for page_num in range(len(doc)):
        try:
            page = doc[page_num]
            images = page.get_images(full=True)

            for img_idx, img_info in enumerate(images):
                try:
                    xref = img_info[0]
                    pix = fitz.Pixmap(doc, xref)

                    # Convert CMYK to RGB if needed
                    if pix.n > 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)

                    # Generate image filename
                    image_filename = f"{chapter_id}/page{page_num + 1}_img{img_idx + 1}.png"
                    image_bytes = pix.tobytes("png")
                    pix = None  # free memory

                    # Upload to Supabase Storage
                    sb.storage.from_(bucket_name).upload(
                        path=image_filename,
                        file=image_bytes,
                        file_options={"content-type": "image/png", "upsert": "true"},
                    )

                    # Get public URL
                    public_url = sb.storage.from_(bucket_name).get_public_url(image_filename)

                    image_count += 1
                    image_chunks.append({
                        "subtopic": f"Image from page {page_num + 1}",
                        "content": f"[Image: {image_filename}]({public_url})",
                        "chunk_type": "diagram_caption",
                        "page_number": page_num + 1,
                        "metadata": {
                            "topic_hint": f"diagram_page_{page_num + 1}",
                            "image_url": public_url,
                            "image_path": image_filename,
                        },
                    })
                except Exception as e:
                    print(f"  ⚠️  Skipping image {img_idx} on page {page_num + 1}: {e}")
                    continue
        except Exception as e:
            print(f"  ⚠️  Skipping page {page_num + 1} for images: {e}")
            continue

    doc.close()
    print(f"  ✅ Extracted and uploaded {image_count} images to Supabase Storage")
    return image_chunks


def ingest_chapter_pdf(session: Session, chapter_id: str, pdf_path: str) -> None:
    """Task B: Chunk chapter PDF and extract images, write to content_chunks."""
    print("\n─── Task B: Chapter PDF Chunker ───")

    # Get text chunks
    text_chunks = chunk_chapter_pdf(pdf_path, chapter_id)

    # Get image chunks (uploaded to Supabase Storage)
    image_chunks = extract_and_upload_images(pdf_path, chapter_id)

    all_chunks = text_chunks + image_chunks

    # Write to DB
    chapter = session.query(Chapter).filter(Chapter.id == chapter_id).one()

    # Clear existing chunks for this chapter (re-ingestion)
    session.query(ContentChunk).filter(ContentChunk.chapter_id == chapter_id).delete()

    for chunk_data in all_chunks:
        chunk = ContentChunk(
            id=uuid.uuid4(),
            chapter_id=chapter_id,
            subtopic=chunk_data["subtopic"],
            chunk_type=chunk_data["chunk_type"],
            content=chunk_data["content"],
            page_number=chunk_data.get("page_number"),
            source_file=pdf_path,
            metadata_=chunk_data.get("metadata", {}),
        )
        session.add(chunk)

    session.commit()
    print(f"  💾 Saved {len(all_chunks)} chunks to content_chunks for '{chapter.title}'")


# ──────────────────────────────────────────────
# Task C: Question Bank Loader
# ──────────────────────────────────────────────

QUESTION_BANK_SYSTEM_PROMPT = """You are a structured data extractor. You will receive raw text from an educational question bank for CBSE Class 10 Science.
Parse it into a JSON array. Output ONLY valid JSON, no markdown fences, no explanations.

Each item in the array must follow this schema:
{
  "question": "<the question text>",
  "type": "<one of: mcq, short_answer, long_answer, true_false, fill_in_blank>",
  "difficulty": "<one of: easy, medium, hard>",
  "topic_tag": "<topic/subtopic this question belongs to>",
  "model_answer": "<the correct answer or model answer>"
}

Rules:
- Infer the question type from context (MCQs have options, etc.)
- If difficulty is not stated, estimate based on cognitive complexity
- topic_tag should be a concise subtopic label
- model_answer should be complete but concise"""


def load_question_bank(file_path: str) -> list[dict]:
    """Parse a question bank from JSON or PDF."""
    ext = Path(file_path).suffix.lower()

    if ext == ".json":
        print(f"  📄 Loading JSON question bank: {file_path}")
        with open(file_path, "r") as f:
            raw_data = json.load(f)
        # Validate each item
        questions = []
        for item in raw_data:
            q = QuestionBankItem(**item)
            questions.append(q.model_dump())
        print(f"  ✅ Loaded {len(questions)} questions from JSON")
        return questions

    elif ext in (".pdf", ".txt"):
        print(f"  📄 Extracting text from: {file_path}")
        if ext == ".pdf":
            doc = fitz.open(file_path)
            full_text = ""
            for page in doc:
                full_text += page.get_text() + "\n"
            doc.close()
        else:
            with open(file_path, "r") as f:
                full_text = f.read()

        if not full_text.strip():
            raise ValueError(f"No text extracted from {file_path}")

        print(f"  🤖 Sending {len(full_text)} chars to Haiku for parsing...")
        raw_json = call_haiku(QUESTION_BANK_SYSTEM_PROMPT, full_text)

        # Clean up
        raw_json = raw_json.strip()
        if raw_json.startswith("```"):
            raw_json = raw_json.split("\n", 1)[1]
        if raw_json.endswith("```"):
            raw_json = raw_json.rsplit("```", 1)[0]
        raw_json = raw_json.strip()

        try:
            raw_data = json.loads(raw_json)
        except json.JSONDecodeError as e:
            print(f"  ⚠️  First parse failed ({e}), retrying...")
            raw_json = call_haiku(
                QUESTION_BANK_SYSTEM_PROMPT + "\n\nIMPORTANT: Output ONLY pure JSON array.",
                full_text,
            )
            raw_json = raw_json.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            raw_data = json.loads(raw_json)

        questions = []
        for item in raw_data:
            q = QuestionBankItem(**item)
            questions.append(q.model_dump())
        print(f"  ✅ Parsed {len(questions)} questions from {ext} file")
        return questions

    else:
        raise ValueError(f"Unsupported file format: {ext}. Use .json, .pdf, or .txt")


def ingest_question_bank(session: Session, chapter_id: str, file_path: str) -> None:
    """Task C: Load question bank and write to chapter."""
    print("\n─── Task C: Question Bank Loader ───")
    questions = load_question_bank(file_path)

    chapter = session.query(Chapter).filter(Chapter.id == chapter_id).one()
    chapter.question_bank = questions
    session.commit()
    print(f"  💾 Saved {len(questions)} questions to '{chapter.title}'")


# ──────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Axon AI Engine — Content Ingestion Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full ingestion
  python -m ai_engine.ingest --chapter-id <uuid> \\
    --roadmap-pdf roadmap.pdf --chapter-pdf chapter.pdf --question-bank questions.json

  # Individual tasks
  python -m ai_engine.ingest --chapter-id <uuid> --roadmap-pdf roadmap.pdf
  python -m ai_engine.ingest --chapter-id <uuid> --chapter-pdf chapter.pdf
  python -m ai_engine.ingest --chapter-id <uuid> --question-bank questions.json
        """,
    )
    parser.add_argument("--chapter-id", required=True, help="UUID of the chapter to ingest into")
    parser.add_argument("--roadmap-pdf", help="Path to roadmap PDF file")
    parser.add_argument("--chapter-pdf", help="Path to chapter PDF file")
    parser.add_argument("--question-bank", help="Path to question bank file (JSON, PDF, or TXT)")

    args = parser.parse_args()

    if not any([args.roadmap_pdf, args.chapter_pdf, args.question_bank]):
        parser.error("At least one of --roadmap-pdf, --chapter-pdf, or --question-bank is required")

    # Validate file paths
    for path_arg, label in [
        (args.roadmap_pdf, "Roadmap PDF"),
        (args.chapter_pdf, "Chapter PDF"),
        (args.question_bank, "Question bank"),
    ]:
        if path_arg and not os.path.exists(path_arg):
            parser.error(f"{label} not found: {path_arg}")

    # Validate chapter exists
    session = get_db_session()
    try:
        chapter = session.query(Chapter).filter(Chapter.id == args.chapter_id).first()
        if not chapter:
            print(f"❌ Chapter not found: {args.chapter_id}")
            sys.exit(1)
        print(f"📚 Ingesting into chapter: {chapter.title} (#{chapter.chapter_number})")

        # Run tasks
        tasks_run = 0

        if args.roadmap_pdf:
            ingest_roadmap(session, args.chapter_id, args.roadmap_pdf)
            tasks_run += 1

        if args.chapter_pdf:
            ingest_chapter_pdf(session, args.chapter_id, args.chapter_pdf)
            tasks_run += 1

        if args.question_bank:
            ingest_question_bank(session, args.chapter_id, args.question_bank)
            tasks_run += 1

        print(f"\n{'═' * 50}")
        print(f"✅ Ingestion complete! {tasks_run} task(s) executed.")
        print(f"{'═' * 50}")

    except Exception as e:
        session.rollback()
        print(f"\n❌ Ingestion failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
