---
title: "A route's `EnvironmentInjector` is cached on the route configuration object and, by default, is never destroyed — which is why `takeUntilDestroyed()` in a resolver does nothing and why memory only ever goes up"
sidebar_label: "15e · The injector that is never destroyed"
sidebar_position: 15.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`router/docs/injector_cleanup.md`](https://github.com/angular/angular/blob/v22.1.5/packages/router/docs/injector_cleanup.md),
> [`router/src/route_injector_cleanup.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/route_injector_cleanup.ts),
> [`router/src/route_reuse_strategy.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/route_reuse_strategy.ts),
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> and the `router` public-API golden. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every other injector in an Angular application has an obvious end: the application injector dies with the tab, a component's element injector dies with the component.** A route's injector has neither. It is created on first match, cached on the route configuration object under `_injector`, and — with the default `RouteReuseStrategy` and no opt-in feature — nothing ever calls `destroy()` on it. That is not an oversight nobody noticed; it is a documented default with an Angular design document explaining why it was hard to change and what the opt-in costs. This page is that mechanism: what "never destroyed" actually implies for memory and for `DestroyRef`, what `withExperimentalAutoCleanupInjectors()` does at `NavigationEnd`, and the three ways enabling it can surprise a codebase that already has a custom `RouteReuseStrategy`. [15](15-route-level-providers.md) is the injector; this is its lifetime.

## Lifetime — the injector that, by default, is never destroyed

This is the part of route providers that has no equivalent in the application injector, and it is the source of the longest-running complaint about them. Angular's own design document,
[`packages/router/docs/injector_cleanup.md`](https://github.com/angular/angular/blob/v22.1.5/packages/router/docs/injector_cleanup.md) (authored by the router lead, dated November 21 2025, status *"In Review"* at this tag), states the problem verbatim:

> *"**Undisposed Route Injectors**: When `providers` are defined on a `Route`, Angular creates a dedicated `EnvironmentInjector` for that route. This also happens when lazy loading routes through an `NgModule` and `RouterModule.forChild`. Prior to this proposed change, these injectors were never destroyed, even after the user navigated away from the route permanently. This meant that these injectors and their provided services would remain in memory for the application's lifetime, even when the routes were no longer active."*

and the second-order consequence, which is the one that actually bites:

> *"Additionally, because these injectors were never destroyed, developers could not reliably use APIs that depend on injector destruction, such as `takeUntilDestroyed`, `toSignal`, or `toObservable`, within guards and resolvers"*

That is why a `takeUntilDestroyed()` in a resolver has historically been a no-op: the `DestroyRef` it captures belongs to a route injector that nothing ever destroys.

### The opt-in, and its exact name

The shipped feature at v22.1.5 is `withExperimentalAutoCleanupInjectors()`, from
[`packages/router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts):

```ts
export function withExperimentalAutoCleanupInjectors(): ExperimentalAutoCleanupInjectorsFeature {
  return routerFeature(RouterFeatureKind.ExperimentalAutoCleanupInjectorsFeature, [
    {provide: ROUTE_INJECTOR_CLEANUP, useValue: routeInjectorCleanup},
  ]);
}
```

Its JSDoc, verbatim:

> *"When enabled, the router will automatically destroy `EnvironmentInjector`s associated with `Route`s that are no longer active or stored by the `RouteReuseStrategy`."*
>
> *"This feature is opt-in and requires `RouteReuseStrategy.shouldDestroyInjector` to return `true` for the routes that should be destroyed. If the `RouteReuseStrategy` uses stored handles, it should also implement `retrieveStoredRouteHandles` to ensure injectors for handles that will be reattached are not destroyed."*
>
> `@experimental 21.1`

🔴 **`@experimental`, not `@publicApi`.** No deprecation period is owed and the signature may change in a minor — the same standing as the other two experimental router features, which [08g](08g-tracing-and-the-experimental-end.md) covers. Do not ship it in an application you cannot re-check on every upgrade.

⚠️ **The design document names the function `withAutoCleanupInjectors()`; the code at `v22.1.5` exports `withExperimentalAutoCleanupInjectors()`.** The design doc's status line says *"In Review"*, so it describes the intended API rather than the shipped one. Use the name in the golden.

### What cleanup actually does, from the design doc

> *"When enabled, a cleanup process runs after every successful navigation completes (i.e., after the `NavigationEnd` event)."*

Restricted to `NavigationEnd` on purpose. The document rules out the two obvious alternatives and says why:

> *"**`NavigationCancel`**: When a navigation is canceled, the router attempts to roll back its state to the previously successful one. Running a cleanup process during this transitional phase is risky, as it could accidentally destroy injectors from the very state the router is trying to restore."*

> *"**`NavigationError`**: An error can occur at any point during the activation process. This means that if an error is thrown midway through, the router's internal state can be left partially modified."*

The traversal is parent-first, and the consequence is stated as a rule:

> *"**Crucially, if a parent route's injector is destroyed, the injectors of all its descendant routes will also be destroyed, regardless of the value returned by `shouldDestroyInjector?` for those descendants. This ensures the integrity of the injector hierarchy.**"*

> *"**Note**: The default `BaseRouteReuseStrategy` (and thus the default router behavior) implements `shouldDestroyInjector` to always return `true`. This means that by default, when the feature is enabled, all inactive injectors will be destroyed unless a custom strategy overrides this behavior."*

Two more facts from the same document worth having before you enable it. `_loadedRoutes` are deliberately **left in place** when a lazy route's injector is destroyed —

> *"we can destroy the injector but leave the `_loadedRoutes` array on the parent `Route`. This means the configuration object remains structurally intact, even though the injector that provided those routes is gone and when the injector is recreated, its provided routes will be effectively ignored."*

— and the preloader defends itself against the race:

> *"The `preloadConfig` method in `RouterPreloader` explicitly checks `if (injector.destroyed)` and returns `of(null)` if true."*

The `RouteReuseStrategy` surface this all hangs off is Phase 8's subject — **Phase 8 · Routing** *(not written yet)* — and so is the companion API the same document introduces, `destroyDetachedRouteHandle(handle)`.

## The cleanup pass, in source

The design document describes the algorithm; the implementation is short enough to read, from
[`packages/router/src/route_injector_cleanup.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/route_injector_cleanup.ts):

```ts
export function routeInjectorCleanup(
  routeReuseStrategy: RouteReuseStrategy,
  routerState: RouterState,
  config: Routes,
) {
  const activeRoutes = new Set<Route>();
  // Collect all active routes from the current state tree
  if (routerState.snapshot.root) {
    collectDescendants(routerState.snapshot.root, activeRoutes);
  }

  // For stored routes, collect them and all their parents by iterating pathFromRoot.
  const storedHandles =
    (routeReuseStrategy as ExperimentalRouteReuseStrategy).retrieveStoredRouteHandles?.() || [];
  for (const handle of storedHandles) {
    const internalHandle = handle as DetachedRouteHandleInternal;
    if (internalHandle?.route?.value?.snapshot) {
      for (const snapshot of internalHandle.route.value.snapshot.pathFromRoot) {
        if (snapshot.routeConfig) {
          activeRoutes.add(snapshot.routeConfig);
        }
      }
    }
  }

  destroyUnusedInjectors(config, activeRoutes, routeReuseStrategy, false);
}
```

`activeRoutes` is a `Set` of **`Route` configuration objects**, not URLs and not snapshots — the same
object identity that `_injector` is cached against in [15](15-route-level-providers.md). And the
destroyer:

```ts
function destroyUnusedInjectors(
  routes: Routes,
  activeRoutes: Set<Route>,
  strategy: RouteReuseStrategy,
  inheritedForceDestroy: boolean,
) {
  for (const route of routes) {
    const shouldDestroyCurrentRoute =
      inheritedForceDestroy ||
      !!(
        (route._injector || route._loadedInjector) &&
        !activeRoutes.has(route) &&
        ((strategy as ExperimentalRouteReuseStrategy).shouldDestroyInjector?.(route) ?? false)
      );

    if (route.children) {
      destroyUnusedInjectors(route.children, activeRoutes, strategy, shouldDestroyCurrentRoute);
    }
    if (route.loadChildren && route._loadedRoutes) {
      destroyUnusedInjectors(
        route._loadedRoutes,
        activeRoutes,
        strategy,
        shouldDestroyCurrentRoute,
      );
    }

    if (shouldDestroyCurrentRoute) {
      if (route._injector) {
        route._injector.destroy();
        route._injector = undefined;
      }
      if (route._loadedInjector) {
        route._loadedInjector.destroy();
        route._loadedInjector = undefined;
      }
    }
  }
}
```

Four things that only the code tells you:

1. **`route._injector = undefined`** — the cache is *cleared*, not merely destroyed. So a later
   navigation back into the route hits `if (route.providers && !route._injector)` in
   `getOrCreateRouteInjectorIfNeeded` and builds a **fresh** injector with fresh instances. With
   cleanup enabled, route-scoped state does not survive a round trip; without it, it always does.
   Those are opposite behaviours from the same route array, selected by one feature flag.
2. **`shouldDestroyInjector?.(route) ?? false`** — the optional-call plus `?? false` means a strategy
   that does not implement the method destroys **nothing**. `BaseRouteReuseStrategy` does implement
   it, returning `true`, and `DefaultRouteReuseStrategy extends BaseRouteReuseStrategy` — so the
   default gets cleanup. A custom strategy written against the abstract `RouteReuseStrategy` does
   not, and enabling the feature is then a silent no-op.
3. **`inheritedForceDestroy`** is passed *down* before the current route's own destruction runs —
   pre-order, parent decides. That is the design document's *"if a parent route's injector is
   destroyed, the injectors of all its descendant routes will also be destroyed"* rule, implemented
   as a boolean threaded through the recursion.
4. **The recursion follows `route._loadedRoutes`**, so a lazily loaded subtree's injectors are
   reachable and destroyable even though they are not in the static `config` array you wrote.

The hooks themselves are declared as a separate interface rather than on `RouteReuseStrategy`, from
[`packages/router/src/route_reuse_strategy.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/route_reuse_strategy.ts):

```ts
export interface ExperimentalRouteReuseStrategy {
  shouldDestroyInjector?(route: Route): boolean;
  retrieveStoredRouteHandles?(): Array<DetachedRouteHandleInternal>;
}
```

and the default's implementation, on `BaseRouteReuseStrategy`:

```ts
  shouldDestroyInjector(route: Route): boolean {
    return true;
  }
```

Keeping them off the public abstract class is what makes the whole feature non-breaking: an existing
custom strategy still satisfies `RouteReuseStrategy`, and the router narrows to the experimental
interface with a cast at each call site.

## Gotchas

**★ Symptom: `takeUntilDestroyed()` or `toSignal()` in a resolver never fires its teardown.** Cause: it captures the route injector's `DestroyRef`, and by default that injector is never destroyed — Angular's own design doc names this exact case. Fix: enable the experimental cleanup feature if you can accept its stability level, or do not tie teardown to the route injector at all —

```ts
// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withExperimentalAutoCleanupInjectors()), // @experimental 21.1
  ],
};
```

**★ Symptom: memory grows as the user tours the application and never comes back down.** Cause: every route with `providers` that has been visited once holds an injector and every service it constructed, for the lifetime of the tab. This is the documented default, not a leak in your code. Fix: the same opt-in as above — and, structurally, do not put caches or subscription-holding services in route providers unless you have enabled cleanup. A `providedIn: 'root'` service that you clear explicitly is more predictable than a route-scoped one you cannot destroy.

**★ Symptom: you enabled `withExperimentalAutoCleanupInjectors()` and a custom `RouteReuseStrategy` started throwing after navigations.** Cause: the strategy stores `DetachedRouteHandle`s whose routes the cleanup pass considers inactive, so their injectors were destroyed under it. The design document requires the strategy to implement `retrieveStoredRouteHandles()` so the router can mark those routes active. Fix: implement it, and implement `shouldDestroyInjector(route)` if you need finer control — remembering the parent-first rule, that destroying a parent destroys descendants regardless of what their own `shouldDestroyInjector` returned.

**★ Symptom: you enabled `withExperimentalAutoCleanupInjectors()` and nothing is ever destroyed.** Cause: your application provides a custom `RouteReuseStrategy` that extends the abstract `RouteReuseStrategy` directly rather than `BaseRouteReuseStrategy`, so it has no `shouldDestroyInjector` method — and the call site is `strategy.shouldDestroyInjector?.(route) ?? false`, which evaluates to `false` for every route. No error, no warning, no cleanup. Fix: extend the base class, or implement the hook —

```ts
export class TabCacheReuseStrategy extends BaseRouteReuseStrategy {
  private readonly cache = new Map<Route, DetachedRouteHandle>();

  override shouldDestroyInjector(route: Route): boolean {
    return !this.cache.has(route);
  }

  override retrieveStoredRouteHandles(): DetachedRouteHandle[] {
    return [...this.cache.values()];
  }
}
```

**★ Symptom: after enabling cleanup, a feature's route-scoped state resets when the user navigates away and back — and it did not before.** Cause: `destroyUnusedInjectors` does `route._injector = undefined` after destroying, so the next match rebuilds the injector from scratch and every service in it is constructed again. This is the *intended* semantics of the feature, and it is a behaviour change for any code that was (knowingly or not) relying on route providers as a session-lifetime cache. Fix: decide which you want and be explicit. Session-lifetime state belongs in a `providedIn: 'root'` service you clear deliberately; visit-lifetime state belongs in the route injector with cleanup on.

**★ Symptom: a lazily loaded feature's routes still appear in the configuration after its injector was destroyed.** Cause: deliberate. The design document chose to leave `_loadedRoutes` in place rather than mutate the static route configuration — *"the configuration object remains structurally intact, even though the injector that provided those routes is gone and when the injector is recreated, its provided routes will be effectively ignored."* Fix: nothing to fix; know that `_loadedRoutes` present does not imply `_loadedInjector` alive, and do not write tooling that assumes it does.

**★ Symptom: a preload that was in flight when a navigation triggered cleanup neither completes nor errors.** Cause: also deliberate. The document states *"The `preloadConfig` method in `RouterPreloader` explicitly checks `if (injector.destroyed)` and returns `of(null)` if true."* The preloading task terminates gracefully rather than throwing into a destroyed injector, and the next navigation re-establishes a fresh injector and re-issues the callback. Fix: none — but if you are measuring preload success rates, count the no-op case, because it is silent by design.

## Interview questions

**★ Why does navigating away from a feature and back give you the same service instance?**
Because the guard on creation is `if (route.providers && !route._injector)`, and `_injector` is a field on the route configuration object, which outlives every navigation. The second visit finds the cache populated and reuses it — the same injector, therefore the same singletons, therefore all the state they accumulated on the first visit. This is the default and it is not a leak in the "reference we forgot" sense; it is a documented design that the router only recently gained an opt-in way to change. If you want per-visit state, do not hang it on a route-provided service — that is what the routed component's own lifetime is for.

**★ You need `takeUntilDestroyed()` inside a resolver. Why has it historically done nothing, and what changed?**
Because the `DestroyRef` available in a resolver belongs to the route's `EnvironmentInjector`, and route injectors were never destroyed — Angular's own design document names `takeUntilDestroyed`, `toSignal` and `toObservable` as the APIs this broke, citing issue #51290. What changed is `withExperimentalAutoCleanupInjectors()`, which runs a cleanup pass after every `NavigationEnd`, destroying the injectors of routes that are neither in the current activated tree nor held by the `RouteReuseStrategy`. It is `@experimental 21.1`, so it is a thing to try and re-check on upgrade, not a thing to depend on.

**★ Why does the cleanup pass run only on `NavigationEnd`, and not on cancel or error?**
Because those two leave the router in a state where "active" is not answerable. On `NavigationCancel` the router is rolling back to the previous successful state, so destroying inactive injectors could destroy the ones being restored. On `NavigationError` activation may have been interrupted midway, leaving the internal state partially modified — the design document's words are that determining active versus inactive there is *"unreliable and could lead to the erroneous destruction of injectors that are still in use."* Restricting to `NavigationEnd` guarantees the traversal sees a stable, fully resolved router state. It is a good general lesson about lifecycle cleanup: run it from the one event that guarantees consistency, not from every event that suggests something ended.

**★ Why is automatic route-injector cleanup opt-in rather than simply fixed?**
Because destroying an injector is observable, and the router cannot know whether an application is depending on the old behaviour. A custom `RouteReuseStrategy` may be holding `DetachedRouteHandle`s whose components would break if the injector beneath them vanished; a feature may be using a route-scoped service as a session cache. So the design keeps the two new hooks — `shouldDestroyInjector` and `retrieveStoredRouteHandles` — on a separate `ExperimentalRouteReuseStrategy` interface rather than on the public abstract class, so no existing implementation stops compiling, and gates the whole traversal behind `withExperimentalAutoCleanupInjectors()`. The design document states the goal directly: make the mechanism opt-in *"to prevent breaking changes for applications with existing custom `RouteReuseStrategy` implementations."* It is a good template for shipping a behaviour change into a widely used framework: new hooks on a side interface, defaults that preserve today, one flag.

**★ The cleanup traversal is parent-first. What does that cost the developer, and what was the alternative?**
Parent-first means `shouldDestroyInjector` returning `false` for a deeply nested route does not save it — if any ancestor was destroyed, `inheritedForceDestroy` is already `true` on the way down and the descendant goes with it. To preserve a nested route you must return `false` for it *and* for every ancestor. The alternative the design document considered was child-first (post-order), where preserving a child would implicitly preserve its ancestors: better ergonomics, but it requires the recursion to return a `wasAnythingPreserved` flag back up the stack, and it makes `shouldDestroyInjector`'s answer for one route implicitly change the outcome for others. The document chose parent-first for *"implementation simplicity, single-pass performance, and explicitness"* and accepted the verbosity. The general trade being made — explicit and verbose over implicit and convenient, in a hook a framework must call correctly for everyone — is worth being able to argue either side of.

**What happens to a route's `providers` when its injector is destroyed and the user navigates back?**
Everything is rebuilt. `destroyUnusedInjectors` sets `route._injector = undefined` after calling `destroy()`, so the guard in `getOrCreateRouteInjectorIfNeeded` — `if (route.providers && !route._injector)` — passes again on the next match and a brand-new `EnvironmentInjector` is created from the same `providers` array, with the parent taken from wherever the recognition walk is at that moment. The provider array itself is untouched; it is static configuration. This is the one case where the "created once, cached forever" rule from [15](15-route-level-providers.md) is suspended, and the feature flag is the only thing that suspends it.

← Prev: [Guards, resolvers and route initializers](15d-guards-resolvers-and-route-initializers.md) · Index: [Topic index](README.md) · Next → **16 · The injector error surface** *(not written yet)*
