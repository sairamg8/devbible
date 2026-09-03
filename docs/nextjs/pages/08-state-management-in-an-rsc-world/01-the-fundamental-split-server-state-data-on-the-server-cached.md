---
sidebar_position: 1
title: "The fundamental split: **server state** (data on the server, cached by the framework) vs. **clien…"
sidebar_label: "The fundamental split: **server state** (data on the server, cached by the framework) vs. **clien…"
description: "The fundamental split: **server state** (data on the server, cached by the framework) vs. **client state** (ephemeral UI state)."
---

# ▲ The fundamental split: **server state** (data on the server, cached by the framework) vs. **clien…

> **Syllabus chapter:** 8. State Management in an RSC World  
> **Exact concept:** The fundamental split: **server state** (data on the server, cached by the framework) vs. **client state** (ephemeral UI state).  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
