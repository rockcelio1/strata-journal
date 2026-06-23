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

export async function fetchPosicao(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalização indisponível neste dispositivo"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) => reject(new Error(`Não foi possível obter sua localização: ${e.message}`)),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
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
  let g = await geocodeEndereco(endereco);
  if (!g) {
    // Fallback: tenta apenas pelo CEP, se presente
    const cep = endereco.match(/\b\d{5}-?\d{3}\b/)?.[0];
    if (cep) g = await geocodeEndereco(cep);
  }
  if (!g) {
    throw new Error("Endereço não localizado. Verifique o CEP e a numeração, ou informe a cidade e o estado.");
  }
  const snap = await fetchClima(g.latitude, g.longitude);
  return { ...snap, local: g.nome };
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

export async function fetchPrevisao5DiasPorEndereco(endereco: string): Promise<{ local: string; dias: DiaPrevisao[] }> {
  const v = validarEnderecoParaGeocoding(endereco);
  if (!v.ok) throw new Error(v.mensagem);
  let g = await geocodeEndereco(endereco);
  if (!g) {
    const cep = endereco.match(/\b\d{5}-?\d{3}\b/)?.[0];
    if (cep) g = await geocodeEndereco(cep);
  }
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


