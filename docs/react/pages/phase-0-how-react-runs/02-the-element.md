---
title: "The element"
sidebar_label: "02 · The element"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react 19.2.8** with **@babel/preset-react 7.29.7**.
> Every console block is printed by `sandbox/react-p0/ex02-the-element.mjs`.

**A React element is a frozen plain object describing what you want on screen.
It is not a DOM node, not a component instance, and creating one runs nothing.**

Get this and half of React's surprising behaviour stops being surprising:
why rendering is cheap, why you can pass UI around as a value, and why
mutating an element does nothing useful.

## JSX is one function call

JSX is syntax, not semantics. Your build tool rewrites it before React ever
sees it.

```jsx
const el = <button className="primary" onClick={save}>Save</button>;
const list = <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
```

Compiled with the **automatic runtime** — the default since React 17, and the
reason you no longer `import React` just to write JSX:

```console
$ node ex02-the-element.mjs

=== what the automatic runtime compiles it to (@babel/preset-react) ===
  import { jsx as _jsx } from "react/jsx-runtime";
  const el = /*#__PURE__*/_jsx("button", {
    className: "primary",
    onClick: save,
    children: "Save"
  });
  const list = /*#__PURE__*/_jsx("ul", {
    children: items.map(i => /*#__PURE__*/_jsx("li", {
      children: i.name
    }, i.id))
  });
```

Three things worth reading off that output:

1. **`children` is an ordinary prop.** Nesting in JSX is just a `children` key.
2. **`key` is the third argument**, not a prop — `_jsx("li", {children}, i.id)`.
3. `/*#__PURE__*/` tells minifiers the call has no side effects, so unused UI
   can be dropped from the bundle.

The **classic runtime** is what you will see in pre-17 code and in old answers:

```console
=== what the classic runtime compiled it to (pre-17, still seen in old code) ===
  const el = /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: save
  }, "Save");
```

Same result, but `React` had to be in scope — the origin of the
`'React' must be in scope when using JSX` error that no longer applies.

## What the call returns

```console
=== the value an element actually is ===
{
  '$$typeof': Symbol(react.transitional.element),
  type: 'button',
  key: null,
  props: { className: 'primary', children: 'Save' },
  _owner: null,
  _store: {}
}
```

That is the entire thing. Six fields, no methods, no DOM.

| Field | What it holds |
|---|---|
| `$$typeof` | A symbol marking this as a real element. Symbols do not survive `JSON.parse`, which is what stops a JSON payload from being injected as an element |
| `type` | `'button'` for a host element, or **the function itself** for a component |
| `key` | Identity among siblings — see [reconciliation](04-reconciliation.md) |
| `props` | Everything else, including `children` |
| `_owner`, `_store` | Internal; development bookkeeping for warnings |

Note the symbol is **`react.transitional.element`**, not the `react.element` most
articles still quote. It changed with React 19; if you are matching on it, match
`React.isValidElement` instead.

## Elements are frozen

```console
=== facts about that value ===
  typeof el                  object
  el.$$typeof                Symbol(react.transitional.element)
  el.type                    "button"
  el.key                     null
  el.props                   {"className":"primary","children":"Save"}
  Object.isFrozen(el)        true
  Object.isFrozen(el.props)  true
  React.isValidElement(el)   true

=== mutating a frozen element ===
  TypeError: Cannot assign to read only property 'className' of object '#<Object>'
```

Both the element and its props are frozen in development. Attempting to change
one throws in strict mode (which every ES module is) and silently does nothing
in sloppy mode.

This is deliberate: an element is a *description*, and a description of the past
is worthless. To change the UI you produce a **new** element, which is what
re-rendering is.

## A component element has not run yet

This is the part people find genuinely surprising:

```console
=== a component element holds the function, not its output ===
  typeof cel.type        function
  cel.type.name          Greeting
  cel.type === Greeting  true
  has Greeting run yet?  no — nothing called it
  cel.props              {"name":"Ada"}
```

`<Greeting name="Ada" />` does not call `Greeting`. It builds
`{type: Greeting, props: {name: 'Ada'}}` and hands it to React. **React** decides
whether, when, and how many times to call it.

Two consequences you will use constantly:

- Creating elements is cheap, so passing UI around as a prop costs nothing until
  it is rendered.
- `<Greeting />` and `Greeting()` are not the same. The first is an element React
  manages, with its own state and position in the tree. The second is a plain
  function call whose hooks belong to the *caller* — a real bug, not a style
  choice.

## `key` is not a prop

```console
=== key and ref are not props ===
  keyed.key             "a1"
  'key' in keyed.props  true
  keyed.props           {"id":"x","children":"item"}
```

Read that carefully, because it contradicts itself on purpose. `key` is stored
on the element, and `Object.keys(props)` does not list it — but `'key' in props`
is `true`. React 19 installs a **non-enumerable getter** on `props` that exists
only to warn you:

```console
$ node -e "…access keyed.props.key…"
descriptor: { get: 'function', enumerable: false, configurable: false }
Object.keys(props): [ 'id', 'children' ]
accessing props.key ->
li: `key` is not a prop. Trying to access it will result in `undefined` being
returned. If you need to access the same value within the child component, you
should pass it as a different prop. (https://react.dev/link/special-props)
  value: undefined
```

So the getter returns `undefined` and warns. If a child needs the value, pass it
twice: `<Row key={id} id={id} />`.

## Gotchas

**Symptom:** `Objects are not valid as a React child (found: object with keys {...})`.
**Cause:** you rendered a plain object where React expected a node —
usually `{user}` instead of `{user.name}`, or an accidentally-returned object.
**Fix:** render a string, number, element or array. Elements are objects too, but
they carry `$$typeof`, which is exactly how React tells them apart.

**Symptom:** a component's state resets or hooks misbehave, and the component
appears in the DevTools tree as its *parent's* hooks.
**Cause:** it was invoked as `Greeting()` instead of rendered as `<Greeting />`.
Its hooks were appended to the caller's hook list.
**Fix:** render it as an element. Only call a component function directly if you
genuinely want inlining and it uses no hooks.

**Symptom:** `TypeError: Cannot assign to read only property 'x' of object`
when "fixing up" props before rendering.
**Cause:** elements and their props are frozen.
**Fix:** build the props you want before creating the element, or use
`cloneElement` — though needing it usually means the data should have come from
above in the first place.

**Symptom:** a `key` you set is `undefined` inside the child.
**Cause:** `key` is consumed by React and never forwarded as a prop.
**Fix:** pass it under a second name as well.

## Interview questions

**★ What does JSX compile to?**
A call to `jsx()` (or `jsxs()` for multiple children) imported from
`react/jsx-runtime`. Children become a `children` prop and `key` is passed as a
separate third argument. Before React 17 it compiled to `React.createElement`,
which is why `React` had to be in scope.

**★ What is a React element?**
A frozen plain object — `$$typeof`, `type`, `key`, `props` — describing desired
UI. Not a DOM node, not an instance. Creating one performs no work.

**★ Does `<Greeting />` call `Greeting`?**
No. It creates an element holding a reference to the function. React calls it
during render, and may call it more than once or not at all.

**What is `$$typeof` for?**
It marks a genuine element. Because it is a symbol, it cannot survive JSON
serialisation, so a server can never send something that React would mistake for
a renderable element — an XSS mitigation.

**Why are elements frozen?**
They describe one render. Mutating a description React has already consumed
would produce a UI that disagrees with the data. Changing the UI means producing
a new element instead.

**Why can't a child read its own `key`?**
`key` belongs to the parent's reconciliation of its children, not to the child's
data. React strips it, and in 19 leaves a getter that warns and returns
`undefined`. Pass the value again under another prop name.

---

← Prev: [What React is](01-what-react-is.md) · Index: [Phase 0](README.md) · Next → [Render, reconcile, commit](03-render-reconcile-commit.md)
