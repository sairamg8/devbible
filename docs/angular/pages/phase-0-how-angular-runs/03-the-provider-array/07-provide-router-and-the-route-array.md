---
title: "`provideRouter()` provides exactly four things and the `Router` is not one of them — the route table is a multi-provided array *of arrays* that the router flattens, which is why a second call appends instead of replacing"
sidebar_label: "07 · `provideRouter()` and the route array"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideRouter`](https://angular.dev/api/router/provideRouter),
> [`ROUTES`](https://angular.dev/api/router/ROUTES),
> [Creating and using services](https://angular.dev/guide/di/creating-and-using-services); and
> `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router.ts),
> [`router/src/router_config_loader.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config_loader.ts),
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) (v22.0.0 breaking changes).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideRouter(routes)` is the second thing bootstrap consumes after change detection, and its body
is six lines long. It provides a route table, a root `ActivatedRoute`, a bootstrap listener, and
whatever features you passed — and that is the entire list.** It does not provide the `Router`; the
`Router` is `@Service()`, which is v22's shorthand for `providedIn: 'root'`, and therefore exists
whether you call `provideRouter` or not. The route table it does provide goes in as a **multi**
provider whose declared type is `Route[][]` — an array of route arrays — which the `Router` reads and
flattens with `.flat()`. Every surprising thing about calling `provideRouter` twice follows from those
two facts, and neither of them is visible from the call site.

## The whole function

```ts
export function provideRouter(routes: Routes, ...features: RouterFeatures[]): EnvironmentProviders {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    // Publish this util when the router is provided so that the devtools can use it.
    ɵpublishNonCoreGlobalUtil('ɵgetLoadedRoutes', getLoadedRoutes);
    ɵpublishNonCoreGlobalUtil('ɵgetRouterInstance', getRouterInstance);
    ɵpublishNonCoreGlobalUtil('ɵnavigateByUrl', navigateByUrl);
  }

  return makeEnvironmentProviders([
    {provide: ROUTES, multi: true, useValue: routes},
    {provide: ActivatedRoute, useFactory: rootRoute},
    {provide: APP_BOOTSTRAP_LISTENER, multi: true, useFactory: getBootstrapListener},
    features.map((feature) => feature.ɵproviders),
  ]);
}

export function rootRoute(): ActivatedRoute {
  return inject(Router).routerState.root;
}
```

> *"Sets up providers necessary to enable `Router` functionality for the application. Allows to
> configure a set of routes as well as extra features that should be enabled."*

Four entries, two of them `multi`, one of them a nested array of whatever features you passed. Compare
that with `RouterModule.forRoot`'s eleven-branch body, quoted in
[02](02-why-provide-functions-replaced-forroot.md) — the difference is the entire argument for the
`provide*` convention, made concrete in one file. The `ngDevMode` block at the top is DevTools
plumbing and ships as nothing in production, which is the pattern chunk
[04](04-writing-your-own-provide-function.md) recommends for your own validation.

## The `Router` is not in that list

```ts
@Service()
export class Router {
```

`@Service()` is v22's shorthand for the older decorator. angular.dev:

> *"The `@Service` decorator serves as a modern, ergonomic shorthand for the traditional
> `@Injectable({ providedIn: 'root' })` syntax."*

🔴 **So `inject(Router)` works in an application that never calls `provideRouter`.** What
`provideRouter` supplies is the route *table*, the root `ActivatedRoute`, and the bootstrap hook that
starts navigation — not the service. The router reads its configuration optionally:

```ts
  config: Routes = inject(ROUTES, {optional: true})?.flat() ?? [];
```

`{optional: true}` means an application with no `provideRouter` at all is legal: `config` is `[]`, the
`Router` exists, and every navigation resolves to nothing. That is why a missing `provideRouter`
presents as *"my routes do not match"* rather than as an injection error — there is no missing
provider to report.

## `ROUTES` is `Route[][]`, and that is the fact worth memorising

```ts
/**
 * `ROUTES` is a low level API for router configuration via dependency injection.
 *
 * We recommend that in almost all cases to use higher level APIs such as `RouterModule.forRoot()`,
 * `provideRouter`, or `Router.resetConfig()`.
 *
 * @publicApi
 */
export const ROUTES = new InjectionToken<Route[][]>(
```

The token's type is an array **of route arrays** — one entry per contributor. Combined with
`multi: true` and the `.flat()` above, three consequences follow directly:

1. **Two `provideRouter` calls append; neither replaces the other.** `R3Injector.processProvider`
   handles a multi provider with `multiRecord.multi!.push(provider)`, so registration order is
   preserved and both route tables end up in the flattened result.
2. **Order is the array order, and the router matches first-wins.** A `{path: '**'}` catch-all in the
   *first* contributed array therefore shadows every route contributed by the second — silently, with
   no duplicate-route warning anywhere.
3. **Anything can contribute**, including a raw `{provide: ROUTES, multi: true, useValue: [...]}`.
   That is the escape hatch the JSDoc calls *"a low level API"* and recommends against.

```ts
// ⛔ two contributions; adminRoutes' wildcard, if it has one, hides shopRoutes entirely
providers: [
  provideRouter(adminRoutes),
  provideRouter(shopRoutes),
],

// ✅ one contribution, one place to reason about order
providers: [
  provideRouter([...adminRoutes, ...shopRoutes]),
],
```

⚠️ **Calling `provideRouter` twice also registers two `APP_BOOTSTRAP_LISTENER` entries**, which has
its own consequences at startup — [07b](07b-the-bootstrap-listener-and-initial-navigation.md).

## Routes are a value, not a module — and that is the point

`Routes` is `Route[]`. It is a plain array of plain objects, which means it can be built the way any
other value is built:

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.Home) },
  {
    path: 'admin',
    canMatch: [() => inject(AuthStore).isAdmin()],
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
  },
  { path: '**', loadComponent: () => import('./not-found/not-found').then((m) => m.NotFound) },
];
```

Nothing here is framework-special. The array can be filtered by a build-time flag, concatenated from
several files, or generated from a manifest — and because `loadChildren` returns a `Routes` value
rather than an `NgModule`, a lazily-loaded feature contributes routes without contributing a module.
That is the same reachability argument as chunk 02: a value a bundler can follow beats a construct it
has to interpret.

The one framework-special field is `providers`, and its own JSDoc is the sentence that defines route
scope:

> *"A `Provider` array to use for this `Route` and its `children`."*
> *"The `Router` will create a new `EnvironmentInjector` for this `Route` and use it for this `Route`
> and its `children`. If this route also has a `loadChildren` function which returns an `NgModuleRef`,
> this injector will be used as the parent of the lazy loaded module."*

```ts
  providers?: Array<Provider | EnvironmentProviders>;
```

That type — `Array<Provider | EnvironmentProviders>`, the same union `ApplicationConfig.providers`
uses — is why a `provide*` function can be placed on a route at all, and why deciding *which* level to
put one at is a real decision rather than a style question. Chunk 15 is that decision; this chunk only
establishes that the array exists and is a peer of the application's.

## Gotchas

**★ Symptom: you called `provideRouter` twice and got both route tables, not the second one.** Cause:
`ROUTES` is `multi: true` and typed `Route[][]`; the `Router` reads it with
`inject(ROUTES, {optional: true})?.flat()`, so contributions accumulate in registration order. Fix:
make one call and concatenate the arrays yourself —

```ts
providers: [provideRouter([...adminRoutes, ...shopRoutes])],
```

**★ Symptom: routes from your second `provideRouter` call are unreachable, with no error.** Cause: the
first array ends in a `{path: '**'}` catch-all, `.flat()` preserves order, and the router matches
first-wins. Fix: there must be exactly one wildcard and it must be last in the flattened result —

```ts
providers: [
  provideRouter([
    ...adminRoutes,          // no wildcard inside these
    ...shopRoutes,
    { path: '**', loadComponent: () => import('./not-found/not-found').then((m) => m.NotFound) },
  ]),
],
```

**★ Symptom: `provideRouter(...)` placed in a lazily-loaded route's `providers` does nothing.** Cause:
the root `Router` is `@Service()` and read `ROUTES` from the injector it was created in — the
application injector. A route injector's `ROUTES` record is a different record that the existing
`Router` never consults. Fix: contribute the routes through `loadChildren`, which is the supported
path, and keep route-scoped *services* on the route —

```ts
{
  path: 'admin',
  providers: [AdminAuditLog],                                   // services: yes
  loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),   // routes: here
},
```

**Symptom: `inject(ActivatedRoute)` in a service always returns the *root* route, never the active
one.** Cause: `provideRouter` provides `{provide: ActivatedRoute, useFactory: rootRoute}` at the
application level, and `rootRoute()` is literally `inject(Router).routerState.root`. The
per-component `ActivatedRoute` comes from the router outlet's injector, not from this record. Fix: do
not inject `ActivatedRoute` into a root-provided service; take what you need from the component, or
read the router's current state explicitly —

```ts
@Injectable({ providedIn: 'root' })
export class Breadcrumbs {
  private readonly router = inject(Router);
  current(): string {
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.snapshot.title ?? '';
  }
}
```

**Symptom: the application boots, `inject(Router)` works, and no route ever matches.** Cause: there is
no `provideRouter` call at all. `Router` is root-provided, `ROUTES` is read with `{optional: true}`,
and `config` falls back to `[]` — so nothing reports a missing provider. Fix: add the call; the
absence of an injection error is not evidence that routing was configured.

**Symptom: a route array assembled at module scope from several files silently loses entries after a
production build.** Cause: not the router — a circular import between the route files, which leaves
one of them evaluating to `undefined` at the moment the array literal is built. Because
`provideRouter` takes a *value*, this is an ordinary JavaScript initialisation-order bug rather than
anything framework-specific. Fix: give each feature a single route file with no imports from its
siblings, and compose only at the top —

```ts
export const routes: Routes = [
  ...homeRoutes,
  ...adminRoutes,
  ...shopRoutes,
];
```

## Interview questions

**★ `provideRouter` returns four providers and none of them is the `Router`. Where does the `Router`
come from, and why does that design choice matter?**
From `@Service()` on the class itself, which angular.dev describes as *"a modern, ergonomic shorthand
for the traditional `@Injectable({ providedIn: 'root' })` syntax"* — so it is root-provided and
tree-shakable, present as soon as anything injects it. It matters because it decouples *having a
router* from *having configured one*: `ROUTES` is read with `{optional: true}`, so an application with
no `provideRouter` call still has a working `Router` with an empty route table. That is why forgetting
the call produces "nothing matches" rather than an injection error, and it is also why a library can
inject `Router` without forcing the host application to configure routing.

**★ What happens if you call `provideRouter` twice, and why is that different from calling
`provideHttpClient` twice?**
Two `provideRouter` calls **append**: `ROUTES` is `multi: true`, so `processProvider` pushes both
contributions onto one record, and the `Router` flattens them with `.flat()` in registration order.
The route tables are concatenated, and a wildcard in the first one shadows everything in the second.
HTTP's core providers are *not* multi — `HttpBackend`, `HttpHandler` and friends are ordinary tokens
— so a second `provideHttpClient()` overwrites those records and the last call wins. Same injector,
same array, two opposite collision rules, decided entirely by whether the token was declared `multi`.
Knowing which is which for a given `provide*` is the difference between "my second call was ignored"
and "my second call was appended", and both are silent.

**★ `ROUTES` is typed `Route[][]` rather than `Route[]`. Why?**
Because a multi-provider's resolved value is an array containing every contributed value, and each
contribution here is itself a route table. So the token's type has to be one level deeper than the
thing you actually want — `Route[][]` — and someone has to flatten it. The `Router` does, in a field
initialiser: `config: Routes = inject(ROUTES, {optional: true})?.flat() ?? []`. This is the general
shape of every multi-provided collection API in Angular, and reading the token's type is the quickest
way to tell an accumulating token from a replacing one before you write the second call.

**Why is a route table a plain array rather than a module, and what does that buy at build time?**
Because a value can be followed by a bundler and a module cannot. `RouterModule.forChild(routes)`
returned a `ModuleWithProviders` whose contents a build tool has to interpret; `Routes` is an array
literal whose `loadComponent` and `loadChildren` entries are dynamic `import()` calls the bundler
recognises as split points. That is what makes per-route code splitting fall out of the route
definition rather than out of separate configuration — and it is the same argument chunk 02 makes for
`provide*` over `forRoot`, applied one level down.

---

← Prev: [`ErrorHandler` and NG0402](06g-error-handler-and-ng0402.md) · Index: [Topic index](README.md) · Next → [The bootstrap listener and initial navigation](07b-the-bootstrap-listener-and-initial-navigation.md)
