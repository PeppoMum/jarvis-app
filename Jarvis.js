// Jarvis für Scriptable (kostenlose App fürs iPhone): Widget im Look „Sanfter Verlauf“ und Kurzbefehle.
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

/* ---------- Widget bauen (Look „Sanfter Verlauf“: weicher Farbverlauf, runde iPhone-Schrift) ---------- */
// Hell und dunkel richten sich nach dem Handy: jede Farbe hat eine helle und eine dunkle Fassung.
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const zuHex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const helligkeit = (h) => { const c = hx(h).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const kontrast = (a, b) => { const x = helligkeit(a), y = helligkeit(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mischen = (a, b, t) => { const x = hx(a), y = hx(b); return zuHex(x.map((v, i) => v + (y[i] - v) * t)); };
// Schrift so lange heller/dunkler machen, bis sie auf allen Hintergründen gut lesbar ist (wie in der App: 4,5)
function lesbar(fg, bgs) { const zu = helligkeit(bgs[0]) < .2 ? "#FFFFFF" : "#000000"; let t = 0, f = fg; while (bgs.some((b) => kontrast(f, b) < 4.5) && t < 1) { t += .05; f = mischen(fg, zu, t); } return f; }
function satz(x, dunkel) {
  const a = dunkel ? mischen(x.ac, "#000000", .62) : mischen(x.ac, "#FFFFFF", .82);
  const b = dunkel ? mischen(x.st, "#000000", .68) : mischen(x.st, "#FFFFFF", .86);
  const glas = dunkel ? mischen(a, "#FFFFFF", .12) : mischen(b, "#FFFFFF", .55), flaechen = [a, b, glas];
  return { a, b, tx: dunkel ? "#FFFFFF" : "#1F1A17", mu: lesbar(dunkel ? "#D6CCC4" : "#5C524B", flaechen), ac: lesbar(x.ac, flaechen), stx: lesbar(x.st, flaechen), st: x.st, onst: x.onst };
}
function farben(d) {
  const p = FARBEN[(d && d.farbe) || "rotgold"] || FARBEN.rotgold, l = satz(p.l, false), n = satz(p.d, true), o = {};
  Object.keys(l).forEach((k) => { o[k] = Color.dynamic(new Color(l[k]), new Color(n[k])); });
  o.glas = Color.dynamic(new Color("#FFFFFF", .55), new Color("#FFFFFF", .12));
  return o;
}
const R = { schwer: (n) => Font.heavyRoundedSystemFont(n), fett: (n) => Font.boldRoundedSystemFont(n), halb: (n) => Font.semiboldRoundedSystemFont(n) };
function txt(s, t, font, color, lines) { const w = s.addText(String(t)); w.font = font; w.textColor = color; w.lineLimit = lines || 1; w.minimumScaleFactor = 0.75; return w; }
function zeichen(s, name, color, gr) { const sy = SFSymbol.named(name); if (!sy) return; sy.applyFont(Font.boldSystemFont(gr)); const i = s.addImage(sy.image); i.tintColor = color; i.imageSize = new Size(gr + 2, gr + 2); }
function hintergrund(w, C) { const g = new LinearGradient(); g.colors = [C.a, C.b]; g.locations = [0, 1]; g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1); w.backgroundGradient = g; w.backgroundColor = C.a; }
function wetterZeichen(we) { const t = String(we.tx || "").toLowerCase(); if (/gewitter/.test(t)) return "cloud.bolt.rain.fill"; if (/schnee/.test(t)) return "cloud.snow.fill"; if (we.regen >= 40 || /regen|schauer/.test(t)) return "cloud.rain.fill"; if (/nebel/.test(t)) return "cloud.fog.fill"; if (/sonn|klar|heiter/.test(t)) return "sun.max.fill"; return "cloud.sun.fill"; }
function kopf(w, C, d, klein) {
  const k = w.addStack(); k.layoutHorizontally(); k.centerAlignContent();
  txt(k, "Heute", R.schwer(14), C.tx); k.addSpacer();
  if (d && d.wetter) { zeichen(k, wetterZeichen(d.wetter), C.mu, 11); k.addSpacer(4);
    txt(k, d.wetter.hi + "°" + (!klein && d.wetter.regen >= 40 ? " · " + d.wetter.regen + " %" : ""), R.fett(13), C.mu); }
}
// Rundes Schild unten: läuft eine Zeit, steht dort die Uhr, sonst Losfahren
function schild(s, C, d, u, klein) {
  if (!u && !d.los) return false;
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.backgroundColor = C.st; z.cornerRadius = 11; z.setPadding(4, 10, 4, 10);
  if (u) {
    zeichen(z, u.pause ? "pause.fill" : "timer", C.onst, 11); z.addSpacer(5);
    txt(z, (u.pause ? "Pause · " : "") + u.cat + " ", R.schwer(12), C.onst);
    if (u.pause) txt(z, dauer(u.pause - u.seit - (u.pausedMs || 0)), R.schwer(12), C.onst);
    else { const dt = z.addDate(new Date(u.seit + (u.pausedMs || 0))); dt.applyTimerStyle(); dt.font = R.schwer(12); dt.textColor = C.onst; dt.lineLimit = 1; }
  } else { zeichen(z, "car.fill", C.onst, 11); z.addSpacer(5); txt(z, (klein ? "Los " : "Losfahren ") + d.los.at, R.schwer(12), C.onst); }
  return true;
}
const dauer = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
function termin(s, C, t, gr) {
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const a = z.addStack(); a.size = new Size(gr * 3, 0); txt(a, t.s, R.schwer(gr), C.ac); z.addSpacer(4);
  txt(z, t.ti, R.fett(gr), C.tx); z.addSpacer(0);
}
function bauen(d, fam) {
  const w = new ListWidget(), C = farben(d), u = uhrJetzt(d);
  hintergrund(w, C); w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  if (!d) { w.setPadding(14, 16, 14, 16); txt(w, "Jarvis", R.schwer(15), C.tx); w.addSpacer(6); txt(w, "Tippen, um Jarvis einzurichten.", R.fett(13), C.mu, 3); return w; }
  if (fam === "accessoryRectangular" || fam === "accessoryInline") {
    const n = d.termine[0]; txt(w, n ? n.s + " " + n.ti : "Keine Termine mehr", R.fett(13), Color.white());
    txt(w, (d.auf.heute + d.auf.ueber) + " Aufgaben" + (d.los ? " · los " + d.los.at : ""), R.halb(12), Color.white()); return w;
  }
  const klein = fam === "small", gross = fam === "large", n = d.termine.length;
  w.setPadding(14, klein ? 14 : 16, 14, klein ? 14 : 16);
  kopf(w, C, d, klein); w.addSpacer(klein ? 6 : 7);
  if (klein) {
    if (n) d.termine.slice(0, 2).forEach((t, i) => { if (i) w.addSpacer(4); txt(w, t.s, R.schwer(12), C.ac); txt(w, t.ti, R.fett(13), C.tx); });
    else txt(w, "Heute keine Termine mehr", R.fett(13), C.tx, 2);
    w.addSpacer();
    if (!schild(w, C, d, u, true)) { const a = d.auf.heute + d.auf.ueber; txt(w, a + (a === 1 ? " Aufgabe" : " Aufgaben") + (d.auf.ueber ? ", " + d.auf.ueber + " überfällig" : ""), R.fett(12), d.auf.ueber ? C.stx : C.mu); }
    return w;
  }
  const reihe = w.addStack(); reihe.layoutHorizontally(); reihe.topAlignContent();
  const li = reihe.addStack(); li.layoutVertically(); li.spacing = gross ? 3 : 2; reihe.addSpacer(10);
  if (n) d.termine.slice(0, gross ? 4 : 3).forEach((t) => termin(li, C, t, gross ? 15 : 13.5));
  else txt(li, "Heute keine Termine mehr", R.fett(13.5), C.mu);
  if (gross && d.wetter) { li.addSpacer(10); txt(li, "Wetter", R.schwer(11), C.mu); txt(li, d.wetter.hi + "° / " + d.wetter.lo + "°, " + d.wetter.tx + (d.wetter.regen >= 30 ? ", Regen " + d.wetter.regen + " %" : ""), R.fett(13), C.tx, 2); }
  if (gross && d.morgen.length) { li.addSpacer(10); txt(li, "Morgen", R.schwer(11), C.mu); d.morgen.forEach((t) => termin(li, C, t, 13)); }
  reihe.addSpacer();
  const re = reihe.addStack(); re.layoutVertically(); re.backgroundColor = C.glas; re.cornerRadius = 14; re.setPadding(8, 10, 8, 10); re.size = new Size(gross ? 128 : 108, 0);
  txt(re, "Aufgaben", R.schwer(11), C.mu);
  txt(re, String(d.auf.heute + d.auf.ueber), Font.blackRoundedSystemFont(gross ? 32 : 28), C.tx);
  if (d.auf.ueber) txt(re, d.auf.ueber + " überfällig", R.fett(11.5), C.stx);
  if (gross && d.auf.top.length) { re.addSpacer(4); d.auf.top.forEach((x) => txt(re, "· " + x, R.halb(12), C.tx)); }
  re.addSpacer(3);
  txt(re, "Woche " + String(d.woche.h).replace(".", ",") + "/" + d.woche.lim, R.fett(11.5), d.woche.lvl === "g" ? C.mu : C.stx);
  if (d.gew && d.gew.soll) txt(re, "Gewohnh. " + d.gew.ist + "/" + d.gew.soll, R.fett(11.5), C.mu);
  w.addSpacer();
  const unten = w.addStack(); unten.layoutHorizontally(); unten.centerAlignContent();
  schild(unten, C, d, u, false);
  unten.addSpacer();
  const st = new Date(d.at); txt(unten, "Stand " + String(st.getHours()).padStart(2, "0") + ":" + String(st.getMinutes()).padStart(2, "0"), R.fett(11), C.mu);
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
