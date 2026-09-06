---
title: "Every `provideHttpClient()` call builds an *independent* `HttpClient` whose interceptors are invisible to every other one, and `withRequestsMadeViaParent()` is the single feature that reconnects them — by replacing `HttpBackend` with the parent injector's `HttpHandler` in a factory that cannot fail until something injects it"
sidebar_label: "10f · Requests made via parent"
sidebar_position: 10.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); and `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The `withRequestsMadeViaParent` JSDoc is the only place in the framework where the multiple-`HttpClient`
model is written down, and it is worth reading before you ever put `provideHttpClient()` on a route.**
Configuring `HttpClient` in a child injector does not extend the parent's configuration — it replaces
it, for anything that injects through that injector, and the parent's interceptors simply do not run.
This feature is the one supported way back: it swaps `HttpBackend` for the parent's `HttpHandler`, so
after the local chain finishes, the request enters the parent chain instead of being dispatched. It is
`@publicApi 19.0`, stable, and it fails in a way that is easy to misread — the check is inside a
`useFactory`, so it can only fire once something injects the backend, and it is `ngDevMode`-guarded on
top of that.

## The body

```ts
export function withRequestsMadeViaParent(): HttpFeature<HttpFeatureKind.RequestsMadeViaParent> {
  return makeHttpFeature(HttpFeatureKind.RequestsMadeViaParent, [
    {
      provide: HttpBackend,
      useFactory: () => {
        const handlerFromParent = inject(HttpHandler, {skipSelf: true, optional: true});
        if (ngDevMode && handlerFromParent === null) {
          throw new Error(
            'withRequestsMadeViaParent() can only be used when the parent injector also configures HttpClient',
          );
        }
        return handlerFromParent;
      },
    },
  ]);
}
```

One provider. `HttpBackend` — the thing at the end of the chain that would normally dispatch — becomes
the **parent injector's `HttpHandler`**, which is itself the head of the parent's interceptor chain.
So the local chain's `interceptorChainEndFn` hands the request to the parent's chain rather than to a
`fetch` call. That is also precisely the condition
[10c](10c-the-interceptor-chain-internals.md) tests as `isDelegating`:
`this.backend === parentHandler`.

## What the documentation states, at length

This is the only written account of the model, so it is quoted in full:

> *"By default, `provideHttpClient` configures `HttpClient` in its injector to be an independent instance. For example, even if `HttpClient` is configured in the parent injector with one or more interceptors, they will not intercept requests made via this instance."*
> *"With this option enabled, once the request has passed through the current injector's interceptors, it will be delegated to the parent injector's `HttpClient` chain instead of dispatched directly, and interceptors in the parent configuration will be applied to the request."*
> *"If there are several `HttpClient` instances in the injector hierarchy, it's possible for `withRequestsMadeViaParent` to be used at multiple levels, which will cause the request to "bubble up" until either reaching the root level or an `HttpClient` which was not configured with this option."*
> *"This feature cannot be combined with `withFetch` or `withXhr` in the same `provideHttpClient()` call."*

and the setup guide's warning, verbatim:

> *"CRITICAL: You must configure an instance of `HttpClient` above the current injector, or this option is not valid and you'll get a runtime error when you try to use it."*

Read together with the body, three consequences follow.

**Interceptor order across levels is child-first, then parent.** The request finishes the child chain
— every entry of the child injector's `HTTP_INTERCEPTOR_FNS`, in array order — and only then enters
the parent's chain from the top. Responses unwind back through the parent's chain and then the
child's.

**Bubbling stops at the first level that did not opt in.** A three-level hierarchy where only the
middle level uses the feature delegates once and dispatches there; the root's interceptors never see
the request.

**Inherited root interceptors are dropped from the delegating chain.** Because `isDelegating` is true,
`HTTP_ROOT_INTERCEPTOR_FNS` is read `{self: true}`, so entries registered above are excluded here —
they will be applied when the request reaches the parent chain. The mechanism is
[10c](10c-the-interceptor-chain-internals.md).

```ts
// src/app/app.config.ts — the parent
providers: [
  provideHttpClient(withInterceptors([authInterceptor, logInterceptor])),
],
```

```ts
// src/app/reports/reports.routes.ts — the child
export const reportRoutes: Routes = [
  {
    path: 'reports',
    providers: [
      provideHttpClient(
        withInterceptors([reportAuditInterceptor]),
        withRequestsMadeViaParent(),
      ),
    ],
    loadComponent: () => import('./reports-page').then((m) => m.ReportsPage),
  },
];
```

A request made from a service injected inside `/reports` now runs
`xsrf → reportAudit → (delegate) → xsrf → auth → log → fetch`. Note that `xsrfInterceptorFn` appears
in **both** chains: each `provideHttpClient()` call pushed it into its own injector's array, and the
de-duplication is per handler, so a function registered at two levels genuinely runs twice. Route-level
`providers` themselves are **15 · Route-level providers** *(not written yet)*.

## The failure mode is later and quieter than it looks

The check lives inside a `useFactory`, so it cannot run while `provideHttpClient()` is assembling
providers and it cannot run at bootstrap. It runs when something first injects `HttpBackend` in that
injector — which is after the injector exists and after the application is on screen.

⚠️ **Whether that lands at the first `inject(HttpClient)` or at the first outgoing request depends on
when `HttpInterceptorHandler` resolves `HttpBackend`, which was not read for this page.** What is
certain, and is what matters operationally, is that it is a *use-time* error rather than a
configuration-time one: a route can be merged, deployed and pass a smoke test that never opens it.

🔴 **And in a production build there is no error at all.** The throw is guarded by `ngDevMode`, and the
factory then returns `handlerFromParent` — which is `null` in exactly the case the check was written
for. The behaviour of a `null` `HttpBackend` is not described in the source read here; what can be
said is that the readable message exists only in development, so a production symptom will not name
this feature. Reproduce in `ng serve` before theorising.

The message itself is a plain `Error`, not a `RuntimeError`, so there is **no `NGxxxx` code** to
search for:

`withRequestsMadeViaParent() can only be used when the parent injector also configures HttpClient`

The other way this feature refuses is at call time, in `provideHttpClient`'s dev-mode block, and that
one is a genuine configuration error:

`Configuration error: withRequestsMadeViaParent() cannot be combined with withFetch() or withXhr() in the same call to provideHttpClient().`

The asymmetry is the point: two backend overrides in one call degrade to last-wins, which is defined
behaviour, but delegating to the parent *and* pinning a local backend are two different values for the
same `HttpBackend` token with no sensible resolution. The full validation block is
[09 · `provideHttpClient()` and the backend](09-provide-http-client-and-the-backend.md).

## Gotchas

**★ Symptom: interceptors configured at the application level do not run for requests made from a lazy
route.** Cause: the route called `provideHttpClient()`, which provides `HttpClient`,
`HttpInterceptorHandler` and `HttpHandler` locally — an independent instance whose chain is built from
the route injector's own `HTTP_INTERCEPTOR_FNS`. The parent's interceptors are not inherited, by
design. Fix: either do not configure HTTP on the route at all, or delegate —

```ts
providers: [
  provideHttpClient(withInterceptors([reportAuditInterceptor]), withRequestsMadeViaParent()),
],
```

**★ Symptom: `withRequestsMadeViaParent() can only be used when the parent injector also configures
HttpClient`, thrown long after startup.** Cause: no ancestor injector provides `HttpHandler`, and the
check lives inside the `HttpBackend` factory, so it fires when the backend is first injected rather
than at bootstrap. Fix: configure `HttpClient` above —

```ts
// src/app/app.config.ts
providers: [provideHttpClient(withInterceptors([authInterceptor]))],
```

**★ Symptom: the same misconfiguration is silent in production.** Cause: `if (ngDevMode && handlerFromParent === null)`
— in a production build the condition short-circuits and the factory returns `null` as the
`HttpBackend`. Fix: do not rely on the throw as a gate. Keep the root `provideHttpClient()` call
somewhere a reviewer can see it, and reproduce any HTTP failure in a development build before
theorising about it, because that is the only build where the cause has a name.

**Symptom: `Configuration error: withRequestsMadeViaParent() cannot be combined with withFetch() or
withXhr() in the same call to provideHttpClient().`** Cause: both features provide `HttpBackend`, and
the framework refuses rather than picking one. Fix: delete the backend feature from the child — the
backend that matters is the one at the level that actually dispatches —

```ts
// ⛔
provideHttpClient(withXhr(), withRequestsMadeViaParent()),

// ✅ the parent decides the backend; the child only delegates
provideHttpClient(withRequestsMadeViaParent()),
```

**Symptom: an interceptor runs twice per request after enabling delegation.** Cause: it is registered
at both levels, and both chains run — the child's, then the parent's. The de-duplication is per
handler, so neither `Set` can see the other ([10c](10c-the-interceptor-chain-internals.md)). Fix:
register shared interceptors at exactly one level and let delegation carry the request to them.

**Symptom: a request from a three-level hierarchy never reaches the root's interceptors.** Cause:
bubbling stops at the first ancestor that was *not* configured with the option — *"until either
reaching the root level or an `HttpClient` which was not configured with this option"*. A middle level
that calls `provideHttpClient()` without `withRequestsMadeViaParent()` terminates the chain there. Fix:
add the feature at every level that should forward, or remove the intermediate `provideHttpClient()`
call so no injector between the two configures HTTP at all.

**Symptom: interceptors registered on a route do not apply to requests made by a root-provided
service.** Cause: the root service injects the root `HttpClient`, whose handler was built from the
root injector's tokens — and this feature runs the other way, child to parent. There is no
parent-to-child direction and there cannot be one, because the parent handler exists before the route
injector does. Fix: move the interceptor to the root configuration, or move the request into a service
provided on the route so it uses the route's `HttpClient`.

## Interview questions

**★ You have interceptors configured at the application level and more on a lazy route. Which run, and
in what order?**
By default only the route's, because `provideHttpClient()` on the route provides `HttpClient`,
`HttpHandler` and `HttpInterceptorHandler` locally, and the JSDoc says it outright: the instance is
independent, and parent interceptors *"will not intercept requests made via this instance."* Add
`withRequestsMadeViaParent()` and both run, child chain first: the request completes the route's
interceptors in array order, then enters the parent chain from the top, and responses unwind back
through the parent's and then the route's. With more levels it bubbles until it reaches the root or the
first ancestor that did not opt in.

**★ Why can `withRequestsMadeViaParent()` not be combined with `withFetch()` or `withXhr()`, when
`withFetch()` and `withXhr()` together are perfectly legal?**
Because all three provide the same token, `HttpBackend`, but only two of them mean the same *kind* of
thing. Two backend overrides in one call are two dispatch implementations, and last-wins is a defined
resolution — the later one dispatches, and nothing is lost. Delegation is not a dispatch implementation
at all; it says "do not dispatch here, hand the request upward". Combining it with a local backend has
no coherent meaning, so `provideHttpClient` throws at call time in a development build rather than
silently picking one.

**★ When does `withRequestsMadeViaParent()`'s error surface, and why not at bootstrap?**
Because the check is inside the `useFactory` for `HttpBackend`, not in `provideHttpClient`'s validation
block. Providers are assembled without anything being constructed, so the factory does not run until
something injects `HttpBackend` in that injector — which is after the route injector exists and the
route is in use. That makes it a use-time error: a route can be merged and deployed and only fail when
someone navigates to it. Worse, the throw is `ngDevMode`-guarded, so in a production build the factory
returns `null` and the readable message never appears. The operational rule is to reproduce HTTP
failures in a development build, because that is the only place the cause is named.

**What exactly does "bubble up" mean, and where does it stop?**
Each level with the feature replaces its own `HttpBackend` with its parent's `HttpHandler`, so
completing one chain enters the next. The documentation states the terminating condition precisely:
the request bubbles *"until either reaching the root level or an `HttpClient` which was not configured
with this option."* So an intermediate injector that calls `provideHttpClient()` without the feature is
a wall — its backend dispatches, and every ancestor's interceptors are skipped. Auditing this means
reading every `provideHttpClient()` in the injector path, not just the two ends of it.

**Someone proposes putting `provideHttpClient()` on a route to "add one interceptor for this feature
area". What do you tell them?**
That it does not add an interceptor, it replaces the whole client for everything resolving through that
injector: a new `HttpClient`, a new handler, a new chain built only from that injector's tokens, and
the application's interceptors silently gone. If the feature area genuinely needs its own interceptor,
the call must include `withRequestsMadeViaParent()` so the parent chain still runs, and the team should
know that the two chains are de-duplicated independently, so an interceptor registered at both levels
runs twice. The cheaper option, usually, is one interceptor at the root that checks the URL.

---

← Prev: [XSRF protection](10e-xsrf-protection.md) · Index: [Topic index](README.md) · Next → [JSONP and the deprecated end](10g-jsonp-and-the-deprecated-end.md)
