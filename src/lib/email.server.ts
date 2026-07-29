// Envio de e-mail server-side: provedores, fila e logs.
// Somente servidor (usa service role e segredos).
import {
  htmlParaTexto,
  proximaTentativaEm,
  type EmailProvider,
} from "@/lib/email/providers";

export interface EmailConfigRow {
  empresa_id: string;
  provider: EmailProvider;
  modo: "server_functions" | "edge_function";
  edge_function_name: string | null;
  from_name: string;
  from_email: string | null;
  reply_to: string | null;
  mailgun_domain: string | null;
  ses_region: string | null;
  ativo: boolean;
  max_tentativas: number;
}

export interface CredenciaisRow {
  provider: string;
  api_key: string | null;
  api_secret: string | null;
}

export interface EnvioParams {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
}

export interface EnvioResultado {
  ok: boolean;
  messageId?: string;
  erro?: string;
  status?: number;
}

function remetente(cfg: EmailConfigRow) {
  const email = cfg.from_email?.trim();
  if (!email) throw new Error("E-mail do remetente não configurado.");
  return { email, formatado: `${cfg.from_name || "Sistema"} <${email}>` };
}

async function lerErro(res: Response) {
  try {
    const txt = await res.text();
    return txt.slice(0, 500);
  } catch {
    return `HTTP ${res.status}`;
  }
}

/* ---------------- SES SigV4 ---------------- */

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

async function sha256Hex(data: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function enviarSes(
  cfg: EmailConfigRow,
  cred: CredenciaisRow,
  p: EnvioParams,
): Promise<EnvioResultado> {
  const region = cfg.ses_region?.trim();
  if (!region) return { ok: false, erro: "Região do SES não configurada." };
  if (!cred.api_key || !cred.api_secret) return { ok: false, erro: "Credenciais do SES ausentes." };

  const host = `email.${region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  const from = remetente(cfg);
  const payload = JSON.stringify({
    FromEmailAddress: from.formatado,
    Destination: { ToAddresses: [p.to] },
    ...(cfg.reply_to ? { ReplyToAddresses: [cfg.reply_to] } : {}),
    Content: {
      Simple: {
        Subject: { Data: p.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: p.html, Charset: "UTF-8" },
          Text: { Data: p.text || htmlParaTexto(p.html), Charset: "UTF-8" },
        },
      },
    },
  });

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(payload);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/ses/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;

  let key: ArrayBuffer | Uint8Array = enc.encode(`AWS4${cred.api_secret}`);
  for (const part of [dateStamp, region, "ses", "aws4_request"]) key = await hmac(key, part);
  const signature = hex(await hmac(key, stringToSign));

  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${cred.api_key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: payload,
  });
  if (!res.ok) return { ok: false, status: res.status, erro: await lerErro(res) };
  const json = (await res.json().catch(() => ({}))) as { MessageId?: string };
  return { ok: true, messageId: json.MessageId, status: res.status };
}

/* ---------------- Provedores HTTP ---------------- */

export async function enviarComProvedor(
  cfg: EmailConfigRow,
  cred: CredenciaisRow,
  p: EnvioParams,
): Promise<EnvioResultado> {
  try {
    const texto = p.text || htmlParaTexto(p.html);
    if (cfg.provider === "ses") return await enviarSes(cfg, cred, p);
    if (!cred.api_key) return { ok: false, erro: "API Key do provedor não configurada." };
    const from = remetente(cfg);

    if (cfg.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cred.api_key}` },
        body: JSON.stringify({
          from: from.formatado,
          to: [p.to],
          subject: p.subject,
          html: p.html,
          text: texto,
          ...(cfg.reply_to ? { reply_to: cfg.reply_to } : {}),
        }),
      });
      if (!res.ok) return { ok: false, status: res.status, erro: await lerErro(res) };
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, messageId: json.id, status: res.status };
    }

    if (cfg.provider === "sendgrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cred.api_key}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: p.to }] }],
          from: { email: from.email, name: cfg.from_name || undefined },
          ...(cfg.reply_to ? { reply_to: { email: cfg.reply_to } } : {}),
          subject: p.subject,
          content: [
            { type: "text/plain", value: texto },
            { type: "text/html", value: p.html },
          ],
        }),
      });
      if (!res.ok) return { ok: false, status: res.status, erro: await lerErro(res) };
      return { ok: true, messageId: res.headers.get("x-message-id") ?? undefined, status: res.status };
    }

    if (cfg.provider === "mailgun") {
      const dominio = cfg.mailgun_domain?.trim();
      if (!dominio) return { ok: false, erro: "Domínio do Mailgun não configurado." };
      const body = new URLSearchParams({
        from: from.formatado,
        to: p.to,
        subject: p.subject,
        html: p.html,
        text: texto,
        ...(cfg.reply_to ? { "h:Reply-To": cfg.reply_to } : {}),
      });
      const res = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(dominio)}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`api:${cred.api_key}`)}`,
        },
        body,
      });
      if (!res.ok) return { ok: false, status: res.status, erro: await lerErro(res) };
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, messageId: json.id, status: res.status };
    }

    return { ok: false, erro: `Provedor não suportado: ${cfg.provider}` };
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? "Falha de rede ao chamar o provedor." };
  }
}

/** Opção A: delega o envio a uma Edge Function do Supabase já existente no projeto. */
export async function enviarViaEdgeFunction(
  cfg: EmailConfigRow,
  p: EnvioParams,
): Promise<EnvioResultado> {
  const nome = cfg.edge_function_name?.trim();
  if (!nome) return { ok: false, erro: "Nome da Edge Function não configurado." };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, erro: "Ambiente do backend incompleto." };
  try {
    const res = await fetch(`${url}/functions/v1/${encodeURIComponent(nome)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        to: p.to,
        subject: p.subject,
        html: p.html,
        text: p.text || htmlParaTexto(p.html),
        from: `${cfg.from_name} <${cfg.from_email}>`,
        provider: cfg.provider,
      }),
    });
    if (!res.ok) return { ok: false, status: res.status, erro: await lerErro(res) };
    const json = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string };
    return { ok: true, messageId: json.messageId ?? json.id, status: res.status };
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? "Falha ao chamar a Edge Function." };
  }
}

/* ---------------- Fila ---------------- */

type Admin = any;

export async function registrarLog(
  admin: Admin,
  row: {
    empresa_id: string;
    queue_id?: string | null;
    evento: string;
    provider?: string | null;
    status?: string | null;
    destinatario?: string | null;
    detalhes?: Record<string, unknown>;
  },
) {
  await admin.from("email_logs").insert({
    empresa_id: row.empresa_id,
    queue_id: row.queue_id ?? null,
    evento: row.evento,
    provider: row.provider ?? null,
    status: row.status ?? null,
    destinatario: row.destinatario ?? null,
    detalhes: row.detalhes ?? {},
  });
}

export async function carregarConfig(admin: Admin, empresaId: string) {
  const { data: cfg } = await admin.from("email_config").select("*").eq("empresa_id", empresaId).maybeSingle();
  const { data: cred } = await admin
    .from("email_credentials")
    .select("provider, api_key, api_secret")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return { cfg: cfg as EmailConfigRow | null, cred: (cred as CredenciaisRow | null) ?? { provider: "", api_key: null, api_secret: null } };
}

/** Processa a fila da empresa respeitando tentativas e backoff. */
export async function processarFila(admin: Admin, empresaId: string, limite = 20) {
  const { cfg, cred } = await carregarConfig(admin, empresaId);
  if (!cfg || !cfg.ativo) return { processados: 0, enviados: 0, falhas: 0, motivo: "E-mail desativado." };

  const { data: itens } = await admin
    .from("email_queue")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "pendente")
    .lte("proxima_tentativa_em", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limite);

  let enviados = 0;
  let falhas = 0;
  for (const item of itens ?? []) {
    await admin.from("email_queue").update({ status: "enviando" }).eq("id", item.id);
    const res =
      cfg.modo === "edge_function"
        ? await enviarViaEdgeFunction(cfg, { to: item.destinatario, subject: item.assunto, html: item.corpo_html, text: item.corpo_texto })
        : await enviarComProvedor(cfg, cred, { to: item.destinatario, subject: item.assunto, html: item.corpo_html, text: item.corpo_texto });

    const tentativas = (item.tentativas ?? 0) + 1;
    if (res.ok) {
      enviados++;
      await admin
        .from("email_queue")
        .update({
          status: "enviado",
          tentativas,
          enviado_em: new Date().toISOString(),
          provider: cfg.provider,
          provider_message_id: res.messageId ?? null,
          ultimo_erro: null,
        })
        .eq("id", item.id);
      await registrarLog(admin, {
        empresa_id: empresaId,
        queue_id: item.id,
        evento: "enviado",
        provider: cfg.provider,
        status: "sucesso",
        destinatario: item.destinatario,
        detalhes: { tentativas, message_id: res.messageId ?? null },
      });
    } else {
      falhas++;
      const esgotou = tentativas >= (item.max_tentativas ?? cfg.max_tentativas ?? 5);
      await admin
        .from("email_queue")
        .update({
          status: esgotou ? "falha" : "pendente",
          tentativas,
          proxima_tentativa_em: proximaTentativaEm(tentativas),
          provider: cfg.provider,
          ultimo_erro: res.erro?.slice(0, 500) ?? "Falha desconhecida",
        })
        .eq("id", item.id);
      await registrarLog(admin, {
        empresa_id: empresaId,
        queue_id: item.id,
        evento: esgotou ? "falha_definitiva" : "retentativa_agendada",
        provider: cfg.provider,
        status: "erro",
        destinatario: item.destinatario,
        detalhes: { tentativas, http_status: res.status ?? null, erro: res.erro ?? null },
      });
    }
  }
  return { processados: itens?.length ?? 0, enviados, falhas };
}
