---
title: "01 · FormData and reading a form"
sidebar_label: "01 · FormData and reading a form"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [`FormData()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData), [`FormData.getAll()`](https://developer.mozilla.org/en-US/docs/Web/API/FormData/getAll), [`HTMLFormElement.elements`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements), [`RadioNodeList`](https://developer.mozilla.org/en-US/docs/Web/API/RadioNodeList), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [Using FormData objects](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects). Documentation-validated; **no timings**.

```js
const data = new FormData(form);
```

That constructor walks the form and collects its **successful controls** — the same set the
browser would have submitted itself. Which makes the first question the important one:

## What actually ends up in a `FormData`

**In:**

- Every control with a **`name`** attribute that is not disabled.
- `readonly` fields — read-only is a UI restriction, not a submission one.
- Checkboxes and radios **only when checked**.
- Files from `<input type="file">`, as `File` objects.

**Out:**

- 🔴 **Anything without a `name`.** An `id` is not a `name`. This is the single most common
  "my field vanished" bug, and it is silent — no error, the key simply is not there.
- **Disabled controls**, including everything inside a disabled `<fieldset>`.
- **Unchecked checkboxes.** The key is absent entirely, not `false`.
- **Submit buttons**, unless you say which one — see below.

```js
form.elements.agree.checked;              // the boolean you actually wanted
new FormData(form).has('agree');          // false when unchecked — no key at all
```

⚠️ A checkbox with no `value` attribute submits the string **`"on"`** when checked. If you want
something meaningful in the payload, give it `value="…"`; if you want a boolean, read `.checked`
rather than the `FormData`.

### The submitter

Buttons are not included by default, because a form can have several and only the one that was
pressed is meaningful. Pass it:

```js
form.addEventListener('submit', (e) => {
  const data = new FormData(form, e.submitter);   // includes the pressed button's name/value
});
```

That is how a single form does *"Save"* and *"Save and publish"* with one handler —
`<button name="intent" value="publish">` — and it is the pattern to reach for before adding a
hidden input that some other code has to remember to update.

## `Object.fromEntries` loses data — know exactly when

The one-liner everyone reaches for:

```js
const data = Object.fromEntries(new FormData(form));
```

`FormData` is a **multimap**: one key may hold many values. `Object.fromEntries` builds a plain
object, so **only the last value for a repeated key survives**.

That is fine for a form of distinct text inputs, and wrong for these three:

- a checkbox **group** sharing one name
- `<select multiple>`
- a `<input type="file" multiple>`

```js
const data = Object.fromEntries(fd);
data.tags;            // ⚠️ only the last checked tag

fd.getAll('tags');    // ✅ ['a', 'b', 'c'] — every value
```

🔴 **The rule: `fromEntries` for scalar fields, `getAll` for anything repeatable.** The honest
version of the one-liner declares which fields are plural:

```js
const fd = new FormData(form);
const data = { ...Object.fromEntries(fd), tags: fd.getAll('tags') };
```

The rest of the API is what you would expect — `get`, `getAll`, `has`, `set`, `append`, `delete`,
and it is iterable, so `for (const [k, v] of fd)` works. **`set` replaces every value for a key;
`append` adds another** — the same distinction as `URLSearchParams`.

## `form.elements` — the other way in

`FormData` gives you a snapshot of values. `form.elements` gives you the **controls themselves**,
which is what you need for anything beyond reading:

```js
form.elements.email;              // the <input>, by its name
form.elements.email.value;
form.elements.colour.value;       // a RadioNodeList — .value is the checked radio's value
form.elements.length;             // control count
```

Named access works by `name` **or `id`**, which is a small trap: a control with only an `id`
appears in `form.elements` and does **not** appear in `FormData`. That asymmetry is exactly how a
field can look present in the console and be missing from the request.

A radio group comes back as a `RadioNodeList`, whose `value` is the checked radio's value — a
genuinely useful shortcut over filtering by `:checked`.

## Sending it

**As `multipart/form-data`** — pass the object straight through:

```js
await fetch('/api/profile', { method: 'POST', body: fd });
```

🔴 **Do not set `Content-Type` yourself.** MDN is explicit about this: the browser generates the
header *including the multipart boundary*, and hand-setting `Content-Type: multipart/form-data`
omits the boundary, so the server cannot parse the body. It is a one-line "helpful" addition that
produces a completely opaque failure.

**As `application/x-www-form-urlencoded`:**

```js
await fetch(url, {
  method: 'POST',
  body: new URLSearchParams(fd),      // works only if there are no File entries
});
```

**As JSON** — build the object with `fromEntries` + `getAll` as above, then `JSON.stringify`. Note
that everything from a form is a **string**: `'0'`, `'false'` and `''` are all truthy-or-not in
ways that surprise, and numbers need converting explicitly (`input.valueAsNumber` for
`type="number"`, `valueAsDate` for dates).

## Gotchas

**Symptom:** A field is missing from the submitted data
**Cause:** It has an `id` but no `name`. Only named controls are successful.
**Fix:** Add `name`. Note it still appears in `form.elements`, which is why it looks fine in the console.

**Symptom:** An unchecked checkbox came through as missing rather than `false`
**Cause:** Unchecked boxes are not submitted at all.
**Fix:** Read `.checked` from `form.elements`, or add a hidden input with the false value before it.

**Symptom:** A checked checkbox submitted `"on"`
**Cause:** No `value` attribute, so the default is used.
**Fix:** Give it a `value`, or read `.checked` instead.

**Symptom:** Only the last checkbox of a group made it into the object
**Cause:** `Object.fromEntries` collapses repeated keys; `FormData` is a multimap.
**Fix:** `fd.getAll('name')` for every repeatable field.

**Symptom:** A `<select multiple>` submitted one value
**Cause:** Same collapse.
**Fix:** `getAll`.

**Symptom:** Fields inside a disabled `<fieldset>` disappeared
**Cause:** Disabling a fieldset disables every control in it, and disabled controls are not successful.
**Fix:** Use `readonly` if you meant "not editable but still submitted".

**Symptom:** The server sees an empty or unparseable body for a `FormData` POST
**Cause:** `Content-Type` was set by hand, so the multipart boundary is missing.
**Fix:** Omit the header entirely and let the browser generate it.

**Symptom:** Which button was pressed is not in the payload
**Cause:** Submit buttons are excluded unless the submitter is passed.
**Fix:** `new FormData(form, e.submitter)`.

**Symptom:** A numeric comparison against a form value behaves oddly
**Cause:** Every form value is a string.
**Fix:** `input.valueAsNumber`, or convert explicitly — and remember `''` and `'0'` are different kinds of falsy.

## Interview questions

**★ How do you read an entire form in one line, and what does that line get wrong?**
`Object.fromEntries(new FormData(form))`. It is correct for scalar fields and **loses data for
repeated keys** — checkbox groups, `<select multiple>`, multi-file inputs — because `FormData` is
a multimap and a plain object is not. Use `getAll` for those.

**★ Which controls end up in a `FormData`?**
Successful controls: named, not disabled, and — for checkboxes and radios — checked. `readonly`
fields are included; fields with only an `id` are not; unchecked boxes contribute no key at all.

**★ Why is an unchecked checkbox missing rather than `false`?**
Because HTML form submission has no concept of "false" — an unsuccessful control simply is not
submitted. Read `.checked` if you need the boolean, or pair it with a hidden input.

**★ You POST a `FormData` and the server sees nothing. What did you do?**
Set `Content-Type: multipart/form-data` by hand. The browser must generate that header because it
carries the multipart boundary; supplying it without the boundary makes the body unparseable.

**★ How do you tell which of two submit buttons was pressed?**
`new FormData(form, e.submitter)` includes the pressed button's `name`/`value` — so
`<button name="intent" value="publish">` works with a single handler.

**`form.elements` versus `FormData` — when do you need each?**
`FormData` for values to send; `form.elements` for the control objects — `.checked`,
`.valueAsNumber`, focusing a field, or a `RadioNodeList`'s `.value`. Named access on
`form.elements` also matches `id`, which `FormData` does not.

**How do you send a form as JSON?**
Build the object yourself: `fromEntries` for scalars, `getAll` for plurals, explicit conversion
for numbers and dates — then `JSON.stringify`. Everything out of a form is a string.

---

[Topic index](./README.md) · Next → [02 · Constraint validation](./02-constraint-validation.md)
