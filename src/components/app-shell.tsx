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
import { BackNav } from "@/components/back-nav";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/routes/_authenticated/configuracoes.sistema";
import { LogoWallpaper } from "@/components/logo-wallpaper";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalHoverHints } from "@/components/global-hover-hints";


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

  const roles = me?.roles ?? [];
  const showConfig = roles.includes("master") || roles.includes("admin") || roles.includes("gestor_acessos");
  const mainNav = showConfig ? [...baseNav, masterNavItem] : baseNav;
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

  // Bloqueia acesso de usuários não aprovados (cadastro espontâneo aguardando admin/master)
  const profile = me?.profile as any;
  if (me && profile && profile.aprovado === false) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background p-6">
        <div className="max-w-md text-center space-y-4 border rounded-lg p-6 bg-card">
          <h1 className="font-serif text-2xl">Aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro foi recebido e está aguardando liberação por um administrador ou master da empresa.
            Você receberá acesso assim que for aprovado.
          </p>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-[env(safe-area-inset-bottom)]">
      <GlobalHoverHints />

      {/* Header azul */}
      <header className="bg-brand text-brand-foreground border-b border-brand sticky top-0 z-30">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3 md:gap-6">
          {/* Hamburger — mobile */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Abrir menu"
                className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 rounded-md active:bg-brand-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
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
                        "flex items-center gap-3 px-3 rounded-md text-sm min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-muted text-foreground" : "text-foreground/80 active:bg-muted/60",
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
                      className="flex items-center gap-3 px-3 rounded-md text-sm min-h-[44px] text-foreground/80 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
            </SheetContent>
          </Sheet>



          <Link to="/dashboard" className="flex items-center gap-3 shrink-0 min-h-[44px]">
            <div className="h-12 w-12 rounded-lg bg-brand-foreground p-1 ring-2 ring-primary/40 shadow-sm grid place-items-center">
              <LogoMark url={((me?.empresa as any)?.logo_url as string | null) ?? null} className="h-10 w-10" />
            </div>
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
                    "facom-flash facom-glow px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                    active ? "bg-brand-foreground/15" : "hover:bg-brand-foreground/10 text-brand-foreground/85",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-brand-foreground/70 hidden md:inline">{empresaName}</span>
            <NotificationBell />
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

      {/* Navegação contextual reutilizável: voltar + breadcrumb */}
      <BackNav />

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

        <main className="flex-1 overflow-auto pb-20 md:pb-0 relative">
          <LogoWallpaper
            url={((me?.empresa as any)?.logo_url as string | null) ?? null}
            opacity={(me?.empresa as any)?.logo_wallpaper_opacity ?? 0}
          />
          <div className="relative z-10">{children}</div>
        </main>
      </div>

      {/* Bottom tab bar — mobile (4 itens + Mais). Alvos 44x44, sem :hover */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {bottomNav.map((item) => {
            const active = item.match
              ? pathname.startsWith(item.match)
              : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <li key={item.to}>
                <Link
                  to={item.to as any}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 text-[10px] min-h-[44px] min-w-[44px] active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    active ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="leading-none truncate max-w-full px-1">{item.label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Mais opções"
              className="flex flex-col items-center justify-center gap-1 py-2 text-[10px] min-h-[44px] min-w-[44px] w-full text-muted-foreground active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <Menu className="h-5 w-5" />
              <span className="leading-none">Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
