---
title: "On an authenticated dashboard the rendering decision is subordinate to the authorization decision, because the only failure that matters is serving one tenant's data to another — so the question stops being static-or-dynamic and becomes what is in the cache key"
sidebar_label: "05d · Authenticated dashboards"
sidebar_position: 21
description: "The third decision walkthrough: a per-user, per-tenant application where nothing is cacheable at the CDN, the real win is not blocking on the slowest query, and every caching decision has to be justified against a cross-tenant leak."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Data Security](https://nextjs.org/docs/app/guides/data-security), [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (docs `lastUpdated` 2026-08-25), [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [Server Actions](https://nextjs.org/docs/app/guides/server-actions) and [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. No latency or throughput figures appear — none were measured.

**A dashboard inverts the previous two walkthroughs. There is no SEO requirement, no anonymous traffic worth caching for, and no editor whose publish latency drives anything. What there is instead is a failure mode the other two do not have: showing one customer another customer's data. That reorders the whole decision — the rendering question becomes downstream of the authorization question, and every caching choice has to survive being asked "what exactly is in the key, and does it include the identity that authorized this data?" The performance win on a dashboard is not caching the page; it is refusing to block the shell on the slowest widget. Get that ordering wrong and you will build a fast application that occasionally commits a data breach.**

## Walkthrough 3 — the SprintDesk application

`/app/*`: a project board behind a login. Multiple organisations, multiple projects per
organisation, role-based permissions inside each. Widgets on the overview: my assigned tasks,
sprint burndown, team activity, and an organisation-wide metrics panel that is expensive to
compute and identical for everyone in the organisation.

### Requirements

- **Nothing is public.** Every byte requires a session and a permission check.
- **Multi-tenant.** A user belongs to one or more organisations and must see exactly those.
- **Perceived speed matters more than absolute speed** — this is a tool people use all day.
- **Mutations everywhere**: drag a card, toggle a filter, comment.
- The organisation metrics panel takes seconds to compute and is **the same for the whole org**.
- No SEO requirement of any kind.

### The forcing axis: what is in the cache key

Not freshness. Not personalisation. **Authorization.** The reasoning runs in one direction only:

1. Every piece of data on this page is authorized by *something* — a session, an organisation
   membership, a project role.
2. A cache entry is shared by everyone whose key matches.
3. Therefore any cached value must be keyed by **at least** the thing that authorized it.

That single rule decides the whole design, and it disqualifies more designs than any
performance consideration will. It also explains why "just cache the dashboard" is the most
dangerous suggestion in the room: the dashboard is authorized per user, so its cache key must
be per user, so a shared server-side cache of it is a pile of per-user entries with a
cross-tenant leak one key-construction bug away.

The documentation's own position is that the check belongs in the data layer, not the route:

> *"Only run on the server. Perform authorization checks. Return safe, minimal Data Transfer Objects (DTOs)."*

And, from the proxy reference, the sentence worth pinning above the design:

> *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*

**Pattern: the authenticated segment renders per request; the chrome is a cheap shell; every
widget streams in its own boundary; the one genuinely shared expensive query is cached with an
organisation-scoped key; per-user data is not cached server-side at all.**

### The three tiers on one page

```tsx
// app/(app)/[org]/overview/page.tsx
import { Suspense } from 'react'
import { MyTasks } from './my-tasks'
import { Burndown } from './burndown'
import { TeamActivity } from './team-activity'
import { OrgMetrics } from './org-metrics'

export default async function Overview({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const { org } = await params

  return (
    <div className="grid">
      {/* Shared across the org, expensive, cached with an org-scoped key. */}
      <Suspense fallback={<OrgMetrics.Skeleton />}>
        <OrgMetrics org={org} />
      </Suspense>

      {/* Per user. Not cached server-side. Streams independently. */}
      <Suspense fallback={<MyTasks.Skeleton />}>
        <MyTasks org={org} />
      </Suspense>

      <Suspense fallback={<Burndown.Skeleton />}>
        <Burndown org={org} />
      </Suspense>

      <Suspense fallback={<TeamActivity.Skeleton />}>
        <TeamActivity org={org} />
      </Suspense>
    </div>
  )
}
```

Four boundaries, four independent waterfalls, one shell that renders immediately. The page does
not wait for `OrgMetrics` to finish before showing `MyTasks`, which is the entire perceived-speed
budget on a dashboard. Boundary placement is owned by
[ch4 · where to put boundaries](../04-data-fetching-in-the-app-router/02b-where-to-put-boundaries-loading-js-and-granular-streaming.md).

```ts
// lib/metrics.ts — the ONLY cached thing on this page, and the key says why
import { cacheLife, cacheTag } from 'next/cache'

// Authorized by organisation membership, so the key is the organisation.
// The caller must already have verified that this user belongs to `org`.
export async function getOrgMetrics(org: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`org-metrics:${org}`)

  return computeExpensiveOrgMetrics(org)
}
```

```tsx
// app/(app)/[org]/overview/org-metrics.tsx — the check happens OUTSIDE the cached scope
import { requireOrgMembership } from '@/lib/auth'
import { getOrgMetrics } from '@/lib/metrics'

export async function OrgMetrics({ org }: { org: string }) {
  await requireOrgMembership(org) // reads cookies(); throws or redirects
  const metrics = await getOrgMetrics(org) // cached, keyed by org only

  return <MetricsPanel metrics={metrics} />
}
```

🔴 **The ordering in that component is the design.** The authorization read happens in the
request-time component; the cached function receives only `org`, which is exactly what
authorized the data. A cached function cannot read `cookies()` anyway — the documented
restriction follows the call stack and produces `next-request-in-use-cache` — but the point is
not that the framework stops you. The point is that being stopped is a *hint* that the cache
key and the authorization boundary have to line up, and the correct response is to move the
check out, never to reach for a directive that lets you keep it in.

Per-user widgets are simply not cached server-side:

```tsx
// app/(app)/[org]/overview/my-tasks.tsx
import { getSessionUser } from '@/lib/auth'
import { getAssignedTasks } from '@/lib/tasks'

export async function MyTasks({ org }: { org: string }) {
  const user = await getSessionUser()          // reads cookies(); request-time
  const tasks = await getAssignedTasks(user.id, org) // authorization inside the DAL

  return <TaskList tasks={tasks} />
}
```

There is a directive that would let a per-user read live inside a cached scope —
`use cache: private`, covered in
[ch5 · `use cache: private`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md).
It is documented as the only directive that may read cookies, and it stores nothing on your
server. On a dashboard it is a deliberate, narrow tool for a query you cannot refactor or data
that must not rest on a server — not the general answer to "my widget is per user", because it
executes on every server render and is excluded from static shell generation anyway. Read that
page before using it; do not infer its rules from this one.

### The mixed-directive picture

One page here has all three kinds of data — build-known chrome, org-shared metrics, per-user
tasks — which is the composition problem set out in
[ch5 · composing static, ISR and dynamic on one page](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01b-composing-the-three.md).
The dashboard's contribution to that discussion is the constraint the other examples do not
have: **the tier a piece of data belongs to is decided by what authorized it, not by how
expensive it is.** An expensive per-user query stays uncached. A cheap org-shared query may be
cached. Cost does not get a vote.

### What you gave up

**CDN caching, essentially entirely.** Nothing on this page is servable to a second person, so
the edge is reduced to terminating TLS closer to the user. That is not nothing, but it is not
what the edge is sold as.

**Origin compute scales with active users**, not with content. This is the cost curve you chose,
and it is the one where [ch16 · cost engineering](../16-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md)
earns its place — the lever is query cost per widget, not cache hit ratio.

**A cold cache on every deploy.** Cache entries are keyed by build ID, so the org-metrics entry
is empty after every release and the first viewer of each organisation pays the expensive
computation. On a dashboard deployed several times a day, that is most viewers.

**A small static shell.** PPR's value is proportional to how much of the page is shared, and
here that is the navigation and the layout frame. Worth having, not worth architecting around.

### Review trigger

- **A widget's data stops being per user.** Org-wide charts, published reports, a shared
  activity feed — each is a candidate to move from uncached to org-keyed cache, and each moves
  only after someone can state what authorized it.
- **Origin compute becomes the dominant cost line**, which points at query cost or at caching
  the newly-shared widgets, not at the rendering strategy.
- **A public surface appears** — a shareable read-only board link, an embed. That page is a
  different product with a different axis, and it should not inherit this segment's config.
- **Tenant count grows enough that per-org cache entries themselves become the storage line.**

## Gotchas

**★ Symptom: a user sees another organisation's numbers, intermittently, and it cannot be reproduced.** Cause: a cached function whose key does not include the thing that authorized the data — typically a helper cached "for performance" that takes a project ID but not an organisation, so two tenants with colliding inputs share an entry. Fix: make the rule mechanical — every cached function's arguments must include the authorization scope, and the membership check happens in the request-time caller as in `OrgMetrics` above. A cache key that does not mention the tenant is a review-blocking defect regardless of whether a leak has been observed.

**★ Symptom: authorization lives in the layout, and a route under it turns out to be reachable without it.** Cause: treating a layout as a security boundary. Layouts render above the page, but the documented guidance puts the check in the data access layer for a reason — *"Perform authorization checks"* is listed as a Data Access Layer requirement, and the proxy reference says explicitly to verify inside each Server Function rather than relying on `proxy.ts` alone. Fix: check in the DAL, on every read, and treat the layout check as a redirect convenience rather than a control.

**★ Symptom: a developer hits `next-request-in-use-cache` and fixes it by switching the function to `use cache: private`.** Cause: reading the error as "this directive cannot use cookies" instead of "this data is not shared, so it should not be in a shared cache". Fix: move the request-time read out into the calling component, exactly as `OrgMetrics` does, and pass the authorized scope in as an argument. `use cache: private` is a narrow tool with a permanent cost, documented on [its own page](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md); reaching for it to silence an error is how it ends up everywhere.

**★ Symptom: a user updates something, navigates away, comes straight back, and sees the old value.** Cause: the client router's cache. The documentation states the client router *"enforces a minimum 30-second stale time, regardless of configuration"*, communicated with `x-nextjs-stale-time`. Fix: mutate through a Server Action so the re-rendered payload ships with the action's response, rather than mutating via a route handler and relying on navigation to pick up the change. On a dashboard people navigate in seconds, so this window is hit constantly and gets reported as "the app is stale".

**★ Symptom: rapid interactions — toggling several filters, dragging cards quickly — feel serialised.** Cause: they are. *"Next.js dispatches Server Actions one at a time per client"*, and the docs explicitly warn not to rely on `Promise.all` to parallelise actions from the client. Fix: batch the interaction into one action, or handle high-frequency UI state optimistically on the client and persist on settle. See [ch4 · Server Action hooks and optimistic UI](../04-data-fetching-in-the-app-router/01c-server-action-hooks-optimistic-ui-and-security.md).

**★ Symptom: the whole dashboard shows one big spinner instead of filling in widget by widget.** Cause: a `loading.tsx` at the segment level, which replaces the entire segment while any part of it is pending, rather than per-widget Suspense boundaries. Fix: use boundaries around each widget as in the page above, and reserve `loading.tsx` for the navigation-level transition. The two are not alternatives — a segment-level file undoes the granularity of the boundaries below it.

**★ Symptom: the expensive org-metrics query runs constantly after each deploy and load spikes for an hour.** Cause: cache entries include the build ID in their key, so nothing survives a release — *"Neither caching directive carries over to a new deploy"*. Fix: accept it and size for it, or warm the entries for active organisations after deploy. On a several-deploys-a-day dashboard this is not an edge case; it is the steady state, and it is a real argument for deploying less often or for moving the computation into a scheduled job with its own store.

**★ Symptom: a per-user widget's data appears in a prefetched payload for a link the user never clicked.** Cause: prefetching pulls the target route's payload into the client router cache. That is not a leak — it is the same user's data — but it does mean per-user data is fetched more often than it is displayed. Fix: nothing security-wise; operationally, be aware that origin load on a dashboard includes prefetch traffic, and measure it separately before concluding a widget is slow because it is popular.

**★ Symptom: a "share this board" feature is added under the authenticated segment and inherits its config.** Cause: a public page grafted onto a private tree. Fix: give it its own route segment outside the authenticated group, with its own decision record — its axis is a share-token check and public cacheability, which has nothing in common with this walkthrough. Inheriting the dashboard's layout is exactly how a layout that reads cookies ends up on a page that must not, which is the seam failure worked through in [06b](06b-what-breaks-at-the-seams.md).

**Symptom: someone proposes caching the whole dashboard page "since users reload it all day".** Cause: reasoning from access frequency rather than from authorization. Fix: apply the rule out loud — the page is authorized per user, so its key must be per user, so the cache is a per-user pile of entries with a leak one key bug away, in exchange for saving a query the user was going to make anyway. Frequency is not an argument for caching; shared authorization is.

## Interview questions

**★ Why is authorization, not freshness, the forcing axis on an authenticated dashboard?**
Because it is the only failure that is unrecoverable. A stale widget is an annoyance; showing one tenant another tenant's data is a breach, a notification obligation and possibly a lost customer. So the design runs from the authorization boundary outward: each piece of data is authorized by something, a cache entry is shared by everyone whose key matches, therefore every cached value must be keyed by at least the thing that authorized it. Everything else — streaming, boundaries, cache lifetimes — is optimisation inside that constraint.

**★ What is the actual performance win on a dashboard, if caching is mostly unavailable?**
Not blocking the shell on the slowest query. The page renders its frame immediately and each widget streams into its own Suspense boundary, so a three-second metrics computation delays one panel instead of the entire application. That is a perceived-speed win of the same magnitude as caching would have been, and unlike caching it is available on data that is unique to one user. The second win is parallelism: independent boundaries mean independent waterfalls rather than one sequential chain.

**★ You hit `next-request-in-use-cache` because a cached helper reads `cookies()`. What do you do?**
Move the read out, not the boundary in. The error is telling you that a shared cache is being asked to hold data that was authorized per request, and the correct response is to perform the check in the request-time component and pass the authorized scope — an organisation ID, a project ID — into the cached function as an argument, so the cache key and the authorization boundary are the same thing. `use cache: private` exists for the cases where that refactor is genuinely impossible or where compliance forbids the data resting on a server; using it to silence the error converts a design signal into a permanent per-render cost.

**★ Which single query on this dashboard is worth caching, and why that one?**
The organisation metrics panel, because it satisfies both conditions: it is expensive, and it is authorized by organisation membership rather than by individual identity — so one entry legitimately serves every member of that organisation. Note the order of the conditions. Expense alone is not sufficient: an expensive per-user query stays uncached, because caching it would produce a per-user entry pile whose only benefit is to a user who was going to run the query once anyway. Shared authorization is what makes a cache entry worth having.

**★ A user saves a change, navigates away and back, and sees the old value. Explain it.**
The client router cache. The documentation states it enforces a minimum 30-second stale time regardless of configuration, which on a dashboard — where people navigate in seconds — is hit constantly. The fix is architectural rather than configurational: mutate through a Server Action, so the re-rendered RSC payload ships in the action's own response and the view is correct before any navigation happens. Relying on navigation to refresh state is what puts you inside that 30-second window.

**★ Why does a dashboard get a cold cache problem that a content site does not?**
Because cache entries include the build ID, so nothing survives a deploy — and a dashboard is typically deployed several times a day while a content site is not. On a content site the archive re-warms gradually from organic traffic across a long tail. On a dashboard, the small number of expensive shared entries are all cold at once, and the users arriving in the minutes after a release all pay for them. That is a genuine argument for warming the entries for active tenants after deploy, or for moving the computation into a scheduled job with a store of its own.

**★ Someone proposes putting the whole authenticated area behind `force-dynamic` and stopping there. What is wrong with that?**
Nothing about correctness — it is a defensible starting point and far safer than the opposite mistake. What is wrong is that it stops. `force-dynamic` says the *route* is per request, which is true, but it says nothing about the widgets, and the page will still block on its slowest query unless you add boundaries. It also forecloses the one legitimate cache — the org-shared expensive panel — because a route-level flag is the wrong unit for a data-level decision. Under Cache Components the flag does not exist at all, so a design that depends on it has a migration ahead of it.

**★ How do you decide, mechanically, which tier a piece of dashboard data belongs to?**
Ask what authorized it, then key by that. Data authorized by nothing — the navigation chrome, the empty states, the labels — is build-known and shared by everyone. Data authorized by organisation membership can be cached with the organisation in the key. Data authorized by individual identity is not cached server-side. Notice that cost never enters the decision: an expensive per-user query stays uncached and a cheap org-wide one may be cached, which is the opposite of the instinct most people bring from a performance-first framing.

---

← [05c · Operating it at archive scale](05c-operating-a-decomposed-page-at-archive-scale.md) · [Chapter 6 overview](01-explanation.md) · Next → [06 · Project milestone: three strategies, one deployment](06-project-milestone-static-marketing-pages-isrd-public-team-pa.md)
