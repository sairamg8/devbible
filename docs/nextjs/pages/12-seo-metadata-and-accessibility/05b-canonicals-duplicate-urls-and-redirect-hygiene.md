---
title: "The App Router makes it trivially easy to serve one piece of content at an unbounded number of URLs — search params, optional catch-alls, trailing slashes and locale prefixes each multiply the address space, and only one of those multiplications is visible in your route tree"
sidebar_label: "05b · Canonicals and duplicate URLs"
sidebar_position: 26
description: "Where duplicate URLs come from in an App Router app, computing a canonical from params, why searchParams must usually be excluded, trailing slash and case, redirect chains, and the difference between a canonical hint and a directive."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> section *`alternates`* (page `lastUpdated: 2026-08-25`), and
> [Google Search Central — *Block Search indexing with `noindex`*](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
> and [*Introduction to robots.txt*](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
> ⚠️ Google's canonicalization guidance beyond the `noindex` interaction was **not fetched** for
> this page; claims about how strongly a canonical is honoured are stated as uncertain, not asserted.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**A route in the App Router is a pattern, and a pattern matches more addresses than you think. `/board` also answers to `/board?filter=open`, `/board?filter=open&sort=due`, `/board?sort=due&filter=open`, and — depending on configuration — `/board/`. Add an optional catch-all and it answers to a family of paths; add locales and multiply by the locale count. Every one of those is a distinct URL that a crawler can discover and index separately, splitting whatever signals that page has earned across a set of addresses none of which is the one you would have chosen. The canonical link is how you nominate the winner, and the interesting part is deciding what it should say.**

## Where the duplicates come from

| Source | Example | Visible in the route tree? |
|---|---|---|
| Search params | `/board?filter=open` | 🔴 **no** |
| Param order | `/board?a=1&b=2` vs `?b=2&a=1` | no |
| Tracking params | `/pricing?utm_source=newsletter` | no |
| Trailing slash | `/pricing/` vs `/pricing` | no — it is a config option |
| Case | `/Pricing` vs `/pricing` | no |
| Optional catch-all | `/shop`, `/shop/a`, `/shop/a/b` | partly |
| Locale prefix | `/en/pricing`, `/de/pricing` | yes |
| Pagination | `/blog?page=2` vs `/blog/page/2` | partly |

Only the last two are things a route tree makes you think about. The rest arrive from outside — a marketing campaign, a partner's link, a crawler trying variations — which is why the defence has to be declared per page rather than discovered per URL.

## Computing a canonical from `params`

The rule from [02b](02b-twitter-cards-and-the-companion-blocks.md) still governs: canonical is a **leaf** concern, because it is a statement about one page's identity, and inheritance from a layout applies it to every descendant.

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  return {
    title: post.title,
    alternates: {
      // Derived from params, so it cannot drift from the route
      canonical: `${BASE_URL}/blog/${slug}`,
    },
    openGraph: {
      // Meta's own guidance: the undecorated URL, no session or tracking params
      url: `${BASE_URL}/blog/${slug}`,
      title: post.title,
    },
  }
}
```

🔴 **`searchParams` is deliberately absent.** The canonical for a filtered board is normally the *unfiltered* board, because the filtered view is not a distinct piece of content — it is a view of the same content. Include the params and you have canonicalised nothing; every filter combination remains its own indexable URL that points at itself.

The exception is when a parameter genuinely changes what the page *is*:

```tsx
// app/shop/page.tsx — category is content-bearing; sort and view are not
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; view?: string }>
}): Promise<Metadata> {
  const { category } = await searchParams

  return {
    alternates: {
      canonical: category
        ? `${BASE_URL}/shop?category=${encodeURIComponent(category)}`
        : `${BASE_URL}/shop`,
    },
  }
}
```

Note the cost of that decision, spelled out in [01f](01f-metadata-under-cache-components.md): reading `searchParams` in `generateMetadata` is a request-time API, so under Cache Components it makes the metadata dynamic and can raise a blocking-prerender insight. **A canonical that varies by search param is a caching decision as much as an SEO one**, which is a good reason to prefer the simple form unless the parameter really is part of the content's identity.

⚠️ `searchParams` is only provided to `generateMetadata` in `page.js` segments, not in layouts — another reason canonical belongs in the leaf.

## Trailing slash, case and the other normalisations

**Trailing slash** is a Next.js configuration option, and the only thing that matters about it is that you pick one form and that everything agrees: the canonical, the `og:url`, the sitemap, and your internal links. Two forms in circulation means a crawler discovers both and you have created the duplicate yourself.

**Case** is not normalised by anything. `/Pricing` and `/pricing` are different URLs to a crawler, and whether they both resolve depends on your platform's routing. If both resolve, one should redirect to the other.

**The `og:url` / `canonical` agreement** is worth checking mechanically, because the two are set in different fields and normalised differently — the reference's own example shows `'https://nextjs.org'` emitted as `https://nextjs.org/` in `og:url` ([02](02-open-graph-twitter-cards-structured-json-ld.md)). And Meta's guidance for `og:url` is *"the undecorated URL, without session variables, user identifying parameters, or counters"* — the same value the canonical wants.

## Redirect hygiene

Three rules, none of which is Next.js-specific and all of which an App Router codebase breaks routinely:

1. **Never link internally to a URL that redirects.** Each hop is a fetch a crawler must make and a small loss for a user, and chains grow silently as slugs change over years. Update the links.
2. **Never list a redirecting URL in the sitemap.** A sitemap is a list of canonical destinations; listing a redirect tells the crawler you do not know your own URLs.
3. **A redirect and a canonical are not alternatives.** A redirect moves the request; a canonical nominates a preferred address for content served at several. Using a canonical where you meant a redirect leaves the duplicate reachable and indexable.

The one Next.js-specific note: `redirect()` inside `generateMetadata` is legal, and it is the right tool when the *identity* of the resource has changed — a renamed slug that must move even for a metadata-only request.

## Hint versus directive

⚠️ **This is where this page stops asserting.** A canonical link is widely described as a hint that engines may or may not follow, while `noindex` is described as a directive; **Google's canonicalization documentation was not fetched for this page**, so the strength of the signal is not claimed here. What *is* sourced is the `noindex` rule, and it is the one that changes behaviour:

> *"For the `noindex` rule to be effective, the page or resource must not be blocked by a robots.txt file, and it has to be otherwise accessible to the crawler."*

Which produces a clean decision table for a duplicate URL:

| Situation | Tool |
|---|---|
| Same content, several addresses, all should stay reachable | `alternates.canonical` on each, pointing at the preferred one |
| The URL should not exist any more | a redirect |
| The page must be reachable but must not be listed | `metadata.robots: { index: false }` — and **no `Disallow`** |
| The URL space is infinite and expensive to crawl | `Disallow` in `robots.ts` — accepting that it does not deindex |

## Pagination

Page 2 of a list is not a duplicate of page 1, and canonicalising it to page 1 hides its content. The `metadata.pagination` field exists for `rel="prev"`/`rel="next"` relationships; whether a given engine still uses them is outside what this page can source. The defensible position, which needs no external claim:

- Each paginated URL is its own canonical.
- Every paginated URL must be reachable by following links from page 1, so the content is discoverable regardless of what any engine does with pagination hints.
- Do not `noindex` deep pages that contain the only link to some items, or those items become unreachable.

## Gotchas

**★ A canonical set in a layout points every child page at the layout's URL.** Metadata inherits. The whole subtree is declared a duplicate of one page. Fix: set `canonical` in the leaf `page.tsx`, computed from `params`.

**★ The canonical includes the filter parameters, so every filter combination canonicalises to itself.** You have declared the duplicates as originals. Fix: canonicalise to the unfiltered URL unless the parameter genuinely changes the content.

**★ Adding a canonical that reads `searchParams` makes the route dynamic.** `searchParams` is a request-time API, so under Cache Components the metadata can no longer be prerendered. Fix: only vary the canonical by a parameter that is genuinely content-bearing, and expect the caching consequence when you do.

**★ `og:url` and `canonical` differ by a trailing slash.** They are separate fields, normalised at different points. Fix: derive both from one string in one place.

**★ Internal links point at URLs that redirect.** Slug changes accumulate. Fix: update the links; the redirect is for external inbound traffic, not for your own navigation.

**★ The sitemap lists redirecting URLs.** It should list destinations only. Fix: generate the sitemap from the same predicate the pages use, so a renamed slug cannot appear in one and not the other ([03](03-sitemapts-and-robotsts-automation-localized-metadata-for-i18.md)).

**★ You used a canonical where you meant a redirect.** The old URL stays reachable, keeps serving content and keeps being linked. Fix: if the address should not exist, redirect it.

**★ A `Disallow` was added to "clean up" duplicate URLs, and they are still in the index.** Blocking crawling does not deindex, and it prevents the crawler from seeing any `noindex` you also set. Fix: `noindex` on a crawlable URL; block only for crawl-cost reasons ([03b](03b-robotsts-and-the-crawl-directives.md)).

**★ Deep pagination pages are `noindex`ed and some items are now unreachable.** The only link to those items was on a page you told the crawler to ignore — and `noindex` does not stop link following, but combining it with a `Disallow` does. Fix: keep pagination crawlable, and provide an alternative path to deep items via the sitemap.

**★ Tracking parameters have created hundreds of indexed variants of one landing page.** Campaign URLs were shared publicly and crawled. Fix: a canonical on the page pointing at the undecorated URL, which is the case canonicals are unambiguously for.

**★ Both `/Pricing` and `/pricing` resolve.** Nothing normalises case. Fix: redirect one to the other at the platform or proxy layer, and be consistent in every internal link.

## Interview questions

**★ Why should a canonical almost never include search parameters?**
Because a filtered or sorted view is usually the same content presented differently, and the point of a canonical is to nominate one address for one piece of content. If `/board?filter=open` canonicalises to itself, you have not consolidated anything — every filter combination is still a separate self-declared original, and a crawler that discovers a dozen of them indexes a dozen near-identical pages. The exception is a parameter that changes *what the page is about*, such as a category, where the filtered view is genuinely distinct content and deserves its own canonical. There is also a caching consequence: reading `searchParams` in `generateMetadata` is a request-time API, so a param-varying canonical makes the metadata dynamic.

**★ You have `/blog/old-slug` and `/blog/new-slug` serving the same post. Canonical or redirect?**
Redirect. A canonical is for content that is legitimately served at several addresses that should all keep working — a print view, a syndicated copy, a URL with tracking parameters. A renamed slug is not that: the old address should stop being a valid way to reach the post, and a redirect makes that true for users, crawlers and anything else that follows links. Using a canonical here leaves the old URL live and linkable indefinitely, and you will still be maintaining two addresses in three years.

**★ Where does `canonical` belong in the route tree, and why is a layout wrong?**
In the leaf `page.tsx`, normally computed from `params` in `generateMetadata`. A layout is wrong for the same mechanical reason it is right for `robots: { index: false }`: metadata inherits down the tree, so a canonical declared in a layout is emitted by every route beneath it, each of which then claims to be a duplicate of the layout's own URL. The test is whether the value is a property of the subtree or of the individual page — indexing policy is usually the former, identity is always the latter. The API reinforces this: `searchParams` is only provided to `generateMetadata` in `page.js` segments.

**★ Someone adds `Disallow: /search` to reduce crawl load and reports that the search pages are still in the index. Explain.**
`robots.txt` governs crawling, not indexing — Google's own introduction says it is used mainly to avoid overloading the site and is not a mechanism for keeping a page out of the index. A URL that is linked from elsewhere can be listed without ever being fetched, typically with no snippet. Worse, the block guarantees any `noindex` on those pages is never read, because the crawler never fetches them. If both outcomes are wanted, the order matters: `noindex` first while the pages remain crawlable, wait for them to drop out, then add the `Disallow` for the crawl-cost benefit.

**★ What is the risk in canonicalising every paginated page to page 1?**
That the content on pages 2 onward becomes invisible. A canonical is a claim that this URL's content is available at the target address, and for page 7 of a list that claim is false — the items on it are nowhere on page 1. The consequence is that items only reachable through deep pagination stop being discoverable through search entirely. The safe design is that each paginated URL is its own canonical, every page is reachable by following links from page 1, and the sitemap provides a second, flat path to the individual items so that discovery does not depend on how any particular engine treats pagination.

---

← [SEO pitfalls in RSC and streaming setups](05-common-seo-pitfalls-in-rsc-streaming-setups-and-automated-au.md) · [Chapter 12 overview](01-explanation.md) · Next → [Auditing SEO in CI](05c-auditing-seo-in-ci.md)
