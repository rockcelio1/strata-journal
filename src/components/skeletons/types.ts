export type SkeletonEffectType =
  | "none"
  | "shimmer"
  | "gradient"
  | "staggered"
  | "typewriter"
  | "layered"
  | "elastic"
  | "pulse"
  | "cascade"
  | "outline";

export type SkeletonLayoutType =
  | "card"
  | "list"
  | "table"
  | "gallery"
  | "dashboard"
  | "form"
  | "default";

export const SKELETON_EFFECTS: { value: SkeletonEffectType; label: string; desc: string }[] = [
  { value: "none", label: "Sem Efeito", desc: "Não exibe skeleton (carregamento silencioso)" },
  { value: "shimmer", label: "Shimmer", desc: "Brilho deslizante clássico" },
  { value: "gradient", label: "Gradient", desc: "Gradiente colorido animado" },
  { value: "staggered", label: "Staggered", desc: "Linhas com atraso encadeado" },
  { value: "typewriter", label: "Typewriter", desc: "Efeito máquina de escrever" },
  { value: "layered", label: "Layered", desc: "Camadas sobrepostas" },
  { value: "elastic", label: "Elastic", desc: "Pulsos elásticos" },
  { value: "pulse", label: "Pulse", desc: "Pulsação suave" },
  { value: "cascade", label: "Cascade", desc: "Cascata vertical" },
  { value: "outline", label: "Outline", desc: "Contornos animados" },
];

export const SKELETON_EFFECT_VALUES = SKELETON_EFFECTS.map((e) => e.value);

export function isSkeletonEffect(v: unknown): v is SkeletonEffectType {
  return typeof v === "string" && (SKELETON_EFFECT_VALUES as string[]).includes(v);
}
