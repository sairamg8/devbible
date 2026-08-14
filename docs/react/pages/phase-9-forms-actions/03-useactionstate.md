---
title: "useActionState"
sidebar_label: "03 · useActionState"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useActionState`](https://react.dev/reference/react/useActionState) (definition,
> signature, parameters, returns, the full Caveats list, and the note that the dispatch
> must be called from an Action) and
> [`<form>`](https://react.dev/reference/react-dom/components/form).
> No sandbox script backs this page; claims are cited, not measured.

**One hook returns the form's result, its submit handler and its pending flag. It replaces
the four `useState` calls every form used to need — data, error, loading, submitted — and
the reason it can is that its action is shaped like a reducer.**

## The API

> `useActionState` is a React Hook that lets you **update state with side effects using
> Actions.**

```js
const [state, formAction, isPending] = useActionState(action, initialState, permalink?);
```

> 1. **The current state** — Initially matches the `initialState` you passed. After the
>    dispatch is invoked, it matches the value **returned by** the action.
> 2. **The dispatch function** — Call this inside Actions to trigger the action.
> 3. **The `isPending` flag** — Tells you if any dispatched Actions for this Hook are
>    pending.

And the parameter that makes it a reducer:

> It receives the **previous state** (initially the `initialState`, then **its previous
> return value**) as its **first argument**, followed by the payload passed to the
> dispatch.

```jsx
function CommentForm() {
  const [state, formAction, isPending] = useActionState(submitComment, { error: null });

  return (
    <form action={formAction}>
      <textarea name="text" defaultValue={state.text} />
      {state.error && <p role="alert">{state.error}</p>}
      <button disabled={isPending}>{isPending ? 'Posting…' : 'Post'}</button>
    </form>
  );
}

async function submitComment(previousState, formData) {
  const text = formData.get('text');
  if (!text?.trim()) return { error: 'Comment cannot be empty', text };
  try {
    await postComment(text);
    return { error: null };
  } catch {
    return { error: 'Could not post. Try again.', text };   // ← keeps what they typed
  }
}
```

**Note the signature of the action changes.** A plain `<form action>` receives only
`FormData` ([topic 02](02-actions.md)); once wrapped in `useActionState`, it receives
`(previousState, formData)`. Forgetting that is the most common first mistake — `formData`
lands in the second parameter and the first looks like a broken `FormData` object.

## Why it is a reducer, and what that buys

The shape `(previousState, payload) => nextState` is `useReducer`'s
([Phase 5 · 03](../phase-5-refs-context-reducers/03-usereducer.md)) with an async action in
the middle. That is not a coincidence, and it earns a real guarantee:

> React **queues and executes multiple calls sequentially.** Each call to the action
> receives the **result of the previous call.**

This is the request-ordering promise Phase 8 pointed at
([Phase 8 · 09](../phase-8-concurrent-suspense/09-async-transitions.md): *"These solutions
handle request ordering for you"*). Double-submit a form and you do not get two racing
requests whose responses may arrive out of order — you get two sequential runs, the second
seeing the first's result. **A hand-rolled async transition gives you neither.**

Having the previous state also makes retry logic natural: an action can count attempts,
preserve fields the user already filled, or merge new errors into old ones, without any
state outside the hook.

## The three returned values, precisely

**`state` is whatever your action returned.** There is no convention imposed — return a
string, an error object, the created record, a discriminated union. This is where
[validation errors](04-validation.md) come back, and why *returning* an error behaves so
differently from throwing one ([topic 10](10-errors-in-actions.md)).

**`formAction` goes straight into `<form action>`.** It is also stable:

> The dispatch function has a **stable identity**, so you will often see it omitted from
> Effect dependencies, but **including it will not cause the Effect to fire.**

**`isPending` covers the hook's own actions.** It inherits Phase 8's scope — true until the
final state is shown, not merely while the request is in flight — so it is the whole
submission, and a separate `isSubmitting` is redundant.

> If there are **multiple ongoing Actions, React batches them together.**

Same caveat as transitions generally, with the same consequence: `isPending` stays true
until all of them settle.

## 🔴 The dispatch must be called from an Action

> **The dispatch must be called from an Action.** You can wrap it in `startTransition`, or
> pass it to an Action prop. **Calls outside that scope won't be treated as part of the
> Transition and will log an error in development mode.**

Passing it to `<form action={formAction}>` satisfies this automatically, which is why the
common case needs no thought. Calling it directly from a click handler does not:

```jsx
// 🔴 outside an Action — logs an error in development
<button onClick={() => formAction(payload)}>Save</button>

// ✅ inside a transition
<button onClick={() => startTransition(() => formAction(payload))}>Save</button>
```

Unlike the post-`await` limitation, this one **does** warn — in development. Worth knowing
which failures are silent and which are not.

## Errors cancel the queue

> If the dispatch **throws an error**, React **cancels all queued actions** and shows the
> **nearest Error Boundary.**

Two things at once. The error boundary part matches everything else about Actions. The
*cancellation* part is specific to this hook and is the strongest argument for returning
errors rather than throwing them: a throw does not merely fail one submission, it discards
every queued action behind it — so in a form the user submitted twice, the second
submission disappears too.

## `permalink`, and honest scope

> **`permalink`** (optional): A string containing the unique page URL that this form
> modifies. For use on **pages with React Server Components with progressive
> enhancement.** If the action is a **Server Function** and the form is submitted **before
> the JavaScript bundle loads**, the browser will **navigate to the specified permalink
> URL** rather than the current page's URL.

> When using the `permalink` option, ensure **the same form component is rendered on the
> destination page** (including the same action and permalink) so React knows how to pass
> the state through. **Once the page becomes interactive, this parameter has no effect.**

So it exists for one narrow situation: a pre-hydration submission needs somewhere to land,
and the destination must render the same form so the returned state can be displayed.
Outside RSC with Server Functions it does nothing. [Topic 11](11-progressive-enhancement.md)
puts it in context.

And the constraint that follows from crossing the network:

> When using Server Functions, **`initialState` needs to be serializable** (plain objects,
> arrays, strings, numbers).

## Gotchas

**Symptom:** `formData.get` is not a function inside the action.
**Cause:** wrapped in `useActionState`, the action receives `(previousState, formData)` —
`formData` is the **second** argument.
**Fix:** add the previous-state parameter.

**Symptom:** the form clears on a failed submission and the user loses their text.
**Cause:** React resets uncontrolled fields when the action **succeeds**, and returning an
error counts as success.
**Fix:** return the submitted values in the state and feed them back as `defaultValue`.

**Symptom:** a throw in one submission also loses a second queued submission.
**Cause:** a thrown error cancels all queued actions and shows the nearest error boundary.
**Fix:** return errors for anything expected; reserve throwing for the genuinely broken.

**Symptom:** "must be called from an Action" logged in development.
**Cause:** the dispatch was called outside a transition — typically from a click handler.
**Fix:** pass it to `<form action>`, or wrap the call in `startTransition`.

**Symptom:** double-clicking submit produces two racing requests.
**Cause:** it should not — React queues them sequentially, each seeing the previous result.
**Fix:** if you see racing, the submission is not going through this hook.

**Symptom:** `isPending` stays true longer than one submission.
**Cause:** multiple ongoing actions are batched together.
**Fix:** documented behaviour, same as transitions generally.

**Symptom:** `permalink` appears to do nothing.
**Cause:** it only applies to a Server Function submitted before hydration, and has no
effect once the page is interactive.
**Fix:** expected outside that scenario.

## Interview questions

**★ What does `useActionState` return, and how does the action's signature change?**
`[state, formAction, isPending]` — the state is whatever the action returned, the second
value goes into `<form action>`, and the flag covers this hook's actions. The action itself
becomes reducer-shaped: it receives the **previous state** as its first argument and the
`FormData` as its second, where a plain form action receives only `FormData`. Missing that
is the classic first bug.

**★ Why is the reducer shape more than an aesthetic choice?**
Because React queues multiple dispatches and executes them sequentially, with each call
receiving the result of the previous one. That is the request ordering React's docs point
to when they say the built-in abstractions handle it for you — a double submit becomes two
sequential runs rather than two racing requests with responses that may arrive out of
order. It also makes retry and field-preservation logic natural, since the previous state is
already in hand.

**★ What is the difference between returning an error and throwing one here?**
Returning puts the error in `state`, keeps the component mounted and lets you feed the
submitted values back into the form. Throwing cancels **all queued actions** and shows the
nearest error boundary — so it does not just fail this submission, it discards any queued
behind it, and the user loses the subtree. Return for expected failures; throw only for the
genuinely broken.

**★ Where may the dispatch function be called from?**
Only from within an Action — passed to an Action prop such as `<form action>`, or wrapped
in `startTransition`. Calls outside that scope are not part of the transition and log an
error in development. That is one of the few failures in this area that actually warns; the
post-`await` transition limitation does not.

**What is `permalink` for?**
A narrow progressive-enhancement case: with React Server Components and a Server Function
action, a form submitted before the JavaScript bundle loads navigates to that URL instead
of the current one. The destination must render the same form component, with the same
action and permalink, so React can pass the state through — and once the page is
interactive the parameter has no effect at all.

**Why does a failed submission still clear the form?**
Because React resets uncontrolled fields after the action **succeeds**, and an action that
returns an error object has succeeded as far as React is concerned. The fix is to return
the submitted values in the state and render them as `defaultValue`, which is also why the
error and the values usually travel together.

---

← Prev: [Actions](02-actions.md) ·
Index: [Phase 9](README.md) ·
Next → [Validation](04-validation.md)
