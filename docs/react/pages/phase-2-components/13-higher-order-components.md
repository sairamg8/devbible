---
title: "Higher-order components"
sidebar_label: "13 · Higher-order components"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — the legacy
> [Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html)
> guide and its three caveats, plus react.dev
> [React v19](https://react.dev/blog/2024/12/05/react-19) §*ref as a prop*.
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
[render props](12-render-props.md) were the two ways to share stateful logic
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

This is [the nesting rule](01-function-components/02-identity-and-nesting.md)
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
([topic 09](09-ref-as-a-prop.md)). A HOC that spreads `{...props}` now forwards
the ref automatically, because the ref is in `props`. The `forwardRef` dance is
no longer needed for new code.

Two qualifications worth stating precisely, since this is the kind of claim that
gets repeated wrongly:

- **The legacy caveat still describes React 18 and earlier**, which is what a
  library supporting both must handle.
- **A HOC wrapping a *class* component** still has the old behaviour for the
  class's instance ref, because a class ref means the instance and that has not
  changed.

## Why hooks replaced HOCs

The same argument as render props, plus two problems specific to HOCs.

**Prop collisions are silent.** `withUser` injects `user`; if the caller also
passes `user`, one wins depending on spread order and nothing warns.
Two HOCs injecting the same name is worse — the outcome depends on the order
they were composed in, which is invisible at the call site.

**The stack becomes unreadable.** `withRouter(withTheme(withUser(connect(…)(Profile))))`
produces a DevTools tree five wrappers deep, an error stack full of anonymous
`WithX` frames, and a component whose actual props are the union of five
injections none of which appear in its signature. "Where does this prop come
from?" has no local answer.

Hooks have neither problem: the values are named at the call site, in the
component that uses them, by the person writing it.

```jsx
function Profile() {
  const user = useUser();          // ✅ named here, visible here
  const theme = useTheme();
  …
}
```

## Where HOCs remain

Not extinct, and for a specific reason: **a hook cannot wrap a component from
the outside.** When the behaviour must apply *around* a component rather than
inside it, a HOC is the shape:

- **`React.memo`** is a HOC. So is `forwardRef`.
- **Error boundaries** — `withErrorBoundary(Component)`. Boundaries must be
  class components ([topic 14](14-class-components/README.md)), so a wrapper is
  the only ergonomic way to apply one.
- **Instrumentation** — Sentry's `withProfiler`, analytics wrappers, feature
  flags that render a fallback instead of the component.
- **Injecting a Suspense or Activity boundary** around a component.
- **Legacy `connect()`** from older Redux code.

The distinguishing question: does this add behaviour *to* the component's
render, or *around* it? Inside is a hook. Around is a HOC.

## If you write one

Conventions from the legacy guide that are still correct:

```jsx
function withUser(Wrapped) {
  function WithUser({ref, ...props}) {
    const user = useContext(UserContext);
    return <Wrapped ref={ref} {...props} user={user} />;
  }
  WithUser.displayName = `withUser(${Wrapped.displayName || Wrapped.name || 'Component'})`;
  return WithUser;
}
```

- **Set `displayName`.** Without it DevTools shows `WithUser` for every wrapped
  component and the tree becomes unreadable.
- **Pass through all props unrelated to the HOC's concern.** The wrapper should
  be transparent.
- **Inject last or first, deliberately.** `{...props}` then `user={user}` means
  the HOC wins; the reverse lets callers override. Pick one and document it.
- **Do not mutate the wrapped component.** Adding properties to `Wrapped`
  affects every other use of it — the wrapper exists precisely to avoid that.
- **Apply it at module level.** Caveat 1, and it is worth a lint rule.

## Gotchas

**Symptom:** a wrapped component loses its state on every parent render.
**Cause:** the HOC is applied inside a component, producing a new type each
render.
**Fix:** apply it at module scope. This is caveat 1 and it is the most common
HOC bug.

**Symptom:** `Component.someStatic` is `undefined` after wrapping.
**Cause:** statics are not copied to the wrapper.
**Fix:** copy them, or use `hoist-non-react-statics`.

**Symptom:** a ref on a wrapped component points at the wrapper.
**Cause:** React 18 and earlier — `ref` was not a prop, so the spread never
carried it.
**Fix:** on React 19, ensure the HOC spreads props and the ref flows. On 18,
`forwardRef` inside the HOC.

**Symptom:** a prop has an unexpected value and nothing in the component
explains it.
**Cause:** a HOC in the stack is injecting a prop with the same name.
**Fix:** trace the wrappers. This is the readability cost, and the reason to
prefer hooks where possible.

**Symptom:** DevTools shows five `Anonymous` wrappers.
**Cause:** no `displayName` on the returned components.
**Fix:** set it from the wrapped component's name.

## Interview questions

**★ What is a higher-order component?**
A function that takes a component and returns a new component, adding behaviour
by wrapping rather than modifying. Before hooks it was one of the two ways to
share stateful logic between components, alongside render props.

**★ What are the three documented caveats?**
Do not apply a HOC inside `render` — it creates a new component type every
render, so React unmounts and remounts and all state is lost. Static methods are
not copied to the wrapper. And refs are not passed through, because `ref` was
not a prop — though React 19 changed that last one, since `ref` is now an
ordinary prop and a HOC that spreads props forwards it automatically.

**★ Why did hooks largely replace HOCs?**
Prop collisions are silent and order-dependent, the wrapper stacks make DevTools
and error stacks unreadable, and a component's real props become the union of
several invisible injections. Hooks name their values at the point of use, in
the component that uses them, so "where does this come from" has a local answer.

**Are HOCs obsolete?**
No — a hook cannot wrap a component from the outside. `memo` and `forwardRef`
are HOCs. Error boundaries need one, because boundaries must be classes.
Instrumentation, feature flags, and injecting Suspense boundaries are all HOC
shaped. The test is whether the behaviour goes inside the component's render or
around it.

**Why must a HOC set `displayName`?**
Because DevTools and error stacks otherwise show the wrapper's own name — or
nothing — for every wrapped component, and a stack of four wrappers becomes
impossible to read. Convention is
`withUser(Profile)`, derived from the wrapped component's name.

**Does React 19 change how you write a HOC?**
Yes, in one respect: `ref` is now an ordinary prop, so a HOC that spreads props
forwards refs without `forwardRef`. Everything else — module-level application,
statics, `displayName`, transparency — is unchanged.

---

← Prev: [Render props and function-as-children](12-render-props.md) · Index: [Phase 2](README.md) · Next → [Class components](14-class-components/README.md)
