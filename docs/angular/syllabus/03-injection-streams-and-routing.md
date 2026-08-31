---
title: "Part 3 — Injection, streams and routing"
sidebar_label: "3 · Injection, streams and routing"
sidebar_position: 3
---

> **Phases 6–8 · 42 topics · 15 Master**
> The injector hierarchy that everything is resolved through, the RxJS an
> Angular app actually needs, and a router configuration you could defend in
> review.

> Verified: 2026-08 against Angular **22.1.4**.
> *Explanation pages are not written yet — this is the inventory.*

These three phases are what turns components into an application. Dependency
injection in particular is where Angular is furthest from every other framework
in this bible: it is not a convenience, it is the composition model.

---

## Phase 6 — Dependency injection

*14 topics.* Angular's DI is a hierarchy of injectors that mirrors your
component tree, and almost every confusing DI error is really a question about
*which* injector was asked. Signals did not replace any of this.

| Topic | Tier |
|---|---|
| **`inject()`** — the function form, why it replaced constructor parameters for most code, and the injection-context rule that governs where you may call it | <span className="db-tier t-master">Master</span> |
| **`@Injectable({providedIn: 'root'})`** — the tree-shakeable provider; why a service nobody injects costs nothing, and what `'root'` actually names | <span className="db-tier t-master">Master</span> |
| **The two injector trees** — the environment injector (application, route, `EnvironmentInjector`) and the element injector (component and directive `providers`), and the order they are searched in | <span className="db-tier t-master">Master</span> |
| **Provider kinds** — `useClass`, `useValue`, `useFactory`, `useExisting`, plus `deps`; when a factory is the honest choice and when it is a code smell | <span className="db-tier t-master">Master</span> |
| **`InjectionToken`** — typed tokens with factory defaults, why a plain string token loses type safety and collides, and the config-object pattern | <span className="db-tier t-master">Master</span> |
| **`DestroyRef` and `takeUntilDestroyed()`** — cleanup tied to the injector's lifetime rather than to a component hook; the one subscription pattern to standardise on | <span className="db-tier t-master">Master</span> |
| **Resolution modifiers** — `{optional: true}`, `{self: true}`, `{skipSelf: true}`, `{host: true}`, and the parent-directive pattern each one exists for | <span className="db-tier t-understand">Understand</span> |
| **Multi providers** — many values under one token, how interceptors and validators use them, and why order is the caller's problem | <span className="db-tier t-understand">Understand</span> |
| **`EnvironmentInjector` and `runInInjectionContext()`** — creating a scoped injector, and legally calling `inject()` from a callback that is not a constructor | <span className="db-tier t-understand">Understand</span> |
| **`makeEnvironmentProviders()` and writing your own `provideX()`** — the pattern every first-party feature uses, and why it beats exporting a raw provider array | <span className="db-tier t-understand">Understand</span> |
| **Route-level and component-level providers** — a service scoped to a feature or an instance, and the two scoping mistakes that produce "why do I have three of these?" | <span className="db-tier t-understand">Understand</span> |
| **Application initialisers** — `provideAppInitializer()` and `provideEnvironmentInitializer()`, running async setup before the first render, and the deprecated `APP_INITIALIZER` token they replace | <span className="db-tier t-understand">Understand</span> |
| `injectAsync()` — new in the v22 surface: resolving a dependency that is itself lazily loaded, without dragging its chunk into the initial bundle | <span className="db-tier t-know">Know</span> |
| The `@Service` decorator and idle scheduling — `onIdle()`, `IdleService`, `provideIdleServiceWith()`; new v22 surface, worth recognising in release notes long before you need it | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can read a `NullInjectorError` and say which
injector was searched, in what order, and which provider you failed to declare —
without changing `providedIn` at random until it works.

---

## Phase 7 — RxJS in Angular

*12 topics.* RxJS is no longer how you hold state, and that is the point of this
phase: it shrinks the surface you need. Streams are for events over time —
navigation, sockets, typeahead, retries — and for those it is still the best
tool in the framework.

| Topic | Tier |
|---|---|
| **Observable vs signal — the boundary** — state is a signal, an event over time is a stream; the ambiguous cases (form value, route params, a websocket feed) and how to settle each | <span className="db-tier t-master">Master</span> |
| **The operators an Angular app actually uses** — `map`, `filter`, `tap`, `switchMap`, `debounceTime`, `distinctUntilChanged`, `startWith`, `catchError`, `retry`, `takeUntilDestroyed`, `combineLatest`, `shareReplay`; everything else is learned when a problem needs it | <span className="db-tier t-master">Master</span> |
| **The four flattening operators** — `switchMap` cancels, `concatMap` queues, `mergeMap` races, `exhaustMap` ignores; the search box, the upload queue and the double-submitted form that each one is the correct answer to | <span className="db-tier t-master">Master</span> |
| **Subscription management** — `takeUntilDestroyed()`, `AsyncPipe`, and the vanishingly few cases that justify holding a `Subscription` by hand | <span className="db-tier t-master">Master</span> |
| **Creation functions** — `of`, `from`, `fromEvent`, `timer`, `interval`, `EMPTY`, `throwError`, and `defer` for a stream that must not start early | <span className="db-tier t-understand">Understand</span> |
| **Subjects** — `Subject`, `BehaviorSubject`, `ReplaySubject`; what each is for now that a `BehaviorSubject` holding state should probably be a `signal` | <span className="db-tier t-understand">Understand</span> |
| **Error handling** — `catchError` and the stream-is-dead rule, recovering by returning a replacement stream, and `retry({count, delay})` for backoff | <span className="db-tier t-understand">Understand</span> |
| **Hot vs cold, and `shareReplay`** — why two subscribers made two HTTP requests, what `shareReplay({refCount: true})` changes, and the leak the non-refCount form causes | <span className="db-tier t-understand">Understand</span> |
| **`toSignal()` patterns** — `initialValue`, `requireSync`, `{equal}`, and what happens to an error thrown by the source | <span className="db-tier t-understand">Understand</span> |
| **Anti-patterns** — nested `subscribe`, subscribing in `ngOnInit` to assign a field, a `Subject` used as a store, and `async` pipes on the same source three times in one template | <span className="db-tier t-understand">Understand</span> |
| Multicasting beyond `shareReplay` — `share`, `connectable`, and why the `refCount` question keeps reappearing | <span className="db-tier t-know">Know</span> |
| Testing streams — `TestScheduler` and marble syntax, and when `fakeAsync`/`tick` is the simpler tool | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can implement a typeahead — debounced,
deduplicated, cancelling in-flight requests, surviving an error — and justify
each operator, then say which parts of it would be signals instead.

---

## Phase 8 — Routing

*16 topics.* Angular's router is opinionated and large, and the parts you skip
are the parts that bite: guard ordering, `CanMatch` vs `CanActivate`, and what
`pathMatch: 'full'` actually compares.

| Topic | Tier |
|---|---|
| **`provideRouter()` and the `Routes` array** — path, component, children, data; the shape of a real route table and how features are composed into it | <span className="db-tier t-master">Master</span> |
| **`RouterOutlet` and nested routes** — the outlet as a rendering slot, child outlets, and how a route tree maps to a component tree | <span className="db-tier t-master">Master</span> |
| **`routerLink` and `RouterLinkActive`** — array syntax, relative vs absolute paths, `queryParams`/`fragment` inputs, `exact` matching, and why `href` alone breaks the SPA | <span className="db-tier t-master">Master</span> |
| **Lazy loading** — `loadComponent` for a single route and `loadChildren` for a feature; what actually ends up in the chunk, and how to verify it did | <span className="db-tier t-master">Master</span> |
| **Route parameters and `withComponentInputBinding()`** — params, query params and route data delivered straight into `input()` signals, retiring most `ActivatedRoute` plumbing | <span className="db-tier t-master">Master</span> |
| **Guards as functions** — `CanActivateFn`, `CanActivateChildFn`, `CanDeactivateFn`, `CanMatchFn`; returning a `boolean`, a `UrlTree` or an observable, and the order they run in | <span className="db-tier t-master">Master</span> |
| **`CanMatch` vs `CanActivate`** — one decides whether the route matches at all (so the lazy chunk is never fetched), the other decides whether you may enter it; the auth and feature-flag cases that need the first | <span className="db-tier t-understand">Understand</span> |
| **Query parameters and `NavigationExtras`** — `queryParamsHandling`, `preserveFragment`, `state`, `replaceUrl`, and reading them without a subscription | <span className="db-tier t-understand">Understand</span> |
| **Resolvers** — `ResolveFn`, what a resolver delays, `withRouterResources()`, and the honest argument that most resolvers should be a `resource()` in the component instead | <span className="db-tier t-understand">Understand</span> |
| **Route `data`, `title` and `TitleStrategy`** — static data on a route, a computed page title, and a custom strategy for a suffix or a translation | <span className="db-tier t-understand">Understand</span> |
| **Redirects, wildcards and `pathMatch`** — `redirectTo`, the `**` route, and precisely what `pathMatch: 'full'` compares against | <span className="db-tier t-understand">Understand</span> |
| **`withViewTransitions()`** — the View Transitions API wired into navigation, opting individual navigations out, and the reduced-motion obligation | <span className="db-tier t-understand">Understand</span> |
| **Scroll behaviour** — `withInMemoryScrolling({scrollPositionRestoration, anchorScrolling})`, and why restoring scroll on a virtualised list needs help | <span className="db-tier t-understand">Understand</span> |
| **Router events and debugging** — the `NavigationStart` → `NavigationEnd`/`NavigationCancel`/`NavigationError` sequence, `NavigationCancellationCode`, and `withDebugTracing()` | <span className="db-tier t-understand">Understand</span> |
| Named outlets and auxiliary routes — a second outlet for a side panel, the `(name:path)` URL syntax, and why this is rarer than it looks | <span className="db-tier t-know">Know</span> |
| The remaining router features — `withHashLocation()`, `withPreloading()`, `withNavigationErrorHandler()`, `withEnabledBlockingInitialNavigation()`, and the experimental `withExperimentalPlatformNavigation()` (the browser Navigation API) and `withExperimentalAutoCleanupInjectors()` — label the last two, do not ship them | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can configure a lazily-loaded, guarded feature
route whose chunk is never downloaded by a user who is not allowed to see it —
and prove it from the network panel.
