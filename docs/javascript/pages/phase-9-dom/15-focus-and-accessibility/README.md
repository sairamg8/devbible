---
title: "15 · Focus and accessibility from JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`tabindex`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/tabindex), [`HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus), [`Document.activeElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement), [`focusin` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event), [`:focus-visible`](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible), [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert), [ARIA reflection](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaExpanded), [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions). Documentation-validated; **no timings**.

Everything a mouse user gets from seeing the screen, a keyboard or screen-reader user gets from two
mechanisms: **where focus is**, and **what the accessibility tree says**. Both are yours to
maintain the moment you start changing the DOM from JavaScript.

🔴 **The one-line summary:** move focus deliberately and give it back, and keep the accessibility
tree honest by writing state where you already write behaviour. Neither happens by itself, and
neither is visible in a screenshot — which is why these bugs survive review.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What can hold focus](./01-what-can-hold-focus.md)** | Natively focusable elements, `tabindex` (`0` and `-1` only), `activeElement`, `focus()` / `preventScroll`, why `focus` and `blur` do not bubble, `relatedTarget`, `:focus-visible` |
| 02 | **[Managing focus](./02-managing-focus.md)** | The three obligations of a dialog, `inert` versus a hand-written trap, `<dialog>.showModal()`, restoring focus with an `isConnected` guard, roving tabindex |
| 03 | **[ARIA from JavaScript](./03-aria-from-javascript.md)** | The first rule of ARIA, the state attributes you must write (`aria-expanded`, `aria-pressed`, `aria-current`…), reflection properties and their string values, naming, and the `aria-hidden` trap |
| 04 | **[Live regions](./04-live-regions.md)** | `aria-live` polite/assertive/off, `role="status"` and `role="alert"`, `aria-atomic`, `aria-relevant`, the container-must-pre-exist rule, and when a live region is the wrong answer |

## Four facts worth carrying out of this topic

- **`tabindex`: only `0` and `-1`.** A positive value reorders the whole document's tab sequence
  from inside one component.
- **`focus` and `blur` do not bubble** — `focusin` and `focusout` do, and `relatedTarget` is how
  you ask whether focus left your component.
- **`inert` is the focus trap.** It takes a subtree out of clicks, focus, selection, find-in-page
  and the accessibility tree; `aria-hidden` leaves it tabbable, which is worse than doing nothing.
- **A live region must exist before the content changes**, and identical text announces nothing —
  clear it, then set it.

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [14 · Scrolling](../14-scrolling/02-landing-on-an-element.md) — scrolling to an element is not
  focusing it, and `focus({ preventScroll: true })` stops the double jump
- [10 · Removing and replacing](../10-removing-and-replacing/02-cleanup.md) — removing the focused
  element drops focus to `<body>`
- [09 · Forms](../09-forms/02-constraint-validation.md) — `reportValidity()` moves focus, and field
  errors belong on `aria-describedby` rather than in a live region
- [08 · Classes and styles](../08-classes-and-styles/01-classlist.md) — the same one-source-of-truth
  argument, applied to state attributes
- **16 · `<dialog>`, the popover API and `inert`** *(not written yet)* — the platform features that
  do chunk 02's work for you

---

Start → [01 · What can hold focus](./01-what-can-hold-focus.md)
