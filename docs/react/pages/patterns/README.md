---
title: "React patterns — choosing a shape"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 and react-dom 19.2.8.** These pages carry **no console
> blocks** — there is no `react-patterns` sandbox. Every claim is validated
> against primary documentation (react.dev, the React 19 release notes, the W3C
> ARIA Authoring Practices Guide, the legacy docs for the pre-hooks patterns) and
> each page's `> Verified:` line names the sources it rests on.

**Ten patterns, and where each one is taught to depth.**

Most of these were already written in this reference — but filed by *when you
learn them*, not by *when you need them*. Compound components were a section of
phase 2 topic 8. Render props are topic 12. If the question in your head is
*"this component now takes eleven boolean props, what do I do"*, the phase
ordering is no help: you have to already know the answer's name to find it.

This section is the index by problem, and the home for the patterns that had no
adequate one.

## The ten

| # | Pattern | Tier | Where the depth is | In one line |
|---|---|---|---|---|
| 1 | **Composition** | <span className="db-tier t-master">Master</span> | [phase 2 · 03](../phase-2-components/03-composition/README.md) | Pass the `<Button>`, not three props describing one |
| 2 | **Custom hooks** | <span className="db-tier t-master">Master</span> | [phase 7](../phase-7-custom-hooks/README.md) | The default way to share logic — and it shares logic, never state |
| 3 | **Compound components** | <span className="db-tier t-master">Master</span> | **[03 · here](03-compound-components/README.md)** | Parts that only make sense together, coordinating through context |
| 4 | **Context + Provider** | <span className="db-tier t-master">Master</span> | [phase 5 · 04](../phase-5-refs-context-reducers/04-createcontext-usecontext.md) · [05](../phase-5-refs-context-reducers/05-context-re-render-problem.md) · [12](../phase-5-refs-context-reducers/12-context-plus-reducer.md) | Values that skip the prop chain — and the re-render bill |
| 5 | **Controlled components** | <span className="db-tier t-master">Master</span> | [phase 2 · 04](../phase-2-components/04-controlled-vs-uncontrolled/README.md) | Who owns the value, and why `undefined` decides it permanently |
| 6 | **Headless components** | <span className="db-tier t-master">Master</span> | **[06 · here](06-headless-components/README.md)** | All the behaviour, none of the markup — justified by accessibility, not reuse |
| 7 | **Render props** | <span className="db-tier t-know">Know</span> | [phase 2 · 12](../phase-2-components/12-render-props/README.md) | **3 chunks** — the five cases hooks cannot cover, and the RSC boundary a function prop cannot cross |
| 8 | **State reducer** | <span className="db-tier t-understand">Understand</span> | **[08 · here](08-state-reducer/README.md)** | Let the caller intercept a transition instead of adding a prop per exception |
| 9 | **Container / presentational** | <span className="db-tier t-know">Know</span> | **[09 · here](09-container-presentational/README.md)** | **2 chunks** — the pattern hooks retired, and the one RSC brought back with a compiler behind it |
| 10 | **Higher-order components** | <span className="db-tier t-know">Know</span> | [phase 2 · 13](../phase-2-components/13-higher-order-components/README.md) | **3 chunks** — three caveats, invisible composition order, typing, and how to retire one |

**Four of the ten live here** because they had no adequate home: compound
components was a 66-line section, headless and the state reducer did not exist at
all, and container/presentational belongs with the patterns rather than in a
phase. The other six are taught in the phase that introduces them, and this table
is the way in.

## Supporting techniques

Not peers of the ten — machinery the ten are built from, most often
[compound components](03-compound-components/README.md) and
[headless](06-headless-components/README.md).

| Technique | Tier | What it is for |
|---|---|---|
| **[Polymorphic components](supporting/polymorphic-components.md)** | <span className="db-tier t-know">Know</span> | The `as` prop — because a "button" that navigates must really be an `<a>` |
| **[Prop getters](supporting/prop-getters.md)** | <span className="db-tier t-know">Know</span> | One object the caller spreads, merging their handlers instead of losing them |
| **[Provider composition](supporting/provider-composition.md)** | <span className="db-tier t-understand">Understand</span> | Nine nested providers — one fix is cosmetic, one is real |

## Start here — the problem you actually have

| The problem, in your words | Reach for | Where |
|---|---|---|
| "Eleven boolean props and I need a twelfth" | **Composition** | [phase 2 · 03](../phase-2-components/03-composition/README.md) |
| "The caller should fill in three specific regions" | **Named slots** | [slots and children](../phase-2-components/03-composition/02-slots-and-children.md) |
| "`<Tabs>`, `<TabList>`, `<Tab>` — parts that only work together" | **Compound components** | [03](03-compound-components/README.md) |
| "Two components need the same *logic*" | **A custom hook** | [phase 7 · 02](../phase-7-custom-hooks/02-writing-a-custom-hook.md) |
| "Two components need the same *state*" | **Lift it** — a hook will not do this | [phase 7 · 03](../phase-7-custom-hooks/03-share-logic-not-state/README.md) |
| "All the behaviour, my own markup" | **Headless** | [06](06-headless-components/README.md) |
| "Hand the caller my state so they render it their way" | **Render props** | [phase 2 · 12](../phase-2-components/12-render-props/README.md) |
| "Almost right, but this one caller needs different behaviour" | **State reducer** | [08](08-state-reducer/README.md) |
| "Who owns this input's value?" | **Controlled vs uncontrolled** | [phase 2 · 04](../phase-2-components/04-controlled-vs-uncontrolled/README.md) |
| "This value needs to skip six levels of props" | **Context** | [phase 5 · 04](../phase-5-refs-context-reducers/04-createcontext-usecontext.md) |
| "Everything re-renders when my context changes" | **Split the context** | [phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md) |
| "`App.jsx` is nine nested providers" | **Provider composition** | [supporting](supporting/provider-composition.md) |
| "This button should sometimes be an `<a>`" | **Polymorphic** | [supporting](supporting/polymorphic-components.md) |
| "Callers keep forgetting to spread the ARIA props" | **Prop getters** | [supporting](supporting/prop-getters.md) |
| "Storing something in state I could compute" | **Derived state** | [phase 3 · 06](../phase-3-state/06-derived-state.md) |
| "This state should reset when the user changes" | **Reset with `key`** | [phase 3 · 07](../phase-3-state/07-resetting-state-with-key.md) |
| "My `useState` calls all update together" | **A reducer** | [phase 5 · 10](../phase-5-refs-context-reducers/10-reducer-patterns.md) |
| "App-wide state without a library" | **Context + reducer** | [phase 5 · 12](../phase-5-refs-context-reducers/12-context-plus-reducer.md) |
| "Read from something outside React" | **`useSyncExternalStore`** | [phase 5 · 15](../phase-5-refs-context-reducers/15-usesyncexternalstore.md) |
| "This file is 400 lines, should I split it?" | **Component boundaries** | [phase 2 · 10](../phase-2-components/10-component-boundaries.md) |
| "Maintaining `withRouter(withTheme(...))`" | **HOCs** — read them, do not write them | [phase 2 · 13](../phase-2-components/13-higher-order-components/README.md) |
| "Should I split this into smart and dumb?" | Probably not — **container/presentational** | [09](09-container-presentational/README.md) |

## The one distinction that matters most

**Is it the logic that repeats, or the state?**

- **The logic repeats** → a **custom hook**. Two callers get two independent
  copies of the state. That is the point, not a limitation.
- **The state must be shared** → a hook will not do it. Lift it, put it in
  context, or put it in an external store.

Getting this wrong produces a bug that looks like React is broken, and
[share logic, not state](../phase-7-custom-hooks/03-share-logic-not-state/README.md)
is Master tier for exactly that reason.

## Patterns this reference says no to

- **Syncing state with an effect.** Copying a prop into state inside `useEffect`
  costs an extra render and shows wrong UI in between — compute during render
  instead ([derived state](../phase-3-state/06-derived-state.md)).
- **Splitting a component because the file got long.** Length is not a
  responsibility ([component boundaries](../phase-2-components/10-component-boundaries.md)).
- **A container/presentational split by default.** Its author withdrew the
  recommendation in 2019 — [09](09-container-presentational/README.md) carries the quote.
- **`cloneElement` to wire up compound parts.** It only reaches direct children
  and fails silently ([03 · 02](03-compound-components/02-why-context.md)).

## Where this connects

- **→ Phase 2** is the home of composition, controlled/uncontrolled, children
  patterns, render props and HOCs.
- **→ Phase 5** owns context and reducers, including the re-render problem that
  decides how you shape a provider.
- **→ Phase 7** owns custom hooks — the modern answer to the logic-sharing
  question this section keeps returning to.
- **→ Phase 6** matters the moment a pattern costs renders — `memo`, the
  Compiler, and why a context value's identity is not optional.
- **→ Phase 10** is where compound components and providers meet the
  client/server boundary.
- **→ Frontend architecture** covers similar ground from a system perspective in
  [Component Architecture](../../../frontend-architecture/pages/02-component-architecture/01-composition-patterns.md).
  ⚠️ That page is imported corpus — no tier badge, no `> Verified:` line, not
  validated to this reference's standard. A second opinion, not a source.
