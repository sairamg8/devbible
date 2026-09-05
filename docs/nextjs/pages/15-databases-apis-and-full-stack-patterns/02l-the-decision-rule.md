---
title: "The choice is not ergonomic — ask who is meant to call it, and the answer picks the entry point for you, with a Server Component fetching its own Route Handler being the one combination the documentation tells you outright to stop doing"
sidebar_label: "02l · The decision rule"
sidebar_position: 210
description: "A decision table driven by the caller, the three documented data-fetching approaches and the instruction not to mix them, why fetching your own Route Handler from a Server Component fails the build, why actions are the wrong tool for reads, and when both entry points are correct."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Caveats*), [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Data fetching approaches*) and [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (§ *Sequential dispatch on the client*) — all `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Almost every argument about Route Handlers versus Server Actions is conducted in the wrong currency — which is nicer to write, which is more testable, which feels more like a real API. The question that actually decides it is: *who is meant to call this?* If the caller is a browser running the bundle you shipped, an action can serve it and brings the origin check, the body cap and the single-response re-render with it. If the caller is anything else — a webhook, a partner, a mobile app, a crawler, `curl` — a Route Handler is not preferable, it is the only entry point that exists, because an action has no URL to hand out. Everything below is that one question, applied.**

## The table

| The caller is… | Entry point | Why the other one cannot do it |
|---|---|---|
| A form or button in your own UI, mutating data | **Server Action** | A handler drops the origin check and the single-response re-render, and you rebuild both |
| Your own UI, needing read-your-own-writes after a write | **Server Action** | `updateTag` is *"Server Actions only"* ([02g](02g-sequential-dispatch-and-the-single-response.md)) |
| Your own UI, and it must work before hydration | **Server Action** in a form's `action` prop | A handler needs a `<form method="post">` and manual redirect handling |
| A third party's webhook | **Route Handler** | Action IDs are build artefacts that rotate; there is no stable URL |
| An OAuth or payment provider redirecting the user back | **Route Handler** | The request is a `GET` from a foreign origin with no dispatcher |
| A mobile app, CLI, partner integration, or `curl` | **Route Handler** | Nothing but your bundle can construct an action invocation |
| Anything needing a specific status code | **Route Handler** | An action returns a value; there is no `404`, `429` or `304` |
| A file download, CSV export, RSS feed, `llms.txt` | **Route Handler** | An action cannot set `Content-Type` or `Content-Disposition` |
| Server-sent events or any streamed body | **Route Handler** | An action returns a serialised value, not a `ReadableStream` |
| Typeahead, autocomplete, polling, anything frequent | **Route Handler** | Actions are dispatched one at a time per client; the queue is FIFO |
| Cross-origin browser traffic needing CORS | **Route Handler** | An action requires `Origin` to match `Host` by design |
| A read a Server Component needs | **Neither — call the source** | Both add an HTTP hop the render did not need |

That last row is the one people get wrong most often, and it has its own section below.

## Choose one data-fetching approach

> *"There are three main approaches we recommend for fetching data in Next.js, depending on the size and age of your project:"*
> *"* HTTP APIs: for existing large applications and organizations.
> * Data Access Layer: for new projects.
> * Component-Level Data Access: for prototypes and learning."*

> *"We recommend choosing one data fetching approach and avoiding mixing them. This makes it clear for both developers working in your code base and security auditors what to expect."*

The reason given is auditability, and it is the right reason. In a codebase where some components query the database directly, some call a DAL, and some `fetch` an internal HTTP API, "where is the authorisation check for this read?" has three possible answers and no way to know which applies without reading every call site. Pick one; the guide's recommendation for a new project is the Data Access Layer ([02m](02m-the-data-access-layer.md)).

The HTTP-API approach is not a fallback — it is the right shape when a separate team owns the backend:

> *"You should follow a **Zero Trust** model when adopting Server Components in an existing project. You can continue calling your existing API endpoints such as REST or GraphQL from Server Components using `fetch`, just as you would in Client Components."*

> *"This approach works well when: You already have security practices in place. Separate backend teams use other languages or manage APIs independently."*

The distinction that matters: calling **someone else's** API over HTTP from a Server Component is a supported architecture. Calling **your own** Route Handler is not.

## The anti-pattern the docs name explicitly

> *"Fetch data in Server Components directly from its source, not via Route Handlers."*

> *"For Server Components prerendered at build time, using Route Handlers will fail the build step. This is because, while building there is no server listening for these requests."*

> *"For Server Components rendered on demand, fetching from Route Handlers is slower due to the extra HTTP round trip between the handler and the render process."*

> *"A server side `fetch` request uses absolute URLs. This implies an HTTP round trip, to an external server. During development, your own development server acts as the external server. At build time there is no server, and at runtime, the server is available through your public facing domain."*

That last quote explains why the mistake is so easy to make and so late to surface. In development it works perfectly — `next dev` is a running server, so `fetch('http://localhost:3000/api/posts')` succeeds. At build time nothing is listening and the build fails. In production it "works" but pays a full HTTP round trip out to your public domain and back, through the CDN, for data the render process could have read directly.

```tsx
// BAD — a hop out to your own origin and back, for data you already have access to
export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts`)
  const posts = await res.json()
  return <PostList posts={posts} />
}
```

```tsx
// GOOD — call the source; the Route Handler exists for callers who are not you
import { listPosts } from '@/data/posts'

export default async function Page() {
  const posts = await listPosts()
  return <PostList posts={posts} />
}
```

The handler is still useful — it just serves the mobile app, not the render:

```ts
// app/api/posts/route.ts — the same DAL function, published for outside callers
import { listPosts } from '@/data/posts'

export async function GET() {
  return Response.json(await listPosts())
}
```

## The mirror-image anti-pattern: actions for reads

> *"[Server Actions'] primary purpose is to mutate data from your frontend client. Server Actions are queued. Using them for data fetching introduces sequential execution."*

A component that calls an action on mount to load data has put every read into a per-client FIFO queue shared with every mutation ([02g](02g-sequential-dispatch-and-the-single-response.md)). Four widgets loading in parallel become four requests in series, and a slow one blocks the button the user actually pressed.

## When client-side fetching is right

Server Components cover most reads, but not all, and the docs enumerate the exceptions:

> *"Server Components cover most data-fetching needs. However, fetching data client side might be necessary for:"*
> *"* Data that depends on client-only Web APIs: Geo-location API, Storage API, Audio API, File API
> * Frequently polled data"*

> *"For these, use community libraries like `swr` or `react-query`."*

Both categories point at a Route Handler as the server side of the pair — a `GET` handler the client library polls or calls with a value only the browser could produce. The docs' own geo example makes the method choice explicit:

> *"This example uses `POST` to avoid putting geo-location data in the URL. `GET` requests may be cached or logged, which could expose sensitive info."*

## When both entry points are correct

Sometimes the same capability genuinely has two audiences: your UI needs to archive a project, and a partner's integration needs to archive a project. That is not a design smell — it is two doors onto one room, and the correct structure is two thin entry points over one `server-only` function.

```ts
// data/projects.ts — the rule lives here, once
import 'server-only'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function archiveProject(projectId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const { count } = await db.project.updateMany({
    where: { id: projectId, ownerId: session.user.id },
    data: { archived: true },
  })
  if (count === 0) throw new Error('Forbidden')
}
```

```ts
// app/projects/actions.ts — door 1: your UI
'use server'
import { revalidateTag } from 'next/cache'
import { archiveProject } from '@/data/projects'

export async function archiveProjectAction(projectId: string) {
  await archiveProject(projectId)
  revalidateTag('projects')
}
```

```ts
// app/api/projects/[id]/archive/route.ts — door 2: everyone else
import { archiveProject } from '@/data/projects'

export async function POST(_req: Request, ctx: RouteContext<'/api/projects/[id]/archive'>) {
  const { id } = await ctx.params
  try {
    await archiveProject(id)
    return new Response(null, { status: 204 })
  } catch (reason) {
    const status = reason instanceof Error && reason.message === 'Forbidden' ? 403 : 401
    return new Response(null, { status })
  }
}
```

What each door adds is only what its transport requires: the action adds cache invalidation for the router, the handler adds status-code mapping for an HTTP client. Neither contains the rule. That is the whole architecture, and [02m](02m-the-data-access-layer.md) is about making it hold.

## Gotchas

**★ Symptom: `next build` fails on a page that works perfectly in `next dev`, with a fetch error against your own domain.** Cause: a Server Component fetching its own Route Handler. At build time *"there is no server listening for these requests"*; in development your dev server is that listener, which is why it passes locally. Fix: call the data source directly.

```tsx
// before
const posts = await (await fetch(`${process.env.SITE_URL}/api/posts`)).json()
// after
import { listPosts } from '@/data/posts'
const posts = await listPosts()
```

**★ Symptom: a page is slow in production for no visible reason and the trace shows a request from your own origin to your own origin.** Cause: the on-demand version of the same mistake — *"fetching from Route Handlers is slower due to the extra HTTP round trip between the handler and the render process."* Fix: same fix; keep the handler for external callers.

**★ Symptom: a dashboard loads its four widgets one after another.** Cause: each widget calls a Server Action to fetch, and actions are queued per client. Fix: fetch in the Server Component, or use a `GET` Route Handler with `swr` if the data genuinely must be client-side.

```tsx
// app/dashboard/page.tsx — parallel on the server, no queue involved
export default async function Dashboard() {
  const [revenue, signups, errors, latency] = await Promise.all([
    getRevenue(), getSignups(), getErrors(), getLatency(),
  ])
  return <Grid revenue={revenue} signups={signups} errors={errors} latency={latency} />
}
```

**★ Symptom: a mutation moved from an action to a `POST` handler "for a cleaner API" and a CSRF finding appears in the next pentest.** Cause: handlers inherit none of the action protections ([02d](02d-what-the-framework-gives-an-action.md)). Fix: if the caller is your own UI, it should have stayed an action; if it must be a handler, verify the origin yourself and keep the action for the UI path.

**★ Symptom: nobody on the team can answer "where is the authorisation check for this read?" without grepping.** Cause: three data-fetching approaches coexist — direct queries in components, a DAL, and internal `fetch` calls. Fix: pick one, as the docs advise, and make the others a migration backlog rather than a standing state.

**Symptom: an internal API route exists solely to be called by one page's Server Component.** Cause: REST habit — the belief that a UI must talk to an API. Fix: delete the route and import the function. A route that has exactly one caller and that caller is your own render process is pure overhead.

**Symptom: a geolocation feature puts coordinates in a query string.** Cause: reflex `GET` for a read. Fix: the docs' own guidance — *"This example uses `POST` to avoid putting geo-location data in the URL. `GET` requests may be cached or logged, which could expose sensitive info."*

**Symptom: a partner integration is blocked because "we only have Server Actions".** Cause: the mutation was built exclusively as an action and there is no URL to publish. Fix: extract the logic into a `server-only` DAL function and add a Route Handler over it, leaving the action in place for the UI — two doors, one rule.

## Interview questions

**★ What single question decides between a Route Handler and a Server Action?**
Who is meant to call it. If the caller is a browser running the bundle you shipped, an action fits and brings framework protections with it — the `Origin`/`Host` check, the 1MB cap, and a response that carries both the mutation result and a re-rendered tree. If the caller is anything else, the action is not merely a worse choice, it is impossible: an action is addressed by an encrypted build-artefact ID that rotates on deploy, it is only invocable through React's dispatcher, and the framework rejects requests whose origin does not match your host. Everything else — status codes, content types, streaming, CORS — is a consequence of the same split, because those are things an HTTP client needs and a React client does not.

**★ Why does the documentation tell you not to fetch your own Route Handler from a Server Component?**
Because it is a round trip to nowhere. The Server Component is already running on the server with access to the same data source, so routing through your own HTTP endpoint adds a serialisation, a network hop out to your public domain, a second process's worth of work and a deserialisation — the docs call it *"slower due to the extra HTTP round trip between the handler and the render process."* At build time it does not merely slow down, it fails: *"there is no server listening for these requests"*, so a prerendered page that fetches its own API breaks the build. The trap is that `next dev` *is* a listening server, so the mistake passes locally and fails in CI. The correct shape is a shared function that the Server Component imports and the Route Handler also calls, which keeps the handler available for callers who genuinely need HTTP.

**★ Is it ever right to have both an action and a Route Handler for the same operation?**
Yes, whenever the operation has two audiences — your UI and something external. That is not duplication if the entry points are thin: both call one `server-only` function that authenticates, authorises and performs the work, and each adds only what its transport requires. The action adds `revalidateTag` or `updateTag` so the router refreshes; the handler maps thrown errors onto status codes so an HTTP client can react. The failure mode to avoid is two entry points each containing their own copy of the ownership check, because one of them will be fixed during an incident and the other will not.

**★ Why are Server Actions the wrong tool for reads, even though they can obviously return data?**
Because of the client dispatcher. Actions are *"dispatched one at a time per client"*, and the BFF guide states directly that *"Server Actions are queued. Using them for data fetching introduces sequential execution."* So four widgets fetching on mount become four sequential round trips, and any slow read blocks the mutation the user just triggered. Reads belong either in the Server Component itself — where `Promise.all` gives you real parallelism — or, when they genuinely must be client-side, in a `GET` Route Handler behind `swr` or `react-query`, neither of which touches the action queue.

**★ A mobile app is being added to a product built entirely on Server Actions. What has to change?**
Every mutation the app needs has to gain a Route Handler, because there is nothing about an action a non-browser client can call: no stable URL, an ID that rotates with each deploy, and an origin check the app cannot satisfy. If the actions were written thin — delegating to a `server-only` module — this is mechanical: add `route.ts` files that call the same functions and map errors to status codes. If the actions contain the business logic and the authorisation checks inline, it is a refactor first, and the temptation will be to copy the logic into the handlers, which produces exactly the two-copies drift problem that causes the next security bug. That difference is the practical argument for a Data Access Layer before you need one.

**When is client-side data fetching the right answer in an RSC application?**
When the server cannot produce the input or the freshness requirement is too high for a render. The docs name two categories: data depending on client-only Web APIs — geolocation, storage, audio, the File API — and frequently polled data, recommending `swr` or `react-query` for both. The server half of that pair is a Route Handler, not an action, because polling through the action queue serialises it. And when the client-side value is sensitive, the docs prefer `POST` even for a read, since *"`GET` requests may be cached or logged, which could expose sensitive info."*

**Why does the documentation care so much about not mixing data-fetching approaches?**
Auditability. It names three — external HTTP APIs, a Data Access Layer, and component-level queries — mapped to large existing organisations, new projects, and prototypes respectively, and then says to pick one *"for both developers working in your code base and security auditors."* In a mixed codebase, the question "where is the authorisation check for this read?" has three possible answers and no way to know which applies without reading every call site, so reviewers stop being able to reason about the system as a whole. That is not a stylistic preference; it is the difference between an audit that can conclude something and one that can only sample.

---

← [02k · Content types and deployment](02k-content-types-and-the-deployment-envelope.md) · Next → [02m · The Data Access Layer](02m-the-data-access-layer.md)
