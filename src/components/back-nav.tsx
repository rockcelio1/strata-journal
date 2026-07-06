import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mapeia segmentos de URL → rótulos amigáveis para o breadcrumb.
 * Segmentos não listados são exibidos em Title Case.
 */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  obras: "Obras",
  rdo: "Diário (RDO)",
  galeria: "Galeria",
  cadastros: "Cadastros",
  "mao-de-obra": "Mão de obra",
  equipamentos: "Equipamentos",
  ocorrencias: "Ocorrências",
  empresa: "Empresa",
  configuracoes: "Configurações",
  usuarios: "Usuários",
  grupos: "Grupos",
  permissoes: "Permissões",
  sistema: "Sistema",
  aplicativo: "Aplicativo",
  onedrive: "OneDrive",
  novo: "Novo",
  relatorios: "Relatórios",
};

function prettify(seg: string) {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  // ids/UUIDs ficam truncados
  if (/^[0-9a-f-]{8,}$/i.test(seg)) return seg.slice(0, 8) + "…";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export interface BackNavProps {
  /** Esconde tudo (back + breadcrumb) — útil em telas de auth/onboarding */
  hidden?: boolean;
  /** Esconde só o breadcrumb */
  hideBreadcrumb?: boolean;
  className?: string;
}

/**
 * Componente único de navegação: botão voltar (seta grossa na cor da
 * logomarca, com glow) + breadcrumb com a rota atual e atalho para
 * Dashboard. Reaproveitado por todas as telas via AppShell.
 */
export function BackNav({ hidden, hideBreadcrumb, className }: BackNavProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (hidden) return null;
  // Esconde no dashboard (raiz já é a "home")
  const isRoot = pathname === "/dashboard" || pathname === "/";
  if (isRoot) return null;

  const segments = pathname.split("/").filter(Boolean);
  // Constrói pares { href, label } cumulativos
  const crumbs = segments.map((seg, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: prettify(seg),
    isLast: i === segments.length - 1,
  }));

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 md:px-6 py-2 border-b border-border/60 bg-background/80 backdrop-blur-sm",
        className,
      )}
    >
      {/* Botão voltar — seta grossa e destacada na cor da logomarca */}
      <button
        type="button"
        onClick={goBack}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            goBack();
          }
        }}
        aria-label="Voltar para a tela anterior"
        title="Voltar (Alt + ←)"
        className="facom-glow brand-arrow group inline-flex items-center gap-2 min-w-14 min-h-12 px-4 rounded-xl bg-brand text-brand-foreground ring-4 ring-brand/50 shadow-[0_0_0_3px_rgba(255,255,255,0.2),0_10px_28px_-6px_var(--brand)] hover:brightness-110 hover:-translate-x-0.5 active:translate-x-0 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60"
      >
        <ArrowLeft className="h-7 w-7 transition-transform group-hover:-translate-x-1" strokeWidth={4} aria-hidden="true" />
        <span className="text-base font-extrabold tracking-wide hidden sm:inline">Voltar</span>
        <span className="sr-only">Voltar</span>
      </button>

      {/* Breadcrumb */}
      {!hideBreadcrumb && (
        <nav aria-label="Trilha de navegação" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground overflow-hidden">
            <li className="shrink-0">
              <Link
                to="/dashboard"
                className="facom-glow inline-flex items-center gap-1 px-2 py-1 rounded-md hover:text-foreground focus-visible:outline-none"
                aria-label="Ir para o Dashboard"
              >
                <Home className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                {c.isLast ? (
                  <span
                    aria-current="page"
                    className="px-1.5 py-1 font-medium text-foreground truncate"
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    to={c.href as any}
                    className="facom-glow px-2 py-1 rounded-md truncate hover:text-foreground focus-visible:outline-none"
                  >
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
