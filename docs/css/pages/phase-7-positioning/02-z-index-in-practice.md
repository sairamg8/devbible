---
title: "z-index in practice"
sidebar_label: "02 · z-index in practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`z-index`](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)**
> and [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context),
> and **W3C CSS Positioned Layout Level 3**.

**`z-index: 1` works and `z-index: 9999` does not, in the same codebase, for the
same reason.** Once stacking contexts are understood, the practical question is
how to keep them manageable — because the failure mode is social, not technical.

## The escalation, and why it never ends

The pattern is always the same:

1. A dropdown appears behind a header. Someone adds `z-index: 10`.
2. A modal appears behind the dropdown. `z-index: 100`.
3. A tooltip appears behind the modal. `z-index: 1000`.
4. Someone writes `z-index: 9999` to be safe.
5. Someone else writes `z-index: 99999`.

Every step is a local fix that raises the ceiling for everyone. The numbers carry
no meaning — nobody can say what layer `500` belongs to — and the values cannot be
lowered later without testing every overlay in the application.

**The escalation is a symptom of no shared scale.** It is not solved by more
numbers.

## A z-index scale, in tokens

The fix is to name the layers once and use the names:

```css
:root {
  --z-base:     0;
  --z-dropdown: 10;
  --z-sticky:   20;
  --z-overlay:  30;
  --z-modal:    40;
  --z-toast:    50;
  --z-tooltip:  60;
}

.dropdown { z-index: var(--z-dropdown); }
.modal    { z-index: var(--z-modal); }
```

Three properties make this work where raw numbers did not:

- **The relationships are visible in one place.** Whether a toast should be above
  a modal is now a decision recorded in the codebase rather than an accident of
  who wrote their component last.
- **Gaps of 10 leave room** to insert a layer without renumbering.
- **A review question exists.** "Which layer is this?" has an answer, and
  `z-index: 47` obviously does not belong.

## Component-local z-index, with isolation

Values *inside* a component should never touch the global scale:

```css
.card { isolation: isolate; }        /* seals the component */
.card__badge  { z-index: 2; }        /* local, safe forever */
.card__shade  { z-index: 1; }
```

Because `isolation: isolate` creates a stacking context, `.card__badge`'s `2`
competes only with its siblings inside the card. It can never fight the page, and
the page can never fight it.

**This is the single highest-value habit in this topic**: global tokens for
layers that genuinely stack against each other, isolated contexts everywhere
else, and no raw numbers in between.

## The top layer removes the problem entirely

For genuinely page-level overlays, the modern answer is not to compete at all.
`<dialog>` opened with `showModal()` and elements with the `popover` attribute
render in the **top layer**, above everything in the document regardless of
`z-index` or stacking context:

```html
<dialog id="confirm">…</dialog>
<button popovertarget="menu">Menu</button>
<div id="menu" popover>…</div>
```

```js
document.getElementById('confirm').showModal();
```

Because the top layer sits outside the normal painting order, a dialog inside a
`transform`ed ancestor still appears above the page — which is the one case
`z-index` genuinely cannot fix.

`::backdrop` styles the area behind it:

```css
dialog::backdrop { background: rgb(0 0 0 / 0.5); }
```

Baseline: `<dialog>` is widely available; `popover` is **newly available
(2025-01-27)**, so check support before relying on it as the only mechanism.

## When `z-index` is not the problem at all

Two frequent misdiagnoses:

**Overflow clipping.** An element clipped by an ancestor's `overflow: hidden`
is not a stacking problem — no `z-index` will bring it back. Covered in
[04 · The clipped-dropdown problem](./04-the-clipped-dropdown-problem.md).

**Document order.** Two positioned elements with no `z-index` paint in document
order, later on top. Reordering the markup is often the cleanest fix and needs no
property at all.

## Trade-off

**A z-index scale trades local freedom for global coherence, and it only works if
everyone uses it.** One component that writes a raw `z-index: 500` defeats the
scale for everything below it, and there is no lint rule in common use that
catches this. The scale is a convention held by review, which means it degrades
in exactly the codebases that need it most — large ones with many contributors.

The top layer is genuinely better because it removes the negotiation rather than
organising it: nothing needs to agree on numbers if the overlay is not in the
same painting order. Its cost is that it applies only to dialogs and popovers,
requires JavaScript for `showModal()`, and `popover` is not yet widely available.

The pragmatic position: **top layer for modals and popovers, `isolation: isolate`
for component internals, and a small token scale for the handful of things that
genuinely remain** — sticky headers, toasts, dropdowns that are not popovers.
That leaves very few raw values.

## Gotchas

**A z-index token has no effect.**
*Symptom:* the layer order is wrong despite using the scale.
*Cause:* the element is inside a stacking context, so it competes only with its
siblings.
*Fix:* apply the token at the boundary element, or move the overlay to the top
layer.

**`z-index` on a non-positioned element does nothing.**
*Symptom:* the property is ignored entirely.
*Cause:* `z-index` applies only to positioned elements — and to flex and grid
children, which is the exception people forget.
*Fix:* add `position: relative`, or rely on the flex/grid exception knowingly.

**A dialog appears behind the page.**
*Symptom:* a modal is trapped under an ancestor.
*Cause:* an ancestor with `transform` or `filter` creates a stacking context the
modal cannot escape.
*Fix:* `showModal()` on a `<dialog>`, which renders in the top layer.

**The scale drifts back to arbitrary numbers.**
*Symptom:* `z-index: 500` appears in a new component.
*Cause:* the scale is a convention with no enforcement.
*Fix:* review, plus `isolation: isolate` on component roots so most components
never need a global value.

**`::backdrop` does not style anything.**
*Symptom:* no dimmed background.
*Cause:* the dialog was opened with `show()` rather than `showModal()` — only
modal dialogs get a backdrop.
*Fix:* `showModal()`.

## Interview questions

**★ Why does adding larger and larger `z-index` values never solve layering
problems?**
Because `z-index` is compared only within a stacking context. If the element is
inside a context that paints below the target, no value escapes it. The
escalation also raises the ceiling globally, so each fix makes the next problem
harder without changing the underlying relationship.

**★ How would you organise z-index in a large application?**
A small named scale in custom properties for genuinely global layers — dropdown,
sticky, overlay, modal, toast, tooltip — with gaps for insertion; and
`isolation: isolate` on component roots so component-internal values never reach
the global scale. Then use the top layer for modals and popovers, which removes
them from the competition entirely.

**★ What is the top layer and why does it matter?**
A separate painting layer used by `<dialog>` opened with `showModal()` and by
`popover` elements. Content there renders above the whole document regardless of
`z-index` or ancestor stacking contexts — the one reliable fix for a modal
trapped inside a transformed ancestor.

**When does `z-index` have no effect at all?**
On a non-positioned element — with the exception of flex and grid children, where
it applies without `position`.

**What does `::backdrop` require?**
A dialog opened with `showModal()`, or a popover. A non-modal `show()` dialog has
no backdrop.

**Is a z-index problem always a stacking problem?**
No. An element clipped by an ancestor's `overflow: hidden` is a clipping problem
that no `z-index` fixes, and two positioned elements with no `z-index` simply
paint in document order.

---

← [01 · Stacking contexts](./01-stacking-contexts.md) · Next: [03 · position: sticky](./03-position-sticky.md) →
