---
title: "Conditional rendering"
sidebar_label: "06 · Conditional rendering"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**,
> production build. Both console blocks are printed by
> `sandbox/react-p1/ex05-conditional.mjs`.

**There is no `if` in JSX, so conditions are expressions: a ternary, `&&`, an
early `return null`, or a lookup object. Which one you pick changes two things —
what appears on screen when the condition is falsy, and whether the component
underneath keeps its state.**

The second one is the part that gets skipped.

## The `&&` trap, measured

`a && b` returns **`a`** when `a` is falsy — it does not return `false`. So
whatever falsy value you had lands in the tree, and React renders the ones that
are not `null`, `undefined` or a boolean:

```console
$ node ex05-conditional.mjs
=== conditional rendering (production build) ===
  --- what the left side of && leaves on screen ---
  [].length      (0) && <b>YES</b>  "<span>0</span>"
  [1,2].length   (2) && <b>YES</b>  "<span><b>YES</b></span>"
  ''             (empty string) && <b>YES</b>"<span></span>"
  "hi" && <b>YES</b>                "<span><b>YES</b></span>"
  0 && <b>YES</b>                   "<span>0</span>"
  NaN && <b>YES</b>                 "<span>NaN</span>"
  null && <b>YES</b>                "<span></span>"
  undefined && <b>YES</b>           "<span></span>"
  false && <b>YES</b>               "<span></span>"
  -0 && <b>YES</b>                  "<span>0</span>"
  0n (bigint) && <b>YES</b>         "<span>0</span>"
```

Four of the eleven leave something visible: `0`, `NaN`, `-0` and `0n`. Every
one of them is a **number**, and the overwhelmingly common source of a number
on the left of `&&` is `.length`.

```console
  --- the four ways to write the same condition ---
  items.length && <List/>           "<span>0</span>"
  items.length > 0 && <List/>       "<span></span>"
  !!items.length && <List/>         "<span></span>"
  items.length ? <List/> : null     "<span></span>"
```

That is the whole bug: a `0` in the corner of an otherwise empty page.

**The rule: put a boolean on the left of `&&`.** `> 0`, `!!`, `Boolean(...)`,
or a comparison. Never a raw `.length`, a count, or an index.

`''` is safe (it renders nothing), but relying on that means the safety of your
code depends on which falsy value you happened to have — so make it boolean
anyway.

## The four forms

```jsx
{isLoggedIn && <Dashboard />}                    // 1. && — render or nothing
{isLoggedIn ? <Dashboard /> : <Login />}         // 2. ternary — one or the other
if (!user) return null;                          // 3. early return — whole component
{ {idle: <Idle/>, loading: <Spin/>, error: <Err/>}[status] }   // 4. lookup
```

| Form | Use when | Avoid when |
|---|---|---|
| `&&` | one branch renders nothing | the left side is a number |
| ternary | both branches render something | it nests — two levels is already unreadable |
| early `return null` | the *whole* component should not render | you still need a wrapper or hooks below the return |
| lookup object | three or more states keyed by one value | branches need different props |

A note on the early return: hooks must run in the same order every render, so a
`return null` above a hook is a bug. Put the return **after** every hook call.

For more than three branches, an early return per case is usually clearer than
either nesting ternaries or building an object:

```jsx
function Status({state}) {
  if (state === 'loading') return <Spinner />;
  if (state === 'error')   return <Error />;
  if (state === 'empty')   return <Empty />;
  return <List />;
}
```

## The part people miss: conditionals decide identity

A conditional is a **position in the tree**, and position is what decides
whether a component instance survives. The probe renders four slots, each
holding a `Box` whose instance number is set once and never reset — so a
changed number means the instance was destroyed:

```jsx
{mode === 'a' ? <Box /> : <Box />}        {/* slot 1 */}
{mode === 'a' ? <p><Box /></p> : <Box />} {/* slot 2 */}
{mode === 'a' && <Box />}                 {/* slot 3 */}
{mode === 'a' ? <Box /> : null}           {/* slot 4 */}
```

```console
  --- does the conditional keep state? ---
    mode=a  -> instance #1instance #2instance #3instance #4
    mode=b  -> instance #1instance #5
    mode=a  -> instance #1instance #6instance #7instance #8
    Box instances created: 8
```

Read the first column: **slot 1 stayed `#1` through every switch.** Same
component, same position, different branch — React reuses the instance, and all
its state, refs and effects survive.

Slot 2 went `#2 → #5 → #6`: the branches put `Box` at *different depths*, so
it is a different position, so it remounts every time.

Slots 3 and 4 unmount when the condition is false — that is what "renders
nothing" means — and mount fresh when it comes back: `#3 → (gone) → #7`.

Four slots, three switches, **eight instances**.

### What to do with that

```jsx
// ✗ The input is remounted on every toggle: its DOM state, focus and
//   scroll position are lost.
{isEditing ? <div className="edit"><Input /></div> : <Input />}

// ✓ One position, one instance. The wrapper changes, the input does not.
<div className={isEditing ? 'edit' : 'read'}><Input /></div>
```

And the deliberate opposite — when you *want* the reset, do not fake it with a
conditional; use a `key`:

```jsx
<ProfileForm key={userId} userId={userId} />
```

## Nesting, and when to stop

```jsx
// ✗ nobody can read this
{a ? (b ? <X/> : <Y/>) : (c ? <Z/> : null)}

// ✓ name the branches
function Body({a, b, c}) {
  if (!a) return c ? <Z /> : null;
  return b ? <X /> : <Y />;
}
```

The rule of thumb: **one ternary per expression.** The moment a second appears
inside the first, extract a component or use early returns.

## Gotchas

**Symptom:** a lone `0` appears where an empty list should be.
**Cause:** `{items.length && …}` — `&&` returns the number `0`, which renders.
**Fix:** `{items.length > 0 && …}`.

**Symptom:** the same bug, but with `NaN` on screen.
**Cause:** an arithmetic result on the left of `&&`.
**Fix:** compare it: `{count > 0 && …}`.

**Symptom:** an input loses focus or its typed value every time an unrelated
flag flips.
**Cause:** the two branches of a ternary put the component at different depths,
so it remounts. Measured above: slot 2 remounted on every switch.
**Fix:** keep one position and vary the props or `className`.

**Symptom:** "Rendered fewer hooks than expected" or "Rendered more hooks than
during the previous render".
**Cause:** an early `return` placed above some hook calls, so the number of
hooks changed between renders.
**Fix:** move every hook above every conditional return.

**Symptom:** a modal keeps its stale form contents when reopened.
**Cause:** the conditional `{open && <Modal/>}` does unmount it — but a parent
that keeps `<Modal/>` mounted and hides it with CSS does not.
**Fix:** either unmount it, or `key` it on the thing it edits.

**Symptom:** a ternary's "off" branch renders `false` as text.
**Cause:** it does not — `false` renders nothing. If you see the word "false",
the value is the **string** `"false"`, usually from `String(x)` or a template
literal.
**Fix:** find the stringification.

## Interview questions

**★ Why does `{items.length && <List/>}` render a `0`?**
`&&` evaluates to its left operand when that operand is falsy. With an empty
array the left operand is the number `0`, and React renders numbers as text —
unlike `null`, `undefined` and booleans, which render nothing. Use
`items.length > 0 &&`.

**★ What are the ways to render conditionally in JSX, and when do you use each?**
`&&` when one branch is nothing; a ternary when both branches render; an early
`return null` when the whole component should not render; a lookup object for
three or more states keyed by one value. Nested ternaries are the one to avoid.

**★ Does switching a ternary's branch reset the component's state?**
Only if the position changes. Same component type at the same depth keeps its
instance — measured: `{c ? <Box/> : <Box/>}` kept instance #1 across every
switch. Wrapping one branch in an extra element makes it a different position,
so it remounts.

**Where must an early `return null` go relative to hooks?**
After all of them. Hooks must be called in the same order on every render; a
return above a hook changes the count and throws.

**How do you deliberately reset a subtree when a condition changes?**
Give it a `key` derived from the identity that changed, rather than trying to
express the reset through a conditional.

**Is `{cond || <Fallback/>}` a good idiom?**
Rarely. It renders the fallback when `cond` is falsy, but when `cond` is truthy
it renders `cond` itself — `true` renders nothing, but a truthy string or
number renders. A ternary says what you mean.

---

← Prev: [Capitalization](05-capitalization.md) · Index: [Phase 1](README.md) · Next → [Lists and keys](07-lists-and-keys.md)
