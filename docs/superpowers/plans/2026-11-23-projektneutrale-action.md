# Projektneutrale Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den auf Flutter zugeschnittenen wiederverwendbaren Workflow durch zwei projektneutrale Composite Actions (`route`, `run`) ersetzen, sodass jedes Projekt Umgebung, Prüfbefehle, Werkzeuge und Secrets selbst mitbringt.

**Architecture:** Die Orchestrierung unter `.github/ai/` bleibt, wird aber von Flutter befreit. Eine neue reine Funktion setzt die Werkzeugrechte pro Rolle aus festen Grundrechten plus den Action-Inputs `tools` und `checks` zusammen. Der Prompt-Kontext listet die Prüfbefehle. `route/action.yml` erledigt alles ohne Agent und bereitet den Branch vor. `run/action.yml` führt den Agentenlauf aus und behandelt fehlgeschlagene Setup-Schritte des Projekts als fehlgeschlagenen Lauf.

**Tech Stack:** GitHub Composite Actions, Node.js 22 (ESM, `node:test`, keine Abhängigkeiten), `gh` CLI, Claude Code CLI.

**Spec:** `docs/superpowers/specs/2026-11-23-projektneutrale-action-design.md`

## Global Constraints

- Alle Arbeit auf Branch `feat/project-neutral-action`. `main` bleibt unverändert, bis der PR von TeamWorkTime-Issue 4 gemergt ist (Task 7 ist das Tor).
- Orchestrierung: Node 22, ESM, nur `node:`-Module. Tests: `npm test` (= `node --test '.github/ai/test/**/*.test.mjs'`).
- Nichts Flutter- oder TeamWorkTime-Spezifisches in `.github/ai/`, `.github/ai-roles/`, `route/`, `run/`. Flutter darf nur im Template als markiertes Beispiel stehen.
- Werkzeuge und Prüfbefehle kommen ausschließlich aus Action-Inputs (Workflow-Datei des Projekts), nie aus Dateien auf dem Branch.
- Reviewer bekommt die `checks`-Befehle, aber nie den Input `tools`.
- Fachlicher Ablauf (Phasen, Labels, Übergänge, `ai-state`, Freigabe, `MAX_ITERATIONS = 5`) bleibt unverändert.
- Projekte referenzieren `derlarsschneider/github-ai-development/route@v1` und `.../run@v1`. Tags: `v1.0.0` und mitlaufendes `v1`.
- Keine Co-Author-Zeilen in Commits.

## Review Focus

- Ein Setup-Schritt des Projekts scheitert (z. B. `flutter pub get`): Das Issue muss `ai:failed` und einen Fehlerkommentar bekommen und darf nicht auf seinem Phasen-Label hängen bleiben → Task 3 (Test für `setupFailedResult`), Task 6 (Smoke-Test).
- Weder `claude_code_oauth_token` noch `anthropic_api_key` gesetzt: Kein Agentenlauf, eine verständliche `::error::`-Meldung, Issue landet auf `ai:failed` → Task 4 (Schritt im Action-Skript), Task 6.
- `checks` mit Leerzeilen, Einrückung, `#`-Kommentaren oder Windows-Zeilenenden → Task 1 (Tests für `parseChecks`).
- `tools` mit Leerzeichen, Zeilenumbrüchen statt Kommas oder einem kaputten Eintrag → Task 1 (Tests für `parseTools`, kaputter Eintrag wirft mit dem Eintrag in der Meldung).
- Ein Projekt übergibt `tools: Bash(rm:*)` o. Ä.: Developer und Tester bekommen es, der Reviewer und der Requirements Engineer nicht → Task 1 (Test für `toolsFor`).

---

### Task 1: Werkzeugrechte aus Inputs zusammensetzen

**Files:**
- Create: `.github/ai/lib/tools.mjs`
- Modify: `.github/ai/lib/model.mjs` (Zeilen 10–11 und 43–48: `flutter`/`dart` entfernen)
- Create: `.github/ai/test/tools.test.mjs`
- Modify: `.github/ai/test/model.test.mjs` (Test „code roles may run flutter tooling…“ ersetzen)

**Interfaces:**
- Produces:
  - `parseChecks(text: string | undefined) -> string[]`
  - `parseTools(text: string | undefined) -> string[]`
  - `toolsFor(phase: string, { extraTools?: string[], checks?: string[] }) -> string[]`

- [ ] **Step 1: Write the failing tests** in `.github/ai/test/tools.test.mjs`

```js
test('parseChecks keeps one command per non-empty, non-comment line', () => {
  assert.deepEqual(parseChecks('  flutter analyze\r\n\n# db\n  supabase test db  \n'), ['flutter analyze', 'supabase test db']);
  assert.deepEqual(parseChecks(undefined), []);
});
test('parseTools splits on commas and newlines and trims', () => {
  assert.deepEqual(parseTools(' Bash(flutter:*), Bash(dart:*)\nBash(supabase:*) ,'), ['Bash(flutter:*)', 'Bash(dart:*)', 'Bash(supabase:*)']);
  assert.deepEqual(parseTools(''), []);
});
test('parseTools rejects malformed entries and names them', () => {
  assert.throws(() => parseTools('Bash(flutter:*), rm -rf /'), /rm -rf \//);
});
test('develop and test get base tools, extra tools and one Bash rule per check', () => {
  const t = toolsFor('develop', { extraTools: ['Bash(supabase:*)'], checks: ['flutter test'] });
  for (const x of ['Edit', 'Bash(git:*)', 'Bash(supabase:*)', 'Bash(flutter test:*)']) assert.ok(t.includes(x), x);
  assert.deepEqual(toolsFor('test', { extraTools: ['Bash(x:*)'], checks: [] }).includes('Bash(x:*)'), true);
});
test('reviewer gets checks but never extra tools', () => {
  const t = toolsFor('review', { extraTools: ['Bash(rm:*)'], checks: ['flutter analyze'] });
  assert.ok(t.includes('Bash(flutter analyze:*)'));
  assert.ok(!t.includes('Bash(rm:*)'));
  assert.ok(!t.includes('Edit'));
});
test('requirements engineer gets neither checks nor extra tools', () => {
  const t = toolsFor('requirements', { extraTools: ['Bash(rm:*)'], checks: ['flutter test'] });
  assert.deepEqual(t, ROLES.requirements.tools);
});
test('no duplicates and unknown phase throws', () => {
  const t = toolsFor('develop', { extraTools: ['Bash(git:*)'], checks: [] });
  assert.equal(t.filter((x) => x === 'Bash(git:*)').length, 1);
  assert.throws(() => toolsFor('deploy', {}));
});
```

In `model.test.mjs` den Flutter-Test ersetzen durch: `base tools mention no language tooling`: kein Eintrag einer Rolle matcht `/flutter|dart|npm|pip|pytest/`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL (`tools.mjs` fehlt, Flutter-Einträge noch in `model.mjs`)

- [ ] **Step 3: Implement**

- `model.mjs`: `WRITE_CODE` ohne `Bash(flutter:*)`, `Bash(dart:*)`; Reviewer ohne `Bash(flutter test:*)`, `Bash(flutter analyze:*)`.
- `tools.mjs`: gültiger Eintrag = `/^[A-Za-z_]+(\(.+\))?$/`, sonst `throw new Error(\`Invalid tool "${entry}" in input "tools"\`)`. Check-Regel: `` `Bash(${cmd}:*)` ``. Reihenfolge: Grundrechte, dann extra, dann Checks; Duplikate entfernen.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün

- [ ] **Step 5: Commit**

```bash
git add .github/ai/lib/tools.mjs .github/ai/lib/model.mjs .github/ai/test/tools.test.mjs .github/ai/test/model.test.mjs
git commit -m "feat(ai): compose role tools from project inputs"
```

---

### Task 2: Neutrale Rollen-Prompts mit Prüfbefehlen im Kontext

**Files:**
- Modify: `.github/ai/lib/prompt.mjs`
- Modify: `.github/ai-roles/_common.md` (Abschnitt „Gathering context“), `developer.md` (Schritte 2–3), `tester.md` (Schritt 3), `reviewer.md` (Schritt 3)
- Modify: `.github/ai/test/prompt.test.mjs`

**Interfaces:**
- Consumes: nichts aus Task 1
- Produces: `buildPrompt(phase, ctx, rolesDir)` mit neuem Feld `ctx.checks: string[]`. Leeres oder fehlendes `checks` → `throw new Error('No project checks configured (input "checks")')`.

- [ ] **Step 1: Write the failing tests** in `prompt.test.mjs` (`ctx` bekommt `checks: ['flutter analyze', 'supabase test db']`)

```js
test('context lists every project check', () => {
  const p = buildPrompt('develop', ctx, rolesDir);
  assert.match(p, /Project checks/);
  assert.ok(p.includes('- `flutter analyze`') && p.includes('- `supabase test db`'));
});
test('missing checks throw', () => {
  assert.throws(() => buildPrompt('develop', { ...ctx, checks: [] }, rolesDir), /checks/);
});
test('role prompts name no language or project', () => {
  for (const f of ['_common.md', 'developer.md', 'tester.md', 'reviewer.md', 'requirements-engineer.md']) {
    assert.doesNotMatch(read(f), /flutter|dart|supabase|teamworktime/i, f);
  }
});
test('common rules point to the project CLAUDE.md', () => {
  assert.ok(read('_common.md').includes('CLAUDE.md'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL (Prompts nennen noch `flutter`, kein Kontextblock „Project checks“)

- [ ] **Step 3: Implement**

- `prompt.mjs`: An den Kontextblock anhängen: `- Project checks (run all of them; every one must succeed):` und darunter je Befehl eine eingerückte Zeile `` `  - \`${cmd}\`` ``.
- `_common.md`: Bei „Gathering context“ ergänzen: `CLAUDE.md` (falls vorhanden) mit den Konventionen und Einrichtungsschritten des Projekts. Befolgen.
- `developer.md`: Tests in der Testumgebung des Projekts schreiben. Den `flutter create`-Satz ersetzen durch: Fehlt das Projektgerüst noch, wird es nach `CLAUDE.md` / `docs/idea.md` angelegt. Schritt 3: alle Project checks ausführen, alle müssen erfolgreich sein.
- `tester.md` Schritt 3 und `reviewer.md` Schritt 3: alle Project checks ausführen.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/ai/lib/prompt.mjs .github/ai-roles .github/ai/test/prompt.test.mjs
git commit -m "feat(ai): make role prompts project-neutral and list project checks"
```

---

### Task 3: CLI für die neuen Actions

**Files:**
- Modify: `.github/ai/lib/result.mjs`
- Modify: `.github/ai/cli.mjs`
- Modify: `.github/ai/test/result.test.mjs`

**Interfaces:**
- Consumes: `parseChecks`, `parseTools`, `toolsFor` (Task 1). `buildPrompt` mit `ctx.checks` (Task 2).
- Produces (Umgebungsvariablen und Outputs, die die Actions in Task 4 nutzen):
  - `cli.mjs route`: Outputs wie bisher (`action`, `phase`, `issue`, `branch`, `role_name`, `max_turns`), zusätzlich `run=true|false` (`true` genau bei `action == 'run'`). Den Output `tools` entfernen.
  - `cli.mjs prompt <phase> <issue>`: liest `AI_CHECKS`.
  - `cli.mjs tools <phase>`: neu. Liest `AI_TOOLS` und `AI_CHECKS` und schreibt den Output `tools` (kommagetrennt). Ungültige Eingaben → Exit-Code ≠ 0 mit Meldung.
  - `cli.mjs finish <phase> <issue>`: Ist `AI_JOB_STATUS` gesetzt und ≠ `success`, wird `setupFailedResult(AI_JOB_STATUS)` statt der Ergebnisdatei genutzt.
  - `setupFailedResult(jobStatus: string) -> { ok: false, error: string }` in `result.mjs`

- [ ] **Step 1: Write the failing test** in `result.test.mjs`

```js
test('setup failure is a failed result that names the job status', () => {
  const r = setupFailedResult('failure');
  assert.equal(r.ok, false);
  assert.match(r.error, /project environment/i);
  assert.match(r.error, /failure/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (`setupFailedResult` ist nicht exportiert)

- [ ] **Step 3: Implement**

`setupFailedResult`: Fehlertext `Setting up the project environment failed (job status: ${jobStatus}). No agent was started. See the workflow log.` Die CLI-Änderungen wie oben unter Interfaces beschrieben. `planFinish` bleibt unverändert, ein `ok: false` führt dort schon zu `ai:failed` und einem Kommentar.

- [ ] **Step 4: Run tests and a local CLI smoke check**

Run: `npm test`
Expected: PASS

Run: `AI_TOOLS='Bash(supabase:*)' AI_CHECKS=$'flutter test\n' node .github/ai/cli.mjs tools review`
Expected: Log-Zeile `[ai] tools=...` enthält `Bash(flutter test:*)` und nicht `Bash(supabase:*)`

Run: `AI_TOOLS='rm -rf /' AI_CHECKS='x' node .github/ai/cli.mjs tools develop; echo $?`
Expected: Fehlermeldung mit `rm -rf /`, Exit-Code ≠ 0

- [ ] **Step 5: Commit**

```bash
git add .github/ai/lib/result.mjs .github/ai/cli.mjs .github/ai/test/result.test.mjs
git commit -m "feat(ai): CLI support for route/run actions and setup failures"
```

---

### Task 4: Composite Actions `route` und `run`

**Files:**
- Create: `route/action.yml`
- Create: `run/action.yml`
- Delete: `.github/workflows/orchestrate.yml`
- Create: `.github/ai/test/actions.test.mjs`

**Interfaces:**
- Consumes: CLI aus Task 3. Pfad zur CLI in beiden Actions: `${{ github.action_path }}/../.github/ai/cli.mjs`.
- Produces (für Template und README in Task 5):
  - `route`: Input `github_token` (Pflicht). Outputs `run`, `phase`, `issue`, `role_name`.
  - `run`: Inputs `github_token` (Pflicht), `job_status` (Pflicht), `claude_code_oauth_token`, `anthropic_api_key`, `checks` (Pflicht), `tools` (optional, Standard leer).

- [ ] **Step 1: Write the failing test** in `actions.test.mjs` (reiner Textvergleich, kein YAML-Parser)

```js
test('route action declares its input and outputs', () => {
  const y = read('route/action.yml');
  assert.match(y, /using: composite/);
  for (const k of ['github_token:', 'run:', 'phase:', 'issue:', 'role_name:']) assert.ok(y.includes(k), k);
});
test('run action declares all inputs', () => {
  const y = read('run/action.yml');
  for (const k of ['github_token:', 'job_status:', 'claude_code_oauth_token:', 'anthropic_api_key:', 'checks:', 'tools:']) assert.ok(y.includes(k), k);
});
test('actions contain nothing project-specific and the reusable workflow is gone', () => {
  for (const f of ['route/action.yml', 'run/action.yml']) assert.doesNotMatch(read(f), /flutter|dart|supabase|teamworktime/i, f);
  assert.ok(!existsSync(repoPath('.github/workflows/orchestrate.yml')));
});
test('composite steps do not use continue-on-error', () => {
  for (const f of ['route/action.yml', 'run/action.yml']) assert.doesNotMatch(read(f), /continue-on-error/, f);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (Dateien fehlen)

- [ ] **Step 3: Write `route/action.yml`**

Die Schritte übernehmen das Verhalten aus der bisherigen `orchestrate.yml`, Zeilen 29–85. Jeder `run:`-Schritt setzt `GH_TOKEN: ${{ inputs.github_token }}`.

1. `actions/checkout@v4` mit `token: ${{ inputs.github_token }}`, `fetch-depth: 0`
2. `actions/setup-node@v4` mit `node-version: 22`
3. `id: route`, `cli.mjs route`
4. Init / Resume-Approve-Revise mit denselben `if:`-Bedingungen wie bisher
5. Branch vorbereiten (`if: steps.route.outputs.action == 'run'`, Inhalt unverändert)
6. Outputs aus `steps.route.outputs.*` durchreichen

- [ ] **Step 4: Write `run/action.yml`**

Die Schritte übernehmen das Verhalten der bisherigen Zeilen 102–160. In Composite Actions gibt es kein `continue-on-error`.

1. `actions/setup-node@v4` mit Node 22
2. `id: route`, `cli.mjs route`: erneut routen, um `phase`, `issue`, `role_name` und `max_turns` zu bekommen
3. `id: ready`: Ist `inputs.job_status` ≠ `success` → Output `agent=false`. Sind beide Claude-Inputs leer → `::error::Neither claude_code_oauth_token nor anthropic_api_key is set` und `agent=false`. Sonst `agent=true`.
4. Nur bei `agent == 'true'`: Claude Code installieren, `cli.mjs prompt` (env `AI_CHECKS`), `id: tools` mit `cli.mjs tools` (env `AI_TOOLS`, `AI_CHECKS`), Agent starten mit env `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` aus den Inputs und `--allowedTools "${{ steps.tools.outputs.tools }}"`. Den Exit-Code des Agenten mit `|| echo "::warning::agent exited with $?"` abfangen, damit die folgenden Schritte laufen.
5. `if: always()`: `cli.mjs finish` mit env `AI_JOB_STATUS: ${{ inputs.job_status }}`
6. `if: always()`: Summary und `actions/upload-artifact@v4` wie bisher

- [ ] **Step 5: Run tests and lint**

Run: `npm test`
Expected: PASS

Run (falls verfügbar): `npx --yes action-validator route/action.yml run/action.yml`
Expected: keine Fehler. Ist das Tool nicht verfügbar, die Prüfung an den Smoke-Test in Task 6 übergeben und das im Commit vermerken.

- [ ] **Step 6: Commit**

```bash
git add route run .github/ai/test/actions.test.mjs
git rm .github/workflows/orchestrate.yml
git commit -m "feat(ai): replace reusable workflow with route and run composite actions"
```

---

### Task 5: Template und README

**Files:**
- Modify: `templates/workflows/ai-development.yml`
- Modify: `README.md` (Abschnitte „Einbindung in ein Repository“, „Voraussetzungen“, „Offene Fragen“, „Status“, „Aufbau dieses Repositorys“, „Ein Projekt anbinden“)
- Modify: `.github/ai/test/actions.test.mjs`

**Interfaces:**
- Consumes: Inputs und Outputs aus Task 4.

- [ ] **Step 1: Write the failing test**

```js
test('template wires route, setup and run correctly', () => {
  const y = read('templates/workflows/ai-development.yml');
  assert.ok(y.includes('github-ai-development/route@v1') && y.includes('github-ai-development/run@v1'));
  assert.match(y, /if: always\(\) && steps\.ai\.outputs\.run == 'true'/);
  assert.ok(y.includes('job_status: ${{ job.status }}'));
  assert.ok(!y.includes('orchestrate.yml'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Rewrite the template**

`run-name`, `on`, `concurrency` und `permissions` bleiben. Der Job entspricht dem Abschnitt „Projekt-Workflow (Template)“ der Spec, inklusive `job_status` und `always()`. Die Setup-Schritte stehen zwischen Kommentaren `# --- Project environment: replace with your own setup (runs only when an agent runs) ---` und `# ---`. Beide Claude-Inputs stehen drin, einer davon auskommentiert.

- [ ] **Step 4: Update README**

- „Einbindung“ und „Ein Projekt anbinden“: neutral, ohne TeamWorkTime. Template kopieren, Setup-Schritte, `checks` und `tools` anpassen, Secrets anlegen (PAT nur mit Rechten aufs eigene Projekt; Claude-Abo-Token *oder* API-Key), Label `ai-development` anlegen. Projektkonventionen gehören in die `CLAUDE.md` des Projekts.
- Den Hinweis auf private Repos und die Regel `ai_ref` = `uses:` entfernen, stattdessen die Versionierung `@v1` beschreiben.
- „Offene Fragen“: die Frage nach Build- und Testumgebungen streichen.
- „Status“: den Punkt „auf Flutter-Projekte zugeschnitten“ streichen.
- „Aufbau“: `route/`, `run/` statt `orchestrate.yml`.

- [ ] **Step 5: Run tests and check README for leftovers**

Run: `npm test && grep -n -i "orchestrate.yml\|ai_ref\|zugeschnitten" README.md`
Expected: Tests PASS, `grep` findet nichts

- [ ] **Step 6: Commit**

```bash
git add templates README.md .github/ai/test/actions.test.mjs
git commit -m "docs: project-neutral template and setup guide"
```

---

### Task 6: Smoke-Test in einem Wegwerf-Repository

Echte GitHub-Läufe lassen sich nicht unit-testen. Das hier ist das Tor vor dem Merge. Braucht `gh` (lokal nicht installiert: `! sudo apt install gh && gh auth login`) oder die GitHub-Weboberfläche.

- [ ] **Step 1:** Branch pushen: `git push -u origin feat/project-neutral-action`
- [ ] **Step 2:** Privates Repo `ai-action-smoke` anlegen, mit den Secrets `AI_PAT` (nur dieses Repo) und `CLAUDE_CODE_OAUTH_TOKEN`. Dazu ein Mini-Node-Projekt: `package.json` mit `"test": "node --test"` und einer Testdatei. Das Template übernehmen, mit `@feat/project-neutral-action` statt `@v1`, Setup `actions/setup-node@v4`, `checks: npm test`, `tools: Bash(npm:*),Bash(node:*)`.
- [ ] **Step 3:** Issue „Füge eine Funktion `add(a, b)` mit Test hinzu“ anlegen, mit `ai-development` labeln, die Anforderungen mit `/approve` freigeben.
  Expected: Das Issue durchläuft alle Phasen bis `ai:ready-to-merge`. Bei Init- und Freigabe-Läufen laufen die Setup-Schritte nicht (im Log als übersprungen sichtbar).
- [ ] **Step 4:** Zweites Issue mit einem absichtlich kaputten Setup-Schritt (`run: exit 1`).
  Expected: `ai:failed` und ein Kommentar mit „project environment“, kein Agentenlauf.
- [ ] **Step 5:** Drittes Issue mit leerem `claude_code_oauth_token`.
  Expected: `::error::` im Log, `ai:failed`.
- [ ] **Step 6:** Ergebnisse festhalten. Bei Fehlern in Task 3 oder 4 nachbessern und den Smoke-Test wiederholen. Danach das Wegwerf-Repo löschen (vorher fragen).

---

### Task 7: Merge und Release (Tor: TeamWorkTime-Issue 4 ist gemergt)

- [ ] **Step 1:** Prüfen, dass der PR von TeamWorkTime-Issue 4 gemergt ist und kein Lauf von „AI Development“ in TeamWorkTime aktiv ist (`gh run list -R derlarsschneider/TeamWorkTime --status in_progress`).
  Expected: leer
- [ ] **Step 2:** Branch per PR nach `main` mergen.
- [ ] **Step 3:** Tags setzen: `git tag v1.0.0 && git tag -f v1 && git push origin v1.0.0 && git push -f origin v1`

Ab hier ist der Aufruf von TeamWorkTime (`orchestrate.yml@main`) kaputt. Deshalb Task 8 direkt im Anschluss.

---

### Task 8: TeamWorkTime umstellen und Issue 5 freigeben

Arbeitsverzeichnis: `/home/lars/code/TeamWorkTime`. Diese Session committet, kein Agent.

**Files:**
- Modify: `.github/workflows/ai-development.yml`
- Create: `CLAUDE.md`
- Move: `github-ki-development/docs/teamworktime-issues.md` → `TeamWorkTime/docs/teamworktime-issues.md`

- [ ] **Step 1:** Workflow-Datei aus dem neuen Template erzeugen. Setup: `subosito/flutter-action@v2` (`channel: stable`, `cache: true`), `supabase/setup-cli@v1` (`version: latest`), `flutter pub get`. Zusätzlich ein Schritt `supabase start -x studio,imgproxy,inbucket,edge-runtime,logflare,vector`, der nur läuft, wenn `hashFiles('supabase/config.toml') != ''`. Weiter `tools: Bash(flutter:*),Bash(dart:*),Bash(supabase:*)` und `checks:` mit den Zeilen `flutter analyze`, `flutter test`, `supabase test db`.
  `supabase test db` kommt gleich mit in die Checks. Das nächste Issue ist Issue 5, und dessen Developer legt `supabase/` an, bevor er die Checks ausführt. Weil `supabase start` beim ersten Developer-Lauf noch übersprungen wird (es gibt noch kein `config.toml`), steht in `CLAUDE.md`, dass er die lokale DB dann selbst startet.
- [ ] **Step 2:** `CLAUDE.md` anlegen. Inhalt: Flutter-Projekt im Root, Plattformen Web, Android, iOS. Fehlt das Gerüst, `flutter create --project-name team_work_time --platforms web,android,ios .` (Projektname aus `pubspec.yaml` prüfen). Kein Build-Output committen. Architektur siehe `docs/idea.md`. Supabase: Fehlt `supabase/`, mit `supabase init` anlegen. Migrationen unter `supabase/migrations`. Läuft die lokale DB nicht (`supabase status`), mit `supabase start` starten. Tests mit `supabase test db` (pgTAP).
- [ ] **Step 3:** `teamworktime-issues.md` umziehen. Im Abschnitt zu Issue 5 die Zeile „(erst nach Erweiterung des Workflows)“ und den Hinweis „Noch nicht labeln…“ entfernen. In `github-ki-development` die Datei löschen.
- [ ] **Step 4:** Beide Repos committen und pushen (in TeamWorkTime auf `main`, nach Rückfrage beim Besitzer).
- [ ] **Step 5:** Im GitHub-Issue 5 den Hinweis „Noch nicht labeln…“ entfernen. Der Besitzer labelt es mit `ai-development`. Erster Lauf (Init + Requirements) muss grün sein.
