---
title: "Loops and maps — generating CSS from data"
sidebar_label: "06 · Loops and maps"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the **Sass documentation** —
> [`@each`](https://sass-lang.com/documentation/at-rules/control/each/),
> [`@for`](https://sass-lang.com/documentation/at-rules/control/for/),
> [Maps](https://sass-lang.com/documentation/values/maps/) and
> [`sass:map`](https://sass-lang.com/documentation/modules/map/).

**Generating selectors from data is the strongest remaining argument for Sass.**
Custom properties can hold values and `calc()` can do arithmetic, but neither can
produce a *class name* — that requires a build step.

## `@each` over a list or map

```scss
$sizes: (xs: 0.25rem, sm: 0.5rem, md: 1rem, lg: 2rem);

@each $name, $value in $sizes {
  .m-#{$name}  { margin: $value; }
  .mt-#{$name} { margin-block-start: $value; }
  .p-#{$name}  { padding: $value; }
}
```

Twelve utility classes from four data entries. Adding a size means adding one
map entry — the classes follow automatically, and they cannot drift out of sync
with the scale.

`#{...}` interpolation is what puts the value into the **selector**; that is the
part CSS alone cannot do.

## `@for` for numeric ranges

```scss
@for $i from 1 through 12 {
  .col-#{$i} { grid-column: span $i; }
}
```

`through` includes the final value; `to` excludes it. A twelve-column system in
three lines — and it is generated, so it cannot be inconsistent.

## Maps and `sass:map`

Maps are Sass's key–value structure, and the `sass:map` module is how you read
them:

```scss
@use "sass:map";

$theme: (
  colors: (brand: #2563eb, danger: #dc2626),
  radii:  (sm: 4px, md: 8px),
);

.button {
  background: map.get($theme, colors, brand);   // nested lookup
  border-radius: map.get($theme, radii, md);
}
```

`map.get` with multiple keys traverses nested maps. It returns `null` for a
missing key rather than erroring, which is why a guard is worth adding:

```scss
@function token($path...) {
  $value: map.get($theme, $path...);
  @if $value == null { @error "Unknown token: #{$path}"; }
  @return $value;
}
```

Other useful members: `map.has-key`, `map.keys`, `map.values`, `map.merge`
(combining maps, for theme overrides) and `map.set`.

**`sass:map` must be loaded** — `@use "sass:map"` — since the global `map-get()`
function is deprecated in favour of the module form.

## The pattern that pays: one source of truth

Combine a map with the hybrid from
[03 · Variables vs custom properties](./03-variables-sass-vs-custom-properties.md)
and both halves come from the same data:

```scss
@use "sass:map";

$space: (0: 0, 1: 0.25rem, 2: 0.5rem, 3: 1rem, 4: 2rem);

// custom properties for runtime use
:root {
  @each $key, $val in $space {
    --space-#{$key}: #{$val};
  }
}

// utility classes for authoring
@each $key, $val in $space {
  .p-#{$key} { padding: var(--space-#{$key}); }
  .m-#{$key} { margin:  var(--space-#{$key}); }
}
```

One map produces the custom properties *and* the classes, and the classes
reference the custom properties rather than the literal values — so a theme can
still override a step at runtime.

**Note the `#{$val}` interpolation** in the custom property declaration. Without
it the literal text `$val` is emitted, exactly as covered in topic 03.

## Generating responsive variants — carefully

The obvious extension is a variant per breakpoint:

```scss
@each $bp-name, $bp in $breakpoints {
  @media (width >= $bp) {
    @each $key, $val in $space {
      .#{$bp-name}\:p-#{$key} { padding: var(--space-#{$key}); }
    }
  }
}
```

This is how utility frameworks generate their output, and it is where generated
CSS gets very large very quickly: **breakpoints × properties × steps**. Five
breakpoints, ten properties and eight steps is 400 rules from a few lines of
source.

Generate only the combinations actually used, or accept that this is what a
purge/tree-shaking step exists for.

## Trade-off

**Generation removes drift and hides volume.** The source stays small and
readable while the output grows multiplicatively, and nothing in the Sass file
signals that a nested loop just emitted four hundred rules. The failure is
silent, appears only in the built artefact, and is usually discovered from a
bundle-size report rather than from reading code.

There is a debugging cost too: a class that does not exist is not a compile
error — it simply was never generated — so a typo in a utility name fails as
silently as a typo in any class name, with no source to search for.

Generation is still right for genuine scales — spacing, colours, columns — where
the alternative is hand-maintained lists that inevitably drift. It is wrong as a
general authoring style, and the moment a loop's body starts branching on the
key, the data has stopped being uniform and the classes should be written out.

## Gotchas

**A custom property emits `$val` literally.**
*Symptom:* `--space-3: $val` in the output.
*Cause:* custom property values are opaque to Sass.
*Fix:* interpolate — `--space-#{$key}: #{$val}`.

**`map-get` is deprecated.**
*Symptom:* deprecation warnings on build.
*Cause:* the global function form.
*Fix:* `@use "sass:map"` and call `map.get`.

**A lookup silently returns nothing.**
*Symptom:* a property compiles to an empty value.
*Cause:* `map.get` returns `null` for a missing key rather than erroring.
*Fix:* a wrapper function with `@error`.

**The stylesheet is enormous.**
*Symptom:* hundreds of kilobytes of CSS.
*Cause:* nested loops multiplying breakpoints × properties × steps.
*Fix:* generate fewer combinations, or add a purge step.

**A generated class does not exist.**
*Symptom:* a utility does nothing and there is no error.
*Cause:* the class was never generated — a typo, or a key absent from the map.
*Fix:* check the map keys; consider generating a documentation page from the
same data.

## Interview questions

**★ What can Sass loops do that CSS cannot?**
Generate **selectors**. Custom properties hold values and `calc()` does
arithmetic, but neither can produce a class name. `@each` with interpolation —
`.m-#{$name}` — creates rules from data, which requires a build step.

**★ How would you generate a spacing scale that is usable at runtime?**
Iterate one map twice: once to emit custom properties on `:root`
(`--space-#{$key}: #{$val}`) and once to emit utility classes that reference
those custom properties. One source of truth, and the values remain themeable
because the classes point at custom properties rather than literals.

**★ What is the risk with generated responsive variants?**
Multiplicative growth — breakpoints × properties × steps. A few lines of source
can emit hundreds of rules, and nothing in the source indicates the volume. Limit
the combinations or use a purge step.

**Why must `sass:map` be loaded explicitly?**
The global `map-get()` function is deprecated in favour of the module form, so
`@use "sass:map"` and `map.get` is the current API.

**What does `map.get` do on a missing key?**
Returns `null` silently. A wrapper function that `@error`s on `null` turns a typo
into a build failure instead of an empty value.

**What is the difference between `@for … through` and `@for … to`?**
`through` includes the final value; `to` stops one short.

---

← [05 · Mixins](./05-mixins.md) · Next: [07 · Sass functions](./07-sass-functions.md) →
