---
title: "select, textarea, files and FormData"
sidebar_label: "02 · select, textarea and FormData"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Markup
> and warning strings are printed by
> `sandbox/react-p1/ex12-form-elements.mjs`.

**Three controls do not work the way HTML does, because React made every form
element take a `value`. Once you know that, the whole family is one API — and
the form you can read with no state at all becomes the obvious default.**

## `<select>` takes a `value`

```console
$ node ex12-form-elements.mjs
  --- select ---
  selected on <option>     <select><option value="a">A</option><option value="b">B</option></select>
  value on <select>        <select><option value="a">A</option><option value="b">B</option></select>
  defaultValue on <select> <select><option value="a">A</option><option value="b" selected="">B</option></select>
  multiple + array value   <select multiple=""><option value="a">A</option><option value="b">B</option></select>

  [error] Use the `defaultValue` or `value` props on <select> instead of setting
          `selected` on <option>.
```

`selected` on an `<option>` is **stripped** and warned about. Selection is a
property of the select, not of its options:

```jsx
<select value={country} onChange={e => setCountry(e.target.value)}>
  <option value="">Choose…</option>
  <option value="in">India</option>
  <option value="us">United States</option>
</select>
```

Note the first row of that output: the controlled `value="b"` select rendered
**no `selected` attribute at all**, while `defaultValue="b"` rendered
`selected=""`. React sets the live DOM property for the controlled case rather
than the attribute — the same attribute-versus-property split as
[chunk 01](01-controlled-and-uncontrolled.md). Do not read selection out of the
markup.

**A `multiple` select takes an array**, in both modes:

```jsx
<select multiple value={tags} onChange={e =>
  setTags([...e.target.selectedOptions].map(o => o.value))
}>
```

`e.target.value` on a multiple select gives you only the *first* selection —
`selectedOptions` is the one you want.

An option with no explicit `value` falls back to its text content, which works
until someone translates the label. Always give options a value.

## `<textarea>` takes a `value`, not children

```console
  [error] Use the `defaultValue` or `value` props instead of setting children on
          <textarea>.
  <textarea>children</textarea>  THROWS If you supply `defaultValue` on a
                                 <textarea>, do not pass children.
  <textarea defaultValue>        <textarea>in the prop</textarea>
```

In HTML a textarea's content is its children. In React it is a `value` prop,
like every other field. Passing children warns; passing children *and*
`defaultValue` throws.

The rendered markup still puts the text between the tags — that is how a
textarea's initial value is expressed in HTML — which is worth knowing when you
read a server-rendered page and wonder why the prop moved.

## File inputs

```jsx
function Upload({onFile}) {
  const ref = useRef(null);
  return (
    <>
      <input type="file" ref={ref} accept="image/*" onChange={e => onFile(e.target.files[0])} />
      <button onClick={() => ref.current.value = ''}>Clear</button>
    </>
  );
}
```

Always uncontrolled — the value is set by the file picker and cannot be assigned
from JavaScript. Two practical notes: `e.target.files` is a `FileList`, not an
array (`[...files]` to map over it); and **clearing** a file input means setting
`.value = ''` on the node, because there is no React-side value to reset.

## Reading a whole form without any state

```jsx
function Signup({onSubmit}) {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
    }}>
      <input name="email" type="email" required />
      <input name="password" type="password" required minLength={8} />
      <label><input name="terms" type="checkbox" /> I agree</label>
      <button>Sign up</button>
    </form>
  );
}
```

No state, no `onChange`, no re-render per keystroke. Three things make it work:

- **`name`** is the key in `FormData`. Without it a field is not submitted at
  all — the most common reason a value is mysteriously missing.
- **`e.currentTarget`** is the form. `e.target` is whatever was clicked, which
  may be the button.
- **`e.preventDefault()`** stops the browser navigating.

Two sharp edges of `FormData`:

- An **unchecked checkbox is absent**, not `false`. `Object.fromEntries` gives
  you an object with no `terms` key. Read it as `formData.has('terms')`, or set
  a hidden field.
- **Repeated names collapse** — `fromEntries` keeps the last. Use
  `formData.getAll('tag')` for a multi-value field.

This route also gets the browser's own validation for free: `required`,
`minLength`, `type="email"`, `pattern`. `noValidate` on the form turns it off
when you want to own the messages.

React 19's Actions build directly on this shape — a function that receives
`FormData` — which is why it is worth being fluent in it before Phase 9.

## Reading one field: refs

```jsx
const emailRef = useRef(null);
<input ref={emailRef} defaultValue="" />
// later: emailRef.current.value
```

Fine for one or two fields, or for focus management (`ref.current.focus()`).
Beyond that, `FormData` scales better and needs no refs at all.

## Choosing, again

| Need | Mode |
|---|---|
| Validate or transform as the user types | controlled |
| Disable submit until valid | controlled, or `FormData` re-read on change |
| Two fields that constrain each other | controlled |
| A plain form submitted once | uncontrolled + `FormData` |
| A file input | uncontrolled — no choice |
| Focus, scroll or select-all | a ref, either way |

The default worth having: **start uncontrolled, upgrade the fields that need
it.** Most forms need per-keystroke state for none of their fields, and a
partial upgrade costs nothing.

## Gotchas

**Symptom:** `selected` on an `<option>` is ignored.
**Cause:** React manages selection through the `<select>`.
**Fix:** `value` or `defaultValue` on the `<select>`.

**Symptom:** a `multiple` select only ever reports one value.
**Cause:** `e.target.value` returns the first selection.
**Fix:** `[...e.target.selectedOptions].map(o => o.value)`.

**Symptom:** a `<textarea>` with content between its tags throws.
**Cause:** children plus `defaultValue`.
**Fix:** use the prop only.

**Symptom:** a field is missing from the submitted data.
**Cause:** no `name` attribute — `FormData` is keyed by `name`, not by `id`.
**Fix:** add it.

**Symptom:** an unchecked checkbox comes back as missing rather than `false`.
**Cause:** HTML omits unchecked boxes from form data entirely.
**Fix:** `formData.has('terms')`, or a hidden companion field.

**Symptom:** only the last of several same-named fields survives.
**Cause:** `Object.fromEntries` keeps the last entry for a repeated key.
**Fix:** `formData.getAll(name)`.

**Symptom:** selecting the same file twice fires `onChange` only once.
**Cause:** the input's value did not change, so no event.
**Fix:** clear it — `e.target.value = ''` after handling.

**Symptom:** a translated `<option>` submits the translated label.
**Cause:** no `value`, so the text content is used.
**Fix:** give every option an explicit `value`.

## Interview questions

**★ How is a `<select>` different in React from HTML?**
Selection is set with `value` or `defaultValue` on the `<select>` itself, not
`selected` on an `<option>` — React strips `selected` and warns. A `multiple`
select takes an array, and reading it requires `selectedOptions` rather than
`e.target.value`.

**★ How do you read a form without putting every field in state?**
Give every field a `name`, then on submit build
`Object.fromEntries(new FormData(e.currentTarget))`. No per-keystroke state, no
re-renders, and the browser's own validation applies. Watch two edges: unchecked
checkboxes are absent rather than `false`, and repeated names need `getAll`.

**Why does a `<textarea>` take a `value` prop instead of children?**
So that every form control has the same API. Children warn, and children plus
`defaultValue` throws.

**Why can't a file input be controlled?**
Its value is set by the user's file picker and cannot be assigned from
JavaScript. Read `e.target.files`, and clear it by setting `.value = ''` on the
node.

**When would you reach for a ref instead of state or `FormData`?**
For imperative work the value cannot express — focus, selection, scrolling — or
to read one field in a form that is otherwise uncontrolled.

**Why does the same file selected twice not fire `onChange`?**
The input's value is unchanged, so no event fires. Reset `e.target.value` after
handling a file.

---

← Prev: [Controlled and uncontrolled](01-controlled-and-uncontrolled.md) · Index: [Form elements](README.md) · Next → [Whitespace and text](../14-whitespace-and-text.md)
