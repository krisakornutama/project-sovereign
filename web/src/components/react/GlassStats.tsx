/**
 * GlassStats — การ์ดสถิติแบบ Apple "Liquid Glass"
 * ใช้ component LiquidGlass จาก rdev/liquid-glass-react
 * (lens effect ด้วย SVG displacement + ตามเมาส์แบบ elastic)
 * ref: https://github.com/rdev/liquid-glass-react
 */
import LiquidGlass from 'liquid-glass-react';

interface StatItem {
  value: string;
  label: string;
}

const stats: StatItem[] = [
  { value: '10,000+', label: 'ผู้ใช้งาน' },
  { value: '50,000+', label: 'ออเดอร์/เดือน' },
  { value: '99.9%', label: 'Uptime' },
];

export default function GlassStats() {
  return (
    <div className="glass-slot">
      <LiquidGlass
        mode="standard"
        cornerRadius={28}
        displacementScale={64}
        blurAmount={0.4}
        saturation={130}
        aberrationIntensity={0.3}
        elasticity={0.3}
        padding="18px 28px"
      >
        <dl className="flex items-center divide-x divide-black/10 px-2" aria-label="สถิติการใช้งาน">
          {stats.map((s) => (
            <div key={s.label} className="px-6 first:pl-2 last:pr-2 text-center">
              <dd className="text-heading-lg font-bold text-dark-950">{s.value}</dd>
              <dt className="text-body-sm text-dark-600 font-medium">{s.label}</dt>
            </div>
          ))}
        </dl>
      </LiquidGlass>
    </div>
  );
}
