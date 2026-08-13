---
title: "Class components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`Component`](https://react.dev/reference/react/Component) and the
> [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).
> No sandbox script backs this topic; claims are cited, not measured.

Still supported, not recommended, and not going away. You read these rather than
write them — except for the one job React still has no function-component answer
for.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Anatomy, state and `this`](01-anatomy-and-this.md)** | `setState` merges, `useState` replaces — and where `.bind(this)` came from |
| 02 | **[The lifecycle, and the hook each one maps to](02-lifecycle-and-hooks.md)** | Nine map cleanly; the two that do not are why error boundaries are classes |

**Split at 300 lines on a concept boundary.** Chunk 01 is the instance and its
state; chunk 02 is the lifecycle table and error boundaries.

## What React 19 changed for classes

Three removals and one deliberate survival, all covered across the two chunks:

- **String refs removed** — `this.refs.x` no longer works. Codemod:
  `npx codemod@latest react/19/replace-string-ref`.
- **Legacy context removed** — `contextTypes` and `getChildContext` are gone;
  migrate to `static contextType`.
- **`UNSAFE_` lifecycles** still work under their prefixed names, with the
  `rename-unsafe-lifecycles` codemod for the old ones.
- **`defaultProps` kept for classes**, explicitly, because there is no ES6
  default-parameter equivalent — while it was removed for function components
  ([topic 07](../07-destructuring-and-defaults.md)).

## Where this connects

- **→ [`Component` vs `PureComponent`](../15-purecomponent.md)** — the class
  ancestry of `memo`.
- **→ [Higher-order components](../13-higher-order-components.md)** — error
  boundaries must be classes, so a HOC is the ergonomic way to apply one.
- **→ [`ref` as a prop](../09-ref-as-a-prop.md)** — string refs, and why class
  refs mean the instance.
- **→ Phase 4** — the lifecycle-to-effect translation, made properly rather
  than mechanically.
- **→ Phase 8** — error boundaries alongside Suspense.

---

← Index: [Phase 2](../README.md) · Start → [Anatomy, state and `this`](01-anatomy-and-this.md)
