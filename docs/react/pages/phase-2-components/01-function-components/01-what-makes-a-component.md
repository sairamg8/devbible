---
title: "What makes a function a component"
sidebar_label: "01 · What makes a component"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Your First Component](https://react.dev/learn/your-first-component),
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
> and [Rules of React — Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure).
> No sandbox script backs this page; claims are cited, not measured — see the
> phase index for the full source list.

**A component is a function you never call. You hand React the function and
React calls it — and everything that separates a component from a helper
function follows from that one difference.**

## The definition, and what it leaves out

react.dev's definition is deliberately small:

> React components are regular JavaScript functions except:
>
> 1. Their names always begin with a capital letter.
> 2. They return JSX markup.

Both halves are load-bearing and neither is enforced by the language.

**The capital letter is a JSX compilation rule, not a convention.** Phase 1
covered the mechanism: `<profile />` compiles to `_jsx("profile", …)` — a
string, meaning "an HTML tag called `profile`" — while `<Profile />` compiles to
`_jsx(Profile, …)`, a reference to your function. Lowercase does not produce an
error. It produces an unknown DOM element, silently, and your component never
runs. This is the single most expensive one-character mistake in React.

**"Returns JSX markup" is looser than it sounds.** A component may return a
string, a number, `null`, an array, a fragment, or a promise — Phase 1's
[What can be rendered](../../phase-1-jsx/03-what-can-be-rendered.md) covers the
full set. What it may *not* do is return `undefined` by falling off the end of
the function, which is nearly always a missing `return` in front of a multi-line
JSX expression.

## The real definition: who calls it

The rule that actually distinguishes a component from a helper is not in the
name or the return type. It is this:

> **A component is a function React calls. A helper is a function you call.**

```jsx
function formatName(user) {            // helper — you call it
  return `${user.first} ${user.last}`;
}

function UserName({user}) {            // component — React calls it
  return <span>{formatName(user)}</span>;
}
```

`formatName` runs when your code reaches it. `UserName` runs when React decides
to render it, however many times React decides to, in whatever order React
chooses, possibly twice in development, possibly interrupted and restarted, and
possibly never — if the element is created but a parent bails out before
committing it.

Everything downstream comes from that. React owns the call, so React can:

| React owns | Which is why |
|---|---|
| **When** the function runs | Renders can be batched, deferred, or thrown away |
| **How often** it runs | `StrictMode` double-invokes to expose impurity |
| **The identity** it is filed under | State and effects can be attached to it |
| **Its position** in a tree | State survives a re-render at the same position |

A helper function has no position, no identity in the tree, and no state. That
is the whole difference, and it explains the next section.

## `<Profile />` and `Profile()` are not the same thing

This is the highest-value distinction in the phase, because both compile, both
render the same pixels, and only one of them is a component.

```jsx
function Parent() {
  return (
    <>
      <Profile user={a} />   {/* an ELEMENT — React calls Profile */}
      {Profile({user: a})}   {/* a CALL — you call Profile, right now */}
    </>
  );
}
```

`<Profile />` compiles to `_jsx(Profile, {user: a})`, which builds a plain
object describing *what to render* and hands it to React. React then mounts a
fiber for it, calls `Profile`, and files the result under that position.

`{Profile({user: a})}` calls the function immediately, during `Parent`'s render,
and embeds whatever it returned. React never sees `Profile` at all — only the
JSX it produced, which looks to React as though `Parent` wrote it inline.

The consequences are not cosmetic:

| | `<Profile />` | `{Profile()}` |
|---|---|---|
| Owns state | Yes — its own `useState` slots | No — its hooks join **`Parent`'s** list |
| Appears in DevTools | Yes, as `Profile` | No — invisible |
| Can be memoized | Yes | No |
| Can suspend independently | Yes | No — suspends `Parent` |
| Re-renders when its props change | Alone | Only when `Parent` re-renders |
| `key` works | Yes | Meaningless |

The hooks consequence is the dangerous one. Hooks are matched to a component by
**call order within one render**, so a directly-called function that uses hooks
does not have "its own" hooks — it appends them to whichever component was
rendering. Call it conditionally and the caller's hook order changes between
renders, which is exactly the failure the Rules of Hooks exist to prevent. The
error you get (`Rendered fewer hooks than expected`) points at the caller, not
at the function that caused it.

The one legitimate use of a direct call is a function that is *not* a component:
a plain helper returning JSX with no hooks and no state of its own. If it has
neither, calling it is fine and slightly cheaper. Name it in lowercase
(`renderRow`, not `Row`) so the next reader knows which it is.

## Props are one argument, always

A component receives exactly one argument. There is no second parameter, no
variadic props, no `arguments`-style access — with one exception added in
React 19, `ref`, which is now an ordinary key inside that same object
([topic 09](../09-ref-as-a-prop.md)).

```jsx
function Avatar(props) {          // the whole props object
  return <img src={props.src} width={props.size} />;
}

function Avatar({src, size}) {    // destructured — same thing
  return <img src={src} width={size} />;
}
```

Destructuring in the parameter list is the house style in the React
documentation and in nearly all modern code, for two reasons that are worth
naming rather than assuming:

1. **It documents the component's interface in its signature.** You can read
   what a component consumes without scanning the body.
2. **It is where default values now live.** `defaultProps` was removed for
   function components in React 19; ES6 default parameters replaced it entirely
   ([topic 07](../07-destructuring-and-defaults.md)).

The props object itself is created fresh by JSX on every render, so identity
comparisons on `props` are always `false` — that is expected, not a bug, and it
is why memoization compares *keys*, not the object.

## What a component must not do

The Rules of React attach three obligations to the function once you declare it
a component. Each gets its own treatment later, but they belong in the
definition:

- **It must be pure while rendering.** Same props, same state, same context →
  same JSX, and no writes to anything that existed before the call
  ([topic 02](../02-purity/README.md)).
- **It must call hooks unconditionally, at the top level.** No hooks in
  branches, loops, or nested functions. React matches hooks to slots by call
  order alone.
- **It must not be redefined between renders.** Its identity is what React uses
  to decide whether to keep or destroy the subtree
  ([next chunk](02-identity-and-nesting.md)).

Notice that none of these are about what it returns. React is far more
interested in *how the function behaves when called repeatedly* than in the
markup it produces.

## Where components live

Two conventions that are not enforced but are near-universal, and both have a
reason beyond taste:

**One component per named export, declared at module top level.** The nesting
rule in the next chunk makes top-level declaration mandatory for correctness,
not just tidiness — a component defined inside another function is a new
function on every render.

**Several small components in one file is fine.** react.dev explicitly permits
it: a file may declare as many components as it likes, exporting one as default
and the rest as needed. Splitting a component into its own file the moment it
exists is the more common mistake — see
[component boundaries](../10-component-boundaries.md) for when a split earns
its import.

## Gotchas

**Symptom:** the component renders nothing and there is no error.
**Cause:** it was written or used in lowercase, so JSX emitted a string tag and
React created an unknown DOM element instead of calling your function.
**Fix:** capitalise both the declaration and every use site. TypeScript does not
catch this — `<profile />` is a valid intrinsic element as far as JSX is
concerned, though `@typescript-eslint` and the React ESLint plugin will flag an
unknown element.

**Symptom:** `Nothing was returned from render` or a blank subtree.
**Cause:** a multi-line JSX expression after `return` on its own line —
JavaScript's automatic semicolon insertion terminates the statement and the
function returns `undefined`.
**Fix:** put the opening parenthesis on the `return` line: `return (`.

**Symptom:** `Rendered fewer hooks than expected` pointing at a component that
looks fine.
**Cause:** it calls another hook-using function directly (`{Sidebar()}`) instead
of rendering it (`<Sidebar />`), and that call is conditional.
**Fix:** render it as an element. The rule of thumb: if it uses hooks or holds
state, it is a component and must be rendered, never called.

**Symptom:** state disappears when a parent updates something unrelated.
**Cause:** the component is defined inside another component — covered in full
in the [next chunk](02-identity-and-nesting.md).
**Fix:** move the declaration to module top level.

## Interview questions

**★ What actually makes a function a React component?**
That React calls it rather than you. The capital letter is what makes JSX emit
a reference to the function instead of a string tag, and returning renderable
output is what makes the result usable — but the defining property is that React
owns the call. That ownership is what lets React attach state, effects, a
position in the tree and an identity to it. A function you call yourself gets
none of those.

**★ What is the difference between `<Widget />` and `Widget()`?**
`<Widget />` creates an element — a description React mounts as its own unit,
with its own state, its own place in DevTools, its own memoization boundary and
its own ability to suspend. `Widget()` runs the function immediately during the
caller's render and inlines the result; React never knows `Widget` existed. Any
hooks inside it become part of the *caller's* hook list, so the call order
breaks the moment the call is conditional.

**★ Can a component return something other than JSX?**
Yes — strings, numbers, `null`, arrays, fragments and (in React 19) promises are
all valid. Returning `undefined` is the one thing that errors, and it is almost
always an accidental ASI bug after a bare `return`.

**Why must hooks be called at the top level of a component?**
React has no way to identify a hook other than the order it was called in during
that render. There is no name, no key — just position in a list attached to the
fiber. A conditional hook shifts every subsequent hook by one slot, so the
second render reads `useState`'s value out of `useEffect`'s slot.

**Is it acceptable to define more than one component in a file?**
Yes, and it is common. The rule that matters is that each is declared at module
top level, not nested inside another component's body. Whether they share a file
is a readability question; whether they are nested is a correctness one.

**What is the props object, and can you mutate it?**
It is a single plain object that JSX builds fresh for each render, holding every
attribute you passed plus `children`. You must not mutate it — props are
immutable by contract, and the parent is the only thing that can supply new ones
([topic 06](../06-props-are-read-only.md)).

---

← Index: [Function components](README.md) · Next → [Component identity and the nesting rule](02-identity-and-nesting.md)
