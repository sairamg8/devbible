---
title: "Empty, end and error states"
sidebar_label: "10 · Empty, end and error states"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *`grid-column`* and grid line numbering (including
> negative lines), MDN *`:empty`*, MDN *`prefers-reduced-motion`*, and the HTML
> specification's `button` element. Composes
> [CSS 5·05](../../../../css/pages/phase-5-grid/05-line-based-placement.md),
> [CSS 6·03](../../../../css/pages/phase-6-container-queries/03-user-preference-queries.md)
> and [CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md).
> No sandbox, no console output.

Three outcomes that look similar on screen and mean entirely different things to
the person reading them:

| State | Condition | What it says | What it must offer |
|---|---|---|---|
| **Empty** | request succeeded, zero items | "No products match these filters" | a way out — clear the filters, broaden the search |
| **End of list** | `hasMore === false`, items present | "That's everything" | nothing; it should be quiet enough to ignore |
| **Error** | request failed | "Something went wrong" | a real retry control |

Collapsing them into one component loses the only thing that matters about them.
An empty state is a dead end and needs an escape route; an end state is a
successful conclusion; an error is a failure the user did not cause.

## Spanning the whole grid

```css
@layer components {
  .catalog__empty,
  .catalog__error,
  .catalog__end {
    grid-column: 1 / -1;               /* every track, whatever the count */
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding-block: var(--space-8);
    text-align: center;
  }

  .catalog__end {
    padding-block: var(--space-5);
    color: var(--text-muted);
    font-size: 0.9375rem;
  }
}
```

**`grid-column: 1 / -1` is the declaration that matters.** It spans from the
first grid line to the last one — `-1` counts backwards from the end — so the
message centres across however many tracks `auto-fill` produced. Any fixed span
is correct at one viewport width and wrong at the rest, by construction, because
the column count is precisely the thing this grid refuses to fix in advance.

Line-based placement is
[CSS 5·05](../../../../css/pages/phase-5-grid/05-line-based-placement.md); the
negative-line trick is the one piece of it that earns its keep in almost every
intrinsic grid.

⚠️ **`1 / -1` only spans the *explicit* grid.** With `repeat(auto-fill, …)` the
tracks are explicit, so this works. In a grid whose tracks come from
`grid-auto-columns`, `-1` refers to the end of the explicit grid — which may be
line 1 — and the span silently collapses.

## Why not `:empty`

CSS has a `:empty` pseudo-class, and it is the wrong tool here twice over:

1. **It matches only elements with no child nodes at all.** A single space or
   newline between the tags is a text node and defeats it. That makes it
   fragile against the formatting of the very markup it depends on.
2. **An empty result and a failed request are identical to it.** The grid has no
   children in both cases, and the distinction — *why* there is nothing to show —
   is application state.

State that the component knows and CSS cannot infer belongs in the component.
This is the general principle behind the whole phase: **CSS styles the state; it
does not decide it.**

## The retry control is a button

```css
@layer components {
  .catalog__retry {
    min-block-size: 2.75rem;
    padding-inline: var(--space-4);
  }
}
```

The styling is unremarkable. What matters is that the element is a real
`<button>`, and that is worth being explicit about because "a `<div>` with an
`onClick` and some padding" is the version that reliably ships:

- it is focusable in tab order without `tabindex`
- it fires on Enter *and* Space without a key handler
- it is announced as a button, so a screen-reader user knows it is actionable
- it participates in `:focus-visible` styling for free

Reimplementing those four things correctly is more work than using the element,
and partial reimplementations are the common outcome.

## Motion, and the users who do not want it

Any shimmer or spinner in these states must respect the user's stated
preference:

```css
@layer components {
  @media (prefers-reduced-motion: reduce) {
    .catalog__spinner,
    .product-card--skeleton::after {
      animation: none;
    }
  }
}
```

`prefers-reduced-motion: reduce` is a real accessibility setting, not a
courtesy — vestibular disorders make looping motion genuinely unpleasant, and
the user has already told the operating system so. A skeleton with no animation
is still a perfectly good skeleton, because its job was reserving space; the
shimmer was only ever a hint that something is happening.

The preference queries are
[CSS 6·03](../../../../css/pages/phase-6-container-queries/03-user-preference-queries.md);
what is cheap to animate at all is
[CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md),
and it is the reason a shimmer should animate a `transform` on an overlay rather
than a large gradient's `background-position`.

⚠️ **Name every animated selector in the query, pseudo-elements included.** A
`::after` that carries the animation is not covered by a rule targeting its host,
and this is the usual reason motion still plays for a user who asked for less of
it.

## Gotchas

- **Symptom:** the empty-state message is squashed into the first column.
  **Cause:** it is an ordinary grid item, so it occupies one track.
  **Fix:** `grid-column: 1 / -1`.

- **Symptom:** the "no results" message is centred at one width and off-centre
  at another. **Cause:** a fixed span such as `grid-column: span 3`.
  **Fix:** `1 / -1` — any fixed number is wrong at some width.

- **Symptom:** `grid-column: 1 / -1` spans only one column. **Cause:** the
  tracks are implicit rather than explicit, so `-1` resolves to the end of an
  explicit grid that barely exists. **Fix:** declare the tracks explicitly —
  which `repeat(auto-fill, …)` already does.

- **Symptom:** `:empty` was used for the no-results state and never matches.
  **Cause:** whitespace between tags counts as a child node. **Fix:** render the
  state from the component, which is the only place that knows whether "nothing
  to show" means zero results or a failed request.

- **Symptom:** the empty state and the error state look identical and users
  retry filters instead of retrying the request. **Cause:** one component for
  two meanings. **Fix:** separate them — the messages differ, the affordances
  differ, and the user's next action differs.

- **Symptom:** the end-of-list message is as prominent as the empty state and
  reads as a problem. **Cause:** shared styling. **Fix:** the end state is a
  success; muted colour, smaller type, less padding.

- **Symptom:** the retry control cannot be reached by keyboard.
  **Cause:** it is a `<div>` with a click handler. **Fix:** a real `<button>` —
  the four behaviours it brings are not worth reimplementing.

- **Symptom:** the retry button works with Enter but not Space, or vice versa.
  **Cause:** a partial reimplementation of button semantics on a non-button
  element. **Fix:** as above — this symptom is diagnostic of the previous one.

- **Symptom:** motion still plays for a user who has reduced motion enabled.
  **Cause:** the animation lives on a pseudo-element or a nested element the
  media query does not name. **Fix:** target every animated selector explicitly.

- **Symptom:** the shimmer makes the page feel slow on low-end devices.
  **Cause:** animating a large gradient's `background-position`, which repaints
  every frame. **Fix:** animate a `transform` on an overlay element instead.

- **Symptom:** the error panel appears *and* the last page of results is still
  on screen, and the two look like one broken layout. **Cause:** the error is
  rendered as a sibling of the items with no visual separation, which is
  correct — a failed *next* page should not discard the pages that succeeded.
  **Fix:** style it as a distinct band spanning the grid, so it reads as an
  interruption rather than as a malformed card.

- **Symptom:** clearing the filters from the empty state leaves the scroll
  position halfway down a now-short page. **Cause:** the list shrank beneath
  the viewport. **Fix:** this is the component's to handle, not the
  stylesheet's — noted here because it is invariably reported as a CSS bug.

## Interview questions

1. **★ How do you centre a "no results" message across a grid whose column
   count is not known at author time?** `grid-column: 1 / -1`, which spans from
   the first grid line to the last however many tracks exist. Any fixed span is
   correct at one viewport width and wrong at the rest — and with `auto-fill`
   the count is deliberately not knowable at author time.

2. **★ When does `grid-column: 1 / -1` fail?** When the tracks are implicit.
   Negative line numbers count back from the end of the **explicit** grid, so in
   a grid whose columns come from `grid-auto-columns`, `-1` can resolve to line
   1 and the span collapses to nothing. `repeat(auto-fill, …)` creates explicit
   tracks, which is why it works here.

3. **★ Why can `:empty` not drive the no-results state?** Two reasons: it
   matches only elements with no child nodes at all, and a single whitespace
   text node defeats it; and more fundamentally, an empty result set and a
   failed request are the same thing to CSS. Which one happened is application
   state, and only the component holding that state can distinguish them.

4. **★ Empty, end-of-list and error look similar. Why style them
   differently?** Because they ask different things of the user. Empty is a dead
   end that needs an escape route. End-of-list is a successful conclusion and
   should be quiet. Error is a failure the user did not cause and needs a real
   retry. Merging them removes the only information that distinguishes them.

5. **What do you get from a `<button>` that you would have to rebuild on a
   `<div>`?** Focusability in tab order without `tabindex`, activation on both
   Enter and Space, the `button` role so it is announced as actionable, and
   participation in `:focus-visible`. Rebuilding all four correctly is more work
   than using the element, and partial rebuilds — Enter but not Space — are the
   usual result.

6. **What is the correct behaviour under `prefers-reduced-motion: reduce`?**
   Remove the looping animation and keep the element. The skeleton's actual job
   is reserving space, which it does just as well without motion — so the
   reduced-motion version is not degraded, it is the same experience minus a
   decoration some users find genuinely unpleasant.

7. **Why does motion sometimes still play despite a reduced-motion query?**
   Because the animation is declared on a selector the query does not name —
   typically a `::after` pseudo-element carrying the shimmer while the query
   targets its host. Every animated selector has to be listed.

8. **Why animate a transform rather than a gradient's background position?**
   Because transform animations can be handled without repainting the element's
   contents each frame, while animating `background-position` on a large
   gradient forces repeated paint work. On a grid showing a dozen skeletons at
   once, that is the whole frame budget.

9. **A page of results loaded, then the next page failed. What should be on
   screen?** The results that succeeded, plus a distinct error band spanning the
   grid with a retry. Discarding successful pages because a later one failed
   throws away work the user already waited for; showing the error as another
   card makes it read as malformed content rather than an interruption.

10. **Where is the line between what CSS decides and what the component
    decides in these states?** CSS styles a state it is told about; it does not
    infer one. Anything requiring knowledge of *why* the grid is empty — a
    filter with no matches, a network failure, a first load in flight — is
    application state, and attempts to detect it in CSS (`:empty`, child-count
    selectors) are fragile restatements of something the component already
    knows.

---

← Prev [The loading state and announcements](09-the-loading-state-and-announcements.md) ·
Next → [The complete stylesheet](11-the-complete-stylesheet.md)
