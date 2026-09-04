---
title: "The rendering decision is never settled by SEO or by performance, because every option in Next.js 16 satisfies both — it is settled by who controls content velocity, and for marketing pages that answer is a person who does not deploy"
sidebar_label: "05 · Deciding, and marketing pages"
sidebar_position: 18
description: "The decision frame for choosing a rendering strategy — requirements, the forcing axis, the pattern, what you gave up, the review trigger — applied end to end to a marketing site, where the answer is on-demand revalidation rather than time-based ISR."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) (docs `lastUpdated` 2026-03-30) and [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms) (`lastUpdated` 2026-03-30).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. The walkthroughs are worked architectural judgement built on documented mechanics — **no measurements, no benchmark figures and no cost numbers appear**, because none were run.

**Every rendering-strategy argument I have watched go badly was argued on the wrong axis. "We need SSR for SEO" — no: a prerendered page is strictly better for SEO than a server-rendered one, because it is already HTML before the crawler asks. "We need SSR for freshness" — usually no: on-demand revalidation gives you freshness in seconds without giving up the cache. The axis that actually forces the decision is *who changes the content, and how fast they expect it live*, followed by *which parts of the page depend on the request*. This chunk sets out the frame as a five-line decision record and then runs it end to end on a marketing site, where the correct answer is prerendering plus on-demand revalidation, and where the thing you give up is per-request personalisation — which the marketing team will ask for in month four.**

## The frame

Next.js changed what the question even is. The old framing was route-level:

> *"Most web frameworks draw a hard line between static and dynamic at the route level. A page is either prerendered at build time or server-rendered at request time. This model is simple to understand and simple to deploy: you upload static files to a CDN and point dynamic routes at a server."*

> *"Next.js takes a different approach: **the boundary between static and dynamic is at the component level, not the route level.**"*

So "is this page SSG or SSR" is a question with no answer for most real pages. The questions
that do have answers:

1. **Which parts of this page depend on the request?** Cookies, headers, search params, the
   user's identity. Those parts, and only those, must be dynamic.
2. **Who changes the rest, and how fast do they expect it live?** An engineer on deploy? An
   editor in a CMS in five minutes? A price feed every thirty seconds?
3. **What is the cost of serving it slightly stale?** Wrong marketing copy for ten minutes is a
   shrug. A wrong price is a legal problem. A wrong permission is a breach.
4. **How many of these pages are there, and are they enumerable?** This decides whether the
   build is a constant or a function of your content volume.
5. **What breaks first when it grows tenfold?** Build time, cache size, origin load, or
   database connections.

Notice what is not on that list: SEO and Core Web Vitals. Every option below produces HTML the
crawler can read, and the difference between them at the 75th percentile is dominated by
whether the response was cached, not by which API generated it.

### The decision record

Five lines. Anything longer does not get written; anything shorter does not get revisited.

```text
Requirements     — what the page must do, in the product's own words
Forcing axis     — the one requirement that eliminates every other option
Pattern          — the mechanism chosen, named precisely
Gave up          — the capability this costs, stated as a capability, not a caveat
Review trigger   — the observable event that reopens this decision
```

The **review trigger** is the line that most teams omit, and it is the one that makes the
decision safe to make quickly. A decision with an expiry condition can be made in an hour. A
decision meant to hold forever gets argued for three weeks.

## Walkthrough 1 — the SprintDesk marketing site

`sprintdesk.com`: home, pricing, features, about, plus a blog and a changelog. Roughly a hundred
pages, growing by a handful a week.

### Requirements

- **Fast on a phone on a train.** This is the actual acquisition constraint.
- **Indexable**, including the blog, including pages published minutes ago.
- **Marketing edits copy in a CMS and expects it live in minutes** — without a deploy, without
  an engineer, and specifically without waiting for CI.
- A **cookie consent banner** and analytics.
- **Prices shown in the visitor's currency.**
- Occasional **A/B tests on the headline**.

### The forcing axis

Requirement three, alone. Everything else has multiple acceptable implementations:

- *Fast on a phone* — prerendered HTML from a CDN. Every candidate option does this.
- *Indexable* — same. A crawler sees complete HTML in every candidate.
- *Currency* — a small dynamic element, not a page-level property.
- *A/B tests* — a small dynamic element, not a page-level property.

But **"live in minutes, no deploy, no engineer"** eliminates two entire options outright. It
eliminates static export, because item 9 of its unsupported list is ISR and the only refresh
mechanism left is a rebuild (see [04](04-full-static-export-vs-serverful-edge-distribution.md)).
And it eliminates plain build-time prerendering for the same reason — the docs' own description:

> *"Every page is generated at build time. … This is the simplest model to deploy, but every content change requires a rebuild and redeploy."*

That leaves prerendering plus revalidation. And within revalidation it forces one more choice,
which is the interesting part: **time-based or on-demand?**

Time-based ISR means the editor waits for the window to elapse *and* for a request to arrive.
Set `revalidate: 60` and the honest promise to marketing is "somewhere between one minute and
never, depending on traffic." On a low-traffic pricing page that is genuinely never. On-demand
revalidation, triggered by the CMS's own publish webhook, makes the promise "as soon as you
press publish", which is what was actually asked for.

**Pattern: prerendered pages, tagged per content type, invalidated by the CMS webhook.**

### The implementation

```tsx
// app/(marketing)/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getPost, getAllPostSlugs } from '@/lib/cms'

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <time dateTime={post.publishedAt}>{post.publishedAt}</time>
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  )
}
```

```ts
// lib/cms.ts — tagging is what makes targeted invalidation possible
import { cacheTag } from 'next/cache'

export async function getPost(slug: string) {
  'use cache'
  cacheTag('post', `post:${slug}`)

  const res = await fetch(`${process.env.CMS_URL}/posts/${slug}`)
  if (res.status === 404) return null
  return res.json()
}
```

```ts
// app/api/cms-webhook/route.ts — the CMS calls this on publish
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  if (request.headers.get('x-cms-secret') !== process.env.CMS_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { type, slug } = await request.json()
  if (type !== 'post' || typeof slug !== 'string') {
    return new Response('Ignored', { status: 202 })
  }

  revalidateTag(`post:${slug}`, 'max')
  return Response.json({ revalidated: true })
}
```

The tag granularity is the design decision here: `post:${slug}` so one edit invalidates one
page, plus a broad `post` tag so a template change can invalidate the set. The `'max'` profile
keeps the site serving stale content instantly while the fresh version is fetched — the
mechanics live in [ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md)
and the tag surface in [ch5 · choosing a cache directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md).

The two request-dependent elements stay out of the page's static path entirely:

```tsx
// app/(marketing)/pricing/page.tsx — the page is prerendered; the price is not
import { Suspense } from 'react'
import { PriceTable } from './price-table'
import { LocalisedPrice } from './localised-price'

export default function Pricing() {
  return (
    <main>
      <h1>Pricing</h1>
      <PriceTable />
      <Suspense fallback={<PriceTable.Skeleton />}>
        <LocalisedPrice />
      </Suspense>
    </main>
  )
}
```

`LocalisedPrice` is the dynamic hole; everything around it is the static shell. That is Partial
Prerendering, and it is exactly what the component-level boundary is for —
[ch5 · composing static, ISR and dynamic on one page](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01b-composing-the-three.md).

### What you gave up

**Per-request personalisation of the shell.** The prerendered HTML is identical for everyone, so
anything that varies by visitor is either a dynamic hole (a server round trip, a skeleton) or
client-side (a flash of the default). You cannot server-render "Welcome back, Priya" into the
cached hero. This is the constraint marketing will push on in month four, and the answer is
either PPR or a client component — never "make the page dynamic", which throws away the entire
basis of the decision.

**Whole-page A/B tests.** A headline experiment means two variants of a cached page, which means
either a `proxy.ts` rewrite splitting traffic across two cached routes, or client-side swapping
with the layout shift that implies. Both are worse than the server-rendered version would have
been. This is a genuine cost, not a caveat.

**Immediate consistency on the first request after a publish.** With the `'max'` profile the
first visitor after a `revalidateTag` still sees stale content while the fresh version is
fetched. If an editor refreshes instantly to check their change, they may see the old copy once.
Tell them that in advance; it is the single most common "the CMS is broken" ticket.

### Review trigger

Reopen this decision when any of these is observably true:

- Personalised marketing content becomes a **committed roadmap item**, not a request — at that
  point the shell itself is per-visitor and PPR's dynamic holes stop being sufficient.
- The number of concurrently running experiments exceeds what route-variant caching tolerates,
  because the cache is now fragmented across a combinatorial set of variants.
- Build duration crosses a threshold you would notice during an incident, because
  `generateStaticParams` enumerates every post — see [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md)
  for capping the head and generating the tail.

## Gotchas

**★ Symptom: the team argues for SSR on SEO grounds and cannot be moved.** Cause: "static" is heard as "client-rendered SPA", which genuinely was an SEO problem a decade ago. Fix: reframe in terms of what the crawler receives — a prerendered page is complete HTML *before* the request arrives, which is strictly better than HTML computed during it. Then move the discussion to the axis that actually decides: who edits the content and how fast they need it live.

**★ Symptom: marketing was promised "updates in one minute" via `revalidate: 60`, and a low-traffic page stays stale for days.** Cause: time-based revalidation is triggered by a request, not by a timer — no traffic, no regeneration. Fix: on-demand `revalidateTag` from the CMS publish webhook, as above. Time-based revalidation is a freshness *ceiling* for pages that get traffic, never a freshness guarantee.

**★ Symptom: a single CMS edit invalidates the entire site and origin load spikes.** Cause: one broad tag on every fetch, so every publish invalidates everything. Fix: tag at the granularity you intend to invalidate — `post:${slug}` for the item, `post` for the collection — and have the webhook choose based on the event payload. A tag you never invalidate selectively is a tag you did not need.

**★ Symptom: the consent banner or the currency selector makes every marketing page dynamic.** Cause: something in a shared layout reads `cookies()`, which drags the whole subtree out of the static path. Fix: read the cookie in a Client Component, or isolate it behind its own Suspense boundary so only that hole is dynamic. This is the same seam failure that [06b](06b-what-breaks-at-the-seams.md) works through in code, and it is by far the most common way a "static" marketing site quietly stops being static.

**★ Symptom: an editor publishes, refreshes immediately, and sees the old page, then reports the webhook as broken.** Cause: `revalidateTag` with a stale-while-revalidate profile serves stale to the request that triggers regeneration. Fix: set the expectation explicitly, or use `updateTag` from a Server Action where the editing surface is inside your app and the immediate read must be fresh. Do not "fix" it by dropping to `{ expire: 0 }` sitewide — that turns every publish into a thundering-herd cache miss.

**★ Symptom: the blog is fast but the `/blog` index is always a post behind.** Cause: the index has its own cache entry and its own tag, and the webhook only invalidated the post. Fix: invalidate both — the item tag and the collection tag — in the same handler. Every list view containing an item is a second cache entry, and forgetting them is the most common tagging bug.

**★ Symptom: A/B variants multiply and the cache hit ratio collapses.** Cause: each variant is a separate cached route, so N experiments across M pages is a multiplicative number of entries, each getting a fraction of the traffic and therefore going cold. Fix: cap concurrent experiments and scope them to specific pages, or move experimentation client-side and accept the flash. There is no configuration that makes variant explosion cache well; it is arithmetic.

**Symptom: `generateStaticParams` is added and the blog stops 404ing correctly for deleted posts.** Cause: the deleted slug is still in the build output, or `dynamicParams` behaviour was not considered. Fix: have `getPost` return `null` and call `notFound()` as in the page above, so removal from the CMS produces a 404 on the next revalidation regardless of what the build enumerated. Never rely on the enumeration alone to define what exists.

## Interview questions

**★ Why is SEO almost never the axis that decides a rendering strategy in the App Router?**
Because every option produces complete HTML before or during the response, and crawlers read all of them. Prerendering is if anything the strongest position — the HTML exists before the crawler asks, so there is no origin latency and no risk of a slow database making the page time out during a crawl. The SEO argument is a fossil of the client-rendered SPA era. Raising it usually means the real concern is something else, most often freshness, and the productive move is to ask which content the person is worried about being stale.

**★ Marketing asks for "content live in one minute". Why is `revalidate: 60` the wrong answer?**
Because time-based revalidation is triggered by a request, not by a clock. The window is a minimum, not a maximum: if nobody visits the page, nothing regenerates, and a low-traffic pricing page can stay stale indefinitely. The requirement as stated — a *person* presses publish and expects to see it — is an event, so the mechanism should be an event: an on-demand `revalidateTag` from the CMS publish webhook. Time-based revalidation is the right tool when the *source* changes on its own schedule and nobody presses anything.

**★ A marketing page needs the visitor's currency. Walk through the options and pick one.**
Three options. Make the route dynamic — throws away the cache for the other ninety-five percent of the page that is identical for everyone, so no. Fetch the currency client-side — keeps the page fully static, costs a flash of the default and a layout shift on the most commercially important element on the site. Or leave the page prerendered and put the price behind a Suspense boundary as a dynamic hole, which is PPR: shell from cache, price from the server, one response. The third is right here precisely because the boundary in Next.js is at the component level, so you are not forced to choose per route.

**★ What belongs in a rendering decision record, and which line do teams skip?**
Requirements in the product's words; the forcing axis, meaning the one requirement that eliminates the alternatives; the pattern named precisely; the capability given up; and the review trigger. Teams skip the review trigger, and it is the most valuable line — it converts an architecture decision from something that must be right forever into something that must be right until an observable event, which is what lets you make it in an hour instead of three weeks.

**★ Why is "what did you give up" a required section rather than a nicety?**
Because a rendering decision is always a trade, and the thing you gave up is what will be requested later — usually by someone who was not in the room. Writing "we gave up per-request personalisation of the shell" in advance means that when marketing asks for a personalised hero in month four, the conversation starts from a known trade-off with a known cost, instead of from an engineer saying no for reasons that sound like preference. A decision record without a cost section reads as advocacy and gets ignored.

**★ Give a review trigger for the marketing-site decision that is genuinely observable.**
"Personalised marketing content appears on the committed roadmap" is one — it is a date on a plan, not a judgement call. "Concurrent experiments exceed the number the variant cache tolerates" is another, and it is measurable as a cache hit ratio falling. "Build duration crosses the point where you would hesitate to deploy during an incident" is the third. Each is something a person can check without re-litigating the architecture; a trigger like "when the site gets big" is not.

---

← [04d · The migration back](04d-the-migration-back-and-the-one-way-door.md) · [Chapter 6 overview](01-explanation.md) · Next → [05b · Content platforms, and the SSR reflex](05b-content-platforms-and-the-ssr-reflex.md)
