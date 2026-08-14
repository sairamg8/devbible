---
title: "Error boundaries and Suspense together"
sidebar_label: "16 · Error boundaries and Suspense"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`Component`](https://react.dev/reference/react/Component)
> (*Catching rendering errors with an Error Boundary*, `static getDerivedStateFromError`,
> `componentDidCatch`, and the list of what error boundaries do **not** catch),
> [`lazy`](https://react.dev/reference/react/lazy) (rejection behaviour),
> [`use`](https://react.dev/reference/react/use) (the `try`/`catch` ban), and
> [`useTransition`](https://react.dev/reference/react/useTransition) (errors in Actions).
> No sandbox script backs this page; claims are cited, not measured.

**Suspense handles pending. Error boundaries handle failed. Neither does the other's job,
and a subtree that can suspend can also reject — so a Suspense boundary without an error
boundary above it has a loading state and no failure state.**

## Why they are a pair

Everything in this phase that suspends can also fail, and in every case the failure goes
somewhere else:

| Source | Pending → | Failed → |
|---|---|---|
| `lazy(() => import(…))` | Suspense fallback | *"React will `throw` the rejection reason for the nearest Error Boundary"* |
| `use(promise)` | Suspense fallback | An error boundary — *"`use` cannot be called inside a try-catch block. Instead, wrap your component in an Error Boundary"* |
| An Action in `startTransition` | `isPending` | *"the fallback for the error boundary will be displayed"* |

Three different APIs, one consistent design: **the pending path and the failure path are
separate boundaries.** Ship only the first and a rejected request produces a fallback that
never resolves, then a thrown error that removes the UI —

> By default, if your application throws an error during rendering, **React will remove its
> UI from the screen.**

## The component

There is still no function-component form:

> **There is currently no way to write an Error Boundary as a function component.**
> However, you don't have to write the Error Boundary class yourself. For example, you can
> use `react-error-boundary` instead.

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logErrorToMyService(error, info.componentStack, React.captureOwnerStack());
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

The two methods have different jobs, and the split is deliberate:

> `static getDerivedStateFromError` should **return the state** telling the component to
> display the error message. … should be a **pure function.** If you want to perform a side
> effect (for example, to call an analytics service), you need to **also implement
> `componentDidCatch`.**

> `componentDidCatch` … lets you **log that error to an error reporting service** in
> production.

So: **derive the state purely, report the error impurely.** The purity rules apply to
error handling too — `getDerivedStateFromError` runs during rendering, so logging from it
would be a side effect in render
([Phase 7 · 04 · 01](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/01-purity-and-idempotence.md)).

`info.componentStack` is the useful payload:

> Its `componentStack` field contains a stack trace with the component that threw, as well
> as the names and source locations of all its parent components. **In production, the
> component names will be minified.** … you can decode the component stack using sourcemaps.

## 🔴 What error boundaries do not catch

> Error boundaries do not catch errors for:
>
> - **Event handlers**
> - **Server side rendering**
> - **Errors thrown in the error boundary itself** (rather than its children)
> - **Asynchronous code** (e.g. `setTimeout` or `requestAnimationFrame` callbacks); an
>   exception is the usage of the **`startTransition`** function returned by the
>   `useTransition` Hook. **Errors thrown inside the transition function are caught by
>   error boundaries.**

Each one matters in practice:

- **Event handlers** are the biggest gap. A click handler that throws is not covered — use
  `try`/`catch` there, which is legal precisely because it is not render.
- **The boundary itself** must not throw. A fallback that renders a component which can
  fail escalates to the *next* boundary up, which is the same escalation shape as a
  Suspense fallback that suspends ([topic 02 · 01](02-suspense/01-the-boundary-and-the-fallback.md)).
- **Async code is excluded, with one named exception** — the transition function. That is
  what makes [topic 09](09-async-transitions.md)'s error story work: an async Action's
  rejection *is* caught, even though a bare `setTimeout` callback's is not.
- **Server rendering is excluded**, so SSR failures need their own handling. Phase 11.

## Nesting order

Both boundaries wrap the same subtree, and **the error boundary goes outside**:

```jsx
<ErrorBoundary fallback={<ProfileError />}>
  <Suspense fallback={<ProfileSkeleton />}>
    <Profile userPromise={userPromise} />
  </Suspense>
</ErrorBoundary>
```

The reason is that the error boundary must be able to replace the *whole* region including
its loading state. Inverted, the Suspense boundary would sit above a failed subtree with
nothing left to show, and the fallback would be stranded.

For Actions, the docs place it around the component that owns the transition:

> To use an error boundary, **wrap the component where you are calling the `useTransition`
> in an error boundary.**

Same principle: the boundary encloses everything that can fail together.

## Granularity — the docs' own guidance

> **You don't need to wrap every component into a separate Error Boundary.** When you think
> about the granularity of Error Boundaries, consider **where it makes sense to display an
> error message.** For example, in a messaging app, it makes sense to place an Error
> Boundary around the **list of conversations**. It also makes sense to place one around
> **every individual message.** However, it **wouldn't make sense to place a boundary
> around every avatar.**

That is the same "meaningful region" test as
[topic 10](10-boundary-placement.md) — with a different criterion. Suspense placement asks
*what belongs to the same moment*; error placement asks *where an error message makes
sense*. They often land on the same regions, which is why the pair usually nests cleanly,
but they are separate judgements and can legitimately differ: one boundary per message for
errors, one per conversation for loading.

## Expected versus unexpected failures

A distinction the API does not make for you, and the one that decides whether a boundary is
the right tool at all:

- **Unexpected** — a chunk that failed to load, a 500, a bug. The subtree cannot render;
  replacing it with an error message is correct. **Error boundary.**
- **Expected** — validation failed, the item was deleted, the user lacks permission. These
  are *outcomes*, not crashes, and the component can render them. **State.**

Routing an expected failure through a boundary unmounts a working subtree, loses everything
in it, and usually cannot be recovered from without a remount. In an Action, catch it inside
the Action and turn it into state ([topic 09](09-async-transitions.md)).

## Recovery

Neither the boundary nor React resets `hasError` for you — that is the class's own state,
and it stays set until something changes it. Two supported shapes:

- **A retry control in the fallback** that resets the boundary's state.
- **Remount the boundary with a `key`**, which discards the errored state entirely
  ([Phase 3 · 07](../phase-3-state/07-resetting-state-with-key.md)) — the same
  key-as-position rule used everywhere else.

Without one of these, an error is terminal until the user reloads. `react-error-boundary`
exists largely because it packages the reset ergonomics the class API leaves to you.

## Gotchas

**Symptom:** a failed chunk shows the Suspense fallback forever.
**Cause:** `lazy` throws the rejection for the nearest **error** boundary, and there was
none.
**Fix:** an error boundary above the Suspense boundary.

**Symptom:** a thrown error in a click handler crashes the app.
**Cause:** error boundaries do not catch errors in event handlers.
**Fix:** `try`/`catch` in the handler — legal there, since it is not render.

**Symptom:** a rejection inside `setTimeout` is not caught, but one inside an Action is.
**Cause:** async code is excluded, with the transition function named as the exception.
**Fix:** expected. Handle timer callbacks yourself.

**Symptom:** the fallback itself crashes and the whole app disappears.
**Cause:** errors thrown in the boundary itself are not caught by it.
**Fix:** keep fallbacks trivial — the same rule as Suspense fallbacks.

**Symptom:** a validation error unmounts a working form.
**Cause:** an expected outcome was routed through a boundary.
**Fix:** catch it and render it as state. Boundaries are for the unexpected.

**Symptom:** the error state never clears without a page reload.
**Cause:** nothing resets the boundary's `hasError`.
**Fix:** a retry control, or remount the boundary with a changed `key`.

**Symptom:** production reports show minified component names.
**Cause:** `info.componentStack` is minified in production.
**Fix:** decode it with sourcemaps, as you would a JavaScript stack.

**Symptom:** logging is added to `getDerivedStateFromError` and fires oddly.
**Cause:** it runs during rendering and must be pure.
**Fix:** log from `componentDidCatch`; derive state from the other.

## Interview questions

**★ Why do Suspense and error boundaries have to be used together?**
Because they cover different halves of the same operation. Everything that can suspend can
also fail, and in every case React sends the failure elsewhere: a rejected `lazy` import is
thrown for the nearest error boundary, `use` cannot be wrapped in `try`/`catch` and directs
you to one, and an Action's throw displays the error boundary's fallback. Ship only the
Suspense boundary and a rejection gives you a fallback that never resolves and then a
removed UI, since React removes the UI of a subtree that throws during render.

**★ What do error boundaries not catch?**
Event handlers, server-side rendering, errors thrown in the boundary itself, and
asynchronous code — with one named exception, the function passed to `startTransition`,
whose errors *are* caught. That exception is what makes async Actions' error handling work,
while a bare `setTimeout` callback's throw is still yours to handle.

**★ How do you order the two boundaries, and why?**
Error boundary outside, Suspense inside. The error boundary has to be able to replace the
whole region including its loading state; inverted, the Suspense boundary would sit above a
failed subtree with nothing to show and its fallback stranded. For Actions the docs say the
same thing differently — wrap the component that calls `useTransition`.

**★ What is the split between `getDerivedStateFromError` and `componentDidCatch`?**
Derive state purely, report impurely. `getDerivedStateFromError` returns the state that
shows the fallback and must be a pure function, because it runs during rendering.
`componentDidCatch` is where logging to an error service belongs, and it receives
`info.componentStack` — minified in production, decodable with sourcemaps.

**When is an error boundary the wrong tool?**
For expected failures. Validation errors, a missing record, a permission denial — these are
outcomes the component can render, and routing them through a boundary unmounts a working
subtree and loses its state. Catch them and turn them into state; reserve boundaries for
failures that mean the subtree genuinely cannot render.

**How does a user get out of an error state?**
Not automatically — `hasError` is the boundary's own state and stays set. Either the
fallback offers a retry that resets it, or the boundary is remounted with a changed `key`,
which discards the errored state. Without one of those the error is terminal until reload,
which is much of why `react-error-boundary` exists.

---

← Prev: [Tearing](15-tearing.md) ·
Index: [Phase 8](README.md) ·
Next → [`<ViewTransition>` and friends](17-view-transitions.md)
