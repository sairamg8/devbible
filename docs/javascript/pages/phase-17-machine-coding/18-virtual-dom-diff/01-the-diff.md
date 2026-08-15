---
title: "18.1 · The diff"
sidebar_label: "01 · The diff"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the React documentation — [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) (the algorithm write-up) — and MDN [`Node.replaceChild()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/replaceChild), [`Element.setAttribute()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute), [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment), [`Node.textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent). Documentation-validated; **no timings, nothing was run**.

**A virtual DOM is a plain object tree that describes what the DOM should look like.** Nothing
more — no magic, no speed guarantee. Its value is that comparing two plain objects is cheap enough
to do on every state change, so you can write *what the UI is* instead of *which nodes to mutate*.

```js
const vnode = {
  type: "li",
  props: { className: "row" },
  children: [{ type: "#text", text: "Ada" }],
};
```

The whole machine is three steps: **render** produces a tree, **diff** compares it with the
previous one, **patch** applies the differences to the real DOM.

## Why a general diff is not an option

React's documentation is blunt about the starting point:

> *"the state of the art algorithms have a complexity in the order of O(n3) where n is the number
> of elements in the tree"*

and that it *"implements a heuristic O(n) algorithm based on two assumptions"*:

> 1. *"Two elements of different types will produce different trees."*
> 2. *"The developer can hint at which child elements may be stable across different renders with
>    a `key` prop."*

🔴 **Those two sentences are the entire design.** Everything a virtual DOM does well, and every
way it surprises you, follows from trading exactness for linearity. It does not find the minimal
edit script; it finds a good one, fast, by never comparing a node against anything but the node in
the same position or with the same key.

## The diff, in outline

```js
function diff(oldNode, newNode, index = 0, patches = []) {
  if (oldNode === undefined) {
    patches.push({ type: "CREATE", index, node: newNode });
  } else if (newNode === undefined) {
    patches.push({ type: "REMOVE", index });
  } else if (oldNode.type !== newNode.type) {
    patches.push({ type: "REPLACE", index, node: newNode });      // assumption 1
  } else if (newNode.type === "#text") {
    if (oldNode.text !== newNode.text) patches.push({ type: "TEXT", index, text: newNode.text });
  } else {
    const propPatch = diffProps(oldNode.props, newNode.props);
    if (propPatch) patches.push({ type: "PROPS", index, props: propPatch });
    diffChildren(oldNode.children, newNode.children, index, patches);
  }
  return patches;
}
```

Read the branches as the rules they encode:

- **Different types replace, they never merge.** React: when the root elements differ,
  *"React will tear down the old tree and build the new tree from scratch."* A `div` becoming a
  `section` throws away the subtree, its DOM nodes, their focus, their scroll position and any
  component state inside.
- **Same type updates in place.** React: it *"looks at the attributes of both, keeps the same
  underlying DOM node, and only updates the changed attributes."* This is the case that makes the
  approach worth anything — the node survives, so the caret, the selection and the running
  transition all survive with it.
- **Text is compared as a value**, and patched with `textContent` rather than a replacement, so
  changing a label does not destroy the node it lives in.
- **Children are the hard part**, and they get [18.2](./02-keys-and-the-cost.md) to themselves.

## Diffing props is not one comparison

```js
function diffProps(oldProps = {}, newProps = {}) {
  const changes = {};
  for (const key of new Set([...Object.keys(oldProps), ...Object.keys(newProps)])) {
    if (!Object.is(oldProps[key], newProps[key])) changes[key] = newProps[key];   // undefined ⇒ remove
  }
  return Object.keys(changes).length ? changes : null;
}
```

The union of both key sets is what catches **removals** — a prop that disappeared has to be
removed from the DOM node, and iterating only the new props misses it entirely. That is the single
most common bug in a hand-written patcher: stale `class`, `disabled` or `aria-*` attributes that
never go away.

Applying a prop is where the abstraction gets its knuckles dirty, because "prop" is three
different things at once:

| Kind | Applied with | The trap |
|---|---|---|
| Attribute | `setAttribute` / `removeAttribute` | attribute ≠ property — `setAttribute("value", …)` sets the *default*, not the current value |
| Property | `node[key] = value` | the live value of an input, `checked`, `selected` |
| Listener | `addEventListener` / `removeEventListener` | a new arrow every render is a different function — remove the old one or listeners accumulate |

🔴 **The `value` case is the reason "just set the attributes" does not work.** Writing to a
control's attribute after the user has typed does not change what they see, and writing to the
*property* moves the caret to the end unless the value actually differs — the guard from
[Phase 10 · 05 · Form and input events](../../phase-10-events/05-form-and-input-events/02-a-controlled-input.md).

## Patching, and why the index is fragile

```js
function patch(node, patches) {
  for (const p of patches) applyOne(nodeAt(node, p.index), p);
}
```

Addressing nodes by a walk index is what a teaching implementation does, and it is exactly what
breaks the moment a patch inserts or removes a sibling — every later index shifts. Real
implementations keep a **reference to the DOM node on the vnode itself** (`vnode.dom`), created
during mount and carried across the diff, so a patch never has to find its target twice.

📌 **Apply removals before insertions**, or an index-addressed list drifts under its own
modifications. It is the same hazard as mutating an array while iterating it.

## What the virtual DOM is not

- **It is not faster than the DOM.** It adds work — building a tree and comparing it — in
  exchange for *never doing the wrong DOM work*. Hand-written imperative updates that touch only
  what changed will beat it every time; hand-written updates that rebuild a list with `innerHTML`
  lose badly ([Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/README.md)).
- **It is not a rendering strategy on its own.** Batching, scheduling and when to flush are
  separate decisions, and they are where most of a framework's engineering actually goes.
- **It is not the only answer.** Fine-grained reactivity updates the one text node that depends on
  the one value that changed, with no tree and no diff at all
  ([17 · A tiny pub/sub and a reactive `signal`](../17-pubsub-and-signals/README.md)) — the same
  problem solved by making dependencies precise rather than by comparing outcomes.

## Gotchas

**Symptom:** A removed prop stays on the element — stale `class`, `disabled`, `aria-hidden`.
**Cause:** The prop diff iterated only the new props.
**Fix:** Iterate the union of both key sets, and treat `undefined` as "remove".

**Symptom:** Everything in a subtree is recreated after a trivial change.
**Cause:** The element type changed, so the whole subtree is replaced by design.
**Fix:** Keep the type stable — conditionally render *inside* an element rather than swapping it.

**Symptom:** The user's typing is overwritten, or the caret jumps to the end.
**Cause:** The patcher wrote `value` unconditionally, or set the attribute instead of the property.
**Fix:** Write the property, and only when it differs from the live value.

**Symptom:** Handlers fire twice, then three times.
**Cause:** New listeners added each patch without removing the previous ones.
**Fix:** Remove the old listener on every change — inline arrows are never equal between renders.

**Symptom:** Patches land on the wrong nodes as a list changes.
**Cause:** Nodes addressed by a walk index that shifts under insertions and removals.
**Fix:** Keep a DOM reference on the vnode; apply removals before insertions.

**Symptom:** Focus or scroll position is lost on every update.
**Cause:** Nodes being replaced rather than updated — a changed type, or a missing key.
**Fix:** Keep types stable, key lists properly ([18.2](./02-keys-and-the-cost.md)).

## Interview questions

**★ What is a virtual DOM?**
A plain object tree describing the intended DOM. Rendering produces a new one, a diff compares it
with the previous tree, and a patch step applies the differences — so application code declares
the result instead of the mutations.

**★ Why is the diff not an exact minimal diff?**
Because an optimal tree diff is *"in the order of O(n3)"*. Frameworks use a linear heuristic built
on two assumptions: different element types produce different trees, and keys identify stable
children.

**★ What happens when an element's type changes?**
The old subtree is torn down and rebuilt from scratch — DOM nodes, focus, scroll and any state
inside it are lost. Same type means the node is kept and only changed attributes are applied.

**★ Why must a prop diff walk both objects?**
Because a prop that vanished has to be removed from the DOM. Iterating only the new props leaves
stale attributes behind.

**★ Is a virtual DOM faster than direct DOM manipulation?**
No — it does strictly more work. It is *predictably good*: it avoids the catastrophic updates a
declarative rewrite would otherwise cause, without asking the author to hand-write the minimal
mutation.

**Why keep a DOM reference on the vnode?**
So a patch addresses its node directly. Index-based addressing shifts whenever a sibling is
inserted or removed.

---

[Topic index](./README.md) · Next → [Keys, and the cost](./02-keys-and-the-cost.md)
