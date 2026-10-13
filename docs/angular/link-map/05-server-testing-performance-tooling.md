---
title: "Link map · Angular · Part 5 (phases 12–13–14–15)"
sidebar_label: "05 · server testing performance tooling"
sidebar_position: 5
---

# Link map · Angular · Part 5 (phases 12–13–14–15)

Covers every topic row of `docs/angular/syllabus/05-server-and-testing.md` (phases 12 and 13) and `docs/angular/syllabus/06-performance-and-tooling.md` (phases 14 and 15): T12-01 to T12-13, T13-01 to T13-14, T14-01 to T14-12 and T15-01 to T15-12. That is 51 rows. Our written pages so far sit only under `docs/angular/pages/phase-0-how-angular-runs/`, and none of them is the page for a phase 12 to 15 row, so every row here is 🔲 not written. Three phase 0 pages overlap a row and are named in that row's delta (T14-01, T14-12, T15-01).
*read* = I fetched the page and read the passage that supports the claim; *title confirmed* = the URL returned 200 and a page whose title matched the topic, passage not read. No `#anchors` are given.

🔴 **Status of this file: official and primary links only, the Beyond-the-docs column is still empty.** Both passes hit the same wall: the web-search budget for the run was used up (every WebSearch call was refused), so no non-official explanation could be searched for, and none is invented here. No block has a **Beyond the docs** line, and that means "not searched", not "none exists". Re-run this lane with search available to fill them, and to spot-check the blocks that stayed empty.

🔴 **Version note.** The syllabus targets **Angular 22** (`docs/angular/README.md`). angular.dev showed v22.2.2 on 2026-10-13, so these pages describe the target version. Three things on those pages differ from the syllabus wording and are flagged in the blocks: incremental hydration is on by default in v22 and `withIncrementalHydration()` is deprecated (T12-07); `fakeAsync` is "no longer recommended" and Vitest fake timers are shown instead (T13-09); the deprecation window in the official policy is a minimum of one major, not two (T15-04). Every angular.dev link was checked by page title, because angular.dev answers 200 with the home page for any unknown path: `api/cdk/scrolling/CdkVirtualScrollViewport`, `guide/upgrade` and `guide/routing/route-loading-strategies` came back as "Home" and are not used.

---

## Phase 12 — SSR, hydration and the server

### T12-01 · Render modes per route — Master · 🔲 not written
- **Read this:** [RenderMode](https://angular.dev/api/ssr/RenderMode) · angular.dev API · the three members: `Server` renders per request, `Client` renders in the browser, `Prerender` renders at build time (*read*) · covers our angle: **partial** — definitions only, no trade-offs · fetched 2026-10-13
- **Also good:** [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · the "Server routing" section with "Rendering modes", per-route configuration, headers, status codes and redirects (*read*) · [ServerRoute](https://angular.dev/api/ssr/ServerRoute) · angular.dev API · a union of four route types; the page does not list their properties (*read*) · fetched 2026-10-13
- **Our delta:** TTFB, caching and personalisation trade-offs per mode.

### T12-02 · `provideClientHydration()` — Master · 🔲 not written
- **Read this:** [provideClientHydration](https://angular.dev/api/platform-browser/provideClientHydration) · angular.dev API · lists the feature functions you can pass: `withNoHttpTransferCache`, `withHttpTransferCacheOptions`, `withI18nSupport`, `withEventReplay`, `withNoIncrementalHydration` (*read*) · covers our angle: **partial** — no account of the client-side change itself · fetched 2026-10-13
- **Also good:** [Hydration](https://angular.dev/guide/hydration) · angular.dev · defines hydration as restoring the server-rendered app on the client, and shows adding the provider to the bootstrap list (*read*) · fetched 2026-10-13
- **Our delta:** what the flicker looked like before hydration.

### T12-03 · Hydration mismatches — Master · 🔲 not written
- **Read this:** [Hydration](https://angular.dev/guide/hydration) · angular.dev · "Constraints": invalid HTML structure (always write an explicit `tbody`), direct DOM manipulation as the most common culprit, and `ngSkipHydration` to make one component re-render instead of hydrating (*read*) · covers our angle: **partial** — no `Date.now()`/random-value causes seen on the page · fetched 2026-10-13
- **Our delta:** the cause-by-cause list and `ngSkipHydration` as containment.

### T12-04 · Code that must not run on the server — Master · 🔲 not written
- **Read this:** [afterNextRender](https://angular.dev/api/core/afterNextRender) · angular.dev API · "Callbacks run on browser platforms only, they will not run on the server" (*read*) · covers our angle: **partial** — the `window`-in-a-constructor crash is not shown · fetched 2026-10-13
- **Also good:** [isPlatformBrowser](https://angular.dev/api/common/isPlatformBrowser) · angular.dev API · returns whether a platform id is a browser (*read*) · [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · sections "Authoring server-compatible components", "Providing platform-specific implementations" and "Accessing Document via DI" (*read* headings) · [DOCUMENT](https://angular.dev/api/common/DOCUMENT) · angular.dev API (*title confirmed*) · fetched 2026-10-13
- **Our delta:** why `window` in a constructor is the classic SSR crash.

### T12-05 · Why SSR, and what it costs — Understand · 🔲 not written
- **Read this:** [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · opens with "What is hybrid rendering?" and says SSR gives faster page loads than client rendering (*read*) · covers our angle: **partial** — the benefit side only; no section on the cost, the second environment or the new bug class · fetched 2026-10-13
- **Our delta:** the cost side: a second environment and a new bug class.

### T12-06 · Setting it up — Understand · 🔲 not written
- **Read this:** [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · "Setting up hybrid rendering" (new project or adding SSR to an existing one), "Setting providers on the server" and "Configuring a server" for Node.js and non-Node.js (*read*) · covers our angle: **full** for the steps; **partial** for how one config feeds both builds · fetched 2026-10-13
- **Our delta:** how one application config feeds both builds.

### T12-07 · `withIncrementalHydration()` — Understand · 🔲 not written
- **Read this:** [Incremental Hydration](https://angular.dev/guide/incremental-hydration) · angular.dev · every `hydrate on` trigger (idle, viewport, interaction, hover, immediate, timer, never) and `hydrate when`, which works only on the top-most dehydrated `@defer` block (*read*) · covers our angle: **full** for the triggers · fetched 2026-10-13
- **Also good:** [withIncrementalHydration](https://angular.dev/api/platform-browser/withIncrementalHydration) · angular.dev API · 🔴 deprecated since v22.0: incremental hydration is now on by default with `provideClientHydration`, with intent to remove in v24; opt out with `withNoIncrementalHydration()` (*read*) · [Deferred loading with @defer](https://angular.dev/guide/templates/defer) · angular.dev (*read*) · fetched 2026-10-13
- **Our delta:** the `hydrate on` triggers, and that the syllabus row name is the deprecated function: on v22 you get the behaviour without calling it.

### T12-08 · `withEventReplay()` — Understand · 🔲 not written
- **Read this:** [withEventReplay](https://angular.dev/api/platform-browser/withEventReplay) · angular.dev API · replays user events such as clicks that happened before hydration completed, once the app is hydrated (*read*) · covers our angle: **partial** — no slow-connection scenario · fetched 2026-10-13
- **Also good:** [Hydration](https://angular.dev/guide/hydration) · angular.dev · "Capturing and replaying events" (*read*) · [Incremental Hydration](https://angular.dev/guide/incremental-hydration) · angular.dev · incremental hydration depends on and enables event replay automatically, so `withEventReplay()` is redundant when it is on (*read*) · fetched 2026-10-13
- **Our delta:** the dropped-first-tap scenario on slow connections.

### T12-09 · `TransferState` and `makeStateKey()` — Understand · 🔲 not written
- **Read this:** [TransferState](https://angular.dev/api/core/TransferState) · angular.dev API · a key-value store moved from the server app to the client app; values go through JSON, so only plain data survives (*read*) · covers our angle: **partial** — no mention of the HTTP transfer cache · fetched 2026-10-13
- **Also good:** [makeStateKey](https://angular.dev/api/core/makeStateKey) · angular.dev API · creates a `StateKey` of type T for use with `TransferState` (*read*) · [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · "Caching data when using HttpClient" covers the built-in transfer cache (*read* headings) · fetched 2026-10-13
- **Our delta:** relation to the HTTP transfer cache from Phase 9.

### T12-10 · Reading the request during SSR — Understand · 🔲 not written
- **Read this:** [REQUEST](https://angular.dev/api/core/REQUEST) · angular.dev API · injection token for the current request object, used when handling SSR (*read*) · covers our angle: **partial** — token only, no cookie/header/locale use · fetched 2026-10-13
- **Also good:** [RESPONSE_INIT](https://angular.dev/api/core/RESPONSE_INIT) · angular.dev API · token for response initialization options; may be `null` during builds, client rendering and static generation (*read*) · [REQUEST_CONTEXT](https://angular.dev/api/core/REQUEST_CONTEXT) · angular.dev API · "additional request context" (*read*) · [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · "Setting headers and status codes", "Redirects" and "Accessing Request and Response via DI" (*read* headings) · fetched 2026-10-13
- **Our delta:** setting a status code or redirect from inside the app.

### T12-11 · `PendingTasks` and application stability — Understand · 🔲 not written
- **Read this:** [PendingTasks](https://angular.dev/api/core/PendingTasks) · angular.dev API · tracks tasks that hold back stability; `add()` blocks stability, `run()` blocks until an async function completes, and the SSR process waits for stability before serialising the HTML (*read*) · covers our angle: **partial** — nothing on what keeps the server waiting forever · fetched 2026-10-13
- **Our delta:** what keeps the server waiting forever (`interval`, unresolved promise).

### T12-12 · Prerendering and SSG — Understand · 🔲 not written
- **Read this:** [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · "Customizing build-time prerendering (SSG)": parameterised routes, where `getPrerenderParams` returns a promise of an array of objects, plus fallback strategies and "Generate a fully static application" (*read*) · covers our angle: **partial** — no guidance on when build time beats request time · fetched 2026-10-13
- **Also good:** [RenderMode](https://angular.dev/api/ssr/RenderMode) · angular.dev API · `Prerender` is static site generation at build time (*read*) · fetched 2026-10-13
- **Our delta:** `getPrerenderParams` and when build-time beats request-time.

### T12-13 · Deployment shapes — Know · 🔲 not written
- **Read this:** [Server-side and hybrid-rendering](https://angular.dev/guide/ssr) · angular.dev · "Configuring a server" (Node.js and non-Node.js) and "Generate a fully static application" for static hosting without a backend (*read*) · covers our angle: **partial** — no serverless section and no localised-server section · fetched 2026-10-13
- **Also good:** [Deployment](https://angular.dev/tools/cli/deployment) · angular.dev · only the client-side case: copy the output to a web server or CDN and fall back to `index.html` for deep links; nothing on SSR, serverless or localised builds (*read*) · [Merge translations into the app](https://angular.dev/guide/i18n/merge) · angular.dev · one locale variant per build, served by language detection or subdirectory; no SSR or `withI18nSupport()` (*read*) · fetched 2026-10-13
- **Our delta:** serverless, static CDN and the localised server build. No official page found that ties `withI18nSupport()` to the localised server build.

## Phase 13 — Testing

### T13-01 · Vitest as the runner — Master · 🔲 not written
- **Read this:** [Migrating from Karma to Vitest](https://angular.dev/guide/testing/migrating-to-vitest) · angular.dev · manual steps (switch `builder` to `@angular/build:unit-test`, remove Karma and `test.ts`), plus the experimental `refactor-jasmine-vitest` schematic that maps `jasmine.createSpy` to `vi.fn` and `spyOn` to `vi.spyOn` (*read*) · covers our angle: **partial** — no full list of assertion changes; complex spies need manual work · fetched 2026-10-13
- **Also good:** [Testing overview](https://angular.dev/guide/testing) · angular.dev · new projects include Vitest and jsdom; configuration, browser mode with Playwright or WebdriverIO, and CI (*read* headings) · [Vitest guide](https://vitest.dev/guide/) · "a next generation testing framework powered by Vite" (*read*) · [Vitest mocking](https://vitest.dev/guide/mocking.html) · no section of its own on `vi.fn`/`vi.spyOn`, links to a Mock Functions tutorial (*read*) · [Karma and Jasmine](https://angular.dev/guide/testing/karma) · Karma is "still a supported and widely used test runner" (*read*) · fetched 2026-10-13
- **Our delta:** which assertion and spy APIs change.

### T13-02 · `TestBed.configureTestingModule()` — Master · 🔲 not written
- **Read this:** [Testing utility APIs](https://angular.dev/guide/testing/utility-apis) · angular.dev · `configureTestingModule` refines the testing module with imports, declarations and providers; `TestBed.inject()` reads from the injector TestBed builds; configuration freezes after `createComponent` or `inject` (*read*) · covers our angle: **partial** — nothing seen on `overrideComponent` · fetched 2026-10-13
- **Also good:** [Testing services](https://angular.dev/guide/testing/services) · angular.dev · `TestBed` sets up dependency injection for tests (*read*) · fetched 2026-10-13
- **Our delta:** why the testing module is the same DI system.

### T13-03 · Testing a standalone component — Master · 🔲 not written
- **Read this:** [Basics of testing components](https://angular.dev/guide/testing/components-basics) · angular.dev · `TestBed.createComponent`, and `DebugElement` as the cross-platform abstraction versus `nativeElement` as the unwrapped platform element (*read*) · covers our angle: **partial** — uses `await fixture.whenStable()` rather than `fixture.detectChanges()`, and does not show firing an event · fetched 2026-10-13
- **Also good:** [Component testing scenarios](https://angular.dev/guide/testing/components-scenarios) · angular.dev · "Change an input value with dispatchEvent()": a real `input` event is needed because Angular does not see a bare `value` change (*read*) · [ComponentFixture](https://angular.dev/api/core/testing/ComponentFixture) · angular.dev API · `detectChanges`, `autoDetectChanges`, `whenStable` (*read*) · fetched 2026-10-13
- **Our delta:** `DebugElement` vs `nativeElement`, firing a real event.

### T13-04 · Testing signal inputs and signal state — Understand · 🔲 not written
- **Read this:** [Component testing scenarios](https://angular.dev/guide/testing/components-scenarios) · angular.dev · "Binding signals to inputs": `fixture.componentRef.setInput('hero', expectedHero)`, and `whenStable()` before asserting (*read*) · covers our angle: **partial** — no `computed` assertion and no reading a signal without a fixture · fetched 2026-10-13
- **Also good:** [ComponentFixture](https://angular.dev/api/core/testing/ComponentFixture) · angular.dev API · `whenStable()` resolves when the fixture is stable; `setInput` is not on this page (*read*) · fetched 2026-10-13
- **Our delta:** `setInput()` and reading a signal with no fixture.

### T13-05 · `HttpTestingController` — Master · 🔲 not written
- **Read this:** [Testing HTTP requests](https://angular.dev/guide/http/testing) · angular.dev · `provideHttpClientTesting()` swaps in a test backend; `expectOne` fails on more than one match; `flush`, `error`, predicate matching, and `verify()` moved into `afterEach` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [HttpTestingController](https://angular.dev/api/common/http/testing/HttpTestingController) · angular.dev API · `match`, `expectOne`, `verify` ("no unmatched requests are outstanding") (*read*) · fetched 2026-10-13
- **Our delta:** `verify()` in `afterEach`.

### T13-06 · What to test, and at which level — Understand · 🔲 not written
- **Read this:** [Testing overview](https://angular.dev/guide/testing) · angular.dev · a unit-testing guide: it states the value of unit tests but does not define test levels or mention integration or end-to-end tests (*read*) · covers our angle: **partial** — no guidance on what not to test · fetched 2026-10-13
- **Also good:** [Testing pipes](https://angular.dev/guide/testing/pipes) · angular.dev · "You can test pipes without the Angular testing utilities": a pipe is a plain function, no TestBed (*read*) · [Testing services](https://angular.dev/guide/testing/services) · angular.dev (*read*) · fetched 2026-10-13
- **Our delta:** deleting tests that only prove Angular works.

### T13-07 · Router testing — Understand · 🔲 not written
- **Read this:** [Testing routing and navigation](https://angular.dev/guide/routing/testing) · angular.dev · `provideRouter` with a small route table in `TestBed`, `RouterTestingHarness` to navigate, a guard test that expects the login component after a redirect; advises against mocking the router (*read*) · covers our angle: **partial** — resolvers are not covered · fetched 2026-10-13
- **Also good:** [RouterTestingHarness](https://angular.dev/api/router/testing/RouterTestingHarness) · angular.dev API · `create()` and `navigateByUrl()`, which returns the activated component or null when a guard rejects (*read*) · fetched 2026-10-13
- **Our delta:** guard redirect and resolver tests.

### T13-08 · Test doubles through DI — Understand · 🔲 not written
- **Read this:** [Testing services](https://angular.dev/guide/testing/services) · angular.dev · "Replacing a dependency with a stub" (`provide` plus `useValue`) and "Verifying interactions with spies" (`vi.fn()`) (*read*) · covers our angle: **partial** — does not argue overriding a provider beats mocking a module · fetched 2026-10-13
- **Also good:** [Testing utility APIs](https://angular.dev/guide/testing/utility-apis) · angular.dev · `TestBed.inject()` (*read*) · fetched 2026-10-13
- **Our delta:** overriding a provider beats mocking a module.

### T13-09 · `fakeAsync`, `tick`, `flush` and `waitForAsync` — Understand · 🔲 not written
- **Read this:** [Zone.js Testing Utilities](https://angular.dev/guide/testing/zone-js-testing-utilities) · angular.dev · `fakeAsync` runs a test in a special zone, `tick` simulates the passage of time, `flushMicrotasks` drains the micro-task queue, `waitForAsync` completes only when no micro or macrotasks remain (*read*) · covers our angle: **partial** — the "timer(s) still in the queue" error is not on the page · fetched 2026-10-13
- **Also good:** [Component testing scenarios](https://angular.dev/guide/testing/components-scenarios) · angular.dev · 🔴 "The use of fakeAsync is no longer recommended": it needs zone.js, and the page shows `vi.useFakeTimers()` with `vi.runAllTimersAsync()` instead (*read*) · [fakeAsync](https://angular.dev/api/core/testing/fakeAsync) · angular.dev API · `tick`, `flushMicrotasks`, and a `flush` option that throws if timers are pending (*read*) · [Zoneless](https://angular.dev/guide/zoneless) · angular.dev · `TestBed` is zoneless by default; the page does not mention `fakeAsync` (*read*) · fetched 2026-10-13
- **Our delta:** which of these still apply when zoneless: per the pages above, the zone-based ones need zone.js and are discouraged; Vitest fake timers replace them.

### T13-10 · Stability in a zoneless test — Understand · 🔲 not written
- **Read this:** [Zoneless](https://angular.dev/guide/zoneless) · angular.dev · "Using Zoneless in TestBed": `await fixture.whenStable()` after creating the component, and "avoid using `fixture.detectChanges()` when possible" (*read*) · covers our angle: **partial** — nothing on effect-timing flakes · fetched 2026-10-13
- **Also good:** [httpResource](https://angular.dev/guide/http/http-resource) · angular.dev · "Testing an httpResource": same APIs as `HttpClient`; the example calls `TestBed.tick()` to trigger the effect and `await TestBed.inject(ApplicationRef).whenStable()` before reading values (*read*) · [ComponentFixture](https://angular.dev/api/core/testing/ComponentFixture) · angular.dev API (*read*) · fetched 2026-10-13
- **Our delta:** awaiting `httpResource` and effect-timing flakes.

### T13-11 · CDK component harnesses — Understand · 🔲 not written
- **Read this:** [Component harnesses overview](https://angular.dev/guide/testing/component-harnesses-overview) · angular.dev · a harness lets tests interact with a component "the way an end user does", shielding tests from its internal DOM (*read*) · covers our angle: **partial** — no code here · fetched 2026-10-13
- **Also good:** [Using component harnesses in tests](https://angular.dev/guide/testing/using-component-harnesses) · angular.dev · `TestbedHarnessEnvironment` loaders and filtering harnesses (*read* headings) · [Creating harnesses for your components](https://angular.dev/guide/testing/creating-component-harnesses) · angular.dev · extend `ComponentHarness`, set `hostSelector`, find elements with `locatorFor` (*read*) · fetched 2026-10-13
- **Our delta:** writing a harness for your own component.

### T13-12 · Testing forms — Understand · 🔲 not written
- **Read this:** [Signal forms testing](https://angular.dev/guide/forms/signals/testing) · angular.dev · "Testing form logic in isolation": the schema needs no template, assert with `errors()`, `valid()` and friends, and pass `TestBed.inject(Injector)` to `form()` (*read*) · covers our angle: **partial** — signal forms only, reactive forms not covered · fetched 2026-10-13
- **Also good:** [Component testing scenarios](https://angular.dev/guide/testing/components-scenarios) · angular.dev · no forms section; shows simulating typing with `dispatchEvent` on an `ngModel` input (*read*) · fetched 2026-10-13
- **Our delta:** reactive-form validity vs a signal form schema as a plain function. No official page found for reactive-form validity assertions.

### T13-13 · End-to-end with Playwright — Know · 🔲 not written
- **Read this:** [Playwright intro](https://playwright.dev/docs/intro) · Playwright docs · "an end-to-end test framework for modern web apps": install, then a first test run with `npx playwright test` (*read*) · covers our angle: **partial** — not Angular-specific; says nothing of the unit/E2E boundary · fetched 2026-10-13
- **Also good:** [End-to-End Testing](https://angular.dev/tools/cli/end-to-end) · angular.dev · `ng e2e` runs whatever `e2e` builder the project has and offers Cypress, Nightwatch, WebdriverIO, Playwright or Puppeteer when none exists (*read*) · fetched 2026-10-13
- **Our delta:** where the unit/E2E boundary sits.

### T13-14 · Coverage and CI — Know · 🔲 not written
- **Read this:** [Code coverage](https://angular.dev/guide/testing/code-coverage) · angular.dev · `ng test --coverage`, `coverage: true` in `angular.json`, and `coverageThresholds` so the command fails below the threshold (*read*) · covers our angle: **partial** — no CI or headless material on this page · fetched 2026-10-13
- **Also good:** [Testing overview](https://angular.dev/guide/testing) · angular.dev · has a "Testing in continuous integration" section (*read* headings) · [Debugging tests](https://angular.dev/guide/testing/debugging) · angular.dev · `ng test --debug`, Node and browser; nothing on flaky tests (*read*) · fetched 2026-10-13
- **Our delta:** an honest coverage target and what flaky tests turn out to be.

## Phase 14 — Performance and the build

### T14-01 · Bundle budgets — Master · 🔲 not written
- **Read this:** [Building Angular apps](https://angular.dev/tools/cli/build) · angular.dev · "Configuring size budgets": the builder warns or errors when part of the app reaches a boundary size you set in the `budgets` section of `angular.json` (*read*) · covers our angle: **partial** — per-type thresholds are not spelled out here · fetched 2026-10-13
- **Also good:** [Workspace configuration](https://angular.dev/reference/configs/workspace-config) · angular.dev · only a one-row mention of the `budgets` option; the type list and thresholds are not on it (*read*) · fetched 2026-10-13
- **Our delta:** CI that fails on regression. Related page of ours, written under T00-06 (not this row): `docs/angular/pages/phase-0-how-angular-runs/06-angular-json-anatomy/08-budgets-the-seven-types.md`.

### T14-02 · Seeing what is actually in the bundle — Master · 🔲 not written
- **Read this:** [esbuild bundle size analyzer](https://esbuild.github.io/analyze/) · esbuild · import a metafile and view it as a treemap, sunburst or flame chart (*read*) · covers our angle: **partial** — no source-map-explorer, no Angular specifics · fetched 2026-10-13
- **Also good:** [Building Angular apps](https://angular.dev/tools/cli/build) · angular.dev · does not mention `--stats-json` (*read* headings) · [angular.dev ng build reference](https://angular.dev/cli/build) · `--stats-json` "Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/" (*read*) · fetched 2026-10-13
- **Our delta:** `--stats-json`, metafile, source-map-explorer.

### T14-03 · The two splitting tools — Master · 🔲 not written
- **Read this:** [Deferred loading with @defer](https://angular.dev/guide/templates/defer) · angular.dev · deferred dependencies are split into a separate JavaScript file; "Barrel files and lazy chunks": if you see no separate chunk, check how you import (*read*) · covers our angle: **partial** — no comparison with lazy routes · fetched 2026-10-13
- **Also good:** [Route Loading Strategies](https://angular.dev/guide/routing/loading-strategies) · angular.dev · `loadComponent` and `loadChildren` compile into separate JavaScript requested only when the route is visited; "Should I use an eager or a lazy route?" (*read*) · fetched 2026-10-13
- **Our delta:** choosing between them and verifying a chunk moved.

### T14-04 · `OnPush` and zoneless as structural wins — Understand · 🔲 not written
- **Read this:** [Skipping component subtrees](https://angular.dev/best-practices/skipping-subtrees) · angular.dev · Angular skips `OnPush` subtrees that received no new inputs; says `OnPush` is the default as of v22 (*read*) · covers our angle: **partial** — zoneless is only a sidebar link · fetched 2026-10-13
- **Also good:** [Zoneless](https://angular.dev/guide/zoneless) · angular.dev (*read*) · [Zone pollution](https://angular.dev/best-practices/zone-pollution) · angular.dev · `runOutsideAngular` keeps timers and third-party code from triggering change detection (*read*) · fetched 2026-10-13
- **Our delta:** structure before micro-optimisation.

### T14-05 · List rendering cost — Understand · 🔲 not written
- **Read this:** [Control flow](https://angular.dev/guide/templates/control-flow) · angular.dev · "Why is `track` in `@for` blocks important?": `track` maps data to DOM nodes so Angular does the minimum DOM work; tracking by item reference is a last resort and can be much slower (*read*) · covers our angle: **partial** — nothing on when to virtualise · fetched 2026-10-13
- **Our delta:** stable `track` and when to virtualise.

### T14-06 · Virtual scrolling — Understand · 🔲 not written
- **Read this:** [CDK scrolling](https://material.angular.dev/cdk/scrolling/overview) · Angular Material docs · the page is a JavaScript shell, so its text is *not fetchable — unverified*; the same text was read from the source file `src/cdk/scrolling/scrolling.md` in the angular/components repo: `cdk-virtual-scroll-viewport` renders only the items on screen, `itemSize` must be set, `*cdkVirtualFor` replaces `*ngFor` · covers our angle: **partial** — nothing on what virtual scrolling breaks · fetched 2026-10-13
- **Our delta:** what it breaks (find-in-page, anchors, scroll restoration). The angular.dev API page for `CdkVirtualScrollViewport` does not exist (it served the home page), so it is not linked.

### T14-07 · Images and LCP — Understand · 🔲 not written
- **Read this:** [Optimizing images with NgOptimizedImage](https://angular.dev/guide/image-optimization) · angular.dev · `priority` for the LCP image (sets `fetchpriority` high and adds a server preload), `fill`, `sizes`, built-in loaders for Cloudflare, Cloudinary, ImageKit, Imgix and Netlify, and the dev-mode warnings (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Largest Contentful Paint](https://web.dev/articles/lcp) · web.dev · LCP is the render time of the largest image, text block or video in the viewport; good is 2.5 seconds or less at the 75th percentile (*read*) · fetched 2026-10-13
- **Our delta:** dev-mode warnings.

### T14-08 · Core Web Vitals, mapped to Angular — Understand · 🔲 not written
- **Read this:** [Web Vitals](https://web.dev/articles/vitals) · web.dev · the three Core Web Vitals and their thresholds: LCP 2.5 s, INP 200 ms, CLS 0.1 (*read*) · covers our angle: **partial** — nothing Angular-specific, so which vital hydration affects is not answered · fetched 2026-10-13
- **Also good:** [LCP](https://web.dev/articles/lcp) · [INP](https://web.dev/articles/inp) · [CLS](https://web.dev/articles/cls) · web.dev · each metric's definition and good threshold, all at the 75th percentile of page loads (*read*) · fetched 2026-10-13
- **Our delta:** which vital hydration affects most.

### T14-09 · The cost of hydration — Understand · 🔲 not written
- **Read this:** [Hydration](https://angular.dev/guide/hydration) · angular.dev · what hydration does and its constraints (*read*) · covers our angle: **partial** — does not discuss painting sooner but responding later or measuring the gap · fetched 2026-10-13
- **Also good:** [Incremental Hydration](https://angular.dev/guide/incremental-hydration) · angular.dev · leaves `@defer` blocks dehydrated until a trigger fires (*read*) · fetched 2026-10-13
- **Our delta:** paint sooner, respond later, and measuring the gap.

### T14-10 · Dev-server timings lie — Understand · 🔲 not written
- **Read this:** [Serving Angular apps for development](https://angular.dev/tools/cli/serve) · angular.dev · says only that the dev server compiles and "skip[s] unnecessary optimizations"; no mention of timings, minification or measuring a production build (*read*) · covers our angle: **partial** — weak; no official page makes this point head on · fetched 2026-10-13
- **Also good:** [Chrome DevTools profiling](https://angular.dev/best-practices/profiling-with-chrome-devtools) · angular.dev · the Angular profiling track works only in development mode (*read*) · [Building Angular apps](https://angular.dev/tools/cli/build) · angular.dev (*read* headings) · fetched 2026-10-13
- **Our delta:** measure a production build.

### T14-11 · The Angular DevTools profiler workflow — Understand · 🔲 not written
- **Read this:** [Profiler](https://angular.dev/tools/devtools/profiler) · angular.dev · record, then a bar chart of change-detection cycles (taller bar, longer cycle); select a bar to see the components and directives in it; a flame graph shows the render tree (*read*) · covers our angle: **full** for the workflow · fetched 2026-10-13
- **Also good:** [Chrome DevTools profiling](https://angular.dev/best-practices/profiling-with-chrome-devtools) · angular.dev · an Angular track in the Chrome performance panel; shows which components change detection checked or skipped (*read*) · [DevTools](https://angular.dev/tools/devtools) · angular.dev · overview (*read*) · fetched 2026-10-13
- **Our delta:** from slow page to a named component.

### T14-12 · Build performance — Know · 🔲 not written
- **Read this:** [Workspace configuration](https://angular.dev/reference/configs/workspace-config) · angular.dev · "Cache options": `cache.enabled` (default true), `cache.environment` (`ci`, `local` or `all`, default `local`), `cache.path` (default `.angular/cache`) (*read*) · covers our angle: **partial** — nothing on what invalidates the cache or on `--watch` · fetched 2026-10-13
- **Also good:** [Migrating to new build system](https://angular.dev/tools/cli/build-system-migration) · angular.dev · faster initial and incremental builds, prebundling; does not mention the build cache (*read*) · [Building Angular apps](https://angular.dev/tools/cli/build) · angular.dev · no cache section (*read* headings) · fetched 2026-10-13
- **Our delta:** persistent cache and what invalidates it. Related page of ours, written under T00-05 (not this row): `docs/angular/pages/phase-0-how-angular-runs/05-the-build-angular-build/11-cache-and-workers.md`.

## Phase 15 — Tooling, upgrades and the ecosystem

### T15-01 · `ng update` as a survival skill — Master · 🔲 not written
- **Read this:** [Update guide](https://angular.dev/update-guide) · angular.dev · pick a start and target version and an app complexity (Basic, Medium, Advanced), plus flags for ngUpgrade, Angular Material and Windows; the page's rendered text shows the selector only, so the before/during/after lists were not read (*title confirmed*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Versioning and releases](https://angular.dev/reference/releases) · angular.dev · "If you want to update across multiple major versions, perform each update one major version at a time" (*read*) · fetched 2026-10-13
- **Our delta:** one major at a time. Related pages of ours, written under T00-04 (not this row): `docs/angular/pages/phase-0-how-angular-runs/04-ng-update-not-npm-install/02-one-major-at-a-time.md`.

### T15-02 · Security — Master · 🔲 not written
- **Read this:** [Security](https://angular.dev/best-practices/security) · angular.dev · four sanitisation contexts (HTML, Style, URL, Resource URL), "Trusting safe values" with `DomSanitizer` and its warning, CSP nonces, Trusted Types, and "Auditing Angular applications" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [DomSanitizer](https://angular.dev/api/platform-browser/DomSanitizer) · [SecurityContext](https://angular.dev/api/core/SecurityContext) · [CSP_NONCE](https://angular.dev/api/core/CSP_NONCE) · angular.dev API (*title confirmed*) · [Trusted Types API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) · [CSP (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) · MDN (*title confirmed*) · fetched 2026-10-13
- **Our delta:** auditing every `bypassSecurityTrust*`.

### T15-03 · Schematics and generators — Understand · 🔲 not written
- **Read this:** [Generating code using schematics](https://angular.dev/tools/cli/schematics) · angular.dev · "A schematic is a template-based code generator"; `ng generate` runs the `@schematics/angular` collection; collections can ship add, generate and update schematics (*read*) · covers our angle: **partial** — no steps for writing one · fetched 2026-10-13
- **Also good:** [Authoring schematics](https://angular.dev/tools/cli/schematics-authoring) · angular.dev · collections, the virtual file system `Tree`, and rules that take a `Tree` and return a new one (*read*) · fetched 2026-10-13
- **Our delta:** writing a project schematic.

### T15-04 · The deprecation policy — Understand · 🔲 not written
- **Read this:** [Versioning and releases](https://angular.dev/reference/releases) · angular.dev · a deprecated API stays for a minimum of one major version (about a year) and is removed only in a major release; announced in the changelog, struck through in the API docs, tagged `@deprecated`; 24-month support split into 12 months active and 12 LTS (*read*) · covers our angle: **partial** — 🔴 contradicts the syllabus row's "two-major removal window": the official text says a minimum of one major. The row needs a decision before the page is written · fetched 2026-10-13
- **Our delta:** the removal window and reading release notes.

### T15-05 · Migrating NgModules to standalone — Understand · 🔲 not written
- **Read this:** [Standalone migration](https://angular.dev/reference/migrations/standalone) · angular.dev · three steps in order: convert declarations to standalone, remove unnecessary `NgModule` classes, bootstrap with standalone APIs; a module is removed only if it has no declarations, providers or bootstrap components (*read*) · covers our angle: **partial** — no list of load-bearing modules · fetched 2026-10-13
- **Also good:** [NgModules](https://angular.dev/guide/ngmodules/overview) · angular.dev · "The Angular team recommends using standalone components instead of NgModule for all new code" (*read*) · fetched 2026-10-13
- **Our delta:** order of work and load-bearing modules.

### T15-06 · Linting and formatting — Understand · 🔲 not written
- **Read this:** [typescript-eslint getting started](https://typescript-eslint.io/getting-started/) · typescript-eslint docs · flat config: an `eslint.config.mjs` in the project root, install `eslint`, `@eslint/js`, `typescript` and `typescript-eslint` (*read*) · covers our angle: **partial** — nothing Angular-specific · fetched 2026-10-13
- **Also good:** [Prettier options](https://prettier.io/docs/options) · Prettier docs · the `angular` parser formats Angular template syntax; HTML whitespace sensitivity option (*read*) · fetched 2026-10-13
- **Our delta:** `angular-eslint` flat config. The project's own page (github.com/angular-eslint/angular-eslint) is blocked from this sandbox (403), so it is not linked; its README, read through the raw file, says to run `ng add angular-eslint`.

### T15-07 · Angular DevTools — Understand · 🔲 not written
- **Read this:** [DevTools](https://angular.dev/tools/devtools) · angular.dev · overview: Components tab, Profiler, Injector Tree, and the notice shown for apps built with the production configuration (*read*) · covers our angle: **partial** — the signal graph is not on this page · fetched 2026-10-13
- **Also good:** [Signals](https://angular.dev/tools/devtools/signals) · angular.dev · a live signal graph for the selected component, covering signals, computeds, effects and resources; needs Angular 19+ in development mode (*read*) · [Injectors](https://angular.dev/tools/devtools/injectors) · angular.dev · environment and element injector trees, with the providers of a selected injector (*read*) · fetched 2026-10-13
- **Our delta:** injector tree and signal graph.

### T15-08 · Publishing a library — Know · 🔲 not written
- **Read this:** [Creating Libraries](https://angular.dev/tools/libraries/creating-libraries) · angular.dev · `ng-packagr` builds the package; build with the production configuration; list `@angular/*` as peer dependencies; publish the partial-Ivy format, which is stable between Angular versions; "Ensuring library version compatibility" (*read*) · covers our angle: **partial** — no account of what you owe consumers on each major · fetched 2026-10-13
- **Also good:** [Angular Package Format](https://angular.dev/tools/libraries/angular-package-format) · angular.dev · file layout, `exports`, entry points, partial compilation (*read*) · [Using Libraries](https://angular.dev/tools/libraries/using-libraries) · angular.dev (*title confirmed*) · fetched 2026-10-13
- **Our delta:** peer ranges and what you owe consumers on every major.

### T15-09 · Monorepos — Know · 🔲 not written
- **Read this:** [Nx with Angular](https://nx.dev/docs/technologies/angular/introduction) · Nx docs (vendor page) · a table of what Nx adds over the Angular CLI: monorepo support, enforced module boundaries, project graph, affected builds, local and remote caching; `@nx/angular` supports Angular 20.0.0 up to below 23.0.0 (*read*) · covers our angle: **partial** — vendor-written, so it argues for Nx; nothing on the CLI's own multi-project support · fetched 2026-10-13
- **Also good:** [Workspace configuration](https://angular.dev/reference/configs/workspace-config) · angular.dev · the CLI workspace: `projects` and the config structure (*read* headings) · [Intro to Nx](https://nx.dev/docs/getting-started/intro) · Nx docs · "a build system for JavaScript and TypeScript monorepos"; module boundary rules and caching; does not name Angular (*read*) · fetched 2026-10-13
- **Our delta:** CLI multi-project vs Nx and library boundaries.

### T15-10 · Analog — Know · 🔲 not written
- **Read this:** [Analog docs](https://analogjs.org/docs) · Analog project docs · "The fullstack Angular meta-framework": file-based routing under `src/app/pages/`, API routes, SSR and SSG, Vite-based (*read*) · covers our angle: **partial** — no comparison with `@angular/ssr` and nothing on maturity · fetched 2026-10-13
- **Our delta:** what it offers over `@angular/ssr` and the maturity trade.

### T15-11 · Angular Elements and micro-frontends — When Needed · 🔲 not written
- **Read this:** [Custom Elements](https://angular.dev/guide/elements) · angular.dev · components packaged as custom elements; `createCustomElement()` bridges the component interface and change detection to the DOM; inputs become attributes, outputs become DOM events; limitation: care when destroying and re-attaching elements (*read*) · covers our angle: **partial** — micro-frontends are not mentioned · fetched 2026-10-13
- **Our delta:** framework-boundary problems.

### T15-12 · The AngularJS upgrade path — When Needed · 🔲 not written
- **Read this:** [UpgradeModule](https://angular.dev/api/upgrade/static/UpgradeModule) · angular.dev API · an NgModule for hybrid AngularJS and Angular apps; its `bootstrap()` method starts the AngularJS side (*read*) · covers our angle: **partial** — API page only; there is no angular.dev guide (`angular.dev/guide/upgrade` serves the home page) · fetched 2026-10-13
- **Also good:** [setUpLocationSync](https://angular.dev/api/router/upgrade/setUpLocationSync) · angular.dev API · keeps the AngularJS and Angular location in sync; must run after the `UpgradeModule` bootstrap call (*read*) · [downgradeComponent](https://angular.dev/api/upgrade/static/downgradeComponent) · angular.dev API (*title confirmed*) · fetched 2026-10-13
- **Our delta:** `@angular/upgrade` API pages are the only official source on angular.dev; the old step-by-step guide was not found on the current site.
