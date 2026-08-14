---
title: "Calling Server Functions from the client"
sidebar_label: "09 · Calling Server Functions"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Functions](https://react.dev/reference/rsc/server-functions) (using them in forms,
> calling them outside forms, composing with `useActionState`, the pre-hydration replay and
> the `permalink` redirect) and
> [`'use server'`](https://react.dev/reference/rsc/use-server) (the transition caveat and the
> mutations-not-data-fetching caveat).
> No sandbox script backs this page; claims are cited, not measured.

**Three ways to call one, and they differ in exactly one respect: who supplies the
transition.** Get that straight and the rest is Phase 9 material you already have.

> **Server Functions allow Client Components to call async functions executed on the
> server.**

## The three call sites

| How | Transition | Pending state | Progressive enhancement |
|---|---|---|---|
| `<form action={fn}>` | **automatic** | `useFormStatus` | ✅ with a Server Component rendering the form |
| `useActionState(fn, …)` | **automatic** | returned `isPending` | ✅, plus pre-hydration replay |
| Event handler | **yours to write** | `useTransition`'s `isPending` | ✖ |

> **Server Functions should be called in a Transition. Server Functions passed to
> `<form action>` or `formAction` will automatically be called in a transition.**

That caveat is the whole table. The two form paths wrap the call for you; the third does not,
and forgetting it is the most common way to lose everything Actions were worth.

## As a form action

```jsx
// actions.js
'use server';
export async function createNote(formData) {
  await db.notes.create({ text: formData.get('text') });
}
```

```jsx
// A Server Component — no directive needed
import { createNote } from './actions';

export default function NoteForm() {
  return (
    <form action={createNote}>
      <textarea name="text" />
      <button type="submit">Save</button>
    </form>
  );
}
```

Everything from [Phase 9 · Actions](../phase-9-forms-actions/02-actions.md) applies
unchanged — `FormData` as the argument, an automatic transition, tracked pending state, and:

> **When the Form submission succeeds, React will automatically reset the form.**

This is also the only shape that gets **progressive enhancement**, and the conditions are
exact: a Server Component rendering the form **and** a Server Function as its action
([Phase 9 · 11](../phase-9-forms-actions/11-progressive-enhancement.md)). Phase 9 could state
the conditions but not explain them; now both halves are defined.

## With `useActionState`

> **You can call Server Functions with `useActionState` for the common case where you just
> need access to the action pending state and last returned response.**

```jsx
'use client';
import { useActionState } from 'react';
import { createNote } from './actions';

export function NoteForm() {
  const [state, action, isPending] = useActionState(createNote, null);
  return (
    <form action={action}>
      <textarea name="text" />
      <button disabled={isPending}>Save</button>
      {state?.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

Two behaviours here are specific to Server Functions and worth knowing precisely.

### Pre-hydration replay

> **When using `useActionState` with Server Functions, React will also automatically replay
> form submissions entered before hydration finishes.**

A user who submits during the gap between HTML arriving and JavaScript hydrating does not
lose the submission — React replays it. That gap is real on slow connections for users who
have JavaScript perfectly enabled, which is the half of progressive enhancement that
benefits everyone ([Phase 9 · 11](../phase-9-forms-actions/11-progressive-enhancement.md)).

### The `permalink` redirect

> **When the permalink is provided to `useActionState`, React will redirect to the provided
> URL if the form is submitted before the JavaScript bundle loads.**

The no-JavaScript path needs somewhere to land, because the response cannot be patched into a
page that was never hydrated. `permalink` is that destination.

## From an event handler

> **Server Functions can be called from Actions on the client** — using `useTransition` to
> access the `isPending` state.

```jsx
'use client';
import { useTransition } from 'react';
import { likePost } from './actions';

export function LikeButton({ id }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(async () => { await likePost(id); })}
    >
      Like
    </button>
  );
}
```

🔴 **Calling `likePost(id)` bare in the handler "works" and is the trap.** The request is
sent, the promise resolves, and you have silently given up the non-blocking update, the
pending state, and the Suspense-fallback suppression that stops the screen blanking
([Phase 8 · 09](../phase-8-concurrent-suspense/09-async-transitions.md)). Nothing errors. The
UI is just worse.

⚠️ **The post-`await` limitation applies here too.** State you set *after* an `await` inside
the transition callback is not automatically part of the transition and needs its own
`startTransition` — a documented React limitation, not a bug in your code
([Phase 8 · 09](../phase-8-concurrent-suspense/09-async-transitions.md)).

## Every call is a network request

The thing the syntax hides. A Server Function call looks like a function call and behaves
like `fetch`:

- **It has latency.** Optimistic UI (`useOptimistic`,
  [Phase 9 · 07](../phase-9-forms-actions/07-useoptimistic.md)) exists for exactly this gap.
- **It can fail** — offline, timeout, 500. A thrown error reaches the nearest error boundary
  around the component that called it; a *returned* error reaches `useActionState`
  ([Phase 9 · 10](../phase-9-forms-actions/10-errors-in-actions.md)). That choice is yours
  and it decides whether the user keeps what they typed.
- **The arguments and the return value are serialized**, with the argument rules — `FormData`
  in, no JSX, no DOM events ([topic 05](05-what-crosses-the-boundary.md)).
- **It is a public endpoint**, so the checks inside it are not optional
  ([topic 06](06-server-function-security/README.md)).

## Do not use one as a data-fetching hook

> **Server Functions are designed for mutations that update server-side state; they are not
> recommended for data fetching. Accordingly, frameworks implementing Server Functions
> typically process one action at a time and do not have a way to cache the return value.**

The tempting shape — call a Server Function in an effect to load a list — is worse than the
API route it replaced: **serialized execution** turns parallel reads into a queue, and **no
return-value caching** means every call pays full price. Reads belong in Server Components
([topic 08](08-async-components.md), [topic 15](15-data-fetching-in-rsc.md)).

The honest exception is a read that is genuinely *event-driven* and small — a typeahead
lookup, a validity check on blur. Even then, know that you are on the mutation path and that
it does not parallelize.

## Gotchas

**Symptom:** no pending state, and the UI blocks while a Server Function runs.
**Cause:** it was called from a plain event handler. Only `<form action>` and `formAction`
wrap it automatically.
**Fix:** `startTransition`, or `useActionState`.

**Symptom:** a state update after an `await` inside the transition blanks the screen.
**Cause:** the post-`await` limitation — the update is not part of the transition.
**Fix:** wrap it in its own `startTransition`. It fails silently.

**Symptom:** a failed submission clears the form.
**Cause:** the action returned rather than threw, so React treated it as success and reset
the uncontrolled fields.
**Fix:** decide deliberately between throwing and returning an error state.

**Symptom:** the form works after hydration but a fast submit is lost.
**Cause:** pre-hydration replay comes from `useActionState` with a Server Function; a bare
handler has nothing to replay.
**Fix:** use `useActionState`, and provide `permalink` for the no-JavaScript landing.

**Symptom:** a list of Server Function reads gets slower under load.
**Cause:** one action at a time, and no return-value caching.
**Fix:** fetch in Server Components.

**Symptom:** passing the click event to a Server Function throws.
**Cause:** events from event handlers are not serializable arguments.
**Fix:** pass the id or the values it needs.

## Interview questions

**★ What are the three ways to call a Server Function, and how do they differ?**
As a `<form action>` (or `formAction`), through `useActionState`, or from an event handler.
The difference is who supplies the transition: the two form paths are wrapped automatically,
and an event handler is not — you write `startTransition` yourself, or you lose the
non-blocking update, the pending state and the fallback suppression.

**★ Why is calling one bare in an `onClick` a bug when nothing errors?**
Because the failure is entirely in the UX. The request still goes out and resolves, so
nothing surfaces — but the update is now blocking, there is no `isPending` to disable the
button with, and revealed content can be replaced by a Suspense fallback. The docs are
explicit that Server Functions should be called in a Transition.

**★ What does `useActionState` add specifically for Server Functions?**
Two things beyond pending state and the last returned response. It **replays form
submissions entered before hydration finishes**, so a fast submit on a slow connection is not
lost; and with `permalink` it **redirects to that URL if the form is submitted before the
JavaScript bundle loads**, which is where the no-JavaScript path has to land.

**★ Why not use a Server Function to fetch data?**
Because they are designed for mutations. Frameworks implementing them typically process one
action at a time — so parallel reads serialize — and have no way to cache the return value,
so every call pays full cost. Reads belong in Server Components, where `await` in render is
the mechanism.

**What has to be true for a form to submit without JavaScript?**
A Server Component rendering the form and a Server Function as its action — both, not either.
A client-side function action gives you nothing before hydration, because there is nothing
to call.

**How do errors behave?**
As they do for any Action: a thrown error reaches the nearest error boundary around the
calling component, and a returned error reaches `useActionState`. The choice matters beyond
style, because a form that "succeeded" resets its uncontrolled fields — returning the error
is what preserves what the user typed.

---

← Prev: [Async components](08-async-components.md) ·
Index: [Phase 10](README.md) ·
Next → [Composition rules](10-composition-rules.md)
