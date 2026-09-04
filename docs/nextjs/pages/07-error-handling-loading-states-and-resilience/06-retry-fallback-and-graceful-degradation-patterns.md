---
title: "The framework gives you one recovery button and no retry policy at all, so backoff, attempt limits and timeouts are things you write or things your app does not have"
sidebar_label: "06 · Retry, fallback and degradation"
sidebar_position: 18
description: "What retry() and reset() actually recover, what the documentation pointedly does not specify about retrying, why an unbounded retry button is a load generator, and the degradation ladder that decides what a failing dependency should cost the user."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-10`), the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`) and the
> [`error.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (`lastUpdated: 2026-07-10`), whose `retry`/`reset` semantics are covered in
> [09](09-errorjs-props-retry-and-reset.md) rather than repeated here.
> 🔴 **The documentation specifies no retry count, backoff schedule or timeout for `retry()`; this
> page says so rather than inventing one.** Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no timings**.

**"Try again" is a complete recovery strategy only if the thing that failed was transient, and
nothing in the framework knows whether it was.** `retry()` re-fetches and re-renders the segment;
`reset()` re-renders it without re-fetching. That is the entire recovery surface, and both are
manual — a user has to press something. There is no automatic retry, no exponential backoff, no
attempt ceiling, no circuit breaker and no timeout, and the documentation does not describe any,
because those are application policy rather than framework behaviour. What follows is the policy
layer: what to do before offering a retry, what to offer when a retry cannot help, and how to
stop a recovery button from becoming the thing that keeps a struggling dependency down.

## What the framework actually provides

| Affordance | What it does | What it does not do |
|---|---|---|
| `retry()` | Re-fetches **and** re-renders the segment | Wait, back off, limit attempts, or know whether the failure was transient |
| `reset()` | Re-renders the segment **without** re-fetching | Help at all when the failure was in the data |
| `error.js` / `global-error.js` | Render a fallback in place of the crashed subtree | Recover anything by itself |
| A reload | Fetches the current build and re-runs everything | Preserve unsent user input |

The mechanics of the first two — including the trap where a boundary copied from pre-16.3
material gives you a working button that re-renders the same failed server output — are in
[09 · `error.js` props](09-errorjs-props-retry-and-reset.md).

🔴 **`reset()` after a data failure is the classic no-op.** The user presses "Try again", the
segment re-renders from the same failed result, and the same error UI comes back instantly. It
looks like a broken button and is in fact the documented behaviour of the wrong prop.

## The degradation ladder

Before writing a retry, decide what the failure should cost. There are four rungs, and most
teams only ever implement the last one.

| Rung | The dependency fails and… | Where it is implemented |
|---|---|---|
| **1 · Invisible** | the feature is omitted, nothing is said | the component returns `null` |
| **2 · Degraded** | the feature is replaced by a reduced version | the component returns a fallback |
| **3 · Announced** | the feature is replaced by an explanation and an affordance | a boundary, or an explicit branch |
| **4 · Fatal** | the page cannot render | a throw reaching a boundary |

The rung is a product decision, not a technical one — and the technical mistake is letting every
failure land on rung 4 by default because throwing is what an error does when nobody chose
otherwise.

```tsx
// app/product/[id]/recommendations.tsx
// Rung 1: recommendations are a nice-to-have. Their absence is not news.
export async function Recommendations({ productId }: { productId: string }) {
  const items = await getRecommendations(productId).catch(() => null)
  if (!items?.length) return null
  return <Carousel items={items} />
}
```

```tsx
// app/product/[id]/live-stock.tsx
// Rung 2: the live count is unavailable; the cached one is still useful.
export async function LiveStock({ productId }: { productId: string }) {
  const live = await getLiveStock(productId).catch(() => null)
  if (live) return <p>{live.count} in stock</p>

  const cached = await getCachedStock(productId)
  return <p title="Last known availability">About {cached.count} in stock</p>
}
```

⚠️ **Rung 1 and rung 2 both swallow the error, and that is the correct behaviour only if you
still report it.** A `.catch(() => null)` with no logging converts an outage into a permanently
missing feature nobody investigates — the same defect as
[02](02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md)'s green health check,
arrived at deliberately instead of by accident.

## Retry is not free, and the client makes it worse

Two framework behaviours combine badly with an eager retry button.

**Actions serialise.** Next.js dispatches Server Actions one at a time per client, so a user
hammering a failing action queues the attempts rather than racing them — each retry takes longer
to report than the last. That is
[03b · Sequential dispatch](03b-sequential-dispatch-and-what-it-does-to-error-ui.md)'s subject,
and it is the reason a disabled-while-pending button is a correctness measure here.

**A retry re-fetches the whole segment.** `retry()` does not know which call failed; it re-runs
the segment's data fetching. A page with six queries where one is failing re-issues all six on
every press — five of them successful, and all of them load on a system that is already unhealthy.

```tsx
// app/dashboard/error.tsx
'use client'

import { useEffect, useState } from 'react'
import { reportError } from '@/lib/observability'

const MAX_ATTEMPTS = 3

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [attempts, setAttempts] = useState(0)
  const exhausted = attempts >= MAX_ATTEMPTS

  useEffect(() => {
    reportError(error, { digest: error.digest, surface: 'dashboard' })
  }, [error])

  return (
    <section role="alert">
      <h2>We could not load your dashboard</h2>
      {exhausted ? (
        <p>
          This has failed {MAX_ATTEMPTS} times. Please try again in a few minutes, or{' '}
          <a href="/support">contact support</a> with reference{' '}
          <code>{error.digest ?? 'unknown'}</code>.
        </p>
      ) : (
        <button
          onClick={() => {
            setAttempts((n) => n + 1)
            retry()
          }}
        >
          Try again
        </button>
      )}
    </section>
  )
}
```

🔴 **The attempt counter lives in the boundary's own state, which survives as long as the
boundary is mounted.** That is what makes it work: a successful `retry()` replaces the boundary
with the recovered UI, so the count is discarded on success and only accumulates while the
failure persists.

## What the documentation does not give you

Stated plainly, because the absence is the useful fact:

- **No retry count.** Nothing limits how many times `retry()` can be pressed.
- **No backoff.** `retry()` re-fetches immediately, every time.
- **No timeout.** Neither prop imposes a deadline on the work it restarts.
- **No transience classification.** The boundary cannot tell a network blip from a permanent
  schema error, so it offers the same button for both.

If your application needs any of these, they are yours to write — in the boundary, as above, or
around the data access itself, which is
[06b · Timeouts, backoff and the retries you own](06b-timeouts-backoff-and-the-retries-you-own.md).

## Gotchas

### A retry button that cannot help
**Symptom.** Pressing "Try again" re-renders the identical error instantly, with no network
activity at all.
**Cause.** The boundary calls `reset()`, which re-renders without re-fetching. If the failure was
in the data, nothing has changed.
**Fix.** Call `retry()` — see [09](09-errorjs-props-retry-and-reset.md) for the full distinction
and the version history that dates it.

### An unbounded retry that becomes a load generator
**Symptom.** A dependency recovers more slowly during an incident than it does in a load test,
and the traffic is coming from your own error pages.
**Cause.** Every user staring at a broken page has a button that re-issues the segment's entire
query set, with no limit and no delay.
**Fix.** Bound the attempts and say so when they are exhausted, as in the example above. An error
UI with no button at all is better than one that keeps a struggling system down.

### `.catch(() => null)` with no reporting
**Symptom.** A feature has been silently missing in production for weeks and no alert ever fired.
**Cause.** A deliberate degradation swallowed the error without recording it.
**Fix.** Degrade *and* report — the two are independent decisions and both are required.

```tsx
export async function Recommendations({ productId }: { productId: string }) {
  const items = await getRecommendations(productId).catch((cause) => {
    reportError(cause, { surface: 'recommendations', productId }) // still an incident
    return null // still degrades gracefully
  })

  if (!items?.length) return null
  return <Carousel items={items} />
}
```

### Every failure treated as fatal because nobody chose a rung
**Symptom.** A product page will not render because a reviews service is down.
**Cause.** The reviews component threw, the nearest boundary was the page's, and no one ever
decided what reviews being unavailable should cost.
**Fix.** Pick the rung deliberately per dependency, and place the boundary to match. Reviews are
rung 2 or 3; the product itself is rung 4.

### A retry that discards what the user typed
**Symptom.** A form inside the failing segment is cleared by the recovery.
**Cause.** `retry()` re-renders the segment, and uncontrolled inputs inside it are remounted.
**Fix.** Do not put a form inside a boundary whose recovery is a segment-level re-render. Handle
the form's own failures as returned values — [01b](01b-expected-errors-are-return-values.md) —
so the boundary is never involved in the first place.

### An error UI with no way to identify the failure
**Symptom.** A user reports "it says something went wrong" and support has nothing to search for.
**Cause.** The boundary rendered a generic message and did not surface the `digest`.
**Fix.** Show it. In production a Server Component's error message is replaced by a generic one,
and `digest` is the only thing tying what the user saw to what the server logged.

### A "fallback" that is slower than the thing it replaces
**Symptom.** The degraded path calls a second service that is slower than the primary, so a
partial failure is worse than a total one.
**Cause.** The fallback was chosen for completeness rather than for cost.
**Fix.** A fallback must be cheaper and more reliable than what it replaces, or it is not a
fallback. Cached data, a static default, or omission — in that order.

## Interview questions

**★ What retry policy does Next.js implement for `retry()`?**
None. It re-fetches and re-renders the segment when called, and nothing more — no attempt limit,
no backoff, no timeout, and no way for the boundary to know whether the failure was transient.
Any policy is application code.

**★ A user presses "Try again" and the same error returns instantly with no network request.
What happened?**
The boundary called `reset()`, which re-renders without re-fetching. For a data failure that
guarantees the same result. `retry()` is the one that re-fetches, and it has been the
recommended default since it stabilised in 16.3.

**★ Why is an unbounded retry button a production hazard?**
Because `retry()` re-runs the segment's entire data fetching, not just the call that failed, and
every user looking at the broken page has the same button. During an incident that is
self-inflicted load on the dependency that is already struggling — and because actions and
navigations are serialised per client, the user's own experience gets worse with each press too.

**★ What is a degradation ladder and why does it matter more than the retry mechanics?**
It is the decision about what a failing dependency should cost the user: omitted silently,
replaced with something reduced, replaced with an explanation, or fatal to the page. It matters
more because it is the decision that is usually never made — a throw with no chosen alternative
lands everything on "fatal" by default, so a reviews outage takes down a product page.

**★ When you deliberately swallow an error to degrade gracefully, what must you still do?**
Report it. Degrading and reporting are independent choices, and a `.catch(() => null)` without
logging converts an outage into a feature that has silently not worked for weeks. The visible
symptom is gone; the incident is not.

**★ Why should a form not live inside a segment whose boundary recovers by re-rendering?**
Because the recovery remounts the subtree and takes the user's unsent input with it. Form
failures belong in the returned-value path — surfaced through `useActionState` — so the boundary
is never the mechanism, and the form keeps its state.

**★ What should an error UI show so support can act on it?**
The `digest`. In production a Server Component's error message is replaced by a generic string
before it reaches the client, so the digest is the only value that connects what the user can
read to the entry in the server log.

**★ How do you decide whether a fallback is worth having?**
It has to be cheaper and more reliable than the thing it replaces. A fallback that calls another
live service adds a second way to fail and often a slower path; cached data, a static default, or
simply omitting the feature are the options that actually hold up when the primary is down.

---

← [05c · Skeletons and layout shift](05c-skeletons-layout-shift-and-the-cost-of-a-boundary.md) · **Next → [06b · Timeouts, backoff and the retries you own](06b-timeouts-backoff-and-the-retries-you-own.md)**
