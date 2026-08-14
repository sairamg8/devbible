---
title: "04 · The cart as a state machine"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Array.prototype.with()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/with), [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel). Documentation-validated; **no timings**.

**A cart is the smallest piece of real application state**, and every state-management mistake
shows up in it first: a stored total that drifts, mutation in place, and a shape that makes the
simple operations awkward.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The state machine](./01-the-state-machine.md)** | 🔴 **The total is computed, never stored** — a stored total is a second source of truth and it *will* drift; every transition returning new state; ⚠️ **why an array beats a `Map` here**, against the usual reflex, because it must survive `JSON.stringify`; the four transitions and the decisions worth defending — **`add` increments rather than appends**, `setQty(0)` removes, an unknown SKU is a **no-op not a throw**; a pure `derive` so the badge cannot disagree with the page; and how far to take `Object.freeze`, given it is shallow and **fails silently in sloppy mode** |
| 2 | **[Wiring it to the UI and the server](./02-wiring-it-up.md)** | A twenty-line store with its three real bugs — 🔴 **reference equality to skip no-op notifications**, copying the listener set before iterating, and returning the unsubscribe; persistence that must **degrade rather than throw**, including 🔴 **the schema version that stops an old cart crashing a new release**; the `storage` event firing in **other** tabs and for **every** key, `BroadcastChannel`, and the ping-pong guard; and 🔴 **the client cart as a draft** with four merge decisions that must be made in advance — and surfaced |

## The three sentences to keep

1. **Store only what cannot be derived.** Items and quantities in; subtotal, tax and total out.
2. **A no-op returns the same object**, so the store can skip notifying with reference equality.
3. **The client cart is a draft.** Merge on login, take server prices, and make every adjustment
   visible.

## Phase gate

You are done with this topic when you can write the transitions with `add` incrementing and
`setQty(0)` removing, explain why an array beats a `Map` here, list three ways `localStorage`
fails and how each degrades, and say which tab the `storage` event reaches.

## Where this connects

- [05 · Money, quantities and rounding](../05-money-and-rounding/README.md) — what `unitPrice` actually holds, and the order of tax and discount
- [06 · Optimistic updates with rollback](../06-optimistic-updates/README.md) — what happens between the click and the server's answer
- [Phase 13 · 03 · Choosing a structure](../../phase-13-complexity/03-choosing-a-structure/README.md) — why the array wins here
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — why `subscribe` returns its unsubscribe

---

Start → [01 · The state machine](./01-the-state-machine.md)
