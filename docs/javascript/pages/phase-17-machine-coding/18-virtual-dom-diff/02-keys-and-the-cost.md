---
title: "18.2 · Keys, and the cost"
sidebar_label: "02 · Keys and the cost"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the React documentation — [Rendering lists](https://react.dev/learn/rendering-lists) (rules of keys) and [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) — and MDN [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Node.insertBefore()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore), [`Element.moveBefore()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore). Documentation-validated; **no timings, nothing was run**.

**Children are where a diff either works or embarrasses itself**, and the difference is one
optional string.

## Without keys, position is identity

```js
function diffChildrenByPosition(oldCh, newCh, patches) {
  for (let i = 0; i < Math.max(oldCh.length, newCh.length); i++) {
    diff(oldCh[i], newCh[i], i, patches);          // compare slot to slot
  }
}
```

Now insert one item at the *front* of a five-item list. Slot 0 holds a different item than before,
so does slot 1, and so on: **every comparison mismatches**, and the diff rewrites five rows to
express one insertion. If the rows contain an open dropdown, a half-typed input or a focused
button, all of it is gone — the DOM nodes were reused for different data.

That is the case React's second assumption exists for:

> *"The developer can hint at which child elements may be stable across different renders with a
> `key` prop."*

## With keys, matching is by identity

```js
function diffChildrenByKey(oldCh, newCh, patches) {
  const oldByKey = new Map(oldCh.map((child, i) => [child.key, { child, i }]));

  newCh.forEach((next, newIndex) => {
    const previous = oldByKey.get(next.key);
    if (!previous) {
      patches.push({ type: "CREATE", node: next, at: newIndex });
    } else {
      diff(previous.child, next, previous.i, patches);          // same item — update in place
      if (previous.i !== newIndex) patches.push({ type: "MOVE", key: next.key, to: newIndex });
      oldByKey.delete(next.key);
    }
  });

  for (const { child } of oldByKey.values()) {
    patches.push({ type: "REMOVE", key: child.key });            // never claimed — gone
  }
}
```

One `Map` build and one pass: **O(n)**, one insertion produces one `CREATE`, and every surviving
row keeps its DOM node, its focus and its scroll position. The leftovers in the map are exactly the
removals — you get them for free rather than searching for them.

Two refinements real implementations add, worth naming rather than writing:

- **A two-ended walk** (Vue's approach): compare first-to-first and last-to-last before building
  any map, which handles append, prepend and reverse without allocating.
- **A longest-increasing-subsequence pass** over the matched indices, so the nodes that are
  already in relative order stay put and only the minimum number of nodes move. Naively moving
  every out-of-place node is correct but does more DOM work than necessary.

📌 A move is `insertBefore`, which **removes and reinserts** the node — iframes reload, focus can
be lost, transitions restart. The newer `Element.moveBefore()` preserves state across a move, which
is precisely the sharp edge that made it worth adding to the platform.

## The rules, and the two that get broken

React's documentation states them plainly:

> *"**Keys must be unique among siblings.** However, it's okay to use the same keys for JSX nodes
> in *different* arrays."*
>
> *"**Keys must not change** or that defeats their purpose! Don't generate them while rendering."*

**Broken rule 1 — the index as a key.**

> *"You might be tempted to use an item's index in the array as its key. In fact, that's what
> React will use if you don't specify a `key` at all. But the order in which you render items will
> change over time if an item is inserted, deleted, or if the array gets reordered. Index as a key
> often leads to subtle and confusing bugs."*

An index key is not a key at all — it *is* position, so it reproduces the unkeyed behaviour while
looking like it fixed it. Delete the first row of a to-do list and the second row's checkbox state,
input contents and focus quietly migrate to the row above.

⚠️ It is acceptable in exactly one situation: **a list that is never reordered, never inserted into
except at the end, and whose items hold no DOM or component state**. A static rendering of a fixed
array qualifies. Almost nothing else does.

**Broken rule 2 — generating keys during render.**

> *"Similarly, do not generate keys on the fly, e.g. with `key={Math.random()}`. This will cause
> keys to never match up between renders, leading to all your components and DOM being recreated
> every time. Not only is this slow, but it will also lose any user input inside the list items.
> Instead, use a stable ID based on the data."*

The reconciliation write-up says the same thing about consequences: *"Unstable keys (like those
produced by `Math.random()`) will cause many component instances and DOM nodes to be unnecessarily
recreated, which can cause performance degradation and lost state in child components."*

**If the data has no id, mint one when the item is created** — when it enters the array, not when
it is rendered — and store it with the item.

## Keys are identity, which cuts both ways

Because a key decides *"is this the same thing"*, changing one deliberately is the cleanest way to
**reset** state: give a form a `key` of the record id and switching records gives you a brand new
form, with no effect to write and nothing to clear by hand. Keeping a key stable across what the
user perceives as a different thing produces the opposite bug — a "new" item that arrives holding
the previous one's contents.

Two properties that follow from keys being sibling-scoped:

- **Uniqueness is only among siblings**, so the same id in a different list is fine — no global
  registry, no prefixing.
- **A key is not a queryable attribute.** It exists in the vnode tree; it never reaches the DOM.
  Reading it back in a test or a handler is not a thing you can do.

## What it all costs

- **Two trees in memory** and a full comparison on every render, whether or not anything changed.
  That is the price of the model, and it is why every framework built this way also ships an
  opt-out — memoisation, `shouldComponentUpdate`, an equality check on props.
- **The diff is proportional to the size of the tree you render**, not to what changed. Ten
  thousand rows diff ten thousand rows for one edit, which is why long lists are windowed rather
  than diffed harder.
- **The gains are structural, not raw.** A virtual DOM stops the whole category of "rebuilt the
  list and lost the focus" bugs; it does not make an update cheaper than the equivalent hand-written
  mutation.

The alternatives are worth being able to name, because the interview question behind this topic is
usually "and would you build one":

| Approach | What changes |
|---|---|
| **Virtual DOM** | Compare outcomes; patch the differences. Simple mental model, work proportional to the tree |
| **Fine-grained reactivity** | Track dependencies so the one text node that depends on the changed value updates directly — no tree, no diff ([17](../17-pubsub-and-signals/README.md)) |
| **Compiled templates** | The build step knows which parts are dynamic, so the runtime updates only those bindings |
| **Server-rendered HTML swaps** | Send markup; morph it into the existing DOM — the same diff, on real nodes rather than a virtual tree |

**Nobody should ship a hand-written virtual DOM.** Write the outline to understand what keys are
for, what a changed element type destroys, and why a list diff is the part that matters — then use
an implementation somebody maintains.

## Gotchas

**Symptom:** Inserting one row rewrites the whole list and clears an open input.
**Cause:** Unkeyed children, so matching is by position.
**Fix:** A stable key per item, from the data.

**Symptom:** Deleting a row moves the wrong checkbox state or focus to a neighbour.
**Cause:** The array index used as a key — position wearing a key's clothes.
**Fix:** A key derived from the item's identity, minted at creation if the data has none.

**Symptom:** Every render recreates every row and loses user input.
**Cause:** Keys generated during render, such as `Math.random()`.
**Fix:** A stable id stored with the item.

**Symptom:** Two children silently collapse into one, or updates land on the wrong one.
**Cause:** Duplicate keys among siblings — the map holds one entry per key.
**Fix:** Ensure uniqueness among siblings only; the same key in another list is fine.

**Symptom:** A form keeps the previous record's values after switching records.
**Cause:** The key stayed the same, so it is the same node to the diff.
**Fix:** Key the form by the record id and let identity reset it.

**Symptom:** An iframe reloads or a video restarts when a list reorders.
**Cause:** A move is an `insertBefore`, which detaches and reinserts the node.
**Fix:** Avoid unnecessary moves (an LIS pass), or `Element.moveBefore()` where available.

## Interview questions

**★ Why does a virtual DOM need keys?**
Because without them children are matched by position, so one insertion mismatches every following
slot — the diff rewrites the whole list and reuses DOM nodes for different data. A key matches by
identity instead.

**★ How do you diff keyed children?**
Build a `Map` from key to old child, walk the new children reusing matches and creating misses,
then remove whatever is left in the map. One pass, linear, and removals fall out of the leftovers.

**★ What is wrong with using the array index as a key?**
It *is* the position, so it does not fix anything — React's own documentation warns that order
changes on insert, delete or reorder and that index keys *"often lead to subtle and confusing
bugs"*. It is only safe for a list that never reorders and holds no state.

**★ What are the rules for keys?**
Unique among siblings, stable across renders, and never generated while rendering — an unstable
key recreates the component and the DOM every time and loses user input.

**★ How would you deliberately reset a component's state?**
Change its key. Identity is what the diff uses to decide "same thing", so a new key means a new
node and fresh state.

**Would you build a virtual DOM?**
No — but the outline is worth knowing: type change replaces, same type updates attributes in place,
and keyed children turn an O(n²)-shaped problem into one map and one pass. Fine-grained reactivity
and compiled templates solve the same problem without a diff at all.

---

← Prev [The diff](./01-the-diff.md) · [Topic index](./README.md)
