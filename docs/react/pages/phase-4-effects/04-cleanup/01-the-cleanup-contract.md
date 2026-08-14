---
title: "The cleanup contract"
sidebar_label: "01 · The cleanup contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useEffect`](https://react.dev/reference/react/useEffect) (Parameters,
> Caveats, Troubleshooting) and
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).
> No sandbox script backs this page; claims are cited, not measured.

**Cleanup is not teardown code that runs when the component dies. It is the
`stop` half of a `start`/`stop` pair, and React will call that pair as many
times as it needs to — which is the whole design.**

## The contract, in one sentence

> The cleanup function should stop or undo whatever the setup function was
> doing. The rule of thumb is that the user shouldn't be able to distinguish
> between the setup being called once (as in production) and a *setup* →
> *cleanup* → *setup* sequence (as in development).

That second sentence is the testable part. It is not advice about tidiness — it
is an **invariant you can check every effect against**. Run the setup, run the
cleanup, run the setup again. If the screen, the network, or the outside world
now looks different from having run setup once, the cleanup is incomplete.

Every rule in this topic is a consequence of that one sentence.

## Cleanup is not "unmount code"

The single most expensive misreading in the phase. Cleanup runs on **three**
occasions, and unmount is only the last of them:

| When | What React does |
|---|---|
| A commit where a dependency changed | cleanup with the **old** values, then setup with the new ones |
| The component is removed from the DOM | cleanup, one final time |
| Development, with `StrictMode` | one extra setup+cleanup cycle **before** the first real setup |

From the reference, on the first two:

> After every commit with changed dependencies, React will first run the cleanup
> function (if you provided it) with the old values, and then run your setup
> function with the new values. After your component is removed from the DOM,
> React will run your cleanup function.

So an effect whose dependency changes ten times runs its cleanup ten times while
the component sits there perfectly alive. react.dev has a troubleshooting entry
for people who hit this and assume something is broken — *"My cleanup logic runs
even though my component didn't unmount."* Nothing is broken. **Cleanup is tied
to the effect's dependencies, not to the component's lifetime.**

This is why `componentWillUnmount` is the wrong mental model for the return
value, in exactly the way `componentDidMount` is the wrong model for the setup
([topic 01](../01-what-an-effect-is-for.md)). The class methods fired once per
mount. Cleanup fires once per *stop*.

## Cleanup closes over the old render

Because cleanup is created inside the setup, it captures that render's values:

```jsx
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => {
    connection.disconnect();
  };
}, [serverUrl, roomId]);
```

When `roomId` goes from `"general"` to `"travel"`, the cleanup that runs is the
one built during the `"general"` render. It holds the `"general"` `connection`
object, so it disconnects from `"general"` — then the new setup connects to
`"travel"`.

That is not incidental. **It is the only reason the sequence can be correct.** A
cleanup that somehow saw the new values would disconnect from a room it was
never connected to and leave the old connection open. The closure is the
mechanism, and it is why the dependency array cannot be lied about
([topic 03](../03-the-dependency-array.md)) — a missing dependency means the
cleanup is holding stale handles it will never be asked to release.

## "Symmetrical" is the test

The troubleshooting section states the requirement directly:

> Your cleanup logic should be "symmetrical" to the setup logic, and should stop
> or undo whatever setup did

The practical version: read the setup line by line and name each line's inverse.
If a line has one, the cleanup must contain it.

| Setup does | Cleanup must |
|---|---|
| `connection.connect()` | `connection.disconnect()` |
| `addEventListener(type, handler)` | `removeEventListener(type, handler)` — **the same handler reference** |
| `setInterval(fn, ms)` | `clearInterval(id)` with the returned id |
| `dialog.showModal()` | `dialog.close()` |
| `observer.observe(node)` | `observer.disconnect()` |
| `node.style.opacity = 1` | reset it to the value it started at |
| starts a fetch | ignore or abort its result |
| `logVisit(url)` | **nothing** — it has no inverse and needs none |

The last two rows are the interesting ones, and they get their own treatment in
[chunk 02](02-cleanup-recipes.md). A fetch cannot be un-sent; an analytics POST
should not be. Symmetry is about the *observable effect*, not about the call.

## The anti-fix: guarding with a ref

When an effect misbehaves under the extra development cycle, the tempting fix is
to make it stop running twice:

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

react.dev flags this one with unusual force, and the reason is worth stating
plainly:

> This makes it so you only see the setup once in development, but it doesn't
> fix the underlying bug.

The guard suppresses the **symptom**, not the cause. The effect still has no way
to stop synchronising, so the connection now survives unmount — a leak, in
production, where `StrictMode` was never the issue. The double-invocation was a
smoke alarm; the ref removes the alarm and leaves the fire.

react.dev is explicit that the question itself is wrong:

> The right question isn't "how to run an Effect once", but "how to fix my
> Effect so that it works after remounting".

Anything shaped like `hasRun`, `isFirstRender`, `didInit`, or a module-level
boolean is the same anti-fix wearing a different name. **The fix is always to
write the cleanup**, which is what [topic 05](../05-strictmode-double-invocation.md)
covers from the other direction.

## Cleanup without setup is a code smell

The inverse mistake, also from the troubleshooting section:

> If you have cleanup code without corresponding setup code, it's usually a code
> smell

An effect that only returns a function — no setup body worth speaking of — is
usually reaching for "run this when the component goes away", which is a
lifetime concern rather than a synchronisation one. Since cleanup also runs on
every dependency change, that code will fire at times the author never
considered.

And where there is no external system on either side, the docs point one step
further out:

> If there is no external system, consider whether removing the Effect
> altogether would simplify your logic.

Which is [topic 06](../06-you-might-not-need-an-effect/README.md).

## Gotchas

**Symptom:** a subscription is torn down and rebuilt while the component is
clearly still on screen.
**Cause:** a dependency changed. Cleanup is tied to dependencies, not to the
component's lifetime.
**Fix:** nothing to fix if the dependency genuinely changed. If it changes on
every render, that is the reference-identity problem from
[topic 03](../03-the-dependency-array.md), not a cleanup problem.

**Symptom:** `removeEventListener` in the cleanup does not remove the listener.
**Cause:** a different function reference was passed than the one registered —
typically an inline arrow in both places, or a handler recreated between setup
and cleanup.
**Fix:** declare the handler inside the setup and pass that same binding to
both calls.

**Symptom:** adding a ref guard made the development double-run go away, and a
week later the app leaks connections.
**Cause:** the guard suppressed the stress test instead of fixing the effect.
The effect never had a way to stop.
**Fix:** delete the guard and write the cleanup.

**Symptom:** the cleanup disconnects from the wrong room, closes the wrong
socket, or clears the wrong timer.
**Cause:** it is reading a value from outside its own closure — usually a ref or
a module variable that has since been overwritten by a later setup.
**Fix:** capture the handle in a `const` inside the setup body and close over
that.

**Symptom:** an effect body is almost empty and the return value does all the
work.
**Cause:** cleanup written without corresponding setup — a "when this unmounts"
in effect clothing.
**Fix:** ask what is being synchronised. If the answer is "nothing", the effect
probably should not exist.

**Symptom:** cleanup never seems to run at all.
**Cause:** the setup returns something that is not a function — commonly an
`async` setup returning a promise
([topic 02](../02-useeffect-anatomy.md)), or a stray `=>` returning an
expression value.
**Fix:** return a real function, and check the console for React's warning about
the return type.

## Interview questions

**★ When does an effect's cleanup function run?**
Three times, and unmount is only one of them. Before every re-run caused by a
changed dependency, running with the old values; once when the component is
removed from the DOM; and in development under `StrictMode`, one extra
setup+cleanup cycle before the first real setup. Treating it as
`componentWillUnmount` is the standard mistake — cleanup fires once per *stop*,
not once per lifetime.

**★ What is the rule for deciding whether a cleanup is correct?**
The user must not be able to distinguish setup running once from a setup →
cleanup → setup sequence. That is a check you can actually run against an
effect, not a style preference. React makes the check automatic in development
by remounting the component once, which is what the extra cycle is for.

**★ Why does the cleanup see the old values rather than the new ones?**
Because it is created inside the setup, so it closes over the render that made
it. That is the only arrangement that works: when `roomId` changes, the cleanup
must disconnect from the *previous* room, and it can only do that if it holds
the previous connection. It also explains why a lie in the dependency array is
dangerous — the cleanup ends up holding handles it is never asked to release.

**Why is a ref guard the wrong way to stop an effect firing twice?**
It hides the symptom and leaves the bug. The effect still cannot stop
synchronising, so the resource now survives unmount — a leak in production,
where `StrictMode` was never involved. react.dev's framing is that the question
is wrong: the goal is not to run the effect once, it is to make the effect
survive remounting, and the answer to that is the cleanup.

**What does "symmetrical" mean for cleanup logic?**
Read the setup line by line; every line with an inverse must have that inverse
in the cleanup — connect/disconnect, subscribe/unsubscribe, observe/disconnect,
set a style/restore it. Symmetry is judged on the observable effect, not on the
call count, which is why a fetch is "undone" by ignoring its result and an
analytics ping needs no cleanup at all.

**What does it mean if an effect has cleanup but almost no setup?**
react.dev calls it a code smell. It usually means the effect is being used to
express "do this when the component goes away", which is a lifetime concern
rather than a synchronisation one — and since cleanup also runs on every
dependency change, it will fire at moments the author never intended. If there
is no external system on either side, the effect itself is likely unnecessary.

---

Index: [Cleanup](README.md) · Next → [Cleanup recipes](02-cleanup-recipes.md)
