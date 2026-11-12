// Prüfungen fürs Handy-Widget (widget/Jarvis.js), ohne iPhone: die Scriptable-Bausteine werden hier nachgebaut.
// Start: node widget/test.mjs            (nur prüfen)
//        node widget/test.mjs bild.html  (zusätzlich eine Vorschau aller Größen hell/dunkel als Seite schreiben)
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(DIR, "Jarvis.js"), "utf8");

let fehler = 0, anzahl = 0;
const ok = (b, was, info) => { anzahl++; if (!b) { fehler++; console.log("  FEHLER " + was + (info !== undefined ? " → " + JSON.stringify(info) : "")); } else console.log("  ok     " + was); };

/* ---------- Nachbau der Scriptable-Bausteine ---------- */
function welt(dunkel, jetzt) {
  class Color { constructor(h) { this.h = h; } static dynamic(l, d) { return dunkel ? d : l; } static white() { return new Color("#FFFFFF"); } }
  const fw = (w) => (n) => ({ w, n });
  const Font = { heavySystemFont: fw(900), boldSystemFont: fw(700), semiboldSystemFont: fw(600), mediumSystemFont: fw(500) };
  class Size { constructor(w, h) { this.w = w; this.h = h; } }
  class Point { constructor(x, y) { this.x = x; this.y = y; } }
  class LinearGradient { }
  const SFSymbol = { named: (n) => ({ n, applyFont() { }, get image() { return { sym: n }; } }) };
  class El {
    constructor(k) { this.k = k; this.kids = []; this.vert = k === "w"; }
    layoutVertically() { this.vert = true; } layoutHorizontally() { this.vert = false; }
    centerAlignContent() { this.al = "center"; } topAlignContent() { this.al = "flex-start"; } setPadding(a, b, c, d) { this.pad = [a, b, c, d]; }
    addStack() { const s = new El("s"); this.kids.push(s); return s; }
    addText(t) { const x = { k: "t", t }; this.kids.push(x); return x; }
    addSpacer(n) { this.kids.push({ k: "sp", n }); }
    addImage(i) { const x = { k: "i", i }; this.kids.push(x); return x; }
    addDate(d) { const x = { k: "t", datum: d, t: "", applyRelativeStyle() { const m = Math.round((d - jetzt) / 60000); x.t = m < 60 ? "in " + m + " Min." : "in " + Math.floor(m / 60) + " Std."; }, applyTimerStyle() { x.t = "0:47"; } }; this.kids.push(x); return x; }
  }
  class ListWidget extends El { constructor() { super("w"); } }
  const store = {}; const Keychain = { contains: (k) => k in store, get: (k) => { if (!(k in store)) throw 0; return store[k]; }, set: (k, v) => { store[k] = v; } };
  class FesteZeit extends Date { constructor(...a) { if (a.length) super(...a); else super(jetzt); } static now() { return jetzt; } }
  const vorne = SRC.slice(SRC.indexOf("const KEY"), SRC.indexOf("/* ---------- Einrichtung"));
  const bau = SRC.slice(SRC.indexOf("/* ---------- Widget bauen"), SRC.indexOf("/* ---------- Start"));
  const fn = new Function("Color", "Font", "Size", "Point", "LinearGradient", "SFSymbol", "ListWidget", "Keychain", "Date",
    vorne + "\nconst CATS = {};\nfunction uhrJetzt(d) { return d && d.uhr; }\n" + bau + "\nreturn { bauen, plan };");
  return fn(Color, Font, Size, Point, LinearGradient, SFSymbol, ListWidget, Keychain, FesteZeit);
}
// alle Texte eines Widgets der Reihe nach, mit Schrift und Farbe
const texte = (e, out = []) => { if (e.k === "t") out.push({ t: e.t, w: e.font && e.font.w, n: e.font && e.font.n, c: e.textColor && e.textColor.h }); (e.kids || []).forEach((k) => texte(k, out)); return out; };
const finde = (w, t) => texte(w).find((x) => x.t === t);
const stapel = (e, out = []) => { if (e.kids) { out.push(e); e.kids.forEach((k) => stapel(k, out)); } return out; };

/* ---------- Beispieltag: Do 12.11.2026, 14:40 – Seminar läuft, danach Vorbereitung, Fahrt, Training ---------- */
const JETZT = new Date(2026, 10, 12, 14, 40).getTime();
const TAG = { v: 1, at: JETZT - 5 * 60000, tag: "2026-11-12", tagText: "Donnerstag, 12. November", skin: "plakat",
  termine: [{ s: "14:00", e: "15:30", ti: "Seminar Mathe-Didaktik", o: "Hörsaal 2", k: "uni", f: 0 }, { s: "15:40", e: "16:10", ti: "Trainingsvorbereitung", o: "", k: "team", f: 0 },
    { s: "16:10", e: "16:40", ti: "Abfahrt zum Platz", o: "", k: "", f: 1 }, { s: "17:00", e: "18:30", ti: "Training U13", o: "Sportplatz", k: "team", f: 0 }, { s: "19:30", e: "20:30", ti: "Lernen Praxissemester", o: "", k: "uni", f: 0 }],
  morgen: [{ s: "07:30", e: "12:00", ti: "Arbeit · Homeoffice", k: "arbeit", f: 0 }, { s: "14:00", e: "16:00", ti: "N2 Vorbereitung", k: "uni", f: 0 }], los: null, auf: { heute: 0, ueber: 0, top: [] },
  wetter: { hi: 7, lo: 2, tx: "bewölkt", regen: 10 }, woche: { h: 14, lim: 20, lvl: "g", rest: 6.5 }, uhr: null };
const ROT_H = "#D7000F", ROT_D = "#FF4D57";

console.log("Widget im Plakat-Look (wie im Design-Board)");
{
  const { bauen } = welt(false, JETZT);
  const m = bauen(TAG, "medium");
  ok(m.backgroundColor.h === "#FFFFFF", "Plakat hell: weißer Grund", m.backgroundColor.h);
  const jetzt = finde(m, "JETZT"); ok(jetzt && jetzt.c === ROT_H && jetzt.w === 900, "Mittel: rote, fette Zeile „JETZT“, weil das Seminar gerade läuft", jetzt);
  const titel = finde(m, "Seminar Mathe-Didaktik"); ok(titel && titel.n >= 22 && titel.w === 900, "Mittel: Termin groß und fett (mind. 22 pt)", titel);
  ok(!!finde(m, "noch 50 Min"), "Mittel: „noch 50 Min“ (14:40 bis 15:30)", texte(m).map((x) => x.t));
  const t = texte(m).map((x) => x.t); const i = (x) => t.indexOf(x);
  ok(i("15:40") > -1 && i("17:00") > -1 && i("19:30") > -1 && i("15:40") < i("17:00"), "Mittel: rechts die nächsten Zeiten der Reihe nach", t);
  const fahrt = finde(m, "Abfahrt zum Platz"); ok(fahrt && fahrt.c === "#555555" && fahrt.w < 900, "Mittel: Fahrt blass statt fett", fahrt);
  ok(stapel(m).some((s) => s.size && s.size.w === 2 && s.backgroundColor && s.backgroundColor.h === "#0A0A0A"), "Mittel: dicke schwarze Trennlinie zwischen Termin und Liste");
  ok(!t.includes("ALS NÄCHSTES") && !t.includes("MORGEN ZUERST"), "Mittel: nicht mehr der alte Kasten „Als Nächstes“", t);

  const k = bauen(TAG, "small"); const kt = texte(k);
  const uhr = kt.find((x) => x.t === "14:00"); ok(uhr && uhr.n >= 40 && uhr.w === 900, "Klein: Uhrzeit riesig (mind. 40 pt)", uhr);
  ok(!!kt.find((x) => x.t === "JETZT" && x.c === ROT_H), "Klein: rote Zeile „JETZT“", kt);

  const g = bauen(TAG, "large"); const gt = texte(g);
  ok(!!gt.find((x) => x.t === "14:00" && x.n >= 56), "Groß: Uhrzeit riesig (mind. 56 pt)", gt.slice(0, 4));
  ok(stapel(g).filter((s) => s.size && s.size.h === 2).length >= 3, "Groß: Liste mit dicken Linien");
  ok(!!gt.find((x) => x.t === "Noch 6,5 Std. verplant") && !gt.find((x) => /^Woche /.test(x.t)), "Groß: unten die noch verplanten Stunden statt „Woche 14/20“", gt.map((x) => x.t));
  ok(!!finde(m, "Noch 6,5 Std. verplant") && !texte(m).find((x) => /^Woche /.test(x.t)), "Mittel: unten die noch verplanten Stunden statt „Woche 14/20“", texte(m).map((x) => x.t));
  ok(!!finde(welt(false, JETZT).bauen({ ...TAG, skin: "smaragd" }, "medium"), "Noch 6,5 Std. verplant"), "Smaragd: ebenfalls die noch verplanten Stunden");
  ok(!!finde(welt(false, JETZT).bauen({ ...TAG, woche: { h: 14, lim: 20, lvl: "g" } }, "medium"), "Woche 14/20"), "Ältere Daten ohne Angabe: bisherige Zeile statt Absturz");

  // eine Stunde früher: das Seminar läuft noch nicht → „in … Min.“ in Rot, Zeiten statt „noch“
  const { bauen: b2 } = welt(false, JETZT - 60 * 60000);
  const v = texte(b2(TAG, "medium")); const rel = v.find((x) => /^in \d+/.test(x.t));
  ok(rel && rel.c === ROT_H && rel.t === "in 20 Min.", "Vorher: rote Zeile „in 20 Min.“ bis zum Seminar", rel);
  ok(v.some((x) => x.t === "14:00–15:30"), "Vorher: Beginn und Ende darunter", v.map((x) => x.t));

  // eine Fahrt als erster Termin ist nie „Als Nächstes“
  const mitFahrt = { ...TAG, termine: [{ s: "14:50", e: "15:20", ti: "Zug nach Essen", f: 1 }].concat(TAG.termine.slice(1)) };
  const fv = texte(welt(false, JETZT).bauen(mitFahrt, "medium"));
  ok(fv.find((x) => x.t === "Trainingsvorbereitung" && x.n >= 22) && !fv.find((x) => x.t === "Zug nach Essen" && x.n >= 22), "Fahrt kommt nicht groß als nächster Termin", fv.map((x) => [x.t, x.n]));

  // abends nichts mehr: Morgen zuerst
  const { bauen: b3 } = welt(false, new Date(2026, 10, 12, 21, 0).getTime());
  const ab = texte(b3(TAG, "medium"));
  ok(ab.some((x) => x.t === "MORGEN" && x.c === ROT_H) && ab.some((x) => x.t === "Arbeit · Homeoffice" && x.n >= 22), "Abends: rote Zeile „MORGEN“ und der erste Termin von morgen groß", ab.map((x) => x.t));
  ok(ab.some((x) => x.t === "N2 Vorbereitung") && ab.some((x) => x.t === "14:00"), "Abends: rechts die weiteren Termine von morgen", ab.map((x) => x.t));

  // dunkel: schwarz wie die App, Rot heller
  const { bauen: bd } = welt(true, JETZT); const md = bd(TAG, "medium");
  ok(md.backgroundColor.h === "#000000", "Plakat dunkel: schwarzer Grund (wie die App)", md.backgroundColor.h);
  ok(!!texte(md).find((x) => x.t === "JETZT" && x.c === ROT_D), "Plakat dunkel: Zeile „JETZT“ im hellen Rot", texte(md).slice(0, 2));

  // ohne Angabe (älteste Daten) ebenfalls Plakat; Smaragd behält den bisherigen Aufbau
  ok(!!finde(welt(false, JETZT).bauen({ ...TAG, skin: undefined }, "medium"), "JETZT"), "Ohne eingestellten Look: Plakat");
  const sm = texte(welt(false, JETZT).bauen({ ...TAG, skin: "smaragd" }, "medium")).map((x) => x.t);
  ok(sm.includes("ALS NÄCHSTES"), "Smaragd Ruhig: bisheriger Aufbau bleibt", sm.slice(0, 3));

  // Sperrbildschirm wie im Board: Uhrzeit fett, darunter der Titel
  const sp = texte(welt(false, JETZT - 60 * 60000).bauen(TAG, "accessoryRectangular"));
  ok(sp[0] && sp[0].t === "14:00" && sp[0].w === 900 && sp[1] && sp[1].t === "Seminar Mathe-Didaktik", "Sperrbildschirm: Uhrzeit fett, darunter der Titel", sp);

  // noch nicht eingerichtet: Hinweis statt Absturz
  ok(texte(welt(false, JETZT).bauen(null, "medium")).some((x) => /einzurichten/.test(x.t)), "Ohne Einrichtung: Hinweis zum Einrichten");
}

/* ---------- Vorschau als Seite (nur wenn ein Dateiname angegeben ist) ---------- */
if (process.argv[2]) {
  const css = (c) => c ? c.h : "transparent";
  const html = (e, vp) => {
    if (e.k === "sp") return e.n == null ? '<div style="flex:1 1 0"></div>' : `<div style="flex:none;${vp ? "height" : "width"}:${e.n}px"></div>`;
    if (e.k === "t") return `<div style="font:${e.font.w} ${e.font.n}px -apple-system,'Inter',sans-serif;color:${css(e.textColor)};white-space:${e.lineLimit > 1 ? "normal" : "nowrap"};overflow:hidden;text-overflow:ellipsis;min-width:0;line-height:1.1;letter-spacing:${e.font.w >= 900 && e.font.n > 30 ? "-.04em" : "0"}">${e.t}</div>`;
    if (e.k === "i") return `<div style="width:${e.imageSize.w}px;height:${e.imageSize.h}px;border-radius:50%;background:${css(e.tintColor)};opacity:.5"></div>`;
    let st = `display:flex;flex-direction:${e.vert ? "column" : "row"};min-width:0;align-items:${e.vert ? "flex-start" : e.al || "center"};`;
    if (e.pad) st += `padding:${e.pad.map((x) => x + "px").join(" ")};`;
    if (e.spacing) st += `gap:${e.spacing}px;`;
    if (e.backgroundColor) st += `background:${css(e.backgroundColor)};`;
    if (e.cornerRadius) st += `border-radius:${e.cornerRadius}px;`;
    if (e.size && e.size.w) st += `width:${e.size.w}px;flex:none;`;
    if (e.size && e.size.h) st += `height:${e.size.h}px;flex:none;`; else if (e.size && e.size.w === 0) st += "align-self:stretch;";
    if (e.size && e.size.w === 0 && e.size.h) st += "align-self:stretch;width:auto;";
    return `<div style="${st}">${e.kids.map((k) => html(k, e.vert)).join("")}</div>`;
  };
  let out = "";
  for (const dunkel of [false, true]) {
    out += `<div style="padding:20px;background:${dunkel ? "#1C1C1E" : "#E9E4DC"}">`;
    for (const [jetzt, d] of [[JETZT, TAG], [JETZT - 60 * 60000, TAG], [new Date(2026, 10, 12, 21, 0).getTime(), TAG]]) {
      const { bauen } = welt(dunkel, jetzt);
      for (const [fam, w, h] of [["small", 170, 170], ["medium", 364, 170], ["large", 364, 382]]) {
        const wd = bauen(d, fam);
        out += `<div style="width:${w}px;height:${h}px;border-radius:22px;overflow:hidden;margin:8px;display:inline-flex;vertical-align:top;background:${css(wd.backgroundColor)}">${html(wd, true).replace("display:flex", "display:flex;width:100%;height:100%;box-sizing:border-box")}</div>`;
      }
      out += "<br>";
    }
    out += "</div>";
  }
  fs.writeFileSync(process.argv[2], `<!doctype html><meta charset=utf-8><body style="margin:0;width:1260px">${out}</body>`);
}

console.log("\n" + (anzahl - fehler) + " ok, " + fehler + " Fehler");
process.exit(fehler ? 1 : 0);
