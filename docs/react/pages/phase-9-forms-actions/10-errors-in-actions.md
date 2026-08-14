---
title: "Errors in actions"
sidebar_label: "10 · Errors in actions"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useActionState`](https://react.dev/reference/react/useActionState) (*"If the dispatch
> throws an error, React cancels all queued actions and shows the nearest Error
> Boundary"*), [`useTransition`](https://react.dev/reference/react/useTransition)
> (*Displaying an error to users with an error boundary*),
> [`<form>`](https://react.dev/reference/react-dom/components/form) (the reset-on-success
> rule), and
> [`Component`](https://react.dev/reference/react/Component) (error boundaries).
> No sandbox script backs this page; claims are cited, not measured.

**An action can fail two ways, and React treats them completely differently. Throwing hands
the subtree to an error boundary and cancels everything queued behind it; returning puts the
failure in state and leaves the form standing. Choosing between them is the design decision
of this phase — and the default most people fall into is the wrong one.**

## The two paths

| | **Throw** | **Return** |
|---|---|---|
| Where it lands | The nearest **error boundary** | `state` from `useActionState` |
| The form | **Unmounted** with its subtree | Still there |
| The user's input | **Lost** | Available — if you returned it |
| Queued actions | **All cancelled** | Unaffected |
| Recovery | Needs a boundary reset or remount | The next submission |
| Field-level messages | Impossible | Natural |

Both are documented behaviours, not accidents:

> If the dispatch **throws an error**, React **cancels all queued actions** and shows the
> **nearest Error Boundary.**

> If a function passed to `startTransition` throws an error, you can display an error to
> your user with an **error boundary** … Once the function passed to `startTransition`
> errors, **the fallback for the error boundary will be displayed.**

## 🔴 Why throwing is usually wrong for a form

The instinct from ordinary async code is to `throw` on failure and catch it somewhere
central. In an action that produces four consequences at once:

1. **The form disappears.** The error boundary replaces the subtree, so the user sees an
   error screen instead of the form they were filling in.
2. **Their input is gone with it.** Not merely cleared — unmounted. There is no state to
   restore from.
3. **Queued submissions are cancelled.** A user who pressed the button twice loses the
   second attempt as well.
4. **Recovery needs machinery.** Nothing clears a boundary's error state automatically
   ([Phase 8 · 16](../phase-8-concurrent-suspense/16-error-boundaries-and-suspense.md)) —
   you need a retry control or a `key` remount, and the remount discards the form anyway.

For "the email address is already taken", every one of those is a disproportionate response.

## The returning shape

```jsx
async function saveProfile(previousState, formData) {
  const values = Object.fromEntries(formData);

  const errors = validate(values);
  if (errors) return { status: 'invalid', errors, values };

  try {
    const saved = await api.save(values);
    return { status: 'ok', saved };
  } catch (err) {
    if (err instanceof ConflictError) {
      return { status: 'invalid', errors: { email: 'Already registered' }, values };
    }
    throw err;                    // ← genuinely unexpected: let the boundary have it
  }
}
```

Three things make this the shape to copy:

- **A discriminated `status`** rather than a bare `error` field, so the component renders one
  of a fixed set of states instead of inspecting several optional properties.
- **`values` returned on every failure path.** React resets uncontrolled fields when the
  action *succeeds*, and returning counts as success
  ([topic 09](09-form-reset.md)) — so without the values, a validation failure also wipes
  the form.
- **A deliberate re-throw.** Catching *everything* is as wrong as catching nothing: a
  genuine bug — a null dereference, a broken serializer — should reach the boundary and be
  reported, not be rendered as "something went wrong" next to a field.

## The rule

**Expected outcomes are values. Unexpected failures are exceptions.**

| Failure | Expected? | Path |
|---|---|---|
| Validation failed | ✅ Yes | **Return** |
| Duplicate email, item already deleted, insufficient funds | ✅ Yes — the server said no, correctly | **Return** |
| Not authorised for this action | ✅ Usually | **Return**, or redirect |
| Network request failed / timed out | ⚠️ Depends | **Return** if retrying in place is useful |
| 500, malformed response, a bug in your code | 🔴 No | **Throw** |
| Session expired | 🔴 Arguably not recoverable in place | **Throw**, or redirect |

The test: **can the user do something useful on this screen in response?** If yes, they need
the screen — so return. If no, the boundary is the honest answer.

## The boundary is still required

Returning for expected failures does not mean you can omit the error boundary. An action
runs your code, and your code can have bugs; without a boundary the throw removes the UI
entirely —

> By default, if your application throws an error during rendering, **React will remove its
> UI from the screen.**

— and the docs place it deliberately:

> To use an error boundary, wrap the **component where you are calling the `useTransition`**
> in an error boundary.

For a form, that means around the form's owner. **Return for the expected, boundary for the
rest** is one policy with two halves, not a choice between two policies.

## Errors that are not the action's

Two failure sources this page does not cover, and both catch people out:

- **Errors in event handlers are not caught by boundaries at all**
  ([Phase 8 · 16](../phase-8-concurrent-suspense/16-error-boundaries-and-suspense.md)). A
  form action *is* covered — the transition function is the documented exception to the
  async exclusion — but an `onClick` that throws is not.
- **A rejected promise you never awaited** inside an action escapes the action's own error
  handling. `await` everything you start, or the failure surfaces as an unhandled rejection
  with no connection to the form.

## Gotchas

**Symptom:** a duplicate-email error replaces the whole form with an error screen.
**Cause:** the action threw, so the nearest error boundary took the subtree.
**Fix:** return the failure as state. Expected outcomes are values.

**Symptom:** a user who double-clicked loses their second submission after one fails.
**Cause:** a thrown error cancels **all** queued actions.
**Fix:** returning does not cancel anything.

**Symptom:** returning an error clears the form.
**Cause:** returning is success, and success resets uncontrolled fields.
**Fix:** return `values` on every failure path and render them as `defaultValue`.

**Symptom:** a real bug is rendered as a friendly field-level message.
**Cause:** a `catch` that swallows everything.
**Fix:** re-throw what you did not expect, so it reaches the boundary and your reporting.

**Symptom:** an error boundary is never reached even though the action throws.
**Cause:** the boundary is not above the component calling `useTransition`/`useActionState`.
**Fix:** wrap the form's owner.

**Symptom:** the app dies on an error thrown from a button's `onClick`.
**Cause:** error boundaries do not catch event-handler errors; only the transition function
is excepted.
**Fix:** `try`/`catch` in the handler.

**Symptom:** a failure appears as an unhandled rejection unrelated to the form.
**Cause:** a promise started inside the action but never awaited.
**Fix:** `await` everything the action starts.

## Interview questions

**★ What happens if an action throws, versus returns an error?**
Throwing shows the nearest error boundary, unmounts the form with everything the user
typed, and **cancels all queued actions** — so a second submission behind it is discarded
too. Returning puts the failure in `useActionState`'s state, leaves the form mounted, and
lets you render a message beside the field that caused it. They are different behaviours by
design, not two spellings of the same thing.

**★ Which should a validation failure use, and why?**
Return. It is an expected outcome the user can act on, and every consequence of throwing is
disproportionate to it: the form vanishes, the input is lost with the subtree, queued
submissions are cancelled, and recovery needs a retry control or a remount that discards
the form anyway.

**★ What is the rule for choosing?**
Expected outcomes are values; unexpected failures are exceptions. The practical test is
whether the user can do something useful on this screen in response — if yes they need the
screen, so return; if no, the boundary is honest. A 409 conflict returns; a 500 or a null
dereference throws.

**★ Does returning errors mean you can skip the error boundary?**
No — it is one policy with two halves. Your action runs your code and your code can have
bugs, and without a boundary a throw removes the UI from the screen entirely. The docs place
it around the component calling `useTransition`, which for a form means the form's owner.

**What is wrong with catching everything inside the action?**
It renders genuine bugs as friendly field-level messages, so a null dereference or a broken
serializer looks like a validation problem and never reaches your error reporting. Catch
what you expect, convert it to state, and re-throw the rest.

**Are all form-related errors covered by boundaries?**
No. The transition function is the documented exception to the rule that async code is not
caught — so an action's throw is covered — but an ordinary event handler's is not, and a
promise started inside an action and never awaited escapes entirely as an unhandled
rejection.

---

← Prev: [Form reset semantics](09-form-reset.md) ·
Index: [Phase 9](README.md) ·
Next → [Progressive enhancement](11-progressive-enhancement.md)
