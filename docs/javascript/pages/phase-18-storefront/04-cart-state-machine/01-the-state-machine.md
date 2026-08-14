---
title: "04.1 · The state machine"
sidebar_label: "01 · The state machine"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`Array.prototype.with()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/with). Documentation-validated; **no timings**.

**A cart is the smallest piece of real application state**, and it is where every state-management
mistake shows up first: stored derived values, mutation in place, and a shape that makes the simple
operations awkward.

## Two rules decide the design

🔴 **Rule 1: the total is computed, never stored.**

A stored total is a second source of truth for the same information, and the two will diverge — one
code path updates the items and forgets the total, and the cart shows £40 for £50 of goods. Since
recomputing is a loop over a handful of items, there is no performance argument
([Phase 13 · 01](../../phase-13-complexity/01-big-o/README.md)).

**The general rule: store the minimum that cannot be derived.** Items and quantities are input;
subtotal, tax, shipping and total are output.

🔴 **Rule 2: every operation returns a new state.**

Mutation in place defeats change detection, makes undo impossible, and turns a bug into a
time-travel debugging session. It is not about functional purity — it is that a mutation has no
"before".

## The shape

```js
// state
{
  items: [ { sku: "A1", qty: 2, unitPrice: 1299, name: "…" } ],   // minor units — topic 05
  couponCode: null,
}
```

⚠️ **An array of items or a `Map` keyed by SKU?** The trade is concrete:

| | Array | `Map` keyed by SKU |
|---|---|---|
| Lookup by SKU | O(n) — fine for a cart | sublinear |
| Order preserved | ✅ natural | ✅ insertion order |
| Serialises to JSON | ✅ | ❌ — `Map` becomes `{}` |
| Rendering | ✅ direct | needs `[...map.values()]` |

🔴 **For a cart, the array wins** — n is small, order matters for display, and it must persist to
`localStorage`, where `JSON.stringify(new Map())` is `"{}"` **silently**
([Phase 13 · 03 · 02](../../phase-13-complexity/03-choosing-a-structure/02-when-the-array-is-right.md)).
This is the case where "use a `Map` for lookups" is the wrong reflex.

## The transitions

```js
const EMPTY = Object.freeze({ items: [], couponCode: null });

function add(state, { sku, qty = 1, unitPrice, name }) {
  const i = state.items.findIndex((it) => it.sku === sku);

  if (i === -1) {
    return { ...state, items: [...state.items, { sku, qty, unitPrice, name }] };
  }
  // 🔴 adding an existing SKU increments — it does not append a duplicate line
  return {
    ...state,
    items: state.items.with(i, { ...state.items[i], qty: state.items[i].qty + qty }),
  };
}

function setQty(state, sku, qty) {
  if (qty <= 0) return remove(state, sku);            // 🔴 zero means remove
  const i = state.items.findIndex((it) => it.sku === sku);
  if (i === -1) return state;                          // 🔴 unknown SKU: no-op, not a throw
  return { ...state, items: state.items.with(i, { ...state.items[i], qty }) };
}

function remove(state, sku) {
  return { ...state, items: state.items.filter((it) => it.sku !== sku) };
}

function clear(state) {
  return { ...state, items: [] };                      // keeps the coupon — decide deliberately
}
```

Four decisions worth defending:

- 🔴 **`add` of an existing SKU increments.** Appending a second line for the same product is the
  bug users notice immediately, and it comes from treating `add` as "push".
- 🔴 **`setQty(sku, 0)` removes.** Otherwise a quantity stepper can produce a zero-quantity line
  that renders and contributes nothing — and the "remove" button and "decrement to zero" must agree.
- **An unknown SKU is a no-op, not a throw.** The item may have been removed in another tab. A
  throw here means a cart operation can crash the page for a race the user cannot see.
- **`clear` keeping the coupon** is a product decision. Whatever you choose, choose it — this is
  exactly the kind of thing that gets decided by accident.

**`Array.prototype.with(i, value)`** returns a copy with one index replaced — ES2023, and the
clearest expression of "new state, one item changed". `[...items.slice(0,i), next, ...items.slice(i+1)]`
is the older form.

## Derived values

```js
function derive(state, { taxRate, shippingFor, discountFor }) {
  const subtotal = state.items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const discount = discountFor(state, subtotal);
  const taxable = subtotal - discount;                 // 🔴 order matters — topic 05
  const tax = Math.round(taxable * taxRate);
  const shipping = shippingFor(state, taxable);

  return {
    itemCount: state.items.reduce((n, it) => n + it.qty, 0),
    subtotal, discount, tax, shipping,
    total: taxable + tax + shipping,
  };
}
```

🔴 **`derive` is a pure function of state.** That is what makes the cart testable without a DOM,
and what makes "the badge disagrees with the cart page" impossible — both read the same derivation.

⚠️ **`itemCount` is a real decision: total quantity or number of distinct lines?** The badge and the
page must agree, and "3" meaning three products versus three units is a visible difference. Name it
`itemCount` versus `lineCount` rather than leaving it ambiguous.

**Memoise the derivation only if measurement says so.** For a cart of ten items it is nanoseconds,
and a memo introduces a cache-invalidation question for no benefit.

## Freezing, and how far to go

```js
const next = Object.freeze({ ...state, items: Object.freeze(newItems) });
```

⚠️ **`Object.freeze` is shallow.** Freezing the state object leaves the item objects mutable, so
`state.items[0].qty = 99` still works. A deep freeze in development catches accidental mutation;
in production it costs on every update.

🔴 **The pragmatic position: freeze in development, not in production**, and rely on the transitions
being the only way to change the cart. A frozen object in **sloppy mode fails silently** — the
assignment does nothing — while in strict mode (every ES module) it throws, which is what makes the
check useful.

## Gotchas

**Symptom:** The displayed total does not match the items
**Cause:** The total was stored and one path forgot to update it.
**Fix:** Compute it; store only what cannot be derived.

**Symptom:** Adding a product twice creates two lines
**Cause:** `add` implemented as `push`.
**Fix:** Find the SKU and increment.

**Symptom:** A zero-quantity line renders
**Cause:** `setQty(sku, 0)` does not remove.
**Fix:** Treat zero (and negatives) as a removal.

**Symptom:** A cart operation crashes the page
**Cause:** An unknown SKU throws — the item was removed in another tab.
**Fix:** Return the state unchanged.

**Symptom:** The cart badge and the cart page disagree
**Cause:** Two independent count calculations.
**Fix:** One `derive` function that both read.

**Symptom:** "3 items" is ambiguous
**Cause:** `itemCount` conflates units and lines.
**Fix:** Name it explicitly and use it consistently.

**Symptom:** The cart persists as `{}`
**Cause:** A `Map`-based cart run through `JSON.stringify`.
**Fix:** An array, or convert entries deliberately.

**Symptom:** Mutation slips through despite freezing
**Cause:** `Object.freeze` is shallow.
**Fix:** Deep-freeze in development; rely on the transitions in production.

**Symptom:** A mutation silently does nothing
**Cause:** A frozen object assigned to in sloppy mode.
**Fix:** Strict mode (modules are) so it throws.

## Interview questions

**★ Why is the cart total computed rather than stored?**
Because a stored total is a second source of truth for the same information and the two diverge —
one path updates items and forgets the total. Recomputing is a loop over a handful of items, so
there is no performance argument. Store only what cannot be derived.

**★ Array or `Map` for cart items?**
Array. n is small so O(n) lookup is irrelevant, display order matters, and the cart must persist to
`localStorage` — where `JSON.stringify(new Map())` is `"{}"` **silently**. This is the case where
"use a `Map` for lookups" is the wrong reflex.

**★ What should `add` do for a SKU already in the cart?**
Increment the existing line. Appending a duplicate is the bug users notice first, and it comes from
implementing `add` as `push`.

**★ What does `setQty(sku, 0)` do?**
Removes the line. Otherwise a stepper produces a zero-quantity row that renders and contributes
nothing, and "remove" and "decrement to zero" behave differently for no reason.

**★ Why is an unknown SKU a no-op rather than an error?**
Because the item may have been removed in another tab or gone out of stock. Throwing lets an
invisible race crash the page; returning the state unchanged is correct and quiet.

**★ How do you stop the cart badge disagreeing with the cart page?**
One pure `derive(state)` that both read. Two independent calculations is the cause, and it is also
why `itemCount` needs an unambiguous name — units or lines.

**Is `Object.freeze` enough to enforce immutability?**
No — it is shallow, so nested item objects stay mutable. Deep-freeze in development where the cost
does not matter, and note that a frozen assignment **fails silently in sloppy mode** and throws in
strict, which is what makes it a useful check in modules.

---

[Topic index](./README.md) · Next → [02 · Wiring it to the UI and the server](./02-wiring-it-up.md)
