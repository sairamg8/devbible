---
title: "With Cache Components on, metadata that reaches for request data on an otherwise-static route is a build error — and the fix you pick determines whether the page keeps its static shell"
sidebar_label: "01f · Metadata under Cache Components"
sidebar_position: 104
description: "The two blocking-prerender-metadata errors and why they are different; use cache with cacheTag on generateMetadata; the Suspense-wrapped connection() dynamic marker and why the boundary is mandatory; and the _not-found route that no marker can rescue."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js insight pages
> [runtime data in `generateMetadata()`](https://nextjs.org/docs/messages/blocking-prerender-metadata-runtime)
> and
> [uncached data in `generateMetadata()`](https://nextjs.org/docs/messages/blocking-prerender-metadata-dynamic),
> the [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> section *With Cache Components* (page `lastUpdated: 2026-08-25`), and
> [`generateViewport`](https://nextjs.org/docs/app/api-reference/functions/generate-viewport)
> (`2026-06-09`).
> Target: **Next.js 16.3.4** with `cacheComponents` enabled. Documentation-verified —
> **no sandbox run**.

**Without Cache Components, metadata that reads a cookie just makes the route dynamic and
nobody says anything. With Cache Components on, Next raises an error — but only in one specific
situation: when the metadata is the *only* thing stopping an otherwise fully prerenderable
route from prerendering. That precision is the point. The framework is not objecting to dynamic
metadata; it is objecting to a page whose entire body could have been a static shell being
dragged to request time by its title. There are two distinct errors depending on *why* the
metadata is dynamic, and they have different fixes, one of which quietly gives up the static
shell.**

## Which error you got, and why they are not the same

| Insight | Trigger | Fixes offered |
|---|---|---|
| `blocking-prerender-metadata-runtime` | Metadata read `cookies()`, `headers()`, `params` or `searchParams` | Static `metadata`; or `generateStaticParams` + cached `generateMetadata`; or a dynamic marker |
| `blocking-prerender-metadata-dynamic` | Metadata did an **uncached** `fetch`, database call, or `connection()` | `'use cache'` on `generateMetadata`; or a dynamic marker |

The split matters because `'use cache'` fixes the second and cannot fix the first: a cached
scope may not call `cookies()` or `headers()` at all. If your metadata genuinely needs the
session, caching is not available to you and you are choosing between a static title and a
dynamic route.

There is a matching pair for viewport — `blocking-prerender-viewport-runtime` and
`blocking-prerender-viewport-dynamic` — with the important difference that viewport cannot
stream, so its dynamic escape is a `<Suspense>` around the document body rather than a marker
component ([01b](01b-the-title-algebra-and-the-viewport-export.md)). Two consequences of this
model that are big enough to have their own page — the 404 route that no fix reaches, and the
file conventions that go dynamic without any code of yours — are in
**01g · File metadata, the 404 route and debugging the insight** *(not written yet)*.

## Fix 1 — make it static

The cheapest fix, and the right one far more often than people expect, because most metadata is
not actually per-request:

```tsx
// app/about/page.tsx
export const metadata = {
  title: 'About us',
  description: 'Who builds SprintDesk and why.',
}
```

When the metadata varies by route parameter — a post title, a product name — static means
*prerendered per parameter*, which is `generateStaticParams` plus a cached metadata function:

```tsx
// app/blog/[slug]/page.tsx
export function generateStaticParams() {
  return [{ slug: 'sharding-the-outbox' }, { slug: 'instant-navigations' }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  'use cache'
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post.title, description: post.excerpt }
}
```

Note what the docs point out about the params here: **reading `params` inside a cached metadata
function puts them in the cache key automatically**, so each slug gets its own entry. You do not
pass them in yourself.

The trade-off the insight page names honestly: static metadata cannot reflect a visitor's
locale, an A/B bucket or a personalised title.

## Fix 2 — cache the data the metadata needs

For a CMS-backed title that changes when an editor publishes, but not per request:

```tsx
// app/blog/[slug]/page.tsx
import { cacheTag } from 'next/cache'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  'use cache'
  const { slug } = await params
  cacheTag(`meta-${slug}`)
  const { title, description } = await cms.getPageData(slug)
  return { title, description }
}
```

Then invalidate at the point of publication — `updateTag` from a Server Action if the editor
must see their own write immediately, `revalidateTag` from a webhook Route Handler if the CMS
pushes to you. The corpus covers the directive itself in
[05 · `use cache` and cacheLife](../05-caching-ppr-and-cache-components/02-the-use-cache-directive-and-custom-cachelife-profiles.md).

Two constraints on this fix that are easy to walk into:

- 🔴 **A cached scope cannot call `cookies()` or `headers()`.** If the metadata needs a session
  token to call a protected API, read the token *outside* the cached function and pass it in as
  an argument — or accept that the route is dynamic.
- 🔴 **A short `cacheLife` defeats the fix.** The insight page states that a profile whose
  `revalidate` is shorter than the prerender's effective lifetime keeps the metadata out of the
  prerender, making the route partially dynamic again. You will have added `'use cache'`,
  cleared the error, and still lost the shell. Use a longer profile if you want the metadata in
  the static shell.

## Fix 3 — the dynamic marker, and why the boundary is not optional

When the metadata genuinely needs request data — a personalised title from a protected API — the
documented escape is to tell Next the page has intentional dynamic content:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { connection } from 'next/server'

export async function generateMetadata() {
  const token = (await cookies()).get('token')?.value
  const res = await fetch('https://api.sprintdesk.app/meta', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const { title } = await res.json()
  return { title }
}

async function DynamicMarker() {
  await connection()
  return null
}

export default function Page() {
  return (
    <>
      <article>This content is completely static and still prerenders.</article>
      <Suspense>
        <DynamicMarker />
      </Suspense>
    </>
  )
}
```

🔴 **The `<Suspense>` is load-bearing, not decoration.** Without it the dynamic marker
propagates up the tree and the whole page is treated as blocking — surfacing the same
blocking-route error the marker was added to resolve. With it, the article still prerenders and
only the marker is excluded.

Do not put `await connection()` directly in the page component. The reference's own comment says
so: doing that prevents the static content from being included in the shell, which is the exact
outcome the pattern exists to avoid.

The docs are also blunt that this pattern is *intentionally verbose*, as a signal — if you find
yourself writing a marker, the honest question is whether the metadata really needs to be
per-request. Most does not.

## Gotchas

**★ `'use cache'` on `generateMetadata` cannot fix a `cookies()` read.** A cached scope may not
call request-bound APIs. The error you have is `blocking-prerender-metadata-runtime`, not
`-dynamic`, and adding the directive produces a different error rather than a fix. Read the
request value outside the cached scope, or use a marker.

**★ Adding `'use cache'` with a short `cacheLife` clears the error and still loses the
shell.** A profile whose `revalidate` is shorter than the prerender's effective lifetime keeps
the metadata out of the prerender. Nothing tells you; the route just quietly stops being fully
static. Use a longer profile when you want the metadata in the shell.

**★ A dynamic marker without a `<Suspense>` boundary makes things worse.** The marker
propagates, the whole page is treated as blocking, and you get the same class of error you were
trying to resolve — now with an extra component in the tree.

**★ `await connection()` in the page component instead of the marker throws away the static
shell.** The reference explicitly warns against it. The marker exists precisely so the dynamic
signal sits behind a boundary and the rest of the page still prerenders.

**★ You will not see this error on a page that is already partially dynamic.** If some
component already reads `cookies()` inside a Suspense boundary, the route is dynamic anyway and
the metadata is not the thing forcing it. That is documented — and it means the error appearing
after an unrelated refactor may mean the *page* got better, not that the metadata got worse.

## Interview questions

**★ Why does Next raise an error for dynamic metadata on some routes and not others?**
Because the error fires only when the metadata is the *sole* reason an otherwise fully
prerenderable route cannot prerender. If the page body already reads request data inside a
Suspense boundary, the route is dynamic regardless and the metadata costs nothing extra. The
error exists to catch the case where a whole static page is being dragged to request time by
its title — a large cost for a small cause, and one that is invisible without the check.

**★ What is the difference between the two `blocking-prerender-metadata-*` insights?**
`-runtime` means the metadata read a request-bound value — `cookies()`, `headers()`, `params`,
`searchParams`. `-dynamic` means it performed an uncached data access — a `fetch`, a database
call, `connection()`. The distinction matters because `'use cache'` fixes the second and is
unavailable for the first: a cached scope cannot call request APIs at all.

**★ You add `'use cache'` to `generateMetadata`, the build error goes away, and the route is
still not fully static. What happened?**
Almost certainly a `cacheLife` profile whose `revalidate` is shorter than the prerender's
effective lifetime. The documented behaviour is that such a profile keeps the metadata out of
the prerender, so the route becomes partially dynamic — error cleared, shell still gone. Use a
longer profile, or accept the dynamic portion deliberately.

**★ Explain the dynamic marker pattern and why the Suspense boundary is mandatory.**
It is a component that calls `await connection()` and renders `null`, wrapped in `<Suspense>`.
The `connection()` call is an explicit statement that the page has intentional request-time
content, which permits the dynamic metadata. The boundary confines that signal: without it the
dynamic dependency propagates to the parent and the entire page is treated as blocking, which
reproduces the original error. With it, everything outside the boundary still prerenders.

{/* FOOTER */}
