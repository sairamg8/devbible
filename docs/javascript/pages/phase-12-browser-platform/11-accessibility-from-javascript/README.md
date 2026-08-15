---
title: "11 · Accessibility from JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions), [Keyboard-navigable JavaScript widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets), [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme), [`forced-colors`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors). Documentation-validated; **no timings and no console output**.

The syllabus row is *focus management on route change, announcements, and
`prefers-reduced-motion`/`prefers-color-scheme`* — three things that share one cause. **Script
took over a job the browser used to do, and inherited the obligations that came with it.**

⚠️ **The mechanics are phase 9's.** What can hold focus, how to move it, how to write ARIA and how
live regions behave are covered in depth in
[Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/README.md).
This topic is the **decision layer** — which moments create an obligation, and what the platform
already tells you about the person using it.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The four moments JavaScript owns](./01-the-four-moments.md)** | Native element first, ARIA describes but never implements; route change (title, focus, announcement, scroll); content arriving later, politeness levels and why a live region must pre-exist; modals via `<dialog>`/`inert` and restoring focus; removing the focused element; the roving-`tabindex` keyboard contract |
| 02 | **[User preferences, and checking your work](./02-preferences-and-testing.md)** | The four media queries worth reading, watched rather than sampled; reduced motion in `Element.animate`, `scrollTo` and `scrollIntoView`; theming without a flash and the CSS `color-scheme` property; getting out of the way under `forced-colors`; the keyboard / accessibility-tree / screen-reader passes, and what automated tooling cannot see |

## Three facts worth carrying out of this topic

- **The focus move on route change is the most common SPA accessibility bug** — and the Navigation
  API's `focusReset` default is the strongest practical argument for adopting it.
- **A live region must already be in the DOM.** Inserting the region with its text often announces
  nothing, which is why it "works sometimes".
- **`Element.animate` and `rAF` ignore `prefers-reduced-motion`.** Only the CSS you wrote against
  the query honours it; scripted motion must branch explicitly, smooth scrolling included.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/README.md)
  — the mechanics this topic decides *when* to use
- [Phase 9 · 16 · Dialog, popover and inert](../../phase-9-dom/16-dialog-popover-inert/README.md)
  — the native modal, and the focus trap you should not hand-roll
- [08 · 02 · Building a router](../08-history-and-routing/02-building-a-router.md) and
  [08 · 03 · The Navigation API](../08-history-and-routing/03-the-navigation-api.md) — where the
  route-change obligations are implemented
- [Phase 10 · 06 · Keyboard events](../../phase-10-events/06-keyboard-events/README.md) — the key
  handling a custom widget owes
- [01 · DevTools · The panels](../01-devtools/02-the-panels.md) — the accessibility tree, and what
  assistive technology actually sees

---

Start → [01 · The four moments JavaScript owns](./01-the-four-moments.md)
