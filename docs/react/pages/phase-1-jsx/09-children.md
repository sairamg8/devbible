---
title: "children"
sidebar_label: "09 · children"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react 19.2.8**. The shapes, counts and invented
> keys below are printed by `sandbox/react-p1/ex08-children.mjs`, which inspects
> real elements and renders with `react-dom/server`.

**`children` is an ordinary prop. Nesting is syntax for setting it. Everything
that makes it feel special — that it is sometimes an array and sometimes not,
that `Children.map` rewrites keys — follows from that one fact plus what the
compiler decided to emit.**

## Nesting sets a prop

```jsx
<Card>hello</Card>
// compiles to
_jsx(Card, {children: "hello"})
```

Which means this is legal, and does the same thing:

```jsx
<Card children="hello" />
```

Nobody writes that, but knowing it is possible explains the type signature
(`children` is just a key in props) and it answers the question of what happens
when you do both:

```console
=== 7. attribute vs nesting — which children win ===
  <div children="from-prop">from-nesting</div>
   -> <div>from-nesting</div>
  <div children="from-prop" />
   -> <div>from-prop</div>
```

**Nesting wins.** JSX writes `children` last.

## The shape is decided by the compiler

```console
=== 1. the shape of props.children ===
  no children                typeof=undefined undefined
  one text child             typeof=string    string: "hi"
  one element child          typeof=object    element <b>
  two children               typeof=object    array(2)
  text + expression          typeof=object    array(2)
  a mapped array             typeof=object    array(3)
  array + sibling            typeof=object    array(2)
  null child                 typeof=object    object: null
  children as an attribute   typeof=string    string: "from-prop"
```

```console
=== 2. one child is NOT an array of one ===
  Array.isArray(one.children)   false
  Array.isArray(two.children)   true
  one.children.map exists       undefined
```

This is the single most common `children` bug: **`props.children.map(...)`
throws when the caller passes exactly one child.** The shape depends on how the
*caller* wrote their JSX, which your component cannot control.

The cause is visible one level down:

```console
=== 3. the compiler decides jsx vs jsxs, and that decides the shape ===
  jsx  -> children  element <b>
  jsxs -> children  array(2)
```

One child compiles to `jsx` and passes the element itself; two or more compile
to `jsxs` and pass an array. See [page 01](01-jsx-is-a-function-call.md).

**Never iterate `children` directly.** Use `Children.toArray` or
`Children.map`, both of which normalise.

## The `Children` helpers

```console
=== 2. … ===
  Children.count(one)           1
  Children.count(two)           2
  Children.count(null)          0
  Children.count(nested array)  3
```

```console
=== 4. Children.toArray — flattening and the keys it invents ===
  input:  array(5) with a nested array, a null, a false and a string
  output: array(4)
    <b>    key=".$k1"
    <i>    key=".2:0"
    <u>    key=".2:$k2"
    text   key=null
```

`Children.toArray` does four things at once: **flattens** nested arrays,
**drops** `null`, `undefined` and booleans, **leaves strings and numbers as
they are**, and **rewrites every element's key** to a path-prefixed one.

Those prefixes are not decoration. `.$k1` is "the key `k1`, at the top level";
`.2:$k2` is "the key `k2`, inside the item at index 2". React needs the path
because flattening two levels into one could otherwise collide two identical
keys from different branches.

```console
=== 5. Children.map keys vs a plain .map ===
  Children.map: .$a .$b
  plain .map:   a b
```

The consequence worth remembering: **the key your caller wrote is not the key
React ends up using** once you pass children through `Children.map`. Do not try
to read a caller's key out of a child and match on it.

Four helpers exist — `Children.map`, `Children.forEach`, `Children.count`,
`Children.toArray`, plus `Children.only`. React's own documentation discourages
all of them in new code, in favour of the composition patterns below. They are
still the correct tool when you genuinely must inspect an unknown children set.

## A fragment child is one child

```console
=== 8. a fragment child is still one child ===
  children        element <undefined>
  Children.count  1
  markup          <div><b>x</b><i>y</i></div>
```

`Children.count` says **1**, and the markup has two elements. A fragment is a
single element whose own children are the two you see. Any code that counts
children to decide a layout — "if there is more than one child, use a grid" —
gives the wrong answer the moment a caller wraps theirs in a fragment.

## The four ways to pass content

### 1. `children` — the default slot

```jsx
function Card({children}) {
  return <div className="card">{children}</div>;
}
<Card><h2>Title</h2><p>Body</p></Card>
```

### 2. Elements as props — named slots

```console
=== 6. children as a function, and elements as props ===
  slots:       <main><h1>H</h1><div>body</div><footer>F</footer></main>
```

```jsx
function Layout({header, children, footer}) {
  return <main>{header}<div>{children}</div>{footer}</main>;
}

<Layout header={<h1>H</h1>} footer={<footer>F</footer>}>
  body
</Layout>
```

Any prop can hold an element. This is how you get more than one slot, and it is
almost always better than passing data and letting the component build the
markup — the caller keeps control of what is rendered.

### 3. Children as a function — the render prop

```console
  render-prop: <b>ON</b>
```

```jsx
function Toggle({children}) {
  const [on, setOn] = useState(false);
  return children({on, toggle: () => setOn(o => !o)});
}

<Toggle>{({on, toggle}) => <button onClick={toggle}>{on ? 'ON' : 'OFF'}</button>}</Toggle>
```

The component owns the state; the caller owns the markup. A custom hook does
this better in most cases (Phase 7) — but this pattern is still right when the
thing being shared is *placement* as well as state, and you will meet it
constantly in older code and in libraries.

### 4. A slot object

```jsx
<DataTable columns={{
  name:  (row) => <strong>{row.name}</strong>,
  email: (row) => <a href={`mailto:${row.email}`}>{row.email}</a>,
}} />
```

## Choosing between them

| Want | Use |
|---|---|
| One block of content | `children` |
| Two or more distinct regions | element props (`header`, `footer`) |
| The caller needs values you own | children as a function |
| The caller needs to render per item | a function prop per slot |
| To inspect or transform unknown children | `Children.toArray` — reluctantly |

## Gotchas

**Symptom:** `children.map is not a function`.
**Cause:** exactly one child was passed, so `children` is that element, not an
array.
**Fix:** `Children.toArray(children).map(...)` — or restructure so you do not
need to iterate.

**Symptom:** a layout that branches on `children.length` misbehaves when the
caller uses a fragment.
**Cause:** a fragment is one child regardless of what is inside it.
**Fix:** do not count children. Take named props for the regions you care
about.

**Symptom:** keys you passed do not match the keys you read back.
**Cause:** `Children.map` and `Children.toArray` rewrite keys with a path
prefix — `.$k1`, `.2:$k2`.
**Fix:** never match on a caller's key. Pass an id prop if you need identity.

**Symptom:** `cloneElement` on children breaks when the caller inserts a
wrapper.
**Cause:** cloning assumes a shape the caller is free to change.
**Fix:** pass the data through context instead, and let the child read it.

**Symptom:** children re-render even when the parent's state change is
unrelated.
**Cause:** children are created by the *caller*, so they are new elements
whenever the caller re-renders — not whenever the wrapper does. Passing
`children` through a wrapper is in fact the classic way to *avoid* re-rendering
them.
**Fix:** move state down, or accept `children` rather than building the subtree
inside.

**Symptom:** `<Card children="a">b</Card>` ignores `"a"`.
**Cause:** nesting is written last and wins.
**Fix:** pick one.

## Interview questions

**★ Is `children` special?**
Only syntactically. It is an ordinary prop that JSX sets from whatever you nest
between the tags — `<Card>hi</Card>` compiles to `_jsx(Card, {children: "hi"})`.
Passing it explicitly works, and nesting wins if you do both.

**★ Why does `props.children.map()` sometimes throw?**
Because the compiler emits `jsx` for a single child and passes the element
itself, but `jsxs` for several and passes an array. With one child there is no
`.map`. Use `Children.toArray` or `Children.map`, which normalise both cases.

**★ What does `Children.toArray` do?**
Flattens nested arrays, removes `null`/`undefined`/booleans, keeps strings and
numbers, and rewrites element keys with a path prefix so that flattening cannot
collide two identical keys from different branches.

**What is a render prop, and when would you still use one?**
A prop — often `children` — that is a function the component calls with values
it owns, letting the caller decide the markup. Custom hooks replaced most uses,
but render props still fit when the component controls *where* as well as
*what*, and you will meet them in existing code.

**How do you build a component with more than one content slot?**
Take elements as ordinary props — `header`, `footer`, `aside` — rather than
trying to slice `children` apart. It keeps the caller in control of the markup
and is stable against refactors.

**Why is counting children fragile?**
A fragment counts as one child no matter how many elements it holds, and
`Children.count` flattens nested arrays. Two callers writing visually identical
JSX can produce different counts.

---

← Prev: [Fragments](08-fragments.md) · Index: [Phase 1](README.md) · Next → [Spreading props](10-spreading-props.md)
