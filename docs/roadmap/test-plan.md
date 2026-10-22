# Roadmap: แผนการทดสอบ

ทดสอบเรียงจากไม่มีค่าใช้จ่ายไปหามีค่าใช้จ่าย ชั้น 1–4 ไม่เรียก AI จริง สถานะในตารางอัปเดตเมื่อ 2026-10-19

| ชั้น | ทดสอบอะไร | ค่าใช้จ่าย | สถานะ |
|---|---|---|---|
| 1 | Unit: logic ของ AI core | ฟรี | ✅ ผ่าน 24 ข้อ |
| 2 | API กับ repository ปลอม | ฟรี | ✅ ผ่าน 7 ข้อ |
| 3 | API + SQL กับ PostgreSQL จริง (DB ชั่วคราว) | ฟรี | ✅ ผ่าน 3 ข้อ |
| 4 | Docker image + HTTP end-to-end | ฟรี | ✅ ผ่าน |
| 5 | DB ทีมที่มีข้อมูล market/knowledge จริง | RAG อาจเรียก Gemini | ⚠️ ตรวจแบบอ่านอย่างเดียวแล้ว; ยังไม่ได้เรียก API สด |
| 6 | Gemini จริง (Google AI API) | ประมาณ $0.02–0.04 ต่อครั้งที่ราคาโปรโมชัน | ⏳ ยังไม่ได้เรียก |
| 7 | Claude บน Bedrock (ตัวเลือกสำรอง) | ตามราคา AWS | ⏳ รอเลือก region |
| 8 | Frontend integration | ฟรีเมื่อใช้ fixture กับ mock | ⏳ รอ FE |

## 1–2. Unit และ API (ทุกครั้งที่แก้โค้ด)

```cmd
cd backend
.venv\Scripts\python -m pytest tests/test_roadmap_core.py tests/test_roadmap_api.py -q
```

ครอบคลุม:
- งบเวลาจาก goal
- การลดขนาด context
- กฎของ validator (citation ผิด, foundation กลายเป็นบทเรียน, skill นอก context, cycle, เกินงบ, key ซ้ำ)
- การ repair 1 ครั้ง และการบันทึกค่าใช้จ่ายเมื่อล้มเหลว
- schema ของ structured output
- รูปแบบ request ที่ส่งไป Gemini (thinking level, structured JSON)
- refusal
- flow ของ API, การ reuse, การกันคนอื่นเข้าถึง, ลิมิตรายวันและงบรายเดือน

## 3. SQL กับ PostgreSQL จริง (ใช้ DB ชั่วคราวเท่านั้น)

Test นี้เขียนข้อมูลลง DB ห้ามชี้ไปที่ DB ของทีม

```cmd
docker run -d --rm --name glowjob-roadmap-test -e POSTGRES_DB=glowjob -e POSTGRES_USER=glowjob -e POSTGRES_PASSWORD=roadmap-test -p 55432:5432 pgvector/pgvector:0.8.7-pg16-bookworm
```

Apply migration 001–016 ด้วย psql ทีละไฟล์ตามลำดับชื่อไฟล์ เพราะ runner ติดปัญหา `009` (ดูหัวข้อ "ปัญหาที่พบ") จากนั้นรัน:

```cmd
set ROADMAP_TEST_DATABASE=localhost:55432:glowjob:glowjob:roadmap-test
.venv\Scripts\python -m pytest tests/test_roadmap_db.py -q
docker stop glowjob-roadmap-test
```

ครอบคลุม:
- PUT/GET goal และการ update goal เดิม
- สร้างแผน, version 1 → 2 (แผนเดิมเปลี่ยนเป็น `replaced`), reuse
- `roadmap_steps`/`tasks` มี step_key และ citations
- ติ๊ก task แล้ว `user_task_progress` และ `user_roadmap_progress` ถูกอัปเดต
- `system.ai_runs` บันทึก token/cost ถูกต้อง และลิมิตทำงานจาก DB จริง
- session อื่นถูกปฏิเสธ

## 4. Docker image + HTTP

```cmd
docker build -f backend/Dockerfile -t glowjob-backend .
```

แล้วรันด้วย `ROADMAP_CONTEXT_FIXTURE=/app/ai/roadmap/fixtures/agent-context-demo-student.json` ต่อกับ DB ชั่วคราว และไล่ทดสอบตามลำดับ:

1. `GET /api/health`
2. `GET .../goal` → `null`
3. `POST .../roadmaps` → `GOAL_NOT_FOUND`
4. `PUT .../goal`
5. `POST .../roadmaps` → poll job → `succeeded`
6. `GET .../roadmaps/current`
7. `PUT .../tasks/{id}` → progress เพิ่ม
8. ใช้ session อื่น → `PROFILE_NOT_FOUND`

## 5. DB ทีม + knowledge จริง (ยังไม่ได้ทดสอบ)

เป็นชั้นที่ทดสอบการเลือก gap, ค้นเอกสาร, ตรวจหลักฐาน และประกอบ Agent Context สำหรับผู้ใช้จริง ซึ่งชั้นก่อนหน้าใช้ fixture แทน

1. Apply migration 016 กับ DB ทีม
2. ตั้ง `GEMINI_API_KEY` ให้ RAG และ**ไม่ตั้ง** `ROADMAP_CONTEXT_FIXTURE`; ตรวจว่า market และเอกสารของ skill gap มีใน DB
3. ใช้ `prf_demo_student_data` คู่กับ `X-Session-Id: glowjob-demo-v1:student-data` เรียก goal → roadmap
4. ตรวจผล:
   - job สำเร็จ ไม่ใช่ `KNOWLEDGE_NOT_READY` / `ROADMAP_CONTEXT_FAILED`
   - skills ใน roadmap มาจาก core gap ที่จัดอันดับของผู้ใช้คนนั้น
   - ทุก citation มี URL
   - เรียกซ้ำแล้วตรวจว่า `reused: true` เฉพาะเมื่อ compact context เหมือนเดิม; บันทึกกรณีผล review เปลี่ยน
5. ลอง profile ที่ระดับ skill เป็น unknown (`prf_demo_unknown_data`) และ profile ที่ยังไม่มี goal

การค้นและตรวจหลักฐานยังเรียก Gemini ก่อนตรวจว่า roadmap เดิม reuse ได้ แม้เลือก `mock` เป็น Roadmap provider; ยังต้องเพิ่ม cache และบันทึก usage/cost ของ RAG ก่อนใช้กับผู้ใช้จำนวนมาก

ผลตรวจล่าสุด: Roadmap core + API tests ผ่าน 31 ข้อใน Docker; Agent Context v0.5 ของผู้ใช้จริงที่มี 4 โปรเจกต์และ 4 selected skills สร้าง roadmap ด้วย mock แบบอ่านไฟล์อย่างเดียวได้ 5 nodes และ 6 citations. DB มี market skills 209 รายการ, ranked gaps 16 รายการ และ 11 รายการมี embeddings. Frontend build และ lint ผ่าน. การเรียก API สดสำหรับผู้ใช้จริงยังไม่ได้ทำ เพราะจะส่งข้อมูลโปรไฟล์ไป Gemini และเขียน roadmap ลง DB; ระบบตรวจอนุมัติอัตโนมัติปฏิเสธการทดสอบครั้งนั้น และต้องรอผู้ใช้อนุญาตก่อน.

## 6. Gemini จริง (ต้องมี `GEMINI_API_KEY` และตั้งใจเรียกโมเดลแบบคิดค่าใช้จ่าย)

```cmd
set PYTHONPATH=.;data-pipeline
backend\.venv\Scripts\python -m ai.roadmap.cli --context ai/roadmap/fixtures/agent-context-demo-student.json --output rag/data/roadmap-gemini.json --provider gemini --allow-spend --save-draft
```

ทำ 2–3 ครั้ง (demo student และ unknown-level) แล้วบันทึกตัวเลขเหล่านี้:
- `usage` (token จริง) และ `estimated_cost_usd` เพื่อเทียบกับราคา Gemini ปัจจุบัน
- `validation_warnings` ควรมีน้อย ถ้ามี citation ถูกลบบ่อยให้ปรับ prompt
- เวลาที่ใช้ ใช้ตั้งข้อความ loading ของ FE

ให้คนอ่าน `roadmap-gemini.json` ตาม checklist:
- [ ] เป็นภาษาอังกฤษทั้งหมด และไม่มีข้อความไทยหลุดมา
- [ ] ชั่วโมงรวมอยู่ในงบ (`summary.estimatedHours` เทียบกับ `budgetHours`)
- [ ] skill ที่ไม่คุ้มเวลาถูก defer พร้อมเหตุผลที่อ่านเข้าใจ
- [ ] foundation เป็นแค่ check หรือคำถาม ไม่ใช่บทเรียน (Docker เป็น check, PostgreSQL ไม่กลายเป็นบทเรียน)
- [ ] ไม่มีคำว่า "you lack" และไม่มี % ความพร้อมหรือการรับประกันงาน
- [ ] task ประเภท learn มี citation ที่ตรงกับเนื้อหาจริงเมื่อเปิดลิงก์ดู
- [ ] next action ทำได้จริงภายในสัปดาห์แรก
- [ ] ถ้าลด effort เป็น `low` คุณภาพยังพอไหม (ประหยัดขึ้น) แต่ไม่ต้องลอง `high` ถ้า `medium` ผ่านแล้ว

## 7. Bedrock (ตัวเลือกสำรอง หลังเลือก region)

1. ตั้ง `ROADMAP_PROVIDER=bedrock`, `ROADMAP_AWS_REGION` และราคา Bedrock
2. รัน CLI แบบเดียวกับชั้น 6 แต่ใช้ `--provider bedrock --aws-region <region>`
3. เทียบ token ใน output กับ AWS Billing/Cost Explorer หลัง 24 ชม.
4. ทดสอบผ่าน API บน AWS: role ของ container เรียก Bedrock ได้โดยไม่ต้องมี key ใน `.env`
5. ตั้ง `ROADMAP_MONTHLY_BUDGET_USD` ต่ำ ๆ ชั่วคราว (เช่น 0.01) แล้วตรวจว่าได้ `ROADMAP_BUDGET_REACHED`

## 8. Frontend integration (การเชื่อม API เบื้องต้นเสร็จแล้ว; ยังต้องทดสอบใน browser กับข้อมูลจริง)

หน้า `/onboarding` ผูก goal กับ `careerProfileId`, เริ่ม roadmap job และ poll แล้ว หน้า `/app/roadmap` อ่านแผนจริงและบันทึก checklist/step ได้; ตรวจต่อกับทีม FE ตาม [frontend-handoff.md](frontend-handoff.md):

- [ ] ฟอร์ม goal: validation (targetDate ต้องเป็นอนาคต), บันทึกแล้วโหลดค่าเดิมกลับมาได้
- [ ] ยังไม่มี roadmap → empty state → กดสร้าง → loading → แสดงแผน
- [ ] ตรวจการกดสร้างซ้ำและ `reused`; ยังไม่มีปุ่ม Regenerate ใน UI
- [ ] Canvas: node และเส้นถูกต้องตาม `layer/order/edges` และ goal node อยู่ท้าย
- [ ] ติ๊ก checklist แล้ว refresh หน้าค่ายังอยู่ และ % กับสถานะ node เปลี่ยนตาม
- [ ] error ทุกแบบในโฟลเดอร์ `examples/` แสดงข้อความถูก; UI ตอนนี้แสดงข้อความจาก API และให้ลองใหม่เอง ยังไม่ได้แยก `retryable`
- [ ] ไม่มีคำว่า "On track" หรือ % ที่สื่อว่าเป็นความพร้อมสมัครงาน
- [ ] เปิดจากเบราว์เซอร์อื่น (session ต่างกัน) แล้วเห็นแผนของคนอื่นไม่ได้
- [ ] หน้าจอมือถือ: panel รายละเอียดและ citation อ่านได้

## ปัญหาที่พบระหว่างทดสอบ

- **Migration `009_anonymous_resume_profiles.sql` (ของเดิม) มี `;` ในคอมเมนต์** runner
  (`scripts.database.migrate`) ตัด statement ด้วย `;` จึง apply บน DB ใหม่ไม่ผ่าน
  (`syntax error at or near "the"`) DB ที่ apply ไปแล้วไม่ได้รับผลกระทบ แต่การตั้ง DB ใหม่จะติด
  ควรแก้ที่ runner หรือแก้คอมเมนต์ตามที่ทีมตกลง (ไฟล์นี้ apply ไปแล้ว จึงยังไม่ได้แก้)
- Migration 016 มีปัญหาเดียวกันในตอนแรก แก้แล้ว และทดสอบแล้วว่าผ่านทั้งแบบ psql และแบบที่ runner ตัด statement
