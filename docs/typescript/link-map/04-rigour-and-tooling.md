---
title: "Link map · TypeScript · Part 4 (phases 10–12)"
sidebar_label: "04 · TypeScript · Rigour and tooling (10–12)"
sidebar_position: 4
---

# Link map · TypeScript · Part 4 (phases 10–12)

Covers every topic row of `docs/typescript/syllabus/04-rigour-and-tooling.md`: T10-01 to T10-13 (strictness and correctness), T11-01 to T11-12 (migration and legacy), T12-01 to T12-15 (tooling, performance and testing). That is 40 rows. Phases 10 and 12 have pages of ours (✅); **phase 11 was dropped on 2026-08-15 and has no pages (🔲)**, so its blocks are research for a future page, not for a written one.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. Official typescriptlang.org and tool-docs pages show no date, so only the fetch date is given. No `#anchors` are given. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies.

🔴 **Version note.** Our README targets TypeScript 7.0.2. The TypeScript 7.0 announcement is dated July 8th, 2026 and the 6.0 announcement March 23rd, 2026 (both *read*). The 7.0 post says the native port is "10x faster", that 7.0 adopts 6.0's new defaults (`strict` true by default; `esModuleInterop` and `allowSyntheticDefaultImports` cannot be false; `alwaysStrict` cannot be false), and that anything deprecated in 6.0 is a hard error. It also says 7.0 "does not ship with an API"; a new API is expected in 7.1, and `@typescript/typescript6` (executable `tsc6`) runs side by side for tools such as typescript-eslint. Our README says the package exports an `unstable/` surface; the post does not mention that, so treat it as **not confirmed** by the post. The TSConfig reference pages and Handbook release notes cited below describe the JS-based 5.x/6.0 line and are not diffed against 7.0.

---

## Phase 10 — Strictness and correctness

### T10-01 · `strict` flag by flag — Master · ✅ written `docs/typescript/pages/phase-10-strictness/01-strict-flag-by-flag/README.md`
- **Read this:** [TSConfig Option: strict](https://www.typescriptlang.org/tsconfig/strict.html) · typescriptlang.org · `strict` enables the whole strict family; future versions may add checks under it (*read*) · covers our angle: **partial** — the per-flag list did not come through in the fetch, so what each flag rejects is not here · fetched 2026-10-12
- **Also good:** [How to Incrementally Migrate an Angular Project to TypeScript Strict Mode](https://www.bitovi.com/blog/how-to-incrementally-migrate-an-angular-project-to-typescript-strict-mode) · Bitovi, 2022-06-22 · lists the TS 4.7.3 strict flags with a failing example for each (*read*; Angular examples, flag list predates `strictBuiltinIteratorReturn`) · fetched 2026-10-12
- **Our delta:** the full-reference page (`https://www.typescriptlang.org/tsconfig/`, *headings only*) lists `strictBuiltinIteratorReturn` in the strict family; the 7.0 post says `strict` is now true by default, so say what "default" means per version.
- *Checked, not chosen:* TSConfig reference index (nav and flag names only in our fetch).

### T10-02 · `noUncheckedIndexedAccess` — Master · ✅ written `docs/typescript/pages/phase-10-strictness/02-nouncheckedindexedaccess.md`
- **Read this:** [TSConfig Option: noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html) · typescriptlang.org · index-signature example: `env.NODE_ENV` goes from `string` to `string | undefined` (*read*) · covers our angle: **partial** — the page shows records only, no array `arr[0]` example in our fetch, and nothing on fixing errors without `!` · fetched 2026-10-12
- **Also good:** [The Seven Sources of Unsoundness in TypeScript](https://effectivetypescript.com/2021/05/06/unsoundness/) · Effective TypeScript, 2021-05-06 · "Object and array lookups": no bounds checking, so `xs[3]` is typed as present (*read*) · fetched 2026-10-12
- **Our delta:** the "fix twenty errors without `!` or `as`" drill; neither page teaches it.

### T10-03 · Containing `any` — Master · ✅ written `docs/typescript/pages/phase-10-strictness/03-containing-any.md`
- **Read this:** [Seven Sources of Unsoundness](https://effectivetypescript.com/2021/05/06/unsoundness/) · Effective TypeScript, 2021-05-06 · "any" is the first source; `JSON.parse` style data, with Zod or JSON Schema as the fix (*read*) · covers our angle: **partial** — no all-four-doors list, written against TS 4.x · fetched 2026-10-12
- **Also good:** [any type](https://www.totaltypescript.com/concepts/any-type) · Total TypeScript · `any` versus `unknown`, with the runtime-error example (*read*) · [no-unsafe-assignment](https://typescript-eslint.io/rules/no-unsafe-assignment/) · typescript-eslint · rule that tracks `any` flowing into variables (*headings only*) · fetched 2026-10-12
- **Our delta:** the four doors (untyped deps, `as`, `JSON.parse`, implicit returns) and how `any` spreads once inside.

### T10-04 · Reading a TypeScript error — Master · ✅ written `docs/typescript/pages/phase-10-strictness/04-reading-a-typescript-error.md`
- **Read this:** [How to Read & Troubleshoot TypeScript Errors](https://dev.to/nevulo/how-to-read-troubleshoot-typescript-errors-1l6f) · Nevulo, dev.to (date not read) · each indentation level goes into more detail; overload errors list one failure per overload (*read* the indentation passage) · covers our angle: **partial** — no "read the trailing property path first" rule stated in what I read · fetched 2026-10-12
- **Also good:** [Solving TypeScript Errors](https://www.totaltypescript.com/tutorials/solving-typescript-errors) · Total TypeScript · tutorial index of error exercises (*headings only*) · fetched 2026-10-12
- **Our delta:** innermost line first, then trailing path, ignore the outer noise. The "bottom-up" heuristic came from search snippets only: **not confirmed** on a page I read.

### T10-05 · `exactOptionalPropertyTypes` — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/05-exactoptionalpropertytypes/README.md`
- **Read this:** [TSConfig Option: exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html) · typescriptlang.org · the `colorThemeOverride` example and `"x" in settings` behaving differently for absent versus `undefined` (*read*) · covers our angle: full for the concept; **partial** — no API-bug catalogue · fetched 2026-10-12
- **Also good:** [TypeScript 4.4 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html) · typescriptlang.org · the `Person` / `age: undefined` example and the runtime-error risk (*read*) · fetched 2026-10-12
- **Our delta:** the JSON boundary and spread/default construction, which are pages of ours.

### T10-06 · The other correctness flags — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/06-the-other-correctness-flags/README.md`
- **Read this:** [TSConfig Option: noImplicitOverride](https://www.typescriptlang.org/tsconfig/noImplicitOverride.html) · typescriptlang.org · the renamed-base-method example: without the flag nothing warns; with it the missing `override` errors (*read*) · covers our angle: **partial** — one of six flags · fetched 2026-10-12
- **Also good:** [TSConfig reference](https://www.typescriptlang.org/tsconfig/) · typescriptlang.org · the single page that lists all six flags (*headings only*) · fetched 2026-10-12
- **Our delta:** `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`/`noUnusedParameters`: I read no per-flag passage for these. Each has its own page at `https://www.typescriptlang.org/tsconfig/<flag>.html` (pattern confirmed for the flags in this map only).

### T10-07 · Where TypeScript is unsound by design — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/07-unsound-by-design/README.md`
- **Read this:** [The Seven Sources of Unsoundness in TypeScript](https://effectivetypescript.com/2021/05/06/unsoundness/) · Effective TypeScript, 2021-05-06 · any, assertions, lookups, bad definitions, array variance, refinements not invalidated by calls (*read*) · covers our angle: **partial** — no `Object.keys` or method bivariance · fetched 2026-10-12
- **Also good:** [TypeScript FAQ](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/FAQ.md) · microsoft/TypeScript wiki · method bivariance is allowed unsoundly, with a "Why Method Bivariance?" section (*read*) · [Design Goals](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/TypeScript-Design-Goals.md) · same wiki · non-goal "Apply a sound or provably correct type system" (*read*) · fetched 2026-10-12
- **Our delta:** `Object.keys` returning `string[]`: only [Why doesn't TypeScript properly type Object.keys?](https://alexharri.com/blog/typescript-structural-typing) (Alex Harri, date not read, *headings only*) found.

### T10-08 · `@ts-expect-error` vs `@ts-ignore` vs `@ts-nocheck` — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/08-suppression-directives/README.md`
- **Read this:** [TypeScript 3.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html) · typescriptlang.org · `@ts-expect-error` suppresses an error and reports if there is none to suppress (*read*) · covers our angle: **partial** — introduction page, no `@ts-nocheck` and no policy · fetched 2026-10-12
- **Also good:** [ban-ts-comment](https://typescript-eslint.io/rules/ban-ts-comment/) · typescript-eslint · directives reduce the effectiveness of TypeScript; can require descriptions (*read*) · fetched 2026-10-12
- **Our delta:** the suppression tiers and a team policy.

### T10-09 · Excess property checks vs assignability — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/09-excess-property-checks/README.md`
- **Read this:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · section "Excess Property Checks": object literals get special treatment when assigned or passed as arguments (*read*) · covers our angle: **partial** — freshness is not named in what I read · fetched 2026-10-12
- **Our delta:** freshness, where it is lost, and the second and third rules.
- *Not opened:* a dedicated "freshness" article (search found none).

### T10-10 · The error codes you will actually meet — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/10-the-error-codes/README.md`
- **Read this:** none found — tried: "TypeScript error codes explained TS2322 TS2345 TS2339 TS7053 TS18046" (web); results were aggregator and AI-skill pages, none covering 7053 or 18046, and I did not read them. The official TSConfig `checkJs` page (*read*) shows a live `2345` message and is the only primary source I opened.
- **Our delta:** all of it; our 14-page lookup is the reference.

### T10-11 · typescript-eslint type-aware rules — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/11-typescript-eslint/README.md`
- **Read this:** [Linting with Type Information](https://typescript-eslint.io/getting-started/typed-linting/) · typescript-eslint, v8.71.1 shown · rules use TypeScript's type-checking APIs, so they analyse the whole project and are slower (*read*) · covers our angle: **partial** — setup, not the four rules · fetched 2026-10-12
- **Also good:** [no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/) · a floating Promise has no error handling (*read*) · [no-misused-promises](https://typescript-eslint.io/rules/no-misused-promises/) (*read*) · [no-unnecessary-condition](https://typescript-eslint.io/rules/no-unnecessary-condition/) (*read*) · [strict-boolean-expressions](https://typescript-eslint.io/rules/strict-boolean-expressions/) (*read*) · [Performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/) · lint time should be about build time; `TIMING=1` (*read*) · fetched 2026-10-12
- **Our delta:** CI cost. TS 7 has no stable API yet (per the 7.0 post), so how typed linting runs on 7 is **not confirmed**; the post says tools like typescript-eslint use the side-by-side 6.0 package.

### T10-12 · Assertion discipline — Understand · ✅ written `docs/typescript/pages/phase-10-strictness/12-assertion-discipline/README.md`
- **Read this:** [Type Assertions](https://www.totaltypescript.com/concepts/type-assertions) · Total TypeScript · assertions "let you lie to TypeScript"; `as` has limits (*read*) · covers our angle: **partial** — no policy or ban · fetched 2026-10-12
- **Also good:** [no-unsafe-type-assertion](https://typescript-eslint.io/rules/no-unsafe-type-assertion/) · typescript-eslint · forbids assertions that narrow a type (*read*) · [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · "Type Assertions", removed at compile time (*read*) · fetched 2026-10-12
- **Our delta:** treating every `as` as a review comment, and the guard to write instead.

### T10-13 · Designing APIs `unknown`-first — Know · ✅ written `docs/typescript/pages/phase-10-strictness/13-unknown-first-apis.md`
- **Read this:** [TypeScript 3.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html) · typescriptlang.org · "New unknown top type": the type-safe counterpart of `any`, no operations until narrowed (*read*) · covers our angle: **partial** — the type, not API design · fetched 2026-10-12
- **Also good:** [any type](https://www.totaltypescript.com/concepts/any-type) · Total TypeScript · `greet(name: unknown)` narrowed with `typeof` (*read*) · fetched 2026-10-12
- **Our delta:** making callers prove the shape at the parameter.

---

## Phase 11 — Migration and legacy

🔴 This phase is **dropped**; every block is 🔲. Research only, in case it is reopened.

### T11-01 · A migration strategy that ships — Understand · 🔲 not written (phase dropped)
- **Read this:** [Migrating from JavaScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html) · typescriptlang.org · `allowJs` plus `include`, then `noImplicitAny` early; stricter checks after conversion (*read*) · covers our angle: **partial** — no leaf-first order and no "never convert and refactor together" · fetched 2026-10-12
- **Also good:** [ts-migrate README](https://raw.githubusercontent.com/airbnb/ts-migrate/master/README.md) · Airbnb · output compiles but needs follow-up; many `@ts-expect-error` and `any` to fix (*read*) · fetched 2026-10-12
- **Our delta:** ordering and commit discipline; one search result recommended leaf-first, which I did not read: **not confirmed**.

### T11-02 · `checkJs` and JSDoc types — Understand · 🔲 not written (phase dropped)
- **Read this:** [TSConfig Option: checkJs](https://www.typescriptlang.org/tsconfig/checkJs.html) · typescriptlang.org · equivalent to `// @ts-check` in every JS file; the `parseFloat(3.142)` example reports 2345 (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Type Checking JavaScript Files](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html) · typescriptlang.org · class properties typed by JSDoc in the constructor (*read* a passage) · [JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) · the supported tag list includes `@type`, `@param`, `@typedef`, `@satisfies` (*read* the list) · fetched 2026-10-12
- **Our delta:** what JSDoc cannot express.

### T11-03 · Adopting `strict` incrementally — Understand · 🔲 not written (phase dropped)
- **Read this:** [typescript-strict-plugin README](https://raw.githubusercontent.com/allegro/typescript-strict-plugin/master/README.md) · Allegro · `//@ts-strict-ignore` per file or directory; IDE-only, so use `tsc-strict` at build time (*read*) · covers our angle: **partial** — a plugin, not per-directory `tsconfig` or ratcheting; TS 7 plugin support **not confirmed** · fetched 2026-10-12
- **Also good:** [Bitovi strict migration](https://www.bitovi.com/blog/how-to-incrementally-migrate-an-angular-project-to-typescript-strict-mode) · 2022-06-22 · flag-by-flag walk-through, Angular (*read* the flag list) · fetched 2026-10-12
- **Our delta:** a stricter config for new code via `extends`, and ratcheting.

### T11-04 · Taming an untyped dependency — Understand · 🔲 not written (phase dropped)
- **Read this:** [Declaration Files: Consumption](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html) · typescriptlang.org · `@types/<name>` packages, skip them if the package bundles types (*read*) · covers our angle: **partial** — no local shim · fetched 2026-10-12
- **Also good:** [DefinitelyTyped README](https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/README.md) · how to upstream a package (*read*) · fetched 2026-10-12
- **Our delta:** the local `.d.ts` shim: no page I read covers `declare module` shims.

### T11-05 · CommonJS legacy — Understand · 🔲 not written (phase dropped)
- **Read this:** [TSConfig Option: esModuleInterop](https://www.typescriptlang.org/tsconfig/esModuleInterop.html) · typescriptlang.org · the interop emit and the `__importStar` helpers; enabling it also enables `allowSyntheticDefaultImports` (*read*) · covers our angle: **partial** — no `import x = require()` or `export =` · fetched 2026-10-12
- **Also good:** [ESM/CJS Interoperability](https://www.typescriptlang.org/docs/handbook/modules/appendices/esm-cjs-interop.html) · typescriptlang.org · history of the transpiler interop problem (*read* the opening) · fetched 2026-10-12
- **Our delta:** 🔴 TS 7 forbids `esModuleInterop: false` (per the 7.0 post), so legacy configs break.

### T11-06 · Migrating `enum` to `const` objects — Understand · 🔲 not written (phase dropped)
- **Read this:** [Tidy TypeScript: Prefer union types over enums](https://oida.dev/tidy-typescript-avoid-enums/) · oida.dev, 2020-11-19 · enums emit code; `as const` object plus a `Values<T>` helper gives the union (*read*) · covers our angle: full for the pattern; **partial** — no strip-only mode · fetched 2026-10-12
- **Also good:** [Node.js: Running TypeScript](https://nodejs.org/api/typescript.html) · enum declarations need transformation, so strip-only mode errors on them (*read*) · [TypeScript 5.8 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html) · `--erasableSyntaxOnly` (*read*) · fetched 2026-10-12
- **Our delta:** keeping call sites unchanged during the migration.

### T11-07 · Deprecations across 5.x → 6.0 → 7.0 — Understand · 🔲 not written (phase dropped)
- **Read this:** [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) · Microsoft, March 23rd, 2026 · the deprecation list (`target: es5`, `baseUrl`, `--moduleResolution node`…), `ignoreDeprecations: "6.0"`, the `ts5to6` tool, `--stableTypeOrdering` (*read*) · covers our angle: full for 6.0 · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · July 8th, 2026 · hard errors for everything 6.0 deprecated (*read*) · fetched 2026-10-12
- **Our delta:** an upgrade plan for a large repo.

### T11-08 · An `any` budget — Know · 🔲 not written (phase dropped)
- **Read this:** [type-coverage README](https://raw.githubusercontent.com/plantain-00/type-coverage/master/README.md) · plantain-00 · `--at-least` fails CI under a threshold; `--strict` counts assertions as uncovered; `--ignore-catch` (*read*) · covers our angle: **partial** — measuring and CI gate; ratchet policy is ours · fetched 2026-10-12
- *Checked, not chosen:* [no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any/) (*headings only*; a ban, not a budget).
- **Our delta:** why a day-one ban produces creative `as` casts.

### T11-09 · `allowJs` and `outDir` interplay — Know · 🔲 not written (phase dropped)
- **Read this:** [TSConfig Option: allowJs](https://www.typescriptlang.org/tsconfig/allowJs.html) · typescriptlang.org · `.ts` and `.js` live side by side; pairs with `declaration` and `emitDeclarationOnly` (*read*) · covers our angle: **partial** — no emit-surprise detail · fetched 2026-10-12
- **Also good:** [Migrating from JavaScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html) · the `outDir: ./built` plus `allowJs` config (*read*) · fetched 2026-10-12
- **Our delta:** the surprises themselves: none found.

### T11-10 · Legacy React types — Know · 🔲 not written (phase dropped)
- **Read this:** [Function Components](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/function_components/) · React TypeScript Cheatsheet · `React.FC` mostly stylistic with new React types and TS 5.1, discouraged earlier; a jscodeshift codemod to remove it (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Class Components](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/class_components/) (*read* opening: `React.Component` takes props and state generics) · [Typing defaultProps](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/default_props/) (*read*: `defaultProps` no longer supported on function components) · fetched 2026-10-12
- **Our delta:** `PropTypes`: no page opened.

### T11-11 · Namespaces and `/// <reference>` — When Needed · 🔲 not written (phase dropped)
- **Read this:** [Namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html) · typescriptlang.org · "internal modules" became namespaces in TS 1.5 (*read* opening) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Triple-Slash Directives](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html) · only valid at the top of a file; `preserve="true"` keeps them in output (*read*) · fetched 2026-10-12
- **Our delta:** `.d.ts` usage in old libraries.

### T11-12 · Codemods at scale — When Needed · 🔲 not written (phase dropped)
- **Read this:** [ts-migrate README](https://raw.githubusercontent.com/airbnb/ts-migrate/master/README.md) · Airbnb · plugin-based migration configs; expect follow-up on type safety (*read*) · covers our angle: **partial** — conversion, not review discipline · fetched 2026-10-12
- **Also good:** [jscodeshift README](https://raw.githubusercontent.com/facebook/jscodeshift/main/README.md) · a runner plus transform toolkit for JS and TS (*read* opening) · fetched 2026-10-12
- **Our delta:** the review discipline.

---

## Phase 12 — Tooling, performance and testing

### T12-01 · Type checking in CI — Master · ✅ written `docs/typescript/pages/phase-12-tooling/01-type-checking-in-ci/README.md`
- **Read this:** [Vite: Features, TypeScript](https://vite.dev/guide/features.html) · vite.dev · "Transpile Only": Vite does NOT perform type checking; run `tsc --noEmit` separately (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [esbuild: Content Types](https://esbuild.github.io/content-types/) · esbuild does no type checking, run `tsc -noEmit` in parallel (*read*) · [TSConfig Option: noEmit](https://www.typescriptlang.org/tsconfig/noEmit.html) · use TypeScript as the type-checker while another tool emits (*read*) · fetched 2026-10-12
- **Our delta:** the 7.0 post's CI figure (Slack, about 7.5 to 1.25 minutes, *read*) is vendor-reported.

### T12-02 · What TypeScript 7 changed for tooling — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/02-typescript-7-for-tooling/README.md`
- **Read this:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · Microsoft, July 8th, 2026 · no API shipped, 7.1 expected; `@typescript/typescript6` gives `tsc6` side by side; typescript-eslint and Volar stay on 6.0 (*read*) · covers our angle: **partial** — no `unstable/` surface mentioned · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) · March 23rd, 2026 · the transition release (*read*) · fetched 2026-10-12
- **Our delta:** the `unstable/` import paths come from our own check of the package, not from either post.

### T12-03 · Build pipelines — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/03-build-pipelines/README.md`
- **Read this:** [esbuild: Content Types, TypeScript](https://esbuild.github.io/content-types/) · parses and discards annotations, no type checking; features needing type information differ (*read*) · covers our angle: **partial** — no Rollup or swc comparison, no declaration emit · fetched 2026-10-12
- **Also good:** [Vite: Features](https://vite.dev/guide/features.html) · Oxc Transformer only transpiles; `isolatedModules` must be true (*read*) · fetched 2026-10-12
- **Our delta:** declaration emit placement. *Not opened:* swc and Oxc docs (Oxc page returned 200; contents not read).

### T12-04 · Testing types — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/04-testing-types/README.md`
- **Read this:** [Vitest: Testing Types](https://vitest.dev/guide/testing-types) · vitest.dev · `*.test-d.ts`, `expectTypeOf`/`assertType`, runs `tsc --noEmit`, and the `@ts-expect-error` assertion example (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [tsd README](https://raw.githubusercontent.com/tsdjs/tsd/main/readme.md) · `expectType` is strict, `expectError` (*read*) · [expectTypeOf API](https://vitest.dev/api/expect-typeof) · `toEqualTypeOf`; `toMatchTypeOf` deprecated since expect-type 1.2.0 (*read*) · fetched 2026-10-12
- **Our delta:** choosing between tools.

### T12-05 · Typing tests — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/05-typing-tests/README.md`
- **Read this:** [Vitest: vi API, `vi.mocked`](https://vitest.dev/api/vi) · vitest.dev · type helper; `partial` and `deep` options type partial mock values (*read*) · covers our angle: **partial** — mocks only · fetched 2026-10-12
- **Also good:** [TypeScript 4.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) · `satisfies` checks without widening (*read* the intro) · fetched 2026-10-12
- **Our delta:** typed fixtures, and keeping test types honest without `as any`.

### T12-06 · Diagnosing a slow compile — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/06-diagnosing-a-slow-compile/README.md`
- **Read this:** [TypeScript Performance wiki](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/Performance.md) · microsoft/TypeScript wiki · `--extendedDiagnostics`, `explainFiles`, interfaces over intersections, naming complex types (*read*) · covers our angle: full for the 5.x/6.0 compiler; whether every flag exists in 7.0 is **not confirmed** · fetched 2026-10-12
- **Also good:** [Performance Tracing](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/Performance-Tracing.md) · `generateTrace` introduced in 4.1; output may change (*read*) · fetched 2026-10-12
- **Our delta:** `DeepPartial` and barrel-file culprits; the wiki lists neither in what I read.

### T12-07 · Editor performance — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/07-editor-performance.md`
- **Read this:** [TypeScript Performance wiki](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/Performance.md) · "Misconfigured include and exclude", disabling editor plugins (*read*) · covers our angle: **partial** — no barrel-import material · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · LSP-based language server; VS Code first-error time about 17.5 s to under 1.3 s, vendor-reported (*read*) · fetched 2026-10-12
- **Our delta:** barrel imports: none found.

### T12-08 · `skipLibCheck` as a performance lever — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/08-skiplibcheck-as-a-performance-lever.md`
- **Read this:** [TSConfig Option: skipLibCheck](https://www.typescriptlang.org/tsconfig/skipLibCheck.html) · typescriptlang.org · saves time at the expense of accuracy; duplicate copies of a library's types are the common trigger (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Performance wiki](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/Performance.md) · `skipDefaultLibCheck` versus `skipLibCheck`; both can hide `.d.ts` conflicts (*read*) · fetched 2026-10-12
- **Our delta:** none.

### T12-09 · Caching TypeScript in CI and Docker — Understand · ✅ written `docs/typescript/pages/phase-12-tooling/09-caching-in-ci-and-docker.md`
- **Read this:** [Docker: Build cache](https://docs.docker.com/build/cache/) · docs.docker.com · each instruction is a layer; a changed layer invalidates all after it (*read*) · covers our angle: **partial** — nothing TypeScript-specific · fetched 2026-10-12
- **Also good:** [TSConfig Option: incremental](https://www.typescriptlang.org/tsconfig/incremental.html) · `.tsbuildinfo` files next to the output; safe to delete; `tsBuildInfoFile` (*read*) · fetched 2026-10-12
- **Our delta:** caching `.tsbuildinfo` between CI runs: no page I read states it. *Not opened:* [Dependency caching reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) (200, *headings only*).

### T12-10 · Monorepo orchestration — Know · ✅ written `docs/typescript/pages/phase-12-tooling/10-monorepo-orchestration.md`
- **Read this:** [Turborepo: TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript) · turborepo.dev · a `check-types` task running `tsc --noEmit`, cached and parallel; Project References not recommended (*read*) · covers our angle: **partial** — no Nx · fetched 2026-10-12
- *Checked, not chosen:* [Nx TypeScript introduction](https://nx.dev/docs/technologies/typescript/introduction) (200, *headings only*).
- **Our delta:** Nx task graphs.

### T12-11 · Declaration emit — Know · ✅ written `docs/typescript/pages/phase-12-tooling/11-declaration-emit.md`
- **Read this:** [TypeScript 5.5 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html) · typescriptlang.org · the "Isolated Declarations" section, written with Bloomberg and Google (*read* the opening) · covers our angle: **partial** — `.d.ts` generation cost not measured here · fetched 2026-10-12
- **Also good:** [TSConfig Option: isolatedDeclarations](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html) · annotate exports so other tools can generate declarations (*read*) · [Publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html) (*headings only*) · fetched 2026-10-12
- **Our delta:** bundling declarations for a package: none found.

### T12-12 · Validating published types — Know · ✅ written `docs/typescript/pages/phase-12-tooling/12-validating-published-types.md`
- **Read this:** [arethetypeswrong README](https://raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/README.md) · detects problems in `node10`, `node16`, `bundler` modes, e.g. "Masquerading as CJS" (*read*) · covers our angle: **partial** — no publint · fetched 2026-10-12
- **Also good:** [publint rules](https://publint.dev/rules) · publint v0.3.25 · rules grouped by severity (*read* the opening) · [publint README](https://raw.githubusercontent.com/publint/publint/master/README.md) · `npx publint` (*read*) · fetched 2026-10-12
- **Our delta:** testing the package as a consumer would.

### T12-13 · Measuring type coverage — Know · ✅ written `docs/typescript/pages/phase-12-tooling/13-measuring-type-coverage.md`
- **Read this:** [type-coverage README](https://raw.githubusercontent.com/plantain-00/type-coverage/master/README.md) · plantain-00 · `--strict` treats `any` in type arguments and assertions as uncovered (*read*) · covers our angle: **partial** — what the number does not mean is ours · fetched 2026-10-12
- **Our delta:** whether it runs on TS 7 is **not confirmed**.

### T12-14 · AST tooling after TS 7 — When Needed · ✅ written `docs/typescript/pages/phase-12-tooling/14-ast-tooling-after-ts7.md`
- **Read this:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · July 8th, 2026 · tools embedding TypeScript can only rely on 6.0 for now; side-by-side `@typescript/typescript6` (*read*) · covers our angle: **partial** — ts-morph and transformers not named · fetched 2026-10-12
- **Also good:** [ts-morph: Setup](https://ts-morph.com/setup/) · the `Project` class and `tsConfigFilePath` (*read*) · fetched 2026-10-12
- **Our delta:** ts-morph on 7.x is **not confirmed**; no ts-morph changelog read.

### T12-15 · Contributing to DefinitelyTyped — When Needed · ✅ written `docs/typescript/pages/phase-12-tooling/15-contributing-to-definitelytyped.md`
- **Read this:** [DefinitelyTyped README](https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/README.md) · make a pull request, Definition Owners, and "bundle the generated declaration files" if the library is written in TypeScript (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** when writing types beats waiting.
