---
title: "Variables — Sass vs CSS custom properties"
sidebar_label: "03 · Variables vs custom properties"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **Sass documentation** —
> [Variables](https://sass-lang.com/documentation/variables/) — and
> **MDN — [Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascading_variables/Using_CSS_custom_properties)**.

**A Sass variable is a compile-time constant. A custom property is a live,
inherited runtime value.** They are not competing spellings of the same idea, and
each can do exactly one thing the other cannot.

## The difference in one example

```scss
$brand: #2563eb;              // Sass — resolved at build time
:root { --brand: #2563eb; }   // CSS  — exists in the browser

.button { background: $brand; }
.button { background: var(--brand); }
```

The compiled output:

```css
.button { background: #2563eb; }        /* the variable is GONE */
.button { background: var(--brand); }   /* the reference remains */
```

After compilation `$brand` does not exist. `--brand` does, and can still be
changed — by a class, by a media query, by an inline style, by JavaScript.

## What only a custom property can do

**Be themed, scoped or changed at runtime:**

```css
.card { --card-padding: 1rem; padding: var(--card-padding); }
.card--compact { --card-padding: 0.5rem; }
[data-theme="dark"] { --surface: #16181d; }
```

```js
el.style.setProperty('--progress', '60%');
```

None of this is possible with a Sass variable, because there is no variable left
at runtime to change. Anything involving **themes, component APIs, or values from
JavaScript** requires custom properties — see
[Phase 3 · Custom properties as a component API](../phase-3-custom-properties/01-custom-properties-as-a-component-api.md).

## What only a Sass variable can do

**Appear where CSS has no element context** — most importantly, inside an at-rule
condition:

```scss
$bp-md: 48rem;

@media (width >= $bp-md) { … }     // ✅ compiles to a literal value
@media (width >= var(--bp-md)) { … }  // ❌ does not work
```

A custom property resolves per element; a media query is evaluated before and
outside any element, so `var()` has nothing to resolve against. **Breakpoints are
therefore a genuine, remaining use for Sass variables.**

Sass variables also participate in build-time arithmetic and in loops:

```scss
$sizes: 1, 2, 3, 4;
@each $s in $sizes {
  .m-#{$s} { margin: #{$s * 0.25}rem; }
}
```

Custom properties can do arithmetic with `calc()`, but they cannot generate
*selectors*. That is the subject of
[06 · Loops and maps](./06-loops-and-maps.md).

## The hybrid that actually works

The mature arrangement uses each for what it is good at: **Sass generates the
structure, custom properties carry the values.**

```scss
// _tokens.scss — build-time source of truth
$brand-hue: 250;
$breakpoints: (sm: 30rem, md: 48rem, lg: 64rem);

:root {
  --brand: oklch(0.65 0.15 #{$brand-hue});
  --surface: #ffffff;
  --text: #16181d;
}

[data-theme="dark"] {
  --surface: #16181d;
  --text: #e8e8ea;
}

// Sass drives the media query; custom properties carry the runtime values
@media (width >= map.get($breakpoints, md)) {
  :root { --gutter: 2rem; }
}
```

Components then reference **only** custom properties:

```scss
.card {
  background: var(--surface);
  color: var(--text);
  padding: var(--gutter, 1rem);
}
```

**Using either alone is the common mistake.** A codebase entirely on Sass
variables cannot theme; one entirely on custom properties cannot express
breakpoints or generate utility classes.

## Interpolation: getting a Sass value into CSS syntax

`#{...}` is how a Sass value is inserted where CSS expects literal text:

```scss
--brand: oklch(0.65 0.15 #{$brand-hue});   // needed
content: "#{$name}";
@media (width >= #{$bp}) { … }
```

Inside a plain property value Sass usually substitutes without it, but in a
custom property declaration interpolation **is** required — custom property
values are treated as opaque text, so `--brand: $brand-hue` would emit the
literal string `$brand-hue`.

That is a genuinely common bug and the reason to learn interpolation early.

## Scope

Sass variables are lexically scoped to the block they are declared in:

```scss
$x: 1;
.a { $x: 2; }   // local to .a
// $x is still 1 here
```

`!global` overrides that, and is generally a smell. Custom properties, by
contrast, are scoped by the **DOM**, not the source — which is the whole basis of
the component-API pattern.

## Trade-off

**The hybrid is correct and doubles the number of places a value can live.**
"Where is this colour defined?" now has two possible answers, and a value that
should have been a custom property but was written as a Sass variable will work
fine until someone tries to theme it — at which point it must be moved, along
with everything referencing it.

There is a discoverability cost too: a `$brand` in a partial and a `--brand` on
`:root` may or may not be the same value, and nothing enforces the relationship
beyond convention.

The rule that keeps it manageable: **if the value could ever differ at runtime —
per theme, per component instance, per user — it is a custom property. If it is
only ever needed to generate CSS at build time, it is a Sass variable.** Almost
everything falls cleanly on one side, and breakpoints are the main inhabitant of
the second category.

## Gotchas

**A custom property emits a literal `$variable` string.**
*Symptom:* `--brand: $brand-hue` outputs the text, not the value.
*Cause:* custom property values are opaque to Sass.
*Fix:* interpolate — `--brand: #{$brand-hue}`.

**`var()` in a media query does nothing.**
*Symptom:* the breakpoint never matches.
*Cause:* custom properties resolve per element; media queries have no element
context.
*Fix:* a Sass variable, or a build-time constant.

**A theme change does not affect a colour.**
*Symptom:* one colour stays fixed when the theme flips.
*Cause:* it was compiled from a Sass variable, so no reference remains.
*Fix:* move it to a custom property.

**A Sass variable change does not appear.**
*Symptom:* editing `$brand` changes nothing in the browser.
*Cause:* the stylesheet was not recompiled.
*Fix:* rebuild — unlike a custom property, this is not a runtime change.

**A local variable leaks or does not leak as expected.**
*Symptom:* a value set inside a block is or is not visible outside it.
*Cause:* Sass variables are lexically scoped; `!global` changes that.
*Fix:* declare at the top level, and avoid `!global`.

## Interview questions

**★ What is the fundamental difference between a Sass variable and a CSS custom
property?**
A Sass variable is a compile-time constant — it is substituted into the output
and does not exist in the browser. A custom property is a live value that
inherits, participates in the cascade, and can be changed at runtime by a class,
a media query, an inline style or JavaScript.

**★ Name one thing each can do that the other cannot.**
Only a custom property can be themed, scoped to a subtree, or set from
JavaScript. Only a Sass variable can be used in a media-query condition, because
custom properties resolve per element and a media query has no element context.

**★ What is the hybrid arrangement, and why is using either alone a mistake?**
Sass generates the structure — breakpoints, scales, generated utility classes —
while custom properties carry runtime values such as themes and component APIs.
A Sass-only codebase cannot theme; a custom-property-only codebase cannot express
breakpoints or generate selectors.

**Why does `--brand: $hue` not work?**
Custom property values are treated as opaque text by Sass, so the variable is not
substituted. It needs interpolation: `--brand: #{$hue}`.

**How are the two scoped?**
Sass variables are lexically scoped to the source block. Custom properties are
scoped by the DOM and inherit to descendants, which is what makes the
component-API pattern possible.

**Which should a breakpoint be?**
A Sass variable — it is needed inside a media-query condition, where `var()`
cannot be used.

---

← [02 · Nesting and `&`](./02-nesting-and-ampersand.md) · Next: [04 · `@use` and `@forward`](./04-use-and-forward.md) →
