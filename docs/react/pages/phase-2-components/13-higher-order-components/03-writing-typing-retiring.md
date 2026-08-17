---
title: "Writing, typing and retiring one"
sidebar_label: "03 · Writing, typing and retiring one"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) for the
> client-boundary rule, [React v19](https://react.dev/blog/2024/12/05/react-19)
> for `ref` as a prop and the removal of `defaultProps` from function
> components, and the legacy
> [HOC guide](https://legacy.reactjs.org/docs/higher-order-components.html).
> TypeScript utility types from the
> [handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html).
> ⚠️ The typing recipe, the testing approach and the migration steps are
> **engineering judgement** built on those documented APIs, and are marked as
> such.
> No sandbox script backs this page; claims are cited, not measured.

**Most people meeting this page will delete a HOC rather than write one. Both are
here.**

## Typing a HOC

The hard part is not the function — it is expressing *"this component's props,
minus the ones I inject"*.

```tsx
import type { ComponentType } from 'react';

type InjectedProps = { user: User };

function withUser<P extends InjectedProps>(
  Wrapped: ComponentType<P>,
): ComponentType<Omit<P, keyof InjectedProps>> {
  function WithUser(props: Omit<P, keyof InjectedProps>) {
    const user = useContext(UserContext);
    return <Wrapped {...(props as P)} user={user} />;
  }
  WithUser.displayName = `withUser(${Wrapped.displayName ?? Wrapped.name ?? 'Component'})`;
  return WithUser;
}
```

Read the signature: the wrapped component requires `user`; the returned component
requires everything *except* `user`, because the HOC supplies it. That
`Omit<P, keyof InjectedProps>` is the whole idea, and it is what makes
`<Profile />` type-check without a `user` prop while `Profile` itself still
requires one.

**And the cast is not laziness.** TypeScript cannot prove that
`Omit<P, 'user'> & { user: User }` is assignable to `P` for an arbitrary generic
`P` — it is true for every concrete `P` and not provable in general. Essentially
every typed HOC contains that cast. *(Judgement: it is contained to one line and
acceptable; a HOC where you need several casts is telling you something.)*

⚠️ **Composing typed HOCs compounds the problem.** Each layer wraps the props
type in another `Omit`, error messages expand into the full intersection, and a
`compose()` helper cannot be typed generically for an arbitrary number of
arguments — the common libraries hard-code overloads up to some arity and give up
after that.

## The Server Component boundary

**A HOC that calls hooks produces a Client Component**, because the wrapper is
what actually renders. So:

```jsx
// ❌ the wrapper needs 'use client', so everything it wraps is client-rendered
export default withUser(ProductPage);
```

If `ProductPage` was a Server Component doing data access, wrapping it has
quietly moved it to the client — or failed to build, depending on what it uses.

*(Judgement, and it is the practical rule:)* **in an RSC application, wrap at the
leaf, not at the page.** Put the HOC around the small interactive component that
actually needs the injected value, and leave the server component alone.

The alternative that does compose cleanly is passing server content through as
`children` — a client wrapper can render server-rendered children —
[Server Components as `children`](../../phase-10-server-components/07-server-components-as-children.md).

## Testing a HOC

*(Judgement.)* There are two things to test and they are usually confused.

**The HOC itself**, with a trivial probe component:

```jsx
const Probe = jest.fn(() => null);
const Wrapped = withUser(Probe);

render(<UserContext value={alice}><Wrapped id="x" /></UserContext>);

expect(Probe).toHaveBeenCalledWith(
  expect.objectContaining({ id: 'x', user: alice }),   // passes through AND injects
  undefined,
);
```

That asserts the two things a HOC promises: it forwards unrelated props, and it
injects its own.

**The wrapped component**, which should be tested by importing the *unwrapped*
export:

```jsx
export function Profile({ user }) { … }        // export both
export default withUser(Profile);
```

Testing the default export means constructing whatever context the HOC needs
before you can assert anything about the component. Exporting the inner component
is the cheapest fix and it is worth doing at the moment you write the HOC.

⚠️ Also assert `displayName` if your snapshots or error messages depend on it —
it is the kind of thing that silently regresses.

## Retiring one

Most HOCs in a modern codebase should become hooks. The recipe:

1. **Does the HOC only inject values?** Then it is a hook. Move the body into
   `useX()`, and have the component call it directly.
2. **Does it render something around the component** — a boundary, a portal, a
   fallback? Then it stays. That is [chunk 02](02-why-hooks-replaced-them.md)'s
   boundary, and a hook cannot do it.
3. **Both?** Split: a hook for the injection, a small wrapper component for the
   surrounding element. Callers usually only need the hook.
4. **Migrate incrementally.** Keep the HOC as a shim over the new hook so nothing
   breaks:

```jsx
export function useUser() { return useContext(UserContext); }

export function withUser(Wrapped) {                 // now three lines
  function WithUser(props) { return <Wrapped {...props} user={useUser()} />; }
  WithUser.displayName = `withUser(${Wrapped.displayName ?? Wrapped.name ?? 'Component'})`;
  return WithUser;
}
```

5. **Delete the shim when the last caller is gone**, not before — and use the
   type system or a lint rule to find them rather than grep, because a HOC can be
   applied through an alias.

⚠️ **Do not migrate a HOC that is in group 2 just to be rid of HOCs.** Replacing
`withErrorBoundary` with something hook-shaped produces worse code, and error
boundaries still require a class underneath regardless.

## Gotchas

**The cast in a typed HOC is unavoidable, and more than one is a smell.** If you
need casts in several places, the HOC is probably doing two jobs.

**A `compose()` helper cannot be typed for arbitrary arity.** Libraries provide
overloads up to a fixed count; past that you lose inference silently.

**Wrapping a page-level Server Component moves it to the client.** Wrap the leaf
that needs the value, not the route.

**Testing only the default export makes every test set up the HOC's context.**
Export the unwrapped component too — one extra line, and it removes the need for
provider scaffolding in unrelated tests.

**`displayName` regressions are invisible until someone reads a stack trace.**
Assert it if it matters to you.

**Deleting a HOC by grep misses aliased applications.** `const enhance =
withUser` and `compose(withUser, …)` do not match a search for `withUser(`.

**A three-line shim is nearly free and prevents a breaking change** — keeping one
during migration is almost always correct.

**`defaultProps` no longer applies to function components in React 19**, so a HOC
that relied on it — or on hoisting it — is stale in two directions at once.

**Retiring the last HOC is not a goal.** Some behaviours are structurally
outside-the-component, and forcing them into hooks is how you end up with a
`useErrorBoundary` that does not catch anything.

## Interview questions

**How do you type a HOC?**
Make it generic over the wrapped component's props `P`, require that `P` includes
the injected props, and return a component whose props are
`Omit<P, keyof Injected>` — everything the wrapped component needs except what
the HOC supplies.

**Why does that implementation need a cast?**
Because TypeScript cannot prove `Omit<P, 'user'> & { user: User }` is assignable
to an arbitrary generic `P`. It holds for every concrete `P` and is not provable
in general, so essentially every typed HOC contains one contained cast.

**What happens if you wrap a Server Component in a HOC that uses hooks?**
The wrapper becomes the rendered component and needs `'use client'`, so the thing
it wraps is pulled to the client — or the build fails, depending on what it uses.
Wrap the interactive leaf instead of the page.

**How should a HOC be tested?**
Two separate things: the HOC, with a probe component asserting that unrelated
props pass through and the injected ones arrive; and the wrapped component, by
exporting and importing it unwrapped so tests need no provider scaffolding.

**How do you migrate a HOC to a hook?**
If it only injects values, move the body into a hook and call it directly. If it
renders something around the component, keep it. If both, split, and leave the
HOC as a three-line shim over the hook so callers do not break.

**When should you not migrate?**
When the behaviour is structurally around the component — error boundaries,
Suspense boundaries, portals, profiling. Forcing those into hook shape produces
worse code, and boundaries still need a class underneath.

**Why is grep a bad way to find the last callers?**
A HOC can be aliased or passed to `compose`, so `withUser(` does not match every
application. Use the type system or a lint rule.

**What changed in React 19 that affects old HOCs?**
`ref` became an ordinary prop, so the forwarding caveat mostly dissolves; and
`defaultProps` no longer applies to function components, which breaks HOCs that
relied on it or on hoisting it.

---

← Prev: [02 · Why hooks replaced them](02-why-hooks-replaced-them.md) · Index: [Higher-order components](README.md)
