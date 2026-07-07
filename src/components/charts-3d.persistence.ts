import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type * as THREE from "three";

/**
 * Persiste posição da câmera + alvo do OrbitControls em sessionStorage.
 * Restaura ao montar (mesma aba após reload ou troca de rota).
 * Passe uma `storageKey` única por gráfico (ex.: "bars-3d:obras").
 */
export function useCameraPersistence(
  storageKey: string,
  controlsRef: React.RefObject<OrbitControlsImpl | null>,
) {
  const { camera } = useThree();
  const restored = useRef(false);

  // Restaura uma vez na montagem
  useEffect(() => {
    if (restored.current) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw) as {
          p: [number, number, number];
          t: [number, number, number];
        };
        camera.position.set(...s.p);
        if (controlsRef.current) {
          controlsRef.current.target.set(...s.t);
          controlsRef.current.update();
        }
      }
    } catch {
      /* storage indisponível — segue com defaults */
    }
    restored.current = true;
  }, [storageKey, camera, controlsRef]);

  // Salva ao final de cada interação e ao desmontar
  useEffect(() => {
    const ctrls = controlsRef.current;
    if (!ctrls) return;
    const save = () => {
      try {
        const p = camera.position;
        const t = (ctrls.target as THREE.Vector3);
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ p: [p.x, p.y, p.z], t: [t.x, t.y, t.z] }),
        );
      } catch {
        /* ignore */
      }
    };
    ctrls.addEventListener("end", save);
    return () => {
      save();
      ctrls.removeEventListener("end", save);
    };
  }, [storageKey, camera, controlsRef]);
}
