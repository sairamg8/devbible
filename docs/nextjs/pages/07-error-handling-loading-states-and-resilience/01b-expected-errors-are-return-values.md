---
title: "An expected error is data, so it travels the way data travels — as the action's return value, read back through `useActionState`"
sidebar_label: "01b · Expected errors are return values"
sidebar_position: 2
description: "Why the documentation tells you to avoid try/catch in Server Functions, the shape of a typed action result, the aria-live and pending details the documented example carries, and what throwing an expected error actually costs you."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-10`), whose Server Function and
> Server Component examples are quoted verbatim below, and React's
> [`useActionState`](https://react.dev/reference/react/useActionState) reference.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**The instruction that surprises people is that a Server Function should not use `try`/`catch`
for the failures it expects.** Coming from Express or from a Node service, throwing is the
idiom: you throw a `ValidationError`, something upstairs catches it, and it becomes a 400. In
the App Router that reflex routes an ordinary validation message through the crash path, and
the crash path is lossy by design — it replaces the subtree, discards the form the user was
filling in, and in production strips the message you wrote down to a generic one. The
alternative is not a workaround; it is the documented model. An expected error is a value the
action computed, and it comes back the same way any other value does.

## Expected errors are return values

For Server Functions the guidance is explicit and worth quoting because it inverts what most
Node developers do by reflex:

> *"For these errors, avoid using `try`/`catch` blocks and throw errors. Instead, model expected
> errors as return values."*

```ts
// app/actions.ts
'use server'

export async function createPost(prevState: any, formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')

  const res = await fetch('https://api.vercel.app/posts', {
    method: 'POST',
    body: { title, content },
  })
  const json = await res.json()

  if (!res.ok) {
    return { message: 'Failed to create post' }
  }
}
```

The client half reads that value out of `useActionState` and renders it:

```tsx
// app/ui/form.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions'

const initialState = {
  message: '',
}

export function Form() {
  const [state, formAction, pending] = useActionState(createPost, initialState)

  return (
    <form action={formAction}>
      <label htmlFor="title">Title</label>
      <input type="text" id="title" name="title" required />
      <label htmlFor="content">Content</label>
      <textarea id="content" name="content" required />
      {state?.message && <p aria-live="polite">{state.message}</p>}
      <button disabled={pending}>Create Post</button>
    </form>
  )}
```

Two details in that snippet are load-bearing and easy to drop. **`aria-live="polite"`** is in
the documented example: an error message injected into the DOM after a submit is invisible to a
screen reader without it, because nothing moved focus. And **`pending`** is the third element
of the `useActionState` tuple — the disabled button is what stops a user from firing the action
three more times while the first is in flight, which matters more here than it would elsewhere
because of how the client dispatches actions.

For a Server Component the equivalent is even plainer:

> *"When fetching data inside of a Server Component, you can use the response to conditionally
> render an error message or `redirect`."*

```tsx
// app/page.tsx
export default async function Page() {
  const res = await fetch(`https://...`)
  const data = await res.json()

  if (!res.ok) {
    return 'There was an error.'
  }

  return '...'
}
```

That is not a boundary and does not want to be one. It is an ordinary branch producing ordinary
UI, and it keeps the surrounding layout, navigation and sibling content completely untouched —
which a thrown error would not.
## What throwing an expected error actually costs

Three things, and none of them are stylistic.

- **The message disappears.** In production, an error thrown in a Server Component has its
  `message` replaced by a generic string before it reaches the client boundary — deliberately,
  so a stack trace or a connection string never ships to a browser. A validation message thrown
  instead of returned arrives at the user as *"Something went wrong"*. The detail, and the
  `digest` that ties it back to a server log, is in
  [09 · `error.js` props](09-errorjs-props-retry-and-reset.md).
- **The form state dies.** A boundary replaces the subtree it wraps. The half-filled form the
  user spent two minutes on goes with it, along with everything they typed. A returned error
  re-renders the same form, with the same values, plus a message.
- **Your alerting goes deaf.** Boundaries are where error reporting is wired. If a quarter of
  what reaches them is "user forgot to fill in a field", the signal is gone and nobody trusts
  the alert any more.

## Gotchas

### Throwing a validation error to get the boundary to show a message
**Symptom.** Submitting a form with one bad field replaces the whole page with the error UI,
and in production the message is generic rather than the one you wrote.
**Cause.** Expected errors were routed through the uncaught-exception path. The boundary is
doing exactly its job — it replaces the crashed subtree, and the framework strips Server
Component error messages in production.
**Fix.** Return the failure instead.

```ts
'use server'

export async function createTask(prevState: unknown, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()

  if (title.length === 0) {
    return { ok: false as const, error: 'Title is required' }
  }

  await db.task.create({ data: { title } })
  return { ok: true as const }
}
```
### Swallowing a database outage in a result object
**Symptom.** Users see "Something went wrong, please try again" for six hours and no alert
fires.
**Cause.** A blanket `try`/`catch` in the action converts every throw, including infrastructure
failures, into a returned message. The boundary never renders, so the reporting hook in
`error.tsx` never runs.
**Fix.** Catch only what you can classify, and let the rest go up.

```ts
'use server'

import { UniqueConstraintError } from '@/lib/db-errors'

export async function createTask(prevState: unknown, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false as const, error: 'Title is required' }

  try {
    await db.task.create({ data: { title } })
  } catch (cause) {
    if (cause instanceof UniqueConstraintError) {
      return { ok: false as const, error: 'A task with that title already exists' }
    }
    throw cause // infrastructure failure — this is boundary material
  }

  return { ok: true as const }
}
```
### Returning a database record straight out of the action
**Symptom.** A code review, or a security scan, finds password hashes or internal columns in the
network response of a form submit.
**Cause.** Action return values are serialized to the client. The Server Actions guide is blunt
about it: *"Constrain return values. Action returns are serialized to the client. Shape them to
what the UI renders, not raw database records."*
**Fix.** Project the row down to what the UI needs before returning it.

```ts
'use server'

export async function createTask(prevState: unknown, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false as const, error: 'Title is required' }

  const task = await db.task.create({ data: { title } })

  // ✅ only what the UI renders crosses the wire
  return { ok: true as const, data: { id: task.id, title: task.title } }
}
```

## Interview questions

**★ Why does the documentation tell you to avoid `try`/`catch` in Server Functions?**
Because the throw is the wrong transport for an expected failure. The guidance is to *"model
expected errors as return values"* and surface them with `useActionState`. Throwing replaces
the subtree via the boundary, discards the user's form state, and in production strips the
Server Component error message down to a generic one, so the specific thing you wanted to tell
the user is exactly what is lost.
**★ A teammate wraps every Server Action body in `try { ... } catch { return { error: 'Something
went wrong' } }`. What is wrong with it?**
It collapses both categories into one. Real bugs and infrastructure outages stop reaching the
error boundary, so nothing gets logged or alerted on, and the user gets a message that tells
them nothing actionable. The correct shape catches only the failures it can classify and
rethrows the rest.
**★ Does returning an error from a Server Component need a boundary?**
No, and that is the point. `if (!res.ok) return 'There was an error.'` is ordinary conditional
rendering: no boundary is involved, nothing is replaced, and the surrounding layout is
undisturbed. Reach for a boundary when the component cannot produce sensible UI at all.
**★ What is wrong with `return { error: '...' }` as an action's failure shape?**
Nothing, until the success case needs to return data too — then every consumer has to test for
the *absence* of `error` to decide whether it succeeded, and a typo in the property name reads
as success. A discriminated union on a literal `ok` field makes TypeScript narrow the two cases
for you and makes the impossible state — both a result and an error — unrepresentable.

**★ If an expected error is a return value, how does the user ever see a 404 or a 403?**
Through the framework's control-flow functions rather than through a return: `notFound()`,
`unauthorized()` and `forbidden()`. Those are expected errors too, but they need to change what
the framework renders, not what the component renders, so they use a throw as their transport.
That hybrid is the subject of [01d · Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md).

---
---

← [01 · The unified error model](01-the-unified-error-model-errortsx-boundaries.md) · **Next → [01c · The typed action result](01c-the-typed-action-result-and-reading-it-back.md)**
