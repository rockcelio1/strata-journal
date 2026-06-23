import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Database,
  Building,
  LogOut,
  User as UserIcon,
  HardHat,
  Truck,
  AlertTriangle,
  Images,
  Settings,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const baseNav: Array<{ to: string; label: string; icon: any; match?: string }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/obras", label: "Obras", icon: Building2 },
  { to: "/rdo", label: "Diário (RDO)", icon: FileText },
  { to: "/galeria", label: "Galeria", icon: Images },
  { to: "/cadastros/mao-de-obra", label: "Cadastros", icon: Database, match: "/cadastros" },
  { to: "/empresa", label: "Empresa", icon: Building },
];

const masterNavItem = { to: "/configuracoes", label: "Configurações", icon: Settings, match: "/configuracoes" };


const cadastrosNav = [
  { to: "/cadastros/mao-de-obra", label: "Mão de obra", icon: HardHat },
  { to: "/cadastros/equipamentos", label: "Equipamentos", icon: Truck },
  { to: "/cadastros/ocorrencias", label: "Tipos de ocorrência", icon: AlertTriangle },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const [empresaName, setEmpresaName] = useState("");

  const isMaster = (me?.roles ?? []).includes("master");
  const mainNav = isMaster ? [...baseNav, masterNavItem] : baseNav;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bottom bar: 4 primários + botão "Mais"
  const bottomNav = mainNav.slice(0, 4);

  useEffect(() => {
    if (me?.empresa?.nome) setEmpresaName(me.empresa.nome);
  }, [me]);


  const isCadastros = pathname.startsWith("/cadastros");
  const initials = (me?.profile?.nome ?? "U").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Header azul */}
      <header className="bg-brand text-brand-foreground border-b border-brand sticky top-0 z-30">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3 md:gap-6">
          {/* Hamburger — mobile */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Abrir menu"
                className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 rounded-md hover:bg-brand-foreground/10"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="font-serif">{empresaName || "Menu"}</SheetTitle>
              </SheetHeader>
              <nav className="p-2 flex flex-col">
                {mainNav.map((item) => {
                  const active = item.match
                    ? pathname.startsWith(item.match)
                    : pathname === item.to || pathname.startsWith(item.to + "/");
                  return (
                    <Link
                      key={item.to}
                      to={item.to as any}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 rounded-md text-sm min-h-[44px]",
                        active ? "bg-muted text-foreground" : "text-foreground/80",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-2 pt-2 border-t">
                  <div className="px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">Cadastros</div>
                  {cadastrosNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to as any}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-3 px-3 rounded-md text-sm min-h-[44px] text-foreground/80"
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex items-center gap-2 shrink-0 min-h-[44px]">
            {(me?.empresa as any)?.logo_url ? (
              <img
                src={(me!.empresa as any).logo_url}
                alt="Logo"
                className="h-7 w-7 rounded-md object-contain bg-brand-foreground/10 p-0.5"
              />
            ) : (
              <div className="h-7 w-7 rounded-md bg-brand-foreground/15 grid place-items-center">
                <Building2 className="h-4 w-4" />
              </div>
            )}
            <span className="font-serif text-lg leading-none">{empresaName || "Diário de Obra"}</span>
          </Link>

          {/* Top nav: somente desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {mainNav.map((item) => {
              const active = item.match
                ? pathname.startsWith(item.match)
                : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                    active ? "bg-brand-foreground/15" : "hover:bg-brand-foreground/10 text-brand-foreground/85",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-brand-foreground/70 hidden md:inline">{empresaName}</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <Avatar className="h-8 w-8 border border-brand-foreground/30">
                  <AvatarFallback className="bg-brand-foreground/15 text-brand-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm">{me?.profile?.nome}</div>
                  <div className="text-xs text-muted-foreground">{me?.profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/empresa" })}>
                  <UserIcon className="h-4 w-4 mr-2" /> Empresa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Conteúdo: sidebar só em /cadastros no desktop */}
      <div className="flex-1 flex">
        {isCadastros && (
          <aside className="w-60 border-r border-border bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
            <div className="px-4 py-4 border-b border-sidebar-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Cadastros</div>
              <div className="font-serif text-lg mt-0.5">Catálogos da empresa</div>
            </div>
            <nav className="p-2 flex flex-col gap-0.5">
              {cadastrosNav.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to as any}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mainNav.length}, minmax(0, 1fr))` }}>
          {mainNav.map((item) => {
            const active = item.match
              ? pathname.startsWith(item.match)
              : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <li key={item.to}>
                <Link
                  to={item.to as any}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 text-[10px]",
                    active ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="leading-none">{item.label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
