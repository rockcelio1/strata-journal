import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "./security/permissao.server";
import { getDownloadUrl, listChildren, uploadContent, OneDriveError } from "@/lib/onedrive-graph";
import {
  DIAG_MAX,
  GATEWAY_URL,
  MESES_PT,
  getDiag,
  encodePath,
  falhaOneDrive,
  fetcherGateway,
  gatewayFetch,
  getKeys,
  parseGraphError,
  slugSegment,
} from "@/lib/onedrive-gateway.server";


export const getOneDriveDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "integracoes.onedrive", "ver");
    return { gatewayUrl: GATEWAY_URL, entries: getDiag().slice(0, DIAG_MAX) };
  });

export const getOneDriveQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "integracoes.onedrive", "ver");
    try {
      const res = await gatewayFetch("/drive?$select=quota,webUrl", undefined, 2, "quota");
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const requestId = res.headers.get("request-id");
        return { ok: false as const, error: parseGraphError(res.status, body, "quota", `${GATEWAY_URL}/drive`, requestId) };
      }
      const j = await res.json() as { webUrl?: string; quota?: { total?: number; used?: number; remaining?: number; deleted?: number; state?: string } };
      const q = j.quota ?? {};
      return {
        ok: true as const,
        webUrl: j.webUrl ?? null,
        total: Number(q.total ?? 0),
        used: Number(q.used ?? 0),
        remaining: Number(q.remaining ?? 0),
        deleted: Number(q.deleted ?? 0),
        state: q.state ?? null,
      };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Erro" };
    }
  });

export const verifyOneDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "integracoes.onedrive", "ver");
    try {
      const { statusIntegracao } = await import("@/lib/onedrive-app.server");
      const st = await statusIntegracao();
      if (!st.configured || st.token !== "ok" || st.drive !== "ok") {
        return { ok: false as const, status: 0, error: st.message ?? "Integração OneDrive indisponível." };
      }
      const res = await gatewayFetch("/drive?$select=id,name,owner,webUrl", undefined, 2, "verify");
      const j = (await res.json()) as { id?: string; owner?: { user?: { displayName?: string } } };
      return {
        ok: true as const,
        account: {
          id: j.id ?? null,
          displayName: j.owner?.user?.displayName ?? "Conta técnica do RDO",
          email: st.targetUser,
        },
      };
    } catch (e: any) {
      console.error("[onedrive] verify falhou:", e?.message);
      return { ok: false as const, status: 0, error: e?.message ?? "Erro desconhecido" };
    }
  });

export const listOneDriveFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path?: string } | undefined) => z.object({ path: z.string().max(400).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const path = (data.path ?? "").replace(/^\/+|\/+$/g, "");
    const url = path
      ? `/drive/root:/${encodePath(path)}:/children?$select=id,name,folder,parentReference&$top=200`
      : `/drive/root/children?$select=id,name,folder,parentReference&$top=200`;
    const res = await gatewayFetch(url, undefined, 2, "listFolders");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const requestId = res.headers.get("request-id");
      throw new Error(parseGraphError(res.status, body, "listFolders", `${GATEWAY_URL}${url}`, requestId));
    }
    const json = await res.json() as { value: Array<{ id: string; name: string; folder?: { childCount: number } }> };
    const folders = (json.value ?? []).filter((it) => it.folder).map((it) => ({
      id: it.id, name: it.name, childCount: it.folder?.childCount ?? 0,
    }));
    return { path, folders, debug: { url: `${GATEWAY_URL}${url}` } };
  });

export const ensureOneDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1).max(400) }).parse(d))
  .handler(async ({ context, data }) => {
    const { exigirEscrita } = await import("@/lib/onedrive-permissoes.server");
    await exigirEscrita(context.supabase, context.userId);
    const clean = data.path.replace(/^\/+|\/+$/g, "");
    if (!clean) return { ok: false as const, status: 400, error: "Caminho vazio" };

    // 1) Já existe?
    const getUrl = `/drive/root:/${encodePath(clean)}?$select=id,name,folder`;
    const getRes = await gatewayFetch(getUrl, undefined, 2, "ensureFolder:get");
    if (getRes.ok) {
      const item = await getRes.json() as { id: string; name: string; folder?: unknown };
      if (!item.folder) return { ok: false as const, status: 409, error: `"${clean}" existe mas não é uma pasta` };
      return { ok: true as const, id: item.id, name: item.name, path: clean, created: false };
    }
    if (getRes.status !== 404) {
      const body = await getRes.text().catch(() => "");
      const requestId = getRes.headers.get("request-id");
      return { ok: false as const, status: getRes.status, error: parseGraphError(getRes.status, body, "ensureFolder:get", `${GATEWAY_URL}${getUrl}`, requestId) };
    }

    // 2) Não existe → cria recursivamente, segmento a segmento
    const segments = clean.split("/").filter(Boolean);
    let parentPath = "";
    let lastItem: { id: string; name: string } | null = null;
    for (const seg of segments) {
      const currentPath = parentPath ? `${parentPath}/${seg}` : seg;
      const checkUrl = `/drive/root:/${encodePath(currentPath)}?$select=id,name,folder`;
      const checkRes = await gatewayFetch(checkUrl, undefined, 2, "ensureFolder:check");
      if (checkRes.ok) {
        const item = await checkRes.json() as { id: string; name: string; folder?: unknown };
        if (!item.folder) return { ok: false as const, status: 409, error: `"${currentPath}" existe mas não é uma pasta` };
        lastItem = { id: item.id, name: item.name };
      } else if (checkRes.status === 404) {
        const createUrl = parentPath
          ? `/drive/root:/${encodePath(parentPath)}:/children`
          : `/drive/root/children`;
        const createRes = await gatewayFetch(createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: seg, folder: {}, "@microsoft.graph.conflictBehavior": "replace" }),
        }, 2, "ensureFolder:create");
        if (!createRes.ok) {
          const body = await createRes.text().catch(() => "");
          const requestId = createRes.headers.get("request-id");
          return { ok: false as const, status: createRes.status, error: parseGraphError(createRes.status, body, "ensureFolder:create", `${GATEWAY_URL}${createUrl}`, requestId) };
        }
        const item = await createRes.json() as { id: string; name: string };
        lastItem = { id: item.id, name: item.name };
      } else {
        const body = await checkRes.text().catch(() => "");
        const requestId = checkRes.headers.get("request-id");
        return { ok: false as const, status: checkRes.status, error: parseGraphError(checkRes.status, body, "ensureFolder:check", `${GATEWAY_URL}${checkUrl}`, requestId) };
      }
      parentPath = currentPath;
    }
    return { ok: true as const, id: lastItem!.id, name: lastItem!.name, path: clean, created: true };
  });

export const testOneDrivePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1).max(400) }).parse(d))
  .handler(async ({ data }) => {
    const path = data.path.replace(/^\/+|\/+$/g, "");
    const log: Array<{ step: string; ok: boolean; detail?: string }> = [];

    const exists = await gatewayFetch(`/drive/root:/${encodePath(path)}?$select=id,folder`, undefined, 2, "test:exists");
    if (exists.status === 404) {
      log.push({ step: "Pasta existe", ok: false, detail: `Não encontrada (404, request-id: ${exists.headers.get("request-id") ?? "n/a"})` });
      return { ok: false as const, log };
    }
    if (!exists.ok) {
      const b = await exists.text().catch(() => "");
      log.push({ step: "Pasta existe", ok: false, detail: parseGraphError(exists.status, b, "test:exists", `${GATEWAY_URL}/drive/root:/${encodePath(path)}`, exists.headers.get("request-id")) });
      return { ok: false as const, log };
    }
    log.push({ step: "Pasta existe", ok: true });

    const list = await gatewayFetch(`/drive/root:/${encodePath(path)}:/children?$top=1&$select=id,name`, undefined, 2, "test:list");
    log.push({ step: "Listar conteúdo", ok: list.ok, detail: list.ok ? undefined : `HTTP ${list.status} request-id ${list.headers.get("request-id") ?? "n/a"}` });

    const testName = `.lovable-test-${Date.now()}.txt`;
    const testPath = `${path}/${testName}`;
    const put = await gatewayFetch(`/drive/root:/${encodePath(testPath)}:/content`, {
      method: "PUT", headers: { "Content-Type": "text/plain" }, body: "ok",
    }, 2, "test:write");
    log.push({ step: "Escrever arquivo", ok: put.ok, detail: put.ok ? undefined : `HTTP ${put.status} request-id ${put.headers.get("request-id") ?? "n/a"}` });

    let itemId: string | null = null;
    if (put.ok) {
      const created = await put.json().catch(() => null) as { id?: string } | null;
      itemId = created?.id ?? null;
    }

    if (itemId) {
      const del = await gatewayFetch(`/drive/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }, 2, "test:delete");
      log.push({ step: "Remover arquivo de teste", ok: del.ok || del.status === 204, detail: del.ok ? undefined : `HTTP ${del.status}` });
    }

    const ok = log.every((l) => l.ok);
    return { ok, log };
  });





export const uploadOneDriveAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string; nome: string; mime_type: string; tamanho_bytes: number; base64: string; legenda?: string; root_folder?: string }) =>
    z.object({
      rdo_id: z.string().uuid(),
      nome: z.string().min(1).max(200),
      mime_type: z.string().min(1).max(120),
      tamanho_bytes: z.number().int().min(0).max(50 * 1024 * 1024),
      base64: z.string().min(1),
      legenda: z.string().max(500).optional(),
      root_folder: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { exigirEscrita } = await import("@/lib/onedrive-permissoes.server");
    await exigirEscrita(context.supabase, context.userId);
    getKeys();


    const me = await context.supabase.from("profiles").select("empresa_id").eq("id", context.userId).maybeSingle();
    if (!me.data?.empresa_id) throw new Error("Sem empresa");

    const ctx = await context.supabase
      .from("rdos")
      .select("id, data, obra_id, obras(nome), empresas:empresa_id(nome)")
      .eq("id", data.rdo_id)
      .maybeSingle();
    if (ctx.error || !ctx.data) throw new Error("RDO não encontrado");

    const empresaNome = (ctx.data as any).empresas?.nome ?? "Empresa";
    const obraNome = (ctx.data as any).obras?.nome ?? "Obra";
    const d = ctx.data.data ? new Date(ctx.data.data + "T00:00:00") : new Date();
    const ano = String(d.getFullYear());
    const mes = `${String(d.getMonth() + 1).padStart(2, "0")}-${MESES_PT[d.getMonth()]}`;
    const dia = d.toISOString().slice(0, 10);

    const safeName = slugSegment(data.nome.replace(/\.[^.]+$/, "")) + (data.nome.match(/\.[^.]+$/)?.[0] ?? "");
    const filename = `${Date.now()}-${safeName}`;
    const root = (data.root_folder ?? "DiarioDeObra").replace(/^\/+|\/+$/g, "").split("/").map(slugSegment).join("/") || "DiarioDeObra";
    const folder = `${root}/${slugSegment(empresaNome)}/${slugSegment(obraNome)}/${ano}/${mes}/${dia}`;
    const fullPath = `${folder}/${filename}`;

    // Valida que a pasta raiz existe antes de enviar (erro claro em vez de criar pasta nova silenciosamente)
    const rootUrl = `/drive/root:/${encodePath(root)}?$select=id,folder`;
    const rootCheck = await gatewayFetch(rootUrl, undefined, 2, "upload:validateRoot");
    const rootReqId = rootCheck.headers.get("request-id");
    if (rootCheck.status === 404) {
      throw new Error(`[validar pasta raiz] Pasta "${root}" não encontrada no OneDrive. Ajuste em Configurações → OneDrive. (request-id: ${rootReqId ?? "n/a"})`);
    }
    if (!rootCheck.ok) {
      const b = await rootCheck.text().catch(() => "");
      throw new Error(parseGraphError(rootCheck.status, b, "validar pasta raiz", `${GATEWAY_URL}${rootUrl}`, rootReqId));
    }

    const binary = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    const uploadUrl = `/drive/root:/${encodePath(fullPath)}:/content`;
    const res = await gatewayFetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": data.mime_type },
      body: binary,
    }, 2, "upload:write");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const requestId = res.headers.get("request-id");
      console.error("[onedrive] upload falhou", res.status, fullPath, body);
      throw new Error(parseGraphError(res.status, body, "escrever arquivo", `${GATEWAY_URL}${uploadUrl}`, requestId));
    }

    const item = await res.json() as {
      id: string; name: string; webUrl?: string; size?: number;
      "@microsoft.graph.downloadUrl"?: string;
      thumbnails?: Array<{ medium?: { url: string }; large?: { url: string } }>;
    };

    const { data: created, error } = await context.supabase.from("rdo_anexos").insert({
      rdo_id: data.rdo_id,
      empresa_id: me.data.empresa_id,
      autor_id: context.userId,
      nome: data.legenda ? `${data.nome} — ${data.legenda}` : data.nome,
      legenda: data.legenda ?? null,
      storage_path: fullPath,
      mime_type: data.mime_type,
      tamanho_bytes: item.size ?? data.tamanho_bytes,
      storage_provider: "onedrive",
      onedrive_item_id: item.id,
      onedrive_web_url: item.webUrl ?? null,
      onedrive_download_url: item["@microsoft.graph.downloadUrl"] ?? null,
      thumbnail_url: item.thumbnails?.[0]?.medium?.url ?? null,
    }).select().single();
    if (error) throw error;
    return created;
  });



/** Lista pastas E arquivos de um caminho, com paginação por cursor (skipToken). */
export const listOneDriveItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path?: string; cursor?: string | null } | undefined) =>
    z
      .object({
        path: z.string().max(400).optional(),
        cursor: z.string().max(4000).nullish(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { exigirLeitura } = await import("@/lib/onedrive-permissoes.server");
    await exigirLeitura(context.supabase, context.userId);
    try {
      return await listChildren(fetcherGateway, { path: data.path, cursor: data.cursor });
    } catch (e) {
      return falhaOneDrive(e);
    }
  });


/** Sobe um arquivo para o caminho informado (PUT simples do Graph). */
export const uploadOneDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path?: string; nome: string; mime_type?: string; base64: string }) =>
    z
      .object({
        path: z.string().max(400).optional(),
        nome: z.string().min(1).max(200),
        mime_type: z.string().max(120).optional(),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { exigirEscrita } = await import("@/lib/onedrive-permissoes.server");
    await exigirEscrita(context.supabase, context.userId);
    const ext = data.nome.match(/\.[^.]+$/)?.[0] ?? "";
    const nome = slugSegment(data.nome.replace(/\.[^.]+$/, "")) + ext;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    try {
      return await uploadContent(fetcherGateway, {
        path: data.path,
        nome,
        mimeType: data.mime_type,
        bytes,
      });
    } catch (e) {
      return falhaOneDrive(e);
    }
  });

/** Devolve uma URL temporária de download (validade ~1h) para um item. */
export const getOneDriveDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { exigirLeitura } = await import("@/lib/onedrive-permissoes.server");
    await exigirLeitura(context.supabase, context.userId);
    try {
      const r = await getDownloadUrl(fetcherGateway, data.itemId);
      return { ok: true as const, ...r };
    } catch (e) {
      if (e instanceof OneDriveError) {
        return { ok: false as const, error: `${e.detalhe.message} ${e.detalhe.action}`, kind: e.detalhe.kind };
      }
      return { ok: false as const, error: (e as Error)?.message ?? "Falha no OneDrive.", kind: "desconhecido" as const };
    }
  });

/* ------------------------------------------------------------------ *
 * Conta OneDrive da organização (gerenciada dentro do RDO)
 * ------------------------------------------------------------------ */

/** Situação da conta corporativa usada pelos anexos do RDO. */
export const listOneDriveConexoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "integracoes.onedrive", "ver");
    const { statusOrganizacao } = await import("@/lib/onedrive-org.server");
    const st = await statusOrganizacao();
    return {
      gatewayUrl: GATEWAY_URL,
      temLovableApiKey: true,
      conexoes: st.conectado
        ? [{ id: "organizacao", envName: "organizacao", rotulo: st.conta ?? "Conta do sistema", conta: st.conta }]
        : [],
    };
  });

/** Situação técnica da integração app-only (sem revelar segredos). */
export const statusIntegracaoOneDrive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "integracoes.onedrive", "ver");
    const { statusIntegracao } = await import("@/lib/onedrive-app.server");
    return statusIntegracao();
  });

/** Força a renovação do token/drive em memória (admin). */
export const recarregarIntegracaoOneDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ehAdmin } = await import("@/lib/onedrive-permissoes.server");
    if (!(await ehAdmin(context.supabase, context.userId))) {
      return { ok: false as const, erro: "Apenas administradores podem recarregar a integração." };
    }
    const { limparCacheGraph, statusIntegracao } = await import("@/lib/onedrive-app.server");
    limparCacheGraph();
    return { ok: true as const, status: await statusIntegracao() };
  });

