---
title: "The framework hooks cover the entire mutation round trip and nothing outside it — an optimistic value cannot outlive its Transition, an action state cannot be read by a sibling route, and the moment a requirement crosses either boundary a real client store comes back"
sidebar_label: "06g · Where the hooks stop"
sidebar_position: 42
description: "Why an optimistic update can look like it stuck when the action's response ships no re-render, the seven requirements useOptimistic and useActionState cannot meet, and what to reach for in each case."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions)
> guide (`lastUpdated: 2026-06-17`) and [Building interactive apps](https://nextjs.org/docs/app/guides/interactive-apps)
> guide (`lastUpdated: 2026-08-25`), and the React reference —
> [`useOptimistic`](https://react.dev/reference/react/useOptimistic) and
> [`useActionState`](https://react.dev/reference/react/useActionState).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · **`@tanstack/react-query` 5.102.8** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**`useOptimistic` and `useActionState` are scoped to one mutation round trip, in one component. That is not a limitation to work around; it is what makes them cheap. But it means two hard edges. The first is temporal: an optimistic value exists only while its Transition is pending, so if the action's response carries no re-render, the projection expires onto stale data and the user watches their change undo itself — which is exactly what `revalidateTag` under a stale-while-revalidate profile does. The second is spatial: the state belongs to the component, so nothing else can read it. Seven common requirements cross one of those two edges, and for each of them the honest answer is a different tool.**

## 🔴 Edge 1 — the optimistic value expires onto whatever the server last sent

The sequence is worth walking through slowly, because the symptom is misleading.

1. The user clicks. `setOptimistic(next)` runs inside the Transition; the screen shows `next`.
2. The Server Action runs and mutates the database.
3. The action calls `revalidateTag('board')`. The tag is marked for a **background** refresh.
4. The action's response arrives — carrying **no** new RSC payload, because that is the documented behaviour of `revalidateTag` under a stale-while-revalidate profile.
5. The Transition ends. `useOptimistic` returns to its base `value`, which is the prop from the **previous** server render.
6. The screen shows the old value again. Nothing errored. The database is correct.

> *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag for background refresh and does **not** include a re-render in the action response. The page reflects the change on a later read."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#a-single-response-carries-data-and-ui)

Compare with what the other calls do:

> *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response, so the page reflects the change in the same roundtrip."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#choosing-a-cache-update)

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import { db } from '@/lib/db'

export async function cyclePriority(id: string) {
  await db.task.update({ where: { id }, data: { priority: nextPriority(id) } })

  // 🚩 revalidateTag('board') under SWR: no re-render in this response,
  //    so the optimistic value expires onto the previous prop.
  // ✅ updateTag: this response carries the new render, and the optimistic
  //    value converges onto fresh data in a single commit.
  updateTag('board')
}
```

The general rule: **an optimistic UI requires the action to ship a re-render.** `updateTag`, `revalidatePath` and `refresh()` all do; `revalidateTag` under a stale-while-revalidate profile deliberately does not. Which of the five to use, and why, is [10b](10b-refresh-against-the-alternatives.md); [`refresh()`](10-refresh.md) is the one that invalidates nothing and is right when the state you changed was never cached.

The diagnostic that separates this from a `useOptimistic` bug: **reload the page.** If the reload shows the new value, the mutation worked and the action's response was the problem. If the reload also shows the old value, the write failed.

## Edge 2 — the state belongs to the component

Neither hook publishes anything. `useActionState`'s state is local; `useOptimistic`'s value does not exist between Transitions. A sibling component cannot read either, a different route certainly cannot, and a reload destroys both. Seven requirements cross that line.

### 1 · Draft text that must survive navigation

A half-written comment should still be there after the user checks something on another page. `useState` dies on unmount; `useActionState` dies with it. This needs storage with a lifetime longer than the component — a client store, `sessionStorage`, or the URL if it is short enough.

### 2 · Interactive state shared across a boundary

A multi-select in a virtualised list, read by a toolbar that is not an ancestor of the rows. There is no action and no form; there is a set of ids that two subtrees both need. Context or a small store, per [04](04-client-state-tools-compared-react-context-zustand-jotai.md).

### 3 · High-frequency updates

Drag positions, a canvas, a resize handle — sixty updates a second. Transitions are the wrong granularity, and a Server Action per frame is absurd. Keep it in local state (or a store with selectors), and mutate on drop with a single action.

```tsx
'use client'

import { useState, startTransition } from 'react'
import { moveCard } from './actions'

export function DraggableCard({ id, x, y }: { id: string; x: number; y: number }) {
  const [pos, setPos] = useState({ x, y })   // 60fps: plain state

  function onDrop() {
    startTransition(() => { moveCard(id, pos) })   // once: an action
  }

  return <div style={{ left: pos.x, top: pos.y }} onPointerUp={onDrop} />
}
```

### 4 · Anything the browser must fetch on its own initiative

Polling, refetch on focus, a websocket feed. Neither hook fetches anything — they respond to a user action. This is the entire case for a client cache, argued in [05](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md).

### 5 · Work that must not be serialised

`useActionState` queues dispatches so each can receive the previous result, and Next.js dispatches Server Actions one at a time per client. Uploading eight files should not take eight round trips end to end. The reference's own advice is to stop using the hook: *"If you want to perform Actions in parallel, use `useState` and `useTransition` directly."* For genuinely concurrent reads and writes, a Route Handler plus a client cache's mutation layer is the shape.

### 6 · State that must survive a reload

An offline draft, a queued mutation, a wizard that must resume. Nothing in React persists across a reload; you need `localStorage`, IndexedDB, a persisted store, or a cache persister.

### 7 · Undo/redo, or any history of past states

`useActionState` holds one state — the last one. Its `previousState` is an argument to the reducer, not a stack you can walk. A history is a data structure you own.

## The mapping

| Requirement | Hook that covers it | If not, reach for |
|---|---|---|
| Form validation errors and a success message | `useActionState` | — |
| Submit button pending, in a reusable child | `useFormStatus` | — |
| Instant feedback on a toggle or counter | `useOptimistic` | — |
| Pending row indicator in a list | `useOptimistic` reducer with a per-item flag | — |
| Filters, sort, page, selected tab | — | The URL ([03](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md)) |
| Draft text across navigation | — | A store or `sessionStorage` |
| Selection shared by non-adjacent subtrees | — | Context or a store ([04](04-client-state-tools-compared-react-context-zustand-jotai.md)) |
| Drag, resize, canvas | — | Local state, one action on commit |
| Polling, focus refetch, sockets | — | A client cache ([05](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md)) |
| Parallel writes | — | `useState` + `useTransition`, or a mutation layer |
| Survives a reload | — | Persistence |
| Undo/redo | — | A history structure you own |

Read the middle column first. Most screens never leave it, which is the argument of this whole chapter.

## Gotchas

**★ Symptom: the optimistic value flashes and then the old value comes back, and the database is correct.** Cause: the action called `revalidateTag` under a stale-while-revalidate profile, so the response carried no re-render and the optimistic value expired onto the previous prop. Fix: use the call that ships a render.

```ts
'use server'
import { updateTag } from 'next/cache'

export async function cyclePriority(id: string) {
  await db.task.update({ where: { id }, data: { priority: next(id) } })
  updateTag('board')   // not revalidateTag: this response re-renders the route
}
```

**★ Symptom: you cannot tell whether an optimistic revert means the write failed or the response was empty.** Cause: both look identical on screen. Fix: reload the page — it is a one-second test that separates the two, because a successful write survives a reload and an empty response does not affect it.

**★ Symptom: a draft comment disappears when the user navigates away and back.** Cause: the text lived in `useState` or in `useActionState`, both of which unmount with the component. Fix: give it a lifetime that matches the requirement.

```tsx
'use client'
import { useEffect, useState } from 'react'

export function CommentDraft({ taskId }: { taskId: string }) {
  const key = `draft:${taskId}`
  const [body, setBody] = useState(() => sessionStorage.getItem(key) ?? '')
  useEffect(() => { sessionStorage.setItem(key, body) }, [key, body])
  return <textarea value={body} onChange={(e) => setBody(e.target.value)} />
}
```

**★ Symptom: dragging a card is janky and the server is being hammered.** Cause: an action (or an optimistic transition) fired per pointer move. Fix: local state during the gesture, one action on commit.

```tsx
const [pos, setPos] = useState({ x, y })              // during the drag
function onDrop() { startTransition(() => moveCard(id, pos)) }   // once
```

**★ Symptom: uploading eight files serialises into eight round trips.** Cause: eight `useActionState` dispatches, or eight Server Actions from the client — both queues are serial by design. Fix: one action that does the parallel work server-side, or a Route Handler the client can call concurrently.

```ts
'use server'
export async function uploadAll(files: File[]) {
  await Promise.all(files.map((f) => putObject(f)))
  updateTag('attachments')
}
```

**★ Symptom: a toolbar cannot read which rows a virtualised list has selected.** Cause: the selection lives in the list's `useState`, and the toolbar is not a descendant. Fix: move it to shared state — Context for a small, low-frequency set, a store with selectors when the list is large enough that re-rendering every consumer matters.

**★ Symptom: someone reaches for a client store to "hold the form's error message properly".** Cause: a habit from a store-first architecture. Fix: keep it in `useActionState`, where its lifetime already matches the form's.

```tsx
const [state, formAction, isPending] = useActionState(createTask, { errors: {}, message: null })
```

**★ Symptom: an "undo" button is built by keeping the previous state in a `useRef` next to `useActionState` and it desynchronises after two operations.** Cause: `useActionState` holds only the latest state; `previousState` is an argument to one reducer call, not a stack. Fix: own the history explicitly, in a reducer or store designed for it, rather than shadowing the hook.

## Interview questions

**★ An optimistic update "does not stick" — it shows, then reverts, and the data in the database is correct. What is your first hypothesis?**
That the Server Action's response carried no re-render. `useOptimistic` returns its base `value` the moment the Transition ends, and in an RSC app that base is a prop from the last server render. If the action called `revalidateTag` under a stale-while-revalidate profile, the docs say explicitly that no re-render ships in that response — so the prop is still the pre-mutation value, and the optimistic projection expires onto stale data. `updateTag`, `revalidatePath` and `refresh()` all include a fresh RSC payload in the action's response and do not have this problem. The one-second diagnostic is to reload: if the new value appears, the write was fine and the response was the issue.

**★ Name the two boundaries of `useOptimistic` and `useActionState`, and give one requirement that crosses each.**
Temporal and spatial. The temporal boundary is the Transition: an optimistic value exists only while an Action is pending, so anything that must persist beyond the round trip — a draft comment that should survive navigation — cannot live there. The spatial boundary is the component: neither hook publishes its state, so anything two non-adjacent subtrees both need — a selection read by a toolbar that is not an ancestor of the rows — cannot live there either. Every "we need a store" argument in an RSC app should be traceable to one of those two.

**★ Why is a Server Action the wrong thing to call on every pointer-move during a drag, and what is right?**
Two reasons, both structural. The dispatcher is serial, so a stream of moves queues up behind each other and arrives late; and every action is a network round trip that also re-renders a route, which is many orders of magnitude more work than moving a div. Keep the gesture in local state at whatever frequency the pointer produces, and fire exactly one action on drop with the final position — optionally with `useOptimistic` holding that position until the server confirms it.

**When does `useActionState`'s serial queue become a reason not to use it at all?**
When the operations are genuinely independent and the user is waiting on the total. A batch upload, a bulk tag operation across selected rows, anything where N slow requests should overlap: the queue exists so each dispatch can receive the previous result, and if you do not need that, you are paying latency for a guarantee you are not using. The reference's own advice is to use `useState` with `useTransition` for parallel Actions — or to do the parallel work inside one Server Action, which also collapses N round trips into one.

**Your team keeps adding things to a Zustand store in an App Router app. What test would you give them for whether something belongs there?**
Ask what the state's required lifetime and audience are. If it lives for one mutation and one component, it belongs in `useActionState` or `useOptimistic`. If it should survive reload, sharing and back/forward, it belongs in the URL. If the server owns it and the browser only needs it after a navigation, it belongs in a Server Component's read. What is left — mutable, client-owned, shared across components that are not in an ancestor relationship, and not worth a URL — is the store's actual job, and it is usually a much smaller set than the team assumed.

**How do you decide between `useOptimistic` and a client cache's optimistic update for the same interaction?**
By asking which layer owns the data. If the value on screen comes from a Server Component prop and the mutation is a Server Action, `useOptimistic` is the natural fit: the projection converges onto the new prop that arrives in the action's own response, with no second cache involved. If the value comes from a client cache — because it is polled, socket-fed or infinite-scrolled — the optimistic update belongs in that cache's mutation lifecycle, so that the rollback and the refetch use the same machinery as everything else in that key. Mixing them means two mechanisms racing to own the same pixel.

---

← [06f · Pending feedback](06f-pending-feedback-and-useformstatus.md) · [Chapter 8 overview](01-explanation.md) · Next → [07 · SprintDesk board filters in the URL](07-project-milestone-sprintdesk-board-filters-in-the-url.md)
