---
title: "Writing a custom hook"
sidebar_label: "02 · Writing a custom hook"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks).
> No sandbox script backs this page; claims are cited, not measured.

**A custom hook is a function whose name starts with `use` and which calls other
hooks. There is no registration, no API, and nothing React does to it that it does
not do to any function — the entire mechanism is the naming convention plus the
linter that enforces it.**

That sounds like it undersells them. It does not: the value is in what the
convention *guarantees at the call site*, and that is worth more than machinery.

## The mechanism, in full

You have already written the hard part every time you wrote an effect. Extraction is
cut-and-paste plus a return:

```jsx
// Before — the same six lines in two components
function StatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function handleOnline()  { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return <h1>{isOnline ? '✅ Online' : '❌ Disconnected'}</h1>;
}
```

```jsx
// After — the logic has a name, and the components read like what they are
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function handleOnline()  { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}

function StatusBar() {
  const isOnline = useOnlineStatus();
  return <h1>{isOnline ? '✅ Online' : '❌ Disconnected'}</h1>;
}
```

Nothing was imported to make `useOnlineStatus` a hook. It is a hook because it is
named `use…` and calls hooks.

## 🔴 The naming convention is the whole contract

> You must follow these naming conventions:
>
> 1. **React component names must start with a capital letter,** like `StatusBar`
>    and `SaveButton`. React components also need to return something that React
>    knows how to display, like a piece of JSX.
> 2. **Hook names must start with `use` followed by a capital letter,** like
>    `useState` (built-in) or `useOnlineStatus` (custom). **Hooks may return
>    arbitrary values.**

The second half of point 2 matters: unlike a component, a hook has no constraint on
its return type. A boolean, a tuple, an object, nothing at all — all fine.

And here is what the convention actually buys:

> This convention **guarantees that you can always look at a component and know where
> its state, Effects, and other React features might "hide"**. For example, if you
> see a `getColor()` function call inside your component, you can be sure that it
> can't possibly contain React state inside because its name doesn't start with
> `use`. However, a function call like `useOnlineStatus()` will most likely contain
> calls to other Hooks inside!

Read that as a guarantee in *both* directions. `use…` means "may contain React
state"; anything else means "definitely does not". The second half is the useful one
when you are scanning an unfamiliar component for what makes it re-render.

## What the linter does with the name

> If your linter is configured for React, it will enforce this naming convention.
> … rename `useOnlineStatus` to `getOnlineStatus`. Notice that **the linter won't
> allow you to call `useState` or `useEffect` inside of it anymore. Only Hooks and
> components can call other Hooks!**

So the prefix is load-bearing, not decorative. Renaming a hook to drop `use` turns
every hook call inside it into a rule-2 violation
([Phase 7 · 01](01-the-rules-of-hooks.md)).

**What the prefix does not buy:**

- It does not make the function special to React. There is no registry, no lifecycle,
  no way for React to tell `useOnlineStatus` from any other call in the stack — the
  hooks *inside* it are what React sees.
- It does not create shared state. Two components calling it get two independent
  states, which is [Phase 7 · 03](03-share-logic-not-state/README.md) and the single most
  common misunderstanding in this phase.
- It does not exempt the function from rule 1. Hooks inside a custom hook must still
  be at the top level, before any early return.
- It does not make a non-hook function a hook usefully. Naming a plain helper `useX`
  when it calls no hooks is worse than harmless: it tells every reader that React
  state might hide there, and the convention's guarantee erodes.

## When to extract one

The docs are notably relaxed about this, and it is worth quoting because the instinct
runs the other way:

> **You don't need to extract a custom Hook for every little duplicated bit of code.
> Some duplication is fine.** For example, extracting a `useFormInput` Hook to wrap a
> single `useState` call like earlier is probably unnecessary.

Then the actual trigger:

> However, **whenever you write an Effect, consider whether it would be clearer to
> also wrap it in a custom Hook.** You shouldn't need Effects very often, so if
> you're writing one, it means that you need to "step outside React" to synchronize
> with some external system or to do something that React doesn't have a built-in API
> for. **Wrapping it into a custom Hook lets you precisely communicate your intent and
> how the data flows through it.**

That is the rule of thumb worth carrying: **an effect is a candidate; a `useState`
wrapper is not.** An effect is by definition a synchronization with something outside
React, and "what is this synchronizing with?" is exactly the question a good hook name
answers.

## 🔴 Keep them concrete, not lifecycle-shaped

> **Keep your custom Hooks focused on concrete high-level use cases.** Avoid creating
> and using custom "lifecycle" Hooks that act as alternatives and convenience wrappers
> for the `useEffect` API itself:
>
> * 🔴 `useMount(fn)`
> * 🔴 `useEffectOnce(fn)`
> * 🔴 `useUpdateEffect(fn)`

These three appear in nearly every in-house "hooks" library, so it is worth being
clear about why they are singled out. They are not too small — they are the wrong
*shape*. `useMount(fn)` names a lifecycle moment, which tells you when it runs and
nothing about what it is for; it also invites `[]` dependency arrays that lie, and
it breaks under `StrictMode` double-invocation
([Phase 4 · 05](../phase-4-effects/05-strictmode-double-invocation.md)) because
"mount" is no longer a thing that happens once.

`useChatRoom({ serverUrl, roomId })` names what it synchronizes with. `useMount`
names when React happened to call it. Only one of those survives a refactor.

## Gotchas

**Symptom:** the linter refuses `useState` inside a helper that used to work.
**Cause:** the function was renamed without the `use` prefix, so it is no longer a
hook and rule 2 applies.
**Fix:** name it `useSomething`, or move the hook call to a real hook or component.

**Symptom:** a helper named `useFormatDate` that contains no hooks.
**Cause:** the prefix applied for consistency.
**Fix:** rename it. The convention's value is that non-`use` names *guarantee* no
React state hides inside; a false positive costs every future reader.

**Symptom:** a custom hook with an early return above one of its hook calls.
**Cause:** rule 1 applies inside custom hooks exactly as it does in components.
**Fix:** hoist every hook above every conditional return.

**Symptom:** an in-house `useMount`/`useUpdateEffect` layer that keeps needing
special cases.
**Cause:** hooks named after lifecycle moments rather than what they synchronize with.
**Fix:** write the concrete hook — `useChatRoom`, `useOnlineStatus` — and let the
effect live inside it.

**Symptom:** every two-line duplication has been extracted into a hook, and the
component is now ten calls to ten files.
**Cause:** extracting on duplication alone.
**Fix:** some duplication is fine, and the docs say so. Effects are the candidates;
a single `useState` wrapper usually is not. See
[Phase 7 · 12](12-extracting-too-early.md).

## Interview questions

**★ What makes a function a custom hook?**
Two things and nothing else: a name starting with `use` followed by a capital letter,
and calls to other hooks inside it. There is no registration and React does not treat
the function specially — it only ever sees the built-in hooks called within it. Unlike
components, hooks "may return arbitrary values", so there is no constraint on what
comes back.

**★ What does the `use` prefix actually guarantee, and what does it not?**
It guarantees visibility in both directions: a `use…` call may contain React state,
effects and other hooks, and a call that is *not* `use…` definitely cannot — the docs
use `getColor()` versus `useOnlineStatus()` to make exactly that point. The linter
enforces it, and renaming a hook to drop the prefix makes every hook call inside it a
violation. It does not create shared state, does not exempt the function from the
Rules of Hooks, and does not make React aware of the function.

**★ When should you extract an effect into a custom hook?**
Effectively whenever you write one. The docs' reasoning: you shouldn't need effects
often, so writing one means you are stepping outside React to synchronize with an
external system — and wrapping that in a named hook communicates the intent and the
data flow. By contrast, they explicitly say some duplication is fine and that
wrapping a single `useState` call is probably unnecessary.

**Why do the docs discourage `useMount`, `useEffectOnce` and `useUpdateEffect`?**
Because they are convenience wrappers for the `useEffect` API itself rather than
concrete high-level use cases. A name like `useChatRoom` says what the hook
synchronizes with; `useMount` says only when React called it, which tells the reader
nothing useful, encourages dependency arrays that lie, and does not survive
`StrictMode` double-invocation, where "mount" is not a single event.

**Is `useFormatDate` — no hooks inside — a reasonable name?**
No. The convention is only worth having because a non-`use` name is a guarantee that
no React state can hide in the call. Prefixing a pure helper spends that guarantee
for nothing and makes readers check a file they would otherwise skip.

---

← Prev: [The Rules of Hooks](01-the-rules-of-hooks.md) · Index: [Phase 7](README.md) · Next → [Custom hooks share logic, not state](03-share-logic-not-state/README.md)
