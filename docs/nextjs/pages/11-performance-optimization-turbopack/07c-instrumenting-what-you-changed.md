---
title: "Act three exists because the first two acts moved costs rather than deleting them — the highlighter now runs on your server and the mutation now resolves after the paint, and tracing is the only thing that keeps either of those honest once the audit is over"
sidebar_label: "07c · Instrumenting what you changed"
sidebar_position: 132
description: "The last act of the SprintDesk audit: a minimal instrumentation.ts, the span-volume decision for an application whose data layer is not fetch, custom spans around the work the audit created, the report you hand over, and the regression gates that outlive it."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against [How to set up instrumentation with OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) (`version: 16.3.4`, `lastUpdated: 2026-08-25`), [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (`2026-06-09`) and [Package bundling and optimization](https://nextjs.org/docs/app/guides/package-bundling) (`2026-06-01`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run** — 🔴 **no trace, span count, latency figure or invoice appears on this page.**

**The uncomfortable truth about the first two acts is that neither one destroyed any work. Act one moved syntax highlighting from every visitor's device to your server, where it is now paid per request. Act two moved a database mutation out of the interaction path, where it was hurting INP, to somewhere the user is not watching — and therefore somewhere nobody is watching. Both are the right trade and both create a cost that is now invisible from the browser. Act three makes those costs visible, decides how much telemetry you are willing to pay for, and leaves behind gates that fail the next time someone undoes act one. An audit that ends without this act is a set of improvements with an expiry date.**

## The minimum that is worth having

Registration is one file, and its contents are governed by [06 · What instrumentation costs](06-instrumentationts-for-opentelemetry-and-application-monitori.md): construct, do not communicate, and gate the import so the module graph is only loaded where it runs.

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.OTEL_ENABLED !== '1') return
  await import('./instrumentation.node')
}
```

```ts
// instrumentation.node.ts
import { registerOTel } from '@vercel/otel'

registerOTel({ serviceName: 'sprintdesk' })
```

> *"Next.js supports OpenTelemetry instrumentation out of the box, which means that we already instrumented Next.js itself."*

That single call is enough for the root request span, the render span, `start response` and the fetch spans to start arriving. Everything below is about what you add and what you turn off.

The success check is stated in the guide precisely enough to use as an acceptance criterion:

> *"If everything works well you should be able to see the root server span labeled as `GET /requested/pathname`. All other spans from that particular trace will be nested under it."*

## The span-volume decision, for this application specifically

Generic advice does not survive contact with a real data layer, and SprintDesk's is the interesting case: **it is Drizzle over a Postgres connection, not `fetch`.** That single fact rearranges every default.

| Signal | Default behaviour | Decision for SprintDesk |
|---|---|---|
| Root request span | On | Keep. It is the trace. |
| Render span | On | Keep. |
| `fetch` span | On, one per outbound `fetch` | **Keep, but expect it to be sparse** — it covers the auth provider and any external API, not the database. Do not read a low count as "no I/O". |
| `NEXT_OTEL_VERBOSE` | Off | **Leave off.** Open a window when investigating; close it. |
| `NEXT_OTEL_FETCH_DISABLED` | Not set | **Leave unset.** The few fetch spans there are cover the calls you cannot see any other way. |
| Custom spans | None | **Add them around the database work**, because nothing else will. |

🔴 The trap this table exists to prevent: an application whose I/O does not go through `fetch` produces traces that look reassuringly cheap and explain nothing. The root span is long, the render span is long, and there is nothing inside either of them, because the framework instrumented `fetch` and you used a driver. The reflex — enabling verbose to "see more" — multiplies framework spans across every request and still does not show you the query. The fix is your own spans.

## Spans for the work the audit created

Three, and each one exists because of a decision made in an earlier act.

```ts
// lib/board.ts — the query act two stopped blocking on
import { trace } from '@opentelemetry/api'

export async function loadBoard(teamId: string) {
  return trace
    .getTracer('sprintdesk')
    .startActiveSpan('loadBoard', async (span) => {
      try {
        span.setAttribute('sprintdesk.team_id', teamId)
        const columns = await db.query.columns.findMany({
          where: eq(schema.columns.teamId, teamId),
          with: { cards: true },
        })
        span.setAttribute('sprintdesk.card_count', countCards(columns))
        return columns
      } finally {
        span.end()
      }
    })
}
```

`sprintdesk.card_count` is the attribute that pays for itself. Every candidate cause in [07b](07b-the-inp-problem-on-the-board.md) scales with card count, and putting the count on the span means a future latency investigation can ask "is this slow for big boards or slow for everyone?" without shipping new code to find out.

```ts
// app/(board)/actions.ts — the mutation act two moved off the paint path
'use server'
import { trace } from '@opentelemetry/api'

export async function moveCard(cardId: string, columnId: string) {
  return trace
    .getTracer('sprintdesk')
    .startActiveSpan('moveCard', async (span) => {
      try {
        span.setAttribute('sprintdesk.card_id', cardId)
        await db
          .update(schema.cards)
          .set({ columnId })
          .where(eq(schema.cards.id, cardId))
        revalidateTag(`board:${teamId}`)
      } finally {
        span.end()
      }
    })
}
```

This is the span that justifies act two. The optimistic update deliberately removed this latency from the user's experience *and* from INP; without a span, a regression here is silent until someone notices cards snapping back. With it, the mutation has its own latency series that nobody's optimistic UI can hide.

```ts
// lib/render-description.ts — the cost act one created
import { trace } from '@opentelemetry/api'
import { codeToHtml } from 'shiki'

export async function renderDescription(source: string) {
  return trace
    .getTracer('sprintdesk')
    .startActiveSpan('renderDescription', async (span) => {
      try {
        span.setAttribute('sprintdesk.source_length', source.length)
        return await codeToHtml(source, { lang: 'tsx', theme: 'github-light' })
      } finally {
        span.end()
      }
    })
}
```

Act one's trade was explicit — client bytes for server CPU — and this span is the receipt. If the card route's render time is now dominated by `renderDescription`, the answer is to cache the rendered HTML by content, not to move the library back to the browser.

Two conventions, both from the framework's side: use `startActiveSpan` so the span nests under the request rather than becoming a detached root, and namespace your attributes (`sprintdesk.*`) because `next.*` belongs to Next.js. The catalogue of what the framework already emits is [ch16 · 04b](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

## Reading the trace as the audit's final check

Three questions the trace answers that neither of the earlier acts could:

**Did streaming survive?** Find `start response` inside the root span for the board route. It is documented as a zero-length span marking *"the time when the first byte has been sent in the response"*, so if it sits early — with rendering continuing after it — the prerendered shell is still being flushed before the board resolves. If your changes accidentally introduced an `await` above the Suspense boundary, this is where it shows, and [06b](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md) explains how to read the two positions.

**Where did the render time go on the card route?** Compare `renderDescription` against the route's render span. That ratio is act one's cost, stated as a fraction rather than a feeling.

**Is the mutation fast enough that the optimistic update is honest?** An optimistic UI is a promise that the server will agree. The `moveCard` span is how you check the promise is being kept, and the reconciliation failures — the ones users describe as "the card jumped back" — correlate with its tail, not its median.

## The audit report

The deliverable is not a slide. It is a table anyone can re-run:

| Change | Artefact | Criterion | Still true? |
|---|---|---|---|
| Markdown/highlighting moved to the server | `./audit/01-markdown-to-server` | Package absent from the client treemap | Re-run the analyzer |
| Icon imports optimised | `./audit/02-icon-imports` | Only used icon modules present | Re-run the analyzer |
| Burndown chart split out | `./audit/03-chart-split` | Chart in its own chunk; fallback visible when throttled | Re-run the analyzer |
| Card subscriptions narrowed | commit + DevTools check | Non-adjacent cards do not re-render during a drag | DevTools highlight-updates |
| Mutation moved off the paint path | commit | Card moves before the action resolves, under throttling | Manual, one minute |
| Tracing added | `instrumentation.ts` | Root span `GET /board`, custom spans nested under it | The trace itself |

Every row names an artefact and a check. No row names a number, because no number here was measured — and a report full of unreproducible numbers is how the next team concludes the audit was theatre.

## Gates that outlive the audit

Three, in increasing cost to build:

**1 · A bundle artefact per build.** Produce the analysis in CI and keep it. This is also the fix for the vacuous size gate described in [07](07-project-milestone-sprintdesk-performance-audit.md) — 16.0 removed `size` and `First Load JS` from `next build` output, so anything parsing that output has been passing without checking.

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze "./artifacts/analyze-$COMMIT_SHA"
```

**2 · An INP series per route.** The collection from act two keeps running. The gate is not a threshold in CI; it is an alert on the board route's distribution moving, because INP is a field metric and CI has no field.

**3 · A span-based alert on `moveCard`.** The one signal a user-facing metric will never give you, because the optimistic update is designed to hide it.

## Milestone acceptance — all three acts

- [ ] A baseline bundle artefact exists, plus one per change, each named after its commit.
- [ ] The client treemap contains no library whose only job is turning data into static markup.
- [ ] Every lazily-loaded component is verified lazy **in the map**, not only in the source.
- [ ] `WebVitals` is its own client component; the root layout is still a Server Component.
- [ ] INP is collected from the field, tagged by route, for the board specifically.
- [ ] A drag re-renders only the cards whose own state changed.
- [ ] The drop paints before the Server Action resolves.
- [ ] `instrumentation.ts` registers without any network call on the readiness path.
- [ ] The trace for a board request shows a root span with custom spans nested under it.
- [ ] `start response` appears early inside the root span for the streamed route.
- [ ] `NEXT_OTEL_VERBOSE` is unset in production, and something asserts that.
- [ ] The report table exists and every row's criterion can be re-checked by someone else.

## Phase gate

You are done with this chapter when you can take an application you did not write, produce a bundle map, name the three largest client modules and the file that imported each, state which of them is a boundary problem and which is a barrel problem, collect one Core Web Vital from the field without turning the root layout into a Client Component, and add a span whose absence you would notice.

## Gotchas

**★ Symptom: the trace is one long root span with nothing inside it, on the slowest route you have.** Cause: the data layer is a database driver, not `fetch`, so the framework's fetch instrumentation has nothing to instrument. Fix: add your own spans around the queries. Enabling `NEXT_OTEL_VERBOSE=1` is the reflex and it is the wrong one — it multiplies framework spans on every request and still shows you no queries.

**★ Symptom: `moveCard` latency regressed for weeks and nobody noticed.** Cause: act two's optimistic update removed the mutation from the interaction the user perceives and from INP, which is what it was for. Fix: the span above, with an alert on its tail. Any latency you deliberately hide from the user must be surfaced somewhere else in the same change — that is the rule, not an extra.

**★ Symptom: the card route got slower after the audit "improved" it.** Cause: highlighting moved to the server and is now paid per request rather than per visitor. Fix: cache by content — the rendered HTML is a pure function of the source text — and use the `renderDescription` span to confirm the cache is being hit rather than assuming it.

**★ Symptom: custom spans appear as separate traces rather than nested under the request.** Cause: the span was created without becoming the active context. Fix: `startActiveSpan`, and end the span in a `finally` so a thrown error does not delete the span you needed most:

```ts
trace.getTracer('sprintdesk').startActiveSpan('loadBoard', async (span) => {
  try { return await queryBoard(teamId) } finally { span.end() }
})
```

**★ Symptom: the audit's improvements were undone within two releases.** Cause: nothing failed when they were undone. A treemap looked at once is a screenshot; a treemap produced per build is a gate. Fix: the three gates above, cheapest first — the CI artefact alone catches the most common regression, which is someone adding `'use client'` to a component that renders markup.

**Symptom: the analyzer artefact in CI is enormous and the pipeline slows down.** Cause: keeping every build's analysis forever. Fix: keep them on the default branch and on pull requests that change dependencies, with a short retention. The artefact is for comparing two points, not for archiving history.

**Symptom: `sprintdesk.card_count` on the span turns out to be the most useful thing in the whole trace.** Not a defect — the note is that domain attributes usually beat extra spans. A single attribute that explains the variance in a span's duration is worth more than five more spans, and it is cheaper on every axis: fewer events, less ingest, one line of code.

**Symptom: traces are missing from the dev environment and everyone assumes registration is broken.** Cause: the `OTEL_ENABLED` guard in `instrumentation.ts` above, which exists so dev-server restarts do not re-pay registration. Fix: document the variable next to the file. A deliberate opt-out that looks like a bug will be "fixed" by the next person, and then dev startup gets slower for everyone.

## Interview questions

**★ You improved INP by making a mutation optimistic. What did you just make invisible, and what do you owe in the same change?**
The mutation's latency and its failure rate. INP closes at the next paint, so once the optimistic state paints, the metric no longer measures the server at all — which is the intended effect and also a blind spot. What you owe is a span, or some equivalent server-side signal, around the action itself, with an alert on its tail rather than its median: users experience the tail as cards snapping back after appearing to move. The general principle is that any latency you deliberately hide from a user-facing metric must be surfaced in a system-facing one, in the same commit.

**★ Your application's traces show a long root span and almost nothing inside it. What is the most likely explanation, and what is the wrong response?**
The likely explanation is that your I/O does not go through `fetch` — a database driver, a message queue client, an SDK with its own transport — so the framework's fetch instrumentation has nothing to record. The wrong response is `NEXT_OTEL_VERBOSE=1`, because it multiplies the span count of every request across the whole deployment and still emits nothing about your queries. The right response is custom spans around your own operations, created with `startActiveSpan` so they nest, with attributes in your own namespace.

**★ Act one moved syntax highlighting from the client to the server. In what sense is that not a pure win, and how do you keep it honest?**
It converts a per-visitor download-and-execute cost into a per-request server CPU cost. For a page rendered once per visitor and served from a cache, that is a large win; for an uncached dynamic route rendered on every request, it can be a wash or worse, and it now competes with everything else on the server for the same CPU. You keep it honest by putting a span around the highlighting call and comparing it against the route's render span, and by caching the output — the rendered HTML is a pure function of the source, so it is the ideal thing to cache by content rather than by request.

**★ Why does the audit report contain no numbers?**
Because none were measured under conditions anyone could reproduce, and a number in a report is read as a measurement whatever the caveat says. Every row instead names an artefact and a criterion that can be re-checked: a package is present or absent from the client treemap, a chunk exists or does not, a card moves before the action resolves or does not. Those are binary, they survive a change of machine, and — the point of an audit — someone who was not there can verify them next quarter. Trends belong in the ongoing dashboards from the gates section, where the collection method is fixed and the comparison is like-for-like.

**★ What is the single cheapest regression gate you would add after this audit, and why that one?**
The bundle artefact per build. It costs one command in CI, it catches the most common regression by a wide margin — someone adds `'use client'` to a component that renders static markup, and a rendering library re-enters the client graph — and it produces a diffable artefact rather than a threshold anyone can argue with. It is also the gate that replaces something that silently stopped working: a CI step parsing `next build` for `First Load JS` has been finding nothing since 16.0 removed those fields, and a parser that finds nothing usually reports success.

**How would you decide whether a custom span or a span attribute is the right addition?**
Ask what varies. A span is right when you want to know how long a *phase* took and it can be slow independently of everything around it — a query, a render, an external call. An attribute is right when the phase is already spanned and what you actually need is the reason its duration varies: board size, payload length, cache hit or miss, tenant tier. Attributes are far cheaper — no extra events, no extra ingest — and in practice one well-chosen attribute on an existing span answers more questions than three more spans, because it turns a flat latency series into one you can segment.

**Someone proposes leaving `NEXT_OTEL_VERBOSE=1` on permanently "so the data is there when we need it". What is the argument against?**
That it is an environment variable with no per-route or per-request scoping, so it applies to every request the deployment serves — including health checks and RSC prefetches, which are the highest-volume and least interesting traffic you have. On a per-event-billed backend that is a multiplier on the largest number in the system, paid continuously to have data you will look at for an hour. The alternative gives you more, not less: sample complete traces at normal verbosity so every trace you keep is interpretable, and open a verbose window when you have a specific question.

**What is the difference between the acceptance criteria in this audit and a performance budget?**
A criterion is a statement about a specific change that is either true or false right now — the highlighting package is absent from the client graph, the chart is its own chunk, the drop paints before the action resolves. A budget is a threshold on a continuous quantity that must hold for all future changes. Criteria are what an audit produces, because they are verifiable by someone who was not there and cannot drift into an argument about noise. Budgets are what a *gate* produces, and they need something an audit does not: a stable measurement method, a baseline collected the same way, and agreement about what happens when the number is exceeded. Shipping criteria without gates means the improvements decay; shipping budgets without criteria means nobody can tell which change caused the number to move.

---

← [07b · The INP problem on the board](07b-the-inp-problem-on-the-board.md) · [Chapter 11 overview](01-explanation.md) · Next → [10 · Glob imports](10-glob-imports-with-import-meta-glob.md)
