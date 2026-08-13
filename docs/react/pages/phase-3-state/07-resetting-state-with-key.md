---
title: "Resetting state with key"
sidebar_label: "07 · Resetting state with key"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
> and [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> §*Resetting all state when a prop changes*. No sandbox script backs this page;
> claims are cited, not measured.

**`key` is not only for lists. It is the one supported way to tell React "this
is a different thing now" — and it replaces an entire family of effects that
reset state by hand.**

## What `key` does to position

State is preserved by *position in the tree*. react.dev:

> Specifying a `key` tells React to use the `key` itself as part of the
> position, instead of their order within the parent.

So a changed key at a given slot is, as far as reconciliation is concerned, a
different position. The old component unmounts, a new one mounts, and everything
below it starts fresh.

```jsx
<Chat key={to.id} contact={to} />
```

When `to.id` changes, React tears down the old `Chat` and builds a new one. The
half-typed message is gone — which is the requirement, not a side effect.

## The pattern it replaces

react.dev's own before-and-after:

```jsx
// 🔴 Avoid: Resetting state on prop change in an Effect
export default function ProfilePage({userId}) {
  const [comment, setComment] = useState('');
  useEffect(() => {
    setComment('');
  }, [userId]);
}
```

> This is inefficient because `ProfilePage` and its children will first render
> with the stale value, and then render again.

```jsx
// ✅ Good: Use a `key` to reset state
export default function ProfilePage({userId}) {
  return <Profile userId={userId} key={userId} />;
}

function Profile({userId}) {
  // ✅ This and any other state below will reset on key change automatically
  const [comment, setComment] = useState('');
}
```

> By passing `userId` as a `key` to the `Profile` component, you're asking React
> to treat two `Profile` components with different `userId` as two different
> components that should not share any state. Whenever the key changes, React
> will recreate the DOM and reset the state of the `Profile` component **and all
> of its children**.

Three advantages over the effect, and all three matter:

- **No stale frame.** The effect version renders once with the previous user's
  comment on screen. The key version never does.
- **It reaches the whole subtree.** The effect resets the one state variable it
  names. The key resets everything below, including state in children you have
  never heard of.
- **It cannot be forgotten.** Add a fourth state variable to `Profile` and the
  effect version needs a fourth `setX('')`. The key version needs nothing.

Note the structural requirement in the fix: the key goes on a **child**, not on
the component reading the prop. `ProfilePage` renders `<Profile key={userId}>`.
You cannot key a component from inside itself, so this often means introducing a
thin wrapper — which is a real cost and the main reason people reach for the
effect instead.

## What a key change actually does

The same full unmount/mount as any type change, and it is worth having the list
in mind before choosing this over a narrower fix:

| | Effect |
|---|---|
| `useState` / `useReducer` | Reinitialised |
| `useRef` | Recreated — `current` back to the initial value |
| Effect cleanups | All run, in the outgoing subtree |
| DOM nodes | Removed and recreated — not patched |
| Focus | Lost, because the focused element no longer exists |
| Scroll position inside | Reset |
| CSS transitions / animations | Restart from mount |
| Uncontrolled input values | Lost with their DOM nodes |
| Children | All of it, recursively |

**Focus loss is the one that bites in forms.** Keying a form on the record id and
then changing records mid-typing removes the focused input. If the user can
change the key while interacting, restore focus in a mount effect or reconsider
the boundary.

## Choosing the key

The key must change **exactly when the identity of the thing changes** — no more
often, no less.

```jsx
<EditForm key={record.id} record={record} />        // ✅ identity
<EditForm key={JSON.stringify(record)} … />          // 🔴 remounts on every edit
<EditForm key={Math.random()} … />                   // 🔴 remounts every render
<EditForm key={index} … />                           // 🔴 identity is not position
```

The `Math.random()` case is worth calling out because it appears in real
codebases as a "force refresh" trick. It remounts on every parent render,
destroying state constantly — the same damage as
[the nesting bug](../phase-2-components/01-function-components/02-identity-and-nesting.md),
just written deliberately.

For a composite identity, join the parts that make it distinct:

```jsx
<Editor key={`${docId}:${revision}`} />
```

And a deliberately incrementing key is a legitimate "reset now" button:

```jsx
const [resetCount, setResetCount] = useState(0);
<Form key={resetCount} />
<button onClick={() => setResetCount(c => c + 1)}>Start over</button>
```

## `key` versus the alternatives

| Goal | Use |
|---|---|
| Reset **all** state below when an identity changes | **`key`** |
| Reset **one** value when a prop changes | Set state during render, conditionally ([topic 16](16-updating-state-during-render.md)) |
| Have the value follow the prop always | Don't store it — derive it ([topic 06](06-derived-state.md)) |
| Reset in response to a user action | An event handler calling the setters |

The ordering to internalise: **derive if you can, key if you must reset
everything, adjust-during-render only for the narrow partial case, and never an
effect.**

There is a real cost to `key` that keeps it from being the answer to everything:
it throws away DOM nodes. For a large subtree that mostly did not change, a
remount is more expensive than an update, and any uncontrolled DOM state
(scroll, focus, media playback position) goes with it. Use it when a *reset* is
what you actually want, not as a general-purpose refresh.

## The other `key`: lists

Same mechanism, different intent. In a list, keys tell React which item is which
across reorders so it can *preserve* state correctly rather than reset it.
[Phase 1's lists and keys](../phase-1-jsx/07-lists-and-keys.md) has the measured
behaviour — including that index keys do not remount, they attach the wrong data
to the right node — and [topic 14](14-state-in-lists.md) covers how position and
key together decide which instance keeps which state.

The unifying idea: **a key is a promise about identity.** In a list you are
saying "this row is the same row it was". With a resetting key you are saying
"this is not the same thing any more". React does the same reconciliation in
both cases.

## Gotchas

**Symptom:** a form keeps the previous record's values.
**Cause:** the same component at the same position, so state is preserved by
design.
**Fix:** `key={record.id}` on it, from the parent.

**Symptom:** a form clears itself while the user is typing.
**Cause:** the key changes more often than the identity — a `JSON.stringify`
key, an object literal, or a value that updates on each keystroke.
**Fix:** key on a stable id.

**Symptom:** the input loses focus whenever the key changes.
**Cause:** the DOM node was destroyed; focus went with it.
**Fix:** expected. Restore focus in a mount effect, or key at a boundary the
user is not interacting with.

**Symptom:** a video restarts, or a scroll position resets, on an unrelated
update.
**Cause:** an unstable key remounting the subtree.
**Fix:** find the key. `Math.random()` and inline object keys are the usual
suspects.

**Symptom:** you cannot apply the key because the state is in the same component
that receives the prop.
**Cause:** a component cannot key itself.
**Fix:** extract the stateful part into a child and key that child — which is
exactly the shape of react.dev's `ProfilePage`/`Profile` example.

**Symptom:** an effect exists purely to clear fields when an id changes.
**Cause:** the pattern `key` replaces.
**Fix:** delete the effect, add the key. Fewer renders and it covers state you
did not enumerate.

## Interview questions

**★ How does `key` reset state?**
By becoming part of the position. React preserves state for a component rendered
at the same position with the same type; specifying a key tells React to use the
key as part of that position instead of the order within the parent. A changed
key is therefore a different position, so the old subtree unmounts and a new one
mounts with fresh state — all the way down.

**★ Why is `key` better than an effect that resets the fields?**
The effect version renders once with the stale value before the effect runs, so
there is a real frame of wrong UI on screen. It only resets the variables it
names, so state in children is missed and new state variables have to be added
to it. `key` has no stale frame, covers the entire subtree, and needs no
maintenance.

**★ What does a key change destroy?**
Everything in the subtree: state, refs, DOM nodes, focus, scroll position,
running CSS animations and uncontrolled input values — and every effect cleanup
runs. That is why it is the right tool when a reset is genuinely wanted and the
wrong one as a general refresh mechanism.

**What makes a good reset key?**
Something that changes exactly when the identity of the thing changes — usually
a record id, or a composite like `` `${docId}:${revision}` ``. Bad keys change
too often: `JSON.stringify(record)` remounts on every edit, `Math.random()`
remounts on every render, and an index is position rather than identity.

**Why can't a component key itself?**
Because the key is part of how its *parent* identifies it during
reconciliation — it lives on the element, which the parent creates. Resetting a
component's own state from a prop change therefore means extracting the stateful
part into a child and keying that, which is exactly what react.dev's
`ProfilePage` / `Profile` example does.

**Is this the same `key` as in lists?**
Yes, the same mechanism with the opposite intent. In a list, keys let React
preserve the right state across reorders; as a reset, a changing key tells React
this is a different thing. Both are promises about identity, resolved by the
same reconciliation rule.

---

← Prev: [Derived state](06-derived-state.md) · Index: [Phase 3](README.md) · Next → [What triggers a re-render](08-what-triggers-a-re-render.md)
