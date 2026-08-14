---
title: "Phase 6 — Rendering performance and the React Compiler"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8**, `babel-plugin-react-compiler` **1.0.0**. No sandbox and
> **no console blocks** — every claim is validated against primary documentation
> and each page's `> Verified:` line names its sources. The measured Compiler output
> lives on [Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md) and is
> linked rather than repeated.

🚧 **In progress — 3 of 17 topics written.** The table below links what exists;
unlinked rows are not written yet.

**Memoization is the most cargo-culted area of React.** This phase is ordered
deliberately: measure, understand *why* something re-rendered, and only then reach
for `memo`. The Compiler changes the ending, not the reasoning.

The single most important sentence in the phase comes from the `memo` reference:

> **Memoization is a performance optimization, not a guarantee.**

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[Why did this component re-render?](01-why-did-this-re-render.md)** | <span className="db-tier t-master">Master</span> | The four causes, and telling them apart instead of guessing |
| 02 | **[`memo`](02-memo.md)** | <span className="db-tier t-master">Master</span> | A shallow prop comparison — useless when the parent passes fresh objects |
| 03 | **[`useMemo`](03-usememo.md)** | <span className="db-tier t-master">Master</span> | Two distinct reasons, only one of which is "it's slow" |
| 04 | `useCallback` | <span className="db-tier t-master">Master</span> | The same thing for functions, and whether yours does anything |
| 05 | Measure before you optimise | <span className="db-tier t-understand">Understand</span> | The Profiler, `<Profiler>`, and Performance Tracks |
| 06 | The memoization trap | <span className="db-tier t-understand">Understand</span> | Fixed by composition, not by more `useMemo` |
| 07 | The React Compiler v1.0 | <span className="db-tier t-understand">Understand</span> | Build-time automatic memoization |
| 08 | Installing and configuring the Compiler | <span className="db-tier t-understand">Understand</span> | Babel plugin, `target`, and the runtime for 17/18 |
| 09 | How the Compiler bails out | <span className="db-tier t-understand">Understand</span> | The rules it must be able to prove |
| 10 | `eslint-plugin-react-hooks` v7 | <span className="db-tier t-understand">Understand</span> | Compiler-powered rules in `recommended` |
| 11 | Do you still write `useMemo`? | <span className="db-tier t-understand">Understand</span> | What to delete, what to keep, in what order |
| 12 | Lazy loading components | <span className="db-tier t-understand">Understand</span> | `lazy` + Suspense, and a loading state that does not flash |
| 13 | Moving state down and lifting content up | <span className="db-tier t-understand">Understand</span> | The two fixes that beat any amount of memoization |
| 14 | List virtualization | <span className="db-tier t-understand">Understand</span> | When the cost is 10,000 DOM nodes, and what windowing costs you |
| 15 | Expensive initial mount | <span className="db-tier t-understand">Understand</span> | Hydration cost, deferring below-the-fold work, `<Activity>` |
| 16 | Bundle size | <span className="db-tier t-know">Know</span> | What actually reaches the browser |
| 17 | `useDeferredValue` for a laggy list | <span className="db-tier t-know">Know</span> | Named here, taught in Phase 8 |

## The order is the argument

Topics 01 and 05 come before 02–04 on purpose. Almost every wasted memoization in
a codebase was added without a profile, to a component that was not the problem —
and `memo` on a component whose parent passes an inline object does **nothing at
all** while looking like it does something.

Topics 13 and 14 are the ones that actually move numbers. Moving state down and
accepting `children` beat any amount of memoization, and past ~10,000 nodes nothing
in topics 02–04 helps because the cost is the DOM.

## Where this phase connects backwards

- **[Phase 3 · 08](../phase-3-state/08-what-triggers-a-re-render.md)** — what
  triggers a re-render, and why "props changed" is not one of the reasons.
- **[Phase 5 · 05](../phase-5-refs-context-reducers/05-context-re-render-problem.md)** —
  context re-renders, which `memo` explicitly cannot stop.
- **[Phase 4 · 11 · 01](../phase-4-effects/11-removing-dependencies/01-objects-and-functions.md)** —
  the identity problem, which is the same problem this phase pays to solve.
- **[Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md)** — the Compiler
  with **measured** output: what it emits, `_c()` slot counts, and that it is not
  a linter.
- **[Phase 0 · 12](../phase-0-how-react-runs/12-devtools-and-profiler.md)** — the
  tooling itself.

## Gate

Take a slow list page, produce a profile that names the actual cause, fix it with
the smallest correct change, and produce a second profile that proves it — then say
whether the Compiler would have fixed it for you.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 5 — Refs, context and reducers](../phase-5-refs-context-reducers/README.md)
