import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  limparCacheGraph,
  nomeFisico,
  obterToken,
  pastaRdo,
  sanitizarCaminho,
  sanitizarSegmento,
  variaveisFaltando,
  chamarGraph,
  OneDriveGraphError,
} from "@/lib/onedrive-app.server";

const ENV = {
  MICROSOFT_TENANT_ID: "tenant-123",
  MICROSOFT_CLIENT_ID: "client-123",
  MICROSOFT_CLIENT_SECRET: "segredo",
  MICROSOFT_ONEDRIVE_USER: "arquivos@facom.com.br",
  MICROSOFT_GRAPH_SCOPE: "https://graph.microsoft.com/.default",
};

function respostaToken(expiresIn = 3600) {
  return new Response(JSON.stringify({ access_token: `tok-${Math.random()}`, expires_in: expiresIn }), {
    status: 200,
  });
}

describe("MicrosoftGraphService — token app-only", () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
    limparCacheGraph();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    limparCacheGraph();
  });

  it("usa client_credentials e guarda o token em cache", async () => {
    const fetchMock = vi.fn(async (_url: any, init: any) => {
      const body = String(init.body);
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("scope=https%3A%2F%2Fgraph.microsoft.com%2F.default");
      expect(body).not.toContain("redirect_uri");
      return respostaToken();
    });
    vi.stubGlobal("fetch", fetchMock);

    const t1 = await obterToken();
    const t2 = await obterToken();
    expect(t1).toBe(t2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/tenant-123/oauth2/v2.0/token");
  });

  it("não dispara chamadas duplicadas simultâneas", async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return respostaToken();
    });
    vi.stubGlobal("fetch", fetchMock);
    const [a, b, c] = await Promise.all([obterToken(), obterToken(), obterToken()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("renova antes de expirar", async () => {
    const fetchMock = vi.fn(async () => respostaToken(120)); // já dentro da margem
    vi.stubGlobal("fetch", fetchMock);
    await obterToken();
    await obterToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explica segredo expirado sem vazar detalhes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "invalid_client", error_description: "AADSTS7000222 expired" }), {
          status: 401,
        }),
      ),
    );
    await expect(obterToken()).rejects.toThrow(/Client Secret/i);
  });

  it("aponta variáveis ausentes", () => {
    delete (process.env as any).MICROSOFT_CLIENT_SECRET;
    expect(variaveisFaltando()).toContain("MICROSOFT_CLIENT_SECRET");
  });
});

describe("chamarGraph", () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
    limparCacheGraph();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    limparCacheGraph();
  });

  it("resolve /drive para /drives/{id} e nunca usa /me", async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any) => {
        const u = String(url);
        chamadas.push(u);
        if (u.includes("/oauth2/v2.0/token")) return respostaToken();
        if (u.includes("/users/")) return new Response(JSON.stringify({ id: "drive-9" }), { status: 200 });
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      }),
    );
    await chamarGraph("/drive/root/children");
    expect(chamadas.some((u) => u.includes("/users/arquivos%40facom.com.br/drive"))).toBe(true);
    expect(chamadas.some((u) => u.includes("/drives/drive-9/root/children"))).toBe(true);
    expect(chamadas.some((u) => u.includes("/me/"))).toBe(false);
  });

  it("repete em 429 respeitando Retry-After", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any) => {
        if (String(url).includes("/oauth2/v2.0/token")) return respostaToken();
        n++;
        if (n === 1) return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    const res = await chamarGraph("/users/x/drive");
    expect(res.ok).toBe(true);
    expect(n).toBe(2);
  });

  it("não repete em 400 e devolve erro tratado", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any) => {
        if (String(url).includes("/oauth2/v2.0/token")) return respostaToken();
        n++;
        return new Response(JSON.stringify({ error: { code: "invalidRequest" } }), { status: 400 });
      }),
    );
    await expect(chamarGraph("/users/x/drive")).rejects.toBeInstanceOf(OneDriveGraphError);
    expect(n).toBe(1);
  });
});

describe("sanitização de caminhos", () => {
  it("remove acentos e caracteres inválidos", () => {
    expect(sanitizarSegmento("Relatório: obra*2026?")).toBe("Relatorio_ obra_2026_");
  });

  it("rejeita travessia de diretório", () => {
    expect(() => sanitizarCaminho("RDO/../../etc/passwd")).toThrow();
  });

  it("monta a pasta padrão do RDO", () => {
    expect(pastaRdo({ data: "2026-07-15", obra: "OBRA VALE", rdo: "RDO-000123" })).toBe(
      "RDO/2026/07/OBRA VALE/RDO-000123",
    );
  });

  it("mantém a extensão no nome físico e evita colisão", () => {
    const a = nomeFisico("foto final.JPG");
    const b = nomeFisico("foto final.JPG");
    expect(a.endsWith(".jpg")).toBe(true);
    expect(a).not.toBe(b);
  });
});
