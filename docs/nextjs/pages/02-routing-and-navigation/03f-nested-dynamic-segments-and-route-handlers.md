---
title: "A segment can generate params for itself and its ancestors but never its descendants, which is the whole reason there are two shapes for a nested route — one flat query on the page, or one enumeration per parent value"
sidebar_label: "03f · Nested dynamic segments"
sidebar_position: 124
description: "Generating params for multiple dynamic segments top-down and bottom-up, why the child function runs once per parent value, reading a root param inside a nested generateStaticParams, and prerendering Route Handler responses."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated: 2026-08-25`) and [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [03d · generateStaticParams](03d-generatestaticparams-strategies.md).

**`app/products/[category]/[product]` has two dynamic segments and exactly one rule that decides how you enumerate them: a segment can generate params for itself and everything above it, never anything below. That leaves two legal shapes. Bottom-up puts one function on the page and returns both keys from a single query. Top-down puts one on each level, and the child is then invoked once for every value the parent produced — which is honest about the hierarchy and multiplies your build-time queries by the parent's cardinality. Neither is the default answer; the cardinality of the parent is.**

## Multiple dynamic segments

The constraint that decides where the function goes:

> *"You can generate params for dynamic segments above the current layout or page, but **not below**. For example, given the `app/products/[category]/[product]` route: `app/products/[category]/[product]/page.js` can generate params for **both** `[category]` and `[product]`. `app/products/[category]/layout.js` can **only** generate params for `[category]`."*

**Bottom-up** — one function on the page, both keys, one flat list:

```tsx title="app/products/[category]/[product]/page.tsx"
export async function generateStaticParams() {
  const products = await fetch('https://.../products').then((res) => res.json())

  return products.map((product: { category: { slug: string }; id: string }) => ({
    category: product.category.slug,
    product: product.id,
  }))
}
```

**Top-down** — the parent enumerates categories, the child is invoked once per category and receives it:

```tsx title="app/products/[category]/layout.tsx"
export async function generateStaticParams() {
  const products = await fetch('https://.../products').then((res) => res.json())
  return products.map((product: { category: { slug: string } }) => ({
    category: product.category.slug,
  }))
}
```

```tsx title="app/products/[category]/[product]/page.tsx"
export async function generateStaticParams({
  params: { category },
}: {
  params: { category: string }
}) {
  const products = await fetch(
    `https://.../products?category=${category}`
  ).then((res) => res.json())

  return products.map((product: { id: string }) => ({ product: product.id }))
}
```

> *"A child route segment's `generateStaticParams` function is executed once for each segment a parent `generateStaticParams` generates."*

That multiplication is the price of top-down: 200 categories means 200 invocations of the child, each with its own query. Bottom-up trades that for a single query that has to span both levels. Typing the child's argument (it needs `Awaited<...>`) is in [03c · Typing params](03c-typing-params-with-the-generated-helpers.md).

### Choosing between them

| | Bottom-up (one function on the page) | Top-down (one per level) |
|---|---|---|
| Build-time queries | 1 | 1 + N, where N is the parent's cardinality |
| Data source | must span both levels in one query | each level queries its own source |
| Parent enumerated independently | no — the parent's set is implied by the pages | yes, the layout owns it |
| Good when | the parent has high cardinality, or one API already returns the join | the parent set is small and stable, or the two levels come from different systems |

The deciding number is the parent's cardinality, not the elegance of the file layout. Ten locales times one child query is nothing; ten thousand tenant slugs times one child query is a build that never finishes.

### When the parent is a root param, read the getter instead

> *"**Good to know:** When a parent dynamic segment is a root parameter, you can also read it inside a nested `generateStaticParams` by calling its getter from the `next/root-params` module."*

```tsx title="app/[lang]/posts/[slug]/page.tsx"
import { lang } from 'next/root-params'

export async function generateStaticParams() {
  const language = await lang()
  const posts = await fetch(
    `https://api.example.com/posts?lang=${language}`
  ).then((res) => res.json())
  return posts.map((post: { slug: string }) => ({ slug: post.slug }))
}
```

This is still top-down — the child runs once per `lang` the root layout generated — but the value arrives through the import rather than the argument, which means intermediate segments do not have to pass anything along. The full story is [11 · Root params](11-root-params.md).

## With Route Handlers

The same function statically generates API responses:

```ts title="app/api/posts/[id]/route.ts"
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }, { id: '3' }]
}

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/posts/[id]'>
) {
  const { id } = await params
  // This will be statically generated for IDs 1, 2, and 3
  return Response.json({ id, title: `Post ${id}` })
}
```

> *"In this example, route handlers for all blog post IDs returned by `generateStaticParams` will be statically generated at build time. Requests to other IDs will be handled dynamically at request time."*

Under Cache Components the documented shape passes the **promise** into the cached function rather than awaiting first, so the id arrives as one of that function's own arguments:

```ts title="app/api/posts/[id]/route.ts"
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }, { id: '3' }]
}

async function getPost(id: Promise<string>) {
  'use cache'
  const resolvedId = await id
  const response = await fetch(`https://api.example.com/posts/${resolvedId}`)
  return response.json()
}

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/posts/[id]'>
) {
  const post = await getPost(params.then((p) => p.id))
  return Response.json(post)
}
```

## Gotchas

**★ Symptom: build time explodes after moving `generateStaticParams` from the page down into the parent layout.** Cause: top-down generation invokes the child function *once for each parent value*, each with its own data fetch. Fix: if the child query does not genuinely need the parent value, generate bottom-up in a single pass.

```tsx title="app/products/[category]/[product]/page.tsx"
export async function generateStaticParams() {
  const products = await fetch('https://.../products').then((r) => r.json())
  return products.map((p: { category: { slug: string }; id: string }) => ({
    category: p.category.slug,
    product: p.id,
  }))
}
```

**★ Symptom: `generateStaticParams` in a layout cannot enumerate the segment you care about.** Cause: a segment can generate params for itself and its ancestors, never its descendants — *"You can generate params for dynamic segments above the current layout or page, but not below."* Fix: move the function down to the deepest segment involved, or split it across levels and accept the per-parent invocation.

**★ Symptom: a Route Handler under Cache Components serves one id's body for every id.** Cause: the id never reached the cached function as an argument — it was awaited outside and closed over, so nothing distinguishes one call from another. ⚠️ The reference does not spell out the key-derivation rule; what it does is show the shape, and the shape passes the promise in. Fix: follow it literally.

```ts
async function getPost(id: Promise<string>) {
  'use cache'
  const resolvedId = await id
  const response = await fetch(`https://api.example.com/posts/${resolvedId}`)
  return response.json()
}

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/posts/[id]'>
) {
  return Response.json(await getPost(params.then((p) => p.id)))
}
```

**★ Symptom: some category pages prerender and others do not, with no error anywhere.** Cause: the child `generateStaticParams` returned an empty array for those parent values — a category with no products, a locale with no posts. Nothing is wrong from the build's point of view; those routes simply were not enumerated. Fix: decide deliberately what should happen to them via `dynamicParams`, and if a parent with no children should not exist as a URL at all, stop generating the parent.

```tsx title="app/products/[category]/layout.tsx"
export async function generateStaticParams() {
  const categories = await fetch('https://.../categories').then((r) => r.json())
  return categories
    .filter((c: { productCount: number }) => c.productCount > 0)
    .map((c: { slug: string }) => ({ category: c.slug }))
}
```

**★ Symptom: the parent's `generateStaticParams` is on `layout.tsx` and the layout also awaits `params` to render a heading, and prerendering degrades.** Cause: two unrelated concerns in one file — enumerating routes is a build-time job, awaiting `params` at the top of a layout is a request-time dependency. Fix: keep the enumeration where it is and move the value read into a child, as in [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md).

```tsx title="app/products/[category]/layout.tsx"
export async function generateStaticParams() {
  const categories = await fetch('https://.../categories').then((r) => r.json())
  return categories.map((c: { slug: string }) => ({ category: c.slug }))
}

export default function Layout(props: LayoutProps<'/products/[category]'>) {
  return (
    <section>
      <CategoryHeading params={props.params} />
      {props.children}
    </section>
  )
}

async function CategoryHeading({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  return <h1>{category}</h1>
}
```

## Interview questions

**★ Compare generating params top-down and bottom-up for `app/products/[category]/[product]`.**
Bottom-up puts one `generateStaticParams` on the page and returns both keys per route, from a single query. Top-down puts one on the `[category]` layout and one on the page; the child is then *"executed once for each segment a parent `generateStaticParams` generates"*, receiving the parent value as a synchronous argument. Top-down expresses the hierarchy honestly and lets each level own its data source, at the cost of N child invocations; bottom-up is one pass but needs a query spanning both levels.

**★ Why can a layout not generate params for a segment below it?**
The reference states the rule flatly — *"above the current layout or page, but **not below**"* — and does not give a rationale, so the honest answer is that this is a documented constraint rather than a derived one. What follows from it is concrete though: the function has to live at or below the deepest segment you want to enumerate, which is why a page is often the right home even when the data is hierarchical, and why enumerating both levels from a layout is simply not an option.

**★ What actually decides between top-down and bottom-up on a real project?**
The parent's cardinality. Top-down runs the child function once per parent value, so the build cost is `1 + N` queries; with ten locales that is irrelevant and with ten thousand tenant slugs it is fatal. The secondary consideration is where the data lives: if one API already returns the join, bottom-up is a single query and top-down is artificial; if the two levels come from different systems, top-down lets each own its source.

**★ Your `[lang]` segment is above the root layout and a nested `generateStaticParams` needs it. What are your options?**
Either take it from the argument, since a parent's params are passed to a child's `generateStaticParams` synchronously, or import its getter from `next/root-params` and await it. The docs explicitly bless the second inside a nested `generateStaticParams`. The getter version is worth it when intermediate segments would otherwise have to thread the value through for no reason of their own.

**★ Does `generateStaticParams` work for API routes, and what changes under Cache Components?**
Yes — it is supported in `route.ts`, statically generating the responses for the ids you return while other ids are handled dynamically. Under Cache Components the documented pattern passes the `params` promise into a `'use cache'` function and awaits it inside, so the id participates in the cache key. Awaiting before the call resolves the value outside the cached scope, and every id then shares one cache entry.

**★ Why does the documented Route Handler example pass `params.then((p) => p.id)` into the cached function instead of awaiting first?**
Because everything a cached function depends on has to arrive as an argument rather than from the surrounding scope — a value closed over does not distinguish one invocation from another. Passing the promise in keeps the id inside the cached function's own inputs and lets the await happen there. The reference presents this as the shape to use with Route Handlers under Cache Components; it does not document the key-derivation rule itself, so treat "the id is part of the key" as the behaviour the example implies rather than a stated guarantee.

---

← [03e · gSP under Cache Components](03e-generatestaticparams-under-cache-components.md) · [Chapter 2 overview](01-explanation.md) · Next → [03g · dynamicParams and route-matching precedence](03g-dynamicparams-and-route-matching-precedence.md)
