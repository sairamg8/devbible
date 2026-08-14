---
title: "Custom properties as a component API"
sidebar_label: "01 · Custom properties as a component API"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascading_variables/Using_CSS_custom_properties)**
> and the **W3C CSS Custom Properties for Cascading Variables Level 1**
> specification ([`var()`](https://www.w3.org/TR/css-variables-1/#using-variables)).

**A custom property is not a variable — it is an inherited value that
participates in the cascade.** That one difference is what turns it into a
component API: the *rule* stays in your stylesheet, and the *value* can come
from a parent, a modifier class, an inline attribute, or JavaScript, without
either side knowing about the other.

## The shape of the API

A component declares what it reads, with a fallback for when nobody supplies it:

```css
.card {
  padding: var(--card-padding, 1rem);
  border-radius: var(--card-radius, 8px);
  background: var(--card-surface, white);
  border: 1px solid var(--card-border, #ddd);
}
```

Nothing else changes. The consumer now has four knobs and needs no extra
classes, no modifier variants and no access to your source:

```css
.sidebar .card  { --card-padding: 0.5rem; --card-radius: 4px; }
.featured .card { --card-surface: #fffbe6; --card-border: goldenrod; }
```

This is the whole pattern. What makes it work is that `--card-padding` set on
`.sidebar` **inherits down** to the `.card` inside it, and `var()` resolves
against the element the rule is applied to — not the element where the value
was declared.

## The fallback is a second argument, not a default

```css
padding: var(--card-padding, 1rem);
```

The second argument is used when `--card-padding` is **not set at all**. It is
not a type check and it is not a safety net for bad values — see the
invalid-at-computed-value-time behaviour below.

The fallback may itself contain commas, which trips people up:

```css
font-family: var(--font, Georgia, "Times New Roman", serif);
```

Everything after the *first* comma is the fallback, so this is one fallback of
three families, not three arguments.

## Scoping: the value lives on the element, not in a namespace

Custom properties resolve per element, following inheritance. Setting one on
`:root` makes it global; setting it lower overrides it for that subtree only.

```css
:root       { --gap: 1rem; }        /* everywhere */
.compact    { --gap: 0.5rem; }      /* this subtree */
.grid       { gap: var(--gap); }
```

A `.grid` inside `.compact` gets `0.5rem`; the same component elsewhere gets
`1rem`. The component's rule was written once and never mentions `.compact`.

**This is genuinely different from a Sass variable**, which is resolved at
compile time and has no notion of a subtree. A Sass `$gap` would have baked one
number into the output; `--gap` stays live in the document.

## Setting a value from outside CSS

Three routes in, all reaching the same place:

```html
<!-- 1. inline, per instance -->
<div class="card" style="--card-surface: #eef">…</div>
```

```js
// 2. from script
el.style.setProperty('--card-surface', '#eef');
el.style.removeProperty('--card-surface');

// 3. reading the resolved value back
getComputedStyle(el).getPropertyValue('--card-surface').trim();
```

The inline route is what makes custom properties the right way to pass *dynamic
values* from a component framework. Passing a whole style object inline couples
the framework to your CSS; passing one custom property does not:

```jsx
<div className="progress" style={{'--value': `${pct}%`}} />
```

```css
.progress::after { inline-size: var(--value, 0%); }
```

The styling stays in the stylesheet where it can use layers, media queries and
pseudo-elements. Only the number crosses the boundary.

## Invalid at computed-value time

This is the behaviour that surprises people, and it is worth knowing precisely
because it does *not* work like a normal invalid declaration.

A normal bad declaration is dropped at parse time and the previous value stands:

```css
color: red;
color: nonsense;   /* dropped — element stays red */
```

A declaration containing a `var()` cannot be checked at parse time, because the
substituted value is not known yet. So it is parsed as valid, substituted later,
and if the result does not make sense the property becomes **unset** — it is
*not* dropped back to the earlier declaration:

```css
color: red;
color: var(--brand);      /* --brand: 10px  →  colour becomes unset, */
                          /* which for `color` means inherited, not red */
```

One malformed token can therefore blank a property rather than fall back to the
line above it. Two defences:

- **Give `var()` a fallback** — `var(--brand, red)` covers the *unset* case.
- **Register the property with `@property`** so a bad value falls back to a
  declared `initial-value` instead. That is the subject of
  [03 · `@property`](./03-at-property.md).

## Naming that survives

Custom properties are global by default, so the name is the namespace:

```css
--card-padding      /* component-scoped: prefix with the component */
--color-surface     /* semantic: what it means */
--color-blue-600    /* primitive: what it is */
```

The rule worth keeping: **a component should read semantic or component-scoped
names, never primitives.** `padding: var(--space-3)` couples every component to
one scale; `padding: var(--card-padding, var(--space-3))` gives the consumer an
override and keeps the default.

## Trade-off

**Every custom property you expose is API you cannot easily remove.** A
component with four documented knobs is flexible; the same component with
twenty is a configuration language nobody can hold in their head, and each one
is a name that some consumer somewhere is now setting.

There is a smaller runtime cost too: `var()` resolution happens at
computed-value time for every element that inherits the property, so a custom
property set on `:root` and read by thousands of elements is real work — though
in practice it is dwarfed by layout, and this is not a reason to avoid them.

The honest guidance is the same as for any API: expose the axes you intend to
support, give them fallbacks so the component works with none of them set, and
treat adding a new one as a version change rather than a tweak.

## Gotchas

**A property silently becomes unset instead of using the previous value.**
*Symptom:* `color: var(--x)` where `--x` holds a length blanks the colour rather
than falling back to the `color: red` above it.
*Cause:* invalid at computed-value time — the declaration was valid at parse
time, so it replaced the earlier one before the substitution failed.
*Fix:* `var(--x, red)`, or register `--x` with `@property` and a valid
`initial-value`.

**The fallback never fires for a bad value.**
*Symptom:* `var(--size, 1rem)` still breaks when `--size: banana`.
*Cause:* the fallback covers "not set", not "set to nonsense".
*Fix:* `@property` with a `syntax` — that is the only type check available.

**Setting the property on the component does nothing.**
*Symptom:* `.card { --card-padding: 2rem }` in the consumer's stylesheet is
ignored.
*Cause:* it competes with the component's own rule at the same element via the
normal cascade — layer or specificity decided it, not inheritance.
*Fix:* set it on an ancestor (`.sidebar .card` or `.sidebar`), where inheritance
delivers it with nothing to compete against.

**A custom property does not work in a media query.**
*Symptom:* `@media (min-width: var(--bp))` is ignored.
*Cause:* custom properties resolve per element; a media query is evaluated
before and outside any element context.
*Fix:* a Sass variable, or a container query with `@container style()` for the
component-level case.

## Interview questions

**★ Why is a custom property not the same thing as a Sass variable?**
A Sass variable is a compile-time constant substituted into the output. A custom
property is a live, inherited value that participates in the cascade — it can be
scoped to a subtree, changed by a class, set inline per instance, read and
written from script, and transitioned when registered. A Sass variable can do
none of that, but it can be used where CSS has no element context, such as a
media-query condition.

**★ What does the second argument to `var()` do, and what does it not do?**
It supplies a value when the custom property is not set. It does not validate —
if the property is set to something nonsensical for the target property, the
fallback is not used and the declaration becomes invalid at computed-value time.

**★ What is "invalid at computed-value time" and why does it matter?**
A declaration containing `var()` parses as valid because substitution has not
happened yet, so it wins the cascade and replaces earlier declarations. If the
substituted result is invalid for that property, the property becomes unset
rather than reverting to the previous declaration — so one bad token can blank a
property instead of falling back.

**How do you pass a dynamic value from JavaScript or a component framework into
CSS without inlining styles?**
Set a single custom property — `el.style.setProperty('--value', x)` or
`style={{'--value': x}}` — and read it with `var()` in the stylesheet. The
styling logic stays in CSS where layers, media queries and pseudo-elements are
available; only the datum crosses the boundary.

**Where should a custom property be set so a component picks it up?**
On an ancestor, so it arrives by inheritance. Setting it in a rule that targets
the component itself puts it into cascade competition with the component's own
declaration.

---

Next: [02 · `clamp()`, `min()`, `max()`](./02-clamp-min-max.md) →
