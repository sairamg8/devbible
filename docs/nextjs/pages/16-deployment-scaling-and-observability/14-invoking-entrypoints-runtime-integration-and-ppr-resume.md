---
sidebar_position: 14
title: "The adapter is build-time, but the code it packages still has to be called: handler(req, res, ctx), waitUntil, onCacheEntryV2, and the POST-with-postponed-state resume protocol"
sidebar_label: "Invoking entrypoints, and PPR resume"
description: "How an adapter invokes Node.js and Edge build entrypoints, what requestMeta and waitUntil are for, and the full PPR seed-and-resume flow using fallback.postponedState and onCacheEntryV2."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Adapters · Invoking Entrypoints](https://nextjs.org/docs/app/api-reference/adapters/invoking-entrypoints), [Adapters · Runtime Integration](https://nextjs.org/docs/app/api-reference/adapters/runtime-integration), [Adapters · Implementing PPR in an Adapter](https://nextjs.org/docs/app/api-reference/adapters/implementing-ppr-in-an-adapter), [Adapters · Output Types](https://nextjs.org/docs/app/api-reference/adapters/output-types), and [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms).
> Target: **Next.js 16.3.4**. Adapter API stable since 16.2. Prior page: [13 · Adapter routing and `@next/routing`](13-adapter-routing-seven-phases-and-the-next-routing-package.md).

**An adapter's build hook ends with a directory of packaged functions. Something then has to call them, and that calling convention is where a platform stops being a file-copier and starts being a Next.js host. The interface is deliberately small — `handler(req, res, ctx)` over Node's own `IncomingMessage` and `ServerResponse` — and everything interesting hangs off `ctx`: `waitUntil` for work that must outlive the response, and `requestMeta` for the hooks that let a platform own the cache. The most demanding of those hooks is the PPR resume protocol, which is how a CDN serves a prerendered shell in microseconds and then stitches the dynamic remainder onto the same HTTP response.**

## The Node.js entrypoint interface

> *"Build output entrypoints use a `handler(..., ctx)` interface, with runtime-specific request/response types."*

```typescript
handler(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: {
    waitUntil?: (promise: Promise<void>) => void
    requestMeta?: RequestMeta
  }
): Promise<void>
```

This is deliberately Node-shaped, not Fetch-shaped. A platform whose runtime speaks `Request`/`Response` must adapt in both directions before calling the handler.

`requestMeta` carries the helpers that used to require reaching into framework internals:

> *"When invoking Node.js entrypoints directly, adapters can pass helpers directly on `requestMeta` instead of relying on internals."*

```ts
await handler(req, res, {
  requestMeta: {
    // Relative path from process.cwd() to the Next.js project directory.
    relativeProjectDir: '.',
    // Optional hostname used by route handlers when constructing absolute URLs.
    hostname: '127.0.0.1',
    // Optional internal revalidate function to avoid revalidating over the network
    revalidate: async ({ urlPath, headers, opts }) => {
      // platform-specific revalidate implementation
    },
    // Optional function to render the 404 page for pages router `notFound: true`
    render404: async (req, res, parsedUrl, setHeaders) => {
      // platform-specific 404 rendering implementation
    },
  },
})
```

`revalidate` is the one worth dwelling on: its stated purpose is *"to avoid revalidating over the network"*. Without it, an ISR revalidation triggered inside a function makes an HTTP request back to the platform's own front door — a request that must be routed, authenticated, and billed, and that can deadlock a single-concurrency function invoking itself. Supplying `requestMeta.revalidate` turns that into an in-process call into the platform's cache.

## `waitUntil` — the difference between working ISR and randomly-truncated ISR

> *"`ctx.waitUntil`: a function that accepts a promise. Use this to keep the serverless function alive after the response is sent, allowing background work like cache revalidation to complete."*

Stale-while-revalidate means the response goes out from cache while the regeneration continues. On a serverless platform, "after the response is sent" is precisely when the execution environment is frozen or destroyed. If `waitUntil` is absent, the revalidation is killed partway through — sometimes after the write, sometimes before, and the resulting cache state is whatever the truncation left behind.

The same applies to `after()`. The platform feature matrix lists `after()` as requiring *"graceful shutdown support"* rather than streaming, which is the same requirement stated from the other side.

## Edge entrypoints, and why not to build for them

The Edge Runtime is deprecated. The invoking-entrypoints page states it before showing the interface: *"New routes should use the Node.js runtime."* For legacy support:

```typescript
handler(
  request: Request,
  ctx: {
    waitUntil?: (prom: Promise<void>) => void
    signal?: AbortSignal
    requestMeta?: RequestMeta
  }
): Promise<Response>
```

Edge outputs carry `output.edgeRuntime` with everything needed to find the function after the chunks are loaded:

```ts
const entry = await globalThis._ENTRIES[output.edgeRuntime.entryKey]
const handler = entry[output.edgeRuntime.handlerExport]
await handler(request, ctx)
```

And an instruction that exists because platforms used to do the opposite:

> *"Use `edgeRuntime` instead of deriving registry keys or handler names from filenames."*

## The PPR resume protocol

Partial Prerendering means a route has two halves: a prerendered static shell, and postponed work that only a server can finish. On `next start`, both happen in one pass and you never see the seam. An adapter that wants the shell served from a CDN has to reconstitute that seam itself.

> *"In standard `next start`, the server handles both the shell and dynamic render in a single pass automatically. The resume protocol is useful for adapter-based deployments and CDN-to-origin architectures that want to serve the shell separately."*

### Step 1 — seed the cache at build time

The build gives you both halves:

> *"`outputs.prerenders[].fallback.filePath`: path to the generated fallback shell (for example HTML) · `outputs.prerenders[].fallback.postponedState`: serialized postponed state used to resume rendering"*

```ts filename="my-adapter.ts"
import { readFile } from 'node:fs/promises'

async function seedPprEntries(outputs: AdapterOutputs) {
  for (const prerender of outputs.prerenders) {
    const fallback = prerender.fallback
    if (!fallback?.filePath || !fallback.postponedState) continue

    const shell = await readFile(fallback.filePath, 'utf8')
    await platformCache.set(prerender.pathname, {
      shell,
      postponedState: fallback.postponedState,
      initialHeaders: fallback.initialHeaders,
      initialStatus: fallback.initialStatus,
      initialRevalidate: fallback.initialRevalidate,
      initialExpiration: fallback.initialExpiration,
    })
  }
}
```

The `initialHeaders`, `initialStatus`, `initialRevalidate` and `initialExpiration` fields exist so the cached shell can be served with the same response metadata the origin would have produced. Dropping them means the shell goes out with default headers and a status of 200 even when the route prerendered a 404.

### Step 2 — the three-header handshake at request time

> *"When your adapter detects a PPR-enabled route with a cached static shell: 1. Set the `pprChain.headers` on the internal request to the Next.js handler. 2. Send the request as a **POST** with the `postponedState` as the request body. 3. The handler will render only the deferred Suspense boundaries and stream the result."*

`pprChain.headers` is documented as containing `{ 'next-resume': '1' }`. The POST is not a mutation — it is the transport for a body that would not fit in a header.

The response the client sees is a single HTTP response whose body is the concatenation of two streams: the cached shell first, then the resumed render. The documentation's own diagram of the flow:

```text
Client
  | GET /ppr-route
  v
Adapter Router
  |
  |-- read cached shell + postponedState ---> Platform Cache
  |<------------- cache hit -----------------|
  |
  |-- create responseStream = concat(shellStream, resumedStream)
  |
  |-- start piping shellStream ------------> Client (first bytes)
  |
  |-- invoke handler(req, res, { requestMeta: { postponed } })
  |   -------------------------------------> Entrypoint (handler)
  |   <------------------------------------- resumed chunks/cache entry
  |
  |-- append resumed chunks to resumedStream
  |
  '-- client receives one HTTP response:
      [shell bytes........][resumed bytes........]
```

### Step 3 — keep the cache current with `onCacheEntryV2`

> *"`requestMeta.onCacheEntryV2` is called when a response cache entry is looked up or generated. Use it to persist updated shell/postponed data."*

```ts filename="my-adapter.ts"
await handler(req, res, {
  waitUntil,
  requestMeta: {
    postponed: cachedPprEntry?.postponedState,
    onCacheEntryV2: async (cacheEntry, meta) => {
      if (cacheEntry.value?.kind === 'APP_PAGE') {
        const html =
          cacheEntry.value.html &&
          typeof cacheEntry.value.html.toUnchunkedString === 'function'
            ? cacheEntry.value.html.toUnchunkedString()
            : null

        await platformCache.set(meta.url || req.url || '/', {
          shell: html,
          postponedState: cacheEntry.value.postponed,
          headers: cacheEntry.value.headers,
          status: cacheEntry.value.status,
          cacheControl: cacheEntry.cacheControl,
        })
      }

      // Return true only if your adapter already wrote the response itself.
      return false
    },
  },
})
```

The return value is a control-flow switch, not a success flag:

```text
requestMeta.onCacheEntryV2 callback
  |
  |-- if APP_PAGE ---> persist html + postponedState + headers ---> Platform Cache
  |
  '-- return false: continue normal Next.js response flow
      return true:  adapter already handled response (short-circuit)
```

The docs also mark the migration explicitly:

> *"`requestMeta.onCacheEntry` still works, but is deprecated. Prefer `requestMeta.onCacheEntryV2`. If your adapter uses an internal `onCacheCallback` abstraction, wire it to `requestMeta.onCacheEntryV2`."*

### Why `onCacheEntryV2` matters beyond PPR

> *"a callback that fires when a cache entry is generated or looked up. Use this to observe all cache operations (not just PPR) and propagate cache updates to your platform's storage backend. This callback fires on the instance that handled the request. For multi-instance deployments, your adapter should propagate updates to shared storage."*

"Fires on the instance that handled the request" is the sentence that decides your architecture. Every regeneration happens on exactly one machine, and unless that machine pushes the result somewhere shared, the other instances keep serving their own stale copies until their own TTLs lapse. This is the same fact the platform guide states from the user's side: without shared cache, *"revalidation events don't propagate across instances."*

## Where the resume protocol pays and where it does not

The CDN infrastructure table in the platform guide lists PPR resuming as achievable on Cloudflare (worker), Akamai (worker), CloudFront (Lambda), Fastly (WASM), Azure (server) and Google Cloud (server) — but then adds a sentence worth reading before you build it:

> *"These are available building blocks, not finished integrations. Most community adapters today deploy Next.js as a Docker container or Node.js server without leveraging CDN-specific primitives like edge KV or PPR resuming."*

Resume is a *performance fidelity* optimization. A container serving PPR from a single origin is functionally correct; it just pays origin latency for the shell that a CDN could have delivered from the nearest edge.

## Gotchas

**★ Omitting `waitUntil` and getting cache entries that are half-written.**
Stale-while-revalidate sends the response and continues regenerating. On serverless, the environment freezes the moment the response completes, so a revalidation without `waitUntil` is truncated at an arbitrary point. The symptom is intermittently corrupt or missing cache entries with no error anywhere. Always pass it, and always pass it for `after()` too:

```ts
await handler(req, res, { waitUntil: (p) => ctx.waitUntil(p), requestMeta })
```

**★ Letting ISR revalidation go out over the public network.**
Without `requestMeta.revalidate`, a revalidation triggered inside a function issues an HTTP request back to your own front door — routed, authenticated, billed, and capable of deadlocking a function whose concurrency limit is one. Supply the in-process implementation, which is exactly what the field is documented for.

**★ Sending the resume request as a GET.**
The postponed state is a serialized payload that belongs in a body. The protocol is a POST carrying `postponedState`, with `pprChain.headers` (`{ 'next-resume': '1' }`) set. A GET either loses the state and re-renders the whole page — silently doubling origin cost — or is rejected.

**★ Dropping `initialHeaders` and `initialStatus` when seeding the shell.**
The fallback object carries them for a reason: a prerender that produced a 404 or set a `Cache-Control` must be replayed with those. Seeding only the HTML gives every shell a bare 200 with platform-default headers, and turns a prerendered not-found page into a 200 with 404 content — which search engines will happily index.

**★ Returning `true` from `onCacheEntryV2` when you have not written the response.**
The return value is a short-circuit: *"Return true only if your adapter already wrote the response itself."* Returning `true` after merely persisting a cache entry aborts the normal Next.js response flow and the client receives nothing. Return `false` unless you genuinely produced the bytes.

**★ Assuming `onCacheEntryV2` gives you cross-instance propagation for free.**
It fires only on the instance that handled the request. Multi-instance deployments must push the update to shared storage from inside the callback, or every other instance keeps its own stale copy until its own TTL expires. The callback is the hook; the propagation is still your job.

**★ Still wiring `onCacheEntry` instead of `onCacheEntryV2`.**
The V1 callback works and is deprecated. New adapters that copy an older reference implementation inherit the deprecated path and will need a second migration. If you have an internal `onCacheCallback` abstraction, the docs tell you where to point it.

**★ Building the Edge path first because it seems more modern.**
It is deprecated in both the output-types and invoking-entrypoints references. The Node.js interface — `IncomingMessage`, `ServerResponse`, `ctx` — is the one under active development and the one the compatibility suite exercises most heavily. Implement Node first; add Edge only if you must host existing `runtime = 'edge'` routes.

**★ Deriving the edge registry key from the output's file path.**
The `edgeRuntime` object exists to prevent this, and the docs say so directly. Chunk file names change between builds and bundler versions; `entryKey` is the canonical identity in `globalThis._ENTRIES` and `handlerExport` names the export to call.

**★ Forgetting `relativeProjectDir` in a monorepo invocation.**
It is documented as *"Relative path from `process.cwd()` to the Next.js project directory."* In a workspace where the packaged function's working directory is the bundle root but the app lives at `packages/web`, omitting it makes the handler resolve its own assets against the wrong directory — producing missing-chunk errors that look like a broken build rather than a broken invocation.

## Interview questions

**★ What does an adapter actually call, and with what?**
For Node.js outputs, `handler(req, res, ctx)` where `req` is an `IncomingMessage`, `res` a `ServerResponse`, and `ctx` carries optional `waitUntil` and `requestMeta`. For deprecated Edge outputs, `handler(request, ctx)` over Fetch `Request`/`Response` with an additional `signal`. A platform whose runtime is Fetch-shaped must adapt into Node primitives before calling a Node entrypoint.

**★ Why is `waitUntil` not optional in practice on a serverless platform?**
Because stale-while-revalidate and `after()` both do work after the response is sent, and that is exactly when a serverless environment freezes. Without `waitUntil`, revalidation is truncated at an arbitrary point, leaving cache entries in whatever state the kill left them. The documented purpose is to *"keep the serverless function alive after the response is sent."*

**★ Walk through the PPR resume protocol.**
At build time the adapter seeds a cache entry per prerender with `fallback.filePath` (the shell) and `fallback.postponedState`, plus the initial status, headers, revalidate and expiration. At request time, on a hit, the adapter starts streaming the shell to the client immediately, then invokes the entrypoint as a POST with `pprChain.headers` set (`next-resume: 1`) and `postponedState` as the body — passed through as `requestMeta.postponed`. Next.js renders only the deferred Suspense boundaries and streams them back, and the adapter appends those chunks to the same response. The client sees one HTTP response whose body is shell bytes followed by resumed bytes.

**★ What is `requestMeta.onCacheEntryV2` for, and what is its return value?**
It fires whenever a response cache entry is looked up or generated — not only for PPR — and is how a platform observes and persists cache state. Its return value is a short-circuit: `false` continues the normal Next.js response flow, `true` tells Next.js the adapter has already written the response itself. Returning `true` without doing so leaves the client with nothing.

**★ Why is "fires on the instance that handled the request" the most important sentence in the runtime-integration page?**
Because it defines the boundary of what the callback gives you. Regeneration happens on one machine. Unless the adapter propagates the resulting entry to shared storage from inside the callback, every other instance keeps serving its own stale copy until its own TTL lapses — which is the multi-instance divergence the platform guide warns about when it lists shared cache as "recommended" for ISR, PPR and Cache Components.

**★ How does `requestMeta.revalidate` change the cost of ISR on a serverless platform?**
Without it, an in-function revalidation goes out as an HTTP request to the deployment's public front door: another routing pass, another function invocation, another billed request, and a genuine deadlock risk when a function's concurrency limit is one and it is waiting on itself. With it, the platform performs the revalidation in-process against its own cache. The docs describe the field as existing *"to avoid revalidating over the network."*

**★ Should a new adapter implement the Edge entrypoint path?**
Only for compatibility with existing `runtime = 'edge'` routes. Both the output-types and invoking-entrypoints references mark the Edge Runtime deprecated and say new routes should use Node.js. The Node interface is the one the compatibility suite exercises and the one that will survive the next major.

**★ Is PPR resume required for a platform to support PPR?**
No. The feature matrix marks "Edge Stitching" as *optional* for Partial Prerendering and states that all features work correctly from a single origin server. Resume is a performance-fidelity optimization that moves the shell to the edge; a container serving PPR from one origin is functionally correct and passes the same test suite.

{/* FOOTER */}
