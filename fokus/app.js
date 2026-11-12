/* Fokus-Timer – Anzeige und Bedienung. Rechnen: engine.js, Töne: sound.js, iPhone + Mac: sync.js. */
(function () {
  'use strict';
  const E = window.FokusEngine, SND = window.FokusSound, SY = window.FokusSync;
  const KEY = 'fokus-v2';
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  /* ---------- Speicher auf dem Gerät ---------- */
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const D = Object.assign({ set: null, setUpd: 0, run: null, runUpd: 0, sessions: [], end: null, askedNotify: false }, load());
  D.set = E.cleanSettings(D.set);
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
  function saveRun() { D.runUpd = Date.now(); persist(); SY.saveRun(D.run, D.runUpd); }
  function saveSet() { D.set = E.cleanSettings(D.set); D.setUpd = Date.now(); persist(); SY.saveSettings(D.set, D.setUpd); }
  function saveSession(s) { const i = D.sessions.findIndex(x => x.id === s.id); if (i >= 0) D.sessions[i] = s; else D.sessions.push(s); persist(); SY.saveSession(s); }

  /* ---------- Hilfen ---------- */
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hm = t => { const d = new Date(t); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  let screen = 'start', confirmEnd = 0, sheet = false, draft = { topic: '', intent: '' }, copied = 0;

  /* ---------- Ton, Mitteilung, Bildschirm an ---------- */
  function signal(kind, title, body) {
    SND.play(kind, D.set.sound, D.set.volume);
    try {
      if (document.visibilityState === 'hidden' && window.Notification && Notification.permission === 'granted') {
        const o = { body, icon: 'icons/icon-192.png', tag: 'fokus' };
        if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, o)); else new Notification(title, o);
      }
    } catch (e) {}
  }
  function onEvents(ev, r) {
    const last = ev[ev.length - 1];   // nach Handy-Sperre nur ein Signal für den neuesten Wechsel
    if (ev.includes('overRemind')) return signal('remind', 'Noch dran?', 'Schon 30 Minuten Nachspielzeit.');
    if (last === 'done' || last === 'focusEnd') return signal(r.mode === 'break' ? 'pauseEnd' : 'end', r.mode === 'break' ? 'Pause vorbei' : 'Zeit um', r.mode === 'break' ? 'Weiter geht’s, wenn du magst.' : r.over && r.phase === 'focus' ? 'Die Nachspielzeit läuft.' : 'Gut gemacht.');
    if (last === 'pauseStart') return signal('end', 'Pause', 'Runde ' + r.round + ' geschafft. Kurze Pause.');
    if (last === 'pauseEnd') return signal('pauseEnd', 'Pause vorbei', 'Runde ' + (r.round + 1) + ' wartet.');
    if (last === 'focusStart') return signal('pauseEnd', 'Weiter', 'Runde ' + r.round + ' von ' + r.of + ' läuft.');
  }
  let lock = null;
  async function keepAwake() {
    const want = !!D.run && document.visibilityState === 'visible';
    try {
      if (want && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
      else if (!want && lock) { const l = lock; lock = null; await l.release(); }
    } catch (e) { lock = null; }
  }

  /* ---------- Session zu Ende ---------- */
  function complete(r) {
    if (r.mode === 'break') { D.run = null; saveRun(); if (!D.end) screen = 'start'; return; }
    const s = E.sessionOf(r); saveSession(s);
    D.end = { id: s.id, suggest: E.breakSuggestion(r.focusMs), early: r.mode !== 'open' && r.focusMs < r.planMs - 30000 };
    D.run = r.wantPause ? E.newBreak(D.end.suggest, Date.now()) : null;
    sheet = false; saveRun();
  }
  function tickState() {
    if (!D.run) return false;
    const res = E.step(D.run, Date.now());
    if (!res.events.length) return false;
    D.run = res.run; onEvents(res.events, res.run);
    if (D.run.phase === 'done') complete(D.run); else saveRun();
    return true;
  }
  function act(what, arg) {
    if (!D.run) return;
    tickState();
    if (!D.run) return;
    D.run = E.act(D.run, what, Date.now(), arg);
    if (what === 'nextRound' || what === 'takePause' || what === 'startPause') SND.play('start', D.set.sound, D.set.volume);
    if (D.run.phase === 'done') complete(D.run); else saveRun();
  }

  /* ---------- Bausteine ---------- */
  const seg = (name, items, cur) => '<div class="seg" role="group" aria-label="' + name + '">' + items.map(([v, l]) => '<button data-' + name + '="' + v + '" aria-pressed="' + (cur === v) + '">' + l + '</button>').join('') + '</div>';
  const stepper = (key, val, unit, label) => '<div class="stepper" role="group" aria-label="' + esc(label) + '"><button data-step="' + key + '" data-d="-1" aria-label="weniger">−</button><b data-stepval="' + key + '">' + val + (unit ? ' ' + unit : '') + '</b><button data-step="' + key + '" data-d="1" aria-label="mehr">+</button></div>';
  const toggle = (key, on, label, sub) => '<label class="tog"><span><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><input type="checkbox" role="switch" data-tog="' + key + '"' + (on ? ' checked' : '') + '></label>';

  function startView() {
    const S = D.set, R = S.rounds;
    let det = '';
    if (S.mode === 'block') det = '<div class="chips" role="group" aria-label="Dauer">' + [15, 30, 45, 60, 90].map(m => '<button data-blk="' + m + '" aria-pressed="' + (S.blockMin === m) + '">' + m + '</button>').join('') + '</div>' + stepper('blockMin', S.blockMin, 'Min', 'Dauer genau einstellen');
    if (S.mode === 'rounds') det = '<p class="sub">' + R.w + ' Min Fokus, ' + R.p + ' Min Pause. Nach jeder 4. Runde ' + R.l + ' Min lange Pause.</p><div class="row"><span class="lab">Runden</span>' + stepper('roundsN', R.n, '', 'Anzahl Runden') + '</div>';
    if (S.mode === 'open') det = '<p class="sub">Die Uhr zählt hoch, du beendest selbst. Danach gibt es einen Pausenvorschlag.</p>';
    const hint = IOS && !S.iphoneTimer ? '<p class="hint">Bei gesperrtem Handy kein Ton. Abhilfe: „Auch iPhone-Timer stellen“ in den Einstellungen.</p>' : S.iphoneTimer && S.mode !== 'open' ? '<p class="hint">Beim Start wird zusätzlich dein iPhone-Timer gestellt.</p>' : '';
    return '<header class="top"><h1>Fokus</h1><nav><button class="link" data-go="week">Woche</button><button class="link" data-go="settings" aria-label="Einstellungen">Einstellungen</button></nav></header>' +
      '<section class="pick">' + seg('mode', [['block', 'Block'], ['rounds', 'Runden'], ['open', 'Offen']], S.mode) + det + '</section>' +
      '<section class="pick"><div class="chips topics" role="group" aria-label="Thema (freiwillig)">' + S.topics.map(t => '<button data-topic="' + esc(t) + '" aria-pressed="' + (draft.topic === t) + '">' + esc(t) + '</button>').join('') + '</div>' +
      '<input class="intent" data-intent maxlength="120" placeholder="Absicht (freiwillig), z. B. Gliederung Hausarbeit" value="' + esc(draft.intent) + '" enterkeyhint="go"></section>' +
      hint + '<button class="go" data-act="start">Start</button>';
  }

  function runParts(now) {
    const r = D.run, v = E.view(r, now), brk = r.mode === 'break';
    let label, big, cls;
    if (r.phase === 'focus') {
      cls = v.overMs ? 'over' : 'focus';
      label = (r.mode === 'rounds' ? 'Runde ' + r.round + ' von ' + r.of + ' · ' : '') + (v.held ? 'Angehalten' : v.overMs ? 'Nachspielzeit' : 'Fokus');
      big = r.mode === 'open' ? E.fmtClock(v.elapsedMs) : v.overMs ? '+' + E.fmtClock(v.overMs) : E.fmtLeft(v.leftMs);
    } else if (r.phase === 'pause') {
      cls = 'pause'; label = brk ? 'Pause' : 'Runde ' + r.round + ' von ' + r.of + ' · ' + (r.pMs > r.cfg.p * E.MIN ? 'Lange Pause' : 'Pause') + (v.held ? ' · angehalten' : '');
      big = E.fmtLeft(v.leftMs);
    } else { cls = 'wait'; label = r.phase === 'wait-pause' ? 'Runde ' + r.round + ' geschafft' : 'Pause vorbei'; big = r.phase === 'wait-pause' ? 'Zeit für eine Pause' : 'Runde ' + (r.round + 1) + ' wartet'; }
    const frac = r.phase === 'focus' && r.mode === 'open' ? 1 : r.phase.startsWith('wait') ? 0 : v.frac;
    const sub = v.held ? 'angehalten' : v.endsAt ? 'bis ' + hm(v.endsAt) : '';
    const title = (r.phase.startsWith('wait') ? label : big + ' – ' + (cls === 'pause' ? 'Pause' : cls === 'over' ? 'Nachspielzeit' : 'Fokus'));
    return { v, cls, label, big, frac, sub, title };
  }
  function disc(frac) {
    const rr = 46 * Math.sqrt(Math.max(0, Math.min(1, frac)));   // Fläche schrumpft mit der Zeit
    return '<svg class="disc" viewBox="0 0 100 100" aria-hidden="true"><circle class="rim" cx="50" cy="50" r="48" fill="none" stroke-width="1.5"/><circle class="fill" cx="50" cy="50" r="' + rr.toFixed(2) + '"/></svg>';
  }
  function runView() {
    const r = D.run, p = runParts(Date.now()), end = Date.now() < confirmEnd;
    const endBtn = '<button class="btn' + (end ? ' warn' : '') + '" data-act="end">' + (end ? 'Wirklich beenden?' : 'Beenden') + '</button>';
    const park = r.mode !== 'break' ? '<button class="btn" data-act="park">Gedankenparkplatz' + (r.notes.length ? ' (' + r.notes.length + ')' : '') + '</button>' : '';
    let ctl;
    if (r.phase === 'focus' && p.v.overMs) ctl = '<button class="btn pri" data-act="takePause">Pause</button><button class="btn" data-act="finish">Fertig</button>' + park;
    else if (r.phase === 'focus') ctl = '<button class="btn" data-act="' + (p.v.held ? 'resume">Weiter' : 'hold">Anhalten') + '</button>' + endBtn + park;
    else if (r.phase === 'pause') ctl = (brk(r) ? '<button class="btn pri" data-act="nextRound">Pause beenden</button>' : '<button class="btn" data-act="nextRound">Pause überspringen</button>' + endBtn) + park;
    else if (r.phase === 'wait-pause') ctl = '<button class="btn pri" data-act="startPause">Pause starten</button><button class="btn" data-act="finish">Fertig</button>' + park;
    else ctl = '<button class="btn pri" data-act="nextRound">Runde ' + (r.round + 1) + ' starten</button><button class="btn" data-act="finish">Fertig</button>' + park;
    let dots = ''; if (r.mode === 'rounds') for (let i = 1; i <= r.of; i++) dots += '<i class="' + (i < r.round || (i === r.round && r.phase !== 'focus') ? 'on' : i === r.round ? 'now' : '') + '"></i>';
    const sh = sheet ? '<div class="sheet" role="dialog" aria-label="Gedankenparkplatz"><h2>Gedankenparkplatz</h2><p class="sub">Kurz aufschreiben, weitermachen. Die Uhr läuft weiter.</p>' +
      '<form data-park class="row"><input data-parkin maxlength="300" placeholder="Was ist dir eingefallen?" enterkeyhint="done" autocomplete="off"><button class="btn pri" type="submit">Merken</button></form>' +
      (r.notes.length ? '<ul class="notes">' + r.notes.map((n, i) => '<li><span>' + esc(n) + '</span><button class="x" data-drop="' + i + '" aria-label="Löschen">✕</button></li>').join('') + '</ul>' : '') +
      '<button class="btn" data-act="closePark">Zurück zur Uhr</button></div>' : '';
    return '<div class="run ' + p.cls + '"><p class="ph" data-ph>' + esc(p.label) + '</p>' + (r.mode === 'rounds' ? '<div class="dots">' + dots + '</div>' : '') +
      '<div data-disc>' + disc(p.frac) + '</div><p class="big" data-big>' + esc(p.big) + '</p><p class="when" data-sub>' + esc(p.sub) + '</p>' +
      (r.intent ? '<p class="intentv">' + esc(r.intent) + '</p>' : '') + '<div class="ctl">' + ctl + '</div></div>' + sh;
  }
  const brk = r => r.mode === 'break';

  function endView() {
    const s = D.sessions.find(x => x.id === D.end.id); if (!s) { D.end = null; return startView(); }
    const rv = s.review || {};
    const pick = (k, items) => '<div class="chips" role="group">' + items.map(([v, l]) => '<button data-rev="' + k + '" data-val="' + v + '" aria-pressed="' + (rv[k] === v) + '">' + l + '</button>').join('') + '</div>';
    const head = D.end.early ? 'Früher beendet – das zählt trotzdem.' : 'Geschafft.';
    const pause = (s.mode === 'block' || s.mode === 'open') && !D.run ? '<section class="card"><h2>Pause</h2><p class="sub">Vorschlag: ein Fünftel der Fokuszeit, mindestens 5 Min.</p><div class="row">' + stepper('suggest', D.end.suggest, 'Min', 'Pausenlänge') + '<button class="btn pri" data-act="startBreak">Pause starten</button></div></section>' : '';
    return '<header class="top"><h1>' + head + '</h1></header>' +
      '<p class="lead">' + E.fmtMin(s.actualMin) + ' Fokus gespeichert' + (s.topic ? ' · ' + esc(s.topic) : '') + (s.intent ? '<br><span class="sub">' + esc(s.intent) + '</span>' : '') + '</p>' + pause +
      '<section class="card"><h2>Rückblick <small>(freiwillig)</small></h2><p class="q">Geschafft?</p>' + pick('done', [['ja', 'Ja'], ['teilweise', 'Teilweise'], ['nein', 'Nein']]) +
      '<p class="q">Wie konzentriert?</p>' + pick('focus', [[1, 'Wenig'], [2, 'Mittel'], [3, 'Sehr']]) +
      '<input data-revnote maxlength="300" placeholder="Notiz (freiwillig)" value="' + esc(rv.note || '') + '"></section>' +
      (s.notes.length ? '<section class="card"><h2>Gedankenparkplatz</h2><ul class="notes">' + s.notes.map(n => '<li><span>' + esc(n) + '</span></li>').join('') + '</ul><button class="btn" data-act="copy">' + (Date.now() < copied ? 'Kopiert ✓' : 'Alles kopieren') + '</button></section>' : '') +
      '<button class="go" data-act="closeEnd">Fertig</button>';
  }

  function weekView() {
    const w = E.weekStats(D.sessions, Date.now()), max = Math.max(1, ...w.rows.map(r => r.min));
    const last = D.sessions.slice().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8);
    const day = iso => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
    return '<header class="top"><button class="link" data-go="start">‹ Zurück</button><h1>Diese Woche</h1></header>' +
      '<section class="card"><p class="lead" data-total>' + E.fmtMin(w.total) + ' Fokus</p>' + (w.rows.length ? '<div class="bars">' + w.rows.map(r => '<div class="bar"><span>' + esc(r.topic) + '</span><i style="width:' + Math.max(4, Math.round(r.min / max * 100)) + '%"></i><b>' + E.fmtMin(r.min) + '</b></div>').join('') + '</div>' : '<p class="sub">Noch keine Fokuszeit in dieser Woche.</p>') + '</section>' +
      (last.length ? '<section class="card"><h2>Zuletzt</h2><ul class="list">' + last.map(s => '<li><span>' + day(s.start) + ' · ' + esc(s.topic || 'Ohne Thema') + (s.intent ? ' · ' + esc(s.intent) : '') + '</span><b>' + E.fmtMin(s.actualMin) + '</b></li>').join('') + '</ul></section>' : '') +
      '<section class="card"><h2>Export</h2><p class="sub">Alle Sessions als Datei, z. B. für Jarvis oder eine Tabelle.</p><div class="row"><button class="btn" data-act="exportJson">Als JSON</button><button class="btn" data-act="exportCsv">Als Tabelle (CSV)</button></div></section>';
  }

  function settingsView() {
    const S = D.set, R = S.rounds, u = SY.user();
    const notif = !window.Notification ? 'Dieses Gerät kann keine Mitteilungen aus der App zeigen.' : Notification.permission === 'granted' ? 'Mitteilungen sind erlaubt.' : Notification.permission === 'denied' ? 'Mitteilungen sind blockiert (in den Browser-Einstellungen änderbar).' : '';
    return '<header class="top"><button class="link" data-go="start">‹ Zurück</button><h1>Einstellungen</h1></header>' +
      '<section class="card"><h2>Standardzeiten</h2><div class="grid"><span>Block</span>' + stepper('blockMin', S.blockMin, 'Min', 'Block') +
      '<span>Runde: Fokus</span>' + stepper('rw', R.w, 'Min', 'Fokus je Runde') + '<span>Runde: Pause</span>' + stepper('rp', R.p, 'Min', 'Pause') +
      '<span>Lange Pause</span>' + stepper('rl', R.l, 'Min', 'Lange Pause') + '<span>Runden</span>' + stepper('roundsN', R.n, '', 'Runden') + '</div></section>' +
      '<section class="card"><h2>Ablauf</h2>' + toggle('overBlock', S.overBlock, 'Nachspielzeit bei Block', 'Uhr zählt nach dem Ende weiter, du beendest selbst.') + toggle('overRounds', S.overRounds, 'Nachspielzeit bei Runden') + toggle('autoPause', S.autoPause, 'Pausen automatisch', 'Pause und nächste Runde starten von allein.') + '</section>' +
      '<section class="card"><h2>Themen</h2><ul class="notes">' + S.topics.map((t, i) => '<li><span>' + esc(t) + '</span><button class="x" data-deltopic="' + i + '" aria-label="' + esc(t) + ' entfernen">✕</button></li>').join('') + '</ul><form data-addtopic class="row"><input data-topicin maxlength="30" placeholder="Neues Thema"><button class="btn" type="submit">Hinzufügen</button></form></section>' +
      '<section class="card"><h2>Ton</h2>' + seg('sound', [['gong', 'Sanfter Gong'], ['pfiff', 'Schiri-Pfiff']], S.sound) + '<label class="vol"><span>Lautstärke</span><input type="range" min="0" max="100" step="5" value="' + S.volume + '" data-vol aria-label="Lautstärke"></label><button class="btn" data-act="probe">Probehören</button></section>' +
      '<section class="card"><h2>iPhone gesperrt</h2>' + toggle('iphoneTimer', S.iphoneTimer, 'Auch iPhone-Timer stellen', 'Startet beim Start deinen Kurzbefehl „' + esc(S.shortcut) + '“ mit der Minutenzahl. Der stellt den normalen iPhone-Timer, der auch bei gesperrtem Handy klingelt.') + '</section>' +
      '<section class="card"><h2>iPhone und Mac</h2>' + (u ? '<p class="sub">Angemeldet als ' + esc(u.email || 'Google-Konto') + '. iPhone und Mac zeigen dieselben Sessions und denselben laufenden Timer.</p><button class="btn" data-act="logout">Abmelden</button>' : '<p class="sub">Ohne Anmeldung bleibt alles auf diesem Gerät. Mit deinem Google-Konto (wie bei Jarvis) sehen iPhone und Mac dasselbe.</p><button class="btn pri" data-act="login">Mit Google anmelden</button>') + '</section>' +
      (notif ? '<section class="card"><h2>Mitteilungen</h2><p class="sub">' + notif + '</p></section>' : (window.Notification && !IOS ? '<section class="card"><h2>Mitteilungen</h2><p class="sub">Am Mac zeigt der Timer am Ende eine Mitteilung, auch wenn das Fenster im Hintergrund ist.</p><button class="btn" data-act="notify">Mitteilungen erlauben</button></section>' : ''));
  }

  /* ---------- Zeichnen ---------- */
  function render() {
    if (D.run) screen = 'run'; else if (D.end && (screen === 'run' || screen === 'start' || screen === 'end')) screen = 'end'; else if (screen === 'run' || screen === 'end') screen = 'start';
    app.className = 'scr-' + screen;
    app.innerHTML = screen === 'run' ? runView() : screen === 'end' ? endView() : screen === 'week' ? weekView() : screen === 'settings' ? settingsView() : startView();
    if (sheet) { const i = $('[data-parkin]'); i && i.focus(); }
    document.title = screen === 'run' ? runParts(Date.now()).title : 'Fokus';
    keepAwake();
  }
  // jede halbe Sekunde: nur Zahlen und Scheibe nachführen (Eingaben bleiben unberührt)
  function tick() {
    if (tickState()) return render();
    if (screen !== 'run' || !D.run) return;
    const p = runParts(Date.now()), set = (s, t) => { const el = $(s); if (el && el.textContent !== t) el.textContent = t; };
    set('[data-big]', p.big); set('[data-sub]', p.sub); set('[data-ph]', p.label);
    const run = $('.run'); if (run && !run.classList.contains(p.cls)) return render();
    const f = $('.disc .fill'); if (f) f.setAttribute('r', (46 * Math.sqrt(p.frac)).toFixed(2));
    if (document.title !== p.title) document.title = p.title;
  }

  /* ---------- Start ---------- */
  function start() {
    SND.unlock();
    const S = D.set;
    if (!D.askedNotify && !IOS && window.Notification && Notification.permission === 'default') { D.askedNotify = true; try { Notification.requestPermission().then(render); } catch (e) {} }
    D.end = null; sheet = false;
    D.run = E.newRun(S, { mode: S.mode, topic: draft.topic, intent: draft.intent }, Date.now());
    draft = { topic: '', intent: '' };
    saveRun(); SND.play('start', S.sound, S.volume); render();
    if (S.iphoneTimer && S.mode !== 'open') {
      const min = S.mode === 'block' ? S.blockMin : S.rounds.w;
      const url = 'shortcuts://run-shortcut?name=' + encodeURIComponent(S.shortcut) + '&input=text&text=' + min;
      setTimeout(() => { if (window.__fokusOpen) window.__fokusOpen(url); else location.href = url; }, 250);   // __fokusOpen nur für die Prüfungen
    }
  }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const csvCell = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function exportCsv() {
    const head = ['Start', 'Ende', 'Modus', 'Thema', 'Absicht', 'Geplant (Min)', 'Tatsächlich (Min)', 'Runden', 'Geschafft', 'Konzentration', 'Notiz', 'Gedankenparkplatz'];
    const rows = D.sessions.slice().sort((a, b) => a.start.localeCompare(b.start)).map(s => { const r = s.review || {}; return [s.start, s.end, s.mode, s.topic, s.intent, s.planMin, String(s.actualMin).replace('.', ','), s.rounds ? s.rounds + '/' + s.roundsOf : '', r.done || '', r.focus || '', r.note || '', (s.notes || []).join(' | ')]; });
    return '﻿' + [head].concat(rows).map(r => r.map(csvCell).join(';')).join('\n');
  }

  const STEPS = { blockMin: [1, 300, 5], roundsN: [1, 8, 1], rw: [1, 180, 5], rp: [1, 60, 1], rl: [1, 90, 5], suggest: [1, 120, 1] };
  app.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const d = b.dataset, S = D.set;
    if (d.go) { screen = d.go; return render(); }
    if (d.mode) { S.mode = d.mode; saveSet(); return render(); }
    if (d.blk) { S.blockMin = Number(d.blk); saveSet(); return render(); }
    if (d.topic != null) { draft.intent = ($('[data-intent]') || {}).value || draft.intent; draft.topic = draft.topic === d.topic ? '' : d.topic; return render(); }
    if (d.step) {
      const [a, z, st] = STEPS[d.step], dir = Number(d.d);
      const get = { blockMin: () => S.blockMin, roundsN: () => S.rounds.n, rw: () => S.rounds.w, rp: () => S.rounds.p, rl: () => S.rounds.l, suggest: () => D.end.suggest }[d.step];
      let v = get(); const step = d.step === 'blockMin' && (v < 5 || (v === 5 && dir < 0)) ? 1 : st;
      v = Math.min(z, Math.max(a, (dir > 0 ? Math.floor(v / step) * step + step : Math.ceil(v / step) * step - step)));
      if (d.step === 'suggest') { D.end.suggest = v; persist(); return render(); }
      ({ blockMin: () => { S.blockMin = v; }, roundsN: () => { S.rounds.n = v; }, rw: () => { S.rounds.w = v; }, rp: () => { S.rounds.p = v; }, rl: () => { S.rounds.l = v; } })[d.step]();
      saveSet(); return render();
    }
    if (d.sound) { S.sound = d.sound; saveSet(); SND.play('end', S.sound, S.volume); return render(); }
    if (d.rev) { const s = D.sessions.find(x => x.id === D.end.id); const val = d.rev === 'focus' ? Number(d.val) : d.val; s.review = Object.assign({}, s.review); s.review[d.rev] = s.review[d.rev] === val ? null : val; saveSession(s); return render(); }
    if (d.drop != null) { act('dropNote', d.drop); return render(); }
    if (d.deltopic != null) { S.topics.splice(Number(d.deltopic), 1); saveSet(); return render(); }
    switch (d.act) {
      case 'start': draft.intent = ($('[data-intent]') || {}).value || ''; return start();
      case 'hold': case 'resume': case 'takePause': case 'startPause': case 'nextRound': case 'finish': act(d.act); confirmEnd = 0; return render();
      case 'end': if (Date.now() < confirmEnd) { confirmEnd = 0; act('finish'); return render(); } confirmEnd = Date.now() + 3000; setTimeout(render, 3100); return render();
      case 'park': sheet = true; return render();
      case 'closePark': sheet = false; return render();
      case 'startBreak': D.run = E.newBreak(D.end.suggest, Date.now()); saveRun(); SND.play('start', S.sound, S.volume); return render();
      case 'closeEnd': D.end = null; persist(); screen = 'start'; return render();
      case 'copy': { const s = D.sessions.find(x => x.id === D.end.id); try { await navigator.clipboard.writeText(s.notes.join('\n')); copied = Date.now() + 2000; setTimeout(render, 2100); } catch (e) {} return render(); }
      case 'probe': SND.unlock(); SND.play('end', S.sound, S.volume); return;
      case 'exportJson': return download('fokus-sessions.json', JSON.stringify({ app: 'Fokus', version: 1, exported: new Date().toISOString(), sessions: D.sessions }, null, 2), 'application/json');
      case 'exportCsv': return download('fokus-sessions.csv', exportCsv(), 'text/csv;charset=utf-8');
      case 'notify': try { await Notification.requestPermission(); } catch (e) {} return render();
      case 'login': try { await SY.signIn(); } catch (e) { alert('Anmeldung hat nicht geklappt. Bitte noch einmal.'); } return render();
      case 'logout': await SY.signOut(); return render();
    }
  });
  app.addEventListener('submit', ev => {
    ev.preventDefault();
    if (ev.target.matches('[data-park]')) { const i = $('[data-parkin]'); act('note', i.value); render(); return; }
    if (ev.target.matches('[data-addtopic]')) { const i = $('[data-topicin]'); if (i.value.trim()) { D.set.topics.push(i.value.trim()); saveSet(); } render(); }
  });
  app.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches('[data-tog]')) { D.set[t.dataset.tog] = t.checked; saveSet(); render(); }
    if (t.matches('[data-vol]')) { D.set.volume = Number(t.value); saveSet(); SND.play('remind', D.set.sound, D.set.volume); }
    if (t.matches('[data-revnote]')) { const s = D.sessions.find(x => x.id === D.end.id); s.review = Object.assign({}, s.review, { note: t.value.trim().slice(0, 300) }); saveSession(s); }
  });
  app.addEventListener('input', ev => { if (ev.target.matches('[data-intent]')) draft.intent = ev.target.value; });
  app.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('[data-intent]')) { ev.preventDefault(); draft.intent = ev.target.value; start(); } });
  document.addEventListener('pointerdown', () => SND.unlock(), { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); keepAwake(); });
  setInterval(tick, 500);

  /* ---------- iPhone und Mac: Stand vom anderen Gerät übernehmen ---------- */
  SY.start(x => {
    if ('run' in x && x.upd > D.runUpd) { D.run = x.run; D.runUpd = x.upd; if (D.run) sheet = false; persist(); render(); }
    if (x.settings && x.setUpd > D.setUpd) { D.set = E.cleanSettings(x.settings); D.setUpd = x.setUpd; persist(); if (screen !== 'run') render(); }
    if (x.sessions) {
      const cloud = new Map(x.sessions.map(s => [s.id, s]));
      D.sessions.forEach(s => { if (!cloud.has(s.id)) SY.saveSession(s); });   // was nur hier lag, hochladen
      D.sessions = [...new Map(D.sessions.map(s => [s.id, s]).concat([...cloud])).values()];
      persist(); if (screen === 'week' || screen === 'end') render();
    }
  }).then(() => { if (screen === 'settings') render(); });

  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  render();
  window.__fokus = { D, render };   // für die Prüfungen
})();
