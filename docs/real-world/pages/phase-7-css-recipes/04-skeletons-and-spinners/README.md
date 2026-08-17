---
title: "Skeleton loaders and spinners"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — Nielsen Norman Group's response-time thresholds, MDN CSS
> animations, containment and ARIA live-region documentation, and the WAI-ARIA
> Authoring Practices on status messages. Each chunk names its own sources.
> Styles the states rendered by
> [chapter 4·01](../../phase-4-react-ui/01-useasync-and-the-api-client.md),
> [4·02](../../phase-4-react-ui/02-usedebounce-and-search.md) and
> [4·04](../../phase-4-react-ui/04-useform-and-checkout.md).
> No sandbox, no measured timings.

Perceived speed while the hooks fetch — and the uncomfortable fact underneath
it: **a loading indicator is a cost, not a courtesy.** It occupies space, draws
the eye, and tells the user they are waiting, which they may not have noticed.

The chapter is therefore as much about *not* showing one as about styling it.
Half the traps here are indicators that fire for requests nobody was waiting on,
and the other half are indicators whose geometry lies about what is coming.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Skeleton, spinner, or nothing](01-skeleton-spinner-or-nothing.md) | The three perceptual thresholds, why the *shape* decides between skeleton and spinner, and a CSS-only delay that needs no timer |
| 02 | [Building the skeleton](02-building-the-skeleton.md) | The skeleton is the component with its content removed — never a picture of it; `lh` sizing, and keeping it out of the accessibility tree |
| 03 | [The shimmer and what it costs](03-the-shimmer-and-its-cost.md) | Why `background-position` janks a grid, the transform sweep that does not, and why `will-change` is wrong here |
| 04 | [The spinner and the busy button](04-the-spinner-and-busy-button.md) | A button whose box never changes size, `disabled` versus `aria-disabled`, and the label as the accessible spinner |
| 05 | [The complete stylesheet](05-the-complete-stylesheet.md) | The whole file, copyable, plus the markup each rule expects |

## Three sentences to keep

**The best loading state is the one you deleted** — by making the update
optimistic, or by finishing inside the second the user would not have noticed.

**A skeleton is a claim about what is coming**, so it is only correct when you
know the shape; when the claim is false, the correction is a visible jolt at the
worst moment.

**Visual users get the indicator, everyone gets the words** — every element in
this chapter is `aria-hidden`, and the entire accessible experience lives in a
button label and a polite live region.

## The decision, in one table

| Show | When | In this app |
|---|---|---|
| **Nothing** | under ~1 s, or the update was optimistic | cart quantity changes |
| **A skeleton** | the shape is known | the catalog grid's first load |
| **A spinner** | something is happening, shape unknown | search dropdown, checkout submit |

## Phase gate

This topic is done when a fast response shows **no indicator at all**, a slow
one shows a skeleton whose geometry matches the content that replaces it, the
checkout button does not change size when pressed, and a user with
`prefers-reduced-motion` set gets a still skeleton and a *slowed* — not
stopped — spinner.

## Where this connects

**Backwards:** [topic 01 chunk 09](../01-the-product-grid/09-the-loading-state-and-announcements.md)
set the geometry rule this chapter implements and owns the live-region
mechanics; [chapter 4·06](../../phase-4-react-ui/06-cart-state.md) is why the
cart needs no indicator at all.

**Forwards:** every colour here is a token — `--surface-1`, `--surface-3` and
`currentColor` — and **chapter 05 · Dark mode** *(not written yet)* decides what
they resolve to.

**Sideways:** the cost model is
[CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md)
and the preference query is
[CSS 9·03](../../../../css/pages/phase-9-motion/03-prefers-reduced-motion.md).

---

Start with [01 · Skeleton, spinner, or nothing](01-skeleton-spinner-or-nothing.md).
