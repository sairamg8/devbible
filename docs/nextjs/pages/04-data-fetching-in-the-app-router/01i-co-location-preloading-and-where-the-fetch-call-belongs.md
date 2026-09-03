---
title: "Lifting every fetch into an ancestor is the client-side reflex that costs you streaming — co-locate the call with the component that uses the value, centralise the loader function instead, and preload when you need work to start before the tree reaches it"
sidebar_label: "01i · co-location and preloading"
sidebar_position: 7
description: "Where the fetch call belongs in a Server Component tree: why prop drilling to avoid duplicates is a false economy, what co-location buys you for streaming, the preload pattern built on React.cache, and the unhandled-rejection trap that comes with it."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) (docs `lastUpdated` 2026-08-25), [Streaming](https://nextjs.org/docs/app/guides/streaming) (`lastUpdated` 2026-08-25) and [`cache`](https://react.dev/reference/react/cache) on react.dev.
> Target: **Next.js 16.3.4**, **React 19.2.8**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Two questions decide the shape of a Server Component tree, and they are usually answered by habit rather than argument: *which component makes the call*, and *when does the call start*. The habit comes from client-side React, where a component that fetches is a component that costs a request, so you lift the fetch and drill the result. In the App Router that habit produces slower pages, not faster ones — it converts independent, streamable sections into one blocking ancestor, in exchange for removing duplicates that were already free. This page is the argument for putting the call where the value is used, and the one technique that legitimately moves a call upward: preloading.**

## Why co-locating the fetch beats lifting it

```tsx
// The reflex — an ancestor fetches what it does not use, and every intermediate
// component carries a prop it never reads, to avoid a "duplicate" that was free.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <Shell user={user}>
      <Sidebar user={user}>{children}</Sidebar>
    </Shell>
  )
}
```

```tsx
// The design — each component that needs the user asks for it. Still one request.
export async function UserMenu() {
  const user = await getCurrentUser()
  return <Menu name={user.name} avatar={user.avatarUrl} />
}
```

Three things the second version buys, in increasing order of importance.

- **No duplicate request.** Identical `GET`s memoize within a render pass, and a `React.cache()`-wrapped query does the same for an ORM call — [01](01-fetch-in-server-components-automatic-request-deduplication.md) and [01g](01g-react-cache-connection-and-non-fetch-memoization.md). The thing the lift was buying was already free.
- **No coupling.** The lifted version requires the ancestor to know what every descendant needs. Add a field to `UserMenu` and you edit the layout, the `Shell` props, the `Sidebar` props and the menu. That is the coupling that makes a tree expensive to change, and it grows with every component you add.
- **Streaming.** This is the one that costs real milliseconds. A component that fetches its own data can sit inside its own `<Suspense>` boundary and arrive independently. One that receives a prop cannot — by the time the ancestor rendered anything at all, it had already awaited that fetch, so there was nothing to stream. See [02](02-async-components-streaming-with-suspense-granular-ui-blocks.md).

The streaming point deserves the concrete version, because it is invisible until you look at what can be prerendered:

```tsx
// 🔴 Lifted: the layout awaits, so Nav, Sidebar and children all wait with it,
// and none of them can be part of a static shell.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <div>
      <Nav />
      <Sidebar user={user} />
      {children}
    </div>
  )
}
```

```tsx
// Co-located: the layout is synchronous. Nav and children are in the shell;
// only the sidebar's own boundary streams.
import { Suspense } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Nav />
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      {children}
    </div>
  )
}
```

```tsx
// app/dashboard/sidebar.tsx — asks for its own data.
import { getCurrentUser } from '@/lib/users'

export async function Sidebar() {
  const user = await getCurrentUser()
  return <SidebarNav plan={user.plan} orgs={user.orgs} />
}
```

**The one thing worth centralising is the loader function, not the call site.** A shared `getCurrentUser()` in `lib/users.ts` gives you a single set of `fetch` options (so memoization actually fires) and a single place to change the query — without any component knowing what any other component needs.

## Preloading: the legitimate reason to move a call upward

Co-location has one real cost. If a value is needed deep in the tree and the path to it is a chain of awaits, the request does not start until the render reaches that component. Preloading fixes that without reintroducing prop drilling: start the work high, await it low.

It works because `React.cache()` stores *the result of calling the function*, and for an async function that result is the pending promise rather than the resolved value. A later call with the same arguments returns the same in-flight promise.

```ts
// lib/users.ts
import { cache } from 'react'
import { db } from '@/lib/db'

export const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }))

export const preloadUser = (id: string) => {
  // Observe the rejection here so an unawaited failure is not an unhandled rejection.
  getUser(id).catch(() => {})
}
```

```tsx
// app/orgs/[id]/page.tsx
import { getOrg } from '@/lib/orgs'
import { preloadUser } from '@/lib/users'

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  preloadUser(id)              // starts now, overlapping the org query
  const org = await getOrg(id)
  return <OrgDashboard org={org} /> // a descendant awaits getUser(id) — likely already resolved
}
```

The descendant is unchanged and still asks for what it needs:

```tsx
// app/orgs/[id]/owner-card.tsx — no props, no knowledge of the preload
import { getUser } from '@/lib/users'

export async function OwnerCard({ ownerId }: { ownerId: string }) {
  const user = await getUser(ownerId)
  return <Card name={user.name} email={user.email} />
}
```

⚠️ This is an **application** of `React.cache()`'s documented behaviour — that it stores and returns the result of the call — rather than a separately documented Next.js API in the current docs. Treat it as a consequence of the rule, not as a stability guarantee, and do not build a framework on it.

The `.catch(() => {})` is not optional. If the component that would have awaited the promise never renders — a `notFound()` above it, an error boundary swallowing the subtree, a conditional branch that skipped it — nothing observes the rejection, and an unobserved rejection surfaces on the server rather than in a component.

## Passing a promise instead of a value

There is one legitimate form of "the ancestor starts it": pass the *promise*, not the resolved value. The ancestor never awaits, so it never blocks, and the consumer resolves it inside its own boundary.

```tsx
// app/dashboard/page.tsx — Server Component. getStats() is called, not awaited.
import { Suspense } from 'react'
import { StatsChart } from './stats-chart'
import { getStats } from '@/lib/stats'

export default function Dashboard() {
  const statsPromise = getStats()
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <StatsChart dataPromise={statsPromise} />
    </Suspense>
  )
}
```

```tsx
// app/dashboard/stats-chart.tsx — a Client Component reads it with use()
'use client'

import { use } from 'react'

type Stats = { revenue: number; orders: number }

export function StatsChart({ dataPromise }: { dataPromise: Promise<Stats> }) {
  const stats = use(dataPromise)
  return <Chart revenue={stats.revenue} orders={stats.orders} />
}
```

This is the only shape that gets a server-fetched value into a Client Component without waiting for it on the server. Note what distinguishes it from prop drilling: the ancestor passes an unresolved promise, so it contributed no latency and blocked no shell. When many Client Components need the same value, provide the promise through context rather than threading it — Next.js documents that pattern for single-page-application-style trees.

## Gotchas

**★ Symptom: someone "optimised" the tree by lifting every fetch into the layout, and navigation feels slower afterwards.** Cause: an ancestor that awaits blocks everything under it, including components that could have streamed independently behind their own boundaries. The duplicate fetches it was avoiding were already deduplicated. Fix: move the fetch back down to the component that uses the value and export a shared loader so the options live in one place.

```ts
// lib/users.ts — the loader is shared; the call sites are not
import { cache } from 'react'
export const getCurrentUser = cache(async () => {
  const res = await fetch(`${API}/me`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`me: ${res.status}`)
  return res.json()
})
```

**★ Symptom: a `preload()` call causes an unhandled promise rejection and takes the server process down.** Cause: `void getUser(id)` starts work whose rejection nothing observes if the awaiting component never renders. Fix: observe the rejection at the preload site; the real `await` still receives the cached error, because `React.cache()` caches errors too.

```ts
export const preloadUser = (id: string) => {
  getUser(id).catch(() => {})
}
```

**★ Symptom: preloading was added and nothing got faster.** Cause: the preload and the deep call are not hitting the same memo entry — either `cache()` was called somewhere other than module scope, or the arguments differ (an object literal at one of the two sites, so `Object.is` never matches). Fix: one `cache()` at module scope, primitive arguments, and the preload calling the *same exported function*, not a copy of the query.

```ts
// 🔴 preload runs a second, separate query — nothing is shared
export const preloadUser = (id: string) => {
  void db.user.findUnique({ where: { id } })
}

// ✅ preload calls the memoized loader
export const preloadUser = (id: string) => {
  getUser(id).catch(() => {})
}
```

**Symptom: a component was made "reusable" by taking its data as a prop, and now the page has one big loading state instead of several small ones.** Cause: a component that accepts data cannot suspend on its own behalf; whoever fetched the data already blocked. Fix: keep the presentational component prop-driven and add a thin async wrapper that fetches and renders it, so the wrapper is what goes inside the boundary.

```tsx
// components/user-card.tsx — pure, reusable, testable
export function UserCard({ name, email }: { name: string; email: string }) {
  return <article><h3>{name}</h3><p>{email}</p></article>
}

// app/team/user-card-loader.tsx — the piece that belongs inside <Suspense>
import { getUser } from '@/lib/users'
import { UserCard } from '@/components/user-card'

export async function UserCardLoader({ id }: { id: string }) {
  const user = await getUser(id)
  return <UserCard name={user.name} email={user.email} />
}
```

**Symptom: passing a promise as a prop produces a serialization error.** Cause: the receiving component is a Client Component that awaits nothing — promises cross the boundary only when a Client Component reads them with `use()`, and only Server Components may be `async`. Fix: read it with `use()` inside the Client Component, and keep a `<Suspense>` boundary above it.

```tsx
'use client'
import { use } from 'react'

export function Posts({ posts }: { posts: Promise<Post[]> }) {
  const all = use(posts)
  return <ul>{all.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

**Symptom: preloading a value on a route where a `notFound()` may fire wastes a query on every 404.** Cause: preloading is unconditional by definition — it starts before you know whether the page will render. Fix: put the cheap existence check first and preload after it, which also gives you a real 404 status code before any boundary commits the response to `200`.

```tsx
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const exists = await checkSlugExists(slug)
  if (!exists) notFound()      // real 404, before anything streams
  preloadComments(slug)        // only now is the work worth starting
  return <PostBody slug={slug} />
}
```

## Interview questions

**★ Someone proposes lifting every fetch to the top of the route and passing values down as props "to avoid duplicate requests". What is wrong with that?**
It optimises something that is already free and pays for it twice. Free, because identical `GET`s in one render collapse to one request and a `React.cache()`-wrapped query does the same for an ORM call. The first cost is coupling: the ancestor now has to know what every descendant needs, and every intermediate component carries props it does not read. The second, and the expensive one, is streaming — a component that fetches its own data can sit inside its own `<Suspense>` boundary and arrive independently, while one that receives a prop cannot, because the ancestor already blocked on that fetch before rendering anything. Centralise the loader function, not the call site.

**★ How does `React.cache()` let you start a query early and await it deep in the tree?**
`cache` stores the result of calling the function, and for an async function that result is the pending promise. Calling the memoized loader high in the route puts the promise into the request-scoped table; a component many levels down that calls it with the same arguments receives that same promise and awaits work that has been in flight since the top of the render. Two caveats. It is an inference from `cache`'s documented behaviour rather than an independently documented Next.js API. And an unobserved rejection on a promise nobody awaits becomes an unhandled rejection on the server, so attach a `catch` at the preload site.

**★ What is the difference between passing a promise down and passing data down?**
Latency and streamability. Passing data means the ancestor awaited, so it blocked, so nothing above the consumer could be part of a static shell and nothing below could stream independently. Passing a promise means the ancestor only *started* the work; it rendered immediately, and the consumer suspends inside its own boundary when it resolves the promise with `await` on the server or `use()` on the client. Structurally they look the same in the JSX. Operationally they are opposites.

**Your presentational component takes `user` as a prop and you want it inside a `<Suspense>` boundary. What do you change?**
Nothing about the presentational component — it should stay pure and prop-driven, because that is what makes it reusable and testable. Add a thin async loader component that fetches the value and renders the presentational one, and put *that* inside the boundary. The boundary needs something that suspends, and only the loader does.

**When is preloading actually worth it?**
When the value is needed deep in a tree whose path to it is a chain of awaits, so the request would not otherwise start until the render walked down to it, and when you already know at the top of the route which key you need. If the key depends on data you have not fetched yet, there is nothing to preload. If the consumer is one level down and the parent does not await anything first, the preload buys nothing and adds a failure mode.

**Why does the preload helper need a `catch` when the real call site will handle the error anyway?**
Because the real call site might never run. A `notFound()` above it, an error boundary that replaced the subtree, or a conditional branch that took the other path all leave a rejected promise that nothing observed, and that is an unhandled rejection on the server rather than an error in a component. The `catch` at the preload site observes it there; because `React.cache()` caches errors, the genuine `await` still re-throws the same error when it happens.

**Does co-locating fetches make the code harder to reason about, since you can no longer see all the data a page needs in one file?**
It moves that knowledge from a file to a tool. You lose the single-file overview, and you gain the property that a component's data requirements are visible in the component itself rather than three files away. In practice the overview was rarely accurate anyway — a lifted fetch tends to accumulate fields nobody uses because deleting a field means auditing every descendant. Where a genuine overview is needed, the shared loader module is where it lives: one file per resource, listing exactly the queries the app makes.

---

← [01h · parallel and sequential fetching](01h-parallel-and-sequential-fetching-and-the-shape-of-a-route.md) · Next → [02 · async components and streaming](02-async-components-streaming-with-suspense-granular-ui-blocks.md)
