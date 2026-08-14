---
title: "07 · Idempotency from the client"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [`Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After). Documentation-validated; **no timings**.

**Two orders from one checkout is the most expensive bug a storefront can ship** — and it has five
causes, of which a disabled button addresses exactly one.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The double-submitted checkout](./01-the-double-submit.md)** | The five causes, and 🔴 **why four of them happen with a perfectly disabled button**; the timeout case stated as the principle — **a timeout means you stopped listening, not that the server did nothing** — and why that leaves only two options; the idempotency key with its three rules — 🔴 **generated once per logical operation outside the retry loop**, 🔴 **surviving a reload via `sessionStorage`**, and **a new key when the operation genuinely changes**; ⚠️ **`crypto.randomUUID()` needing a secure context** and why the `Math.random` fallback is a fallback and not a design; the disabled button as a courtesy — with `finally`, or the user is locked out; 🔴 **whose responsibility the deduplication is**; and what to do when you genuinely do not know |

## The three sentences to keep

1. **A timeout means you stopped listening.** The order may exist; the client cannot tell.
2. **One key per logical operation, generated outside the retry loop and surviving a reload** —
   anything else recreates the bug.
3. **Deduplication is the server's job.** If the endpoint does not implement it, do not retry the
   call at all.

## Phase gate

You are done with this topic when you can list the five causes and say which the button fixes,
explain why the timeout case is unresolvable client-side, place the key generation correctly in
both the retry loop and across a reload, and say what to do against an endpoint with no idempotency
support.

## Where this connects

- [Phase 11 · 03 · 06 · Retries](../../phase-11-network-storage/03-fetch-wrapper/06-retries.md) — where the same rule is stated for the generic client
- [03 · A resilient API client](../03-resilient-api-client/README.md) — the retry layer that needs this to be safe, and the request id it is *not*
- [06 · Optimistic updates with rollback](../06-optimistic-updates/README.md) — why orders are the one thing you do not do optimistically
- [05 · Money, quantities and rounding](../05-money-and-rounding/README.md) — the other half of not charging someone twice

---

Start → [01 · The double-submitted checkout](./01-the-double-submit.md)
