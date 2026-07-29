import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Settings, Smartphone, Users, Sliders, ShieldCheck, Users2, Cloud, ScrollText, Sparkles, MousePointerClick, Image as ImageIcon, FileText, BookOpen, KeyRound, DatabaseBackup } from "lucide-react";
import { getMe } from "@/lib/core.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me.roles ?? [];
    if (!roles.includes("master") && !roles.includes("admin") && !roles.includes("gestor_acessos")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ConfiguracoesLayout,
});

const subNav = [
  { to: "/configuracoes/sistema", label: "Sistema", icon: Sliders, desc: "Parâmetros globais" },
  { to: "/configuracoes/aplicativo", label: "Aplicativo", icon: Smartphone, desc: "Preferências do app" },
  { to: "/configuracoes/usuarios", label: "Usuários e permissões", icon: Users, desc: "Pessoas e papéis" },
  { to: "/configuracoes/permissoes", label: "Permissões detalhadas", icon: ShieldCheck, desc: "Matriz por papel e por usuário" },
  { to: "/configuracoes/grupos", label: "Grupos & equipes", icon: Users2, desc: "Grupos globais e equipes por obra" },
  { to: "/configuracoes/onedrive", label: "OneDrive", icon: Cloud, desc: "Conta, pasta de destino e validação" },
  { to: "/configuracoes/email", label: "E-mail", icon: Mail, desc: "Provedor, templates, fila e logs" },
  { to: "/configuracoes/auditoria", label: "Auditoria de RDO", icon: ScrollText, desc: "Eventos e payloads sanitizados" },
  { to: "/configuracoes/auditoria-midia", label: "Auditoria de Mídia", icon: ImageIcon, desc: "Falhas de carregamento de thumbnails" },
  { to: "/configuracoes/skeleton", label: "Efeitos de Carregamento", icon: Sparkles, desc: "Skeleton por tela (9 efeitos)" },
  { to: "/configuracoes/botoes-efeitos", label: "Efeitos dos Botões", icon: MousePointerClick, desc: "10 efeitos visuais por botão" },
  { to: "/configuracoes/lgpd", label: "Solicitações LGPD", icon: FileText, desc: "Pedidos DSAR e prazos" },
  { to: "/configuracoes/runbook", label: "Runbook", icon: BookOpen, desc: "Procedimentos de incidente e operação" },
  { to: "/configuracoes/rotacao-chaves", label: "Rotação de chaves", icon: KeyRound, desc: "Política e checklist de segredos" },
  { to: "/configuracoes/backup", label: "Backup do sistema", icon: DatabaseBackup, desc: "Exportar e restaurar dados seletivamente" },
];

function ConfiguracoesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/configuracoes";

  return (
    <div className="px-4 md:px-6 py-4 sm:py-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-serif text-2xl leading-none">Configurações</h1>
          <p className="text-xs text-muted-foreground mt-1">Acesso exclusivo do administrador mestre</p>
        </div>
      </header>

      {isIndex ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subNav.map((item) => (
            <Link
              key={item.to}
              to={item.to as any}
              aria-label={item.label}
              className="facom-glow group border border-border rounded-lg p-4 bg-card hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="h-4 w-4 text-brand" />
                <span className="font-medium">{item.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-4 md:gap-6">
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {subNav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "facom-glow px-3 py-2 rounded-md text-sm flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    active ? "bg-brand/10 text-brand" : "hover:bg-accent text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  );
}
