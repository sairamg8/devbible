---
title: "01.1 · A tree of nodes"
sidebar_label: "01 · A tree of nodes"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Introduction to the DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction), [`Node`](https://developer.mozilla.org/en-US/docs/Web/API/Node), [`Element`](https://developer.mozilla.org/en-US/docs/Web/API/Element). Documentation-validated.

**The DOM is not part of JavaScript.** MDN states it plainly, and starting here prevents a
whole category of confusion later:

> "The DOM is **not part of the JavaScript language**, but is instead a **Web API** used to
> build websites."

> "The DOM is not a programming language, but without it, the JavaScript language wouldn't
> have any model or notion of web pages, HTML documents, SVG documents, and their component
> parts."

And the consequence you meet the first time you run the same code in Node:

> "JavaScript can be used in other contexts where the DOM is unavailable. For example,
> Node.js runs JavaScript programs on a computer but provides a different set of APIs, and
> **the DOM API is not a core part of the Node.js runtime**."

🔴 **`document` is not a JavaScript feature; it is something the browser hands you.** This is
the host-versus-language split from
[Phase 0 · 06 · Hosts and globals](../../phase-0-how-javascript-runs/06-hosts-and-globals.md),
and it is why `document is not defined` in Node is correct behaviour rather than a missing
polyfill.

MDN also notes the DOM was designed to be usable from any language:

> "The DOM was designed to be **independent of any particular programming language**, making
> the structural representation of the document available from a single, consistent API."

Which explains some of the API's shape — `NodeList` rather than `Array`, `getElementsByTagName`
rather than a method returning a JavaScript collection. **The awkward parts are usually
language-neutrality showing through**, not bad design in a JavaScript sense.

## The document as a tree

MDN:

> "The DOM represents a document with a **logical tree**. Each branch of the tree ends in a
> node, and each node contains objects. DOM methods allow programmatic access to the tree.
> With them, you can change the document's structure, style, or content."

```html
<body>
  <p>Hello <em>there</em></p>
</body>
```

```
body
└── p
    ├── #text  "Hello "
    └── em
        └── #text  "there"
```

Two things in that diagram catch people out, and both come from the same fact.

## Nodes versus elements

MDN:

> "**Every object located within a document is a node of some kind.** In an HTML document, an
> object can be an **element** node but also a **text** node or **attribute** node."

> "The **element** type is based on node. It refers to an element or a node of type element
> returned by a member of the DOM API."

**Element is a subtype of Node.** So every element is a node; most nodes are not elements.
The common node types you will actually meet:

| Node type | Example | Is it an element? |
|---|---|---|
| Element | `<p>` | yes |
| Text | `"Hello "` | **no** |
| Comment | `<!-- … -->` | **no** |
| Document | the root object | **no** |
| DocumentFragment | a detached container | **no** |

🔴 **Whitespace between tags is a text node.** This is the single most common surprise in the
DOM:

```html
<ul>
  <li>one</li>
  <li>two</li>
</ul>
```

`ul.childNodes` has **five** entries — text, `li`, text, `li`, text — because the newline and
indentation between the tags are real text nodes. `ul.children` has **two**, because it
holds elements only.

That distinction runs through the entire API as paired properties:

| Node version (all node types) | Element version (elements only) |
|---|---|
| `childNodes` | `children` |
| `firstChild` | `firstElementChild` |
| `lastChild` | `lastElementChild` |
| `nextSibling` | `nextElementSibling` |
| `parentNode` | `parentElement` |
| `childElementCount` | — (`children.length`) |

**Default to the element versions.** They skip whitespace and comments, which is almost
always what you meant. Reach for the node versions only when you genuinely need text or
comment nodes — a text-processing tool, a sanitiser, a diffing algorithm.

The one pair that is *not* about whitespace: `parentNode` and `parentElement` differ only at
the top, where `document.documentElement.parentNode` is the `Document` and
`.parentElement` is `null` — because `Document` is not an element.

## The core interfaces

MDN's list, and what each is for:

- **`Document`** — "The root document object itself." Not an element; the tree's container.
  `document.documentElement` is `<html>`, `document.body` is `<body>`.
- **`Node`** — "Every object located within a document is a node of some kind." The base
  interface: tree structure, `childNodes`, `textContent`, `appendChild`.
- **`Element`** — attributes, `classList`, `querySelector`, `innerHTML`. Everything you
  usually want.
- **`Attr`** — "Attributes are nodes in the DOM just like elements are." Rarely handled
  directly; `getAttribute`/`setAttribute` hide it.
- **`NodeList`** — "A common collection type for groups of DOM nodes." Array-*like*, not an
  array — covered in [02 · Selecting elements](../README.md).

For HTML specifically there is one more layer MDN names: elements are *"further enhanced by
the HTML DOM API's `HTMLElement` interface as well as other interfaces describing capabilities
of specific kinds of elements."* So an `<input>` is an `HTMLInputElement`, which extends
`HTMLElement`, which extends `Element`, which extends `Node`. That chain is why `.value`
exists on an input and not on a `<div>`.

## Markup is a serialisation of the tree, not the tree

The HTML you write is parsed **once** into the tree; after that the tree is the truth.

- **Viewing source shows the original bytes**, not the current DOM. Devtools' Elements panel
  shows the live tree, which is why they disagree after any script runs.
- **The parser fixes invalid markup**, so what you get may not match what you wrote: an
  unclosed `<li>`, a `<div>` inside a `<p>`, or a stray `<tbody>` the parser inserts into a
  table. **The DOM is what the parser produced**, and querying for something you wrote but
  the parser moved is a real and confusing failure.
- **`innerHTML` runs the parser again** on a fragment and replaces a subtree with the result.
  That is why it is both convenient and the topic of
  [06 · Sanitising HTML](../README.md).

## Gotchas

**Symptom:** `document is not defined` in Node
**Cause:** MDN: *"the DOM API is not a core part of the Node.js runtime."* The DOM is a Web
API, not a language feature.
**Fix:** Guard with `typeof document !== "undefined"`, or use a DOM implementation like
`jsdom` for tests.

**Symptom:** `childNodes.length` is bigger than expected
**Cause:** Whitespace between tags is a **text node**.
**Fix:** Use `children`, which holds elements only.

**Symptom:** `firstChild` is not the element you can see
**Cause:** It is the newline before it.
**Fix:** `firstElementChild`.

**Symptom:** `parentElement` is `null` at the top of the tree while `parentNode` is not
**Cause:** The parent is the `Document`, which is **not an element**.
**Fix:** Expected — this is the one pair that differs for a reason other than whitespace.

**Symptom:** Devtools shows different HTML from "view source"
**Cause:** View-source shows the original bytes; devtools shows the **live tree** after
parsing and after every script.
**Fix:** Expected. Trust devtools for the current state.

**Symptom:** A query finds nothing for an element that is clearly in your HTML
**Cause:** The parser corrected invalid markup and moved or dropped it.
**Fix:** Check the live tree in devtools rather than the source, and validate the markup.

## Interview questions

**★ Is the DOM part of JavaScript?**
No. MDN: *"The DOM is not part of the JavaScript language, but is instead a Web API."* It is
also *"independent of any particular programming language"*, which is why the API feels
un-JavaScript-like in places. Node provides a different set of APIs and no DOM by default.

**★ What is the difference between a node and an element?**
**Every element is a node; most nodes are not elements.** MDN: *"Every object located within a
document is a node of some kind… an object can be an element node but also a text node or
attribute node."* Text, comments, the document and fragments are all nodes.

**★ Why does `childNodes` return more than you expect?**
Whitespace between tags is a real **text node**. `children` returns elements only, which is
almost always what you wanted — and the same pairing exists for `firstChild`/`firstElementChild`
and `nextSibling`/`nextElementSibling`.

**★ When do `parentNode` and `parentElement` differ?**
Only at the top: `document.documentElement.parentNode` is the `Document`, while
`.parentElement` is `null`, because `Document` is not an element.

**★ Why does devtools show different HTML from view-source?**
View-source shows the original bytes; devtools shows the **live tree**, after parsing (which
corrects invalid markup) and after every script that has run. The tree is the truth; the
markup was only its serialisation.

**Why does `.value` exist on an `<input>` but not a `<div>`?**
Because of the interface chain — `HTMLInputElement` extends `HTMLElement` extends `Element`
extends `Node`. MDN notes elements are *"further enhanced by the HTML DOM API's `HTMLElement`
interface as well as other interfaces describing capabilities of specific kinds of
elements."*

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
