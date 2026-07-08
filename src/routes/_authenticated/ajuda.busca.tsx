import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { listHelpCategories, searchHelp, logSearchClick } from "@/lib/help.functions";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  module: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/ajuda/busca")({
  validateSearch: zodValidator(schema),
  head: () => ({ meta: [{ title: "Busca — Ajuda" }] }),
  component: BuscaAjuda,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 max-w-lg mx-auto text-center">
      <h1 className="font-serif text-xl mb-2">Erro na busca</h1>
      <p className="text-sm text-muted-foreground mb-4">{(error as any)?.message}</p>
      <button onClick={reset} className="text-sm underline">Tentar novamente</button>
    </div>
  ),
});

function BuscaAjuda() {
  const nav = useNavigate();
  const { q, category, module: mod, page } = Route.useSearch();
  const [term, setTerm] = useState(q);

  const listCats = useServerFn(listHelpCategories);
  const doSearch = useServerFn(searchHelp);
  const doClick = useServerFn(logSearchClick);

  const cats = useQuery({ queryKey: ["help", "cats"], queryFn: () => listCats() });
  const search = useQuery({
    queryKey: ["help", "busca", q, category, mod, page],
    queryFn: () => doSearch({ data: {
      q: q.trim(),
      category_slug: category || undefined,
      module_key: mod || undefined,
      page,
      per_page: 20,
    } }),
    enabled: q.trim().length > 1,
  });

  const data: any = search.data ?? { rows: [], total: 0, page: 1, per_page: 20, log_id: null };
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.per_page || 20)));

  const modules = useMemo(() => {
    const set = new Set<string>();
    (data.rows ?? []).forEach((r: any) => r.module_key && set.add(r.module_key));
    return Array.from(set).sort();
  }, [data.rows]);

  const submit = () => nav({ to: "/ajuda/busca", search: { q: term, category, module: mod, page: 1 } });
  const setPage = (p: number) => nav({ to: "/ajuda/busca", search: { q, category, module: mod, page: p } });
  const setCategory = (slug: string) => nav({ to: "/ajuda/busca", search: { q, category: slug, module: mod, page: 1 } });
  const setModule = (m: string) => nav({ to: "/ajuda/busca", search: { q, category, module: m, page: 1 } });

  const onClickResult = (articleId: string) => {
    if (data.log_id) doClick({ data: { search_log_id: data.log_id, article_id: articleId } }).catch(() => {});
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <Link to="/ajuda" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para Ajuda
        </Link>
        <h1 className="font-serif text-2xl md:text-3xl mb-4">Buscar no Manual</h1>

        <Card className="p-4 mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Digite palavras-chave…"
                className="pl-9"
              />
            </div>
            <Button onClick={submit}>Buscar</Button>
          </div>
        </Card>

        {/* Filtros */}
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <Card className="p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Categoria</div>
            <div className="flex flex-wrap gap-1">
              <Badge variant={!category ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategory("")}>Todas</Badge>
              {(cats.data ?? []).map((c: any) => (
                <Badge key={c.id} variant={category === c.slug ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategory(c.slug)}>
                  {c.name}
                </Badge>
              ))}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Módulo</div>
            <div className="flex flex-wrap gap-1">
              <Badge variant={!mod ? "default" : "outline"} className="cursor-pointer" onClick={() => setModule("")}>Todos</Badge>
              {modules.map((m) => (
                <Badge key={m} variant={mod === m ? "default" : "outline"} className="cursor-pointer" onClick={() => setModule(m)}>
                  {m}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        {/* Resultados */}
        {q.trim().length <= 1 ? (
          <div className="text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar.</div>
        ) : search.isLoading ? (
          <div className="text-sm text-muted-foreground">Buscando…</div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-3">
              {data.total} resultado(s) para “{q}”
            </div>
            <div className="space-y-2">
              {data.rows.map((a: any) => (
                <Link key={a.id} to="/ajuda/artigo/$slug" params={{ slug: a.slug }}
                  onClick={() => onClickResult(a.id)}
                  className="block rounded-md border border-border p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-2 mb-1">
                    {a.help_categories?.name && (
                      <Badge variant="outline" className="text-[10px]">{a.help_categories.name}</Badge>
                    )}
                    {a.module_key && <Badge variant="secondary" className="text-[10px]">{a.module_key}</Badge>}
                  </div>
                  <div className="text-sm font-medium">{a.title}</div>
                  {a.summary && <div className="text-xs text-muted-foreground line-clamp-2">{a.summary}</div>}
                </Link>
              ))}
              {data.rows.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum artigo encontrado com os filtros atuais.</div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs text-muted-foreground">Página {page} de {totalPages}</div>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
