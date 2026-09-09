---
title: "A router feature has no privileged status against a hand-written provider for the same token, the same feature passed twice replaces rather than merges, and one `provideHttpClient()` call written twice splits its own outcome across both collision rules at once"
sidebar_label: "13d · Features vs hand-written providers"
sidebar_position: 13.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A `with*` feature looks like configuration and is a provider, and once you see it that way its
three failure modes stop being surprising.** `withHashLocation()` competes with a hand-written
`LocationStrategy` on ordinary terms; two `withRouterConfig()` calls replace rather than merge,
because the token holds the whole options object; and `provideHttpClient()` written twice resolves
its non-multi tokens by last-wins while accumulating its multi token, so one duplicated call produces
two different kinds of outcome in the same injector. [13c](13c-last-wins-in-practice.md) has the two
collisions that exist in every application; these three arrive with a refactor.

## `LocationStrategy` — a feature and a hand-written provider, on equal terms

`withHashLocation()` is one provider and nothing else:

```ts
export function withHashLocation(): RouterHashLocationFeature {
  const providers = [{provide: LocationStrategy, useClass: HashLocationStrategy}];
  return routerFeature(RouterFeatureKind.RouterHashLocationFeature, providers);
}
```

So it competes with any `LocationStrategy` provider you write yourself, on ordinary last-wins terms —
and because the feature is flattened out of `provideRouter`'s `EnvironmentProviders` at
`provideRouter`'s position, the comparison is between *the position of the `provideRouter` call* and
the position of your entry:

```ts
// Hash routing loses: your entry is at index 1, the feature was flattened in at index 0.
providers: [
  provideRouter(routes, withHashLocation()),
  {provide: LocationStrategy, useClass: PathLocationStrategy},
]

// Hash routing wins: same two lines, swapped.
providers: [
  {provide: LocationStrategy, useClass: PathLocationStrategy},
  provideRouter(routes, withHashLocation()),
]
```

The fix is not to pick an order. It is to have one source of truth:

```ts
// One decision, in one place, with the feature that exists for it.
providers: [provideRouter(routes, withHashLocation())]
```

[08b](08b-with-router-config-and-hash-location.md) covers what `HashLocationStrategy` actually
changes; the point here is that a router *feature* has no privileged status against a plain provider
for the same token.

## The same feature passed twice

`provideRouter` performs no validation on its feature list at all — the whole body is the four
providers and `features.map((feature) => feature.ɵproviders)`. So two `withRouterConfig()` calls both
register `ROUTER_CONFIGURATION`, the second wins, and there is nothing to notice it:

```ts
// The first configuration object is dead. Nothing warns.
provideRouter(
  routes,
  withRouterConfig({paramsInheritanceStrategy: 'always'}),
  withRouterConfig({onSameUrlNavigation: 'reload'}),
)

// Fixed — one object, both keys.
provideRouter(
  routes,
  withRouterConfig({paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload'}),
)
```

🔴 **This is the most under-diagnosed shape in the whole topic**, because it reads like configuration
merging and is configuration replacement. `ROUTER_CONFIGURATION` is `useValue: options` — the object
you passed, whole. Nothing merges the two objects; the first is discarded by the `Map.set`.

## `provideHttpClient()` twice — both rules at once

```ts
// A refactor puts one call in a shared "core" providers constant and another in app.config.ts.
const coreProviders = [provideHttpClient(withInterceptors([authInterceptor]))];

export const appConfig: ApplicationConfig = {
  providers: [coreProviders, provideHttpClient(withXhr())],
};
```

Walk it with [13](13-order-dependence.md)'s two rules and the outcome splits:

- **`HttpBackend`, `HttpHandler`, `HttpClient`, `FetchBackend`, `HttpInterceptorHandler`** —
  non-multi. The second call's records win, so the backend is XHR.
- **`HTTP_INTERCEPTOR_FNS`** — multi. Both calls contribute, so the registered array is
  `xsrfInterceptorFn, authInterceptor, xsrfInterceptorFn`. The duplicate `xsrfInterceptorFn` is the
  same function reference from both calls, and `HttpInterceptorHandler.handle` de-duplicates with
  `Array.from(new Set([...]))` before folding — so it runs once, at its first position
  ([10c](10c-the-interceptor-chain-internals.md)).

**Fixed — call it once, and pass every feature to that call:**

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withXhr(), withInterceptors([authInterceptor]))],
};
```

## Gotchas

**★ Symptom: two `withRouterConfig()` calls and only the second object's options take effect.** Cause:
`ROUTER_CONFIGURATION` is `{provide: ROUTER_CONFIGURATION, useValue: options}` — a whole-object
`useValue`, non-multi, replaced not merged. Fix: one call, one object:
`withRouterConfig({paramsInheritanceStrategy: 'always', onSameUrlNavigation: 'reload'})`.

**★ Symptom: `withHashLocation()` stopped working after someone added `LocationStrategy` to the
array.** Cause: the feature is an ordinary non-multi provider for `LocationStrategy`, flattened in at
`provideRouter`'s position; a later hand-written provider beats it. Fix: delete the hand-written
provider and express the choice through the feature — or, if you genuinely need a custom strategy,
delete `withHashLocation()` so there is one provider for the token.

**★ Symptom: an interceptor stopped running after a second `provideHttpClient()` appeared in a shared
constant.** Cause: it did not stop running — the *backend* changed, because non-multi tokens took the
second call's records while `HTTP_INTERCEPTOR_FNS` accumulated from both. A behaviour change that
looks like a missing interceptor is usually a swapped backend. Fix: one `provideHttpClient()` per
injector, with every feature on that one call.

**★ Symptom: a provider in a library's `provideX()` overrides yours and you cannot see where.** Cause:
`EnvironmentProviders` is opaque at the call site — the tokens a `provide*` writes are visible only in
its source. Fix: read the function (they are typically under ten lines, as every quote in this chunk
shows), and when you write your own, document the tokens it writes —
[04](04-writing-your-own-provide-function.md) makes that part of the contract.

## Interview questions

**★ A `provide*` function and a hand-written provider write the same token. Does the function get any
priority?**
None. `makeEnvironmentProviders` produces a value that `forEachSingleProvider` unwraps in place, so by
the time `processProvider` sees the entries there is nothing distinguishing framework-authored from
hand-written. Position in the flattened array is the only input. This is worth stating explicitly in
an interview because a lot of people carry an intuition that `provide*` functions are "installed"
rather than "listed", and that intuition predicts the wrong winner every time.

**Two `withRouterConfig()` calls — why is that replacement rather than a merge, when the options
object has independent keys?**
Because the feature body is `[{provide: ROUTER_CONFIGURATION, useValue: options}]`, and `useValue`
carries the object by reference. There is no merge step anywhere between the feature and
`processProvider`; the second record replaces the first, and the first object becomes unreachable.
Merging would require the token to be `multi: true` and a consumer that folds the array, which is a
design Angular uses elsewhere — `ROUTES` — but not here.

**Why is "reorder until it works" a bad debugging strategy for a provider array, even though ordering
genuinely decides these five cases?**
Because reordering changes the outcome only for tokens that two entries both write, and it changes it
silently for *every* such token at once. A reorder that fixes the symptom you were chasing can flip a
second collision you did not know about — the `LocationStrategy` case and the `HttpBackend` case can
sit in the same two lines. The reliable procedure is the reverse: name the token, find every entry
that writes it, decide which one you want, and delete the rest.

← Prev: [Last-wins in practice](13c-last-wins-in-practice.md) · Index: [Topic index](README.md) · Next → [Multi tokens append](13e-multi-tokens-append.md)
