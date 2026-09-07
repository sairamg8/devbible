---
title: "You do not need the nanoseconds, you need the orders of magnitude and the habit of reaching for them — memory beats disk by five orders, a cross-region round trip costs more than a million memory reads, and every design decision is one of those ratios"
sidebar_label: "05 · The latency ladder"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against Peter Norvig's timing table in
> [*Teach Yourself Programming in Ten Years*](https://norvig.com/21-days.html) (primary), with three
> rows Norvig's table lacks taken from the circulated list credited to Jeff Dean and Norvig
> ([gist reproduction](https://gist.github.com/jboner/2841832), figures circa 2012 — a secondary
> source, used for orders of magnitude only). **No timings were run here**; the ordering is what
> the page relies on, not the digits.

**The latency ladder is a dozen numbers spanning nine orders of magnitude, and the design skill is
not recalling them but reaching for the ratio between two rungs the moment a decision comes up.**
Memory is roughly a hundred nanoseconds; a disk seek is roughly ten milliseconds — five orders
apart, which is why a cache exists. A round trip across an ocean is roughly a hundred and fifty
milliseconds — more than a million memory references, which is why synchronous cross-region
replication is a per-write tax that most designs refuse. A round trip inside a datacentre is around
half a millisecond, which is why a page that makes twenty sequential service calls is slow before
any of them does work. Every "should we cache / replicate / call this synchronously / batch this"
question is one of those ratios, and an interviewer listens for whether you reached for it.

## The ladder

Norvig's table, verbatim, with the three rows the circulated list adds marked:

| Operation | Time | |
|---|---:|---|
| execute typical instruction | 1 ns | Norvig |
| fetch from L1 cache memory | 0.5 ns | Norvig |
| branch misprediction | 5 ns | Norvig |
| fetch from L2 cache memory | 7 ns | Norvig |
| Mutex lock/unlock | 25 ns | Norvig |
| fetch from main memory | 100 ns | Norvig |
| send 2K bytes over 1Gbps network | 20,000 ns | Norvig |
| read 4K randomly from SSD | 150,000 ns | circulated list |
| read 1MB sequentially from memory | 250,000 ns | Norvig |
| round trip within same datacenter | 500,000 ns | circulated list |
| read 1MB sequentially from SSD | 1,000,000 ns | circulated list |
| fetch from new disk location (seek) | 8,000,000 ns | Norvig |
| read 1MB sequentially from disk | 20,000,000 ns | Norvig |
| send packet US to Europe and back | 150,000,000 ns | Norvig |

The digits are from a particular era of hardware and will drift; the *order* has been stable for
decades and is the thing to hold. Rewritten in the units a design conversation uses:

| Rung | Order of magnitude | Human unit |
|---|---:|---|
| CPU cache | ~1 ns | a nanosecond |
| Memory | ~100 ns | a tenth of a microsecond |
| Sequential memory scan, 1 MB | ~250 µs | a quarter of a millisecond |
| SSD random read | ~100 µs | a tenth of a millisecond |
| Datacentre round trip | ~500 µs | half a millisecond |
| SSD sequential, 1 MB | ~1 ms | a millisecond |
| Disk seek | ~10 ms | ten milliseconds |
| Cross-continent round trip | ~150 ms | a sixth of a second |

## The six ratios that decide designs

1. **Memory : disk seek ≈ 1 : 100,000.** A cache hit replaces a disk seek with a memory read. This
   is the whole justification for caching, and it is also why a cache with a poor hit rate can be
   worse than none — the miss path pays the seek *and* the cache lookup.
2. **Memory : datacentre round trip ≈ 1 : 5,000.** Any call to another service costs thousands of
   local operations before it does anything. A design with a service per noun pays this per hop;
   the number of *sequential* hops in a request is a latency floor you can compute before writing
   code.
3. **Datacentre round trip : cross-continent round trip ≈ 1 : 300.** Synchronous replication
   across regions adds the larger number to every write. Multi-region designs are asynchronous by
   default for this reason, and a design that claims synchronous multi-region consistency owes an
   explanation of who waits.
4. **Sequential : random on disk ≈ 1 : 100 or worse per byte.** Reading a megabyte sequentially
   from disk is a couple of seeks' worth of time; reading it as random 4K pages is hundreds of
   seeks. This is why logs are append-only, why B-trees keep related keys adjacent, and why an
   LSM engine batches writes.
5. **SSD random read : disk seek ≈ 1 : 50–100.** SSDs collapsed the random-read penalty, which
   changed what "needs a cache" means — but an SSD read is still a thousand memory reads, so the
   ladder did not flatten, it shortened one rung.
6. **Network bandwidth is a separate axis.** Sending 2 KB over a gigabit link is tens of
   microseconds; sending a megabyte is milliseconds. Payload size multiplies the per-hop cost, so
   "we'll fetch the whole product document" has a latency price as well as a bandwidth one.

## Using it on the board

The habit is a sentence of the form *this operation is on rung A; the alternative is on rung B; the
ratio is N; therefore…* Four decisions from the storefront, with the ratio doing the arguing:

**Should the cart live in Redis or PostgreSQL?** Both are a datacentre round trip away, so the
network cost is the same rung. The difference is what happens after the hop: a memory read in Redis
versus, for a cold cart, an index walk and possibly a page read in PostgreSQL. For a cart read on
every page view the ratio favours memory; for the order, which is written once and must survive,
the ratio is irrelevant and durability decides. *The ladder answers the cart question and says the
order question is not a latency question.*

**Can checkout call the payment provider synchronously?** The provider is at least a cross-region
round trip away — a hundred milliseconds or more before it does any work, plus its own processing.
That single call is likely to dominate a half-second p99 budget. So it is synchronous *once*, with
a timeout, behind an idempotency key, and nothing else in the checkout waits on the network while
it is in flight. *The ladder sets the budget and the budget dictates the shape.*

**How many sequential service calls can a 200 ms page afford?** Each hop is half a millisecond of
pure network before any work, and each service does its own store access — call it a few
milliseconds per hop realistically. Twenty sequential hops is a noticeable fraction of the budget
on network alone; twenty *parallel* hops is one hop's worth. *The ladder turns "microservices are
slow" into a number, and the number says to fan out in parallel and cap the depth.*

**Should orders replicate synchronously to a second region?** Every order write would pay a
cross-continent round trip — three hundred datacentre round trips — before acknowledging. For a
checkout that already spends its budget on the payment provider, that is the difference between
meeting p99 and not. Asynchronous replication with a stated recovery point is the usual answer,
and the ladder is the reason. *A senior states the tax; a staff engineer states what recovery
point the business accepts in exchange.*

## A latency budget, as a planning tool

A budget is the ladder applied to one journey. It is an *allocation*, not a measurement — the
numbers below are targets chosen from the ladder, and the value is in the arithmetic being visible:

| Checkout p99 target: 500 ms | Allocated | From which rung |
|---|---:|---|
| Edge and TLS | 20 ms | one client round trip, amortised by keep-alive |
| Gateway, auth check | 5 ms | a datacentre hop plus a cache read |
| Order service logic | 10 ms | CPU and memory |
| Three PostgreSQL statements | 15 ms | three datacentre hops, index reads on SSD |
| Payment provider, synchronous | 300 ms | a cross-region round trip plus the provider's own work |
| Outbox write, same transaction | 0 ms extra | inside the statements above |
| Headroom for tails | 150 ms | the part that keeps p99 honest |

The budget makes two things obvious that a diagram hides: the provider is most of the cost, so
nothing else may be sequential with it; and the headroom is not slack — it is the tail of every
component compounding. A candidate who produces this table has done estimation (line 2 of the
[rubric](03-the-rubric.md)) and set up the deep dive at the same time.

## What has changed since the table was written

The digits are from around 2012. NVMe storage, faster networks and larger caches have shortened
several rungs since — but the *ordering* of the rungs, and the ratios between memory, a network
hop, storage and a continent, are what the page relies on, and those have held. Where a current
figure matters — a specific NVMe read latency, a specific link speed — it is a T2 lookup against
the hardware in front of you, not a number to recall. The documentation fetched for this page does
not state current figures, and none are invented here.

## Gotchas

**★ Symptom: you quoted "100 nanoseconds for memory" with confidence and the interviewer asked
about NVMe.** Cause: digits recalled, orders of magnitude not understood; the follow-up tests
whether you know the rungs move. Fix: answer in rungs — "an SSD random read is roughly a thousand
memory references; NVMe shortens that rung but does not remove it; the design decision is the same:
a cache in front of storage still pays off for the hot set."

**★ Symptom: a design with a service per noun, and "microservices are fine for latency."**
Cause: the datacentre round trip treated as free. Fix: count the sequential hops on the critical
path and multiply: "checkout touches five services sequentially — that is five network round
trips before any work — I'd collapse the two that are always called together and fan the rest out
in parallel."

**Symptom: synchronous multi-region replication proposed for orders "for safety".** Cause: the
cross-continent rung forgotten. Fix: state the tax — "that adds a cross-region round trip to every
write, a hundred-plus milliseconds inside a five-hundred-millisecond budget already dominated by
the provider" — and offer asynchronous replication with a recovery point the business accepts.

**Symptom: "we'll cache it" for something with a low hit rate.** Cause: caching treated as
always-positive. Fix: the miss path pays the store *and* the cache lookup; say the hit rate the
cache needs to pay for itself and where it comes from — "product pages are a hot set, carts are
per-user and read once per page, so the product cache pays and a cart cache probably does not."

**Symptom: payload size ignored.** Cause: the ladder read as pure latency. Fix: a megabyte over a
gigabit link is milliseconds per hop; fetching a full product document with all its reviews on
every list view multiplies that by the list length. Say what is fetched, not just how often.

**Symptom: the latency budget adds up to the target with no headroom.** Cause: components budgeted
at their typical cost, not their tail. Fix: leave explicit headroom and say why — "the p99 of the
whole is worse than the sum of the p50s because tails compound across sequential calls."

**Symptom: "disk is slow, use SSD" as the whole answer to a storage question.** Cause: the
sequential-versus-random rung ignored. Fix: say what the access pattern is — appends, point reads,
range scans — because sequential disk beats random SSD per byte, which is why logs and LSM engines
exist.

**Symptom: an average used where the ladder gives a floor.** Cause: the ladder's rungs are
best-case costs; contention and queueing sit on top. Fix: use the ladder for *floors* and
*ratios* — "a hop cannot be faster than half a millisecond" — and the tail for targets.

## Interview questions

**★ Roughly how do memory, an SSD read, a datacentre round trip, a disk seek and a cross-region
round trip compare, and why does it matter?**
Memory is about a hundred nanoseconds; an SSD random read is on the order of a hundred
microseconds — a thousand memory references; a datacentre round trip is around half a millisecond —
several thousand; a disk seek is around ten milliseconds — a hundred thousand; a cross-continent
round trip is around a hundred and fifty milliseconds — over a million. It matters because every
design decision is a ratio between two rungs: caching replaces a seek with a memory read,
synchronous cross-region replication adds the largest rung to every write, and a chain of service
calls pays the network rung per hop before doing any work.

**★ Why do most multi-region designs replicate asynchronously?**
Because synchronous replication adds a cross-continent round trip to every write, and that rung is
hundreds of times larger than a datacentre hop — often larger than the entire latency budget of the
request. Asynchronous replication takes the write off the critical path and pays with a recovery
point: the writes not yet replicated when a region fails. The senior answer states the tax; the
staff answer states the recovery point the business accepts in exchange, and which journeys (a
paid order) might justify paying the tax anyway.

**★ A page makes twenty backend calls. What does the ladder say about its latency?**
That the floor is set by the *depth* of sequential calls, not the count. Twenty sequential hops
pay twenty network round trips — around ten milliseconds of pure network before any work, plus each
service's own store access; twenty parallel hops pay one round trip plus the slowest call. So the
design collapses calls that are always made together, fans the rest out in parallel, and caps the
sequential depth. The page's p99 is close to the p99 of its slowest dependency in the parallel case
and to the sum of tails in the sequential case.

**How would you build a latency budget for checkout, and what does it reveal?**
Allocate the target across the journey using the ladder: a client round trip at the edge, a
datacentre hop per service call, storage reads at the SSD rung, and the payment provider at a
cross-region round trip plus its own processing. Leave explicit headroom for tails. The table
reveals that the provider dominates, so nothing may be sequential with it and it must be called
once behind an idempotency key with a timeout; and that headroom is not slack, because the p99 of
a chain is worse than the sum of its components' typical costs.

**When does a cache not pay for itself?**
When the hit rate is low enough that the miss path — the store access plus the cache lookup and
fill — costs more in total than skipping the cache. Per-user, read-once data such as a cart on a
single page view is the usual example; a hot, shared, read-many set such as product pages is the
opposite. The ladder gives the payoff per hit (a memory read instead of a store read); the access
pattern gives the hit rate; the product of the two is the argument.

**Why do append-only logs and LSM engines exist, in ladder terms?**
Because sequential storage access is orders of magnitude cheaper per byte than random access on
disk, and still meaningfully cheaper on SSD. Appending turns many random writes into one sequential
stream; an LSM engine batches writes in memory and flushes them sequentially, then pays for it with
compaction and a more expensive read path. The design is the sequential-versus-random rung applied
to writes, and the trade is write throughput against read amplification.

**The numbers in the ladder are from around 2012. Are they still useful?**
The digits have drifted — NVMe and faster networks shortened several rungs — but the ordering and
the ratios between memory, a network hop, storage and a continent have held, and design decisions
are made on the ratios. Where a current figure matters, it is a lookup against the hardware in
front of you, not a number to recall; the honest answer in an interview is "roughly this order of
magnitude, and the ratio to the next rung is what decides the design."

---

← Prev: [04 · The vocabulary contract](04-the-vocabulary-contract.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **Reading the question** *(not written yet)*
