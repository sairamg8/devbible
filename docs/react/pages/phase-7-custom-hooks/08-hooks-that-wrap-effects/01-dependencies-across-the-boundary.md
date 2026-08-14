---
title: "Dependencies across the boundary"
sidebar_label: "01 · Dependencies across the boundary"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)
> and
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> (*Passing reactive values between Hooks*).
> No sandbox script backs this page; claims are cited, not measured.

**Extracting an effect into a custom hook moves the effect but not the rules. The
dependency array still has to be honest — and the only thing that changed is that half
the reactive values now arrive as arguments, from a caller who has no idea they are
dependencies.**

That is the whole difficulty of this topic. A component that owns its effect can see
every value the effect reads. A hook cannot: it sees what it was handed, and what it was
handed was created by somebody else's render.

## The rule does not soften at the boundary

> **Dependencies should match the code.** When you write an Effect, every reactive value
> (props and state) that the Effect reads must be declared in the dependency list. The
> linter will verify this for you.

> **To remove a dependency, prove that it's not a dependency.** You can't simply choose
> to omit dependencies. Instead, you need to restructure your code so that the value is
> no longer reactive or no longer needed by the Effect.

Both apply inside a custom hook exactly as written, and the linter checks there too —
which is one of the concrete things the `use` prefix buys you
([Phase 7 · 02](../02-writing-a-custom-hook.md)). The hook's *arguments* are reactive
values for this purpose: they arrive fresh on every render of the caller, because

> Because custom Hooks re-render together with your component, **they always receive the
> latest props and state.**

So the mental model to hold: **a custom hook's arguments are its props.** Everything you
know about props and dependencies transfers unchanged.

## 🔴 The boundary's own bug: object and function arguments

The problem custom hooks have that components mostly do not is that their arguments are
frequently objects and functions — because a hook signature naturally collects options.

> Objects and functions are recreated on every render, so they're considered **"new"
> values even if their contents are identical**.

```jsx
// 🔴 The caller writes this, which looks completely reasonable
function ChatRoom({ roomId }) {
  useChatRoom({ serverUrl: 'https://localhost:1234', roomId });
}

// 🔴 …and the hook does this
export function useChatRoom(options) {
  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, [options]);          // new object every render → reconnects every render
}
```

Nothing here is obviously wrong at either end. The caller passed an object literal, which
is the natural way to call the hook; the hook declared what it reads, which is the rule.
Together they reconnect the socket on every render of `ChatRoom` — including renders
caused by something entirely unrelated.

The docs give three solutions; **only one of them works at a hook boundary**, and knowing
why is the useful part:

> **Solution A: Move static objects/functions outside the component** … `const options =
> { serverUrl: 'https://localhost:1234', roomId: 'music' };`

Not available: the object depends on `roomId`, which is a prop.

> **Solution B: Move dynamic objects/functions inside the Effect**

Not available *to the hook*, because the object was built by the caller before the hook
was called. This one is the reason component advice does not transfer.

> **Solution C: Extract primitive values from objects** — `const { roomId, serverUrl } =
> options;` … `}, [roomId, serverUrl]); // ✅ Primitive dependencies only`

This is the one, and it is why every well-behaved hook in
[Phase 7 · 07](../07-the-standard-set/README.md) destructures its options:

```jsx
// ✅ Destructure at the boundary; depend on primitives
export function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const connection = createConnection({ serverUrl, roomId });
    connection.connect();
    return () => connection.disconnect();
  }, [serverUrl, roomId]);
}
```

The caller may now pass a fresh object literal on every render — which they will — and it
costs nothing, because the hook never depends on the object's identity. **The hook
absorbs the instability instead of exporting the requirement.**

That is the design principle worth taking from this page: **a hook whose correctness
depends on the caller memoizing something has a trap in its signature.** Callers do not
read your dependency array. Destructure at the boundary and the trap disappears.

### The cases destructuring does not cover

- **A genuinely variable-shaped object** — arbitrary query parameters, a config bag you
  cannot enumerate. Serialise it for the dependency (`JSON.stringify(params)`) and accept
  the cost, or require a memoized argument and *say so in the signature*, e.g. by naming
  it `stableOptions`. Silently requiring it is what to avoid.
- **An array argument** — `threshold: [0, 0.5, 1]`. Same problem, same options: serialise
  or require memoization. [Phase 7 · 07 · 04](../07-the-standard-set/04-observing-an-element.md)
  works through this one.
- **A function argument** — handled differently and completely; that is
  [chunk 02](02-not-re-subscribing.md).

## Reactive values in, reactive behaviour out

The pay-off for taking values rather than getters is that re-synchronization becomes
automatic and correct:

```jsx
export function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const options = { serverUrl, roomId };
    const connection = createConnection(options);
    connection.connect();
    connection.on('message', (msg) => showNotification('New message: ' + msg));
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}
```

> Every time your `ChatRoom` component re-renders, **it passes the latest `roomId` and
> `serverUrl` to your Hook.** This is why your Effect re-connects to the chat whenever
> their values are different after a re-render.

Note what the caller had to know: nothing. They passed props. The hook re-synchronizes
when — and only when — the thing it synchronizes with changes. That is the behaviour a
good hook boundary produces, and it is entirely a consequence of taking values instead of
a getter, a ref, or a callback that "returns the current room".

## 🔴 What a hook must never do to its caller

> **Never suppress the dependency linter** with
> `eslint-disable-next-line react-hooks/exhaustive-deps`. This leads to subtle,
> hard-to-find bugs where your Effect uses stale values.

Inside a shared hook this advice is stronger than it is in a component, for a reason the
docs do not need to state: a component's suppressed dependency produces one bug in one
place, where the person who wrote the comment can see it. **A shared hook's suppressed
dependency produces a stale value in every component that calls it**, in files whose
authors never saw the comment and have no reason to suspect the hook.

The rule for a hook you expect other people to use: if the linter is unhappy, restructure
until it is happy. The five documented restructurings — move it to an event handler,
split unrelated effects, use an updater function, use an effect event, extract primitives
— cover essentially every real case, and [chunk 02](02-not-re-subscribing.md) applies
them at this boundary.

## Gotchas

**Symptom:** a hook re-runs its effect on every render of the caller.
**Cause:** an object or function argument in the dependency array; it is a new value
every render even when the contents are identical.
**Fix:** destructure at the boundary and depend on primitives.

**Symptom:** the hook is "fixed" by telling callers to wrap the argument in `useMemo`.
**Cause:** the requirement was exported instead of absorbed.
**Fix:** destructure inside the hook. A hook whose correctness depends on callers reading
its docs will be called wrongly.

**Symptom:** a hook takes a getter (`() => roomId`) to avoid re-runs, and goes stale.
**Cause:** React cannot see inside a function, so the value is invisible to the
dependency array.
**Fix:** pass the value. Custom hooks always receive the latest props and state.

**Symptom:** an `eslint-disable` inside a shared hook, and stale values reported by three
unrelated teams.
**Cause:** the suppression is in one file; its consequences are in every caller.
**Fix:** restructure. Suppression in shared code is a different severity from suppression
in a component.

**Symptom:** an array argument re-triggers the effect even after destructuring.
**Cause:** arrays are objects; `[0, 1]` is new every render.
**Fix:** serialise for the dependency, or name the parameter so the memoization
requirement is visible.

**Symptom:** the hook works in one component and thrashes in another.
**Cause:** the second caller's argument is rebuilt each render while the first's is a
constant.
**Fix:** the hook should not be sensitive to that difference — which means primitives.

## Interview questions

**★ Do the dependency rules change inside a custom hook?**
No. Every reactive value the effect reads must be declared, and the linter checks inside
custom hooks exactly as it does in components — that is one of the concrete things the
`use` prefix buys. What changes is where the values come from: a hook's arguments are its
props, arriving fresh on every render of the caller, so they are reactive by definition.

**★ A hook takes an options object and reconnects on every render. Diagnose and fix it.**
The object is recreated by the caller on every render, so it is a new value even when the
contents are identical, and depending on it re-runs the effect every time. The docs give
three fixes; only one applies at a hook boundary — extracting the primitives, because the
object was built by the caller before the hook ran, so it cannot be moved inside the
effect or hoisted out of the component. Destructure `{ serverUrl, roomId }` in the
signature and depend on those.

**★ Why is "tell callers to memoize the object" the wrong fix?**
Because it exports a requirement instead of absorbing it. Callers do not read your
dependency array, and they will pass an object literal — that is the natural way to call
a hook. A hook whose correctness depends on every caller remembering `useMemo` has a trap
in its signature; destructuring removes the trap entirely and costs one line.

**★ Why is suppressing the dependency linter worse inside a shared hook than in a
component?**
Because the blast radius differs. A suppression in a component produces one stale value
in the file where the comment is visible. A suppression in a shared hook produces stale
values in every component that calls it, in files whose authors never saw the comment and
have no reason to suspect the hook. The documented restructurings — event handler, split
effects, updater function, effect event, extract primitives — cover the real cases.

**Why not accept a getter function so the hook can read the current value without
re-running?**
Because React cannot see inside a function. The value becomes invisible to the dependency
array, so the effect never re-synchronizes when it changes and the hook goes stale — you
have traded a re-render for a wrong answer. Passing the value is what makes re-connection
on change automatic, and custom hooks always receive the latest props and state because
they re-run with the component.

---

← Index: [Hooks that wrap effects](README.md) ·
Prev: [The standard set](../07-the-standard-set/README.md) ·
Next → [Not re-subscribing](02-not-re-subscribing.md)
