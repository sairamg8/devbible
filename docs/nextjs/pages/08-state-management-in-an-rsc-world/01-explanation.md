---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 8 overview"
---

# ▲ State Management in an RSC World

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 8 (not remapped from middleware backup)

In the App Router, most “state” is **not** React client state. Server Components fetch and render data on the server; the framework cache is the primary store for server state. Client stores (Context, Zustand, Jotai, TanStack Query) only earn their place for *ephemeral UI state*, optimistic UX, or data that must live beyond a single server render (polling, websockets, infinite scroll).

## 1. Under-The-Hood Mechanics

### The fundamental split

| Kind | Lives where | Examples | Who owns it |
| :--- | :--- | :--- | :--- |
| **Server state** | Server + framework cache | DB rows, session-backed lists, RSC-fetched props | Next/React cache, `fetch` cache, `use cache` |
| **Client state** | Browser memory | Modal open, selected tab, draft text, dnd positions | `useState`, Context, Zustand/Jotai |
| **URL state** | Address bar | Filters, sort, page, locale | `searchParams`, `nuqs`-style helpers |

RSC data flow is enough when the UI is a pure function of server data and navigation. You need a client store when:

- multiple client components must share **interactive** state without prop-drilling through a server boundary  
- you need **optimistic** UI before the server confirms a mutation  
- data updates from **polling / websockets** that the framework cache is not driving  

### URL as state

```tsx
// app/board/page.tsx — Server Component reads URL
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status = 'open', q = '' } = await searchParams
  const tasks = await listTasks({ status, q }) // server state derived from URL
  return <Board tasks={tasks} status={status} q={q} />
}
```

Shareable filters belong in the URL so refresh, back/forward, and shared links work without a client store.

### Client stores: Context vs Zustand vs Jotai

- **Context** — fine for low-frequency values (theme, auth user display). High-frequency updates re-render all consumers unless you split contexts carefully.  
- **Zustand / Jotai** — better for board UI, selection sets, drag state; selectors limit re-renders.  
- **Hydration pitfall:** never create a module-level singleton store that holds *per-request* user data on the server — it can leak across users. Instantiate per-request or keep such stores client-only (`'use client'`).

### TanStack Query / RTK Query in App Router

Still useful for:

- client-driven polling / infinite scroll  
- websocket-fed caches  
- shared client cache across navigations that the RSC payload does not cover  

Redundant when every screen is a pure Server Component tree with `fetch` + revalidation tags and no client interactivity around that data.

### Framework-native mutation UX

```tsx
'use client'
import { useOptimistic, useTransition } from 'react'

export function TodoList({ todos, onToggle }: {
  todos: { id: string; done: boolean; title: string }[]
  onToggle: (id: string) => Promise<void>
}) {
  const [optimistic, setOptimistic] = useOptimistic(todos)
  const [pending, start] = useTransition()

  function toggle(id: string) {
    start(async () => {
      setOptimistic((cur) =>
        cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      )
      await onToggle(id) // Server Action
    })
  }

  return (
    <ul data-pending={pending}>
      {optimistic.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => toggle(t.id)}>
            {t.done ? '✓' : '○'} {t.title}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

`useOptimistic` + Server Actions often remove the need for a heavy client cache for simple CRUD.

## 2. Real-World Engineering Scenario

**SprintDesk board:**  
- Task list + columns → **server state** (RSC + tagged revalidation)  
- Active filters → **URL** (`?status=doing&assignee=me`)  
- Drag-and-drop order while dragging → **client state** (Zustand)  
- Checkbox toggle → **optimistic client** + Server Action + `revalidateTag('tasks')`  

Putting the entire board in Zustand duplicates the server cache and causes hydration/auth leaks if the store is global on the server. Putting drag state only on the server makes the UI feel laggy.

## 3. Production-Grade Code Example

```tsx
// stores/board-ui.ts — client-only UI store (no server imports)
'use client'
import { create } from 'zustand'

type BoardUI = {
  selectedId: string | null
  setSelected: (id: string | null) => void
  dragging: boolean
  setDragging: (v: boolean) => void
}

export const useBoardUI = create<BoardUI>((set) => ({
  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
}))
```

```tsx
// app/board/actions.ts
'use server'
import { revalidateTag } from 'next/cache'

export async function toggleTask(id: string) {
  await db.task.update({ where: { id }, data: { done: true } })
  revalidateTag('tasks')
}
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Module-level store with user data on the server

```ts
// BAD: singleton on server can retain previous request's user
export const store = create(() => ({ user: null as User | null }))
```

Keep authenticated data out of module singletons; pass from RSC props or use client-only stores.

### ⚠️ Pitfall 2: Duplicating server cache in TanStack Query “by default”

If every page is already an async Server Component with `fetch` + tags, adding Query without a client-only need doubles sources of truth and stale UI.

### ⚠️ Pitfall 3: Putting filters only in React state

Users cannot share or refresh the view. Prefer URL state for shareable filters.

### ⚠️ Pitfall 4: Passing non-serializable state through the RSC boundary

Functions, class instances, and Map/Set cannot cross Server → Client props. Client state must be created on the client; server can only pass serializable snapshots.

**Rule of thumb:** server state by default, URL for shareable UI, client store only for interaction that cannot be a Server Component or URL.
