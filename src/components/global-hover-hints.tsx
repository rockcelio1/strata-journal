import { useEffect, useRef, useState } from "react";

/**
 * Tooltip explicativo global. Aparece ao passar o mouse em cima de
 * qualquer menu, link, card ou botão do sistema.
 *
 * Prioridade do texto:
 *   1) atributo data-hint="..."
 *   2) mapa de rotas conhecidas (href / to)
 *   3) aria-label
 *   4) title
 *   5) texto interno (se for curto)
 */

const ROUTE_HINTS: Record<string, string> = {
  "/dashboard": "Dashboard: visão geral com totais de RDOs, status (aprovados, pendentes, rascunhos) e atalhos rápidos.",
  "/obras": "Obras: lista todas as obras cadastradas. Clique para ver relatórios, fotos e informações da obra.",
  "/rdo": "Diário de Obra (RDO): consulta, busca e filtra todos os RDOs por status, contrato, datas e responsáveis.",
  "/rdo/novo": "Novo RDO: cria um novo Relatório Diário de Obra com previsão do tempo, equipes, equipamentos e fotos.",
  "/galeria": "Galeria: visualiza fotos, vídeos, PDFs e demais mídias enviadas nos RDOs.",
  "/cadastros/mao-de-obra": "Cadastro de Mão de Obra: gerencia funcionários, funções e equipes.",
  "/cadastros/equipamentos": "Cadastro de Equipamentos: gerencia máquinas e equipamentos utilizados nas obras.",
  "/cadastros/ocorrencias": "Tipos de Ocorrência: cadastra os tipos de eventos registrados nos RDOs.",
  "/empresa": "Empresa: dados cadastrais, logotipo e informações fiscais da empresa.",
  "/configuracoes": "Configurações: ajustes do sistema, integrações (OneDrive), usuários, permissões e personalização.",
  "/configuracoes/onedrive": "OneDrive: integração com o repositório de arquivos da Microsoft. Mostra capacidade total, espaço usado, lixeira e disponível.",
};

function findHint(el: HTMLElement): string | null {
  let cur: HTMLElement | null = el;
  let depth = 0;
  while (cur && depth < 6) {
    const dh = cur.getAttribute("data-hint");
    if (dh) return dh;
    const href = cur.getAttribute("href") || cur.getAttribute("data-to");
    if (href && ROUTE_HINTS[href]) return ROUTE_HINTS[href];
    const aria = cur.getAttribute("aria-label");
    if (aria && aria.length > 3 && aria.length < 200) return aria;
    const title = cur.getAttribute("title");
    if (title && title.length > 3) return title;
    cur = cur.parentElement;
    depth++;
  }
  return null;
}

function isInteractive(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "A" || tag === "BUTTON") return true;
  const role = el.getAttribute("role");
  if (role && ["menuitem", "tab", "button", "link", "option"].includes(role)) return true;
  if (el.closest('a, button, [role="menuitem"], [role="tab"], [role="button"], .dash-card, [data-hint]'))
    return true;
  return false;
}

export function GlobalHoverHints() {
  const [state, setState] = useState<{ x: number; y: number; text: string } | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!isInteractive(target)) {
        if (state) setState(null);
        return;
      }
      const text = findHint(target);
      if (!text) {
        if (state) setState(null);
        return;
      }
      const pad = 14;
      const maxW = 320;
      let x = e.clientX + pad;
      let y = e.clientY + pad;
      if (x + maxW > window.innerWidth) x = e.clientX - maxW - pad;
      if (y + 120 > window.innerHeight) y = e.clientY - 120 - pad;
      if (x < 4) x = 4;
      if (y < 4) y = 4;
      setState({ x, y, text });
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setState(null), 4000);
    }
    function onLeave() {
      setState(null);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("scroll", onLeave, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onLeave);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [state]);

  if (!state) return null;

  return (
    <div
      role="tooltip"
      aria-live="polite"
      style={{
        position: "fixed",
        left: state.x,
        top: state.y,
        zIndex: 9999,
        maxWidth: 320,
        pointerEvents: "none",
        background: "linear-gradient(135deg, var(--brand), color-mix(in oklab, var(--brand) 75%, black))",
        color: "var(--brand-foreground)",
        boxShadow: "0 10px 30px -10px color-mix(in oklab, var(--brand) 55%, transparent), 0 0 0 1px color-mix(in oklab, var(--brand) 60%, transparent)",
      }}
      className="rounded-lg px-3 py-2 text-xs font-medium leading-snug animate-in fade-in-0 zoom-in-95"
    >
      {state.text}
    </div>
  );
}

