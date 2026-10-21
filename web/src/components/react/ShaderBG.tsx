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

export default function ShaderBG({ speed = 0.08 }: ShaderBGProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
