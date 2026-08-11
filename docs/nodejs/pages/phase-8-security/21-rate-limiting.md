---
title: "Rate limiting and brute-force protection"
sidebar_label: "21 · Rate limiting"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** with **Redis 7** on `:6399` — every output below
> is from `sandbox/p8-security/ex20-rate-limiting.mjs`.

Rate limiting is the control that makes several other pages' defences work. A timing
attack needs thousands of samples ([page 16](./16-timing-attacks.md)); credential stuffing
needs millions of guesses ([page 01](./01-password-storage.md)); a ReDoS pattern needs to
be sent repeatedly ([page 14](./14-redos.md)). **Take the volume away and the attack stops
being practical.**

Three decisions: which algorithm, what key, and where the counter lives. Only the third
one is usually thought about.

## The algorithm decides your worst case

**Fixed window** — a counter per `floor(now / window)` — is the one everybody writes
first, and it permits double the limit across a boundary:

```console
limit 5/s, 10 requests spanning 80 ms across a window edge -> allowed 10
```

Five at the end of one second, five at the start of the next. The stated limit was 5/s
and 10 arrived inside 80 ms. For a login endpoint that is the difference between a
defence and a speed bump.

**Sliding window** — keep the timestamps, drop what fell out — has no boundary:

```console
same traffic, sliding window -> allowed 5
```

**Token bucket** allows a burst *deliberately*, which is what a public API usually wants:

```console
15 requests in the same millisecond -> allowed 10   (the bucket)
then 10 requests over 2 s           -> allowed 10   (the refill rate)
```

Sustained rate and burst size are separate knobs. Clients that batch on a cron get to
spend their bucket without being punished for it.

Pick by endpoint: token bucket for a general API, sliding window for login and password
reset, and fixed window only where the doubling genuinely does not matter.

## Where the counter lives

An in-memory `Map` has two failure modes, and both are measurable.

**It is per-process:**

```console
limit 10/window per process, 4 processes -> effective limit 40
```

Under `cluster` or four containers, your limit is silently multiplied by the worker count,
and it moves whenever you scale.

**It grows without bound:**

```console
200k distinct keys -> 31.2 MB retained
```

An attacker rotating source addresses inserts a key per request, and a bare `Map` never
evicts. In-memory limiting needs an LRU with a hard cap, at which point you are
implementing a cache — or you use Redis, which already expires keys.

The Redis version is `INCR` plus an expiry, and the naive two-command form has a real
race:

```console
after first INCR, ttl -> 60 s
orphaned key ttl      -> -1  (no expiry — that key blocks the caller forever)
```

If the process dies between `INCR` and `EXPIRE`, the key has no TTL and that client is
limited permanently. Do it in one atomic step:

```lua
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { n, redis.call('PTTL', KEYS[1]) }
```

```console
atomic script -> count 1  ttl 60000 ms   (one round trip, no window)
```

**The check is not free**, and the shape of your I/O matters more than the limiter:

```console
2000 sequential checks -> 430.4 ms = 0.215 ms each
2000 pipelined         ->  43.5 ms = 0.022 ms each
```

0.2 ms on every request, in front of a handler that may itself take 5 ms, is a 4% tax you
should know you are paying — and a reason the limiter must not be a second round trip
when the first one already went to the same Redis.

## Fail open or fail closed

When Redis is unreachable the limiter throws:

```console
limiter call after Redis is gone -> ClientClosedError: The client is closed
```

There is no default answer, only an explicit one:

- **Fail open** — allow the request. The service stays up and unprotected. Right for a
  general read API where the limiter is about fairness.
- **Fail closed** — 503. The service is protected and unavailable. Right for login,
  payment and anything where an unlimited attempt rate is worse than downtime.

Whichever you choose, **log it loudly**. A limiter that silently fails open is
indistinguishable from one that works, right up until the bill arrives.

## The key is the whole design

A limiter is only as good as what it counts:

```console
no header      -> {"socket":"::ffff:127.0.0.1","xff":null}
spoofed header -> {"socket":"::ffff:127.0.0.1","xff":"1.2.3.4","firstHop":"1.2.3.4"}
```

The client set `X-Forwarded-For` itself. Keying on it directly gives an attacker a fresh
bucket per request — a limiter that counts nothing. The rule is the same as
[page 19](./19-https-hsts-cookies.md)'s: the header is meaningful only when a proxy you
control overwrites it and the origin is not directly reachable. Count from the right of
the chain, not the left, and know how many hops you actually have
([phase 11, page 06](../phase-11-deployment/06-reverse-proxy.md)).

Beyond the address:

- **IP alone punishes shared networks.** An office, a university or a mobile carrier NAT
  is thousands of users behind one address.
- **Authenticated requests should key on the user or API key**, which is stable and
  meaningful.
- **Login endpoints need two keys at once**: per-IP catches one host guessing many
  accounts, per-account catches many hosts guessing one. Neither alone catches both.

## Brute force is a different problem from rate limiting

Rate limiting protects the service. Brute-force protection protects an *account*, and the
obvious version is an attack in itself:

```console
attacker made 5 wrong guesses, then the real user logs in -> LOCKED
```

A hard lockout lets anyone lock any account whose email they know. What works instead:

- **Exponential delay per account** rather than a lock — 1 s, 2 s, 4 s. Painful for a
  script, invisible to a human who mistyped ([phase 7, page 15](../phase-7-background-work/15-backoff-and-jitter.md)).
- **A CAPTCHA or step-up after N failures**, not a wall.
- **Password hashing is itself a limiter** — scrypt caps you near 23 logins/sec per
  process ([page 01](./01-password-storage.md)). That is a floor on the attacker's rate
  and a ceiling on yours, which is why the rate limit must sit *in front* of the hash, not
  behind it.
- **Count failures, reset on success**, and never reveal the count to the caller.

## Answer with headers a client can act on

```console
status 429 -> {"retry-after":"30","ratelimit-limit":"100",
               "ratelimit-remaining":"0","ratelimit-reset":"30"}
```

`Retry-After` is the one that matters: without it a well-behaved client retries
immediately and becomes the load it was throttled for. Send `RateLimit-*` on successful
responses too, so clients can pace themselves before they hit the wall. And return **429**,
not 403 — the difference tells a client whether to wait or to stop.

## Gotchas

**Symptom:** Twice the configured limit gets through in a burst
**Cause:** Fixed window — five at the end of one window and five at the start of the next. Verified: 10 in 80 ms against a 5/s limit.
**Fix:** Sliding window or token bucket for anything security-relevant.

**Symptom:** The limit is much higher in production than in testing
**Cause:** In-memory counters are per process — measured, four workers gave an effective limit of 40 instead of 10.
**Fix:** A shared store, or accept and document `limit ÷ workers` as the per-process value.

**Symptom:** Memory climbs steadily under attack
**Cause:** A bare `Map` keyed by IP with no eviction — 200k keys held 31.2 MB.
**Fix:** Redis with TTLs, or an LRU with a hard cap.

**Symptom:** One client is limited forever and its counter never resets
**Cause:** `INCR` succeeded and `EXPIRE` did not — the key has ttl `-1`. Verified.
**Fix:** One atomic Lua script, or `SET key 0 EX n NX` before incrementing.

**Symptom:** The limiter has no effect on the actual attack
**Cause:** Keyed on a client-settable `X-Forwarded-For`, so every request lands in a new bucket.
**Fix:** Use the socket address, or the proxy-set hop you can trust; never the leftmost value a client supplies.

**Symptom:** Users report being locked out of accounts they never tried to access
**Cause:** Hard lockout after N failures — an anonymous attacker can lock any known email.
**Fix:** Exponential per-account delay and step-up challenges, not a lock.

**Symptom:** Rate limiting stopped working and nobody noticed
**Cause:** The store became unreachable and the limiter failed open silently.
**Fix:** Decide open or closed per endpoint, and alert on the limiter's own error rate.

## Interview questions

**★ Why is a fixed window a poor choice for a login endpoint?**
Because the boundary permits double the limit. Measured: a 5/s limit allowed 10 requests
inside 80 ms, five either side of the edge. A sliding window over the same traffic allowed
exactly 5.

**★ Where should the counter live?**
Not in process memory, for two measured reasons: with four workers the effective limit was
40 rather than 10, and 200 000 distinct keys retained 31.2 MB with no eviction. Redis with
a TTL solves both — at about 0.2 ms per check.

**★ What is the race in `INCR` then `EXPIRE`?**
If the process dies between them the key has no TTL — verified, ttl `-1` — and that client
is limited permanently. Make it atomic with a Lua script that sets the expiry only when
the counter is 1.

**★ How do you key a rate limiter behind a load balancer?**
Not on the raw `X-Forwarded-For` — a client can set it and get a fresh bucket per request,
verified. Use the socket address when you terminate directly, or the hop your proxy
overwrites, counting from the right of the chain. For authenticated traffic, key on the
user or API key instead.

**★ What is wrong with locking an account after five failed logins?**
It hands anyone a denial-of-service against any account they can name — verified, the real
user was locked out by the attacker's five guesses. Use exponential per-account delay and
a step-up challenge, and keep the per-IP limit for the other half of the problem.

**Should the limiter fail open or fail closed?**
It depends on the endpoint, and it must be a decision. Open keeps a read API available
while unprotected; closed keeps login protected while unavailable. What is never
acceptable is failing open silently — alert on the limiter's own errors.

**Which headers should a 429 carry?**
`Retry-After` above all, or a compliant client retries immediately and becomes the load.
`RateLimit-Limit`, `-Remaining` and `-Reset` on normal responses let clients pace
themselves. Use 429, not 403 — it tells the client to wait rather than to give up.

---

← Prev: [`node:crypto`](./20-node-crypto.md) · Next → [Security headers and CSP](./22-security-headers.md)
