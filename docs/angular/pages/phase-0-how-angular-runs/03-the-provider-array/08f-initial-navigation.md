---
title: "The two initial-navigation features are the only router features that reach back into bootstrap — one hands you the trigger and the other contributes an app initializer that holds the first paint open until the first navigation commits"
sidebar_label: "08f · Initial navigation"
sidebar_position: 8.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`withEnabledBlockingInitialNavigation`](https://angular.dev/api/router/withEnabledBlockingInitialNavigation),
> [`withDisabledInitialNavigation`](https://angular.dev/api/router/withDisabledInitialNavigation); and
> `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts),
> [`platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two features here, and they are the only router features that reach back into the bootstrap
sequence rather than configuring the router in place.** `withDisabledInitialNavigation()` stops the
bootstrap listener from starting navigation at all, installs the location-change listener anyway, and
hands you `router.initialNavigation()` to call when your own startup logic is done — forget that call
and the application renders nothing while back and forward still work.
`withEnabledBlockingInitialNavigation()` goes the other way: it contributes a
`provideAppInitializer(...)` that holds bootstrap open until the first navigation reaches
`afterPreactivation`, which puts every guard and resolver on the initial route onto the critical path
of first paint. That one is documented as contradicting hydration, and the framework warns about the
combination at runtime.

## `withDisabledInitialNavigation` — the location listener without the navigation

```ts
export function withDisabledInitialNavigation(): DisabledInitialNavigationFeature {
  const providers = [
    provideAppInitializer(() => {
      inject(Router).setUpLocationChangeListener();
    }),
    {provide: INITIAL_NAVIGATION, useValue: InitialNavigation.Disabled},
  ];
  return routerFeature(RouterFeatureKind.DisabledInitialNavigationFeature, providers);
}
```

> *"Disables initial navigation."*
> *"Use if there is a reason to have more control over when the router starts its initial navigation
> due to some complex initialization logic."*

Two providers. The app initializer installs the location-change listener — so the router *does* react
to back and forward from the moment bootstrap finishes — and the `INITIAL_NAVIGATION` value makes the
bootstrap listener skip its `router.initialNavigation()` call
([07b](07b-the-bootstrap-listener-and-initial-navigation.md)). **Nothing else will ever start the first
navigation; that is now your job.**

```ts
providers: [
  provideRouter(routes, withDisabledInitialNavigation()),
  provideAppInitializer(async () => {
    const session = inject(SessionService);
    const router = inject(Router);
    await session.restore();          // the "complex initialization logic" the docs mean
    router.initialNavigation();
  }),
],
```

⚠️ Note that both the feature's own initializer and yours are app initializers, so they start
concurrently ([06b](06b-initializer-ordering-and-failure.md)) — the feature's is a synchronous call and
finishes immediately, but do not build a sequencing assumption on top of that.

## `withEnabledBlockingInitialNavigation` — a feature that contains an app initializer

```ts
export function withEnabledBlockingInitialNavigation(): EnabledBlockingInitialNavigationFeature {
  const providers = [
    {provide: IS_ENABLED_BLOCKING_INITIAL_NAVIGATION, useValue: true},
    {provide: INITIAL_NAVIGATION, useValue: InitialNavigation.EnabledBlocking},
    provideAppInitializer(() => {
      const injector = inject(Injector);
      const locationInitialized: Promise<any> = injector.get(
        LOCATION_INITIALIZED,
        Promise.resolve(),
      );

      return locationInitialized.then(() => {
        return new Promise((resolve) => {
          const router = injector.get(Router);
          const bootstrapDone = injector.get(BOOTSTRAP_DONE);
          afterNextNavigation(router, () => {
            // Unblock APP_INITIALIZER in case the initial navigation was canceled or errored
            // without a redirect.
            resolve(true);
          });

          injector.get(NavigationTransitions).afterPreactivation = () => {
            // Unblock APP_INITIALIZER once we get to `afterPreactivation`. At this point, we
            // assume activation will complete successfully (even though this is not
            // guaranteed).
            resolve(true);
            return bootstrapDone.closed ? of(void 0) : bootstrapDone;
          };
          router.initialNavigation();
        });
      });
    }),
  ];
  return routerFeature(RouterFeatureKind.EnabledBlockingInitialNavigationFeature, providers);
}
```

> *"Configures initial navigation to start before the root component is created."*
> *"The bootstrap is blocked until the initial navigation is complete. This should be set in case you
> use [server-side rendering](https://angular.dev/guide/ssr), but do not enable
> [hydration](https://angular.dev/guide/hydration) for your application."*

🔴 **This is the feature that proves why a router feature's `ɵproviders` is typed
`Array<Provider | EnvironmentProviders>`** rather than `Provider[]` — chunk
[08](08-router-features-one-by-one.md). It nests a whole `provideAppInitializer(...)` result inside
itself, and app initializers are the only hook that can hold bootstrap open
([06](06-startup-and-error-listener-providers.md)).

Read the two `resolve(true)` calls together: the promise is resolved either at `afterPreactivation` —
the optimistic point where *"we assume activation will complete successfully (even though this is not
guaranteed)"* — or by `afterNextNavigation`, which is the escape hatch *"in case the initial navigation
was canceled or errored without a redirect."* Both exist so that a failed first navigation unblocks
bootstrap rather than hanging it, which is the failure mode this shape is guarding against.

## ⚠️ Hydration and `enabledBlocking` contradict each other, and the framework says so

`provideClientHydration()` installs a dev-mode check that fires when
`IS_ENABLED_BLOCKING_INITIAL_NAVIGATION` is also provided:

```ts
        if (isEnabledBlockingInitialNavigation) {
          const console = inject(Console);
          const message = formatRuntimeError(
            RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES,
            'Configuration error: found both hydration and enabledBlocking initial navigation ' +
              'in the same application, which is a contradiction.',
          );
          console.warn(message);
        }
```

⚠️ **I did not verify the numeric code for `HYDRATION_CONFLICTING_FEATURES`** — it is not in `core`'s
`RuntimeErrorCode` enum, and `platform-browser` has its own range. Match on the message text, not on a
code you saw in a blog post.

The contradiction is the one the feature's own JSDoc names: blocking initial navigation exists for SSR
*without* hydration, because it makes the client re-render everything before showing anything. With
hydration the server-rendered markup is already correct, so blocking gains nothing and costs the whole
first navigation in latency. The full hydration story is chunk 11.

## Gotchas

**★ Symptom: `provideClientHydration()` and `withEnabledBlockingInitialNavigation()` are both present
and the console warns about a contradiction.** Cause: the documented one — blocking initial navigation
exists for server-side rendering *without* hydration; with hydration the markup is already correct and
blocking only delays the first paint. Fix: drop the router feature and keep hydration —

```ts
providers: [
  provideClientHydration(),
  provideRouter(routes),   // the default, enabledNonBlocking, is what hydration wants
],
```

**★ Symptom: with `withDisabledInitialNavigation()` the URL is read, back and forward work, and the
first page never renders anything.** Cause: exactly what the feature does — the location listener is
installed by its app initializer, but `INITIAL_NAVIGATION` is `Disabled` so the bootstrap listener
skips `router.initialNavigation()`, and nothing else calls it. Fix: call it yourself once your
initialisation is done —

```ts
provideAppInitializer(async () => {
  const router = inject(Router);
  await inject(SessionService).restore();
  router.initialNavigation();
}),
```

**★ Symptom: `withEnabledBlockingInitialNavigation()` makes the application take much longer to show
anything.** Cause: that is the feature. Bootstrap is held open by an app initializer until the first
navigation reaches `afterPreactivation`, so every guard and resolver on the initial route is now on the
critical path of first paint. Fix: use it only for the case its documentation names — SSR without
hydration — and otherwise leave the default `enabledNonBlocking` in place, which starts the navigation
after the root component exists.

**Symptom: you passed both `withEnabledBlockingInitialNavigation()` and
`withDisabledInitialNavigation()` and there is no error.** Cause: `provideRouter` validates nothing
([08](08-router-features-one-by-one.md)) — both write `INITIAL_NAVIGATION`, a non-multi token, so the
later one wins, and *both* app initializers still run. That means the location listener is installed
**and** an initializer is waiting on a navigation that the surviving configuration may never start.
Fix: pass exactly one.

## Interview questions

**★ Why is `withEnabledBlockingInitialNavigation()` implemented as an app initializer rather than as a
flag the router reads?**
Because blocking bootstrap is not something the router can do on its own — `provideAppInitializer` is
the only hook in the framework whose returned Promise is awaited before the root component is created
([06](06-startup-and-error-listener-providers.md)). So the feature contributes one, and that
initializer's Promise is resolved either when the first navigation reaches `afterPreactivation` or, as
a safety net, by `afterNextNavigation` *"in case the initial navigation was canceled or errored without
a redirect."* The second path exists because without it a failed first navigation would leave the app
initializer pending forever, which is the blank-page-with-no-error failure from
[06c](06c-when-a-startup-initializer-fails.md). It is also the reason a router feature's `ɵproviders`
array is typed to accept `EnvironmentProviders` at all.

**★ Hydration and blocking initial navigation warn when combined. Why is that a contradiction rather
than merely redundant?**
Because they want opposite things from the first paint. Blocking initial navigation exists so that a
server-rendered application *without* hydration does not flash server markup before the client router
decides what to show — it delays everything until the client has resolved the route. Hydration exists
so the server markup **is** the first paint and the client attaches to it. Combining them means paying
the full cost of blocking — every guard and resolver on the initial route, before anything renders —
in order to avoid a flash that hydration has already eliminated. The framework warns rather than
throwing because the application still works; it is just slower for no benefit.

**When would you actually reach for `withDisabledInitialNavigation()`?**
When something must be settled before the router is allowed to choose a route at all, and expressing
it as a guard is wrong — a session restore whose result decides which route is even legal, a
micro-frontend shell that must register its outlets first, or a native wrapper that supplies the
initial URL asynchronously. Note what the feature still does: its app initializer installs the
location-change listener, so browser back and forward are live from the start. What it withholds is
only the *first* navigation, and you get the trigger, `router.initialNavigation()`, to call when ready.
If the answer is "we just want to wait for some data", a resolver or an app initializer is simpler and
does not put the router into a state where forgetting one call renders nothing.

---

← Prev: [Preloading and navigation errors](08e-preloading-and-navigation-errors.md) · Index: [Topic index](README.md) · Next → [What never reaches production](08g-tracing-and-the-experimental-end.md)
