---
title: "generateStaticParams tells the build which values a dynamic segment can take, and returning all of them, some of them, or an empty array are three different deployment strategies rather than three ways of writing the same function"
sidebar_label: "03d · generateStaticParams"
sidebar_position: 15
description: "Where the function may live, the return shape per segment type, the all/subset/none strategies, why omitting it differs from returning [], and when it runs during dev, build and ISR."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated: 2026-08-25`) and [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md).

**A dynamic segment says *"a value goes here"*; `generateStaticParams` says *"and here are the values"*. Which values you return is the actual deployment decision: the full list prerenders everything at build time, a slice prerenders the hot paths and leaves the long tail to first request, and an empty array prerenders nothing while still marking the route statically renderable. The three are not stylistic variants — and the difference between *omitting* the function and returning `[]` from it is the difference between a dynamic route and a static one with no instances yet.**

## What it is and where it may live

> *"The `generateStaticParams` function can be used in combination with dynamic route segments to **statically generate** routes at build time instead of on-demand at request time."*

It is supported in three file conventions:

> *"`generateStaticParams` can be used with: Pages (`page.tsx`/`page.js`), Layouts (`layout.tsx`/`layout.js`), Route Handlers (`route.ts`/`route.js`)"*

It returns an array of objects, one per route, whose keys are segment names:

> *"Each property in the object is a dynamic segment to be filled in for the route. The properties name is the segment's name, and the properties value is what that segment should be filled in with."*

| Example route | Return type |
|---|---|
| `/product/[id]` | `{ id: string }[]` |
| `/products/[category]/[product]` | `{ category: string, product: string }[]` |
| `/products/[...slug]` | `{ slug: string[] }[]` |

🔴 **A catch-all segment's value is an array of segments, not a joined path.** `{ slug: ['a', '1'] }` produces `/product/a/1`; `{ slug: 'a/1' }` does not, because the value has the wrong shape.

```tsx title="app/product/[...slug]/page.tsx"
export function generateStaticParams() {
  return [{ slug: ['a', '1'] }, { slug: ['b', '2'] }, { slug: ['c', '3'] }]
}
```

Every value is a **string**, including one that looks like a number — the route param it fills is a string, so `id: 1` and `id: '1'` are not interchangeable:

```ts title="app/api/posts/[id]/route.ts"
export async function generateStaticParams() {
  const posts: { id: number }[] = await fetch(
    'https://api.vercel.app/blog'
  ).then((res) => res.json())

  return posts.map((post) => ({
    id: `${post.id}`,
  }))
}
```

## The three strategies

**Everything at build time** — the whole list:

```tsx title="app/blog/[slug]/page.tsx"
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())
  return posts.map((post: { slug: string }) => ({ slug: post.slug }))
}
```

**A subset now, the rest on first visit** — *"To statically render a subset of paths at build time, and the rest the first time they're visited at runtime, return a partial list of paths"*:

```tsx title="app/blog/[slug]/page.tsx"
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())
  // Render the first 10 posts at build time
  return posts.slice(0, 10).map((post: { slug: string }) => ({ slug: post.slug }))
}
```

**Nothing at build time, everything on first visit** — the empty array, or `force-static`:

```jsx title="app/blog/[slug]/page.js"
export async function generateStaticParams() {
  return []
}
```

```jsx title="app/changelog/[slug]/page.js"
export const dynamic = 'force-static'
```

And the sentence that explains why the empty array exists rather than just omitting the function:

> *"You must always return an array from `generateStaticParams`, even if it's empty. Otherwise, the route will be dynamically rendered."*
>
> *"You must return an empty array from `generateStaticParams` or utilize `export const dynamic = 'force-static'` in order to revalidate (ISR) paths at runtime."*

So *omitting* the function and *returning `[]`* are two different deployments: one is a dynamic route, the other a static route with no prerendered instances yet. This is the single most consequential line in the reference, and it is easy to violate by accident — an error path that `return`s bare, with no array, quietly converts the second into the first.

## When it runs, and when it does not

Four behavioural facts, all from the reference, each of which has bitten somebody:

> *"During `next dev`, `generateStaticParams` will be called when you navigate to a route."*
> *"During `next build`, `generateStaticParams` runs before the corresponding Layouts or Pages are generated."*
> *"During revalidation (ISR), `generateStaticParams` will not be called again."*
> *"`generateStaticParams` replaces the `getStaticPaths` function in the Pages Router."*

The third is the one that surprises people. Publishing a new post does **not** cause a revalidation to discover it: ISR revalidates the *pages that already exist*. New paths arrive either through a rebuild, or through the runtime fallback governed by `dynamicParams` — see [03g · dynamicParams and route-matching precedence](03g-dynamicparams-and-route-matching-precedence.md).

## Fetches inside it are memoized with the rest of the render

> *"When using `fetch` inside the `generateStaticParams` function, the requests are automatically deduplicated. This avoids multiple network calls for the same data Layouts, Pages, and other `generateStaticParams` functions, speeding up build time."*
>
> *"`fetch` requests are automatically memoized for the same data across all `generate`-prefixed functions, Layouts, Pages, and Server Components. React `cache` can be used if `fetch` is unavailable."*

So the common instinct — "I'd better pass the fetched list down somehow, or the build will hit the API twice" — is unnecessary for `fetch`, and the documented substitute for a database client or SDK is React's `cache`.

## Where this goes next

- What the samples become once Cache Components is on — a build-time validation suite rather than a prerender list: [03e · generateStaticParams under Cache Components](03e-generatestaticparams-under-cache-components.md).
- Generating params for more than one dynamic segment, and prerendering API responses: [03f · Nested dynamic segments and Route Handlers](03f-nested-dynamic-segments-and-route-handlers.md).
- What happens to the values you did **not** return, and how a static folder and a dynamic folder compete for the same URL: [03g · dynamicParams and route-matching precedence](03g-dynamicparams-and-route-matching-precedence.md).

## Gotchas

**★ Symptom: a newly published article 404s (or renders dynamically forever), even though ISR revalidation works fine on the existing articles.** Cause: *"During revalidation (ISR), `generateStaticParams` will not be called again."* Revalidation refreshes pages that already exist; it does not re-enumerate the path list. Fix: leave `dynamicParams` at its default `true` so unlisted paths render on first request, and trigger a rebuild when you want them prerendered.

```tsx title="app/blog/[slug]/page.tsx"
export const dynamicParams = true   // the default; unlisted slugs render on demand

export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((r) => r.json())
  return posts.slice(0, 50).map((p: { slug: string }) => ({ slug: p.slug }))
}
```

**★ Symptom: the route renders dynamically even though `generateStaticParams` exists.** Cause: one code path returns nothing. *"You must always return an array from `generateStaticParams`, even if it's empty. Otherwise, the route will be dynamically rendered."* A bare `return` inside an error guard is enough. Fix: make every path return an array.

```tsx
export async function generateStaticParams() {
  const res = await fetch('https://.../posts')
  if (!res.ok) return []              // not `return` and not `return undefined`
  const posts = await res.json()
  return posts.map((p: { slug: string }) => ({ slug: p.slug }))
}
```

**★ Symptom: a catch-all route prerenders a single page at a URL containing an encoded slash.** Cause: the returned value was a joined string — `{ slug: 'a/1' }` — where a catch-all needs an array of segments. Fix: return the segments themselves.

```tsx
export function generateStaticParams() {
  return [{ slug: ['a', '1'] }, { slug: ['b', '2'] }]
}
```

**★ Symptom: prerendered routes exist for `/product/1` in the build output but requests hit the dynamic path.** Cause: `generateStaticParams` returned numbers where the segment is a string — `{ id: 1 }` rather than `{ id: '1' }`. Route params are strings, always. Fix: stringify at the boundary.

```ts
return posts.map((post: { id: number }) => ({ id: `${post.id}` }))
```

**★ Symptom: `generateStaticParams` never seems to run in `next dev`, so you conclude it is broken.** Cause: documented behaviour — *"During `next dev`, `generateStaticParams` will be called when you navigate to a route."* It is lazy in dev. Fix: nothing to change; verify against `next build`, where it runs *"before the corresponding Layouts or Pages are generated."*

**★ Symptom: the same API is fetched once in `generateStaticParams` and again in the page, and you start plumbing the result between them.** Cause: an assumption that they are independent calls. For `fetch` they are not — the requests are memoized across `generate`-prefixed functions, Layouts, Pages and Server Components. Fix: nothing for `fetch`; for a database client or SDK where `fetch` is not involved, wrap the loader in React's `cache` to get the same deduplication.

```ts title="app/lib/posts.ts"
import { cache } from 'react'
import { db } from './db'

export const getAllPosts = cache(async () => db.post.findMany())
```

**★ Symptom: a build enumerates tens of thousands of pages and takes hours.** Cause: returning the full list because the reference's first example does. The full list is a strategy, not a default. Fix: return the slice that matters and let the tail render on first visit — the docs describe exactly this as *"a subset of paths at build time, and the rest the first time they're visited at runtime."*

```tsx
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts?sort=views').then((r) => r.json())
  return posts.slice(0, 500).map((p: { slug: string }) => ({ slug: p.slug }))
}
```

## Interview questions

**★ What is the difference between omitting `generateStaticParams` and returning an empty array from it?**
Omitting it leaves the route dynamically rendered. Returning `[]` marks the route as statically renderable with zero instances prerendered at build time, so each path is generated on its first visit and can then be revalidated. The docs state the rule directly: *"You must always return an array from `generateStaticParams`, even if it's empty. Otherwise, the route will be dynamically rendered."* An accidental bare `return` on an error path silently converts one into the other, which is a rendering-mode change nobody reviews for.

**★ You publish a new article and ISR is configured. Does it appear, and what decides that?**
`generateStaticParams` is not re-run during revalidation, so the new slug is not in the prerendered set. Whether the URL works is decided by `dynamicParams`: at the default `true` the unlisted path is generated at request time and works; at `false` it 404s. ISR revalidates pages that exist; it does not discover new ones.

**★ Where can `generateStaticParams` live, and what does that imply?**
In `page.tsx`, `layout.tsx` and `route.ts`. The layout case is what makes hierarchical generation possible — a `[category]` layout can enumerate categories while the page below enumerates products — and the Route Handler case is what makes it possible to prerender API responses at build time.

**★ Why does `generateStaticParams` receive `params` synchronously when everything else in the App Router gets a promise?**
Because it does not run in response to a request. It runs at build time to enumerate routes, so the parent values it receives are already resolved. The reference is explicit: *"the params argument can be accessed synchronously and includes only parent segment params."* The "only parent" half matters too — it never sees its own segment, which is the thing it is being asked to produce.

**★ Does a build hit your API twice if both `generateStaticParams` and the page fetch the same list?**
Not for `fetch`: requests are automatically memoized across `generate`-prefixed functions, Layouts, Pages and Server Components for the same data, which the docs name as a build-time speedup. It does hit twice for a database client or an SDK that does not go through `fetch` — the documented substitute there is React's `cache`.

**★ What replaced `getStaticPaths`, and what replaced its `fallback` option?**
`generateStaticParams` replaced `getStaticPaths`, and the `dynamicParams` route segment config replaced `fallback: true | false | blocking` — the reference says so in as many words. The mapping is not one-to-one in spirit: `dynamicParams` is a boolean, and the blocking-versus-non-blocking distinction that `fallback` encoded is handled by the rendering model rather than by the config.

**★ A dynamic route needs to be statically rendered but the path list is not known at build time. What do you do without Cache Components?**
Return an empty array — or set `export const dynamic = 'force-static'`. Both keep the route in the static rendering mode while prerendering nothing, so each path is generated on its first visit and then revalidated on the route's schedule. The empty array is also the documented prerequisite for revalidating paths at runtime at all.

---

← [03c · Typing params](03c-typing-params-with-the-generated-helpers.md) · [Chapter 2 overview](01-explanation.md) · Next → [03e · gSP under Cache Components](03e-generatestaticparams-under-cache-components.md)
