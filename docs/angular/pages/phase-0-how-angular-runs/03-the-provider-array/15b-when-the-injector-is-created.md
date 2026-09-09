---
title: "The route injector is created only after the path matches and before `canMatch` runs, and the recognition walk then threads it into the snapshot, the lazy module and the routed component"
sidebar_label: "15b · When the injector is created"
sidebar_position: 15.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`router/src/utils/config_matching.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config_matching.ts),
> [`router/src/recognize.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/recognize.ts),
> [`router/src/router_state.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_state.ts),
> [`router/src/router_outlet_context.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_outlet_context.ts),
> [`router/src/directives/router_outlet.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/directives/router_outlet.ts),
> [`router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`getOrCreateRouteInjectorIfNeeded` has exactly one caller, and where that call sits decides most of what surprises people about route providers.** It is below the `if (!result.matched) return`, so a route that never matches never builds its injector and never constructs anything in its array. It is above `runCanMatchGuards`, so `canMatch` — the guard whose job is to decide whether the route applies at all — already has the route's providers available to it. And from that point the recognition walk carries the injector forward by hand, through three assignments in `recognize`, onto the `ActivatedRouteSnapshot`, off it again in the outlet context, and finally into `createComponent`. [15](15-route-level-providers.md) is the nine lines that build the injector; this page is the chain that delivers it.

## When it is created — and the comment that says why

`getOrCreateRouteInjectorIfNeeded` has exactly one caller, in
[`packages/router/src/utils/config_matching.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/utils/config_matching.ts):

```ts
  const result = match(segmentGroup, route, segments);
  if (!result.matched) {
    return of(result);
  }

  const currentSnapshot = createPreMatchRouteSnapshot(createSnapshot(result));
  // Only create the Route's `EnvironmentInjector` if it matches the attempted
  // navigation
  injector = getOrCreateRouteInjectorIfNeeded(route, injector);
  return runCanMatchGuards(
    injector,
    route,
    segments,
    urlSerializer,
    currentSnapshot,
    abortSignal,
  ).pipe(map((v) => (v === true ? result : {...noMatch})));
```

The `if (!result.matched) return` is above the call, and the comment states the intent in the source itself. So:

- **A route whose path never matches never builds its injector**, and therefore never constructs anything in its `providers`. Adding a heavyweight service to a route you never visit costs nothing at runtime — though it still costs bundle size, because a static reference in the route array is reachable from the entry point. That is chunk 02's reachability argument and it does not change here.
- **The injector exists before `canMatch` runs.** `runCanMatchGuards` is handed the injector this call just produced. A `canMatch` guard therefore resolves against the route's own providers — which is genuinely surprising, because `canMatch` is the guard that decides whether the route applies at all.
- The injector is created during **URL recognition**, which is before activation, before the component is created, and before any resolver runs.

## The walk — how "and its `children`" is implemented

In [`packages/router/src/recognize.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/recognize.ts), inside `matchSegmentAgainstRoute`, immediately after a successful match:

```ts
    // If the route has an injector created from providers, we should start using that.
    injector = route._injector ?? injector;
    const {routes: childConfig} = await this.getChildConfig(injector, route, segments);
    const childInjector = route._loadedInjector ?? injector;

    const {parameters, consumedSegments, remainingSegments} = result;
    const snapshot = this.createSnapshot(
      injector,
      route,
      consumedSegments,
      parameters,
      parentRoute,
    );
```

Three assignments, three distinct meanings:

| Variable | Value | Who gets it |
|---|---|---|
| `injector` | `route._injector ?? injector` | this route's own snapshot, and `getChildConfig` (so `canLoad` and the lazy-children loader) |
| `childInjector` | `route._loadedInjector ?? injector` | the recursion into child segments — a lazily loaded `NgModule`'s injector wins over the route's own |
| `snapshot` | built with `injector` | the `ActivatedRouteSnapshot`, which stores it |

`getChildConfig` is where the JSDoc's "used as the parent of the lazy loaded module" becomes literal:

```ts
    if (route.loadChildren) {
      // lazy children belong to the loaded module
      if (route._loadedRoutes !== undefined) {
        const ngModuleFactory = route._loadedNgModuleFactory;
        if (ngModuleFactory && !route._loadedInjector) {
          route._loadedInjector = ngModuleFactory.create(injector).injector;
        }
        return {routes: route._loadedRoutes, injector: route._loadedInjector};
      }
```

`ngModuleFactory.create(injector)` — and `injector` at that point is `route._injector ?? injector`. A route that both declares `providers` and lazy-loads an `NgModule` therefore stacks **two** injectors: the route's, and the module's beneath it. A route that lazy-loads a plain `Routes` array (the modern form) stacks one.

## The last hop — how the component sees it

The snapshot carries the injector, and the outlet reads it back off the snapshot. From
[`packages/router/src/router_state.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_state.ts):

```ts
  /** @internal */
  readonly _environmentInjector: EnvironmentInjector;
```

From [`packages/router/src/router_outlet_context.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_outlet_context.ts):

```ts
  get injector(): EnvironmentInjector {
    return this.route?.snapshot._environmentInjector ?? this.rootInjector;
  }
```

and finally, in [`packages/router/src/directives/router_outlet.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/directives/router_outlet.ts):

```ts
    this.activated = location.createComponent(component, {
      index: location.length,
      injector,
      environmentInjector: environmentInjector,
    });
```

So the complete chain, all of it read from source, is:

```text
Route.providers
  → getOrCreateRouteInjectorIfNeeded()  (on first match, cached on Route._injector)
  → recognize: injector = route._injector ?? injector
  → ActivatedRouteSnapshot._environmentInjector
  → OutletContext.injector
  → RouterOutlet.activateWith(route, injector)
  → createComponent(component, {environmentInjector})
```

The routed component's *element* injector still has the component tree above it as its parent; what the route injector replaces is the **environment** end of that chain. The distinction between the two chains is Phase 6's subject — **Phase 6 · Dependency injection** *(not written yet)* — and this page deliberately stops at the boundary.

## Gotchas

**★ Symptom: a service listed in a route's `providers` is never constructed, and no error appears.** Cause: the route never matched. `getOrCreateRouteInjectorIfNeeded` is called only after `match()` succeeds — the source comment says *"Only create the Route's `EnvironmentInjector` if it matches the attempted navigation"*. A typo in `path`, a wildcard route earlier in the array swallowing the URL ([07](07-provide-router-and-the-route-array.md)'s ordering gotcha), or an outlet mismatch all produce silence rather than a failure. Fix: confirm the route matches before debugging the providers — the injector's dev-tools name is `Route: <path>`, and its absence from the injector tree is the diagnosis.

**★ Symptom: a `canMatch` guard returned `false`, the route was skipped — and the services in its `providers` were constructed anyway.** Cause: `matchWithChecks` calls `getOrCreateRouteInjectorIfNeeded` on the line *before* `runCanMatchGuards`, and the guard itself is run through that injector. Anything the guard injects is built, and the injector stays cached on `route._injector` regardless of the guard's answer. Fix: if the point of the `canMatch` was to avoid paying for the feature, note what it does and does not save — the lazy chunk behind `loadChildren` is genuinely not fetched, because `getChildConfig` runs after the match, but the route's own providers are not free. Keep expensive construction behind a service the guard does not touch.

**★ Symptom: providers on a route with `loadChildren` returning an `NgModule` appear "twice" in the injector tree.** Cause: they do not — there are two injectors, and only one carries your providers. `recognize` sets `injector = route._injector ?? injector` and then `getChildConfig` does `route._loadedInjector = ngModuleFactory.create(injector).injector`, so the module's injector is a *child* of the route's. Anything the module provides shadows the route's records for code below it. Fix: nothing, but know which one you are looking at — the route's is named `Route: <path>`, the module's carries the module's own name.

**★ Symptom: a service resolved from the routed component sees the route's providers, but the same service resolved from a directive on the host element does not.** Cause: `activateWith` passes the route injector as `environmentInjector` to `createComponent`, while the element injector chain is built from `location.injector` — the view container's, which lives in the *parent* component's tree. The environment chain and the element chain are two different walks. Fix: this is the boundary where Phase 6 takes over — **Phase 6 · Dependency injection** *(not written yet)*. Practically: put route-scoped services in the route's `providers` and inject them from components inside the route, not from directives applied by templates outside it.

## Interview questions

**★ When exactly is a route's injector created, and what does a route that never matches cost you?**
It is created inside `getOrCreateRouteInjectorIfNeeded`, called from `matchWithChecks` *after* `match()` has succeeded and *before* `runCanMatchGuards` — the source carries the comment *"Only create the Route's `EnvironmentInjector` if it matches the attempted navigation"*. So a route that never matches never creates an injector and never constructs anything in its `providers`: zero runtime cost. It is not zero *bundle* cost, though, because the route array holds a static reference to whatever you named there, and a bundler must keep anything reachable from the entry point. Lazy-loading the route array via `loadChildren` is what moves that reference into a separate chunk; putting `providers` on a route does not, by itself, split anything.

**★ A route both lists `providers` and lazy-loads an `NgModule` via `loadChildren`. How many injectors, and in what order?**
Two, stacked. `getOrCreateRouteInjectorIfNeeded` creates the route's injector with the recognition walk's current injector as parent. `recognize` then reassigns `injector = route._injector ?? injector` **before** calling `getChildConfig`, which does `route._loadedInjector = ngModuleFactory.create(injector).injector` — so the module's injector is a child of the route's. That is the JSDoc sentence *"this injector will be used as the parent of the lazy loaded module"*, made literal. The recursion into children then uses `route._loadedInjector ?? injector`, so the module's injector wins for everything below. With a modern `loadChildren` returning a plain `Routes` array there is no module factory and only the route's injector exists.

**What is the parent of a route's injector, and can you predict it from the route array alone?**
Its parent is whatever injector the recognition walk was carrying when the route matched — which is the nearest ancestor route that has `providers` (or a lazily loaded module's injector, if one is between them), and the application injector if there is none. So yes, you can read it off the route array: walk up the `children` nesting to the first ancestor with a `providers` array. The one case where the array lies to you is a `Routes` array object mounted at two places in the tree, because `_injector` is cached on the object and the first mount's parent wins for both.

**★ Trace the route injector from the `providers` array to the routed component's `inject()` call.**
`Route.providers` is read by `getOrCreateRouteInjectorIfNeeded`, called from `matchWithChecks` once the path has matched; it creates the injector and caches it on `route._injector`. `recognize.matchSegmentAgainstRoute` then does `injector = route._injector ?? injector` and passes that into `createSnapshot`, which stores it on the `ActivatedRouteSnapshot` as the internal `_environmentInjector`. `OutletContext.injector` is a getter returning `this.route?.snapshot._environmentInjector ?? this.rootInjector`. `activateWith(future, context.injector)` hands it to `RouterOutlet`, which passes it to `location.createComponent(component, {index, injector, environmentInjector})`. Six hops, all of them plain field reads and function arguments — there is no registry, no lookup by path, and no framework magic anywhere in the chain, which is exactly why reading it once makes the behaviour predictable.

**Why does `recognize` keep two injector variables, `injector` and `childInjector`?**
Because a route's own snapshot and its children can legitimately want different injectors. `injector` is `route._injector ?? injector` — the route's own providers if it has any — and is used for this route's snapshot and for `getChildConfig`, so `canLoad` and the lazy loader run in it. `childInjector` is `route._loadedInjector ?? injector`, and is what the recursion into child segments receives, so that a lazily loaded `NgModule`'s injector takes over for everything below. If the two were collapsed into one variable, either the route's own guards would run in the module's injector or the module's providers would be invisible to its own routes. Two names, two scopes, one line apart.

← Prev: [Route-level `providers`](15-route-level-providers.md) · Index: [Topic index](README.md) · Next → [Where `providers` belong](15c-where-providers-belong.md)
