'use strict';
/* Jarvis-App – 11-aufgaben-planung.js (aus Jarvis in Claude, Zeilen 5562–6430 von V48) */
/* ===================== Aufgaben, Projekte, Warte auf ===================== */
const CTX = { zuhause: 'Zuhause', uni: 'Uni', buero: 'Büro', unterwegs: 'Unterwegs' };
const PRIO = { hoch: 'dringend', normal: 'normal', niedrig: 'kann warten' };
const ESTS = [5, 10, 15, 25, 30, 45, 60, 90, 120, 180, 240];
const projSteps = pid => byType('task').filter(x => x.projectId === pid).sort((a, b) => (Number(a.step ?? 999) - Number(b.step ?? 999)) || (a.createdAt || '').localeCompare(b.createdAt || ''));
const nextStepOf = pid => projSteps(pid).find(x => !x.done) || null;
// Von einem Projekt taucht nur der nächste offene Schritt in den Aufgabenlisten auf
function isNextStep(x) { const p = S.items.find(i => i.id === x.projectId); if (!p || p.type !== 'project' || p.done) return true; const n = nextStepOf(p.id); return !n || n.id === x.id; }
const somedayList = () => byType('task').filter(x => !x.done && x.status === 'someday').concat(byType('idea')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
const waitingOpen = () => byType('waiting').filter(w => !w.done).sort((a, b) => (a.followUp || '9').localeCompare(b.followUp || '9'));
const waitingDue = () => waitingOpen().filter(w => w.followUp && w.followUp <= todayISO());
const estLabel = m => Number(m) < 60 ? m + ' Min.' : fmtH(Number(m) / 60) + ' Std.';
function taskMeta(x) { const p = x.projectId && S.items.find(i => i.id === x.projectId); return [p ? p.title : '', x.est ? estLabel(x.est) : '', CTX[x.ctx] || '', x.prio === 'hoch' ? 'dringend' : '', x.doDate && x.doDate !== x.date ? 'dran ' + relDay(x.doDate) : ''].filter(Boolean).join(' · '); }
function jsel(k, f, opts, val) { return '<select data-pv="' + k + '" data-f="' + f + '">' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(val ?? '') === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>'; }
function markSomedaySeen() { const mk = todayISO().slice(0, 7); if ((S.settings.somedaySeen || '') < mk) { S.settings = { ...S.settings, somedaySeen: mk }; store.setSettings(S.settings); } }

// Zusatzfelder im Bearbeiten-Fenster (i === 'e') bzw. in der Vorschau
function jtFields(it, i) {
  const inp = (f, label, type, val) => '<label class="field"><span>' + label + '</span><input' + (type ? ' type="' + type + '"' : '') + ' data-pv="' + i + '" data-f="' + f + '" value="' + esc(val || '') + '"></label>';
  let h = '';
  if (it.type === 'task' && i === 'e') {
    const projs = byType('project').filter(p => !p.done || p.id === it.projectId);
    h += inp('doDate', 'Wann machst du es?', 'date', it.doDate);
    h += '<label class="field"><span>Dauer (geschätzt)</span>' + jsel(i, 'est', [['', '—'], ...ESTS.map(m => [String(m), estLabel(m)])], it.est || '') + '</label>';
    h += '<label class="field"><span>Wo machbar?</span>' + jsel(i, 'ctx', [['', 'egal wo'], ...Object.entries(CTX)], it.ctx || '') + '</label>';
    h += '<label class="field"><span>Wie dringend?</span>' + jsel(i, 'prio', Object.entries(PRIO), it.prio || 'normal') + '</label>';
    h += '<label class="field"><span>Status</span>' + jsel(i, 'status', [['', 'offen'], ['someday', 'später vielleicht']], it.status || '') + '</label>';
    if (projs.length) h += '<label class="field"><span>Gehört zu Projekt</span>' + jsel(i, 'projectId', [['', '—'], ...projs.map(p => [p.id, p.title])], it.projectId || '') + '</label>';
  }
  if (it.type === 'waiting') { h += inp('who', 'Von wem?', '', it.who); h += inp('followUp', 'Nachhaken am', 'date', it.followUp); h += inp('since', 'Wartest du seit', 'date', it.since); }
  if (it.type === 'project') { h += '<label class="field"><span>Bereich</span>' + jsel(i, 'area', [['', '—'], ...Object.entries(AREAS)], it.area || '') + '</label>'; h += inp('due', 'Ziel bis (optional)', 'date', it.due); }
  if (it.type === 'class') {
    h += '<label class="field"><span>Rhythmus</span>' + jsel(i, 'every', [['1', 'jede Woche'], ['2', 'alle 2 Wochen']], String(it.every || 1)) + '</label>';
    if (Number(it.every || 1) >= 2) h += '<p class="sub full">Alle 2 Wochen ab dem „Ab“-Datum. Bitte das Datum des ersten Termins dort eintragen.</p>';
    if (i === 'e') {
      const sk = (it.skip || []).slice().sort();
      h += '<div class="field full"><span>Fällt aus</span>' + (sk.length ? '<div class="skips">' + sk.map(d => '<button type="button" data-jt="skipdel" data-d="' + esc(d) + '" aria-label="' + esc(fmtShort(d)) + ' findet doch statt">' + esc(fmtShort(d)) + ' ✕</button>').join('') + '</div>' : '<span class="sub">Bisher kein Ausfall.</span>') +
        '<div class="row"><input type="date" id="skip-from" data-keep="skip-from" aria-label="Fällt aus am oder von" style="flex:1 1 130px"><input type="date" id="skip-to" data-keep="skip-to" aria-label="bis (für einen Zeitraum)" style="flex:1 1 130px"><button type="button" class="btn" data-jt="skipadd">Ausfall eintragen</button></div><span class="sub">Ein Tag, oder ein Zeitraum wie die Semesterpause (zweites Feld = bis).</span></div>';
    }
  }
  return h;
}
// Teilaufgaben bzw. Projektschritte im Bearbeiten-Fenster
function jtEditExtra(it) {
  if (!it.id) return '';
  const row = (x, mv) => '<div class="task' + (x.done ? ' done' : '') + '"><input type="checkbox" aria-label="Erledigt: ' + esc(x.title) + '" data-toggle="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span class="tx">' + esc(x.title) + (x.est ? ' <span class="meta2">' + esc(estLabel(x.est)) + '</span>' : '') + '</span>' +
    (mv ? '<button type="button" class="star" data-jt="stepmv" data-id="' + esc(x.id) + '" data-n="-1" aria-label="Nach oben">↑</button><button type="button" class="star" data-jt="stepmv" data-id="' + esc(x.id) + '" data-n="1" aria-label="Nach unten">↓</button>' : '') + '</div>';
  if (it.type === 'project') {
    const st = projSteps(it.id);
    return '<div><h3 class="label" style="margin:4px 0">Schritte</h3>' + (st.length ? st.map(x => row(x, true)).join('') : '<p class="empty">Noch keine Schritte.</p>') +
      '<div class="addrow" style="margin-top:8px"><label class="sr" for="step-in">Neuer Schritt</label><input id="step-in" data-keep="step-in" placeholder="Neuer Schritt …" autocomplete="off"><button type="button" class="btn" data-jt="addstep">Hinzufügen</button></div>' +
      (sample || typeof projectStepsLocal === 'function' ? '<div class="row" style="margin-top:8px"><button type="button" class="btn ghost" data-jt="psplit">Schritte vorschlagen</button></div>' : '') + '</div>';
  }
  if (it.type === 'task' && !it.projectId && !it.parentId) {
    const ch = childrenOf(it.id);
    return '<div><h3 class="label" style="margin:4px 0">Teilaufgaben</h3>' + ch.map(x => row(x, false)).join('') +
      '<div class="addrow" style="margin-top:8px"><label class="sr" for="sub-in">Neue Teilaufgabe</label><input id="sub-in" data-keep="sub-in" placeholder="Teilaufgabe hinzufügen …" autocomplete="off"><button type="button" class="btn" data-jt="addsub">Hinzufügen</button></div></div>';
  }
  return '';
}

function taskLine(x) {
  const t = todayISO(), m = taskMeta(x);
  return '<div class="task"><input type="checkbox" aria-label="Erledigt: ' + esc(x.title) + '" data-toggle="' + esc(x.id) + '"><button class="tx" data-edit="' + esc(x.id) + '">' + (x.prio === 'hoch' ? '<b class="prio" aria-label="dringend">!</b> ' : '') + esc(x.title) + (x.links && x.links.length ? ' <span aria-label="mit Link" title="' + x.links.length + ' Link">🔗</span>' : '') + (x.files && x.files.length ? ' <span aria-label="mit Datei" title="' + x.files.length + ' Datei">📎</span>' : '') + (m ? '<small class="sub">' + esc(m) + '</small>' : '') + '</button>' +
    (x.date ? '<span class="due' + (x.date < t ? ' over' : '') + '">' + esc(relDay(x.date)) + '</span>' : '') + '</div>';
}
function waitRow(w) {
  const t = todayISO(), due = w.followUp && w.followUp <= t;
  const meta = [w.who ? 'von ' + w.who : '', w.since ? 'seit ' + relDay(w.since) : '', w.followUp ? 'nachhaken ' + relDay(w.followUp) : ''].filter(Boolean).join(' · ');
  return '<div class="listrow wrap"><button class="lt" data-edit="' + esc(w.id) + '">' + esc(w.title) + '<small' + (due ? ' style="color:var(--o);font-weight:600"' : '') + '>' + esc(meta) + '</small></button><span class="row">' +
    (due ? '<button class="btn" data-jt="wtask" data-id="' + esc(w.id) + '">Aufgabe draus</button><button class="btn" data-jt="wlater" data-id="' + esc(w.id) + '">In 3 Tagen</button>' : '') +
    '<button class="btn" data-jt="wdone" data-id="' + esc(w.id) + '">Erledigt</button></span></div>';
}
function waitingTile() {
  const d = waitingDue(); if (!d.length) return '';
  return '<section class="card" aria-labelledby="h-wt"><div class="row" style="justify-content:space-between"><h2 class="label" id="h-wt" style="margin:0">Nachhaken</h2><a class="btn ghost" href="#aufgaben" data-jt="tab" data-tab="warten">Alle</a></div>' + d.map(waitRow).join('') + '</section>';
}
function projCard(p) {
  const st = projSteps(p.id), done = st.filter(x => x.done).length, nx = nextStepOf(p.id);
  return '<article class="subj"><div class="row" style="justify-content:space-between"><h3>' + esc(p.title) + '</h3>' + (p.due ? '<span class="countdown' + (daysUntil(p.due) <= 7 ? ' soon' : '') + '">bis ' + esc(fmtShort(p.due)) + '</span>' : '') + '</div>' +
    '<div class="prog" role="img" aria-label="' + done + ' von ' + st.length + ' Schritten erledigt"><i style="width:' + (st.length ? Math.round(done / st.length * 100) : 0) + '%"></i></div>' +
    '<div class="meta">' + (p.area ? esc(AREAS[p.area]) + ' · ' : '') + done + ' von ' + st.length + ' Schritten</div>' +
    (nx ? '<div class="next"><span class="label" style="margin:0">Nächster Schritt</span><label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" class="jcb" data-toggle="' + esc(nx.id) + '" aria-label="Erledigt: ' + esc(nx.title) + '"><span style="font-weight:700">' + esc(nx.title) + (nx.est ? ' <span class="meta">· ' + esc(estLabel(nx.est)) + '</span>' : '') + '</span></label></div>'
      : '<div class="hint">' + (st.length ? 'Alle Schritte sind erledigt. Fehlt noch einer, oder ist das Projekt fertig?' : 'Bei diesem Projekt fehlt ein nächster Schritt.') + '</div>') +
    '<div class="row"><button class="btn" data-edit="' + esc(p.id) + '">Öffnen</button>' + (!nx && st.length ? '<button class="btn" data-jt="pdone" data-id="' + esc(p.id) + '">Projekt fertig</button>' : '') + '</div></article>';
}
function pageTasks() {
  const tab = S.taskTab || 'aufgaben', t = todayISO();
  const tabs = [['aufgaben', 'Aufgaben'], ['projekte', 'Projekte'], ['warten', 'Warte auf'], ['spaeter', 'Später']];
  const head = '<div class="pagehead"><div><h1 class="page">Aufgaben</h1></div><div class="seg" role="group" aria-label="Ansicht">' + tabs.map(([k, l]) => '<button data-jt="tab" data-tab="' + k + '" aria-pressed="' + (tab === k) + '">' + l + (k === 'warten' && waitingDue().length ? ' (' + waitingDue().length + ')' : '') + '</button>').join('') + '</div></div>';
  let body = '';
  if (tab === 'projekte') {
    const ps = byType('project'), open = ps.filter(p => !p.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')), done = ps.filter(p => p.done);
    body = '<div class="row" style="justify-content:flex-end"><button class="btn primary" data-new="project">+ Projekt</button></div>' +
      (open.length ? '<div class="subjects">' + open.map(projCard).join('') + '</div>' : '<section class="card"><p class="empty">Noch keine Projekte. Ein Projekt ist etwas Größeres mit mehreren Schritten, z. B. „Hausarbeit Sachunterricht“ oder „Saisonabschluss U13“.</p></section>') +
      (done.length ? '<section class="card"><h2 class="label">Abgeschlossen</h2>' + done.map(p => '<div class="listrow"><button class="lt" data-edit="' + esc(p.id) + '">' + esc(p.title) + '<small>' + projSteps(p.id).length + ' Schritte</small></button><button class="btn ghost" data-jt="preopen" data-id="' + esc(p.id) + '">Wieder öffnen</button></div>').join('') + '</section>' : '');
  } else if (tab === 'warten') {
    const list = waitingOpen(), doneW = byType('waiting').filter(w => w.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    body = '<form class="card" data-form="jwait" style="display:flex;flex-direction:column;gap:10px"><h2 class="label" style="margin:0">Worauf wartest du?</h2><div class="formgrid">' +
      '<label class="field"><span>Worauf?</span><input name="title" data-keep="jw-title" placeholder="z. B. Zusage für den Praktikumsplatz" autocomplete="off"></label>' +
      '<label class="field"><span>Von wem?</span><input name="who" data-keep="jw-who" placeholder="z. B. Frau Weber" autocomplete="off"></label>' +
      '<label class="field"><span>Nachhaken am</span><input type="date" name="followUp" value="' + addDays(t, 5) + '"></label></div>' +
      '<div class="row"><button class="btn primary" type="submit">Eintragen</button><span class="sub">Jarvis schreibt dabei niemandem, er erinnert nur dich.</span></div></form>' +
      '<section class="card"><h2 class="label">Offen</h2>' + (list.length ? list.map(waitRow).join('') : '<p class="empty">Du wartest gerade auf nichts.</p>') + '</section>' +
      (doneW.length ? '<section class="card"><h2 class="label">Erledigt</h2>' + doneW.slice(0, 10).map(w => '<div class="listrow"><button class="lt" data-edit="' + esc(w.id) + '">' + esc(w.title) + '<small>' + esc(w.who || '') + '</small></button></div>').join('') + '</section>' : '');
  } else if (tab === 'spaeter') {
    const list = somedayList();
    body = '<form class="addrow" data-form="jsome"><label class="sr" for="js-in">Für später merken</label><input id="js-in" data-keep="js-in" placeholder="Für später merken …" autocomplete="off"><button class="btn primary" type="submit">Merken</button></form>' +
      '<section class="card">' + (list.length ? list.map(x => '<div class="listrow wrap"><button class="lt" data-edit="' + esc(x.id) + '">' + esc(x.title) + '<small>' + (x.type === 'idea' ? 'Idee' : 'Aufgabe') + (x.createdAt ? ' · seit ' + esc(fmtShort(isoDate(new Date(x.createdAt)))) : '') + '</small></button><span class="row"><button class="btn" data-jt="sgo" data-id="' + esc(x.id) + '">Jetzt angehen</button><button class="btn ghost danger" data-jt="sdel" data-id="' + esc(x.id) + '">Streichen</button></span></div>').join('')
        : '<p class="empty">Nichts auf „später vielleicht“. Was hier steht, landet nie in deinem Tagesplan.</p>') + '</section>';
  } else {
    const b = taskBuckets(), F = S.tf || {};
    const pass = x => (!F.area || x.area === F.area) && (!F.prio || (x.prio || 'normal') === F.prio) && (!F.est || (x.est && Number(x.est) <= Number(F.est))) && (!F.ctx || !x.ctx || x.ctx === F.ctx);
    const groups = [['Überfällig', b.over], ['Heute', b.today], ['Nächste 7 Tage', b.soon], ['Später', b.later], ['Ohne Datum', b.none]].map(([l, xs]) => [l, xs.filter(pass)]).filter(([, xs]) => xs.length);
    const fsel = (k, label, opts) => '<label class="field"><span>' + label + '</span><select data-jf="' + k + '">' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + ((F[k] || '') === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>';
    body = '<form class="addrow" data-form="jtask"><label class="sr" for="jt-in">Neue Aufgabe</label><input id="jt-in" data-keep="jt-in" placeholder="Neue Aufgabe …" autocomplete="off"><button class="btn primary" type="submit">Hinzufügen</button></form>' +
      '<div class="row"><button class="btn" data-jt="quick">Was schaffe ich in 25 Min.?</button><button class="btn ghost" data-new="task">Mit Details anlegen</button></div>' +
      '<div class="formgrid">' + fsel('area', 'Bereich', [['', 'alle'], ...Object.entries(AREAS)]) + fsel('prio', 'Wie dringend', [['', 'alle'], ...Object.entries(PRIO)]) + fsel('est', 'Dauer bis', [['', 'egal'], ['15', '15 Min.'], ['30', '30 Min.'], ['60', '1 Std.'], ['120', '2 Std.']]) + fsel('ctx', 'Wo', [['', 'überall'], ...Object.entries(CTX)]) + '</div>' +
      '<div class="row" style="justify-content:flex-end"><div class="seg" role="group" aria-label="Darstellung">' + [['liste', 'Liste'], ['spalten', 'Spalten']].map(([v, l]) => '<button data-tview2="' + v + '" aria-pressed="' + ((S.settings.taskView || 'liste') === v) + '">' + l + '</button>').join('') + '</div></div>' +
      (S.settings.taskView === 'spalten' ? taskBoard(groups.reduce((a, [, xs]) => a.concat(xs), []), pass) :
      '<section class="card">' + (groups.length ? groups.map(([l, xs]) => '<div class="group"><h3>' + l + '</h3>' + xs.map(taskLine).join('') + '</div>').join('') : '<p class="empty">' + (Object.values(F).some(Boolean) ? 'Keine Aufgabe passt zum Filter.' : 'Keine offenen Aufgaben.') + '</p>') + '</section>');
  }
  return '<div class="listpage" style="max-width:' + (tab === 'projekte' || (tab === 'aufgaben' && S.settings.taskView === 'spalten') ? '1100px' : '860px') + '">' + head + body + '</div>';
}
// Aufgaben in Spalten: Zu tun → In Arbeit → Erledigt (Feld stage 'doing'; erledigt = done)
const STAGES = [['todo', 'Zu tun'], ['doing', 'In Arbeit'], ['done', 'Erledigt']];
function taskBoard(open, pass) {
  const t = todayISO(), since = addDays(t, -7);
  const done = byType('task').filter(x => x.done && x.doneAt && isoDate(new Date(x.doneAt)) >= since && pass(x)).sort((a, b) => b.doneAt.localeCompare(a.doneAt)).slice(0, 15);
  const col = { todo: open.filter(x => x.stage !== 'doing'), doing: open.filter(x => x.stage === 'doing'), done };
  const card = (x, k) => { const i = STAGES.findIndex(s => s[0] === k), m = k === 'done' ? '' : taskMeta(x);
    return '<div class="bcard"><button class="tx" data-edit="' + esc(x.id) + '"><span>' + (x.prio === 'hoch' && k !== 'done' ? '<b class="prio" aria-label="dringend">!</b> ' : '') + esc(x.title) + (x.links && x.links.length ? ' 🔗' : '') + (x.files && x.files.length ? ' 📎' : '') + '</span>' + (m ? '<small class="sub">' + esc(m) + '</small>' : '') + (x.date && k !== 'done' ? '<small class="due' + (x.date < t ? ' over' : '') + '">' + esc(relDay(x.date)) + '</small>' : '') + '</button>' +
      '<span class="bmv">' + (i > 0 ? '<button class="iconbtn" data-bmove="' + esc(x.id) + '|' + STAGES[i - 1][0] + '" aria-label="Zurück nach ' + STAGES[i - 1][1] + '">' + ICON.chevl + '</button>' : '') + (i < 2 ? '<button class="iconbtn" data-bmove="' + esc(x.id) + '|' + STAGES[i + 1][0] + '" aria-label="Weiter nach ' + STAGES[i + 1][1] + '">' + ICON.chev + '</button>' : '') + '</span></div>'; };
  return '<div class="board">' + STAGES.map(([k, l]) => '<section class="card bcol" aria-label="' + l + '"><h2 class="label">' + l + ' <span class="sub">' + col[k].length + '</span></h2>' + (col[k].length ? col[k].map(x => card(x, k)).join('') : '<p class="empty">' + (k === 'doing' ? 'Schieb hierher, woran du gerade sitzt.' : k === 'done' ? 'In den letzten 7 Tagen noch nichts.' : 'Nichts offen.') + '</p>') + '</section>').join('') + '</div>';
}
// Wird eine wiederkehrende Aufgabe wieder „offen“, fliegt die schon angelegte nächste Wiederholung raus (sonst steht sie doppelt da)
async function dropNextRepeat(it) {
  const nx = it.nextId && S.items.find(i => i.id === it.nextId);
  if (!nx || nx.done || nx.type !== 'task') return null;
  await removeItem(nx); return nx;
}
async function boardMove(id, to) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  const upd = { ...it }; delete upd.stage;
  if (to === 'doing') upd.stage = 'doing';
  if (to === 'done') { upd.done = true; upd.doneAt = new Date().toISOString(); } else if (it.done) { upd.done = false; delete upd.doneAt; delete upd.nextId; }
  await store.setItem(upd);
  const gone = to !== 'done' && it.done ? await dropNextRepeat(it) : null;
  if (gone) { showToast('Wieder offen. Die nächste Wiederholung ist wieder weg.', async () => { await store.setItem(it); await restoreItem(gone); }); return; }
  if (to === 'done' && !it.done && (it.repeat || it.repeatDays) && !it.nextId) { const nx = nextRepeat(it); if (nx) { await store.setItem(nx); await store.setItem({ ...upd, nextId: nx.id }); if (nx.remindAt) calSync(nx); } }
  if (it.remindAt && it.gcalId && (to === 'done') !== !!it.done) calSync(upd, it);
  showToast(to === 'done' ? 'Erledigt.' : to === 'doing' ? 'In Arbeit.' : 'Zurück zu „Zu tun“.', () => store.setItem(it));
}
async function splitProject(p) {
  if (!p || !p.id || (!sample && typeof projectStepsLocal !== 'function')) return;
  S.editing = null; S.busy = true; S.status = 'Jarvis überlegt sich Schritte …'; render();
  try {
    const have = projSteps(p.id).map(x => '- ' + x.title + (x.done ? ' (erledigt)' : '')).join('\n') || '(noch keine)';
    const res = !sample ? { steps: projectStepsLocal(p) } : await sample.json('Zerlege dieses Projekt eines Studenten in 3 bis 8 konkrete, gut machbare Schritte in sinnvoller Reihenfolge. Jeder Schritt beginnt mit einem Verb und ist in einer Sitzung machbar. Schätze die Dauer in Minuten.\nProjekt: ' + p.title + (p.note ? ' – ' + p.note : '') + (p.due ? '\nZiel bis: ' + p.due : '') + '\nVorhandene Schritte (nicht wiederholen):\n' + have + '\nAntworte NUR mit JSON: {"steps":[{"title":"…","est":30}]}', { cache: false });
    let n = projSteps(p.id).reduce((m, x) => Math.max(m, Number(x.step) || 0), 0);
    const steps = (res && Array.isArray(res.steps) ? res.steps : []).filter(x => x && x.title).slice(0, 10).map(x => {
      const it = { type: 'task', title: String(x.title).slice(0, 160), projectId: p.id, step: ++n };
      const e = ESTS.find(m => m >= Number(x.est)); if (e) it.est = String(e); if (p.area) it.area = p.area; return it;
    });
    if (!steps.length) throw new Error('leer');
    S.pending = { text: 'Schritte für: ' + p.title, reply: 'So würde ich „' + p.title + '“ aufteilen:', items: steps, fromNote: null };
  } catch (e) { showToast('Vorschlag ging gerade nicht.'); }
  S.busy = false; S.status = ''; render();
}
function jtContext() {
  const w = waitingOpen().map(x => '- ' + x.title + (x.who ? ' (von ' + x.who + ')' : '') + (x.followUp ? ', nachhaken ' + x.followUp : '')).join('\n');
  const p = byType('project').filter(x => !x.done).map(x => { const n = nextStepOf(x.id); return '- ' + x.title + ': nächster Schritt ' + (n ? n.title : 'fehlt'); }).join('\n');
  return (w ? '\nWarte auf:\n' + w : '') + (p ? '\nProjekte:\n' + p : '');
}

/* ----- Was schaffe ich in X Minuten? ----- */
function quickList(min, ctx) {
  const t = todayISO(), pr = { hoch: 0, normal: 1, niedrig: 2 };
  const key = x => [x.date && x.date < t ? 0 : 1, x.date || '9999', pr[x.prio || 'normal'] ?? 1];
  const cmp = (a, b) => { const A = key(a), B = key(b); for (let i = 0; i < 3; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; };
  const ok = openTasks().filter(x => !ctx || !x.ctx || x.ctx === ctx);
  const fit = ok.filter(x => x.est && Number(x.est) <= min).sort(cmp).slice(0, 5);
  const unk = fit.length < 5 ? ok.filter(x => !x.est).sort(cmp).slice(0, 5 - fit.length) : [];
  return { fit, unk };
}
function quickSheet() {
  const Q = S.quick, L = quickList(Q.min, Q.ctx);
  const row = x => '<div class="listrow"><span class="lt">' + esc(x.title) + '<small>' + esc([x.est ? estLabel(x.est) : 'Dauer nicht eingetragen', x.date ? 'fällig ' + relDay(x.date) : '', CTX[x.ctx] || '', x.prio === 'hoch' ? 'dringend' : ''].filter(Boolean).join(' · ')) + '</small></span><button class="btn" data-jt="qgo" data-id="' + esc(x.id) + '">Los</button></div>';
  return '<div class="overlay" data-close="quick"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="q-h"><h2 id="q-h">Was schaffe ich in ' + Q.min + ' Minuten?</h2>' +
    '<div class="chips" role="group" aria-label="Zeit">' + [10, 25, 45, 60].map(m => '<button data-jt="qmin" data-min="' + m + '" aria-pressed="' + (Q.min === m) + '">' + m + ' Min.</button>').join('') + '</div>' +
    '<div class="chips" role="group" aria-label="Wo bist du?">' + [['', 'Egal wo'], ...Object.entries(CTX)].map(([k, l]) => '<button data-jt="qctx" data-ctx="' + k + '" aria-pressed="' + ((Q.ctx || '') === k) + '">' + l + '</button>').join('') + '</div>' +
    (L.fit.length ? L.fit.map(row).join('') : '<p class="empty">Keine offene Aufgabe mit passender Dauer.</p>') +
    (L.unk.length ? '<h3 class="label" style="margin:6px 0 0">Ohne geschätzte Dauer</h3>' + L.unk.map(row).join('') : '') +
    '<p class="sub">„Los“ startet den Fokus-Timer. Tipp: Trag bei Aufgaben die Dauer ein, dann passen die Vorschläge besser.</p>' +
    '<div class="row actions"><button class="btn ghost" data-jt="qclose">Schließen</button></div></div></div>';
}

/* ===================== Planen: Feiertage, Fahrzeiten, freie Zeit ===================== */
const PLAN_DEF = { from: '08:00', to: '22:00', minBlock: 45, maxBlock: 90, maxDay: 180, buffer: 15, holidays: true,
  free: { 1: '22:00', 2: '22:00', 3: '22:00', 4: '22:00', 5: '22:00', 6: '22:00', 7: '22:00' },
  // Fahrt zur Uni/zum Büro schwankt (Auto 45–75 Min., Zug 1–2 Std.), deshalb vorsichtig gerechnet
  travel: [{ name: 'Uni / Büro', words: 'uni, campus, hörsaal, seminar, vorlesung, büro', min: 90 }, { name: 'Sportplatz', words: 'training, spiel, turnier, stausee, sportplatz', min: 10 }] };
function planCfg() { const p = S.settings.plan || {}; return { ...PLAN_DEF, ...p, free: { ...PLAN_DEF.free, ...(p.free || {}) }, travel: Array.isArray(p.travel) ? p.travel : PLAN_DEF.travel }; }
const minToHM = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return y + '-' + pad(mo) + '-' + pad(da);
}
const holCache = {};
function holidaysNRW(y) {
  if (holCache[y]) return holCache[y];
  const e = easter(y);
  return holCache[y] = { [y + '-01-01']: 'Neujahr', [addDays(e, -2)]: 'Karfreitag', [addDays(e, 1)]: 'Ostermontag', [y + '-05-01']: 'Tag der Arbeit', [addDays(e, 39)]: 'Christi Himmelfahrt', [addDays(e, 50)]: 'Pfingstmontag', [addDays(e, 60)]: 'Fronleichnam', [y + '-10-03']: 'Tag der Deutschen Einheit', [y + '-11-01']: 'Allerheiligen', [y + '-12-25']: '1. Weihnachtstag', [y + '-12-26']: '2. Weihnachtstag' };
}
function holidayOn(iso) { return planCfg().holidays === false ? null : holidaysNRW(Number(iso.slice(0, 4)))[iso] || null; }
// Vorlesung alle 2 Wochen: zählt ab der Woche des „Ab“-Datums
function classWeekOk(c, iso) {
  if (Number(c.every || 1) < 2) return true;
  const start = mondayOf(c.from || String(c.createdAt || iso).slice(0, 10));
  const wk = Math.round((dObj(mondayOf(iso)) - dObj(start)) / (7 * 864e5));
  return ((wk % 2) + 2) % 2 === 0;
}
// Fahrzeit (eine Strecke, Minuten) für einen Termin anhand der Stichwörter in den Einstellungen
function travelFor(b) {
  if (!b.start || (b.src && b.src.planned)) return 0;
  const hay = ((b.kind === 'class' ? 'vorlesung ' : '') + (b.kind === 'work' ? 'büro ' : '') + (isTeamBlock(b) ? 'training ' : '') + (b.title || '') + ' ' + (b.place || '')).toLowerCase();
  if (/homeoffice|online|zoom|digital/.test(hay)) return 0;
  let best = 0;
  planCfg().travel.forEach(t => { const ws = String(t.words || t.name || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean); if (ws.some(w => hay.includes(w))) best = Math.max(best, Number(t.min) || 0); });
  return best;
}
// Wann spätestens los? Fahrzeit aus den Planungs-Einstellungen + 10 Min. Reserve, nur wenn man nicht schon direkt vorher dort ist
function departures(iso) {
  const bl = blocksOn(iso).filter(b => b.start).sort((a, b) => a.start.localeCompare(b.start)), out = [];
  bl.forEach((b, i) => {
    const tr = travelFor(b); if (!tr) return;
    const s = hmToMin(b.start), prev = bl.slice(0, i).filter(x => x.end && hmToMin(x.end) > s - tr - 30 && hmToMin(x.end) <= s);
    if (prev.length) return;   // Termin direkt davor: dann ist man schon unterwegs bzw. vor Ort
    const at = Math.max(0, s - tr - 10), w = wxAt(iso, b.start);
    out.push({ b, tr, at: pad(Math.floor(at / 60)) + ':' + pad(at % 60), wet: !!(w && Number(w.rain) >= 50) });
  });
  return out.slice(0, 3);
}
function busyOn(iso) {
  const c = planCfg(), bl = blocksOn(iso);
  // Tag 2 … n eines mehrtägigen Termins (z. B. Trainingslager): ganz belegt, am letzten Tag bis zum Ende plus Rückfahrt.
  // Selbst eingetragene Termine an diesen Tagen gehen trotzdem, nur die automatische Planung legt nichts hinein.
  const multi = bl.filter(b => !b.start && b.kind === 'event' && b.src && b.src.dateEnd && b.src.dateEnd > b.src.date).map(b => {
    const last = iso === b.src.dateEnd && b.src.end, tr = last ? travelFor({ ...b, start: b.src.end, title: b.src.title }) : 0;
    return { s: 0, e: last ? Math.min(1440, hmToMin(b.src.end) + Math.max(tr, Number(c.buffer) || 0)) : 1440, b, tr };
  });
  return bl.filter(b => b.start).map(b => {
    const s = hmToMin(b.start), e = b.end ? hmToMin(b.end) : s + 60, tr = travelFor(b), pre = Math.max(tr, Number(c.buffer) || 0);
    return { s: s - pre, e: e + pre, b, tr };
  }).concat(multi);
}
// Freie Zeitfenster eines Tages (Minuten ab Mitternacht), ohne feste Termine, Fahrten, Puffer und geschützte Freizeit
function freeSlotsOn(iso, opt = {}) {
  const c = planCfg(), t = todayISO();
  if (iso < t) return [];
  const off = offOn(iso); if (off && off.kind === 'urlaub') return [];
  let from = hmToMin(c.from), to = hmToMin(c.to);
  const fr = c.free[dow(iso)];
  if (fr && !opt.useFree) to = Math.min(to, hmToMin(fr));
  if (iso === t) from = Math.max(from, Math.ceil((hmToMin(nowHM()) + 10) / 15) * 15);
  if (to - from < 15) return [];
  let slots = [{ s: from, e: to }];
  busyOn(iso).concat((opt.extra && opt.extra[iso]) || []).forEach(x => { slots = slots.flatMap(sl => x.e <= sl.s || x.s >= sl.e ? [sl] : [{ s: sl.s, e: x.s }, { s: x.e, e: sl.e }].filter(z => z.e - z.s >= 15)); });
  return slots.map(z => ({ s: Math.ceil(z.s / 15) * 15, e: Math.floor(z.e / 15) * 15 })).filter(z => z.e - z.s >= 15);
}
// Verteilt req.minutes zwischen req.from und req.to auf freie Lücken. Fester Rechenweg, keine KI.
function planHours(req, opt = {}) {
  const c = planCfg(), minB = opt.short ? 25 : Number(c.minBlock) || 45, maxB = Math.max(minB, Number(c.maxBlock) || 90), maxDay = Number(c.maxDay) || 180, buf = Number(c.buffer) || 0;
  const days = []; for (let d = req.from > todayISO() ? req.from : todayISO(), g = 0; d <= req.to && g < 60; d = addDays(d, 1), g++) days.push(d);
  let left = req.minutes; const blocks = [], used = {}, extra = {};
  days.forEach(d => { used[d] = byType('event').filter(e => e.planned && e.date === d).reduce((s, e) => s + durH(e.start, e.end) * 60, 0); });
  let placed = true;
  while (left > 0 && placed) {
    placed = false;
    for (const d of days) {
      if (left <= 0) break;
      const room = maxDay - used[d], want = Math.min(maxB, left, room), need = Math.min(minB, want);
      if (want < 15 || room < Math.min(minB, left)) continue;
      const sl = freeSlotsOn(d, { useFree: opt.useFree, extra }).find(z => z.e - z.s >= need);
      if (!sl) continue;
      const len = Math.floor(Math.min(want, sl.e - sl.s) / 15) * 15; if (len < need || len < 15) continue;
      blocks.push({ date: d, start: minToHM(sl.s), end: minToHM(sl.s + len), on: true });
      (extra[d] = extra[d] || []).push({ s: sl.s - buf, e: sl.s + len + buf });
      used[d] += len; left -= len; placed = true;
    }
  }
  blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { blocks, placed: req.minutes - Math.max(0, left), missing: Math.max(0, left) };
}
function whyText(req) {
  let fixed = 0, trav = 0;
  for (let d = req.from > todayISO() ? req.from : todayISO(); d <= req.to; d = addDays(d, 1)) busyOn(d).forEach(x => { fixed += durH(x.b.start, x.b.end || addMin(x.b.start, 60)); if (x.tr) trav += 2 * x.tr / 60; });
  return 'In dem Zeitraum sind schon ' + fmtH(fixed) + ' Std. fest verplant' + (trav ? ', dazu etwa ' + fmtH(trav) + ' Std. Fahrt' : '') + '. Deine geschützte Freizeit bleibt frei, und mehr als ' + fmtH(planCfg().maxDay / 60) + ' Std. am Tag plant Jarvis nicht ein.';
}

/* ----- Zeit einplanen mit ehrlicher Rückmeldung ----- */
function ppRange(P, opt) { const t = todayISO(), mon = mondayOf(t); const r = P.week === 'next' ? { from: addDays(mon, 7), to: addDays(mon, 13) } : { from: t, to: addDays(mon, 6) }; if (opt.next) r.to = addDays(r.to, 7); return r; }
function ppReq(P, opt) { const r = ppRange(P, opt); return { title: P.title, minutes: Math.max(15, Math.round(P.hours * 4) * 15), from: r.from, to: r.to }; }
function openPPlan(p) {
  p = p || {};
  const title = String(p.title || 'Lernen').slice(0, 80);
  S.pplan = { title, hours: Math.max(0.25, Math.min(40, Number(String(p.hours ?? 4).replace(',', '.')) || 4)), week: p.week === 'next' ? 'next' : 'this', area: AREAS[p.area] ? p.area : (/lern|uni|klausur|seminar|hausarbeit/i.test(title) ? 'uni' : ''), opt: {}, res: null, k: Date.now() % 1e6 };
  runPPlan(); render();
}
function runPPlan() {
  const P = S.pplan; P.req = ppReq(P, P.opt); P.res = planHours(P.req, P.opt);
  const ALT = [['next', 'Rest in die nächste Woche legen'], ['short', 'Auch kürzere Blöcke (ab 25 Min.)'], ['free', 'Geschützte Freizeit mitnutzen']];
  P.alts = P.res.missing ? ALT.filter(([k]) => !P.opt[k]).map(([k, l]) => { const o = { ...P.opt, [k]: true }, opt = { short: o.short, useFree: o.free }; return [k, l, planHours(ppReq(P, o), opt)]; }).filter(([, , x]) => x.placed > P.res.placed) : [];
  P.res.opt = { short: P.opt.short, useFree: P.opt.free };
  if (P.opt.short || P.opt.free) P.res = { ...planHours(P.req, P.res.opt), opt: P.res.opt };
}
function pplanSheet() {
  const P = S.pplan, R = P.res, h = m => fmtH(m / 60), n = R ? R.blocks.filter(b => b.on).length : 0;
  const form = '<div class="formgrid"><label class="field"><span>Was?</span><input data-pp="title" data-keep="pp-title' + P.k + '" value="' + esc(P.title) + '"></label>' +
    '<label class="field"><span>Wie viele Stunden?</span><input type="number" min="0.25" max="40" step="0.25" inputmode="decimal" data-pp="hours" data-keep="pp-hours' + P.k + '" value="' + esc(P.hours) + '"></label>' +
    '<label class="field"><span>Wann?</span><select data-pp="week"><option value="this"' + (P.week === 'this' ? ' selected' : '') + '>Diese Woche</option><option value="next"' + (P.week === 'next' ? ' selected' : '') + '>Nächste Woche</option></select></label>' +
    '<label class="field"><span>Bereich</span><select data-pp="area">' + [['', '—'], ...Object.entries(AREAS)].map(([v, l]) => '<option value="' + v + '"' + ((P.area || '') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label></div>' +
    '<div class="row"><button class="btn" data-jt="pprun">Neu berechnen</button></div>';
  let out = '';
  if (R) {
    const ok = !R.missing;
    out = '<div class="hint ' + (ok ? 'okbox' : 'warnbox') + '"><b>' + (ok ? 'Passt: alle ' + h(R.placed) + ' Std. finden Platz.' : (R.placed ? 'Es passen nur ' + h(R.placed) + ' von ' + h(P.req.minutes) + ' Std.' : 'Es passt leider nichts.') + ' Es fehlen ' + h(R.missing) + ' Std.') + '</b>' + (ok ? '' : '<span>' + esc(whyText(P.req)) + '</span>') + '</div>' +
      (P.alts.length ? '<div><p class="sub" style="margin-bottom:6px">Mögliche Auswege:</p><div class="row">' + P.alts.map(([k, l, x]) => '<button class="btn" data-jt="ppalt" data-k="' + k + '">' + esc(l) + ' · dann ' + h(x.placed) + ' Std.</button>').join('') + '</div></div>' : '') +
      (Object.keys(P.opt).length ? '<div class="row"><span class="sub">Berücksichtigt: ' + Object.keys(P.opt).map(k => ({ next: 'auch nächste Woche', short: 'kürzere Blöcke', free: 'geschützte Freizeit' })[k]).join(', ') + '</span><button class="btn ghost" data-jt="ppreset">Zurücksetzen</button></div>' : '') +
      (mcp && S.gcalState !== 'ok' ? '<p class="sub">Achtung: Dein Google Kalender ist gerade nicht geladen. Termine von dort fehlen in der Rechnung.</p>' : '') +
      (R.blocks.length ? '<div>' + R.blocks.map((b, i) => '<label class="pick"><input type="checkbox" data-ppi="' + i + '"' + (b.on ? ' checked' : '') + '><span>' + esc(fmtShort(b.date)) + ', ' + esc(b.start) + '–' + esc(b.end) + ' Uhr<br><small class="sub">' + h(hmToMin(b.end) - hmToMin(b.start)) + ' Std.</small></span></label>').join('') + '</div>' : '');
  }
  return '<div class="overlay" data-close="pplan"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pp-h"><h2 id="pp-h">Zeit einplanen</h2>' + form + out +
    '<div class="row actions"><button class="btn ghost" data-jt="ppclose">Verwerfen</button><button class="btn primary" data-jt="ppok"' + (n ? '' : ' disabled') + '>' + (n === 1 ? '1 Block' : n + ' Blöcke') + ' übernehmen</button></div></div></div>';
}
async function applyPPlan() {
  const P = S.pplan; if (!P || !P.res) return;
  const ts = new Date().toISOString(), made = [], title = String(P.title || 'Lernen').trim().slice(0, 120) || 'Lernen';
  for (const b of P.res.blocks.filter(x => x.on)) { const it = { id: uid(), type: 'event', title, date: b.date, start: b.start, end: b.end, planned: true, createdAt: ts }; if (P.area) it.area = P.area; await withRetry(() => store.setItem(it)); calSync(it); made.push(it); }
  if (made.length) logAct(made.length + (made.length === 1 ? ' Block' : ' Blöcke') + ' „' + title + '“ eingeplant', { created: made.map(i => i.id) });
  S.pplan = null; render();
  showToast(made.length === 1 ? '1 Block eingetragen.' : made.length + ' Blöcke eingetragen.', async () => { for (const it of made) await removeItem(S.items.find(x => x.id === it.id) || it); });
}

/* ----- Umplanen ----- */
function openReplan(reason) { S.quick = null; S.replan = { date: todayISO(), reason: reason || 'platt', moves: null, freed: 0 }; computeReplan(); render(); }
function computeReplan() {
  const R = S.replan, t = R.date, now = hmToMin(nowHM()), extra = {}, moves = [];
  byType('event').filter(e => e.planned && e.date === t && e.start && (hmToMin(e.end || e.start) ?? 0) > now).sort((a, b) => a.start.localeCompare(b.start)).forEach(e => {
    const len = Math.round(durH(e.start, e.end) * 60) || 60; let to = null;
    for (let i = 1; i <= 7 && !to; i++) { const d = addDays(t, i), sl = freeSlotsOn(d, { extra }).find(z => z.e - z.s >= len); if (sl) { to = { date: d, start: minToHM(sl.s), end: minToHM(sl.s + len) }; (extra[d] = extra[d] || []).push({ s: sl.s - 15, e: sl.s + len + 15 }); } }
    moves.push({ id: e.id, title: e.title, from: e.start, to, on: !!to });
  });
  openTasks().filter(x => x.doDate && x.doDate <= t && !(x.date && x.date <= t) && x.prio !== 'hoch').forEach(x => moves.push({ id: x.id, title: x.title, task: true, to: { date: addDays(t, 1) }, on: true }));
  R.moves = moves;
}
function replanSheet() {
  const R = S.replan, t = R.date, now = hmToMin(nowHM());
  const reasons = [['platt', 'Bin platt'], ['ausfall', 'Etwas fällt aus oder verschiebt sich'], ['neu', 'Neuer Termin']];
  let body = '', act = '';
  if (R.reason === 'platt') {
    const fixed = blocksOn(t).filter(b => b.start && !(b.src && b.src.planned) && (hmToMin(b.end || b.start) ?? 0) > now);
    const dueToday = openTasks().filter(x => x.date && x.date <= t);
    body = (R.moves.length ? '<p class="sub">Das kann warten. Haken weg bei allem, was doch bleiben soll.</p>' + R.moves.map((m, i) => '<label class="pick"><input type="checkbox" data-rpi="' + i + '"' + (m.on ? ' checked' : '') + (m.to ? '' : ' disabled') + '><span>' + esc(m.title) + '<br><small class="sub">' + (m.task ? 'auf morgen' : m.to ? 'heute ' + esc(m.from) + ' → ' + esc(fmtShort(m.to.date)) + ', ' + esc(m.to.start) + '–' + esc(m.to.end) : 'kein freier Platz in den nächsten 7 Tagen') + '</small></span></label>').join('')
        : '<p class="empty">Heute ist nichts Bewegliches mehr geplant. Gönn dir die Pause.</p>') +
      (fixed.length || dueToday.length ? '<div><h3 class="label" style="margin:6px 0 2px">Bleibt fest</h3><p class="sub">' + esc(fixed.map(b => b.start + ' ' + b.title).concat(dueToday.map(x => x.title + ' (heute fällig)')).join(' · ')) + '</p></div>' : '');
    const n = R.moves.filter(m => m.on && m.to).length;
    act = '<button class="btn primary" data-jt="rpok"' + (n ? '' : ' disabled') + '>' + n + ' verschieben</button>';
  } else if (R.reason === 'ausfall') {
    const list = blocksOn(t).filter(b => b.start && (hmToMin(b.end || b.start) ?? 0) > now);
    body = (list.length ? list.map(b => '<div class="listrow wrap"><span class="lt">' + esc(b.start) + ' ' + esc(b.title) + '<small>' + (b.ro ? (canMove(b) ? 'Google Kalender' : 'Aus deinem ' + esc(calLabel(b)) + '-Kalender, dort ändern') : b.kind === 'class' ? 'Vorlesung' : b.kind === 'work' ? 'Arbeit' : 'Termin') + '</small></span>' +
        (b.ro ? (canMove(b) ? '<span class="row"><button class="btn ghost" data-move="' + esc(b.id) + '">Verschieben</button></span>' : '') : '<span class="row"><button class="btn" data-jt="rpcancel" data-id="' + esc(b.id) + '">Fällt heute aus</button>' + (b.kind !== 'class' ? '<button class="btn ghost" data-edit="' + esc(b.id) + '">Verschieben</button>' : '') + '</span>') + '</div>').join('')
      : '<p class="empty">Heute steht nichts mehr an.</p>') +
      (R.freed ? '<div class="hint okbox">Frei geworden: ' + esc(fmtMin(R.freed)) + '.<div class="row"><button class="btn" data-jt="quick" data-min="' + Math.min(60, Math.max(10, R.freed)) + '">Was schaffe ich in der Zeit?</button></div></div>' : '');
  } else {
    body = '<p>Trag den neuen Termin ein. Passt er nicht mehr zu deinen geplanten Blöcken, tipp danach auf „Bin platt“, dann schiebt Jarvis die beweglichen Sachen weiter.</p><div class="row"><button class="btn" data-new="event">+ Termin</button></div>';
  }
  return '<div class="overlay" data-close="replan"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rp-h"><h2 id="rp-h">Heute umplanen</h2>' +
    '<div class="chips" role="group" aria-label="Was ist los?">' + reasons.map(([k, l]) => '<button data-jt="rpreason" data-r="' + k + '" aria-pressed="' + (R.reason === k) + '">' + l + '</button>').join('') + '</div>' + body +
    '<p class="sub">Feste Termine verschiebt Jarvis nie von selbst.</p><div class="row actions"><button class="btn ghost" data-jt="rpclose">Schließen</button>' + act + '</div></div></div>';
}
async function applyReplan() {
  const R = S.replan; if (!R || !R.moves) return; const before = [];
  for (const m of R.moves.filter(x => x.on && x.to)) {
    const it = S.items.find(i => i.id === m.id); if (!it) continue; before.push(it);
    const upd = m.task ? { ...it, doDate: m.to.date } : { ...it, date: m.to.date, start: m.to.start, end: m.to.end };
    await store.setItem(upd); if (!m.task) calSync(upd, it);
  }
  if (before.length) logAct('Umgeplant: ' + before.map(i => i.title).join(', ') + ' verschoben', { restore: before });
  S.replan = null; render();
  showToast(before.length + ' verschoben.', async () => { for (const it of before) { await store.setItem(it); if (it.type === 'event') calSync(it, it); } });
}
async function cancelToday(id) {
  const R = S.replan, it = S.items.find(i => i.id === id); if (!it || !R) return;
  const len = Math.round(durH(it.start, it.end) * 60) || 60;
  if (it.type === 'class') { const upd = { ...it, skip: Array.from(new Set([...(it.skip || []), R.date])).sort() }; await store.setItem(upd); calSync(upd, it); logAct('„' + it.title + '“ fällt heute aus', { restore: [it] }); showToast('Fällt heute aus.', async () => { await store.setItem(it); calSync(it, upd); }); }
  else { await removeItem(it); logAct('„' + it.title + '“ heute abgesagt (liegt im Papierkorb)', { restore: [it] }); showToast('Entfernt (liegt im Papierkorb).', () => restoreItem(it)); }
  R.freed = (R.freed || 0) + len; render();
}

/* ----- Monatsansicht ----- */
const viewSeg = () => '<div class="seg" role="group" aria-label="Ansicht"><button data-jt="calview" data-v="woche" aria-pressed="' + (S.calView !== 'monat') + '">Woche</button><button data-jt="calview" data-v="monat" aria-pressed="' + (S.calView === 'monat') + '">Monat</button></div>';
function pageMonth() {
  const t = todayISO(), m0 = S.month || t.slice(0, 7) + '-01', y = Number(m0.slice(0, 4)), mo = Number(m0.slice(5, 7));
  const last = isoDate(new Date(y, mo, 0)), end = addDays(mondayOf(last), 6), cells = [];
  for (let d = mondayOf(m0); d <= end; d = addDays(d, 1)) cells.push(d);
  const head = '<div class="pagehead"><div><h1 class="page">' + MONL[mo - 1] + ' ' + y + '</h1></div><div class="row"><div class="weeknav"><button class="iconbtn" data-jt="mnav" data-n="-1" aria-label="Voriger Monat">' + ICON.chevl + '</button><button class="iconbtn" data-jt="mnav" data-n="1" aria-label="Nächster Monat">' + ICON.chev + '</button>' + (m0 !== t.slice(0, 7) + '-01' ? '<button class="btn ghost" data-jt="mnav" data-n="0">Heute</button>' : '') + '</div>' + viewSeg() + '<button class="btn" data-jt="pplan">Zeit einplanen</button></div></div>';
  return head + '<div class="month">' + ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => '<div class="mh" aria-hidden="true">' + x + '</div>').join('') + cells.map(d => {
    const bl = blocksOn(d), due = openTasks().filter(x => x.date === d).length;
    return '<button class="mday' + (d.slice(0, 7) !== m0.slice(0, 7) ? ' out' : '') + (d === t ? ' today' : '') + (offOn(d) || holidayOn(d) ? ' offday' : '') + '" data-jt="mday" data-d="' + d + '" aria-label="' + esc(fmtLong(d) + ': ' + (bl.length ? bl.map(b => (b.start ? b.start + ' ' : '') + b.title).join(', ') : 'frei')) + '"><span class="mn">' + dObj(d).getDate() + '</span>' +
      bl.slice(0, 3).map(b => '<span class="mb' + (isTransit(b) ? ' trip' : '') + '"><i class="' + (b.area ? 'a-' + esc(b.area) : '') + '"></i><span>' + esc((b.start ? b.start + ' ' : '') + b.title) + '</span></span>').join('') + (bl.length > 3 ? '<span class="mm">+' + (bl.length - 3) + '</span>' : '') + (due ? '<span class="mm">☐ ' + due + '</span>' : '') + '</button>';
  }).join('') + '</div>';
}

/* ----- Einstellungen: Planen ----- */
function planSettingsCard() {
  const c = planCfg();
  const freeOpts = [['', 'keine'], ['00:00', 'ganzer Tag'], ...['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'].map(h => [h + ':00', 'ab ' + h + ' Uhr'])];
  const fld = (name, label, val, type, attrs) => '<label class="field"><span>' + label + '</span><input name="' + name + '" type="' + type + '" value="' + esc(val) + '"' + (attrs || '') + '></label>';
  const tr = c.travel.concat([{ name: '', words: '', min: '' }]).slice(0, 6);
  return '<section class="card"><h2 class="label">Planen</h2><form data-form="jplan" style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="formgrid">' + fld('from', 'Lernen frühestens', c.from, 'time') + fld('to', 'Lernen spätestens', c.to, 'time') + fld('minBlock', 'Kürzester Block (Min.)', c.minBlock, 'number', ' min="15" max="240" step="5"') + fld('maxBlock', 'Längster Block (Min.)', c.maxBlock, 'number', ' min="15" max="480" step="5"') + fld('maxDay', 'Höchstens pro Tag (Std.)', String(c.maxDay / 60).replace('.', ','), 'text', ' inputmode="decimal"') + fld('buffer', 'Puffer zwischen Terminen (Min.)', c.buffer, 'number', ' min="0" max="120" step="5"') + '</div>' +
    '<fieldset style="border:0;padding:0;margin:0"><legend class="sub" style="margin-bottom:6px">Freizeit, die Jarvis nie verplant</legend><div class="formgrid">' + [1, 2, 3, 4, 5, 6, 7].map(d => '<label class="field"><span>' + WD[d % 7] + '</span><select name="free' + d + '">' + freeOpts.map(([v, l]) => '<option value="' + v + '"' + ((c.free[d] || '') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>').join('') + '</div></fieldset>' +
    '<fieldset style="border:0;padding:0;margin:0"><legend class="sub" style="margin-bottom:6px">Fahrzeit ab zuhause, je Strecke (lieber großzügig)</legend>' + tr.map((x, i) => '<div class="formgrid" style="margin-bottom:8px">' + fld('tn' + i, 'Ort', x.name, 'text', ' placeholder="z. B. Uni"') + fld('tw' + i, 'Stichwörter im Termin', x.words, 'text', ' placeholder="z. B. uni, campus"') + fld('tm' + i, 'Minuten', x.min, 'number', ' min="0" max="240" step="5"') + '</div>').join('') +
      '<p class="sub">Steht eins der Stichwörter im Titel oder Ort eines Termins, rechnet Jarvis die Fahrt davor und danach mit ein. Bei „Homeoffice“ oder „online“ nicht.</p></fieldset>' +
    '<label class="toggle"><input type="checkbox" name="holidays"' + (c.holidays !== false ? ' checked' : '') + '> Feiertage in NRW automatisch berücksichtigen</label>' +
    '<div class="row"><button class="btn primary" type="submit">Speichern</button></div></form></section>';
}

/* ----- Ereignisse dieses Bereichs ----- */
document.addEventListener('click', async (ev) => {
  const hb = ev.target.closest('[data-hint="go"][data-id^="tab:"]');
  if (hb) { S.taskTab = hb.dataset.id.slice(4); if (S.taskTab === 'spaeter') markSomedaySeen(); }
  const el = ev.target.closest('[data-jt]'); if (!el) return;
  ev.preventDefault();
  const a = el.dataset.jt, id = el.dataset.id, it = id ? S.items.find(i => i.id === id) : null, ts = new Date().toISOString();
  switch (a) {
    case 'tab': S.taskTab = el.dataset.tab; if (S.taskTab === 'spaeter') markSomedaySeen(); if (S.route !== 'aufgaben') go('aufgaben'); else render(); break;
    case 'quick': S.replan = null; S.quick = { min: Number(el.dataset.min) || S.quickMin || 25, ctx: S.quickCtx || '' }; render(); break;
    case 'qmin': if (S.quick) { S.quick.min = S.quickMin = Number(el.dataset.min); render(); } break;
    case 'qctx': if (S.quick) { S.quick.ctx = S.quickCtx = el.dataset.ctx; render(); } break;
    case 'qclose': S.quick = null; render(); break;
    case 'qgo': { const min = S.quick ? S.quick.min : 25; S.quick = null; if (S.focus) { render(); showToast('Es läuft schon ein Timer. Erst stoppen.'); break; } await startFocus({ dur: min, ref: id }); showToast('Fokus läuft: ' + min + ' Min.'); break; }
    case 'wdone': if (it) { await store.setItem({ ...it, done: true, doneAt: ts }); showToast('Erledigt.', () => store.setItem(it)); } break;
    case 'wlater': if (it) { await store.setItem({ ...it, followUp: addDays(todayISO(), 3) }); showToast('Jarvis erinnert dich in 3 Tagen wieder.'); } break;
    case 'wtask': if (it) { const tk = { id: uid(), type: 'task', title: (it.who ? 'Bei ' + it.who + ' nachhaken: ' : 'Nachhaken: ') + it.title, date: todayISO(), est: '10', done: false, createdAt: ts }; await store.setItem(tk); await store.setItem({ ...it, followUp: addDays(todayISO(), 3) }); showToast('Aufgabe für heute angelegt.'); } break;
    case 'pdone': if (it) { await store.setItem({ ...it, done: true, doneAt: ts }); showToast('Projekt abgeschlossen.', () => store.setItem(it)); } break;
    case 'preopen': if (it) { const c = { ...it }; delete c.done; delete c.doneAt; await store.setItem(c); } break;
    case 'sgo': if (it) {
      if (it.type === 'idea') { const tk = { id: uid(), type: 'task', title: it.title, done: false, createdAt: ts }; if (it.note) tk.note = it.note; if (it.area) tk.area = it.area; await store.setItem(tk); await removeItem(it); showToast('Ist jetzt eine Aufgabe.', async () => { await store.delItem(tk.id); await restoreItem(it); }); }
      else { const c = { ...it }; delete c.status; await store.setItem(c); showToast('Ist jetzt bei deinen Aufgaben.', () => store.setItem(it)); }
    } break;
    case 'sdel': if (it) { await removeItem(it); showToast('Gestrichen.', () => restoreItem(it)); } break;
    case 'addstep': case 'addsub': {
      const inp = document.getElementById(a === 'addstep' ? 'step-in' : 'sub-in'), v = inp ? inp.value.trim() : '', E = S.editing;
      if (!v || !E || !E.id) return; inp.value = '';
      const nt = { id: uid(), type: 'task', title: v.slice(0, 200), done: false, createdAt: ts }; if (E.area) nt.area = E.area;
      if (a === 'addstep') { nt.projectId = E.id; nt.step = projSteps(E.id).reduce((m, x) => Math.max(m, Number(x.step) || 0), 0) + 1; } else { nt.parentId = E.id; if (E.date) nt.date = E.date; }
      await withRetry(() => store.setItem(nt)); setTimeout(() => { const f = document.getElementById(inp.id); f && f.focus(); }, 0); break;
    }
    case 'stepmv': if (it) {
      const st = projSteps(it.projectId), i = st.findIndex(x => x.id === it.id), j = i + Number(el.dataset.n);
      if (i < 0 || j < 0 || j >= st.length) return; [st[i], st[j]] = [st[j], st[i]];
      for (let k = 0; k < st.length; k++) if (Number(st[k].step) !== k + 1) await store.setItem({ ...st[k], step: k + 1 });
    } break;
    case 'psplit': splitProject(S.editing); break;
    case 'skipadd': {
      const E = S.editing; if (!E) return; const fEl = document.getElementById('skip-from'), tEl = document.getElementById('skip-to'), f = fEl && fEl.value, to = (tEl && tEl.value) || f;
      if (!f) { showToast('Bitte ein Datum wählen.'); return; } if (to < f) { showToast('„Bis“ liegt vor „Von“.'); return; }
      const set = new Set(E.skip || []); let n = 0; for (let d = f, g = 0; d <= to && g < 400; d = addDays(d, 1), g++) if (dow(d) === Number(E.weekday) && classWeekOk(E, d)) { set.add(d); n++; }
      E.skip = Array.from(set).sort(); fEl.value = ''; if (tEl) tEl.value = ''; render();
      showToast(n ? (n === 1 ? '1 Termin fällt' : n + ' Termine fallen') + ' aus. Zum Schluss „Speichern“ tippen.' : 'In dem Zeitraum findet die Veranstaltung nicht statt.'); break;
    }
    case 'skipdel': if (S.editing) { S.editing.skip = (S.editing.skip || []).filter(d => d !== el.dataset.d); render(); } break;
    case 'pplan': openPPlan(el.dataset.week === 'plan' && S.plan && S.plan.week > mondayOf(todayISO()) ? { week: 'next' } : {}); break;
    case 'pprun': if (S.pplan) { runPPlan(); render(); } break;
    case 'ppalt': if (S.pplan) { S.pplan.opt[el.dataset.k] = true; runPPlan(); render(); } break;
    case 'ppreset': if (S.pplan) { S.pplan.opt = {}; runPPlan(); render(); } break;
    case 'ppok': await applyPPlan(); break;
    case 'ppclose': S.pplan = null; render(); break;
    case 'replan': openReplan(); break;
    case 'rpreason': if (S.replan) { S.replan.reason = el.dataset.r; computeReplan(); render(); } break;
    case 'rpok': await applyReplan(); break;
    case 'rpcancel': await cancelToday(id); break;
    case 'rpclose': S.replan = null; render(); break;
    case 'calview': S.calView = el.dataset.v; if (S.calView === 'monat') S.month = curWeek().slice(0, 7) + '-01'; render(); fetchGcal(); break;
    case 'mnav': { const n = Number(el.dataset.n), m0 = S.month || todayISO().slice(0, 7) + '-01'; S.month = n === 0 ? todayISO().slice(0, 7) + '-01' : isoDate(new Date(Number(m0.slice(0, 4)), Number(m0.slice(5, 7)) - 1 + n, 1)); render(); fetchGcal(); break; }
    case 'mday': S.week = mondayOf(el.dataset.d); S.calView = 'woche'; render(); fetchGcal(); break;
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.jf) { S.tf = { ...(S.tf || {}), [el.dataset.jf]: el.value }; render(); return; }
  if (el.dataset.pp && S.pplan) { const k = el.dataset.pp; S.pplan[k] = k === 'hours' ? Math.max(0.25, Math.min(40, Number(String(el.value).replace(',', '.')) || 0.25)) : el.value; if (k === 'week' || k === 'hours') { runPPlan(); render(); } return; }
  if (el.dataset.ppi != null && S.pplan && S.pplan.res) { const b = S.pplan.res.blocks[Number(el.dataset.ppi)]; if (b) { b.on = el.checked; render(); } return; }
  if (el.dataset.rpi != null && S.replan && S.replan.moves) { const m = S.replan.moves[Number(el.dataset.rpi)]; if (m) { m.on = el.checked; render(); } return; }
});
document.addEventListener('submit', async (ev) => {
  const f = ev.target, kind = f.dataset.form;
  if (!['jtask', 'jwait', 'jsome', 'jplan'].includes(kind)) return;
  ev.preventDefault();
  const fd = new FormData(f), ts = new Date().toISOString();
  if (kind === 'jtask' || kind === 'jsome') {
    const inp = f.querySelector('input'), v = inp.value.trim(); if (!v) return; inp.value = '';
    const it = { id: uid(), type: 'task', title: v.slice(0, 200), done: false, createdAt: ts };
    if (kind === 'jsome') it.status = 'someday'; else if (S.tf && S.tf.area) it.area = S.tf.area;
    await withRetry(() => store.setItem(it)); showToast(kind === 'jsome' ? 'Für später gemerkt.' : 'Aufgabe angelegt.'); return;
  }
  if (kind === 'jwait') {
    const title = String(fd.get('title') || '').trim(); if (!title) { showToast('Bitte eintragen, worauf du wartest.'); return; }
    const fu = String(fd.get('followUp') || ''), it = { id: uid(), type: 'waiting', title: title.slice(0, 200), since: todayISO(), followUp: /^\d{4}-\d{2}-\d{2}$/.test(fu) ? fu : addDays(todayISO(), 5), done: false, createdAt: ts };
    const who = String(fd.get('who') || '').trim(); if (who) it.who = who.slice(0, 80);
    f.querySelectorAll('[data-keep]').forEach(x => { x.value = ''; });
    await withRetry(() => store.setItem(it)); showToast('Eingetragen. Jarvis erinnert dich ' + relDay(it.followUp) + '.'); return;
  }
  if (kind === 'jplan') {
    const num = (k, lo, hi, d) => { const n = Number(String(fd.get(k) ?? '').replace(',', '.')); return String(fd.get(k) ?? '').trim() === '' || isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
    const hm = (k, d) => /^\d{2}:\d{2}$/.test(String(fd.get(k) || '')) ? String(fd.get(k)) : d;
    const free = {}; for (let d = 1; d <= 7; d++) free[d] = String(fd.get('free' + d) || '');
    const travel = []; for (let i = 0; i < 6; i++) { const name = String(fd.get('tn' + i) || '').trim(); if (!name) continue; travel.push({ name: name.slice(0, 40), words: (String(fd.get('tw' + i) || '').trim() || name).slice(0, 200), min: num('tm' + i, 0, 240, 0) }); }
    const c = { from: hm('from', PLAN_DEF.from), to: hm('to', PLAN_DEF.to), minBlock: num('minBlock', 15, 240, 45), maxBlock: num('maxBlock', 15, 480, 90), maxDay: Math.round(num('maxDay', 0.5, 16, 3) * 60), buffer: num('buffer', 0, 120, 15), free, travel, holidays: fd.get('holidays') === 'on' };
    if (c.maxBlock < c.minBlock) c.maxBlock = c.minBlock;
    if (c.to <= c.from) { showToast('„Spätestens“ muss nach „frühestens“ liegen.'); return; }
    S.settings = { ...S.settings, plan: c }; await store.setSettings(S.settings); showToast('Gespeichert.'); render();
  }
});
document.addEventListener('keydown', (ev) => {
  const el = ev.target;
  if (ev.key === 'Enter' && el && (el.id === 'step-in' || el.id === 'sub-in')) { ev.preventDefault(); const b = document.querySelector('[data-jt="' + (el.id === 'step-in' ? 'addstep' : 'addsub') + '"]'); if (b) b.click(); return; }
  if (ev.key === 'Escape' && (S.quick || S.pplan || S.replan) && !S.editing && !S.pending) { S.quick = null; S.pplan = null; S.replan = null; render(); }
});
if (/[?&]jt=1/.test(location.search)) window.__jt = { planHours, freeSlotsOn, holidayOn, classWeekOk, quickList, taskBuckets, openTasks, travelFor, busyOn, openPPlan, openReplan };

/* ===================== Tagesplanung: Tagesstart und -abschluss, Blöcke in Lücken, Vorlagen, Eingabe ohne KI ===================== */
// Eigene Blöcke = Termine mit planned: true. Nur die rutschen nach; Vorlesungen, Arbeit, Training und alles aus Google bleiben fest.
const dpPlanned = d => byType('event').filter(e => e.planned && e.date === d && e.start && e.end).sort((a, b) => a.start.localeCompare(b.start));
const dpBlockOf = id => byType('event').find(e => e.planned && e.taskId === id && e.date >= todayISO()) || null;
const dpLen = x => Math.max(15, Math.min(240, Number(x && x.est) || 45));
const dpRit = () => S.settings.ritual || {};
async function dpRitDone(k) { S.settings = { ...S.settings, ritual: { ...dpRit(), [k]: todayISO() } }; await store.setSettings(S.settings); }
function dpFixed(d) { return busyOn(d).filter(x => !(x.b.src && x.b.src.planned)); }
function dpDayEnd(d) { const c = planCfg(), fr = c.free[dow(d)]; let to = hmToMin(c.to); if (fr) to = Math.min(to, hmToMin(fr)); return to; }

// Aufgabe als Block in den Tag legen: in eine bestimmte Lücke (gap) oder in die erste, in die sie passt
async function dpPlace(id, d, gap, quiet) {
  const x = S.items.find(i => i.id === id); if (!x) return null;
  d = d || todayISO();
  let len = dpLen(x), s = null;
  if (gap) { s = gap.s; len = Math.min(len, gap.e - gap.s); }
  else {
    const sl = freeSlotsOn(d), fit = sl.find(z => z.e - z.s >= len), big = sl.filter(z => z.e - z.s >= 25).sort((a, b) => (b.e - b.s) - (a.e - a.s))[0];
    if (fit) s = fit.s; else if (big) { s = big.s; len = big.e - big.s; }
  }
  if (s == null || len < 10) { if (!quiet) showToast((d === todayISO() ? 'Heute' : 'An dem Tag') + ' ist keine passende Lücke mehr frei.'); return null; }
  const it = { id: uid(), type: 'event', title: x.title, date: d, start: minToHM(s), end: minToHM(s + len), planned: true, taskId: x.id, createdAt: new Date().toISOString() };
  if (x.area) it.area = x.area;
  await withRetry(() => store.setItem(it)); calSync(it);
  if (!quiet) { logAct('In den Tag gelegt: ' + x.title, { created: [it.id] }); showToast('„' + x.title + '“ ' + relDay(d) + ' ' + it.start + '–' + it.end + ' eingeplant.', async () => { await removeItem(S.items.find(i => i.id === it.id) || it); }); }
  return it;
}
// Eigene Blöcke ab „from“ (Minuten) nach hinten schieben, bis sie nicht mehr mit festen Terminen kollidieren.
// Was heute nicht mehr passt, kommt auf den nächsten Tag mit einer passenden Lücke.
function dpReflow(d, from, skipId) {
  const fixed = dpFixed(d), to = dpDayEnd(d), out = [];
  let cur = from;
  dpPlanned(d).filter(e => e.id !== skipId && hmToMin(e.end) > from).forEach(e => {
    const len = hmToMin(e.end) - hmToMin(e.start);
    let s = Math.max(cur, hmToMin(e.start)), g = 0;
    while (g++ < 40) { s = Math.ceil(s / 5) * 5; const hit = fixed.find(x => x.s < s + len && x.e > s); if (!hit) break; s = hit.e; }
    if (s + len <= to) { if (s !== hmToMin(e.start)) out.push({ e, date: d, start: minToHM(s), end: minToHM(s + len) }); cur = s + len; }
    else out.push({ e, over: true, len });
  });
  const extra = {};
  out.filter(m => m.over).forEach(m => {
    for (let i = 1; i <= 7 && m.over; i++) { const dd = addDays(d, i), sl = freeSlotsOn(dd, { extra }).find(z => z.e - z.s >= m.len); if (sl) { Object.assign(m, { over: false, date: dd, start: minToHM(sl.s), end: minToHM(sl.s + m.len) }); (extra[dd] = extra[dd] || []).push({ s: sl.s - 15, e: sl.s + m.len + 15 }); } }
  });
  return out;
}
async function dpApplyMoves(moves, first) {
  const before = [];
  if (first) { before.push(first.old); await store.setItem(first.upd); calSync(first.upd, first.old); }
  for (const m of moves.filter(x => !x.over)) { before.push(m.e); const upd = { ...m.e, date: m.date, start: m.start, end: m.end }; await store.setItem(upd); calSync(upd, m.e); }
  return before;
}
// Laufender oder gerade beendeter eigener Block: länger brauchen, fertig
function dpCurrent() {
  const t = todayISO(), now = hmToMin(nowHM());
  return dpPlanned(t).find(e => hmToMin(e.start) <= now && hmToMin(e.end) + 45 >= now && !(e.taskId && (S.items.find(i => i.id === e.taskId) || {}).done) && e.dpDone !== t) || null;
}
function dpBar() {
  const e = dpCurrent(); if (!e) return '';
  const now = hmToMin(nowHM()), past = hmToMin(e.end) < now;
  return '<div class="dpbar" role="group" aria-label="Eigener Block"><span class="dpbt"><b>' + esc(e.title) + '</b><small>' + (past ? 'war bis ' + esc(e.end) + ' geplant' : 'läuft bis ' + esc(e.end)) + '</small></span><span class="row dpbb"><span class="sub dpq">Länger?</span>' +
    '<button class="btn sm" data-dp="more" data-id="' + esc(e.id) + '" data-n="15">+15 Min.</button><button class="btn sm" data-dp="more" data-id="' + esc(e.id) + '" data-n="30">+30 Min.</button>' +
    '<button class="btn sm primary" data-dp="fin" data-id="' + esc(e.id) + '">Fertig</button></span></div>';
}
async function dpMore(id, n) {
  const e = S.items.find(i => i.id === id); if (!e) return;
  const t = todayISO(), base = Math.max(hmToMin(e.end), hmToMin(nowHM())), newEnd = Math.min(base + n, 1435);
  const hit = dpFixed(t).find(x => x.s < newEnd && x.e > hmToMin(e.start) && x.s >= hmToMin(e.end) - 1);
  if (hit) { showToast('Danach kommt „' + hit.b.title + '“ um ' + hit.b.start + ' Uhr. Das bleibt fest, länger geht nur bis ' + minToHM(hit.s) + '.'); if (hit.s <= hmToMin(e.end)) return; }
  const end = hit ? hit.s : newEnd, upd = { ...e, end: minToHM(end) };
  const moves = dpReflow(t, end, e.id);
  const before = await dpApplyMoves(moves, { old: e, upd });
  const moved = moves.filter(m => !m.over), left = moves.filter(m => m.over);
  logAct('„' + e.title + '“ verlängert bis ' + upd.end + (moved.length ? ', ' + moved.length + ' Block/Blöcke nach hinten' : ''), { restore: before });
  showToast('Bis ' + upd.end + ' verlängert.' + (moved.length ? ' ' + (moved.length === 1 ? '1 eigener Block rutscht' : moved.length + ' eigene Blöcke rutschen') + ' nach hinten' + (moved.some(m => m.date !== t) ? ' (teils auf einen anderen Tag)' : '') + '.' : '') + (left.length ? ' ' + left.length + ' passt nirgends mehr, bitte selbst umplanen.' : ''), async () => { for (const it of before) { await store.setItem(it); calSync(it, it); } });
}
async function dpFin(id) {
  const e = S.items.find(i => i.id === id); if (!e) return;
  const t = todayISO(), x = e.taskId && S.items.find(i => i.id === e.taskId), before = [e];
  const now = hmToMin(nowHM()), upd = { ...e, dpDone: t };
  if (hmToMin(e.end) > now && now - hmToMin(e.start) >= 5) upd.end = minToHM(Math.ceil(now / 5) * 5);
  await store.setItem(upd); if (upd.end !== e.end) calSync(upd, e);
  if (x && !x.done) { before.push(x); await store.setItem({ ...x, done: true, doneAt: new Date().toISOString() }); }
  logAct('Fertig: ' + e.title, { restore: before });
  showToast('Erledigt.' + (upd.end !== e.end ? ' Ab jetzt ist die Zeit wieder frei.' : ''), async () => { for (const it of before) await store.setItem(it); if (upd.end !== e.end) calSync(e, upd); });
}

/* ----- Tagesvorlagen ----- */
const DP_TPL_DEF = [
  { id: 'uni', name: 'Uni-Tag', anchor: 'uni', lines: '30 Min. vorher: Unterlagen und Tasche checken (10 Min.)\nnachher: Mitschrift sortieren (20 Min.)' },
  { id: 'arbeit', name: 'Arbeitstag', anchor: 'arbeit', lines: '20 Min. vorher: Essen für die Pause einpacken (10 Min.)\nnachher: Arbeitszeit kurz prüfen (5 Min.)' },
  { id: 'team', name: 'Trainingstag', anchor: 'team', lines: '45 Min. vorher: Ablauf fürs Training ansehen (15 Min.)\n20 Min. vorher: Trainingstasche packen (10 Min.)\nnachher: Nachklapp notieren (10 Min.)' }
];
const dpTpls = () => (Array.isArray(S.settings.dayTpls) && S.settings.dayTpls.length ? S.settings.dayTpls : DP_TPL_DEF);
const dpAnchorHit = (a, b) => b.start && (a === 'team' ? isTeamBlock(b) : a === 'uni' ? (b.kind === 'class' || b.area === 'uni') : a === 'arbeit' ? (b.kind === 'work' || b.area === 'arbeit') : false) && !(b.src && b.src.planned);
// Eine Zeile: „16:00 Titel (15 Min.)“, „30 Min. vorher: Titel (10 Min.)“, „nachher: Titel (20 Min.)“
function dpParseLine(l) {
  l = String(l || '').trim(); if (!l) return null;
  let dur = 15; const dm = l.match(/\((\d{1,3})\s*(?:min\.?|minuten)?\)\s*$/i); if (dm) { dur = Math.max(5, Math.min(240, Number(dm[1]))); l = l.slice(0, dm.index).trim(); }
  let m;
  if ((m = l.match(/^(\d{1,2})[:.](\d{2})\s*(?:uhr)?\s*:?\s*(.+)$/i))) return { at: Number(m[1]) * 60 + Number(m[2]), title: m[3].trim(), dur };
  if ((m = l.match(/^(?:(\d{1,3})\s*(?:min\.?|minuten)\s*)?(vorher|davor|nachher|danach)\s*:?\s*(.+)$/i))) return { rel: /vor|dav/i.test(m[2]) ? 'pre' : 'post', off: Number(m[1] || 0), title: m[3].trim(), dur };
  return { title: l, dur, loose: true };
}
function dpTplPlan(tp, d) {
  const bl = blocksOn(d).filter(b => dpAnchorHit(tp.anchor, b)), first = bl[0], last = bl[bl.length - 1];
  return String(tp.lines || '').split('\n').map(dpParseLine).filter(Boolean).map(p => {
    let s = null, why = '';
    if (p.at != null) s = p.at;
    else if (p.rel === 'pre' && first) { const tr = travelFor(first); s = hmToMin(first.start) - tr - (p.off || p.dur); why = tr ? 'vor der Abfahrt' : 'vor ' + first.title; }
    else if (p.rel === 'post' && last) { const tr = travelFor(last); s = hmToMin(last.end || last.start) + tr + (p.off || 0); why = tr ? 'nach der Rückfahrt' : 'nach ' + last.title; }
    return { ...p, s: s != null && s >= 0 && s + p.dur <= 1435 ? Math.round(s / 5) * 5 : null, why };
  });
}
const dpTplUsed = (id, d) => byType('event').some(e => e.planned && e.tpl === id && e.date === d);
function dpTplFor(d) { return dpTpls().filter(tp => blocksOn(d).some(b => dpAnchorHit(tp.anchor, b))); }
function dpTplHint(d, k) {
  const tp = dpTplFor(d).find(x => !dpTplUsed(x.id, d)); if (!tp) return '';
  return '<div class="dphint"><span>' + (d === todayISO() ? 'Heute' : 'Morgen') + ' ist ein <b>' + esc(tp.name) + '</b>. Passenden Ablauf einfügen?</span><button class="btn sm" data-dp="tpl" data-d="' + esc(d) + '" data-tpl="' + esc(tp.id) + '"' + (k ? ' data-back="' + k + '"' : '') + '>Ansehen</button></div>';
}
async function dpTplApply(id, d) {
  const tp = dpTpls().find(x => x.id === id); if (!tp) return;
  const ts = new Date().toISOString(), made = [];
  for (const p of dpTplPlan(tp, d).filter(p => p.s != null)) {
    const it = { id: uid(), type: 'event', title: p.title, date: d, start: minToHM(p.s), end: minToHM(p.s + p.dur), planned: true, tpl: tp.id, createdAt: ts };
    if (tp.anchor) it.area = tp.anchor;
    await withRetry(() => store.setItem(it)); calSync(it); made.push(it);
  }
  if (!made.length) { showToast('Nichts eingefügt: Es fehlt der passende Termin an dem Tag.'); return; }
  logAct(tp.name + ' eingefügt (' + made.length + ' Blöcke)', { created: made.map(i => i.id) });
  showToast(made.length + ' Blöcke aus „' + tp.name + '“ eingefügt.', async () => { for (const it of made) await removeItem(S.items.find(i => i.id === it.id) || it); });
}
function dpTplCard() {
  return '<section class="card" id="dp-tpls"><h2 class="label">Tagesvorlagen</h2><p class="sub">Feste Abläufe für deine Tage. Jarvis erkennt den Tag an deinen Terminen (Vorlesung, Arbeit, Training) und schlägt die Vorlage vor. Eine Zeile pro Schritt, zum Beispiel <b>30 Min. vorher: Tasche packen (10 Min.)</b>, <b>nachher: Nachklapp (10 Min.)</b> oder <b>16:00 Wäsche aufhängen (15 Min.)</b>. „Vorher“ zählt ab der Abfahrt, wenn du hinfahren musst.</p>' +
    '<form data-dpform="tpls" class="dptplf">' + dpTpls().map((tp, i) => '<div class="dptple"><label class="field"><span>Name</span><input name="n' + i + '" id="dptn' + i + '" value="' + esc(tp.name) + '" autocomplete="off"></label><label class="field"><span>Erkennt den Tag an</span><select name="a' + i + '" id="dpta' + i + '">' + [['uni', 'Vorlesungen'], ['arbeit', 'Arbeit'], ['team', 'Training/Spiel'], ['', 'nichts (nur von Hand)']].map(([v, l]) => '<option value="' + v + '"' + ((tp.anchor || '') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><label class="field full"><span>Schritte</span><textarea name="l' + i + '" id="dptl' + i + '" rows="3">' + esc(tp.lines) + '</textarea></label></div>').join('') +
    '<div class="row"><button class="btn primary" type="submit">Speichern</button><button class="btn ghost" type="button" data-dp="tplreset">Zurücksetzen</button></div></form></section>';
}

/* ----- Tagesstart und Tagesabschluss in Schritten ----- */
function dpRitBox(k) {
  const t = todayISO(), done = dpRit()[k] === t;
  if (k === 'm') return done ? '<div class="dprit done"><span>Tag geplant.</span><button class="btn ghost sm" data-dp="m">Nochmal</button></div>' : '<div class="dprit"><span>Zwei Minuten für deinen Tag: liegen Gebliebenes sortieren, Top 3 wählen, prüfen, ob alles passt.</span><button class="btn sm primary" data-dp="m">Tag planen</button></div>';
  return done ? '<div class="dprit done"><span>Tag abgeschlossen. Schönen Feierabend.</span><button class="btn ghost sm" data-dp="e">Nochmal</button></div>' : '<div class="dprit"><span>Abhaken, Rest verteilen, morgen vorbereiten, Kopf leeren.</span><button class="btn sm primary" data-dp="e">Tag abschließen</button></div>';
}
const DP_STEPS = { m: ['Liegen geblieben', 'Heute', 'Passt das?', 'Los geht’s'], e: ['Geschafft', 'Offen geblieben', 'Morgen', 'Kopf leeren'] };
function dpLeft(t) { return openTasks().filter(x => (x.date && x.date < t) || (x.doDate && x.doDate < t && !(x.date && x.date >= t))); }
function dpPickRows(d) {
  const top = openTasks().filter(x => x.topDate === d), b = taskBuckets(), seen = new Set();
  const cand = [...top, ...b.over, ...b.today, ...b.soon, ...b.none, ...b.later].filter(x => !seen.has(x.id) && seen.add(x.id)).slice(0, 12);
  if (!cand.length) return '<p class="empty">Keine offenen Aufgaben.</p>';
  return '<div class="dplist">' + cand.map(x => { const on = x.topDate === d; return '<button type="button" class="dppick" data-dp="top" data-id="' + esc(x.id) + '" data-d="' + esc(d) + '" aria-pressed="' + on + '"><span class="dpst">' + (on ? '★' : '☆') + '</span><span class="dptx">' + esc(x.title) + '<small>' + esc([x.date ? 'fällig ' + relDay(x.date) : '', x.est ? estLabel(x.est) : '', x.area ? AREAS[x.area] : ''].filter(Boolean).join(' · ')) + '</small></span></button>'; }).join('') + '</div>';
}
const dpBlocksList = d => { const bl = blocksOn(d); return bl.length ? '<ul class="blist dpbl">' + bl.slice(0, 8).map(x => '<li><span class="bt">' + esc(x.start ? x.start + (x.end ? '–' + x.end : '') : 'ganztägig') + '</span> ' + esc(x.title) + (x.src && x.src.planned ? ' <small class="sub">· eigener Block</small>' : '') + '</li>').join('') + '</ul>' : '<p class="empty">Keine Termine.</p>'; };
function dpMoveRow(x, opts) { return '<div class="dprow"><span class="dptx">' + esc(x.title) + '<small>' + esc(x.date ? 'fällig ' + relDay(x.date) : x.doDate ? 'war für ' + relDay(x.doDate) + ' geplant' : '') + '</small></span><span class="seg dpseg">' + opts.map(([v, l]) => '<button type="button" data-dp="mv" data-id="' + esc(x.id) + '" data-v="' + v + '">' + l + '</button>').join('') + '</span></div>'; }
function dpSheet() {
  const P = S.dp, t = todayISO(), tm = addDays(t, 1);
  if (P.mode === 'gap') return dpGapSheet();
  if (P.mode === 'tpl') return dpTplSheet();
  const st = DP_STEPS[P.mode], k = P.step, last = k === st.length - 1;
  let body = '';
  if (P.mode === 'm') {
    if (k === 0) { const l = dpLeft(t); body = '<p class="sub">Was ist liegen geblieben? Entscheide kurz für jede Aufgabe.</p>' + (l.length ? l.map(x => dpMoveRow(x, [['heute', 'Heute'], ['morgen', 'Morgen'], ['some', 'Irgendwann'], ['done', 'Erledigt']])).join('') : '<p class="empty">Nichts liegen geblieben.</p>'); }
    if (k === 1) body = '<h3 class="subh">Deine Termine heute</h3>' + dpBlocksList(t) + dpTplHint(t, 'm') + '<h3 class="subh">Die 3 Wichtigsten</h3><p class="sub">Tipp auf bis zu drei Aufgaben, die heute wirklich zählen.</p>' + dpPickRows(t);
    if (k === 2) {
      const free = freeSlotsOn(t).reduce((s, z) => s + z.e - z.s, 0), top = openTasks().filter(x => x.topDate === t), open = top.filter(x => !dpBlockOf(x.id)), need = open.reduce((s, x) => s + dpLen(x), 0), guess = open.some(x => !x.est);
      const lvl = !open.length ? 'g' : need <= free * 0.7 ? 'g' : need <= free ? 'y' : 'r';
      body = '<div class="mstat"><div><b>' + esc(fmtMin(free)) + '</b><small>heute noch frei</small></div><div><b>' + esc(fmtMin(need)) + '</b><small>für die Top 3' + (guess ? ' (teils geschätzt)' : '') + '</small></div></div>' +
        '<p class="dpamp"><span class="amp ' + lvl + '"><i></i>' + { g: 'passt', y: 'wird eng', r: 'passt nicht' }[lvl] + '</span> ' + esc({ g: open.length ? 'Du hast genug Luft.' : top.length ? 'Deine Top 3 haben schon ihren Platz.' : 'Keine Top 3 gewählt.', y: 'Es geht, aber ohne viel Puffer.', r: 'Das ist mehr, als heute frei ist. Leg eine Aufgabe auf morgen oder nimm sie aus den Top 3.' }[lvl]) + '</p>' +
        (top.length ? '<ul class="blist">' + top.map(x => { const bk = dpBlockOf(x.id); return '<li>' + esc(x.title) + ' <small class="sub">· ' + (bk && bk.date === t ? 'eingeplant ' + esc(bk.start) + '–' + esc(bk.end) : esc(estLabel(dpLen(x))) + (x.est ? '' : ' geschätzt')) + '</small></li>'; }).join('') + '</ul>' : '') +
        (open.length ? '<div class="row" style="margin-top:10px"><button class="btn primary" data-dp="placetop">Top 3 in freie Lücken legen</button></div><p class="sub">Jarvis legt sie als eigene Blöcke in deinen Tagesplan. Vorlesungen und andere feste Termine bleiben, wo sie sind.</p>' : '');
    }
    if (k === 3) { const top = openTasks().filter(x => x.topDate === t); body = '<p>Dein Tag steht. ' + (top.length ? 'Fang mit „' + esc(top[0].title) + '“ an.' : '') + '</p><p class="sub">Wenn etwas länger dauert, tipp im Tagesplan bei deinem Block auf „+15 Min.“. Dann rutschen nur deine eigenen Blöcke nach hinten.</p>'; }
  } else {
    if (k === 0) { const done = byType('task').filter(x => x.done && x.doneAt && isoDate(new Date(x.doneAt)) === t), b = taskBuckets(), open = [...b.over, ...b.today];
      body = '<p class="sub">Hak ab, was du heute noch geschafft hast.</p>' + (open.length ? open.map(x => '<label class="pick"><input type="checkbox" data-toggle="' + esc(x.id) + '"><span>' + esc(x.title) + '</span></label>').join('') : '') +
        (done.length ? '<h3 class="subh">Heute erledigt (' + done.length + ')</h3><ul class="blist">' + done.slice(0, 8).map(x => '<li>' + esc(x.title) + '</li>').join('') + '</ul>' : (open.length ? '' : '<p class="empty">Heute stand nichts an.</p>')); }
    if (k === 1) { const b = taskBuckets(), open = [...b.over, ...b.today]; body = open.length ? '<p class="sub">Wohin damit?</p>' + open.map(x => dpMoveRow(x, [['morgen', 'Morgen'], ['plus2', 'Übermorgen'], ['some', 'Irgendwann']])).join('') + '<div class="row" style="margin-top:8px"><button class="btn sm" data-hint="allTomorrow">Alle auf morgen</button></div>' : '<p class="empty">Nichts offen geblieben. Stark.</p>'; }
    if (k === 2) { const w = wxDay(tm); body = '<h3 class="subh">Termine morgen</h3>' + dpBlocksList(tm) + (w ? '<p class="sub">Wetter: ' + esc(w.hi + '° / ' + w.lo + '°, ' + w.phrase) + (w.rain >= 40 ? ' (' + w.rain + ' % Regen)' : '') + '</p>' : '') + dpTplHint(tm, 'e') + '<h3 class="subh">Top 3 für morgen</h3>' + dpPickRows(tm); }
    if (k === 3) body = '<p class="sub">Was geht dir noch im Kopf herum? Schreib es auf, dann ist es raus. Es landet im Eingangskorb.</p><label class="sr" for="dp-brain">Gedanken</label><textarea id="dp-brain" data-keep="dp-brain" rows="4" placeholder="z. B. Mail an Prof wegen Referat, Schienbeinschoner kaufen …"></textarea>';
  }
  const dots = '<ol class="dpdots" aria-label="Schritte">' + st.map((s, i) => '<li' + (i === k ? ' aria-current="step"' : '') + (i < k ? ' class="ok"' : '') + '>' + esc(s) + '</li>').join('') + '</ol>';
  return '<div class="overlay" data-close="dp"><div class="sheet dpsheet" role="dialog" aria-modal="true" aria-labelledby="dp-h"><h2 id="dp-h">' + (P.mode === 'm' ? 'Tag planen' : 'Tag abschließen') + '</h2>' + dots +
    '<div class="dpbody"><h3 class="dpstep">' + (k + 1) + '. ' + esc(st[k]) + '</h3>' + body + '</div>' +
    '<div class="row actions">' + (k ? '<button class="btn ghost" data-dp="step" data-n="-1">Zurück</button>' : '<button class="btn ghost" data-xclose="dp">Später</button>') +
    (last ? '<button class="btn primary" data-dp="finish">' + (P.mode === 'm' ? 'Los geht’s' : 'Feierabend') + '</button>' : '<button class="btn primary" data-dp="step" data-n="1">Weiter</button>') + '</div></div></div>';
}
function dpGapSheet() {
  const P = S.dp, t = todayISO(), top = openTasks().filter(x => x.topDate === P.date), b = taskBuckets(), seen = new Set();
  const cand = [...top, ...b.over, ...b.today, ...b.soon, ...b.none].filter(x => !seen.has(x.id) && seen.add(x.id) && !dpBlockOf(x.id)).slice(0, 10);
  const len = P.e - P.s;
  return '<div class="overlay" data-close="dp"><div class="sheet dpsheet" role="dialog" aria-modal="true" aria-labelledby="dp-h"><h2 id="dp-h">Lücke ' + esc(minToHM(P.s)) + '–' + esc(minToHM(P.e)) + (P.date !== t ? ' (' + esc(relDay(P.date)) + ')' : '') + '</h2>' +
    '<p class="sub">' + esc(fmtMin(len)) + ' frei. Was willst du in der Zeit machen?</p>' +
    (cand.length ? '<div class="dplist">' + cand.map(x => { const l = Math.min(dpLen(x), len); return '<button type="button" class="dppick" data-dp="gapput" data-id="' + esc(x.id) + '"><span class="dpst">' + (x.topDate === P.date ? '★' : '＋') + '</span><span class="dptx">' + esc(x.title) + '<small>' + esc(minToHM(P.s) + '–' + minToHM(P.s + l) + (dpLen(x) > len ? ' · passt nur zum Teil' : '') + (x.est ? '' : ' · Dauer geschätzt')) + '</small></span></button>'; }).join('') + '</div>' : '<p class="empty">Keine offenen Aufgaben.</p>') +
    '<form class="addrow" data-dpform="gapnew" style="margin-top:10px"><label class="sr" for="dp-gapnew">Neue Aufgabe für die Lücke</label><input id="dp-gapnew" data-keep="dp-gapnew" placeholder="Oder neue Aufgabe …" autocomplete="off"><button class="btn" type="submit">Einplanen</button></form>' +
    (dpTpls().some(tp => !dpTplUsed(tp.id, P.date)) ? '<div class="row" style="margin-top:6px"><button class="btn ghost sm" data-dp="tpl" data-d="' + esc(P.date) + '">Tagesvorlage einfügen</button></div>' : '') +
    '<div class="row actions"><button class="btn ghost" data-xclose="dp">Schließen</button></div></div></div>';
}
function dpTplSheet() {
  const P = S.dp, tps = dpTpls(), tp = tps.find(x => x.id === P.tpl) || dpTplFor(P.date)[0] || tps[0], plan = dpTplPlan(tp, P.date), t = todayISO();
  const fixed = dpFixed(P.date);
  return '<div class="overlay" data-close="dp"><div class="sheet dpsheet" role="dialog" aria-modal="true" aria-labelledby="dp-h"><h2 id="dp-h">Tagesvorlage</h2>' +
    '<div class="chips" role="group" aria-label="Vorlage">' + tps.map(x => '<button data-dp="tplpick" data-tpl="' + esc(x.id) + '" aria-pressed="' + (x.id === tp.id) + '">' + esc(x.name) + '</button>').join('') + '</div>' +
    '<div class="seg" role="group" aria-label="Tag" style="margin-top:8px"><button data-dp="tplday" data-d="' + t + '" aria-pressed="' + (P.date === t) + '">Heute</button><button data-dp="tplday" data-d="' + addDays(t, 1) + '" aria-pressed="' + (P.date === addDays(t, 1)) + '">Morgen</button></div>' +
    (dpTplUsed(tp.id, P.date) ? '<p class="hint">Diese Vorlage ist an dem Tag schon eingefügt.</p>' : '') +
    '<ul class="blist dpbl">' + plan.map(p => { const clash = p.s != null && fixed.some(x => x.s < p.s + p.dur && x.e > p.s); return '<li><span class="bt">' + (p.s != null ? esc(minToHM(p.s) + '–' + minToHM(p.s + p.dur)) : '—') + '</span> ' + esc(p.title) + '<small class="sub">' + (p.s == null ? ' · kein passender Termin an dem Tag, wird übersprungen' : p.why ? ' · ' + esc(p.why) : '') + (clash ? ' · überschneidet sich mit einem Termin' : '') + '</small></li>'; }).join('') + '</ul>' +
    '<p class="sub">Die Schritte werden eigene Blöcke in deinem Tagesplan. Ändern kannst du die Vorlagen in den Einstellungen.</p>' +
    '<div class="row actions"><button class="btn ghost" data-dp="' + (P.back ? 'tplback' : 'close') + '">' + (P.back ? 'Zurück' : 'Abbrechen') + '</button><a class="btn ghost" href="#einstellungen" data-dp="tplset">Vorlagen ändern</a><button class="btn primary" data-dp="tplok"' + (plan.some(p => p.s != null) ? '' : ' disabled') + '>Einfügen</button></div></div></div>';
}
async function dpMove(id, v) {
  const x = S.items.find(i => i.id === id); if (!x) return;
  const t = todayISO(), to = { heute: t, morgen: addDays(t, 1), plus2: addDays(t, 2) }[v];
  let upd = { ...x };
  if (v === 'done') upd = { ...x, done: true, doneAt: new Date().toISOString() };
  else if (v === 'some') { upd = { ...x, status: 'someday' }; delete upd.topDate; }
  else { if (x.date && x.date < to) upd.date = to; if (x.doDate) upd.doDate = to; if (!x.date && !x.doDate) upd.date = to; if (upd.topDate && upd.topDate < to) delete upd.topDate; }
  await store.setItem(upd);
  showToast({ heute: 'Auf heute gelegt.', morgen: 'Auf morgen gelegt.', plus2: 'Auf übermorgen gelegt.', some: 'Liegt jetzt bei „später vielleicht“.', done: 'Erledigt.' }[v], async () => { await store.setItem(x); });
}
async function dpTop(id, d) {
  const x = S.items.find(i => i.id === id); if (!x) return;
  if (x.topDate === d) { const c = { ...x }; delete c.topDate; await store.setItem(c); return; }
  if (openTasks().filter(y => y.topDate === d).length >= 3) { showToast('Schon drei ausgewählt. Erst eine abwählen.'); return; }
  await store.setItem({ ...x, topDate: d });
}
async function dpFinish() {
  const P = S.dp; if (!P) return;
  if (P.mode === 'e') { const el = document.getElementById('dp-brain'), txt = el && el.value.trim(); if (txt) { await withRetry(() => store.setItem({ id: uid(), type: 'note', title: txt.slice(0, 2000), createdAt: new Date().toISOString() })); if (el) el.value = ''; } }
  await dpRitDone(P.mode); S.dp = null; render();
  showToast(P.mode === 'm' ? 'Viel Erfolg heute.' : 'Schönen Feierabend.');
}
document.addEventListener('click', async (ev) => {
  const a = ev.target.closest('[data-dp],[data-dpgap],[data-dpplace]'); if (!a) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (a.dataset.dpgap) { const [d, s, e] = a.dataset.dpgap.split('|'); S.dp = { mode: 'gap', date: d, s: Number(s), e: Number(e) }; render(); return; }
  if (a.dataset.dpplace) { await dpPlace(a.dataset.dpplace, todayISO()); return; }
  const k = a.dataset.dp, P = S.dp;
  if (k === 'm' || k === 'e') { S.dp = { mode: k, step: 0 }; render(); return; }
  if (k === 'close') { S.dp = null; render(); return; }
  if (k === 'step' && P) { P.step = Math.max(0, Math.min(DP_STEPS[P.mode].length - 1, P.step + Number(a.dataset.n))); render(); const sh = document.querySelector('.dpsheet'); if (sh) sh.scrollTop = 0; return; }
  if (k === 'finish') { await dpFinish(); return; }
  if (k === 'mv') { await dpMove(a.dataset.id, a.dataset.v); return; }
  if (k === 'top') { await dpTop(a.dataset.id, a.dataset.d); return; }
  if (k === 'placetop') { const t = todayISO(), xs = openTasks().filter(x => x.topDate === t && !dpBlockOf(x.id)), made = []; for (const x of xs) { const it = await dpPlace(x.id, t, null, true); if (it) made.push(it); }
    if (made.length) { logAct('Top 3 eingeplant: ' + made.map(i => i.title).join(', '), { created: made.map(i => i.id) }); showToast(made.length + ' eingeplant: ' + made.map(i => i.start).join(', ') + ' Uhr.', async () => { for (const it of made) await removeItem(S.items.find(i => i.id === it.id) || it); }); }
    if (made.length < xs.length) showToast((xs.length - made.length) + ' passt heute nicht mehr rein.');
    render(); return; }
  if (k === 'gapput' && P) { const d = P.date, g = { s: P.s, e: P.e }; S.dp = null; await dpPlace(a.dataset.id, d, g); return; }
  if (k === 'more') { await dpMore(a.dataset.id, Number(a.dataset.n)); return; }
  if (k === 'fin') { await dpFin(a.dataset.id); return; }
  if (k === 'tpl') { S.dp = { mode: 'tpl', date: a.dataset.d || todayISO(), tpl: a.dataset.tpl || null, back: a.dataset.back ? { mode: a.dataset.back, step: P && P.step || 0 } : null }; render(); return; }
  if (k === 'tplpick' && P) { P.tpl = a.dataset.tpl; render(); return; }
  if (k === 'tplday' && P) { P.date = a.dataset.d; render(); return; }
  if (k === 'tplback' && P) { S.dp = P.back; render(); return; }
  if (k === 'tplset') { S.dp = null; go('einstellungen'); setTimeout(() => { const c = document.getElementById('dp-tpls'); if (c) c.scrollIntoView({ block: 'start' }); }, 50); return; }
  if (k === 'tplok' && P) { const tp = dpTpls().find(x => x.id === P.tpl) || dpTplFor(P.date)[0] || dpTpls()[0], back = P.back; S.dp = back || null; await dpTplApply(tp.id, P.date); render(); return; }
  if (k === 'tplreset') { const s = { ...S.settings }; delete s.dayTpls; S.settings = s; await store.setSettings(s); render(); showToast('Vorlagen zurückgesetzt.'); return; }
}, true);
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('[data-dpform]'); if (!f) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (f.dataset.dpform === 'tpls') {
    const fd = new FormData(f), list = dpTpls().map((tp, i) => ({ id: tp.id, name: String(fd.get('n' + i) || tp.name).trim().slice(0, 40) || tp.name, anchor: String(fd.get('a' + i) || ''), lines: String(fd.get('l' + i) || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12).join('\n') }));
    S.settings = { ...S.settings, dayTpls: list }; await store.setSettings(S.settings); render(); showToast('Vorlagen gespeichert.'); return;
  }
  if (f.dataset.dpform === 'gapnew' && S.dp) {
    const inp = f.querySelector('input'), title = inp && inp.value.trim(); if (!title) return;
    const P = S.dp, x = { id: uid(), type: 'task', title: title.slice(0, 200), done: false, createdAt: new Date().toISOString() };
    await withRetry(() => store.setItem(x)); inp.value = ''; S.dp = null;
    await dpPlace(x.id, P.date, { s: P.s, e: P.e }); return;
  }
}, true);

/* ----- Eingabe in einem Satz, ohne KI ----- */
// „Fr 14 Uhr Hausarbeit Kapitel 2 uni“ → Aufgabe/Termin mit Tag, Uhrzeit und Bereich. Fragen und Unklares gehen weiter an die KI.
const QP_WD = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 7, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7 };
const QP_AREA = [['team', /(?<![a-zäöüß])(training|trainings?einheit|spiel|turnier|mannschaft|u13|verein|elternabend|team)(?![a-zäöüß])/], ['uni', /(?<![a-zäöüß])(uni|vorlesung|seminar|übung|klausur|hausarbeit|referat|praktikum|praxissemester|modul|lernen|prüfung|bib|bibliothek|tutorium)(?![a-zäöüß])/], ['arbeit', /(?<![a-zäöüß])(arbeit|büro|schicht|studierendenwerk|homeoffice|chef)(?![a-zäöüß])/]];
const QP_ASK = /^(was|wie|wann|wo|warum|wieso|weshalb|welche[rsn]?|wer|kannst|könntest|kann|hast|habe ich|bin ich|zeig|zeige|plan|plane|planen|verschieb|verschiebe|verleg|lösch|lösche|räum|erklär|schreib|formulier|fass|hilf|sag|gib|such|finde?|mach mir|erinner|wiederhol)\b/;
function qpDate(t) {
  const today = todayISO(); let m;
  if ((m = t.match(/(?<![a-zäöüß])übermorgen\b/))) return { date: addDays(today, 2), cut: m[0] };
  if ((m = t.match(/\b(?:heute|heut)\b/))) return { date: today, cut: m[0] };
  if ((m = t.match(/\bmorgen\b(?!\s*früh\b)/)) || (m = t.match(/\bmorgen früh\b/))) return { date: addDays(today, 1), cut: m[0] };
  if ((m = t.match(/\bin (\d{1,2}|einer|zwei|drei) (tagen?|wochen?)\b/))) { const n = { einer: 1, zwei: 2, drei: 3 }[m[1]] || Number(m[1]); return { date: addDays(today, /woche/.test(m[2]) ? n * 7 : n), cut: m[0] }; }
  if ((m = t.match(/\bnächste woche\b(?!\s*(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))/))) return { date: addDays(mondayOf(today), 7), cut: m[0] };
  if ((m = t.match(/\b(?:am\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?!\d)/))) {
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : Number(today.slice(0, 4)), d = y + '-' + pad(Number(m[2])) + '-' + pad(Number(m[1]));
    if (isNaN(dObj(d).getTime()) || Number(m[2]) > 12 || Number(m[1]) > 31) return null;
    if (!m[3] && d < today) d = (y + 1) + d.slice(4);
    return { date: d, cut: m[0] };
  }
  const nx = /\b(?:nächste[nr]?|kommende[nr]?)\s+/.source;
  if ((m = t.match(new RegExp('(' + nx + ')?\\b(?:am\\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)s?\\b')))) { const wd = QP_WD[m[2]]; let diff = (wd - dow(today) + 7) % 7; if (m[1] && diff === 0) diff = 7; return { date: addDays(today, diff), cut: m[0] }; }
  // Abkürzungen nur am Anfang oder vor einer Zahl/Uhrzeit, damit „so“ oder „do“ im Satz nicht stören
  if ((m = t.match(/^(?:bis\s+)?(mo|di|mi|do|fr|sa|so)\.?(?=\s|$)/)) || (m = t.match(/\b(?:am\s+|bis\s+)?(mo|di|mi|do|fr|sa|so)\.?\s+(?=\d)/))) { const wd = QP_WD[m[1]]; return { date: addDays(today, (wd - dow(today) + 7) % 7), cut: m[0].replace(/^bis\s+/, '') }; }
  return null;
}
function qpTime(t) {
  let m = t.match(/\b(?:von\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:-|–|bis)\s*(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/) || t.match(/\b(?:von\s+)?(\d{1,2})[:.](\d{2})\s*(?:-|–|bis)\s*(\d{1,2})[:.](\d{2})\b/);
  if (m) { const a = Number(m[1]) * 60 + Number(m[2] || 0), b = Number(m[3]) * 60 + Number(m[4] || 0); if (Number(m[1]) < 24 && Number(m[3]) <= 24 && b > a) return { start: minToHM(a), end: minToHM(Math.min(b, 1439)), cut: m[0] }; }
  m = t.match(/\b(?:um\s+|ab\s+|gegen\s+)?(\d{1,2})[:.](\d{2})\s*(?:uhr)?\b/) || t.match(/\b(?:um\s+|ab\s+|gegen\s+)?(\d{1,2})\s*uhr\b/) || t.match(/\bum\s+(\d{1,2})\b(?!\s*(?:min|std|tage|wochen))/);
  if (m && Number(m[1]) < 24 && Number(m[2] || 0) < 60) return { start: pad(Number(m[1])) + ':' + pad(Number(m[2] || 0)), cut: m[0] };
  return null;
}
function quickParse(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 160 || /[?\n]/.test(raw)) return null;
  let t = raw.toLowerCase().replace(/\s+/g, ' ');
  if (QP_ASK.test(t) || /\b(jeden|jede|jedes|täglich|wöchentlich|monatlich|alle \d+ tage)\b/.test(t)) return null;
  // Vorsilbe: „Einkauf: Milch, Brot“, „Idee: …“, „Aufgabe: …“, „Termin: …“
  const pre = t.match(/^(einkauf|einkaufen|kaufen|idee|aufgabe|todo|to-do|termin)\s*:\s*/);
  if (pre && /^(einkauf|einkaufen|kaufen)$/.test(pre[1])) { const xs = raw.slice(pre[0].length).split(/,|\bund\b/).map(s => s.trim()).filter(Boolean).slice(0, 15); return xs.length ? { items: xs.map(x => ({ type: 'shopping', title: x.charAt(0).toUpperCase() + x.slice(1), aisle: guessAisle(x) })) } : null; }
  if (pre && pre[1] === 'idee') { const x = raw.slice(pre[0].length).trim(); return x ? { items: [{ type: 'idea', title: x.charAt(0).toUpperCase() + x.slice(1) }] } : null; }
  if (pre) t = t.slice(pre[0].length);
  const rawN = raw.replace(/\s+/g, ' ');
  let title = ' ' + rawN.slice(rawN.length - t.length) + ' ';
  const cut = s => { if (!s) return; const i = title.toLowerCase().indexOf(s); if (i >= 0) title = title.slice(0, i) + ' ' + title.slice(i + s.length); };
  let area = null; const tag = t.match(/#(uni|arbeit|team|alltag|training)\b/); if (tag) { area = tag[1] === 'training' ? 'team' : tag[1]; cut(tag[0]); }
  const dd = qpDate(t); if (dd) cut(dd.cut);
  const tm = qpTime(title.toLowerCase()); if (tm) cut(tm.cut);
  const deadline = /\bbis\b|\babgabe\b|\babgeben\b|\beinreichen\b|\bfrist\b|\bdeadline\b/.test(t);
  if (!area) { const hit = QP_AREA.find(([, re]) => re.test(t)); if (hit) area = hit[0]; }
  if (!dd && !tm && !tag && !pre) return null;   // ohne Tag, Uhrzeit oder Vorsilbe lieber nicht raten
  // Bereichswort ganz am Ende oder Anfang gehört nicht in den Titel („… uni“)
  title = title.replace(/^\s*(?:uni|arbeit|team|alltag)\s+/i, ' ').replace(/\s+(?:uni|arbeit|team|alltag)\s*$/i, ' ');
  title = title.replace(/\b(?:am|um|bis|ab|von|gegen)\s*$/i, ' ').replace(/^\s*(?:am|um|bis|ab|von|gegen|noch|ich muss|muss|ich)\b/i, ' ').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
  if (title.length < 2) return null;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  const asTask = (pre && /aufgabe|todo|to-do/.test(pre[1])) || deadline || !tm;
  if (asTask) { const it = { type: 'task', title, date: dd ? dd.date : (tm ? todayISO() : null), start: null, end: null, place: null, area }; return { items: [it] }; }
  const date = dd ? dd.date : (tm.start <= nowHM() ? addDays(todayISO(), 1) : todayISO());
  const end = tm.end || minToHM(Math.min(hmToMin(tm.start) + (area === 'team' ? 90 : 60), 1439));
  const it = { type: 'event', title, date, start: tm.start, end, place: null, area };
  if (area === 'team' && /training|spiel|turnier/i.test(title)) it.outside = '1';
  return { items: [it] };
}

