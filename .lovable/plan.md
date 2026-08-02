# Plano ERP FACOM — Consolidação de Sistemas

## Decisões de hospedagem (confirmadas)

| Camada | Onde fica | Observação |
|--------|-----------|------------|
| Banco de dados | Supabase externo (sua conta) | Você cria o projeto no Supabase e conecta aqui no Lovable. O Lovable continua gerando migrations e tipos automaticamente. |
| Front-end | Lovable Publish | Deploy via botão Publicar, com domínio customizado `sistemas.facom.com.br`. |
| Domínio | `sistemas.facom.com.br` | Cada aplicação pode ter um subcaminho (`/rdo`, `/chamados`, `/patrimonio`, `/protocolo`) ou subdomínio. |

> O banco de dados **não** vai para a Hostinger. A Hostinger só entra se você quiser hospedar o front-end lá, mas você escolheu publicar pelo Lovable. Se futuramente quiser mudar o front para Hostinger, o banco continua no Supabase.

## Arquitetura do ERP

Um único projeto Lovable, um único banco Supabase, várias aplicações independentes dentro do mesmo código.

```text
sistemas.facom.com.br
├── /auth            (login único)
├── /rdo             (RDO — já existe)
├── /chamados        (novo)
├── /patrimonio      (novo)
├── /protocolo       (novo)
└── /configuracoes   (admin, acessos, LGPD, backup, e-mail)
```

### Princípios

1. **Login único**: um `auth.users`, um `profiles`, um `user_roles` para todas as aplicações.
2. **Permissão por aplicação**: o sistema `app_modulos` + `app_recursos` + `perm_role_grants` + `perm_user_grants` já existente passa a controlar o que o usuário vê em cada módulo.
3. **Isolamento por empresa**: cada cliente/obra/unidade é uma `empresa_id`; usuários só enxergam dados da sua empresa.
4. **Cada app com seu schema**: para evitar conflito de nomes de tabela, cada aplicação nova recebe um schema PostgreSQL dedicado (`chamados`, `patrimonio`, `protocolo`), enquanto o núcleo compartilhado (`auth`, RBAC, LGPD, audit, notificações, e-mail) permanece em `public`.
5. **Crescimento**: adicionar uma nova aplicação depois significa criar um novo schema + rotas + menu, sem recriar login nem permissões.

## É possível migrar outras aplicações do Lovable?

Sim, mas os dados não migram sozinhos. O processo para cada aplicação será:

1. **Inventário**: listar tabelas, colunas, relacionamentos e volume de dados do projeto de origem.
2. **Mapeamento**: comparar com a estrutura do ERP e decidir o que vira tabela nova, o que se integra a tabelas existentes e o que será descartado.
3. **Extração**: exportar os dados do projeto origem (CSV/JSON via Supabase ou scripts).
4. **Transformação e carga**: scripts idempotentes que importam os dados respeitando `empresa_id`, `user_id` e RBAC.
5. **Testes de isolamento**: garantir que usuários da empresa A não vejam dados da empresa B.
6. **Go-live**: redirecionar o domínio antigo ou publicar o novo módulo.

> Aplicações que não são do Lovable também podem ser migradas, desde que consigamos acesso ao banco de origem ou a exportações dos dados.

## Fases de execução

### Fase 0 — Preparar a nova casa (sem tocar na produção atual)

- Criar projeto Supabase externo.
- Conectar o Lovable ao Supabase externo.
- Configurar domínio customizado `sistemas.facom.com.br`.
- Replicar o schema atual do RDO no novo banco.
- Ajustar secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
- Validar login, RBAC e uma RDO de teste no novo ambiente.

### Fase 1 — Escolher a primeira aplicação

Você escolhe qual sistema entra primeiro. Recomendação: começar pelo que tiver **menos dados e menos usuários** para validar o processo antes de migrar o maior.

Opções atuais conhecidas:

- **Protocolo** (menor, menos conflito de tabelas).
- **Patrimônio** (médio, provável conflito com tabelas de equipamentos do RDO).
- **Chamados** (maior, dois projetos possíveis: `chamadorestor` ou `fix-fuse`).

### Fase 2 — Inventário e mapeamento da aplicação escolhida

- Listar todas as tabelas do projeto de origem.
- Contar registros por tabela.
- Identificar tabelas que colidem com o RDO (`profiles`, `users`, `audit_logs`, etc.).
- Definir recursos e permissões do novo módulo no catálogo de acesso.
- Desenhar o menu e as telas mínimas viáveis (MVP).

### Fase 3 — Schema e desenvolvimento do módulo

- Criar schema dedicado no Supabase.
- Criar tabelas com `empresa_id`, `created_at`, `updated_at`, RLS e GRANTs.
- Mapear recursos/ações no RBAC existente.
- Desenvolver rotas e telas no Lovable.
- Implementar seeds de dados padrão.

### Fase 4 — Migração de dados

- Exportar dados do projeto origem.
- Executar scripts de carga idempotentes.
- Vincular usuários antigos ao `auth.users` do ERP.
- Validar isolamento por empresa.

### Fase 5 — Testes e go-live

- Testes E2E de RBAC e isolamento.
- Testes de login único.
- Publicar o módulo em `sistemas.facom.com.br/{modulo}`.
- Treinamento e desativação gradual do sistema antigo.

## O que preciso de você para começar

1. **Qual aplicação abre a fila?** (protocolo, patrimônio ou chamados)
2. **Se for chamados**: qual dos dois projetos é produção — `chamadorestor` ou `fix-fuse`?
3. **Recorte de histórico**: trazemos tudo, últimos 12 meses ou só estrutura + dados recentes?
4. **Supabase externo**: você já tem conta/projeto criado ou quer que eu guie a criação?
5. **Domínio**: `sistemas.facom.com.br` já está registrado e sob seu controle?

## Entregáveis deste plano

- Documento de arquitetura técnica.
- Scripts de migração de schema e dados.
- Módulo funcional no ERP para a primeira aplicação escolhida.
- Testes E2E de isolamento e RBAC.
- Ambiente publicado em `sistemas.facom.com.br`.
