/* =====================================================================
   Jarvis-App · js/google.js
   Nachbau von mcp.callTool(server, tool, args) aus der Claude-Fassung:
   - 'Google Calendar': list_events, create_event, update_event, delete_event
   - 'Gmail': search_threads, get_thread, trash_thread, untrash_thread, mark_thread_spam, create_draft
   - 'AccuWeather®': widgets-daily/hourly/search/gov-alert-map-claude → Open-Meteo (Wetter, Ortssuche)
     und Bright Sky (amtliche DWD-Warnungen), beide kostenlos und ohne Anmeldung
   Antworten: { payload, content:[{type:'text', text}] } in genau der Form, die der alte Code ausliest.
   Fehler: Error mit .code wie in Claude ('not_granted', 'needs_reauth', 'consent_required', 'not_declared', 'unavailable').

   Google-Zugang: Anmeldung mit Rückkehr-Schlüssel (refresh token). Der Schlüssel liegt in
   users/{uid}/meta/google (über das globale db aus 0-basis.js) und zusätzlich lokal. So reicht es,
   Google EINMAL auf irgendeinem Gerät zu verbinden (am besten am Mac); das iPhone (auch als App auf
   dem Home-Bildschirm) holt sich den Schlüssel dann aus Firebase und muss sich nie bei Google anmelden.

   Für das Grundgerüst:
   - window.jarvisMcp = JarvisGoogle.mcp   (ist immer da, Wetter geht auch ohne Google)
   - window.JARVIS_SCOPES = [] mit Absicht: die Firebase-Anmeldung bleibt schlicht. Kommt trotzdem ein
     Zugang über window.jarvisOnGoogleToken, wird er eine Stunde lang mitbenutzt.
   - JarvisGoogle.settingsHTML() liefert eine Karte für die Einstellungen; Klicks darin erledigt diese Datei.
   - Nach Änderungen am Google-Zugang kommt das Ereignis 'jarvis-google' auf window (dann fetchGcal() + render()).
   ===================================================================== */
(function () {
  'use strict';

  const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    'openid', 'email'
  ].join(' ');
  const TZ = 'Europe/Berlin';
  const LS_TOK = 'jarvis.google';        // { clientId, clientSecret, refresh, email, access, exp, dirty }
  const LS_FLOW = 'jarvis.google.flow';  // { state, verifier, back, at } während der Anmeldung
  const LS_WX = 'jarvis.wxplace';        // { key, lat, lon } für alte AccuWeather-Ortsnummern
  const HALTERN = { lat: 51.7436, lon: 7.1817 };

  /* ---------- kleine Helfer ---------- */
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const out = (payload) => ({ payload, content: [{ type: 'text', text: JSON.stringify(payload) }] });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const b64url = (bytes) => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const utf8 = (s) => new TextEncoder().encode(s);
  const b64utf8 = (s) => { let r = ''; utf8(s).forEach(b => { r += String.fromCharCode(b); }); return btoa(r); };
  function fromB64url(data, charset) {
    try {
      const bin = atob(String(data).replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
    } catch (e) { return ''; }
  }
  async function pool(list, n, fn) {
    const res = new Array(list.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; res[k] = await fn(list[k], k); } }));
    return res;
  }
  const emit = () => { try { window.dispatchEvent(new CustomEvent('jarvis-google', { detail: status() })); } catch (e) {} };

  /* ---------- Speicher des Google-Zugangs (lokal + Firebase) ---------- */
  const fbDb = () => { try { return typeof db !== 'undefined' && db ? db : null; } catch (e) { return null; } };
  let tok = lsGet(LS_TOK) || {};
  let fbLoadedAt = 0;
  function saveLocal() { lsSet(LS_TOK, tok); }
  async function fbRead() {
    const d = fbDb(); if (!d) return null;
    const ref = d.doc('meta/google');
    const fromSnap = (s) => { if (!s) return null; const ex = typeof s.exists === 'function' ? s.exists() : s.exists; return ex ? s.data() : null; };
    if (typeof ref.get === 'function') return fromSnap(await ref.get());
    return new Promise((resolve) => {   // Ersatz, falls der Speicher nur onSnapshot kennt
      let un = null, done = false;
      const fin = (v) => { if (done) return; done = true; resolve(v); try { un && un(); } catch (e) {} };
      un = ref.onSnapshot((s) => fin(fromSnap(s)), () => fin(null));
      setTimeout(() => fin(null), 8000);
    });
  }
  async function fbWrite() {
    const d = fbDb(); if (!d) return false;
    const doc = { clientId: tok.clientId || '', clientSecret: tok.clientSecret || '', refresh: tok.refresh || '', email: tok.email || '', at: new Date().toISOString() };
    try { await d.doc('meta/google').set(doc); tok.dirty = false; saveLocal(); return true; } catch (e) { return false; }
  }
  // Holt den Stand aus Firebase (höchstens einmal pro Minute) und schiebt lokale Änderungen nach oben
  async function syncFb(force) {
    if (!fbDb()) return;
    if (tok.dirty) { await fbWrite(); return; }
    if (!force && Date.now() - fbLoadedAt < 60000) return;
    fbLoadedAt = Date.now();
    let r = null; try { r = await fbRead(); } catch (e) { return; }
    if (!r) { if (tok.refresh || tok.clientId) await fbWrite(); return; }
    const changed = r.refresh !== tok.refresh || r.clientId !== tok.clientId;
    tok = { ...tok, clientId: r.clientId || tok.clientId, clientSecret: r.clientSecret || tok.clientSecret, refresh: r.refresh || '', email: r.email || '' };
    if (changed) { tok.access = ''; tok.exp = 0; }
    saveLocal(); if (changed) emit();
  }

  /* ---------- Anmeldung bei Google ---------- */
  function redirectUri() {
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }
  async function connect() {
    await syncFb(true);
    if (!tok.clientId || !tok.clientSecret) { openSetup(); return; }
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(verifier))));
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    lsSet(LS_FLOW, { state, verifier, back: location.hash || '', at: Date.now() });
    const p = new URLSearchParams({
      client_id: tok.clientId, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPES,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
      state, code_challenge: challenge, code_challenge_method: 'S256'
    });
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
  }
  // Rückkehr von Google: ?code=…&state=… in der Adresse
  async function handleReturn() {
    const q = new URLSearchParams(location.search);
    if (!q.has('state') || !(q.has('code') || q.has('error'))) return;
    const flow = lsGet(LS_FLOW); lsSet(LS_FLOW, null);
    const clean = () => history.replaceState(null, '', redirectUri() + ((flow && flow.back) || location.hash || ''));
    if (!flow || flow.state !== q.get('state')) { clean(); return; }
    if (q.has('error')) { clean(); note('Google-Verbindung abgebrochen.'); return; }
    try {
      const body = new URLSearchParams({ code: q.get('code'), client_id: tok.clientId, client_secret: tok.clientSecret, redirect_uri: redirectUri(), grant_type: 'authorization_code', code_verifier: flow.verifier });
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const j = await r.json();
      if (!r.ok || !j.access_token) throw err('needs_reauth', j.error_description || j.error || 'Anmeldung fehlgeschlagen');
      const granted = String(j.scope || '');
      tok.access = j.access_token; tok.exp = Date.now() + (Number(j.expires_in || 3600) - 120) * 1000;
      if (j.refresh_token) tok.refresh = j.refresh_token;
      tok.email = mailFromIdToken(j.id_token) || tok.email || '';
      tok.dirty = true; saveLocal(); clean();
      const miss = [/calendar/.test(granted) ? '' : 'Kalender', /gmail/.test(granted) ? '' : 'Gmail'].filter(Boolean);
      note(miss.length ? 'Verbunden, aber ohne ' + miss.join(' und ') + '. Bitte nochmal verbinden und alle Häkchen setzen.' : 'Google ist verbunden.');
      fbWrite(); emit();
    } catch (e) { clean(); note('Google-Verbindung hat nicht geklappt. Bitte nochmal versuchen.'); }
  }
  function mailFromIdToken(t) {
    try { const p = JSON.parse(fromB64url(String(t).split('.')[1])); return p.email || ''; } catch (e) { return ''; }
  }
  async function disconnect() {
    const t = tok.refresh || tok.access;
    if (t) { try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t }) }); } catch (e) {} }
    tok = { clientId: tok.clientId, clientSecret: tok.clientSecret, refresh: '', email: '', access: '', exp: 0, dirty: true };
    saveLocal(); await fbWrite(); emit();
  }
  let refreshing = null;
  async function accessToken(force) {
    await syncFb(false);
    if (!force && tok.access && tok.exp > Date.now()) return tok.access;
    if (!tok.refresh || !tok.clientId || !tok.clientSecret) throw err('not_granted', 'Google ist nicht verbunden');
    if (!refreshing) refreshing = (async () => {
      const body = new URLSearchParams({ client_id: tok.clientId, client_secret: tok.clientSecret, refresh_token: tok.refresh, grant_type: 'refresh_token' });
      let r; try { r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); }
      catch (e) { throw err('unavailable', 'Keine Verbindung'); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) {
        if (j.error === 'invalid_grant' || j.error === 'invalid_client' || j.error === 'unauthorized_client') {
          // Vielleicht hat ein anderes Gerät inzwischen neu verbunden: einmal frisch aus Firebase lesen
          const old = tok.refresh; await syncFb(true);
          if (tok.refresh && tok.refresh !== old) { refreshing = null; return accessToken(true); }
          tok.refresh = ''; tok.access = ''; tok.dirty = true; saveLocal(); fbWrite(); emit();
          throw err('needs_reauth', 'Google-Verbindung abgelaufen');
        }
        throw err('unavailable', j.error || 'Google antwortet nicht');
      }
      tok.access = j.access_token; tok.exp = Date.now() + (Number(j.expires_in || 3600) - 120) * 1000; saveLocal();
      return tok.access;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  // Anfrage an eine Google-Schnittstelle, mit neuem Zugang bei 401 und kurzer Wiederholung bei Überlastung
  async function gapi(method, url, body, tries = 0) {
    const t = await accessToken(tries > 0 && tries < 2 && gapi.last401);
    let r;
    try { r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw err('unavailable', 'Keine Verbindung'); }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    gapi.last401 = r.status === 401;
    if (r.status === 401 && tries < 1) { tok.exp = 0; return gapi(method, url, body, tries + 1); }
    if ((r.status === 429 || r.status >= 500 || (r.status === 403 && /rate|quota/i.test(JSON.stringify(j)))) && tries < 3) { await sleep(800 * (tries + 1)); return gapi(method, url, body, tries + 1); }
    const msg = (j.error && j.error.message) || ('Fehler ' + r.status);
    if (r.status === 401) throw err('needs_reauth', msg);
    if (r.status === 403 && /insufficient|scope|permission/i.test(msg)) throw err('consent_required', msg);
    const e = err(r.status === 404 || r.status === 410 ? 'not_found' : 'unavailable', msg); e.status = r.status; throw e;
  }

  /* ---------- Google Kalender ---------- */
  const CAL = 'https://www.googleapis.com/calendar/v3/calendars/';
  const calId = (a) => encodeURIComponent(a.calendarId || 'primary');
  const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').slice(0, 10)) && !/T\d/.test(String(v || ''));
  const withSec = (v) => /T\d\d:\d\d$/.test(v) ? v + ':00' : v;
  function gTimeObj(v, allDay, forPatch) {
    v = String(v || '');
    if (allDay || isDateOnly(v)) return forPatch ? { date: v.slice(0, 10), dateTime: null, timeZone: null } : { date: v.slice(0, 10) };
    const hasZone = /[Zz]$|[+-]\d\d:?\d\d$/.test(v);
    return { dateTime: withSec(v), ...(hasZone ? {} : { timeZone: TZ }), ...(forPatch ? { date: null } : {}) };
  }
  function eventBody(a, forPatch) {
    const b = {};
    if (a.summary != null) b.summary = a.summary;
    if (a.description != null) b.description = a.description;
    if (a.location != null) b.location = a.location;
    if (a.startTime) b.start = gTimeObj(a.startTime, a.allDay, forPatch);
    if (a.endTime) b.end = gTimeObj(a.endTime, a.allDay, forPatch);
    if (Array.isArray(a.recurrenceData)) b.recurrence = a.recurrenceData;
    if (Array.isArray(a.overrideReminders)) b.reminders = { useDefault: false, overrides: a.overrideReminders.map(o => ({ method: o.method || 'popup', minutes: Number(o.minutes) || 0 })) };
    else if (a.useDefaultReminders === false) b.reminders = { useDefault: false, overrides: [] };
    else if (a.useDefaultReminders === true) b.reminders = { useDefault: true };
    if (a.availability) b.transparency = /FREE/i.test(a.availability) ? 'transparent' : 'opaque';
    if (a.colorId) b.colorId = String(a.colorId);
    return b;
  }
  const sendUpd = (a) => 'sendUpdates=' + (a.notificationLevel && a.notificationLevel !== 'NONE' ? 'all' : 'none');
  const calTools = {
    async list_events(a) {
      const p = new URLSearchParams({ singleEvents: 'true', maxResults: String(Math.min(2500, a.pageSize || 250)) });
      if (a.startTime) p.set('timeMin', new Date(a.startTime).toISOString());
      if (a.endTime) p.set('timeMax', new Date(a.endTime).toISOString());
      if (a.orderBy === 'startTime' || !a.orderBy) p.set('orderBy', 'startTime');
      if (a.query || a.q) p.set('q', a.query || a.q);
      p.set('timeZone', TZ);
      const events = []; let page = '', n = 0;
      do {
        if (page) p.set('pageToken', page);
        const j = await gapi('GET', CAL + calId(a) + '/events?' + p.toString());
        (j.items || []).forEach(e => events.push(e));
        page = j.nextPageToken || ''; n++;
      } while (page && n < 10);
      return out({ events });
    },
    async create_event(a) {
      const j = await gapi('POST', CAL + calId(a) + '/events?' + sendUpd(a), eventBody(a, false));
      return out(j);
    },
    async update_event(a) {
      if (!a.eventId) throw err('invalid_args', 'eventId fehlt');
      const j = await gapi('PATCH', CAL + calId(a) + '/events/' + encodeURIComponent(a.eventId) + '?' + sendUpd(a), eventBody(a, true));
      return out(j);
    },
    async delete_event(a) {
      if (!a.eventId) throw err('invalid_args', 'eventId fehlt');
      try { await gapi('DELETE', CAL + calId(a) + '/events/' + encodeURIComponent(a.eventId) + '?' + sendUpd(a)); }
      catch (e) { if (e.code !== 'not_found') throw e; }   // schon gelöscht: auch gut
      return out({ deleted: true, eventId: a.eventId });
    },
    async get_event(a) {
      return out(await gapi('GET', CAL + calId(a) + '/events/' + encodeURIComponent(a.eventId)));
    },
    async list_calendars() {
      const j = await gapi('GET', 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250');
      return out({ calendars: j.items || [] });
    }
  };

  /* ---------- Gmail ---------- */
  const GM = 'https://gmail.googleapis.com/gmail/v1/users/me/';
  const hdr = (m, name) => { const h = ((m.payload && m.payload.headers) || []).find(x => x.name.toLowerCase() === name.toLowerCase()); return h ? h.value : ''; };
  const msgDate = (m) => m.internalDate ? new Date(Number(m.internalDate)).toISOString() : hdr(m, 'Date');
  const viewUrl = (id) => 'https://mail.google.com/mail/u/0/#all/' + id;
  const charsetOf = (p) => ((String(hdrOfPart(p, 'Content-Type')).match(/charset="?([^";]+)"?/i) || [])[1]) || 'utf-8';
  function onlyPlain(part) {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body && part.body.data) return fromB64url(part.body.data, charsetOf(part));
    for (const p of part.parts || []) { const t = onlyPlain(p); if (t) return t; }
    return '';
  }
  const plainText = (part) => onlyPlain(part) || htmlText(part);
  function htmlText(part) {
    if (!part) return '';
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      const html = fromB64url(part.body.data, charsetOf(part));
      try {
        const d = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n'), 'text/html');
        d.querySelectorAll('style,script').forEach(n => n.remove());
        return (d.body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      } catch (e) { return html.replace(/<[^>]+>/g, ' '); }
    }
    if (part.parts) for (const p of part.parts) { const h = htmlText(p); if (h) return h; }
    return '';
  }
  const hdrOfPart = (p, name) => { const h = (p.headers || []).find(x => x.name.toLowerCase() === name.toLowerCase()); return h ? h.value : ''; };
  const encHead = (s) => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64utf8(s) + '?=';
  const gmTools = {
    async search_threads(a) {
      const p = new URLSearchParams({ maxResults: String(Math.min(100, a.pageSize || 20)) });
      if (a.query) p.set('q', a.query);
      if (a.pageToken) p.set('pageToken', a.pageToken);
      const j = await gapi('GET', GM + 'threads?' + p.toString());
      const list = j.threads || [];
      const meta = 'format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To';
      const threads = (await pool(list, 6, async (t) => {
        try {
          const g = await gapi('GET', GM + 'threads/' + encodeURIComponent(t.id) + '?' + meta);
          const ms = (g.messages || []).map(m => ({ id: m.id, threadId: m.threadId, sender: hdr(m, 'From'), to: hdr(m, 'To'), subject: hdr(m, 'Subject'), snippet: m.snippet || '', date: msgDate(m), labelIds: m.labelIds || [] }));
          return { id: t.id, messageCount: ms.length, messages: ms, snippet: t.snippet || '', viewUrl: viewUrl(t.id) };
        } catch (e) { return null; }   // einzelne Konversation nicht lesbar: weglassen
      })).filter(Boolean);
      return out({ threads, nextPageToken: j.nextPageToken || null });
    },
    async get_thread(a) {
      const g = await gapi('GET', GM + 'threads/' + encodeURIComponent(a.threadId) + '?format=full');
      const messages = (g.messages || []).map(m => ({
        id: m.id, threadId: m.threadId, sender: hdr(m, 'From'), to: hdr(m, 'To'), subject: hdr(m, 'Subject'), date: msgDate(m),
        snippet: m.snippet || '', labelIds: m.labelIds || [], messageIdHeader: hdr(m, 'Message-ID') || hdr(m, 'Message-Id'),
        plaintextBody: plainText(m.payload)
      }));
      return out({ id: g.id, messages, viewUrl: viewUrl(g.id) });
    },
    async trash_thread(a) { return out(await gapi('POST', GM + 'threads/' + encodeURIComponent(a.threadId) + '/trash')); },
    async untrash_thread(a) { return out(await gapi('POST', GM + 'threads/' + encodeURIComponent(a.threadId) + '/untrash')); },
    async mark_thread_spam(a) { return out(await gapi('POST', GM + 'threads/' + encodeURIComponent(a.threadId) + '/modify', { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] })); },
    async unmark_thread_spam(a) { return out(await gapi('POST', GM + 'threads/' + encodeURIComponent(a.threadId) + '/modify', { addLabelIds: ['INBOX'], removeLabelIds: ['SPAM'] })); },
    async create_draft(a) {
      let threadId = null, inReply = '', refs = '';
      if (a.replyToMessageId) {
        try {
          const m = await gapi('GET', GM + 'messages/' + encodeURIComponent(a.replyToMessageId) + '?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References');
          threadId = m.threadId || null; inReply = hdr(m, 'Message-ID'); refs = (hdr(m, 'References') + ' ' + inReply).trim();
        } catch (e) { /* ohne Bezug trotzdem speichern */ }
      }
      const to = Array.isArray(a.to) ? a.to.join(', ') : (a.to || '');
      const cc = Array.isArray(a.cc) ? a.cc.join(', ') : (a.cc || '');
      const lines = [];
      if (to) lines.push('To: ' + to);
      if (cc) lines.push('Cc: ' + cc);
      lines.push('Subject: ' + encHead(a.subject || ''));
      if (inReply) { lines.push('In-Reply-To: ' + inReply); lines.push('References: ' + refs); }
      lines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '');
      const raw = lines.join('\r\n') + '\r\n' + (b64utf8(String(a.body || '')).match(/.{1,76}/g) || ['']).join('\r\n');
      const msg = { raw: b64url(utf8(raw)) }; if (threadId) msg.threadId = threadId;
      return out(await gapi('POST', GM + 'drafts', { message: msg }));
    }
  };

  /* ---------- Wetter: Open-Meteo + Bright Sky (DWD) ---------- */
  const WMO = { 0: 'Sonnig', 1: 'Überwiegend sonnig', 2: 'Teils bewölkt', 3: 'Bewölkt', 45: 'Nebel', 48: 'Nebel mit Reif', 51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen', 56: 'Gefrierender Nieselregen', 57: 'Gefrierender Nieselregen', 61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Gefrierender Regen', 71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel', 80: 'Leichte Regenschauer', 81: 'Regenschauer', 82: 'Heftige Regenschauer', 85: 'Schneeschauer', 86: 'Starke Schneeschauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Schweres Gewitter mit Hagel' };
  const wxCache = new Map();
  async function wxFetch(url, ttl) {
    const c = wxCache.get(url);
    if (ttl && c && Date.now() - c.at < ttl) return c.data;
    let r; try { r = await fetch(url); } catch (e) { throw err('unavailable', 'Wetter nicht erreichbar'); }
    if (!r.ok) throw err('unavailable', 'Wetter nicht erreichbar');
    const data = await r.json();
    if (ttl) wxCache.set(url, { at: Date.now(), data });
    return data;
  }
  // Ort: neue Schlüssel sind "Breite,Länge"; alte AccuWeather-Nummern werden über den gespeicherten Ortsnamen gesucht
  async function place(key) {
    const m = String(key || '').match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) return { lat: Number(m[1]), lon: Number(m[2]) };
    const c = lsGet(LS_WX); if (c && c.key === String(key)) return c;
    let name = ''; try { name = (typeof S !== 'undefined' && S.settings && S.settings.wxName) || ''; } catch (e) {}
    if (name && !/^haltern/i.test(name)) {
      try { const r = await geocode(name); if (r[0]) { const p = { key: String(key), lat: r[0].latitude, lon: r[0].longitude }; lsSet(LS_WX, p); return p; } } catch (e) {}
    }
    return HALTERN;
  }
  async function geocode(q) {
    const j = await wxFetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=de&format=json&name=' + encodeURIComponent(q), 0);
    return j.results || [];
  }
  async function forecast(key) {
    const p = await place(key);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
      '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&timezone=' + encodeURIComponent(TZ) + '&forecast_days=7';
    return wxFetch(url, 30 * 60000);
  }
  const wxTools = {
    async 'widgets-daily-claude'(a) {
      const j = await forecast(a.queryParams && (a.queryParams.locationKey || a.queryParams.LocationKey));
      const d = j.daily || {}, h = j.hourly || {}, ht = h.time || [];
      const maxProb = (date, from, to) => { let mx = null; ht.forEach((t, i) => { const hr = Number(t.slice(11, 13)); if (t.slice(0, 10) === date && hr >= from && hr < to && h.precipitation_probability[i] != null) mx = Math.max(mx ?? 0, h.precipitation_probability[i]); }); return mx; };
      const next = (date) => { const x = new Date(date + 'T12:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
      const dailyForecast = (d.time || []).map((date, i) => {
        const dayP = maxProb(date, 6, 18), n1 = maxProb(date, 18, 24), n2 = maxProb(next(date), 0, 6);
        const nightP = n1 == null && n2 == null ? null : Math.max(n1 ?? 0, n2 ?? 0);
        return {
          date,
          day: { temperature: d.temperature_2m_max[i], iconPhrase: WMO[d.weather_code[i]] || '', rainProbabilityValue: dayP ?? d.precipitation_probability_max[i] ?? 0 },
          night: { temperature: d.temperature_2m_min[i], rainProbabilityValue: nightP ?? d.precipitation_probability_max[i] ?? 0 }
        };
      });
      return out({ dailyForecast });
    },
    async 'widgets-hourly-claude'(a) {
      const j = await forecast(a.queryParams && (a.queryParams.locationKey || a.queryParams.LocationKey));
      const h = j.hourly || {}, now = new Date(), cut = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0');
      const hourlyForecast = [];
      (h.time || []).forEach((t, i) => {
        if (t.slice(0, 13) < cut || hourlyForecast.length >= 72) return;
        hourlyForecast.push({ date: t, temperatureValue: h.temperature_2m[i], precip: h.precipitation[i], extended: { rainProbability: h.precipitation_probability[i] ?? 0 }, phrase: WMO[h.weather_code[i]] || '' });
      });
      return out({ hourlyForecast });
    },
    async 'widgets-search-claude'(a) {
      const q = String((a.queryParams && a.queryParams.query) || '').trim();
      if (!q) return out({ results: [] });
      const r = await geocode(q);
      return out({ results: r.map(x => ({ locationKey: x.latitude.toFixed(4) + ',' + x.longitude.toFixed(4), name: [x.name, x.admin1, x.country].filter(Boolean).join(', ') })) });
    },
    async 'widgets-gov-alert-map-claude'(a) {
      const p = await place(a.queryParams && (a.queryParams.LocationKey || a.queryParams.locationKey));
      const j = await wxFetch('https://api.brightsky.dev/alerts?lat=' + p.lat + '&lon=' + p.lon, 30 * 60000);
      const SEV = { minor: 'Wetterwarnung', moderate: 'Markantes Wetter', severe: 'Unwetter', extreme: 'Extremes Unwetter' };
      const alerts = (j.alerts || []).filter(x => !x.expires || Date.parse(x.expires) > Date.now()).map(x => ({
        headline: x.headline_de || x.event_de || x.headline_en || '', severity: SEV[x.severity] || '', expires: x.expires || '', description: x.description_de || ''
      }));
      return out({ alerts });
    }
  };

  /* ---------- callTool ---------- */
  const SERVERS = { 'Google Calendar': calTools, 'Gmail': gmTools, 'AccuWeather®': wxTools, 'Wetter': wxTools };
  const mcp = {
    async callTool(server, tool, args) {
      const s = SERVERS[server];
      if (!s || !s[tool]) throw err('not_declared', 'Gibt es in der App nicht: ' + server + ' / ' + tool);
      return s[tool](args || {});
    },
    // wie in Claude: welche Werkzeuge es gibt
    async listTools(server) { const s = SERVERS[server]; return s ? Object.keys(s).map(name => ({ name })) : []; }
  };

  /* ---------- Einstellungen: Karte + Einrichtung ---------- */
  function status() { return { configured: !!(tok.clientId && tok.clientSecret), connected: !!tok.refresh, email: tok.email || '', redirectUri: redirectUri() }; }
  const escH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function settingsHTML() {
    const st = status();
    return '<section class="card" id="g-card"><h2 class="label">Google (Kalender und Gmail)</h2>' +
      (st.connected
        ? '<p class="sub">Verbunden' + (st.email ? ' mit ' + escH(st.email) : '') + '. Das gilt auf all deinen Geräten.</p><div class="row actions"><button type="button" class="btn ghost" data-gact="connect">Neu verbinden</button><button type="button" class="btn ghost" data-gact="setup">Zugangsdaten</button><button type="button" class="btn ghost danger" data-gact="disconnect">Trennen</button></div>'
        : '<p class="sub">' + (st.configured ? 'Noch nicht verbunden. Einmal verbinden reicht für alle Geräte, am besten am Mac.' : 'Zuerst die zwei Angaben aus Google eintragen (siehe Anleitung), dann verbinden.') + '</p><div class="row actions">' + (st.configured ? '<button type="button" class="btn primary" data-gact="connect">Mit Google verbinden</button>' : '') + '<button type="button" class="btn ' + (st.configured ? 'ghost' : 'primary') + '" data-gact="setup">' + (st.configured ? 'Zugangsdaten' : 'Einrichten') + '</button></div>') +
      '</section>';
  }
  function openSetup() {
    closeSetup();
    const st = status();
    const o = document.createElement('div');
    o.className = 'overlay'; o.id = 'g-setup';
    o.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="g-h"><h2 id="g-h">Google einrichten</h2>' +
      '<p class="sub">Diese Adresse bei Google als „Weiterleitungs-URI“ eintragen:</p>' +
      '<div class="row" style="align-items:center;gap:8px"><code style="font-size:16px;overflow-wrap:anywhere;flex:1;min-width:0">' + escH(st.redirectUri) + '</code><button type="button" class="btn ghost sm" data-gact="copy">Kopieren</button></div>' +
      '<label class="field"><span>Client-ID</span><input id="g-cid" autocomplete="off" autocapitalize="off" spellcheck="false" style="font-size:16px" value="' + escH(tok.clientId || '') + '"></label>' +
      '<label class="field"><span>Clientschlüssel</span><input id="g-sec" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" style="font-size:16px" value="' + escH(tok.clientSecret || '') + '"></label>' +
      '<p class="sub">Beides steht bei Google unter „Clients“ bei deinem Jarvis-Zugang. Es wird nur in deinem Jarvis gespeichert.</p>' +
      '<div class="row actions"><button type="button" class="btn ghost" data-gact="close">Abbrechen</button><button type="button" class="btn primary" data-gact="save">Speichern und verbinden</button></div></div>';
    o.addEventListener('click', (ev) => { if (ev.target === o) closeSetup(); });
    document.body.appendChild(o);
  }
  function closeSetup() { const o = document.getElementById('g-setup'); if (o) o.remove(); }
  function note(text) {
    try { if (typeof showToast === 'function') { showToast(text); return; } } catch (e) {}
    pendingNote = text;
  }
  let pendingNote = '';
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-gact]'); if (!b) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const act = b.dataset.gact;
    if (act === 'setup') return openSetup();
    if (act === 'close') return closeSetup();
    if (act === 'copy') { try { await navigator.clipboard.writeText(redirectUri()); note('Adresse kopiert.'); } catch (e) { note('Bitte die Adresse von Hand kopieren.'); } return; }
    if (act === 'save') {
      const cid = (document.getElementById('g-cid').value || '').trim(), sec = (document.getElementById('g-sec').value || '').trim();
      if (!/\.apps\.googleusercontent\.com$/.test(cid)) { note('Die Client-ID endet auf „.apps.googleusercontent.com“. Bitte nochmal prüfen.'); return; }
      if (!sec) { note('Bitte auch den Clientschlüssel eintragen.'); return; }
      const changed = cid !== tok.clientId;
      tok = { ...tok, clientId: cid, clientSecret: sec, ...(changed ? { refresh: '', access: '', exp: 0, email: '' } : {}), dirty: true };
      saveLocal(); await fbWrite(); closeSetup(); emit();
      return connect();
    }
    if (act === 'connect') return connect();
    if (act === 'disconnect') { if (b.dataset.sure) { await disconnect(); note('Google getrennt.'); return; } b.dataset.sure = '1'; b.textContent = 'Wirklich trennen?'; return; }
  }, true);
  window.addEventListener('jarvis-google', () => { const c = document.getElementById('g-card'); if (c) c.outerHTML = settingsHTML(); });

  /* ---------- Start ---------- */
  window.jarvisMcp = mcp;
  window.JARVIS_SCOPES = window.JARVIS_SCOPES || [];
  window.jarvisOnGoogleToken = (accessToken) => { if (accessToken && window.JARVIS_SCOPES.length && !(tok.access && tok.exp > Date.now())) { tok.access = accessToken; tok.exp = Date.now() + 50 * 60000; saveLocal(); } };
  window.JarvisGoogle = { mcp, connect, disconnect, status, settingsHTML, openSetup, redirectUri, sync: () => syncFb(true), _tok: () => tok };
  handleReturn();
  // Sobald die Anmeldung bei Firebase steht (db da), Google-Stand abgleichen und eine wartende Meldung zeigen
  let tries = 0;
  const t = setInterval(() => {
    if (pendingNote) { try { if (typeof showToast === 'function') { showToast(pendingNote); pendingNote = ''; } } catch (e) {} }
    if (fbDb()) { clearInterval(t); syncFb(true).then(() => { emit(); }); }
    else if (++tries > 600) clearInterval(t);
  }, 500);
})();
