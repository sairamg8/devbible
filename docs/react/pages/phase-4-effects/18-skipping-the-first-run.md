---
title: "Skipping the first run"
sidebar_label: "18 · Skipping the first run"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
> (§ the ref anti-fix), [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Adjusting some state when a prop changes) and
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies).
> ⚠️ **react.dev documents no recommended "skip the first run" pattern.** This page
> says so, rather than presenting one as sanctioned.
> No sandbox script backs this page; claims are cited, not measured.

**"Run this when `x` changes, but not on mount" is one of the most common things
people want from an effect, and the usual implementation is the anti-fix this
phase has warned about three times. The honest answer is that the requirement is
almost always a sign the code is in the wrong place.**

## The pattern

```jsx
// 🔴 the shape to recognise
const isFirst = useRef(true);
useEffect(() => {
  if (isFirst.current) {
    isFirst.current = false;
    return;
  }
  doSomething(value);
}, [value]);
```

It is the same shape as the guard react.dev flags directly:

> ```js
> // 🚩 This won't fix the bug!!!
> const connectionRef = useRef(null);
> useEffect(() => {
>   if (!connectionRef.current) { … }
> }, []);
> ```
>
> This makes it so you only see the setup once in development, but **it doesn't
> fix the underlying bug.**

Named variously `isFirst`, `hasRun`, `didMount`, `isFirstRender`, `didInit` — and
[topic 11 · 03](11-removing-dependencies/03-the-illegitimate-fixes.md) covers why
a ref is the *worst* place to hide this, since refs are non-reactive and the linter
never objects.

## Why it is usually wrong

**Three separate problems**, and each is enough on its own.

**"First" is not a stable idea.** A component mounts more than once — on
back-navigation, on a tab switch, on a route change and return. Each remount resets
the ref, so "skip the first run" means "skip the first run *of this mount*", which
is rarely what anyone meant.

**`StrictMode` sees through it.** The extra development cycle runs setup, cleanup,
setup ([topic 05](05-strictmode-double-invocation.md)); a naive guard makes the
symptom vanish while leaving whatever the double-invocation was pointing at.

**It usually means the logic was event logic.** If something should happen when the
user *changes* a value and not when the page loads, the thing that distinguishes
those two is *the user acting* — which the effect cannot see
([topic 06 · 01](06-you-might-not-need-an-effect/01-logic-that-belongs-to-an-event.md)):

> By the time an Effect runs, you don't know *what* the user did.

The guard is an attempt to reconstruct that information from render counting, which
is exactly as reliable as it sounds.

## What to do instead

**If an interaction caused it → the event handler.** The handler knows a change
happened *and* knows it was the user. No guard needed, because handlers do not run
on mount.

**If a prop changing is genuinely the trigger → compare the previous value during
render.** react.dev's documented pattern for adjusting state on a prop change:

```jsx
function List({ items }) {
  const [selection, setSelection] = useState(null);

  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
}
```

This is the closest thing to a sanctioned "not on the first run", and note *why* it
works: it does not count renders, it **compares values**. On the first render
`items === prevItems` because that is what the state was initialised to, so the
branch does not run — not by a special case, but because nothing changed. The
condition means what it says.

react.dev immediately pushes back on even this, though:

> **However, most components shouldn't need this pattern either.**

**If the effect is fine but one part should not react → an Effect Event.** Reading
the latest value without re-synchronizing is a real, supported requirement
([topic 10](10-useeffectevent.md)) — and unlike a ref guard, the linter understands
it.

**If it must happen once per page load → module scope.** Not once per mount — once,
genuinely ([topic 04 · 03](04-cleanup/03-when-cleanup-is-not-the-answer.md)).

## The rare legitimate case

Honestly stated: react.dev does not document a recommended ref-guard for skipping
the first effect run, and the four alternatives above cover the cases it does
document.

Where the requirement survives all four, it is usually **an effect whose external
system is already in the desired state at mount** — the setup would be a no-op the
first time and the guard is an optimisation rather than a correctness fix. That is
worth two checks before accepting it:

1. Is the first run actually *harmful*, or merely redundant? If redundant, the
   guard is buying very little and costing a permanent piece of untestable state.
2. Would the effect still be correct if the component remounted? If the guard is
   what makes it correct, the guard is hiding a bug, not skipping a run.

If both check out, express it as a **value comparison** rather than a render count,
so the condition states the actual requirement.

## Gotchas

**Symptom:** an `isFirstRender` ref makes a duplicate call go away in development.
**Cause:** the guard suppresses `StrictMode`'s stress test rather than fixing the
effect.
**Fix:** find out what the extra cycle was pointing at — usually a missing cleanup.

**Symptom:** the guard works, then breaks when the user navigates away and back.
**Cause:** remounting resets the ref, so the "first run" happens again — in
production, with no `StrictMode` involved.
**Fix:** the requirement was never about the first render. Move the logic to the
handler, or express it as a value comparison.

**Symptom:** the linter never flagged anything, yet values inside the effect are
stale.
**Cause:** the guard is a ref, which is non-reactive, so nothing was ever
analysable.
**Fix:** [topic 11 · 03](11-removing-dependencies/03-the-illegitimate-fixes.md) —
replace the ref with the value and see what the linter says.

**Symptom:** a "notify on change" callback fires on page load.
**Cause:** event logic in an effect. The effect cannot tell a load from a change.
**Fix:** call it from the handler that performs the change.

**Symptom:** the guard needs a second guard for a second dependency.
**Cause:** render counting does not compose — each thing you want to skip needs its
own bookkeeping.
**Fix:** value comparison composes; render counting does not.

## Interview questions

**★ Why is a `useRef` guard to skip the first effect run usually wrong?**
Three reasons. "First" is not stable, because a component mounts more than once —
back-navigation remounts it in production and resets the ref. `StrictMode`'s extra
cycle is suppressed rather than satisfied, so whatever it was pointing at stays
broken. And the requirement usually means the logic was caused by an interaction,
which an effect cannot see: by the time it runs, you no longer know what the user
did.

**★ What is the documented alternative when a prop change really is the trigger?**
Comparing the previous value during render — keeping the previous prop in state and
acting when it differs. Crucially this *compares values* rather than counting
renders, so the first render is skipped because nothing changed, not because of a
special case. react.dev still adds that most components should not need even this
pattern.

**Someone says "I just need this to run once". What do you ask?**
Once per what. If once per page load, it belongs at module scope outside the
component, because no component-scoped mechanism can promise that. If once per
interaction, it belongs in the handler. If they mean "not on mount but on
subsequent changes", the honest expression is a value comparison. "Once per mount"
is the only one an effect expresses naturally, and it is rarely the requirement.

**Is there ever a legitimate reason to skip the first run?**
react.dev does not document a recommended pattern for it, which is itself the
answer most of the time. The residue is usually an effect whose external system is
already in the desired state at mount, so the first run is redundant rather than
harmful — an optimisation. Two checks before accepting it: is the first run
actually harmful, and would the effect still be correct on a remount? If the guard
is what makes it correct, it is hiding a bug.

---

← Prev: [`useInsertionEffect`](17-useinsertioneffect.md) · Index: [Phase 4](README.md)
