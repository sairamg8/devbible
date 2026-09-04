---
title: "Metadata is two mutually exclusive exports evaluated root-to-leaf and merged one level deep — and that one level is where almost every wrong social preview comes from"
sidebar_label: "01 · Static and dynamic metadata"
sidebar_position: 1
description: "The metadata object and generateMetadata: where they may be declared, why you cannot have both in one segment, why a Client Component export produces nothing, and how root-to-leaf evaluation with a one-level-deep merge decides the final head."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> (page `lastUpdated: 2026-08-25`),
> [Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
> (`2026-08-25`),
> and the [Metadata Files index](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
> (`2025-10-17`).
> Target: **Next.js 16.3.4**, App Router, React 19.2.8. Documentation-verified —
> **no sandbox run**; `next` is not installed in this checkout.

**Everything a route puts in `<head>` comes from exactly one of three sources, and they are
ranked: a file convention beats a `generateMetadata` function, which cannot coexist with a
static `metadata` object in the same segment. Those three sources are then resolved from the
root layout down to the page, and merged **shallowly** — a child that sets `openGraph.title`
does not add a title to its parent's Open Graph block, it *replaces the entire block*. That
single sentence explains most production incidents in this area: the description disappears
from the Slack unfurl, the `og:image` reverts to the site-wide default on exactly the pages
that had a custom one, and nothing in the build output complains. This page is the resolution
model. Five siblings carry the rest: the title algebra and the `viewport` export in
[01b](01b-the-title-algebra-and-the-viewport-export.md), the tags this API refuses to emit in
[01c](01c-the-tags-the-metadata-api-will-not-emit.md), absolute URLs and the `parent` promise
in [01d](01d-metadatabase-url-composition-and-the-parent-promise.md), what happens when
metadata is not ready before the body streams in
[01e](01e-streaming-metadata-and-html-limited-bots.md), and the two errors Cache Components
raises when metadata is the only dynamic thing on the page in
[01f](01f-metadata-under-cache-components.md).**

## Where metadata may be declared, and where it may not

Both exports live in a `layout.js`/`layout.tsx` or a `page.js`/`page.tsx`. Nowhere else. Not in
a component, not in a `template.tsx`, not in a Route Handler.

```tsx
// app/blog/layout.tsx — values known without fetching anything
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'SprintDesk Blog', template: '%s · SprintDesk' },
  description: 'Release notes and engineering writing from the SprintDesk team.',
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <section className="prose">{children}</section>
}
```

Three constraints are worth memorising because each one fails in a different way:

- **Server Components only.** The docs are explicit that metadata must resolve on the server
  before the page component renders, so the exports are meaningless in a file carrying
  `'use client'`. Putting `export const metadata` in a client file does not warn at runtime;
  it simply produces no tags. The documented shape is to keep `page.tsx` a Server Component
  and move the interactive parts into a separate client file that the page imports.
- **You cannot export both from one segment.** `metadata` and `generateMetadata` in the same
  file is an error, not a merge. If you need one field computed and the rest constant, put the
  constants in a module and spread them inside `generateMetadata`.
- **File-based metadata wins.** An `opengraph-image.tsx` next to your `page.tsx` overrides
  whatever `openGraph.images` your object said. This is a feature — the file convention keeps
  the tag and the actual asset in sync — but it means a metadata object that "does nothing" is
  often being overridden by a file you forgot was there.
  See [02](02-open-graph-twitter-cards-structured-json-ld.md) for that whole layer.

## Which export to reach for

`generateMetadata` exists for one reason: the values depend on something you have to go and
get. If they do not, the docs say plainly to use the static object instead — and under Cache
Components that is not just a style preference, it decides whether the route prerenders at all
([01f](01f-metadata-under-cache-components.md)).

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'
import { getPost } from '@/app/lib/posts'
import { notFound } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug) // same call, not a second query — see below
  if (!post) notFound()
  return <article>{post.body}</article>
}
```

Two details in that snippet earn their place:

**`notFound()` and `redirect()` are legal inside `generateMetadata`.** That is documented, and
it lets you fail the route from the metadata pass rather than fetching the record twice and
discovering it is missing in the component.

**The duplicate `getPost(slug)` is not a duplicate query.** `fetch` calls are memoized across
`generateMetadata`, `generateStaticParams`, layouts, pages and Server Components. For anything
that is not `fetch` — a Drizzle or Prisma call, a Redis read — the memoization is yours to
supply, with React's `cache`:

```ts
// app/lib/posts.ts
import { cache } from 'react'
import { db } from '@/app/lib/db'

// Called from generateMetadata and from the page. Executes once per request.
export const getPost = cache(async (slug: string) => {
  return db.query.posts.findFirst({ where: eq(posts.slug, slug) })
})
```

The corpus covers the mechanism in
[`react.cache` and non-fetch memoization](../04-data-fetching-in-the-app-router/01g-react-cache-connection-and-non-fetch-memoization.md);
what matters here is that **forgetting it doubles your database load on every indexed page**,
and it is invisible in development because you are looking at one page at a time.

Also note `searchParams` is only passed to `generateMetadata` in a `page.js` segment — a layout
never sees it, because a layout does not re-render on a query-string change.

## Evaluation order and the shallow merge

Metadata resolves root-first: `app/layout.tsx`, then `app/blog/layout.tsx`, then
`app/blog/[slug]/page.tsx`. Objects from every segment on the path are merged, and **duplicate
keys are replaced by the later segment**. The merge is one level deep. There is no deep merge
anywhere in this system.

Work through the two cases, because the difference between them is the whole gotcha:

```tsx
// app/layout.tsx
export const metadata = {
  title: 'SprintDesk',
  openGraph: {
    siteName: 'SprintDesk',
    description: 'Sprint planning that stays out of the way.',
    images: ['/og-default.png'],
    locale: 'en_US',
    type: 'website',
  },
}
```

```tsx
// app/pricing/page.tsx — sets NO openGraph key
export const metadata = {
  title: 'Pricing',
}
// Resolved: og:site_name, og:description, og:image, og:locale, og:type all INHERITED.
```

```tsx
// app/blog/[slug]/page.tsx — sets openGraph, so it OWNS openGraph
export const metadata = {
  title: 'Sharding the outbox',
  openGraph: { title: 'Sharding the outbox' },
}
// Resolved: og:title only. No og:site_name. No og:description. No og:image.
```

The second page looks more thorough and produces a strictly worse social card. The fix is to
hoist the shared fragment into a module and spread it at every site that overrides the key:

```ts
// app/shared-metadata.ts
export const sharedOpenGraph = {
  siteName: 'SprintDesk',
  images: ['/og-default.png'],
  locale: 'en_US',
} as const
```

```tsx
// app/blog/[slug]/page.tsx
import { sharedOpenGraph } from '@/app/shared-metadata'

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      ...sharedOpenGraph,
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      images: [`/blog/${post.slug}/opengraph-image`],
    },
  }
}
```

The same rule governs `robots`, `twitter`, `alternates`, `icons` and `verification`. Every one
of them is an object, and every one of them is replaced wholesale by the closest segment that
mentions it.

## Gotchas

**★ A child page sets `openGraph.title` and the site's `og:image` vanishes from that page.**
The shallow merge replaced the parent's whole `openGraph` object. Nothing warns, and the page
still validates as HTML — the tags are simply absent. Spread a shared fragment into every
override, as shown above, and test the merged result on a leaf route, not on the layout.

**★ `export const metadata` in a `'use client'` file produces nothing at all.** No error, no
warning, no tags. It is not a runtime failure because the export is simply never read by the
metadata pass. If a page "ignores its metadata", check for `'use client'` at the top of the
file before you check anything else.

**★ Exporting both `metadata` and `generateMetadata` from one segment is an error, not a
merge.** People reach for this when most fields are constant and one is dynamic. Put the
constants in a plain module and spread them inside the function.

**★ Different `fetch` options in `generateMetadata` and the page defeat memoization.** The
memoization key includes the options, so `fetch(url, { cache: 'no-store' })` in one place and
`fetch(url)` in the other are two different requests. Call one shared function from both sites.

**★ A non-`fetch` data source is not memoized for you.** A raw Prisma/Drizzle call in
`generateMetadata` and again in the page is two round trips per request, on precisely the pages
that get crawled hardest. Wrap the accessor in React's `cache`.

**★ An `opengraph-image.tsx` you forgot about is overriding your `openGraph.images`.**
File-based metadata outranks the object. If the object's image URL never appears in the head,
look for a file convention in that segment or a parent.

**★ `searchParams` is `undefined` in a layout's `generateMetadata`.** It is only provided to
`page.js` segments. A layout that tries to build a title from a filter query gets nothing —
move that metadata down to the page.

## Interview questions

**★ A blog post page sets `openGraph: { title, description }`. The root layout sets
`openGraph: { siteName, images, locale }`. What does the rendered head contain?**
`og:title` and `og:description` only. Metadata merging is shallow: because the page defines the
`openGraph` key at all, its object replaces the parent's entirely, and `og:site_name`,
`og:image` and `og:locale` are gone. Had the page omitted `openGraph` completely, it would have
inherited all three. The fix is to export the shared fragment from a module and spread it into
every object that overrides the key.

**★ Why can't `generateMetadata` live in a Client Component?**
Because metadata has to be resolved on the server before the page component renders, so that
the tags can be part of the HTML response. A Client Component's code runs after that point in
the pipeline — and on the client at all, where there is no response to write into. The
documented pattern is to keep the route file a Server Component that owns the metadata export
and import a client child for the interactive parts.

**★ You need a title that is constant except for a product name from the database. Can you
export a static `metadata` for the constants and a `generateMetadata` for the title?**
No — exporting both from the same segment is an error. Export only `generateMetadata`, keep the
constant fields in an ordinary module, and spread them into the returned object. That also
keeps a single place to change when a shared field moves.

**★ Both `generateMetadata` and the page component call `getPost(slug)`. Is that two database
queries?**
Only if `getPost` is a raw database call. `fetch` is memoized across the metadata pass and the
render for identical URL-and-options pairs, so an HTTP-backed accessor is deduplicated
automatically. A database client is not, and needs React's `cache` wrapper to get the same
behaviour. Getting this wrong doubles the query load on exactly the pages search engines hit
most.

**★ Where does the metadata for a route actually come from, in priority order?**
File conventions first (`opengraph-image`, `icon`, `favicon`, `manifest`, `sitemap`, `robots`),
then the segment's `generateMetadata` or `metadata` object, then whatever ancestor segments
contributed and the child did not override. Within the object layer, resolution runs root to
leaf with a shallow merge.

{/* FOOTER */}
