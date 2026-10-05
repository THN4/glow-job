"""Generates SYNTHETIC test CVs (no real person's data).

    python -m tests.fixtures          # writes tests/generated/*

Used by the tests and for manual runs (scripts/extract.py, scripts/try_api.py).
"""

from __future__ import annotations

import io
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).parent / "generated"

SAMPLE_CV_LINES = [
    "# Alex Example",
    "Full-Stack Web Developer | Bangkok, Thailand",
    "alex.example@example.com | github.com/alex-example",
    "",
    "## Education",
    "B.Sc. in Computer Science, Chulalongkorn University, 2020 - 2024",
    "GPA 3.45 / 4.00",
    "",
    "## Experience",
    "Freelance Web Developer, Self-employed, Jun 2023 - Present",
    "- Build and maintain web applications for small businesses (landing pages, e-commerce, internal tools)",
    "- Tech: ReactJS, Next.js, Node.js, Tailwind CSS",
    "Software Engineer Intern, Siam Digital Co., Ltd., Jun 2022 - Aug 2022",
    "- Built REST APIs with Express and PostgreSQL",
    "",
    "## Projects",
    "MODNOI - A social platform for university students to share notes and collaborate on projects.",
    "Tech: Next.js, TypeScript, PostgreSQL, Vercel",
    "",
    "## Skills",
    "Languages: JavaScript, TypeScript, Python",
    "Frameworks: React, Next.js, Express",
    "Databases: Postgres, MongoDB",
    "Tools: Git, Docker, Figma, VS Code",
    "",
    "## Certifications & Activities",
    "AWS Cloud Practitioner Workshop - Mar 2024",
    "CU Innovation Hackathon 2023 - Finalist",
    "Chulalongkorn Programming Contest - Top 10",
    "",
    "## Languages",
    "Thai (Native), English (IELTS 7.0)",
]


def make_text_pdf(lines: list[str] = SAMPLE_CV_LINES) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4
    y = 50.0
    for raw in lines:
        if y > 790:
            page = doc.new_page(width=595, height=842)
            y = 50.0
        h1, h2 = raw.startswith("# "), raw.startswith("## ")
        size = 20 if h1 else 13 if h2 else 10
        page.insert_text((50, y), raw.lstrip("# "), fontsize=size, fontname="hebo" if h1 or h2 else "helv")
        y += 28 if h1 else 22 if h2 else 15
    out = doc.tobytes()
    doc.close()
    return out


def make_cv_image(lines: list[str] = SAMPLE_CV_LINES) -> bytes:
    """Renders the CV lines into a PNG (white page, black text)."""
    width, y = 1240, 60
    rows: list[tuple[int, str, int]] = []
    for raw in lines:
        h1, h2 = raw.startswith("# "), raw.startswith("## ")
        size = 40 if h1 else 28 if h2 else 21
        rows.append((y, raw.lstrip("# "), size))
        y += 56 if h1 else 46 if h2 else 32
    img = Image.new("RGB", (width, y + 40), "white")
    draw = ImageDraw.Draw(img)
    for row_y, text, size in rows:
        draw.text((60, row_y), text, fill="black", font=ImageFont.load_default(size=size))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def make_scanned_pdf() -> bytes:
    """A PDF whose only content is an image of the CV (like a scan): no text layer."""
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, stream=make_cv_image(), keep_proportion=True)
    out = doc.tobytes()
    doc.close()
    return out


def make_non_cv_pdf() -> bytes:
    return make_text_pdf(
        [
            "# Receipt",
            "Coffee Corner Co., Ltd. - Tax Invoice No. 000123",
            "Date: 2026-09-14",
            "1 x Iced Latte .................. 65.00 THB",
            "1 x Croissant ................... 55.00 THB",
            "Subtotal 120.00 THB, VAT 7% 8.40 THB, Total 128.40 THB",
            "Paid by credit card ****1234. Thank you for your purchase!",
            "Please keep this receipt for returns within 7 days.",
            "Branch: Siam Square, Bangkok. Tel 02-000-0000.",
        ]
    )


def make_many_pages_pdf(pages: int) -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        doc.new_page(width=595, height=842).insert_text((50, 50), f"Page {i + 1}")
    out = doc.tobytes()
    doc.close()
    return out


def make_encrypted_pdf() -> bytes:
    doc = pymupdf.open()
    doc.new_page().insert_text((50, 50), "secret")
    out = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="user")
    doc.close()
    return out


if __name__ == "__main__":
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "sample-cv.pdf").write_bytes(make_text_pdf())
    (OUT_DIR / "sample-cv-scanned.pdf").write_bytes(make_scanned_pdf())
    (OUT_DIR / "sample-cv-photo.png").write_bytes(make_cv_image())
    (OUT_DIR / "not-a-cv.pdf").write_bytes(make_non_cv_pdf())
    print(f"Fixtures written to {OUT_DIR}")
