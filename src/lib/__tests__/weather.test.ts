import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  classificaClima,
  validarEnderecoParaGeocoding,
  geocodeEndereco,
  fetchClima,
  fetchClimaPorEndereco,
  diffPrevisoes,
  __testing,
  type DiaPrevisao,
} from "@/lib/weather";

const fetchMock = vi.fn();

beforeEach(() => {
  __testing.cache.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function failResp(status: number) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

describe("classificaClima", () => {
  it("mapeia códigos do Open-Meteo para categorias do RDO", () => {
    expect(classificaClima(0)).toBe("ensolarado");
    expect(classificaClima(3)).toBe("nublado");
    expect(classificaClima(61)).toBe("chuvoso");
    expect(classificaClima(95)).toBe("impraticavel");
  });
});

describe("validarEnderecoParaGeocoding", () => {
  it("aceita endereço com número e cidade", () => {
    expect(validarEnderecoParaGeocoding("Rua A, 123, São Paulo - SP").ok).toBe(true);
  });
  it("aceita endereço só com CEP", () => {
    expect(validarEnderecoParaGeocoding("01310-100").ok).toBe(true);
  });
  it("rejeita endereço curto / sem número e sem CEP", () => {
    const r = validarEnderecoParaGeocoding("Rua");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/curto|número|CEP/i);
  });
});

describe("fetchClima (retry + cache)", () => {
  it("tenta novamente em 5xx e usa cache na segunda chamada", async () => {
    fetchMock
      .mockResolvedValueOnce(failResp(503))
      .mockResolvedValueOnce(okJson({
        current: { temperature_2m: 22, wind_speed_10m: 5, precipitation: 0, weather_code: 1, time: "2025-01-01T12:00" },
      }));
    const snap = await fetchClima(-23.55, -46.63);
    expect(snap.temperatura_c).toBe(22);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Segunda chamada deve vir do cache
    const snap2 = await fetchClima(-23.55, -46.63);
    expect(snap2.temperatura_c).toBe(22);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propaga erro em português depois de esgotar tentativas", async () => {
    fetchMock.mockResolvedValue(failResp(500));
    await expect(fetchClima(0, 0)).rejects.toThrow(/Falha/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("geocodeEndereco", () => {
  it("retorna null e cacheia quando não há resultado", async () => {
    fetchMock.mockResolvedValue(okJson({ results: [] }));
    expect(await geocodeEndereco("zzz inexistente")).toBeNull();
    expect(await geocodeEndereco("zzz inexistente")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retorna lat/lon do primeiro hit", async () => {
    fetchMock.mockResolvedValue(okJson({ results: [{ latitude: -23.5, longitude: -46.6, name: "São Paulo", admin1: "SP", country: "Brasil" }] }));
    const g = await geocodeEndereco("Rua A, 123, São Paulo - SP");
    expect(g).toEqual({ latitude: -23.5, longitude: -46.6, nome: "São Paulo, SP, Brasil" });
  });
});

describe("fetchClimaPorEndereco — fallback por CEP", () => {
  it("usa CEP quando o endereço completo falha no geocoding", async () => {
    fetchMock
      // 1) geocode endereço completo → vazio
      .mockResolvedValueOnce(okJson({ results: [] }))
      // 2) geocode pelo CEP → hit
      .mockResolvedValueOnce(okJson({ results: [{ latitude: -23.5, longitude: -46.6, name: "São Paulo" }] }))
      // 3) clima
      .mockResolvedValueOnce(okJson({
        current: { temperature_2m: 25, wind_speed_10m: 3, precipitation: 0, weather_code: 0, time: "2025-01-01T12:00" },
      }));
    const snap = await fetchClimaPorEndereco("Rua X, 10, 01310-100");
    expect(snap.temperatura_c).toBe(25);
    expect(snap.local).toBe("São Paulo");
  });

  it("erro em português quando nada localiza", async () => {
    fetchMock.mockResolvedValue(okJson({ results: [] }));
    await expect(fetchClimaPorEndereco("Rua X, 10, 01310-100")).rejects.toThrow(/não localizado/i);
  });
});

describe("diffPrevisoes", () => {
  const base: DiaPrevisao[] = [
    { data: "2025-01-06", dia_semana: "Segunda", t_min_c: 20, t_max_c: 28, precipitacao_mm: 0, prob_chuva_pct: 10, codigo: 0, descricao: "Céu limpo" },
    { data: "2025-01-07", dia_semana: "Terça",   t_min_c: 21, t_max_c: 29, precipitacao_mm: 0, prob_chuva_pct: 20, codigo: 1, descricao: "Limpo" },
  ];
  it("identifica dias cuja categoria mudou", () => {
    const novo = [...base];
    novo[1] = { ...novo[1], codigo: 95, descricao: "Trovoadas" }; // impraticavel
    const r = diffPrevisoes(base, novo);
    expect(r).toHaveLength(1);
    expect(r[0].data).toBe("2025-01-07");
  });
  it("retorna vazio quando não há base anterior", () => {
    expect(diffPrevisoes(null, base)).toEqual([]);
  });
});
