---
title: "02 · Marks and measures"
sidebar_label: "02 · Marks and measures"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Performance.mark()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/mark), [`Performance.measure()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure), [`PerformanceMark`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark), [`PerformanceMeasure`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMeasure), [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/User_timing), [`Server-Timing`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing). Documentation-validated; **no timings and no console output**.

The browser's own entries tell you how the *platform* did. Marks and measures are how you put
**your** milestones on the same timeline, on the same clock, visible to the same observer and to
the DevTools Performance panel.

## The two calls

```js
performance.mark('cart:open');                 // an instant
// …work…
performance.mark('cart:rendered');
performance.measure('cart:render', 'cart:open', 'cart:rendered');   // a duration
```

`mark()` records a point. `measure(name, start, end)` records the span between two marks and
computes `duration` for you. Both land on the timeline as ordinary entries — `entryType` of
`'mark'` and `'measure'` — with the `startTime` and `duration` fields everything else uses.

**Both return the entry object**, so you can read the number immediately instead of searching
the timeline:

```js
const m = performance.measure('cart:render', 'cart:open', 'cart:rendered');
m.duration;   // milliseconds
```

## The options form is the one worth learning

```js
performance.mark('checkout:start', {
  detail: { cartSize: items.length, currency },     // structured-cloneable
  startTime: someEarlierTimestamp,                  // backdate to a known moment
});

performance.measure('checkout:total', {
  start: 'checkout:start',
  end: performance.now(),        // a mark name OR a raw timestamp
  detail: { outcome: 'paid' },
});
```

| Option | What it buys |
|---|---|
| `detail` | arbitrary structured-cloneable context, carried on the entry |
| `startTime` | backdating a mark to a moment you captured earlier |
| `start` / `end` / `duration` on `measure` | any **two** of the three; the third is derived |

🔴 **`detail` is what turns a number into a diagnosis.** A `checkout:total` of 4 seconds says
nothing; the same entry with `{ items: 47, coupon: true, retries: 2 }` says where to look.

⚠️ **`measure()` throws a `SyntaxError` if a named mark does not exist.** In a flow that can be
abandoned — the user navigates away mid-checkout — that throw lands in the middle of business
logic. Wrap instrumentation, always:

```js
const track = (name, start, end) => {
  try { performance.measure(name, start, end); } catch { /* mark missing — not an error */ }
};
```

## Reading them back

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    send({ name: entry.name, ms: Math.round(entry.duration), ...entry.detail });
  }
}).observe({ entryTypes: ['measure'] });
```

An observer means the reporting code never has to know which measures exist — anything the app
records is picked up. The alternative, `performance.getEntriesByType('measure')`, is a snapshot
and fine for a one-off read.

**They also appear in DevTools.** Chromium's Performance panel draws marks and measures in its
timings track, so the same instrumentation you ship for analytics annotates a local profile
([01 · DevTools · The panels](../01-devtools/02-the-panels.md)) — which is the main reason to
prefer them over ad-hoc `console.time`.

| | `console.time()` | `mark` / `measure` |
|---|---|---|
| Output | a console line | a timeline entry |
| Readable by script | no | yes — observable, reportable |
| Shown in the Performance panel | no | yes |
| Carries structured context | no | `detail` |
| Nestable / overlapping | awkward | freely, they are just names |

## Housekeeping: they accumulate

Every mark and measure stays on the timeline for the life of the document. In a single-page app
that instruments each route transition, that is an unbounded list.

```js
performance.clearMarks('cart:open');    // one name
performance.clearMeasures();            // all measures
```

🔴 **Clear inside the observer**, once the entry has been reported — the entry object you hold
stays valid after the timeline is cleared, so nothing is lost.

⚠️ **Names are not unique.** Marking `'route:start'` twice leaves two entries, and
`measure(name, 'route:start', …)` uses **the most recent** one. For concurrent flows, put an id
in the name (`route:start:${navigationId}`) and clear it when the flow ends — otherwise two
overlapping navigations measure each other.

## What to instrument

Measure the things a user would describe, not the things a profiler already shows:

| Measure | Why |
|---|---|
| Route transition — click to content painted | the SPA equivalent of page load, and nothing else reports it |
| Hydration or first interactive | the gap between "looks ready" and "responds" |
| An expensive computation before/after a change | the only honest before-and-after |
| Client-side search or filter over a big list | where a list becomes unusable |
| API call, client-perceived (queue + network + parse) | wider than the server's own number |

**Pair the last one with `Server-Timing`.** A server that sends
`Server-Timing: db;dur=42, render;dur=13` puts those segments on the `navigation` and `resource`
entries as `serverTiming`, so one entry carries both halves of the request and you can tell a
slow server from a slow network.

## Two traps around `await`

**A measure across an `await` includes everything the thread did in between** — other tasks,
rendering, unrelated handlers. That is the honest user-facing number, and it is usually what you
want; just do not present it as "how long my function takes".

**A mark set in a loop of promises collides with itself.** Concurrency needs identity:

```js
for (const id of ids) {
  performance.mark(`load:${id}:start`);
  load(id).finally(() => {
    track(`load:${id}`, `load:${id}:start`);
    performance.clearMarks(`load:${id}:start`);
  });
}
```

## Gotchas

**Symptom: `measure()` throws in production, inside business logic.**
Cause — the start mark was never set, because the flow was abandoned or short-circuited.
Fix — wrap every instrumentation call; a missing mark is not an application error.

**Symptom: durations are wildly too long in an SPA.**
Cause — a duplicate mark name; `measure` used the most recent start, which belonged to another
flow.
Fix — put a flow id in the name, and clear marks when the flow completes.

**Symptom: memory grows in a long session.**
Cause — marks and measures accumulate for the life of the document.
Fix — `clearMarks`/`clearMeasures` after reporting.

**Symptom: `detail` arrives empty at the analytics endpoint.**
Cause — it was not read off the entry, or it held something not structured-cloneable.
Fix — read `entry.detail` in the observer; keep it to plain data.

**Symptom: the measured API time disagrees with the server's own logs.**
Cause — the client number includes queueing, connection setup, download and parsing.
Fix — both are correct; use `Server-Timing` on the entry to separate them.

**Symptom: the marks do not appear in the Performance panel.**
Cause — the recording started after they were made.
Fix — record from load, or replay with a `buffered` observer; the timeline still has them.

## Interview questions

**★ Why use `performance.mark`/`measure` instead of `console.time`?**
Because they produce timeline entries rather than console lines: a `PerformanceObserver` can
report them to analytics, DevTools draws them alongside the browser's own events, they carry
structured `detail`, and they nest and overlap freely.

**★ What is `detail` for?**
Context that makes the number actionable — cart size, route name, retry count, outcome. It is
structured-cloneable data carried on the entry, so it reaches the reporter with the measurement.

**★ What is the risk of instrumenting with `measure()` directly in application code?**
It throws if a named mark is missing, which happens whenever a flow is abandoned. Instrumentation
must never be able to break the feature it measures — wrap it.

**★ How do you measure an SPA route transition?**
Mark on the click, mark when the new view's content has painted (a frame callback after render),
and measure between them with the route in the name. There is no built-in metric for it, which
is exactly why User Timing exists.

**★ Your client-side API measurement is larger than the server's. Which is wrong?**
Neither. The client number includes queueing, DNS/TLS, transfer and parsing. Read `Server-Timing`
off the resource entry to attribute the difference.

**Why clear marks?**
They live for the life of the document. In a long-lived SPA that instruments every transition,
never clearing is an unbounded list — and duplicate names quietly corrupt later measures.

---

← [01 · The timeline](./01-the-timeline.md) · [03 · The metrics that matter](./03-the-metrics.md) →
