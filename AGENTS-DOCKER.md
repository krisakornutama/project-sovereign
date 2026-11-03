# AGENTS-DOCKER.md — คำแนะนำสำหรับ agent อีกเครื่องหนึ่ง

Repo นี้คือ `project-sovereign` (เว็บสาธารณะ static site) แยกจาก `sovereign-origin` (desktop app, ห้ามแตะเด็ดขาด)

## สถานะข้อ 1 และข้อ 2 (ที่ทำแล้ว)

| ข้อ | สิ่งที่ทำ | ไฟล์ |
|-----|---------|------|
| 1 | Docker + docker-compose สำหรับ homelab | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `DOCKER.md` |
| 2 | GitHub Actions workflow (CI/CD + Pages) | `.github/workflows/docker-publish.yml`, `.github/workflows/pages.yml` |

## วิธีให้ agent อีกเครื่องมองเห็นผลงานเดียวกัน

```bash
cd path/to/project-sovereign
git fetch origin
git checkout feat/docker-homelab
docker compose up -d          # รันเว็บบน localhost:8080
```

## หมายเหตุสำคัญ

- **ห้ามแตะ `sovereign-origin`** (แอป desktop ที่มีข้อมูลจริง) — ทำงานเฉพาะใน `project-sovereign` เท่านั้น
- ขั้นขาย (Lemon Squeezy / Gumroad Pro License Key) ยังไม่ได้ทำ — ขอเอาไว้ทีหลัง
- การ `git push` อาจติดข้อจำกัด `workflow scope` ของ token หาก repo มีกติกาคุ้มครอง `.github/workflows/` ให้ใช้ PAT ที่มี `workflow` scope หรือ push จากเครื่องเจ้าของ repo
