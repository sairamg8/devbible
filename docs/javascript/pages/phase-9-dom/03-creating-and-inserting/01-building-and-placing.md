---
title: "03.1 · Building and placing nodes"
sidebar_label: "01 · Building and placing"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Document.createElement()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement), [`Element.append()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/append), [`Node.appendChild()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild), [`Element.insertAdjacentHTML()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML), [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment). Documentation-validated.

**Creating a node and placing a node are separate steps, and the gap between them is where
the performance is.** A node you have created but not inserted is not in the document, costs
no layout, and can be built up freely.

## Creating

```js
const li = document.createElement("li");
li.textContent = "one";                 // safe — no parsing, no markup
li.className = "item";
```

`createElement` returns a detached element. Nothing is rendered, no layout is computed, and
mutating it is cheap — because it is not part of the tree yet.

**Set text with `textContent`, never `innerHTML`**, when the content is text. It is faster and
it cannot inject markup — the boundary that [04](../README.md) and
[06 · Sanitising HTML](../README.md) are about.

## Placing: the modern methods

The `append`/`prepend`/`before`/`after` family replaced `appendChild` and `insertBefore`, and
is better in three concrete ways.

```js
parent.append(a, b, "some text");   // ✅ multiple nodes, and strings
parent.appendChild(a);               // one node only, no strings
```

| | Modern (`append`, …) | Legacy (`appendChild`, …) |
|---|---|---|
| Multiple arguments | **yes** | no — one call each |
| Accepts strings | **yes** — inserted as text | no — `TypeError` |
| Returns | `undefined` | the appended node |

🔴 **Strings passed to `append` become text nodes, not markup.** So `append` is safe with user
input in a way `innerHTML` is not:

```js
el.append(userInput);        // ✅ always text, even if it contains <script>
el.innerHTML = userInput;    // ⚠️ parsed as HTML
```

The four placement methods cover every position:

```js
parent.append(node);      // last child
parent.prepend(node);     // first child
target.before(node);      // previous sibling
target.after(node);       // next sibling
```

`appendChild` is still worth knowing because it **returns the node**, which occasionally
chains nicely — and because you will read it constantly in older code.

## Moving, not copying

Inserting a node that is already in the document **moves it**. There is no copy step and no
error:

```js
listB.append(listA.firstElementChild);   // the element is now in listB, gone from listA
```

This is genuinely useful for reordering, and a real surprise when you meant to duplicate.
To copy, clone first:

```js
target.append(node.cloneNode(true));     // true = deep, including descendants
```

`cloneNode(false)` copies the element alone with no children. **Neither copies event
listeners** — a clone is markup-equivalent, not behaviour-equivalent. That catches people
cloning a `<template>` row that "worked" and finding its buttons dead.

## Build detached, insert once

Each insertion into the live document can trigger layout work. Inserting a thousand rows one
at a time asks the browser to do that a thousand times; building them detached and inserting
once asks for it once.

```js
// ⚠️ touches the live document 1000 times
for (const row of rows) list.append(makeRow(row));

// ✅ one insertion
const frag = document.createDocumentFragment();
for (const row of rows) frag.append(makeRow(row));
list.append(frag);
```

**A `DocumentFragment` is a container that disappears when inserted** — appending it moves its
children into the parent and leaves the fragment empty. So the parent ends up with the rows
as direct children, with no wrapper element.

> The browser may batch DOM writes anyway, so the difference is not always what a naive model
> predicts — but building detached is never *worse*, and it is the pattern that makes the
> intent explicit. This page does not claim a measured speedup, because none was measured
> here; the mechanism is what is being taught.

The same reasoning gives the other batching trick:

```js
list.replaceChildren(...newRows);    // one operation: clear and fill
```

Batching in full — `<template>`, `cloneNode`, and building a 1 000-row table — is this
phase's *Batching DOM work* topic in the Understand tier.

## `insertAdjacentHTML` and its four positions

When you genuinely need to insert **markup**, this is the tool. MDN's four positions:

```html
<!-- beforebegin -->
<p>
  <!-- afterbegin -->
  foo
  <!-- beforeend -->
</p>
<!-- afterend -->
```

- **`"beforebegin"`** — "Before the element. Only valid if the element is in the DOM tree and
  has a parent element."
- **`"afterbegin"`** — "Just inside the element, before its first child."
- **`"beforeend"`** — "Just inside the element, after its last child."
- **`"afterend"`** — "After the element. Only valid if the element is in the DOM tree and has
  a parent element."

The two outer positions require a parent, so calling them on a detached element does nothing
useful.

### Why it beats `innerHTML +=`

MDN:

> "The `insertAdjacentHTML()` method **does not reparse the element it is being used on**, and
> thus it does not corrupt the existing elements inside that element. This avoids the extra
> step of serialization, making it much faster than direct `innerHTML` manipulation. **This
> also means existing event listeners are preserved.**"

🔴 **`el.innerHTML += "…"` destroys and rebuilds the entire subtree.** Every existing child is
serialised back to a string, discarded, and re-parsed as new nodes. Consequences:

- **Every event listener on those children is gone**, because the nodes are gone.
- Any state not expressible in markup — a checkbox's `checked` **property**, focus, scroll
  position, a `<video>`'s playback — is lost.
- References you were holding now point at **detached** nodes.

`insertAdjacentHTML(where, html)` adds without touching what is there. **If you find
`innerHTML +=` in code, it is almost always this bug.**

### The security warning

MDN, and it is the same warning as `innerHTML`:

> "This method parses its input as HTML or XML, writing the result into the DOM. APIs like
> this are known as **injection sinks** and are potentially a vector for **cross-site
> scripting (XSS) attacks** if the input originally came from an attacker. **Do not use with
> untrusted strings.**"

MDN's alternatives, in order of preference:

- `Element.insertAdjacentText()` or `Node.textContent` for plain text
- `TrustedHTML` objects with the `require-trusted-types-for` CSP directive
- a sanitiser such as DOMPurify

**`insertAdjacentText` exists precisely so you can use the four positions without the sink.**
Full treatment in [06 · Sanitising HTML](../README.md).

## Gotchas

**Symptom:** An element vanished from one list when added to another
**Cause:** Inserting a node already in the document **moves** it.
**Fix:** `node.cloneNode(true)` if you meant to copy.

**Symptom:** A cloned row's buttons do nothing
**Cause:** `cloneNode` does not copy **event listeners**.
**Fix:** Re-attach after cloning, or use event delegation on a stable ancestor.

**Symptom:** `appendChild` throws on a string
**Cause:** It takes a node only.
**Fix:** `append`, which accepts strings and multiple arguments — and inserts strings as
**text**.

**Symptom:** Listeners stop working after new content is added
**Cause:** `innerHTML +=` reparsed the whole subtree, replacing every child node.
**Fix:** `insertAdjacentHTML("beforeend", …)`, which MDN says *"does not reparse the element
it is being used on"* and so preserves listeners.

**Symptom:** A checkbox loses its checked state when sibling content is added
**Cause:** Same reparse — `checked` is a **property**, not serialised into the markup.
**Fix:** Same fix. Do not rebuild a subtree to add to it.

**Symptom:** `insertAdjacentHTML("beforebegin", …)` does nothing
**Cause:** The outer positions require the element to have a **parent**; it was detached.
**Fix:** Insert the element first, or use an inner position.

**Symptom:** A thousand rows freeze the page while inserting
**Cause:** Each insertion touches the live document.
**Fix:** Build in a `DocumentFragment` and insert once, or `replaceChildren(...rows)`.

## Interview questions

**★ What is the difference between `append` and `appendChild`?**
`append` takes **multiple** arguments and accepts **strings** (inserted as text nodes);
`appendChild` takes exactly one node and throws on a string, but **returns** the node. `append`
is the better default, and its string handling makes it safe with user input where `innerHTML`
is not.

**★ What happens if you append a node that is already in the document?**
It **moves** — there is no copy and no error. Use `cloneNode(true)` to duplicate, remembering
that a clone does **not** carry event listeners.

**★ Why is `el.innerHTML += "…"` a bug?**
It serialises the existing subtree to a string, discards it, and re-parses everything — so all
event listeners on those children are lost, along with property-only state like `checked`,
focus and scroll, and any references you held now point at detached nodes.
`insertAdjacentHTML` *"does not reparse the element it is being used on"* and preserves
listeners.

**★ What are the four `insertAdjacentHTML` positions?**
`beforebegin` and `afterend` are outside the element (and require a parent); `afterbegin` and
`beforeend` are inside, at the start and the end.

**★ Why build in a `DocumentFragment`?**
So the work happens off the live document and only one insertion touches it. The fragment
disappears on insertion, leaving its children as direct children of the parent — no wrapper.

**How do you insert at a position without the XSS risk?**
`insertAdjacentText`, which takes the same four positions. `insertAdjacentHTML` is an
**injection sink** — MDN: *"Do not use with untrusted strings."*

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
