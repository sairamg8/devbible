---
title: "`HttpClientModule` is not merely the old spelling — its body is `provideHttpClient(withInterceptorsFromDi(), withXhr())`, so an NgModule import silently pins the XHR backend and leaves interceptor behaviour across injectors, in the documentation's own word, poorly defined"
sidebar_label: "09e · `HttpClientModule`, the end of the road"
sidebar_position: 9.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); and
> `angular/angular` at tag `v22.1.5`:
> [`common/http/src/module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/module.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`HttpClientModule` is deprecated, and the usual reason given — "standalone APIs are the new way" —
is the least interesting one. The operative fact is what its body contains:
`provideHttpClient(withInterceptorsFromDi(), withXhr())`.** An NgModule import therefore selects the
`XMLHttpRequest` backend, silently, in an application whose release notes say the default is `fetch`
— and on the server that is the path with a documented credential leak and a documented DoS
([09d](09d-withxhr-on-the-server-and-httpclientmodule.md)). angular.dev separately warns that
interceptor behaviour with this module across multiple injectors is *"poorly defined"*. So the
migration is not cosmetic: it is deleting an import that makes two consequential decisions on your
behalf and announces neither.

## angular.dev's own migration table, and the line it stops short of drawing

[Chunk 02](02-why-provide-functions-replaced-forroot.md) already established the mapping and quoted
`HttpClientModule`'s body — it is a shim whose entire content is
`provideHttpClient(withInterceptorsFromDi(), withXhr())`. What belongs here is angular.dev's own
migration table, verbatim from the setup guide:

| **NgModule** | `provideHttpClient()` equivalent |
|---|---|
| `HttpClientModule` | `provideHttpClient(withInterceptorsFromDi(), withXhr())` |
| `HttpClientJsonpModule` | `withJsonpSupport()` |
| `HttpClientXsrfModule.withOptions(...)` | `withXsrfConfiguration(...)` |
| `HttpClientXsrfModule.disable()` | `withNoXsrfProtection()` |

and the callout that follows it:

> *"When `HttpClientModule` is present in multiple injectors, the behavior of interceptors is poorly defined and depends on the exact options and provider/import ordering."*

> *"Prefer `provideHttpClient` for multi-injector configurations, as it has more stable behavior."*

🔴 **Put the table next to the `CRITICAL` alert in
[09d](09d-withxhr-on-the-server-and-httpclientmodule.md) and the conclusion changes character.**
`HttpClientModule`'s equivalent *pins* `withXhr()`. So an SSR application that still imports
`HttpClientModule` is on the `xhr2` path — the one with the documented `Authorization`-forwarding
and redirect-loop problems and an intent to remove in Angular 23 — and it got there without anyone
writing `withXhr()` anywhere. "We still import `HttpClientModule`" stopped being a style remark and
became a finding you can write into a security review, with the framework's own documentation as the
citation.

The migration is one line, and it is a deletion plus a decision:

```ts
// before — an NgModule import that silently pins XMLHttpRequest
@NgModule({
  imports: [BrowserModule, HttpClientModule],
})
export class AppModule {}

// after — standalone config, fetch backend, interceptors registered explicitly
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

If you genuinely still need class-based interceptors, `withInterceptorsFromDi()` carries them over —
it is **not** deprecated in v22 — but functional interceptors are the recommended form and the
ordering story is simpler. That, and JSONP's deprecation, are **10 · HTTP features** *(not written
yet)*.

## Gotchas

**★ Symptom: a security review asks which HTTP backend your SSR application uses and nobody knows,
because nothing in the config mentions a backend.** Cause: `HttpClientModule` is still imported
somewhere. Its v22 body is `provideHttpClient(withInterceptorsFromDi(), withXhr())`, so the module
import pins `XMLHttpRequest` — the path Angular's own documentation describes as deprecated on the
server, with `Authorization`-forwarding on cross-origin redirects and redirect-loop DoS named as the
reasons, and removal intended in Angular 23. The release notes saying `fetch` is the v22 default are
true and irrelevant, because the module overrides it. Fix: delete the import and make the
configuration explicit:

```ts
// after, when class-based interceptors cannot be converted yet:
// carry them over explicitly and DO NOT carry withXhr() over with them
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: LegacyAuthInterceptor, multi: true },
    provideHttpClient(withInterceptorsFromDi()),
  ],
};
```

That is `HttpClientModule`'s equivalent **minus** `withXhr()`, which is the whole point: the module
gave you two things bundled together and only one of them was wanted.

## Interview questions

**★ An SSR application imports `HttpClientModule`. What do you tell the team, and why is it more
than a style comment?**
That they are on the `xhr2` backend and did not choose to be. `HttpClientModule` in v22 is a shim
whose body is `provideHttpClient(withInterceptorsFromDi(), withXhr())`, so the module import pins
`XMLHttpRequest` even though the release notes say `fetch` is the default. On the server, Angular's
own documentation says XHR support is deprecated and intended for removal in Angular 23 because
`xhr2` *"does not safely handle redirects: it can forward `Authorization` headers on cross-origin
redirects and is susceptible to denial-of-service (DoS) via redirect loops."* Forwarded
`Authorization` headers on a shared rendering server is credential leakage, and a redirect loop is a
DoS against every user of that server, not one tab. So the finding is: an NgModule import is
silently selecting a backend with two documented vulnerabilities on the platform this app runs on.
The fix is to delete the import and call `provideHttpClient(withInterceptors([...]))`, migrating
class-based interceptors with `withInterceptorsFromDi()` only if they cannot be converted yet.

**angular.dev says interceptor behaviour with `HttpClientModule` in multiple injectors is "poorly
defined". What is the underlying mechanism, and why is `provideHttpClient` better behaved?**
The documentation's own wording is that it *"depends on the exact options and provider/import
ordering"* and that you should *"prefer `provideHttpClient` for multi-injector configurations, as it
has more stable behavior."* The mechanism it is pointing at is that importing a module into two
injectors re-registers its providers in both, and the interceptor chain is assembled from a
multi-provider token — so what runs, and in what order, becomes a function of where each import
landed. `provideHttpClient` is better behaved for two reasons visible in the source: its features are
explicit arguments at one call site rather than a transitive consequence of an import graph, and
`withInterceptorsFromDi()` deliberately routes class-based interceptors through a single
`LEGACY_INTERCEPTOR_FN` token with `useExisting`, so repeated inclusion yields the *same function
reference* and `HttpInterceptorHandler`'s `Array.from(new Set([...]))` collapses it. ⚠️ The precise
multi-injector semantics are not spelled out by the documentation beyond the two sentences quoted
here; treat "poorly defined" as the specification it is, and do not build on a particular ordering.

---

← Prev: [`withXhr()` on the server](09d-withxhr-on-the-server-and-httpclientmodule.md) · Index: [Topic index](README.md) · Next → **10 · HTTP features** *(not written yet)*
