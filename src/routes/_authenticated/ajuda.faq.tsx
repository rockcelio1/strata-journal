import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Search, ArrowLeft } from "lucide-react";
import { listHelpArticles } from "@/lib/help.functions";

export const Route = createFileRoute("/_authenticated/ajuda/faq")({
  head: () => ({ meta: [{ title: "Ajuda — Perguntas Frequentes (FAQ)" }] }),
  component: FaqPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 max-w-lg mx-auto text-center">
      <h1 className="font-serif text-xl mb-2">Erro ao carregar o FAQ</h1>
      <p className="text-sm text-muted-foreground mb-4">{(error as any)?.message ?? "Erro inesperado."}</p>
      <button className="text-sm underline" onClick={reset}>Tentar novamente</button>
    </div>
  ),
});

function FaqPage() {
  const listFn = useServerFn(listHelpArticles);
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["help", "faq"],
    queryFn: () => listFn({ data: { category_slug: "faq" } }),
  });
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const rows = (data as any[]).filter((a) => a.module_key === "faq" || true);
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      (r.title ?? "").toLowerCase().includes(t) ||
      (r.summary ?? "").toLowerCase().includes(t) ||
      (r.tags ?? []).some((x: string) => x.toLowerCase().includes(t)),
    );
  }, [data, q]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Link to="/ajuda" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Voltar à Ajuda
        </Link>
        <div className="flex items-center gap-2 mt-3 mb-1">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl md:text-3xl">Perguntas Frequentes</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Respostas rápidas para dúvidas comuns do dia a dia.</p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar perguntas…" className="pl-9" />
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {isError && (
          <Card className="p-4 border-destructive/40 text-sm text-destructive">
            {(error as any)?.message ?? "Erro ao carregar."}
          </Card>
        )}

        <div className="space-y-2">
          {items.map((a: any) => (
            <Link key={a.id} to="/ajuda/artigo/$slug" params={{ slug: a.slug }}>
              <Card className="p-3 hover:border-primary transition-colors">
                <div className="text-sm font-medium">{a.title}</div>
                {a.summary && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.summary}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">FAQ</Badge>
                  {(a.tags ?? []).slice(0, 3).map((t: string) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
          {!isLoading && items.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhuma pergunta encontrada.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
