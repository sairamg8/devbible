---
title: "Past 50,000 URLs a sitemap must be split, `generateSitemaps` is how you split it, and the reference's own example does not typecheck since 16.0 turned the shard id into a promised string"
sidebar_label: "03c · Splitting a sitemap"
sidebar_position: 112
description: "The two ways to produce multiple sitemaps, the 50,000-URL and 50MB limits, the generated URL shape and how it changed across 13.3.2 / 15.0 / 16.0, the id-is-a-promise-of-a-string typing bug in the docs, and how to shard a query without loading the table."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [`generateSitemaps` reference](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps)
> (page `lastUpdated: 2025-12-09`), the
> [`sitemap.xml` reference](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
> (`2026-08-25`), and
> [Google Search Central — *Build and submit a sitemap*](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
> (*Last updated 2026-07-08 UTC*).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**A single sitemap has a hard ceiling, and it is not a Next.js ceiling. The format caps a file at 50,000 URLs or 50 MB uncompressed, so any catalogue past that size must be split into several files — and Next.js gives you two ways to do it, one of which is a directory layout and the other a function. The function, `generateSitemaps`, has a wrinkle worth knowing before you write it: 16.0 changed the shard id from a number to a promise resolving to a string, and the reference's own example was not updated to match, so the documented code multiplies a `string` by 50,000. This page is the splitting mechanics, the URL shape at each version, and how to shard the query rather than the array.**

## The limits are the format's, not the framework's

> *"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs. If you have a larger file or more URLs, you must break your sitemap into multiple sitemaps."*

The Next.js reference states the URL half only as a comment inside its own example — `// Google's limit is 50,000 URLs per sitemap` — so the authoritative statement is Google's, and it includes the byte limit that the code comment omits. **50 MB matters more often than people expect** once you add `alternates.languages` to every entry: an entry with six hreflang alternates is roughly seven times the bytes of a bare one, so a localised sitemap can hit the size limit at well under 50,000 URLs.

Nothing in Next.js enforces either limit. You will not get a build error at 60,000 URLs; you will get a sitemap that the engine's console reports as too large, which is a slow feedback loop measured in days.

## Two ways to split

**By route segment.** Nest `sitemap.(xml|js|ts)` files:

```
app/
├── sitemap.ts               → /sitemap.xml        (marketing pages)
├── blog/
│   └── sitemap.ts           → /blog/sitemap.xml
└── products/
    └── sitemap.ts           → /products/sitemap.xml
```

This is the right split when the *content types* differ — different queries, different update cadences, different cache tags. Each file is an independent cached Route Handler, so the blog sitemap can revalidate hourly while the marketing one revalidates never.

**By shard, with `generateSitemaps`.** This is the right split when one content type is simply too big:

```tsx
// app/product/sitemap.ts
import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/app/lib/constants'

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id
  const start = id * 50000
  const end = start + 50000
  const products = await getProducts(
    `SELECT id, date FROM products WHERE id BETWEEN ${start} AND ${end}`
  )
  return products.map((product) => ({
    url: `${BASE_URL}/product/${product.id}`,
    lastModified: product.date,
  }))
}
```

That is the reference's example, reproduced faithfully. **Two things in it are wrong and one of them is only wrong since 16.0.**

## The `id` typing bug

The version history is explicit:

> *"`v16.0.0` — The `id` values returned from `generateSitemaps` are now passed as a promise that resolves to a `string` to the sitemap function."*

So `const id = await props.id` yields a **`string`**, and the very next line of the documented example is `const start = id * 50000`. In JavaScript that coerces and happens to work; in TypeScript, with the signature the same example declares, it does not typecheck. The reference was not updated when the type changed.

```tsx
// ✅ what the example should be
export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)
  const start = shard * 50_000
  const end = start + 50_000
  // ...
}
```

The second problem is the SQL: `WHERE id BETWEEN ${start} AND ${end}` assumes product ids are dense integers starting at zero. Almost no real table satisfies that — deletions leave holes, and any UUID or cuid primary key breaks it entirely. It also interpolates directly into SQL, which is fine when both values are numbers you computed and is a terrible habit to copy.

A shard scheme that survives contact with a real table uses an ordered cursor, not an id range:

```tsx
// app/product/sitemap.ts
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const PAGE = 45_000 // leave headroom under the 50,000 limit
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function generateSitemaps() {
  const count = await db.product.count({ where: { listed: true } })
  const shards = Math.max(1, Math.ceil(count / PAGE))
  return Array.from({ length: shards }, (_, id) => ({ id }))
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await props.id)

  const products = await db.product.findMany({
    where: { listed: true },
    select: { slug: true, updatedAt: true },
    orderBy: { id: 'asc' },
    skip: shard * PAGE,
    take: PAGE,
  })

  return products.map((product) => ({
    url: `${BASE_URL}/product/${product.slug}`,
    lastModified: product.updatedAt,
  }))
}
```

🔴 **The `orderBy` is not optional.** Without a stable total order, two shards can overlap or miss rows between them, and the symptom is a handful of products that are never in any sitemap — invisible until someone audits the count.

⚠️ **`generateSitemaps` runs its own query.** A `count()` here plus one page query per shard is `shards + 1` round trips at build. That is fine at four shards and worth thinking about at four hundred; if the count is expensive, cache it or derive the shard count from a cheaper source.

## The URL shape, and the two changes to it

> *"Your generated sitemaps will be available at `/.../sitemap/[id].xml`. For example, `/product/sitemap/1.xml`."*

The version history matters here because a stale answer is still widely circulated:

| Version | Shape | Note |
|---|---|---|
| `13.3.2` | `/product/sitemap.xml/1` | introduced; **development only** for viewing |
| `15.0.0` | `/product/sitemap/1.xml` | *"generates consistent URLs between development and production"* |
| `16.0.0` | unchanged | the `id` type changed, not the URL |

The 15.0 line is the interesting one: before it, dev and production disagreed about the URL, which meant anything you verified locally proved nothing about the deployed site. If you are reading an older tutorial and the URLs do not match, that is why.

## Announcing several sitemaps

You now have `n` files and nothing points at them. Two options:

**List them all in `robots.ts`** — `sitemap` accepts an array:

```tsx
// app/robots.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/blog/sitemap.xml`,
      `${BASE_URL}/product/sitemap/0.xml`,
      `${BASE_URL}/product/sitemap/1.xml`,
    ],
  }
}
```

which is fine for a handful and unmaintainable for forty, because the list must track the shard count.

**Or a sitemap index file**, which Google offers explicitly:

> *"You can optionally create a sitemap index file and submit that single index file to Google."*

⚠️ **Next.js has no file convention for a sitemap index.** `sitemap.ts` produces a `<urlset>`, not a `<sitemapindex>`. Building one means a plain Route Handler that returns the XML yourself, with the correct `Content-Type`, and the shard count derived from the same source `generateSitemaps` uses. That is not difficult, but it is worth knowing it is not provided — it is the one gap in this file-convention family.

## Gotchas

**★ The documented `generateSitemaps` example does not typecheck.** Since 16.0 the awaited `id` is a `string` and the example multiplies it by 50,000. Fix: `const shard = Number(await props.id)`.

**★ Migrating from 15: `props.id` is suddenly a promise.** The prop shape changed in 16.0 and there is no deprecation path. Fix: `await` it, and type the parameter as `Promise<string>` so the compiler catches every call site.

**★ A few hundred products are in no sitemap at all.** The shard query had no stable `orderBy`, so page boundaries shifted between queries. Fix: order by an immutable column — the primary key — in both the count and the page query.

**★ Sharding by id range misses everything after the first deletion.** `WHERE id BETWEEN 0 AND 50000` assumes dense integer keys. Fix: `skip`/`take` over an ordered query, or a keyset cursor; never an arithmetic range over a real primary key.

**★ Your localised sitemap is rejected for size well under 50,000 URLs.** The 50 MB limit binds first once each `<url>` carries several `xhtml:link` alternates. Fix: shard on bytes, not rows — drop `PAGE` to something like 10,000 when every entry has six alternates.

**★ You added a shard and the new sitemap is not crawled.** `robots.ts` lists the shard URLs explicitly and was not updated. Fix: derive the list from the same shard count `generateSitemaps` computes, or move to a sitemap index so the list lives in one place.

**★ Every shard re-queries the whole table.** The default export ignores `id` and returns all rows, so each shard is identical and the split achieves nothing except more files. Fix: the `skip`/`take` must actually use the shard number — assert it in a test that two shards return disjoint URL sets.

**★ The build got much slower after sharding.** `generateSitemaps` plus one query per shard is `shards + 1` round trips at build. Fix: this is inherent, but the `count()` can be cached, and shard *width* is a knob — fewer, larger shards mean fewer queries.

**★ You looked for a `sitemapindex` file convention and could not find one.** There is not one. Fix: write a plain Route Handler that emits the index XML, and drive it from the same shard-count function.

**★ The URL you tested locally does not exist in production.** You are on a pre-15 mental model — the dev and production URL shapes differed until 15.0. Fix: `/product/sitemap/1.xml` is the current shape in both.

## Interview questions

**★ Why split a sitemap at all, and what actually forces it?**
The sitemap protocol caps a single file at 50,000 URLs *or* 50 MB uncompressed, whichever binds first. Neither limit is enforced by Next.js — there is no build error — so the feedback comes from the search console days later. The byte limit is the one people forget: a localised sitemap where every entry carries half a dozen `xhtml:link` alternates can hit 50 MB at a fraction of the URL count, so the shard size has to be chosen against the shape of your entries rather than a constant.

**★ Compare nested `sitemap.ts` files with `generateSitemaps`.**
They solve different problems. Nesting splits by *kind*: `app/blog/sitemap.ts` and `app/products/sitemap.ts` are separate cached Route Handlers with independent queries, cache tags and revalidation, which is exactly what you want when a blog changes hourly and marketing pages change never. `generateSitemaps` splits one kind by *size*, producing `/product/sitemap/0.xml`, `/1.xml` and so on from a single file. A large catalogue site usually needs both: nesting for the content types, sharding within the one type that overflows.

**★ Walk through what is wrong with the reference's `generateSitemaps` example.**
Two things. First, since 16.0 the `id` prop is a promise resolving to a `string`, and the example does `const start = id * 50000` on the awaited value — that coerces at runtime and fails to compile against the signature the same snippet declares. Second, and more consequential in practice, the shard predicate is `WHERE id BETWEEN start AND end`, which only works if primary keys are dense integers from zero; any deletion leaves a shard short and any non-integer key breaks it entirely. The durable version is `Number(await props.id)` plus `skip`/`take` over a query with a stable `orderBy`.

**★ How do you tell a crawler that four sitemaps exist?**
Either list all four in `robots.ts` — the `sitemap` field accepts an array — or publish a sitemap index and point at that. The array is fine while the count is small and fixed, and becomes a maintenance hazard the moment the shard count is computed rather than written down, because the list and the count drift. The index is the general answer, and the thing to know is that Next.js has **no file convention for one**: `sitemap.ts` emits a `<urlset>`, so an index has to be a hand-written Route Handler driven by the same shard-count function.

**★ You shard a sitemap and a colleague reports that some products never appear. What is your first hypothesis?**
An unstable sort in the shard query. `skip`/`take` without a deterministic `orderBy` gives the database freedom to return rows in different orders for different pages, so rows fall between page boundaries and others are duplicated. It is invisible in review, invisible in a single-shard test, and only shows up as a count mismatch across the whole set. The test that catches it is cheap: render two adjacent shards and assert their URL sets are disjoint and that the union across all shards matches the row count.

{/* FOOTER */}
