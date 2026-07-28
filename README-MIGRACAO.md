# Migração — Lovable Cloud → Supabase Externo

Passo a passo para mover **schema, dados, storage e auth** deste projeto para um novo projeto Supabase que você mesmo administra.

> Tempo estimado: 45–90 min (depende do volume de storage).
> Requer: acesso ao painel do novo projeto Supabase, `psql`, `pg_dump`, Node 18+ e as chaves `service_role` dos dois projetos.

---

## 0. Checklist antes de começar

- [ ] Novo projeto criado em https://supabase.com/dashboard (mesma região, se possível).
- [ ] Copiados do novo projeto: **Project URL**, **anon key**, **service_role key**, **DB connection string** (pooler + direto).
- [ ] Copiada do projeto **antigo** (Lovable Cloud): a `service_role` key — solicitada via suporte se não estiver visível.
- [ ] Backup baixado do painel do Lovable (Cloud → Advanced → Export data), como segurança extra.
- [ ] Janela de manutenção comunicada (login ficará indisponível enquanto o DNS/env aponta para o novo backend).

---

## 1. Dump do schema + dados

Rode no seu terminal (não no sandbox do Lovable):

```bash
# do projeto ANTIGO — string "connection direta" (não o pooler)
export OLD_DB="postgresql://postgres:<SENHA>@db.<REF_ANTIGO>.supabase.co:5432/postgres"

# schema
pg_dump "$OLD_DB" \
  --schema=public --schema-only --no-owner --no-privileges \
  --file=01_schema.sql

# dados
pg_dump "$OLD_DB" \
  --schema=public --data-only --disable-triggers --no-owner \
  --file=02_data.sql

# usuários do auth (apenas a tabela auth.users; senhas ficam hashed)
pg_dump "$OLD_DB" \
  --table=auth.users --data-only --no-owner \
  --file=03_auth_users.sql
```

> Boa prática: versionar `01_schema.sql` em `scripts/migracao/dumps/` (não commitar `02_data.sql` se contiver PII).

---

## 2. Restore no novo projeto

```bash
export NEW_DB="postgresql://postgres:<SENHA>@db.<REF_NOVO>.supabase.co:5432/postgres"

psql "$NEW_DB" -v ON_ERROR_STOP=1 -f 01_schema.sql
psql "$NEW_DB" -v ON_ERROR_STOP=1 -f 03_auth_users.sql
psql "$NEW_DB" -v ON_ERROR_STOP=1 -f 02_data.sql
```

Erros comuns e o que fazer:

| Erro | Correção |
|------|----------|
| `permission denied for schema auth` | Rodar o import de `auth.users` conectado como `postgres`, não `authenticated`. |
| `duplicate key value violates ... auth.users_email_key` | O trigger `handle_new_user` está criando profile duplicado — desabilite o trigger antes: `ALTER TABLE auth.users DISABLE TRIGGER ALL;` depois `ENABLE TRIGGER ALL;`. |
| `relation "storage.objects" does not exist` | Rodou dump de `storage` — refaça o dump apenas com `--schema=public`. |
| `role "authenticated" does not exist` | Novo projeto ainda não inicializou roles do Supabase — abra o SQL Editor 1x para inicializar. |

---

## 3. Recriar o trigger de novos usuários

O dump do `public` traz a função, mas o gatilho em `auth.users` precisa ser recriado:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 4. Copiar os buckets de storage

Os 3 buckets deste projeto são `rdo-anexos`, `empresa-logos`, `obra-fotos` — todos **privados**. Use o script pronto:

```bash
cd scripts/migracao

SRC_URL="https://<REF_ANTIGO>.supabase.co" \
SRC_KEY="<service_role_antigo>" \
DST_URL="https://<REF_NOVO>.supabase.co" \
DST_KEY="<service_role_novo>" \
CONCURRENCY=6 \
node copiar-buckets.mjs
```

Flags úteis:

- `DRY_RUN=1` — apenas lista, não copia.
- `BUCKETS="rdo-anexos"` — restringe a um bucket.

O script:
- cria o bucket no destino se não existir (privado);
- baixa cada objeto do antigo e sobe no novo (`upsert: true`);
- ao final imprime **origem × destino × copiados × falhas × faltando** por bucket;
- exit code `2` se qualquer falha ou objeto faltando.

---

## 5. Validação pós-migração

Abra o SQL Editor no NOVO projeto e rode:

```
scripts/migracao/validacao-pos-migracao.sql
```

Verifique cada bloco:

1. **Contagens por tabela** iguais no antigo e novo.
2. **Tabelas sem RLS** → deve vir vazio.
3. **Tabelas sem policies** → deve vir vazio.
4. **GRANTs** → `authenticated` com SELECT/INSERT nas tabelas do produto; `service_role` com SELECT em todas.
5. **Enums** → todos os `app_*`, `rdo_status`, `clima`, etc. presentes.
6. **Funções críticas** presentes e com `SECURITY DEFINER` onde esperado (`has_role`, `check_rate_limit`, `admin_soft_delete_rdo`, ...).
7. **Trigger `on_auth_user_created`** ligado.
8. **Órfãos** → todas as contagens devem ser 0.
9. **Buckets** → 3 buckets, `public=false`, contagem de objetos igual à do antigo.
10. **Anexos órfãos** → todas as contagens devem ser 0. Se não estiverem, rode `copiar-buckets.mjs` de novo (é idempotente).

---

## 6. Teste ponta a ponta no app

1. Ajuste o `.env` local para o novo projeto:
   ```
   VITE_SUPABASE_URL=https://<REF_NOVO>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon_novo>
   VITE_SUPABASE_PROJECT_ID=<REF_NOVO>
   SUPABASE_URL=https://<REF_NOVO>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role_novo>
   SUPABASE_PUBLISHABLE_KEY=<anon_novo>
   ```
2. `bun run dev` e faça login com um usuário existente (a senha continua válida, pois `auth.users` foi migrado com o hash).
3. Abra um RDO com anexos → **as miniaturas precisam carregar**. Se aparecerem quebradas: bloco 10 da validação e/ou policies de `storage.objects`.
4. Crie um RDO novo, faça upload de foto, aprove e exporte PDF/Excel.
5. Confira `dashboard`, `configuracoes/usuarios` (logs de auditoria) e `configuracoes/lgpd`.

---

## 7. Corte de produção (Hostinger / domínio)

1. Atualize as variáveis de ambiente no Hostinger com as novas chaves.
2. Faça deploy.
3. Teste login em produção com um usuário real.
4. Só então **pause** o Cloud antigo (`Backend → Cloud → Pause`). Não delete por 30 dias — janela de rollback.

---

## 8. Rollback rápido

Se algo falhar em produção, reverter as env vars para as chaves antigas restaura tudo em <2 min — enquanto o Cloud antigo estiver ativo. Por isso a etapa 7 pede para não deletar imediatamente.

---

## Boas práticas

- **Nunca** rode `pg_dump --clean --if-exists` contra o novo projeto — apagaria `auth`, `storage`, `realtime`.
- **Não** dumpe os schemas `auth`, `storage`, `realtime`, `supabase_functions`, `vault` — são gerenciados pelo Supabase.
- Rode o `copiar-buckets.mjs` com `DRY_RUN=1` primeiro para dimensionar volume.
- Após a migração, **rotacione** a `service_role` antiga (Cloud → Settings → API → Rotate).
- Mantenha `01_schema.sql` versionado como referência da estrutura no momento do corte.
