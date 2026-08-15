---
title: "01 · Selection and Range"
sidebar_label: "01 · Selection and Range"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-14 against MDN — [`Selection`](https://developer.mozilla.org/en-US/docs/Web/API/Selection), [`Window.getSelection()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection), [`Range`](https://developer.mozilla.org/en-US/docs/Web/API/Range), [`Document.createRange()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/createRange), [`selectionchange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event), [`HTMLInputElement.setSelectionRange()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setSelectionRange). Documentation-validated; **no timings**.

This is the surface behind every rich-text editor, comment highlighter and "share this quote"
feature. It is **When Needed** for a reason: you will not touch it for years, and when you do, you
need the model rather than a recipe.

## A `Range` is two boundary points

A boundary point is a **container node plus an offset**, and the offset means different things
depending on the node:

| Container | `offset` counts |
|---|---|
| a text node | **characters** |
| an element | **child nodes** |

```js
const range = document.createRange();
range.setStart(textNode, 5);       // after the 5th character
range.setEnd(textNode, 15);
range.toString();                  // the text between them
```

That dual meaning is the thing to internalise: `range.setStart(paragraph, 1)` means *before child
node 1*, not *before character 1*.

### Building one

| Method | Result |
|---|---|
| `setStart` / `setEnd(node, offset)` | explicit boundary points |
| `setStartBefore` / `setStartAfter` / `setEndBefore` / `setEndAfter(node)` | relative to a node |
| `selectNode(node)` | the node **and** its contents |
| `selectNodeContents(node)` | everything **inside** the node |
| `collapse(toStart)` | shrink to one point — a caret |

`commonAncestorContainer` gives the deepest node containing both ends, which is how you ask "what
element is this selection actually in".

### Changing the document with one

| Method | Does |
|---|---|
| `cloneContents()` | a `DocumentFragment` copy — document untouched |
| `extractContents()` | **moves** the content out into a fragment |
| `deleteContents()` | removes it |
| `insertNode(node)` | inserts at the start boundary |
| `surroundContents(node)` | wraps the range's content in `node` |

`surroundContents` is how a highlighter wraps a selection in a `<mark>` — and it throws when the
range **partially** contains a non-text node, because the result would not be a well-formed tree.
Selections that start mid-paragraph and end mid-list are exactly that case, so real highlighters
split the range per text node instead.

`extractContents()` returns a fragment, with all the properties from
[11 · Batching DOM work](../11-batching-dom-work/01-build-off-document.md) — one-use, no layout.

⚠️ **`createContextualFragment(html)` parses HTML** in the context of the range's start container.
It is an HTML sink, exactly like `innerHTML` — same XSS exposure, same rule from
[06 · Sanitising HTML](../06-sanitising-html/README.md).

### A Range is live, and fragile

Boundary points hold **node references**, not positions in a string. Text edits shift offsets;
removing a boundary's container invalidates the range. **Recreate ranges after DOM changes rather
than holding one across an edit** — the stale-range bug is the single most common source of "the
caret jumped to the wrong place".

`range.getBoundingClientRect()` and `getClientRects()` give the range's geometry — one rect per
line box for wrapped text, exactly as in
[13 · Measuring elements](../13-measuring-elements/01-the-four-families.md). That is how a
selection toolbar positions itself above the highlighted text.

## `Selection` is what the user has selected

```js
const sel = window.getSelection();
sel.toString();                    // the selected text
sel.isCollapsed;                   // true = a caret, no selection
sel.getRangeAt(0);                 // the range behind it
```

🔴 **`anchor`/`focus` are not `start`/`end`.** The **anchor** is where the selection began, the
**focus** is where it ended — so selecting backwards puts the anchor *after* the focus. `Range`
always has start before end; `Selection` records direction. Code that assumes `anchorOffset <
focusOffset` breaks the first time someone drags right-to-left.

```js
sel.removeAllRanges();
sel.addRange(range);                                   // replace the selection
sel.setBaseAndExtent(startNode, 0, endNode, 4);        // in one call
sel.selectAllChildren(el);
sel.collapse(node, offset);                            // place a caret
```

📌 **Treat a selection as having exactly one range.** MDN records that multiple ranges came from
Netscape and that only Gecko implemented them — the specification now requires a single range.
`rangeCount > 1` is not worth coding for.

⚠️ **Programmatic selection can move focus.** MDN documents that Safari and Chrome (unlike Firefox)
focus the element containing the selection when you change it from code, and that these methods
move focus to an editing host when the selection moves into one. If your code changes the selection
and then reads `document.activeElement`, do not assume it is unchanged
([15 · 01](../15-focus-and-accessibility/01-what-can-hold-focus.md)).

### Reacting to it

```js
document.addEventListener('selectionchange', () => {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed) return hideToolbar();
  showToolbarAt(sel.getRangeAt(0).getBoundingClientRect());
});
```

`selectionchange` fires on the **document**, and it fires often during a drag — treat it like a
scroll handler and debounce the expensive part
([14 · 04](../14-scrolling/04-watching-and-restoring.md)).

## Inputs and textareas are a different API

🔴 **The Selection API does not reach inside `<input>` or `<textarea>`.** Their value is a string,
not a DOM tree, and they have their own interface:

```js
input.selectionStart;                     // character index
input.selectionEnd;
input.setSelectionRange(2, 7);            // select characters 2–7
input.setSelectionRange(4, 4);            // caret at position 4
input.selectionDirection;                 // 'forward' | 'backward' | 'none'
```

Mixing them up is the classic beginner bug: `window.getSelection().toString()` returns `''` while
text is visibly selected in a textarea. Which API you need depends on the element, not on what the
user sees.

## Shadow DOM

`selection.getComposedRanges()` returns `StaticRange`s that may cross shadow boundaries — the
selection API's version of `composedPath()` from
[18 · 03](../18-shadow-dom-and-custom-elements/03-living-with-the-boundary.md). Ordinary
`getRangeAt()` is retargeted like everything else, so a selection inside a component reads as the
host from outside.

## Gotchas

**Symptom: `window.getSelection().toString()` is empty while text is selected in a textarea.**
Cause — form controls use `selectionStart`/`selectionEnd`, not the Selection API.
Fix — branch on the element: `input`/`textarea` get `setSelectionRange`, everything else gets
`Selection`.

**Symptom: the selection is backwards and your offsets are negative.**
Cause — `anchor` is where the drag started, so it can be after `focus`.
Fix — read `getRangeAt(0)`, whose `start` is always before its `end`, or compare with
`compareDocumentPosition` ([07 · Traversal](../07-traversal/02-closest-matches-and-scope.md)).

**Symptom: `surroundContents()` throws.**
Cause — the range partially selects a non-text node, so wrapping it would produce a malformed tree.
Fix — split the work per text node inside the range, wrapping each one.

**Symptom: the caret jumps to the wrong place after an edit.**
Cause — a `Range` held across a DOM change; its containers moved or were replaced.
Fix — capture the position as data you can re-derive (a node path plus offset), and rebuild the
range after the change.

**Symptom: `selectionchange` fires constantly and the toolbar flickers.**
Cause — it fires throughout a drag.
Fix — debounce, and ignore collapsed selections.

**Symptom: focus moves unexpectedly when you set the selection.**
Cause — Safari and Chrome focus the containing element on programmatic selection changes; moving a
selection into an editing host focuses it.
Fix — re-read `document.activeElement` rather than assuming, and restore focus deliberately if it
mattered.

**Symptom: `createContextualFragment()` injected a script tag's payload.**
Cause — it parses HTML; it is a sink.
Fix — sanitise first, exactly as with `innerHTML`.

## Interview questions

**★ What is a boundary point?**
A container node plus an offset — where the offset counts **characters** in a text node and **child
nodes** in an element. A `Range` is two of them.

**★ How do `anchor`/`focus` differ from `start`/`end`?**
Anchor is where the user began the selection and focus where they ended, so anchor can come after
focus when selecting backwards. A `Range`'s start is always before its end. Use the range when you
need document order.

**★ Why does the Selection API return nothing for a textarea?**
Because a form control's value is a string, not part of the DOM tree. Use `selectionStart`,
`selectionEnd` and `setSelectionRange()`.

**★ Why does `surroundContents()` throw on some selections?**
Because the range partially contains a non-text node, and wrapping it would create a malformed
tree. Highlighters walk the text nodes in the range and wrap each individually.

**★ Why should you not hold a `Range` across a DOM edit?**
Its boundary points reference live nodes; edits shift offsets and removals invalidate containers.
Re-derive the position after the change instead.

**How do you position a toolbar over the user's selection?**
`selection.getRangeAt(0).getBoundingClientRect()` — a range has geometry, and `getClientRects()`
gives one rect per line for a wrapped selection.

---

[Topic index](./README.md) · [02 · contenteditable](./02-contenteditable.md) →
