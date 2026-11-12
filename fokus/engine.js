/* Fokus-Timer – Rechenkern (ohne Anzeige, ohne Speicher).
   Alles rechnet mit Zeitpunkten (Start der Phase + Dauer), nie mit mitgezählten Sekunden.
   Darum stimmt die Uhr auch nach Handy-Sperre, Tab-Wechsel oder auf einem zweiten Gerät.
   step() holt verpasste Wechsel nach und meldet, was passiert ist (für Ton und Mitteilung). */
(function (G) {
  'use strict';
  const MIN = 60000;
  const DEFAULTS = {
    mode: 'block',
    blockMin: 30,
    rounds: { w: 25, p: 5, l: 15, every: 4, n: 4 },
    overBlock: true, overRounds: true,   // Nachspielzeit
    autoPause: true,                     // Pausen und nächste Runde starten von allein
    topics: ['Uni', 'Arbeit', 'Team', 'Alltag'],
    sound: 'gong', volume: 70,
    iphoneTimer: false, shortcut: 'Fokus-Timer'
  };
  const OVER_REMIND = 30 * MIN;
  const clampInt = (v, d, a, b) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= a ? Math.min(b, n) : d; };

  // Einstellungen säubern: alles in sinnvollen Grenzen, Unbekanntes fällt weg
  function cleanSettings(s) {
    s = s || {}; const r = s.rounds || {}, D = DEFAULTS;
    const topics = Array.isArray(s.topics) ? s.topics.map(t => String(t).trim().slice(0, 30)).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).slice(0, 12) : D.topics.slice();
    return {
      mode: ['block', 'rounds', 'open'].includes(s.mode) ? s.mode : D.mode,
      blockMin: clampInt(s.blockMin, D.blockMin, 1, 300),
      rounds: { w: clampInt(r.w, D.rounds.w, 1, 180), p: clampInt(r.p, D.rounds.p, 1, 60), l: clampInt(r.l, D.rounds.l, 1, 90), every: 4, n: clampInt(r.n, D.rounds.n, 1, 8) },
      overBlock: s.overBlock !== false, overRounds: s.overRounds !== false, autoPause: s.autoPause !== false,
      topics,
      sound: s.sound === 'pfiff' ? 'pfiff' : 'gong', volume: clampInt(s.volume, D.volume, 0, 100),
      iphoneTimer: !!s.iphoneTimer, shortcut: String(s.shortcut || D.shortcut).slice(0, 60) || D.shortcut
    };
  }

  function newRun(set, o, now) {
    set = cleanSettings(set); o = o || {};
    const mode = ['block', 'rounds', 'open'].includes(o.mode) ? o.mode : set.mode;
    const R = set.rounds;
    const run = {
      id: 's' + now, mode, topic: o.topic || '', intent: String(o.intent || '').slice(0, 120),
      start: now, round: 1, of: mode === 'rounds' ? R.n : 1,
      phase: 'focus', pStart: now, pMs: mode === 'block' ? (o.min ? clampInt(o.min, set.blockMin, 1, 300) : set.blockMin) * MIN : mode === 'rounds' ? R.w * MIN : 0,
      heldAt: 0, heldMs: 0, focusMs: 0,
      over: mode === 'block' ? set.overBlock : mode === 'rounds' ? set.overRounds : false,
      auto: set.autoPause, cfg: { w: R.w, p: R.p, l: R.l, every: R.every },
      signaled: false, reminded: false, notes: [], upd: now
    };
    run.planMs = mode === 'block' ? run.pMs : mode === 'rounds' ? R.w * R.n * MIN : 0;
    return run;
  }
  // Eine Pause für sich (nach Block oder Offen, Länge frei)
  function newBreak(min, now) {
    return { id: 'b' + now, mode: 'break', start: now, round: 1, of: 1, phase: 'pause', pStart: now, pMs: clampInt(min, 5, 1, 120) * MIN, heldAt: 0, heldMs: 0, focusMs: 0, over: false, auto: false, cfg: {}, signaled: false, reminded: false, notes: [], upd: now };
  }

  const elapsed = (r, now) => Math.max(0, (r.heldAt || now) - r.pStart - r.heldMs);
  const pauseMsAfter = (r, round) => (round % (r.cfg.every || 4) === 0 ? r.cfg.l : r.cfg.p) * MIN;
  const copy = r => JSON.parse(JSON.stringify(r));

  // Zeit nachholen: führt alle fälligen Wechsel aus. Gibt { run, events } zurück, ändert das Original nicht.
  function step(run, now) {
    const r = copy(run), ev = [];
    for (let guard = 0; guard < 100; guard++) {
      if (r.heldAt || r.phase === 'done') break;
      const e = elapsed(r, now);
      if (r.phase === 'focus' && r.pMs > 0 && e >= r.pMs) {
        const endAt = r.pStart + r.heldMs + r.pMs;
        if (r.over) {
          if (!r.signaled) { r.signaled = true; ev.push('focusEnd'); }
          if (!r.reminded && e >= r.pMs + OVER_REMIND) { r.reminded = true; ev.push('overRemind'); }
          break;
        }
        r.focusMs += r.pMs; ev.push('focusEnd');
        if (r.mode !== 'rounds' || r.round >= r.of) { r.phase = 'done'; r.endAt = endAt; ev.push('done'); break; }
        if (r.auto) { Object.assign(r, { phase: 'pause', pStart: endAt, heldMs: 0, pMs: pauseMsAfter(r, r.round) }); ev.push('pauseStart'); continue; }
        Object.assign(r, { phase: 'wait-pause', pStart: endAt, heldMs: 0, pMs: 0 }); break;
      }
      if (r.phase === 'pause' && e >= r.pMs) {
        const endAt = r.pStart + r.heldMs + r.pMs; ev.push('pauseEnd');
        if (r.mode === 'break') { r.phase = 'done'; r.endAt = endAt; ev.push('done'); break; }
        if (r.auto) { Object.assign(r, { phase: 'focus', round: r.round + 1, pStart: endAt, heldMs: 0, pMs: r.cfg.w * MIN, signaled: false, reminded: false }); ev.push('focusStart'); continue; }
        Object.assign(r, { phase: 'wait-focus', pStart: endAt, heldMs: 0, pMs: 0 }); break;
      }
      break;
    }
    if (ev.length) r.upd = now;
    return { run: r, events: ev };
  }

  // Knöpfe. Vorher immer step() aufrufen, damit der Stand aktuell ist.
  function act(run, what, now, arg) {
    const r = copy(run);
    const unhold = () => { if (r.heldAt) { r.heldMs += now - r.heldAt; r.heldAt = 0; } };
    const toPause = () => {
      if (r.mode !== 'rounds') { r.phase = 'done'; r.endAt = now; r.wantPause = true; return; }
      if (r.round >= r.of) { r.phase = 'done'; r.endAt = now; return; }
      Object.assign(r, { phase: 'pause', pStart: now, heldMs: 0, pMs: pauseMsAfter(r, r.round) });
    };
    switch (what) {
      case 'hold': if ((r.phase === 'focus' || r.phase === 'pause') && !r.heldAt) r.heldAt = now; break;
      case 'resume': unhold(); break;
      case 'takePause':   // in der Nachspielzeit oder früher: Fokus zählt bis jetzt, dann Pause
        if (r.phase !== 'focus') break; unhold(); r.focusMs += elapsed(r, now); toPause(); break;
      case 'startPause': if (r.phase === 'wait-pause') toPause(); break;
      case 'nextRound':
        if (r.phase !== 'wait-focus' && r.phase !== 'pause') break;
        if (r.mode === 'break') { r.phase = 'done'; r.endAt = now; break; }
        Object.assign(r, { phase: 'focus', round: r.round + 1, pStart: now, heldAt: 0, heldMs: 0, pMs: r.cfg.w * MIN, signaled: false, reminded: false }); break;
      case 'finish':   // Beenden oder Fertig: die gearbeitete Zeit zählt immer
        unhold(); if (r.phase === 'focus') r.focusMs += elapsed(r, now);
        r.phase = 'done'; r.endAt = now; break;
      case 'note': { const t = String(arg || '').trim().slice(0, 300); if (t) r.notes.push(t); break; }
      case 'dropNote': r.notes.splice(Number(arg), 1); break;
      default: return run;
    }
    r.upd = now;
    return r;
  }

  // Was gerade zu sehen ist
  function view(r, now) {
    const e = elapsed(r, now), timed = r.pMs > 0;
    const left = timed ? r.pMs - e : 0, overMs = timed && r.phase === 'focus' && left < 0 ? -left : 0;
    return {
      phase: r.phase, round: r.round, of: r.of, held: !!r.heldAt,
      elapsedMs: e, leftMs: Math.max(0, left), overMs,
      frac: timed ? Math.max(0, Math.min(1, left / r.pMs)) : 1,
      endsAt: timed && !r.heldAt && left > 0 ? now + left : 0,
      focusSoFar: r.focusMs + (r.phase === 'focus' ? e : 0)
    };
  }

  // Eintrag für die Liste aller Sessions
  function sessionOf(r) {
    return {
      id: r.id, start: new Date(r.start).toISOString(), end: new Date(r.endAt || r.upd).toISOString(),
      mode: r.mode, topic: r.topic || '', intent: r.intent || '',
      planMin: Math.round(r.planMs / MIN), actualMin: Math.round(r.focusMs / MIN * 10) / 10,
      rounds: r.mode === 'rounds' ? r.round : null, roundsOf: r.mode === 'rounds' ? r.of : null,
      notes: r.notes.slice(), review: null
    };
  }
  const breakSuggestion = focusMs => Math.max(5, Math.round(focusMs / MIN / 5));

  // Wochenübersicht: Stunden je Thema von Montag bis Sonntag der Woche, in der „now“ liegt
  function weekStats(sessions, now) {
    const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const from = d.getTime(), to = from + 7 * 24 * 3600000, by = {};
    let total = 0;
    (sessions || []).forEach(s => { const t = Date.parse(s.start); if (t >= from && t < to) { const k = s.topic || 'Ohne Thema'; by[k] = (by[k] || 0) + (Number(s.actualMin) || 0); total += Number(s.actualMin) || 0; } });
    return { from, total, rows: Object.entries(by).map(([topic, min]) => ({ topic, min })).sort((a, b) => b.min - a.min) };
  }

  const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
  const fmtLeft = ms => fmtClock(Math.ceil(ms / 1000) * 1000);
  const fmtMin = m => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + ' Std.' + (m % 60 ? ' ' + (m % 60) + ' Min' : '') : m + ' Min'; };

  G.FokusEngine = { MIN, DEFAULTS, OVER_REMIND, cleanSettings, newRun, newBreak, step, act, view, sessionOf, breakSuggestion, weekStats, fmtClock, fmtLeft, fmtMin };
})(typeof window !== 'undefined' ? window : globalThis);
