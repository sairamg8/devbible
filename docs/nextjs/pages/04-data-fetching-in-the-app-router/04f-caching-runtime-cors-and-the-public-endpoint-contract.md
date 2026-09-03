---
title: "Configuring a Route Handler means choosing between two configuration worlds — the one where dynamic, revalidate and fetchCache exist and the one where Cache Components removed them — and then accepting the sentence the docs state without qualification: any client can access your endpoint"
sidebar_label: "04f · Config, runtime and CORS"
sidebar_position: 19
description: "The route segment config options a handler accepts and the four that v16 removes under Cache Components, opting a GET back into caching, runtime and maxDuration, CORS headers the automatic OPTIONS does not give you, and what 'publicly reachable' obliges you to do."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) (docs `lastUpdated` 2026-04-30, including its version history) and [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`lastUpdated` 2026-04-30) — the Revalidating Cached Data, CORS and Segment Config Options examples.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Two things about configuring a Route Handler are not what a 2024-era write-up will tell you. First, `GET` handlers have not been cached by default since `v15.0.0-RC` — [01d](01d-route-handlers-and-their-caching-model.md) settles that and this page assumes it. Second, and much less widely known: `v16.0.0` **removes** `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` when Cache Components is enabled, so the options you reach for depend on a flag in `next.config.js` rather than on the framework version alone. Everything else here is what you must supply because the framework deliberately does not: CORS headers, which the automatic `OPTIONS` handler does not give you; a timeout bound, which the platform rather than Next.js decides; and authorization, because the documentation says without qualification that any client can access a Route Handler.**

## The segment config a handler accepts — and the version boundary

The `route.js` reference shows a handler taking the same route segment configuration as pages and layouts:

```ts
// app/items/route.ts
export const dynamic = 'auto'
export const dynamicParams = true
export const revalidate = false
export const fetchCache = 'auto'
export const runtime = 'nodejs'
export const preferredRegion = 'auto' // deprecated
```

🔴 The Route Segment Config version history records that in `v16.0.0`, **`dynamic`, `dynamicParams`, `revalidate` and `fetchCache` are removed when Cache Components is enabled**, with the previous model documented separately under *Caching and Revalidating (Previous Model)*. The same release removed `export const experimental_ppr = true`, which has a codemod.

So there are two configuration worlds:

| | Cache Components **off** | Cache Components **on** |
|---|---|---|
| `dynamic` | ✅ `'auto'`, `'force-dynamic'`, `'error'`, `'force-static'` | ❌ removed |
| `revalidate` | ✅ `false` or a number of seconds | ❌ removed |
| `fetchCache` | ✅ | ❌ removed |
| `dynamicParams` | ✅ | see the note below |
| `runtime` | ✅ `'nodejs'` (default) \| `'edge'` (deprecated) | ✅ |
| `maxDuration` | ✅ number, default set by the platform | ✅ |
| `preferredRegion` | ⚠️ deprecated | ⚠️ deprecated |

⚠️ The documentation is not fully self-consistent on `dynamicParams`: the version-history entry lists it among the four removed under Cache Components, while the options table on the same page still lists it as available with a default of `true`. I could not settle that from the pages verified here — treat `dynamicParams` under Cache Components as unconfirmed and check it against your own build rather than assuming either reading.

The practical consequence is that **"add `export const revalidate = 60`" is advice with a precondition.** If your project has `cacheComponents: true`, that export is not the mechanism any more, and the model moves to `use cache` and `cacheLife` in a helper function — which [01d](01d-route-handlers-and-their-caching-model.md) covers, including the constraint that `'use cache'` cannot go directly in a handler body.

## Opting a `GET` back into caching

Without Cache Components, two exports do it:

```ts
// app/api/feature-flags/route.ts — recomputed at most once a minute
export const revalidate = 60

export async function GET() {
  const res = await fetch('https://config.acme.com/flags')
  return Response.json(await res.json())
}
```

```ts
// app/api/build-info/route.ts — evaluated once, at build
export const dynamic = 'force-static'

export async function GET() {
  return Response.json({ commit: process.env.GIT_SHA, builtAt: BUILD_TIMESTAMP })
}
```

The four `dynamic` values are worth knowing as a set, because two of them are diagnostics rather than settings. `'auto'` is the default. `'force-dynamic'` renders per request. `'force-static'` evaluates once and serves the result. `'error'` is the useful one nobody uses: it makes the build **fail** if anything in the segment forces dynamic rendering, which turns "this endpoint quietly stopped being static six months ago" into a build error on the commit that caused it.

🔴 Two consequences of caching a handler that surprise people, both following directly from "the function does not run per request":

- **A side effect inside a cached handler runs when the response is produced, not when it is served.** A `console.log` added for observability fires at build, or at revalidation. Per-request observability belongs in a handler you have not opted into caching, in a `POST` — which is never cached — or in the proxy layer.
- **A streaming handler under `force-static` streams once**, at evaluation time, and every request afterwards receives the stored result. That is almost never what a stream was for.

For dynamic segments, `generateStaticParams` prerenders the params you list while other params are still handled at request time; with Cache Components it combines with `use cache` to cache data for both.

## `runtime`, and the fact that `edge` is deprecated

The documented type is `'nodejs' | 'edge' (deprecated)`, default `'nodejs'`. That parenthesis is the whole story: choosing the Edge runtime today is choosing a deprecated option. Separately, `export const runtime = "experimental-edge"` was deprecated in `v15.0.0-RC` and has a codemod that rewrites it to `"edge"`.

`preferredRegion` is likewise marked deprecated in the current options table.

The one runtime-adjacent option that is neither deprecated nor optional in practice is **`maxDuration`** — a number, whose default is *set by the deployment platform*. It matters for exactly the handlers this chapter has been building: a long export stream ([04b](04b-constructing-the-response-status-codes-and-streaming.md)), a report that aggregates several upstreams, an LLM proxy. A stream that runs past the limit is cut mid-body, which the client sees as truncation rather than as an error, because the status line went out with the first chunk.

```ts
// app/api/reports/annual/route.ts
export const maxDuration = 120   // seconds; the platform decides whether it may

export async function GET() {
  return new Response(buildAnnualReportStream(), {
    headers: { 'Content-Type': 'text/csv', 'Cache-Control': 'no-store' },
  })
}
```

⚠️ Whether a given number is honoured is a property of the platform, not of Next.js; the documentation states only that the default is set by the deployment platform. Do not treat `maxDuration = 900` as a guarantee that a fifteen-minute request will survive.

## CORS: what the framework gives you, and what it does not

The framework gives you an automatic `OPTIONS` handler that sets the `Allow` header from the other methods in the file ([04](04-route-handlers-routets-for-restful-apis.md)). That is the method half of preflight. It gives you **no** `Access-Control-*` header at all, so a cross-origin browser request is still blocked until you emit them yourself.

The documented per-handler form:

```ts
// app/api/route.ts
export async function GET(request: Request) {
  return new Response('Hello, Next.js!', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
```

That example is a starting point with two properties to understand before shipping it. `*` is a public API's answer, not an application's — and it is **incompatible with credentials**: a request sent with `credentials: 'include'` is rejected by the browser when the origin is the wildcard, which is a CORS rule and not something a server-side setting can override. The moment cookies are involved you must echo a specific, allowlisted origin:

```ts
// lib/cors.ts
const ALLOWED = new Set(['https://app.acme.com', 'https://admin.acme.com'])

export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get('origin')
  const headers = new Headers({ Vary: 'Origin' })   // the response depends on the request origin
  if (origin && ALLOWED.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

// app/api/projects/route.ts
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}
```

`Vary: Origin` is the load-bearing line. Without it, a shared cache that stored the response for `https://app.acme.com` is free to serve the same body — with that `Access-Control-Allow-Origin` — to a request from anywhere, and the browser on the other end will accept it. It is the same correctness argument [11](11-backend-for-frontend-route-handlers-as-a-public-api-layer.md) makes for `Vary: Accept` in content negotiation, and it applies with more force here because the header being varied on is a security control.

The documentation's own "Good to know" is that CORS across many handlers belongs in `proxy` or in `next.config.js` headers rather than repeated per file. [12](12-bff-proxying-webhooks-and-callback-routes.md) covers the proxy route.

## The sentence to take literally

The Backend-for-Frontend guide states it without qualification, and [11](11-backend-for-frontend-route-handlers-as-a-public-api-layer.md) quotes it: **Route Handlers are public HTTP endpoints, and any client can access them.**

Nothing about the file's location in the tree makes one private. Not `app/api/internal/`, not a name nobody would guess, not the fact that only your own frontend calls it. Four obligations follow, and none of them is optional:

- **Authorize inside the handler.** Rendering the page that calls it behind a login is not a boundary; a request does not have to come from your UI.
- **Rate limit anything expensive.** A public endpoint that runs a report or calls a paid API is a bill anyone can run up. [13](13-bff-security-and-the-caveats-that-decide-when-not-to-use-one.md) covers where the counter lives.
- **Validate before you act.** [04e](04e-reading-the-request-body-and-validating-at-the-boundary.md).
- **Do not leak on the error path.** [04c](04c-error-responses-a-client-can-branch-on.md).

And one anti-pattern worth naming here because it looks like good architecture: **do not fetch your own Route Handler from a Server Component.** It is a round trip out to your public domain to reach code running in the same process, and it fails at build time as well as costing latency at runtime. Call the loader function directly. [13](13-bff-security-and-the-caveats-that-decide-when-not-to-use-one.md) has the full caveat.

## Gotchas

**★ Symptom: `export const revalidate = 60` on a handler does nothing, in a project that has been upgraded to 16.** Cause: `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` are removed in `v16.0.0` when Cache Components is enabled. Fix: move the cached work into a helper carrying `'use cache'` and a `cacheLife` profile — it cannot go in the handler body — as [01d](01d-route-handlers-and-their-caching-model.md) shows.

**★ Symptom: your `GET` handler runs on every request in production and a blog post promised it would be static.** Cause: the default for `GET` handlers changed from static to dynamic in `v15.0.0-RC`. Fix: opt in explicitly — `export const dynamic = 'force-static'` or `export const revalidate = 60` — and see [01d](01d-route-handlers-and-their-caching-model.md) for why the whole pre-15 mental model is inverted.

**★ Symptom: a `console.log` added to a handler for observability "only fires sometimes".** Cause: the handler is cached, so its side effects run when the response is produced — at build, or at revalidation — not when it is served. Fix: put per-request observability where per-request code runs: an uncached handler, a `POST`, or the proxy layer. Do not un-cache a hot endpoint for a log line.

**★ Symptom: a streaming endpoint returns the same rows to every caller, hours apart.** Cause: `force-static` on a streaming handler evaluates the stream once and stores the result. Fix: streaming and static caching are mutually exclusive intentions; drop the config, or accept that you are serving a snapshot and name the endpoint accordingly.

**★ Symptom: a cross-origin request fails preflight against a handler with no `OPTIONS` export, and you were told Next handles `OPTIONS`.** Cause: it does — it sets `Allow` from the other methods. It sets no `Access-Control-*` header, so the browser still blocks the request. Fix: emit the CORS headers yourself, per handler, through `proxy`, or in `next.config.js`.

**★ Symptom: CORS works until you add `credentials: 'include'`, then breaks with the headers unchanged.** Cause: `Access-Control-Allow-Origin: *` is incompatible with credentialed requests; the browser rejects the combination regardless of what the server intended. Fix: echo a specific allowlisted origin and add `Access-Control-Allow-Credentials: true` — the `corsHeaders` helper above.

**★ Symptom: a user on an unlisted origin receives a response carrying another origin's `Access-Control-Allow-Origin`.** Cause: the handler echoes the request origin and the response was cached without `Vary: Origin`, so a shared cache served one origin's response to another. Fix: set `Vary: Origin` on every response whose CORS headers depend on the request.

**★ Symptom: a long report endpoint is cut off mid-CSV with no error anywhere.** Cause: the platform's execution limit fired mid-stream. The status line and headers left with the first chunk, so there is no way to turn it into a `500` — the client sees truncation. Fix: raise `maxDuration` if the platform permits it, and give the format an end marker the client verifies; better, move the work to a job and return `202` with a polling URL.

**★ Symptom: the Edge runtime is chosen for an endpoint and a reviewer objects.** Cause: `runtime` is documented as `'nodejs' | 'edge' (deprecated)`. The Edge option is marked deprecated in the current type, so new code choosing it is choosing a path the framework is moving away from. Fix: default to `'nodejs'` and treat a deliberate `'edge'` as a decision that needs a written reason.

**Symptom: `export const runtime = "experimental-edge"` warns on upgrade.** Cause: it was deprecated in `v15.0.0-RC`. Fix: run the codemod that rewrites it to `"edge"` — and then reconsider whether you want `"edge"` at all, given the above.

**Symptom: an endpoint that was static a year ago is dynamic today and nobody noticed.** Cause: someone added a `cookies()` read, or a header check, and the segment silently became dynamic. Fix: `export const dynamic = 'error'` on the handlers whose staticness is a requirement — it turns the regression into a build failure on the commit that introduced it instead of a performance mystery a quarter later.

**Symptom: a Server Component fetches `/api/projects` from your own app and the build fails.** Cause: fetching your own Route Handler from a Server Component is explicitly a documented caveat — it fails at build and costs a round trip at runtime. Fix: import and call the loader function directly, and keep the handler for callers that genuinely speak HTTP.

**Symptom: an internal-looking endpoint under `app/api/internal/` turns out to be hit from outside.** Cause: nothing about a path makes an endpoint private; Route Handlers are public and any client can access them. Fix: authorize inside the handler. A path is a name, not a boundary.

**Symptom: `maxDuration` is set to a large number and requests still die at the old limit.** Cause: the default and the ceiling are set by the deployment platform; the documentation states only that the default comes from the platform, not that any value you write will be honoured. Fix: check your platform's limit, and design for the case where the number you asked for is not the number you get.

## Interview questions

**★ How do you cache a `GET` Route Handler on 16.3.4, and what is the precondition on that answer?**
Without Cache Components: `export const dynamic = 'force-static'` for a build-time value, or `export const revalidate = 60` for an ISR-style window — because the default has been *dynamic* since `v15.0.0-RC` and you must opt in. The precondition is Cache Components: `v16.0.0` removes `dynamic`, `revalidate` and `fetchCache` when it is enabled, and the model becomes a `'use cache'` helper with a `cacheLife` profile, called from the handler rather than declared inside it. So "how do I cache this" has two correct answers and the config file decides which.

**★ What does `export const dynamic = 'error'` do, and why is it the most useful of the four values?**
It makes the build fail if anything in the segment forces dynamic rendering. That converts a class of silent regression — someone adds a `cookies()` read to a handler that was static, and the endpoint quietly starts running per request — into a build error on the commit that caused it. `'auto'`, `'force-dynamic'` and `'force-static'` all state an intention; `'error'` is the only one that *enforces* it, which is exactly what you want on the handful of endpoints whose staticness is a requirement rather than a preference.

**★ A colleague adds a log line to a cached handler and reports it "only fires sometimes". What do you tell them?**
That side effects in a cached handler run when the response is produced, not when it is served — at build, or at revalidation. A `force-static` handler logs once per build. If the requirement is per-request observability, it has to live where per-request code runs: an uncached handler, a `POST`, which is never cached, or the proxy layer. Logging is a poor reason to un-cache a hot endpoint, but a good reason to be precise about which layer you are instrumenting.

**★ Preflight succeeds against a handler with no `OPTIONS` export. Is CORS configured?**
No. Next.js implements `OPTIONS` when you do not, and sets the `Allow` header from the other methods in the file — that is the method half. It emits no `Access-Control-*` header, so a genuine cross-origin browser request is still blocked. The trap is that the automatic handler makes preflight *look* handled, so people conclude CORS is on and go looking elsewhere for the failure.

**★ Why can you not use `Access-Control-Allow-Origin: *` with cookies, and what do you do instead?**
Because the wildcard is incompatible with credentialed requests: the browser rejects the combination, and no server-side setting overrides it — it is a rule of the CORS model, not a Next.js constraint. The replacement is to keep an allowlist, echo the specific request origin when it is on the list, add `Access-Control-Allow-Credentials: true`, and — the part people forget — set `Vary: Origin`, because the response now depends on a request header and a shared cache that does not know this will hand one origin's response to another.

**★ Where should CORS live if twenty handlers need it?**
Not in twenty handlers. The documentation points at `proxy` or the `headers` configuration in `next.config.js` for exactly this. Per-handler CORS is right when one endpoint has a different policy from the rest; as a default it drifts, and the endpoint that gets missed is the one added in a hurry. Centralise the policy and keep the per-handler form for deliberate exceptions.

**★ Which runtime do you choose for a Route Handler in 16.3.4?**
`'nodejs'`, which is the default. The documented type is `'nodejs' | 'edge' (deprecated)`, so choosing Edge today means choosing an option the framework has marked as on the way out; `preferredRegion` is marked deprecated on the same page. Separately, `runtime = "experimental-edge"` was deprecated back in `v15.0.0-RC` and has a codemod to `"edge"`. A deliberate `'edge'` needs a written reason in 2026, not a default assumption that it is faster.

**★ What is `maxDuration` for, and what does it not guarantee?**
It bounds how long a handler may run, and it matters for exactly the endpoints this chapter has been building: streamed exports, aggregating reports, model proxies. What it does not guarantee is the number you wrote — the documentation states that the default is set by the deployment platform, so the ceiling is a platform property. Design for the truncation case anyway: a stream cut by a timeout has already sent its status line, so the client sees a short body rather than an error, which is why long jobs are better served by `202` plus a polling URL than by a longer timeout.

**★ "It is under `/api/internal/`, so it is fine." Respond.**
A path is a name, not a boundary. The Backend-for-Frontend guide states that Route Handlers are public HTTP endpoints and that any client can access them, with no qualification about location, obscurity, or who happens to call them today. The obligations that follow are authorization inside the handler, rate limiting for anything expensive, validation before acting, and an error path that discloses nothing. Every one of those has to be in the handler, because the handler is the only thing standing between the internet and the data.

**Why is fetching your own Route Handler from a Server Component a mistake rather than a style preference?**
Because it is a network round trip out to your public domain to reach code running in the same process, and it is documented as a caveat that fails at build time as well as costing latency at runtime. The loader function is right there; import it. Keep the Route Handler for callers that genuinely speak HTTP — a browser polling, a webhook, a mobile client, a feed reader — and let the server component call the function the handler itself would have called.

---

← [04e · Reading the body](04e-reading-the-request-body-and-validating-at-the-boundary.md) · [Chapter 4 overview](01-explanation.md) · Next → [05 · Server Actions](05-server-actions-mutations-form-submissions-progressive-enhanc.md)
