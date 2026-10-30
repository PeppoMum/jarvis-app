// Jarvis für Scriptable (kostenlose App fürs iPhone): Widget im Look „Als Nächstes“ (Farben wie die App) und Kurzbefehle.
// Einrichtung: siehe widget/ANLEITUNG.md. Beim ersten Start fragt das Skript nach dem Einrichtungs-Code aus der Jarvis-App
// (Mehr › Einstellungen › Meldungen › Widget einrichten).
//
// Als Widget: zeigt Termine, Losfahren, Aufgaben, Wetter, Woche und die laufende Zeit. Antippen öffnet das Menü.
// Aus Kurzbefehlen (Aktion „Skript ausführen“, Parameter):  start · start:uni · pause · stopp · notiz:<Text> · claude
// Ohne Parameter in Scriptable geöffnet: Menü mit Arbeit starten, Pause, Feierabend, Notiz, Claude öffnen.

const KEY = "jarvis.cfg", LAST = "jarvis.last", CACHE = "jarvis.widget", CLAUDE = "jarvis.claude";
// Farben der drei App-Looks (wie in css/looks.css der App); das Widget nimmt den Look, der in der App eingestellt ist
const kat = (h) => ({ uni: h ? "#4F6A80" : "#9AAEC0", arbeit: h ? "#8F6420" : "#D4AA66", team: h ? "#4F7050" : "#9DB89A", alltag: h ? "#7A5C7E" : "#B99DB6" });
const LOOKS = {
  smaragd: { l: { bg1: "#F3F2EC", bg2: "#EEEEE6", card: "#FFFFFF", ln: "#DCE3DC", tx: "#0F2A22", mu: "#52645B", ac: "#0B5D47", onac: "#FFFFFF", acs: "#DDEEE5", onacs: "#0B4A39", red: "#B3261E", ...kat(1) },
             d: { bg1: "#1B1B1A", bg2: "#151514", card: "#242423", ln: "#363633", tx: "#F2F1EC", mu: "#ADACA5", ac: "#7FD3A8", onac: "#0B2A1E", acs: "#24392F", onacs: "#A8E6C6", red: "#F28B82", ...kat(0) } },
  glas: { l: { bg1: "#D6E8EA", bg2: "#F4E3DD", card: ["#FFFFFF", .72], ln: ["#0F3C46", .12], tx: "#10262C", mu: "#465E68", ac: "#0F5C6E", onac: "#FFFFFF", acs: "#D3EBEC", onacs: "#0B4452", red: "#B93A2A", ...kat(1) },
          d: { bg1: "#0C2328", bg2: "#1E1515", card: ["#FFFFFF", .07], ln: ["#FFFFFF", .12], tx: "#EAF3F2", mu: "#A3B9BB", ac: "#FF9A85", onac: "#2B0E08", acs: "#3A2A2A", onacs: "#FFC9BC", red: "#FF8A7A", ...kat(0) } },
  polar: { l: { bg1: "#F1F4F8", bg2: "#EAEFF5", card: "#FFFFFF", ln: "#D6DFEA", tx: "#0C1A2C", mu: "#556377", ac: "#0A62C2", onac: "#FFFFFF", acs: "#DCEAFB", onacs: "#0A4C96", red: "#C42B32", ...kat(1) },
           d: { bg1: "#1A1C1E", bg2: "#141617", card: "#232527", ln: "#36393D", tx: "#EEF0F2", mu: "#A9AEB4", ac: "#7DBBFF", onac: "#071E36", acs: "#23344A", onacs: "#B5D7FF", red: "#FF8A8F", ...kat(0) } }
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
/* ---------- Claude öffnen (Link zum Planungs-Projekt, wird einmal eingefügt und gemerkt) ---------- */
const istClaudeLink = (t) => /^https:\/\/claude\.ai\/\S+$/.test(String(t || "").trim());
async function claudeLink(neu) {
  if (!neu && Keychain.contains(CLAUDE)) return Keychain.get(CLAUDE);
  const a = new Alert(); a.title = "Claude-Projekt";
  a.message = "Füge den Link zu deinem Planungs-Projekt in Claude ein. Den Link bekommst du in Claude im Projekt über „Teilen“ oder oben aus der Adresszeile.";
  const z = Pasteboard.pasteString() || ""; a.addTextField("https://claude.ai/…", istClaudeLink(z) ? z.trim() : (Keychain.contains(CLAUDE) ? Keychain.get(CLAUDE) : ""));
  a.addAction("Speichern"); a.addCancelAction("Abbrechen");
  if (await a.presentAlert() === -1) return null;
  const t = a.textFieldValue(0).trim();
  if (!istClaudeLink(t)) { await hinweis("Das hat nicht geklappt", "Der Link muss mit https://claude.ai/ anfangen."); return null; }
  Keychain.set(CLAUDE, t); return t;
}
async function claudeOeffnen() { const u = await claudeLink(false); if (u) Safari.open(u); }

async function menue(c) {
  const a = new Alert(); a.title = "Jarvis";
  ["Arbeit starten", "Uni starten", "Pause / weiter", "Feierabend (Stopp)", "Notiz diktieren", "Claude öffnen", "Claude-Link ändern", "Einrichtung ändern"].forEach((x) => a.addAction(x)); a.addCancelAction("Abbrechen");
  const i = await a.presentSheet(); if (i === -1) return "zu";
  if (i === 5) { await claudeOeffnen(); return "zu"; }
  if (i === 6) { if (await claudeLink(true)) await hinweis("Gespeichert", "„Claude öffnen“ führt jetzt zu diesem Link."); return; }
  if (i === 7) { await einrichten(); return; }
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

/* ---------- Widget bauen (Look „Als Nächstes“ in den Farben der App) ---------- */
// Hell und dunkel richten sich nach dem Handy: jede Farbe hat eine helle und eine dunkle Fassung.
function farben(d) {
  const p = LOOKS[d && d.skin] || LOOKS.smaragd, o = {};
  Object.keys(p.l).forEach((k) => { const f = (x) => Array.isArray(x) ? new Color(x[0], x[1]) : new Color(x); o[k] = Color.dynamic(f(p.l[k]), f(p.d[k])); });
  return o;
}
const F = { schwer: (n) => Font.heavySystemFont(n), fett: (n) => Font.boldSystemFont(n), halb: (n) => Font.semiboldSystemFont(n), normal: (n) => Font.mediumSystemFont(n) };
function txt(s, t, font, color, lines) { const w = s.addText(String(t)); w.font = font; w.textColor = color; w.lineLimit = lines || 1; w.minimumScaleFactor = 0.75; return w; }
function zeichen(s, name, color, gr) { const sy = SFSymbol.named(name); if (!sy) return; sy.applyFont(Font.boldSystemFont(gr)); const i = s.addImage(sy.image); i.tintColor = color; i.imageSize = new Size(gr + 2, gr + 2); }
function hintergrund(w, C) { const g = new LinearGradient(); g.colors = [C.bg1, C.bg2]; g.locations = [0, 1]; g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1); w.backgroundGradient = g; w.backgroundColor = C.bg1; }
function wetterZeichen(we) { const t = String(we.tx || "").toLowerCase(); if (/gewitter/.test(t)) return "cloud.bolt.rain.fill"; if (/schnee/.test(t)) return "cloud.snow.fill"; if (we.regen >= 40 || /regen|schauer/.test(t)) return "cloud.rain.fill"; if (/nebel/.test(t)) return "cloud.fog.fill"; if (/sonn|klar|heiter/.test(t)) return "sun.max.fill"; return "cloud.sun.fill"; }
function wetter(s, C, d, gr) { if (!d.wetter) return; const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent(); zeichen(z, wetterZeichen(d.wetter), C.mu, gr - 1); z.addSpacer(4); txt(z, d.wetter.hi + "°", F.halb(gr), C.mu); }
const klein = (t) => String(t).toUpperCase();
function kopf(w, C, d, links) { const k = w.addStack(); k.layoutHorizontally(); k.centerAlignContent(); txt(k, klein(links), F.fett(10.5), C.mu); k.addSpacer(); wetter(k, C, d, 12); }
const dauer = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
// Rundes Schild: läuft eine Zeit, steht dort die Uhr, sonst Losfahren
function schild(s, C, d, u, kurz) {
  if (!u && !d.los) return false;
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent(); z.backgroundColor = C.ac; z.cornerRadius = 10; z.setPadding(3, 9, 3, 9);
  if (u) {
    zeichen(z, u.pause ? "pause.fill" : "timer", C.onac, 10); z.addSpacer(5);
    txt(z, (u.pause ? "Pause · " : "") + (kurz ? "" : u.cat + " "), F.fett(11.5), C.onac);
    if (u.pause) txt(z, dauer(u.pause - u.seit - (u.pausedMs || 0)), F.fett(11.5), C.onac);
    else { const dt = z.addDate(new Date(u.seit + (u.pausedMs || 0))); dt.applyTimerStyle(); dt.font = F.fett(11.5); dt.textColor = C.onac; dt.lineLimit = 1; }
  } else { zeichen(z, "car.fill", C.onac, 10); z.addSpacer(5); txt(z, (kurz ? "Los " : "Losfahren ") + d.los.at, F.fett(11.5), C.onac); }
  return true;
}
// Termin-Zeile wie im Tagesplan der App: farbiger Strich je Bereich, Uhrzeit, Titel (optional „bis … · Ort“)
function zeile(s, C, t, gr, bis) {
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const l = z.addStack(); l.size = new Size(3, bis ? gr * 2.3 : gr * 1.25); l.cornerRadius = 1.5; l.backgroundColor = C[t.k] || C.mu; z.addSpacer(8);
  const v = z.addStack(); v.layoutVertically();
  const h = v.addStack(); h.layoutHorizontally(); h.centerAlignContent();
  const a = h.addStack(); a.size = new Size(gr * 3.4, 0); txt(a, t.s, F.fett(gr), C.tx); a.addSpacer(); h.addSpacer(6); txt(h, t.ti, F.halb(gr), C.tx);
  if (bis && (t.e || t.o)) { const u = v.addStack(); u.addSpacer(gr * 3.4 + 6); txt(u, [t.e ? "bis " + t.e : "", t.o || ""].filter(Boolean).join(" · "), F.normal(gr - 2.5), C.mu); }
  z.addSpacer();
}
// Was kommt als Nächstes? Termine, die schon vorbei sind, fallen raus (das Widget frischt sich seltener auf als die Uhr läuft)
function plan(d) {
  const j = new Date(), heute = j.getFullYear() + "-" + String(j.getMonth() + 1).padStart(2, "0") + "-" + String(j.getDate()).padStart(2, "0");
  const ms = (hm) => { const [h, m] = String(hm).split(":").map(Number); const x = new Date(j); x.setHours(h, m || 0, 0, 0); return x.getTime(); };
  const offen = d.tag === heute ? d.termine.filter((t) => ms(t.e || t.s) > j.getTime()) : d.termine;
  const nx = offen[0];
  if (nx) return { nx, rest: offen.slice(1), laeuft: d.tag === heute && ms(nx.s) <= j.getTime(), ab: ms(nx.s) };
  return { nx: d.morgen[0] ? { ...d.morgen[0], morgen: true } : null, rest: [], laeuft: false };
}
function naechstKarte(s, C, p, gr) {
  const k = s.addStack(); k.layoutVertically(); k.backgroundColor = C.card; k.borderColor = C.ln; k.borderWidth = 1; k.cornerRadius = 12; k.setPadding(gr > 15 ? 11 : 8, 11, gr > 15 ? 11 : 8, 11);
  const o = k.addStack(); o.layoutHorizontally(); o.centerAlignContent();
  txt(o, p.nx && p.nx.morgen ? "MORGEN ZUERST" : "ALS NÄCHSTES", F.fett(10.5), C.mu); o.addSpacer(8);
  if (p.nx && !p.nx.morgen) {
    const pi = o.addStack(); pi.backgroundColor = C.acs; pi.cornerRadius = 8; pi.setPadding(2, 7, 2, 7);
    if (p.laeuft) txt(pi, p.nx.e ? "läuft bis " + p.nx.e : "läuft", F.fett(10.5), C.onacs);
    else { const dt = pi.addDate(new Date(p.ab)); dt.applyRelativeStyle(); dt.font = F.fett(10.5); dt.textColor = C.onacs; dt.lineLimit = 1; }
  }
  o.addSpacer(); k.addSpacer(2);
  if (!p.nx) { txt(k, "Heute nichts mehr", F.fett(gr), C.tx); return; }
  txt(k, p.nx.ti, F.fett(gr), C.tx);
  txt(k, p.nx.s + (p.nx.e ? " bis " + p.nx.e : "") + (p.nx.o ? " · " + p.nx.o : ""), F.normal(gr - 3), C.mu);
}
function zahlen(s, C, d, kurz) {
  const a = d.auf.heute + d.auf.ueber;
  txt(s, a + (a === 1 ? " Aufgabe" : " Aufgaben") + (d.auf.ueber ? (kurz ? ", " : ", ") + d.auf.ueber + " überfällig" : ""), F.halb(12), d.auf.ueber ? C.red : C.mu, 2);
  txt(s, "Woche " + String(d.woche.h).replace(".", ",") + "/" + d.woche.lim, F.halb(12), d.woche.lvl === "g" ? C.mu : C.red);
}
function bauen(d, fam) {
  const w = new ListWidget(), C = farben(d), u = uhrJetzt(d);
  hintergrund(w, C); w.refreshAfterDate = new Date(Date.now() + 10 * 60000);
  if (!d) { w.setPadding(14, 16, 14, 16); txt(w, "Jarvis", F.schwer(15), C.tx); w.addSpacer(6); txt(w, "Tippen, um Jarvis einzurichten.", F.halb(13), C.mu, 3); return w; }
  const p = plan(d);
  if (fam === "accessoryRectangular" || fam === "accessoryInline") {
    txt(w, p.nx ? (p.nx.morgen ? "Morgen " : "") + p.nx.s + " " + p.nx.ti : "Keine Termine mehr", F.fett(13), Color.white());
    txt(w, (d.auf.heute + d.auf.ueber) + " Aufgaben" + (d.los ? " · los " + d.los.at : ""), F.halb(12), Color.white()); return w;
  }
  if (fam === "small") {
    w.setPadding(14, 14, 14, 14);
    const k = w.addStack(); k.layoutHorizontally(); k.centerAlignContent();
    if (p.nx && !p.nx.morgen && !p.laeuft) { const dt = k.addDate(new Date(p.ab)); dt.applyRelativeStyle(); dt.font = F.fett(10.5); dt.textColor = C.mu; dt.lineLimit = 1; }
    else txt(k, p.laeuft ? "JETZT" : p.nx ? "MORGEN" : "HEUTE", F.fett(10.5), C.mu);
    k.addSpacer(); wetter(k, C, d, 11); w.addSpacer(6);
    if (p.nx) {
      txt(w, p.nx.s, F.schwer(22), C.ac); w.addSpacer(2);
      txt(w, p.nx.ti, F.fett(14), C.tx, 2);
      const unter = [p.nx.e ? "bis " + p.nx.e : "", p.nx.o || ""].filter(Boolean).join(" · "); if (unter) txt(w, unter, F.normal(11.5), C.mu);
    } else txt(w, "Heute keine Termine mehr", F.fett(14), C.tx, 2);
    w.addSpacer();
    if (!schild(w, C, d, u, true)) { const a = d.auf.heute + d.auf.ueber; txt(w, a + (a === 1 ? " Aufgabe" : " Aufgaben") + (d.auf.ueber ? ", " + d.auf.ueber + " überf." : ""), F.halb(12), d.auf.ueber ? C.red : C.mu); }
    return w;
  }
  if (fam === "large") {
    w.setPadding(16, 16, 16, 16);
    kopf(w, C, d, d.tagText || "Heute"); w.addSpacer(10);
    naechstKarte(w, C, p, 17);
    if (schild(w, C, d, u, false)) w.addSpacer(0);
    w.addSpacer(8);
    if (p.rest.length) { w.addSpacer(6); txt(w, "DANACH", F.fett(10.5), C.mu); w.addSpacer(6); const li = w.addStack(); li.layoutVertically(); li.spacing = 7; p.rest.slice(0, 3).forEach((t) => zeile(li, C, t, 13.5, true)); }
    if (!p.nx || !p.nx.morgen) if (d.morgen.length && p.rest.length < 3) { w.addSpacer(12); txt(w, "MORGEN", F.fett(10.5), C.mu); w.addSpacer(5); const li = w.addStack(); li.layoutVertically(); li.spacing = 5; d.morgen.slice(0, 3 - p.rest.length).forEach((t) => zeile(li, C, t, 12.5)); }
    w.addSpacer();
    const lin = w.addStack(); lin.size = new Size(0, 1); lin.backgroundColor = C.ln; lin.addSpacer(); w.addSpacer(9);
    const f = w.addStack(); f.layoutHorizontally(); f.centerAlignContent();
    const a = d.auf.heute + d.auf.ueber; txt(f, a + (a === 1 ? " Aufgabe" : " Aufgaben") + (d.auf.ueber ? ", " + d.auf.ueber + " überfällig" : ""), F.halb(12), d.auf.ueber ? C.red : C.mu); f.addSpacer(14);
    txt(f, "Woche " + String(d.woche.h).replace(".", ",") + "/" + d.woche.lim, F.halb(12), d.woche.lvl === "g" ? C.mu : C.red); f.addSpacer();
    const st = new Date(d.at); txt(f, "Stand " + String(st.getHours()).padStart(2, "0") + ":" + String(st.getMinutes()).padStart(2, "0"), F.halb(10.5), C.mu);
    return w;
  }
  // mittel
  w.setPadding(14, 16, 14, 16);
  const reihe = w.addStack(); reihe.layoutHorizontally(); reihe.topAlignContent();
  const li = reihe.addStack(); li.layoutVertically();
  naechstKarte(li, C, p, 15); li.addSpacer(8);
  const r = li.addStack(); r.layoutVertically(); r.spacing = 5; p.rest.slice(0, 2).forEach((t) => zeile(r, C, t, 12.5));
  if (!p.rest.length && d.morgen.length && !(p.nx && p.nx.morgen)) zeile(r, C, { ...d.morgen[0], ti: "Morgen: " + d.morgen[0].ti }, 12.5);
  reihe.addSpacer(12);
  const re = reihe.addStack(); re.layoutVertically(); re.size = new Size(112, 142);
  const ob = re.addStack(); ob.layoutHorizontally(); ob.addSpacer(); wetter(ob, C, d, 12);
  re.addSpacer(); zahlen(re, C, d, true); re.addSpacer(5); schild(re, C, d, u, true);
  return w;
}

/* ---------- Start ---------- */
let c = cfg();
if (config.runsInWidget) {
  Script.setWidget(bauen(c ? await laden(c) : null, config.widgetFamily));
} else if (args.shortcutParameter != null && args.shortcutParameter !== "") {
  // Kommt der Parameter als Liste oder mit Leerzeilen an (z. B. über die Aktion „Text“), zählt nur der Text selbst
  let p = args.shortcutParameter; if (Array.isArray(p)) p = p.join(" "); p = typeof p === "string" ? p.trim() : JSON.stringify(p);
  if (/^claude/i.test(p)) { const u = Keychain.contains(CLAUDE) ? Keychain.get(CLAUDE) : null;
    if (u) { Safari.open(u); Script.setShortcutOutput("Claude geht auf."); } else Script.setShortcutOutput("Der Claude-Link fehlt noch. Öffne Jarvis in Scriptable und wähle „Claude-Link ändern“."); }
  else if (!c) Script.setShortcutOutput("Jarvis ist noch nicht eingerichtet. Öffne das Skript einmal in Scriptable.");
  else Script.setShortcutOutput(await auftrag(c, p));
} else if (args.queryParameters.claude) {
  await claudeOeffnen();
} else {
  if (!c) c = await einrichten();
  if (c) {
    const zu = config.runsInApp && !args.queryParameters.vorschau ? await menue(c) : null;
    if (zu !== "zu") { const d = await laden(c); const w = bauen(d, "medium"); await w.presentMedium(); }
  }
}
Script.complete();
