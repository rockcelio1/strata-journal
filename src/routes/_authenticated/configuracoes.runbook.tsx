import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/runbook")({
  component: RunbookPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-serif text-lg mb-2">{title}</h3>
      <div className="text-sm space-y-2 text-muted-foreground [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:leading-relaxed [&>code]:bg-muted [&>code]:px-1 [&>code]:rounded">
        {children}
      </div>
    </section>
  );
}

function RunbookPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">Runbook Operacional</h2>
          <p className="text-xs text-muted-foreground mt-1">Procedimentos para incidentes e operação.</p>
        </div>
      </header>

      <Section title="1. Contatos de emergência">
        <ul>
          <li><b>DPO / Encarregado:</b> definir no cadastro da empresa.</li>
          <li><b>Responsável técnico:</b> definir no cadastro da empresa.</li>
          <li><b>Provedor de infraestrutura:</b> Lovable Cloud (Supabase gerenciado).</li>
        </ul>
      </Section>

      <Section title="2. Incidente de segurança (suspeita de vazamento)">
        <ol>
          <li>Isolar: desabilitar usuários suspeitos em <b>Configurações › Usuários</b>.</li>
          <li>Preservar evidências: exportar <b>audit_logs_usuarios</b>, <b>rdo_audit_logs</b> e <b>security_alerts</b>.</li>
          <li>Rotacionar chaves: seguir procedimento em <b>Configurações › Rotação de chaves</b>.</li>
          <li>Comunicar DPO em até 2h. Registrar comunicação em <b>security_alerts</b>.</li>
          <li>Se envolver dados pessoais: avaliar notificação à ANPD em 2 dias úteis (art. 48 LGPD).</li>
          <li>Reter logs por, no mínimo, 6 meses após a resolução.</li>
        </ol>
      </Section>

      <Section title="3. Indisponibilidade total">
        <ol>
          <li>Verificar <a href="/status" className="text-brand underline">/status</a> e /api/public/health.</li>
          <li>Consultar Lovable Cloud status.</li>
          <li>Se banco estiver pausado, retomar via Lovable Cloud.</li>
          <li>Comunicar clientes via canal oficial da empresa (não usar o sistema afetado).</li>
        </ol>
      </Section>

      <Section title="4. Erro em upload / OneDrive">
        <ol>
          <li>Verificar quota e sessão OAuth em <b>Configurações › OneDrive</b>.</li>
          <li>Reautenticar a conta corporativa se o token expirou.</li>
          <li>Confirmar magic bytes (jpg/png/webp/pdf) — arquivos rejeitados aparecem no toast do usuário.</li>
        </ol>
      </Section>

      <Section title="5. Restauração de backup">
        <ol>
          <li>Backup gerenciado pelo provedor (PITR). Ativar restauração via console gerenciado.</li>
          <li>Registrar teste em <b>backup_restore_tests</b>: tipo, resultado, evidência.</li>
          <li>Executar teste trimestral obrigatório.</li>
        </ol>
      </Section>

      <Section title="6. Solicitação LGPD recebida">
        <ol>
          <li>Abrir <b>Configurações › Solicitações LGPD</b>.</li>
          <li>Confirmar identidade do titular pelo e-mail informado.</li>
          <li>Executar ação (acesso / correção / exclusão / portabilidade) dentro do prazo de 15 dias.</li>
          <li>Registrar resposta e mudar status para <b>Concluído</b>.</li>
        </ol>
      </Section>

      <Section title="7. Rotina diária de observabilidade">
        <ul>
          <li>Verificar alertas abertos em <b>security_alerts</b>.</li>
          <li>Revisar cota de IA (<b>ai_usage_limits</b>) e falhas de rate limit.</li>
          <li>Verificar exportações em <b>export_jobs</b> com status <b>erro</b>.</li>
        </ul>
      </Section>
    </div>
  );
}
