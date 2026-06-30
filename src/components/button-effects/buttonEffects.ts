export type ButtonEffectType =
  | "none"
  | "typewriter"
  | "rocket"
  | "iconSwap"
  | "spark"
  | "circleExpand"
  | "shine"
  | "flip"
  | "expand"
  | "badgeArrow"
  | "warp";

export const BUTTON_EFFECTS: { value: ButtonEffectType; label: string; desc: string }[] = [
  { value: "none", label: "Sem efeito", desc: "Mantém o botão padrão" },
  { value: "typewriter", label: "Typewriter", desc: "Efeito máquina de escrever no hover" },
  { value: "rocket", label: "Rocket", desc: "Ícone de foguete decola" },
  { value: "iconSwap", label: "Icon Swap", desc: "Troca de ícone suave" },
  { value: "spark", label: "Spark", desc: "Brilho/centelhas no hover" },
  { value: "circleExpand", label: "Circle Expand", desc: "Círculo expande do centro" },
  { value: "shine", label: "Shine", desc: "Reflexo deslizante" },
  { value: "flip", label: "Flip", desc: "Vira o conteúdo do botão" },
  { value: "expand", label: "Expand", desc: "Aumenta suavemente" },
  { value: "badgeArrow", label: "Badge Arrow", desc: "Seta surge ao passar o mouse" },
  { value: "warp", label: "Warp", desc: "Distorce levemente no hover" },
];

export const BUTTON_EFFECT_VALUES = BUTTON_EFFECTS.map((e) => e.value);

export function isButtonEffect(v: unknown): v is ButtonEffectType {
  return typeof v === "string" && (BUTTON_EFFECT_VALUES as string[]).includes(v);
}

export function normalizeButtonEffect(v: unknown): ButtonEffectType {
  return isButtonEffect(v) ? v : "none";
}
