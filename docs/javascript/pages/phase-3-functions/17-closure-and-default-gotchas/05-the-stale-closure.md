---
title: "17.5 · The stale closure, framework-scale"
sidebar_label: "5 · The stale closure"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`clearInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearInterval) — and react.dev for the framework case: [State as a snapshot](https://react.dev/learn/state-as-a-snapshot), [Queueing a series of state updates](https://react.dev/learn/queueing-a-series-of-state-updates), [Referencing values with refs](https://react.dev/learn/referencing-values-with-refs), [Removing Effect dependencies](https://react.dev/learn/removing-effect-dependencies). Documentation-validated; **no timings**.

**Everything on this page is [17.4](./04-snapshots-and-the-four-fixes.md)'s "too many bindings",
at the scale where a framework creates the extra bindings for you** — dozens per second, without
being asked.

This is the bug people mean when they say "stale closure". It is worth its own chunk not because
the mechanism differs — it does not — but because **the framework hides the step where the new
binding is created**, and that step is the whole explanation.

## Why a re-render creates new closures

A React component is a function. Every render calls it again. Every call creates **new local
bindings and new function objects** closing over them:

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  // 🔴 a NEW `handleClick`, closing over a NEW `count`, on every single render
  const handleClick = () => console.log(count);

  return <button onClick={handleClick}>{count}</button>;
}
```

🔴 **`count` is not a variable that changes. It is a `const` that is different in every render.**
react.dev states this directly — state behaves as a *snapshot*: the render that produced a
particular piece of UI captured a particular value, and that value never changes for that render.

So there is no "stale" variable anywhere. There are twenty `count` bindings, one per render, and
the question is only ever **which render's closure is still installed somewhere.**

⚠️ **This is why the bug is a framework bug and not a React bug.** Any system that re-invokes your
function to produce new output — Vue's `setup` with `watchEffect`, Solid's effects, a template
engine rebuilding handlers, even a plain `render()` you wrote yourself that re-registers listeners
— creates the same shape.

## The interval that logs 0 forever

The canonical case, and the one worth being able to explain cold:

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count);        // 🔴 0, 0, 0, 0 … forever
      setCount(count + 1);       // 🔴 always sets 1
    }, 1000);
    return () => clearInterval(id);
  }, []);                        // ← the empty dependency list is the cause
}
```

Read it as bindings rather than as behaviour:

1. Render 0 runs. `count` is `0`. The effect creates an interval whose callback closes over
   **render 0's `count`**.
2. The empty dependency list means the effect **never runs again**, so that interval and that
   closure survive every later render.
3. Every tick reads render 0's `count` — which is `0`, permanently — and calls
   `setCount(0 + 1)`, which sets `1` every time.

The counter reaches `1` and stops. **Neither `setInterval` nor `useState` is behaving oddly**; the
closure is simply the one from render 0, and render 0's `count` is `0`.

⚠️ **The symptom is diagnostic.** From [17.3](./03-which-binding-did-you-get.md): the wrong value
is the **first** one, not the last — so this is "too many bindings", and the fixes are the ones
that stop capturing a value.

## The three fixes, and which one to reach for

Framework-scale versions of fixes 2, 3 and 4 from
[17.4](./04-snapshots-and-the-four-fixes.md).

### 1 · The functional updater — the default answer

```jsx
setInterval(() => setCount((c) => c + 1), 1000);   // ✅ never reads `count` at all
```

🔴 **The updater form receives the current value as an argument, so there is nothing to capture.**
react.dev documents this as the way to queue a series of updates: each queued function is applied
to the result of the previous one, so multiple updates in one tick compose correctly instead of
overwriting each other.

**Reach for this first whenever the new value is derived from the old one.** It removes the
dependency rather than declaring it, which is why it is a better fix than adding `count` to the
dependency array.

⚠️ **It only solves updates, not reads.** If the callback needs to *log* or *send* the current
value rather than compute the next one, the updater gives you nothing.

### 2 · A ref — for reads that must be current

```jsx
const countRef = useRef(count);
countRef.current = count;                          // updated on every render

useEffect(() => {
  const id = setInterval(() => report(countRef.current), 1000);   // ✅ always current
  return () => clearInterval(id);
}, []);
```

A ref is precisely the `{ current }` box from [17.4](./04-snapshots-and-the-four-fixes.md): an
object whose **identity is stable across renders**, so a closure that captured it in render 0 is
still holding the same box in render 20.

**Right when** a long-lived callback must read the latest value but should not be recreated —
intervals, event listeners on `window`, a subscription with an expensive setup.

⚠️ **Costs, and they are real.** Reading a ref during render is not safe (react.dev says to
neither read nor write `ref.current` during rendering), refs do not trigger re-renders, and a
callback reading a ref is no longer a pure function of its render's props and state — which is
exactly the property that made the snapshot model easy to reason about. **Use it deliberately, not
as a way to silence a dependency warning.**

### 3 · An honest dependency list — recreate the closure

```jsx
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, [count]);                                       // ✅ tears down and re-creates each change
```

Fix 3 from the previous chunk, automated: when `count` changes, the cleanup runs, the interval is
cleared, and a new one is created over the new binding.

**Right when** setup is cheap and the value changes rarely. 🔴 **Wrong for a once-per-second
interval that depends on a once-per-second value** — you tear down and rebuild the timer on every
tick, which resets its phase and can drop or double ticks.

⚠️ **The cleanup is what makes this correct.** Without `clearInterval` in the returned function you
get an *additional* interval per change, all of them live, all logging — the "handler runs twice"
gotcha from [17.4](./04-snapshots-and-the-four-fixes.md) at compounding scale.

### Choosing

| The callback needs to… | Fix |
|---|---|
| compute the next value from the current one | **updater** — `setX(x => …)` |
| read the latest value, and must not be recreated | **ref** |
| act on a value that changes rarely, cheap setup | **dependency list + cleanup** |
| act on the value *as of when it was created* | none — the snapshot is correct |

**The last row matters and is usually forgotten.** A "cancel this upload" handler should target the
upload it was created for, not whatever is current. Not every captured value is a bug — sometimes
it is the requirement.

## The lint rule, and the fix that is not a fix

The exhaustive-dependencies lint rule reports the empty list in the interval example. There are
three ways to respond, and only two are legitimate:

- ✅ **Add the dependency** and accept the teardown/recreate cycle.
- ✅ **Remove the dependency** — restructure so the effect no longer needs the value, usually with
  the updater form. react.dev frames dependency removal as changing the code so the dependency is
  genuinely not needed.
- 🔴 **Silence the rule with a suppression comment.** This is the response that ships the bug. The
  rule is not being pedantic — it is reporting, precisely, that a closure is holding a binding that
  the framework will replace.

⚠️ **A dependency array is a claim about what a closure captured**, and the lint rule checks that
claim against the closure's body. A suppressed warning is a lie about capture, and the stale
closure is the consequence rather than the annoyance.

## Diagnosing it in a framework

**Check whether the wrong value is the first one.** A handler stuck on the initial value is the
signature. If it is stuck on the *previous* value instead, suspect a snapshot taken one render
late — a ref assigned in the wrong place, or a value read during render.

**Log inside the callback, not in the component body.** The component body runs per render and
will happily print the current value while the installed closure holds an older one — which reads
as "the state is fine, the callback is broken" and sends people to the wrong place.

**Look at the dependency list before the callback body.** In practice the empty array is the bug
far more often than anything inside the function.

**Count your effects.** An effect that sets up without cleaning up leaves one live closure per
render. The tell is a symptom that gets *worse over time* — logs multiplying, an interval firing
several times a second — which is a cleanup bug, not a capture bug, and needs the opposite fix.

## Gotchas

**Symptom:** A counter driven by `setInterval` reaches 1 and stops
**Cause:** The interval closed over render 0's state and calls `setCount(0 + 1)` every tick; an empty dependency list keeps that closure alive forever.
**Fix:** The functional updater `setCount(c => c + 1)`, which captures nothing.

**Symptom:** A callback logs the initial value forever
**Cause:** Too many bindings — the framework made new ones per render and this closure holds render 0's.
**Fix:** A ref for reads, the updater for writes, or an honest dependency list.

**Symptom:** A callback is one update behind rather than stuck at the first value
**Cause:** A snapshot taken one render late — typically a ref assigned somewhere that runs before the new value is available.
**Fix:** Assign the ref where it is guaranteed to see the new render's value, and never read it during render.

**Symptom:** The lint warning was suppressed and the bug appeared
**Cause:** The dependency array is a claim about what the closure captured; suppressing the warning does not change the capture.
**Fix:** Add the dependency, or restructure so it is genuinely not needed.

**Symptom:** Logs multiply — two, then four, then eight per second
**Cause:** An effect sets up on every change without cleaning up, so every render's closure stays live.
**Fix:** Return a cleanup function that clears the interval or removes the listener. This is the opposite failure to a stale closure.

**Symptom:** Adding the dependency fixed the value but broke the timing
**Cause:** The effect now tears down and recreates the interval on every change, resetting its phase.
**Fix:** Use the updater or a ref so the interval can be created once.

**Symptom:** State looks correct in a `console.log` in the component body but wrong in the handler
**Cause:** The body runs per render with the current value; the installed handler is an older closure.
**Fix:** Log inside the callback — that is the only place that shows what the closure holds.

**Symptom:** A "cancel" button acted on the wrong item after switching selection
**Cause:** A ref was used to make the handler read the latest value, but this handler needed the value as of creation.
**Fix:** Capture deliberately here — the snapshot was the requirement, not the bug.

## Interview questions

**★ Why is state described as a snapshot?**
Because a component is a function that is called again per render, and each call creates its own
`const` bindings. A given render's state value never changes — later renders have *different*
bindings. So a "stale closure" is not a variable that failed to update; it is an old render's
binding still being held by a callback that is still installed.

**★ Walk through the `setInterval` counter that stops at 1.**
Render 0 creates an interval whose callback closes over render 0's `count`, which is `0`. The
empty dependency list means the effect never re-runs, so that closure survives every render. Each
tick reads `0` and calls `setCount(0 + 1)`, setting `1` every time. Neither the timer nor the state
hook is misbehaving.

**★ What are the three fixes and when does each apply?**
The functional updater when the new value derives from the old — it captures nothing. A ref when a
long-lived callback must *read* the latest value without being recreated. An honest dependency list
with cleanup when setup is cheap and the value changes rarely. If the callback should act on the
value as of when it was created, none applies — the snapshot is correct.

**★ Why is the updater usually better than adding the dependency?**
Because it removes the dependency rather than declaring it, so the effect can be created once. It
also composes: several queued updates in one tick each receive the previous result instead of
overwriting one another. Adding the dependency instead makes the effect tear down and rebuild on
every change, which resets an interval's phase.

**★ What is a ref, in closure terms?**
An object with a stable identity across renders — the `{ current }` box. A closure that captures it
in render 0 still holds the same object in render 20, so it always reads whatever was last written
there. The cost is that the callback is no longer a pure function of its render, and refs must not
be read or written during rendering.

**★ Is suppressing the exhaustive-deps warning ever the right call?**
Essentially never as a fix. The array is a claim about what the closure captured, and the rule
checks that claim; suppressing it leaves the capture unchanged and hides the report. Either add
the dependency or restructure so it is not needed.

**★ How do you tell a stale-closure bug from a missing-cleanup bug?**
By the direction the symptom moves. Stale closure is **stuck** — the same wrong value forever.
Missing cleanup gets **worse** — handlers multiplying as every render leaves another live closure.
They need opposite fixes, and confusing them is why "I added a dependency and it got worse" happens.

**Is this a React-specific problem?**
No. It appears in any system that re-invokes your function to produce new output and leaves an
earlier callback installed. React just makes it common by re-rendering often — the mechanism is the
plain-JavaScript one from the previous chunk.

---

← [17.4 · Snapshots and the four fixes](./04-snapshots-and-the-four-fixes.md) · [Topic index](./README.md) · [Phase index](../README.md)
