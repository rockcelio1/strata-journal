import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/configuracoes/sistema")({
  component: SistemaPage,
});

function SistemaPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl">Sistema</h2>
        <p className="text-sm text-muted-foreground">Parâmetros globais da empresa.</p>
      </div>
      <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground bg-muted/30">
        Em breve: logo da empresa, fuso horário, numeração de RDO, integração climática, modelos de PDF.
      </div>
    </section>
  );
}
