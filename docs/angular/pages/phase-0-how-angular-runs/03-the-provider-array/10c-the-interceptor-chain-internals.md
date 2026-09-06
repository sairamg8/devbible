---
title: "Three guards sit in front of the fold — a `Set` that de-duplicates by function reference, a `this.chain === null` that reads the token exactly once per handler, and a root-interceptor lookup that changes mode when the handler is delegating to its parent"
sidebar_label: "10c · Chain internals"
sidebar_position: 10.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything upstream of the `reduceRight` in [10](10-http-features.md) is four statements, and each
one answers a bug report people file every week.** The `Set` is why the same interceptor registered
twice runs once — and why two *identical-looking* interceptors still run twice. The
`if (this.chain === null)` is why you cannot add an interceptor at runtime. The
`HTTP_ROOT_INTERCEPTOR_FNS` lookup is why a framework interceptor always ends up closest to the
backend, and why that changes when a child handler delegates to its parent. And `this.injector`,
threaded into every link, is why `inject()` inside an interceptor cannot see anything a route
provided.

## The four statements

```ts
  handle(initialRequest: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (this.chain === null) {
      const parentHandler = this.injector.get(HttpHandler, null, {skipSelf: true});
      const isDelegating = parentHandler !== null && this.backend === parentHandler;
      const rootInterceptorFns = this.injector.get(
        HTTP_ROOT_INTERCEPTOR_FNS,
        [],
        isDelegating ? {self: true} : undefined,
      );
      const dedupedInterceptorFns = Array.from(
        new Set([...this.injector.get(HTTP_INTERCEPTOR_FNS), ...rootInterceptorFns]),
      );
```

## `new Set(...)` de-duplicates by reference, and keeps the first position

A `Set` of functions compares with SameValueZero, so it collapses two entries only when they are the
**same function object**. Two structurally identical arrows are two objects and run twice. It also
preserves first insertion, so a function present both in `HTTP_INTERCEPTOR_FNS` and in
`HTTP_ROOT_INTERCEPTOR_FNS` runs once, at its **local** position, not its root one.

The de-duplication exists for one specific case: `withInterceptorsFromDi()` appearing more than once.
That feature goes to real trouble to guarantee a single function object precisely so this `Set` can
collapse it — the mechanism, and the comment that says so, are
[10d](10d-the-two-interceptor-systems.md).

🔴 **It does nothing for the case people expect it to cover**, which is a helper that builds its
interceptor inline. Every call produces a fresh closure, so nothing collapses:

```ts
// ⛔ each call to provideApiHttp() creates a NEW function object
export function provideApiHttp() {
  return provideHttpClient(withInterceptors([(req, next) => next(addApiKey(req))]));
}
```

```ts
// ✅ one function object for the whole application, so the Set can collapse repeats
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => next(addApiKey(req));

export function provideApiHttp() {
  return provideHttpClient(withInterceptors([apiKeyInterceptor]));
}
```

## `if (this.chain === null)` reads the token exactly once per handler

The composition is memoised. `HTTP_INTERCEPTOR_FNS` and `HTTP_ROOT_INTERCEPTOR_FNS` are read from the
injector on the first request a given `HttpInterceptorHandler` serves, and never again for the life of
that handler. The interceptor **bodies** still run on every request — it is the fold that is cached,
not the invocation — but the *list* is frozen.

There is therefore no supported way to add or remove an interceptor at runtime. The shape that works
is one permanently registered interceptor that reads mutable state per request:

```ts
// src/app/http/tracing.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TracingFlags } from './tracing-flags';

export const tracingInterceptor: HttpInterceptorFn = (req, next) => {
  const flags = inject(TracingFlags);           // read per request, not per chain
  if (!flags.enabled()) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Trace': flags.traceId() } }));
};
```

## Root interceptors are concatenated after yours, and the lookup mode flips

`HTTP_ROOT_INTERCEPTOR_FNS` is a second multi token whose doc comment is one sentence:

> *"A multi-provided token of `HttpInterceptorFn`s that are only set in root."*

The spread `[...this.injector.get(HTTP_INTERCEPTOR_FNS), ...rootInterceptorFns]` puts those entries
**after** every entry from `HTTP_INTERCEPTOR_FNS`, unconditionally. So a root-registered interceptor
is the closest to the backend: the last to touch the request and the first to touch the response.
Nothing you pass to `withInterceptors` can get past one.

The lookup *mode* is the subtle part. `isDelegating` is true when this handler's injected
`HttpBackend` **is** the parent injector's `HttpHandler` — which is exactly the wiring
[`withRequestsMadeViaParent()`](10f-requests-made-via-parent.md) installs. In that case the root
interceptors are read with `{self: true}`, so inherited ones are excluded from *this* chain. The
source gives no reason; the only reading consistent with the code is that the request is about to be
handed to the parent's chain, which will apply them there, and applying them here as well would run
them twice. When the handler is not delegating, the lookup is an ordinary inheriting one and root
entries registered above do join the chain.

## One handler per configuring injector, and `inject()` resolves against it

`provideHttpClient` lists `HttpClient`, `HttpInterceptorHandler` and `HttpHandler` in its provider
array, so **every injector that calls it gets its own instances** — its own handler, its own chain,
its own read of the interceptor tokens. That is the mechanism behind the `withRequestsMadeViaParent`
documentation's opening claim, quoted in full in [10f](10f-requests-made-via-parent.md):

> *"By default, `provideHttpClient` configures `HttpClient` in its injector to be an independent instance."*

The fold passes the owning injector into every link —
`chainedInterceptorFn(nextSequencedFn, interceptorFn, this.injector)` — and `this.injector` is the
injector that owns the handler, that is, the one whose `providers` array contained the
`provideHttpClient()` call. That is what makes `inject()` usable inside a functional interceptor body,
and it fixes two things people get wrong: the interceptor cannot see anything provided *below* that
injector, and the injection context is synchronous, so `inject()` must be called before the first
`await` or operator callback.

The injector hierarchy itself, `{self: true}`, `{skipSelf: true}` and what "resolves against" means
mechanically are **Phase 6 · Dependency injection** *(not written yet)*; this page needs only the
identity of the injector.

## Gotchas

**★ Symptom: one interceptor runs twice for a single request.** Cause: the de-duplication is a `Set`
over function *references* and you registered two distinct objects — almost always a factory helper
that builds the interceptor inline, so every call site produces a fresh closure. Fix: hoist it to a
module-level `const`, as in the `apiKeyInterceptor` above, so every registration is the same reference.

**★ Symptom: an interceptor runs twice per request in an application that uses
`withRequestsMadeViaParent()`.** Cause: the de-duplication is per **handler**, not global. A shared
`provideApiHttp()` called at the root *and* on a route registers the same function in two different
`HTTP_INTERCEPTOR_FNS` arrays; the child chain runs it, then delegates to the parent chain, which runs
it again. Neither `Set` can see the other. Fix: register shared interceptors in exactly one injector
and let delegation carry the request to them —

```ts
// root only
provideHttpClient(withInterceptors([apiKeyInterceptor])),

// on the route: local interceptors only, then delegate upward
provideHttpClient(withInterceptors([routeAuditInterceptor]), withRequestsMadeViaParent()),
```

**★ Symptom: `inject()` inside an interceptor throws the "`inject()` must be called from an injection
context" error, but only on the failure path.** Cause: the injection context is synchronous and ends
at the first `await`, `then` or operator callback, so an `inject()` inside a `catchError` body is
outside it. Fix: hoist every `inject()` to the top of the interceptor and close over the result —

```ts
export const reportInterceptor: HttpInterceptorFn = (req, next) => {
  const reporter = inject(ErrorReporter);           // ✅ synchronous, at the top
  return next(req).pipe(
    catchError((error: unknown) => {
      reporter.record(req.urlWithParams, error);    // closed over, not injected here
      return throwError(() => error);
    }),
  );
};
```

**Symptom: an interceptor cannot inject a service you provided on a route.** Cause: the interceptor
resolves against `this.injector`, the injector that owns the `HttpInterceptorHandler`, which is where
`provideHttpClient()` was called. A route injector is below that, and injectors do not look downward.
Fix: move the service up to the injector that configures `HttpClient`, or call `provideHttpClient()`
on the route itself so the route gets its own handler — and remember that a second handler means a
second, independent chain.

**Symptom: you flip a flag to enable an interceptor at runtime and nothing changes.** Cause:
`if (this.chain === null)` — the token is read once per handler and the composition is cached for the
handler's lifetime. Providers cannot join a live chain. Fix: register the interceptor permanently and
branch inside it, as in `tracingInterceptor` above.

**Symptom: a framework-registered interceptor runs after yours no matter where you put yours.** Cause:
`HTTP_ROOT_INTERCEPTOR_FNS` is spread in *after* `HTTP_INTERCEPTOR_FNS`, unconditionally — position
within your own array is irrelevant to that. Fix: none from `withInterceptors`. If your interceptor
must be closest to the backend, it has to be the request that changes: make it from an injector whose
chain does not inherit that root registration.

**Symptom: after adding `withRequestsMadeViaParent()` a root interceptor stops appearing in the child
chain.** Cause: `isDelegating` became true, so `HTTP_ROOT_INTERCEPTOR_FNS` is read `{self: true}` and
inherited entries are dropped from the child chain. Fix: nothing to fix — it still runs, once, in the
parent chain the request is about to enter. Verify there rather than in the child.

## Interview questions

**★ The de-duplication is `Array.from(new Set([...]))`. What is compared, and give a case where it does
not help.**
Function identity — a `Set` uses SameValueZero, so only the *same object* collapses. It works for the
case it was designed for, `withInterceptorsFromDi()` included more than once, because that feature
routes through an intermediate token specifically to guarantee one instance
([10d](10d-the-two-interceptor-systems.md)). It does nothing for two structurally identical arrow
functions and nothing for a helper that creates its interceptor inline, because each call is a new
closure. Note also that `Set` keeps first insertion, so a function present both locally and in the
root list runs once at its local position.

**★ The chain is memoised on `this.chain === null`. What does that make impossible, and what do you do
instead?**
It makes runtime registration impossible: both interceptor tokens are read on the first request a
handler serves and never again, so a provider added afterwards can never join that chain. What still
works is per-request behaviour inside a permanently registered interceptor — inject a service or read
a signal in the body and branch. The distinction to state clearly is that the memoisation caches the
*composition*, not the invocation; the bodies run on every request.

**★ Which injector does `inject()` inside a functional interceptor resolve against, and how do you
know?**
The injector that owns the `HttpInterceptorHandler` — the one whose `providers` array contained the
`provideHttpClient()` call. It is visible in the fold, which passes `this.injector` into every link.
The practical consequences are that an interceptor cannot see anything provided in a route or
component injector below it, and that a second `provideHttpClient()` in a nearer injector creates a
second handler with its own injector, its own chain, and potentially different service instances
behind identical interceptor code.

**When does a child `HttpClient` see the root interceptors, and when does it not?**
Whenever it is not delegating. `handle` computes `isDelegating` as "there is a parent `HttpHandler`
and my `HttpBackend` *is* that parent handler", which is the arrangement `withRequestsMadeViaParent()`
creates. If that is false, `HTTP_ROOT_INTERCEPTOR_FNS` is read with an ordinary inheriting lookup and
the root entries are concatenated after the child's own. If it is true, the lookup becomes
`{self: true}` and inherited root entries are dropped from this chain, because the request is about to
traverse the parent chain where they will be applied.

**How many interceptor chains does an application have?**
One per injector that called `provideHttpClient()`, because that call provides `HttpInterceptorHandler`
locally. A default application therefore has exactly one; an application with a `provideHttpClient()`
on a lazy route has two, and they share nothing — different handler instances, different reads of the
token, different `Set`s, different injectors for `inject()`. That is the fact that explains almost
every "my interceptor did not run" report: the service making the request injected a different
`HttpClient` than the one you configured.

---

← Prev: [Choosing interceptor positions](10b-choosing-interceptor-positions.md) · Index: [Topic index](README.md) · Next → [The two interceptor systems](10d-the-two-interceptor-systems.md)
