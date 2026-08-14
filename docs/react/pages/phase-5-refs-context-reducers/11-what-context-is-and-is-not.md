---
title: "What context is and is not"
sidebar_label: "11 · What context is and is not"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
> (§ Before you use context, § Use cases for context) and
> [`useContext`](https://react.dev/reference/react/useContext).
> No sandbox script backs this page; claims are cited, not measured.

**Context is dependency injection scoped to a subtree. It is not a state manager,
it does not make data global, and it does not prevent re-renders — and the docs
open the subject by telling you to try two other things first.**

## The warning comes before the API

> Context is very tempting to use! However, this also means it's **too easy to
> overuse it. Just because you need to pass some props several levels deep doesn't
> mean you should put that information into context.**

Two documented alternatives, in order:

> **Start by passing props.** If your components are not trivial, it's not unusual
> to pass a dozen props down through a dozen components. It may feel like a slog,
> but **it makes it very clear which components use which data!** The person
> maintaining your code will be glad you've made the data flow **explicit** with
> props.

The argument is legibility, not performance. Props are a readable record of what
depends on what; context deliberately hides that, which is the same trade
[Phase 4 · 06 · 03](../phase-4-effects/06-you-might-not-need-an-effect/03-state-that-belongs-elsewhere.md)
makes about one-directional data flow — you can trace a wrong value by walking up
the tree only while the path is visible.

> **Extract components and pass JSX as `children` to them.** If you pass some data
> through many layers of intermediate components that don't use that data (and only
> pass it further down), this often means that **you forgot to extract some
> components along the way.** … Instead, make `Layout` take `children` as a prop,
> and render `<Layout><Posts posts={posts} /></Layout>`. **This reduces the number
> of layers between the component specifying the data and the one that needs it.**

This is the one people skip, and it is often the real fix. Prop drilling is
frequently a *composition* problem wearing a data-flow costume: the layers exist
because a component renders its own children instead of accepting them
([Phase 2](../phase-2-components/README.md)). Restructure and the distance
disappears — no context needed.

> If neither of these approaches works well for you, **consider context.**

## The documented use cases

> - **Theming** … put a context provider at the top of your app, and use that
>   context in components that need to adjust their visual look.
> - **Current account:** Many components might need to know the currently logged in
>   user. … Some apps also let you operate multiple accounts at the same time … it
>   can be convenient to wrap a part of the UI into a **nested provider** with a
>   different current account value.
> - **Routing:** Most routing solutions **use context internally** to hold the
>   current route. This is how every link "knows" whether it's active or not.
> - **Managing state:** … It is common to use a reducer together with context to
>   manage complex state and pass it down to distant components.

What these share is the shape context is actually for: **something a subtree is
*ambient* in.** A component does not receive its theme; it is *in* a theme. That is
why the nested-provider note under "current account" matters — it is not an edge
case, it is the demonstration that context is scoped rather than global.

And the summary test:

> In general, **if some information is needed by distant components in different
> parts of the tree**, it's a good indication that context will help you.

*Different parts of the tree* — not merely "far away". Data needed by one deep
branch is a composition problem; data needed by unrelated branches is context.

## What it is not

**Not global.** A context value belongs to a provider, and the nearest one above
wins. Two providers give two values in two subtrees at the same time. Anything that
is genuinely global — a module-level constant, a singleton client — does not need
context at all.

**Not storage.** The context object holds nothing
([topic 04](04-createcontext-usecontext.md)). State lives in a component above the
provider; context only delivers it. *"Context is not limited to static values. If
you pass a different value on the next render, React will update all the components
reading it below"* — the state does that work.

**Not a re-render optimisation.** It is the opposite: every consumer re-renders when
the value's identity changes, with no selector to narrow it
([topic 05](05-context-re-render-problem.md)). Moving a prop into context to "avoid
re-renders" usually adds them.

**Not a state manager.** This is where it is most often over-claimed, so it is worth
being precise about what is actually missing:

| | Context + `useReducer` | A state library |
|---|---|---|
| Deliver state to a subtree | ✅ | ✅ |
| Transitions in one place | ✅ (the reducer) | ✅ |
| **Subscribe to part of the state** | ❌ no selector | ✅ |
| Middleware, devtools, persistence | ❌ build it | usually included |
| Store outside the React tree | ❌ | ✅ |

The decisive row is the third. `useContext` takes one argument, so a consumer
subscribes to the whole value — and that is the property libraries exist to
provide. Context plus a reducer is a genuine and often sufficient answer
([topic 12](12-context-plus-reducer.md)); it stops being sufficient when you find
yourself splitting contexts to simulate selectors.

## Context makes reuse harder

The cost that does not show up until later: a component that reads context can only
be rendered inside a matching provider. That is fine for a themed button and
awkward for something you intended to publish, test in isolation, or reuse in a
different tree.

Two mitigations, both cheap:

- **Take the value as a prop with a context-reading wrapper above it.** The inner
  component stays portable and testable; the wrapper does the context read.
- **Make the missing provider loud**, so the failure is a clear error rather than
  a silent default ([topic 13](13-default-context-value.md)).

## Gotchas

**Symptom:** context introduced to stop passing a prop through four layers.
**Cause:** prop drilling treated as the problem rather than a symptom.
**Fix:** try `children` first — those layers usually exist because a component
renders its own children instead of accepting them.

**Symptom:** a component cannot be rendered in a test or a story.
**Cause:** it reads context, so it needs a provider.
**Fix:** a wrapper does the context read and passes a plain prop to a portable
inner component.

**Symptom:** moving data into context made the app re-render more.
**Cause:** context is not a re-render optimisation; every consumer re-renders on a
value identity change.
**Fix:** [topic 05](05-context-re-render-problem.md), or leave it as a prop.

**Symptom:** contexts are being split further and further to stop unrelated
re-renders.
**Cause:** simulating selectors, which context does not have.
**Fix:** that is the signal a state library is warranted.

**Symptom:** a singleton — an API client, a config object — is put in context "for
consistency".
**Cause:** treating context as the way to share anything.
**Fix:** if it never varies by subtree, a module import is simpler and needs no
provider.

**Symptom:** nobody can tell where a value comes from.
**Cause:** the explicitness that props gave up.
**Fix:** accepted deliberately for genuinely ambient data; not worth it for one
branch of the tree.

## Interview questions

**★ What should you try before reaching for context?**
The two things the docs list, in order: pass props, and extract components passing
JSX as `children`. The second is the one people skip and often the real fix — layers
that only forward data usually exist because a component renders its own children
instead of accepting them, so restructuring removes the distance entirely. Context
is what you reach for when neither works.

**★ Is context a state manager?**
No. It delivers a value to a subtree; it stores nothing, and state still lives in a
component above the provider. The decisive difference from a state library is that
there is no selector — `useContext` takes only the context, so a consumer subscribes
to the whole value and re-renders on any change to it. Context plus a reducer is
often sufficient, and the signal that it has stopped being sufficient is splitting
contexts to simulate selectors.

**★ What are the documented use cases, and what do they have in common?**
Theming, the current account, routing, and managing state with a reducer. What they
share is being *ambient* to a subtree — a component is *in* a theme rather than
receiving one. The current-account case includes nested providers with different
values for different parts of the UI, which shows context is scoped rather than
global.

**Does context make data global?**
No — the nearest provider above a consumer wins, so two providers can supply two
different values to two subtrees simultaneously. Anything genuinely global, like a
module-level constant or a singleton client, does not need context at all; a plain
import is simpler and needs no provider.

**What does context cost?**
Explicitness and reusability. Props make it visible which components use which data,
which is the argument the docs lead with; context deliberately hides that. And a
component that reads context can only render inside a matching provider, which makes
it harder to test in isolation or reuse elsewhere. Both are worth paying for
genuinely ambient data and rarely worth it for one branch of the tree.

---

← Prev: [Reducer patterns](10-reducer-patterns.md) · Index: [Phase 5](README.md) · Next → [Context plus reducer](12-context-plus-reducer.md)
