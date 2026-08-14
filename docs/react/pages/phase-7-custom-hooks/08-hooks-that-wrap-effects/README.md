---
title: "Hooks that wrap effects"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies),
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent), and
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> No sandbox script backs this topic; claims are cited, not measured.

**Extracting an effect into a hook moves the effect, not the rules. The dependency array
must still be honest — and now half the reactive values arrive as arguments, from a
caller who does not know they are dependencies and will pass an object literal and an
inline arrow every render.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Dependencies across the boundary](01-dependencies-across-the-boundary.md)** | A hook's arguments are its props; destructure objects into primitives, because the caller's fix is not available to you |
| 02 | **[Not re-subscribing](02-not-re-subscribing.md)** | Callbacks can't be destructured — wrap them, and know the reactive/non-reactive test cold |

**Split at 300 lines on a concept boundary** — values, then functions, because the fix
for each is completely different.

## The rule underneath both chunks

**A hook whose correctness depends on the caller memoizing something has a trap in its
signature.** Callers do not read your dependency array; they pass `{ serverUrl, roomId }`
and `(msg) => append(msg)` because that is what the signature invites. The hook absorbs
the instability — by destructuring values and wrapping handlers — or the hook is wrong.

## The test worth memorising

> **Should the effect re-run when this value changes?**

Yes ⇒ dependency. No, but I want the newest value when the event fires ⇒ effect event.
Getting it backwards fails silently in both directions: a demoted dependency stops
re-synchronizing, and a promoted handler thrashes.

## Where this connects

- **← [Designing a hook's API](../06-designing-a-hooks-api/README.md)** — the signature
  decisions this topic gives the mechanical reasons for.
- **← [The standard set](../07-the-standard-set/README.md)** — ten hooks that are all
  instances of these two chunks.
- **↔ [Phase 4 · The dependency array](../../phase-4-effects/03-the-dependency-array.md)**
  and **[Removing dependencies](../../phase-4-effects/11-removing-dependencies/README.md)**
  — the same rules inside a component, in full.
- **↔ [Phase 4 · `useEffectEvent`](../../phase-4-effects/10-useeffectevent.md)** — the
  reference treatment of the mechanism chunk 02 depends on.
- **↔ [Phase 4 · Cleanup](../../phase-4-effects/04-cleanup/README.md)** — the other half
  of a correct effect, unchanged by the boundary.

---

← Index: [Phase 7](../README.md) · Start → [Dependencies across the boundary](01-dependencies-across-the-boundary.md)
