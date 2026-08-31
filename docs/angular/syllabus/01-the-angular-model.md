---
title: "Part 1 — The Angular model"
sidebar_label: "1 · The Angular model"
sidebar_position: 1
---

> **Phases 0–2 · 43 topics · 17 Master**
> What the compiler does with your code, the component and template language it
> compiles, and the reactive primitive that every other part of Angular 22 is
> now expressed in.

> Verified: 2026-08 against Angular **22.1.4**.
> *Explanation pages are not written yet — this is the inventory.*

This is the part you cannot skim. Phase 2 in particular is load-bearing: inputs,
queries, forms, HTTP and change detection are all signals now, so an incomplete
model of `computed` shows up four phases later as four separate confusions.

---

## Phase 0 — How Angular runs

*12 topics.* Before any syntax: what the tool actually is. Angular is the only
mainstream framework that ships a **compiler you cannot opt out of**, and almost
every "why does Angular need this?" question resolves to that fact.

| Topic | Tier |
|---|---|
| **Angular is a compiler with a framework attached** — templates are a separate language, compiled ahead of time into instruction calls; this is why metadata must be statically analysable and why `@defer` can split a bundle where no bundler could | <span className="db-tier t-master">Master</span> |
| **Standalone by default** — `bootstrapApplication(App, appConfig)`, no `NgModule` anywhere in a v22 app; what `imports` on a component now means | <span className="db-tier t-master">Master</span> |
| **The provider array is the application's wiring** — `ApplicationConfig.providers`, what belongs there (`provideRouter`, `provideHttpClient`, `provideZonelessChangeDetection`) and what does not | <span className="db-tier t-master">Master</span> |
| **`ng update` is the upgrade mechanism, not `npm install`** — schematics rewrite your source; skipping a major and jumping two is the single most expensive Angular mistake | <span className="db-tier t-master">Master</span> |
| **The build: `@angular/build`** — esbuild for output, Vite for the dev server; the Webpack builders are legacy and only kept for old configurations | <span className="db-tier t-understand">Understand</span> |
| **`angular.json` anatomy** — projects, targets, builders, `configurations`, `fileReplacements`, `budgets`; which fields you set and which are scaffolding you never touch again | <span className="db-tier t-understand">Understand</span> |
| **The TypeScript setup Angular requires** — the hard `>=6.0 <6.1` peer pin, `strictTemplates`, and the `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` split | <span className="db-tier t-understand">Understand</span> |
| **What `ng new` produces in v22** — the file tree, `app.config.ts`, `app.routes.ts`, `main.ts`, and what each line is for | <span className="db-tier t-understand">Understand</span> |
| **The release train** — majors every six months (May/June and November), 6 months active support plus 12 months LTS, and how to read a changelog for the breaking changes that matter to you | <span className="db-tier t-understand">Understand</span> |
| Partial compilation — why published libraries contain `ɵɵngDeclareComponent` calls rather than finished instructions, and what the linker does at build time | <span className="db-tier t-know">Know</span> |
| JIT vs AOT — where JIT still exists (`TestBed`, `platform-browser-dynamic`), and why it is not a deployment option | <span className="db-tier t-know">Know</span> |
| Dev-mode-only behaviour — `isDevMode()`, `ngDevMode` assertions, `provideNgReflectAttributes()`, and the checks that vanish in a production build | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can point at a compiled component and say which
parts of it you wrote, which the compiler generated, and which only exist in a
development build.

---

## Phase 1 — Components and templates

*16 topics.* The template language, which is where you will spend most of your
time and which is **not JavaScript** — a fact that explains most of its rules.

| Topic | Tier |
|---|---|
| **`@Component` metadata** — `selector`, `template`/`templateUrl`, `styles`/`styleUrl`, `imports`, `host`; every field and what it costs | <span className="db-tier t-master">Master</span> |
| **Interpolation and template expression rules** — no assignment, no `new`, no bitwise operators, no chained statements; why the compiler forbids each | <span className="db-tier t-master">Master</span> |
| **Property binding vs attribute binding** — `[value]` sets a DOM property, `[attr.value]` sets an HTML attribute, and the bugs that come from confusing them (`colspan`, `aria-*`, SVG) | <span className="db-tier t-master">Master</span> |
| **Class and style bindings** — `[class.active]`, `[style.width.px]`, object and array forms, and why `NgClass`/`NgStyle` are now rarely the right answer | <span className="db-tier t-master">Master</span> |
| **Event binding** — `(click)`, `$event`, key modifiers like `(keydown.enter)`, and what the listener is actually attached to | <span className="db-tier t-master">Master</span> |
| **Two-way binding** — `[(value)]`, exactly what it desugars to, and why it only works against a matching `valueChange` output or a `model()` | <span className="db-tier t-master">Master</span> |
| **Lifecycle hooks in full order** — `ngOnChanges` → `ngOnInit` → `ngDoCheck` → content hooks → view hooks → `ngOnDestroy`; which of them signals have made unnecessary and which have not | <span className="db-tier t-master">Master</span> |
| **`ChangeDetectionStrategy.OnPush` as the default posture** — what it actually skips, what still marks a component dirty, and why every component you write should have it | <span className="db-tier t-master">Master</span> |
| **Component selectors** — element, attribute and class selectors, `:not()`, and when an attribute selector is the right call | <span className="db-tier t-understand">Understand</span> |
| **Template reference variables and `@let`** — `#ref` on an element vs on a component vs with `exportAs`, and `@let` for a value you would otherwise recompute three times | <span className="db-tier t-understand">Understand</span> |
| **The `host` object, `@HostBinding` and `@HostListener`** — binding to your own host element, and why the `host` object is now preferred | <span className="db-tier t-understand">Understand</span> |
| **`ViewEncapsulation`** — `Emulated` (the default and what the attribute selectors mean), `ShadowDom`, `None`; `:host`, `:host-context`, and `::ng-deep`'s long deprecation | <span className="db-tier t-understand">Understand</span> |
| **Component styles** — `styleUrl`, inline `styles`, global styles, and where a utility framework like Tailwind fits against encapsulation | <span className="db-tier t-understand">Understand</span> |
| **Content projection** — `<ng-content>`, `select=`, multi-slot projection, fallback content, and the rule that projected content is created by the *parent* | <span className="db-tier t-understand">Understand</span> |
| **`ng-template`, `ng-container` and `NgTemplateOutlet`** — a template you hold rather than render, a grouping element that emits no DOM, and passing context into a template | <span className="db-tier t-understand">Understand</span> |
| Dynamic components — `createComponent()`, `NgComponentOutlet`, `ViewContainerRef.createComponent()`, and setting inputs with `inputBinding()` | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can build a component that projects content, binds
to its own host, and exposes a two-way bound value — and explain why each
binding uses the syntax it does rather than copying it from an example.

---

## Phase 2 — Signals

*15 topics.* 🔴 **The gate phase.** Signals are not an alternative API in Angular
22 — they are the API. Inputs, queries, forms, HTTP and change detection are all
expressed in them, so this is one idea you will apply in five places.

| Topic | Tier |
|---|---|
| **`signal()`** — creating writable state, `set` vs `update`, reading by calling, and the contract that a template read subscribes the view | <span className="db-tier t-master">Master</span> |
| **`computed()`** — derived state that is lazy and memoised; why it never runs unless something reads it, and why that is the point | <span className="db-tier t-master">Master</span> |
| **`effect()`** — when it runs, the cleanup callback, its injection-context requirement, and the ways it is *not* React's `useEffect` | <span className="db-tier t-master">Master</span> |
| **`resource()`** — asynchronous state as a signal: `value`, `status`, `error`, `reload()`, and the abort signal you get for free | <span className="db-tier t-master">Master</span> |
| **`toSignal()` and `toObservable()`** — the `@angular/core/rxjs-interop` boundary, initial values, and the subscription lifetime you just took on | <span className="db-tier t-master">Master</span> |
| **Signals vs RxJS — the decision rule** — state is a signal, events over time are a stream; the cases where the rule is genuinely ambiguous, and how to break the tie | <span className="db-tier t-master">Master</span> |
| **Equality functions** — the `Object.is` default, why an array `.push()` never notifies anyone, and passing a custom `equal` | <span className="db-tier t-understand">Understand</span> |
| **`untracked()`** — reading a signal without taking a dependency on it, and the two situations that actually need it | <span className="db-tier t-understand">Understand</span> |
| **`linkedSignal()`** — writable state that resets when its source changes; the "selected row survives a refetch" problem it was built for | <span className="db-tier t-understand">Understand</span> |
| **`debounced()`** — new in v22: a signal that trails its source by a delay, replacing a hand-rolled `toObservable().pipe(debounceTime())` round trip | <span className="db-tier t-understand">Understand</span> |
| **Glitch-free, pull-based evaluation** — why a `computed` reading two signals that both changed never observes a half-updated pair, and why that is not true of naive subscriptions | <span className="db-tier t-understand">Understand</span> |
| **Resource status and reloading** — the status values, `reload()`, request functions that re-run on dependency change, streaming resources, and `resourceFromSnapshots` | <span className="db-tier t-understand">Understand</span> |
| **Writing to a signal from an effect** — the loops it creates, `assertNotInReactiveContext`, and the design that removes the need | <span className="db-tier t-understand">Understand</span> |
| `afterRenderEffect()` — an effect that runs against the committed DOM rather than against state; measuring an element without fighting change detection | <span className="db-tier t-know">Know</span> |
| Debugging the graph — Angular DevTools' signal graph, `enableProfiling()`, and how to find the `computed` that recomputes on every keystroke | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can model a screen's state as signals with no
`effect()` in it at all, and explain for each derived value why it is a
`computed` rather than something you set by hand.
