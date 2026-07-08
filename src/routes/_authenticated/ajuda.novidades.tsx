import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { listChangelog, createChangelogEntry } from "@/lib/help.functions";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/ajuda/novidades")({
  head: () => ({ meta: [{ title: "Novidades e atualizações" }] }),
  component: NovidadesPage,
});

const chgTypeLabel: Record<string, string> = {
  novo: "Nova funcionalidade",
  correcao: "Correção",
  melhoria: "Melhoria",
  seguranca: "Segurança",
  integracao: "Integração",
  visual: "Visual",
};

function NovidadesPage() {
  const { isAdminOrMaster: isAdmin } = useIsAdmin();
  const list = useServerFn(listChangelog);
  const create = useServerFn(createChangelogEntry);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["help", "changelog"], queryFn: () => list({ data: { limit: 200 } }) });

  const [form, setForm] = useState<any>({ change_type: "novo", title: "", description: "", how_to_use: "", version: "" });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await create({ data: form });
      toast.success("Novidade registrada");
      setForm({ change_type: "novo", title: "", description: "", how_to_use: "", version: "" });
      qc.invalidateQueries({ queryKey: ["help", "changelog"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ajuda"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao manual</Link>
        </Button>
        <h1 className="font-serif text-2xl md:text-3xl mt-2 mb-4">Novidades e atualizações</h1>

        {isAdmin && (
          <Card className="p-4 mb-6">
            <div className="text-sm font-medium mb-2 flex items-center gap-2"><Plus className="h-4 w-4" /> Registrar nova atualização</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <Input placeholder="Versão (ex: 1.4.0)" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              <Select value={form.change_type} onValueChange={(v) => setForm({ ...form, change_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(chgTypeLabel).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Módulo (ex: rdo)" value={form.module_key ?? ""} onChange={(e) => setForm({ ...form, module_key: e.target.value })} />
            </div>
            <Input className="mb-2" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea className="mb-2" rows={2} placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Textarea className="mb-2" rows={2} placeholder="Como usar" value={form.how_to_use} onChange={(e) => setForm({ ...form, how_to_use: e.target.value })} />
            <Button size="sm" onClick={salvar} disabled={saving || !form.title.trim()}>Registrar</Button>
          </Card>
        )}

        <div className="space-y-3">
          {(data ?? []).map((e: any) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="secondary">{chgTypeLabel[e.change_type] ?? e.change_type}</Badge>
                {e.version && <Badge variant="outline">v{e.version}</Badge>}
                <div className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="font-medium">{e.title}</div>
              {e.description && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{e.description}</div>}
              {e.how_to_use && (
                <div className="text-xs mt-2 border-l-2 border-primary pl-2">
                  <span className="uppercase tracking-wider text-muted-foreground text-[10px]">Como usar</span>
                  <div className="whitespace-pre-wrap">{e.how_to_use}</div>
                </div>
              )}
              {e.help_articles?.slug && (
                <Link to="/ajuda/artigo/$slug" params={{ slug: e.help_articles.slug }} className="text-xs underline mt-2 inline-block">
                  Ver no manual: {e.help_articles.title}
                </Link>
              )}
            </Card>
          ))}
          {(data?.length ?? 0) === 0 && (
            <Card className="p-4 text-sm text-muted-foreground">Nenhuma atualização registrada.</Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
