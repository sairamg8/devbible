---
title: "What purity still allows"
sidebar_label: "02 · What is allowed"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure),
> including its *local mutation* section and its guidance that side effects
> belong in event handlers. No sandbox script backs this page; claims are cited,
> not measured.

**"React requires immutability" is a misleading summary that makes people afraid
of ordinary JavaScript. The rules constrain shared data, not your own scratch
objects — and they say nothing at all about what happens outside render.**

## Local mutation

react.dev grants the exception explicitly:

> However, **it's completely fine to change variables and objects that you've
> *just* created while rendering.**
>
> This is called **"local mutation"**—it's like your component's little secret.

```jsx
function TeaGathering() {
  const cups = [];                            // created during THIS render
  for (let i = 1; i <= 12; i++) {
    cups.push(<Cup key={i} guest={i} />);     // ✅ local mutation
  }
  return cups;
}
```

The test is a single question: **did this object exist before the render
started?**

| Object | Mutable during render? |
|---|---|
| Created in the function body | **Yes** — nothing outside can observe it |
| A prop, or anything reachable through one | No |
| State, or anything reachable through it | No |
| A value read from context | No |
| A ref, or `ref.current` | No — it exists before the render |
| A module-level variable | No |
| An element you created this render | Yes, but pointless — build it correctly instead |

So all of this is fine, and none of it needs a functional-programming rewrite:

```jsx
function Report({rows, filter}) {
  const visible = rows.filter(r => r.type === filter);  // new array — mine
  visible.sort(byDate);                                  // ✅ mutating my copy
  const byId = new Map();                                // mine
  for (const r of visible) byId.set(r.id, r);            // ✅
  let total = 0;
  for (const r of visible) total += r.amount;            // ✅
  …
}
```

`visible` came out of `filter`, which returns a new array, so sorting it in
place is safe. Sorting `rows` directly would not be. That one-line difference is
the entire rule in practice, and it is why `sort` deserves its reputation: it
reads like a query and is a mutation.

## Where side effects belong

Purity is a rule about **render**, not about your application. react.dev:

> In React, **side effects usually belong inside event handlers.**

Event handlers are not called during render. They run later, in response to
something the user did, so they sit outside the rule entirely. Fetching, writing
to `localStorage`, sending analytics, mutating a ref, calling an imperative
browser API, starting an animation — all unremarkable in a handler.

Only when no handler fits does an effect become the answer:

> If you've exhausted all other options and can't find the right event handler
> for your side effect, you can still attach it to your returned JSX with a
> `useEffect` call in your component.

The ordering in that sentence is deliberate, and it is the whole of Phase 4's
argument in advance: **event handler first, effect as the fallback.** Reaching
for `useEffect` by default is how most effect bugs start — an effect that
watches state in order to do something that the event which changed that state
could have done directly.

A quick placement guide:

| The side effect happens… | Put it in |
|---|---|
| Because the user did something | The event handler |
| Because the component appeared, and must connect to something external | An effect, with a cleanup that disconnects |
| Because a value changed and something outside React must follow it | An effect keyed on that value |
| Because you need a value derived from props or state | **Neither** — compute it during render |

The last row is the one that removes the most code. A great many effects exist
to compute something that was never a side effect at all.

## What impurity actually costs

Impurity does not usually break anything today, which is why the rule has to be
stated absolutely rather than as advice. It breaks something later, in one of
three tiers.

**Today, in development.** `StrictMode` double-invokes and the doubled damage is
visible — a counter that goes 2, 4, 6, a list with duplicate entries, a log line
printed twice. This is React telling you now rather than in production.

**On the next React feature you enable.** Memoization, `<Activity>`, offscreen
prerendering and the React Compiler all assume React may call your component
more or fewer times than you expected. An impure component gives a different
answer depending on that count, so the optimisation produces *wrong UI* rather
than faster UI. This is why enabling the Compiler sometimes "breaks" a
component: it did not break it, it exposed it.

**Under concurrent rendering.** React may begin a render, abandon the work, and
start again — a render that never commits. Any side effect it performed has
already happened and there is no mechanism to undo it. This is the failure with
no workaround and no warning, and it is the one that did not exist in the
synchronous model, where every render committed.

Ordered by when you find out, that is: immediately, on your next upgrade, or in
production under load. Only the first is comfortable.

## The rule is smaller than people think

Two summaries that cause unnecessary work, and what each should be:

**"React requires immutable data."** No — React requires that you not mutate
data other people can see. Build arrays with loops, sort your own copies, mutate
a `Map` you just created. Immer, `structuredClone` and deep-freeze are for
*state updates*, which is a different rule in Phase 3.

**"Never do anything except return JSX."** No — that is a rule about the render
function, and your component is mostly not render. Handlers can do anything.
Effects can do anything with a cleanup. The constraint applies to the ten lines
that compute the UI, not to the file.

Keeping the rule small matters, because a rule people believe is enormous is a
rule they eventually ignore.

## Gotchas

**Symptom:** a codebase spreads and clones every array before touching it, even
locally-built ones.
**Cause:** "React requires immutability" read as unconditional.
**Fix:** the test is whether the object predates the render. Local scratch
objects are yours; copying them is pure cost.

**Symptom:** a sort in a component reorders data somewhere else.
**Cause:** `sort` applied to a prop or a state array rather than to a copy.
**Fix:** `[...arr].sort()` or `arr.toSorted()`. Copy first, then mutate freely.

**Symptom:** an effect exists only to compute a value from props.
**Cause:** a derivation mistaken for a side effect.
**Fix:** compute it during render. No effect, no extra render, no moment of
wrong UI.

**Symptom:** an effect duplicates what a click handler could have done.
**Cause:** the effect watches the state the handler set, instead of the handler
doing the work.
**Fix:** move it into the handler. The docs' ordering — handlers first, effects
as fallback — exists for this.

**Symptom:** enabling the React Compiler changes a component's behaviour.
**Cause:** it is impure, and the extra memoization changed how often it runs.
**Fix:** fix the purity violation rather than opting the component out.

**Symptom:** an analytics event fires twice, or fires for a screen the user
never saw.
**Cause:** the side effect ran during a render — possibly one that was doubled
by `StrictMode`, or abandoned before commit.
**Fix:** handlers for user-caused events; an effect with cleanup for
appearance-caused ones.

## Interview questions

**★ Is mutation ever allowed during render?**
Yes — local mutation. Objects and arrays created inside that render are yours to
mutate, because nothing outside can observe them; building an array in a loop is
react.dev's own example. The forbidden case is mutating something that existed
before the render started: props, state, context, refs, module variables.

**★ Where do side effects belong?**
In event handlers first — they run in response to a user action rather than
during render, so they are outside the rule entirely. `useEffect` is the
fallback for effects with no corresponding event, and the documentation frames
it exactly that way: after you have exhausted the other options. And a
derivation from props or state is not a side effect at all — compute it during
render.

**★ Why does React care about purity, if the component looks like it works?**
Because React's freedom to call the component when and as often as it likes is
what makes batching, memoization, concurrent rendering and the Compiler
possible. An impure component's output depends on the call count, so those
features turn from optimisations into bugs. Under concurrent rendering a render
can be abandoned before it commits, and a side effect it already performed
cannot be rolled back.

**Is `arr.sort()` safe inside a component?**
Only on an array you created in that render. `sort` mutates in place, so
sorting a prop or a state array is a purity violation that will reorder data
other components are reading. Sorting the result of a `filter` or a spread is
fine, because that array is yours.

**Does purity mean you cannot use `let` or loops in a component?**
No. Local variables, loops, accumulators and mutable `Map`s built during the
render are all ordinary and all allowed. The constraint is on data that outlives
the render, not on the style of code that computes the UI.

**When does an impure component actually break?**
Three tiers: immediately in development, where `StrictMode`'s doubling makes the
damage visible; on the next React feature you enable, where memoization or the
Compiler changes the call count; and in production under concurrent rendering,
where an abandoned render has already performed a side effect that cannot be
undone. Only the first is easy to notice.

---

← Prev: [The two rules of a pure component](01-the-two-rules.md) ·
Index: [Purity](README.md) ·
Next → [StrictMode, the Compiler and how purity is enforced](03-strictmode-and-the-compiler.md)
