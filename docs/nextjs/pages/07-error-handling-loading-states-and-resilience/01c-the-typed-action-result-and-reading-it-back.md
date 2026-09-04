---
title: "A discriminated union is the action contract that survives TypeScript, and the form half has three details the documented example carries and everyone drops"
sidebar_label: "01c · The typed action result"
sidebar_position: 3
description: "Shaping an action's return value as ActionResult<T>, why null beats a fake initial state, and the useActionState wiring — aria-live, aria-invalid, the pending flag and where useFormStatus actually reads from."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-10`) — its `useActionState` form
> example is quoted verbatim — the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`) for the sequential-dispatch and return-value constraints, and
> React's [`useActionState`](https://react.dev/reference/react/useActionState) and
> [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus) references.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**Deciding that expected errors are return values leaves two questions the documentation's
minimal example does not answer: what shape the value should be, and how the form reads it
back without breaking for a screen reader.** The documented action returns
`{ message: 'Failed to create post' }` and the documented form renders
`{state?.message && <p aria-live="polite">{state.message}</p>}`. Both are correct and both are
deliberately the smallest thing that demonstrates the mechanism. Scale that up and three
things bite: a bare `message` cannot express success-with-data, an error rendered in the wrong
place is an error the user has to hunt for, and `useFormStatus` does not read what people
assume it reads.


## What the return value should look like

The documented example returns `{ message: 'Failed to create post' }` — deliberately minimal,
because it is illustrating the mechanism. A real action wants a shape the UI can branch on
without string-matching, and a discriminated union is the shape that survives contact with
TypeScript:

```ts
// lib/action-result.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string }
```

```ts
// app/tasks/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { db } from '@/lib/db'

export async function createTask(
  prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const title = String(formData.get('title') ?? '').trim()

  if (title.length === 0) {
    return { ok: false, error: 'Title is required', field: 'title' }
  }
  if (title.length > 200) {
    return { ok: false, error: 'Title must be 200 characters or fewer', field: 'title' }
  }

  const task = await db.task.create({ data: { title } })
  revalidatePath('/tasks')
  return { ok: true, data: { id: task.id } }
}
```

The `field` is what lets the form put the message next to the input that caused it rather than
in a general banner at the top — the difference between an error the user can act on and one
they have to hunt for.

```tsx
// app/tasks/task-form.tsx
'use client'

import { useActionState } from 'react'
import { createTask } from './actions'

export function TaskForm() {
  const [state, formAction, pending] = useActionState(createTask, null)

  return (
    <form action={formAction}>
      <label htmlFor="title">Title</label>
      <input
        id="title"
        name="title"
        aria-invalid={state?.ok === false && state.field === 'title'}
        aria-describedby={state?.ok === false ? 'title-error' : undefined}
      />
      {state?.ok === false && (
        <p id="title-error" aria-live="polite">
          {state.error}
        </p>
      )}
      <button disabled={pending}>Create task</button>
    </form>
  )
}
```

🔴 **The initial state must be assignable to the same type the action returns.** The documented
example uses `const initialState = { message: '' }`; with a discriminated union, `null` is
usually cleaner than inventing a fake success or a fake failure, and it gives the form a
third state — *not submitted yet* — that neither `ok: true` nor `ok: false` can express.

## Gotchas

### The action returns a value but the UI never updates
**Symptom.** The action clearly ran — the row is in the database — but `state` on the client is
still the initial value.
**Cause.** The action was invoked directly (`onClick={() => createTask(formData)}`) rather than
through the `formAction` that `useActionState` returned, so the hook never saw the result.
**Fix.** Wire the form to the returned action, and use `formAction` for button-level variants.

```tsx
'use client'

import { useActionState } from 'react'
import { createTask } from './actions'

export function TaskForm() {
  const [state, formAction, pending] = useActionState(createTask, null)

  // ✅ the hook owns the invocation
  return (
    <form action={formAction}>
      <input name="title" />
      <button disabled={pending}>Create</button>
    </form>
  )
}
```

### The error message is rendered but never announced
**Symptom.** A sighted user sees the validation message immediately; a screen reader user
submits the form and hears nothing at all.
**Cause.** The message was inserted into the DOM without moving focus and without a live
region, so there is no event for assistive technology to announce.
**Fix.** Put it in a live region — the documented example does exactly this and it is the
easiest line in the file to drop.

```tsx
{state?.message && <p aria-live="polite">{state.message}</p>}
```

### Using `pending` from `useFormStatus` in the same component as the form
**Symptom.** `pending` is always `false`, and the submit button never disables.
**Cause.** `useFormStatus` reads the status of a form **above** it in the tree; called inside
the component that renders the `<form>`, there is no parent form to report on.
**Fix.** Either take `pending` from the `useActionState` tuple, as the documented example does,
or move the button into its own child component.

```tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton() {
  const { pending } = useFormStatus() // reads the <form> that renders this component
  return <button disabled={pending}>Create task</button>
}
```

## Interview questions

**★ If expected errors are returned rather than thrown, how do you make sure a screen reader
user hears them?**
Render them in a live region. The documented example puts `aria-live="polite"` on the paragraph
holding the message, because the error appears after submit without moving focus, and without
the live region nothing announces it.
**★ Why does the documented example pass `aria-live="polite"` rather than `assertive`?**
`polite` waits for the screen reader to finish what it is currently announcing; `assertive`
interrupts. A validation message is not an emergency and interrupting is hostile, so `polite`
is the right default for form feedback. Reserve `assertive` for something the user must act on
immediately, such as a session about to expire.

**★ Where does the third element of the `useActionState` tuple come from, and why does it
matter more in the App Router than it would in a client-only app?**
It is the pending flag for the in-flight action. It matters more here because Next.js
dispatches Server Actions **one at a time per client** — a user who clicks four times queues
four sequential round trips rather than four parallel ones, so an un-disabled button turns
impatience into a visible stall. The dispatch rule is covered in
[03 · Server Action error contracts](03-server-action-error-contracts-returning-typed-errors-vs.md).

**★ Why `null` rather than `{ ok: false, error: '' }` as the initial state?**
Because "not submitted yet" is a third state, and forcing it into the failure case means the
form has to distinguish an empty error string from a real one to decide whether to render
anything. `null` makes the three states — untouched, failed, succeeded — distinguishable by
narrowing rather than by convention, and TypeScript enforces the check at every use site.

**★ The action succeeded and the row is in the database, but the form still shows the old
data. What is the most likely cause?**
The action mutated data without telling the cache. A Server Action's response carries a
re-rendered payload for the current route only when the action calls `updateTag`,
`revalidatePath`, `refresh`, mutates cookies, or redirects. An action that only returns a value
leaves the current route un-rerendered, so the page still shows what it rendered before the
mutation.

**★ Is it safe to return an entity straight from the ORM if the page is behind authentication?**
No. Authentication controls *who* reaches the action, not *what* the response body contains,
and the whole return value is serialized to the client where anyone can read it in the network
tab. The guidance is to shape returns *"to what the UI renders, not raw database records"* —
project the fields you need and return those.
---

← [01b · Expected errors are return values](01b-expected-errors-are-return-values.md) · **Next → [01d · Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md)**
