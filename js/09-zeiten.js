'use strict';
/* Jarvis-App – 09-zeiten.js (aus Jarvis in Claude, Zeilen 4147–5135 von V48) */
/* ===================== Zeiten: eigene Bereiche ===================== */
// settings.timeCats = [{id, name, color, goal (Std./Woche), subs[], words[], hidden, pause}] – fehlt es, gelten DEFAULT_CATS
const CAT_COLORS = [['arbeit', 'Ocker'], ['uni', 'Blau'], ['team', 'Petrol'], ['alltag', 'Lila'], ['g', 'Grün'], ['o', 'Orange'], ['ac', 'Akzent']];
const DEFAULT_CATS = [
  { id: 'arbeit', name: 'Arbeit', color: 'arbeit', goal: null, subs: ['Fahrt'], words: ['arbeit', 'gearbeitet', 'büro', 'homeoffice', 'home-office', 'job', 'schicht'], pause: true },
  { id: 'uni', name: 'Uni', color: 'uni', goal: null, subs: [], words: ['uni', 'gelernt', 'lernen', 'vorlesung', 'übungsblatt', 'klausur', 'seminar', 'studium', 'hausarbeit', 'bibliothek'] },
  { id: 'ehrenamt', name: 'Ehrenamt', color: 'team', goal: null, subs: ['Training', 'Spiel', 'Vorbereitung', 'Fahrt'], words: ['ehrenamt', 'verein', 'mannschaft', 'u13', 'trainer'] },
  { id: 'privat', name: 'Privat', color: 'alltag', goal: null, subs: [], words: ['privat', 'sport', 'gym', 'fitness', 'laufen', 'joggen', 'gelaufen', 'gejoggt', 'haushalt', 'freizeit', 'lesen', 'gelesen'] }
];
const SUB_WORDS = { fahrt: ['fahrt', 'gefahren', 'auto', 'zug', 'bahn', 'transit', 'pendel', 'gependelt', 'anfahrt', 'rückfahrt', 'unterwegs', 'bus'], training: ['training', 'trainiert'], spiel: ['spiel', 'turnier', 'match', 'auswärts'], vorbereitung: ['vorbereitung', 'vorbereitet', 'vorbereiten'] };
const LEGACY_CAT = { team: 'ehrenamt', alltag: 'privat', freizeit: 'privat' };
function timeCats() { const c = S.settings.timeCats; return Array.isArray(c) && c.length ? c : DEFAULT_CATS; }
const visCats = () => timeCats().filter(c => !c.hidden);
function catId(id) { if (!id) return null; const cats = timeCats(); if (cats.some(c => c.id === id)) return id; const l = LEGACY_CAT[id]; return l && cats.some(c => c.id === l) ? l : id; }
function catOf(id) { const k = catId(id); return timeCats().find(c => c.id === k) || { id: k || '', name: k ? ({ team: 'Team', alltag: 'Alltag', freizeit: 'Freizeit' }[k] || k) : 'Ohne Bereich', color: 'ac', subs: [], words: [] }; }
const catName = (id, sub) => catOf(id).name + (sub ? ' › ' + sub : '');
const catColor = id => 'var(--' + (catOf(id).color || 'ac') + ')';
const splitCat = v => { const [c, ...s] = String(v || '').split('|'); return { cat: c || null, sub: s.join('|') || null }; };
// Auswahlliste „Bereich“ inkl. Unterbereichen, Wert = 'bereich' oder 'bereich|Unterbereich'
function catOptions(val, empty) {
  val = val || '';
  return (empty ? '<option value="">' + esc(empty) + '</option>' : '') + timeCats().filter(c => !c.hidden || val === c.id || val.startsWith(c.id + '|')).map(c =>
    '<option value="' + esc(c.id) + '"' + (val === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>' +
    (c.subs || []).map(s => '<option value="' + esc(c.id + '|' + s) + '"' + (val === c.id + '|' + s ? ' selected' : '') + '>' + esc(c.name + ' › ' + s) + '</option>').join('')).join('');
}
const normTxt = s => ' ' + String(s || '').toLowerCase().replace(/[.,;:!?()„“"']/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
function subHit(c, t) { return (c.subs || []).find(s => { const k = s.toLowerCase(); return [k, ...(SUB_WORDS[k] || [])].some(w => t.includes(' ' + w)); }) || null; }
// Bereich aus einem Satz erraten: Stichworte zählen; sonst ein Unterbereich, den nur EIN Bereich hat
function guessCat(text) {
  const t = normTxt(text), cats = visCats();
  let best = null, bestN = 0;
  cats.forEach(c => { const n = [c.name.toLowerCase(), ...(c.words || [])].filter(w => w && t.includes(' ' + String(w).toLowerCase())).length; if (n > bestN) { best = c; bestN = n; } });
  if (best) return { cat: best.id, sub: subHit(best, t) };
  const withSub = cats.map(c => ({ c, s: subHit(c, t) })).filter(x => x.s);
  return withSub.length === 1 ? { cat: withSub[0].c.id, sub: withSub[0].s, bySub: true } : null;
}
// Grenzen für die Ampel (Woche/Tag verplant, Arbeit über Soll)
function loadLimits() {
  const L = { weekY: 45, weekR: 55, dayY: 10, dayR: 12, overR: 5, ...(S.settings.load || {}) };
  Object.keys(L).forEach(k => { L[k] = Math.max(0, Number(L[k]) || 0); });
  L.weekR = Math.max(L.weekR, L.weekY); L.dayR = Math.max(L.dayR, L.dayY);
  return L;
}
function catGoal(c) { if (!c) return null; if (c.goal != null && c.goal !== '') return Number(c.goal); return c.id === 'arbeit' ? Number(S.settings.workHours ?? 20) : null; }

/* ----- Zeit-Einträge (liegen weiter in den Tages-Dokumenten 'tl-JJJJ-MM-TT') ----- */
// Eintrag: {id, cat, sub, label, min (zählt), start, end, pause, less (davon-Teile), src, at, calRef}
const tlId = d => 'tl-' + d;
const dayDoc = d => S.items.find(i => i.id === tlId(d));
const minToHm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const rangeMin = (a, b) => { const x = hmToMin(a), y = hmToMin(b); return x != null && y != null && y > x ? y - x : 0; };
// Pause ohne erfasste Pause: über 6 Std. bis zu 30 Min. (nie unter 6:00), bleibt danach mehr als 9 Std. übrig, nochmal bis zu 15 Min. (nie unter 9:00)
// Beispiele: 8:00 → 7:30, 9:40 → 9:00, 10:00 → 9:15
const autoPauseMin = r => { if (r <= 360) return 0; let p = Math.min(30, r - 360); if (r - p > 540) p += Math.min(15, r - p - 540); return p; };
const entryStart = e => e.start || (e.at ? pad(new Date(e.at).getHours()) + ':' + pad(new Date(e.at).getMinutes()) : '');
function rawEntries(d) { const x = dayDoc(d); return ((x && x.entries) || []).map((e, i) => e.id ? e : { ...e, id: 'tl-' + d + ':' + i }); }
function dayEntries(d) { return rawEntries(d).map(e => ({ ...e, date: d, cat: catId(e.cat), min: Number(e.min) || 0 })); }
function periodEntries(from, to) {
  const out = [];
  S.items.filter(i => i.type === 'timeday' && i.date >= from && i.date <= to).forEach(x => out.push(...dayEntries(x.date)));
  return out.sort((a, b) => (a.date + entryStart(a)).localeCompare(b.date + entryStart(b)));
}
async function saveDay(d, entries) {
  const doc = { id: tlId(d), type: 'timeday', title: 'Zeit ' + d, date: d, entries: entries.slice(-300).map(e => { const c = { ...e }; delete c.date; Object.keys(c).forEach(k => { if (c[k] == null || c[k] === '') delete c[k]; }); return c; }) };
  if (db) S.items = S.items.filter(i => i.id !== doc.id).concat([doc]);   // sofort sichtbar, auch bei mehreren Einträgen hintereinander
  await withRetry(() => store.setItem(doc));
  return doc;
}
// Vorher-Stand eines Tages für „Rückgängig“ (gab es den Tag noch nicht: leerer Tag)
const daySnap = d => { const x = dayDoc(d); return x ? JSON.parse(JSON.stringify(x)) : { id: tlId(d), type: 'timeday', title: 'Zeit ' + d, date: d, entries: [] }; };
// Zeiten nie doppelt: automatisch erfasste Zeit (Stoppuhr, Fokus, Lernzeit, Kalender) wird um schon erfasste Zeiträume gekürzt,
// eine selbst eingetragene Zeit (per Satz, von Hand) geht vor und kürzt überlappende automatische Einträge.
const AUTO_SRC = ['track', 'focus', 'lernzeit', 'kalender', 'pause'];
const isAutoEntry = e => AUTO_SRC.includes(e.src);
const spanOf = e => e.start && e.end && hmToMin(e.end) > hmToMin(e.start) ? [hmToMin(e.start), hmToMin(e.end)] : null;
function freeParts(sp, others) {   // Teile von sp, die von keinem anderen Zeitraum bedeckt sind
  let parts = [sp];
  for (const o of others) { const r = spanOf(o); if (!r) continue; parts = parts.flatMap(([a, b]) => r[1] <= a || r[0] >= b ? [[a, b]] : [[a, Math.min(b, r[0])], [Math.max(a, r[1]), b]].filter(([x, y]) => y - x >= 1)); }
  return parts.filter(([a, b]) => b - a >= 1);
}
const partEntry = (e, [a, b], i) => ({ ...e, id: i ? uid() : e.id, start: minToHm(a), end: minToHm(b), min: b - a, pause: null });
function trimAutoUnder(list, x) {   // automatische Einträge um den Zeitraum von x kürzen
  const sp = spanOf(x); if (!sp) return list;
  return list.flatMap(e => { const r = spanOf(e); if (!r || !isAutoEntry(e) || r[1] <= sp[0] || r[0] >= sp[1]) return [e]; return freeParts(r, [x]).map((p, i) => partEntry(e, p, i)); });
}
// Rangfolge: selbst eingetragen (3) geht vor gemessener Zeit (Stoppuhr, Fokus, Lernzeit: 2), die vor Zeit aus dem Kalender (1).
// Eine Stoppuhr ersetzt einen überlappenden Kalender-Eintrag desselben Bereichs ganz (sie ist die echte Messung dieses Termins).
const entryRank = e => e.calRef || e.src === 'kalender' ? 1 : isAutoEntry(e) ? 2 : 3;
const overlaps = (a, b) => a && b && a[0] < b[1] && b[0] < a[1];
function mergeEntry(list, x) {
  const sp = spanOf(x), R = entryRank(x);
  if (!sp) return { list: list.concat([x]), added: [x], clipped: false };
  if (R === 1 && list.some(e => e.cat === x.cat && entryRank(e) === 2 && overlaps(spanOf(e), sp))) return { list, added: [], clipped: true };
  list = list.flatMap(e => { const r = spanOf(e); if (!r || entryRank(e) >= R || !overlaps(r, sp)) return [e]; if (R === 2 && entryRank(e) === 1 && e.cat === x.cat) return []; return freeParts(r, [x]).map((p, i) => partEntry(e, p, i)); });
  if (R === 3) return { list: list.concat([x]), added: [x], clipped: false };
  const parts = freeParts(sp, list.filter(e => entryRank(e) >= R));
  if (parts.length === 1 && parts[0][0] === sp[0] && parts[0][1] === sp[1]) return { list: list.concat([x]), added: [x], clipped: false };
  const xs = parts.map((p, i) => partEntry(x, p, i));
  return { list: list.concat(xs), added: xs, clipped: true };
}
// Automatische Pause für den Tag eines Bereichs mit Pausenpflicht (Arbeit): fehlt Pause, wird sie beim letzten gemessenen Eintrag abgezogen
function applyDayPause(list, cat) {
  if (!catOf(cat).pause) return list;
  list = list.map(e => e.cat === cat && e.autoPause ? { ...e, min: e.min + e.autoPause, pause: (Number(e.pause) || 0) - e.autoPause || null, autoPause: null } : e);
  const es = list.filter(e => e.cat === cat), span = e => { const r = spanOf(e); return r ? r[1] - r[0] : Number(e.min) || 0; };
  const gross = es.reduce((a, e) => a + span(e), 0), taken = es.reduce((a, e) => a + Math.max(0, span(e) - (Number(e.min) || 0)), 0);
  let need = autoPauseMin(gross) - taken; if (need <= 0) return list;
  const tgt = es.filter(e => entryRank(e) <= 2).sort((a, b) => b.min - a.min)[0]; if (!tgt) return list;
  need = Math.min(need, tgt.min);
  return list.map(e => e === tgt ? { ...e, min: e.min - need, pause: (Number(e.pause) || 0) + need, autoPause: need } : e);
}
async function addTimeEntry(d, e) {
  const x = { id: uid(), ...e, cat: catId(e.cat) }; delete x.date;
  const m = mergeEntry(rawEntries(d), x);
  if (spanOf(x) && entryRank(x) < 3 && !m.added.length) return null;   // war schon erfasst
  const list = applyDayPause(m.list, x.cat);
  await saveDay(d, list);
  const got = list.filter(y => m.added.some(a => a.id === y.id));
  return { ...x, min: got.reduce((a, y) => a + y.min, 0), clipped: m.clipped, autoPause: got.reduce((a, y) => a + (y.autoPause || 0), 0), parts: got };
}
// Heute erfasste Zeit eines Bereichs (netto, nach Pause), die laufende Stoppuhr zählt mit, ohne doppelt zu zählen
function catDay(cat) {
  let list = rawEntries(todayISO()).map(e => ({ ...e, cat: catId(e.cat), min: Number(e.min) || 0 }));
  const F = S.focus;
  if (F && F.mode === 'track' && F.cat === cat) {
    const el = Math.round(focusElapsed() / 60000), st = new Date(F.startedAt), s0 = st.getHours() * 60 + st.getMinutes(), end = Math.min(1439, hmToMin(nowHM()));
    if (isoDate(st) === todayISO() && end > s0) list = mergeEntry(list, { id: '__run', cat, src: 'track', start: minToHm(s0), end: minToHm(end), min: Math.min(el, end - s0), pause: Math.max(0, end - s0 - el) || null }).list;
    else list = list.concat([{ id: '__run', cat, src: 'track', min: el }]);
  }
  list = applyDayPause(list, cat);
  const es = list.filter(e => e.cat === cat);
  return { min: es.reduce((a, e) => a + e.min, 0), autoPause: es.reduce((a, e) => a + (e.autoPause || 0), 0) };
}
const catNowMs = cat => catDay(cat).min * 60000;
// Einmal pro Tag: alte Doppelungen der letzten 14 Tage aufräumen (mit Rückgängig)
async function cleanOverlaps() {
  try { if (localStorage.getItem('jarvis.ovclean') === todayISO()) return; } catch (e) {}
  const snaps = []; let removed = 0;
  for (let k = 0; k < 14; k++) {
    const d = addDays(todayISO(), -k), x = dayDoc(d); if (!x || !(x.entries || []).length) continue;
    const raw = rawEntries(d), ord = raw.slice().sort((a, b) => entryRank(b) - entryRank(a) || String(a.at || '').localeCompare(String(b.at || '')));
    let kept = [], changed = false;
    for (const e of ord) {
      const n0 = kept.length, m = mergeEntry(kept, e);
      if (m.clipped || m.list.length !== n0 + 1) { changed = true; if (!m.added.length) removed++; removed += Math.max(0, n0 - (m.list.length - m.added.length)); }
      kept = m.list;
    }
    if (changed) for (const c of new Set(kept.map(e => e.cat))) kept = applyDayPause(kept, c);
    if (changed) { snaps.push(daySnap(d)); const order = raw.map(e => e.id); kept.sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999)); await saveDay(d, kept); }
  }
  try { localStorage.setItem('jarvis.ovclean', todayISO()); } catch (e) {}
  if (snaps.length) { logAct('Doppelte Zeiten aufgeräumt', { restore: snaps }); showToast(removed ? removed + (removed === 1 ? ' doppelter Zeiteintrag entfernt.' : ' doppelte Zeiteinträge entfernt.') : 'Doppelte Zeiten gekürzt.', () => restoreDays(snaps)); render(); }
}
setTimeout(function ovTry() { if (S.loaded && S.items.length) cleanOverlaps(); else setTimeout(ovTry, 3000); }, 5000);
async function removeTimeEntry(id, d) { const list = rawEntries(d), x = list.find(e => e.id === id); if (!x) return null; await saveDay(d, list.filter(e => e.id !== id)); return x; }
async function restoreDays(snaps) { for (const s of snaps) { if (db) S.items = S.items.filter(i => i.id !== s.id).concat([s]); await withRetry(() => store.setItem(s)); } }
function dupEntry(d, x, ignoreId) {
  return dayEntries(d).find(e => e.id !== ignoreId && e.cat === catId(x.cat) && (e.sub || null) === (x.sub || null) && (x.start && e.start ? e.start === x.start && e.end === x.end : !x.start && !e.start && e.min === x.min)) || null;
}
async function logTime(cat, label, min, src, startedAt, sub, endAt) {
  if (!min || min < 1) return;
  const st = new Date(startedAt || Date.now() - min * 60000), d = isoDate(st), s = pad(st.getHours()) + ':' + pad(st.getMinutes());
  const endM = endAt && isoDate(new Date(endAt)) === d ? (() => { const en = new Date(endAt); return Math.max(hmToMin(s) + Math.round(min), en.getHours() * 60 + en.getMinutes()); })() : hmToMin(s) + Math.round(min);
  const held = endM - hmToMin(s) - Math.round(min);
  return (await addTimeEntry(d, { cat: catId(cat) || 'privat', sub: sub || null, label: String(label || '').slice(0, 120), min: Math.round(min), start: s, end: endM < 1440 ? minToHm(endM) : null, pause: held > 0 ? held : null, src, at: st.toISOString() })) || { min: 0, clipped: true };
}

/* ----- Zeit per Satz (ohne KI): „heute 4 Std. gearbeitet“, „gestern 17 bis 19 Uhr Training“ ----- */
const NUMW = { ein: 1, eine: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5, dreieinhalb: 3.5 };
const WDN = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 7 };
const WDA = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
const PAST_WORDS = ['war', 'waren', 'hatte', 'hatten', 'gewesen', 'verbracht', 'gesessen', 'erledigt'];
const TIME_REJECT = ['übermorgen', 'nächst', 'kommend', 'plan', 'erinner', 'gewohnheit', 'will', 'muss', 'soll', 'werde', 'möchte', 'kaufen', 'jede'];
const FILLER = ['heute', 'gestern', 'vorgestern', 'ich', 'habe', 'hab', 'hatte', 'noch', 'auch', 'insgesamt', 'etwa', 'ca', 'circa', 'ungefähr', 'so', 'uhr', 'am', 'von', 'bis', 'mit', 'und', 'dann', 'danach', 'plus', 'zeit', 'erfassen', 'eintragen', 'bitte', 'für', 'beim', 'bei', 'im', 'in', 'der', 'die', 'das', 'den', 'dem', 'mich', 'mir', 'es', 'gemacht', 'war', 'gewesen', 'schon', 'total', 'jarvis', 'davon', 'dabei', 'wovon'];
const pastHit = t => (t.match(/[a-zäöüß]+/g) || []).some(w => PAST_WORDS.includes(w) || (/^ge[a-zäöüß]{2,}t$/.test(w) && !['geplant', 'gesamt', 'gehalt', 'gerät'].includes(w)));
function parseDayIn(t) {
  const today = todayISO();
  if (/\bvorgestern\b/.test(t)) return { date: addDays(today, -2), rel: 1 };
  if (/\bgestern\b/.test(t)) return { date: addDays(today, -1), rel: 1 };
  const m = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
  if (m) {
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : Number(today.slice(0, 4));
    let d = y + '-' + pad(Number(m[2])) + '-' + pad(Number(m[1]));
    if (!m[3] && d > today && (dObj(d) - dObj(today)) / 864e5 > 200) d = (y - 1) + d.slice(4);   // „28.12.“ im Januar = letztes Jahr
    if (isNaN(dObj(d).getTime()) || d > today) return { future: 1 };
    return { date: d, rel: 1, cut: m[0] };
  }
  let wd = null;
  Object.entries(WDN).forEach(([k, v]) => { if (new RegExp('\\b' + k + '\\b').test(t)) wd = v; });
  if (!wd) { const a = t.match(/\b(mo|di|mi|do|fr|sa)\.?\s+(?=\d)/); if (a) wd = WDA[a[1]]; }
  if (wd) { const diff = (dow(today) - wd + 7) % 7; return { date: addDays(today, -diff), wd: 1 }; }
  if (/\bheute\b/.test(t)) return { date: today, today: 1 };
  return null;
}
function durIn(t) {
  let min = 0, hit = false;
  t.replace(/\b(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s*(std|stunden?|h)\b/g, (all, n) => { const v = /\d/.test(n) ? Number(n.replace(',', '.')) : NUMW[n]; if (v) { min += v * 60; hit = true; } return ''; });
  t.replace(/\b(halbe|dreiviertel|viertel)\s+stunde\b/g, (all, w) => { min += { halbe: 30, dreiviertel: 45, viertel: 15 }[w]; hit = true; return ''; });
  t.replace(/\b(\d+)\s*(min|minuten)\b/g, (all, n) => { min += Number(n); hit = true; return ''; });
  return hit ? Math.round(min) : 0;
}
const PAUSE_RE = /\b(?:(ohne|keine)\s+pause|(?:mit\s+)?(\d+(?:[.,]\d+)?|halbe|eine|einer|einen)\s*(std|stunden?|h|min|minuten|stunde)?\.?\s*pause|pause\s*(?:von\s*)?(\d+(?:[.,]\d+)?)\s*(std|stunden?|h|min|minuten))\b/;
function pauseIn(t) {
  const m = t.match(PAUSE_RE); if (!m) return null;
  if (m[1]) return { min: 0, cut: m[0] };
  const n = m[2] || m[4], unit = m[3] || m[5] || 'min';
  const v = n === 'halbe' ? 30 : /\d/.test(n) ? Number(n.replace(',', '.')) * (/^(std|stunde|stunden|h)$/.test(unit) ? 60 : 1) : 60;
  return { min: Math.round(v), cut: m[0] };
}
const RANGE_RE = /\b(?:von\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:-|–|bis)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?(?!\s*(?:std|stunde|min|h\b))/;
function parseTimeLocal(text) {
  let t = String(text || '').toLowerCase().replace(/heute\s+morgen\b/g, 'heute').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 400 || t.includes('?')) return null;
  const words = t.match(/[a-zäöüß]+/g) || [];
  if (words.includes('morgen') || words.some(w => TIME_REJECT.some(r => w.startsWith(r)))) return null;
  const global = parseDayIn(t);
  if (global && global.future) return null;
  const clauses = t.replace(/\b(davon|dabei|wovon)\b/g, ',$1').split(/[,;\n]|\bund\b|\bdann\b|\bdanach\b|\bplus\b/).map(s => s.trim()).filter(Boolean);
  const items = []; let day = null, pendingPause = null, pendingCat = null, n = 0;
  const now = hmToMin(nowHM());
  for (let c of clauses) {
    const dd = parseDayIn(c); if (dd && dd.future) return null;
    if (dd) day = dd; if (dd && dd.cut) c = c.replace(dd.cut, ' ');
    const isPart = /^(davon|dabei|wovon)\b/.test(c);
    const pz = pauseIn(c); if (pz) c = c.replace(pz.cut, ' ');
    const rm = c.match(RANGE_RE);
    let start = null, end = null;
    if (rm) {
      const h1 = Number(rm[1]), m1 = Number(rm[2] || 0), h2 = Number(rm[3]), m2 = Number(rm[4] || 0);
      if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
      start = pad(h1) + ':' + pad(m1); end = pad(h2 === 24 ? 23 : h2) + ':' + pad(h2 === 24 ? 59 : m2);
      if (!rangeMin(start, end)) return null;
      c = c.replace(rm[0], ' ');
    }
    const dur = rm ? 0 : durIn(c);
    const g = guessCat(c);
    if (!rm && !dur) {
      if (pz) { const last = items.slice().reverse().find(x => x.start); if (last) { last.pause = pz.min; last.pauseSet = true; } else pendingPause = pz.min; continue; }
      if (g) { pendingCat = g; if (items.length && !items[items.length - 1].catv) items[items.length - 1].catv = g.cat + (g.sub ? '|' + g.sub : ''); continue; }
      const rest = (c.match(/[a-zäöüß]+/g) || []).filter(w => !FILLER.includes(w) && !pastHit(w));
      if (rest.length) return null;
      continue;
    }
    let cat = g;
    const prev = items[items.length - 1];
    if (prev && prev.catv && (!g || g.bySub)) {   // nur Unterbereich genannt („davon 2 Std. Auto“): Bereich vom vorigen Eintrag
      const pc = catOf(splitCat(prev.catv).cat), s = subHit(pc, normTxt(c));
      const amb = visCats().some(x => subHit(x, normTxt(c)));   // Unterbereich, den der vorige Bereich nicht hat: lieber nachfragen
      if (s) cat = { cat: pc.id, sub: s }; else if (!g && !amb) cat = { cat: pc.id, sub: null };
    }
    if (!cat && pendingCat) cat = pendingCat;
    const it = { type: 'time', title: '', date: (day || global || {}).date || todayISO(), start, end, min: rm ? null : dur, catv: cat ? cat.cat + (cat.sub ? '|' + cat.sub : '') : '', key: 'k' + (n++), src: 'satz' };
    if (pz) { it.pause = pz.min; it.pauseSet = true; } else if (rm && pendingPause != null) { it.pause = pendingPause; it.pauseSet = true; pendingPause = null; }
    if (isPart && prev) it.partOf = prev.partOf || prev.key;
    if (!rm && !it.partOf && !pastHit(t) && !(day || global || {}).rel) { /* Dauer ohne Vergangenheit: nur mit „heute“ + Vergangenheitswort */ return null; }
    if (rm && it.date === todayISO() && !pastHit(t) && !(day || global || {}).rel && hmToMin(end) > now) return null;
    if ((day || global || {}).wd && !pastHit(t)) return null;
    items.push(it);
  }
  if (!items.length) return null;
  items.forEach(fixTime);
  return { items, ok: items.every(x => x.catv) };
}
function fixTime(it) {
  if (!it || it.type !== 'time') return;
  const r = rangeMin(it.start, it.end);
  if (r && !it.pauseSet) it.pause = catOf(splitCat(it.catv).cat).pause ? autoPauseMin(r) : 0;
  if (!r) { it.pause = null; it.pauseSet = false; }
}
function timeNet(it, list) {
  const r = rangeMin(it.start, it.end);
  if (!r) return Math.max(0, Math.round(Number(it.min) || 0));
  const less = (list || []).filter(x => x !== it && x.type === 'time' && x.partOf && x.partOf === it.key).reduce((s, x) => s + timeNet(x, []), 0);
  return Math.max(0, r - (Number(it.pause) || 0) - less);
}
const catListForAI = () => visCats().map(c => c.id + ' = ' + c.name + ((c.subs || []).length ? ' (Unterbereiche: ' + c.subs.join(', ') + ')' : '') + ((c.words || []).length ? ' [z. B. ' + c.words.slice(0, 6).join(', ') + ']' : '')).join('; ');
const habitListForAI = () => activeHabits().map(h => h.id + ' = ' + h.title + ' (' + ({ check: 'abhaken', minutes: 'Minuten', count: 'Anzahl' }[h.kind || 'check']) + ')').join('; ') || '(keine)';
function timePromptPart() {
  return 'Weitere Arten: "time" = bereits VERGANGENE Zeit, die er erfassen will ("heute 4 Std. gearbeitet", "gestern 17 bis 19 Uhr Training"): date, start+end falls Uhrzeiten genannt, sonst min (Dauer in Minuten); pause in Minuten NUR wenn er eine Pause nennt ("ohne Pause" = 0); cat und sub aus dieser Liste: ' + catListForAI() + '. ' +
    'Bei "davon 2 Std. Auto" einen zweiten time-Eintrag mit "part_of" = Index (ab 0) des Haupteintrags in items. Etwas, das erst noch kommt, ist ein event, nie time. ' +
    '"habit" = neue Gewohnheit, NUR wenn er ausdrücklich eine anlegen will: kind (check|minutes|count), target (Zahl pro Tag bei minutes/count), freq (daily|days|week), days (Liste 1-7, 1 = Montag, bei days), n (wie oft pro Woche, bei week), link ("bereich" oder "bereich|Unterbereich", wenn sie aus erfasster Zeit zählen soll, sonst null), unit (Einheit bei count, z. B. "Gläser", sonst null), remind ("HH:MM" falls er eine Erinnerungszeit nennt, sonst null), mini (Mindestversion als kurzer Text, nur wenn genannt, sonst null). ' +
    '"habitlog" = er meldet eine bestehende Gewohnheit als erledigt: habitId aus dieser Liste, date, amount (Zahl bei Minuten/Anzahl, sonst null): ' + habitListForAI() + '.\n';
}
function cleanSpecial(x) {
  const t = todayISO(), hm = v => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : null;
  const d = typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : t;
  const title = String(x.title || '').trim().slice(0, 200);
  if (x.type === 'time') {
    if (d > t) return cleanItem({ ...x, type: 'event' });
    let cat = catId(x.cat); if (!timeCats().some(c => c.id === cat)) { const g = guessCat([x.cat, x.sub, x.title].filter(Boolean).join(' ')); cat = g ? g.cat : null; }
    const c = cat && catOf(cat), sub = c ? (c.subs || []).find(s => s.toLowerCase() === String(x.sub || '').toLowerCase()) || null : null;
    const it = { type: 'time', title, date: d, start: hm(x.start), end: hm(x.end), min: Number(x.min) > 0 ? Math.min(1440, Math.round(Number(x.min))) : null, catv: cat ? cat + (sub ? '|' + sub : '') : '', src: 'satz' };
    if (!rangeMin(it.start, it.end)) { it.start = null; it.end = null; if (!it.min) it.min = 60; }
    if (x.pause != null && x.pause !== '' && !isNaN(Number(x.pause))) { it.pause = Math.max(0, Math.round(Number(x.pause))); it.pauseSet = true; }
    if (Number.isInteger(x.part_of)) it._part = x.part_of;
    return it;
  }
  if (x.type === 'habitlog') {
    const hs = byType('habit'), h = hs.find(h => h.id === x.habitId) || hs.find(h => title && h.title.toLowerCase() === title.toLowerCase());
    return { type: 'habitlog', title: h ? h.title : title, habitId: h ? h.id : '', date: d > t ? t : d, amount: Number(x.amount) > 0 ? Math.round(Number(x.amount)) : null };
  }
  return normHabit({ type: 'habit', title: title || 'Gewohnheit', kind: x.kind, target: x.target, freq: x.freq, days: x.days, n: x.n, link: x.link, unit: x.unit, remind: x.remind, mini: x.mini, log: {} });
}
// Vorschau-Felder für time / habit / habitlog
function specialFields(it, i) {
  const k = 'pv' + i;
  const inp = (f, type, val, extra) => '<input id="' + k + f + '" type="' + type + '" data-pv="' + i + '" data-f="' + f + '" value="' + esc(val ?? '') + '"' + (extra || '') + '>';
  const sel = (f, opts, val) => '<select id="' + k + f + '" data-pv="' + i + '" data-f="' + f + '">' + opts + '</select>';
  const lab = (l, inner, full) => '<label class="field' + (full ? ' full' : '') + '"><span>' + l + '</span>' + inner + '</label>';
  const opt = (list, val) => list.map(([v, l]) => '<option value="' + v + '"' + (String(val) === v ? ' selected' : '') + '>' + l + '</option>').join('');
  let h = '';
  if (it.type === 'time') {
    const r = rangeMin(it.start, it.end), list = (S.pending && S.pending.items) || [it], net = timeNet(it, list);
    const parts = list.filter(x => x.partOf && x.partOf === it.key), partSum = parts.reduce((s, x) => s + timeNet(x, []), 0), main = it.partOf && list.find(x => x.key === it.partOf);
    h += lab('Datum', inp('date', 'date', it.date, ' max="' + todayISO() + '"'));
    h += lab('Bereich', sel('catv', catOptions(it.catv, '– bitte wählen –')));
    h += lab('Von', inp('start', 'time', it.start)) + lab('Bis', inp('end', 'time', it.end));
    if (r) h += lab('Pause (Min.)' + (!it.pauseSet && it.pause ? ' · automatisch' : ''), inp('pause', 'number', it.pause || 0, ' min="0" max="600" step="5"'));
    else h += lab('Dauer (Std.)', inp('hrs', 'number', it.min ? Math.round(it.min / 60 * 100) / 100 : '', ' min="0" max="24" step="0.25" inputmode="decimal"'));
    h += '<p class="sub full" style="margin:0">' + (main ? 'Teil davon, wird beim Haupteintrag abgezogen. ' : '') + 'Zählt: <b>' + esc(fmtMin(net)) + '</b>' +
      (r ? ' (' + esc(fmtMin(r)) + (it.pause ? ' − ' + it.pause + ' Min. Pause' : '') + (partSum ? ' − ' + esc(fmtMin(partSum)) + ' davon' : '') + ')' : '') + (!it.catv ? ' · Bitte einen Bereich wählen.' : '') + '</p>';
  }
  if (it.type === 'habit') {
    const kind = it.kind || 'check', freq = hFreq(it);
    h += lab('Art', sel('kind', opt([['check', 'Abhaken'], ['minutes', 'Minuten'], ['count', 'Anzahl']], kind)));
    if (kind !== 'check') h += lab(kind === 'minutes' ? 'Ziel pro Tag (Min.)' : 'Ziel pro Tag (Anzahl)', inp('target', 'number', it.target || (kind === 'minutes' ? 20 : 1), ' min="1" max="1440"'));
    if (kind === 'count') h += lab('Einheit (z. B. Gläser, Seiten)', inp('unit', 'text', it.unit, ' maxlength="20" placeholder="Mal"'));
    h += kind === 'check' ? lab('Mindestversion für schlechte Tage (optional)', inp('mini', 'text', it.mini, ' maxlength="80" placeholder="z. B. nur 5 Min. dehnen"'), true)
      : lab('Mindestens (zählt als „Mini geschafft“)', inp('miniTarget', 'number', it.miniTarget, ' min="1" max="1440" placeholder="z. B. ' + (kind === 'minutes' ? '5' : '1') + '"'));
    h += lab('Zeitfenster von (optional)', inp('winFrom', 'time', it.winFrom)) + lab('bis', inp('winTo', 'time', it.winTo));
    h += lab('Erinnern um (optional)', inp('remind', 'time', it.remind));
    h += lab('Wie oft?', sel('freq', opt([['daily', 'Jeden Tag'], ['days', 'An festen Tagen'], ['week', 'X-mal pro Woche']], freq)));
    if (freq === 'week') h += lab('Wie oft pro Woche?', inp('n', 'number', it.n || 3, ' min="1" max="7"'));
    if (freq === 'days') h += '<fieldset class="full" style="border:0;padding:0;margin:0"><legend class="sub" style="margin-bottom:6px">An welchen Tagen?</legend><div class="daypick">' + [1, 2, 3, 4, 5, 6, 7].map(d => '<label><input type="checkbox" data-habday="' + d + '" data-hpv="' + i + '"' + ((it.days && it.days.length ? it.days : [1, 2, 3, 4, 5, 6, 7]).includes(d) ? ' checked' : '') + '><span>' + WDS[d % 7] + '</span></label>').join('') + '</div></fieldset>';
    h += lab('Zählt automatisch aus erfasster Zeit', sel('link', catOptions(it.link, 'Nein, selbst eintragen')), true);
    h += '<label class="toggle full"><input type="checkbox" data-pv="' + i + '" data-f="noAutoPause"' + (it.noAutoPause ? ' checked' : '') + '> Im Urlaub weiterlaufen (sonst pausiert sie automatisch)</label>';
  }
  if (it.type === 'habitlog') {
    const hs = byType('habit'), hb = hs.find(x => x.id === it.habitId);
    h += lab('Gewohnheit', sel('habitId', '<option value="">– bitte wählen –</option>' + hs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === it.habitId ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('')), true);
    h += lab('Tag', inp('date', 'date', it.date, ' max="' + todayISO() + '"'));
    if (hb && (hb.kind || 'check') !== 'check') h += lab(hb.kind === 'minutes' ? 'Minuten' : 'Anzahl', inp('amount', 'number', it.amount || hb.target || 1, ' min="1" max="1440"'));
  }
  return h;
}
// time/habit/habitlog aus der Vorschau speichern; gibt Zeilen, Vorher-Stände und neue Kennungen zurück
async function saveSpecial(list) {
  const snaps = {}, created = [], lines = [];
  const snapItem = id => { if (!(id in snaps)) { const x = S.items.find(i => i.id === id); snaps[id] = x ? JSON.parse(JSON.stringify(x)) : null; } };
  const ts = new Date().toISOString();
  for (const it of list) {
    if (it.type === 'time') {
      const { cat, sub } = splitCat(it.catv), d = it.date && it.date <= todayISO() ? it.date : todayISO(), min = timeNet(it, list);
      if (!cat || !min) continue;
      if (!(tlId(d) in snaps)) snaps[tlId(d)] = daySnap(d);
      const r = rangeMin(it.start, it.end), less = r ? r - (Number(it.pause) || 0) - min : 0;
      await addTimeEntry(d, { cat, sub, label: String(it.title || '').trim().slice(0, 120), min, start: r ? it.start : null, end: r ? it.end : null, pause: r ? Number(it.pause) || 0 : null, less: less > 0 ? less : null, src: it.src || 'satz', at: ts, calRef: it.calRef || null });
      lines.push('• ' + catName(cat, sub) + ': ' + fmtMin(min) + ' (' + relDay(d) + (r ? ', ' + it.start + '–' + it.end : '') + ')');
    }
    if (it.type === 'habit') {
      const h = normHabit({ ...it, id: uid(), createdAt: ts, log: {} }); delete h.key;
      Object.keys(h).forEach(k => { if (h[k] === null || h[k] === '') delete h[k]; });
      await withRetry(() => store.setItem(h)); created.push(h.id); lines.push('• Neue Gewohnheit: ' + h.title + ' (' + habitRule(h) + ')');
    }
    if (it.type === 'habitlog') {
      const h = S.items.find(x => x.id === it.habitId); if (!h) continue;
      snapItem(h.id);
      const d = it.date && it.date <= todayISO() ? it.date : todayISO();
      if ((h.kind || 'check') === 'check') await toggleHabit(h.id, true, d); else await habitAdd(h.id, Number(it.amount) || habitTarget(h), d);
      lines.push('• ' + h.title + ' erledigt (' + relDay(d) + ')');
    }
  }
  const restore = Object.values(snaps).filter(Boolean);
  return { lines, restore, created };
}

/* ===================== Fokus-Timer & Stoppuhr ===================== */
const focusElapsed = () => S.focus ? Math.max(0, (S.focus.pausedAt || Date.now()) - S.focus.startedAt - (S.focus.pausedMs || 0)) : 0;   // angehaltene Zeit zählt nicht
const focusLeft = () => S.focus && S.focus.dur ? Math.max(0, S.focus.dur * 60000 - focusElapsed()) : 0;
async function holdFocus(on) { const F = S.focus; if (!F || !!F.pausedAt === on) return; if (on) await setFocus({ ...F, pausedAt: Date.now() }); else { const f = { ...F, pausedMs: (F.pausedMs || 0) + Date.now() - F.pausedAt }; delete f.pausedAt; await setFocus(f); } }
const holdBtn = (cls) => S.focus && S.focus.mode !== 'pause' && !(S.focus.startedAt > Date.now()) ? '<button class="btn' + (cls || '') + '" data-act="' + (S.focus.pausedAt ? 'fresume">Weiter' : 'fhold">Pause') + '</button>' : '';
const mmss = ms => { const s0 = Math.round(ms / 1000), h = Math.floor(s0 / 3600), m = Math.floor(s0 % 3600 / 60), s = s0 % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
async function setFocus(f) { S.focus = f; if (db) await db.doc('meta/focus').set(f || { mode: null }); else { const o = local.read(); o.focus = f; local.write(o); } render(); }
function focusRefLabel(ref) {
  if (!ref) return '';
  const it = S.items.find(i => i.id === ref); return it ? it.title : '';
}
async function startFocus(opts) {
  const ref = opts.ref || null, it = ref && S.items.find(i => i.id === ref);
  const cat = opts.cat || catId(it && it.type === 'subject' ? 'uni' : it && it.area) || 'uni';
  await setFocus({ mode: opts.mode || 'focus', dur: opts.mode === 'track' ? 0 : Number(opts.dur || S.focusDur || 25), startedAt: Date.now(), ref, cat, sub: opts.sub || null, label: opts.label || (it ? it.title : catName(cat, opts.sub)), plan: opts.plan || null, round: opts.round || null, done: opts.done || 0 });
}
async function stopFocus(reason, next) {
  const f = S.focus; if (!f) return;
  const min = Math.round(Math.min(focusElapsed(), (f.dur || 600) * 60000) / 60000);
  if (reason !== 'switch' && f.mode !== 'pause') lastStopSet();
  await setFocus(next || null);
  if (f.mode === 'pause') { if (!next) showToast('Pause vorbei.'); return; }
  const got = await logTime(f.cat, f.label, min, f.mode, f.startedAt, f.sub, f.pausedAt || Date.now());
  if (min >= 1 && got && got.clipped && reason !== 'silent') { showToast(got.min ? 'Erfasst: ' + fmtMin(got.min) + ' (' + catName(f.cat, f.sub) + '). Der Rest war schon eingetragen.' : 'Nichts doppelt erfasst: diese Zeit war schon eingetragen.'); return; }
  if (min >= 1 && got && got.autoPause && reason !== 'silent') { showToast('Erfasst: ' + fmtMin(got.min) + ' ' + catName(f.cat, f.sub) + ' (' + got.autoPause + ' Min. Pause abgezogen).'); return; }
  const it = f.ref && S.items.find(i => i.id === f.ref);
  if (it && it.type === 'subject' && min >= 1) await addMinutes(it, min);
  if (min >= 1 && reason !== 'silent') { if (f.mode === 'focus' && reason === 'done') { S.focusDone = { ref: f.ref, label: f.label, min }; render(); } else showToast(fmtMin(min) + ' erfasst (' + catName(f.cat, f.sub) + ').'); }
}
function focusDoneSheet() {
  const F = S.focusDone, it = F.ref && S.items.find(i => i.id === F.ref);
  return '<div class="overlay" data-close="focusDone"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="fd-h"><h2 id="fd-h">Fokus geschafft</h2><p>' + (F.rounds ? F.rounds + ' Runden geschafft, zusammen ' : '') + fmtMin(F.min) + ' an „' + esc(F.label) + '“ gearbeitet.</p>' +
    (it && it.type === 'task' && !it.done ? '<p class="sub">Ist die Aufgabe erledigt?</p>' : '') +
    '<div class="row actions">' + (it && it.type === 'task' && !it.done ? '<button class="btn" data-act="fdtaskdone">Aufgabe erledigt</button>' : '') + '<button class="btn" data-act="fdpause">5 Min. Pause</button><button class="btn primary" data-act="fdagain">Noch eine Runde</button><button class="btn ghost" data-act="fdclose">Fertig</button></div></div></div>';
}
function beep() {
  try { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; const a = new A(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 1.2); o.start(); o.stop(a.currentTime + 1.2); } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
}
let focusEnding = false;
setInterval(() => {
  if (!S.focus) return;
  if (S.focus.pausedAt) return;
  if (S.focus.dur && focusLeft() <= 0 && !focusEnding) { focusEnding = true; const m = S.focus.mode; focusPhaseEnd().finally(() => { focusEnding = false; }); return; }
  document.querySelectorAll('[data-fclock]').forEach(el => { el.textContent = mmss(S.focus.dur ? focusLeft() : focusElapsed()); });
  const fg = document.querySelector('.ring .fg'); if (fg && S.focus.dur) { const C = 2 * Math.PI * 96; fg.style.strokeDashoffset = String(C * (focusLeft() / (S.focus.dur * 60000))); }
}, 1000);
/* ----- Fokus mit Phasen (V34): Arbeit/Pause im Wechsel, Vollbild, Ton „Zwei Töne“ ----- */
const FOCUS_PLANS = [{ id: 'p25', name: '25/5', w: 25, p: 5, r: 4, l: 15 }, { id: 'p50', name: '50/10', w: 50, p: 10, r: 3, l: 0 }, { id: 'p90', name: '90/15', w: 90, p: 15, r: 2, l: 0 }, { id: 'p15', name: '15/3', w: 15, p: 3, r: 3, l: 0 }];
const FOCUS_LEAD = 10000;   // Vorlauf vor der nächsten Runde
const ownPlan = () => { const o = S.settings.focusOwn || {}, n = (v, d, a, b) => Math.min(b, Math.max(a, Math.round(Number(v)) || d)); return { id: 'own', name: 'Eigener', w: n(o.w, 40, 1, 240), p: n(o.p, 8, 1, 60), r: n(o.r, 3, 1, 12), l: Math.min(60, Math.max(0, Math.round(Number(o.l)) || 0)) }; };
// Voreinstellungen: Runden lassen sich je Ablauf direkt wählen (settings.focusRounds)
const curPlan = () => { const id = S.settings.focusPlanId || 'p25'; if (id === 'own') return ownPlan(); const P = FOCUS_PLANS.find(p => p.id === id) || FOCUS_PLANS[0], r = Math.round(Number((S.settings.focusRounds || {})[P.id])); return r >= 1 && r <= 12 ? { ...P, r } : P; };
const usePlan = () => (S.settings.focusUse || 'plan') === 'plan';
function planText(P) {
  const tot = P.w * P.r + P.p * (P.r - 1) + P.l;
  return P.r + ' × ' + P.w + ' Min. Arbeit' + (P.r > 1 ? ', dazwischen ' + P.p + ' Min. Pause' : '') + (P.l ? ', am Ende ' + P.l + ' Min. lange Pause' : '') + '. Insgesamt ' + fmtMin(tot) + '. Die nächste Runde startet von allein.';
}
function planPick(oneHtml) {
  const on = usePlan(), P = curPlan(), o = ownPlan();
  const f = (k, l, v, mn, mx) => '<label class="field"><span>' + l + '</span><input type="number" inputmode="numeric" min="' + mn + '" max="' + mx + '" value="' + v + '" data-fown="' + k + '"></label>';
  return '<div class="fpick"><div class="seg" role="group" aria-label="Ablauf"><button data-fuse="plan" aria-pressed="' + on + '">Mit Pausen</button><button data-fuse="one" aria-pressed="' + !on + '">Einmal</button></div>' +
    (on ? '<div class="chips" role="group" aria-label="Phasen">' + FOCUS_PLANS.map(p => '<button data-fplan="' + p.id + '" aria-pressed="' + (P.id === p.id) + '">' + p.name + '</button>').join('') + '<button data-fplan="own" aria-pressed="' + (P.id === 'own') + '">Eigener</button></div>' +
      (P.id !== 'own' ? '<div class="fround"><span>Runden</span><div class="chips" role="group" aria-label="Anzahl Runden">' + [1, 2, 3, 4, 5, 6].map(n => '<button data-fround="' + n + '" aria-pressed="' + (P.r === n) + '">' + n + '</button>').join('') + '</div></div>' : '') +
      (P.id === 'own' ? '<div class="fown">' + f('w', 'Arbeit (Min.)', o.w, 1, 240) + f('p', 'Pause (Min.)', o.p, 1, 60) + f('r', 'Runden', o.r, 1, 12) + f('l', 'Lange Pause', o.l, 0, 60) + '</div>' : '') +
      '<p class="sub">' + esc(planText(P)) + '</p>' : oneHtml) + '</div>';
}
async function saveFocusSet(x) { S.settings = { ...S.settings, ...x }; render(); try { await store.setSettings(S.settings); } catch (e) {} }
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-fuse],[data-fplan],[data-fsopen],[data-fround]'); if (!b) return;
  if (b.dataset.fsopen) { fsHideKey = 0; fsPoke(); return; }   // Zeit oben antippen: Vollbild wieder zeigen
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (b.dataset.fround) { const id = curPlan().id; saveFocusSet({ focusRounds: { ...(S.settings.focusRounds || {}), [id]: Number(b.dataset.fround) } }); return; }
  if (b.dataset.fuse) saveFocusSet({ focusUse: b.dataset.fuse }); else saveFocusSet({ focusPlanId: b.dataset.fplan });
}, true);
document.addEventListener('change', ev => {
  const el = ev.target.closest && ev.target.closest('[data-fown]'); if (!el) return;
  const box = el.closest('.fown'), o = {}; box.querySelectorAll('[data-fown]').forEach(i => { o[i.dataset.fown] = Number(i.value); });
  saveFocusSet({ focusOwn: o, focusPlanId: 'own' });
});
// Fokus starten: läuft gerade „Was machst du gerade?“, übernimmt der Fokus diesen Bereich (die Stoppuhr wird bis jetzt gespeichert)
async function startFocusSession(o) {
  const F = S.focus;
  if (F && F.mode !== 'track') return;
  chimeUnlock();
  if (F) { Object.assign(o, { cat: F.cat, sub: F.sub || null }); if (!o.ref && !o.label) o.label = F.label; await stopFocus('switch'); }
  if (usePlan()) { const P = curPlan(); Object.assign(o, { plan: { w: P.w, p: P.p, r: P.r, l: P.l || 0 }, round: 1, dur: P.w }); }
  fsHideKey = 0; fsPoke();
  await startFocus(o);
}
// Ende einer Phase: Ton, Zeit speichern, dann von allein weiter (Pause → Vorlauf → nächste Runde)
async function focusPhaseEnd(quiet) {
  const f = S.focus; if (!f) return;
  if (!quiet) chime(f.mode === 'pause' ? 'up' : 'down');
  const P = f.plan;
  if (!P) { await stopFocus('done'); return; }
  const base = { cat: f.cat, sub: f.sub || null, ref: f.ref || null, label: f.label, plan: P };
  if (f.mode !== 'pause') {
    const min = Math.round(Math.min(focusElapsed(), f.dur * 60000) / 60000), done = (f.done || 0) + min, last = f.round >= P.r;
    if (last && !P.l) { await stopFocus('silent'); focusFinished(f, done); return; }
    await stopFocus('silent', { ...base, mode: 'pause', dur: last ? P.l : P.p, startedAt: Date.now(), round: f.round, long: last || null, done });
    return;
  }
  if (f.long) { await setFocus(null); focusFinished(f, f.done || 0); return; }
  await setFocus({ ...base, mode: 'focus', dur: P.w, startedAt: Date.now() + FOCUS_LEAD, round: f.round + 1, lead: true, done: f.done || 0 });
}
function focusFinished(f, min) { if (min >= 1) { S.focusDone = { ref: f.ref, label: f.label, min, rounds: f.plan.r }; render(); } }
async function focusSkip() {
  const f = S.focus; if (!f) return;
  if (f.startedAt > Date.now()) { await setFocus({ ...f, startedAt: Date.now() }); return; }   // Vorlauf überspringen
  if (f.pausedAt) await holdFocus(false);
  await focusPhaseEnd(true);
}
// Ton „Zwei Töne“: Ende Arbeit klingt nach unten, Ende Pause nach oben, Start der Runde ein kurzer Ton. Sanft lauter, kein Schreck.
let actx = null;
function chimeUnlock() { try { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; actx = actx || new A(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function chime(kind) {
  try {
    const c = chimeUnlock(); if (c) {
      const t = c.currentTime + .03;
      const note = (at, f, dur, g) => { const out = c.createGain(); out.gain.setValueAtTime(.0001, at); out.gain.exponentialRampToValueAtTime(g, at + .06); out.gain.exponentialRampToValueAtTime(.0001, at + dur); out.connect(c.destination);
        [[1, 1], [2, .15]].forEach(([m, a]) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * m; og.gain.value = a; o.connect(og); og.connect(out); o.start(at); o.stop(at + dur + .05); }); };
      if (kind === 'go') note(t, 659.25, .9, .16);
      else { const a = kind === 'up' ? [523.25, 659.25] : [659.25, 523.25]; note(t, a[0], 1.6, .24); note(t + .55, a[1], 2.2, .24); }
    }
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate(kind === 'go' ? 80 : [120, 80, 120]); } catch (e) {}
}
document.addEventListener('pointerdown', () => { if (S.focus && S.focus.mode !== 'track') chimeUnlock(); }, { passive: true });
// Vollbild-Anzeige
let fsHideKey = 0, fsShowUntil = 0, leadGo = 0;
const fsOn = () => { const F = S.focus; return !!F && F.mode !== 'track' && fsHideKey !== F.startedAt; };
function fsPoke() { fsShowUntil = Date.now() + 4000; const el = document.querySelector('.fsx'); if (el) el.classList.add('show'); }
const FS_C = 2 * Math.PI * 46;
const FS_TICKS = (() => { let s = ''; for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * Math.PI, r1 = i % 5 ? 49.5 : 48.5; s += '<line x1="' + (50 + r1 * Math.cos(a)).toFixed(2) + '" y1="' + (50 + r1 * Math.sin(a)).toFixed(2) + '" x2="' + (50 + 51 * Math.cos(a)).toFixed(2) + '" y2="' + (50 + 51 * Math.sin(a)).toFixed(2) + '" stroke-width="' + (i % 5 ? .4 : .8) + '"/>'; } return s; })();
const fsLeftFrac = () => { const F = S.focus; return F && F.dur ? focusLeft() / (F.dur * 60000) : 1; };
const fsEnd = () => { const F = S.focus; return F.pausedAt ? 'angehalten' : 'bis ' + hmOf(Date.now() + focusLeft()); };
function focusScreen() {
  const F = S.focus, P = F.plan, pause = F.mode === 'pause', lead = F.startedAt > Date.now();
  const phase = lead ? 'Gleich geht’s weiter' : pause ? (F.long ? 'Lange Pause' : 'Pause') : P ? 'Fokus · Runde ' + F.round + ' von ' + P.r : 'Fokus';
  const area = F.cat ? catName(F.cat, F.sub) : '';
  const what = pause ? (F.long ? 'Alle Runden geschafft. Gönn dir was.' : 'Steh kurz auf, trink was.') : (area && F.label !== area ? area + ' · ' : '') + (F.label || area);
  let dots = ''; if (P) for (let i = 1; i <= P.r; i++) { const on = i < F.round || (i === F.round && pause); dots += '<i class="' + (on ? 'on' : i === F.round ? 'now' : '') + '"></i>'; }
  const mid = lead ? '<b data-fslead>' + Math.ceil((F.startedAt - Date.now()) / 1000) + '</b><small>Runde ' + F.round + ' startet</small>'
    : '<b data-fclock>' + mmss(focusLeft()) + '</b><small data-fsend>' + fsEnd() + '</small>';
  const ctl = lead ? '<button class="btn primary" data-act="fskip">Jetzt starten</button><button class="btn" data-act="fstop">Beenden</button>'
    : (pause ? '' : holdBtn()) + (P ? '<button class="btn" data-act="fskip">' + (pause ? 'Pause überspringen' : 'Runde beenden') + '</button>' : '') + '<button class="btn" data-act="fstop">' + (P ? 'Alles beenden' : 'Beenden') + '</button>';
  return '<div class="fsx' + (pause ? ' pause' : '') + (lead ? ' lead' : '') + (Date.now() < fsShowUntil ? ' show' : '') + '" role="dialog" aria-label="Fokus">' +
    '<button class="fsxx" data-act="fshide" aria-label="Vollbild schließen, Zeit läuft weiter">✕</button>' +
    '<div class="fsph">' + esc(phase) + '</div>' +
    '<div class="fsring"><svg viewBox="-2 -2 104 104" aria-hidden="true"><g class="fsk">' + FS_TICKS + '</g><circle class="fst" cx="50" cy="50" r="46" fill="none" stroke-width="2.6"/>' +
      '<circle class="fsp" cx="50" cy="50" r="46" fill="none" stroke-width="2.6" stroke-linecap="' + (S.settings.design === 'jarvis' ? 'butt' : 'round') + '" stroke-dasharray="' + FS_C.toFixed(2) + '" stroke-dashoffset="' + (FS_C * (1 - fsLeftFrac())).toFixed(2) + '"/></svg>' +
      '<div class="fsmid">' + mid + '</div></div>' +
    '<p class="fswhat">' + esc(what) + '</p><div class="fsdots">' + dots + '</div>' +
    '<div class="fsctl">' + ctl + '</div><p class="fstip">Tippen für Knöpfe</p></div>';
}
document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('.fsx') && !ev.target.closest('button')) fsPoke(); });
document.addEventListener('mousemove', () => { if (fsOn() && Date.now() > fsShowUntil - 3000) fsPoke(); }, { passive: true });
setInterval(() => {
  const F = S.focus, el = document.querySelector('.fsx');
  if (F && F.lead && F.startedAt <= Date.now() && leadGo !== F.startedAt) { leadGo = F.startedAt; if (Date.now() - F.startedAt < 3000) chime('go'); if (el) render(); return; }
  if (!el || !F) return;
  el.classList.toggle('show', Date.now() < fsShowUntil);
  const ld = el.querySelector('[data-fslead]'); if (ld) ld.textContent = String(Math.max(1, Math.ceil((F.startedAt - Date.now()) / 1000)));
  const p = el.querySelector('.fsp'); if (p) p.style.strokeDashoffset = String(FS_C * (1 - fsLeftFrac()));
  const en = el.querySelector('[data-fsend]'); if (en) en.textContent = fsEnd();
}, 500);
function focusMini() {
  const F = S.focus;
  if (!F) return '<div class="minifocus"><span>Fokus</span><span class="row"><button class="btn" data-act="fquick">25 Min. starten</button><a class="btn ghost" href="#zeiten" data-go="zeiten">Mehr</a></span></div>';
  return '<div class="minifocus"><span>' + (F.mode === 'pause' ? 'Pause' : F.mode === 'track' ? 'Zeit läuft: ' : 'Fokus: ') + esc(F.mode === 'pause' ? '' : F.label) + '<br><b data-fclock>' + mmss(F.dur ? focusLeft() : focusElapsed()) + '</b></span><span class="row">' + holdBtn() + '<button class="btn" data-act="fstop">Stopp</button></span></div>';
}
function todayTimeLine() {
  const es = dayEntries(todayISO()); if (!es.length) return '';
  const by = {}; es.forEach(e => { by[e.cat] = (by[e.cat] || 0) + e.min; });
  const sum = es.reduce((s, e) => s + e.min, 0);
  return '<p class="sub" style="margin:0 0 10px"><a href="#zeiten" data-go="zeiten">Heute erfasst: ' + esc(fmtMin(sum)) + '</a> · ' + esc(Object.entries(by).map(([c, m]) => catOf(c).name + ' ' + fmtMin(m)).join(' · ')) + '</p>';
}

/* ===================== Zeiten-Seite ===================== */
function timeRange() {
  const base = S.tbase || todayISO();
  if (S.tview === 'month') { const d = dObj(base.slice(0, 8) + '01'), from = isoDate(d), to = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); return { from, to, label: MONL[d.getMonth()] + ' ' + d.getFullYear(), days: Number(to.slice(8)) }; }
  const from = mondayOf(base); return { from, to: addDays(from, 6), label: weekLabel(from), days: 7 };
}
const UNI_HINT = /vorlesung|übung|uebung|seminar|tutorium|kolloquium|werkstatt|einführung|praxissemester|modul|stochastik|mathematik|pädagogik|didaktik|classroom|unterricht|hörsaal|campus|\buni\b|\bvl\b|\bn\d\b/i;
const PRIV_HINT = /kochen|einkauf|haushalt|putzen|wäsche|arzt|friseur|sport|gym|fitness|laufen|joggen|freunde|familie|geburtstag|essen|privat/i;
// Woche: Stunden je Bereich. Erfasste Zeit zählt; ein Termin nur, wenn er nicht schon erfasst ist.
function weekCats(mon) {
  const cats = visCats(), row = {}; cats.forEach(c => { row[c.id] = 0; }); let other = 0, travel = 0;
  const priv = cats.find(c => c.id === 'privat') || null;
  weekDays(mon).forEach(d => {
    const es = dayEntries(d);
    es.forEach(e => { if (row[e.cat] != null) row[e.cat] += e.min / 60; else other += e.min / 60; });
    blocksOn(d).forEach(b => {
      if (!b.start || !b.end || b.kind === 'off' || b.kind === 'holiday') return;
      if (isTransit(b)) { if (!es.some(e => e.calRef === b.id)) travel += durH(b.start, b.end); return; }
      let c = blockCat(b); if (!c && priv && PRIV_HINT.test(b.title || '')) c = { cat: priv.id };
      if (es.some(e => e.calRef === b.id)) return;
      const bs = hmToMin(b.start), be = hmToMin(b.end);
      if (c && es.some(e => e.cat === c.cat && e.start && e.end && hmToMin(e.start) < be && hmToMin(e.end) > bs)) return;   // schon als Zeit erfasst
      const h = durH(b.start, b.end); if (c && row[c.cat] != null) row[c.cat] += h; else other += h;
    });
  });
  return { list: cats.map(c => ({ id: c.id, name: c.name, goal: catGoal(c), h: row[c.id] })), other, travel };
}
// Kalender-Block → Zeit-Bereich (Vorlesung = Uni, Arbeitsblock = Arbeit, Training/Spiel = Ehrenamt)
function blockCat(b) {
  if (!b || b.kind === 'off' || !b.start || !b.end) return null;
  let r = null;
  if (b.kind === 'class') r = { cat: 'uni', sub: null };
  else if (b.kind === 'work') r = { cat: 'arbeit', sub: null };
  else if (isTeamBlock(b)) r = { cat: 'ehrenamt', sub: /spiel|turnier|match|twingame/i.test(b.title || '') ? 'Spiel' : /training/i.test(b.title || '') ? 'Training' : null };
  else {
    r = guessCat(b.title || '');
    if (r && r.bySub && UNI_HINT.test((b.title || '') + ' ' + (b.place || ''))) r = null;   // „N2 Vorbereitung Praxissemester“ ist Uni, kein Ehrenamt › Vorbereitung
    r = r || ({ uni: { cat: 'uni' }, arbeit: { cat: 'arbeit' }, team: { cat: 'ehrenamt' } }[b.area] || null);
  }
  if (!r && UNI_HINT.test((b.title || '') + ' ' + (b.place || ''))) r = { cat: 'uni', sub: null };
  if (!r) return null;
  const c = visCats().find(x => x.id === r.cat); if (!c) return null;
  return { cat: c.id, sub: r.sub && (c.subs || []).includes(r.sub) ? r.sub : null };
}
function timeStats(from, to) {
  const t = todayISO(), now = hmToMin(nowHM()), st = {};
  const row = id => st[id] || (st[id] = { done: 0, plan: 0, subs: {} });
  timeCats().forEach(c => row(c.id));
  periodEntries(from, to).forEach(e => { const r = row(e.cat); r.done += e.min; if (e.sub) r.subs[e.sub] = (r.subs[e.sub] || 0) + e.min; });
  for (let d = from < t ? t : from; d <= to; d = addDays(d, 1)) {
    const es = dayEntries(d);
    blocksOn(d).forEach(b => {
      const c = blockCat(b); if (!c) return;
      if (d === t && hmToMin(b.end) <= now) return;   // vorbei: zählt nur, wenn erfasst
      if (es.some(e => e.calRef === b.id)) return;
      row(c.cat).plan += rangeMin(b.start, b.end);
    });
  }
  return st;
}
// Geplant gegen gemacht: was im Kalender stand (bis jetzt) gegen das, was erfasst ist
function planVsDone(from, to) {
  const t = todayISO(), end = to < t ? to : t, now = hmToMin(nowHM()), plan = {}, done = {}, missed = [];
  if (from > t) return null;
  for (let d = from; d <= end; d = addDays(d, 1)) {
    const es = dayEntries(d);
    blocksOn(d).forEach(b => {
      const c = blockCat(b); if (!c) return;
      if (d === t && hmToMin(b.end) > now) return;   // läuft noch oder kommt noch
      plan[c.cat] = (plan[c.cat] || 0) + rangeMin(b.start, b.end);
      const hit = es.some(e => e.calRef === b.id || (e.cat === c.cat && (!e.start || !e.end || (e.start < b.end && e.end > b.start))));
      if (!hit) missed.push({ b, c, d });
    });
  }
  periodEntries(from, end).forEach(e => { done[e.cat] = (done[e.cat] || 0) + e.min; });
  const ids = Array.from(new Set(Object.keys(plan).concat(Object.keys(done))));
  return { rows: ids.map(id => ({ id, plan: plan[id] || 0, done: done[id] || 0 })).filter(r => r.plan || r.done), missed: missed.reverse() };
}
function planDoneCard(R) {
  const P = planVsDone(R.from, R.to); if (!P || !P.rows.length) return '';
  const h = m => fmtH(m / 60);
  return '<section class="card" style="margin-top:12px"><h2 class="label">Geplant gegen gemacht · bis jetzt</h2>' +
    P.rows.map(r => { const d = r.done - r.plan; return '<div class="listrow"><span class="lt"><span class="tdot" style="display:inline-block;margin-right:6px;background:' + catColor(r.id) + '"></span>' + esc(catName(r.id)) + '<small>geplant ' + h(r.plan) + ' Std. · gemacht ' + h(r.done) + ' Std.</small></span><span class="mono" style="color:' + (!r.plan ? 'var(--mu)' : d < -30 ? 'var(--o)' : 'var(--tx)') + '">' + (!r.plan ? 'spontan' : (d >= 0 ? '+' : '−') + h(Math.abs(d)) + ' Std.') + '</span></div>'; }).join('') +
    (P.missed.length ? '<h3 class="label" style="margin-top:14px">Im Kalender, aber nicht erfasst</h3>' + P.missed.slice(0, 6).map(x => '<div class="listrow"><span class="lt">' + esc(x.b.title || catName(x.c.cat)) + '<small>' + esc(fmtShort(x.d)) + ' · ' + esc(x.b.start + '–' + x.b.end) + ' · ' + esc(catName(x.c.cat, x.c.sub)) + '</small></span><button class="btn ghost" data-pdlog="' + esc(x.b.id) + '|' + esc(x.d) + '">So gemacht</button></div>').join('') +
      (P.missed.length > 6 ? '<p class="sub">… und ' + (P.missed.length - 6) + ' weitere.</p>' : '') : '') + '</section>';
}
function pageTimes() {
  const R = timeRange(), st = timeStats(R.from, R.to), L = loadLimits(), F = S.focus;
  const hrs = m => fmtH(m / 60) + ' Std.';
  const cats = timeCats().filter(c => !c.hidden || (st[c.id] && st[c.id].done));
  const extra = Object.keys(st).filter(k => !timeCats().some(c => c.id === k) && st[k].done);
  const shown = cats.concat(extra.map(k => catOf(k))), goalOf = c => { const g = catGoal(c); return g ? Math.round(g * 60 * R.days / 7) : 0; };
  const scale = Math.max(60, ...shown.map(c => { const s = st[c.id] || { done: 0, plan: 0 }; return Math.max(goalOf(c), s.done + s.plan); })) * 1.05;   // gleicher Maßstab für alle Balken
  const rows = shown.map(c => {
    const s = st[c.id] || { done: 0, plan: 0, subs: {} }, goal = goalOf(c);
    const over = goal && s.done > goal ? (s.done - goal > L.overR * 60 * R.days / 7 ? 'r' : 'y') : '';
    const subs = Object.entries(s.subs).sort((a, b) => b[1] - a[1]);
    return '<div class="trow"><div class="trh"><span class="tdot" style="background:' + catColor(c.id) + '"></span><b>' + esc(c.name) + '</b>' +
      '<span class="tnums"><span>geschafft <b>' + hrs(s.done) + '</b></span><span>geplant ' + hrs(s.plan) + '</span>' + (goal ? '<span>' + (s.done >= goal ? 'Ziel erreicht' : 'offen ' + hrs(goal - s.done)) + ' · Ziel ' + hrs(goal) + '</span>' : '') +
      (over ? '<span class="amp ' + over + '"><i></i>' + (over === 'r' ? 'zu viel' : 'über Ziel') + ' +' + fmtH((s.done - goal) / 60) + '</span>' : '') + '</span></div>' +
      '<div class="tbar" style="color:' + catColor(c.id) + '" role="img" aria-label="' + esc(c.name + ': ' + hrs(s.done) + ' geschafft, ' + hrs(s.plan) + ' geplant' + (goal ? ', Ziel ' + hrs(goal) : '')) + '">' +
        (s.plan ? '<i class="pl" style="left:' + (s.done / scale * 100) + '%;width:' + (s.plan / scale * 100) + '%"></i>' : '') + '<i style="width:' + (s.done / scale * 100) + '%;background:currentColor"></i>' + (goal ? '<i class="gl" style="left:' + (goal / scale * 100) + '%"></i>' : '') + '</div>' +
      (subs.length ? '<div class="tsubs">davon ' + subs.map(([n, m]) => esc(n) + ' ' + hrs(m)).join(' · ') + '</div>' : '') + '</div>';
  }).join('');
  const total = Object.values(st).reduce((a, s) => a + s.done, 0);
  const list = periodEntries(R.from, R.to).reverse();
  let last = '';
  const entries = list.map(e => {
    const head = e.date !== last ? '<div class="logday">' + esc(fmtShort(e.date)) + ' · ' + esc(fmtMin(list.filter(x => x.date === e.date).reduce((s, x) => s + x.min, 0))) + '</div>' : ''; last = e.date;
    const meta = [e.start && e.end ? e.start + '–' + e.end : e.start ? 'ab ' + e.start : '', e.pause ? e.pause + ' Min. Pause' : '', e.less ? fmtMin(e.less) + ' davon abgezogen' : '', e.label, { satz: 'per Satz', manuell: '', kalender: 'aus dem Kalender', focus: 'Fokus', track: 'Stoppuhr', lernzeit: 'Lernzeit' }[e.src] || ''].filter(Boolean).join(' · ');
    return head + '<div class="listrow"><button class="lt" data-tedit="' + esc(e.id) + '" data-date="' + esc(e.date) + '"><span class="tdot" style="display:inline-block;margin-right:6px;background:' + catColor(e.cat) + '"></span>' + esc(catName(e.cat, e.sub)) + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</button><span class="mono">' + esc(fmtMin(e.min)) + '</span></div>';
  }).join('');
  const C = 2 * Math.PI * 96, frac = F && F.dur ? focusLeft() / (F.dur * 60000) : 1;
  const tasks = openTasks().slice(0, 40), subsU = byType('subject');
  const ring = '<div class="ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="bg" cx="110" cy="110" r="96" fill="none" stroke-width="10"/><circle class="fg" cx="110" cy="110" r="96" fill="none" stroke-width="10" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * frac) + '"/></svg><div class="mid"><span class="num" data-fclock>' + (F && F.mode !== 'track' ? mmss(F.dur ? focusLeft() : focusElapsed()) : S.focusDur + ':00') + '</span><span class="lbl">' + esc(F && F.mode !== 'track' ? (F.pausedAt ? 'angehalten' : F.mode === 'pause' ? 'Pause' : F.label) : 'bereit') + '</span></div></div>';
  const isNow = R.from <= todayISO() && R.to >= todayISO();
  const tcv = S.trackCat || (visCats()[0] || {}).id || '';
  return '<div class="pagehead"><div><h1 class="page">Zeiten</h1></div><div class="row">' +
      '<div class="seg" role="group" aria-label="Zeitraum">' + [['week', 'Woche'], ['month', 'Monat']].map(([v, l]) => '<button data-tview="' + v + '" aria-pressed="' + ((S.tview || 'week') === v) + '">' + l + '</button>').join('') + '</div>' +
      '<div class="weeknav"><button class="iconbtn" data-tnav="-1" aria-label="Zurück">' + ICON.chevl + '</button><span class="wk">' + esc(R.label) + '</span><button class="iconbtn" data-tnav="1" aria-label="Weiter">' + ICON.chev + '</button>' + (isNow ? '' : '<button class="btn ghost" data-tnav="0">Heute</button>') + '</div></div></div>' +
    '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:4px"><h2 class="label" style="margin:0">Übersicht · ' + esc(R.label) + '</h2><span class="row"><button class="btn" data-act="texcsv">Liste herunterladen</button><button class="btn" data-act="texprint">Zum Drucken</button></span></div>' +
      rows + '<p class="sub" style="margin-top:10px">Gesamt erfasst: <b>' + hrs(total) + '</b> · Gefüllt = geschafft, Rahmen = noch im Kalender geplant, Strich = Ziel.</p></section>' + planDoneCard(R) +
    '<div class="grid2" style="margin-top:12px"><section class="card"><h2 class="label">Nachtragen</h2>' +
      '<form data-form="timeadd" style="display:flex;flex-direction:column;gap:10px"><div class="formgrid">' +
        '<label class="field"><span>Datum</span><input name="date" type="date" data-keep="ta-date" value="' + todayISO() + '" max="' + todayISO() + '"></label>' +
        '<label class="field"><span>Bereich</span><select name="catv" data-keep="ta-cat">' + catOptions(S.taCat || '', '– bitte wählen –') + '</select></label>' +
        '<label class="field"><span>Von</span><input name="start" type="time" data-keep="ta-start"></label><label class="field"><span>Bis</span><input name="end" type="time" data-keep="ta-end"></label>' +
        '<label class="field"><span>Pause (Min.)</span><input name="pause" type="number" min="0" max="600" step="5" placeholder="automatisch" data-keep="ta-pause"></label>' +
        '<label class="field"><span>oder Dauer (Std.)</span><input name="hrs" type="number" min="0" max="24" step="0.25" inputmode="decimal" data-keep="ta-hrs"></label></div>' +
        '<label class="field"><span>Notiz (optional)</span><input name="label" maxlength="120" autocomplete="off" data-keep="ta-label"></label>' +
        '<div class="row"><button class="btn primary" type="submit">Eintragen</button></div></form>' +
      '<p class="sub" style="margin-top:10px">Schneller: Notier einfach „gestern 17 bis 19 Uhr Training“ oder „7 bis 16 Uhr gearbeitet, davon 2 Std. Auto“.</p>' +
      '<h3 class="label" style="margin-top:16px">Stoppuhr</h3>' + (F && F.mode === 'track' ? '<div class="row"><span style="flex:1">Läuft: <b>' + esc(F.label) + '</b> (' + esc(catName(F.cat, F.sub)) + ') · <b data-fclock>' + mmss(focusElapsed()) + '</b>' + (F.pausedAt ? ' (angehalten)' : '') + '</span>' + holdBtn() + '<button class="btn" data-act="fstop">Stoppen &amp; speichern</button></div>' :
        '<form data-form="track" style="display:flex;flex-direction:column;gap:10px"><div class="formgrid"><label class="field"><span>Bereich</span><select data-tcatsel="1">' + catOptions(tcv) + '</select></label><label class="field"><span>Was machst du? (optional)</span><input name="label" autocomplete="off" data-keep="tr-label"></label></div><div class="row"><button class="btn" type="submit"' + (F ? ' disabled' : '') + '>Start</button></div></form>') + '</section>' +
    '<section class="card"><h2 class="label">Fokus-Timer</h2><div class="focusbig">' + ring +
      (F && F.mode !== 'track' ? '<div class="row"><button class="btn primary" data-act="fstop">Beenden</button>' + holdBtn() + '<button class="btn ghost" data-act="fcancel">Abbrechen (nicht zählen)</button></div>'
        : planPick('<div class="chips" role="group" aria-label="Dauer">' + [15, 25, 50, 90].map(m => '<button data-fdur="' + m + '" aria-pressed="' + (S.focusDur === m) + '">' + m + ' Min.</button>').join('') + '</div>') +
          '<label class="field" style="width:100%"><span>Woran arbeitest du?</span><select data-fref="1"><option value="">Freies Thema</option><optgroup label="Fächer">' + subsU.map(x => '<option value="' + esc(x.id) + '"' + (S.focusRef === x.id ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</optgroup><optgroup label="Aufgaben">' + tasks.map(x => '<option value="' + esc(x.id) + '"' + (S.focusRef === x.id ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</optgroup></select></label>' +
          '<div class="row"><button class="btn primary" data-act="fstart"' + (F && F.mode !== 'track' ? ' disabled' : '') + '>' + (F && F.mode === 'track' ? 'In den Fokus' : 'Fokus starten') + '</button></div>') + '</div></section></div>' +
    '<section class="card" style="margin-top:12px"><h2 class="label">Einträge · ' + esc(R.label) + '</h2>' + (entries || '<p class="empty">In diesem Zeitraum ist noch nichts erfasst.</p>') + '</section>';
}
// Formular „Nachtragen“ / „Eintrag bearbeiten“ lesen
function readTimeForm(fd, keepLess) {
  const date = String(fd.get('date') || ''), { cat, sub } = splitCat(fd.get('catv'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { err: 'Bitte ein Datum angeben.' };
  if (date > todayISO()) return { err: 'Zeit kann man nur für heute oder früher erfassen.' };
  if (!cat) return { err: 'Bitte einen Bereich wählen.' };
  const start = String(fd.get('start') || '') || null, end = String(fd.get('end') || '') || null, r = rangeMin(start, end);
  if ((start || end) && !r) return { err: 'Bitte Von und Bis angeben (Bis nach Von).' };
  const label = String(fd.get('label') || '').trim().slice(0, 120);
  if (r) {
    const pv = String(fd.get('pause') ?? '').trim(), pause = pv === '' ? (catOf(cat).pause ? autoPauseMin(r) : 0) : Math.max(0, Math.round(Number(pv.replace(',', '.')) || 0));
    const less = keepLess ? Math.max(0, Math.round(Number(fd.get('less')) || 0)) : 0, min = r - pause - less;
    if (min <= 0) return { err: 'Nach Abzug der Pause bleibt keine Zeit übrig.' };
    return { date, e: { cat, sub, label, min, start, end, pause, less: less || null } };
  }
  const h = Number(String(fd.get('hrs') || '').replace(',', '.'));
  if (!(h > 0)) return { err: 'Bitte Von/Bis oder eine Dauer angeben.' };
  return { date, e: { cat, sub, label, min: Math.min(1440, Math.round(h * 60)), start: null, end: null, pause: null, less: null } };
}
function timeEditSheet() {
  const e = S.timeEdit, r = rangeMin(e.start, e.end);
  return '<div class="overlay" data-close="timeEdit"><form class="sheet" role="dialog" aria-modal="true" aria-labelledby="te-h" data-form="timeedit">' +
    '<h2 id="te-h">Zeit bearbeiten</h2><div class="formgrid">' +
      '<label class="field"><span>Datum</span><input name="date" type="date" data-keep="te-date" value="' + esc(e.date) + '" max="' + todayISO() + '"></label>' +
      '<label class="field"><span>Bereich</span><select name="catv" data-keep="te-cat">' + catOptions(e.cat + (e.sub ? '|' + e.sub : ''), '– bitte wählen –') + '</select></label>' +
      '<label class="field"><span>Von</span><input name="start" type="time" data-keep="te-start" value="' + esc(e.start || '') + '"></label><label class="field"><span>Bis</span><input name="end" type="time" data-keep="te-end" value="' + esc(e.end || '') + '"></label>' +
      '<label class="field"><span>Pause (Min.)</span><input name="pause" type="number" min="0" max="600" step="5" placeholder="automatisch" data-keep="te-pause" value="' + esc(r ? (e.pause ?? 0) : '') + '"></label>' +
      (e.less ? '<label class="field"><span>Davon abgezogen (Min.)</span><input name="less" type="number" min="0" max="1440" data-keep="te-less" value="' + esc(e.less) + '"></label>' : '') +
      '<label class="field"><span>oder Dauer (Std.)</span><input name="hrs" type="number" min="0" max="24" step="0.25" inputmode="decimal" data-keep="te-hrs" value="' + esc(r ? '' : Math.round(e.min / 60 * 100) / 100) + '"></label></div>' +
    '<label class="field"><span>Notiz (optional)</span><input name="label" maxlength="120" data-keep="te-label" value="' + esc(e.label || '') + '"></label>' +
    '<p class="sub">Zählt jetzt: ' + esc(fmtMin(e.min)) + '. Mit Von und Bis rechnet Jarvis die Dauer selbst aus.</p>' +
    '<div class="row actions" style="justify-content:space-between"><button type="button" class="btn ghost danger" data-act="tdel">Löschen</button><span class="row"><button type="button" class="btn ghost" data-act="tcancel">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></span></div>' +
  '</form></div>';
}
// Erfasste Kalender-Blöcke von heute, die noch nicht als Zeit eingetragen sind (Angebot ab 17 Uhr)
const tskipRead = () => { try { return JSON.parse(localStorage.getItem('jarvis.tskip') || '[]'); } catch (e) { return []; } };
function timeAskList() {
  if (new Date().getHours() < 17) return [];
  const t = todayISO(), now = hmToMin(nowHM()), skip = tskipRead(), es = dayEntries(t);
  return blocksOn(t).filter(b => b.start && b.end && hmToMin(b.end) <= now).map(b => ({ b, c: blockCat(b) }))
    .filter(x => x.c && !skip.includes(t + ':' + x.b.id) && !es.some(e => e.calRef === x.b.id || (e.start && e.end && hmToMin(e.start) < hmToMin(x.b.end) && hmToMin(e.end) > hmToMin(x.b.start))));
}
async function timeFromBlock(id, day, quiet) {
  const t = day || todayISO(), x = day ? (() => { const b = blocksOn(day).find(b => b.id === id), c = blockCat(b); return b && c ? { b, c } : null; })() : timeAskList().find(x => x.b.id === id); if (!x) return;
  const r = rangeMin(x.b.start, x.b.end), pause = catOf(x.c.cat).pause ? autoPauseMin(r) : 0, snap = daySnap(t);
  await addTimeEntry(t, { cat: x.c.cat, sub: x.c.sub, label: String(x.b.title || '').slice(0, 120), min: r - pause, start: x.b.start, end: x.b.end, pause: pause || null, src: 'kalender', calRef: x.b.id, calSpan: x.b.start + '-' + x.b.end, at: new Date().toISOString() });
  const txt = catName(x.c.cat, x.c.sub) + ' ' + fmtMin(r - pause) + ' (' + x.b.start + '–' + x.b.end + ')';
  if (quiet) return;
  logAct('Zeit erfasst: ' + txt, { restore: [snap] });
  showToast('Erfasst: ' + txt + '.', () => restoreDays([snap]));
}
/* ----- Kalender als Datei (iCalendar), z. B. für Apple Kalender oder Outlook ----- */
function icsEsc(t) { return String(t || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\r?\n/g, '\\n'); }
function icsFold(l) {   // Zeilen höchstens 75 Byte (Umlaute zählen doppelt)
  const enc = new TextEncoder(), out = []; let cur = '';
  for (const ch of l) { if (enc.encode(cur + ch).length > 74) { out.push(cur); cur = ' '; } cur += ch; }
  out.push(cur); return out.join('\r\n');
}
function buildIcs() {
  const dt = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : ''), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', from = addDays(todayISO(), -60), L = [];
  const ev = (id, title, d, s, e, extra) => {
    L.push('BEGIN:VEVENT', 'UID:' + id + '@jarvis', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEsc(title));
    if (s) { L.push('DTSTART;TZID=Europe/Berlin:' + dt(d, s), 'DTEND;TZID=Europe/Berlin:' + dt(extra && extra.dEnd || d, e || addMin(s, 60))); }
    else L.push('DTSTART;VALUE=DATE:' + dt(d), 'DTEND;VALUE=DATE:' + dt(addDays(extra && extra.dEnd || d, 1)));
    if (extra && extra.place) L.push('LOCATION:' + icsEsc(extra.place));
    if (extra && extra.rrule) L.push(extra.rrule);
    (extra && extra.ex || []).forEach(x => L.push(x));
    L.push('END:VEVENT');
  };
  byType('event').filter(e => (e.dateEnd || e.date) >= from).forEach(e => { const m = e.dateEnd && e.dateEnd > e.date; ev(e.id, e.title, e.date, e.start, m ? (e.end || (e.start ? '23:59' : null)) : e.end, { place: e.place, dEnd: m ? e.dateEnd : null }); });
  byType('work').filter(w => w.date >= from && w.start).forEach(w => ev(w.id, 'Arbeit · ' + (w.place || 'Homeoffice'), w.date, w.start, w.end));
  byType('off').filter(o => (o.dateEnd || o.date) >= from).forEach(o => ev(o.id, o.kind === 'urlaub' ? 'Urlaub' : (o.title || 'Frei'), o.date, null, null, { dEnd: o.dateEnd }));
  byType('class').filter(c => c.start && c.end && (!c.until || c.until >= from)).forEach(c => {
    let first = c.from || todayISO(), g = 0; while ((dow(first) !== Number(c.weekday) || !classWeekOk(c, first)) && g++ < 16) first = addDays(first, 1);
    ev(c.id, c.title, first, c.start, c.end, { place: c.room, rrule: 'RRULE:FREQ=WEEKLY' + (Number(c.every || 1) >= 2 ? ';INTERVAL=2' : '') + (c.until ? ';UNTIL=' + c.until.replace(/-/g, '') + 'T235959Z' : ''), ex: (c.skip || []).map(d => 'EXDATE;TZID=Europe/Berlin:' + dt(d, c.start)) });
  });
  byType('subject').filter(x => x.examDate && x.examDate >= from && !x.examEventId).forEach(x => ev(x.id + '-klausur', examWord(x) + ' ' + examName(x), x.examDate, x.examTime || null, x.examTime ? addMin(x.examTime, 120) : null, { place: x.examPlace }));
  const head = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jarvis//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Jarvis',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
  return head.concat(L, ['END:VCALENDAR']).map(icsFold).join('\r\n') + '\r\n';
}
function exportIcs() {
  const txt = buildIcs(), n = (txt.match(/BEGIN:VEVENT/g) || []).length;
  if (!n) { showToast('Noch keine Termine zum Exportieren.'); return; }
  saveFile('jarvis-kalender-' + todayISO() + '.ics', txt, 'text/calendar');
}
/* ----- Geführte Einrichtung (beim allerersten Start oder über die Einstellungen) ----- */
function onbSheet() {
  const st = S.onb.step, s = S.settings, N = 4;
  const steps = [
    ['Wie soll Jarvis dich nennen?', '<label class="field"><span>Anrede</span><input name="name" maxlength="40" value="' + esc(s.name || '') + '" placeholder="z. B. Phil" autocomplete="off"></label>'],
    ['Für welchen Ort soll das Wetter kommen?', '<label class="field"><span>Ort</span><input name="ort" maxlength="60" placeholder="' + esc(s.wxName || 'z. B. Haltern am See') + '" autocomplete="off"></label><p class="sub">Leer lassen, wenn ' + esc(s.wxName || 'der Ort') + ' passt.</p>'],
    ['Wann arbeitest du?', '<fieldset style="border:0;padding:0;margin:0"><legend class="sub" style="margin-bottom:6px">Arbeitstage</legend><div class="row">' + [1, 2, 3, 4, 5, 6].map(n => '<label class="toggle" style="min-height:40px;margin-right:6px"><input type="checkbox" name="wd" value="' + n + '"' + (workDays().includes(n) ? ' checked' : '') + '> ' + WDS[n % 7] + '</label>').join('') + '</div></fieldset>' +
      '<label class="field"><span>Stunden pro Woche</span><input name="workHours" type="number" min="0" max="60" step="0.5" value="' + esc(s.workHours ?? 20) + '"></label>'],
    ['Was soll Jarvis von selbst tun?', '<label class="toggle"><input type="checkbox" name="autoBrief"' + (s.autoBrief !== false ? ' checked' : '') + '> Morgens einen kurzen Tagesbericht schreiben</label>' +
      '<label class="toggle"><input type="checkbox" name="calSync"' + (s.calSync !== false ? ' checked' : '') + '> Termine automatisch in Google Kalender eintragen</label>' +
      '<p class="sub">Danach kannst du alles einfach hinschreiben, z. B. „Morgen 10 Uhr Zahnarzt“ oder „Milch kaufen“. Alles lässt sich später in den Einstellungen ändern.</p>']
  ];
  const [q, body] = steps[st];
  return '<div class="overlay" data-close="onb"><form class="sheet" role="dialog" aria-modal="true" aria-labelledby="onb-h" data-form="onb"><p class="sub">Einrichtung · Schritt ' + (st + 1) + ' von ' + N + '</p><h2 id="onb-h">' + q + '</h2>' + body +
    '<div class="row actions" style="justify-content:space-between">' + (st ? '<button type="button" class="btn ghost" data-act="onbback">Zurück</button>' : '<button type="button" class="btn ghost" data-act="onbdone">Später</button>') +
    '<button class="btn primary" type="submit">' + (st === N - 1 ? 'Fertig' : 'Weiter') + '</button></div></form></div>';
}
async function onbSubmit(f) {
  const fd = new FormData(f), st = S.onb.step; let s = { ...S.settings };
  if (st === 0) s.name = String(fd.get('name') || '').trim().slice(0, 40);
  if (st === 1) { const o = String(fd.get('ort') || '').trim(); if (o) await searchWeatherPlace(o); s = { ...S.settings }; }
  if (st === 2) { const wd = fd.getAll('wd').map(Number).filter(n => n >= 1 && n <= 7); const h = Number(String(fd.get('workHours') || '').replace(',', '.')); s.workDays = wd.length ? wd : [3, 4, 5]; s.workHours = isNaN(h) ? 20 : Math.max(0, Math.min(60, Math.round(h * 2) / 2)); }
  if (st === 3) { s.autoBrief = !!fd.get('autoBrief'); s.calSync = !!fd.get('calSync'); s.onboarded = true; }
  S.settings = s; await store.setSettings(s);
  if (st === 3) { S.onb = null; render(); showToast('Fertig eingerichtet. Notier einfach, was ansteht.'); return; }
  S.onb = { step: st + 1 }; render(); setTimeout(() => { const x = $('.sheet input'); x && x.focus(); }, 0);
}
async function saveFile(name, data, type) {
  const blob = new Blob([data], { type });
  if (downloads) { try { await downloads.save({ filename: name, data: blob }); showToast('Gespeichert: ' + name); } catch (e) { if (e && e.code !== 'declined') showToast('Herunterladen ist hier nicht möglich.'); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
const decH = m => (Math.round(m / 60 * 100) / 100).toFixed(2).replace('.', ',');
const fmtDE = iso => iso.slice(8) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);
function timeTotals(list) {
  const by = {}; list.forEach(e => { const k = e.cat; by[k] = by[k] || { min: 0, subs: {} }; by[k].min += e.min; if (e.sub) by[k].subs[e.sub] = (by[k].subs[e.sub] || 0) + e.min; });
  return by;
}
function exportTimes(kind) {
  const R = timeRange(), list = periodEntries(R.from, R.to), by = timeTotals(list), fname = 'Zeiten ' + R.label.replace(/[\\/:*?"<>|]+/g, ' ');
  if (!list.length) { showToast('In diesem Zeitraum ist nichts erfasst.'); return; }
  if (kind === 'csv') {
    const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['Datum', 'Tag', 'Bereich', 'Unterbereich', 'Von', 'Bis', 'Pause (Min.)', 'Stunden', 'Notiz']];
    list.forEach(e => rows.push([fmtDE(e.date), WDS[dObj(e.date).getDay()], catOf(e.cat).name, e.sub || '', e.start || '', e.end || '', e.pause || '', decH(e.min), e.label || '']));
    rows.push([]); rows.push(['Summen ' + R.label]);
    Object.entries(by).forEach(([c, v]) => { rows.push(['', '', catOf(c).name, '', '', '', '', decH(v.min), '']); Object.entries(v.subs).forEach(([s, m]) => rows.push(['', '', catOf(c).name, s, '', '', '', decH(m), ''])); });
    rows.push(['', '', 'Gesamt', '', '', '', '', decH(list.reduce((s, e) => s + e.min, 0)), '']);
    saveFile(fname + '.csv', '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
    return;
  }
  const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(fname) + '</title><style>' +
    'body{font:12px/1.4 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#000;background:#fff;margin:24px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#444}table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border-bottom:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top}th{font-size:11px;color:#444}td.n,th.n{text-align:right;white-space:nowrap}tfoot td{font-weight:700;border-top:2px solid #000}button{font:inherit;padding:8px 14px;margin-bottom:14px}@media print{button{display:none}body{margin:0}}' +
    '</style></head><body><button onclick="print()">Drucken</button><h1>Zeiten · ' + esc(R.label) + '</h1><p>Erstellt am ' + esc(fmtDE(todayISO())) + ' mit Jarvis</p>' +
    '<table><thead><tr><th>Datum</th><th>Bereich</th><th>Von–Bis</th><th class="n">Pause</th><th class="n">Stunden</th><th>Notiz</th></tr></thead><tbody>' +
    list.map(e => '<tr><td>' + esc(WDS[dObj(e.date).getDay()] + ' ' + fmtDE(e.date)) + '</td><td>' + esc(catName(e.cat, e.sub)) + '</td><td>' + esc(e.start && e.end ? e.start + '–' + e.end : '') + '</td><td class="n">' + esc(e.pause ? e.pause + ' Min.' : '') + '</td><td class="n">' + decH(e.min) + '</td><td>' + esc(e.label || '') + '</td></tr>').join('') +
    '</tbody></table><table><thead><tr><th>Summe je Bereich</th><th class="n">Stunden</th></tr></thead><tbody>' +
    Object.entries(by).map(([c, v]) => '<tr><td>' + esc(catOf(c).name) + '</td><td class="n">' + decH(v.min) + '</td></tr>' + Object.entries(v.subs).map(([s, m]) => '<tr><td style="padding-left:20px">davon ' + esc(s) + '</td><td class="n">' + decH(m) + '</td></tr>').join('')).join('') +
    '</tbody><tfoot><tr><td>Gesamt</td><td class="n">' + decH(list.reduce((s, e) => s + e.min, 0)) + '</td></tr></tfoot></table></body></html>';
  saveFile(fname + ' (Drucken).html', html, 'text/html;charset=utf-8');
}
// Einstellungen: eigene Zeit-Bereiche
function catSettingsCard() {
  const cats = S.catDraft || timeCats().map(c => ({ ...c }));
  return '<section class="card"><h2 class="label">Zeit-Bereiche</h2><form data-form="cats">' + cats.map((c, i) =>
    '<fieldset class="catrow"><legend class="sr">Bereich ' + (i + 1) + '</legend><input type="hidden" name="id" value="' + esc(c.id) + '">' +
      '<div class="formgrid"><label class="field"><span>Name</span><input name="name" value="' + esc(c.name) + '" maxlength="30" autocomplete="off"></label>' +
      '<label class="field"><span>Farbe</span><select name="color">' + CAT_COLORS.map(([v, l]) => '<option value="' + v + '"' + (c.color === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Ziel pro Woche (Std.)</span><input name="goal" type="number" min="0" max="80" step="0.5" value="' + esc(c.goal ?? '') + '" placeholder="' + (c.id === 'arbeit' ? 'wie Arbeitsstunden' : 'kein Ziel') + '"></label></div>' +
      '<label class="field"><span>Unterbereiche (mit Komma getrennt)</span><input name="subs" value="' + esc((c.subs || []).join(', ')) + '" autocomplete="off"></label>' +
      '<label class="field"><span>Stichworte, an denen Jarvis den Bereich erkennt</span><input name="words" value="' + esc((c.words || []).join(', ')) + '" autocomplete="off"></label>' +
      '<div class="row"><label class="toggle"><input type="checkbox" name="pause" value="' + i + '"' + (c.pause ? ' checked' : '') + '> Pause automatisch abziehen</label><label class="toggle"><input type="checkbox" name="hidden" value="' + i + '"' + (c.hidden ? ' checked' : '') + '> Ausblenden</label><span style="flex:1"></span>' +
      '<button type="button" class="iconbtn" data-catup="' + i + '" aria-label="' + esc(c.name || 'Bereich') + ' nach oben"' + (i === 0 ? ' disabled' : '') + '>↑</button></div></fieldset>').join('') +
    '<div class="row" style="justify-content:space-between"><button type="button" class="btn" data-act="catadd">+ Bereich</button><span class="row">' + (S.catDraft ? '<button type="button" class="btn ghost" data-act="catreset">Verwerfen</button>' : '') + '<button class="btn primary" type="submit">Speichern</button></span></div>' +
    '<p class="sub" style="margin-top:8px">Gelöscht wird hier nichts: Bereiche, die du nicht mehr brauchst, blendest du aus. Alte Einträge bleiben erhalten. Pause automatisch: mehr als 6 Std. = 30 Min., mehr als 9 Std. = 45 Min., außer du nennst deine Pause selbst.</p></form></section>';
}
function readCatForm(f) {
  const fd = new FormData(f), ids = fd.getAll('id'), names = fd.getAll('name'), colors = fd.getAll('color'), goals = fd.getAll('goal'), subs = fd.getAll('subs'), words = fd.getAll('words');
  const pause = fd.getAll('pause').map(Number), hidden = fd.getAll('hidden').map(Number);
  const list = s => Array.from(new Set(String(s || '').split(',').map(x => x.trim()).filter(Boolean))).slice(0, 12);
  return ids.map((id, i) => ({ id: id || 'c' + uid().slice(-6), name: String(names[i] || '').trim().slice(0, 30), color: CAT_COLORS.some(([v]) => v === colors[i]) ? colors[i] : 'ac',
    goal: String(goals[i] || '').trim() === '' ? null : Math.max(0, Math.min(80, Math.round(Number(String(goals[i]).replace(',', '.')) * 2) / 2 || 0)),
    subs: list(subs[i]).map(s => s.replace(/\|/g, '/').slice(0, 30)), words: list(words[i]).map(w => w.toLowerCase().slice(0, 30)), pause: pause.includes(i), hidden: hidden.includes(i) }));
}
function loadCard() {
  const L = loadLimits(), f = (n, l, v) => '<label class="field"><span>' + l + '</span><input name="' + n + '" type="number" min="0" max="120" step="0.5" value="' + esc(v) + '"></label>';
  return '<section class="card"><h2 class="label">Ampel: Wann ist es zu viel?</h2><form data-form="load" style="display:flex;flex-direction:column;gap:10px"><div class="formgrid">' +
    f('weekY', 'Woche „eng“ ab (Std.)', L.weekY) + f('weekR', 'Woche „überplant“ ab (Std.)', L.weekR) + f('dayY', 'Tag „eng“ ab (Std.)', L.dayY) + f('dayR', 'Tag „überplant“ ab (Std.)', L.dayR) + f('overR', 'Arbeit rot ab Ziel plus (Std.)', L.overR) +
    '</div><p class="sub">Für die Woche zählt alles, was im Kalender steht: Arbeit, Vorlesungen, Training und Termine. Unter Zeiten wird Arbeit gelb, sobald du über deinem Wochenziel bist, und rot ab Ziel plus dem Wert oben.</p><div class="row"><button class="btn primary" type="submit">Speichern</button></div></form></section>';
}

/* ===================== Gewohnheiten ===================== */
// habit: kind check|minutes|count, target, freq daily|days|week, days[1–7], n (pro Woche), link 'bereich|Unterbereich', pauses[{from,until}], noAutoPause, log{datum: true|Zahl}
const activeHabits = () => byType('habit').filter(h => !h.archived);
const hm = v => /^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : null;
const hFreq = h => ['daily', 'days', 'week'].includes(h.freq) ? h.freq : (h.days && h.days.length && h.days.length < 7 ? 'days' : 'daily');
function normHabit(h) {
  const o = { ...h }, kind = ['check', 'minutes', 'count'].includes(o.kind) ? o.kind : 'check', freq = hFreq(o);
  o.kind = kind; o.freq = freq;
  if (kind === 'check') delete o.target; else o.target = Math.max(1, Math.min(1440, Math.round(Number(o.target) || (kind === 'minutes' ? 20 : 1))));
  const days = Array.from(new Set((Array.isArray(o.days) ? o.days : []).map(Number).filter(d => d >= 1 && d <= 7))).sort((a, b) => a - b);
  o.days = freq === 'days' && days.length ? days : [1, 2, 3, 4, 5, 6, 7];
  if (freq === 'week') o.n = Math.max(1, Math.min(7, Math.round(Number(o.n) || 3))); else delete o.n;
  const lk = splitCat(o.link); if (lk.cat && timeCats().some(c => c.id === lk.cat)) o.link = lk.cat + (lk.sub ? '|' + lk.sub : ''); else delete o.link;
  o.noAutoPause = !!o.noAutoPause; if (!o.noAutoPause) delete o.noAutoPause;
  o.unit = kind === 'count' ? String(o.unit || '').trim().slice(0, 20) : ''; if (!o.unit) delete o.unit;
  o.mini = String(o.mini || '').trim().slice(0, 80); if (!o.mini) delete o.mini;
  const mt = Math.round(Number(o.miniTarget) || 0); if (kind !== 'check' && mt >= 1 && mt < o.target) o.miniTarget = mt; else delete o.miniTarget;
  ['winFrom', 'winTo', 'remind'].forEach(f => { if (hm(o[f])) o[f] = hm(o[f]); else delete o[f]; });
  if (o.winFrom && o.winTo && o.winTo <= o.winFrom) delete o.winTo;
  o.log = o.log || {};
  return o;
}
function habitPaused(h, d) {
  if ((h.pauses || []).some(p => p.from <= d && (!p.until || p.until >= d))) return true;
  const off = !h.noAutoPause && offOn(d); return !!(off && (off.kind || 'urlaub') === 'urlaub');
}
function habitDue(h, d) { if (h.archived || habitPaused(h, d)) return false; const f = hFreq(h); return f === 'days' ? (h.days || [1, 2, 3, 4, 5, 6, 7]).includes(dow(d)) : true; }
const habitTarget = h => (h.kind || 'check') === 'check' ? 1 : Math.max(1, Number(h.target) || 1);
function habitManual(h, d) { const l = (h.log || {})[d]; return l === true ? habitTarget(h) : Number(l) || 0; }
function habitVal(h, d) {
  const k = h.kind || 'check'; let v = habitManual(h, d);
  if (h.link) { const { cat, sub } = splitCat(h.link), es = dayEntries(d).filter(e => e.cat === cat && (!sub || e.sub === sub)), m = es.reduce((s, e) => s + e.min, 0); v += k === 'minutes' ? m : k === 'count' ? es.length : (m > 0 ? 1 : 0); }
  return v;
}
// 'full' = Ziel geschafft, 'mini' = Mindestversion geschafft (hält die Serie), '' = nicht geschafft
function habitLevel(h, d) { const v = habitVal(h, d); if (v >= habitTarget(h)) return 'full'; if ((h.log || {})[d] === 'mini' || (h.miniTarget && v >= h.miniTarget)) return 'mini'; return ''; }
const habitDoneOn = (h, d) => !!habitLevel(h, d);
const hUnit = h => (h.kind || 'check') === 'minutes' ? ' Min.' : h.unit ? ' ' + h.unit : '';
function habitWeek(h, mon) {
  const t = todayISO(), days = weekDays(mon), active = days.filter(d => !habitPaused(h, d)).length;
  return { done: days.filter(d => d <= t && !habitPaused(h, d) && habitDoneOn(h, d)).length, need: Math.round((h.n || 3) * active / 7) };
}
function streak(h) {
  const t = todayISO();
  if (hFreq(h) === 'week') {
    let n = 0, mon = mondayOf(t); if (habitWeek(h, mon).done < habitWeek(h, mon).need) mon = addDays(mon, -7);
    for (let g = 0; g < 60; g++) { const w = habitWeek(h, mon); if (!w.need) { mon = addDays(mon, -7); continue; } if (w.done >= w.need) { n++; mon = addDays(mon, -7); } else break; }
    return n;
  }
  let n = 0, d = t; if (!habitDoneOn(h, d)) d = addDays(d, -1);
  for (let g = 0; g < 400; g++) { if (!habitDue(h, d)) { d = addDays(d, -1); continue; } if (habitDoneOn(h, d)) { n++; d = addDays(d, -1); } else break; }
  return n;
}
// Quote der letzten 4 Wochen: {hit, need}
function habitRate(h) {
  const t = todayISO(); let hit = 0, need = 0;
  if (hFreq(h) === 'week') { for (let i = 0; i < 4; i++) { const w = habitWeek(h, addDays(mondayOf(t), -7 * i)); need += w.need; hit += Math.min(w.done, w.need); } }
  else for (let i = 0; i < 28; i++) { const d = addDays(t, -i); if (habitDue(h, d)) { need++; if (habitDoneOn(h, d)) hit++; } }
  return { hit, need };
}
function habitRule(h) {
  const f = hFreq(h), k = h.kind || 'check';
  return [f === 'week' ? (h.n || 3) + '× pro Woche' : f === 'days' ? (h.days || []).map(d => WDS[d % 7]).join(', ') : 'täglich', k === 'minutes' ? 'je ' + habitTarget(h) + ' Min.' : k === 'count' ? 'je ' + habitTarget(h) + (h.unit ? ' ' + h.unit : '×') : '', h.winFrom ? (h.winTo ? h.winFrom + '–' + h.winTo + ' Uhr' : 'ab ' + h.winFrom + ' Uhr') : '', h.remind ? 'Erinnerung ' + h.remind : '', h.mini ? 'Mini: ' + h.mini : h.miniTarget ? 'Mini ab ' + h.miniTarget + hUnit(h) : '', h.link ? 'zählt aus ' + catName(splitCat(h.link).cat, splitCat(h.link).sub) : ''].filter(Boolean).join(' · ');
}
function habitRow(h, t, lbl) {   // lbl: anderer Text statt des Namens (z. B. „Heute“ auf der Gewohnheiten-Seite)
  const name = lbl || h.title;
  const k = h.kind || 'check', v = habitVal(h, t), tg = habitTarget(h), lv = habitLevel(h, t), done = lv === 'full', paused = habitPaused(h, t), pz = paused && (h.pauses || []).find(p => p.from <= t && (!p.until || p.until >= t));
  const st = streak(h), wk = hFreq(h) === 'week' ? habitWeek(h, mondayOf(t)) : null;
  const right = '<span class="streak">' + (wk ? wk.done + '/' + wk.need + ' diese Woche' : '') + (st ? (wk ? ' · ' : '') + '🔥 ' + st + (wk ? (st === 1 ? ' Woche' : ' Wochen') : '') : '') + '</span>';
  if (paused) return '<div class="habit"><span class="hname">' + esc(name) + '</span><span class="streak">' + (pz && pz.why === 'krank' ? 'krank, zählt nicht' : 'pausiert') + '</span></div>';
  const miniBtn = h.mini && !done ? '<button class="btn ghost" data-hmini="' + esc(h.id) + '" aria-pressed="' + (lv === 'mini') + '" title="' + esc(h.mini) + '">' + (lv === 'mini' ? '✓ Mini' : 'Nur Mini') + '</button>' : '';
  if (k === 'check') return '<div class="habit"><label class="hname"><input type="checkbox" data-habit="' + esc(h.id) + '"' + (done ? ' checked' : '') + ' aria-label="' + esc(h.title + ' erledigt') + '"> <span>' + esc(name) + '</span></label>' + miniBtn + right + '</div>';
  const steps = k === 'minutes' ? [-5, 5, 10] : [-1, 1];
  return '<div class="habit"><span class="hname">' + (done ? '✓ ' : lv === 'mini' ? '½ ' : '') + esc(name) + ' <span class="hval">' + v + ' / ' + tg + hUnit(h) + (lv === 'mini' ? ' · Mini geschafft' : '') + '</span></span><span class="hctl">' +
    steps.map(s => '<button class="btn" data-hadd="' + esc(h.id) + ':' + s + '" aria-label="' + esc(h.title) + ' ' + (s > 0 ? 'plus ' : 'minus ') + Math.abs(s) + '"' + (s < 0 && habitManual(h, t) <= 0 ? ' disabled' : '') + '>' + (s > 0 ? '+' : '−') + Math.abs(s) + '</button>').join('') + '</span>' + miniBtn + right + '</div>';
}
function habitsCard() {
  const t = todayISO(), hs = activeHabits().filter(h => habitDue(h, t));
  if (!activeHabits().length) return '';
  return '<section class="card" aria-labelledby="h-hab"><div class="row" style="justify-content:space-between"><h2 class="label" id="h-hab" style="margin:0">Gewohnheiten</h2><a class="btn ghost" href="#gewohnheiten" data-go="gewohnheiten">Alle</a></div>' +
    (hs.length ? hs.map(h => habitRow(h, t)).join('') : '<p class="empty">Heute steht keine an.</p>') + '</section>';
}
function pageHabits() {
  const t = todayISO(), hs = activeHabits(), arch = byType('habit').filter(h => h.archived), sickToday = hs.length && hs.every(h => (h.pauses || []).some(p => p.why === 'krank' && p.from <= t && (!p.until || p.until >= t)));
  const pauses = [];
  hs.forEach(h => (h.pauses || []).forEach((p, k) => { if (!p.until || p.until >= t) pauses.push({ h, p, k }); }));
  return '<div class="listpage"><div class="pagehead" style="margin:0"><div><h1 class="page">Gewohnheiten</h1></div><div class="row">' + (hs.length && !sickToday ? '<button class="btn" data-act="hsick">Heute krank</button>' : '') + '<button class="btn primary" data-new="habit">+ Gewohnheit</button></div></div>' +
    '<section class="card">' + (hs.length ? hs.map(h => {
      const last = Array.from({ length: 28 }, (_, i) => addDays(t, i - 27)), r = habitRate(h);
      return '<div class="rep"><div class="rh"><button class="lt" style="background:none;border:0;text-align:left;padding:0;color:inherit;flex:1;min-width:0" data-edit="' + esc(h.id) + '"><b>' + esc(h.title) + '</b><br><small class="sub">' + esc(habitRule(h)) + ' · ' + (r.need ? Math.round(r.hit / r.need * 100) : 0) + ' % in 4 Wochen' + (habitPaused(h, t) ? ' · gerade pausiert' : '') + '</small></button><button class="btn ghost" data-harch="' + esc(h.id) + '">Archivieren</button></div>' +
        habitRow(h, t, 'Heute') +
        '<div class="dots" aria-label="Letzte 4 Wochen">' + last.map(d => '<i class="' + (habitPaused(h, d) ? 'p' : habitLevel(h, d) === 'mini' ? 'mi' : habitDoneOn(h, d) ? 'on' : !habitDue(h, d) || hFreq(h) === 'week' ? 'off' : '') + '" title="' + esc(fmtShort(d)) + '"></i>').join('') + '</div></div>';
    }).join('') : '<p class="empty">Noch keine Gewohnheiten. Zum Beispiel: Sport 3× pro Woche, 20 Min. lesen täglich, 8 Gläser Wasser. Du kannst Jarvis auch schreiben: „neue Gewohnheit: 3× pro Woche Sport“.</p>') + '</section>' +
    (hs.length ? '<section class="card" style="margin-top:12px"><h2 class="label">Pause</h2>' +
      (pauses.length ? pauses.map(x => '<div class="listrow"><span class="lt">' + esc(x.h.title) + '<small>' + (x.p.why === 'krank' ? 'krank · ' : '') + esc(fmtShort(x.p.from)) + (x.p.until ? ' – ' + esc(fmtShort(x.p.until)) : ' bis auf Weiteres') + '</small></span><button class="btn ghost" data-hpdel="' + esc(x.h.id) + ':' + x.k + '">Pause beenden</button></div>').join('') : '') +
      '<form data-form="hpause" style="display:flex;flex-direction:column;gap:10px;margin-top:6px"><div class="formgrid"><label class="field"><span>Was pausieren?</span><select name="habit"><option value="">Alle Gewohnheiten</option>' + hs.map(h => '<option value="' + esc(h.id) + '">' + esc(h.title) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Grund</span><select name="why"><option value="">Pause</option><option value="krank">Krank</option></select></label>' +
      '<label class="field"><span>Ab</span><input name="from" type="date" value="' + t + '"></label><label class="field"><span>Bis (leer = bis auf Weiteres)</span><input name="until" type="date"></label></div><div class="row"><button class="btn" type="submit">Pausieren</button></div></form>' +
      '<p class="sub" style="margin-top:8px">Im Urlaub pausieren Gewohnheiten automatisch, außer du hast bei einer „Im Urlaub weiterlaufen“ angehakt. Pausierte Tage und Kranktage zählen nicht gegen deine Serie. „Nur Mini“ heißt: die kleinste Version geschafft, die Serie bleibt.</p></section>' : '') +
    (arch.length ? '<section class="card" style="margin-top:12px"><h2 class="label">Archiv</h2>' + arch.map(h => '<div class="listrow"><span class="lt">' + esc(h.title) + '<small>archiviert ' + esc(fmtShort(h.archived)) + ' · Verlauf bleibt erhalten</small></span><button class="btn ghost" data-hunarch="' + esc(h.id) + '">Zurückholen</button></div>').join('') + '</section>' : '') + '</div>';
}
async function setHabitLocal(h) { if (db) S.items = S.items.map(i => i.id === h.id ? h : i); await withRetry(() => store.setItem(h)); }
async function toggleHabit(id, on, day) {
  const h = S.items.find(i => i.id === id); if (!h) return; const t = day || todayISO(), log = { ...(h.log || {}) };
  if (on) log[t] = true; else delete log[t];
  Object.keys(log).forEach(d => { if (d < addDays(todayISO(), -400)) delete log[d]; });
  await setHabitLocal({ ...h, log });
}
async function habitMini(id, day) {
  const h = S.items.find(i => i.id === id); if (!h) return; const d = day || todayISO(), log = { ...(h.log || {}) };
  if (log[d] === 'mini') delete log[d]; else log[d] = 'mini';
  await setHabitLocal({ ...h, log });
}
async function habitAdd(id, n, day) {
  const h = S.items.find(i => i.id === id); if (!h) return; const d = day || todayISO(), log = { ...(h.log || {}) };
  const v = Math.max(0, habitManual(h, d) + Number(n || 0));
  if (v) log[d] = v; else delete log[d];
  await setHabitLocal({ ...h, log });
}

