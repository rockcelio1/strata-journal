import { describe, expect, it, vi } from "vitest";
import {
  OneDriveError,
  buildChildrenUrl,
  describeOneDriveError,
  extractSkipToken,
  getDownloadUrl,
  listChildren,
  MAX_UPLOAD_BYTES,
  naoConectado,
  ordenarItens,
  uploadContent,
  type Fetcher,
} from "@/lib/onedrive-graph";

/** Resposta fake do Graph. */
function resp(status: number, body: unknown, headers: Record<string, string> = {}) {
  const texto = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(texto, { status, headers: { "content-type": "application/json", ...headers } });
}

function fetcherFila(...respostas: Response[]): { fn: Fetcher; chamadas: string[] } {
  const chamadas: string[] = [];
  let i = 0;
  const fn: Fetcher = async (path) => {
    chamadas.push(path);
    return respostas[Math.min(i++, respostas.length - 1)];
  };
  return { fn, chamadas };
}

const PASTA = {
  id: "f1",
  name: "Relatórios",
  folder: { childCount: 3 },
  size: 0,
  webUrl: "https://od/f1",
  lastModifiedDateTime: "2026-07-01T10:00:00Z",
};
const ARQ = {
  id: "a1",
  name: "rdo.pdf",
  file: { mimeType: "application/pdf" },
  size: 2048,
  webUrl: "https://od/a1",
  lastModifiedDateTime: "2026-07-02T10:00:00Z",
};

describe("OneDrive — listagem", () => {
  it("lista itens da raiz mapeando pastas e arquivos", async () => {
    const { fn, chamadas } = fetcherFila(resp(200, { value: [ARQ, PASTA] }));
    const r = await listChildren(fn);
    expect(chamadas[0]).toContain("/drive/root/children");
    expect(r.path).toBe("");
    expect(r.items.map((i) => i.name)).toEqual(["Relatórios", "rdo.pdf"]); // pastas primeiro
    expect(r.items[0]).toMatchObject({ isFolder: true, childCount: 3 });
    expect(r.items[1]).toMatchObject({ isFolder: false, size: 2048, mimeType: "application/pdf" });
  });

  it("monta a rota de subpasta com o caminho codificado", () => {
    const url = buildChildrenUrl("/FACOM/Obra Norte/");
    expect(url).toContain("/drive/root:/FACOM/Obra%20Norte:/children");
  });

  it("paginação: devolve cursor e reenvia o skiptoken na página seguinte", async () => {
    const p1 = resp(200, {
      value: [ARQ],
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/drive/root/children?$skiptoken=ABC123",
    });
    const p2 = resp(200, { value: [PASTA] });
    const { fn, chamadas } = fetcherFila(p1, p2);

    const r1 = await listChildren(fn);
    expect(r1.cursor).toBe("ABC123");

    const r2 = await listChildren(fn, { cursor: r1.cursor });
    expect(chamadas[1]).toContain("$skiptoken=ABC123");
    expect(r2.cursor).toBeNull();
  });

  it("extractSkipToken tolera links malformados", () => {
    expect(extractSkipToken(null)).toBeNull();
    expect(extractSkipToken("nao-e-url?$skiptoken=XYZ")).toBe("XYZ");
  });

  it("ordenarItens é estável e usa pt-BR", () => {
    const nomes = ordenarItens([
      { ...ARQ, isFolder: false, name: "Ácido.txt" } as any,
      { ...ARQ, isFolder: false, name: "Abacaxi.txt" } as any,
      { ...PASTA, isFolder: true, name: "Zoo" } as any,
    ]).map((i) => i.name);
    expect(nomes).toEqual(["Zoo", "Abacaxi.txt", "Ácido.txt"]);
  });
});

describe("OneDrive — upload", () => {
  it("envia com PUT, Content-Type e conflictBehavior=rename", async () => {
    const chamadas: Array<{ path: string; init?: RequestInit }> = [];
    const fn: Fetcher = async (path, init) => {
      chamadas.push({ path, init });
      return resp(200, { id: "novo", name: "foto.jpg", size: 10, webUrl: "https://od/novo" });
    };
    const r = await uploadContent(fn, {
      path: "FACOM/Anexos",
      nome: "foto.jpg",
      mimeType: "image/jpeg",
      bytes: new Uint8Array(10),
    });
    expect(chamadas[0].path).toContain("/drive/root:/FACOM/Anexos/foto.jpg:/content");
    expect(chamadas[0].path).toContain("conflictBehavior=rename");
    expect(chamadas[0].init?.method).toBe("PUT");
    expect(r).toMatchObject({ id: "novo", path: "FACOM/Anexos/foto.jpg" });
  });

  it("recusa arquivo acima do limite antes de chamar a rede", async () => {
    const fn = vi.fn(async () => resp(200, {})) as unknown as Fetcher;
    await expect(
      uploadContent(fn, { nome: "grande.bin", bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1) }),
    ).rejects.toMatchObject({ detalhe: { kind: "arquivo_grande" } });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("OneDrive — download", () => {
  it("retorna a URL temporária do Graph", async () => {
    const { fn } = fetcherFila(
      resp(200, { id: "a1", name: "rdo.pdf", size: 5, "@microsoft.graph.downloadUrl": "https://dl/rdo.pdf" }),
    );
    await expect(getDownloadUrl(fn, "a1")).resolves.toMatchObject({ url: "https://dl/rdo.pdf", name: "rdo.pdf" });
  });

  it("falha explicitamente quando não há link", async () => {
    const { fn } = fetcherFila(resp(200, { id: "a1", name: "rdo.pdf" }));
    await expect(getDownloadUrl(fn, "a1")).rejects.toBeInstanceOf(OneDriveError);
  });
});

describe("OneDrive — falhas de permissão e token", () => {
  it("401 de credencial vira 'sem acesso à conexão' com ação no workspace", async () => {
    const { fn } = fetcherFila(
      resp(401, { error: { code: "unauthorized", message: "You don't have access to this connection" } }),
    );
    const erro = await listChildren(fn).catch((e) => e as OneDriveError);
    expect(erro).toBeInstanceOf(OneDriveError);
    expect((erro as OneDriveError).detalhe.kind).toBe("sem_acesso");
    expect((erro as OneDriveError).detalhe.action).toMatch(/Conectores/i);
    expect((erro as OneDriveError).detalhe.action).toMatch(/logs|diagnóstico/i);
  });

  it("401 genérico é tratado como token expirado e sugere reconectar", async () => {
    const { fn } = fetcherFila(resp(401, { error: { code: "InvalidAuthenticationToken", message: "expired" } }));
    const erro = (await listChildren(fn).catch((e) => e)) as OneDriveError;
    expect(erro.detalhe.kind).toBe("token_expirado");
    expect(erro.detalhe.action).toMatch(/Reconecte/i);
  });

  it("403 no upload orienta escopos e request-id", async () => {
    const { fn } = fetcherFila(
      resp(403, { error: { code: "accessDenied", message: "forbidden" } }, { "request-id": "req-99" }),
    );
    const erro = (await uploadContent(fn, { nome: "a.txt", bytes: new Uint8Array(1) }).catch(
      (e) => e,
    )) as OneDriveError;
    expect(erro.detalhe.kind).toBe("sem_acesso");
    expect(erro.detalhe.requestId).toBe("req-99");
    expect(erro.detalhe.action).toMatch(/Files\.ReadWrite/);
  });

  it("404, 429, 5xx e rede fora do ar têm mensagens próprias", () => {
    expect(describeOneDriveError({ status: 404, step: "s" }).kind).toBe("nao_encontrado");
    expect(describeOneDriveError({ status: 429, step: "s" }).kind).toBe("limite_taxa");
    expect(describeOneDriveError({ status: 503, step: "s" }).kind).toBe("indisponivel");
    expect(describeOneDriveError({ status: 0, step: "s" }).kind).toBe("indisponivel");
  });

  it("conector não vinculado explica como conectar", () => {
    const e = naoConectado();
    expect(e.detalhe.kind).toBe("nao_conectado");
    expect(e.message).toMatch(/Configurações → OneDrive/);
  });
});
