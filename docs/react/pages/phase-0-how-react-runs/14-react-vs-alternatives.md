---
title: "React vs the alternatives"
sidebar_label: "14 · React vs alternatives"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08-13. The size table is produced by
> `sandbox/react-p0/ex13-renderers-and-alternatives.mjs`, which bundles the
> **same counter app** with each library through the **same** esbuild settings.

**React re-renders components and diffs the result. Signal-based libraries
update the exact DOM node that depends on a changed value. That single
difference explains most of the comparisons you will read.**

## The models

**React** — when state changes, React calls your component again, produces a new
element tree, diffs it against the old one, and applies the difference. The unit
of update is a **component**.

**Signals** (Solid, Svelte 5, Vue's reactivity) — a value knows which parts of
the DOM read it. Changing it updates those bindings directly. There is no diff
and usually no re-render of the surrounding function. The unit of update is a
**binding**.

```jsx
// React: the whole Counter function runs again on every click
function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>count {n}</button>;
}
```

```jsx
// Solid: Counter runs ONCE. Only the text node bound to n() updates.
function Counter() {
  const [n, setN] = createSignal(0);
  return <button onClick={() => setN(n() + 1)}>count {n()}</button>;
}
```

The consequences run deep and explain React's ergonomics:

| | React | Signals |
|---|---|---|
| Component function runs | Every render | Once |
| Stale closures | A real, constant hazard | Largely absent |
| Dependency arrays | Needed (or a compiler) | Not needed |
| Memoization | `memo`/`useMemo`, or the Compiler | Rarely needed |
| Debugging "why did it re-render" | A frequent activity | Rarely a question |
| Cost of the model | Diffing, and the discipline of purity | Reactive graph bookkeeping |

React's own answer to the ergonomic gap is the
[React Compiler](11-the-compiler.md) — keep the re-render model, let a build step
do the memoization.

## Size, measured the same way

```console
=== the same counter app, minified, one bundler, three libraries ===
  react        189.8 KB min    59.2 KB gzip   react-dom@19.2.8 react@19.2.8
  preact        13.0 KB min     5.4 KB gzip   preact@10.29.8
```

**Preact is roughly 11× smaller gzipped** for an identical app, with a
near-identical API. If bundle size is the binding constraint — an embedded
widget, a landing page, a low-bandwidth market — that is a serious number.

Solid is deliberately absent from the table. Its JSX compiles to fine-grained DOM
operations through `babel-preset-solid`, so it cannot be built with esbuild's JSX
transform alone; adding a second toolchain would have made the comparison
unequal. Rather than quote a number from elsewhere, the measurement stops here.
That is also a small honest data point about signal libraries: **the compiler is
not optional**.

## An honest comparison

| | **React** | **Vue** | **Svelte** | **Solid** | **Preact** |
|---|---|---|---|---|---|
| Model | Re-render + diff | Signals + template | Signals, compiled | Signals | Re-render + diff |
| Bundle (this app, gzip) | 59.2 KB | — | — | — | **5.4 KB** |
| Ecosystem | **By far the largest** | Large | Growing | Small | Uses React's, mostly |
| Hiring pool | **Largest** | Large | Smaller | Small | N/A |
| Server Components | **Yes** | No equivalent | No equivalent | No equivalent | No |
| Mobile | React Native | NativeScript etc. | — | — | — |
| Learning curve | Medium; hooks are the wall | Gentle | Gentlest | Medium | Same as React |

### Where React genuinely wins

- **Ecosystem and hiring.** For a commercial project this usually dominates every
  technical argument. A library you need already exists, and people you hire have
  used it.
- **Server Components.** No other mainstream library has this model. If
  server-rendered, zero-JS-by-default components matter, React is the option.
- **React Native**, if mobile is on the roadmap.
- **Longevity.** Now governed by the React Foundation under the Linux Foundation
  rather than a single company.

### Where React genuinely loses

- **Bundle size.** 59 KB gzipped before you write a feature.
- **Ergonomics.** Stale closures, dependency arrays and memoization are
  self-inflicted complexity that signal libraries do not have. The Compiler
  reduces this; it does not remove the underlying model.
- **Raw update performance** on fine-grained, high-frequency updates, where
  diffing is pure overhead.
- **Ceremony for small things.** A 20 KB widget should probably not carry a 59 KB
  runtime.

## Choosing, for this bible's stack

For a MERN/PERN fullstack application, **React is the default**, and the reason is
not technical superiority — it is that the ecosystem, the hiring pool and the
server story are all strongest there, and the whole point of this reference is
building a complete application without gaps.

Sensible exceptions:

- **An embedded widget on someone else's page** → Preact, near-identical API.
- **A content site that is mostly static** → Astro (which can render React
  components), or no framework at all.
- **A team already fluent in Vue or Svelte** → use it. Familiarity beats the
  comparison table.

## Gotchas

**Symptom:** a benchmark shows React losing badly.
**Cause:** most framework benchmarks measure many small updates — precisely
where fine-grained reactivity wins and diffing is overhead. Real applications are
dominated by network latency and initial load.
**Fix:** benchmark your own interaction, in your own app. See
[page 12](12-devtools-and-profiler.md).

**Symptom:** a Preact swap breaks a dependency.
**Cause:** `preact/compat` covers most of React's API but not all of it —
Server Components, some concurrent features, and libraries reaching into React
internals.
**Fix:** test the actual dependency list before committing to the swap.

**Symptom:** "signals are coming to React" cited as a reason to wait.
**Cause:** React has explicitly chosen the compiler route instead.
**Fix:** treat the re-render model as stable and learn the Compiler.

## Interview questions

**★ What is the difference between React's model and a signal-based one?**
React re-runs the component and diffs the output; the unit of update is the
component. Signals track which DOM bindings read a value and update those
directly; the component function runs once. Stale closures, dependency arrays
and memoization are all consequences of React's choice.

**★ Why is React still the default in 2026 when smaller and faster options
exist?**
Ecosystem, hiring, Server Components, React Native, and now foundation-level
governance. Those outweigh a 54 KB gzipped difference for most commercial
applications — though not for an embedded widget.

**★ When would you not choose React?**
An embeddable widget with a hard size budget (Preact), a mostly-static content
site (Astro or none), or a team already productive in another framework.

**How much does React cost in bundle size?**
Measured here: 59.2 KB gzipped for a counter app, against 5.4 KB for the same app
in Preact — about 11×.

**Is the React Compiler React's answer to signals?**
Effectively yes. Rather than change the update model, React keeps re-rendering
and moves memoization into a build step, so the ergonomic cost of the model is
paid by the compiler instead of by you.

---

← Prev: [React on other renderers](13-other-renderers.md) · Index: [Phase 0](README.md) · Next phase → [Phase 1 — JSX](../../syllabus/01-the-react-model.md)
