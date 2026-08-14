---
title: "Crossing component boundaries"
sidebar_label: "02 · Crossing boundaries"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs)
> (§ Accessing another component's DOM nodes, § Best practices for DOM
> manipulation with refs, § Flushing state updates synchronously with flushSync).
> No sandbox script backs this page; claims are cited, not measured.

**Passing a ref through your own components — which React 19 changed — and the
rules for what you are allowed to do to a node once you hold one.**

## 🔴 Passing a ref to your own component — React 19

```jsx
function MyInput({ ref }) {
  return <input ref={ref} />;
}

function MyForm() {
  const inputRef = useRef(null);
  return <MyInput ref={inputRef} />;
}
```

> **In React 19, `ref` is now a regular prop and doesn't require `forwardRef`.**

That is the change to internalise, because every tutorial written before it wraps
this in `forwardRef`. `ref` destructured from props, like any other prop. Since
`<input>` is a built-in component, React sets `.current` to the actual DOM
element, so `inputRef` in the parent points at the real node.

The docs attach a warning to the whole practice:

> Refs are an escape hatch. **Manually manipulating *another* component's DOM
> nodes can make your code fragile.**

Reaching into a child's DOM couples you to its internal markup. If the child later
wraps its input in a div, or renders a different element, the parent breaks with no
type error and no warning.

Narrowing what you expose is [topic 07](../07-useimperativehandle.md)'s subject:

```jsx
function MyInput({ ref }) {
  const realInputRef = useRef(null);
  useImperativeHandle(ref, () => ({
    // Only expose focus and nothing else
    focus() {
      realInputRef.current.focus();
    },
  }));
  return <input ref={realInputRef} />;
}
```

## What you may and may not do to the node

The rule, stated plainly:

> **Avoid changing DOM nodes managed by React.** Modifying, adding children to, or
> removing children from elements that are managed by React can lead to
> **inconsistent visual results or crashes.**

React's diffing assumes the DOM matches what it last rendered. Change it underneath
and the next update computes the wrong minimal operations — removing a node that is
not there any more, or writing over something it does not know about.

But the line is more precise than "never touch it":

> **You can safely modify parts of the DOM that React has *no reason* to update.**
> For example, if some `<div>` is always empty in the JSX, React won't have a
> reason to touch its children list. Therefore, it is safe to manually add or
> remove elements there.

That empty-`<div>` carve-out is what makes it legal to hand a container to a chart
library, a map, or an editor. **The contract is that React never renders children
into that node**, so it has no expectations about its contents to violate.

| Action | Safe? |
|---|---|
| `focus()`, `blur()`, `scrollIntoView()` | ✅ non-destructive |
| `getBoundingClientRect()`, reading `scrollTop` | ✅ read-only |
| Mounting a third-party widget into an always-empty `<div>` | ✅ React has no reason to update it |
| Setting `style` or a class React also sets | ⚠️ React will overwrite it on the next render |
| Adding or removing children React renders | 🔴 inconsistent results or crashes |

## When you need the DOM *after* a state update

The classic sequence — add an item, then scroll to it — does not work naively,
because the state update has not been committed when the next line runs
([Phase 3 · 02](../../phase-3-state/02-state-is-a-snapshot.md)):

```jsx
import { flushSync } from 'react-dom';

function handleAdd() {
  const newTodo = { id: nextId++, text: text };
  flushSync(() => {
    setText('');
    setTodos([...todos, newTodo]);
  });
  listRef.current.lastChild.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}
```

> This will instruct React to update the DOM **synchronously right after the code
> wrapped in `flushSync` executes.** As a result, the last todo will already be in
> the DOM by the time you try to scroll to it.

`flushSync` opts out of batching for that update, which costs you a synchronous
render. Use it when you must read the DOM immediately after a state change, and
not as a general fix for "the value looks stale".

## Gotchas

**Symptom:** a tutorial's `forwardRef` no longer seems necessary.
**Cause:** in React 19 `ref` is a regular prop.
**Fix:** destructure `ref` from props. `forwardRef` still works, but new code does
not need it.

**Symptom:** a parent breaks after a child changes its internal markup.
**Cause:** the parent reaches into the child's DOM, so it is coupled to markup it
does not own — and nothing warns when that markup changes.
**Fix:** expose a narrow handle with `useImperativeHandle`
([topic 07](../07-useimperativehandle.md)), or lift the behaviour into a prop.

**Symptom:** manually inserted DOM disappears on the next render, or React crashes
removing a child.
**Cause:** the node's children are managed by React, so its diff no longer matches
reality.
**Fix:** only hand a library a `<div>` that is always empty in your JSX.

**Symptom:** an inline style set through a ref keeps getting reverted.
**Cause:** React re-applies what it rendered on the next update.
**Fix:** render the style. If it must be imperative, target a node React does not
render into.

**Symptom:** scrolling to a newly added item scrolls to the previous last item.
**Cause:** the state update has not been committed when the scroll line runs.
**Fix:** wrap the update in `flushSync`, accepting the synchronous render.

**Symptom:** `flushSync` used routinely to make values "not stale".
**Cause:** treating it as a fix for snapshot semantics rather than as a commit
barrier.
**Fix:** it is for reading the DOM immediately after a state change. Stale-looking
values are [Phase 3 · 02](../../phase-3-state/02-state-is-a-snapshot.md).

## Interview questions

**★ What changed about passing refs to your own components in React 19?**
`ref` is a regular prop, so `forwardRef` is no longer required — you destructure
`ref` from props and pass it on to a built-in element, and React sets `.current` to
the real DOM node. The docs still warn that manipulating another component's DOM
makes code fragile, which is why `useImperativeHandle` exists to expose a narrow
handle rather than the raw node.

**★ What DOM manipulation is actually safe through a ref?**
Non-destructive things — focus, blur, scroll, and reading measurements. Unsafe is
modifying, adding or removing children of elements React manages, which the docs
say can cause inconsistent visual results or crashes, because React's diff assumes
the DOM matches its last render. The documented exception is a node React has no
reason to update: a `<div>` that is always empty in your JSX is safe to hand to a
chart or editor library.

**★ Why does scrolling to a just-added item need `flushSync`?**
Because state updates are batched, so on the next line the DOM has not been updated
and the new item is not there to scroll to. `flushSync` instructs React to update
the DOM synchronously right after the wrapped code runs, so the node exists by the
time you read it. It costs a synchronous render, so it is the tool for "I must read
the DOM now", not a general remedy for values looking stale.

**Why is reaching into another component's DOM described as fragile?**
Because it couples the parent to markup the child owns and can change freely. If
the child later wraps its input in a div or renders a different element, the parent
breaks with no type error and no warning — the dependency is invisible to every
tool. Exposing an explicit, narrow imperative API makes the contract checkable.

**What is the precise rule about modifying DOM React manages?**
Avoid it — but the line is sharper than "never touch it". You may safely modify
parts of the DOM React has *no reason* to update, and the docs give the example of
a `<div>` that is always empty in the JSX, where React has no expectations about
the children list to violate. That carve-out is what makes third-party widget
mounting legal.

---

← Prev: [Getting and using a ref](01-attaching-and-using.md) · Index: [DOM refs](README.md)
