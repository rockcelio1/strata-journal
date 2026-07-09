import { Component, memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, MeshReflectorMaterial, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { Pause, Play, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useAccessibility } from "@/hooks/useAccessibility";
import { useCameraPersistence } from "@/components/charts-3d.persistence";

export type Chart3DDatum = { id: string; name: string; value: number; extra?: string };

/* ---------------- Label 3D com fallback ----------------
 * Usa <Html> do drei (alternativa ao <Text> baseado em troika, que falha ao
 * reidratar via worker em alguns bundlers). Caso <Html> quebre em runtime,
 * o ErrorBoundary silencia o rótulo em vez de derrubar toda a cena 3D. */
class Label3DBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) {
    if (typeof console !== "undefined") console.warn("[charts-3d] label fallback:", err);
  }
  render() { return this.state.failed ? null : this.props.children; }
}
function Label3D({
  position, distanceFactor = 8, children,
}: { position: [number, number, number]; distanceFactor?: number; children: ReactNode }) {
  return (
    <Label3DBoundary>
      <Html position={position} center distanceFactor={distanceFactor} style={{ pointerEvents: "none" }}>
        {children}
      </Html>
    </Label3DBoundary>
  );
}

// Paleta vívida (cores saturadas + espelhadas via metalness alto)
const PALETTE = [
  "#3B82F6", "#06B6D4", "#10B981", "#84CC16", "#EAB308",
  "#F97316", "#EF4444", "#EC4899", "#A855F7", "#8B5CF6",
  "#14B8A6", "#F59E0B",
];

/* ---------------- Palco compartilhado: luzes + piso espelhado ---------------- */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <color attach="background" args={["#0b1220"]} />
      <fog attach="fog" args={["#0b1220", 12, 28]} />
      <hemisphereLight args={["#a5f3fc", "#1e1b4b", 0.55]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-6, 5, -4]} intensity={0.8} color="#22d3ee" />
      <pointLight position={[6, 4, -4]} intensity={0.6} color="#f472b6" />
      {/* Piso espelhado (reflexão dos gráficos = efeito "4D") */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.55}
          mixBlur={2.5}
          mixStrength={1.2}
          roughness={0.6}
          depthScale={0.6}
          color="#0f172a"
          metalness={0.4}
        />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={20} blur={2.4} far={6} />
      {children}
    </>
  );
}

/* ---------------- Barra 3D ---------------- */
function Bar({
  d, index, total, max, onClick,
}: { d: Chart3DDatum; index: number; total: number; max: number; onClick: (d: Chart3DDatum) => void }) {
  const ref = useRef<THREE.Mesh>(null!);
  const [hover, setHover] = useState(false);
  const targetH = Math.max(0.05, (d.value / max) * 4);
  const color = PALETTE[index % PALETTE.length];
  const spacing = 1.1;
  const x = (index - (total - 1) / 2) * spacing;

  useFrame((state, dt) => {
    if (!ref.current) return;
    const cur = ref.current.scale.y;
    const next = THREE.MathUtils.damp(cur, targetH, 6, dt);
    ref.current.scale.y = next;
    ref.current.position.y = next / 2;
    // Pulso sutil no hover ("4D")
    const pulse = hover ? 1 + Math.sin(state.clock.elapsedTime * 6) * 0.03 : 1;
    ref.current.scale.x = 0.8 * pulse;
    ref.current.scale.z = 0.8 * pulse;
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
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hover ? 0.8 : 0.25}
          metalness={0.85}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.15}
          reflectivity={0.9}
        />
      </mesh>
      {/* Valor sobre a barra */}
      <Html position={[0, targetH + 0.22, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div className="text-[11px] font-mono text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
          {d.value.toLocaleString("pt-BR")}
        </div>
      </Html>
      <Html position={[0, -0.15, 0.5]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
        <div className="text-[10px] text-slate-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] max-w-[110px] text-center leading-tight">
          {d.name.length > 14 ? d.name.slice(0, 14) + "…" : d.name}
        </div>
      </Html>
      {hover && (
        <Html position={[0, targetH + 0.6, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
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

/* ---------------- HUD de ajuda ---------------- */
function Hud() {
  return (
    <div className="absolute top-2 right-2 z-10 rounded-md border bg-background/80 backdrop-blur px-2 py-1 text-[10px] text-muted-foreground pointer-events-none">
      Segure 5s para dar zoom
    </div>
  );
}

/** Hook: dispara `onLongPress` após 5s de pressão contínua (mouse ou toque). */
function useLongPress(onLongPress: () => void, ms = 5000) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      clear();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => { onLongPress(); clear(); }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.hypot(dx, dy) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}


/** API imperativa exposta pelo bridge dentro do Canvas. */
type ChartAPI = { zoom: (factor: number) => void; reset: () => void };

/** OrbitControls + captura de câmera + persistência; expõe API imperativa. */
function ChartBridge({
  storageKey, autoRotate, minDistance, maxDistance, initialPos, onAPI,
}: {
  storageKey: string; autoRotate: boolean;
  minDistance: number; maxDistance: number;
  initialPos: [number, number, number];
  onAPI: (api: ChartAPI) => void;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  useCameraPersistence(storageKey, ref);
  useEffect(() => {
    onAPI({
      zoom: (factor: number) => {
        const c = ref.current;
        if (!c) return;
        const t = c.target as THREE.Vector3;
        const dir = camera.position.clone().sub(t);
        const len = dir.length() * factor;
        const clamped = Math.min(maxDistance, Math.max(minDistance, len));
        dir.setLength(clamped);
        camera.position.copy(t).add(dir);
        c.update();
        c.dispatchEvent({ type: "end" } as never);
      },
      reset: () => {
        try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
        camera.position.set(...initialPos);
        const c = ref.current;
        if (c) {
          (c.target as THREE.Vector3).set(0, 0, 0);
          c.update();
          c.dispatchEvent({ type: "end" } as never);
        }
      },
    });
  }, [camera, storageKey, minDistance, maxDistance, initialPos, onAPI]);
  return (
    <OrbitControls
      ref={ref}
      enablePan={false}
      enableZoom={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      enableDamping
      dampingFactor={0.08}
    />

  );
}

/** Barra de controles: pause/play + reset. */
function ChartToolbar({
  paused, onToggle, onReset,
}: {
  paused: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const btn = "inline-flex items-center justify-center h-7 w-7 rounded-md border bg-background/80 backdrop-blur text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-label={paused ? "Retomar rotação automática" : "Pausar rotação automática"}
        aria-pressed={paused}
        className={btn}
      >
        {paused ? <Play size={12} weight="fill" /> : <Pause size={12} weight="fill" />}
      </button>
      <button type="button" onClick={onReset} aria-label="Restaurar tamanho padrão" className={btn}>
        <ArrowCounterClockwise size={12} weight="bold" />
      </button>
    </div>
  );
}


function usePausedState(storageKey: string) {
  const [paused, setPaused] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(`${storageKey}:paused`) === "1";
  });
  const toggle = () => {
    setPaused((p) => {
      const next = !p;
      try { sessionStorage.setItem(`${storageKey}:paused`, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
  return [paused, toggle] as const;
}

export function Bars3D({
  data, onSelect, storageKey = "chart3d:bars",
}: { data: Chart3DDatum[]; onSelect: (d: Chart3DDatum) => void; storageKey?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const { effectiveReducedMotion: reducedMotion } = useAccessibility();
  const [paused, togglePaused] = usePausedState(storageKey);
  const autoRotate = !reducedMotion && !paused;
  const apiRef = useRef<ChartAPI | null>(null);
  const initialPos: [number, number, number] = [0, 4, 8];
  const longPress = useLongPress(() => {
    if (window.confirm("Deseja dar zoom no gráfico?")) apiRef.current?.zoom(0.6);
  });
  return (
    <div className="relative h-[340px] w-full rounded-lg overflow-hidden ring-1 ring-border" {...longPress}>
      <Hud />
      <ChartToolbar
        paused={paused || reducedMotion}
        onToggle={togglePaused}
        onReset={() => apiRef.current?.reset()}
      />

      <Canvas shadows camera={{ position: initialPos, fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Stage>
            {data.map((d, i) => (
              <Bar key={d.id} d={d} index={i} total={data.length} max={max} onClick={onSelect} />
            ))}
          </Stage>
          <ChartBridge
            storageKey={storageKey}
            autoRotate={autoRotate}
            minDistance={4}
            maxDistance={20}
            initialPos={initialPos}
            onAPI={(api) => { apiRef.current = api; }}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ---------------- Fatia da pizza ---------------- */
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
    return new THREE.ExtrudeGeometry(shape, { depth: 0.75, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4 });
  }, [start, end]);

  const mid = (start + end) / 2;
  const offset = hover ? 0.22 : 0;
  const pct = ((d.value / total) * 100).toFixed(1);
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[Math.cos(mid) * offset, 0, -Math.sin(mid) * offset]}>
      <mesh
        geometry={geom}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); onClick(d); }}
      >
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hover ? 0.7 : 0.2}
          metalness={0.85}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.12}
          reflectivity={0.9}
        />
      </mesh>
      {/* % sobre a fatia */}
      <Html position={[Math.cos(mid) * 1.25, -Math.sin(mid) * 1.25, 0.8]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div className="text-[11px] font-mono text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
          {pct}%
        </div>
      </Html>
      {hover && (
        <Html position={[Math.cos(mid) * 2.6, 0.9, -Math.sin(mid) * 2.6]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div className="rounded-lg border bg-background/95 backdrop-blur px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap">
            <div className="font-semibold">{d.name}</div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="font-mono">{d.value}</span>
              <span className="text-muted-foreground">· {pct}%</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Pie3D({
  data, onSelect, storageKey = "chart3d:pie",
}: { data: Chart3DDatum[]; onSelect: (d: Chart3DDatum) => void; storageKey?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const slices = data.map((d) => {
    const start = (acc / total) * Math.PI * 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2;
    return { d, start, end };
  });
  const { effectiveReducedMotion: reducedMotion } = useAccessibility();
  const [paused, togglePaused] = usePausedState(storageKey);
  const autoRotate = !reducedMotion && !paused;
  const apiRef = useRef<ChartAPI | null>(null);
  const initialPos: [number, number, number] = [0, 4.5, 5.5];
  const longPress = useLongPress(() => {
    if (window.confirm("Deseja dar zoom no gráfico?")) apiRef.current?.zoom(0.6);
  });
  return (
    <div className="relative h-[340px] w-full rounded-lg overflow-hidden ring-1 ring-border" {...longPress}>
      <Hud />
      <ChartToolbar
        paused={paused || reducedMotion}
        onToggle={togglePaused}
        onReset={() => apiRef.current?.reset()}
      />

      <Canvas shadows camera={{ position: initialPos, fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Stage>
            {slices.map((s, i) => (
              <Slice key={s.d.id} d={s.d} index={i} start={s.start} end={s.end} total={total} onClick={onSelect} />
            ))}
          </Stage>
          <ChartBridge
            storageKey={storageKey}
            autoRotate={autoRotate}
            minDistance={3.5}
            maxDistance={16}
            initialPos={initialPos}
            onAPI={(api) => { apiRef.current = api; }}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ---------------- Legenda colorida (com % e valor) ---------------- */
export function Chart3DLegend({ data }: { data: Chart3DDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 px-1">
      {data.map((d, i) => {
        const color = PALETTE[i % PALETTE.length];
        const pct = ((d.value / total) * 100).toFixed(1);
        return (
          <div key={d.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-3 w-3 rounded-sm ring-1 ring-black/10"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
            />
            <span className="text-foreground">{d.name}</span>
            <span className="text-muted-foreground font-mono">({d.value.toLocaleString("pt-BR")} · {pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}
