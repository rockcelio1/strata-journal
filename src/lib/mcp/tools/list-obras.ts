import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_obras",
  title: "Listar obras",
  description: "Lista as obras da empresa do usuário autenticado, ordenadas pelas mais recentes.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de obras a retornar (padrão 50)."),
    status: z
      .enum(["planejamento", "em_andamento", "pausada", "concluida"])
      .optional()
      .describe("Filtrar por status da obra."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("obras")
      .select("id, nome, codigo, cliente, status, avanco_pct, data_inicio, data_previsao_fim")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { obras: data ?? [] },
    };
  },
});
