# GitHub AI Development

> Ein GitHub-Issue rein, ein reviewter Pull Request raus: autonome Softwareentwicklung, bei der KI-Agenten in festen Rollen zusammenarbeiten, komplett innerhalb von GitHub.

## Idee

**GitHub AI Development** ist eine Erweiterung für GitHub-Repositories. Sie greift Issues auf und führt für jedes Issue einen **vollständigen Softwareentwicklungszyklus** durch: von der Anforderungsanalyse über die Implementierung und den Test bis zum Review.

Dafür bildet das System ein Entwicklungsteam aus spezialisierten **Rollen** nach, zum Beispiel Requirements Engineer, Softwareentwickler, Tester und Reviewer. Jede Rolle ist ein KI-Agent auf Basis von **Claude Code**, der als Job in einem **GitHub-Actions-Workflow** läuft.

Es wird **keine eigene Infrastruktur** benötigt: kein Server, keine Datenbank, kein Docker-Host. GitHub übernimmt alles:

| Aufgabe | Umsetzung in GitHub |
|---|---|
| Laufzeitumgebung der Agenten | GitHub-Actions-Runner, eine frische, isolierte VM pro Job |
| Orchestrierung / Zustand | Labels am Issue als State Machine |
| Zentrales Dokument (Status, Anforderungen, Entscheidungen) | Issue-Beschreibung |
| Arbeitsergebnisse | Feature-Branch und Pull Request |
| Trigger | GitHub-Events (`issues`, `issue_comment`, `pull_request_review`, …) |
| Secrets | Repository- bzw. Organisations-Secrets |

## Kernprinzipien

- **GitHub ist die Plattform und die Quelle der Wahrheit.** Der gesamte Zustand ist in Labels, Kommentaren, Branches und PRs sichtbar und für Menschen nachvollziehbar.
- **Die Issue-Beschreibung ist das zentrale Dokument.** Dort stehen jederzeit Status, Branch, Anforderungen und alle wichtigen Entscheidungen. Auf dem Branch und im PR liegt die eigentliche Arbeit.
- **Eine Rolle, ein Job, eine Aufgabe.** Jeder Agent startet in einer frischen VM mit klar begrenztem Auftrag.
- **Ereignisgesteuert statt dauerhaft laufend.** Ein Workflow läuft nur, solange ein Agent arbeitet. Wartezeiten, etwa auf eine menschliche Antwort, kosten nichts.
- **Rollen sind konfigurierbar.** Rollen sind Prompt-Dateien, der Ablauf ist eine Konfigurationsdatei, beides pro Repository anpassbar.
- **Der Mensch bleibt im Loop.** Rückfragen, die Freigabe der Anforderungen vor der Implementierung und das finale Mergen liegen bei Menschen.

## Sprache

- **Code, Branches, Labels, Commit-Messages und technische Bezeichner** sind immer **Englisch**.
- **Dokumentation, Issue-Beschreibung, Issue- und PR-Kommentare sowie die PR-Beschreibung** werden in der **Sprache des initialen Issues** verfasst. Wer ein Issue auf Deutsch schreibt, bekommt Status, Rückfragen und Berichte auf Deutsch.

## Architektur

```
                     ┌──────────────────────────────────────────────┐
                     │              GitHub-Repository               │
                     │                                              │
  Mensch erstellt ──▶│  Issue  ──label──▶ ai:requirements           │
  Issue + Label      │    ▲                     │                   │
                     │    │                     ▼  (Event: labeled) │
                     │    │      ┌──────────────────────────────┐   │
                     │    │      │  GitHub Actions Workflow     │   │
                     │    │      │                              │   │
                     │    │      │  Router: Label → Rolle       │   │
                     │    │      │     │                        │   │
                     │    │      │     ▼                        │   │
                     │    │      │  Job auf Runner:             │   │
                     │    │      │   - Branch auschecken        │   │
                     │    │      │   - Rollen-Prompt laden      │   │
                     │    │      │   - Claude Code (headless)   │   │
                     │    │      │   - Ergebnis auswerten       │   │
                     │    │      └──────────────┬───────────────┘   │
                     │    │                     │                   │
                     │    └── Issue-Text, ◀─────┘                   │
                     │        nächstes Label, Commits, PR           │
                     └──────────────────────────────────────────────┘
```

### Einstieg

Wird ein Issue mit dem Label `ai-development` versehen, bereitet der Workflow die Bearbeitung vor, bevor der erste Agent startet:

1. Er hängt unter den ursprünglichen Text der **Issue-Beschreibung** einen markierten AI-Bereich an, mit Abschnitten für Status, Anforderungen und Entscheidungen (siehe [Issue-Beschreibung als zentrales Dokument](#issue-beschreibung-als-zentrales-dokument)).
2. Er trägt dort den Branch-Namen **`ai/issue-<nummer>`** ein. Angelegt wird der Branch erst vom Entwickler mit dem ersten echten Commit.
3. Er setzt das Label `ai:requirements` und startet damit die erste Rolle.

### Ablauf eines einzelnen Agenten-Laufs

1. Ein Event tritt ein, z. B. wird das Label `ai:develop` gesetzt.
2. Der Workflow ermittelt anhand des Labels die zuständige Rolle.
3. Ein Job startet auf einem GitHub-Runner, checkt den Branch `ai/issue-<nummer>` aus und installiert Claude Code.
4. Claude Code läuft im Headless-Modus mit dem **Rollen-Prompt** sowie der Issue- und PR-Nummer. Den weiteren Kontext liest der Agent selbst aus Issue, PR und Branch (siehe [Kontext zwischen den Rollen](#kontext-zwischen-den-rollen)).
5. Der Agent erledigt seine Aufgabe und gibt ein **strukturiertes Ergebnis** aus (z. B. `done`, `needs_clarification`, `tests_failed`, `changes_requested`).
6. Der Workflow aktualisiert den **Status in der Issue-Beschreibung**, entfernt das aktuelle Label und setzt das **Label der nächsten Phase**. Das löst den nächsten Lauf aus.

## Der Entwicklungszyklus

```
  Issue erstellt + Label "ai-development"
        │
        ▼
  Einstieg: AI-Bereich in der Issue-Beschreibung anlegen
        │
        ▼
┌──────────────────────┐ needs_clarification ┌─────────────────────┐
│ 1. Requirements      │ ──────────────────▶ │ ai:needs-human      │
│    Engineering       │ ◀────────────────── │ Rückfrage als       │
│  (ai:requirements)   │  Antwort-Kommentar  │ Issue-Kommentar     │
└──────────┬───────────┘                     └─────────────────────┘
           │ Anforderungen + Akzeptanzkriterien in der Issue-Beschreibung
           ▼
┌──────────────────────┐ anderer Kommentar   ┌─────────────────────┐
│ Freigabe durch       │ ──────────────────▶ │ zurück an           │
│ Menschen             │                     │ Requirements        │
│ (ai:awaiting-        │                     │ (Feedback wird      │
│  approval)           │                     │  eingearbeitet)     │
└──────────┬───────────┘                     └─────────────────────┘
           │ Kommentar "/approve"
           ▼
┌──────────────────────┐
│ 2. Implementierung   │ ◀──────────────────────┐
│  (ai:develop)        │                        │
└──────────┬───────────┘                        │
           │ Branch ai/issue-<nr> + Draft-PR    │
           ▼                                    │
┌──────────────────────┐   tests_failed         │
│ 3. Test              │ ───────────────────────┤
│  (ai:test)           │                        │
└──────────┬───────────┘                        │
           │ Tests grün                         │
           ▼                                    │
┌──────────────────────┐   changes_requested    │
│ 4. Review            │ ───────────────────────┘
│  (ai:review)         │
└──────────┬───────────┘
           │ approved
           ▼
   ai:ready-to-merge → PR wird "ready for review" → Mensch prüft und merged
```

| Phase | Rolle | Ergebnis |
|---|---|---|
| Analyse | **Requirements Engineer** | Anforderungen und Akzeptanzkriterien in der Issue-Beschreibung, ggf. Rückfragen als Issue-Kommentar |
| Freigabe | **Mensch** | `/approve` als Issue-Kommentar oder Feedback zu den Anforderungen |
| Umsetzung | **Softwareentwickler** | Branch `ai/issue-<nr>` mit der Implementierung, Draft-PR mit `Closes #<issue>` |
| Qualitätssicherung | **Tester** | Ergänzte bzw. ausgeführte Tests, Testbericht als PR-Kommentar |
| Review | **Reviewer** | Code-Review im PR, Freigabe oder Änderungsanforderung |

Jede Rolle trägt ihre wichtigen Entscheidungen in die Issue-Beschreibung ein. Die Begründung für eine Änderung schreibt sie als Issue-Kommentar.

### Mindestinformationen im Issue

Der Requirements Engineer entscheidet nicht nach Gefühl, ob ein Issue klar genug ist, sondern prüft feste Kriterien. Jedes muss sich aus dem Issue, den Kommentaren oder eindeutig aus dem Code ergeben:

| Kriterium | Frage |
|---|---|
| **Ziel** | Welches Problem wird gelöst bzw. welcher Nutzen entsteht? |
| **Erwartetes Verhalten** | Was soll nach der Umsetzung konkret passieren? Mindestens ein nachprüfbares Beispiel (Eingabe → Ergebnis bzw. Aktion → Reaktion). |
| **Abgrenzung** | Was gehört ausdrücklich nicht dazu? Bei kleinen Änderungen darf das kurz ausfallen. |
| **Erfolgskriterium** | Woran erkennt man, dass das Issue erledigt ist? Daraus entstehen die Akzeptanzkriterien. |

Ist ein Kriterium nicht erfüllt, fragt er nach (`needs_clarification`), statt zu raten. Alle Fragen kommen gesammelt in einem Kommentar, jeweils mit einem Vorschlag, den der Mensch einfach bestätigen kann. Annahmen trifft er nur bei Details, die keines der vier Kriterien betreffen, und kennzeichnet sie im Abschnitt *Entscheidungen* als **Annahme**.

### Freigabe der Anforderungen

Bevor Code entsteht, gibt ein Mensch die Anforderungen frei. Meldet der Requirements Engineer `done`, geht das Issue nicht direkt in die Implementierung, sondern auf `ai:awaiting-approval`:

1. Der Requirements Engineer schreibt einen Kommentar mit einer kurzen Zusammenfassung der Anforderungen, Akzeptanzkriterien und aller Annahmen und bittet um Freigabe.
2. Antwortet der Mensch mit einem Kommentar, der mit **`/approve`** beginnt, startet die Implementierung (`ai:develop`).
3. Jeder andere Kommentar gilt als Feedback. Das Issue geht zurück an den Requirements Engineer, der das Feedback einarbeitet und erneut um Freigabe bittet.

Der Befehl `/approve` ist bewusst sprachunabhängig und eindeutig, damit kein Agent interpretieren muss, ob „passt so, aber …“ eine Freigabe ist. Die Freigabe ist standardmäßig aktiv und lässt sich pro Repository abschalten (`approval: false`, siehe [Konfiguration](#rollen-und-ablauf-konfigurieren)).

### Rücksprünge

Rücksprünge sind ausdrücklich vorgesehen. Ein Iterationszähler im Status der Issue-Beschreibung begrenzt die Anzahl der Durchläufe. Wird das Limit erreicht, eskaliert das System per `ai:needs-human` an einen Menschen.

### Labels als State Machine

| Label | Bedeutung |
|---|---|
| `ai-development` | Issue soll vom System bearbeitet werden (Einstieg) |
| `ai:requirements` | Requirements Engineer ist am Zug |
| `ai:develop` | Entwickler ist am Zug |
| `ai:test` | Tester ist am Zug |
| `ai:review` | Reviewer ist am Zug |
| `ai:awaiting-approval` | Anforderungen stehen, wartet auf Freigabe (`/approve`) oder Feedback |
| `ai:needs-human` | Wartet auf menschliche Antwort oder Entscheidung |
| `ai:ready-to-merge` | Zyklus abgeschlossen, PR wartet auf menschlichen Merge |
| `ai:failed` | Abbruch, z. B. Iterationslimit oder technischer Fehler |

## Kontext zwischen den Rollen

Es gibt kein separates Übergabe-Dokument. Der gesamte Zustand liegt bereits in GitHub, und jeder Agent liest selbst, was er braucht:

| Information | Wo sie liegt |
|---|---|
| Ursprüngliche Anfrage | Issue-Beschreibung, Text oberhalb des AI-Bereichs |
| Status, Branch, PR, Anforderungen, Akzeptanzkriterien, Entscheidungen | Issue-Beschreibung, AI-Bereich |
| Rückfragen, Antworten, Begründungen für Änderungen | Issue-Kommentare |
| Was bisher getan wurde | Branch: Commits und Diff gegen den Default-Branch |
| Was noch offen ist (Testfehler, Review-Anmerkungen) | PR-Kommentare und Reviews |
| Wo wir im Ablauf stehen | Labels |

Der Workflow übergibt dem Agenten nur die Issue-Nummer. Den Rest holt sich der Agent mit `gh issue view --comments`, `gh pr view --comments` und `git diff`. Das hält die Prompts klein, und jede Rolle liest genau das, was sie braucht.

### Issue-Beschreibung als zentrales Dokument

Die Issue-Beschreibung ist das lebende Dokument des Vorgangs. Der ursprüngliche Text des Erstellers bleibt oben unverändert stehen. Darunter pflegen die Agenten einen **markierten AI-Bereich**:

```markdown
Als Nutzer möchte ich mich einloggen können, ohne ein eigenes Passwort anzulegen.

<!-- ai-development:start -->
---
## 🤖 AI Status

**Phase:** Test (Iteration 2 von 5)
**Branch:** `ai/issue-42`
**Pull Request:** #57

## Anforderungen
- Login über GitHub-OAuth
- Neue Nutzer werden beim ersten Login automatisch angelegt

## Akzeptanzkriterien
- [x] Login-Button auf der Startseite leitet zu GitHub weiter
- [x] Nach erfolgreichem Login ist der Nutzer angemeldet
- [ ] Abgebrochener Login zeigt eine verständliche Fehlermeldung

## Entscheidungen
- Login per OAuth statt Passwort (Antwort auf Rückfrage, 17.11.)
- Bestehende `UserService`-Klasse wird erweitert, kein neuer Service (Requirements Engineer)
- Validierung in eigene Klasse ausgelagert (Reviewer, Iteration 1)

## Verlauf
- ✅ Requirements: Anforderungen festgelegt
- ✅ Freigabe: Anforderungen freigegeben
- ✅ Implementierung: erster Stand
- ❌ Test: 2 Tests fehlgeschlagen → zurück an Entwicklung
- ✅ Implementierung: Fehler behoben
- ⏳ Test läuft …
<!-- ai-development:end -->
```

Regeln für die Agenten:

- **Nur der AI-Bereich wird verändert.** Der Text oberhalb der Markierung gehört dem Menschen.
- **Änderungen werden begründet.** Ändert ein Agent Anforderungen, Akzeptanzkriterien oder Entscheidungen, schreibt er die Begründung als Issue-Kommentar.
- **Vor dem Schreiben neu lesen.** Ein Agent liest die Beschreibung direkt vor dem Speichern erneut ein, damit er keine zwischenzeitlichen Änderungen eines Menschen überschreibt.
- **Menschen dürfen mitschreiben.** Passt ein Mensch Anforderungen im AI-Bereich an, gilt das als verbindlich.

GitHub speichert den Bearbeitungsverlauf der Issue-Beschreibung, sodass jede Änderung nachvollziehbar bleibt.

### PR-Beschreibung

Die PR-Beschreibung bleibt schlank: `Closes #<issue>` und eine kurze Zusammenfassung der Änderungen. Anforderungen und Akzeptanzkriterien werden nicht dupliziert, sondern stehen nur im Issue.

## Rollen und Ablauf konfigurieren

Rollen sind einfache Markdown-Prompts. Der Ablauf wird in einer Konfigurationsdatei im Ziel-Repository beschrieben:

```
.github/
├── ai-development.yml          # Ablauf / Übergänge
├── ai-roles/
│   ├── requirements-engineer.md
│   ├── developer.md
│   ├── tester.md
│   └── reviewer.md
└── workflows/
    └── ai-development.yml      # ruft die Actions route und run auf
```

```yaml
# .github/ai-development.yml
trigger_label: ai-development
branch_prefix: ai/issue-
max_iterations: 5

phases:
  requirements:
    role: requirements-engineer
    approval: true          # nach "done" erst Freigabe per /approve, dann develop
    on:
      done: develop
      needs_clarification: needs-human
  develop:
    role: developer
    on:
      done: test
  test:
    role: tester
    on:
      tests_passed: review
      tests_failed: develop
  review:
    role: reviewer
    on:
      approved: ready-to-merge
      changes_requested: develop
```

Weitere Rollen wie *Architekt*, *Security-Auditor* oder *Dokumentations-Autor* entstehen durch eine neue Prompt-Datei und einen Eintrag in der Konfiguration, ohne Änderungen am Workflow selbst.

## Einbindung in ein Repository

Die Erweiterung besteht aus zwei **Composite Actions**, die ein Projekt in seinem eigenen Job aufruft. Dazwischen richtet das Projekt mit den üblichen Mitteln seine Umgebung ein: Setup-Actions, `services:` oder eigene `run:`-Schritte. Der Workflow selbst kennt deshalb keine Sprache und kein Framework.

```yaml
# .github/workflows/ai-development.yml (Ausschnitt, vollständig in templates/workflows/ai-development.yml)
jobs:
  ai:
    runs-on: ubuntu-latest
    steps:
      - id: ai
        uses: derlarsschneider/github-ai-development/route@v1
        with:
          github_token: ${{ secrets.AI_PAT }}

      # Projektumgebung, läuft nur, wenn ein Agent startet
      - if: steps.ai.outputs.run == 'true'
        uses: actions/setup-node@v4
      - if: steps.ai.outputs.run == 'true'
        run: npm ci

      - if: always() && steps.ai.outputs.run == 'true'
        uses: derlarsschneider/github-ai-development/run@v1
        with:
          job_status: ${{ job.status }}
          github_token: ${{ secrets.AI_PAT }}
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          checks: |
            npm run lint
            npm test
          tools: Bash(npm:*),Bash(node:*)
```

- `route` entscheidet, was ein Ereignis bedeutet. Alles ohne Agent (Init, Freigabe, Antworten) erledigt es selbst. Soll ein Agent laufen, checkt es den Issue-Branch aus und setzt `run` auf `true`.
- `run` startet den Agenten der aktuellen Phase und wertet sein Ergebnis aus. Ist ein Setup-Schritt des Projekts fehlgeschlagen (`job_status` ist nicht `success`), startet kein Agent, und das Issue bekommt `ai:failed`.
- `checks`: die Prüfbefehle des Projekts, einer pro Zeile, als einfache Befehle ohne `&&` oder Pipes. Developer, Tester und Reviewer führen sie aus, sie stehen in deren Prompt.
- `tools`: zusätzliche Werkzeuge für Developer und Tester in Claude-Code-Syntax. Der Reviewer bekommt nur die `checks`-Befehle.
- Projektkonventionen (Sprache, Framework, wie ein fehlendes Projektgerüst angelegt wird, wie lokale Dienste gestartet werden) gehören in die `CLAUDE.md` des Projekts. Claude Code liest sie automatisch.

### Voraussetzungen

1. **Claude-Zugang** als Secret: ein Abo-Token aus `claude setup-token` (Input `claude_code_oauth_token`) oder ein Anthropic API-Key (Input `anthropic_api_key`).
2. **Token für GitHub** als Secret, heute ein fine-grained PAT (`AI_PAT`) mit *Contents*, *Issues* und *Pull requests* (Lesen und Schreiben) auf dem Projekt. Das Standard-`GITHUB_TOKEN` reicht nicht, weil Aktionen damit **keine weiteren Workflows auslösen** und die Kette nach der ersten Phase stoppen würde. Zielbild ist eine GitHub App mit eigener Bot-Identität.
3. Das Label `ai-development`. Die übrigen Labels legt der erste Lauf an.

## Sicherheit

- **Nur berechtigte Auslöser:** Läufe starten nur, wenn das Label bzw. der Kommentar von einer Person mit Schreibrechten stammt (Prüfung über `author_association` bzw. die Collaborator-Berechtigung). So können Fremde bei öffentlichen Repositories keine Agenten mit Secrets starten.
- **Prompt Injection:** Issue-Inhalte gelten als nicht vertrauenswürdige Eingaben. Die Rollen-Prompts weisen die Agenten an, Anweisungen aus Issue-Texten nicht über ihre Rolle hinaus zu befolgen.
- **Minimale Rechte:** Jede Rolle erhält nur die Werkzeuge und Token-Rechte, die sie braucht. Der Reviewer darf z. B. keinen Code pushen.
- **Kein automatisches Mergen:** Agenten mergen nie in geschützte Branches. Das letzte Wort hat ein Mensch (Branch Protection).
- **Isolation:** Jeder Job läuft in einer frischen Runner-VM, die nach dem Lauf verworfen wird.
- **Nachvollziehbarkeit:** Jeder Lauf ist in den Actions-Logs, als Job-Summary und in der Issue-Beschreibung samt Bearbeitungsverlauf dokumentiert.

## Grenzen und Kosten

- **Actions-Minuten:** Für öffentliche Repositories kostenlos. Bei privaten Repositories zählt die Laufzeit gegen das Kontingent, auch die Zeit, in der der Agent auf die API wartet.
- **Laufzeit:** Ein Job darf maximal 6 Stunden laufen, für einzelne Rollen mehr als ausreichend.
- **API-Kosten:** Fallen pro Agenten-Lauf bei Anthropic an. Limits für Turns bzw. Laufzeit pro Rolle halten sie kalkulierbar.
- **Kein zentrales Dashboard:** Die Übersicht erfolgt über GitHub selbst (Label-Filter, Actions-Tab, Projects-Board).

## Mögliche Ausbaustufe: externes Backend

Der GitHub-only-Ansatz kommt ohne eigene Infrastruktur aus. Werden später Funktionen über GitHub hinaus benötigt, kann ein separates Backend ergänzt werden, etwa auf einem eigenen Server. Es ersetzt die Workflows nicht, sondern erweitert sie, zum Beispiel um:

- ein Dashboard über mehrere Repositories
- Kosten-Tracking und Budgets pro Repository oder Issue
- komplexere Workflow-Logik oder Mandantenfähigkeit (SaaS)

## Offene Fragen

- Parallele Bearbeitung mehrerer Issues: Wie werden Konflikte zwischen Feature-Branches behandelt?
- Zusätzlich Veröffentlichung im GitHub Marketplace?
- Wie werden Agenten-Ergebnisse robust ausgewertet (z. B. JSON-Ausgabe von Claude Code mit festem Schema)?

## Status

🚧 Prototyp. Die Actions laufen im Projekt TeamWorkTime. Der Prototyp weicht in einigen Punkten vom Zielbild oben ab:

- Statt einer GitHub App nutzt er einen fine-grained PAT (`AI_PAT`).
- Die Freigabe der Anforderungen ist immer aktiv, eine Konfigurationsdatei `.github/ai-development.yml` gibt es noch nicht.

## Aufbau dieses Repositorys

Dieses Repository ist die einzige Quelle des Workflows. Projekte enthalten nur ihre eigene Workflow-Datei, die die beiden Actions aufruft.

```
route/action.yml                         # Action: Ereignis auswerten, Branch vorbereiten
run/action.yml                           # Action: Agentenlauf und Auswertung
.github/ai/                              # Orchestrierung (Node, ohne Abhängigkeiten)
.github/ai/test/                         # Tests: node --test '.github/ai/test/**/*.test.mjs'
.github/ai-roles/                        # Rollen-Prompts
templates/workflows/ai-development.yml   # Vorlage für die Workflow-Datei des Projekts
docs/                                    # Pläne und Notizen
```

Die Actions bringen Orchestrierung und Rollen-Prompts aus diesem Repository mit, in der Version, die im `uses:` steht. Sie liegen außerhalb des Projekt-Workspace, ein Agent kann sie also nicht verändern.

### Ein Projekt anbinden

1. `templates/workflows/ai-development.yml` nach `.github/workflows/` des Projekts kopieren.
2. Den markierten Abschnitt „Project environment“ durch die eigene Einrichtung ersetzen, dann `checks` und `tools` anpassen.
3. Die Secrets anlegen (siehe Voraussetzungen). Der PAT braucht nur Rechte auf das eigene Projekt.
4. Projektkonventionen in einer `CLAUDE.md` im Projekt festhalten.
5. Das Label `ai-development` anlegen.

Projekte nutzen `@v1`. Der Tag zeigt immer auf das neueste Release `v1.x.y`, eine Änderung auf `main` wirkt also nicht sofort auf alle Projekte. Zum Testen einer Änderung kann ein Projekt vorübergehend einen Branch angeben, z. B. `@main`.
