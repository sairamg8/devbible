---
title: "What an effect is for"
sidebar_label: "01 · What an effect is for"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects),
> [`useEffect`](https://react.dev/reference/react/useEffect) caveats and
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
> No sandbox script backs this page; claims are cited, not measured.

**An effect synchronizes your component with a system outside React. It is not
"run code after render", not `componentDidMount`, and not where you respond to a
click. Almost every misuse of `useEffect` is one of those three
misunderstandings.**

## The definition

react.dev:

> Effects let you run some code after rendering so that you can **synchronize
> your component with some system outside of React**.

and names what "outside of React" means: browser APIs, third-party widgets,
network requests, non-React components.

The `useEffect` reference states the negative form as a caveat, which is the
most useful sentence in the phase:

> If you're **not trying to synchronize with some external system,** you probably
> don't need an Effect.

**That is the test.** Not "does this need to happen after render?" but *"is there
a thing outside React whose state must be made to match mine?"* If you cannot
name the external system, you are probably writing something that belongs
elsewhere.

## Effects versus events

The distinction the docs draw, and the one that resolves most misuse:

> **Effects** are caused by rendering itself, rather than by a particular
> interaction.

> **Events** are caused by specific user interactions.

Compare two things that look similar:

```jsx
// An EVENT: caused by the user clicking Send
function handleSubmit() {
  sendMessage(text);            // ✅ in the handler
}

// An EFFECT: caused by the component being on screen
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => connection.disconnect();
}, [serverUrl, roomId]);        // ✅ synchronising a connection
```

Sending a message happens **because the user clicked**. Being connected happens
**because this room is on screen** — it is a fact about the current render, and
it must stay true as `roomId` changes.

The practical question: **"why does this happen?"** If the answer names a user
action, it is an event and belongs in a handler. If the answer is "because the
component is showing this data", it is an effect.

## Why "componentDidMount" is the wrong model

The most damaging framing, because it produces code that works once and breaks
on the second render.

Thinking in lifecycle terms leads to `useEffect(fn, [])` — "run on mount" — and
then to a component that never re-synchronises when its props change:

```jsx
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
}, []);                          // 🔴 stays connected to the FIRST room forever
```

Thinking in synchronisation terms leads to the version above, with `[serverUrl,
roomId]` and a cleanup — which connects, disconnects when the room changes,
connects to the new one, and disconnects on unmount. **The same code handles
mount, update and unmount**, because none of those were ever the subject.

react.dev's framing for this is that an effect **starts and stops
synchronizing**, not that it mounts and unmounts. That has its own topic
([09](09-effect-lifecycle.md)) and it is the shift that makes the rest of the
phase obvious.

## Where things actually belong

| The work happens because… | Put it in |
|---|---|
| The user did something | **The event handler** |
| A value can be computed from props/state | **Render** — derive it ([Phase 3 · 06](../phase-3-state/06-derived-state.md)) |
| Something outside React must match this component's state | **An effect**, with a cleanup |
| The app started, once, independent of any component | **Module scope** — not an effect |
| Something must be measured before paint | **`useLayoutEffect`** ([12](12-uselayouteffect.md)) |

The first two rows are where most unnecessary effects come from, and they have
their own topic ([06](06-you-might-not-need-an-effect/README.md)) because there
are eight distinct cases.

The fourth row is worth flagging early: initialising an analytics SDK or checking
an auth token once per application load is **not** a component concern. Putting
it in a mount effect makes it run per component instance and twice in
development.

## Effects only run on the client

> Effects **only run on the client.** They don't run during server rendering.

Two consequences worth having before Phase 11:

- **An effect cannot produce server-rendered HTML.** Data fetched in an effect
  is absent from the initial HTML, which is one of the arguments against
  fetching in effects ([07](07-fetching-data.md)).
- **An effect is where client-only APIs are legal.** `window`, `document`,
  `localStorage` and `matchMedia` do not exist during server rendering, and
  reading them during render breaks hydration. An effect runs after mount, on
  the client, which is exactly when they are safe.

## Interaction-caused effects run earlier than you think

A caveat that catches people doing visual work:

> If your Effect is caused by an interaction (like a click), **React may run your
> Effect before the browser paints the updated screen**. This ensures that the
> result of the Effect can be observed by the event system.

and the complementary one:

> Even if your Effect was caused by an interaction, **React may allow the browser
> to repaint the screen before processing the state updates inside your Effect.**

So the timing of a passive effect relative to paint is **not guaranteed in
either direction**, and depends on what caused it. If you need a guarantee —
measure and adjust before the user sees anything — that is `useLayoutEffect`, and
if you need to defer past paint, `setTimeout` is the documented escape.

## Gotchas

**Symptom:** an effect fetches for the first `id` and never again.
**Cause:** `[]` — the lifecycle model. The effect was written as "on mount"
rather than "keep this in sync with `id`".
**Fix:** list what it reads. The dependency array is not a schedule
([03](03-the-dependency-array.md)).

**Symptom:** a POST fires twice, or on a screen the user did not act on.
**Cause:** an action that belongs to a click was written as an effect reacting
to the state the click set.
**Fix:** put it in the handler. The docs' ordering is handlers first.

**Symptom:** `window is not defined` during a build or server render.
**Cause:** a client-only API read during render.
**Fix:** an effect — this is exactly the case they are for.

**Symptom:** an effect chain — one effect sets state that triggers another.
**Cause:** derivations written as effects.
**Fix:** compute during render ([06](06-you-might-not-need-an-effect/README.md)).

**Symptom:** an SDK initialises once per component instance.
**Cause:** application-level setup placed in a component's mount effect.
**Fix:** module scope, outside any component.

**Symptom:** a tooltip flickers into position.
**Cause:** a passive effect measuring and repositioning after paint.
**Fix:** `useLayoutEffect`, which the caveat names for exactly this.

## Interview questions

**★ What is `useEffect` actually for?**
Synchronizing a component with a system outside React — a browser API, a
third-party widget, a network connection, a non-React component. The
documentation states the negative directly: if you are not synchronizing with an
external system, you probably do not need an effect. That is a much narrower
purpose than "run code after render".

**★ How do you decide between an effect and an event handler?**
Ask why the work happens. Effects are caused by rendering itself; events are
caused by a particular interaction. Sending a message happens because the user
clicked — a handler. Being connected to a chat room happens because that room is
on screen — an effect. If the answer names a user action, it is not an effect.

**★ Why is thinking of `useEffect` as `componentDidMount` harmful?**
Because it produces `useEffect(fn, [])` and a component that synchronises once
and then never again — connected to the first room forever. The synchronisation
model produces the same code with real dependencies and a cleanup, which handles
mount, update and unmount without any of them being the subject.

**Do effects run during server rendering?**
No — they are client-only. That is why data fetched in an effect never appears in
the server-rendered HTML, and also why an effect is the correct place to touch
`window`, `document` or `localStorage`, which do not exist on the server and
break hydration if read during render.

**Is an effect guaranteed to run after the browser paints?**
No, in either direction. If the effect was caused by an interaction React may run
it *before* paint so the event system can observe the result; React may also let
the browser repaint before processing state updates inside the effect. For a
guarantee before paint use `useLayoutEffect`; to defer past paint, `setTimeout`.

**Where does application initialisation belong?**
Module scope, not a mount effect. Work that happens once per application load —
initialising an SDK, checking a token — is not a component concern; putting it in
an effect makes it run per component instance and twice in development.

---

← Index: [Phase 4](README.md) · Next → [`useEffect` anatomy](02-useeffect-anatomy.md)
