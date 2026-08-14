---
title: "The illegitimate fixes"
sidebar_label: "03 · The illegitimate fixes"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)
> and [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).
> No sandbox script backs this page; claims are cited, not measured.

**Two ways to make the linter stop complaining without changing what the effect
depends on. Both are documented, both are named as mistakes, and both produce the
same class of bug: an effect that reads one render's values forever.**

## The suppression, and exactly what it costs

> When dependencies don't match the code, there is a very high risk of introducing
> bugs. By suppressing the linter, **you "lie" to React about the values your
> Effect depends on.**

react.dev's worked example is a counter that increments by a configurable amount
each second:

```jsx
// ❌ Dangerous: Suppressed linter
useEffect(() => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

And the failure, in the docs' own words:

> The counter was supposed to increment by a configurable amount each second.
> However, by lying to React that the Effect doesn't depend on anything, **React
> forever keeps using the `onTick` function from the initial render.** Since
> `count` was `0` and `increment` was `1` at that time, `onTick` always calls
> `setCount(0 + 1)` every second, resulting in the counter **always showing 1.**

Read what actually happens there, because it is worse than "a stale value":

- The interval is created once and never recreated, which is what `[]` asked for.
- It calls the `onTick` from the **first** render, forever.
- That `onTick` closes over `count === 0` and `increment === 1`.
- So every tick sets the count to `1`. Not `1` more — **`1`**.

The counter is not lagging behind. It is frozen at the first render's arithmetic
while appearing to run. Nothing errors, the interval fires correctly, and the
increment control does nothing at all.

**This is the general shape of a suppressed dependency**, not a quirk of
intervals: the effect keeps a closure from one render and every value inside it is
permanently that render's. [Topic 03](../03-the-dependency-array.md) makes the same
argument from the rule; this is what it looks like when it happens.

And the verdict:

> **There's always a better solution than ignoring the linter!**

With [eight documented moves](README.md) available, that claim is not aspirational
— it is a statement about coverage. If none of the eight applies, the honest
conclusion is usually that the effect is doing something it should not be doing at
all.

## The ref used to hide a dependency

The subtler version, because nothing is disabled and no comment is written. From
[topic 04](../04-cleanup/01-the-cleanup-contract.md), react.dev flags this shape
directly:

```jsx
// 🚩 This won't fix the bug!!!
const connectionRef = useRef(null);
useEffect(() => {
  if (!connectionRef.current) {
    connectionRef.current = createConnection();
    connectionRef.current.connect();
  }
}, []);
```

Refs are attractive here precisely because they are **not reactive**
([topic 09](../09-effect-lifecycle.md)) — `ref.current` cannot be a dependency, so
reading a value through one makes the linter go quiet without any suppression
comment. The array looks clean. It is exactly as much of a lie as the
`eslint-disable`, with less evidence in the code.

Two distinct misuses share the shape:

- **A ref as a guard**, above — suppressing the *symptom* of a missing cleanup
  rather than writing one.
- **A ref as a smuggler** — storing a prop or state in `ref.current` so the effect
  can read it without declaring it. This one has a legitimate-looking cousin, and
  telling them apart matters: reading the *latest* value without reacting to it is
  a real requirement, and the sanctioned mechanism for it is
  [`useEffectEvent`](../10-useeffectevent.md). A ref hand-rolls the same idea
  without the linter rules, the call-site restrictions, or the unstable-identity
  assertion that catches misuse.

**The test:** would this effect still work if the ref were replaced by the value
it holds? If yes, declare the value. If the answer is "no, it would re-run too
often", the requirement is an Effect Event, not a ref.

## Why both fail the same way

Neither changes what the effect *depends on* — only what React has been *told*.
The effect still reads the value; the value still changes; React still has no
reason to re-synchronize. So the closure from the render where the effect last ran
becomes permanent, and every value captured in it freezes.

That is why the legitimate moves all work by **editing the code** until the array
is honest:

> When you're not happy with your dependencies, what you need to edit is the code.

## Gotchas

**Symptom:** an interval, subscription or listener runs but always acts on the
initial values — a counter stuck at 1, a poll that always requests page 1.
**Cause:** a suppressed dependency array. The effect keeps the first render's
closure forever.
**Fix:** one of the eight moves. For an interval calling a callback, that is
usually an Effect Event or the updater form.

**Symptom:** the linter is silent and the effect is still stale.
**Cause:** a ref is being used to read a reactive value, so nothing was ever
flagged.
**Fix:** replace the ref with the value and see what the linter says. If it needs
to be read but not reacted to, use `useEffectEvent`.

**Symptom:** `eslint-disable-next-line react-hooks/exhaustive-deps` appears in a
review with the justification "it only needs to run once".
**Cause:** the component-lifecycle model ([topic 09](../09-effect-lifecycle.md)) —
"once" is not something an effect can express.
**Fix:** ask what start and stop mean. If it truly must happen once per page load,
it belongs at module scope
([topic 04 · 03](../04-cleanup/03-when-cleanup-is-not-the-answer.md)).

**Symptom:** the increment control on a counter does nothing.
**Cause:** the exact bug above — the interval's callback is frozen at the first
render's `increment`.
**Fix:** remove the suppression and let the linter name the dependency, then apply
the appropriate move.

**Symptom:** a ref guard made the `StrictMode` double-run go away and a leak
appeared later.
**Cause:** the guard hid the stress test rather than fixing the effect.
**Fix:** delete the guard, write the cleanup
([topic 04](../04-cleanup/01-the-cleanup-contract.md)).

**Symptom:** none of the eight moves seems to apply.
**Cause:** usually the effect is doing something that is not synchronization at
all.
**Fix:** re-read [topic 06](../06-you-might-not-need-an-effect/README.md). The
answer is often that the effect should not exist.

## Interview questions

**★ Walk through the bug that suppressing the dependency array causes.**
react.dev's example is a counter that should increment by a configurable amount
every second. With `[]` and the linter suppressed, the interval is created once and
keeps calling the `onTick` from the initial render — which closed over `count === 0`
and `increment === 1`. So every tick calls `setCount(0 + 1)` and the counter always
shows **1**, never advancing and ignoring the increment control. It is not lagging;
it is frozen at the first render's arithmetic while appearing to run.

**★ Why is using a ref to hide a dependency worse than an eslint-disable?**
Because it produces the same lie with no evidence. Refs are deliberately
non-reactive, so `ref.current` cannot be a dependency and reading a value through
one silences the linter without any comment to find in review. The array looks
correct. The effect still reads a changing value, still never re-synchronizes, and
still freezes its closure — but nothing in the code marks the decision.

**★ When is reading a value without declaring it a legitimate requirement, and
what is the sanctioned way?**
When the effect must read the *latest* value but should not re-synchronize because
of it — the muted-chat case. That is a real requirement and the mechanism is
`useEffectEvent`, which the linter understands, which restricts where it can be
called, and whose intentionally unstable identity catches misuse at runtime. A ref
hand-rolls the same idea with none of those safeguards.

**What is the test for whether a ref is hiding a dependency?**
Replace the ref with the value it holds and see whether the linter flags it. If it
does, the dependency was always real. If the objection is "but then it would re-run
too often", the requirement is an Effect Event rather than a ref — you wanted to
read the value, not react to it, and there is a supported way to say that.

**Someone justifies a suppression with "this only needs to run once". What is the
response?**
That "once" is not something an effect can express — a component can mount more
than once, including on ordinary back-navigation in production. If the logic truly
must run once per page load, it belongs at module scope outside the component. If
it must run whenever synchronization is needed, then it has dependencies, and the
question is which of the eight documented moves applies.

**Is "there's always a better solution than ignoring the linter" actually true?**
It is a claim about coverage, and the page backs it with eight distinct moves:
move the value out of the component, move it into the effect, read primitives from
an object, calculate primitives from a pure function, use the updater form, extract
an Effect Event, move the code to an event handler, or split the effect. If none
fits, that is usually evidence the effect should not exist rather than evidence the
rule is wrong.

---

← Prev: [Restructuring the effect](02-restructuring-the-effect.md) · Index: [Removing dependencies](README.md)
