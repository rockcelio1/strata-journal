import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { getTutorialBySlug, saveTutorialProgress, getMyTutorialProgress } from "@/lib/help.functions";
import { useQuery } from "@tanstack/react-query";

type Step = {
  id: string;
  step_order: number;
  selector: string | null;
  title: string;
  description: string;
  position: string;
  action_required: boolean;
};

type Tutorial = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  route_path: string | null;
  help_tutorial_steps: Step[];
};

/**
 * Renderiza tutorial guiado com overlay e balão apontando para elementos
 * marcados com `data-help="..."`. Usa portal para escapar de containers com overflow.
 */
export function InteractiveTutorial({
  slug,
  onClose,
  autoStart = true,
}: {
  slug: string;
  onClose?: () => void;
  autoStart?: boolean;
}) {
  const getTut = useServerFn(getTutorialBySlug);
  const getProg = useServerFn(getMyTutorialProgress);
  const saveProg = useServerFn(saveTutorialProgress);

  const { data: tut } = useQuery<Tutorial | null>({
    queryKey: ["tutorial", slug],
    queryFn: () => getTut({ data: { slug } }) as any,
  });

  const navigate = useNavigate();
  const [open, setOpen] = useState(autoStart);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dontShow, setDontShow] = useState(false);

  const steps = (tut?.help_tutorial_steps ?? []).slice().sort((a, b) => a.step_order - b.step_order);
  const step = steps[idx];

  // Se o tutorial tem rota alvo e o usuário está em outro lugar, navega antes de começar.
  useEffect(() => {
    if (!tut?.route_path || !open) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname !== tut.route_path) {
      try {
        navigate({ to: tut.route_path as any, search: { tutorial: tut.slug } as any });
      } catch {
        window.location.assign(`${tut.route_path}?tutorial=${encodeURIComponent(tut.slug)}`);
      }
    }
  }, [tut?.route_path, tut?.slug, open, navigate]);

  // Já concluído / dispensado? não reabrir automaticamente
  useEffect(() => {
    if (!tut?.id || !autoStart) return;
    getProg({ data: { tutorial_id: tut.id } })
      .then((p: any) => {
        if (p?.do_not_show_again || p?.status === "concluido") setOpen(false);
      })
      .catch(() => {});
  }, [tut?.id, autoStart, getProg]);

  // Localiza o elemento alvo e monitora scroll/resize
  useLayoutEffect(() => {
    if (!open || !step) return;
    function update() {
      if (!step.selector) { setRect(null); return; }
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect(r);
    }
    update();
    const t = setTimeout(update, 300); // após scroll suave
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  if (!open || !tut || !step) return null;

  async function finalizar(status: "concluido" | "dispensado") {
    try {
      await saveProg({
        data: {
          tutorial_id: tut!.id,
          status,
          do_not_show_again: dontShow || status === "dispensado",
        },
      });
    } catch { /* ignora */ }
    setOpen(false);
    onClose?.();
  }

  // Posição do balão
  const pad = 8;
  const balloonW = 340;
  const balloonH = 200;
  let bx = 16, by = 16;
  if (rect) {
    if (step.position === "top") {
      bx = Math.max(8, Math.min(window.innerWidth - balloonW - 8, rect.left));
      by = Math.max(8, rect.top - balloonH - pad);
    } else if (step.position === "left") {
      bx = Math.max(8, rect.left - balloonW - pad);
      by = Math.max(8, rect.top);
    } else if (step.position === "right") {
      bx = Math.min(window.innerWidth - balloonW - 8, rect.right + pad);
      by = Math.max(8, rect.top);
    } else {
      bx = Math.max(8, Math.min(window.innerWidth - balloonW - 8, rect.left));
      by = Math.min(window.innerHeight - balloonH - 8, rect.bottom + pad);
    }
  } else {
    bx = Math.max(8, window.innerWidth / 2 - balloonW / 2);
    by = Math.max(8, window.innerHeight / 2 - balloonH / 2);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label={tut.title}
    >
      {/* Overlay escuro com "buraco" no alvo */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => finalizar("dispensado")} />
      {rect && (
        <div
          className="absolute rounded-lg ring-4 ring-primary/80 shadow-2xl pointer-events-none transition-all"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      {/* Balão */}
      <div
        className="absolute bg-background border border-border rounded-lg shadow-2xl p-4 pointer-events-auto"
        style={{ top: by, left: bx, width: balloonW }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Passo {idx + 1} de {steps.length}
            </div>
            <div className="font-serif text-base leading-tight">{step.title}</div>
          </div>
          <button
            aria-label="Fechar tutorial"
            onClick={() => finalizar("dispensado")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{step.description}</p>

        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="accent-primary"
            />
            Não mostrar novamente
          </label>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            {idx < steps.length - 1 ? (
              <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => finalizar("concluido")}>
                Finalizar <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
