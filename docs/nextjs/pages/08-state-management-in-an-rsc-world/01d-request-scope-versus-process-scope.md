---
title: "A module-scope binding is user scope in a browser and process scope on a server — which is why the store idiom that is correct in an SPA is a cross-user data disclosure in the App Router"
sidebar_label: "01d · Request vs process scope"
sidebar_position: 4
description: "The module-level store that leaks per-request data across concurrent users, why it survives development and fails under load, the same bug wearing a Zustand store's clothes, and React.cache as the request-scoped replacement — including its documented isolation inside use cache."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Data Security](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), the [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) directive reference, [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`) and [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**The most dangerous bug in this chapter is not a stale UI. It is a `let` at module scope, assigned during a render, on a server process that is handling somebody else's request at the same time. It never fires in `next dev`, because a dev server usually serves one request at a time from a freshly evaluated module graph. It fires under production concurrency, and it fires as a cross-user data disclosure. This page is that failure in both of its disguises — a hand-rolled server-side "current user" holder, and the module-scope store idiom that every Zustand and Jotai tutorial teaches — plus the request-scoped replacement and the one scoping rule about it that the documentation is explicit about and nobody reads.**

## Failure 1 — the module-scope store that leaks across users

Module scope on a Node server is **per process**, not per request. A long-running server handles concurrent requests in the same module registry, so anything you assign at module scope during one request is visible to another.

```ts filename="lib/current-user-store.ts"
// 🔴 BROKEN. This is a per-process global.
import type { User } from './types'

let currentUser: User | null = null

export function setCurrentUser(user: User) {
  currentUser = user
}

export function getCurrentUser(): User | null {
  return currentUser
}
```

```tsx filename="app/layout.tsx"
// 🔴 BROKEN. Two requests interleaving here swap users.
import { setCurrentUser } from '@/lib/current-user-store'
import { sessionFromCookies } from '@/lib/session'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  setCurrentUser(await sessionFromCookies())
  return <html><body>{children}</body></html>
}
```

It survives development because a dev server usually handles one request at a time and reloads modules constantly. It fails under load, and it fails as a **cross-user data disclosure**, which is the worst class of bug this chapter can produce.

The Next.js docs give the rule for the equivalent case in Proxy, and the reasoning carries:

> *"Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals."*

**Fix: request-scoped memoisation, not a global.** `React.cache` gives you "compute once per request, read from anywhere" without a mutable module binding — which is precisely the pattern the Data Security guide recommends:

```ts filename="data/auth.ts"
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { decryptAndValidate } from '@/lib/session'
import { User } from '@/lib/user'

// Cached per request. Nothing is assigned at module scope.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get('AUTH_TOKEN')?.value
  if (!token) return null
  const decoded = await decryptAndValidate(token)
  // A class instance: cannot cross the boundary by accident.
  return new User(decoded.id)
})
```

```tsx filename="app/board/page.tsx"
import { getCurrentUser } from '@/data/auth'

export default async function Page() {
  const user = await getCurrentUser() // same call anywhere in this request, one query
  if (!user) redirect('/login')
  return <Board viewerId={user.id} />
}
```

⚠️ One scoping rule to know before you rely on this: *"React.cache operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."* A `cache()`d helper called from inside a cached function does not see the outer request's memo — which is consistent, because a cached function must not depend on request-scoped data in the first place.

### The same bug wearing a client store's clothes

Zustand and Jotai stores created at module scope are the standard idiom in a pure-SPA build, and that idiom is unsafe here, because the module is evaluated on the server during the Client Component's server render:

```ts filename="stores/board-store.ts"
// 🔴 Module-scope store instantiated wherever this module is evaluated —
// including on the server, once per process.
import { create } from 'zustand'

export const useBoardStore = create<{ viewerId: string | null }>(() => ({ viewerId: null }))
```

**Fix: create the store per client tree, inside a provider, and never seed it with user-identifying server data.**

```tsx filename="app/board/board-store-provider.tsx"
'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { createStore, useStore } from 'zustand'

type BoardState = { selected: ReadonlySet<string>; toggle: (id: string) => void }

function createBoardStore() {
  return createStore<BoardState>((set) => ({
    selected: new Set(),
    toggle: (id) =>
      set((s) => {
        const next = new Set(s.selected)
        next.has(id) ? next.delete(id) : next.add(id)
        return { selected: next }
      }),
  }))
}

const BoardStoreContext = createContext<ReturnType<typeof createBoardStore> | null>(null)

export function BoardStoreProvider({ children }: { children: ReactNode }) {
  // useRef, not module scope: one store per mounted tree, never shared across requests.
  const storeRef = useRef<ReturnType<typeof createBoardStore>>(null)
  storeRef.current ??= createBoardStore()
  return (
    <BoardStoreContext.Provider value={storeRef.current}>{children}</BoardStoreContext.Provider>
  )
}

export function useBoardStore<T>(selector: (s: BoardState) => T): T {
  const store = useContext(BoardStoreContext)
  if (!store) throw new Error('useBoardStore must be used inside BoardStoreProvider')
  return useStore(store, selector)
}
```

Note what the store holds: `selected`, a set of ids. Not the tasks. That is failure 3, avoided by construction.

## Gotchas

**★ Symptom: users occasionally see another user's name or data, only in production, never reproducibly.** Cause: a mutable module-scope binding assigned during a request on a long-lived server process. Fix: replace the global with `React.cache`, which memoises per request.

```ts filename="data/auth.ts"
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get('AUTH_TOKEN')?.value
  return token ? decryptAndValidate(token) : null
})
```

**★ Symptom: the module-scope Zustand store "works", and then one deploy later a user reports seeing someone else's board.** Cause: the store module is evaluated on the server during the Client Component's server render, so a store initialised with request data at module scope is process-wide. Fix: construct the store in a `useRef` inside a provider, so its lifetime is a mounted tree.

```tsx
'use client'
const storeRef = useRef<ReturnType<typeof createBoardStore>>(null)
storeRef.current ??= createBoardStore()
```

**★ Symptom: a `React.cache`d helper returns a fresh value inside a `use cache` function even though it was already computed for this request.** Cause: documented isolation — *"Values stored via `React.cache` outside a `use cache` function are not visible inside it."* Fix: do not call request-scoped helpers from cached functions at all; pass the derived value in as an argument so it participates in the cache key.

```ts
async function tasksForTeam(teamId: string) {
  'use cache'
  return db.task.findMany({ where: { teamId } })
}
// caller resolves the request-scoped part
export async function listTasksForViewer() {
  const user = await getCurrentUser()
  return tasksForTeam(user.teamId)
}
```

**★ Symptom: a review flags every module-scope value in the server code, including the database client.** Cause: the rule was learned as "no globals on the server", which is wrong and expensive — it pushes people into recreating connection pools per request. Fix: the test is not *where* the binding lives but *whether it holds request data*. A connection pool, a compiled schema, a config object read from the environment: safe, shared deliberately. A user, a tenant, a locale, a correlation id: never.

```ts filename="lib/db.ts"
import 'server-only'
import { Pool } from 'pg'

// ✅ Safe at module scope: request-independent, and you WANT it shared.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// 🔴 Never at module scope:
// let currentTenant: string | null = null
```

**★ Symptom: the selection in a board store resets every time the user opens a task and comes back.** Cause: the store provider was rendered inside `page.tsx`, so a navigation unmounts and recreates it — the store's lifetime is a mounted tree, and you gave it the shortest-lived tree available. Fix: mount the provider in the `layout.tsx` that both routes share, so the store survives navigations *below* it and still dies with the session.

```tsx filename="app/board/layout.tsx"
import { BoardStoreProvider } from './board-store-provider'

// A layout is not re-mounted on navigation between its children,
// so the store outlives /board → /board/task/123 → /board.
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <BoardStoreProvider>{children}</BoardStoreProvider>
}
```

## Interview questions

**★ Why is a module-scope variable dangerous on the server but fine in a browser bundle?**
Because the lifetimes are different by orders of magnitude. In a browser the module registry belongs to one tab and one user, so module scope is effectively user scope. On a Node server the same registry is shared by every request that process handles, and requests interleave at every `await`. Assigning the current user to a module binding during a render therefore publishes it to whoever else is rendering concurrently. The equivalence that people rely on — "it is just a module" — is exactly what breaks. The safe replacement is `React.cache`, which is scoped to a request rather than a process.

**★ Why does the module-scope store bug hide in development?**
Because a dev server typically serves one request at a time from a freshly evaluated module graph, so the window in which two requests share a binding barely exists. Concurrency is what exposes it, and concurrency is a production property. This is a general lesson about the split: the bugs it produces are about *who else is running at the same time* and *what happened between two renders*, and neither is reproducible by clicking around a local dev server. They are found by reasoning about lifetime, which is why the decision procedure is worth running before the code is written.

**★ Is a module-scope database pool also unsafe? Where exactly is the line?**
It is safe, and the line is whether the binding holds anything derived from a request. A pool, a compiled query, a cached schema and a config object read from the environment are request-independent — sharing them across requests is the whole point, and recreating them per request is a real performance bug. A user, a tenant id, a locale, a feature-flag evaluation, a trace id: all request-derived, all unsafe at module scope, because two requests interleave at every `await` and the second one will read what the first one wrote. Stating the rule as "no globals" is both too strong and too weak; stating it as "no request data at module scope" is exactly right.

**★ What is the difference between `React.cache` and `use cache`, and when does the difference bite?**
`React.cache` memoises within a single render pass — call the same helper from five Server Components in one request and the work happens once, with no cross-request sharing and no persistence. `use cache` is a *framework* cache: the result is serialized into an RSC payload, keyed by the function's arguments and captured variables plus the build id, and shared across requests and potentially across instances. The difference bites at the boundary between them, because they are documented as isolated: *"React.cache operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."* That isolation is deliberate — a cached function that could read request-scoped memoised values would produce entries that silently depend on whose request warmed them.

---

← [01c · The payload is the transport](01c-the-rsc-payload-is-the-transport.md) · [Chapter 8 overview](01-explanation.md) · Next → [01e · The stale mirror and the drifting store](01e-the-stale-mirror-and-the-drifting-store.md)
