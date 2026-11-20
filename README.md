# ✅ Task Manager

Ein schneller, offline-fähiger Task Manager – läuft komplett im Browser, ohne Server, ohne Anmeldung.

## Starten

- **Online:** über GitHub Pages (Link oben rechts im Repo unter „Pages“).
- **Lokal am Mac:** `index.html` doppelklicken. Oder im Ordner `python3 -m http.server` ausführen und `http://localhost:8000` öffnen (dann funktioniert auch der Offline-Modus).
- **Als App installieren:** In Safari „Teilen → Zum Dock hinzufügen“ (Mac) bzw. „Zum Home-Bildschirm“ (iPhone), in Chrome über das Installieren-Symbol in der Adressleiste.

## Funktionen

- 📥 Eingang, ☀️ Heute (inkl. Überfällig), 📅 Demnächst, 🗂️ Alle, ✅ Erledigt, 📊 Statistik
- 📁 Projekte mit Farben, 🏷️ Tags, ❗ Prioritäten (1–3), 📅 Fälligkeitsdatum
- ☑️ Unteraufgaben mit Fortschrittsbalken, 📝 Notizen
- 🔁 Wiederkehrende Aufgaben (täglich, werktags, wöchentlich, monatlich, jährlich)
- ▦ Kanban-Board (Offen / In Arbeit / Erledigt) mit Drag & Drop
- ↕️ Manuelle Sortierung per Drag & Drop, Aufgaben auf Projekte ziehen
- 🔍 Volltextsuche, Sortierung nach Fälligkeit/Priorität/Datum/Titel
- ⚡ Schnelleingabe: `Bericht schreiben morgen #arbeit !1 @Arbeit`
- ↩️ Rückgängig beim Löschen/Erledigen
- 🌓 Hell/Dunkel, 📱 responsive für Handy, 📴 offline nutzbar (PWA)
- ⬇️⬆️ Export/Import als JSON (Backup & Gerätewechsel)

## Tastenkürzel

| Taste | Aktion |
|---|---|
| `N` | Neue Aufgabe |
| `/` | Suchen |
| `↑`/`↓` oder `J`/`K` | Aufgabe auswählen |
| `X` | Erledigt |
| `Entf` | Löschen |
| `1`–`6` | Ansicht wechseln |
| `B` | Liste/Board |
| `?` | Hilfe |

## Daten

Alle Aufgaben werden nur im `localStorage` deines Browsers gespeichert – nichts landet auf GitHub oder einem Server. Jedes Gerät/jeder Browser hat seine eigenen Daten; zum Übertragen Export → Import nutzen.

## Technik

Reines HTML/CSS/JavaScript, keine Abhängigkeiten, kein Build-Schritt.
