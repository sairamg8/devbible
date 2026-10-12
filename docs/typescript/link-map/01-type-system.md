---
title: "Link map · TypeScript · Part 1 (phases 0–1)"
sidebar_label: "01 · TypeScript · Type system (0–1)"
sidebar_position: 1
---

# Link map · TypeScript · Part 1 (phases 0–1)

Covers every topic row of phases 0 and 1 in `docs/typescript/syllabus/01-type-system.md`: T00-01 to T00-13 (How TypeScript runs) and T01-01 to T01-17 (The type vocabulary). That is 30 rows. Phases 2 and 3 (27 rows) continue in `01-type-system-b.md`. All 30 have a page of ours (✅).
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. Official typescriptlang.org pages show no date, so only the fetch date is given. No `#anchors` are given.

🔴 **Version note.** npm on 2026-10-12: `typescript` latest is 7.0.2 (`beta` tag 6.0.0-beta, `next` 7.1.0-dev.20261012.1); `@typescript/native-preview` latest 7.0.0-dev.20260707.2; `@types/node` 26.6.5. The Handbook sidebar on typescriptlang.org lists release notes up to 6.0 and `release-notes/typescript-7-0.html` returned 404, so the TS 7 source is the devblog post of 2026-07-08. Facts read there: 7.0 is the native port, installs as `typescript` and gives a new `tsc`, ships **no** programmatic API (7.1 expected to bring a new one, per the post). Facts read in the 6.0 notes: `strict` defaults to true, `module` to `esnext`, `types` to `[]`, `rootDir` to `.`. Node docs fetched are v26.11.1.
`github.com` returns 403 to our fetcher (so the TypeScript wiki and typescript-go repo page are not cited); READMEs are cited as `raw.githubusercontent.com` copies.

---

## Phase 0 — How TypeScript runs

### T00-01 · TypeScript is a static checker, not a runtime — Master · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/01-static-checker-not-runtime.md`
- **Read this:** [The Basics](https://www.typescriptlang.org/docs/handbook/2/basic-types.html) · typescriptlang.org · static type-checking, "Erased Types", "Emitting with Errors", `tsc` (*read* the headings and the erased-types passage) · covers our angle: full · fetched 2026-10-12
- **Also good:** [No, TypeScript Types Don't Exist At Runtime](https://www.totaltypescript.com/typescript-types-dont-exist-at-runtime) · Matt Pocock, 2024-03-25 · types, assertions and parameters all vanish in the emitted JavaScript (*read*) · fetched 2026-10-12
- **Our delta:** none beyond the syllabus; the page owns the "checker, then throw away" framing.

### T00-02 · Erasure and what survives it — Master · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/02-erasure.md`
- **Read this:** [No, TypeScript Types Don't Exist At Runtime](https://www.totaltypescript.com/typescript-types-dont-exist-at-runtime) · Matt Pocock, 2024-03-25 · section "Enums, Namespaces and Parameter Properties" shows what does emit (*read* the intro, headings checked) · covers our angle: **partial** — decorators not confirmed on the page · fetched 2026-10-12
- **Also good:** [Enums](https://www.typescriptlang.org/docs/handbook/enums.html) · typescriptlang.org · "Enums at runtime", reverse mappings, `const enum` inlining; page footer shows "Last updated: Oct 05, 2026" (*read*) · fetched 2026-10-12
- **Our delta:** decorators emitting code, and the asymmetry as a bug source.

### T00-03 · The three ways to run TypeScript — Master · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/03-three-ways-to-run.md`
- **Read this:** [Running TypeScript Natively](https://nodejs.org/learn/typescript/run-natively) · nodejs.org · type stripping, no flags on v22.18+ for erasable-only code, "Node.js does not type check", `npx tsc --noEmit` (*read*) · covers our angle: **partial** — Node branch only, not `tsc` emit or esbuild/swc · fetched 2026-10-12
- **Also good:** [esbuild — TypeScript](https://esbuild.github.io/content-types/) · esbuild · "does not do any type checking so you will still need to run tsc -noEmit"; enums and namespaces are converted (*read*) · fetched 2026-10-12
- **Our delta:** the three-way table of who checks (only `tsc`) and what `enum` does in each case.

### T00-04 · Node's strip-only mode and `erasableSyntaxOnly` — Master · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md`
- **Read this:** [Modules: TypeScript](https://nodejs.org/api/typescript.html) · nodejs.org (v26.11.1) · history table (enabled by default 23.6/22.18, stable 25.2/24.12), enums, parameter properties and namespaces with runtime code error, `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` (*read*) · covers our angle: **partial** — its sample tsconfig sets `erasableSyntaxOnly`, but it does not explain the compile-error angle · fetched 2026-10-12
- **Also good:** [TSConfig: erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html) · typescriptlang.org · lists the banned constructs: enum, runtime namespace, parameter properties, `import =`, `export =` (*read*) · fetched 2026-10-12
- **Our delta:** the flag as "runtime failure becomes compile error". The TS 5.8 notes carry the same motivation (*read*).

### T00-05 · `strict` and the flags it turns on — Master · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/05-strict.md`
- **Read this:** [TSConfig: strict](https://www.typescriptlang.org/tsconfig/strict.html) · typescriptlang.org · strict enables the whole strict-mode family; future versions may add checks under it (*read*) · covers our angle: **partial** — the member flags are only listed on the full TSConfig reference · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) · Microsoft devblogs, 2026-03-23 · "strict is now true by default" (*read* the defaults passage) · fetched 2026-10-12
- **Our delta:** 🔴 the 6.0 default flip: a bare tsconfig is now strict on 6.x and 7.x, still non-strict below 6.0.

### T00-06 · `tsconfig.json` anatomy — Understand · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/06-tsconfig-anatomy.md`
- **Read this:** [TSConfig Reference](https://www.typescriptlang.org/tsconfig/) · typescriptlang.org · every option with its default; ≈22k words (*headings only*, plus the strict family list *read*) · covers our angle: **partial** — a reference, not "which fields you actually set" · fetched 2026-10-12
- **Also good:** [What is a tsconfig.json](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) · typescriptlang.org · `files`, `include`, `exclude`, `extends`, tsconfig bases (*read* the include/exclude section) · fetched 2026-10-12
- **Our delta:** the set-versus-ceremony split. [The TSConfig Cheat Sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet) (Matt Pocock, 2023-09-13, updated 2024-08-05, *headings only*) predates the 6.0 default changes.

### T00-07 · TypeScript 7 is a different compiler — Understand · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/07-typescript-7-native-compiler.md`
- **Read this:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · Microsoft devblogs, 2026-07-08 · native Go port, 8x–12x faster full builds as the post states, no API in 7.0, `@typescript/typescript6` npm alias for tools that import `typescript` (e.g. typescript-eslint), editor extension (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) · Microsoft devblogs, 2026-03-23 · the transition release: options deprecated in 6.0 are removed in 7.0, `ignoreDeprecations` (*read*) · fetched 2026-10-12
- **Our delta:** the checklist before upgrading a toolchain; the syllabus notes `require('typescript')` exports two keys in 7.0.2, which this post does not state.

### T00-08 · Where types come from — Understand · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/08-where-types-come-from.md`
- **Read this:** [Consumption](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html) · typescriptlang.org · `npm install --save-dev @types/lodash`; not needed when the package ships its own declaration file (*read*) · covers our angle: **partial** — nothing on diagnosing "could not find a declaration file" · fetched 2026-10-12
- **Also good:** [TSConfig: types](https://www.typescriptlang.org/tsconfig/types.html) · typescriptlang.org · before 6.0 all visible `@types` packages load; from 6.0 `types` defaults to `[]` (*read*); [typeRoots](https://www.typescriptlang.org/tsconfig/typeRoots.html) lists only packages under the roots (*read*) · fetched 2026-10-12
- **Our delta:** the diagnosis flow for the missing-declaration error. *Checked, not chosen:* DefinitelyTyped README (raw, contributor-oriented).

### T00-09 · The language server is not the build — Understand · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/09-language-server-vs-build.md`
- **Read this:** [Transpiling TypeScript (VS Code)](https://code.visualstudio.com/docs/typescript/typescript-transpiling) · code.visualstudio.com · section "Compiler versus language service": VS Code's language service is separate from your installed compiler; "Using newer TypeScript versions" and the workspace version (*read*) · covers our angle: **partial** — editor version only; `skipLibCheck` and unsaved files are not on it · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · Microsoft devblogs, 2026-07-08 · "Editor Experience": a dedicated VS Code extension, and a command to revert to the TS 6.0 language server (*read*) · fetched 2026-10-12
- **Our delta:** different `tsconfig` picked up, `skipLibCheck`, and CI's pinned version: no page found that gathers them.

### T00-10 · Type checking vs transpiling — Understand · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/10-checking-vs-transpiling.md`
- **Read this:** [Features — TypeScript (Vite)](https://vite.dev/guide/features.html) · vite.dev · "Vite only performs transpilation on .ts files and does NOT perform type checking"; explains why the two jobs differ (*read*) · covers our angle: **partial** — Vite only, no esbuild/swc detail · fetched 2026-10-12
- **Also good:** [esbuild — TypeScript](https://esbuild.github.io/content-types/) · esbuild · "will still need to run tsc -noEmit in parallel" (*read*) · fetched 2026-10-12
- **Our delta:** where `tsc --noEmit` sits in CI; [TSConfig: isolatedModules](https://www.typescriptlang.org/tsconfig/isolatedModules.html) (*headings only*) is the flag that keeps single-file tools safe.

### T00-11 · Project layout — Understand · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/11-project-layout.md`
- **Read this:** [What is a tsconfig.json](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) · typescriptlang.org · `include`/`exclude` examples and bases (*read*) · covers our angle: **partial** — no `outDir`/`rootDir` text, no publishing · fetched 2026-10-12
- **Also good:** [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) · typescriptlang.org · `rootDir` now defaults to `.`, so output can land in `./dist/src/index.js` (*read*); [5.9 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) cover the minimal `tsc --init` (*read*) · fetched 2026-10-12
- **Our delta:** why `outDir` and `include` fight, and what `npm publish` ships: not found on one page. [TSConfig: outDir](https://www.typescriptlang.org/tsconfig/outDir.html) and [rootDir](https://www.typescriptlang.org/tsconfig/rootDir.html) are short references (*headings only*).

### T00-12 · Release cadence and reading release notes — Know · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/12-release-cadence.md`
- **Read this:** [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) · Microsoft devblogs, 2026-03-23 · "last release based on the current JavaScript codebase"; section "Preparing for TypeScript 7.0" (*read*) · covers our angle: **partial** — the 6.0 to 7.0 step, not a cadence table · fetched 2026-10-12
- **Also good:** [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · Microsoft devblogs, 2026-07-08 · links the Beta and RC posts under "Read next" (*read*) · fetched 2026-10-12
- **Our delta:** the 5.x → 6.0 → 7.0 plan. The wiki iteration plans are on github.com (403 for us), so a month-by-month cadence is not confirmed.

### T00-13 · The Playground and `// @ts-check` on plain `.js` — Know · ✅ written `docs/typescript/pages/phase-0-how-typescript-runs/13-playground-and-ts-check.md`
- **Read this:** [JS Projects Utilizing TypeScript](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html) · typescriptlang.org · JSDoc type hints and the `@ts-check` heading: add it on the first line of a `.js` file (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Type Checking JavaScript Files](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html) · typescriptlang.org · how checking differs in `.js` files (*read* the opening); [TypeScript Playground](https://www.typescriptlang.org/play/) (*headings only*, an app) · fetched 2026-10-12
- **Our delta:** `checkJs` as the project-wide switch ([TSConfig: checkJs](https://www.typescriptlang.org/tsconfig/checkJs.html), *headings only*).

---

## Phase 1 — The type vocabulary

### T01-01 · Primitives and inference — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/01-primitives-and-inference.md`
- **Read this:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · primitives, annotations on variables, "types are inferred from the initializer" (*read*) · covers our angle: **partial** — `let` widening versus `const` is under Literal Inference · fetched 2026-10-12
- **Also good:** [How let and const Work In TypeScript](https://www.totaltypescript.com/let-and-const) · Matt Pocock, 2024-02-23 · `let albumGenre = "rock"` infers `string` and fails against a literal union (*read*) · fetched 2026-10-12
- **Our delta:** none beyond the syllabus.

### T01-02 · Literal types and `as const` — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/02-literal-types-and-as-const.md`
- **Read this:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · "Literal Types" and "Literal Inference"; `as const` converts the whole object to literals (*read*) · covers our angle: **partial** — no tuple or "where widening loses you" cases · fetched 2026-10-12
- **Also good:** ['as const' Annotations](https://www.totaltypescript.com/concepts/as-const) · Total TypeScript · deeply readonly, compile-time only, unlike `Object.freeze` which is top-level; arrays become readonly tuples (*read*) · fetched 2026-10-12
- **Our delta:** widening in function-argument position.

### T01-03 · Arrays and tuples — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/03-arrays-and-tuples.md`
- **Read this:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · "The Array Type", "The ReadonlyArray Type", "Tuple Types" with optional and rest elements (*read* the tuple passages) · covers our angle: **partial** — named tuple members not confirmed on this page · fetched 2026-10-12
- **Also good:** [`Array<T>` vs `T[]`: Which is better?](https://www.totaltypescript.com/array-types-in-typescript) · Matt Pocock, 2023-08-22 (updated 2025-01-14) · `keyof Person[]` is not `Array<keyof Person>`, otherwise the two forms are functionally identical (*read*) · fetched 2026-10-12
- **Our delta:** named tuple members.

### T01-04 · Object types — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/04-object-types.md`
- **Read this:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · optional and `readonly` properties, index signatures and the rule that all properties must match the index type (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Object Types](https://www.totaltypescript.com/concepts/object-types) · Total TypeScript · short concept page (*headings only*) · fetched 2026-10-12
- **Our delta:** what an index signature costs you under `noUncheckedIndexedAccess` (Phase 10).

### T01-05 · Union types — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/05-union-types.md`
- **Read this:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · "Defining a Union Type" and "Working with Union Types": only members common to every branch are usable until you narrow (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Union Types](https://www.totaltypescript.com/concepts/union-types) · Total TypeScript · examples including literal unions (*read*) · fetched 2026-10-12
- **Our delta:** none.

### T01-06 · `any` vs `unknown` vs `never` vs `void` — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/06-any-unknown-never-void.md`
- **Read this:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · section "Other Types to Know About": `void`, `object`, `unknown`, `never`, `Function` (*headings only*) · covers our angle: **partial** — `any` is covered in Everyday Types, not here · fetched 2026-10-12
- **Also good:** [The `any` type](https://www.totaltypescript.com/concepts/any-type) · Total TypeScript · `any` switches checking off; `unknown` needs a check first (*read*) · fetched 2026-10-12
- **Our delta:** one table for all four; no single page found that does.

### T01-07 · `type` vs `interface` — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/07-type-vs-interface.md`
- **Read this:** [Type vs Interface: Which Should You Use?](https://www.totaltypescript.com/type-vs-interface-which-should-you-use) · Matt Pocock, 2023-07-31 (updated 2023-12-18) · declaration merging, `extends` versus `&`, index signatures, and a default-to-`type` stance (*read* the summary) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · section "Differences Between Type Aliases and Interfaces" (*headings only*) · fetched 2026-10-12
- **Our delta:** the "defensible default" is opinion; the page should label it so.

### T01-08 · Function types — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/08-function-types.md`
- **Read this:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · function type expressions, optional parameters and callbacks, rest parameters (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Function types are weird in TypeScript](https://www.totaltypescript.com/function-types-are-weird-in-typescript) · Matt Pocock, 2023-04-11 · fewer-parameter functions are assignable (*headings only*) · fetched 2026-10-12
- **Our delta:** none.

### T01-09 · Structural typing — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/09-structural-typing.md`
- **Read this:** [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) · typescriptlang.org · "based on structural subtyping", contrasted with nominal typing (*read* the opening) · covers our angle: **partial** — excess property checks live on the Object Types page · fetched 2026-10-12
- **Also good:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · "Excess Property Checks", and the workaround of assigning to a variable first (*read*) · fetched 2026-10-12
- **Our delta:** why a literal errors while the same value in a variable passes.

### T01-10 · `null` and `undefined` under `strictNullChecks` — Master · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/10-null-and-undefined.md`
- **Read this:** [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · typescriptlang.org · "null and undefined" with `strictNullChecks` off and on (*headings only*) · covers our angle: **partial** — optional property versus `| undefined` not confirmed · fetched 2026-10-12
- **Also good:** [TSConfig: strictNullChecks](https://www.typescriptlang.org/tsconfig/strictNullChecks.html) · typescriptlang.org · the flag reference (*headings only*); [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html) for the absent-versus-undefined split · fetched 2026-10-12
- **Our delta:** optional versus `| undefined`.

### T01-11 · Intersection types — Understand · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/11-intersection-types.md`
- **Read this:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · "Intersection Types" and "Interface Extension vs. Intersection" (*headings only*) · covers our angle: **partial** — conflicting members and `never` not confirmed · fetched 2026-10-12
- **Also good:** none beyond the above; the Total TypeScript type-vs-interface article touches `extends` versus `&` (*read*).
- **Our delta:** impossible intersections collapsing to `never`.

### T01-12 · Call signatures, construct signatures and overloads — Understand · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/12-call-and-construct-signatures.md`
- **Read this:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · "Call Signatures", "Construct Signatures", "Function Overloads", "Overload Signatures and the Implementation Signature", "Writing Good Overloads" (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found that adds to it.
- **Our delta:** none.

### T01-13 · `enum` vs union of literals vs `const` object — Understand · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/13-enum-vs-union.md`
- **Read this:** [Enums](https://www.typescriptlang.org/docs/handbook/enums.html) · typescriptlang.org · runtime shape, reverse mappings (string members get none), `const enum` inlined, and "Objects vs Enums" with `as const` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Why I Don't Like Enums](https://www.totaltypescript.com/why-i-dont-like-typescript-enums) · Matt Pocock, 2024-08-14 · numeric enums give 6 keys for 3 members; nominal-typing complaint (*read*) · fetched 2026-10-12
- **Our delta:** the migration target. *Checked, not chosen:* Total TypeScript `concepts/enums` (sections say "under construction").

### T01-14 · `readonly` arrays and tuples — Understand · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/14-readonly-and-immutability.md`
- **Read this:** [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) · typescriptlang.org · "The ReadonlyArray Type" and "readonly Tuple Types"; error 4104 when assigning `readonly string[]` to a mutable type (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** ['as const' Annotations](https://www.totaltypescript.com/concepts/as-const) · Total TypeScript · `as const` on arrays gives readonly tuples (*read*) · fetched 2026-10-12
- **Our delta:** none.

### T01-15 · Recursive type aliases — Understand · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/15-recursive-types.md`
- **Read this:** [TypeScript 3.7 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html) · typescriptlang.org · "(More) Recursive Type Aliases": the `Json` type and `VirtualNode` tuple examples (*read*) · covers our angle: **partial** — the depth limit is not on it · fetched 2026-10-12
- **Also good:** none found for the depth limit.
- **Our delta:** the depth limit and the error you meet at it.

### T01-16 · `object` vs `Object` vs `{}` — Know · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/16-object-Object-braces.md`
- **Read this:** [The Empty Object Type in TypeScript](https://www.totaltypescript.com/the-empty-object-type-in-typescript) · Matt Pocock, 2023-06-20 (updated 2024-04-02) · `{}` accepts everything except `null` and `undefined`; suggests `Record<string, never>` for an empty object (*read*) · covers our angle: **partial** — the capital-`Object` case not confirmed · fetched 2026-10-12
- **Also good:** [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) · typescriptlang.org · the `object` heading under "Other Types to Know About" (*headings only*) · fetched 2026-10-12
- **Our delta:** `Object`.

### T01-17 · `symbol` and `unique symbol` — Know · ✅ written `docs/typescript/pages/phase-1-type-vocabulary/17-symbols.md`
- **Read this:** [Symbols](https://www.typescriptlang.org/docs/handbook/symbols.html) · typescriptlang.org · `unique symbol` is a subtype of `symbol`, only allowed on `const` declarations and readonly static properties (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** none found.
- **Our delta:** none.
