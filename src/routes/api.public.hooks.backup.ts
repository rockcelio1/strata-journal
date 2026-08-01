// Endpoint público chamado por pg_cron. Executa os agendamentos vencidos:
// para cada schedule ativo cujo próximo horário já passou, exporta as tabelas
// selecionadas em JSON, salva no bucket system-backups com retenção e registra
// no histórico. Notifica autor e admins da empresa.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { exigirSegredoWebhook } = await import("@/lib/security/webhook.server");
        try {
          exigirSegredoWebhook(request, "BACKUP_HOOK_SECRET");
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();

        // Busca agendamentos ativos elegíveis (proxima_execucao <= now OR nula)
        const { data: schedules, error: schedErr } = await supabaseAdmin
          .from("backup_schedules")
          .select("*")
          .eq("ativo", true);
        if (schedErr) return new Response(JSON.stringify({ error: schedErr.message }), { status: 500 });

        const results: any[] = [];
        for (const s of schedules ?? []) {
          const eligible = !s.proxima_execucao || new Date(s.proxima_execucao) <= now;
          if (!eligible) continue;
          const started = Date.now();
          try {
            // Coleta dados por grupo (mesma lógica do exportBackup, escopada por empresa)
            const { BACKUP_GROUPS } = await import("@/lib/backup.functions");
            const selected = BACKUP_GROUPS.filter((g: any) => s.grupos.includes(g.key));
            const payload: Record<string, any[]> = {};
            for (const group of selected) {
              for (const table of group.tables) {
                let q: any = (supabaseAdmin as any).from(table).select("*");
                q = table === "empresas" ? q.eq("id", s.empresa_id) : q.eq("empresa_id", s.empresa_id);
                const { data: rows } = await q;
                payload[table] = rows ?? [];
              }
            }
            // Manifest de buckets (sem baixar arquivos)
            const buckets: Record<string, { count: number; total_bytes: number }> = {};
            for (const b of s.buckets ?? []) {
              try {
                const list = await supabaseAdmin.storage.from(b).list(s.empresa_id, { limit: 1000 });
                const files = list.data ?? [];
                buckets[b] = {
                  count: files.filter((f: any) => f.id !== null).length,
                  total_bytes: files.reduce((sum: number, f: any) => sum + ((f.metadata?.size as number) ?? 0), 0),
                };
              } catch {
                buckets[b] = { count: 0, total_bytes: 0 };
              }
            }
            const totals = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v.length]));
            const doc = {
              meta: {
                version: 1,
                empresa_id: s.empresa_id,
                generated_at: now.toISOString(),
                generated_by: "scheduler",
                schedule_id: s.id,
                schedule_name: s.nome,
                groups: s.grupos,
                buckets_included: s.buckets,
                totals,
              },
              tables: payload,
              buckets,
            };
            const body = new TextEncoder().encode(JSON.stringify(doc));
            const path = `${s.empresa_id}/agendado/${now.toISOString().slice(0, 10)}-${s.id.slice(0, 8)}.json`;
            const { error: upErr } = await supabaseAdmin.storage
              .from("system-backups")
              .upload(path, body, { contentType: "application/json", upsert: true });
            if (upErr) throw upErr;

            // Retenção: apaga backups agendados anteriores ao horizonte
            const cutoff = new Date(now.getTime() - s.retencao_dias * 86400000).toISOString();
            const { data: oldRows } = await supabaseAdmin
              .from("backup_history")
              .select("id, arquivo_path")
              .eq("schedule_id", s.id)
              .eq("origem", "agendado")
              .lt("created_at", cutoff);
            const oldPaths = (oldRows ?? []).map((r: any) => r.arquivo_path).filter(Boolean);
            if (oldPaths.length) {
              await supabaseAdmin.storage.from("system-backups").remove(oldPaths);
              await supabaseAdmin.from("backup_history").delete().in("id", (oldRows ?? []).map((r: any) => r.id));
            }

            // Próxima execução
            const next = computeNext(s, now);
            await supabaseAdmin.from("backup_schedules").update({
              ultima_execucao: now.toISOString(),
              proxima_execucao: next.toISOString(),
            }).eq("id", s.id);

            // Histórico
            await supabaseAdmin.from("backup_history").insert({
              empresa_id: s.empresa_id,
              autor_id: null,
              autor_email: "sistema (agendado)",
              operacao: "backup",
              origem: "agendado",
              schedule_id: s.id,
              grupos_selecionados: s.grupos,
              buckets_selecionados: s.buckets,
              criptografado: false,
              contagens: { totals, buckets },
              resultado: "sucesso",
              mensagem: `Backup agendado "${s.nome}" concluído.`,
              arquivo_path: path,
              arquivo_tamanho_bytes: body.byteLength,
              duracao_ms: Date.now() - started,
            });

            // Notificações para admins
            const { data: admins } = await supabaseAdmin
              .from("user_roles")
              .select("user_id")
              .eq("empresa_id", s.empresa_id)
              .in("role", ["admin", "master"]);
            if (admins?.length) {
              await supabaseAdmin.from("notificacoes").insert(
                admins.map((a: any) => ({
                  empresa_id: s.empresa_id,
                  user_id: a.user_id,
                  tipo: "backup_concluido",
                  titulo: `Backup agendado concluído: ${s.nome}`,
                  mensagem: `Arquivo salvo em system-backups (${(body.byteLength / 1024).toFixed(1)} KB).`,
                })),
              );
            }

            results.push({ schedule: s.id, ok: true, path, duration_ms: Date.now() - started });
          } catch (e: any) {
            await supabaseAdmin.from("backup_history").insert({
              empresa_id: s.empresa_id,
              autor_email: "sistema (agendado)",
              operacao: "backup",
              origem: "agendado",
              schedule_id: s.id,
              grupos_selecionados: s.grupos,
              buckets_selecionados: s.buckets,
              contagens: {},
              resultado: "erro",
              mensagem: e.message ?? String(e),
              duracao_ms: Date.now() - started,
            });
            const { data: admins } = await supabaseAdmin
              .from("user_roles")
              .select("user_id")
              .eq("empresa_id", s.empresa_id)
              .in("role", ["admin", "master"]);
            if (admins?.length) {
              await supabaseAdmin.from("notificacoes").insert(
                admins.map((a: any) => ({
                  empresa_id: s.empresa_id,
                  user_id: a.user_id,
                  tipo: "backup_falha",
                  titulo: `Falha em backup agendado: ${s.nome}`,
                  mensagem: (e.message ?? String(e)).slice(0, 500),
                })),
              );
            }
            results.push({ schedule: s.id, ok: false, error: e.message ?? String(e) });
          }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

function computeNext(s: any, from: Date): Date {
  const d = new Date(from);
  d.setUTCHours(s.hora_utc, 0, 0, 0);
  if (s.frequencia === "diario") {
    if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (s.frequencia === "semanal") {
    const target = s.dia_semana ?? 0;
    const diff = (target - d.getUTCDay() + 7) % 7;
    d.setUTCDate(d.getUTCDate() + (diff === 0 && d <= from ? 7 : diff));
    return d;
  }
  // mensal
  const target = s.dia_mes ?? 1;
  d.setUTCDate(target);
  if (d <= from) d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
