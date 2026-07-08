import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getHelpArticle } from "@/lib/help.functions";

/**
 * Botão discreto "?" para ajuda contextual em cada tela.
 * Passe o slug de um artigo para abrir o resumo + link para o manual completo.
 */
export function HelpContextButton({
  articleSlug,
  tutorialSlug,
  size = "sm",
}: {
  articleSlug?: string;
  tutorialSlug?: string;
  size?: "sm" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fetchArticle = useServerFn(getHelpArticle);

  useEffect(() => {
    if (!open || !articleSlug || article) return;
    setLoading(true);
    setErr(null);
    fetchArticle({ data: { slug: articleSlug } })
      .then((r) => setArticle(r))
      .catch((e: any) => setErr(e?.message ?? "Falha ao carregar ajuda"))
      .finally(() => setLoading(false));
  }, [open, articleSlug, article, fetchArticle]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={size === "icon" ? "icon" : "sm"}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Ajuda desta tela"
          title="Ajuda desta tela"
        >
          <HelpCircle className="h-4 w-4" />
          {size !== "icon" && <span className="ml-1 text-xs">Ajuda</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[92vw]">
        {loading && <div className="text-xs text-muted-foreground">Carregando ajuda…</div>}
        {err && <div className="text-xs text-destructive">{err}</div>}
        {article && (
          <div className="space-y-2">
            <div className="font-serif text-base leading-tight">{article.title}</div>
            {article.summary && (
              <p className="text-xs text-muted-foreground">{article.summary}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                to="/ajuda/artigo/$slug"
                params={{ slug: article.slug }}
                className="text-xs underline text-primary"
                onClick={() => setOpen(false)}
              >
                Abrir manual completo
              </Link>
              {tutorialSlug && (
                <Link
                  to="/ajuda"
                  search={{ tutorial: tutorialSlug } as any}
                  className="text-xs underline"
                  onClick={() => setOpen(false)}
                >
                  Iniciar tutorial guiado
                </Link>
              )}
            </div>
          </div>
        )}
        {!article && !loading && !err && (
          <div className="text-xs text-muted-foreground">
            <Link to="/ajuda" onClick={() => setOpen(false)} className="underline">
              Abrir manual do sistema
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
