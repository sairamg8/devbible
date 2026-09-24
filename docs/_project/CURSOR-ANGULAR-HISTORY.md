---
name: cursor-angular-history
description: Cold history rotated out of CURSOR-ANGULAR.md — superseded session blocks, verbatim. Opened by name or by recall.sh, never on the hot path
metadata:
  type: progress
---

# CURSOR-ANGULAR.md — history

---

<!-- rotated out of CURSOR-ANGULAR.md on 2026-09-09 -->

## ✅ 2026-09-09 — TOPIC 03 CLOSED, 17/17 CHUNKS, 90 PAGES. Session `69047d13`, 6 agents in 2 waves.

**User order this session:** *"Deploy the agents you need to work on angular per chapter — once
complete current chapter then only pick next one and so on … update session progress before
deploying agents and agents complete … use devbible skill … max 4 agents."*
🔴 This SUPERSEDES the 2026-09-07 *"do not deploy any agents"* line below — that was one session's
instruction, not a standing order.

**Chapter = topic. Topic 03 `03-the-provider-array` closes before topic 04 is touched.**

### Wave plan — bank `research_angular_p0_t03_providers.md` (3997 lines)

| wave | agent | chunk | `sidebar_position` | bank lines |
|---|---|---|---|---|
| 1 | A | `12-what-does-not-belong.md` | 12 | 2859–2971 |
| 1 | B | `13-order-dependence.md` | 13 | 2972–3077 |
| 1 | C | `14-providedin-root-vs-the-array.md` | 14 | 3078–3200 |
| 1 | D | `15-route-level-providers.md` | 15 | 3201–3329 |
| 2 | E | `16-the-injector-error-surface.md` | 16 | 3330–3645 |
| 2 | F | `17-the-server-config-merge.md` | 17 | 3646–3870 |

Every agent also reads **§0 `24–238`** (facts every chunk needs) and **§99 `3871–3960`**
(UNSETTLED — must be written as uncertain, never resolved by guess). Splits take `.1 .2 .3…`
sidebar positions, matching the `05*`/`11*` families already on disk.

### 🔴 The coordinator (this session) owns the four things agents are forbidden to do

1. **Footers.** Every agent leaves the literal `{/* FOOTER */}`. This session replaces all of them
   at wave close — `grep -rn '{/\* FOOTER \*/}' ` must be EMPTY before topic 03 is called closed.
2. **Promoting de-linked forward refs.** 16 `*(not written yet)*` hits existed at arrival; chunks
   12/13/15/17 are named in nine of them. This wire defect has recurred in FOUR consecutive
   sessions — `grep -rn 'not written yet' docs/angular` and `ls`-check every hit per wave.
3. **`git add` explicit paths + commit, per file.** No agent commits.
4. **Boards:** this cursor, the topic README banner, `progress.js`, `page-counts.json`,
   `status.json`.

### ✅ LANDED SO FAR — 2026-09-09, commit by commit

| chunk | files | lines | ★ | commit |
|---|---:|---:|---:|---|
| **12 · what does not belong** | 8 (`12`,`12b`–`12h`) | 1958 | 85 | `625739021` |
| **13 · order dependence** | 8 (`13`,`13b`–`13h`) | 1853 | 57 | `f18970563` |
| **14 · providedIn root vs array** | 6 (`14`,`14b`–`14f`) | 1189 | 62 | `3b85fe8a5` |
| **15 · route-level providers** | 5 (`15`,`15b`–`15e`) | 1062 | 46 | `7609694ae` |
| **wave-1 wiring** | 41 files touched | — | — | `2e5452998` |
| **17 · the server config merge** | 6 (`17`,`17b`–`17f`) | 1515 | 52 | `3128917ce` |

**WAVE 1 IS CLOSED AND WIRED.** Topic 03 = **15 of 17 chunks, 74 pages** (was 11 / 47). All four
authors split correctly and proved it: 12 `339→1958`/`10→85`, 13 `1594→1853`/`52→57`,
14 `1034→1189`/`48→62`, 15 `677→1062`/`29→46`. Gates green: `yarn linkcheck docs/angular` **193/0**,
`yarn mdxcheck docs/angular` **193/0**.

### 🔴 Three defects the wiring caught that NO agent self-check can catch — repeat these every wave

1. **All 27 new files shipped `{/* FOOTER */}`.** That is the contract working, not a defect — but
   it is the step that gets skipped (1,241 pages across 48 topics shipped with the marker). Wired
   all 27 in sidebar order; `grep -rn '{/\* FOOTER \*/}'` in the topic is now **empty**.
2. **Nine label-vs-target mismatches, and `linkcheck` was GREEN on all nine** — it proves the target
   resolves, never that the label agrees. Eight were **pre-existing**, inherited from the 2026-09-07
   11-family renumber that a previous session believed it had fully fixed (`06`→`06d`, `06d`→`06f`,
   `11`×2, `11b`×3); one was this wave's (`13c` labelled `13d`, pointing at `13g`). 🔴 Run this every
   wave — it is the only check that finds them:
   ```bash
   python3 -c "import re,glob;[print(f,m.group(1),'->',m.group(2)) for f in glob.glob('*.md') for m in re.finditer(r'\[([^\]]*?)\]\((\d+[a-z]?)-[^)]*\.md\)',open(f).read()) if (lm:=re.match(r'(?:chunk\s+)?(\d+[a-z]?)\b',m.group(1).strip())) and lm.group(1)!=m.group(2)]"
   ```
3. **One real MDX abort that `shared/scripts/mdxcheck.py` CANNOT see and `yarn mdxcheck` can.**
   `15d:135` carried a verbatim JSDoc `{@link EnvironmentProviders}` inside a `> *"…"*` quote — a
   bare `{` reaching acorn as prose. The `.py` checks OPEN-SPAN, COMMENT and RAW-TAG only; the
   repo's `node scripts/mdxcheck.mjs` also parses. 🔴 **Both skills tell agents to run the `.py`.
   The coordinator must additionally run `yarn mdxcheck` per wave** — the `.py` alone would have
   shipped this and skipped the deploy for every lane. Fix was backticks; the quoted text is intact.

Chunk 12 split proof: **1 file 339 lines / 10 ★ → 8 files 1958 / 85 — both UP.** Five claims left
explicitly uncertain per bank §99 and a later pass must not "fix" them into assertions: whether
`inject()` takes a bare string in v22 · whether a route-level `provideAppInitializer()` ever runs ·
whether `providedIn: 'any'` is deprecated for `@Injectable` as well as for `InjectionToken` ·
whether the `...(ngDevMode ? [] : [])` guard lets the optimiser drop the *implementation* · whether
route injectors are destroyed on navigation. 🔴 12h banks a **reusable, cross-topic** rule: a
golden's `// @public` is API-Extractor's release tag, **not** Angular's stability marker —
`provideCheckNoChangesConfig` is `@public` in the golden and `@developerPreview 20.0` in its JSDoc.

Chunk 15 split proof: **1 file 677 lines / 29 ★ → 5 files 1062 / 46 — both UP.** 🔴 It **settles a
bank gotcha more precisely than the bank states it** (15.6#4): a guard *can* see route providers,
but `canActivate`, `canDeactivate` and `canMatch` resolve against the route's **own** injector while
`canActivateChild` resolves against the **declaring ancestor's** — four guard kinds, three different
injectors, read out of `check_guards.ts` and `resolve_data.ts`. Left uncertain: a route-level
`provideAppInitializer()` never running is written twice as an explicit inference (§99 item 6, still
unsettled), and whether `createEnvironmentInjector`'s `debugName` survives a production build was
not read. ⚠️ The router design doc `injector_cleanup.md` names `withAutoCleanupInjectors()` while the
shipped v22.1.5 export is `withExperimentalAutoCleanupInjectors()` — flagged on the page, do not
"correct" either name.

Chunk 13 split proof: **1 file 1594 lines / 52 ★ → 8 files 1853 / 57 — both UP.** Pays the three
forward debts `05b:213`, `02:204`, `10:206`. Two claims left explicitly unconfirmed and must NOT be
"fixed" into assertions later: whether `HTTP_INTERCEPTOR_FNS` is exported from
`@angular/common/http` (no `@publicApi` on it, unlike `HTTP_INTERCEPTORS`), and the **production**
path of the mixed multi/non-multi mistake (both `throwMixedMultiProviderError` call sites are
`ngDevMode`-guarded).

⚠️ **NOT a tool defect — read this before you repeat the mistake.**
`shared/scripts/mdxcheck.py <dir>` printing *"0 MDX hazard(s) in **0 file(s)**"* means **zero files
had hazards**, not that it scanned nothing. This coordinator session mis-called it broken on
2026-09-09 on exactly that reading. The output now leads with the scan count —
*"70 file(s) scanned · 0 MDX hazard(s) in 0 file(s)"* — so the number that proves the run was real
is visible without reading `main()`. Both gates agree and both are worth running: the `.py` is the
agent-neutral one every skill names, `yarn mdxcheck` (`node scripts/mdxcheck.mjs`) is the repo's own.

**Chunk 17 landed 2026-09-09** — split proof `1 file 387 lines / 12 ★ → 6 files 1515 / 52`, both UP.
New point worth banking, not in the bank: `mergeApplicationConfig` is **one expression** because the
third argument to `Object.assign` is an *argument expression* — `prev.providers` is read **before**
the call mutates `prev`, which is exactly why the obvious two-statement refactor yields `curr`
twice. `17f` is the verification `09c:113` asked for: `HttpBackend` is written **three times** in the
merged array, non-multi, last wins, so a bare `provideHttpClient()` in the server config restores
`FetchBackend`. Left unread and NOT to be "fixed" later: `NG0401`'s enum sign (so the page promises
no guide-page suffix), `IS_DISCOVERING_ROUTES`' implementation, and `ngDevMode` on a server build —
`05g`'s own uncertainty is preserved, not resolved.

## 🔴 STANDING ORDER FOR THIS TRACK — 2026-09-09, said three times in one session

> *"work on angular per chapter — once complete current chapter then only pick next one and so on"*
> *"before deploy agents save the session progress and after agent completion also save session
> progress"* · *"do not wait till the angular completion"* · *"do not wait for me"* ·
> *"time is the essence"*

🔴 **A chapter boundary is NOT a stopping point.** Close a chapter, save progress, deploy the next
wave in the same turn. Reporting a closed chapter and waiting for a reply was corrected twice —
*"why are you waiting??"*, then *"do not wait for anything"*. **Max 4 agents at a time.**
Angular is 3 topics of 211; this track does not stop, and it is not reported as "complete" until it
is. Save progress **before** a deploy and **after** every agent lands — per file, not per wave.
🔴 **Pick the recommended action yourself.** If the next chapter needs a research bank, one of the
four agents banks it while the other three finish the current chapter — do not spend a turn asking.

## 🔴 2026-09-09 — WAVE 3 IN FLIGHT. Topic 01's three open units + topic 04's research bank.

Deployed immediately after topic 03 closed, same session `69047d13`. **The chapter boundary is not
a stopping point** — the user's order is *"once complete current chapter then only pick next one and
so on"*, and pausing at one to report was corrected: *"why are you waiting?"*

| agent | unit | writes to |
|---|---|---|
| A | `10g · Calls, enums and the values in between` | `01-compiler-with-a-framework-attached/` |
| B | `10h · Syntax the evaluator cannot read` | `01-compiler-with-a-framework-attached/` |
| C | the `NG2xxx` field-shape family | `01-compiler-with-a-framework-attached/` |
| D | **research bank for topic 04** `04-ng-update-not-npm-install` | `devbible/research_angular_p0_t04_ng_update.md` |

### ✅ WAVE 3 LANDINGS

| unit | files | split proof | commit |
|---|---|---|---|
| **10g · calls, enums and the values in between** | 4 (`10g`,`10gb`–`10gd`) | 354→887 lines, 9→26 ★ | `ed0eb234b` |
| **10h · syntax the evaluator cannot read** | 6 (`10h`,`10hb`–`10hf`) | 307→1395 lines, 7→33 ★ | `94bcca5b0` |
| **10i · the NG2xxx field-shape family** | 7 (`10i`,`10ib`–`10ig`) | 512→1629 lines, 10→47 ★ | `e701f5285` |
| **wave-3 close** | note + table + 17 footers + 2 corrections | — | `2933faa3f` |

**WAVE 3 IS CLOSED.** Topic 01 = **86 pages** (was 69). Chunk 10's catalogue went **6 pages → 23**
and its coverage note now says *complete*. Gates: `linkcheck docs/angular` **226/0**,
`mdxcheck docs/angular` **226/0**, nothing over cap, 0 label/target mismatches, 0 FOOTER markers.
Boards regenerated, pushed.

### 🔴 The wave CORRECTED TWO CLAIMS THIS CORPUS WAS MAKING — that is the real yield

1. **`09e` was wrong, S1, now fixed.** It framed `selector: ''` as reporting a *missing* selector on
   a `@Component`. It does not. The directive handler passes `/* defaultSelector */ null`; the
   component handler passes `elementSchemaRegistry.getDefaultComponentElementName()`, which returns
   the truthy `'ng-component'` — so `!selector` is false, **no error is raised**, and the component
   compiles as `ng-component`, silently. NG2004 from that call site is `@Directive`-only. Section,
   gotcha and interview answer all rewritten, pointing at `10if`.
2. **Our own coverage note asserted something false**: "spread at expression position" does *not*
   print `This syntax is not supported.` The note is fixed, not linked over.
3. **`09d`'s open question is settled** and its ⚠️ paragraph replaced.

🔴 **The lesson for every later wave: a unit written against source will contradict the pages that
forward-referenced it.** Three of three did here. Budget the close for *correcting siblings*, not
just wiring links — and never let an agent fix another page itself; all three correctly reported
and did not touch.

🔴 **10g settled another page's open question — act on it at wave close.**
`09d-the-single-return-function-rule.md` ends with an explicit ⚠️ *"what this page does not
establish: whether an arrow function assigned to a `const` … is reachable as a callee."* **It is
not.** `TypeScriptReflectionHost.getVariableValue` returns `declaration.initializer || null` and
`visitExpression`'s dispatch has no `ts.isArrowFunction` / `ts.isFunctionExpression` branch, so the
initializer falls to `DynamicValue.fromUnsupportedSyntax`. `export const f = () => X;` is **not**
callable in metadata; `export function f() { return X; }` is. 09d's warning paragraph is now
replaceable — 10g's author correctly did not touch another page.

🔴 **New and worth a page of its own later:** local compilation **silently mis-compiles
`encapsulation`**. `resolveEncapsulationEnumValueLocally` text-matches `expr.getText().trim()`
against `ViewEncapsulation.<Key>` and returns `null` on a miss; the call site coalesces `null` to
`ViewEncapsulation.Emulated`. A renamed import (`VE.None`) becomes `Emulated` **with no
diagnostic**. And `changeDetection` in local mode is `new o.WrappedNodeExpr(...)` — never evaluated.
Relevant to `10d` and `13d`.

🔴 **10h found TWO errors in our own coverage note and one in angular.dev — the note rewrite must
carry the corrections, not just add rows.**
1. **"spread at expression position" does NOT print `This syntax is not supported.`** —
   `visitSpreadElement`, `evaluateFunctionArguments` and `visitObjectLiteralExpression` all
   intercept spread before the dispatch. The note at `10-metadata-errors-one-by-one.md:24` lists it
   under 10h and is **wrong**; fix the note, do not just link it.
2. **angular.dev's AOT table is inverted on two rows** — it lists `New` (`new Oven()`) as *supported
   syntax* where ngtsc has no `ts.isNewExpression` branch, and lists spread-in-literal-array as *not
   foldable* where `visitArrayLiteralExpression` folds it. Belongs in the bank's §2 (where
   angular.dev and the source disagree).
3. **`??` is SETTLED**: `QuestionQuestionToken` is not a key in `BINARY_OPERATORS` at v22.1.5 and
   the substring `Question` occurs nowhere in `interpreter.ts` / `dynamic.ts` / `diagnostics.ts` /
   `result.ts`. A real evaluator gap, not a doc omission. ⚠️ Whether it is *deliberate* is left open
   on the page and must stay open — no comment, TODO or test names it.

🔴 **Scope for A/B/C is already written down and must be read first** — the coverage note at
`10-metadata-errors-one-by-one.md:20-30` names every error string each unit owes, and the decoder
table at `:140-155` has their rows. Chunk 10 is *deliberately* incomplete and says so on the page;
these three units are what close it. When they land, that note and both tables need rewriting from
"not written yet" to real rows — **that is the coordinator's job, and it is the whole point of the
unit**: the note exists so a reader does not conclude an error cannot happen.

Agent D writes **no docs pages at all** — a bank only, modelled on
`research_angular_p0_t03_providers.md` (3997 lines), which is what made six parallel agents
affordable on topic 03. Topic 04's syllabus scope is `docs/angular/syllabus/01-the-angular-model.md`
lines 32-40: `ng update` and schematics, `@angular/build` (esbuild + Vite, Webpack legacy),
`angular.json` anatomy, the TypeScript `>=6.0 <6.1` peer pin and the tsconfig split, what `ng new`
produces in v22, the release train, partial compilation and `ɵɵngDeclareComponent`, JIT vs AOT, and
dev-mode-only behaviour.

## 🔴 2026-09-09 — WAVE 4 IN FLIGHT: FOUR RESEARCH BANKS, NO AUTHORING

Topic 01 and topic 03 are both closed. **Phase 0 has nine topics left (04–12) and every one of them
lacks a bank** — that, not writing, is the bottleneck. So wave 4 is four banking agents with
**disjoint** scopes, deployed rather than waiting:

| agent | topics | bank file |
|---|---|---|
| D | ✅ **LANDED** — 04 `ng update` + 09 release train, **5,418 lines, 21 chunk sections**, covering topics 04–12 | `research_angular_p0_t04_ng_update.md` · commit `d75ada5` |
| E | ✅ **LANDED** — 05 `@angular/build` + 06 `angular.json`, **4,482 lines, 27 chunk sections** (12 + 15) | `research_angular_p0_t05_t06_build_and_angular_json.md` · commit `08ad7e4` |
| F | **07** the TypeScript setup + **08** what `ng new` produces | `research_angular_p0_t07_t08_typescript_and_ng_new.md` |
| G | **10** partial compilation + **11** JIT vs AOT + **12** dev-mode-only | `research_angular_p0_t10_t11_t12_linker_jit_devmode.md` |

Each was told the other three exist and to bank a **boundary pointer** rather than a neighbour's
material. Each writes **one file in the store and nothing in `docs/`**.

### 🔴 BANK D LANDED AND PROVED OUR OWN SYLLABUS WRONG ON THREE ROWS — all three now fixed

1. 🔴 **The release train, wrong in FOUR files, and it is the headline fact of topic 09.**
   angular.dev at v22.1.5: *"A major release every 12 months"*, *"4-6 minor releases for each major
   release"*, *"All major releases are typically supported for 24 months"*, plus an explicit
   callout *"Until Angular v22, Angular had a 6-month major release cycle."* We were teaching the
   **pre-v22** cadence as current and predicting a v23 for November 2026 off it. Fixed in
   `docs/angular/README.md` (twice), `syllabus/01`, `syllabus/06` and the phase-0 README; the
   version table is now labelled a **history of the old cadence**, not a prediction. Commit
   `1045966ae`.
2. 🔴 **The build is THREE tools, not two.** Since `@angular/build` **22.1.0**
   (*"perf | default chunk optimization to use Rolldown"*): esbuild compiles and bundles,
   **Rolldown** re-bundles the chunks (`useRolldownChunks … ?? true`, escape hatch
   `NG_BUILD_CHUNKS_ROLLDOWN`), Vite serves. 22.1.4 extended Rolldown to the dev server's
   prebundling.
3. ⚠️ **`@angular/platform-browser-dynamic@22.1.5` is npm-deprecated** — *"Use `@angular/platform-browser`
   instead."* Both JIT rows named it without that. ⚠️ The compiler's own `JIT compiler unavailable`
   message still names the deprecated package; **flag it, do not "fix" the quote.**

⚠️ **Bank D also warns the syllabus may be over-scoped:** topic 01 already owns partial compilation
and the linker at **Master** tier (`12f`), version skew (`12g`), the TS pin (`13b`) and
`strictTemplates` (`14f`/`14g`). Topics 07 and 10 collide with those. The bank suggests deleting
syllabus row 10 in favour of `12f` — **that is a syllabus owner's decision, deliberately not taken.**

🔴 **Bank D's own hard limit, quoted so no page violates it:** *"I never read `app.html`,
`.prettierrc`, the `module-files/` templates or the `tailwind` schematic, so no chunk may describe
the welcome page or those files."* Also: angular.dev's `/reference/migrations` and every `/api/**`
page are **client-rendered**, so the doc-page migration list is unverifiable from a fetch —
the bank read sources and goldens instead.

### 🔴 TOPIC 04 IS OPEN AND BEING WRITTEN

Directory scaffolded (`04-ng-update-not-npm-install/`, README + `_category_.json`, commit for both),
7 chunks planned in its table. **Agent H is writing chunks 01–03** from bank lines 227–916.
**Agent I is writing chunks 04–07** from bank lines 917–1900. Both authors were told to reference
each other's chunks as bold `*(not written yet)*` even when a file is visible on disk, because the
other's splits are still renaming — the coordinator promotes all of them at topic close.
**Topic 04 is fully deployed; when both land, close it and open topic 05 off bank E.**

**Landed so far in topic 04:** chunk **01** as four files — `01`, `01b-what-a-migration-rewrites`,
`01c-the-clis-own-collection`, `01d-a-bare-ng-update-is-a-report` — 967 lines, 25 ★, tier
`Understand`, commit `465ad5a3a`. 🔴 Committed **mid-agent, per the per-file cadence**: the 01
family was complete and had been stable for 8–16 minutes while the same agent had visibly moved on
to chunk 03, so `02*` and `03*` were deliberately left unstaged rather than captured half-written.
That is the right call to repeat — a family is committable when it is stable and its author has
moved past it, not only when the agent reports.

🔴 **Two collision warnings were issued and must be honoured when the pages get written:**
- **Topic 08 overlaps topic 03 heavily** — `app.config.ts` IS topic 03, 90 pages of it. Topic 08 is
  the *tour of the generated tree that hands off*, never a second explanation of the provider array.
- **Topics 10–12 overlap topic 01** — they are the runtime and packaging *consequences* of the
  compiler topic, not a second compiler explanation.

**When a bank lands: deploy a 4-agent authoring wave against it immediately.** Do not wait for the
other banks. Nine topics at topic-03's observed ratio (17 planned chunks → 90 pages) is a large
amount of writing and the banks are what make it parallel.

### 🔴 THE ONE NEXT ACTION — after wave 3

**Topic 03 is DONE. Do not reopen it.** The next chapter in this track is **topic 01
`01-compiler-with-a-framework-attached`'s deliberately-open `10g` / `10h`, and the `NG2xxx`
field-shape family** — left open on purpose when topic 01 closed 2026-09-06 at 69 pages, not
forgotten. After that, **topic 04 · `ng update`, not `npm install`**, which every topic-03 page
already forward-references as bold `*(not written yet)*` (three refs: `README.md` ×2 and `17f`'s
footer) — promote those the moment topic 04's first file lands.

🔴 **There is no research bank for topic 04.** Topic 03's bank
(`research_angular_p0_t03_providers.md`, 3997 lines) is what made six parallel agents possible:
every chunk was written FROM the bank, so no agent re-fetched. Bank topic 04 in one pass **before**
deploying anything, or the wave costs twenty research passes instead of one.

### What the 6-agent, 2-wave run actually cost and produced

Wave 1 (4 agents: 12, 13, 14, 15) then wave 2 (2 agents: 16, 17), each wave wired and committed
before the next deployed. **Six drafts totalling 4,875 lines became 43 files totalling 9,158 lines
and 362 ★ — every split proven UP, nothing trimmed.** Roughly 1.07M subagent tokens.
🔴 **Every one of the six split.** Not one chunk came in under the cap as a single file, and the
planned "one chunk = one file" is now known to be wrong for this topic class by a factor of ~7.

### 🗄️ Superseded — state while wave 1 was still writing

`yarn linkcheck` is **RED for angular right now** and that is expected mid-wave — chunks 12, 14 and
15 carry dangling own-chunk refs to siblings not yet on disk. **Do not "fix" them by de-linking:**
the authoring agents close their own forward links as they split. The coordinator runs linkcheck
**after** the wave, not during it. Files over cap mid-wave (`14` at 375) are likewise the author's
own split still in progress.

---

### State at deploy — 2026-09-09

Tree clean for `docs/angular`. Topic 03 = **47 pages, 11 of 17 chunks**. Angular track = **147
pages** on disk. Last angular commit `4cf1ba44` (pushed).

---



---

> 🗄️ **104 lines of superseded history moved to [CURSOR-ANGULAR-HISTORY.md](CURSOR-ANGULAR-HISTORY.md) on 2026-09-09**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-ANGULAR-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```

---

<!-- rotated out of CURSOR-ANGULAR.md on 2026-09-09 -->

## ✅ 2026-09-07 — CHUNK 11 LANDED AS SEVEN FILES. COLD START READS THIS BLOCK ONLY.

**Session `c51d9a36`. Tree CLEAN for angular. Commit `4cf1ba44`, ✅ PUSHED.**
No agents were used — the user said *"do not deploy any agents"* in this session.

### 🔴 THE ONE NEXT ACTION

**Topic 03 chunk 12 · `12-what-does-not-belong.md`** — `sidebar_position: 12`. Bank section
`sed -n '2860,3010p' research_angular_p0_t03_providers.md` (§12.1 onward; ⚠️ `ls`-verify the exact
end line, the range above is the start of §12 and was not measured to its close).

🔴 **The bank tells you how to write it and it is unlike the others:** §12.1 opens
*"This chunk is the judgement chunk. There is less quotable source; the leverage comes from citing
rules already established elsewhere and applying them."* and explicitly says **do NOT re-derive**
`EnvironmentProviders`, `NG0207` or `importProvidersFrom` — cite chunk 03. The one line worth
restating: `Component.providers` is `Provider[]`, `ApplicationConfig.providers` is
`Array<Provider | EnvironmentProviders>`.

After 12: chunks **13, 14, 15, 16, 17** close topic 03. Then topic 01's deliberately-open `10g`/`10h`
and the `NG2xxx` field-shape family.

### What landed this session — topic 03 goes 11 → 12 of 17 chunks, 40 → 47 pages

Drafted as **ONE file at 719 lines / 24 ★**, split on concept boundaries to **seven files,
1489 lines / 71 ★ — both totals UP**, largest 251. Nothing trimmed to fit.

| file | lines | ★ | owns |
|---|---:|---:|---|
| `11-hydration-animations-and-the-rest.md` | 203 | 6 | the body; 🔴 the provider set DIFFERS dev vs prod |
| `11b-the-feature-inventory.md` | 185 | 9 | only `withI18nSupport()` is a plain opt-in |
| `11c-incremental-hydration-and-event-replay.md` | 242 | 11 | 🔴 `withEventReplay()` is redundant, proven in core |
| `11d-the-http-transfer-cache.md` | 208 | 11 | options REPLACE the default; `{isActive:true}` lifetime |
| `11e-the-contradiction-checks.md` | 210 | 11 | `NG5001`, both dev-only |
| `11f-animations-are-deprecated.md` | 190 | 10 | all three deprecated, NO replacement provider |
| `11g-the-standalone-core-providers.md` | 251 | 13 | the four that belong to no subsystem |

### 🔴 Bank corrections this session — do NOT re-derive

**`HYDRATION_CONFLICTING_FEATURES = 5001` is in `packages/platform-browser/src/errors.ts`, whose
header reserves 5000-5500 — NOT in `core/src/errors.ts`.** The first draft of 11e cited core and was
corrected against bank §99 item 2. `core`'s own header reserves **100-999**, which is why
`MISCONFIGURED_INCREMENTAL_HYDRATION = 508` → `NG0508` is three digits. Both codes are **positive**,
so neither renders a *"Find more at …"* guide-page suffix. 11e now states all of this.

### ⚠️ Unsettled items respected — a later pass must not "fix" these into assertions

- **`NG0508`'s message text and throw site were never read.** 11e names the code and explicitly
  refuses to reproduce a message. Bank §99 item 3 still marks it PARTLY RESOLVED.
- **`withNoHttpTransferCache()`'s body was not read.** So 11e states the *production* outcome of the
  transfer-cache contradiction as **undetermined**, while stating the incremental-hydration pair's
  outcome as fact (that one IS readable from the ternary: the opt-out's kind skips the default, and
  the deprecated opt-in's own providers land anyway).
- **`provideCssVarNamespacing`** named as a signature only, per bank §99 item 5.
- **`provideNgReflectAttributes`** — 11g follows bank §99 item 8 exactly: the **attributes** are
  deprecated in prose, the **function** is plain `// @public`. Do not merge the two.

### 🔴 The wire defect recurred a FOURTH time

`grep -rn 'not written yet'` at arrival found **chunk 06 refs still de-linked in three files that had
existed for days** — `01:173` (`provideAppInitializer`), `01:224` (ErrorHandler → belongs to `06g`),
`03:256`, `04:195`. All four promoted. This is now the fourth consecutive session to find this.
**Run that grep and check every hit against `ls` before believing any previous session wired
anything.** Also promoted: `02`'s animations row → `11f`, `10g`'s footer → `11`.

### ⚠️ A split-plan rename cost a linkcheck round

The draft was first split as 11/11b(incremental)/11c(cache)/11d(checks)/11e(animations)/11f(core),
then the head itself blew the cap at 315 lines and the feature inventory became a new `11b`,
shifting every later letter by one. Eight hrefs in the two already-written files pointed at the old
names. `yarn linkcheck docs/angular` caught all eight; a **label-vs-target** check caught two more it
could not (`[11c · …](11d-….md)`). 🔴 **If you renumber a family mid-split, grep for
`\[11[a-g] · …\](11[a-g]-…)` and compare the label to the target** — linkcheck only proves the
target resolves, never that the label agrees with it.

### Boards updated, and one correction to `progress.js`

Topic README banner 11→12 chunks / 39→47 files, seven new rows. `progress.js`'s angular comment said
*"135 files … topic 03 (25 files)"*; disk is **147 pages / 40**. ⚠️ The old comment counted **files
including each topic's README**, which `page-counts.json` excludes — the comment now says so
explicitly so the next reader does not "correct" it back. `page-counts.json` + `status.json`
regenerated, both `--check` clean. Gate: `yarn mdxcheck docs` 7041/0 (**without** `--no-rawtag`),
`yarn linkcheck` 7120/0.

### ✅ The homepage/static audit the user asked for first

`node scripts/page-counts.mjs --check` → *current*; `node scripts/status.mjs --check` → *up to date*;
angular read **147** pages against **147** on disk. The only drift in the whole homepage data path
was the stale `progress.js` **comment** above — the live fields (`pages: 2, pagesPlanned: 12`) were
correct, so the card was never lying. Both generators re-run and re-checked after this session's work.

---



---

> 🗄️ **1174 lines of superseded history moved to [CURSOR-ANGULAR-HISTORY.md](CURSOR-ANGULAR-HISTORY.md) on 2026-09-08**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-ANGULAR-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```

---

<!-- rotated out of CURSOR-ANGULAR.md on 2026-09-08 -->

## ✅ 2026-09-06 (night) — TOPIC 03 WAVE 1 LANDED. COLD START READS THIS BLOCK ONLY.

**Session `4bb50618`. Tree CLEAN for angular. Commits `e1596282` (checkpoint) and
`bead7b40` (wave 1 + wire pass).** ⚠️ **NOT PUSHED** — the user wound the session down before a
push. `git log origin/main..main` is NOT empty. **Pushing is the first action of the next session.**

### 🔴 THE ONE NEXT ACTION

**Topic 03 chunk 11 · `11-hydration-animations-and-the-rest.md`** — 🔴 that exact filename is
REQUIRED (chunk 02 links forward to it), `sidebar_position: 11`. Bank section
`sed -n '2501,2858p' research_angular_p0_t03_providers.md`.

🔴 **A WAVE-2 DISPATCH IS ALREADY WRITTEN — do not rebuild the briefs.** Full agent prompts for
chunks **11, 12 and 13**, carrying the hard rules, the split proof, the footer joins and the
per-chunk assignments, are staged at:

    /tmp/claude-1000/-mnt-Storage-Backup-Knowledge-devbible/4bb50618-63a9-4116-a798-d009c6c0bd15/scratchpad/angular-t03-wave2.js

⚠️ **That path is under `/tmp` and does not survive a reboot.** If it is gone, rebuild from this
file's wave-1 description; the shape is one `devbible-author` agent per chunk, `parallel()`, with
the coordinator doing the wire pass.

After 11/12/13: chunks **14, 15, 16, 17** close topic 03. Then topic 01's deliberately-open
`10g`/`10h` and the `NG2xxx` field-shape family.

### What landed this session — topic 03 goes 8 → 11 of 17 chunks, 24 → 39 files

| chunk | files | lines | split proof |
|---|---|---|---|
| **05e** | `05e` `05f` `05g` `05h` | 1076 | 616 → 1076 lines, ★ 11 → 22 — **both UP** |
| **09** | `09` `09b` `09c` `09d` `09e` | 1006 | 765 → 1006 lines, ★ 7 → 11 — **both UP** |
| **10** | `10` `10b` `10c` `10d` `10e` `10f` `10g` | 1644 | 323 → 1644 across seven files |

Three `devbible-author` agents in one `parallel()`, 0 errors, ~491k subagent tokens, 23 min.
`yarn linkcheck docs/angular`: **159 files, 0 problems.**

### 🔴 Two bank UNSETTLED items were RESOLVED from source — do NOT re-fetch

Written into `research_angular_p0_t03_providers.md` §99 (commit `c4a36c5` in the store):

1. **`NOT_USING_FETCH_BACKEND_IN_SSR = 2801` → `NG2801`.** 🔴 The bank's stated reserved range for
   `common/http` was **WRONG** — it said 2000–2999; the header comment says **2800–2899**.
   The same read surfaced **eleven `*_NOT_SUPPORTED_WITH_XHR` codes** (`keepalive`, `cache`,
   `priority`, `mode`, `redirect`, `credentials`, `integrity`, `referrer`, `referrerPolicy`) —
   that family **is** the argument chunk 09 makes about why `FetchBackend` became the default,
   and the bank did not have it.
2. **`HYDRATION_CONFLICTING_FEATURES = 5001` → `NG5001`** (chunk 11 needs this).
   **`MISCONFIGURED_INCREMENTAL_HYDRATION = 508` → `NG0508`** — ⚠️ code only; its **throw site and
   message text are still unread and must not be invented.**

### 🔴 The wire pass, and the defect that recurred a THIRD time

Five footer joins and eight inline refs were promoted. **Two were BACKWARD joins**, which point at
the **LAST file of the previous family**, never its first: `06`'s Prev → `05h` (was `05d`, which
skipped the entire 05e–05h family), and `10`'s Prev → `09e`.

🔴 **`01-app-config-and-what-bootstrap-does-with-it.md:55` was still calling chunk 05 *"not written
yet"* — a page that had existed for DAYS.** Found only by `grep -rn 'not written yet' *.md` and
checking every hit against `ls`. **Never trust a previous session's claim that a topic is wired.**

### ⚠️ Unconfirmed claims the authors flagged — do not let a later pass silently "fix" these

- **`ExpressionChangedAfterItHasBeenCheckedError` has no `NG0…` number named** anywhere in 05e–05h.
  The bank's enum extract does not carry one. It is referred to by class name only, deliberately.
- Whether `UseExhaustiveCheckNoChanges` is honoured in a **route** injector — stated as unverified
  on 05g. The half that IS settled (the environment initializer runs at that route injector's
  construction, `{self: true}`) is stated as fact with its source.
- Whether a production build actually **eliminates** the `ngDevMode` branch from the bundle —
  framed as depending on the optimiser folding `ngDevMode`, never as a measured outcome.
- The 05e author **removed two quantifications from its own draft** before reporting ("roughly
  doubles the work", "doubles the verification work") because nothing measures them, and an
  `Object.is` claim it had not verified. That is the bar.

---

## 📜 HISTORY — 2026-09-06 topic 01 close (superseded by the block above)

## ✅ 2026-09-06 — TOPIC 01 IS CLOSED.

**Tree is CLEAN. Everything is committed and ✅ PUSHED** — `origin/main` at `8cb6dd25`,
verified by ancestry: `git log origin/main..main` is EMPTY.

### 🔴 THE ONE NEXT ACTION

**Topic 03 · `the-provider-array`** — `docs/angular/pages/phase-0-how-angular-runs/03-the-provider-array/`,
25 files on disk, chunks 01-08g written. 🔴 **NEXT FILE, ls-verified 2026-09-06:
`05e-provide-check-no-changes-config.md`** (`sidebar_position: 5.4`) — the last change-detection
provider, ⚠️ developer preview and dev-mode-only, and its README row at line 44 is already waiting
for it in bold. Then **09 · `provideHttpClient()` and the backend** (README line 61; ⚠️
`FetchBackend` is the v22 default and `withFetch()` is deprecated), then 10-15 in README order.
Its research bank is [research_angular_p0_t03_providers.md](research_angular_p0_t03_providers.md),
195k — **complete, do NOT re-fetch.**

After topic 03: topic 01's two deliberately-open items — `10g` (calls and enums), `10h` (unsupported
syntax) and the `NG2xxx` field-shape family, all named in `10-metadata-errors-one-by-one.md`'s own
coverage note. Then topics 04-12 of phase 0, which are unstarted.

### What closed topic 01, this session

| commit | what |
|---|---|
| `29174960` | **15d + 15e** — drafted at 350 lines / 11 ★, split on the concept boundary to 232 + 259 / 8 + 7. Both totals UP |
| `3e2da484` | **16** — arriving from React, Vue or Svelte (219 lines, 7 ★) |
| `88a5787a` | **17 + 17b + 17c**, and the wire pass — **topic 01 CLOSED** |
| `2c1aaded` | dashboard: phase 0 `pages: 1 -> 2` |
| `8cb6dd25` | `page-counts.json` regenerated from disk |

**Topic 01 final: 70 files (69 pages + README), 17,807 lines, 421 ★, all 17 chunks.**
Started the session at 64 files / 16,369 lines / 372 ★.

🔴 **The wire pass found 16 files carrying de-linked refs to chunks 06, 07, 08, 09, 10 and 15 —
pages that had existed for DAYS.** This is the same defect the previous session recorded, and it had
recurred silently: a chunk landing is not a chunk being wired. `grep -rn 'not written yet' *.md` and
check every hit against `ls` before believing any earlier session finished. Only the genuinely
unwritten `10g` / `10h` / `NG2xxx` refs and the cross-topic ones in the README remain bold.

⚠️ **Chunk 17's filename does NOT match what earlier chunks promised.** Inbound refs said
*"17 · Consequences you actually hit"*; the three files that landed are
`17-the-filename-in-the-error.md`, `17b-the-resolution-errors.md`, `17c-the-v22-upgrade-wall.md`,
and each inbound ref was retargeted to whichever of the three actually owns its subject (06c's
NG3003 ref now points at 17b, not 17). **Forward refs by title are a promise the writer may not
keep — always re-check the target, never bulk-promote by name.**

### The dashboard, and why it barely moved

`summarise()` credits a `writing` phase `topics * pages / pagesPlanned`. **The unit is a FINISHED
TOPIC**, so topic 01 — 70 files, 17,807 lines — moved Angular from 1 to **2 of 211 topics**, about
half a percentage point. Phase 0's card reads **2 of 12**. The page count on disk (125, from
`page-counts.json`) is the number that reflects the volume. Nothing is broken; the granularity is
the syllabus's, and Angular's syllabus has 211 topics.

---

## 📜 HISTORY — 2026-09-06 wind-down at 95% (superseded by the block above)

**Tree is CLEAN. Everything is committed. There is NO salvage to recover.**
✅ **PUSHED** — `origin/main` at `7b6a9bca`, verified: `git log origin/main..main` is EMPTY. Nothing outstanding.

### 🔴 THE ONE NEXT ACTION

Write **`15d-configuring-extended-diagnostics.md`**, `sidebar_position: 15.3`, in
`docs/angular/pages/phase-0-how-angular-runs/01-compiler-with-a-framework-attached/`.

Bank **§15 @ 3811** ("Getting the configuration wrong") plus **§15 @ 3847** (v22 movement).
It owns: **NG4003** (`extendedDiagnostics` configured while `strictTemplates: false`, two numbered
actions), **NG4004** (unknown category, and its per-check variant), **NG4005** (unknown check name)
— 🔴 both NG4004 and NG4005 **print the full allowed list into the message**, which makes them
self-documenting and is worth saying · the `ng update` migration that writes
`nullishCoalescingNotNullable: "suppress"` and `optionalChainNotNullable: "suppress"` into your
tsconfig · the 22.1.3 fix restricting the event-handler check to property names longer than 2 chars.

🔴 **THREE INBOUND LINKS ARE ALREADY WAITING FOR IT, de-linked to bold:**
`15-extended-diagnostics.md:215` · `15b-the-roster-of-checks.md:101` · `15c`'s footer `Next →`.
`grep -n '15d · Configuring' *.md` re-finds all three. **Promote them the moment 15d lands.**

Then **16** (bank §16 @ 3883) and **17** (§17 @ 4047, the largest remaining). After topic 01
closes: **10g/10h** (§10.5, §10.6) and the NG2xxx field-shape family (§10.8, §10.10).

🔴 **§16 carries an explicit warning: the line "Svelte also compiles, React does not" is WRONG and
must not be written.** Read §16 @ 3883 before starting it.

### What this session did — five commits, all on `main`, all clean

| commit | what |
|---|---|
| `352aec15` | **wave-3 wire pass** — 12/13/14 had been committed WITHOUT being wired |
| `664b7bf2` | 14c, 14d, 14e |
| `93cf4383` | 14f, 14g |
| `afbc9719` | 14h, 14i |
| `24559594` | 14j, 14k — **chunk 14 CLOSED at 11 files** |
| `7b6a9bca` | 15, 15b, 15c |

**Topic 01: 64 files, 16,369 lines, 372 ★ · 15 of 17 chunks.** Measured on disk, not estimated.
Started the session at 53 files / 13,276 lines / 266 ★.

### 🔴 Two defects found this session that every automated check passes

1. **A commit landing a chunk is NOT the chunk being wired.** Wave 3 committed chunks 12/13/14 to
   disk while the README still called all three *"not written yet"* at a banner of 11 of 17, and 20
   in-prose refs across 15 files pointed at pages that existed. **Always `grep -rn 'not written yet'`
   across the topic and check each against `ls` before assuming the previous session finished.**
2. **A backward footer join pointing at the FIRST file of the previous family resolves and passes
   `yarn linkcheck`** while silently sending the reader back four to six pages. 13's Prev pointed at
   `12` and 14's at `13`; both were wrong and both were green. **A backward join points at the LAST
   file of the previous family.**

### 🔴 The lesson that cost this session the most time

**Do not let an early page name its siblings by LETTER.** `14` and `14b` forward-referenced
`14c`–`14g` for the flag family. Writing the TCB plumbing first displaced every one of those letters
— **twice** — and each displacement meant a hand-verified renumber across five files. Chunk 14 ended
at `14`…`14k`, eleven files, none of them at the letter originally promised.

**For 16 and 17: refer forward by TITLE and leave the letter out**, or write the whole family before
wiring any of it.

### Chunk 14 and 15, final letter map on disk

| | |
|---|---|
| 14 · 14b | TCB thesis · per-construct phrase book |
| 14c · 14d · 14e | the type-check file · how a diagnostic gets home · the errors that never arrive |
| 14f · 14g | 🔴 `strictTemplates` is ON by default since v22 · what turning it off costs |
| 14h · 14i | input-assignment flags · attributes, literals, safe navigation |
| 14j · 14k | event/reference/generics flags · the checks with no switch |
| 15 · 15b · 15c | the mechanism + semver caveat · the roster (18 vs 16) · the checks worth understanding |
| **15d** | ← **NEXT.** NG4003/NG4004/NG4005 and the migration's suppressions |

### The research bank is complete for everything remaining

`research_angular_p0_t01_compiler.md`, 4,542 lines. §15 (@3597), §16 (@3883) and §17 (@4047) are
fully researched with verbatim source quotes. **Do NOT re-fetch.** §19 is the source index, §20 the
reading order. 🔴 §18 lists claims that could NOT be confirmed — read it before asserting in that
area. 🔴 **This bank has had two counting defects: count a table yourself, never trust a number in
its prose.** (Done this session for §15 — 18 in the enum and 16 in the docs table both verified by
counting.)

---


## 📜 HISTORY — 2026-09-06 wave 3 dispatch (superseded by the block above)

Order: **"deploy 3 more agents for topic 01 chunks 12-14"**. Waves 1 and 2 are finished, wired and
**pushed at `2412abe0`** — the DAY CLOSED block below is accurate history.

### The three agents, disjoint by FILENAME PREFIX in one directory

| | File it creates (+ lettered siblings) | Bank § | Owns |
|---|---|---|---|
| **G** | `12-ivy-and-locality.md`, pos 12 | `§12` @ 2549 | the **principle** — locality, "the decorator is the compiler", separate + partial compilation, the linker |
| **H** | `13-where-the-compiler-runs-ngtsc.md`, pos 13 | `§13` @ 2801 | the **plumbing** — `ngtsc` as a TS *transformer*, `ngc`, the hard TS pin, local compilation mode, the negative-enum error-code encoding |
| **I** | `14-template-type-checking.md`, pos 14 | `§14` @ 3220 | the **TCB** — `strictTemplates`, the ten strictness flags, the IDE-vs-build divergence |

Boundaries briefed both ways: **G owns the principle, H owns the plumbing.** Overlap allowed.

### 🔴 THE WIRE-PASS PAYLOAD IS BIG THIS TIME — 13 in-prose refs already point at these chunks

These are **bold `*(not written yet)*` text on disk right now** and become promotable as each chunk
lands. `grep -n 'not written yet' *.md` to re-find them; they are NOT footers:

| → chunk | File : line |
|---|---|
| **12** | `06d-…:176` · `08f-…:75` · README *Where this connects* ("10 · Partial compilation") |
| **13** | `01-…:202` · `06-what-the-compiler-emits.md:292` · `08f-…:117` · `09e-…:105` · `10-metadata-errors-one-by-one.md:133` |
| **14** | `01-…:242` · `02-what-a-template-expression-may-contain.md:74`, `:260`, `:273` |

Plus the **footer joins**, all briefed as bold and needing promotion:
`11d` → 12 · G's last → 13 · H's first ← 12 · H's last → 14 · I's first ← 13.
🔴 **Each backward join points at the LAST file of the previous family, not its first** — the rule
that bit this session in wave 2. `I`'s last `Next →` stays bold (**15 · Extended diagnostics**, not
written, nobody assigned).

Then the README: promote rows 12, 13, 14 + every sibling row, banner **11 of 17 → 14 of 17**.

### Baseline for the split proof, measured before dispatch
**Topic 01: 9,685 lines · 196 ★ · 38 files.** Both totals must be UP when the three land.

### 🔴 Standing hazards, all three agents were warned
1. **This bank has had TWO counting defects today.** H was told to count the negative-enum error
   codes itself; I was told to count the strictness flags itself and to report if it is not ten.
2. **`{/* FOOTER */}` above a correct footer** passes the cap check, `mdxcheck` AND `linkcheck`.
   All seven of chunk 09's files shipped with it in wave 2. **`grep -rln '^{/\* FOOTER \*/}$'`
   before committing anything.**
3. **`>=6.0 <6.1` contains a `<`** and is an MDX breaker unless backticked — H writes it constantly.

---


## ✅ 2026-09-06 — DAY CLOSED CLEAN. All three agents landed, wired, PUSHED at `2412abe0`.

**Tree clean, nothing uncommitted, nothing unpushed. There is no salvage to recover.**
Everything below this block is history. Start at *The one next action*.

### What the day produced

**Phase 0: 46 → 96 files, 13,231 → 26,650 lines.** Two waves, six agents.

| Topic | Start of day | Now | Chunks |
|---|---|---|---|
| `01-compiler-with-a-framework-attached` | 6 files, 1,442 lines, 32 ★ | **38 files, 9,685 lines, 196 ★** | **11 of 17** |
| `02-standalone-by-default` | 31 files, 8,163 | **39 files, 9,922** | ✅ **CLOSED, 11 of 11** |
| `03-the-provider-array` | 6 files, 1,825 | **25 files, 6,496** | **8 of 17** |

Wave 1 `db014293` — the FIRST JOB split (`07` 723→1,370 across 5 chunks, `11` 358→1,123 across 4),
topic 03 chunks 06–08, topic 02's `08e` gap closed, full wire pass.
Wave 2 `b231086a` + `440c46ab` + `2412abe0` — topic 01 chunks 08, 09, 10 in **19 files**.

### 🔴 The one next action

Write **`10g-calls-enums-and-the-values-in-between.md`**, `sidebar_position: 10.6`, in
`01-compiler-with-a-framework-attached/`. Chunk 10 is a **deliberately unfinished catalogue** —
its own coverage note names what is missing, and the README carries a ⚠️ so no reader mistakes it
for complete. Bank §10.5 (`visitEnumDeclaration`, `resolveEnumValue`,
`resolveEncapsulationEnumValueLocally`) plus §09's `visitFunctionBody`.

Then `10h-syntax-the-evaluator-cannot-read.md` at 10.7 (§10.6 + `visitExpression` dispatch and
`BINARY_OPERATORS`), then the `NG2xxx` field-shape family from §10.8 and §10.10.

🔴 **When `10g` lands:** `10f`'s `Next →` moves off `11-why-defer-can-split-a-bundle.md` and onto
it, and three bold *(not written yet)* mentions of 10g/10h inside `10`, `10c` and `10f` become
links.

### The footer-chain rule this session learned the hard way

Every backward join points at the **LAST file of the previous family, not its first** — `09`'s
Prev is `08f`, `10`'s is `09g`, `07`'s is `06d`, `11`'s is `10f`. Pointing them at `08`/`09`/`06`/
`10` **resolves and passes `yarn linkcheck`**, and silently sends the reader backwards four to six
pages. Eight joins were promoted this way in `2412abe0`; the only bold one left in topic 01 is
`11d → 12`, which is correct.

🔴 **Two other defects that every automated check passes**, both hit today:
- **`{/* FOOTER */}` above a correct footer.** All seven of chunk 09's files shipped with it. It is
  a valid MDX comment with no link, so the cap check, `mdxcheck` and `linkcheck` all pass it.
  Stripped before commit. **Always `grep -rln '^{/\* FOOTER \*/}$'` before committing.**
- **A demoted link promoted to the wrong sibling.** Topic 02's four `08e` refs each needed a
  *different* target (`08e`/`08g`/`08f`/`08h`), mapped by the sentence around each.

### Pending

**211 topics, 1 closed.** Topic 01 needs **12–17**; topic 03 needs **05e, 09–17**; topics **04–12**
unstarted; phases 1–15 are **199 topics**, none started. Phase 1 APPROVED after Phase 0.

### ✅ Bank corrections — DONE, nothing owed
t03 §99.11 closed, §100.1 and §100.2 marked stale. t01's ten-vs-nine strings off-by-one **fixed**
(verified by counting the table). t01 C10 was **not** overwritten — agent A's reading and the
bank's are different claims that agree on eight failure conditions and disagree on where the ninth
lives; the entry records the dispute and says to re-read the source. 🔴 **This bank has now had two
counting defects. Count the table; do not trust a number in its prose.**

### ⚠️ Not this lane's, do not touch
`static/currency.json` and `graphify-out/cache/last_query_stamp` are modified by other sessions.
Two redux-toolkit commits (`815d87f7`, `40cb06fa`) rode along on the push. 🔴 **Never `git add -A`.**

---


## 🔴 2026-09-06 17:15 — WIND-DOWN SAVE, session `209edc13`. COLD START READS THIS BLOCK ONLY.

Order that closed the day: **"Send signal to windup on all agents, do not kill… immediate save
session progress for cold start."** Wind-down signals sent to all three wave-2 agents; they were
told to finish the file they were in, split anything over cap, de-link anything dangling, and
report. **They may still have been finishing when this was written.**

### 🔴 FIRST ACTION ON A COLD START — do this before anything else

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
git status --porcelain docs/angular/          # anything ?? is UNCOMMITTED SALVAGE
yarn linkcheck docs/angular                   # must be 0; if not, fix before ANY commit
wc -l docs/angular/pages/phase-0-how-angular-runs/01-compiler-with-a-framework-attached/*.md
```
**Uncommitted `08*`/`09*`/`10*` files are finished work, not rubbish.** QC them and commit them
before writing one new line. They were written by three agents that were told not to commit.

### 🔴 UPDATE 17:35 — D and E are DONE and COMMITTED at `b231086a`. F still writing.

**13 files committed** (chunk 08 in 6 files, chunk 09 in 7). Split proofs all up: `08` 316→479
across 08+08b, `08d` 342→479 across 08d+08e, `09` 329→**1711 / 41 ★** across seven files.
Topic 01 is now **~9,700 lines / ~196 ★**, from a 5,001 / 91 baseline.

🔴 **Defect caught and fixed while committing:** all seven of E's files shipped a
`{/* FOOTER */}` marker sitting **above an otherwise-correct footer**. The marker is a valid MDX
comment with no link to resolve, so the cap check, `mdxcheck` and `linkcheck` **all pass a page
carrying it** — this is how 1,241 pages once shipped with no navigation. Stripped from all seven,
each footer verified still present. **Re-run `grep -rln '^{/\* FOOTER \*/}$'` after F lands.**

⚠️ **The family boundaries moved — do NOT trust the join list below without checking disk.**
D added `08f-the-cost-of-generated-code.md`, so 08's last file is **`08f`**, not `08e`.
E added `09g-reading-a-metadata-failure.md`, so 09's last file is **`09g`**, not `09f`.
F is still adding `10*` files.

### State at wind-down — the original 16-file snapshot, now partly superseded

`01-compiler-with-a-framework-attached/`, **3,952 lines, nothing over 300**:

| Agent | Files | Lines |
|---|---|---:|
| **D** — chunk 08, *Instructions, not a virtual DOM* | `08`, `08b` selector problem + reference inversion, `08c` the instruction set is à la carte, `08d` what the fixed shape costs, `08e` only compiled classes are renderable | 1,224 |
| **E** — chunk 09, *Static analysability* | `09`, `09b` what is evaluated vs relayed, `09c` the partial evaluator is the grammar, `09d` the single-return-function rule, `09e` `selector` must reduce to a string, `09f` `imports` and lazy loading | 1,507 |
| **F** — chunk 10, *Metadata errors* | `10`, `10b` the decorator argument itself, `10c` symbols the compiler cannot resolve, `10d` import cycles and local compilation, `10e` values that resolve but do not fold | 1,221 |

✅ E's `09` was 329 lines mid-write and **already split itself** — no cap debt outstanding.

**Split-proof baseline for topic 01, measured before wave 2: 5,001 lines / 91 ★ / 19 files.**
After committing the 16, both totals must be far higher.

### 🔴 THE WIRE PASS IS THE OUTSTANDING WORK — it is the coordinator's, never an agent's

Every cross-chunk footer end was **deliberately written as bold text, not a link**, because the
three agents ran concurrently and none could safely link a sibling that might not exist. Promote
these five, then the README:

1. `07e-what-actually-performs-the-diff.md` → `Next →` bold **08** → link `08-instructions-not-a-virtual-dom.md`
2. `08e-only-compiled-classes-are-renderable.md` → `Next →` bold **09** → link `09-static-analysability-is-the-load-bearing-constraint.md`
3. `09-static-analysability-…md` → `← Prev` bold **08** → link `08-instructions-not-a-virtual-dom.md`
4. `09f-imports-and-the-rule-about-lazy-loading.md` → `Next →` bold **10** → link `10-metadata-errors-one-by-one.md`
5. `10-metadata-errors-one-by-one.md` → `← Prev` bold **09** → link `09-static-analysability-…md`
6. ✅ `10e-values-that-resolve-but-do-not-fold.md` → `Next →` `11-why-defer-can-split-a-bundle.md` was
   briefed as a **real link** (that file exists) — **verify it, do not assume it.**

⚠️ **Confirm the first/last file of each family from disk before editing** — the lists above are
what was on disk at 17:15 and an agent may have added one more while finishing.

Then `01-compiler-with-a-framework-attached/README.md`: promote rows **08, 09, 10** from bold to
links, add a row for each of the **13 lettered siblings**, and move the banner from **8 of 17** to
**11 of 17**. 🔴 A row's *Covers* cell must say what the page argues — read each `title:`, do not
guess from the filename.

Finally `yarn linkcheck docs/angular` (0 problems), then commit explicit paths and push.

### ✅ Wave 1 is DONE, WIRED and PUSHED — `db014293`. Nothing owed there.
42 pages. Topic 02 **CLOSED**. The board's red FIRST JOB discharged and proven: `01/07`
723→1,370 across 5 chunks, `01/11` 358→1,123 across 4.

### ⚠️ Not mine, do not "fix"
- **`40cb06fa redux-toolkit: fix 8 doc-verified accuracy defects` is COMMITTED BUT UNPUSHED** by
  another session in this shared checkout. A `git push` of `main` **will carry it along** — that is
  unavoidable and normal, but know that it is not this lane's work.
- `static/currency.json` and `graphify-out/cache/last_query_stamp` are modified by other sessions.
  🔴 **Never `git add -A` here.**

### 🔴 Bank correction still owed — deferred deliberately, now SAFE to do
`research_angular_p0_t01_compiler.md` §2 item **C10** says `registerDeferrableCandidate` bails on
**eight** checks. The verbatim function has **nine** returns; the ninth is a candidate *filter*,
not a rejection. Page `11b` is already correct. It was left alone while three agents were reading
that 224 KB file — **once they are done, fix it.** (The t03 bank's three corrections are already
applied and pushed.)

### Pending after this lands
Topic 01 would be **11 of 17** — leaving **12, 13, 14, 15, 16, 17**. Topic 03 at 8 of 17, leaving
**05e, 09–17**. Topics 04–12 unstarted. Phases 1–15: **199 topics**, none started.

---


## 🔴 2026-09-06 — WAVE 2 IN FLIGHT, session `209edc13`. Read this first.

Order: **"deploy 3 more agents for topic 01 chunks 08-10"**. Wave 1 is finished, wired and
**pushed at `db014293`** — everything in the wave-1 block below it is history and accurate.

### The three agents, disjoint by FILENAME PREFIX inside one directory

All three write into `01-compiler-with-a-framework-attached/`. They cannot collide because each
owns a prefix and none may edit an existing file or the README.

| | File it creates (+ lettered siblings) | Bank section | Status |
|---|---|---|---|
| **D** | `08-instructions-not-a-virtual-dom.md`, pos 8 | `## §08` @ line 966 | dispatched |
| **E** | `09-static-analysability-is-the-load-bearing-constraint.md`, pos 9 | `## §09` @ line 1129 | dispatched |
| **F** | `10-metadata-errors-one-by-one.md`, pos 10 | `## §10` @ line 1607 | dispatched |

🔴 **The boundary between E and F is deliberate and was briefed both ways:** E owns the
*mechanism* (the partial evaluator, the object-literal rule, why `selector` cannot be computed,
why `imports` must be identifiers); F owns the *enumeration* (every metadata error as symptom →
cause → fix). Overlap is explicitly allowed — a duplicated error entry is far better than a gap.

### 🔴 The footer joins the coordinator MUST promote — none of them is an agent's job

Because all three run concurrently, every cross-chunk footer end was briefed as **bold text, not a
link**. After they land, promote:

1. `07e-what-actually-performs-the-diff.md` → `Next →` currently bold **08** → link it.
2. D's last file → `Next →` bold **09** → link it.
3. E's first file → `← Prev` bold **08** → link it. E's last file → `Next →` bold **10** → link it.
4. F's first file → `← Prev` bold **09** → link it.
5. ✅ F's last file → `Next →` `11-why-defer-can-split-a-bundle.md` was briefed as a **real link**
   (that file exists), so that one join should already be correct — verify, do not assume.

Then the topic 01 README: promote rows 08, 09, 10, add every lettered sibling row, and move the
banner from **8 of 17** to **11 of 17**.

### Baseline for the split proof, measured before dispatch

| Topic | Lines | `grep -c '^\*\*★'` | Files |
|---|---:|---:|---:|
| `01-compiler-with-a-framework-attached` | **5,001** | **91** | 19 |

Both must be UP when the three land. Phase 0 as a whole: **84 `.md` files, 21,520 lines.**

### 🔴 Bank corrections still owed — carried forward from wave 1, NOT yet done
1. `research_angular_p0_t01_compiler.md` §2 C10 says `registerDeferrableCandidate` bails on
   **eight** checks; the verbatim function has **nine** returns, the ninth being a candidate
   *filter*. Page `11b` is correct; the bank is not. **All three wave-2 agents were warned.**
2. `research_angular_p0_t03_providers.md` §99.11 is **RESOLVED** (`ComponentInputBindingOptions`,
   now stated on `03/08c`). §99.6 stays open, cited on-page as an inference.
3. §100.2 claims four over-cap files in topic 02 — **stale**, verified all four already split.

---

## 🔴 2026-09-06, session `209edc13` — THREE AGENTS IN FLIGHT. Read this before anything below.

Order that opened the session: **"Work on Angular and deploy 3 more agents, split the work between
them, monitor them, use the devbible skill."** Lane claimed in `LOCKS.md`. Everything below this
block is history and is still accurate as *state*; this block is what is *happening*.

### The three agents and their EXACT file allowlists — they do not overlap

| | Job | May create/edit | Status |
|---|---|---|---|
| **A** | ✅ **DONE, COMMITTED `5124253d`.** The split is PROVEN: `07` **723 → 1370** lines across `07`/`07b`/`07c`/`07d`/`07e`; `11` **358 → 1123** across `11`/`11b`/`11c`/`11d`; topic 01 **2523 → 3935 lines, 37 → 67 ★** — both UP. 5 of the 6 dangling `11b` refs promoted to real links; the 6th was answered in place by a new *Two emit modes* section in `11`, so it no longer exists. The stale chunk-07 ref now points at `07b`. 🔴 **Accuracy fix:** the bank says `registerDeferrableCandidate` bails on **eight** checks — the verbatim function has **nine** returns, the ninth being a candidate *filter*, not a rejection; `11b` says nine returns / eight failures and every in-prose condition number was renumbered. 6 unsettled claims written as explicitly uncertain, not asserted. All 9 files ≤300, badged, sourced, no `{/* FOOTER */}`, 0 MDX hazards, 0 link problems | `01/07*.md`, `01/11*.md` | ✅ landed |
| **B** | ✅ **DONE, COMMITTED `efc5e7cc`.** **16 files, not 3.** Topic 03 **2277 → 6496 lines, 60 → 142 ★**. `06` → 7 files (ordering / failure / environment / platform / global listeners / `ErrorHandler`), `07` → 2, `08` → 7. 5 unsettled claims written as uncertain or left out; 3 source reads **resolve bank item §99.11** (`ComponentInputBindingOptions`). Upstream doc typo flagged: `NavigationBehaviorOptions.scroll` cites `@see withInMemoryRouterScroller`, not an export at v22.1.5. All 16 ≤300, badged, sourced, real footers, 0 MDX hazards, 0 link problems | `03/06*`, `03/07*`, `03/08*` | ✅ landed |
| **C** | ✅ **DONE, COMMITTED `1536d967`.** Both files exhausted past the cap and split — **10 files, not 2.** `08e` drafted whole at **537 lines / 11 ★ → 1491 / 39** across `08e`/`08f`/`08g`/`08h`/`08i`/`08j` (pos 8.4–8.9); `06` drafted whole at **361 / 6 → 1066 / 24** across `06`/`06b`/`06c`/`06d` (pos 6–6.3). Topic 01 **3935 → 5001 lines, 67 → 91 ★**; topic 02 **8431 → 9922, 244 → 283**. `08e`'s scope came from the four demoted refs: *what to do INSTEAD of `importProvidersFrom`* — three narrowings (`08f` the multi bucket end to end, `08g` the route-`providers` form, `08h` keeping a legacy module lazy), plus `08i` what a library should ship, `08j` when the bridge is still honest. 6 unsettled claims written as uncertain. No fabricated output — the one emitted-JS block is a labelled 2018 `architecture.md` quote, corrected field-by-field against v22.1.5. All 10 files ≤300, badged, sourced, real footers (**0 `{/* FOOTER */}`**), 0 MDX hazards, 0 link problems | `01/06*.md`, `02/08e–08j` | ✅ landed |

🔴 **No agent commits. No agent touches any `README.md`.** The coordinator does the wire pass —
READMEs, chunk tables, footer chains, demoted-link promotion — then commits explicit paths.

### 🔴 The split-proof baseline, measured before dispatch

A trim passes the cap check, the MDX check and the link check and is indistinguishable from a
split in a file listing. This has silently destroyed content four times. **After agent A, both of
topic 01's numbers must be UP.**

| Topic | Lines BEFORE | `grep -c '^\*\*★'` BEFORE |
|---|---:|---:|
| `01-compiler-with-a-framework-attached` | **2,523** | **37** |
| `02-standalone-by-default` | **8,431** | **244** |
| `03-the-provider-array` | **2,277** | **60** |

```bash
cd /mnt/Storage/Backup/Knowledge/devbible/docs/angular/pages/phase-0-how-angular-runs
for d in 0*/; do echo -n "$d "; cat $d*.md | wc -l; done
grep -h '^\*\*★' 01-compiler-with-a-framework-attached/*.md | wc -l
```

### ✅ Coordinator wire pass DONE — commit `db014293`, pushed

Three READMEs rewired, 4 demoted links promoted, 3 footers repaired. 🔴 **The four demoted `08e`
refs each went to a DIFFERENT sibling** (`08e`/`08g`/`08f`/`08h`), mapped by the sentence around
each one — sending all four to `08e` would have resolved, passed linkcheck, and pointed three
readers at the wrong page. Two of the three footer repairs (`02/08d` Next, `02/09` Prev) also
*resolved*, so linkcheck was silent on them: a wiring defect is invisible to every automated check.

Also fixed, predating this session: topic 01's *Where this connects* attributed `@defer` to chunk
08; it is chunks 11–11d.

**Gates across all of `docs/angular`: 92 files, 0 link problems, nothing over 300, no
`{/* FOOTER */}`, no duplicate `sidebar_position`, every topic README at position 0, 0 MDX hazards.**
🔴 No `yarn build` has been run this session — the deploy is CI's verdict.

### 🔴 WHAT IS PENDING — measured off disk 2026-09-06 after the push

**Track: 211 topics across 16 phases. 1 closed. 210 pending.**

| Phase 0 topic | State | Left |
|---|---|---|
| `01-compiler-with-a-framework-attached` | 19 files, 5,001 lines — **8 of 17** numbered chunks | **9**: 08, 09, 10, 12, 13, 14, 15, 16, 17 |
| `02-standalone-by-default` | 39 files, 9,922 lines — ✅ **CLOSED**, 11 of 11 | — |
| `03-the-provider-array` | 25 files, 6,496 lines — **8 of 17** | **10**: 05e, 09, 10, 11, 12, 13, 14, 15, 16, 17 |
| `04`–`12` | not started | **9 topics** |

Phases 1–15: **199 topics**, none started. Phase 1 is APPROVED to run after Phase 0.

**The next file, if you want one named:** `01-compiler-with-a-framework-attached/08-instructions-not-a-virtual-dom.md`
(pos 8) — `07e`'s footer already names it as bold text; promote that when it lands. Bank section
`## §08 — Instructions, not a virtual DOM` is at line 966 of `research_angular_p0_t01_compiler.md`,
and agent C banked `noSideEffects`' full docstring for exactly this chunk.

### 🔴 Bank corrections owed — do these before the next run reads them
1. `research_angular_p0_t01_compiler.md` §2 C10 says `registerDeferrableCandidate` bails on **eight**
   checks. The verbatim function has **nine** returns; the ninth is a candidate *filter*. Page `11b`
   is already correct; the bank is not.
2. `research_angular_p0_t03_providers.md` §99.11 is **RESOLVED** — `ComponentInputBindingOptions`'
   two settings are now read and stated on `08c`. §99.6 stays open but is cited on-page as an inference.
3. §100.2 claims four files over cap in topic 02 (`04` 677, `06` 709, `05` 668, `07` 444). **Stale —
   verified 2026-09-06 that all four were already split.** Nothing in `docs/angular` is over 300.

### Found, not fixed
- The **phase** README (`phase-0-how-angular-runs/README.md`) carries no tier badge and no
  `> Verified:` line. Pre-existing, untouched this session.
- `static/currency.json` is modified in the working tree by another session. Left alone.

---


## ✅ 2026-09-06 — SPLIT + WIRE AGENT DONE. Read this block, then "THE ONE NEXT ACTION" below.

The single agent the block below asked for **ran and finished**. Both over-cap files are split and
topic 02 is fully wired. Commits `014af746` (topic 03) and `aa0284e3` (topic 02), tree clean.

**Split proof — both totals UP in both topics, so these were splits and not trims:**

| Topic | Lines before → after | `grep -c '^\*\*★'` before → after |
|---|---|---|
| `03-the-provider-array` | 1,825 → **2,277** | 43 → **60** |
| `02-standalone-by-default` | 8,163 → **8,431** | 234 → **244** |

- `03/05-change-detection-providers.md` (648) → **05** (zoneless is the default, 251) +
  **05b** (`provideZoneChangeDetection()`, the opt-out, pos 5.1, 255) +
  **05c** (the redundant opt-in and NG0408, pos 5.2, 289) +
  **05d** (the polyfill half and `NoopNgZone`, pos 5.3, 299).
- `02/10-why-standalone-makes-the-graph-splittable.md` (381) → **10** (locality + `@defer`, 230) +
  **10b** (`loadComponent` at a route boundary, pos 10.1, 232) +
  **10c** (incremental compilation and the scope cache, pos 10.2, 171).

**Topic 02 is CONTENT-COMPLETE AND WIRED — 34 files, 8,431 lines.** All 32 content footers rebuilt
in `sidebar_position` order from what is on disk, last one pointing at
`../03-the-provider-array/README.md`; README chunk table relinked with every lettered sibling and
its `Start →` added; **all 9 demoted links in chunk 08 resolved** (chunk 08's own labels had
drifted, so each was remapped by *description*: "is the two errors it raises" → `08d`, the
injector-parenting and last-wins references → `08c`). ⚠️ **`08e · The interop shapes that beat it`
was never written** — three references in `08` and one in `08c` are deliberately bold text, not
links. Write `08e-the-interop-shapes-that-beat-it.md` at pos 8.4 and promote them.

**Verified clean in both directories:** 0 dangling links (also 0 across all of `docs/angular`),
0 MDX hazards, nothing over 300 lines, every page badged and carrying `> Verified:`, no
`{/* FOOTER */}`, no ` ```console `, no duplicate `sidebar_position`.

### 🔴 The ACTUAL next file

`03-the-provider-array/06-startup-and-error-listener-providers.md`, `sidebar_position: 6`,
`sidebar_label: "06 · Startup and error-listener providers"`. Chunk `05d`'s footer already names it
as bold text; promote that to a link when it lands. Research bank
`research_angular_p0_t03_providers.md` is ready. Topic 03 is then chunks 07–17 (plus `05e ·
provideCheckNoChangesConfig`, already a row in its README).

Still true and NOT done by this agent: topic 01 chunks 06–17; no build has been run.

✅ **The two board items ARE now done — 2026-09-06, commit `e61a15b5`, no agents.**
`src/data/progress.js` phase 0 is `pages: 1, pagesPlanned: 12` (topic 02 counts, 01 and 03 are
part-written and do not), the phase README badge reads **"In progress — 1 of 12 written, 2 more
in flight"** with topics 01/02/03 linked, and `static/status.json` moved Angular
`not-started → in-progress`. 🔴 **Bump `pages` to 2 the moment topic 01 or 03 closes** — and
`updated` with it; the homepage freshness row currently reads **Angular 2026-09-06 12:22**, the
newest stamp in the corpus. Detail: [[devbible-dashboard-reconcile-20260906]].

---

## 🔴 2026-09-06 ~11:40 — WOUND DOWN AT THE 80% LINE, session `11a770dc`. HISTORY, superseded above.

Order that opened the session: **"ultra code complete angular please"** (ultracode → Workflow
tool). Order that closed it: **"We are almost 80% of usage… stop and report back… first important
thing is saving the cursor just in case for cold start."**

### 🔴 STOPPED AT THE 96% LINE — workflow `wf_3efd849c-aab` killed. THIS IS THE NEXT ACTION.

**Everything is committed and pushed. `main` == `origin/main`. Tree clean.**

🔴 **FIRST JOB: SPLIT the two files banked OVER THE CAP. Never trim them.**
Prove it — record `wc -l` and `grep -c '^\*\*★'` before; **both totals must go UP.**

| File (topic 01) | Lines | Over by |
|---|---:|---:|
| `07-the-create-pass-and-the-update-pass.md` | **723** | 423 |
| `11-why-defer-can-split-a-bundle.md` | **358** | 58 |

⚠️ Chunk **11 was killed mid-split**: it had already written 6 in-prose links to
`11b-the-nine-conditions-and-the-barrel-trap.md`, which does not exist. **All 6 demoted to bold
text** (commit `4f1da465`) — promote them when `11b` lands. The writer's own intended boundary was
*the mechanism* vs *the nine conditions + the barrel trap*; use it.

### 🔴 RESUME THE RUN — do not re-dispatch from scratch

```
Workflow({scriptPath: "/mnt/Storage/my-learning/claude/devbible/angular/WORKFLOW-p0-topics-01-03-remaining.js",
          resumeFromRunId: "wf_3efd849c-aab"})
```

Completed agents replay from cache. ⚠️ **Copy `angular/ng-bank.sh` to the scratchpad path the
script names first**, or every writer's commit step fails at the end of an otherwise good page.

That script covers **24 chunks** — topic 01's 06–17 and topic 03's 06–17 — and 🔴 **its Stage 1 is
a PASSTHROUGH, not a research agent.** The banks are on disk and must not be paid for twice:
`research_angular_p0_t01_compiler.md` (**224 KB**) · `research_angular_p0_t03_providers.md` (**194 KB**).
Two of the 24 landed (topic 01 chunks 07 and 11, both needing the split above).

**If a run dies again:** chunks that landed are committed and correct; only their **footers** are
placeholders. **Re-run the Wire stage alone — never the writers.**

### ✅ THE BUILD IS GREEN — run `34016813560`, build + deploy both passed

Pushed at `aa0284e3`. Verified before pushing: **0 link problems** by the corrected scan below,
nothing over 300 lines, no `{/* FOOTER */}`, no ` ```console `, no duplicate `sidebar_position`,
0 MDX hazards.

### ✅ The two over-cap files are SPLIT, and the splits are proven

| Topic | `wc -l` before → after | `★` before → after |
|---|---|---|
| `03-the-provider-array` | 1,825 → **2,277** | 43 → **60** |
| `02-standalone-by-default` | 8,163 → **8,431** | 234 → **244** |

Both totals **up**, so splits and not trims. `05-change-detection-providers.md` (648) → `05`/`05b`/
`05c`/`05d`; `10-why-standalone-makes-the-graph-splittable.md` (381) → `10`/`10b`/`10c` (its own
`10b` came out at 306 and split again rather than being shaved). Commits `014af746`, `aa0284e3`.

### ✅ Topic 02 is FINISHED — 32 files wired

All footers rebuilt in on-disk order, chain verified end to end, README relinked (31 rows), 🚧 line
gone. All 9 demoted links in chunk 08 resolved — 🔴 remapped **by description, not by label**,
because chunk 08's labels had drifted from its filenames; matching on labels would have pointed
them at the wrong files. ⚠️ `08e · The interop shapes that beat it` was **never written** — 4
references stay bold text deliberately.

### State on `main` — everything below is COMMITTED, tree clean

**50 files, 13,231 lines** under `docs/angular/pages/phase-0-how-angular-runs/`.

| Topic | Tier | Files | Lines | State |
|---|---|---:|---:|---|
| `01-compiler-with-a-framework-attached` | Master | 6 | 1,442 | **Unchanged this session.** 5 chunks + README of a **17-chunk** plan. Its research bank IS written — next file `06-what-the-compiler-emits.md`, pos 6 |
| `02-standalone-by-default` | Master | **31** | **8,163** | 🔴 **Chunks 04–11 all written.** Only chunk 08's split is ragged (see below) |
| `03-the-provider-array` | Master | 6 | 1,825 | Chunk **05 written but 648 lines**. 06–17 not started |

Workflow `wf_cbcebb9f-311` banked 4 commits + the wind-down commit `2a9b3f42`.

### 🔴 The research is DONE and BANKED — do not pay for it twice

Three banks, **285 KB**, in this store. Every remaining chunk of topics 01/02/03 writes from them:

`research_angular_p0_t01_compiler.md` (43 KB) · `research_angular_p0_t02_standalone.md` (127 KB) ·
`research_angular_p0_t03_providers.md` (114 KB)

### What is left in topics 01/02/03

- **01** — chunks 06–17 (12 planned). Bank ready.
- **02** — content complete; needs the **wire pass only**: footers are placeholders, README still
  says `🚧 3 of 11`, and `08`'s siblings need their footer chain rebuilt from what is on disk.
- **03** — split `05`, then chunks 06–17 (12 planned). Bank ready.

### 🔴 Debt this session created, all recorded, none lost

1. **9 demoted links in topic 02 chunk 08.** Its writer was killed mid-split after its filenames
   drifted from its own plan — it linked `08b-what-importprovidersfrom-costs`,
   `08c-the-two-errors…`, `08d`/`08e-the-interop-shapes…` while writing
   `08b-what-importprovidersfrom-drags-in`, `08c-ordering-cycles…`, `08d-the-two-errors…`.
   Demoted to bold text rather than remapped by guesswork. **Promote them once the real chunks
   exist** — and note `08e-the-interop-shapes-that-beat-it.md` was never written at all.
2. **14 demoted links in topic 03 chunks 01–04** (commit `70928c81`) — see the deploy section
   below. Promote in the coordinator pass. ⚠️ Name collision to settle: the prose says
   `12-what-does-not-belong.md`, the plan writes `12-what-does-not-belong-in-the-array.md`.
3. **12 fractional `sidebar_position`** values in topic 02 (`4.1`, `4.2`, `5.1`, …). They are the
   only 12 in a corpus of 6,787 — every other lettered sibling takes the next **integer**. It
   sorts correctly, so it is not urgent, and renumbering is **safe** because positions live in
   frontmatter while links point at *filenames*. Coordinator pass, not mid-run.

### ✅ The red deploy is FIXED — and here is the trap that hid it

The Pages deploy had been **red for two hours** and nothing looked wrong. `docusaurus.config.js`
line 72 is **`onBrokenLinks: 'throw'`** since 2026-09-05, and topic 03's chunks 01–04 carried 14
in-prose links to sibling chunks nobody had written. Runs `34008305214` and `34008410251` both
failed in **Build**.

🔴 **`deploy` is then *skipped*, not failed** — so the workflow shows one X, the live site keeps
serving the last good version, and this shared checkout silently blocks **every other track's**
publish. Fixed in `70928c81`, pushed. Full incident:
[[devbible-feedback-verify-in-ci-not-locally]].

**Run this before reporting anything — it is the check nothing else does.**

🔴 **2026-09-06: use `yarn linkcheck` instead of the inline python below.** It is the
same two classes, slug-aware (so no false positives from `NN-` prefixes), it names the class
and the correct fix, and it exits 1:

```bash
yarn linkcheck docs/angular      # or any topic directory; no arg = whole corpus
```

<details><summary>The inline version it replaced</summary>
🔴 **The `.md`-only version of this check is NOT enough and let a second red build through on
2026-09-06.** Use this one, from the repo root:

```bash
python3 -c "
import re,pathlib
bad=0
for f in sorted(pathlib.Path('docs/angular').rglob('*.md')):
    for i,l in enumerate(f.read_text().splitlines(),1):
        for m in re.finditer(r'\]\(([^)\s]+)', re.sub(r'`[^`]*`','',l)):
            t=m.group(1)
            if t.startswith(('http://','https://','#','mailto:','/')): continue
            if not t.endswith('.md'): print('RELATIVE-NOT-MD',f,i,t); bad+=1
            elif not (f.parent/t).exists(): print('DANGLING',f,i,t); bad+=1
print('problems:',bad)"
```

</details>

⚠️ **Two DIFFERENT bugs have gone red under `onBrokenLinks: 'throw'`, both from agent writers:**

1. **Linking a chunk before writing it** — the plan says it will exist, so it feels like a link.
   Cost: runs `34008305214` and `34008410251`.
2. 🔴 **Copying a doc quote verbatim, including its hrefs.** angular.dev writes **site-relative**
   links, so a faithful `> *"To use a component, [directive](guide/directives)…"*` becomes a link
   to `…/standalone-by-default/guide/directives` and fails the build. Cost: run `34015877866`.
   **Fix: make the href absolute (`https://angular.dev/…`), which is what the quote always meant.**
   A quote is the one place a writer is *trying* not to alter the text — so this will recur.

**Verified clean at wind-down:** 0 dangling links, 0 MDX hazards, every page badged and carrying a
`> Verified:` line, no `{/* FOOTER */}` markers, no duplicate `sidebar_position`.

### ✅ PHASE 1 IS APPROVED — 2026-09-06

> *"yes go ahead with phase 1 as well after phase 0"*

Satisfies the syllabus-first agreement for **Phase 1 — Components and templates, 16 topics**
(6 Master, 9 Understand, 1 Know); rows in `docs/angular/syllabus/01-the-angular-model.md`.
**Order is explicit: AFTER Phase 0.** Phase 2 is still NOT approved.
⚠️ Several Phase 1 topics overlap Phase 0 topic 01 (expression rules, `@let`) — topic 01 owns
*why the compiler forbids* a rule, Phase 1 owns *how to write* the binding. Cross-reference.

### 🔴 MEASURED: a planned chunk becomes ~2 files

Topic 02 was dispatched as **8 chunks** and produced **28 files, 8,163 lines**. That is the depth
bar working, not scope creep — but **every chunk count in this file is roughly half the real file
count.** Phase 0's remaining ~99 planned chunks are realistically **~190 files**.

### Standing orders from this session

- 🔴 **ONE workflow at a time** — never two in parallel. [[feedback-one-workflow-at-a-time]].
- 🔴 **Save the cursor AT DISPATCH, not at completion** — a workflow is exactly the window where
  the ceiling arrives, and the coordinator is idle while it spends.
- ⚠️ **"Signal to stop" ≠ kill.** I hard-killed `wf_cbcebb9f-311` when asked to signal it; nothing
  was lost because every writer commits its own file, but a graceful wind-down would have let the
  two over-cap files finish their own splits.

### The scripts are SAVED — a successor does not rewrite them

`…/claude/devbible/angular/` holds `ng-bank.sh` (🔴 copy it back to the scratchpad path the
scripts name), `WORKFLOW-p0-finish-master-topics.js`, `WORKFLOW-p0-new-topics.js` (takes
`args` = topic slugs; 04–12 planned at 8/9/11/8/9/6/5/4/6 chunks) and `WORKFLOWS-README.md`,
which explains 🔴 **how to recover a half-written run: re-run the Wire stage alone, never the
writers.**

### Still untouched

Topics **04–12** (Understand ×6, Know ×3), and all coordinator work — the phase README's
`🚧 0 of 12` and its twelve plain-bold rows, the nine remaining `_category_.json` (⚠️ only ever in
the same commit as that topic's first page), `src/data/progress.js` (`pages: 0`) then `yarn status`,
and a final build + link check.

---

**Created 2026-08-31**, the day Angular entered scope. Same rule as
[[cursor-java]]: `LOCKS.md` is history and costs 700 lines to read. This is the cursor.

## The order that started it — 2026-08-31, user's own words

> *"I do not like the UI dahboard need to improve it and i need to add angular syllabus as well"*

and, minutes later:

> *"Make sure angular is relevant to 2026 september"*

That second line is the constraint that shaped everything: **Angular 22, not Angular 17**.

## 🔴 2026-09-06 — PHASE 0 IS PART-WRITTEN. 3 of 12 topics STARTED, NONE FINISHED.

Three lanes ran on the three Master topics and were **wound down at the 94% usage line**.
Unlike 2026-08-31 (six lanes, zero pages), **every finished chunk is committed on `main`** —
each lane banked its own topic directory per file through a flock-serialised helper.

**15 files, 3,386 lines, 16 commits. Nothing over the 300-line cap.** `git log --oneline -- docs/angular/pages/phase-0-how-angular-runs`

| Topic | Tier | Chunks written | Dispatch bullets done | 🔴 Next file to write |
|---|---|---|---|---|
| `01-compiler-with-a-framework-attached` | Master | README + **5** | **5 of its own 17-chunk plan** — all still inside dispatch bullet 1 | 🔴 `06-what-the-compiler-emits.md`, pos 6, label ``06 · What the compiler emits: `ɵcmp` `` |
| `02-standalone-by-default` | Master | README + 3 | 3 of 9 (**11-chunk plan**) | 🔴 `04-what-imports-actually-means.md`, pos 4 |
| `03-the-provider-array` | Master | 4, **no README** | 2 of 9 | `05-change-detection-providers.md` (pos 5), already linked from `01` |

⚠️ **All three are far less complete than the chunk counts suggest.** These are Master topics
with nine concept boundaries each; the lanes got through the first one or two. Topic 03's own
handoff is blunt about it: **zero** of the `provide*` catalogue is written.

### 🔴 Defects to fix BEFORE writing anything new

1. ✅ **FIXED during wind-down.** `01-…/02-what-a-template-expression-may-contain.md` was
   banked at 330 lines (over cap) so it would not be lost at the ceiling; Lane A then split
   it properly into `05-expressions-statements-and-safe-navigation.md`. Verified a real
   split, not a trim: the topic total went **3,176 → 3,386 lines (+210)**. Nothing is over
   the cap now.
2. **`03-the-provider-array/README.md` does not exist.** Five links (every chunk's `Index:`,
   and `01`'s `Prev:`) dangle until it does. Write it first.
3. **`03-…/04`'s footer already points at `../04-ng-update-not-npm-install/README.md`**, a
   topic nobody has written — a dangling link, which is exactly what `0b5dacd4` existed to
   prevent. Repoint it to `05-change-detection-providers.md` when that lands.
4. ✅ **NOT a defect — a deliberate convention, do not "fix" it.** Topic 02's files are
   `01`, `01b`, `03` at positions 1, 2, 3. `01b` exists because chunk 01 hit 315 lines and
   was split on the concept boundary at `## Against the call it replaced`. Split proof:
   **315 → 493 lines, 9 → 15 `★` entries** — both up, so a real split. **From position 3
   onward the filename prefix equals `sidebar_position`**, which is why no `02-*.md` exists.
   Keep it: next file is prefix `04` at position 4.
5. Both other lanes forward-link to chunks that do not exist yet. Normal mid-topic, but the
   phase cannot be called done while any remain.

### Lane A's plan for topic 01 — 17 chunks, 5 written

Lane A found dispatch **bullet 1 alone** ("the template is a separate language") had five
chunks in it, and expanded the topic to a **17-chunk plan recorded in its own `README.md`**
(which says *"🚧 5 of 17 chunks written"* — bump it and swap each row to a link as chunks land).
That is the depth bar working, not scope creep: this is the phase's anchor topic.

**Written:** the four-stage pipeline · operator/literal/global tables · declarations and `@let`
· arrow functions · expressions-vs-statements and the v22 `?.` change. **1,447 lines, 34
gotchas, 28 interview questions.**

**Not started, in order:** what the compiler emits (`ɵcmp`, `ɵɵdefineComponent`,
`decls`/`vars`/`dependencies`, `ɵfac`) · create vs update pass (`RenderFlags`, slot model,
`ɵɵadvance`) · instructions rather than a virtual DOM · static analysability (NG1001, the
partial evaluator) · metadata errors in practice · why `@defer` splits a bundle no bundler
could · Ivy and locality · where the compiler runs (`ngtsc`, the TS peer pin) ·
`strictTemplates` · extended diagnostics · the React/Vue/Svelte comparison · consequences you
actually hit.

🔴 **When chunk 17 lands, its Next must be
`[Standalone by default](../02-standalone-by-default/README.md)`** — the dispatch's mandated
target, and that directory now exists.

### Lane B's plan for topic 02 — 11 chunks, 3 written

**Written (861 lines):** `bootstrapApplication` line by line and the `NgModule` bootstrap it
replaced (chunks 01 + 01b) · the version-by-version `standalone` history (chunk 03).

**Not started (6 of 9 dispatch bullets), with Lane B's chosen filenames:**
`04-what-imports-actually-means.md` · `05-unused-imports-and-the-compiler-diagnostics.md`
(NG8113, NG2010–2012 — split out of the next one) · `06-not-a-known-element.md` ·
`07-what-replaced-each-ngmodule-responsibility.md` ·
`08-ngmodule-interop-importprovidersfrom.md` · `09-the-standalone-migration-schematic.md` ·
`10-why-standalone-makes-the-graph-splittable.md` ·
`11-where-ngmodule-still-legitimately-appears.md`.

⚠️ Topic 02's README `Next →` is currently **bold text**, not a link, because
`../03-the-provider-array/README.md` does not exist. Restore it to a real link the moment
Lane C's README is written — same for several in-prose references the lane downgraded rather
than leave dangling.

### Coordinator work — NONE of it done

1. The twelve `_category_.json` files were deleted by `0b5dacd4` and never rewritten. The
   three live topic dirs need theirs, Java convention:
   `{"label":"01 · A compiler with a framework attached","position":1,"collapsed":true}`.
2. `phase-0-how-angular-runs/README.md` still says **🚧 0 of 12** and its rows are still plain
   bold text. Link a row only when its topic is genuinely finished — not merely started.
3. ✅ The phase index is now pinned to **22.1.5 / CLI 22.1.7** (commit `00612c81`).
4. `src/data/progress.js` Angular phase 0 is still `pages: 0`. Leave it there until topics
   are FINISHED, then `yarn status` (`yarn status --check` exits 1 when stale).
5. Nothing built or link-checked yet.

### The helper each lane used — recreate it, it lived in the scratchpad

```bash
#!/usr/bin/env bash
# ng-bank.sh <topic-slug> "<commit subject>"   — commits ONLY that topic dir, never `git add -A`
set -euo pipefail
cd /mnt/Storage/Backup/Knowledge/devbible
DIR="docs/angular/pages/phase-0-how-angular-runs/$1"
exec 9>/tmp/claude-1000/ng-angular-commit.lock
flock -w 600 9 || exit 1
git add -- "$DIR"
git diff --cached --quiet -- "$DIR" && exit 0
git commit -q -m "angular phase 0: $2" -- "$DIR"
```

🔴 **Keep this design.** It is the only reason this run banked 3,176 lines and the last one
banked nothing. Per-file commits, explicit pathspec, `flock` so parallel lanes do not collide
on `.git/index.lock`.

🔴 **The version spine MOVED and [[angular-phase-0-lane-brief]] now carries a CORRECTION
block at the top** — Angular is **22.1.5** (CLI/build/ssr **22.1.7**), zoneless is the
**default** in v22, and `NullInjectorError: No provider for X!` **no longer exists** in v20+
(angular.dev's own guide is stale; the source is right). The dispatch spec is out of date on
`withFetch` and `withIncrementalHydration`, both now deprecated. **Read that correction before
dispatching any lane.**

**Topics 04–12 remain unclaimed and unstarted.**

---

## 🔴 2026-08-31 — PHASE 0 SCAFFOLDED AND MERGED TO `main`, 0 of 12 WRITTEN.

The user's instruction, verbatim: *"start angular phase 0 with six parallel lanes"*, then
*"Work on new worktree"* and *"move all your changes to there"*.

| | |
|---|---|
| **Where** | 🔴 **`/mnt/Storage/Backup/Knowledge/devbible`, branch `main`.** The worktree is GONE — see below |
| Worktree | ⛔ **`…/devbible-angular` on branch `angular-phase-0` was merged to `main` and DELETED the same day**, on the user's instruction *"please merge everything to main"*. Verified at 0 unique commits and 0 uncommitted files first; branch deleted, `git worktree prune` run, directory gone. `git worktree list` shows only the main checkout. **Do not go looking for it** |
| Approval | The syllabus-first agreement was satisfied by the user naming phase 0 directly |
| Lane file | declare your own: `echo docs/angular > ~/.claude/lanes/$CLAUDE_SESSION_ID` |

✅ **The worktree rule was followed end to end this time** —
[[devbible-feedback-worktrees-are-temporary]]. Created when the user asked, merged the moment
the user asked, branch and directory deleted in the same breath, `git worktree prune` run, and
this store grepped for the path afterwards. **Work on `main` unless the user asks for a
worktree again.**

### The six-lane split of Phase 0's twelve topics

Balanced by tier, not by number — three Master topics and three Know topics, so each lane
carries one heavy and one light. Every lane writes **only** its own topic directories; the
coordinator owns `pages/README.md`, `phase-0-how-angular-runs/README.md`, every
`_category_.json` (all twelve pre-created), `progress.js` and `sidebars.js`.

| Lane | Topics | Tiers |
|---|---|---|
| A | `01-compiler-with-a-framework-attached` + `12-dev-mode-only-behaviour` | Master + Know |
| B | `02-standalone-by-default` + `11-jit-vs-aot` | Master + Know |
| C | `03-the-provider-array` + `10-partial-compilation` | Master + Know |
| D | `04-ng-update-not-npm-install` + `09-the-release-train` | Understand ×2 |
| E | `05-the-angular-build` + `08-what-ng-new-produces` | Understand ×2 |
| F | `06-angular-json-anatomy` + `07-the-typescript-setup` | Understand ×2 |

The shared lane brief — version spine, sources, cap rules, MDX hazards, footer convention —
was written to the session scratchpad as `angular-phase0-brief.md`. **Rewrite it from the
version-facts table below if a successor needs it**; scratchpad does not survive the session.

Footer chain is a single line per file, prev/next by topic:
`← Prev: [x](../NN-x/README.md) · Index: [Phase 0](../README.md) · Next → [y](../NN-y/README.md)`.
Topic 01's prev is the phase index; topic 12 has no Next (phase 1 is not written).

### 🔴 What actually happened — read before restarting

The six lanes were dispatched and **killed at the 80% usage line while all six were still
fetching from angular.dev. Not one page was written.** The topic directories exist and are
empty apart from their `_category_.json`. **Restarting is a clean re-dispatch, not a
salvage** — there is nothing on disk to QC or finish.

On `main`:

| Commit | What |
|---|---|
| `5ba27d5d` | homepage: roll-up strip and "moved most recently" row deleted |
| `8f6b95ce` | the `docs/angular/pages/` scaffold, labelled 0 of 12 |
| `15f7e5b5` | the merge of `angular-phase-0` into `main` |
| `0b5dacd4` | 🔴 the link-clean fix, made **after** the merge — read the note below |

🔴 **Why `0b5dacd4` exists, so a successor does not undo it.** The scaffold as first written
linked all twelve topics in the phase index to `README.md` files that do not exist, and gave
each of the twelve topic directories a `_category_.json` describing a category with no
documents in it. `onBrokenLinks` was `'warn'` **then**, so it would not have failed the build — it would
have quietly put twelve warnings into a repo that builds with none. ⚠️ **It is `'throw'` now:
the same scaffold written today would take the deploy down.** **The table now carries
every title, tier badge and one-line summary as plain bold text, and each row becomes a link
when its topic lands.** The twelve `_category_.json` files were removed; their labels and
positions live in [[angular-phase-0-lane-dispatch]] and get rewritten with the pages. Verified
0 dangling links under `docs/angular/pages`.

`src/data/progress.js` was deliberately **not** touched — Angular phase 0 is still
`pages: 0`, which is true, so `status.json` is not stale and `yarn status --check` passes.

### 🔴 The restart procedure — three files, six agents

1. Read **[[angular-phase-0-lane-dispatch]]** — the six-lane split, the restart recipe, and
   the dispatch spec for topics 01-06. Topics 07-12 are in
   **[[angular-phase-0-lane-dispatch-2]]**.
2. Every lane's prompt is: *"You are Lane X of six parallel lanes writing Angular Phase 0.
   FIRST read `/mnt/Storage/my-learning/claude/devbible/angular/PHASE-0-LANE-BRIEF.md` in
   full and follow it exactly — it overrides the repo path in your agent definition"*, then
   that lane's two topic sections pasted verbatim.
3. **[[angular-phase-0-lane-brief]]** carries the measured v22.1.4 version spine, the
   sources, the cap and chunking rules, the MDX hazards and the footer convention. Hand it
   over unchanged — **do not re-derive the version facts from memory.**

⚠️ **Six lanes at once is what exhausted the budget**, and they had not written a line when
the ceiling arrived — the research phase alone is expensive. A successor with a fresh
session should either run **two or three lanes** and bank each one, or run them **one at a
time**, committing per file as the cadence requires. Six parallel Master-tier lanes is not
affordable in a single session.

### Then, when pages land

1. QC per topic: `wc -l` (nothing over 300), `grep -rn '<!--'`, footer present, links resolve.
2. `src/data/progress.js` → Angular phase 0 `pages: N`, bump `updated`, then **`yarn status`**.
3. Move `pages/README.md` and the phase README off 🚧 with the real counts.
4. Build in isolation, check links, commit explicit paths.
5. Commit explicit paths on `main` — **never `git add -A`**, several sessions share it.

---

## State — syllabus CLOSED, Phase 0 SCAFFOLDED

| | |
|---|---|
| Syllabus | ✅ **Complete.** `docs/angular/README.md` + 6 parts in `docs/angular/syllabus/` |
| Scale | **16 phases · 211 topics** · 63 Master (30%) · 116 Understand · 27 Know · 5 When Needed |
| Pages | 🚧 **Phase 0 scaffolded, 0 of 12 written.** `docs/angular/pages/` scaffolded in the worktree: `_category_.json`, `README.md`, `phase-0-how-angular-runs/README.md` (12-topic table) and all twelve topic directories with their `_category_.json` |
| Wired | `sidebars.js` (`angularSidebar`) · `src/data/progress.js` · homepage card · `static/status.json` · `instructions.md` §2 row 13 |
| Merged | ✅ on **`main`**, 2026-08-31. It was built in worktree `angular-dashboard` on branch `worktree-angular-dashboard`; **both were deleted the same day** after being verified at 0 unique commits and 0 uncommitted files. Do not go looking for that directory — work in `/mnt/Storage/Backup/Knowledge/devbible` on `main` |
| Pushed | ✅ **Yes**, 2026-08-31, via **[PR #1](https://github.com/sairamg8/devbible/pull/1)** (`angular-syllabus-and-dashboard` → `main`, merge commit `9214a5ad`). The PR branch was deleted and pruned on merge |
| Deployed | ✅ **Live.** `.github/workflows/deploy.yml` fires on any push to `main`, so the merge published it: **https://sairamg8.github.io/devbible/** — run `33361900638`, green |

✅ **Phase 0 was asked for.** The working agreement
(`instructions.md` §10, [[feedback_incremental_scope]]) is *syllabus first, approved, then
notes* — the user naming phase 0 was the approval. **Phase 1 still needs to be asked for.**

## 🔴 The version facts — measured, do not re-derive from memory

All measured with `npm view` on 2026-08-31 and from the published `.d.ts` export lists of
`@angular/core@22.1.4`, `@angular/common`, `@angular/forms` and `@angular/router`. They are
already written into `docs/angular/README.md`; this is the short copy so a successor does not
re-run the commands.

| | |
|---|---|
| **Current major** | **22**, released **3 Jun 2026**. `latest` = **22.1.4** (27 Aug 2026). `next` = 22.2.0-next.4 |
| LTS lines | v21 → `21.2.22` (LTS to ~May 2027) · v20 → `20.3.30` (LTS ends ~Nov 2026) |
| Out of support | **v19** — final patch `19.2.25`, 2 Jun 2026, the day before v22 |
| Cadence | majors every 6 months (May/June + November); **6 months active + 12 months LTS**. **v23 is due ~Nov 2026** |
| CLI | `@angular/cli` 22.1.6 · `@angular/build` 22.1.6 |
| Node | CLI engines `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| **TypeScript** | **`>=6.0 <6.1`** — hard peer pin. Angular 22 does **not** run on TS 5.x |
| RxJS | peer `^6.5.3 \|\| ^7.4.0`; latest rxjs is 7.8.2. **No rxjs 8 support** |
| zone.js | peer `~0.15.0 \|\| ~0.16.0`, and optional — a zoneless app has none |
| Test runner | **`vitest@^4.0.8`** is the `@angular/build` peer. `karma@^6.4.0` still a peer, end of life |
| SSR / UI / state | `@angular/ssr` 22.1.6 · `@angular/material` & `@angular/cdk` 22.1.4 · `@ngrx/store` and `@ngrx/signals` 22.0.0 · `@analogjs/platform` 2.7.1 |
| Still published | `@angular/animations` and `@angular/platform-browser-dynamic`, both 22.1.4 |

**API facts worth not getting wrong**, all confirmed in the 22.1.4 export lists:

- `signal` `computed` `effect` `linkedSignal` `untracked` `resource` `resourceFromSnapshots`
  — plus **`debounced`**, which is new and which most write-ups do not have.
- `input` `output` `model` `viewChild` `viewChildren` `contentChild` `contentChildren`,
  and `inputBinding` / `outputBinding` / `twoWayBinding` for `createComponent`.
- **`afterRender` was renamed `afterEveryRender`.** `afterNextRender` and `afterRenderEffect`
  are unchanged.
- **`provideZonelessChangeDetection` is stable**, not experimental.
- **`@angular/forms/signals` is a real published entry point** (with `./signals/compat`):
  `form` `schema` `apply` `applyEach` `applyWhen` `validate` `validateAsync` `validateHttp`
  `validateTree` `validateStandardSchema` `required` `min` `max` `minLength` `maxLength`
  `email` `pattern` `minDate` `maxDate` `disabled` `readonly` `hidden` `submit` `metadata`
  `debounce` `Field` `FieldTree` `FieldState` `provideSignalFormsConfig`.
- `httpResource` and `HttpResourceRef` are in `@angular/common/http`.
- **New in the v22 surface and easy to miss:** `injectAsync`, the **`@Service`** decorator,
  `onIdle` / `IdleService` / `provideIdleServiceWith`, `provideBrowserGlobalErrorListeners`.
- 🔴 **Experimental — label, never teach as shippable:** `declareExperimentalWebMcpTool` /
  `provideExperimentalWebMcpTools`, `provideExperimentalWebMcpForms`, and the router's
  `withExperimentalPlatformNavigation` and `withExperimentalAutoCleanupInjectors`.

## The phase map

Phases and their topic counts, as wired into `progress.js`:

| # | Phase | Topics | Part |
|---|---|---|---|
| 0 | How Angular runs | 12 | 1 |
| 1 | Components and templates | 16 | 1 |
| 2 | **Signals — the gate phase** | 15 | 1 |
| 3 | The signal component API | 12 | 2 |
| 4 | Template syntax and control flow | 12 | 2 |
| 5 | Change detection and zoneless | 11 | 2 |
| 6 | Dependency injection | 14 | 3 |
| 7 | RxJS in Angular | 12 | 3 |
| 8 | Routing | 16 | 3 |
| 9 | HTTP and data | 12 | 4 |
| 10 | Forms, all three systems | 16 | 4 |
| 11 | Architecture, state and UI | 12 | 4 |
| 12 | SSR, hydration and the server | 13 | 5 |
| 13 | Testing | 14 | 5 |
| 14 | Performance and the build | 12 | 6 |
| 15 | Tooling, upgrades and the ecosystem | 12 | 6 |

**Phase 2 is the gate.** Inputs, queries, forms, HTTP and change detection are all signals in
v22, so a thin phase 2 resurfaces as four unrelated confusions in phases 3, 5, 9 and 10.
Write it first and write it properly.

## Running the site

Package manager is **yarn**. The dev server needs the search index files or it triggers a
full ~8GB build on start:

```bash
cp -s /mnt/Storage/Backup/Knowledge/devbible/static/search-index*.json static/
```

(only needed **if you are ever put in a worktree again** — the files are gitignored and live
only in the main checkout. On `main` itself `yarn start` just works.)

🔴 After changing `src/data/progress.js`, run **`yarn status`** — `static/status.json` is
generated from it and `yarn status --check` exits 1 when it is stale.

## Cadence

Per file, not per phase: write a chunk → update the boards → `git add` **explicit paths**
(never `git add -A`, several sessions share this checkout) → repoint this cursor.
See [[feedback_memory_update_cadence]] and [[feedback_never_compress_to_fit_cap]].

Superseded blocks from [CURSOR-ANGULAR.md](CURSOR-ANGULAR.md), verbatim, newest first. Nothing here was dropped;
it was moved so the live file stays inside its 160-line budget.

Search rather than read: `shared/scripts/recall.sh --cold <terms>`

