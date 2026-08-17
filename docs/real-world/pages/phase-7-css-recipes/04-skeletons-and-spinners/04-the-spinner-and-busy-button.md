---
title: "The spinner and the busy button"
sidebar_label: "04 · The spinner and busy button"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — MDN *`border-radius`*, *`@keyframes`*, *`aria-hidden`*,
> *`aria-live`*, the HTML specification's `disabled` attribute and its effect on
> focus, and the WAI-ARIA Authoring Practices on status messages. Composes
> [chapter 4·04](../../phase-4-react-ui/04-useform-and-checkout.md), whose
> checkout button already carries a `submitting` state. No sandbox, no console
> output.

The checkout button from
[chapter 4·04](../../phase-4-react-ui/04-useform-and-checkout.md) is already
written:

```jsx
<button disabled={form.submitting}>
  {form.submitting ? 'Placing order…' : 'Place order'}
</button>
```

This chunk is what that state looks like, and the two things about it that are
easy to get wrong: **the button must not change size**, and **the spinner must
not be announced**.

## The spinner

```css
@layer components {
  .spinner {
    inline-size: var(--spinner-size, 1.25em);
    block-size:  var(--spinner-size, 1.25em);
    border-radius: 50%;
    border: 2px solid color-mix(in oklab, currentColor 25%, transparent);
    border-block-start-color: currentColor;
    animation: spinner-rotate 0.7s linear infinite;
  }

  @keyframes spinner-rotate { to { rotate: 1turn; } }

  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2s; }
  }
}
```

Four decisions worth naming:

- **`em`, not `rem`** — the spinner scales with the text it sits beside, so one
  class works in a button, in the search field, and beside a heading with no
  size variants. `--spinner-size` overrides it where a specific size is needed.
- **`currentColor`** for both the track and the head, so the spinner inherits
  the colour of whatever it is placed in. A spinner in a primary button and one
  in a muted field need no separate rules.
- **`rotate: 1turn`** rather than `transform: rotate(1turn)` — the independent
  transform property, so a spinner that also needs `translate` or `scale` does
  not have to compose them into one `transform` value and fight over it.
- **Reduced motion slows it rather than stopping it.** This is the one place the
  usual `animation: none` is wrong: a *stopped* spinner is indistinguishable
  from a broken one. Slowing the rotation keeps the "in progress" signal while
  removing the fast repetitive motion that the preference is actually about.

## The busy button must not resize

```jsx
<button className="btn" disabled={form.submitting} aria-busy={form.submitting}>
  <span className="btn__label">
    {form.submitting ? 'Placing order…' : 'Place order'}
  </span>
  {form.submitting && <span className="spinner" aria-hidden="true" />}
</button>
```

```css
@layer components {
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-block-size: 2.75rem;
    min-inline-size: 12rem;      /* fits the longest label this button has */
  }

  .btn[disabled] { cursor: not-allowed; opacity: 0.7; }
}
```

⚠️ **A button whose label changes length reflows everything around it.** "Place
order" becomes "Placing order…" and gains a spinner — on a narrow layout that
can push the button to a new line at the exact moment the user has committed to
pressing it, which reads as the page breaking under them.

`min-inline-size` sized to the longest state removes it. The alternatives are
worse: a fixed width breaks with translation, and swapping the label for the
spinner alone loses the text that told the user what is happening.

**Keeping the label and adding the spinner is the version that survives
translation**, because the button was already wide enough for the longest string
in whatever language it is rendering.

## `disabled`, and the focus it throws away

`disabled` is right here — a checkout button must not accept a second press, and
[chapter 3·07](../../phase-3-express-api/07-the-checkout-endpoint.md)'s idempotency
key is the server-side half of the same concern.

But it has a cost worth knowing: **a `disabled` element is removed from the tab
order, and if it had focus, focus is lost to the document body.** A keyboard
user who pressed Enter on the button is now focused on nothing, and their next
Tab starts from the top of the page.

For a form submit that navigates on success this rarely bites. For an in-place
action that stays on the same screen, the alternatives are:

- **`aria-disabled="true"` plus ignoring the click in the handler** — the
  element keeps focus and stays reachable, and assistive technology still
  announces it as disabled. It does *not* stop the click on its own, so the
  handler must.
- **Move focus deliberately** to whatever the result is, once it arrives.

`aria-busy` on the button is the complement: it says *this control is working*,
which `disabled` alone does not distinguish from *this control is unavailable*.

## The spinner is decorative

```jsx
<span className="spinner" aria-hidden="true" />
```

A spinner conveys nothing to a screen reader — there is no text, and "loading"
is already in the button's own label. Without `aria-hidden` some engines
announce the empty element, and with a `role="status"` wrapped around it you get
the *worst* case: an empty region announcing nothing, repeatedly.

The rule is the same one from
[chunk 02](02-building-the-skeleton.md): **visual users get the indicator,
assistive-technology users get words.** In the button, those words are the label
itself, which is why changing it to "Placing order…" is not decoration — it is
the accessible version of the spinner.

For an indicator with no accompanying label — the small one in the search field
from [chapter 4·02](../../phase-4-react-ui/02-usedebounce-and-search.md) — the
words come from a polite live region alongside it, never from the spinner.

## Gotchas

- **Symptom:** the layout jumps when a button enters its loading state.
  **Cause:** the label got longer and a spinner appeared. **Fix:**
  `min-inline-size` sized to the longest state, so the button's box is constant.

- **Symptom:** the button is the right width in English and wrong after
  translation. **Cause:** a fixed `inline-size` tuned to one language.
  **Fix:** a *minimum*, so the button can still grow for a longer string.

- **Symptom:** the spinner is invisible on a coloured button. **Cause:** a
  hard-coded colour. **Fix:** `currentColor` for both track and head, so it
  inherits from whatever context it lands in.

- **Symptom:** the spinner is the wrong size in a small control.
  **Cause:** sized in `rem`, so it ignores its surroundings. **Fix:** `em`,
  which scales with the local font size — plus a custom property for the cases
  that genuinely need to override it.

- **Symptom:** under reduced motion the spinner stops and users report the app
  has hung. **Cause:** `animation: none` applied uniformly. **Fix:** slow it
  instead. A stopped spinner is indistinguishable from a broken one, which makes
  this the one indicator where stopping is the wrong accommodation.

- **Symptom:** a keyboard user presses Enter on submit and loses their place.
  **Cause:** `disabled` removed the focused element from the tab order, sending
  focus to the body. **Fix:** for in-place actions, `aria-disabled` plus a guard
  in the handler; or move focus deliberately to the result.

- **Symptom:** `aria-disabled="true"` was used and the button still submits
  twice. **Cause:** `aria-disabled` is an announcement, not a behaviour — it
  does not block anything. **Fix:** the handler must return early; the attribute
  only tells assistive technology what the handler is going to do.

- **Symptom:** a screen reader announces nothing, repeatedly, while a request is
  in flight. **Cause:** an empty spinner element inside a live region.
  **Fix:** `aria-hidden` on the spinner, and put the words in the region.

- **Symptom:** the spinner's rotation looks wobbly. **Cause:** the element's
  box is not square, or the border widths differ per side, so it is rotating an
  ellipse. **Fix:** equal inline and block size, and one border width.

- **Symptom:** a spinner replaced the button's text entirely and users report
  not knowing what is happening. **Cause:** the label was swapped out rather
  than updated. **Fix:** keep the label and change its wording — the text is the
  accessible version of the indicator, so removing it removes the only part that
  works for everyone.

- **Symptom:** two spinners on one screen animate out of phase and look
  glitchy. **Cause:** they mounted at different times. **Fix:** usually leave
  it — unlike skeletons in a grid, independent spinners are not read as a set,
  so phase alignment is not something users notice unless they are adjacent.

## Interview questions

1. **★ Why must a button not change size when it enters a loading state?**
   Because the label lengthens and an indicator appears, which reflows
   everything around it — on a narrow layout the button can move to a new line
   at the exact moment the user has committed to pressing it. A
   `min-inline-size` sized to the longest state keeps the box constant while
   still allowing growth for translated strings.

2. **★ Why size a spinner in `em` and colour it with `currentColor`?** So one
   class works everywhere: it scales with the text beside it and inherits the
   colour of its context. A spinner sized in `rem` needs a variant per control
   size, and a hard-coded colour needs one per surface — both are variants that
   exist only because the units were absolute.

3. **★ What is the correct reduced-motion treatment for a spinner, and why is it
   different from a skeleton's?** Slow it rather than stop it. A skeleton's
   shimmer can be removed because the skeleton still reserves space without it,
   but a *stopped* spinner is indistinguishable from a hung app — the motion
   **is** the signal. Slowing removes the fast repetition the preference targets
   while keeping the meaning.

4. **★ What does `disabled` cost that `aria-disabled` does not?** `disabled`
   removes the element from the tab order, so a focused element loses focus to
   the document body and the user's next Tab starts from the top of the page.
   `aria-disabled` keeps focus and reachability and still announces the state —
   but it blocks nothing, so the handler has to return early itself.

5. **★ Should a spinner be announced to a screen reader?** No. It has no text
   and conveys nothing on its own; mark it `aria-hidden`. The information
   belongs in words — the button's own label changing to "Placing order…", or a
   polite live region where there is no label. An empty element inside a live
   region is the worst outcome: a region announcing nothing, repeatedly.

6. **Why is changing the button's label not just decoration?** Because it is the
   accessible form of the spinner. Sighted users get motion, everyone gets the
   text — so swapping the label out for the spinner removes the only part of the
   indicator that works for all users.

7. **Why `rotate: 1turn` rather than `transform: rotate(1turn)`?** The
   independent transform properties compose separately, so an element that also
   needs a `translate` or `scale` does not have to merge everything into one
   `transform` value where the last declaration wins. It avoids a whole class of
   "my animation overwrote my positioning" bugs.

8. **A checkout button uses `disabled` to prevent double submission. Is that
   sufficient?** Not on its own — it prevents a second *click*, not a second
   *request*. Networks fail after the server has acted, so the client's safe
   move is to retry, and only a server-side idempotency key makes that safe.
   The disabled state is a UX affordance; idempotency is the correctness
   mechanism.

9. **Why does a spinner sometimes look wobbly?** Because it is rotating a shape
   that is not a circle — unequal inline and block sizes, or differing border
   widths per side, produce an ellipse whose asymmetry is only visible in
   motion.

---

← Prev [The shimmer and what it costs](03-the-shimmer-and-its-cost.md) ·
Next → [The complete stylesheet](05-the-complete-stylesheet.md)
