---
title: "Standalone is not a feature you turn on — it is what a component is in Angular 22, and `imports` is the whole of a component's template scope"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Using components](https://angular.dev/guide/components),
> [NgModules overview](https://angular.dev/guide/ngmodules/overview),
> [`bootstrapApplication`](https://angular.dev/api/platform-browser/bootstrapApplication),
> [Standalone migration](https://angular.dev/reference/migrations/standalone); the
> [v19.0.0 CHANGELOG](https://github.com/angular/angular/blob/19.0.x/CHANGELOG.md) and
> [v22.0.0 release notes](https://github.com/angular/angular/releases/tag/v22.0.0); and the
> published `@angular/core` / `@angular/platform-browser` **22.1.5** type definitions plus
> `@schematics/angular` **22.1.7** file templates.
> Version spine: `@angular/cli` **22.1.7** · TypeScript `>=6.0 <6.1` · Node
> `^22.22.3 || ^24.15.0 || >=26.0.0`. Documentation-validated; **no sandbox run**.

**An Angular 22 application has no `NgModule` in it. `main.ts` calls
`bootstrapApplication(App, appConfig)`, every component declares its own template
dependencies in an `imports` array, and the word `standalone` does not appear in generated
code at all — because it is the default and has been since v19.0.0. That is not a cosmetic
tidy-up. `NgModule` gave a component a *transitive, ambient* compilation scope: whatever
the module imported, every component declared in it could use, whether or not it said so.
`imports` gives a component a *local, explicit, statically analysable* scope. Locality is
the property that makes `@defer` able to split a bundle, makes incremental compilation
possible, and turns "which component uses this directive?" from a whole-graph question into
a one-file question. This topic is the mechanism, the exact version history — because
readers arrive from v14, v19 and v20+ and each saw a different default — the errors you
actually hit, the migration, and the honest boundary where `NgModule` still exists.**

## Chunks

| # | pos | Chunk | Covers |
|---|---:|---|---|
| 1 | 1 | **[`bootstrapApplication`, line by line](01-bootstrapapplication-line-by-line.md)** | The three-argument signature, what it merges in place of `BrowserModule`, why it returns a `Promise`, NG0907 and NG0906 |
| 2 | 2 | **[The `NgModule` bootstrap it replaced](01b-the-ngmodule-bootstrap-it-replaced.md)** | The legacy pair `ng new --standalone=false` still generates, the six-row substitution table, NG5100 and NG6009 |
| 3 | 3 | **[Which version changed what](03-standalone-by-default-which-version-changed-what.md)** | 🔴 v14 developer preview, v15 supported, **v19.0.0 flipped the default and stripped the flag**, and the compiler code that reads your `@angular/core` version to decide |
| 4 | 4 | **[What `imports` actually means](04-what-imports-actually-means.md)** | The per-component template dependency list, its exact type, and why it is never inherited |
| 4b | 4.1 | **[What goes in the array](04b-what-goes-in-the-imports-array.md)** | Five kinds of entry; an imported `NgModule` hands you its `exports` and nothing it merely declares |
| 4c | 4.2 | **[What the compiler does with it](04c-what-the-compiler-does-with-the-array.md)** | The array is read without ever being run, and it does two jobs beyond naming template dependencies |
| 4d | 4.3 | **[The ambient scope it replaced](04d-the-ambient-ngmodule-scope-it-replaced.md)** | Why moving a file could break a template that had compiled for a year |
| 5 | 5 | **[Unused imports and the compiler diagnostics](05-unused-imports-and-the-compiler-diagnostics.md)** | 🔴 NG8113 is a **warning**, not an error, and it asks only two questions — so an `NgModule` is invisible to it by construction |
| 5b | 5.1 | **[The two cases where NG8113 is silent](05b-the-two-cases-where-ng8113-is-silent.md)** | A shared array is exempted by whether it is `export`ed; a symbol used only inside `@defer` counts as used |
| 5c | 5.2 | **[What a stale import costs, and the cleanup](05c-what-a-stale-import-costs-and-the-cleanup-schematics.md)** | 🔴 The entry NG8113 *cannot* see is the only one that actually costs you a chunk boundary; `cleanup-unused-imports` |
| 5d | 5.3 | **[The errors that reject an import](05d-the-errors-that-reject-an-import-outright.md)** | NG2010, NG2011, NG2012 — none configurable, each raised from a different file |
| 6 | 6 | **[`'x' is not a known element`](06-not-a-known-element.md)** | Four different errors wearing one sentence; the compile-time pair NG8001 and NG8002 read line by line |
| 6b | 6.1 | **[Compile time vs runtime](06b-runtime-detection.md)** | NG0304 and NG0303 exist only in JIT code and log instead of throwing — which is why the browser stays quiet and the test fails |
| 6c | 6.2 | **[The five causes (1–3)](06c-the-five-causes.md)** | A missing import, a mismatched selector, and a class nothing can reach — all free to rule out |
| 6d | 6.3 | **[Legacy declarables and custom elements](06d-legacy-declarables-and-custom-elements.md)** | The last two causes never show NG8001 at all; the one case where a schema is the right answer |
| 6e | 6.4 | **[The `CommonModule` anti-fix](06e-the-commonmodule-anti-fix.md)** | ⚠️ Angular's compiler suggests it and Angular's migration guide contradicts it — both ship in 22.1.5 |
| 6f | 6.5 | **[What `schemas` actually does](06f-what-schemas-actually-does.md)** | Two early returns inside `DomElementSchemaRegistry`, and which tags `CUSTOM_ELEMENTS_SCHEMA` refuses to rescue |
| 6g | 6.6 | **[Where `schemas` lives](06g-where-schemas-lives.md)** | It moved from the NgModule to the component, turning a feature-wide escape hatch into a one-template one |
| 7 | 7 | **[What replaced each `NgModule` responsibility](07-what-replaced-each-ngmodule-responsibility.md)** | Nine responsibilities, two of which are now answered by nothing at all |
| 7b | 7.1 | **[`imports` split in two, `providers` gained four homes](07b-imports-split-in-two-and-providers-gained-four-homes.md)** | One field split into two; `providers` now has a type system deciding which injector it may reach |
| 7c | 7.2 | **[The fields that moved, and the ones deleted](07c-the-fields-that-moved-and-the-ones-deleted.md)** | `bootstrap` and `schemas` moved; `entryComponents` was deleted outright in v16; `id` and `jit` remain |
| 8 | 8 | **[Interop, honestly — `importProvidersFrom`](08-ngmodule-interop-importprovidersfrom.md)** | The one supported bridge from a library that still ships an `NgModule` — legal in exactly two places |
| 8b | 8.1 | **[What it drags in](08b-what-importprovidersfrom-drags-in.md)** | 🔴 The walk is eager and total, the module class is referenced by value so nothing tree-shakes, and the result is an opaque brand you cannot audit |
| 8c | 8.2 | **[Ordering, cycles and multi tokens](08c-ordering-cycles-and-multi-tokens.md)** | `forRoot()` always beats a plain module; the cycle check is dev-only while the deduplication is not |
| 8d | 8.3 | **[The two errors it raises](08d-the-two-errors-importprovidersfrom-raises.md)** | NG0800 goes silent in production; NG0207 has two messages under one code, chosen by the `ɵfromNgModule` brand |
| 9 | 9 | **[The standalone migration schematic](09-the-standalone-migration-schematic.md)** | `ng generate @angular/core:standalone` is not one migration but three, in a forced order |
| 9b | 9.1 | **[Mode 1 — convert to standalone](09b-mode-1-convert-to-standalone.md)** | Deletes `standalone: false`, infers each template's real dependencies, moves declared classes into `imports` |
| 9c | 9.2 | **[Mode 2 — prune NgModules](09c-mode-2-prune-ng-modules.md)** | Five removal criteria, best read backwards as the checklist explaining why your module is still there |
| 10 | 10 | **[Why standalone makes the graph splittable](10-why-standalone-makes-the-graph-splittable.md)** | Locality as the real payoff; one dynamic import per `@defer` dependency; `deferredImports` is internal-only |
| 10b | 10.1 | **[`loadComponent` at a route boundary](10b-loadcomponent-at-a-route-boundary.md)** | 🔴 NG4014 fires at navigation, after the chunk downloaded, and is compiled out of production; NG0981 is behind two more flags |
| 10c | 10.2 | **[Incremental compilation and the scope cache](10c-incremental-compilation-and-the-scope-cache.md)** | The cache key is the invalidation unit; a module's emit depends on symbols two hops away |
| 11 | 11 | **[Where `NgModule` still legitimately appears](11-where-ngmodule-still-legitimately-appears.md)** | Not deprecated in v22 — but every first-party Angular module now declares nothing |

✅ **All 11 planned chunks are written, across 31 files.** Eight of them exhausted their subject
and split into lettered siblings — the 300-line cap is a file size, never a content budget, so a
chunk that ran long became two or three files rather than a shorter page. One forward reference
is still deliberately unlinked: **`08e · The interop shapes that beat it`** was never written, and
chunks 8 and 8c point at it as plain bold text rather than a dangling link.

## The one question this topic exists to answer

**"I added a component to my template and Angular says it is not a known element — what is
the actual rule?"** The rule is that a component's template can only reference what that
component's own `imports` array names. Not what its parent imports. Not what some module
somewhere imports. Its own array, resolved at compile time, in that one file. Everything
else on this page is a consequence of that sentence.

## Where this connects

- [01 · A compiler with a framework attached](../01-compiler-with-a-framework-attached/README.md)
  is the machine this topic configures: `imports` must be statically analysable because
  `ngtsc` resolves it at build time, not at runtime.
- [03 · The provider array is the wiring](../03-the-provider-array/README.md) picks up the second half of
  `bootstrapApplication` — the `ApplicationConfig` object this topic passes but does not
  unpack.
- **Phase 1 — Components and templates** owns selectors, inputs and content projection;
  this topic only owns how a template dependency becomes visible.
- **Phase 6 — Dependency injection** owns injector hierarchies. Chunk 7's
  `importProvidersFrom` returns `EnvironmentProviders`; *why* that type exists is Phase 6's.
- **Phase 8 — Routing** owns `loadComponent`, `loadChildren` and route-level `providers`;
  chunk 7 uses them only as an interop escape hatch.
- **Phase 15 — Tooling and upgrades** owns `ng update` end to end; chunk 8 covers only the
  one schematic that produces standalone code.

## Phase gate

You are done with this topic when you can open any component file in a v22 app and, without
running anything, say exactly which other components, directives and pipes its template is
allowed to reference — and when, given `'app-user-card' is not a known element`, you name
the file that needs editing before you look at the stack trace.

---

← Prev: [A compiler with a framework attached](../01-compiler-with-a-framework-attached/README.md) · Index: [Phase 0 — How Angular runs](../README.md) · Start → [`bootstrapApplication`, line by line](01-bootstrapapplication-line-by-line.md) · Next topic → [The provider array is the wiring](../03-the-provider-array/README.md)
