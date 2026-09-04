---
title: "A needless store fails silently and a missing one fails loudly, which is exactly why the needless one is the more expensive mistake"
sidebar_label: "02e · The cost of getting it wrong"
sidebar_position: 107
description: "Six costs of the store you did not need — two authorities, double-shipped data, a hydration surface, a removed guard rail, boundary creep, a lost static shell — five costs of the store you did need, and a seven-row review checklist to run on the PR."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Data Security](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`lastUpdated: 2026-08-25`), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`lastUpdated: 2026-08-25`) and the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**Both mistakes are expensive and only one of them is visible. A needless store costs you duplication, a second authority, a bigger payload, a hydration mismatch surface and — in the worst case the documentation explicitly warns about — a data leak, and none of that shows up as a failing test. A missing store costs you an architecture you cannot actually build: you reach for prop-drilling and discover a Server Component cannot pass a handler, you work around it with per-leaf fetching and get a waterfall, and you work around *that* with several Server Actions and discover they are dispatched one at a time. This page prices both directions and closes with a checklist you can run in a review.**

## Direction A — the store you did not need

**1 · Two authorities and no protocol.** The store holds a copy of server data; the server holds the original. Nothing defines what happens when they differ, so the answer is decided by whichever code path happened to run last. This is the drift failure in [01e](01e-the-stale-mirror-and-the-drifting-store.md), and its cost is not the bug — it is that every future change to either side has to reason about both.

**2 · The data ships twice, then keeps shipping.** Props to a Client Component are serialized into the RSC payload, which travels inside the HTML on first load and again in every payload that re-renders that subtree. So a list rendered as HTML *and* passed as a prop for the store to seed is in the initial document twice, and the second copy buys nothing that the first did not already provide.

**3 · A hydration surface you did not have before.** A store seeded from browser storage or from `window` produces a different render on the server than in the browser — and a Client Component renders in *both* places. That is a hydration mismatch by construction. Server-readable containers (cookies, the URL) do not have this failure mode, which is most of why they are recommended.

**4 · A leak the framework was preventing for you.** Non-serializability is a guard rail: *"Functions and classes are already blocked from being passed to Client Components by default."* The Data Access Layer example deliberately returns a class instance so a whole session object cannot be handed to a Client Component by accident. A store demands plain, serializable objects, so introducing one often means replacing a `User` instance with a spread of its fields — and a spread is how `internalNotes` and `ownerEmail` reach the payload.

```ts filename="data/user-dto.ts"
import 'server-only'

// 🔴 The shape a client store pushes you toward.
// export async function getUserForStore(id: string) {
//   const row = await db.user.findUniqueOrThrow({ where: { id } })
//   return { ...row } // serializable — and every column is now in the payload
// }

// ✅ Project explicitly. If the store needs three fields, return three fields.
export type ViewerDTO = { id: string; displayName: string; avatarUrl: string | null }

export async function getViewer(id: string): Promise<ViewerDTO> {
  const row = await db.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, displayName: true, avatarUrl: true },
  })
  return row
}
```

**5 · Bundle and boundary creep.** The store's provider is a Client Component, and everything it *renders directly* joins the client module graph. Providers migrate upward over time — one more consumer, one more route — and each move pulls more of the tree across. The endpoint is `'use client'` in the root layout, which is [01e](01e-the-stale-mirror-and-the-drifting-store.md)'s fourth failure.

**6 · You lose the thing you were paying the framework for.** A page whose data lives in a client store cannot be prerendered with that data in it, cannot appear in the static shell, and cannot benefit from a cached scope. The cost is invisible in development and shows up as a slower first paint in production.

## Direction B — the store you did need

**1 · Prop-drilling that is not merely ugly but impossible.** The reflex when two components need to share state is to lift it to their common ancestor. If that ancestor is a Server Component, the move is unavailable: *"Data crosses through props, and it must be serializable, so functions like event handlers cannot cross."* There is no setter to drill. People discover this halfway through the refactor and either lift the boundary — the right answer, [02d](02d-look-alikes-forms-boundaries-and-streaming.md) §5 — or start duplicating state in both leaves, which is the same drift bug with two authorities on the same side of the boundary.

```tsx filename="app/board/page.tsx"
// 🔴 Does not work, and the failure is at the boundary, not in the logic.
// export default async function Page() {
//   const [selected, setSelected] = useState<string[]>([]) // Server Components have no state
//   const tasks = await listTasks()
//   return tasks.map((t) => <TaskCard key={t.id} task={t} onSelect={setSelected} />)
// }

// ✅ A client ancestor owns the behaviour; server data stays above it.
import { SelectionProvider } from './selection-provider'
import { TaskCard } from './task-card'

export default async function Page() {
  const tasks = await listTasks()
  return (
    <SelectionProvider>
      {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
    </SelectionProvider>
  )
}
```

**2 · A waterfall built out of independent leaves.** Denied a shared client owner, each leaf fetches for itself after mount. Three leaves is three sequential round trips if one depends on another's result, and three parallel ones at best — all of them starting after hydration, all of them invisible to the server render that could have started them. The fix is not a store either: start the requests on the server and pass promises down.

**3 · Mutations that cannot be parallelised.** Working around missing shared state by firing several Server Actions from the client hits a documented serialisation: *"Next.js dispatches Server Actions one at a time per client"*, and *"do not rely on `Promise.all` to parallelize Server Actions from the client."* Three actions is three round trips, in order. One action doing three things is one.

**4 · A re-render granularity mismatch.** Without a client owner for a high-frequency value, the only way to make it visible is to push it into the URL or into server state, and now every drag frame is a navigation or an action. The loop's granularity — everything below the shared layout — makes this pathological quickly.

**5 · State destroyed by a navigation that should have survived it.** A half-finished form or an unsaved draft with no client owner is gone the moment the route changes. Putting it in the URL is not an option for anything long or private, and putting it on the server means writing drafts to the database on every keystroke.

## The review checklist

Run this on any PR that adds a state library, in order. The first `yes` decides.

| # | Question | If yes |
| :--- | :--- | :--- |
| 1 | Would pasting this URL into a private window need to reproduce the value? | URL state. Reject the store for this value. |
| 2 | Does it describe the viewer rather than the view, and must it be right in the first byte? | Cookie. Reject. |
| 3 | Is it only needed while a mutation is in flight? | `useOptimistic`. Reject. |
| 4 | Is it a form's result — errors, success, the created id? | `useActionState`. Reject. |
| 5 | Do the components that need it share a *client* ancestor, or could they after lifting the boundary? | `useState` or Context in that ancestor. Reject. |
| 6 | Does the DOM already hold it — scroll, focus, disclosure, an uncontrolled input? | Nothing. Reject. |
| 7 | None of the above, and the value is genuinely browser-owned, cross-subtree and request-independent? | **A store is correct.** Now choose one. |

Reaching row 7 is not a failure — it is the point of rows 1 to 6, which is to make sure the store you introduce holds only what nothing else can hold.

## Gotchas

**★ Symptom: a PR replaces `User` class instances with plain objects "so the store can hold them", and a code review three months later finds an email address in the page source.** Cause: the store's requirement for serializable values removed the guard rail that was stopping the whole record from crossing. Fix: keep the class at the data layer and define an explicit DTO for anything that crosses.

```ts filename="data/user-dto.ts"
import 'server-only'

export type ViewerDTO = { id: string; displayName: string }

export async function getViewerDTO(id: string): Promise<ViewerDTO> {
  const row = await db.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, displayName: true }, // not select-star, not a spread
  })
  return row
}
```

**★ Symptom: a page that used to be in the static shell silently stopped being prerendered after a store was added.** Cause: the data moved behind a client boundary, so there is nothing for the server to prerender — and the symptom is a slower first paint, not an error. Fix: keep data access on the server and let the store hold interaction state only.

```tsx filename="app/board/page.tsx"
export default async function Page() {
  const tasks = await listTasks() // stays on the server, stays prerenderable
  return <SelectionProvider>{tasks.map((t) => <TaskCard key={t.id} task={t} />)}</SelectionProvider>
}
```

**★ Symptom: `useState` in a Server Component — the error message names hooks, and the developer's actual goal was to share a value between two children.** Cause: the reflex to lift state hit a component that has no state. Fix: introduce a client ancestor that owns behaviour and takes `children`, so the server keeps the data and the client keeps the interaction.

```tsx filename="app/board/selection-provider.tsx"
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type Selection = { selected: ReadonlySet<string>; toggle: (id: string) => void }
const SelectionContext = createContext<Selection | null>(null)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  return <SelectionContext.Provider value={{ selected, toggle }}>{children}</SelectionContext.Provider>
}

export function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider')
  return ctx
}
```

**★ Symptom: a bulk action fires one Server Action per selected row and the UI locks up for several seconds.** Cause: actions are dispatched one at a time per client, so twenty rows is twenty sequential round trips. Fix: one action taking the whole set, parallelised server-side where the database allows it.

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'

export async function archiveMany(ids: string[]) {
  await db.$transaction(ids.map((id) => db.task.update({ where: { id }, data: { archived: true } })))
  updateTag('board')
}
```

**★ Symptom: every leaf shows its own spinner and the page settles in stages, and the network panel shows the requests starting after hydration.** Cause: each Client Component fetches for itself because there was no server-side owner for the data. Fix: start every request during the server render and pass promises down; the loading state becomes a `<Suspense>` fallback that is in the HTML.

```tsx filename="app/board/page.tsx"
import { Suspense } from 'react'

export default function Page() {
  const tasks = listTasks()      // both started here, in parallel, before hydration
  const insights = getInsights()
  return (
    <>
      <Suspense fallback={<p>Loading tasks…</p>}><TaskList tasks={tasks} /></Suspense>
      <Suspense fallback={<p>Loading insights…</p>}><Insights insights={insights} /></Suspense>
    </>
  )
}
```

**★ Symptom: a store was introduced for one value, and a year later it holds the user, the feature flags and the current board.** Cause: a store has no natural boundary — the cost of adding one more key is zero at the moment you add it. Fix: give the store a type that names exactly what it may hold, so the next addition is a deliberate edit rather than an incidental one.

```ts filename="stores/board-store-types.ts"
// The store holds interaction state only. Anything server-derived is a prop.
export type BoardInteractionState = {
  selected: ReadonlySet<string>
  dragging: string | null
  panelOpen: boolean
  toggle: (id: string) => void
}
```

**★ Symptom: a value was moved into the URL to avoid a store, and now a private note title is in the browser history and the analytics referrer.** Cause: URL state is public by construction — that is the same property that makes it shareable. Fix: keep identifiers in the URL and content out of it; if the value is private and must survive navigation, it is one of the genuine store cases from row 7.

```tsx
// 🔴 router.replace(`?draft=${encodeURIComponent(noteBody)}`)
// ✅ the id is safe; the body is not
// router.replace(`?note=${noteId}`)
```

## Interview questions

**★ Which is worse: a store you did not need, or a missing store? Argue with mechanisms, not preferences.**
The needless store is worse, because its failures are silent and its costs compound. Nothing errors when you add a second authority for a value — the drift appears weeks later as an occasional wrong number, the payload grows without a threshold to cross, the page quietly leaves the static shell, and a provider migrates one route upward per quarter until the root layout is a Client Component. A missing store, by contrast, announces itself immediately: you try to pass a setter across the boundary and it throws, or you notice three sequential round trips. Loud failures get fixed; silent architectural costs get inherited.

**★ Why does adding a store sometimes cause a data leak, when a store has nothing to do with security?**
Because stores require serializable values and the framework was using non-serializability as a guard rail. The documented default is that *"Functions and classes are already blocked from being passed to Client Components"*, and the Data Access Layer pattern leans on that deliberately — returning a class instance from `getCurrentUser` so that handing the whole object to a Client Component fails loudly. Introducing a store means converting those instances into plain objects, and the fastest conversion is a spread, which carries every column including the ones nobody renders. The leak is not caused by the store; it is caused by removing the thing that was catching the mistake.

**★ A team says they cannot avoid a store because the parent is a Server Component and they need to lift state. What do you tell them?**
That they are right about the constraint and wrong about the conclusion. A Server Component genuinely cannot hold state or pass a handler down — data crosses by serialization, so functions do not cross. But the fix is not a store, it is a client ancestor that owns behaviour and accepts `children`: the server component renders the provider, passes the server-rendered cards in as children, and the leaves read their handlers from context. The data never enters the client bundle and the interaction state has a lifetime you chose by deciding whether the provider lives in the page or the layout. A store is the answer only when the components needing the value cannot be given a common client ancestor at all.

**★ How do you price the cost of passing an array of server data into a Client Component so a store can seed itself?**
Count the copies. It is rendered once as HTML for the first paint, serialized once into the RSC payload that ships inside that same document, and serialized again into the payload of every navigation or action re-render that touches the subtree. If the Client Component renders the same rows, the markup is there too. So a list you could have passed as rendered children is now in the initial response at least twice, and the second copy exists solely to initialise a duplicate of data you already had. That is before counting the store library itself and its provider in the bundle.

**★ You are reviewing a PR that adds Zustand. What are the questions, in order?**
Whether the value should be reproducible from a pasted URL; whether it describes the viewer rather than the view; whether it is only needed while a mutation is in flight; whether it is a form result; whether the consumers share a client ancestor or could after lifting the boundary; whether the DOM already holds it. Each of those has a framework-native answer that removes the store rather than shrinking it. If all six are no, the store is correct — and the follow-up question is what it is allowed to hold, because a store with no declared scope accumulates server data by attrition.

**★ Why does "we will just fetch it on the client, it is simpler" cost more than it looks?**
Because the request cannot start until the JavaScript has downloaded, parsed, mounted the component and run the effect, and every leaf doing this independently produces a page that settles in stages. The server render had the opportunity to start all of those requests concurrently, before a byte of JavaScript was parsed, and to ship the loading states as HTML. Promises are serializable, so you can keep the streaming behaviour and the client component: start the request in the Server Component, pass the pending promise, read it with `use`, and let `<Suspense>` provide the fallback. Client-side fetching earns its place only when the request's inputs are themselves client-only.

**★ Is there a case where duplicating server state into a client store is the right call?**
Yes, and it is defined by the authority flipping. An editor that loads a saved document and then owns it until the user saves; a multi-step wizard pre-filled from a profile; an offline queue of pending mutations. In each, the server copy is the *initial condition* and the browser is authoritative from the first keystroke, so there are not two authorities — there is one, and it changed hands at a moment you can name. The test is not "did the data come from the server" but "after seeding, whose copy wins", and if the honest answer is "the server's, whenever it changes", the store is a cache you have volunteered to maintain.

---

← [02d · Look-alikes: forms, boundaries, streaming](02d-look-alikes-forms-boundaries-and-streaming.md) · [Chapter 8 overview](01-explanation.md)
