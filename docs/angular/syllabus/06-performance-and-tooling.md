---
title: "Part 6 — Performance, tooling and the ecosystem"
sidebar_label: "6 · Performance and tooling"
sidebar_position: 6
---

> **Phases 14–15 · 24 topics · 5 Master**
> Making the bundle small enough and the interactions fast enough, then keeping
> the whole thing upgradable for longer than one release cycle.

> Verified: 2026-08 against Angular **22.1.4** / CLI **22.1.6**.
> *Explanation pages are not written yet — this is the inventory.*

Angular's reputation for shipping large bundles is a decade old and mostly no
longer earned — but only if you use the two splitting tools and set the budgets.
Phase 15 exists because an Angular application that skips one major is
substantially harder to move than one that never does.

---

## Phase 14 — Performance and the build

*12 topics.* Performance work in Angular is unusually tractable: the framework
gives you budgets that fail the build, a compiler that can split at a template
boundary, and a profiler that names the component.

| Topic | Tier |
|---|---|
| **Bundle budgets** — the `budgets` array in `angular.json`, `initial` vs `anyComponentStyle`, warning and error thresholds, and setting them so CI fails on a regression instead of a human noticing six weeks later | <span className="db-tier t-master">Master</span> |
| **Seeing what is actually in the bundle** — `--stats-json`, the esbuild metafile, source-map-explorer; finding the date library that a single `format()` call dragged in whole | <span className="db-tier t-master">Master</span> |
| **The two splitting tools** — lazy routes for feature-sized splits, `@defer` for below-the-fold and interaction-gated splits; how to choose, and how to verify a chunk actually moved | <span className="db-tier t-master">Master</span> |
| **`OnPush` and zoneless as structural wins** — why these change the shape of the work rather than shaving it, and why they come before any micro-optimisation | <span className="db-tier t-understand">Understand</span> |
| **List rendering cost** — `@for` with a stable `track`, the DOM churn a wrong track causes, and the point at which a list needs virtualisation instead of tuning | <span className="db-tier t-understand">Understand</span> |
| **Virtual scrolling** — the CDK `ScrollingModule`, fixed vs autosize strategies, and what it breaks (find-in-page, anchor links, scroll restoration) | <span className="db-tier t-understand">Understand</span> |
| **Images and LCP** — `NgOptimizedImage`, `priority` on the hero image, `fill`, responsive `sizes`, the CDN loaders, and the dev-mode warnings it emits about oversized images | <span className="db-tier t-understand">Understand</span> |
| **Core Web Vitals, mapped to Angular** — what LCP, INP and CLS each depend on in an Angular app, and which of the three hydration most affects | <span className="db-tier t-understand">Understand</span> |
| **The cost of hydration** — why a server-rendered app can paint sooner and respond later, measuring the gap, and using incremental hydration to close it | <span className="db-tier t-understand">Understand</span> |
| **Dev-server timings lie** — unminified, unbundled, source-mapped, with dev-mode assertions running; always measure a production build, and the numbers that change most between them | <span className="db-tier t-understand">Understand</span> |
| **The Angular DevTools profiler workflow** — recording, reading the change-detection flame chart, and going from "the page feels slow" to a named component in one pass | <span className="db-tier t-understand">Understand</span> |
| Build performance — the persistent build cache, `--watch`, what invalidates the cache, and keeping CI build times honest | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can state your app's initial bundle size from a
production build, name its three largest contributors, and show one route whose
code is not in it.

---

## Phase 15 — Tooling, upgrades and the ecosystem

*12 topics.* The phase that decides whether this application is still on a
supported Angular in two years. With a six-month major cadence and an
eighteen-month support window, "we'll upgrade later" has a deadline attached
whether or not anyone wrote it down.

| Topic | Tier |
|---|---|
| **`ng update` as a survival skill** — one major at a time, never two; what the schematics rewrite in your source, reading the official update guide's before/during/after lists, and why a skipped major compounds rather than adds | <span className="db-tier t-master">Master</span> |
| **Security** — Angular's contextual auto-sanitisation, `SecurityContext`, the `bypassSecurityTrust*` functions and the audit they deserve, `CSP_NONCE` for a strict Content Security Policy, and Trusted Types | <span className="db-tier t-master">Master</span> |
| **Schematics and generators** — `ng generate` for components, services, guards and interceptors; the built-in migration schematics; writing a project schematic when a convention is worth enforcing | <span className="db-tier t-understand">Understand</span> |
| **The deprecation policy** — what "deprecated" commits Angular to, the two-major removal window, and how to read release notes for the three lines that affect you | <span className="db-tier t-understand">Understand</span> |
| **Migrating NgModules to standalone** — the migration schematic, the order to do it in, and the `NgModule`s that are genuinely load-bearing until last | <span className="db-tier t-understand">Understand</span> |
| **Linting and formatting** — `angular-eslint` on flat config, the template rules worth turning on, `typescript-eslint`, and Prettier's handling of Angular templates | <span className="db-tier t-understand">Understand</span> |
| **Angular DevTools** — the component tree, the injector tree, the signal graph, and the profiler; the debugging affordances that do not exist in other frameworks | <span className="db-tier t-understand">Understand</span> |
| Publishing a library — `ng-packagr`, the Angular Package Format, partial compilation, peer ranges, and what you owe consumers on every major | <span className="db-tier t-know">Know</span> |
| Monorepos — the CLI workspace's own multi-project support, where Nx adds enough to be worth its own learning curve, and shared-library boundaries | <span className="db-tier t-know">Know</span> |
| Analog — the Vite-based meta-framework (`@analogjs/platform` 2.7.1), file-based routing and server routes; what it offers over `@angular/ssr` and the maturity trade | <span className="db-tier t-know">Know</span> |
| Angular Elements and micro-frontends — shipping a component as a custom element, and the framework-boundary problems that follow | <span className="db-tier t-when">When Needed</span> |
| The AngularJS upgrade path — `@angular/upgrade`, `@angular/common/upgrade`, `@angular/router/upgrade`, hybrid bootstrapping; still shipped, and only ever read when you inherit one | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can take an application one major version forward
with `ng update`, read what the schematics changed, and say which of the
remaining warnings are deprecations you must act on before the next major.
