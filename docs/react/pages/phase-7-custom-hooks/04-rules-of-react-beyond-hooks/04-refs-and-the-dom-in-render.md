---
title: "Refs and the DOM during render"
sidebar_label: "04 · Refs and the DOM in render"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useRef`](https://react.dev/reference/react/useRef) (Caveats, the Pitfall on reading
> and writing during render, Strict Mode, and *Avoiding recreating the ref contents*)
> and [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure).
> No sandbox script backs this page; claims are cited, not measured.

**Render may not read or write `ref.current`, and it may not read or write the DOM.
Both are the same rule as purity, applied to the two escape hatches that make it
easiest to break — and the ref one ships with a documented, precisely bounded
exception.**

## The rule, as a Pitfall

> **Do not write _or read_ `ref.current` during rendering**, except for
> [initialization](https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents).
> **This makes your component's behavior unpredictable.**

Note *read*. Writing during render is the obvious violation; reading feels innocent and
is listed first-class alongside it. The justification is the purity definition again,
restated as two properties:

> React expects that the body of your component **behaves like a pure function**:
>
> - If the inputs (**props, state, and context**) are the same, it should return
>   **exactly the same JSX**.
> - **Calling it in a different order or with different arguments should not affect the
>   results of other calls.**
>
> Reading or writing a ref **during rendering** breaks these expectations.

A ref is not props, state or context — so it is not an input React knows about, and
reading it makes the output depend on something outside the contract. The second bullet
is the one that matters under concurrent rendering: React renders components in an
order it chooses and may render some of them more than once. If component A writes a
ref that component B reads during render, the output depends on the order React
happened to pick, and that order is not a guarantee.

The neighbouring caveats fill in why refs are a trap specifically:

> **When you change the `ref.current` property, React does not re-render your
> component.** React is not aware of when you change it because a ref is a plain
> JavaScript object.

> You can mutate the `ref.current` property. Unlike state, it is mutable. **However, if
> it holds an object that is used for rendering** (for example, a piece of your state),
> **then you shouldn't mutate that object.**

So a ref used as a source of rendered output is a value that changes without telling
anyone — the screen and the ref drift apart, and nothing warns you. That is the
`useRef`-shaped version of the "state that never propagates" bug from
[Phase 7 · 03](../03-share-logic-not-state/02-the-localstorage-trap.md), and it is why
[Phase 5 · 08](../../phase-5-refs-context-reducers/08-when-a-ref-is-wrong.md) exists as
a topic.

## The exception, and its exact boundary

The one blessed pattern is lazy initialization of an expensive ref value. The naive
form first:

```jsx
function Video() {
  const playerRef = useRef(new VideoPlayer());
  // ...
```

> Although the result of `new VideoPlayer()` is only used for the initial render,
> you're still calling this function on **every render**. This can be wasteful if it's
> creating expensive objects.

And the sanctioned fix, which does write a ref during render:

```jsx
function Video() {
  const playerRef = useRef(null);
  if (playerRef.current === null) {
    playerRef.current = new VideoPlayer();
  }
  // ...
```

> Normally, writing or reading `ref.current` during render is not allowed. **However,
> it's fine in this case because the result is always the same, and the condition only
> executes during initialization so it's fully predictable.**

The exception is granted for a reason you can test yourself, which makes it a rule
rather than a special case: **the write is idempotent and happens once.** Every render
after the first sees a non-null `current` and does nothing, so repeated renders,
discarded renders and `StrictMode`'s double render all produce the same state of the
world.

Anything that fails either half is not covered:

| Pattern | Covered? |
|---|---|
| `if (ref.current === null) ref.current = expensive()` | ✅ Idempotent, once |
| `ref.current = props.value` in render | 🔴 Runs every render, and the value varies |
| `ref.current++` in render | 🔴 Not idempotent — this is the classic "count renders" hack |
| `if (ref.current !== props.id) { ref.current = props.id; … }` | 🔴 Reads a ref to make a decision that varies |
| Reading `ref.current` to compute JSX | 🔴 Output depends on a non-input |

The corresponding `StrictMode` note tells you what the double render does to this:

> Each ref object will be created twice, but **one of the versions will be discarded**.
> If your component function is pure (as it should be), this should not affect the
> behavior.

Which is exactly why the guard matters: the discarded pass may have constructed a
`VideoPlayer` that nobody will use. If constructing it has side effects — a socket, a
listener, an analytics session — the object should not be built in render at all; it
belongs in an effect with cleanup ([Phase 4 · 04](../../phase-4-effects/04-cleanup/README.md)).

## The DOM during render

The same rule, applied to the other escape hatch, and here there is no exception at all.

**Reading** the DOM during render — `getBoundingClientRect`, `offsetWidth`,
`scrollTop`, `document.querySelector`, `window.innerWidth` — is wrong on three separate
counts:

1. **It is not an input.** Output that depends on layout is not a function of props,
   state and context, so the component is not idempotent.
2. **What you read is the *previous* commit.** React has not applied this render yet.
   During a concurrent render you may be measuring a tree that is about to change, or
   one belonging to a render that will be thrown away and never committed at all.
3. **There is no DOM on the server.** The same code path in SSR throws, or is guarded
   with `typeof window !== 'undefined'` — which then returns different values on the
   server and the client and produces a hydration mismatch. You have traded a crash for
   a silent inconsistency.

**Writing** to the DOM during render — setting `document.title`, adding a class,
focusing an input, appending a node — is a side effect, plainly banned by
[chunk 01](01-purity-and-idempotence.md), and it will run once per render attempt
rather than once per update.

Where each belongs instead:

| What you want | Where it goes |
|---|---|
| Measure layout **before** the browser paints | `useLayoutEffect` — [Phase 4 · 12](../../phase-4-effects/12-uselayouteffect.md) |
| Measure layout, paint first is fine | `useEffect` |
| Focus, scroll, play a video, imperative widget calls | An event handler, or an effect — [Phase 5 · 02](../../phase-5-refs-context-reducers/02-dom-refs/README.md) |
| React to an element appearing or resizing | A ref callback or an observer — [Phase 5 · 06](../../phase-5-refs-context-reducers/06-ref-callbacks.md) |
| A value derived from window size | State, updated by a subscription — [Phase 5 · 15](../../phase-5-refs-context-reducers/15-usesyncexternalstore.md) |

And the general shape: **render describes; effects and handlers touch.** If a line of
render code would still make sense with no document at all — during SSR, or in a render
React decides to discard — it belongs there. If it would not, it does not.

## What obeying all of this buys

The four chunks of this topic are one bargain, and it is worth stating what is on the
other side of it:

- **The Compiler will actually optimise your code.** It memoizes what it can prove
  pure and silently skips the rest
  ([Phase 6 · 09](../../phase-6-performance/09-how-the-compiler-bails-out.md)). Every
  rule here is one of the things it must prove.
- **`StrictMode` stays quiet**, and when it does complain it is telling you something
  true rather than something you have learned to ignore.
- **Concurrent features work as advertised.** Transitions, Suspense and time-slicing
  all rely on renders being interruptible, repeatable and discardable — which is only
  safe if a render does nothing but compute.
- **You keep local reasoning**, the principle that runs through
  [chunk 02](02-immutability.md) and [chunk 03](03-react-calls-components-and-hooks.md):
  a component's behaviour is knowable from its own source.

That is the answer to "why so many rules": they are not five preferences, they are the
preconditions for everything React has shipped since hooks.

## Gotchas

**Symptom:** a render-count ref (`renderCount.current++` in the body) reports double in
development.
**Cause:** the write is not idempotent, and `StrictMode` renders twice.
**Fix:** it is not a supported technique. Count in an effect if you need it, and treat
the doubling as the rule catching you.

**Symptom:** a measurement is always one interaction stale.
**Cause:** the DOM was read during render, so it reflects the previous commit.
**Fix:** `useLayoutEffect` if the value is needed before paint, `useEffect` otherwise.

**Symptom:** SSR throws `document is not defined`, or the same code guarded with
`typeof window` produces a hydration mismatch.
**Cause:** the render reads the DOM or `window`.
**Fix:** move the read into an effect, which never runs on the server, and let the
first client render match the server's output.

**Symptom:** a ref holds a value that is displayed, and the screen stops matching it.
**Cause:** changing `ref.current` does not re-render — React is not aware of the change
because a ref is a plain object.
**Fix:** if it is rendered, it is state.

**Symptom:** an expensive object is constructed on every render despite living in a ref.
**Cause:** `useRef(new Thing())` evaluates its argument every render even though only
the first result is kept.
**Fix:** the documented `if (ref.current === null)` guard — idempotent, once, fully
predictable.

**Symptom:** the lazy-init guard is used to build something with side effects, and two
of them exist in development.
**Cause:** `StrictMode` creates each ref object twice and discards one; the discarded
pass still ran the constructor.
**Fix:** construct anything with side effects in an effect, with cleanup.

**Symptom:** two components disagree, and the difference tracks which one rendered
first.
**Cause:** one writes a ref that the other reads during render — output that depends on
render order.
**Fix:** pass the value as props or lift it into state. Render order is not a contract.

## Interview questions

**★ Why may you not read `ref.current` during render — writing is the dangerous one,
surely?**
Both are disallowed, and the docs list reading explicitly. React expects the component
body to behave like a pure function: the same props, state and context must return
exactly the same JSX, and calling components in a different order must not affect other
calls' results. A ref is none of those inputs, so reading it makes output depend on
something React does not track — and under concurrent rendering the value can depend on
the order React chose to render in.

**★ What is the one sanctioned exception, and why is it allowed?**
Lazy initialization: `const ref = useRef(null); if (ref.current === null) ref.current =
new VideoPlayer();`. The docs allow it because the result is always the same and the
condition only executes during initialization, so it is fully predictable. It exists
because `useRef(new VideoPlayer())` would construct the object on every render and
discard all but the first. The exception does not extend to any write that runs on more
than the first render or produces a varying value.

**★ Why can't render read the DOM?**
Three reasons at once. Layout is not one of the component's inputs, so the render is no
longer idempotent. The DOM you would read reflects the *previous* commit, since this
render has not been applied — and under concurrent rendering it may belong to a render
that will be discarded. And there is no DOM on the server, so the code either throws
during SSR or is guarded in a way that produces different output on server and client,
which is a hydration mismatch.

**★ Where does a layout measurement belong?**
In `useLayoutEffect` when the value must be known before the browser paints — the
classic case being positioning a tooltip without a visible jump — and in `useEffect`
when painting first is acceptable. Both run after the commit, so what they measure is
the tree that is actually on screen.

**A teammate counts renders with `useRef` and increments it in the component body.
What do you say?**
That the increment is a non-idempotent write during render, which is precisely what the
rule forbids, and `StrictMode` will report double because the component is called twice.
If the count is genuinely needed, increment it in an effect — and treat the doubling as
the smoke test working rather than as a nuisance.

**What do all of these rules buy you, concretely?**
The Compiler can memoize components whose purity it can prove and silently skips the
rest, so the rules decide whether you get automatic memoization at all. `StrictMode`'s
double render stays silent, so its warnings remain meaningful. Concurrent features —
transitions, Suspense, time-slicing — depend on renders being interruptible, repeatable
and discardable. And local reasoning survives: what a component does is knowable from
its own source.

---

← Prev: [React calls components and hooks](03-react-calls-components-and-hooks.md) ·
Index: [Rules of React beyond hooks](README.md) ·
Next → [Why the rules exist](../05-why-the-rules-exist/README.md)
