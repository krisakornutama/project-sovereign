# รัน Project Sovereign ด้วย Docker (0 บาท)

เหมาะสำหรับกลุ่ม Homelab & Privacy Purists — ไม่ต้องผลิต ไม่ต้องส่งของ ไม่ต้องจ่ายค่าโฮสติ้ง

## ใช้งานบนเครื่องของคุณ

```bash
# โคลน repo (remote จริงของโปรเจกต์นี้)
git clone https://github.com/krisakornutama/project-sovereign.git
cd project-sovereign

# รัน
docker compose up -d

# เปิดเบราว์เซอร์
# http://localhost:8080

# ดูสถานะ
docker compose ps

# หยุด
docker compose down
```

## อัปเดตเวอร์ชันใหม่

```bash
docker compose pull
docker compose up -d
```

## สำหรับผู้พัฒนา (build เองบนเครื่อง)

```bash
docker compose build
docker compose up -d
```

## สำหรับ agent อีกเครื่องหนึ่ง (มองเห็นผลงานเดียวกัน)

```bash
git fetch origin
git checkout feat/docker-homelab
docker compose up -d
```

## พอร์ต

| ภายใน container | ภายนอกเครื่องคุณ |
|-----------------|-------------------|
| 80 (nginx)      | 8080              |

เปลี่ยนพอร์ตภายนอกได้ใน `docker-compose.yml` บรรทัด `ports: - "8080:80"`

---

หมายเหตุ: Repo นี้ให้บริการเป็น **static site** ผ่าน GitHub Pages เช่นกัน สำหรับอ่านคู่มือโดยไม่ต้องติดตั้ง Docker
