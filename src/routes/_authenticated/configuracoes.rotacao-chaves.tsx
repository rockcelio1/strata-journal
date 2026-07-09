import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/rotacao-chaves")({
  component: RotacaoChavesPage,
});

const CHAVES = [
  {
    nome: "SUPABASE_PUBLISHABLE_KEY (anon)",
    periodicidade: "Anual ou após incidente",
    como: "Rotação gerenciada pelo Lovable Cloud. Após rotacionar, atualizar VITE_SUPABASE_PUBLISHABLE_KEY e reimplantar.",
    impacto: "Baixo — chave pública, protegida por RLS.",
  },
  {
    nome: "SUPABASE_SERVICE_ROLE_KEY",
    periodicidade: "Semestral ou após incidente",
    como: "Rotação gerenciada. Nunca expor no cliente. Reimplantar após atualizar.",
    impacto: "Alto — bypassa RLS. Requer janela de manutenção.",
  },
  {
    nome: "LOVABLE_API_KEY",
    periodicidade: "Após incidente ou saída de administrador",
    como: "Gerenciada pelo Lovable AI Gateway. Rotacionar via painel.",
    impacto: "Médio — quota de IA. Sem downtime.",
  },
  {
    nome: "MICROSOFT_ONEDRIVE_API_KEY",
    periodicidade: "Anual",
    como: "Rotação via connector do OneDrive em Cloud › Connectors.",
    impacto: "Médio — quebra uploads pendentes. Reautenticar em Configurações › OneDrive.",
  },
  {
    nome: "Segredos de webhook",
    periodicidade: "Após saída de administrador ou suspeita",
    como: "Gerar novo segredo, atualizar chamador externo, invalidar antigo.",
    impacto: "Médio — janela curta de indisponibilidade.",
  },
];

function RotacaoChavesPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-brand/10 text-brand grid place-items-center">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-xl leading-none">Rotação de Chaves e Segredos</h2>
          <p className="text-xs text-muted-foreground mt-1">Política e checklist para rotação segura.</p>
        </div>
      </header>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          Rotação de chaves é operação sensível. Sempre execute em janela agendada, com backup íntegro
          testado (últimos 7 dias) e comunicação prévia aos administradores.
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="text-left p-2">Chave / Segredo</th>
              <th className="text-left p-2">Periodicidade</th>
              <th className="text-left p-2">Como rotacionar</th>
              <th className="text-left p-2">Impacto</th>
            </tr>
          </thead>
          <tbody>
            {CHAVES.map((c) => (
              <tr key={c.nome} className="border-t border-border">
                <td className="p-2 font-medium align-top">{c.nome}</td>
                <td className="p-2 text-muted-foreground align-top">{c.periodicidade}</td>
                <td className="p-2 text-muted-foreground align-top">{c.como}</td>
                <td className="p-2 text-muted-foreground align-top">{c.impacto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-lg mb-2">Checklist de rotação</h3>
        <ol className="list-decimal pl-5 text-sm space-y-1 text-muted-foreground">
          <li>Confirmar que o último backup diário está íntegro.</li>
          <li>Registrar início em <b>security_alerts</b> (severidade: info, tipo: <code>key_rotation</code>).</li>
          <li>Comunicar administradores por canal oficial.</li>
          <li>Gerar nova chave / segredo no provedor.</li>
          <li>Atualizar variáveis de ambiente e reimplantar.</li>
          <li>Validar login, upload, exportação e chamada de IA.</li>
          <li>Invalidar chave antiga.</li>
          <li>Registrar conclusão em <b>security_alerts</b> com status <b>resolvido</b>.</li>
          <li>Atualizar planilha interna de controle de chaves.</li>
        </ol>
      </section>
    </div>
  );
}
