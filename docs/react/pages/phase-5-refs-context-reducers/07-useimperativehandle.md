---
title: "useImperativeHandle"
sidebar_label: "07 · useImperativeHandle"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle).
> No sandbox script backs this page; claims are cited, not measured.

**Replacing the DOM node a parent would otherwise receive with an object you
choose. It exists to make an imperative API *narrow* — and the documentation
spends more space telling you not to need one than telling you how to write one.**

## The shape

```jsx
useImperativeHandle(ref, createHandle, dependencies?)
```

> `ref`: The `ref` you received as a prop to the `MyInput` component.

> `createHandle`: A function that takes no arguments and **returns the ref handle
> you want to expose.** … Usually, you will return an object with the methods you
> want to expose.

> `useImperativeHandle` returns `undefined`.

```jsx
function MyInput({ ref }) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => {
    return {
      focus() {
        inputRef.current.focus();
      },
      scrollIntoView() {
        inputRef.current.scrollIntoView();
      },
    };
  }, []);

  return <input ref={inputRef} />;
}
```

Two refs, doing different jobs. `inputRef` is the real node, private to `MyInput`.
The `ref` **prop** is what the parent holds, and `useImperativeHandle` decides what
lands in it — here an object with exactly two methods.

The parent can now call `focus()` and `scrollIntoView()` and **nothing else**. It
cannot read `.value`, set `.style`, or walk to `parentElement`, because it never
receives the node.

## React 19: `ref` is a prop

> Starting with React 19, **`ref` is available as a prop.** In React 18 and
> earlier, it was necessary to get the `ref` from `forwardRef`.

So the modern form destructures `ref` from props, as above
([topic 02 · 02](02-dom-refs/02-crossing-boundaries.md)). Every pre-19 example
wraps the component in `forwardRef` and takes `(props, ref)` as two arguments —
that still works, and is the main reason older code looks different.

## The dependency array

The third argument behaves exactly like an effect's:

> The list of all reactive values referenced inside of the `createHandle` code …
> The list of dependencies must have **a constant number of items and be written
> inline** … React will compare each dependency with its previous value using the
> `Object.is` comparison. **If a re-render resulted in a change to some dependency,
> or if you omitted this argument, your `createHandle` function will re-execute**,
> and the newly created handle will be assigned to the ref.

Everything from [Phase 4 · 03](../phase-4-effects/03-the-dependency-array.md)
applies: the linter computes it, it must be an inline literal of constant size, and
**omitting it entirely means the handle is rebuilt on every render.**

`[]` is correct in the example above because the methods close over `inputRef`,
whose identity never changes. As soon as a handle method reads a prop or state, that
value belongs in the array — and a rebuilt handle means a parent that stored
`ref.current` somewhere is now holding a stale object.

## 🔴 The pitfall is the point of the page

> **Do not overuse refs.** You should only use refs for *imperative* behaviors that
> you can't express as props: for example, **scrolling to a node, focusing a node,
> triggering an animation, selecting text**, and so on.

> **If you can express something as a prop, you should not use a ref.** For example,
> instead of exposing an imperative handle like `{ open, close }` from a `Modal`
> component, it is better to take `isOpen` as a prop like `<Modal isOpen={isOpen} />`.

That `Modal` example is the exact API most people reach for, named as the wrong
answer. The test is whether the thing is a **state** or an **action**:

| Shape | Belongs as |
|---|---|
| "the modal is open" | a prop — it is state, and the parent already owns it |
| "focus this input" | a handle method — a moment, not a state |
| "the video is playing" | a prop |
| "scroll this into view now" | a handle method |
| "the accordion section is expanded" | a prop |
| "select the text in this field" | a handle method |

The reliable question: *if the component remounted, would you want this to happen
again?* A state should be re-applied; an action should not.

And the docs point at the mechanism for going from prop to behaviour:

> **Effects** can help you expose imperative behaviors via props.

That is [Phase 4](../phase-4-effects/README.md)'s subject — a prop change is a
reactive value, and an effect synchronizes the outside world to it. So
`<Modal isOpen>` is not merely tidier; it is expressible with the tools already
covered.

## Exposing behaviour that is not a node

The second documented use is more interesting than wrapping a DOM node, because the
handle is not a node at all:

```jsx
function Post({ ref }) {
  const commentsRef = useRef(null);
  const addCommentRef = useRef(null);

  useImperativeHandle(ref, () => {
    return {
      scrollAndFocusAddComment() {
        commentsRef.current.scrollToBottom();
        addCommentRef.current.focus();
      }
    };
  }, []);
}
```

One method composing two internal refs. The parent asks for an *outcome* —
"scroll and focus the add-comment box" — and the component decides how. That is a
genuine API: the internals can be restructured freely as long as the method keeps
its meaning, which is precisely what handing over a raw node destroys
([topic 02 · 02](02-dom-refs/02-crossing-boundaries.md)).

**A good handle is verbs, not nodes.**

## Gotchas

**Symptom:** the parent's `ref.current` is `undefined`.
**Cause:** `useImperativeHandle` returns `undefined`; what the parent receives is
what `createHandle` returns — and it must actually return something.
**Fix:** return the object from `createHandle`. A concise arrow with a block body
returns nothing unless you write `return`.

**Symptom:** a stored `ref.current` stops working after a re-render.
**Cause:** a dependency changed, or the array was omitted, so React rebuilt the
handle and the stored reference is stale.
**Fix:** give the array the values the methods actually read, and re-read
`ref.current` at call time rather than caching it.

**Symptom:** the linter demands a dependency the handle "does not need".
**Cause:** a method reads a prop or state, so the handle genuinely depends on it.
**Fix:** the same rules as an effect — declare it, or restructure so it is not read
([Phase 4 · 11](../phase-4-effects/11-removing-dependencies/README.md)).

**Symptom:** an imperative handle exposes `{ open, close }`.
**Cause:** state expressed as actions — the case the docs name explicitly.
**Fix:** take `isOpen` as a prop.

**Symptom:** an older component uses `forwardRef` and a reviewer flags it.
**Cause:** pre-19 style; `ref` is a prop in React 19.
**Fix:** destructure `ref` from props. `forwardRef` still works, so this is not
urgent.

**Symptom:** `useImperativeHandle` used just to pass the node through.
**Cause:** if the handle is the node, the hook is doing nothing.
**Fix:** pass the `ref` prop straight to the element. The hook is for *narrowing*.

## Interview questions

**★ What does `useImperativeHandle` do?**
It replaces what the parent's `ref` receives with an object you construct, instead
of the DOM node. The component keeps a private ref to the real node and exposes only
the methods it chooses, so the parent can call `focus()` but cannot read `.value`,
change styles or walk the DOM. The hook itself returns `undefined` — the handle is
the return value of `createHandle`.

**★ When should you *not* use it?**
Whenever the behaviour can be expressed as a prop. The docs name the exact
temptation: a `Modal` exposing `{ open, close }` should take `isOpen` as a prop
instead. Refs are for imperative moments — focusing, scrolling, selecting text,
triggering an animation — not for state the parent already owns. A useful test is
whether you would want it re-applied on remount: state yes, action no.

**★ What does the third argument do, and what happens if you omit it?**
It is a dependency array with exactly an effect's semantics — inline, constant
size, compared with `Object.is`. If a dependency changes, or if you omit the array
entirely, `createHandle` re-executes and the new handle is assigned to the ref. So
omitting it rebuilds the handle every render, which breaks any parent that cached
`ref.current`.

**How does React 19 change this?**
`ref` is a regular prop, so the component destructures it from props and passes it
to `useImperativeHandle` directly. Before 19 you had to wrap the component in
`forwardRef` and take `(props, ref)`. The old form still works, which is why most
existing examples look different.

**What makes a good imperative handle?**
Verbs, not nodes. react.dev's second example exposes a single
`scrollAndFocusAddComment()` that composes two internal refs — the parent asks for
an outcome and the component decides how to achieve it. That keeps the internals
free to change, which is exactly what handing over a raw DOM node gives away.

---

← Prev: [Ref callbacks](06-ref-callbacks.md) · Index: [Phase 5](README.md) · Next → [When a ref is the wrong tool](08-when-a-ref-is-wrong.md)
