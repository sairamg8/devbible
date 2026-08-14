---
title: "The shorthand reset trap"
sidebar_label: "04 · The shorthand reset trap"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Shorthand properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Shorthand_properties)**
> and **[`border`](https://developer.mozilla.org/en-US/docs/Web/CSS/border)**.

**Every shorthand writes all of its longhands — including the ones you did not
mention.** Omitted sub-values are not left alone; they are set to their initial
value. This is the cascade bug that looks like a browser bug, because the
property you lost is one you never typed.

## The rule

> "A value which is not specified is set to a default value defined by the
> shorthand, which may differ from the property's initial value. That means that
> it **overrides** previously set values."
>
> — MDN, *Shorthand properties*

MDN's own example is the cleanest demonstration:

```css
p {
  background-color: red;
  background: url("images/bg.gif") no-repeat left top;
}
```

The background is **not** red. The shorthand set `background-color` to its
initial value, `transparent`, because the shorthand did not mention a colour.

Nothing about the cascade is unusual here — the second declaration is later and
of equal weight, so it wins. What is unusual is that a declaration named
`background` silently rewrote a property named `background-color`.

## The one everybody hits: `border` and `border-image`

```css
.panel {
  border-image: linear-gradient(90deg, red, blue) 1;
  border: 1px solid grey;      /* the gradient border is gone */
}
```

MDN states it explicitly:

> "Importantly, `border` cannot be used to specify a custom value for
> `border-image`, but instead sets it to its initial value, i.e., `none`."

So the `border` shorthand resets **four** things, one of which is not in its own
name. Order matters and the fix is ordering:

```css
.panel {
  border: 1px solid grey;
  border-image: linear-gradient(90deg, red, blue) 1;   /* now it survives */
}
```

## `border` also gives you `currentcolor` for free

```css
.button { color: rebeccapurple; border: 2px solid; }
```

Omitting the colour does not mean "no colour" — it means the initial value of
`border-color`, which is `currentcolor`. The border is purple, tracking the text
colour. That is genuinely useful, and it is the same rule that bit you above,
working in your favour.

The full set of `border`'s sub-values and their initial values:

| Longhand | Initial value when omitted |
|---|---|
| `border-width` | `medium` |
| `border-style` | `none` |
| `border-color` | `currentcolor` |
| `border-image` | `none` |

`border-style: none` is why `border: 2px red` draws nothing at all — the style
was omitted, so it reset to `none`, and a border with no style is not painted.

## Shorthands that reset more than their name suggests

| Shorthand | Also resets |
|---|---|
| `background` | `background-image`, `background-position`, `background-size`, `background-repeat`, `background-attachment`, `background-origin`, `background-clip`, `background-color` |
| `border` | `border-image` — not implied by the name |
| `font` | `line-height`, `font-variant`, `font-stretch`, `font-style`, `font-weight` |
| `grid` | all the implicit-grid longhands, including `grid-auto-flow` |
| `transition` | `transition-delay`, `transition-timing-function`, `transition-behavior` |
| `flex` | `flex-grow`, `flex-shrink`, `flex-basis` |
| `animation` | every `animation-*`, including `animation-play-state` |

`font` is the sharpest of these: it resets `line-height` unless you use the
`font: <size>/<line-height> <family>` form, so a single `font` declaration can
silently collapse your vertical rhythm.

`grid` is the most destructive, which is why `grid-template` exists as the
narrower shorthand — it leaves the implicit-grid properties alone.

## Why the language works this way

A shorthand is a complete statement about a concept, not a patch to it.
`background: url(x)` means "the background is this image" — full stop — rather
than "additionally, the background image is x". Once you read shorthands as
declarations of a whole value rather than as edits, the resets stop being
surprising and become the only coherent design.

It also explains why shorthands cannot inherit selectively. MDN:

> "Only the individual properties values can inherit. As missing values are
> replaced by their initial value, it is impossible to allow inheritance of
> individual properties by omitting them."

There is no way to write "keep whatever `background-color` was" inside a
`background` shorthand, because omission already has a meaning.

## Working with it instead of around it

- **Shorthand first, longhands after.** Establish the whole value, then adjust
  the parts. Reversing that order throws the adjustment away.
- **Prefer the longhand when you mean one thing.** `background-color: red` never
  surprises anyone; `background: red` resets seven other properties to say the
  same thing.
- **In a component's base rule, the shorthand is right** — you are defining the
  whole concept. In a modifier or state rule, the longhand almost always is.
- **Watch shorthands in a later cascade layer or a state rule.** `:hover {
  background: blue }` discards the base rule's image; `:hover {
  background-color: blue }` does not.

## Trade-off

**Longhands are safe and verbose; shorthands are concise and total.** A
stylesheet written entirely in longhands never loses a property by accident, and
it is roughly twice the size, harder to scan, and drops the useful defaults —
you would have to write `currentcolor` yourself every time.

The real cost of shorthands is not the resets, which are learnable; it is that
they make *diffs* misleading. Changing `background: red` to
`background: url(x)` in review looks like one property changing, and is eight.
Where that matters — a shared component, a theme file others extend — the
verbosity of longhands buys reviewability, and that is usually the better trade.

## Gotchas

**A background image vanishes when a colour is set.**
*Symptom:* `background: red` in a modifier removes the base rule's image.
*Cause:* the shorthand reset `background-image` to `none`.
*Fix:* `background-color: red` in the modifier.

**A gradient border disappears when a border is added.**
*Symptom:* `border-image` stops applying after an unrelated `border` line.
*Cause:* `border` resets `border-image` to `none` despite not naming it.
*Fix:* declare `border` first and `border-image` after.

**`border: 2px red` draws nothing.**
*Symptom:* no border at all, no error.
*Cause:* `border-style` was omitted so it reset to `none`.
*Fix:* include a style — `border: 2px solid red`.

**Line height collapses after a font change.**
*Symptom:* text tightens up when `font-family` is set through `font`.
*Cause:* `font` resets `line-height` to `normal` unless the `size/line-height`
form is used.
*Fix:* use `font-family` alone, or `font: 1rem/1.5 system-ui`.

**A `:hover` rule undoes half the base component.**
*Symptom:* hovering removes the background image, the transition delay, or the
border image.
*Cause:* a shorthand in the state rule rewrote every longhand.
*Fix:* state and modifier rules should use longhands.

## Interview questions

**★ What happens to sub-values you omit from a shorthand?**
They are set to their initial value, not left at whatever they were. The
shorthand writes every one of its longhands, so it overrides earlier
declarations of properties it never names.

**★ Why does `background: url(bg.png)` remove a previously set
`background-color`?**
Because the shorthand sets `background-color` to its initial value,
`transparent`. The later declaration wins normally on cascade order; the
surprise is only that it touched a property the author did not write.

**★ Name a shorthand that resets a property not implied by its name.**
`border` resets `border-image` to `none`. MDN documents this explicitly, and it
is why a `border` declaration after a `border-image` one silently removes a
gradient border.

**Why does `border: 2px red` produce no border?**
`border-style` was omitted, so it reset to its initial value `none`, and a
border without a style is not painted.

**Why can't a shorthand inherit individual sub-values?**
Because omission already means "reset to initial". There is no syntax left to
express "leave this one as it was", so selective inheritance is impossible by
construction.

**Where should shorthands and longhands each be used?**
Shorthands in a base rule, where you are defining the whole concept; longhands
in modifiers, states and theme overrides, where you mean to change exactly one
thing and keep the rest.

---

← [03 · Specificity](./03-specificity-counted-properly.md) · Back to [Phase 2 overview](./README.md)
