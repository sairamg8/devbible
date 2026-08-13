---
title: "useEffect anatomy"
sidebar_label: "02 · useEffect anatomy"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useEffect`](https://react.dev/reference/react/useEffect) and
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).
> No sandbox script backs this page; claims are cited, not measured.

**Three arguments' worth of behaviour: a setup function, an optional cleanup it
returns, and a dependency array with three distinct forms. Knowing exactly when
each form re-runs removes most effect confusion before it starts.**

## The shape

```jsx
useEffect(
  () => {                          // setup — runs after commit
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => {                 // cleanup — optional
      connection.disconnect();
    };
  },
  [serverUrl, roomId]              // dependencies — optional
);
```

Three parts, and each has one job:

- **Setup** starts synchronising. It runs after React has committed to the DOM.
- **Cleanup** stops synchronising. It must undo what setup did
  ([04](04-cleanup.md)).
- **Dependencies** decide when to stop and start again — they are not a schedule
  ([03](03-the-dependency-array.md)).

## The three forms

They are genuinely three different behaviours, not degrees of the same one.

**No array — after every commit**

```jsx
useEffect(() => {
  // ...
});                                // Runs after every commit
```

> Your Effect runs **after every single commit** of your component.

Rarely what you want, and usually a forgotten array. It is legitimate when the
effect must observe every render — a render logger, or synchronising something
that genuinely depends on everything.

**Empty array — after the initial commit only**

```jsx
useEffect(() => {
  // ...
}, []);                            // Runs only after initial commit
```

> Your Effect runs **only after the initial commit.** Even with empty
> dependencies, setup and cleanup will run one extra time in development to help
> you find bugs.

This is the form that gets abused as `componentDidMount`. It is correct only
when the setup genuinely reads **no reactive values** — a global event listener
with a stable handler, an observer on a ref. If the setup reads a prop or state,
an empty array is a lie ([03](03-the-dependency-array.md)).

**Populated array — initial commit, then when a dependency changes**

```jsx
useEffect(() => {
  // ...
}, [dep1, dep2]);
```

> Your Effect runs **after the initial commit *and* after commits with changed
> dependencies.** React will compare each dependency with its previous value
> using the `Object.is` comparison.

`Object.is`, per dependency, positionally. Which is why an object or array
literal in the list makes the comparison fail every time
([Phase 3 · 17](../phase-3-state/17-infinite-render-loops.md)).

## The re-run sequence

When a dependency changes, React does **not** just run setup again:

> After every commit with changed dependencies, React will first run the cleanup
> function (with the old values)

So the order is **cleanup(old) → setup(new)**. The cleanup closes over the values
from the render that created it, which is exactly what makes it able to undo the
right thing — it disconnects from the *old* room, not the new one.

At unmount:

> After your component is removed from the DOM, React will run your cleanup
> function one final time.

And in development, one extra cycle before the first real setup
([05](05-strictmode-double-invocation.md)).

## The array must be a constant-size literal

Dependencies are matched positionally, like hook slots. So:

```jsx
useEffect(fn, [a, b]);                      // ✅
useEffect(fn, cond ? [a] : [a, b]);         // 🔴 size changes
useEffect(fn, deps);                        // 🔴 not inline — linter cannot see it
```

React warns when the array size changes between renders. The second problem is
subtler: passing a variable defeats the lint rule that would otherwise tell you
what is missing, which is the main protection against the bug in
[topic 03](03-the-dependency-array.md).

## Setup runs after the commit, not after render

The distinction matters for what you can do inside:

- **The DOM exists.** Refs are attached, so measuring and focusing work.
- **State updates inside an effect are batched** and cause another render.
- **You are after the commit but not necessarily after paint** — the
  interaction-caused caveats from [topic 01](01-what-an-effect-is-for.md) mean
  the relationship to paint is not guaranteed in either direction. For a
  guarantee, `useLayoutEffect` ([12](12-uselayouteffect.md)).

## Async setup is not allowed — the function itself

```jsx
useEffect(async () => {            // 🔴 returns a Promise, not a cleanup
  const data = await fetch(url);
}, [url]);
```

An `async` function returns a promise, and React expects the return value to be
a cleanup function. React warns about this. The documented shape declares an
inner async function:

```jsx
useEffect(() => {
  let ignore = false;
  async function startFetching() {
    const json = await fetchTodos(userId);
    if (!ignore) setTodos(json);
  }
  startFetching();
  return () => { ignore = true; };
}, [userId]);
```

The `ignore` flag is the race-condition guard, which has its own topic
([08](08-race-conditions.md)) — but note how it falls out of the anatomy: the
cleanup runs before the next setup, so it can invalidate the in-flight request
that the previous setup started.

## One effect per concern, not one per component

A component may have as many effects as it has things to synchronise, and it
should:

```jsx
useEffect(() => { /* connect to the room */ }, [roomId]);
useEffect(() => { /* log a page view */ }, [pageId]);
```

Merging these means the connection is torn down whenever `pageId` changes, for
no reason. **Split by what the effect synchronises, not by when it runs** — which
is the same argument as [topic 09](09-effect-lifecycle.md), arrived at from the
anatomy.

## Gotchas

**Symptom:** the effect runs after every render.
**Cause:** no dependency array, or a dependency that is a new reference each
render.
**Fix:** the docs' own debugging step — `console.log([dep1, dep2])` next to the
effect and watch which entry changes every time.

**Symptom:** `useEffect must not return anything besides a function`.
**Cause:** an `async` setup function, which returns a promise.
**Fix:** declare an inner async function and call it.

**Symptom:** the cleanup uses new values, not the ones it should undo.
**Cause:** a misreading — the cleanup closes over the render that created it, so
it *does* see the old values. If it does not, something outside the closure is
being read, such as a ref.
**Fix:** capture what you need in the setup body.

**Symptom:** `The final argument passed to useEffect changed size between
renders`.
**Cause:** a conditional dependency array.
**Fix:** a constant-size literal. Move the condition inside the setup.

**Symptom:** an unrelated subscription tears down when a different prop changes.
**Cause:** two concerns merged into one effect, so its dependency list is the
union of both.
**Fix:** split it. Two effects with two dependency lists.

**Symptom:** the linter says nothing about a clearly missing dependency.
**Cause:** the array is a variable rather than an inline literal, so the rule
cannot analyse it.
**Fix:** inline it.

## Interview questions

**★ What are the three forms of the dependency array?**
No array runs the effect after every commit. An empty array runs it after the
initial commit only. A populated array runs it after the initial commit and after
any commit where a dependency changed, compared with `Object.is` positionally.
They are three distinct behaviours, and the empty array is the one most often
used incorrectly.

**★ What order do setup and cleanup run in when a dependency changes?**
Cleanup first, with the old values, then setup with the new ones. The cleanup
closes over the render that created it, which is what lets it undo the right
thing — disconnect from the old room rather than the new one. At unmount the
cleanup runs one final time.

**★ Why can't the setup function be `async`?**
Because React expects its return value to be a cleanup function, and an `async`
function returns a promise. The documented shape is to declare an inner async
function inside the setup and call it, returning a real cleanup — which is also
where the `ignore` flag for race conditions naturally lives.

**When is an empty dependency array correct?**
When the setup reads no reactive values at all — a window event listener with a
handler that closes over nothing changing, or an observer attached to a ref. If
the setup reads a prop or a state variable, an empty array is a lie and the
effect will keep using the first render's values.

**Should a component have one effect or several?**
As many as it has distinct things to synchronise. Merging two concerns produces
a dependency list that is the union of both, so each one tears down and restarts
for the other's reasons. Split by what is being synchronised, not by when the
code should run.

**Why must the dependency array be an inline literal of constant size?**
Dependencies are compared positionally, so a changing size is meaningless and
React warns about it. And passing a variable instead of a literal defeats the
lint rule that would otherwise tell you which dependencies are missing — which is
the main protection against the effect silently reading stale values.

---

← Prev: [What an effect is for](01-what-an-effect-is-for.md) · Index: [Phase 4](README.md) · Next → [The dependency array is not a preference](03-the-dependency-array.md)
