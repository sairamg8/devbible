---
title: "06.1 · Apply, reconcile, roll back"
sidebar_label: "01 · Apply and reconcile"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live). Documentation-validated; **no timings**.

**An optimistic update applies the change immediately and reconciles when the server answers.** It
is the difference between an interface that feels instant and one that feels like a form
submission — and it is a promise the client makes on the server's behalf, which is why the failure
path is the whole design.

## The three phases

```js
async function optimistic(store, action, request) {
  const snapshot = store.getState();                    // 🔴 1. capture BEFORE applying
  store.dispatch(action);                               //    2. apply immediately

  try {
    const confirmed = await request();
    store.dispatch({ type: "reconcile", payload: confirmed });   // 3. take the server's truth
    return confirmed;
  } catch (err) {
    if (err.name === "AbortError") return;              // superseded — leave the UI alone
    store.dispatch({ type: "restore", payload: snapshot });      // 3'. roll back
    throw err;                                           // 🔴 the caller must still hear about it
  }
}
```

🔴 **Capture the snapshot before applying, not inside the catch.** By the time the catch runs, other
actions may have changed the state, and re-reading it there restores the wrong thing.

🔴 **Reconcile with the server's response rather than keeping the optimistic value.** The two are
usually equal and occasionally not — the server may have clamped a quantity to available stock,
applied a different price, or normalised something. **Keeping the optimistic value on success is
the subtle bug**: the UI looks right and disagrees with the database.

## Rolling back is not "undo"

⚠️ **Restoring the snapshot wholesale discards anything the user did while the request was in
flight.** If they added item B while item A's request was failing, a whole-state restore removes B
too.

🔴 **So the rollback must be scoped to what the action changed**, not to the whole state:

```js
// ❌ blunt — loses concurrent changes
store.dispatch({ type: "restore", payload: snapshot });

// ✅ scoped — undo only this action's effect
store.dispatch({ type: "revert-item", sku, previousQty: snapshot.items.find(i => i.sku === sku)?.qty });
```

**For a cart this is tractable because the actions are small and independent.** For a document
editor it is the whole problem, and the answer is usually a per-entity revision or an operational
transform — worth naming as the point where "optimistic updates" stops being a small pattern.

## Concurrent updates to the same thing

Two quick clicks on "+" produce two in-flight requests for the same SKU, and the responses can
arrive out of order — the same race as the search box
([02 · The three bugs](../02-search-autocomplete/01-the-three-bugs.md)).

🔴 **Three strategies, and you must pick one deliberately:**

| Strategy | How | Suits |
|---|---|---|
| **Last write wins** | tag each request; ignore a response that is not the latest | quantity steppers |
| **Queue per entity** | serialise requests for one SKU | anything order-dependent |
| **Debounce the send** | apply optimistically per click, send once after quiet | rapid steppers |

⚠️ **The third is usually right for a quantity stepper**: the user clicks "+" five times, the UI
shows 5 immediately, and **one** request sets the quantity to 5. It also removes the ordering
problem entirely rather than managing it.

🔴 **Send the resulting state, not the delta**, wherever possible — `setQty(sku, 5)` is idempotent
and order-independent; `increment(sku)` applied twice out of order is a different outcome from
applied once.

## Telling the user what is happening

**The rule: show the optimistic state as real, but mark it as in-flight.** Not a spinner replacing
the value — the value, with a subtle pending affordance.

- ⚠️ **Do not disable the control while a request is in flight.** The whole point is that the user
  can keep going; disabling it makes the optimistic update pointless.
- 🔴 **Failure must be visible and explain what was undone.** "Could not update quantity — reverted
  to 2" tells the user what happened; a silent revert makes the app look broken and makes them
  distrust the number they are looking at.
- **Announce reversions in a live region**, because a value changing back is exactly the kind of
  update a screen-reader user gets no signal about
  ([01 · 02](../01-product-grid/02-rendering-and-the-request.md)).

## When not to be optimistic

🔴 **Optimism is a claim about the likely outcome. Do not make it where being wrong is expensive:**

| Do | Do not |
|---|---|
| add to cart, change quantity | **place an order** |
| like, favourite, follow | **make a payment** |
| rename, reorder, toggle | anything with a **confirmation email** |
| mark as read | anything the user cannot easily undo |

**The test: if the rollback would be embarrassing or alarming, do not be optimistic.** Showing
"order placed" and then withdrawing it is worse than a two-second spinner — and for payments it is
not a UX question at all, because the money either moved or it did not.

⚠️ **Also skip optimism when you cannot predict the result.** If the server assigns an id, computes
a price, or may reject on rules the client does not know, the optimistic value is a guess and
reconciliation will visibly correct it — which is worse than waiting.

## Gotchas

**Symptom:** A rollback restores the wrong values
**Cause:** The snapshot was captured in the `catch`, after other changes.
**Fix:** Capture before applying.

**Symptom:** The UI disagrees with the database after a success
**Cause:** The optimistic value was kept instead of the server's response.
**Fix:** Reconcile with what the server returned.

**Symptom:** A failed update also undoes an unrelated change
**Cause:** A whole-state restore.
**Fix:** Scope the rollback to what the action changed.

**Symptom:** Rapid clicks produce the wrong final quantity
**Cause:** Concurrent requests resolving out of order.
**Fix:** Send the resulting state rather than a delta, and debounce or serialise.

**Symptom:** The value flickers back and forth
**Cause:** An out-of-order response reconciled after a newer one.
**Fix:** Tag requests and ignore stale responses.

**Symptom:** The optimistic update feels pointless
**Cause:** The control is disabled while in flight.
**Fix:** Keep it usable; mark it pending instead.

**Symptom:** Users report "it randomly changes my numbers"
**Cause:** Silent rollbacks.
**Fix:** Say what failed and what it was reverted to, in a live region.

**Symptom:** "Order placed" then "order failed"
**Cause:** Optimism applied to an expensive-to-be-wrong action.
**Fix:** Wait for the server on orders and payments.

## Interview questions

**★ What are the three phases of an optimistic update?**
Snapshot **before** applying, apply immediately, then either reconcile with the server's response
or roll back. Capturing the snapshot in the `catch` is the common bug — by then other actions may
have changed the state.

**★ Why reconcile with the response rather than keeping the optimistic value?**
Because the server may have clamped a quantity, applied a different price, or normalised the data.
Keeping the optimistic value on success is the subtle failure: the UI looks correct and disagrees
with the database.

**★ What is wrong with restoring the whole snapshot on failure?**
It discards anything the user did while the request was in flight. The rollback must be **scoped to
what the action changed** — tractable for a cart, and the point where the pattern gets hard for a
document editor.

**★ Two rapid clicks on "+" — what can go wrong and how do you fix it?**
Two in-flight requests whose responses arrive out of order. Fix by **sending the resulting state
rather than a delta** (`setQty(5)` is idempotent, `increment` is not), and by debouncing the send
or serialising per entity.

**★ Should the control be disabled while the request is in flight?**
No — that defeats the purpose. Show the optimistic value as real with a subtle pending affordance,
and keep the control usable.

**★ When would you not use optimistic updates?**
When being wrong is expensive: placing an order, taking a payment, anything that triggers an email
or that the user cannot easily undo — and when the result is unpredictable, because the
reconciliation will visibly correct your guess.

**Why must a rollback be announced?**
Because a value silently changing back looks like a bug, and a screen-reader user gets no signal at
all. Say what failed and what it was reverted to, in a polite live region.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
