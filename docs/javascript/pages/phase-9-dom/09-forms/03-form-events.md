---
title: "03 · input, change and submitting"
sidebar_label: "03 · input, change and submitting"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`input` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event), [`change` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event), [`beforeinput` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event), [`submit` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event), [`SubmitEvent.submitter`](https://developer.mozilla.org/en-US/docs/Web/API/SubmitEvent/submitter), [`HTMLFormElement.requestSubmit()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit), [`HTMLFormElement.submit()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit), [`reset` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event). Documentation-validated; **no timings**.

## `input` versus `change`

| Event | Fires |
|---|---|
| **`input`** | On **every** value change — each keystroke, each paste, each drag-drop, each slider step |
| **`change`** | When the change is **committed** |

"Committed" means different things per control type, and that is the whole subtlety:

- **Text-like inputs and `<textarea>`** — `change` fires on **blur**, and only if the value
  actually changed since focus. Type and click away: one `change`. Type and press Escape back to
  the original: none.
- **Checkbox, radio, `<select>`** — `change` fires **immediately** on the choice. For these two
  events there is effectively no difference in timing.
- **`<input type="range">`** — `input` fires as the thumb moves; `change` when it is released.
- **`<input type="file">`** — `change` fires when a file is chosen.

🔴 **Default to `input`.** It is the one that means "the value is different now", and it is what
live search, character counters, enable-the-submit-button and any controlled-input pattern need.
Reach for `change` when you specifically want *"the user has finished"* — the classic being an
expensive network call you do not want on every keystroke.

⚠️ **Neither fires when JavaScript sets `.value`.** Assigning `input.value = 'x'` changes the
value and dispatches nothing. Code that reacts to user typing will not react to your assignment —
which is usually correct (it prevents loops), and is a real surprise when you are trying to
prefill a third-party widget. If you genuinely need it, dispatch the event yourself:

```js
input.value = 'x';
input.dispatchEvent(new Event('input', { bubbles: true }));
```

**Both events bubble**, which is what makes one listener on the form work for every field:

```js
form.addEventListener('input', (e) => {
  if (e.target.matches('[data-live]')) update(e.target);
});
```

That is [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md)
applied to forms, and it survives fields being added later.

`focusin`/`focusout` are the bubbling counterparts of `focus`/`blur`, so "validate on blur" via
delegation uses `focusout`.

## `beforeinput` — the one you can cancel

`beforeinput` fires **before** the value changes and is cancelable, so `preventDefault()` rejects
the edit outright. Its `inputType` (`insertText`, `deleteContentBackward`, `historyUndo`, …) and
`data` describe what is *about* to happen.

It is the correct tool for input masking and for blocking characters — better than the old
`keypress`-and-`keyCode` approach, because it also covers paste, drag-drop, autofill and IME
input, which key events do not see.

⚠️ Blocking characters is usually the wrong product decision: filtering input silently is
frustrating and breaks assistive tech. Prefer letting the value in and validating it.

## The `submit` event

```js
form.addEventListener('submit', (e) => {
  e.preventDefault();                       // stop the navigation
  const data = new FormData(form, e.submitter);
  // …
});
```

- It fires on the **form**, not the button. A `click` listener on the submit button misses the
  Enter key and misses `requestSubmit()`.
- `e.preventDefault()` stops the browser navigating. Forgetting it produces the page-reloads-and-
  the-work-is-lost bug.
- **`e.submitter`** is the button that caused it — `null` when submission came from
  `requestSubmit()` with no argument. That is how one form supports several actions.
- The browser's own validation runs **before** `submit` fires. An invalid form (without
  `novalidate`) never reaches your handler.

## `requestSubmit()` and `submit()` are not the same method

This is the trap in the whole topic.

| Call | Validates? | Fires `submit`? |
|---|---|---|
| `form.requestSubmit()` | **yes** | **yes** |
| `form.submit()` | **no** | **no** |

`form.submit()` submits *immediately*, skipping constraint validation and skipping your `submit`
handler entirely — so every `preventDefault`, every analytics hook and every "are you sure?" is
bypassed. It is legacy API, and calling it is almost always a bug.

```js
form.requestSubmit();                        // ✅ exactly as if the user pressed submit
form.requestSubmit(publishButton);           // ✅ …with that submitter
```

🔴 **Also: a control named `submit` shadows the method.** `<button name="submit">` makes
`form.submit` the *element*, so `form.submit()` throws "not a function". The same applies to
`reset`, `elements` and any other member name — which is one more reason `requestSubmit` is the
safer call.

## `reset`

`form.reset()` restores every control to its **default** — its `value` *attribute*, its `checked`
attribute — not to blank, and not to whatever the value was when the page last saved. It fires a
cancelable `reset` event.

That default/current split is the same one as
[05 · Attributes versus properties](../05-attributes-vs-properties/README.md): the attribute is
the default, the property is the current value, and `reset` is the platform copying the first back
over the second.

## Double submission

A submit handler doing async work must disable the control, because nothing in the platform stops
a second press:

```js
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  try { await save(new FormData(form, button)); }
  finally { button.disabled = false; }
});
```

⚠️ **Disable the button, not the form** — disabling a `<fieldset>` or the controls mid-submit
removes them from the data, and a disabled element also loses focus, which drops the user's place
in the keyboard order. Restore in `finally`, or a failed request leaves the form permanently
dead.

## Gotchas

**Symptom:** A handler misses submissions made with the Enter key
**Cause:** It listens for `click` on the button rather than `submit` on the form.
**Fix:** Listen for `submit`.

**Symptom:** The page reloads and the entered data is gone
**Cause:** No `preventDefault()` in the submit handler.
**Fix:** Call it first thing.

**Symptom:** `form.submit()` bypassed validation and the submit handler
**Cause:** That is what `submit()` does — no validation, no event.
**Fix:** `form.requestSubmit()`.

**Symptom:** `form.submit is not a function`
**Cause:** A control named `submit` shadows the method on the form object.
**Fix:** Rename the control, or use `requestSubmit`.

**Symptom:** Setting `.value` from code did not trigger the listener
**Cause:** Programmatic value changes fire no `input` or `change`.
**Fix:** Dispatch `new Event('input', { bubbles: true })` if a listener really must run.

**Symptom:** A live-search handler only fires when the field loses focus
**Cause:** It listens for `change`, which commits on blur for text inputs.
**Fix:** `input`.

**Symptom:** A delegated blur handler never fires
**Cause:** `blur` does not bubble.
**Fix:** `focusout`.

**Symptom:** The request is sent twice
**Cause:** Nothing disabled the submitter during the async work.
**Fix:** Disable the button, re-enable in `finally`.

**Symptom:** Disabling the form during submit emptied the payload
**Cause:** Disabled controls are not successful — they leave the `FormData`.
**Fix:** Disable the button only, and build the `FormData` before disabling anything.

**Symptom:** `reset()` left old values in the fields
**Cause:** It restores the *default* (the attribute), not blank.
**Fix:** Set the values explicitly if blank is what you want.

## Interview questions

**★ `input` versus `change`?**
`input` fires on every value change; `change` fires when the change is committed — on **blur** for
text inputs, immediately for checkboxes, radios and selects. Default to `input`; use `change` when
you specifically want "the user has finished".

**★ Why listen for `submit` on the form instead of `click` on the button?**
The `submit` event covers the Enter key and `requestSubmit()`, and it carries `e.submitter` so you
still know which button was used. A `click` listener sees only mouse and keyboard activation of
that one element.

**★ `form.submit()` versus `form.requestSubmit()`?**
`requestSubmit()` behaves exactly like a user pressing the button — it runs constraint validation
and fires the `submit` event. `form.submit()` skips **both**, so your handler, your
`preventDefault` and all validation are bypassed. `requestSubmit` is essentially always the one you
want.

**★ Why did setting `input.value` not trigger my handler?**
Programmatic changes do not fire `input` or `change` — only user interaction does. That is what
stops feedback loops; dispatch the event manually if you truly need it.

**★ What is `beforeinput` for?**
It fires before the value changes, is cancelable, and its `inputType`/`data` describe the pending
edit — so it covers paste, drag-drop and IME input that key events never see. The right tool for
masking, though blocking input is usually the wrong product call.

**★ How do you prevent double submission?**
Disable the **submitter** during the async work and re-enable it in `finally`. Do not disable the
form or a fieldset: disabled controls drop out of the `FormData`, and disabling steals focus.

**Why doesn't a delegated `blur` handler fire?**
`blur` does not bubble — use `focusout`, its bubbling counterpart (and `focusin` for `focus`).

**What does `form.reset()` restore to?**
The controls' **defaults** — the `value` and `checked` *attributes* — not blank, and not any
later-saved state.

---

← [02 · Constraint validation](./02-constraint-validation.md) · [Topic index](./README.md) ·
**10 · Removing and replacing** *(not written yet)* →
