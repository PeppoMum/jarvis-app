'use strict';
/* Jarvis-App – 05-seiten-kalender.js (aus Jarvis in Claude, Zeilen 2418–2964 von V48) */
/* ===================== Stufe 2: Seiten ===================== */
function curWeek() { if (!S.week) S.week = mondayOf(todayISO()); return S.week; }
function weekLabel(mon) { const a = dObj(mon), b = dObj(addDays(mon, 6)); return a.getDate() + '. ' + MON[a.getMonth()] + ' – ' + b.getDate() + '. ' + MON[b.getMonth()]; }
function weekNav() {
  const mon = curWeek();
  return '<div class="weeknav"><button class="iconbtn" data-weeknav="-1" aria-label="Vorige Woche">' + ICON.chevl + '</button><span class="wk">' + esc(weekLabel(mon)) + '</span><button class="iconbtn" data-weeknav="1" aria-label="Nächste Woche">' + ICON.chev + '</button>' +
    (mon !== mondayOf(todayISO()) ? '<button class="btn ghost" data-weeknav="0">Heute</button>' : '') + '</div>';
}
// ===== Termine verschieben (V25) =====
// Eigene Termine + Arbeit (Jarvis-Einträge) und Termine aus dem eigenen Google-Kalender.
// Zusatzkalender (z. B. Trainer-Cockpit) und Vorlesungen bleiben gesperrt. Nichts wird gelöscht.
function canMove(b) {
  if (!b) return false;
  if (b.kind === 'google') return !!mcp && !b.calName && !!b.gid && (b.start ? !!b.end : (!b.endDate || b.endDate <= addDays(b.date, 1)));
  return (b.kind === 'event' || b.kind === 'work') && !!b.src && !!b.src.id;
}
function blkAttr(b) {
  if (!b.ro) return ' data-edit="' + esc(b.id) + '"';
  return canMove(b) ? ' data-move="' + esc(b.id) + '" title="Tippen zum Verschieben"' : ' aria-disabled="true" data-ro="1"';
}
const mvHM = m => { m = Math.max(0, Math.min(1439, m)); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
function mvFind(ref) {
  ref = String(ref || '');
  if (ref.startsWith('g:')) {
    const g = S.gcal.find(x => 'g:' + x.gid === ref); if (!g) return null;
    return blocksOn(g.date).find(b => b.id === ref) || null;
  }
  const it = S.items.find(i => i.id === ref);
  if (!it || !['event', 'work'].includes(it.type)) return null;
  return { id: it.id, kind: it.type, title: it.type === 'work' ? 'Arbeit · ' + (it.place || 'Homeoffice') : it.title, date: it.date, start: it.start || null, end: it.end || null, src: it };
}
function mvRow(b, to) {
  const r = { ref: b.id, title: b.title, kind: b.kind, rec: !!b.rec, date: b.date, start: b.start || null, end: b.end || null, to: { date: b.date, start: b.start || null, end: b.end || null } };
  if (b.src && b.src.dateEnd) r.dateEnd = b.src.dateEnd;
  if (to) mvSet(r, to);
  return r;
}
function mvDur(r) { return r.start && r.end ? Math.max(15, hmToMin(r.end) - hmToMin(r.start)) : 60; }
function mvSet(r, to) {
  const hm = v => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : null;
  const t = { ...r.to };
  if (typeof to.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.date)) t.date = to.date;
  if (hm(to.start)) { const d = t.start && t.end ? hmToMin(t.end) - hmToMin(t.start) : mvDur(r); t.start = hm(to.start); t.end = mvHM(hmToMin(t.start) + Math.max(15, d)); }
  if (hm(to.end) && t.start && hm(to.end) > t.start) t.end = hm(to.end);
  if (r.kind === 'work' && !t.start) { t.start = r.start; t.end = r.end; }
  r.to = t;
}
function mvChanged(r) { return r.to.date !== r.date || r.to.start !== r.start || r.to.end !== r.end; }
function mvWhen(d, a, b) { return fmtShort(d) + (a ? ' · ' + a + (b ? '–' + b : '') : ' · ganztägig'); }
function mvClash(r) {
  if (!r.to.start) return [];
  const s = hmToMin(r.to.start), e = hmToMin(r.to.end || r.to.start);
  const mine = S.move ? S.move.rows.map(x => x.ref) : [r.ref];
  return blocksOn(r.to.date).filter(b => !mine.includes(b.id) && b.start && b.kind !== 'holiday' && hmToMin(b.start) < e && hmToMin(b.end || b.start) > s).map(b => b.title);
}
function openMove(ref) {
  const b = mvFind(ref);
  if (!b || !canMove(b)) { showToast('Diesen Termin kann Jarvis nicht verschieben.'); return; }
  S.editing = null; S.move = { rows: [mvRow(b)] }; render();
  setTimeout(() => { const f = document.querySelector('.sheet [data-mvq]'); f && f.focus(); }, 0);
}
function moveSheet() {
  const M = S.move, n = M.rows.length, ch = M.rows.filter(mvChanged).length;
  return '<div class="overlay" data-close="move"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mv-h">' +
    '<h2 id="mv-h">' + (n > 1 ? n + ' Termine verschieben' : 'Termin verschieben') + '</h2>' +
    (M.reply ? '<div class="jmsg" style="max-width:100%">' + esc(M.reply) + '</div>' : '') +
    M.rows.map((r, i) => {
      const cl = mvChanged(r) ? mvClash(r) : [];
      return '<div class="mvrow"><div class="mvh"><b>' + esc(r.title) + '</b><small>Jetzt: ' + esc(mvWhen(r.date, r.start, r.end)) + '</small></div>' +
        '<div class="row">' + [['-30', '−30 Min.'], ['30', '+30 Min.'], ['60', '+1 Std.'], ['d1', 'Morgen'], ['d7', '+1 Woche']].map(([v, l]) => '<button type="button" class="btn sm" data-mvq="' + i + '|' + v + '">' + l + '</button>').join('') + '</div>' +
        '<div class="mvf"><label class="field"><span>Tag</span><input type="date" data-mv="' + i + '" data-f="date" value="' + esc(r.to.date) + '"></label>' +
        '<label class="field"><span>Beginn</span><input type="time" data-mv="' + i + '" data-f="start" value="' + esc(r.to.start || '') + '"></label>' +
        '<label class="field"><span>Ende</span><input type="time" data-mv="' + i + '" data-f="end" value="' + esc(r.to.end || '') + '"></label></div>' +
        (mvChanged(r) ? '<div class="mvnew">Neu: ' + esc(mvWhen(r.to.date, r.to.start, r.to.end)) + '</div>' : '<div class="sub">Noch unverändert.</div>') +
        (cl.length ? '<div class="mvwarn">Überschneidet sich mit: ' + esc(cl.slice(0, 3).join(', ')) + '</div>' : '') +
        (r.rec ? '<div class="sub">Wiederholt sich: nur dieser eine Termin wird verschoben.</div>' : '') +
        (n > 1 ? '<div><button type="button" class="btn ghost sm" data-mvdrop="' + i + '">Diesen nicht verschieben</button></div>' : '') + '</div>';
    }).join('') +
    '<p class="sub">Ändert sich auch in deinem Google-Kalender. Danach kannst du es rückgängig machen.</p>' +
    '<div class="row actions"><button type="button" class="btn primary" data-mvok="1"' + (ch ? '' : ' disabled') + '>' + (ch > 1 ? ch + ' verschieben' : 'Verschieben') + '</button><button type="button" class="btn ghost" data-mvcancel="1">Abbrechen</button></div>' +
  '</div></div>';
}
async function applyMoves(rows) {
  const back = [], bad = [];
  for (const r of rows) {
    const t = r.to;
    try {
      if (String(r.ref).startsWith('g:')) {
        if (!mcp) throw new Error('kein Kalender');
        const gid = String(r.ref).slice(2);
        const inp = t.start ? { startTime: gTime(t.date, t.start), endTime: gTime(t.date, t.end || mvHM(hmToMin(t.start) + 60)) } : { allDay: true, startTime: gTime(t.date), endTime: gTime(addDays(t.date, 1)) };
        await mcp.callTool(GCAL, 'update_event', { eventId: gid, notificationLevel: 'NONE', ...inp }, { cache: false });
        S.gcal = S.gcal.map(g => g.gid === gid ? { ...g, date: t.date, start: t.start || null, end: t.start ? (t.end || null) : null, endDate: t.start ? t.date : addDays(t.date, 1) } : g);
      } else {
        const before = S.items.find(i => i.id === r.ref); if (!before) throw new Error('weg');
        const after = { ...before, date: t.date };
        if (t.start) { after.start = t.start; if (t.end) after.end = t.end; else delete after.end; } else { delete after.start; delete after.end; }
        if (before.dateEnd) { const dd = Math.round((dObj(t.date) - dObj(before.date)) / 864e5); after.dateEnd = addDays(before.dateEnd, dd); }
        await withRetry(() => store.setItem(after));
        if (CAL_TYPES.includes(after.type)) await calSync(after, before);
      }
      back.push({ ref: r.ref, title: r.title, kind: r.kind, date: t.date, start: t.start, end: t.end, to: { date: r.date, start: r.start, end: r.end } });
    } catch (e) { bad.push(r.title); }
  }
  if (mcp) fetchGcal();
  return { back, bad };
}
async function confirmMove() {
  const M = S.move; if (!M) return;
  const rows = M.rows.filter(mvChanged); if (!rows.length) return;
  S.move = null; S.busy = true; S.status = 'Jarvis verschiebt …'; render();
  let res;
  try { res = await applyMoves(rows); } finally { S.busy = false; S.status = ''; }
  const ok = rows.filter(r => !res.bad.includes(r.title));
  const lines = ok.map(r => '• ' + r.title + ': ' + mvWhen(r.to.date, r.to.start, r.to.end));
  if (ok.length) {
    await pushChat((M.text ? [{ role: 'me', text: M.text }] : []).concat([{ role: 'jarvis', text: 'Verschoben:\n' + lines.join('\n') + (res.bad.length ? '\nNicht geklappt: ' + res.bad.join(', ') : '') }]));
    logAct('Verschoben: ' + ok.map(r => r.title + ' → ' + mvWhen(r.to.date, r.to.start, r.to.end)).join(', '), { moves: res.back });
    showToast(ok.length === 1 ? 'Verschoben.' : ok.length + ' Termine verschoben.', async () => { const u = await applyMoves(res.back); showToast(u.bad.length ? 'Zurück ging nicht bei: ' + u.bad.join(', ') : 'Wieder wie vorher.'); });
  } else {
    if (M.text) await pushChat([{ role: 'me', text: M.text }, { role: 'jarvis', text: 'Das Verschieben hat nicht geklappt. Ist der Kalender verbunden?' }]);
    showToast('Verschieben hat nicht geklappt. Bitte später nochmal.');
  }
  render();
}
async function cancelMove() {
  const M = S.move; S.move = null;
  if (M && M.text) await pushChat([{ role: 'me', text: M.text }, { role: 'jarvis', text: 'Okay, ich lasse die Termine, wie sie sind.' }]);
  render();
}
// Liste für die KI: was verschoben werden darf, mit Kennung
function moveContext() {
  const t = todayISO(), now = nowHM(), rows = [];
  for (let k = 0; k < 21; k++) {
    const d = addDays(t, k);
    blocksOn(d).forEach(b => {
      if (k === 0 && b.start && (b.end || b.start) < now) return;
      if (b.src && b.src.dateEnd && b.src.date !== d) return;
      if (!canMove(b)) return;
      rows.push('- ref ' + b.id + ' | ' + b.title + ' | ' + d + ' (' + WD[dObj(d).getDay()] + ') ' + (b.start ? b.start + '-' + (b.end || '?') : 'ganztägig'));
    });
  }
  return '\nTermine, die Jarvis verschieben kann (nächste 3 Wochen, mit ref):\n' + (rows.slice(0, 120).join('\n') || '(keine)') + '\nNICHT verschiebbar: Vorlesungen (das geht unter Uni) und Termine aus Zusatzkalendern wie dem Trainer-Cockpit (dort ändern).';
}
function chatContext() {
  const log = (S.chat || []).slice(-10);
  if (!log.length) return '';
  return '\n\nBisheriges Gespräch (letzte Nachrichten, älteste zuerst). Bezieht sich die neue Nachricht darauf (z. B. „ja“, „mach das“, „beide“, „den zweiten“), mach genau mit dem weiter, worum es zuletzt ging:\n' +
    log.map(m => (m.role === 'me' ? 'Nutzer: ' : 'Jarvis: ') + String(m.text || '').replace(/\s+/g, ' ').slice(0, 300)).join('\n');
}
function calBadge(b) {
  if (b.ro) return '<span class="src">' + esc(calLabel(b)) + '</span>';
  if (b.cal === 'ok') return '<span class="calok" title="Steht im Kalender">Kalender ✓</span>';
  if (b.cal === 'err') return '<span class="calerr">nicht im Kalender</span>';
  return '';
}
function blockBtn(b) {
  return '<button class="blk' + (b.ro && !canMove(b) ? ' ro' : '') + (isTransit(b) ? ' trip' : '') + '"' + blkAttr(b) + '><span class="bt">' + esc(b.start || 'ganzt.') + '</span><span class="bd ' + (b.area ? 'a-' + esc(b.area) : '') + '"></span><span class="bx">' + esc(b.title) + (b.end ? ' <span class="src">bis ' + esc(b.end) + '</span>' : '') + (travelFor(b) ? ' <span class="src">· Fahrt eingeplant</span>' : '') + (b.ro ? ' <span class="src">· ' + esc(calLabel(b)) + '</span>' : '') + (wxText(b) ? ' <span class="src">· ' + esc(wxText(b)) + '</span>' : '') + (b.cal === 'err' ? ' <span class="calerr">!</span>' : '') + '</span></button>';
}
function pageWeek() {
  if (S.calView === 'monat') return pageMonth();
  const mon = curWeek(), ws = weekStats(mon), t = todayISO();
  const days = weekDays(mon).map(d => {
    const bl = blocksOn(d), tasks = openTasks().filter(x => x.date === d);
    const dayH = dayHours(bl);
    return '<section class="day' + (d === t ? ' today' : '') + (offOn(d) || holidayOn(d) ? ' offday' : '') + '" aria-label="' + esc(fmtLong(d)) + '"><h3><span>' + WDS[dObj(d).getDay()] + ' ' + dObj(d).getDate() + '.</span><small>' + (dayH ? fmtH(dayH) + ' Std.' : '') + '</small></h3>' + (wxDay(d) ? '<span class="wx' + (wxDay(d).rain >= 50 ? ' wet' : '') + '">' + wxDay(d).hi + '° · ' + esc(wxDay(d).phrase) + (wxDay(d).rain >= 30 ? ' · ' + wxDay(d).rain + ' %' : '') + '</span>' : '') +
      (bl.length ? bl.map(blockBtn).join('') : '<span class="daytask">frei</span>') +
      tasks.map(x => '<span class="daytask">☐ ' + esc(x.title) + '</span>').join('') + bdaysOn(d).map(x => '<span class="daytask">🎂 ' + esc(x.name) + (x.age ? ' (' + x.age + ')' : '') + '</span>').join('') + '</section>';
  }).join('');
  return '<div class="pagehead"><div><h1 class="page">Woche</h1><p class="sub"><span class="amp ' + ws.lvl + '"><i></i>' + esc(ws.label) + '</span> · ' + fmtH(ws.total) + ' Std. verplant' + (S.gcalState === 'loading' ? ' · Kalender lädt …' : '') + '</p></div>' + weekNav() + '</div>' +
    '<div class="row" style="margin-bottom:16px;justify-content:space-between"><div class="stats wcats">' + ws.cats.map(c => '<div class="stat"><small><i class="tdot" style="background:' + catColor(c.id) + '"></i> ' + esc(c.name) + '</small><b>' + fmtH(c.h) + (c.goal ? ' / ' + fmtH(c.goal) : '') + ' Std.</b></div>').join('') + (ws.other >= 0.05 ? '<div class="stat"><small><i class="tdot" style="background:var(--mu)"></i> Sonstiges</small><b>' + fmtH(ws.other) + ' Std.</b></div>' : '') + (ws.travel >= 0.05 ? '<div class="stat" title="Fahrten zählen nicht zu den verplanten Stunden"><small><i class="tdot" style="background:transparent;border:1px dashed var(--mu)"></i> Fahrt (zählt nicht)</small><b>' + fmtH(ws.travel) + ' Std.</b></div>' : '') + '<div class="stat"><small>Längster Tag</small><b>' + fmtH(ws.maxDay) + ' Std.</b></div></div>' +
    '<div class="row">' + viewSeg() + '<button class="btn" data-new="event">+ Termin</button><button class="btn" data-jt="pplan">Zeit einplanen</button><button class="btn primary" data-act="plan">' + (dow(todayISO()) >= 5 ? 'Nächste Woche planen' : 'Woche planen') + '</button></div></div>' +
    '<div class="week">' + days + '</div>';
}
const workDays = () => (Array.isArray(S.settings.workDays) && S.settings.workDays.length ? S.settings.workDays : [3, 4, 5]).map(Number);
// Urlaubstage eines Eintrags: eigene Angabe (auch halbe Tage) oder automatisch = Arbeitstage im Zeitraum
function offDays(o) {
  if (o.days != null && o.days !== '' && !isNaN(Number(o.days))) return Number(o.days);
  let n = 0, d = o.date; const e = o.dateEnd || o.date, wd = workDays(); let g = 0;
  while (d <= e && g++ < 400) { if (wd.includes(dow(d)) && !holidayOn(d)) n++; d = addDays(d, 1); }
  return n;
}
function vacationUsed(year) { return byType('off').filter(o => o.kind === 'urlaub' && String(o.date).slice(0, 4) === String(year)).reduce((s, o) => s + offDays(o), 0); }
// Arbeit einer Woche: eigene Arbeitsblöcke UND Arbeits-Termine aus dem Kalender (jeder Block zählt einmal)
function isWorkBlock(b) {
  if (!b) return false;
  if (b.kind === 'work') return true;
  if (!['google', 'event'].includes(b.kind) || !b.start || !b.end) return false;
  const c = blockCat(b); if (c) return c.cat === 'arbeit';
  return /^arbeit\b/i.test(String(b.title || '').trim());
}
function workBlocksWeek(mon, calOnly) { return weekDays(mon).flatMap(d => blocksOn(d).filter(b => isWorkBlock(b) && !(calOnly && b.kind === 'work'))); }
// Reine Arbeitszeit eines Tages: gesetzliche Pause (über 6 Std. 30 Min., über 9 Std. 45 Min.) abziehen, soweit keine Lücke zwischen den Blöcken dafür da ist
function workDayCalc(list) {
  const iv = list.map(b => [hmToMin(b.start), hmToMin(b.end)]).filter(([a, e]) => a != null && e != null && e > a).sort((x, y) => x[0] - y[0]);
  let sum = 0, gap = 0, ce = null;
  iv.forEach(([a, e]) => { if (ce == null || a >= ce) { if (ce != null) gap += a - ce; sum += e - a; ce = e; } else if (e > ce) { sum += e - ce; ce = e; } });
  const need = sum > 540 ? 45 : sum > 360 ? 30 : 0;
  return { min: sum, pause: Math.max(0, need - gap) };
}
function workWeekH(mon, calOnly) {
  const bl = workBlocksWeek(mon, calOnly);
  return weekDays(mon).reduce((s, d) => { const c = workDayCalc(bl.filter(b => b.date === d)); return s + (c.min - c.pause) / 60; }, 0);
}
function pageWork() {
  const mon = curWeek(), t = todayISO();
  const blocks = workBlocksWeek(mon).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const sum = workWeekH(mon), target = Number(S.settings.workHours ?? 20);
  const pauseOn = d => workDayCalc(blocks.filter(b => b.date === d)).pause, firstOn = b => blocks.find(x => x.date === b.date) === b;
  const workRow = b => { const own = b.kind === 'work', p = firstOn(b) ? pauseOn(b.date) : 0;
    return '<div class="listrow"><button class="lt"' + blkAttr(b) + '>' + esc(fmtShort(b.date)) + ' · ' + esc(b.start) + '–' + esc(b.end) + '<small>' + esc(own ? (b.src.place || 'Homeoffice') : b.title) + ' · ' + fmtH(durH(b.start, b.end)) + ' Std.' + (p ? ' · ' + p + ' Min. Pause abgezogen' : '') + '</small></button>' + (b.kind === 'google' ? '<span class="calok" title="Steht in deinem Google Kalender">' + esc(b.calName ? calLabel(b) : 'Kalender ✓') + '</span>' : calBadge({ cal: b.cal })) + '</div>'; };
  const offs = byType('off').filter(o => (o.dateEnd || o.date) >= t).sort((a, b) => a.date.localeCompare(b.date));
  const yr = new Date().getFullYear(), used = vacationUsed(yr), hasTotal = S.settings.vacationDays != null && S.settings.vacationDays !== '', total = Number(S.settings.vacationDays || 0) + Number(S.settings.vacationCarry || 0);
  const fmtD = n => String(Math.round(n * 2) / 2).replace('.', ',');
  return '<div class="listpage" style="max-width:900px"><div class="pagehead" style="margin:0"><div><h1 class="page">Arbeit</h1></div>' + weekNav() + '</div>' +
    '<div class="stats"><div class="stat"><small>Geplant diese Woche</small><b>' + fmtH(sum) + ' / ' + fmtH(target) + ' Std.</b></div>' + workLoggedStat(mon, target) + '<div class="stat"><small>Urlaub ' + yr + '</small><b>' + (hasTotal ? fmtD(total - used) + ' von ' + fmtD(total) + ' Tagen übrig' : fmtD(used) + ' Tage genommen') + '</b></div><div class="stat"><small>Arbeitstage</small><b>' + workDays().map(n => WDS[n % 7]).join(', ') + '</b></div></div>' +
    (hasTotal ? '' : '<p class="sub">Trag deinen Urlaubsanspruch in den Einstellungen ein, dann rechnet Jarvis den Rest aus.</p>') +
    '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 class="label" style="margin:0">Arbeitsblöcke</h2><span class="row"><button class="btn" data-new="work">+ Block</button><button class="btn primary" data-act="workplan"' + (canPlanLocal('planWorkLocal') ? '' : ' disabled') + '>Vorschlag</button></span></div>' +
      (blocks.length ? blocks.map(workRow).join('') : '<p class="empty">' + (S.gcalState === 'loading' ? 'Kalender lädt …' : 'Für diese Woche ist noch nichts geplant.') + '</p>') + '</section>' +
    '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 class="label" style="margin:0">Urlaub &amp; freie Tage</h2><button class="btn" data-new="off">+ Eintragen</button></div>' +
      (offs.length ? offs.map(o => '<div class="listrow"><button class="lt" data-edit="' + esc(o.id) + '">' + esc(o.kind === 'urlaub' ? 'Urlaub' : 'Frei') + (o.kind === 'urlaub' ? ' · ' + fmtD(offDays(o)) + (offDays(o) === 1 ? ' Tag' : ' Tage') : '') + '<small>' + esc(fmtShort(o.date)) + (o.dateEnd && o.dateEnd !== o.date ? ' – ' + esc(fmtShort(o.dateEnd)) : '') + '</small></button>' + calBadge({ cal: o.gcalId ? 'ok' : (o.calErr ? 'err' : '') }) + '</div>').join('') : '<p class="empty">Nichts geplant.</p>') + '</section>' +
  '</div>';
}
function workLoggedStat(mon, target) {
  const m = periodEntries(mon, addDays(mon, 6)).filter(e => e.cat === 'arbeit').reduce((s, e) => s + e.min, 0), h = m / 60, L = loadLimits();
  const lvl = h > target + L.overR ? 'r' : h > target ? 'y' : '';
  return '<div class="stat"><small><a href="#zeiten" data-go="zeiten">Gearbeitet (erfasst)</a></small><b>' + (lvl ? '<span class="amp ' + lvl + '"><i></i>' + fmtH(h) + ' Std.</span>' : fmtH(h) + ' / ' + fmtH(target) + ' Std.') + '</b></div>';
}
function pageUniOld() {
  const cls = byType('class').sort((a, b) => (a.weekday - b.weekday) || (a.start || '').localeCompare(b.start || ''));
  return '<div class="listpage" style="max-width:900px"><div><h1 class="page">Uni</h1><p class="sub">Stundenplan: feste Vorlesungen erscheinen jede Woche im Tagesablauf und in deinem Kalender.</p></div>' +
    '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 class="label" style="margin:0">Stundenplan</h2><button class="btn primary" data-new="class">+ Vorlesung</button></div>' +
      (cls.length ? cls.map(c => '<div class="listrow"><button class="lt" data-edit="' + esc(c.id) + '">' + esc(c.title) + '<small>' + esc(WD[Number(c.weekday) % 7]) + ' · ' + esc(c.start) + '–' + esc(c.end) + (c.room ? ' · ' + esc(c.room) : '') + (c.until ? ' · bis ' + esc(fmtShort(c.until)) : '') + '</small></button>' + calBadge({ cal: c.gcalId ? 'ok' : (c.calErr ? 'err' : '') }) + '</div>').join('') : '<p class="empty">Noch keine Vorlesungen eingetragen.</p>') + '</section>' +
  '</div>';
}
/* ===================== Menü: Gruppen, Unterreiter, zuletzt benutzt, Bereiche ausblenden ===================== */
const MENU_GROUPS = [
  ['Planen', [['aufgaben', 'Aufgaben', 'Aufgaben, Projekte, Ideen'], ['uni', 'Uni', 'Fächer, Lernpläne, Stundenplan'], ['arbeit', 'Arbeit', 'Arbeitsplan, Urlaub']]],
  ['Zuhause', [['essen', 'Essen & Haushalt', 'Essensplan, Haushalt, Packlisten'], ['ausgaben', 'Geld', 'Ausgaben und Verträge'], ['geburtstage', 'Geburtstage', '']]],
  ['Ich', [['zeiten', 'Zeiten & Gewohnheiten', 'Erfassen, Fokus, Gewohnheiten, Rückblick'], ['mail', 'Mails', 'Sortieren, aufräumen'], ['einstellungen', 'Einstellungen', 'Aussehen, Meldungen, Hinweise, Gedächtnis, Papierkorb']]]
];
const SUB_TABS = [
  [['aufgaben', 'Aufgaben'], ['ideen', 'Ideen']],
  [['essen', 'Essensplan'], ['haushalt', 'Haushalt & Listen']],
  [['ausgaben', 'Ausgaben'], ['vertraege', 'Verträge']],
  [['zeiten', 'Zeiten'], ['gewohnheiten', 'Gewohnheiten'], ['rueckblick', 'Rückblick']],
  [['einstellungen', 'Einstellungen'], ['berichte', 'Meldungen'], ['hinweise', 'Hinweise'], ['gedaechtnis', 'Gedächtnis'], ['protokoll', 'Protokoll'], ['papierkorb', 'Papierkorb']]
];
const MENU_ITEMS = MENU_GROUPS.flatMap(([, list]) => list);
const tabGroupOf = r => SUB_TABS.find(g => g.some(([id]) => id === r));
// Zu welchem Menüpunkt gehört eine Seite (Unterreiter zählen zum ersten Reiter)
const menuOf = r => { const g = tabGroupOf(r); return g ? g[0][0] : r; };
// Bereiche, die Phil ausgeblendet hat (Daten bleiben, nur das Menü wird kürzer)
const HIDEABLE = ['aufgaben', 'uni', 'arbeit', 'essen', 'ausgaben', 'geburtstage', 'zeiten', 'mail'];
const hiddenAreas = () => Array.isArray(S.settings.hiddenAreas) ? S.settings.hiddenAreas.filter(x => HIDEABLE.includes(x)) : [];
function subTabs(r) {
  const g = tabGroupOf(r); if (!g) return '';
  return '<nav class="seg gtabs" aria-label="Bereich">' + g.map(([id, l]) => '<button type="button" data-go="' + id + '" aria-pressed="' + (id === r) + '">' + esc(l) + '</button>').join('') + '</nav>';
}
function recentMenu() { try { return JSON.parse(localStorage.getItem('jarvis.recent') || '[]'); } catch (e) { return []; } }
function noteRecent(r) {
  const m = menuOf(r); if (!MENU_ITEMS.some(([id]) => id === m)) return;
  try { localStorage.setItem('jarvis.recent', JSON.stringify([m].concat(recentMenu().filter(x => x !== m)).slice(0, 6))); } catch (e) {}
}
function pageMore() {
  const wide = window.innerWidth > 760, hid = hiddenAreas();
  const show = id => !hid.includes(id) && !(wide && ['aufgaben', 'uni', 'arbeit'].includes(id));
  const sub = id => id === 'geburtstage' ? (nextBdays(1)[0] ? 'Als Nächstes: ' + nextBdays(1)[0].name + ', ' + relDay(nextBdays(1)[0].date) : 'Noch keine eingetragen') : (MENU_ITEMS.find(x => x[0] === id) || [])[2] || '';
  const link = ([r, l]) => '<a href="#' + r + '" data-go="' + r + '"><span>' + esc(l) + '<br><small class="sub">' + esc(sub(r)) + '</small></span>' + ICON.chev + '</a>';
  const rec = recentMenu().filter(show).slice(0, 3).map(id => MENU_ITEMS.find(x => x[0] === id)).filter(Boolean);
  return '<div class="listpage"><h1 class="page">Mehr</h1>' +
    '<form class="addrow" data-form="search" role="search"><label class="sr" for="mq-in">Alles durchsuchen</label><input id="mq-in" name="q" placeholder="Alles durchsuchen …" autocomplete="off" enterkeyhint="search"><button class="btn primary" type="submit">Suchen</button></form>' +
    (rec.length ? '<div class="mrec"><span class="sub">Zuletzt:</span>' + rec.map(([r, l]) => '<a class="btn" href="#' + r + '" data-go="' + r + '">' + esc(l) + '</a>').join('') + '</div>' : '') +
    MENU_GROUPS.map(([g, list]) => { const vis = list.filter(([id]) => show(id) || id === 'einstellungen'); return vis.length ? '<h2 class="label mgrp">' + esc(g) + '</h2><nav class="morelist" aria-label="' + esc(g) + '">' + vis.map(link).join('') + '</nav>' : ''; }).join('') +
  '</div>';
}
function menuSettings() {
  const hid = hiddenAreas(), names = Object.fromEntries(MENU_ITEMS.map(([id, l]) => [id, l]));
  return '<section class="card"><h2 class="label">Menü</h2><p class="sub" style="margin-bottom:8px">Haken weg bei allem, was du nicht brauchst. Der Bereich verschwindet aus dem Menü, gelöscht wird nichts.</p><div class="menuhide">' +
    HIDEABLE.map(id => '<label class="toggle"><input type="checkbox" data-hidearea="' + id + '"' + (hid.includes(id) ? '' : ' checked') + '> ' + esc(names[id] || id) + '</label>').join('') + '</div></section>';
}
function newItem(type) {
  const t = todayISO(), mon = curWeek();
  const base = { type, title: '' };
  if (type === 'event') Object.assign(base, { date: S.route === 'woche' && mon > t ? mon : t, start: '', end: '' });
  if (type === 'class') Object.assign(base, { title: '', weekday: 1, start: '10:00', end: '12:00' });
  if (type === 'task') Object.assign(base, { date: '', area: S.route === 'uni' ? 'uni' : null });
  if (type === 'habit') Object.assign(base, { kind: 'check', freq: 'daily', days: [1, 2, 3, 4, 5, 6, 7], log: {} });
  if (type === 'birthday') Object.assign(base, { md: t.slice(5), yearKnown: '1' });
  if (type === 'work') Object.assign(base, { title: 'Arbeit', date: mon > t ? mon : t, start: '09:00', end: '13:00', place: 'Homeoffice' });
  if (type === 'off') Object.assign(base, { title: 'Urlaub', date: t, dateEnd: t, kind: 'urlaub' });
  if (type === 'waiting') Object.assign(base, { since: t, followUp: addDays(t, 5) });
  if (type === 'contract') Object.assign(base, { per: 'monat', notice: 1, noticeUnit: 'monate', renew: '12' });
  return base;
}

/* ===================== Google Kalender ===================== */
function gcalStatusText() {
  return { idle: 'Kalender noch nicht geladen.', loading: 'Kalender wird geladen …', ok: 'Mit Google Kalender verbunden.', error: 'Google Kalender gerade nicht erreichbar.', off: 'Google Kalender ist für Jarvis nicht freigegeben oder nicht verbunden.' }[S.gcalState] || '';
}
const gTime = (date, hm) => date + 'T' + (hm || '00:00') + ':00';
function parseGTime(v) {
  if (!v) return null;
  if (typeof v === 'object') v = v.dateTime || v.date || null;
  if (typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { date: v, time: null };
  if (/[Zz]$|[+-]\d\d:?\d\d$/.test(v)) { const d = new Date(v); if (isNaN(d)) return null; return { date: isoDate(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) }; }
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/); return m ? { date: m[1], time: m[2] } : null;
}
function findId(o, depth = 0) {
  if (!o || depth > 4) return null;
  if (typeof o === 'string') { const m = o.match(/"?(?:eventId|id)"?\s*[:=]\s*"([A-Za-z0-9_\-]+)"/); return m ? m[1] : null; }
  if (typeof o !== 'object') return null;
  if (typeof o.eventId === 'string') return o.eventId;
  if (typeof o.id === 'string') return o.id;
  for (const k of ['event', 'result', 'data', 'created']) { const r = findId(o[k], depth + 1); if (r) return r; }
  return null;
}
async function fetchGcal() {
  if (!mcp) return;
  let from = [todayISO(), curWeek()].sort()[0], to = addDays([addDays(todayISO(), 14), addDays(curWeek(), 7)].sort().pop(), 0);
  if (S.calView === 'monat' && S.month) { const ms = mondayOf(S.month), me = addDays(mondayOf(addDays(S.month, 31)), 7); if (ms < from) from = ms; if (me > to) to = me; }
  S.gcalState = S.gcalState === 'ok' ? 'ok' : 'loading';
  try {
    const cals = [{ id: null, name: 'Google' }].concat(extraCals());
    const all = [], failed = [];
    for (const c of cals) {
      const args = Object.assign({ startTime: gTime(from), endTime: gTime(to), orderBy: 'startTime', pageSize: 250 }, c.id ? { calendarId: c.id } : {});
      let res = null, err = null;
      for (let k = 0; k < 3; k++) {   // ein Aussetzer darf keine Termine verschwinden lassen: bis zu 3 Versuche
        try { res = await mcp.callTool(GCAL, 'list_events', args, { cache: false }); err = null; break; }
        catch (e) { err = e; if (e && ['not_granted', 'server_not_connected', 'needs_reauth', 'consent_required', 'not_declared'].includes(e.code)) break; await new Promise(r => setTimeout(r, 1200 * (k + 1))); }
      }
      if (err) { if (!c.id) throw err; failed.push(c); continue; }   // Zusatzkalender: letzten Stand behalten (unten)
      const pl = res && res.payload, evs = (Array.isArray(pl) ? pl : (pl && (pl.events || pl.items || pl.results)) || []);
      if (c.id && !evs.length && (S.gcal || []).some(g => g.calName === c.name && g.date >= from && g.date <= to)) { failed.push(c); continue; }   // plötzlich leer: eher ein Aussetzer
      evs.forEach(e => all.push({ ...e, __cal: c }));
    }
    const arr = all;
    const prev = (S.gcal && S.gcal.length ? S.gcal : (() => { try { return (JSON.parse(localStorage.getItem('jarvis.gcal') || '{}').list) || []; } catch (e) { return []; } })());
    const kept = prev.filter(g => failed.some(c => c.name === g.calName));
    S.gcalPartial = failed.length ? failed.map(c => c.name).join(', ') : '';
    S.gcal = kept.concat(arr.map(e => {
      const st = parseGTime(e.start || e.startTime), en = parseGTime(e.end || e.endTime);
      const gid = e.id || e.eventId || '';
      if (!st || !gid || e.status === 'cancelled') return null;
      return { gid, title: e.summary || e.title || '(ohne Titel)', date: st.date, start: st.time, end: en && en.date === st.date ? en.time : null, endDate: en ? en.date : null, rec: !!e.recurringEventId, place: e.location || null, calName: e.__cal && e.__cal.id ? e.__cal.name : null, area: e.__cal && e.__cal.area || null, ...(isCockpitCal(e.__cal) ? { cockpit: true, ...abfahrtAus(e.description) } : {}) };
    }).filter(Boolean));
    if (failed.length) setTimeout(() => { if (S.gcalPartial) fetchGcal(); }, 60000);   // gleich nochmal versuchen
    S.gcalState = 'ok';
    try { localStorage.setItem('jarvis.gcal', JSON.stringify({ at: Date.now(), list: S.gcal })); } catch (e) {}
  } catch (e) {
    S.gcalState = e && ['not_granted', 'server_not_connected', 'needs_reauth', 'consent_required', 'not_declared'].includes(e.code) ? 'off' : 'error';
  }
  render();
}
// Erinnerung aufs Handy nur, wenn Phil sie beim Termin einstellt (remind = Minuten vorher), sonst keine
const REMINDS = [['', 'Nein'], ['0', 'Wenn es losgeht'], ['10', '10 Min. vorher'], ['30', '30 Min. vorher'], ['60', '1 Std. vorher'], ['1440', '1 Tag vorher']];
const remindIn = it => it.remind != null && it.remind !== '' && Number(it.remind) >= 0 ? { useDefaultReminders: false, overrideReminders: [{ method: 'popup', minutes: Number(it.remind) }] } : { useDefaultReminders: false };
function calInput(it) {
  const base = { summary: it.title || TYPES[it.type], description: 'Von Jarvis eingetragen.', notificationLevel: 'NONE', ...(it.type === 'task' ? {} : remindIn(it)) };
  if (it.type === 'event') {
    const multi = it.dateEnd && it.dateEnd > it.date;
    if (!it.start) return { ...base, allDay: true, startTime: gTime(it.date), endTime: gTime(addDays(multi ? it.dateEnd : it.date, 1)), ...(it.place ? { location: it.place } : {}) };
    if (multi) return { ...base, startTime: gTime(it.date, it.start), endTime: gTime(it.dateEnd, it.end || '23:59'), ...(it.place ? { location: it.place } : {}) };
    let end = it.end; if (!end) { const m = hmToMin(it.start) + 60; end = pad(Math.min(23, Math.floor(m / 60))) + ':' + pad(m >= 1440 ? 59 : m % 60); }
    return { ...base, startTime: gTime(it.date, it.start), endTime: gTime(it.date, end), ...(it.place ? { location: it.place } : {}) };
  }
  if (it.type === 'task') {
    if (!it.remindAt || it.done || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(it.remindAt)) return null;
    const d = it.remindAt.slice(0, 10), t = it.remindAt.slice(11, 16);
    return { ...base, summary: '⏰ ' + it.title, startTime: gTime(d, t), endTime: gTime(d, addMin(t, 15)), useDefaultReminders: false, overrideReminders: [{ method: 'popup', minutes: 0 }], availability: 'AVAILABILITY_FREE' };
  }
  if (it.type === 'work') return { ...base, summary: 'Arbeit · ' + (it.place || 'Homeoffice'), startTime: gTime(it.date, it.start), endTime: gTime(it.date, it.end) };
  if (it.type === 'off') return { ...base, summary: it.kind === 'urlaub' ? 'Urlaub' : (it.title || 'Frei'), allDay: true, startTime: gTime(it.date), endTime: gTime(addDays(it.dateEnd || it.date, 1)), availability: 'AVAILABILITY_FREE' };
  if (it.type === 'class') {
    let first = it.from && it.from > todayISO() ? it.from : todayISO(); let g = 0;
    while ((dow(first) !== Number(it.weekday) || !classWeekOk(it, first)) && g++ < 16) first = addDays(first, 1);
    const rec = 'RRULE:FREQ=WEEKLY' + (Number(it.every || 1) >= 2 ? ';INTERVAL=2' : '') + (it.until ? ';UNTIL=' + it.until.replace(/-/g, '') + 'T235959Z' : '');
    const ex = (it.skip || []).filter(d => d >= first).map(d => 'EXDATE;TZID=Europe/Berlin:' + d.replace(/-/g, '') + 'T' + it.start.replace(':', '') + '00');
    return { ...base, startTime: gTime(first, it.start), endTime: gTime(first, it.end), recurrenceData: [rec, ...ex], ...(it.room ? { location: it.room } : {}) };
  }
  return null;
}
const calWarned = { v: false };
async function calSync(it, before) {
  if (!mcp || S.settings.calSync === false) return;
  const input = calInput(it);
  if (!input) {   // z. B. Erinnerung entfernt oder Aufgabe erledigt: alten Kalendereintrag löschen
    const old = (before && before.gcalId) || it.gcalId;
    if (old) { await calDelete({ gcalId: old }); const cur = S.items.find(i => i.id === it.id); if (cur && cur.gcalId) { const c = { ...cur }; delete c.gcalId; await store.setItem(c); } }
    return;
  }
  try {
    let gid = (before && before.gcalId) || it.gcalId || null;
    if (gid && it.type === 'class') { await calDelete({ ...it, gcalId: gid }); gid = null; }  // Wiederholung neu anlegen
    if (gid) {
      const upd = { eventId: gid, summary: input.summary, startTime: input.startTime, endTime: input.endTime, notificationLevel: 'NONE' };
      if (input.allDay) upd.allDay = true; if (input.location) upd.location = input.location;
      if (input.overrideReminders) upd.overrideReminders = input.overrideReminders; else if (input.useDefaultReminders === false) upd.useDefaultReminders = false;
      await mcp.callTool(GCAL, 'update_event', upd, { cache: false });
    } else {
      const res = await mcp.callTool(GCAL, 'create_event', input, { cache: false });
      gid = findId(res && res.payload) || findId(res && res.content && res.content[0] && res.content[0].text);
    }
    const cur = S.items.find(i => i.id === it.id) || it;
    const upd = { ...cur }; delete upd.calErr; if (gid) upd.gcalId = gid; else upd.calErr = 'Kalender-ID fehlt';
    await store.setItem(upd);
    fetchGcal();
  } catch (e) {
    const cur = S.items.find(i => i.id === it.id) || it;
    await store.setItem({ ...cur, calErr: (e && e.code) || 'Fehler' });
    if (!calWarned.v) { calWarned.v = true; showToast(e && ['not_granted', 'consent_required'].includes(e.code) ? 'Kalender nicht freigegeben – Eintrag nur in Jarvis.' : 'Konnte nicht in den Kalender eintragen. Später erneut versuchen (Einstellungen).'); }
  }
}
async function calDelete(it) {
  if (!mcp || !it.gcalId) return;
  try { await mcp.callTool(GCAL, 'delete_event', { eventId: it.gcalId, notificationLevel: 'NONE' }, { cache: false }); } catch (e) { /* schon weg oder nicht erreichbar */ }
  fetchGcal();
}
async function removeItem(it) { try { await store.setTrash(it); } catch (e) {} await store.delItem(it.id); if (it.gcalId) calDelete(it); }
async function restoreItem(it) { const copy = { ...it }; delete copy.gcalId; delete copy.calErr; await store.setItem(copy); try { await store.delTrash(it.id); } catch (e) {} if (CAL_TYPES.includes(copy.type)) calSync(copy); }

/* ===================== Wochenplanung (Sonntags-Planung) ===================== */
const PLAN_STEPS = ['Rückblick', 'Nächste Woche', 'Arbeit', 'Lernblöcke', 'Fertig'];
function planWeekStart() { const t = todayISO(); return dow(t) >= 5 ? addDays(mondayOf(t), 7) : mondayOf(t); }
function busyText(mon, excludeWork) {
  return weekDays(mon).map(d => WD[dObj(d).getDay()] + ' ' + d + ': ' + (blocksOn(d).filter(b => !(excludeWork && b.kind === 'work')).map(b => b.kind === 'off' ? 'GANZER TAG FREI/URLAUB (keine Arbeit)' : (b.start ? b.start + '-' + (b.end || '?') + ' ' : 'ganztägig ') + b.title).join('; ') || 'nichts')).join('\n');
}
function openPlan(step) { S.plan = { step: step || 0, week: planWeekStart(), work: null, study: null, loading: false, note: '' }; render(); }
function planSheet() {
  const P = S.plan, mon = P.week, t = todayISO();
  const stepper = '<div class="steps">' + PLAN_STEPS.map((l, i) => '<span class="' + (i === P.step ? 'on' : i < P.step ? 'done' : '') + '">' + (i + 1) + '. ' + l + '</span>').join('') + '</div>';
  let body = '';
  if (P.step === 0) {
    const lastMon = addDays(mondayOf(t), dow(t) >= 5 ? 0 : -7);
    const done = byType('task').filter(x => x.done && x.doneAt && isoDate(new Date(x.doneAt)) >= lastMon).length;
    const over = taskBuckets().over;
    body = '<p>In den letzten Tagen hast du <b>' + done + '</b> ' + (done === 1 ? 'Aufgabe' : 'Aufgaben') + ' erledigt.</p>' +
      (over.length ? '<p>Noch offen und überfällig:</p>' + over.map(x => '<div class="listrow"><span class="lt">' + esc(x.title) + '<small>' + esc(relDay(x.date)) + '</small></span><button class="btn" data-planmove="' + esc(x.id) + '">In neue Woche</button></div>').join('') : '<p class="sub">Nichts Überfälliges. Stark.</p>');
  } else if (P.step === 1) {
    const end = addDays(mon, 6);
    const due = openTasks().filter(x => x.date && x.date >= mon && x.date <= end).sort((a, b) => a.date.localeCompare(b.date));
    const ws = weekStats(mon);
    body = '<p class="sub">Woche ' + esc(weekLabel(mon)) + ' · <span class="amp ' + ws.lvl + '"><i></i>' + esc(ws.label) + '</span> · ' + fmtH(ws.total) + ' Std. verplant</p>' +
      '<h3 class="label" style="margin-top:6px">Fristen</h3>' + (due.length ? due.map(x => '<div class="listrow"><span class="lt">' + esc(x.title) + '<small>' + esc(fmtShort(x.date)) + '</small></span></div>').join('') : '<p class="empty">Keine Fristen in dieser Woche.</p>') +
      '<h3 class="label" style="margin-top:6px">Termine</h3>' + weekDays(mon).map(d => { const bl = blocksOn(d).filter(b => b.kind !== 'work'); return bl.length ? '<div class="listrow"><span class="lt">' + esc(fmtShort(d)) + '<small>' + esc(bl.map(b => (b.start ? b.start + ' ' : '') + b.title).join(' · ')) + '</small></span></div>' : ''; }).join('');
  } else if (P.step === 2) {
    const existing = byType('work').filter(w => w.date >= mon && w.date <= addDays(mon, 6));
    if (!P.work) {
      body = '<p>Soll Jarvis deine Arbeitszeit für ' + esc(weekLabel(mon)) + ' vorschlagen? Ziel: ' + fmtH(Number(S.settings.workHours ?? 20)) + ' Std., nach deinen Regeln und um Vorlesungen und Termine herum.</p>' +
        (existing.length ? '<p class="sub">Schon geplant: ' + fmtH(existing.reduce((s, w) => s + durH(w.start, w.end), 0)) + ' Std. Ein neuer Vorschlag ersetzt diese Blöcke.</p>' : '') +
        (workWeekH(mon, true) ? '<p class="sub">Im Kalender stehen schon ' + fmtH(workWeekH(mon, true)) + ' Std. Arbeit. Die bleiben, Jarvis plant nur, was noch fehlt.</p>' : '') +
        '<div class="row"><button class="btn primary" data-act="planwork"' + (P.loading || !canPlanLocal('planWorkLocal') ? ' disabled' : '') + '>' + (P.loading ? 'Jarvis plant …' : 'Vorschlag machen') + '</button><button class="btn ghost" data-act="planskip">Überspringen</button></div>';
    } else body = proposalHtml('work', P.work) + (P.note ? '<p class="sub">' + esc(P.note) + '</p>' : '');
  } else if (P.step === 3) {
    if (!P.study) {
      const cand = openTasks().filter(x => x.date && x.date >= t && x.date <= addDays(mon, 13));
      body = (cand.length ? '<p>Jarvis kann Zeitblöcke für deine anstehenden Aufgaben in freie Lücken legen:</p>' + cand.map(x => '<div class="listrow"><span class="lt">' + esc(x.title) + '<small>fällig ' + esc(relDay(x.date)) + '</small></span></div>').join('') +
        '<div class="row" style="margin-top:8px"><button class="btn primary" data-act="planstudy"' + (P.loading || !canPlanLocal('planStudyLocal') ? ' disabled' : '') + '>' + (P.loading ? 'Jarvis sucht Lücken …' : 'Lernblöcke vorschlagen') + '</button><button class="btn ghost" data-act="planskip">Überspringen</button></div>'
        : '<p class="empty">Keine Aufgaben mit Frist in den nächsten zwei Wochen.</p>');
    } else body = proposalHtml('study', P.study);
    if (!P.study) body += '<p class="sub" style="margin-top:10px">Oder eine feste Stundenzahl einplanen, z. B. 4 Std. Lernen: <button class="btn" data-jt="pplan" data-week="plan">Zeit einplanen</button></p>';
  } else {
    const ws = weekStats(mon);
    if (S.settings.weekPlanned !== mon && mon > mondayOf(t)) { S.settings = { ...S.settings, weekPlanned: mon }; store.setSettings(S.settings); }
    body = '<p><b>Fertig.</b> Deine Woche ' + esc(weekLabel(mon)) + ' ist geplant: ' + fmtH(ws.total) + ' Std. verplant, davon ' + fmtH(ws.work) + ' Std. Arbeit.</p><p class="sub">Alle neuen Blöcke stehen auch in deinem Kalender.</p>';
  }
  const canNext = P.step < 4 && !(P.step === 2 && P.work) && !(P.step === 3 && P.study);
  return '<div class="overlay" data-close="plan"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pl-h"><h2 id="pl-h">Woche planen</h2>' + stepper + body +
    '<div class="row actions" style="justify-content:space-between">' + (P.step > 0 && P.step < 4 ? '<button class="btn ghost" data-act="planback">Zurück</button>' : '<span></span>') +
    '<span class="row">' + (P.step === 2 && P.work ? '<button class="btn ghost" data-act="planworkreset">Verwerfen</button><button class="btn primary" data-act="planworkok">Übernehmen</button>' : '') +
    (P.step === 3 && P.study ? '<button class="btn ghost" data-act="planstudyreset">Verwerfen</button><button class="btn primary" data-act="planstudyok">Übernehmen</button>' : '') +
    (canNext ? '<button class="btn primary" data-act="plannext">Weiter</button>' : '') + (P.step === 4 ? '<button class="btn primary" data-act="planclose">Schließen</button>' : '') + '</span></div></div></div>';
}
function proposalHtml(kind, list) {
  if (!list.length) return '<p class="empty">Jarvis hat nichts Passendes gefunden.</p>';
  const sum = list.filter(x => x.on).reduce((s, b) => s + durH(b.start, b.end), 0);
  return '<p class="sub">' + (kind === 'work' ? 'Vorschlag: ' + fmtH(sum) + ' Std. Arbeit' : 'Vorschlag: ' + list.length + ' Blöcke') + ' – Haken entfernen oder Zeiten anpassen, dann übernehmen.</p>' +
    list.map((b, i) => '<div class="pick"><input type="checkbox" aria-label="Übernehmen" data-prop="' + kind + '" data-i="' + i + '" data-f="on"' + (b.on ? ' checked' : '') + '><div class="pf">' +
      (kind === 'study' ? '<input aria-label="Titel" data-prop="' + kind + '" data-i="' + i + '" data-f="title" value="' + esc(b.title) + '" style="grid-column:1/-1">' : '') +
      '<input type="date" aria-label="Datum" data-prop="' + kind + '" data-i="' + i + '" data-f="date" value="' + esc(b.date) + '">' +
      '<input type="time" aria-label="Beginn" data-prop="' + kind + '" data-i="' + i + '" data-f="start" value="' + esc(b.start) + '">' +
      '<input type="time" aria-label="Ende" data-prop="' + kind + '" data-i="' + i + '" data-f="end" value="' + esc(b.end) + '">' +
      (kind === 'work' ? '<select aria-label="Ort" data-prop="work" data-i="' + i + '" data-f="place"><option' + (b.place === 'Büro' ? ' selected' : '') + '>Büro</option><option' + (b.place !== 'Büro' ? ' selected' : '') + '>Homeoffice</option></select>' : '') +
    '</div></div>').join('');
}
const validBlock = b => b && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && /^\d{1,2}:\d{2}$/.test(b.start) && /^\d{1,2}:\d{2}$/.test(b.end) && b.end.padStart(5, '0') > b.start.padStart(5, '0');
// Ohne KI: Vorschläge aus festen Regeln (planWorkLocal/planStudyLocal aus dem Thread „KI-Teile ersetzen“)
const canPlanLocal = fn => !!sample || typeof window[fn] === 'function';
async function planWork() {
  const P = S.plan; if (!P || !canPlanLocal('planWorkLocal')) return;
  P.loading = true; render();
  const mon = P.week, calH = workWeekH(mon, true), target = Math.round((Number(S.settings.workHours ?? 20) - calH) * 4) / 4;
  if (target <= 0) { P.loading = false; showToast('Deine Arbeitszeit für diese Woche steht schon komplett im Kalender.'); render(); return; }
  const prompt = 'Plane die Arbeitszeit eines Werkstudenten für die Woche ' + mon + ' bis ' + addDays(mon, 6) + '.\nZiel: genau ' + target + ' Stunden reine Arbeitszeit (Pausen zählen nicht).' + (calH ? ' ' + fmtH(calH) + ' Std. Arbeit stehen schon im Kalender (unten bei den belegten Zeiten) und sind darin NICHT enthalten; plane nur diese zusätzlichen Stunden.' : '') + '\nSeine Regeln:\n' + (S.settings.rules || DEFAULT_RULES) +
    '\n\nBereits belegte Zeiten (dort NICHT arbeiten, mindestens 30 Minuten Puffer für den Weg davor/danach einplanen, wenn Büro):\n' + busyText(mon, true) +
    '\n\nRegeln für die Ausgabe: Arbeitsblöcke NUR an diesen Arbeitstagen: ' + workDays().map(n => WD[n % 7]).join(', ') + '. Nie an freien Tagen/Urlaub. Wechsel Büro→Homeoffice am Bürotag als zwei Blöcke mit Pause dazwischen. Pausen als Lücke zwischen Blöcken.\n' +
    'Antworte NUR mit JSON: {"blocks":[{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","place":"Büro|Homeoffice"}],"note":"ein kurzer Satz zur Verteilung"}';
  try {
    const res = sample ? await sample.json(prompt, { cache: false }) : await planWorkLocal(mon, target);
    P.work = (res && Array.isArray(res.blocks) ? res.blocks : []).filter(validBlock).filter(b => b.date >= mon && b.date <= addDays(mon, 6) && workDays().includes(dow(b.date)) && !offOn(b.date) && !holidayOn(b.date))
      .map(b => ({ date: b.date, start: b.start.padStart(5, '0'), end: b.end.padStart(5, '0'), place: b.place === 'Büro' ? 'Büro' : 'Homeoffice', on: true }));
    P.note = res && typeof res.note === 'string' ? res.note.slice(0, 300) : '';
  } catch (e) { showToast(e && e.code === 'rate_limited' ? 'Gerade zu viele Anfragen. Bitte später nochmal.' : 'Vorschlag ging gerade nicht. Bitte nochmal versuchen.'); }
  P.loading = false; render();
}
async function applyWork() {
  const P = S.plan; if (!P || !P.work) return;
  const mon = P.week;
  const old = byType('work').filter(w => w.date >= mon && w.date <= addDays(mon, 6));
  for (const w of old) await removeItem(w);
  const ts = new Date().toISOString();
  const made = [];
  for (const b of P.work.filter(x => x.on && validBlock(x))) { const it = { id: uid(), type: 'work', title: 'Arbeit', date: b.date, start: b.start, end: b.end, place: b.place, createdAt: ts }; await store.setItem(it); calSync(it); made.push(it.id); }
  logAct('Arbeitszeit für ' + weekLabel(mon) + ' geplant (' + made.length + ' Blöcke)', { created: made, restore: old });
  P.work = null; P.step = 3; render();
}
async function planStudy() {
  const P = S.plan; if (!P || !canPlanLocal('planStudyLocal')) return;
  P.loading = true; render();
  const t = todayISO(), mon = P.week;
  const cand = openTasks().filter(x => x.date && x.date >= t && x.date <= addDays(mon, 13));
  const from = mon > t ? mon : t;
  const days = Array.from({ length: 10 }, (_, i) => addDays(from, i));
  const busy = days.map(d => WD[dObj(d).getDay()] + ' ' + d + ': ' + (blocksOn(d).map(b => b.kind === 'off' ? 'Urlaub/frei' : (b.start ? b.start + '-' + (b.end || '?') + ' ' : 'ganztägig ') + b.title).join('; ') || 'nichts')).join('\n');
  const prompt = 'Lege Arbeits-/Lernblöcke für diese Aufgaben in freie Zeiten, jeweils VOR der Frist:\n' + cand.map(x => '- id ' + x.id + ': ' + x.title + ' (fällig ' + x.date + ')').join('\n') +
    '\n\nBelegte Zeiten:\n' + busy + '\n\nRegeln: nur zwischen 08:00 und 21:00, Blöcke 60 bis 120 Minuten, mindestens 15 Minuten Abstand zu anderen Terminen, höchstens 2 Blöcke pro Tag, nicht nach der Frist. Nicht mehr Blöcke als sinnvoll (meist 1–2 pro Aufgabe).\n' +
    'Antworte NUR mit JSON: {"blocks":[{"taskId":"…","title":"Lernblock: …","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}]}';
  try {
    const res = sample ? await sample.json(prompt, { cache: false }) : await planStudyLocal(cand, from);
    P.study = (res && Array.isArray(res.blocks) ? res.blocks : []).filter(validBlock).map(b => {
      const task = cand.find(x => x.id === b.taskId);
      return { date: b.date, start: b.start.padStart(5, '0'), end: b.end.padStart(5, '0'), title: String(b.title || ('Block: ' + (task ? task.title : ''))).slice(0, 120), area: task ? task.area : null, on: true };
    });
  } catch (e) { showToast('Vorschlag ging gerade nicht. Bitte nochmal versuchen.'); }
  P.loading = false; render();
}
async function applyStudy() {
  const P = S.plan; if (!P || !P.study) return;
  const ts = new Date().toISOString();
  const made = [];
  for (const b of P.study.filter(x => x.on && validBlock(x))) { const it = { id: uid(), type: 'event', title: b.title, date: b.date, start: b.start, end: b.end, createdAt: ts }; if (b.area) it.area = b.area; await store.setItem(it); calSync(it); made.push(it.id); }
  logAct(made.length + ' Lernblöcke eingetragen', { created: made });
  P.study = null; P.step = 4; render();
}
async function workPlanDirect() { openPlan(2); planWork(); }


