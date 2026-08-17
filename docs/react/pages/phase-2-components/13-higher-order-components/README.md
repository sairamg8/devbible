---
title: "Higher-order components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — the legacy
> [Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html)
> guide and its three caveats; react.dev
> [React v19](https://react.dev/blog/2024/12/05/react-19),
> [`memo`](https://react.dev/reference/react/memo),
> [`forwardRef`](https://react.dev/reference/react/forwardRef) and
> [`'use client'`](https://react.dev/reference/rsc/use-client).
> No sandbox script backs this topic; claims are cited, not measured.

**A function that takes a component and returns a new one. Read them, rarely
write them — and know which ones you are already using without noticing.**

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | **[The pattern and the three caveats](01-the-pattern-and-the-caveats.md)** | The shape, and the three documented failure modes — one of which React 19 quietly fixed |
| 02 | **[Why hooks replaced them, and where they remain](02-why-hooks-replaced-them.md)** | The two problems specific to HOCs, the residue that is genuinely still HOC-shaped, composition order, and what `hoist-non-react-statics` refuses to copy |
| 03 | **[Writing, typing and retiring one](03-writing-typing-retiring.md)** | The `Omit` signature and the cast nobody avoids, the Server Component boundary, testing, and the migration recipe |

**Three chunks, ~700 lines.** Tier stays **Know** — this is a reading skill far
more than a writing one, and chunk 03 exists mostly so you can remove them
safely.

## The one-sentence test

**Does this add behaviour *to* the component's render, or *around* it?**

Inside is a hook. Around is a HOC — and that is the whole of what survived.

## Two things people are surprised by

**You already use HOCs.** `React.memo` and `forwardRef` both take a component and
return a new one. That is also why their nesting order is not arbitrary when they
are combined.

**The most common HOC bug is not subtle.** Applying one during render —
`const Wrapped = withUser(Profile)` *inside* a component body — creates a new
component type every render, so React unmounts and remounts everything below it.
All state is lost, on every keystroke. It is caveat 1, it is worth a lint rule,
and it accounts for more HOC bug reports than the other two caveats combined.

## Where this connects

- **→ [Render props](../12-render-props/README.md)** — the other pre-hooks
  sharing pattern, with the same nesting problem and a different set of survivors.
- **→ [Custom hooks](../../phase-7-custom-hooks/02-writing-a-custom-hook.md)** —
  what replaced them, and what chunk 03's migration recipe converts to.
- **→ [Function components](../01-function-components/02-identity-and-nesting.md)** —
  the identity rule that makes caveat 1 destroy state.
- **→ [`ref` as a prop](../09-ref-as-a-prop.md)** — the React 19 change that
  largely dissolved caveat 3.
- **→ [Class components](../14-class-components/README.md)** — error boundaries
  still need one, which is why `withErrorBoundary` survives.
- **→ [`Component` vs `PureComponent`](../15-purecomponent.md)** — the class
  ancestry of `memo`, itself a HOC.
- **→ [Composition rules](../../phase-10-server-components/10-composition-rules.md)** —
  the client boundary a hook-using HOC drags a component across.

---

Index: [Phase 2](../README.md) · Start → [01 · The pattern and the caveats](01-the-pattern-and-the-caveats.md)
