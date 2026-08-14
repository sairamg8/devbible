---
title: "05 · Form and input events"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`input` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event), [`change` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event), [`beforeinput` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event), [`submit` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event), [`HTMLFormElement.requestSubmit()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit), [`compositionstart` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event). Documentation-validated; **no timings**.

Forms are where the event model meets real user behaviour: typing, pasting, autofill, IME
composition, and a submit button that may or may not be the one you expected.

🔴 **The two facts that decide most of it:** `change` waits for **blur** on text fields while
`input` fires on every keystroke — and **setting `.value` from code fires neither**.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The event set](./01-the-event-set.md)** | `beforeinput` / `input` / `change` and exactly when each fires per control, `submit` and `e.submitter`, why `form.submit()` skips everything and `requestSubmit()` does not, and `focusin`/`focusout` for delegated validation |
| 02 | **[A controlled input by hand](./02-a-controlled-input.md)** | Controlled versus uncontrolled and what it costs, the caret-reset guard, preserving the caret through a formatter, the IME composition guard, rejecting input with `beforeinput`, and debouncing without a stale value |

## Three facts worth carrying out of this topic

- **`form.submit()` skips constraint validation *and* your `submit` handler.**
  `form.requestSubmit()` is the one that behaves like a button press.
- **Assigning `input.value` resets the caret** — even to an identical string. Guard every
  assignment with a comparison.
- **A formatter without an IME guard breaks CJK input**, and it is three lines to fix.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [Phase 9 · 09 · Forms](../../phase-9-dom/09-forms/01-formdata.md) — `FormData`, successful
  controls, and the constraint-validation API these events drive
- [Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/01-what-can-hold-focus.md)
  — why form-wide focus handling needs `focusin`/`focusout`
- [Phase 9 · 19 · contenteditable](../../phase-9-dom/19-selection-range-contenteditable/02-contenteditable.md)
  — `beforeinput`, `inputType` and IME again, in the editor context
- [04 · Event delegation](../04-event-delegation/README.md) — why one listener on the form beats
  one per field

---

Start → [01 · The event set](./01-the-event-set.md)
