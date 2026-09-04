---
title: "`sitemap.ts` is a cached Route Handler that returns an array, not a file you maintain — and two of the four fields it lets you set are ignored by the search engine you are writing it for"
sidebar_label: "03 · sitemap.ts"
sidebar_position: 14
description: "The MetadataRoute.Sitemap return type field by field, why sitemap.ts is cached by default and what makes it dynamic, which fields Google actually reads, image and video sitemaps, and how to build one from a database without shipping a 50,000-row query."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`sitemap.xml` reference](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
> (page `lastUpdated: 2026-08-25`), and
> [Google Search Central — *Build and submit a sitemap*](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
> (page states *Last updated 2026-07-08 UTC*).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no output blocks.

**A sitemap is a hint about what exists and when it last changed. Next.js models it as a default-exported function returning an array of plain objects, and the framework serialises that array into the XML the protocol requires — which is genuinely better than maintaining a file, because the array can come from your database. What the framework cannot tell you is that two of the fields it offers you, `changeFrequency` and `priority`, are ignored outright by Google, and that the file you just wrote is a **cached Route Handler** whose freshness is governed by the same rules as any other cached thing in the App Router. This page is the type, the caching, and the difference between what the format permits and what a crawler reads.**

## The type, in full

```tsx
type Sitemap = Array<{
  url: string
  lastModified?: string | Date
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  priority?: number
  alternates?: {
    languages?: Languages<string>
  }
  images?: string[]
  videos?: Videos[]
}>
```

`url` is the only required field, and it must be **absolute**. 🔴 `metadataBase` does not apply here — a sitemap is a Route Handler returning its own data structure, not a metadata field, so nothing composes its URLs. This is the same rule [01d](01d-metadatabase-url-composition-and-the-parent-promise.md) states, and it is the single most common reason a first sitemap ships with a hundred relative paths in it.

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://acme.com', lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
    { url: 'https://acme.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://acme.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ]
}
```

You may also just write `app/sitemap.xml` by hand, which the reference offers for *"smaller applications"*. It is a fine choice for a five-page marketing site and a bad one the moment a URL can be added without a deploy.

## Two of those fields do nothing

This is the load-bearing fact of the whole page and it is not in the Next.js documentation, because it is not Next.js's business. From Google Search Central:

> *"Google ignores `<priority>` and `<changefreq>` values."*

So `changeFrequency` and `priority` are XML the protocol defines, Next.js faithfully emits, and the largest consumer discards. They cost you nothing to include and they buy you nothing; the harm is entirely in the hours spent tuning a `priority` distribution that no crawler reads.

`lastModified` is the opposite — the one field with real leverage, and with a condition attached:

> *"Google uses the `<lastmod>` value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate."*

> *"The `<lastmod>` value should reflect the date and time of the last significant update to the page. For example, an update to the main content, the structured data, or links on the page is generally considered significant, however an update to the copyright date is not."*

🔴 **`lastModified: new Date()` in a static sitemap is therefore actively harmful.** It says every page changed at build time, which is trivially falsifiable against the actual content and is exactly the "not consistently and verifiably accurate" case the guidance warns about. The value belongs to the *content*:

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL! // https://sprintdesk.app

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await db.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: new Date('2026-01-15') },
    { url: `${BASE_URL}/pricing`, lastModified: new Date('2026-08-02') },
  ]

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
    })),
  ]
}
```

Note what is *not* in that return: no `changeFrequency`, no `priority`. Nothing is lost.

## It is a cached Route Handler, and that is the whole freshness story

> *"`sitemap.js` is a special Route Handler that is cached by default unless it uses a Request-time API or dynamic config option."*

So the sitemap above, which queries a database, is **rendered once at build and then served from cache** — meaning a post published after the deploy will not appear in it until something invalidates it. That is usually a surprise, and it is the right default: a sitemap re-queried on every crawler request is a database query you did not budget for, triggered by someone else's schedule.

Three ways to control it, in increasing cost:

```tsx
// 1. Time-based: refresh the sitemap every hour
export const revalidate = 3600
```

```tsx
// 2. Tag-based, under Cache Components: invalidate when a post is published
'use cache'
import { cacheTag } from 'next/cache'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  cacheTag('posts')
  // ... query and map
}
```

```tsx
// 3. Fully dynamic: a query on every request. Rarely correct.
export const dynamic = 'force-dynamic'
```

Option 2 is the one to reach for when publishing is an event you already handle — the same `revalidateTag('posts')` call that refreshes the blog index refreshes the sitemap, and the two can never disagree. Option 3 hands an unauthenticated schedule for your database to every crawler on the internet.

## Image and video sitemaps

Both are extra XML namespaces the serialiser adds when the corresponding field is present.

```tsx
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://example.com',
      lastModified: '2021-01-01',
      images: ['https://example.com/image.jpg'],
      videos: [
        {
          title: 'example',
          thumbnail_loc: 'https://example.com/image.jpg',
          description: 'this is the description',
        },
      ],
    },
  ]
}
```

`images` is a flat array of absolute URLs and produces `image:image` / `image:loc` entries inside the `<url>` element. `videos` takes objects, and note the field naming: `thumbnail_loc` is **snake_case**, matching the XML element rather than the surrounding TypeScript convention. That is not a typo in the docs; it is the only place in this API where the sitemap type mirrors the protocol's names directly, and it will fail a lint rule that enforces camelCase properties.

A practical caution: image sitemaps are for images that are *content* — product photos, article illustrations. Listing your icon set and every UI sprite is noise, and it competes for the same 50,000-URL budget as your actual pages.

## The localized form

```tsx
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://acme.com/about',
      lastModified: new Date(),
      alternates: {
        languages: {
          es: 'https://acme.com/es/about',
          de: 'https://acme.com/de/about',
        },
      },
    },
  ]
}
```

which serialises to `xhtml:link rel="alternate" hreflang="…"` elements inside each `<url>`, with the `xmlns:xhtml` namespace declared on `<urlset>`. This is the sitemap half of hreflang; the `<head>` half is `alternates.languages` in metadata, and **the two are not interchangeable and are not automatically consistent**. Doing that properly is [03d](03d-localized-metadata-for-i18n-routes.md).

## Where the sitemap is announced

Nothing in `sitemap.ts` tells a crawler the sitemap exists. Two mechanisms do, and you want both:

- `robots.ts` with a `sitemap` field, which is the declarative half — [03b](03b-robotsts-and-the-crawl-directives.md).
- Submission through the engine's own console, which is the half that also gives you error reporting.

## Gotchas

**★ Every URL in the sitemap is relative and the file validates as empty.** `metadataBase` does not apply to Route Handlers, and `sitemap.ts` is one. There is no build error. Fix: build every `url` from an explicit base — the same environment variable that feeds `metadataBase`, so the two can never drift.

**★ A post published this morning is not in the sitemap.** The handler is cached by default and was rendered at build. Fix: `export const revalidate = 3600` for a simple time bound, or `'use cache'` plus `cacheTag('posts')` so the publish event that refreshes the blog index refreshes the sitemap too.

**★ `lastModified: new Date()` makes your `lastmod` values worthless.** It reports the build time for every URL, which is verifiably not when the content changed, and Google's guidance is explicit that it uses `lastmod` only when it is consistent and verifiable. Fix: use the content's own `updatedAt`, and for hand-listed static routes use a real hard-coded date you update when you edit the page.

**★ You spent an afternoon tuning `priority`.** Google ignores `<priority>` and `<changefreq>`. Fix: delete both fields. Nothing downstream changes.

**★ `export const dynamic = 'force-dynamic'` on the sitemap.** Usually added to "fix" staleness. It gives every crawler on the internet the ability to trigger your full sitemap query at will. Fix: revalidation or a cache tag; dynamic is for sitemaps whose contents are genuinely per-request, which is essentially none of them.

**★ The sitemap query returns 200,000 rows and the build hangs.** There is no built-in limit; you asked for the whole table. Fix: split with `generateSitemaps` ([03c](03c-splitting-a-sitemap-generatesitemaps-and-the-50000-url-rule.md)) and paginate the query per shard, so no single call loads the table.

**★ Draft and archived content is in the sitemap.** The query had no `where` clause, or a `published` filter that does not match what the route actually renders. Fix: derive the sitemap from the *same* query predicate the listing page uses — ideally the same exported function — so a URL cannot be advertised that 404s.

**★ URLs in the sitemap redirect.** You listed `/blog/old-slug` and the route 301s to the new one. A sitemap should list canonical destinations only. Fix: list the canonical URL; if you cannot, the redirect map is out of sync with the content table and that is the real bug.

**★ `thumbnail_loc` fails your lint rule.** The video sitemap fields use the protocol's snake_case names. Fix: it is correct as documented — add the exception rather than "fixing" the property name.

**★ The sitemap is fine but nothing crawls it.** Nothing announced it. Fix: add `sitemap:` to `robots.ts` and submit it in Search Console; do both, because the second one is also your error report.

**★ HTML-entity-looking characters appear in URLs.** Google's guidance notes that as with all XML files, tag values must be entity-escaped. The serialiser handles this for the values you return, but a URL you built by string concatenation with an unescaped `&` in a query string is a URL you invented, not one it fixed. Fix: build URLs with `new URL()` and avoid query strings in sitemap entries entirely.

## Interview questions

**★ Why is `sitemap.ts` a Route Handler rather than a build artifact, and what follows from that?**
Because a sitemap has to be able to reflect data that changes without a deploy, and the App Router already has a model for "a thing that produces a response and may be cached" — so a sitemap is just an instance of it. What follows is the entire freshness story: it is cached by default, it becomes dynamic if it touches a request-time API or an uncached data source, and it accepts the same route segment config as a page. That also means `metadataBase` does not touch it and its URLs must be absolute, because it is not part of the metadata system at all.

**★ Which sitemap fields does Google actually use, and what should you set?**
`<loc>` always, and `<lastmod>` conditionally — Google says it uses `lastmod` when the value is "consistently and verifiably accurate", and its own guidance defines significant changes as content, structured data or links, explicitly excluding things like a copyright year. `<priority>` and `<changefreq>` are documented as ignored. So the field set worth maintaining is URL plus a truthful content timestamp, and the field worth *not* setting is a build-time `new Date()`, which is a value the crawler can check against the page and find false.

**★ Your sitemap is stale after publishing. Give three fixes and rank them.**
Best: `'use cache'` on the handler with `cacheTag('posts')`, so the same `revalidateTag` your publish flow already calls refreshes the sitemap — one invalidation event, no divergence. Next: `export const revalidate = 3600`, which bounds staleness without any coordination but wastes queries on quiet days and is still an hour late on busy ones. Worst: `force-dynamic`, which regenerates on every crawler request and hands an external actor a trigger for your heaviest query. The choice is really about whether you have a publish event to hang the invalidation on.

**★ Why must sitemap URLs be absolute, when `og:image` can be relative?**
Because `metadataBase` composition is a feature of the *metadata* pipeline, applied to URL-valued metadata fields as they are resolved into head tags. A sitemap is a Route Handler returning an array you constructed; the framework serialises it to XML and has no notion of a base to resolve against — nor should it, since the sitemap may legitimately list URLs on another host you own. There is no build error for a relative URL here, which is exactly why it ships.

**★ How do you keep a sitemap from advertising URLs that 404?**
By deriving it from the same predicate the pages use, not from a parallel query. If the blog index renders `published: true, deletedAt: null`, the sitemap must use that same filter — best expressed as one exported function both call. The failure is always divergence: someone adds a `scheduledFor` check to the listing page and not to the sitemap, and six months later the console reports a few hundred URLs returning 404 with no obvious cause. Treating the sitemap as a *view over the same data* rather than a second implementation is the whole discipline.

---

← [What the unfurlers actually fetch](02f-what-the-unfurlers-actually-fetch.md) · [Chapter 12 overview](01-explanation.md) · Next → [`robots.ts` and the crawl directives](03b-robotsts-and-the-crawl-directives.md)
