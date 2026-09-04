---
title: "Two nested dynamic segments multiply, and the framework will happily prerender the cross product — top-down enumeration is one query per parent, bottom-up is one query total, and a catch-all route has no natural upper bound at all"
sidebar_label: "02c · Nested segments and combinatorics"
sidebar_position: 13
description: "Nested dynamic segments at scale: top-down versus bottom-up enumeration, the cross-product bug, catch-all routes with no bound, and why params can be generated above the current segment but never below."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (docs `lastUpdated` 2026-08-25) and [Incremental Static Regeneration with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components) (`lastUpdated` 2026-08-03).
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run** — `next` is not installed in this checkout. Path counts on this page are arithmetic on the documented execution rule, not measurements.

**A single dynamic segment gives you a list. Two nested dynamic segments give you a product, and the framework does not stop you prerendering all of it. The rule that governs the whole page is one documented sentence — *"the child `generateStaticParams` function is executed once for each set of `params` the parent generates"* — and it has two consequences people meet in the wrong order. The first is that the number of *calls* to your child function equals the number of parent params, so top-down enumeration issues N+1 queries where bottom-up issues one. The second, and the expensive one, is that if the child ignores the parent params it was handed, it returns the same list for every parent and you have just asked `next build` to render the full cross product — most of which is URLs that do not correspond to anything.**

## The rule, and the constraint on where params can come from

> *"You can generate params for dynamic segments above the current layout or page, but **not below**."*

> *"If multiple dynamic segments in a route use `generateStaticParams`, the child `generateStaticParams` function is executed once for each set of `params` the parent generates."*

> *"Notice that the params argument can be accessed synchronously and includes only parent segment params."*
> — [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)

For `app/products/[category]/[product]`:

- `app/products/[category]/[product]/page.tsx` can generate params for **both** `[category]` and `[product]`.
- `app/products/[category]/layout.tsx` can **only** generate params for `[category]`.

That asymmetry is why there are exactly two enumeration shapes, and why choosing between them is a real decision rather than a style preference.

## Bottom-up: one query, one join, one array

The leaf returns fully-populated param objects. Nothing above it enumerates.

```tsx
// app/products/[category]/[product]/page.tsx
import { getPool } from '@/lib/db'

const PRERENDER_CAP = Number(process.env.PRERENDER_CAP ?? 800)

export async function generateStaticParams() {
  const { rows } = await getPool().query<{ category: string; product: string }>(
    `SELECT c.slug AS category, p.slug AS product
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'live'
      ORDER BY p.view_count_30d DESC, p.slug ASC
      LIMIT $1`,
    [PRERENDER_CAP]
  )
  return rows.map((row) => ({ category: row.category, product: row.product }))
}
```

**Why this is the default choice at scale.** One round trip. One `LIMIT`, which means one number bounds the entire prerender set for the route — the property [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) argued you need. And the pairs are exactly the pairs that exist in your data, so no impossible URL is ever generated.

**Why you might not.** It cannot rank *within* a category. `LIMIT 800` globally means a category with heavy traffic can consume the whole budget and a smaller one gets nothing prerendered. If you want "the top 20 products in each of the top 40 categories", you need the parent to enumerate first.

## Top-down: N+1 calls, and the ability to shape the budget per parent

The parent layout enumerates categories; the child is invoked once per category and receives them.

```tsx
// app/products/[category]/layout.tsx
import { getPool } from '@/lib/db'

export async function generateStaticParams() {
  const { rows } = await getPool().query<{ slug: string }>(
    `SELECT slug FROM categories
      WHERE is_active
      ORDER BY view_count_30d DESC, slug ASC
      LIMIT 40`
  )
  return rows.map((row) => ({ category: row.slug }))
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return <section className="category">{children}</section>
}
```

```tsx
// app/products/[category]/[product]/page.tsx
import { getPool } from '@/lib/db'

export async function generateStaticParams({
  params,
}: {
  params: { category: string }
}) {
  const { rows } = await getPool().query<{ slug: string }>(
    `SELECT p.slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE c.slug = $1
        AND p.status = 'live'
      ORDER BY p.view_count_30d DESC, p.slug ASC
      LIMIT 20`,
    [params.category]
  )
  return rows.map((row) => ({ product: row.slug }))
}
```

Forty categories means **forty-one queries** — one for the parent, forty for the children — and a bounded 40 × 20 = 800 prerendered products, evenly distributed. That even distribution is the entire reason to accept N+1. If you do not need it, use bottom-up.

The typed form of the parameter, from the docs, avoids hand-writing the shape:

```ts
// app/products/[category]/[product]/page.tsx
export async function generateStaticParams({
  params: { category },
}: {
  params: Awaited<LayoutProps<'/products/[category]'>['params']>
}) {
  // ... same query as above, using `category`
}
```

## 🔴 The cross-product bug

Here is the version that ships, passes review, and then makes the build take an hour:

```tsx
// app/products/[category]/[product]/page.tsx — 🔴 BROKEN AT SCALE
export async function generateStaticParams() {
  const { rows } = await getPool().query<{ slug: string }>(
    `SELECT slug FROM products WHERE status = 'live'`
  )
  return rows.map((row) => ({ product: row.slug }))
}
```

The signature takes no `params`, so it ignores the parent entirely and returns **every** product for **every** category. With 40 categories and 10,000 products that is 400,000 prerendered routes, of which at most 10,000 correspond to a product that is actually in that category. The other 390,000 are URLs like `/products/laptops/garden-hose`, each of which was rendered, stored and deployed — and each of which either 404s from your own data layer or, worse, renders a product page under a category it does not belong to, which search engines will index as duplicate content.

**The tell in code review is the missing parameter.** A child `generateStaticParams` under a dynamic parent that does not destructure `params` is either a bug or a deliberate cross product, and deliberate cross products are rare enough to justify a comment:

```tsx
// Deliberate: every locale × every legal document. 6 × 4 = 24 pages, all valid.
export async function generateStaticParams() {
  return LOCALES.flatMap((locale) => LEGAL_DOCS.map((doc) => ({ locale, doc })))
}
```

**The tell in the build output** is a path count that is suspiciously close to the product of two table sizes.

## Three levels multiply again

`app/[org]/[project]/[issue]` is a shape a B2B product reaches within a year, and the arithmetic is unforgiving: 200 organisations × 30 projects × 500 issues is 3,000,000 prerendered routes if you enumerate all three levels. Nothing in the framework objects.

At three levels, complete enumeration is essentially never right, for a reason that has nothing to do with build time: **most of that content is behind authentication**, so it cannot be prerendered anyway — a route that reads `cookies()` is not static, and forcing it static via `force-static` makes `cookies()` return empty values, which silently renders the logged-out branch for everyone (see [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md)). The correct enumeration for a nested authenticated route is usually **none of the leaf level**: enumerate the public shell, leave the tenant-specific interior dynamic or cached per tenant.

## Catch-all segments have no natural bound

A catch-all takes an array:

| Route | Return type |
|---|---|
| `/product/[id]` | `{ id: string }[]` |
| `/products/[category]/[product]` | `{ category: string, product: string }[]` |
| `/products/[...slug]` | `{ slug: string[] }[]` |

```tsx
// app/docs/[...slug]/page.tsx
export function generateStaticParams() {
  return [
    { slug: ['getting-started'] },
    { slug: ['guides', 'deployment'] },
    { slug: ['guides', 'deployment', 'docker'] },
  ]
}
```

The difference that matters: `[category]/[product]` has a shape that bounds it — two segments, and the data tells you which pairs exist. `[...slug]` does not. Its param space is *every path of every depth*, and only your own enumeration decides what is in it. That is fine when the tree is a real tree (a docs site walks its own file structure and gets a finite, correct list). It goes wrong when the catch-all is used as a router for a flat namespace with computed prefixes, because "all valid combinations" then has no closed form and somebody writes a nested loop.

⚠️ **`dynamicParams = false` behaves differently on a catch-all.** The documented sentence is that unspecified routes *"will 404 or match (in the case of catch-all routes)"*. The docs do not expand on what "match" means for a catch-all beyond that clause, so this page will not either — verify the behaviour for your own route rather than assuming it 404s.

## What happens when the path set changes between builds

Three cases, and only two are documented.

**A path was added after the build.** Documented, step 7 of the ISR walkthrough: *"If `/blog/26` is requested, and it exists, the page will be generated on-demand. This behavior can be changed by using a different `dynamicParams` value. However, if the post does not exist, then 404 is returned."* Combined with the rule that ISR never re-runs enumeration, this is the whole story of the CMS-post-published-after-deploy case: it works, on demand, at the first visitor's expense — unless you set `dynamicParams = false`, in which case it 404s until the next build.

**A path was never in the data.** Documented: 404, from your own `notFound()` or from the absent record.

**🔴 A path was prerendered at build time and then deleted from the source of truth.** ⚠️ **The documentation does not settle this.** The cache entry exists; enumeration will not re-run to remove it; whether and when the deleted page stops being served depends on the interaction between the cached entry, the `revalidate` window and your cache handler, and none of the pages consulted states it. **Do not rely on deletion propagating on its own.** Do the thing that works regardless of the answer: call `revalidatePath('/blog/' + slug)` in the same transaction-adjacent code path that deletes the record, so the invalidation is explicit rather than inferred.

```ts
// app/actions/delete-post.ts
'use server'

import { revalidatePath } from 'next/cache'
import { getPool } from '@/lib/db'

export async function deletePost(slug: string) {
  await getPool().query('DELETE FROM posts WHERE slug = $1', [slug])
  // Explicit: do not rely on the prerendered entry ageing out on its own.
  revalidatePath(`/blog/${slug}`)
  revalidatePath('/blog')
}
```

**A path was renamed.** This is the deletion case plus the addition case, and it is worse than either: the old URL has a prerendered entry that may keep serving, and the new URL has none. Invalidate the old path explicitly and add a redirect; a rename is a routing change, not a content change.

## Gotchas

**★ Symptom: the build renders hundreds of thousands of routes and most of them are nonsense combinations.** Cause: a child `generateStaticParams` under a dynamic parent that does not accept `params`, so it returns the same full list for every parent — the cross product. Fix: take the parent param and filter by it:

```tsx
export async function generateStaticParams({ params }: { params: { category: string } }) {
  const { rows } = await getPool().query(
    `SELECT p.slug FROM products p JOIN categories c ON c.id = p.category_id
      WHERE c.slug = $1 AND p.status = 'live' ORDER BY p.view_count_30d DESC, p.slug ASC LIMIT 20`,
    [params.category]
  )
  return rows.map((row) => ({ product: row.slug }))
}
```

**★ Symptom: you moved from bottom-up to top-down and the number of database queries exploded.** Cause: the documented execution rule — the child runs once per parent param set. Forty categories is forty child invocations. It is not a bug, it is the price of per-parent budgeting. Fix: if you did not need per-parent ranking, go back to a single joined query at the leaf; if you did, make each child query cheap and indexed, since it now runs N times in a row during the build.

**★ Symptom: a nested `generateStaticParams` cannot see the param it needs.** Cause: params flow downward only — *"You can generate params for dynamic segments above the current layout or page, but not below."* A layout at `[category]` has no way to know about `[product]`. Fix: move the enumeration to the leaf and return both params from there, or read a parent root parameter via `next/root-params`, which the docs explicitly allow inside a nested `generateStaticParams`.

**★ Symptom: search console reports thousands of duplicate pages under different categories.** Cause: the cross product again, but the version where the page renders successfully instead of 404ing, because the data layer looks the product up by slug alone and never checks it belongs to the category in the URL. Fix: validate the pair in the page and `notFound()` when it does not hold — and fix the enumeration, because a `notFound()` on 390,000 prerendered routes still cost you the build time and the storage.

**Symptom: a deleted product keeps being served.** Cause: nothing re-runs enumeration to retract a prerendered path, and the docs do not state how a build-time prerender for a now-deleted record ages out. Fix: invalidate explicitly at the deletion site with `revalidatePath`, as above. Treat any behaviour you observe as unspecified rather than as a contract.

**Symptom: a slug rename left the old URL working and the new one slow.** Cause: the old path has a prerendered entry, the new one does not and will not until the next build. Fix: on rename, `revalidatePath` the old path, add a permanent redirect from old to new, and let the new path generate on demand.

**Symptom: three nested dynamic segments and `next build` runs out of memory.** Cause: complete enumeration of a product of three sets, which grows faster than anyone's intuition. Fix: stop enumerating the leaf level. In an authenticated B2B route the leaf usually cannot be static anyway, because it reads request-time state — and forcing it static with `force-static` does not error, it blanks `cookies()` and `headers()` and serves the logged-out branch to everyone.

**Symptom: a catch-all route's enumeration keeps growing and nobody can say what the correct list is.** Cause: `[...slug]` has no shape-imposed bound; the valid set is whatever you say it is. Fix: derive it from a real tree — the filesystem, a CMS's navigation structure, a sitemap — so the list has a source of truth. If the valid set has no closed form, that is a signal the catch-all is being used as a general router and the paths should be enumerated from actual content, not generated combinatorially.

## Interview questions

**★ Top-down or bottom-up enumeration — how do you choose?**
By whether you need to budget per parent. Bottom-up is one joined query at the leaf returning fully-populated param objects; it is one round trip and one `LIMIT` bounding the whole route, which is what you want by default. Its limitation is that a global `LIMIT` cannot guarantee coverage inside each parent — one high-traffic category can consume the entire budget. Top-down enumerates parents first and, per the documented rule, the child then runs once per parent param set, so you can apply a per-parent limit like "top 20 products in each of the top 40 categories". You pay N+1 queries for that. If you do not need the even distribution, N+1 buys you nothing.

**★ What is the cross-product bug and how do you spot it in review?**
A child `generateStaticParams` under a dynamic parent that ignores the `params` it is handed. Because the framework invokes it once per parent param set and it returns the same full list every time, the build enumerates the full cross product — every product under every category. Forty categories and ten thousand products becomes four hundred thousand routes, and roughly 97% of them are URLs that do not correspond to anything. In review, the tell is the function signature: no destructured `params` under a dynamic parent. In the build output, the tell is a path count close to the product of two table sizes. And the pages that render successfully are worse than the ones that 404, because those get indexed as duplicate content.

**★ Why does `generateStaticParams` refuse to generate params for segments below the current one?**
Because the render is driven top-down and a parent segment must be renderable without knowing what is beneath it — a layout at `[category]` is shared by every `[product]` under it, so "which products exist" is not information it needs or can act on. The documented rule is flat: params can be generated for segments above the current layout or page, but not below, and the `params` argument *"includes only parent segment params."* Practically, this means the deepest segment that knows the full path is the leaf, which is why the bottom-up shape returns complete param objects from `page.tsx` and the top-down shape has to be assembled one level at a time.

**★ A post is published in the CMS an hour after the deploy. What does a visitor to its URL get?**
With `dynamicParams` at its default, the page is generated on demand at the first request and cached for subsequent ones — the ISR guide states this explicitly, and adds that a URL for a post that does not exist returns 404. With `dynamicParams = false`, that same URL 404s until the next build, because only enumerated paths are served. What does *not* happen in either case is rediscovery: `generateStaticParams` is not called again during revalidation, so no amount of waiting or revalidating will make the framework notice a new slug. Discovering paths is a build activity; ISR refreshes content for paths already known.

**A product is deleted. What happens to its prerendered page?**
This is the one I would not answer confidently from the documentation, and I would say so. The docs cover a path added after the build and a path that never existed; they do not state what happens to a build-time prerender whose underlying record is later deleted. The cache entry exists, enumeration will not re-run to retract it, and the outcome depends on the revalidate window and the cache handler. So the engineering answer is not to depend on it: call `revalidatePath` for that URL in the same code path that performs the deletion, which makes the invalidation explicit and correct regardless of what the default behaviour turns out to be.

**Why is complete enumeration almost always wrong for `app/[org]/[project]/[issue]`?**
Two reasons, and the second matters more. The arithmetic is the obvious one: three nested levels multiply, so a few hundred organisations with a few dozen projects each and a few hundred issues each is millions of routes, which no build should attempt. The real reason is that that content is authenticated. A route that reads request-time state is not static, so there is nothing to prerender; and the flag that appears to make it static, `force-static`, does not error — it blanks `cookies()` and `headers()`, so the prerender takes the logged-out branch and you ship that HTML to everyone. The right enumeration for a nested authenticated route is usually none at the leaf level at all.

---

← [02b · Enumerating from a database](02b-enumerating-from-a-database-at-build-time.md) · [Chapter index](01-explanation.md) · Next → [02d · What Cache Components changes](02d-when-the-path-set-changes-and-what-cache-components-changes.md)
