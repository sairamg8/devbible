---
title: "The seams that live in the data layer fail later and louder than the ones in the render tree — a cached function reading the request can pass `next build` and fail under `next start` — and the fix you reach for first should be the cheapest one, not the most architectural"
sidebar_label: "06c · Data-layer seams, choosing a fix"
sidebar_position: 24
description: "The remaining seam failures in a mixed Next.js 16.3.4 deployment: a cached function shared by a public page and a private board, searchParams in a shared component, and the three fix patterns with the rule for choosing between them."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25) and [Data Security](https://nextjs.org/docs/app/guides/data-security).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. No build output or route summaries are reproduced, because none were produced.

**[06b](06b-what-breaks-at-the-seams.md) covered the seams you can see in the component tree. The two below are worse in a specific way: they are in the data layer, so the file that causes them is further from the page that suffers, and one of them is documented to surface at *runtime* rather than at build — meaning a green CI pipeline is not evidence. Then the part that decides whether any of this stays fixed: three fix patterns, the order to try them in, and the one enforcement mechanism that survives staff turnover. The wrong fix gets proposed in every one of these discussions and it is always the same one, so it is named and rejected explicitly.**

## Seam 4 — a shared cached function

The same failure, one layer down, and it fails louder — which is a mercy.

```ts
// lib/teams.ts — 🔴 a cached function that reads the request
import { cacheTag } from 'next/cache'
import { cookies } from 'next/headers'

export async function getTeam(team: string) {
  'use cache'
  cacheTag(`team:${team}`)

  const session = (await cookies()).get('sd_session')?.value // throws
  return fetchTeam(team, session)
}
```

A cached function cannot read `cookies()`, and the documented restriction follows the call
stack — a helper the cached function calls that reads one of these fails the same way, with the
`next-request-in-use-cache` error. **And the timing is the trap:**

> *"On a dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail under `next start`."*

So the board (dynamic) can pass a build that the public team page's prerender would have failed,
depending on which route exercises the function first. Do not treat a green build as evidence.

**Fix — the authorization scope is an argument, not an ambient read:**

```ts
// lib/teams.ts — cached, keyed by exactly what authorized the data
import { cacheLife, cacheTag } from 'next/cache'

export async function getPublicTeamProfile(team: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('team-profile', `team-profile:${team}`)

  return fetchPublicProfile(team) // public by construction
}
```

```ts
// lib/teams-private.ts — not cached; the caller has already authorized
import 'server-only'

export async function getTeamRoster(team: string, userId: string) {
  await assertMembership(userId, team)
  return fetchRoster(team)
}
```

Two functions, two names, one grep away from being auditable. The reasoning is
[05d](05d-authenticated-dashboards.md)'s: what is in the key must be what authorized the data.
`use cache: private` is the documented escape hatch for reads that truly cannot be lifted out —
see [ch5 · `use cache: private`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md) —
and it is not what this situation needs, because the read lifts out fine.

## Seam 5 — `searchParams` in something shared

```tsx
// components/cta-button.tsx — 🔴 makes every page rendering it request-dependent
export async function CtaButton({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  return <a href={`/sign-up?ref=${ref ?? 'organic'}`}>Start free</a>
}
```

Marketing will put `?ref=` and `?utm_source=` on every link they publish, and this component is
on every page. **Fix — read it on the client**, since the value is only ever used to build a
URL the user clicks:

```tsx
// components/cta-button.tsx
'use client'

import { useSearchParams } from 'next/navigation'

export function CtaButton() {
  const ref = useSearchParams().get('ref') ?? 'organic'
  return <a href={`/sign-up?ref=${ref}`}>Start free</a>
}
```

⚠️ A Client Component calling `useSearchParams()` must itself sit inside a Suspense boundary for
the surrounding route to prerender. Putting the whole page's content inside that boundary
defeats the purpose — wrap the button, not the page.

## Choosing between the three fixes

| Fix | Use it when | Cost |
|---|---|---|
| **Push to the client** | The value is cosmetic and a first-paint default is tolerable | A flash, and the value is unavailable to crawlers |
| **Isolate behind Suspense** | The value must be server-rendered or comes from a server-only source | A streamed hole, a fallback that must not shift layout, and a platform that really streams |
| **Stop sharing the file** | The two subtrees have genuinely different contracts | Some duplication, plus a comment nothing enforces |

The wrong fourth option, which gets proposed in every one of these discussions: `force-static`
on the affected segment "so it stays static". It does stay static — by blanking the request and
prerendering the signed-out branch for everyone. [04b](04b-what-survives-and-the-force-static-trap.md)
is that failure in full.

Diagnosing which file caused an unexpected dynamic route is owned by
[ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).
The point of this page is that by the time you are diagnosing, the seam already exists — the
cheap defence is `dynamic = 'error'` on the segments that must stay prerendered, so the seam
fails the build the day it is introduced.


## Making the fix stick

Every fix above is a code change, and code changes get undone by people with good reasons.
Three mechanisms, in descending order of how much they survive:

**1 · `export const dynamic = 'error'` on every segment that must stay prerendered.** This is
the only item on the list that a machine enforces. A shared component that starts reading the
request fails the build on the day it is introduced, in the pipeline of the person who
introduced it. Everything else on this page is advice.

```tsx
// app/(marketing)/features/page.tsx
// If this line ever has to be removed to make the build pass, that is the
// signal to redecide the caching strategy — not to remove the line.
export const dynamic = 'error'
```

**2 · A comment in every shared file that straddles a caching boundary**, saying what may not go
in it. It does not enforce anything, but it converts "nobody told me" into "I read it and did it
anyway", which is a materially different code review.

**3 · Two functions with two names in the data layer**, so the public read and the private read
are separately greppable. A single function serving both areas is one destructuring change away
from a disclosure, and both call sites look legitimate.

⚠️ Under Cache Components the first mechanism does not exist — `v16.0.0` removes `dynamic`,
`dynamicParams`, `revalidate` and `fetchCache` when `cacheComponents` is enabled. The guarantee
has to be re-expressed in terms of what is inside a cached function, which is worked in
[06d · Acceptance criteria and the Cache Components variant](06d-acceptance-criteria-and-the-cache-components-variant.md).

## Gotchas

**★ Symptom: `next-request-in-use-cache` appears under `next start` on a route that built cleanly.** Cause: a cached function reads a Request-time API somewhere in its call stack, and the documentation states that on a dynamically rendered route this surfaces when the route runs — so it can pass `next build` and fail under `next start`. Fix: lift the read into the request-time caller and pass the authorized scope in as an argument, and never treat a green build as proof that no cached function reads the request.

**★ Symptom: `useSearchParams()` in a shared client component makes a page fail to prerender.** Cause: the hook requires a Suspense boundary for the surrounding route to prerender. Fix: wrap the component that reads it — the CTA button — not the page content. Wrapping the page satisfies the requirement and throws away the prerendering you were protecting.

**★ Symptom: a seam bug is fixed, then reappears three months later in a different file.** Cause: nothing enforced the rule. The shared layout is still shared, and the comment is advice. Fix: `dynamic = 'error'` on every segment that must stay prerendered turns the rule into a build failure — it is the only mechanism on this page that survives staff turnover, which is why [06](06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) puts it on the marketing pages rather than trusting the design document.

**★ Symptom: a single `getTeam()` helper is used by the public page and the board, and a refactor makes the public page render private fields.** Cause: one function serving two authorization contexts, so "what is public" became a property of which fields the JSX destructured. Fix: `getPublicTeamProfile(team)` and `getTeamRoster(team, userId)` — two names, two files, one of them marked `import 'server-only'`. Both call sites then read as what they are, and a grep for the private name lists every place private data is touched.

**★ Symptom: a cached function is "fixed" by switching it to `use cache: private`.** Cause: reading the error as a directive-capability problem rather than as a signal that the data is not shared. Fix: lift the read out, as above. `use cache: private` is documented as storing nothing server-side and executing on every server render, excluded from static shell generation — a permanent cost accepted to solve a temporary confusion. Its actual use cases are on [ch5 · `use cache: private`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md).

**★ Symptom: `?utm_source=` on every marketing link appears to disable caching sitewide.** Cause: a shared component reading `searchParams` on the server, and marketing puts tracking parameters on every link they publish without telling anyone. Fix: read them client-side with `useSearchParams()` inside a narrow boundary, since the value is only ever used to build a URL or fire an analytics event. If a search parameter genuinely must affect server rendering, that page is request-dependent by design and should say so.

**Symptom: the fix taxonomy is applied in reverse — every seam is solved by duplicating the layout.** Cause: "stop sharing the file" feels like architecture, so it gets reached for first. Fix: try the cheapest fix first. Duplicated layouts must be kept visually identical by hand forever, and the duplication is only justified when the two subtrees genuinely have different contracts — as a public page and a private board do, and as two marketing pages do not.

## Interview questions

**★ Why does the `next-request-in-use-cache` error deserve a specific mention in a milestone about seams?**
Because of when it appears. The documentation states that on a dynamically rendered route it surfaces when the route runs, so a cached function reading the request can pass `next build` and fail under `next start`. In a mixed deployment that means the dynamic board can exercise a shared cached function on a path where the failure is deferred, while the public page's prerender would have caught it — so which routes were built first determines whether CI is green. A green build is not evidence that no cached function reads the request.

**★ Someone proposes `force-static` on the marketing segment to stop it drifting dynamic. Respond.**
It would work in the sense that the pages stay prerendered, and it is the worst available option. `force-static` is documented as forcing prerendering by making `cookies`, `headers()` and `useSearchParams()` return empty values — so the shared header that caused the drift would still run, still read the session, get nothing, and render the signed-out state into HTML cached for everyone. The drift becomes invisible instead of fixed. `dynamic = 'error'` achieves the actual goal: the same read fails the build, loudly, on the day it is introduced.

**★ Which of the three fix patterns would you reach for first, and why does that ordering matter?**
Push to the client first, because it is the cheapest to implement and the easiest to reverse, and most seam-causing values are cosmetic — a theme, a locale, a "signed in" indicator. Isolate behind Suspense second, when the value must be server-rendered or comes from a server-only source. Stop sharing the file last, because duplication is a real ongoing cost and should be justified by the two subtrees genuinely having different contracts, which for a public page and a private board they do. The ordering matters because the third fix is the one people reach for first — it feels like architecture — and it leaves you maintaining two layouts that must be kept visually identical by hand.

**★ Why are two data-layer functions better than one function with a `visibility` argument?**
Because a boolean argument is invisible at the call site in exactly the way a name is not. `getTeam(team, { includePrivate: true })` looks like a configuration detail in a diff; `getTeamRoster(team, userId)` looks like a private read, and grepping the private name enumerates every place private data is touched. The second form also lets the private function carry `import 'server-only'` and its own authorization assertion, while the public one carries `use cache` and a tag — two different contracts that a single function would have to satisfy simultaneously.

**★ Your CI is green, your `next start` smoke test passes, and you still are not confident no shared file reads the request. What actually gives you confidence?**
A build-time assertion, not a test. `dynamic = 'error'` on the segments whose contract is "prerendered" makes the framework check the property on every build for every route in those segments, which is stronger than any sampling a smoke test can do. Tests confirm the routes you thought to check; the flag confirms the invariant. And when the flag has to be removed to make a build pass, that is not an obstacle — it is the signal, arriving at the right moment, that the caching strategy needs redeciding.

---

← [06b · What breaks at the seams](06b-what-breaks-at-the-seams.md) · [Chapter 6 overview](01-explanation.md) · Next → [06d · Acceptance criteria and the Cache Components variant](06d-acceptance-criteria-and-the-cache-components-variant.md)
