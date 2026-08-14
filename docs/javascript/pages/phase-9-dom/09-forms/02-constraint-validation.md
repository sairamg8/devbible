---
title: "02 · Constraint validation"
sidebar_label: "02 · Constraint validation"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation), [`ValidityState`](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState), [`HTMLInputElement.checkValidity()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/checkValidity), [`HTMLInputElement.reportValidity()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/reportValidity), [`HTMLInputElement.setCustomValidity()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setCustomValidity), [`:user-invalid`](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid). Documentation-validated; **no timings**.

The constraints live in **HTML**, and JavaScript only reads and reports them:

```html
<input name="email" type="email" required maxlength="120">
<input name="qty" type="number" min="1" max="99" step="1" required>
<input name="code" pattern="[A-Z]{3}-\d{4}" required>
```

`required`, `type`, `pattern`, `min`/`max`, `step`, `minlength`/`maxlength` are the whole
vocabulary. Everything below is how JavaScript interacts with them.

## `checkValidity` versus `reportValidity`

Both return the same boolean. They differ in what the **user** sees:

| Method | Returns | Shows the browser's error bubble? | Fires `invalid`? |
|---|---|---|---|
| `checkValidity()` | boolean | **no** | yes |
| `reportValidity()` | boolean | **yes**, and focuses the first invalid control | yes |

```js
if (!form.reportValidity()) return;      // user sees why, focus lands on the problem
```

Both exist on the form *and* on each control. On the form, they check every control it owns.

⚠️ **The `invalid` event does not bubble.** It fires on each invalid control, so a single listener
on the form does not see it — attach per control, or listen in the **capture** phase on the form.
That is the detail people get wrong when building a custom error summary.

## `ValidityState` — why it failed

`el.validity` is a live object of booleans, and `el.validationMessage` is the browser's
localised message for whichever one is set:

| Flag | Set when |
|---|---|
| `valueMissing` | `required` and empty |
| `typeMismatch` | not a valid `email`/`url` for that `type` |
| `patternMismatch` | fails `pattern` |
| `tooLong` / `tooShort` | outside `maxlength` / `minlength` |
| `rangeOverflow` / `rangeUnderflow` | outside `max` / `min` |
| `stepMismatch` | not on the `step` grid |
| `badInput` | the browser could not convert what was typed at all |
| `customError` | `setCustomValidity` was called with a non-empty string |
| `valid` | none of the above |

🔴 **`badInput` is the one worth knowing.** Type letters into `<input type="number">` and the
browser cannot produce a number, so **`.value` reads as the empty string** — the characters are
visible on screen and unreachable from JavaScript. A "required field is empty but the user swears
they filled it in" report is usually this.

```js
if (input.validity.badInput) { /* unparseable, not missing */ }
```

Reading the flags is how you write your own messages while letting the browser decide *whether*
something is invalid:

```js
const why = (el) =>
  el.validity.valueMissing ? 'We need this one.' :
  el.validity.typeMismatch ? 'That does not look like an email address.' :
  el.validity.patternMismatch ? 'Format: ABC-1234.' :
  el.validationMessage;
```

## `setCustomValidity` — and the bug it causes

For rules HTML cannot express — "passwords must match", "this username is taken":

```js
confirm.setCustomValidity(
  confirm.value === password.value ? '' : 'The passwords do not match.'
);
```

> **A non-empty string makes the control invalid. An empty string clears it.**

🔴 **The classic bug is never clearing it.** Set the message once on a failed check and the
control stays invalid **forever**, no matter what the user types, because nothing in the platform
resets it for you. The form then refuses to submit with an error bubble the user has already
fixed.

**The fix is structural, not a patch:** re-run the check on every relevant `input` event and set
the message *unconditionally* — the ternary above always assigns, either the message or `''`.
Never write `if (bad) setCustomValidity(msg)` with no else branch.

⚠️ A control carrying a custom error also reports `validity.customError === true` and
`validity.valid === false`, so any "is this form OK?" logic sees it — which is the point, and also
why a stale one is so damaging.

## Turning the native UI off — without losing the API

```html
<form novalidate>
```

`novalidate` (or `formnovalidate` on a submit button) stops the browser blocking submission and
showing its own bubbles. **It does not disable the API**: `checkValidity()`, `validity` and
`validationMessage` all still work.

That is exactly the arrangement for a custom-styled form: keep the constraints in HTML, add
`novalidate`, and render your own messages from `validity`. You get the browser's correctness with
your own presentation.

## Styling: `:invalid` is too eager, `:user-invalid` is not

`:invalid` matches from the moment the page loads — so every `required` field is red before the
user has typed a character. That is why hand-rolled "only show errors after blur" class-toggling
exists.

The platform's own answer is **`:user-invalid`**, which matches only after the user has
interacted with the control:

```css
input:user-invalid { border-color: var(--error); }
input:user-invalid + .hint { display: block; }
```

Its counterpart `:user-valid` matches after interaction when the value is good. There is no
JavaScript to write for this at all, which is the best kind of answer.

## The rule that outranks everything on this page

🔴 **Client-side validation is a user-experience feature, not a security control.** It runs on the
user's machine, in a browser they control, and every constraint here can be removed with the
element inspector or bypassed by not using the form at all. **The server must validate
everything, again.** Saying this unprompted is worth more in an interview than any API detail
above.

## Gotchas

**Symptom:** A field stays invalid no matter what the user types
**Cause:** `setCustomValidity` was set and never cleared.
**Fix:** Assign unconditionally on every check — the message or `''`.

**Symptom:** A custom error summary never populates
**Cause:** The `invalid` event does not bubble, so a form-level listener misses it.
**Fix:** Listen per control, or on the form in the capture phase.

**Symptom:** A `type="number"` field reads as empty while showing text
**Cause:** `validity.badInput` — the browser cannot parse it, so `.value` is `''`.
**Fix:** Check `badInput` before treating it as missing.

**Symptom:** Every required field is styled red on first paint
**Cause:** `:invalid` matches immediately, before any interaction.
**Fix:** `:user-invalid`.

**Symptom:** Adding `novalidate` broke the validation logic
**Cause:** Expecting it to disable the API. It only disables the browser's blocking and bubbles.
**Fix:** Nothing — `checkValidity()` and `validity` still work; that is the point of the flag.

**Symptom:** Validation passes in the browser and the server rejects the data
**Cause:** Constraints were treated as a security boundary.
**Fix:** Validate server-side; the client copy is for the user's benefit only.

**Symptom:** `checkValidity()` returned false but the user saw no error
**Cause:** `checkValidity` deliberately shows nothing.
**Fix:** `reportValidity()`, or render your own message from `validationMessage`.

**Symptom:** A `pattern` never matches
**Cause:** `pattern` is anchored to the whole value and the flags you expect may not apply.
**Fix:** Write the expression for the entire value, and test it against a real input rather than in isolation.

## Interview questions

**★ `checkValidity()` versus `reportValidity()`?**
Same boolean; `reportValidity` additionally shows the browser's error UI and focuses the first
invalid control. Both fire the `invalid` event. Use `checkValidity` when you are rendering your own
messages.

**★ How do you add a rule HTML cannot express?**
`setCustomValidity(message)` — non-empty makes it invalid, `''` clears it. Assign it
**unconditionally** on every re-check; the classic bug is setting it once and never clearing, which
leaves the field permanently invalid.

**★ What is `badInput` and why does it matter?**
The browser could not convert what was typed to the input's type — letters in a `number` field.
The value is visible to the user and reads as `''` from JavaScript, so the field looks empty when
it is actually unparseable.

**★ How do you style errors without marking every empty required field red on load?**
`:user-invalid`, which only matches after the user has interacted with the control. `:invalid`
matches from first paint, which is why people hand-roll blur-based class toggling.

**★ What does `novalidate` actually turn off?**
Only the browser's blocking of submission and its error bubbles. `checkValidity()`, `validity` and
`validationMessage` keep working — which is precisely what makes a custom-styled form possible.

**★ Is client-side validation a security control?**
No. It is a UX feature and can be removed in the inspector or bypassed entirely. The server must
re-validate everything.

**Why doesn't one listener on the form catch every `invalid` event?**
The `invalid` event does not bubble. Listen on each control, or on the form during the capture
phase.

---

← [01 · `FormData` and reading a form](./01-formdata.md) · [Topic index](./README.md) ·
Next → [03 · `input`, `change` and submitting](./03-form-events.md)
