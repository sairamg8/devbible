---
title: "The overlay layer"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — MDN's top-layer, `<dialog>`, Popover API, `::backdrop`,
> `overlay`, `@starting-style`, `overscroll-behavior`, `scrollbar-gutter` and
> live-region references, the WAI-ARIA Authoring Practices on status messages,
> W3C CSS Positioned Layout Level 3, and WCAG 2.2 SC 2.2.1 and 4.1.3. Each chunk
> names its own sources. Concept homes:
> [CSS 7·01 stacking contexts](../../../../css/pages/phase-7-positioning/01-stacking-contexts.md),
> [7·02 `z-index` in practice](../../../../css/pages/phase-7-positioning/02-z-index-in-practice.md),
> [7·03 `position: sticky`](../../../../css/pages/phase-7-positioning/03-position-sticky.md),
> [7·04 the clipped-dropdown problem](../../../../css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md) —
> none of which is repeated here. The React modal is
> [chapter 4·07](../../phase-4-react-ui/07-modal-portal-focus.md).
> No sandbox, no measured timings.

**Toasts and modals that never fight the stacking context — by having almost
nothing left in the stacking context to fight.** This storefront has eleven
overlays. Seven go in the top layer, where clipping and stacking stop being
questions the stylesheet answers; the remaining four share a scale of three
named values, and nothing in the application is ever given a `z-index` above
`30`.

The chapter's spine: **the `z-index` escalation is a classification failure.**
Two questions — is it modal, does it need to escape an ancestor — decide where
every overlay belongs, and asking them once removes the pressure that produces
`9999`.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The inventory](01-the-storefront-overlays.md) | All eleven overlays classified; why the mega-menu is not a `z-index` problem; why the toast stack is in the top layer and deliberately not modal; the three numbers that survive |
| 02 | [Top layer and popover](02-the-top-layer-and-popover.md) | `showModal()` versus `show()`; the UA styles both mechanisms ship and exactly which to undo; scrim tokens on `:root` because `::backdrop` may not inherit; and the three-part transition — `allow-discrete`, `overlay`, `@starting-style` |
| 03 | [The toast region](03-the-toast-region.md) | The live region that must exist before its first message; `role="status"` versus `alert`; `popover="manual"`; and which toasts may never auto-dismiss |
| 04 | [Scroll lock and the header](04-scroll-lock-and-the-sticky-header.md) | `scrollbar-gutter: stable` declared unconditionally; a `:has()`-driven lock that cannot get stuck; `overscroll-behavior`; and `--header-h` as the token four other things measure against |
| 05 | [The complete stylesheet](05-the-complete-stylesheet.md) | The markup contract, the whole file, and the sixteen-item review checklist |

## Four sentences to keep

1. **Top layer and modal are separate properties.** Conflating them is what
   produces a toast that closes the dialog underneath it.
2. **`z-index` fixes neither clipping nor a trapped stacking context** — which
   is why classification, not numbering, is the answer.
3. **`overlay` must be in the transition list**, or the element drops out of the
   top layer and animates away behind the page.
4. **A live region must exist before its first message**, or the toast is
   silent no matter how correct it looks.

## Phase gate

You are done when you can classify a new overlay without hesitating, say what
`showModal()` gives that `show()` does not, name the two declarations that undo
the popover UA centring, explain why `scrollbar-gutter` is unconditional, and
say which toasts must never expire on a timer.

---

← Prev: [Dark mode](../05-dark-mode/README.md) · Index: [Phase 7](../README.md)
