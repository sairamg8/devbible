---
title: "A Route Handler is a file that owns every HTTP verb at one path — which is why it cannot sit beside a page, why an unexported method 405s before your code runs, and why the request body can only be read once"
sidebar_label: "02h · Route Handler mechanics"
sidebar_position: 22
description: "The route.ts convention, the supported method table and the automatic 405 and OPTIONS, NextRequest and NextResponse, why route.js and page.js collide, the library factory pattern, RouteContext typing and the params promise, and the read-once request body."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Next.js · Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) and [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Consuming request payloads*, § *Library patterns*) — all `version: 16.3.4`. Version-history rows quoted from the `route.js` reference.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**A Route Handler is deliberately the lowest-level routing primitive in the App Router: a `route.ts` file exporting one function per HTTP method, taking a Web `Request` and returning a Web `Response`. That plainness is the feature — it is the only entry point that can choose its own status code, set arbitrary headers, stream a body, and be called by something that is not your own browser. The mechanics that surprise people are all consequences of one rule: the file owns the whole path, every verb of it, which is why it cannot coexist with a page and why an unexported method is answered before your code is reached.**

## The convention, and the method table

> *"Route Handlers allow you to create custom request handlers for a given route using the Web [Request] and [Response] APIs."*

```ts
// app/api/route.ts  — handles GET /api
export async function GET(request: Request) {}
```

> *"**Good to know**: Route Handlers are only available inside the `app` directory. They are the equivalent of API Routes inside the `pages` directory meaning you **do not** need to use API Routes and Route Handlers together."*

> *"The following HTTP methods are supported: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`. If an unsupported method is called, Next.js will return a `405 Method Not Allowed` response."*

That 405 is free, and it is a trap in reverse: a client sending `PUT` to a file that only exports `POST` gets a 405 with no log line of yours, so "the endpoint is broken" investigations start in the wrong place.

`OPTIONS` is handled for you unless you take it over:

> *"If `OPTIONS` is not defined, Next.js will automatically implement `OPTIONS` and set the appropriate Response `Allow` header depending on the other methods defined in the Route Handler."*

⚠️ Automatic `OPTIONS` sets `Allow`. It does **not** make CORS work — a browser preflight wants `Access-Control-Allow-*` headers, which are yours to send ([02j](02j-handler-only-territory.md)).

## `NextRequest` and `NextResponse` are additive

> *"In addition to supporting the native [Request] and [Response] APIs, Next.js extends them with `NextRequest` and `NextResponse` to provide convenient helpers for advanced use cases."*

`NextRequest` gives you `request.nextUrl` with a parsed `searchParams` and a typed `request.cookies`; `NextResponse.json` is a convenience over `Response.json`. Neither is required — a handler written entirely against `Request` and `Response` is idiomatic and more portable, which matters if the handler might one day be lifted into a different runtime.

```ts
// app/api/search/route.ts — plain Web APIs
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? ''
  return Response.json(await searchItems(q))
}
```

```ts
// app/api/search/route.ts — the NextRequest form of the same thing
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  return Response.json(await searchItems(q))
}
```

## Route resolution: a handler owns every verb at its path

> *"You can consider a `route` the lowest level routing primitive."*
> *"They **do not** participate in layouts or client-side navigations like `page`."*
> *"There **cannot** be a `route.js` file at the same route as `page.js`."*

| Page | Route | Result |
|---|---|---|
| `app/page.js` | `app/route.js` | ✗ Conflict |
| `app/page.js` | `app/api/route.js` | ✓ Valid |
| `app/[user]/page.js` | `app/api/route.js` | ✓ Valid |

> *"Each `route.js` or `page.js` file takes over all HTTP verbs for that route."*

That last sentence is the reason for the conflict, and it is also the sharpest structural contrast with a Server Action. A page already owns more than `GET` at its path: an action rendered on that page POSTs back to the page URL ([02b](02b-what-a-server-action-compiles-into.md)). You cannot drop a `route.ts` beside it to handle the POST yourself, because ownership is per path, not per verb.

"Does not participate in layouts or client-side navigations" is the other half of the same idea. A handler produces a `Response`, not a segment — there is no `loading.tsx`, no `error.tsx`, no shared layout, and a `<Link>` to it is a full document request, not a client navigation.

The library ecosystem leans on per-path ownership:

```ts
// app/api/[...path]/route.ts
import { createHandler } from 'third-party-library'

const handler = createHandler({
  /* library-specific options */
})

export const GET = handler
// or
export { handler as POST }
```

> *"This creates a shared handler for `GET` and `POST` requests. The library customizes behavior based on the `method` and `pathname` in the request."*

An auth library, an uploads service or a tRPC-style router mounts as a catch-all segment and dispatches internally. Notice what that costs: your own `app/api/whatever/route.ts` under the same catch-all is shadowed or conflicting, so mount third-party catch-alls in their own namespace.

## Typing the context, and the promise that trips people

```ts
// app/users/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

> *"Types are generated during `next dev`, `next build` or `next typegen`."*

`RouteContext` is a **global** helper — no import — which means it does not exist until types have been generated at least once. A fresh clone whose CI runs `tsc` before `next dev` reports an unresolved name, and the fix is `next typegen`, not an import statement.

`ctx.params` has been a promise since `v15.0.0-RC`:

| Version | Change |
|---|---|
| `v15.0.0-RC` | *"`context.params` is now a promise."* |
| `v15.0.0-RC` | *"The default caching for `GET` handlers was changed from static to dynamic"* |
| `v13.2.0` | *"Route Handlers are introduced."* |

Forgetting the `await` yields a `Promise` where a string was expected — and a `Promise` inside a template literal stringifies rather than throwing, so it can reach a query as `[object Promise]` instead of failing at the boundary. The second row in that table is the caching change, covered in [02i](02i-route-handler-caching.md).

## Reading the body, exactly once

> *"Use Request instance methods like `.json()`, `.formData()`, or `.text()` to access the request body."*
> *"`GET` and `HEAD` requests don't carry a body."*
> *"You can only read the request body once. Clone the request if you need to read it again"*

```ts
// app/api/clone/route.ts
export async function POST(request: Request) {
  try {
    const clonedRequest = request.clone()

    await request.text()
    await clonedRequest.text()
    await request.text() // Throws error

    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 500 })
  }
}
```

This matters most for webhooks, where signature verification needs the exact raw bytes and your business logic wants the parsed object — see [02j](02j-handler-only-territory.md).

The documented handler skeleton pairs the read with a `try/catch`:

```ts
// app/api/route.ts
import { submit } from '@/lib/submit'

export async function POST(request: Request) {
  try {
    await submit(request)
    return new Response(null, { status: 204 })
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error'

    return new Response(message, { status: 500 })
  }
}
```

> *"Avoid exposing sensitive information in error messages sent to the client."*

That caveat is doing real work here — see [02f](02f-return-values-and-rate-limiting.md) for why echoing a driver's `Error.message` is a leak.

## Segment config still applies

A `route.ts` accepts the route segment config exports: `dynamic`, `dynamicParams`, `revalidate`, `fetchCache`, `runtime`, and `preferredRegion`. ⚠️ The `route.js` reference's own snippet annotates `export const preferredRegion = 'auto' // deprecated` — do not reach for it in new code.

## Gotchas

**★ Symptom: a client gets `405 Method Not Allowed` and your handler's logs are empty.** Cause: the verb has no export in that `route.ts`, and Next.js answers before your code runs. Fix: export the method — and if you want a friendlier error, export it and reject deliberately.

```ts
// app/api/items/route.ts
export async function GET() { return Response.json(await listItems()) }

export async function PUT() {
  return Response.json({ error: 'Use PATCH to update an item' }, { status: 405 })
}
```

**★ Symptom: adding `app/dashboard/route.ts` beside `app/dashboard/page.tsx` fails the build with a conflict.** Cause: *"Each `route.js` or `page.js` file takes over all HTTP verbs for that route"*, so the two cannot share a path. Fix: give the handler its own path.

```
app/dashboard/page.tsx         → GET /dashboard (the UI, plus any action POSTs)
app/api/dashboard/route.ts     → any verb on /api/dashboard
```

**★ Symptom: `await request.json()` throws on the second call in the same handler.** Cause: a request body is a stream and is consumed once. Fix: read once into a variable and derive both forms from it, or `clone()` before the first read.

```ts
export async function POST(request: Request) {
  const raw = await request.text()                                  // read once
  await verifySignature(raw, request.headers.get('x-signature'))    // needs the bytes
  const body = JSON.parse(raw)                                      // needs the object
  return Response.json({ ok: true, id: body.id })
}
```

**★ Symptom: `ctx.params.id` is `undefined`, or a query contains `[object Promise]`.** Cause: `context.params` became a promise in `v15.0.0-RC`. Fix: destructure with `await`.

```ts
export async function GET(_req: Request, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params      // not ctx.params.id
  return Response.json(await getUser(id))
}
```

**Symptom: `RouteContext` is an unresolved type name in CI but fine locally.** Cause: it is a globally generated type produced by `next dev`, `next build` or `next typegen`, and locally you have already run `next dev`. Fix: run `next typegen` before the type-check step in the pipeline.

**Symptom: a third-party catch-all at `app/api/[...path]/route.ts` swallows your own `/api/health`.** Cause: per-path ownership plus a catch-all segment. Fix: namespace the library's mount point, for example `app/api/auth/[...nextauth]/route.ts`, and keep your own routes outside it.

**Symptom: a `<Link>` to a Route Handler reloads the whole document.** Cause: handlers *"do not participate in layouts or client-side navigations like `page`"* — there is no RSC payload for the router to commit. Fix: this is correct; if you wanted a client navigation, the target should be a page, and if you wanted a download, an anchor with `download` is the right element.

**Symptom: a handler throws and the browser shows a database constraint name.** Cause: the `catch` echoed `reason.message`. Fix: classify errors, return your own messages for expected failures, and log the rest — see [02f](02f-return-values-and-rate-limiting.md).

## Interview questions

**★ Why is a Route Handler forbidden at the same path as a page, when they handle different verbs?**
Because ownership in the App Router is per path, not per verb: *"Each `route.js` or `page.js` file takes over all HTTP verbs for that route."* A `page.js` is already answering more than `GET` at its path — a Server Action rendered on that page POSTs back to the page URL — so allowing a `route.js` beside it would create two files claiming the same method on the same route with no defined precedence. The practical consequence is that "add an API route beside my page" is not a thing you can do; the handler needs its own path, conventionally under `/api`.

**★ What is the read-once request body, and when does it bite hardest?**
A `Request` body is a stream, so `.json()`, `.text()` and `.formData()` each consume it and a second read throws — *"You can only read the request body once. Clone the request if you need to read it again."* It bites hardest on webhooks, where signature verification needs the exact raw bytes while your business logic wants the parsed object. Parse first and the raw form is gone; verify against a re-serialised object and the signature fails, because key order and whitespace differ from what the sender signed. The reliable pattern is one `await request.text()`, verify against that string, then `JSON.parse` it.

**★ Why does `RouteContext` fail to resolve in a fresh CI checkout, and what else changed in the same release?**
`RouteContext` is a globally available *generated* type, not an import, and the docs note that *"types are generated during `next dev`, `next build` or `next typegen`."* A pipeline whose first step is `tsc` runs before anything has generated it. The fix is `next typegen` ahead of the type-check. The same version history row set records the other v15 surprise in this file: *"`context.params` is now a promise"*, so every dynamic-segment handler needs an `await` — and because a promise stringifies rather than throwing, forgetting it can survive all the way into a database query.

**When would you reach for `NextRequest`/`NextResponse` rather than the Web APIs?**
When you want the conveniences: `request.nextUrl` gives a parsed URL with `searchParams` without constructing one, `request.cookies` gives a typed accessor, and `NextResponse.json` and `NextResponse.next` cover the shapes the framework itself uses — `NextResponse.next({ request: { headers } })` in a proxy has no plain-Web equivalent. They are additive, framed by the docs as extensions *"for advanced use cases"*. For a handler that is purely request-in, response-out, plain `Request` and `Response` keep it portable and make it testable with nothing but `fetch` semantics.

**What does it mean that Route Handlers "do not participate in layouts or client-side navigations", and what do you lose?**
A handler produces a `Response`, not a route segment, so nothing in the segment machinery applies to it: no shared layout, no `loading.tsx` boundary, no `error.tsx`, no RSC payload for the client router to commit. Navigating to one is a document request. You lose all the streaming-UI ergonomics, and you gain the ability to return any content type, any status code and any header set — which is the trade the handler exists to make. If you find yourself wanting an error boundary around a handler, the work probably belonged in a page or an action.

**Why does mounting a third-party catch-all handler need care?**
Because a `route.ts` under `app/api/[...path]/` claims every path beneath it, and per-path ownership means your own `app/api/health/route.ts` is either shadowed or a conflict depending on specificity. Libraries use the factory pattern — `export const GET = handler` and `export { handler as POST }` — precisely because they dispatch internally on method and pathname, so the catch-all is doing routing the framework would otherwise do. Give it a dedicated namespace such as `app/api/auth/[...nextauth]/` and keep hand-written routes outside it.

---

← [02g · Dispatch and the response](02g-sequential-dispatch-and-the-single-response.md) · Next → [02i · Route Handler caching](02i-route-handler-caching.md)
