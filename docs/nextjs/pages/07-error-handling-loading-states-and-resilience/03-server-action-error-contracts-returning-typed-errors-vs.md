---
title: "A Server Action's response carries two things at once, and which of them you get back is decided by whether the action revalidated, redirected, or merely returned"
sidebar_label: "03 · Server Action error contracts"
sidebar_position: 9
description: "The single-roundtrip response model, the four cache updates and which of them include a re-render, the ordering rule redirect imposes, and where throwing is still the right answer inside an action."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Server Actions and Mutations guide](https://nextjs.org/docs/app/guides/server-actions)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-17`) — its single-response and
> cache-update sections are quoted verbatim below — and the
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`lastUpdated: 2026-06-10`). Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run**.

**An action's error contract is not just "what do I return" — it is also "what does the client
receive alongside it".** [01b](01b-expected-errors-are-return-values.md) settled the first half:
expected failures are return values, not throws. This page is the half that is specific to
Next.js rather than to React. One HTTP request carries both the action's return value *and*, in
some cases, a freshly rendered payload for the current route, and whether the second thing is
there depends entirely on which cache call the action made. Get that wrong and the classic bug
appears: the action reports success, the value comes back correctly, and the list on screen still
shows the old data.

## One response, two payloads

> *"When a Server Action triggers an immediate revalidation, Next.js does the work inside one
> HTTP request: it runs the action, then re-renders the current route server-side. The response
> that comes back contains both pieces in the same Flight stream"* — the action's return value,
> consumed by `useActionState` or the awaited promise, and *"A newly rendered RSC Payload for the
> current route, which the client commits as a seeded navigation."*

> *"Your application code does not need a follow-up fetch to see the updated UI for the current
> page."*

A re-render is included when the action does **any** of these:

| The action… | Re-render in the response? |
|---|---|
| calls `updateTag` | **yes** — and the re-render waits for fresh data |
| calls `revalidatePath` | **yes** |
| calls `refresh` | **yes** — refetches the payload without invalidating cached data |
| mutates cookies via `cookies()` | **yes**, automatically |
| calls `redirect` | **yes** — navigates and streams the destination's payload |
| calls `revalidateTag` with a stale-while-revalidate profile | 🔴 **no** |
| does none of the above | **no** — return value only |

🔴 **That `revalidateTag` row is the trap.** It is the one call in the list that looks like the
others and behaves differently: *"it marks the tag for background refresh and does **not**
include a re-render in the action response. The page reflects the change on a later read."*

## Choosing the cache update

The guide's own summary, and the reason each exists:

- **`updateTag`** — *"immediate expiration of a tag. The next read (including the route re-render
  that ships with the action's response) waits for fresh data. Use when the action needs
  **read-your-own-writes** so the user immediately sees their change. Server Actions only."*
- **`revalidateTag`** — *"stale-while-revalidate refresh of a tag with a cache-life profile.
  Subsequent reads get the stale value while a fresh fetch happens in the background, so the
  action's own re-render does **not** wait for the new data."*
- **`revalidatePath`** — *"invalidate by URL path. Use when one route is affected and tagging is
  overkill."*
- **`refresh`** — *"refetch the current route's RSC Payload without invalidating cached data. Use
  when the view depends on state outside the cache that the action just changed."*

And the property that matters for error handling:

> *"Unlike `redirect`, none of these throw, so an action can call them and still return a value
> to the caller."*

```ts
// app/tasks/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { db } from '@/lib/db'
import type { ActionResult } from '@/lib/action-result'

export async function completeTask(
  prevState: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, error: 'Missing task id' }

  await db.task.update({ where: { id }, data: { completedAt: new Date() } })

  // read-your-own-writes: the re-render in THIS response waits for fresh data
  updateTag('tasks')

  return { ok: true, data: null }
}
```

## Ordering with `redirect`

`redirect` throws, so it terminates the action:

> *"Because `redirect` throws a control-flow exception, any code after it does not run. Place
> revalidation calls before `redirect` if the destination needs the fresh data."*

The full consequences of that throw — including what a `try`/`catch` in the action does to it —
are in [01d · Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md).

## Where throwing is still right inside an action

"Model expected errors as return values" is not "never throw". The guide's own security examples
throw for authorisation failures:

```ts
// app/posts/actions.ts
'use server'

import { auth } from '@/lib/auth'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (!(await canDelete(session.user, postId))) throw new Error('Forbidden')

  await db.post.delete({ where: { id: postId } })
}
```

That is deliberate: an unauthorised call to `deletePost` is not a user mistake to be rendered
politely, it is a request that should never have been made, and the guide notes that destructive
operations *"may warrant stronger handling, such as elevated session checks or re-authentication,
and a loud failure when those checks miss."* Loud is the point.

With the experimental `authInterrupts` flag there is a better-shaped option — `unauthorized()`
and `forbidden()` from `next/navigation`, which render the matching UI segment automatically.
Those are covered in
[11 · Auth interrupts: `forbidden` and `unauthorized`](11-auth-interrupts-forbidden-and-unauthorized.md).

## Gotchas

### The action succeeds and the list does not update
**Symptom.** The row is written, `state.ok` is `true`, and the table on screen still shows the
pre-mutation data until a manual refresh.
**Cause.** The action returned without calling any of the updates that ship a re-render, so the
response carried only the return value.
**Fix.** Call the update that matches what changed — and if the user must see their own write
immediately, `updateTag` rather than `revalidateTag`.

```ts
'use server'

import { updateTag } from 'next/cache'

export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  updateTag('tasks') // the re-render in this response waits for the new value
  return { ok: true as const }
}
```

### `revalidateTag` used where `updateTag` was meant
**Symptom.** The change appears "one action late" — the user renames a task, sees the old name,
renames another, and now sees the first rename.
**Cause.** `revalidateTag` with a stale-while-revalidate profile refreshes in the background and
deliberately does not include a re-render in the action's response, so the page renders stale
data and picks up the change on a later read.
**Fix.** Use `updateTag` for read-your-own-writes. Keep `revalidateTag` for changes other people
need to see eventually — a nightly import, a webhook — where staleness is acceptable.

### `revalidatePath` written after `redirect`
**Symptom.** The redirect works and the destination shows stale data.
**Cause.** `redirect` throws; nothing after it runs.
**Fix.** Revalidate first, redirect last — the guide states this explicitly.

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function publishPost(id: string) {
  await db.post.update({ where: { id }, data: { publishedAt: new Date() } })
  revalidatePath('/posts') // before
  redirect(`/posts/${id}`) // last statement — nothing below it executes
}
```

### A `try`/`catch` in the action that swallows the redirect
**Symptom.** The mutation commits and the user never leaves the form.
**Cause.** `redirect` throws a control-flow exception and the `catch` absorbed it.
**Fix.** Redirect outside the `try` — see
[01d · Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md) for the
general rule and the `unstable_rethrow` alternative.

## Interview questions

**★ What does a Server Action's HTTP response actually contain?**
Potentially two things in one Flight stream: the action's return value, and a newly rendered RSC
Payload for the current route which the client commits as a seeded navigation. The second is
included when the action calls `updateTag`, `revalidatePath` or `refresh`, mutates cookies, or
redirects. If it does none of those, the response carries only the return value and the current
route is not re-rendered.

**★ `updateTag` or `revalidateTag` — how do you choose?**
By whether the user must see their own write in the same interaction. `updateTag` expires the tag
immediately and the re-render that ships with the action's response waits for fresh data, which
is read-your-own-writes. `revalidateTag` with a stale-while-revalidate profile refreshes in the
background and explicitly does **not** include that re-render, so the change appears on a later
read. `updateTag` is also Server-Actions-only.

**★ "Model expected errors as return values" — so should an action ever throw?**
Yes, for the failures that are not expected. The guide's own examples throw on authentication and
authorisation failures, and note that destructive operations may warrant a loud failure when
those checks miss. The rule is about *category*, not about the keyword: a validation message is a
return value, an unauthorised delete attempt is not something to render politely.

**★ An action calls `revalidatePath` and then `redirect`. Swap the order — what breaks?**
The revalidation never happens. `redirect` throws a control-flow exception, so any code after it
does not run, and the destination renders whatever was in the cache before the mutation.

---

---

← [02c · What silently defeats streaming](02c-what-silently-defeats-streaming-in-production.md) · **Next → [03b · Sequential dispatch](03b-sequential-dispatch-and-what-it-does-to-error-ui.md)**
