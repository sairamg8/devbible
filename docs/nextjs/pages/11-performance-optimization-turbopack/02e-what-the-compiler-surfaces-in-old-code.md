---
title: "Turning the compiler on does not create bugs — it withdraws the accident that was hiding them, which is why the migration checklist is mostly a list of components that were already wrong"
sidebar_label: "02e · What it surfaces"
sidebar_position: 113
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the React [React Compiler directives reference](https://react.dev/reference/react-compiler/directives)
> and the React [React Compiler introduction](https://react.dev/learn/react-compiler/introduction),
> cross-checked against the Next.js [`reactCompiler` config reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-02-11`).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4 · React Compiler 1.0 · React 19.2.8**.

**The first week after enabling the React Compiler on a mature codebase produces a small pile of bug reports
that all read like compiler bugs and are almost none of them compiler bugs.** Automatic memoization changes
*when* components re-render and *when* values keep their identity; any code that was quietly relying on
"everything is recomputed every render" loses that guarantee, and what surfaces was already broken. This page
covers the three shapes that failure takes, the discipline React attaches to the `"use no memo"` escape hatch —
it is a tracking marker for a bug, not a configuration choice — and an adoption order in which every step is
revertible on its own so a regression three weeks later bisects to one decision. What you must not delete on
the way in is [02d](02d-migrating-existing-memoization.md); the directives themselves are
[02c](02c-annotation-mode-and-the-two-directives.md).

## `"use no memo"` is a TODO, not a decision

React is explicit that opting out is meant to be a temporary state, and gives a four-step process:

> *"Opt-out directives should be temporary"* — 1. *"Add the directive with a TODO comment"* · 2. *"Create a
> tracking issue"* · 3. *"Fix the underlying problem"* · 4. *"Remove the directive"*

The reason this is a rule and not a nicety: `"use no memo"` marks a component that behaves differently under
automatic memoization, which almost always means the component depends on something it should not — a mutation
during render, an identity assumption, an effect that is really a render side-effect. The directive suppresses
the symptom. Left in place with no comment, it becomes a permanent, unexplained exception that the next
engineer will assume was necessary and route around.

```tsx
'use client'

export function LegacyDropdown({ items }: { items: Item[] }) {
  // TODO(PERF-482): remove once the render-time mutation of `items` is gone.
  // Opted out because the compiler's memoization exposed that this component
  // mutates its props during render.
  'use no memo'

  items.sort((a, b) => a.label.localeCompare(b.label)) // ← the actual bug
  return <ul>{items.map((i) => <li key={i.id}>{i.label}</li>)}</ul>
}
```

The fix is to stop mutating, not to keep the directive:

```tsx
'use client'

export function LegacyDropdown({ items }: { items: Item[] }) {
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label))
  return <ul>{sorted.map((i) => <li key={i.id}>{i.label}</li>)}</ul>
}
```

## Why the compiler surfaces bugs instead of just speeding things up

This is the part teams are unprepared for. Automatic memoization changes *when* a component re-renders and
*when* values keep the same identity. Code that was accidentally relying on "everything is recomputed on every
render" stops getting that guarantee. Three concrete shapes, all of which were already wrong:

- **Mutation during render.** `items.sort(...)` on a prop worked because the caller happened to re-create the
  array each time. Memoize the caller and the same array gets sorted repeatedly, or a stale sorted order sticks.
- **An incomplete `useEffect` dependency array.** It fired on every render because a sibling value changed
  identity constantly; that value is now stable, and the effect stops firing when it should.
- **A render-path side effect** — writing to a `ref`, pushing to a module-level array, incrementing a counter.
  Skipped renders mean skipped side effects.

None of these are compiler bugs, and all of them will be reported as one. The correct response to each is a fix
in the component, with `"use no memo"` used only as a marker while the fix is scheduled.

## An adoption order that does not create a mess

1. Enable `reactCompiler: { compilationMode: 'annotation' }`
   ([02c](02c-annotation-mode-and-the-two-directives.md)) — nothing compiles yet, the build cost stays near
   zero, and the change is safe to land alone.
2. Add `"use memo"` to the two or three components you can *name* as re-rendering too much. Profile them
   before and after; if nothing improves, you have learned cheaply that memoization was not the bottleneck.
3. **Leave every existing `useMemo`/`useCallback` exactly where it is.** This step is doing nothing, on
   purpose.
4. When the annotated set has been stable for a release or two, flip to `reactCompiler: true` and measure the
   build delta on its own branch ([02b](02b-what-the-react-compiler-costs-and-the-rust-port.md)).
5. Only then, and only with tests covering identity-sensitive behaviour, consider removing individual
   hand-written memos — one at a time, never as a sweep, and never in the same PR as the flag.

Each step is revertible on its own, which is the property that matters: when something regresses three weeks
later, you want the bisect to land on one decision rather than on "the compiler migration".
## Gotchas

**★ Symptom: after enabling the compiler an effect stopped running as often, and a feature silently broke.**
Cause: the effect's dependency array was incomplete all along, and it was firing on every render only because
a dependency changed identity constantly. The compiler stabilised that identity and exposed the gap. Fix: fix
the dependency array — do not reach for `"use no memo"`, which hides the same bug behind a directive.

```tsx
// ❌ Fired every render only because `filters` was a fresh object each time.
useEffect(() => { void load(filters) }, [filters])

// ✅ Depend on the values the effect actually reads.
useEffect(() => { void load({ status, assignee }) }, [status, assignee])
```

**★ Symptom: a component was opted out with `"use no memo"` months ago and nobody knows why.** Cause: the
directive was used as a fix rather than as a marker. React's guidance is that opt-outs are temporary and ship
with a TODO and a tracking issue. Fix: every `"use no memo"` gets a comment naming the underlying problem and
an issue number, so the next engineer can retire it instead of preserving it.

```tsx
// TODO(PERF-482): remove once the render-time mutation of `items` is gone.
'use no memo'
```
**Symptom: a mutation-during-render bug appears only in production builds after enabling the compiler.**
Cause: development and production differ in how often components render — React's development-time double
invocation masks or exposes different halves of the problem. Fix: reproduce against a production build before
concluding the compiler is at fault, and treat any render-path mutation as the defect regardless of which build
shows it.

```tsx
// ❌ Mutates a prop during render.
export function Table({ rows }: { rows: Row[] }) {
  rows.sort(byName)
  return <Body rows={rows} />
}

// ✅ Derive, never mutate.
export function Table({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort(byName)
  return <Body rows={sorted} />
}
```
**Symptom: a component renders stale data after the compiler was enabled — the value in a module-level variable
or a `ref` updated, but the UI did not.** Cause: the component read mutable state during render that React
cannot see, so when the compiler skipped the re-render there was nothing to trigger a fresh read. Fix: put the
value somewhere React tracks — state, or an external store subscribed through `useSyncExternalStore`.

```tsx
// ❌ Read during render, invisible to React.
let currentTheme = 'light'
export function Badge() { return <span className={currentTheme}>ok</span> }

// ✅ Subscribed, so a change actually schedules a render.
export function Badge() {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.get)
  return <span className={theme}>ok</span>
}
```

**Symptom: a bug is reported as "the React Compiler broke X", and turning the flag off does fix it.** Cause:
that is evidence the component depended on the absence of memoization, not evidence of a compiler defect. Fix:
use the flag as a bisect tool rather than a verdict — narrow to the component with a file-level `"use no memo"`,
then fix what that component is doing.

```tsx
// Step 1: confirm the blast radius is this file, with a TODO attached from the start.
// TODO(BUG-913): compiler exposed a render-time mutation here; remove after the fix.
'use no memo'
```

## Interview questions

**★ How would you adopt the React Compiler on a large legacy codebase without a big-bang change?**
Start in annotation mode: `reactCompiler: { compilationMode: 'annotation' }` compiles nothing until a function
carries `"use memo"`, so landing the config is close to a no-op and the build cost stays small. Then annotate
the specific components you can name as re-rendering too much, profile them, and grow the set. Leave existing
memoization alone throughout. Once the annotated set has been stable across a release or two, switch to
`reactCompiler: true` on its own branch so the build-time delta has a single cause. Removing hand-written memos
comes last, individually, with tests. Every step is revertible in isolation, which is the property that makes
the migration debuggable months later.

**★ Why does the compiler surface bugs in old components rather than just making them faster?**
Because automatic memoization changes when a component re-renders and when values keep the same identity, and
code that was accidentally depending on "everything is recomputed every render" stops getting that. A component
that mutates its props during render, or an effect with an incomplete dependency array, or a side effect
sitting in the render path, was already wrong; it merely produced acceptable behaviour because nothing was
being cached. Turning the compiler on removes the accident. This is exactly why `"use no memo"` is framed as a
tracking marker for a bug rather than as a configuration choice.
**What does `"use no memo"` mean, and what should follow it?**
It opts a component or hook out of compilation, and React is explicit that it should be temporary: add it with
a TODO comment, create a tracking issue, fix the underlying problem, remove the directive. A component needing
the opt-out is almost always doing something it should not — mutating props during render, relying on a value
changing identity every render, or holding a side effect in the render path. The directive hides the symptom;
without the TODO it becomes a permanent unexplained exception that outlives everyone who understood it.

**★ A teammate says the React Compiler broke their component, and disabling it does fix the symptom. What is
your response?**
That the experiment narrowed the problem, not that it identified the cause. Turning the compiler off restores
"everything recomputes every render", and a component that only works under that assumption is a component with
a latent defect — a mutation during render, an incomplete dependency array, a side effect in the render path,
or state React cannot see. The useful next step is to narrow the blast radius with a file-level `"use no memo"`
carrying a TODO and an issue number, then fix what the component is actually doing. Reverting the flag for the
whole application to accommodate one component is the outcome to argue against.

---

← [02d · Migrating existing memoization](02d-migrating-existing-memoization.md) · [Chapter index](01-explanation.md) · Next → [03 · Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md)
