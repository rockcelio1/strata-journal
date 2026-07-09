import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
// supabase client não é mais necessário aqui — envio via /api/public/lgpd-request.
import { PublicPageShell } from "@/components/public-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Copy } from "lucide-react";

export const Route = createFileRoute("/solicitacao-lgpd")({
  head: () => ({
    meta: [
      { title: "Solicitação LGPD — Diário de Obra" },
      { name: "description", content: "Abra uma solicitação LGPD/DSAR e receba um número de protocolo." },
      { property: "og:title", content: "Solicitação LGPD — Diário de Obra" },
      { property: "og:description", content: "Formulário oficial para exercer direitos LGPD." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SolicitacaoLgpdPage,
});

const TIPOS = [
  { value: "acesso", label: "Acesso aos meus dados" },
  { value: "correcao", label: "Correção de dados" },
  { value: "exclusao", label: "Exclusão de dados" },
  { value: "portabilidade", label: "Portabilidade" },
  { value: "anonimizacao", label: "Anonimização" },
  { value: "revogacao", label: "Revogação de consentimento" },
] as const;

const schema = z.object({
  requester_nome: z.string().trim().min(2, "Informe seu nome").max(120),
  requester_email: z.string().trim().email("E-mail inválido").max(255),
  request_type: z.enum(["acesso", "correcao", "exclusao", "portabilidade", "anonimizacao", "revogacao"]),
  descricao: z.string().trim().min(10, "Descreva a solicitação (mínimo 10 caracteres)").max(2000),
});

function SolicitacaoLgpdPage() {
  const [loading, setLoading] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [form, setForm] = useState({
    requester_nome: "",
    requester_email: "",
    request_type: "acesso" as (typeof TIPOS)[number]["value"],
    descricao: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fe[i.path.join(".")] = i.message; });
      setErrors(fe);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/lgpd-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 429) {
        toast.error("Muitas solicitações deste IP. Aguarde alguns minutos e tente novamente.");
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { protocolo?: string };
      if (!data.protocolo) throw new Error("Sem protocolo");
      setProtocolo(data.protocolo);
      toast.success("Solicitação registrada");
    } catch (err) {
      console.error("[lgpd] submit failed", err);
      toast.error("Não foi possível registrar sua solicitação. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  if (protocolo) {
    return (
      <PublicPageShell title="Solicitação recebida">
        <div className="rounded-lg border border-border bg-card p-6 not-prose">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-8 w-8 text-brand" />
            <h2 className="font-serif text-xl">Sua solicitação foi registrada</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Guarde este número de protocolo. Você receberá retorno em até 15 dias no e-mail informado.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">{protocolo}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(protocolo); toast.success("Protocolo copiado"); }}
            >
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell title="Solicitação LGPD">
      <p className="text-muted-foreground">
        Use este formulário para exercer seus direitos previstos na Lei nº 13.709/2018. Você receberá um
        número de protocolo ao final e retorno em até 15 dias.
      </p>

      <form onSubmit={onSubmit} className="not-prose space-y-4 mt-6 max-w-xl">
        <div>
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome"
            value={form.requester_nome}
            onChange={(e) => setForm({ ...form, requester_nome: e.target.value })}
            maxLength={120}
            required
          />
          {errors.requester_nome && <p className="text-xs text-destructive mt-1">{errors.requester_nome}</p>}
        </div>

        <div>
          <Label htmlFor="email">E-mail para retorno</Label>
          <Input
            id="email"
            type="email"
            value={form.requester_email}
            onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
            maxLength={255}
            required
          />
          {errors.requester_email && <p className="text-xs text-destructive mt-1">{errors.requester_email}</p>}
        </div>

        <div>
          <Label htmlFor="tipo">Tipo de solicitação</Label>
          <select
            id="tipo"
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.request_type}
            onChange={(e) => setForm({ ...form, request_type: e.target.value as any })}
          >
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <Label htmlFor="desc">Descrição do pedido</Label>
          <Textarea
            id="desc"
            rows={5}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            maxLength={2000}
            placeholder="Descreva de forma clara o que você está solicitando. Não inclua senhas nem números de documento completos."
            required
          />
          {errors.descricao && <p className="text-xs text-destructive mt-1">{errors.descricao}</p>}
          <p className="text-xs text-muted-foreground mt-1">{form.descricao.length}/2000</p>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar solicitação"}
        </Button>
      </form>
    </PublicPageShell>
  );
}
