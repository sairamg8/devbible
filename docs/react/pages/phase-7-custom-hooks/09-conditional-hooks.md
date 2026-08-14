---
title: "Conditional hooks and the correct restructure"
sidebar_label: "09 · Conditional hooks"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks),
> [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
> (*"How does React know which state to return?"*), and
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state).
> No sandbox script backs this page; claims are cited, not measured.

**Every conditional-hook problem has the same fix, and it is never "call the hook
conditionally, but carefully". It is: make the component's hooks unconditional, and if
the variants genuinely need different hooks, make them different components.**

[Phase 7 · 05](05-why-the-rules-exist/README.md) established *why* — hook identity is
positional, so the count and order must be the same every render. This page is the
practical half: the three shapes the violation takes, and what to write instead.

## The frame that makes the fix obvious

> **Hooks are functions, but it's helpful to think of them as unconditional declarations
> about your component's needs.**

A component *has* a piece of state, an effect, a context subscription. It does not have
them on some renders. Under that reading, "this variant needs a different set of hooks"
is not a hook problem at all — it is the statement **"this is a different component"**,
and React already has a mechanism for that.

So the restructure is always one of two moves:

1. **Make the hook unconditional** and let its *argument* carry the condition.
2. **Split the component**, so each variant declares its own needs.

## Shape 1 — the early return

The most common by far, because it arrives by accident: someone adds a guard clause to a
component that already had hooks.

```jsx
// 🔴 the render reaches zero hooks when user is null, one when it isn't
function Profile({ user }) {
  if (!user) return null;
  const [tab, setTab] = useState('posts');
  useEffect(() => { track('profile_view', user.id); }, [user.id]);
  return <Tabs value={tab} onChange={setTab} />;
}
```

```jsx
// ✅ every render reaches every hook
function Profile({ user }) {
  const [tab, setTab] = useState('posts');
  useEffect(() => {
    if (!user) return;            // the condition moved INSIDE the effect
    track('profile_view', user.id);
  }, [user]);

  if (!user) return null;         // the guard now sits below the hooks
  return <Tabs value={tab} onChange={setTab} />;
}
```

Two things moved, and both matter:

- **The hooks rose above the guard.** The component now always has one state and one
  effect, whether or not it renders anything.
- **The condition moved inside the effect**, which is the general pattern for "this
  effect should only do something sometimes". An effect that runs and returns early is
  fine; an effect that sometimes does not exist is not.

**The objection — "now I allocate state I might not use" — is the wrong instinct.** A
`useState` slot costs a slot. The component *has* that state; whether it renders is a
separate question. Trading a correctness rule for an allocation you cannot measure is a
bad trade in both directions.

## Shape 2 — the hook inside a condition

```jsx
// 🔴
function Chart({ live, data }) {
  if (live) {
    const stream = useLiveData();      // hook count varies with a prop
    return <Line data={stream} />;
  }
  return <Line data={data} />;
}
```

**Fix A — always call it, and let the argument carry the condition.** This is why so many
well-designed hooks accept a null-ish argument to mean "do nothing":

```jsx
// ✅ the hook is always called; the argument decides whether it does anything
function Chart({ live, data }) {
  const stream = useLiveData({ enabled: live });
  return <Line data={live ? stream : data} />;
}
```

Inside, `useLiveData` returns early *within its effect*, exactly as shape 1 does — and
[Phase 7 · 07 · 05](07-the-standard-set/05-timers-and-lifecycle.md)'s `useInterval(cb,
null)` pause is the same idea. **This is a hook API design decision**, which is why
[Phase 7 · 06](06-designing-a-hooks-api/README.md) comes before this page: a hook that
cannot be told to stand down forces its callers into a rule violation.

**Fix B — split the component.** Correct when the two branches genuinely differ in more
than a flag:

```jsx
// ✅ two components, two sets of hooks, neither conditional
function Chart({ live, data }) {
  return live ? <LiveChart /> : <StaticChart data={data} />;
}

function LiveChart()        { const stream = useLiveData(); return <Line data={stream} />; }
function StaticChart({data}){ return <Line data={data} />; }
```

Nothing here is conditional from React's point of view. `Chart` calls no hooks;
`LiveChart` always calls one; `StaticChart` always calls none. The condition became a
**rendering** decision, which is what conditions are for.

Note what this buys beyond legality, and it is the reason to prefer it when the branches
diverge: `LiveChart` and `StaticChart` are different component *types*, so React unmounts
one and mounts the other when `live` flips —

> **Toggling `isPaused` replaces `<Counter>` with `<p>`.** React removes the Counter from
> the tree and destroys its state.

— which means the live subscription is torn down properly and no stale state survives the
switch. The conditional-hook version would have had to manage that by hand.

## Shape 3 — the hook in a loop

The most dangerous, because it looks like ordinary React and its hook count tracks the
*data*:

```jsx
// 🔴 one hook per item — the count changes whenever the list does
function Cart({ items }) {
  return items.map((item) => {
    const [qty, setQty] = useState(item.qty);      // 🔴
    return <Row key={item.id} qty={qty} onChange={setQty} />;
  });
}
```

**The fix is always the same: a component per item.** The unit that owns hooks is a
component, so if each item needs its own state, each item needs its own component.

```jsx
// ✅
function Cart({ items }) {
  return items.map((item) => <CartRow key={item.id} item={item} />);
}

function CartRow({ item }) {
  const [qty, setQty] = useState(item.qty);        // ✅ one component, one hook
  return <Row qty={qty} onChange={setQty} />;
}
```

This is also the *right* structure for a reason unrelated to the rules:

> React keeps track of which state belongs to which component **based on their place in
> the UI tree**.

> **It's the position in the UI tree — not in the JSX markup — that matters to React!**

Each `CartRow` occupies its own position and owns its own state, so removing the second
item removes the second row's state rather than shifting everyone's state up by one.
Getting the `key` right is what makes that work
([Phase 3 · 14](../phase-3-state/14-state-in-lists.md)).

## When the variants really are different components

Sometimes the honest answer is that one component is doing two jobs. The pattern for that
is a thin wrapper that decides, plus siblings that each declare their own needs:

```jsx
function Editor({ mode, docId }) {
  return mode === 'review'
    ? <ReviewEditor key={docId} docId={docId} />
    : <DraftEditor  key={docId} docId={docId} />;
}
```

The `key` is doing deliberate work here:

> **Specifying a `key` tells React to use the `key` itself as part of the position**,
> instead of their order within the parent. This way, even though you render them in the
> same place in JSX, React sees them as two different counters, and so they **will never
> share state.**

So switching documents remounts the editor and discards its state, without a single
`useEffect` written to reset anything — the alternative approach that
[Phase 3 · 07](../phase-3-state/07-resetting-state-with-key.md) and
[Phase 4 · 06](../phase-4-effects/06-you-might-not-need-an-effect/README.md) both
recommend against.

## What is *not* a fix

| Attempt | Why it fails |
|---|---|
| Keeping the hook count equal in both branches (`if (a) useX() else useY()`) | The *order* changed. React only compares counts, so this passes both runtime checks and corrupts state silently — [Phase 7 · 05 · 01](05-why-the-rules-exist/01-the-array-and-the-index.md) |
| `const value = cond ? useA() : useB()` | The same thing with a ternary. The linter catches it; the mechanism does not care about syntax |
| Calling the hook inside `try` | A block whose completion is conditional; on the 🔴 list for that reason |
| Extracting the conditional part into a custom hook | A custom hook is inlined into the caller's slot list — you moved the violation, you did not remove it |
| An `eslint-disable` on the rules-of-hooks rule | The rule is not a style preference; the failure it prevents is silent wrong state |

The last two are worth dwelling on. **Extraction does not help**, because the hooks inside
a custom hook take slots in the *calling component*
([Phase 7 · 03 · 01](03-share-logic-not-state/01-two-callers-two-states.md)). Wrapping
`if (live) useLiveData()` in `useMaybeLiveData(live)` changes nothing except where the
bug is written.

**And the one real exception is `use`** — it may be called inside a condition or a loop,
by design. That is not a loophole for other hooks, and
[Phase 7 · 10](10-use-breaks-the-rule.md) explains why it is safe when `useState` is not.

## Gotchas

**Symptom:** "Rendered fewer hooks than expected" after adding a guard clause.
**Cause:** hooks now sit below a conditional `return`.
**Fix:** hooks above the guard; move the condition inside the effect.

**Symptom:** a list works until an item is removed, then rows show each other's state.
**Cause:** hooks called in a `.map`, so the slot list shifts with the data.
**Fix:** a component per item, with a stable `key`.

**Symptom:** no error, but state is wrong after a branch flips.
**Cause:** both branches call a hook, so the count matches and the runtime check passes —
but the order changed.
**Fix:** unconditional hooks. React cannot catch this one for you.

**Symptom:** the conditional hook is extracted into a custom hook and the error persists.
**Cause:** custom hooks are inlined into the caller's slot list.
**Fix:** the violation is at the call site, wherever it is written.

**Symptom:** a subscription keeps running after switching to the static variant.
**Cause:** the conditional-hook version never unmounts anything, so nothing tears down.
**Fix:** split into two components — different types at the same position destroy the old
state and run cleanup.

**Symptom:** a hook cannot be told to do nothing, so callers wrap it in an `if`.
**Cause:** an API gap, not a caller mistake.
**Fix:** give the hook an `enabled` flag or a null-ish argument, and return early inside
its effect.

## Interview questions

**★ A component needs a hook only when a prop is true. What do you do?**
Never call it conditionally. Either call it unconditionally and let an argument carry the
condition — an `enabled` flag or a null delay, with the early return inside the hook's
effect — or split into two components so each always calls exactly the hooks it needs.
The choice is about how much the branches diverge: a flag when they differ by one input,
separate components when they differ in structure.

**★ Why is splitting the component the better fix when the branches diverge?**
Because the condition becomes a rendering decision rather than a hook decision, and React
handles the rest. Different component types at the same position cause React to destroy
the old subtree's state and run its cleanup, so a live subscription is torn down properly
when you switch to the static variant. The conditional-hook version would have to manage
that by hand.

**★ Hooks are called in a `.map` over a list. Why is that the worst version?**
Because the hook count tracks the data rather than the code, so it changes whenever the
list does — which is on every load. The fix is a component per item, which is also the
structurally correct answer: React tracks state by position in the UI tree, so each row
owning its own component means removing an item removes that row's state rather than
shifting everyone's.

**★ Someone keeps the hook count equal in both branches. Is that safe?**
No, and it is worse than the version that throws. React compares only the number of hooks
between renders, so an `if`/`else` with one hook in each branch passes both runtime
checks while the *order* changes — the state pairs are matched to the wrong variables
silently. The error is a courtesy, not the protection.

**Does extracting the conditional call into a custom hook fix anything?**
No. A custom hook has no storage of its own; the hooks inside it take slots in the
calling component's list. Wrapping `if (cond) useX()` in a `useMaybeX(cond)` relocates
the code and leaves the violation exactly where it was.

**Is there any hook that may be called conditionally?**
`use`, by design — it may appear inside conditions and loops. It is a deliberate
exception rather than a loophole, because it does not allocate a slot the way `useState`
does, and every other hook still obeys the rule.

---

← Prev: [Hooks that wrap effects](08-hooks-that-wrap-effects/README.md) ·
Index: [Phase 7](README.md) ·
Next → [`use` breaks the rule on purpose](10-use-breaks-the-rule.md)
