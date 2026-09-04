---
title: "An error boundary catches rendering, and almost nothing else"
sidebar_label: "10b · What boundaries do not catch"
sidebar_position: 28
description: "Event handlers, async code, the startTransition exception, why notFound() and redirect() get swallowed, and the line between expected errors and uncaught exceptions."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> and the [`unstable_rethrow` reference](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow).
> Target: **Next.js 16.3.4**, App Router.

**Most of the surprise around error boundaries comes from assuming they are a general
try/catch for the component tree. They are not — they catch errors thrown during *rendering*,
in order to show a fallback instead of crashing the app.** An error in a click handler runs
after rendering has finished and sails straight past every boundary you have placed. There is
exactly one exception worth memorising, and it goes the other way: an unhandled error inside
`startTransition` **does** reach the nearest boundary. On top of that, two things that look
like errors are not errors at all — `notFound()` and `redirect()` work by throwing, which is
why a hand-rolled catch swallows them — and a whole category of ordinary failures should never
reach a boundary in the first place.

## Event handlers and async code

Boundaries are designed to catch errors [during rendering](https://react.dev/reference/react/Component#static-getderivedstatefromerror).
Errors in event handlers or async code run *after* rendering, so they are not handled.

Catch them manually and store the result:

```tsx
'use client'

import { useState } from 'react'

export function Button() {
  const [error, setError] = useState(null)

  const handleClick = () => {
    try {
      // do some work that might fail
      throw new Error('Exception')
    } catch (reason) {
      setError(reason)
    }
  }

  if (error) {
    /* render fallback UI */
  }

  return (
    <button type="button" onClick={handleClick}>
      Click me
    </button>
  )
}
```

## The `startTransition` exception

**Unhandled errors inside `startTransition` from `useTransition` bubble up to the nearest error
boundary.** This is the one place where work triggered by an interaction is still boundary
territory, and it is easy to forget in both directions — people wrap transitions in redundant
try/catch, or assume a transition failure will be silent when it will in fact replace a chunk
of the page.

```tsx
'use client'

import { useTransition } from 'react'

export function Button() {
  const [pending, startTransition] = useTransition()

  const handleClick = () =>
    startTransition(() => {
      throw new Error('Exception')   // reaches the boundary
    })

  return (
    <button type="button" onClick={handleClick}>
      Click me
    </button>
  )
}
```

Since Server Actions are commonly invoked inside transitions, this is not an edge case — it is
the normal path for a failed mutation that was not modelled as a return value.

## `notFound()` and `redirect()` are throws

Both are implemented by throwing a framework sentinel. That has one large consequence: **any
`try/catch` between the call and the framework will swallow it**, and the user sees a generic
error instead of a 404 or a redirect.

```tsx
// BAD — the catch eats the redirect
export default async function Page() {
  try {
    const user = await getUser()
    if (!user) redirect('/login')     // throws
    return <Profile user={user} />
  } catch (e) {
    return <p>Something went wrong</p>   // ← the redirect lands here
  }
}
```

The fix in application code is `unstable_rethrow`, which lets framework interrupts through
while you keep handling your own errors:

```tsx
import { unstable_rethrow } from 'next/navigation'

try {
  const user = await getUser()
  if (!user) redirect('/login')
  return <Profile user={user} />
} catch (e) {
  unstable_rethrow(e)                 // framework interrupts pass through
  return <p>Something went wrong</p>  // only real errors reach here
}
```

`catchError` boundaries do not have this problem — not interfering with `notFound` and
`redirect` is one of the two things they were built to fix. The hazard is confined to catches
you write yourself.

## Expected errors are return values, not throws

The guide draws a line worth holding as a design rule. **Expected errors** occur during normal
operation — server-side form validation, a failed request — and should be handled explicitly
and returned to the client. **Uncaught exceptions** are bugs, and those are what boundaries are
for.

For Server Functions, the guidance is explicit: **avoid `try`/`catch` and throwing; model
expected errors as return values.**

```ts filename="app/actions.ts"
'use server'

export async function createPost(prevState: any, formData: FormData) {
  const res = await fetch('https://api.vercel.app/posts', {
    method: 'POST',
    body: { title: formData.get('title'), content: formData.get('content') },
  })

  if (!res.ok) {
    return { message: 'Failed to create post' }   // returned, not thrown
  }
}
```

```tsx filename="app/ui/form.tsx"
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions'

export function Form() {
  const [state, formAction, pending] = useActionState(createPost, { message: '' })

  return (
    <form action={formAction}>
      <input type="text" id="title" name="title" required />
      <textarea id="content" name="content" required />
      {state?.message && <p aria-live="polite">{state.message}</p>}
      <button disabled={pending}>Create Post</button>
    </form>
  )
}
```

Note `aria-live="polite"` on the message. An error that appears without a live region is
invisible to a screen reader user, who has no reason to move focus back to it.

In a Server Component, the equivalent is to branch on the response rather than throw:

```tsx
export default async function Page() {
  const res = await fetch(`https://...`)
  if (!res.ok) {
    return 'There was an error.'
  }
  return '...'
}
```

## Gotchas

### Expecting a boundary to catch a click handler

**Symptom.** An error thrown in `onClick` crashes past every boundary you have placed, or
vanishes into the console.

**Cause.** Boundaries catch errors during **rendering**. Event handlers run after rendering.

**Fix.** `try/catch` in the handler and store the error in state — unless the work is inside
`startTransition`, which *does* bubble.

### Assuming a failed Server Action inside a transition fails silently

**Symptom.** A mutation error unexpectedly replaces a section of the page with the error
fallback.

**Cause.** Server Actions are usually called inside a transition, and unhandled errors in
`startTransition` reach the nearest boundary.

**Fix.** Decide deliberately: model the failure as a **return value** with `useActionState` if
the user should stay on the page, or let it throw if it genuinely is a bug.

### A hand-rolled `try/catch` swallowing `redirect()`

**Symptom.** A redirect stops working, and the surrounding code renders its error branch
instead.

**Cause.** `redirect()` throws a framework sentinel that your catch intercepts.

**Fix.** Call `unstable_rethrow(e)` first thing in the catch block.

### The same problem with `notFound()`

**Symptom.** A missing record renders "Something went wrong" instead of the 404 UI.

**Cause.** Identical mechanism — `notFound()` throws.

**Fix.** Same: `unstable_rethrow`, or restructure so the call is not inside a catch.

### Throwing for validation failures

**Symptom.** Ordinary user mistakes — a blank required field, a duplicate email — surface as
full error screens.

**Cause.** Expected errors modelled as exceptions.

**Fix.** Return them from the Server Function and render from `useActionState`. Keep boundaries
for genuine bugs.

### Rendering an action error without a live region

**Symptom.** Sighted users see the validation message; screen reader users do not.

**Cause.** The message is inserted into the DOM with nothing announcing it, and focus has not
moved.

**Fix.** `aria-live="polite"` on the element that renders `state.message`.

### Wrapping a transition in try/catch "just in case"

**Symptom.** Errors that should have surfaced in the boundary are silently absorbed, and the UI
sits in a stale state.

**Cause.** The redundant catch defeats the one interaction path that *does* reach a boundary.

**Fix.** Let it throw, or handle it deliberately as a return value. Do not do both by accident.

## Interview questions

**★ What do error boundaries actually catch?**
Errors thrown during **rendering**, so a fallback UI can replace the crashed subtree.

**★ Do they catch errors in event handlers?**
No. Those run after rendering. Catch manually and store in state.

**★ What is the one interaction path that does reach a boundary?**
An unhandled error inside `startTransition` from `useTransition`.

**★ Why does that matter in practice?**
Server Actions are usually invoked inside transitions, so a mutation failure that is not
modelled as a return value will replace part of the page with the error fallback.

**★ Why does a `try/catch` break `redirect()`?**
`redirect()` works by throwing a framework sentinel; a catch intercepts it like any other
exception.

**★ What is the fix?**
`unstable_rethrow(e)` at the top of the catch block, so framework interrupts pass through while
real errors are still handled.

**★ Does `catchError` have the same problem?**
No — not interfering with `notFound()` and `redirect()` is one of the two things it was built
to fix. The hazard is limited to catches you write yourself.

**★ What is the difference between an expected error and an uncaught exception?**
Expected errors happen during normal operation — validation, a failed request — and should be
returned to the client. Uncaught exceptions are bugs, and those are boundary material.

**★ What is the guidance for expected errors in Server Functions specifically?**
Avoid `try`/`catch` and throwing; model them as **return values**, surfaced with
`useActionState`.

**★ What accessibility detail belongs on a rendered action error?**
`aria-live="polite"`, so the message is announced rather than silently inserted.

---

**Previous:** [10 · Custom error boundaries with `catchError`](10-custom-error-boundaries-with-catcherror.md) · **Next:** [10c · Where boundaries sit in the hierarchy](10c-where-boundaries-sit-in-the-hierarchy.md)
