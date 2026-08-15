---
title: "15.1 · The token bucket"
sidebar_label: "01 · The token bucket"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties). Documentation-validated; **no timings, nothing was run**.

**A rate limiter answers two questions: *may I do this now*, and if not, *when*.** The second
one is what separates a useful limiter from a boolean, and it is what an interviewer is
listening for.

The token bucket is the default answer because it has **two independent knobs**: a *rate* (how
fast permission accrues) and a *capacity* (how much unused permission can be banked). That pair
is what lets an idle user fire a short burst and still holds everyone to the long-run rate.

## The implementation

```js
class TokenBucket {
  #tokens;
  #last;

  constructor({ capacity, perSecond, now = () => performance.now() }) {
    this.capacity = capacity;
    this.ratePerMs = perSecond / 1000;
    this.now = now;
    this.#tokens = capacity;
    this.#last = now();
  }

  #refill() {
    const t = this.now();
    this.#tokens = Math.min(this.capacity, this.#tokens + (t - this.#last) * this.ratePerMs);
    this.#last = t;
  }

  tryTake(cost = 1) {                 // may I? — synchronous, never blocks
    this.#refill();
    if (this.#tokens < cost) return false;
    this.#tokens -= cost;
    return true;
  }

  msUntil(cost = 1) {                 // if not, when?
    this.#refill();
    return this.#tokens >= cost ? 0 : Math.ceil((cost - this.#tokens) / this.ratePerMs);
  }
}
```

Roughly twenty lines, and five of them are decisions.

## 1 · No interval — refill lazily, from elapsed time

The first instinct is `setInterval(() => tokens++, 1000 / rate)`. It is wrong in four ways at
once, and rejecting it is most of the answer:

- **It never stops.** A timer keeps the limiter, its closure and everything it captures alive for
  the lifetime of the page or process, whether or not anyone is using it.
- **It is throttled when nobody is looking.** Background tabs throttle timers, so the bucket
  refills more slowly than configured exactly when the user is not there to notice
  ([Phase 12 · 03 · Timers](../../phase-12-browser-platform/03-timers-and-frames/01-timers.md)).
- **It quantises.** Permission arrives in lumps at tick boundaries instead of continuously.
- **It scales badly.** One timer per bucket, and a per-user limiter has as many buckets as users.

Computing the refill on read has none of those properties: it is exact to the millisecond, costs
nothing while idle, and needs no cleanup. **A limiter should hold no timer at all until somebody
actually waits.**

## 2 · `performance.now()`, not `Date.now()`

MDN is explicit about the difference: `performance.now()` is *"relative to the `timeOrigin`
property which is a monotonic clock: its current time never decreases and isn't subject to
adjustments."*

`Date.now()` is a wall clock, and wall clocks move sideways — an NTP correction, a user setting
the system time, a VM resuming from a snapshot. In this code an elapsed time that comes back
**negative** removes tokens from the bucket, and one that jumps forward hands out a windfall.
Neither failure is reproducible, which is the worst kind.

Two consequences worth knowing:

- ⚠️ **`performance.now()` is deliberately coarsened** — MDN gives *"Resolution in isolated
  contexts: 5 microseconds"* and *"Resolution in non-isolated contexts: 100 microseconds"*. Far
  finer than any rate limit cares about, but it is not an infinitely precise clock.
- **The `now` parameter is not decoration.** Injecting the clock is how a limiter gets tested at
  all — you advance a fake clock instead of sleeping, and a test suite that has to wait real
  seconds for a rate limiter is a test suite nobody runs.

## 3 · Capacity is the burst; the rate is the throughput

```js
new TokenBucket({ capacity: 10, perSecond: 2 });
```

Ten immediately, then two per second — and after twenty seconds idle, ten immediately again. The
`Math.min(this.capacity, …)` clamp is what stops idleness from banking unlimited credit; without
it, a tab left open overnight would wake up entitled to tens of thousands of requests.

Choosing the pair is the design question:

| Want | Capacity | Rate |
|---|---|---|
| Smooth, no bursts at all | `1` | the target rate |
| Interactive UI, bursty by nature | small multiple of the rate | the sustained budget |
| Batch work behind a quota | large | the quota ÷ its window |

📌 **Capacity `1` turns the token bucket into a leaky bucket** — perfectly even spacing, no burst.
The two algorithms are the same shape with a different clamp, which is worth saying out loud when
asked to compare them.

## 4 · Keep the tokens fractional

`this.#tokens` is a float on purpose. Rounding down on every refill discards the remainder each
time and quietly slows the limiter below its configured rate — the more often the bucket is read,
the slower it runs, which is a maddening bug to chase. Round only at the boundary, in `msUntil`,
and round **up** there so a wait is never one millisecond short.

## 5 · A cost per call, not just a count

`tryTake(cost)` makes the limiter weight-aware in one parameter: a batch of 20 items costs 20, an
upload can cost its size. The IETF's `RateLimit` header draft formalises the same idea with quota
units of requests, content-bytes and concurrent-requests — [15.2](./02-windows-and-the-server.md)
covers those headers.

⚠️ A cost greater than `capacity` can **never** be satisfied — `msUntil` returns a wait that
elapses and still fails. Validate it at construction or in `tryTake`, or a caller waits forever.

## Waiting properly

`tryTake` is the honest primitive, but most callers want *"give me a promise that settles when I
may go"*. The naive version is a trap:

```js
// ⛔ do not do this
async function take(bucket) {
  while (!bucket.tryTake()) await sleep(bucket.msUntil());
}
```

Every waiter wakes at the same instant, races for the same token, and all but one goes back to
sleep — a thundering herd whose cost grows with the number of waiters. Worse, the winner is
whichever timer the runtime fires first, so **there is no ordering at all**: a request can be
overtaken indefinitely while newer ones sail through.

One queue, one timer, drained in order:

```js
class RateLimiter {
  #queue = [];      // { cost, resolve, reject, signal, onAbort }
  #timer = null;

  constructor(options) { this.bucket = new TokenBucket(options); this.maxQueue = options.maxQueue ?? Infinity; }

  acquire(cost = 1, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (this.#queue.length === 0 && this.bucket.tryTake(cost)) return Promise.resolve();
    if (this.#queue.length >= this.maxQueue) return Promise.reject(new Error("Rate limiter queue is full"));

    return new Promise((resolve, reject) => {
      const entry = { cost, resolve, reject };
      entry.onAbort = () => {
        const i = this.#queue.indexOf(entry);          // ⚠️ -1 would splice the LAST entry
        if (i !== -1) this.#queue.splice(i, 1);
        reject(signal.reason);
      };
      signal?.addEventListener("abort", entry.onAbort, { once: true });
      entry.signal = signal;
      this.#queue.push(entry);
      this.#schedule();
    });
  }

  #schedule() {
    if (this.#timer !== null || this.#queue.length === 0) return;
    const wait = this.bucket.msUntil(this.#queue[0].cost);
    this.#timer = setTimeout(() => { this.#timer = null; this.#drain(); }, wait);
  }

  #drain() {
    while (this.#queue.length && this.bucket.tryTake(this.#queue[0].cost)) {
      const entry = this.#queue.shift();
      entry.signal?.removeEventListener("abort", entry.onAbort);
      entry.resolve();
    }
    this.#schedule();
  }
}
```

Four things in there are the reason it is written this way:

- 🔴 **`this.#queue.length === 0 &&` in the fast path.** Without it, a caller arriving while
  others wait can jump the queue the moment a token appears. That single condition is the
  difference between FIFO and a lottery.
- 🔴 **`maxQueue`.** An unbounded queue converts a rate problem into a memory problem: the
  arrival rate exceeds the drain rate by definition, so the queue only grows. Rejecting at a
  bound is a decision; not having one is an oversight.
- **One timer for the whole queue**, re-armed after each drain, so N waiters cost one timer rather
  than N.
- **Abort removes the entry and rejects with `signal.reason`**, and the listener is removed on
  the success path — otherwise a long-lived signal accumulates listeners for every request that
  ever waited.

⚠️ **Re-check after waking, never trust the timer.** `setTimeout` guarantees a *minimum* delay,
and the clamping and throttling rules mean it can be much longer; the `while` loop in `#drain`
re-asks the bucket instead of assuming a token is there.

## Gotchas

**Symptom:** The limiter allows a huge burst after the tab was in the background.
**Cause:** Tokens accrued for the whole idle period with no capacity clamp — or a wall-clock jump.
**Fix:** `Math.min(capacity, …)` on every refill, and a monotonic clock.

**Symptom:** The effective rate is slightly below the configured one, and worse under load.
**Cause:** Rounding tokens down on each refill throws away the remainder every call.
**Fix:** Keep tokens fractional; round only when converting to a wait, and round up.

**Symptom:** Requests complete out of order, and one occasionally never completes.
**Cause:** Every waiter has its own timer, so the winner is whichever timer fires first.
**Fix:** One FIFO queue with one timer, and refuse the fast path while anything is queued.

**Symptom:** Memory grows steadily under sustained load.
**Cause:** An unbounded wait queue — arrivals exceed the drain rate, so it can only grow.
**Fix:** A `maxQueue` bound that rejects, and remove abort listeners when an entry leaves.

**Symptom:** A call with a large cost hangs forever.
**Cause:** The cost exceeds the bucket's capacity, so the condition can never be met.
**Fix:** Reject a cost greater than `capacity` immediately.

**Symptom:** Tests take twenty seconds, or fail on a slow machine.
**Cause:** The limiter reads the clock directly.
**Fix:** Inject `now` and advance a fake clock; assert on `msUntil`, not on elapsed time.

## Interview questions

**★ Implement a rate limiter.**
A token bucket with lazy refill: store tokens and a last-updated timestamp, and on every read add
`elapsed × rate`, clamped to capacity. `tryTake` spends tokens if there are enough; `msUntil`
converts a shortfall into a wait. No interval timer anywhere.

**★ Why refill on read rather than on an interval?**
An interval keeps a timer alive forever, is throttled in background tabs, delivers permission in
lumps, and does not scale to one bucket per user. Elapsed-time arithmetic is exact and free when
idle.

**★ Which clock, and why does it matter?**
`performance.now()` — it is monotonic and unaffected by clock adjustments. A wall clock can jump
backwards, which makes elapsed time negative and the bucket's behaviour irreproducible.

**★ What do capacity and rate each control?**
Capacity is the maximum burst that can be banked while idle; the rate is the long-run throughput.
Capacity `1` removes bursting entirely, which is the leaky-bucket behaviour.

**★ How do you make callers wait fairly?**
One FIFO queue with a single timer, and no fast path while anything is queued — otherwise a new
arrival can take the token a waiter was queued for, and ordering is decided by timer callbacks.

**How does a caller cancel a queued request?**
An `AbortSignal`: on abort, splice the entry out of the queue and reject with `signal.reason`.
Remove the listener when the entry leaves the queue by any route.

**What stops the queue growing forever?**
Nothing, unless you add a bound. Sustained overload means arrivals outpace the drain rate, so
either reject past `maxQueue` or apply backpressure upstream.

---

[Topic index](./README.md) · Next → [Windows, and the server](./02-windows-and-the-server.md)
