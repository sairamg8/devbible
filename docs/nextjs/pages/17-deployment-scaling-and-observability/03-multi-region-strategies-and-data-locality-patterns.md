---
title: "Multi-region compute in front of a single-region database is almost always slower than one region, because you moved the cheap half of the request away from the expensive half — and the route-segment API you would have reached for is deprecated"
sidebar_label: "03 · Multi-region and data locality"
sidebar_position: 6
description: "Why compute must follow data, the round-trip arithmetic that makes naive multi-region worse, preferredRegion's deprecation with no framework successor, platform region configuration, read replicas, residency partitioning, and failover."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against [`preferredRegion` (deprecated)](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion) and [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) (`version: 16.3.4`, `lastUpdated: 2026-04-30`), the [`preferredRegion` deprecation message](https://nextjs.org/docs/messages/preferred-region-deprecated), and on vercel.com [Global network and regions](https://vercel.com/docs/regions) and [Configuring regions for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region) (both `last_updated: 2026-08-11`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run**, **no timings** — every latency figure below is an explicitly-labelled arithmetic model, not a measurement.

**"Deploy to more regions" is the most reliably counter-productive performance change available to a Next.js team, and the reason is a single sentence in Vercel's own documentation: functions should be executed in the same region as your database. A dynamic request is not one round trip; it is a handful of sequential database round trips wrapped in one HTTP response. Moving the compute to Sydney while the database stays in Virginia does not shorten the user's path — it lengthens every one of those internal round trips and adds them up, while shortening only the single hop the CDN was already handling. On top of that, the API you would reach for to express region placement, `preferredRegion`, is deprecated in Next.js 16 with no framework-level replacement: region placement is now purely a platform concern. This page is the arithmetic, the deprecation, and the three patterns that actually work.**

## 🔴 `preferredRegion` is deprecated, and nothing replaces it in the framework

The route segment config reference lists it with the deprecation in the type itself — `'auto' | 'global' | 'home' | string | string[] (deprecated)` — and the page title is literally *"preferredRegion (deprecated)"*.

> *"**Deprecated:** The `preferredRegion` route segment config is deprecated. Remove the `preferredRegion` export from your route files."*

The migration note is the whole migration:

```diff
- export const preferredRegion = 'home'
```

> *"This applies to all route files that support the `preferredRegion` segment config: `page.ts`, `layout.ts`, and `route.ts`."*

⚠️ **The documentation names no framework-level successor.** I could not find one, and the deprecation message does not offer one — it says only to remove the export. Treat that as deliberate rather than as an omission: what the option ever did was pass a value through, and the reference said so —

> *"Next.js passes the region values through to the deployment platform. The exact behavior and available region codes are platform-specific."*

So region placement moves entirely to platform configuration. On Vercel that is `vercel.json`; on a container platform it is wherever you schedule containers.

Two other behaviours are worth recording before they disappear with the option. Inheritance was lexical — *"If a `preferredRegion` is not specified, it will inherit the option of the nearest parent layout. The root layout defaults to `'auto'`"*, and *"A child segment's value overrides the parent, values are not merged"*. And the array form was not a preference list:

> *"`string[]`: Deploy the route to multiple specific regions. The route is deployed to **all** listed regions, not a single one chosen from the list."*

That last one funded a lot of accidental cost. `['iad1', 'sfo1', 'fra1']` meant three deployments of that route, not a fallback chain.

`runtime = 'edge'` is deprecated in the same table, which removes the other half of the old story — regions used to be an edge-runtime-only feature, and the reference says exactly that: *"regions were previously only supported with `export const runtime = 'edge'`, which is now deprecated"*.

## The one sentence the whole topic rests on

> *"Functions should be executed in the same region as your database, or as close to it as possible, for the lowest latency."*

And the reason the default is what it is:

> *"By default, Vercel Functions execute in *Washington, D.C., USA* (`iad1`) **for all new projects** to ensure they are located close to most external data sources, which are hosted on the East Coast of the USA."*

Read that as the design principle it is: **the default region is chosen to be near your data, not near your users.** Users are handled by the network — 126 points of presence, 20 dense compute regions, private transit between them, per [01c](01c-the-edge-network-and-skew-protection.md). Data is not.

## Why more regions makes it slower — the arithmetic

This is a model, not a measurement. No timings were taken; the point is the *shape* of the function, and the shape is what decides the design.

Let `d` be the round-trip latency between compute and database, `k` the number of *sequential* database round trips a request makes (an auth lookup, then the board, then the cards — each depending on the last), and `u` the latency between the user and the compute region.

```text
total ≈ u + (k × d)          [model, not measured]
```

Single region, compute beside the database: `d` is intra-region, so `k × d` is small regardless of `k`. `u` is a cross-continent hop, paid **once**.

Multi-region compute, database still in one place: `u` shrinks — that is the whole promise — but `d` becomes the cross-continent hop, and it is paid **`k` times**. For any route with more than one dependent query, you have multiplied the expensive term and divided the cheap one.

Two corollaries fall straight out.

**The pattern gets worse as your code gets more normal.** A route with one query might break even. A route that authenticates, loads a record, then loads its children — three dependent trips — triples the penalty. Waterfalls that were invisible at 1 ms are the dominant cost at 150 ms. This is the same waterfall analysis as [chapter 4](../04-data-fetching-in-the-app-router/01-explanation.md), except the multiplier is now geography.

**Static and cached routes were never affected.** They are served from the CDN, so `k = 0` and `u` is already short. Which means the honest summary of most "we need multi-region" conversations is: **the routes that would benefit from multi-region are the ones you should have cached, and the routes you cannot cache are the ones multi-region makes worse.**

## Configuring regions where they now live

Project-wide, in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"]
}
```

Per function, when different routes genuinely talk to different data:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"],
  "functionFailoverRegions": ["cle1"],
  "functions": {
    "api/eu-data.js": {
      "regions": ["cdg1"],
      "functionFailoverRegions": ["lhr1"]
    },
    "api/us-west.js": {
      "regions": ["sfo1"],
      "functionFailoverRegions": ["pdx1"]
    }
  }
}
```

> *"When set on a function, these values completely override the corresponding project-level setting for that function."*

Plan limits, and the failure mode of exceeding them:

| Plan | Function regions |
|---|---|
| Hobby | Single region |
| Pro | 5 regions |
| Enterprise | All regions |

> *"Deploying to more regions than your plan allows causes the deployment to fail before the build step."*

Two asymmetries worth holding onto. Routing Middleware is not covered by this setting — *"Vercel deploys Routing Middleware to all regions by default, regardless of your region settings"* — so proxy logic really is global while your functions are not. And the documentation repeats the data-locality rule for third-party APIs as well as databases: *"If your functions communicate with external services, choosing regions far from those services increases latency. Select only regions close to your external services."*

## The three patterns that actually work

### 1 · One region, next to the data — the default, and usually the right answer

Compute and database in the same region; everything cacheable served globally by the CDN. `u` is paid once for uncached routes and never for cached ones. Nothing to coordinate, nothing to keep consistent. This is what `iad1`-by-default is trying to give you.

The work that improves this architecture is not regional — it is raising the proportion of requests that never reach a function at all. That is [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md) and [chapter 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md), and it is a bigger win in every region simultaneously than any placement change.

### 2 · Regional read replicas, writes to the primary

Multi-region compute becomes correct when *the data is also multi-region*. Replicas in each compute region make `d` intra-region for reads; writes still cross to the primary.

```ts
// lib/db.ts — reads go to the nearest replica, writes always to the primary
import { Pool } from 'pg'

const REGION = process.env.VERCEL_REGION ?? 'iad1'

const REPLICAS: Record<string, string | undefined> = {
  iad1: process.env.DATABASE_REPLICA_US_EAST,
  cdg1: process.env.DATABASE_REPLICA_EU,
  sin1: process.env.DATABASE_REPLICA_APAC,
}

export const primary = new Pool({ connectionString: process.env.DATABASE_URL })

export const replica = new Pool({
  connectionString: REPLICAS[REGION] ?? process.env.DATABASE_URL,
})
```

```ts
// app/boards/[id]/page.tsx
import { replica } from '@/lib/db'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { rows } = await replica.query(
    'select id, title, status from cards where board_id = $1 order by position',
    [id]
  )
  return <Board cards={rows} />
}
```

🔴 **The cost is read-your-own-writes.** A Server Action writes to the primary and the following read hits a replica that has not caught up, so the user's own change appears to have failed. The fix is to route the read that immediately follows a write to the primary:

```ts
// app/boards/[id]/actions.ts
'use server'

import { primary } from '@/lib/db'
import { updateTag } from 'next/cache'

export async function renameCard(cardId: string, title: string) {
  await primary.query('update cards set title = $1 where id = $2', [title, cardId])
  // Re-render this route from the primary in the same round trip.
  updateTag(`card-${cardId}`)
}
```

Replication lag is a distributed-systems property, not a Next.js one; the framework gives you `updateTag` for the read-your-own-writes case (see [chapter 5 · the three cache directives](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md)) and nothing at all for the rest of it.

### 3 · Partitioned by residency, not by latency

EU user data physically in the EU, US user data in the US, each region's compute talking only to its own partition. Here multi-region is a *requirement* rather than an optimisation, and the latency argument is irrelevant — you are not making anything faster, you are making it legal. The per-function `regions` map above is exactly the shape this takes: `api/eu-data.js` pinned to `cdg1`, and routing that decides which one a user reaches.

This is the only pattern where "we are multi-region" is a complete answer to "why". The other two need a number.

## Failover is not multi-region

> *"In the event of regional downtime, application traffic is automatically rerouted to the next closest region."*

For functions specifically, `functionFailoverRegions` is availability, not locality — and it has a constraint that trips people:

> *"The region(s) set in the `functionFailoverRegions` property **must be different** from the default region(s) specified in the `regions` property."*

> *"During an automatic failover, Vercel will reroute application traffic to the next closest region, meaning the order of the regions in `functionFailoverRegions` does not matter."*

⚠️ Failing over compute without failing over data means the failover region is now far from your database — the exact configuration this page argues against, entered automatically during an incident. That is usually the right trade (slow beats down), but it should be a known trade rather than a surprise.

## Before you change any of this, re-measure

The 16.3 release moved App Router SSR from web streams to native Node.js streams and, per the release notes, applications handle **up to 22% more requests under load** with no code changes — see [chapter 11 · native Node.js streams in SSR](../11-performance-optimization-turbopack/11-native-nodejs-streams-in-ssr.md). Any capacity or placement model built on pre-16.3 numbers is out of date, and "add regions" is an expensive answer to a question that may no longer be asked.

## Gotchas

**★ Symptom: `next build` warns about `preferredRegion` and CI treats it as a failure.** Cause: the export is deprecated in 16. Fix: delete it — the deprecation message's entire migration is one removed line — and express placement in platform configuration instead:

```diff
- export const preferredRegion = 'home'
```

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["cdg1"] }
```

**★ Symptom: you added `preferredRegion = ['iad1', 'sfo1', 'fra1']` and compute cost tripled.** Cause: the array form was never a preference list — *"The route is deployed to **all** listed regions, not a single one chosen from the list."* Fix: pick the one region nearest the data. This is one reason the option is gone: it read like a fallback chain and behaved like a fan-out.

**★ Symptom: you deployed to five regions and p95 got worse for everyone.** Cause: compute moved away from the database, so every sequential query now crosses a continent and the request pays that latency once per dependent trip. Fix: move compute back beside the data and attack the cacheable routes instead. If the uncached routes genuinely must be fast worldwide, the change you need is read replicas, not more compute regions.

**★ Symptom: a user renames a card, the UI reverts, and refreshing shows the new name.** Cause: the write went to the primary and the subsequent read hit a lagging replica. Fix: route the post-write read to the primary, and use `updateTag` so the mutation's own response carries the re-render — as in `renameCard` above.

**★ Symptom: the deployment fails before the build with a region error.** Cause: more regions requested than the plan allows — Hobby is single-region, Pro is five. Fix: reduce the list; the check runs before the build step, so it is fast to iterate on but never surfaces at runtime.

**★ Symptom: middleware latency is fine but function latency is regional.** Cause: they are configured by different things — *"Vercel deploys Routing Middleware to all regions by default, regardless of your region settings"*. Fix: stop inferring function placement from middleware behaviour, and do not move authentication logic into middleware to "make it faster" without checking what it then has to reach.

**★ Symptom: a third-party API integration is slow only from your new EU region.** Cause: the same data-locality rule applies to external services, not just databases: *"choosing regions far from those services increases latency"*. Fix: place the function near whatever it talks to most, and if two dependencies live on different continents, split the route so each function sits beside its own.

**★ Symptom: during a regional incident the site stayed up but every page was slow.** Cause: `functionFailoverRegions` moved compute to another region while the database stayed put, so you are now running the anti-pattern by design. Fix: nothing to change in the moment — but decide in advance whether a read replica in the failover region is worth provisioning, and document that the failover state is degraded rather than equivalent.

**Symptom: `functionFailoverRegions` is rejected at deploy time.** Cause: it overlaps the `regions` list, and the documentation requires them to be different. Fix: remove the overlap; a region cannot fail over to itself.

**Symptom: someone proposes edge runtime "so it runs everywhere".** Cause: the old mental model in which regions were an edge-runtime feature. Fix: note that `runtime = 'edge'` is deprecated in the same reference table as `preferredRegion`, and that geographic spread was never the constraint — the database was.

**Symptom: a per-function region override silently ignores your project-level failover setting.** Cause: per-function values *"completely override the corresponding project-level setting for that function"* — they do not merge. Fix: restate both `regions` and `functionFailoverRegions` inside any per-function block that sets either.

## Interview questions

**★ Why is deploying a Next.js app to five regions usually slower than deploying it to one?**
Because a dynamic request is not one network hop; it is several sequential database round trips wrapped in a single response. Placing compute near the user shortens the one user-to-compute hop and lengthens every compute-to-database hop — and the second set is multiplied by the number of dependent queries. Vercel's own documentation states the rule directly: functions should be executed in the same region as your database, or as close to it as possible. The routes that would have benefited from being closer to users are usually the cacheable ones, which the CDN already serves globally.

**★ `preferredRegion` is deprecated. What replaces it?**
Nothing at the framework level. The deprecation message's migration section consists of deleting the export, and it names no successor. That is consistent with what the option ever did: the reference says Next.js passes the region values through to the deployment platform and that behaviour and region codes are platform-specific. So placement is now expressed in platform configuration — `vercel.json` `regions` and per-function overrides on Vercel, container scheduling elsewhere. If someone tells you there is a new route-segment API for this, ask them for the documentation page.

**★ What did `preferredRegion: ['iad1', 'sfo1']` actually do, and why is that a good reason to remove the API?**
It deployed the route to *both* regions — the reference is explicit that the route goes to all listed regions, not one chosen from the list. It read like a fallback preference and behaved like a fan-out, so a config change intended to add resilience doubled compute for that route. An API whose most natural reading is the opposite of its behaviour is a good candidate for deletion.

**★ Under what conditions does multi-region compute actually help?**
Three. When the data is also multi-region — regional read replicas, so intra-region reads dominate. When residency law requires it, in which case latency is not the argument at all. And when the workload is genuinely compute-bound with no shared data dependency, which for a typical CRUD application it is not. Outside those, the honest recommendation is one region beside the database plus a higher cache hit rate.

**★ Walk through the read-your-own-writes problem in a read-replica architecture and its fix.**
A Server Action writes to the primary. The re-render that follows reads from the nearest replica, which has not received the write yet, so the user sees their own change missing — the worst possible staleness, because it looks like the action failed and they will retry. The fix is to route the read that immediately follows a write to the primary, and in Next.js terms to use `updateTag` rather than `revalidateTag`, so the mutation's response carries a freshly rendered payload instead of leaving the client to re-fetch from wherever. Everything beyond that — bounded staleness elsewhere, replica lag monitoring — is database work, not framework work.

**★ Your failover region is far from your database. Is that a misconfiguration?**
Not necessarily, but it must be a decision. During failover, compute runs in a region where every query crosses a continent, so the site is up and slow — which is normally the right trade. What makes it a misconfiguration is discovering it during the incident. Either provision a replica in the failover region, or write down that the failover state is degraded and set alert thresholds that do not page everyone when it is entered.

**★ Someone proposes moving authentication into middleware "because middleware runs everywhere". Respond.**
Two things. First, the premise is true — Routing Middleware is deployed to all regions regardless of the function region setting — but it is the reason to be careful, not the reason to proceed: globally-distributed code that has to reach a single-region session store pays the cross-continent round trip from wherever it happens to run. Second, this is the same data-locality argument in a smaller frame. If the check needs the database, it belongs where the database is. If it can be done with a signature verification and no I/O, middleware is a fine place for it.

**How does the 16.3 streaming change affect a multi-region decision?**
It changes the baseline you are comparing against. The release notes attribute up to 22% more requests handled under load to the move from web streams to native Node.js streams, with no application changes. A capacity model built before that upgrade will overstate how close you are to needing more compute, and "add regions" is one of the most expensive ways to buy headroom you may already have. Re-measure on 16.3 before changing topology — and treat "up to 22%" as a benchmark ceiling for SSR-bound work, not a promise for a database-bound route.

---

← [The cache across containers](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md) · [Chapter 17 overview](01-explanation.md) · Next → [Telemetry via `instrumentation.ts`](04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md)
