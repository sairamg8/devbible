---
title: "17.1 · From pub/sub to dependency tracking"
sidebar_label: "01 · From pub/sub to tracking"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [get](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) / [set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set) accessors, [`try...finally`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch) — and the TC39 [Signals proposal](https://github.com/tc39/proposal-signals) (**Stage 1**). Documentation-validated; **nothing was run**.

**Pub/sub and signals differ in exactly one place: who names the dependency.** In a pub/sub you
subscribe to a topic by hand. In a reactive system, *reading* a value is the subscription — the
dependency graph is discovered as a side effect of running your code.

Getting from one to the other is about forty lines.

## The pub/sub, in twelve

```js
function createBus() {
  const topics = new Map();                       // topic → Set of handlers

  return {
    on(topic, handler) {
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic).add(handler);
      return () => topics.get(topic)?.delete(handler);      // unsubscribe
    },
    emit(topic, payload) {
      for (const handler of [...(topics.get(topic) ?? [])]) {
        try { handler(payload); } catch (err) { queueMicrotask(() => { throw err; }); }
      }
    },
  };
}
```

Three decisions carry the whole thing, and they are the same three every emitter faces
([05 · An `EventEmitter`](../05-eventemitter/README.md) works them through in full, including
`once`, wildcards and the listener-identity trap):

- **`on` returns an unsubscribe function.** Removal by handler identity is the classic leak —
  callers pass an inline arrow, cannot reproduce the reference, and never unsubscribe.
- **Iterate a copy.** A handler that subscribes or unsubscribes during `emit` mutates the `Set`
  mid-iteration; `[...set]` makes the delivery list immutable for this emission.
- **One throwing handler must not cancel the rest.** Catching and rethrowing in a microtask keeps
  delivery going while still surfacing the error to global error handling rather than swallowing
  it.

**What it cannot do** is the point of the rest of this topic. The subscriber has to know the topic
name, the publisher has to remember to emit, and nothing checks that the two agree. Rename a
topic and the failure is silence.

## The idea: make reading the subscription

```js
let current = null;                       // the effect being run, if any

function signal(initial) {
  let value = initial;
  const subscribers = new Set();

  return {
    get() {
      if (current) { subscribers.add(current); current.deps.add(subscribers); }
      return value;
    },
    set(next) {
      if (Object.is(next, value)) return;                 // nothing changed — stop here
      value = next;
      for (const sub of [...subscribers]) sub.run();
    },
  };
}

function effect(fn) {
  const observer = { deps: new Set(), run };

  function run() {
    for (const dep of observer.deps) dep.delete(observer);   // drop last run's dependencies
    observer.deps.clear();

    const previous = current;
    current = observer;
    try { fn(); } finally { current = previous; }             // always restore
  }

  run();
  return () => { for (const dep of observer.deps) dep.delete(observer); observer.deps.clear(); };
}
```

```js
const count = signal(0);
effect(() => document.title = `${count.get()} items`);   // reads → subscribes
count.set(1);                                             // writes → the effect re-runs
```

Nobody named a topic. `count.get()` ran while `current` pointed at the effect, so the signal
recorded it — **dependency tracking is a side effect of reading, and that is the entire trick**.

## The five lines that are load-bearing

### 1 · `Object.is` before anything else

Setting a value to what it already was must do nothing. Without this bail-out, every write
propagates through the whole graph and a reactive system is slower than the imperative code it
replaced. `Object.is` rather than `===` so that `NaN` compares equal to itself and does not
re-run forever.

### 2 · Dependencies are re-collected on every run

```js
effect(() => {
  if (showDetails.get()) render(details.get());
});
```

When `showDetails` is `false`, `details` is never read, so the effect **must not** be subscribed
to it. Clearing `observer.deps` at the top of `run` is what makes the graph follow the branch
taken *this* time. Skip it and effects accumulate dependencies they no longer read — they re-run
for irrelevant changes, and they keep the signals alive.

### 3 · `current` is a stack, not a variable

`current = previous` rather than `current = null`, because effects nest: an effect that calls a
function that creates another effect must not steal the inner one's reads. Restoring the previous
value is what makes the nesting correct.

### 4 · `finally`, always

If `fn` throws, `current` must still be restored. Without the `finally`, one exception leaves the
tracker pointing at a dead observer and **every subsequent signal read anywhere subscribes to
it** — the corruption outlives the error and looks nothing like its cause.

### 5 · Iterate a copy of the subscriber set

The same reason as the bus: a re-running effect re-registers itself while the notification loop is
running.

## 🔴 Tracking is synchronous, and only synchronous

```js
effect(async () => {
  render(user.get());                 // ✅ tracked
  const data = await fetchStuff();
  render(data, settings.get());       // ⛔ NOT tracked — the run already returned
});
```

`current` is restored when `fn` returns, and an `async` function returns at its first `await`.
Everything after it runs with `current` back to `null`, so those reads register nothing and the
effect never re-runs for them. It is the single most common way a hand-rolled — or hand-used —
reactive system quietly stops updating.

The same applies to a read inside `setTimeout`, a promise callback, or an event handler created
inside the effect. **Read every signal you depend on synchronously, at the top**, then go
asynchronous with plain values.

## The other two ways to write a loop

```js
const n = signal(0);
effect(() => n.set(n.get() + 1));           // ⛔ reads and writes the same signal — infinite
```

The effect subscribes to `n`, then writes `n`, which re-runs the effect. There is no clever fix:
either read without subscribing (an `untrack` escape hatch), or derive the value instead of
assigning it — that is what a computed is for
([17.2](./02-making-it-real.md)).

The subtler one is **two effects that write each other's signals**, which terminates only if the
values converge. A reactive graph is a program, and a cycle in it is a `while` loop with no
condition.

## Where this sits in the ecosystem

There is a **Stage 1** TC39 proposal for signals, and its framing is worth quoting because it
tells you what to aim for and what not to:

> *"A computed Signal automatically discovers any other Signals that it is dependent on, whether
> those Signals be simple values or other computations."*
>
> *"Computation is 'glitch-free', meaning no unnecessary calculations are ever performed."*
>
> *"Computations are not eagerly evaluated when they are declared, nor are they immediately
> evaluated when their dependencies change."*
>
> *"The API is not targeted to most application developers. Instead, the signal API here is a
> better fit for frameworks to build on top of."*

The forty lines above have the first property and neither of the others — they are eager and they
are not glitch-free. [17.2](./02-making-it-real.md) is about exactly that gap.

## Gotchas

**Symptom:** An effect stops re-running after some change to the code.
**Cause:** The signal is now read after an `await` or inside a callback, so the read is untracked.
**Fix:** Read synchronously at the top of the effect and pass plain values onward.

**Symptom:** An effect re-runs for a signal it no longer reads.
**Cause:** Dependencies were not cleared before re-running, so an old branch's subscriptions
survive.
**Fix:** Remove the observer from every dependency at the start of each run.

**Symptom:** Every signal read anywhere starts subscribing to one dead effect.
**Cause:** An exception escaped the effect and `current` was never restored.
**Fix:** Restore in a `finally`.

**Symptom:** The page hangs on a state update.
**Cause:** An effect writes a signal it also reads, or two effects write each other's.
**Fix:** Derive rather than assign; use an untracked read where a write really is intended.

**Symptom:** Handlers are missed, or the same one fires twice, during an emit.
**Cause:** The subscriber collection was mutated while it was being iterated.
**Fix:** Iterate a snapshot.

**Symptom:** Setting a value to the same value causes a cascade of work.
**Cause:** No equality bail-out in the setter.
**Fix:** `Object.is(next, value)` and return early.

## Interview questions

**★ What is the difference between pub/sub and a signal?**
Who names the dependency. In pub/sub the subscriber names a topic; with signals, reading the value
inside a tracked scope *is* the subscription, so the graph is discovered rather than declared.

**★ Implement dependency tracking.**
Keep a module-level `current` observer. A signal's getter adds `current` to its subscriber set;
its setter bails out on an equal value and otherwise re-runs each subscriber. An effect sets
`current` to itself, runs, and restores the previous value in a `finally`.

**★ Why must dependencies be re-collected on every run?**
Because a conditional read means the dependency set changes between runs. Keeping stale
dependencies makes the effect re-run for values it no longer uses and keeps them alive.

**★ Why does a signal read after `await` not register?**
Tracking is synchronous — `current` is restored when the effect function returns, and an async
function returns at its first `await`. Reads after that point are untracked.

**★ Why `Object.is` rather than `===`?**
It treats `NaN` as equal to itself, so a signal holding `NaN` does not re-notify on every write.
(It also distinguishes `0` from `-0`, which is rarely what decides it.)

**How do you unsubscribe from an effect?**
The effect returns a disposer that removes the observer from every dependency set it joined —
which is the same operation the re-run does before collecting fresh ones.

---

[Topic index](./README.md) · Next → [Making it real](./02-making-it-real.md)
