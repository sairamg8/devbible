---
title: "An effect has its own lifecycle"
sidebar_label: "09 · An effect has its own lifecycle"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects).
> No sandbox script backs this page; claims are cited, not measured.

**Components mount, update and unmount. Effects do neither of those things — they
start synchronizing and later stop. Holding the two apart is what makes every
other rule in the phase feel obvious rather than arbitrary.**

## Two lifecycles, not one

> Components may mount, update, or unmount. **An Effect can only do two things: to
> start synchronizing something, and later to stop synchronizing it.**

And directly on the mental model most people bring:

> It's a good way to think about components, but *not* about Effects. Instead, try
> to think about each Effect independently from your component's lifecycle.

The two are not even in step:

> Sometimes, it may also be necessary to **start and stop synchronizing multiple
> times** while the component remains mounted.

One mount, many start/stop cycles. That is the sentence that makes
[topic 04](04-cleanup/01-the-cleanup-contract.md)'s "cleanup is not unmount code"
follow rather than have to be memorised — cleanup is the *stop* of a cycle, and a
component's lifetime may contain any number of them.

## The rule: one cycle at a time

> Instead, always focus on a single start/stop cycle at a time. **It shouldn't
> matter whether a component is mounting, updating, or unmounting.** All you need
> to do is to describe how to start synchronization and how to stop it. If you do
> it well, your Effect will be resilient to being started and stopped as many
> times as it's needed.

This is a genuinely different way to read effect code, and it is worth practising
deliberately. Reading an effect **as a component author** you ask *"when does this
run?"* and end up reasoning about mounts, orders and edge cases. Reading it **as
an effect author** you ask only two questions:

1. What does *start* mean here?
2. What does *stop* mean here?

If both have clean answers, the effect is correct and you never have to think
about mounting at all. If "stop" has no clean answer, that is the bug — and it is
the same bug whether it shows up at unmount, on a dependency change, or under
`StrictMode`.

## Why React can afford to test it so aggressively

> React verifies that your Effect can re-synchronize by forcing it to do that
> immediately in development. This might remind you of **opening a door and
> closing it an extra time to check if the door lock works.** React starts and
> stops your Effect one extra time in development to check you've implemented its
> cleanup well.

The analogy is precise: the extra cycle is not simulating an unlikely user
journey, it is testing the *lock* — the property that start and stop are a
matched pair. [Topic 05](05-strictmode-double-invocation.md) covers what that
check does and does not reach.

## How React decides to re-synchronize

No inference is involved:

> It's because *you told React* that its code depends on `roomId` by including it
> in the list of dependencies.

> Every time after your component re-renders, React will look at the array of
> dependencies that you have passed. If any of the values in the array is
> different from the value at the same spot that you passed during the previous
> render, React will re-synchronize your Effect.

*At the same spot* — positional comparison, which is why the array must be a
constant-size literal ([topic 02](02-useeffect-anatomy.md)). And "you told React"
is the whole reason lying in the array is not a stylistic choice
([topic 03](03-the-dependency-array.md)): the array is not a hint, it is the
input to this decision.

## One effect per synchronization process

The lifecycle framing gives the splitting rule its actual justification:

> **Each Effect in your code should represent a separate and independent
> synchronization process.**

> Resist adding unrelated logic to your Effect only because this logic needs to
> run at the same time as an Effect you already wrote.

react.dev's example is a connection and a visit log in one effect. They happen to
start at the same moment, which is the trap — *"Logging the visit **is a separate
process** from connecting. Write them as two separate Effects."*

The cost of merging is concrete. One effect has one dependency array: the union of
both processes' dependencies. So the connection tears down and rebuilds whenever
the analytics-relevant value changes, for no reason at all. **Split by what is
being synchronized, not by when the code happens to run** — the same conclusion
[topic 02](02-useeffect-anatomy.md) reaches from the anatomy, arrived at here from
the lifecycle.

The test: *if I described this effect out loud, would I need the word "and"?*

## What counts as reactive

The lifecycle only re-synchronizes on **reactive** values:

> Props, state, and other values declared inside the component are *reactive*
> because they're calculated during rendering and participate in the React data
> flow.

> All values inside the component (including props, state, and variables in your
> component's body) are reactive.

And the two categories that are not, both for the same underlying reason:

> A mutable value like `location.pathname` **can't** be a dependency. It's
> mutable, so it can change at any time completely outside of the React rendering
> data flow.

> A mutable value like `ref.current` or things you read from it also can't be a
> dependency.

> The `serverUrl` never changes due to a re-render. It's always the same no matter
> how many times the component re-renders and why.

So the two exclusions are **mutable-outside-React** (which cannot be compared
meaningfully between renders) and **module-scope constants** (which never differ
between renders). [Topic 03](03-the-dependency-array.md) has the working list;
what this page adds is *why* — a dependency array is a record of what a render
produced, so a value that does not come from rendering has no place in it.

## The recap

> - Each Effect has a separate lifecycle from the surrounding component.
> - Each Effect describes a separate synchronization process that can *start* and
>   *stop*.
> - When you write and read Effects, think from each individual Effect's
>   perspective (how to start and stop synchronization) rather than from the
>   component's perspective (how it mounts, updates, or unmounts).
> - Values declared inside the component body are "reactive".
> - **All errors flagged by the linter are legitimate. There's always a way to fix
>   the code to not break the rules.**

That last line is the phase's position in one sentence, and
[topic 11](11-removing-dependencies.md) is the catalogue of legitimate fixes.

## Gotchas

**Symptom:** an effect is written around "has it mounted yet?" — a ref, a flag, a
first-render check.
**Cause:** reasoning from the component's lifecycle instead of the effect's.
**Fix:** answer the two questions — what does start mean, what does stop mean. A
correct answer makes mounting irrelevant.

**Symptom:** a WebSocket reconnects whenever an unrelated prop changes.
**Cause:** two synchronization processes merged into one effect, so its
dependency array is the union of both.
**Fix:** split them. Two processes, two effects, two dependency arrays.

**Symptom:** an effect is described in review as doing "X and Y".
**Cause:** the word "and" — two processes that merely start at the same time.
**Fix:** split before the dependency arrays force you to.

**Symptom:** `location.pathname` is in a dependency array and the effect does not
re-run when the URL changes.
**Cause:** it is mutable and lives outside React's data flow, so it is not a
reactive value and React has nothing to compare between renders.
**Fix:** get the value from the router as a prop or state — something that
participates in rendering.

**Symptom:** `ref.current` in a dependency array, and the effect either never
re-runs or re-runs unpredictably.
**Cause:** same reason — a ref is mutable and deliberately outside the render
data flow.
**Fix:** if the effect must react to a DOM node appearing, that is a ref callback
([topic 15](15-effects-and-refs.md)), not a dependency.

**Symptom:** the effect works at mount and misbehaves the second time it starts.
**Cause:** it was written for one cycle rather than for arbitrarily many.
**Fix:** the resilience property — an effect done well survives being started and
stopped as many times as needed. Test by changing a dependency, not just by
reloading.

## Interview questions

**★ How does an effect's lifecycle differ from a component's?**
A component mounts, updates and unmounts. An effect only ever does two things:
start synchronizing and stop synchronizing. They are not in step — a single mount
can contain many start/stop cycles, because every dependency change is a stop
followed by a start. Reasoning about effects in terms of mounting is what produces
the `componentDidMount` mistakes; reasoning in terms of start and stop makes the
rules fall out.

**★ What two questions should you ask about any effect?**
What does *start* mean here, and what does *stop* mean here. react.dev's framing
is that it should not matter whether the component is mounting, updating or
unmounting — if start and stop are described well, the effect is resilient to
being started and stopped as many times as needed. A missing or unclear answer to
"stop" is the bug, regardless of which situation reveals it.

**★ Why should each effect be a separate synchronization process?**
Because one effect has one dependency array, and merging two processes makes that
array the union of both — so each process tears down and restarts for the other's
reasons. react.dev's example merges a chat connection with a visit log: they start
at the same moment but are unrelated, and the connection ends up rebuilding
whenever the logging-relevant value changes. Split by what is synchronized, not by
when the code runs.

**What makes a value reactive, and what are the two exceptions?**
Anything declared inside the component — props, state, and values calculated from
them — is reactive, because it is produced by rendering and participates in
React's data flow. Two kinds are not: values mutable outside React, such as
`location.pathname` or `ref.current`, which can change at any time with nothing
meaningful to compare between renders; and values declared outside the component,
which never differ between renders at all.

**What is the door-lock analogy about?**
`StrictMode`'s extra setup/cleanup cycle. react.dev compares it to opening a door
and closing it an extra time to check the lock works — React starts and stops the
effect once more in development to verify that the cleanup really is the inverse
of the setup. It is testing the pairing, not simulating a rare user journey.

**What does react.dev say about linter errors on dependencies?**
That all of them are legitimate, and there is always a way to fix the code without
breaking the rules. The array is not a hint — it is the input React uses to decide
whether to re-synchronize, so a disagreement with the linter means the code needs
restructuring, not that the warning needs silencing.

---

← Prev: [Race conditions](08-race-conditions.md) · Index: [Phase 4](README.md) · Next → [`useEffectEvent`](10-useeffectevent.md)
