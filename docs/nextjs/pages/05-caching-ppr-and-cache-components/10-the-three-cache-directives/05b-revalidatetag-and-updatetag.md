---
title: "`revalidateTag` now takes a second argument, and `updateTag` is the one that lets a user see their own write"
sidebar_label: "5b · `revalidateTag` vs `updateTag`"
sidebar_position: 8
description: "The two-argument signature and its deprecated single-argument form, the profile that decides how long stale is served, and why updateTag is Server-Action-only."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API references for
> [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and
> [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag).
> Target: **Next.js 16.3.4**, App Router.

**Almost every `revalidateTag` call you will find in existing code, tutorials and this book's
own imported chapters is written in a form the docs now call deprecated.** The function takes
**two** arguments — the tag, and a profile saying how long stale content may still be served —
and the single-argument form only survives if TypeScript errors are suppressed. Alongside it
sits `updateTag`, which *is* single-argument, works **only inside Server Actions**, and exists
for one job the other cannot do: letting the user who just made a change see that change
instead of stale data.

## The two signatures

```ts
revalidateTag(tag: string, profile: string | { expire?: number }): void
updateTag(tag: string): void
```

| | `revalidateTag` | `updateTag` |
|---|---|---|
| **Callable in** | Server Functions **and** Route Handlers | **Server Actions only** — throws elsewhere |
| **Next request** | Served stale while revalidation runs | **Waits** for fresh data |
| **Designed for** | Webhooks, API endpoints, general invalidation | **Read-your-own-writes** |
| **Arguments** | tag **+ profile** | tag |

Neither works in Client Components or `proxy` — both are server-only.

## What the profile actually controls

Calling `revalidateTag` marks the tagged data stale. The next request for it kicks off a
revalidation and **is served stale content while that runs** — stale-while-revalidate. The
second argument sets **how long stale content may be served**. Past that window, a request
blocks until revalidation completes.

| Profile | Behaviour |
|---|---|
| `'max'` **(recommended)** | A one-year window — long enough that requests are *always* served stale while revalidation runs |
| Another `cacheLife` profile, or `{ expire: N }` | Any window you like; only its `expire` is read |
| `{ expire: 0 }` | Stale is **never** served — the next request blocks. Use when data must be gone immediately and `updateTag` is unavailable |
| **omitted** *(deprecated)* | Behaves like `{ expire: 0 }` |

The framing worth keeping: **the profile is the point past which correctness matters more than
speed.**

```ts filename="app/actions.ts"
'use server'
import { revalidateTag } from 'next/cache'

export default async function submit() {
  await addPost()
  revalidateTag('posts', 'max')
}
```

```ts filename="app/api/revalidate/route.ts"
import { revalidateTag } from 'next/cache'

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')
  if (tag) {
    revalidateTag(tag, 'max')
    return Response.json({ revalidated: true, now: Date.now() })
  }
  return Response.json({ revalidated: false, message: 'Missing tag to revalidate' })
}
```

When the invalidation comes from **outside** a Server Action — a webhook, another service
calling a Route Handler — `updateTag` is not available. Pass `{ expire: 0 }` to expire
immediately:

```ts
revalidateTag(tag, { expire: 0 })
```

## `updateTag`: the read-your-own-writes case

A user creates a post and is redirected to it. With stale-while-revalidate they may land on
the list *without their new post in it* — technically correct caching, and a bug report.
`updateTag` expires the data immediately so the next request waits for fresh data.

```ts filename="app/actions.ts"
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: { title: formData.get('title'), content: formData.get('content') },
  })

  updateTag('posts')                 // the list page
  updateTag(`post-${post.id}`)       // the detail page

  redirect(`/posts/${post.id}`)      // user sees fresh data, not cache
}
```

Calling it outside a Server Action throws:

```ts filename="app/api/posts/route.ts"
import { revalidateTag, updateTag } from 'next/cache'

export async function POST() {
  updateTag('posts')                 // Error: updateTag can only be called
                                     // from within a Server Action
  revalidateTag('posts', 'max')      // use this here instead
}
```

## Tags have to be assigned first

Two ways, and they correspond to the two caching mechanisms:

```tsx
// External API requests via fetch
fetch(url, { next: { tags: ['posts'] } })

// Cached functions and components
import { cacheTag } from 'next/cache'
async function getData() {
  'use cache'
  cacheTag('posts')
}
```

🔴 **Tags are case-sensitive and must not exceed 256 characters. A tag over the limit is never
assigned to cached data at all — so revalidating it silently does nothing.**

## Revalidation is pull, not push

> A revalidation is triggered by a **request**, not by the `revalidateTag` call.

Pages using the tag revalidate **as they are visited**, not all at once. A call that
invalidates a thousand pages does not produce a thousand upstream requests; it produces one per
page, when someone asks for it. That is usually what you want, and it means "I revalidated it
and nothing happened" is normally "nobody has visited it yet."

## Gotchas

### Writing `revalidateTag('posts')` with no profile

**Symptom.** A TypeScript error, or — with errors suppressed — silent legacy behaviour.

**Cause.** The single-argument form is **deprecated**. It behaves like `{ expire: 0 }`, so
every invalidation becomes a blocking revalidate rather than stale-while-revalidate.

**Fix.** In a Server Action, use `updateTag('posts')`. Anywhere else, `revalidateTag('posts',
'max')`.

```ts
// BAD — deprecated, and silently blocking
revalidateTag('posts')

// GOOD — Server Action, read-your-own-writes
updateTag('posts')

// GOOD — Route Handler / webhook
revalidateTag('posts', 'max')
```

### Reaching for `updateTag` in a Route Handler

**Symptom.** `Error: updateTag can only be called from within a Server Action`.

**Cause.** It is Server-Action-only by design — not Route Handlers, not Client Components, not
anywhere else.

**Fix.** `revalidateTag(tag, 'max')`, or `revalidateTag(tag, { expire: 0 })` when the caller
needs the data gone immediately.

### A user not seeing their own change

**Symptom.** Create a post, get redirected, and the list does not include it. Refresh and it
appears.

**Cause.** `revalidateTag` with a stale-serving profile did exactly what it promises — served
the cached copy while revalidating behind it.

**Fix.** `updateTag` in the Server Action that performed the mutation. This is the entire
reason it exists.

### A tag longer than 256 characters

**Symptom.** Revalidation does nothing, with no error anywhere.

**Cause.** A tag over the limit is **never assigned to cached data**, so there is nothing for
the call to invalidate. The failure is at write time and silent at read time.

**Fix.** Keep tags short and structured — `post-${id}`, not a serialized object. Watch out for
tags built from user input or long slugs.

### Case-mismatched tags

**Symptom.** `cacheTag('Posts')` and `revalidateTag('posts', 'max')` never meet.

**Cause.** Tags are case-sensitive.

**Fix.** Centralise tag construction in one module and never hand-write a tag string twice.

### Expecting the call itself to refresh pages

**Symptom.** Monitoring shows no upstream traffic after a bulk invalidation, and someone
concludes it did not work.

**Cause.** Revalidation is triggered by a request. Pages refresh as they are visited.

**Fix.** Nothing — this is the design, and it is what stops one invalidation stampeding the
upstream. Verify by visiting a page, not by watching a graph.

### Using `{ expire: 0 }` where `max` belongs

**Symptom.** Traffic spikes on the upstream after every webhook, and p99 latency jumps for the
first visitor to each page.

**Cause.** `{ expire: 0 }` means stale is never served, so every first request after an
invalidation blocks on the upstream.

**Fix.** `'max'` unless the data genuinely must be gone immediately. Reserve `{ expire: 0 }`
for correctness-critical invalidations outside Server Actions.

## Interview questions

**★ What is the current signature of `revalidateTag`?**
`revalidateTag(tag: string, profile: string | { expire?: number })`. The single-argument form
is **deprecated** and only works while TypeScript errors are suppressed.

**★ What does the profile control?**
How long stale content may still be served while revalidation runs. Past that window a request
blocks.

**★ Which profile is recommended, and why?**
`'max'` — a one-year window, long enough that requests are always served stale while the
revalidation happens in the background.

**★ What does `{ expire: 0 }` do?**
Stale is never served, so the next request is a blocking revalidate. It is also exactly what
the deprecated no-profile form did.

**★ Where can `updateTag` be called?**
**Server Actions only.** It throws in Route Handlers, Client Components, or anywhere else.

**★ What problem does `updateTag` solve?**
Read-your-own-writes. It expires the data immediately so the user who just made a change sees
it, rather than the stale cached copy.

**★ A webhook needs to invalidate a tag immediately. What do you call?**
`revalidateTag(tag, { expire: 0 })` — `updateTag` is unavailable outside Server Actions.

**★ How are tags assigned to cached data?**
`fetch(url, { next: { tags: [...] } })` for fetch caching, or `cacheTag(...)` inside a
`'use cache'` scope.

**★ What are the limits on a tag?**
Case-sensitive, maximum 256 characters. A longer tag is **never assigned**, so revalidating it
does nothing and reports no error.

**★ Does `revalidateTag` refresh every affected page immediately?**
No. Revalidation is triggered by a request, so pages refresh as they are visited.

---

**Previous:** [5 · Revalidation and lifetimes](05-revalidation-and-lifetimes.md)
