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

🚧 **4 of 17 chunks written.** The rows without links are planned and named; a link to a
page that does not exist breaks the build, so they stay as plain text until they land.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[`app.config.ts` and what bootstrap does with it](01-app-config-and-what-bootstrap-does-with-it.md)** | The two generated files verbatim, the one-property interface, what `bootstrapApplication` does step by step, and what "root provider" means with no `AppModule` |
| 02 | **[Why `provide*` replaced `forRoot()`](02-why-provide-functions-replaced-forroot.md)** | 🔴 The mechanical reason: a function call is reachable to a bundler and a decorator's options bag is not. The module-by-module mapping |
| 03 | **[`EnvironmentProviders` vs `Provider`](03-environmentproviders-vs-provider.md)** | The branded opaque type, the two error messages verbatim, where each type is accepted, and `importProvidersFrom` as a bridge with a price |
| 04 | **[Writing your own `provide*`](04-writing-your-own-provide-function.md)** | The minimum viable one, `with*` features the way the framework builds them, `ngDevMode` validation, initialisers, and the one rule that keeps it tree-shakable |
| 05 | **Change-detection providers** *(not written yet)* | 🔴 Zoneless is the **default** in v22 — `provideZonelessChangeDetection()` is what you no longer write; `provideZoneChangeDetection()` is the opt-*out*, and `provideCheckNoChangesConfig` is developer preview |
| 06 | **Startup and error-listener providers** *(not written yet)* | `provideAppInitializer()`, `provideEnvironmentInitializer()`, `provideBrowserGlobalErrorListeners()` — what runs before the first render and what happens to a rejection |
| 07 | **`provideRouter()` and the route array** *(not written yet)* | What the call actually provides, why routes are a value and not a module, and the `Routes` type as the second thing bootstrap consumes |
| 08 | **Router features, one by one** *(not written yet)* | `withComponentInputBinding`, `withViewTransitions`, `withInMemoryScrolling`, `withPreloading`, `withRouterConfig`, `withHashLocation` — what each turns on and what it costs |
| 09 | **`provideHttpClient()` and the backend** *(not written yet)* | ⚠️ `FetchBackend` is the default in v22 and `withFetch()` is **deprecated**; `withXhr()` is the opt-out. The `HttpClientModule` end of the road |
| 10 | **HTTP features** *(not written yet)* | `withInterceptors`, `withXsrfConfiguration`, `withInterceptorsFromDi`, and 🔴 why interceptor array order *is* execution order |
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
