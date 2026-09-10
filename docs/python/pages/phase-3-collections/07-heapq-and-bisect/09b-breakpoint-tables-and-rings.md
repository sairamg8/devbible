---
title: "A sorted list of breakpoints plus a list of outcomes one longer turns 'which tier, bracket, bucket or node does this value belong to' into one bisect — and the whole correctness of it lives in which bisect you call at the boundary, how many outcomes you listed, and whether the hash you ring on is stable"
sidebar_label: "09b · Breakpoint tables and lookup rings"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`bisect` Examples](https://docs.python.org/3.14/library/bisect.html#examples) (the grade table), [`ipaddress`](https://docs.python.org/3.14/library/ipaddress.html), [`hashlib`](https://docs.python.org/3.14/library/hashlib.html), and the data model note on [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__) (hash salting); Prometheus [metric types — histogram](https://prometheus.io/docs/concepts/metric_types/) for the bucket semantics. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Pricing tiers, tax brackets, SLA grades, latency-histogram buckets, "which shard owns this key": each maps a number onto one of a few ranges, and each is usually written as an `if`/`elif` ladder that someone edits by hand until the boundaries overlap. The `bisect` documentation's grade example is the replacement — a sorted list of breakpoints and a parallel list of outcomes one longer, so the index `bisect` returns *is* the outcome. The table becomes data you can validate at load time, and a lookup costs about log2 of the number of breakpoints. Three details carry every bug: `bisect` versus `bisect_left` decides which side a value exactly on a breakpoint falls, the outcome list must have exactly one more entry than the breakpoint list, and the breakpoints must be sorted. The same one-bisect lookup, with wrap-around, is a consistent-hashing ring — as long as the hash is one that every process agrees on, which Python's built-in `hash()` of a string is not.**

## The documentation's table

> *"The `bisect()` function can be useful for numeric table lookups. This example uses `bisect()`
> to look up a letter grade for an exam score (say) based on a set of ordered numeric
> breakpoints: 90 and up is an 'A', 80 to 89 is a 'B', and so on"*

```python
from bisect import bisect

def grade(score):
    i = bisect([60, 70, 80, 90], score)
    return "FDCBA"[i]
```

Four breakpoints make five ranges, so five outcomes. `bisect` is `bisect_right`: a score *equal*
to a breakpoint lands to its right, in the higher range — 90 is an A, 89 is a B. That is the
"*n* and up" rule. For "above *n*" — 90 is still a B, 90.5 an A — use `bisect_left`, which puts
equal values on the left:

| Rule at each breakpoint `b` | Function | Value exactly `b` goes to |
|---|---|---|
| "`b` and up" (`>= b` is the higher tier) | `bisect` / `bisect_right` | the higher range |
| "above `b`" (`> b` is the higher tier) | `bisect_left` | the lower range |

## Tiers as validated data

```python
from bisect import bisect
from decimal import Decimal

class TierTable:
    """Maps an amount to a tier; amounts at a breakpoint belong to the higher tier."""

    def __init__(self, breakpoints: list[Decimal], tiers: list[str]) -> None:
        if len(tiers) != len(breakpoints) + 1:
            raise ValueError("need exactly one more tier than breakpoints")
        if any(a >= b for a, b in zip(breakpoints, breakpoints[1:])):
            raise ValueError("breakpoints must be strictly increasing")
        self._breakpoints = breakpoints
        self._tiers = tiers

    def tier_for(self, amount: Decimal) -> str:
        return self._tiers[bisect(self._breakpoints, amount)]

volume_discount = TierTable(
    breakpoints=[Decimal("1000"), Decimal("10000"), Decimal("100000")],
    tiers=["list", "bronze", "silver", "gold"],
)
```

Validation at construction turns the two silent failure modes — an outcome list one short, and a
hand-edited breakpoint out of order — into a start-up error. `Decimal` rather than `float` for
money means a boundary like `1000.00` compares exactly.

## Progressive brackets: the index and everything below it

Tax and usage-based billing need more than the bracket: every bracket *below* the one the amount
lands in contributes in full. `bisect` finds how many breakpoints the amount has passed; a
precomputed cumulative total makes the result O(log n) too:

```python
from bisect import bisect
from decimal import Decimal
from itertools import accumulate

# band i covers [lower[i], lower[i + 1]) and is charged rate[i] per unit
lower = [Decimal("0"), Decimal("10000"), Decimal("40000"), Decimal("100000")]
rate  = [Decimal("0.00"), Decimal("0.10"), Decimal("0.20"), Decimal("0.40")]
full_band_charge = [(hi - lo) * r for lo, hi, r in zip(lower, lower[1:], rate)]
charge_below = [Decimal("0"), *accumulate(full_band_charge)]   # charge_below[i]: bands 0..i-1

def progressive_charge(units: Decimal) -> Decimal:
    i = bisect(lower, units) - 1            # the band units falls in (units >= 0)
    return charge_below[i] + (units - lower[i]) * rate[i]
```

## Histogram buckets

Prometheus-style latency histograms label each bucket with an inclusive upper bound — the series
is exposed as *"`<basename>_bucket{le="<upper inclusive bound>"}`"* in the Prometheus
documentation. With a sorted list of upper bounds, the bucket an observation belongs to is the first
bound it does not exceed, which is `bisect_left`:

```python
from bisect import bisect_left

UPPER_BOUNDS_S = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]   # then +Inf
bucket_counts = [0] * (len(UPPER_BOUNDS_S) + 1)

def observe(seconds: float) -> None:
    bucket_counts[bisect_left(UPPER_BOUNDS_S, seconds)] += 1   # exactly 0.25 lands in le="0.25"
```

Prometheus' own buckets are cumulative — *"every bucket counts all observations less than or equal
to the upper boundary provided as a label"* — while this array holds per-bucket counts;
`list(itertools.accumulate(bucket_counts))` turns it into the cumulative form.

## Range tables: IP allowlists and version gates

When the ranges are not contiguous — IP blocks, version ranges with gaps — store the *starts* sorted,
bisect to the last start at or below the value, then check that the value is also before that
range's end:

```python
from bisect import bisect_right
from ipaddress import IPv4Address, IPv4Network

class Ipv4RangeTable:
    """Non-overlapping networks → owner, looked up in O(log n)."""

    def __init__(self, owners: dict[str, str]) -> None:
        nets = sorted((IPv4Network(cidr), owner) for cidr, owner in owners.items())
        self._starts = [int(net.network_address) for net, _ in nets]
        self._ends = [int(net.broadcast_address) for net, _ in nets]
        self._owners = [owner for _, owner in nets]

    def owner_of(self, address: str) -> str | None:
        ip = int(IPv4Address(address))
        i = bisect_right(self._starts, ip) - 1        # last network starting at or before ip
        if i >= 0 and ip <= self._ends[i]:
            return self._owners[i]
        return None

table = Ipv4RangeTable({"10.0.0.0/8": "internal", "203.0.113.0/24": "partner-acme"})
```

This relies on the networks not overlapping; nested CIDR blocks (a `/24` inside a `/8`) need a
longest-prefix match, which a single bisect cannot give.

## The consistent-hashing ring

A cache or shard router places each node at several points on a ring of hash values; a key belongs
to the first node point clockwise from the key's own hash. That is a `bisect_right` on the sorted
point hashes, with wrap-around past the last point:

```python
import hashlib
from bisect import bisect_right

def ring_hash(value: str) -> int:
    return int.from_bytes(hashlib.blake2b(value.encode(), digest_size=8).digest(), "big")

class HashRing:
    def __init__(self, nodes: list[str], points_per_node: int = 100) -> None:
        points = sorted((ring_hash(f"{node}#{i}"), node)
                        for node in nodes for i in range(points_per_node))
        self._hashes = [h for h, _ in points]
        self._nodes = [n for _, n in points]

    def node_for(self, key: str) -> str:
        i = bisect_right(self._hashes, ring_hash(key)) % len(self._hashes)   # wrap to point 0
        return self._nodes[i]

ring = HashRing(["cache-a:6379", "cache-b:6379", "cache-c:6379"])
```

Two properties matter. The `% len(...)` sends keys hashed beyond the last point to the first. And
the hash must be the same in every process that routes: `hashlib` digests are, while the built-in
`hash()` of a `str` is not —

> *"By default, the `__hash__()` values of str and bytes objects are "salted" with an unpredictable
> random value. Although they remain constant within an individual Python process, they are not
> predictable between repeated invocations of Python."*

— so two web workers using `hash(key)` would send the same key to different cache nodes. The same
salting is why set iteration order changes between runs
([04 · `set` — iteration order](../04-set-and-frozenset/06-iteration-order.md)).

## Gotchas

**★ Symptom: customers spending exactly 1,000 are billed at list price, though the pricing page
says "1,000 and up".** Cause: `bisect_left`, which sends a value equal to a breakpoint to the lower
tier. Fix: `bisect` (`bisect_right`) for "*n* and up"; keep `bisect_left` only for "above *n*".

**★ Symptom: `IndexError` for the largest amounts, or the top tier never used.** Cause: the outcome
list has as many entries as breakpoints instead of one more. Fix: validate
`len(tiers) == len(breakpoints) + 1` at load, as `TierTable` does.

**★ Symptom: after a config edit, a mid-range value maps to the wrong tier and nothing errors.**
Cause: breakpoints no longer sorted; bisect assumes they are. Fix: reject unsorted breakpoints when
the table is built, not when a customer hits the boundary.

**Symptom: an amount that should sit exactly on a boundary lands just below it.** Cause: float
arithmetic — a total accumulated from `0.1` increments is not exactly the breakpoint it looks like.
Fix: money in `Decimal` or integer cents, for both the breakpoints and the values looked up.

**Symptom: the cache hit rate collapses after a deploy, and each worker process caches a different
key set.** Cause: the ring was built on `hash(str)`, which is salted per process. Fix: a `hashlib`
digest, as `ring_hash` does.

**Symptom: `IndexError: list index out of range` for a small fraction of keys routed through the
ring.** Cause: a key hashed past the last point, and the index was not wrapped. Fix:
`bisect_right(...) % len(self._hashes)`.

**Symptom: an address inside `10.1.2.0/24` resolves to the owner of `10.0.0.0/8` (or vice versa).**
Cause: overlapping networks in a table that assumes disjoint ranges. Fix: reject overlaps at load
(`net.overlaps(previous)` while building), or use a longest-prefix structure for nested blocks.

**Symptom: a value between two IP ranges is attributed to the lower one.** Cause: the lookup
returned the last start at or below the value without checking that range's end. Fix: the
`ip <= self._ends[i]` check.

## Interview questions

**★ How would you map a score to a grade or a spend to a pricing tier without an `if` ladder?**
Keep a sorted list of breakpoints and a list of outcomes with one more entry, and return
`outcomes[bisect(breakpoints, value)]`. `bisect` puts a value equal to a breakpoint into the higher
range, which implements "*n* and up"; `bisect_left` implements "above *n*". The table is data, so
it can be validated — sorted, and exactly one more outcome than breakpoints — when it is loaded.

**★ How does a consistent-hashing lookup use `bisect`?**
Hash every node at several points, keep the point hashes sorted with a parallel list of nodes, and
for a key take `bisect_right(hashes, hash(key)) % len(hashes)` — the first point clockwise from the
key, wrapping round past the end. Adding or removing a node moves only the keys between its points
and their predecessors. The hash must be stable across processes, so it comes from `hashlib`, never
from the salted built-in `hash()` of a string.

**How do you compute a progressive tax or tiered usage charge efficiently?**
Precompute, for each band, the full charge of all bands below it. For an amount, `bisect` finds the
band it falls in; the charge is the cumulative total below that band plus the part of the amount
inside it times the band's rate. Each calculation is one binary search and a few arithmetic
operations.

**Why does looking up an IP address in a table of CIDR blocks need an extra check after the bisect?**
Because the bisect over range starts only finds the last block starting at or before the address;
the address may lie in a gap after that block ends. Compare against the block's end. And if blocks
can nest, a single bisect cannot choose the most specific one.

---

← Prev: [09 · Range queries on sorted data](09-range-queries.md) · [Topic index](README.md) · Next → [10 · When the answer is not `heapq` or `bisect`](10-when-the-answer-is-not-heapq-or-bisect.md)
