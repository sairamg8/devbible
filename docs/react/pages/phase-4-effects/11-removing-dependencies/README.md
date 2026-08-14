---
title: "Removing dependencies legitimately"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies).
> No sandbox script backs this topic; claims are cited, not measured.

[Topic 03](../03-the-dependency-array.md) established that you cannot choose your
dependencies. This topic is the other half: **the complete set of things you can
change so that the dependency you did not want stops being one.**

> **Dependencies should match the code.**

> You can't "choose" the dependencies of your Effect. Every reactive value used
> by your Effect's code must be declared in your dependency list. **The dependency
> list is determined by the surrounding code.**

Which produces the operating rule for the whole topic:

> To remove a dependency, **"prove" to the linter that it *doesn't need* to be a
> dependency.**

And the sentence that tells you where to point your effort:

> When you're not happy with your dependencies, **what you need to edit is the
> code.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Objects and functions](01-objects-and-functions.md)** | Why they re-trigger every render, and the four ways to stop depending on them |
| 02 | **[Restructuring the effect](02-restructuring-the-effect.md)** | The updater form, Effect Events, moving to a handler, splitting one effect into several |
| 03 | **[The illegitimate fixes](03-the-illegitimate-fixes.md)** | Suppressing the linter, the counter that always shows 1, and refs used to hide a dependency |

## The eight moves at a glance

| Move | Use when | Chunk |
|---|---|---|
| Move the object/function **outside the component** | it is static — no props or state involved | [01](01-objects-and-functions.md) |
| Move it **inside the effect** | it is built from reactive values | [01](01-objects-and-functions.md) |
| Depend on **primitives read from the object** | the object is a prop you do not control | [01](01-objects-and-functions.md) |
| **Call the function during render** and depend on its primitives | a function prop returns the config | [01](01-objects-and-functions.md) |
| Use the **updater form** | the effect only needs the previous state | [02](02-restructuring-the-effect.md) |
| Extract a **`useEffectEvent`** | the value should be read, not reacted to | [02](02-restructuring-the-effect.md) |
| Move the code to an **event handler** | an interaction caused it | [02](02-restructuring-the-effect.md) |
| **Split into several effects** | the parts re-run for different reasons | [02](02-restructuring-the-effect.md) |

Eight options before any of them is exhausted, which is what makes react.dev's
position defensible: *"There's always a better solution than ignoring the
linter!"*

## The recap, verbatim

> - **Dependencies should always match the code.**
> - **When you're not happy with your dependencies, what you need to edit is the
>   code.**
> - **Suppressing the linter leads to very confusing bugs, and you should always
>   avoid it.**
> - To remove a dependency, you need to "prove" to the linter that it's not
>   necessary.
> - If some code should run in response to a specific interaction, move that code
>   to an event handler.
> - If different parts of your Effect should re-run for different reasons, split
>   it into several Effects.
> - If you want to update some state based on the previous state, pass an updater
>   function.
> - If you want to read the latest value without "reacting" to it, extract an
>   Effect Event from your Effect.
> - **In JavaScript, objects and functions are considered different if they were
>   created at different times.**
> - Try to avoid object and function dependencies. Move them outside the component
>   or inside the Effect.

## Where this connects

- **← [The dependency array is not a preference](../03-the-dependency-array.md)** —
  why the array is not negotiable in the first place.
- **← [An effect has its own lifecycle](../09-effect-lifecycle.md)** — the
  splitting rule and what makes a value reactive.
- **← [`useEffectEvent`](../10-useeffectevent.md)** — one of the eight moves, in
  full.
- **← [You might not need an effect](../06-you-might-not-need-an-effect/README.md)** —
  moving code to an event handler, in full.
- **→ Phase 6** — `useMemo` and `useCallback` are the *other* answer to unstable
  identities, and why the React Compiler changes the calculation.

---

← Index: [Phase 4](../README.md) · Start → [Objects and functions](01-objects-and-functions.md)
