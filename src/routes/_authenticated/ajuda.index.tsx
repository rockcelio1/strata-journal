import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Book, Search, Sparkles, Rocket, Building2, FileText, Database,
  CheckCircle2, Images, Download, Shield, Settings, AlertTriangle,
  LifeBuoy, PlayCircle, Bell, HelpCircle, BookOpen,
} from "lucide-react";
import {
  listHelpCategories, listHelpArticles, listChangelog, searchHelp,
} from "@/lib/help.functions";
import { InteractiveTutorial } from "@/components/help/InteractiveTutorial";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().optional(),
  tutorial: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/ajuda/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Ajuda / Manual do Sistema" }] }),
  component: AjudaHome,
});

const iconMap: Record<string, any> = {
  Rocket, Building2, FileText, Database, CheckCircle2, Images, Download,
  Shield, Settings, AlertTriangle, Book,
};

function AjudaHome() {
  const navigate = useNavigate();
  const { q, tutorial } = Route.useSearch();
  const listCats = useServerFn(listHelpCategories);
  const listArts = useServerFn(listHelpArticles);
  const listChg = useServerFn(listChangelog);
  const doSearch = useServerFn(searchHelp);

  const [term, setTerm] = useState(q ?? "");

  const cats = useQuery({ queryKey: ["help", "cats"], queryFn: () => listCats() });
  const featured = useQuery({
    queryKey: ["help", "featured"],
    queryFn: () => listArts({ data: { featured_only: true, limit: 6 } }),
  });
  const changelog = useQuery({
    queryKey: ["help", "changelog", "recent"],
    queryFn: () => listChg({ data: { limit: 5 } }),
  });
  const search = useQuery({
    queryKey: ["help", "search", q ?? ""],
    queryFn: () => doSearch({ data: { q: (q ?? "").trim() } }),
    enabled: !!q && q.trim().length > 1,
  });

  const submitSearch = () => {
    navigate({ to: "/ajuda", search: { q: term || undefined } as any });
  };

  const chgTypeLabel: Record<string, string> = useMemo(() => ({
    novo: "Nova funcionalidade",
    correcao: "Correção",
    melhoria: "Melhoria",
    seguranca: "Segurança",
    integracao: "Integração",
    visual: "Visual",
  }), []);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {tutorial && (
          <InteractiveTutorial
            slug={tutorial}
            onClose={() => navigate({ to: "/ajuda", search: {} as any })}
          />
        )}

        <div className="flex items-center gap-2 mb-2">
          <Book className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl md:text-3xl">Manual do Sistema</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Aprenda a usar cada módulo, siga tutoriais guiados e veja o que há de novo.
        </p>

        {/* Busca */}
        <Card className="p-4 mb-6">
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
            O que você deseja aprender?
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="Ex.: como aprovar relatório, cadastrar obra, exportar PDF…"
                className="pl-9"
              />
            </div>
            <Button onClick={submitSearch}>Buscar</Button>
          </div>
        </Card>

        {/* Resultados de busca */}
        {q && q.trim().length > 1 && (
          <Card className="p-4 mb-6">
            <div className="text-sm font-medium mb-3">
              Resultados para “{q}” {search.data ? `(${search.data.length})` : ""}
            </div>
            {search.isLoading && <div className="text-xs text-muted-foreground">Buscando…</div>}
            {search.data?.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Nenhum artigo encontrado. Tente outra palavra-chave.
              </div>
            )}
            <div className="space-y-2">
              {(search.data ?? []).map((a: any) => (
                <Link key={a.id} to="/ajuda/artigo/$slug" params={{ slug: a.slug }}
                  className="block rounded-md border border-border p-2 hover:bg-muted/40">
                  <div className="text-sm font-medium">{a.title}</div>
                  {a.summary && <div className="text-xs text-muted-foreground line-clamp-2">{a.summary}</div>}
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Ações rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/ajuda" search={{ tutorial: "novo-rdo" } as any}>
              <PlayCircle className="h-4 w-4 mr-2" /> Começar tutorial (Novo RDO)
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/ajuda/novidades"><Bell className="h-4 w-4 mr-2" /> Ver novidades</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <a href="mailto:suporte@facom.com.br"><LifeBuoy className="h-4 w-4 mr-2" /> Preciso de ajuda</a>
          </Button>
        </div>

        {/* Categorias */}
        <h2 className="font-serif text-xl mb-3">Módulos do sistema</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {(cats.data ?? []).map((c: any) => {
            const Icon = iconMap[c.icon ?? ""] ?? Book;
            return (
              <Link key={c.id} to="/ajuda/categoria/$slug" params={{ slug: c.slug }}
                className="block">
                <Card className="p-4 hover:border-primary transition-colors h-full">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="font-medium text-sm">{c.name}</div>
                  </div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Destaques */}
        {(featured.data?.length ?? 0) > 0 && (
          <>
            <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Guias recomendados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {featured.data!.map((a: any) => (
                <Link key={a.id} to="/ajuda/artigo/$slug" params={{ slug: a.slug }}>
                  <Card className="p-4 hover:border-primary transition-colors h-full">
                    <div className="text-sm font-medium mb-1">{a.title}</div>
                    {a.summary && <div className="text-xs text-muted-foreground line-clamp-2">{a.summary}</div>}
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Últimas atualizações */}
        <h2 className="font-serif text-xl mb-3">Últimas atualizações</h2>
        <Card className="p-2">
          {(changelog.data ?? []).map((e: any) => (
            <div key={e.id} className="p-3 border-b border-border last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{chgTypeLabel[e.change_type] ?? e.change_type}</Badge>
                {e.version && <Badge variant="outline">v{e.version}</Badge>}
                <div className="text-sm font-medium">{e.title}</div>
              </div>
              {e.description && <div className="text-xs text-muted-foreground mt-1">{e.description}</div>}
            </div>
          ))}
          {(changelog.data?.length ?? 0) === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Sem novidades registradas.</div>
          )}
          <div className="p-2">
            <Link to="/ajuda/novidades" className="text-xs underline">Ver todas as atualizações →</Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
