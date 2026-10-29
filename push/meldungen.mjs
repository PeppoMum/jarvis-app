/* Welche Meldung ist gerade dran, und was steht drin? Ohne KI, nur aus Phils Daten.
   Einstellungen stehen in meta/settings unter „push“ (in der App: Einstellungen → Meldungen), sonst gelten diese Vorgaben. */
import { addDays, mondayOf, hmToMin, minToHM, fmtH, fmtMin, fmtLong, WDS, dow } from "./jarvis.mjs";

export const PUSH_DEF = { morgen: true, morgenZeit: "06:45", morgenWE: "09:00", abend: true, abendZeit: "20:45", woche: true, wocheZeit: "18:45",
  losfahren: true, losVor: 15, unwetter: true, gewohnheit: true, aufgabe: true };
export const pushCfg = (settings) => ({ ...PUSH_DEF, ...((settings && settings.push) || {}) });
const SPAET = 120;   /* so lange nach der Uhrzeit wird eine Meldung noch nachgeholt (GitHub startet manchmal verspätet) */

const kurz = (s, n = 40) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const liste = (xs, n, f = (x) => x) => xs.slice(0, n).map(f).join(", ") + (xs.length > n ? " und " + (xs.length - n) + " weitere" : "");
const terminZeile = (bl) => liste(bl, 5, (b) => (b.start ? b.start + " " : "") + kurz(b.title, 32));

/* ---------- Texte ---------- */
export function morgenbericht(J) {
  const t = J.t, L = [], b = J.taskBuckets(), bl = J.blocksOn(t), dep = J.departures(t);
  const zeit = bl.filter((x) => x.start), ganz = bl.filter((x) => !x.start);
  if (ganz.length) L.push("Heute: " + liste(ganz, 2, (x) => kurz(x.title, 30)) + ".");
  L.push(zeit.length ? (zeit.length === 1 ? "1 Termin: " : zeit.length + " Termine: ") + terminZeile(zeit) + "." : "Heute keine festen Termine.");
  if (dep.length) L.push("Losfahren: " + dep.map((x) => "spätestens " + x.at + " zu „" + kurz(x.b.title, 28) + "“" + (x.wet ? " (Regen, lieber früher)" : "")).join("; ") + ".");
  const top = J.byType("task").filter((x) => x.topDate === t && !x.done);
  if (top.length) L.push("Top 3: " + liste(top, 3, (x) => kurz(x.title)) + ".");
  else if (b.today.length) L.push("Heute dran: " + liste(b.today, 3, (x) => kurz(x.title)) + ".");
  if (b.over.length) L.push(b.over.length === 1 ? "Überfällig: „" + kurz(b.over[0].title) + "“." : b.over.length + " Aufgaben sind überfällig.");
  const w = J.wxDay(t);
  if (w) L.push("Wetter: " + w.hi + "° / " + w.lo + "°, " + w.phrase + (w.rain >= 30 ? ", Regen " + w.rain + " %" : "") + ".");
  J.warnungen.slice(0, 1).forEach((a) => L.push("⚠️ " + a.title + (a.until ? " (bis " + a.until + ")" : "") + "."));
  bl.filter((x) => x.start && J.isOutside(x)).forEach((x) => { const h = J.wxAt(t, x.start); if (h && h.rain >= 50) L.push(x.start + " " + kurz(x.title, 24) + ": " + h.rain + " % Regen, Regenjacke einpacken."); });
  const bd = J.bdaysOn(t); if (bd.length) L.push("🎂 " + bd.map((x) => x.name + (x.age ? " (" + x.age + ")" : "")).join(", ") + ".");
  J.exams(14).slice(0, 2).forEach((x) => L.push(J.examWord(x) + " " + J.examName(x) + " " + J.relDay(x.examDate) + (J.daysUntil(x.examDate) > 1 ? " (in " + J.daysUntil(x.examDate) + " Tagen)" : "") + "."));
  J.byType("contract").forEach((c) => { const ci = J.contractInfo(c); if (ci && ci.left >= 0 && ci.left <= Number(J.S.contractLead || 28)) L.push("Vertrag „" + kurz(c.title, 30) + "“: Kündigen bis " + J.relDay(ci.by) + "."); });
  const cards = J.dueCards(); if (cards) L.push(cards + (cards === 1 ? " Lernkarte ist" : " Lernkarten sind") + " dran.");
  const ws = J.weekStats(mondayOf(t)); if (ws.lvl !== "g") L.push("Woche: " + fmtH(ws.total) + " Std. verplant, " + ws.label + ".");
  const name = J.S.name ? ", " + J.S.name : "";
  return { t: "Guten Morgen" + name, b: L.join("\n"), u: "./#heute", g: "morgen" };
}

export function abendrueckblick(J) {
  const t = J.t, m = addDays(t, 1), L = [], b = J.taskBuckets(), done = J.doneOn(t), open = [...b.over, ...b.today];
  L.push("Erledigt: " + (done.length === 1 ? "1 Aufgabe" : done.length + " Aufgaben") + (open.length ? " · offen: " + liste(open, 2, (x) => "„" + kurz(x.title, 28) + "“") : " · nichts offen geblieben") + ".");
  const es = J.dayEntries(t), min = es.reduce((s, e) => s + e.min, 0);
  if (min) { const per = {}; es.forEach((e) => { per[e.cat] = (per[e.cat] || 0) + e.min; });
    L.push("Erfasst: " + fmtMin(min) + " (" + Object.entries(per).sort((x, y) => y[1] - x[1]).map(([c, v]) => J.catName(c) + " " + fmtMin(v)).join(", ") + ")."); }
  const hs = J.activeHabits().filter((h) => J.habitDue(h, t));
  if (hs.length) { const ok = hs.filter((h) => J.habitDoneOn(h, t)); L.push("Gewohnheiten: " + ok.length + " von " + hs.length + (ok.length < hs.length ? " (fehlt: " + liste(hs.filter((h) => !ok.includes(h)), 2, (h) => h.title) + ")" : " geschafft") + "."); }
  const bl = J.blocksOn(m), zeit = bl.filter((x) => x.start), dep = J.departures(m);
  L.push("Morgen: " + (zeit.length ? terminZeile(zeit) : bl.length ? liste(bl, 2, (x) => kurz(x.title, 30)) : "keine festen Termine") + ".");
  if (dep.length) L.push("Losfahren morgen spätestens " + dep[0].at + " (" + kurz(dep[0].b.title, 28) + ").");
  const fm = J.openTasks().filter((x) => x.date === m); if (fm.length) L.push("Morgen fällig: " + liste(fm, 2, (x) => kurz(x.title)) + ".");
  const w = J.wxDay(m); if (w) L.push("Wetter morgen: " + w.hi + "° / " + w.lo + "°, " + w.phrase + (w.rain >= 30 ? ", Regen " + w.rain + " %" : "") + ".");
  const bd = J.bdaysOn(m); if (bd.length) L.push("🎂 Morgen: " + bd.map((x) => x.name).join(", ") + ".");
  return { t: "Abendrückblick", b: L.join("\n"), u: "./#heute", g: "abend" };
}

export function wochenplanung(J) {
  const t = J.t, mon = addDays(mondayOf(t), 7), so = addDays(mon, 6), L = [], ws = J.weekStats(mon);
  L.push("Nächste Woche: " + fmtH(ws.total) + " Std. verplant, " + ws.label + " (eng ab " + fmtH(ws.limY) + ").");
  const voll = ws.days.filter((d) => d.h >= ws.dayR); if (voll.length) L.push("Sehr voll: " + voll.map((d) => WDS[dow(d.date) % 7] + " " + fmtH(d.h) + " Std").join(", ") + ".");
  const ziel = Number(J.S.workHours ?? 20); if (ziel) L.push("Arbeit geplant: " + fmtH(ws.work) + " von " + fmtH(ziel) + " Std.");
  const fr = J.openTasks().filter((x) => x.date && x.date >= mon && x.date <= so).sort((a, b) => a.date.localeCompare(b.date));
  if (fr.length) L.push("Fristen: " + liste(fr, 3, (x) => kurz(x.title, 30) + " (" + WDS[dow(x.date) % 7] + ")") + ".");
  J.exams(21).slice(0, 2).forEach((x) => L.push(J.examWord(x) + " " + J.examName(x) + " in " + J.daysUntil(x.examDate) + " Tagen."));
  const over = J.taskBuckets().over.length; if (over) L.push(over + (over === 1 ? " Aufgabe ist" : " Aufgaben sind") + " noch überfällig.");
  const erl = J.byType("task").filter((x) => x.done && x.doneAt && new Date(x.doneAt) >= new Date(mondayOf(t) + "T00:00:00")).length;
  if (erl) L.push("Diese Woche erledigt: " + erl + (erl === 1 ? " Aufgabe" : " Aufgaben") + ".");
  L.push("Tipp hier, um die Woche zu planen (10 Minuten).");
  return { t: "Wochenplanung", b: L.join("\n"), u: "./#woche", g: "woche" };
}

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
  if (P.gewohnheit && !ruhe) J.activeHabits().filter((h) => /^\d{2}:\d{2}$/.test(h.remind || "") && n >= hmToMin(h.remind) && n < hmToMin(h.remind) + SPAET && (!h.winTo || J.nowHM <= h.winTo) && J.habitDue(h, t) && !J.habitDoneOn(h, t))
    .forEach((h) => neu("hab:" + t + ":" + h.id, { t: "Erinnerung: " + h.title, b: (h.winTo ? "Bis " + h.winTo + " Uhr. " : "") + (h.mini ? "Wenig Zeit? Mini reicht: " + h.mini + "." : "Tipp hier zum Abhaken."), u: "./#gewohnheiten", g: "hab-" + h.id }));
  if (P.aufgabe) J.byType("task").filter((x) => !x.done && typeof x.remindAt === "string" && x.remindAt.slice(0, 10) === t && n >= hmToMin(x.remindAt.slice(11, 16)) && n < hmToMin(x.remindAt.slice(11, 16)) + SPAET)
    .forEach((x) => neu("auf:" + x.id + ":" + x.remindAt, { t: "Erinnerung", b: x.title, u: "./#aufgaben", g: "auf-" + x.id }));
  return out;
}

/* ---------- Daten fürs Handy-Widget ---------- */
export function widgetDaten(J, focus) {
  const t = J.t, n = hmToMin(J.nowHM), b = J.taskBuckets(), m = addDays(t, 1);
  const rest = J.blocksOn(t).filter((x) => x.start && (hmToMin(x.end || x.start) ?? 0) > n).slice(0, 4).map((x) => ({ s: x.start, e: x.end || "", ti: x.title.slice(0, 40), o: x.place ? String(x.place).slice(0, 30) : "" }));
  const morgen = J.blocksOn(m).filter((x) => x.start).slice(0, 3).map((x) => ({ s: x.start, e: x.end || "", ti: x.title.slice(0, 40) }));
  const dep = J.departures(t).find((x) => hmToMin(x.at) >= n - 10);
  const w = J.wxDay(t), ws = J.weekStats(mondayOf(t));
  const hs = J.activeHabits().filter((h) => J.habitDue(h, t));
  return {
    v: 1, at: Date.now(), tag: t, tagText: fmtLong(t), name: J.S.name || "",
    farbe: J.S.jpal || "rotgold", modus: J.S.mode || "auto",
    termine: rest, morgen, los: dep ? { at: dep.at, ti: dep.b.title.slice(0, 40) } : null,
    auf: { heute: b.today.length, ueber: b.over.length, top: [...b.over, ...b.today].slice(0, 3).map((x) => x.title.slice(0, 40)) },
    wetter: w ? { hi: w.hi, lo: w.lo, tx: w.phrase, regen: w.rain } : null,
    woche: { h: Math.round(ws.total * 10) / 10, lim: ws.limY, lvl: ws.lvl },
    gew: { soll: hs.length, ist: hs.filter((h) => J.habitDoneOn(h, t)).length },
    uhr: focus && focus.mode === "track" && focus.startedAt ? { cat: J.catName(focus.cat), seit: focus.startedAt, pause: focus.pausedAt || null, pausedMs: focus.pausedMs || 0 } : null
  };
}
