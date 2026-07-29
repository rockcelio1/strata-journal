import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Send, RefreshCw, KeyRound, FileCode2, ListChecks } from "lucide-react";
import {
  getEmailConfig,
  saveEmailConfig,
  saveEmailCredentials,
  saveEmailTemplate,
  enviarEmailTeste,
  listEmailFila,
  processarFilaEmail,
  reenfileirarEmail,
} from "@/lib/email.functions";
import { PROVIDERS, getProviderSpec, TEMPLATE_CHAVES, type EmailProvider } from "@/lib/email/providers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/configuracoes/email")({
  head: () => ({
    meta: [
      { title: "Configuração de E-mail | Diário de Obra" },
      { name: "description", content: "Provedor, templates, fila e logs de envio de e-mail do sistema." },
      { property: "og:title", content: "Configuração de E-mail" },
      { property: "og:description", content: "Provedor, templates, fila e logs de envio de e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailConfigPage,
});

type Cfg = {
  provider: EmailProvider;
  modo: "server_functions" | "edge_function";
  edge_function_name: string | null;
  from_name: string;
  from_email: string | null;
  reply_to: string | null;
  mailgun_domain: string | null;
  ses_region: string | null;
  ativo: boolean;
  max_tentativas: number;
};

function EmailConfigPage() {
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getEmailConfig);
  const fetchFila = useServerFn(listEmailFila);
  const saveCfg = useServerFn(saveEmailConfig);
  const saveCred = useServerFn(saveEmailCredentials);
  const saveTpl = useServerFn(saveEmailTemplate);
  const testar = useServerFn(enviarEmailTeste);
  const processar = useServerFn(processarFilaEmail);
  const reenviar = useServerFn(reenfileirarEmail);

  const { data, isLoading } = useQuery({ queryKey: ["email-config"], queryFn: () => fetchCfg() });
  const { data: filaData } = useQuery({ queryKey: ["email-fila"], queryFn: () => fetchFila(), refetchInterval: 20000 });

  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [teste, setTeste] = useState("");
  const [tplChave, setTplChave] = useState<string>("convite");
  const [tpl, setTpl] = useState<{ nome: string; assunto: string; corpo_html: string; ativo: boolean } | null>(null);

  useEffect(() => {
    if (data?.config) setCfg(data.config as Cfg);
  }, [data]);

  useEffect(() => {
    const t = (data?.templates ?? []).find((x: any) => x.chave === tplChave);
    if (t) setTpl({ nome: t.nome, assunto: t.assunto, corpo_html: t.corpo_html, ativo: t.ativo });
  }, [data, tplChave]);

  const spec = useMemo(() => getProviderSpec((cfg?.provider ?? "resend") as EmailProvider), [cfg?.provider]);
  const varsTpl = useMemo(
    () => TEMPLATE_CHAVES.find((t) => t.chave === tplChave)?.vars ?? [],
    [tplChave],
  );

  const mSalvar = useMutation({
    mutationFn: async () => {
      if (!cfg) return;
      if (!cfg.from_email) throw new Error("Informe o e-mail do remetente.");
      await saveCfg({
        data: {
          provider: cfg.provider,
          modo: cfg.modo,
          edge_function_name: cfg.edge_function_name || null,
          from_name: cfg.from_name,
          from_email: cfg.from_email,
          reply_to: cfg.reply_to || null,
          mailgun_domain: cfg.mailgun_domain || null,
          ses_region: cfg.ses_region || null,
          ativo: cfg.ativo,
          max_tentativas: cfg.max_tentativas,
        },
      });
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["email-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const mCred = useMutation({
    mutationFn: async () => {
      if (!cfg) return;
      if (!apiKey && !apiSecret) throw new Error("Informe ao menos uma credencial.");
      await saveCred({
        data: {
          provider: cfg.provider,
          ...(apiKey ? { api_key: apiKey } : {}),
          ...(apiSecret ? { api_secret: apiSecret } : {}),
        },
      });
    },
    onSuccess: () => {
      setApiKey("");
      setApiSecret("");
      toast.success("Credenciais salvas com segurança");
      qc.invalidateQueries({ queryKey: ["email-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar credenciais"),
  });

  const mTpl = useMutation({
    mutationFn: async () => {
      if (!tpl) return;
      await saveTpl({ data: { chave: tplChave, ...tpl } });
    },
    onSuccess: () => {
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["email-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar template"),
  });

  const mTeste = useMutation({
    mutationFn: async () => await testar({ data: { destinatario: teste } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("E-mail de teste enviado");
      else toast.error(r?.erro ?? "Falha no envio de teste");
      qc.invalidateQueries({ queryKey: ["email-fila"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no teste"),
  });

  const mProcessar = useMutation({
    mutationFn: async () => await processar(),
    onSuccess: (r: any) => {
      toast.success(`Fila processada: ${r?.enviados ?? 0} enviados, ${r?.falhas ?? 0} falhas`);
      qc.invalidateQueries({ queryKey: ["email-fila"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao processar fila"),
  });

  if (isLoading || !cfg) return <p className="text-sm text-muted-foreground">Carregando configuração…</p>;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">E-mail</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Provedor, credenciais, templates, fila com retentativa e logs de envio.
          </p>
        </div>
        <Badge variant={cfg.ativo ? "default" : "secondary"} className="ml-auto">
          {cfg.ativo ? "Envio ativo" : "Envio desativado"}
        </Badge>
      </header>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="fila">Fila e logs</TabsTrigger>
        </TabsList>

        {/* Configuração */}
        <TabsContent value="config" className="space-y-4 pt-4">
          <Card className="p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Serviço de e-mail</Label>
                <Select value={cfg.provider} onValueChange={(v) => setCfg({ ...cfg, provider: v as EmailProvider })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} — {p.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Onde o envio é executado</Label>
                <Select value={cfg.modo} onValueChange={(v) => setCfg({ ...cfg, modo: v as Cfg["modo"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server_functions">Opção B — Funções do próprio app</SelectItem>
                    <SelectItem value="edge_function">Opção A — Edge Function do Supabase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {cfg.modo === "edge_function" && (
              <div>
                <Label>Nome da Edge Function</Label>
                <Input
                  placeholder="send-email"
                  value={cfg.edge_function_name ?? ""}
                  onChange={(e) => setCfg({ ...cfg, edge_function_name: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A função deve aceitar POST com <code>{"{ to, subject, html, text, from }"}</code> e responder 2xx em caso de sucesso.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nome do remetente</Label>
                <Input value={cfg.from_name} onChange={(e) => setCfg({ ...cfg, from_name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail do remetente</Label>
                <Input
                  placeholder="noreply@suaempresa.com.br"
                  value={cfg.from_email ?? ""}
                  onChange={(e) => setCfg({ ...cfg, from_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Responder para (opcional)</Label>
                <Input value={cfg.reply_to ?? ""} onChange={(e) => setCfg({ ...cfg, reply_to: e.target.value })} />
              </div>
              <div>
                <Label>Máximo de tentativas</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={cfg.max_tentativas}
                  onChange={(e) => setCfg({ ...cfg, max_tentativas: Number(e.target.value) || 5 })}
                />
              </div>
              {cfg.provider === "mailgun" && (
                <div>
                  <Label>Domínio Mailgun</Label>
                  <Input value={cfg.mailgun_domain ?? ""} onChange={(e) => setCfg({ ...cfg, mailgun_domain: e.target.value })} />
                </div>
              )}
              {cfg.provider === "ses" && (
                <div>
                  <Label>Região AWS</Label>
                  <Input placeholder="us-east-1" value={cfg.ses_region ?? ""} onChange={(e) => setCfg({ ...cfg, ses_region: e.target.value })} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
              <span className="text-sm">Ativar envio de e-mails do sistema</span>
            </div>

            <div className="rounded-md border p-3 bg-muted/30">
              <p className="text-sm font-medium">Requisitos do {spec.nome}</p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground mt-1 space-y-1">
                {spec.requisitos.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <a href={spec.docsUrl} target="_blank" rel="noreferrer" className="text-xs underline mt-2 inline-block">
                Documentação oficial
              </a>
            </div>

            <Button onClick={() => mSalvar.mutate()} disabled={mSalvar.isPending}>
              {mSalvar.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand" />
              <h3 className="font-medium">Credenciais do provedor</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Guardadas apenas no servidor. Nunca são devolvidas ao navegador — só o resumo mascarado.
              Atual: <strong>{data?.credenciais?.api_key ?? "não configurada"}</strong>
              {cfg.provider === "ses" && <> · segredo: <strong>{data?.credenciais?.api_secret ?? "não configurado"}</strong></>}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>{spec.campos[0]?.label ?? "API Key"}</Label>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••" />
              </div>
              {cfg.provider === "ses" && (
                <div>
                  <Label>Secret Access Key</Label>
                  <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="••••••••" />
                </div>
              )}
            </div>
            <Button variant="secondary" onClick={() => mCred.mutate()} disabled={mCred.isPending}>
              {mCred.isPending ? "Salvando…" : "Salvar credenciais"}
            </Button>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-brand" />
              <h3 className="font-medium">Enviar e-mail de teste</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="destinatario@empresa.com" value={teste} onChange={(e) => setTeste(e.target.value)} />
              <Button onClick={() => mTeste.mutate()} disabled={mTeste.isPending || !teste}>
                {mTeste.isPending ? "Enviando…" : "Enviar teste"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="space-y-4 pt-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-brand" />
              <h3 className="font-medium">Templates dos fluxos</h3>
            </div>
            <Select value={tplChave} onValueChange={setTplChave}>
              <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_CHAVES.map((t) => <SelectItem key={t.chave} value={t.chave}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {tpl && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Nome</Label>
                    <Input value={tpl.nome} onChange={(e) => setTpl({ ...tpl, nome: e.target.value })} />
                  </div>
                  <div>
                    <Label>Assunto</Label>
                    <Input value={tpl.assunto} onChange={(e) => setTpl({ ...tpl, assunto: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Corpo (HTML)</Label>
                  <Textarea
                    rows={14}
                    className="font-mono text-xs"
                    value={tpl.corpo_html}
                    onChange={(e) => setTpl({ ...tpl, corpo_html: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis disponíveis: {varsTpl.map((v) => `{{${v}}}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={tpl.ativo} onCheckedChange={(v) => setTpl({ ...tpl, ativo: v })} />
                  <span className="text-sm">Template ativo</span>
                </div>
                <Button onClick={() => mTpl.mutate()} disabled={mTpl.isPending}>
                  {mTpl.isPending ? "Salvando…" : "Salvar template"}
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Fila e logs */}
        <TabsContent value="fila" className="space-y-4 pt-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-brand" />
              <h3 className="font-medium">Fila de envio</h3>
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => mProcessar.mutate()} disabled={mProcessar.isPending}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {mProcessar.isPending ? "Processando…" : "Processar agora"}
              </Button>
            </div>
            <div className="space-y-2">
              {(filaData?.fila ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum e-mail na fila.</p>}
              {(filaData?.fila ?? []).map((f: any) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 border rounded-md p-2 text-sm">
                  <Badge variant={f.status === "enviado" ? "default" : f.status === "falha" ? "destructive" : "secondary"}>
                    {f.status}
                  </Badge>
                  <span className="font-medium">{f.destinatario}</span>
                  <span className="text-muted-foreground truncate max-w-[240px]">{f.assunto}</span>
                  <span className="text-xs text-muted-foreground">tentativas: {f.tentativas}</span>
                  {f.ultimo_erro && <span className="text-xs text-destructive truncate max-w-[280px]">{f.ultimo_erro}</span>}
                  {f.status === "falha" && (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => reenviar({ data: { id: f.id } }).then(() => qc.invalidateQueries({ queryKey: ["email-fila"] }))}>
                      Reenviar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <h3 className="font-medium">Logs recentes</h3>
            {(filaData?.logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem registros ainda.</p>}
            {(filaData?.logs ?? []).map((l: any) => (
              <div key={l.id} className="text-xs border-b py-1.5 flex flex-wrap gap-2">
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                <span className="font-medium">{l.evento}</span>
                {l.provider && <span>{l.provider}</span>}
                {l.status && <span className={l.status === "erro" ? "text-destructive" : "text-muted-foreground"}>{l.status}</span>}
                {l.destinatario && <span className="text-muted-foreground">{l.destinatario}</span>}
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
