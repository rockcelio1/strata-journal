// Previsão / observação meteorológica via Open-Meteo (sem chave). Suporta geolocalização do browser.
export interface ClimaSnapshot {
  temperatura_c: number;
  vento_kmh: number;
  precipitacao_mm: number;
  codigo: number;
  descricao: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

const codes: Record<number, string> = {
  0: "Céu limpo", 1: "Predominantemente limpo", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Neblina", 48: "Neblina com geada",
  51: "Garoa fraca", 53: "Garoa moderada", 55: "Garoa intensa",
  61: "Chuva fraca", 63: "Chuva moderada", 65: "Chuva forte",
  71: "Neve fraca", 73: "Neve moderada", 75: "Neve forte",
  80: "Pancadas fracas", 81: "Pancadas moderadas", 82: "Pancadas fortes",
  95: "Trovoadas", 96: "Trovoadas c/ granizo", 99: "Trovoadas fortes",
};

export function classificaClima(codigo: number): "ensolarado" | "nublado" | "chuvoso" | "chuva_forte" | "impraticavel" {
  if (codigo === 0 || codigo === 1) return "ensolarado";
  if ([2, 3, 45, 48].includes(codigo)) return "nublado";
  if ([95, 96, 99, 65, 82, 75].includes(codigo)) return "impraticavel";
  if ([61, 63, 80, 81, 71, 73, 51, 53, 55].includes(codigo)) return "chuvoso";
  return "nublado";
}

export async function fetchPosicao(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocalização indisponível neste dispositivo. Abra em um dispositivo com GPS.");
  }
  // Tenta verificar o estado da permissão antes (quando suportado)
  try {
    const perm = await (navigator as any).permissions?.query?.({ name: "geolocation" as PermissionName });
    if (perm?.state === "denied") {
      throw new Error("Permissão de localização negada. Ative o GPS e libere a localização para este site nas configurações do navegador.");
    }
  } catch { /* permissions API ausente: segue */ }

  const tentar = (opts: PositionOptions) =>
    new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => reject(e),
        opts,
      );
    });

  try {
    // 1ª tentativa: alta precisão (GPS), sem cache
    return await tentar({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  } catch (e: any) {
    // PERMISSION_DENIED = 1, POSITION_UNAVAILABLE = 2, TIMEOUT = 3
    if (e?.code === 1) {
      throw new Error("Permissão de localização negada. Ative o GPS e permita o acesso à localização para este site.");
    }
    if (e?.code === 2) {
      throw new Error("GPS indisponível. Ligue o GPS do celular (Configurações → Localização) e tente novamente em ambiente com sinal.");
    }
    // Timeout → tenta de novo aceitando posição menos precisa/em cache
    try {
      return await tentar({ enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 });
    } catch (e2: any) {
      if (e2?.code === 1) throw new Error("Permissão de localização negada. Ative o GPS e permita o acesso à localização.");
      if (e2?.code === 2) throw new Error("GPS indisponível. Ligue o GPS do celular e tente novamente.");
      throw new Error("Tempo esgotado ao obter sua localização. Verifique se o GPS está ligado e tente novamente.");
    }
  }
}

// ----------------- Cache + retentativa -----------------
type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { cache.delete(key); return null; }
  return hit.value as T;
}
function cacheSet<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function fetchComRetry(url: string, tentativas = 3, baseDelayMs = 400): Promise<Response> {
  let ultimaErro: unknown = null;
  for (let i = 0; i < tentativas; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return r;
      // 4xx (exceto 429) não vale tentar de novo
      if (r.status >= 400 && r.status < 500 && r.status !== 429) {
        throw new Error(`Requisição rejeitada (${r.status})`);
      }
      ultimaErro = new Error(`Falha de rede (${r.status})`);
    } catch (e) {
      ultimaErro = e;
    }
    if (i < tentativas - 1) {
      await new Promise((res) => setTimeout(res, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw ultimaErro instanceof Error ? ultimaErro : new Error("Falha ao consultar serviço externo");
}

// ----------------- Clima -----------------
export async function fetchClima(lat: number, lon: number): Promise<ClimaSnapshot> {
  const key = `clima:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = cacheGet<ClimaSnapshot>(key);
  if (cached) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&timezone=America%2FSao_Paulo`;
  const r = await fetchComRetry(url);
  const j = await r.json();
  const c = j.current;
  const snap: ClimaSnapshot = {
    temperatura_c: c.temperature_2m,
    vento_kmh: c.wind_speed_10m,
    precipitacao_mm: c.precipitation,
    codigo: c.weather_code,
    descricao: codes[c.weather_code] ?? `Código ${c.weather_code}`,
    latitude: lat,
    longitude: lon,
    timestamp: c.time,
  };
  cacheSet(key, snap, 10 * 60 * 1000); // 10 min
  return snap;
}

// ----------------- Geocoding -----------------
export async function geocodeEndereco(endereco: string): Promise<{ latitude: number; longitude: number; nome: string } | null> {
  const termo = endereco.trim();
  if (!termo) return null;
  const key = `geo:${termo.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() <= hit.expiresAt) {
    return hit.value as { latitude: number; longitude: number; nome: string } | null;
  }
  if (hit) cache.delete(key);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(termo)}&count=1&language=pt&format=json`;
  try {
    const r = await fetchComRetry(url);
    const j = await r.json();
    const hit = j?.results?.[0];
    if (!hit) { cacheSet(key, null, 60 * 60 * 1000); return null; }
    const value = { latitude: hit.latitude, longitude: hit.longitude, nome: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ") };
    cacheSet(key, value, 24 * 60 * 60 * 1000); // 24h
    return value;
  } catch {
    return null;
  }
}

// Valida formato mínimo do endereço (precisa ter número OU CEP).
export function validarEnderecoParaGeocoding(endereco: string): { ok: true } | { ok: false; mensagem: string } {
  const e = (endereco ?? "").trim();
  if (e.length < 6) return { ok: false, mensagem: "Endereço muito curto. Informe rua, número e cidade." };
  const temCep = /\b\d{5}-?\d{3}\b/.test(e);
  const temNumero = /\b\d{1,6}\b/.test(e);
  const temCidade = /,/.test(e) || /\b[A-Za-zÀ-ÿ]{3,}\b\s*[-/]\s*[A-Z]{2}\b/.test(e);
  if (!temCep && !temNumero) return { ok: false, mensagem: "Informe o número do imóvel ou o CEP no endereço." };
  if (!temCidade && !temCep) return { ok: false, mensagem: "Inclua a cidade (ex.: \"Rua X, 123, São Paulo - SP\") ou o CEP." };
  return { ok: true };
}

export async function fetchClimaPorEndereco(endereco: string): Promise<ClimaSnapshot & { local: string }> {
  const v = validarEnderecoParaGeocoding(endereco);
  if (!v.ok) throw new Error(v.mensagem);
  const g = await resolveGeoBrasil(endereco);
  if (!g) {
    throw new Error("Endereço não localizado. Verifique o CEP e a numeração, ou informe a cidade e o estado.");
  }
  const snap = await fetchClima(g.latitude, g.longitude);
  return { ...snap, local: g.nome };
}

// ----------------- CEP (ViaCEP) -----------------
export interface CepInfo {
  cep: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

export type WeatherErrorCode =
  | "CEP_VAZIO"
  | "CEP_INVALIDO"
  | "CEP_INCOMPLETO"
  | "CEP_LONGO"
  | "CEP_NAO_ENCONTRADO"
  | "CEP_TIMEOUT"
  | "NOMINATIM_TIMEOUT"
  | "NOMINATIM_RATE_LIMIT"
  | "NOMINATIM_ERRO"
  | "NOMINATIM_SEM_CEP"
  | "GEOLOCALIZACAO";

export class WeatherError extends Error {
  code: WeatherErrorCode;
  status?: number;
  constructor(code: WeatherErrorCode, message: string, status?: number) {
    super(message);
    this.name = "WeatherError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeCep(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function validarCep(input: string):
  | { ok: true; cep: string; digitos: string }
  | { ok: false; code: WeatherErrorCode; mensagem: string }
{
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, code: "CEP_VAZIO", mensagem: "Informe o CEP." };
  if (/[^\d\s-]/.test(raw)) return { ok: false, code: "CEP_INVALIDO", mensagem: "CEP deve conter apenas números." };
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return { ok: false, code: "CEP_INVALIDO", mensagem: "CEP deve conter apenas números." };
  if (digits.length < 8) return { ok: false, code: "CEP_INCOMPLETO", mensagem: `CEP incompleto (${digits.length}/8 dígitos).` };
  if (digits.length > 8) return { ok: false, code: "CEP_LONGO", mensagem: "CEP com dígitos demais. Use o formato 00000-000." };
  return { ok: true, cep: `${digits.slice(0, 5)}-${digits.slice(5)}`, digitos: digits };
}

export async function fetchCepInfo(cep: string): Promise<CepInfo> {
  const v = validarCep(cep);
  if (!v.ok) throw new WeatherError(v.code, v.mensagem);
  try {
    const r = await fetchComRetry(`https://viacep.com.br/ws/${v.digitos}/json/`);
    const j = await r.json();
    if (!j || j.erro) throw new WeatherError("CEP_NAO_ENCONTRADO", `CEP ${v.cep} não encontrado nos Correios.`);
    return { cep: v.cep, logradouro: j.logradouro, bairro: j.bairro, localidade: j.localidade, uf: j.uf };
  } catch (e: any) {
    if (e instanceof WeatherError) throw e;
    if (e?.name === "AbortError") throw new WeatherError("CEP_TIMEOUT", "Tempo esgotado ao consultar o CEP. Verifique sua conexão.");
    throw e;
  }
}

function enderecoFromCep(info: CepInfo): string {
  return [info.logradouro, info.bairro, info.localidade && info.uf ? `${info.localidade} - ${info.uf}` : info.localidade, info.cep]
    .filter(Boolean).join(", ");
}

export async function fetchClimaPorCep(cep: string): Promise<ClimaSnapshot & { local: string; cep: CepInfo }> {
  const info = await fetchCepInfo(cep);
  const snap = await fetchClimaPorEndereco(enderecoFromCep(info));
  return { ...snap, cep: info };
}

export async function fetchPrevisao5DiasPorCep(cep: string): Promise<{ local: string; dias: DiaPrevisao[]; cep: CepInfo }> {
  const info = await fetchCepInfo(cep);
  const prev = await fetchPrevisao5DiasPorEndereco(enderecoFromCep(info));
  return { ...prev, cep: info };
}

// Detecta CEP via geolocalização + reverse-geocoding.
// Estratégia: 1) ViaCEP (BR) com fallback para BrasilAPI, 2) Nominatim global.
export async function detectarCepAutomaticamente(): Promise<CepInfo> {
  let pos: { latitude: number; longitude: number; accuracy: number };
  try {
    pos = await fetchPosicao();
  } catch (e: any) {
    throw new WeatherError("GEOLOCALIZACAO", e?.message ?? "Não foi possível obter sua localização. Ligue o GPS e permita o acesso à localização.");
  }

  // 1) BrasilAPI reverse — bem preciso para BR, sem rate-limit do Nominatim
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `https://brasilapi.com.br/api/cep/v2/reverse?lat=${pos.latitude}&lng=${pos.longitude}`,
      { signal: ctrl.signal },
    ).catch(() => null);
    clearTimeout(t);
    if (r && r.ok) {
      const j = await r.json().catch(() => null);
      const cep: string | undefined = j?.cep ?? j?.[0]?.cep;
      if (cep) return fetchCepInfo(cep);
    }
  } catch { /* segue para Nominatim */ }

  // 2) Nominatim como fallback
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.latitude}&lon=${pos.longitude}&addressdetails=1&zoom=18&accept-language=pt-BR`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let r: Response;
  try {
    r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new WeatherError("NOMINATIM_TIMEOUT", "Tempo esgotado ao consultar o serviço de geolocalização (Nominatim).");
    throw new WeatherError("NOMINATIM_ERRO", "Falha ao contatar o serviço de geolocalização. Verifique sua conexão.");
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 429) throw new WeatherError("NOMINATIM_RATE_LIMIT", "Limite do Nominatim atingido. Tente novamente em alguns instantes.", 429);
  if (!r.ok) throw new WeatherError("NOMINATIM_ERRO", `Nominatim retornou erro (${r.status}). Tente novamente.`, r.status);
  const j = await r.json().catch(() => null);
  const postcode: string | undefined = j?.address?.postcode;
  if (!postcode) throw new WeatherError("NOMINATIM_SEM_CEP", "Nenhum CEP encontrado para sua localização atual. Verifique o sinal do GPS.");
  return fetchCepInfo(postcode);
}



// ----------------- Previsão diária (5 dias úteis: seg-sex) -----------------
export interface DiaPrevisao {
  data: string;          // YYYY-MM-DD
  dia_semana: string;    // "Segunda", ...
  t_min_c: number;
  t_max_c: number;
  precipitacao_mm: number;
  prob_chuva_pct: number;
  codigo: number;
  descricao: string;
}

const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function isDiaUtil(yyyyMmDd: string): boolean {
  // Interpreta como meio-dia em Brasília para evitar drift de fuso
  const d = new Date(`${yyyyMmDd}T12:00:00-03:00`);
  const dow = d.getDay();
  return dow >= 1 && dow <= 5;
}

export async function fetchPrevisao5Dias(lat: number, lon: number): Promise<DiaPrevisao[]> {
  const key = `prev5:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = cacheGet<DiaPrevisao[]>(key);
  if (cached) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=10`;
  const r = await fetchComRetry(url);
  const j = await r.json();
  const d = j.daily;
  const out: DiaPrevisao[] = [];
  for (let i = 0; i < d.time.length && out.length < 5; i++) {
    const dia = d.time[i] as string;
    if (!isDiaUtil(dia)) continue;
    const dow = new Date(`${dia}T12:00:00-03:00`).getDay();
    const codigo = d.weather_code[i];
    out.push({
      data: dia,
      dia_semana: SEMANA[dow],
      t_min_c: d.temperature_2m_min[i],
      t_max_c: d.temperature_2m_max[i],
      precipitacao_mm: d.precipitation_sum[i],
      prob_chuva_pct: d.precipitation_probability_max?.[i] ?? 0,
      codigo,
      descricao: codes[codigo] ?? `Código ${codigo}`,
    });
  }
  cacheSet(key, out, 30 * 60 * 1000); // 30 min
  return out;
}

// Geocoding via Nominatim (suporta endereço completo com rua + número).
async function geocodeNominatim(q: string): Promise<{ latitude: number; longitude: number; nome: string } | null> {
  const termo = q.trim();
  if (!termo) return null;
  const key = `nominatim:${termo.toLowerCase()}`;
  const cached = cacheGet<{ latitude: number; longitude: number; nome: string } | null>(key);
  if (cached !== null) return cached;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(termo)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) { cacheSet(key, null, 10 * 60 * 1000); return null; }
    const j = await r.json();
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit?.lat || !hit?.lon) { cacheSet(key, null, 10 * 60 * 1000); return null; }
    const value = { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon), nome: hit.display_name as string };
    cacheSet(key, value, 24 * 60 * 60 * 1000);
    return value;
  } catch {
    return null;
  }
}

// Resolve CEP → lat/lon via BrasilAPI v2 (precisão de quadra quando disponível).
async function geocodeCepBrasilAPI(cep: string): Promise<{ latitude: number; longitude: number; nome: string } | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const key = `brasilapi:${digits}`;
  const cached = cacheGet<{ latitude: number; longitude: number; nome: string } | null>(key);
  if (cached !== null) return cached;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) { cacheSet(key, null, 10 * 60 * 1000); return null; }
    const j = await r.json();
    const lat = parseFloat(j?.location?.coordinates?.latitude ?? "");
    const lon = parseFloat(j?.location?.coordinates?.longitude ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { cacheSet(key, null, 10 * 60 * 1000); return null; }
    const nome = [j.street, j.neighborhood, j.city && j.state ? `${j.city} - ${j.state}` : j.city].filter(Boolean).join(", ");
    const value = { latitude: lat, longitude: lon, nome: nome || `CEP ${digits.slice(0,5)}-${digits.slice(5)}` };
    cacheSet(key, value, 24 * 60 * 60 * 1000);
    return value;
  } catch {
    return null;
  }
}

async function resolveGeoBrasil(endereco: string) {
  const cep = endereco.match(/\b\d{5}-?\d{3}\b/)?.[0];

  // 1) Endereço completo via Nominatim (rua + número, mais preciso)
  let g = await geocodeNominatim(`${endereco}, Brasil`);
  if (g) return g;

  // 2) CEP via BrasilAPI v2 (coordenadas precisas por CEP)
  if (cep) {
    g = await geocodeCepBrasilAPI(cep);
    if (g) return g;
    // 3) ViaCEP → cidade/UF → Nominatim/Open-Meteo
    try {
      const info = await fetchCepInfo(cep);
      if (info?.localidade && info?.uf) {
        const cidade = `${info.localidade}, ${info.uf}, Brasil`;
        g = await geocodeNominatim(cidade);
        if (g) return g;
        g = await geocodeEndereco(`${info.localidade}, ${info.uf}`);
        if (g) return g;
      }
    } catch { /* ignore */ }
  }

  // 4) "Cidade - UF" no texto
  const m = endereco.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{2,})\s*[-/,]\s*([A-Z]{2})\b/);
  if (m) {
    g = await geocodeNominatim(`${m[1].trim()}, ${m[2]}, Brasil`);
    if (g) return g;
    g = await geocodeEndereco(`${m[1].trim()}, ${m[2]}`);
    if (g) return g;
  }

  // 5) Última vírgula como cidade
  const ultimo = endereco.split(",").map((s) => s.trim()).filter(Boolean).pop();
  if (ultimo && ultimo.length >= 3) {
    g = await geocodeEndereco(ultimo);
    if (g) return g;
  }
  return null;
}

export async function fetchPrevisao5DiasPorEndereco(endereco: string): Promise<{ local: string; dias: DiaPrevisao[] }> {
  const v = validarEnderecoParaGeocoding(endereco);
  if (!v.ok) throw new Error(v.mensagem);
  const g = await resolveGeoBrasil(endereco);
  if (!g) throw new Error("Endereço não localizado. Verifique o CEP e a numeração, ou informe a cidade e o estado.");
  const dias = await fetchPrevisao5Dias(g.latitude, g.longitude);
  return { local: g.nome, dias };
}

// Compara duas previsões e retorna os dias cuja descrição/categoria mudou.
export function diffPrevisoes(antes: DiaPrevisao[] | null | undefined, depois: DiaPrevisao[]): DiaPrevisao[] {
  if (!antes || antes.length === 0) return [];
  const idx = new Map(antes.map((d) => [d.data, d]));
  const mudou: DiaPrevisao[] = [];
  for (const d of depois) {
    const a = idx.get(d.data);
    if (!a) continue;
    if (classificaClima(a.codigo) !== classificaClima(d.codigo)) mudou.push(d);
  }
  return mudou;
}

// ----------------- Histórico + previsão em torno de uma data -----------------
export interface DiaRegistro extends DiaPrevisao {
  origem: "historico" | "atual" | "previsao";
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Retorna a data útil mais próxima caminhando `step` (-1 ou +1) dias.
function proximoUtil(base: Date, step: -1 | 1): Date {
  const d = new Date(base.getTime());
  do { d.setDate(d.getDate() + step); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

// Lista N dias úteis anteriores e posteriores à data alvo (inclusive a data).
export function diasUteisAoRedor(dataISO: string, antes = 2, depois = 2): string[] {
  const alvo = new Date(`${dataISO}T12:00:00-03:00`);
  const out: Date[] = [];
  let cur = new Date(alvo.getTime());
  for (let i = 0; i < antes; i++) { cur = proximoUtil(cur, -1); out.unshift(new Date(cur.getTime())); }
  if (alvo.getDay() >= 1 && alvo.getDay() <= 5) out.push(alvo);
  cur = new Date(alvo.getTime());
  for (let i = 0; i < depois; i++) { cur = proximoUtil(cur, 1); out.push(new Date(cur.getTime())); }
  return out.map(ymd);
}

async function fetchArchive(lat: number, lon: number, start: string, end: string) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FSao_Paulo`;
  const r = await fetchComRetry(url);
  return r.json();
}
async function fetchForecastRange(lat: number, lon: number, start: string, end: string) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=America%2FSao_Paulo`;
  const r = await fetchComRetry(url);
  return r.json();
}

function toRegistro(j: any, i: number, origem: DiaRegistro["origem"]): DiaRegistro {
  const dia = j.daily.time[i] as string;
  const dow = new Date(`${dia}T12:00:00-03:00`).getDay();
  const codigo = j.daily.weather_code[i];
  return {
    data: dia,
    dia_semana: SEMANA[dow],
    t_min_c: j.daily.temperature_2m_min[i],
    t_max_c: j.daily.temperature_2m_max[i],
    precipitacao_mm: j.daily.precipitation_sum[i],
    prob_chuva_pct: j.daily.precipitation_probability_max?.[i] ?? 0,
    codigo,
    descricao: codes[codigo] ?? `Código ${codigo}`,
    origem,
  };
}

export async function fetchHistoricoEPrevisaoUteis(
  endereco: string,
  dataISO: string,
  antes = 2,
  depois = 2,
): Promise<{ local: string; dias: DiaRegistro[] }> {
  const v = validarEnderecoParaGeocoding(endereco);
  if (!v.ok) throw new Error(v.mensagem);
  let g = await geocodeEndereco(endereco);
  if (!g) {
    const cep = endereco.match(/\b\d{5}-?\d{3}\b/)?.[0];
    if (cep) g = await geocodeEndereco(cep);
  }
  if (!g) throw new Error("Endereço não localizado. Verifique o CEP e a numeração, ou informe a cidade e o estado.");

  const datas = diasUteisAoRedor(dataISO, antes, depois);
  if (datas.length === 0) return { local: g.nome, dias: [] };

  const hojeStr = ymd(new Date());
  const passados = datas.filter((d) => d < hojeStr);
  const futuros = datas.filter((d) => d >= hojeStr);

  const key = `hist:${g.latitude.toFixed(3)},${g.longitude.toFixed(3)}:${datas[0]}:${datas[datas.length - 1]}`;
  const cached = cacheGet<DiaRegistro[]>(key);
  if (cached) return { local: g.nome, dias: cached };

  const out: DiaRegistro[] = [];
  if (passados.length) {
    try {
      const j = await fetchArchive(g.latitude, g.longitude, passados[0], passados[passados.length - 1]);
      for (let i = 0; i < j.daily.time.length; i++) {
        if (passados.includes(j.daily.time[i])) out.push(toRegistro(j, i, "historico"));
      }
    } catch { /* ignora falha histórica */ }
  }
  if (futuros.length) {
    try {
      const j = await fetchForecastRange(g.latitude, g.longitude, futuros[0], futuros[futuros.length - 1]);
      for (let i = 0; i < j.daily.time.length; i++) {
        if (futuros.includes(j.daily.time[i])) {
          out.push(toRegistro(j, i, j.daily.time[i] === hojeStr ? "atual" : "previsao"));
        }
      }
    } catch { /* ignora falha futura */ }
  }
  out.sort((a, b) => a.data.localeCompare(b.data));
  cacheSet(key, out, 60 * 60 * 1000); // 1 h
  return { local: g.nome, dias: out };
}

// Exposto para tests
export const __testing = { cache, fetchComRetry };


