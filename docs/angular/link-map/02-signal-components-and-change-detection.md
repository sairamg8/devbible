---
title: "Link map · Angular · Part 2 (phases 3–4–5)"
sidebar_label: "02 · signal components and change detection"
sidebar_position: 2
---

# Link map · Angular · Part 2 (phases 3–4–5)

Covers every topic row of `docs/angular/syllabus/02-components-in-the-signal-era.md` in phase 3 (T03-01 to T03-12, the signal component API), phase 4 (T04-01 to T04-12, template syntax and control flow) and phase 5 (T05-01 to T05-11, change detection and zoneless). That is 35 rows. None has a page of our own yet: `docs/angular/pages/` holds only phase 0, so every block reads 🔲 not written.
*read* = I read the passage; *headings only* = fetched, headings checked. Every link was re-fetched on 2026-10-13 and returned 200 at the URL given. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **Angular 22.1.4** (`docs/angular/README.md`). angular.dev always serves the latest docs. Several third-party picks predate that and are flagged in their line: `afterRender` was renamed `afterEveryRender` (the 2023 pick still uses the old name), the zoneless provider was `provideExperimentalZonelessChangeDetection` before it went stable (the 2024 picks use the old or the private `ɵ`-prefixed name), and the dynamic-component bindings article was written against a 20.0.0 pre-release. The zoneless guide on angular.dev says zoneless is the default from v21 on. The skipping-subtrees guide says `OnPush` is the default strategy from v22. Where a pick is for an older version the block says so. Several Angular In Depth pages are dated 2024-05-20 on the page although their code is pre-Ivy; the dates below are what the page shows, not proof of when the text was written.

---

## Phase 3 — The signal component API

### T03-01 · `input()` and `input.required()` — Master · 🔲 not written
- **Read this:** [Inputs](https://angular.dev/guide/components/inputs) · angular.dev · required inputs are enforced at build time, an alias does not affect use of the property in TypeScript, and a required input's type does not include `undefined` (*read*) · covers our angle: **partial** — says nothing about when a value becomes readable · fetched 2026-10-13
- **Also good:** [input API](https://angular.dev/api/core/input) · angular.dev · the function reference: `input` and `input.required`, with transform overloads (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Inputs: Complete Guide to input()](https://angularindepth.com/article/angular-signal-inputs-complete-guide-to-input/) · Angular University, Angular In Depth, 2024-01-26 · shows the NG8008 error for a missing required input and the alias option; the quoted source of the value getter ("Input is required but no value is available yet") hints at the run-time throw but the text does not teach it as a rule · fetched 2026-10-13 (*read*)
- **Our delta:** when the value becomes readable, which is why it cannot be read in the constructor.

### T03-02 · `output()` — Master · 🔲 not written
- **Read this:** [Custom events with outputs](https://angular.dev/guide/components/outputs) · angular.dev · `emit`, aliases, programmatic `subscribe` with `OutputRefSubscription`, RxJS interop link; a section on the `@Output` decorator calls `EventEmitter` an alternative and says the decorator API stays fully supported (*read*) · covers our angle: **partial** — no side-by-side difference table against `EventEmitter` · fetched 2026-10-13
- **Also good:** [OutputEmitterRef](https://angular.dev/api/core/OutputEmitterRef) · angular.dev · the class reference: `emit` and `subscribe` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular new output() function](https://dev.to/davidepassafaro/angular-new-output-function-44f1) · Davide Passafaro, DEV Community, 2024-04-24 (edited 2024-05-30; first on Medium) · `subscribe()` on the ref is not RxJS, subscriptions end when the host is destroyed, and `outputFromObservable` and `outputToObservable` bridge the two worlds; does not name `EventEmitter` · fetched 2026-10-13 (*read*)
- **Our delta:** the explicit difference table against `EventEmitter`, which is still a `Subject`.

### T03-03 · `model()` — Master · 🔲 not written
- **Read this:** [Inputs, section Model inputs](https://angular.dev/guide/components/inputs) · angular.dev · the page has a Model inputs section with the subsections Two-way binding with plain properties, Implicit change events, Customizing model inputs and When to use model inputs (*headings only*) · covers our angle: **partial** — passages not read, so the one-declaration framing is unconfirmed · fetched 2026-10-13
- **Also good:** [Two-way binding with model signals](https://angular.dev/tutorials/signals/6-two-way-binding-with-model-signals) · angular.dev · tutorial: "Unlike input() signals which are read-only, model() signals can be both read and written to", and a child `set()` propagates to the parent (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Model Inputs: Reactive Two-Way Binding](https://angularindepth.com/article/model-inputs-reactive-two-way-binding/) · Ilir Beqiri, Angular In Depth, 2024-02-28 · compares the old `Change`-suffix naming pattern with `model()`, where the compiler manages the matching event; written for v17.2, when model inputs were still developer preview · fetched 2026-10-13 (*read*)
- **Our delta:** model as input, output and writable signal in one declaration.

### T03-04 · `viewChild()` and `viewChildren()` — Master · 🔲 not written
- **Read this:** [Queries](https://angular.dev/guide/components/queries) · angular.dev · view vs content queries, required queries (no `undefined` in the type, error when nothing matches), signal results usable in `computed` and `effect` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular viewChild,viewChildren, contentChild (Full Guide)](https://angularindepth.com/article/angular-viewchild-viewchildren-contentchild-full-guide/) · Angular University, Angular In Depth, 2024-05-27 · the `read` option with worked examples, the query refreshes with every change detection run, and `viewChild.required()` shows "Child query result is required but no value is available" · fetched 2026-10-13 (*read*)
- **Our delta:** why no lifecycle hook is needed to read the result.

### T03-05 · `@Directive` — attribute directives — Understand · 🔲 not written
- **Read this:** [Attribute directives](https://angular.dev/guide/directives/attribute-directives) · angular.dev · builds a directive with `inject(ElementRef)` and a `host` metadata block for the `mouseenter` and `mouseleave` listeners; no decorator-based host bindings (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [HostBinding API](https://angular.dev/api/core/HostBinding) · angular.dev · "Always prefer using the host property over @HostBinding"; the decorator exists for backwards compatibility (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Using @HostBinding with Signals](https://briantree.se/angular-hostbinding-and-signals/) · Brian Treese, 2024-05-25 · says `@HostBinding` is no longer recommended and shows the signal-input workaround; does not mention the `host` metadata form · fetched 2026-10-13 (*read*)
- **Our delta:** when not to touch the DOM directly through `ElementRef`; the official page does not argue that.

### T03-06 · Input transforms — Understand · 🔲 not written
- **Read this:** [Inputs, sections Input transforms and Built-in transformations](https://angular.dev/guide/components/inputs) · angular.dev · transforms must be pure and statically analysable at build time; `booleanAttribute` treats the literal string `"false"` as false (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [booleanAttribute API](https://angular.dev/api/core/booleanAttribute) · angular.dev · one-line reference: transforms a value, typically a string, to a boolean; does not describe the `"false"` rule (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular @Input: Complete Guide](https://blog.angular-university.io/angular-input/) · Angular University, page shows 23 Feb 2026 · bare `disabled` becoming true with `booleanAttribute` and `age="20"` becoming a number with `numberAttribute`; written around the `@Input` decorator form · fetched 2026-10-13 (*read*)
- **Our delta:** the widening of the accepted type, stated outright.

### T03-07 · `contentChild()` and `contentChildren()` — Understand · 🔲 not written
- **Read this:** [Queries, section Content descendants](https://angular.dev/guide/components/queries) · angular.dev · `contentChild` traverses descendants by default, `contentChildren` only direct children unless `descendants: true`; queries never pierce component boundaries (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Queries: Replace @ContentChild with contentChild() (v19+)](https://briantree.se/contentchild-and-contentchildren-signal-queries/) · Brian Treese, 2024-11-22 · a before-and-after migration with `effect()` replacing `ngAfterContentInit`; does not cover `descendants` or explain timing · fetched 2026-10-13 (*read*)
- **Our delta:** why content queries resolve later than view queries.

### T03-08 · Why signal queries removed `static: true` — Understand · 🔲 not written
- **Read this:** [Queries, sections Static queries and Query timing](https://angular.dev/guide/components/queries) · angular.dev · `static: true` makes a decorator result available in `ngOnInit`, never updates, and is absent for the plural decorators; decorator results arrive in `ngAfterViewInit` or `ngAfterContentInit` (*read*) · covers our angle: **partial** — states the timing, does not argue why the flag could go · fetched 2026-10-13
- **Also good:** [Angular Signal Queries: Replace @ViewChild and @ContentChild the Modern Way (v19+)](https://briantree.se/angular-tutorial-signal-queries-with-the-viewchild-and-contentchild-functions/) · Brian Treese, 2024-04-20 · the same component moved from `static: true` plus hooks to an `effect()`, and says without `static` the code would need `ngAfterViewInit`; does not explain effect timing in detail (*read*) · fetched 2026-10-13
- **Our delta:** the whole "two-phase timing problem" argument. The earlier searches found no article that makes it, so this one is ours to own; I could not re-search (see the end note).

### T03-09 · Structural directives — Understand · 🔲 not written
- **Read this:** [Structural directives](https://angular.dev/guide/directives/structural-directives) · angular.dev · "How Angular translates shorthand" maps the shorthand to the long form; "Improving template type checking" covers `ngTemplateGuard` and `ngTemplateContextGuard` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [How to Write a Custom Structural Directive in Angular - Part 2](https://www.thisdot.co/blog/how-to-write-a-custom-structural-directive-in-angular-part-2) · Chris Trześniewski, This Dot, 2021-12-13 (updated 2023-02-13) · injects `TemplateRef` and `ViewContainerRef`, calls `createEmbeddedView` per item, adds the context guard; no desugaring; page warns it may be out of date · fetched 2026-10-13 (*read*)
- **Our delta:** the desugaring and the guard together in one place.

### T03-10 · Host directives — Understand · 🔲 not written
- **Read this:** [Directive composition API](https://angular.dev/guide/directives/directive-composition-api) · angular.dev · inputs and outputs are not exposed unless listed in the `hostDirectives` entry, aliases written as `'publicName: internalName'`, host directives must be standalone; a repeated host directive is merged into one instance and conflicting aliases raise NG8024 (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Directive composition API](https://angularindepth.com/article/directive-composition-api/) · Konrad Stępień, Angular In Depth, 2024-09-10 · an alias is written after a colon such as `'userId: id'`, every host directive must be standalone, and listing an input or output in the array exposes it · fetched 2026-10-13 (*read*)
- **Our delta:** composition without inheritance. A claim from an earlier draft that Angular 22 changed how a repeated host directive behaves is not supported: the official page describes the merge and NG8024 and names no v22 change.

### T03-11 · Migrating decorators to the signal API — Understand · 🔲 not written
- **Read this:** [Migration to signal inputs](https://angular.dev/reference/migrations/signal-inputs) · angular.dev · `ng generate @angular/core:signal-input-migration` with `--path`, `--best-effort-mode` (migrates even when the build may break) and `--insert-todos`; an input your code writes to is skipped (*read*) · covers our angle: **partial** — no full list of skip conditions · also see the sibling pages for [outputs](https://angular.dev/reference/migrations/outputs) (`output-migration`; skips `pipe()` use outside test files) and [queries](https://angular.dev/reference/migrations/signal-queries) (`signal-queries-migration`) (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Migrating to Angular Signals](https://angularindepth.com/article/migrating-to-angular-signals/) · Armen Vardanyan, Angular In Depth, 2025-08-27 · the schematic skips inputs reassigned inside the component, drops `TODO` comments where manual work is needed, transforming getters need reworking by hand, and best-effort mode "might introduce build errors" · fetched 2026-10-13 (*read*)
- **Our delta:** the list of what the schematic leaves for you, per input kind.

### T03-12 · Programmatic bindings — Know · 🔲 not written
- **Read this:** [Programmatic rendering](https://angular.dev/guide/components/programmatic-rendering) · angular.dev · section "Binding inputs, outputs and setting host directives at creation": a `bindings` array with `inputBinding`, `outputBinding`, `twoWayBinding`; the popup example removes the host element, detaches the host view and calls `ref.destroy()` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [twoWayBinding API](https://angular.dev/api/core/twoWayBinding) · angular.dev · a one-line reference ("Creates a two-way binding.") (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Dynamically-created components support two-way bindings](https://dev.to/railsstudent/dynamically-created-components-support-two-way-bindings-4m33) · Connie Leung, DEV Community, 2025-03-24 · a working `twoWayBinding` and `inputBinding` example on a `ViewContainerRef`; written for 20.0.0-next.3, does not show `outputBinding` · fetched 2026-10-13 (*read*)
- **Our delta:** when the component is chosen at runtime, and the cleanup of the returned `ComponentRef`.

---

## Phase 4 — Template syntax and control flow

### T04-01 · `@if` / `@else if` / `@else` — Master · 🔲 not written
- **Read this:** [Control flow](https://angular.dev/guide/templates/control-flow) · angular.dev · "Referencing the conditional expression's result" saves the result into a variable for reuse in the block (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Control flow migration](https://angular.dev/reference/migrations/control-flow) · angular.dev · `ng generate @angular/core:control-flow` with `--path` and `--format`; no `CommonModule` import needed (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular @if: Complete Guide](https://angularindepth.com/article/angular-if-complete-guide/) · Angular University, Angular In Depth, 2023-11-13 · `@else if` and `@else` chains, absent from the DOM rather than hidden, points at `ng generate @angular/core:control-flow`; the `as` alias only appears in an anti-pattern example · fetched 2026-10-13 (*read*)
- **Our delta:** the `as` alias for narrowing, and why no import is needed.

### T04-02 · `@for` and `track` — Master · 🔲 not written
- **Read this:** [Control flow, "Why is track in @for blocks important?"](https://angular.dev/guide/templates/control-flow) · angular.dev · pick a property that uniquely identifies each item such as `id` or `uuid`, `$index` for static collections, the item itself only as a last resort (*read*) · covers our angle: **partial** — the page never says `track` is mandatory · fetched 2026-10-13
- **Also good:** [NG0956](https://angular.dev/errors/NG0956) · angular.dev · the identity-track expression recreated the DOM for all items, costing focus and text selection; fix by tracking a stable key such as `todo.id` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular - For Loop Optimizations](https://angularindepth.com/article/angular-for-loop-optimizations/) · Eduard Krivanek, Angular In Depth, 2025-10-02 · tracking by object refreshes the view on every fetch because references change, `$index` shifts later entries on removal and can reset focus or cursor in forms, a stable `id` reuses nodes · fetched 2026-10-13 (*read*)
- **Our delta:** when `$index` is the right key, and the cost list: thrash, lost focus, lost animation.

### T04-03 · `@defer` — Master · 🔲 not written
- **Read this:** [Deferrable views](https://angular.dev/guide/templates/defer) · angular.dev · `on idle` (default), `viewport`, `interaction`, `hover`, `immediate`, `timer`, and `when`; triggers separated by a semicolon are OR conditions (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular @defer: Complete Guide](https://angularindepth.com/article/angular-defer-complete-guide/) · Angular University, Angular In Depth, 2023-11-27 · walks the six `on` triggers and `when` with examples; written at the v17 launch · fetched 2026-10-13 (*read*)
- **Our delta:** what lands in the separate chunk and what never defers (see our phase 0 `@defer` chunks).

### T04-04 · `@empty` and the `@for` context variables — Understand · 🔲 not written
- **Read this:** [Control flow, "Contextual variables in @for blocks"](https://angular.dev/guide/templates/control-flow) · angular.dev · `$count`, `$index`, `$first`, `$last`, `$even`, `$odd`, aliased with a `let` segment, which helps when nesting `@for`; `@empty` renders when there are no items (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular @for: Complete Guide](https://blog.angular-university.io/angular-for/) · Angular University, page shows 23 Feb 2026 · each variable with an example, and `@empty` against the old `ngFor` plus `ngIf` check; uses `let` but never explains aliasing · fetched 2026-10-13 (*read*)
- **Our delta:** aliasing in nested loops.

### T04-05 · `@switch` / `@case` / `@default` — Understand · 🔲 not written
- **Read this:** [Control flow, "Conditionally display content with the @switch block"](https://angular.dev/guide/templates/control-flow) · angular.dev · "@switch does not have a fallthrough"; consecutive `@case` blocks can share one body; an exhaustive type checking subsection with `@default never;`, which works on variables, not function calls or signals (*read*) · covers our angle: **partial** — the strict equality sentence is in the API page below · fetched 2026-10-13
- **Also good:** [@switch API](https://angular.dev/api/core/@switch) · angular.dev · "compared to the case expression using the === operator", no fallthrough, `@default never;` (*read*) · fetched 2026-10-13
- **Our delta:** why it is not a `switch` statement. Two third-party pages (Angular University, Passafaro) were read by the earlier pass and neither covers equality or fallthrough, so none is listed. I could not run a fresh search (see the end note).

### T04-06 · `@placeholder`, `@loading` and `@error` — Understand · 🔲 not written
- **Read this:** [Deferrable views, "How to manage different stages of deferred loading"](https://angular.dev/guide/templates/defer) · angular.dev · `@placeholder (minimum 500ms)`; `@loading (after 100ms; minimum 1s)`; `@error` displays if deferred loading fails (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular @defer: Complete Guide](https://angularindepth.com/article/angular-defer-complete-guide/) · Angular University, Angular In Depth, 2023-11-27 · same article as T04-03; explains `minimum` on the placeholder and `minimum` and `after` on the loading block, and that loading content never shows if the download beats `after` · fetched 2026-10-13 (*read*)
- **Our delta:** what each block may contain; `@error` takes no parameters.

### T04-07 · `prefetch` triggers — Understand · 🔲 not written
- **Read this:** [Deferrable views, "Prefetching data with prefetch"](https://angular.dev/guide/templates/defer) · angular.dev · `@defer (on interaction; prefetch on idle)` loads the code early and renders on interaction (*read*) · covers our angle: **partial** — `prefetch on hover` is not shown on the page · fetched 2026-10-13
- **Beyond the docs:** [Angular @defer: Complete Guide](https://angularindepth.com/article/angular-defer-complete-guide/) · Angular University, Angular In Depth, 2023-11-27 · prefetch and render are independent stages, and a display trigger that fires first forces the download on the spot · fetched 2026-10-13 (*read*)
- **Our delta:** the `prefetch on hover` plus `on interaction` pairing.

### T04-08 · Built-in pipes — Understand · 🔲 not written
- **Read this:** [Pipes](https://angular.dev/guide/templates/pipes) · angular.dev · lists the 13 built-in pipes, pure by default, custom pipes (*read*) · covers our angle: **partial** — only a couple of format examples; the per-pipe API pages carry the grammar, for example [DatePipe](https://angular.dev/api/common/DatePipe) with a named-formats table (such as `mediumDate`) and a custom-symbols table (*read*) · fetched 2026-10-13
- **Also good:** [Built-In Angular Pipes - Part 1](https://angularindepth.com/article/built-in-angular-pipes-part-1/) · Anubhab Mukherjee, Angular In Depth, 2022-01-02 · lists all 13 pipes but explains only `CurrencyPipe` (`digitsInfo` and friends); part 2 is `DatePipe` (*read*) · fetched 2026-10-13
- **Our delta:** one table of the format strings worth memorising. The earlier pass found no single deep dive across date, decimal, percent, keyvalue and the i18n pipes; I could not re-search (see the end note).

### T04-09 · `AsyncPipe` — Understand · 🔲 not written
- **Read this:** [AsyncPipe API](https://angular.dev/api/common/AsyncPipe) · angular.dev · subscribes to an Observable or Promise, marks the component to be checked on each emitted value, unsubscribes on destroy (*read*) · covers our angle: **partial** — `toSignal()` is not discussed · fetched 2026-10-13
- **Beyond the docs:** [Understanding Angular's Async Pipe](https://www.thinktecture.com/angular/understanding-the-async-pipe/) · Max Marschall (the page's author bio says Max Schulte), Thinktecture, 2021-07-14 · walks the pipe's source: any subscribable, disposal on destroy or when the bound object changes, `markForCheck()` on updates, which is why it works with `OnPush`; no `toSignal` · fetched 2026-10-13 (*read*)
- **Our delta:** when `toSignal()` is the better tool.

### T04-10 · Pure vs impure pipes — Understand · 🔲 not written
- **Read this:** [Pipe API, `pure`](https://angular.dev/api/core/Pipe) · angular.dev · "When true, the pipe is pure, meaning that the transform() method is invoked only when its input arguments change" (*read*) · covers our angle: **partial** — the Pipes guide adds that pipes are pure by default and warns against impure ones · fetched 2026-10-13
- **Beyond the docs:** [The essential difference between pure and impure pipes in Angular and why that matters](https://angularindepth.com/article/the-essential-difference-between-pure-and-impure-pipes-in-angular-and-/) · Max Koretskyi, Angular In Depth, 2017-09-01 · pure runs only when inputs change, impure on every digest cycle; `JsonPipe` and `SlicePipe` are impure because inputs can mutate; pre-Ivy but the rule has not changed · fetched 2026-10-13 (*read*)
- **Our delta:** writing a custom pipe that stays pure.

### T04-11 · `NgOptimizedImage` — Understand · 🔲 not written
- **Read this:** [Image optimization](https://angular.dev/guide/image-optimization) · angular.dev · `ngSrc`, `priority`, `fill` mode, placeholders, built-in loaders; "Angular displays a warning during development if the LCP element is an image that does not have the `priority` attribute" (*read*) · covers our angle: **partial** — one LCP warning is named; the others are not catalogued · fetched 2026-10-13
- **Also good:** [NgOptimizedImage API](https://angular.dev/api/common/NgOptimizedImage) · angular.dev · `fill`, `placeholder` and `placeholderConfig`, built-in Cloudflare, Cloudinary, ImageKit and Imgix loaders (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Boost Your App's Performance with NgOptimizedImage](https://angularindepth.com/article/boost-your-apps-performance-with-ngoptimizedimage/) · Jaroslaw Zolnowski, Angular In Depth, 2025-01-22 · `fill` needs a positioned parent, placeholder data URLs over 4000 characters raise NG02965, Imgix loader, and a before-and-after Lighthouse LCP run on the author's demo app; tagged angular 14 · fetched 2026-10-13 (*read*)
- **Our delta:** which dev warnings fire and what each fix is.

### T04-12 · `animate.enter` and `animate.leave` — Know · 🔲 not written
- **Read this:** [Animating your applications with animate.enter and animate.leave](https://angular.dev/guide/animations) · angular.dev · applies enter and leave CSS classes; sections "Element removal order" and "Compatibility with Legacy Angular Animations" (legacy animations cannot be mixed in the same component) (*read*; the old address angular.dev/guide/animations/enter-and-leave now only redirects here) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Migrating away from @angular/animations](https://angular.dev/guide/animations/migration) · angular.dev · "The `@angular/animations` package is deprecated as of v20.2"; says complex sequences and keyframes are possible in plain CSS (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Enter/Leave Animations in 2025: Old vs New](https://briantree.se/angulars-new-enter-leave-animation-api/) · Brian Treese, 2025-07-31 · the new API is plain CSS classes; reports a leave animation failing when the `@if` sits on the parent component, worked around by moving the `@if` inside; written when the API was new · fetched 2026-10-13 (*read*)
- **Our delta:** the syllabus row calls `@angular/animations` "still the answer for sequenced and keyframed animation", but the migration page says the opposite and marks the package deprecated since v20.2; settle the row's wording before writing.

---

## Phase 5 — Change detection and zoneless

### T05-01 · The dirty-checking model — Master · 🔲 not written
- **Read this:** [Skipping component subtrees](https://angular.dev/best-practices/skipping-subtrees) · angular.dev · "Angular runs change detection over your entire component tree" by default; `OnPush` subtrees are skipped unless an input changed (compared with `Object.is`) or an event fired inside; says `OnPush` is the default from v22 (*read*) · covers our angle: **partial** — which views are visited, not the previous-value comparison · fetched 2026-10-13
- **Also good:** [Runtime performance optimization](https://angular.dev/best-practices/runtime-performance) · angular.dev · "Angular walks your components from top to bottom, looking for changes"; does not use the term dirty checking (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Change Detection - How Does It Really Work?](https://angularindepth.com/article/angular-change-detection-how-does-it-really-work/) · Angular University, Angular In Depth, 2016-06-21 · one change detector per component forming a tree, each template expression compared with its previous value; predates Ivy, so internals differ today · fetched 2026-10-13 (*read*)
- **Our delta:** the framing that every other rule in phase 5 is about when the traversal starts and which views it visits.

### T05-02 · `provideZonelessChangeDetection()` — Master · 🔲 not written
- **Read this:** [Zoneless](https://angular.dev/guide/zoneless) · angular.dev · why use zoneless, enabling and removing ZoneJS, compatibility requirements, testing; "Zoneless is the default in Angular v21+" (*read*) · covers our angle: **partial** — lists notification sources but does not explain how the scheduler coalesces them · fetched 2026-10-13
- **Also good:** [provideZonelessChangeDetection API](https://angular.dev/api/core/provideZonelessChangeDetection) · angular.dev · one line: provides change detection without ZoneJS for an app bootstrapped with `bootstrapApplication` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Latest in Angular Change Detection – All You Need to Know](https://angular.love/the-latest-in-angular-change-detection-zoneless-signals) · Krzysztof Skorupka, angular.love, 2024-10-29 · the scheduler collects notifications and runs a single check, and a signal change marks the component's reactive consumer dirty, with the caveat that a template-bound event still marks the view; uses the experimental provider name · fetched 2026-10-13 (*read*)
- **Our delta:** what schedules a check when nothing patches `setTimeout`.

### T05-03 · Notification sources — Master · 🔲 not written
- **Read this:** [Zoneless, "Requirements for Zoneless compatibility"](https://angular.dev/guide/zoneless) · angular.dev · `markForCheck` (called by AsyncPipe), `ComponentRef.setInput`, a signal read in a template, bound host or template listeners, attaching a dirty view (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular Zoneless: Migrating off Zone.js without breaking your UI](https://dev.to/georgehulpoi/angular-zoneless-migrating-off-zonejs-without-breaking-your-ui-3cek) · Hulpoi George, DEV Community, 2025-12-27 · the cases that stop updating (a `setInterval` writing a plain field, a WebSocket `onmessage` handler) with signal or `markForCheck` fixes; promise chains get only a mention under edge cases · fetched 2026-10-13 (*read*)
- **Our delta:** the code that quietly notifies nothing, as a checklist.

### T05-04 · What zone.js patched, and what it cost — Understand · 🔲 not written
- **Read this:** [Zoneless, "Why use Zoneless?"](https://angular.dev/guide/zoneless) · angular.dev · over-frequent checks, payload and startup overhead, harder stack traces, fewer monkey patches (*read*) · covers our angle: **partial** — no mechanics of the patching · fetched 2026-10-13
- **Beyond the docs:** [Running change detection – Autorun with zones](https://angularindepth.com/article/running-change-detection-autorun-with-zones/) · Max Koretskyi, Angular In Depth, page shows 2024-05-20 · zones hook async tasks, `ApplicationRef` subscribes to `onMicrotaskEmpty` and calls `tick()` inside `zone.run`, JSONP escapes because it injects a script tag; the code shown is pre-Ivy · fetched 2026-10-13 (*read*)
- **Our delta:** the "zone ran change detection 400 times" diagnosis. No source quantifies the bundle cost to a standard I could verify.

### T05-05 · `ChangeDetectorRef` — Understand · 🔲 not written
- **Read this:** [ChangeDetectorRef API](https://angular.dev/api/core/ChangeDetectorRef) · angular.dev · `markForCheck` ("explicitly marks the view as changed so that it can be checked again"), `detectChanges` ("Checks this view and its children"), `detach`, `reattach` (*read*) · covers our angle: **partial** — no ranking of the four · fetched 2026-10-13
- **Beyond the docs:** [Running change detection – Manual control](https://angularindepth.com/article/running-change-detection-manual-control/) · Max Koretskyi, Angular In Depth, page shows 2024-05-20 · `markForCheck` flags views for a later cycle, `detectChanges` runs a check now; mentions detached views only in passing and does not rank the four · fetched 2026-10-13 (*read*)
- **Our delta:** which of the four is almost never right.

### T05-06 · `ExpressionChangedAfterItHasBeenCheckedError` — Understand · 🔲 not written
- **Read this:** [NG0100](https://angular.dev/errors/NG0100) · angular.dev · raised in development mode when a value changes after change detection; causes include a getter returning a different value per call and a child changing its parent; fix by setting initial values in the constructor or `ngOnInit` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Expression changed error – Overview](https://angularindepth.com/article/expression-changed-error-overview/) · Max Koretskyi, Angular In Depth, page shows 2024-05-20 · `checkNoChanges` re-evaluates bindings after the regular run; causes shown are a `Math.random()` getter, a child setting parent text in `ngAfterViewChecked`, and template order, where reordering makes it vanish · fetched 2026-10-13 (*read*)
- **Our delta:** each fix as a design fix, not a `setTimeout`.

### T05-07 · `afterNextRender()` and `afterEveryRender()` — Understand · 🔲 not written
- **Read this:** [afterNextRender API](https://angular.dev/api/core/afterNextRender) · angular.dev · callbacks run once, in the phases earlyRead, write, mixedReadWrite, read; browser only, not on the server; plus [afterEveryRender API](https://angular.dev/api/core/afterEveryRender) (same phases, every render) (*read*) · covers our angle: **partial** — neither page mentions the `afterRender` rename or an injection-context rule · fetched 2026-10-13
- **Beyond the docs:** [DOM reading and writing with new lifecycle hooks in Angular](https://dev.to/railsstudent/dom-reading-and-writing-with-new-lifecycle-hooks-in-angular-4n7e) · Connie Leung, DEV Community, 2023-09-10 · `afterNextRender` runs once like `AfterViewInit` but skips SSR; written for Angular 16 and uses the old `afterRender` name, now `afterEveryRender` · fetched 2026-10-13 (*read*)
- **Our delta:** the rename, and measurement here instead of `ngAfterViewInit`.

### T05-08 · Migrating an app to zoneless — Understand · 🔲 not written
- **Read this:** [Zoneless, "Requirements for Zoneless compatibility"](https://angular.dev/guide/zoneless) · angular.dev · OnPush-compatible components, remove `NgZone.onMicrotaskEmpty`, `onUnstable`, `isStable` and `onStable` (they never emit), `PendingTasks` for SSR, reactive forms need `markForCheck` or signals (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Preparing our Code for Zoneless Angular](https://dev.to/oz/preparing-our-code-for-zoneless-angular-4d30) · Evgeniy OZ, DEV Community, 2024-03-16 (first on Medium) · prerequisites are an OnPush-compatible app with reactive bindings on Angular 17.1 or later, and an emulation helper for libraries that still use the NgZone stability events (no library named); uses the private `ɵprovideZonelessChangeDetection` name; not a formal checklist · fetched 2026-10-13 (*read*)
- **Our delta:** the failure mode where one screen stops updating, with Hulpoi (T05-03) as the symptom list.

### T05-09 · `NgZone.runOutsideAngular()` and `run()` — Understand · 🔲 not written
- **Read this:** [Resolving zone pollution](https://angular.dev/best-practices/zone-pollution) · angular.dev · `runOutsideAngular` around a Plotly chart initialisation, `NgZone.isInAngularZone()` to check a handler, `ngZone.run` to re-enter before emitting (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Zoneless compatibility](https://angular.dev/guide/zoneless) · angular.dev · `NgZone.run` and `runOutsideAngular` stay compatible with zoneless, and removing them can cause performance regressions in libraries used by apps that still use ZoneJS (*read*) · fetched 2026-10-13
- **Our delta:** how much of this need disappears once zoneless. The earlier pass found no article better than the official page; I could not re-search (see the end note).

### T05-10 · `provideCheckNoChangesConfig()` — Know · 🔲 not written
- **Read this:** [provideCheckNoChangesConfig API](https://angular.dev/api/core/provideCheckNoChangesConfig) · angular.dev · `exhaustive` treats all views attached to `ApplicationRef` as if they were Default and surfaces errors hidden by `OnPush`; `interval` periodically runs `checkNoChanges`, useful in zoneless apps (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** the whole topic. The earlier pass found no third-party article on it; I could not re-search (see the end note).

### T05-11 · Profiling change detection — Know · 🔲 not written
- **Read this:** [Profiling with Chrome DevTools](https://angular.dev/best-practices/profiling-with-chrome-devtools) · angular.dev · `enableProfiling()` (or `ng.enableProfiling()` in the console) and the custom "Angular" track in the Performance panel (*read*) · covers our angle: **partial** — `startMeasuring` and `stopMeasuring` are not on this page · fetched 2026-10-13
- **Also good:** [Angular DevTools profiler](https://angular.dev/tools/devtools/profiler) · angular.dev · bar chart of change detection cycles (taller is slower), a flame graph view with the x-axis as the full cycle time, and a "Change detection" checkbox that greys out skipped components (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular profiler for performance tuning](https://www.angulartraining.com/daily-newsletter/angular-profiler-for-performance-tuning/) · Alain Chautard, Angular Newsletter, page shows 2023-04-20 (and also 2023-04-18) · record, then read taller bars as slower cycles to spot a component refreshed for no reason; describes a bar chart, not a flame chart; answers 406 to curl, readable in a browser · fetched 2026-10-13 (*read*)
- **Our delta:** reading the flame chart for a component checked hundreds of times a second; `startMeasuring`/`stopMeasuring` still need a source.

---

## Verifier notes (2026-10-13)

- All 70 distinct links were re-fetched; none returned a non-200 status. One angular.dev address (`/guide/animations/enter-and-leave`) is a client-side redirect page and was replaced with `/guide/animations`.
- The web search budget was spent before this pass could run its own searches, so the spot-check of blocks without a Beyond-the-docs line (T04-05, T05-09, T05-10) and the other weak blocks (T03-08, T04-08, T05-04) was not repeated; their gaps are inherited from the first pass, not re-confirmed.
