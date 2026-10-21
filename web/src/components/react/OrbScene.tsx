/**
 * OrbScene — ลูกแก้ว polyhedron เรนเดอร์ด้วย React Three Fiber (pmndrs/react-three-fiber)
 * ใช้ intrinsic พื้นฐานของ three.js โดยตรง ไม่พึ่ง drei เพื่อคุมขนาด bundle
 * ref: https://github.com/pmndrs/react-three-fiber
 */
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Orb() {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.18;
      innerRef.current.rotation.x = Math.sin(t * 0.25) * 0.25;
    }
    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.1;
      outerRef.current.rotation.z = Math.cos(t * 0.2) * 0.2;
    }
  });

  return (
    <group>
      {/* แกนโลหะเขียวเข้ม โค้งด้าน */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshStandardMaterial
          color="#064e3b"
          emissive="#0d9488"
          emissiveIntensity={0.35}
          metalness={0.55}
          roughness={0.28}
          flatShading
        />
      </mesh>
      {/* โครงลวดสีฟ้า ชั้นนอก */}
      <mesh ref={outerRef} scale={1.32}>
        <icosahedronGeometry args={[1.35, 0]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export default function OrbScene({ className }: { className?: string }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.3} color="#34d399" />
      <directionalLight position={[-4, -2, 3]} intensity={0.6} color="#22d3ee" />
      <Orb />
    </Canvas>
  );
}
