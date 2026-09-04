---
title: "`notFound()`, `redirect()` and `permanentRedirect()` throw in order to work, which is why an honest `try`/`catch` is the thing most likely to break them"
sidebar_label: "01d · Control-flow throws"
sidebar_position: 102
description: "The third shape of failure — expected errors that use a throw as their transport — the full list of framework calls that rely on it, what a catch block silently swallows, and unstable_rethrow's exact contract at 16.3.4."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [`unstable_rethrow` reference](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-03-03`), whose list of framework-throwing
> APIs and "Good to know" rules are quoted verbatim below, and the
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`lastUpdated: 2026-06-10`). Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run**.

**The two-category model has a seam, and every serious App Router bug in this chapter lives in
it.** A handful of framework functions are *expected* errors by intent — a missing record, a
redirect after a mutation — but use the *uncaught* mechanism as their transport, because they
need to unwind the render and hand control back to Next.js rather than return a value to the
caller. That makes them invisible to the two-category test: they look like exceptions to any
`catch` block in their path, and a `catch` that treats them as exceptions produces a page that
renders as though nothing happened. Nothing warns you. The build passes, the types pass, and
the 404 route simply never appears.

## The third category nobody names: control-flow throws

There is a set of functions that **throw in order to work**. `notFound()`, `redirect()` and
`permanentRedirect()` are not errors at all — the throw is how they unwind the render and hand
control back to the framework. They sit on the *expected* side of the split while using the
*uncaught* side's transport, and that hybrid is the source of the nastiest bugs in this chapter:
a well-meaning `try`/`catch` around a data fetch swallows the redirect, and the page renders as
though nothing happened.

```tsx
import { notFound } from 'next/navigation'

export default async function Page() {
  try {
    const post = await fetch('https://.../posts/1').then((res) => {
      if (res.status === 404) notFound()
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
  } catch (err) {
    // 🔴 This catch swallows notFound(). not-found.js never renders.
    console.error(err)
  }
}
```

The framework's own escape hatch for this is `unstable_rethrow`, still marked unstable at
16.3.4, and it is covered with the rest of the Server Function contract in
[03 · Server Action error contracts](03-server-action-error-contracts-returning-typed-errors-vs.md).
The cheaper fix, which the documentation itself recommends, is not to wrap framework calls in a
`try` at all — *"encapsulate your API calls that throw and let the **caller** handle the
exception."*


## The full list of framework calls that throw

The `unstable_rethrow` reference enumerates them, and the list is longer than the obvious three:

> *"The following Next.js APIs rely on throwing an error which should be rethrown and handled by
> Next.js itself:"* — `notFound()`, `redirect()`, `permanentRedirect()`.

Then the part that surprises people:

> *"If a route segment is marked to throw an error unless it's static, a Request-time API call
> will also throw an error that should similarly not be caught by the developer. Note that
> Partial Prerendering (PPR) affects this behavior as well."*

Those APIs are `cookies`, `headers`, `searchParams`, `fetch(..., { cache: 'no-store' })` and
`fetch(..., { next: { revalidate: 0 } })`.

🔴 **This is the half that gets missed.** A `try`/`catch` wrapped around a data-loading helper
that happens to call `cookies()` can swallow a *prerender signal* — not an error at all, but
the mechanism by which the framework discovers that a segment is dynamic. The failure mode is
not a crash; it is a route that silently renders the wrong thing, or a build that decides a
segment is static when it is not.

## Gotchas

### A `catch (err) { console.error(err) }` around a `notFound()`
**Symptom.** A URL for a deleted resource renders the normal page shell with empty data instead
of your 404 UI.
**Cause.** `notFound()` works by throwing, and the catch is indiscriminate.
**Fix.** Move the framework call out of the `try`, so nothing can intercept it.

```tsx
import { notFound } from 'next/navigation'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let post: Post | null
  try {
    post = await api.getPost(id) // returns null for 404, throws only on transport failure
  } catch (cause) {
    throw new Error(`Failed to load post ${id}`, { cause })
  }

  if (!post) notFound() // outside the try — nothing can swallow it

  return <article>{post.title}</article>
}
```
### `redirect()` inside a Server Action's `try`/`catch`
**Symptom.** The mutation commits, the action returns successfully, and the user stays on the
same page. No error is logged.
**Cause.** `redirect()` throws a control-flow exception; a `catch` in the action absorbed it,
and the action then fell through to its normal return.
**Fix.** Redirect after the `try`/`catch`, on the success path.

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTask(prevState: unknown, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false as const, error: 'Title is required' }

  let id: string
  try {
    const task = await db.task.create({ data: { title } })
    id = task.id
  } catch (cause) {
    throw new Error('Failed to create task', { cause })
  }

  revalidatePath('/tasks') // before the redirect — nothing after it runs
  redirect(`/tasks/${id}`) // outside the try: nothing can swallow it
}
```

🔴 **Order matters and the Server Actions guide is explicit about it:** *"Because `redirect`
throws a control-flow exception, any code after it does not run. Place revalidation calls
before `redirect` if the destination needs the fresh data."*

### A generic `catch` in a shared data helper
**Symptom.** `notFound()` works when called directly from a page and does nothing when the same
check moves into `lib/get-post.ts`.
**Cause.** The helper wraps its fetch in a `try`/`catch` for logging. Every caller now inherits
a swallowed control-flow throw.
**Fix.** Data helpers report absence in their return type; only components decide to render a
404.

```ts
// lib/get-post.ts — no framework calls, no swallowing
export async function getPost(id: string): Promise<Post | null> {
  const res = await fetch(`${API}/posts/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Post ${id}: ${res.statusText}`)
  return res.json()
}
```

```tsx
// app/posts/[id]/page.tsx — the component owns the decision
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/get-post'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()
  return <article>{post.title}</article>
}
```

### Catching around `cookies()` or `headers()` to "handle the static render case"
**Symptom.** A segment you expected to be dynamic is prerendered, or a page renders with an
empty session on the first request after a deploy.
**Cause.** Under a static-unless-proven-dynamic segment, a request-time API throws to signal
dynamism, and the `catch` consumed the signal. PPR changes this behaviour too, which is why the
reference calls it out by name.
**Fix.** Do not wrap request-time APIs in a `try`. If you need a fallback for a missing cookie,
read the cookie and branch on the value, not on an exception.

```tsx
import { cookies } from 'next/headers'

export default async function Page() {
  const store = await cookies() // never inside a try
  const theme = store.get('theme')?.value ?? 'light' // absence is a value, not a throw
  return <Shell theme={theme} />
}
```

## Interview questions

**★ `notFound()` throws. Does that make a missing record an uncaught exception?**
No. It is an expected error that happens to use throwing as its control-flow mechanism, the way
`redirect()` and `permanentRedirect()` do. The practical consequence is that an indiscriminate
`try`/`catch` around a fetch will swallow it and your `not-found.js` will never render. Either
keep the framework call outside the `try`, or rethrow the framework's internal errors —
`unstable_rethrow` exists for exactly that, though it is still marked unstable at 16.3.4.
**★ Which Next.js APIs work by throwing, and why does the list include `cookies()`?**
`notFound()`, `redirect()` and `permanentRedirect()` throw as their control-flow mechanism. The
reference adds a second group: when a route segment is marked to throw unless it is static, a
request-time API call throws too — `cookies`, `headers`, `searchParams`,
`fetch(..., { cache: 'no-store' })` and `fetch(..., { next: { revalidate: 0 } })`. That second
throw is not an error, it is how the framework discovers the segment is dynamic, and PPR
affects the behaviour as well.

**★ An action revalidates a path and then redirects. Does the order matter?**
Yes. `redirect()` throws, so nothing after it executes — a `revalidatePath` written below the
redirect never runs, and the destination renders stale data. The guide states the rule directly:
place revalidation before `redirect` if the destination needs the fresh data.

**★ Why is "keep framework calls out of the `try`" better advice than "always rethrow"?**
Because it removes the class of bug instead of patching instances of it. A data helper that
returns `null` for absence and throws only on transport failure can be wrapped in any `try` the
caller likes without hazard; the decision to render a 404 stays in the component, where there is
no `catch` in scope to swallow it. Rethrowing works, but it has to be remembered at every
`catch` in the call path, and nothing checks that you did.

---

← [01c · The typed action result](01c-the-typed-action-result-and-reading-it-back.md) · **Next → [01e · `unstable_rethrow`](01e-unstable-rethrow-and-its-exact-contract.md)**
