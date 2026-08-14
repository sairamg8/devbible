---
title: "Actions"
sidebar_label: "02 · Actions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<form>`](https://react.dev/reference/react-dom/components/form) (the `action` prop in
> both forms, what React does with a function action, the caveats, `formAction`, and the
> progressive-enhancement note) and
> [`useTransition`](https://react.dev/reference/react/useTransition) (Actions).
> No sandbox script backs this page; claims are cited, not measured.

**Pass a function to `<form action>` and React does four things you used to write by hand:
calls it with the form's `FormData`, runs it in a transition, tracks pending state, and
resets the uncontrolled fields when it succeeds. That is the whole feature, and each of the
four replaces a specific piece of boilerplate.**

## The two forms of `action`

> **When a URL is passed to `action` the form will behave like the HTML form component.**

> **When a function is passed to `action` the function will handle the form submission in a
> Transition** following the Action prop pattern. The function passed to `action` **may be
> async** and will be **called with a single argument containing the form data** of the
> submitted form.

So `action` is overloaded on purpose: a string is the platform behaviour, a function is
React's. There is no `onSubmit`, no `e.preventDefault()`, and no reading of individual
refs.

```jsx
function CommentForm() {
  async function submitComment(formData) {
    const text = formData.get('text');
    await postComment(text);
  }

  return (
    <form action={submitComment}>
      <textarea name="text" />
      <button type="submit">Post</button>
    </form>
  );
}
```

Compare what this replaces: an `onSubmit` handler, `preventDefault`, a `useState` per
field, an `isSubmitting` flag, a manual reset, and — if it was done properly — a transition
wrapping the state update. **All four of React's behaviours below are things that code was
doing badly.**

## The four things React does

### 1. It calls the function with `FormData`

The argument is a `FormData` object built from the form, keyed by each control's **`name`**
attribute. That makes `name` the contract
([topic 05](05-uncontrolled-and-formdata.md)) and means the form needs **no state at all**
for fields you only read on submit — which is the argument
[topic 01](01-controlled-inputs/README.md) ends on.

It also means file inputs work with no special handling, which matters because they are the
one input type that cannot be controlled
([topic 01 · 02](01-controlled-inputs/02-every-input-type.md)).

### 2. It runs in a transition

> The submission runs in a **Transition**.

Everything from [Phase 8](../phase-8-concurrent-suspense/09-async-transitions.md) applies
unchanged, and this is where "Actions are transitions wearing a form" stops being a slogan:

- The submission is **non-blocking** — the UI stays responsive while it runs.
- Pending state is a **transition's** pending state, which is what
  [`useActionState`](03-useactionstate.md) and [`useFormStatus`](06-useformstatus.md)
  expose.
- **Suspense fallbacks are suppressed** for already-revealed content
  ([Phase 8 · 11](../phase-8-concurrent-suspense/11-suspense-inside-a-transition.md)), so a
  submission does not blank the screen.
- A **thrown** error reaches the nearest error boundary
  ([Phase 8 · 16](../phase-8-concurrent-suspense/16-error-boundaries-and-suspense.md)),
  which is the distinction [topic 10](10-errors-in-actions.md) turns into a design
  decision.

⚠️ **The post-`await` limitation applies here too.** React wraps *your function* in a
transition; state updates you make **after an `await` inside it** are not automatically part
of that transition and need their own `startTransition`
([Phase 8 · 09](../phase-8-concurrent-suspense/09-async-transitions.md)). This is the same
silent failure, in a place where it is easy to assume the framework has handled it.

### 3. It tracks pending state

You do not create it, and you should not duplicate it. `isPending` from
`useActionState`, or `pending` from `useFormStatus` inside the form, is the one source of
truth — and per Phase 8 it stays true from the first moment *until the final state is shown
to the user*, not merely while the request is in flight.

### 4. 🔴 It resets uncontrolled fields on success

> **After the `action` function succeeds, all uncontrolled field elements in the form are
> reset.**

Three words in that sentence do a lot of work:

- **"succeeds"** — a rejected action does not reset, so a failed submission keeps what the
  user typed. That is the correct default and it is why *returning* an error rather than
  throwing preserves the form ([topic 10](10-errors-in-actions.md)).
- **"uncontrolled"** — controlled fields are driven by your state, so React cannot and does
  not clear them. A form that mixes both will half-reset, which surprises people.
- **"all"** — including fields you wanted to keep, such as a category selector the user
  will reuse for the next entry. That is [topic 09](09-form-reset.md) and
  `requestFormReset`.

## The caveat with real consequences

> When a function is passed to `action` or `formAction` **the HTTP method will be POST
> regardless of value of the `method` prop.**

So `method="get"` is ignored once the action is a function. If you actually want a GET
form — a search that puts its query in the URL, is bookmarkable and shareable — **do not
use a function action.** Use a string `action` and let the platform do it; that is what the
string form is for, and it is a legitimate choice rather than a fallback.

## `formAction` overrides it

> The `action` prop **can be overridden by a `formAction` attribute** on a `<button>`,
> `<input type="submit">`, or `<input type="image">` component.

Which is how one form gets a Save button and a Delete button without a hidden field
carrying an "intent" value. [Topic 08](08-multiple-actions.md) covers the pattern and how
it interacts with `useActionState`.

## Progressive enhancement, precisely

> When `<form>` is rendered by a **Server Component**, and a **Server Function** is passed
> to the `<form>`'s `action` prop, the form is **progressively enhanced**. Passing a Server
> Function to `<form action>` allows users to **submit forms without JavaScript enabled or
> before the code has loaded.**

Read the conditions carefully, because this is the most over-claimed part of the feature:
**a Server Component rendering the form, and a Server Function as the action.** A plain
client-side function action does not give you this — before hydration there is nothing to
call it.

The second clause is the one that matters even for users with JavaScript: *"or before the
code has loaded"*. A form that works during the gap between HTML arriving and JavaScript
hydrating is better on a slow connection for everyone, not only for the small share of
users who have scripting disabled. [Topic 11](11-progressive-enhancement.md) covers what it
costs and what it requires.

## Gotchas

**Symptom:** `e.preventDefault()` is called in an action and things break.
**Cause:** an action is not a submit handler and receives `FormData`, not an event.
**Fix:** remove it. React already handles the default submission.

**Symptom:** `formData.get('x')` is `null`.
**Cause:** the control has no `name`, or the name differs. `FormData` is keyed by `name`,
not by `id`.
**Fix:** add the `name`. This is the contract.

**Symptom:** the form clears after a failed submission and the user loses their text.
**Cause:** the action succeeded as far as React is concerned — it returned rather than
threw — so uncontrolled fields were reset.
**Fix:** signal failure deliberately. Returning an error state and repopulating is topic
10's subject.

**Symptom:** only some fields reset.
**Cause:** React resets **uncontrolled** fields; controlled ones are driven by your state.
**Fix:** pick one model per form, or reset your state explicitly.

**Symptom:** `method="get"` is ignored and the request is a POST.
**Cause:** documented — a function action is always POST.
**Fix:** use a string `action` for a real GET form.

**Symptom:** state set after an `await` inside an action blanks the screen.
**Cause:** the post-`await` transition limitation applies inside actions too.
**Fix:** wrap it in `startTransition`. It fails silently.

**Symptom:** a form does not work with JavaScript disabled despite using `action`.
**Cause:** progressive enhancement requires a Server Component rendering it **and** a
Server Function as the action.
**Fix:** both conditions, or accept that it is a client-only form.

## Interview questions

**★ What does React do when you pass a function to `<form action>`?**
Four things. It calls the function with the form's `FormData`. It runs the submission in a
transition. It tracks the pending state for you. And after the action succeeds, it resets
all uncontrolled field elements in the form. Each replaces a piece of boilerplate — the
`onSubmit` plus `preventDefault`, the state per field, the `isSubmitting` flag, and the
manual reset.

**★ What does "Actions are transitions" buy you concretely?**
The submission is non-blocking, its pending state is a transition's pending state — true
until the final state is shown, not just while the request is in flight — Suspense
fallbacks stay suppressed so the screen does not blank, and a thrown error reaches the
nearest error boundary. It also means the post-`await` limitation applies: a state update
after an `await` inside your action is not automatically part of the transition and needs
its own `startTransition`.

**★ Exactly what gets reset, and when?**
All **uncontrolled** field elements, and only after the action **succeeds**. Controlled
fields are driven by your state, so React cannot clear them — which means a mixed form
half-resets. And because a failure does not reset, returning an error rather than throwing
is what preserves what the user typed.

**★ What are the real conditions for progressive enhancement?**
The form must be rendered by a Server Component *and* be given a Server Function as its
action. Then it submits without JavaScript enabled or before the code has loaded. A plain
client-side function action gives you neither — before hydration there is nothing to call.
The "before the code has loaded" half is the one that benefits every user on a slow
connection, not only those with scripting off.

**When should you not use a function action?**
When you want a GET form. A function action forces POST regardless of the `method` prop, so
a search form that should put its query in a bookmarkable, shareable URL wants a string
`action` and the platform's own behaviour. That is a legitimate use of the string form, not
a fallback.

**How do you get two different submit behaviours from one form?**
`formAction` on the button. It overrides the form's `action` for that specific `<button>`,
`<input type="submit">` or `<input type="image">` — so Save and Delete each get their own
function without a hidden intent field.

---

← Prev: [Controlled inputs](01-controlled-inputs/README.md) ·
Index: [Phase 9](README.md) ·
Next → [`useActionState`](03-useactionstate.md)
