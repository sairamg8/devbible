---
title: "The return value, and the seam"
sidebar_label: "02 · The return value and the seam"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> (*When to use custom Hooks*, *Custom Hooks help you migrate to better patterns*, and
> the Recap) and [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).
> The tuple-versus-object guidance is **reasoning from React's own API conventions, not
> a documented rule**, and is marked as such below.
> No sandbox script backs this page; claims are cited, not measured.

**A hook may return anything — that is stated in the docs and it is the whole
difficulty. The shape you pick is a contract with every call site, and the one thing
the docs do commit to is that a hook should hide its implementation well enough that
you can replace it without touching a single component.**

## What React does and does not prescribe

The naming rules say only this about return values:

> **Hooks may return arbitrary values.**

Unlike a component, there is no constraint at all — a boolean, a tuple, an object, a
function, nothing. So the guidance below is **convention reasoned from React's own
built-ins**, not doctrine; where the docs *do* commit, it is quoted.

### The convention, read off the built-in hooks

| Built-in | Returns | Why that shape |
|---|---|---|
| `useState` | `[value, setter]` — tuple | Exactly two things, and you will rename both at every call site |
| `useReducer` | `[state, dispatch]` — tuple | Same |
| `useContext`, `useMemo`, `useDeferredValue` | one value | Nothing to pair |
| `useTransition` | `[isPending, startTransition]` — tuple | Two |
| `useRef` | `{ current }` — object | A stable box, deliberately named |

The pattern is consistent enough to copy: **tuples for exactly two closely-related
things you expect to be renamed; an object once there are three, or when some are
optional.**

The reasoning behind it is worth having, because it is what tells you when to break it:

- A **tuple** is positional, so the caller names everything —
  `const [isOpen, toggleOpen] = useToggle(false)` reads well precisely because
  `useToggle` never dictates the words. That is a virtue when a component may call the
  hook twice with different meanings (the `useFormInput` case from
  [Phase 7 · 03](../03-share-logic-not-state/01-two-callers-two-states.md)).
- An **object** is named, so adding a field later is not a breaking change and callers
  destructure only what they use. That is a virtue once you have `data`, `error`,
  `isLoading`, `refetch` — nobody wants to remember that `error` is third, and nobody
  wants `const [, , error] = useQuery(...)`.
- **A bare value** is best when there is exactly one thing: `useOnlineStatus()` returns
  a boolean. Wrapping it in `{ isOnline }` buys nothing and costs a destructure.

The failure mode to avoid is a **three-element tuple**. It is positional, so it cannot
grow; unnamed, so the call site is unreadable; and it will grow, because everything
does.

## One hook, one job

The design rule from [chunk 01](01-the-name-and-the-arguments.md) — *a good custom hook
makes the calling code more declarative by constraining what it does* — has a direct
consequence for return values: **a hook returning a grab-bag is a hook doing several
jobs.**

```jsx
// 🔴 three jobs, and the name cannot describe them
const { user, theme, isOnline, notifications, refetchAll } = useAppState();
```

```jsx
// ✅ three hooks, each nameable, each independently testable and replaceable
const user   = useCurrentUser();
const theme  = useTheme();
const online = useOnlineStatus();
```

The split costs three lines and buys three things: each hook can be named for what it
synchronizes with, each can be used alone by a component that needs only one of them,
and each can be replaced without touching the others. The merged version is the API
shape the docs warn produces "more problems than it solves".

The counter-pressure — "but they are always used together" — is usually about the
*provider*, not the hook. If the values genuinely share one source, share the source
(a provider, a store) and keep the reader hooks separate
([Phase 7 · 03 · 03](../03-share-logic-not-state/03-when-you-wanted-shared-state.md)).

## When to extract at all

The seam only pays if there is something to hide. react.dev is deliberately relaxed:

> **You don't need to extract a custom Hook for every little duplicated bit of code.
> Some duplication is fine.** For example, extracting a `useFormInput` Hook to wrap a
> single `useState` call like earlier is probably unnecessary.

And then the actual trigger:

> However, **whenever you write an Effect, consider whether it would be clearer to also
> wrap it in a custom Hook.** You shouldn't need Effects very often, so if you're
> writing one, it means that you need to **"step outside React" to synchronize with some
> external system** or to do something that React doesn't have a built-in API for.
> **Wrapping it into a custom Hook lets you precisely communicate your intent and how
> the data flows through it.**

So the trigger is not duplication — it is **an effect**, because an effect is by
definition a boundary with something outside React, and boundaries are what deserve
names. The over-extraction failure is [Phase 7 · 12](../12-extracting-too-early.md).

## 🔴 The payoff: a seam you can replace behind

This is the strongest argument for hook APIs, and it is easy to miss because it pays
off later:

> Effects are an **"escape hatch"**: you use them when you need to "step outside React"
> and when there is no better built-in solution for your use case. With time, the React
> team's goal is to **reduce the number of the Effects in your app to the minimum** by
> providing more specific solutions to more specific problems. **Wrapping your Effects
> in custom Hooks makes it easier to upgrade your code** when these solutions become
> available.

The documented example is `useOnlineStatus`, which starts life as `useState` plus
`useEffect` and is later rewritten as:

```jsx
import { useSyncExternalStore } from 'react';

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
```

> **You didn't need to change any of the components** to make this migration.

That is the design goal made concrete. The rewrite changed the mechanism completely —
different hook, no local state, no effect, and it gained a server snapshot (`() => true`)
that fixed SSR. The API — `useOnlineStatus()` returns a boolean — did not move, so no
call site changed. Note also that `subscribe` is declared **outside** the hook, which is
the stability requirement from
[Phase 7 · 03 · 04](../03-share-logic-not-state/04-external-stores.md).

The three benefits the docs draw from this are the summary of the whole topic:

> 1. You make the **data flow to and from your Effects very explicit.**
> 2. You let your components **focus on the intent rather than on the exact
>    implementation** of your Effects.
> 3. When React adds new features, you can **remove those Effects without changing any
>    of your components.**

Which gives the design test to apply to any hook API: **could you swap the
implementation for a completely different mechanism without editing a call site?** If
the answer is no, the API is leaking — usually because it returns internals (a ref, a
raw store object, a setter that only makes sense for one implementation) rather than
the thing the caller actually wants.

## Gotchas

**Symptom:** a hook's return value grows a third and fourth element in a tuple.
**Cause:** a tuple chosen before the shape was known.
**Fix:** switch to an object. Tuples are for exactly two things the caller will rename.

**Symptom:** every call site destructures a five-field object and uses one field.
**Cause:** several jobs merged into one hook.
**Fix:** split into hooks that can each be named for one thing.

**Symptom:** replacing a hook's implementation requires touching every component.
**Cause:** the return value exposes internals rather than intent.
**Fix:** return what the caller wants, not what the implementation happens to have.
The `useOnlineStatus` rewrite changed everything inside and no call site.

**Symptom:** a hook returns a new object every render, so `useMemo`/`memo` downstream
never hits.
**Cause:** an object literal assembled in the hook body.
**Fix:** memoize the returned object, or return primitives the caller can depend on
individually.

**Symptom:** a caller mutates the object a hook returned.
**Cause:** the return value looks like the caller's to own.
**Fix:** values are immutable once returned from a hook
([Phase 7 · 04 · 02](../04-rules-of-react-beyond-hooks/02-immutability.md)); document
it and, where it matters, return a fresh copy.

**Symptom:** a hook that wraps one `useState` and nothing else.
**Cause:** extraction on duplication rather than on a boundary.
**Fix:** some duplication is fine, and the docs say so. Effects are the trigger.

## Interview questions

**★ Tuple or object — how do you choose?**
React does not prescribe one; hooks may return arbitrary values. The convention worth
copying comes from the built-ins: a tuple for exactly two closely-related things the
caller will rename, as `useState` and `useReducer` do, because positional returns let
the call site name everything and allow the same hook to be used twice with different
meanings. An object once there are three or more, or when fields are optional, because
adding a field is then not a breaking change. A bare value when there is one thing. A
three-element tuple is the shape to avoid — unreadable and unable to grow.

**★ When should an effect become a custom hook?**
Effectively whenever you write one. The docs' reasoning is that you should not need
effects often, so writing one means stepping outside React to synchronize with an
external system — and wrapping that in a named hook communicates the intent and the data
flow. Duplication alone is explicitly not the trigger: some duplication is fine, and
wrapping a single `useState` is probably unnecessary.

**★ What is the long-term argument for putting effects behind custom hooks?**
Effects are an escape hatch, and React's stated direction is to reduce their number by
shipping more specific solutions. A hook is the seam that lets you take those up. The
documented example rewrites `useOnlineStatus` from `useState` plus `useEffect` to
`useSyncExternalStore` with a server snapshot — a completely different mechanism — and
no component changed. Data flow becomes explicit, components express intent rather than
implementation, and effects can be removed later without touching call sites.

**★ What is the test for whether a hook's API is well designed?**
Whether you could replace its implementation with a different mechanism without editing
a single call site. If not, the API is leaking internals — returning a ref, a store
object, or a setter that only makes sense for the current implementation — instead of
returning what the caller actually wants.

**A hook returns `{ user, theme, isOnline, refetchAll }`. What's wrong with it?**
It does several jobs, so it cannot be named for one and cannot be constrained. Every
component takes a dependency on all of it to use one field, none of the parts can be
replaced independently, and the name will drift toward something meaningless like
`useAppState`. Split it into hooks named for what each synchronizes with; if they share
a source, share the source, not the hook.

**Does the immutability rule apply to what a hook returns?**
Yes, in both directions: a hook must not mutate its arguments, and a caller must not
mutate the hook's return value — values become immutable once passed to or returned from
a hook. That is the local-reasoning principle: the hook is a black box at the call site,
so neither side may reach into the other's values.

---

← Prev: [The name and the arguments](01-the-name-and-the-arguments.md) ·
Index: [Designing a hook's API](README.md) ·
Next → [The standard set, written out](../07-the-standard-set.md)
