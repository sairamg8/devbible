---
title: "Back-of-the-envelope estimation is four multiplications — QPS from users and actions, storage from size, rate and retention, bandwidth from payload and QPS, cache from the hot fraction — rounded to powers of ten, with the rounding said aloud"
sidebar_label: "03 · Estimation"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Arithmetic and method — the only sources are the conversions
> (86,400 seconds in a day; 1 KB, MB, GB, TB as powers of a thousand for estimation) and the
> latency ladder on [phase 0's page 05](../phase-0-the-interview/05-the-latency-ladder.md).
> Every figure below is an **assumption stated for the example**, not a measurement. Code is
> TypeScript targeting Node 24 (LTS), written to be runnable; **nothing was run**.

**Estimation in a design round is four multiplications, and the grade is on the arithmetic being
visible and the rounding being said, not on the digits.** Requests per second come from daily
users times actions per user, divided by the seconds in a day, times a peak factor. Storage comes
from record size times write rate times retention. Bandwidth comes from payload size times
requests per second, per hop. Cache size comes from the hot fraction of the working set — the
part that gets most of the reads — times record size. Each answer is rounded to a power of ten
and said with the rounding: "about ten a second on average, so I'll design for a hundred at the
peak." The numbers license the boxes that follow: a hundred requests a second does not need a
cache; a hundred thousand does. Over-precision is graded as badly as no numbers, because it
signals that the candidate does not know which digits matter.

## The four multiplications

| Quantity | Formula | The storefront, as an example |
|---|---|---|
| **Requests per second** | DAU × actions per user per day ÷ 86,400 × peak factor | 1M users × 10 page views ÷ ~10⁵ s ≈ 100/s average; × 10 at a sale ≈ 1,000/s |
| **Writes per second** | DAU × writes per user per day ÷ 86,400 × peak factor | 1M × 0.05 orders ÷ 10⁵ ≈ 0.5/s average; × 100 at a flash sale ≈ 50/s |
| **Storage** | record size × writes per day × retention (days) | 2 KB per order × 50,000 orders/day × 365 × 7 ≈ 2 KB × 1.3 × 10⁸ ≈ 250 GB over seven years |
| **Bandwidth** | payload × requests per second, per hop | 50 KB per product page × 1,000/s ≈ 50 MB/s at the edge; far less from the origin if the CDN hits |
| **Cache** | hot fraction × working set × record size | 20% of 100,000 products × 5 KB ≈ 100 MB — fits in one node's memory many times over |

Every line is a chain of factors, each said aloud, each an assumption the interviewer can
correct. The chain is the evidence; the product is almost incidental.

## The conversions to have cold

A short table, because the arithmetic has to be fast to be worth doing on a board:

| Conversion | Value | Use it as |
|---|---|---|
| seconds in a day | 86,400 | ~10⁵ — so "a million a day" is ~10/s |
| seconds in a month | ~2.6 million | ~2.5 × 10⁶ |
| a million per day | ~12/s | "ten a second" |
| a billion per month | ~400/s | "a few hundred a second" |
| KB → MB → GB → TB | × 1,000 each (estimation only) | 10³ per step |
| an integer, a timestamp | 8 bytes | — |
| a UUID | 16 bytes binary, 36 as text | — |
| a short text field | ~100 bytes | a name, an address line |
| a typical JSON record | 1–5 KB | an order, a product |
| a thumbnail image | ~50–100 KB | — |
| an average web page's API payload | ~10–100 KB | — |

The table is deliberately coarse. Estimation at a power of ten is the goal; a candidate who
computes 86,400 exactly and then multiplies by an assumed 10 page views has kept the wrong
digits.

## Rounding, and saying so

Round every factor to one significant figure and every product to a power of ten, and *say
that you are doing it*: "call it a hundred thousand seconds; call it ten views per user; that is
about a hundred a second — I'll take a thousand at the peak." Three things happen. The
arithmetic becomes fast enough to do while talking. The interviewer hears every assumption and
can correct the one that is wrong. And the answer arrives in the form the design needs — an
order of magnitude — rather than a precise number that implies a precision nobody has.

The peak factor is the assumption most often forgotten. Average load designs nothing; the sale
day, the match start, the ticket window are what the design is for. State the average, then the
peak, then design for the peak — or say you will shed above it ([04 · Traffic shapes](04-traffic-shapes.md)).

## The arithmetic in code

Nothing here is worth running; it is written to show the shape of the chain:

```ts
// back-of-the-envelope, as a chain of stated assumptions — every input is a guess said aloud
const SECONDS_PER_DAY = 86_400;

export function qps(dau: number, actionsPerUserPerDay: number, peakFactor = 1): number {
  return (dau * actionsPerUserPerDay) / SECONDS_PER_DAY * peakFactor;
}

export function storageBytes(recordBytes: number, writesPerDay: number, retentionDays: number): number {
  return recordBytes * writesPerDay * retentionDays;
}

export function bandwidthBytesPerSecond(payloadBytes: number, requestsPerSecond: number): number {
  return payloadBytes * requestsPerSecond;
}

export function cacheBytes(workingSet: number, hotFraction: number, recordBytes: number): number {
  return workingSet * hotFraction * recordBytes;
}

// the storefront example, rounded the way it would be said:
// qps(1e6, 10)            ≈ 116/s      → "about a hundred a second"
// qps(1e6, 10, 10)        ≈ 1,160/s    → "a thousand at the peak"
// storageBytes(2e3, 5e4, 365 * 7) ≈ 2.6e11 → "a few hundred gigabytes over seven years"
// bandwidthBytesPerSecond(5e4, 1e3)  = 5e7  → "fifty megabytes a second at the edge"
// cacheBytes(1e5, 0.2, 5e3)          = 1e8  → "a hundred megabytes — trivially fits"
```

## What each number licenses

The point of estimating is to let the numbers choose the boxes. Rules of thumb, stated as
tendencies and tied to the ladder:

- **Under a few hundred requests a second**, a single well-indexed database on one node serves
  the read path; a cache is a latency choice, not a capacity one.
- **Thousands a second** — a cache in front of the hot reads pays for itself; read replicas
  become worth their lag.
- **Tens of thousands a second** — the single primary is a write bottleneck to plan around:
  partitioning, or moving hot counters out.
- **Storage under a terabyte** fits one node's disk; sharding is a *write-throughput* or
  *operational* decision, not a size one, until well past that.
- **A cache under a few gigabytes** fits in memory on one node; only a working set that does
  not fit forces a distributed cache.
- **Bandwidth in the tens of megabytes a second from the origin** is the signal for a CDN on
  static and semi-static payloads.

The storefront's numbers — a hundred a second average, a thousand at peak, a few hundred
gigabytes over years, a cache of a hundred megabytes — license a modest design: one primary
with a replica, a cache for products, a CDN for images, and the whole sale-day problem
concentrated on the *write* path's contention rather than on read capacity. Saying that
conclusion is the estimation step paying off.

## When the interviewer gives no numbers

State assumptions and move, per [phase 0's reading protocol](../phase-0-the-interview/06-reading-the-question.md):
"I'll assume a million daily users and ten page views each; tell me if that is off by an order
of magnitude, because that is the only error that changes the design." The last clause is the
senior addition — it says which precision matters.

## Gotchas

**★ Symptom: numbers only when asked, computed on the spot.** Cause: estimation felt like a
detour from the design. Fix: the four multiplications before the first box; they are what
license the boxes.

**★ Symptom: a design for the average, and "what happens on sale day?"** Cause: the peak factor
forgotten. Fix: state average, then peak, then design for the peak or say what sheds above it.

**Symptom: "86,400 times 10 is 864,000, divided by…" — thirty seconds of arithmetic.** Cause:
precision where a power of ten was wanted. Fix: round every factor first — a hundred thousand
seconds, ten views — and say that you are rounding.

**Symptom: a storage estimate of a few gigabytes for seven years of orders.** Cause: retention
omitted or the record size guessed at bytes instead of kilobytes. Fix: size × rate × retention,
with the record size stated — a JSON order is kilobytes, not bytes.

**Symptom: a cache sized as the whole table.** Cause: the hot fraction skipped. Fix: cache the
hot set — a fifth of the catalogue serves most of the reads is a usual assumption — and say the
fraction; a cache the size of the table is a replica, not a cache.

**Symptom: bandwidth computed once, for the whole system.** Cause: payload times QPS is per
hop. Fix: estimate at the edge and at the origin separately; the CDN's hit rate is the factor
between them.

**Symptom: an answer to three significant figures.** Cause: precision mistaken for rigour. Fix:
one significant figure per factor, a power of ten per product, and the sentence "off by an
order of magnitude is the only error that would change this."

**Symptom: bytes and bits mixed.** Cause: network figures are usually bits, storage bytes.
Fix: estimate in bytes throughout and convert once if a link speed is quoted in bits.

## Interview questions

**★ Estimate the storefront's load and storage, out loud.**
A million daily users at ten page views each is ten million views a day; over roughly a hundred
thousand seconds that is about a hundred a second on average, and I'll take ten times that — a
thousand — at a sale peak. Orders: say one in twenty users buys, fifty thousand a day, under one
a second on average, but a flash sale concentrates them — call it fifty a second. Storage: two
kilobytes an order, fifty thousand a day, seven years — roughly two kilobytes times a hundred
and thirty million, a few hundred gigabytes. Cache: a fifth of a hundred-thousand-product
catalogue at five kilobytes is about a hundred megabytes. The read side is modest; the design
problem is the write path under the sale.

**★ Why round to powers of ten and say so?**
Because the design decisions are made at orders of magnitude — a hundred requests a second and a
thousand license different boxes, a hundred and a hundred and twenty do not — so precision
beyond one significant figure is noise that slows the arithmetic and implies a certainty nobody
has. Saying the rounding makes every assumption audible and correctable, and it tells the
interviewer which error would change the design: being off by an order of magnitude, and nothing
smaller.

**What does each estimate license in the design?**
Requests per second decide whether a single node serves the read path, whether a cache pays for
itself, and when the primary becomes a write bottleneck. Storage decides whether one node's disk
suffices and when archival tiers matter; sharding is usually a write-throughput decision, not a
size one. Bandwidth at the origin decides whether a CDN is needed. Cache size decides whether the
hot set fits one node's memory. The estimation step exists so those decisions are derived rather
than assumed.

**What is the most commonly forgotten factor, and why does it matter?**
The peak factor. Averages design nothing; the sale day, the match start and the ticket window are
what the design exists for, and they are often ten to a hundred times the average. State the
average, then the peak, then either design for the peak or say explicitly what is shed above a
stated load — a queue and a wait page, or a degraded read path.

**How do you estimate when the interviewer gives no numbers?**
State assumptions and move: a million daily users, ten views each, one buyer in twenty — and add
the clause that says which precision matters: "correct me if any of those is off by an order of
magnitude; smaller errors don't change the design." Written assumptions are requirements the
interviewer can redirect, and the clause shows you know which digits are load-bearing.

---

← Prev: [02 · Non-functional requirements](02-non-functional-requirements.md) · Index: [Phase 1 — The method](README.md) · Next → [04 · Traffic shapes](04-traffic-shapes.md)
