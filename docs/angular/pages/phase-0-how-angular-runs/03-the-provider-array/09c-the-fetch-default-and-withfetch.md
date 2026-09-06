---
title: "`withFetch()` was deprecated for winning — `FetchBackend` is the v22 default, and the only thing the flip took away is upload progress, which is why Angular shipped a schematic to keep you on XHR and split `reportProgress` in two"
sidebar_label: "09c · The `fetch` default and `withFetch()`"
sidebar_position: 9.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); the `angular/angular` **v22.0.0
> CHANGELOG**; and `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/errors.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`withFetch()` was deprecated in v22.0.0 for the unusual reason that it won: `FetchBackend` is now
the default `HttpBackend`, so the feature that opted into it has nothing left to do.** That is a
default flip, not an API removal, and default flips break code that never mentioned the default. The
one real casualty is upload progress, which the `fetch` API does not report — which is why Angular
shipped a migration schematic to keep applications on `HttpXhrBackend` across the upgrade, and why
`reportProgress` was split into `reportUploadProgress` and `reportDownloadProgress` in the same
release. This chunk is the deprecation quoted verbatim, what the flip actually changed, and the four
ways it surfaces in a codebase.

## The backend: `withFetch()` is deprecated because it won

`withFetch()` still exists and still does something — it is just that what it does is now the
default. Its JSDoc at `v22.1.5`, verbatim:

```ts
/**
 * Configures the current `HttpClient` instance to make requests using the fetch API.
 *
 * Note: The Fetch API doesn't support progress report on uploads.
 *
 * @see [Advanced fetch Options](https://angular.dev/guide/http/making-requests#advanced-fetch-options)
 *
 * @publicApi
 * @deprecated `withFetch` is not required anymore. `FetchBackend` is the default `HttpBackend`.
 */
export function withFetch(): HttpFeature<HttpFeatureKind.Fetch> {
  return makeHttpFeature(HttpFeatureKind.Fetch, [
    FetchBackend,
    {provide: HttpBackend, useExisting: FetchBackend},
  ]);
}
```

The v22.0.0 CHANGELOG, under **Deprecations / http**:

> *"`withFetch` is now deprecated, it can be safely removed."*

> *"The `reportProgress` option is deprecated please use `reportUploadProgress` & `reportDownloadProgress` instead."*

and the commit that flipped the default, from the same release's core table:

> *"feat | Use `FetchBackend` as default for the `HttpBackend` implementation"* — commit `5c432fb8bb`

Angular shipped a migration for the applications this would break:

> *"feat | Add a schematics to migrate `provideHttpClient` to keep using the `HttpXhrBackend` implementation."* — commit `3bc095d508`

⚠️ **The changelog line states the schematic's purpose but not its trigger conditions**, and the
schematic source is not quoted here. If your `ng update` to v22 added a `withXhr()` nobody wrote,
that is what did it — but do not take this page as a statement of exactly when it fires. Read the
diff.

The guide states the resulting default plainly:

> *"By default, `HttpClient` uses the `fetch` API to make requests. The `withXhr` feature switches the client to use the `XMLHttpRequest` API instead."*

> *"`fetch` is a more modern API and is available in a few environments where `XMLHttpRequest` is not supported. It does have a few limitations, such as not producing upload progress events."*

(The guide links `fetch` and `XMLHttpRequest` out to MDN; the link markup is dropped above, the
words are not.)

## Gotchas

**Symptom: `withFetch()` has a strikethrough in your editor and the build warns about a deprecated
symbol.** Cause: it was deprecated in v22.0.0 for having become the default — *"`withFetch` is now
deprecated, it can be safely removed."* Fix: delete it, and delete nothing else:

```ts
// v21 and earlier
provideHttpClient(withFetch(), withInterceptors([authInterceptor]))

// v22
provideHttpClient(withInterceptors([authInterceptor]))
```

**★ Symptom: upload progress events stopped arriving after the upgrade to v22.** Cause: the default
`HttpBackend` became `FetchBackend`, and the `fetch` API does not report upload progress — the
JSDoc says so in its own note, and the enum carries `FETCH_UPLOAD_PROGRESS_NOT_SUPPORTED = 2824` for
it. Fix in the browser is `withXhr()`; the breaking-change note says exactly that —
*"Use the `HttpXhrBackend` with `provideHttpClient(withXhr)` if you want to keep supporting upload
progress reports."* 🔴 **In an SSR application, read [09d](09d-withxhr-on-the-server-and-httpclientmodule.md) first** — `withXhr()`
is the deprecated-on-server path. Scope it to the browser config if your app has both:

```ts
// app.config.ts — shared, browser-side
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withXhr(), withInterceptors([authInterceptor]))],
};

// app.config.server.ts — merged over it on the server, fetch restored
export const serverConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
};
```

⚠️ That merge relies on the server config being applied *after* the browser one, which is
**17 · The server config merge** *(not written yet)*. Verify the resulting backend rather than
assuming the ordering.

**Symptom: after `ng update` to v22, your `provideHttpClient()` call contains a `withXhr()` nobody
wrote.** Cause: v22.0.0 shipped a schematic whose stated purpose is *"to migrate `provideHttpClient`
to keep using the `HttpXhrBackend` implementation"* — it preserves v21 behaviour across the default
flip. That is the right default for a browser app that used upload progress and the wrong one for an
SSR app. Fix: decide deliberately rather than accepting the migration's answer — delete `withXhr()`
unless you can name the XHR-only feature you depend on, and if the app renders on the server, delete
it regardless and find another way to get upload progress.

**Symptom: `reportProgress: true` is flagged deprecated on a request.** Cause: v22.0.0 split it —
*"The `reportProgress` option is deprecated please use `reportUploadProgress` &
`reportDownloadProgress` instead."* The split exists because the two halves now have different
backend support: download progress works on both backends, upload progress is XHR-only. Fix:

```ts
// deprecated — one flag for two different capabilities
this.http.post('/api/uploads', body, { reportProgress: true, observe: 'events' });

// v22 — say which one, and know that upload progress needs withXhr()
this.http.post('/api/uploads', body, { reportUploadProgress: true, observe: 'events' });
```

## Interview questions

**★ `withFetch()` still works. Why deprecate a function that does exactly what it always did?**
Because its only job was to say "not the default", and it is now the default —
*"`withFetch` is not required anymore. `FetchBackend` is the default `HttpBackend`."* Leaving it
undeprecated would leave a permanent ambiguity in every config file: a reader could not tell whether
`withFetch()` was a deliberate override of something or a leftover from v21, and a future reader
would eventually assume it was load-bearing and preserve it through a refactor. Deprecating a
no-op is how a framework says "this line carries no information" in a way the compiler can repeat.
Note what Angular did *not* do: it did not delete the symbol, because that would break every app
that has it, and it did not deprecate `withXhr()`, because that one still means something.

**A default flipped in a major release. How do you audit an application for the blast radius
without running it?**
Work from the new default's known limitations rather than from your own code. Here the changelog and
the JSDoc both name the same one — *"The Fetch API doesn't support progress report on uploads"* — so
the audit is: grep for `reportProgress`, `reportUploadProgress` and `HttpEventType.UploadProgress`,
and for any subscription that branches on `event.type`. Each hit is a place where the flip changes
observable behaviour. Then check whether `ng update` inserted `withXhr()` for you, because if it did
the blast radius is zero *and* you have silently kept the old backend, including on the server where
it is deprecated. The general shape: a default flip is only auditable if you can enumerate the
differences between the old default and the new one, which is why the release note naming the single
missing capability is the most valuable sentence in the changelog.

---

← Prev: [Inside `provideHttpClient()`](09b-inside-provide-http-client.md) · Index: [Topic index](README.md) · Next → [`withXhr()` on the server](09d-withxhr-on-the-server-and-httpclientmodule.md)
