---
title: "⚠ useFormState"
sidebar_label: "13 · ⚠ useFormState"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — the
> [React v19 release post](https://react.dev/blog/2024/12/05/react-19):
> *"`React.useActionState` was previously called `ReactDOM.useFormState` in the Canary
> releases, but we've **renamed it and deprecated `useFormState`**."*
> ([PR #28491](https://github.com/react/react/pull/28491)) and react.dev
> [`useActionState`](https://react.dev/reference/react/useActionState).
> This project's own recorded export check lists **`useFormState` as still exported from
> `react-dom` in 19.2.8**.
> No sandbox script backs this page; claims are cited, not measured.

**`useFormState` is `useActionState`'s old name. It still exists, it is deprecated, and the
only reason this page exists is that a large share of the React 19 tutorials written in
2024–25 use the old name — so you will meet it, and you need to recognise it in two
seconds rather than debug it.**

## What happened

> `React.useActionState` was **previously called `ReactDOM.useFormState`** in the Canary
> releases, but we've **renamed it and deprecated `useFormState`.**

Two changes at once, which is why the migration is slightly more than a find-and-replace:

| | Old | New |
|---|---|---|
| Name | `useFormState` | `useActionState` |
| Package | **`react-dom`** | **`react`** |

So the import moves as well as the identifier:

```jsx
// ⚠ Deprecated
import { useFormState } from 'react-dom';
const [state, formAction] = useFormState(action, initialState);
```

```jsx
// ✅ Current
import { useActionState } from 'react';
const [state, formAction, isPending] = useActionState(action, initialState);
```

## The third return value

The most useful practical difference: **`useActionState` returns `isPending` and
`useFormState` does not.** Code written against the old API therefore usually carries a
hand-rolled pending flag, or reaches for `useFormStatus` in a child component purely to get
one ([topic 06](06-useformstatus.md)).

So a migration is often a simplification: take the third element and delete the workaround
that existed to substitute for it.

## Spotting it in the wild

Three tells, in the order you will notice them:

- **`import { useFormState } from 'react-dom'`** — the package is the giveaway. Anything
  form-state-shaped imported from `react-dom` is the old API.
- **A two-element destructure** where you expect three.
- **The date.** Material written between the React 19 canaries and the December 2024 release
  uses the old name throughout, often without noting it. That is a large fraction of the
  React 19 tutorials on the internet.

⚠️ **Do not confuse it with `useFormStatus`**, which is a *different, current* hook that also
lives in `react-dom` ([topic 06](06-useformstatus.md)). The names are one letter apart in
practice, both are in `react-dom`, and only one is deprecated. The distinction:

| | Package | Status | Gives you |
|---|---|---|---|
| `useFormState` | `react-dom` | ⚠️ **Deprecated** | The old `useActionState` |
| `useFormStatus` | `react-dom` | ✅ Current | The **parent** form's pending state |
| `useActionState` | `react` | ✅ Current | State, action and `isPending` |

## Migrating

The mechanical steps:

1. Change the import from `react-dom` to `react`.
2. Rename `useFormState` → `useActionState`.
3. Take the third return value and delete whatever was standing in for it.

React shipped codemods for the 19 upgrade, and the deprecation PR is
[#28491](https://github.com/react/react/pull/28491) — worth checking the current
`react-codemod` set rather than doing it by hand across a large codebase, since the import
move is the part a naive find-and-replace gets wrong.

⚠️ **Judgement:** deprecated is not removed, so there is no urgency for working code. But a
deprecated API in `react-dom` that was renamed *and* moved is unlikely to survive the next
major, and the migration is small enough that leaving it is a decision rather than a saving.

## Gotchas

**Symptom:** `useFormState is not exported from 'react'`.
**Cause:** the old hook is in `react-dom`; the new one is in `react`. Half the rename was
applied.
**Fix:** `useActionState` from `react`, or the old import from `react-dom` if you are not
migrating yet.

**Symptom:** a tutorial's code does not work as written.
**Cause:** it predates December 2024 and uses the canary-era name.
**Fix:** translate it — the semantics are the same, plus a third return value.

**Symptom:** `isPending` is `undefined`.
**Cause:** `useFormState` returns two values, not three.
**Fix:** migrate, and drop the hand-rolled pending flag it needed.

**Symptom:** `useFormStatus` is "migrated" to `useActionState` and stops working.
**Cause:** they are different hooks. Only `useFormState` is deprecated.
**Fix:** leave `useFormStatus` alone — it is current, and it reads the *parent* form.

**Symptom:** a deprecation warning after upgrading to React 19.
**Cause:** exactly this rename.
**Fix:** it still works; migrate when convenient.

## Interview questions

**★ What is `useFormState` and should you use it?**
It is `useActionState`'s old name from the React 19 canaries. React renamed it and
deprecated it, and it moved package as well — from `react-dom` to `react`. It still exports
from `react-dom` in 19.2.8, so old code keeps working, but new code should use
`useActionState`.

**★ What actually changes when you migrate?**
Three things: the import moves from `react-dom` to `react`, the identifier changes, and you
gain a third return value — `isPending` — which the old hook did not provide. That last one
usually means deleting a hand-rolled pending flag or a `useFormStatus` child that existed
only to supply one, so the migration is normally a simplification.

**★ How do you avoid confusing it with `useFormStatus`?**
By what they do rather than by their names. `useFormState` is the deprecated old name of
`useActionState` and lives in `react-dom`; `useFormStatus` is a **current** hook, also in
`react-dom`, that reports the **parent** form's pending state from a child component. Both
being in `react-dom` with near-identical names is precisely why the mistake happens — and
"migrating" `useFormStatus` breaks working code.

**Why does this deserve a page at all?**
Because of the documentation gap in the wild. Material written between the React 19 canaries
and the December 2024 release uses the old name throughout, usually without noting it, and
that is a large share of the React 19 tutorials available. Recognising `import { useFormState }
from 'react-dom'` on sight saves debugging code that was never wrong, only old.

---

← Prev: [Accessible forms](12-accessible-forms.md) ·
Index: [Phase 9](README.md) ·
Next → [Form libraries](14-form-libraries.md)
