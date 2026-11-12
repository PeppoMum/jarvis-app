/* Fokus-Timer – Töne, direkt im Browser erzeugt (keine Sounddateien).
   „Gong“: sanfter Schlag mit langem Ausklang. „Pfiff“: Schiri-Pfiff, kurz-kurz-lang.
   Das iPhone spielt Töne erst, nachdem einmal getippt wurde: unlock() beim Tippen auf Start. */
(function (G) {
  'use strict';
  let ctx = null;
  function unlock() {
    try { const A = G.AudioContext || G.webkitAudioContext; if (!A) return null; ctx = ctx || new A(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch (e) { return null; }
  }
  function gongAt(c, t, vol, base) {
    const out = c.createGain(); out.connect(c.destination);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * vol), t + 0.02); out.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    [[1, 1], [2, 0.45], [2.76, 0.25], [4.07, 0.12]].forEach(([m, a]) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = base * m; g.gain.value = a;
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 4.6);
    });
  }
  function whistleAt(c, t, dur, vol) {
    const out = c.createGain(); out.connect(c.destination);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.22 * vol), t + 0.02);
    out.gain.setValueAtTime(Math.max(0.0002, 0.22 * vol), t + dur - 0.04); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain();
    o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 32; depth.gain.value = 180;   // das Trillern der Pfeifenkugel
    lfo.connect(depth); depth.connect(o.frequency); o.connect(out);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
  }
  // kind: 'end' (Zeit um), 'pauseEnd', 'start', 'remind' (sanft, leiser)
  function play(kind, sound, volume) {
    const c = unlock(); if (!c) return false;
    const v = Math.max(0, Math.min(100, Number(volume))) / 100; if (!v) return true;
    const t = c.currentTime + 0.03;
    if (kind === 'remind') { gongAt(c, t, v * 0.5, 262); return true; }
    if (kind === 'start') { gongAt(c, t, v * 0.6, 392); return true; }
    if (sound === 'pfiff') {
      if (kind === 'pauseEnd') { whistleAt(c, t, 0.25, v); whistleAt(c, t + 0.4, 0.6, v); }
      else { whistleAt(c, t, 0.22, v); whistleAt(c, t + 0.35, 0.22, v); whistleAt(c, t + 0.7, 0.9, v); }
    } else {
      if (kind === 'pauseEnd') { gongAt(c, t, v, 262); gongAt(c, t + 0.9, v, 330); }
      else { gongAt(c, t, v, 330); gongAt(c, t + 1.1, v, 262); }
    }
    return true;
  }
  G.FokusSound = { unlock, play };
})(window);
