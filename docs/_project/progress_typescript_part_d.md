---
name: devbible-typescript-part-d
description: TypeScript lane D — phase 6 topics 07-16. COMPLETE 10/10, and phase 6 is complete 16/16. Open this on "typescript d" to confirm there is no queued work, and for the compiler findings and the one defect handed to another lane
metadata:
  type: progress
---

# TypeScript · Part D — phase 6 topics 07–16

🔴 **Claimed 2026-08-17 by session `8dcc0095`** on the user's instruction
*"pick typescript d"*. Parent cursor (all four lanes):
[[devbible-typescript-split-4way]].

:::danger Scope — nothing outside these ten topics
`docs/typescript/pages/phase-6-modules-build/` topics **07–16 only**, on
`main` in the shared checkout. ⛔ **Never touch C's topics 01–06.** The
phase `README.md` and the `phase-6-modules-build` row in
`src/data/progress.js` are **shared with lane C** — re-read both immediately
before every edit and take the higher page count if it moved.
:::

## 🔴 EXACT RESUME POINT

🏁🏁 **LANE D IS COMPLETE — 10 of 10. PHASE 6 IS COMPLETE — 16 of 16.**
**There is no queued work in this lane.** If the user says *"typescript d"*,
say it is finished and let them choose; do not invent work in topics 01–16.

| | |
|---|---|
| Lane D wrote | **topics 07–16 — 68 files, 15,449 lines** |
| Phase 6 total | **116 files, 24,910 lines** (lane C wrote 01–06) |
| Over the 300-line cap | **0** |
| Broken links | **0** — of **3,185** in the whole TypeScript corpus |
| Forward references | ✅ **all 42** stale `(not written yet)` refs in lane D's
topics repointed as their targets landed. The ones remaining are **lane C's**, in topics 01–06 |
| Uncommitted work | **none** — every chunk committed as written |

⚠️ **Verified by filesystem link-check, MDX compilation and `wc -l`, NOT by a
full build** — rule 12, no registry claim was taken at any point.

### 🔴🔴 A GAP IN THIS LANE'S VERIFICATION — read before trusting a "0 broken" claim

**The link check validates link TARGETS. It does not validate that a page
COMPILES.** A page can be link-clean, under the cap, and still unbuildable.

**It caught one of mine.** Another session's MDX sweep found 3 failing
TypeScript pages, and
`11-publishing-a-typed-package/05-export-equals-vs-default.md` was lane D's:
an inline-code span had **wrapped across a line break so a line BEGAN with
`{`**, which MDX parses as a JSX expression — *"Could not parse expression with
acorn"*. Reflowed, content unchanged; **all 70 lane D files now compile, 0
failures.**

🔴 **Add this to the per-file loop from now on** — it is seconds and it is the
difference between "link-clean" and "actually builds":

```bash
node -e "const {compile}=require('@mdx-js/mdx');const fs=require('fs');
compile(fs.readFileSync(process.argv[1],'utf8')).then(()=>console.log('PASS'))
.catch(e=>console.log('FAIL line',e.line,':',e.reason||e.message));" <file>
```

⚠️ **The two shapes that cause it, both in PROSE rather than code fences:** a
line starting with `{` (a wrapped `` `{ … }` `` inline span) and an unfenced
`<Name>` (the cause of the other two failures, both lane B's). **Never let an
inline-code span wrap at a `{` or `<`.**

### ✅ The phase-4 repoint the split brief assigned to lane D — DONE

`phase-4-classes-declarations/14-mixins/README.md`'s forward link to
**Phase 6 · `isolatedDeclarations`** was bold plain text; it now points at
`../../phase-6-modules-build/15-isolateddeclarations/README.md`.

### ⚠️ The one inaccuracy handed on, deliberately not fixed

⛔ **An earlier note here said that page cites `TS9005` "in an
`isolatedDeclarations` context". That was WRONG and is corrected** — reading
`05-the-cost-in-the-build.md` in full, it cites `TS9005` as the **sibling of
`TS4060`**, i.e. in the declaration-emit family, which is the right family.

**What is genuinely off is narrower:** `TS9005`'s sole call site is
`transformDeclarationsForJS`, so it reaches only the JavaScript path and would
**not fire for the `.ts` mixin example the page gives**. `TS4060` alone carries
that argument. **Another lane's file — flagged, not edited.** Topic 15 chunk 02
and its README state it in the corrected form.

## ✅ TOPIC 16 · Typing non-code imports — DONE 2026-08-17

**4 files / 656 lines** (233 · 190 · 208 · README 71 — measured after the final
sweep), 0 over the cap.

🔴 **Findings:** all three mechanisms are **type-level assertions about a
bundler**, so all keep type-checking after the bundler changes.
`allowArbitraryExtensions` substitutes the **extension** (`foo.css` →
`foo.d.css.ts`, narrated by **`TS6262`**; **`TS6263`** = file found, flag
missing) — **which is exactly why it cannot match a `?raw`/`?url` query
suffix**, leaving the wildcard as the only option there. **JSON widens
everything** and has **no `as const`**, so literals need a `.ts` file;
`resolveJsonModule`'s `affectsModuleResolution` makes the file a **program
input** (the real cost on large data). **`TS2732` names its flag** where the CSS
errors do not, because JSON has one right answer.

## ✅ TOPIC 15 · `isolatedDeclarations` — DONE 2026-08-17

**4 files / 729 lines** (216 · 214 · 213 · README 86), 0 over the cap.

🔴 **Findings:** category is **`Interop_Constraints`** — the description is
*"…so **other tools** can trivially generate declaration files"*, sharing its
category and its exact `affectsBuildInfo` + `affectsSemanticDiagnostics` pair
with `erasableSyntaxOnly`. **Seventeen diagnostics in three groups** —
annotation requirements **9007–9012**, inference refusals **9013–9018** +
**9038**, structural refusals **9019–9026** + **9037** + **9039** — and only the
first group has an annotation-shaped fix. **`TS9027`–`TS9036` are quick-fix
labels**, so adoption is mostly fix-all plus a diff review. 📌 **Chunk 03
refuses to overclaim:** the flag does **not** speed up a build by itself; it is
a precondition for a parallel emit toolchain, and its free benefit is stable
declarations — i.e. **topics 13 and 14's advice turned into an enforced rule**.

✅ **ALL forward references are now repointed** — a sweep over lane D's topics
07–14 turned **27** more `(not written yet)` references into real links (topics
07, 08, 09, 10) on top of the six for topic 13. 🔴 **Only 15 and 16 remain as
bold plain text, correctly.** **3,033 TypeScript links, 0 broken; 0 files over
300.** Re-run the sweep script when 15 and 16 land — it is in this session's
history and takes one command:

```
# in docs/typescript/pages/phase-6-modules-build/, for lane D dirs only,
# regex over **NN · Title** *(not written yet)* → link, but only where
# NN's directory exists on disk and is not the current topic.
```

⚠️ **`src/data/progress.js` trap hit and confirmed:** `grep -o "topics: 16,
pages: [0-9]*"` matched **another language's row first**. **Always anchor on
`slug: 'phase-6-modules-build'`** — exactly what the split memo warns about.

## ✅ TOPIC 14 · Incremental builds — DONE 2026-08-17

**4 files / 705 lines, spread 81–214, 0 over the cap, 0 broken links.**

| # | Chunk | Lines | Subject |
|---|---|---|---|
| README | 81 | index, the six behaviours settled |
| 01 | 214 | what is in a `.tsbuildinfo` — the field list from the serialiser |
| 02 | 208 | what invalidates it — the `affectsBuildInfo` filter |
| 03 | 202 | caching it in CI — keys, and the timestamp trap both ways |

### 🔴 Findings, read from the 5.9.3 serialiser

1. 🔴 **Two hashes per file:** `version` over the **text**, `signature` over the
   **emitted declaration**. The gap between them is the engine of incremental
   compilation — a body edit changes the first only, so dependents are not
   reprocessed. **File-level twin of `TS6354`.** ⇒ explicit public return types
   are a *build-time* optimisation.
2. 🔴 **`toIncrementalBuildInfoCompilerOptions` keeps only options with
   `affectsBuildInfo: true`, sorted by name.** The precise, greppable definition
   of cache invalidation — and reordering a config invalidates nothing.
3. 🔴 **`semanticDiagnosticsPerFile` / `emitDiagnosticsPerFile` are persisted** —
   errors are cached, so a run can report a diagnostic it never recomputed, and
   a stale buildinfo can report a fixed error.
4. **`latestChangedDtsFile` is composite-only** (`compilerOptions.composite ?
   oldState?.latestChangedDtsFile : undefined`) — what powers `TS6354`.
5. **`incremental`**: shortName `-i`, `defaultValueDescription` literally
   *"false unless `composite` is set"*.
6. **`tsBuildInfoFile`**: `affectsEmit` **and** `affectsBuildInfo`,
   `defaultValueDescription: ".tsbuildinfo"`.
7. **Full field list:** `fileNames` (index table) · `fileInfos`
   (`version`/`signature`/`impliedFormat`/`affectsGlobalScope`) · `options` ·
   `referencedMap` · `semanticDiagnosticsPerFile` · `emitDiagnosticsPerFile` ·
   `changeFileSet` · `affectedFilesPendingEmit` · `latestChangedDtsFile` ·
   `root`.

### 🔴 What topic 15 inherits — do NOT re-derive

- **The stable-signature argument is already made twice** — topic 13 chunk 02 at
  project granularity (`TS6354`) and topic 14 chunk 02 at file granularity.
  **Topic 15 is where it becomes a requirement**; link both rather than
  re-arguing.
- 🔴 **`TS9021` and `TS9022` are already quoted** in
  `phase-4-classes-declarations/14-mixins/05-the-cost-in-the-build.md`, which
  **forward-links to phase 6 as bold plain text — D REPOINTS IT when 15 lands.**
- ⚠️ **`TS9005`/`TS9006` are NOT `isolatedDeclarations` diagnostics** — topic 07's
  research found their sole call site is `transformDeclarationsForJS`, i.e.
  `allowJs` + `declaration`. **Phase 4's mixins page cites `TS9005` in an
  `isolatedDeclarations` context and is another lane's file — topic 15 should
  check and flag it.**
- **Un-fetched and needed:** the 5.5 release notes' `isolatedDeclarations`
  section, and the full 9xxx diagnostic range from the message table.

## ✅ TOPIC 13 · Project references and `tsc -b` — DONE 2026-08-17

**5 files / 963 lines, spread 91–228, 0 over the cap, 0 broken links.**

| # | Chunk | Lines | Subject |
|---|---|---|---|
| README | 91 | index, the seven behaviours settled |
| 01 | 223 | orchestrator vs compiler; `references`; the five flags; solution config |
| 02 | 228 | every up-to-date/out-of-date reason code; `TS6354`; `--force` as a defect marker |
| 03 | 211 | 🔴 `stopBuildOnErrors` defaults to false, and its two consumption sites |
| 04 | 210 | when a monorepo does **not** need references — the syllabus row's other half |

### 🔴 What topic 14 inherits — do NOT re-derive

Topic 13 chunk 02 owns the **up-to-date DECISION**; topic 14 owns the **file**.

- **Already argued and quoted:** `TS6350` · `6351` · `6352` · `6353` · **`6354`**
  · `6359` · `6371` · `6374` · **`6381`** · `6388`; `TS6379` (composite ⇒
  incremental); `TS6377` (buildinfo collision); the `--dry` messages 6355/6356/
  6357; and `assumeChangesOnlyAffectDirectDependencies` (*"…assume that changes
  within a file will only affect files directly depending on it"* — unsound by
  design, watch yes / CI no). **Topic 14 should link chunk 02, not restate it.**
- **Also already argued:** `--force` is a **defect marker** in CI, `--clean` is
  the real response; and CI-cache staleness (a restore writing sources older
  than outputs) is in chunk 02's "when the check is wrong".
- 🔴 **Still genuinely 14's:** what is actually *in* a `.tsbuildinfo` (file
  versions, the referenced map, options signature, emit signatures), the
  `incremental` option itself and `tsBuildInfoFile`'s default derivation, **what
  invalidates it** beyond version and timestamps — `affectsBuildInfo` options
  (topic 10 chunk 07 already owns the `skipLibCheck` case, link it) — and
  **caching it in CI**, which the syllabus row names explicitly.
- ⚠️ **Topic 10 chunk 07 already owns the `!skipLibCheck === !oldSkipLibCheck`
  rule and the one-buildinfo-path-per-option-set trap.** Link, do not restate.

### 🔴🔴 THE FIND — `stopBuildOnErrors` defaults to FALSE

Read from 5.9.3, description cross-checked in the 7.0.2 binary. The option is
*"Skip building downstream projects on error in upstream project"*,
`defaultValueDescription: false`, and it is consumed in **exactly two** places:

- **`getUpToDateStatus`** (~135637) — gates whether an upstream `Unbuildable`/
  `UpstreamBlocked` marks this project `UpstreamBlocked`.
- **`queueReferencingProjects`** (~135925) —
  `if (state.options.stopBuildOnErrors && buildResult & AnyErrors) return;`

🔴 **So by default a project whose dependency FAILED is still built** — and the
four diagnostics that imply otherwise (**TS6362 · 6363 · 6382 · 6383**) only
appear when the flag is ON. ⚠️ **The worse case:** if the dependency's `dist` is
stale but *valid*, the dependent compiles **cleanly** against old declarations,
so the log reads *"only the base package is broken"* — topic 12 chunk 05's
staleness problem meeting this default.

### Other topic-13 material banked (all 5.9.3, 6354/6388 also in 7.0.2)

- **The complete `--build` flag set**, from `optionsForBuild`: `--verbose`/`-v`,
  `--dry`/`-d`, `--force`/`-f`, `--clean`, `--stopBuildOnErrors`. **That is all
  of them.**
- **`TS6369`** *"Option '--build' must be the first command line argument."* —
  real cause: `--build` selects the `buildOpts` parser.
- **`TS6379`** *"Composite projects may not disable incremental compilation."* —
  so composite ⇒ incremental ⇒ every package writes a `.tsbuildinfo`.
- **`TS6377`** *"Cannot write file '{0}' because it will overwrite
  '.tsbuildinfo' file generated by referenced project '{1}'"* — 🔴 the compiler
  catching the exact collision topic 10 chunk 07 predicted.
- **Out-of-date reasons:** 6352 (output missing) · 6350 (output older than
  input) · 6353 (dependency out of date) · 🔴 **6381** (output generated with a
  *different TypeScript version*) · 6388 (forcibly rebuilt).
- **Up-to-date reasons:** 6351 · 6361 · 🔴 **6354** *"is up to date with `.d.ts`
  files from its dependencies"* — **the optimisation that makes references worth
  having**, and the build-time argument for annotating a public surface so
  declarations stay stable.
- **Timestamp-only updates:** 6359 · 6371 · 6374 — activity with byte-identical
  output is not a wasted rebuild.
- **`--dry` messages:** 6356 (would delete) · 6357 (would build) · 6355
  (*"Projects in this build: {0}"* — the computed order).
- **`assumeChangesOnlyAffectDirectDependencies`** — *"Have recompiles in
  `--incremental` and `--watch` assume that changes within a file will only
  affect files directly depending on it"* — unsound by design; watch yes, CI no.

### ⬜ Chunk 04 still to write — the syllabus row's actual question

*"…and **when a monorepo actually needs them**"*. Argue the negative case: a
single `tsconfig` with `include` over all packages, workspaces alone, or a
bundler-driven build often need no references at all. References earn their place
when the graph is deep enough that `TS6354` skipping matters, or when packages
have separate owners/options.

**The remaining four, in order:** 13 Project references and `tsc -b` (Know) ·
14 Incremental builds (Know) · 15 `isolatedDeclarations` (Know) · 16 Typing
non-code imports (Know). **All four are Know tier** — the lane's remaining work
is lighter than what is behind it.

## ✅ TOPIC 12 · Sharing types across a monorepo — DONE 2026-08-17

**7 files / 1,455 lines, 0 over the cap, spread 219–238, 0 broken links**
(the whole TypeScript corpus measured **0 broken of 2,895**).

| # | Chunk | Lines | Subject |
|---|---|---|---|
| README | 102 | index, the four sentences, the recommendation |
| 01 | 228 | the question, and the redirect that reveals the compiler's default |
| 02 | 238 | the built route; `composite`'s two enforced constraints; `declarationMap` |
| 03 | 223 | the source route; three ways in, one supported; `TS6059` |
| 04 | 224 | editor vs build — four causes, and the consistent/intermittent split |
| 05 | 221 | the failure catalogue in cost order |
| 06 | 219 | choosing, and a six-step migration that keeps the repo buildable |

### 🔴 What topic 13 inherits — do NOT re-derive

Topic 12 already used project references heavily and **banked most of 13's
material**. Topic 13 owns the *mechanism*; 12 owns the type-sharing consequence.

- **Already quoted and argued in topic 12:** `composite`'s record and its
  *"constraints"* wording; **`TS6304`** and **`TS6307`** with the inherited-
  `noEmit` trap; **`TS6202`** (circular) as a *design* finding with the three
  fixes; **`TS6305`** and 🔴 the point that **its absence is worse than its
  presence**; **`TS6059`** and why `rootDirs` is the wrong turn; and both
  editor-only flags. **Topic 13 should link chunk 05, not restate the
  catalogue.**
- **Still unwritten and genuinely 13's:** `tsc -b` semantics (what it does that
  `tsc -p` does not), the `references` array itself, `--build --dry`/`--force`/
  `--clean`/`--verbose`, build ordering and up-to-date checking, solution-style
  root configs (a `tsconfig.json` with only `references` and `files: []`), and
  🔴 **when a monorepo does NOT need references at all** — the syllabus row asks
  for exactly that.
- ⚠️ **`composite` implies `incremental`** — so **topic 14** inherits that, plus
  [topic 10 chunk 07]'s rule of one `.tsbuildinfo` path per option set, applied
  per package.

### Forward references outstanding across lane D

`grep -rn "not written yet" docs/typescript/pages/phase-6-modules-build/` —
topic 10 chunk 07 → **14**; topic 11 chunks 07 + README → **16**; topic 12
chunks 01/02/05/README → **13** and **14**; topic 10 chunk 01 gotcha → **13**.
🔴 **Repoint each as its target lands.**

### 🔴 The organising find — read from 5.9.3, undocumented in prose

**`disableSourceOfProjectReferenceRedirect`**'s description is *"**Disable
preferring source files instead of declaration files** when referencing composite
projects."* — so **preferring SOURCE is the DEFAULT** for project references.
A team running `tsc -b` and believing they check against `.d.ts` is wrong unless
they set that flag.

Two halves that can disagree:
- **Check** uses the source (the redirect). Same `isSourceOfProjectReferenceRedirect`
  that appears as a clause in topic 10's `skipTypeCheckingWorker` — which is why
  a referenced project's files are not checked by the consumer.
- **Emit** substitutes `outputDts` (~line 50211:
  `host.isSourceOfProjectReferenceRedirect(importedFileName) ?
  host.getRedirectFromSourceFile(importedFileName)?.outputDts : undefined`), so
  the emitted reference points at the BUILT declaration.

### Other compiler material banked for topic 12

- **`composite`**: *"Enable **constraints** that allow a TypeScript project to be
  used with project references"*, `isTSConfigOnly`, `affectsBuildInfo`. Enforced
  by **`TS6304`** *"Composite projects may not disable declaration emit."* and
  **`TS6307`** *"File '{0}' is not listed within the file list of project '{1}'.
  Projects must list all files or use an 'include' pattern."*
- **`TS6305`** *"Output file '{0}' has not been built from source file '{1}'."* —
  🔴 the staleness diagnostic, chunk 05's spine.
- **`TS6202`** *"Project references may not form a circular graph. Cycle
  detected: {0}"*; **`TS6059`** *"File '{0}' is not under 'rootDir' '{1}'."*
- **`declarationMap`**: *"Create sourcemaps for `.d.ts` files"*, default false.
- **`rootDirs`**: *"Allow multiple folders to be treated as one when resolving
  modules"* — ⚠️ **resolution, not output structure**; the common wrong turn for
  `TS6059`.
- **The two editor-only flags for chunk 04:** `disableSolutionSearching` —
  *"Opt a project out of multi-project reference checking when editing"* — and
  `disableReferencedProjectLoad` — *"Reduce the number of projects loaded
  automatically by TypeScript."* Both `isTSConfigOnly`, both default false.

### ⛔ What topic 12 must NOT restate

**[topic 03 chunk 05](../03-path-aliases/05-the-decision.md) (lane C) already
owns the alias decision** — workspaces are the answer most of the time, and
`paths`-to-another-package's-`src` means *"the boundary you created by splitting
the packages does not exist."* Link it. Topic 12 owns only the **type-sharing
consequence**. Project references themselves are **topic 13**.

⚠️ **Lane C FINISHED 6/6 on 2026-08-17**, so `phase-6-modules-build/` topics
01–06 are all written and **their forward references are now linkable**.

## ✅ TOPIC 11 · Publishing a typed package — DONE 2026-08-17

**10 files / 2,380 lines, 0 over the cap, 0 broken links** (172 links in
topics 10+11 all resolving; the whole TypeScript corpus measured **0 broken of
2,780**).

| # | Chunk | Lines | Subject |
|---|---|---|---|
| README | 108 | index, the five load-bearing quotes, the one-format decision |
| 01 | 246 | the golden rule; both masquerades; the third case that is not one |
| 02 | 238 | resolution order, extension substitution, `TS6278` vs `TS6280` |
| 03 | 270 | which conditions TS matches, `types` first, when to nest |
| 04 | 236 | dual builds; markers vs explicit extensions; the type-identity hazard |
| 05 | 237 | `export =` vs `export default`; `cjs-module-lexer` |
| 06 | 244 | `typesVersions`, and the `types@{selector}` form to prefer |
| 07 | 280 | the problem catalogue, sorted by what response it needs |
| 08 | 253 | `attw` vs `publint`, `--pack`, and wiring both into `prepublishOnly` |
| 09 | 268 | the checklist, the dependency rules, three correct shapes |

⚠️ **Rule 1 was exercised:** the validation chunk drafted at **307 lines and was
SPLIT on a concept boundary** — catalogue (280) + tooling (253). Nothing was
trimmed and **both halves grew**. ⚠️ The split left **five stale links and four
stale prose references**, all repointed; **re-grep for the old filename after
any rename.**

### 🔴 What topic 12 inherits — do not re-derive

- **Topic 11 chunk 04 already owns the dual-package hazard at the type level**
  (two builds → two type identities, nominal wherever `private`/brands leak).
- **Topic 11 chunk 02 already owns the whole resolution order** and the
  `TS6278`/`TS6280` pair. Topic 12's *source-imports vs built-`.d.ts`* question
  is the same machinery **without npm in between** — link, do not restate.
- 🔴 **Topic 10 chunk 02 already argued the monorepo case**: a package consuming
  another's built `dist/*.d.ts` is consuming a *declaration file*, so the root
  `skipLibCheck` covers it — *"which is why the editor-versus-build divergence in
  a monorepo so often turns out to be this flag."* **Topic 12 owns the general
  monorepo account; that line is already committed to.**
- **Forward references to repoint when their targets land:** topic 10 chunk 07 →
  **14 · Incremental builds**; topic 11 chunks 07 + README → **12** and
  **16 · Typing non-code imports**; topic 10 chunk 01 gotcha → **13 · Project
  references**. Sweep with
  `grep -rn "not written yet" docs/typescript/pages/phase-6-modules-build/`.

### 🔴 Sources FETCHED for topic 11 — do not re-fetch

- **Handbook *Declaration Files → Publishing*** — the `types`/`typings` fields,
  the **Dependencies** rule (`@types` go in `"dependencies"`, **not**
  `devDependencies`, so consumers get them), the **Red Flags** section
  (`/// <reference path>` ❌ → `/// <reference types>` ✅; do not bundle or copy
  a dependency's declarations), and the two `typesVersions` examples.
- **Handbook *Modules → Reference*** — the resolution order
  (`exports` → `types` → `typings` → `main`), **extension substitution**, the
  npm-TypeScript-icon reason to ship `types` anyway, *"TypeScript always matches
  the `types` and `default` conditions"*, the **`types` must be listed first**
  rule, the `types@{selector}` form, *"when the `types` condition is matched,
  TypeScript returns that path directly"* (no substitution), and 🔴 *"The mere
  presence of an `exports` field prevents resolving any subpaths not explicitly
  listed"* — i.e. adding `exports` is a breaking change.
- 🔴 **`arethetypeswrong` problem docs are fetchable via
  `raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/docs/problems/<Name>.md`**
  — the `arethetypeswrong.github.io` landing page and the `github.com/.../blob/...`
  URL both fail (404 / nav-only). **Already fetched: `FalseCJS.md`, `FalseESM.md`,
  `CJSResolvesToESM.md`, `NamedExports.md`, `FalseExportDefault.md`.**
  ⬜ **Still to fetch for chunk 07:** `NoResolution` / `UntypedResolution`,
  `InternalResolutionError`, `UnexpectedModuleSyntax`, `MissingExportEquals`,
  and **publint**'s rule list.

### 🔴 The quotes chunk 07 and 05 will need (already banked)

- **The golden rule**, verbatim: *"A golden rule of declaration files is that if
  they represent a module…they must represent **exactly** one JavaScript file."*
  and *"They **especially** cannot represent JavaScript files of two different
  module formats."*
- **FalseExportDefault:** *"The resolved types use `export default` where the
  JavaScript file appears to use `module.exports =`."* → the mapping is
  **`module.exports = x` ⇒ `export = x`**, because `export default` describes
  `module.exports.default`.
- **NamedExports:** Node uses **cjs-module-lexer**; *"This problem is only issued
  when the types contain exports not found in the JavaScript, not vice versa."*
  `module.exports = { a: 'a' }` is unanalysable, `exports.a = 'a'` is — and the
  documented hint is the never-running line `0 && (module.exports = { a });`.
- **CJSResolvesToESM** is **not** a masquerade: *"a `require` call resolved to an
  ESM JavaScript file"* with types and implementation agreeing; the cost quote is
  *"introducing asynchronicity into a large synchronous codebase can be a
  prohibitively difficult refactor and a breaking change for downstream APIs."*

### Diagnostics banked in topic 11 so far

**6270 · 6271 · 6272 · 6273 · 6274 · 6275 · 6276 · 6277 · 6278 · 6279 · 6280**
(the `exports`/`imports` resolution family, read from the 5.9.3 table), plus
**6206 · 6207 · 6208 · 6209** for `typesVersions` (chunk 06) and **1471 · 2497 ·
2846** for the ESM/CJS import forms.

## ✅ TOPIC 10 · `skipLibCheck` — DONE 2026-08-17, session `e28ddf99`

**9 files / 2,055 lines, 0 over the 300-line cap, spread 219–257, 0 broken
links in the topic** (76 links resolved against the filesystem).

| # | Chunk | Lines | Subject |
|---|---|---|---|
| README | 112 | index, the one-sentence version, the seven behaviours |
| 01 | 257 | the option record, the predicate, the **six** call sites, what stays ungated |
| 02 | 246 | it skips **your** declarations — the four populations, the library trap |
| 03 | 233 | 🔴 the `.d.ts` file-format grammar rules go quiet — undocumented |
| 04 | 234 | the seven negatives, led by assignability at your call sites |
| 05 | 254 | `skipDefaultLibCheck` + `noCheck` + redirects + the `@ts-nocheck` clause |
| 06 | 243 | who turns it on for you, and the disputed default resolved |
| 07 | 219 | the `.tsbuildinfo` interaction and the CI thrash trap |
| 08 | 257 | choosing it — the two-config split and a reviewable team rule |

⚠️ **Topic 10 was pencilled in as a small Understand row and came to 2,055
lines.** The syllabus promise (*"know exactly which errors you are agreeing
not to see"*) turned out to need the compiler read end to end. **Do not size a
lane-D topic from its tier.**

📌 **No timing figure appears anywhere in the topic**, deliberately — none was
measured, the performance framing is phase 12's, and chunk 08 says so and
points the reader at `--extendedDiagnostics` on their own repo instead.

⚠️ **Filename trap already hit and fixed** — topic 07's and 08's chunk files are
**not** named as the memory's tables abbreviate them. The real names are
`07-authoring-d-ts-files/01-what-a-declaration-file-is.md`,
`.../08-when-declaration-emit-fails.md` and
`08-typing-an-untyped-dependency/05-when-the-shipped-types-are-wrong.md`.
**`ls` the target directory before writing a cross-topic link.**

### 🔴 NEW compiler findings this session — read, not recalled, do not re-derive

All from `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js` (**5.9.3**).

1. 🔴 **`skipTypeChecking` has exactly SIX call sites** — `getProgramDiagnostics`
   (127990), `getBindAndCheckDiagnosticsForFileNoCache` (128042),
   `checkSourceFileWorker` (91348), `checkSourceFileNodesWorker` (91407),
   `getSuggestionDiagnostics` (51417), and the language service's
   `getRegionSemanticDiagnostics` (153025).
2. 🔴🔴 **THE BEST FIND — the `.d.ts` FILE-FORMAT RULES ARE SKIPPED TOO.**
   `checkSourceFileWorker` early-returns on `skipTypeChecking` **before**
   calling `checkGrammarSourceFile`. So `TS1036` (94663), `TS1038` (93565),
   `TS1039` (94397), `TS1046` (94644) and `TS1183` (94195) — every ambient-context
   rule **topic 07 chunk 01 used to define what a `.d.ts` is** — are never
   computed for a declaration file when the flag is on. **Undocumented
   anywhere.** Chunk 03 owns it.
3. ✅ **Syntactic diagnostics are UNGATED.** `getSyntacticDiagnosticsForFile`
   returns `sourceFile.parseDiagnostics` with no skip check. **So the boundary
   is parser-vs-checker, NOT "syntax vs semantics"** — `TS1046` reads like a
   syntax error and is still skipped.
4. **`getDeclarationDiagnosticsForFile` early-returns `emptyArray` for
   `isDeclarationFile`** — so the flag has nothing to do with the `TS4053`
   declaration-emit family (topic 07 chunk 08).
5. 🔴 **`tsc --init` writes `skipLibCheck: true` under the header
   `Recommended_Options`** (~line 43042, `emitOption("skipLibCheck", true)`),
   next to `strict`, `verbatimModuleSyntax`, `isolatedModules`,
   `noUncheckedSideEffectImports`, `moduleDetection: force`. The legacy
   `defaultInitCompilerOptions` (~42201) carries it too. **This is the honest
   source of "nearly everyone sets it" — the compiler recommends it in the file
   it writes for you.**
6. 🔴 **DEFAULT CONFLICT, resolved.** The TSConfig reference says *"Default:
   `true` (as of TypeScript 5.4)"*; the option record says
   `defaultValueDescription: false` and the gate is falsy when the option is
   absent. **The compiler default is `false`; what changed is the config
   `--init` generates.** ⚠️ The 5.4 release notes do **not** mention
   `skipLibCheck` at all (fetched and checked) — so state the resolution as
   *verified from the compiler, with the docs' wording described as being about
   the generated config*, and do not claim a specific PR.
7. 🔴 **`.tsbuildinfo` interaction (~130717):**
   `copyDeclarationFileDiagnostics = canCopySemanticDiagnostics &&
   !compilerOptions.skipLibCheck === !oldCompilerOptions.skipLibCheck`, and
   `copyLibFileDiagnostics` additionally requires `skipDefaultLibCheck`
   unchanged. **Flipping the flag invalidates the cached declaration-file
   diagnostics** — which is exactly what the option record's source comment
   (*"We need to store these to determine whether `lib` files need to be
   rechecked"*) and its `affectsBuildInfo` are for. Chunk 07; links to topic 14.
8. 🔴 **`skipDefaultLibCheck` keys on `sourceFile.hasNoDefaultLib`**, which is
   set from the **`/// <reference no-default-lib="true"/>` pragma** (~40428) —
   NOT by path and not by "shipped with TypeScript". Topic 07 chunk 13 already
   covered that directive; cross-link it.
9. **The TS server sets `skipLibCheck: true` on its own internal projects** —
   `AutoImportProviderProject.compilerOptionsOverrides` (~189147) and
   `getCompilerOptionsForNoDtsResolutionProject` (~188737), both alongside
   `noLib: true`, `types: []`, `lib: []`.
10. **7.0.2 binary carries TWO description strings** — *"Skip type checking all
    .d.ts files."* (the 5.9.3 option-record string) **and** *"Skip type checking
    of declaration files."* Do not treat either as the sole wording.
11. **`TS6160`** *"[Deprecated] Use '--skipLibCheck' instead. Skip type checking
    of default library declaration files."* — confirmed in **both** builds.

### 🔴 What topic 11 inherits from topic 10 — do not re-derive

- **The two-config split is already fully argued** (chunks 02 and 08) and
  already carries its `tsBuildInfoFile` requirement (chunk 07). Topic 11 should
  **link it, not restate it**, and own the part topic 10 explicitly deferred:
  ✅ **checking your declarations is not the same as testing that consumers can
  RESOLVE them** — `arethetypeswrong` and `publint`, still un-fetched.
- Topic 10 chunk 08 already gives the `include: ["dist/**/*.d.ts"]` +
  `types: []` minimal checking project as a *rough* consumer simulation and
  says plainly it is not a substitute. Topic 11 is where the real thing goes.
- ⚠️ Topic 10 forward-links to topic 11 twice (chunks 02 and 08) and to
  **14 · Incremental builds** once (chunk 07), all as **bold plain text with
  *(not written yet)***. 🔴 **Repoint them when those topics land.**

### Sources fetched for topic 10 — do not re-fetch

**TSConfig reference `#skipLibCheck`** (quoted verbatim: the two-copies-of-a-
library paragraph, *"this is a symptom of a problem in your repository which is
better solved by fixing your dependencies"*, and the `skipDefaultLibCheck`
entry — *"only relevant when using `skipLibCheck` is not set"*, released 2.0).
**TypeScript 5.4 release notes** — checked, no mention of `skipLibCheck`.

## ⏸ Earlier pause — 2026-08-17, session `8dcc0095`

On the user's word at ~95% usage (*"We are reached 95% above please save
session progress and enough"*), **not blocked**. Stopped clean at 3 of 10
topics, 25 files, 5,851 lines, 0 over cap, 0 broken links, nothing
half-written. ⚠️ Verified by filesystem link-check and `wc -l`, **not** by a
build — rule 12, no registry claim was taken.

## 🔴 TOPIC 10 RESEARCH from session `8dcc0095` — still valid

The next session starts writing, not reading. Everything below is read from
`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js` (**5.9.3**).

### The option records

| Option | Description (verbatim) | Default | Flags on the record |
|---|---|---|---|
| `skipLibCheck` | *"Skip type checking all `.d.ts` files."* | `false` | `affectsBuildInfo` only, category **`Completeness`** |
| `skipDefaultLibCheck` | *"Skip type checking `.d.ts` files that are included with TypeScript."* | `false` | `affectsBuildInfo` only, category **`Completeness`** |

🔴 **Filed under `Completeness`, not under any suppression category** — which is
independent corroboration of the line
`phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md`
already took. Use it.

### 🔴 The actual gate (~line 22820) — the best find for this topic

```js
return options.skipLibCheck && sourceFile.isDeclarationFile
  || options.skipDefaultLibCheck && sourceFile.hasNoDefaultLib
  || !ignoreNoCheck && options.noCheck
  || host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)
  || !canIncludeBindAndCheckDiagnostics(sourceFile, options);
```

Two things follow, and neither is documented:

1. **The test is `sourceFile.isDeclarationFile` — nothing about `node_modules`.**
   So `skipLibCheck` skips **every** declaration file in the program, *including
   the `.d.ts` files you wrote by hand and the ones your own build emits.* That
   is the sharpest form of the library-author warning phase 7 already makes.
2. **It sits in the same predicate as `noCheck` and project-reference
   redirects** — i.e. the compiler treats "skip lib check" as a member of the
   *do not check this file at all* family, not as a diagnostic filter.

### Two more

- 🔴 **`jsconfig.json` implicitly sets it.** ~line 43691: a config file named
  `jsconfig.json` gets `{ allowJs: true, maxNodeModuleJsDepth: 2,
  allowSyntheticDefaultImports: true, skipLibCheck: true, noEmit: true }`. Worth
  a callout — a JS project has it on and nobody chose it.
- **`--skipDefaultLibCheck` is deprecated on the CLI:** `TS6160` *"[Deprecated]
  Use '--skipLibCheck' instead. Skip type checking of default library
  declaration files."*

### ⛔ What topic 10 must NOT restate

- The **correctness trade and the application-vs-library rule** are written in
  `phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md`
  (*"the pragmatic lie everyone tells"*, and `TS6278` for a dependency's broken
  `exports` map). **Link it.**
- The **performance framing belongs to phase 12 (lane B).** Do not write it.
- **`skipLibCheck` is not a suppression mechanism** — settled in phase 10's
  suppression-tier page. Topic 08 chunk 05 and topic 09 already committed this
  lane to the precise line: **it helps when *their* `.d.ts` fails to compile
  internally, and does nothing when their types are wrong *about* the API.**

**So topic 10's own contribution is:** the gate above (it skips *your* `.d.ts`
too), the `Completeness` framing, the `jsconfig.json` default, the
`skipDefaultLibCheck` distinction, and *"exactly which errors you are agreeing
not to see"* — which is the syllabus row's actual promise.

🔴 **Topic 10 has TWO inherited debts — read both before writing:**
`phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md`
owns the *correctness* trade and **phase 12 (lane B) owns the *performance*
framing**; and
`phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md`
already settles that **`skipLibCheck` is NOT a suppression mechanism**. Topic
08 chunk 05 and topic 09 already committed this lane to the line: **it helps
when *their* `.d.ts` fails to compile internally, and does nothing when their
types are wrong *about* the API.** Topic 10 must be consistent with that.

## ✅ Topic 09 · `esModuleInterop` and default imports — DONE 2026-08-17

**5 chunks / 1,251 lines, 0 over the cap, 0 broken links.**
01 What a default import means (227) · 02 The two flags (233) · 03 The emit
(232) · 04 The errors (224) · 05 Choosing and migrating (242) · README (93).

### 🔴 Four more compiler behaviours read, not recalled

1. **The two flags differ by exactly one option-record line.**
   `allowSyntheticDefaultImports` has `affectsSemanticDiagnostics`;
   `esModuleInterop` **also has `affectsEmit`** (and `affectsBuildInfo`). One is
   a permission, the other is behaviour — which is precisely why the first
   yields green-build-`undefined`.
2. **Computed defaults, from `_computedOptions`:** `esModuleInterop` → **true**
   for `module` Node16/Node18/Node20/NodeNext/**Preserve**, else false, explicit
   always wins (its *static* `defaultValueDescription` of `false` is misleading).
   `allowSyntheticDefaultImports` → `esModuleInterop || module === System ||
   moduleResolution === Bundler`.
3. **`TS1259`'s flag name is chosen by module kind** —
   `moduleKind >= ES2015 ? "allowSyntheticDefaultImports" : "esModuleInterop"`.
   The root of the ecosystem's contradictory advice.
4. **The helper bodies, quoted verbatim from the compiler's helper table**
   (`importDefaultHelper` / `importStarHelper`, ~line 30455). `__importDefault`
   is `return (mod && mod.__esModule) ? mod : { "default": mod };`.
   `__importStar` **constructs a new object and `__createBinding`s every own key
   except `default`** unless `__esModule` is present — so a CJS namespace import
   is *not* `module.exports`, identity comparison fails, the loop runs per import
   per file, and getters survive because it binds rather than assigns.

**Also established:** the flag **forbids as well as allows** — `import * as x
from 'cjs'; x()` becomes `TS2497` once namespace imports are modelled as real
module namespace objects. Only *called or constructed* namespace imports need
converting in a migration.

### Diagnostics banked in topic 09

**1192 · 1259 · 2497 · 2595 · 2596 · 2598 · 2613 · 2617.**

### Sources for topic 09 — do not re-fetch

Option records for **`esModuleInterop`**, **`allowSyntheticDefaultImports`**,
**`importHelpers`**; the **computed-option table**; the **helper table**. All
reads of `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`.

⚠️ **The lane's ~5,250-line projection is already wrong.** Two topics have
produced 4,600 lines because both had far more in them than the per-tier
average predicted. **Track this lane by topic count, not lines**, and do not
let the projection become a content budget — that is exactly rule 1's failure
mode.

📌 **Cadence tightened to PER FILE on 2026-08-17** on the user's instruction
(*"We are nearing 80% of usage so make sure you switch saving progress to per
file"*). Write a chunk → commit it → move on; boards and memory at the topic
close.

## ✅ Topic 08 · Typing an untyped dependency — DONE 2026-08-17

**6 chunks / 1,682 lines, 0 over the cap, spread 102–298.**

| Chunk | Lines | Subject |
|---|---|---|
| README | 102 | index, the end-to-end decision tree, the three compiler behaviours |
| 01 Reading the symptom | 267 | TS2307 vs TS7016 vs TS2688 vs TS2792; the 7xxx family; TS6137 |
| 02 Look for types first | 249 | ships-its-own vs `@types`; scoped mangling; `types`/`typeRoots` |
| 03 The shim | 298 | `declare module`; the script-file and inclusion conditions; wildcards |
| 04 Growing and containing it | 267 | `any` → `unknown` → real; the wrapper module; why the alternatives leave no artefact |
| 05 When shipped types are wrong | 287 | four causes to rule out; augment / `paths` / assert; the `skipLibCheck` line |
| 06 The upstream fix | 212 | DefinitelyTyped vs the package; allowJs+JSDoc+declaration as the maintainer pitch |

### 🔴 Three more compiler behaviours read, not recalled

1. **`TS7016` is suppressed when `allowJs` is on OR `noImplicitAny` is off** —
   literally `getAllowJSCompilerOption(options) || !getStrictOptionValue(options,
   "noImplicitAny") ? void 0 : …` (~line 129938). So enabling `allowJs` silences
   untyped-module errors, and a project reporting none may simply have turned the
   question off. Related: **`maxNodeModuleJsDepth` defaults to `0`** and is
   *"Only applicable with `allowJs`"*.
2. **Scoped `@types` mangling is exact** — `mangledScopedPackageSeparator = "__"`,
   the leading `@` dropped, so `@babel/core` → `@types/babel__core`. The compiler
   announces it under `--traceResolution` as **TS6182** *"Scoped package detected,
   looking in '{0}'"*.
3. **`compilerOptions.types` REPLACES default inclusion**, and the checker reveals
   whether it is set: `getCannotFindNameDiagnosticForName` holds a hardcoded
   name→suggestion table (`document`/`console` → lib dom · `$` → jquery ·
   `describe`/`suite`/`it`/`test` → jest or mocha · `process`/`require`/`Buffer`/
   `module` → node · `Bun` → bun · `Map`/`Promise`/`BigInt`/… → change `lib`) and
   picks **TS2591 over TS2580** (and 2592/2581, 2582) on `compilerOptions.types`.

### Two boundaries this topic drew, for later topics to honour

- **`skipLibCheck` helps when *their* `.d.ts` fails to compile internally, and
  does nothing when their types are wrong *about* the API.** Topic 10 owns the
  full account; this is the line topic 08 already committed to.
- **A shim must be a SCRIPT file; an augmentation must be a MODULE file.** Same
  `declare module 'x'` syntax, opposite requirement — the asymmetry behind most
  `TS2664`, and the reason both its and `TS2665`'s messages say "augmentation" to
  people who were not augmenting.

### Diagnostics banked in topic 08

**2307 · 2305 · 2551 · 2571 · 2580 · 2581 · 2582 · 2591 · 2592 · 2613 · 2614 ·
2664 · 2665 · 2688 · 2724 · 2739 · 2792 · 6137 · 6182 · 7005 · 7006 · 7009 ·
7016 · 7034 · 7043.**

### Sources fetched for topic 08 — do not re-fetch

Handbook *Declaration Files → Find and Install Declaration Files* (consumption),
quoted verbatim. Option records for **`types`**, **`typeRoots`**,
**`maxNodeModuleJsDepth`**. Still un-fetched: *Library Structures*, *Publishing*
(topic 11), `arethetypeswrong` / `publint` (topic 11).

## ✅ Topic 07 · Authoring `.d.ts` files — DONE 2026-08-17 (`24500574`)

**13 chunks / 2,918 lines, 0 over the 300-line cap, spread 171–284.**
Drafted flat and **split five times on concept boundaries, never trimmed** —
the first draft had files at 307, 356, 382, 315, 315, 326 and 312.

| Chunk | Lines | Subject |
|---|---|---|
| README | 105 | index, one-sentence version, the "deliberately not covered" boundary list |
| 01 What a `.d.ts` is | 192 | ambient context; TS1183/1039/1036/1040/1038/1046 as the file format's definition |
| 02 The declaration forms | 204 | the handbook lookup table; `declare class` vs `declare const`+interface; why not `enum` |
| 03 The three spaces | 248 | Deep Dive's type/value/namespace table and conflict rule; the three merges |
| 04 Generated or hand-written | 284 | `declaration` + 4 companions; the 4 cases for hand-writing; `.d.ts` as the API diff |
| 05 Module or global | 213 | the top-level import/export rule; both failure modes; `export {}`; TS2669/TS2306 |
| 06 The export forms | 236 | named · `export =` · `export default` · `export as namespace`; TS2309/1203/1319/2497/2686 |
| 07 `declare module` | 201 | declaring vs augmenting; TS2664/TS2665; the where-it-must-live table |
| 08 When emit fails | 175 | Group A "private name" (4053-family), Group B "cannot be named" (TS2742) |
| 09 The rarer emit failures | 224 | TS5088/2527/7056/4118/4094, TS6232/6233, TS9005/9006; the `any` shortcut |
| 10 Designing the surface | 191 | Do's and Don'ts: boxed types, unused generics, `any`, callbacks |
| 11 Overloads and naming | 216 | ordering as a **resolution** rule; collapse to optional/union only when return type is constant |
| 12 `@internal`/`stripInternal` | 171 | the unchecked-redaction warning; api-extractor; runtime unchanged |
| 13 Triple-slash references | 222 | placement rule, `types`/`path`/`lib`/`no-default-lib`, the 5.5 `preserve="true"` change |

### 🔴 Three findings read from the compiler — do not re-derive

1. **`declaration`'s own option record gives its default as
   `false unless composite is set`** (short name `-d`). And
   `verifyCompilerOptions` raises **TS5069** — *"Option '{0}' cannot be
   specified without specifying option '{1}' or option '{2}'"* — for
   `declarationMap`, `declarationDir` **and** `emitDeclarationOnly`, each
   requiring `declaration` **or `composite`**. Plus **TS5053** for
   `declarationDir` with `outFile`.
2. 🔴 **`TS9005`/`TS9006` come from the JavaScript declaration path only.**
   Their sole call site in the installed 5.9.3 build is
   `transformDeclarationsForJS` (~line 118683 of
   `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`). So seeing
   them means `allowJs` + `declaration`, and the fix is a JSDoc annotation.
   Both strings confirmed verbatim in the 7.0.2 native binary too.
   ⚠️ Phase 4's mixins page cites `TS9005` in an `isolatedDeclarations`
   context — that page is another lane's and was left alone; **topic 15
   should check it** when it lands.
3. 🔴 **`stripInternal` detects `@internal` by a raw substring test.**
   `hasInternalAnnotation` is literally
   `comment.includes("@internal")` over the declaration's *leading comment
   ranges* — **any** comment, not only JSDoc. So `// @internal` works, and a
   comment merely *mentioning* the word silently strips the declaration.
   Parameters use *trailing* ranges after the previous parameter, which is
   what makes `/** @internal */` inline in a parameter list work.

### Diagnostics banked (all read from the 5.9.3 message table)

Ambient context: **1036 · 1038 · 1039 · 1040 · 1046 · 1183**.
Module/global: **2306 · 2669 · 2686**. Export forms: **1203 · 1319 · 2309 ·
2497**. `declare module`: **2664 · 2665**. Spaces: **2503 · 2749 · 2300**.
Declaration emit: **2527 · 2742 · 4020 · 4023 · 4025 · 4053 · 4060 · 4081 ·
4094 · 4118 · 5088 · 6232 · 6233 · 7056 · 9005 · 9006**. Options: **5052 ·
5053 · 5069 · 5096**. References: **1084**.

### Sources already fetched — do not re-fetch

Handbook *Declaration Files*: Introduction, **Declaration Reference
(by-example)**, **Do's and Don'ts** (every ❌/✅ pair quoted), **Deep Dive**,
**Templates → module.d.ts**. Handbook *Modules* (the module-vs-script
paragraph). *Triple-Slash Directives* (full). TSConfig reference:
**`declaration`**, **`stripInternal`**.

**Still un-fetched and likely needed next:** *Library Structures*,
*Publishing*, *Consumption* (topics 08 and 11), and the `arethetypeswrong` /
`publint` docs (topic 11).

## Conventions this lane follows

- 🔴 **300 lines is a file-size cap, never a content budget.** Write it all,
  then split on a concept boundary. Every chunk carries its own tier badge,
  `> Verified:` line, **Gotchas** (symptom → cause → fix) and **Interview
  questions** — with **no quota on either**; topic 07's chunks run 4–11
  gotchas and 4–9 questions depending on what the chunk actually has.
- 🔴 **No sandbox, no console blocks.** Validate against the handbook, the
  TSConfig reference and the release notes; read the compiler's own option
  records, diagnostic table and emitter source rather than recalling.
- ⛔ **Cross-lane links are bold plain text with *(not written yet)***.
- **Cadence: per file → boards → commit → memory.** Run to completion.

## Verify without a build

Rule 12: no `yarn build` without claiming
`shared/session_build_devserver_registry.md`. The filesystem link check in
[[devbible-typescript-split-4way]] is what this lane uses.

**State at the topic-07 close:** 1,780 TypeScript links, **23 broken — all
in lanes B and C's live mid-write directories** (`phase-10-strictness/
10-the-error-codes/` and `phase-6-modules-build/01-module-and-
moduleresolution/`). **0 in `07-authoring-d-ts-files/`, 0 files over 300.**
⚠️ Attribute a break by path prefix before investigating it.

## Traps met in this lane

- ⚠️ **Lane C scaffolded the phase README at the same minute I did**, and
  their version stands (it carries the full 16-row table, which is the
  agreed protocol). **Edit only row 07–16 rows from now on**, re-reading the
  file first.
- ⚠️ **Another session had `git add`-ed my in-progress files** — renames
  showed up as `D`/`R` against the index. Harmless; stage explicit paths and
  commit.
- ⚠️ **`docs/README.md`'s TypeScript technology row moved between my read
  and my write** (91 → had to re-read). **Re-read it immediately before
  every edit** and merge onto whatever is there.
- ⚠️ **`git commit` needs `GIT_AUTHOR_*` / `GIT_COMMITTER_*`** — there is no
  readable `user.*` config. Use `git commit -F -` with a quoted heredoc.

Related: [[devbible-typescript-split-4way]] ·
[[devbible-typescript-build-progress]] · [[devbible-typescript-part-b]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-no-new-sandbox-scripts]]
