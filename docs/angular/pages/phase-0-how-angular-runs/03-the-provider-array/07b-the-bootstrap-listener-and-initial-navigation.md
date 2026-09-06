---
title: "The third provider `provideRouter()` registers is what actually starts routing — a bootstrap listener that returns early for every component but the first, which is why two `provideRouter` calls produce two listeners and one working router"
sidebar_label: "07b · The bootstrap listener"
sidebar_position: 7.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideRouter`](https://angular.dev/api/router/provideRouter),
> [`InitialNavigation`](https://angular.dev/api/router/InitialNavigation); and `angular/angular` at
> tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) (v22.0.0 breaking changes).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`{provide: APP_BOOTSTRAP_LISTENER, multi: true, useFactory: getBootstrapListener}` is the entry in
`provideRouter`'s return value that turns a route table into a running router.** Everything that has
to happen *after* the root component exists lives in that one listener: starting the initial
navigation, initialising the preloader, initialising the scroller, and telling the router which
component type is the root. It is also where two of this topic's better gotchas come from — the
listener guards on `bootstrappedComponentRef !== ref.components[0]` and returns early for anything
that is not the first bootstrapped component, and it reaches for the preloader and the scroller with
`{optional: true}` lookups, which is chunk 02's tree-shaking argument visible inside the router's own
source. This chunk is that listener, the three initial-navigation modes it dispatches on, and the
three router defaults v22 changed underneath you.

## `getBootstrapListener`, verbatim

```ts
export function getBootstrapListener() {
  const injector = inject(Injector);
  return (bootstrappedComponentRef: ComponentRef<unknown>) => {
    const ref = injector.get(ApplicationRef);

    if (bootstrappedComponentRef !== ref.components[0]) {
      return;
    }

    const router = injector.get(Router);
    const bootstrapDone = injector.get(BOOTSTRAP_DONE);

    if (injector.get(INITIAL_NAVIGATION) === InitialNavigation.EnabledNonBlocking) {
      router.initialNavigation();
    }

    injector.get(ROUTER_PRELOADER, null, {optional: true})?.setUpPreloading();
    injector.get(ROUTER_SCROLLER, null, {optional: true})?.init();
    router.resetRootComponentType(ref.componentTypes[0]);
    if (!bootstrapDone.closed) {
      bootstrapDone.next();
      bootstrapDone.complete();
      bootstrapDone.unsubscribe();
    }
  };
}
```

**Three readings.**

1. **The first-component guard is not defensive coding, it is the contract.** `APP_BOOTSTRAP_LISTENER`
   fires once per bootstrapped component, and a page can bootstrap several. The router is a
   single-instance, single-history service, so it attaches itself to the *first* root component and
   ignores the rest. Two `provideRouter` calls register **two** listener entries — both `multi` — and
   both run for the first component, each calling `router.initialNavigation()` and re-initialising
   preloading and scrolling on the same `Router`.
2. **`{optional: true}` on `ROUTER_PRELOADER` and `ROUTER_SCROLLER` is why `withPreloading()` and
   `withInMemoryScrolling()` can exist at all.** The base function never references either
   implementation, so a bundler drops both unless the corresponding `with*` was called — and the
   listener asks for them optionally rather than requiring them. That is chunk
   [02](02-why-provide-functions-replaced-forroot.md)'s argument, made by the framework's own code
   rather than by prose.
3. **`resetRootComponentType` is how the router learns what to attach to**, and it happens after the
   component exists — which is the whole reason this work is a bootstrap listener rather than an
   environment or app initializer ([06](06-startup-and-error-listener-providers.md)).

## The three initial-navigation modes

The listener only calls `router.initialNavigation()` for one of the three modes, and that one is the
default:

```ts
const INITIAL_NAVIGATION = new InjectionToken<InitialNavigation>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'initial navigation' : '',
  {factory: () => InitialNavigation.EnabledNonBlocking},
);
```

The public type's own documentation defines all three, verbatim:

> *"* 'enabledNonBlocking' - (default) The initial navigation starts after the root component has been
> created. The bootstrap is not blocked on the completion of the initial navigation."*

> *"* 'enabledBlocking' - The initial navigation starts before the root component is created. The
> bootstrap is blocked until the initial navigation is complete. This value should be set in case you
> use [server-side rendering](https://angular.dev/guide/ssr), but do not enable
> [hydration](https://angular.dev/guide/hydration) for your application."*

> *"* 'disabled' - The initial navigation is not performed. The location listener is set up before the
> root component gets created. Use if there is a reason to have more control over when the router
> starts its initial navigation due to some complex initialization logic."*

🔴 **Read the branch in the listener alongside that.** In `enabledBlocking` mode the navigation was
already started by an app initializer, so the listener must *not* start it again — which is exactly
what `if (… === InitialNavigation.EnabledNonBlocking)` encodes. In `disabled` mode nothing starts it
and you are expected to call `router.initialNavigation()` yourself. The two feature functions that set
this token are [08f](08f-initial-navigation.md).

## ⚠️ `provideRoutes()` was removed in v22.0.0

From the v22.0.0 breaking changes, router section, verbatim:

> *"`provideRoutes()` has been removed. Use `provideRouter()` or `ROUTES` as multi token if
> necessary."*

`provideRoutes()` existed to contribute a route array without configuring a router — the standalone
equivalent of `RouterModule.forChild`. Its replacement is either a second `provideRouter` call, with
the appending semantics from [07](07-provide-router-and-the-route-array.md), or the raw token:

```ts
// the documented replacement when you genuinely need to contribute routes and nothing else
providers: [
  { provide: ROUTES, multi: true, useValue: reportingRoutes },
],
```

Prefer `loadChildren` returning a `Routes` value for a lazily-loaded feature; reach for the raw token
only when something outside the routing tree — a plugin registry, a host shell — has to inject routes
into an application it does not own.

## Two more v22 defaults that changed underneath you

Both are in the same v22.0.0 breaking-changes block, and both are silent behaviour changes rather than
compile errors.

> *"paramsInheritanceStrategy now defaults to 'always'*
> *The default value of paramsInheritanceStrategy has been changed from 'emptyOnly' to 'always'. This
> means that route parameters are inherited from all parent routes by default. To restore the previous
> behavior, set paramsInheritanceStrategy to 'emptyOnly' in your router configuration."*

> *"The `currentSnapshot` parameter in `CanMatchFn` and the `canMatch` method of the `CanMatch`
> interface is now required."*

The first changes what `route.snapshot.params` contains on a child route — more keys than before,
which can silently shadow a same-named parameter. The restore is one feature call:

```ts
provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })),
```

The second is a compile error rather than a runtime surprise, and the fix is to accept the parameter
you were already being handed:

```ts
// v21 and earlier
const canMatchAdmin: CanMatchFn = (route, segments) => inject(AuthStore).isAdmin();

// v22: currentSnapshot is required
const canMatchAdmin: CanMatchFn = (route, segments, currentSnapshot) =>
  inject(AuthStore).isAdmin();
```

## Gotchas

**★ Symptom: the initial navigation appears to run twice, or the preloader initialises twice.** Cause:
two `provideRouter` calls registered two `APP_BOOTSTRAP_LISTENER` entries; both are `multi`, both run
for the first bootstrapped component, and each one calls `router.initialNavigation()` and
`setUpPreloading()` on the same `Router`. Fix: exactly one `provideRouter` call per application —

```ts
providers: [provideRouter([...adminRoutes, ...shopRoutes], withPreloading(PreloadAllModules))],
```

**★ Symptom: `withPreloading(PreloadAllModules)` is in the config and nothing is preloaded.** Cause:
preloading is switched on from `getBootstrapListener`, which returns early for anything that is not
`ref.components[0]`. If the application bootstraps a second root component, or if the router's
listener runs against a component that is not the first, `setUpPreloading()` is never reached. Fix:
bootstrap one root component per application, and if a page genuinely needs several, give each its own
`bootstrapApplication` call so each gets its own `ApplicationRef` and its own first component —

```ts
bootstrapApplication(ShellRoot, appConfig).catch((err) => console.error(err));
bootstrapApplication(WidgetRoot, widgetConfig).catch((err) => console.error(err));
```

**★ Symptom: after upgrading to v22, a child route sees parameters it never used to see — or a child's
own parameter is being overwritten.** Cause: `paramsInheritanceStrategy` now defaults to `'always'`,
so parameters are inherited from **all** parent routes rather than only from parents with an empty
path or no component. Fix: either rename the colliding parameter, or restore the old default
explicitly —

```ts
provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })),
```

**Symptom: `provideRoutes is not exported from '@angular/router'` after upgrading to v22.** Cause: it
was removed in v22.0.0. Fix: the changelog's own replacement — `provideRouter()`, or the raw multi
token when you only mean to contribute routes —

```ts
providers: [{ provide: ROUTES, multi: true, useValue: reportingRoutes }],
```

**Symptom: every `CanMatchFn` in the codebase stops compiling on v22.** Cause: `currentSnapshot` is
now a required parameter of `CanMatchFn` and of `CanMatch.canMatch`. Fix: declare it, even where you
do not use it — the compiler is telling you the signature widened, not that your logic is wrong —

```ts
const canMatchAdmin: CanMatchFn = (route, segments, currentSnapshot) =>
  inject(AuthStore).isAdmin();
```

**Symptom: with `withDisabledInitialNavigation()` the URL is read but nothing ever navigates.** Cause:
that is what the mode means — the location listener is installed and the listener's
`EnabledNonBlocking` branch is skipped, so nothing calls `router.initialNavigation()`. Fix: call it
yourself once your initialisation logic is ready —

```ts
provideAppInitializer(async () => {
  const router = inject(Router);
  const session = inject(SessionService);
  await session.restore();
  router.initialNavigation();
}),
```

**Symptom: `BOOTSTRAP_DONE` never completes and something waiting on it hangs.** Cause: the listener
completes it only after passing the first-component guard, so a second bootstrapped root's listener
run does nothing — and if the router's listener never runs at all (no `provideRouter`), it is never
completed. Fix: check that `provideRouter` is actually in the configuration that bootstrapped; this
symptom is downstream of the "no `provideRouter` at all" case in
[07](07-provide-router-and-the-route-array.md), not a separate bug.

## Interview questions

**★ Why does the router do its startup work in an `APP_BOOTSTRAP_LISTENER` instead of an app
initializer?**
Because all of it needs the root component to exist. The listener calls
`router.resetRootComponentType(ref.componentTypes[0])`, and the default initial navigation is
specified to start *after* the root component is created — an app initializer runs at step 4 of
bootstrap and the root component is created at step 6, so an initializer literally cannot see it. The
one case that genuinely must precede the root component, `enabledBlocking`, is implemented the other
way around: `withEnabledBlockingInitialNavigation()` contributes a `provideAppInitializer` and sets
`INITIAL_NAVIGATION` so that the bootstrap listener knows not to start navigation a second time. Two
hooks, one for each side of the root component's creation.

**★ What is the `bootstrappedComponentRef !== ref.components[0]` guard protecting against, and what
breaks when you defeat it?**
It restricts the router's startup work to the first root component of an `ApplicationRef`, because the
`Router` is a single instance owning a single browser history. Without it, an application that
bootstraps several root components would start the initial navigation once per component. You defeat
it accidentally by calling `provideRouter` twice — that registers two listeners, both of which pass
the guard for the same first component, and you get the double initial navigation and double
preloader initialisation the guard was never designed to prevent. The guard protects against multiple
*components*, not against multiple *listeners*.

**★ The bootstrap listener asks for the preloader and the scroller with `{optional: true}`. What would
break if it required them?**
Tree-shaking. Requiring `ROUTER_PRELOADER` would mean the base `provideRouter` path has a hard
reference to `RouterPreloader`, so every application would ship the preloading machinery whether or
not it called `withPreloading()` — and the same for `RouterScroller`. The optional lookup is what
allows the feature functions to be the only import path to their implementations. It is the clearest
in-framework illustration of chunk 02's claim that `provide*` plus `with*` beats an options bag: the
options-bag version (`ExtraOptions.preloadingStrategy`) has to be read at runtime, and reading it
requires the code to be present.

**Which v22 router changes are silent, and how would you find them in an upgrade?**
Two of the three are silent: `paramsInheritanceStrategy` flipping from `'emptyOnly'` to `'always'`
changes what `params` contains on child routes with no error anywhere, and the removal of
`provideRoutes()` is only loud if you used it. The `CanMatchFn` signature change is loud — it is a
compile error. The way to find the silent one is not to read release notes hoping to recognise it, but
to run `ng update`, which applies the framework's own migrations, and then to diff behaviour on the
routes that actually have parameters on both a parent and a child. Where the new default is wrong for
you, `withRouterConfig({paramsInheritanceStrategy: 'emptyOnly'})` restores the old one exactly.

**A colleague wants to let plugins register their own routes at runtime. What are the options and what
do they cost?**
Three, in decreasing order of preference. Contribute through `loadChildren` if the plugin set is known
at build time — it is the only option that preserves lazy loading and keeps the routes typed. Add a
second contribution via `{provide: ROUTES, multi: true, useValue: pluginRoutes}` if the plugin is
known at bootstrap but lives outside the application's own tree; that is exactly the escape hatch the
`ROUTES` JSDoc describes as *"a low level API"*, and it is the documented replacement for the removed
`provideRoutes()`. Only if routes genuinely arrive after bootstrap does `Router.resetConfig()` come
into play — and it replaces the whole table rather than adding to it, so the application has to own
the composition. All three are ordinary array manipulation, which is the practical benefit of routes
being a value rather than a module.

---

← Prev: [`provideRouter()` and the route array](07-provide-router-and-the-route-array.md) · Index: [Topic index](README.md) · Next → [Router features, one by one](08-router-features-one-by-one.md)
