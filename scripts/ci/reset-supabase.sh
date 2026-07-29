#!/usr/bin/env bash
# Reseta o banco Supabase isolado usado pelos testes E2E.
#
# Uso local:   ./scripts/ci/reset-supabase.sh
# Uso no CI:   chamado pelo workflow .github/workflows/e2e-rls.yml
#
# Requer o Supabase CLI (`supabase`) e Docker disponíveis. O reset aplica
# TODAS as migrations de supabase/migrations em um banco limpo, garantindo que
# cada suíte E2E rode contra um estado determinístico (sem dados residuais de
# execuções anteriores, que mascarariam falhas de RLS).
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "==> Parando instância anterior (se houver)"
supabase stop --no-backup >/dev/null 2>&1 || true

echo "==> Subindo Supabase local isolado"
supabase start

echo "==> Resetando banco e reaplicando migrations"
supabase db reset --no-seed

echo "==> Aguardando API responder"
API_URL="$(supabase status -o json | python3 -c 'import json,sys;print(json.load(sys.stdin)["API_URL"])')"
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "${API_URL}/rest/v1/" -H "apikey: $(supabase status -o json | python3 -c 'import json,sys;print(json.load(sys.stdin)["ANON_KEY"])')"; then
    break
  fi
  sleep 2
done

echo "==> Banco pronto em ${API_URL}"
