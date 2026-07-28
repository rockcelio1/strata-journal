import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Upload, DatabaseBackup, Loader2, AlertTriangle } from "lucide-react";
import { notify } from "@/lib/toast";
import { listBackupGroups, exportBackup, importBackup } from "@/lib/backup.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/configuracoes/backup")({
  component: BackupPage,
});

function BackupPage() {
  const listFn = useServerFn(listBackupGroups);
  const exportFn = useServerFn(exportBackup);
  const importFn = useServerFn(importBackup);

  const { data: groups = [] } = useQuery({ queryKey: ["backup-groups"], queryFn: () => listFn() });

  const [exportSel, setExportSel] = useState<Record<string, boolean>>({});
  const [includeAuthUsers, setIncludeAuthUsers] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [importSel, setImportSel] = useState<Record<string, boolean>>({});
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [restoreAuthUsers, setRestoreAuthUsers] = useState(false);
  const [payload, setPayload] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(setter: any, key: string) {
    setter((prev: any) => ({ ...prev, [key]: !prev[key] }));
  }
  function selectAll(setter: any, value: boolean) {
    setter(Object.fromEntries((groups as any[]).map((g) => [g.key, value])));
  }

  async function handleExport() {
    const selected = Object.keys(exportSel).filter((k) => exportSel[k]);
    if (selected.length === 0) { notify.error("Selecione ao menos um grupo para backup."); return; }
    setExporting(true);
    try {
      const result: any = await exportFn({ data: { groups: selected, includeAuthUsers } });
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const errs = Object.keys(result?.meta?.errors ?? {});
      if (errs.length) notify.error(`Backup gerado com avisos em: ${errs.join(", ")}`);
      else notify.success("Backup gerado com sucesso.");
    } catch (e: any) {
      notify.error(e.message ?? "Falha ao gerar backup.");
    } finally {
      setExporting(false);
    }
  }

  async function handleFile(f: File) {
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      if (!json?.tables || !json?.meta) throw new Error("Arquivo de backup inválido.");
      setPayload(json);
      const groupsFromFile = json?.meta?.groups ?? [];
      setImportSel(Object.fromEntries((groups as any[]).map((g) => [g.key, groupsFromFile.includes(g.key)])));
      notify.success("Arquivo de backup carregado.");
    } catch (e: any) {
      notify.error(e.message ?? "Arquivo inválido.");
      setPayload(null);
    }
  }

  async function handleImport() {
    if (!payload) { notify.error("Selecione um arquivo de backup primeiro."); return; }
    const selected = Object.keys(importSel).filter((k) => importSel[k]);
    if (selected.length === 0) { notify.error("Selecione ao menos um grupo para restaurar."); return; }
    setImporting(true);
    setReport(null);
    try {
      const r: any = await importFn({ data: { payload, groups: selected, mode: importMode, restoreAuthUsers } });
      setReport(r);
      notify.success("Restauração concluída.");
    } catch (e: any) {
      notify.error(e.message ?? "Falha na restauração.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl flex items-center gap-2">
          <DatabaseBackup className="h-5 w-5 text-brand" /> Backup do sistema
        </h2>
        <p className="text-sm text-muted-foreground">
          Exporte e restaure os dados da sua empresa (obras, RDOs, cadastros, usuários e configurações).
          Somente administrador ou master pode executar estas operações.
        </p>
      </div>

      {/* EXPORTAR */}
      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Gerar backup</h3>
            <p className="text-xs text-muted-foreground">Selecione o que deseja incluir e baixe o arquivo <code>.json</code>.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => selectAll(setExportSel, true)}>Marcar tudo</Button>
            <Button size="sm" variant="ghost" onClick={() => selectAll(setExportSel, false)}>Limpar</Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {(groups as any[]).map((g) => (
            <label key={g.key} className="flex items-start gap-2 border border-border rounded-md p-3 hover:bg-accent cursor-pointer">
              <Checkbox checked={!!exportSel[g.key]} onCheckedChange={() => toggle(setExportSel, g.key)} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{g.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{g.tables.join(", ")}</div>
              </div>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeAuthUsers} onCheckedChange={(v) => setIncludeAuthUsers(!!v)} />
          Incluir dados de autenticação dos usuários (e-mail, metadados — sem senhas)
        </label>

        <div>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Gerar e baixar backup
          </Button>
        </div>
      </div>

      {/* RESTAURAR */}
      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        <div>
          <h3 className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Restaurar backup</h3>
          <p className="text-xs text-muted-foreground">
            Envie um arquivo <code>.json</code> gerado anteriormente e escolha o que deseja restaurar.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
          </Button>
          {payload && (
            <div className="text-xs text-muted-foreground">
              Backup de <b>{payload?.meta?.generated_at?.slice(0, 19).replace("T", " ")}</b>
              {" · "}grupos: {(payload?.meta?.groups ?? []).join(", ") || "—"}
            </div>
          )}
        </div>

        {payload && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Escolha o que restaurar</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => selectAll(setImportSel, true)}>Marcar tudo</Button>
                <Button size="sm" variant="ghost" onClick={() => selectAll(setImportSel, false)}>Limpar</Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {(groups as any[]).map((g) => {
                const disponivel = (payload?.meta?.groups ?? []).includes(g.key);
                return (
                  <label
                    key={g.key}
                    className={`flex items-start gap-2 border border-border rounded-md p-3 ${disponivel ? "hover:bg-accent cursor-pointer" : "opacity-50"}`}
                  >
                    <Checkbox
                      checked={!!importSel[g.key]}
                      disabled={!disponivel}
                      onCheckedChange={() => toggle(setImportSel, g.key)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {disponivel ? g.tables.join(", ") : "Não incluído neste arquivo"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Modo de restauração</Label>
              <RadioGroup value={importMode} onValueChange={(v: any) => setImportMode(v)} className="grid sm:grid-cols-2 gap-2">
                <label className="flex items-start gap-2 border border-border rounded-md p-3 cursor-pointer">
                  <RadioGroupItem value="merge" />
                  <div>
                    <div className="text-sm font-medium">Mesclar (recomendado)</div>
                    <div className="text-[11px] text-muted-foreground">Cria registros ausentes e atualiza os existentes pelo ID.</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 border border-destructive/40 rounded-md p-3 cursor-pointer">
                  <RadioGroupItem value="replace" />
                  <div>
                    <div className="text-sm font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Substituir tudo
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Apaga todos os registros das tabelas selecionadas na empresa antes de restaurar. Ação irreversível.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {payload?.auth_users?.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={restoreAuthUsers} onCheckedChange={(v) => setRestoreAuthUsers(!!v)} />
                Recriar usuários de autenticação ausentes (senha temporária aleatória — os usuários deverão redefinir a senha)
              </label>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant={importMode === "replace" ? "destructive" : "default"} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Restaurar backup
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar restauração?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {importMode === "replace"
                      ? "Isto irá APAGAR os dados atuais das tabelas selecionadas e substituí-los pelo conteúdo do backup. Não é possível desfazer."
                      : "Registros ausentes serão criados e os existentes serão atualizados pelo ID."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImport}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {report && (
          <div className="border border-border rounded-md p-3 bg-muted/30 text-xs">
            <div className="font-medium mb-2">Resultado da restauração</div>
            {report.createdUsers?.length > 0 && (
              <div className="mb-2">Usuários recriados: {report.createdUsers.join(", ")}</div>
            )}
            <div className="grid sm:grid-cols-2 gap-1">
              {Object.entries(report.report ?? {}).map(([table, r]: any) => (
                <div key={table} className={r.error ? "text-destructive" : ""}>
                  <b>{table}</b>: +{r.inserted}{r.deleted ? ` · −${r.deleted}` : ""}{r.error ? ` · erro: ${r.error}` : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
