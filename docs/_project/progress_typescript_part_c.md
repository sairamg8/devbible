---
name: devbible-typescript-part-c
description: TypeScript lane C — phase 6 topics 01–06, the module system. COMPLETE 6/6. What was written, and every compiler find worth reusing
metadata:
  type: progress
---

# TypeScript · Lane C — phase 6 topics 01–06

✅🔴 **LANE C IS COMPLETE — 6 of 6 topics, 2026-08-17.** Finished by session
`f4392a13`, which took the lane over from `5ff47a9c` (paused clean at 3/6 on the
user's word). **49 files, 10,040 lines, 0 over the 300-line cap, spread 77–298.**
2,780 links across `docs/typescript` resolve, 0 broken. All four boards closed.

🔴 **There is no queued lane-C work.** If a session is told *"typescript c"*, say
the lane is done and let the user pick — do not invent work in phases 01–06.
Lane **D** (topics 07–16, session `8dcc0095`) is still live in the same directory.

:::danger Scope — still applies to anyone touching this directory
`docs/typescript/pages/phase-6-modules-build/` topics **01–06** were lane C's.
Topics **07–16** are lane D's. This is devbible's only intra-phase split, so
re-read `README.md` and the `phase-6-modules-build` row in `src/data/progress.js`
immediately before every edit.
:::

## What was written

| Topic | Tier | Files | Lines |
|---|---|---|---|
| 01 `module` and `moduleResolution` | Master | 12 | 2,904 |
| 02 `import type` / `verbatimModuleSyntax` | Master | 7 | 1,540 |
| 03 Path aliases — `paths` | Master | 6 | 1,246 |
| 04 `lib`, `target` and the ambient environment | Understand | 9 | 2,112 |
| 05 `isolatedModules` | Understand | 6 | 1,288 |
| 06 File extensions | Understand | 5 | 950 |
| **Total** | | **49** | **10,040** |

⚠️ **Rule 1 evidence, worth citing if the cap is ever questioned:** topic 01
**split three times mid-write** (at 311, 324 and 348 lines), going 7 → 8 → 10 →
11 chunks, and topic 04 chunk 05 **drafted flat at 317 and was split** into 05 +
06 (`lib` side / `types` side) — **317 → 271 + 244, both halves grew.** Nothing
was ever trimmed to fit. The lane-wide spread is **77–298**, not a band under the
cap.

🔴 **Boundaries held, and they are the reason nothing was written twice:**
format detection stayed **topic 01 chunk 09**; `verbatimModuleSyntax`'s elision,
the CommonJS caveat and adoption stayed **topic 02**;
`allowImportingTsExtensions` / `rewriteRelativeImportExtensions` in depth stayed
**phase 7 chunk 01**; authoring `.d.ts` stayed **lane D topic 07**;
`allowArbitraryExtensions` and JSON stayed **lane D topic 16** (linked as plain
text, not written yet).

### Topic 06 · File extensions (Understand) — ✅ 5 files, 950 lines

README 88 · 01 The extension table 202 · 02 How the compiler picks a file 217 ·
03 The extension you type in an import 209 · 04 Choosing 234.

🔴 **Topic 06's finds, all read from 5.9.3's own arrays:**

1. 🔴 **`allSupportedExtensions` is NESTED and both levels are load-bearing:**
   `[[".ts",".tsx",".d.ts",".js",".jsx"], [".cts",".d.cts",".cjs"], [".mts",".d.mts",".mjs"]]`.
   Outer = the three **format families**; inner = **resolution priority**, first
   match wins. So a source file always beats its own build output, and **a
   `.d.ts` beating a `.js` is the entire `@types` mechanism in one line of an
   array**.
2. 🔴 **`extensionsNotSupportingExtensionlessResolution = [".mts",".d.mts",".mjs",".cts",".d.cts",".cjs"]`**
   — `import "./util"` can **never** find `util.mts`. Excluded, not discouraged.
   That is why a `.ts` → `.mts` rename breaks imports that never named an
   extension, and it is consistent with Node requiring explicit ESM extensions.
3. **`getOutputExtension`:** `.mts`/`.mjs` → `.mjs`; `.cts`/`.cjs` → `.cjs`;
   `.json` → `.json`; **`.tsx` → `.jsx` ONLY under `jsx: preserve`**; everything
   else → `.js`. **`getDeclarationEmitExtensionForPath`:** `.mts`/`.mjs` →
   `.d.mts`; `.cts`/`.cjs` → `.d.cts`; `.json` → `.d.json.ts` (with a source
   comment calling it a *"drive-by redefinition … so if it's ever enabled, it
   behaves well"*); else `.d.ts`.
4. 🔴 **`TS5096` differs between the corpus's two compilers** — 5.9.3: *"…either
   'noEmit' or 'emitDeclarationOnly' is set."*; **7.0.2: *"…one of 'noEmit',
   'emitDeclarationOnly', or 'rewriteRelativeImportExtensions' is set."*** Read
   from the 7.0.2 binary's string table. (Phase 7 chunk 01 already had this
   table; topic 06 states it and links.)
5. **`Extension` enum has thirteen members**; `supportedTSExtensions` excludes
   the JS ones, so **`allowJs` swaps the candidate list entirely** — a *different*
   failure from `TS7016` (resolution vs checking).
6. **`supportedDeclarationExtensions` vs `supportedTSImplementationExtensions`**
   is the split behind **`TS2846`**, whose `{0}` is filled with the
   implementation file it found.
7. **`TS2834` vs `TS2835`** are a pair — 2835 names the specifier it worked out,
   2834 could not resolve the target at all.
8. **`<T,>`'s trailing comma is a parser hint**, not a style convention; in
   `.tsx` the angle-bracket assertion is gone entirely.

### Topic 01 · `module` and `moduleResolution` (Master) — ✅ 11 chunks + README

| Chunk | Lines | State |
|---|---|---|
| README | 91 | ✅ |
| 01 The two questions | 258 | ✅ |
| 02 Every `module` value | 251 | ✅ |
| 03 `preserve` and the Node family | 242 | ✅ |
| 04 The two that cannot (`classic`, `node10`) | 228 | ✅ |
| 05 The Node resolver (`node16`/`nodenext`) | 212 | ✅ |
| 06 The bundler resolver | 285 | ✅ |
| 07 The defaults you did not set | 251 | ✅ |
| 08 Implied, enforced, and incompatible | 284 | ✅ |
| 09 Format detection, file by file | 293 | ✅ |
| 10 When the model is wrong | 235 | ✅ |
| 11 Choosing, and migrating | 273 | ✅ |

**Final spread: 92–293 across twelve files, 2,904 lines.** Not a band under the
cap — that is the rule-1 evidence to cite if asked.

⚠️ **The chunk count grew from 7 → 8 → 10 → 11 by splitting THREE times, at 311,
324 and 348 lines.** Nothing was trimmed either time. Both splits landed on real concept
boundaries (the granularity ladder; can-read-`package.json` vs cannot), and both
halves gained material in the split. This is rule 1 working as intended — record
it, because the failure mode is planning to a length instead.

### Topic 02 · `import type` / `verbatimModuleSyntax` (Master) — ✅ 6 chunks + README

| Chunk | Lines |
|---|---|
| README 80 · 01 Import elision 234 · 02 The `type` modifier 246 | |
| 03 `verbatimModuleSyntax` 248 · 04 Re-exports 248 | |
| 05 The CommonJS caveat 263 · 06 Adopting it 221 | |

🔴 **Topic 02's own finds, all from the 5.9.3 table:**

- **`TS5105`** — `verbatimModuleSyntax` **cannot** be used with `module` UMD/AMD/
  System, and it is a coherent consequence: those formats have no verbatim form
  of an ES import. Read backwards it is a signal the `module` value is wrong.
- 🔴 **`TS1484` vs `TS1485`** — *is a type* vs *resolves to a type-only
  declaration*. The second's fix is often **upstream** (a barrel marked a value
  `export type`), not in the file reporting it. This distinction recurs across
  **ten** re-export diagnostics: `TS1289`/`TS1290`/`TS1291`/`TS1292`/`TS1448` and
  `TS1282`–`TS1285`, each naming a *different* edit.
- ⚠️ **Those messages take the FLAG NAME as `{1}`** — the same text serves
  `verbatimModuleSyntax` and `isolatedModules`. Easy to read past.
- **`TS1286` vs `TS1295`** — same condition, but 1295 attaches advice and names
  `package.json`'s `"type"` field **first**, before the three TS settings.
- 🔴 **A genuine unresolvable tension:** in a CommonJS file `verbatimModuleSyntax`
  *requires* `import x = require()` and `erasableSyntaxOnly` (5.8) *forbids* it.
  No config satisfies both — the file has to become ESM.
- **`importsNotUsedAsValues` and `preserveValueImports` are both
  `category: Backwards_Compatibility`** — the compiler's own verdict.
- **The library rationale is different from the app rationale** and using the
  wrong one loses the argument: for a library it is about imports whose meaning
  depends on the **consumer's** `esModuleInterop`, not about elision.
- 📌 **Already fetched for topic 02:** the **5.0 release notes**
  `--verbatimModuleSyntax` section in full (elision, the `export { Car }`
  undecidability, all rewrite examples, the CommonJS caveat with its
  input/output pairs, the deprecations).

### Topic 03 · Path aliases (Master) — ✅ 5 chunks + README

README 77 · 01 What `paths` does 245 · 02 `baseUrl` 219 · 03 Closing the gap 235 ·
04 Subpath imports 255 · 05 The decision 215.

🔴 **Topic 03's finds:**

- **The handbook's own crash example is quotable verbatim**, alias name and all:
  `"node-has-no-idea-what-this-is": ["./oops.ts"]` with the comments
  `// TypeScript: ✅` / `// Node.js: 💥`.
- 🔴 **The distinction the topic is built on:** aliasing where the runtime
  **already resolves the specifier** (a `.d.ts` inside `node_modules`) is a *type
  fix* and is safe — `TS2792` suggests it. Aliasing `@app/db` is a latent runtime
  bug wearing the same syntax.
- 🔴 **`baseUrl` outranks `node_modules`** — *"`baseUrl` has a higher precedence
  than `node_modules` package lookups"* — so a `src/utils/` directory shadows the
  `utils` package silently. And `baseUrl` has the identical runtime problem as
  `paths` while attracting none of the suspicion.
- **`paths` has not needed `baseUrl` since 4.1**; without it, values resolve
  relative to the `tsconfig.json` that declares them. `TS5090` is exactly the
  half-migrated state. ⚠️ `TS6167` (the option's own help) still says *"relative
  to the 'baseUrl'"* and predates the change.
- 🔴 **`"imports"` needs an explicit `rootDir`** — the map points at `dist/`
  because Node reads it at runtime, so the compiler must walk **backwards**
  through `outDir`/`rootDir` to the input file. Without it the current build
  depends on the **previous** build's output: edits have no effect and deleting
  `dist/` breaks the build.
- **`rewriteRelativeImportExtensions` does NOT help with aliases** — its own
  message says *relative* import paths.
- 📌 **Already fetched for topic 03:** handbook *Modules — Reference*, the
  `paths` and `baseUrl` sections in full.

### Topic 05 · `isolatedModules` (Understand) — ✅ 6 files, 1,288 lines, spread 95–284

README 95 · 01 The one-file compiler 209 · 02 Every rule it enforces 284 ·
03 `const enum` under the flag 269 · 04 And `verbatimModuleSyntax` 220 ·
05 Adopting it 211. **0 over the cap, no split needed.**

🔴 **Topic 05's finds — all located by grepping every `getIsolatedModules()`
site in the 5.9.3 checker, none recalled:**

1. 🔴 **The flag has TEN diagnostics and they are one idea** — *"would a
   transpiler have to open another file to emit this line?"*: **TS1205** (re-export
   a type) · **TS1448** (re-export of a type-only import — *the fix is usually
   UPSTREAM*, the same pair topic 02 draws) · **TS1289/1290/1291/1292** (four
   variants differing only by the edit each recommends) · **TS1269**
   (`export import` on a type) · **TS2748** (ambient `const enum`) · **TS18055**
   (non-literal string enum member) · **TS18056** (member after a non-literal
   number) · **TS1280** (namespace in a global script file — the message itself
   suggests `moduleDetection: force`) · **TS1272** (decorator metadata) ·
   **TS2865/TS2866** (an import shadowing a local/global value).
2. 🔴 **TS18055's phrase *"syntactically recognizable"* is the flag's whole
   standard**, stated in one word by the compiler: what the checker knows and what
   the text says must agree.
3. 🔴 **The checker's variable for TS2865's condition is literally named
   `appearsValueyToTranspiler`** — the plainest possible evidence that the
   compiler is modelling what a *different tool* would conclude.
4. 🔴 **Three implication chains, all COMPUTED and none written in any config:**
   - `isolatedModules` = **`isolatedModules || verbatimModuleSyntax`**. So a
     project naming neither still enforces every rule if it set the second.
   - `preserveConstEnums` = **`preserveConstEnums || isolatedModules`** (via
     `shouldPreserveConstEnums = _computedOptions.preserveConstEnums.computeValue`).
     So the flag **emits the enum object** and removes the only reason to write
     `const enum`. Emit gate: `!isEnumConst(node) || shouldPreserveConstEnums(options)`.
   - `ts.transpileModule` **forces the flag on** — `transpileOptionValue: true` in
     its option record, applied in `transpileWorker`. And
     `optionsRedundantWithVerbatimModuleSyntax` contains **exactly one name**,
     `"isolatedModules"`.
5. **The ambient `const enum` (TS2748) cannot be rescued by `preserveConstEnums`**
   — a `.d.ts` emits nothing to preserve, so inlining is the only mechanism and it
   is the one a transpiler lacks. This is the flag's only behavioural cost.
6. **`erasableSyntaxOnly` (5.8) bans enums outright** — `checkEnumDeclarationWorker`
   raises **TS1294** on every non-ambient enum, `const` or not; the same check sits
   on `checkImportEqualsDeclaration`, namespaces and parameter properties. Gives a
   strict containment order: `isolatedModules` ⊂ `verbatimModuleSyntax` ⊂
   `erasableSyntaxOnly`.
7. **`isolatedModulesLikeFlagName = verbatimModuleSyntax ? "verbatimModuleSyntax"
   : "isolatedModules"`** (two sites) — the two flags share their diagnostic
   *strings*. ⚠️ Never search for a fix by the flag name in the message; search by
   the code.
8. **The option records differ by exactly the rows that matter:**
   `verbatimModuleSyntax` has `affectsEmit` + `affectsSemanticDiagnostics` +
   `affectsBuildInfo`; `isolatedModules` has **none of them** and has
   `transpileOptionValue` instead. One restricts input, the other also changes
   output.
9. **TS5047** — the flag needs `--module` or `target` ≥ ES2015.
10. 🔴 **`generateTSConfig` (the function behind `tsc --init`) writes, live and
    uncommented, under a header called "Recommended Options":** `strict`,
    `jsx: react-jsx`, `verbatimModuleSyntax`, `isolatedModules`,
    `noUncheckedSideEffectImports`, `moduleDetection: force`, `skipLibCheck` —
    with `module: nodenext`, `target: esnext` and **`"types": []`** above.
    ⚠️ That last one independently endorses topic 04 chunk 06's `types` argument.
11. **`importsNotUsedAsValues` and `preserveValueImports` are both
    `category: Backwards_Compatibility`** — already banked by topic 02, reused here.

⚠️ **Boundary kept:** topic 05 claims only the *relationship* to
`verbatimModuleSyntax`; topic 02 owns elision, the CommonJS caveat and adoption.

## 🔴 Finds worth reusing — topic 01

All read out of `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`
(**5.9.3**) and cross-checked in
`sandbox/ts-p0/node_modules/@typescript/typescript-linux-x64/lib/tsc` (**7.0.2**).
**None of it is recalled and none of it came from a run.**

1. 🔴 **The computed-option chain — this is chunk 07's spine.** `_computedOptions`
   at ~line 21905. `target` defaults from the **raw** `module`; `module` defaults
   from the **computed** `target`; `moduleResolution` defaults from the computed
   `module`:

   | `module` | implied `moduleResolution` |
   |---|---|
   | `commonjs` | `node10` |
   | `node16` / `node18` / `node20` | `node16` |
   | `nodenext` | `nodenext` |
   | `preserve` | `bundler` |
   | **everything else** (`es2015`…`esnext`, `amd`, `umd`, `system`, `none`) | 🔴 **`classic`** |

   That last row is the headline: `"module": "esnext"` with no `moduleResolution`
   gives you `classic`, which never looks in `node_modules`.

2. **Implied `target`:** `node16` → ES2022 · `node18` → ES2022 · **`node20` →
   ES2023** · `nodenext` → ESNext (floating) · otherwise ES5. So a `node18` →
   `node20` bump changes downlevelling.

3. **`esModuleInterop` computed default** is `true` for `node16`/`node18`/
   `node20`/`nodenext`/`preserve`, `false` otherwise.

4. **`module` internal numbering is load-bearing:** `node16`=100, `node18`=101,
   `node20`=102, `nodenext`=199, `preserve`=200. The compiler tests
   `100 <= module <= 199` to mean "Node family". `moduleResolution`: `classic`=1,
   `node10`/`node`=2, `node16`=3, `nodenext`=99, `bundler`=100.

5. 🔴 **`TS6280` vs `TS6278` is a diagnosis pair.** 6280 = *"could not be resolved
   under your current 'moduleResolution' setting. Consider updating to 'node16',
   'nodenext', or 'bundler'"* → **your config**. 6278 = *"could not be resolved
   when respecting package.json \"exports\". The '{1}' library may need to update
   its package.json or typings"* → **upstream**. Neither message says which.

6. 🔴 **`TS5095` differs between 5.9.3 and 7.0.2** — 5.9.3: *"…'module' is set to
   'preserve' or to 'es2015' or later."*; **7.0.2 adds `'commonjs'`**. So
   TypeScript 7 permits `moduleResolution: bundler` with CommonJS emit. The
   handbook is narrower than both (it says `esnext` or `preserve`).

7. **`moduleResolutionSupportsPackageJsonExportsAndImports`** — one predicate,
   `Node16..NodeNext || Bundler`. The real dividing line of the four strategies.

8. **The `File is … module because …` family, 1457–1461** — e.g. *"File is
   CommonJS module because '{0}' does not have field \"type\""*, *"…because
   'package.json' was not found"*, *"File is ECMAScript module because '{0}' has
   field \"type\" with value \"module\""*. 🔴 **This is chunk 08's payload** — the
   compiler's own answer to "why does it think this file is CJS?".

9. 🔴 **`moduleDetection` defaults to `force` under the Node family** (module
   100–199) and `auto` otherwise — so `export {}` is required under `esnext` and
   pointless under `nodenext`. Its `defaultValueDescription` is the clearest
   statement of the `auto` heuristic anywhere.

10. 🔴 **`TS1458`–`TS1461` distinguish THREE ways of not being ESM** — the
   `"type"` field says something else · the field is absent · the `package.json`
   is absent — and `{0}` names the deciding file. `TS1480`–`TS1483` are four
   variants of the same *fix* suggestion, tailored to what was found, so the
   variant you get is itself diagnostic information.

11. ⚠️ **Node's errors page truncates on WebFetch.** The error *codes*
   (`ERR_MODULE_NOT_FOUND`, `ERR_REQUIRE_ESM`, `ERR_UNSUPPORTED_DIR_IMPORT`,
   `ERR_UNKNOWN_FILE_EXTENSION`, `ERR_REQUIRE_ASYNC_MODULE`,
   `ERR_PACKAGE_PATH_NOT_EXPORTED`) are confirmed present in the index, but
   **their message text was NOT obtainable and is deliberately not quoted** on
   chunk 10, which says so in place. The Node **ESM** page does resolve and gave
   two verbatim rules: mandatory file extensions, and `require()` supporting only
   *synchronous* ES modules.

12. **Other diagnostics already quoted:** `TS1203`, `TS1288`, `TS1293`, `TS1295`,
   `TS1309`, `TS1343`, `TS1470`, `TS1471`, `TS1479`, `TS1541`/`TS1542`, `TS1544`,
   `TS2307`, `TS2732`, `TS2792`, `TS2834`, `TS2835`, `TS2877`, `TS5070`, `TS5096`,
   `TS5097`, `TS5098`, `TS5109`, `TS5110`, `TS6279`, `TS6421`.

## 🔴 Topic 04 · research ALREADY DONE — do not re-derive

Gathered 2026-08-17 immediately before the pause, all by **reading files**, no runs.

1. 🔴 **`structuredClone` is declared ONLY in `lib.dom.d.ts` and
   `lib.webworker.d.ts`** — confirmed by `grep -l` across all 100 `lib.*.d.ts`
   files shipped with **TypeScript 5.9.3**. It is in **no** `lib.es20NN.d.ts`.
   That is the syllabus's own question ("why `structuredClone` is missing from
   your types but present at runtime") settled from the shipped declarations
   rather than from prose.

2. 🔴 **And `@types/node` does declare it** — `web-globals/messaging.d.ts`:
   `function structuredClone<T = any>(value: T, options?: worker_threads.StructuredSerializeOptions): T;`
   (read from **`@types/node` 26.1.2** at
   `my-learning/eKommerce/ek-backend/node_modules/@types/node`; ⚠️ eKommerce is
   **advisor-only — read, never write**). `worker_threads.d.ts` additionally has
   `export import structuredClone = globalThis.structuredClone;`, i.e. it
   *re-exports the global* rather than redeclaring it.
   **So the complete answer is a three-way one:** the DOM lib has it, the ES libs
   never will (it is not an ECMAScript feature), and on Node you get it from
   `@types/node` — which is why the symptom is "missing from my types" only in a
   project with neither `lib: ["dom"]` nor `@types/node` wired in.

3. **`getDefaultLibFileName`, read from the 5.9.3 source** — `target` ES2015
   through ESNext each map to their own `lib.es20NN.d.ts`; **everything else
   (ES5, and ES3 which is treated as unset) falls to plain `lib.d.ts`.** The
   `targetToLibMap` entries are `"es2015"`→`lib.es2015.d.ts` … `"es2024"`→
   `lib.es2024.d.ts`.

4. **100 `lib.*.d.ts` files ship with the compiler** (`ls | grep -c '^lib\.'`).
   Worth stating because people picture "a" lib file.

⚠️ **Boundary — do NOT restate phase 7.**
`phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md`
already argues `target` ("why 'es5' is the tell of a copied config"), `lib`,
`@types/node`, `types`/`typeRoots` as an off-by-default allowlist, and
`skipLibCheck` — **for a Node service**. Topic 04 owns the **general mechanism**
(what a lib file *is*, the DOM/Node/ES three-way split, `target`→`lib`
implication, ambient environment vs module) and links there for the applied case.

## 📌 Already fetched — do not re-fetch

- Handbook **Modules — Theory** (scripts vs modules, the three jobs, input/output
  syntax decoupling, specifier emitted as-written, format detection)
- Handbook **Modules — Reference** (all `module` values; all `moduleResolution`
  strategies; the node16 import/require feature table; the bundler feature list;
  node10's unsupported list; `node_modules` lookups; directory modules;
  extensionless paths; `"exports"`; `"imports"` + the **`rootDir` requirement**)
- Handbook **Modules — Choosing Compiler Options** (the bundler, Node and library
  recipes, verbatim, with their rationale)
- Release notes **5.8** (`node18`, `require(esm)`, `erasableSyntaxOnly`) and
  **5.9** (`node20`, implies `target: es2023`)

Still un-fetched and likely needed: the **ESM/CJS interop appendix** (for topic
02's `verbatimModuleSyntax` argument) and the **5.0** notes (for `bundler`'s
introduction and the `node`→`node10` rename).

## Boundaries — what lane C must NOT restate

- **`phase-7-server/01-tsconfig-for-a-node-service/`** already argues `nodenext`,
  `verbatimModuleSyntax`, `allowImportingTsExtensions` and `TS5096` **on a real
  Node 24 service**. Lane C owns the *general rule*; that page owns the applied
  case. Link it, do not repeat it. Chunk 02's existing coverage of the
  extension/`.js` rule is deliberately duplicated at a different altitude —
  check before adding more.
- **`phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md`**
  settles that `skipLibCheck` is not a suppression mechanism — topic 10 is lane
  D's anyway.
- **`phase-4-classes-declarations/06-global-augmentation.md`** owns
  `declare global` needing a module; chunk 01 links it.

## Traps hit in this session

- ⚠️ **`git add <dir>` swept lane D's in-progress files into my commit** (their
  `07-authoring-d-ts-files/` chunks landed in `8da01f32`). Nothing lost, but
  **stage individual file paths, never the phase directory** — D is writing in it
  concurrently.
- **`git commit` needs `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env vars** and `-F -`
  with a quoted heredoc; there is no readable `user.*` config.
- **A bare `grep -F` on the 7.0.2 binary returns one ~125 KB line.** Dump
  `strings -n 20` to a scratch file first, then grep that — a bounded `-oE`
  pattern over the raw binary can exceed ugrep's complexity limit and it is slow
  enough to hit the tool timeout.
- **Renaming a chunk file** is safe (unlike converting a flat `NN-topic.md` to a
  directory, which takes the whole-site build down while both exist) — but
  repoint every inbound `./NN-name.md` link in the same motion.

## Boards claimed

- `docs/typescript/pages/README.md` — lane C row → session `5ff47a9c`; phase 6
  row linked and marked 🚧 writing
- `docs/README.md` — Part C claims row → session `5ff47a9c`
- `src/data/progress.js` — `phase-6-modules-build` given `pagesPlanned: 16`
  ⚠️ **shared with lane D** — re-read before every edit and take the higher
  `pages` number

Related: [[devbible-typescript-split-4way]] · [[devbible-typescript-build-progress]]
· [[devbible-never-compress-to-fit-cap]] · [[devbible-no-new-sandbox-scripts]]
