---
title: "Optimistic-update helpers"
sidebar_label: "09 · Optimistic-update helpers"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. Concept home: **why optimism needs three phases, why
> rolling back is not undo, and what to tell the user** is
> [JavaScript 18·06](../../../javascript/pages/phase-18-storefront/06-optimistic-updates/README.md).
> The **worked cart implementation** is [chapter 4·06](../phase-4-react-ui/06-cart-state.md).
> This chapter neither re-argues the first nor re-implements the second — it
> extracts the pattern so the other three surfaces stop copying it.

## The problem

[Cart state](../phase-4-react-ui/06-cart-state.md) does optimistic add
correctly, by hand, inside its reducer. Then reviews want it. Then the wishlist
wants it. Then the admin table wants inline edits.

Copying that reducer three times produces **three rollback implementations**,
and rollback is the half nobody tests — the happy path is exercised on every
click and the failure path only when the network breaks. The three copies
diverge quietly, and the bug reports arrive as *"my review disappeared"* and
*"the wishlist heart flickers back"*.

So the goal here is narrow: **make apply and rollback data**, once, so a surface
declares an optimistic mutation instead of hand-writing its lifecycle.

## The mutation is a record

```js
// src/lib/optimistic.js
let seq = 0;

/**
 * A pending mutation. `revert` is captured AT APPLY TIME — it is the inverse
 * of what was actually applied, not something recomputed later from state
 * that has since moved on.
 */
export function createMutation({apply, revert, describe}) {
  return {id: ++seq, apply, revert, describe, status: 'pending'};
}

export function createRegistry(onChange) {
  const pending = new Map();          // insertion-ordered, which is what LIFO needs

  return {
    begin(mutation) {
      pending.set(mutation.id, mutation);
      onChange(mutation.apply);       // optimistic state change
      return mutation.id;
    },

    settle(id, serverState) {
      pending.delete(id);
      onChange(() => serverState);    // server truth replaces wholesale
    },

    fail(id) {
      const m = pending.get(id);
      if (!m) return;
      // Revert this mutation AND everything applied after it, newest first,
      // then re-apply the survivors in their original order.
      const after = [...pending.values()].filter((x) => x.id >= m.id);
      for (const x of [...after].reverse()) onChange(x.revert);
      pending.delete(id);
      for (const x of after.filter((x) => x.id !== m.id)) onChange(x.apply);
    },
  };
}
```

🔴 **`revert` is captured at apply time, and that is the whole design.** The
tempting alternative — "snapshot the state before, restore it on failure" —
is wrong the moment two mutations overlap: restoring the snapshot also
discards the *second* mutation, which had not failed. Capturing each
mutation's own inverse is what lets one fail without taking its neighbours
with it. The reasoning in full is
[JavaScript 18·06 chunk 1](../../../javascript/pages/phase-18-storefront/06-optimistic-updates/01-apply-and-reconcile.md).

⚠️ **`fail` reverts newest-first and then re-applies the survivors.** Reverting
in application order produces the wrong state whenever two mutations touched
the same field, because the second one's inverse assumes the first is still in
place. LIFO is not an optimisation here; it is correctness.

## Using it

A surface declares the pair and nothing else:

```js
// src/features/reviews/useReviewVote.js
export function useReviewVote(reviewId, dispatch) {
  const registry = useOptimisticRegistry(dispatch);

  return async function vote(direction) {
    const m = createMutation({
      apply:  (s) => ({...s, score: s.score + direction, myVote: direction}),
      revert: (s) => ({...s, score: s.score - direction, myVote: null}),
      describe: 'vote on review',
    });
    const id = registry.begin(m);
    try {
      const fresh = await api.post(`/reviews/${reviewId}/vote`, {direction});
      registry.settle(id, fresh);
    } catch (err) {
      registry.fail(id);
      bus.emit('toast:error', {message: 'Vote failed', retry: () => vote(direction)});
      throw err;
    }
  };
}
```

`apply` and `revert` are pure functions of state, which is what makes them
testable without a network: apply then revert must return the original state
for every mutation in the app, and that is a property test rather than three
hand-written cases.

## What settles is the server's version, not a patch

`settle` takes the server's state and replaces wholesale rather than merging.
The optimistic value was a **guess**, and the server is allowed to disagree —
a price changed, an item merged with an existing line, a vote was already
counted. Merging a guess into truth preserves the guess where they differ,
which is exactly the bug optimism is supposed to be honest about.

This is also why the [TTL cache](02-the-ttl-cache.md) entry for the affected
key is invalidated on settle, not updated: the cache should re-derive from the
server response rather than carry a locally-patched copy.

## Retry, and why it must not double-apply

The [fetch wrapper](01-the-fetch-wrapper.md) retries idempotent requests.
A vote is **not** idempotent unless the server makes it so, and an optimistic
mutation that is retried without an idempotency key can apply twice — once per
attempt — while the UI only ever showed one.

The rule this app follows: **a mutation that is optimistically applied sends an
idempotency key**, so a retry is safe and `settle` still receives one
authoritative state. The key belongs to the mutation record's lifetime, not to
the attempt.

## What is never optimistic

**Checkout.** The [checkout endpoint](../phase-3-express-api/07-the-checkout-endpoint.md)
reserves stock, charges, and writes an order in one transaction, and the honest
UI for that is a pending state — not a success the app might have to take back.
Optimism is appropriate where the failure is cheap and reversible in the user's
mind: a vote, a heart, a quantity. It is inappropriate anywhere the user would
reasonably act on the false confirmation, and money is the clearest case.

## Gotchas

**Symptom:** A failed mutation also undoes an unrelated later change
**Cause:** Restoring a pre-mutation snapshot instead of applying inverses
**Fix:** Per-mutation `revert`, reverted newest-first with survivors re-applied

**Symptom:** Two rapid votes leave the score off by one
**Cause:** Reverting in application order, so the second inverse assumed the
first was still applied
**Fix:** LIFO, as in `fail`

**Symptom:** The optimistic value survives a server response that disagreed
**Cause:** `settle` merged instead of replacing
**Fix:** Replace wholesale — the guess has no standing once truth arrives

**Symptom:** A retried request applies the change twice
**Cause:** A non-idempotent mutation retried by the fetch wrapper
**Fix:** An idempotency key tied to the mutation, not the attempt

**Symptom:** The UI shows success and the list is stale on next load
**Cause:** The cache kept a locally-patched entry
**Fix:** Invalidate on settle; let the next read re-derive from the server

**Symptom:** Rollback works in development and not in production
**Cause:** `revert` closed over state rather than being a pure function of it,
and the closure captured a value that had moved on
**Fix:** `revert: (s) => …` taking current state; never capture the old object

**Symptom:** A rollback leaves no trace and the user thinks they succeeded
**Cause:** State reverted with no notification
**Fix:** The [event bus](04-the-event-bus.md) toast, with the retry attached —
reverting silently is worse than the original failure

**Symptom:** Pending mutations leak after the component unmounts
**Cause:** The registry outlives the surface that created it
**Fix:** Scope the registry to the feature and clear pending entries on
teardown; a settled-after-unmount response has nothing to update

## Interview questions

1. **★ Why capture a `revert` function per mutation instead of snapshotting
   state before applying?** Because mutations overlap. Restoring a snapshot
   rewinds everything applied since, including mutations that had not failed,
   so one failed vote silently discards a successful one. A per-mutation
   inverse only undoes its own effect.
2. **★ Why must rollback happen newest-first?** Because each inverse was
   written assuming the state it was applied to. If two mutations changed the
   same field, undoing the older one first leaves the newer one's inverse
   operating on state it does not recognise, and the result is wrong by exactly
   the overlap.
3. **★ Why does `settle` replace state rather than merge the server response
   into it?** Because the optimistic value was a guess and the server is
   entitled to disagree — a merged result keeps the guess wherever the two
   differ, which reintroduces precisely the divergence optimism is meant to
   resolve honestly.
4. **What makes `apply` and `revert` testable?** They are pure functions of
   state, so `revert(apply(s))` must equal `s` for every mutation without any
   network involved. That is a property that can be asserted across the whole
   catalogue rather than three hand-written failure cases.
5. **How does optimism interact with automatic retry?** Dangerously, unless the
   mutation is idempotent. A retried non-idempotent request can apply twice on
   the server while the UI only ever displayed one change. An idempotency key
   scoped to the mutation — not to the attempt — makes the retry safe.
6. **Which operations should never be optimistic, and what is the test?** Ask
   whether the user would act on a confirmation that later turns out false.
   Checkout fails that test: someone told their order succeeded may close the
   tab or stop shopping. A vote or a wishlist heart passes it — the cost of
   being wrong is a flicker and a toast.
7. **Why invalidate the cache on settle rather than writing the server response
   into it?** Both are defensible; invalidating is chosen because it keeps one
   derivation path. Writing through means the cached shape is produced in two
   places — the normal read path and the settle path — and those drift.
8. **What goes wrong if `revert` closes over the previous state object?** It
   captures a value that may have moved on before the failure arrives, so the
   rollback restores stale data rather than inverting its own effect. Taking
   current state as an argument is what keeps it correct under concurrency.

---

← Prev: [Feature flags](08-feature-flags.md) ·
Next → [Debounce and throttle, applied](10-debounce-and-throttle-applied.md)
