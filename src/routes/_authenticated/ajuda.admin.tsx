import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { AdminOnly } from "@/components/AdminOnly";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import {
  listAllHelpArticlesAdmin, listHelpCategories,
  upsertHelpArticle, deleteHelpArticle, getHelpArticle,
} from "@/lib/help.functions";

export const Route = createFileRoute("/_authenticated/ajuda/admin")({
  head: () => ({ meta: [{ title: "Administração do manual" }] }),
  component: () => <AdminOnly><AdminPage /></AdminOnly>,
});

function AdminPage() {
  const listArts = useServerFn(listAllHelpArticlesAdmin);
  const listCats = useServerFn(listHelpCategories);
  const upsert = useServerFn(upsertHelpArticle);
  const del = useServerFn(deleteHelpArticle);
  const getArt = useServerFn(getHelpArticle);
  const qc = useQueryClient();

  const cats = useQuery({ queryKey: ["help", "cats"], queryFn: () => listCats() });
  const arts = useQuery({ queryKey: ["help", "admin", "arts"], queryFn: () => listArts() });

  const [editing, setEditing] = useState<any | null>(null);

  async function abrir(slug: string) {
    try {
      const a = await getArt({ data: { slug } });
      setEditing({ ...a, tags: (a.tags ?? []).join(", ") });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao abrir");
    }
  }

  function novo() {
    setEditing({
      id: undefined, slug: "", title: "", summary: "", content: "",
      module_key: "", route_path: "", tags: "", status: "rascunho",
      is_featured: false, sort_order: 0, category_id: null,
    });
  }

  async function salvar() {
    if (!editing.slug.trim() || !editing.title.trim()) {
      toast.error("Slug e título são obrigatórios");
      return;
    }
    try {
      await upsert({
        data: {
          ...editing,
          tags: String(editing.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        },
      });
      toast.success("Salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["help"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir artigo?")) return;
    try {
      await del({ data: { id } });
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["help"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ajuda"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao manual</Link>
        </Button>
        <div className="flex items-center justify-between mt-2 mb-4">
          <h1 className="font-serif text-2xl md:text-3xl">Administração do manual</h1>
          <Button onClick={novo}><Plus className="h-4 w-4 mr-1" /> Novo artigo</Button>
        </div>

        {editing && (
          <Card className="p-4 mb-6">
            <div className="text-sm font-medium mb-3">{editing.id ? "Editar artigo" : "Novo artigo"}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <Input placeholder="Slug (ex: como-criar-rdo)" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
              <Input placeholder="Título" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <Select value={editing.category_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, category_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem categoria —</SelectItem>
                  {(cats.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Módulo (ex: rdo)" value={editing.module_key ?? ""} onChange={(e) => setEditing({ ...editing, module_key: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <Input placeholder="Caminho (ex: /rdo/novo)" value={editing.route_path ?? ""} onChange={(e) => setEditing({ ...editing, route_path: e.target.value })} />
              <Input placeholder="Tags separadas por vírgula" value={editing.tags ?? ""} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} />
            </div>
            <Textarea className="mb-2" rows={2} placeholder="Resumo" value={editing.summary ?? ""} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            <Textarea rows={10} placeholder="Conteúdo (markdown)" value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
            <div className="flex items-center gap-4 mt-2">
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} />
                Destaque
              </label>
              <Input className="w-24" type="number" placeholder="Ordem" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={salvar}>Salvar</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </Card>
        )}

        <Card className="p-2">
          {(arts.data ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-3 border-b border-border last:border-0 gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                  <Badge variant={a.status === "publicado" ? "default" : "outline"}>{a.status}</Badge>
                  {a.help_categories?.name && <Badge variant="secondary">{a.help_categories.name}</Badge>}
                  <span>slug: {a.slug}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => abrir(a.slug)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {(arts.data?.length ?? 0) === 0 && !arts.isLoading && (
            <div className="p-3 text-sm text-muted-foreground">Nenhum artigo.</div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
