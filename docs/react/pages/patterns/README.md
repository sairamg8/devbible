---
title: "React patterns — choosing a shape"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 and react-dom 19.2.8.** These pages carry **no console
> blocks** — there is no `react-patterns` sandbox. Every claim is validated
> against primary documentation (react.dev, the React 19 release notes, the
> legacy docs for the pre-hooks patterns) and each page's `> Verified:` line
> names the pages it rests on. Nothing is written from memory.

**This section teaches you which shape to reach for. It does not re-teach the
shapes.**

Almost every React pattern worth knowing is already written down in this
reference — but it is filed by *when you learn it*, not by *when you need it*.
Compound components are phase 2 topic 8. Render props are topic 12. The reducer
patterns are phase 5. If you are three months into a project and the question in
your head is *"this component now takes eleven boolean props, what do I do"*,
the phase ordering is no help at all: you have to already know the answer's name
to find the page that gives it.

So this section is a **selection layer**. Every entry states the problem in the
words you would actually use, names the pattern that solves it, says when it is
the wrong answer, and links to the page that teaches it properly. The
implementation stays where it was written. Nothing here is a second copy.

Six patterns turned out to have **no page anywhere in this reference**, and those
are written here rather than linked — they are listed under
[the six new pages](#the-six-new-pages) below.

## Start here — the problem you actually have

Read down the left column until a row sounds like your week.

| The problem, in your words | The pattern | Where it is taught |
|---|---|---|
| "This component has eleven boolean props and I need a twelfth" | **Composition over configuration** — pass elements, not descriptions of elements | [Composition](../phase-2-components/03-composition/README.md) <span className="db-tier t-master">Master</span> |
| "I want the caller to fill in three specific regions" | **Named slots** — elements as props | [Slots, children and the context hole](../phase-2-components/03-composition/02-slots-and-children.md) · [`children`](../phase-1-jsx/09-children.md) <span className="db-tier t-master">Master</span> |
| "`<Tabs>`, `<TabList>`, `<Tab>` — parts that only make sense together" | **Compound components** — shared implicit state through context | [Children patterns § pattern 3](../phase-2-components/08-children-patterns.md) <span className="db-tier t-understand">Understand</span> |
| "Two components need the same *logic*" | **A custom hook** — the default answer since 2018 | [Writing a custom hook](../phase-7-custom-hooks/02-writing-a-custom-hook.md) <span className="db-tier t-master">Master</span> |
| "Two components need the same *state*, not the same logic" | **Lift it up** — a custom hook will not do this, and believing it will is the classic bug | [Share logic, not state](../phase-7-custom-hooks/03-share-logic-not-state/README.md) · [Lifting state up](../phase-2-components/05-lifting-state-up/README.md) <span className="db-tier t-master">Master</span> |
| "I need to hand the caller my state so they can render it their way" | **Render props** — still correct where the *markup* varies per call | [Render props](../phase-2-components/12-render-props.md) <span className="db-tier t-know">Know</span> |
| "I want all the behaviour and none of the markup" | **Headless components** | [01 · Headless components](01-headless-components/README.md) — *new* |
| "My reusable component is almost right, but this one caller needs different behaviour" | **The state reducer pattern** | [02 · The state reducer pattern](02-the-state-reducer-pattern.md) — *new* |
| "This button should sometimes render an `<a>`" | **Polymorphic components / the `as` prop** | [03 · Polymorphic components](03-polymorphic-components.md) — *new* |
| "The caller keeps forgetting to spread the accessibility props" | **Prop getters** | [04 · Prop getters](04-prop-getters.md) — *new* |
| "My `App.jsx` is nine nested `<Provider>` tags" | **Provider composition** | [05 · Provider composition](05-provider-composition.md) — *new* |
| "Should I split this into a smart and a dumb component?" | **Container / presentational** — mostly obsolete, and worth knowing *why* | [06 · Container and presentational](06-container-and-presentational.md) — *new* |
| "Who owns this input's value?" | **Controlled vs uncontrolled** | [Controlled vs uncontrolled](../phase-2-components/04-controlled-vs-uncontrolled/README.md) <span className="db-tier t-master">Master</span> |
| "I am storing something in state that I could compute" | **Derived state** — compute during render, do not sync with an effect | [Derived state](../phase-3-state/06-derived-state.md) <span className="db-tier t-master">Master</span> |
| "I need this component's state to reset when the user changes" | **Reset with `key`** | [Resetting state with `key`](../phase-3-state/07-resetting-state-with-key.md) <span className="db-tier t-master">Master</span> |
| "My `useState` calls are all updating together" | **A reducer** | [Reducer patterns](../phase-5-refs-context-reducers/10-reducer-patterns.md) <span className="db-tier t-understand">Understand</span> |
| "I need app-wide state without a library" | **Context + reducer**, split into state and dispatch | [Context plus reducer](../phase-5-refs-context-reducers/12-context-plus-reducer.md) <span className="db-tier t-understand">Understand</span> |
| "Everything re-renders when my context changes" | **Split the context**, memoize the value | [The context re-render problem](../phase-5-refs-context-reducers/05-context-re-render-problem.md) <span className="db-tier t-master">Master</span> |
| "I need to read from something outside React" | **`useSyncExternalStore`** | [`useSyncExternalStore`](../phase-5-refs-context-reducers/15-usesyncexternalstore.md) <span className="db-tier t-understand">Understand</span> |
| "This file is 400 lines, should I split it?" | **Component boundaries** — split by responsibility, never by length | [Component boundaries](../phase-2-components/10-component-boundaries.md) <span className="db-tier t-understand">Understand</span> |
| "I am maintaining code full of `withRouter(withTheme(...))`" | **Higher-order components** — read them, do not write them | [Higher-order components](../phase-2-components/13-higher-order-components.md) <span className="db-tier t-know">Know</span> |

## The families, and the one question each answers

Patterns cluster into five groups. Knowing which group you are in usually settles
the choice faster than comparing patterns one by one.

### 1 · Getting content into a component

**The question: who decides what renders inside?**

There are exactly four mechanisms, and
[`children`](../phase-1-jsx/09-children.md) enumerates them: `children` itself,
elements as named props, children as a function, and a slot object. Everything in
this family is one of those four wearing a different name.
[Children patterns](../phase-2-components/08-children-patterns.md) then builds
the four shapes people actually ship — wrapper, layout with named regions,
compound components, and children-as-a-function.

The failure mode this family exists to prevent is the **configuration trap**: a
component that grows a boolean prop per variation until nobody can tell which
combinations are legal.
[The configuration trap](../phase-2-components/03-composition/01-the-configuration-trap.md)
is the page on that.

### 2 · Sharing logic between components

**The question: is it the logic that repeats, or the state?**

This is the single most consequential distinction in the whole section, and
getting it wrong produces a bug that looks like React is broken.

- **The logic repeats** → a **custom hook**. Two callers get two independent
  copies of the state. That is the point.
- **The state must be shared** → a hook will not do it. **Lift the state up**, or
  put it in context, or put it in an external store.
  [Share logic, not state](../phase-7-custom-hooks/03-share-logic-not-state/README.md)
  is the page, and it is Master tier for a reason.

**Render props** and **HOCs** are the pre-hooks answers to the same question.
Both still appear in real codebases and both are worth reading; neither is what
you reach for in new code. Render props keep a genuine niche — the three cases
are in [Render props](../phase-2-components/12-render-props.md) — while HOCs
carry three documented caveats, one of which React 19 quietly fixed.

⚠️ The opposite failure is real too:
[Extracting too early](../phase-7-custom-hooks/12-extracting-too-early.md)
<span className="db-tier t-know">Know</span> — a hook with one caller and five
arguments is worse than the code it replaced.

### 3 · Deciding who owns a value

**The question: does this component own its state, or borrow it?**

[Controlled vs uncontrolled](../phase-2-components/04-controlled-vs-uncontrolled/README.md)
is the general form — and the answer is decided, permanently, by whether the
first render sees `undefined`.
[Lifting state up](../phase-2-components/05-lifting-state-up/README.md) is the
procedure for moving ownership, and it has a cost worth reading before you pay
it.

Two more decisions sit here: whether the value should be state at all
([derived state](../phase-3-state/06-derived-state.md) — usually it should not),
and how the state should be shaped
([structuring state](../phase-3-state/10-structuring-state.md)).

### 4 · Holding state that many components read

**The question: how far does this value have to travel?**

One level, use props. A subtree, use context — with
[the re-render problem](../phase-5-refs-context-reducers/05-context-re-render-problem.md)
firmly in mind, because `useContext` has no selector and every consumer re-renders
when the provider's value *identity* changes. Complex transitions, use a
[reducer](../phase-5-refs-context-reducers/10-reducer-patterns.md); both, use
[context + reducer](../phase-5-refs-context-reducers/12-context-plus-reducer.md)
with state and dispatch in **separate** contexts. Outside React entirely,
[`useSyncExternalStore`](../phase-5-refs-context-reducers/15-usesyncexternalstore.md).

Once the provider count grows, the mechanical problem is nesting, and that is
[05 · Provider composition](05-provider-composition.md).

### 5 · Designing a component other people will use

**The question: what does the caller need to be able to change?**

This is the family with the gaps, and it is why the six new pages exist. A
reusable component faces demands the other families never do: a caller who wants
your behaviour with their markup (**headless**), a caller who wants your defaults
with one rule changed (**the state reducer pattern**), a caller who wants your
component to render a different element (**polymorphic**), and a caller who will
forget half your accessibility contract unless you hand it to them in one object
(**prop getters**).

[Designing a hook's API](../phase-7-custom-hooks/06-designing-a-hooks-api/README.md)
is the hook-shaped version of the same question, and
[the standard set](../phase-7-custom-hooks/07-the-standard-set/README.md) is what
the ecosystem converged on.

## The six new pages

These six were absent from this reference — not thin, **absent**. They are
written here because there was nowhere to link to.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Headless components](01-headless-components/README.md)** | <span className="db-tier t-master">Master</span> | All the behaviour, none of the markup — **6 chunks**: the APG contract quoted in full, then a listbox built against it |
| 02 | **[The state reducer pattern](02-the-state-reducer-pattern.md)** | <span className="db-tier t-know">Know</span> | Let the caller intercept your state transitions instead of adding a prop per exception |
| 03 | **[Polymorphic components](03-polymorphic-components.md)** | <span className="db-tier t-know">Know</span> | The `as` prop, and why a link that renders a `<div>` is a bug, not a style choice |
| 04 | **[Prop getters](04-prop-getters.md)** | <span className="db-tier t-know">Know</span> | One object the caller spreads, so they cannot forget the ARIA attributes |
| 05 | **[Provider composition](05-provider-composition.md)** | <span className="db-tier t-understand">Understand</span> | Nine nested providers, and the two ways out — one cosmetic, one real |
| 06 | **[Container and presentational](06-container-and-presentational.md)** | <span className="db-tier t-know">Know</span> | The pattern hooks retired, why its author withdrew it, and what survived |

## Patterns this reference deliberately says no to

Not every named pattern is a good idea, and three come up often enough to state
plainly:

- **Syncing state with an effect.** Copying a prop into state inside a
  `useEffect` costs an extra render and shows wrong UI in between. Compute during
  render instead — [derived state](../phase-3-state/06-derived-state.md).
- **Splitting a component because the file got long.** Length is not a
  responsibility. [Component boundaries](../phase-2-components/10-component-boundaries.md)
  gives five reasons that justify a split and three that do not.
- **A container/presentational split by default.** Its own author withdrew the
  recommendation after hooks — [06](06-container-and-presentational.md) carries
  the quote.

## Where this connects

- **→ Phase 2** is the home of most of what this section indexes: composition,
  controlled/uncontrolled, lifting state, children patterns, render props, HOCs.
- **→ Phase 5** owns everything about context and reducers, including the
  re-render problem that decides how you shape a provider.
- **→ Phase 7** owns custom hooks, which are the modern answer to the
  logic-sharing question this section keeps returning to.
- **→ Phase 6** matters the moment a pattern costs renders — `memo`, the
  Compiler, and why memoizing a context value is not optional.
- **→ Frontend architecture** covers the same ground from a system perspective in
  [Component Architecture](../../../frontend-architecture/pages/02-component-architecture/01-composition-patterns.md).
  ⚠️ That page belongs to the imported frontend-toolchain corpus — it carries no
  tier badge and no `> Verified:` line, and it has not been validated to this
  reference's standard. Read it as a second opinion, not as a source.

## How these pages were verified

No sandbox. Under the standing rule from 2026-08-13, new work is validated
against official documentation rather than measured, so each page names its
sources in a `> Verified:` line. Where the documentation does not settle a
question — and for several of these patterns it genuinely does not, because they
are community conventions rather than React APIs — the page says so in those
words rather than asserting a fact.
