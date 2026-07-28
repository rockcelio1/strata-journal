import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Upload, DatabaseBackup, Loader2, AlertTriangle,
  ShieldCheck, CalendarClock, History, Eye, Trash2, Plus, Lock, HardDrive,
} from "lucide-react";
import { notify } from "@/lib/toast";
import {
  listBackupGroups, exportBackup, importBackup,
  BACKUP_BUCKETS, listBucketsManifest, signBucketPaths,
  dryRunRestore, logBackupHistory, listBackupHistory,
  listBackupSchedules, upsertBackupSchedule, deleteBackupSchedule,
} from "@/lib/backup.functions";
import { encryptBlob, decryptBuffer, isEncryptedBuffer } from "@/lib/backup-crypto";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/configuracoes/backup")({
  component: BackupPage,
});

function BackupPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl flex items-center gap-2">
          <DatabaseBackup className="h-5 w-5 text-brand" /> Backup do sistema
        </h2>
        <p className="text-sm text-muted-foreground">
          Exporte, restaure, agende e audite os dados da sua empresa. Somente administrador ou master.
        </p>
      </div>

      <Tabs defaultValue="exportar" className="w-full">
        <TabsList className="grid grid-cols-4 max-w-2xl">
          <TabsTrigger value="exportar"><Download className="h-4 w-4 mr-1" />Gerar</TabsTrigger>
          <TabsTrigger value="restaurar"><Upload className="h-4 w-4 mr-1" />Restaurar</TabsTrigger>
          <TabsTrigger value="agendar"><CalendarClock className="h-4 w-4 mr-1" />Agendar</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="exportar" className="mt-4"><ExportSection /></TabsContent>
        <TabsContent value="restaurar" className="mt-4"><RestoreSection /></TabsContent>
        <TabsContent value="agendar" className="mt-4"><ScheduleSection /></TabsContent>
        <TabsContent value="historico" className="mt-4"><HistorySection /></TabsContent>
      </Tabs>
    </section>
  );
}

// =============================================================
// EXPORTAR
// =============================================================
function ExportSection() {
  const listFn = useServerFn(listBackupGroups);
  const exportFn = useServerFn(exportBackup);
  const manifestFn = useServerFn(listBucketsManifest);
  const signFn = useServerFn(signBucketPaths);
  const logFn = useServerFn(logBackupHistory);
  const { data: groups = [] } = useQuery({ queryKey: ["backup-groups"], queryFn: () => listFn() });

  const [groupSel, setGroupSel] = useState<Record<string, boolean>>({});
  const [bucketSel, setBucketSel] = useState<Record<string, boolean>>({});
  const [includeAuthUsers, setIncludeAuthUsers] = useState(true);
  const [encrypt, setEncrypt] = useState(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedGroups = Object.keys(groupSel).filter((k) => groupSel[k]);
  const selectedBuckets = Object.keys(bucketSel).filter((k) => bucketSel[k]);

  async function handleGenerate() {
    if (!selectedGroups.length) { notify.error("Selecione ao menos um grupo."); return; }
    if (encrypt) {
      if (password.length < 8) { notify.error("Senha deve ter no mínimo 8 caracteres."); return; }
      if (password !== password2) { notify.error("As senhas não conferem."); return; }
    }
    setBusy(true);
    const started = Date.now();
    try {
      setProgress("Exportando dados das tabelas...");
      const result: any = await exportFn({ data: { groups: selectedGroups, includeAuthUsers } });

      const zip = new JSZip();
      zip.file("backup.json", JSON.stringify(result, null, 2));

      const bucketReport: Record<string, { files: number; bytes: number }> = {};
      for (const bucket of selectedBuckets) {
        setProgress(`Listando bucket "${bucket}"...`);
        const manifest: any = await manifestFn({ data: { buckets: [bucket] } });
        const files: { path: string; size: number }[] = manifest?.[bucket]?.files ?? [];
        const bZip = new JSZip();
        let bytes = 0;
        for (let i = 0; i < files.length; i += 100) {
          const chunk = files.slice(i, i + 100);
          setProgress(`Baixando ${bucket} (${i}/${files.length})...`);
          const signed: any = await signFn({ data: { bucket, paths: chunk.map((f) => f.path), expiresIn: 600 } });
          await Promise.all(
            signed.map(async (s: any) => {
              if (!s.url) return;
              const r = await fetch(s.url);
              if (!r.ok) return;
              const buf = await r.arrayBuffer();
              bytes += buf.byteLength;
              bZip.file(s.path, buf);
            }),
          );
        }
        setProgress(`Compactando ${bucket}...`);
        const bBlob = await bZip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
        zip.file(`buckets/${bucket}.zip`, bBlob);
        bucketReport[bucket] = { files: files.length, bytes };
      }

      setProgress("Empacotando arquivo final...");
      const masterBlob = await zip.generateAsync({ type: "blob" });
      let outBlob = masterBlob;
      let ext = "zip";
      if (encrypt) {
        setProgress("Criptografando...");
        outBlob = await encryptBlob(await masterBlob.arrayBuffer(), password);
        ext = "fcb";
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const fname = `backup-${ts}.${ext}`;
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);

      await logFn({
        data: {
          operacao: "backup",
          origem: "manual",
          grupos: selectedGroups,
          buckets: selectedBuckets,
          criptografado: encrypt,
          contagens: { tables: result?.meta?.totals, buckets: bucketReport },
          resultado: "sucesso",
          mensagem: `Backup baixado: ${fname}`,
          arquivo_tamanho_bytes: outBlob.size,
          duracao_ms: Date.now() - started,
        },
      });
      notify.success("Backup gerado com sucesso.");
    } catch (e: any) {
      notify.error(e.message ?? "Falha ao gerar backup.");
      await logFn({
        data: {
          operacao: "backup", origem: "manual",
          grupos: selectedGroups, buckets: selectedBuckets, criptografado: encrypt,
          contagens: {}, resultado: "erro", mensagem: e.message ?? String(e),
          duracao_ms: Date.now() - started,
        },
      }).catch(() => {});
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Gerar backup</h3>
          <p className="text-xs text-muted-foreground">Escolha o conteúdo, criptografe com senha e baixe.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setGroupSel(Object.fromEntries((groups as any[]).map((g) => [g.key, true])))}>Marcar tudo</Button>
          <Button size="sm" variant="ghost" onClick={() => setGroupSel({})}>Limpar</Button>
        </div>
      </div>

      <div>
        <Label className="text-sm mb-2 block">Dados (tabelas)</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          {(groups as any[]).map((g) => (
            <label key={g.key} className="flex items-start gap-2 border border-border rounded-md p-3 hover:bg-accent cursor-pointer">
              <Checkbox checked={!!groupSel[g.key]} onCheckedChange={() => setGroupSel((p) => ({ ...p, [g.key]: !p[g.key] }))} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{g.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{g.tables.join(", ")}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm mb-2 block flex items-center gap-1"><HardDrive className="h-4 w-4" /> Arquivos (buckets do Storage)</Label>
        <div className="grid sm:grid-cols-3 gap-2">
          {BACKUP_BUCKETS.map((b) => (
            <label key={b.key} className="flex items-start gap-2 border border-border rounded-md p-3 hover:bg-accent cursor-pointer">
              <Checkbox checked={!!bucketSel[b.key]} onCheckedChange={() => setBucketSel((p) => ({ ...p, [b.key]: !p[b.key] }))} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{b.label}</div>
                <div className="text-[11px] text-muted-foreground">{b.key} · .zip separado</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeAuthUsers} onCheckedChange={(v) => setIncludeAuthUsers(!!v)} />
        Incluir dados de autenticação dos usuários (sem senhas)
      </label>

      <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Switch checked={encrypt} onCheckedChange={setEncrypt} id="enc" />
          <Label htmlFor="enc" className="flex items-center gap-1 text-sm cursor-pointer">
            <Lock className="h-4 w-4" /> Criptografar com senha (AES-256-GCM)
          </Label>
        </div>
        {encrypt && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Senha (mín. 8 caracteres)</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <Label className="text-xs">Confirmar senha</Label>
                <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              Se você perder esta senha o arquivo será irrecuperável — guarde em local seguro.
            </p>
          </>
        )}
      </div>

      {progress && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />{progress}</div>}

      <Button onClick={handleGenerate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        Gerar e baixar backup
      </Button>
    </div>
  );
}

// =============================================================
// RESTAURAR (com dry-run)
// =============================================================
function RestoreSection() {
  const listFn = useServerFn(listBackupGroups);
  const importFn = useServerFn(importBackup);
  const dryFn = useServerFn(dryRunRestore);
  const logFn = useServerFn(logBackupHistory);
  const { data: groups = [] } = useQuery({ queryKey: ["backup-groups"], queryFn: () => listFn() });

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [payload, setPayload] = useState<any | null>(null);
  const [wasEncrypted, setWasEncrypted] = useState(false);
  const [buckets, setBuckets] = useState<Record<string, boolean>>({});
  const [groupSel, setGroupSel] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [restoreAuthUsers, setRestoreAuthUsers] = useState(false);
  const [dryReport, setDryReport] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadFile() {
    if (!file) { notify.error("Selecione um arquivo."); return; }
    setBusy(true); setPayload(null); setDryReport(null); setReport(null);
    try {
      const buf = await file.arrayBuffer();
      let jsonText: string;
      let encrypted = false;
      if (isEncryptedBuffer(buf)) {
        encrypted = true;
        if (!password) { notify.error("Este arquivo é criptografado — informe a senha."); setBusy(false); return; }
        const dec = await decryptBuffer(buf, password);
        // Depois de descriptografar temos um .zip → precisamos ler backup.json
        const zip = await JSZip.loadAsync(dec);
        const entry = zip.file("backup.json");
        if (!entry) throw new Error("Arquivo criptografado não contém backup.json");
        jsonText = await entry.async("text");
      } else if (file.name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(buf);
        const entry = zip.file("backup.json");
        if (!entry) throw new Error("O .zip não contém backup.json");
        jsonText = await entry.async("text");
      } else {
        jsonText = new TextDecoder().decode(buf);
      }
      const json = JSON.parse(jsonText);
      if (!json?.meta || !json?.tables) throw new Error("Formato inválido: falta meta/tables.");
      setPayload(json);
      setWasEncrypted(encrypted);
      const g = json?.meta?.groups ?? [];
      setGroupSel(Object.fromEntries((groups as any[]).map((x) => [x.key, g.includes(x.key)])));
      setBuckets({});
      notify.success("Arquivo carregado.");
    } catch (e: any) {
      notify.error(e.message ?? "Falha ao ler o arquivo.");
    } finally { setBusy(false); }
  }

  async function runDry() {
    if (!payload) return;
    setBusy(true); setDryReport(null);
    try {
      const selGroups = Object.keys(groupSel).filter((k) => groupSel[k]);
      const selBuckets = Object.keys(buckets).filter((k) => buckets[k]);
      const r: any = await dryFn({ data: { payload, groups: selGroups, buckets: selBuckets, mode } });
      setDryReport(r);
      await logFn({
        data: {
          operacao: "dry_run", grupos: selGroups, buckets: selBuckets, modo_restore: mode,
          criptografado: wasEncrypted, contagens: r.table_summary, validacoes: { findings: r.findings, buckets: r.bucket_summary },
          resultado: r.ok ? "sucesso" : "parcial",
          mensagem: `${r.counts.errors} erro(s), ${r.counts.warnings} aviso(s).`,
        },
      });
    } catch (e: any) { notify.error(e.message ?? "Falha na pré-visualização."); }
    finally { setBusy(false); }
  }

  async function runRestore() {
    if (!payload) return;
    setBusy(true); setReport(null);
    const started = Date.now();
    const selGroups = Object.keys(groupSel).filter((k) => groupSel[k]);
    const selBuckets = Object.keys(buckets).filter((k) => buckets[k]);
    try {
      const r: any = await importFn({ data: { payload, groups: selGroups, mode, restoreAuthUsers } });
      setReport(r);
      await logFn({
        data: {
          operacao: "restore", grupos: selGroups, buckets: selBuckets, modo_restore: mode,
          criptografado: wasEncrypted, contagens: r.report,
          resultado: "sucesso", mensagem: "Restauração aplicada.",
          duracao_ms: Date.now() - started,
        },
      });
      notify.success("Restauração concluída.");
    } catch (e: any) {
      notify.error(e.message ?? "Falha na restauração.");
      await logFn({
        data: {
          operacao: "restore", grupos: selGroups, buckets: selBuckets, modo_restore: mode,
          criptografado: wasEncrypted, contagens: {},
          resultado: "erro", mensagem: e.message ?? String(e),
          duracao_ms: Date.now() - started,
        },
      }).catch(() => {});
    } finally { setBusy(false); }
  }

  return (
    <div className="border border-border rounded-lg bg-card p-5 space-y-5">
      <div>
        <h3 className="font-medium">Restaurar backup</h3>
        <p className="text-xs text-muted-foreground">Envie o arquivo (.json, .zip ou .fcb). Pré-visualize antes de aplicar.</p>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <input ref={fileRef} type="file" accept=".json,.zip,.fcb" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />Selecionar arquivo
            </Button>
            <span className="text-xs text-muted-foreground truncate">{file?.name ?? "Nenhum selecionado"}</span>
          </div>
        </div>
        <div className="min-w-[220px]">
          <Label className="text-xs flex items-center gap-1"><Lock className="h-3 w-3" />Senha (se criptografado)</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="opcional" />
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={loadFile} disabled={!file || busy}>Carregar e validar</Button>

      {payload && (
        <>
          <div className="text-xs text-muted-foreground">
            Backup de <b>{payload?.meta?.generated_at?.slice(0, 19).replace("T", " ")}</b>
            {wasEncrypted && <span className="ml-2 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />criptografado</span>}
          </div>

          <div>
            <Label className="text-sm mb-2 block">O que restaurar</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {(groups as any[]).map((g) => {
                const disp = (payload?.meta?.groups ?? []).includes(g.key);
                return (
                  <label key={g.key} className={`flex items-start gap-2 border border-border rounded-md p-3 ${disp ? "hover:bg-accent cursor-pointer" : "opacity-50"}`}>
                    <Checkbox checked={!!groupSel[g.key]} disabled={!disp} onCheckedChange={() => setGroupSel((p) => ({ ...p, [g.key]: !p[g.key] }))} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{disp ? g.tables.join(", ") : "Não incluído neste arquivo"}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Buckets a validar</Label>
            <div className="grid sm:grid-cols-3 gap-2">
              {BACKUP_BUCKETS.map((b) => (
                <label key={b.key} className="flex items-center gap-2 border border-border rounded-md p-2 cursor-pointer">
                  <Checkbox checked={!!buckets[b.key]} onCheckedChange={() => setBuckets((p) => ({ ...p, [b.key]: !p[b.key] }))} />
                  <div className="text-sm">{b.label}</div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Modo</Label>
            <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="grid sm:grid-cols-2 gap-2">
              <label className="flex items-start gap-2 border border-border rounded-md p-3 cursor-pointer">
                <RadioGroupItem value="merge" />
                <div><div className="text-sm font-medium">Mesclar</div><div className="text-[11px] text-muted-foreground">Upsert por ID.</div></div>
              </label>
              <label className="flex items-start gap-2 border border-destructive/40 rounded-md p-3 cursor-pointer">
                <RadioGroupItem value="replace" />
                <div><div className="text-sm font-medium text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Substituir tudo</div><div className="text-[11px] text-muted-foreground">Apaga antes de inserir.</div></div>
              </label>
            </RadioGroup>
          </div>

          {payload?.auth_users?.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={restoreAuthUsers} onCheckedChange={(v) => setRestoreAuthUsers(!!v)} />
              Recriar usuários ausentes (senha temporária)
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={runDry} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}Pré-visualizar (dry-run)
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant={mode === "replace" ? "destructive" : "default"} disabled={busy || (dryReport && !dryReport.ok)}>
                  <Upload className="h-4 w-4 mr-2" />Aplicar restauração
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar restauração?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {mode === "replace"
                      ? "Isto irá APAGAR os dados atuais das tabelas selecionadas e substituí-los. Não é possível desfazer."
                      : "Registros ausentes serão criados e existentes atualizados por ID."}
                    {!dryReport && " Recomendado executar a pré-visualização antes."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={runRestore}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}

      {dryReport && (
        <div className="border border-border rounded-md p-3 bg-muted/30 text-xs space-y-2">
          <div className="font-medium">Pré-visualização — {dryReport.ok ? <span className="text-emerald-600">OK</span> : <span className="text-destructive">bloqueada</span>}</div>
          <div>{dryReport.counts.errors} erro(s), {dryReport.counts.warnings} aviso(s), {dryReport.counts.groups} grupo(s).</div>
          {dryReport.findings.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {dryReport.findings.map((f: any, i: number) => (
                <li key={i} className={f.severity === "error" ? "text-destructive" : f.severity === "warn" ? "text-amber-600" : ""}>
                  <b>[{f.severity}]</b> {f.table || f.bucket || f.group ? `${f.table || f.bucket || f.group}: ` : ""}{f.message}
                </li>
              ))}
            </ul>
          )}
          <div className="grid sm:grid-cols-2 gap-1">
            {Object.entries(dryReport.table_summary ?? {}).map(([t, s]: any) => (
              <div key={t}><b>{t}</b>: arquivo {s.in_file} · empresa {s.belongs_to_empresa} · atual {s.existing} → +{s.will_insert} ~{s.will_update} −{s.will_delete}</div>
            ))}
          </div>
          {Object.keys(dryReport.bucket_summary ?? {}).length > 0 && (
            <div>
              <div className="font-medium mt-1">Buckets</div>
              {Object.entries(dryReport.bucket_summary).map(([b, s]: any) => (
                <div key={b}><b>{b}</b>: arquivo {s.in_file} · atual {s.existing}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="border border-border rounded-md p-3 bg-muted/30 text-xs">
          <div className="font-medium mb-2">Resultado</div>
          {report.createdUsers?.length > 0 && <div className="mb-2">Usuários recriados: {report.createdUsers.join(", ")}</div>}
          <div className="grid sm:grid-cols-2 gap-1">
            {Object.entries(report.report ?? {}).map(([t, r]: any) => (
              <div key={t} className={r.error ? "text-destructive" : ""}><b>{t}</b>: +{r.inserted}{r.deleted ? ` · −${r.deleted}` : ""}{r.error ? ` · ${r.error}` : ""}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// AGENDAMENTOS
// =============================================================
function ScheduleSection() {
  const listSchedFn = useServerFn(listBackupSchedules);
  const listGroupsFn = useServerFn(listBackupGroups);
  const upsertFn = useServerFn(upsertBackupSchedule);
  const delFn = useServerFn(deleteBackupSchedule);
  const { data: groups = [] } = useQuery({ queryKey: ["backup-groups"], queryFn: () => listGroupsFn() });
  const { data: schedules = [], refetch } = useQuery({ queryKey: ["backup-schedules"], queryFn: () => listSchedFn() });

  const [editing, setEditing] = useState<any | null>(null);

  function newSchedule() {
    setEditing({
      nome: "Backup diário", frequencia: "diario", hora_utc: 3,
      dia_semana: 0, dia_mes: 1, grupos: [], buckets: [], retencao_dias: 30, ativo: true,
    });
  }
  async function save() {
    if (!editing?.nome || !editing?.grupos?.length) { notify.error("Nome e ao menos um grupo são obrigatórios."); return; }
    try {
      await upsertFn({ data: editing });
      notify.success("Agendamento salvo.");
      setEditing(null); refetch();
    } catch (e: any) { notify.error(e.message ?? "Falha ao salvar."); }
  }
  async function remove(id: string) {
    try { await delFn({ data: { id } }); refetch(); notify.success("Removido."); }
    catch (e: any) { notify.error(e.message ?? "Falha."); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Backups automáticos são executados por um agendador no horário UTC.</p>
        <Button size="sm" onClick={newSchedule}><Plus className="h-4 w-4 mr-1" />Novo agendamento</Button>
      </div>

      {(schedules as any[]).length === 0 && !editing && (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          Nenhum agendamento. Crie um para automatizar seus backups.
        </div>
      )}

      <div className="space-y-2">
        {(schedules as any[]).map((s: any) => (
          <div key={s.id} className="border border-border rounded-md p-3 flex flex-wrap gap-3 items-center bg-card">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium text-sm">{s.nome} {!s.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}</div>
              <div className="text-xs text-muted-foreground">
                {s.frequencia} · {String(s.hora_utc).padStart(2, "0")}:00 UTC · retenção {s.retencao_dias} dias
              </div>
              <div className="text-[11px] text-muted-foreground">
                Grupos: {s.grupos.join(", ") || "—"}{s.buckets.length ? ` · Buckets: ${s.buckets.join(", ")}` : ""}
              </div>
              {s.proxima_execucao && <div className="text-[11px] text-muted-foreground">Próxima: {new Date(s.proxima_execucao).toLocaleString()}</div>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Editar</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="border border-border rounded-lg bg-card p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Frequência</Label>
              <Select value={editing.frequencia} onValueChange={(v) => setEditing({ ...editing, frequencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Hora (UTC 0-23)</Label>
              <Input type="number" min={0} max={23} value={editing.hora_utc}
                onChange={(e) => setEditing({ ...editing, hora_utc: Math.max(0, Math.min(23, parseInt(e.target.value || "0"))) })} />
            </div>
            {editing.frequencia === "semanal" && (
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <Select value={String(editing.dia_semana ?? 0)} onValueChange={(v) => setEditing({ ...editing, dia_semana: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editing.frequencia === "mensal" && (
              <div>
                <Label className="text-xs">Dia do mês (1-28)</Label>
                <Input type="number" min={1} max={28} value={editing.dia_mes ?? 1}
                  onChange={(e) => setEditing({ ...editing, dia_mes: Math.max(1, Math.min(28, parseInt(e.target.value || "1"))) })} />
              </div>
            )}
            <div>
              <Label className="text-xs">Retenção (dias)</Label>
              <Input type="number" min={1} max={365} value={editing.retencao_dias}
                onChange={(e) => setEditing({ ...editing, retencao_dias: Math.max(1, Math.min(365, parseInt(e.target.value || "30"))) })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
              <Label className="text-sm">Ativo</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Grupos</Label>
            <div className="grid sm:grid-cols-2 gap-1">
              {(groups as any[]).map((g: any) => (
                <label key={g.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.grupos.includes(g.key)}
                    onCheckedChange={(v) => setEditing({ ...editing, grupos: v ? [...editing.grupos, g.key] : editing.grupos.filter((k: string) => k !== g.key) })} />
                  {g.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Buckets (manifest apenas — arquivos não são anexados em backups automáticos)</Label>
            <div className="grid sm:grid-cols-3 gap-1">
              {BACKUP_BUCKETS.map((b) => (
                <label key={b.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.buckets.includes(b.key)}
                    onCheckedChange={(v) => setEditing({ ...editing, buckets: v ? [...editing.buckets, b.key] : editing.buckets.filter((k: string) => k !== b.key) })} />
                  {b.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// HISTÓRICO
// =============================================================
function HistorySection() {
  const listFn = useServerFn(listBackupHistory);
  const { data: history = [], isLoading } = useQuery({ queryKey: ["backup-history"], queryFn: () => listFn() });
  const [detail, setDetail] = useState<any | null>(null);

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-sm text-muted-foreground">Últimas 200 operações.</div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>
      ) : (history as any[]).length === 0 ? (
        <div className="text-center text-sm text-muted-foreground p-6">Nenhuma operação registrada ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Data</th><th className="p-2">Operação</th><th className="p-2">Autor</th>
                <th className="p-2">Origem</th><th className="p-2">Grupos</th><th className="p-2">Resultado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(history as any[]).map((h: any) => (
                <tr key={h.id} className="border-b hover:bg-accent/30">
                  <td className="p-2">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="p-2 capitalize">
                    {h.operacao === "dry_run" ? "pré-visualização" : h.operacao}
                    {h.criptografado && <Lock className="inline h-3 w-3 ml-1 text-emerald-600" />}
                  </td>
                  <td className="p-2">{h.autor_email ?? "—"}</td>
                  <td className="p-2">{h.origem}</td>
                  <td className="p-2 max-w-[240px] truncate">{(h.grupos_selecionados ?? []).join(", ")}</td>
                  <td className="p-2">
                    <span className={
                      h.resultado === "sucesso" ? "text-emerald-600" :
                      h.resultado === "erro" ? "text-destructive" :
                      h.resultado === "parcial" ? "text-amber-600" : ""
                    }>{h.resultado}</span>
                  </td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => setDetail(h)}><Eye className="h-3 w-3" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Detalhes da operação</AlertDialogTitle>
            <AlertDialogDescription>
              {detail && (
                <div className="text-xs space-y-2 text-left">
                  <div><b>Data:</b> {new Date(detail.created_at).toLocaleString()}</div>
                  <div><b>Operação:</b> {detail.operacao} · <b>Origem:</b> {detail.origem}</div>
                  <div><b>Autor:</b> {detail.autor_email ?? "—"}</div>
                  <div><b>Grupos:</b> {(detail.grupos_selecionados ?? []).join(", ") || "—"}</div>
                  <div><b>Buckets:</b> {(detail.buckets_selecionados ?? []).join(", ") || "—"}</div>
                  <div><b>Modo:</b> {detail.modo_restore ?? "—"} · <b>Criptografado:</b> {detail.criptografado ? "sim" : "não"}</div>
                  <div><b>Resultado:</b> {detail.resultado} · <b>Duração:</b> {detail.duracao_ms ? `${detail.duracao_ms} ms` : "—"}</div>
                  {detail.mensagem && <div><b>Mensagem:</b> {detail.mensagem}</div>}
                  {detail.arquivo_path && <div><b>Arquivo:</b> {detail.arquivo_path} ({detail.arquivo_tamanho_bytes} bytes)</div>}
                  <details><summary className="cursor-pointer">Contagens</summary>
                    <pre className="bg-muted p-2 rounded overflow-auto max-h-64">{JSON.stringify(detail.contagens, null, 2)}</pre>
                  </details>
                  {detail.validacoes && (
                    <details><summary className="cursor-pointer">Validações</summary>
                      <pre className="bg-muted p-2 rounded overflow-auto max-h-64">{JSON.stringify(detail.validacoes, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Fechar</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
