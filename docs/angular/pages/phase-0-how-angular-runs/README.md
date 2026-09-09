---
title: "Phase 0 — How Angular runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Angular 22** (**22.1.5**, `latest` tagged 3 September 2026; the v22
> line released 3 June 2026. CLI / `@angular/build` / `@angular/ssr` are
> **22.1.7**). Documentation-validated — every page names its sources on a
> `> Verified:` line (angular.dev, the Angular GitHub release notes, and the
> published package metadata). No sandbox: pages carry Angular, TypeScript and
> JSON source, never fabricated terminal output.

Before any syntax: what the tool actually is. Angular is the only mainstream
framework that ships a **compiler you cannot opt out of**, and almost every
*"why does Angular need this?"* question resolves to that one fact — why
metadata must be statically analysable, why `@defer` can split a bundle no
bundler could, why the upgrade path runs through `ng update` rather than
`npm install`, and why a published library on npm contains function calls you
have never heard of.

🚧 **In progress — 6 of 12 closed** (measured off disk 2026-09-09).
Topic **01** closed at **86 pages**, all 17 chunks, its metadata-error catalogue completed;
topic **02** is content-complete and wired, 32 chunks; topic **03** closed at **90 pages**, all 17
chunks; topic **04** closed at **21 pages**, all 7 concepts; topic **05** closed at **40 pages**, all
12 concepts; topic **06** closed at **68 pages**, all 15 concepts. Topics **07–12** are unstarted;
**07, 08 and 10–12 have a research bank**, and bank F's topic-08 half is incomplete. The table below is the phase's running order, tier by tier. A title that is
**not a link** has no page yet — a link to a page that does not exist is a broken link, and this
repo builds with none. Each row becomes a link as its topic lands.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | [A compiler with a framework attached](01-compiler-with-a-framework-attached/README.md) 🚧 | <span className="db-tier t-master">Master</span> | Templates are a separate language, compiled ahead of time into instruction calls |
| 02 | [Standalone by default](02-standalone-by-default/README.md) | <span className="db-tier t-master">Master</span> | `bootstrapApplication(App, appConfig)`, no `NgModule`, and what `imports` now means |
| 03 | [The provider array is the wiring](03-the-provider-array/README.md) 🚧 | <span className="db-tier t-master">Master</span> | `ApplicationConfig.providers` — what belongs there and what does not |
| 04 | [`ng update`, not `npm install`](04-ng-update-not-npm-install/README.md) | <span className="db-tier t-understand">Understand</span> | Schematics rewrite your source; skipping a major is the expensive mistake |
| 05 | [The build: `@angular/build`](05-the-build-angular-build/README.md) | <span className="db-tier t-understand">Understand</span> | 🔴 esbuild compiles, **Rolldown** re-bundles chunks (default since 22.1.0), Vite serves; the webpack builders were **deprecated in v22.0.0**, in three packages |
| 06 | [`angular.json` anatomy](06-angular-json-anatomy/README.md) | <span className="db-tier t-understand">Understand</span> | Projects, targets, builders, `configurations`, `fileReplacements`, `budgets` |
| 07 | **The TypeScript setup Angular requires** | <span className="db-tier t-understand">Understand</span> | The hard `>=6.0 <6.1` peer pin, `strictTemplates`, and the tsconfig split |
| 08 | **What `ng new` produces in v22** | <span className="db-tier t-understand">Understand</span> | The file tree, `app.config.ts`, `app.routes.ts`, `main.ts`, line by line |
| 09 | **The release train** | <span className="db-tier t-understand">Understand</span> | 🔴 A major every **12** months since v22, 4-6 minors each, ~24 months supported, and how to read a changelog |
| 10 | **Partial compilation** | <span className="db-tier t-know">Know</span> | `ɵɵngDeclareComponent` in published libraries, and what the linker does |
| 11 | **JIT vs AOT** | <span className="db-tier t-know">Know</span> | Where JIT still exists — ⚠️ `platform-browser-dynamic` is npm-deprecated at 22.1.5 — and why it is not a deployment option |
| 12 | **Dev-mode-only behaviour** | <span className="db-tier t-know">Know</span> | `isDevMode()`, `ngDevMode`, `provideNgReflectAttributes()`, and what vanishes |

## Phase gate

Move on when you can point at a compiled component and say which parts of it
you wrote, which the compiler generated, and which only exist in a development
build.

## Where this connects

- **Phase 1 — Components and templates** is what the compiler in topic 01 is
  compiling: this phase explains the machine, that one explains the language.
- **Phase 5 — Change detection and zoneless** picks up
  `provideZonelessChangeDetection` from topic 03 and explains what it replaced.
- **Phase 14 — Performance and the build** turns topics 05 and 06 from
  vocabulary into budgets, bundle analysis and the deploy artefact.
- **Phase 15 — Tooling and upgrades** is where topic 04's `ng update` becomes
  the full migration mechanics, at Master tier.

---

← Index: [Angular — Explanations](../README.md)
