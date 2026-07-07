import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_onedrive";

// Sanity: o gateway já mapeia para o Microsoft Graph; "/v1.0" NÃO pode estar no base URL,
// senão o Graph responde "Resource not found for the segment 'v1.0'".
if (/\/v\d+(\.\d+)?\/?$/.test(GATEWAY_URL)) {
  throw new Error(
    `Configuração inválida do gateway OneDrive: GATEWAY_URL não pode conter versão de API (/v1.0). Atual: ${GATEWAY_URL}`,
  );
}

// Diagnóstico em memória (últimas chamadas) — exibido em Configurações → OneDrive.
type DiagEntry = {
  ts: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  requestId?: string | null;
  step?: string | null;
  error?: string | null;
};
const DIAG_MAX = 30;
const diagBuf: DiagEntry[] = [];
function pushDiag(e: DiagEntry) {
  diagBuf.unshift(e);
  if (diagBuf.length > DIAG_MAX) diagBuf.length = DIAG_MAX;
}

function slugSegment(s: string): string {
  return (s || "sem-nome")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "sem-nome";
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

const MESES_PT = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function getKeys() {
  const apiKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.MICROSOFT_ONEDRIVE_API_KEY;
  if (!apiKey || !connKey) {
    throw new Error("OneDrive não está conectado. Conecte o conector OneDrive nas configurações.");
  }
  return { apiKey, connKey };
}

function parseGraphError(status: number, body: string, step: string, url: string, requestId?: string | null): string {
  let code = "", message = body.slice(0, 200);
  try {
    const j = JSON.parse(body);
    code = j?.error?.code ?? "";
    message = j?.error?.message ?? message;
  } catch { /* texto puro */ }
  let hint = "";
  if (code === "BadRequest" && /segment 'v\d/i.test(message)) {
    hint = " — confira a rota do gateway (base URL não deve conter /v1.0).";
  } else if (status === 404 || code === "itemNotFound") {
    hint = " — recurso/pasta não existe no OneDrive.";
  } else if (status === 401 || status === 403) {
    hint = " — token expirado ou sem permissão; reconecte o OneDrive.";
  } else if (status === 429) {
    hint = " — limite de requisições da Microsoft (tente novamente).";
  }
  return `[${step}] ${status} ${code || ""} ${message}${hint} (URL: ${url}${requestId ? ` | request-id: ${requestId}` : ""})`.trim();
}

async function gatewayFetch(path: string, init?: RequestInit, retries = 2, step = "graph"): Promise<Response> {
  const { apiKey, connKey } = getKeys();
  const url = `${GATEWAY_URL}${path}`;
  const method = init?.method ?? "GET";
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Connection-Api-Key": connKey,
          ...(init?.headers ?? {}),
        },
      });
      const requestId = res.headers.get("request-id") ?? res.headers.get("client-request-id");
      if (res.status >= 500 || res.status === 429) {
        if (attempt < retries) {
          const wait = 300 * Math.pow(2, attempt);
          console.warn(`[onedrive:${step}] ${res.status} em ${path} — retry ${attempt + 1}/${retries} em ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      pushDiag({
        ts: new Date().toISOString(), method, url, status: res.status, ok: res.ok,
        requestId, step,
      });
      return res;
    } catch (e: any) {
      lastErr = e;
      console.error(`[onedrive:${step}] erro de rede em ${path} (tentativa ${attempt + 1}):`, e);
      pushDiag({
        ts: new Date().toISOString(), method, url, status: 0, ok: false,
        step, error: e?.message ?? "network",
      });
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr ?? new Error("OneDrive: falha de rede após retentativas");
}

async function gatewayCall(path: string, init: RequestInit | undefined, step: string): Promise<{ res: Response; body: string; requestId: string | null }> {
  const res = await gatewayFetch(path, init, 2, step);
  const requestId = res.headers.get("request-id") ?? res.headers.get("client-request-id");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg = parseGraphError(res.status, body, step, `${GATEWAY_URL}${path}`, requestId);
    pushDiag({
      ts: new Date().toISOString(), method: init?.method ?? "GET",
      url: `${GATEWAY_URL}${path}`, status: res.status, ok: false, requestId, step, error: msg,
    });
    const err = new Error(msg) as Error & { status?: number; requestId?: string | null; step?: string };
    err.status = res.status; err.requestId = requestId; err.step = step;
    throw err;
  }
  return { res, body: "", requestId };
}

export const getOneDriveDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ gatewayUrl: GATEWAY_URL, entries: diagBuf.slice(0, DIAG_MAX) }));

export const getOneDriveQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const res = await gatewayFetch("/me/drive?$select=quota,webUrl", undefined, 2, "quota");
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const requestId = res.headers.get("request-id");
        return { ok: false as const, error: parseGraphError(res.status, body, "quota", `${GATEWAY_URL}/me/drive`, requestId) };
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
  .handler(async () => {
    try {
      const res = await gatewayFetch("/me", undefined, 2, "verify");
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const requestId = res.headers.get("request-id");
        const err = parseGraphError(res.status, body, "verify", `${GATEWAY_URL}/me`, requestId);
        console.error("[onedrive] verify falhou", err);
        return { ok: false as const, status: res.status, error: err };
      }
      const me = await res.json() as { id?: string; displayName?: string; userPrincipalName?: string; mail?: string };
      return {
        ok: true as const,
        account: {
          id: me.id ?? null,
          displayName: me.displayName ?? null,
          email: me.userPrincipalName ?? me.mail ?? null,
        },
      };
    } catch (e: any) {
      console.error("[onedrive] verify exception", e);
      return { ok: false as const, status: 0, error: e?.message ?? "Erro desconhecido" };
    }
  });

export const listOneDriveFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path?: string } | undefined) => z.object({ path: z.string().max(400).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const path = (data.path ?? "").replace(/^\/+|\/+$/g, "");
    const url = path
      ? `/me/drive/root:/${encodePath(path)}:/children?$select=id,name,folder,parentReference&$top=200`
      : `/me/drive/root/children?$select=id,name,folder,parentReference&$top=200`;
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
  .handler(async ({ data }) => {
    const clean = data.path.replace(/^\/+|\/+$/g, "");
    if (!clean) return { ok: false as const, status: 400, error: "Caminho vazio" };

    // 1) Já existe?
    const getUrl = `/me/drive/root:/${encodePath(clean)}?$select=id,name,folder`;
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
      const checkUrl = `/me/drive/root:/${encodePath(currentPath)}?$select=id,name,folder`;
      const checkRes = await gatewayFetch(checkUrl, undefined, 2, "ensureFolder:check");
      if (checkRes.ok) {
        const item = await checkRes.json() as { id: string; name: string; folder?: unknown };
        if (!item.folder) return { ok: false as const, status: 409, error: `"${currentPath}" existe mas não é uma pasta` };
        lastItem = { id: item.id, name: item.name };
      } else if (checkRes.status === 404) {
        const createUrl = parentPath
          ? `/me/drive/root:/${encodePath(parentPath)}:/children`
          : `/me/drive/root/children`;
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

    const exists = await gatewayFetch(`/me/drive/root:/${encodePath(path)}?$select=id,folder`, undefined, 2, "test:exists");
    if (exists.status === 404) {
      log.push({ step: "Pasta existe", ok: false, detail: `Não encontrada (404, request-id: ${exists.headers.get("request-id") ?? "n/a"})` });
      return { ok: false as const, log };
    }
    if (!exists.ok) {
      const b = await exists.text().catch(() => "");
      log.push({ step: "Pasta existe", ok: false, detail: parseGraphError(exists.status, b, "test:exists", `${GATEWAY_URL}/me/drive/root:/${encodePath(path)}`, exists.headers.get("request-id")) });
      return { ok: false as const, log };
    }
    log.push({ step: "Pasta existe", ok: true });

    const list = await gatewayFetch(`/me/drive/root:/${encodePath(path)}:/children?$top=1&$select=id,name`, undefined, 2, "test:list");
    log.push({ step: "Listar conteúdo", ok: list.ok, detail: list.ok ? undefined : `HTTP ${list.status} request-id ${list.headers.get("request-id") ?? "n/a"}` });

    const testName = `.lovable-test-${Date.now()}.txt`;
    const testPath = `${path}/${testName}`;
    const put = await gatewayFetch(`/me/drive/root:/${encodePath(testPath)}:/content`, {
      method: "PUT", headers: { "Content-Type": "text/plain" }, body: "ok",
    }, 2, "test:write");
    log.push({ step: "Escrever arquivo", ok: put.ok, detail: put.ok ? undefined : `HTTP ${put.status} request-id ${put.headers.get("request-id") ?? "n/a"}` });

    let itemId: string | null = null;
    if (put.ok) {
      const created = await put.json().catch(() => null) as { id?: string } | null;
      itemId = created?.id ?? null;
    }

    if (itemId) {
      const del = await gatewayFetch(`/me/drive/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }, 2, "test:delete");
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
    const rootUrl = `/me/drive/root:/${encodePath(root)}?$select=id,folder`;
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

    const uploadUrl = `/me/drive/root:/${encodePath(fullPath)}:/content`;
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


/** Retorna uma downloadUrl fresca (~1h de validade) para um item do OneDrive.
 * Usar sempre que for exibir a imagem: a URL persistida na tabela expira. */
export async function refreshOnedriveDownloadUrl(itemId: string): Promise<string | null> {
  if (!itemId) return null;
  try {
    const res = await gatewayFetch(
      `/me/drive/items/${encodeURIComponent(itemId)}`,
      undefined,
      1,
      "refreshDownloadUrl",
    );
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => null);
    return j?.["@microsoft.graph.downloadUrl"] ?? j?.webUrl ?? null;
  } catch {
    return null;
  }
}
