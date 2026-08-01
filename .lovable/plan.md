# Plano de Correção de Segurança e Auditoria de Acesso

Este plano visa corrigir as vulnerabilidades identificadas na auditoria de acesso do sistema RDO, garantindo integridade, confidencialidade e conformidade com as melhores práticas de segurança.

## Falhas Críticas e Ações Imediatas

### 1. Proteção de Webhooks e Endpoints Públicos
- **Problema**: O endpoint de backup utiliza a chave pública do Supabase para autenticação, o que permite disparos não autorizados.
- **Correção**: 
    - Criar a variável de ambiente `BACKUP_HOOK_SECRET`.
    - Atualizar `src/routes/api.public.hooks.backup.ts` para validar o header `apikey` contra este segredo usando comparação em tempo constante (`timingSafeEqual`).
    - Atualizar a configuração do `pg_cron` no banco de dados para enviar o novo segredo.

### 2. Blindagem de Server Functions (RBAC)
- **Problema**: Uso excessivo de `supabaseAdmin` sem validação prévia de permissões do usuário em funções de servidor.
- **Correção**:
    - Implementar um middleware ou helper `validarPermissao(recurso, acao)` em `src/lib/security/permissao.server.ts`.
    - Integrar esta validação em todas as funções de `src/lib/*.functions.ts` que realizam operações de escrita ou acessam dados administrativos (Backup, Configurações, Usuários).
    - Substituir o uso de `supabaseAdmin` por `context.supabase` (com RLS) sempre que possível, reservando o cliente admin apenas para tarefas de infraestrutura estritamente necessárias.

### 3. Prevenção de CSRF e Segurança de Transporte
- **Problema**: Risco potencial de CSRF em server functions se cookies de sessão forem usados indevidamente.
- **Correção**:
    - Configurar explicitamente a política de CORS e Headers de Segurança em `src/start.ts`.
    - Garantir que todas as requisições sensíveis exijam o cabeçalho `Authorization` Bearer, que não é enviado automaticamente pelo navegador em ataques de cross-site.

### 4. Sanitização de Logs e Metadados
- **Problema**: Logs de diagnóstico do OneDrive podem expor caminhos e IDs internos.
- **Correção**:
    - Alterar `src/lib/onedrive-gateway.server.ts` e `src/routes/api.integracoes.onedrive.status.ts` para filtrar caminhos completos e IDs de drive antes de enviar a resposta ao cliente.

## Cronograma de Execução
1. **Fase 1**: Migração de banco para novos grants e configuração de segredos de ambiente.
2. **Fase 2**: Refatoração das Server Functions com guards de permissão.
3. **Fase 3**: Validação final via auditoria automatizada e testes E2E de isolamento.

---
*Este documento é parte integrante do esforço contínuo de segurança do projeto Strata Journal.*
