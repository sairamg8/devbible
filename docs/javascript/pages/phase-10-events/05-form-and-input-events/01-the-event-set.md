---
title: "01 · The event set"
sidebar_label: "01 · The event set"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`input` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event), [`change` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event), [`beforeinput` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event), [`submit` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event), [`focusin` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event), [`HTMLFormElement.requestSubmit()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit). Documentation-validated; **no timings**.

Six events cover almost everything a form does. The difficulty is not the API — it is knowing which
one fires when, because the differences are exactly where the bugs are.

| Event | Fires | Bubbles |
|---|---|---|
| `beforeinput` | **before** the value changes — **cancelable** | yes |
| `input` | after **every** change to the value | yes |
| `change` | text: on **blur**; checkbox/radio/select/file: **immediately** | yes |
| `submit` | on the **form**, when it is submitted | yes |
| `reset` | on the form, when it is reset | yes |
| `focusin` / `focusout` | focus enters / leaves a control | yes |

## `input` versus `change` — the one people get wrong

🔴 **For text inputs, `change` waits for blur.** Type "hello" into a text field and `input` fires
five times; `change` fires **once**, when you leave the field — and not at all if the value is back
to what it was.

For everything else, they effectively coincide:

| Control | `change` fires |
|---|---|
| `text`, `email`, `password`, `textarea`, `number` | **on blur** (if the value changed) |
| `checkbox`, `radio` | immediately on toggle |
| `select` | immediately on selection |
| `file` | immediately on choosing files |
| `range` | continuously as it moves, plus `change` at the end |

So: **`input` for live UI** — character counters, search-as-you-type, enabling a submit button.
**`change` for "the user has settled on a value"** — validating an email once, firing a request per
selection.

🔴 **Setting `.value` from code fires neither.** No `input`, no `change`, no `beforeinput`. If your
code sets a value and something else depends on the event, dispatch it yourself:

```js
input.value = '42';
input.dispatchEvent(new Event('input', { bubbles: true }));
```

That single fact is behind most "my framework doesn't see the autofilled value" reports.

## `beforeinput` — the cancelable one

`input` is after the fact and not cancelable. `beforeinput` fires first, is cancelable, and carries
what is about to happen:

```js
field.addEventListener('beforeinput', (e) => {
  if (e.inputType === 'insertFromPaste' && !allowPaste) e.preventDefault();
});
```

`inputType` covers `insertText`, `deleteContentBackward`, `insertFromPaste`, `insertFromDrop`,
`historyUndo` and more — which is how you block or transform an edit **by kind** instead of
comparing before-and-after strings. It is also the only route that covers paste, drag-drop and IME
in one place.

⚠️ MDN's caveat applies here too: not every modification fires it, and it can fire non-cancelably —
autocomplete, spell-check corrections, password-manager autofill and IME are the named cases. Treat
it as an optimisation over a keydown filter, never as a guarantee.

## `submit`, and the two ways to trigger it

```js
form.addEventListener('submit', (e) => {
  e.preventDefault();                 // stop the navigation
  const data = new FormData(form, e.submitter);
  send(data);
});
```

`e.submitter` is the button that submitted the form — the difference between "Save" and "Save and
add another" when both are in the same form
([Phase 9 · 09 · Forms](../../phase-9-dom/09-forms/01-formdata.md)).

🔴 **`form.submit()` skips both validation and your `submit` handler.** The method submits the form
directly. `form.requestSubmit()` is the one that behaves like a real button press: it runs
constraint validation, fires `submit`, and respects `preventDefault()`.

```js
form.submit();          // ❌ no validation, no submit event
form.requestSubmit();   // ✅ validates, fires submit, cancelable
```

Two more traps in the same area:

- **A control named `submit` shadows the method.** `<button name="submit">` makes `form.submit` the
  button, so calling it throws.
- **Disabled controls submit nothing.** Disabling the whole form to prevent double-submits removes
  every field from the payload; disable the **button** instead.

## Keeping keyboard shortcuts out of forms

A page-level shortcut handler has to know when the user is typing:

```js
document.addEventListener('keydown', (e) => {
  const el = e.target;
  const typing = el.matches('input, textarea, select, [contenteditable]');
  if (typing) return;
  if (e.key === '/') openSearch();
});
```

Checking `e.target` rather than a global "is a modal open" flag keeps the rule where it belongs, and
`[contenteditable]` is the case people forget
([Phase 9 · 19](../../phase-9-dom/19-selection-range-contenteditable/02-contenteditable.md)).

## Focus events on forms

`focus` and `blur` do **not** bubble, so a form-wide listener must use `focusin` / `focusout`
([Phase 9 · 15 · 01](../../phase-9-dom/15-focus-and-accessibility/01-what-can-hold-focus.md)).
That is what makes "validate the field the user just left" a single delegated listener:

```js
form.addEventListener('focusout', (e) => {
  if (e.target.matches('input, textarea, select')) validateField(e.target);
});
```

Validating on `focusout` rather than on `input` is also the accessible choice — it stops the form
shouting at someone halfway through typing an email address.

## Gotchas

**Symptom: the character counter only updates when the field loses focus.**
Cause — the listener is on `change`, not `input`.
Fix — `input` for anything live.

**Symptom: setting `input.value` in code does not update the UI that depends on it.**
Cause — programmatic value assignment fires no events.
Fix — dispatch `new Event('input', { bubbles: true })` after assigning.

**Symptom: `form.submit()` bypasses your validation and your handler.**
Cause — the method submits directly; only a real submission fires the event.
Fix — `form.requestSubmit()`.

**Symptom: `form.submit is not a function`.**
Cause — a control named or id'd `submit` shadows the method on the form object.
Fix — rename the control.

**Symptom: the submitted payload is missing fields after you disabled the form.**
Cause — disabled controls are not successful controls.
Fix — disable the submit button, not the fieldset.

**Symptom: a keyboard shortcut fires while the user is typing in a field.**
Cause — the handler is on `document` and does not check the target.
Fix — bail when `e.target` matches `input, textarea, select, [contenteditable]`.

**Symptom: a `focus` listener on the form never fires.**
Cause — `focus` does not bubble.
Fix — `focusin` / `focusout`.

## Interview questions

**★ What is the difference between `input` and `change`?**
`input` fires on every change to the value; `change` fires when the value is committed — on blur for
text fields, immediately for checkboxes, radios, selects and file inputs. Live UI uses `input`,
"the user settled on a value" uses `change`.

**★ Does setting `.value` from JavaScript fire `input`?**
No — no `beforeinput`, `input` or `change`. Dispatch the event yourself if other code depends on
it.

**★ What is the difference between `form.submit()` and `form.requestSubmit()`?**
`submit()` submits directly, skipping constraint validation **and** the `submit` event.
`requestSubmit()` behaves like pressing a submit button: it validates, fires the cancelable event,
and honours `preventDefault()`.

**★ How do you know which button submitted a form?**
`event.submitter` on the `submit` event — and passing it to `new FormData(form, submitter)`
includes that button's name and value in the payload.

**★ Why use `beforeinput` rather than filtering `keydown`?**
`keydown` misses paste, drag-and-drop and IME, and it tells you about keys rather than about edits.
`beforeinput` is cancelable and carries an `inputType` describing the actual change — though MDN
warns it does not fire for every modification.

**Why validate on `focusout` instead of `input`?**
Because validating mid-typing marks a half-written email as invalid and, with a live region,
announces it. `focusout` validates once the user has finished with the field.

---

[Topic index](./README.md) · [02 · A controlled input by hand](./02-a-controlled-input.md) →
