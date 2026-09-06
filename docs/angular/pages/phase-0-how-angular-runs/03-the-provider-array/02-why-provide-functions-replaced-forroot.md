---
title: "provide* functions replaced NgModule.forRoot() because a function call is reachable to a bundler and a decorator's options bag is not"
sidebar_label: "02 · Why provide* replaced forRoot"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideHttpClient`](https://angular.dev/api/common/http/provideHttpClient),
> [`provideRouter`](https://angular.dev/api/router/provideRouter) — and `angular/angular` at tag
> `v22.1.5`:
> [`common/http/src/module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/module.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`router/src/router_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_module.ts),
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts).
> Documentation-validated; **no sandbox run**.

**The `forRoot()` pattern was not replaced because it was ugly. It was replaced because a
`ModuleWithProviders` had to name every provider it might need, unconditionally, in a data
structure the bundler cannot reason about — so importing `HttpClientModule` shipped the JSONP
backend to every user of it. A `provide*` function replaces that data structure with ordinary
function calls, and a function you never call is dead code.**

## What `forRoot()` was, and why it existed at all

An `NgModule` could not take arguments. `@NgModule({ providers: [...] })` is a decorator on a
class, evaluated once, with no place to put "the routes for *this* application". The workaround was
a static factory returning a `ModuleWithProviders<T>` — a `{ ngModule, providers }` pair the
compiler unpacked at the import site:

```ts
// The Angular ≤ 14 shape. Kept here as history — do not write new code like this.
@NgModule({ imports: [BrowserModule, HttpClientModule, RouterModule.forRoot(routes, {
  useHash: false,
  preloadingStrategy: PreloadAllModules,
  bindToComponentInputs: true,
})], bootstrap: [AppComponent] })
export class AppModule {}
```

`forRoot` carried the singletons; `forChild` carried only the per-feature bits, and calling
`forRoot` twice was a real, common production bug — the router shipped a dedicated
`ROUTER_FORROOT_GUARD` provider whose only job was to detect it. That guard is still in the v22
source of `RouterModule.forRoot`, in a `ngDevMode` branch.

## The mechanical reason the pattern had to go

Look at what `RouterModule.forRoot` is *forced* to do, verbatim from
`packages/router/src/router_module.ts` at `v22.1.5`:

```ts
static forRoot(routes: Routes, config?: ExtraOptions): ModuleWithProviders<RouterModule> {
  return {
    ngModule: RouterModule,
    providers: [
      ROUTER_PROVIDERS,
      typeof ngDevMode === 'undefined' || ngDevMode
        ? config?.enableTracing ? withDebugTracing().ɵproviders : []
        : [],
      {provide: ROUTES, multi: true, useValue: routes},
      // ...
      config?.useHash ? provideHashLocationStrategy() : providePathLocationStrategy(),
      provideRouterScroller(),
      config?.preloadingStrategy ? withPreloading(config.preloadingStrategy).ɵproviders : [],
      config?.initialNavigation ? provideInitialNavigation(config) : [],
      // ...
```

Every branch is decided at **runtime**, from an options object. `withDebugTracing`,
`provideHashLocationStrategy`, `withPreloading` and `provideInitialNavigation` are all *statically
referenced* by `forRoot`'s body, whatever `config` says. A bundler doing reachability analysis sees
one function that references all of them, so all of them are in the bundle. The `useHash: false`
you wrote does not remove `HashLocationStrategy` — it only stops it being instantiated.

The `provide*` form moves the branch from runtime to **call site**:

```ts
// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ]
};
```

`withHashLocation` is now a top-level export that nothing in your import graph mentions.
`HashLocationStrategy` is unreachable and the bundler drops it. That is the entire argument, and it
is why the feature functions are separate exported functions rather than fields on an options
object.

## The convention, stated precisely

- **`provideThing(...)`** — the root setup. Returns `EnvironmentProviders`
  ([chunk 03](03-environmentproviders-vs-provider.md)). Called once, in
  `ApplicationConfig.providers` (or, for a genuinely feature-scoped subsystem, on a route —
  **chunk 15** *(not written yet)*).
- **`withFeature(...)`** — an optional capability, passed as a *variadic argument to its own
  `provide*` function*, never placed in the providers array directly. Returns an opaque feature
  object, not providers.
- The feature object is a branded record. From `packages/common/http/src/provider.ts`:

```ts
export interface HttpFeature<KindT extends HttpFeatureKind> {
  ɵkind: KindT;
  ɵproviders: Provider[];
}
```

  The router's `RouterFeature` has the identical shape. The `ɵ` prefix means "internal, do not
  touch"; the `ɵkind` discriminator is what lets `provideHttpClient` reject contradictory
  combinations at call time, which a bag of booleans could not do.

## The mapping, module by module

| `NgModule` era | v22 | Status of the module in 22.1.5 |
|---|---|---|
| `RouterModule.forRoot(routes, opts)` | `provideRouter(routes, ...features)` | not deprecated; still exports the directives |
| `RouterModule.forChild(routes)` | nothing — a feature is just a `Routes` array | as above |
| `HttpClientModule` | `provideHttpClient(...features)` | **deprecated** |
| `HttpClientXsrfModule.withOptions()` | `withXsrfConfiguration({ ... })` | **deprecated** |
| `HttpClientJsonpModule` | `withJsonpSupport()` | **deprecated** (and so is the feature) |
| `BrowserAnimationsModule` | `provideAnimationsAsync()` | both superseded — **chunk 11** *(not written yet)* |
| `BrowserModule` | nothing; `bootstrapApplication` provides it | not needed in a standalone app |
| `StoreModule.forRoot(reducers)` (NgRx) | `provideStore(reducers)` | NgRx 22.0.0 ships both |

`HttpClientModule`'s deprecation notice in the v22 source is worth reading literally:

> *"@deprecated use `provideHttpClient(withInterceptorsFromDi())` as providers instead"*

…and so is its body, because it tells you something the notice does not:

```ts
@NgModule({
  providers: [provideHttpClient(withInterceptorsFromDi(), withXhr())],
})
export class HttpClientModule {}
```

The legacy module is now a shim over the new function — and it **pins `withXhr()`**. An application
that still imports `HttpClientModule` is not on the `fetch` backend, no matter what the v22 release
notes say the default is. [Chunk 10](10-http-features.md) picks that up.

## Why this is not just tree-shaking

Tree-shaking is the headline benefit, but two more fall out of the same change:

1. **Composition without a class.** `provideRouter(routes, withViewTransitions(), withHashLocation())`
   composes three independent capabilities. The `NgModule` equivalent required either an options bag
   that grew forever, or one module per combination.
2. **A type-level home for "this belongs to the application".** `forRoot` could be imported into a
   lazily-loaded feature module by mistake and silently create a second router. `provideRouter`
   returns `EnvironmentProviders`, which the compiler refuses to place in a component's `providers`
   at all — the next chunk is about exactly that.

## Gotchas

**★ Symptom: `Argument of type 'HttpFeature<HttpFeatureKind.Interceptors>' is not assignable to
parameter of type 'Provider | EnvironmentProviders'`.** Cause: a `with*` function was put directly
in the providers array instead of being passed to its `provide*` function. Fix:

```ts
// wrong — withInterceptors() returns a feature, not providers
providers: [provideHttpClient(), withInterceptors([authInterceptor])]

// right — the feature is an argument
providers: [provideHttpClient(withInterceptors([authInterceptor]))]
```

**★ Symptom: interceptors registered with `withInterceptors` never run, and the app also imports
`HttpClientModule`.** Cause: `HttpClientModule` calls `provideHttpClient(withInterceptorsFromDi(), withXhr())`
itself, so you now have two configurations of the same subsystem in one injector and the backend is
pinned to `XMLHttpRequest`. Fix: delete the module import entirely and keep one call —

```ts
providers: [
  provideHttpClient(withInterceptors([authInterceptor])),
]
```

**★ Symptom: you look for `provideRouter.forChild` or a `provideRouterChild`.** Cause: `forChild`
has no successor because it solved a problem that no longer exists — a feature's routes are now a
plain `Routes` array referenced by `loadChildren`, and its providers ride the route. Fix: export the
array and load it.

```ts
// src/app/orders/orders.routes.ts
import { Routes } from '@angular/router';
import { OrdersApi } from './orders-api';

export const ordersRoutes: Routes = [
  {
    path: '',
    providers: [OrdersApi],
    loadComponent: () => import('./orders-page').then((m) => m.OrdersPage),
  },
];
```

**★ Symptom: `provideRouter` appears twice in a merged configuration and navigation behaves
strangely.** Cause: `provideRouter` registers routes as `{provide: ROUTES, multi: true, useValue: routes}`
and adds an `APP_BOOTSTRAP_LISTENER`, both multi-providers. A second call does not replace the
first — it **appends**, so you get both route tables concatenated and two bootstrap listeners. Fix:
call it once and concatenate the arrays yourself; see **chunk 13** *(not written yet)*.

**★ Symptom: a third-party library's `provideX()` has no effect in a lazily-loaded feature.** Cause:
you called it in a route's `providers` but the library's own services are `providedIn: 'root'` and
were already instantiated against the application injector. Fix: for anything the library documents
as root configuration, call it in `ApplicationConfig.providers`; reserve route-level calls for
libraries that explicitly support per-route configuration.

## Interview questions

**★ Why is `provideHttpClient(withInterceptors([...]))` tree-shakable when `HttpClientModule` was
not?**
Because reachability. `HttpClientModule`'s decorator metadata names a fixed provider list, and
`RouterModule.forRoot`'s body statically references every feature it might branch to, so a bundler
must keep all of them. With `provide*`/`with*`, the only symbols in your import graph are the ones
you literally imported and called: never import `withJsonpSupport` and `JsonpClientBackend` has no
path from the entry point, so esbuild drops it. Nothing about DI changed — what changed is that the
configuration decision now happens in JavaScript the bundler can follow.

**★ What is a "feature" object, and why isn't a `with*` function just returning `Provider[]`?**
It returns `{ ɵkind, ɵproviders }`. The discriminator exists so the `provide*` function can validate
combinations before anything is injected: `provideHttpClient` throws
`Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the same call
to provideHttpClient(), which is a contradiction.` in a development build. If features were bare
provider arrays there would be nothing to inspect, and the contradiction would surface as a
confusing runtime behaviour instead of a message at bootstrap.

**★ `RouterModule.forRoot` is not deprecated in v22. Should you still use it?**
No, for new code. It survives because `RouterModule` also exports `RouterOutlet`, `RouterLink` and
`RouterLinkActive`, which standalone components still import, and because removing a widely-used
static would break every remaining `NgModule` application. But its body is implemented in terms of
`withPreloading`, `withDebugTracing` and friends, so it is strictly a superset of `provideRouter`
with worse tree-shaking and a runtime options bag. Use `provideRouter` and import the directives
individually.

**What did `forRoot`/`forChild` actually protect against, and what protects against it now?**
Duplicate root singletons — a lazily-loaded module importing `RouterModule.forRoot` would build a
second `Router`. The protection was a runtime guard (`ROUTER_FORROOT_GUARD`) that threw a helpful
error. In v22 the equivalent protection is at the type level and is stronger: `provideRouter`
returns `EnvironmentProviders`, so it cannot go into a component's `providers` at all, and a route's
`providers` deliberately accepts it because per-route router configuration is not a thing you can
express by accident.

**Is there any situation where a `ModuleWithProviders` is still the right answer?**
Only inside a library that must support consumers on Angular versions where the `provide*` API did
not exist, or one whose public surface is genuinely an `NgModule`. For consuming such a library,
`importProvidersFrom(TheirModule)` is the bridge — with the costs the next chunk sets out.

---

← Prev: [app.config.ts and bootstrap](01-app-config-and-what-bootstrap-does-with-it.md) · Index: [Topic index](README.md) · Next → [EnvironmentProviders vs Provider](03-environmentproviders-vs-provider.md)
