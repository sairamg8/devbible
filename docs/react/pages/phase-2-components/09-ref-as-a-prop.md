---
title: "ref as a prop (React 19)"
sidebar_label: "09 · ref as a prop"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [React v19](https://react.dev/blog/2024/12/05/react-19) §*ref as a prop*, the
> [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
> (string refs, `findDOMNode`, ref cleanup) and the deprecation notice on
> [`forwardRef`](https://react.dev/reference/react/forwardRef). No sandbox
> script backs this page; claims are cited, not measured.

**For seven years `ref` was the one thing that looked like a prop and was not.
React 19 made it one — and quietly retired the API built to work around it.**

## What changed

The React 19 post, verbatim:

> Starting in React 19, you can now access `ref` as a prop for function
> components

> New function components will no longer need `forwardRef`, and we will be
> publishing a codemod to automatically update your components to use the new
> `ref` prop. In future versions we will deprecate and remove `forwardRef`.

And the `forwardRef` reference page now carries a deprecation block:

> In React 19, `forwardRef` is no longer necessary. Pass `ref` as a prop
> instead.
>
> `forwardRef` will be deprecated in a future release.

Note the exact status, because it is frequently overstated: `forwardRef` is
**not removed in 19**. It works. It is documented as unnecessary and slated for
deprecation and eventual removal, on no announced schedule.

```jsx
// Before — React 18
const Input = forwardRef(function Input(props, ref) {
  return <input ref={ref} {...props} />;
});

// After — React 19
function Input({ref, ...props}) {
  return <input ref={ref} {...props} />;
}
```

## Why `ref` was special in the first place

Worth understanding, because it explains several older bugs you will meet in
existing code.

`ref` and `key` were both stripped from props by JSX and handled by React
itself. For `key` that is still true — Phase 1's
[JSX is a function call](../phase-1-jsx/01-jsx-is-a-function-call.md) shows it
being passed as a third argument, not a prop. For `ref` the reason was that a
class component's ref meant "the instance", something React had to wire up, and
function components had no instance to give. So `ref` on a function component
was simply ignored, with a warning.

That produced the two symptoms every React codebase has seen:

- **`Function components cannot be given refs.`** A warning telling you to use
  `forwardRef`, on a component that looked like it should just work.
- **Refs silently not passed through HOCs.** The legacy HOC documentation names
  it: *"Ref is not really a prop"* and is not forwarded by default, so a ref on
  a wrapped component pointed at the wrapper, not the thing you wanted.

Making `ref` an ordinary prop dissolves both. It travels through spreads,
through wrappers, through HOCs, through anything that forwards props — because
it *is* a prop.

## What this makes easy

**Spreading now carries the ref.**

```jsx
function Field({label, ...rest}) {
  return <label>{label}<input {...rest} /></label>;   // ref included in rest
}
<Field label="Name" ref={inputRef} />                  // reaches the <input>
```

**A wrapper no longer needs to know about refs.** Any component that already
forwards `...rest` to a DOM element forwards refs for free.

**HOCs stop losing refs**, provided they spread props — which most do. The old
`forwardRef`-inside-the-HOC dance disappears.

**`useImperativeHandle` still works**, and now takes the ref from props:

```jsx
function Modal({ref}) {
  const dialog = useRef(null);
  useImperativeHandle(ref, () => ({
    open: () => dialog.current.showModal(),
    close: () => dialog.current.close(),
  }), []);
  return <dialog ref={dialog}>…</dialog>;
}
```

## Ref cleanup functions

React 19 also changed what a ref *callback* may return. The upgrade guide covers
the TypeScript consequence:

> Due to the introduction of ref cleanup functions, returning anything else from
> a ref callback will now be rejected by TypeScript. The fix is usually to stop
> using implicit returns:
>
> ```diff
> - <div ref={current => (instance = current)} />
> + <div ref={current => {instance = current}} />
> ```

The original code returned the `HTMLDivElement`, and React can no longer tell
whether that was meant to be a cleanup function. So a ref callback now either
returns nothing, or returns a cleanup function that React calls on detach:

```jsx
<div ref={node => {
  const observer = new ResizeObserver(onResize);
  observer.observe(node);
  return () => observer.disconnect();     // ✅ cleanup, called on detach
}} />
```

That is a genuine improvement over the old convention of being called with
`null` on detach — but the migration hazard is the implicit arrow return, which
is a very common way to write a ref callback. The codemod is
`no-implicit-ref-callback-return`, in the `react-19` preset.

## Migration

**The `ref`-as-a-prop change is backwards compatible in the direction that
matters.** `forwardRef` components keep working, so there is no forced rewrite.
Convert opportunistically, or run the codemod. The TypeScript-side changes ship
in the `react-19` codemod preset as `scoped-jsx`.

Two related removals in the same release are *not* backwards compatible, and
both are worth grepping for:

```bash
npx codemod@latest react/19/replace-string-ref
```

> In React 19, we're removing string refs to make React simpler and easier to
> understand.

`<input ref="input" />` with `this.refs.input` no longer works. Class components
only, so this hits older code specifically.

And `findDOMNode` is gone:

> We're removing `findDOMNode` because it was a legacy escape hatch that was
> slow to execute, fragile to refactoring, only returned the first child, and
> broke abstraction levels.

The replacement is an ordinary ref on the element you actually want.

## Does anything still need `forwardRef`?

The documentation does not name remaining use cases, so treat what follows as
reasoning rather than citation.

**Libraries supporting React 18 and earlier.** `ref` as a prop does not exist in
18, so a component published for both must either use `forwardRef` or ship
version-specific builds. This is the substantive reason `forwardRef` still
appears in current library source, and it will remain true for as long as the
library supports 18.

**Existing code.** There is no benefit to a mechanical rewrite of working
`forwardRef` components; convert them when you are editing them anyway.

For new application code targeting React 19, there is no case for it.

## Gotchas

**Symptom:** `ref` is `undefined` inside a React 19 function component.
**Cause:** the component is still wrapped in `forwardRef`, which delivers the
ref as the second argument, not in props.
**Fix:** pick one form. Inside `forwardRef`, use the second parameter; outside
it, destructure `ref` from props.

**Symptom:** a ref callback stopped type-checking after upgrading.
**Cause:** an implicit arrow return — `ref={el => (this.x = el)}` — which React
19 now interprets as a cleanup function.
**Fix:** add braces so it returns nothing. Codemod:
`no-implicit-ref-callback-return`.

**Symptom:** `this.refs` is empty in a class component after upgrading.
**Cause:** string refs were removed in React 19.
**Fix:** ref callbacks or `createRef`. Codemod:
`npx codemod@latest react/19/replace-string-ref`.

**Symptom:** a ref reaches a wrapper instead of the DOM node it was meant for.
**Cause:** the wrapper consumes `ref` and does not pass it on — usually because
it destructures `ref` and forgets it, which is now possible in a way it was not
before.
**Fix:** forward it explicitly, or leave it in `...rest`.

**Symptom:** `findDOMNode is not a function` after upgrading.
**Cause:** removed in React 19, often from a transitive dependency rather than
your own code.
**Fix:** a ref on the element. If it is a dependency, that dependency needs an
update — there is no shim worth adding.

**Symptom:** `ref.current` is `null` during render.
**Cause:** not a React 19 issue. Refs are attached during commit, after render.
**Fix:** read refs in effects and event handlers, never during render — which is
also the purity rule ([topic 02](02-purity/01-the-two-rules.md)).

## Interview questions

**★ What changed about `ref` in React 19?**
It became an ordinary prop for function components. Previously JSX stripped
`ref` out of props and React handled it separately, which is why function
components could not receive one without `forwardRef`. Now it arrives in the
props object, travels through spreads and wrappers like any other prop, and
`forwardRef` is documented as unnecessary.

**★ Is `forwardRef` removed?**
No. It is documented as no longer necessary and carries a deprecation notice
saying it will be deprecated in a future release, with removal intended after
that. Existing `forwardRef` components keep working in 19, so there is no forced
migration. A codemod exists for the TypeScript side, in the `react-19` preset.

**★ Why did function components need `forwardRef` at all?**
Because `ref` was not a prop. React intercepted it, and for a class component it
meant "the instance" — something a function component does not have. So React
ignored `ref` on function components and warned about it, and `forwardRef` was
the explicit opt-in that said "give me the ref as a second argument and I will
attach it myself".

**What are ref cleanup functions?**
A ref callback in React 19 may return a function, which React calls when the ref
detaches — replacing the older convention of being called again with `null`. The
migration hazard is that an implicit arrow return now looks like a cleanup
function, so `ref={el => (x = el)}` must become `ref={el => {x = el}}`.

**What else about refs was removed in React 19?**
String refs (`ref="input"` with `this.refs.input`), which were class-only and
deprecated since 2018, and `findDOMNode`, which was slow, fragile to
refactoring, returned only the first child and broke abstraction boundaries.
Both have codemods; both are replaced by an ordinary ref on the element you
want.

**Would you still write `forwardRef` today?**
In a library that supports React 18 alongside 19, yes — `ref` as a prop does not
exist in 18. In new application code on React 19, no. And there is no reason to
rewrite working `forwardRef` components mechanically; convert them when you are
already editing the file.

---

← Prev: [Children patterns](08-children-patterns.md) · Index: [Phase 2](README.md) · Next → [Component boundaries](10-component-boundaries.md)
