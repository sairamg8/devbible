---
title: "A Route Handler can return any content type, negotiate on Accept and proxy a backend — but where it runs decides what it may do, and on a lambda host it may not share state, write files, run long, or hold a socket"
sidebar_label: "02k · Content types and deployment"
sidebar_position: 209
description: "Serving XML, files and text, the metadata file conventions, content negotiation with rewrites and Vary: Accept, proxying with validation, export mode's GET-only restriction, and the four documented consequences of deploying handlers as lambda functions."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Content types*, § *Content negotiation*, § *Proxying to a backend*, § *Redirects*, § *Caveats*) — `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**A Server Action returns a serialised JavaScript value to a React client and nothing else. A Route Handler returns a `Response`, which means any bytes with any content type and any status — an RSS feed, a signed download, a CSV export, a Markdown rendering of the same URL a browser sees as HTML. That freedom is the reason handlers exist, and it is bounded not by the framework but by the deployment: the documentation is explicit that a handler deployed as a lambda cannot share state between requests, may not write to disk, can be killed by a timeout, and cannot hold a WebSocket open.**

## Any content type, and the conventions that already exist

> *"Route Handlers let you serve non-UI responses, including JSON, XML, images, files, and plain text."*

Next.js already owns several of these paths by file convention — `sitemap.xml`, `opengraph-image.jpg` and `twitter-image`, favicon and app icons, `manifest.json`, `robots.txt` — and the guide notes you can define your own, naming `llms.txt`, `rss.xml` and `.well-known` as examples. `app/rss.xml/route.ts` creates a handler serving `/rss.xml`:

```ts
// /app/rss.xml/route.ts
export async function GET(request: Request) {
  const rssResponse = await fetch(/* rss endpoint */)
  const rssData = await rssResponse.json()

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
 <title>${rssData.title}</title>
 <description>${rssData.description}</description>
 <link>${rssData.link}</link>
 <copyright>${rssData.copyright}</copyright>
 ${rssData.items.map((item) => {
   return `<item>
    <title>${item.title}</title>
    <description>${item.description}</description>
    <link>${item.link}</link>
    <pubDate>${item.publishDate}</pubDate>
    <guid isPermaLink="false">${item.guid}</guid>
 </item>`
 })}
</channel>
</rss>`

  const headers = new Headers({ 'content-type': 'application/xml' })

  return new Response(rssFeed, { headers })
}
```

> *"Sanitize any input used to generate markup."*

That one-line caveat carries weight in this example: the feed interpolates fetched strings straight into XML, so a title containing `]]>` or a raw `&` produces a malformed document, and one containing markup produces an injection into whatever parses the feed.

A file download is the same mechanism with different headers, and it is a thing an action cannot express at all:

```ts
// app/api/exports/orders/route.ts
import { streamOrdersCsv } from '@/data/orders'

export async function GET() {
  const stream = await streamOrdersCsv()          // a ReadableStream of CSV rows
  return new Response(stream, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="orders.csv"',
      'cache-control': 'no-store',
    },
  })
}
```

## Content negotiation: one URL, two representations

> *"You can use rewrites with header matching to serve different content types from the same URL based on the request's `Accept` header."*

> *"For example, a documentation site might serve HTML pages to browsers and raw Markdown to AI agents from the same `/docs/…` URLs."*

```js
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/docs/:slug*',
        destination: '/docs/md/:slug*',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '(.*)text/markdown(.*)',
          },
        ],
      },
    ]
  },
}
```

```ts
// app/docs/md/[...slug]/route.ts
import { getDocsMd, generateDocsStaticParams } from '@/lib/docs'

export async function generateStaticParams() {
  return generateDocsStaticParams()
}

export async function GET(_: Request, ctx: RouteContext<'/docs/md/[...slug]'>) {
  const { slug } = await ctx.params
  const mdDoc = await getDocsMd({ slug })

  if (mdDoc == null) {
    return new Response(null, { status: 404 })
  }

  return new Response(mdDoc, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
  })
}
```

> *"The `Vary: Accept` response header tells caches that the response body depends on the `Accept` request header. Without it, a shared cache could serve a cached Markdown response to a browser (or vice versa). Most hosting providers already include the `Accept` header in their cache key, but setting `Vary` explicitly ensures correct behavior across all CDNs and proxy caches."*

Two caveats the guide attaches, both easy to miss:

> *"The `/docs/md/...` route is still directly accessible without the rewrite. If you want to restrict it to only serve via the rewrite, use `proxy` to block direct requests that don't include the expected `Accept` header."*

> *"For more advanced negotiation logic, you can use `proxy` instead of rewrites for more flexibility."*

And note `generateStaticParams` on a `route.ts` — it works exactly as it does on a page, and *"lets you pre-render the Markdown variants at build time so they can be served from the edge without hitting the origin server on every request."*

## Proxying to a backend, with the validation step

> *"You can use a Route Handler as a `proxy` to another backend. Add validation logic before forwarding the request."*

```ts
// /app/api/[...slug]/route.ts
import { isValidRequest } from '@/lib/utils'

export async function POST(request: Request, { params }) {
  const clonedRequest = request.clone()
  const isValid = await isValidRequest(clonedRequest)

  if (!isValid) {
    return new Response(null, { status: 400, statusText: 'Bad Request' })
  }

  const { slug } = await params
  const pathname = slug.join('/')
  const proxyURL = new URL(pathname, 'https://nextjs.org')
  const proxyRequest = new Request(proxyURL, request)

  try {
    return fetch(proxyRequest)
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected exception'

    return new Response(message, { status: 500 })
  }
}
```

The `request.clone()` on the first line is the read-once rule in action: `isValidRequest` consumes a body, and the original must still be intact to construct `proxyRequest`. Note also that this handler returns the upstream `Response` directly — acceptable when the upstream is a public site, and a leak when it is an internal service whose headers you have not filtered ([02j](02j-handler-only-territory.md)).

The guide names two alternatives that do not require a handler at all — `proxy` rewrites, and `rewrites` in `next.config.js`. Reach for those when there is nothing to validate; a handler earns its place when there is.

## Redirects from a handler

```ts
// app/api/route.ts
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  redirect('https://nextjs.org/')
}
```

Two forms exist and they behave differently: `redirect()` from `next/navigation` throws a control-flow exception, so nothing after it runs, while `NextResponse.redirect(url)` is a value you return and can attach cookies to — which is exactly why the OAuth callback in [02j](02j-handler-only-territory.md) uses the latter.

## `export` mode: `GET` only

> *"`export` mode outputs a static site without a runtime server. Features that require the Next.js runtime are not supported, because this mode produces a static site, and no runtime server."*

> *"In `export mode`, only `GET` Route Handlers are supported, in combination with the `dynamic` route segment config, set to `'force-static'`."*

```js
// app/hello-world/route.ts
export const dynamic = 'force-static'

export function GET() {
  return new Response('Hello World', { status: 200 })
}
```

> *"This can be used to generate static HTML, JSON, TXT, or other files."*

So in `export` mode a Route Handler is a **build-time file generator**, not an endpoint. And Server Actions have no place there at all: there is no server to POST to.

## The deployment envelope: what a lambda host takes away

> *"Some hosts deploy Route Handlers as lambda functions. This means:"*
> *"* Route Handlers cannot share data between requests.
> * The environment may not support writing to File System.
> * Long-running handlers may be terminated due to timeouts.
> * WebSockets won't work because the connection closes on timeout, or after the response is generated."*

Each line kills a pattern that works perfectly on a long-lived Node server:

| Assumption | What breaks |
|---|---|
| An in-memory `Map` as a rate limiter or cache | Different instances hold different maps; the limit is per-instance and effectively random |
| Writing an upload to `/tmp` then processing it | May not be writable, and is certainly not shared with the next request |
| A long export or report generation inside the request | Terminated at the platform timeout, mid-stream, with a partial response already sent |
| A WebSocket upgrade in a handler | The connection closes when the response completes or the function times out |

The last row is the reason server-sent events over a `GET` handler is the usual answer for real-time in this deployment shape — the trade-offs are the subject of [03 · Real-time: SSE and WebSockets](03-real-time-server-sent-events-and-websockets-in-a-serverless.md), and the handler itself is built in [03d](03d-writing-the-sse-route-handler.md).

⚠️ This is a property of the **host**, not of Next.js. Self-hosted on a long-lived Node process, in-memory state and long connections work — which is precisely why code that behaves in development and on a VM fails on a serverless deploy. The same split governs where a `use cache` entry lives ([02i](02i-route-handler-caching.md)) and where a database pool lives ([01b](01b-the-three-kinds-of-pool.md)).

## Gotchas

**★ Symptom: the RSS feed is malformed for one item and valid for the rest.** Cause: a title or description containing `&`, `<` or `]]>` interpolated straight into the XML template. Fix: escape everything that enters markup — the guide's own caveat is *"Sanitize any input used to generate markup."*

```ts
const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const item = `<item><title>${xmlEscape(entry.title)}</title></item>`
```

**★ Symptom: a browser receives Markdown, or an agent receives HTML, from a negotiated URL.** Cause: the response varies by `Accept` and the cache was not told. Fix: `Vary: Accept` on the negotiated response, always — most hosts key on it already, but *"setting `Vary` explicitly ensures correct behavior across all CDNs and proxy caches."*

**★ Symptom: the internal `/docs/md/...` path is being crawled and indexed directly.** Cause: a rewrite hides a route from normal navigation but does not make it unreachable — *"the `/docs/md/...` route is still directly accessible without the rewrite."* Fix: block direct requests in `proxy.ts`, or return a 404 when the expected `Accept` header is absent.

**★ Symptom: a proxy handler throws "body already read" when validating before forwarding.** Cause: the validator consumed the request body that the forwarded `Request` still needs. Fix: `request.clone()` before validation, as the documented example does on its first line.

**★ Symptom: an in-memory rate limiter or cache in a handler behaves inconsistently in production and perfectly in development.** Cause: the host deploys handlers as lambdas, and *"Route Handlers cannot share data between requests."* Fix: put the state somewhere shared.

```ts
// app/api/resource/route.ts
import { redis } from '@/lib/redis'

export async function POST(request: Request) {
  const key = `rl:${request.headers.get('x-forwarded-for') ?? 'anon'}`
  const hits = await redis.incr(key)
  if (hits === 1) await redis.expire(key, 60)
  if (hits > 30) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  return new Response(null, { status: 204 })
}
```

**★ Symptom: a large CSV export truncates in production, always at roughly the same point.** Cause: the platform timeout terminated a long-running handler mid-stream — and because headers and early bytes were already flushed, the client sees a successful, incomplete file. Fix: do not generate long exports in the request. Enqueue the job, return a job id, and hand back a signed URL when it is ready ([04 · Background jobs](04-background-jobs-and-message-queues-for-async-workloads.md)).

**★ Symptom: `new WebSocketServer(...)` in a Route Handler never receives a connection.** Cause: *"WebSockets won't work because the connection closes on timeout, or after the response is generated."* Fix: use SSE over a `GET` handler for server-to-client streams, or a managed realtime service for bidirectional traffic — see [03](03-real-time-server-sent-events-and-websockets-in-a-serverless.md).

**Symptom: writing an uploaded file to `/tmp` and reading it back on the next request returns nothing.** Cause: no shared filesystem, and possibly no writable one — *"the environment may not support writing to File System."* Fix: write to object storage and pass the key.

**Symptom: a `POST` handler 404s or is missing entirely after switching to `output: 'export'`.** Cause: *"In `export mode`, only `GET` Route Handlers are supported, in combination with the `dynamic` route segment config, set to `'force-static'`."* Fix: accept that export mode has no server — move the mutation to a hosted API, or stop exporting.

**Symptom: a `redirect()` in a handler drops the cookie you set just before it.** Cause: `redirect()` from `next/navigation` throws, so the response you were building is abandoned. Fix: return `NextResponse.redirect(destination)` and set cookies on that response object.

## Interview questions

**★ Name three things a Route Handler can return that a Server Action cannot.**
A specific HTTP status code — an action returns a value, not a response, so `404`, `429` and `304` are simply unavailable. Arbitrary headers and content types — `Content-Disposition: attachment` for a download, `text/csv`, `application/xml` for a feed, `Vary: Accept` for a negotiated resource. And a stream: a handler can return a `ReadableStream` body and flush bytes as they are produced, which is what makes server-sent events possible at all. Those three between them cover most of the cases where "should this be an action?" has an easy answer.

**★ How does content negotiation work in the App Router, and what breaks if you forget `Vary: Accept`?**
A rewrite in `next.config.js` matches on the `Accept` request header with a `has` condition and sends matching requests to a different path, where a Route Handler produces the alternate representation — the documented example serves Markdown to clients asking for `text/markdown` and HTML to everyone else, from the same `/docs/...` URLs. If the Markdown response does not carry `Vary: Accept`, a shared cache that keyed only on the URL can serve it to a browser, or serve the HTML page to an agent. Most hosts include `Accept` in their cache key already, but as the docs put it, setting `Vary` explicitly *"ensures correct behavior across all CDNs and proxy caches"* — and a CDN you do not control is exactly the case you cannot verify.

**★ Why does an in-memory rate limiter work in development and fail in production?**
Because development is one long-lived process and production may be many short-lived ones. The docs state it plainly for lambda-style hosts: *"Route Handlers cannot share data between requests."* Each invocation may land on a different instance with its own empty `Map`, so a limit of 30 per minute becomes 30 per minute *per instance*, which under load is effectively no limit at all — and it is worse than useless because it looks like a control. The state has to live somewhere shared: Redis, the database, or a platform-level limit in front of the function.

**★ Why is a WebSocket impossible in a Route Handler on a serverless host, and what do you use instead?**
Because the function's lifetime is bounded by the response. The documentation says *"WebSockets won't work because the connection closes on timeout, or after the response is generated"* — a `route.ts` is invoked to produce a `Response`, and when that response completes the execution context can be torn down, taking any socket with it. There is also no upgrade path exposed to the handler. The usual answer for server-to-client updates is server-sent events over a `GET` handler returning a `ReadableStream`, which still runs into the platform timeout but degrades into a reconnect rather than a failure; for genuinely bidirectional traffic you use a managed realtime service and let it hold the sockets.

**What does a Route Handler mean in `export` mode?**
It stops being an endpoint and becomes a build-time file generator. Export mode produces a static site with no runtime server, so *"only `GET` Route Handlers are supported, in combination with the `dynamic` route segment config, set to `'force-static'`"* — the handler runs at build time and its response is written out as a file, which is useful for generating JSON, text or XML artefacts. Every other verb is unsupported, and Server Actions are unavailable entirely, because there is nothing to POST to.

**Why does the documented proxy example call `request.clone()` on its very first line?**
Because it needs the body twice and a request body is a stream that can be read once. `isValidRequest(clonedRequest)` consumes the clone while the original stays intact to construct `new Request(proxyURL, request)` for the forward. Skip the clone and the validation drains the body, and the forwarded request arrives at the upstream empty — a failure that looks like an upstream bug because your handler returned cleanly. The same discipline shows up in webhook signature verification, for the same underlying reason.

**When is a Route Handler the wrong tool for proxying?**
When there is nothing to add. The guide lists `proxy` rewrites and `rewrites` in `next.config.js` as alternatives, and both do the forwarding at a layer that never invokes your function — cheaper, and with fewer chances to leak a header. A handler earns its place when you have work to do at the boundary: validating a payload before it reaches the backend, attaching a credential the client must not hold, reshaping a response, or enforcing a limit. If the code is nothing but "change the host and forward", a rewrite is the better answer.

---

← [02j · Handler-only territory](02j-handler-only-territory.md) · Next → [02l · The decision rule](02l-the-decision-rule.md)
