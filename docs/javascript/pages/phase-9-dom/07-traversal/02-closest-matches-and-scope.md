---
title: "02 · closest, matches and :scope"
sidebar_label: "02 · closest, matches and :scope"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.closest()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest), [`Element.matches()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches), [`Element.querySelectorAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/querySelectorAll), [`:scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/:scope), [`Node.contains()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/contains), [`Node.compareDocumentPosition()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition), [`Node.getRootNode()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/getRootNode), [`Node.isConnected`](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected), [`CSS.escape()`](https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape_static). Documentation-validated; **no timings**.

The properties in [01 · The two families](./01-the-two-families.md) move one step at a time. This
chunk is the API that moves as far as it needs to, in one call, described by a selector.

## `closest` — the up-walk, done properly

> "traverses the element and its parents (heading toward the document root) until it finds a node
> that matches the specified CSS selector" — MDN

Three details in that sentence that get missed:

**1 · It starts with the element itself.** `button.closest('button')` returns the button. This is
what makes it right for delegation: the click may land on a `<span>` or an `<svg>` *inside* the
button, or on the button directly, and both must resolve to the same button.

**2 · It takes a full CSS selector**, not a tag name:

```js
event.target.closest('[data-row-id]');
event.target.closest('form:not([novalidate])');
event.target.closest('li.item, li.header');
```

**3 · It returns `null` when nothing matches**, so the result is always checked — and that `null`
is a normal outcome, not an error:

```js
const row = event.target.closest('tr[data-id]');
if (!row) return;              // the click was outside any row
```

An invalid selector throws a `SyntaxError`, exactly as `querySelector` does. That only bites when
the selector is built from a variable — `` closest(`#${id}`) `` explodes on an id that starts
with a digit or contains a space. Use an attribute selector, or `CSS.escape(id)`.

## `matches` — the other half

`closest` finds an ancestor; `matches` asks a yes/no question about one element and returns a
boolean:

```js
if (event.target.matches('a[href^="http"]')) { /* external link */ }
```

Together they are the entire vocabulary of event delegation
([Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md)):
`matches` when the handler must fire only on a direct hit, `closest` when the click can land on
anything inside the thing you care about.

🔴 **Reach for `closest` by default.** `matches` on a nested structure is the exact cause of the
classic *"my click handler stopped working when the designer added an icon to the button"* bug —
the target is now the `<svg>`, and `<svg>` does not match `button`.

Neither method mutates anything, so both are safe to call inside a hot handler on every event.

## Going down: the selector is matched against the document

`querySelector` and `querySelectorAll` are traversal too — the down-walk — and they sidestep the
whitespace problem entirely because they only ever return elements.

The one trap is that **a descendant selector is evaluated against the whole document**, and only
the *results* are filtered to descendants of the element you called it on:

```html
<div class="outer"><section id="s"><p>hit</p></section></div>
```

```js
s.querySelectorAll('div p');   // [<p>hit</p>] — the matching div is OUTSIDE #s
```

The `<div>` is not inside `#s`, yet the `<p>` is returned, because the `div p` part matched
somewhere in the document and the `<p>` happens to be a descendant of `#s`.

**`:scope` fixes it** by anchoring the selector to the element it was called on:

```js
s.querySelectorAll(':scope > p');    // direct element children only
s.querySelectorAll(':scope div p');  // now the div must be inside #s
```

`:scope > *` is also the readable way to say *"direct children matching X"*, which `children`
alone cannot express — you would otherwise spread it and filter.

## Containment: `contains` and `compareDocumentPosition`

```js
container.contains(node);      // true if node is a descendant — OR node itself
container.contains(null);      // false, documented, never throws
```

⚠️ **`contains` returns `true` for the node itself.** MDN defines it as "a descendant of this
node, **or the node itself**". A click-outside check written as `!dropdown.contains(e.target)` is
correct *because* of that: a click on the dropdown's own padding or border counts as inside.

For **ordering** rather than containment, `compareDocumentPosition` returns a bitmask — and it
must be tested with `&`, never `===`, because several bits can be set at once:

```js
const pos = a.compareDocumentPosition(b);
pos & Node.DOCUMENT_POSITION_FOLLOWING;    // b comes after a in document order
pos & Node.DOCUMENT_POSITION_PRECEDING;    // b comes before a
pos & Node.DOCUMENT_POSITION_CONTAINED_BY; // b is inside a
pos & Node.DOCUMENT_POSITION_DISCONNECTED; // different trees — no defined order
```

When `b` is inside `a`, **both** `CONTAINED_BY` and `FOLLOWING` are set. That is the whole reason
the `===` version of this code is wrong, and it is a favourite interview follow-up.

## Roots, shadow boundaries and detached trees

`closest` stops at the top of the tree it is in. Inside a shadow tree that top is the **shadow
root**, not the document — and a `ShadowRoot` is a `DocumentFragment`, not an element, so the
ancestor walk simply ends there. To continue, hop deliberately through the host:

```js
node.getRootNode();                   // the Document, or the ShadowRoot it lives in
node.getRootNode().host;              // the element the shadow tree is attached to
node.getRootNode({ composed: true }); // climb out through nested shadow trees to the Document
```

This is a feature of encapsulation, not a bug to route around casually — a component that reaches
past its own root has stopped being encapsulated. Cross the boundary when you mean to, and say so
in the code.

The same "top of *a* tree" logic covers a **detached** subtree, one built with `createElement` and
not yet inserted. Traversal works normally inside it, and `getRootNode()` returns the top of that
detached tree rather than the document. So ordinary traversal cannot tell you whether you are in
the page — this can:

```js
node.isConnected;   // false until the subtree is inserted into the document
```

Worth remembering, because a detached node passes every ordinary traversal test while being
invisible, unstyled and unmeasurable.

## Gotchas

**Symptom:** A click handler stopped firing after an icon was added inside the button
**Cause:** `matches` tests the exact target, and the target is now the `<svg>`.
**Fix:** `event.target.closest('button')` — it starts at the element itself and walks up.

**Symptom:** `closest` threw a `SyntaxError`
**Cause:** The selector was built from a variable that is not a valid CSS identifier.
**Fix:** An attribute selector — `closest('[data-id="' + id + '"]')` — or `CSS.escape(id)`.

**Symptom:** `closest` returned `null` for an ancestor visible in the inspector
**Cause:** The element is inside a shadow tree; the walk ends at the shadow root.
**Fix:** `node.getRootNode().host`, then `closest` again — deliberately, not by reflex.

**Symptom:** `el.querySelectorAll('div p')` matched a `<p>` whose `<div>` is outside `el`
**Cause:** The selector is matched against the whole document; only the results are scoped.
**Fix:** `:scope` — `el.querySelectorAll(':scope div p')`.

**Symptom:** A click-outside handler fires when clicking the panel's own border
**Cause:** The check used a strict-descendant test instead of `contains`.
**Fix:** `!panel.contains(e.target)` — `contains` counts the node itself as inside.

**Symptom:** `compareDocumentPosition(...) === Node.DOCUMENT_POSITION_FOLLOWING` is false for a
node that clearly follows
**Cause:** It is a bitmask, and a contained node sets `CONTAINED_BY` **and** `FOLLOWING`.
**Fix:** Test with `&`.

**Symptom:** Element measurements are all zero and styles do not apply
**Cause:** The subtree is still detached; it has no layout.
**Fix:** Check `node.isConnected` — traversal alone cannot tell you.

**Symptom:** `closest` returned the element you passed in, not an ancestor
**Cause:** That is documented behaviour — it starts at the element itself.
**Fix:** Nothing; if you truly need a strict ancestor, start from `el.parentElement`.

## Interview questions

**★ What does `closest` do, exactly?**
Starts at the element **itself** and walks up through its ancestors until one matches the CSS
selector, returning that element or `null`. Starting at itself is what makes it correct for
delegation, where the click may land on the target or on anything nested inside it.

**★ `closest` versus `matches`?**
`matches` is a boolean test on one element; `closest` searches the element and its ancestors.
Delegation wants `closest` by default — `matches` breaks the moment someone nests an icon inside
the clickable thing.

**★ Does `node.contains(node)` return true?**
Yes — MDN defines it as "a descendant of this node, **or the node itself**". It is also why
`!container.contains(event.target)` is the standard click-outside check, and `contains(null)`
returns `false` rather than throwing.

**★ Why doesn't `closest` find an ancestor across a shadow boundary?**
A `ShadowRoot` is a `DocumentFragment`, not an element, so the ancestor walk ends there. Cross it
deliberately with `getRootNode().host`, or `getRootNode({ composed: true })` to reach the document
through nested shadow trees.

**★ What is `:scope` for?**
Anchoring a selector to the element you called `querySelectorAll` on. Without it the selector is
matched against the whole document and merely filtered to descendants, so
`el.querySelectorAll('div p')` can return a `<p>` whose `<div>` is outside `el`. `:scope > *` is
also how you express "direct children matching X".

**★ Why must `compareDocumentPosition` be tested with `&`?**
It returns a bitmask and more than one bit can be set — a node inside another is both
`CONTAINED_BY` and `FOLLOWING`. An `===` comparison against a single constant is therefore wrong
for exactly the case people test first.

**How do you tell whether a node is really in the page?**
`node.isConnected`. A detached subtree traverses perfectly well and `getRootNode()` returns the
top of *that* tree, so traversal cannot tell you — `isConnected` is `false` until the subtree is
inserted.

**Rewrite this up-walk safely: `while (n.tagName !== 'TR') n = n.parentNode`.**
`n.closest('tr')`. The original cannot express an attribute selector, throws once it reaches the
document node (no `tagName`), never terminates on no match, and ignores shadow boundaries.

---

← [01 · The two families](./01-the-two-families.md) · [Topic index](./README.md) ·
**08 · Classes and styles from JavaScript** *(not written yet)* →
