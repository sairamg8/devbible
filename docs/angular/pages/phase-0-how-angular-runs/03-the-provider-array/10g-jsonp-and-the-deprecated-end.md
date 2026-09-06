---
title: "`withJsonpSupport()` was deprecated in 22.1 for a security reason stated in its own tag, angular.dev still documents it neutrally, and the source wins — plus the third way the framework registers an interceptor, which is the one that needs no trick at all"
sidebar_label: "10g · JSONP, and the deprecated end"
sidebar_position: 10.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); and `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`goldens/public-api/common/http/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/common/http/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`withJsonpSupport()` is the last HTTP feature and the only one deprecated for a security reason
rather than an ergonomic one — the `@deprecated` tag names XSS explicitly and states an intent to
remove.** It is also a small, clean case study in two things this topic keeps returning to: a
documentation page that has not caught up with its own source, and the third of the framework's three
ways of getting a function into `HTTP_INTERCEPTOR_FNS` — the one that needs no intermediate token
because the value is already a stable module-level reference.

## The body, and the tag

```ts
/**
 * Add JSONP support to the configuration of the current `HttpClient` instance.
 *
 * @see {@link provideHttpClient}
 * @deprecated 22.1 JSONP is deprecated as it can cause XSS vulnerabilities. Use standard HTTP requests instead. Intent to remove in future versions of Angular.
 */
export function withJsonpSupport(): HttpFeature<HttpFeatureKind.JsonpSupport> {
  return makeHttpFeature(HttpFeatureKind.JsonpSupport, [
    JsonpClientBackend,
    {provide: JsonpCallbackContext, useFactory: jsonpCallbackContext},
    {provide: HTTP_INTERCEPTOR_FNS, useValue: jsonpInterceptorFn, multi: true},
  ]);
}
```

The public-API golden agrees, marking the entry `// @public @deprecated` — one of the few places in
this topic where the golden and the JSDoc say the same thing, and a reminder that the golden's
`// @public` alone is API-Extractor's release tag, never a stability promise
([08g](08g-tracing-and-the-experimental-end.md)).

The deprecation reason is stated in the tag itself and is unusually blunt for Angular: *"JSONP is
deprecated as it can cause XSS vulnerabilities."* JSONP works by injecting a `script` element whose
response is executed as code in your origin, so the remote server is trusted to run arbitrary
JavaScript in your application. The named replacement is *"standard HTTP requests"*, which in practice
means a CORS-enabled endpoint.

⚠️ **angular.dev's setup guide has not caught up.** At the time of writing it still documents the
feature neutrally, with only a soft preference note:

> *"HELPFUL: Prefer using [CORS] … instead of JSONP when possible."*

🔴 **The source tag wins.** A deprecation lives in the code and in the golden; a guide page is
generated on a different cadence. When the two disagree, cite the tag and the version it names — here,
`@deprecated 22.1` — because that is what the compiler, the editor and the eventual removal will act
on. This exact mismatch is why "the docs still show it" is not an argument in a code review.

## Three ways into `HTTP_INTERCEPTOR_FNS`, and why they differ

The three registrations across the HTTP package are worth lining up, because the differences are
entirely about **reference stability**, which is what the chain's `Set` de-duplicates on
([10c](10c-the-interceptor-chain-internals.md)):

| Registration | Shape | Stable reference? |
|---|---|---|
| `xsrfInterceptorFn`, in `provideHttpClient`'s base list | `useValue` of a module-level function | yes, inherently — one module, one binding |
| `jsonpInterceptorFn`, in `withJsonpSupport()` | `useValue` of a module-level function | yes, inherently |
| your functions, via `withInterceptors([...])` | `useValue` of whatever you passed | **only as stable as you made it** — an inline arrow is a new object per call |
| the legacy block, via `withInterceptorsFromDi()` | `useExisting` through a non-multi token | yes, but only because of the indirection ([10d](10d-the-two-interceptor-systems.md)) |

So `withJsonpSupport()` included twice in one injector registers the identical function twice and the
`Set` collapses it — no trick required. `withInterceptorsFromDi()` needed `LEGACY_INTERCEPTOR_FN`
precisely because its value comes from a factory rather than a module binding. And a user interceptor
falls into whichever camp the author put it in, which is the entire content of the "my interceptor runs
twice" bug.

## Its position in the chain is not "last"

`withJsonpSupport()` contributes one entry to the same multi array as everything else, so it lands
**wherever the feature sits in the argument list** — the ordering rule from [10](10-http-features.md),
applied once more:

```ts
provideHttpClient(
  withInterceptors([authInterceptor]),   // 1
  withJsonpSupport(),                     // 2 — after auth, before the logger
  withInterceptors([logInterceptor]),     // 3
),
```

Written in the conventional order — features first, `withInterceptors` last — it would run *before*
your interceptors, not after them. Neither is a rule; the argument order is.

The NgModule spelling, `HttpClientJsonpModule`, maps to this feature and is itself deprecated
([02](02-why-provide-functions-replaced-forroot.md)), so an application importing it is carrying two
deprecations at once.

⚠️ **This page does not state what the request-side JSONP API looks like or whether it carries its own
deprecation tag** — only `withJsonpSupport` was read. Check the call sites in your own code and the
`HttpClient` API page before planning a removal.

## Gotchas

**★ Symptom: `withJsonpSupport()` is struck through in your editor after upgrading to 22.1.** Cause:
the `@deprecated 22.1` tag, added for a security reason — JSONP executes the remote response as script
in your origin. Fix: the migration is a server change, not a client one. Enable CORS on the endpoint
and issue an ordinary request, then delete the feature —

```ts
// before
provideHttpClient(withJsonpSupport(), withInterceptors([authInterceptor])),

// after — once the endpoint sends Access-Control-Allow-Origin
provideHttpClient(withInterceptors([authInterceptor])),
```

**★ Symptom: a reviewer says the deprecation is not real because angular.dev still documents the
feature.** Cause: the guide page carries only a soft *"Prefer using [CORS] … instead of JSONP when
possible"* note and has not been updated for the 22.1 tag. Fix: cite the source tag and the golden's
`// @public @deprecated` entry, both of which name the version. Documentation lag is normal; a
`@deprecated` tag with a version on it is the authoritative statement.

**Symptom: removing `withJsonpSupport()` compiles cleanly and then fails at runtime.** Cause: the
feature contributed three providers — `JsonpClientBackend`, a `JsonpCallbackContext` factory and the
interceptor entry — and nothing type-checks the code that depended on them against the provider array.
Fix: remove the feature and the calling code in the same change, and search for JSONP call sites before
deleting the provider rather than after.

**Symptom: you assumed JSONP handling runs last in the chain and put a rewriting interceptor after
it.** Cause: `withJsonpSupport()` contributes one ordinary entry to `HTTP_INTERCEPTOR_FNS`, so its
position is the position of the feature argument — written first, it runs before all your
interceptors. Fix: place the feature argument deliberately relative to your `withInterceptors` calls,
as in the block above.

**Symptom: an application imports `HttpClientJsonpModule` and nobody knows why.** Cause: it is the
NgModule spelling of this feature, and both the module and the feature are now deprecated. Fix: treat
it as two deprecations to retire at once — replace the module with `provideHttpClient(...)`
([02](02-why-provide-functions-replaced-forroot.md)), and treat the JSONP endpoints themselves as the
real migration.

## Interview questions

**★ Why was `withJsonpSupport` deprecated, and what is the replacement?**
Because of what JSONP is, not because of anything Angular did: the tag says *"JSONP is deprecated as it
can cause XSS vulnerabilities. Use standard HTTP requests instead. Intent to remove in future versions
of Angular."* JSONP fetches by injecting a `script` element, so the remote response is executed as code
in your origin — the endpoint gets to run arbitrary JavaScript in your application, and no interceptor
or response type can constrain that. The replacement is an ordinary request against a CORS-enabled
endpoint, which makes the migration a server-side change with a client-side deletion, not a refactor.

**★ angular.dev documents `withJsonpSupport()` without mentioning the deprecation. How do you resolve
that?**
The source wins, and you say why. A `@deprecated` tag is compiled into the type declarations, surfaces
in editors, is mirrored in the public-API golden as `// @public @deprecated`, and carries the version
the deprecation landed in — here `22.1`. A guide page is prose on a separate release cadence and is
routinely behind. The general rule this topic applies throughout is to cite the tag on the symbol,
cross-check the golden as an inventory, and treat guide prose as the weakest of the three. Quoting the
guide as evidence that something is current is exactly the mistake this case is built to catch.

**Where does the JSONP interceptor run relative to your own?**
Wherever `withJsonpSupport()` sits among the arguments to `provideHttpClient()`. It contributes a
single `{provide: HTTP_INTERCEPTOR_FNS, useValue: jsonpInterceptorFn, multi: true}` entry, which the
feature loop appends in argument order like any other, so the conventional "features first, interceptors
last" layout actually puts it *before* everything you wrote. There is no special casing for it — which
is the same answer as for `withInterceptorsFromDi()`, and the reason the argument order of
`provideHttpClient()` is worth reading carefully.

**Why does `withJsonpSupport()` not need the intermediate-token trick that `withInterceptorsFromDi()`
uses?**
Because its value is already a stable reference. `jsonpInterceptorFn` is a module-level function, so
`useValue` hands the identical object to every registration, and the chain's
`Array.from(new Set([...]))` collapses repeats for free. The legacy bridge cannot do that: its function
is produced by a factory, and a factory on a `multi` entry is invoked once per entry, yielding distinct
closures. Hence `LEGACY_INTERCEPTOR_FN` — a non-multi provider that resolves once, with the multi entry
declared `useExisting`. Same de-duplication mechanism, two different problems of reference stability.

---

← Prev: [Requests made via parent](10f-requests-made-via-parent.md) · Index: [Topic index](README.md) · Next → **11 · Hydration, animations and the rest** *(not written yet)*
