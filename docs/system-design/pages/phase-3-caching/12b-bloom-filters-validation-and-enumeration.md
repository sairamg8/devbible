---
title: "The strongest defence against keys that do not exist is to refuse them before the cache is consulted, by rejecting impossible ids cheaply, by asking a Bloom filter whether the id could exist, and by making ids that cannot be guessed and clients that guess them cost something"
sidebar_label: "12b · Bloom filters, validation and enumeration"
sidebar_position: 12.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-10-14. The Bloom filter's false-positive formula and its optimal sizing are
> **mathematics, derived on the page**; the pattern of putting a filter or validator in front of a
> cache is **common practice stated as mechanism**. Nothing is quoted from the research bank.
> Guava's `BloomFilter` and the RedisBloom module are named from general knowledge and were **not
> fetched** — confirm the API and the module's availability against the version you run. The
> arithmetic examples are computations from the formulas, not measurements. Continues
> [12](12-negative-caching-and-penetration.md). **No sandbox run.**

**Caching the absence ([12](12-negative-caching-and-penetration.md)) makes a repeated question
cheap; it does nothing for the first time each fake key is asked, and a crawler's keys are all
first times — so the real defence is to refuse the question before it reaches the cache or
the database.** Three layers do it, in increasing cost and decreasing certainty: validation, which
rejects ids that cannot be real; a Bloom filter, which rejects ids that are almost certainly not;
and identifier design plus rate limits, which make the guessing expensive in the first place.

## Layer 1: validate the shape

Most junk keys are not plausible. A product id is a positive integer under the current maximum, or a
UUID, or a fixed-length string of a known alphabet; a request for `product:-1`, `product:abc`, or a
two-megabyte string is rejected before any I/O.

```js
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
app.get('/products/:id', (req, res, next) => {
  if (!UUID.test(req.params.id)) return res.status(400).end();   // never reaches cache or DB
  next();
});
```

Validation is free, exact (no false positives), and defeats the lazy attacker and the buggy client.
It defeats nothing else: `00000000-0000-0000-0000-000000000001` is well-formed. For sequential
integer ids a range check against the known maximum cuts off everything above it, but ids below the
maximum that were deleted still pass, so you still need layers 2 and 3.

## Layer 2: a Bloom filter in front of the cache

A **Bloom filter** is a bit array of `m` bits and `k` hash functions. To add an element, hash it `k`
ways and set those `k` bits. To query, hash it the same way: if **any** of the `k` bits is clear, the
element was **definitely never added**; if all are set, it **may** have been (other elements could
have set those bits). The asymmetry is the whole design:

- **No false negatives.** An element that was added is always reported as possibly present. So a
  filter loaded with every real product id never rejects a product that exists.
- **False positives, with a tunable rate.** A fake id is occasionally reported as possibly present
  and passes through to the cache and database as before. That costs one wasted lookup, never a wrong
  answer.

So the filter sits first: `mightContain(id)` false → return not-found immediately, no cache read, no
database read, no sentinel stored. True → proceed as normal, including negative caching for the
false positives that slip through.

### The sizing, derived

After inserting `n` elements into `m` bits with `k` hashes, a given bit is still zero with
probability `(1 − 1/m)^(kn) ≈ e^(−kn/m)`. A fake id is wrongly accepted when all `k` of its bits are
set, so the false-positive rate is

```
p  ≈  (1 − e^(−kn/m))^k
```

For fixed `m` and `n`, `p` is minimised at `k = (m/n) · ln 2`, where half the bits are set. Substituting
and solving for `m`:

```
m / n  =  −ln(p) / (ln 2)²          k  =  (m / n) · ln 2
```

For `p = 0.01`: `−ln(0.01) ≈ 4.605` and `(ln 2)² ≈ 0.4805`, so `m/n ≈ 9.6` bits per element and
`k ≈ 6.6`, i.e. 7 hashes. That is arithmetic from the formula — it says the filter's memory is
proportional to the number of ids and is far smaller than storing the ids themselves, not that any
particular deployment is a given size. Memory grows with `−ln(p)`: each factor of ten in accuracy costs
a constant number of extra bits per element.

```js
const crypto = require('node:crypto');

class Bloom {
  constructor(n, p = 0.01) {
    this.m = Math.ceil(-n * Math.log(p) / (Math.LN2 ** 2));
    this.k = Math.max(1, Math.round((this.m / n) * Math.LN2));
    this.bits = new Uint8Array(Math.ceil(this.m / 8));
  }
  *positions(key) {                                  // double hashing: h1 + i*h2
    const d = crypto.createHash('sha256').update(String(key)).digest();
    const h1 = d.readUInt32BE(0), h2 = d.readUInt32BE(4) | 1;
    for (let i = 0; i < this.k; i++) yield (h1 + i * h2) % this.m;
  }
  add(key) { for (const b of this.positions(key)) this.bits[b >> 3] |= 1 << (b & 7); }
  mightContain(key) {
    for (const b of this.positions(key)) if (!(this.bits[b >> 3] & (1 << (b & 7)))) return false;
    return true;
  }
}
```

On the JVM, Guava's `BloomFilter.create(Funnels.longFunnel(), expectedInsertions, fpp)` provides the
same structure with `put` and `mightContain`. For a filter shared across instances, the RedisBloom
module offers server-side filters (named from general knowledge — **not fetched**; check it is
available on your managed Redis before designing around it).

### Keeping it truthful

The filter's guarantee — *no false negatives* — holds only if every real id is in it. That makes it an
index you must maintain:

- **Load at startup** from the database (or from a snapshot built by a job), before serving traffic.
- **Add on create**, and do it *before* the row becomes visible to readers or in the same step — an id
  that is created but not yet in the filter is rejected as not found, a false negative the structure
  was supposed to make impossible. Order: add to filter, then commit/expose.
- **A standard Bloom filter cannot remove an element.** Deleted products stay "possibly present",
  which is safe (they fall through to negative caching) but means the false-positive rate drifts
  upward. Rebuild periodically; a counting variant supports deletion at several times the memory.
- **Capacity is fixed.** If `n` grows past what `m` was sized for, `p` rises sharply. Size for the
  growth, monitor the fraction of bits set, and rebuild into a larger array.
- **In-process filters diverge.** Each instance holds its own copy, so a newly created id is unknown
  to the others until they refresh. A shared (Redis-side) filter or a short propagation path avoids
  that, at the price of a network hop on every request — which is the thing you were trying to avoid
  for a hot read path. Choose per route.

## Layer 3: make guessing expensive

- **Non-enumerable identifiers.** Sequential integer ids let a client walk the whole keyspace;
  random UUIDs or signed opaque tokens make a successful guess astronomically unlikely, and
  most of the traffic that remains is from clients who were *given* the id.
- **Authorisation before existence.** An endpoint that answers `404` for missing and `403` for
  forbidden tells an enumerator which ids exist. Returning the same response for both is a product
  and security choice; see the gotcha in [12](12-negative-caching-and-penetration.md).
- **Rate limit the enumerator.** A client producing a high rate of not-found responses is identifiable
  by that signal alone, and throttling it by its not-found rate is cheaper than serving it. The
  mechanics are in [rate limiting](../phase-2-request-path/07-rate-limiting.md) and the edge side in
  [abuse at the edge](../phase-2-request-path/18-abuse-at-the-edge.md).

## Which layer, when

| Defence | Stops | Cost | Fails how |
|---|---|---|---|
| validate shape | malformed ids, lazy crawlers | microseconds, no state | well-formed fake ids pass |
| Bloom filter | well-formed ids that were never real | memory for the bit array, upkeep | false positives pass; stale filter rejects new ids |
| negative cache | repeats of any fake id | memory per distinct fake id | fills with junk; hides new items for its TTL |
| rate limit by not-found rate | the enumerator itself | counters per client | distributed attackers |
| non-enumerable ids | guessing | design-time | ids leaked or derivable |

They stack: validate, then filter, then the cache with a short negative TTL behind it for the false
positives, with a rate limit across the top. No layer is a substitute for the one before it.

## Gotchas

**★ Symptom: a real, just-created product returns "not found" from every instance for a while.**
Cause: the Bloom filter was updated after the row became visible, or each instance's in-process
filter has not picked up the new id. The filter promised no false negatives and the update path
broke the promise. Fix: add to the filter first, in the same step as the insert; for per-instance
filters, subscribe to creation events and treat the filter as eventually consistent with a fallback
(on a filter miss for a recent-looking id, check the database once).

**★ Symptom: the filter rejected nothing useful — almost every fake id passes.**
Cause: sized for `n` elements at deploy time, now holding many times that, so most bits are set and
`p` has risen toward 1. Fix: size from the expected maximum, track the fraction of set bits, rebuild
into a larger array before it fills.

**★ Symptom: a "negative" answer from the filter was used as a "positive" one.**
Cause: `mightContain == true` was treated as "exists" and the code skipped the database. Fix: the
filter can only prove absence. True means *continue to the cache and the database*.

**Symptom: deleted products keep passing the filter forever.**
Cause: a plain Bloom filter cannot remove elements. Fix: acceptable — they fall to the negative
cache — but rebuild on a schedule, or use a counting filter if deletion volume is high.

**Symptom: the filter's startup load blocks the service from starting, or loads partial data.**
Cause: building from a full table scan at boot, readiness not gated on completion, or a failure
partway through leaving a half-built filter that then rejects real ids. Fix: build off to the side,
swap in atomically on completion, and never serve a partial filter as authoritative — until it is
ready, skip the filter (cache and database handle everything) rather than reject.

**Symptom: validation rejects legitimate ids after a schema change.**
Cause: the regex or range check encodes the id format and the format changed (longer ids, a new
prefix). Fix: keep the validator next to the id generator and cover both in one test.

**Symptom: hashing the key with a weak or low-entropy hash produces clustering.**
Cause: the `k` positions are correlated, so the real false-positive rate exceeds the formula's. Fix:
derive all positions from a good hash by double hashing as shown, not from `k` copies of a trivial one.

## Interview questions

**★ How does a Bloom filter protect the database, and what does it never do?**
It answers "was this ever added?" with *definitely not* or *maybe*. Loaded with every real id, it
rejects well-formed fake ids without touching the cache or database, and it can never reject a real
id because there are no false negatives. It never confirms existence: a *maybe* still goes to the
cache and database, and the false positives it lets through are handled by negative caching.

**★ Derive the false-positive rate, and size a filter for a given `p`.**
After `n` insertions, a bit is zero with probability about `e^(−kn/m)`, so all `k` positions of a
fake id are set with probability `(1 − e^(−kn/m))^k`. That is minimised at `k = (m/n) ln 2`, giving
`m/n = −ln(p)/(ln 2)²` bits per element; for a one-percent rate, roughly 9.6 bits and 7 hashes. The
useful consequences: memory is linear in `n` and logarithmic in `1/p`, and the filter must be
re-sized if `n` outgrows the plan.

**★ What breaks if you put a Bloom filter in front of the cache and forget to update it on create?**
Every newly created id is reported as definitely absent, so new products, new orders and new accounts
are "not found" until the filter is rebuilt. The filter's guarantee depends on completeness; the
update must precede visibility. With per-instance filters the failure is also inconsistent across
instances, which is harder to diagnose.

**Why not just use a negative cache and skip the filter?**
A negative cache helps only on the second request for the same fake key. An enumerator sends each
fake key once, so every request is a first time: the negative cache never hits, writes one sentinel
per request and fills the keyspace. The filter rejects before any write. The negative cache then
handles the false positives and the repeats the filter lets through.

**How would you stop someone enumerating order ids?**
Make the ids non-sequential (random UUIDs or signed tokens), authorise before revealing existence so
missing and forbidden look the same, and rate limit by the rate of not-found responses per client so
the enumerator throttles itself. Validation and a filter reduce the cost of the attempts but do not
stop the attempts.

**When is a Bloom filter not worth it?**
When the keyspace is small enough that validation and a negative cache bound the damage, when ids are
already non-guessable and the traffic is from legitimate clients, or when the cost of keeping the
filter complete across instances exceeds the database load it saves. It earns its place when the
valid set is large, creation is infrequent, and the fake-key rate is high.

{/* FOOTER */}
