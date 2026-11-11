# Kurzbefehle und Siri für Jarvis

Voraussetzung: Das Widget-Skript ist eingerichtet (siehe Ordner „widget“, Schritte 1 bis 3).
Die Kurzbefehle schicken eine Notiz an Jarvis. Jarvis übernimmt sie, sobald die App das nächste Mal offen ist.

Tipp: Das Wort (zum Beispiel `notiz:`) nicht direkt in „Skript ausführen“ eintippen, das klappt dort oft nicht. Es kommt vorher in eine eigene Aktion **Text**.

Die Kurzbefehle „Arbeit starten“, „Pause“, „Feierabend“ und „Uni starten“ gibt es nicht mehr (die Zeiterfassung ist aus Jarvis raus). Falls du sie angelegt hast, kannst du sie löschen.

## Jarvis notieren (mit Siri)
1. Neuer Kurzbefehl, Aktion **Text diktieren**.
2. Aktion **Text** hinzufügen und hineinschreiben: `notiz:` und direkt dahinter die blaue Variable **Diktierter Text**.
3. Aktion **Run Script** (Scriptable), Script **Jarvis**, Parameter: die blaue Variable **Text**.
4. Name: **Jarvis notieren**.

Die Notiz landet in Jarvis bei den **Notizen**.

## Claude öffnen
Öffnet direkt dein Planungs-Projekt in Claude.
1. Neuer Kurzbefehl, Aktion **URL** wählen und den Link zu deinem Planungs-Projekt einfügen.
2. Aktion **URLs öffnen** dazunehmen.
3. Name: **Claude öffnen**.

Im Widget-Menü gibt es denselben Punkt. Beim ersten Mal fragt es nach dem Link: einfügen, Speichern. Ändern geht im Menü über „Claude-Link ändern“.

## Mit Siri sprechen
Siri kennt jeden Kurzbefehl beim Namen: „Hey Siri, **Jarvis notieren**“, „Hey Siri, **Claude öffnen**“.
Siri sagt danach kurz, was passiert ist.

## Noch schneller
- Kurzbefehle lassen sich ins Kontrollzentrum oder auf die Aktionstaste legen (Einstellungen › Aktionstaste › Kurzbefehl).
- Das Widget „Kurzbefehle“ auf dem Home-Bildschirm zeigt deine Jarvis-Kurzbefehle als Knöpfe.
