---
title: "Server state and client state are not divided by which component renders the value — they are divided by who is authoritative for it and what event is allowed to destroy it"
sidebar_label: "01 · The fundamental split"
sidebar_position: 1
description: "Why the three-row server/client/URL table is an orientation and not a model: authority and lifetime as the real axes, server state as a framework-owned cache with three physical copies and three timers, and client state defined by ownership rather than by which file the value sits in."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`lastUpdated: 2026-08-25`), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`), [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`), [Data Security](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [`useState`](https://react.dev/reference/react/useState) and [`'use client'`](https://react.dev/reference/rsc/use-client).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**Every state-management argument in an App Router codebase eventually collapses into one question that nobody asks out loud: when two copies of this value disagree, which one is right? The three-row table — server state, client state, URL state — sorts values by *where they live*, and where a value lives is the least stable fact about it. A user's name lives in Postgres, in a framework cache entry, in the RSC payload, in the HTML, and in a `useState` mirror somebody added last sprint; that is five places and one authority. This page replaces the location axis with the two axes that actually decide the design — **authority** (whose copy wins) and **lifetime** (what event is allowed to destroy the value without anyone noticing) — and applies them to the two categories the table does name. The two it omits are [01b](01b-the-categories-the-table-omits.md).**
## The table everyone copies, and the axis it picks

The chapter overview opens with this, and it is a fine orientation:

| Kind | Lives where | Examples | Who owns it |
| :--- | :--- | :--- | :--- |
| **Server state** | Server + framework cache | DB rows, session-backed lists, RSC-fetched props | Next/React cache, `fetch` cache, `use cache` |
| **Client state** | Browser memory | Modal open, selected tab, draft text, drag positions | `useState`, Context, Zustand/Jotai |
| **URL state** | Address bar | Filters, sort, page, locale | `searchParams`, `nuqs`-style helpers |

It is an orientation and not a model, because the "lives where" column is false for every row the moment the app runs. Server state lives in the browser too — the RSC payload is shipped there and kept. Client state lives on the server too, because Client Components render on the server. URL state lives in three places at once. Sorting by location produces arguments that cannot be settled.

Ask instead:

1. **Authority.** If the browser's copy and the server's copy differ, which one do you fix and which one do you throw away?
2. **Lifetime.** Name the specific event that is *permitted* to destroy this value silently — a re-render, a navigation, a reload, a revalidation, a deploy, a logout, a new device.

Two answers, and the category falls out. Everything below is those two questions applied to real values.

## Server state is not "the data in your database"

Server state is **data the framework is willing to re-derive on demand**, and every stored copy of it is a cache. That is a stronger statement than "it lives on the server", and it has consequences you feel in production.

A cached value is not stored as rows or JSON. It is stored as a rendered payload:

> *"A cached function's output is serialized into an **RSC payload**, at build time or at runtime. This payload is what everything else works from."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

That one payload then exists in up to three physically different places, each with different durability:

| Copy | Where | Destroyed by |
| :--- | :--- | :--- |
| **Prerendered HTML** | disk when self-hosting, or platform durable storage behind a CDN | rebuild, ISR revalidation, `expire` |
| **Shared store** | per-instance in-memory by default; a durable cache handler with `use cache: remote` | instance teardown, tag invalidation, a new deployment |
| **Browser** | inside the RSC payload of a navigation or prefetch | the entry's `stale` window elapsing, a hard reload |

The doc is explicit that the default shared store is weaker than people assume:

> *"By default the result stays in a per-instance, in-memory store that is ephemeral on serverless. `use cache: remote` moves it to a durable cache handler shared across instances, a network roundtrip that pays off only at a **high hit rate**."*

> *"All of these stores are scoped to a single deployment. A new deploy starts fresh, new prerenders are built, and `use cache` entries don't carry over, even durable `remote` ones, because the cache key includes the build id."*

**So: server state has an authority (your database, or whatever system of record the cached function read) and every copy above is disposable.** This is why you never *set* server state from the client. You mutate the system of record in a Server Action, then tell the framework which copies are now wrong — the whole family of `updateTag`, `revalidatePath`, `revalidateTag` and [`refresh()`](10-refresh.md), compared side by side in [10b](10b-refresh-against-the-alternatives.md).

### "Cached by the framework" is three timers, not one state

`cacheLife` splits freshness into three numbers, and the difference between them is the difference between a UI that updates after a mutation and one that does not:

| Property | Documented meaning |
| :--- | :--- |
| `stale` | *"Duration the client should cache a value without checking the server."* |
| `revalidate` | *"Frequency at which the cache should refresh on the server; stale values may be served while revalidating."* |
| `expire` | *"Maximum duration for which a value can remain stale before switching to dynamic."* |

The `stale` window is the one that surprises people, because it is **client-side**. A value can be re-derived correctly on the server and the browser will still show the old payload until `stale` elapses for that entry. When someone reports "the server has the new data and the page doesn't", the question is which of these three timers they are standing in, not whether they need a client store.

## Client state is defined by lifetime and ownership, not by which component renders it

A value is **client state** when the browser is authoritative for it and **nothing on the server needs to agree**. The location test fails here in both directions:

- A Client Component renders on the server as well. Quoted directly:

  > *"The word "Client" indicates that a Client Component also runs in the browser, alongside its server render."*
  > — [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)

  So "it is in a `'use client'` file" tells you nothing about authority.

- A value held in `useState` may be a *mirror* of server state, in which case it is not client state at all — it is an unmanaged cache with no invalidation. That is the single most common state bug in App Router codebases, and it gets its own worked example in [01c](01e-the-stale-mirror-and-the-drifting-store.md).

The useful thing about genuine client state is that its **lifetime ladder** is short and explicit:

| Lifetime | Mechanism | Dies when |
| :--- | :--- | :--- |
| One render pass | a local `const`, a `useMemo` | the next render |
| Component instance | `useState`, `useReducer` | the component unmounts, or its `key` changes |
| Client subtree | a Context provider's value | the provider unmounts |
| Tab session | a module-scope store in the client bundle (Zustand, Jotai) | full page load, tab close |
| Device | `localStorage`, `IndexedDB` | the user clears it, or opens a different device |

One documented behaviour anchors the middle of that ladder, and it is why client state feels durable in App Router apps:

> *"`router.refresh()`: Refresh the current route. Making a new request to the server, re-fetching data requests, and re-rendering Server Components. The client will merge the updated React Server Component payload without losing unaffected client-side React (e.g. `useState`) or browser state (e.g. scroll position)."*
> — [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router)

A server-driven refresh does **not** reset your client state. That is the feature, and it is also the mechanism by which a stale mirror survives indefinitely.

### The mirror test

> **If you can delete the value and rebuild it exactly from (server data + URL + cookies), it is not client state. It is a cache of server state that you are now responsible for invalidating.**

Run it on real values:

- `isModalOpen` — cannot be rebuilt from the server. **Client state.**
- `selectedTaskIds` for a bulk action — cannot be rebuilt. **Client state.**
- `tasks` copied into a store on mount — rebuildable. **Not client state. It is a cache, and it will drift.**
- `currentUserName` in a Context — rebuildable from the session cookie. **Not client state.** Passing it down as a prop is free; storing it is a second authority.
- `draftText` in an unsaved form — cannot be rebuilt. **Client state**, and the interesting question is only how long it must survive.

## Gotchas

**★ Symptom: a value is called "client state" in review because it is inside a `'use client'` file.** The directive marks a *module graph boundary*, not an ownership boundary — and a Client Component runs on the server too, so the file it lives in says nothing about who is authoritative. Cause: the location axis. Fix: apply the mirror test in code by making the derivation explicit and deleting the state.

```tsx
'use client'

// 🔴 Called "client state" because it is in this file. It is a mirror.
// const [rows, setRows] = useState(initialRows)

// ✅ The prop IS the value. There is one authority and nothing to invalidate.
export function TaskTable({ rows }: { rows: TaskDTO[] }) {
  return <table>{rows.map((r) => <Row key={r.id} row={r} />)}</table>
}
```

**★ Symptom: everything worked in `next dev` and the whole app is cold after every deploy.** Cause: `use cache` entries key on the build id, so no entry survives a deployment — *"even durable `remote` ones"*. Fix: this is not a bug to fix in code, it is a capacity fact to plan for; if the first request after a deploy must not pay for the derivation, prerender it rather than caching it on demand.

```ts filename="app/board/page.tsx"
// Prerendered at build time for these teams; the shell is on disk/CDN after deploy.
export async function generateStaticParams() {
  return (await db.team.findMany({ select: { slug: true } })).map((t) => ({ team: t.slug }))
}
```

**★ Symptom: a "live" value on the page never changes even though the server data did.** The entry is inside its `stale` window in the browser, so the client is not asking the server at all. Cause: `stale` is a client-side timer and is independent of whether the server would return something new. Fix: shorten `stale` on the profile that value uses, or take the value out of the cached scope entirely.

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // A ticker: cheap to recompute, must not be held by the browser.
    ticker: { stale: 5, revalidate: 10, expire: 60 },
  },
}

export default nextConfig
```

**★ Symptom: `revalidateTag` ran in the action, and a colleague opening the page ten minutes later still sees old data.** Cause: invalidation marks, it does not push — *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using the tag revalidate as they are visited rather than all at once."* Nothing recomputes until somebody asks. Fix: if the page the actor is looking at must be correct in the same round trip, use the function that re-renders inside the action's response instead.

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'

export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  // Immediate expiration: "The next request will wait to fetch fresh data
  // rather than serving stale content from the cache."
  updateTag(`task:${id}`)
}
```

**★ Symptom: self-hosted behind two instances, and a reload alternates between fresh and stale content.** Cause: the default `use cache` store is *"a per-instance, in-memory store"*, so each process holds an independent copy and a tag invalidation handled by one instance says nothing about the other. Fix: move the entry to a shared cache handler, accepting the documented trade — a network round trip that *"pays off only at a high hit rate"*.

```ts filename="data/tasks.ts"
import 'server-only'

export async function boardSummary(teamId: string) {
  'use cache: remote' // durable, shared across instances, survives instance teardown
  return db.task.groupBy({ by: ['status'], where: { teamId }, _count: true })
}
```

## Interview questions

**★ What is the actual test for whether a value is server state or client state?**
Not where it is rendered — a Client Component renders on the server as well, so the file it lives in proves nothing. The test is authority plus lifetime. Ask which copy you would fix if two copies disagreed, and name the event allowed to destroy the value silently. If the value can be recomputed exactly from the database, the URL and the session, then the server is authoritative and any browser copy is a cache you have taken responsibility for invalidating. If the browser is authoritative and a reload can throw the value away without anyone caring, it is genuine client state.

**★ Where does derived state go?**
Nowhere. Derived values are computed at the point of use, on whichever side already has the inputs. The moment you store a derived value you have created a second authority and a synchronisation problem, and React's own guidance is explicit: *"If the value you need can be computed entirely from the current props or other state, remove that redundant state altogether."* The only reason to store a derivation is cost, and in an RSC app the cheap way to pay for an expensive derivation is a cached server function, not a client store.

**★ Is a Server Action's return value server state or client state?**
Neither, and this catches people. It is a message. It is serialized, delivered once, and has no authority and no cache entry — if you re-render the page it is gone, because nothing re-derives it. That is why it belongs in `useActionState` (a form-scoped result) and not in a store. If you find yourself persisting an action's return value so other components can read it, the value you actually wanted was the re-rendered server state that shipped alongside it in the same response.

**★ Why call server state a cache rather than a store?**
Because a store is authoritative and a cache is disposable, and everything Next.js keeps is disposable. The prerendered HTML, the shared in-memory or remote entry, and the copy sitting in the browser's RSC payload are three copies of one serialized render, and all three are scoped to a single deployment because the cache key includes the build id. Treating them as a store leads to code that tries to *write* to them; treating them as a cache leads to code that mutates the system of record and then invalidates, which is the only pattern that survives a second server instance.

**★ What happens to all your server state on a new deployment?**
It is gone. The documentation says entries do not carry over *"even durable `remote` ones, because the cache key includes the build id"*, and prerenders are rebuilt. This matters for capacity planning rather than correctness: the first request to each route after a deploy pays full cost. If that is unacceptable for a given route, prerender it at build time instead of relying on an on-demand cache.

**★ Why can a Server Component not hold state at all?**
Because its code never reaches the browser, so there is nothing to hold the state between renders and nothing to trigger an update. `useState`, `useEffect` and event handlers all require code that runs in the browser and responds to updates over time. A Server Component's "state" is its input — params, `searchParams`, cookies, headers and whatever it reads from the system of record — and the way to change what it renders is to render it again on the server.

---

← [Chapter 8 overview](01-explanation.md) · Next → [01b · The categories the table omits](01b-the-categories-the-table-omits.md)
