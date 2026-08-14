---
title: "Every input type, and the one you cannot control"
sidebar_label: "02 · Every input type"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<input>`](https://react.dev/reference/react-dom/components/input),
> [`<select>`](https://react.dev/reference/react-dom/components/select) and
> [`<textarea>`](https://react.dev/reference/react-dom/components/textarea)
> (each page's differences-from-HTML notes and full Caveats lists), and MDN
> [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file)
> for the value restriction.
> No sandbox script backs this page; claims are cited, not measured.

**Three of React's form elements differ from HTML in ways that have nothing to do with
React's own model, and one input type cannot be controlled at all — for a browser security
reason, not a React limitation.**

## `<textarea>` — no children

> Passing children like `<textarea>something</textarea>` is **not allowed.** Use
> `defaultValue` for initial content.

```jsx
// ❌ Not supported
<textarea>Some initial content</textarea>

// ✅ Use defaultValue instead
<textarea defaultValue="Some initial content" />
```

The rest of the contract is identical to `<input>`:

> - If a text area receives a string `value` prop, it will be treated as controlled.
> - A text area **can't be both** controlled and uncontrolled at the same time.
> - A text area **cannot switch** between being controlled or uncontrolled over its
>   lifetime.
> - Every controlled text area needs an `onChange` event handler that **synchronously
>   updates** its backing value.

The reason for the change is consistency: making content a prop rather than children means
`value`/`defaultValue` work the same way on every form element. It costs one surprise when
copying HTML, and it is the only surprise.

## `<select>` — the value lives on the select

> **Unlike in HTML, passing a `selected` attribute to `<option>` is not supported.**
> Instead, use `<select defaultValue>` for uncontrolled select boxes and `<select value>`
> for controlled select boxes.

```jsx
// ❌ HTML approach (doesn't work in React)
<select>
  <option selected>Apple</option>
</select>

// ✅ React uncontrolled
<select defaultValue="apple">
  <option value="apple">Apple</option>
</select>

// ✅ React controlled
<select value={selectedFruit} onChange={…}>
  <option value="apple">Apple</option>
</select>
```

This is the same idea as `<textarea>`: **the selection is state, and state belongs to one
place.** Spreading `selected` across options would mean the truth lived in N children
rather than in the parent, which is precisely the shape React exists to avoid.

**Multiple selects take an array:**

```jsx
<select multiple={true} defaultValue={['orange', 'banana']}>
  <option value="apple">Apple</option>
  <option value="banana">Banana</option>
  <option value="orange">Orange</option>
</select>
```

Worth pairing with a warning the caveats imply: a controlled `multiple` select needs an
`onChange` that produces a **new array**, and reading it means walking
`e.target.selectedOptions`. It is one of the few places where the controlled version is
meaningfully more work than the uncontrolled one — `FormData.getAll(name)` returns the
selected values directly ([topic 05](../05-uncontrolled-and-formdata.md)).

The caveats otherwise repeat exactly: treated as controlled once it receives `value`,
cannot be both, cannot switch, and every controlled select needs a synchronous `onChange`.

## Radio groups

Radios are the case where the mental model has to shift, because **the group is the value,
not the input.** Each radio in a group shares a `name`; what you control is which one is
`checked`:

```jsx
{options.map((opt) => (
  <label key={opt.value}>
    <input
      type="radio"
      name="plan"                       // the group
      value={opt.value}                 // this option's submitted value
      checked={plan === opt.value}      // derived — one state for the whole group
      onChange={(e) => setPlan(e.target.value)}
    />
    {opt.label}
  </label>
))}
```

Two things this makes explicit:

- **`checked` is derived, not stored per radio.** One piece of state holds the selection;
  each radio computes its own `checked` from it. Storing a boolean per option is the
  classic wrong shape — it permits two selected at once, which the UI then has to prevent.
- **`value` still matters on a radio**, unlike a checkbox, because it is what identifies
  the option and what gets submitted. So a radio uses *both* `value` and `checked`, which
  is why the checkbox rule ("`checked`, not `value`") reads as contradictory until you see
  the two side by side.

The shared `name` is not optional — it is what makes the browser treat them as one group
for keyboard navigation and for submission, and it is the key `FormData` reads.

## 🔴 File inputs are always uncontrolled

Not a React decision. From MDN:

> **You cannot set the value of a file picker from a script.** Attempting to do so has no
> effect:
>
> ```javascript
> const input = document.querySelector("input[type=file]");
> input.value = "foo"; // This has no effect
> ```

> The value is **always the file's name prefixed with `C:\fakepath\`**, which isn't the
> real path of the file. This is **to prevent malicious software from guessing the user's
> file structure.**

That settles it mechanically. Controlled means *React forces the element to the value you
supplied* ([chunk 01](01-the-controlled-contract.md)) — and for a file input the browser
refuses to be forced. A page that could set a file input's value could silently attach any
file it could name from the user's disk, so the restriction is a security boundary, not an
oversight.

**What you do instead** — read the files rather than the value:

> The selected files are returned by the element's `HTMLInputElement.files` property, which
> is a `FileList` object containing a list of `File` objects.

Each `File` carries `name`, `lastModified`, `size` and `type` — enough for a preview list,
a size check or a type filter without touching `value` at all.

```jsx
<input
  type="file"
  multiple
  onChange={(e) => setSelected(Array.from(e.target.files))}
/>
```

Note the shape: you keep state **describing** the selection for your own UI, while the
input itself stays uncontrolled. That is not a compromise — it is the only available model.

**Clearing one** is the practical consequence people hit. Since you cannot assign a value,
the options are: set it to the empty string (`input.value = ''`, the one assignment the
spec permits), or remount the input with a changed `key`
([Phase 3 · 07](../../phase-3-state/07-resetting-state-with-key.md)) — which is the more
React-idiomatic route and needs no ref at all.

Note also that a file input carries data `FormData` handles natively, which is one of the
strongest arguments for the uncontrolled/Actions approach for any form that uploads
([topic 02](../02-actions.md)).

## The summary table

| Element | Controlled with | Uncontrolled with | Differs from HTML |
|---|---|---|---|
| `<input type="text">` etc. | `value` | `defaultValue` | — |
| `<input type="checkbox">` | `checked` | `defaultChecked` | — |
| `<input type="radio">` | `checked` (+ `value`, + shared `name`) | `defaultChecked` | — |
| `<textarea>` | `value` | `defaultValue` | **No children** |
| `<select>` | `value` on the select | `defaultValue` on the select | **No `selected` on `<option>`** |
| `<select multiple>` | `value` as an **array** | `defaultValue` as an array | Same |
| `<input type="file">` | 🔴 **impossible** | Always | Browser security restriction |

## Gotchas

**Symptom:** `<textarea>initial</textarea>` renders nothing or errors.
**Cause:** React does not accept children on a textarea.
**Fix:** `defaultValue`, or `value` with an `onChange`.

**Symptom:** `<option selected>` has no effect.
**Cause:** not supported — the selection lives on the `<select>`.
**Fix:** `defaultValue` or `value` on the select.

**Symptom:** a `multiple` select only ever holds one value.
**Cause:** `value` was given a string rather than an array.
**Fix:** an array, and read `e.target.selectedOptions` in the handler — or use
`FormData.getAll`.

**Symptom:** two radios in a group can be selected at once.
**Cause:** a boolean stored per option instead of one value for the group.
**Fix:** one state value; derive each `checked` from it. And give them a shared `name`.

**Symptom:** setting a file input's value has no effect.
**Cause:** the browser forbids it — the value is a fake path, and assignment is ignored,
to stop pages guessing the user's file structure.
**Fix:** read `e.target.files`; keep your own state describing the selection.

**Symptom:** a file input cannot be cleared after a failed upload.
**Cause:** no assignment is possible except the empty string.
**Fix:** `input.value = ''`, or remount the input with a changed `key`.

**Symptom:** a "controlled" file input warns or behaves oddly.
**Cause:** it cannot be controlled at all.
**Fix:** stop passing `value`; it is always uncontrolled.

## Interview questions

**★ How does React's `<select>` differ from HTML, and why?**
`selected` on an `<option>` is not supported; the selection lives on the `<select>` as
`value` or `defaultValue`. The reason is that the selection is state, and state belongs in
one place — spreading `selected` across N options would put the truth in the children
rather than the parent. A `multiple` select takes an array for both props.

**★ And `<textarea>`?**
It does not accept children, so `<textarea>initial</textarea>` is not allowed; initial
content goes in `defaultValue`. Everything else matches `<input>`: controlled once it gets
a string `value`, never both, never switching, and a synchronous `onChange` required.

**★ How do you control a radio group?**
With one piece of state for the whole group, from which each radio derives its own
`checked`, plus a shared `name`. A radio uses both `value` and `checked` — unlike a
checkbox, where `value` is not the control — because `value` identifies the option and is
what gets submitted. Storing a boolean per option is the wrong shape: it allows two
selected at once.

**★ Why can't a file input be controlled?**
Because the browser will not allow its value to be set from script — assignment simply has
no effect, and the value it exposes is a fake path, both to prevent pages guessing the
user's file structure. Controlled means React forces the element to your value, and a file
input refuses to be forced. It is a security boundary, not a React limitation.

**So how do you work with a file input?**
Read `e.target.files`, a `FileList` of `File` objects carrying `name`, `size`, `type` and
`lastModified` — enough for previews and validation without touching `value`. Keep state
describing the selection for your own UI while the input itself stays uncontrolled. To
clear it, assign the empty string or remount it with a changed `key`.

**Which elements can switch between controlled and uncontrolled?**
None. Every one of these pages says the same thing: it cannot be both at once and cannot
switch over its lifetime. In practice that rule is broken by a `value` of `undefined` on the
first render, so defaulting to `''` — or `false` for a checkbox — is what keeps it.

---

← Prev: [The controlled contract](01-the-controlled-contract.md) ·
Index: [Controlled inputs](README.md) ·
Next → [Actions](../02-actions.md)
