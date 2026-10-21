# sovereign-web — เว็บสาธารณะ (Astro + React islands)

เว็บสาธารณะของ Project Sovereign เวอร์ชัน enterprise — สร้างบน **Astro 5.18 (static output)** + **React 19 islands** + **Tailwind CSS v4** (ผ่าน PostCSS) ปัญหาหลักที่เกมชี้คือยังไม่มี TypeScript strict config

## วิธีรัน

```bash
npm install
npm run dev        # dev server (port 4321)
npm run build      # build → dist/
npm run preview    # เสิร์ฟ dist (port 4322)
```

## ไลบรารี visual ที่ใช้ (จาก GitHub)

| ลไลบรารี | repo | ใช้ที่ไหน |
|---|---|---|
| Liquid Glass | rdev/liquid-glass-react | `GlassStats` — การ์ดสถิติแบบ Apple Liquid Glass บนหน้าแรก |
| React Three Fiber | pmndrs/react-three-fiber | `OrbScene` — ลูกแก้ว 3D ในส่วน CTA + เป็น engine ของ ShaderGradient |
| Shader Gradient | ruueee/shader-gradient | `ShaderBG` — พื้นหลังเป็นแอนิเมชันผิวน้ำ WebGL ใน hero |

## Isowlands (React components) — `src/components/react/`

| ไฟล์ | หน้าที่ |
|---|---|
| `ShaderBG.tsx` | พื้นหลัง WebGL แบบผิวน้ำไหล เทคนิค: `type="waterPlane"` เขียวโอเปอเรติ่งตามแบแบรนด์ |
| `GlassStats.tsx` | การ์ด Liquid Glass สถิติ 3 ช่อง ใน hero |
| `OrbScene.tsx` | icosahedron 2 ชัน wireframe+metal หมุนช้า ใน CTA (ซ่อน < lg) |

ข้อดี: ทุก island ใช้ `client:only="react"` เพื่อไม่รบกวน SSR/SEO (โครงเนื้อหาหลักยัง static HTML) ใช้แบนวิดเจ็ตเบา (three/fiber เท่าที่จำเป็น)

## การเคารพผู้ใช้

- `prefers-reduced-motion: reduce` → ปิด animation ทาง JS (ส่ง `animate="off"` / speed 0) + ซ่อน canvas ทาง CSS
- จอ < 1024px → ซ่อน orb ประดับ (ไม่เปลืองแบตเตอรี่มือถือ)
- fallback พื้นหลัง CSS gradient เดิมอยู่ใต้ canvas สำหรับ JS/WebGL ไม่ทำงาน

## สถานะ deploy

- Branch พัฒนา: `feat/marketplace-import` (เว็บโฟลเดอร์ `web/`)
- Workflow deploy ยังใช้ `path: .` บน main — **ยังไม่ merge จนกว่าจะ apply patch** `workflow-stage-site.patch` (ดูที่ root ของ E:\Sovereign-Web-Standalone)
