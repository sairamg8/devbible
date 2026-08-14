---
title: "Restructuring the effect"
sidebar_label: "02 · Restructuring the effect"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies).
> No sandbox script backs this page; claims are cited, not measured.

**Four moves that change what the effect *is*, rather than what it reads. Each one
removes a dependency by making it genuinely irrelevant to the synchronization.**

[Chunk 01](01-objects-and-functions.md) dealt with identity. These deal with
structure — and each corresponds to a different reason the unwanted dependency
was there in the first place.

## Move 5 — the updater form

When the effect reads state only to compute the next state:

```jsx
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    const connection = createConnection();
    connection.connect();
    connection.on('message', (receivedMessage) => {
      setMessages(msgs => [...msgs, receivedMessage]);
    });
    return () => connection.disconnect();
  }, [roomId]); // ✅ messages is not a dependency
}
```

Written as `setMessages([...messages, receivedMessage])`, the effect reads
`messages`, so `messages` is a dependency — and the chat **reconnects on every
received message**, which is a spectacular bug for a chat client.

`msgs => [...msgs, receivedMessage]` asks React for the previous value instead of
closing over it. The effect no longer reads `messages` at all, so it is no longer
a dependency, and the connection survives.

This is [Phase 3 · 03](../../phase-3-state/03-updater-functions.md)'s third case,
and the one that makes the updater form a *correctness* tool rather than a
stylistic preference: it is often the fix for a **dependency array** problem
rather than a value problem.

## Move 6 — extract an Effect Event

When the effect must *read* a value but should not *react* to it:

```jsx
function ChatRoom({ roomId }) {
  const [isMuted, setIsMuted] = useState(false);

  const onMessage = useEffectEvent(receivedMessage => {
    setMessages(msgs => [...msgs, receivedMessage]);
    if (!isMuted) {
      playSound();
    }
  });

  useEffect(() => {
    const connection = createConnection();
    connection.connect();
    connection.on('message', (receivedMessage) => {
      onMessage(receivedMessage);
    });
    return () => connection.disconnect();
  }, [roomId]); // ✅ isMuted is not a dependency
}
```

Muting the chat should not reconnect it. `onMessage` always sees the current
`isMuted` without the effect depending on it — [topic 10](../10-useeffectevent.md)
in full.

**The same move handles function props**, which is the answer to the impure
`getOptions` case left open in [chunk 01](01-objects-and-functions.md):

```jsx
function ChatRoom({ roomId, onReceiveMessage }) {
  const onMessage = useEffectEvent(receivedMessage => {
    onReceiveMessage(receivedMessage);
  });

  useEffect(() => {
    const connection = createConnection();
    connection.connect();
    connection.on('message', (receivedMessage) => {
      onMessage(receivedMessage);
    });
    return () => connection.disconnect();
  }, [roomId]); // ✅ onReceiveMessage is not a dependency
}
```

A parent that passes an inline arrow would otherwise reconnect the chat on every
parent render. Wrapping the call means the effect no longer depends on the
callback's identity — while still calling the *latest* one.

## Move 7 — move the code to an event handler

When the unwanted dependency exists because the code was never an effect:

```jsx
// ❌ Avoid: Event-specific logic inside an Effect
function Form() {
  useEffect(() => {
    if (submitted) {
      post('/api/register');
      showNotification('Successfully registered!', theme);
    }
  }, [submitted, theme]);
}

// ✅ Good: Event-specific logic in event handler
function Form() {
  const theme = useContext(ThemeContext);

  function handleSubmit() {
    post('/api/register');
    showNotification('Successfully registered!', theme);
  }
}
```

`theme` was a dependency of an effect that had no business existing. Note the
symptom the effect version produces: **changing the theme re-registers the user**,
because `theme` changing re-runs the effect and `submitted` is still `true`.

Also note `submitted` — a piece of state whose only job is to trigger the effect,
which is [topic 06 · 01](../06-you-might-not-need-an-effect/01-logic-that-belongs-to-an-event.md)'s
message-queue antipattern. Both the state and the effect disappear together.

## Move 8 — split into several effects

When different parts of one effect should re-run for different reasons:

```jsx
function ShippingForm({ country }) {
  const [cities, setCities] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetch(`/api/cities?country=${country}`)
      .then(response => response.json())
      .then(json => { if (!ignore) setCities(json); });
    return () => { ignore = true; };
  }, [country]);

  const [city, setCity] = useState(null);
  const [areas, setAreas] = useState(null);
  useEffect(() => {
    if (city) {
      let ignore = false;
      fetch(`/api/areas?city=${city}`)
        .then(response => response.json())
        .then(json => { if (!ignore) setAreas(json); });
      return () => { ignore = true; };
    }
  }, [city]);
}
```

Merged, the array would be `[country, city]` and **changing the city would refetch
the cities list** — a request that cannot possibly return anything different.

This is [topic 09](../09-effect-lifecycle.md)'s "one synchronization process per
effect" arriving as a dependency problem. Each effect keeps only the dependencies
of the thing it actually synchronizes, and each keeps its own `ignore` flag
([topic 08](../08-race-conditions.md)) because they are separate requests.

## Which move for which symptom

| The dependency is there because… | Move |
|---|---|
| the effect computes next state from current state | updater form |
| the effect reads a value it should not react to | `useEffectEvent` |
| a callback prop's identity changes | `useEffectEvent` around the call |
| an interaction, not rendering, caused the code | event handler |
| the effect does two unrelated things | split it |

## Gotchas

**Symptom:** a chat reconnects every time a message arrives.
**Cause:** the effect reads `messages` to append to it, so `messages` is a
dependency and every message changes it.
**Fix:** the updater form. The effect stops reading the state entirely.

**Symptom:** toggling mute, or any unrelated switch, tears down a subscription.
**Cause:** the effect reads that state for a decision made *when an event fires*,
not for what it synchronizes.
**Fix:** extract an Effect Event.

**Symptom:** a child's effect re-runs whenever the parent renders, and the
dependency is a callback prop.
**Cause:** the parent passes an inline arrow, so the identity changes every
render.
**Fix:** wrap the call in an Effect Event in the child. It needs no cooperation
from the parent.

**Symptom:** changing a theme, locale or similar re-sends a request that was
already sent.
**Cause:** event logic in an effect, with a trigger flag that is still `true`, so
any dependency change replays it.
**Fix:** move it to the handler and delete the trigger state.

**Symptom:** selecting a city refetches the list of countries.
**Cause:** two fetches in one effect, so the array is the union of both.
**Fix:** split them. Each effect gets the dependencies of what it synchronizes.

**Symptom:** splitting the effect produced two `ignore` flags and that looks
redundant.
**Cause:** it is not — they are separate requests with separate lifecycles.
**Fix:** keep both. One flag per synchronization process.

## Interview questions

**★ How does the updater form remove a dependency?**
By making the effect stop reading the state. `setMessages([...messages, msg])`
reads `messages`, so it is a dependency and every arriving message re-runs the
effect — a chat that reconnects on each message. `setMessages(msgs => [...msgs,
msg])` asks React for the previous value instead, so the state is never read from
the render and never enters the array. It is the clearest case of the updater form
being a correctness tool rather than a style choice.

**★ When do you reach for `useEffectEvent` in this list?**
When the effect must read a value but should not re-synchronize because of it —
`isMuted` deciding whether to play a sound when a message arrives. Muting should
not reconnect the chat. The same move wraps a callback prop whose identity changes
each render, so the effect calls the latest callback without depending on its
identity. What it must not do is shrink an array whose dependencies are genuinely
part of the synchronization.

**★ Why does splitting an effect change its dependencies?**
Because one effect has one array, so merging two processes makes it the union of
both. react.dev's shipping form fetches cities by country and areas by city; if
merged, changing the city refetches the countries' cities for no reason. Split,
each effect declares only what its own synchronization reads. It is the
dependency-array consequence of "each effect is one synchronization process".

**Your effect depends on a callback prop and the parent passes an inline arrow.
What are the options?**
Wrap the call in an Effect Event inside your own component — the effect then calls
the latest callback without depending on its identity, and the parent needs no
change. Asking the parent to memoize with `useCallback` also works but puts the
obligation on every caller and can be defeated by one unstable dependency
upstream, which is why the documented fix lives in the consuming component.

**What does a `submitted` boolean in a dependency array usually indicate?**
That an interaction's logic was put in an effect and state is being used as a
trigger. The array then contains both the flag and whatever else the code reads,
so an unrelated change — the theme in react.dev's example — replays the action
while the flag is still true, re-registering the user. Moving the code into the
submit handler removes the effect, the flag and both dependencies at once.

---

← Prev: [Objects and functions](01-objects-and-functions.md) · Index: [Removing dependencies](README.md) · Next → [The illegitimate fixes](03-the-illegitimate-fixes.md)
