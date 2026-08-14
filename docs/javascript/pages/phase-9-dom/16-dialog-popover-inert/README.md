---
title: "16 · `<dialog>`, the popover API and `inert`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), [`HTMLDialogElement.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal), [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), [`popover` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover), [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert). Documentation-validated; **no timings**.

The syllabus calls this row *the platform features that replace three libraries*, and that is the
claim to test: modal dialogs, dropdown/menu/tooltip layers, and "make this region dormant" were all
npm dependencies, and all three are now attributes and one-line calls.

🔴 **The decision, in three lines:**

```
Must the user answer before continuing?   → <dialog>.showModal()
Transient surface, page stays usable?     → popover (auto)
A region that must go dormant in place?   → inert
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The dialog element](./01-the-dialog-element.md)** | `show()` versus `showModal()`, the top layer and `::backdrop`, where focus goes and `autofocus`, `close()` / `returnValue` / `<form method="dialog">`, the `cancel` event, and what `<dialog>` still leaves to you |
| 02 | **[The Popover API](./02-the-popover-api.md)** | `popover="auto" / "manual" / "hint"`, `popovertarget`, light dismiss, `showPopover()` and the `beforetoggle` / `toggle` events, and why a popover is not a modal |
| 03 | **[`inert` and the top layer](./03-inert-and-the-top-layer.md)** | Exactly what `inert` blocks, `inert` versus `aria-hidden` versus `disabled`, what the top layer changes about stacking, and animating in and out of it |

## Three facts worth carrying out of this topic

- **`show()` is not a lighter `showModal()`.** Only the modal call inerts the page, reaches the top
  layer, gets a backdrop, closes on Escape and sets `aria-modal="true"`.
- **A popover is non-modal by design** — the page stays interactive and focus is not trapped. Right
  for menus, wrong for confirmations.
- **`inert` has no visual effect.** MDN says so explicitly; the dimming is yours to add, or users
  will click a live-looking region that does nothing.

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [15 · Focus and accessibility](../15-focus-and-accessibility/02-managing-focus.md) — the manual
  version of everything `showModal()` automates, and the parts these APIs still leave to you
- [14 · Scrolling](../14-scrolling/03-scroll-containers-and-sticky.md) — locking the page behind a
  modal, and `overscroll-behavior` for the dialog's own scrolling
- [09 · Forms](../09-forms/01-formdata.md) — `<form method="dialog">`, and why `inert` does not
  remove a field from the payload the way `disabled` does
- **17 · `MutationObserver`** *(not written yet)* — the next Know topic in this phase

---

Start → [01 · The dialog element](./01-the-dialog-element.md)
