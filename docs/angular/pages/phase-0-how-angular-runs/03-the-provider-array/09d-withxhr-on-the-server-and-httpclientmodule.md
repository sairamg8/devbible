---
title: "`withXhr()` is the live opt-out and it is deprecated on the server for a credential leak and a DoS — Angular warns once per process with `NG02801`, and nine `fetch`-only request options each get their own error code the moment you take it"
sidebar_label: "09d · `withXhr()` on the server"
sidebar_position: 9.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); and
> `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`common/http/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/errors.ts),
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`withXhr()` is the one supported way back to `XMLHttpRequest`, it is not deprecated, and it carries
a `CRITICAL` alert in its own JSDoc that almost no write-up quotes: on the server, `xhr2` forwards
`Authorization` headers across cross-origin redirects and is susceptible to denial-of-service via
redirect loops, so XHR support there is deprecated with a stated intent to remove it in Angular 23.**
Angular warns about it at runtime with `NG02801` — a code you have to derive, because it is not on
any error page — and the warning fires exactly once per server process, which makes its absence
worthless as evidence. Underneath that sits a quieter cost: nine `fetch`-only request options that
each have their own error code the moment the XHR backend is active. This chunk is the alert, the
warning, and the enumerated trade.

## `withXhr()` is the live opt-out, and it is deprecated on the server for a real vulnerability

`withXhr()` is not deprecated — it is the one supported way back to `XMLHttpRequest`, and upload
progress is the reason it still exists. But its own JSDoc carries a `CRITICAL` alert most write-ups
never mention. Verbatim, from `provider.ts`:

```text
 * <div class="docs-alert docs-alert-critical">
 *
 * Do not use {@link withXhr} in server-side rendering (SSR) environments. XHR support on the
 * server is **deprecated** and is intended to be removed in Angular 23 because the underlying `xhr2`
 * library does not safely handle redirects (e.g. it can forward `Authorization` headers on
 * cross-origin redirects and is susceptible to denial-of-service via redirect loops).
 *
 * </div>
```

and the same statement on angular.dev's setup guide:

> *"XHR support on the server is **deprecated** and is intended to be removed in Angular 23. The underlying `xhr2` library does not safely handle redirects: it can forward `Authorization` headers on cross-origin redirects and is susceptible to denial-of-service (DoS) via redirect loops. For SSR applications, use the default `fetch` backend instead."*

Read that as two separate findings and not one. **Forwarding `Authorization` headers across a
cross-origin redirect is credential leakage** — an attacker who can influence a redirect target gets
your server's bearer token. **Redirect loops are a DoS** on the rendering process, which in SSR is a
shared server, not one user's tab. Both statements are scoped by Angular to the *server*, and the
named cause is `xhr2` — the Node shim that stands in for `XMLHttpRequest` there. The documentation
makes no equivalent claim about `withXhr()` in the browser, and neither does this page.

### The runtime warning: `NG02801`

Angular checks for this at runtime, in `backend.ts`:

```ts
      if (
        typeof ngServerMode !== 'undefined' &&
        ngServerMode &&
        !(this.backend instanceof FetchBackend) &&
        !isTestingBackend
      ) {
        fetchBackendWarningDisplayed = true;
        injector
          .get(Console)
          .warn(
            formatRuntimeError(
              RuntimeErrorCode.NOT_USING_FETCH_BACKEND_IN_SSR,
              'Angular detected that `HttpClient` is not configured ' +
                "to use `fetch` APIs. It's strongly recommended to " +
                'enable `fetch` for applications that use Server-Side Rendering ' +
                'for better performance and compatibility. ' +
                'To enable `fetch`, remove the `withXhr()` feature from the `provideHttpClient()` call',
            ),
          );
      }
```

The code renders as **`NG02801`**. That is a derivation from two verbatim sources, not a number
copied off a doc page — so here are both. `common/http`'s error enum, whose header comment reserves
the range `2800-2899`:

```ts
export const enum RuntimeErrorCode {
  MISSING_JSONP_MODULE = -2800,
  NOT_USING_FETCH_BACKEND_IN_SSR = 2801,
```

and core's formatter, which prepends a `0` to every non-compile-time code:

```ts
export function formatRuntimeErrorCode<T extends number = RuntimeErrorCode>(code: T): string {
  return `NG0${Math.abs(code)}`;
}
```

`NG0` + `2801` = `NG02801`. The code is **positive**, which in this scheme means there is no
`angular.dev/errors` guide page for it and no `Find more at …` suffix
([`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts) — a negative
code is the marker for "has a guide page"). Search for the message, not the number.

Two properties of that check that bite in practice. `fetchBackendWarningDisplayed` is a
**module-level `let`**, so the warning fires once per server process — a second application
instance rendering on the same Node worker gets nothing. And the `isTestingBackend` guard exists for
a stated reason; the comment above it, verbatim:

> *"This flag is necessary because provideHttpClientTesting() overrides the backend even if `withFetch()` is used within the test. When the testing HTTP backend is provided, no HTTP calls are actually performed during the test, so producing a warning would be misleading."*

### What `XMLHttpRequest` cannot do, enumerated by error code

`common/http`'s error enum at `v22.1.5` is the cleanest available inventory of what you give up by
choosing `withXhr()`. **Nine of its codes are named `*_NOT_SUPPORTED_WITH_XHR`** — one per
`fetch`-only request option — sitting in a contiguous block alongside two related codes that are not
about XHR support at all:

```ts
  KEEPALIVE_NOT_SUPPORTED_WITH_XHR = 2813,
  CACHE_NOT_SUPPORTED_WITH_XHR = 2814,
  PRIORITY_NOT_SUPPORTED_WITH_XHR = 2815,
  MODE_NOT_SUPPORTED_WITH_XHR = 2816,
  REDIRECT_NOT_SUPPORTED_WITH_XHR = 2817,
  CREDENTIALS_NOT_SUPPORTED_WITH_XHR = 2818,
  WITH_CREDENTIALS_OVERRIDES_EXPLICIT_CREDENTIALS = 2819,
  INTEGRITY_NOT_SUPPORTED_WITH_XHR = 2820,
  REFERRER_NOT_SUPPORTED_WITH_XHR = 2821,
  INVALID_TIMEOUT_VALUE = 2822,
  REFERRER_POLICY_NOT_SUPPORTED_WITH_XHR = 2823,

  FETCH_UPLOAD_PROGRESS_NOT_SUPPORTED = 2824,
```

⚠️ **The enum was read; the throw sites were not**, so this page does not quote any of those
messages or state precisely when each fires. What the enum settles on its own is the shape of the
trade: the `fetch` backend is where `keepalive`, `cache`, `priority`, `mode`, `redirect`,
`credentials`, `integrity`, `referrer` and `referrerPolicy` live, and
`FETCH_UPLOAD_PROGRESS_NOT_SUPPORTED = 2824` is the mirror-image code on the other side — the one
thing XHR has that `fetch` does not. Choosing a backend is choosing which of those two error
families your application can hit. Note also `WITH_CREDENTIALS_OVERRIDES_EXPLICIT_CREDENTIALS = 2819`
and `INVALID_TIMEOUT_VALUE = 2822` in the same block: neighbours in the range, not part of the nine.

## Gotchas

**Symptom: your SSR logs show the "not configured to use `fetch`" warning once and never again,
including after you thought you had fixed it.** Cause: `fetchBackendWarningDisplayed` is a
module-level `let`, set on the first occurrence, and a Node process serves many renders. Absence of
the warning on subsequent requests is not evidence of a fix. Fix: assert the backend directly rather
than reading logs:

```ts
import { FetchBackend, HttpBackend } from '@angular/common/http';
import { provideEnvironmentInitializer, inject } from '@angular/core';

provideEnvironmentInitializer(() => {
  if (!(inject(HttpBackend) instanceof FetchBackend)) {
    throw new Error('This deployment must run on the fetch backend.');
  }
}),
```

**★ Symptom: a request that sets `keepalive`, `cache`, `priority`, `mode`, `redirect`, `credentials`,
`integrity`, `referrer` or `referrerPolicy` fails with an `NG028xx` error.** Cause: those are the
nine `fetch`-only request options, and the application is on the XHR backend — `common/http`'s error
enum reserves a separate `*_NOT_SUPPORTED_WITH_XHR` code for each, from
`KEEPALIVE_NOT_SUPPORTED_WITH_XHR = 2813` to `REFERRER_POLICY_NOT_SUPPORTED_WITH_XHR = 2823`, which
core's formatter renders as `NG02813` through `NG02823`. Somebody added `withXhr()` for upload progress, or
`ng update` did, or an `HttpClientModule` import is still present. Fix: remove the XHR override, or
stop using the option — you cannot have both. The fastest way to find out which of the three put you
there is to assert the backend at startup:

```ts
import { FetchBackend, HttpBackend } from '@angular/common/http';
import { provideEnvironmentInitializer, inject } from '@angular/core';

provideEnvironmentInitializer(() => {
  const backend = inject(HttpBackend);
  if (!(backend instanceof FetchBackend)) {
    throw new Error(`Expected FetchBackend, got ${backend.constructor.name}`);
  }
}),
```

⚠️ The error enum was read; the throw sites were not. This page does not state the exact message
text or the precise condition under which each of the nine fires — only that a dedicated code exists
for each option.

## Interview questions

**★ How would you determine, without reading the config, which backend a running application is
using?**
Inject `HttpBackend` and test it: `inject(HttpBackend) instanceof FetchBackend`. That is the same
test Angular itself performs in `backend.ts` before emitting the `NG02801` warning, and it is
reliable because the whole backend decision reduces to which provider record won for the
`HttpBackend` token. In a server build there is also the warning itself — but only once per process,
because `fetchBackendWarningDisplayed` is a module-level `let`, so its absence proves nothing. The
assertion is what you want in a startup check; the log line is a hint.

**Why does the SSR fetch warning suppress itself when a testing backend is present, and what does
that tell you about warnings in general?**
The comment in the source states it: `provideHttpClientTesting()` overrides the backend even when
`withFetch()` was used, no HTTP calls actually happen during the test, so warning about the backend
*"would be misleading."* The general point is that a warning whose condition is "your configuration
looks wrong" has to exclude the configurations that are deliberately not real. Otherwise it trains
people to ignore it — which is worse than not having it, because the one time it fires against a
genuine production misconfiguration it looks like the noise everybody learned to skip. The
`isTestingBackend` guard costs one boolean and preserves the signal.

**The `CRITICAL` alert names two separate problems. Which one would you lead with in a report, and
why does the distinction matter?**
Lead with the credential leak, because its blast radius is not your application. Angular's wording is
that `xhr2` *"can forward `Authorization` headers on cross-origin redirects"* — so an attacker who
can influence where one of your server-side requests redirects to receives whatever token that
request was carrying, and on a rendering server that token is usually a service credential rather
than one end user's. The DoS is the second finding: *"susceptible to denial-of-service via redirect
loops"* takes down the render process, which is shared, but it is noisy, recoverable and visible in
monitoring. A leaked service credential is none of those things. Both are reasons to be on `fetch`;
only one of them is a reason to page someone tonight.

---

← Prev: [The `fetch` default and `withFetch()`](09c-the-fetch-default-and-withfetch.md) · Index: [Topic index](README.md) · Next → [`HttpClientModule`, the end of the road](09e-httpclientmodule-end-of-the-road.md)
