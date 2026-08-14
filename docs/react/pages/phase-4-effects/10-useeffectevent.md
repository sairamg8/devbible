---
title: "useEffectEvent"
sidebar_label: "10 · useEffectEvent"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) and
> [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects).
> 🔴 **Stability re-checked on 2026-08-14:** the reference page carries **no
> experimental or canary banner** and documents it as a stable Hook, consistent
> with the React 19.2 release post (1 Oct 2025) listing it as shipped.
> No sandbox script backs this page; claims are cited, not measured.

**A way to read the latest props and state from inside an effect *without* making
them dependencies — and the only sanctioned way to do that. It exists for one
specific problem, and using it for anything else is explicitly called out as
misuse.**

## The problem it solves

A chat room that connects, and shows a notification styled by the current theme:

```jsx
function ChatRoom({ roomId, theme }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('connected', () => {
      showNotification('Connected!', theme);
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, theme]); // ✅ All dependencies declared
}
```

The dependency array is **correct** — `theme` is read by the setup, so
[topic 03](03-the-dependency-array.md) says it belongs there. And the result is a
real bug: **toggling dark mode disconnects and reconnects the chat.**

This is the case where the previous topics run out of answers. You cannot remove
`theme` (the linter is right), and you cannot keep it (the behaviour is wrong).
The array is not the problem — the effect contains **two kinds of logic** and the
array can only describe one of them.

## The distinction underneath

> **Event handlers** run in response to specific interactions. *Logic inside event
> handlers is not reactive.* It will not run again unless the user performs the
> same interaction again.
>
> **Effects** run whenever synchronization is needed. *Logic inside Effects is
> reactive.* If your Effect reads a reactive value, you must specify it as a
> dependency.

Connecting is reactive: change the room, reconnect. Showing the notification is
not: it happens once, when the connection event fires, and should simply use
whatever the theme is *at that moment*. Two behaviours, one effect.

> **Effect Events are non-reactive** "pieces" of your Effect code. They always
> "see" the latest values of your props and state, but their execution doesn't
> cause the surrounding Effect to re-run.

## The fix

```jsx
function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('connected', () => {
      onConnected();
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // ✅ All dependencies declared
}
```

`theme` is now read inside `onConnected`, which is not reactive — so it is **not**
a dependency, and the array is still complete and still honest. Changing the theme
no longer reconnects; the next notification simply uses the new theme.

Note what did *not* happen: nothing was suppressed. `[roomId]` is the genuinely
correct array for what the effect now synchronizes. This is the difference between
`useEffectEvent` and an `eslint-disable` comment — one restructures the code so
the array becomes right, the other lies about an array that is wrong
([topic 03](03-the-dependency-array.md)).

## The rules, and they are strict

> - `useEffectEvent` is a Hook, so you can only call it **at the top level** of
>   your component or your own Hooks.
> - **Effect Events can only be called from inside Effects or other Effect
>   Events.** Do not call them during rendering or pass them to other components
>   or Hooks. The `eslint-plugin-react-hooks` linter enforces this restriction.
> - **Do not use `useEffectEvent` to avoid specifying dependencies** in your
>   Effect's dependency array. This hides bugs and makes code harder to
>   understand. Only use it for logic that is genuinely an event fired from
>   Effects.
> - Effect Event functions **do not have a stable identity.**

The third is the one to internalise. `useEffectEvent` can silence any dependency
you like — wrap the whole effect body in one and the array becomes `[]`. The docs
name that as misuse rather than a clever trick, because the dependency is still
real; you have only made the staleness invisible.

**The test:** is this piece of logic genuinely *an event* — something that happens
at a moment, in response to something, and should use current values? Or is it
part of what the effect *synchronizes*? Only the first belongs in an Effect Event.

## The unstable identity is deliberate

The most interesting design detail, and easy to misread as an oversight:

> Unlike `set` functions from `useState` or refs, Effect Event functions do not
> have a stable identity. Their identity **intentionally** changes on every
> render… The non-stable identity acts as a **runtime assertion**: if your code
> incorrectly depends on the function identity, you'll see the Effect re-running
> on every render, making the bug obvious.

So the instability is a trap laid on purpose. Put `onConnected` in a dependency
array and the effect re-runs every single render — loudly, immediately, on your
machine. Had it been stable, the same misuse would have been silent.

The practical consequence: **never put an Effect Event in a dependency array**,
and do not reach for `useCallback` around it.

## What you cannot do with it

> Effect Events are very limited in how you can use them:
> - **Only call them from inside Effects.**
> - **Never pass them to other components or Hooks.**

```jsx
function Timer() {
  const [count, setCount] = useState(0);

  const onTick = useEffectEvent(() => {
    setCount(count + 1);
  });

  useTimer(onTick, 1000); // 🔴 Avoid: Passing Effect Events

  return <h1>{count}</h1>;
}
```

> Always declare Effect Events directly next to the Effects that use them.

Which rules out the most tempting use: passing one into a custom hook so the hook
can call back with fresh values. If a custom hook needs that, the Effect Event
belongs **inside** the hook, next to that hook's own effect.

## Gotchas

**Symptom:** a WebSocket or chat connection tears down when the theme, locale or
some other unrelated prop changes.
**Cause:** the effect reads that value for a one-off notification, so it is
correctly a dependency of an effect that should not depend on it.
**Fix:** extract the non-reactive part into `useEffectEvent`.

**Symptom:** an effect re-runs on every single render after adding an Effect
Event.
**Cause:** the Effect Event was put in the dependency array. Its identity changes
every render **by design**.
**Fix:** leave it out of the array. This is the intended runtime assertion firing.

**Symptom:** the linter complains about calling an Effect Event during render or
in an event handler.
**Cause:** they may only be called from inside effects or other Effect Events.
**Fix:** if the logic belongs in a click handler, it was an ordinary function all
along ([topic 06 · 01](06-you-might-not-need-an-effect/01-logic-that-belongs-to-an-event.md)).

**Symptom:** an Effect Event is passed into a custom hook so the hook can call it.
**Cause:** the documented "never pass them to other components or Hooks" rule.
**Fix:** move the Effect Event inside the hook, next to the effect that calls it.

**Symptom:** the dependency array shrank to `[]` after adopting `useEffectEvent`
and a stale-value bug appeared.
**Cause:** using it to avoid declaring dependencies rather than to extract event
logic — explicitly named as misuse.
**Fix:** only the genuinely event-like part goes in. If the effect's
*synchronization* reads a value, it is a dependency.

**Symptom:** `useCallback` wrapped around an Effect Event to "stabilise" it.
**Cause:** treating the intentional instability as a problem.
**Fix:** remove it. Nothing should depend on the identity.

## Interview questions

**★ What problem does `useEffectEvent` solve that the dependency array cannot?**
An effect containing both reactive and non-reactive logic. react.dev's example
connects to a chat room and shows a themed notification: `theme` is genuinely read
by the setup, so the linter correctly demands it, but including it makes the chat
reconnect on every theme toggle. You can neither remove it nor keep it. Extracting
the notification into an Effect Event makes that part non-reactive, so `[roomId]`
becomes the complete and correct array.

**★ How is this different from an `eslint-disable` comment?**
It restructures the code so the array becomes correct, rather than lying about an
array that is wrong. After the change, the effect genuinely does not depend on
`theme` for its synchronization — the value is read at call time by non-reactive
code. Disabling the rule leaves the effect reading a stale `theme` forever;
`useEffectEvent` leaves it reading the current one.

**★ Why do Effect Events deliberately have an unstable identity?**
As a runtime assertion. react.dev states the identity changes on every render on
purpose, so that if your code incorrectly depends on it — most obviously by
putting it in a dependency array — the effect re-runs every render and the bug is
immediately visible. A stable identity would have made the same mistake silent.
The corollary is that you never put an Effect Event in a dependency array and never
wrap it in `useCallback`.

**What are the rules for where an Effect Event can be called?**
Declared at the top level like any Hook, and called **only** from inside effects or
other Effect Events — never during render, never from an event handler, and never
passed to another component or Hook. The `eslint-plugin-react-hooks` linter
enforces it. Effect Events are meant to be declared right next to the effect that
uses them.

**When is reaching for `useEffectEvent` a mistake?**
When it is being used to shrink a dependency array rather than to extract genuinely
event-like logic — the docs call this out directly, saying it hides bugs. The test
is whether the logic is something that *happens at a moment* and should use current
values, or something the effect *synchronizes*. Only the first qualifies; wrapping
the whole effect body to reach `[]` makes real staleness invisible.

**A custom hook needs to call back into the component with fresh values. Can you
pass it an Effect Event?**
No — that is the explicitly documented prohibition, and react.dev's `useTimer`
example is exactly this shape. The Effect Event should live inside the custom hook,
next to that hook's own effect, rather than being handed across the boundary.

---

← Prev: [An effect has its own lifecycle](09-effect-lifecycle.md) · Index: [Phase 4](README.md) · Next → [Removing dependencies legitimately](11-removing-dependencies/README.md)
