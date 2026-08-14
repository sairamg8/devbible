---
title: "The memoization trap"
sidebar_label: "06 · The memoization trap"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`memo`](https://react.dev/reference/react/memo),
> [`useMemo`](https://react.dev/reference/react/useMemo) and
> [`useCallback`](https://react.dev/reference/react/useCallback)
> (all three carry the same "principles that make memoization unnecessary" list).
> No sandbox script backs this page; claims are cited, not measured.

**The failure mode where a codebase accumulates `memo`, `useMemo` and `useCallback`
everywhere and gets no faster. It has one cause, and the documented fix is
composition — not more memoization.**

## The trap, in four steps

1. A child re-renders too often, so it gets `memo`.
2. It still re-renders, because the parent passes `<Child data={{...}} />`.
3. So the object gets `useMemo`, and the handler gets `useCallback`.
4. It **still** re-renders, because one of those memos depends on something that is
   itself new each render.

Each step is locally reasonable. The result is a component with five memoization
calls that skips nothing, and — worse — that now *looks* optimised, so nobody
revisits it.

The mechanism is stated in all three references:

> Not all memoization is effective: **a single value that's "always new" is enough
> to break memoization for an entire component.**

**Memoization is a chain.** Every link must hold. One inline object anywhere above
makes every `memo` below it inert while leaving all the code in place.

## Why adding more memoization does not converge

Because the chain has to be maintained *by hand, forever*. Every new prop, every
new dependency, every refactor is a chance to introduce one always-new value and
silently disable everything downstream — with no error, no warning, and no test that
fails.

There is also no signal that it has broken. A working `memo` and a defeated `memo`
look identical in the source. The only way to tell them apart is
[topic 05](05-measure-before-you-optimise.md)'s `actualDuration` vs `baseDuration`,
which almost nobody runs.

## 🔴 The fix: accept `children`

The first of the five documented principles, and the one that dissolves the trap
rather than managing it:

> When a component **visually wraps other components, let it accept JSX as
> children.** This way, when the wrapper component updates its own state, **React
> knows that its children don't need to re-render.**

The problem:

```jsx
// 🔴 ExpensiveTree re-renders on every keystroke
function Layout() {
  const [text, setText] = useState('');
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <ExpensiveTree />
    </div>
  );
}
```

`ExpensiveTree` takes no props at all, and still re-renders on every character —
because its element is created inside `Layout`'s render, so a new element is
produced each time.

The composition fix:

```jsx
// ✅ ExpensiveTree is created by the parent and passed through untouched
function Layout({ children }) {
  const [text, setText] = useState('');
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      {children}
    </div>
  );
}

// used as:
<Layout><ExpensiveTree /></Layout>
```

Now the `<ExpensiveTree />` element is created **where `children` is passed from**,
not inside `Layout`. `Layout`'s state changing does not create a new element for it,
so React reuses the existing one and never re-renders it.

**No `memo`, no `useMemo`, no `useCallback`, and nothing to maintain.** The
optimisation is structural: it cannot be accidentally broken by adding a prop,
because there is no prop.

## The other four principles

All three references carry the same list, which is itself a signal of how central it
is:

> 2. **Prefer local state and don't lift state up any further than necessary.** …
>    don't keep transient state like forms and whether an item is hovered at the top
>    of your tree or in a global state library.
> 3. **Keep your rendering logic pure.** If re-rendering a component causes a problem
>    or produces some noticeable visual artifact, **it's a bug in your component!
>    Fix the bug instead of adding memoization.**
> 4. **Avoid unnecessary Effects that update state.** **Most performance problems in
>    React apps are caused by chains of updates originating from Effects.**
> 5. **Try to remove unnecessary dependencies from your Effects.**

Point 3 is the one that catches a specific bad habit: reaching for `memo` because a
re-render *breaks* something — a reset animation, a duplicated request, a flicker.
That is a correctness bug, and `memo` is not a guarantee
([topic 02](02-memo.md)), so it will come back.

Point 2 is [topic 13](13-moving-state-down.md), and it is the other structural fix:
`Layout` above only re-renders at all because `text` lives there. Moving the input
and its state into their own component means nothing else re-renders on a keystroke.

## Composition or memoization?

| | Composition (`children`, moving state) | Memoization |
|---|---|---|
| Maintained by | the structure | you, forever |
| Broken by | restructuring, visibly | one new inline prop, silently |
| Requires measurement | no | yes, to know it works |
| Helps first render | yes (less work exists) | no |
| Works with the Compiler on | unchanged | mostly redundant ([11](11-do-you-still-write-usememo.md)) |

The last row matters for where this is going. The Compiler
([topic 07](07-the-react-compiler.md)) automates the memoization column. It does
**not** automate the composition column — and composition is the one that was
winning anyway.

## Gotchas

**Symptom:** a component with no props re-renders on every parent keystroke.
**Cause:** its element is created inside the parent's render, so a new one is
produced each time.
**Fix:** accept `children` and pass the element in from above.

**Symptom:** five memoization calls in one component and no measurable improvement.
**Cause:** one always-new value breaking the chain.
**Fix:** find it ([topic 04](04-usecallback.md)'s `Object.is` procedure) — or
restructure so the chain is not needed.

**Symptom:** `memo` added because a re-render caused a visual glitch or a duplicate
request.
**Cause:** a correctness bug being suppressed. Memoization is not a guarantee.
**Fix:** fix the bug. It will return the moment React decides to re-render anyway.

**Symptom:** the whole page re-renders on every keystroke in one field.
**Cause:** transient form state lifted to the top of the tree.
**Fix:** keep it local ([topic 13](13-moving-state-down.md)).

**Symptom:** memoization was added and later silently stopped working.
**Cause:** a refactor introduced a new inline prop above it. Nothing reports this.
**Fix:** prefer structural fixes, which cannot be broken invisibly.

**Symptom:** the team plans to enable the Compiler and delete all composition work.
**Cause:** assuming it automates everything.
**Fix:** it automates memoization, not structure. `children` and local state still
win.

## Interview questions

**★ What is the memoization trap?**
A component accumulates `memo`, `useMemo` and `useCallback` and skips nothing,
because memoization is a chain and one always-new value anywhere breaks the whole
thing — a fact all three references state. Each individual addition looked
reasonable, the code now looks optimised, and there is no error or warning to say it
is inert. Only a before/after measurement distinguishes a working `memo` from a
defeated one.

**★ Why does a component with no props re-render when its parent's state changes,
and how does `children` fix it?**
Because the element is created inside the parent's render, so each render produces a
new element for it. If the parent instead accepts `children`, that element is
created by *its* parent and passed through untouched — so the wrapper's own state
changing does not produce a new element, and React reuses it. The docs give this as
the first principle for making memoization unnecessary, and it needs no memoization
calls and nothing to maintain.

**★ Why is composition preferable to memoization even when both work?**
Because a structural fix cannot be silently broken. Memoization has to be maintained
by hand: any new prop or dependency can introduce an always-new value and disable
everything downstream with no error and no failing test. Composition is enforced by
the shape of the code, helps the first render as well as updates, and — relevant now
— is the part the React Compiler does *not* automate.

**When is reaching for `memo` a sign of a different bug entirely?**
When the re-render *breaks* something — a reset animation, a duplicated request, a
flicker. The docs say plainly that this is a bug in your component and to fix the
bug rather than memoize around it. Since memoization is explicitly not a guarantee,
React may re-render anyway and the bug returns.

**What do the docs claim causes most React performance problems?**
Chains of updates originating from Effects that make components render over and over
— point 4 of the same list. That is a Phase 4 problem, not a memoization one, which
is why the first thing to check in a profile is how many commits a single
interaction produced.

---

← Prev: [Measure before you optimise](05-measure-before-you-optimise.md) · Index: [Phase 6](README.md) · Next → [The React Compiler v1.0](07-the-react-compiler.md)
