---
title: "Link map · Angular · Part 4 (phases 9–10–11)"
sidebar_label: "04 · http forms architecture"
sidebar_position: 4
---

# Link map · Angular · Part 4 (phases 9–10–11)

Covers every topic row of `docs/angular/syllabus/04-data-forms-and-architecture.md` in phase 9 (T09-01 to T09-12, HTTP and data), phase 10 (T10-01 to T10-16, forms in all three systems) and phase 11 (T11-01 to T11-12, architecture, state and UI). That is 40 rows. None has a written page yet (`docs/angular/pages/` holds phase 0 only), so every block says 🔲 not written.
*read* = I read the passage; *headings only* = fetched, headings or summary checked; *(not fetchable — unverified)* = the fetch failed. Third-party links carry a date only where the page shows one. No `#anchors` are given. A block with no "Beyond the docs" line means no good third-party page was found and verified; the web-search budget ran out before a second query could be run for the thinnest topics (HttpParams, accessibility, project structure, CDK, immutability, Material). The verifier pass re-fetched every URL (all return 200 on 2026-10-13), re-checked each claim against the page text, and corrected the blocks below; it could not run its own spot-check searches because the shared search budget was already used up, so the blocks without a "Beyond the docs" line are still open for a later search pass.

🔴 **Version note.** Our syllabus targets **Angular 22.1.4** (`docs/angular/README.md`). The angular.dev pages below were fetched on 2026-10-13 and describe v22. Places where the pages differ from our syllabus wording or from older articles:
- **Fetch is now the default HttpClient backend.** The angular.dev `withFetch` API page says `withFetch` is deprecated ("not required anymore") and the setup page documents `withXhr()` as the opt-out. Articles from 2024 and earlier say the opposite (XHR default, `withFetch()` opt-in). Fetch cannot report upload progress.
- **`provideHttpClient()` is optional now.** The setup page says "HttpClient is available for injection by default in Angular v21 and later"; you call `provideHttpClient(...)` to add features (interceptors, `withXhr()`, XSRF options). XHR on the server is deprecated and slated for removal in Angular 23 (setup page).
- **`reportProgress` on HttpClient is deprecated.** The httpResource page says `reportProgress` is deprecated for `HttpClient` in favour of `reportUploadProgress` and `reportDownloadProgress`; `httpResource` keeps the single `reportProgress` option (download only). Articles that show `reportProgress: true` with `observe: 'events'` predate this.
- **Signal Forms.** The angular.dev comparison page lists Signal Forms as "Stable (v22+)". Articles from late 2025 call them experimental in v21. The binding directive is `[formField]` (class `FormField`) on angular.dev now; the 2025 articles use `[field]`. Our syllabus says the `Field` directive. The guide's form-submission page uses `FormRoot` and `submit()`. The API page for `validateStandardSchema` is marked "stable since v22.0". The signal-forms guide also has pages for cross-field logic, field metadata, dynamic forms with JSON, migration (`compatForm`), testing and model design, which the first pass missed; they are used below.
- **minDate / maxDate** are in our syllabus's signal-form rules row, but the angular.dev validation guide does not list them. Not confirmed from the guide.
- **WebMCP.** angular.dev says the APIs are "subject to change even outside of major versions". The next.angular.dev API pages list names without the Experimental prefix, so the names may change.
- Some official pages (ngrx.io, material.angular.dev) are client-rendered; the fetch tool saw only a shell. For those I read the source markdown in the project's GitHub repo and say so.

---

## Phase 9 — HTTP and data

### T09-01 · `provideHttpClient()` and `withFetch()` — Master · 🔲 not written
- **Read this:** [Setting up HttpClient](https://angular.dev/guide/http/setup) · angular.dev · "HttpClient is available for injection by default in Angular v21 and later"; fetch is the default backend, `withXhr()` switches to XMLHttpRequest, "does have a few limitations, such as not producing upload progress events"; XHR on the server is deprecated, removal planned for Angular 23 (*read*) · covers our angle: **partial** — never mentions `withFetch`, which the syllabus row names · fetched 2026-10-13
- **Also good:** [withFetch](https://angular.dev/api/common/http/withFetch) · angular.dev API · deprecated, "FetchBackend is the default HttpBackend", fetch cannot report upload progress (*read*) · fetched 2026-10-13
- **Our delta:** the row's "why fetch rather than XHR" is now "why you might still opt out", and `provideHttpClient()` is only needed to add features; reword to v22. No third-party page was verified for this row (search budget).

### T09-02 · Typed requests and responses — Understand · 🔲 not written
- **Read this:** [Making HTTP requests](https://angular.dev/guide/http/making-requests) · angular.dev · "The generic type of request methods is a type assertion about the data returned by the server"; `observe: 'response'`; `responseType` must be a literal type; a "Receiving raw progress events" section covers `observe: 'events'` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Why we should verify HTTP response bodies, and why we should use zod for this](https://timdeschryver.dev/blog/why-we-should-verify-http-response-bodies-and-why-we-should-use-zod-for-this) · Tim Deschryver, 2022-07-04 · makes the "generic is a claim, not a check" point concrete: "TypeScript offers us a false sense of security", so parse the body at runtime with a zod schema · fetched 2026-10-13 (*read*)
- **Also good:** [Reactive data fetching with httpResource](https://angular.dev/guide/http/http-resource) · angular.dev · the "Response parsing and validation" section: pass a `parse` option (Zod or Valibot) and the return type of `parse` becomes the type of `value()` (*read* that section) · fetched 2026-10-13
- **Our delta:** the generic as a claim, and where to put the parse (a schema, or the `parse` option on `httpResource`).

### T09-03 · `httpResource()` — Master · 🔲 not written
- **Read this:** [Reactive data fetching with httpResource](https://angular.dev/guide/http/http-resource) · angular.dev · request function re-runs when signals change; "If a request is already pending, the resource cancels the outstanding request before issuing a new one"; `hasValue()`, `value()`, `error()`, `isLoading()` (*read*) · covers our angle: **partial** — cancellation is one sentence; the only comparison with `HttpClient` is a note that `httpResource` issues the request eagerly; no "when it replaces a service method" guidance · fetched 2026-10-13
- **Our delta:** the decision rule for resource versus observable service method, and the error-state read-throws gotcha (the page does warn: "Reading the value signal on a resource that is in error state throws at runtime"). No third-party page was verified for this row (search budget).

### T09-04 · Functional interceptors — Master · 🔲 not written
- **Read this:** [Interceptors](https://angular.dev/guide/http/interceptors) · angular.dev · functional interceptors run in the injection context so `inject()` works; the example `authInterceptor` clones the request with a header (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [How to create a functional interceptor in Angular](https://dev.to/seanbh/how-to-create-a-functional-interceptor-in-angular-kni) · seanbh, DEV Community, 2023-10-04 · side-by-side class-to-function diffs and `provideHttpClient(withInterceptors([...]))`; short, and the `inject()` advice is only in the comments · fetched 2026-10-13 (*read*)
- **Our delta:** the three interceptors every app writes (auth, logging, error mapping) as one worked set with ordering.

### T09-05 · Error handling — Master · 🔲 not written
- **Read this:** [Making HTTP requests](https://angular.dev/guide/http/making-requests) · angular.dev · the "Handling request failure" section: three failure kinds (network, timeout, backend error), all returned as an `HttpErrorResponse` on the error channel; "Network and timeout errors have a status code of 0"; for a timeout the error is a `DOMException` named `TimeoutError`, for a network error it is "the error thrown by fetch" (*read*) · covers our angle: **partial** — nothing on mapping errors to domain errors in an interceptor · fetched 2026-10-13
- **Also good:** [HttpErrorResponse](https://angular.dev/api/common/http/HttpErrorResponse) · angular.dev API · "an error or failure, either from a non-successful HTTP status, an error while executing the request, or some other failure which occurred during the parsing of the response" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular error handling 101](https://angularindepth.com/article/angular-error-handling-101/) · Michele Stieven, Angular In Depth, 2023-07-30 · walks the layers (`catchError`, subscribe, services, interceptors, store, global `ErrorHandler`); at the service level `tap` lets you peek at errors "without swallowing them" · fetched 2026-10-13 (*read*)
- **Our delta:** mapping transport errors to domain errors once, at the interceptor.

### T09-06 · `HttpParams` and `HttpHeaders` — Understand · 🔲 not written
- **Read this:** [Making HTTP requests](https://angular.dev/guide/http/making-requests) · angular.dev · `HttpParams` and `HttpHeaders` instances "are immutable and cannot be directly changed"; methods like `append()` and `set()` return a new instance (*read*) · covers our angle: **partial** — states immutability, does not show the dropped-parameter bug · fetched 2026-10-13
- **Also good:** [HttpParams](https://angular.dev/api/common/http/HttpParams) · angular.dev API · "This class is immutable; all mutation operations return a new instance" (*read*; the page says nothing on encoding or `fromObject`) · fetched 2026-10-13
- **Also good:** [Making HTTP requests](https://angular.dev/guide/http/making-requests) · angular.dev · "Custom parameter encoding": by default `HttpParams` uses the built-in `HttpUrlEncodingCodec`, and you can supply your own `HttpParameterCodec` (*read*; the page does not list which characters are left unencoded) · fetched 2026-10-13
- **Our delta:** the silently dropped parameter and the encoding rules (which characters the default codec leaves alone is not stated on either page; check the source before writing it). No third-party page was verified for this row (search budget).

### T09-07 · `HttpContext` and `HttpContextToken` — Understand · 🔲 not written
- **Read this:** [Interceptors](https://angular.dev/guide/http/interceptors) · angular.dev · the context "functions as a typed map, with keys of type HttpContextToken"; token takes a factory for its default; context is mutable so changes survive a retry (*read* that section) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [What the heck is HttpContext in Angular?](https://dev.to/angular/what-the-heck-is-httpcontext-in-angular-4n3c) · Adithya Sreyaj, DEV Community, 2022-02-01 · worked example that skips the auth header for login and signup; notes cloned requests share the context · fetched 2026-10-13 (*read*)
- **Our delta:** "skip the auth header" and "do not retry this one" as two tokens in one interceptor chain.

### T09-08 · Retries and backoff — Understand · 🔲 not written
- **Read this:** [retry (RxJS)](https://rxjs.dev/api/index/function/retry) · RxJS · `count`, `delay` (number or function) and `resetOnSuccess` config (*read* the doc comment in the project's 7.x source file, [retry.ts](https://raw.githubusercontent.com/ReactiveX/rxjs/7.x/src/internal/operators/retry.ts), which returns 200; the rendered page is client-side and showed only a title) · covers our angle: **partial** — nothing on status codes or idempotency · fetched 2026-10-13
- **Beyond the docs:** [Power of RxJS when using exponential backoff](https://angularindepth.com/article/power-of-rxjs-when-using-exponential-backoff/) · Alex Okrushko, Angular In Depth, 2018-06-05 · exponential backoff with the `backoff-rxjs` package (`retryBackoff`, `shouldRetry`); old, predates the built-in `retry` config object, so use for the idea only · fetched 2026-10-13 (*read*)
- **Our delta:** which status codes to retry, and why a retried POST is a bug. No source found that covers idempotency for HttpClient.

### T09-09 · XSRF protection — Understand · 🔲 not written
- **Read this:** [Security: HttpClient XSRF/CSRF security](https://angular.dev/best-practices/security) · angular.dev · reads `XSRF-TOKEN`, sets `X-XSRF-TOKEN`, only on mutating requests to relative and same-origin URLs; "supports only the client half" so the backend must set the cookie and verify the header (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [withXsrfConfiguration](https://angular.dev/api/common/http/withXsrfConfiguration) · angular.dev API · `cookieName` and `headerName` options; incompatible with `withNoXsrfProtection` (*read*) · fetched 2026-10-13
- **Our delta:** the server side, worked through once. No third-party page was verified for this row (search budget).

### T09-10 · The transfer cache — Understand · 🔲 not written
- **Read this:** [Server-side rendering: Caching data when using HttpClient](https://angular.dev/guide/ssr) · angular.dev · "HttpClient caches outgoing network requests when running on the server"; options `includeHeaders`, `includePostRequests`, `filter` via `withHttpTransferCacheOptions`; off with `withNoHttpTransferCache` or `transferCache: false` per request; by default only GET and HEAD without `Authorization`, `Proxy-Authorization` or `Cookie` headers, not with credentials, and responses with `Set-Cookie` or no-store style `Cache-Control` are skipped (*read* that section) · covers our angle: **mostly full** — lists the default exclusions and the `filter` hook, but says little on why · fetched 2026-10-13
- **Beyond the docs:** [From Server to Browser: Angular TransferState Explained](https://abp.io/community/articles/from-server-to-browser-angular-transferstate-explained-m99zf8oh) · erdem çaygör, ABP.io, 2025-10-16 · manual TransferState, an interceptor (which can pick requests "based on URL patterns"), and the built-in cache side by side, with a pitfalls list · fetched 2026-10-13 (*read*)
- **Our delta:** the exclusion list and the reason for each. The page names `withHttpTransferCacheOptions` and `withNoHttpTransferCache`, never `withHttpTransferCache()` as the syllabus row writes it; fix the row. Whether any security advisories apply to this cache was not checked.

### T09-11 · Upload and download progress — Know · 🔲 not written
- **Read this:** [Making HTTP requests](https://angular.dev/guide/http/making-requests) · angular.dev · the "Receiving raw progress events" section: progress is off by default and enabled with `reportUploadProgress` and `reportDownloadProgress`; `observe: 'events'` with `HttpEventType.DownloadProgress`; "The default fetch backend of HttpClient does not support upload progress events and throws an error if you set reportUploadProgress"; use `withXhr()` for uploads (*read*) · covers our angle: **partial** — no progress-bar component and nothing on what 100% means · fetched 2026-10-13
- **Also good:** [Reactive data fetching with httpResource](https://angular.dev/guide/http/http-resource) · angular.dev · "Tracking download progress": `reportProgress: true` and a `progress` signal; the note that `reportProgress` is deprecated on `HttpClient` in favour of the two separate options (*read*) · [withFetch](https://angular.dev/api/common/http/withFetch) · the upload-progress limit (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Upload files in Angular with progress and a local server](https://transloadit.com/devtips/file-uploads-in-angular-a-comprehensive-guide/) · Kevin van Zonneveld, Transloadit, 2024-09-16 (page shows an update on 2026-09-21) · a full upload component: `observe: 'events'`, `HttpEventType.UploadProgress`, `provideHttpClient(withXhr())`, and that 100% means sent, not accepted; its code still passes `reportProgress: true`, which the v22 docs mark deprecated for `HttpClient`; vendor blog (*read*) · fetched 2026-10-13
- **Our delta:** a progress bar that is not a lie, and download progress.

### T09-12 · Class interceptors and the legacy path — Know · 🔲 not written
- **Read this:** [Interceptors](https://angular.dev/guide/http/interceptors) · angular.dev · class interceptors implement `HttpInterceptor`, register with the `HTTP_INTERCEPTORS` multi-provider, and need `withInterceptorsFromDi()`; order follows provider registration and "can be very hard to predict" in a hierarchical DI setup (*read*) · covers our angle: **partial** — no step-by-step migration, and the page does not use the word deprecated · fetched 2026-10-13
- **Also good:** [Setting up HttpClient](https://angular.dev/guide/http/setup) · angular.dev · `HttpClientModule` and `HttpClientXsrfModule` "are also deprecated"; a table maps `HttpClientModule` to `provideHttpClient(withInterceptorsFromDi(), withXhr())`; "Functional interceptors (through withInterceptors) have more predictable ordering and we recommend them over DI-based interceptors"; a caution that `HttpClientModule` in several injectors gives poorly defined interceptor behaviour (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How to create a functional interceptor in Angular](https://dev.to/seanbh/how-to-create-a-functional-interceptor-in-angular-kni) · seanbh, DEV Community, 2023-10-04 · class-to-function conversion; it quotes the then-current docs warning that "support for DI-provided interceptors may be phased out", wording the v22 pages no longer use · fetched 2026-10-13 (*read*)
- **Our delta:** the migration recipe for an older codebase (the setup page's table gives the provider mapping but no steps). An ITNext migration article came back 403 (*not fetchable — unverified*).

---

## Phase 10 — Forms, all three systems

### T10-01 · Three systems, and how to choose — Master · 🔲 not written
- **Read this:** [Comparing Signal Forms, Reactive and Template-driven](https://angular.dev/guide/forms/signals/comparison) · angular.dev · quick-comparison table and "Choose your approach" lists; Signal Forms listed as "Stable (v22+)" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Forms in Angular](https://angular.dev/guide/forms) · angular.dev · older two-way choice: reactive "if forms are a key part of your application", template-driven for "very basic form requirements" (*read*) · fetched 2026-10-13
- **Also good:** [Migrating from Reactive Forms](https://angular.dev/guide/forms/signals/migration) · angular.dev · "Top-down migration using `compatForm`": bring an existing `FormControl` with its validators into a signal form (*read* the opening section; fetched as 200) · fetched 2026-10-13
- **Beyond the docs:** [From Template Driven to Signal Driven: The Complete Evolution of Angular Forms](https://codemag.com/Article/264041/From-Template-Driven-to-Signal-Driven-The-Complete-Evolution-of-Angular-Forms) · Sonu Kapoor, CODE Magazine, March/April 2026 issue · history of all three plus a use-case comparison and a migration path where reactive and signal forms coexist; calls Signal Forms experimental in v21, now out of date; the author says he co-authored the typed forms RFC · fetched 2026-10-13 (*read* the intro, the history and the migration-roadmap passages)
- **Our delta:** the decision written once, as a rule per screen type.

### T10-02 · Reactive forms — Master · 🔲 not written
- **Read this:** [Reactive forms](https://angular.dev/guide/forms/reactive-forms) · angular.dev · one-line definitions of `FormControl`, `FormGroup`, `FormArray`, `FormBuilder`; sections on grouping, FormBuilder, dynamic forms, state and events (*read*) · covers our angle: **partial** — `FormRecord` is not in the headings · fetched 2026-10-13
- **Also good:** [Typed forms](https://angular.dev/guide/forms/typed-forms) · angular.dev · has the `FormRecord` section: "The FormRecord class is designed for" keys not known ahead of time (*read*) · fetched 2026-10-13
- **Our delta:** the model-first picture and `FormRecord`. No third-party page was verified for this row (search budget).

### T10-03 · Typed reactive forms — Master · 🔲 not written
- **Read this:** [Typed forms](https://angular.dev/guide/forms/typed-forms) · angular.dev · reset to initial value "instead of null" under `nonNullable`, which "affects the runtime behavior"; `NonNullableFormBuilder` as shorthand; each `Untyped` class keeps the pre-v14 semantics (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Strongly Typed Reactive Forms in Angular](https://angularindepth.com/article/strongly-typed-reactive-forms-in-angular/) · Preston Lamb, Angular In Depth, 2024-02-13 · why values are `string | null`, and that disabled controls leave the value type with `undefined` (use `getRawValue()`) · fetched 2026-10-13 (*read*)
- **Our delta:** what the generics promise and what they do not.

### T10-04 · Validators — Master · 🔲 not written
- **Read this:** [Validating form input](https://angular.dev/guide/forms/form-validation) · angular.dev · built-in and custom validators, "Cross-field validation" section, async validators, `updateOn` (*read* the headings and quoted lines) · covers our angle: **partial** — where the error message lives is left to the examples · fetched 2026-10-13
- **Also good:** [Validators API](https://angular.dev/api/forms/Validators) · angular.dev API · the built-in set including `compose` and `composeAsync` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular multiple field cross-field validation with reactive forms](https://jasonwatmore.com/angular-multiple-field-cross-field-validation-with-reactive-forms) · Jason Watmore, 2023-02-20 · Angular 15.1.5; a `MustMatch` validator that puts the error on the confirm-password control so the template reads it like any field error · fetched 2026-10-13 (*read*)
- **Our delta:** group-level versus control-level error placement, stated as a choice. An ITNext cross-field article returned 403 (*not fetchable — unverified*).

### T10-05 · Signal forms — `form()` and the field tree — Master · 🔲 not written
- **Read this:** [Form models](https://angular.dev/guide/forms/signals/models) · angular.dev · `form()` "creates a field tree - a special object structure that mirrors your model's shape" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Forms with Angular Signals](https://angular.dev/guide/forms/signals/overview) · angular.dev · overview, prerequisites ("Angular v21 or higher"), setup (*read*) · [Form model design](https://angular.dev/guide/forms/signals/model-design) · form model versus domain model, with an appointment example (*read* the opening section) · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Forms - Part 1](https://blog.ninja-squad.com/2025/11/04/angular-signal-forms-part-1) · Cédric Exbrayat, Ninja Squad, 2025-11-04 · a `FieldTree` is both an object and a function returning a `FieldState`; walks `form()`, `submit()` and validators; written for v21, uses `[field]` and calls the API experimental · fetched 2026-10-13 (*read*)
- **Our delta:** the field tree against hand-built controls, on the v22 API.

### T10-06 · Binding fields to controls — Master · 🔲 not written
- **Read this:** [Custom controls](https://angular.dev/guide/forms/signals/custom-controls) · angular.dev · `FormValueControl` requires a `value` model signal and no `checked`; `FormCheckboxControl` requires `checked` and no `value` (*read*) · covers our angle: **partial** — `submit()` is not on this page · fetched 2026-10-13
- **Also good:** [Form submission](https://angular.dev/guide/forms/signals/form-submission) · angular.dev · `submit()`, `FormRoot`, `submitting()`; "If any validation rules have failed, submission stops and the action function does not run" (*read*) · [FormField API](https://angular.dev/api/forms/signals/FormField) · the binding directive (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Forms - Part 2](https://blog.ninja-squad.com/2025/11/14/angular-signal-forms-part-2) · Cédric Exbrayat, Ninja Squad, 2025-11-14 · the "Custom form components with FormValueControl and FormCheckboxControl" section and a `submit()` example that returns a server error with a `kind`; v21 naming (`Field` directive) · fetched 2026-10-13 (*read*)
- **Our delta:** the directive is `FormField` in v22; the syllabus row says `Field`.

### T10-07 · Template-driven forms — Understand · 🔲 not written
- **Read this:** [Building a template-driven form](https://angular.dev/guide/forms/template-driven-forms) · angular.dev · `[(ngModel)]` needs a `name` attribute; `NgForm` "Creates a top-level FormGroup instance and binds it to a form element" (*read*) · covers our angle: **partial** — `NgModelGroup` appears only as a one-line directive summary · fetched 2026-10-13
- **Beyond the docs:** [Template-driven Forms in Angular](https://blog.thoughtram.io/angular/2016/03/21/template-driven-forms-in-angular-2.html) · Pascal Precht, thoughtram, 2016-03-21 · `ngForm`, `ngModel` and `ngModelGroup` explained from first principles; written for Angular RC2, so the setup and bootstrapping are outdated and only the concepts hold · fetched 2026-10-13 (*read*)
- **Our delta:** when it is the right amount of machinery.

### T10-08 · Async validators — Understand · 🔲 not written
- **Read this:** [Validating form input](https://angular.dev/guide/forms/form-validation) · angular.dev · "Creating asynchronous validators" and "Optimizing performance of async validators" (`updateOn`); async runs only after sync validation passes (*read*) · covers our angle: **partial** — debounce and request-flood point not made · fetched 2026-10-13
- **Our delta:** debouncing the request, and why a call per keystroke is a self-inflicted load problem. The Angular Training async-validator article returned 403 (*not fetchable — unverified*), so no third-party pick.

### T10-09 · Control state and events — Understand · 🔲 not written
- **Read this:** [Unified Control State Change Events in Angular 18](https://angularindepth.com/article/unified-control-state-change-events-in-angular-18/) · Grzegorz Dąbrowski, Angular In Depth, 2024-06-26 · `ValueChangeEvent`, `StatusChangeEvent`, `PristineChangeEvent`, `TouchedChangeEvent`, `FormSubmittedEvent`, `FormResetEvent`; `source`, propagation up nested groups, filtering with RxJS (*read*) · covers our angle: **full** — a better explanation than the guide's short section · fetched 2026-10-13
- **Also good:** [Reactive forms](https://angular.dev/guide/forms/reactive-forms) · angular.dev · "Unified control state change events": one `events` stream on every `AbstractControl` for value, status, pristine, touched, reset and submit (*read*) · [ControlEvent API](https://angular.dev/api/forms/ControlEvent) · (*headings only*) · fetched 2026-10-13
- **Our delta:** showing an error at the right moment, using touched plus the event stream.

### T10-10 · `ControlValueAccessor` — Understand · 🔲 not written
- **Read this:** [ControlValueAccessor](https://angular.dev/api/forms/ControlValueAccessor) · angular.dev API · "a bridge between the Angular forms API and a native element in the DOM"; `writeValue`, `registerOnChange`, `registerOnTouched`, optional `setDisabledState` (*read*) · covers our angle: **partial** — reference only, no `NG_VALUE_ACCESSOR` walkthrough · fetched 2026-10-13
- **Beyond the docs:** [Avoiding common pitfalls with ControlValueAccessors in Angular](https://valor-software.com/articles/avoiding-common-pitfalls-with-controlvalueaccessors-in-angular) · Dmitriy Stepanenko, Valor Software, 2023-01-17 · `onChange` and `onTouched` should not always be called together; do not call `onChange` from `writeValue`; `reset()` passes `null` · fetched 2026-10-13 (*read*)
- **Also good:** [Angular Signal Forms - Part 2](https://blog.ninja-squad.com/2025/11/14/angular-signal-forms-part-2) · Cédric Exbrayat, Ninja Squad, 2025-11-14 · "Custom form components that use ControlValueAccessor are still supported in signal forms, but it's recommended to use these new interfaces for new components" (*read*) · fetched 2026-10-13
- **Our delta:** which contract to prefer for new work: the angular.dev custom-controls page does not mention `ControlValueAccessor`, so the recommendation rests on the Ninja Squad sentence above.

### T10-11 · Signal-form schemas — Understand · 🔲 not written
- **Read this:** [Schemas and schema composability](https://angular.dev/guide/forms/signals/schemas) · angular.dev · `schema()`, `apply()`, `applyWhen()`, `applyWhenValue()`, `applyEach()`, each with a quoted definition (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Forms - Part 2](https://blog.ninja-squad.com/2025/11/14/angular-signal-forms-part-2) · Cédric Exbrayat, Ninja Squad, 2025-11-14 · `apply()` of a named schema and `applyEach()` over arrays and objects; says conditions need `applyWhen`; v21 era · fetched 2026-10-13 (*read*)
- **Our delta:** reuse across screens for a nested model.

### T10-12 · Signal-form validation rules — Understand · 🔲 not written
- **Read this:** [Signal forms validation](https://angular.dev/guide/forms/signals/validation) · angular.dev · `required()`, `email()`, `min()`/`max()`, `minLength()`/`maxLength()`, `pattern()`, `validate()`, `validateTree()` (*read*) · covers our angle: **partial** — `minDate` and `maxDate` are not mentioned on the page · fetched 2026-10-13
- **Also good:** [Cross-field logic](https://angular.dev/guide/forms/signals/cross-field-logic) · angular.dev · the field context (`value`, `state`, `fieldTree`) and `valueOf()` and `stateOf()` for reading other fields (*read* the opening section) · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Forms - Part 1](https://blog.ninja-squad.com/2025/11/04/angular-signal-forms-part-1) · Cédric Exbrayat, Ninja Squad, 2025-11-04 · built-in validators, the shape of a `ValidationError` (`kind`, `field`, `message`) and `metadata(REQUIRED)` for required markers · fetched 2026-10-13 (*read*)
- **Our delta:** confirm `minDate` and `maxDate` against the `.d.ts` before writing them.

### T10-13 · `validateAsync()` and `validateHttp()` — Understand · 🔲 not written
- **Read this:** [Async operations in signal forms](https://angular.dev/guide/forms/signals/async-operations) · angular.dev · `validateHttp()` for REST ("the most common form"), `validateAsync()` "a lower-level API that exposes Angular's resource primitive directly", `pending()`, `debounce` option (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [How to Add Async HTTP Validators to Angular Signal Forms](https://certificates.dev/blog/how-to-add-async-http-validators-to-angular-signal-forms) · Alain Chautard, certificates.dev, 2026-07-14 · `request`, `onSuccess`, `onError`; requests cancel when the value changes; async runs only after sync rules pass; its `onError` example appears to contradict its own "process failures only" rule, so check it against the guide · fetched 2026-10-13 (*read*)
- **Our delta:** the resource semantics underneath.

### T10-14 · Standard Schema integration — Understand · 🔲 not written
- **Read this:** [validateStandardSchema](https://angular.dev/api/forms/signals/validateStandardSchema) · angular.dev API · validates a field with a `StandardSchemaV1`-compatible validator (e.g. a Zod validator); marked "stable since v22.0" (*read*) · [Signal forms validation](https://angular.dev/guide/forms/signals/validation) · the "Integration with schema validation libraries" section names Zod and Valibot and accepts a signal for dynamic schemas (*read*) · covers our angle: **partial** — one-definition-for-form-and-API-parse is not made · fetched 2026-10-13
- **Beyond the docs:** [Follow-Up: Simplifying Zod Validation in Angular Signal Forms with validateStandardSchema](https://briantree.se/angular-signal-forms-zod-validation-validatestandardschema/) · Brian Treese, 2025-12-25 · replaces a hand-written `validateTree()` bridge with one call; Angular maps errors to fields and clears them; does not mention Valibot (names Yup and Joi) · fetched 2026-10-13 (*read*)
- **Also good:** [Standard Schema](https://standardschema.dev/) · the spec site: "a set of interfaces that standardize the provision and consumption of shared functionality in the TypeScript ecosystem" (*read* the intro) · fetched 2026-10-13
- **Our delta:** the same schema parsing the API response (see T09-02).

### T10-15 · Field logic and metadata — Understand · 🔲 not written
- **Read this:** [Adding form logic](https://angular.dev/guide/forms/signals/form-logic) · angular.dev · disabled fields skip validation; `readonly()` keeps focus and selection; "there is no native DOM property for hidden state" so use `@if` or CSS; `metadata()`; `debounce()` "delays updating the form model" (*read*) · covers our angle: **partial** — custom metadata keys are on a separate page · fetched 2026-10-13
- **Also good:** [Field metadata](https://angular.dev/guide/forms/signals/field-metadata) · angular.dev · built-in `REQUIRED` metadata behind `.required()`, and "Creating a metadata key" with `createMetadataKey()`, one key defined once at module scope (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Signal Forms - Part 2](https://blog.ninja-squad.com/2025/11/14/angular-signal-forms-part-2) · Cédric Exbrayat, Ninja Squad, 2025-11-14 · "Dynamic behavior" (enable, hide, add validators from other fields; use `applyWhen`) and a `debounce()` section; v21 era · fetched 2026-10-13 (*read*)
- **Our delta:** when to reach for custom metadata rather than a component signal.

### T10-16 · Dynamic forms — Know · 🔲 not written
- **Read this:** [Building dynamic forms](https://angular.dev/guide/forms/dynamic-forms) · angular.dev · a metadata model of question classes becomes a `FormGroup` through `QuestionControlService.toFormGroup()`; the template renders by `controlType` (*read*) · covers our angle: **partial** — says nothing about the type safety you give up · fetched 2026-10-13
- **Also good:** [Dynamic forms with JSON](https://angular.dev/guide/forms/signals/dynamic-forms-with-json) · angular.dev · the signal-forms version: when a backend, CMS or tenant defines the fields; a typed field config as a discriminated union by `kind`; "Static forms get full TypeScript checking on every field" (*read* the opening sections) · fetched 2026-10-13
- **Beyond the docs:** [A new approach to have dynamic forms in Angular](https://angularindepth.com/article/a-new-approach-to-have-dynamic-forms-in-angular/) · Mateo Tibaquirá, Angular In Depth, 2021-04-15 · argues for "a strictly typed, serializable configuration object" on top of Angular forms and has a "Typing the Configuration Object" section; it promotes the author's `@myndpm/dyn-forms` library and predates signal forms · fetched 2026-10-13 (*read* the intro and headings)
- **Our delta:** the loss of type safety when the control tree comes from config.

---

## Phase 11 — Architecture, state and UI

### T11-01 · Where state lives — Master · 🔲 not written
- **Read this:** [Angular Signals & Your Architecture: 5 Options](https://www.angulararchitects.io/blog/angular-signals-your-architecture-5-options) · Manfred Steyer, 2023-05-20 · signals in the component, in a service, behind a service with private writables, in a Redux-style store, and a store behind a facade (*read*) · covers our angle: **partial** — 2023 article, predates `@ngrx/signals` guidance and the v22 stack · fetched 2026-10-13
- **Also good:** [Decision guide: Angular state management](https://www.telerik.com/blogs/decision-guide-angular-state-management-signals-services-signalstore-ngrx) · Dany Paredes, Telerik, 2026-09-09 · a table from one component (signals) through 2 to 10 components (service) to SignalStore and NgRx; the post is on the Kendo UI vendor blog and its examples use Kendo components (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular 22 State Management: Signals, SignalStore, or NgRx?](https://abp.io/community/articles/angular-22-state-management-signals-signalstore-or-ngrx-yq8zg0nw) · Sumeyye Kurtulus, ABP.io, 2026-06-30 · picks by the scope of the state: component signals, service, feature SignalStore, global NgRx Store · fetched 2026-10-13 (*read*)
- **Our delta:** the promotion rule from one level to the next, written down.

### T11-02 · The service-with-signals store — Master · 🔲 not written
- **Read this:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · `asReadonly()`, `set()`/`update()`, referential equality by default; readonly signals do not stop deep mutation (*read*) · covers our angle: **partial** — no store pattern as such · fetched 2026-10-13
- **Beyond the docs:** [Angular Signals & Your Architecture: 5 Options](https://www.angulararchitects.io/blog/angular-signals-your-architecture-5-options) · Manfred Steyer, 2023-05-20 · options 3 and 3a: private writable signals exposed with `asReadonly()`, and one private `state` signal with `computed` views · fetched 2026-10-13 (*read*)
- **Our delta:** how far it scales before it stops.

### T11-03 · Smart and presentational components — Understand · 🔲 not written
- **Read this:** [Implementing Smart and Presentational Components with Angular](https://www.thinktecture.com/en/angular/smart-and-presentational-components-with-angular/) · Max Marschall, Thinktecture, 2023-01-23 · splits a dropdown into focused components with content projection and templates passed in; Angular 10+, decorator inputs, no signals (*read* via the print copy of the same article) · covers our angle: **partial** — no `input()` or `output()` · fetched 2026-10-13
- **Also good:** [Inputs](https://angular.dev/guide/components/inputs) · angular.dev · `input()`, `input.required()` (build-time error), `transform` (*read*) · [Outputs](https://angular.dev/guide/components/outputs) · the `output` function and emitting data (*read*) · fetched 2026-10-13
- **Our delta:** the boundary enforced by `input()` and `output()`, and what it buys in tests.

### T11-04 · `@ngrx/signals` and `signalStore` — Understand · 🔲 not written
- **Read this:** [SignalStore](https://ngrx.io/guide/signals/signal-store) · NgRx · creating a store, `withState`, `withComputed`, `withMethods`, reactive methods with `rxMethod` (*read* via the page's source markdown in the ngrx/platform repo; the rendered page is client-side) · covers our angle: **partial** — no sizing advice · fetched 2026-10-13
- **Our delta:** entities and devtools, and the size of app where it pays. A search turned up an ITNext "Architecting Angular" series; the page returned 403 (*not fetchable — unverified*).

### T11-05 · Angular CDK — Understand · 🔲 not written
- **Read this:** [CDK Overlay](https://material.angular.dev/cdk/overlay/overview) · Angular Material docs · creating overlays, position strategies, scroll strategies, the overlay container (*read* via the source markdown in the angular/components repo; the rendered page is client-side) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [CDK a11y](https://material.angular.dev/cdk/a11y/overview) · `FocusTrap` and `LiveAnnouncer` each have their own heading (*read* via source markdown) · [Portal](https://material.angular.dev/cdk/portal/overview) · a `Portal` is a component, a `TemplateRef` or a DOM element rendered into a `PortalOutlet` (*read* via source markdown) · [Scrolling](https://material.angular.dev/cdk/scrolling/overview) · `cdkScrollable` and `ScrollDispatcher` (*read* via source markdown) · [Dialog](https://material.angular.dev/cdk/dialog/overview) · "unstyled modal dialogs" and the structural styles you must include (*read* via source markdown) · [Drag and drop](https://material.angular.dev/cdk/drag-drop/overview) · the source page only points to [angular.dev drag and drop](https://angular.dev/guide/drag-drop), whose overview lists free dragging, reorderable lists and transfer between lists (*read*) · fetched 2026-10-13
- **Our delta:** which parts to reach for. The web-search budget ran out before a second query; no third-party pick.

### T11-06 · Accessibility in an Angular app — Understand · 🔲 not written
- **Read this:** [Accessibility in Angular](https://angular.dev/best-practices/a11y) · angular.dev · "Use the NavigationEnd event from the Router service to know when to update focus"; avoid focus returning to the body after a route change; `LiveAnnouncer` announces through an aria-live region (*read*) · covers our angle: **partial** — no section on announcing async results or testing with harnesses · fetched 2026-10-13
- **Also good:** [CDK a11y](https://material.angular.dev/cdk/a11y/overview) · `FocusTrap`, `LiveAnnouncer` (*read* via source markdown) · fetched 2026-10-13
- **Our delta:** announcing async results and CDK harness tests. No third-party pick (budget ran out).

### T11-07 · Project structure — Understand · 🔲 not written
- **Read this:** [Angular coding style guide](https://angular.dev/style-guide) · angular.dev · "Project structure": organise by feature area, avoid subdirectories by code type; says nothing on barrel files (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** the `core`/`shared` critique, route-level providers, barrel files as a circular-import source. No third-party pick (budget ran out).

### T11-08 · Immutability with signals — Understand · 🔲 not written
- **Read this:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · signals use referential equality (`Object.is()`); a custom `equal` function can treat a new array as unchanged; readonly signals offer no deep-mutation protection (*read*) · covers our angle: **partial** — no dedicated immutable-update patterns, which the page itself lacks · fetched 2026-10-13
- **Our delta:** the update patterns for nested objects and arrays, and when a structural-sharing helper pays. No third-party pick (budget ran out).

### T11-09 · Angular Material 22 — Know · 🔲 not written
- **Read this:** [Theming Angular Material](https://material.angular.dev/guide/theming) · Angular Material · `mat.theme` takes colour, typography and density and emits CSS variables from design tokens; `--mat-sys-*` system variables; `mat.theme-overrides`; light and dark through `light-dark()` (*read* via the guide's source markdown in the angular/components repo) · covers our angle: **partial** — nothing on adopting it wholesale or not · fetched 2026-10-13
- **Also good:** [Component categories](https://material.angular.dev/components/categories) · the component set (*not fetchable — unverified*; shell only) · fetched 2026-10-13
- **Our delta:** the for-and-against. A Medium token article returned 403 (*not fetchable — unverified*).

### T11-10 · NgRx Store and the Redux pattern — Know · 🔲 not written
- **Read this:** [Store](https://ngrx.io/guide/store) · NgRx · key concepts, and "Local state management": Store is mainly for global state and NgRx Signals suits local state (*read* via source markdown in the ngrx/platform repo) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Store walkthrough](https://ngrx.io/guide/store/walkthrough) · a book-list example that applies the key concepts end to end (*read* the opening via source markdown in the ngrx/platform repo; the rendered page is client-side) · fetched 2026-10-13
- **Beyond the docs:** [NgRx – An Angular Architect's First Experiences](https://www.thinktecture.com/angular/should-i-use-ngrx-an-angular-achitects-experiences/) · Yannick Baron, Thinktecture, 2021-05-10 · when NgRx fits (medium to large apps, a team fluent in reactive principles) and "Not Everything Goes into the Store": the author found projects that put everything in the store, giving a global state with hundreds of properties; pre-signals · fetched 2026-10-13 (*read*)
- **Our delta:** the applications where it is still the right answer.

### T11-11 · Internationalisation — When Needed · 🔲 not written
- **Read this:** [Angular internationalization](https://angular.dev/guide/i18n) · angular.dev · "Localization is the process of building versions of your project for different locales"; headings for adding the localize package, preparing a component, translation files, merging, deploying (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Deploy multiple locales](https://angular.dev/guide/i18n/deploy) · angular.dev · `localize` in `angular.json` set to `true` or an array of locales produces one version per locale, each in its own sub-path (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Internationalization with @angular/localize](https://blog.ninja-squad.com/2019/12/10/angular-localize/) · Cédric Exbrayat, Ninja Squad, 2019-12-10 · what `$localize` is and why one compile plus per-locale inlining replaced a full build per locale; Angular 9, so details may have changed · fetched 2026-10-13 (*read*)
- **Our delta:** why the approach yields one build output per locale.

### T11-12 · Experimental Web MCP tools — When Needed · 🔲 not written
- **Read this:** [WebMCP](https://angular.dev/ai/webmcp) · angular.dev · `provideExperimentalWebMcpTools`, `declareExperimentalWebMcpTool`, `provideExperimentalWebMcpForms`; "APIs are subject to change even outside of major versions" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Angular WebMCP: Your App Is Now an AI Tool](https://dev.to/gdg/angular-webmcp-your-app-is-now-an-ai-tool-3bp4) · Giorgio Galassi, DEV Community (GDG), page shows "August 8" with no year · defining a tool backed by a real service, registering it, and the security risks of tools that change state; Angular 22 · fetched 2026-10-13 (*read*)
- **Our delta:** recognise it and label it experimental.
