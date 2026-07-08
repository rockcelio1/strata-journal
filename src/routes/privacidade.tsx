import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/public-page-shell";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Diário de Obra" },
      { name: "description", content: "Como o Diário de Obra coleta, usa e protege os dados pessoais dos usuários." },
      { property: "og:title", content: "Política de Privacidade — Diário de Obra" },
      { property: "og:description", content: "Como o Diário de Obra coleta, usa e protege os dados pessoais dos usuários." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <PublicPageShell title="Política de Privacidade">
      <p className="text-muted-foreground">Última atualização: 08/07/2026</p>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">1. Quem somos</h2>
        <p>
          O Diário de Obra é um sistema SaaS de gestão de canteiros de obras. O controlador dos dados
          pessoais tratados no âmbito desta política é a empresa titular da conta que contratou o serviço
          (a “Empresa Cliente”). O Diário de Obra atua como operador nos termos da Lei nº 13.709/2018 (LGPD).
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">2. Dados que tratamos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Dados de cadastro: nome, e-mail, empresa, cargo, papel de acesso.</li>
          <li>Dados operacionais: RDOs, obras, fotos, assinaturas, ocorrências, mão de obra e equipamentos.</li>
          <li>Dados técnicos: endereço IP, data e hora de acesso, tipo de dispositivo, logs de auditoria.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">3. Finalidades</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prestação do serviço contratado pela Empresa Cliente.</li>
          <li>Autenticação, controle de acesso e auditoria.</li>
          <li>Segurança da informação e prevenção a fraudes.</li>
          <li>Cumprimento de obrigações legais e regulatórias.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">4. Base legal</h2>
        <p>
          Execução de contrato, cumprimento de obrigação legal, legítimo interesse e, quando aplicável,
          consentimento do titular (arts. 7º e 11 da LGPD).
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">5. Compartilhamento</h2>
        <p>
          Podemos compartilhar dados com operadores necessários à prestação do serviço (infraestrutura em
          nuvem, armazenamento, e-mail transacional) sempre sob contrato de confidencialidade e
          finalidade específica. Não vendemos dados pessoais.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">6. Retenção</h2>
        <p>
          Dados são retidos enquanto a conta estiver ativa e pelos prazos legais aplicáveis após o
          encerramento. Logs de auditoria têm política própria de retenção definida pela Empresa Cliente.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">7. Seus direitos</h2>
        <p>
          O titular pode solicitar acesso, correção, exclusão, portabilidade, anonimização e revogação de
          consentimento pela página <Link to="/solicitacao-lgpd" className="text-brand underline">solicitação LGPD</Link>.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">8. Segurança</h2>
        <p>
          Aplicamos controles técnicos e organizacionais compatíveis com o risco, incluindo criptografia em
          trânsito, autenticação, RLS por empresa, controle de papéis e auditoria de acessos.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">9. Contato</h2>
        <p>
          Dúvidas ou solicitações: use o formulário de <Link to="/solicitacao-lgpd" className="text-brand underline">solicitação LGPD</Link>
          {" "}ou entre em contato com o Encarregado (DPO) indicado pela Empresa Cliente.
        </p>
      </section>
    </PublicPageShell>
  );
}
