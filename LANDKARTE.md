# Landkarte der Jarvis-App

Zuerst diese Datei lesen. Dann nur die Datei öffnen, die du brauchst, und darin mit grep suchen statt sie ganz zu lesen (einige Dateien haben fast 100 KB).

## Grundsatz
„Claude plant, Jarvis zeigt“ (seit 11.11.2026): sichtbar sind nur **Heute**, **Woche**, **Notizen**, dazu Meldungen, Papierkorb, Einstellungen. Die alten Bereiche (Aufgaben, Uni, Zeiten, Mail …) sind nur ausgeblendet, ihr Code liegt noch in den Dateien.

## Start und Daten
- `index.html` – lädt alle Dateien unten in fester Reihenfolge.
- `firebase-config.js`, `firestore.rules` – Verbindung zu Firebase (jarvis-app-e5462) und wer was darf.
- `js/00-start.js` – Firebase, Anmeldung mit Google, Speichern pro Person.
- `js/01-basis.js` – Hilfsfunktionen, Zustand `S`, Speicher `local`/`store`, Design `applyLook()`.
- `js/02-daten.js` – abgeleitete Daten (was heute/diese Woche ansteht).
- `js/google.js` – Google-Kalender, Wetter (Mail-Teile nicht mehr sichtbar).

## Seiten
- `js/03-oberflaeche.js` – Menü (`ROUTES`), `render()`, **Heute** (`pageToday`), **Notizen** (`pageInbox`), **Einstellungen** (`pageSettings`).
- `js/05-seiten-kalender.js` – **Woche** (`pageWeek`), Kalender-Abgleich `calSync()`.
- `js/09-zeiten.js` – Zeit-Regeln: `countsForLoad()` (was in die Wochen-Ampel zählt), `UNI_HINT` (was als Uni gilt).
- `js/13-stunden.js` + `css/stunden.css` – Stunden je Woche, geplant gegen gemacht.
- `js/push.js` – Seite Meldungen, Widget-Daten, Kurzbefehle.
- `js/12-ereignisse.js` – Klicks, Knöpfe, Navigation `go()`.
- Ausgeblendet, nur bei Bedarf öffnen: `04-eingabe` (Schnell notieren), `06-uni`, `07-wetter-mail`, `08-extras`, `10-alltag`, `11-aufgaben-planung`.

## Aussehen
- `css/jarvis.css` – Grundaufbau aller Seiten (groß, gezielt suchen).
- `css/looks.css` – die Designs: **Plakat** (Standard), Smaragd Ruhig, Nur das Jetzt. Hell/Dunkel gilt pro Gerät.
- `icons/` – App-Symbol „J im Ring“ (Vorlage `icons/jarvis.svg`).

## Im Hintergrund (läuft bei GitHub)
- `.github/workflows/meldungen.yml` – alle 5 Minuten: startet `push/senden.mjs`.
- `push/` – Meldungen und Morgenbericht: `senden.mjs` (Ablauf), `jarvis.mjs` (Inhalte, eigene `UNI_HINT`), `kalender.mjs` (Google-Termine, Losfahr-Zeit aus „Abfahrt:“), `wetter.mjs`, `meldungen.mjs`. Erklärung: `push/LIESMICH.md`.
- `widget/Jarvis.js` – Widget fürs iPhone (Scriptable). `widget/ANLEITUNG.md`.
- `kurzbefehle/ANLEITUNG.md` – iPhone-Kurzbefehle.
- `sw.js`, `manifest.webmanifest` – App auf dem Home-Bildschirm.

## Fokus-Timer (eigene Mini-App)
- `fokus/` – unabhängig von Jarvis: `engine.js` (Rechenkern), `app.js` (Oberfläche), `sync.js`, `sound.js`, `fokus.css`. Anleitung `fokus/ANLEITUNG.md`.

## Prüfungen (bei jeder Änderung erweitern)
- `.github/workflows/pruefen.yml` – läuft bei jedem Pull Request.
- `pruefen/app.mjs` – prüft die App im Browser (feste Beispieldaten, Mi 11.11.2026 09:00).
- `push/test.mjs`, `widget/test.mjs`, `fokus/test.mjs` – Prüfungen der Teile.
- Lokal: `PW_PFAD=/opt/node-tools/node_modules/playwright node pruefen/app.mjs`

## Sonstiges
- `BAUPLAN.md` – alter Bauplan (Geschichte). `KI-SPAETER.md` – Wünsche, die KI bräuchten.

## Tipps
- Funktionsnamen vorher per grep prüfen: gleiche Namen überschreiben sich still.
- Regeln, die in App UND `push/` stehen (z. B. `UNI_HINT`), an beiden Stellen ändern.
- Bildschirmfotos: standardmäßig nur eines pro Änderung.
