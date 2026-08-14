---
title: "Control flow and @extend"
sidebar_label: "08 · Control flow and @extend"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the **Sass documentation** —
> [`@if`/`@else`](https://sass-lang.com/documentation/at-rules/control/if/),
> [`@extend`](https://sass-lang.com/documentation/at-rules/extend/) and
> [Placeholder selectors](https://sass-lang.com/documentation/style-rules/placeholder-selectors/).

**`@if` makes a mixin adaptive; `@extend` merges selectors and is the one Sass
feature worth avoiding by default.**

## `@if` and `@else`

```scss
@use "sass:color";

@mixin button($bg) {
  background: $bg;
  // pick a readable foreground at build time
  color: if(color.channel($bg, "lightness", $space: oklch) > 0.6, #000, #fff);
}
```

Statement form for branching whole blocks:

```scss
@mixin surface($elevation: 0) {
  @if $elevation == 0 {
    background: var(--surface);
  } @else if $elevation == 1 {
    background: var(--surface-raised);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  } @else {
    @error "Unsupported elevation: #{$elevation}";
  }
}
```

Two things worth noting:

- **`if()` is a function**, evaluated inline, and returns one of two values.
  `@if` is an at-rule that controls which declarations are emitted. They are not
  interchangeable.
- **An `@else` that `@error`s** turns an unsupported argument into a build
  failure rather than silently emitting nothing. Worth doing in any mixin with a
  fixed set of accepted values.

### Truthiness

Everything is truthy except `false` and `null`. **`0` and the empty string are
truthy**, which differs from JavaScript and catches people:

```scss
@if $margin { }        // true even when $margin is 0
@if $margin != null { }  // usually what was meant
```

## `@extend`: what it actually does

`@extend` does **not** copy declarations. It rewrites the *selector* of the
extended rule to include the extending one:

```scss
.message { padding: 1rem; border-radius: 4px; }
.error { @extend .message; border-color: red; }
```

```css
.message, .error { padding: 1rem; border-radius: 4px; }
.error { border-color: red; }
```

Less output than a mixin, which duplicates the declarations. That is the entire
argument in its favour — and the costs are larger than the saving.

## Why `@extend` is discouraged

**1. It moves your rule in the cascade.** The extending selector is inserted
wherever the *extended* rule sits in the source, not where you wrote it. A rule
you placed last can end up emitted first, and lose to something it should have
beaten. This is a genuine, hard-to-diagnose cascade bug.

**2. It cannot cross `@media` boundaries.**

```scss
.a { color: red; }
@media (width > 40rem) {
  .b { @extend .a; }    // ❌ error
}
```

Sass cannot merge a selector into a rule in a different media context, so the
pattern fails exactly where responsive code needs it.

**3. It extends *every* occurrence of the selector.** If `.message` also appears
as `.sidebar .message` and `.modal .message`, extending it pulls your class into
all of them:

```css
.message, .error,
.sidebar .message, .sidebar .error,
.modal .message, .modal .error { … }
```

Selector output grows combinatorially, and the result is frequently larger than
the duplication it was meant to avoid.

## Placeholders: the only safe form

`%name` selectors are emitted **only** when extended:

```scss
%card-base { padding: 1rem; border-radius: 8px; background: var(--surface); }

.card  { @extend %card-base; }
.panel { @extend %card-base; }
```

```css
.card, .panel { padding: 1rem; border-radius: 8px; background: var(--surface); }
```

A placeholder cannot appear in the DOM, so problem 3 disappears — there are no
other occurrences to pull in. Problems 1 and 2 remain: cascade position is still
the placeholder's, and media boundaries still cannot be crossed.

**If you use `@extend` at all, only ever extend a placeholder.**

## The practical verdict

| | Mixin | `@extend` + placeholder |
|---|---|---|
| Output size | duplicated per call site | merged, emitted once |
| After gzip | very close — repetition compresses well | slightly smaller |
| Cascade position | at the call site, predictable | at the placeholder, surprising |
| Media queries | works everywhere | cannot cross boundaries |
| Arguments | yes | no |
| `@content` blocks | yes | no |

**Prefer mixins.** Repeated declaration blocks compress extremely well, so the
transfer-size argument for `@extend` is much weaker than it appears, and the
cascade unpredictability is a real correctness risk rather than a performance
one.

The honest exception: a large, genuinely identical block shared by many
selectors, in a single media context, where output size has been measured and
matters. That is rare.

## Trade-off

**`@extend` optimises the artefact and complicates the model.** The saving is
real and small; the cost is that a rule's position in the cascade is no longer
where you wrote it, which breaks the one thing CSS authors rely on to reason
about overrides. Phase 2 spent four topics on the cascade being predictable;
`@extend` makes it not.

There is a maintenance cost as well: the selector list that results is generated,
so a stylesheet's largest rules may have no single author and no obvious origin
in the source. Debugging why `.error` is in a selector list means tracing an
`@extend` several files away.

The reasonable position is that `@extend` was a solution to a problem — output
size before ubiquitous compression — that has largely gone away, while its costs
have not. Mixins for shared blocks, classes for shared styles, and `@extend` only
with placeholders and only when measured.

## Gotchas

**An extended rule loses to something it should beat.**
*Symptom:* an override stops working after an `@extend` is added.
*Cause:* the selector was merged at the extended rule's source position, changing
its cascade order.
*Fix:* use a mixin, or move the placeholder definition.

**"You may not `@extend` selectors across media queries."**
*Symptom:* a build error inside a media block.
*Cause:* `@extend` cannot merge across media contexts.
*Fix:* a mixin, which works in any context.

**The selector list explodes.**
*Symptom:* one rule has dozens of selectors.
*Cause:* extending a real class that appears in several compound selectors.
*Fix:* extend a `%placeholder` instead.

**A placeholder emits nothing.**
*Symptom:* no output for `%card-base`.
*Cause:* correct — placeholders are emitted only when extended.
*Fix:* nothing; that is the feature.

**`@if $value` is true when the value is `0`.**
*Symptom:* a zero-value branch behaves as if set.
*Cause:* only `false` and `null` are falsy in Sass.
*Fix:* compare explicitly — `@if $value != null`.

## Interview questions

**★ What does `@extend` actually do, and how does it differ from a mixin?**
It rewrites the extended rule's selector list to include the extending selector,
so the declarations are emitted once and shared. A mixin copies the declarations
into every call site. `@extend` produces less output; a mixin is predictable in
the cascade and works with arguments, `@content` and media queries.

**★ Why is `@extend` discouraged?**
Three reasons: the merged rule sits at the *extended* rule's position in the
cascade, so overrides can silently break; it cannot cross `@media` boundaries;
and extending a real class pulls in every compound selector that class appears
in, which can grow the output combinatorially.

**★ What is a placeholder selector and what does it fix?**
`%name` — a selector emitted only when extended. It removes the third problem,
because a placeholder never appears in the DOM and so has no other occurrences to
pull in. The cascade-position and media-boundary problems remain.

**Is `@extend` worth it for output size?**
Rarely. Repeated declaration blocks compress extremely well under gzip or Brotli,
so the transfer saving is small, while the cascade unpredictability is a
correctness risk.

**What is the difference between `if()` and `@if`?**
`if()` is a function returning one of two values inline. `@if` is an at-rule that
controls which declarations are emitted.

**What is truthy in Sass?**
Everything except `false` and `null` — including `0` and the empty string, which
differs from JavaScript and is a common source of bugs in mixin guards.

---

← [07 · Sass functions](./07-sass-functions.md) · Back to [Phase 10 overview](./README.md)
