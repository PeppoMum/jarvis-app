/* Jarvis-Rechnungen für die Meldungen, ohne KI. Nachgebaut aus der App (gleiche Datenform, gleiche Regeln):
   Tagesablauf (Termine, Vorlesungen, Arbeit, frei, Feiertage, Google), Aufgaben, Gewohnheiten, Losfahrzeiten, Wochen-Ampel,
   Geburtstage, Verträge, Prüfungen, Lernkarten. Läuft in deutscher Zeit (TZ=Europe/Berlin). */

export const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return isoDate(d); };
export const hmToMin = (s) => { if (!s) return null; const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
export const minToHM = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
const dObj = (s) => new Date(s + "T12:00:00");
export const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const WDS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONL = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const dow = (s) => { const d = dObj(s).getDay(); return d === 0 ? 7 : d; };
export const mondayOf = (s) => addDays(s, 1 - dow(s));
export const fmtH = (h) => (Math.round(h * 10) / 10).toString().replace(".", ",");
export const fmtMin = (m) => m >= 60 ? Math.floor(m / 60) + " Std" + (m % 60 ? " " + (m % 60) + " Min" : "") : m + " Min";
export const fmtLong = (s) => { const d = dObj(s); return WD[d.getDay()] + ", " + d.getDate() + ". " + MONL[d.getMonth()]; };

const PLAN_DEF = { holidays: true, travel: [{ name: "Uni / Büro", words: "uni, campus, hörsaal, seminar, vorlesung, büro", min: 90 }, { name: "Sportplatz", words: "training, spiel, turnier, stausee, sportplatz", min: 10 }] };
const DEFAULT_CATS = [{ id: "arbeit", name: "Arbeit" }, { id: "uni", name: "Uni" }, { id: "ehrenamt", name: "Ehrenamt" }, { id: "privat", name: "Privat" }];
const LEGACY_CAT = { team: "ehrenamt", alltag: "privat", freizeit: "privat" };
const TRANSIT_RE = /(^|[\s(,:-])(zug|bahn|s-bahn|u-bahn|bus|ice|ic|re ?\d+|rb ?\d+|s ?\d+|fahrt|anfahrt|hinfahrt|rückfahrt|heimfahrt|autofahrt|pendeln|transit|flug|unterwegs)(?=$|[\s),.:!-])/i;

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return y + "-" + pad(mo) + "-" + pad(da);
}
function holidaysNRW(y) {
  const e = easter(y);
  return { [y + "-01-01"]: "Neujahr", [addDays(e, -2)]: "Karfreitag", [addDays(e, 1)]: "Ostermontag", [y + "-05-01"]: "Tag der Arbeit", [addDays(e, 39)]: "Christi Himmelfahrt", [addDays(e, 50)]: "Pfingstmontag",
    [addDays(e, 60)]: "Fronleichnam", [y + "-10-03"]: "Tag der Deutschen Einheit", [y + "-11-01"]: "Allerheiligen", [y + "-12-25"]: "1. Weihnachtstag", [y + "-12-26"]: "2. Weihnachtstag" };
}

/* J = jarvis({ items, settings, gcal, wetter, warnungen, jetzt }) */
export function jarvis({ items = [], settings = {}, gcal = [], wetter = null, warnungen = [], jetzt = new Date() }) {
  const S = settings, t = isoDate(jetzt), nowHM = pad(jetzt.getHours()) + ":" + pad(jetzt.getMinutes());
  const byType = (x) => items.filter((i) => i.type === x);
  const relDay = (s) => {
    if (s === t) return "heute"; if (s === addDays(t, 1)) return "morgen"; if (s === addDays(t, -1)) return "gestern";
    const diff = Math.round((dObj(s) - dObj(t)) / 864e5);
    if (diff > 1 && diff < 7) return "am " + WD[dObj(s).getDay()];
    return "am " + dObj(s).getDate() + "." + (dObj(s).getMonth() + 1) + ".";
  };
  const daysUntil = (s) => Math.round((dObj(s) - dObj(t)) / 864e5);
  const planCfg = () => { const p = S.plan || {}; return { ...PLAN_DEF, ...p, travel: Array.isArray(p.travel) ? p.travel : PLAN_DEF.travel }; };
  const holidayOn = (s) => planCfg().holidays === false ? null : holidaysNRW(Number(s.slice(0, 4)))[s] || null;
  const offOn = (s) => byType("off").find((o) => o.date <= s && (o.dateEnd || o.date) >= s) || null;
  const classWeekOk = (c, s) => {
    if (Number(c.every || 1) < 2) return true;
    const st = mondayOf(c.from || String(c.createdAt || s).slice(0, 10)), wk = Math.round((dObj(mondayOf(s)) - dObj(st)) / (7 * 864e5));
    return ((wk % 2) + 2) % 2 === 0;
  };
  const evDay = (e, s) => {
    if (!e.dateEnd || e.dateEnd <= e.date) return { title: e.title, start: e.start, end: e.end };
    const n = Math.round((dObj(e.dateEnd) - dObj(e.date)) / 864e5) + 1, k = Math.round((dObj(s) - dObj(e.date)) / 864e5) + 1, tag = " (Tag " + k + "/" + n + ")";
    if (s === e.date) return { title: e.title + tag, start: e.start || null, end: e.start ? "23:59" : null };
    return { title: e.title + tag + (s === e.dateEnd && e.end ? " bis " + e.end : ""), start: null, end: null };
  };
  const linked = items.filter((i) => i.gcalId).map((i) => String(i.gcalId));
  function blocksOn(s) {
    const out = [];
    byType("event").filter((e) => e.date === s || (e.dateEnd && e.date < s && e.dateEnd >= s)).forEach((e) => out.push({ id: e.id, kind: "event", ...evDay(e, s), area: e.area, place: e.place, date: s, src: e }));
    byType("class").filter((c) => Number(c.weekday) === dow(s) && (!c.from || c.from <= s) && (!c.until || c.until >= s) && !(c.skip || []).includes(s) && classWeekOk(c, s))
      .forEach((c) => out.push({ id: c.id, kind: "class", title: c.title, start: c.start, end: c.end, area: "uni", place: c.room, date: s, src: c }));
    byType("work").filter((w) => w.date === s).forEach((w) => out.push({ id: w.id, kind: "work", title: "Arbeit · " + (w.place || "Homeoffice"), start: w.start, end: w.end, area: "arbeit", date: s, src: w }));
    const off = offOn(s);
    if (off) out.push({ id: off.id, kind: "off", title: off.title || (off.kind === "urlaub" ? "Urlaub" : "Frei"), start: null, end: null, area: "alltag", date: s, src: off });
    const hol = holidayOn(s); if (hol && !off) out.push({ id: "h:" + s, kind: "holiday", title: hol, start: null, end: null, date: s });
    gcal.filter((g) => g.date === s && !linked.some((l) => g.gid === l || g.gid.startsWith(l + "_"))).forEach((g) => out.push({ id: "g:" + g.gid, kind: "google", title: g.title, start: g.start, end: g.end, area: g.area || null, place: g.place, date: s, calName: g.calName, cockpit: !!g.cockpit || /trainer-cockpit/i.test(g.calName || ""), abf: g.abf || null, abfMin: g.abfMin || null }));
    return out.sort((a, b) => (hmToMin(a.start) ?? -1) - (hmToMin(b.start) ?? -1));
  }
  const isTeamBlock = (b) => b.area === "team" || /training|spiel|turnier|twingame/i.test(b.title || "");
  const isOutside = (b) => isTeamBlock(b) || !!(b.src && b.src.outside);
  const isTransit = (b) => !!b && b.kind !== "class" && b.kind !== "work" && TRANSIT_RE.test(b.title || "");
  function dayHours(bl) {
    const iv = bl.filter((b) => !isTransit(b)).map((b) => [hmToMin(b.start), hmToMin(b.end)]).filter(([a, e]) => a != null && e != null && e > a).sort((x, y) => x[0] - y[0]);
    let sum = 0, cs = -1, ce = -1;
    iv.forEach(([a, e]) => { if (a > ce) { if (ce > cs) sum += ce - cs; cs = a; ce = e; } else ce = Math.max(ce, e); });
    if (ce > cs) sum += ce - cs;
    return sum / 60;
  }
  function loadLimits() {
    const L = { weekY: 45, weekR: 55, dayY: 10, dayR: 12, ...(S.load || {}) };
    Object.keys(L).forEach((k) => { L[k] = Math.max(0, Number(L[k]) || 0); });
    L.weekR = Math.max(L.weekR, L.weekY); L.dayR = Math.max(L.dayR, L.dayY); return L;
  }
  function weekStats(mon) {
    const L = loadLimits(), days = [];
    let total = 0, work = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i), bl = blocksOn(d), h = dayHours(bl);
      total += h; work += dayHours(bl.filter((b) => b.kind === "work" || b.area === "arbeit")); days.push({ date: d, h });
    }
    const lvl = total >= L.weekR ? "r" : total >= L.weekY ? "y" : "g";
    return { total, work, days, lvl, label: { g: "machbar", y: "eng", r: "überplant" }[lvl], limY: L.weekY, limR: L.weekR, dayR: L.dayR };
  }

  /* Aufgaben */
  const nextStepOf = (pid) => byType("task").filter((x) => x.projectId === pid).sort((a, b) => (Number(a.step ?? 999) - Number(b.step ?? 999)) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""))).find((x) => !x.done) || null;
  const isNextStep = (x) => { const p = items.find((i) => i.id === x.projectId); if (!p || p.type !== "project" || p.done) return true; const n = nextStepOf(p.id); return !n || n.id === x.id; };
  const openTasks = () => byType("task").filter((x) => !x.done && x.status !== "someday" && (!x.projectId || isNextStep(x)));
  function taskBuckets() {
    const wk = addDays(t, 7), open = openTasks();
    const eff = (x) => x.date && x.date < t ? x.date : x.doDate ? (x.doDate < t ? t : x.doDate) : x.date;
    const sortD = (a, b) => (a.date || "9").localeCompare(b.date || "9") || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    return { over: open.filter((x) => x.date && x.date < t).sort(sortD), today: open.filter((x) => !(x.date && x.date < t) && eff(x) === t).sort(sortD),
      soon: open.filter((x) => eff(x) && eff(x) > t && eff(x) <= wk).sort(sortD), all: open };
  }
  const doneOn = (d) => byType("task").filter((x) => x.done && x.doneAt && isoDate(new Date(x.doneAt)) === d);

  /* Zeiten und Gewohnheiten */
  const timeCats = () => Array.isArray(S.timeCats) && S.timeCats.length ? S.timeCats : DEFAULT_CATS;
  const catId = (id) => { if (!id) return null; const cats = timeCats(); if (cats.some((c) => c.id === id)) return id; const l = LEGACY_CAT[id]; return l && cats.some((c) => c.id === l) ? l : id; };
  const catName = (id) => (timeCats().find((c) => c.id === catId(id)) || { name: id || "Ohne Bereich" }).name;
  const dayEntries = (d) => { const x = items.find((i) => i.id === "tl-" + d); return ((x && x.entries) || []).map((e) => ({ ...e, cat: catId(e.cat), min: Number(e.min) || 0 })); };
  const activeHabits = () => byType("habit").filter((h) => !h.archived);
  const hFreq = (h) => ["daily", "days", "week"].includes(h.freq) ? h.freq : (h.days && h.days.length && h.days.length < 7 ? "days" : "daily");
  const habitPaused = (h, d) => { if ((h.pauses || []).some((p) => p.from <= d && (!p.until || p.until >= d))) return true; const off = !h.noAutoPause && offOn(d); return !!(off && (off.kind || "urlaub") === "urlaub"); };
  const habitDue = (h, d) => !(h.archived || habitPaused(h, d)) && (hFreq(h) === "days" ? (h.days || [1, 2, 3, 4, 5, 6, 7]).map(Number).includes(dow(d)) : true);
  const habitTarget = (h) => (h.kind || "check") === "check" ? 1 : Math.max(1, Number(h.target) || 1);
  function habitVal(h, d) {
    const k = h.kind || "check", l = (h.log || {})[d]; let v = l === true ? habitTarget(h) : Number(l) || 0;
    if (h.link) { const [cat, ...s] = String(h.link).split("|"), sub = s.join("|"), es = dayEntries(d).filter((e) => e.cat === cat && (!sub || e.sub === sub)), m = es.reduce((a, e) => a + e.min, 0); v += k === "minutes" ? m : k === "count" ? es.length : (m > 0 ? 1 : 0); }
    return v;
  }
  const habitDoneOn = (h, d) => { const v = habitVal(h, d); return v >= habitTarget(h) || (h.log || {})[d] === "mini" || !!(h.miniTarget && v >= h.miniTarget); };

  /* Sonstiges */
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const bdaysOn = (d) => { const md = d.slice(5); return byType("birthday").filter((b) => b.md === md || (b.md === "02-29" && md === "02-28" && !isLeap(Number(d.slice(0, 4))))).map((b) => ({ name: b.name || b.title, age: b.year ? Number(d.slice(0, 4)) - Number(b.year) : null })); };
  const addMonths = (s, n) => { const x = dObj(s), day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return isoDate(x); };
  const cancelByOf = (c, end) => { const n = Number(c.notice || 0); return c.noticeUnit === "wochen" ? addDays(end, -7 * n) : addMonths(end, -n); };
  function contractInfo(c) {
    if (!c.until || !/^\d{4}-\d{2}-\d{2}$/.test(c.until)) return null;
    const r = Number(c.renew || 0); let end = c.until, g = 0;
    while (r > 0 && cancelByOf(c, end) < t && g++ < 400) end = addMonths(end, r);
    const by = cancelByOf(c, end); return { end, by, left: daysUntil(by) };
  }
  const examKindOf = (x) => (x && x.examKind) || "klausur";
  const examWord = (x) => ({ klausur: "Klausur", hausarbeit: "Abgabe Hausarbeit", muendlich: "Mündliche Prüfung", referat: "Referat", portfolio: "Abgabe Portfolio" })[examKindOf(x)] || "Prüfung";
  const examLead = (x) => { const k = examKindOf(x); if (k === "keine") return null; if (k !== "mit") return x; return items.find((i) => i.id === x.examWith && i.type === "subject" && examKindOf(i) !== "mit") || null; };
  const examName = (lead) => [lead, ...byType("subject").filter((s) => s.id !== lead.id && examKindOf(s) === "mit" && s.examWith === lead.id)].map((s) => s.title).join(" + ");
  const exams = (tage) => byType("subject").filter((x) => x.examDate && x.examDate >= t && x.examDate <= addDays(t, tage) && examLead(x) === x).sort((a, b) => a.examDate.localeCompare(b.examDate));
  const dueCards = () => byType("material").reduce((n, m) => n + (m.cards || []).filter((c) => !c.due || c.due <= t).length, 0);

  /* Wetter und Losfahren */
  const wxDay = (d) => (wetter && wetter.daily || []).find((w) => w.date === d) || null;
  const wxAt = (d, hm) => { const h = pad(Math.floor((hmToMin(hm) || 0) / 60)) + ":00"; return (wetter && wetter.hourly || []).find((w) => w.date === d && w.hm === h) || null; };
  function travelFor(b) {
    if (!b.start || (b.src && b.src.planned)) return 0;
    if (b.cockpit) return b.abf ? (b.abfMin || Math.max(0, hmToMin(b.start) - hmToMin(b.abf))) : 0;   // Fußball-App: nur was in der Beschreibung steht
    const hay = ((b.kind === "class" ? "vorlesung " : "") + (b.kind === "work" ? "büro " : "") + (isTeamBlock(b) ? "training " : "") + (b.title || "") + " " + (b.place || "")).toLowerCase();
    if (/homeoffice|online|zoom|digital/.test(hay)) return 0;
    let best = 0;
    planCfg().travel.forEach((x) => { const ws = String(x.words || x.name || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean); if (ws.some((w) => hay.includes(w))) best = Math.max(best, Number(x.min) || 0); });
    return best;
  }
  function departures(d) {
    const bl = blocksOn(d).filter((b) => b.start).sort((a, b) => a.start.localeCompare(b.start)), out = [];
    bl.forEach((b, i) => {
      /* Fußball-App: genau die Uhrzeit aus „Abfahrt:“ nehmen, ohne Zeile (Trainings) gar keine Losfahr-Zeit */
      if (b.cockpit) { if (b.abf) { const w = wxAt(d, b.start); out.push({ b, tr: travelFor(b), at: b.abf, wet: !!(w && Number(w.rain) >= 50), fix: true }); } return; }
      const tr = travelFor(b); if (!tr) return;
      const s = hmToMin(b.start), prev = bl.slice(0, i).filter((x) => x.end && hmToMin(x.end) > s - tr - 30 && hmToMin(x.end) <= s);
      if (prev.length) return;
      const at = Math.max(0, s - tr - 10), w = wxAt(d, b.start);
      out.push({ b, tr, at: minToHM(at), wet: !!(w && Number(w.rain) >= 50) });
    });
    return out.slice(0, 3);
  }
  function inQuiet() {
    if (S.quietOn === false) return false;
    const n = hmToMin(nowHM), a = hmToMin(S.quietFrom || "21:00"), z = hmToMin(S.quietTo || "07:00");
    return a <= z ? n >= a && n < z : n >= a || n < z;
  }

  return { S, t, nowHM, items, byType, relDay, daysUntil, blocksOn, weekStats, taskBuckets, openTasks, doneOn, dayEntries, catName, activeHabits, habitDue, habitDoneOn,
    bdaysOn, contractInfo, exams, examWord, examName, dueCards, wxDay, wxAt, departures, isOutside, inQuiet, warnungen, timeCats };
}
