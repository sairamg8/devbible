---
title: "Phase 2 — Components, props and composition"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 and react-dom 19.2.8.** Unlike Phases 0 and 1, **these
> pages carry no console blocks** — there is no `react-p2` sandbox. Every claim
> is validated against primary documentation (react.dev, the React 19 release
> notes and upgrade guide, the legacy docs for the pre-hooks patterns) and each
> page's `> Verified:` line names the pages it rests on. Nothing is written from
> memory, and nothing that documentation could not settle is stated as fact.

Components are functions with rules. This phase is where the rules come from —
who calls the function, what it may do while running, who owns its values — and
how to arrange components so the later phases stay easy.

The load-bearing pages are **01**, **02**, **03** and **05**. Topics 12–16 are
the pre-hooks era: read them to *read code*, not to write it.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[Function components](01-function-components/README.md)** | <span className="db-tier t-master">Master</span> | React calls it, not you — and a new function object per render destroys the subtree |
| 02 | **[Purity](02-purity/README.md)** | <span className="db-tier t-master">Master</span> | Same inputs, same output; no writes to anything that existed before |
| 03 | **[Composition over configuration](03-composition/README.md)** | <span className="db-tier t-master">Master</span> | Pass the `<Button>`, not three props describing one |
| 04 | **[Controlled vs uncontrolled](04-controlled-vs-uncontrolled/README.md)** | <span className="db-tier t-master">Master</span> | Who owns the value, and why `undefined` decides it forever |
| 05 | **[Lifting state up](05-lifting-state-up/README.md)** | <span className="db-tier t-master">Master</span> | Remove, hardcode, add state — and the re-render that moves with it |
| 06 | **[Props are read-only](06-props-are-read-only.md)** | <span className="db-tier t-understand">Understand</span> | Immutable by contract, not by enforcement — which is the problem |
| 07 | **[Destructuring and default values](07-destructuring-and-defaults.md)** | <span className="db-tier t-understand">Understand</span> | `defaultProps` gone, `propTypes` gone *silently* |
| 08 | **[Children patterns](08-children-patterns.md)** | <span className="db-tier t-understand">Understand</span> | Wrapper, layout, compound, function-as-children |
| 09 | **[`ref` as a prop](09-ref-as-a-prop.md)** | <span className="db-tier t-understand">Understand</span> | React 19 made `ref` ordinary and retired `forwardRef` |
| 10 | **[Component boundaries](10-component-boundaries.md)** | <span className="db-tier t-understand">Understand</span> | Split by responsibility, never by length; colocate |
| 11 | **[Portals](11-portals.md)** | <span className="db-tier t-understand">Understand</span> | Moves the DOM node, keeps the React tree — including events |
| 12 | **[Render props](12-render-props.md)** | <span className="db-tier t-know">Know</span> | Wrapper hell, and the three cases hooks still cannot cover |
| 13 | **[Higher-order components](13-higher-order-components.md)** | <span className="db-tier t-know">Know</span> | Three caveats, one of them quietly fixed by React 19 |
| 14 | **[Class components](14-class-components/README.md)** | <span className="db-tier t-know">Know</span> | `setState` merges; two lifecycle methods have no hook |
| 15 | **[`Component` vs `PureComponent`](15-purecomponent.md)** | <span className="db-tier t-know">Know</span> | The class ancestry of `memo`, caveats intact |
| 16 | **[Element manipulation](16-element-manipulation.md)** | <span className="db-tier t-know">Know</span> | React's own docs call these fragile, and say why |

## Coverage

The syllabus lists **16 topics** for this phase and they become **16 pages**,
one for one. Six run past the 300-line file cap and become topic directories —
the content was not reduced to fit:

| Topic | Chunks | Split at |
|---|---|---|
| 01 Function components | 2 | definition ↔ identity and reconciliation |
| 02 Purity | **3** | the rules ↔ what they still allow ↔ enforcement |
| 03 Composition | 2 | the problem ↔ the three concrete patterns |
| 04 Controlled vs uncontrolled | 2 | design ↔ the switch warning and dual-mode |
| 05 Lifting state up | 2 | procedure ↔ cost |
| 14 Class components | 2 | anatomy and `this` ↔ lifecycle and hooks |

**29 content files, 16 topics.** Longest file 288 lines; nothing over 300.

## How these pages were verified

No sandbox. The standing rule from 2026-08-13 is that new work is validated
against official documentation rather than measured, so each page names its
sources and carries no console output it did not produce.

| Source | Used for |
|---|---|
| react.dev **Learn** — Your First Component, Keeping Components Pure, Passing Props, Sharing State, Preserving and Resetting State, Thinking in React | Topics 01–08, 10 |
| react.dev **Reference** — `Component`, `PureComponent`, `cloneElement`, `Children`, `createContext`, `createPortal`, `forwardRef`, `<input>`, `memo` | Topics 04, 09, 11, 14–16 |
| **React 19 release post** and **upgrade guide** | Topics 07, 09, 14 — `ref` as a prop, the removals, the codemods |
| **legacy.reactjs.org** — Higher-Order Components, Render Props | Topics 12–13, where the caveats were originally documented and are still accurate |
| **W3C WAI-ARIA** Modal Authoring Practices | Topic 11's accessibility obligation |

Two claims are flagged on their pages as reasoning rather than citation, because
documentation does not settle them: **what still requires `forwardRef`** (topic
09 — the docs name no remaining use case; supporting React 18 is the practical
one) and the **colocation** guidance in topic 10, which is community practice.
Validation state for every React page is tracked in the store's
`reference_react_validation_status` memory.

## Three results worth carrying forward

- **The nesting rule is not about nesting.** It is reconciliation comparing
  component types by reference. HOCs applied in render, `lazy()` called in
  render and `memo()` called in render are the same bug in different costumes
  ([01 · chunk 2](01-function-components/02-identity-and-nesting.md)).
- **`propTypes` was removed silently.** React 19 ignores it with no warning, so
  an upgrade quietly deletes every runtime prop check you had
  ([07](07-destructuring-and-defaults.md)).
- **Skipping a render is a hint, not a contract.** The `shouldComponentUpdate`
  docs say React may re-render anyway — which makes memoization useless as a
  correctness mechanism, for classes and for `memo` alike
  ([15](15-purecomponent.md)).

## Gate

**Deliverable:** a `<Dialog>` that renders through a portal, takes its header
and footer as element props, closes on `Escape` and on backdrop click, and works
whether the caller controls `open` or lets it manage itself.

Every piece of that is on a page in this phase: the portal and its
accessibility obligations in [11](11-portals.md), element props in
[03](03-composition/README.md), and the dual-mode controlled/uncontrolled
pattern in
[04 · chunk 2](04-controlled-vs-uncontrolled/02-the-switch-warning.md).

Move on when you can also:

1. Say what happens to a subtree when its component type changes between
   renders, and name three ways that happens by accident.
2. Explain what purity permits — not just what it forbids.
3. Decide, for a given piece of state, whether it should be lifted, and say what
   lifting will cost.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 1 — JSX](../phase-1-jsx/README.md) ·
Start → [Function components](01-function-components/README.md)
