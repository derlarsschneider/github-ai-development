# TeamWorkTime: erste Issues

Reihenfolge einhalten und **immer nur ein Issue gleichzeitig** mit `ai-development` labeln. Das nächste erst starten, wenn der PR des vorherigen gemergt ist. Parallele Branches werden noch nicht abgestimmt.

---

## Issue 1

**Titel:** Flutter-Projektgerüst für TeamWorkTime anlegen

**Beschreibung:**

Lege das Grundgerüst der App an, auf dem alle weiteren Issues aufbauen. Die Architektur steht in `docs/idea.md`.

- Flutter-Projekt im Repository-Root, Zielplattformen Web (als PWA), Android und iOS
- Die App startet und zeigt eine einfache Startseite mit dem Titel „TeamWorkTime“
- Ordnerstruktur, die Fachlogik (Domain), Datenhaltung und UI trennt, damit spätere Issues wissen, wo was hingehört
- Mindestens ein Widget-Test, der prüft, dass die Startseite den Titel anzeigt
- `README.md` mit kurzer Projektbeschreibung und den Befehlen zum Starten (Web) und Testen

Nicht Teil dieses Issues: Login, Supabase, Zeiterfassung.

---

## Issue 2

**Titel:** Timer-Logik als reine Dart-Fachlogik

**Beschreibung:**

Baue die Kernlogik der Zeiterfassung, ohne UI und ohne Speicherung. Siehe „Timer-Modell“ und „Arbeitszeit“ in `docs/idea.md`.

- Pro Benutzer läuft höchstens ein Timer
- Start auf einem Projekt, optional mit Aufgabe (Freitext) und Ticket (Freitext)
- Aufgabe oder Ticket wechseln, ohne den Timer zu stoppen: Der aktuelle Zeitabschnitt endet, ein neuer beginnt nahtlos (ohne Lücke)
- Projekt wechseln: gleiches Verhalten, der Abschnitt endet und ein neuer auf dem anderen Projekt beginnt
- Pause starten und beenden; Pausen werden als eigene Abschnitte aufgezeichnet
- Stopp beendet den laufenden Abschnitt
- Abfrage der Dauer pro Abschnitt und der Summe pro Tag
- Die aktuelle Uhrzeit wird von außen hereingereicht (z. B. als `Clock`), damit alles ohne echtes Warten testbar ist
- Vollständige Unit-Tests für alle oben genannten Fälle, inklusive Grenzfällen (Wechsel ohne laufenden Timer, doppelter Start, Stopp während Pause)

Nicht Teil dieses Issues: UI, Persistenz, Projektverwaltung (Projekte sind hier nur eine ID und ein Name).

---

## Issue 3

**Titel:** Timer-Oberfläche mit Ein-Klick-Start und Wechsel

**Beschreibung:**

Mache die Timer-Logik aus Issue 2 in der App bedienbar.

- Startseite zeigt eine Liste von Projekten. Vorerst fest eingebaute Beispielprojekte, die Projektverwaltung folgt später.
- Ein Klick auf ein Projekt startet den Timer. Läuft schon einer, wird nahtlos auf dieses Projekt gewechselt.
- Beim Start gibt es optional Felder für Aufgabe und Ticket. Ein Start ohne Eingabe muss mit einem Klick möglich bleiben.
- Aufgabe oder Ticket lassen sich ändern, während der Timer läuft (ohne Stopp)
- Buttons für Pause und Stopp
- Das laufende Projekt, die aktuelle Aufgabe und die laufende Zeit sind deutlich sichtbar
- Liste der heutigen Zeitabschnitte mit Tagessumme
- Responsive: nutzbar auf dem Handy und am Desktop-Browser
- Widget-Tests für Start, Wechsel, Pause und Stopp

Nicht Teil dieses Issues: Speicherung (nach einem Neuladen darf alles weg sein), Login.

---

## Issue 4

**Titel:** Lokale Speicherung der Zeitabschnitte (Offline-first-Grundlage)

**Beschreibung:**

Zeitabschnitte sollen lokal auf dem Gerät gespeichert werden. Das ist die Grundlage für Offline-first (siehe „Offline“ in `docs/idea.md`).

- Alle Zeitabschnitte und der laufende Timer werden lokal gespeichert und überstehen ein Neuladen bzw. einen Neustart der App
- Funktioniert im Web (PWA) und ist auch für Android/iOS geeignet
- Die Wahl der Speichertechnik wird als Entscheidung mit Begründung festgehalten. Dabei ist zu berücksichtigen, dass später eine Synchronisation mit Supabase und ein Schutz gegen Manipulation dazukommen.
- Jeder Abschnitt hat eine eindeutige ID, die auch für eine spätere Synchronisation taugt
- Tests für Speichern, Laden und Wiederherstellen eines laufenden Timers

Nicht Teil dieses Issues: Synchronisation mit dem Backend, Manipulationsschutz, Login.

---

## Issue 5 (erst nach Erweiterung des Workflows)

**Titel:** Supabase-Datenmodell für Mandanten, Benutzer und Rollen

> Noch nicht labeln: Der Workflow muss dafür zuerst um die Supabase-CLI (und eine lokale Datenbank für Tests) erweitert werden.

**Beschreibung:**

Lege das Datenmodell für die Mandantenfähigkeit an (siehe Abschnitt Mandantenfähigkeit und „1. Benutzerarten / Rollen“ in `docs/idea.md`).

- Supabase-Projektstruktur im Repo mit SQL-Migrationen unter `supabase/migrations`
- Tabellen für Companies, Benutzerprofile und Mitgliedschaften (Benutzer ↔ Company mit Rolle Prokurist, Projektleiter oder Mitarbeiter)
- Administrator als besonderes Merkmal eines Benutzers, nicht als Rolle
- Row Level Security: Benutzer sehen nur Daten ihrer eigenen Company; Companies sind vollständig voneinander isoliert
- Administrator sieht und verwaltet Companies, aber ohne Zugriff auf deren Inhalte, solange kein Approval eines Prokuristen vorliegt
- Regel: Es muss immer mindestens einen Prokuristen geben (Fallback laut `docs/idea.md`)
- Tests für die RLS-Regeln (z. B. pgTAP)
