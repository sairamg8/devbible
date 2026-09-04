---
title: "Put static marketing pages, ISR'd public team pages and a fully dynamic authenticated board in one SprintDesk deployment — the three strategies are easy in isolation and the entire lesson is what happens where they touch"
sidebar_label: "06 · Milestone: three strategies, one deploy"
sidebar_position: 36
description: "The chapter 6 project milestone: the route shape for three rendering strategies in a single Next.js 16.3.4 deployment, the config each segment carries, why the layout hierarchy is the design, and the v16.0.0 removal that deletes half this config under Cache Components."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25), [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25) and [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) (`lastUpdated` 2026-03-30).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**.

**Building a static marketing page is a tutorial. Building an ISR'd public page is a tutorial. Building a per-request authenticated dashboard is a tutorial. Doing all three inside one `app/` directory is the thing nobody writes down, and it is where every mistake in this chapter actually happens — because the three areas are not isolated. They share a root layout, they share a header, and in SprintDesk's case the public team page and the private board share a `[team]` layout as well. One `cookies()` read in any of those shared files converts routes you designed as static into routes that render per request, with no error and nothing in the diff to point at. This chunk builds the shape and states the config; [06b](06b-what-breaks-at-the-seams.md) is the seam failures in code, which is the lesson.**

## What this milestone adds to SprintDesk

The scaffold from [ch4 · milestone](../04-data-fetching-in-the-app-router/06-project-milestone-scaffold-sprintdesk.md)
gave you `app/teams/[team]/board/` and a landing page. This milestone adds the two public areas
around it and makes each area's rendering strategy an explicit, defended decision.

| Area | Routes | Strategy | Why |
|---|---|---|---|
| Marketing | `/`, `/pricing`, `/features` | Prerendered at build | Content changes on deploy; identical for everyone |
| Public team pages | `/teams/[team]` | Prerendered + on-demand revalidation | Public, indexable, changes when a team edits its profile |
| The application | `/teams/[team]/board` | Per request | Authorized per user; nothing shareable |

Three strategies, one build, one deploy, one origin. That is the point — the component-level
boundary means you are not obliged to split them into separate applications:

> *"Static and dynamic content coexist within a single streaming response."*

## The route shape

```
app/
├── layout.tsx                        🔴 root layout — shared by ALL THREE areas
├── (marketing)/
│   ├── layout.tsx                    marketing chrome only
│   ├── page.tsx                      /            static
│   ├── pricing/page.tsx              /pricing     static
│   └── features/page.tsx             /features    static
├── teams/
│   └── [team]/
│       ├── layout.tsx                🔴 shared by the PUBLIC page and the PRIVATE board
│       ├── page.tsx                  /teams/[team]        ISR
│       └── board/
│           ├── layout.tsx            authenticated chrome
│           └── page.tsx              /teams/[team]/board  dynamic
├── api/
│   └── revalidate/route.ts           the CMS / profile-edit webhook
└── components/
    └── site-header.tsx               🔴 imported by all three areas
```

**Read the three 🔴 lines before writing any code.** They are the seams. Every failure in
[06b](06b-what-breaks-at-the-seams.md) originates in one of them, and none of them is visible
from the page files where the symptom appears.

Note the deliberate choice: `app/teams/[team]/layout.tsx` is shared between a public page and a
private board. That is not a contrived arrangement to manufacture a lesson — it is what you get
by following the URL structure, and it is exactly the arrangement that produces the most common
seam bug in real applications.

## Area 1 — marketing, prerendered

```tsx
// app/(marketing)/pricing/page.tsx
import { PlanTable } from '@/components/plan-table'
import { plans } from '@/content/plans'

// Nothing request-dependent in this subtree, so it prerenders by default.
// The explicit `error` makes that a build guarantee rather than a hope.
export const dynamic = 'error'

export default function Pricing() {
  return (
    <main>
      <h1>Pricing</h1>
      <PlanTable plans={plans} />
    </main>
  )
}
```

`dynamic = 'error'` is the single most useful line in this milestone. It is documented as
causing an error if any component uses Request-time APIs or uncached data — so if somebody
later imports a component that reads `cookies()`, the build fails instead of the page quietly
becoming per request. That is the difference between finding this in CI and finding it on a
latency dashboard three weeks later. `'force-static'` would *not* do this: it blanks the
request instead, as [04b](04b-what-survives-and-the-force-static-trap.md) works through.

## Area 2 — public team pages, ISR

```tsx
// app/teams/[team]/page.tsx
import { notFound } from 'next/navigation'
import { getTeamProfile, getActiveTeamSlugs } from '@/lib/teams'

export async function generateStaticParams() {
  const slugs = await getActiveTeamSlugs()
  return slugs.map((team) => ({ team }))
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  const profile = await getTeamProfile(team)
  if (!profile) notFound()

  return (
    <main>
      <h1>{profile.name}</h1>
      <p>{profile.blurb}</p>
      <ul>
        {profile.publicMembers.map((m) => (
          <li key={m.id}>{m.displayName}</li>
        ))}
      </ul>
    </main>
  )
}
```

```ts
// lib/teams.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getTeamProfile(team: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('team-profile', `team-profile:${team}`)

  const res = await fetch(`${process.env.API_URL}/teams/${team}/profile`)
  if (res.status === 404) return null
  return res.json()
}
```

```ts
// app/api/revalidate/route.ts — called when a team edits its public profile
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  if (request.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { team } = await request.json()
  if (typeof team !== 'string') return new Response('Bad Request', { status: 400 })

  revalidateTag(`team-profile:${team}`, 'max')
  return Response.json({ revalidated: true })
}
```

🔴 **Do not add `export const dynamicParams = false` here.** New teams are created by users, not
by deploys, and the documentation is explicit that with that option *"only paths provided by
`generateStaticParams` will be served, and unspecified routes will 404."* Every team created
since the last release would 404. The enumeration is a warm start, nothing more —
`generateStaticParams` is documented as not being called again during revalidation.

`profile.publicMembers` is doing real work in that page: the public profile returns only the
members a team has chosen to show. The private roster is not fetched here at all, which keeps
the "what is public" decision in the data layer rather than in the JSX — the same discipline as
the paywall in [05b](05b-content-platforms-and-the-ssr-reflex.md).

## Area 3 — the board, per request

```tsx
// app/teams/[team]/board/layout.tsx — authorization lives at the top of the PRIVATE subtree
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { BoardChrome } from '@/components/board-chrome'

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  const user = await getSessionUser() // reads cookies() — dynamic, deliberately
  if (!user) redirect(`/sign-in?next=/teams/${team}/board`)

  return <BoardChrome user={user}>{children}</BoardChrome>
}
```

This layout reads `cookies()` and that is correct — it sits at the top of the *private* subtree
only, so it makes the board dynamic and touches nothing else. Compare that with the same read
one level up in `app/teams/[team]/layout.tsx`, which would drag the ISR'd public page dynamic
too. **Where the read sits is the entire design.**

⚠️ The `redirect` here is a convenience, not the control. Authorization is enforced in the data
layer on every read — see [05d](05d-authenticated-dashboards.md) and the documented Data Access
Layer requirement to *"Perform authorization checks."*

## The config, per segment

| File | Config | Effect |
|---|---|---|
| `app/(marketing)/*/page.tsx` | `dynamic = 'error'` | Prerender, and fail the build if anything reads the request |
| `app/teams/[team]/page.tsx` | none; `generateStaticParams` + `cacheTag` | Prerender the head, generate the tail, invalidate on demand |
| `app/teams/[team]/layout.tsx` | 🔴 **none, and that is a rule** | Any config or request read here applies to the board *and* the public page |
| `app/teams/[team]/board/**` | none needed — the `cookies()` read makes it dynamic | Per request by inference, not by flag |

Two things worth arguing about in that table.

**The board carries no `force-dynamic`.** It does not need one: reading `cookies()` in its
layout already makes it request-time. Adding the flag would be redundant today and an obstacle
tomorrow, because it is a route-level statement about a data-level fact — the reasoning in
[05d](05d-authenticated-dashboards.md).

**The `[team]` layout's config cell is a prohibition, not a value.** It is the only row that
constrains what people may *not* write, and it needs a comment in the file saying so, because
nothing in the tooling enforces it.

## 🔴 Half this config disappears under Cache Components

`v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` when
`cacheComponents` is enabled, and the 16.3.4 Route Segment Config reference no longer documents
them — they live in a guide explicitly titled *Caching and Revalidating (Previous Model)*. So
the `dynamic = 'error'` lines above are correct for a project with the flag off and **do not
exist** for one with it on.

That is not a reason to avoid them. It is a reason to know which model you are in, and to write
the milestone twice — the flag-off version here, and the Cache Components version in
[06d](06d-acceptance-criteria-and-the-cache-components-variant.md). The `use cache`, `cacheLife`
and `cacheTag` calls in this page are the part that survives the transition; the segment config
is the part that does not. The mechanics are owned by
[ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md)
and [ch5 · choosing a cache directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md).

## Gotchas

**★ Symptom: the marketing pages are described as static in the design doc, and nobody can say whether they actually are.** Cause: nothing asserts it. Prerendering is inferred, so it is also silently lost. Fix: `export const dynamic = 'error'` on every marketing page segment, which converts the intention into a build-time guarantee — and be sure it is `'error'` and not `'force-static'`, because the latter would blank the request and prerender a wrong page instead of failing.

**★ Symptom: a newly created team's public page 404s until the next deploy.** Cause: `dynamicParams = false` on the `[team]` segment. The documentation states plainly that with it, only paths from `generateStaticParams` are served and everything else 404s. Fix: remove it. It is right for a fixed set of paths and wrong for anything users create, and in SprintDesk teams are created by users all day.

**★ Symptom: the `[team]` layout gains a `revalidate` export and the board starts serving stale data.** Cause: segment config applies to everything below it, and the board is below it. Fix: the `[team]` layout carries no rendering config at all — put a comment in the file saying why, because the next person to open it will see an obvious place to put a shared setting and will be right about the file and wrong about the blast radius.

**★ Symptom: the public team page shows private members after a refactor.** Cause: the page started calling the same roster function the board uses, because it was there and it returned members. Fix: keep two functions with two names — `getTeamProfile` returning only `publicMembers`, and the board's own roster read — and make "public" a property of the data layer rather than of which fields the JSX chose to render. A shared data function between a public and a private area is a seam as dangerous as a shared layout.

**★ Symptom: the profile-edit webhook works in staging and silently does nothing in production.** Cause: `revalidateTag` invalidates a tag that no cached function actually applies, usually after a rename. Fix: define tag strings in one module imported by both the cached function and the webhook, so a rename is a type error rather than a silent no-op. Nothing in the framework reports an invalidation that matched nothing.

**★ Symptom: an editor updates the team profile and the change appears on `/teams/acme` but not in the team list on `/`.** Cause: the marketing home page has its own cache entry, and the webhook only invalidated the per-team tag. Fix: invalidate the collection tag as well as the item tag, or — better here — do not put live team data on a page you declared `dynamic = 'error'`, because that is a page whose whole contract is that it changes on deploy.

**Symptom: three "rendering strategies" turn into three deployments during planning.** Cause: importing habits from route-level frameworks, where static files go to a CDN and dynamic routes go to a server. Fix: they belong in one application, because the boundary is at the component level — splitting them means three builds, three deploys, three sets of shared components duplicated or extracted into a package, and a header that has to be kept identical by hand.

## Interview questions

**★ Why is putting three rendering strategies in one deployment worth doing, rather than splitting them?**
Because the framework's boundary is at the component level rather than the route level, so nothing forces the split — and the split is expensive in exactly the places that matter. Three applications means three builds, three deploys, a shared component library extracted into a package with its own release cycle, and a site header that has to be kept visually identical across three codebases by hand. The counter-argument is real but narrower than people assume: separate deployments give you separate blast radii, which matters if the marketing site must stay up during an application incident. That is a availability argument, not a rendering one, and it should be made on those terms.

**★ Why does the board carry no `force-dynamic`?**
Because it does not need one. Its layout reads `cookies()` for the session, which makes the subtree request-time by inference. Adding the flag would be redundant now and an obstacle later: it is a route-level statement about a data-level fact, it prevents any part of the subtree from ever being prerendered even if that later becomes desirable, and it does not exist at all under Cache Components. The flag is a useful override when inference gives the wrong answer — not a way of documenting an answer inference already got right.

**★ Which single file in this milestone is the most dangerous, and why?**
`app/teams/[team]/layout.tsx`, because it is shared by a route that must be cacheable and a route that must not be, and nothing in the file signals that. Any request-time read or segment config placed there applies to both. It looks like an ordinary layout, it is the obvious place to put anything the team pages have in common, and putting the wrong thing there silently converts your ISR'd public pages into per-request renders. That is why its row in the config table is a prohibition rather than a value.

**★ `dynamic = 'error'` or `dynamic = 'force-static'` for the marketing pages?**
`'error'`, without hesitation. Both force prerendering; they differ in what happens when you are wrong. `'error'` fails the build when a component reads a Request-time API, so the mistake is found in CI by the person who made it. `'force-static'` prerenders anyway, blanking `cookies`, `headers()` and `useSearchParams()` to empty values, so the same mistake produces plausible, wrong, cached HTML. One is a red pipeline; the other is a support ticket about users seeing a signed-out header.

**★ How does this milestone change when `cacheComponents` is enabled?**
The `use cache`, `cacheLife` and `cacheTag` calls survive unchanged; the segment config does not, because `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under the flag. So the `dynamic = 'error'` guarantees have to be re-expressed, and the "is this route static" question is answered by which data is inside a cached function rather than by a route-level declaration. The Cache Components variant is worked in [06d](06d-acceptance-criteria-and-the-cache-components-variant.md); the useful framing is that the flag moves the decision from the route to the data, which is where this chapter argued it belonged all along.

**★ Why keep the public profile read and the private roster read as two separate functions?**
Because "which fields are public" is a data-layer decision, and merging the functions moves it into whichever component happens to render them. The instant one function serves both areas, the public page is one destructuring change away from rendering private members, and no test will catch it because both call sites are legitimate. Two functions with two names make the public surface something you can read in the data layer and grep for — the same discipline as returning only free blocks from a cached article function behind a paywall.

---

← [05d · Authenticated dashboards](05d-authenticated-dashboards.md) · [Chapter 6 overview](01-explanation.md) · Next → [06b · What breaks at the seams](06b-what-breaks-at-the-seams.md)
