import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  output: 'static',
  adapter: undefined,
  site: 'https://sovereignoriginshop.dpdns.org',
  build: {
    inlineStylesheets: 'auto',
    /* format 'file' → แต่ละหน้าสร้าง `<name>.html` ตรงกันกับ URL เดิมของเว็บชุดแรก
       ลิงก์เก่าทั้งภายใน/ภายนอก/sitemap ยังใช้ได้ และ deploy tree แทนที่ไฟล์เดิมได้เนียน ไม่ต้องมี redirect */
    format: 'file',
  },
  vite: {
    /* astro 7 + tailwind 4: ใช้ vite plugin ตรง ๆ (postcss-import ของ vite เก่าจับ @import "tailwindcss"
       เป็น path ไฟล์ก่อน plugin tailwind ทำงาน — vite plugin ตัดปัญหานี้ตั้งแต่ต้นทาง) */
    plugins: [tailwindcss()],
    build: {
      /* แยกชุดไลบรารีหนักออกเป็นจุดแยก ให้โค้ดแอปและหน้าเว็บโหลดไวกว่าโหลดรวมก้อนเดียว */
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'vendor-three';
            if (id.includes('node_modules/@react-three')) return 'vendor-r3f';
            if (id.includes('node_modules/react-dom')) return 'vendor-react-dom';
            if (id.includes('node_modules/react/jsx-runtime')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
  },
});