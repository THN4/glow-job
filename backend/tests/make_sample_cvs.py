"""Generates SYNTHETIC sample CVs (fictional people, example.com emails) into backend-py/test_cvs/.

    python -m tests.make_sample_cvs

Covers different fields, layouts, languages and file types so extraction can be tried by hand
(python -m app.scripts.try_api test_cvs/<file>) and later evaluated against test_cvs/manifest.json.
Output is deterministic (fixed random seed). No real person's data.
"""

from __future__ import annotations

import io
import json
import random
from dataclasses import dataclass
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "test_cvs"
TAHOMA = Path("C:/Windows/Fonts/tahoma.ttf")
TAHOMA_BOLD = Path("C:/Windows/Fonts/tahomabd.ttf")
A4 = (595, 842)


# --------------------------------------------------------------------------- tiny layout engine


@dataclass
class Fonts:
    regular: str
    bold: str
    regular_file: Path | None = None
    bold_file: Path | None = None

    def measure(self, text: str, size: float, bold: bool) -> float:
        name, file = (self.bold, self.bold_file) if bold else (self.regular, self.regular_file)
        font = pymupdf.Font(fontfile=str(file)) if file else pymupdf.Font(name)
        return font.text_length(text, fontsize=size)


LATIN = Fonts("helv", "hebo")
THAI = Fonts("thai", "thaib", TAHOMA, TAHOMA_BOLD)

#            size, bold, gap_before, gap_after
STYLES = {
    "name": (22, True, 0, 6),
    "headline": (11, False, 0, 3),
    "contact": (9, False, 0, 1),
    "h2": (12, True, 12, 4),
    "body": (9.5, False, 0, 2.5),
    "bold": (9.5, True, 3, 1),
    "bullet": (9.5, False, 0, 1.5),
    "small": (8.5, False, 0, 1),
}


class Column:
    """Writes wrapped text into a vertical region of a (possibly multi-page) document."""

    def __init__(self, doc: pymupdf.Document, fonts: Fonts, x0: float, x1: float, top=48.0, bottom=800.0, multipage=True, scale=1.0):
        self.doc, self.fonts, self.x0, self.x1, self.top, self.bottom = doc, fonts, x0, x1, top, bottom
        self.scale = scale
        self.multipage = multipage
        self.page = doc[-1] if doc.page_count else self._new_page()
        self.y = top

    def _new_page(self) -> pymupdf.Page:
        page = self.doc.new_page(width=A4[0], height=A4[1])
        for name, file in ((self.fonts.regular, self.fonts.regular_file), (self.fonts.bold, self.fonts.bold_file)):
            if file:
                page.insert_font(fontname=name, fontfile=str(file))
        return page

    def _wrap(self, text: str, size: float, bold: bool, width: float) -> list[str]:
        lines, cur = [], ""
        for word in text.split(" "):
            trial = f"{cur} {word}".strip()
            if cur and self.fonts.measure(trial, size, bold) > width:
                lines.append(cur)
                cur = word
            else:
                cur = trial
        if cur:
            lines.append(cur)
        return lines or [""]

    def add(self, text: str, kind: str = "body") -> None:
        size, bold, before, after = STYLES[kind]
        size, before, after = size * self.scale, before * self.scale, after * self.scale
        indent = 10 if kind == "bullet" else 0
        prefix = "- " if kind == "bullet" else ""
        lines = self._wrap(prefix + text, size, bold, self.x1 - self.x0 - indent)
        needed = before + len(lines) * (size * 1.3) + after
        if self.y + needed > self.bottom:
            if not self.multipage:
                raise RuntimeError(f"column overflow at: {text[:40]!r}")
            self.page = self._new_page()
            self.y = self.top
        self.y += before
        font = self.fonts.bold if bold else self.fonts.regular
        for i, line in enumerate(lines):
            x = self.x0 + (indent if i else 0) if kind == "bullet" else self.x0 + indent
            self.y += size * 1.3
            self.page.insert_text((x, self.y - size * 0.3), line, fontsize=size, fontname=font, color=(0.1, 0.1, 0.1))
        self.y += after

    def many(self, items: list[tuple[str, str]]) -> None:
        for kind, text in items:
            self.add(text, kind)


def _save(doc: pymupdf.Document) -> bytes:
    try:
        doc.subset_fonts()  # embed only the glyphs used (needs fontTools); keeps Thai PDFs small
    except Exception:
        pass
    out = doc.tobytes(garbage=3, deflate=True)
    doc.close()
    return out


def single_column(fonts: Fonts, items: list[tuple[str, str]], scale: float = 1.0) -> bytes:
    doc = pymupdf.open()
    Column(doc, fonts, 50, 545, scale=scale).many(items)
    return _save(doc)


# --------------------------------------------------------------------------- CV content

CV_FULLSTACK = [
    ("name", "Alex Example"),
    ("headline", "Full-Stack Web Developer | Bangkok, Thailand"),
    ("contact", "alex.example@example.com | github.com/alex-example"),
    ("h2", "Education"),
    ("bold", "B.Sc. in Computer Science, Chulalongkorn University, 2020 - 2024"),
    ("body", "GPA 3.45 / 4.00"),
    ("h2", "Experience"),
    ("bold", "Freelance Web Developer, Self-employed, Jun 2023 - Present"),
    ("bullet", "Build and maintain web applications for small businesses (landing pages, e-commerce, internal tools)"),
    ("bullet", "Tech: ReactJS, Next.js, Node.js, Tailwind CSS"),
    ("bold", "Software Engineer Intern, Siam Digital Co., Ltd., Jun 2022 - Aug 2022"),
    ("bullet", "Built REST APIs with Express and PostgreSQL"),
    ("h2", "Projects"),
    ("bold", "MODNOI"),
    ("body", "A social platform for university students to share notes and collaborate on projects."),
    ("body", "Tech: Next.js, TypeScript, PostgreSQL, Vercel"),
    ("h2", "Skills"),
    ("body", "Languages: JavaScript (advanced), TypeScript (intermediate), Python (basic)"),
    ("body", "Frameworks: React, Next.js, Express"),
    ("body", "Databases: Postgres, MongoDB"),
    ("body", "Tools: Git, Docker, Figma, VS Code"),
    ("h2", "Certifications & Activities"),
    ("body", "AWS Cloud Practitioner Workshop - Mar 2024"),
    ("body", "CU Innovation Hackathon 2023 - Finalist"),
    ("body", "Chulalongkorn Programming Contest - Top 10"),
    ("h2", "Languages"),
    ("body", "Thai (Native), English (IELTS 7.0)"),
]

CV_DATA_ANALYST = [
    ("name", "Nina Park"),
    ("headline", "Data Analyst"),
    ("contact", "nina.park@example.com | +66 80 000 0001 | Chiang Mai, Thailand | linkedin.com/in/nina-park-example"),
    ("h2", "Summary"),
    ("body", "Data analyst with 4 years of experience turning messy business data into dashboards and decisions. Comfortable with SQL, Python and BI tools, and with explaining results to non-technical teams."),
    ("h2", "Experience"),
    ("bold", "Data Analyst - Orbit Analytics Co., Ltd., Chiang Mai - Mar 2022 to Present"),
    ("bullet", "Built 12 Tableau dashboards used weekly by the sales and operations teams"),
    ("bullet", "Automated monthly reporting with Python and pandas, saving about 15 hours per month"),
    ("bullet", "Wrote and optimized SQL queries on a PostgreSQL warehouse with 40M+ rows"),
    ("bullet", "Ran A/B tests for the checkout flow and reported a 6% conversion lift"),
    ("bold", "Junior Data Analyst - Lanna Retail Group - Jul 2020 to Feb 2022"),
    ("bullet", "Cleaned and merged sales data from 30 branches using Excel and SQL"),
    ("bullet", "Created Power BI reports for the regional managers"),
    ("bold", "Data Intern - Doi Digital Studio - Jan 2020 to Jun 2020"),
    ("bullet", "Supported the team with data collection and basic statistical analysis in R"),
    ("h2", "Education"),
    ("bold", "M.Sc. in Applied Statistics, Chiang Mai University, 2018 - 2020"),
    ("body", "Thesis: Forecasting retail demand with seasonal ARIMA models"),
    ("bold", "B.Sc. in Mathematics, Chiang Mai University, 2014 - 2018"),
    ("h2", "Technical Skills"),
    ("body", "Languages: SQL, Python, R"),
    ("body", "Libraries: pandas, NumPy, scikit-learn, Matplotlib"),
    ("body", "BI and tools: Tableau, Power BI, Excel, Jupyter, Git"),
    ("body", "Databases: PostgreSQL, MySQL, BigQuery"),
    ("h2", "Certifications"),
    ("body", "Google Data Analytics Professional Certificate - 2021"),
    ("body", "Microsoft Certified: Power BI Data Analyst Associate - 2022"),
    ("h2", "Projects"),
    ("bold", "Bangkok Air Quality Explorer (personal project)"),
    ("body", "Interactive dashboard of PM2.5 open data with Python, Streamlit and PostgreSQL."),
    ("bold", "Customer Churn Model"),
    ("body", "Logistic regression and random forest model predicting churn, F1 score 0.78."),
    ("h2", "Languages"),
    ("body", "Thai (Native), English (Professional working proficiency)"),
]

CV_FRESH_GRAD = [
    ("name", "Sam Lee"),
    ("headline", "Computer Engineering student, looking for an internship"),
    ("contact", "sam.lee@example.com | Khon Kaen, Thailand"),
    ("h2", "Education"),
    ("bold", "B.Eng. in Computer Engineering (expected 2027)"),
    ("body", "Khon Kaen University, 2023 - Present, GPA 3.20"),
    ("h2", "Skills"),
    ("body", "Java, C, Python (basic), MySQL, HTML/CSS, Git"),
    ("h2", "Projects"),
    ("bold", "Library Management System (course project)"),
    ("body", "Desktop app in Java with a MySQL database for borrowing and returning books."),
    ("bold", "Smart Plant Watering"),
    ("body", "Arduino and a soil sensor that waters plants automatically; data shown on a simple web page."),
    ("h2", "Activities"),
    ("body", "Member, Programming Club, KKU (2023 - Present)"),
    ("body", "Volunteer, Hour of Code workshop for high-school students, 2024"),
]

CV_THAI = [
    ("name", "สมชาย ตัวอย่าง"),
    ("headline", "นักพัฒนาซอฟต์แวร์ (Backend Developer)"),
    ("contact", "somchai.example@example.com | โทร 081-000-0002 | กรุงเทพมหานคร"),
    ("h2", "การศึกษา"),
    ("bold", "วิทยาศาสตรบัณฑิต สาขาวิทยาการคอมพิวเตอร์"),
    ("body", "มหาวิทยาลัยเชียงใหม่  พ.ศ. 2559 - 2563  เกรดเฉลี่ย 3.30"),
    ("h2", "ประสบการณ์ทำงาน"),
    ("bold", "นักพัฒนาซอฟต์แวร์  บริษัท ตัวอย่าง ดิจิทัล จำกัด  มิถุนายน 2563 - ปัจจุบัน"),
    ("bullet", "พัฒนาและดูแลระบบ API ด้วย Python (FastAPI) และ PostgreSQL"),
    ("bullet", "ออกแบบฐานข้อมูลและเขียนชุดทดสอบอัตโนมัติด้วย pytest"),
    ("bullet", "ติดตั้งระบบด้วย Docker บน AWS"),
    ("bold", "นักศึกษาฝึกงาน  บริษัท สยามซอฟต์ จำกัด  พฤษภาคม 2562 - กรกฎาคม 2562"),
    ("bullet", "ช่วยทีมพัฒนาเว็บไซต์ด้วย JavaScript และ React"),
    ("h2", "ทักษะ"),
    ("body", "ภาษาโปรแกรม: Python, JavaScript, SQL"),
    ("body", "เครื่องมือ: Git, Docker, Postman, Jira"),
    ("h2", "ใบรับรองและกิจกรรม"),
    ("body", "AWS Certified Cloud Practitioner  พ.ศ. 2565"),
    ("body", "ผู้เข้ารอบสุดท้าย การแข่งขันเขียนโปรแกรมระดับประเทศ  พ.ศ. 2562"),
    ("h2", "ภาษา"),
    ("body", "ไทย (ภาษาแม่), อังกฤษ (ระดับดี)"),
]

CV_MIXED = [
    ("name", "Napat Wongsakul (นภัส วงศ์สกุล)"),
    ("headline", "Mobile Developer | นักพัฒนาแอปพลิเคชันมือถือ"),
    ("contact", "napat.w@example.com | github.com/napat-example | Bangkok / กรุงเทพฯ"),
    ("h2", "Education / การศึกษา"),
    ("bold", "B.Eng. in Computer Engineering, King Mongkut's University of Technology Thonburi (มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี), 2017 - 2021"),
    ("h2", "Experience / ประสบการณ์"),
    ("bold", "Mobile Developer, Krungthep Fintech Co., Ltd. (บริษัท กรุงเทพ ฟินเทค จำกัด), Aug 2021 - Present"),
    ("bullet", "Developed a payment app used by 200k+ users with Flutter and Dart"),
    ("bullet", "ทำงานร่วมกับทีม Backend เพื่อออกแบบ REST API และปรับปรุงประสิทธิภาพของแอป"),
    ("bullet", "Set up CI/CD with GitHub Actions and Firebase App Distribution"),
    ("bold", "Android Developer (Contract), Bangna Studio, Jan 2021 - Jul 2021"),
    ("bullet", "Built two client apps in Kotlin and Jetpack Compose"),
    ("h2", "Skills / ทักษะ"),
    ("body", "Flutter, Dart, Kotlin, Swift (basic), Firebase, REST, Git, GitHub Actions, Figma"),
    ("h2", "Awards / รางวัล"),
    ("body", "ชนะเลิศ Hackathon ระดับมหาวิทยาลัย 2020 (1st place, KMUTT Hackathon 2020)"),
    ("h2", "Languages / ภาษา"),
    ("body", "Thai (native), English (TOEIC 880)"),
]


def two_column_cv() -> bytes:
    """Sidebar (contact, skills, languages, certifications) + main column. Tests reading order."""
    doc = pymupdf.open()
    page = doc.new_page(width=A4[0], height=A4[1])
    page.draw_rect(pymupdf.Rect(0, 0, 190, 842), color=None, fill=(0.93, 0.95, 0.98))
    left = Column(doc, LATIN, 24, 176, multipage=False)
    left.many([
        ("name", "Maya"),
        ("name", "Okafor"),
        ("headline", "UX / UI Designer"),
        ("h2", "Contact"),
        ("small", "maya.okafor@example.com"),
        ("small", "+66 90 000 0003"),
        ("small", "Phuket, Thailand"),
        ("small", "behance.net/maya-okafor-example"),
        ("h2", "Skills"),
        ("body", "User research"),
        ("body", "Wireframing"),
        ("body", "Prototyping"),
        ("body", "Design systems"),
        ("body", "Accessibility (WCAG)"),
        ("body", "HTML and CSS basics"),
        ("h2", "Tools"),
        ("body", "Figma"),
        ("body", "Adobe XD"),
        ("body", "Miro"),
        ("body", "Notion"),
        ("body", "Maze"),
        ("h2", "Languages"),
        ("body", "English (fluent)"),
        ("body", "Thai (intermediate)"),
        ("h2", "Certifications"),
        ("body", "Google UX Design Certificate, 2022"),
        ("body", "NN/g UX Certification, 2023"),
    ])
    right = Column(doc, LATIN, 215, 560, multipage=False)
    right.many([
        ("h2", "Profile"),
        ("body", "Product designer with 5 years of experience designing mobile and web products for travel and fintech companies. I like research-driven design and close collaboration with engineers."),
        ("h2", "Experience"),
        ("bold", "Senior UX Designer - Andaman Travel Tech, Phuket"),
        ("small", "Feb 2023 - Present"),
        ("bullet", "Led the redesign of the booking app, increasing completed bookings by 18%"),
        ("bullet", "Created and maintained a design system with 60+ components in Figma"),
        ("bullet", "Mentored two junior designers"),
        ("bold", "UX/UI Designer - PayBridge Fintech, Bangkok"),
        ("small", "Sep 2020 - Jan 2023"),
        ("bullet", "Designed onboarding and KYC flows for a mobile wallet with 1M+ users"),
        ("bullet", "Ran 30+ usability tests and turned findings into prioritized roadmap items"),
        ("bold", "Graphic Designer - Pixel Garden Studio, Phuket"),
        ("small", "Jun 2019 - Aug 2020"),
        ("bullet", "Branding and social media assets for local hotels and restaurants"),
        ("h2", "Education"),
        ("bold", "B.A. in Visual Communication Design"),
        ("body", "Silpakorn University, 2015 - 2019"),
        ("h2", "Selected Projects"),
        ("bold", "Island Hopper (case study)"),
        ("body", "End-to-end design of a ferry booking app for tourists: research, flows, prototype and usability test."),
        ("bold", "Open-source icon set"),
        ("body", "120 accessible travel icons published on GitHub, 900+ stars."),
        ("h2", "Awards"),
        ("body", "Winner, Thailand UX Design Challenge 2022"),
        ("body", "Finalist, Bangkok Design Week student showcase 2018"),
    ])
    out = _save(doc)
    return out


def long_cv() -> bytes:
    """3 pages, senior profile with many roles."""
    items: list[tuple[str, str]] = [
        ("name", "Marcus Webb"),
        ("headline", "Senior DevOps / Site Reliability Engineer"),
        ("contact", "marcus.webb@example.com | +66 80 000 0004 | Bangkok, Thailand | github.com/marcus-webb-example"),
        ("h2", "Summary"),
        ("body", "Site reliability engineer with 10+ years of experience running production systems on AWS and Kubernetes. Focused on automation, observability and cost control. Led platform teams of up to 6 engineers."),
        ("h2", "Experience"),
    ]
    roles = [
        ("Lead SRE - Meridian Payments, Bangkok", "Jan 2022 - Present", [
            "Run a multi-account AWS platform (EKS, RDS, S3, CloudFront) serving 3M monthly users",
            "Cut cloud costs by 32% with rightsizing, Savings Plans and autoscaling",
            "Introduced SLOs and error budgets; reduced incident minutes by 45% year over year",
            "Built the CI/CD standard with GitHub Actions and ArgoCD used by 25 services",
            "Managed a team of 6 engineers; hired 4 and mentored 2 into senior roles",
        ]),
        ("Senior DevOps Engineer - Coral Logistics, Bangkok", "Mar 2018 - Dec 2021", [
            "Migrated 40 services from on-premise VMs to Docker and Kubernetes",
            "Wrote Terraform modules for networking, databases and IAM",
            "Set up Prometheus, Grafana and Loki for monitoring and logging",
            "Automated database backups and disaster recovery drills",
        ]),
        ("DevOps Engineer - Nimbus Software, Singapore", "Jun 2015 - Feb 2018", [
            "Maintained Jenkins pipelines and Ansible playbooks for 15 microservices",
            "Reduced deployment time from 2 hours to 12 minutes",
            "Was on the on-call rotation and led post-incident reviews",
        ]),
        ("System Administrator - Sunrise Hosting, Bangkok", "Jul 2012 - May 2015", [
            "Administered 200+ Linux servers (CentOS, Ubuntu) and managed web hosting customers",
            "Scripted routine tasks in Bash and Python",
        ]),
    ]
    for title, dates, bullets in roles:
        items.append(("bold", f"{title}, {dates}"))
        items.extend(("bullet", b) for b in bullets)
    items += [
        ("h2", "Education"),
        ("bold", "B.Eng. in Computer Engineering, Chulalongkorn University, 2008 - 2012"),
        ("h2", "Technical Skills"),
        ("body", "Cloud: AWS (EKS, EC2, RDS, S3, Lambda, CloudFront), some GCP"),
        ("body", "Containers and orchestration: Docker, Kubernetes, Helm, ArgoCD"),
        ("body", "Infrastructure as code: Terraform, Ansible, CloudFormation"),
        ("body", "CI/CD: GitHub Actions, Jenkins, GitLab CI"),
        ("body", "Observability: Prometheus, Grafana, Loki, Datadog, PagerDuty"),
        ("body", "Languages: Python, Bash, Go (basic), SQL"),
        ("body", "Databases: PostgreSQL, MySQL, Redis"),
        ("h2", "Certifications"),
        ("body", "AWS Certified Solutions Architect - Professional, 2023"),
        ("body", "AWS Certified DevOps Engineer - Professional, 2022"),
        ("body", "Certified Kubernetes Administrator (CKA), 2021"),
        ("body", "HashiCorp Certified: Terraform Associate, 2020"),
        ("h2", "Selected Achievements"),
        ("bullet", "Designed a zero-downtime database migration for the payments ledger (4 TB) with no customer impact"),
        ("bullet", "Reduced mean time to recovery from 58 to 14 minutes by adding runbooks and automated rollbacks"),
        ("bullet", "Introduced game days (failure drills) each quarter; found and fixed 19 hidden single points of failure"),
        ("bullet", "Passed SOC 2 and PCI DSS audits as the technical owner of infrastructure controls"),
        ("bullet", "Created an internal developer portal so teams can create a new service with pipelines in under 10 minutes"),
        ("h2", "Talks and Open Source"),
        ("body", "Speaker, DevOps Thailand Meetup 2023: Error budgets in practice"),
        ("body", "Maintainer of terraform-aws-tidy-vpc, an open-source Terraform module (500+ stars)"),
        ("h2", "Languages"),
        ("body", "English (fluent), Thai (native)"),
    ]
    return single_column(LATIN, items, scale=1.5)


NOT_A_CV = [
    ("name", "Receipt"),
    ("headline", "Coffee Corner Co., Ltd. - Tax Invoice No. 000123"),
    ("body", "Date: 2026-09-14   Branch: Siam Square, Bangkok   Tel 02-000-0000"),
    ("body", "1 x Iced Latte .................... 65.00 THB"),
    ("body", "1 x Croissant ..................... 55.00 THB"),
    ("body", "Subtotal 120.00 THB, VAT 7% 8.40 THB, Total 128.40 THB"),
    ("body", "Paid by credit card ****1234. Thank you for your purchase!"),
    ("body", "Please keep this receipt for returns within 7 days."),
]


# --------------------------------------------------------------------------- image variants


def render_page(pdf: bytes, page: int = 0, dpi: int = 150) -> Image.Image:
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    pix = doc[page].get_pixmap(matrix=pymupdf.Matrix(dpi / 72, dpi / 72), alpha=False)
    doc.close()
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def scanned_pdf(pdf: bytes) -> bytes:
    """Image-only PDF (no text layer): slightly rotated, grayscale, noisy, like a flatbed scan."""
    rnd = random.Random(7)
    img = render_page(pdf).convert("L")
    img = img.rotate(rnd.uniform(-0.8, 0.8), resample=Image.Resampling.BICUBIC, expand=False, fillcolor=250)
    noise = Image.effect_noise(img.size, 9)
    img = ImageChops.add(img, noise, scale=1.0, offset=-128).filter(ImageFilter.GaussianBlur(0.5))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=78)
    doc = pymupdf.open()
    page = doc.new_page(width=A4[0], height=A4[1])
    page.insert_image(page.rect, stream=buf.getvalue())
    out = doc.tobytes()
    doc.close()
    return out


def phone_photo(pdf: bytes) -> bytes:
    """A 'photo' of a printed CV on a desk: rotated, uneven lighting, noise, JPEG artefacts."""
    page = render_page(pdf, dpi=130)
    pad = 90
    desk = Image.new("RGB", (page.width + 2 * pad, page.height + 2 * pad), (172, 150, 124))
    desk.paste(page, (pad, pad))
    desk = desk.rotate(2.6, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(172, 150, 124))
    # uneven lighting: smooth diagonal falloff, darker towards the lower right
    w, h = desk.size
    horizontal = Image.linear_gradient("L").rotate(90).resize((w, h))   # 255 -> 0 left to right (rotate 90: top->left)
    vertical = Image.linear_gradient("L").resize((w, h))                # 0 -> 255 top to bottom
    light = ImageChops.add(ImageChops.invert(horizontal), vertical, scale=2.0)   # 0 at upper left .. 255 at lower right
    shade = light.point(lambda v: 255 - int(v * 0.30))
    desk = ImageChops.multiply(desk, Image.merge("RGB", (shade, shade, shade)))
    noise = Image.effect_noise((w, h), 10).convert("RGB")
    desk = ImageChops.add(desk, noise, scale=1.0, offset=-128).filter(ImageFilter.GaussianBlur(0.9))
    buf = io.BytesIO()
    desk.save(buf, "JPEG", quality=68)
    return buf.getvalue()


# --------------------------------------------------------------------------- manifest + main

# Expected key facts per file, used by hand today and by the evaluation script later (task 8).
MANIFEST = [
    dict(file="01-fullstack-developer-en.pdf", kind="text PDF", language="en", pages=1,
         description="Single column, full-stack developer. The baseline sample.",
         expect=dict(fullName="Alex Example", institutions=["Chulalongkorn University"], organizations=["Self-employed", "Siam Digital Co., Ltd."],
                     skills=["JavaScript", "TypeScript", "React", "Next.js", "PostgreSQL", "Docker"], projects=["MODNOI"],
                     skillLevels={"JavaScript": "advanced", "TypeScript": "intermediate", "Python": "beginner"})),
    dict(file="02-data-analyst-en.pdf", kind="text PDF", language="en", pages=2,
         description="Two pages, summary, three jobs, master's degree, certifications and projects.",
         expect=dict(fullName="Nina Park", institutions=["Chiang Mai University"], organizations=["Orbit Analytics Co., Ltd.", "Lanna Retail Group", "Doi Digital Studio"],
                     skills=["SQL", "Python", "pandas", "Tableau", "Power BI"], projects=["Bangkok Air Quality Explorer", "Customer Churn Model"])),
    dict(file="03-fresh-graduate-en.pdf", kind="text PDF", language="en", pages=1,
         description="Student with NO work experience. Experience must stay empty (no invented jobs).",
         expect=dict(fullName="Sam Lee", institutions=["Khon Kaen University"], organizations=[],
                     skills=["Java", "C", "Python", "MySQL", "Git"], projects=["Library Management System", "Smart Plant Watering"],
                     skillLevels={"Python": "beginner"})),
    dict(file="04-thai-developer-th.pdf", kind="text PDF", language="th", pages=1,
         description="Fully Thai CV. Dates use the Buddhist Era (2559-2563 = 2016-2020): they are converted to Common Era and flagged needsReview.",
         expect=dict(fullName="สมชาย ตัวอย่าง", institutions=["มหาวิทยาลัยเชียงใหม่"], organizations=["บริษัท ตัวอย่าง ดิจิทัล จำกัด", "บริษัท สยามซอฟต์ จำกัด"],
                     skills=["Python", "FastAPI", "PostgreSQL", "Docker"], projects=[])),
    dict(file="05-mixed-thai-english.pdf", kind="text PDF", language="mixed", pages=1,
         description="English CV with Thai names, Thai university name and Thai bullet points.",
         expect=dict(fullName="Napat Wongsakul", institutions=["King Mongkut's University of Technology Thonburi"], organizations=["Krungthep Fintech Co., Ltd.", "Bangna Studio"],
                     skills=["Flutter", "Dart", "Kotlin", "Firebase"], projects=[])),
    dict(file="06-designer-two-column-en.pdf", kind="text PDF", language="en", pages=1,
         description="Two-column layout with a sidebar. Tests text reading order across columns.",
         expect=dict(fullName="Maya Okafor", institutions=["Silpakorn University"], organizations=["Andaman Travel Tech", "PayBridge Fintech", "Pixel Garden Studio"],
                     skills=["Figma", "Adobe XD", "Miro"], projects=["Island Hopper", "Open-source icon set"])),
    dict(file="07-senior-devops-long-en.pdf", kind="text PDF", language="en", pages=3,
         description="Three pages, 4 jobs, many skills and certifications. Tests long input.",
         expect=dict(fullName="Marcus Webb", institutions=["Chulalongkorn University"], organizations=["Meridian Payments", "Coral Logistics", "Nimbus Software", "Sunrise Hosting"],
                     skills=["AWS", "Kubernetes", "Terraform", "Docker", "Python"], projects=[])),
    dict(file="08-scanned-fresh-graduate.pdf", kind="scanned PDF (image only)", language="en", pages=1,
         description="Image-only PDF without a text layer. Needs a vision model.",
         expect=dict(fullName="Sam Lee", institutions=["Khon Kaen University"], organizations=[], skills=["Java", "C", "MySQL"], projects=["Library Management System"])),
    dict(file="09-phone-photo-data-analyst.jpg", kind="JPEG photo", language="en", pages=1,
         description="Photo of a printed CV: rotated, uneven lighting, noise. Needs a vision model.",
         expect=dict(fullName="Nina Park", institutions=["Chiang Mai University"], organizations=["Orbit Analytics Co., Ltd."], skills=["SQL", "Python", "Tableau"], projects=[])),
    dict(file="10-not-a-cv-receipt.pdf", kind="text PDF", language="en", pages=1,
         description="A receipt. Must fail with NOT_A_CV.",
         expect=dict(error="NOT_A_CV")),
]


def main() -> None:
    OUT.mkdir(exist_ok=True)
    data_analyst = single_column(LATIN, CV_DATA_ANALYST, scale=1.3)
    fresh_grad = single_column(LATIN, CV_FRESH_GRAD)
    files = {
        "01-fullstack-developer-en.pdf": single_column(LATIN, CV_FULLSTACK),
        "02-data-analyst-en.pdf": data_analyst,
        "03-fresh-graduate-en.pdf": fresh_grad,
        "04-thai-developer-th.pdf": single_column(THAI, CV_THAI),
        "05-mixed-thai-english.pdf": single_column(THAI, CV_MIXED),
        "06-designer-two-column-en.pdf": two_column_cv(),
        "07-senior-devops-long-en.pdf": long_cv(),
        "08-scanned-fresh-graduate.pdf": scanned_pdf(fresh_grad),
        "09-phone-photo-data-analyst.jpg": phone_photo(data_analyst),
        "10-not-a-cv-receipt.pdf": single_column(LATIN, NOT_A_CV),
    }
    for name, data in files.items():
        (OUT / name).write_bytes(data)
        print(f"{name:40} {len(data) / 1024:7.1f} KB")
    (OUT / "manifest.json").write_text(json.dumps(MANIFEST, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWritten to {OUT}")


if __name__ == "__main__":
    main()
