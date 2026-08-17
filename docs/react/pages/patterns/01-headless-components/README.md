---
title: "Headless components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> [`useId`](https://react.dev/reference/react/useId),
> [`useContext`](https://react.dev/reference/react/useContext),
> [`useRef`](https://react.dev/reference/react/useRef) and
> [Common components](https://react.dev/reference/react-dom/components/common);
> keyboard and ARIA contracts from the W3C
> [ARIA Authoring Practices Guide — Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
> fetched 2026-08-17 and quoted rather than recalled.
> ⚠️ **"Headless component" is a community convention, not a React API.** React
> documents the machinery — hooks, context, `children`, refs — and the platform
> documents the accessibility contracts. The *name* and the *practice* come from
> the ecosystem. Judgements are marked as judgements throughout.
> No sandbox script backs this topic; claims are cited, not measured.

**A headless component ships behaviour, state and accessibility, and renders
nothing you can see. You supply every element and every class name.**

This topic is six chunks because the honest version does not fit in one file.
The short version of headless — "return some props, let the caller render" — is
the part everybody already knows and the part that teaches nothing. The reason
the pattern exists is a contract that runs to roughly thirty keyboard and ARIA
requirements for a single widget, and you cannot argue for it without showing it.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | **[What headless actually means](01-what-headless-means.md)** | Unstyled is not headless; the split it is really making; the four capabilities that are genuinely hard |
| 02 | **[The contract you are inheriting](02-the-contract-you-are-inheriting.md)** | The APG listbox requirements in full, quoted from the spec — plus roving `tabindex` vs `aria-activedescendant` |
| 03 | **[Building it](03-building-it.md)** | The behaviour: two indices, roving focus, type-ahead with its timing rule, and every keyboard binding |
| 04 | **[Wiring it to the DOM](04-wiring-it-up.md)** | The prop getters, what the caller can and cannot get wrong, and what the hook still does not supply |
| 05 | **[The delivery shapes](05-the-delivery-shapes.md)** | Hook · children-as-a-function · compound-over-context · slot/`asChild`, and what each costs |
| 06 | **[When it is wrong, and the limits](06-when-it-is-wrong.md)** | The case against, and what breaks in production — positioning, exit animations, portals, virtualisation, SSR |

**Six chunks, ~1,300 lines.** The topic is Master tier because it is one a reader
builds from, and Master-tier topics in this reference get their depth by
splitting, never by stretching a file.

## Read this first if you read nothing else

**The argument for headless is not reuse. It is that the hard part is invisible.**

A dropdown looks like a button and a list. What it actually is, per the spec in
chunk 02, is a focus-management problem with about a dozen keyboard bindings, a
set of ARIA relationships that must stay consistent with state on every render,
and a type-ahead buffer. Teams do not get that right by hand, and — this is the
part that matters — **they do not get it right the second time either**, because
the next dropdown starts from zero.

If your only problem is that two components share some logic, you do not need any
of this. A [custom hook](../../phase-7-custom-hooks/02-writing-a-custom-hook.md)
already solved that, and reaching for headless is
[extracting too early](../../phase-7-custom-hooks/12-extracting-too-early.md) with
more ceremony.

## Where this connects

- **→ [Prop getters](../04-prop-getters.md)** — the delivery mechanism a headless
  hook uses to hand you props you cannot accidentally break. Chunk 04 uses them
  throughout; chunk 01 shows why the naive props-object version fails.
- **→ [The state reducer pattern](../02-the-state-reducer-pattern/README.md)** — how a
  headless component lets one caller change one transition without a prop per
  exception. The two patterns are usually shipped together.
- **→ [Children patterns](../../phase-2-components/08-children-patterns.md)** —
  the compound-component mechanism chunk 05 builds on.
- **→ [Render props](../../phase-2-components/12-render-props.md)** — the
  children-as-a-function shape, and the wrapper-nesting cost it carries.
- **→ [Share logic, not state](../../phase-7-custom-hooks/03-share-logic-not-state/README.md)** —
  the distinction that decides whether a headless hook is even the right tool.
- **→ [The context re-render problem](../../phase-5-refs-context-reducers/05-context-re-render-problem.md)** —
  the cost the compound shape pays, quantified.
- **→ [`useId`](../../phase-5-refs-context-reducers/14-useid.md)** — how the ARIA
  relationships in chunk 02 get real, hydration-safe ids.

---

Index: [React patterns](../README.md) · Start → [01 · What headless actually means](01-what-headless-means.md)
