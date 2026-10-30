'use strict';
/* Jarvis-App – 02-daten.js (aus Jarvis in Claude, Zeilen 1189–1341 von V48) */
/* ===================== Abgeleitete Daten ===================== */
const byType = t => S.items.filter(i => i.type === t);
function eventsOn(iso) { return blocksOn(iso).filter(b => b.start); }
const dow = iso => { const d = dObj(iso).getDay(); return d === 0 ? 7 : d; };       // 1 = Montag … 7 = Sonntag
const mondayOf = iso => addDays(iso, 1 - dow(iso));
const durH = (a, b) => (a && b) ? Math.max(0, (hmToMin(b) - hmToMin(a)) / 60) : 0;
const fmtH = h => (Math.round(h * 10) / 10).toString().replace('.', ',');
const linkedGids = () => S.items.filter(i => i.gcalId).map(i => i.gcalId);
function offOn(iso) { return byType('off').find(o => o.date <= iso && (o.dateEnd || o.date) >= iso) || null; }
// Alle Zeitblöcke eines Tages: Termine, Stundenplan, Arbeit, freie Tage, Google-Kalender
function blocksOn(iso) {
  const out = [];
  byType('event').filter(e => e.date === iso || (e.dateEnd && e.date < iso && e.dateEnd >= iso)).forEach(e => out.push({ id: e.id, kind: 'event', ...evDay(e, iso), area: e.area, place: e.place, date: iso, cal: e.gcalId ? 'ok' : (e.calErr ? 'err' : ''), src: e }));
  byType('class').filter(c => Number(c.weekday) === dow(iso) && (!c.from || c.from <= iso) && (!c.until || c.until >= iso) && !(c.skip || []).includes(iso) && classWeekOk(c, iso))
    .forEach(c => out.push({ id: c.id, kind: 'class', title: c.title, start: c.start, end: c.end, area: 'uni', place: c.room, date: iso, cal: c.gcalId ? 'ok' : (c.calErr ? 'err' : ''), src: c }));
  byType('work').filter(w => w.date === iso).forEach(w => out.push({ id: w.id, kind: 'work', title: 'Arbeit · ' + (w.place || 'Homeoffice'), start: w.start, end: w.end, area: 'arbeit', date: iso, cal: w.gcalId ? 'ok' : (w.calErr ? 'err' : ''), src: w }));
  const off = offOn(iso);
  if (off) out.push({ id: off.id, kind: 'off', title: off.title || (off.kind === 'urlaub' ? 'Urlaub' : 'Frei'), start: null, end: null, area: 'alltag', date: iso, cal: off.gcalId ? 'ok' : (off.calErr ? 'err' : ''), src: off });
  const hol = holidayOn(iso); if (hol && !off) out.push({ id: 'h:' + iso, kind: 'holiday', title: hol, start: null, end: null, area: 'alltag', date: iso, ro: true, calName: 'Feiertag' });
  const linked = linkedGids();
  S.gcal.filter(g => g.date === iso && !linked.some(l => g.gid === l || g.gid.startsWith(l + '_'))).forEach(g => out.push({ id: 'g:' + g.gid, gid: g.gid, endDate: g.endDate, rec: g.rec, kind: 'google', title: g.title, start: g.start, end: g.end, area: g.area || null, place: g.place, date: iso, ro: true, calName: g.calName, cockpit: !!g.cockpit || /trainer-cockpit/i.test(g.calName || ''), abf: g.abf || null, abfMin: g.abfMin || null }));
  return out.sort((a, b) => (hmToMin(a.start) ?? -1) - (hmToMin(b.start) ?? -1));
}
// Mehrtägige Termine: erster Tag ab Beginn, letzter Tag bis Ende, dazwischen ganztägig
function evDay(e, iso) {
  if (!e.dateEnd || e.dateEnd <= e.date) return { title: e.title, start: e.start, end: e.end };
  const n = Math.round((dObj(e.dateEnd) - dObj(e.date)) / 864e5) + 1, k = Math.round((dObj(iso) - dObj(e.date)) / 864e5) + 1, tag = ' (Tag ' + k + '/' + n + ')';
  if (iso === e.date) return { title: e.title + tag, start: e.start || null, end: e.start ? '23:59' : null };
  return { title: e.title + tag + (iso === e.dateEnd && e.end ? ' bis ' + e.end : ''), start: null, end: null };
}
function weekDays(mon) { return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
// Belegte Stunden eines Tages; was sich überschneidet, zählt nur einmal. Es zählen nur Arbeit, Uni und Ehrenamt (countsForLoad).
const TRANSIT_RE = /(^|[\s(,:-])(zug|bahn|s-bahn|u-bahn|bus|ice|ic|re ?\d+|rb ?\d+|s ?\d+|fahrt|anfahrt|hinfahrt|rückfahrt|heimfahrt|autofahrt|pendeln|transit|flug|unterwegs)(?=$|[\s),.:!-])/i;
const isTransit = b => !!b && b.kind !== 'class' && b.kind !== 'work' && TRANSIT_RE.test(b.title || '');
function dayHours(bl) {
  bl = bl.filter(countsForLoad);
  const iv = bl.map(b => [hmToMin(b.start), hmToMin(b.end)]).filter(([a, e]) => a != null && e != null && e > a).sort((x, y) => x[0] - y[0]);
  let sum = 0, cs = -1, ce = -1;
  iv.forEach(([a, e]) => { if (a > ce) { if (ce > cs) sum += ce - cs; cs = a; ce = e; } else ce = Math.max(ce, e); });
  if (ce > cs) sum += ce - cs;
  return sum / 60;
}
function weekStats(mon) {
  let total = 0, work = 0, uni = 0, maxDay = 0, maxDate = null;
  const days = [];
  weekDays(mon).forEach(d => {
    const bl = blocksOn(d), day = dayHours(bl);
    total += day; days.push({ date: d, h: day }); if (day > maxDay) { maxDay = day; maxDate = d; }
  });
  // Die Woche zählt nur nach Wochenstunden; ein einzelner voller Tag wird extra gemeldet
  const L = loadLimits(), lvl = total >= L.weekR ? 'r' : total >= L.weekY ? 'y' : 'g';
  const wc = weekCats(mon), hOf = id => (wc.list.find(x => x.id === id) || { h: 0 }).h; work = hOf('arbeit'); uni = hOf('uni');
  return { total, work, uni, cats: wc.list, other: wc.other, travel: wc.travel, maxDay, maxDate, days, lvl, label: { g: 'machbar', y: 'eng', r: 'überplant' }[lvl], limY: L.weekY, limR: L.weekR, dayR: L.dayR };
}
function openTasks() { return byType('task').filter(t => !t.done && t.status !== 'someday' && (!t.projectId || isNextStep(t))); }
function taskBuckets() {
  const t = todayISO(), wk = addDays(t, 7);
  const open = openTasks();
  const eff = x => x.date && x.date < t ? x.date : x.doDate ? (x.doDate < t ? t : x.doDate) : x.date;
  const sortD = (a, b) => (a.date || '9').localeCompare(b.date || '9') || (a.createdAt || '').localeCompare(b.createdAt || '');
  return {
    over: open.filter(x => x.date && x.date < t).sort(sortD),
    today: open.filter(x => !(x.date && x.date < t) && eff(x) === t).sort(sortD),
    soon: open.filter(x => eff(x) && eff(x) > t && eff(x) <= wk).sort(sortD),
    later: open.filter(x => eff(x) && eff(x) > wk).sort(sortD),
    none: open.filter(x => !eff(x)).sort(sortD)
  };
}
function nextEvent() {
  const t = todayISO(), now = hmToMin(nowHM());
  const today = eventsOn(t).filter(e => (hmToMin(e.end || e.start) ?? 0) >= now);
  if (today.length) return today[0];
  for (let i = 1; i <= 14; i++) { const n = eventsOn(addDays(t, i)); if (n.length) return n[0]; }
  return null;
}
function countdown(e) {
  if (!e || !e.start) return '';
  const t = todayISO();
  if (e.date !== t) return relDay(e.date);
  const diff = hmToMin(e.start) - hmToMin(nowHM());
  if (diff <= 0) return 'läuft gerade';
  if (diff < 60) return 'in ' + diff + ' Min';
  const h = Math.floor(diff / 60), m = diff % 60;
  return 'in ' + h + ' Std' + (m ? ' ' + m + ' Min' : '');
}
function greeting() {
  const h = new Date().getHours();
  const base = h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend';
  return base + (S.settings.name ? ', ' + S.settings.name : '') + '.';
}
// Jeder Hinweis hat eine Art (kind), damit man ihn in „Hinweise“ abschalten kann
const HINT_KINDS = { unwetter: 'Amtliche Unwetterwarnungen', losfahren: 'Wann du spätestens losfahren musst', gewohnheit: 'Erinnerung an Gewohnheiten', ueberfaellig: 'Überfällige Aufgaben', faellig: 'Bald fällige Aufgaben', abschluss: 'Tagesabschluss am Abend', wetter: 'Wetter bei Terminen draußen', geburtstag: 'Geburtstage', siri: 'Neue Siri-Notizen', wochenplan: 'Sonntags: nächste Woche planen', lernplan: 'Prüfung ohne Lernplan', lernkarten: 'Fällige Lernkarten', klausur: 'Klausuren in den nächsten 14 Tagen', woche: 'Überplante Woche', eingang: 'Notizen im Eingangskorb', vertrag: 'Kündigungsfristen von Verträgen', gedaechtnis: 'Neue Vermutungen im Gedächtnis', zeit: 'Abends: Termine von heute als Zeit erfassen', projekt: 'Projekte ohne nächsten Schritt', spaeter: 'Monatlich: „später vielleicht“ durchsehen' };
function hintsAll() {
  const out = [];
  const b = taskBuckets();
  if (b.over.length) out.push({ kind: 'ueberfaellig', text: b.over.length === 1 ? '„' + b.over[0].title + '“ ist überfällig.' : b.over.length + ' Aufgaben sind überfällig.', action: b.over.length === 1 ? { label: 'Auf heute legen', fn: 'moveToday', id: b.over[0].id } : null });
  const t = todayISO();
  const due = openTasks().filter(x => x.date === addDays(t, 1) || x.date === addDays(t, 2));
  due.slice(0, 1).forEach(x => out.push({ kind: 'faellig', text: '„' + x.title + '“ ist ' + relDay(x.date) + ' fällig.', action: null }));
  const h = new Date().getHours();
  const todayOpen = [...b.over, ...b.today];
  const ta = timeAskList()[0];
  if (ta) out.unshift({ kind: 'zeit', text: 'Heute ' + ta.b.start + '–' + ta.b.end + ' „' + ta.b.title + '“ als Zeit erfassen (' + catName(ta.c.cat, ta.c.sub) + ')?', action: { label: 'Eintragen', fn: 'tlog', id: ta.b.id }, action2: { label: 'Nein', fn: 'tskip', id: ta.b.id } });
  const nowM = nowHM();
  (S.wxAlerts || []).slice(0, 2).forEach(a => out.unshift({ kind: 'unwetter', text: '⚠️ Amtliche Warnung' + (S.settings.wxName ? ' für ' + S.settings.wxName : '') + ': ' + a.title + (a.until ? ' (bis ' + a.until + ' Uhr)' : '') + '.', action: null }));
  departures(t).filter(x => x.at > nowM && hmToMin(x.at) - hmToMin(nowM) <= 120).slice(0, 1).forEach(x => out.unshift({ kind: 'losfahren', text: 'Spätestens um ' + x.at + ' Uhr losfahren: „' + x.b.title + '“ beginnt um ' + x.b.start + ' Uhr (' + x.tr + ' Min. Fahrt' + (x.wet ? ', Regen gemeldet' : '') + ').', action: null }));
  activeHabits().filter(x => x.remind && x.remind <= nowM && (!x.winTo || nowM <= x.winTo) && habitDue(x, t) && !habitDoneOn(x, t)).slice(0, 2).forEach(x => out.unshift({ kind: 'gewohnheit', text: 'Erinnerung: ' + x.title + (x.winTo ? ' (bis ' + x.winTo + ' Uhr)' : '') + (x.mini ? '. Wenig Zeit? Mini reicht: ' + x.mini : '') + '.', action: (x.kind || 'check') === 'check' ? { label: 'Erledigt', fn: 'habitdone', id: x.id } : { label: 'Eintragen', fn: 'go', route: 'gewohnheiten' } }));
  if (h >= 18 && todayOpen.length) out.unshift({ kind: 'abschluss', text: 'Tagesabschluss: ' + (todayOpen.length === 1 ? '1 Aufgabe ist' : todayOpen.length + ' Aufgaben sind') + ' noch offen. Auf morgen verschieben?', action: { label: 'Alles auf morgen', fn: 'allTomorrow' } });
  blocksOn(t).concat(blocksOn(addDays(t, 1))).filter(b => b.start && isOutside(b)).forEach(b => {
    const w = wxAt(b.date, b.start), warn = wxWarn(w); if (!warn) return;
    out.push({ kind: 'wetter', text: (b.date === t ? 'Heute' : 'Morgen') + ' ' + b.start + ' ' + b.title + ': ' + warn.text + '. ' + warn.tip, action: null });
  });
  [[t, 'Heute'], [addDays(t, 1), 'Morgen']].forEach(([d, w]) => { const bs = bdaysOn(d); if (bs.length) out.unshift({ kind: 'geburtstag', text: '🎂 ' + w + ': ' + bs.map(x => x.name + (x.age ? ' (' + x.age + ')' : '')).join(', ') + '.', action: null }); });
  const siriN = byType('note').filter(n => n.source === 'siri');
  if (siriN.length) out.unshift({ kind: 'siri', text: 'Per Siri: ' + (siriN.length === 1 ? '„' + siriN[0].title.slice(0, 60) + '“' : siriN.length + ' neue Notizen') + '.', action: { label: 'Einsortieren', fn: 'siriSort' } });   // sortiert ohne KI (04-eingabe.js)
  byType('contract').forEach(c => { const ci = contractInfo(c); if (ci && ci.left >= 0 && ci.left <= Number(S.settings.contractLead || 28)) out.unshift({ kind: 'vertrag', text: 'Vertrag „' + c.title + '“: ' + (Number(c.renew || 0) > 0 ? 'spätestens ' + relDay(ci.by) + ' kündigen, sonst verlängert er sich.' : 'Kündigungsfrist endet ' + relDay(ci.by) + '.'), action: { label: 'Verträge ansehen', fn: 'go', route: 'vertraege' } }); });
  const dueCards = dueCardList().length;
  if (dueCards) out.push({ kind: 'lernkarten', text: dueCards + (dueCards === 1 ? ' Lernkarte ist' : ' Lernkarten sind') + ' heute dran.', action: { label: 'Jetzt abfragen', fn: 'review' } });
  byType('subject').filter(x => x.examDate && x.examDate >= t && x.examDate <= addDays(t, 14) && examLead(x) === x).forEach(x => out.push({ kind: 'klausur', text: examWord(x) + ' ' + examName(x) + ' ' + relDay(x.examDate) + ' (in ' + daysUntil(x.examDate) + ' Tagen).', action: { label: 'Zum Fach', fn: 'subject', id: x.id } }));
  const ws = weekStats(mondayOf(t));
  if (ws.lvl === 'r') out.push({ kind: 'woche', text: 'Diese Woche ist überplant (' + fmtH(ws.total) + ' Std. verplant, eng wird es ab ' + fmtH(ws.limY) + ' Std.). Schau mal, was sich verschieben lässt.', action: { label: 'Woche ansehen', fn: 'go', route: 'woche' } });
  else { const full = ws.days.filter(x => x.date >= t && x.h >= ws.dayR); if (full.length) out.push({ kind: 'woche', text: full.map(x => (x.date === t ? 'Heute' : WD[dObj(x.date).getDay()])).join(' und ') + ' ist sehr voll (' + full.map(x => fmtH(x.h)).join(' und ') + ' Std. verplant). Die Woche insgesamt passt (' + fmtH(ws.total) + ' Std.).', action: { label: 'Woche ansehen', fn: 'go', route: 'woche' } }); }
  const notes = byType('note').length;
  if (notes) out.push({ kind: 'eingang', text: notes === 1 ? '1 Notiz im Eingangskorb wartet aufs Einsortieren.' : notes + ' Notizen im Eingangskorb warten aufs Einsortieren.', action: { label: 'Ansehen', fn: 'go', route: 'eingang' } });
  const guess = byType('memory').filter(m => m.confirmed === false).length;
  if (guess) out.push({ kind: 'gedaechtnis', text: guess === 1 ? 'Jarvis hat sich etwas über dich gemerkt. Stimmt das?' : 'Jarvis hat sich ' + guess + ' Dinge über dich gemerkt. Stimmen die?', action: { label: 'Ansehen', fn: 'go', route: 'gedaechtnis' } });
  const hang = byType('project').filter(p => !p.done && !nextStepOf(p.id));
  if (hang.length) out.push({ kind: 'projekt', text: hang.length === 1 ? 'Beim Projekt „' + hang[0].title + '“ fehlt der nächste Schritt.' : hang.length + ' Projekten fehlt der nächste Schritt.', action: { label: 'Ansehen', fn: 'go', route: 'aufgaben', id: 'tab:projekte' } });
  const sd = somedayList().length;
  if (sd && (S.settings.somedaySeen || '') < t.slice(0, 7)) out.push({ kind: 'spaeter', text: sd + (sd === 1 ? ' Sache liegt' : ' Sachen liegen') + ' bei „später vielleicht“. Willst du eine davon jetzt angehen oder streichen?', action: { label: 'Ansehen', fn: 'go', route: 'aufgaben', id: 'tab:spaeter' } });
  const nm = addDays(mondayOf(t), 7);
  if (dow(t) === 7 && h >= 16 && S.settings.weekPlanned !== nm) out.unshift({ kind: 'wochenplan', text: 'Sonntagabend: Nimm dir 10 Minuten und plan deine nächste Woche (' + weekLabel(nm) + ').', action: { label: 'Woche planen', fn: 'plan' } });
  byType('subject').filter(x => x.examDate && x.examDate > t && daysUntil(x.examDate) <= 42 && !['keine', 'mit'].includes(x.examKind) && !studyBlocks(x.id).length).slice(0, 1)
    .forEach(x => out.push({ kind: 'lernplan', text: examTitle(x) + ': noch ' + daysUntil(x.examDate) + ' Tage bis zur ' + examKindWord(x) + ', aber noch kein Lernplan.', action: { label: 'Lernplan machen', fn: 'studyplan', id: x.id } }));
  return out;
}
// Ein Hinweis lässt sich mit ✕ für heute ausblenden: settings.hintGone = { d: Datum, k: [Schlüssel] }
const hintKey = h => (h.kind || 'x') + ':' + (h.action && h.action.id ? h.action.id : String(h.text || '').replace(/\d+([.,]\d+)?/g, '#').slice(0, 60));
const hintsGone = () => { const g = S.settings.hintGone; return g && g.d === todayISO() ? g.k || [] : []; };
function hints() { const off = S.settings.hintsOff || [], gone = hintsGone(); return hintsAll().filter(h => !off.includes(h.kind) && !gone.includes(hintKey(h))).slice(0, 4); }
document.addEventListener('click', async (ev) => {
  const x = ev.target.closest('[data-hintx]'); if (!x) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  S.settings = { ...S.settings, hintGone: { d: todayISO(), k: hintsGone().concat(x.dataset.hintx) } };
  render(); showToast('Hinweis für heute ausgeblendet.'); await store.setSettings(S.settings);
}, true);
// Ruhezeit: in dieser Zeit zeigt die Heute-Seite keine Hinweise (Standard 21 bis 7 Uhr)
function inQuiet() {
  if (S.settings.quietOn === false) return false;
  const now = hmToMin(nowHM()), a = hmToMin(S.settings.quietFrom || '21:00'), z = hmToMin(S.settings.quietTo || '07:00');
  return a <= z ? now >= a && now < z : now >= a || now < z;
}

