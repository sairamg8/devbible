---
title: "A dynamic segment captures one URL segment, a catch-all captures one or more but never zero, and an optional catch-all is the only form that also matches the bare parent path — and in Next.js 16 every one of them arrives as a Promise you must await"
sidebar_label: "03 · Dynamic routes"
sidebar_position: 3
description: "The exact matching rules for [slug], [...slug] and [[...slug]], the params shape each one produces, and why synchronous params access was removed in Next.js 16 rather than merely deprecated."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**.

**Three bracket forms, three different matching rules, three different `params` shapes — and the difference between them is the difference between a working `/docs` landing page and a 404 nobody notices until launch week. `[slug]` matches exactly one segment and yields a `string`. `[...slug]` matches one *or more* and yields a `string[]`, but refuses the bare parent path. `[[...slug]]` is the only form that also matches the parent, and pays for it by making the value `string[] | undefined`. On top of that, Next.js 16 finished a two-major migration: `params` is a Promise, synchronous access is not deprecated but *removed*, and code that worked under the 15 compatibility shim now throws.**

## The three forms and what each matches

A dynamic segment is a folder whose name is wrapped in square brackets. The reference states the convention directly:

> *"A Dynamic Segment can be created by wrapping a folder's name in square brackets: `[folderName]`."*

Adding an ellipsis inside the brackets extends the match across the remaining segments:

> *"Dynamic Segments can be extended to **catch-all** subsequent segments by adding an ellipsis inside the brackets `[...folderName]`."*
>
> *"For example, `app/shop/[...slug]/page.js` will match `/shop/clothes`, but also `/shop/clothes/tops`, `/shop/clothes/tops/t-shirts`, and so on."*

Doubling the brackets makes the segment itself optional — and this is the single sentence people get wrong:

> *"For example, `app/shop/[[...slug]]/page.js` will **also** match `/shop`, in addition to `/shop/clothes`, `/shop/clothes/tops`, `/shop/clothes/tops/t-shirts`."*
>
> *"The difference between **catch-all** and **optional catch-all** segments is that with optional, the route without the parameter is also matched (`/shop` in the example above)."*

So the ranking is by *minimum segment count*, not by feature richness:

| Form | Minimum segments consumed | Maximum | Matches the bare parent (`/shop`)? |
|---|---:|---|---|
| `[slug]` | 1 | 1 | no |
| `[...slug]` | 1 | unbounded | 🔴 **no** |
| `[[...slug]]` | 0 | unbounded | yes |

The trap is that `[...slug]` reads like "everything under `/shop`" and is not. `/shop` on its own has zero segments left to give the catch-all, so nothing matches it and the request falls through to a 404 unless a sibling `app/shop/page.tsx` exists.

Written out as folders, the three are siblings that cannot coexist at the same path:

```text
app/
  blog/[slug]/page.tsx          →  /blog/hello                (slug: 'hello')
  shop/[...slug]/page.tsx       →  /shop/a, /shop/a/b   but NOT /shop
  docs/[[...slug]]/page.tsx     →  /docs, /docs/a, /docs/a/b
```

## The shape of `params`, per form

The captured values arrive on the `params` prop. The reference tabulates the runtime shapes:

| Route | Example URL | `params` |
|---|---|---|
| `app/blog/[slug]/page.js` | `/blog/a` | `{ slug: 'a' }` |
| `app/shop/[...slug]/page.js` | `/shop/a` | `{ slug: ['a'] }` |
| `app/shop/[...slug]/page.js` | `/shop/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |
| `app/shop/[[...slug]]/page.js` | `/shop` | `{ slug: undefined }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |

🔴 **A single-segment catch-all still gives you an array.** `/shop/a` against `[...slug]` is `['a']`, not `'a'`. Code that calls a string method on it compiles against the wrong mental model and fails on every request.

And the corresponding static types:

| Route | `params` type |
|---|---|
| `app/blog/[slug]/page.js` | `{ slug: string }` |
| `app/shop/[...slug]/page.js` | `{ slug: string[] }` |
| `app/shop/[[...slug]]/page.js` | `{ slug?: string[] }` |
| `app/[categoryId]/[itemId]/page.js` | `{ categoryId: string, itemId: string }` |

The docs are explicit about *why* the types are that wide, and it is a reason worth internalising:

> *"Route `params` values are typed as `string`, `string[]`, or `undefined` (for optional catch-all segments), because their values aren't known until runtime. Users can enter any URL into the address bar, and these broad types help ensure that your application code handles all these possible cases."*

There is no `number`. A route `/product/[id]` visited as `/product/42` gives you the string `'42'`.

## 🔴 `params` is a Promise, and in 16 that is not negotiable

Version 15 made the request-time APIs async and shipped a **temporary** synchronous compatibility layer. Version 16 removed it. From the upgrade guide:

> *"Version 15 introduced Async Request APIs as a breaking change, with **temporary** synchronous compatibility."*
>
> *"Starting with **Next.js 16**, synchronous access is fully removed. These APIs can only be accessed asynchronously."*

The list it removes synchronous access from is worth reading item by item, because it is broader than `page.js`:

> *"`params` in `layout.js`, `page.js`, `route.js`, `default.js`, `opengraph-image`, `twitter-image`, `icon`, and `apple-icon`."*
> *"`searchParams` in `page.js`"*

Alongside `cookies`, `headers` and `draftMode`. Every file convention that can sit inside a dynamic segment is affected at once.

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <div>My Post: {slug}</div>
}
```

The codemod exists and the upgrade guide names it, noting that the general `upgrade` codemod does *not* include it:

> *"The `upgrade` codemod does not run every migration codemod. If your app still uses synchronous `params`, `searchParams`, `cookies()`, `headers()`, or `draftMode()` access from the Next.js 15 compatibility period, also run the async Request APIs codemod"*

```bash
npx @next/codemod@canary next-async-request-api .
```

⚠️ **The Dynamic Route Segments reference itself is stale on this point.** Its Behavior section still reads:

> *"In version 14 and earlier, `params` was a synchronous prop. To help with backwards compatibility, you can still access it synchronously in Next.js 15, but this behavior will be deprecated in the future."*

That sentence describes the 15 shim in the future tense, on a page stamped `version: 16.3.4`. The upgrade guide is the load-bearing statement for 16; treat the reference bullet as historical.

### Why a promise at all

A param is request-time data. Modelling it as a promise lets the framework start rendering the parts of a route that do not depend on it while the value is still unknown — which is what makes a static shell possible for a dynamic route. A synchronous prop forces the entire tree to wait for the URL. That trade shows up immediately in layouts, and the docs give the rule:

> *"In layouts, avoid awaiting `params` at the top level. Doing so prevents the layout from being prerendered. Instead, pass the params promise down to the component that needs it and await there."*

## Where this goes next

- Unwrapping `params` in Client Components, the two functions that still receive it synchronously, and the `PageProps` / `LayoutProps` / `RouteContext` typegen helpers: [03b · Reading params](03b-reading-params.md).
- Telling the build which values a segment can take, and what that costs: [03d · generateStaticParams](03d-generatestaticparams-strategies.md), then [03e · gSP under Cache Components](03e-generatestaticparams-under-cache-components.md) and [03f · Nested dynamic segments](03f-nested-dynamic-segments-and-route-handlers.md).
- What happens to the values you did *not* prerender, and how a static segment and a dynamic segment compete for the same URL: [03g · dynamicParams and route-matching precedence](03g-dynamicparams-and-route-matching-precedence.md).
- A dynamic segment placed *above* the root layout is a different animal: *"Dynamic segments that appear before the root layout are **root parameters**, which can additionally be read from any Server Component with `next/root-params`."* That is [11 · Root params](11-root-params.md), with its restrictions in [11b · Root params: restrictions and typing](11b-root-params-restrictions-and-typing.md). Nothing on this page changes for a root param — `props.params` still works exactly as described; you simply gain a second way to read it.

## Gotchas

**★ Symptom: `/docs` 404s but `/docs/intro` works.** Cause: you used `docs/[...slug]/page.tsx`. A catch-all needs at least one segment to capture, and the bare parent path offers none. Fix: use the optional form, which is the only one that matches the parent.

```tsx title="app/docs/[[...slug]]/page.tsx"
export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const { slug } = await props.params
  const path = slug?.join('/') ?? 'index'
  return <article>{path}</article>
}
```

**★ Symptom: `Cannot read properties of undefined (reading 'join')` on the landing page only.** Cause: an optional catch-all yields `{ slug: undefined }` for the bare parent path, and every other URL yields an array — so the bug appears at exactly one URL and survives every smoke test that visits a real article. Fix: never reach for the array without a default.

```tsx
const { slug } = await props.params
const segments = slug ?? []          // not `slug || []` if '' is meaningful
const path = segments.join('/')
```

**★ Symptom: `slug.toLowerCase is not a function` on a catch-all route with one segment.** Cause: a catch-all is always an array, even when it captured a single segment — `/shop/a` is `['a']`. Fix: treat it as a path, and join or index explicitly.

```tsx title="app/shop/[...slug]/page.tsx"
export default async function Page(props: PageProps<'/shop/[...slug]'>) {
  const { slug } = await props.params
  const [category, ...rest] = slug        // category is the string you wanted
  return <Catalogue category={category} filters={rest} />
}
```

**★ Symptom: `params.slug` is `undefined` even though the URL clearly has a slug, and logging `params` prints a Promise.** Cause: Next.js 16 removed the synchronous compatibility shim; the object you destructured is the promise, not its value. Fix: `await` it — and for a whole codebase, run the codemod rather than hand-editing.

```tsx
// broken under 16
export default function Page({ params }: any) {
  return <h1>{params.slug}</h1>
}

// correct
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>{slug}</h1>
}
```

**★ Symptom: a blog post — or the Dynamic Route Segments reference itself — says synchronous access is merely "deprecated in the future".** Cause: the reference page's Behavior bullet describes the Next.js 15 compatibility window and was not rewritten when 16 removed it. Fix: trust the version-16 upgrade guide — *"Starting with Next.js 16, synchronous access is fully removed"* — and prove it on your own codebase by running the codemod, which is a no-op on already-migrated code.

```bash
npx @next/codemod@canary next-async-request-api .
```

**★ Symptom: a layout that awaits `params` stops being prerendered under Cache Components.** Cause: awaiting at the top level of the layout makes the whole layout depend on request-time data, so nothing above the await can be emitted into a static shell. Fix: hand the promise itself to the child that needs it.

```tsx title="app/[team]/layout.tsx"
export default function Layout(props: LayoutProps<'/[team]'>) {
  return (
    <section>
      <TeamBadge params={props.params} />
      {props.children}
    </section>
  )
}

async function TeamBadge({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params
  return <span>{team}</span>
}
```

**★ Symptom: `/en` renders nothing while `/en/docs/routing` works, on `app/[locale]/[...path]/page.tsx`.** Cause: the catch-all sits *below* the locale, so the locale route on its own has no segment for `path` to capture. Fix: give the locale its own page, or make the catch-all optional — the two are not equivalent, because the optional form puts the landing page and every article through the same component.

```text
app/[locale]/page.tsx            ← a distinct landing page
app/[locale]/[...path]/page.tsx  ← articles

# or, one component for both:
app/[locale]/[[...path]]/page.tsx
```

## Interview questions

**★ What is the difference between `[...slug]` and `[[...slug]]`, in one sentence, and why does it matter in practice?**
The optional form also matches the route without the parameter — `app/shop/[[...slug]]/page.js` matches `/shop` as well as `/shop/a/b`, while `app/shop/[...slug]/page.js` matches only the latter. In practice that is the difference between a documentation site whose index page works and one where `/docs` 404s while every article under it renders. The cost of the optional form is that `params.slug` becomes `string[] | undefined` rather than `string[]`, so every consumer has to handle the missing case.

**★ A colleague says "catch-all matches everything under `/shop`". What is wrong with that description?**
It matches everything *below* `/shop` but not `/shop` itself, because a catch-all needs at least one segment to capture. "Everything under" is exactly the ambiguity that hides the bug. If you want the parent too, either add a sibling `app/shop/page.tsx` or switch to the optional catch-all.

**★ `params` is a Promise. Was that a deprecation or a removal in Next.js 16?**
A removal. Next.js 15 introduced the async request APIs as a breaking change but shipped a temporary synchronous compatibility layer; the version-16 upgrade guide states that *"Starting with Next.js 16, synchronous access is fully removed. These APIs can only be accessed asynchronously."* The same removal covers `cookies`, `headers`, `draftMode`, `searchParams` in `page.js`, and `params` in `layout.js`, `page.js`, `route.js`, `default.js` and the metadata image conventions. Note that the general `upgrade` codemod does not perform this migration — the `next-async-request-api` codemod does.

**★ Why did they make `params` a promise at all? It looks like ceremony.**
Because a param is request-time data, and modelling it as a promise lets the framework begin rendering the parts of a route that do not depend on it while the value is still unknown. That is what makes a static shell possible for a dynamic route: the layout renders, a Suspense boundary holds the place of the param-dependent subtree, and the value resolves later. A synchronous prop would force the whole tree to wait on the URL, which is precisely the behaviour Cache Components exists to avoid.

**★ You have `app/[locale]/[...path]/page.tsx`. What is the type of `params`, and what does it resolve to for `/en/docs/routing/dynamic`?**
The type is `Promise<{ locale: string; path: string[] }>`, resolving to `{ locale: 'en', path: ['docs', 'routing', 'dynamic'] }`. Note that `/en` alone does not match this route at all — the catch-all needs at least one segment — so a landing page per locale needs either `app/[locale]/page.tsx` or the optional form.

**★ A route param is `'42'`. You compare it to `42` and the branch never runs. Why is the type not `number`?**
Because the value comes from a URL a user can type anything into, so the framework cannot honestly promise a number. The documented rationale is that the broad `string` type forces you to handle every case at the boundary. Parse and validate once at the top of the page — and turn a bad value into a `notFound()` rather than letting it propagate as `NaN`.

**★ Under Cache Components, why is `await props.params` at the top of a layout a mistake?**
It binds the layout's entire output to request-time data, so the layout cannot be prerendered into the static shell. The documented fix is to pass the promise down and await it inside the component that actually needs the value, which keeps the layout static and confines the request-time dependency to a subtree that can sit behind Suspense.

---

← [Nested layouts, parallel and intercepting routes](02-nested-layouts-parallel-routes-slot-intercepting-routes-rout.md) · [Chapter 2 overview](01-explanation.md) · Next → [03b · Reading params](03b-reading-params.md)
