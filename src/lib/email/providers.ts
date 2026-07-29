// Catálogo de provedores de e-mail suportados + construção das requisições HTTP.
// Arquivo puro (sem segredos): pode ser importado no cliente para exibir requisitos.

export type EmailProvider = "resend" | "sendgrid" | "mailgun" | "ses";
export type EmailModo = "server_functions" | "edge_function";

export interface ProviderFieldSpec {
  key: "api_key" | "api_secret" | "mailgun_domain" | "ses_region";
  label: string;
  descricao: string;
  obrigatorio: boolean;
  secreto: boolean;
}

export interface ProviderSpec {
  id: EmailProvider;
  nome: string;
  descricao: string;
  docsUrl: string;
  campos: ProviderFieldSpec[];
  requisitos: string[];
}

const CAMPO_API_KEY: ProviderFieldSpec = {
  key: "api_key",
  label: "API Key",
  descricao: "Chave de API gerada no painel do provedor.",
  obrigatorio: true,
  secreto: true,
};

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "resend",
    nome: "Resend",
    descricao: "Mais simples de configurar. Ideal para transacionais.",
    docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
    campos: [CAMPO_API_KEY],
    requisitos: [
      "Conta no Resend com um domínio verificado (SPF + DKIM).",
      "API Key com permissão de envio (começa com re_).",
      "Remetente usando o domínio verificado.",
    ],
  },
  {
    id: "sendgrid",
    nome: "SendGrid",
    descricao: "Alto volume, estatísticas detalhadas.",
    docsUrl: "https://www.twilio.com/docs/sendgrid/api-reference/mail-send",
    campos: [CAMPO_API_KEY],
    requisitos: [
      "Conta SendGrid com Domain Authentication concluída.",
      "API Key com escopo Mail Send (começa com SG.).",
      "Remetente verificado (Single Sender ou domínio).",
    ],
  },
  {
    id: "mailgun",
    nome: "Mailgun",
    descricao: "Bom custo-benefício e ótimo log de entregas.",
    docsUrl: "https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/",
    campos: [
      CAMPO_API_KEY,
      {
        key: "mailgun_domain",
        label: "Domínio Mailgun",
        descricao: "Ex.: mg.suaempresa.com.br",
        obrigatorio: true,
        secreto: false,
      },
    ],
    requisitos: [
      "Domínio adicionado e verificado no Mailgun.",
      "Private API Key da conta.",
      "Região correta (a integração usa a API global api.mailgun.net).",
    ],
  },
  {
    id: "ses",
    nome: "AWS SES",
    descricao: "Menor custo em grande volume. Requer conta AWS.",
    docsUrl: "https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html",
    campos: [
      { ...CAMPO_API_KEY, label: "Access Key ID", descricao: "Credencial IAM (AKIA...)", secreto: true },
      {
        key: "api_secret",
        label: "Secret Access Key",
        descricao: "Segredo da credencial IAM.",
        obrigatorio: true,
        secreto: true,
      },
      {
        key: "ses_region",
        label: "Região",
        descricao: "Ex.: us-east-1, sa-east-1",
        obrigatorio: true,
        secreto: false,
      },
    ],
    requisitos: [
      "Identidade (domínio ou e-mail) verificada no SES.",
      "Conta fora do sandbox para enviar a qualquer destinatário.",
      "Usuário IAM com permissão ses:SendEmail.",
    ],
  },
];

export function getProviderSpec(id: EmailProvider): ProviderSpec {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export const TEMPLATE_CHAVES = [
  { chave: "convite", nome: "Convite de usuário", vars: ["nome", "empresa", "link", "role"] },
  { chave: "notificacao", nome: "Notificação do sistema", vars: ["nome", "titulo", "mensagem", "link"] },
  { chave: "recuperacao_senha", nome: "Recuperação de senha", vars: ["nome", "link"] },
] as const;

export type TemplateChave = (typeof TEMPLATE_CHAVES)[number]["chave"];

/** Substitui {{var}} pelos valores informados, escapando HTML. */
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : escapeHtml(String(v));
  });
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlParaTexto(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Backoff exponencial (minutos) para retentativas. */
export function proximaTentativaEm(tentativas: number, agora = Date.now()) {
  const minutos = Math.min(60, Math.pow(2, Math.max(0, tentativas - 1)));
  return new Date(agora + minutos * 60_000).toISOString();
}

function layout(titulo: string, corpo: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px">
    <h1 style="font-size:20px;margin:0 0 16px">${titulo}</h1>
    ${corpo}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 12px" />
    <p style="font-size:12px;color:#6b7280;margin:0">Mensagem automática — não responda este e-mail.</p>
  </div></body></html>`;
}

const BOTAO = (link: string, texto: string) =>
  `<p style="margin:24px 0"><a href="${link}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">${texto}</a></p>`;

export const TEMPLATES_PADRAO: Record<
  TemplateChave,
  { nome: string; assunto: string; corpo_html: string }
> = {
  convite: {
    nome: "Convite de usuário",
    assunto: "Você foi convidado para {{empresa}}",
    corpo_html: layout(
      "Convite para {{empresa}}",
      `<p>Olá {{nome}},</p><p>Você foi convidado para acessar o sistema da empresa <strong>{{empresa}}</strong> com o perfil <strong>{{role}}</strong>.</p>${BOTAO("{{link}}", "Aceitar convite")}<p style="font-size:13px;color:#6b7280">Se o botão não funcionar, copie e cole: {{link}}</p>`,
    ),
  },
  notificacao: {
    nome: "Notificação do sistema",
    assunto: "{{titulo}}",
    corpo_html: layout(
      "{{titulo}}",
      `<p>Olá {{nome}},</p><p>{{mensagem}}</p>${BOTAO("{{link}}", "Abrir no sistema")}`,
    ),
  },
  recuperacao_senha: {
    nome: "Recuperação de senha",
    assunto: "Redefinição de senha",
    corpo_html: layout(
      "Redefinir senha",
      `<p>Olá {{nome}},</p><p>Recebemos um pedido para redefinir sua senha. O link expira em 1 hora.</p>${BOTAO("{{link}}", "Redefinir senha")}<p style="font-size:13px;color:#6b7280">Se você não solicitou, ignore este e-mail.</p>`,
    ),
  },
};
