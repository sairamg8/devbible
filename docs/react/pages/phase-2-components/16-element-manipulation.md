---
title: "cloneElement, Children.map and isValidElement"
sidebar_label: "16 · Element manipulation"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`cloneElement`](https://react.dev/reference/react/cloneElement) and
> [`Children`](https://react.dev/reference/react/Children), including the
> caveats and the alternatives both pages recommend. No sandbox script backs
> this page; claims are cited, not measured.

**React's own documentation calls both of these fragile and points at
replacements. They are here because you will read them in existing code, and
because the *reason* they are fragile is a genuinely useful thing to understand
about elements.**

## The status

Neither is deprecated. Both carry the same warning.

On `cloneElement`:

> Using `cloneElement` is uncommon and can lead to fragile code.

On `Children`:

> Using `Children` is uncommon and can lead to fragile code. See common
> alternatives.

"Uncommon and fragile" rather than "deprecated" is the right reading: they work,
they will keep working, and the documentation would rather you did not reach for
them.

## `cloneElement`

```js
const clonedElement = cloneElement(element, props, ...children)
```

It produces a **new** element based on an existing one, with props merged and
children optionally replaced.

```jsx
function RadioGroup({name, children}) {
  return Children.map(children, child =>
    cloneElement(child, {name})       // inject `name` into each radio
  );
}
```

The documented pitfalls:

**Cloning does not modify the original.** It returns a new element; the original
is untouched. This surprises people who expect a mutation.

**Children must be statically known when passed as extra arguments.** Use
`cloneElement(element, null, child1, child2, child3)` for static children and
`cloneElement(element, null, listItems)` for a dynamic list — the distinction
exists so React can still warn about missing keys.

**It makes data flow harder to trace** — the docs' phrasing, followed by *"try
the alternatives instead."*

That third one is the substantive objection, and it is worth spelling out. A
component receiving an injected prop has no signature saying where it came from.
The reader sees `<Radio value="a" />` at the call site and `props.name` inside
`Radio`, with nothing in between to connect them. Grep finds nothing. The value
appears from a parent that the child never mentions.

## Why it is structurally fragile

Two failures that no amount of care avoids:

**It only reaches direct children.** Wrap one part in anything — a `<div>`, a
`<Tooltip>`, a fragment, a conditional — and the clone lands on the wrapper
instead of the intended element. The injected prop becomes an unknown attribute
on a `<div>` and the real target never receives it. Silently.

```jsx
<RadioGroup name="size">
  <Radio value="s" />              {/* ✅ gets name */}
  <Tooltip><Radio value="m" /></Tooltip>   {/* 🔴 Tooltip gets name */}
</RadioGroup>
```

**You cannot see rendered output.** The `Children` docs are explicit:

> The `children` data structure **does not include rendered output** of the
> components you pass as JSX… **There is no way to get the rendered output of an
> inner component** like `<MoreRows />` when manipulating `children`. This is
> why it's usually better to use one of the alternative solutions.

`children` is the elements the caller *wrote*, not what they produce. A caller
passing `<MyRadios />` — one component that renders three radios — gives you one
child. Any logic that counts, indexes, or maps over children is working with the
caller's source structure, which the caller can change at any time without
knowing they broke you.

## `Children`

The namespace for traversing the opaque `children` structure. The caveats,
verbatim:

- Empty nodes (`null`, `undefined`, Booleans), strings, numbers and React
  elements **count as individual nodes**.
- Arrays **don't count as individual nodes, but their children do**.
- **The traversal does not go deeper than React elements** — they are not
  rendered and their children are not traversed.
- **Fragments don't get traversed.**

That last one is the trap in one line: `<><A /><B /></>` is **one** child, not
two. So `Children.count` returns a number that depends on how the caller chose
to write their JSX, and two visually identical call sites can produce different
counts.

`Children.toArray` normalises, with a documented key behaviour:

> Empty nodes (`null`, `undefined`, and Booleans) will be omitted in the
> returned array.

> **The returned elements' keys will be calculated from the original elements'
> keys and their level of nesting and position.** This ensures that flattening
> the array does not introduce changes in behavior.

That key rewriting is why `toArray` is the safe one of the group — it prevents
two identical keys from different branches colliding after a flatten. Phase 1's
[`children`](../phase-1-jsx/09-children.md) has the measured output showing the
prefixed keys it invents.

`Children.map` combines returned keys with the original item's key
automatically, so keys returned from the callback only need to be unique
locally.

## `isValidElement`

```jsx
isValidElement(<p />)            // true
isValidElement({type: 'p'})      // false — a plain object is not an element
isValidElement('hello')          // false — strings are renderable, not elements
```

The narrow, legitimate one. It answers exactly one question — is this value a
React element — and it is useful when a prop may be either an element or
something else:

```jsx
const label = isValidElement(title) ? title : <h3>{title}</h3>;
```

Note what it does not tell you: not what component it is, not whether it will
render anything, and not whether it is *renderable* — strings, numbers and
arrays all render and all return `false`.

## The alternatives the docs recommend

`Children`'s reference lists three, and `cloneElement`'s lists three overlapping
ones. Combined:

**1. Expose multiple components.** Instead of wrapping children automatically,
export the wrapper and let the caller use it:

```jsx
<RowList>
  <Row><p>first</p></Row>
  <Row><p>second</p></Row>
</RowList>
```

Explicit, unbreakable by nesting, and the caller can see what is happening.

**2. Accept an array of objects as a prop.**

```jsx
<RowList rows={[
  {id: 'first',  content: <p>first</p>},
  {id: 'second', content: <p>second</p>},
]} />
```

You get real data with real keys, instead of guessing at structure.

**3. Render props.**

```jsx
<TabSwitcher tabIds={ids} renderContent={id => <p>{id}</p>} />
```

The docs' stated benefit: it *"explicitly traces where values come from"* —
precisely what cloning destroys.

**4. Context** — the `cloneElement` page's own first alternative, and the right
answer for compound components:

```jsx
<HighlightContext value={isHighlighted}>
  {renderItem(item)}
</HighlightContext>
```

Reaches any depth, survives arbitrary nesting, and the consumer names what it
reads.

**5. Custom hooks**, when the shared thing is logic rather than markup.

The pattern across all five: **make the data flow visible.** Cloning hides it,
which is the whole objection.

## Gotchas

**Symptom:** an injected prop reaches some children and not others.
**Cause:** `cloneElement` only touches direct children; the others are wrapped.
**Fix:** context. It does not care about the structure in between.

**Symptom:** `Children.count` returns 1 for what looks like three children.
**Cause:** they are inside a fragment, which is not traversed.
**Fix:** do not count children. The count depends on how the caller wrote their
JSX, which is not your API.

**Symptom:** an unknown-attribute warning on a `<div>` in the console.
**Cause:** a clone injected a custom prop onto a wrapper element instead of the
component it was meant for.
**Fix:** the same — context, or explicit props.

**Symptom:** duplicate key warnings after flattening children manually.
**Cause:** two branches produced the same keys and a manual flatten collided
them.
**Fix:** `Children.toArray`, which rewrites keys with a nesting-and-position
prefix specifically to prevent this.

**Symptom:** logic breaks when a caller passes a single component that renders
several items.
**Cause:** `children` is the source structure, not the rendered output. One
component is one child.
**Fix:** take data as a prop instead of inferring it from markup.

**Symptom:** `isValidElement` returns `false` for a string that renders fine.
**Cause:** it tests for elements specifically. Strings, numbers and arrays are
renderable but are not elements.
**Fix:** check for what you actually need — usually "is this renderable", which
is a different and looser question.

## Interview questions

**★ Is `cloneElement` deprecated?**
No. The documentation calls it uncommon and says it can lead to fragile code,
and recommends alternatives — render props, context, custom hooks — but it is
not deprecated and continues to work. Same status for the `Children` namespace.

**★ Why is `cloneElement` fragile?**
Two structural reasons. It only reaches direct children, so wrapping one part in
a tooltip or a fragment silently sends the injected prop to the wrapper instead.
And it makes data flow untraceable — the child receives a prop with nothing at
either end of the code connecting it to the source. Context solves both, because
it reaches any depth and the consumer names what it reads.

**★ What does `Children.toArray` do to keys?**
It rewrites them, deriving new keys from the original keys plus the level of
nesting and position, so that flattening cannot make two identical keys from
different branches collide. It also drops `null`, `undefined` and Booleans while
keeping strings and numbers. That key rewriting is what makes it the safe member
of the family.

**Why does `Children.count` give surprising numbers?**
Because fragments are not traversed and arrays do not count as nodes while their
contents do, while `null`, Booleans, strings and numbers each count as one. So
the number reflects how the caller happened to write their JSX. Two visually
identical call sites can produce different counts, which makes counting children
an unreliable basis for anything.

**What is `children` actually, and what is it not?**
It is the elements the caller wrote — descriptors, not rendered output. React's
docs are explicit that there is no way to see what an inner component will
render. So a caller passing one component that renders twenty rows gives you one
child, and any logic that maps or counts is reading the caller's source
structure rather than the UI.

**What would you use instead for a compound component?**
Context. The parent provides shared state and each part reads it, so the caller
can nest, wrap and reorder the parts freely. That is exactly the alternative the
`cloneElement` documentation recommends, and it is the pattern in
[children patterns](08-children-patterns.md).

---

← Prev: [`Component` vs `PureComponent`](15-purecomponent.md) · Index: [Phase 2](README.md) · Next → Phase 3 (not yet written)
