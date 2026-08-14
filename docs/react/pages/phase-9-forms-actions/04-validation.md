---
title: "Validation"
sidebar_label: "04 · Validation"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — MDN
> [Constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation)
> (the attributes table, `ValidityState`, `checkValidity`/`reportValidity`/
> `setCustomValidity`, the pseudo-classes and the notes) and react.dev
> [`useActionState`](https://react.dev/reference/react/useActionState) and
> [`<form>`](https://react.dev/reference/react-dom/components/form).
> No sandbox script backs this page; claims are cited, not measured.

**Client-side validation is a courtesy to the user; server-side validation is the only
thing that is true. Both belong in a form, they answer different questions, and the mistake
is treating either as a substitute for the other.**

MDN states the rule outright:

> HTML Constraint validation **doesn't remove the need for validation on the _server
> side_.** Even though far fewer invalid form requests are to be expected, invalid ones can
> still be sent in many ways … **you should always validate form data on the server side,
> consistent with what is done on the client side.**

"Consistent with" is the load-bearing part: two validators that disagree are worse than
one, because the user is told something is fine and then told it is not.

## Layer 1 — the browser does it for free

Before any JavaScript, the platform validates from attributes:

| Attribute | Constraint | Violation |
|---|---|---|
| `required` | There must be a value | `valueMissing` |
| `min` / `max` | Value within range | `rangeUnderflow` / `rangeOverflow` |
| `minlength` / `maxlength` | Character count bounds | `tooShort` / `tooLong` |
| `pattern` | Matches a JavaScript regular expression | `patternMismatch` |
| `type="email"` / `type="url"` | Syntactically valid | `typeMismatch` |
| `step` | Matches the step | `stepMismatch` |

This layer costs nothing, works before hydration, and is the only validation a
progressively-enhanced form has until JavaScript loads
([topic 11](11-progressive-enhancement.md)). **Use it even when you also validate in
JavaScript.**

Two documented traps:

> **`minlength` and `maxlength` constraints are only checked on user-provided input.** They
> are **not** checked if a value is set programmatically, even when explicitly calling
> `checkValidity()` or `reportValidity()`.

> Calling the `submit()` method on `HTMLFormElement` **doesn't trigger constraint
> validation.** Call the `click()` method on a submit button instead.

The first bites when you prefill a form from state; the second when you submit
programmatically and wonder why nothing was checked.

## Layer 2 — the Constraint Validation API

When the built-in messages are not enough:

> The **`checkValidity()`** method returns a Boolean indicating whether the element's value
> passes its constraints … This performs **static** validation.

> In contrast, the **`reportValidity()`** method **reports any constraint failures to the
> user.** This performs **interactive** validation.

> The **`setCustomValidity(message)`** method … An empty string means the constraint is
> satisfied; any other string is the error message to display.

And `element.validity` gives you the `ValidityState` flags above, so you can tell *which*
constraint failed rather than only that one did.

The distinction to remember: **`checkValidity` asks, `reportValidity` asks and shows.**
Using the second when you meant the first pops browser UI you did not intend.

⚠️ **Browser-native error bubbles are hard to style and are announced inconsistently.**
Many teams set `noValidate` on the form and take over presentation entirely — MDN notes
that with `novalidate`, *"interactive validation of the constraints doesn't happen"*. That
is a legitimate trade: you gain control of the message and its accessibility, and you take
on the responsibility of showing it.

## Layer 3 — the server, through the action's return value

This is where React's model earns its keep. The action returns validation results as
**state**, and `useActionState` hands them back
([topic 03](03-useactionstate.md)):

```jsx
async function saveProfile(previousState, formData) {
  const values = Object.fromEntries(formData);
  const errors = {};

  if (!values.email?.includes('@')) errors.email = 'Enter a valid email address';
  if (!values.name?.trim())         errors.name  = 'Name is required';

  if (Object.keys(errors).length) {
    return { errors, values };          // ← errors AND what they typed
  }

  try {
    await api.saveProfile(values);
    return { errors: {}, values: {}, ok: true };
  } catch {
    return { errors: { form: 'Could not save. Try again.' }, values };
  }
}
```

```jsx
function ProfileForm() {
  const [state, formAction, isPending] = useActionState(saveProfile, { errors: {}, values: {} });

  return (
    <form action={formAction} noValidate>
      <Field
        name="name"
        defaultValue={state.values.name}
        error={state.errors.name}
      />
      <Field
        name="email"
        type="email"
        defaultValue={state.values.email}
        error={state.errors.email}
      />
      {state.errors.form && <p role="alert">{state.errors.form}</p>}
      <button disabled={isPending}>Save</button>
    </form>
  );
}
```

🔴 **Returning `values` alongside `errors` is not optional.** React resets uncontrolled
fields when the action **succeeds** ([topic 02](02-actions.md)) — and returning an error
object *is* success. Without the values fed back as `defaultValue`, a validation failure
wipes everything the user typed, which is the worst possible response to "you made a small
mistake".

**Return field-keyed errors, not a single string.** `{ email: '…', name: '…' }` lets each
field render its own message next to itself; one string forces a summary at the top that
the user must map back to fields themselves.

## Why *returning* rather than throwing

A validation failure is an expected outcome, not a crash. Throwing from an action:

- shows the nearest **error boundary**, replacing the working form with an error screen;
- **cancels all queued actions** ([topic 03](03-useactionstate.md)) — so a second
  submission behind it is discarded too;
- loses everything the user had typed, since the subtree is gone.

Returning keeps the component mounted, the values in hand and the error next to the field.
This is the "expected versus unexpected" distinction from
[Phase 8 · 16](../phase-8-concurrent-suspense/16-error-boundaries-and-suspense.md), and
[topic 10](10-errors-in-actions.md) makes it the deliberate choice it should be.

## Showing errors accessibly

The minimum, and none of it is optional:

```jsx
function Field({ name, label, error, ...props }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && <p id={errorId}>{error}</p>}
    </>
  );
}
```

- **`useId`** for the label association
  ([Phase 5 · 14](../phase-5-refs-context-reducers/14-useid.md)) — it is SSR-safe, which a
  hand-rolled counter is not.
- **`aria-invalid`** marks the field, and **`aria-describedby`** ties the message to it so a
  screen reader reads the error when the field is focused. Colour alone conveys nothing.
- **Set them to `undefined` rather than `false`/`''` when there is no error**, so the
  attributes are absent rather than present-and-empty.
- **A form-level error** should be `role="alert"` so it is announced when it appears.

[Topic 12](12-accessible-forms.md) covers the rest, including moving focus to the first
error — which is what makes a long form usable rather than merely correct.

## When to validate

⚠️ **Judgement, not documentation**, but it follows from the layers above:

| Moment | Validate? |
|---|---|
| On every keystroke | 🔴 No — telling someone their email is invalid while they type it is hostile |
| On blur, for a field the user has finished | ✅ Good — the standard "touched" heuristic |
| On submit | ✅ Always — the last chance before the request |
| On the server, always | ✅ The only one that is true |
| Re-validate a field with an error, as they fix it | ✅ Yes — clearing an error promptly is the one case where per-keystroke is right |

The asymmetry in the last two rows is the useful part: **be slow to show an error and quick
to remove one.**

## Gotchas

**Symptom:** a validation failure clears the whole form.
**Cause:** returning an error counts as success, so React reset the uncontrolled fields.
**Fix:** return the submitted values too and render them as `defaultValue`.

**Symptom:** a thrown validation error replaces the form with an error screen and loses a
queued submission.
**Cause:** throwing goes to an error boundary and cancels queued actions.
**Fix:** return expected failures; throw only for the genuinely broken.

**Symptom:** `minlength` is ignored on a prefilled field.
**Cause:** it is only checked on user-provided input, even via `checkValidity`.
**Fix:** validate length yourself for programmatic values.

**Symptom:** programmatic `form.submit()` skips all validation.
**Cause:** documented — it does not trigger constraint validation.
**Fix:** `click()` the submit button instead.

**Symptom:** browser error bubbles clash with the design and are announced inconsistently.
**Cause:** native interactive validation.
**Fix:** `noValidate` and present errors yourself — accepting that you now own the whole
job.

**Symptom:** errors are visible but a screen reader never announces them.
**Cause:** no `aria-describedby` linking the message, or no `role="alert"` on a form-level
error.
**Fix:** wire both. Colour and position convey nothing.

**Symptom:** client and server disagree, so a field passes then fails.
**Cause:** two validators that drifted.
**Fix:** MDN's own instruction — validate on the server *consistent with* the client. Share
the rules if you can.

## Interview questions

**★ Why validate on both the client and the server?**
Because they answer different questions. The client is feedback — fast, local, and able to
stop an obviously bad request. The server is truth: MDN says plainly that constraint
validation does not remove the need for server-side validation, since invalid requests can
still be sent in many ways. And the two must be *consistent*, because a user told a value
is fine and then told it is not is worse off than with one validator.

**★ How do server validation errors get back into a React form?**
As the action's return value. The action returns `{ errors, values }`, `useActionState`
exposes it as `state`, and the form renders each error beside its field. Returning the
submitted **values** as well is mandatory rather than a nicety: React resets uncontrolled
fields when an action succeeds, and returning an error object counts as success — without
them, a validation failure wipes everything the user typed.

**★ Why return validation errors instead of throwing them?**
Because throwing shows the nearest error boundary, replaces the working form with an error
screen, loses the typed values with the subtree, and cancels every queued action behind it.
Returning keeps the component mounted with the values in hand and the message next to the
field. A validation failure is an expected outcome, not a crash.

**★ What does the platform give you before any JavaScript?**
Constraint validation from attributes — `required`, `min`/`max`, `minlength`/`maxlength`,
`pattern`, `type="email"`/`"url"`, `step` — each mapping to a `ValidityState` flag such as
`valueMissing` or `patternMismatch`. It costs nothing and is the only validation a
progressively-enhanced form has before hydration. Two traps: `minlength`/`maxlength` are
only checked on user-provided input, and `form.submit()` skips validation entirely.

**What is the difference between `checkValidity` and `reportValidity`?**
`checkValidity` performs static validation and returns a boolean; `reportValidity` performs
interactive validation and *shows* the failures to the user. Reaching for the second when
you meant the first pops browser UI you did not intend. `setCustomValidity` sets a custom
message, where an empty string means the constraint is satisfied.

**When should a field be validated?**
Not on every keystroke — telling someone their email is invalid while they are typing it is
hostile. On blur once they have finished the field, and always on submit and on the server.
The asymmetry worth remembering: be slow to show an error and quick to remove one, so
re-validating per keystroke *is* right once a field already shows an error.

---

← Prev: [`useActionState`](03-useactionstate.md) ·
Index: [Phase 9](README.md) ·
Next → [Uncontrolled forms and `FormData`](05-uncontrolled-and-formdata.md)
