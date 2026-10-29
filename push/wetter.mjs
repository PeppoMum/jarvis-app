/* Wetter (Open-Meteo, kostenlos, ohne Schlüssel) und amtliche Warnungen des Deutschen Wetterdienstes (über Bright Sky, ebenfalls frei).
   Ort: Einstellungen wxLat/wxLon, sonst Haltern am See. Fehlt das Netz, gibt es einfach kein Wetter in den Meldungen. */
export const ORT = { lat: 51.7434, lon: 7.1868, name: "Haltern am See" };

const CODES = { 0: "sonnig", 1: "überwiegend sonnig", 2: "teils bewölkt", 3: "bewölkt", 45: "Nebel", 48: "Nebel mit Reif", 51: "leichter Niesel", 53: "Niesel", 55: "starker Niesel",
  56: "gefrierender Niesel", 57: "gefrierender Niesel", 61: "leichter Regen", 63: "Regen", 65: "starker Regen", 66: "gefrierender Regen", 67: "gefrierender Regen", 71: "leichter Schnee", 73: "Schnee", 75: "starker Schnee",
  77: "Schneegriesel", 80: "Regenschauer", 81: "Regenschauer", 82: "heftige Schauer", 85: "Schneeschauer", 86: "Schneeschauer", 95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel" };
export const wetterWort = (c) => CODES[c] || "wechselhaft";

export function ort(settings) {
  const lat = Number(settings && settings.wxLat), lon = Number(settings && settings.wxLon);
  return lat && lon ? { lat, lon, name: settings.wxName || "" } : { ...ORT, name: (settings && settings.wxName) || ORT.name };
}

/* → { daily: [{date, hi, lo, phrase, rain}], hourly: [{date, hm, rain, temp, gust, code}] } */
export async function ladeWetter(fetchFn, o) {
  const u = "https://api.open-meteo.com/v1/forecast?latitude=" + o.lat + "&longitude=" + o.lon + "&timezone=Europe%2FBerlin&forecast_days=9" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation_probability,temperature_2m,weather_code,wind_gusts_10m";
  try {
    const r = await fetchFn(u); if (!r.ok) return null; const j = await r.json();
    const d = j.daily || {}, h = j.hourly || {};
    return {
      daily: (d.time || []).map((t, i) => ({ date: t, hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), phrase: wetterWort(d.weather_code[i]), rain: d.precipitation_probability_max[i] ?? 0 })),
      hourly: (h.time || []).map((t, i) => ({ date: t.slice(0, 10), hm: t.slice(11, 16), rain: h.precipitation_probability[i] ?? 0, temp: Math.round(h.temperature_2m[i]), gust: Math.round(h.wind_gusts_10m[i] || 0), code: h.weather_code[i] }))
    };
  } catch (e) { return null; }
}

/* Amtliche Warnungen → [{ id, title, text, severity, until }] (until = HH:MM, wenn heute) */
export async function ladeWarnungen(fetchFn, o) {
  try {
    const r = await fetchFn("https://api.brightsky.dev/alerts?lat=" + o.lat + "&lon=" + o.lon); if (!r.ok) return [];
    const j = await r.json(), pad = (n) => String(n).padStart(2, "0");
    return (j.alerts || []).filter((a) => a.status !== "test" && ["moderate", "severe", "extreme"].includes(a.severity)).map((a) => {
      const z = a.expires ? new Date(a.expires) : null;
      return { id: String(a.alert_id || a.id), title: a.headline_de || a.event_de || "Wetterwarnung", text: a.description_de || "", severity: a.severity,
        until: z ? (z.toDateString() === new Date().toDateString() ? pad(z.getHours()) + ":" + pad(z.getMinutes()) : pad(z.getDate()) + "." + pad(z.getMonth() + 1) + ". " + pad(z.getHours()) + ":" + pad(z.getMinutes())) : "" };
    });
  } catch (e) { return []; }
}
