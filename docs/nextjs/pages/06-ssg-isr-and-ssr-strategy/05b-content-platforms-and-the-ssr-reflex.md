---
title: "Content platforms are where teams over-choose SSR, because one per-visitor element — a paywall, a saved badge, a view count — makes a route-level thinker declare the whole article dynamic, and the framework stopped requiring that three majors ago"
sidebar_label: "05b · Content platforms, and the SSR reflex"
sidebar_position: 32
description: "The second decision walkthrough: a publishing platform with millions of articles, a paywall, per-user recommendations and live counts. Decomposing the page by element rather than by route, and the one case where full SSR really is correct."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) (docs `lastUpdated` 2026-03-30), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25) and [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. No traffic figures, latency numbers or cost comparisons appear — none were measured.

**A publishing platform is the case where the SSR reflex is strongest and most expensive. The reasoning sounds airtight: the content is user-generated, it changes constantly, articles have comments and view counts and a paywall, so the page is dynamic. Every clause is true and the conclusion is still wrong, because those things change at four different rates and cost four different amounts when stale. The article body changes when an editor publishes. The view count changes every second and nobody notices if it is a minute old. The paywall state changes per visitor and is a revenue leak if it is wrong. Collapsing four freshness requirements into one route-level `force-dynamic` is the decision that puts a database query on the critical path of every article view — and the documentation names this exact trap when describing the model Next.js deliberately does not use.**

## The trap, in the docs' own words

Describing route-level boundaries — the model Next.js moved away from:

> *"Each route chooses whether it is static or dynamic. Static routes are prerendered at build time, dynamic routes are server-rendered per request. The infrastructure splits cleanly: static files go to a CDN, dynamic routes go to a server. This is straightforward to reason about but the choice is all-or-nothing per route. **A mostly-static page with one dynamic element (a user greeting, a live price) must either be fully dynamic or fetch that element on the client after load.**"*

That last sentence is the content-platform page, exactly. And it describes a constraint that no
longer applies:

> *"Static and dynamic content coexist within a single streaming response. A page can have a static shell that loads instantly, a cached function that revalidates independently, and a dynamic section that streams in as it resolves, all without the developer splitting anything into separate routes or client-side fetches."*

The SSR reflex is not a bad instinct. It is a correct instinct for a framework generation that
ended.

## Walkthrough 2 — SprintDesk Learn, a publishing platform

Several hundred thousand articles, a few hundred published or edited daily. Signed-out readers,
signed-in readers, and subscribers. The article page carries: the body, a byline, a view count,
a "saved to your list" indicator, a per-user recommendation rail, and a paywall after the third
paragraph for non-subscribers.

### Requirements

- Articles must be **indexable and fast for anonymous traffic**, which is the overwhelming
  majority of it.
- An **editorial correction must go live immediately** — this is a factual-accuracy obligation,
  not a nicety.
- The **paywall must be correct per visitor**, and the gated body must not be recoverable by
  anyone who is not entitled to it.
- **Recommendations are per user.**
- **View counts** are shown but nobody has ever specified their accuracy.
- The article set is **too large to enumerate at build time**.

### The forcing axis: decompose by element, not by route

The whole decision falls out of one table. Fill it in before choosing anything.

| Element | Who changes it | Rate | Cost of being stale | Therefore |
|---|---|---|---|---|
| Article body, byline, images | An editor | Daily-ish | Low, except for corrections | Cached, tagged per article, invalidated on publish |
| Editorial correction | An editor, urgently | Rare | 🔴 High — accuracy obligation | Same cache entry, invalidated with an **immediate** profile |
| View count | Every reader | Constantly | None — nobody specified accuracy | Client-side fetch, or a separately cached fragment |
| "Saved" indicator | The visitor | Per visitor | Low, but visibly wrong | Client-side, after hydration |
| Recommendation rail | Per visitor | Per visitor | Low | Dynamic hole, streamed, below the fold |
| Paywall state | The visitor | Per visitor | 🔴 Revenue and entitlement | Dynamic hole, **and the gated body must never reach the cache** |

Four different mechanisms on one page. A route-level decision can express exactly one of them.

**Pattern: a prerendered, tagged article shell with dynamic holes for the per-visitor elements,
a partially-enumerated `generateStaticParams` with the tail generated on demand, and on-demand
invalidation from the editorial system.** The enumeration strategy, what the design costs to
operate and the pages that genuinely do not decompose are
[05c](05c-operating-a-decomposed-page-at-archive-scale.md).

### The implementation

```tsx
// app/learn/[slug]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getArticle, getTopArticleSlugs } from '@/lib/articles'
import { ArticleBody } from './article-body'
import { PaywallGate } from './paywall-gate'
import { Recommendations } from './recommendations'
import { ViewCount } from './view-count'

// Prerender the head only. The tail generates on first request and is then cached.
export async function generateStaticParams() {
  const slugs = await getTopArticleSlugs(2000)
  return slugs.map((slug) => ({ slug }))
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await getArticle(slug) // cached, tagged
  if (!article) notFound()

  return (
    <article>
      <h1>{article.title}</h1>
      <p>{article.byline}</p>

      {/* No Suspense: this is the static shell and it is what the crawler reads. */}
      <ArticleBody blocks={article.freeBlocks} />

      {/* Per-visitor. Streams in; the shell is already on screen. */}
      <Suspense fallback={<PaywallGate.Skeleton />}>
        <PaywallGate slug={slug} />
      </Suspense>

      <Suspense fallback={null}>
        <Recommendations slug={slug} />
      </Suspense>

      {/* Client component: fetches after hydration, never blocks anything. */}
      <ViewCount slug={slug} />
    </article>
  )
}
```

```ts
// lib/articles.ts
import { cacheTag, cacheLife } from 'next/cache'

export async function getArticle(slug: string) {
  'use cache'
  cacheLife('days')
  cacheTag('article', `article:${slug}`)

  const res = await fetch(`${process.env.CMS_URL}/articles/${slug}`)
  if (res.status === 404) return null

  const article = await res.json()
  // 🔴 Only the free blocks are returned into the cached shell.
  return { ...article, freeBlocks: article.blocks.slice(0, article.freeBlockCount) }
}
```

🔴 **The line that matters most on this page** is the last one. The gated paragraphs are never
returned from the cached function, so they cannot end up in a cached response, in a CDN, or in
`view-source`. The paywall is not a UI state — it is a data boundary.

```tsx
// app/learn/[slug]/paywall-gate.tsx — the dynamic hole
import { cookies } from 'next/headers'
import { getEntitlement, getGatedBlocks } from '@/lib/entitlement'
import { ArticleBody } from './article-body'
import { SubscribeCta } from './subscribe-cta'

export async function PaywallGate({ slug }: { slug: string }) {
  const session = (await cookies()).get('sd_session')?.value
  const entitled = await getEntitlement(session, slug)

  if (!entitled) return <SubscribeCta slug={slug} />

  const blocks = await getGatedBlocks(slug) // server-only, never cached publicly
  return <ArticleBody blocks={blocks} />
}
```

Reading `cookies()` inside this component makes *this component* dynamic. It does not make the
page dynamic, because it is inside a Suspense boundary — that is the whole point of the
component-level boundary, and the mechanism is in
[ch5 · composing static, ISR and dynamic on one page](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01b-composing-the-three.md)
and [ch4 · streaming with Suspense](../04-data-fetching-in-the-app-router/02-async-components-streaming-with-suspense-granular-ui-blocks.md).

### Corrections need a different invalidation profile from publishes

This is the distinction most implementations miss. A new article can propagate lazily; a
correction cannot.

```ts
// app/api/editorial-webhook/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  if (request.headers.get('x-editorial-secret') !== process.env.EDITORIAL_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { slug, reason } = await request.json()

  if (reason === 'correction') {
    // Stale must not be served: the next read blocks on fresh data.
    revalidateTag(`article:${slug}`, { expire: 0 })
  } else {
    // Ordinary publish: serve stale instantly, refresh in the background.
    revalidateTag(`article:${slug}`, 'max')
  }

  return Response.json({ revalidated: true })
}
```

The profile semantics are owned by [ch5 · `revalidateTag` and `updateTag`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md);
the decision here is that **"how urgent is this change" is a property of the editorial event,
not of the route**, so it belongs in the webhook payload.

## Gotchas

**★ Symptom: every article view hits the database, and the origin scales with traffic rather than with publishing.** Cause: `export const dynamic = 'force-dynamic'` on the article segment or its layout, added because "the paywall is per user". Fix: remove it and move the per-visitor elements into Suspense boundaries as above. The rule of thumb: `force-dynamic` at the route level should be justified by the *shell* being per-visitor, never by any element of it being per-visitor.

**★ Symptom: paywalled article text is visible in `view-source`, or in the RSC payload, for a signed-out visitor.** Cause: the gated blocks were fetched into the cached shell and hidden with CSS or a client-side conditional. Fix: never return gated content from a cached function — the `freeBlocks` slice above is the mechanism. A paywall implemented in the component tree above the data layer is a revenue leak with a search-engine cache, and it is discovered by readers before it is discovered by engineers.

**★ Symptom: a correction is published and readers keep seeing the wrong text for minutes.** Cause: `revalidateTag(tag, 'max')` serves stale while revalidating — correct for a routine publish, wrong for a correction. Fix: branch on the editorial event as in the webhook above and use `{ expire: 0 }` for corrections, so the next read blocks on fresh data rather than serving the error one more time.

**★ Symptom: the view counter drags the whole article into dynamic rendering.** Cause: the counter is a Server Component reading a per-request value, and it sits in the static shell rather than inside a boundary. Fix: make it a Client Component that fetches after hydration. Nobody specified its accuracy, which is the signal that it does not belong on the server render path at all.

**★ Symptom: a `fetch()` in the article path returns data that is hours old, and the developer expected it to be fresh because they did not opt into caching.** Cause: 🔴 `fetch()`'s default leaves a route **static and stale**, not dynamic — the mental model imported from the browser is backwards here. Fix: be explicit. Cache deliberately with `use cache` plus a tag, or opt out deliberately; never rely on the default to mean "fresh". See [ch4 · static vs dynamic rendering](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md).

**★ Symptom: an editorial template change should refresh every article, and the webhook can only invalidate one at a time.** Cause: only the per-article tag was applied. Fix: apply both `article` and `article:${slug}` on the same cached function, as above. Note the documented limits when generating tags programmatically — a single `cacheTag()` call accepts up to 128 tags of at most 256 characters, and tags past those limits are silently dropped with a console warning, so a scheme that concatenates author, section and campaign identifiers can quietly stop working.

**★ Symptom: `?utm_source=newsletter` links appear to bypass the cache.** Cause: reading `searchParams` in a Server Component makes that component request-dependent. Fix: read campaign parameters client-side for analytics, and if a search param genuinely affects server rendering, isolate it in its own boundary. Marketing will add tracking parameters to every link they publish and will not tell you.

## Interview questions

**★ Why do teams over-choose SSR for content platforms specifically?**
Because the page has one obviously per-visitor element — a paywall, a "saved" badge, a greeting — and route-level thinking makes one dynamic element dynamite the whole route. The documentation describes that constraint precisely, as a property of the model Next.js chose *not* to use: a mostly-static page with one dynamic element must either be fully dynamic or fetch that element on the client. In the App Router there is a third option, so the instinct is a correct answer to a question the framework stopped asking.

**★ How do you decompose an article page before choosing a rendering strategy?**
Element by element, with four columns: who changes it, how often, what staleness costs, and therefore which mechanism. On a publishing platform that produces four different answers on one page — the body is editor-changed and cached with a tag; the correction is the same entry with an urgent invalidation profile; the view count has no specified accuracy so it goes client-side; the paywall is per-visitor and is a data boundary, not a UI state. A route-level decision can express exactly one of those four, which is why it is the wrong unit.

**★ Why is a paywall a data boundary rather than a UI state?**
Because anything the cached function returns can end up in a cached response, a CDN and a `view-source`. If the gated paragraphs are fetched into the shell and hidden by a conditional, they are public — for signed-out readers, for crawlers, and for the duration of the cache entry. The correct implementation returns only the free blocks from the cached path and fetches the gated blocks inside a request-time component that has already checked entitlement. The check must happen before the data is read, not before it is rendered.

**★ Why should a correction and a routine publish use different revalidation profiles?**
Because urgency is a property of the editorial event, not of the route. A routine publish can serve stale while it refreshes — the reader sees the previous version once and nobody is harmed. A correction is exactly the case where serving stale means serving the error one more time to somebody, and on a platform with an accuracy obligation that is the failure you were fixing. So the webhook branches on the event reason and picks the profile, which also means the decision lives with the people who know which is which.

---

← [05 · Deciding, and marketing pages](05-architecture-decision-walkthroughs-marketing-pages.md) · [Chapter 6 overview](01-explanation.md) · Next → [05c · Operating it at archive scale](05c-operating-a-decomposed-page-at-archive-scale.md)
