---
title: "01 · The two families"
sidebar_label: "01 · The two families"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Node.parentNode`](https://developer.mozilla.org/en-US/docs/Web/API/Node/parentNode), [`Element.parentElement`](https://developer.mozilla.org/en-US/docs/Web/API/Element/parentElement), [`Element.children`](https://developer.mozilla.org/en-US/docs/Web/API/Element/children), [`Node.childNodes`](https://developer.mozilla.org/en-US/docs/Web/API/Node/childNodes), [`Element.firstElementChild`](https://developer.mozilla.org/en-US/docs/Web/API/Element/firstElementChild), [`Element.nextElementSibling`](https://developer.mozilla.org/en-US/docs/Web/API/Element/nextElementSibling), [`Element.replaceChildren()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren), [`Document.createTreeWalker()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker). Documentation-validated; **no timings**.

Every traversal property exists **twice**: a `Node` version that sees *every* node type, and an
`Element` version that sees elements only. They sit side by side and read almost identically,
which is exactly why the wrong one gets picked.

| Direction | `Node` version — sees text and comments | `Element` version — elements only |
|---|---|---|
| up | `parentNode` | `parentElement` |
| down (all) | `childNodes` — live `NodeList` | `children` — live `HTMLCollection` |
| down (first/last) | `firstChild` / `lastChild` | `firstElementChild` / `lastElementChild` |
| sideways | `nextSibling` / `previousSibling` | `nextElementSibling` / `previousElementSibling` |
| count | `childNodes.length` | `childElementCount` |

🔴 **Default to the `Element` column, always.** The `Node` column is correct only when you
genuinely care about text and comment nodes — which, outside a rich-text editor, a highlighter
or a sanitiser, is close to never.

## Why the `Node` family bites: whitespace is a node

The HTML parser turns the whitespace *between* your tags into text nodes. Formatted markup is
therefore full of them:

```html
<ul id="list">
  <li>One</li>
  <li>Two</li>
</ul>
```

```js
list.firstChild;          // #text — the newline and two spaces before <li>
list.firstElementChild;   // <li>One</li>
list.childNodes.length;   // 5 — text, li, text, li, text
list.childElementCount;   // 2
```

The bug this produces is nasty for two reasons. It is **invisible in the DOM inspector**, which
collapses whitespace and shows you a tidy list of two `<li>`s. And it **depends on how the HTML
was formatted** — minify the page, or build the same list with `createElement` and no whitespace
between appends, and `firstChild` starts returning the `<li>`.

That is the worst failure shape there is: code that works in production and breaks in
development, or the reverse, for a reason that never appears in the diff.

> **`firstElementChild` is immune to formatting.** That, not brevity, is the reason to prefer it.

The same applies sideways. `nextSibling` on a formatted list gives you the whitespace between two
`<li>`s; `nextElementSibling` gives you the next `<li>`.

## `parentNode` and `parentElement` differ in exactly one place

For any element inside the body they return the same thing. They part company at the top of the
tree:

```js
document.documentElement.parentNode;     // #document
document.documentElement.parentElement;  // null
```

`parentElement` returns `null` whenever the parent is not an element — the document node, or the
`DocumentFragment` at the root of a detached subtree.

🔴 **That `null` is a feature, not a limitation.** A hand-written up-walk using `parentNode`
climbs past `<html>` into the document node, where `tagName` is `undefined` and a naive loop
either keeps going or throws. The same walk written with `parentElement` terminates cleanly at
the `<html>` element. (And the walk you should actually write is `closest` —
[02 · `closest`, `matches` and `:scope`](./02-closest-matches-and-scope.md).)

## Both child collections are live

`children` and `childNodes` are **live**: they reflect the tree as it is *now*, not as it was
when you read the property. This is the same live-versus-static distinction as
[02 · Selecting elements](../02-selecting-elements/README.md), and it produces one specific bug
over and over:

```js
// ⚠️ removes every OTHER child
for (let i = 0; i < el.children.length; i++) el.children[i].remove();
```

Remove index 0 and every later element shifts down one, while `i` goes up — so half the children
survive. The same loop written backwards happens to work, which is worse, because it makes the
liveness look like a non-issue until someone rewrites the loop forwards.

```js
// ✅ snapshot first — a real array, static
[...el.children].forEach((child) => child.remove());
```

Spreading (or `Array.from`) takes a static copy **and** gives you `filter`, `map`, `find` and
`reduce`, none of which an `HTMLCollection` has — it is array-*like*, not an array.

⚠️ **When you want them all gone, do not loop at all.** `el.replaceChildren()` with no arguments
removes every child in one call, and `el.replaceChildren(a, b, c)` swaps the lot atomically.
`innerHTML = ''` does the same job but routes user-adjacent code through an HTML sink, which is
the habit [06 · Sanitising HTML](../06-sanitising-html/README.md) exists to break.

## When a manual walk is actually right

Rarely — and it is worth naming the cases so the exception does not quietly become the habit:

- You need **text and comment nodes**: a sanitiser, a text highlighter, a diff, a word count.
- You need to visit nodes **in document order across a whole subtree**, filtered by something the
  CSS selector language cannot express.

For those, the platform already has `document.createTreeWalker()` and `NodeIterator`, which take
a `whatToShow` bitmask and an optional filter and handle the ordering for you — no recursion to
get wrong. They are covered at **When Needed** depth in **19 · Selection, `Range` and
`contenteditable`** *(not written yet)*.

For everything else the rule stands: **selectors down, `closest` up.**

## Gotchas

**Symptom:** `firstChild` returned a text node instead of the element
**Cause:** Whitespace between tags is parsed into text nodes.
**Fix:** `firstElementChild`. Never use the `Node` family unless you want text nodes.

**Symptom:** The code works on the minified build and breaks in development (or the reverse)
**Cause:** The same whitespace — present in formatted HTML, absent after minification or after
building the subtree in JavaScript.
**Fix:** Switch to the `Element` family, which does not depend on formatting.

**Symptom:** The DOM inspector shows two children but `childNodes.length` is 5
**Cause:** The inspector collapses whitespace text nodes; `childNodes` counts them.
**Fix:** `childElementCount` for the number you meant.

**Symptom:** `nextSibling` skipped the element you expected
**Cause:** It landed on the whitespace text node between the two elements.
**Fix:** `nextElementSibling`.

**Symptom:** A hand-written up-walk ran past `<html>` and threw on `tagName`
**Cause:** `parentNode` returns the document node, which has no `tagName`.
**Fix:** `parentElement` (returns `null` there), or `closest`.

**Symptom:** A loop over `el.children` removed only every other child
**Cause:** `children` is live; removing shifts every later index down while the counter goes up.
**Fix:** Snapshot with `[...el.children]`, or `el.replaceChildren()` to clear.

**Symptom:** `el.children.filter(...)` is not a function
**Cause:** `HTMLCollection` is array-like, not an array.
**Fix:** `[...el.children].filter(...)` or `Array.from(el.children, fn)`.

**Symptom:** A cached `children` collection changed underneath you
**Cause:** It is live — it is a view of the tree, not a snapshot of it.
**Fix:** Spread it at the point you read it if you need the list to hold still.

## Interview questions

**★ `children` versus `childNodes`?**
`children` is a live `HTMLCollection` of elements only; `childNodes` is a live `NodeList` of every
node type, including the whitespace text nodes the parser creates between tags. Both are live, so
both need a snapshot before you mutate while iterating.

**★ Why does `firstChild` surprise people?**
In formatted HTML it is usually a `#text` node, because whitespace between tags is a text node.
`firstElementChild` skips non-elements and — the part that matters — is independent of how the
markup happens to be formatted, so it cannot break when the build minifies.

**★ Why `parentElement` over `parentNode`?**
They are identical everywhere except the top of the tree: `document.documentElement.parentNode`
is the document, `parentElement` is `null`. That `null` terminates an up-walk at the element
boundary instead of climbing into a node with no `tagName`.

**★ Why did a loop that removes children skip half of them?**
`children` is live. Removing index 0 shifts every later child down one while the loop counter
goes up, so alternate children are never visited. Snapshot with the spread, or use
`replaceChildren()`.

**★ Is an `HTMLCollection` an array?**
No — array-*like*. It has `length` and index access but none of the array methods, so it needs
`Array.from` or a spread before `filter`/`map`.

**How would you remove every child of an element?**
`el.replaceChildren()` — one call, no loop, no HTML string. `innerHTML = ''` works but puts an
HTML sink in code that may later be handed user data.

**When would you actually walk the tree by hand?**
When you need text or comment nodes, or document-order traversal with a filter CSS cannot
express — a sanitiser, a highlighter, a word count. Even then, `createTreeWalker` is the platform
answer rather than a hand-rolled recursion.

---

[Topic index](./README.md) · Next → [02 · `closest`, `matches` and `:scope`](./02-closest-matches-and-scope.md)
