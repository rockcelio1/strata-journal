import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/configuracoes/aplicativo")({
  component: AplicativoPage,
});

function AplicativoPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl">Aplicativo</h2>
        <p className="text-sm text-muted-foreground">Preferências do app de campo.</p>
      </div>
      <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground bg-muted/30">
        Em breve: modo offline, qualidade de fotos, destino de upload (OneDrive/Supabase), sincronização.
      </div>
    </section>
  );
}
