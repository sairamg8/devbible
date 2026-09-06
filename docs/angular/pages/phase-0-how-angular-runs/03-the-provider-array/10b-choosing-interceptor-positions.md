---
title: "Because requests travel down the array and responses come back up it, no single interceptor position can both log the request that actually left the browser and see errors after another interceptor has normalised them — position is a design decision, not a formality"
sidebar_label: "10b · Choosing positions"
sidebar_position: 10.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts)
> (the `reduceRight` fold this page reasons from),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts).
> The consequences below are read off that nesting; the example code is illustrative and was **not run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[10](10-http-features.md) proved that the array is the order. This chunk is what that costs you.**
An interceptor sees the request as decorated by everything *before* it and the response as processed
by everything *after* it, and those two facts point in opposite directions — so the position that
makes a logger truthful about the wire makes it blind to your own error types, and vice versa. Add
immutability (each interceptor hands a *clone* downstream) and short-circuiting (an interceptor that
never calls `next` deletes everything below it), and interceptor position becomes one of the few
genuinely irreversible decisions in an `app.config.ts`.

## A three-interceptor chain, and what each position buys

```ts
// src/app/http/interceptors.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth-store';
import { RequestLog } from './request-log';
import { AppHttpError } from './app-http-error';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  if (token === null) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

export const normalizeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) =>
      throwError(() =>
        error instanceof HttpErrorResponse
          ? new AppHttpError(error.status, error.message)
          : error,
      ),
    ),
  );

export const logInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(RequestLog);
  log.sent(req.method, req.urlWithParams, req.headers.keys());
  return next(req).pipe(tap({ next: (e) => log.event(e), error: (e) => log.failed(e) }));
};
```

```ts
// src/app/app.config.ts
providers: [
  provideHttpClient(
    withInterceptors([authInterceptor, normalizeInterceptor, logInterceptor]),
  ),
],
```

| # | Interceptor | Sees the request… | Sees each response event… |
|---|---|---|---|
| 0 | `xsrfInterceptorFn` (implicit) | first, before any of yours | last |
| 1 | `authInterceptor` | after XSRF, and adds `Authorization` itself | third |
| 2 | `normalizeInterceptor` | with `Authorization` already set | second |
| 3 | `logInterceptor` | fully decorated — exactly what goes on the wire | **first**, so it logs the raw `HttpErrorResponse` |

Move `logInterceptor` to the front and both columns flip: it logs a request missing every header the
others add, and its `tap` sees the `AppHttpError` that `normalizeInterceptor` produced rather than the
server's original response. 🔴 **There is no position that gives you both.** Log the wire request from
the last slot, log domain errors from the first, and accept that those are two interceptors.

## The positional cheat sheet, and the reason for each row

| Job | Position | Why the position, not preference |
|---|---|---|
| Attach credentials, correlation IDs, tenant headers | early | everything after it must be able to see the header, and the logger must see the final version |
| Normalise errors into your own type | early | it should be the last thing an error passes through on the way out, so callers never meet `HttpErrorResponse` |
| Report errors to a crash service | before the normaliser | so it captures the shape the server actually returned, status code included |
| Log or trace the outgoing request | last | only the last interceptor holds the clone that reaches the backend |
| Cache, mock, or serve offline | last | it short-circuits, and a short-circuit deletes everything below it |
| Rewrite the base URL | early | later interceptors that inspect `req.url` should see the resolved one |

## Immutability is why "earlier" and "later" are not symmetric

`HttpRequest` is immutable: an interceptor cannot change the request in place, only build a clone and
pass it to `next`. So the flow of *request* information is strictly one-way — a header added at index
3 is invisible to indices 0–2, permanently, with no callback that would let them find out. The flow of
*response* information is one-way in the other direction. This is why "just move it and see" is a bad
debugging strategy for interceptor order: moving one interceptor changes what it sees on **both**
axes at once.

Two interceptors setting the same header is the case worth knowing precisely. The later clone wins on
the wire, because it is the one handed further down; the earlier interceptor is never told, and there
is no warning:

```ts
export const tenantInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'X-Tenant': inject(TenantStore).id() } }));

export const legacyTenantInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'X-Tenant': 'default' } }));

// ⛔ 'default' wins — it is later in the array, so its clone is the one that reaches the backend
withInterceptors([tenantInterceptor, legacyTenantInterceptor]);
```

Use `setHeaders` to overwrite deliberately and `req.headers.has(...)` to defer to an earlier
interceptor when that is what you meant:

```ts
export const legacyTenantInterceptor: HttpInterceptorFn = (req, next) =>
  req.headers.has('X-Tenant')
    ? next(req)
    : next(req.clone({ setHeaders: { 'X-Tenant': 'default' } }));
```

## Short-circuiting deletes everything below it

The chain is a nest of function calls and `next` is the only edge into the next link. An interceptor
that returns without calling `next(req)` means the interceptors after it — and the backend — are never
reached for that request. That is not a bug; it is how mocking, offline caches and hard rate limits
are built. But it makes position load-bearing in a way nothing warns about:

```ts
// src/app/http/offline-cache.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { OfflineCache } from './offline-cache';

export const offlineCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cache = inject(OfflineCache);
  const hit = cache.get(req.urlWithParams);
  return hit === null ? next(req) : of(new HttpResponse({ body: hit, status: 200 }));
};

// ✅ last: auth, normalisation and logging have all run before the early return
withInterceptors([authInterceptor, normalizeInterceptor, logInterceptor, offlineCacheInterceptor]);

// ⛔ first: a cache hit is never logged, never authenticated, never normalised
withInterceptors([offlineCacheInterceptor, authInterceptor, normalizeInterceptor, logInterceptor]);
```

⚠️ **One thing this page will not tell you: what a `retry()` inside an interceptor re-executes.**
`retry` resubscribes to the observable the interceptor already received from `next(req)`; whether
resubscribing re-invokes the *bodies* of the interceptors after it — and therefore recomputes an
`Authorization` header from a refreshed token — depends on `chainedInterceptorFn`'s internals, which
were not read for this page. Do not assume a retried request picks up a fresh token from a later
interceptor. Read the source before relying on it either way.

## Gotchas

**★ Symptom: your logging interceptor records a request with no `Authorization` header, but the server
received one.** Cause: the logger is early, so it sees the request before every later interceptor
clones it, and `HttpRequest` is immutable so there is no way for it to observe the later clone. Fix:
move the logger to the **end** of the array —

```ts
withInterceptors([authInterceptor, normalizeInterceptor, logInterceptor]);
```

**★ Symptom: your crash reporter records `AppHttpError: 0 Unknown Error` instead of the real status.**
Cause: responses unwind outward, so an interceptor placed *after* the normaliser sees the error only
once the normaliser has replaced it. Fix: put the reporter earlier in the array than the normaliser,
so it sees the `HttpErrorResponse` first —

```ts
withInterceptors([reportErrorsInterceptor, normalizeInterceptor, logInterceptor]);
```

**★ Symptom: cached or mocked responses skip authentication, logging and error handling entirely.**
Cause: the short-circuiting interceptor is first, and returning without calling `next` removes every
interceptor after it from that request. Fix: move it last, as in the block above — everything else has
already run by the time it decides to return early.

**Symptom: two interceptors set the same header and the "wrong" one wins.** Cause: the later clone is
the one handed downstream; `setHeaders` overwrites and nothing warns. Fix: make the deference explicit
with `req.headers.has(...)`, or delete one of the two interceptors — a header written in two places is
a merge waiting to reintroduce the bug.

**Symptom: an interceptor that rewrites `req.url` breaks a later interceptor's URL matching.** Cause:
the rewriter is *after* the matcher in the array, so the matcher tested the original URL. Fix: put URL
rewriting as early as possible, before anything that inspects the URL —

```ts
withInterceptors([baseUrlInterceptor, apiKeyForApiHostsInterceptor, logInterceptor]);
```

**Symptom: moving one interceptor fixes the request side and breaks the response side.** Cause: this
is the shape of the problem, not a mistake — request visibility increases as you move later and
response visibility increases as you move earlier, so one move always trades one for the other. Fix:
split the interceptor into the two halves that wanted different positions, rather than searching for a
position that satisfies both.

## Interview questions

**★ You must log the exact request that leaves the browser and also report domain-level errors. One
interceptor or two, and why?**
Two, and the reason is the nesting. The request a given interceptor receives has been cloned only by
the interceptors *before* it, and the response events it sees have passed only through the
interceptors *after* it. To see the fully decorated outgoing request you must be last; to see errors
before your normalising interceptor converts them you must be earlier than the normaliser. No single
position satisfies both, so the honest design is a wire logger at the end of the array and an error
reporter near the front. Anyone answering "one interceptor with a `tap`" has not traced the fold.

**★ What happens if an interceptor never calls `next(req)`?**
Everything after it in the array is skipped, and so is the backend — the chain is a nest of calls and
`next` is the only edge into the next link. That is how mocking, offline caches and hard rate limits
are implemented. What it turns into a design decision is *position*: a short-circuiting interceptor
placed first disables every other interceptor for the requests it handles, including XSRF and auth,
while one placed last leaves all of them intact and replaces only the dispatch. The second is almost
always what was meant.

**Two interceptors both clone the request. Which clone reaches the server, and what does each
interceptor see?**
The last clone reaches the server, because each interceptor passes its clone as the argument to
`next`, and `HttpRequest` is immutable so nothing is mutated in place. Each interceptor sees only the
clone produced by the interceptors before it; it can never observe a header a later one will add.
That asymmetry is precisely why a logger has to be last to be truthful, and why two interceptors
writing the same header is a silent last-writer-wins with no diagnostic.

**Where would you put a caching interceptor, and what does the answer depend on?**
Last, in almost every application, because it short-circuits: from the last position a cache hit has
still passed through authentication, error normalisation and logging, so the observable your service
receives is indistinguishable in shape from a real response and your telemetry still sees the request.
It moves earlier only when the point is to *avoid* the work the earlier interceptors do — a test
harness that must not touch the auth store, for instance. That is the whole trade: earlier means
cheaper and less faithful, later means fully decorated and fully observed.

---

← Prev: [Interceptor order](10-http-features.md) · Index: [Topic index](README.md) · Next → [The interceptor chain internals](10c-the-interceptor-chain-internals.md)
