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
    if (!navigator.geolocation) return reject(new Error("Geolocalização indisponível"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export async function fetchClima(lat: number, lon: number): Promise<ClimaSnapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Falha ao consultar clima");
  const j = await r.json();
  const c = j.current;
  return {
    temperatura_c: c.temperature_2m,
    vento_kmh: c.wind_speed_10m,
    precipitacao_mm: c.precipitation,
    codigo: c.weather_code,
    descricao: codes[c.weather_code] ?? `Código ${c.weather_code}`,
    latitude: lat,
    longitude: lon,
    timestamp: c.time,
  };
}
