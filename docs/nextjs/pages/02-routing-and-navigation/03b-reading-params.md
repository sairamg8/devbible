---
title: "Every file convention that renders in response to a URL receives params as a promise, exactly two generate-functions still receive it synchronously, and a Client Component has to unwrap it with use() because it cannot await"
sidebar_label: "03b · Reading params"
sidebar_position: 13
description: "Which conventions receive params, why generateStaticParams and generateImageMetadata still get it synchronously, and how use() and useParams read a dynamic segment on the client — including when useParams suspends."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`), [`useParams`](https://nextjs.org/docs/app/api-reference/functions/use-params) (`lastUpdated: 2026-06-09`), [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-08-25`), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated: 2026-08-25`) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md).

**"`params` is a promise" is true of everything that renders in response to a URL and false of exactly two functions, and the asymmetry is not arbitrary: `generateStaticParams` and `generateImageMetadata` do not run during a request render, so there is nothing for them to await. Get that backwards and you do not get a type error — you get an empty destructure or an `[object Promise]` in a filename. On the client the problem is different again: a Client Component cannot be `async`, so the promise has to be unwrapped with `use()`, and the alternative hook `useParams` can suspend and fail a production build that `next dev` passed.**

## Who receives `params`

> *"Dynamic Segments are passed as the `params` prop to `layout`, `page`, `route`, and `generateMetadata` functions."*

All four receive it as a promise in Next.js 16. In a Server Component that means `await`:

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)
  return <article>{post.title}</article>
}

export async function generateMetadata(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return { title: slug.replace(/-/g, ' ') }
}
```

The object contains the segments *"from the root segment down to that page"* — so a page at `app/[locale]/blog/[slug]` receives both `locale` and `slug`, not just the nearest one. Every dynamic ancestor is in there.

## The two functions that still get synchronous `params`

**`generateStaticParams`** receives its *parent's* params, synchronously, and only the parent's:

> *"Notice that the params argument can be accessed synchronously and includes only parent segment params."*

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

**`generateImageMetadata`** likewise — and this one is a trap, because it sits in the same file as a function that *does* receive promises:

> *"Starting with **Next.js 16**, to align with the Async Request APIs change, the image generating function now receives `params` and `id` as promises. The `generateImageMetadata` function continues to receive synchronous `params`."*

```js title="app/shop/[slug]/opengraph-image.js"
export async function generateImageMetadata({ params }) {
  const { slug } = params            // synchronous — do NOT await
  return [{ id: '1' }, { id: '2' }]
}

export default async function Image({ params, id }) {
  const { slug } = await params      // promise
  const imageId = await id           // Promise<string> when generateImageMetadata is used
  // ...
}
```

The rule that makes both memorable: **if the function runs in response to a URL, `params` is a promise; if it runs to enumerate or describe routes, it is not.**

## Reading `params` in a Client Component

A Client Component may not be an `async` function, so the page-level prop is unwrapped with React's `use`:

```tsx title="app/blog/[slug]/page.tsx"
'use client'
import { use } from 'react'

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div>
      <p>{slug}</p>
    </div>
  )
}
```

Deeper in the client tree, where the prop was never passed down, the hook reads the same values:

```tsx title="app/blog/[slug]/breadcrumb.tsx"
'use client'
import { useParams } from 'next/navigation'

export function Breadcrumb() {
  const params = useParams<{ tag: string; item: string }>()
  return (
    <nav aria-label="Breadcrumb">
      {params.tag} / {params.item}
    </nav>
  )
}
```

`useParams` returns the resolved object, not a promise, and its values follow the same shape rules as the prop:

> *"The properties value will either be a `string` or array of `string`'s depending on the type of dynamic segment."*
>
> *"If the route contains no dynamic parameters, `useParams` returns an empty object."*

| Route | URL | `useParams()` |
|---|---|---|
| `app/shop/page.js` | `/shop` | `{}` |
| `app/shop/[slug]/page.js` | `/shop/1` | `{ slug: '1' }` |
| `app/shop/[tag]/[item]/page.js` | `/shop/1/2` | `{ tag: '1', item: '2' }` |
| `app/shop/[...slug]/page.js` | `/shop/1/2` | `{ slug: ['1', '2'] }` |

⚠️ **In the Pages Router it behaves differently** — *"If used in Pages Router, `useParams` will return `null` on the initial render and updates with properties following the rules above once the router is ready."* Code copied between routers must handle that null.

### `useParams` and Cache Components

The hook is not free under `cacheComponents`. The doc splits it cleanly:

> *"**Static routes and routes with `generateStaticParams`**: every dynamic param is known at build time. `useParams` resolves on the server and no `Suspense` boundary is required."*
>
> *"**Routes with dynamic params not covered by `generateStaticParams`**: the param is not known until request time. `useParams` suspends. Wrap the component (or a parent) in a `Suspense` boundary so its fallback can be rendered during prerendering; otherwise, the build fails."*

```tsx title="app/blog/[slug]/page.tsx"
import { Suspense } from 'react'
import { Breadcrumb } from './breadcrumb'

export default function Page() {
  return (
    <Suspense fallback={<nav aria-label="Breadcrumb">…</nav>}>
      <Breadcrumb />
    </Suspense>
  )
}
```

## Reading a param without the prop at all

If the segment sits above the root layout it is a root parameter, and there is a third way to read it: an importable async getter, callable from any Server Component with no prop-drilling. That is [11 · Root params](11-root-params.md); its four hard restrictions (Client Components, Server Actions, `unstable_cache`, and — for now — Route Handlers) are in [11b · Root params: restrictions and typing](11b-root-params-restrictions-and-typing.md). The `params` prop keeps working unchanged; the getter is an addition, not a replacement.

Typing any of this — `PageProps`, `LayoutProps`, `RouteContext`, and narrowing a `string` param to a known set — is [03c · Typing params with the generated helpers](03c-typing-params-with-the-generated-helpers.md).

## Gotchas

**★ Symptom: `async/await is not yet supported in Client Components`.** Cause: a Client Component may not be an async function, but `params` is still a promise. Fix: unwrap it with `use()`, the React API designed for exactly this.

```tsx
'use client'
import { use } from 'react'

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <p>{slug}</p>
}
```

**★ Symptom: a Client Component using `useParams` fails the production build with a prerender error, but works in `next dev`.** Cause: with Cache Components enabled, on a route whose params are not covered by `generateStaticParams` the params are request-time data and `useParams` suspends; dev renders on demand and never runs the prerender validation. Fix: wrap the component or a parent in `Suspense` — or give the route a `generateStaticParams`, which makes the params build-time-known and removes the need for a boundary entirely.

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<span>…</span>}>
      <Breadcrumb />
    </Suspense>
  )
}
```

**★ Symptom: `useParams()` returns `null` and every property access throws — but only in one part of the codebase.** Cause: that part is still Pages Router, where the hook *"will return `null` on the initial render"*. Fix: guard, or move the component; do not assume App Router semantics in code shared between routers.

```tsx
'use client'
import { useParams } from 'next/navigation'

export function Breadcrumb() {
  const params = useParams<{ slug: string }>()
  if (!params) return null      // Pages Router first render
  return <nav>{params.slug}</nav>
}
```

**★ Symptom: an OG image filename or URL contains `[object Promise]` after upgrading to 16.** Cause: `generateImageMetadata` still receives synchronous `params`, while the `Image` function in the same file now receives `params` **and** `id` as promises. Two functions, one file, two different rules. Fix: await inside `Image` only.

```js title="app/shop/[slug]/opengraph-image.js"
export async function generateImageMetadata({ params }) {
  const { slug } = params          // sync
  return [{ id: 'wide' }, { id: 'square' }]
}

export default async function Image({ params, id }) {
  const { slug } = await params
  const imageId = await id
  // ... build the image from slug and imageId
}
```

**★ Symptom: `await params` inside `generateStaticParams` yields an empty object, or TypeScript rejects the await.** Cause: `generateStaticParams` is the other synchronous exception, and it only ever sees the *parent* segments — never its own. Fix: destructure directly.

```ts
export async function generateStaticParams({
  params: { category },
}: {
  params: { category: string }
}) {
  const products = await getProducts(category)
  return products.map((p) => ({ product: p.id }))
}
```

**★ Symptom: `props.params` on a nested page contains more keys than you declared.** Cause: `params` is *"an object containing the dynamic route parameters from the root segment down to that page"* — every dynamic ancestor is included, not just the closest. Fix: nothing to repair; destructure what you need, and type the props with the full route literal so the extra keys are known rather than a surprise.

```tsx title="app/[locale]/blog/[slug]/page.tsx"
export default async function Page(props: PageProps<'/[locale]/blog/[slug]'>) {
  const { locale, slug } = await props.params
  return <Article locale={locale} slug={slug} />
}
```

**★ Symptom: a deeply nested Server Component needs the locale and you are drilling `lang` through six components.** Cause: `params` is a prop, and props travel by prop-drilling. Fix: if the segment is above the root layout, import the getter instead — that is exactly what `next/root-params` exists for. If it is *not* above the root layout there is no getter, and drilling (or a client-side context provider) is the honest answer.

```tsx title="app/[lang]/lib/pricing.ts"
import { lang } from 'next/root-params'

export async function formatPrice(cents: number) {
  const locale = await lang()
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
```

**★ Symptom: a Server Component awaits `params` and a sibling Client Component reads `useParams`, and they disagree during a navigation.** Cause: they are two different sources — the prop is the value for the render that produced this tree, while the hook reads the client router's current params. Fix: if a client subtree must agree with the server render, pass the value down as a prop rather than re-reading it from the hook.

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <Interactive slug={slug} />   // one source of truth
}
```

## Interview questions

**★ How do you read a dynamic segment inside a Client Component, and what are the two ways?**
If the Client Component *is* the page, it receives `params` as a prop and unwraps it with React's `use()` — it cannot `await`, because Client Components may not be async functions. Anywhere else in the client tree, `useParams()` from `next/navigation` returns the already-resolved object. Under Cache Components, `useParams` suspends on routes whose params are not covered by `generateStaticParams`, so it needs a Suspense boundary or the build fails.

**★ Which functions receive `params` synchronously, and why is that not an inconsistency?**
`generateStaticParams` and `generateImageMetadata`. Neither runs during a request render: `generateStaticParams` runs at build time enumerating routes, and `generateImageMetadata` runs to describe the images a segment will produce. The values they see are already known when they are called, so there is nothing to await. Everything that renders *in response to a URL* — `layout`, `page`, `route`, `generateMetadata`, and the image-generating function itself — gets the promise.

**★ You have `app/[locale]/blog/[slug]/page.tsx`. What keys are in `params`?**
Both `locale` and `slug`. The prop is *"an object containing the dynamic route parameters from the root segment down to that page"* — every dynamic ancestor, not merely the nearest one. This is why the route literal matters when typing it: guessing at `{ slug: string }` silently drops one.

**★ Why does `useParams` in the Pages Router need a null check when the App Router version does not?**
Because the Pages Router populates the router asynchronously: the documented behaviour is that it *"will return `null` on the initial render and updates with properties following the rules above once the router is ready."* In the App Router the params are part of the render itself, so there is no window in which they are unavailable. A shared component library used across both routers has to handle the null.

**★ When would you reach for `next/root-params` instead of the `params` prop?**
When the segment is above the root layout and the value is needed somewhere props do not naturally reach — a shared data-fetching utility, a deeply nested Server Component, a `'use cache'` function whose key should depend on it. The prop still works; the getter removes the drilling. It is unavailable in Client Components, Server Actions, `unstable_cache` and (today) Route Handlers, so it does not replace the prop everywhere.

**★ Under Cache Components, when does `useParams` *not* need a Suspense boundary?**
On static routes, and on dynamic routes that have a `generateStaticParams` covering the params being rendered — in both cases every param is known at build time, so the hook resolves on the server during prerendering. It is only the request-time params, not covered by `generateStaticParams`, that suspend. That makes `generateStaticParams` a boundary-removal tool as well as a prerendering tool.

**★ A page awaits `params` and a nested Client Component also calls `useParams`. Is that a problem?**
It is duplication with two sources of truth: the prop reflects the render that produced the tree, the hook reflects the client router's current state. In the steady state they agree, but during a navigation they need not, and debugging the divergence is unpleasant. Pass the value down as a prop when a client subtree must be consistent with the server render, and reserve `useParams` for components that are genuinely route-agnostic and reusable across routes.

---

← [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md) · [Chapter 2 overview](01-explanation.md) · Next → [03c · Typing params with the generated helpers](03c-typing-params-with-the-generated-helpers.md)
