/* Welche Meldung ist gerade dran, und was steht drin? Ohne KI, nur aus Phils Daten.
   Einstellungen stehen in meta/settings unter „push“ (in der App: Einstellungen → Meldungen), sonst gelten diese Vorgaben. */
import { addDays, mondayOf, hmToMin, minToHM, fmtH, fmtMin, fmtLong, WDS, dow } from "./jarvis.mjs";

export const PUSH_DEF = { morgen: true, morgenZeit: "06:45", morgenWE: "09:00", abend: true, abendZeit: "20:45", woche: true, wocheZeit: "18:45",
  losfahren: true, losVor: 15, unwetter: true, konflikt: true };
export const pushCfg = (settings) => ({ ...PUSH_DEF, ...((settings && settings.push) || {}) });
const SPAET = 120;   /* so lange nach der Uhrzeit wird eine Meldung noch nachgeholt (GitHub startet manchmal verspätet) */

const kurz = (s, n = 40) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const liste = (xs, n, f = (x) => x) => xs.slice(0, n).map(f).join(", ") + (xs.length > n ? " und " + (xs.length - n) + " weitere" : "");
const terminZeile = (bl) => liste(bl, 5, (b) => (b.start ? b.start + " " : "") + kurz(b.title, 32));

/* ---------- Texte ---------- */
const uhr = (hm) => { const [h, m] = String(hm).split(":"); return Number(h) + (m === "00" ? "" : ":" + m); };   /* 13:00 → 13, 16:30 → 16:30 */
const wetterZeile = (w, vor) => vor + w.hi + "° / " + w.lo + "°, " + w.phrase + (w.rain >= 30 ? ", Regen " + w.rain + " %" : "") + ".";
const losZeile = (dep) => dep.map((x) => "spätestens " + x.at + " zu „" + kurz(x.b.title, 28) + "“" + (x.wet ? " (Regen, lieber früher)" : "")).join("; ");

export function morgenbericht(J) {
  const t = J.t, L = [], bl = J.blocksOn(t), dep = J.departures(t);
  const zeit = bl.filter((x) => x.start), ganz = bl.filter((x) => !x.start);
  if (ganz.length) L.push("Heute: " + liste(ganz, 2, (x) => kurz(x.title, 30)) + ".");
  L.push(zeit.length ? (zeit.length === 1 ? "1 Termin: " : zeit.length + " Termine: ") + terminZeile(zeit) + "." : "Heute keine festen Termine.");
  if (dep.length) L.push("Losfahren: " + losZeile(dep) + ".");
  const frei = J.freiZeit(t); if (frei && frei.min >= 60) L.push("Frei von " + uhr(frei.von) + " bis " + uhr(frei.bis) + " Uhr.");
  const w = J.wxDay(t); if (w) L.push(wetterZeile(w, "Wetter: "));
  J.warnungen.slice(0, 1).forEach((a) => L.push("⚠️ " + a.title + (a.until ? " (bis " + a.until + ")" : "") + "."));
  bl.filter((x) => x.start && J.isOutside(x)).forEach((x) => { const h = J.wxAt(t, x.start); if (h && h.rain >= 50) L.push(x.start + " " + kurz(x.title, 24) + ": " + h.rain + " % Regen, Regenjacke einpacken."); });
  const bd = J.bdaysOn(t); if (bd.length) L.push("🎂 " + bd.map((x) => x.name + (x.age ? " (" + x.age + ")" : "")).join(", ") + ".");
  const ziel = Number(J.S.workHours ?? 20), fehlt = Math.round((ziel - J.arbeitWoche(mondayOf(t))) * 2) / 2;
  if (ziel && fehlt > 0) L.push("Diese Woche fehlen noch " + fmtH(fehlt) + " Std. Arbeit.");
  const name = J.S.name ? ", " + J.S.name : "";
  return { t: "Guten Morgen" + name, b: L.join("\n"), u: "./#heute", g: "morgen" };
}

/* Abends nur noch: Das steht morgen an */
export function abendrueckblick(J) {
  const m = addDays(J.t, 1), L = [], bl = J.blocksOn(m), zeit = bl.filter((x) => x.start), ganz = bl.filter((x) => !x.start), dep = J.departures(m);
  if (ganz.length) L.push("Ganztags: " + liste(ganz, 2, (x) => kurz(x.title, 30)) + ".");
  L.push(zeit.length ? "Termine: " + terminZeile(zeit) + "." : "Keine festen Termine.");
  if (dep.length) L.push("Losfahren: " + losZeile(dep) + ".");
  const w = J.wxDay(m); if (w) L.push(wetterZeile(w, "Wetter: "));
  const bd = J.bdaysOn(m); if (bd.length) L.push("🎂 " + bd.map((x) => x.name + (x.age ? " (" + x.age + ")" : "")).join(", ") + ".");
  return { t: "Das steht morgen an", b: L.join("\n"), u: "./#heute", g: "abend" };
}

export function wochenplanung(J) {
  const t = J.t, mon = addDays(mondayOf(t), 7), L = [], ws = J.weekStats(mon);
  L.push("Nächste Woche: " + fmtH(ws.total) + " Std. verplant, " + ws.label + " (eng ab " + fmtH(ws.limY) + ").");
  const voll = ws.days.filter((d) => d.h >= ws.dayR); if (voll.length) L.push("Sehr voll: " + voll.map((d) => WDS[dow(d.date) % 7] + " " + fmtH(d.h) + " Std").join(", ") + ".");
  const ziel = Number(J.S.workHours ?? 20); if (ziel) L.push("Arbeit geplant: " + fmtH(ws.work) + " von " + fmtH(ziel) + " Std.");
  L.push("Tipp hier, um dir die Woche anzusehen.");
  return { t: "Wochenvorschau", b: L.join("\n"), u: "./#woche", g: "woche" };
}

/* Warnung bei Überschneidungen (heute und morgen) */
export function konfliktMeldung(J, d, k) {
  const tag = d === J.t ? "Heute" : "Morgen", z = (b) => "„" + kurz(b.title, 28) + "“ (" + b.start + "–" + b.end + ")";
  if (k.art === "ueber") return { t: "⚠️ " + tag + " überschneidet sich etwas", b: z(k.a) + " und " + z(k.b) + " liegen übereinander.", u: "./#heute", g: "ueb-" + d };
  return { t: "⚠️ " + tag + " wird es knapp", b: "Für „" + kurz(k.b.title, 28) + "“ (" + k.b.start + ") musst du um " + k.at + " los, aber " + z(k.a) + " ist erst um " + k.a.end + " zu Ende.", u: "./#heute", g: "ueb-" + d };
}
const konfliktKey = (d, k) => "ueb:" + d + ":" + k.art + ":" + [k.a, k.b].map((b) => b.id + "@" + b.start + "-" + b.end).join("|");

/* ---------- Was ist jetzt dran? ---------- */
/* gesendet: Liste der schon verschickten Schlüssel. Liefert [{ key, msg, slot? }] (slot = Platz in meta, damit die App den Text zeigt) */
export function jetztDran(J, gesendet) {
  const P = pushCfg(J.S), t = J.t, n = hmToMin(J.nowHM), out = [], schon = new Set(gesendet || []);
  const fenster = (hm) => { const a = hmToMin(hm); return a != null && n >= a && n < a + SPAET; };
  const neu = (key, msg, slot) => { if (!schon.has(key)) out.push({ key, msg, slot }); };
  const we = dow(t) >= 6;
  if (P.morgen && fenster(we ? P.morgenWE : P.morgenZeit)) neu("morgen:" + t, morgenbericht(J), "brief");
  if (P.abend && fenster(P.abendZeit)) neu("abend:" + t, abendrueckblick(J), "briefEvening");
  if (P.woche && dow(t) === 7 && fenster(P.wocheZeit)) neu("woche:" + t, wochenplanung(J), "briefWeekly");
  if (P.losfahren) J.departures(t).forEach((x) => {
    const at = hmToMin(x.at), vor = Math.max(0, Number(P.losVor) || 0);
    if (n >= at - vor && n <= at + 10) neu("los:" + t + ":" + x.b.id, { t: n >= at ? "Jetzt losfahren" : "In " + (at - n) + " Min. losfahren",
      b: "„" + x.b.title + "“ beginnt um " + x.b.start + " Uhr (" + x.tr + " Min. Fahrt" + (x.wet ? ", Regen gemeldet" : "") + "). Spätestens " + x.at + " Uhr los.", u: "./#heute", g: "los-" + x.b.id });
  });
  const ruhe = J.inQuiet();
  if (P.unwetter) J.warnungen.filter((a) => !ruhe || a.severity !== "moderate").forEach((a) => neu("wx:" + a.id, { t: "⚠️ Amtliche Warnung", b: a.title + (a.until ? " (bis " + a.until + " Uhr)" : "") + ".", u: "./#heute", g: "wx-" + a.id }));
  /* Überschneidungen heute und morgen: jede nur einmal, nicht in der Ruhezeit (dann kommt sie danach) */
  if (P.konflikt && !ruhe) [t, addDays(t, 1)].forEach((d) => J.konflikte(d).forEach((k) => {
    if (d === t && hmToMin(k.art === "ueber" ? (k.a.start > k.b.start ? k.a.start : k.b.start) : k.at) < n) return;   /* heute schon vorbei */
    neu(konfliktKey(d, k), konfliktMeldung(J, d, k));
  }));
  return out;
}

/* ---------- Daten fürs Handy-Widget ---------- */
// Bereich eines Termins für den farbigen Strich im Widget (wie im Tagesplan der App)
const bereich = (x) => ["uni", "arbeit", "team", "alltag"].includes(x.area) ? x.area : /training|spiel|turnier|twingame/i.test(x.title || "") ? "team" : "";
export function widgetDaten(J, focus) {
  const t = J.t, n = hmToMin(J.nowHM), m = addDays(t, 1);
  const rest = J.blocksOn(t).filter((x) => x.start && (hmToMin(x.end || x.start) ?? 0) > n).slice(0, 4).map((x) => ({ s: x.start, e: x.end || "", ti: x.title.slice(0, 40), o: x.place ? String(x.place).slice(0, 30) : "", k: bereich(x) }));
  const morgen = J.blocksOn(m).filter((x) => x.start).slice(0, 3).map((x) => ({ s: x.start, e: x.end || "", ti: x.title.slice(0, 40), k: bereich(x) }));
  const dep = J.departures(t).find((x) => hmToMin(x.at) >= n - 10);
  const w = J.wxDay(t), ws = J.weekStats(mondayOf(t));
  return {
    v: 1, at: Date.now(), tag: t, tagText: fmtLong(t), name: J.S.name || "",
    skin: ["smaragd", "glas", "polar"].includes(J.S.skin) ? J.S.skin : "smaragd", modus: J.S.mode || "auto",
    termine: rest, morgen, los: dep ? { at: dep.at, ti: dep.b.title.slice(0, 40) } : null,
    auf: { heute: 0, ueber: 0, top: [] },   /* Aufgaben gibt es nicht mehr; bleibt leer, damit ein älteres Widget-Skript nicht abstürzt */
    wetter: w ? { hi: w.hi, lo: w.lo, tx: w.phrase, regen: w.rain } : null,
    woche: { h: Math.round(ws.total * 10) / 10, lim: ws.limY, lvl: ws.lvl },
    uhr: focus && focus.mode === "track" && focus.startedAt ? { cat: J.catName(focus.cat), seit: focus.startedAt, pause: focus.pausedAt || null, pausedMs: focus.pausedMs || 0 } : null
  };
}
