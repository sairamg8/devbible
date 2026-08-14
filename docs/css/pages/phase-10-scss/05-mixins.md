---
title: "Mixins — @mixin, @include, @content"
sidebar_label: "05 · Mixins"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **Sass documentation** —
> [`@mixin` and `@include`](https://sass-lang.com/documentation/at-rules/mixin/).

**A mixin injects declarations at the call site.** That is both its power — it can
carry logic, arguments and whole blocks — and its cost: every call site gets its
own copy of the output.

## The basics

```scss
@mixin visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.skip-link:not(:focus) { @include visually-hidden; }
```

The mixin's declarations are pasted into the rule. No selector is generated, and
nothing is shared between call sites.

## Arguments, defaults and keywords

```scss
@mixin button($bg, $fg: white, $radius: 6px) {
  background: $bg;
  color: $fg;
  border-radius: $radius;
}

.btn-primary { @include button(#2563eb); }
.btn-danger  { @include button(#dc2626, $radius: 999px); }
```

**Keyword arguments** let you skip earlier defaults, which keeps a mixin usable
as it grows. A mixin with five positional arguments and no keywords at the call
site is unreadable within a month.

Variable-length arguments exist too:

```scss
@mixin shadow($shadows...) { box-shadow: $shadows; }
.card { @include shadow(0 1px 2px #0002, 0 4px 12px #0001); }
```

## `@content`: passing a block

The feature that makes mixins more than named declaration lists:

```scss
@mixin media-up($bp) {
  @media (width >= $bp) { @content; }
}

.card {
  padding: 1rem;
  @include media-up(48rem) { padding: 2rem; }
}
```

The block after `@include` is injected where `@content` appears. **This is the
single most common real use of mixins in a modern codebase** — a named breakpoint
wrapper, since [03](./03-variables-sass-vs-custom-properties.md) established that
a `var()` cannot be used in a media-query condition.

With a map of breakpoints:

```scss
@use "sass:map";

$breakpoints: (sm: 30rem, md: 48rem, lg: 64rem);

@mixin up($name) {
  $bp: map.get($breakpoints, $name);
  @if not $bp { @error "Unknown breakpoint: #{$name}"; }
  @media (width >= $bp) { @content; }
}

.card { @include up(md) { padding: 2rem; } }
```

`@error` on an unknown name turns a silent typo into a build failure — worth
adding to any lookup mixin.

`@content` can take arguments, which is occasionally useful:

```scss
@mixin theme-each {
  @each $name, $bg in (light: #fff, dark: #16181d) {
    [data-theme="#{$name}"] & { @content($bg); }
  }
}

.card { @include theme-each using ($bg) { background: $bg; } }
```

## When a mixin beats a class, and when it does not

This is the decision that matters.

**A mixin duplicates output.** Ten call sites of a twenty-declaration mixin
produce two hundred declarations in the CSS. A shared class produces twenty, once.

| Use a mixin | Use a class |
|---|---|
| the output varies by argument | the output is identical everywhere |
| it wraps a block (`@content`) — media queries, theme selectors | it is a reusable visual style |
| it is a few declarations, used a handful of times | it is many declarations, used widely |
| the consumer cannot add a class (styling a third-party component) | you control the markup |

The clearest smell is a mixin taking **no arguments** and containing many
declarations. That is a class written in the wrong place.

```scss
// ⚠️ this should be a class
@mixin card-base { padding: 1rem; border-radius: 8px; background: #fff; /* …12 more… */ }
```

## `@extend` is not the answer

The historical fix for duplication was `@extend`, which merges selectors instead
of copying declarations:

```scss
%card-base { padding: 1rem; border-radius: 8px; }
.card { @extend %card-base; }
.panel { @extend %card-base; }
```

```css
.card, .panel { padding: 1rem; border-radius: 8px; }
```

Less output — and it moves the rule to wherever the placeholder was defined,
which changes source order and therefore the cascade. Inside media queries it
does not work at all across boundaries. Full treatment in
[08 · Control flow and `@extend`](./08-control-flow-and-extend.md); the short
version is that **mixins plus gzip are usually the better trade**, because
repeated declaration blocks compress extremely well.

## Trade-off

**Mixins trade output size for authoring flexibility, and the trade is usually
worth it — but it is invisible.** Nothing in the source shows that a mixin is
included forty times; you find out by looking at the compiled file, which nobody
does routinely. A codebase can accumulate tens of kilobytes of duplicated
declarations without any signal.

Gzip and Brotli compress that duplication well, which is why the practical
penalty is smaller than it looks and why "just use mixins" is reasonable advice.
It is not free though: the browser still parses every duplicated declaration, and
on a very large stylesheet that is measurable.

The discipline is simple and rarely applied: **mixins for things that vary or
wrap; classes for things that repeat identically.** If a mixin has no arguments
and no `@content`, ask why it is not a class.

## Gotchas

**Compiled CSS is far larger than expected.**
*Symptom:* a small source produces a big stylesheet.
*Cause:* a large no-argument mixin included at many call sites.
*Fix:* make it a class, or reduce it to the part that genuinely varies.

**`@content` block is ignored.**
*Symptom:* the passed block does not appear.
*Cause:* the mixin has no `@content` directive.
*Fix:* add `@content` where the block should be injected.

**A breakpoint typo silently does nothing.**
*Symptom:* the media query never matches.
*Cause:* `map.get` returned `null` for an unknown key and the query compiled to
nonsense.
*Fix:* `@if not $bp { @error … }` in the mixin.

**Arguments have to be passed in order.**
*Symptom:* a default cannot be skipped.
*Cause:* positional arguments only.
*Fix:* keyword arguments — `@include button(#dc2626, $radius: 999px)`.

**A mixin's declarations lose to something unexpected.**
*Symptom:* an override does not apply.
*Cause:* the mixin injects declarations at the call site, so they carry that
rule's specificity and position — not the mixin's.
*Fix:* expected behaviour; adjust at the call site.

## Interview questions

**★ What does `@content` do and what is its most common use?**
It injects the block passed to `@include` at that point in the mixin. The most
common use is a breakpoint wrapper — `@mixin up($bp) { @media (width >= $bp) {
@content; } }` — which is needed because a CSS custom property cannot be used in
a media-query condition.

**★ When should a mixin be a class instead?**
When the output is identical at every call site. A mixin copies its declarations
into each caller, so a large no-argument mixin used widely duplicates everything;
a class emits the declarations once. Mixins earn their cost when the output
varies by argument or when they wrap a block.

**★ What is the output cost of mixins, and how bad is it in practice?**
Every call site gets a full copy of the declarations. Gzip and Brotli compress
the repetition well so the transfer cost is modest, but the browser still parses
every duplicate — measurable only on very large stylesheets.

**How do you make a mixin fail loudly on a bad argument?**
`@error` — for example, checking a `map.get` lookup and erroring on `null` turns
a silent typo into a build failure.

**Why use keyword arguments?**
They let a caller skip earlier defaults and make the call site self-documenting,
which matters as soon as a mixin has more than two or three parameters.

**Does a mixin create a selector?**
No. It injects declarations into the rule that includes it, so they carry that
rule's specificity and source position.

---

← [04 · `@use` and `@forward`](./04-use-and-forward.md) · Next: [06 · Loops and maps](./06-loops-and-maps.md) →
