---
title: "Controlled and uncontrolled"
sidebar_label: "01 · Controlled and uncontrolled"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Markup,
> event ordering and every warning string are printed by
> `sandbox/react-p1/ex12-form-elements.mjs`.

**Who owns the value — React or the DOM — is the only question. Answer it once
per field and keep the answer for the field's lifetime.**

## The two modes

```jsx
<input value={text} onChange={e => setText(e.target.value)} />   // controlled
<input defaultValue="initial" />                                  // uncontrolled
```

**Controlled**: React state is the value. The DOM is told what to display on
every render. You can transform, validate or reject a keystroke.

**Uncontrolled**: the DOM owns the value. React sets the initial one and then
stops caring. You read it with a ref or from the form on submit.

`defaultValue` and `defaultChecked` exist because `value` and `checked` are
claimed by the controlled mode. They are *initial* values — changing them later
does nothing at all, which is a surprise the first time.

## `value` without `onChange`

```console
$ node ex12-form-elements.mjs
  --- value, defaultValue and the warnings ---
  value, no onChange     <input value="fixed">
  value + readOnly       <input readonly="" value="fixed">
  value + onChange       <input value="fixed">
  defaultValue           <input value="initial">
  value={null}           <input>
  checked, no onChange   <input type="checkbox" checked="">
  defaultChecked         <input type="checkbox" checked="">
```

```console
  [error] You provided a `value` prop to a form field without an `onChange`
          handler. This will render a read-only field. If the field should be
          mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`.
  [error] `value` prop on `input` should not be null. Consider using an empty
          string to clear the component or `undefined` for uncontrolled components.
  [error] You provided a `checked` prop to a form field without an `onChange`
          handler. …
```

The message lists the three fixes and expects you to pick one. Note that
**`value` + `readOnly` does not warn** — that is the correct spelling of
"display a value the user cannot change", and it is not the same as a disabled
field, which is also excluded from form submission.

`value={null}` is the one to watch. `null` is not "no value" here: React reads
it as controlled-with-nothing and warns. `''` clears a field; `undefined` makes
it uncontrolled.

## The markup never shows the real value

```console
  --- which DOM value the markup does NOT show ---
  defaultValue then typing  <input value="initial">
    markup after typing:    <input value="initial">
    el.value after typing:  "typed by the user"
    el.getAttribute(value): "initial"
```

The **attribute** holds the initial value; the **property** holds the live one.
They diverge the moment the user types and never re-converge. That is HTML's
behaviour, not React's, and it explains two things people trip over:

- `input.getAttribute('value')` gives the wrong answer — read `input.value`
- a snapshot of the markup cannot show what the user typed, so a test that
  simulates typing must assert on `element.value`

## `onChange` is the DOM's `input` event

React's `onChange` does not behave like the DOM's `change` event, which fires on
blur. It fires on every keystroke. The script dispatches real events at a real
input and records which handlers ran, in order:

```console
  --- which events fire, and how often ---
  handlers fired: ["onKeyDown","onInput:input","onChange:change:a",
                   "onKeyDown","onInput:input","onChange:change:ab"]
  final value:    "ab"
```

Two keystrokes, two `onChange` calls — each immediately after `onInput`, each
carrying the full value so far. The native `change` event dispatched afterwards
fired **nothing**: React had already delivered that update.

Three consequences:

- `onChange` and `onInput` are effectively the same event in React. Use
  `onChange`; it is the one everything else assumes.
- There is no built-in "the user has finished" event. Use `onBlur`, or debounce
  the handler, or both.
- `e.target.value` is the value *after* the keystroke. That is what makes a
  controlled input possible at all.

## What to store in state

```jsx
const [text, setText] = useState('');   // '' — never undefined, never null

<input value={text} onChange={e => setText(e.target.value)} />
```

Two rules remove most controlled-input bugs before they exist.

**1. Initialise to the empty value of the right type** — `''` for text, `false`
for a checkbox, `[]` for a multi-select. Never `undefined` or `null`, both of
which start the field uncontrolled.

**2. Store the string the input gave you.** Convert at the edges — on submit,
or as a derived value — not on the way into state:

```jsx
// ✗ the user cannot type "1." or "1.0" or "-"
<input value={n} onChange={e => setN(Number(e.target.value))} />

// ✓ keep the text, derive the number
<input value={text} onChange={e => setText(e.target.value)} />
const n = Number(text);
```

Coercing on input destroys the intermediate states a person must pass through
while typing. The same applies to trimming, upper-casing and formatting: do it
on blur or on submit, not per keystroke, or the caret jumps.

For a checkbox, read `.checked`, not `.value`:

```jsx
<input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} />
```

## The uncontrolled → controlled warning

```console
  [error] A component is changing an uncontrolled input to be controlled. This is
          likely caused by the value changing from undefined to a defined value,
          which should not happen. Decide between using a controlled or
          uncontrolled input element for the lifetime of the component. …
  [error] A component is changing a controlled input to be uncontrolled. …
```

Both directions warn. The cause is almost always data arriving late:

```jsx
// ✗ user is undefined on the first render
<input value={user?.name} onChange={…} />

// ✓ never undefined
<input value={user?.name ?? ''} onChange={…} />

// ✓ often better — do not render the form until the data is there
{user ? <Form user={user} /> : <Spinner />}
```

The third form is usually the right one. It also gives the form a fresh mount
when the record changes, instead of showing one user's data in a field bound to
another's — the same argument as `key` in
[Lists and keys](../07-lists-and-keys.md).

## Files are always uncontrolled

`<input type="file" />` cannot be controlled: its value is set by the user's
file picker and cannot be assigned from JavaScript, for obvious security
reasons. Read it with a ref, or from `FormData` — see
[the next chunk](02-select-textarea-and-formdata.md).

## Gotchas

**Symptom:** "You provided a `value` prop to a form field without an `onChange`
handler."
**Cause:** a controlled input with no way to update the state behind it.
**Fix:** add `onChange`; or `readOnly` if it is display-only; or switch to
`defaultValue`.

**Symptom:** "A component is changing an uncontrolled input to be controlled."
**Cause:** `value` was `undefined` on the first render and defined later —
usually a fetch resolving.
**Fix:** `value={x ?? ''}`, or do not render the form until the data exists.

**Symptom:** typing in a controlled input does nothing.
**Cause:** `onChange` does not write back to the state that feeds `value`.
**Fix:** trace the round trip — state → `value` → `onChange` → state. One
missing link freezes the field.

**Symptom:** the user cannot type a decimal point, a leading zero or a minus
sign.
**Cause:** the value is coerced with `Number()` on the way into state.
**Fix:** store the string; derive the number where it is used.

**Symptom:** the caret jumps to the end while typing in the middle of a field.
**Cause:** the value is being reformatted on every keystroke, so React replaces
the whole value.
**Fix:** format on blur, or manage the selection deliberately.

**Symptom:** a checkbox will not tick.
**Cause:** `checked` without `onChange`, or reading `e.target.value` instead of
`e.target.checked`.
**Fix:** `checked={on}` with `onChange={e => setOn(e.target.checked)}`.

**Symptom:** a test that simulates typing asserts on stale markup.
**Cause:** the `value` attribute stays at the initial value; only the property
changes.
**Fix:** assert on `element.value`.

## Interview questions

**★ What is the difference between a controlled and an uncontrolled component?**
Controlled means React state holds the value and the DOM displays it — `value`
plus `onChange`. Uncontrolled means the DOM holds it and React only supplies the
initial value through `defaultValue`. File inputs are always uncontrolled;
everything else is a choice you make per field and keep.

**★ Why does React's `onChange` fire on every keystroke?**
Because React binds it to the DOM's `input` event, not the DOM's `change` event.
Measured: two keystrokes produced two `onChange` calls, each carrying the value
so far, and a native `change` event dispatched afterwards fired nothing.

**★ What causes "A component is changing an uncontrolled input to be
controlled"?**
`value` was `undefined` on the first render and defined afterwards — typically
data arriving from a fetch. Fix with `value={x ?? ''}`, or by not rendering the
form until the data is present.

**Why is `value={null}` wrong?**
React treats `null` as a controlled value of nothing and warns. Use `''` to
clear a field and `undefined` to make it uncontrolled.

**Why should you store the raw string rather than a parsed number?**
Because coercing on input destroys the intermediate states a person must type
through — a trailing decimal point, a lone minus sign, a leading zero. Parse
where the value is consumed.

**When is a controlled input the wrong choice?**
When nothing needs the value until submit. A controlled field re-renders on
every keystroke and adds state you then have to keep in sync; an uncontrolled
form read through `FormData` has neither cost.

---

Index: [Form elements](README.md) · Next → [select, textarea, files and FormData](02-select-textarea-and-formdata.md)
