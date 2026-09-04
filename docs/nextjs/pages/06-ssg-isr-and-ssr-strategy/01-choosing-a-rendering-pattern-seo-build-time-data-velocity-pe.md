---
title: "Every route starts as a prerendered static shell, so choosing a rendering pattern is a subtractive decision — you are deciding which of SEO, build time, data velocity and personalization forces you off the default, and what that costs"
sidebar_label: "01 · Choosing a rendering pattern"
sidebar_position: 1
description: "The SSG/ISR/SSR vocabulary belongs to the Pages Router. In App Router 16.3.4 the question is which parts of a tree can complete before a request exists — with the SEO and build-time axes made operational, including the bot path that re-renders your whole page."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `version: 16.3.4`, `lastUpdated: 2026-08-25`), [How to implement Incremental Static Regeneration (ISR)](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated: 2026-06-23`) and [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) (`lastUpdated: 2026-08-25`).
> ⚠️ `https://nextjs.org/docs/app/getting-started/partial-prerendering.md` **404s** — there is no standalone PPR page in 16.3.4; PPR is documented inside the Caching page. `next` is **not installed in this checkout**, so no package probe of Next.js was possible; `react` probes at **19.2.8**.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node >= 20.9**. Documentation-verified; **no sandbox run**.

**You will be asked "should this page be SSG, ISR or SSR?" roughly weekly, and the honest answer is that the question imports a model the App Router does not have. There is one renderer. It runs once at build time over as much of your tree as can complete without a request, and again at request time over whatever is left. Choosing a rendering pattern means choosing what is left — and the default is *nothing*. So the decision is subtractive: a route stays a prerendered static shell until something in it forces otherwise, and your job is to know exactly what those forcing things are, which of the four axes in this chapter's title is actually applying the force, and what you pay when you give in. This chunk covers the framing and the two axes people get wrong in opposite directions: SEO, which almost never forces anything in 16.3.4, and build time, which silently sets the ceiling on how fast you can ship a fix.**

## The words in the title come from a framework you are not using

`getStaticProps`, `getStaticPaths` and `getServerSideProps` made rendering mode a **per-file, mutually exclusive** choice. That is where "SSG vs ISR vs SSR" comes from, and it is why the question feels like it should have one answer per page. In the App Router it does not, because a single route routinely contains all three at once.

| The word you will hear | What it actually is in 16.3.4 | What decides it |
|---|---|---|
| **SSG** | Prerendering: HTML plus a serialized RSC payload produced at build and servable from a CDN | Nothing forced the work to request time |
| **ISR** | A prerendered route given a lifetime, regenerated in the background after it expires | `revalidate` (previous model) or `cacheLife` (Cache Components) |
| **SSR** | A request-time render of a subtree — or, under the previous model, of the whole route | A runtime API read, an uncached read, non-determinism, or a force flag |
| **CSR** | A fetch issued by a Client Component after hydration | `'use client'` plus a client data library |

Two consequences follow immediately, and both are load-bearing for every decision on this page:

1. **"Make it SSR" is not an action you perform on a route.** It is what *happens* to a route when something inside it reads the request. The mechanism is [ch4 · static vs dynamic rendering](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md), and the flags that override the inference are [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md). This page does not repeat either; it tells you which one you should want.
2. **The unit of the decision changed in 16.** Under the previous model the unit is the **route**: one `cookies()` read anywhere in the tree and the entire route renders per request. Under Cache Components the unit is the **component**. The Caching page states the difference outright:

> *"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the previous rendering model did. The Suspense boundary provides fallback UI where the runtime access streams, while static and cached content still ship in the initial HTML."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

Everything else on these four chunks is downstream of that sentence. If you are on the previous model, personalization is an all-or-nothing route-level decision and you will make painful trade-offs. If Cache Components is on, personalization is a boundary-placement problem and most of the painful trade-offs disappear. Know which model you are in **before** you argue about rendering patterns; see [ch5 · choosing a cache directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md).

## The default is a static shell, and the exact list of things that take work out of it

The reason "static until something forces otherwise" is the honest default is not ideology; it is that the static shell is the only artefact in the system that can be served without your server:

> *"Every produced static shell can be served directly from a CDN, without going through to the upstream server. This makes direct navigations instant."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

> *"This rendering approach is called **Partial Prerendering (PPR)**, the default behavior with Cache Components."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

The complete list of things that pull work out of the shell, from the same page:

- **Runtime APIs** — the doc's own four: `cookies` (*"User's cookie data"*), `headers` (*"Request headers"*), `searchParams` (*"URL query parameters"*), and `params` (*"Dynamic route parameters"*) for values `generateStaticParams` did not enumerate.
- **Uncached async I/O** — a `fetch` or database call that is not inside `use cache`. It must sit behind a `<Suspense>` boundary or the build refuses it.
- **Per-request non-determinism** — `Math.random()`, `Date.now()`, `crypto.randomUUID()`. (`performance.now()` is exempt: *"performance.now() is meant for telemetry, so Next.js doesn't treat it as a value to guard."*)
- **Explicit deferral** — `connection()`, which exists precisely to say "this must run per request" out loud.
- **A force flag someone added** — `dynamic = 'force-dynamic'`, `revalidate = 0`, or, per the ISR guide's caveat, *"If any of the `fetch` requests used on a route have a `revalidate` time of `0`, or an **explicit** `no-store`, the route will be dynamically rendered."*

🔴 **Read that last caveat's word "explicit" carefully.** A `fetch()` with no options is *not* an explicit `no-store`. It leaves the route prerendered and its data frozen at build — static and stale, not dynamic. That distinction is the single most reliably-inverted fact in this area; [ch4 · static vs dynamic rendering](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) is the mechanism, and the ISR caveat above is the sentence that keeps the two claims from contradicting each other.

Nothing else on that list. Not `<Suspense>` by itself:

> *"`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

## Axis 1 — SEO: what a crawler actually needs, and why "SSR for SEO" is mostly cargo cult in 2026

A crawler needs four things: a URL that resolves, a `200`, content it can read, and metadata it can attribute to that URL. Notice what is not on that list — *when* the HTML was produced. A page prerendered eleven days ago and a page rendered eight milliseconds ago are the same document to a crawler, and the prerendered one arrives faster, which is the part search actually scores.

Two documented behaviours settle most SEO arguments before they start.

**First, the framework already special-cases crawlers.** This is the fact that retires "we need SSR for SEO":

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

Choosing request-time rendering for **all** traffic so that crawlers get a complete document pays the cost on 100% of requests to fix a path the framework already handles for the sub-1% that are bots.

**Second, metadata streams — and the docs say the bots that matter cope with it.**

> *"When `generateMetadata` resolves, the resulting metadata tags are appended to the `<body>` tag. We have verified that metadata is interpreted correctly by bots that execute JavaScript and inspect the full DOM (e.g. `Googlebot`)."*
> — [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

> *"For **HTML-limited bots** that can't execute JavaScript (e.g. `facebookexternalhit`), metadata continues to block page rendering. The resulting metadata will be available in the `<head>` tag."*
> — [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

Both cases are handled, in opposite ways, by user-agent detection you did not write.

### Where SEO does legitimately force a decision

- **Metadata that depends on runtime data on an otherwise-static page.** Under Cache Components this is a build-time refusal, not a silent downgrade: *"Next.js requires an explicit choice: cache the data if possible, or signal that deferred rendering is intentional."* The documented fix for external-but-not-runtime data is to cache the metadata read:

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: PageProps<'/blog/[slug]'>) {
  'use cache'
  const { slug } = await params
  const post = await db.post.findUnique({ where: { slug } })
  return { title: post.title, description: post.excerpt }
}
```

- **The URL set must be discoverable.** If a page only exists behind a `searchParams` filter, no rendering pattern saves it — it needs a real route segment. That is a routing decision wearing a rendering costume.
- **The page is behind auth.** Then it has no SEO axis at all, and half the arguments you will hear about this page are void. A crawler never sees a logged-in dashboard. Say so in the meeting and move to the personalization axis in [01c](01c-personalization-without-going-dynamic.md).

## Axis 2 — build time: the axis nobody writes down, which decides your deploy cadence

Build time appears in the ISR guide's benefits list as a first-class reason the feature exists:

> *"Handle large amounts of content pages without long `next build` times"*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

The mechanism is simple arithmetic you can do on a whiteboard: prerendering runs your component tree once per enumerated URL, so `generateStaticParams` returning 500,000 product IDs buys you 500,000 renders plus whatever query enumerated them — on every deploy, including the deploy that fixes a typo.

🔴 **And you pay it again every deploy, because none of the caches survive one:**

> *"All of these stores are scoped to a single deployment. A new deploy starts fresh, new prerenders are built, and `use cache` entries don't carry over, even durable `remote` ones, because the cache key includes the build id."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

That sentence collapses build time and cache warmth into one axis. A large prerendered set is not just a slow build; it is a cold cache on the other side of every release.

**The operational consequence is the one that matters at 2am: your build duration is the floor on your time-to-fix.** If a copy change in a legal banner takes 40 minutes to reach production because the build prerenders a quarter of a million pages, you did not choose a rendering pattern, you chose an incident response time. The documentation gives **no threshold** for how many params are too many — treat any build longer than your incident SLA as a design defect regardless of size.

**The lever is that you never had to enumerate everything.** Prerender the head; let the tail arrive on demand:

```tsx
// app/products/[id]/page.tsx
export async function generateStaticParams() {
  // The head of the traffic distribution, not the catalogue.
  const top = await db.product.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { unitsSoldLast30Days: 'desc' },
    take: 1000,
    select: { id: true },
  })
  return top.map((p) => ({ id: p.id }))
}
```

> *"If `/blog/26` is requested, and it exists, the page will be generated on-demand. This behavior can be changed by using a different `dynamicParams` value. However, if the post does not exist, then 404 is returned."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

Under Cache Components the unenumerated case is even cheaper, because the reusable part of the shell still ships instantly: *"Any other URL is served the App Shell instantly, then upgraded in the background with its now-known params and cached for the next visitor."* The scale mechanics live in [02 · `generateStaticParams` at scale](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md); the flag semantics, including the `dynamicParams = false` trap, are [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md).

## Gotchas

**★ Symptom: the page renders perfectly in a browser and errors or comes back empty for Googlebot.** Cause: the bot path does not reuse your shell — it re-renders the whole page at request time, so any input that only existed during the build is now missing. The docs are explicit: *"If part of your shell depends on inputs that only exist while prerendering, such as build-time data or values that are not reachable in the request-time environment, a page that loads for a person can fail to render for a crawler."* Typical culprits: a JSON file baked into the build image but absent from the runtime image, a build-only environment variable, a filesystem read relative to the build working directory. Fix: make the shell's data reachable at request time, and read it the same way in both:

```tsx
// lib/site-config.ts — same source at build and at request time
export async function getSiteConfig() {
  'use cache'
  const res = await fetch(`${process.env.CONFIG_ORIGIN}/site.json`)
  return res.json()
}
```

**★ Symptom: someone "fixed SEO" and TTFB regressed for every human visitor.** Cause: `htmlLimitedBots: /.*/` in `next.config.ts` disables streaming metadata for *everyone*, so every response now blocks until `generateMetadata` resolves. The docs warn about exactly this: *"Overriding `htmlLimitedBots` could lead to longer response times. Streaming metadata is an advanced feature, and the default should be sufficient for most cases."* Fix: revert it and, if a specific preview crawler misbehaves, add only that user agent to the list.

**★ Symptom: the build fails naming `generateMetadata` on a page that has no other dynamic behaviour.** Cause: the metadata read runtime data or did an uncached fetch while the rest of the page was fully prerenderable; Next.js refuses to guess. The doc names the error identifiers `blocking-prerender-metadata-runtime` and `blocking-prerender-metadata-dynamic`. Fix: either `'use cache'` inside `generateMetadata` as shown above, or, if it genuinely needs the request, the documented dynamic-marker component:

```tsx
// app/page.tsx
import { connection } from 'next/server'
import { Suspense } from 'react'

async function DynamicMarker() {
  await connection()
  return null
}

export default function Page() {
  return (
    <main>
      <Suspense fallback={null}>
        <DynamicMarker />
      </Suspense>
    </main>
  )
}
```

**★ Symptom: a one-line copy fix cannot ship during an incident because the deploy takes 40 minutes.** Cause: `generateStaticParams` enumerates the whole catalogue, so every deploy re-renders it. Fix: cut the enumerated set to the traffic head (code above) and let the tail generate on demand; the long tail is, by definition, the part nobody is waiting for.

**★ Symptom: existing CMS URLs update fine, but a newly published article 404s forever.** Cause: revalidation refreshes known paths; it never discovers new ones — *"During revalidation (ISR), `generateStaticParams` will not be called again"* ([`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)) — and if `dynamicParams = false` is set, unenumerated paths 404 by design. Fix: leave `dynamicParams` at its default so first visit generates the page, or trigger a real rebuild from the publish webhook. A `revalidatePath` call cannot create a path that was never generated.

**Symptom: the first request to every page is slow after each deploy, across the whole site.** Cause: not a regression — caches are keyed by build id and start empty. Fix: nothing to fix in code; plan for it. If the cold window is unacceptable, shrink the set that is *runtime-cached but not prerendered*, because prerendered pages arrive warm and cached-at-runtime pages do not.

**Symptom: `next build` time doubled after adding a second locale.** Cause: enumerated param sets multiply — locales × slugs × variants — and the multiplication is invisible in the code, which just returns an array. Fix: enumerate the cross product deliberately and cap it, prerendering the primary locale's head and letting secondary locales generate on demand.

**Symptom: an SEO consultant asks for "server-side rendering" and the team ships `force-dynamic`.** Cause: vocabulary mismatch — they mean "the content must be in the HTML", which prerendering already satisfies better. Fix: show them `view-source` on a prerendered route. If content is genuinely missing from the document, the cause is a Client Component fetching after hydration, not the absence of `force-dynamic`; see [ch4 · client-side data fetching](../04-data-fetching-in-the-app-router/14-client-side-data-fetching-and-when-it-is-still-correct.md).

## Interview questions

**★ Why is "should this page be SSG or SSR?" the wrong question in the App Router?**
Because it presumes rendering mode is a property of a file, which was true when `getStaticProps` and `getServerSideProps` were mutually exclusive exports. In 16.3.4 there is one render pass at build over everything that can complete without a request, and a second at request time over whatever could not. A single route commonly has prerendered chrome, a `use cache` section with an hourly lifetime, and a per-request personalized hole — SSG, ISR and SSR simultaneously. The useful question is "which parts of this tree cannot complete before a request exists, and why", and the answer is a list of components rather than a mode.

**★ Your PM says the marketing site needs SSR for SEO. What do you say?**
That crawlers already get a complete document: Next.js detects bots by user agent and, rather than serving the static shell, renders the entire page at request time and sends the finished HTML. Making every human request pay for request-time rendering to serve the crawler path is a cost with no matching benefit — and prerendered pages are faster, which search does score. Then I would ask what they actually observed, because "SEO needs SSR" is usually a report of missing content in `view-source`, whose real cause is a Client Component fetching after hydration.

**★ What can break for a crawler that does not break for a user?**
Anything the shell got at build time and cannot get again. Because the bot path re-renders the whole page at request time instead of reusing the shell, work that succeeded during the build now runs in the production runtime: a config file that existed in the build image, a build-only secret, a path relative to the build directory. The user is served the prerendered artefact and never exercises that code; the crawler is the only traffic that does, which is why this shows up as a search-console error nobody can reproduce.

**★ How does the choice of rendering pattern constrain incident response?**
Through build duration. Every prerendered URL is a render your pipeline performs on every deploy, and none of the caches survive a deploy because the cache key includes the build id. So a large prerendered set means both a long build and a cold cache after each release, and your time-to-deploy-a-fix is bounded below by that build. If the build is longer than your incident SLA, the rendering decision has become an operations decision, and the remedy is to prerender the traffic head and let the tail be generated on demand.

**Why are build time and cache warmth the same axis rather than two?**
Because the documentation states that all cache stores are scoped to a single deployment and `use cache` entries do not carry over, even durable remote ones. Whatever you did not prerender is cold at release. Prerendering more makes the build longer but the post-deploy experience warmer; prerendering less does the opposite. You are moving a cost between two places, not eliminating it.

**You enumerate 500,000 product IDs in `generateStaticParams`. What have you bought and what are you paying?**
You bought a CDN-servable document for every product, with no origin hit and no cold-start on first visit. You are paying 500,000 renders plus the enumeration query on every deploy, a correspondingly long build, storage for every artefact, and the risk that the majority of those pages are never requested at all. The documentation gives no threshold for "too many" — the honest test is whether your traffic distribution justifies it, and for a catalogue it almost never does past the first few thousand SKUs.

---

← [Chapter index](01-explanation.md) · Next → [Data velocity and the staleness budget](01b-data-velocity-and-the-staleness-budget.md)
