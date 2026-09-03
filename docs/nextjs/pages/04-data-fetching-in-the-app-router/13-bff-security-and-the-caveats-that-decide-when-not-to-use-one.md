---
sidebar_position: 31
title: "The most important sentence in the Backend-for-Frontend guide is a caveat: do not fetch from your own Route Handlers in a Server Component — it fails the build at build time and costs a round trip at runtime"
sidebar_label: "BFF: security and caveats"
description: "Where headers may safely go, rate limiting, payload verification, library factory patterns, and the four caveats — Server Components, Server Actions, export mode, and the lambda deployment environment — that bound the whole pattern."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (docs `lastUpdated` 2026-06-25), [`NextResponse`](https://nextjs.org/docs/app/api-reference/functions/next-response), [Static Exports](https://nextjs.org/docs/app/guides/static-exports), [Authentication](https://nextjs.org/docs/app/guides/authentication), and [Server Actions](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4**. Prior pages: [11 · Backend for Frontend: the API layer](11-backend-for-frontend-route-handlers-as-a-public-api-layer.md), [12 · BFF: proxying, webhooks, callbacks](12-bff-proxying-webhooks-and-callback-routes.md).

**A Backend for Frontend built in Next.js has four hard boundaries, and three of them are cheap to hit by accident. Server Components must not fetch from your own Route Handlers — at build time there is no server listening, so prerendering fails outright; at runtime it is a pointless HTTP round trip between two things in the same process. Server Actions are queued, so using them to read data serialises your reads. `export` mode supports only static `GET` handlers. And on a serverless host, a Route Handler cannot share state between requests, cannot write to the filesystem, and cannot hold a WebSocket open. This page is those boundaries plus the security discipline the guide asks for in between.**

## Headers: where a value goes decides who can read it

The guide's instruction is to be deliberate about where headers go, and in particular to avoid passing incoming request headers straight through to the outgoing response. It then splits the API surface into two categories, and the split is the whole lesson.

**Upstream request headers.** In Proxy, `NextResponse.next({ request: { headers } })` modifies the headers *your own server* receives for the rest of the request. Nothing set this way is exposed to the client.

**Response headers.** `new Response(..., { headers })`, `NextResponse.json(..., { headers })`, `NextResponse.next({ headers })` and `response.headers.set(...)` all send headers back to the client. The consequence the docs spell out is blunt: any sensitive value you appended to one of these is visible to clients.

Two nearly identical calls, opposite audiences:

```ts filename="proxy.ts"
// Server-only: the render sees this, the browser never does.
return NextResponse.next({ request: { headers: enrichedHeaders } })

// Client-visible: everything here ships to the browser.
response.headers.set('x-tenant-id', tenantId)
```

Resolved tenant identifiers, decoded JWT claims, internal correlation IDs and upstream API keys belong in the first form. The second is the CSP-nonce pattern's `x-nonce`, which is deliberately client-adjacent but harmless.

The reverse direction is the other half of the warning: copying incoming request headers wholesale onto an outgoing response reflects whatever the client sent — including headers your CDN or WAF added and expected to strip.

## Rate limiting

Rate limiting is something you can implement inside your Next.js backend, and the guide's phrasing is that code-based checks should sit *in addition to* whatever rate limiting features your host provides — not instead of them.

```ts filename="/app/resource/route.ts"
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const { rateLimited } = await checkRateLimit(request)

  if (rateLimited) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  return new Response(null, { status: 204 })
}
```

"In addition to" is doing real work in that sentence. In-process rate limiting on a serverless host counts per instance, so N instances multiply your intended limit by N unless the counter lives in shared storage. And an in-process check still costs a function invocation — the request was already billed by the time you rejected it. Host-level limiting rejects before your code runs; code-level limiting enforces business rules the host cannot see. You want both.

## Verifying payloads

The guide's rule is that incoming request data is never trusted. Concretely, that means validating both the content type and the size of what arrived, and sanitizing against XSS before the value is used anywhere.

It also asks for timeouts, on the reasoning that a bounded execution window is what prevents abuse from consuming server resources indefinitely.

And it takes a position on uploads: user-generated static assets belong in dedicated services, and where you can, the file should be uploaded from the browser directly, with only the returned URI stored in your database. The stated benefit is a smaller request.

The upload advice is the one people skip and then regret. Routing a file through a Route Handler means the bytes traverse your function, consuming its memory, its time limit and its bandwidth allowance. A pre-signed direct-to-storage upload with the URI stored afterwards moves all three costs to the storage provider — and removes an unauthenticated path from attacker bytes to your process, which the 2026 image-decoder advisories make a pointed argument for.

Content type and size checks come *before* parsing, not after:

```ts
export async function POST(request: Request) {
  const type = request.headers.get('content-type') ?? ''
  if (!type.startsWith('application/json')) {
    return new Response('Unsupported Media Type', { status: 415 })
  }
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > 100_000) {
    return new Response('Payload Too Large', { status: 413 })
  }
  const body = await request.json()
  // ...
}
```

## Access to protected resources

Three rules, stated plainly by the guide. Credentials are verified before access is granted, every time — and `proxy` on its own is not sufficient for authentication and authorization. Sensitive or simply unnecessary data is stripped out of responses *and* out of your backend logs, which is the half people forget. Credentials and API keys are rotated on a regular schedule.

"Do not rely on proxy alone" is not abstract caution. The July 2026 security release disclosed a proxy/middleware bypass triggered by the App Router built with Turbopack plus a single entry in `config.i18n.locales`, and separately the global disclosure of Server Function endpoint IDs — two independent ways to reach the data without passing the filter.

## Library factory patterns

Community libraries commonly ship a factory rather than a handler — you call the library's creator function with options and export whatever it returns.

```ts filename="/app/api/[...path]/route.ts"
import { createHandler } from 'third-party-library'

const handler = createHandler({
  /* library-specific options */
})

export const GET = handler
// or
export { handler as POST }
```

That produces one shared handler serving both `GET` and `POST`. The library then varies its behaviour internally from the request's `method` and `pathname` — the routing you would normally write yourself has moved inside the dependency.

```ts filename="proxy.ts"
import { createMiddleware } from 'third-party-library'

export default createMiddleware()
```

A naming trap the docs flag directly: third-party libraries may still call `proxy` "middleware", so a package's README and its exported symbol names can use the older term for the same file.

A catch-all handler under `[...path]` mounted from a library is a single route that answers an entire URL subtree. It is convenient and it is also a large delegated attack surface — the library, not your code, decides what each path does.

## Caveat 1 — do not fetch your own Route Handlers from a Server Component

The instruction is unambiguous: a Server Component fetches its data directly from the source, not by way of one of your own Route Handlers. The docs give two separate failure modes depending on when the component renders.

For a Server Component prerendered at build time, going through a Route Handler **fails the build step** outright, because while the build is running there is no server listening to answer those requests.

For a Server Component rendered on demand, it does not fail — it is simply slower, paying an extra HTTP round trip between the handler and the render process that produced nothing the render could not have done itself.

The mechanism underneath both is the absolute-URL requirement. A server-side `fetch` uses absolute URLs, which implies an HTTP round trip to an external server. During development, your own development server plays the part of that external server. At build time there is no server at all. At runtime, the server in question is reachable only through your public-facing domain.

That last paragraph explains why this bug survives development. In `next dev` your own dev server answers the request, so it works. At build time nothing is listening and prerendering fails. In production it works but pays a full network round trip out to your public domain and back — through your CDN, your load balancer and your own routing — to reach code that was already in the process.

Extract the logic into a function and call it from both places:

```ts filename="lib/products.ts"
import 'server-only'
export async function getProducts() {
  return db.product.findMany()
}
```

```tsx filename="app/products/page.tsx"
import { getProducts } from '@/lib/products'
export default async function Page() {
  const products = await getProducts()   // direct call, no HTTP
  // ...
}
```

```ts filename="app/api/products/route.ts"
import { getProducts } from '@/lib/products'
export async function GET() {
  return Response.json(await getProducts())  // for browser clients
}
```

The guide also names the legitimate reasons to fetch from the client instead. Its position is that Server Components cover most data-fetching needs, with two categories of exception. The first is data that depends on Web APIs which only exist on the client — it names the Geo-location API, the Storage API, the Audio API and the File API. The second is data that is frequently polled. For both, the guide points you at community libraries such as `swr` or `react-query` rather than at anything built in.

## Caveat 2 — Server Actions are queued

Server Actions exist to run server-side code from the client, and the docs are specific that their primary purpose is **mutating** data from your frontend client — not reading it.

The reason that distinction has teeth: Server Actions are queued. Use them for data fetching and you have introduced sequential execution into what should have been concurrent reads.

Two components each calling an action to load their own data do not run in parallel; the second waits for the first. That is correct for mutations — you want writes ordered — and wrong for reads. Reads belong in Server Components, or in a Route Handler consumed by a client data library.

## Caveat 3 — `export` mode

`export` mode outputs a static site with no runtime server behind it. Every feature that requires the Next.js runtime is therefore unsupported — not disabled by policy, but absent, because the mode produces static files and nothing to execute them.

What survives is narrow: only `GET` Route Handlers are supported in `export` mode, and only in combination with the `dynamic` route segment config set to `'force-static'`.

```js filename="app/hello-world/route.ts"
export const dynamic = 'force-static'

export function GET() {
  return new Response('Hello World', { status: 200 })
}
```

The docs describe that as a way to generate static HTML, JSON, TXT or other files at build time.

So a Route Handler in export mode is a file generator, not an endpoint. No `POST`, no webhooks, no proxying, no authentication.

## Caveat 4 — the serverless deployment environment

Some hosts deploy Route Handlers as lambda functions, and the guide lists four consequences of that. Route Handlers cannot share data between requests. The environment may not support writing to the file system. Long-running handlers may be terminated because of timeouts. And WebSockets will not work, because the connection closes either on timeout or once the response has been generated.

Each bullet kills a specific familiar pattern: an in-memory cache or rate-limit counter, a temp-file upload buffer, a long-poll or SSE stream held open for minutes, and a WebSocket server. All four are standard on a single long-lived Node process and none survive a per-request function. This is the same boundary that makes shared cache and `waitUntil` matter on the deployment side.

## Gotchas

**★ Fetching your own Route Handler from a Server Component and only finding out at build time.**
It works in `next dev` because your dev server is listening, then fails the production build with no server to answer the request — or, if the route is dynamic, quietly costs a full round trip out through your public domain and back. Extract the logic into a shared function and call it directly from the component while the handler calls the same function for browser clients.

**★ Using Server Actions to load data because they were already there.**
Actions are queued, so two components loading their own data through actions run sequentially rather than in parallel. Nothing errors; the page is just slower in a way that profiling attributes to the network. Mutations belong in actions; reads belong in Server Components or in a Route Handler behind a client data library.

**★ Rate limiting in process on a serverless host.**
An in-memory counter counts per instance, so a limit of 100 becomes 100 × instances, and the check runs only after the request has already been routed and billed. Put the counter in shared storage, and enable your host's own rate limiting in front of it — the guide asks for code-based checks *in addition to* whatever rate limiting your host offers, not as a replacement for it.

**★ Reflecting incoming request headers onto the outgoing response.**
The guide warns against passing incoming request headers directly through to the outgoing response. Doing so echoes whatever the client sent — including headers your CDN or WAF injected and expected to consume — and any internal value you appended along the way becomes visible to the client.

**★ Enriching headers with `response.headers.set` when you meant the request.**
`NextResponse.next({ request: { headers } })` changes what your *server* sees and is invisible to the browser; `response.headers.set(...)` ships to the browser. Confusing them puts a decoded claim, a tenant identifier or an upstream key into a response header. The two calls are one word apart.

**★ Validating the body before checking its content type and size.**
`await request.json()` on a 500 MB body has already consumed the memory by the time your schema rejects it. Check `content-type` and `content-length` first and return 415 or 413 without parsing.

**★ Accepting file uploads through a Route Handler.**
The bytes traverse your function, spending its memory, its execution limit and its bandwidth — and on a serverless host you may not even be able to write them to disk. The guide's advice is to upload from the browser where you can and store only the returned URI in your database, which also keeps the request small. That also removes an unauthenticated path from attacker-supplied bytes to your process, which the 2026 image-decoder advisories make a strong case for.

**★ Holding a WebSocket or a long-lived SSE stream open in a Route Handler.**
On a lambda-style host the connection closes on timeout or once the response is generated. It works locally on a long-lived Node process and fails in production in a way that looks like flaky networking. Use a dedicated realtime service, or deploy the app as a persistent Node server and know that you have made that choice.

**★ Keeping an in-memory cache in a Route Handler module scope.**
Route Handlers cannot share data between requests on a lambda host. A module-level `Map` is per-instance and per-cold-start, so hit rates are unpredictable and stale entries live for unpredictable durations. Use the framework's cache directives or an external store.

**★ Shipping a `POST` handler in an application configured for `export`.**
Only `GET` handlers with `dynamic = 'force-static'` are supported. Anything else is unsupported in a mode that produces no runtime server, so an endpoint that works in `next dev` simply is not present in the exported output.

**★ Mounting a third-party catch-all handler without reading what it routes.**
`app/api/[...path]/route.ts` exporting a library factory hands an entire URL subtree to code you did not write, which decides behaviour from `method` and `pathname`. Know which paths it claims and what each does before you put an authorization boundary anywhere near it.

**★ Assuming an unlinked handler is private.**
Route Handlers are public HTTP endpoints; obscurity is not a control, and the July 2026 disclosure of Server Function endpoint IDs shows how quickly internal addresses become external knowledge. Every handler verifies credentials itself, before granting any access — the guide states that as an unconditional rule.

## Interview questions

**★ Why must a Server Component not fetch from your own Route Handler?**
Because a server-side `fetch` needs an absolute URL, which means a real HTTP round trip to an external server. At build time there is no server listening, so a prerendered Server Component that does this fails the build. At runtime it works but is slower, adding a round trip out through your public domain — CDN, load balancer, routing — to reach code already in the same process. The fix is to extract a plain function and call it directly from the component, exposing the same function through the handler for genuine external clients.

**★ Why does this bug survive development?**
Because in `next dev` your own development server acts as the external server, so the fetch resolves and everything appears to work. The failure only surfaces at build time, when nothing is listening — which is the least convenient moment to discover an architectural assumption.

**★ When is client-side fetching genuinely the right answer in the App Router?**
When the data depends on client-only Web APIs — geolocation, storage, audio, the File API — or when it is frequently polled. The guide names both and points to `swr` and `react-query` for them. Everything else is a Server Component read.

**★ Why should you not use Server Actions for data fetching?**
Because they are queued, so using them to read introduces sequential execution: two components fetching through actions wait for each other rather than running in parallel. Their purpose is mutation from the client, where ordering is a feature.

**★ What survives in `export` mode, and what does that make a Route Handler?**
Only `GET` handlers with `export const dynamic = 'force-static'`. There is no runtime server, so nothing that needs one exists. That makes a Route Handler in export mode a build-time file generator — it can emit HTML, JSON, TXT or anything else as a static artefact — not an endpoint.

**★ Name four things a Route Handler cannot do on a lambda-style host.**
Share data between requests, write to the filesystem reliably, run long enough to avoid a timeout, or hold a WebSocket open — the connection closes on timeout or once the response is generated. Every one of those is routine on a single long-lived Node process, which is why the same code behaves differently between `next start` on a container and a per-request function.

**★ What is the difference between the two ways of setting headers in a proxy, and why does the guide warn about it?**
`NextResponse.next({ request: { headers } })` modifies the headers your server receives for the remainder of the request and is invisible to the client. Setting them on the response — via `new Response`, `NextResponse.json`, `NextResponse.next({ headers })` or `response.headers.set` — sends them to the browser. The guide warns because the calls look nearly identical, and because any sensitive value appended to a response header is, by construction, visible to clients.

**★ Why is in-process rate limiting insufficient on serverless, and what do you do instead?**
Because the counter is per instance, so the effective limit multiplies by the number of concurrent instances, and because the check runs after the request has already been routed and billed. Move the counter to shared storage so the limit is global, and enable the host's own rate limiting in front so abusive traffic is rejected before your code runs. The guide asks for both layers explicitly.

**★ Why does the guide recommend uploading files from the browser directly to storage?**
To keep the bytes out of your function. Routing an upload through a Route Handler spends that function's memory, execution time and bandwidth, and on a serverless host you may not be able to buffer to disk at all. Uploading from the browser and storing the returned URI reduces request size and removes a path from attacker-supplied bytes to your process — which, given the 2026 image-decoder advisories, is a security argument as much as a performance one.

---

← [BFF: proxying, webhooks, callbacks](12-bff-proxying-webhooks-and-callback-routes.md) · [Chapter 4 overview](01-explanation.md) · Next → [Client-side data fetching: choosing](14-client-side-data-fetching-and-when-it-is-still-correct.md)
