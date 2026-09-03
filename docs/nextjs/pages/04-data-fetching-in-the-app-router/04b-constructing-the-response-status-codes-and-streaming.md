---
title: "There is no res in a Route Handler, so res.status, res.json, res.redirect and res.sendFile all become something you assemble — and the assembly is where a 204 throws, a redirect gets swallowed by your own try/catch, and a proxied download times out on the first large file"
sidebar_label: "04b · Constructing the response"
sidebar_position: 4.1
description: "Response.json versus the constructor, a status-code table for a real REST API, 201 with Location, why 204 must carry a null body, ETags and conditional GET, the two kinds of redirect and their different control flow, and streaming and file responses including the cancel callback everyone omits."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (docs `lastUpdated` 2026-04-30) — the streaming, redirect and non-UI response examples. Null-body statuses, `Response.json` and `ReadableStream` semantics per the WHATWG Fetch and Streams standards.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A Route Handler returns a value. There is no response object to write into, no `res.status(201).json(x)` chain, and no half-written response that can fail partway. That is a real improvement — a client gets a response only if some code path returned one — and it relocates every mistake to the construction site. The four that recur: a `204` built with a body, which throws a `TypeError` the first time your delete endpoint succeeds; a `redirect()` caught by the `try/catch` you added to make the handler robust; a `201` with no `Location`, so a generic client has nowhere to go; and `await upstream.arrayBuffer()` in a download proxy, which works on every test fixture and times out on the first real file. This page is the assembly manual for the success paths. Failure paths get their own shape on [04c](04c-error-responses-a-client-can-branch-on.md); the verbs and routing are on [04](04-route-handlers-routets-for-restful-apis.md).**

## `Response.json` versus the constructor

`Response.json(data, init?)` is the Web-standard shorthand: it serialises the value, sets the JSON content type, and takes the same `init` as the `Response` constructor for status and headers. `NextResponse.json` is the Next extension with cookie, redirect and rewrite helpers on top; [12](12-bff-proxying-webhooks-and-callback-routes.md) covers when the wrapper earns its place, and the short answer is *when you need one of those helpers and not otherwise* — preferring the standard helper keeps a handler portable to any Web-standard runtime.

Use the bare constructor whenever the body is not JSON, or when there is no body at all:

```ts
new Response(null, { status: 204 })                                   // no content
new Response(xml, { headers: { 'Content-Type': 'application/xml' } }) // a feed
new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } })
new Response('Rate limit exceeded', { status: 429, headers: { 'Retry-After': '30' } })
```

## Status codes a real client can branch on

| Status | Use it for | The body |
|---|---|---|
| `200 OK` | a successful read, or an update returning the new representation | the resource |
| `201 Created` | a successful create | the created resource, **plus a `Location` header** |
| `202 Accepted` | you queued the work and it is not done | a job id the client can poll |
| `204 No Content` | a successful delete, or an update returning nothing | 🔴 **must be `null`** |
| `304 Not Modified` | a conditional `GET` whose `If-None-Match` matched your `ETag` | must be empty |
| `400 Bad Request` | malformed syntax — unparseable JSON, a body you cannot decode | your error envelope |
| `401 Unauthorized` | no credentials, or credentials the server could not verify | envelope, plus `WWW-Authenticate` if you use a scheme |
| `403 Forbidden` | authenticated, and not allowed | envelope — and do not explain *why* in detail |
| `404 Not Found` | no such resource, **or** a resource this caller may not know exists | envelope |
| `405 Method Not Allowed` | issued by the framework for an unexported verb | the framework's |
| `409 Conflict` | a uniqueness violation, or a lost update caught by an optimistic-concurrency check | envelope naming the conflicting field |
| `415 Unsupported Media Type` | the `Content-Type` is not one you parse | envelope |
| `422 Unprocessable Content` | syntactically valid, semantically rejected — failed schema validation | envelope with per-field errors |
| `429 Too Many Requests` | rate limited | envelope, plus `Retry-After` |
| `500 Internal Server Error` | you threw | 🔴 an opaque envelope and a correlation id |
| `503 Service Unavailable` | a dependency is down, or you are shedding load | envelope, plus `Retry-After` |

The distinction that pays for itself in support tickets is **400 versus 422**. `400` means the request could not be understood; `422` means it was understood and rejected on its content. A client can fix a `422` by changing one field and retrying; a `400` usually means the client's own serialiser is broken and the identical retry will fail identically.

The one to decide before you ship is **403 versus 404**. Returning `404` for a resource the caller is not allowed to know exists is a legitimate hardening choice; `403` confirms existence. Both are fine. Not choosing is not, because a client that retries on `404` and gives up on `403` behaves very differently depending which you happened to write that day.

## `201` and `204`, the two that bite

```ts
// 201: the client should not have to guess where the new thing lives
return Response.json({ data: created }, {
  status: 201,
  headers: { Location: `/api/projects/${created.id}` },
})

// 204: a null-body status. Writing ANY body here throws.
return new Response(null, { status: 204 })
```

`204`, `205` and `304` are null-body statuses in the Fetch Standard — constructing a `Response` with a body and one of those statuses is a `TypeError`. The version that catches people is `Response.json(null, { status: 204 })`, which looks empty and is not: it serialises the four characters `null`. Use the constructor with an explicit `null` body.

## Conditional responses, so a client can skip the payload

If a resource is expensive to serialise and cheap to version, an `ETag` turns most polls into a `304` with no body — without changing the polling interval or the client's code path.

```ts
// app/api/projects/[id]/route.ts
export async function GET(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, name: true, updatedAt: true, version: true },
  })
  if (!project) return apiError(404, 'project_not_found', 'No project with that id.')

  const etag = `"${project.id}-${project.version}"`
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } })
  }

  return Response.json({ data: project }, {
    headers: { ETag: etag, 'Cache-Control': 'private, must-revalidate' },
  })
}
```

The same `ETag` is what makes optimistic concurrency available on the write path: require `If-Match` on the `PATCH`, compare it to the current version, and return `409 Conflict` when they differ instead of silently overwriting somebody's edit.

```ts
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const ifMatch = request.headers.get('If-Match')
  if (!ifMatch) return apiError(428, 'precondition_required', 'Send If-Match with the current ETag.')

  const patch = ProjectSchema.partial().parse(await request.json())
  const result = await db.project.updateMany({
    where: { id, version: Number(ifMatch.replace(/"/g, '').split('-').pop()) },
    data: { ...patch, version: { increment: 1 } },
  })
  if (result.count === 0) {
    return apiError(409, 'stale_version', 'The project changed since you last read it.')
  }
  return Response.json({ data: await db.project.findUnique({ where: { id } }) })
}
```

## Two kinds of redirect, with different control flow

```ts
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

// (a) redirect() from next/navigation — THROWS a control-flow exception.
export async function GET() {
  redirect('https://nextjs.org/')   // nothing after this line runs
}

// (b) NextResponse.redirect — an ordinary value you return.
export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL('/projects', request.url), 303)
}
```

Form (a) is documented for Route Handlers and is right when redirecting *is* the handler — an OAuth kickoff, a short-link expander. Form (b) is a value, so it survives a `try/catch` and lets you choose the status: `303 See Other` after a `POST` is what stops the browser re-submitting the body if the user reloads the destination.

🔴 The consequence of (a) throwing is that **a blanket `catch` in a Route Handler eats `redirect()` and `notFound()`**, converting a redirect into whatever your error path returns. Either re-throw them ([04c](04c-error-responses-a-client-can-branch-on.md)) or keep the call outside the `try`.

## Streaming, and the callback everyone omits

A `Response` accepts a `ReadableStream`, which is how you return something larger than memory, or something you do not have all of yet. The documentation's own example builds one from an async iterator; here is the shape a data export actually takes.

```ts
// app/api/projects/export/route.ts — newline-delimited JSON, one row at a time
export async function GET() {
  const encoder = new TextEncoder()
  const rows = db.project.cursor()   // an async iterator over rows

  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await rows.next()
      if (done) {
        controller.close()
      } else {
        controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'))
      }
    },
    cancel() {
      void rows.return?.()   // the client hung up — release the cursor
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': 'attachment; filename="projects.ndjson"',
      'Cache-Control': 'no-store',
    },
  })
}
```

`cancel` is the part most streaming handlers omit and then leak over. When the browser aborts the download — tab closed, CLI interrupted, proxy timed out — cancellation is the handler's only notification that nobody is reading, and a source that ignores it never releases its cursor or its connection. A load test that always reads to completion will never surface it.

Two operational notes travel with streaming. **An error thrown after the first chunk cannot become a `500`**, because the status line has already gone; the only honest signal left is closing the stream, which the client sees as truncation. And a long stream is bounded by whatever execution limit your platform applies — `maxDuration` on [04f](04f-caching-runtime-cors-and-the-public-endpoint-contract.md).

## Files and other non-UI content

A Route Handler exists precisely so a route can return something that is not HTML. `sitemap.xml`, `robots.txt`, app icons and Open Graph images have their own file conventions; anything else — an RSS feed, `llms.txt`, a `.well-known` document, a generated CSV — is a handler you write. [11](11-backend-for-frontend-route-handlers-as-a-public-api-layer.md) covers content negotiation between two representations of one URL.

```ts
// app/api/invoices/[id]/pdf/route.ts
export async function GET(request: NextRequest, ctx: RouteContext<'/api/invoices/[id]/pdf'>) {
  const { id } = await ctx.params
  const invoice = await db.invoice.findUnique({ where: { id } })
  if (!invoice) return apiError(404, 'invoice_not_found', 'No invoice with that id.')

  const upstream = await fetch(invoice.storageUrl)
  if (!upstream.ok || !upstream.body) {
    return apiError(502, 'storage_unavailable', 'Could not fetch the document.')
  }

  const safeName = `invoice-${invoice.number}`.replace(/[^\w.-]/g, '_')
  return new Response(upstream.body, {   // pass the stream through; do not buffer it
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
```

Passing `upstream.body` straight into the new `Response` streams the bytes through without buffering the whole file into the handler. The filename is sanitised because a value containing a quote, a comma or a newline breaks the header — and for anything non-ASCII the `filename*=UTF-8''...` form with the name percent-encoded is the correct spelling.

For genuinely large or hot objects, the better answer is not to proxy at all: hand the client a signed URL and let the storage provider serve the bytes. A proxy handler puts your compute in the path of every megabyte.

## Gotchas

**★ Symptom: your delete endpoint throws a `TypeError` about a null-body status the first time it succeeds.** Cause: `204` is a null-body status and `Response.json(...)` always writes a body — including `Response.json(null)`, which writes `null`. Fix: use the constructor.

```ts
return new Response(null, { status: 204 })   // not Response.json({}, { status: 204 })
```

**★ Symptom: `redirect()` inside a handler returns a `500`.** Cause: `redirect()` signals by throwing a control-flow exception, and your `try/catch` caught it and treated it as a failure. Fix: keep the call outside the `try`.

```ts
export async function GET(request: NextRequest) {
  const target = await resolveShortLink(request.nextUrl.pathname)
  if (!target) return apiError(404, 'link_not_found', 'Unknown short link.')
  redirect(target)   // outside any try/catch — nothing to swallow it
}
```

**★ Symptom: a `POST` that creates a resource returns `200` and the client library never follows up.** Cause: `201` plus `Location` is what tells a generic client where the new resource lives; `200` with a body says "here is a result", not "here is a new thing at this URL". Fix: set both, as in the `201` example above.

**★ Symptom: `Response.json(row)` throws `TypeError: Do not know how to serialize a BigInt`.** Cause: `JSON.stringify` has no `BigInt` case, and several ORMs return `bigint` for 64-bit integer columns and for aggregate counts. Fix: project and convert at the boundary — which you want anyway, so that adding a column never silently widens the payload.

```ts
return Response.json({ data: { id: row.id, name: row.name, views: Number(row.views) } })
```

**★ Symptom: a streaming export keeps a database cursor open after the user closes the tab.** Cause: aborting the request cancels the `ReadableStream`, and a source with no `cancel` implementation is never told. Fix: implement `cancel`, as in the NDJSON handler.

**★ Symptom: an error thrown mid-stream reaches the client as a truncated file rather than an error.** Cause: the status line and headers went out with the first chunk; there is no way back to `500` after that. Fix: validate everything you can before returning the `Response`, and give the format an end marker the client checks — for NDJSON, a final line the reader recognises; otherwise a length or checksum the client verifies.

**★ Symptom: a proxied file download works for small files and times out on large ones.** Cause: `await upstream.arrayBuffer()` before constructing the response buffers the whole file into the handler. Fix: pass `upstream.body` — a `ReadableStream` — straight into the new `Response`, as in the PDF handler.

**★ Symptom: two clients save a form seconds apart and the second silently wins.** Cause: an unconditional `PATCH` — nothing compared what the client last read against what is in the row. Fix: emit an `ETag` on the read, require `If-Match` on the write, and make the update conditional on the version so a mismatch returns `409` rather than overwriting.

**Symptom: dates come back from the API as strings and a client-side comparison silently does the wrong thing.** Cause: JSON has no date type; `Date` instances serialise to ISO strings. Fix: make the contract explicit — ISO strings on the wire, parsed once at the client boundary — rather than discovering it inside a sort comparator.

**Symptom: a download's filename is mangled, or the response headers are rejected outright.** Cause: `Content-Disposition` interpolated a name you did not generate, and it contained a quote, a comma or a newline. Fix: strip everything outside a safe character set, or emit the `filename*=UTF-8''...` form with the name percent-encoded.

**Symptom: you set `Cache-Control: no-store` on a response and Next still serves a stale body.** Cause: two different layers. The header instructs caches *downstream* of your application; Next's own caching of the handler is governed by route segment configuration. Fix: see [04f](04f-caching-runtime-cors-and-the-public-endpoint-contract.md) and [01d](01d-route-handlers-and-their-caching-model.md) — and note that the interaction between the two is not spelled out on the pages verified here, so set the segment config explicitly rather than inferring it from a header.

**Symptom: a `304` you return still carries a body and the client sees a parse error.** Cause: same rule as `204` — `304` is a null-body status. Fix: `new Response(null, { status: 304, headers: { ETag: etag } })`, and keep the `ETag` on the `304` so the client can keep using it.

## Interview questions

**★ Why is there no `res.json()` in a Route Handler, and what does that change about how you write one?**
Because a Route Handler is built on Fetch API primitives rather than Node's request/response pair, so the response is a return value rather than a stream you write into. The practical difference is in error handling: with `res` you could half-write a response and then fail, whereas here a client gets a response only if some code path returned one. That makes a wrapper turning every throw into one documented envelope both possible and necessary — and because the router reads only the export *name*, `export const GET = withApiErrors(handler)` composes for free.

**★ What is the difference between `redirect()` from `next/navigation` and `NextResponse.redirect()` inside a handler?**
Control flow. `redirect()` throws a control-flow exception, so nothing after it runs and a blanket `try/catch` swallows it into a `500` unless you re-throw. `NextResponse.redirect(url, status)` is an ordinary value you return, so it survives a `catch` and lets you choose the status — `303 See Other` after a `POST`, which stops the browser re-submitting the body if the user reloads. Use the thrown form when redirecting *is* the handler; the returned form inside a handler that also has other outcomes.

**★ When do you return `400` and when `422`?**
`400` when the request could not be understood — unparseable JSON, a body in an encoding you do not accept. `422` when it was understood and rejected on its content — a well-formed payload failing schema or business validation. The distinction tells the client what to do next: a `422` is fixable by changing one field and retrying, a `400` usually means the client's own serialisation is broken and the identical retry fails identically. Shipping only `400` collapses two very different remediation paths into one.

**★ Why does a `204` throw if you give it a body?**
Because `204`, `205` and `304` are null-body statuses in the Fetch Standard, and constructing a `Response` with a body and one of those statuses is a `TypeError`. The subtle version is `Response.json(null, { status: 204 })`, which looks empty and is not — it serialises the four characters `null`. Use `new Response(null, { status: 204 })`.

**★ How would you make a polled endpoint cheap without changing the polling interval?**
Give it an `ETag` derived from something that changes only when the resource does — a version column, an `updatedAt`, a content hash — and answer `If-None-Match` with a bodyless `304`. The client keeps polling at the same rate; the payload disappears from every request that carries no change. The same `ETag` then makes optimistic concurrency available for free on the write path: require `If-Match` and return `409` on a mismatch instead of overwriting somebody's edit.

**★ What would you check first if a streaming endpoint were holding database connections open?**
Whether the `ReadableStream` implements `cancel`. When the client aborts — the tab closes, the CLI is interrupted, a proxy times out — cancellation is the only signal the handler gets, and a source that ignores it never releases its cursor or its connection. It is invisible under a load test that always reads to completion, which is exactly why it reaches production.

**★ What happens if a streaming handler fails after the first chunk?**
Nothing useful, in HTTP terms. The status line and headers went out with the first chunk, so the response is already a `200` and cannot become a `500`. All you can do is close the stream, which the client sees as a truncated body. That is why a streaming endpoint needs an in-band way to say "complete" — a terminator line, a trailing checksum, a documented row count — and why every check you can perform before returning the `Response` belongs before returning it.

**How do you serve a large file from a Route Handler without buffering it, and when should you not serve it at all?**
Pass `upstream.body` — a `ReadableStream` — directly into the new `Response`, setting `Content-Type` and `Content-Disposition` yourself; calling `arrayBuffer()` first is the reason the same endpoint times out on large files. When you should not do it at all: any object large enough or hot enough that your compute sits in the path of every megabyte. Hand the client a signed URL and let the storage provider serve the bytes; keep the handler for the authorization decision that produced the URL.

**When is `NextResponse` worth using over the plain `Response`?**
When you want one of the things it adds: cookie helpers, `redirect`, `rewrite`, `next`. For a plain JSON payload, `Response.json` already sets the content type and takes the same `init`, and preferring it keeps the handler portable. Reaching for `NextResponse` should be a decision about a specific helper, not a default import.

**Your API returns `Date` objects and the frontend team keeps filing sorting bugs. What is going on?**
JSON has no date type, so every `Date` on the way out becomes an ISO string, and a client that compares those strings to `Date` objects — or sorts a mix of both — gets results that are right often enough to look correct. The fix is a stated contract rather than a coincidence: ISO 8601 strings on the wire, parsed exactly once at the client's API boundary, with the domain model holding real `Date` objects from that point on.

---

← [04 · Route Handlers](04-route-handlers-routets-for-restful-apis.md) · [Chapter 4 overview](01-explanation.md) · Next → [04c · Error responses](04c-error-responses-a-client-can-branch-on.md)
