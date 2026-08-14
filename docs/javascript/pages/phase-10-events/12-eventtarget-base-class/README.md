---
title: "12 · `EventTarget` as a base class"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), [`EventTarget()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Documentation-validated; **no timings**.

The syllabus row is *building your own emitter on the platform instead of shipping one*. It is
Know-tier because you will not need it often — but when you do, the answer is a base class the
browser already has, not a dependency.

🔴 **`EventTarget` is constructible.** `class Store extends EventTarget {}` gives you
`addEventListener`, `dispatchEvent`, `{ once }` and `{ signal }` — including cleanup that a
hand-written `on`/`off` almost never gets right.

## Chunk

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Building on the platform](./01-building-on-the-platform.md)** | The subclass shape, what you get for free (especially `{ signal }`), what it lacks against Node's `EventEmitter`, when a class should *not* be one, composition instead of extension, and the TypeScript caveat |

## Three facts worth carrying out of this topic

- **`{ signal }` is the reason to prefer it** — one `abort()` removes every listener, with no
  function-reference matching.
- **No introspection.** You cannot count listeners, list them, or remove all of a type.
- **Compose rather than extend when dispatch should stay private** — extending makes
  `dispatchEvent` public, so anyone can fake your events.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [08 · Custom events](../08-custom-events/02-decoupling-components.md) — the same emitter used as
  an architecture, and when events are the wrong tool
- [02 · `addEventListener`](../02-addeventlistener/README.md) — `once`, `signal`, and the identity
  trap this avoids
- [Phase 9 · 18 · Custom elements](../../phase-9-dom/18-shadow-dom-and-custom-elements/01-custom-elements.md)
  — an `HTMLElement` is already an `EventTarget`, which is why a component dispatches on itself

---

Start → [01 · Building on the platform](./01-building-on-the-platform.md)
