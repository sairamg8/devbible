---
title: "Fragments"
sidebar_label: "08 · Fragments"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Markup
> and warnings are printed by `sandbox/react-p1/ex07-fragments.mjs`.

**A fragment groups children for React without putting anything in the DOM. It
exists because a component returns one element, and sometimes the thing you
want to return is two.**

## What reaches the DOM

```console
$ node ex07-fragments.mjs
=== fragments — rendered markup (production build) ===
  --- what reaches the DOM ---
  <>…</>                        <section><b>one</b><i>two</i></section>
  <div>…</div>                  <section><div><b>one</b><i>two</i></div></section>
  <Fragment>…</Fragment>        <section><b>one</b><i>two</i></section>
  empty fragment                <section></section>
  fragment with text            <section>ab</section>
```

`<>` and `<Fragment>` are the same thing — the shorthand compiles to
`_jsx(Fragment, …)`, as shown on [page 01](01-jsx-is-a-function-call.md). The
`<div>` version is the comparison: one extra node in the DOM, one extra box in
the layout, one more thing for a CSS selector to trip over.

## Why the wrapper `<div>` is not harmless

```console
  --- a fragment where the parent cares about its children ---
  fragment inside <tr>          <table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>
  div inside <tr>               <table><tbody><tr><div><td>a</td><td>b</td></div></tr></tbody></table>
```

```console
  [error] In HTML, <div> cannot be a child of <tr>.
This will cause a hydration error.

  <table>
    <tbody>
>     <tr>
        <CellsDiv>
>         <div>

  [error] <tr> cannot contain a nested <div>.
```

React 19 validates HTML nesting and prints the ancestor tree with the offending
levels marked. Tables are the classic case, but the same applies to:

- `<ul>` / `<ol>` — only `<li>` may be a child
- `<select>` — only `<option>` and `<optgroup>`
- `<dl>` — `<dt>` and `<dd>` as siblings, which is the case the keyed fragment
  below exists for
- **flex and grid containers** — a wrapper `<div>` becomes the flex item, and
  your intended children are no longer laid out by the parent at all

That last one produces no warning and no error. It just looks wrong.

## The one case the shorthand cannot cover

```console
  --- the case the shorthand cannot cover ---
  keyed Fragment in a map       <dl><dt>Name</dt><dd>Ada</dd><dt>Role</dt><dd>Eng</dd></dl>
  wrapper div in a map          <dl><div><dt>Name</dt><dd>Ada</dd></div><div>…</div></dl>
```

```jsx
import {Fragment} from 'react';

<dl>
  {pairs.map(p => (
    <Fragment key={p.id}>
      <dt>{p.k}</dt>
      <dd>{p.v}</dd>
    </Fragment>
  ))}
</dl>
```

`<>` accepts **no attributes at all** — including `key` — and attempting it is a
syntax error, not a warning. Any list of fragments therefore needs the long
form and the import.

## `key` and `children` are the only props

```console
  [error] Invalid prop `className` supplied to `React.Fragment`. React.Fragment
          can only have `key` and `children` props.
  [error] Invalid prop `onClick` supplied to `React.Fragment`. React.Fragment
          can only have `key` and `children` props.
```

A fragment has no DOM node, so there is nothing to attach a class or a listener
to. If you need either, you need a real element — which is the honest signal
that a wrapper is genuinely required here.

*(The first run of this experiment appeared to show `onClick` not warning. It
was truncated output, not React behaviour — an isolated re-run printed the
warning, and that check stayed in the script.)*

## Where fragments matter

**Returning siblings**

```jsx
function NameFields() {
  return (
    <>
      <label htmlFor="first">First</label>
      <input id="first" />
      <label htmlFor="last">Last</label>
      <input id="last" />
    </>
  );
}
```

Dropped into a `<form className="grid">`, all four elements are grid items. Wrap
them in a `<div>` and they are one item.

**Grouping in a conditional**

```jsx
{isAdmin && (
  <>
    <MenuItem>Settings</MenuItem>
    <MenuItem>Users</MenuItem>
  </>
)}
```

**Not needed for a single child** — `return <><div/></>` is noise; return the
element.

## Reading it in a stack trace

A fragment does not appear in the DOM, but it *does* appear in the React tree:
DevTools shows it, and it counts as a position for reconciliation. Adding or
removing a fragment around a subtree changes nothing structurally — a fragment
is transparent to depth — but replacing a fragment with a `<div>` is a type
change at that position and destroys the subtree's state.

## Gotchas

**Symptom:** "Adjacent JSX elements must be wrapped in an enclosing tag".
**Cause:** a component returning two elements. JSX is one expression, so it must
produce one value.
**Fix:** wrap them in `<>…</>`.

**Symptom:** a flex or grid layout ignores your items' alignment.
**Cause:** a wrapper `<div>` is the flex/grid item; your elements are its
children and are laid out by nothing.
**Fix:** replace the wrapper with a fragment, or use `display: contents` if the
wrapper must stay.

**Symptom:** "In HTML, `<div>` cannot be a child of `<tr>`" and a hydration
error in SSR.
**Cause:** a component wrapping `<td>`s in a `<div>`.
**Fix:** return a fragment.

**Symptom:** a key warning inside a list of fragments that you cannot fix.
**Cause:** `<>` cannot take a key.
**Fix:** `import {Fragment}` and use `<Fragment key={…}>`.

**Symptom:** "Invalid prop `className` supplied to `React.Fragment`".
**Cause:** treating a fragment as a styled wrapper.
**Fix:** use a real element — the fragment cannot be styled because it has no
node.

**Symptom:** state resets when you refactor a wrapper `<div>` into a fragment.
**Cause:** the element type at that position changed, which unmounts the
subtree. It is a one-time cost at the refactor, not an ongoing bug.
**Fix:** expected; nothing to do.

## Interview questions

**★ What is a fragment and why do you need one?**
A component's return value is a single element, but the markup you want is often
several siblings. A fragment groups them for React while adding nothing to the
DOM — no extra node, no extra box in the layout, nothing for CSS to match.

**★ What is the difference between `<>…</>` and `<Fragment>…</Fragment>`?**
None, except that the shorthand accepts no attributes. `key` is the only
attribute a fragment can take, so any keyed fragment — a list of `<dt>`/`<dd>`
pairs, for instance — needs the long form and the `Fragment` import. Putting a
key on `<>` is a syntax error.

**Can a fragment have a `className` or an `onClick`?**
No. React warns that `React.Fragment can only have `key` and `children` props`.
There is no DOM node to attach either to.

**Why does a wrapper `<div>` break a table or a flex layout?**
Because HTML and CSS both care about the direct parent-child relationship. A
`<div>` between `<tr>` and `<td>` is invalid HTML and triggers React's nesting
validation and hydration errors; a `<div>` inside a flex container becomes the
flex item, so your intended children are no longer laid out by the container.

**Does a fragment affect reconciliation?**
It occupies a position in the React tree but does not add depth in a way that
resets children when it stays a fragment. Swapping a fragment for a `<div>` at
the same position is a type change and does destroy the subtree's state.

---

← Prev: [Lists and keys](07-lists-and-keys.md) · Index: [Phase 1](README.md) · Next → [children](09-children.md)
