# ERP FACOM — unificar Chamados, Patrimônio e Protocolo neste banco

## Resposta direta

Sim, dá para colocar os três sistemas no mesmo banco deste projeto, sem perder dados. Mas **não** jogando tudo em `public`: os três já usam nomes de tabela iguais aos daqui (`profiles`, `audit_logs`, `user_roles`, `app_settings`, `assets`, `departments`, `locations`, `email_queue`...). Jogar tudo junto sobrescreveria dados.

A forma segura é **um banco, quatro áreas separadas (schemas)**: o núcleo comum continua em `public`, e cada sistema ganha sua própria área isolada. Mesmo login, mesmas permissões, mesma auditoria — dados que não se atropelam.

## O que já verifiquei

| Sistema | Projeto | Tamanho aproximado |
|---|---|---|
| Chamados | CHAMADOS FACOM (chamadorestor.lovable.app) | ~160 tabelas — o maior, com IA, e-mail, backup, credenciais |
| Patrimônio | Patrimonio (patrimoniofacom.lovable.app) | ~62 tabelas — bens, empréstimos, manutenção, locação, manual |
| Protocolo | Protocolo (evident-delivery-log.lovable.app) | ~14 tabelas — protocolos, fotos, assinaturas, transportadoras |

Colisões confirmadas com este projeto: `profiles`, `user_roles`, `audit_logs`/`audit_logs_usuarios`, `email_queue`, `app_settings`, `departments`, `locations`, `assets`. Por isso a separação por schema não é preferência — é necessidade.

## Arquitetura

```text
public       núcleo: empresas, profiles, user_roles, permissões,
             auditoria, notificações, e-mail, backup, LGPD, ajuda
             + obras/RDO (fica onde está, para não mexer no que funciona)
chamados     tickets, categorias, SLA, atendimentos, base de conhecimento
patrimonio   bens, categorias, movimentações, empréstimos, manutenção
protocolo    documentos, tramitações, recebedores, assinaturas
```

Regras iguais para toda tabela nova: `empresa_id` obrigatório, RLS ligada usando as funções que já existem aqui, GRANT explícito, e nenhuma ligação cruzando módulos (só para o núcleo).

Login: um só. Os usuários dos três sistemas entram por e-mail; quem já existe aqui é reaproveitado, quem não existe é criado e **redefine a senha no primeiro acesso** (as senhas antigas não são portáveis com segurança entre projetos). O `id` antigo de cada sistema fica guardado para religar os dados migrados.

Navegação: menu monta sozinho conforme os módulos ativos da empresa e as permissões do usuário — `/chamados/*`, `/patrimonio/*`, `/protocolo/*` ao lado de `/obras` e `/rdo`.

## Ondas (nada é apagado; os sistemas antigos ficam no ar)

| Onda | Entrega | Sistemas atuais |
|---|---|---|
| 0 | Inventário real: estrutura + contagem de linhas dos 3, relatório de colisões e de usuários duplicados | no ar |
| 1 | Criar os schemas `chamados`, `patrimonio`, `protocolo` vazios, com RLS, grants e recursos de permissão | no ar |
| 2 | Importar e de-duplicar usuários por e-mail | no ar |
| 3 | Protocolo (menor): carga de dados + telas + validação | no ar (leitura) |
| 4 | Patrimônio | no ar (leitura) |
| 5 | Chamados (maior, tem anexos e SLA) | no ar (leitura) |
| 6 | Congelamento, carga incremental do delta, corte | somente leitura |
| 7 | Domínios apontam para o ERP; antigos mantidos 30 dias | desligados |

Cada onda tem script de carga idempotente (pode rodar de novo sem duplicar), script de validação (contagem origem × destino, órfãos, RLS, grants) e rollback trivial — basta não cortar o domínio.

## Decisões que assumi

- Chamados = **chamadorestor.lovable.app**. Confirmo na Onda 0 comparando volume de dados com o fix-fuse; se o outro estiver mais vivo, troco antes de qualquer carga.
- Migração de **histórico completo**, incluindo anexos (buckets separados por módulo, todos privados).
- Obras/RDO **permanece em `public`** nesta fase — menos risco.

## Próximo passo desta aprovação

Executo as Ondas 0 e 1:

1. Inventário completo dos três bancos, gravado em `/mnt/documents/erp-onda0-inventario.md` (estrutura, contagens, colisões, usuários duplicados).
2. Migration criando os três schemas vazios com RLS, grants e os novos recursos de permissão (`chamados`, `patrimonio`, `protocolo`) — requer sua aprovação da migration.
3. Tabela de núcleo `empresa_modulos` para ligar/desligar módulo por empresa, e menu lateral preparado para os módulos (ainda sem telas).

Nenhum dado dos sistemas atuais é lido para escrita, nenhum é apagado, e o RDO continua funcionando exatamente como hoje.

## Detalhes técnicos

- Schemas novos precisam de `GRANT USAGE ON SCHEMA ... TO authenticated, service_role` e exposição no Data API para serem acessíveis pelo cliente; alternativa (se a exposição multi-schema atrapalhar) é manter `public` com prefixo de tabela `chm_`, `pat_`, `prt_`. Decido na Onda 1 conforme o comportamento do Data API.
- Reuso de `private.has_role`, `private.get_user_empresa`, `public.pode()` e `public.escopo_de()` nas policies dos módulos novos — sem duplicar lógica de permissão.
- `app_resource`/`app_recursos` ganha os recursos novos por INSERT; o enum atual não é alterado onde puder ser evitado, para não quebrar código existente.
- Carga de dados via scripts Node lendo a origem com service_role e escrevendo aqui em lote, com mapa `legacy_id -> novo id` persistido para reexecução idempotente.
- Telas dos módulos são reescritas no padrão TanStack Start deste projeto (os originais são React+Vite); a lógica de negócio é reaproveitada, estimativa de 60–70%.
