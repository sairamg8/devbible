---
title: "The provider array is the application's wiring — one property on one object, and a `provide*` convention that exists so a bundler can see what you configured"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev [`ApplicationConfig`](https://angular.dev/api/core/ApplicationConfig), [`bootstrapApplication`](https://angular.dev/api/platform-browser/bootstrapApplication), [`EnvironmentProviders`](https://angular.dev/api/core/EnvironmentProviders), [`makeEnvironmentProviders`](https://angular.dev/api/core/makeEnvironmentProviders), [`provideRouter`](https://angular.dev/api/router/provideRouter), [`provideHttpClient`](https://angular.dev/api/common/http/provideHttpClient) — and `angular/angular` at tag `v22.1.5`: [`application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts), [`create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts), [`di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts), [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ApplicationConfig` has exactly one property. Not a dozen options, not a settings tree —
one array called `providers`, and everything an Angular application is configured to do
goes into it as a function call.** Routing is a call. HTTP is a call. Change detection,
hydration, error listeners, your own feature's setup — calls. That looks like ceremony
until you ask the question this topic exists to answer, and then it turns out to be the
only shape that survives a bundler.

The previous two topics explained a compiler that must resolve your metadata without
running your program, and a component that names its own dependencies locally. This topic
is the third leg: **how an application names the things that have no component to belong
to.** It is deliberately *not* a dependency-injection topic. Injectors, tokens, resolution
order and `inject()` are Phase 6. What is here is the wiring — the config object, the
convention, the catalogue, and the ways the array goes wrong.

## Chunks

🚧 **11 of 17 planned chunks written, across 39 files.** Seven of the eleven exhausted their
subject and split into lettered siblings, which is the 300-line cap working as designed — the cap
is a file size, never a content budget, so chunk 05 became eight files, chunk 06 seven, chunk 08
seven, chunk 10 seven and chunk 09 five, rather than any of them being shortened. The rows without links are planned and named; a link to a
page that does not exist breaks the build, so they stay as plain text until they land.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[`app.config.ts` and what bootstrap does with it](01-app-config-and-what-bootstrap-does-with-it.md)** | The two generated files verbatim, the one-property interface, what `bootstrapApplication` does step by step, and what "root provider" means with no `AppModule` |
| 02 | **[Why `provide*` replaced `forRoot()`](02-why-provide-functions-replaced-forroot.md)** | 🔴 The mechanical reason: a function call is reachable to a bundler and a decorator's options bag is not. The module-by-module mapping |
| 03 | **[`EnvironmentProviders` vs `Provider`](03-environmentproviders-vs-provider.md)** | The branded opaque type, the two error messages verbatim, where each type is accepted, and `importProvidersFrom` as a bridge with a price |
| 04 | **[Writing your own `provide*`](04-writing-your-own-provide-function.md)** | The minimum viable one, `with*` features the way the framework builds them, `ngDevMode` validation, initialisers, and the one rule that keeps it tree-shakable |
| 05 | **[Zoneless is the default](05-change-detection-providers.md)** | 🔴 Zoneless is the **default** in v22, proved three ways — the CLI schematic emits no change-detection provider, the v21 changelog, and `ZONELESS_ENABLED`'s own `{factory: () => true}` |
| 05b | **[`provideZoneChangeDetection()`, the opt-out](05b-provide-zone-change-detection-the-opt-out.md)** | The whole switch is two records overwritten in one Map; `ChangeDetectionScheduler` is deliberately *not* one of them; `NgZoneOptions` is two booleans, both defaulting to `false` |
| 05c | **[The redundant opt-in, and NG0408](05c-the-redundant-opt-in-and-ng0408.md)** | `provideZonelessChangeDetection()` re-registers what the framework already prepended; the six APIs that schedule change detection without Zone.js; NG0914 at call time, NG0408 at bootstrap, both dev-only |
| 05d | **[The polyfill half, and `NoopNgZone`](05d-the-polyfill-half-and-noopngzone.md)** | 🔴 `zone.js` is an **optional** peer, so `angular.json` and the provider array are two halves nothing keeps in sync — NG0908 in one direction, total silence in the other; `NoopNgZone` and NG0909 |
| 05e | **[`provideCheckNoChangesConfig`](05e-provide-check-no-changes-config.md)** | ⚠️ **Developer preview** and dev-mode-only — the last change-detection provider, and the one nothing in a production build ever sees. The `OnPush` blind spot, the two overloads and their four callable shapes |
| 05f | **[Dev-only, and developer preview](05f-check-no-changes-in-production-and-developer-preview.md)** | The whole provider is one ternary on `ngDevMode`, so a production build receives an **empty** `EnvironmentProviders` — and 🔴 the public-API golden says `// @public` while the source says `@developerPreview 20.0`. The JSDoc wins |
| 05g | **[The `checkNoChanges` interval](05g-the-check-no-changes-interval.md)** | `interval` turns the check into a self-rescheduling timer whose only exit is application destruction — and because half the provider is `multi: true`, no later call can switch it off |
| 05h | **[Hunting a stale binding](05h-hunting-a-stale-binding-in-zoneless.md)** | A zoneless app that mutates state outside the notification set renders the wrong value and reports nothing; a periodic exhaustive check is the only supported way to make that silence audible |
| 06 | **[Startup and error-listener providers](06-startup-and-error-listener-providers.md)** | The one initializer bootstrap actually waits for, and what "before the first render" means precisely |
| 06b | **[Initializer ordering and failure](06b-initializer-ordering-and-failure.md)** | 🔴 They start concurrently and are awaited together, so array position decides only when one *starts* — and the injection context ends at the first `await` |
| 06c | **[When a startup initializer fails](06c-when-a-startup-initializer-fails.md)** | A rejection produces no application at all, and the only thing between that and total silence is the `.catch` the CLI generated in `main.ts` |
| 06d | **[Environment initializers](06d-environment-initializers.md)** | The return value is thrown away, so an async body is a silent no-op; `{self: true}` means a route injector never inherits the application's |
| 06e | **[Platform initializers](06e-platform-initializers.md)** | 🔴 The one `provide*` returning a plain `StaticProvider` — so putting it in `app.config.ts` compiles perfectly and never runs |
| 06f | **[Global error listeners](06f-provide-browser-global-error-listeners.md)** | Two window listeners that both `preventDefault()`; free at startup, a no-op on the server, and it takes the browser's own reporting with it |
| 06g | **[`ErrorHandler` and NG0402](06g-error-handler-and-ng0402.md)** | No `providedIn`, so the array is the only place to replace it — injected through a lazy function token so your replacement may inject |
| 07 | **[`provideRouter()` and the route array](07-provide-router-and-the-route-array.md)** | What the call actually provides, why routes are a value and not a module, and `Routes` as the second thing bootstrap consumes |
| 07b | **[The bootstrap listener and initial navigation](07b-the-bootstrap-listener-and-initial-navigation.md)** | The third provider is what actually *starts* routing — it returns early for every component but the first, so two `provideRouter` calls make two listeners |
| 08 | **[Router features, one by one](08-router-features-one-by-one.md)** | What a `RouterFeature` *is* as a record, the full inventory, and ⚠️ `scrollOffset`'s missing standalone replacement named as a known gap |
| 08b | **[`withRouterConfig` and `withHashLocation`](08b-with-router-config-and-hash-location.md)** | The two config-only features — a single `useValue` that **replaces** rather than merges, and one non-multi provider that loses to anything later in the array |
| 08c | **[`withComponentInputBinding`](08c-with-component-input-binding.md)** | Four sources of route state bound straight to inputs, resolvers winning every collision — and `undefined` written into any bound input the route does not supply |
| 08d | **[View transitions and scrolling](08d-view-transitions-and-scrolling.md)** | ⚠️ Still developer preview, failing silently on unsupported browsers; in-memory scrolling restores nothing until you pass it options |
| 08e | **[Preloading and navigation errors](08e-preloading-and-navigation-errors.md)** | Configured by a provider but started by the bootstrap listener; 🔴 an error handler that redirects stops `NavigationError` being emitted at all |
| 08f | **[Initial navigation](08f-initial-navigation.md)** | The only router features that reach back into bootstrap — one hands you the trigger, the other holds the first paint open until the first navigation finishes |
| 08g | **[Tracing and the experimental end](08g-tracing-and-the-experimental-end.md)** | What a production user never meets — `withDebugTracing` compiles to an empty provider array, and three more are preview, experimental, or not public API |
| 09 | **[`HttpClient` without the call](09-provide-http-client-and-the-backend.md)** | 🔴 In v22 `HttpClient`, `HttpHandler` and `HttpBackend` are all `providedIn: 'root'`, so `provideHttpClient()` is **no longer required to inject `HttpClient` at all** — what the call is actually for |
| 09b | **[Inside `provideHttpClient()`](09b-inside-provide-http-client.md)** | The function body, the feature record, and what each provider it contributes is actually for |
| 09c | **[The `fetch` default and `withFetch()`](09c-the-fetch-default-and-withfetch.md)** | ⚠️ `FetchBackend` is the v22 default and `withFetch()` is **deprecated** — the deprecation quoted verbatim |
| 09d | **[`withXhr()` on the server](09d-withxhr-on-the-server-and-httpclientmodule.md)** | 🔴 The opt-out is not neutral: **eleven** `*_NOT_SUPPORTED_WITH_XHR` codes: `keepalive`, `cache`, `priority`, `mode`, `redirect`, `credentials`, `integrity`, `referrer`, `referrerPolicy`. Plus `NG2801` in SSR |
| 09e | **[`HttpClientModule`, the end of the road](09e-httpclientmodule-end-of-the-road.md)** | Where the module ends up, and why chunk 02's mapping to `provideHttpClient(withInterceptorsFromDi(), withXhr())` is the whole story |
| 10 | **[Interceptor order](10-http-features.md)** | 🔴 Requests pass through `withInterceptors([a, b, c])` in the order you wrote it and responses unwind in **reverse** — one `reduceRight` is the entire proof, and array position is the only ordering API there is |
| 10b | **[Choosing interceptor positions](10b-choosing-interceptor-positions.md)** | 🔴 **No single position** can both log the request that actually left the browser *and* see errors after another interceptor normalised them. Position is a design decision |
| 10c | **[Chain internals](10c-the-interceptor-chain-internals.md)** | The three guards in front of the fold — a `Set` de-duplicating by function **reference**, `this.chain === null` reading the token once per handler, and a root-interceptor lookup that changes mode when delegating to a parent |
| 10d | **[The two interceptor systems](10d-the-two-interceptor-systems.md)** | `withInterceptorsFromDi()` routes one function through an intermediate token so including it twice yields the **same reference** — the framework's own worked example of why `multi` de-duplicates on identity, not equality |
| 10e | **[XSRF protection](10e-xsrf-protection.md)** | `withXsrfConfiguration({})` contributes **zero providers** and still throws when paired with `withNoXsrfProtection()`, because the check reads `ɵkind` and never looks at what it provided — and `withNoXsrfProtection()` flips a flag rather than removing the interceptor |
| 10f | **[Requests made via parent](10f-requests-made-via-parent.md)** | Every `provideHttpClient()` builds an **independent** `HttpClient` whose interceptors are invisible to every other one; this is the single feature that reconnects them |
| 10g | **[JSONP, and the deprecated end](10g-jsonp-and-the-deprecated-end.md)** | ⚠️ `withJsonpSupport()` deprecated in 22.1 for a security reason stated in its own tag — angular.dev still documents it neutrally, and 🔴 the source wins |
| 11 | **Hydration, animations and the rest** *(not written yet)* | `provideClientHydration()` + `withEventReplay`; ⚠️ `withIncrementalHydration` and `provideAnimationsAsync` are both deprecated in v22 — what replaced them |
| 12 | **What does *not* belong in the array** *(not written yet)* | 🔴 The "everything ends up in `app.config.ts`" anti-pattern: component-scoped services, per-route lifetime, feature config, and `useValue` blobs that should be a typed `InjectionToken` |
| 13 | **Order dependence** *(not written yet)* | Where order matters and where it genuinely does not; last-wins for the same token; the cases people assume are ordered and are not |
| 14 | **`providedIn: 'root'` vs listing in the array** *(not written yet)* | When you need the array at all, what `'root'` buys, and the tree-shaking difference between the two |
| 15 | **Route-level `providers`** *(not written yet)* | The correct home for feature scope — lazy feature config, per-route lifetime, and how this forward-references Phases 6 and 8 |
| 16 | **The injector error surface** *(not written yet)* | 🔴 `NullInjectorError: No provider for X!` **no longer exists in v20+** — the current message, `NG0201`, `ɵNotFound`, and the three different causes behind one symptom |
| 17 | **The server config merge** *(not written yet)* | `app.config.server.ts`, `mergeApplicationConfig()`, and why the server config is a *merge* rather than a replacement |

## The one question this topic exists to answer

**"Why is there a convention here at all? Why not one config object with options?"**

Because an options object is *data*, and data is opaque to a bundler. `RouterModule.forRoot(routes)`
returns a `ModuleWithProviders` whose contents a build tool cannot reason about, so every
router feature ships whether you used it or not. `provideRouter(routes, withViewTransitions())`
is a *reference*: the features you did not call are never imported, and what you did not
import is not in your bundle. The convention is the compiler constraint from topic 01,
applied to configuration.

That is also why the type system is involved. `EnvironmentProviders` exists for no reason
other than to make `providers: [provideRouter(routes)]` on a `@Component` a compile error —
a runtime mistake promoted to a build-time one, which is the same trade this whole phase
keeps making.

## Phase gate

You are done with this topic when you can look at an unfamiliar `app.config.ts` and say,
for each entry, **what it provides, what scope it provides it at, and whether it belongs
there at all** — and when, given a feature that needs configuring, you can decide between a
root `provide*`, a route-level `providers` array and `providedIn: 'root'` without guessing.

## Where this connects

- **[01 · A compiler with a framework attached](../01-compiler-with-a-framework-attached/README.md)** —
  the static-analysability constraint this convention is an answer to. `provide*` functions
  survive the analysis `NgModule.forRoot()` fought against.
- **[02 · Standalone by default](../02-standalone-by-default/README.md)** — removing
  `NgModule` removed the place configuration used to live. This topic is where it went.
- **04 · `ng update`, not `npm install`** *(not written yet)* — the schematics that rewrite
  this array for you when a `provide*` signature changes or a feature is deprecated.
- **Phase 5 — Change detection and zoneless** *(not written yet)* — chunk 05 names the
  providers; that phase explains the machine behind them.
- **Phase 6 — Dependency injection** *(not written yet)* — 🔴 the mechanism deliberately
  not taught here: injectors, tokens, resolution, hierarchies and `inject()`.
- **Phase 8 — Routing** *(not written yet)* — chunks 07 and 08 configure the router; that
  phase is the router itself.
- **Phase 12 — SSR, hydration and the server** *(not written yet)* — chunks 11 and 17 are
  the configuration surface of everything that phase builds.

---

← Prev: [02 · Standalone by default](../02-standalone-by-default/README.md) · Start → [01 · `app.config.ts` and what bootstrap does with it](01-app-config-and-what-bootstrap-does-with-it.md) · Next topic → **04 · `ng update`, not `npm install`** *(not written yet)*
