# Deploy Glow Job บน EC2 Ubuntu 24.04

Frontend React/Vite + Nginx + FastAPI/systemd อยู่ EC2 เครื่องเดียวกัน ไม่ใช้ Docker
และไม่บังคับ EC2 IAM role. ตัวอย่าง subdomain คือ `glowjob.modnoi.com` ยังไม่ได้ยืนยัน
ว่าเจ้าของโดเมนตั้ง DNS แล้ว หากใช้ชื่ออื่นให้เปลี่ยนทุกจุดในคู่มือนี้และ nginx.conf.

```text
HTTPS → Nginx → /       frontend build
             → /api/  127.0.0.1:8787 FastAPI → DB / Bedrock
```

ไฟล์ชุดนี้ยังไม่ได้ทดสอบบน EC2 จริง และไม่ได้สร้าง AWS resources, DB, DNS หรือ
GitHub Actions ให้. การ push จะยังไม่ deploy อัตโนมัติจนกว่าจะตั้ง workflow แยก.

## 1. เตรียมเครื่องและสิทธิ์

- Ubuntu 24.04, Python 3.12; Node.js 24 LTS ต้องติดตั้งแบบ system-wide
  ให้ user `glowjob` เรียก `node` และ `npm` ได้ ไม่ใช่ติดตั้งด้วย nvm เฉพาะ ubuntu.
- เครื่องต้องเชื่อม internet เพื่อดาวน์โหลด dependencies และเรียก AI providers.
- เปิด inbound 80/443 สำหรับเว็บไซต์, 22 เฉพาะ IP ผู้ดูแล. ไม่เปิด 8787 หรือ DB สู่ internet.
- ใช้ IP คงที่สำหรับ DNS เช่น Elastic IP (public IPv4 มีค่าใช้จ่าย).
- DB ต้องมี schema, extensions, migrations และข้อมูลที่แอปต้องใช้ก่อนทดสอบ flow จริง.

จาก PowerShell เครื่องเรา:

```powershell
ssh -i "C:\path\your-key.pem" ubuntu@EC2_IP
```

จากนี้รันบน EC2 เว้นแต่ระบุเป็นอย่างอื่น:

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates xz-utils nginx python3.12-venv
id glowjob || sudo useradd --system --create-home --home-dir /var/lib/glowjob --shell /usr/sbin/nologin glowjob
sudo install -d -o glowjob -g glowjob -m 700 /var/lib/glowjob/.ssh
```

## 2. Deploy Key และ clone

คุณทดสอบ `sudo -u glowjob ssh -T git@github.com` สำเร็จแล้ว จึงไม่ต้องสร้าง key หลักซ้ำ.
หากเริ่มเครื่องใหม่ ให้สร้าง key แล้วเพิ่ม **เฉพาะ .pub** ที่ repo Settings → Deploy keys
โดยไม่เลือก Allow write access. ตรวจ fingerprint GitHub ก่อนยอมรับ host ครั้งแรก.

```bash
# เฉพาะเครื่องใหม่ที่ยังไม่มี key (ห้ามทับ key เดิม)
sudo -u glowjob ssh-keygen -t ed25519 -C glow-job-ec2 -f /var/lib/glowjob/.ssh/id_ed25519 -N ""
sudo cat /var/lib/glowjob/.ssh/id_ed25519.pub
```

Clone ครั้งแรก; ถ้า /opt/glow-job มี checkout อยู่แล้ว ให้ข้าม clone และตรวจ `git status`:

```bash
sudo install -d -o glowjob -g glowjob /opt/glow-job
sudo -u glowjob git clone git@github.com:THN4/glow-job.git /opt/glow-job
cd /opt/glow-job
```

### Submodule data-pipeline

Repo หลักอ้าง `https://github.com/THN4/glow-job-data-pipeline`. ถ้าเป็น public ใช้:

```bash
sudo -u glowjob git submodule update --init --recursive
```

ถ้าเป็น private ต้องใช้ key **อีกชุด** เพราะ GitHub Deploy Key อ่านได้ repo เดียว:

```bash
sudo -u glowjob ssh-keygen -t ed25519 -C glow-job-pipeline-ec2 -f /var/lib/glowjob/.ssh/pipeline_ed25519 -N ""
sudo cat /var/lib/glowjob/.ssh/pipeline_ed25519.pub
```

เพิ่ม public key ที่ **THN4/glow-job-data-pipeline → Settings → Deploy keys** แบบ read-only.
แก้ SSH config โดยเก็บ config เดิมไว้:

```bash
sudo -u glowjob nano /var/lib/glowjob/.ssh/config
```

เพิ่ม block:

```sshconfig
Host github-pipeline
    HostName github.com
    User git
    IdentityFile /var/lib/glowjob/.ssh/pipeline_ed25519
    IdentitiesOnly yes
```

```bash
sudo chmod 600 /var/lib/glowjob/.ssh/config
sudo -u glowjob ssh -T git@github-pipeline
# ข้อความ authenticated สำเร็จของ GitHub ปกติคืน exit code 1 เพราะไม่มี shell
cd /opt/glow-job
sudo -u glowjob git submodule init
sudo -u glowjob git config submodule.data-pipeline.url git@github-pipeline:THN4/glow-job-data-pipeline.git
sudo -u glowjob git submodule update --init --recursive
test -f data-pipeline/src/resume/config.py && echo "data-pipeline ready"
```

อย่ารัน `git submodule sync` หลังตั้ง override นี้ เพราะ .gitmodules ยังใช้ HTTPS.
หากมี nested private submodules ต้องให้สิทธิ์ repo เหล่านั้นเพิ่มเติม.

## 3. ใช้ .env ที่วางไว้บน EC2 แล้ว

ใช้ไฟล์เดิมที่ `/opt/glow-job/backend/.env` ไม่ต้อง copy `.env.example` ทับ
และไม่ต้องย้าย credentials ไปไฟล์ใหม่. install.sh/update.sh ไม่สร้างหรือแก้เนื้อหา .env.
systemd โหลดไฟล์นี้เป็น environment ของ backend จึงส่ง AWS credentials ให้ SDK ด้วย.

```bash
cd /opt/glow-job
sudo test -f backend/.env && echo ".env ready"
sudo chown glowjob:glowjob backend/.env
sudo chmod 600 backend/.env
```

หากไฟล์ที่วางไว้เป็น `/opt/glow-job/.env` จะเป็นคนละตำแหน่งกับ backend:
ให้ตรวจว่าเป็น config สำหรับ backend จริง (root .env อาจเป็น config Docker Compose).
ถ้าใช่และ backend/.env ยังไม่มี ค่อยคัดลอกโดยไม่ทับไฟล์ปลายทาง:

```bash
sudo cp --no-clobber /opt/glow-job/.env /opt/glow-job/backend/.env
sudo chown glowjob:glowjob /opt/glow-job/backend/.env
sudo chmod 600 /opt/glow-job/backend/.env
```

ตรวจเฉพาะค่าที่ต่างจาก local ผ่าน `sudo nano /opt/glow-job/backend/.env`.
ตัวอย่างต่อไปนี้เป็นชื่อค่าที่ต้องตรวจ ไม่ต้องวาง placeholder ทับค่าจริงที่มีอยู่แล้ว.
อย่าเพิ่ม key ซ้ำ (`GEMINI_API_KEY` ใน example มีซ้ำ ให้เหลือบรรทัดเดียว):

```dotenv
PUBLIC_BASE_URL=https://glowjob.modnoi.com
CORS_ORIGINS=https://glowjob.modnoi.com
DATA_DIR=/var/lib/glowjob/data
DB_HOST=YOUR_DB_ENDPOINT
DB_PORT=5432
DB_NAME=YOUR_DB_NAME
DB_USER=YOUR_APP_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD
RESUME_EXTRACTOR=bedrock_converse
ROADMAP_PROVIDER=bedrock_converse
AWS_DEFAULT_REGION=us-east-1
ROADMAP_AWS_REGION=us-east-1
GEMINI_API_KEY=YOUR_GEMINI_KEY
```

ใช้ model/inference profile ที่บัญชีและ Region มีสิทธิ์เรียกจริง ตรวจค่า
`BEDROCK_EXTRACTION_MODEL`, `BEDROCK_RAG_MODEL`, `BEDROCK_ROADMAP_MODEL` ใน example
ให้ตรงกัน. Live RAG ยังใช้ Gemini embeddings แม้ roadmap ใช้ Bedrock.
ถ้าทดสอบผ่าน IP ก่อน HTTPS ให้ใช้ `http://EC2_IP` ในสอง URL แรก แล้วเปลี่ยนกลับภายหลัง.

DB: หากใช้ RDS เดิม ให้ใช้ endpoint โดยตรง ไม่ใช่ Windows SSH tunnel พอร์ต 15432.
เปิด DB Security Group ให้รับจาก EC2 Security Group เท่านั้น. หากติดตั้ง PostgreSQL
บน EC2 เองใช้ 127.0.0.1 และ restore/migrate ข้อมูลแยก; คู่มือนี้ไม่ติดตั้งหรือแก้ข้อมูล DB.

เมื่อไม่มี EC2 role ให้เก็บ credentials ที่มีสิทธิ์จริงใน **backend/.env เดิม**.
ถ้ามีอยู่แล้วไม่ต้องเพิ่มซ้ำ เลือกวิธี authentication ที่ใช้งานจริง:

```dotenv
# ทางเลือก A: Bedrock API key (ใช้กับ Bedrock เท่านั้น)
AWS_BEARER_TOKEN_BEDROCK=YOUR_KEY
```

หรือ AWS credentials ที่มีสิทธิ์อยู่แล้ว:

```dotenv
# ทางเลือก B: AWS access keys; temporary credentials ต้องมี session token
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
# AWS_SESSION_TOKEN=YOUR_SESSION_TOKEN
```

ใช้รูปแบบ `KEY=value` หรือ `KEY="value"` ทีละบรรทัด ไม่ใส่ `export`, shell commands,
หรืออ้างตัวแปรแบบ `${OTHER_KEY}` เพราะ systemd ไม่ขยายตัวแปรใน EnvironmentFile.
แยก comment เป็นบรรทัดขึ้นต้น `#`; ค่าที่มีช่องว่างหรือ `#` ให้ครอบด้วย quotes.
Key/session ที่หมดอายุต้องเปลี่ยนและ restart service. ไม่ส่ง credentials ไป frontend
หรือ commit ลง Git. การไม่มี role ไม่ได้ข้าม IAM permissions ของ Bedrock/S3.

ถ้าเคยสร้าง `/etc/glow-job-credentials.env` จากคู่มือเก่า service ยังรองรับเพื่อให้ของเดิม
ทำงานต่อได้ แต่ค่าชื่อเดียวกันในไฟล์นั้นจะมีลำดับสูงกว่า backend/.env.
ถ้าจะใช้เฉพาะ backend/.env ให้เอาบรรทัด `EnvironmentFile=-/etc/glow-job-credentials.env`
ออกจาก unit ที่ติดตั้ง และตรวจ drop-in เดิมด้วย `sudo systemctl cat glow-job`.
ไม่จำเป็นต้องสร้างไฟล์ credentials แยกสำหรับการติดตั้งใหม่.

### ถ้าติดตั้ง service รุ่นเก่าไว้แล้ว

หลังนำไฟล์ deploy เวอร์ชันใหม่นี้ขึ้น EC2 ให้ปรับ unit โดยไม่แตะ .env:

```bash
sudo install -m 644 /opt/glow-job/deploy/ec2/glow-job.service /etc/systemd/system/glow-job.service
sudo systemctl daemon-reload
sudo systemctl restart glow-job
curl --fail http://127.0.0.1:8787/api/health
```

หากแก้เพียงค่าภายใน .env หลังจากนี้ ใช้ `sudo systemctl restart glow-job` ก็พอ.
ไม่ต้อง daemon-reload เว้นแต่แก้ unit/drop-in.

## 4. ติดตั้ง backend และ Node.js

ไฟล์ deploy ชุดนี้ต้องอยู่ใน GitHub commit ที่ clone/pull ลง EC2 แล้วก่อนเรียก:

```bash
cd /opt/glow-job
sudo bash deploy/ec2/install.sh
curl --fail http://127.0.0.1:8787/api/health
```

Health ยืนยันเฉพาะ process ไม่ยืนยัน DB/AI. หากไม่ผ่าน:

```bash
sudo journalctl -u glow-job -n 80 --no-pager
```

ติดตั้ง Node.js 24 LTS แบบ system-wide ด้วยสคริปต์ที่ดาวน์โหลด official Linux binary
สำหรับ x64/arm64 และตรวจ SHA256 ก่อนแตกลง /usr/local. ค่าเริ่มต้น pin 24.22.1;
ตรวจ security updates และส่งเลข Node 24 เวอร์ชันใหม่เป็น argument เมื่อต้องอัปเดต.
หากมี Node 24 ติดตั้งให้ทุก user ใช้ได้อยู่แล้ว ให้ข้าม install-node.sh:

```bash
sudo bash deploy/ec2/install-node.sh
sudo -u glowjob node --version
sudo -u glowjob npm --version
```

หากเห็น command not found แสดงว่า Node/npm ยังไม่อยู่ใน PATH ของ glowjob;
การติดตั้ง nvm เฉพาะ ubuntu ไม่เพียงพอ.

## 5. DNS และ Nginx (ติดตั้งครั้งแรก)

ที่ DNS ของ modnoi.com เพิ่ม A record: name `glowjob`, value = EC2 public/Elastic IP.
หากชื่อนี้ใช้งานอยู่แล้ว ตรวจเจ้าของก่อนเปลี่ยน. Cloudflare เริ่มด้วย DNS only.
ไม่ต้องเปลี่ยน DNS ของ root domain หรือซื้อโดเมนใหม่.

```bash
cd /opt/glow-job
# ครั้งแรกเท่านั้น หากมี config อยู่แล้วให้สำรอง/แก้ในไฟล์เดิม
sudo install -m 644 deploy/ec2/nginx.conf /etc/nginx/sites-available/glow-job
sudo ln -sfn /etc/nginx/sites-available/glow-job /etc/nginx/sites-enabled/glow-job
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Build และเปิด frontend (ใช้ branch main; ถ้า deploy branch อื่นส่งชื่อเป็น argument):

```bash
cd /opt/glow-job
sudo bash deploy/ec2/update.sh main
curl --fail http://glowjob.modnoi.com/api/health
```

สคริปต์สร้าง frontend ใน releases แล้วสลับ symlink `current` หลัง build และ backend
health ผ่าน. เก็บ hashed assets จาก release เดิมไว้ให้แท็บ browser ที่เปิดค้าง.
ยังไม่รับประกัน zero downtime หรือ backend rollback เพราะ backend ใช้ checkout/venv เดียว.

## 6. HTTPS

ทำเมื่อ DNS resolve ถูกและ HTTP เข้าถึง EC2 ผ่านพอร์ต 80 ได้แล้ว:

```bash
# ใช้ Certbot snap หากเครื่องยังไม่ได้ติดตั้ง Certbot ด้วยวิธีอื่น
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d glowjob.modnoi.com
sudo /snap/bin/certbot renew --dry-run
curl --fail https://glowjob.modnoi.com/api/health
```

ถ้า Certbot ติดตั้งอยู่แล้วให้ใช้ตัวเดิม ไม่ลงซ้ำต่างวิธี. ตั้ง PUBLIC_BASE_URL และ
CORS_ORIGINS เป็น HTTPS ตามข้อ 3 แล้ว `sudo systemctl restart glow-job`.
ไม่คัดลอก nginx.conf template ทับ config ที่ Certbot เพิ่ม TLS แล้ว.
ทดสอบหน้าเว็บ, refresh route ย่อย, upload CV สังเคราะห์, extraction, profile, DB และ roadmap.
การเรียก AI จริงมีค่าใช้จ่าย.

## 7. Dev ต่อและอัปเดต EC2

เครื่องเรา: ทดสอบแล้ว commit/push branch ที่ใช้ deploy. หากแก้ data-pipeline ให้ push
repo นั้นก่อน แล้ว commit submodule pointer ใน glow-job. อย่า commit secrets.

EC2:

```bash
cd /opt/glow-job
sudo bash deploy/ec2/update.sh main
curl --fail https://glowjob.modnoi.com/api/health
```

update.sh ใช้ git fetch + fast-forward เท่านั้น ไม่ทับ tracked edits/commits บนเครื่อง,
อัปเดต submodule, npm ci/build ด้วย VITE_API_BASE_URL=/api, pip install,
restart backend และตรวจ process health ก่อนสลับ frontend. กัน deploy ซ้อนด้วย flock.
หากสคริปต์หยุด ให้แก้ error ก่อน ไม่ reset checkout เพื่อทับงาน.
การเปลี่ยน DB schema ต้อง review/backup/migrate แยก ไม่รัน migrations อัตโนมัติ.
หากแก้ service unit ให้ install unit ใหม่และ daemon-reload ตาม install.sh;
update.sh ไม่ทับ Nginx หรือ service unit เอง.

หากไฟล์ deploy เพิ่งเพิ่ม/แก้บน GitHub ก่อนเริ่มใช้สคริปต์เวอร์ชันใหม่:

```bash
cd /opt/glow-job
sudo -u glowjob git pull --ff-only origin main
```

## ข้อจำกัดและการกู้คืน

- งาน/cache อยู่ใน memory: ใช้ 1 worker, restart ทำให้สถานะงานหาย.
- DATA_DIR เก็บ fallback profiles; upload ชั่วคราวใช้ temp directory ของ service.
- สำรอง DB และ /var/lib/glowjob/data แยก; deploy นี้ไม่เพิ่ม auth/rate limiting.
- frontend releases อยู่ /var/www/glow-job/releases; ตรวจรายการและพื้นที่ก่อนลบเอง.
  สลับ current กลับ release ก่อนหน้าได้ด้วย symlink แต่ต้องตรวจว่า API ยัง compatible.
- หาก backend ใหม่เสีย frontend จะไม่สลับ แต่ backend ไม่ rollback อัตโนมัติ.
  ใช้ Git revert ผ่าน local/repo และ deploy commit แก้ไข; DB changes ต้องมีแผนกู้คืนแยก.
- ยังไม่มี auto-deploy เมื่อ push. GitHub Actions ต้องใช้ key สำหรับ SSH เข้า EC2 อีกชุด
  แยกจาก Deploy Key ที่ EC2 ใช้อ่าน GitHub และจำกัด branch/สิทธิ์ deploy.

อ้างอิง: [GitHub Deploy Keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys),
[Ubuntu TLS/Certbot](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/),
[Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html).
