---
title: "The pattern and the three caveats"
sidebar_label: "01 · The pattern and the caveats"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — the legacy
> [Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html)
> guide and its three caveats, quoted below; react.dev
> [React v19](https://react.dev/blog/2024/12/05/react-19) §*ref as a prop*;
> [`memo`](https://react.dev/reference/react/memo) and
> [`forwardRef`](https://react.dev/reference/react/forwardRef).
> No sandbox script backs this page; claims are cited, not measured.

**A function that takes a component and returns a new one. Three documented
failure modes, all still true, and one of them was fixed by React 19 without
anyone announcing it.**


## The pattern

> A higher-order component is a function that takes a component and returns a
> new component.

```jsx
function withUser(Wrapped) {
  return function WithUser(props) {
    const user = useContext(UserContext);
    return <Wrapped {...props} user={user} />;
  };
}

const ProfileWithUser = withUser(Profile);      // ✅ at module level
```

The HOC does not modify the component it receives — it wraps it. The result is a
new component that renders the original with extra props. Before hooks, this and
[render props](../12-render-props/README.md) were the two ways to share stateful logic
between components.

Note where `withUser(Profile)` is called: **module level, once.** That placement
is the whole of caveat 1.

## Caveat 1 — never apply a HOC during render

> **Don't Use HOCs Inside the render Method**

The reason, from the same guide: a new version of the enhanced component is
created on every render, so React sees a different component type at the same
position. React's reconciliation compares by identity, and a different identity
means unmount and remount — full state loss for that component and all its
children, every render.

```jsx
function Page(props) {
  const Enhanced = withUser(Profile);       // 🔴 new type every render
  return <Enhanced {...props} />;
}
```

This is [the nesting rule](../01-function-components/02-identity-and-nesting.md)
arriving in a different costume, and it is the most common HOC bug by a wide
margin. The fix is placement: apply the HOC once, outside any component. If it
genuinely must be computed, `useMemo` it — with the caveat that `useMemo` is a
hint React may discard, so module scope is strictly better where possible.

## Caveat 2 — static methods are not copied

> the new component does not have any of the static methods of the original
> component

```jsx
Profile.fetchData = …;                  // a static on the original
const Enhanced = withUser(Profile);
Enhanced.fetchData;                     // undefined
```

The wrapper is a different function object; it does not inherit anything. Where
this mattered historically was framework conventions built on statics — Next.js
`getInitialProps`, Relay fragment containers. The documented workarounds are to
copy the statics manually or to use `hoist-non-react-statics`, which copies
every non-React static automatically.

Mostly historical now — modern frameworks moved away from component statics —
but it is exactly the kind of thing that produces a silent `undefined` in older
code.

## Caveat 3 — refs are not passed through, and React 19 changed this

> **"Ref is not really a prop"** and isn't passed through by default. When adding
> a ref to a HOC result, the ref references the outermost container component
> instance rather than the wrapped component.

That was true because `ref` was intercepted by JSX rather than being included in
props — so `{...props}` never carried it. The documented fix was
`React.forwardRef` inside the HOC.

**React 19 makes `ref` an ordinary prop for function components**
([topic 09](../09-ref-as-a-prop.md)). A HOC that spreads `{...props}` now forwards
the ref automatically, because the ref is in `props`. The `forwardRef` dance is
no longer needed for new code.

Two qualifications worth stating precisely, since this is the kind of claim that
gets repeated wrongly:

- **The legacy caveat still describes React 18 and earlier**, which is what a
  library supporting both must handle.
- **A HOC wrapping a *class* component** still has the old behaviour for the
  class's instance ref, because a class ref means the instance and that has not
  changed.

## Gotchas

**A wrapped component loses its state on every parent render.** The HOC was
applied inside a component, producing a new type each render. Apply at module
scope — caveat 1, and the most common HOC bug by a wide margin. It is worth a
lint rule.

**`WithUser` everywhere in DevTools.** No `displayName`, so every wrapped
component looks identical and the tree is unreadable. Chunk 02 has the
convention.

**A static you relied on is `undefined` after wrapping.** Caveat 2 — statics are
not copied. `hoist-non-react-statics` handles the general case, and chunk 03
covers what it deliberately does not copy.

**The wrapper adds a real node to the tree.** Five composed HOCs are five
components between the parent and the thing you care about — visible in DevTools,
in the Profiler and in error stacks, and each one re-renders when the one above
does.

**A HOC applied to an anonymous arrow has no name at all.**
`withUser(() => <div/>)` gives `Wrapped.name === ''`, so even the fallback in a
`displayName` template produces `withUser(Component)`.

**Wrapping changes the component's identity, so `key` behaviour changes with
it.** `withUser(A)` and `withUser(A)` called twice produce two *different*
component types, so React unmounts and remounts when you swap between them even
though they wrap the same thing.

**A HOC that calls hooks is subject to the Rules of Hooks itself.** The returned
function component must call them unconditionally — it is a component, not a
helper — and a HOC that conditionally returns `Wrapped` unchanged can break that.

**Do not mutate the component you were given.** Adding a property to `Wrapped`
affects every other use of it in the application. The wrapper exists precisely to
avoid that, and mutating defeats the point.

## Interview questions

**What is a higher-order component?**
A function that takes a component and returns a new component, usually to inject
props or wrap behaviour around it. It does not modify the component it receives.

**What are the three documented caveats?**
Never apply a HOC during render; static methods are not copied to the wrapper;
and refs are not passed through — the last of which React 19 changed by making
`ref` an ordinary prop.

**Why does applying a HOC during render break things?**
It produces a new component *type* on every render, so React unmounts the old
tree and mounts a new one — losing all state below that point.

**Why are statics not copied?**
The wrapper is a different function object. Nothing about wrapping copies
properties from the wrapped component, so anything a caller reached for on the
original — a `getInitialProps`, a `defaultProps`, a named sub-component — is
gone.

**What did React 19 change about caveat 3?**
`ref` became an ordinary prop for function components, so a HOC that spreads its
props forwards refs without `forwardRef`. The caveat as written applied to the
pre-19 model.

**Why does wrapping change remount behaviour?**
Because the returned component is a new type. Two calls to the same HOC with the
same argument produce two distinct types, and switching between them remounts.

**Does a HOC add anything to the rendered tree?**
Yes — one component per HOC. Composing five puts five nodes between the parent
and the component you care about, each of which re-renders in turn.

---

Index: [Higher-order components](README.md) · Next → [02 · Why hooks replaced them, and where they remain](02-why-hooks-replaced-them.md)
