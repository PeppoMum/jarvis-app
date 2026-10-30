/* Termine aus Google Kalender über die geheime iCal-Adresse (Google Kalender → Einstellungen → Kalender → „Privatadresse im iCal-Format“).
   Liefert dieselbe Form wie die App für Google-Termine (S.gcal): { gid, date, start, end, endDate, title, place, calName, area, rec }.
   Wiederholungen, Ausnahmen und abgesagte Einzeltermine werden aufgelöst; Uhrzeiten in deutscher Zeit (TZ=Europe/Berlin). */
import ICAL from "ical.js";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const hm = (d) => pad(d.getHours()) + ":" + pad(d.getMinutes());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };

/* Eine Zeile pro Kalender: nur die Adresse oder „Name | Adresse“ */
export function adressen(txt) {
  return String(txt || "").split(/\r?\n/).map((z) => z.trim()).filter((z) => z && !z.startsWith("#")).map((z) => {
    const m = z.match(/^(.*?)\s*\|\s*(\S+)$/); return m ? { name: m[1], url: m[2] } : { name: "", url: z };
  }).filter((x) => /^https:\/\//.test(x.url));
}

/* ics-Text → Termine von „von“ bis „bis“ (JJJJ-MM-TT, beide einschließlich) */
export function termineAusIcs(text, von, bis, nameVorgabe) {
  const comp = new ICAL.Component(ICAL.parse(text));
  comp.getAllSubcomponents("vtimezone").forEach((tz) => { try { const z = new ICAL.Timezone(tz); if (!ICAL.TimezoneService.has(z.tzid)) ICAL.TimezoneService.register(z.tzid, z); } catch (e) { } });
  const calName = nameVorgabe || comp.getFirstPropertyValue("x-wr-calname") || "Google";
  const area = /u13|cockpit|training/i.test(calName) ? "team" : /uni/i.test(calName) ? "uni" : null;
  const start = new Date(von + "T00:00:00"), ende = new Date(addDays(bis, 1) + "T00:00:00");
  const alle = comp.getAllSubcomponents("vevent"), haupt = new Map(), ausn = [];
  alle.forEach((v) => { if (v.hasProperty("recurrence-id")) ausn.push(v); else haupt.set(v.getFirstPropertyValue("uid"), new ICAL.Event(v)); });
  ausn.forEach((v) => { const e = haupt.get(v.getFirstPropertyValue("uid")); if (e) { try { e.relateException(v); } catch (x) { } } else haupt.set(v.getFirstPropertyValue("uid") + "#" + ausn.indexOf(v), new ICAL.Event(v)); });
  const out = [];
  const add = (ev, s, e, idTeil, rec) => {
    if (!s || String(ev.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") return;
    const ganz = s.isDate, a = s.toJSDate(), z = e ? e.toJSDate() : a;
    if (z <= start || a >= ende) return;
    const gid = String(ev.uid || "").replace(/@google\.com$/, "") + (idTeil ? "_" + idTeil : "");
    const base = { title: ev.summary || "(ohne Titel)", place: ev.location || "", calName, area, rec: !!rec, ...(/trainer-cockpit/i.test(calName) ? { cockpit: true, ...abfahrtAus(ev.description) } : {}) };
    if (ganz) {   /* ganztägig: Ende ist der Folgetag */
      const letzter = e ? addDays(iso(z), -1) : iso(a);
      for (let d = iso(a), n = 0; d <= letzter && n < 60; d = addDays(d, 1), n++) if (d >= von && d <= bis) out.push({ ...base, gid, date: d, start: null, end: null, endDate: letzter > iso(a) ? letzter : null });
      return;
    }
    const d0 = iso(a), d1 = iso(new Date(z.getTime() - 1));
    if (d0 === d1) { if (d0 >= von && d0 <= bis) out.push({ ...base, gid, date: d0, start: hm(a), end: hm(z), endDate: null }); return; }
    /* über Mitternacht oder mehrere Tage: erster Tag ab Beginn, letzter bis Ende, dazwischen ganztägig */
    for (let d = d0, n = 0; d <= d1 && n < 60; d = addDays(d, 1), n++) if (d >= von && d <= bis)
      out.push({ ...base, gid, date: d, start: d === d0 ? hm(a) : null, end: d === d0 ? "23:59" : null, endDate: d1, title: base.title + (d === d1 && d !== d0 ? " bis " + hm(z) : "") });
  };
  for (const ev of haupt.values()) {
    try {
      if (!ev.isRecurring()) { add(ev, ev.startDate, ev.endDate, "", false); continue; }
      const it = ev.iterator(); let n = 0, t;
      while ((t = it.next()) && n++ < 2000) {
        if (t.toJSDate() >= ende) break;
        const o = ev.getOccurrenceDetails(t);
        if (o.endDate.toJSDate() < start) continue;
        const sid = t.toICALString().replace(/[^0-9TZ]/g, "");
        add(o.item, o.startDate, o.endDate, sid, true);
      }
    } catch (e) { /* einzelner kaputter Termin: überspringen */ }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || String(x.start || "").localeCompare(String(y.start || "")));
}

/* Alle Kalender laden. Fehler je Kalender werden gezählt, nicht geworfen (dann fehlen eben die Termine dieses Kalenders). */
export async function ladeTermine(fetchFn, liste, von, bis) {
  const out = [], fehler = [];
  for (const k of liste) {
    try {
      const r = await fetchFn(k.url, { headers: { "User-Agent": "Jarvis-Meldungen" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      out.push(...termineAusIcs(await r.text(), von, bis, k.name));
    } catch (e) { fehler.push(k.name || "Kalender " + (liste.indexOf(k) + 1)); }
  }
  return { termine: out, fehler };
}

/* Alternative ohne iCal-Adresse: über den Google-Zugang der App (users/<uid>/meta/google { clientId, clientSecret, refresh }).
   Nur lesen. Kalender: Hauptkalender + settings.extraCals (wie in der App, Standard: U13 Trainer-Cockpit). */
/* Fußball-App (Kalender „U13 Trainer-Cockpit“): Losfahr-Zeit steht in der Beschreibung, Zeile „Abfahrt: 13:25 Uhr (Fahrzeit ca. 10 Min., berechnet)“ */
export function abfahrtAus(desc) {
  const txt = String(desc || "").replace(/<br\s*\/?>|<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  for (const z of txt.split(/\r?\n/)) {
    const m = /^\s*Abfahrt:\s*(\d{1,2})[:.](\d{2})/i.exec(z); if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) continue;
    const f = /Fahrzeit\D{0,8}?(\d+)\s*Min/i.exec(z);
    return { abf: m[1].padStart(2, "0") + ":" + m[2], abfMin: f ? Number(f[1]) : null };
  }
  return { abf: null, abfMin: null };
}
export const TEAM_CAL = { id: "6bccee518a54346e36d10361e101db6e07df969a5944171e66c8e9ea20758656@group.calendar.google.com", name: "U13 Trainer-Cockpit", area: "team" };
export async function ladeGoogle(fetchFn, g, settings, von, bis) {
  const r = await fetchFn("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: g.refresh, client_id: g.clientId, client_secret: g.clientSecret || "" }) });
  if (!r.ok) throw new Error("Google-Zugang " + r.status);
  const tok = (await r.json()).access_token, cals = [{ id: "primary", name: "Google", area: null }].concat(Array.isArray(settings.extraCals) ? settings.extraCals : [TEAM_CAL]);
  const out = [], fehler = [];
  for (const c of cals) {
    try {
      let page = "", n = 0;
      do {
        const u = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(c.id) + "/events?singleEvents=true&orderBy=startTime&maxResults=250&timeZone=Europe%2FBerlin" +
          "&timeMin=" + encodeURIComponent(new Date(von + "T00:00:00").toISOString()) + "&timeMax=" + encodeURIComponent(new Date(addDays(bis, 1) + "T00:00:00").toISOString()) + (page ? "&pageToken=" + page : "");
        const x = await fetchFn(u, { headers: { Authorization: "Bearer " + tok } }); if (!x.ok) throw new Error("HTTP " + x.status);
        const j = await x.json(); page = j.nextPageToken || "";
        (j.items || []).filter((e) => e.status !== "cancelled").forEach((e) => {
          const base = { gid: e.id, title: e.summary || "(ohne Titel)", place: e.location || "", calName: c.name || "Google", area: c.area || null, rec: !!e.recurringEventId,
            ...(c.id === TEAM_CAL.id || /trainer-cockpit/i.test(c.name || "") ? { cockpit: true, ...abfahrtAus(e.description) } : {}) };
          if (e.start && e.start.date) {
            const letzter = addDays(e.end.date, -1);
            for (let d = e.start.date, k = 0; d <= letzter && k < 60; d = addDays(d, 1), k++) if (d >= von && d <= bis) out.push({ ...base, date: d, start: null, end: null, endDate: letzter > e.start.date ? letzter : null });
          } else if (e.start && e.start.dateTime) {
            const a = new Date(e.start.dateTime), z = new Date(e.end.dateTime), d0 = iso(a), d1 = iso(new Date(z.getTime() - 1));
            if (d0 === d1) { if (d0 >= von && d0 <= bis) out.push({ ...base, date: d0, start: hm(a), end: hm(z), endDate: null }); }
            else for (let d = d0, k = 0; d <= d1 && k < 60; d = addDays(d, 1), k++) if (d >= von && d <= bis)
              out.push({ ...base, date: d, start: d === d0 ? hm(a) : null, end: d === d0 ? "23:59" : null, endDate: d1, title: base.title + (d === d1 && d !== d0 ? " bis " + hm(z) : "") });
          }
        });
      } while (page && n++ < 10);
    } catch (e) { fehler.push(c.name || "Kalender"); }
  }
  return { termine: out, fehler };
}
