---
title: "Updater functions"
sidebar_label: "03 · Updater functions"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates)
> and [`useState`](https://react.dev/reference/react/useState) caveats. No
> sandbox script backs this page; claims are cited, not measured. The mechanical
> queue trace is [topic 13](13-the-update-queue.md).

**`setCount(c => c + 1)` is not a stylistic alternative to `setCount(count + 1)`.
They mean different things, and there are exactly three situations where only
one of them is correct.**

## The two forms

```jsx
setCount(count + 1);        // "replace with this value"
setCount(c => c + 1);       // "apply this transformation"
```

The first captures a value computed from the current render's snapshot. The
second hands React a function to run later, against whatever the state is when
the update is processed.

react.dev:

> An **updater function** (e.g. `n => n + 1`) gets added to React's queue and is
> processed based on the previous state in the queue.

"Previous state in the queue" is the operative phrase — not "previous state in
the render". If three updaters are queued, the second sees the first's result.

## The three cases where the updater form is required

Everywhere else it is a preference. These three are correctness.

**1. More than one update to the same state in one event.**

```jsx
function onClick() {
  setCount(count + 1);
  setCount(count + 1);      // 🔴 both are setCount(0 + 1) → 1
}

function onClick() {
  setCount(c => c + 1);
  setCount(c => c + 1);     // ✅ → 2
}
```

The snapshot does not change between the two lines
([topic 02](02-state-is-a-snapshot.md)), so the value form cannot express "twice".

**2. The update runs later than the render that created it** — a timeout, an
interval, a promise `.then`, an event listener registered once.

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);   // 🔴 frozen at 0+1
  return () => clearInterval(id);
}, []);                                                       // no `count` dep

useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000);  // ✅
  return () => clearInterval(id);
}, []);
```

This is the highest-value one in practice, because the updater form does more
than fix the value: it removes `count` from the effect's dependencies entirely,
so the interval stops being torn down and recreated every second. **The updater
form is frequently the fix for a dependency-array problem**, not just a value
problem.

**3. Several sources update the same state concurrently.** Two handlers, an
effect and a subscription all incrementing the same counter cannot each read a
consistent snapshot. The transformation form composes; the value form races.

## When the value form is fine

Do not over-apply this. The value form is clearer when it is correct, and it is
correct whenever the new value does not depend on the old one:

```jsx
setName(e.target.value);         // ✅ replaces — nothing to derive from
setSelected(id);                 // ✅
setOpen(false);                  // ✅ a specific value, not a toggle
setItems(data);                  // ✅ fresh data from a fetch
```

The rule in one line: **derive from the previous value → updater; supply a new
value → plain value.**

The borderline case is a toggle. `setOpen(!open)` is correct when it is the only
update in the handler and nothing async is involved — which is most toggles. But
`setOpen(o => !o)` is never wrong, costs nothing, and survives the code being
moved into a callback later. Most codebases settle on the updater form for
toggles for exactly that reason.

## Updaters must be pure

They are held to the same rule as component bodies, and the docs say so
explicitly:

> In Strict Mode, React will **call your updater function twice** in order to
> help you find accidental impurities. This is development-only behavior and
> does not affect production. If your updater function is pure (as it should be),
> this should not affect the behavior. The result from one of the calls will be
> ignored.

So an updater must take the previous state and return the next one, and do
nothing else:

```jsx
setItems(items => {
  analytics.track('added');           // 🔴 side effect — will fire twice
  return [...items, newItem];
});

setItems(items => {
  items.push(newItem);                // 🔴 mutation — returns undefined too
  return items;
});

setItems(items => [...items, newItem]);   // ✅
```

The mutation version is doubly broken: it mutates state, and because the updater
returns the same array reference, React's `Object.is` check sees no change and
may skip the render entirely ([topic 11](11-bailing-out.md)).

## Naming

react.dev documents the convention rather than inventing one:

> It's common to name the updater function argument by the first letters of the
> state variable:
>
> ```js
> setEnabled(e => !e);
> setLastName(ln => ln.reverse());
> setFriendCount(fc => fc * 2);
> ```
>
> Or use the full state variable name:
>
> ```js
> setEnabled(enabled => !enabled);
> setEnabled(prevEnabled => !prevEnabled);
> ```

All three are used in real code. The initials form is terse and fine for short
updaters; `prevX` is the clearest when the body is more than one line, because
it says out loud that this is not the render's `x`.

**One real hazard in the full-name form:** `setEnabled(enabled => !enabled)`
shadows the outer `enabled`. That is what you want — but if you write
`setEnabled(() => !enabled)` by mistake, dropping the parameter, it silently
reads the outer snapshot again and you are back to the bug you were fixing. The
initials form makes that impossible to write by accident.

## Mixing values and updaters

Legal, and the ordering is exactly what you would expect: React processes the
queue in order, a value replaces whatever came before, and an updater transforms
it. [Topic 13](13-the-update-queue.md) has the documented trace tables and the
technique for predicting the result on paper.

The practical advice is to not mix them in one handler unless you mean to. A
`setX(value)` after a `setX(updater)` throws the updater's work away, which is
occasionally intentional ("reset to 42 regardless") and much more often a bug.

## Gotchas

**Symptom:** two increments in one handler produce one.
**Cause:** both read the same snapshot.
**Fix:** the updater form.

**Symptom:** an interval increments once and stops.
**Cause:** the callback closes over the first render's value and keeps setting
the same number; React bails out of the re-render because the value is
unchanged.
**Fix:** the updater form — which also removes the state from the effect's
dependency array.

**Symptom:** an effect re-subscribes constantly.
**Cause:** the state it sets is also in its dependency array.
**Fix:** the updater form removes the need for the dependency.

**Symptom:** an updater's side effect fires twice in development.
**Cause:** `StrictMode` double-invokes updaters, because they must be pure.
**Fix:** move the side effect to the event handler. The updater returns a value
and does nothing else.

**Symptom:** state does not update even with an updater.
**Cause:** the updater mutated and returned the same object, so `Object.is` sees
no change.
**Fix:** return a new object or array.

**Symptom:** `setX(() => value)` behaves oddly.
**Cause:** that is an updater that ignores the previous state and returns
`value` — which is usually what was meant, *unless* the state is itself a
function, in which case the functional form is the only way to store one.
**Fix:** be deliberate. `setCallback(() => fn)` is how you put a function *in*
state; `setCallback(fn)` would call `fn` as an updater.

## Interview questions

**★ When is the updater form required rather than optional?**
Three cases: more than one update to the same state within a single event;
an update that runs later than the render that created it — a timeout, interval,
promise callback or a listener registered once; and several independent sources
updating the same state. Everywhere else, when the new value does not derive
from the old one, the plain value form is clearer and correct.

**★ What does the updater receive?**
The pending state — the result of every update already queued ahead of it, not
the value from the current render's snapshot. That is exactly why three queued
updaters compose to +3 while three queued values do not.

**★ Why does the updater form fix an effect that re-subscribes constantly?**
Because it removes the reason to depend on the state at all. `setCount(c => c+1)`
does not read `count`, so `count` need not be in the dependency array, so the
effect stops being torn down and recreated on every change. The stale-value fix
and the dependency fix are the same fix.

**Must an updater be pure?**
Yes. React double-invokes updaters in StrictMode precisely to surface impurity,
discarding one result. An updater takes the previous state and returns the next
one; anything else — logging, analytics, mutation — belongs in the event
handler.

**What happens if an updater mutates and returns the same object?**
Two failures at once: it violates the immutability rule, and because the
reference is unchanged, `Object.is` reports no change and React may skip the
re-render. The UI silently keeps showing the old value even though the data
changed.

**Is `setOpen(!open)` wrong?**
Not usually. It is correct when it is the only update to that state in the
handler and nothing asynchronous is involved. `setOpen(o => !o)` is never wrong
and survives the code later being moved into a callback, which is why most
codebases standardise on it for toggles.

---

← Prev: [State is a snapshot](02-state-is-a-snapshot.md) · Index: [Phase 3](README.md) · Next → [Automatic batching](04-automatic-batching.md)
