---
title: "React on other renderers"
sidebar_label: "13 · Other renderers"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08-13 against the npm registry.
> `sandbox/react-p0/ex13-renderers-and-alternatives.mjs`.

**`react-dom` is one renderer. The `react` package is renderer-agnostic, and
several production renderers drive it — which is why "React" and "React DOM"
are different words.**

You do not need this to build a web app. You need it to understand why React is
architected the way it is, and to answer the interview question.

## The renderers, and how alive they are

```console
$ node ex13-renderers-and-alternatives.mjs
=== renderers that drive the same `react` package ===
  react-native           latest=0.87.0       published=2026-08-11
  @react-three/fiber     latest=9.7.0        published=2026-07-31
  ink                    latest=7.1.1        published=2026-07-16
  react-reconciler       latest=0.33.0       published=2025-10-01
  react-test-renderer    latest=19.2.8       published=2026-07-21
```

All actively published — React Native two days before this was measured.

| Renderer | Renders to | What it is used for |
|---|---|---|
| `react-dom` | Browser DOM and HTML | Everything in this syllabus |
| `react-native` | Native iOS / Android views | Mobile apps sharing React knowledge, not code with the web |
| `@react-three/fiber` | A three.js scene graph | Declarative WebGL — 3D scenes as components |
| `ink` | A terminal | CLI interfaces. Several well-known CLIs are built with it |
| `react-reconciler` | Whatever you implement | Building your own renderer |

## What a renderer actually provides

`react` gives you elements, hooks, state, context and the scheduler. It never
learns what a "node" is. A renderer supplies a **host config** — a set of
functions the reconciler calls when it commits:

```js
// pseudo-code — the shape of a host config, not a working renderer
const hostConfig = {
  createInstance(type, props) { /* make a node for <type> */ },
  appendChild(parent, child) { /* attach it */ },
  removeChild(parent, child) { /* detach it */ },
  commitUpdate(instance, type, oldProps, newProps) { /* apply changed props */ },
  createTextInstance(text) { /* make a text node */ },
  // …about thirty more
};
```

`react-dom` implements these with `document.createElement` and friends. `ink`
implements them by drawing to a terminal buffer. The reconciler — diffing, keys,
hooks, Suspense, priority — is identical in both.

This is the concrete meaning of "`react` has no DOM in it", measured on
[page 01](01-what-react-is.md): the string `document.createElement` appears
nowhere in the `react` package.

## "Learn once, write anywhere"

The React Native slogan is deliberately *not* "write once, run anywhere". What
transfers between web and native is everything in Parts 1 and 2 of this
syllabus — components, props, state, hooks, reconciliation, the rules. What does
not transfer:

- **Elements.** `<View>` and `<Text>`, not `<div>` and `<span>`.
- **Styling.** A JavaScript style API, not CSS. No cascade, no media queries.
- **Navigation, storage, gestures, permissions** — all platform APIs.

So a hook that manages form state is portable. A component that renders `<div>`
is not.

## `react-test-renderer`

```console
=== is react-test-renderer still usable? ===
  peerDependencies  {"react":"^19.2.8"}
```

Still published in lockstep with React (19.2.8, same day), and its peer
dependency tracks the current version — so it is not abandoned in the registry.
It **is** deprecated in React 19's own documentation, and using it warns.

The replacement for component testing is **React Testing Library**, which drives
`react-dom` in a real (or jsdom) document and asserts against the DOM the user
sees. `react-test-renderer` asserted against a JSON tree of React's internals,
which is exactly the kind of implementation-coupled test that breaks on every
refactor. Phase 14 covers the modern approach.

## Writing your own renderer

`react-reconciler` is the package to use, and the honest advice is: almost never.
Legitimate reasons are a genuinely different output target — a canvas game
engine, a PDF generator, hardware — and the cost is implementing and maintaining
thirty-odd host functions against an API that carries no stability guarantee
(note the `0.33.0` version).

The reason to know it exists is architectural: it proves the reconciler is
genuinely independent of the DOM, rather than that being a marketing claim.

## Gotchas

**Symptom:** a web component imported into a React Native app fails at runtime.
**Cause:** `<div>` is not a host component in React Native.
**Fix:** share hooks and logic; keep presentational components per platform.

**Symptom:** `react-test-renderer` warns as deprecated.
**Cause:** React 19 deprecated it, although it is still published.
**Fix:** migrate to React Testing Library. See Phase 14.

**Symptom:** a renderer package breaks after a React upgrade.
**Cause:** renderers depend on internals that move with React's version.
**Fix:** upgrade the renderer and React together; check the renderer supports
your React version before upgrading React.

## Interview questions

**★ Why can React render to things other than the DOM?**
Because `react` contains only the component model, hooks and the reconciler; the
host-specific work lives in a renderer that implements a host config
(`createInstance`, `appendChild`, `commitUpdate`, …). `react-dom` is one such
renderer.

**★ Is React Native "React for mobile"?**
It is the same React with a different renderer. Components, props, state, hooks
and reconciliation are identical; elements, styling and platform APIs are not.
Hence "learn once, write anywhere" rather than "write once, run anywhere".

**What is `react-reconciler`?**
The package that lets you build a custom renderer by supplying a host config.
Real but rarely appropriate — no API stability guarantee, and about thirty
functions to implement.

**Should you use `react-test-renderer`?**
No. It is deprecated in React 19, though still published. It tested React's
internal tree rather than what the user sees; React Testing Library replaces it.

---

← Prev: [DevTools and the Profiler](12-devtools-and-profiler.md) · Index: [Phase 0](README.md) · Next → [React vs the alternatives](14-react-vs-alternatives.md)
