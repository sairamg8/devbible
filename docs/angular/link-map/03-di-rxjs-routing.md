---
title: "Link map · Angular · Part 3 (phases 6–7–8)"
sidebar_label: "03 · di rxjs routing"
sidebar_position: 3
---

# Link map · Angular · Part 3 (phases 6–7–8)

Covers every topic row of `docs/angular/syllabus/03-injection-streams-and-routing.md` in phase 6 (T06-01 to T06-14, dependency injection), phase 7 (T07-01 to T07-12, RxJS in Angular) and phase 8 (T08-01 to T08-16, routing). That is 42 rows. None has a page of our own yet: `docs/angular/pages/` holds only phase 0, so every block reads 🔲 not written.
*read* = the passage that supports the claim was read; *headings only* = fetched, page title and headings checked, body not read. Third-party links carry a date only where the page shows one. No `#anchors` are given.
Checking note: angular.dev is client-rendered and answers 200 even for a page that does not exist, so every angular.dev link was confirmed by its served page title (a missing page serves the title "Home"). rxjs.dev links were confirmed against its docs JSON, where a missing page returns 404. Two ANGULARarchitects links refuse plain `curl` but open in the page reader, which is how they were read.

🔴 **Version note.** Our syllabus targets **Angular 22.1.4** (`docs/angular/README.md`, verified 2026-08). angular.dev always serves the latest docs and is currently built at **v22.2.2**, so some pages describe 22.2 surface that the 22.1.4 pin lacks: `withRouterResources()` is marked developer preview since v22.2, and `withAutoCleanupInjectors()` is marked stable since v22.2 while `withExperimentalAutoCleanupInjectors()` is now deprecated in its favour. `withExperimentalPlatformNavigation()` is still marked highly experimental. `withViewTransitions()` is marked developer preview since v19.0. Several third-party picks are older and the block says so: the thoughtram and offering.solutions DI posts predate `inject()` and standalone; the switchMap family article is from 2018; the route-params article binds to `@Input`, not `input()`; `APP_INITIALIZER` is deprecated since v19 in favour of `provideAppInitializer`.
Search note: the verification pass could not run new web searches (the shared search budget was spent), so the blocks that carry no Beyond-the-docs line were not re-searched. They are T06-12, T07-09, T08-08 and T08-11.

---

## Phase 6 — Dependency injection

### T06-01 · `inject()` and the injection-context rule — Master · 🔲 not written
- **Read this:** [Injection context](https://angular.dev/guide/di/dependency-injection-context) · angular.dev · says `inject` retrieves dependencies only in an injection context, lists where one exists, and shows `runInInjectionContext` and `assertInInjectionContext` for calls from outside one (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [inject](https://angular.dev/api/core/inject) · angular.dev · the function's API reference (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Why is inject() better than constructor?](https://angularindepth.com/article/why-is-inject-better-than-constructor/) · Cansu Üstünel, Angular In Depth, 2025-09-03 · covers DI basics, then the injection context, then compares the two styles side by side, then inheritance and conditional injection · fetched 2026-10-13 (*headings only*)
- **Our delta:** why `inject()` replaced constructor parameters for most code, and the exact list of places it may be called.

### T06-02 · `@Injectable({providedIn: 'root'})` — Master · 🔲 not written
- **Read this:** [Creating and using services](https://angular.dev/guide/di/creating-and-using-services) · angular.dev · says a root-provided service is tree-shakable ("excluded from the final production bundle if your code never explicitly uses it") and that the v22 `@Service()` decorator is shorthand for `@Injectable({ providedIn: 'root' })` (*read*) · covers our angle: **partial** — does not say what `'root'` names · fetched 2026-10-13
- **Also good:** [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection) · angular.dev · says "root" is a special alias for the application's root `EnvironmentInjector`, and why `@Service()` tree-shakes better than the `ApplicationConfig` providers array (*read*) · [Injectable](https://angular.dev/api/core/Injectable) · angular.dev · the decorator's reference including `providedIn` (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Mastering Injectable Services: A Comprehensive Guide](https://angularindepth.com/article/mastering-injectable-services-a-comprehensive-guide/) · thomas, Angular In Depth, 2022-12-19 · builds a small app and uses source-map-explorer to compare a bootstrap-array provider with `providedIn: 'root'`; an unused root service is dropped from every bundle (main.js shrinks from 1018B to 874B); also covers route-level registration and per-component instances · fetched 2026-10-13 (*read*)
- **Also good:** [The new Treeshakable Providers API in Angular](https://www.angulararchitects.io/blog/the-new-treeshakable-providers-api-in-angular/) · Manfred Steyer, ANGULARarchitects, 3 April 2019 · says `providedIn` names a scope and `'root'` is "just a shortcut for the root injector's scope"; written when the API was new, so NgModule-era wording · fetched 2026-10-13 (*read*)
- **Our delta:** what `'root'` actually names, and the proof that an unused service leaves the bundle.

### T06-03 · The two injector trees — Master · 🔲 not written
- **Read this:** [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection) · angular.dev · resolves in two phases, the element injector hierarchy first and then the environment injector hierarchy, and throws if neither has the provider (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Debugging and troubleshooting DI](https://angular.dev/guide/di/debugging-and-troubleshooting-di) · angular.dev · the page to read next to a `NullInjectorError`: provider scope mismatch, lazy-route injectors, multiple instances (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Cracking Angular DI: The Hidden Layers of Injectors](https://angularindepth.com/article/cracking-angular-di-the-hidden-layers-of-injectors/) · Dmitry Drobyshev, Angular In Depth, 2024-11-05 · starts from a toy `ModuleInjector` class to show how providers are stored and looked up, then covers core injectors, node injectors, environment injectors and route environment injectors (the toy class uses the older module-injector name) · fetched 2026-10-13 (*read*)
- **Our delta:** reading a `NullInjectorError` and saying which injector was asked, in which order.

### T06-04 · Provider kinds — Understand · 🔲 not written
- **Read this:** [Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers) · angular.dev · `useClass`, `useValue`, `useFactory` with a `deps` array (including optional deps) and `useExisting`, plus the `useExisting` versus `useClass` instance difference (the old `dependency-injection-providers` URL redirects here) (*read*) · covers our angle: **partial** — no guidance on when a factory is a code smell · fetched 2026-10-13
- **Also good:** [FactoryProvider](https://angular.dev/api/core/FactoryProvider) · angular.dev · the factory form with its `deps` array (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Using UseClass, UseFactory, UseValue and UseExisting With Treeshakeable Providers in Angular](https://offering.solutions/blog/articles/2018/08/17/using-useclass-usefactory-usevalue-useexisting-with-treeshakeable-providers-in-angular/) · offering.solutions, 2018-08-17 · worked example of each kind; 2018, so no `inject()` · fetched 2026-10-13 (*headings only*)
- **Our delta:** when a factory is the honest choice and when it is a code smell.

### T06-05 · `InjectionToken` — Master · 🔲 not written
- **Read this:** [InjectionToken](https://angular.dev/api/core/InjectionToken) · angular.dev · use it when the injected type has no runtime form, such as an interface; optional `providedIn` and `factory` options give a default; two separate `new InjectionToken` calls are different tokens even with the same description and cause a `NullInjectorError` (*read*) · covers our angle: **partial** — config-object pattern not shown · fetched 2026-10-13
- **Beyond the docs:** [How to prevent name collisions in Angular providers](https://blog.thoughtram.io/angular/2016/05/23/opaque-tokens-in-angular-2.html) · Pascal Precht, thoughtram, 2016-05-23 · string tokens versus type tokens and why string tokens collide; written for `OpaqueToken`, which the page itself says is deprecated in favour of `InjectionToken` since Angular 4 · fetched 2026-10-13 (*read*)
- **Our delta:** the typed token with a factory default and the config-object pattern.

### T06-06 · `DestroyRef` and `takeUntilDestroyed()` — Master · 🔲 not written
- **Read this:** [takeUntilDestroyed](https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed) · angular.dev · completes the observable when the calling context is destroyed; pass a `DestroyRef` to use it outside an injection context; stable since v19.0 (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [DestroyRef](https://angular.dev/api/core/DestroyRef) · angular.dev · `onDestroy` registers a callback and returns a cleanup function; `destroyed` flag (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Understanding takeUntilDestroyed in Angular](https://dev.to/geromegrignon/understanding-takeuntildestroyed-in-angular-3kih) · Jérôme Grignon, DEV Community, 2025-08-18 · short; shows injecting `DestroyRef` and passing it when you are outside an injection context · fetched 2026-10-13 (*read*)
- **Our delta:** one subscription pattern to standardise on, tied to the injector's lifetime.

### T06-07 · Resolution modifiers — Understand · 🔲 not written
- **Read this:** [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection) · angular.dev · resolution modifiers section: `optional`, `self`, `skipSelf`, `host`, used through the `inject` configuration, and which may be combined (*read*) · covers our angle: **partial** — the parent-directive pattern is not the focus · fetched 2026-10-13
- **Beyond the docs:** [Dependency Injection in Angular – everything you need to know](https://angular.love/en/dependency-injection-in-angular-everything-you-need-to-know) · angular.love, 25 Mar 2024 · explains `@Self` (stay in own element injector or throw NOT_FOUND), `@SkipSelf` (start at the parent) and `@Host` with a two-directive example; decorator form, not the `inject()` options form · fetched 2026-10-13 (*read*)
- **Our delta:** the `inject()` options form (`{optional: true}` and so on) and the parent-directive pattern each modifier exists for.

### T06-08 · Multi providers — Understand · 🔲 not written
- **Read this:** [Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers) · angular.dev · "Multiple providers" section: `multi: true` makes injection return an array of all contributed values (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Intercepting requests and responses](https://angular.dev/guide/http/interceptors) · angular.dev · has a section on DI-based interceptors registered through the `HTTP_INTERCEPTORS` multi provider, which run in the order their providers are registered (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Multi Providers in Angular](https://blog.thoughtram.io/angular2/2015/11/23/multi-providers-in-angular-2.html) · Pascal Precht, thoughtram, 2015-11-23 · the original explanation of one token holding many values; 2015, so pre-`InjectionToken` syntax · fetched 2026-10-13 (*read*)
- **Our delta:** why order is the caller's problem.

### T06-09 · `EnvironmentInjector` and `runInInjectionContext()` — Understand · 🔲 not written
- **Read this:** [Injection context](https://angular.dev/guide/di/dependency-injection-context) · angular.dev · inject an `EnvironmentInjector` into a service and wrap calls in `runInInjectionContext` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [EnvironmentInjector](https://angular.dev/api/core/EnvironmentInjector) · angular.dev (*headings only*) · [runInInjectionContext](https://angular.dev/api/core/runInInjectionContext) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Inject() over constructor DI cases in Angular](https://angularindepth.com/article/inject-over-constructor-di-cases-in-angular/) · Oleksandr, Angular In Depth, 2025-04-14 · five situations where `inject()`, often with `runInInjectionContext`, beats a constructor · fetched 2026-10-13 (*read*)
- **Our delta:** creating a scoped injector, not only using one.

### T06-10 · `makeEnvironmentProviders()` and your own `provideX()` — Understand · 🔲 not written
- **Read this:** [makeEnvironmentProviders](https://angular.dev/api/core/makeEnvironmentProviders) · angular.dev · wraps providers so they cannot be put in a component's `providers` by mistake (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Patterns for Custom Standalone APIs in Angular](https://angularindepth.com/article/patterns-for-custom-standalone-apis-in-angular/) · Manfred Steyer, Angular In Depth, 2023-01-16 · a worked `provideLogger(config)` that merges options with defaults and returns `makeEnvironmentProviders`, with multi providers inside; also names the feature, configuration-factory and NgModule-bridge patterns · fetched 2026-10-13 (*read*)
- **Our delta:** why this beats exporting a raw provider array.

### T06-11 · Route-level and component-level providers — Understand · 🔲 not written
- **Read this:** [Debugging and troubleshooting DI](https://angular.dev/guide/di/debugging-and-troubleshooting-di) · angular.dev · a lazy route's `providers` get a child injector that persists after you leave; a component's `providers` give one instance per component instance (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Customizing route behavior](https://angular.dev/guide/routing/customizing-route-behavior) · angular.dev · route injectors are not destroyed by default; `withAutoCleanupInjectors()` (stable since v22.2) turns on cleanup (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Mastering Injectable Services: A Comprehensive Guide](https://angularindepth.com/article/mastering-injectable-services-a-comprehensive-guide/) · thomas, Angular In Depth, 2022-12-19 · its "Services with Multiple Instances" section (a service in a component's `providers` gets one instance per component) and "Route-Level Registration" section (the service is created on first visit and is not disposed on leaving the route) · fetched 2026-10-13 (*read*)
- **Our delta:** the two scoping mistakes behind "why do I have three of these?".

### T06-12 · Application initialisers — Understand · 🔲 not written
- **Read this:** [provideAppInitializer](https://angular.dev/api/core/provideAppInitializer) · angular.dev · a Promise or Observable returned from the initializer is awaited before initialization completes (*read*) · covers our angle: **partial** — "before the first render" is an inference, not documented wording · fetched 2026-10-13
- **Also good:** [APP_INITIALIZER](https://angular.dev/api/core/APP_INITIALIZER) · angular.dev · the token, deprecated since v19.0 in favour of `provideAppInitializer` (*read*) · [provideEnvironmentInitializer](https://angular.dev/api/core/provideEnvironmentInitializer) · angular.dev (*headings only*) · fetched 2026-10-13
- **Our delta:** async setup before first render, and which of the two initialiser functions to pick. The only third-party hits in the researcher's search were upgrade logs and config-loading posts; none judged better than the API page. Not re-searched in verification.

### T06-13 · `injectAsync()` — Know · 🔲 not written
- **Read this:** [Lazy loading services](https://angular.dev/guide/di/lazy-loading-services) · angular.dev · `injectAsync` with a `prefetch` option; the service must be auto-provided; the chunk is fetched on first call and then reused; prefetch is opportunistic (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [injectAsync](https://angular.dev/api/core/injectAsync) · angular.dev · stable since v22.0 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Lazy Loading Services in Angular 22](https://angularindepth.com/article/lazy-loading-services-in-angular-22/) · Mateusz Stefańczyk, Angular In Depth, 2026-08-11 · explains that services were the gap in lazy loading and how `injectAsync` closes it, with examples from an offer editor; includes checking the separate chunk in the Network tab · fetched 2026-10-13 (*read*)
- **Our delta:** the bundle effect, and the requirement that the service be auto-provided.

### T06-14 · The `@Service` decorator and idle scheduling — When Needed · 🔲 not written
- **Read this:** [onIdle](https://angular.dev/api/core/onIdle) · angular.dev · prefetch trigger, stable since v22.0; delegates to the configured `IdleService`, which defaults to `requestIdleCallback` with a `setTimeout` fallback, replaceable with `provideIdleServiceWith` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Creating and using services](https://angular.dev/guide/di/creating-and-using-services) · angular.dev · has the `@Service` versus `@Injectable` comparison table (*read*) · [Service](https://angular.dev/api/core/Service) · angular.dev (*headings only*) · [IdleService](https://angular.dev/api/core/IdleService) · angular.dev (*headings only*) · [provideIdleServiceWith](https://angular.dev/api/core/provideIdleServiceWith) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Lazy Loading Services in Angular 22](https://angularindepth.com/article/lazy-loading-services-in-angular-22/) · Mateusz Stefańczyk, Angular In Depth, 2026-08-11 · shows `onIdle` as the built-in prefetch trigger, capping its wait with a timeout, and swapping idle detection with `provideIdleServiceWith` · fetched 2026-10-13 (*read*)
- **Our delta:** recognising these names in release notes.

---

## Phase 7 — RxJS in Angular

### T07-01 · Observable vs signal — the boundary — Master · 🔲 not written
- **Read this:** [Signals interop](https://angular.dev/ecosystem/rxjs-interop) · angular.dev · `toSignal` and `toObservable`, the two bridges (*read*) · covers our angle: **partial** — no decision rule for the ambiguous cases · fetched 2026-10-13
- **Beyond the docs:** [Angular Signals vs RxJS: Should You Replace RxJS in Real Apps?](https://www.syncfusion.com/blogs/post/angular-signals-vs-rxjs) · Arunachalam Kandasamy Raja, Syncfusion Blogs, 2026-08-27 · answers "should signals replace RxJS completely" with "No" and lists the pain points that make people want to; vendor blog, but it gives a hybrid architecture and a decision checklist · fetched 2026-10-13 (*read*)
- **Our delta:** settling form value, route params and a websocket feed one by one.

### T07-02 · The operators an Angular app actually uses — Master · 🔲 not written
- **Read this:** [RxJS Operators](https://rxjs.dev/guide/operators) · rxjs.dev · the operator guide: pipeable operators versus creation functions (*read*) · covers our angle: **partial** — a full catalogue, not the short list we want · fetched 2026-10-13
- **Also good:** [debounceTime](https://rxjs.dev/api/index/function/debounceTime) · [combineLatest](https://rxjs.dev/api/index/function/combineLatest) · [catchError](https://rxjs.dev/api/index/function/catchError) · rxjs.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Operators | Learn RxJS](https://www.learnrxjs.io/learn-rxjs/operators) · learnrxjs.io · lists every operator in eight categories with examples and marks the commonly used ones with a star, which is the nearest thing to a short list; the page names no author and the share example it shows is RxJS 6 style · fetched 2026-10-13 (*read*)
- **Our delta:** the twelve-operator working set.

### T07-03 · The four flattening operators — Master · 🔲 not written
- **Read this:** [switchMap](https://rxjs.dev/api/index/function/switchMap) · [concatMap](https://rxjs.dev/api/index/function/concatMap) · [mergeMap](https://rxjs.dev/api/index/function/mergeMap) · [exhaustMap](https://rxjs.dev/api/index/function/exhaustMap) · rxjs.dev · one reference page per operator (*headings only*) · covers our angle: **partial** — no side-by-side · fetched 2026-10-13
- **Beyond the docs:** [RxJs Mapping: switchMap vs mergeMap vs concatMap vs exhaustMap](https://angularindepth.com/article/rxjs-mapping-switchmap-vs-mergemap-vs-concatmap-vs-exhaustmap/) · Angular University, Angular In Depth, 2018-07-12 · one article comparing the four on the same input; RxJS 6 era, so import style differs · fetched 2026-10-13 (*headings only*)
- **Also good:** [SwitchMap, MergeMap, ConcatMap and ExhaustMap Explained](https://offering.solutions/blog/articles/2021/03/08/switchmap-mergemap-concatmap-exhaustmap-explained/) · offering.solutions, 2021-03-08 · another comparison (*headings only*) · fetched 2026-10-13
- **Our delta:** tying each operator to the search box, the upload queue and the double-submitted form.

### T07-04 · Subscription management — Master · 🔲 not written
- **Read this:** [takeUntilDestroyed](https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed) · angular.dev (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [AsyncPipe](https://angular.dev/api/common/AsyncPipe) · angular.dev · subscribes to an Observable or Promise and unsubscribes when the component is destroyed (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Understanding takeUntilDestroyed in Angular](https://dev.to/geromegrignon/understanding-takeuntildestroyed-in-angular-3kih) · Jérôme Grignon, DEV Community, 2025-08-18 · the one-operator replacement for the `ngOnDestroy` boilerplate (*read*) · fetched 2026-10-13
- **Our delta:** the few cases that justify a hand-held `Subscription`.

### T07-05 · Creation functions — Understand · 🔲 not written
- **Read this:** [defer](https://rxjs.dev/api/index/function/defer) · rxjs.dev · calls an observable factory for each new subscriber, so each gets a fresh observable (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [timer](https://rxjs.dev/api/index/function/timer) · [fromEvent](https://rxjs.dev/api/index/function/fromEvent) · rxjs.dev (*headings only*) · fetched 2026-10-13
- **Our delta:** `defer` for a stream that must not start early. A DEV Community tour of creation functions (2020) was dropped in verification: it never mentions `defer`, the one function this row stresses.

### T07-06 · Subjects — Understand · 🔲 not written
- **Read this:** [Subject](https://rxjs.dev/guide/subject) · rxjs.dev · the guide covering Subject, BehaviorSubject and ReplaySubject (also AsyncSubject) (*read*) · covers our angle: **partial** — nothing on signals replacing a state-holding `BehaviorSubject` · fetched 2026-10-13
- **Our delta:** when a `BehaviorSubject` should be a `signal`. The Syncfusion article in T07-01 argues the same point at length. A Certificates.dev comparison of the three subjects was dropped in verification: the article is only a few paragraphs, too thin to beat the official guide.

### T07-07 · Error handling — Understand · 🔲 not written
- **Read this:** [catchError](https://rxjs.dev/api/index/function/catchError) · rxjs.dev · the selector returns a replacement observable or throws (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [retry](https://rxjs.dev/api/index/function/retry) · rxjs.dev · the `count` form and the `RetryConfig` form (*read*) · fetched 2026-10-13
- **Beyond the docs:** [RxJS and Angular - using exponential backoff](https://angular.love/power-of-rxjs-when-using-exponential-backoff) · angular.love, 04 Jun 2018 · a retry-with-backoff recipe; written before `retry` took a config object, so it builds backoff by hand · fetched 2026-10-13 (*headings only*)
- **Our delta:** the stream-is-dead rule and `retry({count, delay})`.

### T07-08 · Hot vs cold, and `shareReplay` — Understand · 🔲 not written
- **Read this:** [shareReplay](https://rxjs.dev/api/index/function/shareReplay) · rxjs.dev · the `refCount` option: by default it does not unsubscribe from the source when the subscriber count drops to zero (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Share / ShareReplay / RefCount](https://angularindepth.com/article/share-sharereplay-refcount/) · thomas, Angular In Depth, 2023-08-01 · three worked examples comparing `share`, `shareReplay` with `refCount: true` and `shareReplay` with `refCount: false` · fetched 2026-10-13 (*headings only*)
- **Also good:** [Cold vs Hot Observables](https://blog.thoughtram.io/angular/2016/06/16/cold-vs-hot-observables.html) · Christoph Burgdorf, thoughtram, 2016-06-16 · the classic cold versus hot explanation; RxJS 5 era (*read*) · fetched 2026-10-13
- **Our delta:** why two subscribers made two HTTP requests, and the leak in the non-`refCount` form.

### T07-09 · `toSignal()` patterns — Understand · 🔲 not written
- **Read this:** [Signals interop](https://angular.dev/ecosystem/rxjs-interop) · angular.dev · `toSignal`, `initialValue`, the `requireSync` option, custom `equal`, and an "Error and Completion" section: an error from the source is thrown when the signal is read, and on completion the signal keeps the last value (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [ToSignalOptions](https://angular.dev/api/core/rxjs-interop/ToSignalOptions) · angular.dev · the options are `initialValue`, `requireSync`, `injector`, `manualCleanup`, `equal` and `debugName`; there is no error-handling option on the current page (*read*) · fetched 2026-10-13
- **Our delta:** what happens to an error thrown by the source. No third-party deep dive found by the researcher; not re-searched in verification.

### T07-10 · Anti-patterns — Understand · 🔲 not written
- **Read this:** [Subject](https://rxjs.dev/guide/subject) · rxjs.dev (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [RxJS in Angular - Antipattern 1 - Nested subscriptions](https://www.thinktecture.com/en/angular/rxjs-antipattern-1-nested-subs/) · Yannick Baron, Thinktecture, 2019-11-01 · shows a customer, address and order lookup nested in `subscribe` callbacks and flattens it with `switchMap` and `map` · fetched 2026-10-13 (*read*)
- **Our delta:** subscribing in `ngOnInit` to assign a field, a `Subject` used as a store, and `async` on one source three times.

### T07-11 · Multicasting beyond `shareReplay` — Know · 🔲 not written
- **Read this:** [share](https://rxjs.dev/api/index/function/share) · rxjs.dev · reset options such as `resetOnRefCountZero`, with a timer example (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [connectable](https://rxjs.dev/api/index/function/connectable) · rxjs.dev · multicasts once `connect()` is called (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Share / ShareReplay / RefCount](https://angularindepth.com/article/share-sharereplay-refcount/) · thomas, Angular In Depth, 2023-08-01 · the `refCount` true and false cases walked through side by side, which is the recurring question; it stops at `share` and `shareReplay` and does not cover `connectable` · fetched 2026-10-13 (*headings only*)
- **Our delta:** why the `refCount` question keeps coming back.

### T07-12 · Testing streams — Know · 🔲 not written
- **Read this:** [Testing RxJS Code with Marble Diagrams](https://rxjs.dev/guide/testing/marble-testing) · rxjs.dev · the `testScheduler.run` helpers `cold`, `time`, `expectObservable` and `expectSubscriptions` (*read*) · covers our angle: **partial** — nothing on when `fakeAsync` is simpler · fetched 2026-10-13
- **Also good:** [TestScheduler](https://rxjs.dev/api/testing/TestScheduler) · rxjs.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [How I Write Marble Tests For RxJS Observables In Angular](https://mokkapps.de/blog/how-i-write-marble-tests-for-rxjs-observables-in-angular) · Michael Hoffmann, 2018-11-12 (the page shows it as 11/12/2018; its structured data says 2018-11-12) · a worked Angular marble test with `getTestScheduler().flush()` and an explanation of `TestScheduler`; 2018, so uses the pre-`run` style · fetched 2026-10-13 (*read*)
- **Our delta:** choosing `fakeAsync` and `tick` when marbles are overkill.

---

## Phase 8 — Routing

### T08-01 · `provideRouter()` and the `Routes` array — Master · 🔲 not written
- **Read this:** [Define routes](https://angular.dev/guide/routing/define-routes) · angular.dev (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [provideRouter](https://angular.dev/api/router/provideRouter) · [Routes](https://angular.dev/api/router/Routes) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Routing and Lazy Loading with Angular's Standalone Components](https://angularindepth.com/article/routing-and-lazy-loading-with-angulars-standalone-components/) · Manfred Steyer, Angular In Depth, 2022-05-25 · routes as plain arrays with no NgModule, written at the standalone introduction; read for the shape of a route table (*read*) · fetched 2026-10-13
- **Our delta:** how features compose into a real route table.

### T08-02 · `RouterOutlet` and nested routes — Understand · 🔲 not written
- **Read this:** [Show routes with Outlets](https://angular.dev/guide/routing/show-routes-with-outlets) · angular.dev (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [RouterOutlet](https://angular.dev/api/router/RouterOutlet) · angular.dev · the outlet, named outlets and the secondary route `outlet` property (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Introduction to Angular Routing](https://coryrylan.com/blog/introduction-to-angular-routing) · Cory Rylan, 2016-04-02 (updated 2023-11-24) · "we can think of our application as a tree structure" of components and the routes the same way, with a child outlet in a nested view; the page warns APIs may have changed, and its code is NgModule-era (`RouterModule.forRoot`, `bootstrapModule`) · fetched 2026-10-13 (*read*)
- **Our delta:** child outlets and the missing-outlet pitfall.

### T08-03 · `routerLink` and `RouterLinkActive` — Understand · 🔲 not written
- **Read this:** [Navigate to routes](https://angular.dev/guide/routing/navigate-to-routes) · angular.dev · `RouterLink` as the declarative navigation approach on standard anchor elements (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [RouterLinkActive](https://angular.dev/api/router/RouterLinkActive) · [RouterLink](https://angular.dev/api/router/RouterLink) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [RouterLink, RouterLinkActive – the basics in Angular](https://angularindepth.com/article/routerlink-routerlinkactive-the-basics-in-angular/) · Jakub Bryska, Angular In Depth, 2026-03-04 · replaces `href` with `routerLink`, shows `exact` matching so a `/user` link is not active on sub-pages, and covers `relativeTo` · fetched 2026-10-13 (*read*)
- **Our delta:** why `href` alone breaks the SPA.

### T08-04 · Lazy loading — Master · 🔲 not written
- **Read this:** [Route Loading Strategies](https://angular.dev/guide/routing/loading-strategies) · angular.dev · `loadComponent` lazily loads a component when the route becomes active; `loadChildren` lazily loads child routes during matching (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Routing and Lazy Loading with Angular's Standalone Components](https://angularindepth.com/article/routing-and-lazy-loading-with-angulars-standalone-components/) · Manfred Steyer, Angular In Depth, 2022-05-25 · `loadComponent` for one component and `loadChildren` pointing straight at a routes array (*read*) · fetched 2026-10-13
- **Our delta:** what actually lands in the chunk, and how to verify it in the build output and the network panel.

### T08-05 · Route parameters and `withComponentInputBinding()` — Master · 🔲 not written
- **Read this:** [withComponentInputBinding](https://angular.dev/api/router/withComponentInputBinding) · angular.dev · binds query params, path and matrix params, static route data and resolver data to inputs; resolver data has the highest precedence; an input with no matching key is set to `undefined` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Read route state](https://angular.dev/guide/routing/read-route-state) · angular.dev · `ActivatedRoute` for reading the current route (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Binding Angular Route Params to Component @Input](https://ultimatecourses.com/blog/binding-angular-route-params-to-component-inputs) · Todd Motto, Ultimate Courses, 2023-11-23 · walks through the feature; uses `@Input`, so for the `input()` form read the API page · fetched 2026-10-13 (*read*)
- **Our delta:** doing it with `input()` signals.

### T08-06 · Guards as functions — Master · 🔲 not written
- **Read this:** [Control route access with guards](https://angular.dev/guide/routing/route-guards) · angular.dev · the four guard types, the shared return types (boolean, `UrlTree` or `RedirectCommand`, Promise or Observable), and the order rule: guards in an array are started in array order but run concurrently, and the array order only decides which result takes priority (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [CanActivateFn](https://angular.dev/api/router/CanActivateFn) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Guards and resolvers – Controlling Navigation Flow](https://angularindepth.com/article/guards-and-resolvers-controlling-navigation-flow/) · Jakub Bryska, Angular In Depth, 2026-05-26 · lists the return types (boolean, `UrlTree`, route command, Promise or Observable) and each guard type with a function example. Caution: it says multiple guards "run sequentially in the order they appear", which contradicts the official guide above, so do not copy that sentence · fetched 2026-10-13 (*read*)
- **Our delta:** the order guards run in. The official guide says concurrent start with array-order priority; the third-party article says sequential, so write the official wording.

### T08-07 · `CanMatch` vs `CanActivate` — Understand · 🔲 not written
- **Read this:** [Control route access with guards](https://angular.dev/guide/routing/route-guards) · angular.dev · "CanMatch behaves differently": a `false` makes Angular try other matching routes instead of blocking navigation; suggested for feature flags, A/B testing and conditional route loading (*read*) · covers our angle: **partial** — does not say the lazy chunk is never fetched · fetched 2026-10-13
- **Also good:** [CanMatchFn](https://angular.dev/api/router/CanMatchFn) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Guards and resolvers – Controlling Navigation Flow](https://angularindepth.com/article/guards-and-resolvers-controlling-navigation-flow/) · Jakub Bryska, Angular In Depth, 2026-05-26 · states that a `false` from `CanMatch` triggers a search for other route matches instead of halting navigation, and shows two routes on the same path with different `canMatch` guards choosing an admin or user dashboard (*read*) · fetched 2026-10-13
- **Our delta:** the lazy chunk is never fetched when `CanMatch` fails, which is the auth and feature-flag case; no page read states that outright, so prove it in the network panel. Feature-flag walk-through: [Consuming .NET Feature Flags within an Angular Application](https://timdeschryver.dev/blog/consuming-net-feature-flags-within-an-angular-application) · Tim Deschryver, 2024-05-30 · has a `CanMatch` section for putting a new implementation behind a flag (*read*).

### T08-08 · Query parameters and `NavigationExtras` — Understand · 🔲 not written
- **Read this:** [NavigationExtras](https://angular.dev/api/router/NavigationExtras) · angular.dev · lists `queryParamsHandling`, `preserveFragment`, `state`, `replaceUrl` among its options (*read*) · covers our angle: **partial** — the prose behind each option is not read · fetched 2026-10-13
- **Also good:** [Read route state](https://angular.dev/guide/routing/read-route-state) · angular.dev · reading query parameters (*headings only*) · fetched 2026-10-13
- **Our delta:** reading them without a subscription. No third-party pick better than the API page was found by the researcher; not re-searched in verification.

### T08-09 · Resolvers — Understand · 🔲 not written
- **Read this:** [Route data resolvers](https://angular.dev/guide/routing/data-resolvers) · angular.dev · a `ResolveFn` runs before a route activates, and a resolver can return a `RedirectCommand` on a failed fetch (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Data fetching with resources](https://angular.dev/guide/routing/data-fetching-with-resources) · angular.dev · `withRouterResources()` as the signal-based alternative, best paired with `withComponentInputBinding()` (*read*) · [withRouterResources](https://angular.dev/api/router/withRouterResources) · angular.dev · developer preview since v22.2 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Router Resources: Loading Data with the Angular Router](https://www.angulararchitects.io/en/blog/router-resources-loading-data-with-the-angular-router/) · Manfred Steyer, ANGULARarchitects, September 8, 2026 · signal-based resolvers that start in parallel; the page says Router Resources ship in Angular 22.2 as a developer preview, so it is **newer than our 22.1.4 target** · fetched 2026-10-13 (*read*)
- **Our delta:** the honest argument that most resolvers should be a `resource()` in the component.

### T08-10 · Route `data`, `title` and `TitleStrategy` — Understand · 🔲 not written
- **Read this:** [TitleStrategy](https://angular.dev/api/router/TitleStrategy) · angular.dev · `buildTitle` returns the title of the deepest primary route; extend the class and implement `updateTitle` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Setting Page Titles Natively With The Angular Router](https://dev.to/brandontroberts/setting-page-titles-natively-with-the-angular-router-393j) · Brandon Roberts, DEV Community, 2022-02-01 · introduces the route `title` property and the built-in strategy added in v14 · fetched 2026-10-13 (*read*)
- **Our delta:** static `data`, and a suffix or translated title.

### T08-11 · Redirects, wildcards and `pathMatch` — Understand · 🔲 not written
- **Read this:** [Redirecting routes](https://angular.dev/guide/routing/redirecting-routes) · angular.dev · `redirectTo`, the `**` wildcard, and an "Understanding pathMatch" section on `full` versus `prefix` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Route](https://angular.dev/api/router/Route) · angular.dev · `pathMatch` defaults to `prefix`; an empty-path redirect needs `full` because an empty path is a prefix of any URL and would loop (*read*) · fetched 2026-10-13
- **Our delta:** precisely what `full` compares against. The best-known third-party explanation (Victor Savkin on DZone) is blocked to the page reader, so it is not linked. Not re-searched in verification.

### T08-12 · `withViewTransitions()` — Understand · 🔲 not written
- **Read this:** [withViewTransitions](https://angular.dev/api/router/withViewTransitions) · angular.dev · wraps route activation and deactivation in `document.startViewTransition`, with no transition where the browser lacks support; developer preview since v19.0 (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [ViewTransitionsFeatureOptions](https://angular.dev/api/router/ViewTransitionsFeatureOptions) · angular.dev · `onViewTransitionCreated` and `skipInitialTransition` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [View transitions for single page applications](https://web.dev/learn/css/view-transitions-spas) · web.dev, last updated 2025-08-27 · has a "Respecting prefers-reduced-motion" section explaining why full-screen animation can harm users with vestibular disorders; platform-level, not Angular-specific · fetched 2026-10-13 (*read*)
- **Our delta:** opting a single navigation out, and the reduced-motion obligation inside Angular's hook.

### T08-13 · Scroll behaviour — Understand · 🔲 not written
- **Read this:** [InMemoryScrollingOptions](https://angular.dev/api/router/InMemoryScrollingOptions) · angular.dev · `scrollPositionRestoration` (disabled, enabled or top) and `anchorScrolling` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Angular Scroll Position Restoration](https://angular.love/angular-scroll-position-restoration) · angular.love, 2024-07-23 · shows `withInMemoryScrolling({scrollPositionRestoration: 'enabled'})` restoring a list position, then explains where it falls short and writes a custom fix · fetched 2026-10-13 (*read*)
- **Our delta:** why a virtualised list needs help.

### T08-14 · Router events and debugging — Understand · 🔲 not written
- **Read this:** [Lifecycle and events](https://angular.dev/guide/routing/lifecycle-and-events) · angular.dev · the navigation event sequence, with `NavigationCancel` (often a guard returning false) and `NavigationError` (invalid routes, resolver errors) as the two error events (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [NavigationCancellationCode](https://angular.dev/api/router/NavigationCancellationCode) · angular.dev · the enum of cancel reasons: `Redirect`, `SupersededByNewNavigation`, `NoDataFromResolver`, `GuardRejected`, `Aborted` (*read*) · [withDebugTracing](https://angular.dev/api/router/withDebugTracing) · angular.dev (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Navigating Angular Router Events: The Sweet Sixteen](https://www.herodevs.com/blog-posts/navigating-angular-router-events-the-sweet-sixteen) · HeroDevs, Dec 7, 2022 · lists the router events in order and how to subscribe for debugging; 2022, so it turns on tracing with the old `enableTracing` option rather than `withDebugTracing` · fetched 2026-10-13 (*read*)
- **Our delta:** the cancel-versus-error split and the cancellation codes.

### T08-15 · Named outlets and auxiliary routes — Know · 🔲 not written
- **Read this:** [RouterOutlet](https://angular.dev/api/router/RouterOutlet) · angular.dev · named outlets and the secondary route `outlet` property (*read*) · covers our angle: **partial** — the `(name:path)` URL syntax is not confirmed there · fetched 2026-10-13
- **Beyond the docs:** [Auxiliary Routes in Angular](https://angularindepth.com/article/auxiliary-routes-in-angular/) · Muhammad Awais, Angular In Depth, 2024-11-10 · defining named outlets, the `outlet` property, and that outlet names must be unique within a component · fetched 2026-10-13 (*read*)
- **Our delta:** why this is rarer than it looks.

### T08-16 · The remaining router features — Know · 🔲 not written
- **Read this:** [withPreloading](https://angular.dev/api/router/withPreloading) · angular.dev · stable (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [withHashLocation](https://angular.dev/api/router/withHashLocation) · [withNavigationErrorHandler](https://angular.dev/api/router/withNavigationErrorHandler) · [withEnabledBlockingInitialNavigation](https://angular.dev/api/router/withEnabledBlockingInitialNavigation) · angular.dev (*headings only*) · [withExperimentalPlatformNavigation](https://angular.dev/api/router/withExperimentalPlatformNavigation) · angular.dev, experimental since v21.1 and flagged "highly experimental and should not be used in production" (*read*) · [withExperimentalAutoCleanupInjectors](https://angular.dev/api/router/withExperimentalAutoCleanupInjectors) · angular.dev, now deprecated in favour of [withAutoCleanupInjectors](https://angular.dev/api/router/withAutoCleanupInjectors), stable since v22.2 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Route preloading strategies in Angular](https://web.dev/articles/route-preloading-in-angular) · web.dev, last updated 2019-07-09 · compares `PreloadAllModules` with a link-based Quicklink strategy; NgModule-era, and it does not mention `withPreloading` · fetched 2026-10-13 (*read*)
- **Our delta:** labelling the last two features experimental and not shipping them. Version caution: on the 22.2 docs the cleanup feature has graduated to `withAutoCleanupInjectors`, so the syllabus wording is right for 22.1.4 only.
