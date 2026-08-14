---
title: "01 · Build off-document"
sidebar_label: "01 · Build off-document"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment), [`DocumentFragment()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment/DocumentFragment), [`<template>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template), [`HTMLTemplateElement.content`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/content), [`Node.cloneNode()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/cloneNode), [`Element.append()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/append), [`Element.replaceChildren()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren), [`Node.isConnected`](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected). Documentation-validated; **no timings**.

## The shape

```js
// ⚠️ each append touches the live document
for (const item of items) list.append(buildRow(item));

// ✅ build detached, insert once
const frag = document.createDocumentFragment();
for (const item of items) frag.append(buildRow(item));
list.append(frag);
```

**Why it helps, mechanically:** a node that is not in the document has no layout and no style
resolution to invalidate. Work done inside the fragment costs the rendering engine nothing, and
the document sees a single structural change instead of one per row.

⚠️ **Modern engines already coalesce a lot of this** — they do not lay out after every statement,
only when something forces it or when the frame is rendered. So do not sell the fragment as a
speed trick with a number attached; sell it as the shape that **cannot** go wrong. The version
that genuinely does hurt is a loop that appends *and reads back a layout property* each time,
which is layout thrashing and is a different topic.

## `DocumentFragment`, precisely

```js
const frag = document.createDocumentFragment();   // or new DocumentFragment()
```

- It is a **node**, so it has `append`, `querySelector`, `children` and the rest — but it is not
  an element and has no tag, no parent and no styles.
- Inserting it moves **its children** into the target and leaves the **fragment empty**. It is
  spent after one insertion, which surprises people who try to reuse one.
- Its children are not in the document, so `isConnected` is `false`, they have no layout, and
  `getBoundingClientRect()` returns zeros until they are inserted.

That last point is the practical constraint: **you cannot measure a node while it is still in the
fragment**. Anything that needs a measurement has to happen after the single insertion.

## `<template>` — markup that is inert until you use it

```html
<template id="row">
  <tr class="row">
    <td class="name"></td>
    <td class="price"></td>
  </tr>
</template>
```

```js
const tpl = document.getElementById('row');

function buildRow(item) {
  const row = tpl.content.cloneNode(true);   // 🔴 clone — never use content directly
  row.querySelector('.name').textContent = item.name;
  row.querySelector('.price').textContent = format(item.price);
  return row;
}
```

Two properties make `<template>` more than a string of HTML:

**1 · Its content is inert.** The parser puts the markup in a separate document fragment
(`template.content`), so **images inside are not fetched, scripts are not executed, and nothing is
rendered or styled** until the content is cloned into a live document. A `<template>` full of
`<img>` tags costs no requests.

**2 · The structure is real, parsed HTML.** That matters for table rows: `<tr>` outside a table
context is not something you can produce reliably by assigning `innerHTML` to an arbitrary
element, because the HTML parser has strict rules about where table elements may live.
`<template>` sidesteps that entirely.

🔴 **`tpl.content` is the live fragment, not a copy.** Use it directly and you *move* the
template's children into the document — the template is then empty and the second row never
appears. **Always `cloneNode(true)`.** ("`true`" is deep; without it you clone the fragment and
none of its contents.)

⚠️ And from [10 · Removing and replacing](../10-removing-and-replacing/README.md): **cloning does
not carry `addEventListener` listeners**, which is one more argument for delegating events to the
list container rather than binding per row.

## `append` already takes many things

`append` and `prepend` are variadic and accept **strings**, which are inserted as text:

```js
cell.append(icon, ' ', item.name);       // one call, and the name is text, not markup
list.replaceChildren(...items.map(buildRow));   // whole list, one operation
```

`replaceChildren(...)` is the cleanest full-list render there is: it clears and fills in a single
call, with no fragment and no loop. Use a fragment when you are **adding** to what is already
there, and `replaceChildren` when you are **replacing** it.

## Building from a string, safely

For markup-shaped work, `insertAdjacentHTML` inserts a parsed string at a position without
re-parsing the whole container the way `innerHTML +=` does:

```js
list.insertAdjacentHTML('beforeend', rowsHtml);
```

🔴 **It is an HTML sink.** Everything from [06 · Sanitising HTML](../06-sanitising-html/README.md)
applies — never interpolate user data into that string. And `innerHTML +=` is worse than it looks
for a second reason: it serialises the existing children and re-parses them, **destroying and
recreating every existing node**, which throws away their listeners, their focus and their
identity.

## The pattern, end to end

```js
function render(items) {
  const frag = document.createDocumentFragment();
  for (const item of items) frag.append(buildRow(item));   // no document contact
  list.replaceChildren(frag);                              // exactly one
}
```

One listener on `list` handles every row's clicks; one insertion puts them all in place; nothing
in the loop can force a layout because nothing in the loop is in the document.

## Gotchas

**Symptom:** Only the first row appears when using a `<template>`
**Cause:** `tpl.content` was inserted directly, moving the template's children into the document.
**Fix:** `tpl.content.cloneNode(true)` every time.

**Symptom:** A clone of the template is empty
**Cause:** `cloneNode()` without `true` is shallow.
**Fix:** `cloneNode(true)`.

**Symptom:** Reusing a `DocumentFragment` for a second batch inserts nothing
**Cause:** Insertion moves its children out; the fragment is left empty.
**Fix:** Create a new fragment per batch.

**Symptom:** `getBoundingClientRect()` returns all zeros while building
**Cause:** Nodes in a fragment are not in the document and have no layout.
**Fix:** Measure after insertion.

**Symptom:** `<tr>` elements built with `innerHTML` vanish or land in the wrong place
**Cause:** The HTML parser's table rules reject table elements outside a table context.
**Fix:** A `<template>`, or `createElement`.

**Symptom:** Rows built from a template have no click behaviour
**Cause:** `cloneNode` does not copy `addEventListener` listeners.
**Fix:** Delegate to the container instead of binding per row.

**Symptom:** Appending with `innerHTML +=` cleared the user's focus and broke existing handlers
**Cause:** It re-parses the whole container, destroying and rebuilding every existing node.
**Fix:** `insertAdjacentHTML('beforeend', …)`, or `append` with real nodes.

**Symptom:** Images in a template were requested before use
**Cause:** They were not in a real `<template>` — template content is inert and fetches nothing.
**Fix:** Check the markup is inside `<template>`, not a hidden `<div>`.

## Interview questions

**★ What is a `DocumentFragment` and why use one?**
A parentless container node. Its children are not in the document, so building inside it cannot
invalidate style or layout, and inserting it moves all its children in one operation. It is
emptied by the insertion, so it is one-use.

**★ How is `<template>` different from a hidden `<div>`?**
Its content is **inert**: parsed but held in a separate fragment, so images are not fetched,
scripts do not run, and nothing is rendered or styled until it is cloned into a live document. A
hidden `<div>` fetches its images.

**★ What is the mistake people make with `template.content`?**
Using it directly. It is the live fragment, so inserting it *moves* the template's children out
and the template is empty from then on. Always `cloneNode(true)`.

**★ Why is `innerHTML +=` a bad way to append?**
It serialises the container's existing children and re-parses everything, destroying and
recreating every existing node — losing listeners, focus and node identity — as well as being an
HTML sink.

**★ Can you measure an element while it is in a fragment?**
No. It is not in the document, so it has no layout: `isConnected` is `false` and
`getBoundingClientRect()` returns zeros. Measure after inserting.

**Fragment or `replaceChildren`?**
`replaceChildren(...nodes)` when you are replacing the whole set — it clears and fills in one
call. A fragment when you are adding to existing content.

**Does building off-document make it fast?**
It removes a category of forced work, and it is the shape that cannot go wrong — but engines
already coalesce much of this, and the thing that actually freezes a page is a long task, not the
number of `append` calls. That is
[02 · Not freezing the page](./02-not-freezing-the-page.md).

---

[Topic index](./README.md) · Next → [02 · Not freezing the page](./02-not-freezing-the-page.md)
