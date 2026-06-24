import { useMemo, useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSignatarios, addSignatario, removeSignatario, assinarRdo,
  listEmpresaUsers, listEmpresaGrupos,
} from "@/lib/assinaturas.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Check, X, PencilSimple, Eraser, Users, User as UserIcon, ShieldCheck, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import { sha256OfJson } from "@/lib/hash";
import { fetchPosicao } from "@/lib/weather";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function SignaturesCard({ rdoId, myUserId, canManage }: { rdoId: string; myUserId?: string; canManage: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSignatarios);
  const addFn = useServerFn(addSignatario);
  const rmFn = useServerFn(removeSignatario);
  const signFn = useServerFn(assinarRdo);
  const usersFn = useServerFn(listEmpresaUsers);
  const gruposFn = useServerFn(listEmpresaGrupos);

  const { data, isLoading } = useQuery({
    queryKey: ["rdo-signatarios", rdoId],
    queryFn: () => listFn({ data: { rdo_id: rdoId } }),
  });
  const { data: users = [] } = useQuery({ queryKey: ["empresa-users"], queryFn: () => usersFn(), enabled: canManage });
  const { data: grupos = [] } = useQuery({ queryKey: ["empresa-grupos"], queryFn: () => gruposFn(), enabled: canManage });

  const signatarios = data?.signatarios ?? [];

  const total = useMemo(() => {
    // total exigido = soma de "usuários únicos" considerando grupos
    const ids = new Set<string>();
    for (const s of signatarios as any[]) {
      if (s.sujeito_tipo === "user") ids.add(s.sujeito_id);
      else for (const m of s.membros ?? []) ids.add(m.user_id);
    }
    return ids.size;
  }, [signatarios]);

  const assinaram = new Set<string>((data?.assinaturas ?? []).map((a: any) => a.user_id));
  const pct = total === 0 ? 0 : Math.round((assinaram.size / total) * 100);

  // Sou requerido?
  const requeridoParaMim = useMemo(() => {
    if (!myUserId) return false;
    for (const s of signatarios as any[]) {
      if (s.sujeito_tipo === "user" && s.sujeito_id === myUserId) return true;
      if (s.sujeito_tipo === "grupo" && (s.membros ?? []).some((m: any) => m.user_id === myUserId)) return true;
    }
    return false;
  }, [signatarios, myUserId]);
  const jaAssinei = myUserId ? assinaram.has(myUserId) : false;

  const [novoTipo, setNovoTipo] = useState<"user" | "grupo">("user");
  const [novoId, setNovoId] = useState("");
  const [adding, setAdding] = useState(false);

  async function adicionar() {
    if (!novoId) return;
    setAdding(true);
    try {
      await addFn({ data: { rdo_id: rdoId, sujeito_tipo: novoTipo, sujeito_id: novoId } });
      setNovoId("");
      qc.invalidateQueries({ queryKey: ["rdo-signatarios", rdoId] });
      toast.success("Signatário adicionado");
    } catch (e: any) { toast.error(e.message ?? "Falha ao adicionar"); }
    finally { setAdding(false); }
  }

  async function remover(id: string) {
    try {
      await rmFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["rdo-signatarios", rdoId] });
    } catch (e: any) { toast.error(e.message); }
  }

  const [openPad, setOpenPad] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarAssinatura() {
    if (!blob) { toast.error("Desenhe ou carregue a assinatura"); return; }
    setEnviando(true);
    try {
      const base64 = await blobToBase64(blob);
      const hash = await sha256OfJson({ rdo_id: rdoId, at: new Date().toISOString() });
      let geo: any = null;
      try { geo = await fetchPosicao(); } catch {/* opcional */}
      await signFn({ data: { rdo_id: rdoId, base64, mime: blob.type || "image/png", hash, geo } });
      toast.success("Assinatura registrada");
      setOpenPad(false); setBlob(null);
      qc.invalidateQueries({ queryKey: ["rdo-signatarios", rdoId] });
      qc.invalidateQueries({ queryKey: ["rdo", rdoId] });
    } catch (e: any) { toast.error(e.message ?? "Falha ao assinar"); }
    finally { setEnviando(false); }
  }

  if (isLoading) return null;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Assinaturas
          {total > 0 && (
            <Badge variant="outline" className="ml-2 tabular-nums">{assinaram.size}/{total}</Badge>
          )}
        </h3>
        {requeridoParaMim && !jaAssinei && (
          <Button size="sm" className="bg-brand text-brand-foreground" onClick={() => setOpenPad(true)}>
            <PencilSimple className="h-4 w-4 mr-1" /> Assinar agora
          </Button>
        )}
        {jaAssinei && <Badge className="bg-emerald-600 text-white border-0"><Check className="h-3 w-3 mr-1" /> Você já assinou</Badge>}
      </div>

      {total > 0 && <Progress value={pct} className="h-2 mb-3" />}

      {signatarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum signatário definido.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {signatarios.map((s: any) => (
            <li key={s.id} className="flex items-start justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  {s.sujeito_tipo === "grupo" ? <Users className="h-4 w-4 text-muted-foreground" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-medium truncate">{s.nome}</span>
                  {s.assinado
                    ? <Badge className="bg-emerald-600 text-white border-0 text-[10px]"><Check className="h-3 w-3" /></Badge>
                    : <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300"><Warning className="h-3 w-3 mr-0.5" />Pendente</Badge>}
                </div>
                {s.sujeito_tipo === "grupo" && (s.membros ?? []).length > 0 && (
                  <ul className="ml-6 mt-1 text-xs space-y-0.5">
                    {s.membros.map((m: any) => (
                      <li key={m.user_id} className="flex items-center gap-2">
                        <span className={m.assinado ? "text-emerald-700" : "text-amber-700"}>
                          {m.assinado ? "✓" : "•"}
                        </span>
                        <span className={m.assinado ? "line-through text-muted-foreground" : ""}>{m.nome}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canManage && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remover(s.id)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div>
            <label className="text-[10px] text-muted-foreground block">Tipo</label>
            <Select value={novoTipo} onValueChange={(v) => { setNovoTipo(v as any); setNovoId(""); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="grupo">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] text-muted-foreground block">{novoTipo === "user" ? "Usuário" : "Grupo"}</label>
            <Select value={novoId} onValueChange={setNovoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {novoTipo === "user"
                  ? (users as any[]).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)
                  : (grupos as any[]).map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!novoId || adding} onClick={adicionar}>Adicionar</Button>
        </div>
      )}

      {openPad && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => !enviando && setOpenPad(false)}>
          <Card className="w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-serif text-lg">Sua assinatura</h4>
            <MiniSignaturePad onChange={setBlob} />
            <div className="flex items-center gap-2">
              <label className="text-xs inline-flex items-center gap-1 px-2 py-1.5 border border-border rounded-md cursor-pointer hover:bg-accent">
                Carregar imagem
                <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  try { const img = await compressImage(f, { maxDim: 1600, quality: 0.9, maxBytes: 1_500_000 }); setBlob(img); toast.success("Imagem carregada"); }
                  catch (err: any) { toast.error(err?.message ?? "Falha"); }
                }} />
              </label>
              {blob && <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Pronta</span>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={enviando} onClick={() => { setOpenPad(false); setBlob(null); }}>Cancelar</Button>
              <Button className="bg-brand text-brand-foreground" disabled={!blob || enviando} onClick={enviarAssinatura}>
                {enviando ? "Enviando…" : "Assinar"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

function MiniSignaturePad({ onChange }: { onChange: (b: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#111111";
  }, []);

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) canvasRef.current!.toBlob((b) => onChange(b), "image/png");
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dirty.current = false; onChange(null);
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={clear}><Eraser className="h-3 w-3 mr-1" />Limpar</Button>
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30">
        <canvas ref={canvasRef} className="w-full h-40 touch-none block"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      </div>
    </div>
  );
}
