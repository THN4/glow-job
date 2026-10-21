# Seed ผู้ใช้ตัวอย่างสำหรับพัฒนา

ใช้ [seed_demo_users.sql](../../scripts/database/seeds/seed_demo_users.sql) เพื่อเพิ่มผู้ใช้สมมติ 3 คนพร้อมโปรไฟล์ที่ยืนยันแล้ว โดยไม่ต้องอัปโหลด CV หรือเรียก Gemini เหมาะสำหรับพัฒนา Career Match, RAG Context และส่วนที่ต้องอ่านข้อมูลผู้ใช้จากฐานข้อมูล

นี่เป็นข้อมูลสำหรับ development ไม่ใช่ข้อมูลบุคคลจริง ไม่มีการสร้างระบบ login และยังใช้ anonymous identity เหมือนระบบปัจจุบัน

## 1. สิ่งที่ต้องมี

- PostgreSQL ที่มี schema ปัจจุบันแล้ว: migrations `001`–`009` ครอบคลุมตารางที่ seed ใช้
- หากเคย restore full dump ที่มี schema เหล่านี้แล้ว ไม่ต้อง restore ใหม่เพื่อเพิ่มผู้ใช้ตัวอย่าง
- หาก schema ยังไม่ครบ ให้ใช้ migration runner เดิมจาก `data-pipeline/` ตาม [คู่มือ migrations](../../migrations/README.md) ก่อน ไม่ต้องสร้าง migration ใหม่สำหรับ seed
- ควรมี Skill Catalog และ Career Profiles จาก Market อยู่ก่อน หากต้องการตัวอย่างที่เชื่อมกับ catalog ได้ทันที

Seed ไม่ต้องใช้ API key หรือ Python runtime และไม่ต้องมี migration ของ Knowledge/skill dependencies เพื่อเพิ่มผู้ใช้

## 2. รันอย่างไร

### วิธี A: pgAdmin

1. เชื่อมต่อฐานข้อมูล development เดิม
2. เปิด Query Tool ในฐานข้อมูลนั้น
3. เปิดไฟล์ `scripts/database/seeds/seed_demo_users.sql` จาก repo หลัก
4. รันทั้งไฟล์ รวม `BEGIN` และ `COMMIT`
5. ดูผลสรุปท้ายไฟล์: `seed_action`, `user_id`, `profile_id`, `demo_session_id`, จำนวน skill ที่ matched/unresolved และ `career_profile_id`

### วิธี B: PowerShell กับ Docker Compose

เมื่อ PostgreSQL ของ Compose เปิดอยู่ ให้รันจาก root ของ `glow-job/`:

```powershell
Get-Content -Raw -Encoding UTF8 scripts/database/seeds/seed_demo_users.sql |
    docker compose exec -T postgres sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
```

คำสั่งใช้ database/user ของ container ที่เปิดอยู่ จึงไม่ต้องใส่รหัสผ่านลงในคำสั่ง และไม่ต้องเปลี่ยน `DB_HOST` ไปมา

คำสั่งด้านบนใช้พอร์ต PostgreSQL ภายในค่าเริ่มต้น `5432` ถ้าแก้ `DB_CONTAINER_PORT`
ให้เพิ่ม `-p <ค่าของ DB_CONTAINER_PORT>` หลัง `psql` ในคำสั่ง ไม่ใช้ `DB_PORT`
ซึ่งเป็นพอร์ตฝั่ง Windows

SQL ทำงานใน transaction เดียว ถ้ารันใน pgAdmin แล้วเกิด error ให้สั่ง `ROLLBACK;` ก่อนแก้สาเหตุและรันใหม่ หาก reserved profile ID ถูกใช้โดยบัญชีอื่น seed จะหยุดเพื่อป้องกันการเขียนทับ

## 3. ผู้ใช้ที่ได้

| Profile ID | ตัวอย่าง | Skill / ระดับ | เป้าหมายและเวลาเรียน |
|---|---|---|---|
| `prf_demo_student_data` | นักศึกษาที่เคยทำ Data Pipeline | Python, SQL, Pandas, Git ระดับ beginner; Docker ระดับ unknown; มี `Demo Unmapped Skill` สำหรับลองกรณี unresolved | Data Engineer, 3 เดือน, 2–5 ชั่วโมง/สัปดาห์, hands-on projects |
| `prf_demo_backend` | Backend Developer ประสบการณ์ 2 ปี | JavaScript, TypeScript, Node.js, PostgreSQL, SQL, Docker ระดับ intermediate; Git advanced | Backend Engineer, วันสิ้นสุดอีก 180 วัน, 5–10 ชั่วโมง/สัปดาห์ ระบุจริง 8 ชั่วโมง, reading/articles |
| `prf_demo_unknown_data` | ผู้เปลี่ยนสายงานจาก Operations | Python, SQL, Postgres, Excel, Power BI; ระดับทุกตัวเป็น unknown | Data Engineer, ไม่กำหนด deadline, 10+ ชั่วโมง/สัปดาห์, structured courses |

วันที่เป้าหมายคำนวณจากวันที่สร้างผู้ใช้ครั้งแรก การรันซ้ำไม่เลื่อนวันสิ้นสุดออกไป

ทุกคนมีการศึกษา โปรเจกต์ และ certification/workshop/activity สมมติ ผู้ใช้สองคนหลังมี work experience เพิ่มด้วย

## 4. เขียนข้อมูลที่ไหน

| ตาราง | สิ่งที่เพิ่ม |
|---|---|
| `app.users` | Anonymous identity โดยใช้ subject ขึ้นต้น `glowjob-demo-v1:` |
| `app.user_profiles` | ข้อมูลพื้นฐาน, stable `profile_id` และ `profile_data` ตามโครง `CvProfile` เดิม |
| `app.user_educations` | การศึกษาสมมติ |
| `app.user_experiences` | โปรเจกต์ และประสบการณ์ทำงานสำหรับบางคน |
| `app.user_skills` | ชื่อ skill/tool, canonical skill ID เมื่อจับคู่ได้, ระดับ และสถานะยืนยัน |
| `app.user_skill_evidence` | หลักฐานจาก project/experience และลิงก์ไปแถวประสบการณ์นั้น |
| `app.user_certifications` | Certification/workshop/activity สมมติ |
| `app.user_career_goals` | เป้าหมาย, deadline, เวลาเรียน และวิธีเรียน |

แถวข้อมูลที่รองรับ `source` ใช้ `seed_demo_users_v1` เพื่อแยกจาก extraction จริง ส่วน `profile_data` ใช้ `source=user` ตาม enum ของ API และยืนยันรายการไว้แล้ว

ไม่สร้าง resume file/extraction job, roadmap, คะแนน หรือข้อมูลใน `core.*`, `market.*`, `knowledge.*` การเติม user seed ไม่แทนที่การเตรียมข้อมูล Market/Knowledge

## 5. การจับคู่กับ catalog

- ค้น canonical name ก่อน แล้วค้น alias ใน `core.skill_aliases` โดยไม่แยกตัวพิมพ์ใหญ่/เล็ก และยุบช่องว่าง
- ใช้ ID ที่อ่านจากฐานข้อมูล ไม่สมมติว่า Python หรือ career ใดต้องเป็น ID เลขใด
- ตัวอย่าง `Postgres` จะชี้ไป PostgreSQL เมื่อ catalog มี alias นี้จริง
- ถ้าไม่มีชื่อ/alias หรือผลไม่ชัดเจน จะเก็บ `skill_id=NULL`, `match_status=needs_review`; ไม่สร้าง skill หรือ alias ใหม่
- ระดับ `unknown` คงไว้ตามเดิม ไม่เดาความชำนาญจากประสบการณ์
- เป้าหมายค้น active career profile ด้วย slug `data_engineer_general` หรือ `backend_engineer_general` ถ้าไม่พบจะเก็บชื่อเป้าหมายไว้และปล่อย catalog IDs เป็น null

SQL นี้ใช้การจับคู่ชื่อ/aliasแบบจำกัดสำหรับ fixture ภาษาอังกฤษ ไม่ใช่ตัวแทน normalization ทั้งหมดของ extraction pipeline ถ้าไม่มี catalog เลย seed ยังรันได้ แต่ skills จะ unresolved และเป้าหมายยังไม่ผูก career profile จึงยังใช้คำนวณกับ Market ไม่ได้ครบ

`Demo Unmapped Skill` ตั้งใจให้ไม่มีคู่ใน catalog หาก catalog ของทีมไม่ได้เพิ่มชื่อนี้ไว้เอง

## 6. รันซ้ำแล้วเกิดอะไร

รอบแรกผลสรุปจะแสดง `created` รอบต่อไปจะแสดง `kept_existing` สำหรับบัญชีที่มีแล้ว โดยอ้างอิง anonymous subject เดิม

- เพิ่มเฉพาะบัญชีตัวอย่างที่ยังไม่มี
- ไม่สร้าง child rows ซ้ำสำหรับบัญชีเดิม
- ไม่ทับชื่อ, skills, preferences, goal หรือ progress ที่ทีมปรับไว้
- ไม่แก้บัญชีอื่นและไม่ reset ID sequence
- ถ้าลบเฉพาะ child rows ของบัญชีเดิม การรันซ้ำจะไม่เติมกลับให้อัตโนมัติ
- ถ้าเพิ่ม catalog ภายหลัง การรัน seed ซ้ำจะไม่ remap บัญชีเดิม ให้ใช้ flow แก้ไข/ยืนยันโปรไฟล์ตามปกติ จึงควรเตรียม catalog ก่อน seed เมื่อต้องการตัวอย่างที่ matched

## 7. ดูข้อมูลหลังรัน

รายชื่อผู้ใช้ตัวอย่างและเป้าหมาย:

```sql
SELECT u.user_id, p.profile_id, p.display_name,
       u.auth_subject AS demo_session_id,
       g.target_role_title, g.career_profile_id, g.target_date,
       g.weekly_availability, g.available_hours_per_week
FROM app.users u
JOIN app.user_profiles p USING (user_id)
LEFT JOIN app.user_career_goals g ON g.user_id = u.user_id AND g.is_primary
WHERE u.auth_provider = 'anonymous'
  AND u.auth_subject IN (
      'glowjob-demo-v1:student-data',
      'glowjob-demo-v1:backend',
      'glowjob-demo-v1:unknown-data'
  )
ORDER BY p.profile_id;
```

ดู skills พร้อม canonical name และจำนวน evidence ของนักศึกษาตัวอย่าง:

```sql
SELECT s.raw_skill_name, c.skill_name AS canonical_name, s.skill_id,
       s.match_status, s.proficiency_level, s.proficiency_basis,
       (SELECT count(*) FROM app.user_skill_evidence e
        WHERE e.user_skill_id = s.user_skill_id) AS evidence_count
FROM app.user_profiles p
JOIN app.user_skills s USING (user_id)
LEFT JOIN core.skills c USING (skill_id)
WHERE p.profile_id = 'prf_demo_student_data'
ORDER BY s.raw_skill_name;
```

## 8. นำไปพัฒนาส่วนอื่น

- Backend ที่ตั้งให้ใช้ PostgreSQL แล้วสามารถอ่าน `GET /api/profiles/prf_demo_student_data` ได้ตาม endpoint เดิม; ถ้ายังใช้ file storage จะไม่เห็นแถวใน DB
- Career Match ใช้ profile ID และส่ง `X-Session-Id` ให้ตรงกับ `demo_session_id` ในผลสรุป เช่น `glowjob-demo-v1:student-data` พร้อม career profile ID ที่มี Market stats
- RAG preview ใช้ `--profile-id prf_demo_student_data` ร่วมกับ `--career-profile-id` ที่อ่านได้จาก goal และมี Market stats ตาม [คู่มือ Context](../rag/context-data-guide.md)
- หน้าเว็บไม่ได้เลือก seed profile ให้อัตโนมัติ งานนี้เตรียมข้อมูล DB ให้ส่วนอื่นนำไปใช้ ไม่ได้เพิ่ม UI สำหรับสลับผู้ใช้

ใช้ผล query จริงเป็นหลัก: IDs และจำนวน matched อาจต่างกันในแต่ละเครื่องตาม catalog ที่ restore ไว้
