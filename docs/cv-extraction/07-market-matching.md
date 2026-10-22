# Resume–Market Skill Match

สถานะเอกสาร: **Core 20 และการจัดลำดับ Skill Gap implement สำหรับ local demo แล้ว; เกณฑ์ยังต้องประเมินกับข้อมูลจริงก่อนใช้เป็น production score**
ขอบเขต: เปรียบเทียบ skill ในโปรไฟล์ผู้ใช้ที่ยืนยันแล้วกับความต้องการของอาชีพจากข้อมูลตลาด เพื่อสรุปทักษะที่ตรงและช่องว่างที่ควรพัฒนา

สูตร เกณฑ์คุณภาพ และชื่อ API ในเอกสารนี้เป็นค่าเริ่มต้นสำหรับ implementation/demo ซึ่งยังปรับได้จากการ review ผลลัพธ์

## สถานะ implementation

- มี deterministic calculation service และ endpoint `GET /api/profiles/{profileId}/career-match?careerProfileId=...` ใน backend; ส่ง anonymous session ผ่าน `X-Session-Id`
- หน้า `/onboarding/cv` เป็น temporary demo สำหรับลอง upload, review extraction และดูผล match จาก API; จะมี frontend ตัวอื่นมาแทน จึงไม่ถือ UX หรือหน้าจอนี้เป็น production requirement
- backend API และ calculation service เป็นส่วนที่ frontend ใหม่สามารถเรียกใช้ต่อได้ โดยอิง contract ใน [03-api-reference.md](03-api-reference.md) และ `/openapi.json`
- อ่าน user skills ที่ canonical matched และยืนยันแล้ว เทียบกับ market window ล่าสุดหนึ่งช่วง โดยไม่ผสมช่วงข้อมูล
- คำนวณ coverage, proficiency alignment และ assessment coverage แยกกัน พร้อมผลราย skill และ reason codes
- เพิ่ม `coreSkillMatchPct` สำหรับ Top 20 weighted market skills (รวม ties ที่เส้นตัด) และ `gapScore`/`priorityScore` ราย skill เพื่อช่วยตรวจลำดับ potential gaps
- คืน evidence excerpt สูงสุด 3 รายการต่อ skill (ไม่เกิน 320 ตัวอักษรต่อรายการ) และแสดง unmatched labels แยกจากคะแนน
- ค่าเริ่มต้น quality gates เป็น `MATCH_MIN_TOTAL_JOBS=10`, `MATCH_MAX_MARKET_AGE_DAYS=180`, `MATCH_MIN_LEVEL_OBSERVATIONS=3`, `MATCH_MIN_TARGET_LEVEL_CONFIDENCE=0.6`; ปรับผ่าน env ได้และระบุเป็น provisional
- ไม่เพิ่ม migration: ใช้ `app.user_skills.proficiency_basis` และ `market.career_skill_stats` ที่มีอยู่
- มี unit tests ของสูตรและ API integration tests ใน backend; ให้ตรวจผลรันล่าสุดจาก environment ก่อนใช้อ้างอิง
- ตรวจสูตรใน Market aggregator แล้ว: `weighted_demand_score` คือผลรวม `importance_weight` ของ skill ในแต่ละงาน หารด้วย `total_jobs` จึงรวมทั้งความสำคัญและ prevalence แล้ว; ยังควร sanity-check กับชุดข้อมูล demo จริง
- จุดที่ยังควรทบทวน: quality thresholds กับข้อมูลตลาดจริงและ rubric ระดับ proficiency

## 1. เป้าหมายและสิ่งที่คะแนนหมายถึง

ระบบควรตอบคำถามให้ผู้ใช้เข้าใจได้ว่า:

1. อาชีพเป้าหมายนี้ต้องการ skill อะไรบ่อยหรือสำคัญแค่ไหน
2. ผู้ใช้มี skill ใดอยู่แล้ว และมีหลักฐาน/ระดับความชำนาญอย่างไร
3. skill ใดเป็น gap ที่ควรเติม โดยเรียงตามความต้องการของตลาด
4. ข้อมูลเพียงพอแค่ไหน คะแนนจึงน่าเชื่อถือหรือยังเป็นเพียงประมาณการ

คะแนนนี้ควรเรียกว่า **ความครอบคลุม skill ตามข้อมูลตลาด** หรือ **Market Skill Coverage** ไม่ควรเรียกว่าโอกาสได้งานหรือเปอร์เซ็นต์ความเหมาะสมที่จะได้รับการจ้าง เพราะข้อมูลชุดนี้ไม่ได้จำลองการตัดสินใจของนายจ้าง และไม่ได้พิจารณาปัจจัยทั้งหมด เช่น ประสบการณ์ คุณภาพผลงาน การสัมภาษณ์ สถานที่ เงินเดือน หรือจำนวนผู้สมัคร

แยกผลลัพธ์เป็นคนละมิติ ไม่รวมทุกอย่างเป็นคะแนนเดียวในรุ่นแรก:

- **Market skill coverage**: ผู้ใช้มี skill ที่ตลาดต้องการอยู่กี่ส่วน เมื่อถ่วงน้ำหนักตามความสำคัญ
- **Proficiency alignment**: ระดับของผู้ใช้สอดคล้องกับระดับเป้าหมายของตลาดเพียงใด เฉพาะ skill ที่มีข้อมูลระดับเพียงพอ
- **Assessment coverage**: มีน้ำหนักของ skill ในตลาดกี่เปอร์เซ็นต์ที่เราประเมินระดับผู้ใช้และระดับเป้าหมายได้จริง

การแยกเช่นนี้ป้องกันกรณีแสดง proficiency alignment สูง ทั้งที่ประเมินระดับได้เพียง skill เล็กน้อย

## 2. ข้อมูลที่ใช้และเจ้าของข้อมูล

### โปรไฟล์ผู้ใช้

แหล่งหลักคือ `app.user_skills` และหลักฐานใน `app.user_skill_evidence`:

- `skill_id`: ต้อง resolve เป็น skill มาตรฐานใน `core.skills`
- `match_status`: ต้องเป็น `matched`; รายการ `unmatched` หรือ `needs_review` ห้ามจับคู่โดยเดาจากข้อความใกล้เคียง
- `user_confirmed`: ใช้แยกข้อมูลที่ผู้ใช้ตรวจและยืนยันแล้วออกจากผลสกัดชั่วคราว
- `proficiency_level`: `beginner`, `intermediate`, `advanced`, `expert`, `unknown`
- `confidence`: ความมั่นใจของข้อมูล skill ที่สกัด/บันทึก ไม่ใช่คะแนนความสามารถหรือระดับความชำนาญของผู้ใช้
- `app.user_skill_evidence`: ช่วยแสดงเหตุผลว่าระบบพบ skill จากประสบการณ์ โครงการ หรือข้อความใด

โปรไฟล์ CV ที่บันทึกผ่าน flow ปัจจุบันเป็นข้อมูลที่ผู้ใช้ตรวจแล้ว แต่การยืนยันว่ามี skill ไม่ได้แปลว่าระดับ proficiency ถูกยืนยันด้วยเสมอ โดยเฉพาะค่าที่อนุมานจากระยะเวลาหรือรายการประสบการณ์

### ความต้องการของตลาด

ใช้ `market.career_skill_stats` ที่ตรงกับ `career_profile_id` และช่วงวันที่เดียวกัน โดยข้อมูลสำคัญคือ:

- `weighted_demand_score` (0–1): น้ำหนักความต้องการต่อ skill จากข้อมูลประกาศงาน
- `demand_count`, `total_jobs`, `demand_percentage`: ความแพร่หลายของ skill ในชุดประกาศงาน
- `required_count`, `preferred_count`, `optional_count`: สัดส่วนตามระดับความจำเป็นในประกาศ
- `target_level`, `target_level_confidence`, `level_observation_count`: ระดับที่ตลาดมักต้องการและความแข็งแรงของข้อมูลระดับ
- `analysis_start_date`, `analysis_end_date`, `last_updated`: ช่วงเวลาและความสดใหม่ของสถิติ

`weighted_demand_score` มีองค์ประกอบด้านความสำคัญและความแพร่หลายอยู่แล้วตามการ aggregate ปัจจุบัน จึงไม่ควรนำไปคูณ `demand_percentage` ซ้ำ เพราะจะให้น้ำหนักความแพร่หลายซ้ำสองครั้ง ควรยืนยันสูตรกับผู้ดูแล Market pipeline ก่อน implementation

## 3. เงื่อนไขก่อนเริ่มคำนวณ

1. เป้าหมายอาชีพต้อง resolve เป็น `career_profile_id` ที่มี market stats หากยังไม่ resolve ให้ขอผู้ใช้เลือก/ยืนยันอาชีพก่อน ห้ามนำชื่อ role ที่คล้ายกันมาเลือกให้อัตโนมัติแบบเงียบ ๆ
2. อ่านเฉพาะ skill ของผู้ใช้ที่มี canonical `skill_id` และ `match_status='matched'` ส่วนที่ยังไม่ resolve แสดงเป็นรายการรอตรวจแยกจากคะแนน
3. ใช้โปรไฟล์ที่ผู้ใช้ยืนยันแล้วเป็นค่าเริ่มต้นสำหรับคะแนนจริง หากต้องคำนวณก่อนยืนยัน ให้ทำเครื่องหมายผลว่า provisional และห้ามแสดงเหมือนเป็นคะแนนสุดท้าย
4. กรอง market stats ด้วย career profile และช่วงข้อมูลที่เลือกให้ชัดเจน ห้ามรวมสถิติคนละช่วงเวลาโดยไม่มีนโยบายรองรับ
5. ตรวจจำนวนประกาศงานและความสดใหม่ก่อนแสดงคะแนน ถ้าข้อมูลน้อย เก่ามาก หรือไม่มี stats ให้คืนสถานะข้อมูลไม่พอพร้อมเหตุผล แทนการสร้างตัวเลขที่ดูแม่นยำเกินจริง
6. ถ้า `weighted_demand_score` เป็น `NULL` ให้กำหนดนโยบายอย่างชัดเจนว่าจะข้าม skill นั้นหรือใช้ fallback ที่ผ่านการอนุมัติ ห้ามแทนค่าเป็นศูนย์โดยไม่บอก เพราะศูนย์สื่อว่าไม่สำคัญ ส่วนข้อมูลที่ขาดหมายถึงยังไม่ทราบ

ค่าเกณฑ์ขั้นต่ำของจำนวนประกาศงาน ความสดใหม่ และ `target_level_confidence` ยังเป็นสิ่งที่ต้องตกลงก่อนพัฒนา ควรตั้งเป็น configuration และแสดงผลตามเกณฑ์ที่ใช้

## 4. สูตรคะแนนที่ใช้ใน demo

### 4.1 Market Skill Coverage

กำหนดให้:

- `S` = skills ที่มี market stats ใช้ได้สำหรับอาชีพและช่วงเวลาที่เลือก
- `wᵢ` = `weighted_demand_score` ของ skill นั้น
- `pᵢ` = 1 ถ้าผู้ใช้มี skill นั้นในรายการที่ยืนยันและ canonical match แล้ว มิฉะนั้นเป็น 0

สูตร:

```text
Market Skill Coverage (%) = 100 × Σ(wᵢ × pᵢ) / Σ(wᵢ)
```

หากไม่มีน้ำหนักที่ใช้ได้ หรือผลรวม `wᵢ` เป็นศูนย์ ให้ส่งสถานะ `insufficient_market_data` แทนการหารหรือแสดง 0% ซึ่งอาจทำให้เข้าใจผิด

หลักการสำคัญ:

- การมี skill ตอบคำถามเรื่อง **มี/ไม่มี**; proficiency ตอบคำถามคนละข้อเรื่อง **ทำได้ระดับไหน**
- คะแนน coverage รุ่นแรกใช้เฉพาะการมี skill ที่ผู้ใช้ยืนยันแล้ว ไม่เอา `confidence` ของการสกัดไปคูณคะแนนโดยอัตโนมัติ เพราะ confidence นั้นไม่ได้วัดความชำนาญ
- skill ที่ยังไม่พบในโปรไฟล์นับเป็น gap สำหรับการเปรียบเทียบ แต่ UI ควรใช้ถ้อยคำ “ยังไม่พบในโปรไฟล์” ไม่สรุปว่าผู้ใช้ทำไม่ได้
- skill ที่ resolve ไม่ได้หรือข้อมูลตลาดขาด จะไม่อยู่ในตัวหาร และต้องรายงานจำนวน/น้ำหนักที่ตัดออกเพื่อให้ตีความคะแนนได้

ตัวอย่างเพื่ออธิบายสูตรเท่านั้น: สมมติ Python มีน้ำหนัก 0.8, ML 0.6, Kubernetes 0.2 และผู้ใช้ยืนยัน Python กับ ML แล้ว coverage คือ `(0.8+0.6)/(0.8+0.6+0.2) = 87.5%` ตัวเลขนี้ไม่ใช่โอกาสได้งาน

### 4.2 Proficiency Alignment

คำนวณแยกจาก coverage เฉพาะ skill ที่:

- ผู้ใช้มี skill และมี `proficiency_level` ที่ไม่ใช่ `unknown`
- market มี `target_level` ที่ไม่ใช่ `unknown`
- ความเชื่อมั่นและจำนวน observation ของ market ผ่านเกณฑ์ที่ทีมกำหนด

กำหนดลำดับระดับเป็น `beginner=0`, `intermediate=1`, `advanced=2`, `expert=3` แล้วเสนอคะแนนต่อ skill ดังนี้:

```text
level_fitᵢ = max(0, 1 - max(0, target_levelᵢ - user_levelᵢ) / 3)
```

ดังนั้นระดับเท่ากันหรือสูงกว่าเป้าหมายได้ 1.00; ต่ำกว่า 1 ขั้นได้ประมาณ 0.67; ต่ำกว่า 2 ขั้นได้ประมาณ 0.33; ต่ำกว่า 3 ขั้นได้ 0.00 คะแนนนี้เป็น rubric เริ่มต้นสำหรับ demo ยังไม่ใช่มาตรฐานที่ผ่านการ validate

ถ่วงน้ำหนัก `level_fitᵢ` ด้วย `weighted_demand_score` แล้วแปลงเป็นเปอร์เซ็นต์ โดยตัวหารใช้เฉพาะ skill ที่ประเมินได้จริง จากนั้นส่ง `assessment_coverage_pct` เพิ่มเติม:

```text
Proficiency Alignment (%) = 100 × Σ(wᵢ × level_fitᵢ) / Σ(wᵢ ของ skill ที่ประเมินระดับได้)
Assessment Coverage (%) = 100 × Σ(wᵢ ของ skill ที่ประเมินระดับได้) / Σ(wᵢ ของ skill ที่ใช้ได้ทั้งหมด)
```

ถ้าผู้ใช้มีระดับ `unknown` ให้จัดเป็น `not_assessed` ไม่ใช่ `beginner` และไม่เอาเข้าตัวหาร proficiency alignment ส่วน skill ที่ยังไม่มีในโปรไฟล์เป็น gap ด้าน coverage และยังไม่มี proficiency ให้ประเมิน

## 4.3 Core skill match และ gap priority

คะแนนหลักใหม่ใช้ skill ที่มี `weighted_demand_score` มากที่สุด 20 รายการจาก market window เดียวกัน หากมี skill น้ำหนักเสมอกับอันดับที่ 20 ให้นับรวมทั้งหมดด้วย ตัวหารจึงอาจมีมากกว่า 20 รายการ คะแนนคือสัดส่วนน้ำหนักของ Core skills ที่พบในโปรไฟล์ที่ผู้ใช้ยืนยันแล้ว ไม่ใช่ความพร้อมทำงาน:

```text
Core Skill Match (%) = 100 × Σ(weight ของ Core skill ที่พบในโปรไฟล์) / Σ(weight ของ Core skills)
```

สำหรับจัดลำดับ gap ภายใน Core skills ใช้กฎเริ่มต้นนี้:

```text
gap_score = 1.0                           เมื่อไม่พบ skill ในโปรไฟล์ (potential gap)
gap_score = level_gap / 3                 เมื่อระดับผู้ใช้ต่ำกว่าตลาดและประเมินได้
priority_score = 100 × gap_score × (skill_weight / total_core_weight)
```

คะแนน gap เป็นสัญญาณเชิงลำดับ ไม่ใช่การวัดความสามารถที่ผ่านการปรับเทียบแล้ว `missing_from_profile` หมายถึงไม่พบข้อมูลในโปรไฟล์ ไม่ได้ยืนยันว่าผู้ใช้ไม่มีทักษะ ระบบจึงส่ง `requiresConfirmation` ให้ UI แสดงเป็นรายการรอตรวจ ส่วนทักษะนอก Core 20 จะไม่มี gap/priority score ในรุ่นนี้

## 5. การใช้ confidence และหลักฐาน

ต้องแยกแนวคิด 3 อย่างออกจากกัน:

1. **Catalog match confidence**: ระบบมั่นใจแค่ไหนว่า raw label ตรงกับ canonical skill — ปัจจุบันใช้กฎ exact name/alias แบบ deterministic; ความกำกวมต้องให้ตรวจ ไม่ควรใช้คะแนน similarity อย่างเดียวเพื่อ auto-match
2. **Skill extraction confidence**: ระบบมั่นใจแค่ไหนว่าดึง skill นั้นจาก CV ถูกต้อง — สะท้อนด้วย `confidence` และ evidence แต่ไม่ใช่ proficiency
3. **Proficiency confidence**: ระบบมั่นใจแค่ไหนกับระดับ beginner–expert — schema ปัจจุบันไม่มีคอลัมน์แยกสำหรับค่านี้ จึงต้องออกแบบว่าจะใช้ basis/evidence จาก profile data หรือเพิ่มข้อมูลเชิงโครงสร้างก่อนนำไปลด/ปรับคะแนน

ข้อเสนอรุ่นแรก: ใช้เฉพาะข้อมูลที่ผู้ใช้ยืนยันใน coverage; แสดง `proficiencyBasis`/หลักฐานประกอบระดับเป็น explicit, inferred หรือ unknown ถ้าข้อมูลนี้ส่งผ่านได้; ไม่คูณ confidence ซ้ำในสูตรจนกว่าจะนิยามแหล่งและความหมายของ confidence ให้ชัด หากระดับ inferred ให้ติดป้าย “ประมาณจากประสบการณ์” และรายงานเป็นข้อจำกัดของ proficiency alignment

หากทีมต้องการ confidence-adjusted score ในอนาคต ให้แยกคะแนนดิบกับคะแนนปรับความเชื่อมั่น และทำ calibration กับข้อมูลตัวอย่างก่อน ห้ามซ่อนการลดคะแนนไว้ในสูตรโดยไม่เปิดเผย

## 6. รายละเอียดผลลัพธ์ต่อ skill

API ควรคืนข้อมูลที่อธิบายคะแนนรวมได้ โดยต่อ skill มีอย่างน้อย:

- canonical `skillId`, `skillName`
- `userHasSkill`, `userConfirmed`, `userProficiencyLevel`, `proficiencyBasis` เมื่อมี
- `marketTargetLevel`, `targetLevelConfidence`, `levelObservationCount`
- `demandCount`, `totalJobs`, `demandPercentage`, `weightedDemandScore`, `importanceTier`
- `status`: `covered`, `proficiency_gap`, `missing_from_profile`, `not_assessed`, `market_data_insufficient`
- `levelGap` เมื่อคำนวณได้ และ `reason` ที่อธิบายภาษาคน
- evidence reference ที่ปลอดภัยและเหมาะกับ UI; อย่าส่ง CV ทั้งฉบับกลับมา

ควรคืน metadata ของการคำนวณด้วย เช่น `careerProfileId`, ช่วงวันที่ของตลาด, จำนวนประกาศงาน, เวลาที่ข้อมูลอัปเดต, จำนวน skill ที่ใช้/ตัดออก และสถานะความเพียงพอของข้อมูล

## 7. ตัวอย่างโครงสร้าง response (ร่าง)

```json
{
  "careerProfileId": 12,
  "marketWindow": { "startDate": "2026-01-01", "endDate": "2026-06-30" },
  "marketSample": { "totalJobs": 120, "lastUpdated": "2026-07-01T00:00:00Z" },
  "status": "estimated",
  "scores": {
    "marketSkillCoveragePct": 72.4,
    "proficiencyAlignmentPct": 66.7,
    "assessmentCoveragePct": 54.0
  },
  "skillSummary": { "covered": 6, "missingFromProfile": 3, "notAssessed": 4 },
  "skills": [
    {
      "skillId": 42,
      "skillName": "Python",
      "status": "proficiency_gap",
      "userHasSkill": true,
      "userProficiencyLevel": "intermediate",
      "proficiencyBasis": "inferred",
      "marketTargetLevel": "advanced",
      "weightedDemandScore": 0.8,
      "targetLevelConfidence": 0.75,
      "levelGap": 1,
      "reason": "มี Python ในโปรไฟล์ แต่ระดับที่ประเมินได้ต่ำกว่าระดับที่พบในตลาดหนึ่งขั้น"
    }
  ],
  "warnings": ["ประเมินระดับ proficiency ได้เพียง 54% ของน้ำหนัก skill ตลาด"]
}
```

ตัวอย่างนี้แสดงรูปแบบข้อมูลเท่านั้น ค่าตัวเลขและ status ยังไม่ใช่ API contract ที่อนุมัติ

## 8. Flow การทำงานปัจจุบัน

```text
ผู้ใช้เลือก/ยืนยันอาชีพเป้าหมาย
        ↓
resolve เป็น career_profile_id
        ↓
โหลดโปรไฟล์ที่ผู้ใช้ยืนยัน + canonical user skills + evidence
        ↓
โหลด market.career_skill_stats ตาม career profile และ market window
        ↓
ตรวจคุณภาพ/ขนาดตัวอย่าง/ความสดใหม่/ระดับ confidence
        ↓
คำนวณ coverage, proficiency alignment และ assessment coverage แยกกัน
        ↓
คืนผลรวม + รายการต่อ skill + เหตุผล + ข้อจำกัดข้อมูล
        ↓
UI แสดงทักษะที่ตรงและ gap; ขั้น RAG ภายหลังใช้ค้นเนื้อหาเรียนรู้สำหรับ gap
```

### ความรับผิดชอบตามส่วนระบบ

- **Data pipeline / Market**: รวบรวมประกาศงานและคำนวณ `career_skill_stats`; เป็นเจ้าของนิยามน้ำหนักและคุณภาพสถิติ
- **Backend**: โหลดข้อมูลตาม career profile, ตรวจเงื่อนไข และคำนวณผลแบบ deterministic; ให้คำอธิบายต่อ skill
- **Frontend**: แสดงคะแนน สถานะ หลักฐาน และคำเตือนตาม response; ไม่คำนวณสูตรซ้ำเอง
- **RAG / knowledge**: ทำงานหลังได้ gap แล้ว เพื่อค้นเอกสาร/หัวข้อที่ช่วยพัฒนาทักษะ ไม่ใช่ตัวคำนวณ match และไม่ใช่แหล่งพิสูจน์ว่าผู้ใช้มี skill

## 9. การจัดลำดับ gap สำหรับ roadmap

รุ่นแรกให้จัดอันดับ gap ด้วย `weighted_demand_score` จากมากไปน้อย โดยแยกอย่างน้อย:

1. `missing_from_profile`: ยังไม่พบ skill ในโปรไฟล์ที่ยืนยัน
2. `proficiency_gap`: มี skill แต่ระดับต่ำกว่า target ที่เชื่อถือได้
3. `not_assessed`: มี skill แต่ระดับผู้ใช้หรือระดับตลาดไม่ชัด
4. `market_data_insufficient`: ข้อมูลตลาดไม่พอสำหรับให้คำแนะนำระดับ

ห้ามสรุป dependency หรือ prerequisite จากการที่ skill อยู่ในลำดับคะแนน หรือจากการพบ skill ร่วมกันในประกาศงาน การจัดลำดับก่อน-หลังเพื่อการเรียนต้องใช้ dependency ที่มีเอกสารหลักฐานและผ่านการ review แยกต่างหาก เมื่อ RAG พร้อมจึงค้นเนื้อหาประกอบ gap แต่ละรายการ

## 10. ความผิดพลาดและกรณีขอบ

| กรณี | พฤติกรรมที่เสนอ |
|---|---|
| ไม่มี career profile ที่ match | ขอให้ผู้ใช้เลือกอาชีพ หรือแจ้งว่ายังประเมินไม่ได้; ไม่เดาจาก role title |
| ไม่มี market stats | `insufficient_market_data`; ไม่แสดง 0% |
| ไม่มี skill ที่ match ในโปรไฟล์ | coverage 0% เฉพาะเมื่อ market data ใช้ได้ และบอกว่าเป็น “ยังไม่พบในโปรไฟล์” |
| มี unmatched/needs-review skills | ไม่นับคะแนน; คืนเป็นรายการที่ต้อง resolve |
| user proficiency เป็น `unknown` | คงสถานะ `not_assessed`; ไม่เท่ากับ beginner |
| target level เป็น `unknown` หรือ confidence ต่ำ | ยังใช้ skill สำหรับ coverage ได้ถ้าน้ำหนักตลาดใช้ได้; ข้ามการเทียบ proficiency พร้อมคำเตือน |
| target level มี observation น้อย | ใช้เกณฑ์ขั้นต่ำที่ทีมกำหนด; หากไม่ผ่านให้ `market_data_insufficient` สำหรับระดับ |
| สถิติมีน้ำหนักเป็น null | ใช้นโยบาย missing-weight ที่ตกลงแล้ว; ไม่แทนด้วย 0 โดยปริยาย |
| โปรไฟล์ยังไม่ยืนยัน | แสดงผล provisional หรือรอการยืนยันตาม product flow; ห้ามแสดงเป็นผลยืนยันแล้ว |
| ข้อมูลตลาดเก่าหรือ sample น้อย | แสดง status/warning พร้อมช่วงเวลาและ sample count |

## 11. API, การคำนวณซ้ำ และการจัดเก็บ

ระบบคำนวณเมื่อผู้ใช้ขอดูผล และยังไม่บันทึกคะแนนลงฐานข้อมูล เพราะคะแนน derive จากโปรไฟล์และ market stats ซึ่งเปลี่ยนได้เมื่อผู้ใช้แก้ CV หรือข้อมูลตลาดอัปเดต

Calculation service แยกจาก route/database access แล้ว หากภายหลังต้องเก็บประวัติผล ให้เก็บ snapshot พร้อม `computed_at`, market window/version และ input reference เพื่ออธิบายคะแนนย้อนหลังได้

route ที่ implementation ใช้: `GET /api/profiles/{profileId}/career-match?careerProfileId=...` โดยส่ง anonymous session ผ่าน header `X-Session-Id` และตรวจให้ตรงกับ profile ก่อนคืน evidence; การรับ career profile เป็น parameter ทำให้ยังไม่ผูกกับ career goal ที่บันทึกไว้

## 12. การตรวจคุณภาพก่อนปล่อยใช้

ก่อนแสดงคะแนนจริง ควรเตรียมตัวอย่าง CV ที่ตรวจโดยคนแล้วจาก 2–3 อาชีพ และกำหนด expected skills/status ต่อกรณี จากนั้นตรวจว่า:

- skill canonical match ถูกต้อง และรายการ unmatched ไม่ถูกนับเงียบ ๆ
- เปลี่ยน profile skill ที่ยืนยันแล้วหนึ่งรายการแล้ว coverage เปลี่ยนตามน้ำหนักที่คาด
- skill น้ำหนักสูงส่งผลมากกว่า skill น้ำหนักต่ำ
- `unknown` ไม่ถูกตีเป็น beginner และ assessment coverage ลดลงตามข้อมูลที่ประเมินไม่ได้
- target level ที่ confidence ต่ำ/จำนวน observation น้อยไม่ทำให้เกิด proficiency gap แบบมั่นใจเกินจริง
- คะแนนและเหตุผลที่ UI เห็นสอดคล้องกับรายละเอียดราย skill และ market window
- คำว่า “coverage” ไม่ถูกนำเสนอเป็นโอกาสได้งาน

ตัวชี้วัดสำหรับดูคุณภาพ ได้แก่ precision ของ canonical matching, ความเห็นตรงกันระหว่างผู้ตรวจเรื่องสถานะ covered/gap, จำนวน skill ที่ประเมินได้, อัตรา profile ที่ไม่มี market mapping และการเปลี่ยนแปลงผลเมื่ออัปเดต market window

## 13. ขั้นตอนทดลองผ่าน demo ปัจจุบัน

1. เปิดหน้า `/onboarding/cv` แล้วอัปโหลด CV
2. ตรวจและยืนยันข้อมูลโปรไฟล์ เพื่อบันทึกข้อมูลลงฐานข้อมูล
3. เลือก career profile ที่ต้องการเปรียบเทียบ
4. เรียก `GET /api/profiles/{profileId}/career-match` และแสดง coverage, proficiency alignment, assessment coverage พร้อมรายละเอียดราย skill
5. ใช้ผลทดลองกับ CV ตัวอย่างที่ตรวจโดยคนแล้วเพื่อทบทวน quality thresholds และ rubric ก่อนนำไปใช้จริง

## 14. ประเด็นที่ควร review และปรับจากผลทดลอง

ค่าเริ่มต้นสำหรับ demo ที่ implement แล้วคือแสดง Core 20 coverage แยกจาก all-market coverage, แสดง proficiency/assessment แยกกัน, คำนวณ gap priority เฉพาะ Core skills และรับ `careerProfileId` ที่ผู้ใช้เลือกในคำขอ ประเด็นที่ยังต้องตัดสินใจก่อน production คือคุณภาพและความสดของ market data, การปรับเทียบ rubric ระดับ proficiency, การจัดการ inferred levels และการสื่อสารข้อจำกัดให้ผู้ใช้เข้าใจ

## 15. Backend implementation handoff: Onboarding → Career Match

ส่วนนี้เป็นข้อกำหนดสำหรับ backend/API และ frontend จริง ใช้ endpoint และ field ที่ demo ปัจจุบัน implement ไว้เป็นจุดเริ่มต้น โดยไม่ต้องเพิ่มตารางหรือ migration สำหรับการคำนวณรอบนี้

### 15.1 ลำดับการทำงาน

1. ผู้ใช้ตรวจและยืนยันข้อมูลโปรไฟล์จาก CV หรือกรอกโปรไฟล์เอง
2. Backend บันทึก profile และ canonical user skills ลง `app.user_profiles`, `app.user_skills` และ `app.user_skill_evidence` ตาม flow เดิม
3. ผู้ใช้เลือกอาชีพ/ระดับเป้าหมาย ซึ่งต้อง resolve เป็น `careerProfileId` ที่มี market snapshot
4. Client เรียก `GET /api/profiles/{profileId}/career-match?careerProfileId={id}` พร้อม `X-Session-Id` ของ anonymous session
5. Backend ตรวจเจ้าของ profile, โหลด user skills ที่ยืนยันแล้ว, โหลด market rows จาก coherent window เดียว, แล้วคำนวณคะแนนแบบ deterministic โดยไม่เรียก LLM/RAG
6. Client แสดง Core 20 score, คะแนนประกอบ, สถานะคุณภาพข้อมูล, potential gaps และข้อมูลตลาดที่ใช้คำนวณ
7. หากต่อไปจะส่ง gap เข้า Roadmap/RAG ให้ส่งเฉพาะ skill IDs พร้อมสถานะและหลักฐานจากผล API นี้ ห้ามให้ RAG คำนวณคะแนนซ้ำหรืออนุมานว่า `missing_from_profile` คือผู้ใช้ไม่มีทักษะจริง

### 15.2 แหล่งข้อมูลและการกรอง

- **ผู้ใช้:** ใช้ canonical `skill_id` ที่ matched และ profile ที่ผู้ใช้ยืนยันแล้วเท่านั้น; unmatched/needs-review labels คืนแยกและไม่เข้า score
- **ตลาด:** ใช้ `market.career_skill_stats` ของ `careerProfileId` ที่เลือก เลือก latest coherent analysis window ตาม `analysis_end_date` แล้ว `analysis_start_date`; ห้ามรวมหลาย window
- **Market weight:** ใช้ `weighted_demand_score` ที่มีค่ามากกว่า 0; null/zero ถูกตัดออกจากตัวหารพร้อมรายงาน `excludedMarketSkills`
- **ระดับ:** ใช้ `target_level` เฉพาะเมื่อ confidence และจำนวน observations ผ่าน quality gates; ค่า `unknown` ห้ามแทนเป็น beginner
- **ไม่บันทึกคะแนน:** คะแนน derive ใหม่ทุก request จากโปรไฟล์และ market snapshot ปัจจุบัน; หากต้องการประวัติในอนาคต ให้เพิ่ม snapshot/version design แยกต่างหาก

### 15.3 สูตรที่ backend ต้องใช้ร่วมกัน

เรียง market rows ที่มีน้ำหนักใช้ได้จาก `weighted_demand_score` มากไปน้อย โดยใช้ชื่อ skill แบบ case-insensitive เป็นตัวตัดสินลำดับให้คงที่ เลือก 20 รายการแรก แล้วรวม skill ทุกตัวที่น้ำหนักเท่ากับน้ำหนักอันดับ 20 ด้วย (`coreSkillPolicy.version = weighted-top-20-with-cutoff-ties-v1`). ถ้ามี usable skills น้อยกว่า 20 ให้ใช้ทั้งหมด

```text
coreSkillMatchPct = 100 × sum(weight ของ Core skills ที่พบในโปรไฟล์ที่ยืนยันแล้ว)
                       / sum(weight ของ Core skills ทั้งหมด)

marketSkillCoveragePct = 100 × sum(weight ของ usable market skills ที่พบในโปรไฟล์)
                            / sum(weight ของ usable market skills ทั้งหมด)

level_gap = market_target_level_index - user_level_index
level_fit = max(0, 1 - max(0, level_gap) / 3)
proficiencyAlignmentPct = weighted average(level_fit) ของ skill ที่ประเมินระดับได้
assessmentCoveragePct = 100 × usable market weight ที่ประเมินระดับได้ / usable market weight ทั้งหมด

gapScore = 1.0                         เมื่อ Core skill ไม่พบใน confirmed profile
gapScore = level_gap / 3               เมื่อ Core skill มี positive proficiency gap
gapScore = null                        เมื่อไม่ใช่ gap หรือข้อมูลประเมินไม่ได้
priorityScore = 100 × gapScore × (skill_weight / total_core_weight)
```

`coreSkillMatchPct` วัดการมี skill ในโปรไฟล์ ไม่วัด proficiency และไม่ใช่ job-readiness score ผู้ใช้ที่มี skill แต่ระดับ `unknown` ยังนับว่าพบใน coverage แต่ระดับจะเป็น `not_assessed` และไม่เข้า proficiency denominator

เรียง potential gaps ด้วย `priorityScore` มากไปน้อย; กรณีเสมอให้เรียง `weightedDemandScore` มากไปน้อย แล้วชื่อ skill แบบ case-insensitive จากน้อยไปมาก `priorityRank` ใช้เฉพาะ Core skills ที่คำนวณ gap score ได้ สถานะ `missing_from_profile` และ `not_assessed` ต้องส่ง `requiresConfirmation=true`; ถ้าผู้ใช้มี skill แต่ระดับเป็น inferred/unknown ก็ต้องให้ผู้ใช้ตรวจระดับก่อนนำไปวางแผนเรียน

### 15.4 Response ที่ client ต้องใช้

- `scores.coreSkillMatchPct`: คะแนนหลักสำหรับภาพรวมการครอบคลุม Core skills
- `scores.marketSkillCoveragePct`: คะแนนภาพรวมทุก usable market skills เพื่อเทียบกับ Core score
- `scores.proficiencyAlignmentPct` และ `scores.assessmentCoveragePct`: แสดงแยกกัน ห้ามรวมกับ Core score เป็นคะแนนเดียว
- `coreSkillPolicy`: version, nominal limit และจำนวน skill จริงหลังรวม ties
- `skillSummary.coreCovered/coreConsidered`: จำนวน Core skills ที่พบ/ที่ใช้คำนวณ
- `skills[]`: รายละเอียด canonical skill, target/current level, status/reason, market weight, `isCoreSkill`, `coreRank`, `gapScore`, `priorityScore`, `priorityRank`, `requiresConfirmation` และ evidence excerpts
- `status`/`warnings`/`marketWindow`/`marketSample`: ต้องแสดงเพื่อให้ผู้ใช้ทราบว่าคะแนนมาจากข้อมูลช่วงใดและมีข้อจำกัดอะไร

หน้าทดลอง `/onboarding/cv` เรียก API เดียวกันและแสดง field เหล่านี้เพื่อตรวจสูตร ไม่ใช่ข้อกำหนดว่าหน้า onboarding จริงต้องใช้ layout เดียวกัน

### 15.5 เกณฑ์ตรวจรับสำหรับ backend integration

- เมื่อ Core skill หนึ่งรายการมีน้ำหนักสูงขึ้น คะแนน Core coverage เปลี่ยนตามสัดส่วนของ Core weights; all-market score ยังใช้ตัวหาร all usable skills
- การเปลี่ยน confirmed profile skill จากไม่มีเป็นมี ทำให้ coverage ของ skill นั้นเพิ่มตาม weight; การเปลี่ยนระดับอย่างเดียวกระทบ proficiency alignment/gap แต่ไม่เปลี่ยน presence coverage
- Skills นอก Core ไม่มี `gapScore`, `priorityScore` หรือ `priorityRank`
- `missing_from_profile` แสดงเป็น potential gap ที่ผู้ใช้ยืนยันได้ ไม่แสดงว่า “ไม่มีความสามารถ”
- `unknown`, market target confidence ต่ำ, sample เล็ก, ข้อมูลเก่า หรือไม่มี usable weights ต้องคืนสถานะ/คำเตือนตาม contract โดยไม่สร้างตัวเลขปลอม
- ผล API ที่ frontend ใหม่ใช้ต้องเทียบกับรายการราย skill และ market snapshot เดียวกันได้ และต้องไม่เรียก RAG เพื่อคำนวณ Match score ซ้ำ

ข้อจำกัดที่ยังต้องสื่อสาร: Top 20 เป็นขอบเขตคะแนนเพื่อให้ภาพรวมไม่ถูก skill หางยาวครอบงำ ไม่ได้แปลว่าผู้ใช้ต้องเรียนครบ 20 skills; ลำดับ priority ไม่ใช่ prerequisite/dependency; และ gap score เป็น heuristic สำหรับ demo ที่ยังต้องทบทวนกับ CV และ market snapshots จริงก่อนใช้เป็นเกณฑ์ production
