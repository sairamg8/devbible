---
title: "Preloading is configured by a provider but started by the bootstrap listener, and a navigation error handler that redirects stops the router emitting `NavigationError` at all — two features whose real effect lands somewhere other than where you wrote them"
sidebar_label: "08e · Preloading and navigation errors"
sidebar_position: 8.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`withPreloading`](https://angular.dev/api/router/withPreloading),
> [`withNavigationErrorHandler`](https://angular.dev/api/router/withNavigationErrorHandler),
> [`PreloadingStrategy`](https://angular.dev/api/router/PreloadingStrategy); and `angular/angular` at
> tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`router/src/router_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These two features are the router's operational surface: what gets downloaded before anyone asks for
it, and what happens when a navigation fails.** Each is two providers or fewer, and each has a
consequence that shows up somewhere other than where you configured it.
`withPreloading(PreloadAllModules)` moves every lazy chunk onto the network as soon as bootstrap
finishes — a bandwidth and authorisation decision made in `app.config.ts`, and one the feature itself
does not start; the bootstrap listener does. `withNavigationErrorHandler()` can convert a failed
navigation into a redirect, and doing so stops the router emitting `NavigationError` at all, so an
error your dashboard used to count silently becomes a cancellation instead.

## `withPreloading` — two providers, and the strategy is a class

```ts
export function withPreloading(preloadingStrategy: Type<PreloadingStrategy>): PreloadingFeature {
  const providers = [
    {provide: ROUTER_PRELOADER, useExisting: RouterPreloader},
    {provide: PreloadingStrategy, useExisting: preloadingStrategy},
  ];
  return routerFeature(RouterFeatureKind.PreloadingFeature, providers);
}
```

> *"Allows to configure a preloading strategy to use. The strategy is configured by providing a
> reference to a class that implements a `PreloadingStrategy`."*

Two `useExisting` aliases and nothing else. The parameter type is `Type<PreloadingStrategy>` — a
**class reference**, not an instance and not a function — because `useExisting` resolves it through the
injector, which means your strategy is an injectable and can `inject()` whatever it needs.

The two the framework ships are named in `ExtraOptions.preloadingStrategy`'s own documentation:

> *"Configures a preloading strategy. One of `PreloadAllModules` or `NoPreloading` (the default)."*

```ts
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';

providers: [provideRouter(routes, withPreloading(PreloadAllModules))],
```

A real application usually wants something in between, and the class shape is what makes that cheap:

```ts
// src/app/routing/network-aware-preloading.ts
import { Injectable, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkAwarePreloading implements PreloadingStrategy {
  private readonly session = inject(SessionStore);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) {
      return EMPTY;
    }
    if (route.data?.['preload'] === false) {
      return EMPTY;
    }
    if (route.path?.startsWith('admin') && !this.session.isAdmin()) {
      return EMPTY;
    }
    return load();
  }
}
```

🔴 **Preloading is switched on from the bootstrap listener, not from the provider** —
`injector.get(ROUTER_PRELOADER, null, {optional: true})?.setUpPreloading()` in `getBootstrapListener`
([07b](07b-the-bootstrap-listener-and-initial-navigation.md)). The feature only makes the token
resolvable; the listener is what starts it, which is why anything that stops that listener running
also stops preloading, silently.

## `withNavigationErrorHandler` — one token, and a documented escape hatch

```ts
export function withNavigationErrorHandler(
  handler: (error: NavigationError) => unknown | RedirectCommand,
): NavigationErrorHandlerFeature {
  const providers = [
    {
      provide: NAVIGATION_ERROR_HANDLER,
      useValue: handler,
    },
  ];
  return routerFeature(RouterFeatureKind.NavigationErrorHandlerFeature, providers);
}
```

Two sentences from its JSDoc carry the whole contract:

> *"This function is run inside application's [injection context] so you can use the [`inject`]
> function."*

> *"This function can return a `RedirectCommand` to convert the error to a redirect, similar to
> returning a `UrlTree` or `RedirectCommand` from a guard. This will also prevent the `Router` from
> emitting `NavigationError`; it will instead emit `NavigationCancel` with code
> NavigationCancellationCode.Redirect. Return values other than `RedirectCommand` are ignored and do
> not change any behavior with respect to how the `Router` handles the error."*

```ts
import { NavigationError, RedirectCommand, Router, provideRouter, withNavigationErrorHandler } from '@angular/router';
import { inject } from '@angular/core';

providers: [
  provideRouter(routes, withNavigationErrorHandler((e: NavigationError) => {
    const reporter = inject(CrashReporter);
    reporter.capture(e.error, { url: e.url });

    if (isChunkLoadError(e.error)) {
      // a stale deployment: the chunk no longer exists. Send the user somewhere that does.
      return new RedirectCommand(inject(Router).parseUrl('/reload'));
    }
    return undefined;   // ignored; the Router handles the error as usual
  })),
],
```

⚠️ **Returning a `RedirectCommand` changes what your monitoring sees.** The router stops emitting
`NavigationError` for that navigation and emits `NavigationCancel` with the redirect code instead — so
a dashboard counting `NavigationError` events will show the failure disappearing rather than being
handled. Report inside the handler, as the example does, or you will lose the signal.

**This is not the application `ErrorHandler`.** `withNavigationErrorHandler` handles navigation
failures only, and returning something from it does not suppress anything else. The application-wide
seam that everything else routes into is [06g](06g-error-handler-and-ng0402.md).

## Gotchas

**★ Symptom: `withPreloading(PreloadAllModules)` is configured and nothing is preloaded.** Cause:
preloading is started by `getBootstrapListener`, which returns early for anything that is not
`ref.components[0]` — so a second `provideRouter` call or a second bootstrapped root changes the
behaviour without touching the feature. Fix: one `provideRouter` per application and one root component
per `bootstrapApplication` call; the full mechanism is in
[07b](07b-the-bootstrap-listener-and-initial-navigation.md).

**★ Symptom: `PreloadAllModules` is pulling down admin bundles for every anonymous visitor.** Cause:
it does exactly what its name says — it preloads every lazily-loaded route, with no notion of who the
user is. Fix: a strategy class of your own, which is what `Type<PreloadingStrategy>` is for; the
`NetworkAwarePreloading` example above returns `EMPTY` for routes the current session has no business
downloading.

**★ Symptom: navigation failures stopped appearing in your error dashboard after adding a redirect to
`withNavigationErrorHandler`.** Cause: documented — returning a `RedirectCommand` *"will also prevent
the `Router` from emitting `NavigationError`; it will instead emit `NavigationCancel` with code
NavigationCancellationCode.Redirect"*. Fix: report before you redirect, inside the handler —

```ts
withNavigationErrorHandler((e) => {
  inject(CrashReporter).capture(e.error, { url: e.url });
  return new RedirectCommand(inject(Router).parseUrl('/error'));
}),
```

**Symptom: `withPreloading` rejects your strategy.** Cause: the parameter is `Type<PreloadingStrategy>`
— a class reference the injector resolves with `useExisting`. An instance, a factory function or an
arrow will not type-check, and an unprovided class will not resolve. Fix: an injectable class —

```ts
@Injectable({ providedIn: 'root' })
export class NetworkAwarePreloading implements PreloadingStrategy { /* … */ }

provideRouter(routes, withPreloading(NetworkAwarePreloading)),
```

**Symptom: returning a `UrlTree`, a string or `true` from `withNavigationErrorHandler` does nothing.**
Cause: documented — *"Return values other than `RedirectCommand` are ignored and do not change any
behavior with respect to how the `Router` handles the error."* Fix: wrap the destination in a
`RedirectCommand` —

```ts
return new RedirectCommand(inject(Router).parseUrl('/not-found'));
```

**Symptom: `inject()` inside the navigation error handler throws.** Cause: it is only legal
synchronously — the handler *"is run inside application's injection context"*, and that context ends
the same way it does for an app initializer, at the first `await`
([06b](06b-initializer-ordering-and-failure.md)). Fix: inject first, then do the asynchronous work —

```ts
withNavigationErrorHandler((e) => {
  const reporter = inject(CrashReporter);       // synchronous
  void reporter.captureAsync(e.error);          // fire and forget; the handler is not awaited
  return undefined;
}),
```

## Interview questions

**★ What does `withPreloading` actually provide, and what does it *not* do?**
Two `useExisting` aliases: `ROUTER_PRELOADER` to `RouterPreloader`, and `PreloadingStrategy` to the
class you passed. It does not start anything. Preloading begins when the bootstrap listener calls
`setUpPreloading()` on the optionally-resolved `ROUTER_PRELOADER`, after the first root component
exists. That separation is why "the feature is configured" and "the feature is running" are two
different states, and why a second `provideRouter` call — which registers a second bootstrap listener
that runs against the same first component — changes preloading behaviour without touching the
preloading configuration.

**★ Your team wants `PreloadAllModules` on. What is the argument against, and what would you propose
instead?**
The argument against is that it converts every lazily-loaded route into an eager download shortly after
bootstrap, so the code splitting still helps first paint but no longer helps total bytes — and on a
metered or slow connection the user pays for routes they will never visit, including ones they are not
authorised to visit. The proposal is a `PreloadingStrategy` class of your own, which is a single
`preload(route, load)` method: return `load()` for the routes worth prefetching and `EMPTY` for the
rest, keyed off `route.data`, the session, and `navigator.connection.saveData`. It costs one small
injectable and it puts the decision next to the routes rather than in a global switch.

**★ When would you use `withNavigationErrorHandler` rather than a custom `ErrorHandler`?**
When the failure is specifically a *navigation* failure and you want to act on it as a navigation — the
handler receives a `NavigationError` with the URL that failed, runs in the injection context, and is
the only place that can convert the failure into a redirect. A custom `ErrorHandler` is the
application-wide reporting seam and cannot redirect anything. In practice most applications want both:
the `ErrorHandler` for everything, and the navigation error handler for the specific case of a stale
deployment whose lazy chunk has disappeared, where the correct response is to send the user to a page
that still exists. The one thing to be deliberate about is the monitoring consequence — a redirect
suppresses `NavigationError`, so the reporting call has to happen inside the handler.

**A navigation fails because a lazy chunk 404s after a deployment. Walk through what the router does
and where you can intervene.**
The dynamic `import()` inside `loadComponent` or `loadChildren` rejects, the navigation errors, and the
router emits `NavigationError` — unless a `withNavigationErrorHandler` is installed, in which case it
runs first, inside the injection context, with the `NavigationError` as its argument. That is the point
of intervention: report it, and return a `RedirectCommand` to send the user to a route that is served
by the currently-deployed bundle, which in practice usually means a page that triggers a full reload so
the browser fetches the new `index.html`. Returning anything else leaves the router's behaviour
unchanged and the error surfaces as usual. Nothing here is caught by the application `ErrorHandler`
first — the navigation error handler is upstream of it for this class of failure.

---

← Prev: [View transitions and scrolling](08d-view-transitions-and-scrolling.md) · Index: [Topic index](README.md) · Next → [Initial navigation](08f-initial-navigation.md)
