---
title: "An optimistic UI takes one of three shapes — project the next value, render only the pending additions beside the server-rendered list, or hold a boolean — and choosing the wrong one is why rows appear twice or never clear"
sidebar_label: "06e · Optimistic patterns"
sidebar_position: 148
description: "Cycling a value optimistically, the pending-only list with useOptimistic([]) beside a server-rendered list, and the useOptimistic(false) data-pending flag published as a CSS hook."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the React reference — [`useOptimistic`](https://react.dev/reference/react/useOptimistic),
> [`useActionState`](https://react.dev/reference/react/useActionState) and
> [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus) — and the Next.js
> [Building interactive apps](https://nextjs.org/docs/app/guides/interactive-apps) and
> [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) guides
> (both `lastUpdated: 2026-08-25`). React reference text read from the react.dev source
> (`reactjs/react.dev`).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**Once the mechanism in [06d](06d-useoptimistic.md) is clear, the practical question is which of three shapes a given screen needs, and the three are not interchangeable. Project the next value when the UI shows one thing that changes — a priority dot, a like count. Render a *pending-only* list beside the server-rendered one when items are being added, so the server keeps ownership of every row that actually exists. Hold a boolean when the only thing that must change is "this row is on its way out". Pick the first shape for an addition and the new row appears twice; pick the second and forget to make the action ship a re-render, and the row vanishes instead of settling.**

## Pattern A — project the next value

The Next.js guide's worked example is a priority dot that cycles through low, medium and high:

```tsx filename="features/task/components/task-card.tsx"
'use client'

import { useOptimistic, useTransition } from 'react'
import { cyclePriority } from '@/features/task/task-actions'
import { PRIORITY_CYCLE } from '@/lib/data'

export function TaskCard({ id, priority }) {
  const [optimisticPriority, setOptimisticPriority] = useOptimistic(priority)
  const [, startTransition] = useTransition()

  function handlePriority() {
    startTransition(async () => {
      setOptimisticPriority(PRIORITY_CYCLE[optimisticPriority])
      await cyclePriority(id)
    })
  }

  return (
    <button onClick={handlePriority} className={priorityDot[optimisticPriority]}>
      {optimisticPriority}
    </button>
  )
}
```

> *"The `setOptimisticPriority` call updates the UI on the current frame with the next value in the cycle. Reading from `optimisticPriority` instead of the prop means rapid double-clicks cycle correctly rather than reading a stale closure value."*
> — [Building interactive apps · Step 2](https://nextjs.org/docs/app/guides/interactive-apps)

Two details that are easy to skip. The base is a **prop** — `priority` comes from a Server Component — so *"when the transition ends and fresh data arrives, the optimistic value reverts to the new server-rendered prop"*. And error handling is free here: *"If the Server Function inside `useTransition` throws, the error is forwarded to the nearest error boundary without a manual `try`/`catch`."*

## Pattern B — a pending-only list beside the server-rendered one

For adding items, the guide splits the list in two: a Server Component renders the persisted rows, and a Client Component tracks *only* the pending ones with `useOptimistic([])`.

> *"Split the comment list into two parts. A server component renders the persisted comments, and a client component tracks only the **pending** comments using `useOptimistic([])` with an empty initial array. When the transition completes and a new render arrives with fresh data, the pending list resets to empty and the real comment appears in the server-rendered list."*
> — [Building interactive apps · Step 4](https://nextjs.org/docs/app/guides/interactive-apps)

```tsx filename="features/task/components/optimistic-comments.tsx"
'use client'

import { useOptimistic, useRef } from 'react'
import { addComment } from '@/features/task/task-actions'
import { CommentCard } from './comment-card'

type Pending = { id: string; body: string }

export function OptimisticComments({ taskId }: { taskId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, addPending] = useOptimistic<Pending[], string>(
    [],
    (current, body) => [...current, { id: `pending-${current.length}`, body }],
  )

  async function submit(formData: FormData) {
    const body = String(formData.get('body')).trim()
    if (!body) return
    addPending(body)
    formRef.current?.reset()
    await addComment(taskId, body)
  }

  return (
    <>
      {pending.map((c) => (
        <CommentCard key={c.id} comment={c} pending />
      ))}
      <form ref={formRef} action={submit}>
        <input name="body" placeholder="Write a comment..." />
        <button type="submit">Send</button>
      </form>
    </>
  )
}
```

Why this is better than making the whole list client-side: the persisted comments stay server-rendered, so they cost no client JavaScript, need no serialisation into props, and cannot drift from the database. The client owns only the handful of rows that do not exist yet — and when the action's response ships a re-render, the base `[]` is restored and the real row appears in the server list. The two never both show the same comment, because they hold disjoint sets.

## Pattern C — a boolean, exposed as a CSS hook

When nothing about the item changes except that it is on its way out, the optimistic state is a boolean, and the cleanest way to publish it upward is an attribute rather than lifted state:

```tsx filename="features/task/components/delete-button.tsx"
'use client'

import { useOptimistic } from 'react'
import { Trash2 } from 'lucide-react'

export function DeleteButton({
  deleteAction,
}: {
  deleteAction: () => void | Promise<void>
}) {
  const [isPending, setIsPending] = useOptimistic(false)

  return (
    <form
      action={async () => {
        setIsPending(true)
        await deleteAction()
      }}
    >
      <button
        type="submit"
        disabled={isPending}
        data-pending={isPending ? '' : undefined}
        aria-label="Delete comment"
      >
        <Trash2 className="size-3" />
      </button>
    </form>
  )
}
```

> *"The parent comment card uses Tailwind's `has-data-pending:` variant to fade itself when any descendant sets the `data-pending` attribute. The button is the only component that knows when deletion is pending, so exposing that state as a CSS attribute lets any ancestor dim itself without lifting state or threading callbacks."*
> — [Building interactive apps · Step 7](https://nextjs.org/docs/app/guides/interactive-apps)

```tsx filename="features/task/components/comment-card.tsx"
<div className="rounded-lg px-3 transition-all has-data-pending:opacity-30">
  {/* comment content */}
  {deleteAction && <DeleteButton deleteAction={deleteAction} />}
</div>
```

The parent Server Component binds the action to the row's id, which keeps the button reusable:

```tsx filename="features/task/components/comment-section.tsx"
<CommentCard
  comment={comment}
  deleteAction={
    comment.userName === 'You'
      ? deleteComment.bind(null, comment.id)
      : undefined
  }
/>
```

## Gotchas

**★ Symptom: rapid clicks on a cycling control skip values or land on the wrong one.** Cause: the next value was computed from the prop rather than from the optimistic value, so the second click read the pre-mutation state. Fix: read the optimistic value.

```tsx
setOptimisticPriority(PRIORITY_CYCLE[optimisticPriority])
```

**★ Symptom: a newly added item shows twice — once as a pending row and once as the real one.** Cause: the optimistic list was seeded from the server list rather than from `[]`, so when the fresh render arrives the item is in both. Fix: with the pending-only pattern, the base must be an empty array so the two sets stay disjoint.

```tsx
const [pending, addPending] = useOptimistic<Pending[], string>([], (current, body) => [
  ...current,
  { id: `pending-${current.length}`, body },
])
```

**★ Symptom: the pending row never clears.** Cause: the base `[]` is restored when the Transition ends, but the *real* row only appears if the server sent a new render — so if the action does not invalidate or refresh, the item silently disappears instead. Fix: make the action ship a re-render.

```ts
'use server'
import { updateTag } from 'next/cache'

export async function addComment(taskId: string, body: string) {
  await db.comment.create({ data: { taskId, body } })
  updateTag(`task-${taskId}`)
}
```

**★ Symptom: the `data-pending` CSS hook does nothing.** Cause: the attribute was set to the string `"false"` rather than removed — `data-pending={String(isPending)}` is always present, so `has-data-pending:` always matches. Fix: emit the attribute only when true.

```tsx
data-pending={isPending ? '' : undefined}
```

## Interview questions

**★ Why is the pending-only list (`useOptimistic([])`) preferable to making the whole list a Client Component?**
Because it keeps ownership of the persisted rows on the server. The Server Component renders every comment that exists, at no client-JavaScript cost and with no serialisation into props, while the client holds only the rows that do not exist yet. The two sets are disjoint, so nothing is ever rendered twice; when the action's response ships a re-render, the optimistic base returns to `[]` and the real row appears in the server list in the same commit. Making the whole list client-side means shipping the list logic to the browser and taking on the drift problem the server was avoiding for you.

**Why does the `data-pending` attribute pattern beat lifting the pending state to the parent?**
Because only the button knows when its own action is in flight, and the components that want to react to it — the card that fades, the row that dims — are its ancestors. Lifting means adding state to a parent, threading a callback down, and re-rendering the parent on every change. Emitting a DOM attribute means the ancestor reacts with CSS alone (`has-data-pending:`), no React state changes hands, and the button stays a leaf component that can be dropped into any card. The catch is that the attribute must be absent rather than `"false"` when not pending.

**Why does the priority-cycle example read `optimisticPriority` rather than the `priority` prop when computing the next value?**
Because the prop is the last value the *server* sent, and it does not change until the action's response arrives. A second click before that would compute the next value from the pre-mutation state and cycle back to where it started. Reading the optimistic value means each click advances from the value currently on screen, which is what the user perceives themselves to be acting on. The same reasoning is why an updater function — `setOptimistic(current => …)` — is usually safer than a literal.

---

← [06d · useOptimistic](06d-useoptimistic.md) · [Chapter 8 overview](01-explanation.md) · Next → [06f · Pending feedback and useFormStatus](06f-pending-feedback-and-useformstatus.md)
