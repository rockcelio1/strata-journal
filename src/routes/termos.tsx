import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/public-page-shell";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Diário de Obra" },
      { name: "description", content: "Termos e condições de uso do sistema Diário de Obra." },
      { property: "og:title", content: "Termos de Uso — Diário de Obra" },
      { property: "og:description", content: "Termos e condições de uso do sistema Diário de Obra." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <PublicPageShell title="Termos de Uso">
      <p className="text-muted-foreground">Última atualização: 08/07/2026</p>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">1. Aceitação</h2>
        <p>Ao criar conta ou acessar o Diário de Obra, o usuário concorda com estes Termos e com a Política de Privacidade.</p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">2. Conta e acesso</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>O usuário é responsável pela guarda de credenciais e pela veracidade dos dados cadastrais.</li>
          <li>É proibido compartilhar acesso ou utilizar a conta de terceiros.</li>
          <li>Administradores da Empresa Cliente podem revogar acessos a qualquer momento.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">3. Uso aceitável</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Não realizar engenharia reversa, varredura automatizada ou tentativa de burlar controles.</li>
          <li>Não inserir conteúdo ilícito, ofensivo ou que infrinja direitos de terceiros.</li>
          <li>Respeitar limites de uso, cotas de IA e políticas de rate limiting.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">4. Disponibilidade</h2>
        <p>
          Trabalhamos para manter alta disponibilidade, mas não garantimos serviço ininterrupto. Manutenções
          e incidentes podem ocorrer, sendo comunicados na página de status quando aplicável.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">5. Propriedade intelectual</h2>
        <p>
          O software, marca e interfaces são de titularidade do fornecedor. Os dados operacionais inseridos
          pertencem à Empresa Cliente.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">6. Limitação de responsabilidade</h2>
        <p>
          Não nos responsabilizamos por danos indiretos, lucros cessantes ou uso indevido por terceiros
          decorrente de negligência do usuário na guarda de credenciais.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">7. Encerramento</h2>
        <p>
          A conta pode ser encerrada por solicitação da Empresa Cliente, por descumprimento destes Termos,
          ou por término contratual. Dados serão tratados conforme a política de retenção.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">8. Foro</h2>
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio do fornecedor
          para dirimir controvérsias, salvo disposição legal em contrário.
        </p>
      </section>
    </PublicPageShell>
  );
}
