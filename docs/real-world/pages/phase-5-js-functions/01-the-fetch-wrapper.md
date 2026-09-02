---
title: "The fetch wrapper"
sidebar_label: "01 · The fetch wrapper"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN (`fetch`, `AbortSignal.any`,
> `AbortSignal.timeout`) and the Phase 3 error contract. Concept home:
> [JS — retry with backoff](../../../javascript/pages/phase-17-machine-coding/08-retry-backoff/README.md)
> and [timeouts, retries, backoff and jitter](../../../javascript/pages/README.md)
> (phase 7's async pages); the server-side mirror is
> [Node's outbound client discipline](../../../nodejs/pages/phase-5-http-processes/08-outbound-client-discipline.md).

## The problem

[Chapter 4·01's `api`](../phase-4-react-ui/01-useasync-and-the-api-client.md)
is the contract-aware core. This chapter builds the resilience shell
around it: **timeouts** (every request bounded), **retries** (only where
safe, with backoff and jitter), and **in-flight deduplication** (the
badge and the drawer asking for the cart = one request). Each policy is
a wrapper function — composable, testable alone, and imported by the
core in one line each.

## The implementation

```js
// src/lib/fetch-policies.js — three orthogonal wrappers over plain fetch

/** 1 — timeout: compose the caller's signal with a deadline. */
export function withTimeout(fetchFn, {ms = 10_000} = {}) {
  return (url, init = {}) => {
    const signals = [AbortSignal.timeout(ms)];
    if (init.signal) signals.push(init.signal);
    return fetchFn(url, {...init, signal: AbortSignal.any(signals)});
  };
}

/** 2 — retry: transient failures only, safe methods only. */
export function withRetry(fetchFn, {
  attempts = 3, baseMs = 250, capMs = 4_000,
  retryOn = (res) => res.status === 502 || res.status === 503
                  || res.status === 429,
} = {}) {
  return async (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const idempotent = method === 'GET' || method === 'HEAD'
      || init.headers?.['idempotency-key'];           // ch. 3·07's carve-out
    let lastErr;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetchFn(url, init);
        if (!retryOn(res) || !idempotent || attempt === attempts) return res;
        await sleepFor(res, attempt, {baseMs, capMs}, init.signal);
      } catch (err) {
        if (err.name === 'AbortError' || !idempotent) throw err;
        lastErr = err;                                 // network error: retryable
        if (attempt === attempts) throw lastErr;
        await sleepFor(null, attempt, {baseMs, capMs}, init.signal);
      }
    }
  };
}

async function sleepFor(res, attempt, {baseMs, capMs}, signal) {
  // honour Retry-After (seconds or HTTP-date) before our own backoff
  const ra = res?.headers.get('retry-after');
  const raMs = ra == null ? null
    : /^\d+$/.test(ra) ? Number(ra) * 1000
    : Math.max(0, new Date(ra).getTime() - Date.now());
  const backoff = Math.min(capMs, baseMs * 2 ** (attempt - 1)) * Math.random();
  const ms = raMs ?? backoff;                          // full jitter (phase 7)
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(Object.assign(new Error('aborted'), {name: 'AbortError'}));
    }, {once: true});
  });
}

/** 3 — dedupe: concurrent GETs to one URL share one flight. */
export function withDedupe(fetchFn) {
  const inflight = new Map();                          // url -> Promise<Response>
  return (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' || init.signal) return fetchFn(url, init);
    if (!inflight.has(url)) {
      inflight.set(url, fetchFn(url, init)
        .finally(() => inflight.delete(url)));
    }
    // each awaiter gets a CLONE — a Response body reads once
    return inflight.get(url).then((res) => res.clone());
  };
}

// the assembled client fetch — order matters, see below
export const appFetch =
  withDedupe(withRetry(withTimeout(fetch.bind(globalThis))));
```

`api` (4·01) swaps `fetch` for `appFetch` — its own contract handling
(JSON, `ApiClientError`, the 401 broadcast) is unchanged above the shell.

## The decisions

- **Composition order is a policy statement.** Timeout innermost (each
  *attempt* gets the budget — a retried request deserves a fresh clock);
  retry in the middle; dedupe outermost (a deduped caller shares the
  *whole* retried, timed flight, not a single attempt). Reversing
  timeout and retry gives three attempts one shared 10 s — usually not
  what anyone means.
- **Retry eligibility is the load-bearing rule.** GET/HEAD retry freely;
  mutations retry **only** when an idempotency key says the server
  dedups ([the checkout design](../phase-3-express-api/07-the-checkout-endpoint.md)).
  A plain POST that timed out *may have succeeded* — retrying it
  unguarded is the double-submit bug in wrapper form. The
  [retry-safety concept](../../../nodejs/pages/phase-7-background-work/14-retry-safe-failures.md)
  is the same law server-side.
- **`Retry-After` is honoured in both spellings** — seconds and
  HTTP-date — before the app's own backoff. The server's 429s
  ([3·10](../phase-3-express-api/10-rate-limiting.md)) send it;
  a client that ignores it re-earns the limit.
- **Dedupe skips caller-signalled requests.** A shared flight with one
  awaiter's abort would kill everyone's response; callers who manage
  cancellation ([`useAsync`](../phase-4-react-ui/01-useasync-and-the-api-client.md)
  always does) opt out implicitly. The dedupe therefore serves the
  *unmanaged* callers — the badge, prefetches — which is exactly where
  duplicate flights come from.
- **`res.clone()` per awaiter** — a `Response` body is a stream, readable
  once; sharing without cloning hands the second reader an exhausted
  body and a confusing `TypeError`.

## Gotchas

- **Symptom:** a checkout retried after timeout and support sees two
  authorizations at the provider. **Cause:** the retry wrapper honoured
  the idempotency-key carve-out, but the *key regenerated* between
  attempts (the form remounted — [4·04's scope rule](../phase-4-react-ui/04-useform-and-checkout.md)).
  **Fix:** the wrapper retries the same `init` object by construction —
  same headers, same key; regeneration can only come from the caller
  re-invoking. The wrapper's contract: one call, one intention.
- **Symptom:** the UI feels frozen for 30 s on a dead network. **Cause:**
  3 attempts × 10 s timeout, sequential — arithmetic, not a bug.
  **Fix:** budgets compose: interactive surfaces pass
  `{ms: 4_000, attempts: 2}`; background prefetch keeps the defaults.
  The wrapper takes options *because* one policy never fits both.
- **Symptom:** two components got the same object and one's mutation
  shows in the other. **Cause:** not this layer — clones are separate —
  but the JSON parsed *above* it in `api` is per-clone too; shared
  mutable results mean something cached the parsed object (4·12's cache
  discussion). **Fix:** treat API results as immutable — the convention
  every chapter has silently followed.

## Interview questions

1. **★ Why must an auto-retry layer refuse plain POSTs?** Because a
   timeout is not a failure report — it is *absence* of a report; the
   server may have committed. Retrying re-runs a possibly-succeeded
   mutation: double orders, double reviews. The idempotency-key
   exception exists precisely because it converts "may have succeeded"
   into "safe to replay" — the client rule and the
   [server's dedup](../phase-3-express-api/07-the-checkout-endpoint.md)
   are two halves of one contract.
2. **★ Why does each retry attempt get its own timeout?** The timeout
   bounds *an attempt's* worth of waiting — a server that hangs should
   burn 10 s, not the whole retry budget. One shared clock across
   attempts means attempt 3 starts with 200 ms left and fails
   spuriously; per-attempt clocks make the worst case
   `attempts × ms`, which the caller can reason about and cap.
3. **Why dedupe only GETs?** Safe methods are read-shaped: two callers
   wanting `/cart` want *the same answer*, so one flight serves both.
   Two POSTs are two intentions — deduping them silently drops a
   mutation. The method is a machine-readable safety declaration, and
   this wrapper is one of the places that contract pays.
4. **Where does `AbortSignal.any` fit in the composition?** It merges
   the deadline signal with the caller's cancellation so either aborts
   the fetch — the modern replacement for hand-wiring two listeners
   onto one controller. Phase 7's cancellation pages cover the
   primitive; the wrapper is its production use.

---

Next → [The TTL cache with stale-while-revalidate](02-the-ttl-cache.md) ·
Phase index: [Phase 5 — JavaScript custom functions](README.md)
