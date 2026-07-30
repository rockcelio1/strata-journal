import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const onedriveStatusPessoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { statusPessoal } = await import("@/lib/onedrive-appuser.server");
    return statusPessoal(context.userId);
  });

export const onedriveIniciarLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { iniciarLogin } = await import("@/lib/onedrive-appuser.server");
    const request = getRequest();
    if (!request) throw new Error("O login precisa ser iniciado a partir do aplicativo.");
    return iniciarLogin(context.userId, request.url);
  });

export const onedriveConcluirLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string }) => z.object({ code: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { concluirLogin } = await import("@/lib/onedrive-appuser.server");
    return concluirLogin(context.userId, data.code);
  });

export const onedriveDesconectarPessoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { desconectar } = await import("@/lib/onedrive-appuser.server");
    return desconectar(context.userId);
  });

export const onedriveListarPessoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { pasta?: string }) => z.object({ pasta: z.string().max(400).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { listarArquivos } = await import("@/lib/onedrive-appuser.server");
    return listarArquivos(context.userId, data.pasta ?? "");
  });

export const onedriveEnviarPessoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { pasta?: string; nome: string; conteudoBase64: string; contentType?: string }) =>
    z
      .object({
        pasta: z.string().max(400).optional(),
        nome: z.string().min(1).max(255),
        conteudoBase64: z.string().min(1),
        contentType: z.string().max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { enviarArquivo } = await import("@/lib/onedrive-appuser.server");
    return enviarArquivo(context.userId, data.pasta ?? "", data.nome, data.conteudoBase64, data.contentType ?? "");
  });

export const onedriveLinkDownloadPessoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { itemId: string }) => z.object({ itemId: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { linkDownload } = await import("@/lib/onedrive-appuser.server");
    return linkDownload(context.userId, data.itemId);
  });
