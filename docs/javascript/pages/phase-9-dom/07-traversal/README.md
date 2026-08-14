---
title: "07 · Traversal"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.closest()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest), [`Element.matches()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches), [`Node.parentNode`](https://developer.mozilla.org/en-US/docs/Web/API/Node/parentNode), [`Element.parentElement`](https://developer.mozilla.org/en-US/docs/Web/API/Element/parentElement), [`Element.children`](https://developer.mozilla.org/en-US/docs/Web/API/Element/children), [`Node.childNodes`](https://developer.mozilla.org/en-US/docs/Web/API/Node/childNodes). Documentation-validated; **no timings**.

**The whole topic collapses into one sentence:** you almost never walk the tree by hand,
because `closest` walks *up* for you and a selector walks *down* for you. The hand-written
`while (node.parentNode)` loop is the thing this topic exists to delete.

```js
// ⚠️ the loop everyone writes once
let node = event.target;
while (node && node.tagName !== 'TR') node = node.parentNode;

// ✅ the same thing, correct in the edge cases the loop gets wrong
const row = event.target.closest('tr');
```

The loop is not merely longer. It compares `tagName` (so it cannot express `tr[data-id]`), it
runs off the top of the document into `null` if nothing matches, and it does not stop at a
shadow boundary. `closest` is documented to do all three properly.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The two families](./01-the-two-families.md)** | `Node` versus `Element` traversal properties, why whitespace text nodes break the `Node` half, the one place `parentNode` and `parentElement` differ, live collections while iterating, and the rare case for a manual walk |
| 02 | **[`closest`, `matches` and `:scope`](./02-closest-matches-and-scope.md)** | The selector-based API — the up-walk, the boolean test, scoping a down-walk, `contains` and `compareDocumentPosition`, and where a shadow boundary or a detached tree stops you |

**Read 01 first if you have ever been surprised by `firstChild`; read 02 first if you are here
for event delegation.**

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [02 · Selecting elements](../02-selecting-elements/README.md) — the live-versus-static
  distinction that `children` and `childNodes` inherit
- [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md) —
  `closest` and `matches` are its entire vocabulary
- **08 · Classes and styles from JavaScript** *(not written yet)* — what you do once the
  traversal has found the element

---

Start → [01 · The two families](./01-the-two-families.md)
