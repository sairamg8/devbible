---
title: "01 · The removal and replacement API"
sidebar_label: "01 · The removal and replacement API"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.remove()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/remove), [`Node.removeChild()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild), [`Element.replaceWith()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith), [`Node.replaceChild()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/replaceChild), [`Element.replaceChildren()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren), [`Node.cloneNode()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/cloneNode), [`Node.appendChild()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild). Documentation-validated; **no timings**.

## The four calls worth knowing

```js
el.remove();                          // detach this element
parent.replaceChildren(a, b, c);      // swap ALL children for these
parent.replaceChildren();             // …or for nothing: clear
old.replaceWith(fresh);               // swap this element for another
```

Each takes the place of an older, clumsier form:

| Modern | Legacy it replaces | Difference that matters |
|---|---|---|
| `el.remove()` | `el.parentNode.removeChild(el)` | No parent lookup. **A no-op if the node has no parent**, where `removeChild` throws `NotFoundError` |
| `old.replaceWith(new)` | `parent.replaceChild(new, old)` | Argument order is not reversed (which `replaceChild`'s is), and it accepts **several** nodes, and **strings** |
| `parent.replaceChildren(…)` | a remove loop, or `innerHTML = ''` | One call, no loop, and **no HTML sink** |

**`replaceWith` and `replaceChildren` accept strings**, which are inserted as **text**, not
parsed as HTML:

```js
cell.replaceChildren(userSuppliedName);   // ✅ safe — a text node, never markup
cell.innerHTML = userSuppliedName;        // ⚠️ an HTML sink
```

That is the same boundary as
[04 · `textContent` vs `innerText` vs `innerHTML`](../04-text-vs-html/README.md) and
[06 · Sanitising HTML](../06-sanitising-html/README.md), and it is a good reason to reach for
these methods by default.

## Clearing an element: three ways, one recommendation

```js
parent.replaceChildren();                        // ✅
parent.innerHTML = '';                           // works; routes through an HTML sink
while (parent.firstChild) parent.firstChild.remove();   // works; verbose
```

The loop is correct — note it re-reads `firstChild` each time rather than indexing a **live**
collection, which is the bug from
[07 · Traversal](../07-traversal/README.md). `replaceChildren()` says the intent in one call.

⚠️ **None of the three detaches listeners or frees memory by itself.** That is chunk 02, and it is
the part that actually costs people.

## Appending moves — it never copies

A node has exactly one parent, so inserting an already-parented node **removes it from where it
was**:

```js
newParent.append(existingNode);   // existingNode is no longer in oldParent
```

This is a feature — reordering a list is `append` in the new order, with no removal step — and it
is a surprise the first time a node vanishes from one place while appearing in another. It also
means `replaceWith(other)` where `other` is already in the document **moves** `other` rather than
duplicating it.

To keep the original in place, clone it first:

```js
newParent.append(node.cloneNode(true));   // true = deep, include descendants
```

🔴 **`cloneNode` does not copy event listeners added with `addEventListener`.** MDN is explicit.
It copies attributes — including inline `onclick="…"` handlers, because those are attributes — so
a clone can look like it kept its behaviour when it kept only the attribute-based half. It also
does not copy the state that lives outside attributes, which is why **a cloned `<input>` carries
the `value` attribute (the default) and not the value the user typed**.

That last one is the same attribute-versus-property split as
[05 · Attributes versus properties](../05-attributes-vs-properties/README.md), and it is exactly
why "duplicate this row" features so often ship with the fields mysteriously blank — or
mysteriously full of the first row's defaults.

## Replacing one row without rebuilding the list

The phase gate asks for this specifically, and `replaceWith` is the answer:

```js
const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
row.replaceWith(buildRow(updatedItem));
```

Rebuilding the whole list instead — `list.replaceChildren(...items.map(buildRow))` — is correct
and simpler, and it throws away things the browser was holding for you: the focused element,
text selection, scroll position inside the list, and any in-progress CSS transition. **Replace
the smallest subtree that actually changed.**

The one case where a full rebuild is genuinely better is when *most* rows changed, because then
the per-row bookkeeping costs more than it saves.

## Removing many, in one go

```js
// ⚠️ live collection + forward index = every other node survives
for (let i = 0; i < list.children.length; i++) list.children[i].remove();

// ✅ snapshot
[...list.querySelectorAll('.done')].forEach((el) => el.remove());
```

`querySelectorAll` already returns a **static** `NodeList`, so it is safe to iterate while
removing — unlike `children`. Both facts come from
[02 · Selecting elements](../02-selecting-elements/README.md); the practical upshot is that a
selector-driven removal loop needs no snapshot and a `children`-driven one does.

## Gotchas

**Symptom:** `removeChild` threw `NotFoundError`
**Cause:** The node was not a child of that parent — often because something already moved it.
**Fix:** `el.remove()`, which is a no-op when the node has no parent.

**Symptom:** A node disappeared from its original location after being appended elsewhere
**Cause:** Insertion **moves** a node; a node has one parent.
**Fix:** `cloneNode(true)` if you wanted a copy.

**Symptom:** A cloned element lost its click handler
**Cause:** `cloneNode` does not copy listeners added with `addEventListener`.
**Fix:** Re-attach after cloning — or use delegation, so there is nothing to re-attach.

**Symptom:** A cloned input is blank, or shows the wrong text
**Cause:** Cloning copies the `value` **attribute** (the default), not the current property.
**Fix:** Copy the properties you need explicitly.

**Symptom:** A removal loop over `children` skipped half the nodes
**Cause:** `children` is live; indices shift as you remove.
**Fix:** Snapshot, or iterate the static `NodeList` from `querySelectorAll`.

**Symptom:** Clearing with `innerHTML = ''` was flagged in review
**Cause:** It is an HTML sink in code that may later be handed a variable.
**Fix:** `replaceChildren()`.

**Symptom:** Re-rendering a list lost the user's focus and scroll position
**Cause:** Every row was replaced, including the one they were using.
**Fix:** `replaceWith` on the single row that changed.

**Symptom:** `replaceChildren('<b>hi</b>')` showed the tags as text
**Cause:** Strings are inserted as text nodes — deliberately.
**Fix:** That is the safe behaviour; build real elements if you want markup.

## Interview questions

**★ How do you remove an element, and what is wrong with the old way?**
`el.remove()`. The legacy `parent.removeChild(el)` needs a parent reference and **throws
`NotFoundError`** if the node is not a child of it — `remove()` is simply a no-op when there is no
parent.

**★ What is the best way to clear a container?**
`parent.replaceChildren()` — one call, no loop, and no HTML sink. `innerHTML = ''` works but puts a
sink in code that may later receive a variable.

**★ What happens if you append a node that is already in the document?**
It **moves** — a node has exactly one parent. That is how you reorder a list without removing
anything, and it is why you must `cloneNode(true)` when you meant to copy.

**★ Does `cloneNode` copy event listeners?**
No — not ones added with `addEventListener`. It copies attributes, so inline `onclick` handlers do
survive, which makes the gap easy to miss. Cloned inputs also carry the `value` **attribute**, not
the user's typed value.

**★ How do you update one row of a list without rebuilding it?**
Find it (`[data-id]` plus `CSS.escape`) and `row.replaceWith(newRow)`. Rebuilding the whole list
destroys focus, selection, scroll position and running transitions.

**Why is `querySelectorAll` safe to iterate while removing, but `children` is not?**
`querySelectorAll` returns a **static** `NodeList`; `children` is a **live** `HTMLCollection` whose
indices shift as you remove.

**Does removing an element free its memory?**
Not by itself — see [02 · What removal does not clean up](./02-cleanup.md). A detached node with a
live reference stays in memory, listeners and all.

---

[Topic index](./README.md) · Next → [02 · What removal does not clean up](./02-cleanup.md)
