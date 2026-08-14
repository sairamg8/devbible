---
title: "Async transitions (React 19)"
sidebar_label: "09 · Async transitions"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useTransition`](https://react.dev/reference/react/useTransition)
> (*Perform non-blocking updates with Actions*, *Exposing `action` props from components*,
> the Caveats, and the troubleshooting entry *React doesn't treat my state update after
> `await` as a Transition*).
> No sandbox script backs this page; claims are cited, not measured.

**React 19 lets you pass an `async` function to `startTransition`, and the pending state
spans the whole thing — the request, the awaits, and the final render. There is one sharp
edge, it is documented as a limitation rather than a design, and it fails silently.**

## Actions

The vocabulary first, because it is used throughout Phase 9:

> Functions called in `startTransition` are called **"Actions"**. By convention, any
> callback called inside `startTransition` (such as a callback prop) should be **named
> `action` or include the "Action" suffix.**

> The function passed to `startTransition` is called the "Action". You can **update state
> and (optionally) perform side effects** within an Action, and the work will be done in
> the background without blocking user interactions on the page. **A Transition can include
> multiple Actions, and while a Transition is in progress, your UI stays responsive.**

So an Action is not a new primitive — it is a name for the function you already pass to
`startTransition`, and the naming convention is what makes an `action` prop recognisable
at a call site.

## The shape

```jsx
function CheckoutForm() {
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState(1);

  function onSubmit(newQuantity) {
    startTransition(async function () {
      const savedQuantity = await updateQuantity(newQuantity);
      startTransition(() => {
        setQuantity(savedQuantity);
      });
    });
  }
  // ...
}
```

Note the inner `startTransition`. That is not defensive style — it is required, and the
next section is why.

## 🔴 The `await` limitation

The behaviour, from the caveats:

> Any async calls that are awaited in the `action` will be **included in the Transition**,
> but currently require **wrapping any `set` functions after the `await` in an additional
> `startTransition`.**

And the troubleshooting entry, which is blunter:

> When you use `await` inside a `startTransition` function, the state updates that happen
> **after the `await` are not marked as Transitions.** You must wrap state updates after
> **each `await`** in a `startTransition` call:

```jsx
startTransition(async () => {
  await someAsyncFunction();
  // ❌ Not using startTransition after await
  setPage('/about');
});
```

```jsx
startTransition(async () => {
  await someAsyncFunction();
  // ✅ Using startTransition *after* await
  startTransition(() => {
    setPage('/about');
  });
});
```

And the reason, which is worth knowing because it tells you this is temporary:

> This is a **JavaScript limitation due to React losing the scope of the async context.**
> In the future, when **AsyncContext** is available, this limitation will be removed.

Three things to carry:

1. **"After each `await`"** — not just the first. A function with three awaits needs the
   marking re-established after every one that precedes a `set` call.
2. **It fails silently.** The update still happens; it is simply urgent. So a navigation
   blanks the screen to a Suspense fallback that a transition would have suppressed
   ([topic 02 · 02](02-suspense/02-state-effects-and-resuspending.md)), and nothing warns
   you. This is the same silent failure as
   [topic 01 · 01](01-usetransition/01-marking-an-update-non-urgent.md)'s `setTimeout`
   case, and it has the same cause: the synchronous marking window has closed.
3. **It is a JavaScript problem, not a React design.** React cannot follow the async
   context across an `await` today. Do not architect around it as though it were
   intentional.

## `isPending` spans everything

> To give the user feedback about in-progress Transitions, the `isPending` state switches
> to `true` at the **first call to `startTransition`**, and stays `true` **until all
> Actions complete and the final state is shown to the user.**

That is a stronger guarantee than "while the request is in flight". It covers the await,
the state update, the re-render, and the commit — so a single `isPending` correctly
describes the whole operation from the user's point of view, and you do not need a
separate `isSubmitting` flag alongside it.

It also explains the batching caveat from
[topic 01 · 02](01-usetransition/02-ispending-and-which-tool.md): with multiple ongoing
transitions batched together, `isPending` stays true until *all* of them finish.

## The `action` prop convention

> You can expose an **`action` prop** from a component to allow a parent to call an Action.

```jsx
export default function TabButton({ action, children, isActive }) {
  const [isPending, startTransition] = useTransition();
  if (isActive) {
    return <b>{children}</b>
  }
  return (
    <button onClick={() => {
      startTransition(async () => {
        // await the action that's passed in.
        // This allows it to be either sync or async.
        await action();
      });
    }}>
      {children}
    </button>
  );
}
```

> Because the parent component updates its state **inside the `action`**, that state
> update gets marked as a Transition.

And the rule that makes the pattern work:

> When exposing an `action` prop from a component, you should **`await` it inside the
> transition.** This allows the `action` callback to be **either synchronous or
> asynchronous** without requiring an additional `startTransition` to wrap the `await` in
> the action.

This is the genuinely useful design idea on the page. A reusable button, tab or menu item
owns the transition and the pending state; the parent supplies *what to do*. Awaiting the
prop means callers may pass either kind of function and neither has to know about
transitions — the component absorbs the requirement, which is exactly the hook-boundary
principle from
[Phase 7 · 08](../phase-7-custom-hooks/08-hooks-that-wrap-effects/README.md).

Note the hook is called before the early `return` — [Phase 7 · 09](../phase-7-custom-hooks/09-conditional-hooks.md)'s
rule, visible in React's own example.

## Errors go to an error boundary

> If a function passed to `startTransition` **throws an error**, you can display an error
> to your user with an **error boundary.** To use an error boundary, wrap the component
> where you are calling the `useTransition` in an error boundary. Once the function passed
> to `startTransition` errors, **the fallback for the error boundary will be displayed.**

```jsx
export function AddCommentContainer() {
  return (
    <ErrorBoundary fallback={<p>⚠️Something went wrong</p>}>
      <AddCommentButton />
    </ErrorBoundary>
  );
}
```

Note where the boundary goes: **around the component that calls `useTransition`**, not
around the thing that failed. A rejected request inside an Action therefore takes down
that component's subtree — which is the right default for an unexpected failure and the
wrong one for an expected one. An expected failure (validation, a 409) should be caught
inside the Action and turned into state.

## Ordering, and where this stops being the right tool

> Transitions ensure side effects in Actions to complete **in order** to prevent unwanted
> loading indicators, and you can provide immediate feedback while the Transition is in
> progress with **`useOptimistic`**.

> For common use cases, React provides built-in abstractions such as **`useActionState`**,
> **`<form>` actions** and **Server Functions**. These solutions **handle request ordering
> for you.**

That is the honest boundary of this topic. A hand-rolled async transition is the low-level
form; for a real form submission you want the abstractions built on it, which handle
ordering, pending state and optimistic updates without you assembling them. **Phase 9 is
those abstractions**, and this page is the mechanism underneath them.

## Gotchas

**Symptom:** a navigation inside an async transition still blanks the screen to a
fallback.
**Cause:** the `setState` came after an `await`, so it was never marked and stayed urgent.
**Fix:** wrap it in another `startTransition`. There is no warning for this.

**Symptom:** it was fixed after the first `await` and still fails later.
**Cause:** the marking must be re-established after **each** `await` preceding a `set`.
**Fix:** wrap after every one.

**Symptom:** a separate `isSubmitting` flag disagrees with `isPending`.
**Cause:** `isPending` already covers the whole operation — from the first
`startTransition` until the final state is shown.
**Fix:** use the one flag.

**Symptom:** an expected failure — a validation error — unmounts the whole subtree.
**Cause:** a throw inside an Action is handled by the error boundary around the component
calling `useTransition`.
**Fix:** catch expected failures inside the Action and render them as state; reserve the
boundary for the unexpected.

**Symptom:** a reusable button forces every caller to know about transitions.
**Cause:** the transition lives at the call site instead of in the component.
**Fix:** the `action` prop convention — own the transition inside and `await` the prop, so
callers may pass a sync or async function.

**Symptom:** out-of-order responses overwrite newer data.
**Cause:** a hand-rolled async transition does not order requests for you.
**Fix:** `useActionState`, form actions or Server Functions, which do — Phase 9.

## Interview questions

**★ What is an "Action" in React 19?**
The function passed to `startTransition`. It may update state and optionally perform side
effects, the work happens in the background without blocking interaction, and a single
transition can include several. The convention is that a callback prop invoked inside a
transition is named `action` or carries an "Action" suffix, which is what makes the
pattern recognisable at a call site.

**★ What is the `await` limitation and why does it exist?**
State updates after an `await` inside an async Action are **not** marked as transitions,
so they must each be re-wrapped in another `startTransition`. The cause is a JavaScript
one — React loses the scope of the async context across the await — and the docs say the
limitation will be removed when AsyncContext is available. The dangerous part is that it
fails silently: the update still happens, just urgently, so a navigation blanks the screen
with no warning.

**★ What exactly does `isPending` cover for an async transition?**
Everything. It switches to true at the first `startTransition` call and stays true until
all Actions complete and the final state is shown to the user — the request, the awaits,
the state update and the commit. So a separate `isSubmitting` flag is redundant, and with
multiple transitions batched together it stays true until all of them finish.

**★ Why should a component that exposes an `action` prop `await` it?**
So the caller may pass either a synchronous or an asynchronous function without needing an
extra `startTransition` of their own. The component owns the transition and the pending
state; the parent supplies what to do. It is the same principle as a well-designed hook
boundary — the component absorbs the requirement instead of exporting it.

**How are errors in an Action handled?**
By an error boundary wrapped around the component that calls `useTransition` — a throw
inside the Action shows that boundary's fallback. That is the right default for an
unexpected failure and the wrong one for an expected one, so validation errors and
business-rule rejections should be caught inside the Action and rendered as state.

**When should you not hand-roll an async transition?**
For real form submissions and mutations. React ships `useActionState`, `<form>` actions
and Server Functions on top of this mechanism, and those handle request ordering for you —
which a hand-rolled version does not. `useOptimistic` covers immediate feedback. Phase 9
is those abstractions; this page is the machinery under them.

---

← Prev: [`useDeferredValue`](08-usedeferredvalue.md) ·
Index: [Phase 8](README.md) ·
Next → [Suspense boundary placement](10-boundary-placement.md)
