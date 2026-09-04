---
title: "The moment `generateStaticParams` reads a database, `next build` becomes a production data consumer — your CI needs credentials and network reach it never had, and the same commit stops producing the same site"
sidebar_label: "02b · Enumerating from a database"
sidebar_position: 7
description: "What it costs to enumerate paths from a database or CMS at build time: CI network and credentials, build reproducibility, deterministic ordering, pagination, timeouts, and what a failed enumeration does to the deploy."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (docs `lastUpdated` 2026-08-25) and [How to implement Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated` 2026-06-23).
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run** — `next` is not installed in this checkout. The reproducibility and CI arguments on this page are reasoning from the documented build sequence, not doc claims; they are labelled where that matters.

**[02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) argued that the length of the array is a cost. This page is about where the array comes from. In every real deployment the answer is "production" — a Postgres replica, a headless CMS, a search index — and that single fact reclassifies `next build` from a pure compilation step into a client of your production data. It now needs credentials, egress, a network path through whatever sits in front of the database, and a timeout policy. It also stops being deterministic: two builds of the same commit an hour apart enumerate different rows, so "reproducible build" quietly becomes false and nobody notices until a rollback ships a different site than the one it rolled back to.**

## What changes the day you swap `fetch` for a database client

The reference page's examples all use a public HTTP API, which hides the problem:

```tsx
// the doc's example — no credentials, no VPC, no pool
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())
  return posts.map((post) => ({ slug: post.slug }))
}
```

The version a real product ships looks like this, and every added line is a new requirement on the build environment:

```ts
// lib/db.ts — one pool, created lazily, sized for a build not for a server
import { Pool } from 'pg'

let pool: Pool | undefined

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.BUILD_DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    })
  }
  return pool
}
```

```tsx
// app/blog/[slug]/page.tsx
import { getPool } from '@/lib/db'

const PRERENDER_CAP = Number(process.env.PRERENDER_CAP ?? 500)

export async function generateStaticParams() {
  const { rows } = await getPool().query<{ slug: string }>(
    `SELECT slug
       FROM posts
      WHERE published_at IS NOT NULL
        AND published_at <= now()
      ORDER BY view_count_30d DESC, slug ASC
      LIMIT $1`,
    [PRERENDER_CAP]
  )
  return rows.map((row) => ({ slug: row.slug }))
}
```

Four new obligations, none of them visible in the diff:

1. **`BUILD_DATABASE_URL` must exist in CI.** Not in `.env.local`, not in the runtime secret store your platform injects at request time — in the *build* environment, which on most platforms is a different context with a different secret set. This is the number one cause of "it builds locally".
2. **The CI runner must be able to reach the database.** Hosted runners come from arbitrary egress addresses. An IP allowlist, a private subnet or a bastion turns this into an infrastructure ticket, not a code change.
3. **A statement timeout.** Without one, a locked table hangs the build until the CI job's own timeout kills it — which is usually far longer, and gives you a failure with no useful error.
4. **A read replica, ideally.** The build issues an unusual query pattern (large, sorted, once) at an unusual moment (a deploy, often under time pressure). Point it away from the primary.

⚠️ **Use a build-scoped credential with `SELECT` only.** The build has no reason to write, and a build-time connection string is exposed to every step of your CI pipeline including third-party actions.

## Determinism: the same commit stops producing the same site

This is the part that surprises people, and it is straightforward once stated: **`generateStaticParams` reads mutable state, so the build output is a function of `(commit, time)`, not of `commit`.** Consequences that actually bite:

- **Rollback does not restore the previous site.** Rebuilding tag `v4.2.1` today enumerates today's rows, not the rows of the day `v4.2.1` was cut. You get the old code with a new path set.
- **A retried build is a different build.** CI retries a flaky step; the enumeration re-runs; a post was published in between; the artifact differs from the one that failed. Diffing two build outputs to explain a bug is now unreliable.
- **Two-runner parallel builds can disagree** if your pipeline builds twice for any reason.

You cannot make the enumeration pure — its whole job is to read live data — but you can remove the *avoidable* nondeterminism, which is most of it:

```sql
-- 🔴 Non-deterministic: ties break arbitrarily, so run-to-run the cut at LIMIT moves
ORDER BY view_count_30d DESC
LIMIT 500

-- Deterministic given the same rows: a unique tiebreak pins the boundary
ORDER BY view_count_30d DESC, slug ASC
LIMIT 500
```

Without a unique tiebreak column, rows with equal ranking values can come back in any order, so the 500th slot changes between runs even when the data has not. **The tiebreak costs nothing and removes an entire class of "why did this page stop being prerendered" investigations.**

If you need real reproducibility — regulated environments, forensic rebuilds — the honest answer is to stop reading live data at build time and read a **snapshot artifact** instead:

```ts
// scripts/snapshot-hot-paths.ts — run once, commit or archive the output
import { writeFileSync } from 'node:fs'
import { getPool } from '../lib/db'

const { rows } = await getPool().query<{ slug: string }>(
  `SELECT slug FROM posts
    WHERE published_at IS NOT NULL
    ORDER BY view_count_30d DESC, slug ASC
    LIMIT 500`
)

writeFileSync(
  'data/hot-paths.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), slugs: rows.map((r) => r.slug) }, null, 2)
)
```

```tsx
// app/blog/[slug]/page.tsx — the build now reads a file, and is a pure function of the commit
import hotPaths from '@/data/hot-paths.json'

export async function generateStaticParams() {
  return hotPaths.slugs.map((slug) => ({ slug }))
}
```

The trade is explicit and worth stating out loud: **you have traded freshness of the hot set for reproducibility of the build.** The snapshot ages, and refreshing it is now a scheduled job with a pull request. For a regulated build pipeline that is the right trade; for a news site it is not.

## Pagination: the enumeration query is itself a scale problem

A CMS API that caps at 100 items per page does not care that you want 5,000 slugs. The naive loop is sequential and unbounded, which is how an enumeration turns into the slowest step of a build that has nothing to do with rendering:

```ts
// lib/cms.ts — bounded, explicit, and it stops rather than looping forever
type Page = { items: { slug: string }[]; nextCursor: string | null }

export async function allSlugs(max: number): Promise<string[]> {
  const slugs: string[] = []
  let cursor: string | null = null
  let requests = 0

  while (slugs.length < max && requests < 100) {
    const url = new URL('https://cms.sprintdesk.dev/v1/posts')
    url.searchParams.set('limit', '100')
    url.searchParams.set('sort', 'views_30d:desc')
    if (cursor) url.searchParams.set('cursor', cursor)

    const page: Page = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.CMS_BUILD_TOKEN}` },
      next: { revalidate: 3600 },
    }).then((res) => {
      if (!res.ok) throw new Error(`CMS ${res.status} while enumerating posts`)
      return res.json()
    })

    slugs.push(...page.items.map((item) => item.slug))
    requests += 1
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return slugs.slice(0, max)
}
```

`requests < 100` is a circuit breaker, not paranoia: a cursor API that returns the same cursor on an error path will otherwise loop until the CI job times out, and the failure will read as "build hung" rather than "CMS returned a bad cursor".

**Ask the API to sort, do not sort locally.** `sort=views_30d:desc` costs one parameter. Downloading 40,000 records to `.sort()` them in Node costs the whole table over the wire, in the build, every deploy.

## `fetch` memoization is doing more work than you think

One documented behaviour makes the top-down enumeration pattern viable at all:

> *"`fetch` requests are automatically memoized for the same data across all `generate`-prefixed functions, Layouts, Pages, and Server Components. React `cache` can be used if `fetch` is unavailable."*
> — [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)

So a `fetch` to the same URL from `generateStaticParams`, from `generateMetadata` and from the page component itself is one request, not three. 🔴 **A database client gets none of this** — `pool.query()` is not `fetch`, so the identical query issued from the enumeration and again from the page runs twice. Wrap it:

```ts
// lib/posts.ts
import { cache } from 'react'
import { getPool } from './db'

export const getPostBySlug = cache(async (slug: string) => {
  const { rows } = await getPool().query('SELECT * FROM posts WHERE slug = $1', [slug])
  return rows[0] ?? null
})
```

That is per-render memoization, and it is the documented substitute the sentence above points at. It is covered properly in [ch4 · `react` cache and non-fetch memoization](../04-data-fetching-in-the-app-router/01g-react-cache-connection-and-non-fetch-memoization.md); the reason it appears here is that build-time enumeration is where the duplicate-query cost is multiplied by the size of your hot set.

## What a failed enumeration does to the deploy

If `generateStaticParams` throws, the build fails and nothing ships. That is usually correct — you would rather not deploy than deploy a site missing its catalogue — but it means **your deploy pipeline now has an availability dependency on your database.** A maintenance window on the replica is a window in which you cannot ship a hotfix.

There is a second, quieter outcome. A `try`/`catch` that swallows the error and falls off the end returns `undefined`, and:

> *"You must always return an array from `generateStaticParams`, even if it's empty. Otherwise, the route will be dynamically rendered."*

So the swallowed failure does not fail the build — it silently converts a prerendered route into a dynamically rendered one, and you find out from your origin bill. Decide which behaviour you want and write it down:

```ts
export async function generateStaticParams() {
  try {
    return (await allSlugs(PRERENDER_CAP)).map((slug) => ({ slug }))
  } catch (err) {
    // Deliberate: a CMS outage must not block a hotfix deploy. The tail renders
    // on demand and `revalidate` refills the cache. Fail the build instead by
    // rethrowing if a missing prerender set is worse than a delayed deploy.
    console.error('[generateStaticParams] enumeration failed, falling back to on-demand', err)
    return []
  }
}
```

Both branches are defensible. **The indefensible version is the one where nobody chose**, because the choice was made by whether someone happened to write a `try`.

## Gotchas

**★ Symptom: the build works locally and fails in CI with a connection error.** Cause: the build environment is not the runtime environment. Platform secrets injected at request time are not necessarily present during `next build`, and hosted runners egress from addresses your database allowlist has never seen. Fix: add the credential to the *build* secret scope and assert it early so the failure is legible:

```ts
const url = process.env.BUILD_DATABASE_URL
if (!url) throw new Error('BUILD_DATABASE_URL is required at build time for generateStaticParams')
```

**★ Symptom: rebuilding an old tag produces a site that is not the one you shipped from that tag.** Cause: `generateStaticParams` reads mutable data, so the output is a function of the commit *and* the moment. Rollback restores code, not the path set. Fix: if that matters, enumerate from a committed snapshot file rather than from the live database, and accept that the snapshot must be refreshed on a schedule.

**★ Symptom: a page that was prerendered last week is not prerendered this week, and its traffic has not changed.** Cause: an `ORDER BY` with no unique tiebreak. Rows tied on the ranking column come back in arbitrary order, so the cut at `LIMIT` moves between runs. Fix: append a unique column — `ORDER BY view_count_30d DESC, slug ASC`.

**★ Symptom: the build hangs with no output and is eventually killed by the CI timeout.** Cause: either a database query with no `statement_timeout` waiting on a lock, or a cursor-pagination loop whose termination condition never fires. Fix: set `statement_timeout` and `connectionTimeoutMillis` on the pool, and put a hard request ceiling on any pagination loop (`requests < 100` above). A build that fails in fifteen seconds with `CMS 502 while enumerating posts` is worth far more than one that dies at the job limit.

**Symptom: a database outage stopped you shipping an unrelated hotfix.** Cause: a throwing enumeration makes the deploy pipeline depend on the database's availability. Fix: choose deliberately — either catch and return `[]` (deploy proceeds, tail renders on demand) or rethrow (deploy blocks). Write the reason in a comment at the catch site; this is exactly the decision that gets reversed six months later by someone who cannot tell it was a decision.

**Symptom: an enumeration error made every route dynamic and the origin bill went up.** Cause: the `catch` returned nothing rather than `[]`, and returning `undefined` makes the route dynamically rendered. It is not an error, so nothing alerts. Fix: return `[]` explicitly, and add a build-log assertion you can alert on — `if (slugs.length === 0) console.error('[build] hot set is EMPTY')`.

**Symptom: the same query runs once during enumeration and again for every page render.** Cause: automatic memoization covers `fetch`, not database clients. Fix: wrap the accessor in React's `cache` as shown above. Note this memoizes within a render, not across the whole build — it removes duplicate work per page, not the per-page work itself.

**Symptom: the CMS rate-limits the build.** Cause: enumeration paginates, and then each prerendered path issues its own content request; a 5,000-path build is at minimum 5,000 requests in a short burst from one address. Fix: shrink the hot set (the cap from [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) helps twice here), request a build-time quota or an export endpoint, or fetch content in bulk during enumeration and serve it from a `cache`-wrapped lookup.

**Symptom: the build-time connection string is visible in CI logs.** Cause: a pool constructed with an interpolated URL, plus a library that prints its config on error. Fix: a `SELECT`-only build role with its own credential, so the worst case of exposure is a read of published data, and rotation does not affect the running application.

## Interview questions

**★ Why does reading the database in `generateStaticParams` break reproducible builds, and does it matter?**
Because the build output becomes a function of the commit *and* the wall-clock moment the enumeration ran. The same tag rebuilt an hour later enumerates a different set of rows and produces a different site. Whether it matters depends on what you rely on reproducibility for: it matters a lot for rollback (you get the old code with today's path set, not the artifact you shipped) and for diffing two builds to explain a defect; it matters little for a marketing site. When it matters, the fix is to stop reading live data at build time and read a committed snapshot instead — which trades freshness of the hot set for determinism, and that trade should be written down rather than discovered.

**★ Your enumeration query fails during a deploy. Should the build fail?**
It is a genuine choice with no universal answer, and the important thing is to make it explicitly. Failing the build means you never ship a site with a missing prerender set, at the cost of your deploy pipeline having an availability dependency on the database — a replica maintenance window becomes a window in which you cannot ship a hotfix. Catching and returning `[]` means the deploy proceeds and the tail renders on demand, at the cost of a deploy that quietly ships without its prerendered head. What you must not do is return `undefined` from a `catch`, because that is a third behaviour nobody chose: the documented rule is that not returning an array makes the route dynamically rendered, so a swallowed error silently converts a static route into a dynamic one and the only signal is the origin bill.

**★ Why is `ORDER BY views DESC LIMIT 500` not good enough?**
Because ties break arbitrarily. Rows with the same view count can be returned in any order, so the boundary at row 500 shifts between runs even when the underlying data has not changed — pages drift in and out of the prerendered set with no explanation in any diff. Adding a unique tiebreak (`, slug ASC`) makes the cut deterministic for a given dataset. It costs nothing and removes a whole category of unfalsifiable "why is this page slow sometimes" reports.

**What does `fetch` memoization give you at build time that a database client does not?**
The docs state that `fetch` requests are memoized for the same data across all `generate`-prefixed functions, layouts, pages and Server Components — so the same URL requested from `generateStaticParams`, `generateMetadata` and the page body is one request. A `pool.query()` gets none of that; it is not `fetch` and the framework cannot see it. The documented substitute is React's `cache`, which the same paragraph points at. This matters more at build time than at request time because the duplication is multiplied by the size of the hot set rather than happening once per user request.

**Why should the build use a different database credential than the application?**
Three reasons. It only needs `SELECT`, so least privilege is trivially achievable and the blast radius of a leaked build credential is a read of already-published data. It runs from CI, which is a different trust boundary — third-party actions in your pipeline can see build-scoped secrets. And it should point at a read replica, because the build issues a large sorted scan at exactly the moment (a deploy) when you least want extra load on the primary. Different credential, different endpoint, different privileges: the split is what lets you do all three.

**How do you enumerate 5,000 paths from a CMS that pages 100 at a time without the build becoming the slowest part of your pipeline?**
Push the ranking to the server (`sort=views_30d:desc`) so you can stop after the pages you need instead of downloading everything and sorting locally. Bound the loop twice: once on the number of slugs you actually want, and once on the number of requests, so a broken cursor fails fast with a real error instead of spinning until the CI job's timeout. Then reduce the requirement: 5,000 is usually a number nobody chose, and the traffic distribution rarely justifies it. The Cache Components guide's framing is the one to argue from — routes never visited before the next deploy were prerendered for nobody.

---

← [02 · generateStaticParams at scale](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) · [Chapter index](01-explanation.md) · Next → [02c · Nested segments and the combinatorial explosion](02c-nested-segments-and-the-combinatorial-explosion.md)
