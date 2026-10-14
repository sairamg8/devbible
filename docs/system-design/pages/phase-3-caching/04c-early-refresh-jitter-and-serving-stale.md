---
title: "The defences that act before the miss are to refresh an entry while it is still being served, to make each reader's idea of when to refresh a little different, to spread expiries apart, and to let a stale copy be served while one request fetches the new one"
sidebar_label: "04c · Early refresh, jitter and serving stale"
sidebar_position: 4.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html) §3–§4 and the MDN
> [`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
> page, both through the phase-3 research bank (fetched 2026-09-08, not re-fetched). Probabilistic early
> expiration is **mathematics shown with its derivation**; its published name and its parameter `β` are
> recalled from the literature (Vattani, Chierichetti and Lowenstein, VLDB 2015) and the paper was
> **not fetched** — treat the attribution as unconfirmed. TTL jitter and logical expiry are common
> practice stated as mechanism. Continues [04b](04b-the-distributed-lock-and-its-limits.md).
> **No sandbox run.**

**Coalescing and locks both wait for the miss; the better defence is that there is never a miss on
a hot key — the entry is refreshed while it is still being served, by one request, before anyone
needs the fresh copy.** Four mechanisms get there, each fixing a gap the others leave: a *logical*
expiry earlier than the physical one so a refresh can happen behind live traffic; *probabilistic*
early expiration so the readers themselves decide when without a scheduler; *jitter* so many keys do
not share a deadline; and *serve-stale* as the protocol-level version of the same idea.

## Logical expiry: the entry outlives its freshness

Store two lifetimes. The **physical** TTL (what Redis enforces) is long; the **logical** expiry is
a timestamp inside the value, earlier than the physical one. A reader that finds an entry past its
logical expiry still *returns it* — and, if it wins a single-flight or a lock, starts a refresh in
the background. The key never disappears, so there is no empty window.

```js
// value stored as JSON: { v: <payload>, fresh_until: <epoch ms> }
async function getSwr(key, load, { fresh = 60_000, grace = 600_000 } = {}) {
  const raw = await redis.get(key);
  if (raw !== null) {
    const e = JSON.parse(raw);
    if (Date.now() < e.fresh_until) return e.v;          // fresh: done
    refreshInBackground(key, load, fresh, grace);         // stale: refresh behind it
    return e.v;                                           // ...and serve the old copy now
  }
  return refreshNow(key, load, fresh, grace);             // truly absent: coalesced load
}

function refreshInBackground(key, load, fresh, grace) {
  singleFlight(`refresh:${key}`, () => refreshNow(key, load, fresh, grace))
    .catch((err) => log.warn({ key, err }, 'background refresh failed'));
}

async function refreshNow(key, load, fresh, grace) {
  const v = await load();
  const e = { v, fresh_until: Date.now() + fresh };
  await redis.set(key, JSON.stringify(e), 'PX', fresh + grace);
  return v;
}
```

The physical TTL is `fresh + grace`: the grace window is how long a stale copy may be served if
every refresh keeps failing. After it, the key is gone and the cold-miss path (coalesced, from
[04](04-stampede-and-thundering-herd.md)) takes over. Per-instance `singleFlight` here bounds
refreshes to one per instance; add the lock of [04b](04b-the-distributed-lock-and-its-limits.md) if
`N` refreshes is still too many.

On the JVM this is a library feature rather than code to write: Caffeine offers refresh-after-write
(the old value is served while a reload runs asynchronously) and Spring's cache abstraction can sit
on top of it. Both are named from general knowledge and were **not fetched** — confirm the exact
semantics of the version you run, in particular what a reload that fails does to the stored value.

## Probabilistic early expiration

A scheduled refresher needs infrastructure and refreshes keys nobody is reading. The alternative is
to make the *readers* decide, independently and with no coordination, so that as expiry approaches
some request volunteers to recompute early. The rule (the "XFetch" formulation) is:

```
recompute if   now − δ · β · ln(U)  ≥  expiry          U uniform in (0, 1]
```

where `δ` is how long the last recomputation took (stored with the value), `β ≥ 0` is a tuning
knob (1 is the neutral choice; larger refreshes earlier), and `expiry` is the entry's expiry time.

**Why it works — the derivation.** `ln(U)` is negative, so `−δ·β·ln(U)` is a positive random lead
time `L`. The rule says: recompute when `now + L ≥ expiry`, i.e. when the time remaining `g =
expiry − now` is at most `L`. Since `−ln(U)` is exponentially distributed with mean 1, `L` is
exponential with mean `δβ`, so the probability that one particular read triggers a recompute when
`g` seconds remain is

```
P(L ≥ g) = exp(−g / (δ·β))
```

That is the whole mechanism. Far from expiry (`g` much larger than `δβ`) the probability is
negligible and nobody pays; as `g` shrinks it rises smoothly toward 1. Three properties follow
directly: the scale of the early window is set by `δ` — a slow recomputation (large `δ`) starts earlier,
which is exactly right because it needs more head start; a hotter key (more reads per second) gets more
draws, so a trigger is *almost certain* to occur before expiry; and no clock, scheduler or shared
state is needed beyond the stored `δ` and expiry.

```js
async function getXfetch(key, load, { ttlMs = 300_000, beta = 1 } = {}) {
  const raw = await redis.get(key);
  if (raw !== null) {
    const e = JSON.parse(raw);                   // { v, delta, expiry }
    const early = -e.delta * beta * Math.log(1 - Math.random());   // 1 - U avoids log(0)
    if (Date.now() + early < e.expiry) return e.v;                 // not yet: serve
  }
  const t0 = Date.now();
  const v = await singleFlight(key, () => load());
  const delta = Date.now() - t0;
  await redis.set(key, JSON.stringify({ v, delta, expiry: Date.now() + ttlMs }),
                  'PX', ttlMs);
  return v;
}
```

What it does not do: it does not *guarantee* a single recomputer — two readers can both draw a
trigger in the same instant — so it is paired with single-flight. It does nothing for a cold start
(no entry, no `δ`). And it helps only keys read often enough to draw before expiry: a key read once
a minute will usually simply expire.

## TTL jitter

Jitter attacks the other trigger — keys written together expiring together. Instead of
`SET key v EX 300` for every key in a bulk load, write `EX 300 + rand(−j, +j)`:

```js
const jittered = (base, spread = 0.1) =>
  Math.round(base * (1 + (Math.random() * 2 - 1) * spread));
await redis.set(key, value, 'EX', jittered(300));
```

The expiries of `K` keys loaded at once are now spread across a window of `2·j` rather than
landing on one instant, so the origin sees a gentle rise instead of a step. Know the limits: jitter
does **nothing** for one hot key (a single key has a single deadline), it widens the maximum
staleness by `j`, and a *deterministic* offset (hash of the key mod something) works too but
re-synchronises if the base TTL is ever changed for everything at once. Random per write is the
simplest correct form.

## Serving stale as a protocol feature

The same idea exists in HTTP, and RFC 5861 specifies it. For `stale-while-revalidate`:

> *"stale-while-revalidate = "stale-while-revalidate" "=" delta-seconds"*

> *"caches MAY serve the response in which it appears after it becomes stale, up to the indicated number of seconds."*

> *"If delta-seconds passes without the cached entity being revalidated, it SHOULD NOT continue to be served stale, absent other information."*

MDN states the effect: *"Revalidation will make the cache be fresh again, so it appears to clients
that it was always fresh during that period — effectively hiding the latency penalty of
revalidation from them."* The cache serves the stale copy and refreshes behind it, so no user waits
on the origin and only one request goes back — the logical-expiry pattern above, defined for HTTP
caches. `stale-if-error` is its failure-mode sibling:

> *"when an error is encountered, a cached stale response MAY be used to satisfy the request, regardless of other freshness information."*

Note the words the RFC chose: `MAY` and `SHOULD NOT`. A cache is *permitted* to serve stale; it is
not required to, and a CDN that does not implement the extension ignores it. The phase-2 [CDN
page](../phase-2-request-path/05-cdns.md) covers what the edge does with a response; the full
`Cache-Control` semantics belong to the **HTTP caching semantics** page *(not written yet)*.

## Overwrite, don't delete, a hot key

Invalidating by `DEL` is itself a stampede trigger: it opens the empty window at a moment the writer
picks. For hot keys, write the new value over the old (the key never disappears) or mark it
logically stale and let the refresh path above repopulate it. Reserve delete-on-write for keys that
are not hot; the correctness side of invalidation is the **invalidation** page *(not written yet)*.

## Gotchas

**★ Symptom: deleting the key on write causes the stampede it was meant to prevent.**
Cause: invalidating a hot key by `DEL` creates exactly the empty-entry window this page is about,
at a moment of the writer's choosing, with `r` still at its peak. Fix: for hot keys, overwrite
rather than delete (write the new value), or refresh in the background — see
[04b](04c-early-refresh-jitter-and-serving-stale.md) — and keep delete-on-write for cold keys.


**★ Symptom: stale data is served for days and nobody noticed.**
Cause: a background refresh that fails is swallowed (`.catch` logs and returns the old value), the
grace window keeps the entry alive, and the system is "working". Fix: record the age of the served
copy as a metric and alert when it exceeds `fresh` by a multiple; a refresh failure rate is an SLO.

**★ Symptom: the background refresher hammers the database for keys no one reads.**
Cause: a scheduler that refreshes every key on a timer, regardless of demand, so refresh load scales
with the keyspace instead of with traffic. Fix: refresh *on read* (logical expiry or XFetch), so only
keys that are asked for are refreshed; if you must schedule, schedule only a known hot list.

**★ Symptom: logical expiry behaves differently on different instances.**
Cause: `fresh_until` is compared against each instance's local clock; skew between instances makes
one treat an entry as fresh while another refreshes it, and clock steps cause bursts. Fix: derive
freshness from a clock all instances agree on well enough for your `fresh` window (the stored
timestamp plus tolerance), and keep `fresh` far larger than any plausible skew.

**Symptom: early expiration "isn't helping" a key read a few times an hour.**
Cause: XFetch only triggers on reads; with few reads there is nothing to draw the early trigger and
the key expires normally. Fix: it is a defence for hot keys; cold keys do not herd.

**Symptom: raising `β` made the database busier.**
Cause: larger `β` recomputes earlier, so each cycle wastes more of the remaining TTL and the
recompute rate per key rises. Fix: treat `β` as the price of safety; leave at 1 until measurement
says otherwise.

**Symptom: `stale-while-revalidate` was added and the origin still sees a burst.**
Cause: the extension is a permission (`MAY`), implemented per cache; some tiers ignore it, and the
browser's private cache and the CDN each honour it independently, so the origin may see one
revalidation per tier. Fix: verify per layer which one honours it, and keep an application-level
refresh behind the HTTP layer.

**Symptom: jitter was added but the herd on the hot key is unchanged.**
Cause: jitter spreads *different* keys apart; a single key has a single deadline. Fix: use logical
expiry or XFetch for hot keys, and keep jitter for bulk-written keys.

## Interview questions

**Why does a delete-then-reload on a hot key cause trouble, and what do you do instead?**
`DEL` opens the miss window at the exact moment of the write, so a write to a hot key is a self-inflicted
expiry. Overwrite the value with the fresh one (or enqueue a background refresh and keep serving the
old value meanwhile) — the entry never disappears. Deleting is fine for keys that are not hot, and
for the correctness of invalidation more generally see the **invalidation** page *(not written yet)*.


**★ Derive probabilistic early expiration and say what each term does.**
Each read draws a random lead time `L = −δ·β·ln(U)`, exponentially distributed with mean `δβ`, and
recomputes if `now + L ≥ expiry`. The chance a given read triggers when `g` seconds remain is
`exp(−g/(δβ))`: negligible far from expiry, near 1 at expiry. `δ`, the last recompute duration,
makes slow recomputations start earlier; `β` scales aggressiveness. Because every read draws, a
frequently read key is all but certain to refresh before it expires, with no scheduler or
coordination. It needs `δ` stored with the value, and it is paired with single-flight because two
reads can still trigger in the same instant.

**★ When do you use jitter, when early expiration, and when serve-stale?**
They answer different triggers. Jitter breaks synchronised expiry across many keys and does nothing
for one hot key. Early expiration or logical expiry removes the empty window on a hot key by
refreshing before the deadline. Serve-stale (HTTP `stale-while-revalidate` or its application
equivalent) removes the *wait* by returning the old copy while one request refreshes, and
`stale-if-error` extends that to origin failure. A mature design layers all three.

**What does `stale-while-revalidate` actually permit, and what does it not?**
RFC 5861: caches *"MAY serve the response in which it appears after it becomes stale, up to the
indicated number of seconds"*, and after that window it *"SHOULD NOT continue to be served stale"*.
It is permission, not a command; a cache that does not implement it simply revalidates in the
normal way, and nothing in it limits how many tiers may each revalidate independently.

**Why not just set a very long TTL and invalidate on change?**
A long TTL removes expiry herds but moves the problem to invalidation: every write path must know
every key it affects, and a missed one is stale until the long TTL runs out. It is a valid
strategy where invalidation is reliable (versioned keys, event-driven) — see the **invalidation**
page *(not written yet)* — but it is not a stampede defence by itself, because the delete that
invalidation performs reopens the empty window.

**How do you stop a background refresh from running forever on a key nobody reads?**
Refresh only on read: a logical-expiry or XFetch design refreshes when a request finds the entry
near or past its deadline, so unread keys simply expire. A timer-driven refresher must be limited
to an explicit hot list and given a stop condition (no read since the last refresh).

{/* FOOTER */}
