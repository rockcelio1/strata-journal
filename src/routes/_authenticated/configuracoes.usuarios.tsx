import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl">Usuários e permissões</h2>
        <p className="text-sm text-muted-foreground">Gerencie quem acessa o sistema e quais papéis cada um possui.</p>
      </div>
      <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground bg-muted/30">
        Em breve: lista de usuários, convites, atribuição de papéis (master, admin, engenheiro, encarregado, visualizador).
        <br />
        <span className="text-xs">Hoje você já pode gerenciar usuários na página <strong>Empresa</strong>.</span>
      </div>
    </section>
  );
}
