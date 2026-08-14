---
title: "useState vs useReducer"
sidebar_label: "09 · useState vs useReducer"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
> (§ Comparing `useState` and `useReducer`).
> No sandbox script backs this page; claims are cited, not measured.

**The comparison react.dev actually makes — including the part most write-ups leave
out, which is that the two are equivalent and the choice is partly taste.**

## They are interchangeable

> You can always convert between `useState` and `useReducer` back and forth: **they
> are equivalent!**

Worth starting here, because it removes the anxiety from the decision. Nothing is
possible with one and impossible with the other. Choosing wrongly is a
readability cost, not a correctness cost, and it is reversible.

> You don't have to use reducers for everything: **feel free to mix and match!** You
> can even `useState` and `useReducer` in the same component.

## The five axes, verbatim

> - **Code size:** Generally, with `useState` you have to write less code upfront.
>   With `useReducer`, you have to write both a reducer function *and* dispatch
>   actions. However, `useReducer` can help cut down on the code **if many event
>   handlers modify state in a similar way.**
>
> - **Readability:** `useState` is very easy to read when the state updates are
>   simple. When they get more complex, they can bloat your component's code and
>   make it difficult to scan. In this case, `useReducer` lets you cleanly separate
>   **the *how* of update logic from the *what happened* of event handlers.**
>
> - **Debugging:** When you have a bug with `useState`, it can be difficult to tell
>   *where* the state was set incorrectly, and *why*. With `useReducer`, you can add
>   a console log into your reducer to see **every state update, and *why* it
>   happened** (due to which `action`). If each `action` is correct, you'll know
>   that the mistake is in the reducer logic itself. However, **you have to step
>   through more code** than with `useState`.
>
> - **Testing:** A reducer is a pure function that doesn't depend on your component.
>   This means that you can **export and test it separately in isolation.**
>
> - **Personal preference:** Some people like reducers, others don't. That's okay.
>   It's a matter of preference.

Note that each axis has a cost as well as a benefit — more code upfront, more code
to step through. This is a trade, not an upgrade.

## The recommendation

> We recommend using a reducer **if you often encounter bugs due to incorrect state
> updates in some component, and want to introduce more structure to its code.**

That is a *symptom-driven* rule, and a good one: the trigger is bugs you are
actually hitting, not a state variable count or a complexity score. If the state is
elaborate but nothing goes wrong with it, there is no problem to solve.

## The signals worth acting on

Reading the five axes as things you can notice in a real component:

**Many handlers updating state the same way.** The code-size argument reverses here
— five handlers each doing a three-line spread become five `dispatch` calls and one
reducer.

**Updates that touch several pieces of state together.** Separate `useState` calls
have no single place to enforce a combination, so impossible states become
reachable ([Phase 3 · 10](../phase-3-state/10-structuring-state.md)). A reducer sees
the whole state at once.

**"How did it get into this state?" is hard to answer.** The debugging axis. One
log line in the reducer gives you every transition and its cause.

**The next state depends on the current one in a non-trivial way.** A reducer
receives the current state as an argument by construction; with `useState` you reach
for the updater form and, past a certain complexity, are writing a reducer anyway.

**You want the logic under test without rendering.** The reducer is a pure function
you can import and assert on.

Signals *against*: one or two independent values, updates that are plain
assignments, or a component small enough that the indirection costs more than it
saves.

## Writing reducers well

Two documented tips, and the second is the one that separates good action design
from bad:

> **Reducers must be pure.** Similar to state updater functions, **reducers run
> during rendering!** (Actions are queued until the next render.) … They should not
> send requests, schedule timeouts, or perform any side effects.

*Reducers run during rendering* is the mechanical reason purity is mandatory rather
than stylistic — a reducer is subject to the same rules as the component body
([Phase 2 · Purity](../phase-2-components/02-purity/01-the-two-rules.md)), which is
also why `StrictMode` double-invokes it ([topic 03](03-usereducer.md)).

> **Each action describes a single user interaction, even if that leads to multiple
> changes in the data.** For example, if a user presses "Reset" on a form with five
> fields managed by a reducer, it makes more sense to dispatch **one `reset_form`
> action rather than five separate `set_field` actions.**

And the test for whether you got it right:

> If you log every action in a reducer, **that log should be clear enough for you to
> reconstruct what interactions or responses happened in what order.**

That is the single most useful design rule for actions. An action log that reads
like a list of assignments (`set_name`, `set_email`, `set_name`) tells you nothing;
one that reads like a story (`reset_form`, `submitted`, `server_rejected`) is a
debugging tool. **Name actions after what happened, not after what changed** —
which is [topic 10](10-reducer-patterns.md)'s subject.

## Gotchas

**Symptom:** a reducer was introduced and the component got longer and harder to
read.
**Cause:** the state was simple, so the indirection costs more than it saves.
**Fix:** `useState`. They are equivalent, so converting back is safe.

**Symptom:** the action log reads `set_a`, `set_b`, `set_a` and explains nothing.
**Cause:** actions named after fields rather than interactions.
**Fix:** one action per user interaction, even when it changes five fields.

**Symptom:** a reducer performs a fetch or schedules a timer.
**Cause:** treating it as an event handler. Reducers run **during rendering**.
**Fix:** side effects belong in handlers or effects
([Phase 4 · 06](../phase-4-effects/06-you-might-not-need-an-effect/README.md)).

**Symptom:** five `useState` calls and impossible combinations keep appearing.
**Cause:** no single place enforces which combinations are legal.
**Fix:** a reducer, or restructure the state
([Phase 3 · 10](../phase-3-state/10-structuring-state.md)).

**Symptom:** a debate about whether the codebase should "use reducers".
**Cause:** treating it as an architectural rule rather than a per-component trade.
**Fix:** the docs say to mix and match, and even to use both in one component. The
recommendation is symptom-driven — reach for a reducer where update bugs actually
happen.

## Interview questions

**★ How do you choose between `useState` and `useReducer`?**
They are equivalent and convertible, so it is a readability trade rather than a
correctness one. react.dev's recommendation is symptom-driven: reach for a reducer
when you often hit bugs from incorrect state updates in a component and want more
structure. The practical signals are many handlers updating state the same way,
updates that touch several pieces together, and "how did it get into this state?"
being hard to answer.

**★ What does a reducer give you that `useState` does not?**
A single place where all transitions live, so update logic is separated from the
handlers; a natural debugging hook, since one log in the reducer shows every update
and which action caused it; and a pure function you can export and test in isolation
without rendering. The costs are more code upfront and more code to step through,
which the docs state alongside the benefits.

**★ Why must a reducer be pure, mechanically?**
Because reducers run during rendering — actions are queued until the next render —
so a reducer is bound by the same rules as a component body. Side effects there mean
the component is no longer pure, and `StrictMode` double-invokes reducers precisely
to expose that. Requests and timers belong in handlers or effects.

**What is the rule for designing actions?**
One action per user interaction, even when it changes several fields — a `reset_form`
rather than five `set_field`s. The test the docs give is that a log of every action
should let you reconstruct what interactions happened in what order. Actions named
after fields fail that test; actions named after what happened pass it.

**Is "use reducers everywhere" good advice?**
No. The docs explicitly say to mix and match, and that you can use `useState` and
`useReducer` in the same component. They also list personal preference as a
legitimate axis. Since the two are equivalent, choosing per component based on where
update bugs actually occur is both cheaper and reversible.

---

← Prev: [When a ref is the wrong tool](08-when-a-ref-is-wrong.md) · Index: [Phase 5](README.md) · Next → [Reducer patterns](10-reducer-patterns.md)
