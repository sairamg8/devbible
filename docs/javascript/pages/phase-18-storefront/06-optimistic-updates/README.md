---
title: "06 · Optimistic updates with rollback"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live). Documentation-validated; **no timings**.

**An optimistic update is a promise the client makes on the server's behalf**, which is why the
failure path is the entire design rather than an afterthought.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Apply, reconcile, roll back](./01-apply-and-reconcile.md)** | The three phases, with 🔴 **the snapshot captured before applying** — capturing it in the `catch` restores the wrong thing; 🔴 **reconciling with the server's response rather than keeping the optimistic value**, which is the subtle bug where the UI looks right and disagrees with the database; ⚠️ **why a whole-state restore is too blunt** and the rollback must be scoped; the three strategies for concurrent updates and 🔴 **sending the resulting state rather than a delta**; the UI rules — do not disable the control, and **never revert silently**; and 🔴 **the test for when not to be optimistic at all** |

## The three sentences to keep

1. **Snapshot before applying; reconcile with the response, not with your guess.**
2. **Scope the rollback to what the action changed** — a whole-state restore discards concurrent
   work.
3. **Send `setQty(5)`, not `increment()`.** Idempotent, order-independent, and it removes the race
   rather than managing it.

## Phase gate

You are done with this topic when you can name all three phases and why the snapshot's position
matters, explain why keeping the optimistic value on success is a bug, choose a concurrency
strategy for a quantity stepper and justify it, and say which actions must never be optimistic.

## Where this connects

- [04 · The cart as a state machine](../04-cart-state-machine/README.md) — the transitions being applied and reverted
- [03 · A resilient API client](../03-resilient-api-client/README.md) — the failure classes that decide whether to roll back
- [07 · Idempotency from the client](../07-idempotency/README.md) — what makes the retried write safe
- [02 · Search with autocomplete](../02-search-autocomplete/README.md) — the same out-of-order race, on reads

---

Start → [01 · Apply, reconcile, roll back](./01-apply-and-reconcile.md)
