'use strict';
/* Jarvis-App – 13-stunden.js: Stunden je Woche, geplant gegen gemacht, mit Verlauf ab der Woche vom 26.10.2026.
   Bereiche: Arbeit, Uni, Ehrenamt (alles rund um Fußball, Scouting …), Sonstiges. Dazu zwei Summen:
   „Arbeit + Uni + Ehrenamt“ und „Alles“ (mit Sonstigem).
   - Fahrten und Blocker zählen nie. Was sich überschneidet, zählt einmal. Lernzeit/Lernsession ist Uni (UNI_HINT in 09-zeiten.js, seit PR #23).
   - Arbeit wie auf der Arbeit-Seite: über 6 Std. am Stück gehen 30 Min. Pause ab (über 9 Std. 45 Min.), soweit keine Lücke dafür da ist.
   - Gemacht = was im Kalender steht und schon vorbei ist.
   - Geplant = wie die Woche am Montag im Kalender stand. Das merkt sich die App von selbst (meta/wochenplan, keine Pflege).
     Wochen, für die es noch keinen gemerkten Plan gibt, zeigen den Kalender-Stand und sagen das dazu. */
const STD_START = '2026-10-26';
const STD_KAT = [['arbeit', 'Arbeit'], ['uni', 'Uni'], ['ehrenamt', 'Ehrenamt'], ['sonst', 'Sonstiges']];
const STD_KEYS = ['arbeit', 'uni', 'ehrenamt', 'sonst', 'pflicht', 'alles'];
const BLOCKER_RE = /^\s*blocker\b/i;

// Ein Kalender-Block → 'arbeit' | 'uni' | 'ehrenamt' | 'sonst' | null (zählt nicht)
function stdCat(b) {
  if (!b || !b.start || !b.end || b.kind === 'off' || b.kind === 'holiday') return null;
  if (isTransit(b) || BLOCKER_RE.test(b.title || '')) return null;
  const a = hmToMin(b.start), e = hmToMin(b.end); if (a == null || e == null || e <= a) return null;
  const t = b.title || '';
  if (b.kind === 'work') return 'arbeit';
  if (b.kind === 'class') return 'uni';
  if (b.cockpit || isTeamBlock(b) || FUSSBALL_RE.test(t)) return 'ehrenamt';
  const c = blockCat(b);
  return c && LOAD_CATS.includes(c.cat) ? c.cat : 'sonst';
}
// Minuten, die eine Liste von [von, bis] abdeckt (Überschneidungen einmal)
function stdUnion(iv) {
  iv = iv.slice().sort((x, y) => x[0] - y[0]);
  let sum = 0, cs = -1, ce = -1;
  iv.forEach(([a, e]) => { if (a > ce) { if (ce > cs) sum += ce - cs; cs = a; ce = e; } else ce = Math.max(ce, e); });
  if (ce > cs) sum += ce - cs;
  return sum;
}
const stdZero = () => Object.fromEntries(STD_KEYS.map(k => [k, 0]));
// Stunden eines Tages; bis = Minute, ab der nichts mehr zählt (für „gemacht“ heute), null = ganzer Tag
function stdDay(d, bis) {
  const by = { arbeit: [], uni: [], ehrenamt: [], sonst: [] };
  blocksOn(d).forEach(b => {
    const k = stdCat(b); if (!k) return;
    let a = hmToMin(b.start), e = hmToMin(b.end); if (bis != null) e = Math.min(e, bis);
    if (e > a) by[k].push([a, e]);
  });
  const w = workDayCalc(by.arbeit.map(([a, e]) => ({ start: minToHm(a), end: minToHm(e) }))), pause = w.pause;
  const r = { arbeit: (w.min - pause) / 60, uni: stdUnion(by.uni) / 60, ehrenamt: stdUnion(by.ehrenamt) / 60, sonst: stdUnion(by.sonst) / 60 };
  r.pflicht = Math.max(0, stdUnion(by.arbeit.concat(by.uni, by.ehrenamt)) - pause) / 60;
  r.alles = Math.max(0, stdUnion(by.arbeit.concat(by.uni, by.ehrenamt, by.sonst)) - pause) / 60;
  return r;
}
// Woche: alles im Kalender (kal) und davon schon vorbei (done)
function stdWeekRaw(mon) {
  const t = todayISO(), now = hmToMin(nowHM()), kal = stdZero(), done = stdZero();
  weekDays(mon).forEach(d => {
    const all = stdDay(d, null), past = d < t ? all : d === t ? stdDay(d, now) : null;
    STD_KEYS.forEach(k => { kal[k] += all[k]; if (past) done[k] += past[k]; });
  });
  return { kal, done };
}

/* ----- Vergangene Wochen aus dem Google Kalender holen (die normale Ansicht lädt nur ab heute bzw. die gezeigte Woche) ----- */
function stdMapG(e, c) {
  const st = parseGTime(e.start || e.startTime), en = parseGTime(e.end || e.endTime), gid = e.id || e.eventId || '';
  if (!st || !gid || e.status === 'cancelled') return null;
  return { gid, title: e.summary || e.title || '(ohne Titel)', date: st.date, start: st.time, end: en && en.date === st.date ? en.time : null, endDate: en ? en.date : null, rec: !!e.recurringEventId, place: e.location || null, calName: c && c.id ? c.name : null, area: c && c.area || null, ...(isCockpitCal(c) ? { cockpit: true } : {}) };
}
async function stdFetch() {
  if (!mcp || S._stdBusy) return;
  S._stdBusy = true;
  const from = STD_START, to = addDays(mondayOf(todayISO()), 7);
  try {
    const list = [];
    for (const c of [{ id: null, name: 'Google' }].concat(extraCals())) {
      const args = Object.assign({ startTime: gTime(from), endTime: gTime(to), orderBy: 'startTime', pageSize: 250 }, c.id ? { calendarId: c.id } : {});
      const res = await mcp.callTool(GCAL, 'list_events', args, { cache: false });
      const pl = res && res.payload, evs = Array.isArray(pl) ? pl : (pl && (pl.events || pl.items || pl.results)) || [];
      evs.forEach(e => { const g = stdMapG(e, c); if (g) list.push(g); });
    }
    S.stdHist = { from, to, list, at: Date.now() }; S.stdErr = '';
  } catch (e) { S.stdErr = 'Ältere Wochen konnten gerade nicht aus dem Kalender geladen werden.'; }
  finally { S._stdBusy = false; }
  if (S.route === 'woche' && S.calView === 'stunden') render();   // sonst nicht neu zeichnen (z. B. mitten im Tippen in einem Formular)
}
// Für die Rechnung: Vergangenes aus dem geholten Verlauf, ab heute der laufend aktuelle Kalender
function stdWithCal(fn) {
  const H = S.stdHist; if (!H) return fn();
  const keep = S.gcal, t = todayISO();
  S.gcal = H.list.filter(g => g.date < t).concat((keep || []).filter(g => g.date >= t || g.date < H.from));
  try { return fn(); } finally { S.gcal = keep; }
}
const stdWeeks = () => { const out = [], cur = mondayOf(todayISO()); for (let m = STD_START; m <= cur; m = addDays(m, 7)) out.push(m); return out; };

/* ----- Plan der Woche merken: am Montag laufend, sonst beim ersten Blick in der Woche; danach bleibt er ----- */
function stdPlanFor(mon) { const w = S.wochenplan && S.wochenplan.weeks && S.wochenplan.weeks[mon]; return w && w.h ? w : null; }
const stdCalOk = () => S.gcalState === 'ok' && !S.gcalPartial && !!S.stdHist && Date.now() - S.stdHist.at < 30 * 60000;
async function stdRemember() {
  if (!S.loaded || !S.wpLoaded || !stdCalOk() || S._wpBusy) return;
  const t = todayISO(), mon = mondayOf(t), old = stdPlanFor(mon);
  if (old && !(t === mon && old.date === mon)) return;   // nach Montag bleibt der gemerkte Plan
  const h = stdWithCal(() => stdWeekRaw(mon).kal);
  if (old && STD_KEYS.every(k => Math.abs((old.h[k] || 0) - h[k]) < 0.01)) return;
  const weeks = { ...((S.wochenplan && S.wochenplan.weeks) || {}) };
  weeks[mon] = { h: Object.fromEntries(STD_KEYS.map(k => [k, Math.round(h[k] * 100) / 100])), date: t, at: new Date().toISOString() };
  S._wpBusy = true;
  try { await store.setMeta('wochenplan', { weeks }); S.wochenplan = { weeks }; } catch (e) {} finally { S._wpBusy = false; }
}
function stdWatch() {
  if (!S.loaded || S._wpWatch) return;
  S._wpWatch = true;
  if (db) db.doc('meta/wochenplan').onSnapshot(snap => { S.wochenplan = snap.exists ? snap.data() : null; S.wpLoaded = true; if (S.route === 'woche' && S.calView === 'stunden') render(); }, () => { S._wpWatch = false; });
  else { S.wochenplan = local.read().wochenplan || null; S.wpLoaded = true; }
}
// Läuft im Hintergrund: Verlauf höchstens alle 30 Min. neu holen, Plan der Woche merken
async function stdTick() {
  stdWatch();
  if (!mcp || !S.wpLoaded || document.hidden) return;
  const mon = mondayOf(todayISO()), need = !stdPlanFor(mon) || todayISO() === mon || S.calView === 'stunden';
  if (need && (!S.stdHist || Date.now() - S.stdHist.at > 30 * 60000)) await stdFetch();
  await stdRemember();
}
setInterval(stdTick, 60000);
setTimeout(stdTick, 8000);

/* ----- Seite „Stunden“ (dritter Schalter auf der Woche-Seite) ----- */
function stdKw(iso) { const d = dObj(iso); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const j = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); }
const stdF = h => h == null ? '–' : fmtH(h);
const stdDiff = d => (d > 0.05 ? '+' : d < -0.05 ? '−' : '±') + fmtH(Math.abs(Math.round(d * 10) / 10));
function stdData() {
  return stdWithCal(() => stdWeeks().map(mon => {
    const r = stdWeekRaw(mon), p = stdPlanFor(mon);
    return { mon, kw: stdKw(mon), done: r.done, plan: p ? p.h : r.kal, kal: r.kal, gemerkt: p ? p.date : null, cur: mon === mondayOf(todayISO()) };
  }));
}
function stdBar(done, plan, max) {
  const w = v => Math.max(0, Math.min(100, max ? v / max * 100 : 0)).toFixed(1) + '%';
  return '<span class="stdbar" aria-hidden="true"><i style="width:' + w(done) + '"></i>' + (plan > 0 ? '<b style="left:' + w(plan) + '"></b>' : '') + '</span>';
}
function pageStunden() {
  const L = stdData(), cur = L[L.length - 1], prev = L.length > 1 ? L[L.length - 2] : null, t = todayISO();
  const fertig = L.filter(x => !x.cur), avg = k => fertig.length ? fertig.reduce((s, x) => s + x.done[k], 0) / fertig.length : null;
  const planHinweis = x => x.gemerkt ? (x.gemerkt > x.mon ? 'Plan gemerkt am ' + fmtShort(x.gemerkt) : 'Plan vom Montag') : 'Plan von damals nicht gemerkt, zeigt den Kalender';
  const max = Math.max(1, ...L.map(x => Math.max(x.done.alles, x.plan.alles)));
  // Diese Woche: zwei große Zahlen, dann die Bereiche
  const gross = (lab, k) => '<div class="stdbig"><small>' + esc(lab) + '</small><b>' + stdF(cur.done[k]) + '</b><span>von ' + stdF(cur.plan[k]) + ' Std. geplant</span>' + stdBar(cur.done[k], cur.plan[k], Math.max(cur.done[k], cur.plan[k], 1)) + '</div>';
  const zeile = (lab, k, sum) => '<div class="stdrow' + (sum ? ' sum' : '') + '"><span class="n">' + esc(lab) + '</span><span class="v"><b>' + stdF(cur.done[k]) + '</b> / ' + stdF(cur.plan[k]) + ' Std.</span>' + stdBar(cur.done[k], cur.plan[k], Math.max(cur.plan.alles, cur.done.alles, 1)) + '</div>';
  const woche = '<section class="card stdnow" aria-labelledby="h-stdnow"><h2 class="label" id="h-stdnow">Diese Woche · KW ' + cur.kw + '</h2>' +
    '<div class="stdbigs">' + gross('Arbeit + Uni + Ehrenamt', 'pflicht') + gross('Alles mit Sonstigem', 'alles') + '</div>' +
    '<div class="stdrows">' + STD_KAT.map(([k, n]) => zeile(n, k)).join('') + '</div>' +
    '<p class="sub stdnote">Gemacht / geplant · ' + esc(planHinweis(cur)) + (fmtH(cur.kal.alles) !== fmtH(cur.plan.alles) ? ' · jetzt im Kalender: ' + stdF(cur.kal.alles) + ' Std.' : '') + '</p></section>';
  // Vergleich: zur Vorwoche und zum Schnitt
  const vgl = prev ? '<section class="card stdvgl" aria-labelledby="h-stdvgl"><h2 class="label" id="h-stdvgl">Vergleich</h2><div class="stdrows">' +
    [['Arbeit + Uni + Ehrenamt', 'pflicht'], ['Alles mit Sonstigem', 'alles']].concat(STD_KAT.map(([k, n]) => [n, k])).map(([n, k]) =>
      '<div class="stdrow cmp"><span class="n">' + esc(n) + '</span><span class="v">Vorwoche <b>' + stdF(prev.done[k]) + '</b></span><span class="v">Schnitt <b>' + stdF(avg(k)) + '</b></span></div>').join('') +
    '</div><p class="sub stdnote">Schnitt über ' + fertig.length + (fertig.length === 1 ? ' fertige Woche' : ' fertige Wochen') + ' seit ' + esc(fmtShort(STD_START)) + ', gemachte Stunden.</p></section>' : '';
  // Verlauf: jede Woche, neueste oben
  const wk = x => '<li class="stdwk' + (x.cur ? ' cur' : '') + '"><div class="stdwh"><span><b>KW ' + x.kw + '</b> · ' + esc(weekLabel(x.mon)) + (x.cur ? ' · läuft' : '') + '</span><span class="stdtot"><b>' + stdF(x.done.pflicht) + '</b> / ' + stdF(x.done.alles) + ' Std.</span></div>' +
    stdBar(x.done.alles, x.plan.alles, max) +
    '<p class="stdcats">' + STD_KAT.map(([k, n]) => esc(n) + ' <b>' + stdF(x.done[k]) + '</b><small> von ' + stdF(x.plan[k]) + '</small>').join(' · ') + '</p>' +
    '<p class="stdcats">Arbeit + Uni + Ehrenamt <b>' + stdF(x.done.pflicht) + '</b><small> von ' + stdF(x.plan.pflicht) + '</small> · Alles <b>' + stdF(x.done.alles) + '</b><small> von ' + stdF(x.plan.alles) + '</small>' + (x.gemerkt ? '' : ' · <small>' + esc(planHinweis(x)) + '</small>') + '</p></li>';
  const verlauf = '<section class="card stdlauf" aria-labelledby="h-stdlauf"><h2 class="label" id="h-stdlauf">Verlauf seit ' + esc(fmtShort(STD_START)) + '</h2>' +
    '<p class="sub stdnote">Große Zahl: Arbeit + Uni + Ehrenamt / alles, gemacht. Balken: alles gemacht, roter Strich: alles geplant.</p><ol class="stdlist">' + L.slice().reverse().map(wk).join('') + '</ol></section>';
  const laden = !S.stdHist && mcp ? (S.stdErr ? '<p class="sub stdnote" role="status">' + esc(S.stdErr) + '</p>' : '<p class="sub stdnote" role="status">Ältere Wochen werden aus dem Kalender geladen …</p>') : '';
  return '<div class="pagehead"><div><h1 class="page">Stunden</h1><p class="sub">Gemacht gegen geplant, je Woche. Fahrten und Blocker zählen nie.</p></div></div>' +
    '<div class="row" style="margin-bottom:16px">' + viewSeg() + '</div>' + laden + '<div class="stdgrid">' + woche + vgl + verlauf + '</div>';
}
