---
title: "A route's `providers` array is compiled into an `EnvironmentInjector` that the router creates lazily, caches on the route config object, and by default never destroys"
sidebar_label: "15 · Route-level `providers`"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers),
> [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection),
> [NG0207](https://angular.dev/errors/NG0207); and `angular/angular` at tag `v22.1.5`:
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts),
> [`router/src/utils/config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config.ts),
> [`router/src/utils/config_matching.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config_matching.ts),
> [`router/src/recognize.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/recognize.ts),
> [`router/src/router_outlet_context.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_outlet_context.ts),
> [`router/src/directives/router_outlet.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/directives/router_outlet.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`Route.providers` takes the identical type as `ApplicationConfig.providers` — `Array<Provider | EnvironmentProviders>` — and that is deliberate: both positions configure an `EnvironmentInjector`, so anything a `provide*()` function returns is legal in either.** What differs is *which* injector, *when* it is created, and *how long it lives*. The application injector is created once by `bootstrapApplication` and lives as long as the tab. A route's injector is created by the router the first time that route matches an attempted navigation, is cached on the route configuration object itself under an internal `_injector` field, and — unless you opt into an experimental feature — is **never destroyed**. Every "why do I have two instances of this service", "why can't my guard see it" and "why does navigating away and back give me the same state" question about route providers is answered by those three sentences, and none of them are visible from the call site.

## The contract, verbatim

From [`packages/router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts), the whole public documentation of the field:

```ts
  /**
   * A `Provider` array to use for this `Route` and its `children`.
   *
   * The `Router` will create a new `EnvironmentInjector` for this
   * `Route` and use it for this `Route` and its `children`. If this
   * route also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be
   * used as the parent of the lazy loaded module.
   * @see [Route providers](guide/di/defining-dependency-providers#route-providers)
   */
  providers?: Array<Provider | EnvironmentProviders>;
```

Two lines below it, the field that does the caching — internal, but it is the thing whose behaviour you keep meeting:

```ts
  /**
   * Injector created from the static route providers
   * @internal
   */
  _injector?: EnvironmentInjector;
```

That union type is the same one [chunk 03](03-environmentproviders-vs-provider.md) tabulates. It is why `providers: [provideHttpClient(withInterceptors([authInterceptor]))]` on a route type-checks while the same expression in a component's `providers` does not, and it is why the `NG0207` guide page's own remedy for "EnvironmentProviders in wrong context" is *"For route-specific providers"*, quoted verbatim from
[`adev/src/content/reference/errors/NG0207.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0207.md):

```ts
const routes: Routes = [
  {
    path: 'admin',
    component: AdminView,
    providers: [provideHttpClient(withInterceptors([authInterceptor]))],
  },
];
```

## What angular.dev says it is for

From [Defining dependency providers § Route providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers), verbatim:

> *"Use route-level providers for:"*
>
> *"- **Feature-specific services** - Services only needed for particular routes or feature modules"*
>
> *"- **Lazy-loaded module dependencies** - Services that should only load with specific features"*
>
> *"- **Route-specific configuration** - Settings that vary by application area"*

and its own worked example, reproduced complete:

```ts
// routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    providers: [
      AdminService, // Only loaded with admin routes
      {provide: FEATURE_FLAGS, useValue: {adminMode: true}},
    ],
    loadChildren: () => import('./admin/admin.routes'),
  },
  {
    path: 'shop',
    providers: [
      ShoppingCartService, // Isolated shopping state
      PaymentService,
    ],
    loadChildren: () => import('./shop/shop.routes'),
  },
];
```

Two sentences from the same page carry more weight than the bullet list:

> *"Services provided at the route level are available to all components and directives within that route, as well as to its guards and resolvers."*

> *"Since these services are instantiated independently of the route's components, they do not have direct access to route-specific information."*

The first is the scope rule and it is exact — guards and resolvers are inside, not outside. The second is the constraint people discover at 2am: the service lives in an injector that the *route configuration* owns, not in anything that knows which URL matched, so `inject(ActivatedRoute)` inside it does not give you the route you think it does.

And from [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection), the sentence that places route injectors in the model chunk 01 drew:

> *"You have the option to create `EnvironmentInjector` hierarchies whenever a dynamically loaded component is created, such as with the Router, which will create child `EnvironmentInjector` hierarchies."*

## The nine lines that do all of it

The entire implementation of route-level providers is one function in
[`packages/router/src/utils/config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config.ts), doc comment included:

```ts
/**
 * Creates an `EnvironmentInjector` if the `Route` has providers and one does not already exist
 * and returns the injector. Otherwise, if the `Route` does not have `providers`, returns the
 * `currentInjector`.
 *
 * @param route The route that might have providers
 * @param currentInjector The parent injector of the `Route`
 */
export function getOrCreateRouteInjectorIfNeeded(
  route: Route,
  currentInjector: EnvironmentInjector,
): EnvironmentInjector {
  if (route.providers && !route._injector) {
    route._injector = createEnvironmentInjector(
      route.providers,
      currentInjector,
      `Route: ${route.path}`,
    );
  }
  return route._injector ?? currentInjector;
}
```

Read it slowly, because five separate behaviours are in those nine lines:

1. **`route.providers &&`** — a route with no `providers` creates nothing. It returns `currentInjector` unchanged, so a route without providers is *transparent*: its children see whatever its nearest providing ancestor created. There is no per-route injector by default.
2. **`&& !route._injector`** — the injector is created **at most once**, and the cache key is the identity of the `Route` object in your configuration array. Not once per navigation, not once per activation. Once, for the life of that object.
3. **`createEnvironmentInjector(route.providers, currentInjector, …)`** — the same public factory chunk 03 lists in its acceptance table, with the parent set to the injector the router was walking with. That is the entire hierarchy mechanism: parent chaining, nothing route-specific.
4. **`` `Route: ${route.path}` ``** — the dev-tools debug name. It is a template literal over `route.path`, so a **pathless** route (an empty-path or component-less grouping route) produces the string `Route: undefined`. Worth knowing before you go hunting for a mis-registered route in the injector tree.
5. **`route._injector ?? currentInjector`** — the return is the injector *to keep walking with*. This is what makes "and its `children`" true in the JSDoc: the child recursion is handed the value this function returned.

⚠️ **Note what is *not* here.** Unlike the application injector — whose `debugName` chunk 01 quotes as `ngDevMode`-gated to the literal `Environment Injector` — this `debugName` argument is built and passed unconditionally. Whether the injector stores it in a production build was not read for this page; the string construction itself is not behind a flag.

## Gotchas

**★ Symptom: a pathless grouping route's injector shows up in dev tools as `Route: undefined`.** Cause: the debug name is the template literal `` `Route: ${route.path}` `` and `path` is optional on `Route`. It is cosmetic, but it makes two pathless routes indistinguishable in an injector tree. Fix: give the grouping route an empty path explicitly and identify it by a token instead — a `{provide: FEATURE_NAME, useValue: 'reporting'}` in the same array is greppable in a way the debug name is not.

**★ Symptom: `importProvidersFrom(SomeLegacyModule)` in a route's `providers` — is that allowed?** Cause and answer: yes. `Route.providers` accepts `EnvironmentProviders` ([chunk 03](03-environmentproviders-vs-provider.md)'s table), `importProvidersFrom` returns exactly that, and the `NG0207` guide page names route configurations as a valid environment-injector position. Fix: nothing to fix — but the price chunk 03 states still applies. `importProvidersFrom` pulls the module and everything it transitively imports into the bundle at the point of reference, so putting it on a lazy route at least confines that cost to the lazy chunk rather than the initial one. That is the best available placement, not a free one.

**★ Symptom: `provideRouter(childRoutes)` inside a route's `providers` compiles and does nothing.** Cause: `provideRouter` contributes to the `ROUTES` multi-token, and the `Router` — which is `@Service()`, i.e. root-provided — read `ROUTES` from the injector it was constructed in, once, in a field initialiser. A route injector's `ROUTES` record is never consulted. [07](07-provide-router-and-the-route-array.md) has the full mechanism. Fix: route *tables* go in the single root `provideRouter` call or arrive via `loadChildren`; route *services* go in `providers` —

```ts
export const routes: Routes = [
  {
    path: 'admin',
    providers: [AdminAuditService],                                    // ✅ services here
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes), // ✅ table here
  },
];
```

**★ Symptom: `provideZoneChangeDetection()` or `provideClientHydration()` on a route has no effect.** Cause: both are consumed during bootstrap, before any route injector exists. Change detection is configured by `internalCreateApplication` reading the application injector ([05](05-change-detection-providers.md)); hydration is wired by `bootstrapApplication` against the document that has already been served. A record for either in a route injector is simply never read. Fix: they belong in `app.config.ts`, and the general test for "does this belong on a route" is in **12 · What does *not* belong in the array** *(not written yet)*.

**★ Symptom: you hoisted `const billing = provideBilling(config)` into a shared constant and used it in two route arrays, expecting one instance.** Cause: the value a `provide*()` function returns is a **description** of providers, not an injector and not an instance — chunk 03's branded `EnvironmentProviders` wrapper around a provider array. Handing the same description to two `createEnvironmentInjector` calls creates two independent sets of records and therefore two sets of instances. Fix: sharing instances is a *placement* decision, never a variable-reuse one. Put the call on the one route whose subtree should share it —

```ts
// ⛔ one constant, two injectors, two BillingClient instances
const billing = provideBilling({ currency: 'GBP' });
export const routes: Routes = [
  { path: 'invoices', providers: [billing], loadComponent: () => import('./invoices').then((m) => m.Invoices) },
  { path: 'refunds', providers: [billing], loadComponent: () => import('./refunds').then((m) => m.Refunds) },
];

// ✅ one route, one injector, one BillingClient
export const routes: Routes = [
  {
    path: 'money',
    providers: [provideBilling({ currency: 'GBP' })],
    children: [
      { path: 'invoices', loadComponent: () => import('./invoices').then((m) => m.Invoices) },
      { path: 'refunds', loadComponent: () => import('./refunds').then((m) => m.Refunds) },
    ],
  },
];
```

## Interview questions

**★ `Route.providers` and `ApplicationConfig.providers` have exactly the same declared type. So what actually differs?**
Nothing about the *type*, and everything about the injector. Both are `Array<Provider | EnvironmentProviders>` because both configure an `EnvironmentInjector`, which is why every `provide*()` function is legal in either. What differs is identity and lifetime. `bootstrapApplication` creates one injector, eagerly, parented to the platform injector, and it lives until the application is destroyed. The router creates a route's injector lazily — only when that route matches an attempted navigation — parents it to whatever injector the recognition walk was carrying at that point, caches it on the route configuration object, and by default never destroys it. So the same provider array in the two positions gives you a different number of instances, created at a different time, resolvable from a different part of the tree.

**Why is `Route: ${route.path}` passed as the third argument to `createEnvironmentInjector`, and why should you care?**
It is the `debugName` parameter of the public `createEnvironmentInjector(providers, parent, debugName?)` factory, and it is what identifies the injector in Angular DevTools' injector tree. You care because it is the only label these injectors get: with a dozen feature routes, the injector tree is a column of `Route: something` entries, and a pathless route contributes the string `Route: undefined`. When you are chasing a duplicated service, the count of `Route:` entries carrying the same path *is* the diagnosis.

**★ Why does `Route.providers` accept `EnvironmentProviders` when `Component.providers` does not?**
Because the two positions configure different kinds of injector, and `EnvironmentProviders` is the type Angular uses to say "this may only go into an environment injector". `Route.providers` is declared `Array<Provider | EnvironmentProviders>` and is handed straight to `createEnvironmentInjector`; `Component.providers` is declared `Provider[]` and configures an element injector, which is a different machine with different resolution rules. The `NG0207` guide page states the boundary in prose — environment providers *"can only be used in environment injectors (like the root injector configured in `bootstrapApplication` or route configurations)"* — and the type system enforces it at compile time, so `provideHttpClient()` in a component's `providers` is a `tsc` error rather than a runtime one. Route configurations being named explicitly in that sentence is the whole licence for this page.

**What exactly does `if (route.providers && !route._injector)` guarantee, and what does it not?**
It guarantees at most one injector per `Route` object, ever — the creation is idempotent for the lifetime of that object. It does **not** guarantee one injector per path, per URL, per activation or per feature. Two `Route` objects with identical `path` and identical `providers` are two cache slots and produce two injectors; the same object mounted in two places produces one, shared, with the first mount's parent. And it does not guarantee the injector still exists: with the experimental cleanup feature the field is set back to `undefined` after destruction, so the guard passes again and a fresh injector is built. Reading a single `if` this closely is the whole skill here — it is nine lines, and every question people ask about route providers is answered inside them.

**Where does this page stop, and what carries on?**
Four places. *When* the injector is created and what inherits it — the recognition walk, the lazy-module boundary and the hop into the routed component — is [15b](15b-when-the-injector-is-created.md). *Where* in a route tree the array belongs is [15c](15c-where-providers-belong.md). Which injector each guard kind and each resolver resolves against, and which startup initializers fire in a route injector, is [15d](15d-guards-resolvers-and-route-initializers.md). How long these injectors live, and the experimental feature that ends them, is [15e](15e-the-injector-that-is-never-destroyed.md). The injector *hierarchy* itself — element injectors, `@SkipSelf`, resolution order — belongs to **Phase 6 · Dependency injection** *(not written yet)*, and `loadChildren`, guards, resolvers and `RouteReuseStrategy` as routing concepts belong to **Phase 8 · Routing** *(not written yet)*.

{/* FOOTER */}
