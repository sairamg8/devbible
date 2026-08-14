---
title: "useRef"
sidebar_label: "01 · useRef"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useRef`](https://react.dev/reference/react/useRef).
> No sandbox script backs this page; claims are cited, not measured.

**A mutable box that survives renders and never causes one. That second half is
the entire definition — everything `useRef` is good at and everything it is
dangerous for follows from React not being told when it changes.**

> `useRef` is a React Hook that lets you reference a value **that's not needed for
> rendering.**

## The shape

```jsx
const ref = useRef(initialValue);
// ref.current === initialValue on the first render
```

> `current`: Initially, it's set to the `initialValue` you have passed. You can
> later set it to something else.

> **This argument is ignored after the initial render.**

> On the next renders, `useRef` will return **the same object.**

Two facts worth holding together: the *object* is stable across renders, and the
*initial value* is only ever used once. A ref is therefore one box per component
instance, handed back unchanged every time.

## The caveat that defines it

> **When you change the `ref.current` property, React does not re-render your
> component. React is not aware of when you change it because a ref is a plain
> JavaScript object.**

There is no setter, no subscription, no proxy. Assigning to `ref.current` is an
ordinary property write on an ordinary object, and React never finds out. That is
not a limitation to work around — it is what you are choosing when you pick a ref.

The consequence is the one bug people meet: **a ref changes, the screen does
not.** The value really did update; nothing asked React to render again, so the UI
is still showing the previous render's output.

## Refs versus state

react.dev's own comparison, and it is a decision table rather than trivia:

> - **Changing a ref does not trigger a re-render.** This means refs are perfect
>   for storing information that doesn't affect the visual output of your
>   component.
> - Refs can **store information between re-renders** (unlike regular variables,
>   which reset on every render).
> - The **information is local** to each copy of your component (unlike the
>   variables outside, which are shared).
> - **Information that's used for rendering should be state instead.**

| | Local variable | `useRef` | `useState` |
|---|---|---|---|
| Survives a re-render | ❌ | ✅ | ✅ |
| Per component instance | ✅ | ✅ | ✅ |
| Changing it re-renders | — | ❌ | ✅ |
| Read during render | ✅ | ⚠️ no | ✅ |

The last line is the one people skip, and it has its own rule.

## 🔴 Do not read or write `ref.current` during render

> **Do not write *or read* `ref.current` during rendering, except for
> initialization.** This makes your component's behavior unpredictable.

*Or read.* The prohibition is symmetric, and the reading half surprises people who
assumed only writes were a purity problem.

Both directions break the same thing. Writing during render is a side effect, so
the component is no longer pure ([Phase 2 · Purity](../phase-2-components/02-purity/01-the-two-rules.md))
and React may call it twice or throw the render away. Reading during render makes
the output depend on a value React is not tracking — so two renders with identical
props and state can produce different JSX, and React has no reason to believe it
needs to re-render when that value changes.

The safe places are **event handlers** and **effects**, both of which run after
the render is committed.

## The one legal exception: initialization

> React saves the initial ref value once and ignores it on the next renders.

Which creates a real problem — `useRef(new VideoPlayer())` constructs a
`VideoPlayer` on *every* render and throws all but the first away. Unlike
`useState`, **`useRef` has no lazy initializer**. The documented idiom:

```jsx
function Video() {
  const playerRef = useRef(null);
  if (playerRef.current === null) {
    playerRef.current = new VideoPlayer();
  }
  // ...
}
```

And why this specific case is allowed:

> Normally, writing or reading `ref.current` during render is not allowed.
> However, it's fine in this case because **the result is always the same, and the
> condition only executes during initialization** so it's fully predictable.

The exemption is narrow and it is earned by *idempotence*, not by convention. Note
that it is still not perfectly free under `StrictMode`:

> Each ref object will be created twice, but one of the versions will be
> discarded.

So the construction may happen twice in development. If the constructor has side
effects — opening a connection, registering globally — this idiom is the wrong
tool and an effect is the right one ([Phase 4 · 01](../phase-4-effects/01-what-an-effect-is-for.md)).

## Mutation, and the one thing you must not mutate

> You can mutate the `ref.current` property. Unlike state, it is mutable.
> **However, if it holds an object that is used for rendering (for example, a
> piece of your state), then you shouldn't mutate that object.**

A ref pointing at something you also render is a trap: mutating through the ref
edits the object React is rendering from, with no re-render and — worse — a
corrupted previous render, which is the same failure as mutating state directly
([Phase 3 · 05](../phase-3-state/05-immutable-updates/README.md)).

**A ref should own its contents.** If two things can reach the object, one of them
should be state.

## The two legitimate uses

**A handle to a DOM node** — the case with dedicated support, covered in
[topic 02](02-dom-refs/README.md).

**An instance variable React does not need to know about** — a timeout id, a
previous value kept for comparison, a WebSocket, a third-party player, a flag
that no rendering reads. The test is literally the definition: *does anything
rendered depend on this?* If yes, it is state. If no, a ref is correct and cheap.

## Gotchas

**Symptom:** `ref.current` is updated and the screen does not change.
**Cause:** React is not aware of the change — a ref is a plain object with no
setter.
**Fix:** if the UI depends on it, it is state. This is the definition, not an
edge case.

**Symptom:** `useRef(new Thing())` and `Thing` is constructed on every render.
**Cause:** `useRef` has no lazy initializer; the argument is evaluated every
render and ignored after the first.
**Fix:** the `if (ref.current === null)` idiom.

**Symptom:** a component renders inconsistently and the culprit is a ref read in
the body.
**Cause:** reading during render is prohibited too, not just writing — the output
now depends on something React does not track.
**Fix:** read it in an event handler or an effect.

**Symptom:** state held in a ref "for performance" produces stale UI.
**Cause:** the value is used for rendering, so it was never a ref candidate.
**Fix:** `useState`. If re-renders are the actual problem, that is Phase 6's
subject, not a reason to hide state from React.

**Symptom:** mutating through a ref corrupts what is on screen.
**Cause:** the ref points at an object that is also rendered — usually state.
**Fix:** a ref should own its contents. Copy, or make it state.

**Symptom:** an expensive constructor runs twice in development.
**Cause:** `StrictMode` calls the component twice, so the initialization idiom
runs twice and one ref object is discarded.
**Fix:** fine if the constructor is pure; if it has side effects, it belongs in an
effect with a cleanup.

## Interview questions

**★ What is `useRef` for, in one sentence?**
Referencing a value that is not needed for rendering. It returns the same object
on every render, its `current` property is freely mutable, and changing it does
not re-render — because a ref is a plain JavaScript object and React is not aware
of the change. Anything the UI displays should be state instead.

**★ Why can't you read `ref.current` during render?**
Because the output would depend on a value React does not track, so two renders
with identical props and state could produce different JSX and React would have no
reason to re-render when it changed. react.dev's rule is explicitly symmetric —
"do not write *or read* `ref.current` during rendering, except for
initialization". Event handlers and effects are the safe places.

**★ `useRef(new Thing())` — what is wrong with it?**
`Thing` is constructed on every render and every result but the first is thrown
away, because the argument is ignored after the initial render and `useRef` has no
lazy initializer the way `useState` does. The documented workaround is
`if (ref.current === null) ref.current = new Thing()`, which is allowed during
render because it is idempotent and fully predictable.

**When is a ref the right tool and when is it state?**
Ask whether anything rendered depends on the value. A timeout id, a WebSocket, a
previous value kept only for comparison, a third-party player instance — nothing
on screen reads those, so a ref is correct. A counter shown to the user, a form
value, a loading flag — all rendered, so all state. "Use a ref to avoid
re-renders" applied to rendered data produces a UI that silently stops updating.

**Can you mutate what a ref holds?**
The `current` property itself, yes — that is the point of it. But not an object
that is also used for rendering, such as a piece of state, because you would be
editing what React renders from with no re-render and a corrupted previous render.
A ref should own its contents; if two things can reach the object, one of them
should be state.

**Does `StrictMode` affect refs?**
It calls your component twice, so each ref object is created twice and one is
discarded. That is harmless for a pure component, but it means the
`if (ref.current === null)` initialization idiom can run its constructor twice in
development — so it is the wrong home for anything with side effects, which
belongs in an effect with a cleanup.

---

Index: [Phase 5](README.md) · Next → [DOM refs](02-dom-refs/README.md)
