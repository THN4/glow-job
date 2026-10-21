# ทดลองคะแนนด้วย Resume จริง

ตอนนี้สามารถใช้โปรไฟล์ที่ยืนยันและบันทึกจาก `/onboarding/cv` มาทดลองตัวหารคะแนน
3 แบบได้ด้วย CLI โดยไม่ต้องเรียก Gemini สกัด CV ซ้ำ

สิ่งที่ทดลองคือ **weighted skill-presence coverage** ไม่ใช่ proficiency alignment
หรือผล RAG/Roadmap ฉบับสมบูรณ์ สูตรคัด skills และจำนวนคะแนนสำหรับใช้งานจริงยังรอเลือก
หลังเทียบผล ส่วน Backend API/หน้าเว็บยังใช้ logic เดิม

## 1. อัปโหลดและยืนยัน

1. เปิด Frontend และ Backend ตามปกติ
2. เข้า `/onboarding/cv` แล้วอัปโหลด Resume จริง
3. ตรวจแก้ข้อมูลที่สกัดได้ แล้วกด **ยืนยันและบันทึก** เพื่อให้ข้อมูลเข้า DB
4. จด `Profile ID` ที่แสดงหลังบันทึก เช่น `prf_...`

โปรไฟล์ต้องถูกบันทึกใน PostgreSQL เดียวกับที่ CLI ใช้ ถ้า Backend ตั้งเป็น file storage
CLI จะไม่พบโปรไฟล์นั้น การเปิดหน้าเว็บหรือสกัดเสร็จอย่างเดียว ยังไม่พอสำหรับการอ่านจาก DB

## 2. เลือกอาชีพที่จะเปรียบเทียบ

ใช้ `career_profile_id` ของอาชีพที่มี Market stats เช่นฐานข้อมูล development ชุดที่ตรวจ
เมื่อ 2026-10-18 มี `1 = Data Engineer` และ `2 = Backend Engineer`
หากเครื่องอื่นใช้ข้อมูลต่างชุด ให้ดู ID จริงด้วย SQL นี้:

```sql
SELECT p.career_profile_id, c.career_name, p.profile_name,
       s.analysis_date_basis, max(s.analysis_end_date) AS latest_window_end
FROM core.career_profiles p
JOIN core.careers c USING (career_id)
JOIN market.career_skill_stats s USING (career_profile_id)
WHERE p.is_active AND c.is_active
GROUP BY p.career_profile_id, c.career_name, p.profile_name, s.analysis_date_basis
ORDER BY p.career_profile_id, s.analysis_date_basis;
```

`first_seen_at` ใช้วันที่ pipeline พบงาน ส่วน `posted_at` ใช้วันที่ประกาศงาน
ทุกสูตรในรายงานเดียวกันใช้ snapshot และ date basis เดียวกัน อย่าเทียบตัวเลขคนละ cohort
ถ้าไม่มี Market stats สำหรับ date basis ที่เลือกจะได้ `N/A` พร้อม warning

## 3. รันผ่าน Docker จาก root ของ glow-job

คำสั่งนี้ใช้ image Backend เดิมและ mount โค้ดปัจจุบัน จึงไม่ต้อง rebuild Backend
เพื่อทดลอง CLI ตั้ง `$taskProfileId` เป็น Profile ID ของคุณก่อนรัน:

```powershell
$taskWorkspace = (Get-Location).Path
$taskProfileId = 'prf_ใส่ไอดีที่บันทึกจากหน้าเว็บ'
$taskCareerProfileId = 1
New-Item -ItemType Directory -Force -Path rag/data | Out-Null

docker compose run --rm --no-deps -T -e PYTHONDONTWRITEBYTECODE=1 `
  -v "${taskWorkspace}:/workspace:ro" `
  -v "${taskWorkspace}/rag/data:/output" -w /workspace backend `
  python -m scripts.rag.compare_match_policies `
  --career-profile-id $taskCareerProfileId --profile-id $taskProfileId `
  --date-basis first_seen_at `
  --output /output/scoring/my-resume-comparison.md `
  --json-output /output/scoring/my-resume-comparison.json
```

ผลลัพธ์อยู่ใน `rag/data/scoring/my-resume-comparison.md` และ `.json` บน Windows
รายงานเป็นไฟล์ local ที่ Git ignore ไว้ และข้อมูลสรุปจะแสดงใน terminal ด้วย

หากมี Python environment พร้อม dependencies ของ Backend อยู่แล้ว สามารถรันตรงจาก root:

```powershell
python -m scripts.rag.compare_match_policies --career-profile-id 1 --profile-id prf_ใส่ไอดีจริง --date-basis first_seen_at --output rag/data/scoring/my-resume-comparison.md --json-output rag/data/scoring/my-resume-comparison.json
```

CLI อ่าน DB แบบ read-only ไม่แก้โปรไฟล์/catalog/คะแนน ไม่สร้าง roadmap และไม่เรียก Gemini
ใช้ ID ของตัวเองสำหรับ Resume จริง; ถ้าต้องการลองคำสั่งก่อน ใช้
`prf_demo_student_data` กับ career profile `1` จาก [seed](../db/demo-user-seed.md) ได้

## 4. อ่านผลตรงไหน

เปิดหัวข้อ **ผลจากโปรไฟล์ที่บันทึกแล้ว** ใน Markdown หรือ `saved_profile` ใน JSON:

| สูตร | ตัวหาร |
|---|---|
| `existing_weighted_coverage` | Market skills ทั้งหมดที่มีน้ำหนักบวก ใน snapshot ที่เลือก |
| `top_weight_count_with_ties` | กลุ่มน้ำหนักสูงสุด ค่าเริ่มต้น 10 skills และเก็บ skills ที่เสมอกันตรงขอบ |
| `cumulative_weight_with_ties` | กลุ่ม skills ที่รวมกันถึงอย่างน้อย 80% ของน้ำหนักตลาด และเก็บกลุ่มที่เสมอกัน |

ทุกสูตรใช้ผลรวมน้ำหนักของ skills ที่ผู้ใช้มี หารด้วยผลรวมน้ำหนักของกลุ่มที่เลือก
จึงไม่ได้หารจากจำนวน skills ธรรมดา ช่อง “พบ skills / skills ในตัวหาร” ช่วยตรวจประกอบ
แต่ไม่ใช่สูตรคำนวณเปอร์เซ็นต์โดยตรง

- นับเฉพาะ canonical skill IDs ที่ matched และ user-confirmed
- Unresolved skills แสดงจำนวนแยก ไม่เดา ID ให้และไม่เพิ่มเข้า numerator
- Skills ที่มีแต่ไม่อยู่ใน Market กลุ่มน้ำหนักบวกจะแสดงจำนวนแยก
- ระดับ `unknown` ไม่ลดคะแนนการมี skill; รายงานนี้ยังไม่วัด proficiency gap
- ดูน้ำหนักตลาดที่เก็บไว้ควบคู่กับคะแนน สูตรกรองตัวหารอาจได้ 100% ทั้งที่ยังขาด skills นอกกลุ่ม
- ตัวอย่างสมมติ 6 แบบยังอยู่ในหัวข้อแยก ไม่ใช่คะแนนจาก Resume ของคุณ
- รายงานไม่คัดลอกชื่อบุคคล, Profile ID, ข้อความ CV หรือ evidence

Baseline ในรายงานคำนวณสูตรเดิมใหม่บน cohort เดียวกับสูตรทดลอง ไม่รับรองว่าตัวเลขจะตรง
กับ UI ปัจจุบัน: query ของ API เดิมเลือก window ล่าสุดแต่ยังไม่กรอง `analysis_date_basis`
อย่างชัดเจน งานนี้ไม่ได้แก้ query/API นั้น การเทียบสูตรให้ใช้ทั้งสามคอลัมน์ในรายงานเดียวกัน

## 5. ถ้ามี Context JSON อยู่แล้ว

ไฟล์ที่ export จาก `preview_context --profile-id ...` จะมี user อยู่ด้วย
คำสั่งเปรียบเทียบจะใช้ user ในไฟล์โดยอัตโนมัติ ไม่ต้องและไม่สามารถส่ง `--profile-id` ซ้ำ:

```powershell
python -m scripts.rag.compare_match_policies --input rag/data/inputs/my-inputs.json --output rag/data/scoring/my-resume-comparison.md
```

ไฟล์ preview อาจมี evidence/บริบทส่วนตัวมากกว่ารายงานคะแนน ให้เก็บ local ตามเดิม
หากใช้ input ที่ไม่มี user จะได้เฉพาะผลตัวอย่างสมมติ ไม่ได้สร้างโปรไฟล์จริงให้เอง
