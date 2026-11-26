# Design: AI Development als projektneutrale Action

Stand: 2026-11-23

## Absicht

Der Workflow ist bisher auf TeamWorkTime zugeschnitten: Flutter wird im wiederverwendbaren Workflow installiert, die Agenten dürfen nur `flutter`/`dart` ausführen, und die Rollen-Prompts nennen `flutter analyze`/`flutter test` wörtlich. Jede neue Sprache oder jeder neue Dienst (aktuell: Supabase für TeamWorkTime-Issue 5) würde eine Änderung an `github-ai-development` erzwingen.

Ziel: `github-ai-development` kennt keine Sprache und kein Projekt. Es soll für alle Projekte des Besitzers taugen und auch für fremde Projekte, die ihre eigenen Keys und Tokens mitbringen. Jedes Projekt bringt drei Dinge selbst mit:

1. seine Umgebung (Sprachen, Werkzeuge, Dienste)
2. die Befehle, mit denen die Agenten prüfen und testen, und die Werkzeuge, die sie benutzen dürfen
3. seine Secrets

## Ziele

- Neue Sprachen, Werkzeuge oder Dienste in einem Projekt erfordern keine Änderung an `github-ai-development`.
- Ein Projekt richtet seine Umgebung mit den üblichen GitHub-Actions-Mitteln ein (`actions/setup-*`, `subosito/flutter-action`, `supabase/setup-cli`, `services:`, eigene `run:`-Schritte).
- Fremde Projekte können die Action mit eigenem GitHub-Token und eigenem Claude-Zugang nutzen.
- Der fachliche Ablauf (Phasen, Labels, Übergänge, Issue-Beschreibung als zentrales Dokument, Freigabe, Iterationen) bleibt unverändert.
- TeamWorkTime läuft nach der Umstellung mindestens so gut wie heute und kann Issue 5 (Supabase) ohne weitere Änderung an `github-ai-development` bearbeiten.

## Nicht-Ziele

- Konfigurierbare Phasen, Rollen oder Übergänge (die `.github/ai-development.yml` aus dem README-Zielbild). Kommt später; das Design soll es nicht verbauen.
- Projekteigene Rollen-Prompts.
- GitHub App statt PAT.
- Veröffentlichung im GitHub Marketplace (geht später mit derselben Struktur).
- Parallele Issues.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Irgendetwas Flutter- oder TeamWorkTime-Spezifisches bleibt in `github-ai-development` (Code, Prompts, Template als einzige Variante).
- Ein Agent kann seine eigenen Rechte erweitern, z. B. weil erlaubte Werkzeuge aus einer Datei gelesen werden, die er auf seinem Branch ändern kann.
- Die Setup-Schritte des Projekts (Flutter-Installation, `supabase start` …) laufen bei jedem Kommentar und jeder Freigabe, obwohl gar kein Agent startet.
- Ein Projekt muss Orchestrator-Interna kennen (Pfade wie `$RUNNER_TEMP/orchestrator`, `cli.mjs`-Befehle).

## Rahmenbedingungen

- Orchestrierung bleibt abhängigkeitsfreies Node 22 (ESM, `node:test`).
- `github-ai-development` ist öffentlich. Fremde Projekte können die Actions also ohne Zugriffsfreigabe nutzen. Ihr `AI_PAT` braucht nur Rechte auf das eigene Projekt.
- Das README bekommt eine Anleitung zur Einbindung, die ohne Wissen über TeamWorkTime auskommt: Secrets, beide Claude-Zugänge, Labels, Template anpassen. Eine Lizenz legt der Besitzer selbst fest. Sie ist nicht Teil dieser Arbeit, aber ohne Lizenz dürfen Fremde den Code rechtlich nicht nutzen.
- Agenten dürfen nichts unter `.github/` ändern, und der PAT hat keine Workflows-Berechtigung. Daran ändert sich nichts.
- Bei `issues`- und `issue_comment`-Ereignissen nimmt GitHub die Workflow-Datei immer vom Default-Branch. Inputs, die in der Workflow-Datei des Projekts stehen, kann ein Agent also nicht beeinflussen.
- Gerade läuft TeamWorkTime-Issue 4 über `orchestrate.yml@main`. Diese Datei darf erst wegfallen, wenn TeamWorkTime umgestellt ist.

## Vorgehensweisen (betrachtet)

| | Ansatz | Abwägung |
|---|---|---|
| A | Wiederverwendbarer Workflow bleibt, Projekt beschreibt Setup-Befehle in einer Konfigurationsdatei | Einfach, aber fertige Setup-Actions (mit Caching) sind darin nicht nutzbar. Jedes Projekt müsste Installationen selbst skripten. |
| B | Agent läuft in einem Dev Container des Projekts | Reproduzierbar, auch lokal nutzbar. Aber Container-Build-Zeit, und Docker-in-Docker (z. B. `supabase start`) wird umständlich. |
| **C** | **Composite Actions statt wiederverwendbarem Workflow; das Projekt schreibt seinen eigenen Job mit eigenen Setup-Schritten** | **Gewählt.** GitHub Actions löst Setup für jede Sprache bereits, fremde Projekte kennen das Muster. Preis: Die Workflow-Datei im Projekt wird länger als heute. |

Entscheidung: C, vom Besitzer gewählt. Begründung: Das Setup-Problem ist durch das Actions-Ökosystem schon gelöst, man muss es nur nutzbar machen.

## Entwurf

### Zwei Actions

Im Repository entstehen zwei Composite Actions:

- `route/action.yml`: entscheidet, was zu tun ist, und erledigt alles ohne Agent (init, resume, approve, revise). Bei einem Agentenlauf checkt sie das Projekt aus, bereitet den Branch vor und setzt `run=true`.
- `run/action.yml`: führt einen Agentenlauf aus (Claude Code installieren, Prompt bauen, Agent starten, Ergebnis auswerten, Summary, Artefakt).

Damit gilt die Reihenfolge im Projekt: `route` → Setup-Schritte des Projekts (nur bei `run == 'true'`) → `run`. Die Setup-Schritte laufen nur, wenn wirklich ein Agent startet (Anti-Ziel 3).

Der Orchestrator-Code liegt im Action-Verzeichnis (`$GITHUB_ACTION_PATH`), außerhalb des Workspace. Den zweiten Checkout und das Verschieben aus `orchestrate.yml` gibt es nicht mehr. Damit entfällt auch der Input `ai_ref` und die Regel, dass `uses:` und `ai_ref` übereinstimmen müssen.

### Inputs und Outputs

`route`:

| Input | Pflicht | Bedeutung |
|---|---|---|
| `github_token` | ja | Token für Checkout, `gh` und Push (heute `AI_PAT`) |

| Output | Bedeutung |
|---|---|
| `run` | `'true'`, wenn ein Agent laufen soll, sonst `'false'` |
| `phase`, `issue`, `role_name` | zur Information, z. B. für Schrittnamen |

`run`:

| Input | Pflicht | Bedeutung |
|---|---|---|
| `github_token` | ja | wie oben |
| `job_status` | ja | `${{ job.status }}`, damit `run` fehlgeschlagene Setup-Schritte erkennt (siehe unten) |
| `claude_code_oauth_token` | eines von beiden | Claude-Abo-Token |
| `anthropic_api_key` | eines von beiden | API-Key, für Projekte ohne Abo |
| `checks` | ja | Prüfbefehle des Projekts, ein Befehl pro Zeile, z. B. `flutter analyze` / `flutter test` / `supabase test db` |
| `tools` | nein | zusätzliche Werkzeuge für Developer und Tester in Claude-Code-Syntax, kommagetrennt, z. B. `Bash(flutter:*),Bash(dart:*),Bash(supabase:*)` |

`run` liest `phase` und `issue` nicht aus Inputs, sondern routet das Ereignis selbst noch einmal. Das ist billig, und das Projekt muss keine Outputs durchreichen.

### Werkzeugrechte

Die Rollen behalten ihre festen Grundrechte aus `model.mjs` (Read, Glob, Grep, Edit, Write, `git`, `gh issue`, `gh pr` …), aber ohne `flutter`/`dart`. Dazu kommt:

- **Developer, Tester:** Grundrechte + Input `tools` + für jede Zeile aus `checks` ein `Bash(<zeile>:*)`.
- **Reviewer:** Grundrechte + für jede Zeile aus `checks` ein `Bash(<zeile>:*)`, aber **nicht** `tools`. Der Reviewer darf also prüfen, aber nicht beliebig bauen oder ändern.
- **Requirements Engineer:** unverändert.

Werkzeuge und Prüfbefehle kommen nur aus Inputs der Workflow-Datei des Projekts, nie aus Dateien auf dem Branch (Anti-Ziel 2).

### Rollen-Prompts

Die Prompts werden neutral:

- Statt `flutter analyze`/`flutter test` heißt es: „Führe alle Prüfbefehle des Projekts aus (siehe ‚Context of this run‘)“. Der Kontextblock aus `prompt.mjs` listet die Zeilen aus `checks`.
- Statt „lege ein Flutter-Projekt mit `flutter create` an“ heißt es: Projektspezifische Konventionen und Einrichtungsschritte stehen in `CLAUDE.md` (Claude Code lädt sie automatisch) und `docs/idea.md` des Projekts. Der Developer befolgt sie.
- `_common.md` nennt `CLAUDE.md` zusätzlich zu `docs/idea.md` als Kontextquelle.

### Projekt-Workflow (Template)

`templates/workflows/ai-development.yml` wird zu einem vollständigen Job. Das Beispiel ist Flutter, die Setup-Schritte sind deutlich als „hier eigene Umgebung einrichten“ markiert:

```yaml
jobs:
  ai:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: read
    steps:
      - id: ai
        uses: derlarsschneider/github-ai-development/route@v1
        with:
          github_token: ${{ secrets.AI_PAT }}

      # --- Projektumgebung: nur wenn ein Agent läuft ---
      - if: steps.ai.outputs.run == 'true'
        uses: subosito/flutter-action@v2
        with: { channel: stable, cache: true }
      - if: steps.ai.outputs.run == 'true'
        run: flutter pub get
      # ---

      - if: always() && steps.ai.outputs.run == 'true'
        uses: derlarsschneider/github-ai-development/run@v1
        with:
          job_status: ${{ job.status }}
          github_token: ${{ secrets.AI_PAT }}
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          tools: Bash(flutter:*),Bash(dart:*)
          checks: |
            flutter analyze
            flutter test
```

`on:`, `concurrency:` und `run-name:` bleiben wie im heutigen Template.

### Versionierung

Releases als Tags `v1.x.y` plus ein mitlaufender Major-Tag `v1`. Projekte nutzen `@v1`. Damit wirkt eine Änderung auf `main` nicht mehr sofort auf alle Projekte. Die Entwicklung dieses Repos kann mit `@main` getestet werden.

### Fehlgeschlagene Setup-Schritte des Projekts

Heute läuft „Finish“ mit `always()`: Auch wenn das Flutter-Setup scheitert, bekommt das Issue `ai:failed`, einen Fehlerkommentar und eine Zeile in der Usage-Tabelle. Das muss so bleiben.

Deshalb ruft das Template `run` mit `if: always() && steps.ai.outputs.run == 'true'` auf und übergibt `job_status: ${{ job.status }}`. Ist der Status nicht `success`, startet `run` keinen Agenten, wertet den Lauf als fehlgeschlagen aus (wie heute bei fehlender `.ai-result.json`) und schreibt in den Fehlerkommentar, dass die Einrichtung der Projektumgebung fehlgeschlagen ist. (Entscheidung von Claude: Das Projekt muss dafür nur diese zwei Dinge aus dem Template übernehmen und keine Interna kennen.) Ob `run` den Job-Status auch selbst lesen kann und der Input damit wegfallen kann, prüft der Umsetzende.

### Migration

Wichtig: `orchestrate.yml` lädt Code und Prompts zur Laufzeit von `main` (`ai_ref: main`). Jede Änderung auf `main` wirkt deshalb sofort auf das laufende TeamWorkTime-Issue 4, auch wenn `orchestrate.yml` selbst unverändert bleibt.

1. Die ganze Umstellung entsteht auf einem eigenen Branch in `github-ai-development`. Bis sie fertig ist, bleibt `main` unverändert. (Entscheidung von Claude, passt zur bestehenden Regel „ein Issue nach dem anderen“.)
2. Auf dem Branch: Actions, neutrale Prompts, Template, README. `orchestrate.yml` wird auf dem Branch gelöscht.
3. Erst wenn der PR von TeamWorkTime-Issue 4 gemergt ist und kein Lauf mehr aktiv ist: Branch mergen, `v1.0.0` und `v1` taggen.
4. Direkt danach in TeamWorkTime (lokal unter `/home/lars/code/TeamWorkTime`, gehört zu dieser Arbeit): Workflow-Datei auf das neue Template umstellen, mit Flutter-Setup, Supabase CLI (`supabase/setup-cli`) und `checks` inklusive `supabase test db`. Dazu eine `CLAUDE.md` mit den Flutter-Konventionen (u. a. der bisherige `flutter create`-Hinweis) und den Supabase-Konventionen (Migrationen unter `supabase/migrations`, lokale DB mit `supabase start`, die auf dem Runner Docker nutzt und keine zusätzlichen Secrets braucht). Die Workflow-Datei committet ein Mensch bzw. diese Session, nie ein Agent.
5. `docs/teamworktime-issues.md` gehört zum Projekt, nicht zum Workflow. Die Datei zieht nach `TeamWorkTime/docs/` um (Entscheidung von Claude, wegen Anti-Ziel 1).
6. Issue 5 freigeben (Hinweis „Noch nicht labeln“ im Issue und in der umgezogenen Datei entfernen) und als ersten Lauf auf der neuen Struktur nutzen.

## Dem Umsetzenden überlassen

- Wie `cli.mjs` aufgeteilt wird, damit `route` und `run` die gemeinsame Logik nutzen
- Validierung der Inputs (z. B. Fehlermeldung, wenn keiner der beiden Claude-Zugänge gesetzt ist)
- Genaue Formulierungen in den Prompts
- Tests für die Werkzeug-Zusammensetzung und den Kontextblock
