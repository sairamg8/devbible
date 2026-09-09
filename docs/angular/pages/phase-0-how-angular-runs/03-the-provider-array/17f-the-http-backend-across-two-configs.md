---
title: "Which HTTP backend an SSR application ends up with is decided by the position of two provider records, and the framework will tell you when you got it wrong — but only in dev mode, only during an actual server request, and only as a warning"
sidebar_label: "17f · The HTTP backend across two configs"
sidebar_position: 17.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup) — and `angular/angular` at tag
> `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`common/http/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/errors.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) at `v22.0.0`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[09c](09c-the-fetch-default-and-withfetch.md) proposes keeping `withXhr()` in the browser config
and letting the server config override it, and says to verify the resulting backend rather than
assuming the ordering. This page does the verification. It works, the mechanism is two provider
records for one non-multi token, and the second `provideHttpClient()` call costs less than it looks
like it should.**

It also has a real safety margin: `withXhr()` on the server is deprecated for security reasons and
the framework emits a runtime warning when a server render uses a non-`fetch` backend. That warning
is the check — its absence is the evidence that the override landed.

## What each call binds

`provideHttpClient()` sets up the backend with a factory, from
[`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts):

```ts
  const providers: Provider[] = [
    HttpClient,
    FetchBackend,
    HttpInterceptorHandler,
    {provide: HttpHandler, useExisting: HttpInterceptorHandler},
    {
      provide: HttpBackend,
      useFactory: () => {
        return inject(FetchBackend);
      },
    },
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useValue: xsrfInterceptorFn,
      multi: true,
    },
  ];

  for (const feature of features) {
    providers.push(...feature.ɵproviders);
  }
```

`withXhr()` contributes a competing record for the same token, pushed by that loop **after** the
default, so within one call the feature wins. [09b](09b-inside-provide-http-client.md) reads the whole
body; the two facts that matter here are that `HttpBackend` is **non-multi**, and that both the
default and the override are ordinary provider records subject to the ordinary last-wins rule.

## The two-config pattern, verified

```ts
// src/app/app.config.ts — shared. Upload progress needs XHR, so the browser keeps it.
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
  ],
};

// src/app/app.config.server.ts — a second call whose only job is to put fetch back.
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

Read the flattened array the server injector receives. `HttpBackend` is written three times: the
first call's `useFactory` (fetch), then `withXhr()`'s override, then the second call's `useFactory`
(fetch again). Non-multi, so the last one wins — **the server resolves `HttpBackend` to
`FetchBackend`, and the browser, which never sees `serverConfig`, resolves it to the XHR backend.**
That is the outcome [09c](09c-the-fetch-default-and-withfetch.md) wanted and it is decided entirely
by position.

⚠️ **The server call needs no features at all.** 09c's example repeats
`withInterceptors([authInterceptor])`; that is harmless when both files import the same function
reference — [17b](17b-what-the-merge-does-not-do.md) has the `Set` de-duplication that makes it so —
but it is redundant, because interceptors are a multi token and the browser config's registration is
already in the concatenated array. A bare `provideHttpClient()` says exactly what you mean: restore
the default backend, change nothing else.

## What the second call actually costs

Re-registering the whole `provideHttpClient` provider set sounds expensive. Entry by entry, it is not:

| Record | Kind | Effect of the second registration |
|---|---|---|
| `HttpClient`, `FetchBackend`, `HttpInterceptorHandler` | class, non-multi | same class token, same class — last wins, no observable difference |
| `{provide: HttpHandler, useExisting: HttpInterceptorHandler}` | non-multi | identical record, replaced by itself |
| `{provide: HttpBackend, useFactory: …}` | non-multi | **the point of the exercise** — fetch wins |
| `{provide: HTTP_INTERCEPTOR_FNS, useValue: xsrfInterceptorFn, multi: true}` | **multi** | appended a second time, then collapsed by `Array.from(new Set(...))` because it is one module-level function reference |

The only entry that would genuinely double is a feature you repeat with a **new** function
reference — an inline arrow in `withInterceptors`, most commonly. Import the interceptor and the
problem does not exist.

## The warning that verifies it

Angular checks this itself. From
[`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
the guard fires when a server render has a backend that is not a `FetchBackend`:

```ts
      if (
        typeof ngServerMode !== 'undefined' &&
        ngServerMode &&
        !(this.backend instanceof FetchBackend) &&
        !isTestingBackend
      ) {
```

with the message, verbatim:

> *"Angular detected that `HttpClient` is not configured to use `fetch` APIs. It's strongly recommended to enable `fetch` for applications that use Server-Side Rendering for better performance and compatibility. To enable `fetch`, remove the `withXhr()` feature from the `provideHttpClient()` call"*

The code is `NOT_USING_FETCH_BACKEND_IN_SSR = 2801`. It is **positive**, so by the framework's error
formatting it carries no guide page and no `Find more at …` suffix — it renders as **`NG2801`**.

🔴 **Read the guard's conditions before you rely on the warning.** It requires `ngServerMode`, so a
browser build never emits it. It is skipped when the testing backend is installed — the source
comment explains why, verbatim: *"This flag is necessary because provideHttpClientTesting() overrides
the backend even if `withFetch()` is used within the test."* And it fires on a **request**, not at
bootstrap, so a server render that issues no HTTP call says nothing at all. It is a good negative
signal and a poor positive one: seeing NG2801 proves the override failed; not seeing it proves less
than you would like.

## Why this matters more than performance

`withXhr()` on the server is deprecated on **security** grounds. angular.dev's setup guide states it
verbatim:

> *"XHR support on the server is **deprecated** and is intended to be removed in Angular 23. The underlying `xhr2` library does not safely handle redirects: it can forward `Authorization` headers on cross-origin redirects and is susceptible to denial-of-service (DoS) via redirect loops. For SSR applications, use the default `fetch` backend instead."*

Header forwarding on a cross-origin redirect is a credential-leak class of bug, and a redirect loop
on a rendering server is an availability one. [09d](09d-withxhr-on-the-server-and-httpclientmodule.md)
covers the deprecation in full. This is why the split config is worth the extra file rather than
being a tidiness preference.

## The simpler answer: do not split at all

Since v22 the default `HttpBackend` **is** `FetchBackend`, and `HttpClient` is root-provided, so
`withXhr()` is the only reason this page exists. The v22.0.0 CHANGELOG names the one capability that
justifies it:

> *"Use the `HttpXhrBackend` with `provideHttpClient(withXhr)` if you want to keep supporting upload progress reports."*

If you cannot name the XHR-only capability you depend on — upload progress is the one — then delete
`withXhr()` from the shared config and delete the second `provideHttpClient()` call with it. The
best version of this configuration is the one that does not need an override.

⚠️ Note also that `ng update` to v22 may have added `withXhr()` for you: v22.0.0 shipped a schematic
*"to migrate `provideHttpClient` to keep using the `HttpXhrBackend` implementation"*, which preserves
v21 behaviour and is the wrong default for an SSR application.
[09c](09c-the-fetch-default-and-withfetch.md) covers that migration.

## Gotchas

**★ Symptom: `NG2801` during a server render — "Angular detected that `HttpClient` is not configured
to use `fetch` APIs".** Cause: the server injector resolved `HttpBackend` to the XHR backend, so
either `withXhr()` is in the shared config with no override, or the override is in the wrong file, or
the merge arguments are reversed and the browser config is last. Fix: a bare `provideHttpClient()` in
`app.config.server.ts`, and check the merge order is `mergeApplicationConfig(appConfig, serverConfig)`.

**★ Symptom: no `NG2801`, and you conclude the backend is correct.** Cause: the warning fires on a
request under `ngServerMode`, in dev mode, with no testing backend installed. A server render that
makes no HTTP call is silent, and so is a production build. Fix: exercise a route that actually
fetches during a development server render before treating the silence as evidence.

**★ Symptom: the override works locally and the deployed server still uses XHR.** Cause: the
deployment bootstraps a different entry point — a hand-written server file, or a config assembled
without merging `appConfig` — so the array you reasoned about is not the array that ran. Fix: confirm
which module the server build's entry point imports; the reasoning on this page only holds for the
merged config.

**★ Symptom: the auth interceptor runs twice on the server after adding the second
`provideHttpClient()` call.** Cause: the server call repeats `withInterceptors([...])` with a
different function reference — typically an inline arrow — so `Array.from(new Set(...))` cannot
collapse it. Fix: the server call needs no features:

```ts
// ⛔ a second registration the Set cannot deduplicate
provideHttpClient(withInterceptors([(req, next) => authInterceptor(req, next)]))

// ✅ restore the backend, change nothing else
provideHttpClient()
```

**★ Symptom: upload progress events stop arriving after moving to fetch everywhere.** Cause: fetch
does not produce upload progress; that is the documented XHR-only capability and the reason `withXhr`
survived its own deprecation. Fix: keep `withXhr()` in the browser config, override it on the server
as this page describes — and do not move the `withXhr()` call to the server config to "fix" a server
warning, which trades a warning for a security deprecation.

**★ Symptom: you put `withFetch()` in the server config to be explicit and a reviewer flagged it.**
Cause: `withFetch` is deprecated in v22 — *"`withFetch` is not required anymore. `FetchBackend` is
the default `HttpBackend`."* It still works, and combining it with `withXhr()` is not an error (they
are two overrides; last wins), but it reads as though it is doing something the default does not.
Fix: a bare `provideHttpClient()` expresses the same intent without the deprecated call.

**Symptom: `provideHttpClientTesting()` in a server-side test and the warning never appears.** Cause:
deliberate — the guard skips the testing backend, and the source comment says why: producing the
warning would be misleading when no HTTP call is actually performed. Fix: none. Do not use the
warning's absence in a test as evidence about production configuration.

## Interview questions

**★ An SSR app has `withXhr()` in `app.config.ts`. What does the server end up using, and how would
you find out without running it?**
Read the flattened array. `HttpBackend` is non-multi, so whichever record is last wins, and the
merged array is `appConfig.providers` followed by `serverConfig.providers`. With `withXhr()` in the
shared config and nothing in the server config, the last record is the XHR override and the server
uses XHR — which is deprecated on the server for security reasons and produces `NG2801` in dev mode
on the first request. Adding a bare `provideHttpClient()` to the server config appends a fresh
`{provide: HttpBackend, useFactory: () => inject(FetchBackend)}` after it, and the server is back on
fetch.

**★ Is calling `provideHttpClient()` twice expensive or dangerous?**
Neither, in this shape. Everything it registers except one entry is non-multi — the client, the
backends, the handler, the `HttpHandler` alias — so a second registration replaces identical records
with identical records. The one multi entry is the XSRF interceptor, and because `xsrfInterceptorFn`
is a single module-level function reference, `HttpInterceptorHandler`'s `Array.from(new Set(...))`
collapses the duplicate. The danger is only in the features you pass to the second call: repeat
`withInterceptors` with a fresh arrow and that interceptor genuinely runs twice.

**★ Why is `withXhr()` on the server a security question rather than a performance one?**
Because of what `xhr2` does with redirects. The documentation is explicit that it *"can forward
`Authorization` headers on cross-origin redirects and is susceptible to denial-of-service (DoS) via
redirect loops"*, and that support is intended for removal in Angular 23. On a rendering server those
two are credential leakage and availability respectively, both triggered by a response you do not
control. Performance is the sentence the warning leads with; it is not the reason the API is being
removed.

**How reliable is `NG2801` as a verification that your backend configuration is right?**
As a negative signal it is conclusive — if it fires, the server is not on fetch. As a positive signal
it is weak, because three separate conditions must hold before it can appear: `ngServerMode`, an
actual HTTP request during the render, and no testing backend installed. Production builds suppress
the message text entirely. So "I did not see NG2801" is worth something only if you know a request
was issued during a development server render.

← Prev: [What belongs in which config](17e-what-belongs-in-which-config.md) · Index: [Topic index](README.md) · Next → **Topic 04 · `ng update`, not `npm install`** *(not written yet)*
