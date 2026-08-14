---
title: "Multiple actions in one form"
sidebar_label: "08 · Multiple actions in one form"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<form>`](https://react.dev/reference/react-dom/components/form) (the `formAction`
> override), the [React v19 release post](https://react.dev/blog/2024/12/05/react-19)
> (*"passing functions as the `action` and `formAction` props of `<form>`, `<input>`, and
> `<button>` elements"*), and
> [`useActionState`](https://react.dev/reference/react/useActionState).
> Where a recommendation is engineering judgement rather than documented, it says so.
> No sandbox script backs this page; claims are cited, not measured.

**One form, two buttons, two different things to do. `formAction` on the button overrides
the form's own action — which removes the hidden "intent" field every codebase used to
carry, and works before hydration because it is a platform attribute.**

## The override

> The `action` prop **can be overridden by a `formAction` attribute** on a `<button>`,
> `<input type="submit">`, or `<input type="image">` component.

And from the release post, the full set of elements that accept a function:

> We've added support for passing functions as the **`action` and `formAction` props of
> `<form>`, `<input>`, and `<button>` elements** to automatically submit forms with
> Actions.

```jsx
function DraftEditor({ draft }) {
  return (
    <form action={saveDraft}>
      <textarea name="body" defaultValue={draft.body} />
      <button type="submit">Save draft</button>
      <button formAction={publish}>Publish</button>
      <button formAction={deleteDraft}>Delete</button>
    </form>
  );
}
```

Each button submits **the same form** — the same `FormData`, the same fields — to a
different function. The action that runs is decided by which button the user pressed, which
is a platform behaviour React is reusing rather than inventing.

## What it replaces

The pattern before was an intent discriminator:

```jsx
// The old shape
<form action={handleSubmit}>
  <button name="intent" value="save">Save</button>
  <button name="intent" value="publish">Publish</button>
</form>

async function handleSubmit(formData) {
  switch (formData.get('intent')) {   // ← one function, a switch, and a string contract
    case 'save': …
    case 'publish': …
  }
}
```

Three things improve with `formAction`: each operation is **its own function** with its own
name and signature; there is no **string contract** between the markup and the handler to
get wrong; and the branching disappears, so each action is independently testable.

⚠️ **The old pattern is not obsolete**, though. `name`/`value` on a submit button is still
the right tool when the operations are *the same operation with a parameter* — "approve" and
"reject" hitting one endpoint with a different verdict — rather than genuinely different
work. Splitting those into two actions duplicates their shared logic for no gain.

## 🔴 How it meets `useActionState`

This is where the two features interact awkwardly, and it is the practical content of the
topic.

`useActionState` gives you **one** `formAction` bound to **one** action
([topic 03](03-useactionstate.md)). It returns one `state` and one `isPending`. So a form
with three `formAction` buttons has three actions but only one hook — and the other two
bypass it entirely, meaning **their return values go nowhere and their pending state is not
tracked by that hook.**

Three ways out, with different trade-offs. ⚠️ **Judgement, from how the two APIs are
documented.**

**1. Route everything through one `useActionState` action, and keep the intent field.**
The old pattern, chosen deliberately. You get one state, one `isPending`, and the sequential
queueing `useActionState` guarantees. The cost is the `switch` and the string contract.

```jsx
const [state, formAction, isPending] = useActionState(handleAll, initial);
// <button name="intent" value="publish">
```

**2. One `useActionState` per action, each with its own form.** If the operations do not
share fields — a "delete" button that needs no input — they arguably were not one form.
Splitting gives each its own state and pending flag with no ambiguity.

**3. Use `formAction` functions and read pending from `useFormStatus`.** Since
`useFormStatus` reports the **parent form's** pending state
([topic 06](06-useformstatus.md)), a shared submit button knows it is submitting regardless
of *which* action is running. You lose per-action return values, so this suits operations
whose result is a navigation or a refresh rather than a message.

**The honest summary: `formAction` and `useActionState` are not designed to compose.** Pick
per form — either you need the returned state (use one action) or you need genuinely
different operations (use `formAction`).

## Pending state across several actions

Two things worth knowing when several actions can run from one form:

- **`useFormStatus().pending` is per-form, not per-action.** Every button in the form sees
  the same `true`. Disabling *all* submit buttons during any submission is usually what you
  want anyway — it prevents "save then publish" races — but if you want to disable only the
  pressed one, you need per-button state.
- **Transitions batch.** Multiple ongoing Actions are batched together
  ([Phase 8 · 01](../phase-8-concurrent-suspense/01-usetransition/02-ispending-and-which-tool.md)),
  so pending stays true until all settle.

## The platform details that still apply

- **`formAction` as a string** is the plain HTML behaviour — a different URL for that
  button. Still available, still useful for a form that must work without JavaScript
  ([topic 11](11-progressive-enhancement.md)).
- **A function `formAction` forces POST**, exactly as a function `action` does
  ([topic 02](02-actions.md)) — the caveat names both.
- **`type="button"` submits nothing.** A button inside a form defaults to `type="submit"`;
  giving it `formAction` and `type="button"` produces a button that does nothing at all,
  with no error.
- **Validation still applies.** Constraint validation runs for whichever button submits
  ([topic 04](04-validation.md)), so a "Delete" button in a form with `required` fields will
  be blocked by them — which is usually wrong. Use `formNoValidate` on that button, or move
  the destructive action out of the form.

That last one is the bug this pattern most often produces: a delete button that refuses to
work because an unrelated field is empty.

## Gotchas

**Symptom:** a `formAction` button's returned value never appears.
**Cause:** `useActionState` is bound to one action; other `formAction` functions bypass it.
**Fix:** route through the one action with an intent field, or split the forms, or accept
that this action returns nothing.

**Symptom:** a Delete button is blocked because another field is `required`.
**Cause:** constraint validation runs for whichever button submits.
**Fix:** `formNoValidate` on that button, or move the destructive action out of the form.

**Symptom:** a button with `formAction` does nothing.
**Cause:** it has `type="button"`, so it does not submit.
**Fix:** leave it as the default `submit`.

**Symptom:** all buttons disable during one submission.
**Cause:** `useFormStatus().pending` is per-form, not per-action.
**Fix:** usually correct — it prevents concurrent submissions. Add per-button state only if
you genuinely need it.

**Symptom:** `method="get"` ignored on a `formAction` button.
**Cause:** a function `formAction` forces POST, same as a function `action`.
**Fix:** a string `formAction` for a real GET.

**Symptom:** two actions duplicate most of their logic.
**Cause:** they were one operation with a parameter, split into two.
**Fix:** the intent-field pattern is the right tool for that case.

## Interview questions

**★ How do you give one form two different submit behaviours?**
`formAction` on the button. React supports functions for both `action` and `formAction` on
`<form>`, `<input>` and `<button>`, and the button's `formAction` overrides the form's
`action` for that submission — same form, same `FormData`, different function. It replaces
the hidden intent field, giving each operation its own named function with no string
contract between markup and handler.

**★ How does that interact with `useActionState`?**
Badly, and knowingly. `useActionState` binds one action and returns one state and one
pending flag, so other `formAction` buttons bypass it entirely — their return values go
nowhere. The three options are: route everything through the single action and keep an
intent field (regaining one state plus sequential queueing at the cost of a switch); split
into separate forms with their own hooks; or use `formAction` functions and read pending
from `useFormStatus`, accepting that you lose per-action return values. They are not
designed to compose.

**★ When is the old intent-field pattern still right?**
When the buttons are the same operation with a different parameter — approve versus reject
hitting one endpoint with a different verdict — rather than genuinely different work.
Splitting those into two actions duplicates shared logic for nothing.

**★ What is the classic bug this pattern produces?**
A Delete button blocked by an unrelated `required` field, because constraint validation runs
for whichever button submits. `formNoValidate` on that button fixes it, or the destructive
action belongs outside the form. A close second is a button with `type="button"` and a
`formAction`, which does nothing at all and reports nothing.

**Is pending state per button or per form?**
Per form. `useFormStatus().pending` is the parent form's, so every button sees the same
value — which usually is what you want, since it stops a "save then publish" race. And
multiple ongoing Actions are batched, so it stays true until all of them settle.

---

← Prev: [`useOptimistic`](07-useoptimistic.md) ·
Index: [Phase 9](README.md) ·
Next → [Form reset semantics](09-form-reset.md)
