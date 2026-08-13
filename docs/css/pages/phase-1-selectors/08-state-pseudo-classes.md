---
title: "State pseudo-classes"
sidebar_label: "08 · State pseudo-classes"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**Interaction state, expressed in CSS instead of tracked in JavaScript.** Four
of these belong on every interactive element, and one of them —
`:focus-visible` — is the difference between a usable site and an inaccessible
one.

## The set

```css
a:hover          { }  /* pointer is over it                              */
a:active         { }  /* being pressed, right now                        */
a:focus          { }  /* has keyboard focus, however it was acquired     */
a:focus-visible  { }  /* has focus AND the browser thinks a ring belongs */
.card:focus-within { } /* contains something focused                     */
:target          { }  /* its id matches the URL fragment                 */
a:visited        { }  /* previously visited link — heavily restricted    */
button:disabled  { }  /* the disabled attribute is present               */
```

## `:focus` versus `:focus-visible`

This is the important one. `:focus` matches whenever an element has focus —
including when it was clicked with a mouse. `:focus-visible` matches only when
the browser judges that a focus indicator should be shown, which in practice
means keyboard or assistive-technology focus.

```css
/* wrong: removes the ring for everyone, including keyboard users */
button:focus { outline: none; }

/* right: no ring on click, clear ring on keyboard */
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

The old pattern of removing outlines "because they look bad on click" is exactly
what `:focus-visible` was added to solve. There is no longer a trade-off between
a clean mouse experience and a usable keyboard one.

**Never remove a focus indicator without replacing it.** It is the only thing
telling a keyboard user where they are.

## `:focus-within` — the container knows

```css
/* highlight the whole field when the input inside it is focused */
.field:focus-within {
  --field-border: var(--accent);
}

/* keep a dropdown open while anything inside it has focus */
.menu:focus-within .menu-list { display: block; }
```

This is a parent selector that predates `:has()` and is still the clearer way to
express focus containment.

## The order of link states matters

Link pseudo-classes have equal specificity, so **source order decides**. The
mnemonic is **LVHA** — LoVe/HAte:

```css
a:link    { }   /* unvisited      */
a:visited { }   /* visited        */
a:hover   { }   /* pointer over   */
a:active  { }   /* being pressed  */
```

Put `:hover` before `:visited` and visited links stop showing a hover state,
because `:visited` comes later and wins the tie.

## `:visited` is deliberately crippled

Browsers restrict what `:visited` can style, because otherwise any site could
read your browsing history by measuring the rendered result:

- **Only colour properties apply** — `color`, `background-color`,
  `border-color`, `outline-color`, and the fill/stroke variants.
- `getComputedStyle` **lies** about visited links, reporting the unvisited value.
- No layout, no font changes, no `content`.

So a visited-link treatment can only be a colour change, and you cannot detect
it from script. That is the point.

## `:target` — a state you get from the URL

```css
/* highlight the section someone was linked to */
:target {
  scroll-margin-block-start: 5rem;   /* clear a sticky header */
  background: var(--accent-soft);
}
```

`:target` matches the element whose id equals the current URL fragment. It is
enough to build tabs and lightboxes with no JavaScript — though the cost is that
each state change writes a history entry, so the back button walks through them.

## `:disabled` and the alternative

```css
button:disabled { opacity: 0.5; cursor: not-allowed; }
```

`:disabled` matches the real `disabled` attribute — which also removes the
element from the tab order and from the accessibility tree, so a screen-reader
user cannot discover *why* it is disabled. When the reason matters, use
`aria-disabled="true"` and style `[aria-disabled="true"]` instead; the control
stays focusable and announceable, and you block the action in the handler.

## Gotchas

**Symptom:** keyboard users cannot tell where focus is.
**Cause:** `outline: none` on `:focus`, or a reset containing `*:focus { outline:
none }`.
**Fix:** remove it and style `:focus-visible` instead. If a ring must be
suppressed for mouse clicks, that is already what `:focus-visible` does.

**Symptom:** visited links do not respond to `:hover`.
**Cause:** `:visited` is declared after `:hover`, and they have equal
specificity.
**Fix:** LVHA order — `:link`, `:visited`, `:hover`, `:active`.

**Symptom:** a `:visited` rule setting `font-weight` does nothing.
**Cause:** only colour properties apply to visited links; it is a privacy
restriction, not a bug.
**Fix:** use colour, or reconsider the design.

**Symptom:** a disabled button gives no explanation to screen-reader users.
**Cause:** the `disabled` attribute removes it from the accessibility tree
entirely.
**Fix:** `aria-disabled="true"` plus a handler that blocks the action, so the
control remains focusable and can be described.

**Symptom:** `:hover` styles stick on touch devices after tapping.
**Cause:** touch browsers emulate hover on tap and only clear it on the next
interaction.
**Fix:** guard hover styles with `@media (hover: hover)`
(**Phase 8**).

## Interview questions

**★ What is the difference between `:focus` and `:focus-visible`?**
`:focus` matches any focused element, including one focused by a mouse click.
`:focus-visible` matches only when the browser judges a focus indicator is
warranted — in practice keyboard and assistive-technology focus. It exists so
you can have no ring on click and a clear ring on keyboard, which used to be a
trade-off people resolved by removing the ring entirely.

**★ Why is `:visited` so limited?**
Because unrestricted styling would leak browsing history: a site could style
visited links differently and measure the result from script. Browsers therefore
allow only colour properties on `:visited` and make `getComputedStyle` report the
unvisited values.

**What order must link pseudo-classes be written in, and why?**
`:link`, `:visited`, `:hover`, `:active` — LVHA. They all have the same
specificity, so the last matching rule wins; writing `:hover` before `:visited`
means visited links never show a hover state.

**What does `:focus-within` do?**
Matches an element that contains the focused element, at any depth. It is a
container-level focus state — useful for highlighting a whole field or keeping a
menu open — and it predates `:has()`.

**When should you use `aria-disabled` instead of `disabled`?**
When the user needs to know *why* the control is unavailable. The `disabled`
attribute removes the element from the tab order and the accessibility tree, so
it cannot be focused or announced; `aria-disabled="true"` keeps it discoverable
and you block the action in the event handler.

---

← [07 · Structural pseudo-classes](./07-structural-pseudo-classes.md) · Next: [09 · Form-state pseudo-classes](./09-form-state-pseudo-classes.md) →
