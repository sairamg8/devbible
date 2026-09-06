---
title: "The router features that a production user never meets — `withDebugTracing` compiles to an empty provider array, and three more are developer preview, experimental, or not in the public API at all"
sidebar_label: "08g · Tracing and the experimental end"
sidebar_position: 8.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`withDebugTracing`](https://angular.dev/api/router/withDebugTracing),
> [`withExperimentalAutoCleanupInjectors`](https://angular.dev/api/router/withExperimentalAutoCleanupInjectors); and
> `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Four of the router's thirteen feature functions should never appear in a production bundle, and each
for a different reason.** `withDebugTracing()` is stable API whose entire body is inside an `ngDevMode`
guard, so it is *self*-removing — and therefore silent in exactly the build where a navigation bug is
hardest to reproduce. `withExperimentalAutoCleanupInjectors()` and
`withExperimentalPlatformNavigation()` are both `@experimental 21.1`, and the second carries a
`CRITICAL` warning in its own documentation. `withRouterResources()` is not in the public-API golden at
all and reuses another feature's kind tag. This chunk is what each one does, how to tell a stability
tag from an API-Extractor release tag, and why the experimental pair is worth knowing about even though
you will not ship it.

## `withDebugTracing` — the feature that is literally nothing in production

```ts
export function withDebugTracing(): DebugTracingFeature {
  let providers: Provider[] = [];
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    providers = [
      {
        provide: ENVIRONMENT_INITIALIZER,
        multi: true,
        useFactory: () => {
          const router = inject(Router);
          return () =>
            router.events.subscribe((e: Event) => {
              // tslint:disable:no-console
              console.group?.(`Router Event: ${(<any>e.constructor).name}`);
              console.log(stringifyEvent(e));
              console.log(e);
              console.groupEnd?.();
              // tslint:enable:no-console
            });
        },
      },
    ];
  } else {
    providers = [];
  }
  return routerFeature(RouterFeatureKind.DebugTracingFeature, providers);
}
```

> *"Enables logging of all internal navigation events to the console. Extra logging might be useful for
> debugging purposes to inspect Router event sequence."*

Three things worth noting. It is an **environment initializer**
([06d](06d-environment-initializers.md)), so it runs at injector construction and is not awaited. The
subscription it opens is never explicitly closed — acceptable because the whole branch is dev-only and
the router outlives it. And the `else { providers = []; }` branch is what makes the feature *object*
harmless in production: the call still happens and still allocates a `{ɵkind, ɵproviders}` record, but
the record is empty, and the console code inside the `ngDevMode` branch is dead code the build
eliminates.

The most useful shape is conditional, so the feature function itself is never called in a production
build:

```ts
import { RouterFeatures, provideRouter, withDebugTracing } from '@angular/router';
import { environment } from '../environments/environment';

const routerFeatures: RouterFeatures[] = [];
if (!environment.production) {
  routerFeatures.push(withDebugTracing());
}

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, ...routerFeatures)],
};
```

## `withExperimentalAutoCleanupInjectors` — the route-injector lifetime problem

```ts
export function withExperimentalAutoCleanupInjectors(): ExperimentalAutoCleanupInjectorsFeature {
  return routerFeature(RouterFeatureKind.ExperimentalAutoCleanupInjectorsFeature, [
    {provide: ROUTE_INJECTOR_CLEANUP, useValue: routeInjectorCleanup},
  ]);
}
```

> *"Enables automatic destruction of unused route injectors."*
> *"When enabled, the router will automatically destroy `EnvironmentInjector`s associated with `Route`s
> that are no longer active or stored by the `RouteReuseStrategy`."*
> *"This feature is opt-in and requires `RouteReuseStrategy.shouldDestroyInjector` to return `true` for
> the routes that should be destroyed. If the `RouteReuseStrategy` uses stored handles, it should also
> implement `retrieveStoredRouteHandles` to ensure injectors for handles that will be reattached are
> not destroyed."*

🔴 **`@experimental 21.1`.** It is worth knowing about because it names a real problem that exists
without it: a route with `providers` gets its own `EnvironmentInjector`, and by default that injector —
and every service in it, and every `DestroyRef.onDestroy` registered against it — lives as long as the
route configuration does. That is why the environment-initializer question in
[06d](06d-environment-initializers.md) resolves to "once per injector lifetime, and the lifetime is a
routing decision". The feature makes that lifetime shorter and puts the decision in
`RouteReuseStrategy`, at the cost of two methods you have to implement correctly or you will destroy an
injector something still holds.

## `withExperimentalPlatformNavigation` — read the first line of its documentation

> *"CRITICAL: This feature is _highly_ experimental and should not be used in production. Browser
> support is limited and in active development. Use only for experimentation and feedback purposes."*

> *"This function provides a `Location` strategy that uses the browser's `Navigation` API. By using the
> platform's Navigation APIs, the Router is able to provide native browser navigation capabilities."*

> *"NOTE: Deferred entry updates are not part of the interop 2025 Navigation API commitments so the
> "ongoing navigation" communication support is limited."*

```ts
export function withExperimentalPlatformNavigation(): ExperimentalPlatformNavigationFeature {
  const devModeLocationCheck =
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [
          provideEnvironmentInitializer(() => {
            const locationInstance = inject(Location);
            if (!(locationInstance instanceof ɵNavigationAdapterForLocation)) {
              const locationConstructorName = (locationInstance as any).constructor.name;
              let message =
                `'withExperimentalPlatformNavigation' provides a 'Location' implementation that ensures navigation APIs are consistently used.` +
                ` An instance of ${locationConstructorName} was found instead.`;
              if (locationConstructorName === 'SpyLocation') {
                message += ` One of 'RouterTestingModule' or 'provideLocationMocks' was likely used. 'withExperimentalPlatformNavigation' does not work with these because they override the Location implementation.`;
              }
              throw new Error(message);
            }
          }),
        ]
      : [];
  const providers = [
    {provide: StateManager, useExisting: NavigationStateManager},
    {provide: Location, useClass: ɵNavigationAdapterForLocation},
    devModeLocationCheck,
  ];
  return routerFeature(RouterFeatureKind.ExperimentalPlatformNavigationFeature, providers);
}
```

Two things worth taking from that body even if you never use the feature. It replaces `Location`, which
is the token `withHashLocation()`'s `LocationStrategy` sits under — so the two are the router's only
genuine collision pair ([08b](08b-with-router-config-and-hash-location.md)). And its dev-mode check is
an unusually good example of a validating environment initializer: it names `SpyLocation` explicitly
and tells you which testing helper caused it, which is the standard chunk
[04](04-writing-your-own-provide-function.md) sets for your own validation messages.

## `withRouterResources` — exists, is not public API, and reuses another kind

```ts
export type RouterResourcesFeature = RouterFeature<RouterFeatureKind.ViewTransitionsFeature>;

export function withRouterResources(): RouterResourcesFeature {
  const providers = [
    {
      provide: ROUTER_RESOURCES_FEATURE,
      useValue: {
        setupAndRunResources,
        createResourceOutletBindingEffects,
      },
    },
  ];
  return routerFeature(RouterFeatureKind.ViewTransitionsFeature, providers);
}
```

> *"Enables `resources` capabilities for Route definitions."* — `@experimental`, with no version.

🔴 **It is exported from `provide_router.ts` and absent from the public-API golden**, and its type alias
reuses `RouterFeatureKind.ViewTransitionsFeature` rather than declaring a kind of its own. It is also
the one thing `withComponentInputBinding()` looks up optionally —
`new RoutedComponentInputBinder(options, inject(ROUTER_RESOURCES_FEATURE, {optional: true}))` — which is
how the two are wired together internally ([08c](08c-with-component-input-binding.md)). Treat it as
internal: it is visible, it may vanish, and it is not in the union `RouterFeatures` that
`provideRouter`'s signature accepts.

## Gotchas

**★ Symptom: `withDebugTracing()` logs nothing in a staging build.** Cause: its provider array is built
inside `if (typeof ngDevMode === 'undefined' || ngDevMode)` and is `[]` otherwise — and a staging build
made with the production configuration has `ngDevMode` defined as `false`. Fix: build staging with a
development configuration when you need the traces, or subscribe to `router.events` yourself in code
that is not `ngDevMode`-gated —

```ts
provideEnvironmentInitializer(() => {
  inject(Router).events.subscribe((e) => inject(TraceSink).record(e));
}),
```



**Symptom: `withDebugTracing()` output stops after a while, or never appears for events fired during
bootstrap.** Cause: the subscription is created by an environment initializer, which runs at step 2 of
bootstrap — before the root component exists and before the bootstrap listener starts the initial
navigation — so it does catch the initial navigation, but it is also never explicitly unsubscribed and
lives as long as the injector. If output stops, the injector was destroyed. Fix: none needed; if you
need traces beyond an injector's lifetime, subscribe from somewhere that outlives it.


**★ Symptom: you shipped a feature you believed was stable and a minor upgrade broke it.** Cause:
reading stability off the public-API golden, where every entry is tagged `// @public` because that is
API-Extractor's release tag. `withViewTransitions` is `// @public` in the golden and
`@developerPreview 19.0` in its JSDoc. Fix: read the tag on the function in `provide_router.ts` or the
badge angular.dev renders on the API page, and treat the golden as an inventory only —

```ts
// the three tags that actually matter, all from JSDoc at v22.1.5:
//   @publicApi              — stable
//   @developerPreview 19.0  — withViewTransitions
//   @experimental 21.1      — withExperimentalAutoCleanupInjectors, withExperimentalPlatformNavigation
```

**★ Symptom: `withExperimentalPlatformNavigation()` throws in your test suite with a message naming
`SpyLocation`.** Cause: its dev-mode environment initializer requires `Location` to be an
`ɵNavigationAdapterForLocation`, and `RouterTestingModule` or `provideLocationMocks()` replaces
`Location` with `SpyLocation`. The message says so explicitly. Fix: do not combine them — which in
practice means not using this feature in code under test, and is one more reason the `CRITICAL` line in
its documentation is the operative one.

**Symptom: `withRouterResources` cannot be found in the API documentation.** Cause: it is exported from
source but absent from the public-API golden, and its JSDoc is a bare `@experimental`. Fix: do not
build on it. If you need something it appears to offer, raise it upstream rather than importing a
symbol that is not in `RouterFeatures` and whose type alias borrows the view-transitions kind.

**Symptom: `withExperimentalAutoCleanupInjectors()` destroys an injector that something still holds.**
Cause: the feature delegates the decision to `RouteReuseStrategy.shouldDestroyInjector`, and the
documentation adds that a strategy using stored handles *"should also implement
`retrieveStoredRouteHandles` to ensure injectors for handles that will be reattached are not
destroyed."* Implementing one and not the other is how you get a destroyed injector behind a live
component. Fix: implement both, or do not enable the feature — it is `@experimental 21.1` and the
default behaviour, injectors living as long as the route configuration, is not a bug.

## Interview questions

**`withDebugTracing()` produces an empty provider array in production. So what is the point of it being
a function at all?**
The empty array is not where the saving is — the saving is that the console-logging code lives inside
the module that `withDebugTracing` is defined in, and a build that never calls the function never
imports the code path. Compare it with `ExtraOptions.enableTracing`, a boolean the router had to read
at runtime, which meant the implementation shipped whether the flag was `true` or `false`. The
`ngDevMode` guard inside the function is a second, independent saving for applications that *do* call
it, so that a production build of a codebase with the call still present ships nothing. Belt and
braces, and the belt is the one chunk [02](02-why-provide-functions-replaced-forroot.md) is about.





**★ How do you tell a stable router feature from a developer-preview or experimental one, and what is
the trap?**
By reading the JSDoc tag on the function in `provide_router.ts`, or the badge angular.dev renders on
the API page: `@publicApi` for the stable nine, `@developerPreview 19.0` on `withViewTransitions`,
`@experimental 21.1` on the two experimental ones, and a bare `@experimental` on `withRouterResources`,
which is not in the golden at all. The trap is the public-API golden itself: every entry there carries
`// @public`, which is API-Extractor's *release tag* and says nothing about Angular's stability
promise. Using the golden to answer "is this safe to ship" produces a confident, specific, wrong
answer — `withViewTransitions` reads as stable in it.

**★ `withExperimentalAutoCleanupInjectors()` is experimental, so you will not ship it. Why is it still
worth knowing about?**
Because it names a real property of the current default: a route with `providers` gets its own
`EnvironmentInjector`, and by default that injector lives as long as the route configuration does. Every
service in it, and every `DestroyRef.onDestroy` registered against it, has that lifetime — which is
usually longer than people assume when they put a stateful service on a route to "scope" it. Knowing
the feature exists tells you the framework considers the current lifetime a limitation rather than a
guarantee, and knowing its requirements — `shouldDestroyInjector`, and `retrieveStoredRouteHandles`
when handles are stored — tells you what would have to be true for shorter lifetimes to be safe.

**`withExperimentalPlatformNavigation()` replaces `Location`. What does that collide with?**
`withHashLocation()`, which provides `LocationStrategy` with `HashLocationStrategy`, and any testing
helper that swaps `Location` for `SpyLocation` — the feature's own dev-mode check throws for the second
case and names `RouterTestingModule` and `provideLocationMocks` in the message. This is the router's
only genuine feature-versus-feature contradiction, which is part of why `provideRouter` gets away with
validating nothing: the framework spends its `ngDevMode` budget inside the one feature that can
actually conflict, rather than on a general duplicate check in `provideRouter`
([08](08-router-features-one-by-one.md)).

---

← Prev: [Initial navigation](08f-initial-navigation.md) · Index: [Topic index](README.md) · Next → [09 · `provideHttpClient()` and the backend](09-provide-http-client-and-the-backend.md)
