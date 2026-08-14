---
title: "useFormStatus"
sidebar_label: "06 · useFormStatus"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)
> (definition, the status object, the full Caveats list, and the troubleshooting entry
> *`status.pending` is never `true`*) and
> [`useActionState`](https://react.dev/reference/react/useActionState).
> No sandbox script backs this page; claims are cited, not measured.

**A submit button can read its form's pending state without being told about it — no prop
drilling, no context. The price is one rule that trips up almost everyone the first time:
the hook reads the *parent* form, so it can never see a form rendered by the same
component.**

## The API

> `useFormStatus` is a Hook that gives you **status information of the last form
> submission.**

```js
const { pending, data, method, action } = useFormStatus();
```

> - **`pending`**: A boolean. If `true`, this means the **parent `<form>`** is pending
>   submission.
> - **`data`**: An object implementing the `FormData` interface that contains the data the
>   parent `<form>` is submitting. **If there is no active submission or no parent `<form>`,
>   it will be `null`.**
> - **`method`**: A string value of either `'get'` or `'post'` … By default, a `<form>` will
>   use the `GET` method.
> - **`action`**: A reference to the function passed to the `action` prop on the parent
>   `<form>`. **If there is a URI value provided to the `action` prop, or no `action` prop
>   specified, `status.action` will be `null`.**

Note it is imported from **`react-dom`**, not `react` — it is a DOM-specific hook, in the
same family as `useFormState` ([topic 13](13-useformstate.md)).

## 🔴 The parent rule

> The `useFormStatus` Hook **must be called from a component that is rendered inside a
> `<form>`.**

> `useFormStatus` will only return status information for a **parent** `<form>`. It will
> **not** return status information for any `<form>` rendered in that **same component or
> children components.**

```jsx
// 🔴 pending is always false — the form is in this component, not above it
function CommentForm() {
  const { pending } = useFormStatus();
  return (
    <form action={submit}>
      <button disabled={pending}>Post</button>
    </form>
  );
}
```

```jsx
// ✅ the button is a child component, so the form is its parent
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Posting…' : 'Post'}</button>;
}

function CommentForm() {
  return (
    <form action={submit}>
      <textarea name="text" />
      <SubmitButton />
    </form>
  );
}
```

The failure is silent — `pending` is simply always `false`, which the docs call out as its
own troubleshooting entry:

> If the component that calls `useFormStatus` is **not nested in a `<form>`**,
> `status.pending` will **always return `false`**. … `useFormStatus` will **not** track the
> status of a `<form>` rendered in the same component.

**The rule forces a component boundary**, and that is the design rather than a limitation:
the hook exists so a reusable `<SubmitButton>` can live in a design system, be dropped into
any form, and know its own pending state without a single prop. Extracting the button is
not a workaround — it is the shape the API is asking for.

## `useFormStatus` or `useActionState`?

Both give you pending state. They are not interchangeable:

| | `useFormStatus` | `useActionState` |
|---|---|---|
| Where it is called | A **child** of the form | The component that **owns** the form |
| What it gives | `pending`, `data`, `method`, `action` | `[state, formAction, isPending]` |
| Access to the result | ❌ None | ✅ The action's return value |
| Needs props threaded | ❌ No | — it is where the state lives |
| Typical user | A reusable submit button, a field that disables itself | The form's own logic — errors, values, success |

**They compose, and in a real form you usually use both**: `useActionState` at the form for
the returned errors and values, `useFormStatus` inside a shared button component so it does
not need `isPending` passed down.

Reaching for `useFormStatus` in the form component itself is the mistake — that is
`useActionState`'s job, and the hook will return `false` forever if you try.

## The other three fields

`pending` is the one everyone uses; the others have narrow but real uses.

**`data`** is the `FormData` being submitted, which lets a child render what is in flight —
*"Posting "the first comment"…"* — without the parent passing anything:

```jsx
function SubmitStatus() {
  const { pending, data } = useFormStatus();
  if (!pending) return null;
  return <p>Sending “{data?.get('text')}”…</p>;
}
```

That is a poor substitute for a real optimistic update, which is
[`useOptimistic`](07-useoptimistic.md) — but it is useful for a progress line naming the
file being uploaded.

**`method`** distinguishes a GET form from a POST one. Remember from
[topic 02](02-actions.md) that a **function** action is always POST regardless of the
`method` prop, so this is mostly informative for string-action forms.

**`action`** is `null` when the action is a URL string or absent — so *it being `null` does
not mean there is no form*, only that there is no function action. Do not use it as a
"am I inside a form?" test; `data` being `null` covers both "no parent form" and "no active
submission", which is also not a clean test.

## Gotchas

**Symptom:** `pending` is always `false`.
**Cause:** the hook was called in the same component that renders the `<form>`. It only
reads a **parent** form.
**Fix:** extract the button (or whatever reads it) into a child component.

**Symptom:** it works in one form and not another.
**Cause:** in the second, the calling component is not nested inside the `<form>` element —
being logically related is not enough.
**Fix:** it must be a descendant in the rendered tree.

**Symptom:** importing it from `react` fails.
**Cause:** it lives in `react-dom`.
**Fix:** `import { useFormStatus } from 'react-dom'`.

**Symptom:** `data` is `null` during what looks like a submission.
**Cause:** it is `null` when there is no active submission *or* no parent form — the two
are indistinguishable from this field alone.
**Fix:** use `pending` for the state; `data` only while pending.

**Symptom:** `action` is `null` on a form that clearly has one.
**Cause:** it is `null` for a string `action` or none at all — it only reflects a function
action.
**Fix:** do not use it to detect a form.

**Symptom:** a shared submit button needs `isPending` threaded through three layers.
**Cause:** using `useActionState`'s flag where `useFormStatus` was the tool.
**Fix:** read it in the button itself. Removing that prop is the point of the hook.

## Interview questions

**★ What does `useFormStatus` do, and what is its one hard rule?**
It gives a component the status of its **parent** `<form>` — `pending`, the `data` being
submitted, the `method`, and the function `action`. The rule is that it must be called from
a component rendered *inside* the form, and it will never report on a form rendered by the
same component. Break it and `pending` is silently `false` forever, which the docs list as
its own troubleshooting entry.

**★ Why is that rule a design rather than a limitation?**
Because it forces the component boundary that makes the hook useful. A reusable
`<SubmitButton>` in a design system can be dropped into any form and know its own pending
state with no props at all. Extracting the button is what the API is asking for, not a
workaround.

**★ When do you use it instead of `useActionState`?**
When you need pending state somewhere that does not own the form — a shared submit button,
a field that disables itself. `useActionState` is called by the component that owns the
form and is the only one of the two that gives you the action's **return value**, so errors
and returned values come from there. In a real form you typically use both.

**★ What are `data`, `method` and `action` for?**
`data` is the `FormData` in flight, so a child can name what is being submitted without any
prop — useful for an upload progress line, though a real optimistic update is
`useOptimistic`. `method` distinguishes GET from POST, which matters little because a
function action is always POST. `action` is the function passed to the form, and is `null`
for a string action or none — so it is not a test for "am I in a form".

**Where is it imported from, and why does that matter?**
`react-dom`, not `react`, because it is DOM-specific. It is in the same family as the
deprecated `useFormState`, which is one reason the two get confused — but they do different
things, and only one of them is deprecated.

---

← Prev: [Uncontrolled forms and `FormData`](05-uncontrolled-and-formdata.md) ·
Index: [Phase 9](README.md) ·
Next → [`useOptimistic`](07-useoptimistic.md)
