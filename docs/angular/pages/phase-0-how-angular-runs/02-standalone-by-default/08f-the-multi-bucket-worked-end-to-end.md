---
title: "The `multi: true` bucket is the one that changes behaviour silently, and `HttpClientModule` is the worked example — its body supplies two features, its deprecation notice names one, and the feature it omits is the only thing that reads `HTTP_INTERCEPTORS` at all"
sidebar_label: "08f · The multi bucket, worked end to end"
sidebar_position: 8.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev [Setting up `HttpClient`](https://angular.dev/guide/http/setup) — and `angular/angular` at tag `v22.1.5`:
> [`packages/common/http/src/module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/module.ts),
> [`packages/common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts) (`provideHttpClient`, `withInterceptors`, `withInterceptorsFromDi`),
> [`packages/common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts) (`HTTP_INTERCEPTORS`, `HTTP_INTERCEPTOR_FNS`),
> [`packages/common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts) (`HttpInterceptorHandler.handle`).
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**[08e](08e-the-interop-shapes-that-beat-it.md) left one bucket unconverted, and it is the one that
punishes a careless transcription. A `multi: true` token accumulates — [08c](08c-ordering-cycles-and-multi-tokens.md)
showed `R3Injector.processProvider` pushing onto a shared `multiRecord.multi` array instead of replacing
a record — so you cannot fix a wrong multi entry by providing a better one later. And in the `HttpClient`
case the trap has a second half that is worse: `HTTP_INTERCEPTORS` entries are *registered* by anything,
but *consumed* only by `withInterceptorsFromDi()`. `HttpClientModule` in v22.1.5 is a two-line shim whose
body calls `provideHttpClient(withInterceptorsFromDi(), withXhr())`, and whose deprecation notice names
`withInterceptorsFromDi()` and not `withXhr()`. Transcribe the notice instead of the body and you get an
app whose class-based interceptors are all still registered, still injectable, and never run.**

## `HttpClientModule` is a shim, and it pins a backend

From `packages/common/http/src/module.ts` at `v22.1.5` — the body first, then the notice, both verbatim:

```ts
@NgModule({
  providers: [provideHttpClient(withInterceptorsFromDi(), withXhr())],
})
export class HttpClientModule {}
```

> *"@deprecated use `provideHttpClient(withInterceptorsFromDi())` as providers instead"*

Two features in the body, one in the notice. angular.dev's [setup guide](https://angular.dev/guide/http/setup) gets it right and is the mapping to work from, verbatim:

| **NgModule**                            | `provideHttpClient()` equivalent                         |
| --------------------------------------- | -------------------------------------------------------- |
| `HttpClientModule`                      | `provideHttpClient(withInterceptorsFromDi(), withXhr())` |
| `HttpClientJsonpModule`                 | `withJsonpSupport()`                                     |
| `HttpClientXsrfModule.withOptions(...)` | `withXsrfConfiguration(...)`                             |
| `HttpClientXsrfModule.disable()`        | `withNoXsrfProtection()`                                 |

The same guide carries a callout that is really an argument against ever importing the module in a
multi-injector app — which is every app with route-level providers:

> *"When `HttpClientModule` is present in multiple injectors, the behavior of interceptors is poorly
> defined and depends on the exact options and provider/import ordering."*

> *"Prefer `provideHttpClient` for multi-injector configurations, as it has more stable behavior."*

## Registered is not consumed

`withInterceptorsFromDi()`'s own JSDoc is the sentence that matters, verbatim:

> *"Includes class-based interceptors configured using a multi-provider in the current injector into the
> configured `HttpClient` instance."*

> *"Prefer `withInterceptors` and functional interceptors instead, as support for DI-provided
> interceptors may be phased out in a later release."*

`HTTP_INTERCEPTORS` is a `multi: true` token like any other; putting entries in it is free and always
succeeds. What turns those entries into a handler chain is a *second* registration, and it is what
`withInterceptorsFromDi` performs — verbatim from `packages/common/http/src/provider.ts`, comment
included (the `HttpINterceptorHandler` typo is upstream; it is quoted as written):

```ts
export function withInterceptorsFromDi(): HttpFeature<HttpFeatureKind.LegacyInterceptors> {
  // Note: the legacy interceptor function is provided here via an intermediate token
  // (`LEGACY_INTERCEPTOR_FN`), using a pattern which guarantees that if these providers are
  // included multiple times, all of the multi-provider entries will have the same instance of the
  // interceptor function. That way, the `HttpINterceptorHandler` will dedup them and legacy
  // interceptors will not run multiple times.
  return makeHttpFeature(HttpFeatureKind.LegacyInterceptors, [
    {
      provide: LEGACY_INTERCEPTOR_FN,
      useFactory: legacyInterceptorFnFactory,
    },
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useExisting: LEGACY_INTERCEPTOR_FN,
      multi: true,
    },
  ]);
}
```

🔴 **Read the shape.** *Every* class-based interceptor in the injector collapses into **one** entry in
`HTTP_INTERCEPTOR_FNS` — a single function that wraps the whole `HTTP_INTERCEPTORS` array. That is why
the `useExisting` indirection exists: two copies of the feature yield the same function instance, and the
handler deduplicates by reference. From `HttpInterceptorHandler.handle` in `backend.ts`, verbatim:

```ts
const dedupedInterceptorFns = Array.from(
  new Set([...this.injector.get(HTTP_INTERCEPTOR_FNS), ...rootInterceptorFns]),
);
```

Two consequences worth holding on to. Adding `withInterceptorsFromDi()` twice is harmless. Adding a
functional interceptor *and* leaving its class version registered is **not** harmless — they are two
different function references, the `Set` keeps both, and both run.

## Two honest conversions

**The halfway house — keep the classes, exactly as they were.** This is the right first commit, because it changes nothing:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {CorrelationIdInterceptor} from './reports/correlation-id.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi(), withXhr()),
    {provide: HTTP_INTERCEPTORS, useClass: CorrelationIdInterceptor, multi: true},
  ],
};
```

**The finished conversion — a functional interceptor, and no backend pin:**

```ts
// src/app/reports/correlation-id.interceptor.ts
import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {CorrelationIdSource} from './correlation-id-source';

export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const id = inject(CorrelationIdSource).next();
  return next(req.clone({setHeaders: {'X-Correlation-Id': id}}));
};
```

```ts
// src/app/reports/correlation-id-source.ts
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class CorrelationIdSource {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `req-${this.counter}`;
  }
}
```

```ts
// src/app/app.config.ts — the "after"
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {correlationIdInterceptor} from './reports/correlation-id.interceptor';
import {provideReporting} from './reports/reporting.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([correlationIdInterceptor])),
    provideReporting({cacheTtlMs: 60_000}),
  ],
};
```

`LegacyReportingModule` now provides nothing anybody asks for and the file can be deleted. angular.dev states the preference plainly:

> *"HELPFUL: Functional interceptors (through `withInterceptors`) have more predictable ordering and we
> recommend them over DI-based interceptors."*

"More predictable ordering" is precise rather than vague: `withInterceptors` maps its array to one
`multi: true` provider per function, in array order, and the handler wraps them right-to-left so
execution runs left-to-right. **The array you write is the order they run.** A `HTTP_INTERCEPTORS` array
assembled from several modules has no such property, because the order is whatever the provider walk
produced.

⚠️ **`withXhr()` is not a neutral carry-over.** Dropping it moves the app onto the `fetch` backend, which
is a real behaviour change; keeping it pins the app to `XMLHttpRequest`. Which of those you want is
**HTTP features** *(not written yet)* in topic 03's territory, not this page's — but do not delete it by
accident while converting a module.

## Gotchas

**★ Symptom: you replaced `importProvidersFrom(HttpClientModule)` with `provideHttpClient()` and every class-based interceptor silently stopped running — no error, no warning, requests just lose their headers.** Cause: `withInterceptorsFromDi()` is the only thing that reads `HTTP_INTERCEPTORS` into the handler chain, and the deprecation notice you transcribed named it while the code you wrote omitted it. The entries are still registered and still injectable; nothing consumes them. Fix: transcribe the module's body:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptorsFromDi(), withXhr())],
};
```

**★ Symptom: you rewrote an interceptor as a functional one and the header is now set twice.** Cause: the class registration was left in place. `withInterceptorsFromDi()` collapses every class interceptor into one function reference and `withInterceptors([...])` registers yours as another — two distinct references, so `Array.from(new Set([...]))` keeps both and both run. Fix: delete the class entry in the same commit that adds the function, and delete `withInterceptorsFromDi()` too once no class interceptors remain:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {correlationIdInterceptor} from './reports/correlation-id.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([correlationIdInterceptor]))],
};
```

**★ Symptom: you kept `importProvidersFrom(HttpClientModule)` *and* added `provideHttpClient(withInterceptors([authInterceptor]))`, and the app is on `XMLHttpRequest` even though v22 defaults to `fetch`.** Cause: two configurations of the same subsystem in one injector. The module contributes `withXhr()`, a non-multi backend override, so last-write-wins picks your backend from provider order rather than from anything you wrote — and the interceptor arrays merge rather than replace. Fix: delete the module import and keep exactly one call:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {authInterceptor} from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
};
```

**★ Symptom: you tried to remove a vendor module's interceptor by providing your own "later", and both still run.** Cause: this is [08c](08c-ordering-cycles-and-multi-tokens.md)'s rule with a concrete victim. `processProvider`'s multi branch does `multiRecord.multi!.push(provider)`; there is no remove, no replace and no override. Fix: the only way to remove a multi contribution is to stop the thing that registers it from being walked — which means converting the module rather than wrapping it, and registering only the interceptors you want:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {authInterceptor} from './core/auth.interceptor';
import {retryInterceptor} from './core/retry.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor, retryInterceptor]))],
};
```

**Symptom: the module you converted also imported `HttpClientXsrfModule.withOptions({...})` and your XSRF header name reverted to the default.** Cause: `HttpClientModule` is not the only HTTP module a legacy `SharedModule` imports, and each one has its own row in the mapping table. Converting only the one you noticed silently drops the rest. Fix: convert every row you find, in the same call:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptorsFromDi, withXsrfConfiguration} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptorsFromDi(),
      withXsrfConfiguration({cookieName: 'CSRF-TOKEN', headerName: 'X-CSRF-TOKEN'}),
    ),
  ],
};
```

**Symptom: two `provideHttpClient()` calls ended up in one injector after a merge, and you expect duplicated interceptors.** Cause: the non-multi parts (the backend) are last-write-wins, and the multi parts both register — but the handler's `Array.from(new Set([...]))` removes any entry that is the *same function reference*, which the built-in XSRF interceptor and a shared `withInterceptorsFromDi()` both are. A functional interceptor registered twice by the same reference likewise runs once. Fix: still merge them, because relying on the dedup is relying on a detail rather than on a design:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {authInterceptor} from './core/auth.interceptor';
import {correlationIdInterceptor} from './reports/correlation-id.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor, correlationIdInterceptor]))],
};
```

**Symptom: `withJsonpSupport()` shows a deprecation strikethrough while you are converting `HttpClientJsonpModule`.** Cause: the mapping table's row is accurate, but the feature itself is on the way out in v22 — [topic 03 · 02](../03-the-provider-array/02-why-provide-functions-replaced-forroot.md) records both the module and the function as deprecated. Fix: this is the one row where the right conversion is deletion. If a JSONP endpoint is genuinely still in use, convert it and open a ticket; do not carry the row forward silently because a table listed it.

## Interview questions

**★ Why is `multi: true` the bucket that changes behaviour silently, when the other four are mechanical?**
Because every other bucket has an override of last resort and this one does not. `R3Injector.processProvider` ends its non-multi branch with `this.records.set(token, record)` — so if you get a plain provider wrong, providing it again later fixes it. The multi branch instead looks up or creates a shared `multiRecord` and does `multiRecord.multi!.push(provider)`: contributions accumulate, and nothing you add afterwards can remove one. So a `multi` entry transcribed wrongly is not a value you can correct downstream; it is a registration you have to prevent, which means going back to whatever walked the module.

**★ `provideHttpClient()` compiles, `inject(HttpClient)` works, requests succeed — and your legacy interceptors never run. What happened?**
`HTTP_INTERCEPTORS` is registered by anything and consumed by exactly one thing: `withInterceptorsFromDi()`, whose JSDoc says it *"includes class-based interceptors configured using a multi-provider in the current injector into the configured `HttpClient` instance."* Without that feature the multi array is populated and simply never read into the handler chain, so there is nothing to error about — the token has a perfectly valid value that nobody asks for. The trap is that `HttpClientModule`'s deprecation notice says *"use `provideHttpClient(withInterceptorsFromDi())` as providers instead"* while its body is `provideHttpClient(withInterceptorsFromDi(), withXhr())`, so a developer transcribing either one carelessly loses a feature.

**★ Why does `withInterceptorsFromDi()` route everything through an intermediate `LEGACY_INTERCEPTOR_FN` token instead of registering the interceptors directly?**
So that the feature is idempotent. The code comment says it outright: the indirection *"guarantees that if these providers are included multiple times, all of the multi-provider entries will have the same instance of the interceptor function"*, and the handler then deduplicates with `Array.from(new Set([...]))`, which compares by reference. Register the class interceptors directly and two copies of the feature would produce two distinct wrapper functions and run every legacy interceptor twice. It is the single clearest worked example in the framework of why identity, not equality, is what matters in a multi-provider.

**★ You converted to `withInterceptors([auth, retry])` and the XSRF interceptor still runs before both. Can you move it?**
No, and the reason is in `provider.ts`: `xsrfInterceptorFn` is pushed into the provider list *before* the loop that processes the features you passed, and `HTTP_INTERCEPTOR_FNS`' own default factory is `() => [xsrfInterceptorFn]`. So it occupies the first position in the multi array however the rest is configured, and since the array order is the execution order it runs first. That is deliberate: a request must not be able to leave without its XSRF token because of how somebody arranged their interceptor list. What you can change is its configuration — `withXsrfConfiguration(...)` or `withNoXsrfProtection()` — not its position.

**Why does angular.dev say functional interceptors have "more predictable ordering", given both kinds end up in the same chain?**
Because the two orders are produced by different things. `withInterceptors([a, b, c])` maps the array to one `multi: true` provider per function *in array order*, and the handler wraps them right-to-left so execution is left-to-right — the array you wrote is the order they run, and it is visible in one line of one file. A `HTTP_INTERCEPTORS` array is assembled by the provider walk across every module that contributed to it, so its order is a consequence of the module graph, the `ModuleWithProviders`-last replay rule, and import order. One is a list; the other is an emergent property.

**A vendor module registers an interceptor you must remove. Walk through why "provide a no-op version later" fails and what actually works.**
It fails because multi providers append. Providing another `HTTP_INTERCEPTORS` entry adds a second interceptor to the chain; it does not shadow the first, because the multi branch of `processProvider` never reaches the replacing `records.set` for the shared record. Reordering does not help either — you cannot make an appended entry un-run an earlier one. What works is preventing the registration: stop importing the vendor module, and register the pieces you actually want with `withInterceptors`. If the vendor module has no `provide*` equivalent, the containment options are to scope the whole module to a route so it only affects that subtree, or to give the affected feature its own `HttpClient` from a child injector — and both of those are [08g](08g-narrowing-the-injector-and-the-lifetime.md)'s subject.

---

← Prev: [The interop shapes that beat it](08e-the-interop-shapes-that-beat-it.md) · Index: [Topic index](README.md) · Next → [Narrowing the injector and the lifetime](08g-narrowing-the-injector-and-the-lifetime.md)
