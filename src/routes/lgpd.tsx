import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/public-page-shell";

export const Route = createFileRoute("/lgpd")({
  head: () => ({
    meta: [
      { title: "LGPD — Diário de Obra" },
      { name: "description", content: "Direitos do titular, Encarregado de Dados (DPO) e como exercer seus direitos LGPD." },
      { property: "og:title", content: "LGPD — Diário de Obra" },
      { property: "og:description", content: "Direitos do titular e canal oficial de solicitações LGPD/DSAR." },
    ],
  }),
  component: LgpdPage,
});

function LgpdPage() {
  return (
    <PublicPageShell title="LGPD — Lei Geral de Proteção de Dados">
      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">Direitos do titular</h2>
        <p>Nos termos do art. 18 da LGPD, o titular pode solicitar a qualquer tempo:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Acesso</b> aos dados pessoais tratados.</li>
          <li><b>Correção</b> de dados incompletos, inexatos ou desatualizados.</li>
          <li><b>Exclusão</b> de dados tratados com base em consentimento.</li>
          <li><b>Anonimização</b>, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
          <li><b>Portabilidade</b> a outro fornecedor de serviço.</li>
          <li><b>Revogação</b> do consentimento.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">Como solicitar</h2>
        <p>
          Envie sua solicitação pelo formulário oficial. Você receberá um número de protocolo e o retorno em
          até 15 dias, conforme art. 19 da LGPD.
        </p>
        <p>
          <Link
            to="/solicitacao-lgpd"
            className="inline-flex items-center rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium hover:opacity-90 mt-2"
          >
            Abrir solicitação LGPD
          </Link>
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">Encarregado de Dados (DPO)</h2>
        <p>
          O Encarregado é indicado por cada Empresa Cliente controladora. O canal oficial de contato é o
          formulário acima; a resposta será encaminhada ao Encarregado indicado.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">Prazos e recusas</h2>
        <p>
          Solicitações são respondidas em até 15 dias. Pedidos poderão ser recusados quando conflitarem com
          obrigação legal, regulatória, exercício regular de direitos ou proteção contra fraudes — sempre
          com justificativa formal.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl mt-6 mb-2">Documentos relacionados</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><Link to="/privacidade" className="text-brand underline">Política de Privacidade</Link></li>
          <li><Link to="/termos" className="text-brand underline">Termos de Uso</Link></li>
        </ul>
      </section>
    </PublicPageShell>
  );
}
