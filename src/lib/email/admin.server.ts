// Helpers server-only para as server functions de e-mail.
import {
  TEMPLATES_PADRAO,
  TEMPLATE_CHAVES,
  renderTemplate,
  htmlParaTexto,
  isEmailValido,
  type TemplateChave,
} from "@/lib/email/providers";

/** Garante que o usuário é admin/master e devolve a empresa dele. */
export async function assertAdminEmpresa(supabase: any, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível validar seu perfil.");
  if (!profile?.empresa_id) throw new Error("Empresa não encontrada para o usuário.");

  const [{ data: isAdmin }, { data: isMaster }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "master" }),
  ]);
  if (!isAdmin && !isMaster) throw new Error("Apenas administrador ou master podem gerenciar e-mails.");
  return profile.empresa_id as string;
}

export function mascarar(valor?: string | null) {
  if (!valor) return null;
  if (valor.length <= 8) return "••••";
  return `${valor.slice(0, 4)}••••${valor.slice(-4)}`;
}

/** Cria os templates padrão que ainda não existem para a empresa. */
export async function garantirTemplatesPadrao(admin: any, empresaId: string) {
  const { data: existentes } = await admin
    .from("email_templates")
    .select("chave")
    .eq("empresa_id", empresaId);
  const jaTem = new Set((existentes ?? []).map((t: any) => t.chave));
  const novos = TEMPLATE_CHAVES.filter((t) => !jaTem.has(t.chave)).map((t) => {
    const padrao = TEMPLATES_PADRAO[t.chave as TemplateChave];
    return {
      empresa_id: empresaId,
      chave: t.chave,
      nome: padrao.nome,
      assunto: padrao.assunto,
      corpo_html: padrao.corpo_html,
      corpo_texto: htmlParaTexto(padrao.corpo_html),
      ativo: true,
    };
  });
  if (novos.length) await admin.from("email_templates").insert(novos);
  return novos.length;
}

/** Monta assunto/HTML a partir do template salvo (ou do padrão). */
export async function montarMensagem(
  admin: any,
  empresaId: string,
  chave: string,
  vars: Record<string, string | number | null | undefined>,
) {
  const { data: tpl } = await admin
    .from("email_templates")
    .select("assunto, corpo_html, corpo_texto, ativo")
    .eq("empresa_id", empresaId)
    .eq("chave", chave)
    .maybeSingle();

  const padrao = TEMPLATES_PADRAO[chave as TemplateChave];
  const assunto = renderTemplate(tpl?.assunto ?? padrao?.assunto ?? "Notificação", vars);
  const html = renderTemplate(tpl?.corpo_html ?? padrao?.corpo_html ?? "<p>{{mensagem}}</p>", vars);
  return { assunto, html, texto: htmlParaTexto(html), ativo: tpl?.ativo ?? true };
}

/** Insere na fila (idempotente por chave). */
export async function enfileirar(
  admin: any,
  row: {
    empresa_id: string;
    template_chave?: string | null;
    destinatario: string;
    assunto: string;
    corpo_html: string;
    corpo_texto?: string | null;
    idempotency_key?: string | null;
    created_by?: string | null;
    max_tentativas?: number;
  },
) {
  if (!isEmailValido(row.destinatario)) throw new Error("Destinatário inválido.");
  const { data, error } = await admin
    .from("email_queue")
    .upsert(
      {
        empresa_id: row.empresa_id,
        template_chave: row.template_chave ?? null,
        destinatario: row.destinatario.trim().toLowerCase(),
        assunto: row.assunto.slice(0, 300),
        corpo_html: row.corpo_html,
        corpo_texto: row.corpo_texto ?? null,
        idempotency_key: row.idempotency_key ?? null,
        created_by: row.created_by ?? null,
        max_tentativas: row.max_tentativas ?? 5,
        status: "pendente",
        proxima_tentativa_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id,idempotency_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}
