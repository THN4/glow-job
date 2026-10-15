# วิธีนำไฟล์ฐานข้อมูล Glow-Job ไป restore

เอกสารนี้อธิบายขั้นตอนสำหรับผู้ที่ได้รับไฟล์ full database dump เพื่อนำเข้า
PostgreSQL ในเครื่องของตนเอง โดยไฟล์ dump มีทั้งโครงสร้างฐานข้อมูลและข้อมูล
เช่น schema, tables, indexes, extensions และข้อมูลใน schema `market`, `core`,
`knowledge`, `app` และ `system`

**ไม่ต้องสร้าง schema หรือตาราง และไม่ต้องรัน migration ก่อน restore** เพราะ
คำสั่ง restore จะสร้างสิ่งเหล่านี้จากไฟล์ dump ให้เอง ไฟล์นี้ไม่รวม PostgreSQL
roles หรือฐานข้อมูลอื่นบน server ต้นทาง

## สิ่งที่ต้องมี

- ติดตั้งและเปิด Docker Desktop แล้ว
- มี repository `glow-job` และ submodule `data-pipeline`
- ได้รับไฟล์ `glowjob-full.dump` จากผู้ส่ง
- ไฟล์ dump ต้องเป็น full dump รูปแบบ custom archive ซึ่งสร้างด้วย `pg_dump -Fc`

ตัวอย่างด้านล่างใช้ชื่อฐานข้อมูลและผู้ใช้ `glowjob` หากตั้งค่าใน `.env` เป็นชื่ออื่น
ให้เปลี่ยนค่า `-U` และ `-d` ในคำสั่ง restore ให้ตรงกัน

## 1. เตรียม repository และค่าฐานข้อมูล

เปิด PowerShell ที่ root ของ `glow-job` แล้วเตรียม submodule หากยังไม่มี:

```powershell
git submodule update --init --recursive data-pipeline
```

จากนั้นเข้า `data-pipeline` และถ้ายังไม่มี `.env` ให้สร้างจากตัวอย่าง:

```powershell
Set-Location "C:\path\to\glow-job\data-pipeline"
Copy-Item .env.example .env
```

แก้ `data-pipeline/.env` ให้มีค่า `DB_NAME`, `DB_USER`, `DB_PASSWORD` และ
`DB_PORT` ตามที่ต้องการ โดยใช้ `DB_HOST=localhost` สำหรับคำสั่งที่รันจาก Windows
เก็บไฟล์ `.env` ไว้ในเครื่องและอย่า commit เข้า Git

## 2. เปิด PostgreSQL เปล่า

รันจากโฟลเดอร์ `data-pipeline`:

```powershell
docker compose up -d postgres
```

คำสั่งนี้เริ่ม PostgreSQL และสร้างฐาน `glowjob` เปล่าตามค่าใน `.env` ยังไม่ต้อง
เตรียม schema หรือตารางเอง ให้ใช้ PostgreSQL ชุดนี้สำหรับ restore และอย่าเปิด
PostgreSQL จาก root Compose พร้อมกัน

## 3. นำเข้าไฟล์ dump

วาง `glowjob-full.dump` ไว้ในโฟลเดอร์ `data-pipeline` แล้วรัน:

```powershell
docker compose cp .\glowjob-full.dump postgres:/tmp/glowjob-full.dump
docker compose exec postgres pg_restore -U glowjob -d glowjob --clean --if-exists --exit-on-error --no-owner --no-privileges /tmp/glowjob-full.dump
```

`pg_restore` จะสร้าง schema และตาราง แล้วใส่ข้อมูลจาก archive ลงในฐานข้อมูล
ถ้าใช้ชื่อฐานหรือผู้ใช้ต่างจาก `glowjob` ให้แก้ `-d` และ `-U` ให้ตรงกับ `.env`

ตัวเลือก `--clean --if-exists` จะลบ object ที่อยู่ใน archive ก่อนสร้างใหม่
จึงควร restore ลงฐานว่างหรือฐานที่ตั้งใจให้ถูกแทนที่เท่านั้น หากมีข้อมูลที่ต้องเก็บ
ให้สร้างฐานข้อมูลใหม่แยกต่างหากก่อน restore

## 4. ตรวจสอบผลลัพธ์

ตรวจสอบว่ามี schema หลักในฐานข้อมูล:

```powershell
docker compose exec postgres psql -U glowjob -d glowjob -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('app', 'core', 'knowledge', 'market', 'system') ORDER BY schema_name;"
```

ควรเห็น schema ที่มีอยู่ใน dump รวมถึง `system` ซึ่งเก็บประวัติ migration

## หลัง restore

โดยปกติไม่ต้องรัน migration เพิ่ม เพราะ archive มี schema และตาราง
`system.schema_migrations` อยู่แล้ว หากภายหลังใช้โค้ดที่มี migration ใหม่กว่า
dump ที่ได้รับ ให้รัน `python -m scripts.database.migrate` จาก `data-pipeline`
หลัง restore เพื่อเติม migration ที่ยังขาด ตัว runner จะข้าม migration ที่บันทึก
ว่าใช้ไปแล้ว

ผู้รับไม่ต้องรัน pipeline ดึงงานจาก JSearch, crawler, document extraction,
chunking หรือ embedding เพื่อให้ได้ข้อมูลที่อยู่ใน dump
