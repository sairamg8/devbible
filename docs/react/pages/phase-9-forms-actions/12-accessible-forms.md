---
title: "Accessible forms"
sidebar_label: "12 · Accessible forms"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useId`](https://react.dev/reference/react/useId), MDN
> [Constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation),
> and react.dev [`<form>`](https://react.dev/reference/react-dom/components/form).
> ARIA attribute behaviour is standard platform behaviour; where a recommendation is
> engineering judgement rather than documented, it says so.
> No sandbox script backs this page; claims are cited, not measured.

**Most form accessibility is four things: a real label, an error the field points at, an
announcement when something changes, and focus that lands where the user needs it. None of
them is expensive, and a form that skips them is unusable rather than merely imperfect.**

## 1 · A real `<label>`, associated by id

```jsx
function Field({ label, name, error, ...props }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && <p id={errorId}>{error}</p>}
    </div>
  );
}
```

**`useId` is the right generator**, and specifically because of SSR:

> `useId` is a React Hook for generating **unique IDs** that can be passed to accessibility
> attributes.

A counter or `Math.random()` produces different values on server and client, which is a
hydration mismatch ([Phase 7 · 04 · 01](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/01-purity-and-idempotence.md)
— a non-idempotent render). `useId` is stable across both.

Note also **`id` and `name` are different jobs**: `id` associates the label and the error
message; `name` is what `FormData` reads ([topic 05](05-uncontrolled-and-formdata.md)). Most
fields need both, and neither substitutes for the other.

**A placeholder is not a label.** It disappears on focus, fails contrast requirements in most
designs, and is not reliably announced. If the design has no visible label, the field still
needs one — visually hidden, or `aria-label` as a last resort.

## 2 · Errors the field points at

Two attributes do the work:

- **`aria-invalid`** marks the field as failing validation, so it is announced as invalid
  when focused.
- **`aria-describedby`** points at the element holding the message, so the message is read
  *with* the field rather than existing separately on screen.

⚠️ **Set them to `undefined` rather than `false` or `''` when there is no error**, so the
attributes are absent. `aria-invalid="false"` is valid but noisier, and an
`aria-describedby` pointing at an element that is not rendered is a dangling reference.

**Colour alone conveys nothing.** A red border is invisible to a screen reader and to many
users with colour vision deficiency; the message must be text, and the association must be
explicit.

## 3 · Announcing what changed

Errors that appear after a submission are the hard case, because the user may not be looking
at the field:

- **A form-level error or a success message** needs `role="alert"`, which is announced as
  soon as it appears without the user moving focus.
- **A pending state** is worth announcing too — a `role="status"` region saying "Saving…"
  tells a screen-reader user that the button press did something, which matters more here
  than in most UI because a transition suppresses Suspense fallbacks
  ([Phase 8 · 11](../phase-8-concurrent-suspense/11-suspense-inside-a-transition.md)) and
  `isPending` may be the only visible change ([topic 06](06-useformstatus.md)).

⚠️ **Judgement:** `role="alert"` interrupts, so use it for things the user must know now — a
failure, a confirmation — and `role="status"` for progress. Marking every message as an
alert trains people to ignore them.

## 4 · Focus after submission

The step most often skipped, and the one that makes a long form usable:

- **On validation failure, move focus to the first invalid field.** Otherwise a screen-reader
  or keyboard user is left at the submit button with an error somewhere above them and no
  way to know where.
- **On success, move focus somewhere meaningful** — the confirmation message, or the next
  step. Leaving focus on a now-cleared form is disorienting, especially since React has just
  reset the fields ([topic 09](09-form-reset.md)).

⚠️ **Judgement on the mechanics:** focus is a DOM effect, so it belongs in an effect keyed
on the new error state, not in render
([Phase 7 · 04 · 04](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/04-refs-and-the-dom-in-render.md)).
And moving focus *unprompted* is disruptive — do it in response to a submission the user
initiated, not on every keystroke or field blur.

## Grouping: `<fieldset>` and `<legend>`

Radio groups and checkbox groups need a group-level label, and a `<label>` on each option is
not enough — the user hears "Standard" without hearing what question it answers:

```jsx
<fieldset>
  <legend>Delivery speed</legend>
  <label><input type="radio" name="speed" value="standard" /> Standard</label>
  <label><input type="radio" name="speed" value="express" /> Express</label>
</fieldset>
```

The shared `name` is doing double duty here — it groups the radios for the browser and for
`FormData` ([topic 01 · 02](01-controlled-inputs/02-every-input-type.md)) — and `<legend>`
supplies the question.

## What the platform gives you free

Reusing [topic 04](04-validation.md)'s point from the accessibility side: `required`,
`type="email"`, `min`/`max` and `pattern` are announced by assistive technology as
constraints on the field, before any JavaScript. `aria-required` is redundant when
`required` is present.

The trade to make deliberately: `noValidate` gives you control of the message and its
association, and takes away the browser's own announcement. **If you use `noValidate`, the
`aria-invalid` and `aria-describedby` wiring is not optional** — you have removed the
platform's accessibility and must replace it.

## The checklist

⚠️ **Judgement, but each line traces to something above.**

- [ ] Every field has a `<label htmlFor>` — visible where possible
- [ ] `id` from `useId`; `name` for `FormData`; both present
- [ ] Errors are text, not colour
- [ ] `aria-invalid` and `aria-describedby` on invalid fields, `undefined` otherwise
- [ ] Form-level messages use `role="alert"`; progress uses `role="status"`
- [ ] Focus moves to the first error on failure, and somewhere meaningful on success
- [ ] Groups are wrapped in `<fieldset>` with a `<legend>`
- [ ] Platform validation attributes are present even if you also validate in JS
- [ ] The whole form is operable by keyboard alone, in a sensible order

## Gotchas

**Symptom:** a hydration mismatch on form ids.
**Cause:** ids generated with a counter or random value differ between server and client.
**Fix:** `useId`, which is stable across both.

**Symptom:** errors are visible but never announced.
**Cause:** no `aria-describedby` linking the message, and no `role="alert"` on form-level
messages.
**Fix:** wire both. Position and colour convey nothing.

**Symptom:** `aria-describedby` points at nothing.
**Cause:** it is set unconditionally while the error element renders conditionally.
**Fix:** set it to `undefined` when there is no error.

**Symptom:** a screen-reader user does not know a submission is happening.
**Cause:** the only feedback is a visual pending state, and the transition suppressed the
Suspense fallback.
**Fix:** a `role="status"` region announcing progress.

**Symptom:** after a failed submission the user cannot find the error.
**Cause:** focus stayed on the submit button.
**Fix:** move focus to the first invalid field, in an effect keyed on the new error state.

**Symptom:** radio options are announced without the question.
**Cause:** no `<fieldset>`/`<legend>`.
**Fix:** group them.

**Symptom:** `noValidate` was added and accessibility got worse.
**Cause:** the browser's own validation announcements were removed and nothing replaced
them.
**Fix:** the ARIA wiring becomes mandatory once you opt out.

## Interview questions

**★ What is the minimum for an accessible form field?**
A real `<label htmlFor>` tied to the input's `id`, with the `id` generated by `useId` so it
is stable across server and client. When invalid, `aria-invalid` on the field and
`aria-describedby` pointing at the message element, so the error is announced *with* the
field rather than merely existing on screen. And the error must be text — colour conveys
nothing to a screen reader or to many users with colour vision deficiency.

**★ Why `useId` rather than a counter?**
Because a counter or random value produces different ids on the server and the client, which
is a hydration mismatch — a non-idempotent render. `useId` is designed for exactly this and
is stable across both.

**★ How do you announce something that changes after submission?**
`role="alert"` for a form-level error or confirmation, which is announced as soon as it
appears without focus moving. `role="status"` for progress. That matters more in a React
form than elsewhere, because a transition suppresses Suspense fallbacks, so the pending
state may be the only change on screen — and a purely visual one at that.

**★ What is the focus step, and why is it so often skipped?**
On a validation failure, move focus to the first invalid field; on success, to the
confirmation or next step. It is skipped because it looks like polish, but without it a
keyboard or screen-reader user is left at the submit button with an error somewhere above
them. Do it in an effect keyed on the new error state — it is a DOM effect, not render work
— and only in response to a submission the user initiated.

**What changes if you set `noValidate`?**
You take over presentation of the errors and lose the browser's own announcements, so the
`aria-invalid` and `aria-describedby` wiring stops being good practice and becomes mandatory.
Keeping the platform validation attributes is still worth it: they are announced as
constraints on the field and are the only validation that runs before hydration.

**Why do fields need both `id` and `name`?**
They do different jobs. `id` associates the label and the error message; `name` is the key
`FormData` reads, so it is what actually submits. A field with only an `id` renders and
behaves perfectly and never appears in the submission.

---

← Prev: [Progressive enhancement](11-progressive-enhancement.md) ·
Index: [Phase 9](README.md) ·
Next → [⚠ `useFormState`](13-useformstate.md)
