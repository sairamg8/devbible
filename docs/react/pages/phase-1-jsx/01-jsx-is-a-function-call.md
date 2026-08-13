---
title: "JSX is a function call"
sidebar_label: "01 · JSX is a function call"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react 19.2.8** and **@babel/preset-react 7.29.7**.
> Every compiled snippet below is real Babel output, printed by
> `sandbox/react-p1/ex01-jsx-is-a-call.mjs`.

**JSX is syntax for one function call. Nothing more. Every confusing thing
about it — why `key` is not a prop, why `class` is spelled `className`, why a
lowercase component silently becomes an HTML tag — is a consequence of what the
compiler emits.**

Your bundler never ships JSX. It ships calls.

## The transform, printed

```console
$ node ex01-jsx-is-a-call.mjs

=== 1. automatic runtime (the default since React 17) ===
import { jsx as _jsx } from "react/jsx-runtime";
const el = /*#__PURE__*/_jsx("h1", {
  className: "title",
  children: "Hello"
});
```

Read that carefully, because four rules are visible in six lines:

1. **The tag becomes the first argument.** `"h1"` — a *string*, because `h1` is
   lowercase. See [Capitalization](05-capitalization.md).
2. **Every attribute becomes a property of one object** — the props object.
3. **`children` is a prop like any other.** Nesting is sugar for a `children`
   key.
4. **The import is injected for you.** That is the "automatic runtime", and it
   is why `import React from 'react'` is no longer required in a JSX file.

`/*#__PURE__*/` is a hint to the minifier that the call has no side effects, so
an unused element can be dropped from the bundle.

## `jsx` vs `jsxs`

```console
=== 2. one child vs many children — jsx vs jsxs ===
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const el = /*#__PURE__*/_jsxs("ul", {
  children: [/*#__PURE__*/_jsx("li", {
    children: "a"
  }), /*#__PURE__*/_jsx("li", {
    children: "b"
  })]
});
```

Two functions, not one. `jsxs` — "s" for static children — tells React the
children array was written literally in the source, so it cannot be a dynamic
list and does not need a key check. That is the entire difference, and it is
why a hand-written list of siblings never asks you for keys while
`items.map(...)` always does.

It is also why `props.children` is sometimes an element and sometimes an array:
the *compiler* decided, based on how many children you typed. See
[children](09-children.md).

## Where `key` goes

```console
=== 3. where `key` goes ===
const el = /*#__PURE__*/_jsx("li", {
  className: "row",
  children: name
}, id);
```

`className` went into the props object. `key` went into a **third argument**.
It is not in props, was never in props, and this is the mechanical reason
`props.key` is not a thing. `ref` is the other name with special handling —
though since React 19 `ref` *is* an ordinary prop again.

## Components: the function itself is the type

```console
=== 4. a component: the function itself is the type ===
const el = /*#__PURE__*/_jsx(Greeting, {
  name: "Ada"
});

=== 5. a fragment ===
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
const el = /*#__PURE__*/_jsxs(_Fragment, {
  children: [/*#__PURE__*/_jsx("a", {}), /*#__PURE__*/_jsx("b", {})]
});
```

`_jsx(Greeting, {...})` passes the **function value**, not a string and not a
call. `Greeting` has not run. It runs when React renders the element — which is
why defining a component inside another component remounts it every time: a new
function object is a new `type`.

`<>…</>` compiles to the same call with `Fragment` as the type. A fragment is
an ordinary element whose renderer knows to emit nothing of its own.

## Development mode adds arguments

```console
=== 6. development mode — jsxDEV and its extra arguments ===
var _jsxFileName = "…/sandbox/react-p1/demo.jsx";
import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
const el = /*#__PURE__*/_jsxDEV("h1", {
  className: "title",
  children: "Hello"
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 1,
  columnNumber: 12
}, this);
```

A different function from a different entry point, carrying the file, line and
column. That is where "Check the render method of `NoKey`" and the clickable
source links in React DevTools come from — and it is why a production build
gives you worse error messages. It is not a setting you can turn on in
production; the calls themselves are different.

```console
=== 10. what react/jsx-runtime actually exports ===
  react/jsx-runtime              Fragment default jsx jsxs module.exports
  react/jsx-dev-runtime          Fragment default jsxDEV module.exports
  jsx === jsxs                   false
  jsx === React.createElement    false
  jsx.length (declared args)     3
  jsxDEV.length (declared args)  4
```

Two entry points, three functions. (`module.exports` in that list is an
artifact of the CommonJS build being read from ESM, not a real export.)

Note `jsxDEV.length` is **4** while Babel passes **six** arguments plus `this`.
Extra arguments are legal in JavaScript; React reads them positionally inside.
Do not conclude from an arity that an argument is unused.

## `jsx()` and `createElement()` produce the same thing

```console
=== 11. the two calls produce the same element ===
  jsx()   type/key          h1 / null
  createElement() type/key  h1 / null
  same props?               true
  props of jsx()            {"className":"title","children":"Hello"}

=== 12. createElement is still exported in 19.2.8 ===
  React.createElement  function
  React.Fragment       Symbol(react.fragment)
  react version        19.2.8
```

`createElement` has not been removed. It is still the documented escape hatch
for code that has no build step. The automatic runtime is a **compiler**
change, not a React API change — which is why upgrading React never breaks JSX,
and changing your bundler sometimes does.

## What this buys you when reading errors

| What you see | What it means |
|---|---|
| `_jsx is not defined` | The JSX transform did not run — a `.js` file the bundler treats as plain JS, usually |
| `React is not defined` | The **classic** transform ran, and `React` is not imported. See [the classic runtime](15-the-classic-runtime.md) |
| `Element type is invalid … got: undefined` | The first argument was `undefined` — a bad import, usually default vs named |
| `Objects are not valid as a React child` | Something landed in the `children` prop that React cannot turn into text |

## Gotchas

**Symptom:** `ReferenceError: React is not defined` in one file only, in a
project that never imports React anywhere else.
**Cause:** that file is being compiled with the classic runtime — often a stray
`/** @jsx */` pragma, or a second Babel config for a subdirectory.
**Fix:** remove the pragma, or set the transform to `automatic` for that path.

**Symptom:** a component renders fine in development and its error messages
become useless in production.
**Cause:** production emits `jsx`, not `jsxDEV`. There is no file, line or
column in the element.
**Fix:** expected. Reproduce with a development build; do not ship one.

**Symptom:** `props.key` is `undefined` in a component that clearly received a
`key`.
**Cause:** `key` compiles to the third argument, not into props. It never
reaches your component.
**Fix:** pass the value twice if the component needs it —
`<Row key={id} id={id} />`.

**Symptom:** a minifier removes an element you created for its side effect.
**Cause:** `/*#__PURE__*/` tells it the call is side-effect free.
**Fix:** creating an element is not how you run code. Render it, or call the
function.

## Interview questions

**★ What does JSX compile to?**
A single function call per element: `jsx(type, props, key)` from
`react/jsx-runtime` with the automatic runtime, or `React.createElement(type,
props, ...children)` with the classic one. The tag becomes the first argument —
a string for host elements, the function itself for components — and every
attribute becomes a key in the props object, with nesting becoming
`props.children`.

**★ Why don't you need to `import React` any more?**
Since React 17 the automatic runtime makes the compiler inject
`import { jsx } from "react/jsx-runtime"` itself. `React` is no longer
referenced by the emitted code. It is a compiler change, not a React change —
`React.createElement` still exists in 19.2.8.

**★ Why is `key` not available as a prop?**
Because it is compiled into a separate argument position, outside the props
object. Measured above: `<li key={id} className="row">` emits
`_jsx("li", {className, children}, id)`.

**What is the difference between `jsx` and `jsxs`?**
`jsxs` is emitted when the children were written literally in the source, so
React knows the array is static and skips the key check. `jsx` is emitted for
zero or one child, or for a dynamic expression.

**What is `jsxDEV` and why does it matter?**
The development-only variant, from `react/jsx-dev-runtime`, which receives the
file name, line and column of the element. It is the source of React's
"Check the render method of X" messages and DevTools source links.

**If JSX is just a function call, can you write React without it?**
Yes — call `createElement` directly, or use the `jsx` runtime functions. It is
what the compiler does anyway. No-build-step pages and some code generators do
exactly this.

---

Index: [Phase 1](README.md) · Next → [Embedding expressions](02-embedding-expressions.md)
