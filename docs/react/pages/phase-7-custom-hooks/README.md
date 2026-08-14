---
title: "Phase 7 — Custom hooks and the Rules of React"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line names
> its sources.

✅ **COMPLETE — all 12 topics written.** 25 leaf pages — 6 chunked topic directories
(19 pages) plus 6 single-file topics — **7,084 lines, 0 files over 300.**

**The shortest phase in the syllabus and the highest ratio of understanding to
material.** Everything in phases 0–6 works because of the rules written down here.
The phase answers three questions in order: what the rules are, how you write a hook
that obeys them, and *why* they exist — the last one from the implementation, because
"the linter says so" is not an explanation that survives an interview or a 2 a.m.
debugging session.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[The Rules of Hooks](01-the-rules-of-hooks.md)** | <span className="db-tier t-master">Master</span> | Top level only, React functions only — and the six things "top level" forbids |
| 02 | **[Writing a custom hook](02-writing-a-custom-hook.md)** | <span className="db-tier t-master">Master</span> | A `use` name plus hooks inside. What the prefix buys and what it doesn't |
| 03 | **[Custom hooks share logic, not state](03-share-logic-not-state/README.md)** | <span className="db-tier t-master">Master</span> | Two callers, two independent states — the phase's biggest misunderstanding |
| 04 | **[The Rules of React beyond hooks](04-rules-of-react-beyond-hooks/README.md)** | <span className="db-tier t-master">Master</span> | Purity, and never mutating anything after passing it to React |
| 05 | **[Why the rules exist](05-why-the-rules-exist/README.md)** | <span className="db-tier t-understand">Understand</span> | Hooks are positional; a conditional hook shifts the list |
| 06 | **[Designing a hook's API](06-designing-a-hooks-api/README.md)** | <span className="db-tier t-understand">Understand</span> | Tuple vs object, one hook one job, naming what it synchronizes with |
| 07 | **[The standard set, written out](07-the-standard-set/README.md)** | <span className="db-tier t-understand">Understand</span> | Ten hooks, each with the gotcha that makes the naive version wrong |
| 08 | **[Hooks that wrap effects](08-hooks-that-wrap-effects/README.md)** | <span className="db-tier t-understand">Understand</span> | Honest dependencies across the boundary, and not re-subscribing |
| 09 | **[Conditional hooks and the correct restructure](09-conditional-hooks.md)** | <span className="db-tier t-understand">Understand</span> | Split the component instead of skipping the hook |
| 10 | **[`use` breaks the rule on purpose](10-use-breaks-the-rule.md)** | <span className="db-tier t-understand">Understand</span> | Why it may sit in a condition when `useState` may not |
| 11 | **[Testing a custom hook](11-testing-a-custom-hook.md)** | <span className="db-tier t-understand">Understand</span> | `renderHook` vs a throwaway component; test behaviour |
| 12 | **[Extracting too early](12-extracting-too-early.md)** | <span className="db-tier t-know">Know</span> | A "custom hook" used once that hides control flow |

## Why this phase sits after Phase 6, not before

The Compiler is the strongest practical argument for the rules, and you cannot make
that argument until the Compiler has been introduced. It can only memoize code whose
behaviour it can prove — code that breaks the Rules of React is not reported, it is
**silently skipped**
([Phase 6 · 09](../phase-6-performance/09-how-the-compiler-bails-out.md)). "Follow the
rules or your code is quietly excluded from the optimisation everyone else gets" lands
harder than "the linter prefers it".

## Where this phase connects backwards

- **[Phase 4 · 03](../phase-4-effects/03-the-dependency-array.md)** — the dependency
  half of the linter, and why honest dependencies are what makes extraction safe.
- **[Phase 4 · 10](../phase-4-effects/10-useeffectevent.md)** — effect events, which
  are how a custom hook takes a callback without re-subscribing on every render.
- **[Phase 4 · 05](../phase-4-effects/05-strictmode-double-invocation.md)** — why
  `useMount` is not a coherent idea.
- **[Phase 6 · 10](../phase-6-performance/10-eslint-plugin-react-hooks.md)** — the
  plugin that enforces all of this.

## Coverage

**All 12 topics, 25 leaf pages, 7,084 lines. No file exceeds 300 lines and nothing was
trimmed to get there** — six topics became directories instead:

| Topic | Chunks | Lines | Split on |
|---|---|---|---|
| 03 Share logic, not state | 4 | 1,055 | The behaviour · the bug it causes · the two homes for shared state inside React · the one outside it |
| 04 Rules of React beyond hooks | 4 | 1,147 | Purity · immutability · who does the calling · the two escape hatches |
| 05 Why the rules exist | 2 | 555 | The mechanism · the forbidden list derived from it |
| 06 Designing a hook's API | 2 | 575 | The signature going in · the contract coming out |
| 07 The standard set | 5 | 1,337 | What each hook talks to — values, browser state, listeners, an observed element, timers |
| 08 Hooks that wrap effects | 2 | 551 | Values · functions, because the fix for each differs completely |

Topics 01, 02, 09, 10, 11 and 12 fit in one file each without compression.

## Gate

Explain, from the implementation, why calling a hook inside `if (loading)` corrupts
state — and write `useDebouncedValue` and `useLocalStorage` from an empty file, both
`StrictMode`-safe and both SSR-safe.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 6 — Rendering performance and the Compiler](../phase-6-performance/README.md)
