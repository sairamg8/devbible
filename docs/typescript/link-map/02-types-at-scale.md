---
title: "Link map · TypeScript · Part 2 (phases 4–6)"
sidebar_label: "02 · Types at scale"
sidebar_position: 3
---

# Link map · TypeScript · Part 2 (phases 4–6)

Covers every topic row of `docs/typescript/syllabus/02-types-at-scale.md`: T04-01 to T04-14 (classes and declaration merging), T05-01 to T05-16 (type-level programming), T06-01 to T06-16 (modules, declarations and the build). That is 46 rows, matching the syllabus header. All 46 have a page of ours (✅); folder topics point at their `README.md`.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. `#anchors` appear only where the id was seen in the page HTML.

🔴 **Version note.** Our syllabus targets **TypeScript 7.0.2** (the native port). npm on 2026-10-12: `latest` 7.0.2, `rc` 7.0.1-rc, `next` 7.1.0-dev, `beta` 6.0.0-beta. The handbook at typescriptlang.org lists "What's New" up to **6.0** and has no 7.0 page that I saw, so 7.0 release notes are not confirmed there. The 6.0 notes (read) say 6.0 is a transition release: it deprecates `moduleResolution node` (node10), `baseUrl`, `classic`, `esModuleInterop: false`, and `amd`/`umd`/`systemjs` module values; sets `types` to `[]` and `rootDir` to `.` by default; and says deprecated options are removed in 7.0. Type-system pages below (classes, mapped, conditional) are unaffected; Phase 6 blocks note where 6.0/7.0 matters. `github.com` returns 403 to our fetcher, so GitHub-hosted docs are cited as `raw.githubusercontent.com`. `tsgo.dev` did not respond.

---

## Phase 4 — Classes, objects and declaration merging

### T04-01 · Module augmentation — `declare module` — Master · ✅ written `docs/typescript/pages/phase-4-classes-declarations/01-module-augmentation/README.md`
- **Read this:** [Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation) · typescriptlang.org · the `Observable` example: import, then `declare module "./observable"` with an interface to add `map` (*read*); states two limits: no new top-level declarations in an augmentation, and default exports cannot be augmented · covers our angle: **partial** — no `Express.Request` or `req.user` case, nothing on why the file must be included · fetched 2026-10-12
- **Our delta:** the `req.user` end-to-end case, and the "file is not in `include`" failure mode.

### T04-02 · Access modifiers — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/02-access-modifiers/README.md`
- **Read this:** [Classes → Member Visibility](https://www.typescriptlang.org/docs/handbook/2/classes.html#member-visibility) · typescriptlang.org · `public`/`protected`/`private`, cross-instance private access allowed, caveat that they are enforced only during type checking (*read*) · covers our angle: **partial** — its Caveats section does say `#` private fields stay private after compilation (*read*), but there is no "when the difference matters" decision guide · fetched 2026-10-12
- **Our delta:** soft vs hard private decision table, and bracket-notation escape.

### T04-03 · Parameter properties — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/03-parameter-properties.md`
- **Read this:** [Classes → Parameter Properties](https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties) · typescriptlang.org · a constructor argument prefixed with `public`/`private`/`protected`/`readonly` becomes a field (*read*) · covers our angle: **partial** — does not say they emit code · fetched 2026-10-12
- **Also good:** [Node.js — Running TypeScript natively](https://nodejs.org/api/typescript.html) · nodejs.org · lists parameter properties among syntax that needs transformation and fails in strip-only mode (*read*) · fetched 2026-10-12
- **Our delta:** the strip-only failure and the `erasableSyntaxOnly` fix.

### T04-04 · `implements` vs `extends` — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/04-implements-vs-extends.md`
- **Read this:** [Classes → Class Heritage](https://www.typescriptlang.org/docs/handbook/2/classes.html#class-heritage) · typescriptlang.org · `implements` checks a class satisfies an interface; `extends` inherits; its Cautions say `implements` is only a check and does not change the class type (*read*) · covers our angle: **full** for the contract-versus-inheritance split · fetched 2026-10-12
- **Our delta:** why `implements` alone does not infer member types.

### T04-05 · Interface declaration merging — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/05-interface-declaration-merging/README.md`
- **Read this:** [Declaration Merging → Merging Interfaces](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces) · typescriptlang.org · same-name interfaces combine; lists disallowed merges (classes cannot merge with classes or variables) (*read*) · covers our angle: **partial** — no accident catalogue, nothing on `type` lacking merging · fetched 2026-10-12
- **Our delta:** the accidents (a name clash with a global interface silently merging).

### T04-06 · Global augmentation — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/06-global-augmentation.md`
- **Read this:** [Declaration Merging → Global augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#global-augmentation) · typescriptlang.org · `declare global` written from inside a module, with the `Array` example (*read*) · covers our angle: **partial** — `globalThis` keys not shown · fetched 2026-10-12
- **Our delta:** `var` for `globalThis` keys, and what happens in a non-module file.

### T04-07 · Branded / nominal types — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/07-branded-nominal-types.md`
- **Read this:** [Branded Types](https://www.learningtypescript.com/articles/branded-types) · Learning TypeScript (Josh Goldberg) · 2024-08-15 · why structure lets values mix, how to brand, and `as`, type predicates and assertion functions to create branded values (*read* headings and intro) · covers our angle: **full** · fetched 2026-10-12
- **Our delta:** `unique symbol` brand spelling used in the syllabus row, and `UserId`/`PostId` for ids.

### T04-08 · `readonly` members and definite assignment `!:` — Understand · ✅ written `docs/typescript/pages/phase-4-classes-declarations/08-readonly-and-definite-assignment.md`
- **Read this:** [Classes → Fields](https://www.typescriptlang.org/docs/handbook/2/classes.html#fields) · typescriptlang.org · `strictPropertyInitialization`, error 2564, the definite assignment assertion `name!: string`, and `readonly` fields assignable only in the constructor (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Our delta:** what each promise actually guarantees at runtime (nothing for `!:`).

### T04-09 · Typing getters and setters — Know · ✅ written `docs/typescript/pages/phase-4-classes-declarations/09-typing-getters-and-setters.md`
- **Read this:** [TypeScript 5.1 → Unrelated Types for Getters and Setters](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-1.html) · typescriptlang.org · says 4.3 allowed a getter and setter to have different types, with a `Serializer` example (*read*); what 5.1 itself changed is not confirmed from the passage I read · covers our angle: **partial** — validation on write is not covered · fetched 2026-10-12
- **Also good:** [Classes → Getters / Setters](https://www.typescriptlang.org/docs/handbook/2/classes.html#getters--setters) · typescriptlang.org · accessor basics (*read*) · fetched 2026-10-12
- **Our delta:** validation on write.

### T04-10 · `this` types and polymorphic `this` — Know · ✅ written `docs/typescript/pages/phase-4-classes-declarations/10-this-types.md`
- **Read this:** [Classes → this Types](https://www.typescriptlang.org/docs/handbook/2/classes.html#this-types) · typescriptlang.org · `this` as a type referring dynamically to the current class, with the `Box.set` example (*read*) · covers our angle: **partial** — shows `set` returning the subclass type once (`ClearableBox`); a longer fluent builder chain is for our page · fetched 2026-10-12
- **Our delta:** subclass type kept through a chain.

### T04-11 · Abstract classes and abstract construct signatures — Know · ✅ written `docs/typescript/pages/phase-4-classes-declarations/11-abstract-classes.md`
- **Read this:** [Classes → abstract Classes and Members](https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-classes-and-members) · typescriptlang.org · abstract members, error 2515, and the "Abstract Construct Signatures" subsection on accepting a constructor of an abstract-derived class (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Our delta:** `new (...args) => T` shapes for factories.

### T04-12 · Static members, static blocks and the static side — Know · ✅ written `docs/typescript/pages/phase-4-classes-declarations/12-static-members-and-the-static-side.md`
- **Read this:** [Classes → Static Members](https://www.typescriptlang.org/docs/handbook/2/classes.html#static-members) · typescriptlang.org · static members, special static names, `static` blocks with access to private fields (*read*) · covers our angle: **partial** — the instance type vs constructor type split is mostly under "Constructor Signatures" (*headings only*) · fetched 2026-10-12
- **Our delta:** `typeof Class` as the static-side type.

### T04-13 · Decorators (stage 3) — Know · ✅ written `docs/typescript/pages/phase-4-classes-declarations/13-decorators.md`
- **Read this:** [TypeScript 5.0 → Decorators](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html) · typescriptlang.org · standard decorators valid without a flag; `--experimentalDecorators` remains "for the foreseeable future" and is type-checked and emitted differently (*read*) · covers our angle: **partial** — NestJS/TypeORM context absent · fetched 2026-10-12
- **Also good:** [Decorators (experimental)](https://www.typescriptlang.org/docs/handbook/decorators.html) · typescriptlang.org · carries a note that it describes the experimental stage 2 implementation (*read* the note) · fetched 2026-10-12
- **Our delta:** which framework still needs the old flag.

### T04-14 · Mixins — When Needed · ✅ written `docs/typescript/pages/phase-4-classes-declarations/14-mixins/README.md`
- **Read this:** [Mixins](https://www.typescriptlang.org/docs/handbook/mixins.html) · typescriptlang.org · constructor-returning-class pattern, constrained mixins, alternative pattern, constraints (*headings only*) · covers our angle: **partial** — the type cost is for our page · fetched 2026-10-12
- **Our delta:** the build and declaration-emit cost of mixins.

---

## Phase 5 — Type-level programming

### T05-01 · Mapped types — Master · ✅ written `docs/typescript/pages/phase-5-type-level/01-mapped-types/README.md`
- **Read this:** [Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) · typescriptlang.org · key loop, and adding/removing `readonly` and `?` by prefixing `-` or `+` (*read* Mapping Modifiers) · covers our angle: **partial** — writing your own `Partial` is for our page · fetched 2026-10-12
- **Our delta:** rebuilding `Partial` from an empty file.

### T05-02 · Conditional types — Master · ✅ written `docs/typescript/pages/phase-5-type-level/02-conditional-types/README.md`
- **Read this:** [Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) · typescriptlang.org · `T extends U ? X : Y`, constraints, `infer`, distribution (*headings only* plus the distribution and `infer` passages *read*) · covers our angle: **partial** — nesting readably is for our page · fetched 2026-10-12
- **Our delta:** the assignability question, and nesting.

### T05-03 · The built-in utility types — Master · ✅ written `docs/typescript/pages/phase-5-type-level/03-utility-types/README.md`
- **Read this:** [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html) · typescriptlang.org · one section per utility, `Partial` through `NoInfer`, plus `Awaited` and the string types (*headings only*) · covers our angle: **partial** — does not sort them into mapped vs conditional · fetched 2026-10-12
- **Our delta:** which are mapped, which conditional, and writing the missing one.

### T05-04 · Key remapping — `as` in a mapped type — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/04-key-remapping.md`
- **Read this:** [Mapped Types → Key Remapping via as](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as) · typescriptlang.org · rename keys with template literals and `Capitalize`, and filter keys out by producing `never` via `Exclude` (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [TypeScript 4.1 → Key Remapping in Mapped Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#key-remapping-in-mapped-types) · typescriptlang.org · the introduction of `as` (*headings only*) · fetched 2026-10-12

### T05-05 · Distributive conditional types — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/05-distributive-conditionals.md`
- **Read this:** [Conditional Types → Distributive Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types) · typescriptlang.org · `ToArray` over a union, and the `ToArrayNonDist` version that wraps both sides in brackets (*read*) · covers our angle: **full** · fetched 2026-10-12

### T05-06 · Extracting with `infer` — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/06-infer/README.md`
- **Read this:** [Conditional Types → Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types) · typescriptlang.org · `infer` to pull out a type, with `ReturnType` as the example (*read*) · covers our angle: **partial** — `Parameters`, `Awaited`, `InstanceType` are on the utility page · fetched 2026-10-12
- **Also good:** [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html) · typescriptlang.org · `ReturnType`, `Parameters`, `InstanceType`, `Awaited` (*headings only*) · fetched 2026-10-12

### T05-07 · Template literal types — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/07-template-literal-types.md`
- **Read this:** [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html) · typescriptlang.org · string unions in types, inference with template literals, `Uppercase`/`Lowercase`/`Capitalize`/`Uncapitalize` (*headings only*) · covers our angle: **full** (route strings and event names are examples for our page) · fetched 2026-10-12

### T05-08 · Knowing when to stop — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/08-knowing-when-to-stop/README.md`
- **Read this:** [Hyper-Typing](https://pscanf.com/s/341/) · pscanf.com (Paolo Scanferla) · 2025-05-05 · argues libraries chasing perfect safety end up with hard-to-understand types and cryptic errors, with a TanStack Form example and a "happy medium" section (*read* intro and headings) · covers our angle: **partial** — an opinion piece, no readability test · fetched 2026-10-12
- *Checked, not chosen:* no official page states the "delete the type if the error is worse" rule; searches for TypeScript docs on it returned only opinion pieces.
- **Our delta:** the readability test itself.

### T05-09 · Type-level performance — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/09-type-level-performance/README.md`
- **Read this:** [Performance (TypeScript wiki, raw)](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/Performance.md) · github (raw) · "Writing Easy-to-Compile Code" (interfaces over intersections, annotations, naming complex types), `extendedDiagnostics`, performance tracing (*headings only*, with the incremental section read) · covers our angle: **partial** — no `TS2589` explanation · fetched 2026-10-12
- **Also good:** [Dealing with the "excessively deep" error](https://kysely.dev/docs/recipes/excessively-deep-types) · Kysely docs · shows `error TS2589` in a library and a fix by asserting a simpler output type (*read*) · fetched 2026-10-12
- **Our delta:** the three budgets and the fixes in order.

### T05-10 · Deriving one function's type from another — Understand · ✅ written `docs/typescript/pages/phase-5-type-level/10-deriving-function-types/README.md`
- **Read this:** [Utility Types → Parameters](https://www.typescriptlang.org/docs/handbook/utility-types.html#parameterstype) · typescriptlang.org · `Parameters<Type>` and `ReturnType<Type>` examples (*headings only*) · covers our angle: **partial** — wrapper, decorator and adapter patterns are for our page · fetched 2026-10-12
- **Our delta:** what the derived signature loses (overloads, generics).

### T05-11 · Recursive types — Know · ✅ written `docs/typescript/pages/phase-5-type-level/11-recursive-types/README.md`
- **Read this:** [TypeScript 4.5 → Tail-Recursion Elimination on Conditional Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html#tail-recursion-elimination-on-conditional-types) · typescriptlang.org · says TypeScript has heuristics so it does not go off the rails on infinitely deep types, then presents tail-recursion elimination (*read* the opening only) · covers our angle: **partial** — exact limits are version-specific; not confirmed for 7.0 · fetched 2026-10-12
- **Also good:** [TypeScript 4.1 → Recursive Conditional Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#recursive-conditional-types) · typescriptlang.org · the `Awaited`-style unwrap motivation (*read* the opening) · fetched 2026-10-12
- **Our delta:** the accumulator pattern and the two limits, to be re-measured on 7.0.2.

### T05-12 · `DeepPartial` / `DeepReadonly` — Know · ✅ written `docs/typescript/pages/phase-5-type-level/12-deep-helpers/README.md`
- **Read this:** [type-fest `PartialDeep` source (raw)](https://raw.githubusercontent.com/sindresorhus/type-fest/main/source/partial-deep.d.ts) · github (raw) · a maintained deep helper with `recurseIntoArrays` and `allowUndefinedInNonTupleArrays` options, which shows what a naive version leaves out (*read* the doc comments) · covers our angle: **partial** — a source file, no discussion of error messages or IDE cost · fetched 2026-10-12
- **Our delta:** why they wreck error messages in large shapes; `Partial` is not `Readonly`.

### T05-13 · Tuple manipulation — Know · ✅ written `docs/typescript/pages/phase-5-type-level/13-tuple-manipulation/README.md`
- **Read this:** [TypeScript 4.0 → Variadic Tuple Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html#variadic-tuple-types) · typescriptlang.org · spreading generic tuples, a `tail`-style signature, and the `partialCall` example (*read*) · covers our angle: **partial** — length and curry types are for our page · fetched 2026-10-12
- *Checked, not chosen:* [How to master advanced TypeScript patterns](https://www.freecodecamp.org/news/typescript-curry-ramda-types-f747e99744ab/) · freeCodeCamp · 2019-02-27 · builds `Head`, `Tail` and `Curry` but predates TS 4.0 variadic tuples (headings only).
- **Our delta:** typing `bind` and `curry`.

### T05-14 · `NoInfer<T>` — Know · ✅ written `docs/typescript/pages/phase-5-type-level/14-noinfer.md`
- **Read this:** [TypeScript 5.4 → The NoInfer Utility Type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html) · typescriptlang.org · the `createStreetLight` example and the note that a type parameter used once is a code smell (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [Utility Types → NoInfer](https://www.typescriptlang.org/docs/handbook/utility-types.html#noinfertype) · typescriptlang.org · reference entry (*headings only*) · fetched 2026-10-12

### T05-15 · Union → intersection and other identities — Know · ✅ written `docs/typescript/pages/phase-5-type-level/15-union-to-intersection.md`
- **Read this:** [TypeScript: Union to intersection type](https://oida.dev/typescript-union-to-intersection/) · oida.dev (Stefan Baumgartner) · 2020-06-29 · the naked type parameter, wrapping in a function to reach a contra-variant position, then `infer` (*read*) · covers our angle: **full** for union → intersection; **partial** for "other identities" · fetched 2026-10-12

### T05-16 · Higher-kinded types — When Needed · ✅ written `docs/typescript/pages/phase-5-type-level/16-higher-kinded-types.md`
- **Read this:** [Encoding HKTs in TS4.1](https://dev.to/effect/encoding-hkts-in-ts4-1-1fn2) · DEV (Effect/Matechs) · 2020-10-01 · the `URItoKind` interface maps filled in through module augmentation, as fp-ts does (*read* that passage) · covers our angle: **full** for the interface-map workaround; written for TS 4.1, **not confirmed** against 7.x · fetched 2026-10-12
- **Our delta:** what TypeScript cannot express, and when to stop at it.

---

## Phase 6 — Modules, declarations and the build

### T06-01 · `module` and `moduleResolution` — Master · ✅ written `docs/typescript/pages/phase-6-modules-build/01-module-and-moduleresolution/README.md`
- **Read this:** [Modules — Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html) · typescriptlang.org · per-situation settings: bundler, compiled for Node, `ts-node`, `tsx`, browser, library; dual-emit notes (*headings only*, `tsx` and library passages *read*) · covers our angle: **partial** — failure messages per setting are for our page · fetched 2026-10-12
- **Also good:** [Modules — Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) · typescriptlang.org · every `module` and `moduleResolution` value, including `node16`/`nodenext`, `bundler`, `node10` (*headings only*) · fetched 2026-10-12
- **Our delta:** 🔴 6.0 notes (read) deprecate `node10` and `classic`; 7.0 removes them, so the legacy column is history, not a choice.

### T06-02 · `import type` / `export type` and `verbatimModuleSyntax` — Master · ✅ written `docs/typescript/pages/phase-6-modules-build/02-import-type-and-verbatim-module-syntax/README.md`
- **Read this:** [TSConfig: verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) · typescriptlang.org · explains import elision first, then the flag (*read* the opening only) · covers our angle: **partial** — the lost side-effect incident is for our page · fetched 2026-10-12
- **Also good:** [Modules — Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) · typescriptlang.org · "Type-only imports and exports" section (*headings only*) · fetched 2026-10-12

### T06-03 · Path aliases — `paths` — Master · ✅ written `docs/typescript/pages/phase-6-modules-build/03-path-aliases/README.md`
- **Read this:** [TSConfig: paths](https://www.typescriptlang.org/tsconfig/paths.html) · typescriptlang.org · states it does not change how import paths are emitted, so another tool must apply the mapping at runtime or bundling (*read*) · covers our angle: **full** for the trap; **partial** for the fix · fetched 2026-10-12
- **Also good:** [Node.js — Packages](https://nodejs.org/api/packages.html) · nodejs.org · a "Subpath imports" section, the runtime-side answer (*headings only*) · fetched 2026-10-12
- **Our delta:** 🔴 6.0 deprecates `baseUrl`; also `#/` subpath imports arrive in 6.0 (headings seen). Details not confirmed beyond headings.

### T06-04 · `lib`, `target` and the ambient environment — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/04-lib-target-ambient/README.md`
- **Read this:** [TSConfig: lib](https://www.typescriptlang.org/tsconfig/lib.html) · typescriptlang.org · default libs follow `target`; reasons to change them include dropping `dom` for non-browser programs and polyfilled APIs (*read*) · covers our angle: **partial** — no `@types/node` or `structuredClone` case · fetched 2026-10-12
- **Also good:** [TypeScript 6.0 → `types` now defaults to `[]`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html#types-now-defaults-to-) · typescriptlang.org · the default for global packages changed (*read* the opening) · fetched 2026-10-12
- **Our delta:** 🔴 with `types` defaulting to `[]` in 6.0, ambient `@types/*` globals are no longer pulled in automatically; the exact `@types/node` consequence is not confirmed.

### T06-05 · `isolatedModules` — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/05-isolatedmodules/README.md`
- **Read this:** [TSConfig: isolatedModules](https://www.typescriptlang.org/tsconfig/isolatedModules.html) · typescriptlang.org · why single-file transpilers such as Babel need it, (*read* the lead) · covers our angle: **partial** — the exact list of three bans is for our page · fetched 2026-10-12

### T06-06 · File extensions — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/06-file-extensions/README.md`
- **Read this:** [TypeScript 5.7 → Path Rewriting for Relative Paths](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#path-rewriting-for-relative-paths) · typescriptlang.org · `rewriteRelativeImportExtensions` rewrites relative `.ts`, `.tsx`, `.mts`, `.cts` paths to their JS extensions (*read*) · covers our angle: **partial** — `.d.ts`/`.mts`/`.cts` table is on the Modules reference · fetched 2026-10-12
- **Also good:** [TSConfig: allowImportingTsExtensions](https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html) · typescriptlang.org · reference entry (*headings only*) · fetched 2026-10-12

### T06-07 · Authoring `.d.ts` files — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/07-authoring-d-ts-files/README.md`
- **Read this:** [Declaration Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/by-example.html) · typescriptlang.org · declaring objects, overloads, interfaces, classes, globals by example (*headings only*) · covers our angle: **partial** — "when you should" is for our page · fetched 2026-10-12
- **Also good:** [Declaration Files: Deep Dive](https://www.typescriptlang.org/docs/handbook/declaration-files/deep-dive.html) · typescriptlang.org · types, values, namespaces and their combinations (*headings only*) · fetched 2026-10-12

### T06-08 · Typing an untyped dependency — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/08-typing-an-untyped-dependency/README.md`
- **Read this:** [Modules — Reference → Ambient modules](https://www.typescriptlang.org/docs/handbook/modules/reference.html#ambient-modules) · typescriptlang.org · `declare module` for a module with no file, and wildcard names (*read*) · covers our angle: **partial** — no shim-then-upstream workflow · fetched 2026-10-12
- **Also good:** [Declaration Files: Consumption](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html) · typescriptlang.org · downloading `@types` packages, and that a package shipping its own types needs none (*read*) · fetched 2026-10-12

### T06-09 · `esModuleInterop` and default imports — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/09-esmoduleinterop-and-default-imports/README.md`
- **Read this:** [Modules — ESM/CJS Interoperability](https://www.typescriptlang.org/docs/handbook/modules/appendices/esm-cjs-interop.html) · typescriptlang.org · `import *` transpiling to `require`, the spec problem, then `allowSyntheticDefaultImports` and `esModuleInterop`, and the "double default" problem in Node (*read* the opening) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [TSConfig: esModuleInterop](https://www.typescriptlang.org/tsconfig/esModuleInterop.html) · typescriptlang.org · by default CommonJS/AMD/UMD modules are treated like ES6 modules; the flag changes that (*read* the lead) · fetched 2026-10-12
- **Our delta:** 🔴 6.0 no longer lets `esModuleInterop` be false (read).

### T06-10 · `skipLibCheck` — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/10-skiplibcheck/README.md`
- **Read this:** [TSConfig: skipLibCheck](https://www.typescriptlang.org/tsconfig/skipLibCheck.html) · typescriptlang.org · skips checking declaration files, trading time for accuracy (*read* the lead) · covers our angle: **partial** — which errors you stop seeing is for our page · fetched 2026-10-12

### T06-11 · Publishing a typed package — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/11-publishing-a-typed-package/README.md`
- **Read this:** [Declaration Files: Publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html) · typescriptlang.org · including declarations, dependencies, red flags, `typesVersions` (*headings only*, `typesVersions` passage *read*) · covers our angle: **partial** — no `exports` conditions or dual ESM/CJS · fetched 2026-10-12
- **Also good:** [publint rules](https://publint.dev/rules) · publint.dev · the `EXPORTS_TYPES_INVALID_FORMAT` rule says `.d.ts` follows the ESM/CJS context since TS 5.0 (*read*); [Masquerading as CJS](https://raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/docs/problems/FalseCJS.md) · arethetypeswrong (raw) · a `.d.ts` read as CJS while the JS is ESM (*read* the explanation) · fetched 2026-10-12
- *Not opened:* [arethetypeswrong.github.io](https://arethetypeswrong.github.io/) (30 words in HTML; an app).

### T06-12 · Sharing types across a monorepo — Understand · ✅ written `docs/typescript/pages/phase-6-modules-build/12-sharing-types-across-a-monorepo/README.md`
- **Read this:** [You might not need TypeScript project references](https://turborepo.dev/blog/you-might-not-need-typescript-project-references) · Turborepo blog (Jared Palmer; no date seen) · "internal packages" import source directly, with caveats (*read* the caveats) · covers our angle: **partial** — the built-`.d.ts` route is on the guide below · fetched 2026-10-12
- **Also good:** [Turborepo — TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript) · turborepo.dev · compiled packages, go-to-definition across packages, subpath imports over `paths` (*headings only*) · fetched 2026-10-12

### T06-13 · Project references and `tsc -b` — Know · ✅ written `docs/typescript/pages/phase-6-modules-build/13-project-references/README.md`
- **Read this:** [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html) · typescriptlang.org · `composite`, `declarationMap`, build mode `tsc -b`, caveats, guidance (*headings only*) · covers our angle: **full** (the "when you do not need them" side is in the Turborepo post under T06-12) · fetched 2026-10-12
- **Also good:** [TSConfig: composite](https://www.typescriptlang.org/tsconfig/composite.html) · typescriptlang.org · constraints `composite` enforces for `--build` (*read* the lead) · fetched 2026-10-12

### T06-14 · Incremental builds — Know · ✅ written `docs/typescript/pages/phase-6-modules-build/14-incremental-builds/README.md`
- **Read this:** [TSConfig: incremental](https://www.typescriptlang.org/tsconfig/incremental.html) · typescriptlang.org · `.tsbuildinfo` files hold the project graph, are not used at runtime and can be deleted (*read*) · covers our angle: **partial** — no invalidation or CI cache advice · fetched 2026-10-12
- **Also good:** [Performance (TypeScript wiki, raw)](https://raw.githubusercontent.com/wiki/microsoft/TypeScript/Performance.md) · github (raw) · "Incremental Project Emit" section (*read*) · fetched 2026-10-12
- **Our delta:** what invalidates the file, and caching it in CI. None found for the CI part.

### T06-15 · `isolatedDeclarations` — Know · ✅ written `docs/typescript/pages/phase-6-modules-build/15-isolateddeclarations/README.md`
- **Read this:** [TypeScript 5.5 → Isolated Declarations](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html) · typescriptlang.org · errors when exports are not annotated enough for other tools to emit declarations without a type-checker (*read*) · covers our angle: **partial** — build-speed numbers not given · fetched 2026-10-12
- **Also good:** [TSConfig: isolatedDeclarations](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html) · typescriptlang.org · one-line reference (*read*) · fetched 2026-10-12

### T06-16 · Typing non-code imports — Know · ✅ written `docs/typescript/pages/phase-6-modules-build/16-typing-non-code-imports/README.md`
- **Read this:** [Vite — Features → Client Types](https://vite.dev/guide/features#client-types) · vite.dev · add `vite/client` to `compilerOptions.types`; only listed packages become global; recommended since TS 5.9 (*read*) · covers our angle: **partial** — Vite-specific; no `resolveJsonModule` · fetched 2026-10-12
- **Also good:** [Assets and Module Declarations](https://stevekinney.com/courses/react-typescript/assets-and-module-declarations) · Steve Kinney · modified 2025-09-06 · CSS, SVG, fonts via module declarations (*headings only*); [TSConfig: resolveJsonModule](https://www.typescriptlang.org/tsconfig/resolveJsonModule.html) · typescriptlang.org (*headings only*) · fetched 2026-10-12
