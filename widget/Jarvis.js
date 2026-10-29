// Jarvis für Scriptable (kostenlose App fürs iPhone): Widget im Rüstung-Look und Kurzbefehle.
// Einrichtung: siehe widget/ANLEITUNG.md. Beim ersten Start fragt das Skript nach dem Einrichtungs-Code aus der Jarvis-App
// (Mehr › Einstellungen › Meldungen › Widget einrichten).
//
// Als Widget: zeigt Termine, Losfahren, Aufgaben, Wetter, Woche und die laufende Zeit. Antippen öffnet das Menü.
// Aus Kurzbefehlen (Aktion „Skript ausführen“, Parameter):  start · start:uni · pause · stopp · notiz:<Text>
// Ohne Parameter in Scriptable geöffnet: Menü mit Arbeit starten, Pause, Feierabend, Notiz.

const KEY = "jarvis.cfg", LAST = "jarvis.last", CACHE = "jarvis.widget";
const FARBEN = {
  rotgold: { l: { bg: "#F4EFE7", card: "#FFFFFF", tx: "#1E1714", mu: "#685847", ac: "#8F5F0F", st: "#C8322B", onst: "#FFFFFF" }, d: { bg: "#0F0C0B", card: "#1B1513", tx: "#F3E9D8", mu: "#BFAE90", ac: "#E8B04B", st: "#C8322B", onst: "#FFF6EC" } },
  stealth: { l: { bg: "#EDEFF2", card: "#FFFFFF", tx: "#111417", mu: "#5B6670", ac: "#2B3138", st: "#C8222A", onst: "#FFFFFF" }, d: { bg: "#0B0C0E", card: "#17191C", tx: "#EEF1F4", mu: "#A3ACB5", ac: "#C8D0D8", st: "#C8222A", onst: "#FFFFFF" } },
  warmachine: { l: { bg: "#EEF0F3", card: "#FFFFFF", tx: "#14181D", mu: "#586270", ac: "#A04808", st: "#3F5E7E", onst: "#FFFFFF" }, d: { bg: "#101215", card: "#1C2025", tx: "#EDEFF2", mu: "#9AA3AD", ac: "#FF8A2A", st: "#3F5E7E", onst: "#FFFFFF" } },
  bordeaux: { l: { bg: "#F6EFEC", card: "#FFFFFF", tx: "#22100F", mu: "#6E5550", ac: "#8E1B2C", st: "#8E1B2C", onst: "#FFFFFF" }, d: { bg: "#120A0C", card: "#201216", tx: "#F5ECE6", mu: "#B9A396", ac: "#D9A441", st: "#8E1B2C", onst: "#FFFFFF" } },
  smaragd: { l: { bg: "#F1F4EF", card: "#FFFFFF", tx: "#062A20", mu: "#4F6258", ac: "#064E3B", st: "#0E7A5C", onst: "#FFFFFF" }, d: { bg: "#04100C", card: "#0B1E17", tx: "#F1F5F0", mu: "#A3B8AB", ac: "#F8E7C9", st: "#0E7A5C", onst: "#FFFFFF" } },
  carbon: { l: { bg: "#F2F2F0", card: "#FFFFFF", tx: "#111111", mu: "#5E5E5E", ac: "#111111", st: "#111111", onst: "#F5D90A" }, d: { bg: "#0B0B0B", card: "#181818", tx: "#F4F4F4", mu: "#A6A6A6", ac: "#F5D90A", st: "#E5E5E5", onst: "#111111" } }
};
const F = { titel: (n) => new Font("AvenirNextCondensed-Bold", n), fett: (n) => new Font("AvenirNextCondensed-DemiBold", n), text: (n) => new Font("AvenirNext-Medium", n), zahl: (n) => new Font("AvenirNextCondensed-Heavy", n) };

/* ---------- Einrichtung ---------- */
function cfg() {
  if (!Keychain.contains(KEY)) return null;
  try { const c = JSON.parse(Keychain.get(KEY)); return c.p && c.k && /^[0-9a-f]{64}$/.test(c.s) ? c : null; } catch (e) { return null; }
}
async function einrichten() {
  const a = new Alert();
  a.title = "Jarvis einrichten";
  a.message = "Füge den Einrichtungs-Code aus der Jarvis-App ein (Mehr › Einstellungen › Meldungen › Widget einrichten › Kopieren).";
  a.addTextField("Code einfügen", Pasteboard.pasteString() || "");
  a.addAction("Speichern"); a.addCancelAction("Abbrechen");
  if (await a.presentAlert() === -1) return null;
  try {
    const c = JSON.parse(atob(a.textFieldValue(0).trim()));
    if (!c.p || !c.k || !/^[0-9a-f]{64}$/.test(c.s)) throw 0;
    Keychain.set(KEY, JSON.stringify(c)); await hinweis("Fertig", "Jarvis ist eingerichtet. Lege jetzt das Widget auf den Home-Bildschirm."); return c;
  } catch (e) { await hinweis("Das hat nicht geklappt", "Der Code war nicht vollständig. Bitte in der Jarvis-App nochmal auf „Kopieren“ tippen."); return null; }
}
async function hinweis(t, m) { const a = new Alert(); a.title = t; a.message = m; a.addAction("OK"); await a.presentAlert(); }
const base = (c) => "https://firestore.googleapis.com/v1/projects/" + c.p + "/databases/(default)/documents/";

/* ---------- Aufträge an die App (Briefkasten) ---------- */
async function senden(c, art, extra) {
  const f = { art: { stringValue: art }, at: { integerValue: String(Date.now()) } };
  if (extra && extra.text) f.text = { stringValue: String(extra.text).slice(0, 500) };
  if (extra && extra.cat) f.cat = { stringValue: extra.cat };
  const r = new Request(base(c) + "kasten/" + c.s + "/m?key=" + c.k);
  r.method = "POST"; r.headers = { "Content-Type": "application/json" }; r.body = JSON.stringify({ fields: f });
  try { await r.loadString(); } catch (e) { return false; }
  const ok = r.response && r.response.statusCode >= 200 && r.response.statusCode < 300;
  if (ok && art !== "notiz") Keychain.set(LAST, JSON.stringify({ art, at: Date.now(), cat: extra && extra.cat }));
  return ok;
}
const CATS = { arbeit: "Arbeit", uni: "Uni", ehrenamt: "Ehrenamt", privat: "Privat" };
async function auftrag(c, p) {
  p = String(p || "").trim(); const low = p.toLowerCase();
  let art, extra = {}, satz;
  if (low.startsWith("notiz")) { art = "notiz"; extra.text = p.replace(/^notiz\s*:?\s*/i, ""); if (!extra.text) return "Da war kein Text."; satz = "Notiert."; }
  else if (low.startsWith("start")) { art = "start"; extra.cat = (low.split(":")[1] || "arbeit").trim(); satz = (CATS[extra.cat] || extra.cat) + " läuft."; }
  else if (low.startsWith("pause") || low.startsWith("weiter")) { art = "pause"; satz = "Pause oder weiter, ist eingetragen."; }
  else if (low.startsWith("stop") || low.startsWith("feierabend") || low.startsWith("ende")) { art = "stopp"; satz = "Feierabend. Die Zeit ist eingetragen."; }
  else { art = "notiz"; extra.text = p; satz = "Notiert."; }
  const ok = await senden(c, art, extra);
  return ok ? satz + " Jarvis übernimmt das, sobald die App offen ist." : "Das ging gerade nicht. Bitte nochmal versuchen.";
}
async function menue(c) {
  const a = new Alert(); a.title = "Jarvis";
  ["Arbeit starten", "Uni starten", "Pause / weiter", "Feierabend (Stopp)", "Notiz diktieren", "Einrichtung ändern"].forEach((x) => a.addAction(x)); a.addCancelAction("Abbrechen");
  const i = await a.presentSheet(); if (i === -1) return;
  if (i === 5) { await einrichten(); return; }
  let p = ["start", "start:uni", "pause", "stopp"][i];
  if (i === 4) { let t = ""; try { t = await Dictation.start("de-DE"); } catch (e) { }
    if (!t) { const b = new Alert(); b.title = "Notiz"; b.addTextField("z. B. Einkauf: Milch, Brot"); b.addAction("Senden"); b.addCancelAction("Abbrechen"); if (await b.presentAlert() === -1) return; t = b.textFieldValue(0); }
    p = "notiz:" + t; }
  await hinweis("Jarvis", await auftrag(c, p));
}

/* ---------- Daten fürs Widget ---------- */
async function laden(c) {
  try {
    const r = new Request(base(c) + "widget/" + c.s + "?key=" + c.k); r.timeoutInterval = 15;
    const j = await r.loadJSON(); const d = JSON.parse(j.fields.d.stringValue);
    Keychain.set(CACHE, JSON.stringify(d)); return d;
  } catch (e) { try { return JSON.parse(Keychain.get(CACHE)); } catch (x) { return null; } }
}
// Was der letzte Kurzbefehl gemacht hat, bevor die App ihn übernommen hat
function uhrJetzt(d) {
  let u = d && d.uhr ? { ...d.uhr } : null;
  try {
    const l = JSON.parse(Keychain.get(LAST));
    if (l && d && l.at > (d.at || 0)) {
      if (l.art === "start") u = { cat: CATS[l.cat] || l.cat || "Arbeit", seit: l.at, pause: null, pausedMs: 0 };
      else if (l.art === "stopp") u = null;
      else if (l.art === "pause" && u) { if (u.pause) { u.pausedMs = (u.pausedMs || 0) + l.at - u.pause; u.pause = null; } else u.pause = l.at; }
    }
  } catch (e) { }
  return u;
}

/* ---------- Widget bauen ---------- */
function farben(d) {
  const p = FARBEN[(d && d.farbe) || "rotgold"] || FARBEN.rotgold, m = d && d.modus;
  const dunkel = m === "dark" ? true : m === "light" ? false : Device.isUsingDarkAppearance();
  const x = dunkel ? p.d : p.l, o = {}; Object.keys(x).forEach((k) => { o[k] = new Color(x[k]); }); return o;
}
function txt(s, t, font, color, lines) { const w = s.addText(String(t)); w.font = font; w.textColor = color; w.lineLimit = lines || 1; w.minimumScaleFactor = 0.7; return w; }
function kopf(w, C, d, gross) {
  const k = w.addStack(); k.layoutHorizontally(); k.centerAlignContent();
  txt(k, "⬢", F.titel(gross ? 16 : 13), C.st); k.addSpacer(4);
  txt(k, "JARVIS", F.titel(gross ? 16 : 13), C.tx); k.addSpacer();
  if (d && d.wetter) txt(k, d.wetter.hi + "° " + (d.wetter.regen >= 40 ? d.wetter.regen + " %" : ""), F.fett(gross ? 14 : 12), C.mu);
}
function linie(w, C) { const l = w.addStack(); l.size = new Size(0, 2); l.backgroundColor = C.ac; l.addSpacer(); }
function uhrZeile(s, C, u, klein) {
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.backgroundColor = C.st; z.setPadding(3, 6, 3, 6);
  txt(z, (u.pause ? "PAUSE · " : "") + u.cat.toUpperCase(), F.fett(klein ? 11 : 12), C.onst); z.addSpacer(5);
  if (u.pause) txt(z, dauer(u.pause - u.seit - (u.pausedMs || 0)), F.zahl(klein ? 12 : 14), C.onst);
  else { const dt = z.addDate(new Date(u.seit + (u.pausedMs || 0))); dt.applyTimerStyle(); dt.font = F.zahl(klein ? 12 : 14); dt.textColor = C.onst; dt.lineLimit = 1; }
}
const dauer = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
function termin(s, C, t, font) {
  const z = s.addStack(); z.layoutHorizontally();
  const a = z.addStack(); a.size = new Size(40, 0); txt(a, t.s, F.fett(font), C.ac); z.addSpacer(4);
  txt(z, t.ti, F.text(font), C.tx);
}
function bauen(d, fam) {
  const w = new ListWidget(), C = farben(d), u = uhrJetzt(d);
  w.backgroundColor = C.bg; w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  if (!d) { w.setPadding(12, 12, 12, 12); kopf(w, C, null); w.addSpacer(6); txt(w, "Tippen, um Jarvis einzurichten.", F.text(12), C.tx, 3); return w; }
  if (fam === "accessoryRectangular" || fam === "accessoryInline") {
    const n = d.termine[0]; txt(w, n ? n.s + " " + n.ti : "Keine Termine mehr", F.fett(13), Color.white());
    txt(w, (d.auf.heute + d.auf.ueber) + " Aufgaben" + (d.los ? " · los " + d.los.at : ""), F.text(12), Color.white()); return w;
  }
  const klein = fam === "small", gross = fam === "large";
  w.setPadding(klein ? 12 : 14, 14, klein ? 12 : 14, 14);
  kopf(w, C, d, gross); w.addSpacer(4); linie(w, C); w.addSpacer(klein ? 6 : 8);
  const n = d.termine.length;
  if (klein) {
    const t = d.termine[0];
    if (t) { txt(w, "ALS NÄCHSTES · " + t.s, F.fett(11), C.ac); txt(w, t.ti, F.titel(16), C.tx, 2);
      const t2 = d.termine[1]; if (t2) { w.addSpacer(4); txt(w, t2.s + " " + t2.ti, F.text(11), C.mu); } }
    else txt(w, "Heute keine Termine mehr", F.fett(14), C.tx, 2);
    w.addSpacer();
    if (u) uhrZeile(w, C, u, true);
    else if (d.los) txt(w, "LOS UM " + d.los.at, F.fett(12), C.st);
    else txt(w, (d.auf.heute + d.auf.ueber) + " AUFGABEN" + (d.auf.ueber ? " · " + d.auf.ueber + " ÜBERF." : ""), F.fett(11), d.auf.ueber ? C.st : C.mu);
    return w;
  }
  const reihe = w.addStack(); reihe.layoutHorizontally(); reihe.topAlignContent();
  const li = reihe.addStack(); li.layoutVertically(); reihe.addSpacer(10);
  const re = reihe.addStack(); re.layoutVertically(); re.size = new Size(gross ? 120 : 110, 0);
  txt(li, "HEUTE", F.fett(11), C.ac); li.addSpacer(2);
  if (n) d.termine.slice(0, gross ? 5 : 3).forEach((t) => termin(li, C, t, gross ? 14 : 12));
  else txt(li, "Keine Termine mehr", F.text(12), C.mu);
  if (gross && d.wetter) { li.addSpacer(8); txt(li, "WETTER", F.fett(11), C.ac); li.addSpacer(2); txt(li, d.wetter.hi + "° / " + d.wetter.lo + "°, " + d.wetter.tx + (d.wetter.regen >= 30 ? ", Regen " + d.wetter.regen + " %" : ""), F.text(13), C.tx, 2); }
  if (gross && d.morgen.length) { li.addSpacer(8); txt(li, "MORGEN", F.fett(11), C.ac); li.addSpacer(2); d.morgen.forEach((t) => termin(li, C, t, 13)); }
  txt(re, "AUFGABEN", F.fett(11), C.ac);
  txt(re, String(d.auf.heute + d.auf.ueber), F.zahl(gross ? 30 : 24), d.auf.ueber ? C.st : C.tx);
  if (d.auf.ueber) txt(re, d.auf.ueber + " überfällig", F.text(11), C.st);
  if (gross) d.auf.top.forEach((x) => txt(re, "· " + x, F.text(12), C.tx));
  re.addSpacer(4);
  txt(re, "WOCHE " + String(d.woche.h).replace(".", ",") + "/" + d.woche.lim, F.fett(11), d.woche.lvl === "g" ? C.mu : C.st);
  if (d.gew && d.gew.soll) txt(re, "GEWOHNH. " + d.gew.ist + "/" + d.gew.soll, F.fett(11), C.mu);
  w.addSpacer();
  const unten = w.addStack(); unten.layoutHorizontally(); unten.centerAlignContent();
  if (u) uhrZeile(unten, C, u, false);
  else if (d.los) txt(unten, "LOSFAHREN SPÄTESTENS " + d.los.at + " · " + d.los.ti, F.fett(12), C.st);
  unten.addSpacer();
  const st = new Date(d.at); txt(unten, "Stand " + String(st.getHours()).padStart(2, "0") + ":" + String(st.getMinutes()).padStart(2, "0"), F.text(10), C.mu);
  return w;
}

/* ---------- Start ---------- */
let c = cfg();
if (config.runsInWidget) {
  Script.setWidget(bauen(c ? await laden(c) : null, config.widgetFamily));
} else if (args.shortcutParameter != null && args.shortcutParameter !== "") {
  if (!c) Script.setShortcutOutput("Jarvis ist noch nicht eingerichtet. Öffne das Skript einmal in Scriptable.");
  else Script.setShortcutOutput(await auftrag(c, typeof args.shortcutParameter === "string" ? args.shortcutParameter : JSON.stringify(args.shortcutParameter)));
} else {
  if (!c) c = await einrichten();
  if (c) {
    if (config.runsInApp && !args.queryParameters.vorschau) await menue(c);
    const d = await laden(c); const w = bauen(d, "medium"); await w.presentMedium();
  }
}
Script.complete();
