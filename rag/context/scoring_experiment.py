"""Compare coverage denominators without selecting a production match policy."""

from decimal import Decimal
from itertools import groupby

from rag.context.models import ContextInputs, MarketSkill


def _weight(skill: MarketSkill) -> Decimal:
    return Decimal(str(skill.weighted_demand_score or 0))


def _ranked(inputs: ContextInputs) -> list[MarketSkill]:
    return sorted(
        (skill for skill in inputs.market.skills if _weight(skill) > 0),
        key=lambda skill: (-_weight(skill), skill.skill_id),
    )


def select_by_count(skills: list[MarketSkill], count: int) -> list[MarketSkill]:
    """Include the whole tied group at the count boundary."""
    if count < 1:
        raise ValueError("The experimental skill count must be positive")
    if not skills:
        return []
    cutoff = _weight(skills[min(count, len(skills)) - 1])
    return [skill for skill in skills if _weight(skill) >= cutoff]


def select_by_mass(skills: list[MarketSkill], share: Decimal) -> list[MarketSkill]:
    if not Decimal(0) < share <= Decimal(1):
        raise ValueError("Cumulative market weight share must be greater than 0 and at most 1")
    target = sum((_weight(skill) for skill in skills), Decimal(0)) * share
    selected: list[MarketSkill] = []
    accumulated = Decimal(0)
    for _, group in groupby(skills, key=_weight):
        tied = list(group)
        selected.extend(tied)
        accumulated += sum((_weight(skill) for skill in tied), Decimal(0))
        if accumulated >= target:
            break
    return selected


def _coverage(skills: list[MarketSkill], known: set[int]) -> float | None:
    total = sum((_weight(skill) for skill in skills), Decimal(0))
    if total <= 0:
        return None
    covered = sum((_weight(skill) for skill in skills if skill.skill_id in known), Decimal(0))
    return float((100 * covered / total).quantize(Decimal("0.01")))


def compare_policies(
    inputs: ContextInputs, *, top_count: int = 10, cumulative_share: Decimal = Decimal("0.80"),
) -> dict:
    ranked = _ranked(inputs)
    top = select_by_count(ranked, top_count)
    mass = select_by_mass(ranked, cumulative_share)
    policies = [
        ("existing_weighted_coverage", ranked),
        ("top_weight_count_with_ties", top),
        ("cumulative_weight_with_ties", mass),
    ]
    top_ids = {skill.skill_id for skill in top}
    tail = [skill for skill in reversed(ranked) if skill.skill_id not in top_ids][:len(top)]
    tail_ids = {skill.skill_id for skill in tail}
    scenarios = [
        ("no_confirmed_skills", set(), False),
        ("top_weight_skills_only", top_ids, False),
        ("tail_skills_only", tail_ids, False),
        ("top_and_tail_skills", top_ids | tail_ids, False),
        ("top_weight_skills_unknown_levels", top_ids, True),
        ("all_market_skills", {skill.skill_id for skill in ranked}, False),
    ]
    total_weight = sum((_weight(skill) for skill in ranked), Decimal(0))
    policy_rows = []
    for name, selected in policies:
        selected_weight = sum((_weight(skill) for skill in selected), Decimal(0))
        policy_rows.append({
            "policy": name,
            "selected_skills": len(selected),
            "retained_weight_pct": float((100 * selected_weight / total_weight).quantize(Decimal("0.01")))
            if total_weight else None,
            "skill_ids": [skill.skill_id for skill in selected],
        })
    rows = []
    for scenario, known, levels_unknown in scenarios:
        rows.append({
            "scenario": scenario,
            "confirmed_skill_count": len(known),
            "known_proficiency_count": 0 if levels_unknown else len(known),
            "scores": {name: _coverage(selected, known) for name, selected in policies},
        })
    saved_profile = None
    if inputs.user is not None:
        # Use canonical IDs already matched and confirmed by the save flow.
        # Keep aggregate results only: do not copy CV text, identity or evidence.
        known = {skill.skill_id for skill in inputs.user.confirmed_skills}
        weighted_ids = {skill.skill_id for skill in ranked}
        saved_profile = {
            "confirmed_skill_count": len(known),
            "unresolved_skill_count": len(inputs.user.unresolved_skills),
            "known_proficiency_count": sum(
                skill.proficiency_level != "unknown" for skill in inputs.user.confirmed_skills
            ),
            "unknown_proficiency_count": sum(
                skill.proficiency_level == "unknown" for skill in inputs.user.confirmed_skills
            ),
            "skills_outside_weighted_market_count": len(known - weighted_ids),
            "covered_skill_counts": {
                name: sum(skill.skill_id in known for skill in selected)
                for name, selected in policies
            },
            "scores": {name: _coverage(selected, known) for name, selected in policies},
        }
    return {
        "status": "experiment_only_pending_user_review",
        "career": inputs.career.model_dump(mode="json"),
        "market_window": inputs.market.window.model_dump(mode="json") if inputs.market.window else None,
        "market_skills": len(inputs.market.skills),
        "weighted_skills": len(ranked),
        "total_jobs": ranked[0].total_jobs if ranked else 0,
        "one_job_skills": sum(skill.demand_count == 1 for skill in ranked),
        "unknown_market_target_levels": sum(skill.target_level == "unknown" for skill in ranked),
        "parameters": {"top_count": top_count, "cumulative_share": str(cumulative_share)},
        "policies": policy_rows,
        "saved_profile": saved_profile,
        "scenarios": rows,
        "top_skill_names": [skill.skill_name for skill in top],
        "tail_skill_names": [skill.skill_name for skill in tail],
        "warnings": list(inputs.warnings),
    }


def format_report(report: dict) -> str:
    def escape(value):
        return str(value).replace("|", "\\|").replace("\n", " ")

    def percentage(value):
        return "N/A" if value is None else f"{value:.2f}%"

    window = report["market_window"]
    saved_profile = report.get("saved_profile")
    lines = [
        "# Career Match: ตัวอย่างเปรียบเทียบนโยบายคะแนน",
        "",
        "**สถานะ:** ทดลองเพื่อให้ผู้ใช้ตรวจ ยังไม่เลือกสูตรหรือเปลี่ยน API ปัจจุบัน",
        "",
        ("ส่วนโปรไฟล์ที่บันทึกแล้วใช้ canonical skills ที่ยืนยันใน DB/ไฟล์ input จริง ส่วนตัวอย่างสมมติยังแสดงแยกกัน รายงานไม่คัดลอกชื่อบุคคล ข้อความ CV หรือ evidence"
         if saved_profile is not None else
         "โปรไฟล์ผู้ใช้ในรายงานเป็นข้อมูลสมมติที่สร้างจาก canonical IDs ของตลาด ไม่ได้ใช้ CV หรือข้อมูลส่วนตัวจริง"),
        "",
        f"Career: {escape(report['career']['profile_name'])} (career_profile_id={report['career']['career_profile_id']})",
        "",
        f"Snapshot: {window['analysis_start_date']} ถึง {window['analysis_end_date']} / {window['analysis_date_basis']}"
        if window else "Snapshot: ไม่มีข้อมูลสำหรับ date basis ที่เลือก",
        "",
        f"Market sample: {report['total_jobs']} งาน, {report['market_skills']} skills; มีน้ำหนักบวก {report['weighted_skills']} skills",
        "",
        f"Skills ที่พบในงานเดียว: {report['one_job_skills']}; market target level ที่ยัง unknown: {report['unknown_market_target_levels']}",
        "",
        "## สิ่งที่สูตรทดลองวัด",
        "",
        "ทุกสูตรใช้ weighted coverage จากการมี canonical skill ที่ยืนยันแล้ว จึงไม่ใช่ความพร้อมทำงานหรือคะแนน proficiency ทั้งหมด สูตรแรกใช้ตัวหารแบบ marketSkillCoveragePct เดิม ส่วนอีกสองสูตรทดลองกรองตัวหารจาก market เท่านั้น ไม่ใช้ skill ที่ขาดของผู้ใช้หรือ Top-N Roadmap มาตั้งตัวหาร",
        "",
        "สูตรเดิมในรายงานเป็น baseline ที่คำนวณใหม่บน snapshot/date basis เดียวกับอีกสองสูตร ไม่รับรองว่าจะเท่ากับคะแนนหน้าเว็บที่อาจใช้ cohort ต่างกัน",
        "",
        "การมีระดับ unknown ไม่เปลี่ยนคะแนนการมี skill แต่ยังนำไปสรุปว่าระดับถึงเป้าหมายไม่ได้ แผนนี้ยังไม่ตัดสินใจว่าจะเลือกสูตรใดหรือแสดงกี่คะแนน",
        "",
        "| นโยบายทดลอง | Skill ในตัวหาร | น้ำหนักตลาดที่เก็บไว้ |",
        "|---|---:|---:|",
    ]
    for policy in report["policies"]:
        lines.append(f"| {policy['policy']} | {policy['selected_skills']} | {percentage(policy['retained_weight_pct'])} |")
    lines.extend([
        "",
        f"พารามิเตอร์ทดลอง: count={report['parameters']['top_count']}, cumulative share={report['parameters']['cumulative_share']} ค่าที่อยู่ตรงขอบและมีน้ำหนักเท่ากันถูกเก็บทั้งกลุ่ม จึงอาจได้มากกว่า count ที่ตั้งไว้",
        "",
    ])
    if saved_profile is not None:
        lines.extend([
            "## ผลจากโปรไฟล์ที่บันทึกแล้ว",
            "",
            f"Canonical skills ที่ยืนยันแล้ว: {saved_profile['confirmed_skill_count']}; ยังจับคู่ไม่ได้: {saved_profile['unresolved_skill_count']}; ไม่อยู่ในกลุ่มตลาดที่มีน้ำหนักบวก: {saved_profile['skills_outside_weighted_market_count']}",
            "",
            f"ระดับที่ทราบ: {saved_profile['known_proficiency_count']}; ระดับ unknown: {saved_profile['unknown_proficiency_count']} (ไม่ใช้ระดับมาลดคะแนน coverage)",
            "",
            "| นโยบายทดลอง | พบ skills / skills ในตัวหาร | คะแนน coverage |",
            "|---|---:|---:|",
        ])
        for policy in report["policies"]:
            name = policy["policy"]
            lines.append(
                f"| {name} | {saved_profile['covered_skill_counts'][name]} / {policy['selected_skills']} | {percentage(saved_profile['scores'][name])} |"
            )
        lines.extend([
            "",
            "Unresolved skills ยังไม่เข้าตัวตั้งเพราะไม่มี canonical ID ที่ยืนยันแล้ว สูตรไม่ได้เพิ่มหรือลดตัวหารตามโปรไฟล์ผู้ใช้ ถ้าไม่มีข้อมูลตลาด/น้ำหนักบวก คะแนนเป็น N/A ไม่ใช่ 0%",
            "",
        ])
    lines.extend([
        "## ผลจากโปรไฟล์สมมติ",
        "",
        "| โปรไฟล์ | มี skills | ระดับที่ทราบ | สูตรเดิม | จำกัดจำนวนตามน้ำหนัก | สะสมน้ำหนักตลาด |",
        "|---|---:|---:|---:|---:|---:|",
    ])
    for scenario in report["scenarios"]:
        values = " | ".join(percentage(scenario["scores"][p["policy"]]) for p in report["policies"])
        lines.append(f"| {scenario['scenario']} | {scenario['confirmed_skill_count']} | {scenario['known_proficiency_count']} | {values} |")
    lines.extend([
        "",
        "top_weight_skills_only มีเฉพาะกลุ่มน้ำหนักสูง ส่วน tail_skills_only มีทักษะน้ำหนักต่ำที่ไม่ซ้อนกับกลุ่มแรก โดยจำนวนเท่ากันถ้ามีทักษะเหลือพอ ทั้งสองชื่อเป็นวิธีสร้างตัวอย่าง ไม่ใช่การยืนยันว่าทักษะกลุ่มใดเป็น prerequisite หรือ core โดยสากล",
        "",
        "## รายชื่อที่ใช้สร้างตัวอย่าง",
        "",
        "กลุ่มน้ำหนักสูง: " + ", ".join(escape(name) for name in report["top_skill_names"]),
        "",
        "กลุ่มน้ำหนักต่ำ: " + ", ".join(escape(name) for name in report["tail_skill_names"]),
        "",
        "## จุดที่ควรตรวจร่วมกันก่อนเลือกสูตร",
        "",
        "- สูตรที่กรองตัวหารให้ 100% ได้แม้ยังขาดทักษะส่วนอื่น ต้องดูน้ำหนักที่ถูกตัดออกประกอบ",
        "- จำนวนทักษะที่มีเท่ากันอาจได้คะแนนต่างกันตามความสำคัญใน snapshot นี้",
        "- sample size และช่วงวันที่มีผลต่อความน่าเชื่อถือ ยังไม่ได้เลือกเกณฑ์ eligibility ขั้นสุดท้าย",
        "- ต้องเทียบ career profile อื่นและ CV ตัวอย่างที่ตรวจแล้วก่อนรับรองนโยบายใช้งานจริง",
        "- Availability และจำนวน skill ที่จะใส่ Roadmap ไม่ใช่ input ของสูตรคะแนนเหล่านี้",
        "- ยังไม่มีผลจาก Roadmap Agent หรือการประเมิน proficiency ในรายงานนี้",
        "",
    ])
    if report["warnings"]:
        lines.extend(["Warnings จาก input preview: " + ", ".join(report["warnings"]), ""])
    return "\n".join(lines)
