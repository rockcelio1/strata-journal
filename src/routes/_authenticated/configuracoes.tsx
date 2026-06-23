import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Settings, Smartphone, Users, Sliders } from "lucide-react";
import { getMe } from "@/lib/core.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me.roles?.includes("master")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ConfiguracoesLayout,
});

const subNav = [
  { to: "/configuracoes/sistema", label: "Sistema", icon: Sliders, desc: "Parâmetros globais" },
  { to: "/configuracoes/aplicativo", label: "Aplicativo", icon: Smartphone, desc: "Preferências do app" },
  { to: "/configuracoes/usuarios", label: "Usuários e permissões", icon: Users, desc: "Pessoas e papéis" },
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
              className="group border border-border rounded-lg p-4 bg-card hover:border-brand transition-colors"
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
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {subNav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm flex items-center gap-2 whitespace-nowrap",
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
