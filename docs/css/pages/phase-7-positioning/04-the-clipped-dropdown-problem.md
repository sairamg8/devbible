---
title: "The clipped-dropdown problem"
sidebar_label: "04 · The clipped-dropdown problem"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **MDN — [`overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)**,
> [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog),
> [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) and
> [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/position).
> Baseline: `<dialog>` **widely available**; `popover` **newly available since
> 2025-01-27** (`web-features` 3.34.3).

**A menu cut off by a scrolling ancestor is a clipping problem, not a stacking
one — and no `z-index` will fix it.** Recognising which of the two you have is
the whole content of this page.

## Clipping is not stacking

| Symptom | Cause | Fix |
|---|---|---|
| The overlay is **behind** other content | stacking context | `z-index` at the right level, or the top layer |
| The overlay is **cut off** at an edge | an ancestor's `overflow` | the top layer, or restructure |

If the dropdown is *visible but underneath*, it is a stacking problem
([01](./01-stacking-contexts.md)). If part of it is *missing* — sliced at a
container's boundary — it is being clipped, and stacking is irrelevant.

The quick test: temporarily set `overflow: visible` on the suspected ancestor. If
the menu appears in full, you have your answer.

## Why it happens

Any ancestor with `overflow` set to `hidden`, `auto` or `scroll` clips its
descendants to its padding box. An absolutely positioned child is **not** exempt
— it escapes the *flow*, not the clip, unless its containing block is outside the
clipping ancestor.

The usual culprits are entirely reasonable declarations:

```css
.table-wrapper { overflow-x: auto; }    /* horizontal scroll for a wide table */
.card          { overflow: hidden; }    /* clip an image to rounded corners */
.scroll-area   { overflow-y: auto; }    /* a scrolling panel */
```

Each is correct on its own terms, and each clips any menu opened inside it.

## The fix: the top layer

The modern answer is not to escape the clip but to be somewhere it does not
apply. Elements in the **top layer** are painted outside the document's normal
flow and clipping entirely.

**A popover:**

```html
<button popovertarget="menu">Actions</button>
<div id="menu" popover>
  <button>Rename</button>
  <button>Delete</button>
</div>
```

No JavaScript, no `z-index`, no clipping — and light-dismiss (click outside or
press Escape) is built in.

**A modal dialog:**

```html
<dialog id="confirm">…</dialog>
```

```js
document.getElementById('confirm').showModal();
```

`showModal()` puts the dialog in the top layer, traps focus, and enables
`::backdrop`. `show()` does not — it opens a non-modal dialog that stays in the
normal flow, and therefore *is* still clippable.

## Positioning a popover next to its trigger

The top layer solves clipping but not placement — a popover defaults to the
centre of the viewport. **Anchor positioning** is the CSS answer:

```css
.trigger { anchor-name: --menu-anchor; }

#menu {
  position: absolute;
  position-anchor: --menu-anchor;
  top: anchor(bottom);
  left: anchor(left);
  position-try-fallbacks: flip-block, flip-inline;
}
```

`position-try-fallbacks` is the valuable part: it flips the popover to the other
side when there is not enough room, which is the behaviour every positioning
library reimplements.

**Anchor positioning is not Baseline** — `web-features` 3.34.3 reports it as
**limited availability**. So it needs `@supports` and a fallback:

```css
@supports not (anchor-name: --x) {
  #menu { /* centred, or JS-positioned */ }
}
```

This is the one part of the modern overlay story that still genuinely needs a
JavaScript library in production.

## When you cannot use the top layer

Older support requirements, or an overlay that is not a menu or dialog. Two
workarounds, both with costs:

**1. Render it elsewhere in the DOM.** A portal — moving the element to
`document.body` — removes it from the clipping ancestor. Every component
framework provides one. The cost is that the overlay is no longer near its
trigger in the DOM, so focus order and screen-reader context must be managed
manually with `aria-controls` and focus handling.

**2. Remove the clip.** Sometimes `overflow: hidden` was only there to clip a
decorative corner and can be replaced:

```css
.card { border-radius: 8px; }
.card__image { border-radius: 8px 8px 0 0; }   /* clip the image, not the card */
```

Worth checking before reaching for a portal, because it is simpler and keeps the
DOM intact.

## Trade-off

**The top layer is the correct fix and it changes what the element is.** A
popover is dismissible, participates in the top-layer stack, and comes with
behaviour you may not want — light-dismiss can be wrong for a menu that should
stay open while interacting elsewhere. `showModal()` traps focus, which is right
for a modal and wrong for a dropdown.

The portal approach keeps full control and hands you the accessibility work:
focus management, escape handling, `aria-*` wiring, and repositioning on scroll
and resize. Libraries exist because that list is long and easy to get subtly
wrong.

The honest recommendation: **`popover` for menus and `<dialog>` + `showModal()`
for modals wherever support allows** — they remove the clipping problem and give
correct behaviour for free. Keep a portal-based library only where anchor
positioning is required and the fallback matters.

## Gotchas

**`z-index` does not fix a cut-off menu.**
*Symptom:* raising `z-index` changes nothing.
*Cause:* it is being clipped, not layered.
*Fix:* the top layer, or remove the clipping `overflow`.

**A `<dialog>` is still clipped.**
*Symptom:* the dialog is cut off by a scrolling ancestor.
*Cause:* it was opened with `show()`, not `showModal()`, so it is not in the top
layer.
*Fix:* `showModal()`.

**A popover appears in the middle of the screen.**
*Symptom:* it is not near its trigger.
*Cause:* the top layer has no automatic anchoring.
*Fix:* anchor positioning where supported, with a fallback — it is not yet
Baseline.

**A portalled menu breaks keyboard navigation.**
*Symptom:* focus jumps to the end of the document.
*Cause:* the DOM position no longer matches the visual relationship.
*Fix:* manage focus explicitly and wire `aria-controls` / `aria-expanded`.

**Removing `overflow: hidden` breaks rounded corners.**
*Symptom:* an image escapes its card's radius.
*Cause:* the clip was doing real work.
*Fix:* apply the radius to the image itself rather than clipping the container.

## Interview questions

**★ A dropdown is cut off by its container. Why will `z-index` not fix it?**
Because the problem is clipping, not stacking. An ancestor with `overflow`
`hidden`/`auto`/`scroll` clips descendants to its padding box, and absolute
positioning escapes the flow but not the clip. `z-index` only reorders painting
among things that are drawn at all.

**★ What is the modern fix?**
Put the overlay in the top layer — a `popover` element, or a `<dialog>` opened
with `showModal()`. Top-layer content is painted outside the document's normal
flow and clipping, so no ancestor can cut it off and no `z-index` is needed.

**★ What does the top layer not solve?**
Placement. A popover defaults to the centre of the viewport, so it still needs
anchoring to its trigger. CSS anchor positioning does this — including
`position-try-fallbacks` to flip when space runs out — but it is not yet Baseline,
so it needs `@supports` and a fallback.

**How do you tell a clipping problem from a stacking one?**
If the overlay is visible but underneath something, it is stacking. If part of it
is missing, sliced at a container boundary, it is clipping. Setting
`overflow: visible` on the suspect ancestor confirms it.

**What is the cost of portalling an overlay to `document.body`?**
The element is no longer near its trigger in the DOM, so focus order, screen-reader
context, escape handling and repositioning on scroll all become your
responsibility.

**What is the difference between `show()` and `showModal()`?**
`showModal()` puts the dialog in the top layer, traps focus and enables
`::backdrop`. `show()` opens it in the normal flow, where it can still be clipped
and layered like any other element.

---

← [03 · `position: sticky`](./03-position-sticky.md) · Back to [Phase 7 overview](./README.md)
