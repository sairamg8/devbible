---
title: "Timers, listeners and observers"
sidebar_label: "14 · Timers, listeners and observers"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — MDN
> [`removeEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener)
> (the matching rules, quoted) and
> [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
> (`observe` / `unobserve` / `disconnect`); react.dev
> [`useEffect`](https://react.dev/reference/react/useEffect) and
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies).
> `IntersectionObserver` exposes the same three-method shape as `ResizeObserver`;
> the semantics quoted below are MDN's for `ResizeObserver`.
> No sandbox script backs this page; claims are cited, not measured.

**The four browser APIs that make up most real effects. Each is a
[topic 04](04-cleanup/01-the-cleanup-contract.md) start/stop pair, and each has
one specific way of going wrong that is worth knowing before you meet it.**

| API | Start | Stop |
|---|---|---|
| `setInterval` / `setTimeout` | returns an id | `clearInterval(id)` / `clearTimeout(id)` |
| `addEventListener` | registers a handler | `removeEventListener` — **same reference and same `capture`** |
| `ResizeObserver` / `IntersectionObserver` | `observe(node)` | `unobserve(node)` or `disconnect()` |

## `setInterval` with a changing delay

The naive version, and why it is the exact bug from
[topic 11 · 03](11-removing-dependencies/03-the-illegitimate-fixes.md):

```jsx
// 🔴 the interval is created once and calls the FIRST render's callback forever
useEffect(() => {
  const id = setInterval(() => setCount(count + increment), delay);
  return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

The correct version separates the two things that can change — **how often** it
fires, and **what it does**:

```jsx
function Counter({ delay, increment }) {
  const [count, setCount] = useState(0);

  const onTick = useEffectEvent(() => {
    setCount(c => c + increment);        // reads the latest increment
  });

  useEffect(() => {
    const id = setInterval(() => onTick(), delay);
    return () => clearInterval(id);
  }, [delay]);                            // ✅ only the delay restarts it
}
```

Two mechanisms doing two jobs:

- **`delay` is a dependency**, so changing it clears the old interval and creates
  a new one. That is correct — the interval's *period* is part of what the effect
  synchronizes.
- **`increment` is not**, because `onTick` is an Effect Event
  ([topic 10](10-useeffectevent.md)) and reads the latest value without the effect
  reacting to it. Changing the increment must not restart the timer, or the tick
  would be delayed every time the user adjusted it.

The updater form `c => c + increment` removes `count` as well
([topic 11 · 02](11-removing-dependencies/02-restructuring-the-effect.md)). All
three techniques appear in one seven-line effect, which is why this is the
canonical exercise.

**Without `clearInterval`** every dependency change adds a timer. The old ones
keep firing, each holding its own render's closure, and the counter accelerates.

## `addEventListener` with a stable handler

```jsx
useEffect(() => {
  function handleScroll() {
    // ...
  }
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

The handler is declared **inside the setup** so both calls close over the same
binding ([topic 04 · 02](04-cleanup/02-cleanup-recipes.md)). MDN on why that
matters:

> The event listener to be removed is identified using a combination of **the
> event type, the event listener function itself,** and various optional options
> that may affect the matching process

> Calling `removeEventListener()` with arguments that do not identify any
> currently registered event listener on the `EventTarget` **has no effect.**

*No effect* — no error, no warning, no return value to check. A mismatched
removal is silent, and the listener stays attached while every subsequent setup
adds another.

### 🔴 Only `capture` participates in matching

The detail that catches people, quoted exactly:

> While `addEventListener()` will let you add the same listener more than once for
> the same type if the options are different, **the only option
> `removeEventListener()` checks is the `capture`/`useCapture` flag.** Its value
> must match for `removeEventListener()` to match, but the other values don't.

So given `element.addEventListener('mousedown', handleMouseDown, { passive: true })`:

| Removal call | Result |
|---|---|
| `removeEventListener('mousedown', h, { passive: true })` | succeeds |
| `removeEventListener('mousedown', h, { passive: false })` | **succeeds** |
| `removeEventListener('mousedown', h, { capture: false })` | succeeds |
| `removeEventListener('mousedown', h, { capture: true })` | **fails** |

`passive` and `once` are irrelevant to removal; forgetting to repeat `capture: true`
in the cleanup is a silent leak. And:

> **Warning:** If a listener is registered twice, one with the *capture* flag set
> and one without, you must remove each one separately.

## Observers

```jsx
useEffect(() => {
  const node = ref.current;
  if (!node) return;

  const observer = new ResizeObserver(entries => {
    // ...
  });
  observer.observe(node);

  return () => observer.disconnect();
}, []);
```

MDN's three methods, and the distinction the cleanup depends on:

> `observe()` — Initiates the observing of a specified `Element`.
>
> `unobserve()` — Ends the observing of a specified `Element`.
>
> `disconnect()` — **Unobserves all observed `Element` targets** of a particular
> observer.

**Prefer `disconnect()` in a cleanup.** If the effect created the observer, the
observer has no other observed targets, so disconnecting is both complete and
correct — and it cannot get the node wrong. `unobserve(node)` is for the case
where one long-lived observer watches many nodes and only one is going away.

Two React-specific details:

**Capture `ref.current` into a local `const`** at the top of the setup, and use
that in the cleanup. Reading `ref.current` inside the cleanup can give you a
different node — or `null` — because the ref may have been reassigned by then.
This is also why a ref cannot be a dependency
([topic 09](09-effect-lifecycle.md)); if the effect must react to the node
appearing, that is a ref callback ([topic 15](15-effects-and-refs.md)).

**An observer holds a reference to the node it observes.** So a missing
`disconnect()` keeps both the observer and the DOM node alive after the component
is gone — the most literal memory leak in this list.

## What the leaks actually look like

None of these throw. The symptoms are all behavioural:

| Missing cleanup | Symptom |
|---|---|
| `clearInterval` | the action accelerates — twice as fast, then three times |
| `removeEventListener` | handlers accumulate; one scroll runs N copies |
| `disconnect` | the callback fires for unmounted components; nodes are retained |
| `clearTimeout` | a delayed action fires after the user has moved on |

The shared tell is **"it gets worse the longer you use the app"** — or the more
times you visit that screen. Nothing is wrong on first load, which is why these
survive review and reach production.

## Gotchas

**Symptom:** a counter speeds up over time.
**Cause:** a missing `clearInterval`, so every dependency change leaves another
live timer.
**Fix:** return `() => clearInterval(id)`. The id from *this* setup, captured in
the closure.

**Symptom:** changing an interval's speed setting resets its progress each time.
**Cause:** the callback's values are dependencies, so the effect restarts for
reasons unrelated to timing.
**Fix:** `useEffectEvent` for the callback, leaving only `delay` in the array.

**Symptom:** `removeEventListener` runs and the listener stays attached.
**Cause:** either a different function reference, or a `capture` flag present on
one call and not the other. Only `capture` participates in matching.
**Fix:** declare the handler inside the setup, and repeat the options object —
including `capture` — exactly.

**Symptom:** one scroll or resize runs the handler many times.
**Cause:** accumulated listeners from repeated setups whose cleanups never
matched.
**Fix:** the same. Note there is no error to look for — a failed removal has *no
effect*.

**Symptom:** an observer callback fires for a component that has unmounted.
**Cause:** no `disconnect()` in the cleanup. The observer outlives the component
and holds the node.
**Fix:** `return () => observer.disconnect()`.

**Symptom:** the cleanup calls `unobserve(ref.current)` and misses.
**Cause:** `ref.current` may already be `null` or a different node by cleanup
time.
**Fix:** capture the node into a `const` at the top of the setup, and prefer
`disconnect()` for an observer the effect owns.

**Symptom:** a `setTimeout` action fires after the user navigated away.
**Cause:** no `clearTimeout`. A timeout is a start/stop pair like anything else.
**Fix:** clear it. "It only fires once" is not a reason to skip cleanup.

## Interview questions

**★ Write an interval whose delay and whose action can both change.**
Put `delay` in the dependency array, because the period is part of what the effect
synchronizes and changing it should genuinely restart the timer. Put the action in
a `useEffectEvent`, so it reads the latest props and state without the effect
re-running — otherwise adjusting the increment would reset the tick. Use the
updater form inside so the current count is not a dependency either. And return
`() => clearInterval(id)`.

**★ Why can `removeEventListener` fail silently, and what are the two causes?**
Because MDN specifies that calling it with arguments that do not identify a
registered listener has *no effect* — no error, no warning. The two causes are a
different function reference (an inline arrow, or a handler recreated between
setup and cleanup) and a mismatched `capture` flag. Notably `capture` is the
*only* option that participates in matching: `passive` and `once` can differ and
removal still succeeds.

**★ When do you use `unobserve` and when `disconnect`?**
`disconnect()` unobserves all of that observer's targets, `unobserve(node)` stops
just one. In an effect that created its own observer, `disconnect()` is the right
cleanup — the observer has no other targets, so it is complete, and it cannot get
the node wrong. `unobserve` is for a long-lived shared observer watching many
nodes where only one is going away.

**Why capture `ref.current` into a local variable at the top of the setup?**
Because by the time the cleanup runs, the ref may hold a different node or `null`
— it is mutable and deliberately outside React's data flow. Capturing it in a
`const` means the cleanup releases exactly the node the setup acquired, which is
the symmetry the cleanup contract requires.

**What do these leaks look like in practice?**
They never throw. An uncleaned interval makes the action accelerate; uncleaned
listeners make one event run many handlers; an uncleaned observer fires for
unmounted components and retains DOM nodes. The shared signature is that the app
degrades the longer it runs or the more times a screen is visited — fine on first
load, which is exactly why they reach production.

**Why is an observer's missing cleanup the most literal memory leak here?**
Because the observer holds a reference to the node it observes. Without
`disconnect()`, the observer survives the component and keeps the DOM node
reachable, so neither can be collected — and the callback keeps running against a
component that no longer exists.

---

← Prev: [Effect ordering](13-effect-ordering.md) · Index: [Phase 4](README.md) · Next → [Effects and refs together](15-effects-and-refs.md)
