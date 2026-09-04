---
title: "The array `generateStaticParams` returns is a bill your CI pays every deploy, so at scale the function stops being an enumeration and becomes a budget — you pick the hot set, and `dynamicParams` decides whether the tail 404s or renders"
sidebar_label: "02 · generateStaticParams at scale"
sidebar_position: 6
description: "generateStaticParams as a build-cost decision: why path count is the axis nobody budgets for, how to pick the hot set, partial enumeration, and what dynamicParams does to everything you left out."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (docs `lastUpdated` 2026-08-25), [How to implement Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated` 2026-06-23) and [Incremental Static Regeneration with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components) (`lastUpdated` 2026-08-03).
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run** — `next` is not installed in this checkout, so no package probe was possible. **No build timings appear on this page**; the docs state no rate and none has been invented.

**Every other page about `generateStaticParams` teaches you the timing rules — when it runs, what it returns, that ISR does not call it again. [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md) already owns all of that, and this page will not repeat it. This page is about the one property of the function nobody puts in a design document: the length of the array you return is a per-deploy cost, paid in CI minutes and in deployed artifacts, and it is set by a query against production data rather than by anything in your source. A route whose enumeration returns 400 rows and a route whose enumeration returns 400,000 are the same eleven lines of TypeScript. That is why the build that took four minutes in March takes forty in November with no commit to blame — the code did not change, the `SELECT` did. Next.js's own documentation names this cost and tells you to stop paying all of it: prerender the routes that benefit, let the rest arrive on demand.**

## The framework says this in its own words, twice

The scale argument is not a community opinion. It is the fourth bullet in the list of what ISR exists to do:

> *"Handle large amounts of content pages without long `next build` times"*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

And the Cache Components ISR guide devotes a whole section, *Choosing what to prerender*, to talking you out of enumerating everything:

> *"Not every route needs to be prerendered. Every page you prerender increases build work and produces output that has to be stored and deployed. Many routes may never be visited before your next deployment, making that work unnecessary."*

> *"Instead, use `generateStaticParams` to prerender the routes that benefit most from being ready ahead of time, such as popular pages or predictable content. Less frequently visited routes are generated on demand and upgraded after their first visit, so you don't spend build time and storage on pages that may never be requested."*
> — [ISR with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components)

Read the second quote as a cost model, because that is what it is. Prerendering one path buys you a fast first visit **only if that path is visited before the next deploy**. Every path that is not visited in that window was rendered for nobody, stored for nobody, and shipped for nobody. On a site that deploys weekly and has a long tail of product pages, that fraction is most of the catalogue.

## The two costs, and only one of them is obvious

`next build` does two separable things with a dynamic route:

1. **Enumeration.** It calls `generateStaticParams` once per parent param set (see [02c](02c-nested-segments-and-the-combinatorial-explosion.md)) and collects the returned arrays. This is a data-access cost: a query, an API call, a paginated crawl of a CMS.
2. **Rendering.** For every param object in the collected result, it renders that route — HTML and the RSC payload — and writes both.

> *"During `next build`, `generateStaticParams` runs before the corresponding Layouts or Pages are generated."*

The second cost scales with the length of your array. The first does not — one slow query is one slow query whether it returns 10 rows or 10 million. **People optimise the query and then wonder why the build is still slow.** The query is a constant; the render loop is the line with the slope.

⚠️ **The documentation does not state how build time scales with param count** — no per-page cost, no parallelism factor, no rate. It establishes that the axis exists (*"without long `next build` times"*) and nothing more. Treat "N paths costs roughly N renders" as reasoning from the mechanism, not as a documented figure, and measure your own build rather than trusting a number from anywhere including this page.

## Partial enumeration is the documented default posture, not a hack

The reference page gives partial enumeration its own heading, *Subset of paths at build time*:

> *"To statically render a subset of paths at build time, and the rest the first time they're visited at runtime, return a partial list of paths"*

```tsx
// app/blog/[slug]/page.tsx — the doc's own shape, with the sort made explicit
type PostSummary = { slug: string; views30d: number }

export async function generateStaticParams() {
  const posts: PostSummary[] = await fetch('https://api.sprintdesk.dev/posts', {
    next: { revalidate: 3600 },
  }).then((res) => res.json())

  return posts
    .sort((a, b) => b.views30d - a.views30d)
    .slice(0, 500)
    .map((post) => ({ slug: post.slug }))
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await fetch(`https://api.sprintdesk.dev/posts/${slug}`).then(
    (res) => res.json()
  )
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  )
}
```

🔴 **The doc's example is `posts.slice(0, 10)` with the comment `// Render the first 10 posts at build time`, and that comment quietly assumes the API returned them in the order you want.** `slice` takes the first ten of *whatever arrived*. If the endpoint sorts by `created_at DESC`, you have prerendered the ten newest posts — which is a defensible hot set for a news site and a terrible one for a documentation site where the ten most-read pages are three years old. **Sort explicitly, in your own code, on a field that means "hot".** The version above does; the doc's version does not, and copying it verbatim is the single most common way this goes wrong.

## How you actually decide the hot set

"Popular pages or predictable content" is the docs' phrasing. Turned into something you can implement, there are four sources of a hot set, in descending order of how much they are worth:

**1 · Request logs from the last N days.** The only source that reflects real demand. Rank by request count at the CDN or the origin, take the head, cap it. This is the answer whenever you have logs.

**2 · The ranking you already publish.** If `sitemap.ts` orders URLs by priority, or the homepage lists "top 50 products", that ordering is already an editorial claim about what matters. Reuse it — one source of truth beats two that drift.

**3 · A structural rule.** Everything in the `pricing` category; every post in the last 90 days; every tenant on the Enterprise plan. Cheap to express in SQL, stable across deploys, easy to explain to whoever asks why a page was slow.

**4 · Intuition.** The default, and the reason a team ends up prerendering 40,000 pages of which 300 get traffic. It is not that intuition is wrong; it is that nobody revisits it, so the list only ever grows.

```ts
// lib/hot-paths.ts — a hot set with a hard cap, so the build cost has a ceiling
import { db } from '@/lib/db'

const PRERENDER_CAP = Number(process.env.PRERENDER_CAP ?? 500)

export async function hotPostSlugs(): Promise<string[]> {
  const rows = await db.query<{ slug: string }>(
    `SELECT p.slug
       FROM posts p
       JOIN post_views v ON v.post_id = p.id
      WHERE p.published_at IS NOT NULL
        AND v.window_start > now() - interval '30 days'
      GROUP BY p.slug
      ORDER BY sum(v.hits) DESC, p.slug ASC
      LIMIT $1`,
    [PRERENDER_CAP]
  )
  return rows.map((r) => r.slug)
}
```

**The `LIMIT` is the point.** It converts an unbounded, data-driven build cost into a bounded one you chose. The `ORDER BY ... , p.slug ASC` tiebreak is not decoration either — see [02b](02b-enumerating-from-a-database-at-build-time.md) for why a non-deterministic enumeration makes two builds of the same commit produce different sites.

## `dynamicParams` decides what your decision costs everyone else

Having enumerated a subset, you have implicitly made a second decision about the complement. [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md) owns the mechanics of the flag; what matters here is that **partial enumeration and `dynamicParams` are one decision made in two places**, and the failure mode is deciding the first without noticing the second.

| Enumeration | `dynamicParams` | What a non-enumerated URL does | Whose problem it is |
|---|---|---|---|
| Complete | `true` (default) | Never happens by construction | Nobody's — until the data grows |
| Complete | `false` | Never happens by construction | Nobody's — until the data grows |
| Partial | `true` (default) | Rendered on first request, then cached | The first visitor's, once |
| Partial | `false` | **404** | 🔴 Your customers' and your SEO's, permanently |

The doc's own subset example ships with `export const dynamicParams = false` under the comment `// All posts besides the top 10 will be a 404`, and that is not a recommendation — it is a demonstration of what the flag does. Copying both halves of the doc example into a real blog deletes 99% of your archive from the internet.

> *"To prevent unspecified paths from being prerendered at runtime, add the `export const dynamicParams = false` option in a route segment. When this config option is used, only paths provided by `generateStaticParams` will be served, and unspecified routes will 404 or match (in the case of catch-all routes)."*

`dynamicParams = false` is right in exactly one shape of problem: **the param space is closed and you can enumerate it completely.** Locale codes, plan tiers, a fixed set of report types, `/[year]/[month]` for years you have data for. It is a guarantee that the route cannot be probed with arbitrary values. It is wrong the moment the set is open-ended — a catalogue, a blog, user profiles, anything a CMS can add to.

## The honest failure mode: four minutes becomes forty

Nothing above is subtle. Here is why it still happens.

A route ships with `generateStaticParams` returning every published post. There are 300. The build takes four minutes and the pull request is approved with a note that ISR "handles scale". Eighteen months later there are 40,000 posts, the enumeration is the same eleven lines, and the build takes forty minutes. Three things then happen in order:

1. **CI cost goes from invisible to a line item**, and someone proposes a bigger runner rather than a shorter array.
2. **Deploy frequency drops**, because a forty-minute build is not something you do to ship a copy fix. Slow builds make teams batch changes, and batched changes are riskier changes.
3. 🔴 **The ISR window stops meaning anything.** Every deploy invalidates the cache — the `use cache` cache key includes the build or `deploymentId` — so on a team that deployed six times a day, content freshness came from deploys, not from `revalidate`. Now it does not, and pages go stale in a way nobody's config change explains. [03](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) is where that interaction lives.

None of those three symptoms points at `generateStaticParams`. That is why this is worth writing down before it happens: **the fix — a `LIMIT` and a sort — takes ten minutes, and finding out that it is the fix takes a week.**

## Gotchas

**★ Symptom: the build got dramatically slower and `git log` shows nothing that could explain it.** Cause: `generateStaticParams` returns a query result, so build cost is a function of production data volume, not of your source tree. A row inserted by a customer is a change to your build. Fix: put a cap on the array and make the cap visible — a named constant or an env var, not a magic `.slice(0, 10)` buried in a `.map()` chain:

```ts
const PRERENDER_CAP = Number(process.env.PRERENDER_CAP ?? 500)
// ... ORDER BY hits DESC, slug ASC LIMIT $1  with [PRERENDER_CAP]
```

**★ Symptom: you prerendered "the top 10" and the ten pages that got prerendered are not popular.** Cause: `posts.slice(0, 10)` takes the first ten of whatever order the API returned, and the doc's example does exactly this without sorting. Fix: sort on an explicit hotness field before slicing, and if the API cannot give you one, ask it for the ranking rather than guessing — `fetch('/posts?sort=views_30d&limit=500')` is one round trip instead of downloading the whole table to sort it in the build.

**★ Symptom: half the catalogue 404s in production but every URL works in dev.** Cause: `dynamicParams = false` combined with partial enumeration. In `next dev`, `generateStaticParams` *"will be called when you navigate to a route"*, so the local experience is closer to complete enumeration and the missing tail never shows up. Fix: remove the flag (its default is `true`) unless the param space is genuinely closed:

```tsx
// app/blog/[slug]/page.tsx
// export const dynamicParams = false   ← 🔴 delete this line on an open-ended set
export async function generateStaticParams() {
  return (await hotPostSlugs()).map((slug) => ({ slug }))
}
```

**★ Symptom: adding a `LIMIT` to the enumeration made the first visit to tail pages slow.** Cause: correct and expected — you moved the render from build time to first-request time. It is not a regression, it is the trade you made. Fix: if the first-visit latency is unacceptable, do not go back to full enumeration; enable Cache Components with `partialPrefetching` so unlisted URLs get an App Shell instantly instead of waiting for a full render, which is [02d](02d-when-the-path-set-changes-and-what-cache-components-changes.md).

**Symptom: an empty array from `generateStaticParams` made the whole route dynamic instead of prerendering nothing.** Cause: the two outcomes are documented and different. *"You must always return an array from `generateStaticParams`, even if it's empty. Otherwise, the route will be dynamically rendered."* — that covers returning `undefined`; an explicit `[]` is the documented way to have every path rendered on first visit. A `try`/`catch` that swallows an error and falls off the end returns `undefined`. Fix: return `[]` on the failure branch explicitly, and note that under Cache Components `[]` is itself a build error ([02d](02d-when-the-path-set-changes-and-what-cache-components-changes.md)):

```ts
export async function generateStaticParams() {
  try {
    return (await hotPostSlugs()).map((slug) => ({ slug }))
  } catch (err) {
    console.error('[generateStaticParams] enumeration failed', err)
    return []
  }
}
```

**Symptom: the hot set is stale — it prerenders last quarter's popular pages.** Cause: the ranking query has a window (`interval '30 days'`) but the build only re-runs it when you deploy. On a monthly release train, your "30-day hot set" is up to 30 days behind. Fix: either shorten the release cadence, or shorten the window and accept churn, or stop treating the hot set as a precision instrument — its job is to cover the head of a power-law distribution, and the head moves slowly.

**Symptom: prerendering a large set works but the deployment artifact is enormous.** Cause: each prerendered path stores HTML *and* an RSC payload, and the Cache Components guide is explicit that prerendering *"produces output that has to be stored and deployed."* Fix: the same `LIMIT`. ⚠️ The docs give no size figure per path, so budget by measuring your own output directory rather than from any published number.

## Interview questions

**★ Why is the number of params you return a bigger architectural decision than how you fetch them?**
Because it is the only part of `generateStaticParams` with a slope. The enumeration itself is one query, and one query costs the same whether it returns ten rows or ten million. The returned array, by contrast, drives a render per element — HTML plus RSC payload, written and deployed. So optimising the query buys you a constant and capping the array buys you the gradient. It is also the decision that changes without a commit: the array's length is set by production data, which means your build cost is controlled by whoever is inserting rows, not by whoever is reviewing pull requests.

**★ You have 40,000 product pages. Walk me through deciding what to prerender.**
Start from the framework's own position — *"Not every route needs to be prerendered ... Many routes may never be visited before your next deployment, making that work unnecessary."* Then get the traffic distribution: on a catalogue it is a power law, so a few hundred SKUs carry most of the requests. Prerender that head with an explicit `ORDER BY` on a hotness metric and a hard `LIMIT`, leave `dynamicParams` at its default so the tail renders on first visit, and set the ISR window from the product's freshness requirement rather than habit. Then check the second half of the decision that people forget: how often you deploy. If you deploy daily, a prerendered page bought a fast first visit for one day; if you deploy quarterly, it bought one for a quarter. Deploy frequency is what decides whether prerendering the long tail pays for itself at all.

**★ What does `dynamicParams = false` actually guarantee, and when is it right?**
It guarantees that only the params you enumerated are servable — *"only paths provided by `generateStaticParams` will be served, and unspecified routes will 404."* That makes it a closed-set guarantee, useful when the param space really is closed: locales, plan tiers, a fixed list of report types, years you have data for. It also means a route cannot be probed with arbitrary values, which is a genuine security-adjacent property. It is wrong wherever the set is open-ended, because "not enumerated" and "does not exist" stop being the same thing the moment a CMS can add a row — and then it deletes real content from the internet with a 404 rather than an error you would notice.

**★ Why doesn't ISR fix a slow build?**
Because ISR refreshes the *content* of paths the build already knows about, and discovering paths is a build-time activity — *"During revalidation (ISR), `generateStaticParams` will not be called again."* If your build is slow because you enumerate 40,000 paths, ISR does not shorten it by one second; it only saves you from rebuilding to update those 40,000 pages. The thing that fixes a slow build is enumerating fewer paths, which is a different lever entirely, and the ISR guide names it in its own list of benefits: *"Handle large amounts of content pages without long `next build` times"* means "prerender fewer of them", not "prerender them faster".

**Someone proposes a bigger CI runner to fix a forty-minute build. What do you say?**
That it treats the symptom and costs money forever. The build is long because the array is long, and the array is long because nobody chose its length — it defaulted to "everything". A `LIMIT` on the enumeration is a one-line change that bounds the cost permanently, and the pages you stop prerendering are, by the traffic distribution, the ones almost nobody was going to load before the next deploy. A bigger runner also does not fix the two second-order problems: deploy frequency dropping because a forty-minute build discourages small changes, and the deployment artifact growing without limit.

**How does `next dev` mislead you about all of this?**
Two ways. First, *"During `next dev`, `generateStaticParams` will be called when you navigate to a route"* — it is lazy, so you never sit through the enumeration-and-render loop that dominates `next build`, and a build cost problem is invisible locally by construction. Second, that laziness makes `dynamicParams = false` look harmless: you navigate to a URL, the function runs for that navigation, the page works. The 404s only appear in a real build against a real dataset. Verifying either of these requires `next build` followed by `next start`, which is exactly what the ISR guide recommends under *Verifying correct production behavior*.

---

← [01 · Choosing a rendering pattern](01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md) · [Chapter index](01-explanation.md) · Next → [02b · Enumerating from a database at build time](02b-enumerating-from-a-database-at-build-time.md)
