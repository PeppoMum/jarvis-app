/* Versand der Jarvis-Meldungen. Läuft als Zeitplan bei GitHub (.github/workflows/meldungen.yml) alle 5 Minuten.
   1. meldet sich als Versand-Helfer an (eigenes Konto, darf Phils Daten nur lesen und ein paar Felder schreiben, siehe firestore.rules)
   2. liest Phils Daten (users/<uid>/items, meta/settings, meta/focus), Termine (geheime iCal-Adressen), Wetter und Warnungen
   3. schickt fällige Meldungen an alle angemeldeten Geräte (users/<uid>/push) und merkt sich, was raus ist (meta/versand)
   4. legt die Texte für die App ab (meta/brief, meta/briefEvening, meta/briefWeekly) und frischt die Widget-Daten auf (widget/<schlüssel>)
   Das Protokoll bei GitHub ist öffentlich: Es enthält nur Zahlen und Arten, keine Titel, Namen oder Adressen.
   Geheimnisse (GitHub → Settings → Secrets → Actions): HELFER_PASSWORT, VAPID_PRIVAT, KALENDER_ICAL (eine geheime Adresse pro Zeile), JARVIS_UID. */
process.env.TZ = "Europe/Berlin";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { jarvis, addDays, isoDate } from "./jarvis.mjs";
import { jetztDran, widgetDaten } from "./meldungen.mjs";
import { adressen, ladeTermine, ladeGoogle } from "./kalender.mjs";
import { ort, ladeWetter, ladeWarnungen } from "./wetter.mjs";

export const HELFER = "meldungen@jarvis-app.web.app";
export const VAPID_PUB = "BE3YlWSHEaFu8BiiRoeciWyj8FMlRonGdILlf_flKBv6tze8Fx3r7qyfzfMZODnM45hrFi2O05cQPxBMR-7_urc";   /* passt zu js/push.js */

/* ---------- Firestore (REST) ---------- */
export function vonFs(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue; if ("integerValue" in v) return Number(v.integerValue); if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue; if ("nullValue" in v) return null; if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(vonFs);
  if ("mapValue" in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = vonFs(x); }); return o; }
  return null;
}
export function zuFs(x) {
  if (x == null) return { nullValue: null };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "string") return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(zuFs) } };
  const f = {}; Object.entries(x).forEach(([k, v]) => { if (v !== undefined) f[k] = zuFs(v); }); return { mapValue: { fields: f } };
}
const dok = (d) => { const o = vonFs({ mapValue: { fields: d.fields || {} } }); o.id = o.id || d.name.split("/").pop(); return o; };

export async function run({ fetch, webpush, env, jetzt = new Date(), log = console.log, cfg, probe = false }) {
  const need = probe ? [] : ["HELFER_PASSWORT", "VAPID_PRIVAT"];
  need.forEach((k) => { if (!env[k]) throw new Error("Geheimnis " + k + " fehlt (GitHub → Settings → Secrets and variables → Actions)."); });
  const uid = String(env.JARVIS_UID || cfg.uid || "").trim();
  if (!uid) throw new Error("Phils Nutzer-Kennung fehlt (Geheimnis JARVIS_UID).");
  const base = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents", U = base + "/users/" + uid;
  const [own, repo] = String(env.GITHUB_REPOSITORY || "").split("/"), ref = own && repo ? { Referer: "https://" + own.toLowerCase() + ".github.io/" + repo + "/" } : {};

  let H = { "Content-Type": "application/json", ...ref };
  if (!probe || env.HELFER_PASSWORT) {
    const login = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + cfg.apiKey,
      { method: "POST", headers: H, body: JSON.stringify({ email: env.HELFER_EMAIL || HELFER, password: String(env.HELFER_PASSWORT).trim(), returnSecureToken: true }) });
    if (!login.ok) { let c = ""; try { c = ((await login.json()).error || {}).message || ""; } catch (e) { }
      throw new Error("Anmeldung des Versand-Helfers fehlgeschlagen (" + login.status + (c ? ", " + c : "") + "). Konto und Passwort prüfen."); }
    H = { ...H, Authorization: "Bearer " + (await login.json()).idToken };
  }
  const call = async (url, o = {}) => { const r = await fetch(url, { headers: H, ...o }); if (!r.ok && r.status !== 404) throw new Error("Datenbank " + r.status + " bei " + url.replace(/^.*\/documents/, "").replace(uid, "<uid>").replace(/[0-9a-f]{64}/, "<schlüssel>")); return r; };
  const holen = async (pfad) => { const r = await call(pfad); return r.status === 404 ? null : dok(await r.json()); };
  const alle = async (pfad) => { const out = []; let tok = "";
    do { const r = await call(pfad + "?pageSize=300" + (tok ? "&pageToken=" + encodeURIComponent(tok) : "")); if (r.status === 404) break; const j = await r.json();
      (j.documents || []).forEach((d) => out.push(dok(d))); tok = j.nextPageToken || ""; } while (tok && out.length < 20000);
    return out; };
  const setzen = (pfad, daten) => probe ? Promise.resolve() : call(pfad, { method: "PATCH", body: JSON.stringify({ fields: zuFs(daten).mapValue.fields }) });

  /* Daten */
  const [settings, focus, versand, kasten, google, items, subs] = await Promise.all([
    holen(U + "/meta/settings"), holen(U + "/meta/focus"), holen(U + "/meta/versand"), holen(U + "/meta/kasten"), holen(U + "/meta/google"), alle(U + "/items"), alle(U + "/push")]);
  const S = settings || {}, t = isoDate(jetzt), o = ort(S), von = addDays(t, -1), bis = addDays(t, 14);
  /* Termine: über den Google-Zugang der App; geht das nicht (oder gibt es ihn noch nicht), über die geheimen iCal-Adressen */
  const termine = async () => {
    const ical = adressen(env.KALENDER_ICAL);
    if (google && google.refresh && google.clientId) {
      try { const k = await ladeGoogle(fetch, google, S, von, bis); if (!k.fehler.length || !ical.length) return { ...k, quelle: "Google" }; } catch (e) { if (!ical.length) return { termine: [], fehler: ["Google-Zugang"], quelle: "–" }; }
    }
    return { ...(await ladeTermine(fetch, ical, von, bis)), quelle: ical.length ? "iCal" : "–" };
  };
  const [kal, wetter, warnungen] = await Promise.all([termine(), ladeWetter(fetch, o), ladeWarnungen(fetch, o)]);
  const J = jarvis({ items, settings: S, gcal: kal.termine, wetter, warnungen, jetzt });

  /* Was ist dran? Gemerkt werden die Schlüssel der letzten 3 Tage */
  const alt = addDays(t, -3), merk = ((versand && versand.keys) || []).filter((k) => { const d = (String(k).match(/\d{4}-\d{2}-\d{2}/) || [t])[0]; return d >= alt; });
  const wxAlt = ((versand && versand.wx) || []).slice(-50);
  const dran = jetztDran(J, merk.concat(wxAlt.map((x) => "wx:" + x)));
  /* Probemeldung, wenn in der App angefordert (meta/versand.probe = Zeitpunkt) */
  const probeAt = Number(versand && versand.probe) || 0;
  if (probeAt && probeAt > (Number(versand && versand.probeOk) || 0)) dran.push({ key: "probe", msg: { t: "Jarvis", b: "So sehen deine Meldungen aus. Alles eingerichtet.", u: "./#heute", g: "probe" } });

  let ok = 0, fehl = 0; const weg = new Set();
  if (dran.length && !probe) webpush.setVapidDetails("https://github.com/" + (env.GITHUB_REPOSITORY || "jarvis-app"), VAPID_PUB, env.VAPID_PRIVAT);
  for (const d of dran) {
    if (probe) { log("— " + d.key + " —\n" + d.msg.t + "\n" + d.msg.b + "\n"); continue; }
    const msg = JSON.stringify(d.msg), seen = new Set();
    for (const s of subs) {
      if (weg.has(s.id) || !s.e || seen.has(s.e) || s.aus === true) continue; seen.add(s.e);
      try { await webpush.sendNotification({ endpoint: s.e, keys: { p256dh: s.p, auth: s.a } }, msg, { TTL: 3 * 3600, urgency: "high" }); ok++; }
      catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) weg.add(s.id); else fehl++; }
    }
    if (d.slot) await setzen(U + "/meta/" + d.slot, { date: t, text: d.msg.b, title: d.msg.t, at: jetzt.toISOString(), src: "meldung" });
  }
  for (const id of weg) await call(U + "/push/" + encodeURIComponent(id), { method: "DELETE" });

  /* gemerkt: verschickte Schlüssel, gesehene Warnungen, erledigte Probemeldung */
  if (dran.length && !probe) {
    const keys = merk.concat(dran.filter((d) => !d.key.startsWith("wx:") && d.key !== "probe").map((d) => d.key)).slice(-300);
    const wx = wxAlt.concat(dran.filter((d) => d.key.startsWith("wx:")).map((d) => d.key.slice(3))).slice(-50);
    await setzen(U + "/meta/versand", { keys, wx, probe: probeAt, probeOk: probeAt ? Date.now() : 0, at: jetzt.toISOString() });
  }

  /* Widget-Daten: unter dem geheimen Schlüssel aus meta/kasten (den legt die App beim Einrichten an) */
  let widget = false;
  if (kasten && /^[0-9a-f]{64}$/.test(kasten.key || "")) {
    const wd = widgetDaten(J, focus);
    if (probe) log("Widget: " + JSON.stringify(wd).slice(0, 400));
    else { await setzen(base + "/widget/" + kasten.key, { d: JSON.stringify(wd), at: Date.now() }); widget = true; }
  }

  log("Termine (" + kal.quelle + "): " + kal.termine.length + (kal.fehler.length ? " (" + kal.fehler.length + " Kalender nicht erreichbar)" : "") + " · Wetter: " + (wetter ? "ja" : "nein") +
    " · Warnungen: " + warnungen.length + " · fällig: " + (dran.map((d) => d.key.split(":")[0]).join(", ") || "nichts") +
    " · gesendet: " + ok + " · Fehler: " + fehl + " · abgemeldete Geräte entfernt: " + weg.size + " · Widget: " + (widget ? "aufgefrischt" : "–"));
  return { dran, gesendet: ok, fehler: fehl, entfernt: weg.size, J };
}

/* Firebase-Zugang aus firebase-config.js (gleiche Datei wie die App) */
export function leseConfig(txt) {
  const get = (k) => (txt.match(new RegExp(k + "\\s*[:=]\\s*[\"']([^\"']+)[\"']")) || [])[1];
  return { apiKey: get("apiKey"), projectId: get("projectId"), uid: get("(?:ownerUid|OWNER_UID|philUid|PHIL_UID)") };
}

/* Aufruf bei GitHub: node push/senden.mjs   ·   zum Ausprobieren ohne Versand: node push/senden.mjs --probe */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = leseConfig(fs.readFileSync(new URL("../firebase-config.js", import.meta.url), "utf8"));
  const probe = process.argv.includes("--probe");
  const webpush = probe ? null : (await import("web-push")).default;
  run({ fetch, webpush, env: process.env, cfg, probe }).catch((e) => { console.error(e.message); process.exit(1); });
}
