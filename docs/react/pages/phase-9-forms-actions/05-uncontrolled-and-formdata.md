---
title: "Uncontrolled forms and FormData"
sidebar_label: "05 · Uncontrolled forms and FormData"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — MDN
> [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and
> [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file),
> and react.dev [`<form>`](https://react.dev/reference/react-dom/components/form) and
> [`<input>`](https://react.dev/reference/react-dom/components/input).
> Where a recommendation is engineering judgement rather than documented, it says so.
> No sandbox script backs this page; claims are cited, not measured.

**The React habit is a `useState` per field. The platform has read the whole form in one
call since long before React existed, and Actions are built directly on top of it — so for
a form whose values are only needed at submit, the state was never necessary.**

## `name` is the contract

`FormData` is keyed by each control's **`name`** attribute — not its `id`, not its React
prop, not its variable. That one fact reorganises how a form is written:

```jsx
<form action={save}>
  <input name="email" type="email" />
  <textarea name="bio" />
  <select name="plan">…</select>
  <input name="avatar" type="file" />
  <button>Save</button>
</form>
```

```js
async function save(formData) {
  formData.get('email');        // the value
  formData.get('avatar');       // a File object
}
```

**No `useState`, no `onChange`, no refs, and no re-render per keystroke.** The component
renders once and the values are read at the only moment they were needed.

`id` still matters — for `<label htmlFor>` and `aria-describedby`
([topic 12](12-accessible-forms.md)) — so most fields carry both, doing different jobs. A
field missing `name` renders and behaves perfectly and simply never appears in the
submission, which is a quiet failure worth knowing by sight.

## Reading it

| Call | Returns |
|---|---|
| `formData.get(name)` | The **first** value for that name, or `null` |
| `formData.getAll(name)` | **All** values — checkbox groups, `<select multiple>` |
| `formData.has(name)` | Whether the key exists |
| `formData.entries()` / iteration | Every pair, in document order |
| `Object.fromEntries(formData)` | A plain object — **only safe when no name repeats** |

`Object.fromEntries` is the convenient one and the one that silently loses data: repeated
names collapse to the last value, so a checkbox group of five becomes one. Use it for flat
forms and `getAll` where multiplicity is real.

**Values are strings** (or `File` objects). A number input yields `"42"`, an unchecked
checkbox is **absent entirely** rather than `false`, and a date is a string. Any coercion —
and the "absent means false" rule for checkboxes — is yours to write, on the server as well
as the client.

## The three things it does that state cannot

**1. File inputs work with no special handling.** They cannot be controlled at all
([topic 01 · 02](01-controlled-inputs/02-every-input-type.md)) because the browser refuses
to let a script set their value. `FormData` picks them up as `File` objects regardless.
For any form that uploads, this alone settles the design.

**2. It survives before hydration.** A form with `name` attributes is a working form the
moment the HTML arrives; a controlled form is inert until JavaScript loads and the
listeners attach. That is the substrate progressive enhancement is built on
([topic 11](11-progressive-enhancement.md)).

**3. Adding a field costs one line.** No state, no handler, no reset logic — just the
input. In a form with thirty fields, that is the difference between a component you can
read and one you cannot.

## The cost model

⚠️ **Judgement, though it follows directly from how controlled inputs work.**

A controlled input re-renders its owning component on **every keystroke**
([topic 01 · 01](01-controlled-inputs/01-the-controlled-contract.md)). If the state lives
at the form level, every keystroke in any field re-renders every field. Uncontrolled fields
re-render **zero** times while typing, because nothing in React changed.

The usual counter is memoization or splitting state down to each field — both of which are
real work to keep correct
([Phase 6 · 13](../phase-6-performance/13-moving-state-down.md)). Not needing the state at
all is simpler than optimising it.

## When to control anyway

Uncontrolled is not a blanket answer. Control a field when its value is needed **during**
typing rather than at submit:

| Need | Model |
|---|---|
| A live preview, character count or filter as they type | **Controlled** |
| Enable a button, or reveal a field, based on this value | **Controlled** |
| Format or constrain as they type — a phone mask, uppercase | **Controlled** |
| Set the value from elsewhere — "use my saved address" | **Controlled** |
| Everything else | **Uncontrolled** |

**Mixing is fine and normal**, with one caveat from [topic 02](02-actions.md): React resets
only the *uncontrolled* fields after a successful action, so a mixed form half-resets
unless you clear the controlled state yourself.

## Reading it without submitting

Occasionally you want the whole form outside a submission — a draft save, a live summary.
`new FormData(formElement)` works on any form element:

```jsx
const formRef = useRef(null);
// …
const data = new FormData(formRef.current);
```

⚠️ **Judgement:** this reads the DOM, so it belongs in an event handler or an effect, never
during render
([Phase 7 · 04 · 04](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/04-refs-and-the-dom-in-render.md)).
If you find yourself doing it on every change, that is the signal the field genuinely wanted
to be controlled.

## Gotchas

**Symptom:** `formData.get('x')` returns `null` for a field that is clearly on screen.
**Cause:** the control has no `name`, or has only an `id`.
**Fix:** add `name`. Rendering correctly is not evidence it will submit.

**Symptom:** a checkbox group only ever yields one value.
**Cause:** `Object.fromEntries` collapses repeated names to the last one.
**Fix:** `getAll(name)` for anything that can repeat.

**Symptom:** an unchecked checkbox arrives as `undefined` rather than `false`.
**Cause:** unchecked checkboxes are omitted from `FormData` entirely.
**Fix:** treat absence as false explicitly, on the server too.

**Symptom:** a number arrives as a string and comparisons behave oddly.
**Cause:** every `FormData` value is a string or a `File`.
**Fix:** coerce deliberately, and validate after coercing.

**Symptom:** a disabled field disappears from the submission.
**Cause:** disabled controls are not submitted — standard form behaviour.
**Fix:** use `readOnly` if the value must still be sent, or send it another way.

**Symptom:** a mixed form only half-resets after a successful action.
**Cause:** React resets uncontrolled fields only.
**Fix:** clear the controlled state yourself, or make the form consistently one model.

**Symptom:** reading `new FormData(ref.current)` during render gives stale or wrong values.
**Cause:** that is a DOM read in render.
**Fix:** move it into a handler or an effect — or control the field.

## Interview questions

**★ What is the contract between a form and `FormData`?**
The `name` attribute. `FormData` is keyed by `name` — not `id`, not the React prop — so a
field without one renders and behaves perfectly and simply never appears in the submission.
`id` is still needed for label association and `aria-describedby`, so most fields carry
both, doing different jobs.

**★ Why is uncontrolled often the better default for forms?**
Because the values are usually only needed at submit, and `FormData` reads them all in one
call — no state, no handlers, no re-render per keystroke, and adding a field costs one
line. It also handles file inputs, which cannot be controlled at all, and it works before
hydration, which is what progressive enhancement is built on. Controlled forms re-render on
every keystroke and then need memoization or state-splitting to stay fast; not needing the
state is simpler than optimising it.

**★ When should a field be controlled?**
When the value is needed *during* typing rather than at submit — a live preview or
character count, enabling another control, formatting as they type, or setting the value
from elsewhere. Otherwise uncontrolled. Mixing is normal, with the caveat that React resets
only uncontrolled fields after a successful action, so a mixed form half-resets.

**★ What are the traps in reading `FormData`?**
`Object.fromEntries` collapses repeated names to the last value, so checkbox groups and
`multiple` selects need `getAll`. Every value is a string or a `File`, so numbers and dates
need coercion. Unchecked checkboxes are absent entirely rather than false. And disabled
controls are not submitted at all.

**How would you read a form's values without submitting it?**
`new FormData(formElement)` via a ref — but in an event handler or an effect, never during
render, since it reads the DOM. And if you need it on every change, that is the signal the
field wanted to be controlled in the first place.

---

← Prev: [Validation](04-validation.md) ·
Index: [Phase 9](README.md) ·
Next → [`useFormStatus`](06-useformstatus.md)
