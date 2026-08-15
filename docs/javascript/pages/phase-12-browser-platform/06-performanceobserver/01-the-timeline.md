---
title: "01 · The performance timeline"
sidebar_label: "01 · The timeline"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [`PerformanceObserver.observe()`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe), [`PerformanceEntry`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEntry), [`Performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`Performance.timeOrigin`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/timeOrigin), [Performance Timeline API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_Timeline), [Resource Timing API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Resource_timing). Documentation-validated; **no timings and no console output**.

The browser records what it did — every request, every paint milestone, every long task — onto
one **performance timeline**, as a list of entries. `PerformanceObserver` is how you read that
list as it grows, instead of polling it.

## The clock

```js
performance.timeOrigin;   // absolute time (ms since the epoch) the page's clock started
performance.now();        // ms since that origin, as a DOMHighResTimeStamp
```

🔴 **`performance.now()` is monotonic; `Date.now()` is not.** The system clock can jump —
NTP correction, a user changing the time zone, daylight saving — and a duration measured with
`Date.now()` can come out negative. Every timestamp on the performance timeline is on the
`performance.now()` clock, and so are the timestamps handed to `requestAnimationFrame` and to
observer entries, which is what lets you compare them.

⚠️ **The resolution is deliberately coarse.** Browsers round `performance.now()` to blunt
timing side-channel attacks; how coarse depends on the browser and on whether the page is
cross-origin isolated. Treat it as good for milliseconds, not for microbenchmarks — and
remember that measuring a single run of anything in a browser measures the machine's mood as
much as the code.

## The entry

Every item on the timeline is a `PerformanceEntry` with four properties in common, plus
whatever its type adds:

| Property | Meaning |
|---|---|
| `name` | what it is — a URL, a mark name, `'first-contentful-paint'` |
| `entryType` | the family: `'resource'`, `'mark'`, `'measure'`, `'longtask'`, … |
| `startTime` | when it began, on the `performance.now()` clock |
| `duration` | how long it lasted, or 0 for instants |

The types worth knowing:

| `entryType` | What it records |
|---|---|
| `navigation` | one entry: the whole document load, redirect → DOM → load |
| `resource` | every subresource fetch, with DNS, TLS, TTFB and transfer size |
| `paint` | `first-paint` and `first-contentful-paint` |
| `largest-contentful-paint` | LCP candidates ([03](./03-the-metrics.md)) |
| `layout-shift` | each unexpected shift and its score |
| `event` / `first-input` | interaction latency, the input to INP |
| `longtask` | any task over 50 ms |
| `long-animation-frame` | a slow frame, **with script attribution** |
| `mark` / `measure` | your own instrumentation ([02](./02-marks-and-measures.md)) |

**What exists varies by browser**, and the honest check is the static list:

```js
PerformanceObserver.supportedEntryTypes.includes('long-animation-frame');
```

## Observing, and the `buffered` flag that matters more than it looks

```js
const po = new PerformanceObserver((list, observer) => {
  for (const entry of list.getEntries()) report(entry);
});

po.observe({ type: 'largest-contentful-paint', buffered: true });
```

| Form | Behaviour |
|---|---|
| `observe({ type: 'x', buffered: true })` | one type, **plus entries recorded before this line ran** |
| `observe({ entryTypes: ['x', 'y'] })` | several types, **no history** |

🔴 **`buffered: true` only works with `type`, and it is the difference between working code and
code that silently misses everything.** Analytics loads late; first paint, the first LCP
candidate and early resources have all been recorded by then. Without `buffered`, you observe an
empty future.

⚠️ **`type` and `entryTypes` cannot be combined in one call** — passing both throws. Call
`observe()` once per type when you need `buffered` for each, on the same observer; each call
adds to what that observer watches rather than replacing it.

**An unknown type is not an error.** If none of the requested types is supported the call is
ignored (browsers warn in the console), so wrap it defensively rather than assuming:

```js
try { po.observe({ type: 'layout-shift', buffered: true }); } catch { /* unsupported */ }
```

### The rest of the interface

```js
po.takeRecords();   // pending entries, synchronously, and clears them
po.disconnect();    // stop; also drops anything not yet delivered
```

`takeRecords()` is what you call on the way out — in a `visibilitychange` handler — so a metric
recorded in the last moments still gets reported ([03](./03-the-metrics.md)).

The callback's first argument is a `PerformanceObserverEntryList`, with `getEntries()`,
`getEntriesByType(type)` and `getEntriesByName(name)`. It holds **only this batch**, not the
whole timeline.

## The polling alternative, and why the observer wins

```js
performance.getEntriesByType('resource');   // a snapshot, right now
```

Three problems with the snapshot approach, all of which the observer solves:

- **You have to guess when to look.** Entries arrive whenever the browser records them.
- **The buffer is bounded.** The resource-timing buffer holds a limited number of entries — 250
  by default in the specification — and silently stops recording once full. You can raise it
  with `performance.setResourceTimingBufferSize(n)` or listen for
  `resourcetimingbufferfull`, but an observer never overflows: it hands you each entry as it
  happens.
- **`getEntries()` builds an array of everything each time**, which is the expensive way to ask
  a cheap question on a busy page.

**Clearing is still occasionally useful**: `performance.clearResourceTimings()` empties the
resource buffer for a long-lived single-page application that would otherwise accumulate every
request it ever made.

## Cross-origin resources tell you almost nothing

A `resource` entry for a script or image from another origin has most of its timing fields
**zeroed** — DNS, TLS, request and response start all read 0 — and `transferSize`,
`encodedBodySize` and `decodedBodySize` are 0 too.

🔴 **The unlock is a response header on the *other* origin:** `Timing-Allow-Origin`. Without it,
you can see that the request happened and how long the whole thing took, and nothing else. This
is the same-origin policy applied to timing, and it is why third-party CDN performance is hard
to attribute from the client ([Phase 11 · 05 · CORS, client-side](../../phase-11-network-storage/05-cors-client-side/README.md)).

## Where this fits with DevTools

The Performance panel shows you the same events, drawn, for one session on one machine. The
observer collects them from **real users on real devices**, which is the only population whose
performance matters. Use the panel to diagnose, the observer to know whether the problem exists
([01 · DevTools beyond `console.log`](../01-devtools/02-the-panels.md)).

## Gotchas

**Symptom: the observer never fires for paint or LCP.**
Cause — the entries were recorded before the script ran, and `buffered` was not set.
Fix — `observe({ type: 'paint', buffered: true })`; `entryTypes` cannot do this.

**Symptom: `observe()` throws.**
Cause — `type` and `entryTypes` were both passed.
Fix — one or the other; call `observe()` once per type when each needs `buffered`.

**Symptom: nothing happens and there is no error.**
Cause — the entry type is unsupported in this browser.
Fix — check `PerformanceObserver.supportedEntryTypes` and degrade.

**Symptom: resource entries stop appearing partway through a long session.**
Cause — the resource-timing buffer filled up.
Fix — an observer instead of polling; or raise the size and clear it periodically.

**Symptom: every timing field on a third-party script is 0.**
Cause — no `Timing-Allow-Origin` header from that origin.
Fix — ask for the header; otherwise only `startTime` and `duration` are meaningful.

**Symptom: a duration comes out negative.**
Cause — it was measured with `Date.now()` and the system clock moved.
Fix — `performance.now()`, which is monotonic.

## Interview questions

**★ What is `PerformanceObserver` for, and why not just call `performance.getEntriesByType()`?**
It delivers timeline entries as the browser records them. Polling means guessing when to look,
rebuilding an array of everything each time, and losing entries once a bounded buffer fills.

**★ What does `buffered: true` do, and when is it essential?**
It replays entries recorded before the observer existed. Essential for anything that happens
early — paint, the first LCP candidate, initial resources — because analytics code almost always
loads after them. It works only with the `type` form.

**★ Why is `performance.now()` preferred over `Date.now()` for durations?**
It is monotonic and measured from the page's own time origin, so a system-clock change cannot
make a duration negative or wrong. Its resolution is deliberately coarsened for security, which
is fine for millisecond-scale measurement.

**★ Why are a third-party script's timings all zero?**
Cross-origin resource timing is restricted; the detailed fields require the serving origin to
send `Timing-Allow-Origin`. Without it you get start time and total duration only.

**★ How do you know an entry type is available?**
`PerformanceObserver.supportedEntryTypes` — a static array. An unsupported type in `observe()`
is ignored rather than thrown, so a silent no-op is the failure mode to guard against.

**What does `takeRecords()` give you?**
The entries queued but not yet delivered, synchronously, clearing the queue. It is how you
flush metrics when the page is being hidden.

---

[Topic index](./README.md) · [02 · Marks and measures](./02-marks-and-measures.md) →
