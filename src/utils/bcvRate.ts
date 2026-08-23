const RATE_KEY = 'trv_last_rate_fetch';
const RATE_VALUE_KEY = 'trv_bcv_rate';
const RATE_DATE_KEY = 'trv_bcv_rate_date';

/**
 * Calcula el tiempo en ms hasta la proxima ejecucion programada (7:00 AM y 1:00 PM VET).
 * Si ya pasaron ambas hoy, programa para manana 7 AM.
 */
export function msUntilNextScheduledFetch(): number {
  const now = new Date();
  const vetOffset = -4 * 60 * 60 * 1000;
  const vetNow = new Date(now.getTime() + vetOffset + now.getTimezoneOffset() * 60 * 1000);
  const hour = vetNow.getHours();
  const minute = vetNow.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const SCHEDULE = [7 * 60, 13 * 60]; // 7:00 AM y 1:00 PM

  for (const target of SCHEDULE) {
    if (currentMinutes < target) {
      const diff = target - currentMinutes;
      return diff * 60 * 1000;
    }
  }

  // Ya pasaron ambas: programar para manana 7 AM
  const tomorrow7AM = 24 * 60 - currentMinutes + SCHEDULE[0];
  return tomorrow7AM * 60 * 1000;
}

/**
 * Obtiene la tasa BCV almacenada. Retorna null si no existe o si es de otro dia.
 */
export function getStoredRate(): { rate: number; date: string } | null {
  try {
    const rateStr = localStorage.getItem(RATE_VALUE_KEY);
    const dateStr = localStorage.getItem(RATE_DATE_KEY);
    if (!rateStr || !dateStr) return null;
    const rate = parseFloat(rateStr);
    if (isNaN(rate) || rate <= 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr !== today) return null;
    return { rate, date: dateStr };
  } catch {
    return null;
  }
}

/**
 * Guarda la tasa obtenida en localStorage.
 */
export function storeRate(rate: number): void {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(RATE_VALUE_KEY, rate.toString());
  localStorage.setItem(RATE_DATE_KEY, today);
  localStorage.setItem(RATE_KEY, Date.now().toString());
}

/**
 * Indica si se debe intentar obtener la tasa (cada 7 AM y 1 PM).
 */
export function shouldFetchRate(): boolean {
  const stored = getStoredRate();
  if (stored) return false;
  const lastFetch = localStorage.getItem(RATE_KEY);
  if (!lastFetch) return true;
  const lastFetchTime = parseInt(lastFetch, 10);
  if (isNaN(lastFetchTime)) return true;
  const THIRTY_MIN = 30 * 60 * 1000;
  return Date.now() - lastFetchTime > THIRTY_MIN;
}

/**
 * Intenta obtener la tasa del BCV desde APIs publicas.
 * Retorna el rate o null si falla.
 */
export async function fetchBcvRate(retryCount = 0): Promise<number | null> {
  const MAX_RETRIES = 2;
  const endpoints = [
    'https://ve.dolarapi.com/v1/dolares',
    'https://pydolarve.org/api/v1/dollar',
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) continue;
      const data = await response.json();
      let newRate: number | null = null;

      if (Array.isArray(data)) {
        const oficial = data.find(
          (d: { nombre?: string; fuente?: string }) =>
            d.nombre === 'Oficial' || d.fuente === 'oficial'
        );
        if (oficial) {
          newRate = parseFloat(
            (oficial.promedio || oficial.venta || oficial.compra) as string
          );
        }
      } else if (data && typeof data === 'object') {
        if (data.venta) newRate = parseFloat(data.venta);
        else if (data.valor) newRate = parseFloat(data.valor);
        else if (data.dollar?.price) newRate = parseFloat(data.dollar.price);
        else if (data.promedio) newRate = parseFloat(data.promedio);
      }

      if (newRate && !isNaN(newRate) && newRate > 10 && newRate < 10000) {
        storeRate(newRate);
        return newRate;
      }
    } catch {
      // continuar con siguiente endpoint
    }
  }

  if (retryCount < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, 3000));
    return fetchBcvRate(retryCount + 1);
  }

  return null;
}

/**
 * Formatea el precio a bolivares con la tasa dada.
 */
export function formatVes(usd: number, rate: number): string {
  if (!rate || rate <= 10 || isNaN(usd) || isNaN(rate)) return '';
  const ves = usd * rate;
  if (isNaN(ves) || ves <= 0) return '';
  return ves.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
