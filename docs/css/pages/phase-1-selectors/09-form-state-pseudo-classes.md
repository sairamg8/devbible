---
title: "Form-state pseudo-classes"
sidebar_label: "09 · Form-state pseudo-classes"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**The browser already knows whether a field is valid, required, checked or
empty.** These pseudo-classes read that state directly, which means validation
styling with no JavaScript and no possibility of drift.

## The set

```css
:checked            /* checkbox/radio checked, or option selected      */
:indeterminate      /* a checkbox set to indeterminate from script     */
:required           /* has the required attribute                      */
:optional           /* does not                                        */
:valid   :invalid   /* passes / fails constraint validation, ALWAYS    */
:user-valid :user-invalid  /* …but only after the user has interacted  */
:placeholder-shown  /* empty, and showing its placeholder              */
:default            /* the default submit button, or default-checked   */
:read-only :read-write
:in-range :out-of-range   /* for number/date inputs with min/max       */
:autofill           /* filled by the browser's autofill               */
```

```console
$ node ex09-selector-families.mjs
  :checked                       1  checked            input[]
  :required                      1  required           input[]
  input:not([required])          1  not()              input[]
```

## `:invalid` versus `:user-invalid` — the important one

`:invalid` matches **from page load**. An empty required field is invalid before
the user has done anything, so this paints every required field red on arrival:

```css
/* wrong — the form is red before anyone has typed a character */
input:invalid { border-color: var(--danger); }
```

`:user-invalid` matches only **after the user has interacted** with the field and
left it in an invalid state:

```css
/* right — errors appear when the user has actually got it wrong */
input:user-invalid { border-color: var(--danger); }
input:user-valid   { border-color: var(--success); }
```

This is the pseudo-class that made CSS-only validation styling genuinely usable.
Before it, everyone reimplemented "has this field been touched" in JavaScript.

## The empty-field trick

`:placeholder-shown` is the standard way to ask "is this field empty", because
there is no `:empty` for inputs:

```css
/* a floating label that rises when the field has content */
.field input:not(:placeholder-shown) + label,
.field input:focus + label {
  translate: 0 -1.4em;
  font-size: 0.8em;
}
```

It requires a `placeholder` attribute to exist — often `placeholder=" "` (a
single space) purely to make the selector work.

## Styling by state, without a class

Combined with [`:has()`](./06-has.md), the whole field wrapper can respond:

```css
.field:has(input:user-invalid) {
  --border: var(--danger);
  --label: var(--danger);
}
.field:has(input:user-invalid) .error { display: block; }
.field:has(input:required) label::after { content: " *"; color: var(--danger); }
.field:has(input:disabled) { opacity: 0.6; }
```

Nothing here needs a `.is-invalid` class, and nothing can get out of sync with
the actual validity state.

## Custom checkboxes, the modern way

```css
/* the input stays in the DOM, focusable and announced — just visually replaced */
.check input { appearance: none; margin: 0; inline-size: 1.15em; block-size: 1.15em;
               border: 2px solid currentColor; border-radius: 3px; display: grid;
               place-content: center; }
.check input::before { content: ""; inline-size: 0.65em; block-size: 0.65em;
                       scale: 0; transition: scale 100ms; box-shadow: inset 1em 1em currentColor; }
.check input:checked::before { scale: 1; }
.check input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

The rule that matters: **do not hide the real input and style a sibling `<div>`.**
`appearance: none` on the input itself keeps focus, keyboard interaction and
screen-reader semantics intact for free.

## `:indeterminate` — the third checkbox state

Only settable from script (`el.indeterminate = true`), and it is exactly what a
"select all" checkbox needs when some but not all children are checked:

```css
.select-all:indeterminate { --mark: "–"; }
```

It also applies to radio groups where nothing is selected, and to
`<progress>` with no value.

## Gotchas

**Symptom:** every required field is outlined in red as soon as the page loads.
**Cause:** `:invalid` matches from the start; an empty required field is invalid
immediately.
**Fix:** `:user-invalid`, which waits until the user has interacted.

**Symptom:** `:placeholder-shown` never matches.
**Cause:** the input has no `placeholder` attribute, so it can never be showing
one.
**Fix:** add `placeholder=" "` if the selector is the point and no visible
placeholder is wanted.

**Symptom:** a custom checkbox works with the mouse but not the keyboard, and a
screen reader does not announce it.
**Cause:** the real input was hidden with `display: none` and a `<div>` styled in
its place.
**Fix:** keep the input and use `appearance: none` on it. Hiding a form control
removes it from the tab order and the accessibility tree.

**Symptom:** `:valid` styles apply to fields with no constraints at all.
**Cause:** a field with no `required`, `pattern` or `type` constraint is always
valid — `:valid` matches it.
**Fix:** scope validity styling to fields that actually have constraints, or use
`:user-valid`.

## Interview questions

**★ What is the difference between `:invalid` and `:user-invalid`?**
`:invalid` matches whenever the value fails constraint validation, including on
page load — so an empty required field is invalid before the user has typed
anything, and styling it turns the whole form red on arrival. `:user-invalid`
matches only after the user has interacted with the field, which is the behaviour
people used to implement in JavaScript with a "touched" flag.

**★ How do you build a custom-styled checkbox without breaking accessibility?**
Keep the real `<input type="checkbox">` in the DOM and apply `appearance: none`
to it, then style the input itself and its `::before`. Hiding the input and
styling a sibling element removes it from the tab order and the accessibility
tree. Focus styling goes on `input:focus-visible`.

**How do you detect an empty input in CSS?**
`:placeholder-shown` — it matches when the field is empty and displaying its
placeholder. It requires a `placeholder` attribute to exist, so
`placeholder=" "` is common when no visible placeholder is wanted.

**What is `:indeterminate` for?**
A checkbox whose state is neither checked nor unchecked, set from script — the
classic "select all" control when only some children are selected. It also
matches radio groups with no selection and `<progress>` with no value.

**How would you show a required-field asterisk without adding a class?**
`.field:has(input:required) label::after { content: " *" }`. The state comes from
the `required` attribute, so the marker cannot drift from the actual
requirement.

---

← [08 · State pseudo-classes](./08-state-pseudo-classes.md) · Next: [10 · Pseudo-elements](./10-pseudo-elements.md) →
