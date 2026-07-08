import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, ArrowLeft } from "lucide-react";
import { listHelpArticles } from "@/lib/help.functions";

export const Route = createFileRoute("/_authenticated/ajuda/glossario")({
  head: () => ({ meta: [{ title: "Ajuda — Glossário" }] }),
  component: GlossarioPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 max-w-lg mx-auto text-center">
      <h1 className="font-serif text-xl mb-2">Erro ao carregar o Glossário</h1>
      <p className="text-sm text-muted-foreground mb-4">{(error as any)?.message ?? "Erro inesperado."}</p>
      <button className="text-sm underline" onClick={reset}>Tentar novamente</button>
    </div>
  ),
});

function GlossarioPage() {
  const listFn = useServerFn(listHelpArticles);
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["help", "glossario"],
    queryFn: () => listFn({ data: { category_slug: "glossario" } }),
  });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = [...(data as any[])].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "pt-BR"));
    if (!t) return rows;
    return rows.filter((r) =>
      (r.title ?? "").toLowerCase().includes(t) ||
      (r.summary ?? "").toLowerCase().includes(t),
    );
  }, [data, q]);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const it of filtered) {
      const letter = ((it.title ?? "?")[0] ?? "?").toUpperCase();
      (g[letter] ??= []).push(it);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filtered]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Link to="/ajuda" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Voltar à Ajuda
        </Link>
        <div className="flex items-center gap-2 mt-3 mb-1">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl md:text-3xl">Glossário</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Definições rápidas dos termos usados no sistema.</p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar termo…" className="pl-9" />
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {isError && (
          <Card className="p-4 border-destructive/40 text-sm text-destructive">
            {(error as any)?.message ?? "Erro ao carregar."}
          </Card>
        )}

        {grouped.map(([letter, items]) => (
          <section key={letter} className="mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{letter}</h2>
            <div className="space-y-2">
              {items.map((a) => (
                <Link key={a.id} to="/ajuda/artigo/$slug" params={{ slug: a.slug }}>
                  <Card className="p-3 hover:border-primary transition-colors">
                    <div className="text-sm font-medium">{a.title}</div>
                    {a.summary && <div className="text-xs text-muted-foreground mt-0.5">{a.summary}</div>}
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum termo encontrado.</div>
        )}
      </div>
    </AppShell>
  );
}
