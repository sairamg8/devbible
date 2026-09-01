---
title: "Deriving states, and deduplicating the dark palette"
sidebar_label: "02b · Deriving and deduplicating"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix),
> [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark),
> [`@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property),
> [`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) —
> and the **CSS Properties and Values API Level 1** specification.
> Concept homes: **`color-mix()`** is
> [CSS 8·02](../../../../css/pages/phase-8-color-theming/02-color-mix.md);
> **`@property`** is
> [CSS 3·03](../../../../css/pages/phase-3-custom-properties/03-at-property.md);
> **`@layer`** is [CSS 2·02](../../../../css/pages/phase-2-cascade/02-layer/README.md).
> No sandbox, no measured timings.

**Chapter 01 left the dark palette written twice, and chunk 02 doubled the token
count. Both are fixed by the same move: stop declaring what can be derived.**
Hover, active and disabled states come out of the base role with `color-mix()`,
and the duplicated theme block becomes a build artifact rather than something a
human keeps in sync. The one rule that makes both safe is that **everything
derives toward a themed token, never toward a literal.**

## Removing the duplicated dark palette

There are two ways, and the storefront picks the second.

### Option A — `light-dark()`

```css
:root {
  color-scheme: light dark;
  --surface: light-dark(#ffffff, #16181d);
  --text:    light-dark(#16181d, #e8e8ea);
}
```

One declaration per token, both values adjacent, and it is genuinely nicer to
read. **Two costs are why it is not used here.**

First, `light-dark()` resolves against the **used** colour scheme, so it is
driven entirely by `color-scheme`. Chapter [01](01-three-states-not-two.md)
establishes that this storefront changes `color-scheme` per theme block
precisely so that UA chrome follows an explicit override. That still works —
but it means the attribute override must be implemented by flipping
`color-scheme` and nothing else, which couples the token layer to the property
that also governs scrollbars and form controls. Any future need to decouple
them (a high-contrast theme that keeps light chrome, say) requires unwinding the
whole token file.

Second, `light-dark()` is **newly available** rather than widely available, so a
media-query fallback block is still written for older engines — which puts the
duplication straight back, now in two syntaxes instead of one.

Take option A when the tokens are **hand-written** and the browser floor allows
it. The adjacency is worth real money to a human maintainer.

### Option B — one source, two emitted blocks

CSS has no way to write a single rule whose selector list spans the inside and
the outside of a media query, so the shape is unavoidable:

```css
@layer tokens {
  /* explicit override */
  :root[data-theme="dark"] { --surface: #16181d; --text: #e8e8ea; /* … */ }

  /* system default, guarded against an explicit light choice */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --surface: #16181d; --text: #e8e8ea; /* … */ }
  }
}
```

The duplication is textually present — **and that is accepted here, because it
is generated.** Both blocks are emitted from the one token source the design
system already exports, so they cannot drift by hand.

🔴 **Duplication a human maintains is a bug; duplication a build emits is a
compile target.** That is the whole distinction, and it is what makes the
otherwise-alarming sight of a palette written twice acceptable in this
stylesheet. It also buys the invariant chunk 02 relies on: the generator emits
the *same key set* into every block, so a token can never be themed in dark and
missing in light.

The blocks sit in the `tokens` layer declared by the
[phase index](../README.md), which keeps them below `components` and means a
component rule never has to out-specify a theme.

## Deriving states with `color-mix()`

Hover, active and disabled are derived rather than declared, which stops the
token count tripling:

```css
.btn-primary        { background: var(--accent); color: var(--accent-contrast); }
.btn-primary:hover  { background: color-mix(in oklab, var(--accent) 88%, var(--surface)); }
.btn-primary:active { background: color-mix(in oklab, var(--accent) 78%, var(--surface)); }

.btn-primary:disabled {
  background: color-mix(in oklab, var(--accent) 35%, var(--surface));
  color:      color-mix(in oklab, var(--accent-contrast) 55%, var(--surface));
}
```

### 🔴 Mix toward `var(--surface)`, never toward `white` or `black`

Mixing toward white lightens the button on hover. That is right in light mode
and **wrong in dark**, where hover should move *toward* the dark canvas —
producing the exact inversion where a hovered button reads as disabled.

Mixing toward `--surface` is correct in both themes automatically, because
`--surface` is itself themed. One substitution removes an entire duplicate set
of hover tokens, and it generalises: **the mix target is the thing the element
sits on.** A button inside a card mixes toward `--surface-raised`, which is why
the component token tier from chunk 02 exists.

### Mix in `oklab`, not `srgb`

An sRGB mix between two hues passes through a desaturated middle, which shows up
on the accent-to-surface ramp as a grey smear at the midpoint. `oklab`
interpolates perceptually and keeps the ramp clean. The mechanism is
[CSS 8·01](../../../../css/pages/phase-8-color-theming/01-oklch-and-perceptual-colour.md).

### What must not be derived

**State colours are declared, not mixed.** It is tempting to write
`--stock-low` as a mix of `--danger` and `--accent`; the result drifts to
whatever those two happen to be in each theme, and the urgency cue chunk 02
insists on becomes accidental. Derivation is for *variants of one role*
(hover, active, disabled, quiet). It is not for *distinct meanings*.

The same applies to `--danger-quiet`. It is a real declared role rather than
`color-mix(… --danger 12%, --surface)`, because the row highlight behind a
pending delete must stay above 3:1 against the row it replaces, and a fixed
percentage cannot guarantee that across two themes.

## `@property` where a token is animated

The theme transition in [chunk 06](06-the-complete-stylesheet.md) deliberately
animates nothing, but the admin dashboard interpolates its chart tokens when a
series is highlighted. An unregistered custom property is an untyped string to
the animation engine, so it jumps from old value to new at the halfway point.
Registering it makes it a real colour:

```css
@property --series-1 {
  syntax: '<color>';
  inherits: true;
  initial-value: #2563eb;
}
```

`initial-value` is **required** for a registered property whose syntax is not
the universal `*`, and it is what the property falls back to rather than the
guaranteed-invalid value — which means a typo in a theme block now degrades to a
visible wrong colour instead of to inherited text colour. That is a better
failure, and it is worth registering the status tokens for that reason alone,
animation or not.

## Gotchas

### Hover states invert in dark mode
**Symptom.** Buttons get *lighter* on hover in dark mode, reading as disabled
rather than active.
**Cause.** `color-mix(…, white)` — an unthemed literal as the mix target.
**Fix.** Mix toward `var(--surface)`, or toward the themed surface the element
actually sits on.

### The hover ramp has a grey midpoint
**Symptom.** A button transitioning between two saturated colours looks muddy
partway.
**Cause.** `color-mix(in srgb, …)` passes through a desaturated middle.
**Fix.** `in oklab`.

### A button on a card hovers to the wrong colour
**Symptom.** Hover works on the page background and looks wrong inside cards.
**Cause.** Mixing toward `--surface` when the element sits on
`--surface-raised`.
**Fix.** The mix target is what the element sits on. Give the component a
`--btn-mix-target` token defaulting to `var(--surface)` and override it inside
`.card`.

### `light-dark()` renders the light value on a dark system
**Symptom.** The function resolves, but always to its first argument.
**Cause.** `color-scheme` was not declared, so the used colour scheme is light.
`light-dark()` reads the used scheme, not the media query.
**Fix.** `color-scheme: light dark` on `:root` — it is a prerequisite of the
function, not a companion to it.

### An animated token jumps instead of interpolating
**Symptom.** A highlighted chart series snaps between colours mid-transition.
**Cause.** The custom property is unregistered, so it is a string.
**Fix.** `@property` with `syntax: '<color>'`.

### A typo in a theme block turns text invisible
**Symptom.** One element renders with inherited colour rather than its token.
**Cause.** An invalid custom-property value resolves to the guaranteed-invalid
value, which makes `var()` fall back to inherited.
**Fix.** Register the property. `initial-value` gives it a real fallback, so the
failure is a visibly wrong colour rather than a silent one.

### A state colour drifted between themes
**Symptom.** "Only 3 left" is orange in light mode and nearly pink in dark.
**Cause.** It was derived by mixing two other roles that theme independently.
**Fix.** Distinct meanings are declared. Derivation is only for variants of a
single role.

## Interview questions

**Why not use `light-dark()` everywhere?**
It resolves against the used colour scheme, which couples the token layer to
`color-scheme` — the property this storefront flips per theme block so UA chrome
follows an explicit override. It is also newly available rather than widely, so
a fallback block reintroduces the duplication it was meant to remove.

**When is duplicating the dark palette acceptable?**
When a build emits both blocks from one token source. Duplication a human
maintains drifts; duplication a compiler emits cannot — and it also guarantees
both blocks carry the same key set.

**Why can't the two dark blocks be merged into one selector list?**
One of them is inside a media query and the other is outside it. A selector list
cannot span that boundary.

**What is wrong with `color-mix(in srgb, var(--accent) 85%, white)` for hover?**
Two things. `white` is not themed, so hover lightens in dark mode where it
should darken; and the sRGB mix passes through a desaturated middle, greying the
ramp. Mix toward `var(--surface)` in `oklab`.

**What should the mix target be, in general?**
Whatever the element sits on. That is `--surface` on the page and
`--surface-raised` inside a card, which is why the derivation is parameterised
by a component token rather than hard-coded.

**Which colours may be derived and which must be declared?**
Variants of one role (hover, active, disabled, quiet) may be derived. Distinct
meanings — the stock states, the status set, `--danger-quiet` — are declared,
because a fixed mix percentage cannot hold a contrast guarantee across two
themes.

**Why register a custom property with `@property`?**
An unregistered custom property is an untyped string: it cannot interpolate, so
animations jump. Registration also supplies `initial-value`, which turns an
invalid token into a visibly wrong colour instead of a silent fallback to
inherited.

---

← Prev: [The token layer](02-the-token-layer.md) · Index: [Dark mode](README.md) · Next → [The flash and the boot](03-the-flash-and-the-boot.md)
