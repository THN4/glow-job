# Career Match: ตัวอย่างเปรียบเทียบนโยบายคะแนน

**สถานะ:** ทดลองเพื่อให้ผู้ใช้ตรวจ ยังไม่เลือกสูตรหรือเปลี่ยน API ปัจจุบัน

โปรไฟล์ผู้ใช้ในรายงานเป็นข้อมูลสมมติที่สร้างจาก canonical IDs ของตลาด ไม่ได้ใช้ CV หรือข้อมูลส่วนตัวจริง

Career: Data Engineer (career_profile_id=1)

Snapshot: 2026-04-08 ถึง 2026-10-08 / first_seen_at

Market sample: 45 งาน, 209 skills; มีน้ำหนักบวก 209 skills

Skills ที่พบในงานเดียว: 123; market target level ที่ยัง unknown: 176

## สิ่งที่สูตรทดลองวัด

ทุกสูตรใช้ weighted coverage จากการมี canonical skill ที่ยืนยันแล้ว จึงไม่ใช่ความพร้อมทำงานหรือคะแนน proficiency ทั้งหมด สูตรแรกใช้ตัวหารแบบ marketSkillCoveragePct เดิม ส่วนอีกสองสูตรทดลองกรองตัวหารจาก market เท่านั้น ไม่ใช้ skill ที่ขาดของผู้ใช้หรือ Top-N Roadmap มาตั้งตัวหาร

การมีระดับ unknown ไม่เปลี่ยนคะแนนการมี skill แต่ยังนำไปสรุปว่าระดับถึงเป้าหมายไม่ได้ แผนนี้ยังไม่ตัดสินใจว่าจะเลือกสูตรใดหรือแสดงกี่คะแนน

| นโยบายทดลอง | Skill ในตัวหาร | น้ำหนักตลาดที่เก็บไว้ |
|---|---:|---:|
| existing_weighted_coverage | 209 | 100.00% |
| top_weight_count_with_ties | 10 | 28.91% |
| cumulative_weight_with_ties | 92 | 80.14% |

พารามิเตอร์ทดลอง: count=10, cumulative share=0.80 ค่าที่อยู่ตรงขอบและมีน้ำหนักเท่ากันถูกเก็บทั้งกลุ่ม จึงอาจได้มากกว่า count ที่ตั้งไว้

## ผลจากโปรไฟล์สมมติ

| โปรไฟล์ | มี skills | ระดับที่ทราบ | สูตรเดิม | จำกัดจำนวนตามน้ำหนัก | สะสมน้ำหนักตลาด |
|---|---:|---:|---:|---:|---:|
| no_confirmed_skills | 0 | 0 | 0.00% | 0.00% | 0.00% |
| top_weight_skills_only | 10 | 10 | 28.91% | 100.00% | 36.08% |
| tail_skills_only | 10 | 10 | 1.09% | 0.00% | 0.00% |
| top_and_tail_skills | 20 | 20 | 30.01% | 100.00% | 36.08% |
| top_weight_skills_unknown_levels | 10 | 0 | 28.91% | 100.00% | 36.08% |
| all_market_skills | 209 | 209 | 100.00% | 100.00% | 100.00% |

top_weight_skills_only มีเฉพาะกลุ่มน้ำหนักสูง ส่วน tail_skills_only มีทักษะน้ำหนักต่ำที่ไม่ซ้อนกับกลุ่มแรก โดยจำนวนเท่ากันถ้ามีทักษะเหลือพอ ทั้งสองชื่อเป็นวิธีสร้างตัวอย่าง ไม่ใช่การยืนยันว่าทักษะกลุ่มใดเป็น prerequisite หรือ core โดยสากล

## รายชื่อที่ใช้สร้างตัวอย่าง

กลุ่มน้ำหนักสูง: SQL, Python, ETL, ELT, Databricks, Spark, Azure, Hive, Snowflake, Power BI

กลุ่มน้ำหนักต่ำ: Visual FoxPro, SCSS, Flutter, Firebase, React Native, VB, BI datasets, LLM, Microsoft Office, GMP

## จุดที่ควรตรวจร่วมกันก่อนเลือกสูตร

- สูตรที่กรองตัวหารให้ 100% ได้แม้ยังขาดทักษะส่วนอื่น ต้องดูน้ำหนักที่ถูกตัดออกประกอบ
- จำนวนทักษะที่มีเท่ากันอาจได้คะแนนต่างกันตามความสำคัญใน snapshot นี้
- sample size และช่วงวันที่มีผลต่อความน่าเชื่อถือ ยังไม่ได้เลือกเกณฑ์ eligibility ขั้นสุดท้าย
- ต้องเทียบ career profile อื่นและ CV ตัวอย่างที่ตรวจแล้วก่อนรับรองนโยบายใช้งานจริง
- Availability และจำนวน skill ที่จะใส่ Roadmap ไม่ใช่ input ของสูตรคะแนนเหล่านี้
- ยังไม่มีผลจาก Roadmap Agent หรือการประเมิน proficiency ในรายงานนี้

Warnings จาก input preview: SOME_MARKET_TARGET_LEVELS_UNKNOWN
