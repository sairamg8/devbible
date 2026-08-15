---
title: "15.2 · Windows, and the server"
sidebar_label: "02 · Windows, and the server"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`429 Too Many Requests`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`Performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) — and the IETF Internet-Draft [RateLimit header fields for HTTP](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) (a **draft**, not a standard). Documentation-validated; **no timings, nothing was run**.

**The token bucket is one of five shapes**, and the other four are what an interviewer means by
"what else could you use". They differ on exactly two axes: how much they remember, and how badly
they behave at a window boundary.

## Fixed window — cheapest, and it lets through double

```js
class FixedWindow {
  #count = 0;
  #windowStart = 0;

  constructor({ limit, windowMs, now = () => performance.now() }) {
    Object.assign(this, { limit, windowMs, now });
  }

  tryTake() {
    const t = this.now();
    if (t - this.#windowStart >= this.windowMs) { this.#windowStart = t; this.#count = 0; }
    if (this.#count >= this.limit) return false;
    this.#count++;
    return true;
  }
}
```

Two numbers per key, and that is the whole appeal — a counter and a timestamp scale to millions of
users.

🔴 **The flaw is the boundary, and it is not theoretical.** With a limit of 100 per minute, a
client can send 100 in the last instant of one window and 100 in the first instant of the next:
**200 requests inside a two-instant span**, all of it perfectly legal by the rule as written. Any
attacker aligns to the boundary deliberately; ordinary clients hit it by accident whenever their
retry schedule happens to be periodic.

## Sliding window log — exact, and bounded if you are careful

Remember *when* each request happened, and count only those inside the trailing window:

```js
class SlidingLog {
  #ring;            // ring buffer of the last `limit` timestamps
  #i = 0;

  constructor({ limit, windowMs, now = () => performance.now() }) {
    Object.assign(this, { limit, windowMs, now });
    this.#ring = new Array(limit).fill(-Infinity);
  }

  tryTake() {
    const t = this.now();
    const oldest = this.#ring[this.#i];          // the limit-th most recent
    if (t - oldest < this.windowMs) return false;
    this.#ring[this.#i] = t;
    this.#i = (this.#i + 1) % this.limit;
    return true;
  }
}
```

**No boundary artefact at all** — the window moves with the request, so the rule "no more than
`limit` in any `windowMs`" holds at every instant rather than at every window edge.

The trick worth keeping is the **ring buffer**. A naive log pushes a timestamp per request and
trims the front on every call, which grows without bound if the trim is ever skipped and makes the
front-removal the thing you have to think about. But you never need more than `limit` timestamps:
the only question ever asked is *"was the `limit`-th most recent request longer ago than the
window?"* — one slot, one comparison, fixed memory.

⚠️ **It is still `limit` numbers per key.** A 10 000-per-hour limit across a million users is a
different proposition from two numbers each, which is exactly why the approximation below exists.

## Sliding window counter — the compromise most services run

Keep the fixed-window counters, but charge a share of the previous window in proportion to how
much of it is still inside the trailing window:

```js
const elapsed = (now - windowStart) / windowMs;                 // 0 → 1 through the window
const estimate = prevCount * (1 - elapsed) + currentCount;
const allowed  = estimate < limit;
```

Two counters and a timestamp — fixed-window memory — with the boundary burst smoothed away: right
after a boundary, `elapsed` is near zero, so almost the whole previous count still counts against
you.

📌 **It is an estimate, and the assumption is stated in the formula**: the previous window's
requests are treated as evenly spread. A client that front-loaded that window is charged for
traffic it has already left behind, and one that back-loaded it is undercharged. In exchange it
never allows the full 2× burst, and the memory does not grow with the limit.

## Choosing

| | Memory per key | Bursts | Exact? | Reach for it when |
|---|---|---|---|---|
| **Token bucket** | 2 numbers | **allowed, up to capacity** | yes | you want a burst allowance and a sustained rate as separate knobs — the usual client-side answer |
| **Leaky bucket** | 2 numbers | none — perfectly even | yes | a downstream that needs smooth arrivals; it is a token bucket with capacity 1 |
| **Fixed window** | 2 numbers | 🔴 up to **2×** at a boundary | no | quotas where the boundary is meaningful anyway ("1000 a day") |
| **Sliding log** | `limit` numbers | none | **yes** | small limits where exactness matters and you can afford the memory |
| **Sliding counter** | 3 numbers | small, bounded | approximate | high-volume services — the usual server-side answer |

## 🔴 A limiter in the browser is a courtesy, not a control

Everything above runs in the user's process, and **anything the browser computes the user can
change** — no DevTools skill required to call the endpoint directly with `curl`
([Phase 12 · 13 · What belongs on the server](../../phase-12-browser-platform/13-what-belongs-on-the-server/README.md)).
A client-side limiter cannot protect a server from anyone who does not want to be protected.

That does not make it pointless. Its real jobs are all on the client's own side of the wire:

- **Not spending a shared quota on work nobody asked for.** A third-party API key is usually one
  budget for the whole application, and the autocomplete box can drain it alone.
- **Turning a 429 storm into a queue.** Requests you never sent do not need to be retried.
- **Not melting the device.** Radio wake-ups and reflows both cost battery.
- **Being predictable to your own backend**, which makes its limiter's job easier.

⚠️ It is also **per tab**. Five tabs is five buckets and five times the rate; the same is true of
five server processes with in-memory limiters. Sharing the state means putting it somewhere both
sides can see — a coordination channel between tabs
(**Phase 12 · 15 · Cross-tab coordination** *(not written yet)*), or an atomic counter in a shared
store on the server. **A limiter's memory has the same scope as the process holding it**, and
saying so is half the answer to "how would you do this across a cluster".

## Reading the server's answer

The other half of a client rate limiter is obeying the server when it says no.

MDN on the status code: *"The HTTP `429 Too Many Requests` client error response status code
indicates the client has sent too many requests in a given amount of time"*, and *"A `Retry-After`
header may be included to this response to indicate how long a client should wait before making
the request again."*

`Retry-After` has **two syntaxes** — `Retry-After: <http-date>` and
`Retry-After: <delay-seconds>` — so a parser has to handle both:

```js
function retryAfterMs(res) {
  const value = res.headers.get("Retry-After");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);                       // HTTP-date form
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}
```

⚠️ The date form is compared against the **wall clock**, so a client whose clock is wrong computes
a wrong wait — clamp it to something sane rather than trusting an hour-long delay computed from a
skewed clock. (This is the one place `Date.now()` is correct: the header carries an absolute time,
not an interval.)

🔴 **A server's `Retry-After` outranks your own backoff schedule.** Retry no earlier than it says
— and still add jitter on top, or every client that received the same header returns at the same
millisecond and rebuilds the spike the limiter was there to prevent
([08 · Retry with backoff, jitter and an `AbortSignal`](../08-retry-backoff/README.md)).

MDN also notes how limits are usually keyed: *"Typically, rate-limiting restrictions are based on a
client's IP but can be specific to users or authorized applications if requests are authenticated
or contain a cookie."* Which key applies decides whether your per-user client-side bucket bears
any relationship to the server's.

## The `RateLimit` headers, and how much to trust them

There is an IETF **Internet-Draft** (not a standard) defining `RateLimit` and `RateLimit-Policy`
as structured fields — a policy advertising a quota `q` over a window `w`, and a `RateLimit`
carrying the remaining quota `r` and seconds until reset `t`:

```http
RateLimit-Policy: "burst";q=100;w=60,"daily";q=1000;w=86400
RateLimit: "default";r=50;t=30
```

It is genuinely useful — a client can pace itself instead of discovering the limit by being
refused. But the draft is explicit about the limits of that:

> *"Clients MUST NOT assume that a positive remaining value is a guarantee that further requests
> will be served"*, and the fields *"do not mandate any correlation between the RateLimit header
> field values and the returned status code."*

**So the headers are advice and 429 is the truth.** Use them to slow down early; never use them to
skip handling a rejection. And note that the widely deployed `X-RateLimit-Limit` /
`X-RateLimit-Remaining` family is **not** this draft and is not consistent between services —
seconds versus milliseconds, remaining versus used, absolute reset time versus a countdown. Read
each API's own documentation before parsing them.

## Gotchas

**Symptom:** Traffic arrives at twice the configured limit, in a spike, at regular intervals.
**Cause:** A fixed window — the last instant of one window and the first of the next are both legal.
**Fix:** A sliding window counter, or a token bucket, if the boundary is not itself meaningful.

**Symptom:** The limiter's memory grows with traffic, not with the number of users.
**Cause:** A sliding log that appends a timestamp per request and never trims.
**Fix:** A ring buffer of exactly `limit` slots — nothing older than the `limit`-th entry is ever
consulted.

**Symptom:** The effective rate is a multiple of what was configured.
**Cause:** One in-memory limiter per tab or per server process.
**Fix:** Shared state, or divide the budget by the instance count and accept the waste.

**Symptom:** A retry storm arrives the instant the server's `Retry-After` expires.
**Cause:** Every client honoured the same header exactly, with no jitter.
**Fix:** Wait at least `Retry-After`, then add a random offset.

**Symptom:** `Retry-After` produced an absurd wait, or none at all.
**Cause:** The header can be a date or a number of seconds, and the date form is measured against
a possibly wrong local clock.
**Fix:** Parse both forms and clamp the result to a sane maximum.

**Symptom:** The client stayed inside the advertised remaining quota and was still refused.
**Cause:** `RateLimit` values are advisory — the draft says a positive remaining value is not a
guarantee.
**Fix:** Treat 429 as the authority and keep the retry path even when the headers look fine.

## Interview questions

**★ What is wrong with a fixed-window counter?**
The boundary. A client can spend the whole limit at the end of one window and the whole limit at
the start of the next, so up to twice the limit passes in a moment — and it is easy to hit both
deliberately and by accident.

**★ How does a sliding window log fix it, and what does it cost?**
It counts requests in the trailing window rather than the current bucket, so the rule holds at
every instant. It costs one timestamp per allowed request — bounded by keeping exactly `limit` of
them in a ring buffer.

**★ Explain the sliding window counter approximation.**
Weight the previous window's count by the fraction of it still inside the trailing window and add
the current count: `prev × (1 − elapsed) + current`. Fixed memory, no 2× burst, and it assumes the
previous window's traffic was evenly spread.

**★ Is a client-side rate limiter a security control?**
No. It runs in the user's process and can be removed. It protects the user's quota, battery and
your own backend's health; the enforcing limiter has to be on the server.

**★ How do you respond to a 429?**
Wait at least as long as `Retry-After` says — handling both the seconds and HTTP-date forms — then
add jitter before retrying, and give up after a bounded number of attempts.

**How would you rate-limit across several servers or tabs?**
The state has to be shared, because an in-memory limiter's scope is its process. That means an
atomic counter in a shared store server-side, or a coordination channel between tabs — or dividing
the budget by the instance count and accepting the loss.

**Can you trust `RateLimit-Remaining`?**
As a hint. The IETF draft states clients must not assume a positive remaining value guarantees the
next request is served, and does not require the headers to agree with the status code.

---

← Prev [The token bucket](./01-the-token-bucket.md) · [Topic index](./README.md)
