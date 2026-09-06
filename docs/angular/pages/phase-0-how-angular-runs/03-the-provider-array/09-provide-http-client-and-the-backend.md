---
title: "`provideHttpClient()` is no longer how you get an `HttpClient` — since v21 the client, the handler and the backend are all `providedIn: 'root'`, so the call buys configuration and nothing else"
sidebar_label: "09 · `HttpClient` without the call"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); and
> `angular/angular` at tag `v22.1.5`:
> [`common/http/src/client.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/client.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Almost every tutorial still opens the HTTP chapter with "add `provideHttpClient()` to your
providers array or `HttpClient` will not inject". That has been false since v21.** In v22
`HttpClient`, `HttpHandler`, `HttpInterceptorHandler` and `HttpBackend` are all
`@Injectable({providedIn: 'root'})`, the default `HttpBackend` is `FetchBackend`, and the XSRF
interceptor arrives from a token whose *default factory* already contains it. So
`inject(HttpClient)` works against a completely empty `app.config.ts`, on `fetch`, with XSRF
protection on. What `provideHttpClient()` buys you now is **configuration** — interceptor
registration, XSRF customisation, a backend swap, delegation to a parent injector — and availability
is no longer on that list. This chunk is that inversion and what it changes about how HTTP
misconfiguration fails: loudly at compile time before, silently at runtime now.

## `HttpClient` is root-provided, and the whole stack under it is too

angular.dev's setup guide opens with the sentence, and it is the first line of the page:

> *"`HttpClient` is available for injection by default in Angular v21 and later."*

The source says the same thing four times over. From
[`client.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/client.ts):

```ts
@Injectable({providedIn: 'root'})
export class HttpClient {
```

and from [`backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
the three declarations that complete the chain:

```ts
@Injectable({providedIn: 'root', useExisting: FetchBackend})
export abstract class HttpBackend implements HttpHandler {

@Injectable({providedIn: 'root'})
export class HttpInterceptorHandler implements HttpHandler {

@Injectable({providedIn: 'root', useExisting: HttpInterceptorHandler})
export abstract class HttpHandler {
```

`HttpClient` injects `HttpHandler`; `HttpHandler` resolves via `useExisting` to
`HttpInterceptorHandler`; `HttpInterceptorHandler` injects `HttpBackend`; `HttpBackend` resolves via
`useExisting` to `FetchBackend`. Four tokens, four tree-shakable `providedIn: 'root'` declarations,
no provider array involved. (The `useExisting` mechanism itself and how `providedIn: 'root'`
compares to an entry in the array is **14 · `providedIn: 'root'` vs the array** *(not written
yet)*; the injector walk is **Phase 6** *(not written yet)*.)

And XSRF is not left out either. From
[`interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts):

```ts
/**
 * A multi-provided token of `HttpInterceptorFn`s.
 */
export const HTTP_INTERCEPTOR_FNS = new InjectionToken<readonly HttpInterceptorFn[]>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'HTTP_INTERCEPTOR_FNS' : '',
  {factory: () => [xsrfInterceptorFn]},
);
```

🔴 **The token's default factory returns an array that already contains `xsrfInterceptorFn`.** So an
application that never mentions HTTP in its config still has `xsrfInterceptorFn` in its chain. This
is a working v22 application:

```ts
// app.config.ts — no HTTP providers at all
import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
```

```ts
// invoice.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Invoice {
  id: string;
  totalCents: number;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);

  list(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>('/api/invoices');
  }
}
```

That runs. On `fetch`. With the XSRF interceptor in the chain. **Nothing was provided.**

## So what does the call still buy?

Four kinds of decision, spread across seven feature functions:

| What you want | The feature | Available without `provideHttpClient()`? |
|---|---|---|
| Your own interceptors, functional | `withInterceptors([...])` | ❌ nothing registers them |
| Your own interceptors, class-based / DI | `withInterceptorsFromDi()` | ❌ |
| A different XSRF cookie or header name | `withXsrfConfiguration({...})` | ❌ defaults only |
| XSRF off entirely | `withNoXsrfProtection()` | ❌ it is on by default |
| `XMLHttpRequest` instead of `fetch` | `withXhr()` | ❌ `fetch` is the default |
| JSONP | `withJsonpSupport()` | ❌ — and deprecated, see [10 · Interceptor order](10-http-features.md) |
| Requests routed through the parent injector's chain | `withRequestsMadeViaParent()` | ❌ |

**Availability is not on that list any more**, and that is the whole shift. Every remaining reason
to call `provideHttpClient()` is a decision you are making, not a dependency you are satisfying. The
features themselves are [10 · Interceptor order](10-http-features.md); the function
that hosts them is [09b](09b-inside-provide-http-client.md), and the backend it picks is
[09c](09c-the-fetch-default-and-withfetch.md) and
[09d](09d-withxhr-on-the-server-and-httpclientmodule.md).

## Gotchas

**★ Symptom: `inject(HttpClient)` works fine, requests go out, and your interceptor never runs.**
Cause: v22 root-provides the whole client stack, so the *client* works without any configuration —
but nothing registers an interceptor unless a feature does. There is no error, no warning, and no
symptom other than a missing header. Fix: the call is still required, just for a different reason
than you were taught:

```ts
// auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStore } from './token-store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenStore).accessToken();
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```

```ts
// app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { authInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
};
```

**Symptom: an XSRF token header appears on your requests and you never called
`provideHttpClient()`.** Cause: `HTTP_INTERCEPTOR_FNS` declares
`{factory: () => [xsrfInterceptorFn]}`, so the *default value of the token* already includes XSRF.
It is on unless something turns it off. Fix: if you genuinely need it off — a cross-origin API that
rejects unknown headers, say — you have to opt out explicitly, which means calling the function you
were avoiding:

```ts
providers: [provideHttpClient(withNoXsrfProtection())],
```

## Interview questions

**★ In v22, `HttpClient` is `providedIn: 'root'`. So what does `provideHttpClient()` still buy you?**
Four things, and availability is not one of them: interceptor registration (functional via
`withInterceptors`, class-based via `withInterceptorsFromDi`), XSRF customisation or opt-out, a
backend swap to `XMLHttpRequest`, and delegation of requests to a parent injector's handler chain.
Everything else — the client, the handler, the interceptor handler, the `fetch` backend, and XSRF
protection with default cookie and header names — arrives from `providedIn: 'root'` declarations
and a token default factory, with an empty providers array. The practical consequence is that "my
`HttpClient` does not inject" is no longer a real failure mode, and "my interceptor never runs" is,
because the first one now fails loudly at compile time and the second one fails silently at runtime.

**A colleague adds `provideHttpClient()` with no features "so that `HttpClient` is available". Is
that harmless?**
It is not free. It re-provides `HttpClient`, `FetchBackend`, `HttpInterceptorHandler`, `HttpHandler`
and `HttpBackend` as explicit records in the environment injector, and adds a second
`xsrfInterceptorFn` entry on top of the token's default factory. Nothing breaks — the duplicate
interceptor is de-duplicated by reference in `HttpInterceptorHandler.handle`'s
`Array.from(new Set([...]))`, and the re-provided classes are the same classes. But it is a line
that states an intention it does not have, and it will be read by the next person as "this app
configures HTTP", sending them looking for the configuration. Worse, it makes the *actual* rule
invisible: someone will later delete it as redundant, discover nothing broke, and conclude that
`provideHttpClient()` is always optional — right up until an interceptor is added.

---

← Prev: [Tracing and the experimental end](08g-tracing-and-the-experimental-end.md) · Index: [Topic index](README.md) · Next → [Inside `provideHttpClient()`](09b-inside-provide-http-client.md)
