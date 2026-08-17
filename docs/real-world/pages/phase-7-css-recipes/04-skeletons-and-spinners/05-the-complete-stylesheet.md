---
title: "The complete stylesheet"
sidebar_label: "05 · The complete stylesheet"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — assembles the rules established and sourced in chunks
> 01–04 of this topic; every declaration's justification is on the chunk it came
> from. No sandbox, no console output.

Everything the previous four chunks decided, in one file. Nothing here is new.

## `src/styles/components/loading.css`

```css
@layer components {
  /* ── the delayed appearance: nothing shows for a fast response ── */
  .loading-delay {
    opacity: 0;
    animation: loading-appear 1ms 400ms forwards;
  }

  @keyframes loading-appear { to { opacity: 1; } }

  /* ── skeleton: the component with its content removed ────────── */
  .product-card--skeleton :is(
    .product-card__media,
    .product-card__name,
    .product-card__price-row
  ) {
    position: relative;
    overflow: hidden;
    background-color: var(--surface-3);
    border-radius: var(--radius-1);
  }

  .product-card--skeleton .product-card__name      { min-block-size: 2lh; }
  .product-card--skeleton .product-card__price-row { min-block-size: 1lh; inline-size: 40%; }
  .product-card--skeleton .product-card__buy       { visibility: hidden; }

  /* the sweep: one painted gradient, moved by transform only */
  .product-card--skeleton :is(
    .product-card__media,
    .product-card__name,
    .product-card__price-row
  )::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      transparent,
      color-mix(in oklab, var(--surface-1) 60%, transparent),
      transparent
    );
    animation: skeleton-sweep 1.6s ease-in-out infinite;
  }

  @keyframes skeleton-sweep { to { transform: translateX(100%); } }

  /* ── the spinner ─────────────────────────────────────────────── */
  .spinner {
    inline-size: var(--spinner-size, 1.25em);
    block-size:  var(--spinner-size, 1.25em);
    border-radius: 50%;
    border: 2px solid color-mix(in oklab, currentColor 25%, transparent);
    border-block-start-color: currentColor;
    animation: spinner-rotate 0.7s linear infinite;
  }

  @keyframes spinner-rotate { to { rotate: 1turn; } }

  /* ── the busy button: a box that does not change size ────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-block-size: 2.75rem;
    min-inline-size: 12rem;
  }

  .btn[disabled],
  .btn[aria-disabled='true'] { cursor: not-allowed; opacity: 0.7; }

  /* ── the preference that is not optional ─────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    /* skeletons lose the sheen — they still reserve space */
    .product-card--skeleton ::after { animation: none; }

    /* spinners SLOW rather than stop: a stopped spinner reads as hung */
    .spinner { animation-duration: 2s; }
  }
}
```

## The markup each rule expects

```jsx
{/* skeleton — the component, content removed, hidden from AT */}
<ul className="product-grid" role="list" aria-busy="true">
  {Array.from({length: 8}, (_, i) => (
    <li className="product-card product-card--skeleton" key={i} aria-hidden="true">
      <div className="product-card__inner">
        <div className="product-card__media" />
        <div className="product-card__body">
          <h3 className="product-card__name" />
          <p className="product-card__price-row" />
        </div>
      </div>
    </li>
  ))}
</ul>

{/* busy button — label carries the meaning, spinner is decorative */}
<button className="btn" disabled={submitting} aria-busy={submitting}>
  <span>{submitting ? 'Placing order…' : 'Place order'}</span>
  {submitting && <span className="spinner" aria-hidden="true" />}
</button>

{/* the words, for everyone */}
<p role="status" className="visually-hidden">{statusText}</p>
```

## The four decisions this file encodes

| Decision | Chunk |
|---|---|
| Show nothing for the first 400 ms | [01](01-skeleton-spinner-or-nothing.md) |
| The skeleton is the component, not a picture of it | [02](02-building-the-skeleton.md) |
| Animate `transform`, never `background-position` | [03](03-the-shimmer-and-its-cost.md) |
| The button's box is constant and its label carries the meaning | [04](04-the-spinner-and-busy-button.md) |

## What it does not do

- **It does not decide *when* to show anything.** `status` lives in the
  component; this file styles the state it is handed.
- **It does not announce anything.** Every word a screen reader hears comes from
  the button's label or the `role="status"` region — never from these elements.
- **It defines no colour.** `--surface-1`, `--surface-3` and `currentColor` are
  the whole palette, and **chapter 05 · Dark mode** *(not written yet)* decides
  what they resolve to.

## Gotchas

- **Symptom:** the delayed appearance never happens and the indicator shows
  immediately. **Cause:** `animation-fill-mode: forwards` missing, so the
  element reverts to `opacity: 0` — or the shorthand's order was wrong.
  In `animation: loading-appear 1ms 400ms forwards` the **first** time is
  duration and the **second** is delay. **Fix:** check the order; swapped, it
  runs a 400 ms animation after 1 ms, which looks like no delay at all.

- **Symptom:** the reduced-motion block stops the spinner too.
  **Cause:** a blanket `animation: none` for everything in the query.
  **Fix:** the two indicators need different treatments — skeletons stop,
  spinners slow — which is why they are separate rules here.

- **Symptom:** the sweep animates but sits behind the placeholder's background.
  **Cause:** the `::after` has no stacking position relative to its host's
  background. **Fix:** it is absolutely positioned over the host, which is
  enough; if a `z-index` was added to a child, that child now paints above it.

- **Symptom:** `color-mix()` produces nothing and the highlight is invisible.
  **Cause:** `--surface-1` is undefined, so the whole function is invalid at
  computed-value time and the declaration is dropped. **Fix:** the tokens layer
  must load — and the silence is by design, since there is no console error for
  an unknown custom property.

- **Symptom:** the button is 12 rem wide even when its label is short.
  **Cause:** that is `min-inline-size` working as intended. **Fix:** none —
  but the value should be reviewed per button, since a small secondary action
  does not need the checkout button's floor.

- **Symptom:** skeleton styles leak onto real cards. **Cause:** the modifier
  class was applied to the grid rather than to each card, so descendant
  selectors matched everything. **Fix:** the modifier belongs on the card, which
  is what the selectors above assume.

## Interview questions

1. **★ In `animation: loading-appear 1ms 400ms forwards`, which number is the
   delay?** The second. In the `animation` shorthand the first `<time>` is
   duration and the second is delay. Swapped, you get a 400 ms fade starting
   almost immediately — which looks like the delay simply not working, and is a
   genuinely hard bug to see.

2. **★ Why do skeletons and spinners get different reduced-motion
   treatments?** Because their motion means different things. A skeleton's
   shimmer is a flourish — the skeleton still reserves space without it. A
   spinner's rotation *is* the signal, so stopping it makes the app look hung.
   Skeletons stop; spinners slow.

3. **★ What happens when `color-mix()` references an undefined custom
   property?** The declaration becomes invalid at computed-value time and is
   dropped, so the highlight simply does not appear. There is no console error,
   because an unknown custom property is not a parse error — which is why the
   token layer failing to load produces silence rather than a diagnostic.

4. **Why is `aria-disabled` styled alongside `[disabled]` in this file?**
   Because the two express the same visual state and differ only in behaviour
   and focus handling. A component choosing `aria-disabled` to preserve focus
   should not also have to restate the appearance.

5. **What is the complete list of things a screen-reader user perceives from
   this stylesheet?** Nothing. Every element it styles is either `aria-hidden`
   or purely visual; the entire accessible experience comes from the button's
   label and the polite live region. That separation is deliberate and is what
   allows the visual indicators to be freely redesigned.

6. **Why does this file define almost no colours?** Because it uses
   `currentColor` and two surface tokens, so the indicators inherit their
   context and the theme layer owns every actual value. A spinner that hard-codes
   a colour needs a variant for every surface it might appear on.

---

← Prev [The spinner and the busy button](04-the-spinner-and-busy-button.md) ·
Back to [the topic index](README.md)
