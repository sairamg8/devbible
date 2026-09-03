---
title: "A route.ts file has no router inside it — the named exports ARE the routing table, which is why a verb you did not export is a 405 nothing in your code produced and why the export name, not the function, is the routing decision"
sidebar_label: "04 · Route Handlers"
sidebar_position: 4
description: "The seven verb exports and what the framework does with the ones you skip, how a REST resource maps onto the App Router file tree, choosing between POST/PUT/PATCH/DELETE on safety and idempotence, and the two optional handler parameters including the params promise."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (docs `lastUpdated` 2026-04-30) and [`NextRequest`](https://nextjs.org/docs/app/api-reference/functions/next-request) (`lastUpdated` 2025-12-04). HTTP method semantics per the IETF HTTP Semantics specification.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A Route Handler is not a controller class and not an Express handler. It is a module whose *named exports* are the routing table: export `GET` and the route answers `GET`; do not export `DELETE` and the framework answers `405` on your behalf, without a single line of your code running. That inversion — routing by export name rather than by registration — is what makes the failure modes on this page peculiar to Next.js. A lowercase function name is a route that silently does not exist. A default export is dead code. A second slug name at the same dynamic position is a build error rather than a second route. And the second parameter, which used to be a plain object, has been a promise since `v15.0.0-RC`. Constructing the response is a separate job, covered on [04b](04b-constructing-the-response-status-codes-and-streaming.md); reading the request is on [04d](04d-cookies-headers-and-the-url.md); configuration and the caching model are on [04f](04f-caching-runtime-cors-and-the-public-endpoint-contract.md), which builds on [01d](01d-route-handlers-and-their-caching-model.md).**

## Seven verbs, and the module is the routing table

The supported HTTP methods are exactly `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS`. There is no eighth. A `PROPFIND` or a `LOCK` has no export it could ever reach, and neither does a verb you simply forgot.

```ts
// app/api/projects/route.ts — the collection resource
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20)
  const projects = await db.project.findMany({ take: Math.min(limit, 100) })
  return Response.json({ data: projects })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const created = await db.project.create({ data: { name: String(body.name) } })
  return Response.json(
    { data: created },
    { status: 201, headers: { Location: `/api/projects/${created.id}` } },
  )
}
```

Three framework behaviours follow from "the exports are the table", and each is something you would otherwise spend an hour looking for in middleware that does not exist:

- **A supported method with no export gets `405 Method Not Allowed` from Next.js**, not from your code. Nothing in your handler runs, so no log line of yours will explain it.
- **If you do not export `OPTIONS`, Next.js implements it** and sets the `Allow` response header from the other methods defined in that file. It does *not* set any `Access-Control-Allow-*` header — see [04f](04f-caching-runtime-cors-and-the-public-endpoint-contract.md) and [12](12-bff-proxying-webhooks-and-callback-routes.md).
- **The export name is the contract, and the value is just a function.** `export async function get()` is not a `GET` handler; it is dead code. There is no default-export form. But because only the name matters, `export const GET = withApiErrors(handler)` works perfectly — wrapping handlers costs nothing, which [04b](04b-constructing-the-response-status-codes-and-streaming.md) relies on.

⚠️ `HEAD` is listed as a separately-exported method and the documentation checked here **does not state** whether a `GET` export answers `HEAD` requests on its own. Treat it as unsettled: if something in your ecosystem issues `HEAD` — a link checker, a CDN warm-up probe, an uptime monitor — export `HEAD` explicitly rather than assuming `GET` covers it.

## A REST resource is at least two files

The App Router has no concept of "one controller per resource". A collection and a member live at different URLs, so they live in different files, and a sub-collection is a third.

```text
app/
└── api/
    └── projects/
        ├── route.ts                    GET  /api/projects        (list)
        │                               POST /api/projects        (create)
        └── [id]/
            ├── route.ts                GET    /api/projects/:id
            │                           PATCH  /api/projects/:id
            │                           PUT    /api/projects/:id
            │                           DELETE /api/projects/:id
            └── tasks/
                └── route.ts            GET  /api/projects/:id/tasks
                                        POST /api/projects/:id/tasks
```

Three structural constraints govern the layout:

- **A `route.ts` cannot sit at the same segment as a `page.tsx`.** Each claims every verb for that route, so there is no rule that could decide which answers a `GET`; [01d](01d-route-handlers-and-their-caching-model.md) covers the reasoning.
- **A dynamic segment name is fixed per position across the whole tree.** You cannot have `app/api/projects/[id]/route.ts` in one place and `app/api/projects/[projectId]/tasks/route.ts` in another — the same position cannot carry two different slug names, and it is a build error rather than a runtime surprise.
- **Route groups do not change the URL.** A parenthesised folder such as `app/api/(internal)/metrics/route.ts` serves `/api/metrics`; the group exists to organise files and to scope layouts, not to add a path segment. Reaching for one to namespace an API is the mistake — it looks like it worked in the editor and changes nothing about the route.

The `/api` prefix is a convention, not a requirement. `app/rss.xml/route.ts` serves `/rss.xml`; `app/.well-known/security.txt/route.ts` serves the well-known path. Put handlers under `/api` when they are an API and at their real URL when they are a document.

## Choosing the verb, and why it is not cosmetic

The choice of verb is a contract with every intermediary between your handler and the caller — browsers, proxies, CDNs, retry libraries and the fetch layer in a mobile app all behave differently based on it.

| Verb | Safe (no observable effect) | Idempotent (N calls == 1 call) | Body on the request |
|---|---|---|---|
| `GET` | ✅ | ✅ | ❌ none |
| `HEAD` | ✅ | ✅ | ❌ none |
| `OPTIONS` | ✅ | ✅ | ❌ in practice |
| `PUT` | ❌ | ✅ | ✅ the **complete** representation |
| `DELETE` | ❌ | ✅ | usually none |
| `PATCH` | ❌ | 🔴 **not inherently** | ✅ the change only |
| `POST` | ❌ | 🔴 **no** | ✅ anything |

Three consequences that decide real bugs:

**`PUT` replaces; `PATCH` amends.** A `PUT` handler that applies only the fields present in the body is not a `PUT` — it is a `PATCH` under the wrong name, and a client that omits a field expecting it to be cleared will find it unchanged. Conversely a `PATCH` handler that writes the whole body over the row will null out every field the client did not send.

```ts
// app/api/projects/[id]/route.ts
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const body = ProjectSchema.parse(await request.json())   // every field required
  const updated = await db.project.update({
    where: { id },
    data: { name: body.name, description: body.description, archived: body.archived },
  })
  return Response.json({ data: updated })
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const patch = ProjectSchema.partial().parse(await request.json())  // every field optional
  const updated = await db.project.update({ where: { id }, data: patch })
  return Response.json({ data: updated })
}
```

**`DELETE` is idempotent, so decide now what the second call returns.** Both `204` on every call and `404` after the first are defensible; what is not defensible is not choosing, because a client with retry-on-network-error will hit the second call routinely and will report a failure that never happened.

**`POST` is not idempotent, so the retry is your problem.** If a create can be retried — and over a mobile network it will be — accept an idempotency key and make the second attempt return the first result rather than a second row.

```ts
export async function POST(request: NextRequest) {
  const key = request.headers.get('Idempotency-Key')
  if (!key) return apiError(400, 'idempotency_key_required', 'Send an Idempotency-Key header.')

  const existing = await db.idempotentCreate.findUnique({ where: { key } })
  if (existing) {
    return Response.json({ data: existing.result }, {
      status: 200,
      headers: { Location: `/api/projects/${existing.resourceId}` },
    })
  }

  const body = await request.json()
  const created = await db.project.create({ data: { name: String(body.name) } })
  await db.idempotentCreate.create({
    data: { key, resourceId: created.id, result: created },
  })
  return Response.json({ data: created }, {
    status: 201,
    headers: { Location: `/api/projects/${created.id}` },
  })
}
```

## Both parameters are optional, and the second one is a promise

The documented signature takes a `request` and a `context`, and **both are marked optional**. A handler that needs neither takes neither:

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok' })
}
```

`request` is a `NextRequest` — an extension of the Web `Request` with `cookies` and a parsed `nextUrl`. [04d](04d-cookies-headers-and-the-url.md) covers reading from it in full.

`context` is an object with one documented property, `params`, and it is a **promise**:

```ts
// app/api/projects/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return apiError(404, 'project_not_found', 'No project with that id.')
  return Response.json({ data: project })
}
```

`RouteContext` is a globally available helper generated during `next dev`, `next build` or `next typegen`; written by hand the type is `{ params: Promise<{ id: string }> }`. The promise arrived in `v15.0.0-RC` together with a codemod — before that release `params` was a plain object, which is why so much published example code destructures it directly. [01d](01d-route-handlers-and-their-caching-model.md) has the rationale and the resolved shapes for catch-all segments.

🔴 The failure mode is asymmetric. In TypeScript, forgetting the `await` is a compile error if you typed the parameter. In JavaScript — or in TypeScript with `context: any` — `params.id` on a promise is `undefined`, your lookup misses, and the endpoint returns a perfectly formatted `404` for a row that exists.

## Gotchas

**★ Symptom: `DELETE /api/projects/1` returns `405` in production and you cannot find what is rejecting it.** Cause: nothing is rejecting it — there is no `DELETE` export in the file that serves that URL, and Next.js answers `405` for any supported verb you did not export. The three common versions are a lowercase `export async function del()`, a `default export`, and the handler sitting in `app/api/projects/route.ts` when the URL is `/api/projects/1`. Fix: the export name is the uppercase verb, in the file whose path matches the URL.

```ts
// app/api/projects/[id]/route.ts   ← the [id] segment, not the collection file
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  await db.project.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
```

**★ Symptom: a member endpoint returns `404` for ids you can see in the database.** Cause: `context.params` is a promise and you read `params.id` off it without awaiting, so `id` is `undefined` and the lookup misses. It changed in `v15.0.0-RC`; every pre-15 example destructures directly. Fix: await it, and let the generated helper write the type so the compiler catches the next one.

```ts
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params   // not: const { id } = ctx.params
  return Response.json({ data: await db.project.findUnique({ where: { id } }) })
}
```

**★ Symptom: your `PATCH` endpoint wipes fields the client never mentioned.** Cause: the handler writes the parsed body straight onto the row, so absent fields are written as `undefined` or `null` depending on the ORM. Fix: parse with a schema whose fields are all optional, and pass only the keys that were present.

```ts
const patch = ProjectSchema.partial().parse(await request.json())
const updated = await db.project.update({ where: { id }, data: patch })
```

**★ Symptom: a mobile client creates two projects from one tap.** Cause: `POST` is not idempotent and the client's retry-on-timeout fired after the first request had already committed. Fix: require an `Idempotency-Key` header and return the first result for a repeated key — the `POST` handler above.

**★ Symptom: a retrying client reports delete failures for records it successfully deleted.** Cause: the handler returns `404` on the second `DELETE`, and the client treats `404` as an error. `DELETE` is idempotent, so a repeat is expected traffic, not an anomaly. Fix: pick one behaviour per resource and document it — `204` every time is the friendlier default.

```ts
export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  await db.project.deleteMany({ where: { id } })   // no throw when nothing matched
  return new Response(null, { status: 204 })
}
```

**★ Symptom: you added `app/api/(v2)/projects/route.ts` to namespace a new API version, and it collides with the existing one.** Cause: a route group is excluded from the URL, so both files claim `/api/projects`. Fix: use a real segment — `app/api/v2/projects/route.ts` — and keep route groups for organising files and layouts.

**Symptom: a build error about two files claiming the same route.** Cause: a `route.ts` at the same segment as a `page.tsx`. Each takes over every verb for that route. Fix: nest the handler under its own segment — `app/projects/page.tsx` plus `app/api/projects/route.ts`.

**Symptom: a build error after adding `app/api/projects/[projectId]/tasks/route.ts` alongside an existing `app/api/projects/[id]/route.ts`.** Cause: the same dynamic position cannot carry two different slug names. Fix: pick one name for that segment and use it everywhere in the tree.

**Symptom: `RouteContext` is not defined in CI, though it works locally.** Cause: the types are generated by `next dev`, `next build` or `next typegen`, and a clean checkout with a cold cache has run none of them before typechecking. Fix: run `next typegen` before `tsc` in CI, or hand-write `{ params: Promise<{ id: string }> }` in code that must compile from a bare tree.

**Symptom: a `GET` handler works and a `HEAD` from an uptime monitor returns `405`.** Cause: `HEAD` is documented as a separate export and the pages verified here do not state that `GET` answers it. Fix: export `HEAD` explicitly when something in your ecosystem uses it — and keep it cheap, because a `HEAD` that runs the full `GET` query is a monitoring probe doing production work every minute.

**Symptom: a helper you exported from `route.ts` for a unit test breaks the build or serves a route.** Cause: only the seven verb names are routes, but the module is still a route module — exporting unrelated values from it is at best noise and at worst collides with a route segment config export such as `runtime` or `revalidate`. Fix: keep the handler file to handlers plus config, and put shared logic in a sibling module.

## Interview questions

**★ Which HTTP methods can a `route.ts` handle, and what happens to the rest?**
Exactly seven: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS`. Anything else has no export it could reach. For a supported verb you did not export, Next.js answers `405 Method Not Allowed` itself — your code never runs, which is why "who is returning this 405" is a question with no answer inside your handler. The corollary that matters at review time is that the export *name* is the routing decision: a lowercase function, a default export or a wrapper you forgot to name is a route that quietly does not exist.

**★ You never wrote an `OPTIONS` handler and preflight succeeds anyway. What is happening, and what is still missing?**
Next.js implements `OPTIONS` for you and sets the `Allow` header from the other methods defined in the file. That is the *method* half of preflight. It does not emit `Access-Control-Allow-Origin`, `-Methods` or `-Headers`, so a genuine cross-origin browser request is still blocked until you set those — per handler, through `proxy`, or in `next.config.js`. The trap is that the automatic `OPTIONS` makes preflight look configured when only half of it is.

**★ Both parameters of a Route Handler are documented as optional. What follows from that?**
That the handler is a plain async function and the framework passes only what the route has. A `/api/health` handler takes nothing; a collection handler takes `request` for its query string; a member handler takes both. Because nothing is required, TypeScript will not warn you about a handler that meant to read `params` and never declared the parameter — and the second parameter is the one carrying `params` as a **promise**, so the two most common member-route bugs (no `context` at all, and `context.params` unawaited) both produce `undefined` rather than an error.

**★ Why is `context.params` a promise, and what is the difference between forgetting the `await` in TypeScript and in JavaScript?**
It became a promise in `v15.0.0-RC`, part of the same move that made `cookies()`, `headers()` and `searchParams` awaitable so a render can begin before request-scoped values are known. In TypeScript, a correctly typed parameter makes the missing `await` a compile error. In JavaScript, or with `any`, reading `.id` off a promise yields `undefined`, the database lookup misses, and the endpoint returns a well-formed `404` for a record that exists — a failure that looks like a data problem and is a syntax problem.

**★ What is the difference between `PUT` and `PATCH`, and what breaks if you implement one as the other?**
`PUT` carries the complete representation and replaces the resource; `PATCH` carries only the change. Implementing `PUT` as a partial update means a client that omits a field expecting it to be cleared finds it unchanged — the client's model of the resource and the server's diverge silently. Implementing `PATCH` as a full replacement is worse: every field the client did not send is nulled, which looks like data loss and usually is. The tell in code is whether the schema you parse with has required fields (`PUT`) or optional ones (`PATCH`).

**★ Is `DELETE` idempotent, and what should the second call return?**
Idempotent means N identical calls have the same effect as one, and `DELETE` qualifies — the resource is gone after the first. What is not settled by the semantics is the *status* of the second call, and both `204` and `404` are defensible. What matters is choosing deliberately, because a client with retry-on-network-error will make that second call as a matter of routine, and a `404` there is reported to a user as a failed deletion that in fact succeeded. Returning `204` unconditionally — using a delete-many rather than a delete-or-throw — is the friendlier default.

**★ How do you make a `POST` safe to retry?**
With an idempotency key supplied by the client and stored by the server: on arrival, look the key up; if it is present, return the stored result rather than performing the create again; if it is absent, perform the create and store the key with its result in the same transaction. The key point is that idempotence for `POST` cannot come from the verb — the verb explicitly does not promise it — so it has to come from application state. The alternative, deduplicating on a natural key, only works where a natural key exists and is stable.

**Why does using a route group to version an API not work?**
Because a parenthesised folder is excluded from the URL by design — route groups organise files and scope layouts, they do not add a segment. `app/api/(v2)/projects/route.ts` and `app/api/projects/route.ts` both claim `/api/projects` and collide. Versioning needs a real segment (`app/api/v2/...`), a header-based negotiation, or a separate deployment.

**How would you lay out a REST resource with a nested sub-collection in the App Router?**
`app/api/projects/route.ts` for the collection (`GET` list, `POST` create), `app/api/projects/[id]/route.ts` for the member (`GET`, `PATCH`, `DELETE`), and `app/api/projects/[id]/tasks/route.ts` for the sub-collection. Two constraints shape it: no `route.ts` beside a `page.tsx` at the same segment, and one slug name per dynamic position across the whole tree, so `[id]` cannot become `[projectId]` deeper in.

**A colleague wants to export a shared query helper from `route.ts` so the tests can import it. What do you say?**
That the seven verb names are the only exports the router reads, so an extra export is not a route — but the file also carries route segment configuration through exports such as `runtime`, `revalidate` and `dynamic`, and a helper named to collide with one of those is a configuration change nobody will look for. Handlers and config in `route.ts`; everything else in a sibling module the tests import directly.

---

← [03c · Diagnosing stale and unexpectedly dynamic routes](03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) · [Chapter 4 overview](01-explanation.md) · Next → [04b · Constructing the response](04b-constructing-the-response-status-codes-and-streaming.md)
