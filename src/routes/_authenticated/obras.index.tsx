import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listObras, deleteObra } from "@/lib/obras.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, LayoutGrid, List, Trash2, MapPin, Building2 } from "lucide-react";
import { obraStatusMeta } from "@/components/status";
import { ObraDialog } from "@/components/obra-dialog";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/obras/")({
  component: ObrasPage,
});

function ObrasPage() {
  const fn = useServerFn(listObras);
  const delFn = useServerFn(deleteObra);
  const qc = useQueryClient();
  const { data: obras = [] } = useQuery({ queryKey: ["obras"], queryFn: () => fn() });
  const [view, setView] = useState<"cards" | "list">("cards");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Obra removida"); qc.invalidateQueries({ queryKey: ["obras"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (obras as any[]).filter((o) => o.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl">Obras</h1>
          <p className="text-sm text-muted-foreground mt-1">{obras.length} obras cadastradas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <div className="flex border border-border rounded-md">
            <button onClick={() => setView("cards")} className={`p-2 ${view === "cards" ? "bg-muted" : ""}`}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-muted" : ""}`}><List className="h-4 w-4" /></button>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-1" /> Nova obra
          </Button>
        </div>
      </header>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma obra ainda. Crie a primeira.</p>
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o) => {
            const m = obraStatusMeta[o.status as keyof typeof obraStatusMeta];
            return (
              <Card key={o.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                <Link to="/obras/$obraId" params={{ obraId: o.id }} className="block relative aspect-[16/9] bg-muted overflow-hidden">
                  {o.foto_capa_url ? (
                    <img src={o.foto_capa_url} alt={o.nome} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/60">
                      <Building2 className="h-10 w-10" />
                    </div>
                  )}
                </Link>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className={m.className}>{m.label}</Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">{Number(o.avanco_pct).toFixed(0)}%</span>
                  </div>
                  <Link to="/obras/$obraId" params={{ obraId: o.id }} className="block">
                    <h3 className="font-serif text-xl group-hover:underline">{o.nome}</h3>
                    {o.cliente && <p className="text-sm text-muted-foreground mt-0.5">{o.cliente}</p>}
                    {o.endereco && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{o.endereco}
                      </p>
                    )}
                  </Link>
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${o.avanco_pct}%` }} />
                  </div>
                  <div className="flex justify-end gap-1 mt-3 -mb-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(o); setOpen(true); }}>Editar</Button>
                    <DeleteBtn onConfirm={() => del.mutate(o.id)} />
                  </div>
                </div>
              </Card>
            );
          })}

        </div>
      ) : (
        <>
          {/* Mobile: cards empilhados */}
          <div className="md:hidden flex flex-col gap-2">
            {filtered.map((o) => {
              const m = obraStatusMeta[o.status as keyof typeof obraStatusMeta];
              return (
                <Card key={o.id} className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link to="/obras/$obraId" params={{ obraId: o.id }} className="font-medium hover:underline min-w-0 truncate">{o.nome}</Link>
                    <Badge variant="outline" className={m.className}>{m.label}</Badge>
                  </div>
                  {o.cliente && <p className="text-xs text-muted-foreground truncate">{o.cliente}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs tabular-nums text-muted-foreground">{Number(o.avanco_pct).toFixed(0)}%</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => { setEditing(o); setOpen(true); }}>Editar</Button>
                      <DeleteBtn onConfirm={() => del.mutate(o.id)} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {/* Desktop: tabela */}
          <Card className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-medium">Nome</th>
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Avanço</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const m = obraStatusMeta[o.status as keyof typeof obraStatusMeta];
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="p-3"><Link to="/obras/$obraId" params={{ obraId: o.id }} className="font-medium hover:underline">{o.nome}</Link></td>
                      <td className="p-3 text-muted-foreground">{o.cliente ?? "—"}</td>
                      <td className="p-3"><Badge variant="outline" className={m.className}>{m.label}</Badge></td>
                      <td className="p-3 text-right tabular-nums">{Number(o.avanco_pct).toFixed(0)}%</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(o); setOpen(true); }}>Editar</Button>
                        <DeleteBtn onConfirm={() => del.mutate(o.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <ObraDialog open={open} onOpenChange={setOpen} obra={editing} />
    </div>
  );
}

function DeleteBtn({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover obra?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita e removerá os RDOs vinculados.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
