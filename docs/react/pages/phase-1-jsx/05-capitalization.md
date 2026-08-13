---
title: "Capitalization decides everything"
sidebar_label: "05 · Capitalization"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react 19.2.8**, **@babel/preset-react 7.29.7** and
> **Firefox 153.0**. Compiler output and rendered markup both come from
> `sandbox/react-p1/ex04-capitalization.mjs`.

**A lowercase tag compiles to a string. A capitalized tag compiles to the
identifier. That one character decides whether React renders an HTML element or
calls your function — and getting it wrong produces no error.**

## The rule, in the compiler output

```console
$ node ex04-capitalization.mjs
=== 1. what the compiler emits for each spelling ===
import { jsx as _jsx } from "react/jsx-runtime";
const a = /*#__PURE__*/_jsx("button", {});
const b = /*#__PURE__*/_jsx(Button, {});
const c = /*#__PURE__*/_jsx(ui.Button, {});
const d = /*#__PURE__*/_jsx("my-widget", {});
const e = /*#__PURE__*/_jsx(Ui.button, {});
const f = /*#__PURE__*/_jsx(_private, {});
const g = /*#__PURE__*/_jsx($dollar, {});
```

The precise rule Babel applies:

| Spelling | Emits | Why |
|---|---|---|
| `<button>` | `"button"` — a string | starts lowercase |
| `<Button>` | `Button` — the identifier | starts uppercase |
| `<my-widget>` | `"my-widget"` — a string | contains a hyphen: a custom element |
| `<ui.Button>` | `ui.Button` | **any** member expression is an identifier |
| `<Ui.button>` | `Ui.button` | including a lowercase member |
| `<_private>` | `_private` | `_` and `$` are not lowercase letters |
| `<$dollar>` | `$dollar` | same |

Dot notation is the exception worth remembering: `<ui.button />` is a
*component*, because a member expression could never be an HTML tag name.

## What that does at runtime

```console
=== 2. rendered markup (production build) ===
  <Button label="x"/>       <b>COMPONENT: x</b>
  <button label="x"/>       <button label="x"></button>
  <ui.Button label="x"/>    <b>COMPONENT: x</b>
  <my-widget label="x"/>    <my-widget label="x"></my-widget>
```

Line 2 is the bug. `function button()` was defined in the file and never
called. React saw the string `"button"`, created an HTML button, and passed
`label` through as an unknown attribute — which, being a string, is rendered.
**No error, no warning, in either build.** You get an empty native button where
your component should be.

Custom elements work by the same string path: `<my-widget>` reaches the DOM
untouched, attributes and all, which is how React interoperates with web
components.

## The error you *do* get

```console
  <Div/> (undefined var)    THROWS Element type is invalid: expected a string
    (for built-in components) or a class/function (for composite components) but
    got: undefined. You likely forgot to export your component from the file
    it's defined in, or you might have mixed up default and named imports.
```

Capitalized and undefined is a runtime error, because the identifier evaluates
to `undefined`. In production this is `Minified React error #130`. The message
names its own most common cause: default versus named imports.

```jsx
import Button from './Button';    // needs `export default function Button`
import {Button} from './Button';  // needs `export function Button`
```

## The other half of the same mistake

```console
  <Button/> as {Button}     <div></div>
  {Button()} — called       <div><b>COMPONENT: x</b></div>

  [error] Functions are not valid as a React child. This may happen if you
          return Button instead of <Button /> from render. Or maybe you meant
          to call this function rather than return it.
```

`{Button}` — the function in a child slot — renders **nothing** and only warns
in development. `{Button({label: 'x'})}` does render, and is wrong for a
different reason: calling a component directly makes it a plain function call.
It has no fiber, so no state, no hooks of its own, no place in the tree. Write
`<Button label="x" />`.

## Naming rules that follow

- **Components are `PascalCase`.** Always, including one-word names —
  `Card`, not `card`.
- **Files can be named however your project prefers**, but the imported
  *identifier* must be capitalized. `import card from './card'` then
  `<card />` renders an HTML `<card>` element.
- **Destructured or renamed imports keep the rule**:
  `import {button as Button}` is fine; `const {Button: b} = ui` then `<b />`
  renders a bold tag.
- **Namespaces are a clean escape**: `<Icons.chevron />` works with lowercase
  member names, which is why icon and primitive libraries often ship that way.

## Gotchas

**Symptom:** an empty native element appears where your component should be.
**Cause:** the tag is lowercase, so React created a host element and never
called your function.
**Fix:** capitalize the tag. `eslint-plugin-react`'s
`react/no-unknown-property` and TypeScript both catch it; plain JS does not.

**Symptom:** "Element type is invalid … but got: undefined".
**Cause:** the capitalized identifier is `undefined` — a missing export, or
default vs named import mismatch.
**Fix:** check the export style at the source file. The error text says this
verbatim.

**Symptom:** a component renders nothing and development logs "Functions are not
valid as a React child".
**Cause:** `{Component}` instead of `{<Component />}`.
**Fix:** create an element from it.

**Symptom:** a component "works" but its `useState` throws, or state resets on
every render.
**Cause:** it was *called* — `{Header()}` — rather than rendered. It has no
fiber of its own; its hooks belong to the caller.
**Fix:** `<Header />`.

**Symptom:** a destructured component from an object renders as an HTML tag.
**Cause:** it was renamed to something lowercase.
**Fix:** rename to PascalCase, or use it as a member expression:
`<ui.button />`.

## Interview questions

**★ What decides whether `<x/>` is an HTML element or your component?**
The first character. Lowercase compiles to a string type, which React treats as
a host element; uppercase compiles to the identifier, so React calls it. A tag
containing a hyphen is also a string — a custom element — and any member
expression like `<ui.button/>` is always treated as a component.

**★ What happens if you write `<myComponent />` for a component you defined?**
React renders an unknown HTML element named `mycomponent` and passes the props
through as attributes. Your function is never called, and neither build prints
a warning. Measured: `<button label="x"/>` with a `button` component in scope
rendered `<button label="x"></button>`.

**What is "Element type is invalid … got: undefined" telling you?**
The capitalized identifier in the tag evaluated to `undefined` — almost always a
default/named import mismatch or a missing export.

**Why can't you call a component like a function — `Header()`?**
It works visually but the output is inlined into the caller's element tree.
There is no fiber for it, so it has no state, no effects, no keyed identity, and
its hooks belong to the calling component. React can neither bail out of nor
reset it independently.

**Why does `<Icons.chevron />` work when `<chevron />` would not?**
Because a member expression cannot be an HTML tag name, so JSX always compiles
it to the expression itself, regardless of case.

---

← Prev: [Attributes vs props](04-attributes-vs-props.md) · Index: [Phase 1](README.md) · Next → [Conditional rendering](06-conditional-rendering.md)
