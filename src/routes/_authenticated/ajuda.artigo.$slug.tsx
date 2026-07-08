import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react";
import { getHelpArticle, submitArticleFeedback } from "@/lib/help.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajuda/artigo/$slug")({
  head: () => ({ meta: [{ title: "Manual — artigo" }] }),
  component: ArtigoPage,
});

function ArtigoPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const getArt = useServerFn(getHelpArticle);
  const sendFb = useServerFn(submitArticleFeedback);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["help", "article", slug],
    queryFn: () => getArt({ data: { slug } }),
  });

  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function enviarFeedback(h: boolean) {
    if (!data) return;
    setHelpful(h);
    if (h) {
      try {
        await sendFb({ data: { article_id: data.id, helpful: true } });
        setSent(true);
        toast.success("Obrigado pelo retorno!");
      } catch {}
    }
  }

  async function enviarComentario() {
    if (!data) return;
    try {
      await sendFb({ data: { article_id: data.id, helpful: false, comment } });
      setSent(true);
      toast.success("Feedback enviado. Vamos melhorar este artigo.");
    } catch {
      toast.error("Não foi possível enviar seu feedback.");
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/ajuda" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao manual
        </Button>

        {isLoading && <div className="mt-4 text-sm text-muted-foreground">Carregando artigo…</div>}
        {isError && (
          <Card className="p-4 mt-4 border-destructive/40">
            <div className="text-sm text-destructive">{(error as any)?.message ?? "Erro"}</div>
            <Link to="/ajuda" className="text-xs underline mt-2 inline-block">Voltar ao manual</Link>
          </Card>
        )}

        {data && (
          <>
            <Card className="p-6 mt-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {data.help_categories?.name && (
                  <Badge variant="secondary">{data.help_categories.name}</Badge>
                )}
                {(data.tags ?? []).slice(0, 4).map((t: string) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
              </div>
              <h1 className="font-serif text-2xl md:text-3xl mb-2">{data.title}</h1>
              {data.summary && (
                <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>
              )}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content ?? ""}</ReactMarkdown>
              </div>
              {data.route_path && (
                <div className="text-xs text-muted-foreground mt-6 border-t border-border pt-3">
                  Caminho no sistema: <code className="text-foreground">{data.route_path}</code>
                </div>
              )}
            </Card>

            {/* Feedback */}
            <Card className="p-4 mt-4">
              <div className="text-sm font-medium mb-2">Este artigo ajudou?</div>
              {sent ? (
                <div className="text-xs text-muted-foreground">Obrigado pelo seu retorno.</div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant={helpful === true ? "default" : "outline"} onClick={() => enviarFeedback(true)}>
                    <ThumbsUp className="h-4 w-4 mr-1" /> Sim
                  </Button>
                  <Button size="sm" variant={helpful === false ? "default" : "outline"} onClick={() => setHelpful(false)}>
                    <ThumbsDown className="h-4 w-4 mr-1" /> Não
                  </Button>
                </div>
              )}
              {helpful === false && !sent && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explique o que faltou ou o que ficou confuso…"
                    rows={3}
                  />
                  <Button size="sm" onClick={enviarComentario} disabled={comment.trim().length < 3}>
                    Enviar feedback
                  </Button>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
