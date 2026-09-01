---
title: "What this storefront actually overlays, and where each one belongs"
sidebar_label: "01 · The inventory"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer),
> [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog),
> [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API),
> [`z-index`](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index) —
> and **W3C CSS Positioned Layout Level 3**.
> Concept homes: **stacking contexts** are
> [CSS 7·01](../../../../css/pages/phase-7-positioning/01-stacking-contexts.md);
> **the `z-index` escalation** is
> [CSS 7·02](../../../../css/pages/phase-7-positioning/02-z-index-in-practice.md);
> **clipping versus stacking** is
> [CSS 7·04](../../../../css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md).
> The React modal this chapter styles is
> [chapter 4·07](../../phase-4-react-ui/07-modal-portal-focus.md).
> No sandbox, no measured timings.

**The `z-index` escalation is a social failure, not a technical one, and the fix
is not a better numbering scheme — it is having fewer things that need a number
at all.** This storefront has eleven distinct overlays. Seven of them go in the
**top layer**, where stacking and clipping stop being questions the stylesheet
has to answer, and the remaining four share a scale of exactly three values.
Nothing in this app is ever assigned a `z-index` above `30`.

Getting there is entirely a matter of classifying each overlay correctly once,
which is what this chunk does.

## The inventory

| Overlay | Modal? | Escapes clipping? | Home |
|---|---|---|---|
| Sticky header | no | no | `z-index: 10` |
| Category mega-menu | no | **yes** — the header scrolls | popover |
| Search suggestions | no | **yes** — inside a bounded box | popover |
| Cart drawer | **yes** | yes | `<dialog>` |
| Product image zoom | **yes** | yes | `<dialog>` |
| "Remove this item?" confirm | **yes** | yes | `<dialog>` |
| Login prompt mid-checkout | **yes** | yes | `<dialog>` |
| Admin row action menu | no | **yes** — the table scrolls | popover |
| Toast stack | **no** — and this matters | yes | popover `manual` |
| Upload progress | no | no | `z-index: 20` — in flow |
| Cookie/consent bar | no | no | `z-index: 30` |

Two columns decide everything, and the second is the one people skip.

## The two questions, in order

**1 · Is it modal?** Modal means the rest of the page is unavailable: focus does
not leave, `Escape` closes, and a screen reader should not wander out. That is
`<dialog>` with `showModal()`, and the browser supplies all three
([chunk 02](02-the-top-layer-and-popover.md)).

**2 · Does it need to escape an ancestor?** Not "does it need to sit on top" —
`z-index` handles that. The question is whether an ancestor's `overflow` will
**clip** it, or an ancestor's stacking context will **trap** it below a sibling
that has nothing to do with it. `z-index` cannot fix either, which is
[CSS 7·04](../../../../css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md)'s
whole subject.

A **yes** to either question puts the overlay in the top layer. Only a **no** to
both leaves it needing a number.

## Why the mega-menu is not a `z-index` problem

The header is `position: sticky` and, on scroll, gains a shadow via a class. The
menu it opens is taller than the header. Three things are true at once:

- the header is a stacking context (it has a `z-index`), so the menu can never
  paint above a later sibling with a higher one, whatever number it is given;
- if the header ever gains `overflow: hidden` — for a shadow, a rounded corner,
  a scroll-snap fix — the menu is clipped instantly;
- the menu is *not* modal: the page behind it stays usable and it should
  light-dismiss.

That combination is exactly what the Popover API is for, and it is why the menu
gets `popover` rather than a number. **The header's `z-index: 10` then never has
to be reconsidered**, because nothing is trying to escape it.

## Why the toast stack is deliberately not modal

A toast is the one overlay that must **not** take focus. "Item added to cart"
appearing while someone is typing a discount code, and stealing the caret, is a
worse bug than the toast being missed.

So toasts are in the top layer — they must survive any container, and they
appear over dialogs — but as `popover="manual"`, which promotes without the
focus management and without light-dismiss. The announcement is handled by a
live region instead ([chunk 03](03-the-toast-region.md)).

**Top layer and modal are separate properties.** Conflating them is the single
most common mistake in an overlay system, and it is what produces toasts that
close the modal underneath them.

## The three numbers that remain

```css
@layer components {
  :root {
    --z-header:  10;   /* sticky chrome */
    --z-inflow:  20;   /* upload progress, drag affordances */
    --z-consent: 30;   /* legally must be reachable over page chrome */
  }
}
```

Three named values, declared once, in the token layer's spirit if not its file.
**A raw `z-index` literal in a component rule is a review failure**, for the
same reason a raw hex is
([chunk 02 of Dark mode](../05-dark-mode/02-the-token-layer.md)): it is a value
with no relationship to the system, and the next person adds one bigger.

The consent bar sits above the header because it must be reachable when the
header is pinned. It is *not* in the top layer, deliberately: the top layer has
no order the page controls beyond insertion, and a consent bar that outranks a
modal dialog is a worse outcome than one that is occasionally behind one.

## What none of this needs

**No portal, and no `z-index`, for anything in the top layer.** A top-layer
element is painted above the entire document regardless of where it sits in the
DOM, so the React `createPortal` in
[chapter 4·07](../../phase-4-react-ui/07-modal-portal-focus.md) is about
*ownership and event bubbling*, not about escaping a stacking context. The
stylesheet should not be written as if the portal were the mechanism, because
then removing the portal silently breaks the layout.

## Gotchas

### A number was added to something already in the top layer
**Symptom.** `z-index: 1000` on a `<dialog>`, apparently harmlessly.
**Cause.** Reflex. It does nothing while the dialog is open via `showModal()`.
**Fix.** Remove it. It is worse than useless — it survives into the day someone
opens the dialog non-modally with `show()`, when it suddenly starts mattering
and nobody remembers why the number is there.

### The mega-menu is clipped after an unrelated header change
**Symptom.** Adding a rounded corner or a shadow to the header slices the menu.
**Cause.** `overflow` on an ancestor. `z-index` is irrelevant.
**Fix.** The top layer. This is precisely the failure the classification is
designed to make impossible.

### A toast dismisses the dialog underneath it
**Symptom.** Adding to cart from inside a modal closes the modal.
**Cause.** The toast was given `popover` (which defaults to `auto`), and opening
an auto popover closes other auto popovers and can light-dismiss.
**Fix.** `popover="manual"` for toasts.

### The stacking scale has grown a fourth value
**Symptom.** `--z-tooltip: 40` appears.
**Cause.** Something that should be in the top layer was given a number instead.
**Fix.** Re-run the two questions. A tooltip escapes its container, so it is a
popover — the scale growing is the signal that a classification was skipped, not
that the scale was too small.

### The overlay works until it is rendered without the portal
**Symptom.** A refactor that removes `createPortal` breaks the modal's layering.
**Cause.** The stylesheet was written assuming the portal escapes the stacking
context.
**Fix.** For a top-layer element the portal is irrelevant to layering. If
removing it breaks things, the element was not actually in the top layer — check
that `showModal()` and not `show()` is being called.

### Two overlays are open and the wrong one is on top
**Symptom.** A confirm dialog opened from the cart drawer appears behind it.
**Cause.** Top-layer order is insertion order, and the drawer was re-opened
after the confirm.
**Fix.** Do not re-open; nesting is fine as long as the newer element enters the
top layer last. Where two modals genuinely compete, the design is wrong before
the CSS is.

## Interview questions

**Why is `z-index: 9999` wrong in a codebase that also uses `z-index: 1`?**
Because the number is meaningless outside its stacking context. An element with
`9999` still paints below a sibling context with `2` if its own ancestor sits
lower. The escalation is people reaching for a bigger number instead of asking
which context they are in.

**What are the two questions that classify an overlay?**
Is it modal, and does it need to escape an ancestor's clipping or stacking. A
yes to either means the top layer; only a no to both leaves it needing a
`z-index`.

**Why is the mega-menu a popover rather than a high `z-index`?**
Because it must escape the sticky header, which is both a stacking context and a
potential clipping ancestor. `z-index` fixes neither, and the clipping failure
arrives later, triggered by an unrelated change to the header.

**Are top layer and modal the same thing?**
No, and conflating them is the common bug. The toast stack is in the top layer
and must not be modal — it must never take focus. `popover="manual"` promotes
without focus management or light dismiss.

**Why is the consent bar not in the top layer?**
Because the top layer's order is insertion order, so a consent bar there could
outrank a modal dialog. Keeping it on the numeric scale makes its relationship
to the header explicit and bounded.

**Why does the storefront's `z-index` scale stop at 30?**
Because only four overlays need a number at all; everything that would have
driven escalation is in the top layer. A fourth value appearing in the scale is
a signal that something was misclassified.

**What is `createPortal` actually for, if not escaping the stacking context?**
Ownership and event bubbling — rendering the dialog outside a container while
keeping it in the React tree. For a top-layer element it has no effect on
layering, and writing the stylesheet as if it did makes the layout depend on an
implementation detail.

---

← Prev: [Dark mode](../05-dark-mode/README.md) · Index: [The overlay layer](README.md) · Next → [The top layer and popover](02-the-top-layer-and-popover.md)
