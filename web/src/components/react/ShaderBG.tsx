/**
 * ShaderBG — พื้นหลังเกรเดียนต์เรนเดอร์ด้วย WebGL แบบผิวน้ำไหล
 * เรนเดอร์ผ่าน @react-three/fiber ในชุด shadergradient
 * ref: https://github.com/ruueee/shader-gradient (npm: shadergradient)
 */
import { useEffect, useState } from 'react';
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient';

interface ShaderBGProps {
  /** ความเร็วการไหลของผิวน้ำ (0 = หยุดนิ่ง) */
  speed?: number;
}

/** WebGL สร้าง context ได้หรือไม่ — ถ้าไม่ได้จะคืน fallback ธรรมดา หน้ายังใช้งานได้ครบ
 *  (เครื่องไม่มี GPU / headless CI ไม่ต้องพัง และห้ามมี error ใน console) */
function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function ShaderBG({ speed = 0.08 }: ShaderBGProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ไม่มี WebGL → คืนพื้นหลังสถิตที่มีเกรเดียนต์ CSS แทน (ห้ามสร้าง renderer ที่จะยิง error)
  if (!hasWebGL()) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(120% 120% at 20% 10%, #10b98155 0%, transparent 55%), radial-gradient(90% 90% at 85% 85%, #22d3ee44 0%, transparent 50%), #04150f',
        }}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ShaderGradientCanvas style={{ width: '100%', height: '100%' }} pixelDensity={0.5} fov={55}>
        <ShaderGradient
          type="waterPlane"
          animate={reduceMotion ? 'off' : 'on'}
          uSpeed={reduceMotion ? 0 : speed}
          color1="#052e16"
          color2="#10b981"
          color3="#22d3ee"
          lightType="env"
          envPreset="lobby"
          brightness={1}
          grain="off"
          cDistance={4}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
