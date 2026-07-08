import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { listHelpArticles, listHelpCategories } from "@/lib/help.functions";

export const Route = createFileRoute("/_authenticated/ajuda/categoria/$slug")({
  head: () => ({ meta: [{ title: "Manual — categoria" }] }),
  component: CategoriaPage,
});

function CategoriaPage() {
  const { slug } = Route.useParams();
  const listCats = useServerFn(listHelpCategories);
  const listArts = useServerFn(listHelpArticles);

  const cats = useQuery({ queryKey: ["help", "cats"], queryFn: () => listCats() });
  const arts = useQuery({
    queryKey: ["help", "cat-arts", slug],
    queryFn: () => listArts({ data: { category_slug: slug, limit: 200 } }),
  });

  const cat = (cats.data ?? []).find((c: any) => c.slug === slug);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ajuda"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao manual</Link>
        </Button>
        <h1 className="font-serif text-2xl md:text-3xl mt-2 mb-1">{cat?.name ?? slug}</h1>
        {cat?.description && <p className="text-sm text-muted-foreground mb-4">{cat.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(arts.data ?? []).map((a: any) => (
            <Link key={a.id} to="/ajuda/artigo/$slug" params={{ slug: a.slug }}>
              <Card className="p-4 hover:border-primary transition-colors h-full">
                <div className="text-sm font-medium">{a.title}</div>
                {a.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</div>}
              </Card>
            </Link>
          ))}
          {(arts.data?.length ?? 0) === 0 && !arts.isLoading && (
            <Card className="p-4 text-sm text-muted-foreground">Nenhum artigo nesta categoria.</Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
