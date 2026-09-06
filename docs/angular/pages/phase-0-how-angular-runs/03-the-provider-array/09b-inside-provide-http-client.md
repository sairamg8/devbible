---
title: "Inside `provideHttpClient()` — the XSRF interceptor is pushed before the feature loop so it can never be second, the backend is chosen by provider order, and both of its validations are dev-mode-only plain `Error`s thrown before an injector exists"
sidebar_label: "09b · Inside `provideHttpClient()`"
sidebar_position: 9.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideHttpClient`](https://angular.dev/api/common/http/provideHttpClient); and
> `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideHttpClient` is one of the very few `provide*` functions in Angular that validates its own
arguments, and its forty-line body is the most readable specification of interceptor ordering,
backend selection and feature contradiction in the framework.** Six facts fall straight out of it:
XSRF is registered before the feature loop and is therefore always the first interceptor; the
default backend is a `useFactory`, so a backend swap is provider ordering rather than a runtime
flag; both validations are plain `throw new Error` with no `NGxxxx` code; both fire at *call time*,
before any injector exists; both are inside `if (ngDevMode)` and vanish from a production build; and
the two contradictions it rejects are asymmetric for a principled reason. Read the body once and you
can answer every ordering question about this subsystem without looking anything up.

## The whole function

From [`provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts):

```ts
export function provideHttpClient(
  ...features: HttpFeature<HttpFeatureKind>[]
): EnvironmentProviders {
  if (ngDevMode) {
    const featureKinds = new Set(features.map((f) => f.ɵkind));
    if (
      featureKinds.has(HttpFeatureKind.NoXsrfProtection) &&
      featureKinds.has(HttpFeatureKind.CustomXsrfConfiguration)
    ) {
      throw new Error(
        `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the same call to provideHttpClient(), which is a contradiction.`,
      );
    }

    const hasBackendOverride =
      featureKinds.has(HttpFeatureKind.Fetch) || featureKinds.has(HttpFeatureKind.Xhr);
    if (featureKinds.has(HttpFeatureKind.RequestsMadeViaParent) && hasBackendOverride) {
      throw new Error(
        `Configuration error: withRequestsMadeViaParent() cannot be combined with withFetch() or withXhr() in the same call to provideHttpClient().`,
      );
    }
  }

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

  return makeEnvironmentProviders(providers);
}
```

### Six things readable directly out of that body

**1 · The XSRF interceptor is pushed before the feature loop, so XSRF always runs first.**
`HTTP_INTERCEPTOR_FNS` is `multi: true`, and multi-providers **append** rather than replace
(**13 · Order dependence** *(not written yet)*), so `xsrfInterceptorFn`
occupies index 0 of the array no matter what you pass to `withInterceptors`. This is a security
decision expressed as a line position: no interceptor of yours can run ahead of XSRF and
short-circuit, retry or rewrite a request before the token has been attached.

**2 · The default backend is a `useFactory` that injects `FetchBackend`.** Not `useExisting`, not
`useClass` — a factory. `withXhr()` contributes `HttpBackend` again, pointing at `HttpXhrBackend`,
and since the feature loop pushes *after* the base list, last-wins applies to that non-multi token
and the XHR binding survives. Backend selection is not a flag read at runtime; it is provider
ordering.

**3 · Both validations are plain `throw new Error`, not `RuntimeError`.** There is no `NGxxxx` code
on either. If you search Angular's error reference for these two strings you will find nothing —
they are not in the error catalogue because they never went through `formatRuntimeError`. Quote the
message when you search; there is no code to quote.

**4 · Both throws happen at call time, not injection time.** `provideHttpClient(...)` executes while
the `appConfig` object literal is being constructed — before `bootstrapApplication` is called,
before any injector exists. A contradiction here is a synchronous exception from module evaluation,
which is why it looks like a blank page rather than an Angular error screen.

**5 · Both validations are inside `if (ngDevMode)`, so a production build validates nothing.** The
contradiction is still there; the diagnostic is not. `withNoXsrfProtection()` plus
`withXsrfConfiguration()` in a production bundle silently resolves to whichever set of providers
came last.

**6 · The two contradictions are asymmetric, and the asymmetry is principled.** `withFetch()` and
`withXhr()` in the same call is **not** an error — they are two bindings for one non-multi token and
last-wins is a defined outcome. `withRequestsMadeViaParent()` with either **is** an error, because
delegation and a local backend are two incompatible *meanings* for `HttpBackend`: delegation points
it at the parent injector's `HttpHandler`, which is what makes
`isDelegating = parentHandler !== null && this.backend === parentHandler` true inside
`HttpInterceptorHandler.handle`. Pin a local backend as well and that identity check can never
hold, so the delegation silently does not happen. Last-wins would produce a configuration that
type-checks, runs, and does the opposite of what one of the two features says. That is worth a
throw; two backends is not.

⚠️ **That last reading comes from the `isDelegating` test in `HttpInterceptorHandler.handle`**, not
from `withRequestsMadeViaParent`'s own body, which this page does not reproduce. What is beyond
doubt from `provideHttpClient` alone is that the framework rejects the combination in dev mode.

## `HttpFeatureKind` is a plain enum, and that is not nothing

```ts
export enum HttpFeatureKind {
  Interceptors,
  LegacyInterceptors,
  CustomXsrfConfiguration,
  NoXsrfProtection,
  JsonpSupport,
  RequestsMadeViaParent,
  Fetch,
  Xhr,
}
```

Eight kinds, and `provideHttpClient` reads `f.ɵkind` off each feature to build the `Set` it
validates against. Compare the router: `RouterFeatureKind` is a `const enum` marked internal, and
`provideRouter` validates nothing at all
([08](08-router-features-one-by-one.md)). `HttpFeatureKind` is `@publicApi` and a real runtime
object, which is precisely what lets the HTTP side check combinations that the router side cannot.
The discriminated-record pattern behind both is [chunk 04](04-writing-your-own-provide-function.md).

## Gotchas

**★ Symptom: `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in
the same call to provideHttpClient(), which is a contradiction.`** Cause: exactly what it says, and
it is a plain `throw new Error` inside `if (ngDevMode)` executed while the config object literal is
built — so it surfaces as an uncaught exception during module evaluation, before bootstrap, and
there is no `NGxxxx` code to look up. Fix: decide which you meant. Custom names *are* the
protection; turning it off is a separate choice:

```ts
// wrong
provideHttpClient(
  withXsrfConfiguration({ cookieName: 'CSRF-TOKEN', headerName: 'X-CSRF-TOKEN' }),
  withNoXsrfProtection(),
)

// right — custom names, protection on
provideHttpClient(
  withXsrfConfiguration({ cookieName: 'CSRF-TOKEN', headerName: 'X-CSRF-TOKEN' }),
)
```

**Symptom: `Configuration error: withRequestsMadeViaParent() cannot be combined with withFetch() or
withXhr() in the same call to provideHttpClient().`** Cause: both features bind `HttpBackend`, and
they bind it to incompatible things — delegation points it at the parent injector's `HttpHandler`,
a backend override points it at a local backend. Last-wins would leave you with a configuration
where one of the two features silently did nothing. Fix: the delegating injector configures
delegation only, and the backend decision belongs to the injector that owns the root call:

```ts
// root config — owns the backend decision
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
};

// a route or child injector that wants the parent's chain plus one more interceptor
const reportingRoute: Route = {
  path: 'reporting',
  providers: [
    provideHttpClient(withRequestsMadeViaParent(), withInterceptors([tenantInterceptor])),
  ],
  loadComponent: () => import('./reporting.component').then((m) => m.ReportingComponent),
};
```

**Symptom: you need a header applied *before* XSRF and cannot make it happen.** Cause: you cannot.
`{provide: HTTP_INTERCEPTOR_FNS, useValue: xsrfInterceptorFn, multi: true}` is pushed into the
provider list *before* the `for (const feature of features)` loop, multi-providers append, and
execution order follows registration order — so `xsrfInterceptorFn` is index 0 in every
configuration. Fix: there is no ordering fix; do the work inside your own interceptor, which still
runs on every request, just second. The general ordering rule is **10 · HTTP features** *(not
written yet)*.

**Symptom: two `provideHttpClient()` calls end up in one injector — one yours, one from a library's
own `provide*` — and you cannot tell what you have.** Cause: the non-multi tokens (`HttpHandler`,
`HttpBackend`) are last-wins, so the later call's backend decision silently beats the earlier one;
the `HTTP_INTERCEPTOR_FNS` entries from both calls **both** register, since multi appends. Fix: the
duplicate `xsrfInterceptorFn` is harmless — `HttpInterceptorHandler.handle` builds its chain from
`Array.from(new Set([...]))` and both entries are the same function reference, so the `Set`
collapses them — but the backend override is not harmless. Make one call and pass a library's
features into it, or assert the backend the way
[09d](09d-withxhr-on-the-server-and-httpclientmodule.md) does.

**Symptom: `withJsonpSupport()` is flagged as deprecated.** Cause: JSONP is being removed. The
JSDoc on the JSONP error codes in `common/http/src/errors.ts` at `v22.1.5` states the reason
verbatim — *"JSONP is deprecated as it can cause XSS vulnerabilities. Use standard HTTP requests
instead. Intent to remove in future versions of Angular."* Fix: move the endpoint to CORS. The
feature and its migration are **10 · HTTP features** *(not written yet)*.

## Interview questions

**★ `withFetch()` and `withXhr()` in the same call does not throw, but `withRequestsMadeViaParent()`
with either one does. Why the asymmetry?**
Because two backend overrides degrade to something *defined* and delegation-plus-override degrades
to something *incoherent*. `HttpBackend` is a non-multi token, so registering it twice means the
later record replaces the earlier one — the outcome is "whichever you wrote last", which is
surprising but well-specified, and a developer who wrote both got one of the two things they asked
for. `withRequestsMadeViaParent()` also binds `HttpBackend`, but it binds it to the *parent
injector's `HttpHandler`*, and `HttpInterceptorHandler.handle` detects delegation by testing
`this.backend === parentHandler`. Add a local backend and that identity can never hold, so the
delegation quietly does not happen while the code still reads as though it does. Angular spends a
`throw` on the case where last-wins produces a lie and not on the case where it produces a choice.

**★ Why is the XSRF interceptor pushed into the provider array before the feature loop instead of
being contributed by a feature?**
So that it is unconditionally first. `HTTP_INTERCEPTOR_FNS` is a multi-provider, multi-providers
append in registration order, and `HttpInterceptorHandler` executes them in that order — so
whatever is registered first runs first. Pushing `xsrfInterceptorFn` before
`for (const feature of features)` makes index 0 unreachable by user configuration. If it were a
feature, its position would depend on argument order and a developer could put an interceptor ahead
of it, which would let a request be short-circuited, retried or rewritten before the token was
attached. It is a security property expressed as a line number, which is why you cannot configure
around it.

**Both of `provideHttpClient`'s validations are `throw new Error`, not `RuntimeError` with a code.
Why does that distinction matter to you as a reader of stack traces?**
Because there is nothing to look up. Angular's `formatRuntimeError` machinery produces an `NGxxxx`
prefix, and negative codes additionally get a `Find more at https://angular.dev/errors/NGxxxx`
suffix in dev mode; searching that code lands you on a written guide page. These two throws bypass
all of it, so the message string *is* the entire diagnostic and searching for `NG` anything finds
nothing. It also means the message is not stripped in production the way an `ngDevMode &&` message
is — except that in this case the whole `if (ngDevMode)` block is, so the validation itself
disappears from a production build and the contradiction resolves silently by last-wins.

**Both validations run at call time, not at injection time. What is the observable difference?**
`provideHttpClient(...)` is a function call inside an object literal in `app.config.ts`, which
executes when that module is evaluated — before `bootstrapApplication()` runs, and long before an
injector exists. So a contradiction throws during module evaluation: a blank page, an exception in
the browser console with a stack that names your config file, and no Angular error overlay, because
Angular has not started. Compare a DI failure like `NG0201`, which happens during injector
resolution and therefore inside Angular's own error handling. If someone hands you a blank page and
a `Configuration error:` string, you know the framework never booted and the problem is in a config
file, not in a service.

**`HttpFeatureKind` is a public plain enum; `RouterFeatureKind` is an internal `const enum`. What
follows from that?**
That HTTP can validate feature combinations at call time and the router cannot. A plain enum is a
real runtime object, so `provideHttpClient` can build `new Set(features.map((f) => f.ɵkind))` and
ask it questions. A `const enum` is erased at compile time into literal numbers, and the router does
not expose it, so `provideRouter` has no vocabulary in which to state a rule about its own
arguments — which is exactly why it validates nothing and pushes the one real conflict check down
into `withExperimentalPlatformNavigation`'s own environment initializer
([08g](08g-tracing-and-the-experimental-end.md)). If you are writing your own `provide*` function
([04](04-writing-your-own-provide-function.md)), the HTTP shape is the one to copy: a public kind
enum plus a dev-mode check is a few lines and turns a silent misconfiguration into a message.

---

← Prev: [`HttpClient` without the call](09-provide-http-client-and-the-backend.md) · Index: [Topic index](README.md) · Next → [The `fetch` default and `withFetch()`](09c-the-fetch-default-and-withfetch.md)
