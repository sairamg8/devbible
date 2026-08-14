---
title: "Not re-subscribing"
sidebar_label: "02 · Not re-subscribing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)
> (*Wrapping an event handler from the props*, updater functions, splitting Effects),
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) (caveats), and
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> No sandbox script backs this page; claims are cited, not measured.

**A function argument cannot be destructured into primitives, so
[chunk 01](01-dependencies-across-the-boundary.md)'s fix does not reach it. Callbacks
get their own mechanism — and the distinction it rests on, reactive versus
non-reactive, is the last idea this phase needs.**

## The dilemma, stated exactly

A caller passes an inline arrow, because that is how callbacks are passed:

```jsx
useChatRoom({ roomId, onReceiveMessage: (msg) => setMessages(m => [...m, msg]) });
```

That function is a new value on every render of the caller. The hook then has two bad
options:

| Option | What happens |
|---|---|
| List it as a dependency | The connection is torn down and rebuilt **on every render** of the caller — including renders caused by something unrelated |
| Omit it from the array | The effect keeps calling the **first** version forever: stale props, stale state, and a linter suppression to hide it |

Neither is acceptable, and no amount of care by the caller fixes it — `useCallback` at
every call site is a requirement nobody will meet consistently, and it merely moves the
instability up a level.

## The fix: wrap the handler

> When a parent passes an event handler prop that changes on every render, **wrap it in
> an Effect Event**:

```jsx
function ChatRoom({ roomId, onReceiveMessage }) {
  const onMessage = useEffectEvent(onReceiveMessage);

  useEffect(() => {
    const connection = createConnection();
    connection.on('message', (msg) => onMessage(msg));
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // onReceiveMessage is NOT a dependency
}
```

> Now the chat **won't re-connect every time** that the `ChatRoom` component re-renders.

The reason this is not cheating — which is the thing to be able to say out loud — is that
**effect events are non-reactive by design**:

> Use **Effect Events** (via `useEffectEvent`) to read the latest value of something
> **without making your Effect depend on it** … Effect Events are non-reactive, so
> `isMuted` won't cause reconnections even when it changes.

The dependency array answers "when should this effect re-synchronize?". A callback is not
an answer to that question: nobody wants to reconnect a socket because the handler's
identity changed. The handler is *"what to do when a message arrives"*, which is read at
event time, not at subscribe time.

## The test that keeps you honest

The line between "dependency" and "effect event" is the one place this can go wrong, and
the docs are blunt about the failure:

> **Do not use `useEffectEvent` to avoid specifying dependencies** in your Effect's
> dependency array.

The test, applied to each value the effect reads:

> **Should the effect re-run when this value changes?**

- **Yes → dependency.** `roomId` changes ⇒ connect to the other room. `serverUrl` changes
  ⇒ reconnect. `delay` changes ⇒ new interval. These describe *what the effect is
  synchronized with*.
- **No, but I want the newest value when the event fires → effect event.**
  `onReceiveMessage`, `isMuted`, an analytics context, the current user's display name in
  a log line. These are read *during* the connection's life, not to establish it.

Get this backwards and the failure is silent in both directions: a dependency demoted to
an effect event stops re-synchronizing (the socket stays on the old room), and a handler
promoted to a dependency thrashes.

The constraints that keep effect events safe:

> `useEffectEvent` is a Hook, so you can only call it at the **top level** of your
> component or your own Hooks.

> **Effect Events can only be called from inside Effects or other Effect Events. Do not
> call them during rendering or pass them to other components or Hooks.** The
> `eslint-plugin-react-hooks` linter enforces this restriction.

> **Effect Event functions do not have a stable identity. Their identity intentionally
> changes on every render.**

So: create it in the hook that uses it, call it only from that hook's effect, and never
put it in a dependency array — its identity changes every render, which would recreate
the effect on every render and reintroduce exactly the bug you removed.

## The other three ways to not re-subscribe

Effect events are the answer for callbacks. The other documented restructurings matter at
a hook boundary too, because each removes a dependency by making it genuinely
unnecessary.

**Updater functions, when the effect reads state only to update it.**

```jsx
// 🔴 messages is a dependency, so every new message reconnects
connection.on('message', (m) => setMessages([...messages, m]));
// ✅ the updater needs nothing from this render
connection.on('message', (m) => setMessages(msgs => [...msgs, m]));
```

> `messages` is not needed.

Inside a hook this matters more than in a component, because the hook may own state its
caller cannot see — so a reconnect-per-message bug has no visible cause at the call site.

**Split unrelated effects.** A hook that synchronizes two things should contain two
effects with two dependency arrays, not one effect with the union of both:

> Split Effects that synchronize different things into multiple Effects, **each with its
> own dependency list.**

The union array is what makes a socket reconnect when a scroll position changes. If the
two effects have genuinely disjoint dependencies, that is usually the signal to split the
*hook* as well — one hook, one job
([Phase 7 · 06 · 02](../06-designing-a-hooks-api/02-the-return-value-and-the-seam.md)).

**Move interaction logic out of the effect entirely.**

> If your code should run in response to a **specific interaction**, it belongs in an
> event handler, not an Effect.

A custom hook is a tempting place to put "and then send the analytics event", and that
usually converts a user interaction into a synchronization. The hook should return
something the caller invokes, not run it from an effect keyed on a state flag —
[Phase 4 · 06](../../phase-4-effects/06-you-might-not-need-an-effect/README.md).

## What the caller should be able to assume

Pulling the two chunks together, a well-built effect-wrapping hook lets its callers write
the obvious thing:

```jsx
useChatRoom({
  serverUrl,                                   // object literal: fine
  roomId,                                      // primitive: a real dependency
  onReceiveMessage: (msg) => append(msg),      // inline arrow: fine
});
```

…and get: reconnection when and only when the room or server changes, the latest handler
on every message, no reconnection when anything else in the component re-renders, and
correct teardown on unmount. **None of that is the caller's responsibility**, and a hook
that makes any of it the caller's responsibility has failed at the boundary.

## Gotchas

**Symptom:** a socket, listener or interval is rebuilt on every render of the caller.
**Cause:** a callback argument in the dependency array.
**Fix:** wrap it in `useEffectEvent` inside the hook.

**Symptom:** the effect calls a handler that never sees updated state.
**Cause:** the callback was omitted from the array instead of wrapped, freezing the first
version.
**Fix:** the same one. Omission is not the alternative to wrapping; it is the other bug.

**Symptom:** an effect event is added to a dependency array "for completeness".
**Cause:** treating it like a normal value.
**Fix:** its identity intentionally changes every render, so listing it recreates the
effect every render. The linter forbids it.

**Symptom:** a value moved into an effect event and the effect stopped re-synchronizing.
**Cause:** it was a real dependency. The docs warn explicitly against this use.
**Fix:** apply the test — if the effect should re-run when the value changes, it is a
dependency.

**Symptom:** every new message reconnects the chat.
**Cause:** the effect reads state to append to it, so the state is a dependency.
**Fix:** an updater function; then the state is not needed.

**Symptom:** an unrelated piece of state re-runs a subscription.
**Cause:** two synchronizations share one effect and therefore one dependency array.
**Fix:** split the effects — and probably the hook.

**Symptom:** an effect event is passed out of the hook or into a child.
**Cause:** it looks like a stable callback.
**Fix:** it is not — it may only be called from inside effects in the same component or
hook, and the linter enforces it.

## Interview questions

**★ A custom hook takes an `onMessage` callback. Why can't it just go in the dependency
array?**
Because callers pass inline arrows, so it is a new value on every render, and the effect
would tear down and rebuild the connection on every render of the caller — including
renders caused by something unrelated. Omitting it instead freezes the first version, so
the handler sees stale props and state forever. Wrapping it in `useEffectEvent` resolves
both: the effect always calls the latest handler, and the handler is not a reason to
re-subscribe.

**★ How do you decide whether a value is a dependency or belongs in an effect event?**
Ask whether the effect should re-run when the value changes. A room id or a server URL
should — those describe what the effect is synchronized with, so they are dependencies. A
callback, or a flag read only when an event fires, should not — those are read during the
subscription's life, not to establish it. React's docs are explicit that effect events
must not be used to avoid specifying real dependencies.

**★ What are the rules for using `useEffectEvent`?**
Call it at the top level of a component or hook. Call the resulting function only from
inside effects or other effect events — never during render, and never pass it to other
components or hooks; the linter enforces this. And never put it in a dependency array,
because its identity intentionally changes on every render, which would recreate the
effect each time.

**★ Besides effect events, what other restructurings remove a dependency?**
Move interaction-specific code into an event handler so it is not in an effect at all;
split an effect that synchronizes two unrelated things into two effects with their own
dependency lists; use an updater function when state is read only in order to update it,
which removes the state from the array; and extract primitives from object arguments.
Each removes a dependency by proving it is not one, which is the only legitimate way.

**What should a caller of a well-designed effect-wrapping hook have to know?**
Nothing. They should be able to pass an object literal and an inline arrow and still get
re-synchronization only when the thing being synchronized changes, the latest handler on
every event, and correct teardown on unmount. Every requirement the hook pushes onto the
caller — memoize this, wrap that in `useCallback` — is a defect at the boundary, because
callers do not read dependency arrays.

---

← Prev: [Dependencies across the boundary](01-dependencies-across-the-boundary.md) ·
Index: [Hooks that wrap effects](README.md) ·
Next → [Conditional hooks and the correct restructure](../09-conditional-hooks.md)
