---
title: "Inline style"
sidebar_label: "11 · Inline style"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Every
> `style` attribute below was read back off the live element by
> `sandbox/react-p1/ex10-inline-style.mjs`.

**`style` takes an object of camelCased CSS properties. React adds `px` to
numbers for most properties and not for others, and the list of exceptions is
worth knowing because the failure is silent.**

## The basics

```console
$ node ex10-inline-style.mjs
=== inline style — the style attribute React produced (production) ===
  --- camelCase to CSS ---
  {backgroundColor}                 "background-color: red;"
  {fontSize: 12}                    "font-size: 12px;"
  {fontSize: '12px'}                "font-size: 12px;"
  {fontSize: '12'}                  null
  {marginTop: 0}                    "margin-top: 0px;"
```

Note line four. **`{fontSize: '12'}` produces nothing at all** — a *string*
gets no automatic unit, so the browser receives `font-size: 12`, which is
invalid CSS and is dropped. No warning, no style.

That is the trap behind "my value from an input has no effect":

```jsx
<div style={{width: value}} />        // value from an <input> is a string → nothing
<div style={{width: Number(value)}} />  // → "300px"
<div style={{width: `${value}px`}} />   // → "300px", explicit
```

## Which numbers get `px`

```console
  --- which numbers get px, and which do not ---
  {width: 2}          "width: 2px;"        {lineHeight: 2}   "line-height: 2;"
  {margin: 2}         "margin: 2px;"       {zIndex: 2}       "z-index: 2;"
  {padding: 2}        "padding: 2px;"      {opacity: 2}      "opacity: 2;"
  {top: 2}            "top: 2px;"          {flex: 2}         "flex: 2 1 0%;"
  {borderWidth: 2}    "border-width: 2px;" {flexGrow: 2}     "flex-grow: 2;"
  {fontSize: 2}       "font-size: 2px;"    {fontWeight: 2}   "font-weight: 2;"
                                           {order: 2}        "order: 2;"
                                           {columnCount: 2}  "column-count: 2;"
                                           {gridRow: 2}      "grid-row: 2;"
                                           {aspectRatio: 2}  "aspect-ratio: 2 / 1;"
                                           {scale: 2}        "scale: 2;"
                                           {tabSize: 2}      "tab-size: 2;"
```

React holds a list of **unitless** properties and appends `px` to every other
numeric value. The right column is that list in action — everything there is a
ratio, a count, or an index, where a length would be meaningless.

`{marginTop: 0}` becoming `0px` rather than `0` is harmless, and a useful tell
that the number path ran.

## Vendor prefixes and custom properties

```console
  --- vendor prefixes and custom properties ---
  {WebkitLineClamp: 2}    "-webkit-line-clamp: 2;"
  {msTransform}           null
  {MozBoxSizing}          "box-sizing: border-box;"
  {'--brand': 'red'}      "--brand: red;"
  {'--gap': 8}            "--gap: 8;"
  {color: 'var(--brand)'} "color: var(--brand);"
```

Capitalised prefixes become hyphenated: `WebkitLineClamp` → `-webkit-line-clamp`.
The exception is Microsoft's, which is **lowercase `ms`** — `msTransform`, not
`MsTransform`. (It produced nothing here because Firefox 153 has no
`-ms-transform`; the casing rule is the point, not the result.)

`MozBoxSizing` came back as plain `box-sizing` — Firefox normalises the prefixed
form it no longer needs. Reading back a computed value is not always the value
you set.

**Custom properties work and are not px-suffixed.** `{'--gap': 8}` gives
`--gap: 8`, so a `calc(var(--gap) * 1px)` on the CSS side is needed if you want
a length. Setting custom properties inline is the cleanest way to pass a runtime
value into a stylesheet:

```jsx
<div className="card" style={{'--accent': user.color}}>
```

## Hyphenated and invalid keys

```console
  --- hyphenated and invalid keys ---
  {'font-size': 12}        "font-size: 12px;"
  {'background-color': 'red'} "background-color: red;"
  {notACssProperty: 1}     null
  {color: null}            null
  {color: undefined}       null
  {color: false}           null

  [error] Unsupported style property font-size. Did you mean fontSize?
  [error] Unsupported style property background-color. Did you mean backgroundColor?
```

🔴 **A hyphenated key still applies.** `{'font-size': 12}` set `font-size: 12px`
and warned. So the warning is not telling you the style failed — it is telling
you not to rely on it. Do not "fix" a working style by reading the warning as an
error.

`{notACssProperty: 1}` produced nothing **and no warning** — React only warns
for names that look like hyphenated CSS, not for camelCase names that are not
CSS at all. A typo in a camelCase property is silent.

`null`, `undefined` and `false` all remove the declaration, which is how you
conditionally omit one:

```jsx
<div style={{color: isError ? 'red' : undefined}} />
```

## What inline style cannot do

```console
  --- what inline style cannot express ---
  {':hover'}                        null
  {'@media (max-width: 1px)'}       null

  [error] Unsupported style property @media (max-width: 1px). Did you mean
          @media (maxWidth: 1px)?
```

An inline style is one declaration block on one element. It has:

- **no pseudo-classes** — `:hover`, `:focus`, `:focus-visible`, `:disabled`
- **no pseudo-elements** — `::before`, `::after`, `::placeholder`
- **no media or container queries**
- **no `@supports`, no keyframes**
- **no cascade** — it sits at the top of specificity, beaten only by
  `!important`, which you cannot write in the object form either

Note the nonsense suggestion in that warning: React's "did you mean" is a
mechanical camelCase of whatever you wrote. Do not follow it literally.

The practical consequence is that inline style is for **values that come from
JavaScript at runtime** — a computed position, a drag offset, a colour from
data, a percentage width — and everything else belongs in a stylesheet, a CSS
module, or whatever the project uses.

## The identity question

```jsx
<div style={{margin: 8}} />
```

That object literal is new on every render, so `style` is a "changed" prop
every time. For a host element this costs nothing measurable — React compares
the style object's *contents* and writes only what differs. It matters when the
object is passed to a `memo`-wrapped **component**, where the new identity
defeats the memo. That is a Phase 6 concern; hoisting the object to module
scope is the fix when it arises, not a habit worth adopting everywhere.

## Gotchas

**Symptom:** a width or height from state has no effect.
**Cause:** the value is a string without a unit — `'300'` from an input or a
query parameter. React only adds `px` to numbers.
**Fix:** `Number(value)` or a template literal with the unit.

**Symptom:** a numeric `lineHeight` or `zIndex` behaves oddly after you added
`px` yourself.
**Cause:** those are on React's unitless list; `lineHeight: 1.5` is a ratio,
`lineHeight: '1.5px'` is a length.
**Fix:** pass the bare number for unitless properties.

**Symptom:** a style is applied but the console warns about it.
**Cause:** a hyphenated key. React warns and applies it anyway.
**Fix:** camelCase the key; nothing else changes.

**Symptom:** a camelCase style property is silently ignored.
**Cause:** a typo React has no rule to catch — it only warns for hyphenated
names.
**Fix:** check the property name; TypeScript's `CSSProperties` catches these.

**Symptom:** `:hover` in a style object does nothing.
**Cause:** inline styles cannot express pseudo-classes.
**Fix:** a class and a stylesheet, or a `:hover` rule using a custom property
you set inline.

**Symptom:** a stylesheet rule cannot override an inline style.
**Cause:** inline styles outrank every selector.
**Fix:** move the value to a custom property set inline and consume it in CSS.

## Interview questions

**★ How does React's `style` prop differ from HTML's `style` attribute?**
It takes an object, not a string — passing a string throws. Properties are
camelCased, numeric values get `px` appended for most properties, and `null` or
`undefined` removes a declaration.

**★ Which properties do not get an automatic `px`?**
The ratios, counts and indexes: `lineHeight`, `zIndex`, `opacity`, `flex` and
`flexGrow`, `fontWeight`, `order`, `columnCount`, `gridRow`, `aspectRatio`,
`scale`, `tabSize` and others on React's unitless list. Everything else numeric
gets `px`.

**★ When should you use inline styles?**
For values only known at runtime — a computed position, a drag offset, a colour
from data. Anything static, and anything needing a pseudo-class, a media query
or the cascade, belongs in a stylesheet.

**How do you set a CSS custom property from React?**
Put it in the style object with its literal name: `style={{'--accent': color}}`.
Custom properties are passed through unchanged and do **not** get a `px` suffix.

**Why does `{width: '300'}` do nothing while `{width: 300}` works?**
The automatic unit applies to numbers only. A unitless string reaches CSS as
`width: 300`, which is invalid and dropped — silently.

**Does creating the style object inline hurt performance?**
Not for host elements; React diffs the object's contents. It matters only when
that object is a prop of a memoised component, where the new identity defeats
the comparison.

---

← Prev: [Spreading props](10-spreading-props.md) · Index: [Phase 1](README.md) · Next → [dangerouslySetInnerHTML](12-dangerously-set-inner-html.md)
