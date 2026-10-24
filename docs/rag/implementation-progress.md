# RAG / Skill Context — สถานะการทำงาน

**อัปเดต:** 2026-10-18<br>
**ขอบเขต:** เตรียมข้อมูล/RAG/Agent Context และ contract ส่งต่อทีม AI/Backend ตาม [สเปก v0.3](skill-context-spec.md)

บันทึกด้านล่างเรียงตามช่วงที่ทำ สถานะปัจจุบันให้อ่านหัวข้อสุดท้ายและตารางช่วงถัดไป

## ช่วงที่ 1 — Input contracts, schema และผลทดลองคะแนน

สถานะ: ส่งตรวจได้แล้ว ยังไม่ใช่ RAG runtime หรือ Agent Context ฉบับสมบูรณ์

สิ่งที่ทำ:

1. แยก branch repo หลัก `feature/rag-skill-context` และ sub repo `feature/skill-dependencies` จากสถานะที่ไม่มีงาน sub repo ค้าง
2. เตรียม migration `014_create_skill_dependencies.sql` พร้อม constraint ป้องกัน self-link/edge ซ้ำ และบังคับ source/evidence สำหรับรายการที่ verified
3. ปรับ Knowledge/รวม DBML ให้ตรงกับ migration และแก้ mapping chunks เป็น many-to-many ตาม migration 013
4. เพิ่ม input models และ JSON schema ที่ตรวจ canonical IDs, unresolved skills, unknown proficiency, goal และ market cohort
5. เพิ่มตัวอ่าน PostgreSQL แบบ repeatable-read/read-only โดยเลือก window/date basis เดียวกัน และไม่สร้าง catalog/user skill/alias
6. เพิ่ม CLI preview กับ score experiment ที่ใช้โปรไฟล์สมมติ 6 แบบ และนโยบายตัวหาร 3 แบบ ไม่เปลี่ยน scoring API เดิม

ผลที่ตรวจได้:

- Read-only preview ของ Data Engineer: 209 skills จาก 45 งาน ช่วง 2026-04-08 ถึง 2026-10-08 โดยใช้ `first_seen_at`
- พบ 123 skills ที่มาจากงานเดียว และ 176 skills ที่ market target level ยังเป็น `unknown` จึงยังสรุป proficiency gap ให้ครบทุก skill ไม่ได้
- โปรไฟล์สมมติที่มี 10 skills น้ำหนักสูงสุด: สูตร coverage เดิม 28.91%, ตัวหารกลุ่ม 10 skills 100%, ตัวหารกลุ่มสะสมน้ำหนักตลาด 80% ได้ 36.08%
- ตัวหารกลุ่ม 10 skills เก็บน้ำหนักตลาดไว้ 28.91% ส่วนกลุ่มสะสม 80% ใช้ 92 skills จึงยังต้องตรวจว่าการกรองแบบใดสะท้อนเป้าหมายผลิตภัณฑ์
- การทดสอบ 18 ข้อผ่าน รวมอ่านข้อมูลจริงแยก date basis, อ่านโปรไฟล์ที่ยืนยันแล้ว และทดสอบ migration constraints ใน transaction ที่ rollback ทุกครั้ง
- ไม่มีการเรียก Gemini หรือเปลี่ยนข้อมูล/บันทึก migration ใน live DB จากงานช่วงนี้

ไฟล์สำหรับตรวจ:

- [รายงานเปรียบเทียบคะแนน](market-score-comparison.md)
- [คู่มือรันและขอบเขตการเชื่อมต่อ](context-data-guide.md)
- [Input JSON schema](context-inputs.schema.json)
- [Migration 014](../../data-pipeline/migrations/versions/014_create_skill_dependencies.sql)

## ประเด็นที่ต้องตรวจร่วมกันก่อนล็อกนโยบายคะแนน

ตามข้อสรุป R3 ต้องเห็นผลเปรียบเทียบก่อนเลือกสูตร/จำนวนคะแนน ตัวเลข 10 skills และ 80% เป็นพารามิเตอร์ทดลองเท่านั้น การกรองให้เหลือ 10 skills ทำให้ได้ 100% ทั้งที่ยังไม่ครอบคลุมน้ำหนักตลาดส่วนใหญ่ จึงยังไม่ควรนำตัวเลขนี้ไปแสดงเป็นความพร้อมทำงาน

ควรเปรียบเทียบกับ career profile อื่นและโปรไฟล์ที่ตรวจแล้วเพิ่ม รวมทั้งพิจารณาเกณฑ์ความถี่/requirement และ reliability ก่อนอนุมัตินโยบายจริง การขาด target level ต้องยังเป็น unknown ไม่เดาระดับให้ครบเพื่อคำนวณคะแนน

## ช่วงถัดไป

งานเสริมสำหรับข้อมูลผู้ใช้ทดสอบ: เพิ่ม SQL [demo user seed](../db/demo-user-seed.md)
สำหรับ anonymous profiles สมมติ 3 แบบ พร้อม goals, skills และ evidence โดยอ่าน ID
จาก catalog เดิม ไม่ต้องเรียก extraction/LLM และรันซ้ำแล้วเก็บบัญชีเดิมไว้
ตรวจเทียบกับ migrations 001–009 และโครง CvProfile แล้ว และ execute SQL seed
ลงฐานข้อมูล development สำเร็จเมื่อ 2026-10-18 (รายละเอียดด้านล่าง)
งานนี้ไม่เปลี่ยนสถานะ RAG runtime หรือการตัดสินนโยบายคะแนน

อัปเดต 2026-10-18: หลังลองใหม่ Docker/PostgreSQL พร้อมและรัน seed สำเร็จ

- เพิ่มผู้ใช้ตัวอย่าง 3 คน: `prf_demo_student_data` (user 9),
  `prf_demo_backend` (user 10), `prf_demo_unknown_data` (user 11)
- เพิ่ม 18 user skills (matched 17 / needs_review 1), 5 experiences/projects,
  23 skill evidence และ 3 career goals
- รายการรอตรวจเพียงรายการเดียวคือ `Demo Unmapped Skill` ที่ตั้งใจใส่ไว้
- รัน SQL ซ้ำแล้วทุกบัญชีเป็น `kept_existing` และทุก INSERT ลงตารางจริงเป็น 0
- ตรวจด้วย SQL หลัง commit: ผู้ใช้ทั้งหมดเพิ่มจาก 1 เป็น 4 คน และ catalog
  ยังมี 539 skills เท่าเดิม ระดับของ career changer ทั้ง 5 skills ยังเป็น unknown
- GET `/api/profiles/{profile_id}` ของ Backend อ่านโปรไฟล์ตัวอย่างทั้ง 3 คนได้

การตรวจนี้ครอบคลุมการ execute, รันซ้ำ และอ่านข้อมูลจริง ไม่ใช่ผล unit test
เพิ่มเติมหรือการยืนยันว่า RAG runtime เสร็จแล้ว

### ทดลองสูตรคะแนนกับโปรไฟล์ที่บันทึกแล้ว (2026-10-18)

- เพิ่ม `--profile-id` ใน `compare_match_policies` เพื่ออ่านโปรไฟล์ที่ยืนยันจาก DB
  และรองรับ Context JSON ที่มี user อยู่แล้ว โดยแยก `saved_profile` จากตัวอย่างสมมติ
- ผลมีคะแนน 3 สูตร, จำนวน canonical/unresolved/unknown และ skills นอก cohort;
  ไม่คัดลอกชื่อบุคคล, Profile ID, ข้อความ CV หรือ evidence ลงรายงาน
- ทดสอบ unit/CLI ผ่าน 19 ข้อ; อีก 7 ข้อที่ต้อง opt-in PostgreSQL ถูก skip
  รอบนี้ไม่ได้ apply migration หรือเปลี่ยน API/UI
- รัน CLI อ่าน DB จริงกับ `prf_demo_student_data` สำเร็จ: สูตรเดิมบน snapshot
  first_seen_at ได้ 13.69%, กลุ่ม 10 skills ได้ 39.31%, สะสมน้ำหนัก 80% ได้ 17.09%
  ตัวเลขนี้เป็น seed fixture ไม่ใช่ผลจาก Resume จริงของผู้ใช้
- พบ query ของ API คะแนนเดิมยังไม่กรอง analysis_date_basis ชัดเจน จึงระบุว่า
  baseline ในรายงานเป็นการคำนวณใหม่บน cohort เดียวกัน ไม่รับรองตัวเลขตรงกับ UI
- [วิธีลอง Resume จริง](test-real-resume-scores.md): อัปโหลด/ยืนยันผ่านหน้าเว็บ
  แล้วใช้ Profile ID เรียก CLI; ยังไม่เลือกรูปแบบคะแนน production

| ช่วง | งาน | สถานะ |
|---|---|---|
| 2 | ตรวจ/ปรับตัวอย่างคะแนนและกำหนด eligibility/ranking policy | มีผลชุดแรกแล้ว รอเลือกหลังตรวจผล |
| 3 | Dependency จากเอกสารที่เตรียมไว้ + approve/reject + AI handoff | Apply 18 คู่ที่อนุมัติลง DB แล้ว; reject 5 / pending 0; อ่านกลับครบ 18 คู่ (ordering 1 / scoped Context 14 / related 3) |
| 4 | Embedding retrieval + Gemini text review + citations/coverage/budget | มี CLI/typed knowledge preview และตัวอย่างจริง Airflow/RAG/Java; ยังไม่ calibrate/evaluate หรือเชื่อม Final Agent Context |
| 5 | Final Agent Context, contract validation และตัวอย่างส่งต่อทีม AI/Backend | มี typed assembly + JSON Schema + seed examples 2 profiles; status preview_pending_policies, ยังไม่เลือก production scoring/selection |

Learning modules กลางยังเลื่อนออกไป ส่วนการสร้าง Roadmap Agent, หน้าจอ และ App persistence เป็นงานทีมปลายทางตามข้อสรุป R1/R2

## ช่วงที่ 3 — Dependency review ชุดแรก (2026-10-18)

- เพิ่ม pipeline-owned models/service/CLI ที่ `scripts.documents.skill_dependencies`
  สำหรับเตรียมหลักฐาน, proposal, checkpoint/review, dry-run/apply และ verified lookup
- ใช้ approved canonical IDs และ active document sources ตรวจ quote และ chunk hash;
  cycle checks ตรวจทั้ง prerequisite และ recommended_before โดยไม่ใช้ related บังคับลำดับ
- corpus ขณะเตรียมมี 48 active sources / 525 chunks เริ่ม 5 targets ได้แก่ TypeScript,
  React, Apache Airflow, Golang, CI/CD และอ่าน 18 chunks แบบ bounded/round-robin
  อีก 146 chunks ที่ mapped กับ targets ยังไม่ได้อ่านในรอบนี้ จึงคง coverage unknown
- Automatic approval review ปฏิเสธการส่งเอกสาร 18 chunks และรายชื่อ catalog ไป Gemini
  ในครั้งแรก ต่อมาผู้ใช้อนุญาตชัดเจนแล้ว และประมวลผลเฉพาะ frozen pack ที่อนุญาตสำเร็จ
  ตามรายละเอียดด้านล่าง ไม่รวม Resume/ข้อมูลผู้ใช้
- เตรียมข้อเสนอจากข้อความที่อ่านในเครื่องแทน และตรวจผ่าน CLI กับ IDs/quote จริง:
  `data-pipeline/data/processed/skill_dependencies/review-v2.json` พร้อม `.md`
  (local artifacts ที่ Git ignore)
- รอรีวิว 2 รายการ: JavaScript → TypeScript (`recommended_before`, scope uncertain)
  และ JavaScript → React (`related`, scope general) ไม่ได้อนุมัติแทนผู้ใช้
- ไม่มี proposal สำหรับอีก 3 targets ในชุดเล็กนี้ ไม่ใช่ข้อสรุปว่าไม่มี prerequisite
- Review บันทึกทีละรายการและกลับมาแก้รายการเดิมได้; approval เป็น local decision
  ที่ยังไม่ใช่การลง DB ต้องแยก `apply --apply` และมี migration 014 ก่อน
- ยังไม่ได้ apply migration 014, ไม่ได้เพิ่ม dependency ใน DB และยังไม่มี approved
  dependencies สำหรับ runtime; ยังไม่ทำ minimum-level assessment/expansion policy
- รัน CLI dry-run กับคิวจริงได้ `pending=2`, `approved=0`, `new_verified_edges=0`,
  `dependency_table_ready=false`; verified lookup คืน `coverage=unknown`, edges ว่าง
  รอบนี้ไม่ได้เพิ่มหรือรันชุดทดสอบใหม่ จึงยังไม่รายงานผลทดสอบการ apply/cycle แบบ integration
- คู่มือพร้อมคำสั่ง CMD: [Dependency review guide](../../data-pipeline/docs/documents/skill-dependency-review-guide.md)

### Gemini batch หลังอนุญาตส่งข้อมูล (2026-10-18)

- ส่งเฉพาะ `review-v1.evidence.json` เดิม: 18 document chunks และ 539 canonical
  skill IDs/names ด้วย shared Gemini text client โดยไม่อ่านหรือส่ง user/Resume data
- Evidence pack SHA-256:
  `62df219600a8b7fc03e8ed2d1b87f34056be3977fd591e9bece28d68add85572`
- เก็บ snapshot เดิม, raw response, manifest และ readable report เป็น
  `data-pipeline/data/processed/skill_dependencies/review-gemini-v1.*`
- Gemini เสนอ 1 รายการ JavaScript → TypeScript (`prerequisite`, `required`,
  `scope=document_specific`) อ้าง source 48/chunk 508 ของ TypeScript for Functional Programmers
- ตรวจ canonical IDs, target mapping และ quote พบว่าตรงกับ inspected pack จริง
  แต่การผ่านตรวจรูปแบบ/ข้อความไม่เท่ากับการยืนยันข้ออ้าง ความสัมพันธ์นี้จำกัดกับบทนำ
  ที่อ้าง จึงยังไม่ควรใช้บังคับผู้เรียน TypeScript ทุกคนตามเหตุผลที่ model สรุปกว้างเกินไป
- คู่เดียวกันมีข้อเสนอแบบ recommended_before ใน local batch เดิม ซึ่งใช้หลักฐาน
  อีกแหล่ง ไม่ใช่ความสัมพันธ์ใหม่อีกคู่ ต้องเทียบ scope/type ก่อนตัดสิน ไม่รวมยอดให้ดูมากขึ้น
- สถานะ Gemini batch: pending 1, approved 0, rejected 0; ยังไม่ apply migration/edges
  และยังไม่อนุมัติแทนผู้ใช้

### ปรับหลักฐานและตรวจ scope แยกจาก Gemini (2026-10-18)

- ผู้ใช้ให้ทำชุดใหม่ที่ครอบคลุม targets ต่อ จึงใช้การเลือกแบบ round-robin และรายงาน
  per-target evidence เพิ่ม: TypeScript 4/34 chunks จาก 2 sources, React 3/14 จาก 1,
  Apache Airflow 4/57 จาก 3, Golang 4/28 จาก 2 และ CI/CD 3/31 จาก 2
- รวมส่ง 18 public-document chunks/539 canonical IDs-names ไม่รวม Resume/user data
  เก็บ evidence/raw response/manifest/report แยกทุกครั้ง ไม่ทับรอบที่เคยรีวิว
- `review-gemini-v2` ยังเสนอ hard prerequisite แบบ general จากประโยคในบทนำ
  จึงเพิ่ม scope flags แยกจากโมเดลสำหรับคำจำกัดขอบเขตเอกสาร เงื่อนไขผู้เรียน
  และ source ที่จำกัดกลุ่มผู้อ่าน พร้อมกันไม่ให้ approve/apply ordering ที่ยังติด flags
- ปรับ prompt ให้รักษาเงื่อนไข ไม่ถือ chunk mappings เป็น semantic proof และไม่ใช้
  tutorial ของ tool หนึ่งไปอ้าง prerequisite ของ discipline ที่กว้างกว่า
- `review-gemini-v3` เสนอ JavaScript → TypeScript แบบ recommended_before,
  document_specific, audience_specific_source; pending 1 / pending_general 0 /
  pending_scope_questions 1 / approved 0
- ให้ใช้ **review-gemini-v3** เป็นชุดปัจจุบัน รอบเก่าเก็บเป็น reference ไม่รวมยอดเป็น
  ความสัมพันธ์ใหม่หรือให้ผู้ใช้รีวิวคู่เดิมซ้ำ ไม่มีการย้าย/ลบ/เปลี่ยนคำตัดสินเก่า
- หลักฐานรอบนี้ยังไม่รองรับ global ordering ที่พร้อมอนุมัติ ไม่สรุปว่าอีก 4 targets
  ไม่มี dependencies และไม่อ้างว่ากราฟสมบูรณ์ ยังต้องหา general evidence เพิ่มหรือ
  ตกลง scoped schema ก่อนใช้ความสัมพันธ์ที่มีเงื่อนไข
- ยังไม่ apply migration 014 หรือ dependency rows และไม่อนุมัติแทนผู้ใช้
- ตรวจซ้ำแบบ focused เฉพาะ React ด้วยเอกสาร 3 chunks ที่อยู่ในชุดที่ปรับแล้ว
  (`review-react-focused-v1`) ได้ proposals 0 ไม่บังคับสร้าง related/prerequisite
  เพิ่มจากความรู้ทั่วไป ผลว่างไม่ได้ยืนยันว่า React ไม่มี dependencies
- รัน dry-run กับ `review-gemini-v3` สำเร็จ: approved 0, new_verified_edges 0,
  pending 1, dependency_table_ready false; ตรวจสถานะ batch v2 ด้วยกฎปัจจุบันได้
  pending_general 0/pending_scope_questions 1 และปรับเฉพาะรายงานอ่านได้ให้เห็น warning
- ตรวจ whitespace ทั้ง root/sub repo ผ่าน ไม่เพิ่มหรือรันชุด unit/integration tests
  ในงานรอบนี้ และยังไม่อ้างว่า global dependency graph พร้อมใช้งาน

### รองรับ scoped verification และ DB provenance (2026-10-18)

ผู้ใช้อนุญาตให้เพิ่ม scope/เงื่อนไข, chunk provenance และข้อมูลการรีวิวแล้ว

- เพิ่ม migration `015_add_dependency_scope_and_review.sql` โดยไม่แก้ 014 เดิม:
  `scope_type`, `scope_note` (500 ตัวอักษร), `chunk_id`, `evidence_content_hash`,
  `reviewed_by`, `reviewed_at`, `review_note` พร้อม composite FK กันอ้าง chunk คนละ source
- เปลี่ยน uniqueness ให้ general มีหนึ่ง edge ต่อ pair/type ส่วน scoped แยก
  source/condition ได้ และเก็บ unknown legacy rows โดยไม่เดา scope/ข้อมูล reviewer
- `is_verified` หมายถึงตรวจข้ออ้างใน scope ที่บันทึก ไม่ได้ยืนยันว่าใช้กับทุกคน
  doc-specific/conditional อนุมัติได้เมื่อผู้ตรวจระบุเงื่อนไขชัดเจน; unknown ยังอนุมัติไม่ได้
- ปรับ model ให้รับ conditional/unknown, อ่าน uncertain จากไฟล์เก่าได้ และคง fingerprint
  เดิมเมื่อ proposal ยังไม่มี scope_note ไม่ล้างคำตัดสินหรือเรียก Gemini/อ่าน CV ซ้ำ
- CLI review รองรับการระบุ/แก้เงื่อนไข, บันทึก reviewer/time/reason และกลับมาแก้ row เดิม
  โดย scope flags ป้องกันการเปลี่ยนหลักฐานมีเงื่อนไขเป็น general ไม่ได้ห้าม scoped approval
- Apply บันทึก metadata ลง DB เฉพาะ human-approved rows แบบ atomic และ idempotent
  ส่วน pending/rejected/history ยังอยู่ใน local checkpoints ไม่ใช่ append-only DB review history
- Lookup ตรวจ exact chunk hash/quote และ audit metadata; general ordering ใช้ global cycle
  checks ส่วน scoped ได้ runtime_role=context_only พร้อม document_context_required หรือ
  needs_confirmation โดยไม่ถือว่าผู้ใช้ผ่านเงื่อนไขแล้ว
- ปรับ DBML รวม, Knowledge DBML, คู่มือ migrations/review และสเปกให้ตรงกัน
- รัน migration runner สำเร็จ: **014 และ 015 applied ใน development DB แล้ว**
  ตรวจพบ 7 fields ใหม่, dependencies 0, users 4, core.skills 539 และ chunks 525
- ตรวจ manifest เดิมได้ pending 1 / pending_scoped 1 / pending_general 0 /
  pending_scope_questions 0 / approved 0; dry-run schema_ready=true และไม่มี edge จะถูกเพิ่ม
  verified lookup ยังเป็น edges ว่าง/coverage unknown เพราะยังรอผู้ใช้รีวิว
- ยังไม่ได้อนุมัติแทนผู้ใช้ ไม่ได้เพิ่ม dependency rows และไม่ได้เพิ่ม/รันชุด tests ในรอบนี้
  ขั้นต่อไปคือรีวิวรายการเดิมพร้อม scope note แล้วจึง dry-run/apply คำตัดสิน

### ปรับเส้นทางส่งมอบ: catalog bootstrap + รีวิว a/r (2026-10-18)

ผู้ช่วยตีความคำขอสร้างข้อเสนอ dependency มาก่อนว่าให้ทำทั้ง catalog ซึ่งต่อมาผู้ใช้
ยืนยันว่า **ไม่ใช่: ให้ใช้เฉพาะเอกสารที่เตรียมไว้** งานในหัวข้อนี้จึงเป็นประวัติของ
เส้นทางที่อยู่นอกขอบเขต ไม่ใช่แผนปัจจุบัน ผู้ใช้เป็นผู้พิจารณาข้อเสนอเอง
เพื่อลดเวลาเตรียมงานส่งต่อทีม AI ภายในสัปดาห์นี้ จึงเปลี่ยนแผนจากการรอหลักฐาน
แต่ละประโยคเป็นข้อเสนอจากความรู้ของโมเดล โดยยังระบุที่มาตามจริง

- เพิ่ม `src/documents/extraction/dependency_bootstrap.py` และคำสั่ง `bootstrap`
  ใน CLI เดิม: อ่าน approved IDs/ชื่อ skill จาก DB, ให้ Gemini พิจารณาทั้ง catalog
  เป็น batch และอธิบายทิศทาง/ข้อจำกัดเป็นภาษาไทย ไม่ส่งข้อมูลผู้ใช้หรือ Resume
- ไม่สร้างชื่อ skill ใหม่ ไม่บังคับให้ทุก skill มี dependency ให้ได้ และแยกผล
  foundation / no_clear_dependency / missing_catalog_dependency ไว้ในรายงานราย skill
- สูงสุด 2 immediate relationships ต่อ target; ตรวจ IDs, self-link, duplicate,
  ข้อมูลครบทุก target และใช้ JSON response schema ของ shared Gemini client
- บันทึก JSON/Markdown ทุก batch, resume จากรายการที่เสร็จแล้ว และรักษาการรีวิวเดิม
  ด้วย fingerprint/atomic checkpoint/lock; ไม่มีการอนุมัติแทนผู้ใช้
- `review` ตรวจชนิด manifest ให้อัตโนมัติ: bootstrap ใช้ `a` หรือ `r` แล้วบันทึกทันที
  ไม่ถามเหตุผล/ชนิด/scope เพิ่ม มี Enter=skip, q=quit, --row สำหรับแก้คำตัดสิน
- เพิ่มคำสั่งสั้นใน repo หลัก `scripts\rag\review_dependencies.cmd`
- เพิ่ม `export` ส่งออกเฉพาะคู่ที่ approve พร้อม canonical IDs, คำอธิบายและ metadata
  ให้ทีม AI อ่าน JSON ได้ทันที; pending/rejected edges ไม่ติดไปแม้ใน assessments
  และ ordering cycles ในคู่ที่อนุมัติจะถูกแจ้งก่อน export
- ที่มาเป็น `model_knowledge`, `document_verified=false` แม้อนุมัติแล้ว ไม่ปะปนกับ
  `knowledge.skill_dependencies` ที่บังคับ source/chunk evidence และไม่เขียน DB ในรอบนี้
- รุ่น `review-gemini-v3` และชุดเล็กเดิมเก็บเป็น reference ไม่ใช่คิวรีวิวปัจจุบัน
- คู่มือใหม่: [Catalog dependency bootstrap](../../data-pipeline/docs/documents/dependency-bootstrap-guide.md)
  และปรับสเปก/คู่มือเดิมให้ชี้เส้นทางส่งมอบใหม่นี้ ไม่เพิ่ม/รัน tests ในงานรอบนี้
- รัน Gemini จริงจนจบครบ **539/539 skills**: มีข้อเสนอสำหรับ 385 skills,
  อีก 154 skills มีผลพิจารณาแต่ไม่มีคู่เสนอ รวม **491 relationships รอรีวิว**
  (approved 0 / rejected 0 / remaining generation 0) ที่
  `data-pipeline/data/processed/skill_dependencies/catalog-bootstrap-v1.json` และ `.md`
  คำตัดสินของผู้ใช้ยังไม่ถูกสร้าง และไม่มี DB writes/export ที่อ้างว่ามีคู่อนุมัติแล้ว

### แก้ขอบเขตตามผู้ใช้: เฉพาะเอกสารที่เตรียมไว้ (2026-10-18)

- ผู้ใช้ยืนยันให้ใช้เฉพาะ prepared documents ไม่ใช่ความรู้ทั่วไปทั้ง catalog
  ชุด catalog-only 491 คู่จึงถูกถอนจาก default review/handoff และเก็บเป็นประวัติ
  ไม่ลบ/อนุมัติ/ใช้คำตัดสินใดแทนผู้ใช้
- ตรวจ DB พบ 48 active sources / 525 chunks (492,241 content characters) / 24 mapped
  approved target skills ให้ Gemini อ่านข้อความทั้งหมดเป็น batch แทนการเลือกเพียง
  18 chunks ที่มี keyword prerequisite เท่านั้น
- เพิ่มคำสั่ง `corpus` พร้อม frozen evidence snapshot, processed chunk IDs และ resume
  ที่ `prepared-documents-v1.json`; catalog ใช้ resolve IDs ของแนวคิดจากเอกสารเท่านั้น
- เสนอได้ทั้ง explicit relationship และ recommended_before/related ที่ตีความจาก
  เนื้อหา โดยระบุ `basis=explicit|inferred`; inferred ห้ามเป็น hard prerequisite
  ทุกคู่ต้องมี exact quote/source/chunk/hash และ scope/เงื่อนไขที่กรอกมาก่อนรีวิว
- ไม่ใช้คำแนะนำหนังสือ/เมนู/ชื่อเอกสารอย่างเดียวเป็นหลักฐานเชื่อมคู่ skill
- รีวิว a/r ไม่ต้องกรอกเหตุผล และ launcher คำสั่งเดิมชี้ prepared-documents-v1 แล้ว
  export เฉพาะคู่ approve พร้อม basis/source/quote ให้ทีม AI ได้ก่อนลง DB
- ถอนคำสั่ง bootstrap จาก CLI ปัจจุบันและปรับเอกสารไม่ให้สับสนกับชุดที่อยู่นอกขอบเขต
  ไม่เปลี่ยน schema DB/ข้อมูลผู้ใช้/skill catalog และไม่เพิ่มหรือรัน tests ในงานรอบนี้
- ประมวลผลเอกสารครบ **525/525 chunks จาก 48 sources** แล้ว ได้ **23 คู่รอรีวิว**
  ครอบคลุม 11 target skills จาก 24 targets: explicit 3 / inferred 20,
  general 4 / scoped 19 / unresolved scope 0; approved 0 / rejected 0
  การไม่มีข้อเสนอสำหรับอีก 13 targets ไม่ได้ยืนยันว่าไม่มี prerequisite
- เก็บคำตอบดิบและกู้ข้อเสนอที่ quote ถูกต้องจาก batch แรกโดยไม่เรียก API ซ้ำ
  แก้ให้ validation แยกรายข้อเพื่อไม่ให้คำตอบผิดรายการเดียวล้างทั้ง batch
  อ่านสถานะ/สร้างรายงานชุดเต็มแล้วโดยไม่เรียก Gemini อีกและไม่มี DB writes
- TypeScript ชุดใหม่มี quote แนะนำผู้ไม่มีพื้นฐาน JavaScript ให้อ่าน JavaScript ก่อน
  และ quote ระบุ assumed JavaScript knowledge ของบท Functional Programmers
  ไม่ใช้ประโยคแนะนำหนังสืออย่างเดียวแบบชุดก่อน
- ไฟล์ส่งรีวิว: `data-pipeline/data/processed/skill_dependencies/prepared-documents-v1.json`
  และ `.md`; เปิดด้วย `scripts\rag\review_dependencies.cmd` คิวปัจจุบันมี 23 รายการ

### หลังผู้ใช้รีวิวเอกสาร (2026-10-18)

- อ่าน checkpoint จริง: approve 17 / reject 4 / pending 2 จาก 23 คู่
  ที่ค้างคือ Row 13 Node.js → Docker และ Row 18 object-oriented design → Java
  ไม่เปลี่ยนเป็น approve/reject แทนผู้ใช้
- Export เฉพาะ approved 17 คู่เป็น
  `data-pipeline/data/processed/skill_dependencies/dependencies-ai-handoff.json`
  พร้อม canonical IDs/ชื่อ, basis, source/quote/hash, scope/เงื่อนไขและ review metadata
  รวม review_summary เพื่อให้ทีม AI เห็นว่าคิวยังเหลือ 2 รายการ ไม่ส่ง pending/rejected edges
- ตรวจ general ordering cycles ผ่าน และรัน apply แบบ read-only dry-run กับ live DB ผ่าน:
  approved 17 / new_verified_edges 17 / already_verified 0 / schema_ready true,
  global ordering 1 / scoped Context 13 (อีก 3 เป็น general related)
- ยังไม่เขียน dependency ลง DB ไม่เรียก Gemini และไม่เพิ่ม/รัน tests ในงานรอบนี้
- ระหว่างดำเนินการพบผู้ใช้บันทึก Row 18 เพิ่ม จึงอ่าน snapshot ใหม่และ export/dry-run
  จาก manifest ชุดเดียวกันอีกครั้ง: **approve 18 / reject 4 / pending 1 (Row 13)**
  ไฟล์ handoff ล่าสุดมี 18 คู่, global ordering 1 / scoped Context 14 / general related 3
  ผล dry-run ผ่านและยังไม่มี DB writes ตัวเลข 17 ด้านบนเป็น snapshot ก่อนหน้า
- ตรวจซ้ำตามผู้ใช้: **approve 18 / reject 5 / pending 0** แล้ว โดย Row 13 ถูก reject
  อัปเดต handoff 18 คู่และรายงานจาก snapshot ล่าสุด, dry-run ตรวจ live evidence ผ่าน
  (new_verified_edges 18 / already_verified 0) ยังไม่ apply DB และไม่เรียก Gemini

### Apply dependency ที่ผู้ใช้อนุมัติลง DB (2026-10-18)

- ผู้ใช้สั่ง apply ชัดเจนแล้ว จึงรัน `apply --apply` จาก `prepared-documents-v1.json`
  ลง `knowledge.skill_dependencies` สำเร็จ 18 คู่แบบ transaction; 5 คู่ที่ reject ไม่ถูกนำเข้า
- อ่านกลับผ่าน `lookup_verified` ครบ 18 แถว ตรวจ source/chunk/hash/scope/audit metadata ผ่าน:
  `global_ordering` 1 / `context_only` 14 / `informational` 3
- รัน dry-run หลัง apply ได้ new_verified_edges 0 / already_verified 18 / pending 0
  ยืนยันว่าคู่ที่อนุมัติทั้งหมดมีใน DB แล้ว ไม่ได้รัน apply ซ้ำเพื่อเพิ่มแถว
- บันทึกผลตรวจใน `data-pipeline/data/processed/skill_dependencies/prepared-documents-v1.db-receipt.json`
  พร้อม manifest SHA-256, เวลาอ่านกลับ, DB dependency IDs และผล dry-run หลัง apply
- คงประเภท/เงื่อนไขเดิม ไม่เปลี่ยน scoped หรือ related เป็น prerequisite ทั่วไป
  ไม่สร้างเอกสารใหม่สำหรับ 4 skills ที่ยังไม่มี mapping และไม่เปลี่ยน user/skill catalog
- ไม่เรียก Gemini และไม่เพิ่ม/รันชุด tests ในรอบนี้; เป็นการ apply จริงและอ่านตรวจผลกลับ

## ช่วงที่ 4 — Skill Knowledge Context preview (2026-10-18)

- เพิ่ม pipeline models/service ใน `schemas/skill_context.py` และ
  `retrieval/skill_context.py` พร้อม root CLI `scripts/rag/prepare_skill_context.py`
  เลือก main skills จาก caller โดยตรง ไม่เลือก scoring/ranking policy แทนผู้ใช้
- ใช้ normalized canonical/alias lookup, active source + skill mapping filters,
  query embedding Gemini Embedding 2 / 768 และอ่าน complete chunks ภายใน budget
  ก่อนส่ง shared Gemini text client; ไม่ส่งข้อมูล Resume/ผู้ใช้และไม่เขียน DB
- ให้โมเดลคัดเนื้อหา/สรุปไทยพร้อม citation IDs และ exact quotes; ตรวจ IDs/quote/status
  ด้วยโค้ด, repair ได้หนึ่งครั้ง แล้วให้ error/coverage gap โดยไม่เติมความรู้ทั่วไป
- แยก instructional กับ topic_outline: รายการหัวข้อไม่ถูกถือเป็นเนื้อหาสอนพร้อมใช้
  และไม่สร้างแบบฝึกหัดหรือชั่วโมงเรียนจากหัวข้ออย่างเดียว
- อ่าน dependency ที่ verified แล้วพร้อม hash/source/scope เป็น foundation/related mentions
  ไม่ auto-expand เป็นกิจกรรม ไม่เดาว่าผู้ใช้ผ่านพื้นฐาน และ flag general hard prerequisite
  ที่ต้องยืนยันก่อนเดินหน้าโดยไม่มีเงื่อนไข
- JSON, Database Systems, vector databases และ object-oriented design แสดง
  “พบพื้นฐานที่เกี่ยวข้อง แต่เนื้อหายังไม่พร้อม”, creates_learning_activity=false
  ส่วน main skills อื่นยังเตรียม Context ต่อได้
- สร้างตัวอย่างจริงฉบับล่าสุดที่ `rag/data/knowledge/knowledge-context-demo-v3.json` และ `.md`
  พร้อม `.schema.json`/`.assembly.json`: Airflow partial มี instructional 5 claims,
  RAG partial มี instructional 2 claims, Java partial มี topic_outline 3 claims
  รวม 10 claims, ไม่มี error ในฉบับรวม และมีข้อจำกัดแต่ละ skill ระบุชัดเจน
- ฉบับแรกให้ Java เป็น supported จากรายการหัวข้อและสรุปอังกฤษ จึงเพิ่มกฎ outline
  และคำสั่งให้แปลสรุปไทยได้แต่ quote ต้องคงภาษาเดิมก่อนเรียกเฉพาะ Java ใหม่
  ฉบับ v3 reuse ผล Airflow/RAG v2 กับ Java v3 ไม่อ้างว่าเป็น DB snapshot เดียวกัน
- ตัวอย่างใช้ budgeted document text 34,187 characters และคัดไว้ 7,457 characters
  ตัวเลขนับ input payload ต่อ skill หนึ่งครั้ง ไม่ใช่ยอด token/billing รวม retries
- คู่มือ [Skill Knowledge Context](skill-knowledge-context-guide.md) ระบุ commands/contract,
  coverage gaps, retry/character-budget limits และ ownership; ไม่เพิ่ม/รัน tests ในรอบนี้
- ยังไม่มี retrieval evaluation/threshold calibration, production selection policy,
  personalized final Agent Context, API/UI หรือ Roadmap Agent ตามขอบเขตที่ตกลง

## ช่วงที่ 5 — Agent Context assembly และ handoff contract (2026-10-18)

- เพิ่ม root-owned `rag/context/agent_models.py`, `rag/context/assemble.py` และ CLI
  `scripts/rag/build_agent_context.py` รวม saved User/Goal/Market snapshot กับ cited
  knowledge ที่เตรียมแล้วและ dependency สดใน DB ไม่เรียกโมเดล/ส่งข้อมูลผู้ใช้ออกนอกเครื่อง
- Payload ใช้ schema_version 0.3, status `preview_pending_policies` แยกจาก input/knowledge
  preview มี scores ว่าง, gap_score/priority_score/policy ที่ยังไม่เลือกเป็น null
  ลำดับ main skills เป็น explicit caller order ไม่เปลี่ยนสูตรคะแนน API เดิม
- แยก gap statuses ตาม canonical IDs: missing จากโปรไฟล์, unknown user level,
  insufficient market level และ observed ordinal comparison; summary ทั้ง cohort
  กับเฉพาะ selected skills นับแยกไม่ซ้ำและไม่ใช้ Top-N เป็นตัวหารคะแนน
- อ่าน goal/deadline/availability/preferences ตามจริง ไม่แทนช่วงชั่วโมงด้วย midpoint
  ไม่เดา deadline/ระดับ และ unresolved skills ไม่ถูกจับเข้า canonical ด้วยชื่อคล้ายกัน
- Group พื้นฐานต่อ canonical ID พร้อมเก็บทุก source/scope condition, user presence/level
  และ learner_satisfaction=not_assessed; ไม่สร้างกิจกรรมพื้นฐานเอง
- Registry รวม full chunks แบบไม่ซ้ำ ID พร้อม hash/URL/usage role; learning content
  แยกจาก dependency evidence และไม่ยก quote ความสัมพันธ์เป็นบทสอนพื้นฐาน
- ตรวจ live canonical names/source/chunk/hash/mapping และ quote references ก่อน assembly
  พร้อม hard limits registry 40,000 chars / payload 80,000 chars และจำกัด user excerpts
  ไม่ตัด document citations เงียบ ๆ; หลาย read snapshots ไม่อ้างว่าเป็น global transaction เดียว
- สร้างตัวอย่างจาก seed DB จริงโดย reuse `knowledge-context-demo-v3.json`:
  `agent-context-demo-student-v2.json` และ `agent-context-demo-unknown-v1.json` ใน `rag/data/agent-context`
  แต่ละชุด main 3 / foundation IDs 8 / registry chunks 16, เอกสารรวม 15,841 characters
- ตัวอย่าง student payload ประมาณ 56,815 chars, selected gaps เป็น missing_from_profile 3;
  cohort 209 skills: proficiency_gap 2 / missing 205 / not_assessed 1 / insufficient 1
- ตัวอย่าง unknown-level profile: cohort 209 skills: missing 205 / not_assessed 4,
  ไม่มี covered/proficiency gap ที่เดาระดับขึ้นมา ใช้ targetdate/preferences คนละชุดตาม DB
- สร้าง [Agent JSON Schema](agent-context.schema.json) และ
  [คู่มือประกอบ Context/การส่งทีม AI](agent-context-guide.md) พร้อม code boundary และข้อจำกัด
  output ตัวอย่างมี JSON/Markdown/Schema, ไม่เปลี่ยน DB หรือเพิ่ม/รัน tests ในงานรอบนี้
- พร้อมให้ทีม AI เชื่อม contract แบบ preview; ยังต้อง review production score/selection,
  reliability/retrieval calibration และงาน Agent/UI/persistence ซึ่งเป็นขอบเขตทีมปลายทาง

## จัดระเบียบไฟล์ local และเตรียมส่งต่องาน (2026-10-18)

- ย้าย `rag/.data` เป็น `rag/data` แยก `inputs`, `scoring`, `knowledge`,
  `agent-context` และ `archive` พร้อมตรวจ SHA-256 ว่าไฟล์เดิมทั้ง 37 ไฟล์ไม่เปลี่ยน
- เก็บผลรุ่นเก่า, partial checkpoints และ raw model responses ไว้ใน archive
  ส่วนตัวอย่างล่าสุดอยู่ใน knowledge/agent-context โดยไม่แก้ payload หรือ recorded hashes
- เพิ่ม [คู่มือที่มาและหน้าที่ของแต่ละไฟล์](../../rag/data/README.md) และ `.gitkeep`
  เพื่อให้ clone แล้วได้โครงโฟลเดอร์; generated files ยัง Git-ignored ตามเดิม
- ปรับตัวอย่างคำสั่ง local/Docker และ path ในคู่มือทั้งหมดให้ตรงกับโครงใหม่
  ไม่มีการเรียก model, เปลี่ยน DB หรือรัน tests เพิ่มในงานจัดโฟลเดอร์รอบนี้
