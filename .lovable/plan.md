# ERP FACOM — aplicações independentes, bancos independentes, login único

## Resposta direta às suas perguntas

1. **É possível?** Sim. Cada aplicação fica com o seu próprio projeto de banco (mesma tecnologia do RDO) e a sua própria hospedagem na Hostinger. Nenhum dado se mistura, nada é sobrescrito e nenhuma aplicação depende da outra para funcionar.
2. **Login único?** Sim. Um dos bancos passa a ser o **banco de identidade** (o "portão"). O usuário entra uma única vez e circula entre as aplicações sem digitar senha de novo.
3. **Permissões detalhadas por aplicação e por item?** Sim — é exatamente o modelo que já existe hoje no RDO (recurso + ação + alcance: próprio / equipe / empresa / global). Ele é replicado para as outras aplicações, com o catálogo de itens de cada uma.
4. **Os bancos "se conversam"?** Sim, mas de forma controlada: cada aplicação lê a identidade e as permissões do banco central; os dados operacionais (chamados, bens, protocolos, RDOs) nunca cruzam. Se um dia precisar de leitura cruzada (ex.: um chamado citar um bem), isso é feito por consulta de leitura publicada, nunca por acesso direto à tabela do vizinho.
5. **Dá para trazer outras aplicações do Lovable depois?** Sim, indefinidamente. Cada nova aplicação é só mais um "inquilino": ganha banco próprio, entra no catálogo de permissões e aparece no menu. Você aponta a aplicação, eu faço a onda dela.
6. **Migro sem perder dados?** Sim. O sistema atual continua no ar durante toda a migração; o corte só acontece quando você aprova a conferência de números (linha a linha, origem × destino).

## Como fica

```text
                     +-----------------------------+
                     |   PORTAL / IDENTIDADE       |
                     |   (banco central)           |
                     |   usuários, empresas,       |
                     |   papéis, permissões,       |
                     |   auditoria, notificações   |
                     +--------------+--------------+
                                    |  login único + permissões
        +---------------+-----------+-----------+---------------+
        |               |                       |               |
   +----v----+     +----v-----+           +-----v----+    +-----v----+
   |  RDO    |     | CHAMADOS |           |PATRIMONIO|    |PROTOCOLO |
   | app +   |     | app +    |           | app +    |    | app +    |
   | banco   |     | banco    |           | banco    |    | banco    |
   +---------+     +----------+           +----------+    +----------+
   rdo.dominio     chamados.dominio       patrimonio.     protocolo.
                                          dominio         dominio
```

- **Hospedagem:** Hostinger, um endereço por aplicação (subdomínio), todas sob o mesmo domínio principal.
- **Banco:** um projeto por aplicação, mais o banco central de identidade. Estrutura e padrões idênticos aos do RDO (empresa em toda tabela, RLS ligada, GRANT explícito, auditoria).
- **Menu:** cada aplicação mostra um seletor com as demais; só aparece o que o usuário pode acessar.

## Como o login único funciona na prática

1. O usuário abre qualquer aplicação e é levado ao Portal para entrar (uma vez).
2. O Portal devolve a sessão e a lista de permissões do usuário.
3. Cada aplicação valida essa sessão no próprio backend antes de mostrar qualquer dado; a permissão continua sendo verificada dentro do banco de cada aplicação (RLS), então mesmo um pedido forjado não passa.
4. Sair em uma aplicação encerra a sessão em todas.

Usuários hoje espalhados nos três sistemas são unificados **por e-mail** no Portal. Senhas antigas não são transportáveis com segurança entre bancos: quem vier de outro sistema define a senha no primeiro acesso (link enviado por e-mail). O identificador antigo de cada usuário fica guardado para religar os dados migrados.

## Permissões — nível de detalhe

| Nível | Exemplo |
|---|---|
| Aplicação | "vê Patrimônio", "não vê Chamados" |
| Item / tela | "Chamados > Base de conhecimento", "Patrimônio > Empréstimos" |
| Ação | ver, criar, editar, excluir, aprovar, exportar, importar |
| Alcance | só os próprios registros / da sua equipe / da empresa toda / global |
| Exceção por pessoa | libera ou bloqueia um item específico para um usuário, sem mexer no papel dele |

Tudo administrado numa tela só, com histórico de quem mudou o quê e quando.

## Ordem e ritmo — você decide

Nada é migrado sem sua ordem explícita. Para cada aplicação escolhida, a onda é sempre a mesma:

| Etapa | O que acontece | Sistema atual |
|---|---|---|
| A. Levantamento | Inventário real do banco de origem: estrutura, contagem de linhas, anexos, usuários. Relatório entregue a você | no ar |
| B. Preparação | Banco novo criado vazio, com permissões e catálogo de itens da aplicação | no ar |
| C. Carga de teste | Cópia completa dos dados para o banco novo + conferência de números | no ar |
| D. Aplicação | Telas reconstruídas no padrão do ERP, com o mesmo comportamento | no ar |
| E. Homologação | Você usa o novo em paralelo e aprova | no ar |
| F. Corte | Congelamento, carga do que mudou desde a etapa C, endereço apontado para o novo | leitura, depois desligado |

O sistema antigo fica disponível 30 dias após o corte. Voltar atrás em qualquer etapa antes do F é imediato: basta não apontar o endereço.

## O que preciso de você antes de começar

1. **Qual aplicação vai primeiro?** Sugiro Protocolo (menor, ~14 tabelas) para validar o modelo com risco mínimo; depois Patrimônio (~62) e por último Chamados (~160, o mais complexo).
2. **Confirmar qual projeto de Chamados é o de produção** — existem dois com nome parecido no seu workspace.
3. **Domínio principal** que será usado na Hostinger para os subdomínios.
4. **Quanto histórico** vem em cada aplicação: tudo, ou um recorte de período.

## Próximo passo desta aprovação

Aprovando, eu entrego **antes de qualquer migração**:

1. O documento de arquitetura definitivo com o desenho acima detalhado (endereços, bancos, fluxo de login, matriz de permissões por aplicação).
2. O **levantamento (etapa A) da aplicação que você escolher** — estrutura, contagem de linhas, volume de anexos, lista de usuários duplicados entre sistemas.
3. O plano de corte com datas em aberto, para você marcar o momento.

Nenhum dado é alterado ou apagado nesta entrega, e o RDO continua funcionando exatamente como hoje.

## Detalhes técnicos

- **Identidade:** o banco central emite a sessão; cada aplicação valida o token no servidor e resolve `empresa_id` + papéis a partir do Portal, com cache curto. As policies locais continuam usando funções equivalentes a `private.has_role` / `private.get_user_empresa`, alimentadas por uma tabela espelho de usuários sincronizada a partir do Portal.
- **Sincronização de identidade:** espelho unidirecional Portal → aplicações (usuários, empresas, papéis, permissões efetivas), por webhook + reconciliação periódica. Aplicações nunca escrevem no Portal exceto auditoria.
- **Leitura cruzada entre módulos:** apenas por endpoints de leitura publicados pela aplicação dona do dado, autenticados com a mesma sessão; sem conexões diretas entre bancos e sem chaves estrangeiras cruzando projetos.
- **Anexos:** buckets privados por aplicação, no projeto da própria aplicação; cópia feita com o mesmo utilitário já usado aqui (`scripts/migracao/copiar-buckets.mjs`).
- **Carga:** scripts idempotentes com mapa `id_antigo → id_novo` persistido, permitindo reexecução sem duplicar, e script de validação (contagem origem × destino, órfãos, RLS, grants) espelhando `scripts/migracao/validacao-pos-migracao.sql`.
- **Telas:** os sistemas de origem são React+Vite; aqui o padrão é TanStack Start. A lógica de negócio é reaproveitada em grande parte, o roteamento e o acesso a dados são reescritos.
- **Hostinger:** cada aplicação é um deploy independente, com suas próprias variáveis de ambiente apontando para o banco dela e para o Portal.
