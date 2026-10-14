---
title: "Every defence against a hot key buys relief with staleness, so the L1 TTL is a number you must derive from what the key may be wrong about, admit only keys that have proven hot, and remember the L1 never sees an invalidation aimed at the L2"
sidebar_label: "06b · The L1's price and its limits"
sidebar_position: 6.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Mechanism and arithmetic, continuing [06](06-hot-keys-and-skew.md); the
> load formula (`instances / TTL`) is derived, not measured, and no figure for staleness, hit
> ratio or latency is stated. The RFC 5861 permission sentence is quoted from the research bank
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc5861.html), banked 2026-09-08). The code
> was **not executed**. **No sandbox run.**

**The local tier makes a hot key cheap by making it old, and the work is in deciding how old: the
TTL is a staleness contract with the business, the admission rule decides what earns a place in
the tier, and invalidation is the part that does not reach it.** [06](06-hot-keys-and-skew.md)
built the L1; this chunk is its cost sheet.

## The price: the L1 TTL is a staleness window you chose

Everything the L1 saves, it charges for in freshness. If a product's price changes and the
authoritative cache is updated at once, an instance's L1 can still serve the old price for up to
its TTL. With a one-second TTL that is up to one second of stale reads **per instance**, and
instances expire at different moments, so for that second different users see different values.

- For **catalogue copy, images, descriptions** this is invisible and the TTL could be longer.
- For a **displayed stock figure** during a sale it is visible: a customer sees "3 left" for a
  second after it is gone. This is acceptable only if the *purchase* is verified against the
  source of truth — see **What not to cache** *(not written yet)* for the pattern (cache the
  read, verify on the write), and the worked example in
  [06e](06e-detecting-skew-and-the-flash-sale-plan.md).
- For **anything money-shaped or permission-shaped**, do not put it in an L1 at all.

### Invalidation reaches the L1 last

A purge or update that hits the L2 does **not** reach the L1s: they are per-process and have no
subscription unless you build one. Two designs, in order of cost:

1. **TTL only.** Bound the staleness by the TTL and accept it. Simplest; the right default for a
   one-second L1.
2. **Broadcast invalidation.** Publish an event on a bus when a hot key changes and have every
   instance drop it. This shrinks the window to the bus latency but adds a moving part whose
   failure (a dropped message) silently reverts to TTL-only. It never replaces the TTL; it
   shortens the common case.

Cross-region invalidation of the same kind is **Cache coherence across regions** *(not
written yet)*.

## What the L1 does *not* fix

- **Write-hot keys.** A counter incremented on every order cannot be served from a local read
  cache; the writes still go to one node. That needs a different shape — [06d](06d-write-hot-keys-and-sharded-stock.md).
- **Cold-start of an instance.** A freshly started instance has an empty L1 and sends the hot
  key to the L2 at full rate until warm; a deploy that restarts the whole fleet at once is a
  synchronised miss. Roll deploys and let instances warm, or pre-load the known hot set.
- **Hot keys the L1 is too small to hold.** If the "hot set" is thousands of keys, the L1
  becomes a general cache and its memory is the cost. The L1 is for a *short list*.
- **Per-user data.** Putting per-user entries in an L1 spends memory on keys that one instance
  will see once. Only shared, popular keys belong.

## Choosing the TTL: a worked derivation

Define `I` instances, an L1 TTL of `T` seconds and a hot key requested at user rate `U` per
second across the fleet. Two quantities fall out, and they pull in opposite directions:

| Quantity | Formula | Moves with `T` |
|---|---|---|
| L2 load for the hot key | about `I / T` requests per second (each instance refreshes once per TTL) | falls as `T` grows |
| Worst-case staleness a reader can see | about `T` (plus the L2's own lag) | grows as `T` grows |

`U` appears in neither: that is the entire point of the pattern. The decision procedure is
therefore backwards from how people usually tune a cache — start from the **tolerable
staleness** `S` for that key class, set `T ≤ S`, and *then* read off the L2 load `I / T` and ask
whether the owning node can bear it. If it cannot, the answer is not a longer `T` (the business
said no) but another defence: replication ([06c](06c-key-replication-and-request-splitting.md))
shares that load across nodes.

Refresh-behind changes the reader's experience but not the arithmetic: with a refresh window the
reader never waits, yet the value is still as old as one refresh interval, so `S` must cover
`T` plus the refresh lag.

## Admission: let only proven-hot keys in

An L1 that admits every key spends memory on the long tail. The admission rule is a small
counter in front: count requests per key over a short window and admit a key to the L1 only
above a threshold.

```js
// per-process, per-window request counter for L1 admission
let window = new Map(), windowStart = Date.now();
const WINDOW_MS = 1_000, ADMIT_AT = 20;       // thresholds are tuning knobs, not recommendations

export function shouldAdmit(key) {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) { window = new Map(); windowStart = now; }
  const n = (window.get(key) ?? 0) + 1;
  window.set(key, n);
  return n >= ADMIT_AT;
}
```

Two cautions. The counter map is itself unbounded within a window, so under a scan of unique
keys it grows — cap it or use a fixed-size probabilistic counter. And the thresholds are per
process: with `I` instances each sees roughly `1/I` of a key's traffic, so a key hot fleet-wide
can be below threshold on every instance. The same idea, done well and with decay, is what
admission-aware caches build in; Caffeine's W-TinyLFU is described in the Eviction chunk
(**Eviction policies** *(not written yet)*) and this page states no benefit figure for it,
because its documentation gives none.

## What the HTTP analogy buys you

The protocol-level counterpart of refresh-behind is stale-while-revalidate, whose permission
and bound read:

> *"caches MAY serve the response in which it appears after it becomes stale, up to the indicated number of seconds."*

> *"If delta-seconds passes without the cached entity being revalidated, it SHOULD NOT continue to be served stale, absent other information."*

The L1 has the same two numbers — how long it may serve fresh, and how long it may serve stale
while a refresh is in flight — and the same duty to stop serving once the second one passes. If
the refresh fails (the L2 is down), decide in advance whether the L1 serves stale until the bound
or fails; the RFC's `stale-if-error` is the same decision made at the HTTP layer.

## Gotchas

**★ Symptom: after adding an L1, a flash-sale price change takes a visible second to appear and
different users see different prices.** Cause: the L1 TTL is a per-instance staleness window and
instances expire at different moments. Fix: choose the TTL from what the business tolerates for
that key, shorten it for price and stock (or exclude them), add broadcast invalidation only to
narrow the common case, and never rely on the L1 for correctness of a price at checkout —
re-read the authoritative price on the write.

**★ Symptom: the L1 itself becomes a memory problem or an eviction storm.** Cause: it was
unbounded, or sized as a mini-L2 holding keys that are not hot. Fix: bound by entry count (and
by weight if values vary), admit only keys that have proven popular — a request counter in front
of the L1 is a common way — and keep the TTL short enough that the bound rarely bites.

**Symptom: the L1 survives a purge.** Cause: the purge reached the L2 only. Fix: treat the L1
TTL as the guarantee, and document it next to the purge procedure so no one expects instant
disappearance.

**★ Symptom: during a sale, the L1 serves a stale price after an update and nobody notices until
a customer is charged a different amount.** Cause: the price was read from the L1 at render time
and reused at checkout. Fix: the checkout path reads the authoritative price in the same
transaction as the order write; the L1 serves *display* only.

**Symptom: the admission counter map is the largest object in the heap during a scan.**
Cause: a counter entry per distinct key within the window, and a crawler or enumeration produces
millions of distinct keys. Fix: bound the map, or use a fixed-size sketch, and reset it each
window.

**Symptom: a key that is hot fleet-wide is never admitted to any L1.** Cause: the threshold is
per instance; with many instances each sees a fraction of the key's rate and stays below it.
Fix: set the threshold from the per-instance share (`U / I`), or admit on a fleet-level signal
distributed by a hot-key list ([06e](06e-detecting-skew-and-the-flash-sale-plan.md)).

## Interview questions

**★ How would you tune the L1 TTL?**
From the business tolerance for staleness *per key class*, not from the load: the smaller the
TTL the less staleness and the more L2 load (`instances / TTL`), so choose the largest TTL the
data can tolerate. Add jitter to avoid synchronised expiry and refresh-behind so readers do not
block on reloads. Different key classes get different TTLs, or none.

**Where does the L1 get invalidated, and what can go wrong?**
Nowhere by default: an update that purges or rewrites the L2 entry does not touch other
processes' memory. The guarantee is the TTL. If the TTL is too coarse for a key, add a bus
message to drop it from every instance; the failure mode is a lost message, which silently
degrades to TTL-only, so the TTL stays authoritative and the broadcast only narrows the common
case. Never design a correctness requirement on the broadcast alone.

**Derive the staleness-versus-load trade-off for an L1.**
With `I` instances and TTL `T`, the L2 sees about `I / T` loads of the hot key per second
regardless of user rate, and a reader can see a value up to about `T` old. So choose `T` from the
tolerable staleness first, then check `I / T` against the owner's capacity; if the load is too
high, add replication rather than lengthening `T`.

{/* FOOTER */}
