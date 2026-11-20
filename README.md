# ◐ Quest – Task Manager

Ein Task Manager nach sechs Prinzipien:

1. **Nur eine Aufgabe sichtbar:** Der Fokus-Modus zeigt eine Aufgabe und einen großen Timer.
2. **Zeit messen:** Jede Aufgabe hat einen ▶-Timer, die Zeitblöcke erscheinen im Kalender.
3. **Done-Liste statt To-do:** Das Review zeigt, was du geschafft hast.
4. **Ritualisierte Reflexion:** Das Wochen-Review hat Charts und drei Reflexionsfragen.
5. **Input statt Output:** Die App zählt Quest-Stunden pro Woche und vergleicht sie mit deinem Ziel.
6. **Vertikale Kohärenz:** Jede Aufgabe zahlt auf eine Quest ein, also auf eines deiner großen Ziele.

**Online:** https://danieltomczak2609-max.github.io/task-manager/

## Ansichten
- **Home:** die heutige Quest-Arbeit und Sonstiges, dazu eine Tages-Zeitleiste
- **Plan:** die Woche in Spalten, mit Drag & Drop und wiederkehrenden Aufgaben
- **Kalender:** alle gemessenen Zeitblöcke der Woche, die du bearbeiten oder nachtragen kannst
- **Fokus:** eine Aufgabe mit großem Timer (Leertaste = Start/Pause, Enter = Abschließen)
- **Quests:** deine Ziele mit Stunden pro Woche, Verlauf und Abschluss
- **Review:** der Wochenrückblick mit Reflexion und Done-Liste

## Mac & Handy synchronisieren
Unter ⚙ → „Synchronisierung aktivieren“ bekommst du einen Sync-Link. Öffne ihn auf dem anderen Gerät, dann zeigen beide dieselben Daten. Gespeichert wird in Supabase, ein Konto brauchst du nicht. Wer den Link kennt, sieht die Daten, also teile ihn nur mit dir selbst.

**Auf dem iPhone:** Öffne den Link in Safari und tippe auf Teilen → „Zum Home-Bildschirm“.

## Tastenkürzel
`1–6` Ansichten · `⌘K` / `/` Suche · `N` neue Aufgabe · `#Quest` beim Eintippen ordnet die Aufgabe einer Quest zu

## Technik
Reines HTML/CSS/JS ohne Build-Schritt, offline-fähig (PWA). Für die Synchronisierung nutzt die App Supabase (Postgres-Funktionen `tm_pull`/`tm_push` mit Versionsprüfung). Beim Zusammenführen gewinnt pro Eintrag die neueste Änderung.
