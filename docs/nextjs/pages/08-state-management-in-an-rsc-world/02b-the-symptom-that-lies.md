---
title: "\"I mutated and the UI did not update\" is the most common reason teams add a client cache, and it is almost never a reason — four cheaper explanations have to be eliminated first"
sidebar_label: "02b · The symptom that lies"
sidebar_position: 7
description: "The stale-after-mutation symptom in full: an action that invalidated nothing, invalidation after a redirect, revalidateTag's deliberate skipped re-render, and a browser stale window — plus the navigation-scope and useSearchParams mechanics that produce the same 'it does not work' report."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh) (`lastUpdated: 2026-06-25`), [Caching](https://nextjs.org/docs/app/getting-started/caching) and [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**[02](02-when-rsc-data-flow-is-enough.md) drew the boundary. This page is about the one symptom that makes people place themselves on the wrong side of it. A user saves, the screen does not change, somebody concludes that server-driven rendering "does not update" and opens a PR adding a client cache. Four cheaper explanations account for nearly all of these reports, and one of them is *documented behaviour that the framework does on purpose*. A second family of reports — a fallback that never shows, a route that stopped prerendering, filters that feel slow — has the same shape: a mechanism working as specified, read as a missing feature.**

## 🔴 The signal that lies: "I mutated, and the UI did not update"

This is reported as *"RSC data flow is not enough, we need a client cache"* more often than any other symptom, and it is almost never true. It is usually the wrong invalidation function, and the documentation says so outright:

> *"`revalidateTag` with a stale-while-revalidate profile intentionally skips that immediate re-render."*

> *"`revalidateTag`: stale-while-revalidate refresh of a tag with a cache-life profile. Subsequent reads get the stale value while a fresh fetch happens in the background, so the action's own re-render does **not** wait for the new data."*

So an action that ends in `revalidateTag` returns a re-rendered payload built from **stale** data. The user sees the old value, concludes the framework "does not update", and a client cache gets added to paper over a one-line fix.

```ts filename="app/board/actions.ts"
'use server'

import { updateTag, revalidateTag } from 'next/cache'

export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })

  // 🔴 The actor's own screen will show the pre-rename title.
  // revalidateTag(`task:${id}`, 'hours')

  // ✅ "immediately expires the cached data … The next request will wait to
  // fetch fresh data rather than serving stale content from the cache."
  updateTag(`task:${id}`)
}
```

The decision table for which of the four to call is [10b](10b-refresh-against-the-alternatives.md). Before adding any client cache to fix a stale screen, confirm you are not in this case.

Two neighbouring symptoms with the same shape:

- **The action returned a value and the page did not change.** Invalidation is not implied by returning. *"Unlike `redirect`, none of these throw, so an action can call them and still return a value to the caller"* — but you must call one.
- **The action called `redirect()` and the invalidation never ran.** `redirect` throws a control-flow exception, so anything after it is dead code. Invalidate first.

## Gotchas

**★ Symptom: a value belongs in the URL by every test, and putting it there made typing in the search box unusable.** Cause: every keystroke became a navigation, and a navigation is a server render. The URL was the right home; the update frequency was the problem. Fix: keep the URL authoritative and debounce the write, holding only the in-flight keystrokes locally.

```tsx filename="app/board/search-box.tsx"
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function SearchBox() {
  const params = useSearchParams()
  const router = useRouter()
  const [text, setText] = useState(params.get('q') ?? '')

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params)
      text ? next.set('q', text) : next.delete('q')
      router.replace(`?${next}`)
    }, 300)
    return () => clearTimeout(id)
  }, [text, params, router])

  return <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Search" />
}
```

⚠️ This is the one legitimate `useState` mirror of URL state, because its lifetime is 300 ms and the URL wins immediately afterwards. Note also the documented asymmetry it relies on: *"`useSearchParams()` suspends during server rendering because search params are not available at build time. But on a client navigation, the router already has the params from the URL and the hook resolves synchronously."*

**★ Symptom: `useSearchParams()` builds fine and then fails prerendering, or the whole route goes dynamic.** Cause: *"The `useSearchParams` hook always needs a `<Suspense>` boundary, since search params are not available at build time"* — and `'use client'` does not exempt it: *"`"use client"` doesn't skip validation for the static shell."* Fix: wrap the component that reads them, so the rest of the page still prerenders.

```tsx filename="app/board/page.tsx"
import { Suspense } from 'react'
import { SearchBox } from './search-box'

export default function Page() {
  return (
    <>
      <h1>Board</h1>
      <Suspense fallback={<input disabled aria-label="Search" />}>
        <SearchBox />
      </Suspense>
    </>
  )
}
```

**★ Symptom: a Suspense fallback shows on a full page load and never on a client navigation, so a colleague concludes it is broken.** Cause: the boundary sits above the shared layout of the two routes, and *"on this navigation, it sits above the re-render scope and does not trigger"*. Fix: move the boundary below the shared layout so it is inside the re-render scope of the navigation you care about.

```tsx filename="app/board/[status]/page.tsx"
import { Suspense } from 'react'
import { TaskList } from './task-list'

// The boundary lives in the page, not the layout: /board/open → /board/done
// re-renders this file, so the fallback is inside the transition's scope.
export default async function Page({ params }: { params: Promise<{ status: string }> }) {
  const { status } = await params
  return (
    <Suspense key={status} fallback={<p>Loading {status} tasks…</p>}>
      <TaskList status={status} />
    </Suspense>
  )
}
```

**★ Symptom: three independent mutations fired from one click take three times as long as expected.** Cause: *"Next.js dispatches Server Actions one at a time per client"*, and the guide is explicit that you should *"not rely on `Promise.all` to parallelize Server Actions from the client"*. Fix: make it one action that does the three things server-side, where they can actually run in parallel.

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'

export async function archiveMany(ids: string[]) {
  await Promise.all(ids.map((id) => db.task.update({ where: { id }, data: { archived: true } })))
  updateTag('board')
}
```

**★ Symptom: filters live in the URL, and navigating between filter values feels slower than it did with client state.** Cause: prefetching covers the App Shell by default but not content keyed on URL data — *"To also prefetch cached content that depends on a link's **URL data**, such as `searchParams` or dynamic `params`, set `prefetch={true}` on that link."* Fix: opt the specific links in, knowing the documented cost — *"It costs a server invocation per prefetchable link."*

```tsx filename="app/board/filter-links.tsx"
import Link from 'next/link'

export function FilterLinks() {
  return (
    <nav>
      <Link href="/board?status=open" prefetch>Open</Link>
      <Link href="/board?status=done" prefetch>Done</Link>
    </nav>
  )
}
```

**★ Symptom: the action worked, the data is correct in the database, and nothing at all happened on screen.** Cause: the action invalidated nothing — none of `updateTag`, `revalidatePath`, `revalidateTag` or `refresh` throws, so an action that calls none of them completes successfully and returns a response with no re-rendered payload in it. Fix: name what changed, every time.

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'

export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  updateTag(`task:${id}`) // 🔴 without this line the action silently does nothing visible
  return { ok: true }
}
```

**★ Symptom: the invalidation call is right there in the action, and it never runs.** Cause: it sits after a `redirect()`, which throws a control-flow exception, so everything below it is unreachable. Fix: invalidate before redirecting — the destination render then sees the new data.

```ts filename="app/board/actions.ts"
'use server'

import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'

export async function createTask(formData: FormData) {
  const task = await db.task.create({ data: { title: String(formData.get('title')) } })
  updateTag('board')          // ✅ first
  redirect(`/board/${task.id}`) // throws; nothing after this line executes
}
```

**★ Symptom: the value is correct after a hard reload but stale on every soft navigation back to the page.** Cause: the browser is holding the entry inside its `stale` window — *"Duration the client should cache a value without checking the server"* — so no request is being made at all. Fix: this is a profile decision, not an application bug; shorten `stale` for that value or take it out of the cached scope.

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // Values a user mutates and immediately re-reads should not sit in the browser.
    mutable: { stale: 0, revalidate: 30, expire: 300 },
  },
}

export default nextConfig
```

**★ Symptom: the actor sees fresh data and a second user on another tab does not, and this is reported as a cache bug.** Cause: it is the documented model — *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using the tag revalidate as they are visited rather than all at once."* Nothing pushes to the other tab, because no request happened there. Fix: if the second tab must update without acting, that is signal 4 in [02](02-when-rsc-data-flow-is-enough.md) and it is genuinely outside the loop — but confirm the requirement before building for it.

```ts filename="app/board/actions.ts"
'use server'

// Nothing here can reach another user's browser. If it must, the transport
// is a subscription, not an invalidation call.
export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  updateTag(`task:${id}`) // affects the NEXT request for this tag, wherever it comes from
}
```

## Interview questions

**★ Someone reports "I saved and the page still shows the old value" and wants to add a client cache. What do you check, in order?**
First, whether the action invalidated anything at all — none of these functions throw, so an action can complete happily having called none of them. Second, whether the invalidation came after a `redirect()`, which throws and makes everything below it dead code. Third, which function was used: `revalidateTag` under a stale-while-revalidate profile *"intentionally skips that immediate re-render"*, so the actor sees pre-mutation data by design. Fourth, whether the value is inside a `stale` window in the browser, which a hard reload will tell you. Only if all four are clean is there an argument that the loop cannot express the requirement.

**★ Why is a `useState` mirroring the URL sometimes correct, given everything [01e](01e-the-stale-mirror-and-the-drifting-store.md) says about mirrors?**
Because the objection to a mirror is that it has no invalidation protocol, and a debounce is one. The local text is authoritative for a bounded, explicit window — the 300 ms between keystrokes — after which the URL is written and becomes authoritative again. The drift bug happens when the mirror's lifetime is unbounded and nothing brings the two copies back together. Any time you can name the exact event that ends the mirror's authority, and that event is guaranteed to happen, the mirror is a buffer rather than a second source of truth.

**★ Why would a framework ever ship an invalidation function that deliberately does not refresh the actor's own screen?**
Because immediate freshness and low latency are in tension, and the caller is the only one who knows which matters. `updateTag` expires the entry so the next read — including the route re-render riding the action's response — *waits* for fresh data; that is a correct screen bought with the full cost of the query on the critical path. `revalidateTag` under a cache-life profile serves the stale value and refreshes in the background, so the action returns fast and the data is right shortly afterwards. Both are legitimate; shipping only the first would make every mutation pay for a cold read, and shipping only the second would make "save and see it" impossible. The bug is picking the second and expecting the first.

**★ A `<Suspense>` fallback in the root layout never shows during navigation. Is that a bug?**
No, it is the navigation scope. A client navigation only re-renders below the layout the current and destination routes share, so a boundary above that point *"sits above the re-render scope and does not trigger"*. The same boundary does fire on a direct visit, because a full page load renders the whole tree — which is why this gets reported as intermittent. The fix is to place the boundary inside the scope of the transition you care about, which usually means moving it from the layout into the page or into a deeper segment.

**★ How do you tell a caching problem from a state-management problem in sixty seconds?**
Hard-reload the page. A hard reload bypasses the browser's copy of the payload and forces a fresh server render, so if the value is correct after it and wrong before it, the problem is a cache timer or an invalidation call — nowhere near your state architecture. If it is wrong after a hard reload too, the server itself is producing stale output, which points at a cached scope that was not invalidated or a query that is wrong. Only if the value is correct on the server and the requirement is for it to change *without* any request does the diagnosis become "outside the RSC loop".

---

← [02 · When RSC data flow is enough](02-when-rsc-data-flow-is-enough.md) · [Chapter 8 overview](01-explanation.md) · Next → [02c · Look-alikes: URL, cookies, optimistic](02c-look-alikes-url-cookies-and-optimistic.md)
