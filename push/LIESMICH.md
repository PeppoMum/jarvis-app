# Meldungen: so funktioniert es

Bei GitHub läuft alle 5 Minuten ein kleiner Zeitplan (`.github/workflows/meldungen.yml`). Er startet `push/senden.mjs`. Das Skript
- meldet sich als **Versand-Helfer** bei Firebase an (eigenes Konto, darf Phils Daten nur lesen und ein paar Felder schreiben),
- holt Aufgaben, Gewohnheiten usw. aus Firebase, die Termine über den Google-Zugang der App (sonst über die geheime iCal-Adresse), das Wetter von Open-Meteo und amtliche Warnungen über Bright Sky,
- schickt fällige Meldungen an alle Geräte, auf denen Phil Meldungen eingeschaltet hat,
- legt die Texte für die Startseite ab (meta/brief, meta/briefEvening, meta/briefWeekly) und frischt die Widget-Daten auf (widget/<schlüssel>).

Keine KI, keine Kosten. GitHub-Zeitpläne starten oft ein paar Minuten später; eine Meldung wird bis zu 2 Stunden nach ihrer Uhrzeit nachgeholt, danach nicht mehr.

| Meldung | Wann (Standard, in der App änderbar) |
|---|---|
| Morgenbericht | Mo–Fr 6:45, Sa/So 9:00 |
| Abendrückblick | täglich 20:45 |
| Wochenplanung | Sonntag 18:45 |
| Losfahren | 15 Minuten vor der Losfahrzeit (Fahrzeiten aus den Planungs-Einstellungen) |
| Unwetter | sobald der Wetterdienst warnt (in der Ruhezeit nur starke Warnungen) |
| Gewohnheiten, Aufgaben | zur eingestellten Erinnerungszeit (nicht in der Ruhezeit) |

## Einrichten (einmal)
1. **Firebase › Authentication › Nutzer hinzufügen**: E-Mail `meldungen@jarvis-app.web.app`, Passwort selbst ausdenken (lang, irgendwo notieren).
2. **Firebase › Authentication**: bei deinem eigenen Konto die **Nutzer-UID** kopieren.
3. **GitHub › jarvis-app › Settings › Secrets and variables › Actions › New repository secret**, drei Einträge:
   - `HELFER_PASSWORT`: das Passwort aus Schritt 1
   - `VAPID_PRIVAT`: der Schlüssel, den Claude dir geschickt hat
   - `JARVIS_UID`: die Nutzer-UID aus Schritt 2
   - nur falls der Google-Zugang nicht klappt: `KALENDER_ICAL` mit der „Privatadresse im iCal-Format“ (Google Kalender › Einstellungen › dein Kalender), eine Adresse pro Zeile
4. **GitHub › Actions › Meldungen › Run workflow**: einmal von Hand starten. Grüner Haken = alles gut.
5. In der Jarvis-App (vom Home-Bildschirm aus geöffnet): **Mehr › Einstellungen › Meldungen › Meldungen einschalten**, dann **Probemeldung schicken**.

## Gut zu wissen
- Das Protokoll bei GitHub ist öffentlich lesbar. Es enthält nur Zahlen (wie viele Termine, was gesendet wurde), keine Titel oder Namen.
- Wenn das Projekt 60 Tage lang nicht verändert wird, hält GitHub den Zeitplan an und schickt vorher eine Mail. Dann bei **Actions › Meldungen** auf „Enable workflow“ tippen.
- Ausprobieren ohne Versand (am Mac im Ordner): `node push/test.mjs`.
