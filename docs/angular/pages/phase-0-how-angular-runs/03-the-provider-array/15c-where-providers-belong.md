---
title: "`providers` belongs on the highest route whose whole subtree wants the scope — because the injector is cached per `Route` object, two siblings that each declare the same array get two injectors and two instances"
sidebar_label: "15c · Where `providers` belong"
sidebar_position: 15.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers);
> and `angular/angular` at tag `v22.1.5`:
> [`router/src/utils/config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config.ts),
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts),
> [`router/src/recognize.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/recognize.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every duplicated-instance bug in route providers is the same bug: the array is on more than one `Route` object.** [15](15-route-level-providers.md) established why — `getOrCreateRouteInjectorIfNeeded` caches on `route._injector`, keyed by the identity of the configuration object, with no deduplication by provider, by token or by path. So the placement question has exactly one right answer, and it is structural rather than stylistic: `providers` goes on the **highest route whose entire subtree wants that scope**, exactly once. This page is that rule, the two shapes it produces, and the five ways object identity makes the rule bite in code that looks correct.

## The shape that actually pays off

`providers` on the route that *owns the feature*, and nothing on the leaves:

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { provideHttpClient, withInterceptors, withRequestsMadeViaParent } from '@angular/common/http';
import { REPORTING_CONFIG } from './reporting/reporting-config';
import { auditInterceptor } from './reporting/audit-interceptor';

export const routes: Routes = [
  {
    path: 'reporting',
    providers: [
      { provide: REPORTING_CONFIG, useValue: { pageSize: 200, exportFormat: 'csv' } },
      provideHttpClient(withInterceptors([auditInterceptor]), withRequestsMadeViaParent()),
    ],
    children: [
      { path: '', loadComponent: () => import('./reporting/overview').then((m) => m.Overview) },
      { path: ':id', loadComponent: () => import('./reporting/detail').then((m) => m.Detail) },
      { path: ':id/export', loadComponent: () => import('./reporting/export').then((m) => m.Export) },
    ],
  },
];
```

One injector, created the first time anything under `/reporting` is navigated to, shared by all three children, their guards, their resolvers and their components. `REPORTING_CONFIG` is unresolvable anywhere else in the application, which is the point: a token that only exists where it means something cannot be injected somewhere it does not.

The `withRequestsMadeViaParent()` in there is [10f](10f-requests-made-via-parent.md)'s subject and this is the hierarchy it was designed against — the feature gets its own `HttpClient` with an extra interceptor, delegating to the application's chain rather than replacing it.

## The anti-shape

The same config with `providers` pushed down onto the leaves:

```ts
// ⛔ three injectors, three REPORTING_CONFIG instances, three HttpClient chains
export const routes: Routes = [
  {
    path: 'reporting',
    children: [
      {
        path: '',
        providers: [{ provide: REPORTING_CONFIG, useValue: DEFAULTS }],
        loadComponent: () => import('./reporting/overview').then((m) => m.Overview),
      },
      {
        path: ':id',
        providers: [{ provide: REPORTING_CONFIG, useValue: DEFAULTS }],
        loadComponent: () => import('./reporting/detail').then((m) => m.Detail),
      },
      {
        path: ':id/export',
        providers: [{ provide: REPORTING_CONFIG, useValue: DEFAULTS }],
        loadComponent: () => import('./reporting/export').then((m) => m.Export),
      },
    ],
  },
];
```

Each leaf is a separate `Route` object, so `getOrCreateRouteInjectorIfNeeded` runs three times and caches three injectors. With a `useValue` of an immutable config that is merely wasteful. With a **service holding state** it is a bug: navigating from `/reporting/7` to `/reporting/7/export` resolves the service from a different injector and gets a different instance, with none of the state the previous screen accumulated.

**The rule that falls out of the code:** `providers` belongs on the *highest* route that needs the scope, exactly once. If two sibling routes need the same instance, the thing they share is their parent — put it there.

## The two placements that are *not* a choice

Two arrangements look interchangeable in a route array and are not.

**A route with `children` and `providers`** creates one injector, and `recognize` hands
`route._injector ?? injector` to the child recursion, so every child, grandchild, guard, resolver and
component below it shares it. That is the scoping tool.

**A leaf route with `providers`** creates one injector too — but it has no descendants, so the scope
is a single screen. That is occasionally what you want (a screen with a genuinely private,
expensive dependency) and is usually a mistake, because the moment the screen grows a child route
or a sibling that needs the same data, you are one edit away from the duplication above.

A route with **both `component` and `children`** — a layout shell with nested pages — behaves like
the first case: the shell component and every nested page resolve against the same route injector,
because the shell's snapshot and the children's snapshots were all built from the same `injector`
variable in `recognize`.

```ts
export const routes: Routes = [
  {
    path: 'workspace',
    component: WorkspaceShell,          // the layout, with its own <router-outlet>
    providers: [WorkspaceState],        // ONE instance, shared by shell and all pages
    children: [
      { path: 'files', loadComponent: () => import('./files').then((m) => m.Files) },
      { path: 'members', loadComponent: () => import('./members').then((m) => m.Members) },
    ],
  },
];
```

This is the arrangement worth reaching for by default: the shell holds the feature's UI state, the
route holds the feature's providers, and the two have the same lifetime.

## Gotchas

**★ Symptom: two sibling routes each list `providers: [CartService]` and you get two carts.** Cause: `route._injector` is cached per `Route` object, and two sibling routes are two objects — `getOrCreateRouteInjectorIfNeeded` runs once for each and calls `createEnvironmentInjector` twice. Nothing deduplicates by provider identity. Fix: hoist the array onto the common parent, and let the children inherit by having no `providers` of their own —

```ts
export const routes: Routes = [
  {
    path: 'shop',
    providers: [CartService],          // one injector, one CartService
    children: [
      { path: 'browse', loadComponent: () => import('./browse').then((m) => m.Browse) },
      { path: 'checkout', loadComponent: () => import('./checkout').then((m) => m.Checkout) },
    ],
  },
];
```

**★ Symptom: adding `providers` to a route changed nothing — the service is still the root instance.** Cause: something already resolved that token against an ancestor injector, or the class is `providedIn: 'root'` and the code path that injects it runs outside the route subtree. A route provider creates a *new record in a new injector*; it does not retro-fit anything already constructed elsewhere, and it is invisible to code that resolves from the application injector. Chunk 04's version of this — the same `provideBilling()` called both in `app.config.ts` and on a route — is the same mechanism at feature scale: [04 · Writing your own `provide` function](04-writing-your-own-provide-function.md). Fix: if the feature is genuinely feature-scoped, remove the call from `app.config.ts` entirely and leave only the route's —

```ts
// src/app/app.config.ts — the billing call is GONE from here
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()],
};

// src/app/app.routes.ts — it lives in exactly one place now
export const routes: Routes = [
  {
    path: 'billing',
    providers: [provideBilling({ currency: 'GBP', retries: 2 })],
    loadChildren: () => import('./billing/billing.routes').then((m) => m.billingRoutes),
  },
];
```

**★ Symptom: the same `Routes` array imported and mounted under two different parent routes shares one injector.** Cause: the cache lives on the `Route` **object**, and importing the same array twice gives you the same objects. `route._injector` is already set by the first subtree's activation, so the second mount reuses it — including its parent, which is the *first* mount's ancestor chain. Fix: if a feature is genuinely mounted twice with different surroundings, build the array from a factory so each mount gets fresh objects —

```ts
// src/app/reporting/reporting.routes.ts
export function reportingRoutes(scope: 'internal' | 'partner'): Routes {
  return [
    {
      path: '',
      providers: [{ provide: REPORTING_SCOPE, useValue: scope }],
      loadComponent: () => import('./overview').then((m) => m.Overview),
    },
  ];
}

// src/app/app.routes.ts
export const routes: Routes = [
  { path: 'internal/reports', children: reportingRoutes('internal') },
  { path: 'partner/reports', children: reportingRoutes('partner') },
];
```

**★ Symptom: you spread a shared route array into two places to "copy" it, and the two copies still share one injector.** Cause: a spread copies the *array*, not the objects inside it. `[...featureRoutes]` produces a new array whose elements are the same `Route` objects, and `_injector` is cached on the object. Fix: a spread is not a clone; build the routes from a factory function so each mount constructs new objects —

```ts
// ⛔ same Route objects, therefore one shared injector across both mounts
{ path: 'a', children: [...featureRoutes] },
{ path: 'b', children: [...featureRoutes] },

// ✅ new objects per mount
{ path: 'a', children: featureRoutes() },
{ path: 'b', children: featureRoutes() },
```

**★ Symptom: a named-outlet route and a primary-outlet route at the same path do not share providers.** Cause: they are two `Route` objects with different `outlet` values, matched independently by `recognize`, and each gets its own `_injector`. Nothing about sharing a path string makes them share an injector. Fix: if the two outlets genuinely need one instance, hoist the providers to their common parent route and leave both outlet routes without a `providers` array of their own — a route without `providers` is transparent and inherits.

**★ Symptom: moving `providers` from a leaf route up to its parent changed which instances existing code sees.** Cause: it moved the record into a *different* injector, one level up. Anything that had already resolved the token against the leaf injector keeps its old instance; anything resolving after the move walks to the parent. During a refactor both can be live at once. Fix: move the array and, in the same change, make sure nothing else in the tree still declares the same token — `grep` for the token name across the route files. Injector scope is not something a type checker can verify for you.

**★ Symptom: two features each want `provideHttpClient(withInterceptors([...]))` and you hoisted it to their shared parent to "avoid duplication".** Cause: this is the one case where hoisting is wrong. Hoisting merges the two feature's interceptor chains into one, so every request from either feature now runs both features' interceptors. Providers are not code you deduplicate; they are a scope you declare. Fix: leave one `provideHttpClient()` call per feature route, and if they must share a base chain, use `withRequestsMadeViaParent()` so each feature's chain delegates upward rather than replacing — [10f](10f-requests-made-via-parent.md) has the full model.

## Interview questions

**★ Where do you put `providers` when two sibling routes need the same instance and a third does not?**
On the parent the two share, never on the siblings. Two sibling `Route` objects are two cache slots and therefore two injectors — there is no deduplication anywhere in `getOrCreateRouteInjectorIfNeeded`. The route that should carry the array is the highest one whose whole subtree wants that scope. If a third sibling must *not* see the service, then it does not belong in that subtree, and the answer is to restructure the route tree rather than to sprinkle the providers: injector scope in Angular follows the tree exactly, and any attempt to express "these two but not that one" at the same level is a request the mechanism cannot serve.

**★ Route `providers` or `providedIn: 'root'` plus a lazy `loadComponent` — which gives you a smaller bundle?**
Neither, mostly: both tree-shake, and the code splitting comes from the `import()` in `loadComponent` or `loadChildren` in either case. What route `providers` add is **scope**: a lifetime bounded by the route subtree, and the ability to bind configuration tokens to a feature so that the same class can be configured differently in two places. `providedIn: 'root'` gives you one instance for the application, created lazily on first injection, whose *code* still arrives in whatever chunk references it. Choose route providers when there is a feature-specific *configuration*, or when you genuinely want the instance to be unreachable outside the feature; choose `providedIn: 'root'` otherwise, because it is one fewer injector to reason about. The full comparison is [14 · `providedIn: 'root'` vs listing in the array](14-providedin-root-vs-the-array.md).

**★ Two sibling features need the same service instance, a third sibling must not see it at all. How do you express that?**
You restructure the route tree, because injector scope follows the tree exactly and there is no way to say "these two but not that one" at the same level. Give the two features a shared parent route — a pathless one with `path: ''` if there is no URL segment to hang it on — put `providers` there, and leave the third sibling outside it. The alternative people reach for, declaring the array on both siblings, gives two injectors and two instances; the other alternative, hoisting to the common ancestor of all three, makes it visible to the third. If restructuring is impossible, the honest answer is that the service is application-scoped and the third feature simply must not inject it, which is a convention rather than a guarantee.

**Why is a spread not enough to give two mounts of the same feature separate injectors, and what is?**
Because `route._injector` is cached on the `Route` object and a spread copies only the array that holds those objects. Both mounts then resolve to the same cached injector, whose parent is whichever mount matched first — so the second mount silently inherits the first one's ancestor chain as well as its instances. What is enough is fresh objects: a factory function returning a new `Routes` array per call, which also gives you somewhere to parameterise the mount (a different `useValue` per instance). This is one of the few places in Angular where object identity, not shape, is load-bearing configuration.

**A route has `component`, `children` and `providers`. How many injectors, and who sees them?**
One injector, and everything below sees it: the layout component named by `component`, every nested child route, their guards, their resolvers and their components. `recognize` computes `injector = route._injector ?? injector` once per matched route and passes that same value both into `createSnapshot` for this route and, as `childInjector`, into the recursion — so shell and pages come out of the same injector by construction. This is why the layout-shell pattern and route providers fit together so naturally: the shell's lifetime and the injector's scope are the same subtree.

← Prev: [When the injector is created](15b-when-the-injector-is-created.md) · Index: [Topic index](README.md) · Next → [Guards, resolvers and route initializers](15d-guards-resolvers-and-route-initializers.md)
