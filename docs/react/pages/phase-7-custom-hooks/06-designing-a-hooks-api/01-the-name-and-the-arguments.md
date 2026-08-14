---
title: "The name and the arguments"
sidebar_label: "01 · The name and the arguments"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> (*Passing reactive values between Hooks*, *Passing event handlers to custom Hooks*,
> *Keep your custom Hooks focused on concrete high-level use cases*).
> No sandbox script backs this page; claims are cited, not measured.

**Start with the name. react.dev means that literally — if you cannot name the hook
clearly, the extraction is not ready, and no amount of argument design will rescue
it.**

> **Start by choosing your custom Hook's name.** If you struggle to pick a clear name,
> it might mean that your Effect is **too coupled to the rest of your component's
> logic, and is not yet ready to be extracted.**

That is a diagnostic, not a style tip. A name you cannot settle on is telling you the
seam is in the wrong place — and the fix is to leave the code in the component, not to
ship `useStuff`.

## What a good name looks like

> Ideally, your custom Hook's name should be **clear enough that even a person who
> doesn't write code often** could have a good guess about what your custom Hook does,
> **what it takes, and what it returns**:
>
> * ✅ `useData(url)`
> * ✅ `useImpressionLog(eventName, extraData)`
> * ✅ `useChatRoom(options)`

Note the standard being set: not "a React developer can work it out", but a
non-specialist can guess *the arguments and the return value* from the name alone. The
name is documentation for the whole signature.

Jargon is allowed when the domain has jargon:

> When you synchronize with an external system, your custom Hook name **may be more
> technical and use jargon specific to that system.** It's good as long as it would be
> clear **to a person familiar with that system**:
>
> * ✅ `useMediaQuery(query)`
> * ✅ `useSocket(url)`
> * ✅ `useIntersectionObserver(ref, options)`

`useIntersectionObserver` is meaningless to a designer and precise to anyone who has
used the API — that is the correct trade, because the audience for that hook is the
second group. What is *not* allowed is jargon that names React's own machinery instead
of your domain, which is the next rule.

## 🔴 Name what it synchronizes with, not when it runs

> **Keep custom Hooks focused on concrete high-level use cases.** Avoid creating and
> using custom "lifecycle" Hooks that act as **alternatives and convenience wrappers
> for the `useEffect` API itself**:
>
> * 🔴 `useMount(fn)`
> * 🔴 `useEffectOnce(fn)`
> * 🔴 `useUpdateEffect(fn)`

[Phase 7 · 02](../02-writing-a-custom-hook.md) introduced this list; here is the
design principle underneath it, which is the sentence worth memorising:

> **A good custom Hook makes the calling code more declarative by constraining what it
> does.** For example, `useChatRoom(options)` can only connect to the chat room, while
> `useImpressionLog(eventName, extraData)` can only send an impression log to the
> analytics. **If your custom Hook API doesn't constrain the use cases and is very
> abstract, in the long run it's likely to introduce more problems than it solves.**

**Constraint is the feature.** This inverts the instinct most API design brings from
elsewhere, where flexibility is a virtue. A hook that takes a callback and runs it at
some lifecycle moment can do anything, so the call site tells the reader nothing, every
consumer uses it differently, and the hook accumulates options until it is a worse
`useEffect`. A hook that can only connect to a chat room is *readable at the call site*,
and that is the entire return on extracting it.

The practical test: **finish the sentence "this hook can only ___".** If you cannot,
the API is too abstract.

| Name | Can only… | Verdict |
|---|---|---|
| `useChatRoom({serverUrl, roomId})` | connect to a chat room | ✅ |
| `useImpressionLog(eventName, extraData)` | send an impression log | ✅ |
| `useMediaQuery(query)` | report whether a media query matches | ✅ |
| `useMount(fn)` | …run anything, at one moment | 🔴 |
| `useAsync(fn, deps)` | …run anything asynchronous | 🔴 |
| `useSetup(config)` | …anything at all | 🔴 |

## Arguments: pass reactive values in

The default shape for arguments follows from what a custom hook *is*:

> The code inside your custom Hooks will **re-run during every re-render of your
> component**. This is why, like components, custom Hooks **need to be pure**. Think of
> custom Hooks' code as **part of your component's body!**

> Because custom Hooks re-render together with your component, **they always receive the
> latest props and state.**

So arguments are not configuration read once at setup — they are **reactive inputs
re-supplied on every render**:

```jsx
export function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const options = { serverUrl, roomId };
    const connection = createConnection(options);
    connection.connect();
    connection.on('message', (msg) => {
      showNotification('New message: ' + msg);
    });
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}
```

> Every time your `ChatRoom` component re-renders, **it passes the latest `roomId` and
> `serverUrl` to your Hook.** This is why your Effect re-connects to the chat whenever
> their values are different after a re-render.

Three consequences worth stating explicitly, because each is a design decision the
shape makes for you:

1. **Take the values, not a getter.** `useChatRoom({ roomId })` re-synchronizes when
   `roomId` changes because the value is a dependency. `useChatRoom(() => roomId)`
   hands the hook a function whose identity changes every render and whose contents
   React cannot see — the dependency array becomes a lie
   ([Phase 4 · 03](../../phase-4-effects/03-the-dependency-array.md)).
2. **Dependencies must be honest across the boundary too.** The hook declares
   `[roomId, serverUrl]` because it reads exactly those. The linter checks inside the
   hook the same way it checks inside a component — that is one of the things the `use`
   prefix buys.
3. **An object argument is re-created every render.** `useChatRoom({ serverUrl,
   roomId })` is fine *because the effect depends on the destructured primitives*, not
   on the object. Depending on the object itself would re-run the effect on every
   render. This is the most common way a well-named hook still re-subscribes constantly.

## Event handlers: the one argument that needs wrapping

Callbacks are the exception to "pass reactive values straight through", because a
function prop is a new value on every render:

> Adding a dependency on `onReceiveMessage` is **not ideal because it will cause the
> chat to re-connect every time the component re-renders.** Wrap this event handler into
> an Effect Event to remove it from the dependencies.

```jsx
import { useEffect, useEffectEvent } from 'react';

export function useChatRoom({ serverUrl, roomId, onReceiveMessage }) {
  const onMessage = useEffectEvent(onReceiveMessage);

  useEffect(() => {
    const options = { serverUrl, roomId };
    const connection = createConnection(options);
    connection.connect();
    connection.on('message', (msg) => {
      onMessage(msg);
    });
    return () => connection.disconnect();
  }, [roomId, serverUrl]); // ✅ All dependencies declared
}
```

> Now the chat **won't re-connect every time** that the `ChatRoom` component re-renders.

The rule to carry: **values in the dependency array, handlers through
`useEffectEvent`.** A handler is something you want the *latest* version of when the
event fires, without it counting as a reason to tear down and rebuild the connection —
which is precisely what an effect event is for
([Phase 4 · 10](../../phase-4-effects/10-useeffectevent.md)). Without it, a caller who
writes `onReceiveMessage={(m) => …}` inline — that is, every caller — reconnects the
socket on every keystroke elsewhere in the component.

Note that this makes the hook's contract *better*, not merely faster: with the wrap,
callers may pass an inline arrow, which is what they will do regardless. A hook whose
correctness depends on the caller remembering `useCallback` is a hook with a trap in
its signature.

## Gotchas

**Symptom:** you cannot decide what to call the hook.
**Cause:** react.dev's own diagnostic — the logic is still too coupled to the component
to extract.
**Fix:** leave it in the component. Extract when the name is obvious.

**Symptom:** a hook accumulates options — `skip`, `once`, `immediate`, `mode`.
**Cause:** the API does not constrain the use cases, so every caller bends it.
**Fix:** the hook is too abstract. Split it into concrete hooks that can each only do
one thing.

**Symptom:** an effect inside a custom hook re-runs on every render.
**Cause:** a dependency on an object or function argument that is re-created each render.
**Fix:** depend on the destructured primitives; wrap handlers in `useEffectEvent`.

**Symptom:** the hook takes a getter or a ref "to avoid re-renders" and then goes stale.
**Cause:** React cannot see inside a function, so the value is invisible to the
dependency array.
**Fix:** pass the reactive value itself. Custom hooks always receive the latest props
and state because they re-run with the component.

**Symptom:** a socket reconnects whenever an unrelated piece of state changes.
**Cause:** the caller passes an inline callback and the hook lists it as a dependency.
**Fix:** `useEffectEvent` inside the hook. Do not push `useCallback` onto callers.

**Symptom:** a hook named after a lifecycle moment keeps needing special cases.
**Cause:** it names when React called it rather than what it synchronizes with.
**Fix:** rename around the domain — `useChatRoom`, not `useMount`.

## Interview questions

**★ How do you decide a custom hook's API?**
Name it first. react.dev treats an unclear name as evidence that the logic is still too
coupled to the component to be extracted, so the name is a gate rather than a
formality. A good name lets a non-specialist guess what the hook does, what it takes
and what it returns — `useData(url)`, `useImpressionLog(eventName, extraData)`,
`useChatRoom(options)` — and domain jargon is fine when the audience shares it, as in
`useIntersectionObserver(ref, options)`.

**★ What makes a hook API good, in one principle?**
It constrains what the calling code can do. `useChatRoom(options)` can only connect to
a chat room; `useImpressionLog` can only send an impression log. That constraint is what
makes the call site declarative and readable. An abstract, unconstrained API — a hook
that takes a callback and runs it at some moment — is explicitly warned against as
likely to cause more problems than it solves.

**★ What kind of values should a custom hook take as arguments?**
Reactive ones — props and state — passed by value. A custom hook's code re-runs on
every render of its component, so it always receives the latest props and state; that
is what lets an effect inside it re-synchronize when an argument changes. Passing a
getter or a ref to "avoid re-renders" hides the value from the dependency array and
produces staleness instead.

**★ Why wrap a callback argument in `useEffectEvent`?**
Because a function prop is a new value every render, so listing it as an effect
dependency reconnects the chat — or re-subscribes whatever the effect set up — on every
single re-render. Wrapping it means the effect always calls the latest handler without
the handler counting as a reason to re-run. It also makes the hook safe for callers who
pass an inline arrow, which is what callers do.

**Why is a hook that "can do anything" a bad hook?**
Because the value of extraction is at the call site: a reader should learn what the
component does from one line. A `useMount(fn)` or `useAsync(fn, deps)` tells them
nothing, so they must read the callback anyway — and since nothing constrains its use,
every consumer uses it slightly differently and the hook grows options forever. The test
is whether you can finish "this hook can only ___".

**An object argument re-creates itself every render. Doesn't that break the hook?**
Only if the effect depends on the object. Destructure and depend on the primitives
inside — `[roomId, serverUrl]` — and the object's identity is irrelevant. Depending on
the object itself is the most common reason a correctly-named hook still re-subscribes
on every render.

---

← Index: [Designing a hook's API](README.md) ·
Prev: [Why the rules exist](../05-why-the-rules-exist/README.md) ·
Next → [The return value, and the seam](02-the-return-value-and-the-seam.md)
