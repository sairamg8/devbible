---
title: "When a ref is the wrong tool"
sidebar_label: "08 · When a ref is the wrong tool"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useRef`](https://react.dev/reference/react/useRef),
> [`useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle)
> (§ Do not overuse refs) and
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
> (the ref anti-fix). No sandbox script backs this page; claims are cited, not
> measured.

**Five distinct misuses, one cause: a ref was chosen because it avoids something —
a re-render, a dependency, a double-invocation — rather than because it fits. The
symptom is almost always "it works, but the UI is stale".**

## The rule, from the reference

> **Information that's used for rendering should be state instead.**

One sentence, and every case below is it being violated in a different disguise.
The test is not "does this change?" or "is this expensive?" — it is **does anything
rendered depend on it?**

## Misuse 1 — a rendered value kept in a ref

```jsx
// 🔴 the count is displayed, so it is state
const countRef = useRef(0);
function handleClick() {
  countRef.current++;
  // screen still shows the old number
}
return <p>{countRef.current}</p>;
```

The value updates. Nothing re-renders, because *"React is not aware of when you
change it"* ([topic 01](01-useref.md)). The number on screen is whatever the last
render put there.

What makes this one nasty is that it **half works**: any *other* state change
re-renders the component, and the ref's current value appears — so the UI updates
"sometimes", which sends people looking for a race condition.

## Misuse 2 — a ref read in an event handler that should have been rendered

The subtler version, and the one the syllabus calls out by name. A value is kept in
a ref so a handler can read the latest version, and the same value is also needed
on screen:

```jsx
// 🔴 the handler is right; the UI is stale
const filterRef = useRef('all');

function handleFilterChange(next) {
  filterRef.current = next;
  refetch(filterRef.current);   // ✅ reads the latest
}

return <FilterBar active={filterRef.current} />;  // 🔴 never updates
```

The handler genuinely gets the newest value — that is why the pattern survives
review. But `active` is rendered, so the highlight never moves. **Two consumers,
only one of which a ref can serve.**

If a handler needs the latest value of something that is also rendered, the value is
state, and the handler reads it from the render it belongs to
([Phase 3 · 02](../phase-3-state/02-state-is-a-snapshot.md)) or via an updater.

## Misuse 3 — a ref as a "run once" guard

```jsx
// 🚩 This won't fix the bug!!!
const didInit = useRef(false);
useEffect(() => {
  if (!didInit.current) {
    didInit.current = true;
    connect();
  }
}, []);
```

Covered fully at
[Phase 4 · 04](../phase-4-effects/04-cleanup/01-the-cleanup-contract.md) and
[Phase 4 · 18](../phase-4-effects/18-skipping-the-first-run.md). The short version:
it suppresses the symptom, leaves the effect with no way to stop, and resets on the
next mount — which happens in production on ordinary back-navigation.

## Misuse 4 — a ref hiding a dependency

```jsx
// 🔴 the linter says nothing, and the effect is stale forever
const optionsRef = useRef(options);
optionsRef.current = options;

useEffect(() => {
  connect(optionsRef.current);
}, []);
```

Because `ref.current` is not a reactive value
([Phase 4 · 09](../phase-4-effects/09-effect-lifecycle.md)), it cannot be a
dependency and the linter has nothing to flag. The array looks clean and is exactly
as much of a lie as an `eslint-disable`, with less evidence —
[Phase 4 · 11 · 03](../phase-4-effects/11-removing-dependencies/03-the-illegitimate-fixes.md).

**When reading the latest value without reacting to it is genuinely what you want,
`useEffectEvent` is the supported way to say so**
([Phase 4 · 10](../phase-4-effects/10-useeffectevent.md)).

## Misuse 5 — an imperative handle for state

```jsx
// 🔴 open/close is state the parent already owns
<Modal ref={modalRef} />
modalRef.current.open();
```

Named directly in the docs ([topic 07](07-useimperativehandle.md)):

> If you can express something as a prop, you should not use a ref. … instead of
> exposing an imperative handle like `{ open, close }` from a `Modal` component, it
> is better to take `isOpen` as a prop.

## Why the reflex exists

Almost always: **"I don't want to re-render."** It is worth naming because the
instinct is not stupid — it is just aimed at the wrong thing.

A re-render that produces identical output costs a function call and a diff that
finds nothing to do. Hiding rendered data from React does not make the app faster;
it makes the app *wrong*, and the wrongness is intermittent, which is the most
expensive kind. If re-renders are genuinely the problem, the answers are
memoization, moving state down, and the context splitting from
[topic 05](05-context-re-render-problem.md) — all of which keep React informed.

## The decision, in order

1. **Is anything rendered derived from this value?** → state. Stop.
2. **Is it a DOM node?** → ref ([topic 02](02-dom-refs/README.md)).
3. **Does an effect need the latest value without re-running?** →
   `useEffectEvent`, not a ref.
4. **Is it a per-instance thing nothing renders** — a timer id, a socket, a
   previous value for comparison? → ref, and it is the right tool.
5. **Are you reaching for it to avoid a re-render, a dependency, or a double-run?**
   → none of those are reasons. Go back to 1.

## Gotchas

**Symptom:** the UI updates "sometimes" after a ref changes.
**Cause:** an unrelated state change re-rendered the component and the ref's current
value came along.
**Fix:** it was state all along. The intermittency is the tell.

**Symptom:** an event handler behaves correctly but the corresponding UI does not
update.
**Cause:** the value is in a ref, which serves the handler but not the render.
**Fix:** state. A value with two consumers, one of them the render, cannot be a ref.

**Symptom:** a `didInit` or `hasRun` ref appears in a review.
**Cause:** an attempt to make an effect run once.
**Fix:** "once" is not something an effect can express
([Phase 4 · 18](../phase-4-effects/18-skipping-the-first-run.md)).

**Symptom:** an effect is stale and the linter is silent.
**Cause:** the value is read through a ref, which is non-reactive and therefore
never flagged.
**Fix:** replace the ref with the value and see what the linter says. If it must be
read without reacting, use `useEffectEvent`.

**Symptom:** a component exposes `open()` / `close()` through a ref.
**Cause:** state expressed as imperative methods.
**Fix:** a prop. Refs are for moments, props are for states.

**Symptom:** "I used a ref for performance."
**Cause:** treating re-renders as the cost rather than measuring one.
**Fix:** profile. If re-renders really are the problem, memoize or split — do not
hide data from React.

## Interview questions

**★ What is the one-line rule for choosing between a ref and state?**
Information used for rendering should be state — that is the reference's own
wording. The question is not whether the value changes or how often, but whether
anything on screen depends on it. A timer id, a socket or a previous value kept for
comparison is a ref; a counter that is displayed is state, no matter how much you
would prefer to avoid the re-render.

**★ Describe the "it works but the UI is stale" bug.**
A value is kept in a ref so an event handler can read the latest version, and the
same value is also rendered. The handler is genuinely correct — that is why the
pattern survives review — but the rendered output never updates, because changing a
ref does not re-render. It is often worse than a plain failure, since an unrelated
state change will re-render and make the correct value appear, so the UI looks
intermittently right.

**★ Why is a ref that hides a dependency worse than an eslint-disable?**
Both lie about what the effect depends on, but the ref leaves no evidence. Refs are
deliberately non-reactive, so `ref.current` cannot be a dependency and the linter
never has anything to flag — the array looks correct while the effect reads a frozen
value forever. The supported way to read the latest value without reacting to it is
`useEffectEvent`, which the linter understands.

**Someone says they used a ref to avoid re-renders. What do you say?**
That re-renders producing identical output are cheap — a function call and a diff
that finds nothing — and that hiding rendered data from React does not make the app
faster, it makes it intermittently wrong. If re-renders are genuinely the
bottleneck, the answers are memoization, moving state down, or splitting a context,
all of which keep React informed about what it is rendering.

**When is a ref unambiguously the right tool?**
When it is a handle to a DOM node, or a per-instance value that nothing rendered
depends on — a timeout id, a WebSocket, a third-party player instance, a previous
value kept only for comparison inside a handler. Those are the two legitimate uses
the `useRef` reference describes, and neither involves avoiding something.

---

← Prev: [`useImperativeHandle`](07-useimperativehandle.md) · Index: [Phase 5](README.md) · Next → [`useState` vs `useReducer`](09-usestate-vs-usereducer.md)
