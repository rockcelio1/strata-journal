import { LogoMark } from "@/routes/_authenticated/configuracoes.sistema";

/**
 * Marca d'água do logotipo da empresa exibida como fundo de tela.
 * Renderizada fixa, atrás de todo o conteúdo, com opacidade configurável.
 * `opacity` em percentual (0–100). Quando 0, não renderiza nada.
 */
export function LogoWallpaper({
  url,
  opacity,
}: {
  url: string | null;
  opacity: number | null | undefined;
}) {
  const op = Math.max(0, Math.min(100, Number(opacity ?? 0)));
  if (!url || op <= 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 grid place-items-center overflow-hidden"
      style={{ opacity: op / 100 }}
    >
      <LogoMark url={url} className="w-[min(80vw,80vh)] h-[min(80vw,80vh)]" />
    </div>
  );
}
