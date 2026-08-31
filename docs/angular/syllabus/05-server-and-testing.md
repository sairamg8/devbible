---
title: "Part 5 — Rendering on the server, and testing"
sidebar_label: "5 · Server and testing"
sidebar_position: 5
---

> **Phases 12–13 · 27 topics · 7 Master**
> Getting the first paint out of a server without breaking the app when it
> wakes up on the client — and then proving any of it works.

> Verified: 2026-08 against Angular **22.1.4** and **`@angular/ssr` 22.1.6**.
> *Explanation pages are not written yet — this is the inventory.*

These two phases are paired because they fail together. Server rendering
introduces a second execution environment with no `window`, and the tests that
would have caught the resulting bug are exactly the tests people skip.

---

## Phase 12 — SSR, hydration and the server

*13 topics.* Angular's server story is now three separate decisions — how each
route renders, whether the client hydrates or re-renders, and how much of the
hydration is deferred — and they are configured in three different places.

| Topic | Tier |
|---|---|
| **Render modes per route** — `ServerRoute` with `RenderMode.Server`, `RenderMode.Client` and `RenderMode.Prerender`; choosing per route rather than per application, and what each does to TTFB, caching and personalisation | <span className="db-tier t-master">Master</span> |
| **`provideClientHydration()`** — reusing the server's DOM instead of throwing it away and re-rendering; what changes on the client and what the flicker looked like before it | <span className="db-tier t-master">Master</span> |
| **Hydration mismatches** — the causes: invalid HTML nesting the browser silently repairs, direct DOM manipulation, `Date.now()` and `Math.random()` in a template, third-party scripts; reading the error, and `ngSkipHydration` as the containment tool it is | <span className="db-tier t-master">Master</span> |
| **Code that must not run on the server** — `isPlatformBrowser()`, `afterNextRender()`, why `window` in a constructor is the classic SSR crash, and the `DOCUMENT` token as the portable escape | <span className="db-tier t-master">Master</span> |
| **Why SSR, and what it costs** — first paint and crawlability against a server you now have to run, a second environment to debug, and a whole class of bug that does not exist in an SPA | <span className="db-tier t-understand">Understand</span> |
| **Setting it up** — `ng add @angular/ssr`, the server entry point, the Node app engine, and how the same application config is shared between the two builds | <span className="db-tier t-understand">Understand</span> |
| **`withIncrementalHydration()`** — leaving a `@defer` block dehydrated until it is interacted with or scrolled to, and the `hydrate on ...` triggers that control it | <span className="db-tier t-understand">Understand</span> |
| **`withEventReplay()`** — capturing clicks that land before hydration finishes and replaying them afterwards, so the first tap on a slow connection is not silently dropped | <span className="db-tier t-understand">Understand</span> |
| **`TransferState` and `makeStateKey()`** — moving server-computed data into the client without a second request, and how it relates to the HTTP transfer cache from Phase 9 | <span className="db-tier t-understand">Understand</span> |
| **Reading the request during SSR** — the `REQUEST`, `REQUEST_CONTEXT` and `RESPONSE_INIT` tokens: cookies, headers, locale and setting a status code or a redirect from inside the app | <span className="db-tier t-understand">Understand</span> |
| **`PendingTasks` and application stability** — how the server decides the app has finished rendering, what keeps it awake forever (an `interval`, an unresolved promise), and how to contribute a task deliberately | <span className="db-tier t-understand">Understand</span> |
| **Prerendering and SSG** — prerendered routes, `getPrerenderParams` for parameterised routes, and the cases where a build-time render beats a request-time one outright | <span className="db-tier t-understand">Understand</span> |
| Deployment shapes — a long-running Node server, a serverless function, static output on a CDN, and `withI18nSupport()` for a localised server build | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain, for one route in your app, which
render mode it uses, what is in the HTML the server sent, and what the client
did with it — and you can force a hydration mismatch on purpose and read the
error.

---

## Phase 13 — Testing

*14 topics.* The runner changed: `@angular/build` peers **`vitest@^4.0.8`**, and
Karma — still a peer at `^6.4.0` — is end of life. Everything else about
Angular testing is `TestBed`, which is the same idea it has always been and is
still the thing people get wrong.

| Topic | Tier |
|---|---|
| **Vitest as the runner** — the `@angular/build` unit-test target, the config, what a migration from Karma and Jasmine actually involves, and which assertions and spy APIs change | <span className="db-tier t-master">Master</span> |
| **`TestBed.configureTestingModule()`** — providers, imports for standalone components, `overrideComponent`, and why the testing module is the same DI system rather than a special one | <span className="db-tier t-master">Master</span> |
| **Testing a standalone component** — `TestBed.createComponent()`, `ComponentFixture`, `fixture.detectChanges()`, querying with `DebugElement` vs `nativeElement`, and firing a real event | <span className="db-tier t-master">Master</span> |
| **Testing signal inputs and signal state** — `fixture.componentRef.setInput()`, asserting on a `computed`, and why reading a signal in a test needs no fixture at all | <span className="db-tier t-understand">Understand</span> |
| **`HttpTestingController`** — `provideHttpClientTesting()`, `expectOne`, matching by predicate, `flush`, `error`, and `verify()` in an `afterEach` so an unexpected request fails the test | <span className="db-tier t-master">Master</span> |
| **What to test, and at which level** — the component with its template, the service alone, the pipe as a function; the tests that only assert Angular still works, and deleting them | <span className="db-tier t-understand">Understand</span> |
| **Router testing** — `provideRouter` with a small route table, `RouterTestingHarness`, asserting a guard redirect, and testing a resolver without booting the app | <span className="db-tier t-understand">Understand</span> |
| **Test doubles through DI** — `{provide: Service, useValue: fake}`, `TestBed.inject()`, spying on a method, and why overriding a provider beats mocking a module | <span className="db-tier t-understand">Understand</span> |
| **`fakeAsync`, `tick`, `flush` and `waitForAsync`** — controlling time in a test, the "N timer(s) still in the queue" error, and which of these still apply once the app is zoneless | <span className="db-tier t-understand">Understand</span> |
| **Stability in a zoneless test** — `fixture.whenStable()`, awaiting an `httpResource`, and the flake that comes from asserting before the effect has run | <span className="db-tier t-understand">Understand</span> |
| **CDK component harnesses** — driving a Material control through its harness instead of querying its internal DOM, and writing a harness for your own component | <span className="db-tier t-understand">Understand</span> |
| **Testing forms** — asserting validity and error state on a reactive form, and testing a signal form's schema as a plain function separately from its rendering | <span className="db-tier t-understand">Understand</span> |
| End-to-end with Playwright — where the unit/E2E boundary sits for an Angular app, and the handful of journeys worth the runtime | <span className="db-tier t-know">Know</span> |
| Coverage and CI — the coverage target that is honest, running the suite headless, and what a flaky Angular test almost always turns out to be | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can test a component that loads data over HTTP,
renders a list, and navigates on click — with no `setTimeout` in the test and no
assertion that depends on how long anything took.
