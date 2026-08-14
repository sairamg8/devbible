---
title: "@property"
sidebar_label: "03 · @property"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property)**
> and the **CSS Properties and Values API Level 1** specification
> ([computationally independent](https://drafts.css-houdini.org/css-properties-values-api-1/#computationally-independent)).
> Baseline: **Newly available since 2024-07-09** (`web-features` 3.34.3) — check
> support before relying on it for anything but progressive enhancement.

**`@property` gives a custom property a type — and the type is what makes it
animatable and what makes a bad value fail safely.** Without it a custom
property is an untyped token stream that the browser cannot interpolate and
cannot validate.

## The declaration

```css
@property --brand-hue {
  syntax: "<number>";
  inherits: true;
  initial-value: 250;
}
```

Three descriptors, and the rules around them are strict:

| Descriptor | Required? | What it does |
|---|---|---|
| `syntax` | **always** | The grammar the value must match — `"<color>"`, `"<length>"`, `"<number>"`, `"<percentage>"`, `"<length-percentage>"`, `"<angle>"`, `"<image>"`, `"*"`, or a `\|`-separated union |
| `inherits` | **always** | `true` or `false` — whether the registration inherits by default |
| `initial-value` | **conditionally** | Required unless `syntax` is `"*"` |

MDN is explicit about the failure mode:

> "The `@property` rule must include both the `syntax` and `inherits`
> descriptors. If either is missing, the entire `@property` rule is invalid and
> ignored."

and

> "If the `initial-value` descriptor is required but omitted, the entire
> `@property` rule is invalid and ignored."

**A malformed `@property` fails silently and completely.** There is no partial
registration and no console error — the custom property simply stays untyped,
which usually shows up as an animation that refuses to run.

## `initial-value` must be computationally independent

A real constraint that catches people:

> "If the value of the `syntax` descriptor is not the universal syntax
> definition, the `initial-value` descriptor has to be a *computationally
> independent* value. This means the value can be converted into a computed
> value without depending on other values."

So `10px`, `2in` and `45deg` are fine. **`3em` is not** — it depends on the
parent's `font-size`. Neither is a percentage in most contexts, nor `currentcolor`.
Use an absolute value, and express the relative part where the property is
*used* rather than where it is registered.

## Why registration makes a property animatable

An unregistered custom property is, to the browser, an arbitrary token stream.
Asked to interpolate between `"10px"` and `"100px"` it has no basis to compute a
midpoint, so it falls back to discrete behaviour — the value flips at the 50%
mark rather than moving.

Declaring `syntax: "<length>"` tells the engine the value *is* a length, and
lengths have defined interpolation. The animation becomes smooth.

```css
@property --progress {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

.bar {
  background: linear-gradient(to right, seagreen var(--progress), #eee var(--progress));
  transition: --progress 400ms ease;
}
.bar:hover { --progress: 100%; }
```

Remove the `@property` block and the gradient jumps rather than sweeps. Nothing
else in that snippet changes.

This is the single most common reason to reach for `@property`, and it unlocks
a family of effects that previously needed JavaScript: animated gradients,
animated conic-gradient dials, and any transition of a value used inside a
function that CSS cannot otherwise interpolate.

## The other half: bad values stop being catastrophic

[01 · Custom properties as a component API](./01-custom-properties-as-a-component-api.md)
covered invalid-at-computed-value-time — a bad `var()` substitution makes the
property **unset** rather than falling back to the previous declaration.

Registration changes that. With a declared `syntax` and `initial-value`, a value
that does not match the grammar is rejected at the custom property itself, and
the property takes its **`initial-value`** instead:

```css
@property --card-radius {
  syntax: "<length>";
  inherits: false;
  initial-value: 8px;
}

.card { --card-radius: banana; border-radius: var(--card-radius); }
/* radius is 8px — the registered initial value, not unset */
```

That is a meaningful robustness gain for anything consumer-settable. A component
API built on registered properties cannot be broken by a consumer typing the
wrong unit.

## `inherits: false` is the one to think about

The default instinct is `true`, but component-scoped knobs usually want `false`:

```css
@property --card-radius { syntax: "<length>"; inherits: false; initial-value: 8px; }
```

With `inherits: false`, a `.card` nested inside another `.card` does not silently
pick up its parent's radius — it gets the initial value unless set. For a value
that is genuinely ambient (a theme hue, a spacing scale) `inherits: true` is
right. For a per-component setting it is usually wrong.

## Registering from JavaScript

The same registration is available at runtime, which is occasionally useful in a
component library that ships no global CSS:

```js
CSS.registerProperty({
  name: '--progress',
  syntax: '<percentage>',
  inherits: false,
  initialValue: '0%',
});
```

Registering the same name twice throws, so guard it. The CSS form is preferable
where you have a stylesheet at all — it is declarative, it is in the cascade,
and it cannot run twice.

## Trade-off

**Typing a custom property makes it strict, and strictness is not always what
you want.** The escape hatch that makes untyped custom properties so useful —
holding *any* token stream, including fragments like `1px solid red` or a whole
shorthand value — disappears the moment you declare a `syntax`. A property
registered as `<length>` can no longer carry `0 auto`, and a property you
intended to hold an arbitrary snippet must stay at `"*"`, which forfeits both
animation and validation.

Baseline is the other half of the cost: **newly available since 2024-07-09**,
which is recent enough that a project supporting older browsers gets the
animation as an enhancement and must ensure the un-animated state is acceptable.
The registration failing silently means there is no runtime signal when it does
not apply.

Use it where the value is genuinely typed and the animation or the validation
earns the rigidity — progress values, hues, angles, lengths in a component API.
Leave ad-hoc snippets untyped.

## Gotchas

**The animation still jumps after adding `@property`.**
*Symptom:* the transition is discrete despite registration.
*Cause:* the `@property` rule is invalid and was ignored — most often a missing
`initial-value` with a non-`*` syntax, or a missing `inherits`.
*Fix:* all three descriptors, and check `initial-value` matches the declared
syntax exactly.

**`initial-value: 1em` is rejected.**
*Symptom:* the whole rule is dropped.
*Cause:* `initial-value` must be computationally independent, and `em` depends on
the parent font size.
*Fix:* use an absolute value such as `16px`.

**A nested component inherits a value it should not.**
*Symptom:* a card inside a card copies the outer card's radius.
*Cause:* `inherits: true` on a component-scoped property.
*Fix:* `inherits: false` for per-component knobs.

**`syntax: "<length>"` rejects `0`.**
*Symptom:* a plain `0` falls back to the initial value.
*Cause:* the grammar is matched strictly; a unitless zero is a `<number>`, not a
`<length>`, in this context.
*Fix:* write `0px`, or widen the syntax to `"<length> | <number>"`.

**Registering the same property twice from JavaScript throws.**
*Symptom:* an exception on a second component mount.
*Cause:* `CSS.registerProperty` is not idempotent.
*Fix:* wrap in `try`/`catch`, or register in CSS instead.

## Interview questions

**★ What does `@property` give you that a plain custom property does not?**
A type. The declared `syntax` lets the browser interpolate the value, so it can
be transitioned and animated, and it lets the browser validate it, so an invalid
value falls back to a declared `initial-value` instead of leaving the property
unset.

**★ Which descriptors are required?**
`syntax` and `inherits` always; `initial-value` whenever `syntax` is anything
other than `"*"`. Omit a required one and the entire rule is invalid and
silently ignored.

**★ Why can't `initial-value` be `2em`?**
It must be computationally independent — convertible to a computed value without
reference to anything else. `em` depends on the parent's `font-size`, so it is
rejected and the whole registration fails.

**Why does registering a property make it animatable?**
Interpolation needs a known type. An untyped custom property is an arbitrary
token stream with no defined midpoint, so it animates discretely. Declaring it a
`<length>` or `<percentage>` gives the engine a defined interpolation.

**How does registration change invalid-value behaviour?**
Unregistered, a bad substitution makes the property invalid at computed-value
time and the property becomes unset. Registered, a value that fails the syntax
is rejected and the property falls back to its `initial-value`.

**When would you choose `inherits: false`?**
For component-scoped settings, so a nested instance does not inherit its
ancestor's value. Ambient values such as a theme hue want `inherits: true`.

---

← [02 · `clamp()`, `min()`, `max()`](./02-clamp-min-max.md) · Next: [04 · Units that matter for layout](./04-units-that-matter.md) →
