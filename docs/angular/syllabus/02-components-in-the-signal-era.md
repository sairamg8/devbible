---
title: "Part 2 — Components in the signal era"
sidebar_label: "2 · Components in the signal era"
sidebar_position: 2
---

> **Phases 3–5 · 35 topics · 10 Master**
> The component API rewritten in signals, the control flow that replaced the
> structural directives, and change detection with the zone taken out.

> Verified: 2026-08 against Angular **22.1.4**.
> *Explanation pages are not written yet — this is the inventory.*

Part 1 established that signals are the primitive. This part is that primitive
applied to the three things a component actually does: receive and emit, render
conditionally, and get re-rendered.

---

## Phase 3 — The signal component API

*12 topics.* `@Input()` and `@Output()` still work and still will for years, but
nothing new should use them. The signal API is not sugar over the decorators —
it changes when a value is readable, which is why `static: true` and half the
`AfterViewInit` code you have written stopped being necessary.

| Topic | Tier |
|---|---|
| **`input()` and `input.required()`** — a read-only signal on the child, typed, with a default or a required contract the compiler enforces; aliasing with `{alias}` | <span className="db-tier t-master">Master</span> |
| **`output()`** — `OutputEmitterRef`, `emit()`, automatic teardown, and every way it differs from `EventEmitter` (which is still exported and still a `Subject`) | <span className="db-tier t-master">Master</span> |
| **`model()`** — one declaration that is an input, an output and a writable signal, and the only clean way to build a `[(value)]` component | <span className="db-tier t-master">Master</span> |
| **`viewChild()` and `viewChildren()`** — signal queries, `{read}`, and why the result is available without waiting for a lifecycle hook | <span className="db-tier t-master">Master</span> |
| **`@Directive` — attribute directives** — adding behaviour to an element you do not own, host bindings and listeners, injecting the host `ElementRef` | <span className="db-tier t-understand">Understand</span> |
| **Input transforms** — `booleanAttribute` (so `<my-dir disabled>` works), `numberAttribute`, custom transform functions, and how a transform widens the accepted type | <span className="db-tier t-understand">Understand</span> |
| **`contentChild()` and `contentChildren()`** — querying projected content, `{descendants}`, and why content queries resolve later than view queries | <span className="db-tier t-understand">Understand</span> |
| **Why signal queries removed `static: true`** — the old two-phase timing problem, and what to do with the `AfterViewInit` code you no longer need | <span className="db-tier t-understand">Understand</span> |
| **Structural directives** — what `*myDir` desugars to, building one from `TemplateRef` and `ViewContainerRef`, and the template type-checking guards (`ngTemplateContextGuard`) | <span className="db-tier t-understand">Understand</span> |
| **Host directives** — `hostDirectives: [...]`, composing behaviour without inheritance, and re-exposing a host directive's inputs and outputs under your own names | <span className="db-tier t-understand">Understand</span> |
| **Migrating decorators to the signal API** — `ng generate @angular/core:signal-input-migration` and its siblings; what the schematic converts and what it leaves for you | <span className="db-tier t-understand">Understand</span> |
| Programmatic bindings — `inputBinding()`, `outputBinding()` and `twoWayBinding()` passed to `createComponent()`, for the cases where the component is chosen at runtime | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a component whose entire public surface
is `input`, `output` and `model`, with no decorators and no lifecycle hook used
to read a query result.

---

## Phase 4 — Template syntax and control flow

*12 topics.* Built-in control flow is not a nicer `*ngIf` — it is compiled
differently, it does not need an import, and `@defer` does something structural
directives never could.

| Topic | Tier |
|---|---|
| **`@if` / `@else if` / `@else`** — the `as` alias for a narrowed value, and why no import is needed any more | <span className="db-tier t-master">Master</span> |
| **`@for` and `track`** — `track` is mandatory; what the compiler does with it, what a wrong track expression costs you (DOM thrash, lost focus, lost animation), and when `$index` is the right key | <span className="db-tier t-master">Master</span> |
| **`@defer`** — deferring a whole subtree and its dependencies to a separate chunk; triggers `on idle`, `on viewport`, `on interaction`, `on hover`, `on timer`, `on immediate`, and `when <expr>` | <span className="db-tier t-master">Master</span> |
| **`@empty`, and the `@for` context variables** — `$index`, `$first`, `$last`, `$even`, `$odd`, `$count`, and aliasing them with `let` | <span className="db-tier t-understand">Understand</span> |
| **`@switch` / `@case` / `@default`** — strict equality, no fallthrough, and why it is not a `switch` statement | <span className="db-tier t-understand">Understand</span> |
| **`@placeholder`, `@loading` and `@error`** — the `minimum` and `after` parameters that stop a spinner flashing, and what each block is allowed to contain | <span className="db-tier t-understand">Understand</span> |
| **`prefetch` triggers** — fetching the chunk before it is needed without rendering it, and pairing a `prefetch on hover` with an `on interaction` render | <span className="db-tier t-understand">Understand</span> |
| **Built-in pipes** — `date`, `currency`, `decimal`, `percent`, `json`, `keyvalue`, `slice`, `uppercase`/`lowercase`/`titlecase`, `i18nPlural`, `i18nSelect`; the format strings worth memorising | <span className="db-tier t-understand">Understand</span> |
| **`AsyncPipe`** — what it subscribes to, what it unsubscribes, why it marks the view for check, and when `toSignal()` is the better tool | <span className="db-tier t-understand">Understand</span> |
| **Pure vs impure pipes** — what "pure" means for a pipe, why an impure pipe runs on every check, and writing a custom pipe that stays pure | <span className="db-tier t-understand">Understand</span> |
| **`NgOptimizedImage`** — `ngSrc`, `priority`, `fill`, `placeholder`, the built-in CDN loaders (`provideImgixLoader` and friends), and the LCP warnings it emits in dev | <span className="db-tier t-understand">Understand</span> |
| `animate.enter` and `animate.leave` — CSS-driven enter/leave animation built into the template, and where that leaves `@angular/animations` (still published at 22.1.4, still the answer for sequenced and keyframed animation) | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain what `track` is protecting you from
with a concrete example of it going wrong — and can defer a route-level feature
so that its JavaScript is not in the initial bundle.

---

## Phase 5 — Change detection and zoneless

*11 topics.* The phase that separates people who can fix a performance problem
from people who add `detectChanges()` until it goes away. Zoneless is stable and
is what new apps get; understanding the zone is still required, because the app
you are handed will have one.

| Topic | Tier |
|---|---|
| **The dirty-checking model** — Angular checks a *tree of views*, top down, comparing bound expressions to their previous values; everything else in this phase is a rule about when that traversal starts and which views it visits | <span className="db-tier t-master">Master</span> |
| **`provideZonelessChangeDetection()`** — stable, the default posture for new apps; what schedules a check when nothing is monkey-patching `setTimeout` any more | <span className="db-tier t-master">Master</span> |
| **Notification sources** — a signal read in a template being written, a host listener firing, `markForCheck()`, `AsyncPipe` emitting; the complete list of what makes a view dirty, and the code that quietly notifies nothing | <span className="db-tier t-master">Master</span> |
| **What zone.js patched, and what it cost** — every timer, every event, every XHR, wrapped so the framework could guess when to check; the bundle cost, the stack traces, and why "the zone ran change detection 400 times" was a real diagnosis | <span className="db-tier t-understand">Understand</span> |
| **`ChangeDetectorRef`** — `markForCheck()` vs `detectChanges()` vs `detach()`/`reattach()`, and which of the four is almost never right | <span className="db-tier t-understand">Understand</span> |
| **`ExpressionChangedAfterItHasBeenCheckedError`** — what the dev-mode second pass is checking, the three shapes that cause it, and why each fix is a design fix rather than a `setTimeout` | <span className="db-tier t-understand">Understand</span> |
| **`afterNextRender()` and `afterEveryRender()`** — the DOM-safe hooks (note the rename from `afterRender`), why they do not run on the server, and using them instead of `ngAfterViewInit` for measurement | <span className="db-tier t-understand">Understand</span> |
| **Migrating an app to zoneless** — the checklist, the third-party libraries that break, and the failure mode where everything works until one screen stops updating | <span className="db-tier t-understand">Understand</span> |
| **`NgZone.runOutsideAngular()` and `run()`** — the escape hatch for animation loops and high-frequency events, and how much of that need disappears once you are zoneless | <span className="db-tier t-understand">Understand</span> |
| `provideCheckNoChangesConfig()` — configuring the dev-mode verification pass, including the interval-based check that catches updates made outside any notification | <span className="db-tier t-know">Know</span> |
| Profiling change detection — the Angular DevTools profiler, `enableProfiling()`, `startMeasuring()`/`stopMeasuring()`, and reading the flame chart to find the component that is checked 200 times a second | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take a component that fails to update and name
which notification source was missing, rather than reaching for `detectChanges()`.
