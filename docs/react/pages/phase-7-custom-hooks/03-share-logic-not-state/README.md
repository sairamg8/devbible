---
title: "Custom hooks share logic, not state"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context),
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore),
> and MDN [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).
> No sandbox script backs this topic; claims are cited, not measured.

**Custom Hooks let you share *stateful logic* but not *state itself*. Each call to a
Hook is completely independent from every other call to the same Hook** — and the
first example everyone meets makes that look false, which is why this is the most
common misunderstanding in the phase.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Two callers, two states](01-two-callers-two-states.md)** | The `useOnlineStatus` illusion, the `useFormInput` proof, and why a hook call is a call and not a subscription |
| 02 | **[The `useLocalStorage` trap](02-the-localstorage-trap.md)** | Agrees on mount, diverges on the first write — and why a `storage` listener is silent for the case you have |
| 03 | **[When you actually wanted shared state](03-when-you-wanted-shared-state.md)** | Lift it to a common parent, or declare it once in a provider and let the hook read context |
| 04 | **[State outside React](04-external-stores.md)** | `useSyncExternalStore`, its immutability contract, and the four ways a module-level `let` fails |

**Split at 300 lines on concept boundaries.** Chunks 01–02 are the behaviour and the
bug it causes; chunks 03–04 are the three legitimate homes for shared state, divided
at the line between state React owns and state it merely reads.

## The one-sentence version

If two components must agree, the state does not belong in the hook — it belongs in a
**common parent**, a **context provider**, or a **store outside React**. The custom
hook is how components *reach* that state, never where it lives. Everything in this
topic follows from that.

## Where this connects

- **← [The Rules of Hooks](../01-the-rules-of-hooks.md)** — hooks are stored per
  component instance, which is the premise this whole topic rests on.
- **← [Writing a custom hook](../02-writing-a-custom-hook.md)** — the `use` prefix
  buys visibility, not shared state; this topic is that sentence's consequences.
- **→ [Why the rules exist](../05-why-the-rules-exist.md)** — positional hook storage
  in full, which is *why* two calls can never meet.
- **→ [Designing a hook's API](../06-designing-a-hooks-api.md)** — a hook that reads
  shared state has a different shape from one that owns it.
- **↔ [Phase 5 · `createContext`/`useContext`](../../phase-5-refs-context-reducers/04-createcontext-usecontext.md)**
  and **[Phase 5 · context + reducer](../../phase-5-refs-context-reducers/12-context-plus-reducer.md)**
  — the provider half of option 2.
- **↔ [Phase 5 · `useSyncExternalStore`](../../phase-5-refs-context-reducers/15-usesyncexternalstore.md)**
  — the reference treatment of option 3.
- **↔ [Phase 6 · Moving state down](../../phase-6-performance/13-moving-state-down.md)**
  — the same ownership question with the performance consequences attached.

---

← Index: [Phase 7](../README.md) · Start → [Two callers, two states](01-two-callers-two-states.md)
