// Jarvis für Scriptable (kostenlose App fürs iPhone): Widget im Look „Als Nächstes“ (Farben wie die App) und Kurzbefehle.
// Einrichtung: siehe widget/ANLEITUNG.md. Beim ersten Start fragt das Skript nach dem Einrichtungs-Code aus der Jarvis-App
// (Mehr › Einstellungen › Meldungen › Widget einrichten).
//
// Als Widget: zeigt Termine, Losfahren, Wetter und die Woche. Antippen öffnet das Menü.
// Aus Kurzbefehlen (Aktion „Skript ausführen“, Parameter):  notiz:<Text> · claude
// Ohne Parameter in Scriptable geöffnet: Menü mit Notiz und Claude öffnen.

const KEY = "jarvis.cfg", LAST = "jarvis.last", CACHE = "jarvis.widget", CLAUDE = "jarvis.claude";
// Farben der drei App-Looks Plakat, Smaragd Ruhig, Nur das Jetzt (wie in css/looks.css der App); das Widget nimmt den Look, der in der App eingestellt ist
const kat = (h) => ({ uni: h ? "#4F6A80" : "#9AAEC0", arbeit: h ? "#8F6420" : "#D4AA66", team: h ? "#4F7050" : "#9DB89A", alltag: h ? "#7A5C7E" : "#B99DB6" });
const LOOKS = {
  smaragd: { l: { bg1: "#F3F2EC", bg2: "#EEEEE6", card: "#FFFFFF", ln: "#DCE3DC", tx: "#0F2A22", mu: "#52645B", ac: "#0B5D47", onac: "#FFFFFF", acs: "#DDEEE5", onacs: "#0B4A39", red: "#B3261E", ...kat(1) },
             d: { bg1: "#1B1B1A", bg2: "#151514", card: "#242423", ln: "#363633", tx: "#F2F1EC", mu: "#ADACA5", ac: "#7FD3A8", onac: "#0B2A1E", acs: "#24392F", onacs: "#A8E6C6", red: "#F28B82", ...kat(0) } },
  plakat: { l: { bg1: "#FFFFFF", bg2: "#FFFFFF", card: "#F2F2F2", ln: "#0A0A0A", tx: "#0A0A0A", mu: "#555555", ac: "#D7000F", onac: "#FFFFFF", acs: "#FFE3E5", onacs: "#A5000B", red: "#D7000F", ...kat(1) },
            d: { bg1: "#000000", bg2: "#000000", card: "#1F1F1F", ln: "#F5F5F5", tx: "#F5F5F5", mu: "#B0B0B0", ac: "#FF4D57", onac: "#0A0A0A", acs: "#3A1416", onacs: "#FFB3B8", red: "#FF4D57", ...kat(0) } },
  ruhe: { l: { bg1: "#EFEBE4", bg2: "#EFEBE4", card: "#FFFFFF", ln: "#E2DCD2", tx: "#2B2622", mu: "#5F5850", ac: "#0E6E54", onac: "#FFFFFF", acs: "#DCEFE7", onacs: "#0A4F3D", red: "#B3261E", ...kat(1) },
          d: { bg1: "#1B1918", bg2: "#1B1918", card: "#2A2725", ln: "#3A3633", tx: "#F1ECE6", mu: "#B5ACA2", ac: "#8FDCBF", onac: "#0A2E22", acs: "#1E3A30", onacs: "#8FDCBF", red: "#E8746B", ...kat(0) } }
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
  else if (/^(start|pause|weiter|stop|feierabend|ende)\b/.test(low)) return "Die Zeiterfassung gibt es in Jarvis nicht mehr. Diesen Kurzbefehl kannst du löschen.";
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
  ["Notiz diktieren", "Claude öffnen", "Claude-Link ändern", "Einrichtung ändern"].forEach((x) => a.addAction(x)); a.addCancelAction("Abbrechen");
  const i = await a.presentSheet(); if (i === -1) return "zu";
  if (i === 1) { await claudeOeffnen(); return "zu"; }
  if (i === 2) { if (await claudeLink(true)) await hinweis("Gespeichert", "„Claude öffnen“ führt jetzt zu diesem Link."); return; }
  if (i === 3) { await einrichten(); return; }
  let t = ""; try { t = await Dictation.start("de-DE"); } catch (e) { }
  if (!t) { const b = new Alert(); b.title = "Notiz"; b.addTextField("z. B. Milch kaufen"); b.addAction("Senden"); b.addCancelAction("Abbrechen"); if (await b.presentAlert() === -1) return; t = b.textFieldValue(0); }
  await hinweis("Jarvis", await auftrag(c, "notiz:" + t));
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
  const p = LOOKS[d && d.skin] || LOOKS.plakat, o = {};
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
  // Eine Fahrt ist nie „Als Nächstes“, sie steht nur blass in der Liste (wie in der App)
  const nx = offen.find((t) => !t.f) || offen[0];
  if (nx) return { nx, rest: offen.filter((t) => t !== nx && !(t.f && t.s < nx.s)), laeuft: d.tag === heute && ms(nx.s) <= j.getTime(), ab: ms(nx.s), bis: nx.e ? ms(nx.e) : null };
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
  txt(s, "Woche " + String(d.woche.h).replace(".", ",") + "/" + d.woche.lim, F.halb(12), d.woche.lvl === "g" ? C.mu : C.red);
}
/* ---------- Plakat (12.11.2026, wie im Design-Board „4b Plakat rund“): riesige Uhrzeit, rote Zeile, dicke Schrift, keine Kästen ---------- */
// Rote Zeile über dem Termin: JETZT / IN 60 MIN / MORGEN
function pZeile(s, C, p, gr) {
  if (!p.nx) { txt(s, "HEUTE", F.schwer(gr), C.ac); return; }
  if (p.nx.morgen) { txt(s, "MORGEN", F.schwer(gr), C.ac); return; }
  if (p.laeuft) { txt(s, "JETZT", F.schwer(gr), C.ac); return; }
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const dt = z.addDate(new Date(p.ab)); dt.applyRelativeStyle(); dt.font = F.schwer(gr); dt.textColor = C.ac; dt.lineLimit = 1;
}
// Unterzeile: „noch 50 Min“ während er läuft, sonst „bis 15:30 · Ort“
function pUnter(p) {
  if (!p.nx) return "";
  if (p.laeuft && p.bis) { const m = Math.max(1, Math.round((p.bis - Date.now()) / 60000)); return "noch " + (m >= 60 ? Math.floor(m / 60) + " Std " + (m % 60 ? (m % 60) + " Min" : "") : m + " Min").trim(); }
  return [p.nx.e ? "bis " + p.nx.e : "", p.nx.o || ""].filter(Boolean).join(" · ");
}
// Listenzeile: Uhrzeit fett, Titel; Fahrten blass
function pListe(s, C, t, gr) {
  const z = s.addStack(); z.layoutHorizontally(); z.centerAlignContent();
  const a = z.addStack(); a.size = new Size(gr * 3.1, 0); txt(a, t.s, t.f ? F.halb(gr - 1) : F.schwer(gr), t.f ? C.mu : C.tx); a.addSpacer();
  z.addSpacer(4); txt(z, t.ti, t.f ? F.normal(gr - 1) : F.halb(gr), t.f ? C.mu : C.tx); z.addSpacer();
}
function pLos(s, C, d) { if (!d.los) return; txt(s, "Losfahren " + d.los.at, F.schwer(12), C.ac); }
function pWoche(s, C, d) { txt(s, "Woche " + String(d.woche.h).replace(".", ",") + "/" + d.woche.lim, F.halb(11.5), d.woche.lvl === "g" ? C.mu : C.red); }
function plakat(w, C, d, p, fam) {
  if (fam === "small") {
    w.setPadding(15, 15, 15, 15);
    const k = w.addStack(); k.layoutHorizontally(); k.centerAlignContent(); pZeile(k, C, p, 12); k.addSpacer(); wetter(k, C, d, 11);
    w.addSpacer();
    if (!p.nx) { txt(w, "Nichts mehr", F.schwer(26), C.tx, 2); w.addSpacer(); pWoche(w, C, d); return w; }
    const u = txt(w, p.nx.s, F.schwer(46), C.tx); u.minimumScaleFactor = 0.6; w.addSpacer(2);
    txt(w, p.nx.ti, F.schwer(15), C.tx, 2);
    if (d.los && !p.laeuft && !p.nx.morgen) { w.addSpacer(3); pLos(w, C, d); }
    return w;
  }
  if (fam === "large") {
    w.setPadding(18, 18, 18, 18);
    const k = w.addStack(); k.layoutHorizontally(); k.centerAlignContent(); txt(k, d.tagText || "Heute", F.fett(13), C.tx); k.addSpacer(); wetter(k, C, d, 12);
    w.addSpacer(10);
    if (p.nx) {
      const u = txt(w, p.nx.s, F.schwer(64), C.tx); u.minimumScaleFactor = 0.6;
      pZeile(w, C, p, 13); w.addSpacer(1);
      txt(w, p.nx.ti, F.schwer(26), C.tx, 2);
      const un = pUnter(p); if (un) txt(w, un, F.halb(14), C.tx);
      if (d.los && !p.laeuft && !p.nx.morgen) { w.addSpacer(3); pLos(w, C, d); }
    } else txt(w, "Heute keine Termine mehr", F.schwer(24), C.tx, 2);
    w.addSpacer(10);
    const reihen = (p.nx && p.nx.morgen ? d.morgen.slice(1, 5) : p.rest.slice(0, 4)).concat(!p.nx || p.nx.morgen ? [] : d.morgen.slice(0, Math.max(0, 3 - p.rest.length)).map((t) => ({ ...t, ti: "Morgen: " + t.ti })));
    reihen.forEach((t) => { const l = w.addStack(); l.size = new Size(0, t.f ? 1 : 2); l.backgroundColor = t.f ? C.mu : C.ln; l.addSpacer(); w.addSpacer(5); pListe(w, C, t, 15); w.addSpacer(5); });
    if (reihen.length) { const l = w.addStack(); l.size = new Size(0, 2); l.backgroundColor = C.ln; l.addSpacer(); }
    w.addSpacer();
    const f = w.addStack(); f.layoutHorizontally(); pWoche(f, C, d); f.addSpacer();
    const st = new Date(d.at); txt(f, "Stand " + String(st.getHours()).padStart(2, "0") + ":" + String(st.getMinutes()).padStart(2, "0"), F.halb(10.5), C.mu);
    return w;
  }
  // mittel: links Termin groß, dicke Linie, rechts die nächsten Zeiten
  w.setPadding(15, 18, 15, 18);
  const r = w.addStack(); r.layoutHorizontally(); r.topAlignContent();
  const li = r.addStack(); li.layoutVertically(); li.size = new Size(128, 140);
  pZeile(li, C, p, 12); li.addSpacer(4);
  if (p.nx) {
    txt(li, p.nx.ti, F.schwer(22), C.tx, 3);
    li.addSpacer();
    txt(li, p.laeuft ? pUnter(p) : p.nx.s + (p.nx.e ? "–" + p.nx.e : ""), F.halb(12.5), C.tx, 1);
    if (d.los && !p.laeuft && !p.nx.morgen) pLos(li, C, d);
  } else { txt(li, "Heute nichts mehr", F.schwer(22), C.tx, 2); li.addSpacer(); }
  r.addSpacer(12);
  const strich = r.addStack(); strich.size = new Size(2, 140); strich.backgroundColor = C.ln;
  r.addSpacer(12);
  const re = r.addStack(); re.layoutVertically(); re.size = new Size(0, 140);
  const ob = re.addStack(); ob.layoutHorizontally(); ob.addSpacer(); wetter(ob, C, d, 11); re.addSpacer(4);
  const liste = re.addStack(); liste.layoutVertically(); liste.spacing = 6;
  // Abends steht der erste Termin von morgen groß links, rechts dann die weiteren von morgen
  const reihen = p.nx && p.nx.morgen ? d.morgen.slice(1, 5) : p.rest.slice(0, 4);
  if (!reihen.length && d.morgen.length && !(p.nx && p.nx.morgen)) reihen.push({ ...d.morgen[0], ti: "Morgen " + d.morgen[0].ti });
  reihen.forEach((t) => pListe(liste, C, t, 13.5));
  re.addSpacer(); pWoche(re, C, d);
  return w;
}

function bauen(d, fam) {
  const w = new ListWidget(), C = farben(d), u = uhrJetzt(d);
  hintergrund(w, C); w.refreshAfterDate = new Date(Date.now() + 10 * 60000);
  if (!d) { w.setPadding(14, 16, 14, 16); txt(w, "Jarvis", F.schwer(15), C.tx); w.addSpacer(6); txt(w, "Tippen, um Jarvis einzurichten.", F.halb(13), C.mu, 3); return w; }
  const p = plan(d);
  if (fam === "accessoryRectangular" || fam === "accessoryInline") {
    if (p.nx && fam === "accessoryRectangular") { txt(w, (p.nx.morgen ? "Morgen " : "") + p.nx.s, F.schwer(20), Color.white()); txt(w, p.nx.ti, F.fett(13), Color.white()); }
    else txt(w, p.nx ? (p.nx.morgen ? "Morgen " : "") + p.nx.s + " " + p.nx.ti : "Keine Termine mehr", F.fett(13), Color.white());
    if (d.los) txt(w, "Los " + d.los.at, F.halb(12), Color.white());
    return w;
  }
  if (!d.skin || d.skin === "plakat") return plakat(w, C, d, p, fam);
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
    schild(w, C, d, u, true);
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
