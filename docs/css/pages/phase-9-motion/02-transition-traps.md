---
title: "Transition traps"
sidebar_label: "02 · Transition traps"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition)**,
> [`transition-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior),
> [`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) and
> [`display`](https://developer.mozilla.org/en-US/docs/Web/CSS/display),
> and the **W3C CSS Transitions Level 1/2** specifications.
> Baseline: `@starting-style` **newly available since 2024-08-06**;
> `transition-behavior: allow-discrete` **newly available since 2024-08-06**
> (`web-features` 3.34.3).

**A transition needs two things: a starting value that exists, and an ending
value that can be interpolated towards.** Every trap below is one of those two
being absent.

## Trap 1: `display: none` cancels everything

```css
.menu { display: none; opacity: 0; transition: opacity 200ms; }
.menu--open { display: block; opacity: 1; }
```

Nothing fades. `display` is a **discrete** property — it flips rather than
interpolating — and while the element is `display: none` it has no rendered box
for a transition to start from. By the time it is `block`, the opacity change has
already been applied.

The modern fix is two features working together:

```css
.menu {
  display: none;
  opacity: 0;
  transition: opacity 200ms, display 200ms allow-discrete;
}

.menu--open { display: block; opacity: 1; }

@starting-style {
  .menu--open { opacity: 0; }
}
```

- **`allow-discrete`** lets `display` participate: it flips to `block` at the
  *start* of the transition and to `none` at the *end*, so the element is visible
  for the duration.
- **`@starting-style`** supplies the value to animate *from* for an element that
  is being rendered for the first time. Without it there is no starting value and
  the element simply appears.

Both are **newly available (2024-08-06)**, so this pattern is an enhancement — it
degrades to an instant show/hide, which is acceptable.

## Trap 2: an element must exist with a starting value

The same problem appears without `display`:

```css
.toast { opacity: 1; transition: opacity 300ms; }   /* inserted by JS — no fade in */
```

An element added to the DOM has no previous value to transition from; its first
computed style *is* the final one. `@starting-style` is the declarative answer:

```css
@starting-style {
  .toast { opacity: 0; transform: translateY(1rem); }
}
```

Before `@starting-style`, the workaround was to insert the element in its initial
state, force a reflow (`element.offsetHeight`), then apply the final class — a
genuine hack that `@starting-style` replaces.

## Trap 3: you cannot transition to or from `auto`

Covered in [01](./01-what-is-cheap-to-animate.md): `height: auto` has no
interpolatable value. The same applies to `width: auto`, `margin: auto` and
`grid-template-rows: auto`.

## Trap 4: the shorthand resets what you did not name

```css
.button { transition: background-color 200ms ease 100ms; }
.button:hover { transition: background-color 200ms; }   /* delay is now 0 */
```

`transition` is a shorthand, so it resets `transition-delay`,
`transition-timing-function` and `transition-behavior` to their initial values —
[Phase 2 · The shorthand reset trap](../phase-2-cascade/04-the-shorthand-reset-trap.md)
applied here. This is a frequent cause of "the delay works in one state and not
another".

## Trap 5: transitioning `all`

```css
.card { transition: all 300ms; }   /* ⚠️ */
```

Three problems: it animates properties you did not intend (including ones added
later by a library), it can animate expensive layout properties by accident, and
it makes intent invisible to the next reader.

Name the properties:

```css
.card { transition: transform 200ms ease, box-shadow 200ms ease; }
```

## Trap 6: transitions on page load

An element with a transition and a class applied during initial render can
animate from the browser's default — producing a visible flash of movement as the
page loads.

The usual guard is to add transitions after first paint, or to scope them to a
class added by script once the page is ready. `@starting-style` helps for
elements *entering*, but not for this case, which is about the initial render of
already-present elements.

## Where transitions sit in the cascade

From [Phase 2](../phase-2-cascade/01-what-the-cascade-compares.md): **transition
declarations outrank everything**, including `!important` author and user styles.
While a transition is running, its value wins — which is why an
`!important` override appears not to work mid-transition and starts working once
it completes.

Animations sit lower, just above normal author declarations, so an author
`!important` *does* beat a running `@keyframes` animation. The asymmetry is worth
remembering because it looks arbitrary until you have seen the origin table.

## Trade-off

**The modern entry/exit pattern is correct and has four moving parts.** A fade-in
that used to be one line of JavaScript is now `transition`, `allow-discrete`,
`@starting-style` and a class — all newly available, all silently degrading to no
animation. That degradation is graceful, which is the argument for it, but it also
means the feature is invisible when it fails, and there is no signal in
development that a browser skipped it.

The alternative — animating with JavaScript, or keeping elements in the DOM with
`visibility` — is more code and more state, but it fails visibly and works
everywhere.

For most applications the CSS pattern is now the right default: entry and exit
animation is decoration, and losing it on an older browser costs nothing. Where
the animation carries meaning — a state change the user must notice — do not rely
on a newly-available feature to convey it.

## Gotchas

**A fade-out never plays; the element vanishes instantly.**
*Symptom:* the in-animation works, the out does not.
*Cause:* `display: none` is applied immediately, removing the box before the
transition can run.
*Fix:* add `display` to the transition list with `allow-discrete`.

**An element inserted by JavaScript does not fade in.**
*Symptom:* it appears fully formed.
*Cause:* no starting value exists — the first computed style is the final one.
*Fix:* `@starting-style`, or the older force-reflow technique.

**A delay works on hover but not on un-hover.**
*Symptom:* asymmetric timing.
*Cause:* one state uses the `transition` shorthand, resetting
`transition-delay` to `0s`.
*Fix:* set the delay in both, or use longhands for the override.

**Unexpected properties animate.**
*Symptom:* layout shifts smoothly when it should snap.
*Cause:* `transition: all`.
*Fix:* name the properties explicitly.

**An `!important` override is ignored during an animation.**
*Symptom:* the value only applies after the transition ends.
*Cause:* transition declarations sit at the top of the cascade, above important
author styles.
*Fix:* none needed — it is specified behaviour; change the transition instead.

## Interview questions

**★ Why does a `display: none` element not fade out, and how do you fix it?**
`display` is a discrete property and the element has no rendered box once it is
`none`, so there is nothing to transition. Adding `display` to the transition list
with `transition-behavior: allow-discrete` makes it flip at the start of the
transition and back at the end, keeping the element visible for the duration.

**★ What is `@starting-style` for?**
Supplying the value an element animates *from* the first time it is rendered.
Without it a newly inserted or newly displayed element has no previous computed
value, so it appears at its final style with no transition. It replaces the old
insert-then-force-reflow hack.

**★ Why is `transition: all` discouraged?**
It animates properties you did not intend — including ones introduced later by
other code — can accidentally animate expensive layout properties, and hides the
author's intent from the next reader.

**Where do transitions sit in the cascade?**
At the very top, above important user-agent, user and author declarations. A
running transition's value cannot be overridden, which is why an `!important`
rule appears to take effect only once the transition finishes. Animations sit
lower and *can* be beaten by an author `!important`.

**Why does a transition delay sometimes apply in one state and not another?**
Because the `transition` shorthand resets `transition-delay` — along with the
timing function and behaviour — so a state rule using the shorthand discards a
delay set elsewhere.

**How reliable is the modern entry/exit pattern?**
`@starting-style` and `allow-discrete` are newly available (2024-08-06), so it
degrades to an instant show/hide on older browsers. Acceptable for decoration; not
for motion that carries meaning.

---

← [01 · What is cheap to animate](./01-what-is-cheap-to-animate.md) · Next: [03 · prefers-reduced-motion](./03-prefers-reduced-motion.md) →
