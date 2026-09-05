---
title: "Webhooks, OAuth callbacks and cross-origin clients are Route Handler territory by necessity, not preference — they are callers you do not ship, and a Server Action has no URL to give them"
sidebar_label: "02j · Handler-only territory"
sidebar_position: 208
description: "Receiving webhooks and verifying signatures against the raw body, the token-in-the-query-string tension in the docs' own examples, OAuth callback handlers and the open-redirect guard, CORS headers and preflight OPTIONS, and header hygiene when proxying."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Public Endpoints*, § *Webhooks and callback URLs*, § *Security*, § *Preflight Requests*) and [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (§ *CORS*) — both `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**There is a class of caller a Server Action structurally cannot serve: anything that is not a browser running your own bundle. A webhook sender, an OAuth provider redirecting a user back, a mobile app, a partner's integration, a CLI, a monitoring probe — none of them can obtain an action ID, none would survive its rotation, and none send an `Origin` header that matches your host. For those callers the answer is not "a Route Handler is nicer", it is "a Route Handler is the only entry point that exists". This chunk is about the four patterns that live there and the specific ways each one is got wrong.**

## The starting position

> *"Route Handlers are public HTTP endpoints. Any client can access them."*

> *"To restrict access, implement authentication and authorization."*

That is not a warning bolted on — it is the design. A handler is a URL you published deliberately, with a stable path you can put in a partner's configuration, a `Postman` collection, or a CMS webhook field. Everything else in this chunk is about the consequences of that publication.

## Webhooks

> *"Use Route Handlers to receive event notifications from third-party applications."*

> *"For example, revalidate a route when content changes in a CMS. Configure the CMS to call a specific endpoint on changes."*

```ts
// /app/webhook/route.ts
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (token !== process.env.REVALIDATE_SECRET_TOKEN) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const tag = request.nextUrl.searchParams.get('tag')

  if (!tag) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  revalidateTag(tag, 'max')

  return NextResponse.json({ success: true })
}
```

Three things to notice about the documented example, because it is a starting point rather than a template.

**It is a `GET` with a secret in the query string.** That is fine for a CMS revalidation hook whose "secret" is a revalidation trigger and nothing else, and it is convenient because CMS webhook fields often accept only a URL. It is *not* fine in general, and the same guide says why in a different section:

> *"This example uses `POST` to avoid putting geo-location data in the URL. `GET` requests may be cached or logged, which could expose sensitive info."*

Query strings land in access logs, proxy logs, browser history and `Referer` headers. A shared secret in one is a secret in your log aggregator.

**It takes the tag from the caller.** `revalidateTag(tag, ...)` with an unvalidated `tag` means anyone holding the token can invalidate anything. Constrain it to a set you recognise.

**The second argument.** The guide's snippet passes `'max'` to `revalidateTag`; that page does not explain the argument, and I have not confirmed its semantics from a primary source, so treat it as "the example names a cache profile" and check the `revalidateTag` reference before copying it.

A stronger shape for a signed webhook — and the reason the read-once body from [02h](02h-route-handler-mechanics.md) matters:

```ts
// app/api/webhooks/stripe/route.ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import { recordPayment } from '@/data/payments'

const ALLOWED_EVENTS = new Set(['payment_intent.succeeded', 'charge.refunded'])

export async function POST(request: Request) {
  const raw = await request.text()                       // exact bytes, read once
  const signature = request.headers.get('x-signature') ?? ''

  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(raw)
    .digest('hex')

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const event = JSON.parse(raw)                          // parse the same bytes
  if (!ALLOWED_EVENTS.has(event.type)) {
    return new Response(null, { status: 204 })           // ack, ignore
  }

  await recordPayment(event)
  return new Response(null, { status: 204 })
}
```

Four properties worth copying: the raw body is read exactly once and both the signature check and the parse use it; the comparison is length-checked and constant-time; unknown event types are acknowledged rather than errored, so the sender does not retry forever; and the response is a bare 204, giving an attacker nothing to probe with.

⚠️ Webhook senders retry. Nothing in Next.js deduplicates for you, so `recordPayment` must be idempotent — keyed on the provider's event id with an insert-if-absent, inside the same transaction as the effect.

## Callback URLs, and the open-redirect guard

> *"Callback URLs are another use case. When a user completes a third-party flow, the third party sends them to a callback URL. Use a Route Handler to verify the response and decide where to redirect the user."*

```ts
// /app/auth/callback/route.ts
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('session_token')
  const redirectUrl = request.nextUrl.searchParams.get('redirect_url')

  const destination = new URL(redirectUrl ?? '/', request.url)
  // Prevent open redirects: only allow same-origin destinations
  if (destination.origin !== request.nextUrl.origin) {
    return new Response('Invalid redirect', { status: 400 })
  }

  const response = NextResponse.redirect(destination)

  response.cookies.set({
    value: token,
    name: '_token',
    path: '/',
    secure: true,
    httpOnly: true,
    expires: undefined, // session cookie
  })

  return response
}
```

This example is doing two things an action cannot. It is being navigated to by a **third party's redirect** — a `GET` initiated outside your app, with no dispatcher, no action ID and a foreign `Origin`. And it is **setting a cookie on a response it constructs**, with explicit `secure`, `httpOnly` and path flags.

The origin comparison is the load-bearing line. `new URL(redirectUrl ?? '/', request.url)` resolves relative paths against your own origin, which is safe, but an absolute `https://evil.example/` overrides the base entirely — so without the check, `?redirect_url=https://evil.example` turns your authenticated callback into a redirector that phishing pages can link to.

## CORS is yours

> *"Preflight requests use the `OPTIONS` method to ask the server if a request is allowed based on origin, method, and headers."*

> *"If `OPTIONS` is not defined, Next.js adds it automatically and sets the `Allow` header based on the other defined methods."*

Automatic `OPTIONS` answers "which methods exist here". A browser preflight asks a different question, and wants `Access-Control-Allow-*` headers in the answer:

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

⚠️ That documented snippet is a *demonstration of the mechanism*, not a policy to ship. `Access-Control-Allow-Origin: '*'` cannot be combined with credentials, and if your endpoint is authenticated by cookie you need an allow-list echo instead:

```ts
// app/api/partner/route.ts
const ALLOWED = new Set(['https://partner.example', 'https://admin.example'])

function corsHeaders(origin: string | null) {
  const headers = new Headers({ Vary: 'Origin' })
  if (origin && ALLOWED.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

export async function GET(request: Request) {
  return Response.json({ ok: true }, { headers: corsHeaders(request.headers.get('origin')) })
}
```

`Vary: Origin` is not optional once the response varies by origin — without it a shared cache can hand `partner.example`'s permissive response to anyone.

🔴 CORS is not access control. It is a browser instruction about which *other pages* may read your response. It does nothing about a non-browser caller, so an endpoint that is CORS-restricted and unauthenticated is fully open to `curl`.

## Header hygiene

> *"Be deliberate about where headers go, and avoid directly passing incoming request headers to the outgoing response."*

> *"**Upstream request headers**: In Proxy, `NextResponse.next({ request: { headers } })` modifies the headers your server receives and does not expose them to the client."*

> *"**Response headers**: `new Response(..., { headers })`, `NextResponse.json(..., { headers })`, `NextResponse.next({ headers })`, or `response.headers.set(...)` send headers back to the client. If sensitive values were appended to these headers, they will be visible to clients."*

The failure this prevents is a proxy handler that forwards an upstream response wholesale, including an `Authorization` header, a `Set-Cookie` from an internal service, or an `X-Internal-User-Id` that a middleware layer added for its own use. Copy the headers you mean, never the header object:

```ts
// app/api/proxy/[...slug]/route.ts
export async function GET(request: Request, ctx: RouteContext<'/api/proxy/[...slug]'>) {
  const { slug } = await ctx.params
  const upstream = await fetch(new URL(slug.join('/'), 'https://internal.example'), {
    headers: { Authorization: `Bearer ${process.env.INTERNAL_TOKEN}` },
  })

  // copy only what the client may see
  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  return new Response(upstream.body, { status: upstream.status, headers })
}
```

And the standing rule for anything guarded only at the edge:

> *"Always verify credentials before granting access. Do not rely on proxy alone for authentication and authorization."*

## Gotchas

**★ Symptom: webhook signature verification fails for every request, though the secret is right.** Cause: the body was parsed and re-serialised before signing — key order, whitespace and number formatting differ from the bytes the sender signed. Fix: read the body once as text, verify against that string, then parse it.

```ts
const raw = await request.text()
verify(raw, request.headers.get('x-signature'))
const event = JSON.parse(raw)
```

**★ Symptom: a webhook fires the same side effect several times.** Cause: senders retry on timeout or non-2xx, and nothing deduplicates. Fix: make the handler idempotent on the provider's event id, in the same transaction as the effect.

```ts
await db.$transaction(async (tx) => {
  const seen = await tx.webhookEvent.findUnique({ where: { id: event.id } })
  if (seen) return
  await tx.webhookEvent.create({ data: { id: event.id } })
  await applyEffect(tx, event)
})
```

**★ Symptom: a webhook secret shows up in the log aggregator.** Cause: it was passed as a query-string token on a `GET`, as the docs' CMS example does. Fix: move it to a header on a `POST` where the sender allows it — the same guide notes that *"`GET` requests may be cached or logged, which could expose sensitive info."*

```ts
export async function POST(request: Request) {
  if (request.headers.get('x-revalidate-token') !== process.env.REVALIDATE_SECRET_TOKEN) {
    return new Response(null, { status: 401 })
  }
  // ...
}
```

**★ Symptom: an authenticated callback handler is being used in a phishing chain.** Cause: an unvalidated `redirect_url` — an absolute URL replaces the base in `new URL(value, request.url)`, so any origin is reachable. Fix: the documented origin comparison, or better, an allow-list of paths.

```ts
const destination = new URL(redirectUrl ?? '/', request.url)
if (destination.origin !== request.nextUrl.origin) {
  return new Response('Invalid redirect', { status: 400 })
}
```

**★ Symptom: a browser preflight fails even though `OPTIONS` "is handled automatically".** Cause: the automatic `OPTIONS` sets `Allow`, which is not what a CORS preflight is asking for. Fix: export `OPTIONS` yourself and answer with the `Access-Control-Allow-*` set, as `corsHeaders` above does.

**★ Symptom: CORS works from the partner's site and the endpoint is also readable by anyone with `curl`.** Cause: CORS was mistaken for access control; it is a browser-side instruction about who may *read* a response, not a gate on who may *send* a request. Fix: authenticate the endpoint independently — a bearer token, a signed request, or mutual TLS at the edge.

**★ Symptom: a shared cache serves one partner's CORS response to another origin.** Cause: the response varies by `Origin` and does not say so. Fix: always set `Vary: Origin` alongside a reflected `Access-Control-Allow-Origin`.

**Symptom: an internal `Set-Cookie` or `Authorization` header leaks through a proxy handler.** Cause: the upstream `Response`'s header object was passed through wholesale. Fix: construct a new `Headers` and copy only the fields the client may see.

**Symptom: a webhook returns 500 on an event type you do not handle, and the sender retries it forever, eventually disabling the endpoint.** Cause: unknown events treated as errors. Fix: acknowledge with a 2xx and ignore, as the `ALLOWED_EVENTS` check above does — a webhook's status code is a *delivery* receipt, not a business outcome.

## Interview questions

**★ Why can a webhook not be a Server Action?**
Because there is nothing to give the sender. An action is addressed by an encrypted action ID that lives in a build artefact and rotates on deploy, and the only client that knows how to construct the POST is your own bundle's dispatcher. Even if you extracted the ID by hand, the framework's `Origin`/`Host` check would reject a request from a third party's servers, and the ID would stop working at the next deploy. A webhook needs a stable, documented URL that survives releases and accepts a request from an origin you do not control — which is the definition of a Route Handler.

**★ Why must a webhook signature be verified against the raw body, and what makes that awkward in a Route Handler?**
Because the sender signed exact bytes. Any round trip through `JSON.parse` and `JSON.stringify` can change key order, whitespace, or number formatting, and the recomputed HMAC will not match. It is awkward because a `Request` body is a stream you may read only once — the docs say *"You can only read the request body once. Clone the request if you need to read it again"* — so you cannot casually `await request.json()` for your logic and `await request.text()` for the signature. The reliable shape is one `await request.text()`, verify against that string with a constant-time comparison, then `JSON.parse` the same string.

**★ Is CORS a security control?**
No, and treating it as one is a common and expensive mistake. CORS is an instruction *to a browser* about which other web origins may read a cross-origin response; it is enforced client-side, by the browser, on behalf of the user. It has no effect on `curl`, a server-side script, a mobile app or anything else that is not a compliant browser, so an unauthenticated endpoint locked down with a strict `Access-Control-Allow-Origin` is completely open to anyone willing to not be a browser. CORS controls *reading by other pages*; authentication controls *access*. You need both, for different reasons.

**★ What is the open-redirect risk in an OAuth callback handler, and what exactly fixes it?**
The handler typically accepts a `redirect_url` so the user lands where they started. `new URL(value, request.url)` resolves a relative path against your origin — safe — but an absolute URL replaces the base entirely, so `?redirect_url=https://evil.example` sends an authenticated, freshly cookie-bearing user off your site. That makes your domain a laundering step in a phishing chain, and it is worse than a plain redirector because a session cookie was just set. The documented fix is an origin comparison: `if (destination.origin !== request.nextUrl.origin) return new Response('Invalid redirect', { status: 400 })`. An allow-list of known paths is stricter still, and preferable when the set of destinations is small.

**Why does the automatic `OPTIONS` handler not satisfy a CORS preflight?**
Because they answer different questions. Next.js implements `OPTIONS` when you do not, and *"sets the appropriate Response `Allow` header depending on the other methods defined in the Route Handler"* — that is the HTTP method-discovery use of `OPTIONS`. A CORS preflight is a browser asking whether a specific origin may send a specific method with specific headers, and it reads `Access-Control-Allow-Origin`, `-Methods` and `-Headers` in the response. None of those appear in the automatic answer, so the browser blocks the real request. Exporting your own `OPTIONS` that returns the CORS set is the fix.

**A webhook handler occasionally applies the same payment twice. Whose bug is that?**
Yours. Webhook delivery is at-least-once by design: senders retry on a timeout or a non-2xx, and networks lose acknowledgements, so duplicates are a normal condition rather than an incident. Nothing in Next.js deduplicates for you. The handler has to be idempotent on the provider's event id — insert the id and apply the effect inside one transaction, and treat a duplicate-key collision as "already handled". The related discipline is to acknowledge events you do not care about with a 2xx instead of erroring, so the sender does not retry them until it disables the endpoint.

**What is wrong with returning an upstream `Response` directly from a proxy handler?**
It passes the upstream's entire header set to the client, and some of those headers exist for internal use — `Set-Cookie` from an internal service, an `Authorization` echo, an `X-Internal-*` field a middleware layer added. The docs warn precisely this: *"avoid directly passing incoming request headers to the outgoing response … If sensitive values were appended to these headers, they will be visible to clients."* Construct a fresh `Headers`, copy the fields the client legitimately needs — usually just `content-type` and perhaps caching directives — and stream the body through.

---

← [02i · Route Handler caching](02i-route-handler-caching.md) · Next → [02k · Content types and the deployment envelope](02k-content-types-and-the-deployment-envelope.md)
