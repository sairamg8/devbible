---
name: devbible-typescript-phase0
description: The measured dataset behind TypeScript Phase 0 (13 pages) — strict now defaults to true, the 10x benchmark that was really 3x, the API that moved to unstable/, and tsc emitting broken JS with exit 2
metadata:
  type: reference
---

Phase 0 "How TypeScript runs" — **13 pages written 2026-08-13, build clean**.
Scripts: `sandbox/ts-p0/ex1…ex9`, own npm project, **both compilers installed**
(`node_modules/typescript` = 7.0.2, `node_modules/typescript5` = 5.9.3).

> **Invoke them by path.** The `typescript5` alias package also declares a `tsc`
> bin, so `.bin/tsc` resolves to **5.9.3**, not 7. Use
> `node node_modules/typescript/bin/tsc` for 7.0.2.

## The four findings that contradict what is commonly written

### 1. `strict` defaults to **true** in TypeScript 7 (ex4)

`tsc --help --all` reports `default: true` for `--strict` on 7.0.2 and
`default: false` on 5.9.3. Measured: an unflagged run of a loose file reports
`TS7006`, `TS18047`, `TS2564`, `TS18046`; `--strict false` exits 0.

**The first version of ex4 was wrong** — it used "no flag" as the loose baseline
and got identical output on both sides. A loose baseline must now be explicit.

Other changed defaults: `esModuleInterop` false → **true**; `moduleResolution`
`Node`/`Classic` → **`bundler`** (or node16/nodenext following `module`).

### 2. The TS7 speed-up is **3×**, not the 10× first measured (ex8)

300 files / 1500 lines, `--noEmit --strict`, best of 3, warmed:
**7.0.2 = 0.74–0.76 s · 5.9.3 = 2.32–2.36 s.**

**Two confounds, both removed:**
1. Run inside the repo, 5.9.3 auto-included `../../node_modules/@types` (the
   Docusaurus site's react/node/mdx) and 7.0.2 did not — it reported four
   `TS2503` errors from files unrelated to the fixture. Different workloads.
2. **Moving the fixture to `/tmp` did not fix it** — ambient `@types` resolution
   follows the **cwd**, not the source location. The cwd had to move too.

The script now asserts **both sides report zero diagnostics** before either
timing is believed. This is the [[devbible-verify-your-own-measurements]] rule
catching a 3× overstatement.

### 3. The classic `ts.*` API **moved**, it is not gone

`require('typescript')` exports exactly two keys (`version`,
`versionMajorMinor`), so `ts.createProgram` is `undefined` — **but** the exports
map publishes `typescript/unstable/sync`, `/async`, `/fs`, `/proto`, `/ast`,
`/ast/is`, `/ast/factory`, `/ast/utils`, `/ast/scanner`, `/ast/visitor`,
`/ast/clone`. Verified working: `sync` exposes `API, Checker, Emitter,
DiagnosticCategory, …`; `ast` has **409 exports**.

I wrote "the API is gone" in the syllabus first and corrected it on measurement —
both `docs/typescript/README.md` and the Phase 12 syllabus row now say "moved".
Package also vendors `vscode-jsonrpc` and ships **no `tsserver` bin**.

### 4. `tsc` emits broken JavaScript by default, exit code **2**

| Invocation | Errors | Files written | Exit |
|---|---|---|---|
| `tsc` | yes | **yes** | **2** |
| `tsc --noEmitOnError` | yes | no | 1 |
| `tsc --noEmit` | yes | no | 1 |

`const port: number = "8080"` emitted, ran, printed `port + 1 = 80801`.

## The rest of the measured set

- **Erasure (ex1):** 15-line source → **7-line** emit. Deleted: `interface`,
  `type`, generics, every annotation, `satisfies`, `as`. Added `export {}`.
- **Non-erasable (ex2):** enum emits the reverse-mapping IIFE; parameter
  properties emit field decls + `this.x = x`. Node rejects all three with exact
  messages: `TypeScript enum is not supported in strip-only mode`,
  `TypeScript namespace declaration is …`, `TypeScript parameter property is …`,
  all `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
- **`erasableSyntaxOnly` (ex5):** `error TS1294: This syntax is not allowed when
  'erasableSyntaxOnly' is enabled.` Defaults to false.
- **`tsc --init` on 7.0.2** writes `strict`, **`noUncheckedIndexedAccess`**,
  **`exactOptionalPropertyTypes`**, `verbatimModuleSyntax`, `isolatedModules`,
  `noUncheckedSideEffectImports`, `moduleDetection: force`, `skipLibCheck`,
  `module: nodenext`, `target: esnext`. **No `include`, no `outDir`, no
  `rootDir`.**
- **Per-flag attribution (ex4):** `noImplicitAny`→TS7006 ·
  `strictNullChecks`→TS18047 · `useUnknownInCatchVariables`→TS2339/TS18046 ·
  `strictPropertyInitialization` alone → **`TS5052` cannot be specified without
  `strictNullChecks`**.
- **Types acquisition (ex6):** `TS7016` names the resolved `.js` path and
  suggests both fixes; a local `declare module` clears it; the declaration is
  then enforced (`TS2345`) though **never verified against the library**.
- **Transpile ≠ check (ex7):** esbuild 0.28.2 emits a string-into-`number` bug
  and **exits 0**; output throws `TypeError: cart.total.toFixed is not a
  function`; `tsc --noEmit` reports `TS2322`. (`--loader=ts` only applies to
  stdin — drop it when passing a file.)
- **Node 24.19.0 (ex9):** `node quote.ts` prints `quote: 300`, exit 0, no flag.
  `const weight: number = "heavy"` prints `HEAVY`, exit 0.
- **`@ts-check` (ex5):** `TS2345` on a JSDoc-annotated `.js`; node prints `NaN`.

## Page shape that worked

13 single files, **154–262 lines**, none over cap and a genuine spread — not the
narrow band that signals budgeting. Sections: tier badge · `> Verified:` ·
bold one-liner · measured console blocks · Trade-off · Gotchas (symptom → cause →
fix) · Interview questions (★ on common) · prev/next footer.

Build: `rm -rf .docusaurus build node_modules/.cache && yarn build` → **zero
`warning|broken` across the whole site**. The two `./README.md` broken links on
the first run were the known **new-README cache trap**, not real.

Related: [[devbible-typescript-syllabus]] ·
[[devbible-verify-your-own-measurements]] · [[devbible-never-compress-to-fit-cap]]
