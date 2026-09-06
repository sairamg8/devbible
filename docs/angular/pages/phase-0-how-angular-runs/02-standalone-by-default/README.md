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

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`bootstrapApplication`, line by line](01-bootstrapapplication-line-by-line.md)** | The three-argument signature, what it merges in place of `BrowserModule`, why it returns a `Promise`, and the `platformBrowserDynamic()` call it replaced |
| 2 | **[The flag is gone — which version changed what](02-the-flag-is-gone-which-version-changed-what.md)** | 🔴 v14 introduced, v15 stabilised, **v19.0.0 flipped the default**, v20 deprecated `platform-browser-dynamic`; and the compiler flag that reads your `@angular/core` version to decide |
| 3 | **[What `imports` actually means](03-what-imports-actually-means.md)** | The per-component template dependency list, its exact type, and the transitive `NgModule` scope it replaced |
| 4 | **[Unused imports and the compiler diagnostics](04-unused-imports-and-the-compiler-diagnostics.md)** | NG8113 is a **warning**, not an error — how to promote it, the cleanup schematic, and NG2010/NG2011/NG2012 |
| 5 | **[`'x' is not a known element`](05-not-a-known-element.md)** | 🔴 The single most common standalone error, symptom → cause → fix, compile-time vs runtime, and why `CommonModule` is usually the wrong fix |
| 6 | **[What replaced each `NgModule` responsibility](06-what-replaced-each-ngmodule-responsibility.md)** | The field-by-field table: `declarations`, `imports`, `exports`, `providers`, `bootstrap`, `schemas`, `entryComponents` |
| 7 | **[Interop, honestly — `importProvidersFrom`](07-ngmodule-interop-importprovidersfrom.md)** | The bridge for a library still shipping an `NgModule`, exactly what it costs, and lazy-loading a legacy module through `loadChildren` |
| 8 | **[The standalone migration schematic](08-the-standalone-migration-schematic.md)** | `ng generate @angular/core:standalone`, the three modes in their required order, and the four things it cannot do |
| 9 | **[Why standalone makes the graph splittable](09-why-standalone-makes-the-graph-splittable.md)** | Locality as the real payoff — `@defer` refuses non-standalone dependencies, and that is a consequence, not a rule |
| 10 | **[Where `NgModule` still legitimately appears](10-where-ngmodule-still-legitimately-appears.md)** | Third-party libraries, `TestBed`'s internal `DynamicTestModule`, `createNgModule`, and the AngularJS hybrid |

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
- [03 · The provider array is the wiring](../03-the-provider-array/README.md) picks up the
  second half of `bootstrapApplication` — the `ApplicationConfig` object this topic passes
  but does not unpack.
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

← Prev: [A compiler with a framework attached](../01-compiler-with-a-framework-attached/README.md) · Index: [Phase 0 — How Angular runs](../README.md) · Next → [The provider array is the wiring](../03-the-provider-array/README.md)
