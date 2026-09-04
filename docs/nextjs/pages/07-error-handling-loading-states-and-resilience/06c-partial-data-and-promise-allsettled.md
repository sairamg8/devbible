---
title: "`Promise.all` makes a dashboard all-or-nothing, and the fix — `allSettled` — is also the most effective way to make a broken feature invisible"
sidebar_label: "06c · Partial data with `allSettled`"
sidebar_position: 20
description: "Rendering what succeeded when one of several independent reads fails, the reporting obligation that comes with a promise that never rejects, and when partial data is dishonest rather than resilient."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against MDN —
> [`Promise.allSettled()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
> and [`Promise.all()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
> — and the Next.js [Streaming guide](https://nextjs.org/docs/app/guides/streaming)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-08-25`) for the independent-boundary
> behaviour this composes with. 🔴 **Next.js documents no partial-data pattern**; the shape below
> is **this book's recommendation** using standard JavaScript.
> Target: **Next.js 16.3.4**, App Router · **Node 24.20.0**. Documentation-validated;
> **no timings**.

**`Promise.all` encodes a claim you probably did not mean to make: that every one of these reads
is required.** It rejects the moment any input rejects, so a recommendations service being
unavailable takes down the revenue chart beside it. Where the reads are genuinely independent —
which is what a dashboard is — the honest primitive is `allSettled`, which resolves with a result
per input and lets the page render what it has. The catch is in the same sentence: it *always*
resolves. Nothing rejects, so nothing reaches a boundary, nothing is reported, and a panel can
read "unavailable" for a fortnight without a single alert. Using it correctly means accepting a
reporting obligation that `all` used to discharge for you.


## Partial data beats no data

When a view needs several independent things, `Promise.all` makes it all-or-nothing.
`Promise.allSettled` lets the page render what succeeded:

```tsx
// app/dashboard/page.tsx
export default async function Dashboard() {
  const [revenue, orders, recommendations] = await Promise.allSettled([
    retryRead(() => getRevenue()),
    retryRead(() => getRecentOrders()),
    getRecommendations(), // optional: not worth retrying
  ])

  return (
    <div>
      <h1>Dashboard</h1>

      {revenue.status === 'fulfilled' ? (
        <RevenueChart data={revenue.value} />
      ) : (
        <Unavailable label="Revenue" retryHref="/dashboard" />
      )}

      {orders.status === 'fulfilled' ? (
        <OrdersTable data={orders.value} />
      ) : (
        <Unavailable label="Recent orders" retryHref="/dashboard" />
      )}

      {recommendations.status === 'fulfilled' && (
        <Carousel items={recommendations.value} />
      )}
    </div>
  )
}
```

🔴 **`allSettled` never rejects, so nothing reaches a boundary and nothing is reported unless you
report it.** Every `rejected` branch needs a logging call; otherwise this pattern is a very
effective way to make failures invisible.

## Gotchas

### `Promise.all` for a dashboard
**Symptom.** One optional widget's failure blanks a page of otherwise healthy panels.
**Cause.** `Promise.all` rejects as soon as any input rejects.
**Fix.** `Promise.allSettled`, with an explicit branch per result — and reporting on every
rejected one.

### `allSettled` used as an error suppressor
**Symptom.** A panel has read "Revenue unavailable" for two days and no alert exists.
**Cause.** `allSettled` never rejects, so nothing propagated and nothing was logged.
**Fix.** Report each rejection where you branch on it.

```tsx
if (revenue.status === 'rejected') {
  reportError(revenue.reason, { surface: 'dashboard.revenue' })
}
```

### A partial render that looks complete
**Symptom.** A revenue total is 40% lower than it should be, and nobody notices because the page
rendered normally.
**Cause.** One of several reads that *contribute to a single number* failed, and the page summed
what it had.
**Fix.** `allSettled` is right for independent panels and wrong for a computed aggregate. If the
pieces combine into one value, a missing piece makes the value wrong, and wrong is worse than
absent.

```tsx
const parts = await Promise.allSettled([getEuRevenue(), getUsRevenue(), getApacRevenue()])

// ❌ silently under-reports when a region fails
const total = parts.filter(p => p.status === 'fulfilled').reduce((n, p) => n + p.value, 0)

// ✅ an aggregate is all-or-nothing by nature
if (parts.some(p => p.status === 'rejected')) {
  return <Unavailable label="Revenue" />
}
```

### Every panel given its own retry link back to the same page
**Symptom.** Three panels fail, the user presses three "retry" links, and each one reloads the
whole route — re-issuing every read, including the ones that worked.
**Cause.** A per-panel affordance wired to a page-level action.
**Fix.** Either make the affordance honest ("Reload the page") or move the boundary into the
panel so its recovery is scoped to it — the component-level `catchError` boundary in
[10](10-custom-error-boundaries-with-catcherror.md) is the mechanism.
## Interview questions

**★ When is `Promise.allSettled` the wrong choice?**
When the data is not genuinely optional. It renders "what worked", which is right for a dashboard
of independent panels and wrong for a checkout that needs price, stock and address to all be
correct. If a missing piece makes the page misleading rather than reduced, failing is the honest
outcome.

**★ What does `allSettled` cost you that `all` does not?**
Propagation. Nothing rejects, so no boundary fires and no reporting happens implicitly; every
rejected branch has to log deliberately. It converts loud failures into quiet ones, which is the
intent — and is also how a feature can be broken for days with a perfectly green dashboard.

**★ Why does `allSettled` compose well with Suspense boundaries?**
Because both express the same idea at different layers: independent things fail independently.
Boundaries give you independent *streaming* and independent recovery UI; `allSettled` gives you
independent *data*. Used together, one slow-and-then-failing read affects exactly one panel — it
does not delay its siblings, because they are in their own boundaries, and it does not reject
theirs, because they are separate settled results.

**★ A reviewer says `allSettled` is "just swallowing errors". Are they right?**
Half right, and the distinction matters. It suppresses *propagation*, which is the intended
effect; it does not require suppressing *observation*, which would be the defect. The pattern is
only correct when each rejected branch reports. Written without that, the criticism is exactly
right and the page has traded a visible failure for an invisible one.

**★ How do you decide per read whether it deserves a retry before it reaches `allSettled`?**
By what its failure costs. A read whose absence is fatal to the page is worth a bounded retry
with backoff; a read whose absence is a missing carousel is not worth adding latency and load
for. Wrapping only the important reads keeps the total time bounded by the things that matter,
rather than by the least important dependency.
---

← [06b · Timeouts, backoff and your own retries](06b-timeouts-backoff-and-the-retries-you-own.md) · **Next → [07 · SprintDesk gets full error-boundary coverage](07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md)**
