---
title: "Why hooks replaced them, and where they remain"
sidebar_label: "02 · Why hooks replaced them"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — the legacy
> [Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html)
> guide for the conventions; react.dev
> [`memo`](https://react.dev/reference/react/memo),
> [`forwardRef`](https://react.dev/reference/react/forwardRef),
> [`Suspense`](https://react.dev/reference/react/Suspense),
> [`Profiler`](https://react.dev/reference/react/Profiler) and
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> ⚠️ Library examples are named to illustrate the shape, not as version-specific
> API claims. Judgements are marked.
> No sandbox script backs this page; claims are cited, not measured.

**Hooks took almost everything. The residue is real, and it has a precise
boundary.**


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
  class components ([topic 14](../14-class-components/README.md)), so a wrapper is
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

## Composition order is invisible and it matters

```jsx
export default withRouter(withTheme(withUser(Profile)));
```

Read outside-in: `withRouter` wraps everything; `withUser` is closest to
`Profile`. That ordering decides two things a reader cannot see from the call
site:

**Which injection wins a collision.** If `withTheme` and `withUser` both inject
`color`, the one applied *later* — further out — spreads last into the inner
tree, so it wins. Reversing the composition silently changes behaviour.

**Which wrapper can see which.** A HOC can only read context provided *above*
it. If `withUser` needs a value that `withRouter` provides, `withUser` has to be
inside it. Getting this backwards produces `undefined` on first paint and nothing
that names the cause.

A `compose` helper makes it terser and no clearer:

```jsx
const enhance = compose(withRouter, withTheme, withUser);   // same order, still invisible
export default enhance(Profile);
```

*(Judgement:)* if you must compose more than two, write the nesting out
explicitly and comment the constrained pairs. Terseness is not the problem
composition order has.

## Statics, and the library that exists for it

Caveat 2 has a standard mitigation — `hoist-non-react-statics` copies every
non-React static from the wrapped component onto the wrapper.

What it deliberately does **not** copy is the point:

- React's own statics — `displayName`, `defaultProps`, `propTypes`,
  `contextType`, and the class lifecycle statics such as
  `getDerivedStateFromProps` and `getDerivedStateFromError`. Copying those would
  make the wrapper behave as if it were the wrapped component.
- Anything on the prototype. It copies statics, not instance members.

⚠️ **So the caveat is mitigated, not removed.** A framework static like Next.js's
`getInitialProps` is copied; a `defaultProps` you were relying on is not. If your
HOC needs to preserve a React static, you have to do it deliberately and know
why.

*(Judgement: in new code, prefer not having statics to reach for. A named export
beside the component is easier to reason about than a property that may or may
not survive wrapping.)*

## Gotchas

**A HOC that returns `Wrapped` unchanged in some branch changes the type
conditionally**, so the tree remounts when the branch flips. If a HOC can be a
no-op, make it a no-op *wrapper*, not a bypass.

**Injecting after the spread means callers can never override.** Writing
`<Wrapped {...props} user={user} />` lets the HOC win; reversing it to
`<Wrapped user={user} {...props} />` lets the caller win. Both are defensible;
silently picking one and not documenting it is not.

**Two HOCs injecting the same prop name have no error and no warning.** The
outcome depends on composition order, which is not visible where the component is
used.

**`hoist-non-react-statics` does not copy `defaultProps`**, and React 19 removed
`defaultProps` for function components anyway — so code relying on both is
doubly stale.

**A HOC around a memoized component usually defeats the memoization**, because
the wrapper passes fresh objects or closures through. Memoize the outermost
thing, or nothing.

**`React.memo` and `forwardRef` are HOCs you already use.** Recognising that is
useful: it is why `memo(forwardRef(X))` and `forwardRef(memo(X))` are not
interchangeable, and why the order shows up in migration guides.

**Wrapping a Server Component in a HOC that calls hooks makes it a Client
Component** — the wrapper is the thing being rendered, and it needs
`'use client'`. Chunk 03 covers the boundary.

**Error-boundary HOCs still need a class underneath.** The wrapper is ergonomic
sugar; the boundary itself remains a class component
([topic 14](../14-class-components/README.md)).

**A HOC is not a place for side effects at module scope.** `withAnalytics(X)`
that registers something when the module loads runs on import, including during
SSR and during a test that only meant to import the type.

## Interview questions

**Why did hooks replace HOCs?**
Same reasons as render props — no extra tree nodes, values usable anywhere, no
nesting — plus two problems specific to HOCs: prop collisions are silent, and a
stack of wrappers makes "where does this prop come from?" unanswerable locally.

**Where do HOCs genuinely remain?**
Where behaviour must wrap a component from the *outside* rather than run inside
its render: error boundaries, Suspense or Activity boundaries, profiling and
instrumentation, feature flags that render something else entirely — and
`React.memo` and `forwardRef`, which are HOCs.

**What is the one-sentence test?**
Does this add behaviour *to* the component's render, or *around* it? Inside is a
hook; around is a HOC.

**Why is composition order dangerous?**
It decides which injection wins a name collision and which wrapper can read
which context — and neither is visible at the call site. Reversing two HOCs can
change behaviour with no error.

**What does `hoist-non-react-statics` do, and what does it refuse to do?**
It copies non-React statics from the wrapped component to the wrapper. It
deliberately skips React's own statics — `displayName`, `propTypes`,
`defaultProps`, `contextType`, the lifecycle statics — because copying those
would make the wrapper impersonate the component.

**Why set `displayName`?**
Without it every wrapped component appears under the wrapper's own name in
DevTools, so a tree of `WithUser` nodes tells you nothing about what is inside
them.

**Should a HOC's injection win over the caller's props, or lose?**
Either is defensible — spread order decides it. What is not defensible is
choosing silently; the behaviour is invisible to the caller.

**Are `memo` and `forwardRef` HOCs?**
Yes — both take a component and return a new one. That is also why their nesting
order matters when they are combined.

---

← Prev: [01 · The pattern and the caveats](01-the-pattern-and-the-caveats.md) · Index: [Higher-order components](README.md) · Next → [03 · Writing, typing and retiring one](03-writing-typing-retiring.md)
