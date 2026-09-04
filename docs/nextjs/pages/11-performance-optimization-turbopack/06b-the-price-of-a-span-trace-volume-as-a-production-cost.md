---
title: "A span is a unit of cost as well as a unit of information — Next.js already traces more than it emits, the switch that reveals the rest is a volume multiplier on a per-event bill, and the one span nobody looks at is the cheapest time-to-first-byte probe you will ever get"
sidebar_label: "06b · The price of a span"
sidebar_position: 130
description: "Trace volume as a production cost: NEXT_OTEL_VERBOSE as a multiplier, the per-fetch span and NEXT_OTEL_FETCH_DISABLED, the arithmetic of spans per request, and using the framework's own spans — especially the zero-length start response span — as this chapter's measuring instrument."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to set up instrumentation with OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) (`version: 16.3.4`, `lastUpdated: 2026-08-25`) and [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (`2026-06-09`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run** — every span name and environment variable below is quoted from the reference; no trace, waterfall or span count was observed to write this page.

**Once instrumentation is installed, its cost stops being a startup cost and becomes a per-request one, and the documentation gives you the two levers in a single sentence each. Next.js *"traces more spans than are emitted by default"*, and the switch that reveals them is `NEXT_OTEL_VERBOSE=1` — which is a multiplier applied to every request you serve, on backends that bill per event. Meanwhile the `fetch` span, one per outbound request your server code makes, is the largest single contributor on any fan-out route, and it has a documented off switch. Those decisions are the price side. The return side is that a handful of the spans Next.js emits for free answer questions the rest of this chapter asks: `start response` is a first-byte marker, the arrangement of `fetch` spans is a waterfall diagram, and `resolve segment modules` is what module-loading cost looks like from the server. The catalogue itself belongs to [ch16 · 04b](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md); this page is what to do with it when the job is performance.**

## Three different things called "the cost of tracing"

They fail differently and are fixed in different places, so keep them apart:

| Cost | Where it lands | What controls it |
|---|---|---|
| **Span creation** | In-process, inside the request | How many spans exist — the two environment variables below, plus your own custom spans |
| **Export** | Also inside the request, if you export synchronously | The span processor. A batching processor moves it off the request path; the documented `SimpleSpanProcessor` does not |
| **Ingest** | Your observability bill, monthly | Span count × request volume, then sampling |

The middle one is the one that turns tracing into a latency regression rather than a line item, and it is covered in [ch16 · 04b](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md) — `SimpleSpanProcessor` *"exports each span as it ends"*, which puts your collector's availability inside your request path. This page is about the first and third.

## Verbose is a multiplier, not a detail level

> *"Next.js traces more spans than are emitted by default. To see more spans, you must set `NEXT_OTEL_VERBOSE=1`."*

Two things follow, and the second is usually missed.

**The default is a curated subset.** What you see out of the box is not "all the instrumentation Next.js has"; it is the part the framework judged worth emitting always. So a trace that looks sparse is not evidence that nothing happened between two spans — it is evidence that you have not turned the rest on.

**Verbose applies to every request, not to the ones you are debugging.** It is an environment variable, so it is a property of the deployment. There is no documented per-request or per-route form of it. That means turning it on to investigate one slow route multiplies the span count of every route, including the health check that runs every ten seconds and the prefetches the router issues on hover.

The operational shape that follows is a **bounded verbose window**:

1. Turn `NEXT_OTEL_VERBOSE=1` on in a preview or staging deployment first, and reproduce there if you can.
2. If it must be production, turn it on, capture the traces you need, turn it off. Treat it like a debugger attached to a live process — because that is what it is.
3. Never leave it on "so the data is there if we need it". The data you need later is a sampled subset at normal verbosity; the data you need now is a full trace for ten minutes.

## The `fetch` span is the one that scales with your data layer

> *"This span can be turned off by setting `NEXT_OTEL_FETCH_DISABLED=1` in your environment. This is useful when you want to use a custom fetch instrumentation library."*

The span in question is `fetch [http.method] [http.url]`, emitted for *"the fetch request executed in your code"*. Its cost profile is different from every other default span because it is the only one whose count is a function of your application's shape rather than the framework's: a route that renders one card fragment emits one; a board page that fans out per column emits one per column; a page that resolves a list and then a detail per item emits one per item.

That gives you a straightforward reason to reach for the switch, and one bad reason:

- ✅ **Good reason:** you already run a fetch instrumentation library — the documented case — and every outbound call is being recorded twice, once by Next.js and once by yours.
- ✅ **Good reason:** your data layer does not go through `fetch` at all (a database driver, an ORM over a TCP connection), so the Next.js fetch span only covers a minority of your I/O and you would rather instrument the driver.
- 🔴 **Bad reason:** to reduce the bill. The fetch span is the span that tells you *why* a route is slow. Removing it makes the trace cheaper and the chapter's actual work — finding waterfalls — impossible. Sample fewer traces instead of blinding every trace.

If you do disable it, replace it. A route whose slowness is entirely in outbound I/O and which emits no I/O spans produces a trace with one long root span and nothing inside it, which is the single least useful artefact an observability stack can generate.

## The arithmetic, without inventing numbers

There is no published span count per request, and it depends on your routes, so do not carry one around. Do the arithmetic on your own application instead — the structure is fixed even though the numbers are yours:

```text
spans per request ≈
    root request span                        (1)
  + render span for the route                (1)
  + one per outbound fetch                   (N, your fan-out)
  + one per generateMetadata call            (M — "a single route can have
                                              multiple of these spans")
  + segment/component resolution spans       (framework, more with verbose)
  + your own custom spans                    (yours)
```

Multiply by requests per month, and remember that requests include RSC prefetches — the `next.rsc` attribute exists precisely because those are a separate population. On a router-prefetching app, prefetch traffic can be a large fraction of total requests, and each prefetch is a full trace. That is the number people are surprised by, and it is knowable before you enable anything: count the prefetchable links on your busiest page.

## The spans are this chapter's measuring instrument

This is the part that pays for the rest of the page. The framework's own spans answer questions the other chunks in chapter 11 ask, and they answer them in production rather than on your laptop.

### `start response` is a time-to-first-byte probe

> *"`start response` … This zero-length span represents the time when the first byte has been sent in the response."*

A zero-length span is a timestamp with a parent. Its value is entirely in *where it sits inside the root request span*:

- **Early inside the root span, with rendering continuing after it** — the response is streaming. The shell went out, the suspended parts followed. That is what [11 · Native Node.js streams in SSR](11-native-nodejs-streams-in-ssr.md) and Partial Prerendering are supposed to produce.
- **At the very end of the root span** — nothing left the process until everything was ready. Either something is buffering in front of your server, or a `await` above your Suspense boundaries has serialised the whole render.

That single comparison distinguishes "our TTFB is bad" from "our TTFB is fine and something downstream is holding the bytes", which are two entirely different investigations. It costs nothing to look at, and it is emitted by default.

### The `fetch` spans are a waterfall diagram

Sibling `fetch` spans that begin at the same instant are parallel; sibling `fetch` spans arranged in a staircase are sequential, and a staircase inside a single render span is the classic `await`-in-a-loop or await-then-await shape. This is the production version of what `logging.fetches` shows you in development — see [06](06-instrumentationts-for-opentelemetry-and-application-monitori.md) — and unlike the development version it reflects real network conditions and real cache state.

### `resolve segment modules` is module cost, seen from the server

The span is documented as covering *"loading of code modules for a layout or a page"*, with a `next.segment` attribute. It is the server-side counterpart to the treemap in [03 · Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md): a segment whose module resolution is consistently slow is a segment importing more than it needs, and the attribute tells you which one. Note that this is one of the spans most likely to need verbose mode to appear.

### `generateMetadata` is a per-route cost you can attribute

*"A single route can have multiple of these spans"*, because metadata resolves per segment. If a route's metadata does its own data fetching, those spans show it, and they show it separately from the render — which is the difference between "the page is slow" and "the page's `<title>` is slow".

## What to actually do with all this

The decision sequence, in the order it survives contact with an invoice:

1. **Leave the defaults on.** They are the curated subset and they include `start response` and `fetch`.
2. **Add custom spans around your own expensive work** — the board query, the search, the PDF render — using `startActiveSpan` so they nest. Your spans are the ones that name your domain; the framework's name the framework.
3. **Sample at the exporter**, not by deleting span types. A 10% sample of complete traces is diagnostically useful; 100% of incomplete traces is not.
4. **Use verbose as a session**, and close the session.
5. **Only disable the fetch span** when something else is instrumenting fetch, and verify the replacement is actually producing spans before you rely on it.

## Gotchas

**★ Symptom: enabling tracing added measurable latency to every request.** Cause: the span processor exports synchronously — the documented manual setup uses `SimpleSpanProcessor`, which *"exports each span as it ends"* — so your collector is now inside the request path. Fix: use a batching processor in production; this is one of the main reasons to take the manual `NodeSDK` route rather than the default, and it is covered in [ch16 · 04b](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

**★ Symptom: the observability bill after the first full month is several times the estimate.** Cause: the estimate counted user page views; the traces counted requests, and RSC prefetches are requests. Fix: split on `next.rsc` in the backend to see the ratio, then sample prefetch traces far more aggressively than user-initiated ones — a prefetch has no user waiting, so a 1% sample is enough to spot a regression.

**★ Symptom: someone enabled `NEXT_OTEL_VERBOSE=1` during an incident and it was never turned off.** Cause: it is an environment variable, so it survives every deploy and has no expiry, and nothing in a healthy system complains about too much telemetry. Fix: make it a deploy-time value that a scheduled check asserts is unset in production, and record the reason for each window somewhere durable. There is no per-route or per-request form of this switch, so there is no way to scope it in code.

**★ Symptom: a route is slow in production and its trace is one long root span with nothing inside it.** Cause: either verbose is off and the interesting spans are among the ones not emitted by default, or the fetch span was disabled and never replaced. Fix: check `NEXT_OTEL_FETCH_DISABLED` first — a route with a fan-out data layer and zero fetch spans is the signature — then open a bounded verbose window.

**★ Symptom: TTFB looks terrible in the field and fine in your own trace waterfall.** Cause: you are reading the root span's duration, which covers the whole response, rather than the position of `start response` within it. Fix: chart `start response` relative to the root span's start. If it is early, your server's first byte is fast and the field metric is measuring something between your server and the user.

**Symptom: after enabling streaming, `start response` still sits at the end of the root span.** Cause: something between the process and the client is buffering the response, or an `await` above every Suspense boundary is preventing a shell from being flushed. Fix: this is the diagnostic that separates the two — if the span is early and users still see a late first byte, the problem is the proxy; if the span is late, the problem is in the render, and the boundary placement is the thing to change.

**Symptom: every outbound call shows up twice in the trace.** Cause: Next.js's own `fetch` span plus a fetch instrumentation library. Fix: `NEXT_OTEL_FETCH_DISABLED=1`, which is documented as existing for exactly this case — but keep whichever one carries the attributes your dashboards use, and change the dashboards in the same commit.

**Symptom: custom spans around the board query never appear, but the request span does.** Cause: the span was created without becoming the active context, or it was never ended — an un-ended span is never exported, so a throw silently deletes the very span you wanted. Fix: `startActiveSpan` with `span.end()` in a `finally`.

```ts
import { trace } from '@opentelemetry/api'

export async function loadBoard(teamId: string) {
  return trace
    .getTracer('sprintdesk')
    .startActiveSpan('loadBoard', async (span) => {
      try {
        span.setAttribute('sprintdesk.team_id', teamId)
        return await queryBoard(teamId)
      } finally {
        span.end()
      }
    })
}
```

**Symptom: layout timings average two unrelated files together.** Cause: grouping on `next.page`, which the docs say *"can be used as a unique identifier only when paired with `next.route`"*. Fix: group by both. Full attribute notes are in [ch16 · 04b](../16-deployment-scaling-and-observability/04b-opentelemetry-the-span-catalogue-and-trace-volume.md).

## Interview questions

**★ `NEXT_OTEL_VERBOSE=1` is described as showing more spans. Why is it a production decision rather than a debugging preference?**
Because it is an environment variable, which means it applies to every request the deployment serves for as long as it is set — there is no documented per-route or per-request scoping. The span count per request rises for the health check, for every RSC prefetch and for every static asset request handled by the server, not only for the route you are investigating. On backends billed per event, that is a multiplier on the largest number in the system. The correct usage pattern is a window: turn it on, capture, turn it off, and have something that asserts it is off.

**★ When would you set `NEXT_OTEL_FETCH_DISABLED=1`, and when would that be a mistake?**
The documented reason is that you are using a custom fetch instrumentation library, in which case Next.js's span duplicates yours. A second legitimate reason is that your I/O does not go through `fetch` at all — a database driver over TCP — so the span covers a minority of your work and you would rather instrument the driver. The mistake is doing it to reduce cost, because the fetch span is what makes a slow route diagnosable: it is where waterfalls become visible. Cutting it leaves you with a long root span and no explanation. Reduce cost by sampling whole traces, which preserves the shape of the ones you keep.

**★ What can the `start response` span tell you that the root span's duration cannot?**
The root span's duration is the whole request. `start response` is a zero-length span marking the moment the first byte was sent, so its *position inside* the root span is the answer to "did streaming happen". Early, with rendering continuing after it, means the shell was flushed and the client started work while the server was still producing — the behaviour Partial Prerendering and streamed SSR exist to give you. At the very end, it means nothing left the process until everything was finished, which is either a buffering proxy or a render that awaits above its Suspense boundaries. It converts an argument into a timestamp comparison.

**★ How do you estimate trace volume before enabling tracing?**
By counting the structure rather than guessing a number. Each request produces a root span, a render span, one span per outbound fetch, one per `generateMetadata` call — the docs note a single route can have several — plus segment resolution spans and any custom spans you add. Multiply by requests, and count RSC prefetches as requests, because they are. That last term is the one that surprises people: on a link-heavy page the router issues prefetches that no user is waiting for, each producing a full trace. You can count the prefetchable links on your busiest page today, without deploying anything.

**Why is sampling a better cost lever than turning off span types?**
Because they degrade differently. Sampling keeps complete traces for a fraction of requests: every trace you have is fully interpretable, and you lose only the guarantee that any *specific* request was captured. Disabling span types keeps every request and makes all of them partially blind, so the one trace you desperately need turns out to be missing the spans that would have explained it. Statistically, performance regressions show up in aggregates that a sample reproduces faithfully; they do not show up in traces with holes.

**Your traces are complete and useless — everything is nested under the root span but nothing is named after your application. What went wrong?**
Nothing went wrong; you have only the framework's spans. Next.js instruments itself, so the route, the render, the fetches and the first byte are covered, but your business operations are not — the expensive board query looks like whatever `fetch` calls it happens to make. The fix is custom spans in your own namespace, created with `startActiveSpan` so they nest under the request, with attributes named `yourapp.*` rather than `next.*` since the `next` namespace belongs to the framework. The framework's spans tell you which route; your spans tell you which operation.

**Where does the `logging` configuration fit into any of this?**
It does not — it is a development-mode terminal feature, by its own reference title, and it does not affect production builds. It is genuinely useful for the same investigation at development time: `logging.fetches.fullUrl` shows the same waterfall the `fetch` spans show, without a collector. But the moment the question is about production, the answer is spans. See [06](06-instrumentationts-for-opentelemetry-and-application-monitori.md).

**Does a `fetch` that is served from the cache still emit a `fetch` span?**
I could not confirm this from the documentation. The OpenTelemetry guide describes the span as covering *"the fetch request executed in your code"* and does not state how it interacts with the Data Cache, so treat the behaviour as unspecified rather than assuming either answer. The way to settle it for your own deployment is empirical and cheap — request a route with a known-cached fetch and look — and the reason it is worth settling is that it changes your volume estimate by however large your cache hit rate is. It also changes how you read a trace: if cached fetches do not emit spans, a fast route with no fetch spans is a *good* sign rather than a missing one.

---

← [06 · What instrumentation costs](06-instrumentationts-for-opentelemetry-and-application-monitori.md) · [Chapter 11 overview](01-explanation.md) · Next → [07 · Milestone: the SprintDesk performance audit](07-project-milestone-sprintdesk-performance-audit.md)
