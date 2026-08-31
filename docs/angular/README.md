---
title: "Angular — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **Angular 22.1.4** (`npm view @angular/core dist-tags`,
> published 2026-08-27). Every version fact below was measured on this machine —
> the API lists are the export lists of the published `.d.ts` files in
> `@angular/core@22.1.4`, `@angular/common@22.1.4`, `@angular/forms@22.1.4` and
> `@angular/router@22.1.4`, not recalled from documentation.

The complete topic inventory for Angular, tiered for **mastery in fullstack
application development**. **16 phases, 210 topics**, split into 6 parts to stay
under the 300-line file cap.

The bar is **no knowledge gaps**: the whole signal graph, the component and
directive API in both its decorator and its signal form, dependency injection to
the bottom, routing, forms in all three of the systems Angular now ships,
zoneless change detection, SSR with incremental hydration, and the build. Nothing
is left as "you'll pick that up later".

Architectural role: **Angular is a compiler with a framework attached.** That one
sentence is what most of this syllabus is downstream of. It is why templates are
a separate language rather than JavaScript, why `@Component` metadata has to be
statically analysable, why `@defer` can split a bundle at a template boundary
that no bundler could have found, and why the framework can change its entire
change-detection strategy under you without changing your components.

## Where this sits, as of September 2026

**Angular 22 is the current major** and the version this syllabus targets.
Majors land every six months, in May/June and November:

| Major | Released | Support state, Sept 2026 |
|---|---|---|
| **22** | **3 Jun 2026** | 🟢 **Active support** — the target. Latest patch `22.1.4` (27 Aug 2026); `22.2.0-next.4` in prerelease |
| 21 | 19 Nov 2025 | 🟡 LTS, security and critical fixes only, to ~May 2027. Frozen line at `21.2.22` |
| 20 | 28 May 2025 | 🟡 LTS ending ~Nov 2026. Frozen line at `20.3.30` |
| 19 | 19 Nov 2024 | 🔴 **Out of support.** Its last patch, `19.2.25`, shipped 2 Jun 2026 — the day before v22 |

The support window is **6 months active + 12 months LTS**, so any given major is
supported for 18 months and exactly three are alive at once. **The next major,
v23, is due around November 2026** — nothing in this syllabus anticipates it.

⚠️ **If you last used Angular before v19, most of what you know about how an app
is wired is out of date.** These are not stylistic changes; the old way is gone
or on a deprecation clock:

| You learned | It is now |
|---|---|
| `NgModule`, `declarations`, `imports` arrays | **Standalone by default** since v19. `ng new` produces no `NgModule` at all |
| `*ngIf`, `*ngFor`, `*ngSwitch` | **`@if` / `@for` / `@switch`** built into the template language. The structural directives still work; the CLI ships a migration |
| `@Input()` / `@Output()` decorators | **`input()` / `output()` / `model()`** signal functions — typed, required-able, and readable without a lifecycle hook |
| `@ViewChild` / `@ContentChild` | **`viewChild()` / `contentChild()`** and their plural forms, as signals |
| zone.js patching every async API | **`provideZonelessChangeDetection()`** — stable, and the default for new apps |
| `RxJS` for all component state | **Signals** for state, RxJS for streams. Both ship; the syllabus says which to reach for |
| Karma + Jasmine | **Vitest** — `@angular/build` peers `vitest@^4.0.8`. Karma remains a peer but is end-of-life |
| `HttpClient` + `subscribe` in a component | **`httpResource()`** — a signal-shaped request with `value`/`status`/`error` |
| Reactive forms as the "serious" option | **Signal forms** (`@angular/forms/signals`) as a third system, schema-first |
| `ng serve` on Webpack | **`@angular/build`** on esbuild + Vite |

## Scope — what this syllabus owns

**Angular itself, and the decisions Angular forces on you.** The rule is: *if
removing Angular would remove the topic, it is Angular's.*

| Concern | Home |
|---|---|
| Closures, the event loop, promises, the DOM API, `fetch` | **JavaScript** |
| Decorators as a language feature, generics, `strict` flags | **TypeScript** |
| Flexbox, Grid, container queries, the cascade | **CSS** |
| The template language, DI, signals, change detection, hydration | **Angular** |
| RxJS operators in general | **Angular**, but only the ones an Angular app actually uses — Phase 7 names the twelve and stops |
| HTTP semantics, status codes, REST design, the API contract | **Express** |
| What the server does with the request an SSR render makes | **Node** / **PostgreSQL** |
| Bundling in general | **Vite** / **Webpack** — Angular owns only what `@angular/build` changes |

Two deliberate overlaps, both handled by linking rather than re-explaining:

- **Comparisons with React.** Named where the mental model genuinely differs
  (change detection, DI, the compiler), never as a running commentary.
- **State management libraries.** Phase 11 covers the decision and `@ngrx/signals`,
  because "which store" is a question Angular forces; the library's own API
  surface beyond `signalStore` is not this syllabus's job.

## Version facts

All measured on this machine, 2026-08-31:

| | |
|---|---|
| Target | **`@angular/core` 22.1.4**, `latest` dist-tag, published **27 Aug 2026** |
| CLI | **`@angular/cli` 22.1.6** · **`@angular/build` 22.1.6** (esbuild + Vite; the Webpack builders are legacy) |
| Node | CLI 22 engines: **`^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`**. Node 24 is the active LTS this project targets |
| TypeScript | **`>=6.0 <6.1`** — a hard peer range on both `@angular/compiler-cli` and `@angular/build`. Angular 22 does *not* run on TS 5.x |
| RxJS | peer **`^6.5.3 \|\| ^7.4.0`**; latest published rxjs is **7.8.2**. There is no rxjs 8 support |
| zone.js | peer **`~0.15.0 \|\| ~0.16.0`** — and optional: a zoneless app does not install it |
| Test runner | **`vitest@^4.0.8`** is the peer `@angular/build` expects. `karma@^6.4.0` is still a peer, and still deprecated |
| SSR | **`@angular/ssr` 22.1.6** — server routes, render modes, incremental hydration |
| First-party UI | **`@angular/material` 22.1.4** · **`@angular/cdk` 22.1.4** |
| Still published | `@angular/animations` 22.1.4 · `@angular/platform-browser-dynamic` 22.1.4 — both maintained, both rarely what you want in a new app |
| Ecosystem, measured | **`@ngrx/store` 22.0.0** · **`@ngrx/signals` 22.0.0** · **`@analogjs/platform` 2.7.1** |
| Package entry points | `@angular/forms` → `.`, **`./signals`**, **`./signals/compat`** · `@angular/common` → `.`, `./http`, `./http/testing`, `./testing`, `./upgrade` · `@angular/platform-browser` → `.`, `./animations`, `./animations/async`, `./testing` |
| Signals in stable `core` | `signal` `computed` `effect` `linkedSignal` `untracked` `isSignal` `isWritableSignal` **`debounced`** `resource` `resourceFromSnapshots` |
| Component API in stable `core` | `input` `output` `model` `viewChild` `viewChildren` `contentChild` `contentChildren` `inputBinding` `outputBinding` `twoWayBinding` |
| Render hooks | `afterNextRender` **`afterEveryRender`** `afterRenderEffect` — `afterRender` was renamed |
| Change detection providers | **`provideZonelessChangeDetection`** (stable) · `provideZoneChangeDetection` · `provideCheckNoChangesConfig` |
| New in the v22 surface | **`injectAsync`** · the **`@Service`** decorator · `onIdle` / `IdleService` / `provideIdleServiceWith` · `provideBrowserGlobalErrorListeners` |
| **Experimental — label it, don't teach it as shippable** | `declareExperimentalWebMcpTool` / `provideExperimentalWebMcpTools` (browser MCP tools) · `provideExperimentalWebMcpForms` · router `withExperimentalPlatformNavigation` (the Navigation API) and `withExperimentalAutoCleanupInjectors` |

**The single most load-bearing fact for this syllabus:** signals are no longer a
feature you can skip. Inputs, queries, forms, HTTP and change detection are all
expressed in them now, and an app written the 2023 way is not "older Angular" —
it is a different framework that happens to share a name. Phase 2 is therefore
the phase that everything from Phase 3 onwards assumes.

## The 16 phases

| # | Phase | Part | Topics |
|---|---|---|---|
| 0 | How Angular runs | The Angular model | 12 |
| 1 | Components and templates | The Angular model | 16 |
| 2 | Signals | The Angular model | 15 |
| 3 | The signal component API | Components in the signal era | 12 |
| 4 | Template syntax and control flow | Components in the signal era | 12 |
| 5 | Change detection and zoneless | Components in the signal era | 11 |
| 6 | Dependency injection | Injection, streams and routing | 14 |
| 7 | RxJS in Angular | Injection, streams and routing | 12 |
| 8 | Routing | Injection, streams and routing | 16 |
| 9 | HTTP and data | Data, forms and architecture | 12 |
| 10 | Forms — all three systems | Data, forms and architecture | 16 |
| 11 | Architecture, state and UI | Data, forms and architecture | 12 |
| 12 | SSR, hydration and the server | Rendering on the server, and testing | 12 |
| 13 | Testing | Rendering on the server, and testing | 14 |
| 14 | Performance and the build | Performance, tooling and the ecosystem | 12 |
| 15 | Tooling, upgrades and the ecosystem | Performance, tooling and the ecosystem | 12 |

## The six parts

| Part | Phases | Topics | What it gets you |
|---|---|---|---|
| **[1 · The Angular model](syllabus/01-the-angular-model.md)** | 0–2 | 43 | What the compiler does with your code, the component and template language, and the reactive primitive everything else is now built on |
| **[2 · Components in the signal era](syllabus/02-components-in-the-signal-era.md)** | 3–5 | 35 | The signal-based component API, control flow and `@defer`, and change detection with the zone removed |
| **[3 · Injection, streams and routing](syllabus/03-injection-streams-and-routing.md)** | 6–8 | 42 | The injector hierarchy, the RxJS you actually need, and a real router configuration |
| **[4 · Data, forms and architecture](syllabus/04-data-forms-and-architecture.md)** | 9–11 | 40 | `httpResource` and interceptors, all three forms systems including signal forms, and where state lives |
| **[5 · Rendering on the server, and testing](syllabus/05-server-and-testing.md)** | 12–13 | 26 | SSR, hydration, incremental hydration and event replay — then how any of it is tested |
| **[6 · Performance, tooling and the ecosystem](syllabus/06-performance-and-tooling.md)** | 14–15 | 24 | Budgets, bundles, `ng update` as a survival skill, security, and the libraries worth knowing |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| **Master** | 58 | 28% |
| **Understand** | 84 | 40% |
| **Know** | 48 | 23% |
| **When Needed** | 20 | 9% |

Master sits at 28%, inside the 25–30% band the brief asks for. What earns it is
narrow and predictable: the template language, signals, DI, change detection,
routing, forms, and the parts of the build you touch weekly. What does not:
i18n, Web Workers, custom elements, the `upgrade` path from AngularJS, and every
API this page marked experimental.

## How to read this

Phases are ordered by dependency, not by difficulty. **Phase 2 is the gate** —
if signals are not solid, phases 3, 5, 9 and 10 will read as unrelated APIs
rather than as one idea applied four times.

Each phase ends with a **gate**: a sentence describing what you can do before
moving on. They are deliberately concrete, and skipping one is how people end up
with an app that works and a mental model that does not.
