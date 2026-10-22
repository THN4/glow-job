# Roadmap: แผนการทดสอบ

ทดสอบเรียงจากไม่มีค่าใช้จ่ายไปหามีค่าใช้จ่าย ชั้น 1–4 ไม่เรียก AI จริง สถานะในตารางอัปเดตเมื่อ 2026-10-19

| ชั้น | ทดสอบอะไร | ค่าใช้จ่าย | สถานะ |
|---|---|---|---|
| 1 | Unit: logic ของ AI core | ฟรี | ✅ ผ่าน 18 ข้อ |
| 2 | API กับ repository ปลอม | ฟรี | ✅ ผ่าน 6 ข้อ |
| 3 | API + SQL กับ PostgreSQL จริง (DB ชั่วคราว) | ฟรี | ✅ ผ่าน 3 ข้อ |
| 4 | Docker image + HTTP end-to-end | ฟรี | ✅ ผ่าน |
| 5 | DB ทีมที่มีข้อมูล market/knowledge จริง | ฟรี | ⏳ รอ DB และไฟล์ knowledge |
| 6 | Claude จริง (Anthropic API) | ~$0.1–0.25 ต่อครั้ง | ⏳ รอการอนุมัติ |
| 7 | Bedrock | ตามราคา AWS | ⏳ รอเลือก region |
| 8 | Frontend integration | ฟรี (mock) | ⏳ รอ FE |

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
- รูปแบบ request ที่ส่งไป Claude (adaptive thinking, effort, JSON schema)
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

เป็นชั้นเดียวที่ทดสอบ `build_context` (ประกอบ Agent Context จาก DB จริง) ซึ่งชั้นก่อนหน้าใช้ fixture แทน

1. Apply migration 016 กับ DB ทีม
2. วางไฟล์ `rag/data/knowledge/career-profile-1.json` และ**ไม่ตั้ง** `ROADMAP_CONTEXT_FIXTURE`
3. ใช้ `prf_demo_student_data` คู่กับ `X-Session-Id: glowjob-demo-v1:student-data` เรียก goal → roadmap
4. ตรวจผล:
   - job สำเร็จ ไม่ใช่ `KNOWLEDGE_NOT_READY` / `ROADMAP_CONTEXT_FAILED`
   - skills ใน roadmap ตรงกับ main skills ในไฟล์ knowledge
   - ทุก citation มี URL
   - เรียกซ้ำแล้วได้ `reused: true`
5. ลอง profile ที่ระดับ skill เป็น unknown (`prf_demo_unknown_data`) และ profile ที่ยังไม่มี goal

## 6. Claude จริง (ต้องอนุมัติก่อน)

```cmd
set PYTHONPATH=.;data-pipeline
set ANTHROPIC_API_KEY=...
backend\.venv\Scripts\python -m ai.roadmap.cli --context ai/roadmap/fixtures/agent-context-demo-student.json --output rag/data/roadmap-claude.json --provider anthropic --allow-spend --save-draft
```

ทำ 2–3 ครั้ง (demo student และ unknown-level) แล้วบันทึกตัวเลขเหล่านี้:
- `usage` (token จริง) และ `estimated_cost_usd` เพื่อยืนยันประมาณการ $0.12–0.25
- `validation_warnings` ควรมีน้อย ถ้ามี citation ถูกลบบ่อยให้ปรับ prompt
- เวลาที่ใช้ ใช้ตั้งข้อความ loading ของ FE

ให้คนอ่าน `roadmap-claude.json` ตาม checklist:
- [ ] เป็นภาษาอังกฤษทั้งหมด และไม่มีข้อความไทยหลุดมา
- [ ] ชั่วโมงรวมอยู่ในงบ (`summary.estimatedHours` เทียบกับ `budgetHours`)
- [ ] skill ที่ไม่คุ้มเวลาถูก defer พร้อมเหตุผลที่อ่านเข้าใจ
- [ ] foundation เป็นแค่ check หรือคำถาม ไม่ใช่บทเรียน (Docker เป็น check, PostgreSQL ไม่กลายเป็นบทเรียน)
- [ ] ไม่มีคำว่า "you lack" และไม่มี % ความพร้อมหรือการรับประกันงาน
- [ ] task ประเภท learn มี citation ที่ตรงกับเนื้อหาจริงเมื่อเปิดลิงก์ดู
- [ ] next action ทำได้จริงภายในสัปดาห์แรก
- [ ] ถ้าลด effort เป็น `low` คุณภาพยังพอไหม (ประหยัดขึ้น) แต่ไม่ต้องลอง `high` ถ้า `medium` ผ่านแล้ว

## 7. Bedrock (หลังเลือก region)

1. ตั้ง `ROADMAP_PROVIDER=bedrock`, `ROADMAP_AWS_REGION` และราคา Bedrock
2. รัน CLI แบบเดียวกับชั้น 6 แต่ใช้ `--provider bedrock --aws-region <region>`
3. เทียบ token ใน output กับ AWS Billing/Cost Explorer หลัง 24 ชม.
4. ทดสอบผ่าน API บน AWS: role ของ container เรียก Bedrock ได้โดยไม่ต้องมี key ใน `.env`
5. ตั้ง `ROADMAP_MONTHLY_BUDGET_USD` ต่ำ ๆ ชั่วคราว (เช่น 0.01) แล้วตรวจว่าได้ `ROADMAP_BUDGET_REACHED`

## 8. Frontend integration (ทำร่วมกับ FE)

ใช้ mock provider ทั้งหมด และไล่ตาม [frontend-handoff.md](frontend-handoff.md):

- [ ] ฟอร์ม goal: validation (targetDate ต้องเป็นอนาคต), บันทึกแล้วโหลดค่าเดิมกลับมาได้
- [ ] ยังไม่มี roadmap → empty state → กดสร้าง → loading → แสดงแผน
- [ ] กดสร้างซ้ำได้ `reused` เร็ว / ปุ่ม Regenerate มี dialog ยืนยัน
- [ ] Canvas: node และเส้นถูกต้องตาม `layer/order/edges` และ goal node อยู่ท้าย
- [ ] ติ๊ก checklist แล้ว refresh หน้าค่ายังอยู่ และ % กับสถานะ node เปลี่ยนตาม
- [ ] error ทุกแบบในโฟลเดอร์ `examples/` แสดงข้อความถูก และปุ่ม retry ขึ้นเฉพาะ `retryable`
- [ ] ไม่มีคำว่า "On track" หรือ % ที่สื่อว่าเป็นความพร้อมสมัครงาน
- [ ] เปิดจากเบราว์เซอร์อื่น (session ต่างกัน) แล้วเห็นแผนของคนอื่นไม่ได้
- [ ] หน้าจอมือถือ: panel รายละเอียดและ citation อ่านได้

## ปัญหาที่พบระหว่างทดสอบ

- **Migration `009_anonymous_resume_profiles.sql` (ของเดิม) มี `;` ในคอมเมนต์** runner
  (`scripts.database.migrate`) ตัด statement ด้วย `;` จึง apply บน DB ใหม่ไม่ผ่าน
  (`syntax error at or near "the"`) DB ที่ apply ไปแล้วไม่ได้รับผลกระทบ แต่การตั้ง DB ใหม่จะติด
  ควรแก้ที่ runner หรือแก้คอมเมนต์ตามที่ทีมตกลง (ไฟล์นี้ apply ไปแล้ว จึงยังไม่ได้แก้)
- Migration 016 มีปัญหาเดียวกันในตอนแรก แก้แล้ว และทดสอบแล้วว่าผ่านทั้งแบบ psql และแบบที่ runner ตัด statement
