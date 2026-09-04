---
title: "\"Retiring manual useMemo and useCallback\" is a rule for new code — React's own documentation says removing the memoization you already have can change compilation output, so the cleanup PR is a behavioural change wearing a whitespace change's clothes"
sidebar_label: "02d · Migrating existing memoization"
sidebar_position: 112
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the React [React Compiler introduction](https://react.dev/learn/react-compiler/introduction)
> and the React [React Compiler directives reference](https://react.dev/reference/react-compiler/directives),
> cross-checked against the Next.js [`reactCompiler` config reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-02-11`).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4 · React Compiler 1.0 · React 19.2.8**.

**Every summary of the React Compiler compresses to "it retires `useMemo` and `useCallback`", and that
compression is where the outages come from.** React's actual guidance splits by the age of the code: rely on
the compiler for *new* code, and for *existing* code either leave the memoization alone or test carefully
before removing it, *"because removing it can change compilation output."* The compiler does not promise to
reproduce the identity behaviour your hand-written memo produced — and identity is precisely what effect
dependency arrays, `key` props and imperative third-party APIs are built on. This page covers the rule, why the
compiler cannot simply be a superset of what you wrote by hand, which memos are load-bearing on identity, and
what "carefully testing" has to mean when the documentation stops at the adverb. What the compiler *surfaces*
in old code once it is on — and the adoption order that keeps every step revertible — is
[02e](02e-what-the-compiler-surfaces-in-old-code.md).

## 🔴 The rule: do not mass-delete existing memoization

> *"For new code, we recommend relying on the compiler for memoization and using `useMemo`/`useCallback` where
> needed to achieve precise control.*
> *For existing code, we recommend either leaving existing memoization in place (removing it can change
> compilation output) or carefully testing before removing the memoization."*
> — react.dev, React Compiler introduction

Two separate instructions are packed in there, and both get lost when the sentence is compressed:

- **New code:** stop reaching for `useMemo`/`useCallback` reflexively — but they remain the tool when you need
  *precise control*, e.g. a dependency you know is stable for a reason the compiler cannot see, or a value you
  need to be referentially identical across a boundary the compiler does not reason about.
- **Existing code:** *"removing it can change compilation output."* A cleanup PR that strips a hundred
  `useMemo` calls is a behavioural change disguised as a cosmetic one, and it will be reviewed like a cosmetic
  one, which is the actual danger. Reviewers approve deletions of "now-redundant" code quickly.

**Why the compiler cannot simply be a superset of what you wrote.** Automatic memoization is derived from what
the compiler can prove about a component's inputs and its render. Your hand-written `useMemo` encodes something
you *decided* — often a dependency list that is deliberately narrower than the values the expression actually
reads, because you know something the compiler does not. Delete it and you have replaced a decision with an
inference. Sometimes the inference is better. Sometimes it recomputes where you had pinned, or pins where you
had recomputed, and a downstream effect changes how often it fires.

## What "carefully testing" has to mean

The documentation stops at the word "carefully", so here is the operational version. For each removal, the
thing to check is **not** that the component still renders — it will. It is whether the identity guarantees the
memo was providing still hold. A memoized value is load-bearing on identity when it crosses into any of these:

| Crossing | What breaks when identity changes |
|---|---|
| A `useEffect` / `useLayoutEffect` dependency array | The effect re-runs — teardown and setup — on every render |
| A `key` prop | React unmounts and remounts the subtree, discarding its state |
| A third-party imperative API (chart, map, editor, observer) | The instance is destroyed and rebuilt, losing internal state and firing lifecycle callbacks |
| A `useSyncExternalStore` subscription argument | Resubscribes on every render |
| A memoized child's props (`React.memo`) | The child's memoization is defeated, silently |

Anything in that table stays until you have a test that fails if the identity changes. The example below is the
one to keep in mind, because it is the failure that reaches production most often — a chart that reinitialises
on every keystroke somewhere else on the page:

```tsx
'use client'

import { useEffect, useMemo, useRef } from 'react'

export function PriceChart({ points, theme }: { points: Point[]; theme: Theme }) {
  // 🔴 Load-bearing identity: this object is a dependency of the effect below, and the
  // effect tears down and rebuilds a third-party chart every time the identity changes.
  // Do NOT delete this useMemo just because the compiler is enabled — verify the effect
  // still runs the same number of times first.
  const options = useMemo(
    () => ({ theme, animate: points.length < 500 }),
    [theme, points.length]
  )

  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chart = createChart(el.current!, options)
    return () => chart.destroy()
  }, [options])

  return <div ref={el} />
}
```

**The test that makes the removal safe** is a count, not a snapshot — assert how many times the effect body ran
across a re-render that should not have disturbed it:

```tsx
// components/price-chart.test.tsx — pseudo-code for whichever runner you use
let created = 0
vi.mock('./chart-lib', () => ({
  createChart: () => {
    created++
    return { destroy: () => {} }
  },
}))

test('chart is not rebuilt when an unrelated prop changes', () => {
  const { rerender } = render(<PriceChart points={points} theme="dark" />)
  rerender(<PriceChart points={points} theme="dark" />)
  expect(created).toBe(1) // ← fails the moment `options` stops being stable
})
```

## Gotchas

**★ Symptom: a cleanup PR removed dozens of `useMemo` calls "because the compiler handles it now" and a chart,
map or editor started reinitialising on every render.** Cause: the memoized object was a `useEffect`
dependency, and its identity was the contract; react.dev warns that *"removing it can change compilation
output."* Fix: revert the sweep and reintroduce removals one at a time, keeping any memo whose value crosses
into an effect dependency array, a `key`, or a third-party imperative API.

```tsx
// Keep this. Its identity is a dependency of an effect that tears down a chart.
const options = useMemo(() => ({ theme, animate: points.length < 500 }), [theme, points.length])
useEffect(() => {
  const chart = createChart(el.current!, options)
  return () => chart.destroy()
}, [options])
```

**★ Symptom: a list started losing its input state — text typed into a row is cleared — after the compiler was
enabled.** Cause: a `key` derived from a memoized value whose identity or content changed differently once the
compiler took over, so React unmounted and remounted the row. Fix: derive keys from stable domain identity, not
from anything computed, so the compiler's memoization cannot affect them.

```tsx
// ❌ Key depends on a computed value.
{rows.map((r) => <Row key={`${r.id}-${computeHash(r)}`} row={r} />)}

// ✅ Key is the domain identity and nothing else.
{rows.map((r) => <Row key={r.id} row={r} />)}
```

**Symptom: a `React.memo`-wrapped child re-renders on every parent render after a `useCallback` was deleted.**
Cause: the callback prop is a new function identity each render, which defeats `React.memo`'s shallow compare.
The compiler may stabilise it, but if the child is in a file or mode that is not being compiled, nothing does.
Fix: keep the `useCallback` until both parent and child are compiled, and verify with the profiler rather than
by inspection.

```tsx
// Keep until the child is compiled too — React.memo compares props shallowly.
const onSelect = useCallback((id: string) => setSelected(id), [])
return <ExpensiveRow onSelect={onSelect} />
```

**Symptom: a 40-file PR deleting `useMemo` calls was approved in ten minutes because the diff looked
cosmetic.** Cause: deletions of "now-redundant" code read as cleanup, and nothing in the diff shows that an
identity contract was being removed. Fix: make the danger visible in the process rather than hoping a reviewer
spots it — one memo per commit, each commit naming the test that covers the identity it was protecting, and
never in the same PR as the flag that enabled the compiler.

```bash
# One decision per commit, so a later bisect lands on a single removal.
git commit -m "perf: drop useMemo in FacetList (covered by facet-list.test.tsx: 'no resubscribe')"
```

**Symptom: a value that must be referentially identical across a context boundary started changing every
render.** Cause: the memo producing it was removed on the assumption that the compiler would keep it stable,
but a context value's identity drives re-renders of every consumer, and the compiler's inference is not a
promise about that particular object. Fix: keep the memo for context values — this is exactly the *"precise
control"* case React carves out for new code as well.

```tsx
// Keep. Every consumer of this context re-renders when the identity changes.
const value = useMemo(() => ({ user, permissions }), [user, permissions])
return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
```

## Interview questions

**★ The chapter title says the React Compiler retires manual `useMemo` and `useCallback`. Is that an
instruction to delete them?**
No, and React says so directly. The recommendation splits by age of code: for *new* code rely on the compiler
and use `useMemo`/`useCallback` only where you need precise control; for *existing* code either leave the
memoization in place or test carefully before removing it, *"because removing it can change compilation
output."* The compiler is not guaranteed to reproduce the exact identity behaviour a hand-written memo
produced, and identity is what effect dependency arrays, `key` props and imperative third-party APIs are built
on. The correct posture is "stop writing new ones", not "delete the old ones".

**★ Which specific `useMemo` calls would you refuse to delete, and how would you prove it is safe when you do?**
Any memo whose *value identity* leaves the component: a dependency of `useEffect` or `useLayoutEffect`,
anything feeding a `key`, an argument to `useSyncExternalStore`, a prop passed to a `React.memo` child, and any
object handed to an imperative third-party instance such as a chart, map or editor. For those, the proof is a
test that counts side effects across a re-render that should have been inert — assert the chart was constructed
once, not that the DOM looks right. A render snapshot passes either way, which is what makes this class of
regression reach production.

**★ Why can't the compiler simply be a superset of hand-written memoization — why is removing a `useMemo` ever
a behavioural change?**
Because the two are derived differently. The compiler infers what to cache from what it can prove about a
component's inputs and its render. A hand-written `useMemo` encodes a *decision*, and the decision is often
deliberately narrower than the values the expression reads — a dependency list you pruned because you know
something about the data that is not visible in the source. Delete it and you have swapped a decision for an
inference. Sometimes the inference is strictly better; sometimes it recomputes where you had pinned, or pins
where you had recomputed, and something downstream that depended on the old cadence changes. React's phrasing
is exactly this careful: *"removing it can change compilation output."*

**How do you make a memo-removal safe to review, not just safe to write?**
By making the risk visible in the shape of the change rather than in the reviewer's attention. One memo per
commit, each naming the test that covers the identity it was protecting; never in the same PR as the flag that
enabled the compiler; and a rule that anything in the load-bearing table — effect dependencies, `key`s,
`useSyncExternalStore` arguments, `React.memo` props, context values, imperative library options — is out of
scope for cleanup entirely. A 40-file deletion PR gets approved in minutes because it reads as tidying; the
process has to prevent it existing rather than rely on catching it.

---

← [02c · Annotation mode and directives](02c-annotation-mode-and-the-two-directives.md) · [Chapter index](01-explanation.md) · Next → [02e · What the compiler surfaces](02e-what-the-compiler-surfaces-in-old-code.md)
