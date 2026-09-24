---
name: research-nextjs-ch7-error-handling
description: Banked verbatim primary-source research for Next.js ch7 (error handling, loading states, resilience) — error model, streaming failures, Server Action contracts, Route Handler errors, loading.js vs Suspense, retry/degradation. Seven fetches, 2026-09-04. DO NOT RE-FETCH.
metadata:
  type: project
---

# Next.js ch7 research bank — 2026-09-04, session `c08ab631`

🔴 **DO NOT RE-DERIVE.** Seven fetches cover the whole chapter. Sibling banks:
[[progress-nextjs-ch7-boundary-hierarchy]] (the `error.js` reference, already banked verbatim —
component hierarchy, `global-error`, Version History) and
[[progress-nextjs-ch7-retry-reset-collision]] (`retry()` vs `reset()`, the S1). **Neither is
repeated here.** Cursor: [[cursor-nextjs]].

## Sources and their real review dates

`nextjs.org/docs` serves Markdown — append `.md`. `version:` is the docs build (**16.3.4**
everywhere, so it is not evidence about a page); `lastUpdated:` is the page's own review date.

| Page | URL | `lastUpdated` |
|---|---|---|
| Error Handling (guide) | `/docs/app/getting-started/error-handling` | **2026-06-10** |
| `loading.js` (reference) | `/docs/app/api-reference/file-conventions/loading` | **2026-06-08** |
| Streaming (guide) | `/docs/app/guides/streaming` | **2026-08-25** |
| `route.js` (reference) | `/docs/app/api-reference/file-conventions/route` | **2026-04-30** |
| `unstable_rethrow` | `/docs/app/api-reference/functions/unstable_rethrow` | **2026-03-03** |
| Server Actions and Mutations | `/docs/app/guides/server-actions` | **2026-06-17** |
| `not-found.js` (reference) | `/docs/app/api-reference/file-conventions/not-found` | **2026-07-10** |

⚠️ `/docs/app/getting-started/updating-data` **does not exist** — the page is
`/docs/app/getting-started/mutating-data`. A wrong path returns a readable "Page Not Found"
body that summarises like content. Resolve through `/docs/sitemap.md` first.

## 1 · The two-category model (Error Handling guide)

> *"Errors can be divided into two categories: expected errors and uncaught exceptions."*

**Expected** — *"those that can occur during the normal operation of the application, such as
those from server-side form validation or failed requests. These errors should be handled
explicitly and returned to the client."*
**Uncaught** — *"unexpected errors that indicate bugs or issues that should not occur during
the normal flow of your application. These should be handled by throwing errors, which will
then be caught by error boundaries."*

For Server Functions: *"avoid using `try`/`catch` blocks and throw errors. Instead, model
expected errors as return values."* Surfaced with `useActionState`; the rendered message
carries `aria-live="polite"`.

Server Components: use the response to *"conditionally render an error message or `redirect`"*.

> *"Errors will bubble up to the nearest parent error boundary."*

Event handlers: *"Error boundaries don't catch errors inside event handlers. They're designed
to catch errors during rendering to show a fallback UI instead of crashing the whole app."*
*"In general, errors in event handlers or async code aren't handled by error boundaries because
they run after rendering."* Catch manually, store with `useState`/`useReducer`.
🔴 *"unhandled errors inside `startTransition` from `useTransition`, will bubble up to the
nearest error boundary."*

`global-error.js` — *"Global error UI must define its own `<html>` and `<body>` tags, since it
is replacing the root layout or template when active."*

## 2 · `not-found.js` — the status-code split

**Two conventions**: `not-found.js` (thrown `notFound()` inside a segment) and
`global-not-found.js` (**experimental**, `experimental.globalNotFound`, for URLs matching no
route at all — *"Next.js **skips rendering** and directly returns this global page"*).

🔴 The load-bearing sentence, and it is the one people get wrong:

> *"Next.js will return a `200` HTTP status code for streamed responses, and `404` for
> non-streamed responses"*

Hierarchy: *"`not-found.js` renders between `loading.js` and `page.js`. It is wrapped by the
`<Suspense>` boundary from `loading.js` and the error boundary from `error.js` in the same
segment."*

- **No props.** `not-found.js` and `global-not-found.js` *"do not accept any props"* — so it
  cannot know *what* was not found. `usePathname` needs a Client Component.
- Root `app/not-found.js` *"handles any unmatched URLs for your whole application"* (v13.3.0).
- Default UI follows `prefers-color-scheme` and **does not read an app-level theme**.
- `global-not-found.js` must return a full HTML document and **bypasses the layout**, so global
  styles, fonts and the theme must be imported inside it.
- Next.js *"automatically injects `<meta name="robots" content="noindex" />` for pages that
  return a 404 status code"*.
- Version History: `v15.4.0` `global-not-found.js` (experimental) · `v13.3.0` root handles
  unmatched URLs · `v13.0.0` `not-found` introduced.

## 3 · Streaming — the HTTP contract (Streaming guide, the richest source)

**Error handling mid-stream, verbatim:**

> *"If a component throws an error after streaming has started, the nearest `error.js` boundary
> catches it and renders the error UI in place of the failed component. The rest of the page
> remains intact, only the section that errored is replaced."*
> *"Because the HTTP status code (`200 OK`) has already been sent with the first chunk, it
> cannot be changed to a `4xx` or `5xx`."*

> *"**You cannot change the status code or headers after streaming starts.**"*

- `notFound()` mid-stream → cannot become 404; *"it injects `<meta name="robots"
  content="noindex">` into the streamed HTML"*. `redirect()` mid-stream *"becomes a client-side
  redirect rather than an HTTP redirect header"*.
- **When streaming starts:** *"The response body begins streaming when a Suspense fallback
  renders (for example, a `loading.tsx`) or when a component suspends under a `<Suspense>`
  boundary."* → *"place `notFound()` **before** any `await` or `<Suspense>` boundary"* for a
  real status code. A fast existence check before the boundary is the documented shape.
- Escape hatch: *"reject requests early using `proxy` … or `next.config.js` redirects. Both run
  before the page renders, so HTTP status codes are still available."*
- **Boundaries are independent:** *"Each `<Suspense>` boundary is an independent streaming
  point. Components inside different boundaries resolve and stream in independently. They don't
  block each other."*
- **Prerender failure:** *"When the prerenderer encounters dynamic work, it walks up the tree
  looking for the nearest Suspense boundary. If none is found, the build fails with a blocking
  route error"* (`/docs/messages/blocking-prerender-dynamic`). 🔴 *"A `loading.js` high in the
  tree is a valid boundary, so the framework finds it and stops, but now the entire page falls
  back to a full-page skeleton instead of streaming granularly."*
- 🔴 **The boundary you add may be used when you did not expect it:** *"As a rule of thumb, if
  there's a Suspense boundary, React might use it. Under a slow network or a busy CPU,
  concurrent rendering can fall back to it even when you didn't expect it. Adding a boundary
  means accepting that, so don't add one you don't need."*
- LCP: React *"also holds back a large boundary, because sending its HTML takes time"*; an
  image inside a boundary still waits for the swap even with `preload`.
- CLS: skeletons must *"match the dimensions of the content they represent"*; fixed or
  min-height containers reserve the space.
- INP: *"Each `<Suspense>` boundary is a hydration unit. Without them, React hydrates the entire
  page in one blocking pass."*
- **What silently defeats streaming:** Nginx and similar reverse proxies buffer by default
  (`X-Accel-Buffering: no`); CDNs may buffer whole responses; **AWS Lambda requires response
  streaming mode explicitly enabled, it is not the default**; gzip/Brotli buffer chunks
  internally; Safari/WebKit buffers until **1024 bytes**; `curl` buffers and even `-N` relies on
  newlines to flush. Static export: **streaming not supported**.
- Bots: HTML-limited bots get blocking metadata and *"the server waits for the full render and
  sends one fully formed HTML document instead of streaming"*. With Cache Components an
  HTML-limited bot **re-renders the shell dynamically**, so *"a page that loads for a person can
  fail to render for a crawler"* when the shell depends on build-time-only inputs.

## 4 · `loading.js` vs inline `<Suspense>`

> *"In the component hierarchy, `loading.js` wraps `not-found.js`, `page.js`, and nested
> `layout.js` files in a `<Suspense>` boundary. It does **not** wrap the `layout.js`,
> `template.js`, or `error.js` in the same segment."*

🔴 The trap that makes a skeleton never appear:

> *"If the layout accesses uncached or runtime data (e.g. `cookies()`, `headers()`, or uncached
> fetches), `loading.js` will not show a fallback for it."*
> **Without Cache Components:** *"Navigation blocks until the layout finishes rendering."*
> **With Cache Components:** the access *"must be explicitly wrapped in `<Suspense>`, otherwise
> Next.js guides you with a build-time error."*

Fix: move uncached fetching from `layout.js` into `page.js`, or wrap the layout's runtime access
in its own boundary.

Documented comparison table: `loading.js` — scope *entire page*, setup *drop in a file*,
navigation **prefetched as instant fallback**, best for *"pages where nothing renders without
data"*. `<Suspense>` — scope *any component*, setup *wrap explicitly*, **not prefetched by
default**, best for *"most pages, for granular control"*. Guidance: *"Prefer explicit
`<Suspense>` boundaries close to the dynamic access."*

Other behaviour: fallback UI is prefetched; *"Navigation is interruptible"*; *"Shared layouts
remain interactive while new route segments load."* Loading components *"do not accept any
parameters"*. Server Component by default, `'use client'` allowed. Streaming returns **200**.
Version History: **`v13.0.0` `loading` introduced** — one row only.

Push dynamic access down: *"If you `await` any of these at the top of a layout or page,
everything below that point becomes dynamic and cannot be prerendered as part of the static
shell."* Pass the promise (`params`, `searchParams`, `cookies()`) into a component inside the
boundary, or unwrap inline with `params.then(({ category }) => …)`.

## 5 · Server Actions — the contract (Server Actions guide)

- **Sequential dispatch:** *"Next.js dispatches Server Actions one at a time per client."*
  → *"do not rely on `Promise.all` to parallelize Server Actions from the client."* Parallel
  work goes **inside one action**, or a Route Handler for non-mutations. It is *"a property of
  the client dispatcher, not of Server Functions in general."*
- **One response carries both** the action's return value and a re-rendered RSC Payload — no
  follow-up fetch. Included when the action calls `updateTag`, `revalidatePath`, `refresh`,
  **mutates cookies**, or calls `redirect`.
- 🔴 *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag
  for background refresh and does **not** include a re-render in the action response."*
- *"Because `redirect` throws a control-flow exception, any code after it does not run. Place
  revalidation calls before `redirect` if the destination needs the fresh data."*
  Unlike `redirect`, `updateTag`/`revalidatePath`/`refresh` **do not throw**.
- **Security:** an action *"runs as a POST request against the page that invokes it"*; the
  implementation stays server-side but *"the route is reachable to anyone who can send the same
  POST. Treat every action as an untrusted entry point."* Framework protections: **CSRF**
  (`Origin` vs `Host`/`X-Forwarded-Host`, configure `serverActions.allowedOrigins`), **1MB body
  limit** by default (`serverActions.bodySizeLimit`), **encrypted action IDs + dead-code
  elimination**, **closure variable encryption** (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be
  stable across instances).
- *"Render-time gating (only rendering a form on an authenticated page) is not a security
  boundary."* *"Constrain return values"* — they are serialized to the client.
- 🔴 *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed
  `Item` object can still refer to a row the caller does not own."* Send an **ID plus the
  change**, re-read the rest from a trusted source keyed by session.
- With experimental `authInterrupts`, throw `unauthorized()` / `forbidden()` instead.
- **Deployment:** action IDs are build artifacts; *"Next.js rotates them at most every 14 days,
  even when the source is unchanged"*, so an old client can invoke a dead ID — the error is
  **"Failed to find Server Action"**. Mitigate with rolling deploys, a stable encryption key,
  and *"Surface the error as a retry path in the UI rather than a hard failure."*

## 6 · Route Handlers (`route.js`)

Methods: `GET POST PUT PATCH DELETE HEAD OPTIONS`. *"If `OPTIONS` is not defined, Next.js will
automatically implement `OPTIONS` and set the appropriate Response `Allow` header depending on
the other methods defined."* `request` is a `NextRequest`; `context.params` is a **promise**.
`RouteContext<'/users/[id]'>` is **globally available** after types are generated by
`next dev` / `next build` / `next typegen`.

- `headers()` is **read-only** in a handler — *"To set headers, you need to return a new
  `Response` with new `headers`."*
- Documented webhook shape is a `try`/`catch` returning `new Response(\`Webhook error:
  ${error.message}\`, { status: 400 })`. 🔴 The reference does **not** define an error envelope
  format; that is the book's own recommendation and must be labelled as such.
- `redirect()` works inside a handler; segment config (`dynamic`, `revalidate`, `runtime`,
  `preferredRegion` — **deprecated**) applies.
- Version History: `v15.0.0-RC` `context.params` became a promise **and** *"The default caching
  for `GET` handlers was changed from static to dynamic"* · `v13.2.0` introduced.

## 7 · `unstable_rethrow` — still unstable at 16.3.4

> *"This feature is currently unstable and subject to change, it's not recommended for
> production."*

Rethrows framework control-flow throws so `try`/`catch` does not swallow them:
`notFound()`, `redirect()`, `permanentRedirect()` — plus, when a segment must stay static,
`cookies`, `headers`, `searchParams`, `fetch(…, { cache: 'no-store' })` and
`fetch(…, { next: { revalidate: 0 } })`. *"Note that Partial Prerendering (PPR) affects this
behavior as well."*

Rules: call it *"at the top of the catch block, passing the error object as its only argument"*;
works in a `.catch` handler; cleanup goes **before** the call or in `finally`; and the better
fix is often to *"encapsulate your API calls that throw and let the **caller** handle the
exception"*.

## Open / could not settle

- The docs do **not** state a retry-count, backoff or timeout policy for `retry()` — the book
  must not invent one.
- No documented way to change a status code once streaming has begun; the only levers are
  `proxy`, `next.config.js` redirects, or checking before the first `await`.
- `catchError` is covered by the already-written page `10`; not re-fetched here.
