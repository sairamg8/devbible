---
title: "Form reset semantics"
sidebar_label: "09 · Form reset semantics"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<form>`](https://react.dev/reference/react-dom/components/form) (*"After the `action`
> function succeeds, all uncontrolled field elements in the form are reset"*) and the
> [React v19 release post](https://react.dev/blog/2024/12/05/react-19) — *"When a `<form>`
> Action succeeds, React will automatically reset the form for uncontrolled components. If
> you need to reset the `<form>` manually, you can call the new `requestFormReset` React
> DOM API."*
> ⚠️ **The `requestFormReset` reference page returned 404 when this page was written**, so
> its details below are attributed to the release post and to React's own pull requests
> ([#28804](https://github.com/facebook/react/pull/28804),
> [#28809](https://github.com/facebook/react/pull/28809)) rather than to a reference page.
> No sandbox script backs this page; claims are cited, not measured.

**React clears the form for you when an action succeeds. That is right often enough to be
the default and wrong often enough to need knowing — and the three words that decide which
are "succeeds", "uncontrolled" and "all".**

## The rule

> **After the `action` function succeeds, all uncontrolled field elements in the form are
> reset.**

> When a `<form>` Action **succeeds**, React will automatically reset the form **for
> uncontrolled components.**

### "succeeds"

An action that **returns** has succeeded, whatever it returned. An action that **throws**
has not.

That single distinction produces the most consequential behaviour in the phase:

| The action | Form | Consequence |
|---|---|---|
| Returns normally | **Reset** | Even if it returned `{ error: '…' }` |
| Throws | **Not reset** | The error boundary takes the subtree anyway |

So returning a validation error clears the form. This is why
[topic 04](04-validation.md) insists on returning the submitted **values** alongside the
errors and feeding them back as `defaultValue` — without that, "you typed an invalid email"
also means "and I have deleted everything you wrote".

### "uncontrolled"

React resets DOM fields it is not driving. A controlled field's value comes from your state
([topic 01](01-controlled-inputs/README.md)), so React cannot clear it without changing your
state, and it does not try.

**A mixed form therefore half-resets** — the uncontrolled fields blank, the controlled ones
keep their values, which looks like a bug and is not. Either commit to one model per form,
or clear the controlled state yourself in the action's aftermath.

### "all"

Every uncontrolled field, not the ones you consider transient. For a "add another item"
form, that often includes a category select, a project picker or a date the user set once
and expects to reuse. **Losing those is a real usability regression** introduced by an
otherwise welcome default.

## `requestFormReset`

> If you need to reset the `<form>` **manually**, you can call the new **`requestFormReset`**
> React DOM API.

⚠️ From React's own pull requests rather than a reference page: it schedules the reset to
happen when the current transition completes, which is the same timing React uses
internally — after the DOM mutations caused by the transition have been applied — and it
affects **uncontrolled** inputs only. It was made public so **UI libraries can build their
own action-based APIs and keep the reset behaviour**.

The timing is the reason it exists rather than `form.reset()`. Calling `form.reset()`
yourself resets immediately, which is the wrong moment during a transition: the transition's
DOM changes have not been applied yet, so the reset can be undone or land against the wrong
tree. `requestFormReset` defers it to the point React would have chosen.

```jsx
import { requestFormReset } from 'react-dom';

// inside an action, in a transition
requestFormReset(formElement);
```

**When you actually need it:** you are building the action-based API yourself — a custom
`<Form>` component in a design system that takes an action prop, does its own work, and
should still behave like a React form. That is the documented motivation, and it is a
narrower audience than the API's prominence suggests.

## Opting out

There is no `resetOnSuccess={false}` prop. The practical routes, ⚠️ **judgement rather than
documentation**:

**1. Control the fields you want to keep.** React resets only uncontrolled ones, so a
controlled category select survives. Precise, and it costs state for exactly those fields.

**2. Return the values and re-render them as `defaultValue`.** The same mechanism topic 04
uses for validation errors — the reset happens, and the next render puts the values back.
Note this is a *re-fill*, not a *non-reset*: focus and scroll position are not restored.

**3. Remount the form with a `key`.** The opposite lever — force a full reset when React
would not have done one, for instance after a *failed* action where you do want a clean
slate ([Phase 3 · 07](../phase-3-state/07-resetting-state-with-key.md)).

**4. Do not use a form action.** An `onSubmit` handler has none of this behaviour, and
gives up everything else in this phase along with it. Rarely the right trade.

## The interaction people miss

**A successful action resets the form, but does not reset `useActionState`'s state.** The
hook's state is whatever the action last returned, and it persists until the next
submission. So after a success:

- the fields are blank;
- `state` still holds the previous result — including, if you are not careful, a success
  message that now sits above an empty form indefinitely, or a stale error.

Returning a fresh, clean state on success (`{ errors: {}, values: {} }`) rather than
mutating or partially updating the old one is what keeps the two in step. The reducer shape
makes that easy to forget, because returning *something* is enough for React.

## Gotchas

**Symptom:** a validation failure clears everything the user typed.
**Cause:** returning an error is a success, and success resets uncontrolled fields.
**Fix:** return the values too and render them as `defaultValue`.

**Symptom:** only some fields clear.
**Cause:** React resets uncontrolled fields only; controlled ones are driven by your state.
**Fix:** one model per form, or clear the controlled state yourself.

**Symptom:** a field the user wanted to reuse — a category, a date — is cleared each time.
**Cause:** "all uncontrolled field elements" includes it.
**Fix:** control that field specifically, so it survives.

**Symptom:** `form.reset()` inside an action behaves erratically.
**Cause:** it resets immediately, before the transition's DOM mutations are applied.
**Fix:** `requestFormReset`, which defers to the correct point in the transition.

**Symptom:** a success message stays on screen above an empty form forever.
**Cause:** the form was reset; `useActionState`'s state was not.
**Fix:** return a clean state, and clear the message deliberately.

**Symptom:** a thrown error leaves the form populated but the subtree is gone.
**Cause:** throwing skips the reset and hands the subtree to the error boundary.
**Fix:** return expected failures instead of throwing them.

**Symptom:** a custom `<Form>` wrapper loses the reset behaviour.
**Cause:** it is doing its own submission handling.
**Fix:** `requestFormReset` — that is the documented reason it is public.

## Interview questions

**★ When exactly does React reset a form, and what does it reset?**
After the action **succeeds**, and it resets **all uncontrolled** field elements. Each word
matters: an action that returns has succeeded whatever it returned — including an error
object — so returning a validation error clears the form; controlled fields are driven by
your state so React does not touch them, meaning a mixed form half-resets; and "all"
includes fields the user meant to reuse.

**★ Why does that make returning the submitted values mandatory for validation?**
Because the validation failure path is a success path as far as the reset is concerned. If
the action returns only errors, the fields are blanked — so the user is told they made a
small mistake and simultaneously loses everything they wrote. Returning the values and
rendering them as `defaultValue` puts them back.

**★ What is `requestFormReset` for, and why not `form.reset()`?**
It schedules the reset for when the current transition completes — the same timing React
uses internally, after the transition's DOM mutations are applied — and it affects
uncontrolled inputs only. `form.reset()` fires immediately, which during a transition is the
wrong moment and can be undone or land against the wrong tree. It was made public so UI
libraries can build their own action-based APIs and keep the reset behaviour, which is a
narrower audience than its prominence suggests.

**★ How do you keep one field's value across submissions?**
Make that field controlled. React resets only uncontrolled fields, so a controlled category
select or date survives while everything else clears. The alternative — returning its value
and re-filling it — works but is a re-fill rather than a non-reset, so focus and scroll are
not preserved.

**What is the interaction between the reset and `useActionState`?**
They are independent. A successful action clears the fields but leaves the hook's state as
whatever the action returned, which persists until the next submission — so a success
message can end up sitting above an empty form indefinitely, or a stale error can linger.
Returning a clean state on success is what keeps them in step.

---

← Prev: [Multiple actions in one form](08-multiple-actions.md) ·
Index: [Phase 9](README.md) ·
Next → [Errors in actions](10-errors-in-actions.md)
