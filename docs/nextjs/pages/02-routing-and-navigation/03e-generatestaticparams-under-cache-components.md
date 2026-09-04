---
title: "Under Cache Components your sample params stop being a prerender list and become a build-time test suite, which is why an empty array is an error and why a green build still guarantees nothing about the branches your samples never entered"
sidebar_label: "03e · gSP under Cache Components"
sidebar_position: 16
description: "Why generateStaticParams must return at least one param under Cache Components, what build-time validation does and does not cover, the placeholder escape hatch, and what changes on a dynamic route that has no generateStaticParams at all."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated: 2026-08-25`), [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`) and [Empty generateStaticParams with Cache Components](https://nextjs.org/docs/messages/empty-generate-static-params).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**. Continues [03d · generateStaticParams](03d-generatestaticparams-strategies.md).

**Without Cache Components, the params you return are a prerender list and returning none of them is a legitimate strategy. With Cache Components, the same array becomes the input to a build-time validation pass: Next.js renders each sample and fails the build if the route touches `cookies()`, `headers()` or `searchParams` outside a boundary. That reframing has two sharp consequences. An empty array is now a build error, because there is nothing to validate against. And a green build only certifies the code paths your samples actually executed — a branch keyed on the param value that no sample matches is shipped unvalidated.**

## The empty array becomes an error

> *"When using Cache Components with dynamic routes, `generateStaticParams` must return **at least one param**. Empty arrays cause a build error. This allows Cache Components to validate your route doesn't incorrectly access `cookies()`, `headers()`, or `searchParams` at runtime."*

The error page states the mechanism plainly:

> *"When Cache Components is enabled, Next.js performs build-time validation to ensure your routes can be properly prerendered without runtime dynamic access errors. If `generateStaticParams` returns an empty array, Next.js cannot validate that your route won't access dynamic values (like `await cookies()`, `await headers()`, or `await searchParams`) at runtime, which would cause errors."*

```tsx title="app/blog/[slug]/page.tsx"
// This will cause an error with Cache Components
export async function generateStaticParams() {
  return [] // Empty array not allowed
}

// Return at least one sample param
export async function generateStaticParams() {
  return [{ slug: 'hello-world' }, { slug: 'getting-started' }]
}
```

And what those samples are actually for:

> *"During the build process, the route is executed with each sample param to collect the HTML result. If dynamic content or runtime data are accessed incorrectly, the build will fail."*
>
> *"These samples serve dual purposes: **Build-time validation**: Verify your route structure is safe. **Prerendering**: Generate instant-loading pages for popular routes."*

## Validation only covers the branches your samples reach

This is the failure mode that survives code review, because the build is green.

> *"Build-time validation only covers code paths that execute with the sample params. If your route has conditional logic that accesses runtime APIs for certain param values not in your samples, those branches won't be validated at build time"*

```tsx title="app/blog/[slug]/page.tsx"
import { cookies } from 'next/headers'

export async function generateStaticParams() {
  return [{ slug: 'public-post' }, { slug: 'hello-world' }]
}

export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params

  if (slug.startsWith('private-')) {
    // This branch is never executed at build time
    // Runtime requests for 'private-*' slugs will error
    return <PrivatePost slug={slug} />
  }

  return <PublicPost slug={slug} />
}

async function PrivatePost({ slug }: { slug: string }) {
  const token = (await cookies()).get('token')
  // ... fetch and render private post using token for auth
}
```

> *"For runtime params not returned by `generateStaticParams`, validation occurs during the first request. In the example above, requests for slugs starting with `private-` will fail because `PrivatePost` accesses `cookies()` without a Suspense boundary."*

The documented fix is a boundary, not a bigger sample list:

```tsx title="app/blog/[slug]/page.tsx"
import { Suspense } from 'react'
import { cookies } from 'next/headers'

export async function generateStaticParams() {
  return [{ slug: 'public-post' }, { slug: 'hello-world' }]
}

export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params

  if (slug.startsWith('private-')) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <PrivatePost slug={slug} />
      </Suspense>
    )
  }

  return <PublicPost slug={slug} />
}

async function PrivatePost({ slug }: { slug: string }) {
  const token = (await cookies()).get('token')
  // ... fetch and render private post using token for auth
}
```

## Without `generateStaticParams` at all

The other half of the Cache Components story: a dynamic route with no `generateStaticParams` is not illegal, it just means every param is request-time data.

> *"Without `generateStaticParams`, param values are unknown during prerendering, making params runtime data. You must wrap param access in `<Suspense>` boundaries to provide fallback UI."*

```tsx title="app/blog/[slug]/page.tsx"
import { Suspense } from 'react'

export default function Page({ params }: PageProps<'/blog/[slug]'>) {
  return (
    <div>
      <h1>Blog Post</h1>
      <Suspense fallback={<div>Loading...</div>}>
        {params.then(({ slug }) => (
          <Content slug={slug} />
        ))}
      </Suspense>
    </div>
  )
}

async function Content({ slug }: { slug: string }) {
  const res = await fetch(`https://api.vercel.app/blog/${slug}`)
  const post = await res.json()

  return (
    <article>
      <h2>{post.title}</h2>
      <p>{post.content}</p>
    </article>
  )
}
```

Note that the page function is **not** `async` and never awaits `params` — the promise is handed to the boundary. That is the same rule as the layout advice in [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md), applied to a page.

## The placeholder escape hatch, and its cost

> *"**Good to know**: If you don't know the actual param values at build time, you can return a placeholder param (e.g., `[{ slug: '__placeholder__' }]`) for validation, then handle it in your page with `notFound()`. However, this prevents build time validation from working effectively and may cause runtime errors."*

```tsx title="app/blog/[slug]/page.tsx"
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  return [{ slug: '__placeholder__' }]
}

export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  if (slug === '__placeholder__') notFound()
  return <Post slug={slug} />
}
```

The `notFound()` guard is what makes the placeholder safe to serve — and simultaneously what makes the validation useless, because the sample render returns before touching any of the code you wanted validated. Use it when you truly have no build-time knowledge of the values, and know that you have opted out of the guarantee.

## Gotchas

**★ Symptom: `Empty generateStaticParams with Cache Components` fails a build that was green before Cache Components was enabled.** Cause: the empty-array strategy is legal without Cache Components and illegal with it, because the build needs at least one sample to render and validate against. Fix: return at least one real param — and choose one that is genuinely representative, because it is the thing the validator exercises.

```tsx
export async function generateStaticParams() {
  return [{ slug: 'hello-world' }, { slug: 'getting-started' }]
}
```

**★ Symptom: the build is green and one family of URLs errors in production with a dynamic-API message.** Cause: a conditional branch keyed on the param value was never entered by any sample, so its `cookies()` call was never validated. Fix: put the branch behind Suspense so it is legal at request time regardless of the samples — adding a matching sample fixes the *build check* but not the underlying "this branch needs request data" fact.

```tsx
if (slug.startsWith('private-')) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PrivatePost slug={slug} />
    </Suspense>
  )
}
```

**★ Symptom: a placeholder param silences the empty-array error and the build stays green forever, including through a genuine regression.** Cause: the `notFound()` guard returns before the validated code runs, so validation covers nothing — the docs say it *"prevents build time validation from working effectively and may cause runtime errors."* Fix: prefer any real value you can obtain at build time; if you cannot, treat the route as unvalidated and cover it with a request-level test instead of relying on the build.

**★ Symptom: a page with no `generateStaticParams` fails to build under Cache Components with a prerender error at the top of the component.** Cause: without it, params are runtime data — *"You must wrap param access in `<Suspense>` boundaries to provide fallback UI."* Awaiting at the top of the page leaves nothing to prerender. Fix: keep the page function synchronous and hand the promise to a boundary.

```tsx
export default function Page({ params }: PageProps<'/blog/[slug]'>) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {params.then(({ slug }) => <Content slug={slug} />)}
    </Suspense>
  )
}
```

## Interview questions

**★ Under Cache Components, why is an empty `generateStaticParams` a build error rather than a valid "prerender nothing" choice?**
Because Cache Components uses the sample params to *validate* the route at build time — it renders each sample and fails the build if the route reaches for `cookies()`, `headers()` or `searchParams` outside a boundary. With no samples there is nothing to validate against, so the guarantee the feature exists to provide cannot be established. The docs call the samples dual-purpose: build-time validation and prerendering. Only the second is optional.

**★ A build passes but a specific family of URLs errors in production. How does that happen with Cache Components validation in place?**
Validation only executes the code paths the sample params reach. A conditional keyed on the param value — `if (slug.startsWith('private-'))` — is never entered at build time unless a sample matches it, so a `cookies()` call inside that branch is unvalidated and fails on the first real request. The documented fix is Suspense around the branch, which makes it legal at request time; adding a matching sample only restores the build check.

**★ What does the placeholder param trick buy you, and what does it cost?**
It buys a passing build when you genuinely have no param values at build time: return `[{ slug: '__placeholder__' }]` and `notFound()` on it in the page. It costs the validation itself — the docs say it *"prevents build time validation from working effectively and may cause runtime errors"* — because the guard returns before any of the code you wanted checked executes. It is an escape hatch, not a pattern.

**★ Under Cache Components, what changes about a dynamic route that has no `generateStaticParams` at all?**
Its params become runtime data, so any access to them has to sit inside a Suspense boundary that can render a fallback during prerendering. In practice the page function stops being `async`: instead of awaiting `params` at the top, it passes the promise into a boundary and a child awaits it. Next.js then generates a static shell at build time and fills the content per request.

---

← [03d · generateStaticParams](03d-generatestaticparams-strategies.md) · [Chapter 2 overview](01-explanation.md) · Next → [03f · Nested dynamic segments](03f-nested-dynamic-segments-and-route-handlers.md)
