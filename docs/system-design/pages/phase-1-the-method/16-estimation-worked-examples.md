---
title: "Four estimations worked end to end — the storefront's flash sale, a chat app's year of messages, a video service's egress, a notification system's fan-out — each as a chain of stated assumptions, rounded aloud, ending in the sentence that says what the numbers license"
sidebar_label: "16 · Estimation worked examples"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method; every input below is an *assumption said aloud*, not a measured
> figure, and the arithmetic is the source. The conversions and the four formulas are
> [03](03-back-of-the-envelope-estimation.md)'s; the lock-throughput reasoning is
> [08](08-read-path-and-write-path.md)'s commit-before-the-call rule applied to a number. The
> reference timings are the circulated list credited to Dean and Norvig
> ([norvig.com/21-days.html](https://norvig.com/21-days.html)), orders of magnitude only. **No sandbox run.**

**The method of [03](03-back-of-the-envelope-estimation.md) is four multiplications and a table
of conversions; what makes it automatic is having done it on a dozen systems until the chain of
assumptions comes out in order without thinking.** These four are the ones that come up, and
they are chosen because each ends somewhere different: the storefront's flash sale ends at a
*single row's lock throughput*, which is why it is a write-path problem; the chat app ends at a
*write rate no single primary serves*, which is the first honest case for sharding in this
track; the video service ends at *egress* so large that everything else in the bill is noise;
the notification system ends at a *fan-out ratio* — one event, ten million deliveries — that
decides the whole architecture. Each is written the way it should be said: assumption, factor,
rounding, the number, and then the sentence that says what it licenses. Rehearse them aloud
with the storefront's numbers changed, until the shape of the answer arrives before the
arithmetic does.

## 1 · The storefront's flash sale — ends at one row

**Assumptions, said aloud.** A million users; a flash sale on one product with ten thousand
units; a fifth of the daily users arrive in the first ten minutes; one in five of them reaches
checkout.

| Step | Arithmetic | Said as |
|---|---|---|
| arrivals | 1,000,000 × 0.2 ÷ 600 s | "about three hundred a second on the product page" |
| checkouts | 333 × 0.2 | "sixty or seventy checkouts a second, on *one* product" |
| the row's capacity, provider call inside the transaction | lock held ~30 s → 1 ÷ 30 | "one checkout every thirty seconds — the design is dead" |
| the row's capacity, commit before the call | lock held ~5 ms → 1 ÷ 0.005 | "about two hundred a second on that row" |
| headroom | 200 ÷ 67 | "three times — fine for this sale, gone at a ten-times sale" |
| sell-out | 10,000 ÷ 67 | "sold out in two and a half minutes; then four hundred a second of 'sold out' answers" |
| idempotency rows | 67 × 1 KB | "sixty-seven kilobytes a second — nothing" |

**What it licenses.** Commit before the provider call is not a preference; it is the difference
between one checkout every thirty seconds and two hundred a second. At this sale's numbers a
single row with a short transaction serves it with headroom; at ten times, the row is the wall
and the design needs admission at the gateway plus a reservation counter that answers "sold
out" without touching the row. The read side — three hundred a second on one product page — is
one cached key and never the problem. That is the sentence: *"the flash sale is a write-path
problem on one row, solved by transaction shape first and admission second; the reads are a
cache hit."*

## 2 · A chat app's messages for a year — ends at a write rate

**Assumptions.** Fifty million daily users; forty messages sent per user per day; a message is a
hundred bytes of text plus three sixteen-byte identifiers, an eight-byte timestamp and index
overhead — call it two hundred bytes stored; one message in ten carries an image averaging two
hundred kilobytes; a peak factor of three in the evening.

| Step | Arithmetic | Said as |
|---|---|---|
| messages per day | 5 × 10⁷ × 40 | "two billion a day" |
| messages per second | 2 × 10⁹ ÷ ~10⁵ | "twenty thousand a second; sixty or seventy thousand at the evening peak" |
| text storage per day | 2 × 10⁹ × 200 B | "four hundred gigabytes a day" |
| text storage per year | 4 × 10¹¹ × 365 | "about a hundred and fifty terabytes a year" |
| media per day | 2 × 10⁸ × 2 × 10⁵ B | "forty terabytes a day" |
| media per year | 4 × 10¹³ × 365 | "about fifteen petabytes a year" |
| delivery fan-out | messages × average group size, say 3 | "sixty thousand deliveries a second; two hundred thousand at peak" |

**What it licenses.** Twenty thousand writes a second sustained, seventy thousand at peak, is
above the tendency threshold of [03](03-back-of-the-envelope-estimation.md) for a single
primary — this is the system where sharding is the first step, not the last, and the key is the
conversation identifier so that a conversation's history is one shard's range scan. A hundred
and fifty terabytes of text a year fits a sharded store with time-based partitioning for the
old years; fifteen petabytes of media does not belong in a database at all — object storage,
with a lifecycle policy that moves month-old images to a cheaper tier, and a CDN in front. The
sentence: *"the write rate forces sharding by conversation from day one; text is a hundred and
fifty terabytes a year in the shards, media is fifteen petabytes a year in object storage, and
delivery is a fan-out of three to four on every message."*

## 3 · A video service's CDN egress — ends at bandwidth

**Assumptions.** Ten million daily users; an hour watched per user per day; an average
delivered bitrate of three megabits a second across adaptive renditions; a peak of three times
the average in the evening.

| Step | Arithmetic | Said as |
|---|---|---|
| bytes per user per day | 3 Mb/s × 3,600 s ÷ 8 | "about 1.35 gigabytes per user per day" |
| bytes per day | 1.35 GB × 10⁷ | "thirteen or fourteen petabytes a day" |
| bytes per month | 13.5 PB × 30 | "four hundred petabytes a month" |
| average concurrent viewers | 10⁷ × 1 h ÷ 24 h | "about four hundred thousand watching at any moment" |
| average egress | 4 × 10⁵ × 3 Mb/s | "over a terabit a second, average" |
| peak egress | 1.25 Tb/s × 3 | "three or four terabits a second at the evening peak" |
| origin egress at a 95 % hit ratio | 4 Tb/s × 0.05 | "two hundred gigabits a second from the origin — still enormous" |

**What it licenses.** Four hundred petabytes a month leaving the network is the bill; everything
else — compute, the catalogue database, the metadata store — is a rounding error against it
([13](13-designing-for-cost.md)). So the design *is* the CDN: a hit ratio in the high nineties,
the popular titles pre-positioned at the edge before the evening peak, renditions chosen so that
the average bitrate stays near three rather than drifting to six as screens improve, and the
origin sized for the miss rate. The catalogue itself — say a hundred thousand titles at a few
gigabytes across renditions — is a few hundred terabytes, small next to a single day's egress.
The sentence: *"this system is its egress; the CDN's hit ratio and the average bitrate are the
two numbers that set the bill, and origin capacity is the miss rate times the peak."*

## 4 · A notification system's fan-out — ends at a ratio

**Assumptions.** A hundred million users; five notifications per user per day on average; a
peak factor of five; a notification record of two hundred bytes kept for thirty days; and the
hard case — an account with ten million followers posts, and every follower is to be notified
within a minute.

| Step | Arithmetic | Said as |
|---|---|---|
| notifications per day | 10⁸ × 5 | "five hundred million a day" |
| per second | 5 × 10⁸ ÷ ~10⁵ | "five or six thousand a second; thirty thousand at peak" |
| storage, thirty days | 5 × 10⁸ × 200 B × 30 | "three terabytes for a month's history" |
| the celebrity post, delivery rate | 10⁷ ÷ 60 s | "a hundred and seventy thousand a second, for one minute, from one event" |
| the celebrity post, fan-out on write | 10⁷ × 200 B | "two gigabytes of rows written for one post" |
| push provider calls | 1.7 × 10⁵ per second, batched by a hundred | "seventeen hundred batched calls a second to the push providers" |

**What it licenses.** The steady state is modest — a queue partitioned by user and workers
scaled to the partition count serve thirty thousand a second. The celebrity post is the
architecture: one event becoming ten million deliveries in a minute is nearly thirty times the
system's average rate and six times its peak, from one producer, and it is why fan-out is a *decision*. Fan-out on write
— materialise ten million rows — costs two gigabytes and a minute of write capacity per post;
fan-out on read — each follower's feed queries the accounts they follow — costs nothing at post
time and a join at read time. The standard answer is hybrid: fan-out on write for ordinary
accounts, fan-out on read for the few with millions of followers, and the push deliveries
themselves through a queue that the push providers' rate limits drain. The sentence: *"the
average is thirty thousand a second on a partitioned queue; the celebrity post is a
ten-million-to-one fan-out that makes the write-versus-read decision, and hybrid is the answer."*

## The four in code

The same helpers as [03](03-back-of-the-envelope-estimation.md), applied — the comments are
the rounding said aloud:

```ts
import { qps, storageBytes, bandwidthBytesPerSecond } from './estimation';

// 1 · flash sale — the row's throughput is 1 / lock-hold-time
const checkoutsPerSecond = (1e6 * 0.2 / 600) * 0.2;         // ≈ 67/s on one product
const rowCapacityCallInside = 1 / 30;                        // ≈ 0.03/s — dead
const rowCapacityCommitFirst = 1 / 0.005;                    // = 200/s — three times headroom

// 2 · chat — write rate first, then storage
const messagesPerSecond = qps(5e7, 40);                      // ≈ 23,000/s;  × 3 at peak ≈ 70,000/s
const textPerYear = storageBytes(200, 2e9, 365);             // ≈ 1.5e14 → "150 TB"
const mediaPerYear = storageBytes(2e5, 2e8, 365);            // ≈ 1.5e16 → "15 PB"

// 3 · video — egress is the whole bill
const concurrentViewers = 1e7 * (1 / 24);                    // ≈ 417,000
const averageEgressBitsPerSecond = concurrentViewers * 3e6;  // ≈ 1.25e12 → "over a terabit"
const perDayBytes = bandwidthBytesPerSecond(3e6 / 8 * 3600, 1e7 / 86_400) * 86_400; // ≈ 1.35e16 → "13.5 PB"

// 4 · notifications — the ratio decides the architecture
const steadyPerSecond = qps(1e8, 5, 5);                      // ≈ 29,000/s at peak
const celebrityPerSecond = 1e7 / 60;                         // ≈ 167,000/s for one minute
const fanOutRatio = celebrityPerSecond / (steadyPerSecond / 5); // ≈ 29× the average rate, from one post
```

Nothing here is worth running; the value is that the chain reads top to bottom the way it is
spoken.

## Rehearsing until it is automatic

The drill is the same four systems with one input changed, aloud, against a clock of two
minutes each: the storefront with a hundred thousand units instead of ten; the chat app at five
million users; the video service at a six-megabit average; the notification system with a
hundred-million-follower account. Then the same four with the *question* changed — "how many
database nodes?", "what does it cost?", "where is the first bottleneck?" — because the numbers
are the same and only the final sentence differs. A candidate who has done the drill twenty
times produces the chain in the round without visible arithmetic, which reads as fluency, and
has the rounding habits — a day is ten to the fifth seconds, a month is two and a half million,
a kilobyte record at a thousand a second is a megabyte a second — that make the numbers land at
the right power of ten.

## Gotchas

**★ Symptom: the flash sale estimated as read traffic.** Cause: the arrivals counted, the
checkouts on one row never derived. Fix: follow the chain to the row — checkouts a second
against one divided by the lock-hold time — and say that the reads are one cached key.

**★ Symptom: the chat app's storage computed, the write rate never stated.** Cause: the
storage formula run first because it is the familiar one. Fix: writes a second first, always —
it chooses the store; storage chooses the tier.

**Symptom: media added to the database's storage line.** Cause: bytes counted without asking
where they live. Fix: separate the record from the blob; blobs to object storage with a
lifecycle policy, and the database line shrinks by two orders of magnitude.

**Symptom: the video service's compute and database estimated carefully.** Cause: the bill's
shape unknown. Fix: egress first; when one line is three orders above the rest, say so and
spend the time on the CDN's hit ratio and bitrate.

**Symptom: the notification system estimated at the average only.** Cause: the hard case not
asked for. Fix: ask "what's the largest follower count?" and derive the one-event fan-out; the
ratio to the average rate is the design.

**Symptom: exact figures — 23,148 messages a second.** Cause: the calculator kept the digits.
Fix: "about twenty thousand"; a power of ten with one significant figure, and say the rounding.

**Symptom: the lock-hold time never estimated.** Cause: throughput of a row treated as a
property of the database rather than of the transaction. Fix: one divided by the hold time — five
milliseconds for a local commit, thirty seconds with a provider call inside — and the two
numbers side by side.

**Symptom: the hit ratio assumed at a hundred percent.** Cause: the origin forgotten. Fix: state
the ratio and derive origin egress from the miss rate; at four terabits a five percent miss is
still two hundred gigabits.

## Interview questions

**★ Estimate the storefront's flash sale and say what it licenses.**
A million users, a fifth arriving in ten minutes, a fifth of those checking out: about seventy
checkouts a second on one product. The row's capacity is one over the lock-hold time — a
thirtieth of a checkout per second with the provider call inside the transaction, two hundred a
second with commit before the call — so the transaction shape is the design, with three times
headroom at this sale and none at ten times, where admission and a reservation counter arrive.
The ten thousand units sell out in under three minutes, after which "sold out" is served from
the counter without touching the row. The reads are one cached key.

**★ How much does a chat app store in a year, and what does that force?**
Fifty million users at forty messages a day is two billion messages a day, twenty thousand a
second and seventy thousand at peak — above a single primary, so sharding by conversation from
the start. Text at two hundred bytes stored is four hundred gigabytes a day, a hundred and fifty
terabytes a year, partitioned by time; images on one message in ten at two hundred kilobytes are
forty terabytes a day, fifteen petabytes a year, in object storage with tiering. Delivery is a
fan-out of three to four per message on top of the write rate.

**What sets a video service's bill, and by how much over everything else?**
Egress. Ten million users watching an hour a day at three megabits is 1.35 gigabytes each,
thirteen petabytes a day, four hundred a month; four hundred thousand concurrent viewers on
average is over a terabit a second, three or four at the evening peak. The catalogue is a few
hundred terabytes and the databases are small — three orders of magnitude below a day's egress.
The design is the CDN's hit ratio and the average bitrate; origin capacity is the miss rate
times the peak.

**Why is the celebrity post the notification system's design problem?**
Because the average is modest — a hundred million users at five a day is six thousand a second,
thirty thousand at peak, on a partitioned queue — and one post to ten million followers is a
hundred and seventy thousand deliveries a second for a minute, from a single event, nearly thirty
times the average rate and six times the peak. That ratio forces the fan-out decision: on write, two gigabytes of rows per post;
on read, a join per feed load; hybrid — write for ordinary accounts, read for the few enormous
ones — with push deliveries drained through a queue at the providers' rate limits.

**What makes estimation fluent rather than correct?**
Rehearsal on a fixed set of systems with the inputs varied, aloud, under a two-minute clock, until
the chain of assumptions arrives in order and the rounding is habitual: a day is ten to the
fifth seconds, a month two and a half million, one significant figure at the right power of ten.
Correctness is the arithmetic; fluency is producing the chain without visible effort and ending
each one with the sentence that says which box the number chose.

---

← Prev: [15 · Time management in 45 minutes](15-time-management.md) · Index: [Phase 1 — The method](README.md) · Next → [17 · The same method in writing](17-the-same-method-in-writing.md)
