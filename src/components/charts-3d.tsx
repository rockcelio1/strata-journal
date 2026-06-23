import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Text } from "@react-three/drei";
import * as THREE from "three";

export type Chart3DDatum = { id: string; name: string; value: number; extra?: string };

const PALETTE = [
  "#1E3A8A", "#2563EB", "#0EA5E9", "#14B8A6", "#10B981",
  "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#84CC16",
  "#F97316", "#06B6D4",
];

function Bar({
  d, index, total, max, onClick,
}: { d: Chart3DDatum; index: number; total: number; max: number; onClick: (d: Chart3DDatum) => void }) {
  const ref = useRef<THREE.Mesh>(null!);
  const [hover, setHover] = useState(false);
  const targetH = Math.max(0.05, (d.value / max) * 4);
  const color = PALETTE[index % PALETTE.length];
  const spacing = 1.1;
  const x = (index - (total - 1) / 2) * spacing;

  useFrame((_, dt) => {
    if (!ref.current) return;
    const cur = ref.current.scale.y;
    const next = THREE.MathUtils.damp(cur, targetH, 6, dt);
    ref.current.scale.y = next;
    ref.current.position.y = next / 2;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh
        ref={ref}
        scale={[0.8, 0.01, 0.8]}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); onClick(d); }}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={hover ? color : "#000"} emissiveIntensity={hover ? 0.4 : 0} metalness={0.3} roughness={0.35} />
      </mesh>
      <Text position={[0, -0.25, 0.5]} rotation={[-Math.PI / 4, 0, 0]} fontSize={0.18} color="#0f172a" anchorX="center" anchorY="top" maxWidth={1.4}>
        {d.name.length > 14 ? d.name.slice(0, 14) + "…" : d.name}
      </Text>
      {hover && (
        <Html position={[0, targetH + 0.4, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div className="rounded-lg border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap">
            <div className="font-semibold">{d.name}</div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono">{d.value}</span>
              {d.extra && <span className="text-muted-foreground">· {d.extra}</span>}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Bars3D({ data, onSelect }: { data: Chart3DDatum[]; onSelect: (d: Chart3DDatum) => void }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="h-[340px] w-full rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <Canvas shadows camera={{ position: [0, 4, 8], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-6, 6, -4]} intensity={0.35} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[40, 40]} />
            <shadowMaterial opacity={0.18} />
          </mesh>
          {data.map((d, i) => (
            <Bar key={d.id} d={d} index={i} total={data.length} max={max} onClick={onSelect} />
          ))}
          <OrbitControls enablePan={false} minDistance={4} maxDistance={18} maxPolarAngle={Math.PI / 2.05} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Slice({
  d, index, start, end, total, onClick,
}: { d: Chart3DDatum; index: number; start: number; end: number; total: number; onClick: (d: Chart3DDatum) => void }) {
  const [hover, setHover] = useState(false);
  const color = PALETTE[index % PALETTE.length];
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    const r = 2;
    shape.moveTo(0, 0);
    shape.absarc(0, 0, r, start, end, false);
    shape.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 });
  }, [start, end]);

  const mid = (start + end) / 2;
  const offset = hover ? 0.18 : 0;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[Math.cos(mid) * offset, 0, -Math.sin(mid) * offset]}>
      <mesh
        geometry={geom}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); onClick(d); }}
      >
        <meshStandardMaterial color={color} emissive={hover ? color : "#000"} emissiveIntensity={hover ? 0.35 : 0} metalness={0.3} roughness={0.4} />
      </mesh>
      {hover && (
        <Html position={[Math.cos(mid) * 2.4, 0.7, -Math.sin(mid) * 2.4]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div className="rounded-lg border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap">
            <div className="font-semibold">{d.name}</div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono">{d.value}</span>
              <span className="text-muted-foreground">· {((d.value / total) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Pie3D({ data, onSelect }: { data: Chart3DDatum[]; onSelect: (d: Chart3DDatum) => void }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const slices = data.map((d) => {
    const start = (acc / total) * Math.PI * 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2;
    return { d, start, end };
  });
  return (
    <div className="h-[340px] w-full rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <Canvas shadows camera={{ position: [0, 4.5, 5.5], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 8, 4]} intensity={1.1} castShadow />
          <directionalLight position={[-4, 4, -3]} intensity={0.35} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <shadowMaterial opacity={0.2} />
          </mesh>
          {slices.map((s, i) => (
            <Slice key={s.d.id} d={s.d} index={i} start={s.start} end={s.end} total={total} onClick={onSelect} />
          ))}
          <OrbitControls enablePan={false} minDistance={3.5} maxDistance={14} maxPolarAngle={Math.PI / 2.05} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function Chart3DLegend({ data }: { data: Chart3DDatum[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 px-1">
      {data.map((d, i) => (
        <div key={d.id} className="flex items-center gap-1.5 text-xs">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
          <span className="text-foreground">{d.name}</span>
          <span className="text-muted-foreground font-mono">({d.value})</span>
        </div>
      ))}
    </div>
  );
}
