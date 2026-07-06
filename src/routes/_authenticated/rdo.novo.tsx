import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { listObras } from "@/lib/obras.functions";
import { listMaoDeObra, listEquipamentos, listTiposOcorrencia } from "@/lib/cadastros.functions";
import { createRdo, registrarAnexo } from "@/lib/rdo.functions";
import { uploadOneDriveAnexo } from "@/lib/onedrive.functions";

import { getMe } from "@/lib/core.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Plus, X, Camera, Eraser, Check, CloudSun, MapPin, ShieldCheck, ArrowUp, ArrowDown, CircleNotch,
} from "@phosphor-icons/react";
import { compressImage } from "@/lib/image-compress";
import { fetchPosicao, fetchClima, fetchClimaPorEndereco, classificaClima, fetchPrevisao5DiasPorEndereco, fetchClimaPorCep, fetchPrevisao5DiasPorCep, detectarCepAutomaticamente, validarCep, diffPrevisoes, WeatherError, type ClimaSnapshot, type DiaPrevisao } from "@/lib/weather";
import { measure, dedupe } from "@/lib/perf";
import { getObraClimaCache, saveObraClimaCache } from "@/lib/obras.functions";
import { sha256OfJson } from "@/lib/hash";
import { enqueueRdo, markQueued } from "@/lib/offline-queue";
import { isUuid, sanitizeRdoPayload, validateRdoForm } from "@/lib/rdo-validate";
import { ButtonEffectRenderer } from "@/components/button-effects";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-storage";
import { CameraCapture } from "@/components/rdo/CameraCapture";
import { PhotoEditor } from "@/components/rdo/PhotoEditor";
import { getImageDimensions, MIN_IMAGE_DIM } from "@/lib/image-utils";
import { createDraftChannel } from "@/lib/draft-channel";

const searchSchema = z.object({ obra: z.string().optional() });

export const Route = createFileRoute("/_authenticated/rdo/novo")({
  validateSearch: searchSchema,
  component: NovoRdoPage,
});

const climas = [
  { value: "ensolarado", label: "Ensolarado" },
  { value: "nublado", label: "Nublado" },
  { value: "chuvoso", label: "Chuvoso" },
  { value: "chuva_forte", label: "Chuva forte" },
  { value: "impraticavel", label: "Impraticável" },
];

const steps = [
  { key: "obra", label: "Obra" },
  { key: "clima", label: "Clima" },
  { key: "atividades", label: "Atividades" },
  { key: "mao", label: "Mão de obra" },
  { key: "equip", label: "Equipamentos" },
  { key: "oc", label: "Ocorrências" },
  { key: "fotos", label: "Fotos da obra" },
  { key: "assinatura", label: "Assinatura" },
] as const;

function NovoRdoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/rdo/novo" });
  const obrasFn = useServerFn(listObras);
  const maoFn = useServerFn(listMaoDeObra);
  const equipFn = useServerFn(listEquipamentos);
  const tiposFn = useServerFn(listTiposOcorrencia);
  const createFn = useServerFn(createRdo);
  const meFn = useServerFn(getMe);
  const registrarFn = useServerFn(registrarAnexo);
  const uploadOneDriveFn = useServerFn(uploadOneDriveAnexo);
  const getClimaCacheFn = useServerFn(getObraClimaCache);
  const saveClimaCacheFn = useServerFn(saveObraClimaCache);


  const { data: obras = [] } = useQuery({ queryKey: ["obras"], queryFn: () => obrasFn() });
  const { data: maoOpts = [] } = useQuery({ queryKey: ["mao_de_obra"], queryFn: () => maoFn() });
  const { data: equipOpts = [] } = useQuery({ queryKey: ["equipamentos"], queryFn: () => equipFn() });
  const { data: tiposOpts = [] } = useQuery({ queryKey: ["tipos_ocorrencia"], queryFn: () => tiposFn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<any>({
    obra_id: search.obra ?? "",
    data: new Date().toISOString().slice(0, 10),
    clima_manha: null, clima_tarde: null, clima_noite: null,
    observacoes: "",
    atividades: [] as any[],
    mao_de_obra: [] as any[],
    equipamentos: [] as any[],
    ocorrencias: [] as any[],
  });
  const [fotos, setFotos] = useState<File[]>([]);
  const [legendas, setLegendas] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editorIdx, setEditorIdx] = useState<number | null>(null);
  const [lowResIdxs, setLowResIdxs] = useState<number[]>([]);
  type UpStatus = "pending" | "enviando" | "processando" | "feito" | "erro" | "fallback" | "aguardando-rede";
  const [uploadProgress, setUploadProgress] = useState<Array<{ name: string; status: UpStatus; error?: string; provider?: "onedrive" | "supabase"; attempt?: number }>>([]);
  const [uploadHistory, setUploadHistory] = useState<Array<{ at: string; name: string; status: UpStatus; provider?: string; error?: string }>>([]);

  const [compressing, setCompressing] = useState(false);
  const [climaInfo, setClimaInfo] = useState<ClimaSnapshot | null>(null);
  const [climaStatus, setClimaStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [climaErro, setClimaErro] = useState<string | null>(null);
  const [previsao5, setPrevisao5] = useState<DiaPrevisao[] | null>(null);
  const [previsaoLocal, setPrevisaoLocal] = useState<string | null>(null);
  const [previsaoAt, setPrevisaoAt] = useState<string | null>(null);
  const [refreshMin, setRefreshMin] = useState<1 | 5 | 10>(() => {
    const v = Number(localStorage.getItem("rdo:weather-refresh-min"));
    return (v === 1 || v === 5 || v === 10) ? (v as 1 | 5 | 10) : 10;
  });
  const [agoraTick, setAgoraTick] = useState(0); // re-render para "Atualizado há X"
  const [cepInput, setCepInput] = useState("");
  const [cepDetecting, setCepDetecting] = useState(false);
  const climaLoading = climaStatus === "loading";

  const [assinaturaBlob, setAssinaturaBlob] = useState<Blob | null>(null);
  const [signer, setSigner] = useState({ nome: me?.profile?.nome ?? "", cargo: "" });
  useEffect(() => { if (me?.profile?.nome && !signer.nome) setSigner((s) => ({ ...s, nome: me.profile!.nome })); }, [me]);

  // ---- Rascunho local (IndexedDB) — salva automaticamente e restaura ao reabrir
  const draftKey = `rdo-novo:${me?.profile?.id ?? "anon"}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (!me?.profile?.id || draftLoaded) return;
    (async () => {
      const d = await loadDraft<{ form: any; legendas: string[]; signer: any; stepIdx: number; fotos?: Blob[] }>(draftKey);
      if (d?.value?.form) {
        setForm(d.value.form);
        if (Array.isArray(d.value.legendas)) setLegendas(d.value.legendas);
        if (d.value.signer) setSigner(d.value.signer);
        if (typeof d.value.stepIdx === "number") setStepIdx(d.value.stepIdx);
        if (Array.isArray(d.value.fotos) && d.value.fotos.length) {
          setFotos(d.value.fotos.map((b, i) =>
            b instanceof File ? b : new File([b], `foto-${i}.jpg`, { type: (b as Blob).type || "image/jpeg" })
          ));
        }
        toast.info("Rascunho restaurado automaticamente.");
      }
      setDraftLoaded(true);
    })();
  }, [me?.profile?.id]);
  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => {
      saveDraft(draftKey, { form, legendas, signer, stepIdx, fotos });
      channelRef.current?.post({ type: "saved", at: Date.now(), tabId: channelRef.current.tabId, fotosCount: fotos.length });
    }, 400);
    return () => clearTimeout(t);
  }, [form, legendas, signer, stepIdx, fotos, draftLoaded, draftKey]);

  // ---- BroadcastChannel: sincroniza rascunho entre abas
  const channelRef = useRef<ReturnType<typeof createDraftChannel> | null>(null);
  useEffect(() => {
    if (!me?.profile?.id) return;
    const ch = createDraftChannel(draftKey);
    channelRef.current = ch;
    ch.post({ type: "claim", tabId: ch.tabId });
    const off = ch.on(async (m) => {
      if (m.tabId === ch.tabId) return;
      if (m.type === "claim") {
        ch.post({ type: "ack", tabId: ch.tabId });
        toast.warning("Outra aba está editando este RDO. Mudanças serão mescladas pela aba mais recente.");
      } else if (m.type === "saved") {
        const d = await loadDraft<{ form: any; legendas: string[]; signer: any; stepIdx: number; fotos?: Blob[] }>(draftKey);
        if (!d?.value) return;
        setForm(d.value.form);
        if (Array.isArray(d.value.legendas)) setLegendas(d.value.legendas);
        if (Array.isArray(d.value.fotos)) {
          setFotos(d.value.fotos.map((b, i) =>
            b instanceof File ? b : new File([b], `foto-${i}.jpg`, { type: (b as Blob).type || "image/jpeg" })
          ));
        }
      }
    });
    return () => { off(); ch.close(); channelRef.current = null; };
  }, [me?.profile?.id, draftKey]);

  // ---- Detecta fotos de baixa resolução
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const low: number[] = [];
      for (let i = 0; i < fotos.length; i++) {
        try {
          const { width, height } = await getImageDimensions(fotos[i]);
          if (Math.min(width, height) < MIN_IMAGE_DIM) low.push(i);
        } catch { /* ignora */ }
      }
      if (!cancelled) setLowResIdxs(low);
    })();
    return () => { cancelled = true; };
  }, [fotos]);


  function applyTurnoClima(codigo: number) {
    const turno = new Date().getHours();
    const key = turno < 12 ? "clima_manha" : turno < 18 ? "clima_tarde" : "clima_noite";
    setForm((f: any) => ({ ...f, [key]: classificaClima(codigo) }));
  }

  async function importarClima() {
    setClimaStatus("loading"); setClimaErro(null);
    try {
      const pos = await fetchPosicao();
      const snap = await fetchClima(pos.latitude, pos.longitude);
      setClimaInfo(snap); applyTurnoClima(snap.codigo);
      setClimaStatus("success");
      toast.success(`${snap.descricao} · ${snap.temperatura_c}°C`);
    } catch (e: any) {
      const msg = e?.message ?? "Não foi possível obter o clima";
      setClimaStatus("error"); setClimaErro(msg);
    }
  }

  // Cache válido por 30 min (mesma janela do cache em memória da previsão).
  const CACHE_TTL_MS = 30 * 60 * 1000;

  async function carregarPrevisaoDaObra(opts: { forcar?: boolean } = {}) {
    const obra = (obras as any[]).find((o) => o.id === form.obra_id);
    if (!obra?.endereco) { toast.error("Selecione uma obra com endereço cadastrado"); return; }
    const dedupeKey = `previsao:${obra.id}:${opts.forcar ? "f" : "c"}`;
    try {
      return await dedupe(dedupeKey, async () => {
        setClimaStatus("loading"); setClimaErro(null);
        // 1) cache no banco
        if (!opts.forcar) {
          try {
            const c = await measure("supabase:get_clima_cache", () => getClimaCacheFn({ data: { obra_id: obra.id } }), { obra_id: obra.id });
            const at = c?.cache_at ? new Date(c.cache_at).getTime() : 0;
            if (c?.cache && Date.now() - at < CACHE_TTL_MS) {
              const cache = c.cache as { snapshot: ClimaSnapshot & { local: string }; dias: DiaPrevisao[] };
              setClimaInfo(cache.snapshot); applyTurnoClima(cache.snapshot.codigo);
              setPrevisao5(cache.dias); setPrevisaoLocal(cache.snapshot.local);
              setPrevisaoAt(c.cache_at); setClimaStatus("success");
              return;
            }
          } catch { /* segue para API */ }
        }
        // 2) Open-Meteo (current + previsão)
        const snap = await measure("clima:atual_por_endereco", () => fetchClimaPorEndereco(obra.endereco));
        const prev = await measure("clima:previsao_por_endereco", () => fetchPrevisao5DiasPorEndereco(obra.endereco));
        const mudou = diffPrevisoes(previsao5, prev.dias);
        setClimaInfo(snap); applyTurnoClima(snap.codigo);
        setPrevisao5(prev.dias); setPrevisaoLocal(prev.local);
        setClimaStatus("success");
        // 3) persiste no banco
        try {
          await measure("supabase:save_clima_cache", () => saveClimaCacheFn({ data: { obra_id: obra.id, cache: { snapshot: snap, dias: prev.dias } } }));
          setPrevisaoAt(new Date().toISOString());
        } catch { /* não bloqueia UX */ }
        if (!opts.forcar) toast.success(`${snap.descricao} · ${snap.temperatura_c}°C — ${snap.local}`);
        if (mudou.length > 0) {
          toast.warning(`Previsão alterada para ${mudou.length} dia(s): ${mudou.map((d) => d.dia_semana).join(", ")}`, { duration: 8000 });
        }
      });
    } catch (e: any) {
      setClimaStatus("error"); setClimaErro(e?.message ?? "Não foi possível obter o clima");
    }
  }

  const importarClimaPorObra = () => carregarPrevisaoDaObra({ forcar: false });
  const atualizarPrevisao = () => carregarPrevisaoDaObra({ forcar: true });

  // Auto-refresh configurável (1/5/10 min) — dedupe garante que múltiplos
  // gatilhos (interval + visibilitychange + clique) não disparem chamadas duplicadas.
  useEffect(() => {
    if (!form.obra_id) return;
    const periodMs = refreshMin * 60 * 1000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") carregarPrevisaoDaObra({ forcar: true });
    }, periodMs);
    const onVis = () => {
      if (document.visibilityState !== "visible" || !previsaoAt) return;
      const idade = Date.now() - new Date(previsaoAt).getTime();
      if (idade > periodMs) carregarPrevisaoDaObra({ forcar: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.obra_id, previsaoAt, refreshMin]);

  // Tick a cada 30s para atualizar "atualizado há X" sem refazer requisição
  useEffect(() => {
    if (!previsaoAt) return;
    const id = setInterval(() => setAgoraTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, [previsaoAt]);

  function tempoRelativo(iso: string | null): string {
    if (!iso) return "—";
    void agoraTick; // dep para re-render
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `há ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60);
    return `há ${h}h`;
  }

  function describeWeatherError(e: any, fallback: string): string {
    if (e instanceof WeatherError) {
      const slug = e.status ? `${e.code}:${e.status}` : e.code;
      return `${e.message} [${slug}]`;
    }
    return e?.message ?? fallback;
  }

  async function importarClimaPorCep() {
    const v = validarCep(cepInput);
    if (!v.ok) {
      const msg = `${v.mensagem} [${v.code}]`;
      setClimaErro(msg); return;
    }
    setCepInput(v.cep);
    setClimaStatus("loading"); setClimaErro(null);
    try {
      const snap = await fetchClimaPorCep(v.cep);
      const prev = await fetchPrevisao5DiasPorCep(v.cep);
      setClimaInfo(snap); applyTurnoClima(snap.codigo);
      setPrevisao5(prev.dias); setPrevisaoLocal(prev.local);
      setClimaStatus("success");
      toast.success(`${snap.descricao} · ${snap.temperatura_c}°C — ${snap.local}`);
    } catch (e: any) {
      const msg = describeWeatherError(e, "Não foi possível obter o clima pelo CEP");
      setClimaStatus("error"); setClimaErro(msg);
    }
  }

  async function detectarCep() {
    setCepDetecting(true); setClimaErro(null);
    try {
      const info = await detectarCepAutomaticamente();
      setCepInput(info.cep);
      toast.success(`CEP detectado: ${info.cep} — ${info.localidade ?? ""}/${info.uf ?? ""}`);
      setClimaStatus("loading");
      const snap = await fetchClimaPorCep(info.cep);
      const prev = await fetchPrevisao5DiasPorCep(info.cep);
      setClimaInfo(snap); applyTurnoClima(snap.codigo);
      setPrevisao5(prev.dias); setPrevisaoLocal(prev.local);
      setClimaStatus("success");
    } catch (e: any) {
      const msg = describeWeatherError(e, "Não foi possível detectar o CEP automaticamente");
      setClimaErro(msg); setClimaStatus("error");
    } finally {
      setCepDetecting(false);
    }
  }


  async function onAddFotos(files: FileList) {
    // Mantém a qualidade original da câmera do celular: sem compressão e sem limite de quantidade/tamanho.
    const out: File[] = Array.from(files);
    setFotos((p) => [...p, ...out]);
    setLegendas((p) => [...p, ...out.map(() => "")]);
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function uploadAttachments(rdoId: string, empresaId: string, sigManifest: any | null) {
    const all: { file: Blob; name: string; mime: string; legenda?: string }[] = fotos.map((f, i) => ({
      file: f, name: f.name, mime: f.type || "image/jpeg", legenda: legendas[i] || undefined,
    }));
    if (assinaturaBlob) all.push({ file: assinaturaBlob, name: "assinatura.png", mime: "image/png" });
    if (sigManifest) {
      const json = new Blob([JSON.stringify(sigManifest, null, 2)], { type: "application/json" });
      all.push({ file: json, name: "assinatura.json", mime: "application/json" });
    }
    const rootFolder = (typeof window !== "undefined" ? localStorage.getItem("onedrive.root_folder") : null) ?? undefined;
    setUploadProgress(all.map((a) => ({ name: a.name, status: "pending" as UpStatus })));
    const pushHist = (entry: { name: string; status: UpStatus; provider?: string; error?: string }) =>
      setUploadHistory((h) => [{ at: new Date().toISOString(), ...entry }, ...h].slice(0, 50));

    const waitOnline = async (label: string, idx: number) => {
      if (typeof navigator !== "undefined" && navigator.onLine) return;
      setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "aguardando-rede" } : x));
      toast.warning(`Sem conexão — aguardando rede para reenviar "${label}"`);
      await new Promise<void>((resolve) => {
        const onUp = () => { window.removeEventListener("online", onUp); resolve(); };
        window.addEventListener("online", onUp);
      });
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const MAX_ATTEMPTS = 4;

    for (let idx = 0; idx < all.length; idx++) {
      const a = all[idx];
      const size = (a.file as any).size ?? 0;
      setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "enviando" } : x));
      const base64 = await blobToBase64(a.file);
      setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "processando" } : x));
      let uploaded = false;
      let lastErr: any;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !uploaded; attempt++) {
        await waitOnline(a.name, idx);
        setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "enviando", attempt: attempt + 1 } : x));
        try {
          await uploadOneDriveFn({ data: {
            rdo_id: rdoId, nome: a.name, mime_type: a.mime, tamanho_bytes: size,
            base64, legenda: a.legenda, root_folder: rootFolder,
          }});
          uploaded = true;
        } catch (e: any) {
          lastErr = e;
          console.warn(`[rdo] OneDrive tentativa ${attempt + 1} falhou:`, e?.message);
          pushHist({ name: a.name, status: "erro", provider: "onedrive", error: `tentativa ${attempt + 1}: ${e?.message ?? "erro"}` });
          if (attempt < MAX_ATTEMPTS - 1) await sleep(500 * Math.pow(2, attempt));
        }
      }
      if (uploaded) {
        setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "feito", provider: "onedrive" } : x));
        pushHist({ name: a.name, status: "feito", provider: "onedrive" });
      } else {
        console.error("[rdo] OneDrive falhou após retentativas, usando Supabase Storage:", lastErr?.message);
        toast.warning("OneDrive indisponível, usando armazenamento alternativo", { description: lastErr?.message?.slice(0, 200) });
        let sbDone = false; let sbErr: any;
        for (let attempt = 0; attempt < MAX_ATTEMPTS && !sbDone; attempt++) {
          await waitOnline(a.name, idx);
          try {
            const safe = a.name.replace(/[^\w.\-]+/g, "_");
            const path = `${empresaId}/${rdoId}/${Date.now()}-${safe}`;
            const up = await supabase.storage.from("rdo-anexos").upload(path, a.file, { contentType: a.mime, upsert: false });
            if (up.error) throw up.error;
            await registrarFn({ data: {
              rdo_id: rdoId, nome: a.legenda ? `${a.name} — ${a.legenda}` : a.name,
              storage_path: path, mime_type: a.mime, tamanho_bytes: size,
            }});
            setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "fallback", provider: "supabase" } : x));
            pushHist({ name: a.name, status: "fallback", provider: "supabase" });
            sbDone = true;
          } catch (e: any) {
            sbErr = e;
            if (attempt < MAX_ATTEMPTS - 1) await sleep(500 * Math.pow(2, attempt));
          }
        }
        if (!sbDone) {
          setUploadProgress((p) => p.map((x, i) => i === idx ? { ...x, status: "erro", error: sbErr?.message } : x));
          pushHist({ name: a.name, status: "erro", provider: "supabase", error: sbErr?.message });
          throw sbErr;
        }
      }
    }
  }




  async function buildSignatureManifest(payload: any): Promise<any | null> {
    if (!assinaturaBlob || !signer.nome || !signer.cargo) return null;
    let geo: { latitude: number; longitude: number } | null = null;
    try { geo = await fetchPosicao(); } catch {/* opcional */}
    const hash = await sha256OfJson(payload);
    return {
      nome: signer.nome, cargo: signer.cargo,
      assinado_em: new Date().toISOString(),
      hash_sha256: hash,
      geolocalizacao: geo,
      user_agent: navigator.userAgent,
    };
  }

  type LogEntry = { at: string; kind: "start" | "ok" | "erro" | "offline"; mensagem: string; etapa?: string };
  const [submitLog, setSubmitLog] = useState<LogEntry[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flashRow, setFlashRow] = useState<{ key: string; idx: number } | null>(null);
  function pushLog(e: Omit<LogEntry, "at">) {
    setSubmitLog((l) => [{ at: new Date().toISOString(), ...e }, ...l].slice(0, 30));
  }

  const save = useMutation({
    mutationFn: async (enviar: boolean) => {
      pushLog({ kind: "start", mensagem: enviar ? "Iniciando envio do RDO…" : "Salvando rascunho…" });
      const { sane: cleaned, dropped, total_dropped } = sanitizeRdoPayload(form);
      // Índices descartados (sobre o array original) para feedback ao usuário.
      const droppedIdx = {
        equipamentos: (form.equipamentos ?? [])
          .map((e: any, i: number) => (isUuid(e?.equipamento_id) ? -1 : i))
          .filter((i: number) => i >= 0),
        ocorrencias: (form.ocorrencias ?? [])
          .map((o: any, i: number) => (o?.descricao?.trim() ? -1 : i))
          .filter((i: number) => i >= 0),
      };
      if (total_dropped > 0) {
        const partes = [
          dropped.equipamentos && `equipamentos #${droppedIdx.equipamentos.map((i: number) => i + 1).join(", ")}`,
          dropped.ocorrencias && `ocorrências #${droppedIdx.ocorrencias.map((i: number) => i + 1).join(", ")}`,
          dropped.mao_de_obra && `mão de obra: ${dropped.mao_de_obra}`,
          dropped.atividades && `atividades: ${dropped.atividades}`,
        ].filter(Boolean).join(" · ");
        pushLog({ kind: "erro", etapa: "Sanitização", mensagem: `Descartado(s) ${total_dropped} item(ns) inválido(s) — ${partes}` });
        toast.warning(`${total_dropped} item(ns) descartado(s) antes do envio`, { description: partes });
      }
      const payload = { ...cleaned, enviar };
      const sigManifest = await buildSignatureManifest(payload);
      const queued = await enqueueRdo({ ...payload, _assinatura: sigManifest });

      if (!navigator.onLine) {
        toast.info("Salvo offline. Será sincronizado quando voltar a conexão.");
        pushLog({ kind: "offline", mensagem: "Sem conexão — RDO enfileirado para sincronizar." });
        return { offline: true as const, local_id: queued.local_id, total_dropped, dropped };
      }
      try {
        const rdo: any = await createFn({ data: payload });
        if ((fotos.length || assinaturaBlob) && me?.profile?.empresa_id) {
          try { await uploadAttachments(rdo.id, me.profile.empresa_id, sigManifest); }
          catch (e: any) {
            toast.error("Anexos: " + (e.message ?? "falha"));
            pushLog({ kind: "erro", etapa: "Anexos", mensagem: e?.message ?? "Falha ao enviar anexos" });
          }
        }
        await markQueued(queued.local_id, { status: "sincronizado", remote_id: rdo.id });
        return { offline: false as const, rdo, total_dropped, dropped };
      } catch (e: any) {
        await markQueued(queued.local_id, { status: "erro", error: e?.message });
        throw e;
      }
    },
    onSuccess: (r: any) => {
      clearDraft(draftKey);
      const enviadoCount =
        (form.atividades?.length ?? 0) + (form.mao_de_obra?.length ?? 0) +
        (form.equipamentos?.length ?? 0) + (form.ocorrencias?.length ?? 0) - (r.total_dropped ?? 0);
      const resumo = r.total_dropped
        ? `${enviadoCount} válido(s) · ${r.total_dropped} descartado(s)`
        : `${enviadoCount} item(ns) enviado(s)`;
      pushLog({ kind: "ok", mensagem: r.offline ? `RDO em fila offline (${resumo})` : `RDO ${r.rdo?.numero ?? ""} sincronizado (${resumo})` });
      if (r.offline) { toast.success("RDO em fila offline", { description: resumo }); navigate({ to: "/rdo" }); }
      else { toast.success("RDO sincronizado", { description: resumo }); navigate({ to: "/rdo/$rdoId", params: { rdoId: r.rdo.id } }); }
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Falha ao concluir RDO";
      const etapa = e?.rows?.[0]?.split(":")?.[0] ?? e?.code;
      setSubmitError(msg);
      toast.error(msg);
      pushLog({ kind: "erro", etapa, mensagem: msg });
    },
  });

  const { equipInvalidIdx, ocInvalidIdx, maoInvalidIdx, valid: formValid } = validateRdoForm(form);

  function add(key: string, item: any) { setForm({ ...form, [key]: [...form[key], item] }); }
  function rm(key: string, idx: number) { setForm({ ...form, [key]: form[key].filter((_: any, i: number) => i !== idx) }); }
  function upd(key: string, idx: number, field: string, value: any) {
    setForm({ ...form, [key]: form[key].map((it: any, i: number) => i === idx ? { ...it, [field]: value } : it) });
  }

  function scrollToRow(key: "equipamentos" | "ocorrencias" | "mao_de_obra", idx: number, targetStep: number) {
    setStepIdx(targetStep);
    setFlashRow({ key, idx });
    setTimeout(() => setFlashRow(null), 2500);
    setTimeout(() => {
      const el = document.getElementById(`rdo-${key}-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el.querySelector("[data-row-focus]") as HTMLElement | null)?.focus?.();
      }
    }, 50);
  }

  function gotoStep(step: number) {
    setSubmitError(null);
    if (step === 3 && maoInvalidIdx[0] != null) return scrollToRow("mao_de_obra", maoInvalidIdx[0], 3);
    if (step === 4 && equipInvalidIdx[0] != null) return scrollToRow("equipamentos", equipInvalidIdx[0], 4);
    if (step === 5 && ocInvalidIdx[0] != null) return scrollToRow("ocorrencias", ocInvalidIdx[0], 5);
    setStepIdx(step);
    if (step === 6) {
      const idx = legendas.findIndex((l, i) => i < fotos.length && !(l ?? "").trim());
      const target = idx >= 0 ? idx : lowResIdxs[0];
      if (target != null) setTimeout(() => {
        document.getElementById(`rdo-foto-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }

  const fotosSemLegenda = fotos.reduce((n, _f, i) => n + ((legendas[i] ?? "").trim() ? 0 : 1), 0);

  // Issues por etapa (para listar erros na etapa 8 e permitir voltar).
  const stepIssues: { step: number; label: string; message: string }[] = [];
  if (!form.obra_id) stepIssues.push({ step: 0, label: "Obra", message: "Selecione a obra do RDO." });
  if ((form.atividades ?? []).length === 0)
    stepIssues.push({ step: 2, label: "Atividades", message: "Adicione ao menos uma atividade." });
  if (maoInvalidIdx.length > 0)
    stepIssues.push({ step: 3, label: "Mão de obra", message: `${maoInvalidIdx.length} linha(s) sem pessoa selecionada.` });
  if (equipInvalidIdx.length > 0)
    stepIssues.push({ step: 4, label: "Equipamentos", message: `${equipInvalidIdx.length} equipamento(s) sem seleção.` });
  if (ocInvalidIdx.length > 0)
    stepIssues.push({ step: 5, label: "Ocorrências", message: `${ocInvalidIdx.length} ocorrência(s) sem descrição.` });
  if (fotosSemLegenda > 0)
    stepIssues.push({ step: 6, label: "Fotos", message: `${fotosSemLegenda} foto(s) sem legenda.` });
  if (lowResIdxs.length > 0)
    stepIssues.push({ step: 6, label: "Fotos", message: `${lowResIdxs.length} foto(s) abaixo da resolução mínima (${MIN_IMAGE_DIM}px).` });
  if (stepIdx === 7 && !signer.nome.trim())
    stepIssues.push({ step: 7, label: "Assinatura", message: "Informe o nome do responsável." });
  if (stepIdx === 7 && !assinaturaBlob)
    stepIssues.push({ step: 7, label: "Assinatura", message: "Desenhe ou envie a assinatura." });

  const canNext =
    stepIdx === 0 ? !!form.obra_id
    : stepIdx === 6 ? fotosSemLegenda === 0 && lowResIdxs.length === 0
    : true;
  const isLast = stepIdx === steps.length - 1;
  const canSubmit = stepIssues.length === 0 && formValid && !!form.obra_id;

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto">
      <Link to="/rdo" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> RDOs
      </Link>
      <h1 className="font-serif text-2xl md:text-3xl mb-1">Novo RDO</h1>
      <p className="text-xs text-muted-foreground mb-4">Etapa {stepIdx + 1} de {steps.length} · {steps[stepIdx].label}</p>

      <div className="flex gap-1.5 mb-5">
        {steps.map((s, i) => (
          <div key={s.key} className={cn("h-1.5 flex-1 rounded-full", i <= stepIdx ? "bg-brand" : "bg-muted")} />
        ))}
      </div>

      {!formValid && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-destructive">
            {equipInvalidIdx.length + ocInvalidIdx.length + maoInvalidIdx.length} item(ns) inválido(s):
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {equipInvalidIdx.map((i: number) => (
              <li key={`e-${i}`}>
                <button type="button" className="underline text-destructive hover:opacity-80"
                  onClick={() => scrollToRow("equipamentos", i, 4)}>
                  Equipamento linha {i + 1} — selecione um equipamento
                </button>
              </li>
            ))}
            {ocInvalidIdx.map((i: number) => (
              <li key={`o-${i}`}>
                <button type="button" className="underline text-destructive hover:opacity-80"
                  onClick={() => scrollToRow("ocorrencias", i, 5)}>
                  Ocorrência linha {i + 1} — descrição obrigatória
                </button>
              </li>
            ))}
            {maoInvalidIdx.map((i: number) => (
              <li key={`m-${i}`}>
                <button type="button" className="underline text-destructive hover:opacity-80"
                  onClick={() => scrollToRow("mao_de_obra", i, 3)}>
                  Mão de obra linha {i + 1} — selecione uma pessoa
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">

        {stepIdx === 0 && (
          <Card className="p-5 space-y-4">
            <div>
              <Label>Obra</Label>
              <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <Label>Observações gerais</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
            </div>
          </Card>
        )}

        {stepIdx === 1 && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg">Clima do dia</h3>
                <span
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border",
                    climaStatus === "loading" && "bg-muted text-muted-foreground border-border animate-pulse",
                    climaStatus === "success" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                    climaStatus === "error" && "bg-muted text-muted-foreground border-border",
                    climaStatus === "idle" && "bg-muted/40 text-muted-foreground border-border",
                  )}
                >
                  {climaStatus === "loading" && "Carregando previsão…"}
                  {climaStatus === "success" && "Previsão atualizada"}
                  {climaStatus === "error" && "Falha — toque em Tentar novamente"}
                  {climaStatus === "idle" && "Sem previsão"}
                </span>
                {previsaoAt && (
                  <span className="text-[11px] text-muted-foreground tabular-nums" title={new Date(previsaoAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}>
                    Atualizado {tempoRelativo(previsaoAt)}
                  </span>
                )}
                {climaLoading && previsao5 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CircleNotch size={12} className="animate-spin" /> atualizando…
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Select value={String(refreshMin)} onValueChange={(v) => {
                  const n = Number(v) as 1 | 5 | 10;
                  setRefreshMin(n); localStorage.setItem("rdo:weather-refresh-min", String(n));
                }}>
                  <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Intervalo de atualização">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">A cada 1 min</SelectItem>
                    <SelectItem value="5">A cada 5 min</SelectItem>
                    <SelectItem value="10">A cada 10 min (padrão)</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" disabled={climaLoading || !form.obra_id} onClick={importarClimaPorObra}>
                  <CloudSun size={16} className="mr-1" /> Pelo endereço da obra
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={climaLoading || !form.obra_id} onClick={atualizarPrevisao}>
                  <CloudSun size={16} className="mr-1" /> {climaLoading ? "Atualizando…" : "Atualizar previsão"}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={climaLoading} onClick={importarClima}>
                  <CloudSun size={16} className="mr-1" /> {climaLoading ? "Consultando…" : "Minha localização"}
                </Button>
              </div>
            </div>

            {/* CEP manual + detecção automática */}
            <div className="border border-border rounded-md p-3 bg-muted/20 space-y-2">
              <Label className="text-xs">Consultar clima por CEP</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="00000-000"
                  maxLength={9}
                  value={cepInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setCepInput(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                  }}
                  className="sm:max-w-[160px]"
                />
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" size="sm" variant="outline" disabled={climaLoading || cepDetecting || !cepInput} onClick={importarClimaPorCep}>
                    {climaLoading
                      ? <CircleNotch size={16} className="mr-1 animate-spin" />
                      : <CloudSun size={16} className="mr-1" />}
                    {climaLoading ? "Consultando CEP…" : "Consultar pelo CEP"}
                  </Button>
                  <Button type="button" size="sm" variant="default" disabled={cepDetecting || climaLoading} onClick={detectarCep}>
                    {cepDetecting
                      ? <CircleNotch size={16} className="mr-1 animate-spin" />
                      : <MapPin size={16} className="mr-1" />}
                    {cepDetecting ? "Detectando…" : "Detectar CEP automaticamente"}
                  </Button>
                </div>
              </div>
              {(climaLoading || cepDetecting) && (
                <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleNotch size={14} className="animate-spin" />
                  {cepDetecting ? "Detectando CEP pela sua localização…" : "Consultando previsão pelo CEP…"}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Digite o CEP manualmente ou use a detecção automática (geolocalização + IA de reverse-geocoding).
              </p>
            </div>

            {climaStatus === "error" && (
              <div role="alert" className="text-xs border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-md p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Não conseguimos atualizar a previsão agora.</p>
                  <p className="opacity-80 mt-0.5">{climaErro ?? "Verifique o endereço da obra ou tente novamente em instantes."}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={atualizarPrevisao} disabled={climaLoading}>
                  {climaLoading ? <CircleNotch size={14} className="mr-1 animate-spin" /> : <CloudSun size={14} className="mr-1" />}
                  Tentar novamente
                </Button>
              </div>
            )}
            {climaStatus === "idle" && !climaInfo && (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3 bg-muted/20">
                Sem previsão carregada. Use "Pelo endereço da obra", informe o CEP ou ative sua localização.
              </div>
            )}
            {climaInfo && (
              <div className="text-xs text-muted-foreground border border-border rounded-md p-2 bg-muted/30">
                {climaInfo.descricao} · {climaInfo.temperatura_c}°C · vento {climaInfo.vento_kmh} km/h · chuva {climaInfo.precipitacao_mm} mm
                <span className="block">📍 {(climaInfo as any).local ?? previsaoLocal ?? `${climaInfo.latitude.toFixed(4)}, ${climaInfo.longitude.toFixed(4)}`}</span>
                <span className="block">🕒 {new Date(climaInfo.timestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)</span>
                {previsaoAt && (
                  <span className="block">💾 Cache salvo em {new Date(previsaoAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                )}
              </div>
            )}
            {previsao5 && previsao5.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Previsão da semana (7 dias) · atualiza a cada 10 min</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {previsao5.map((d) => (
                    <div key={d.data} className="border border-border rounded-md p-2 text-xs bg-muted/20">
                      <div className="font-medium">{d.dia_semana}</div>
                      <div className="text-muted-foreground">{new Date(`${d.data}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                      <div>{d.descricao}</div>
                      <div className="text-muted-foreground">{Math.round(d.t_min_c)}° / {Math.round(d.t_max_c)}°C</div>
                      <div className="text-muted-foreground">💧 {d.prob_chuva_pct}% · {d.precipitacao_mm} mm</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {(["manha", "tarde", "noite"] as const).map((p) => (
                <div key={p}>
                  <Label className="capitalize">Clima {p}</Label>
                  <Select value={form[`clima_${p}`] ?? ""} onValueChange={(v) => setForm({ ...form, [`clima_${p}`]: v || null })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {climas.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        )}

        {stepIdx === 2 && (
          <Section title="Atividades" onAdd={() => add("atividades", { descricao: "", pct_executado: 0 })}>
            {form.atividades.map((it: any, i: number) => (
              <Card key={i} className="p-3 space-y-2">
                <div><Label className="text-xs">Descrição</Label><Input value={it.descricao} onChange={(e) => upd("atividades", i, "descricao", e.target.value)} /></div>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Label className="text-xs">% executado</Label><Input type="number" min={0} max={100} value={it.pct_executado} onChange={(e) => upd("atividades", i, "pct_executado", Number(e.target.value))} /></div>
                  <RmBtn onClick={() => rm("atividades", i)} />
                </div>
              </Card>
            ))}
          </Section>
        )}

        {stepIdx === 3 && (
          <Section title="Mão de obra" onAdd={() => add("mao_de_obra", { mao_de_obra_id: "", horas: 8, atividade: "" })}>
            {form.mao_de_obra.map((it: any, i: number) => {
              const invalid = !isUuid(it.mao_de_obra_id);
              const errId = `rdo-mao_de_obra-${i}-err`;
              return (
              <Card key={i} id={`rdo-mao_de_obra-${i}`} className={cn("p-3 space-y-2", invalid && "border-destructive", flashRow?.key === "mao_de_obra" && flashRow.idx === i && "ring-4 ring-destructive animate-pulse")}>
                <div><Label className="text-xs">Pessoa</Label>
                  <Select value={it.mao_de_obra_id} onValueChange={(v) => upd("mao_de_obra", i, "mao_de_obra_id", v)}>
                    <SelectTrigger data-row-focus aria-invalid={invalid} aria-describedby={invalid ? errId : undefined}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(maoOpts as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome} — {m.funcao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {invalid && <p id={errId} aria-live="polite" className="text-xs text-destructive mt-1">Selecione uma pessoa.</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Atividade</Label><Input value={it.atividade ?? ""} onChange={(e) => upd("mao_de_obra", i, "atividade", e.target.value)} /></div>
                  <div><Label className="text-xs">Horas</Label><Input type="number" step={0.5} value={it.horas} onChange={(e) => upd("mao_de_obra", i, "horas", Number(e.target.value))} /></div>
                </div>
                <div className="flex justify-end"><RmBtn onClick={() => rm("mao_de_obra", i)} /></div>
              </Card>
              );
            })}
          </Section>
        )}

        {stepIdx === 4 && (
          <Section title="Equipamentos" onAdd={() => add("equipamentos", { equipamento_id: "", horas_uso: 0, status_uso: "" })}>
            {form.equipamentos.map((it: any, i: number) => {
              const invalid = !isUuid(it.equipamento_id);
              const errId = `rdo-equipamentos-${i}-err`;
              return (
              <Card key={i} id={`rdo-equipamentos-${i}`} className={cn("p-3 space-y-2", invalid && "border-destructive", flashRow?.key === "equipamentos" && flashRow.idx === i && "ring-4 ring-destructive animate-pulse")}>
                <div><Label className="text-xs">Equipamento</Label>
                  <Select value={it.equipamento_id} onValueChange={(v) => upd("equipamentos", i, "equipamento_id", v)}>
                    <SelectTrigger data-row-focus aria-invalid={invalid} aria-describedby={invalid ? errId : undefined}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(equipOpts as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {invalid && <p id={errId} aria-live="polite" className="text-xs text-destructive mt-1">Selecione um equipamento.</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Observação</Label><Input value={it.status_uso ?? ""} onChange={(e) => upd("equipamentos", i, "status_uso", e.target.value)} /></div>
                  <div><Label className="text-xs">Horas</Label><Input type="number" step={0.5} value={it.horas_uso} onChange={(e) => upd("equipamentos", i, "horas_uso", Number(e.target.value))} /></div>
                </div>
                <div className="flex justify-end"><RmBtn onClick={() => rm("equipamentos", i)} /></div>
              </Card>
              );
            })}
          </Section>
        )}

        {stepIdx === 5 && (
          <Section title="Ocorrências" onAdd={() => add("ocorrencias", { tipo_ocorrencia_id: null, descricao: "" })}>
            {form.ocorrencias.map((it: any, i: number) => {
              const invalid = !it.descricao?.trim();
              const errId = `rdo-ocorrencias-${i}-err`;
              return (
              <Card key={i} id={`rdo-ocorrencias-${i}`} className={cn("p-3 space-y-2", invalid && "border-destructive", flashRow?.key === "ocorrencias" && flashRow.idx === i && "ring-4 ring-destructive animate-pulse")}>
                <div><Label className="text-xs">Tipo</Label>
                  <Select value={it.tipo_ocorrencia_id ?? ""} onValueChange={(v) => upd("ocorrencias", i, "tipo_ocorrencia_id", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(tiposOpts as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input data-row-focus aria-invalid={invalid} aria-describedby={invalid ? errId : undefined}
                    value={it.descricao} onChange={(e) => upd("ocorrencias", i, "descricao", e.target.value)} />
                  {invalid && <p id={errId} aria-live="polite" className="text-xs text-destructive mt-1">Descrição é obrigatória.</p>}
                </div>
                <div className="flex justify-end"><RmBtn onClick={() => rm("ocorrencias", i)} /></div>
              </Card>
              );
            })}
          </Section>
        )}



        {stepIdx === 6 && (
          <>
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg">Fotos do canteiro</h3>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="default" onClick={() => setCameraOpen(true)}>
                    <Camera size={14} className="mr-1" /> Abrir câmera
                  </Button>
                  <label className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border cursor-pointer hover:bg-accent">
                    <Camera size={14} /> {compressing ? "Comprimindo…" : "Galeria"}
                    <input
                      type="file" accept="image/*" multiple className="sr-only"
                      onChange={(e) => { if (e.target.files) { onAddFotos(e.target.files); e.target.value = ""; } }}
                    />
                  </label>
                </div>
              </div>
              <CameraCapture
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onCapture={(files, caps) => {
                  setFotos((p) => [...p, ...files]);
                  setLegendas((p) => [...p, ...caps]);
                }}
              />
              {fotosSemLegenda > 0 && (
                <div role="alert" className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs">
                  {fotosSemLegenda} foto(s) sem legenda. Preencha todas para avançar.
                </div>
              )}
              {lowResIdxs.length > 0 && (
                <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-xs">
                  {lowResIdxs.length} foto(s) com baixa resolução (mínimo {MIN_IMAGE_DIM}px no menor lado). Tire novamente ou substitua antes de avançar.
                </div>
              )}
              <PhotoEditor
                open={editorIdx !== null}
                file={editorIdx !== null ? fotos[editorIdx] : null}
                onClose={() => setEditorIdx(null)}
                onSave={(f) => {
                  if (editorIdx === null) return;
                  setFotos((p) => p.map((x, j) => j === editorIdx ? f : x));
                }}
              />
              {fotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma foto adicionada. As imagens são enviadas na qualidade original da câmera, sem limite de quantidade.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fotos.length} foto(s) — use as setas para reordenar antes de enviar.</span>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Remover todas as fotos?")) { setFotos([]); setLegendas([]); } }}
                      className="text-destructive hover:underline"
                    >Limpar tudo</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {fotos.map((f, i) => {
                      const semLegenda = !(legendas[i] ?? "").trim();
                      const baixa = lowResIdxs.includes(i);
                      const realce = flashRow?.key === "foto" && flashRow.idx === i;
                      return (
                      <div key={i} id={`rdo-foto-${i}`} className={cn("space-y-1.5 rounded-md transition-shadow", (semLegenda || baixa) && "ring-1 ring-destructive/60", realce && "ring-4 ring-destructive animate-pulse")}>
                        <div className="relative aspect-square overflow-hidden rounded-md border border-border">
                          <img src={URL.createObjectURL(f)} className="object-cover w-full h-full" alt={f.name} />
                          <span className="absolute top-1 left-1 bg-background/80 text-[10px] font-medium rounded px-1.5 py-0.5">#{i + 1}</span>
                          <button
                            type="button"
                            aria-label="Remover foto"
                            onClick={() => { setFotos((p) => p.filter((_, j) => j !== i)); setLegendas((p) => p.filter((_, j) => j !== i)); }}
                            className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
                          >
                            <X size={12} />
                          </button>
                          <div className="absolute bottom-1 right-1 flex gap-1">
                            <button
                              type="button"
                              aria-label="Mover para cima"
                              disabled={i === 0}
                              onClick={() => {
                                if (i === 0) return;
                                setFotos((p) => { const a = [...p]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
                                setLegendas((p) => { const a = [...p]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
                              }}
                              className="bg-background/80 rounded-full p-1 disabled:opacity-40"
                            ><ArrowUp size={12} /></button>
                            <button
                              type="button"
                              aria-label="Mover para baixo"
                              disabled={i === fotos.length - 1}
                              onClick={() => {
                                if (i === fotos.length - 1) return;
                                setFotos((p) => { const a = [...p]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; });
                                setLegendas((p) => { const a = [...p]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; });
                              }}
                              className="bg-background/80 rounded-full p-1 disabled:opacity-40"
                            ><ArrowDown size={12} /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Input placeholder="Legenda" value={legendas[i] ?? ""} onChange={(e) => setLegendas((p) => p.map((v, j) => j === i ? e.target.value : v))} />
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditorIdx(i)}>Ajustar</Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center justify-between">
                          <span>{Math.round(f.size / 1024)} KB</span>
                          {lowResIdxs.includes(i) && <span className="text-destructive">⚠ baixa resolução</span>}
                        </p>
                      </div>
                      );
                    })}
                  </div>
                </>
              )}

              {uploadProgress.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium">Upload de anexos</p>
                  {uploadProgress.map((u, i) => {
                    const pct =
                      u.status === "pending" ? 0
                      : u.status === "enviando" ? 35
                      : u.status === "processando" ? 70
                      : u.status === "feito" || u.status === "fallback" ? 100
                      : 100;
                    const color =
                      u.status === "erro" ? "bg-destructive"
                      : u.status === "aguardando-rede" ? "bg-amber-400"
                      : u.status === "fallback" ? "bg-amber-500"
                      : u.status === "feito" ? "bg-emerald-500"
                      : "bg-brand";
                    return (
                      <div key={i} className="text-[11px]">
                        <div className="flex justify-between gap-2">
                          <span className="truncate flex-1">{u.name}</span>
                          <span className="text-muted-foreground">
                            {u.status}{u.attempt && u.attempt > 1 ? ` (tentativa ${u.attempt})` : ""}{u.provider ? ` · ${u.provider}` : ""}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
                        </div>
                        {u.error && <p className="text-destructive text-[10px] mt-0.5 truncate">{u.error}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {uploadHistory.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                    Histórico de tentativas ({uploadHistory.length})
                  </summary>
                  <ul className="mt-2 text-[11px] space-y-1 max-h-40 overflow-auto">
                    {uploadHistory.map((h, i) => (
                      <li key={i} className="flex justify-between gap-2 border-b border-border/50 pb-1">
                        <span className="text-muted-foreground">{new Date(h.at).toLocaleTimeString()}</span>
                        <span className="truncate flex-1">{h.name}</span>
                        <span className={cn(h.status === "erro" ? "text-destructive" : h.status === "fallback" ? "text-amber-600" : "text-emerald-600")}>
                          {h.status}{h.provider ? ` · ${h.provider}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          </>
        )}

        {stepIdx === 7 && (
          <>
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg">Assinatura digital</h3>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck size={14} /> SHA-256 + geolocalização
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nome</Label><Input value={signer.nome} onChange={(e) => setSigner({ ...signer, nome: e.target.value })} /></div>
                <div><Label className="text-xs">Cargo</Label><Input value={signer.cargo} onChange={(e) => setSigner({ ...signer, cargo: e.target.value })} placeholder="Engenheiro, Mestre…" /></div>
              </div>
              <SignaturePad onChange={setAssinaturaBlob} />
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border cursor-pointer hover:bg-accent">
                  <Camera size={14} /> Enviar imagem da assinatura
                  <input
                    type="file" accept="image/*" className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; e.target.value = "";
                      if (!f) return;
                      try {
                        const img = await compressImage(f, { maxDim: 1600, quality: 0.9, maxBytes: 1_500_000 });
                        setAssinaturaBlob(img);
                        toast.success("Assinatura carregada");
                      } catch (err: any) { toast.error(err?.message ?? "Falha ao carregar imagem"); }
                    }}
                  />
                </label>
                {assinaturaBlob && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check size={12} /> Assinatura pronta</span>}
              </div>
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <MapPin size={12} /> Ao enviar, capturamos data/hora, IP do dispositivo e localização (se permitido) e gravamos o hash do relatório como prova de integridade.
              </p>
            </Card>

            {(stepIssues.length > 0 || submitError) && (
              <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-2">
                <h4 className="font-medium text-destructive text-sm">Não é possível concluir o RDO</h4>
                {submitError && (
                  <div className="text-xs text-destructive border border-destructive/30 rounded p-2 bg-background">
                    <strong>Erro no envio:</strong> {submitError}
                  </div>
                )}
                {stepIssues.length > 0 && (
                  <ul className="space-y-1.5">
                    {stepIssues.map((iss, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span>
                          <strong>Etapa {iss.step + 1} · {iss.label}:</strong> {iss.message}
                        </span>
                        {iss.step !== 7 && (
                          <Button size="sm" variant="outline" onClick={() => gotoStep(iss.step)}>
                            Corrigir <ArrowRight size={12} className="ml-1" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {save.isPending && (
              <Card className="p-4 space-y-2">
                <p className="text-sm font-medium">Enviando RDO…</p>
                <div className="h-2 w-full bg-muted rounded overflow-hidden">
                  <div className="h-full bg-brand animate-pulse" style={{ width: "75%" }} />
                </div>
                <p className="text-xs text-muted-foreground">Não feche esta tela. Aguardando confirmação do servidor.</p>
              </Card>
            )}

            {submitLog.length > 0 && (
              <Card className="p-4 space-y-2">
                <h4 className="font-medium text-sm">Histórico de envio</h4>
                <ul className="space-y-1 max-h-56 overflow-auto text-xs font-mono">
                  {submitLog.map((l, i) => (
                    <li key={i} className={cn(
                      "flex gap-2 items-start border-l-2 pl-2",
                      l.kind === "ok" && "border-emerald-500 text-emerald-700",
                      l.kind === "erro" && "border-destructive text-destructive",
                      l.kind === "offline" && "border-amber-500 text-amber-700",
                      l.kind === "start" && "border-muted-foreground/40 text-muted-foreground",
                    )}>
                      <span className="shrink-0">{new Date(l.at).toLocaleTimeString("pt-BR")}</span>
                      <span className="uppercase text-[10px] shrink-0">{l.kind}</span>
                      {l.etapa && <span className="shrink-0">[{l.etapa}]</span>}
                      <span className="break-all">{l.mensagem}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>

      <div className="sticky bottom-16 md:bottom-0 mt-6 -mx-4 md:mx-0 bg-background/95 backdrop-blur border-t border-border md:border-0 px-4 py-3 flex justify-between gap-2">
        <Button variant="ghost" disabled={stepIdx === 0} onClick={() => setStepIdx((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
        {!isLast ? (
          <Button disabled={!canNext} onClick={() => setStepIdx((s) => Math.min(steps.length - 1, s + 1))} className="bg-brand text-brand-foreground">
            Próximo <ArrowRight size={16} className="ml-1" />
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            {stepIssues.length > 0 && (
              <p className="text-xs text-destructive" role="alert">
                {stepIssues.length} pendência(s) — veja a lista acima.
              </p>
            )}
            <div className="flex gap-2">
              <ButtonEffectRenderer buttonKey="rdo_salvar_rascunho">
                <Button variant="outline" disabled={!form.obra_id || save.isPending} onClick={() => { setSubmitError(null); save.mutate(false); }}>Rascunho</Button>
              </ButtonEffectRenderer>
              <ButtonEffectRenderer buttonKey="rdo_enviar_aprovacao">
                <Button
                  className="bg-brand text-brand-foreground"
                  disabled={!canSubmit || save.isPending}
                  onClick={() => { setSubmitError(null); save.mutate(true); }}
                >
                  <Check size={16} className="mr-1" /> {save.isPending ? "Enviando…" : "Concluir RDO"}
                </Button>
              </ButtonEffectRenderer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus size={12} className="mr-1" />Adicionar</Button>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function RmBtn({ onClick }: { onClick: () => void }) {
  return <Button size="sm" variant="ghost" className="text-destructive" onClick={onClick}><X size={16} className="mr-1" /> Remover</Button>;
}

function SignaturePad({ onChange }: { onChange: (b: Blob | null) => void }) {
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
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    dirty.current = true;
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
        <Button size="sm" variant="ghost" onClick={clear}><Eraser size={14} className="mr-1" /> Limpar</Button>
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/30">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none block"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        />
      </div>
    </div>
  );
}
