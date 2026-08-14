---
title: "The context re-render problem"
sidebar_label: "05 · The context re-render problem"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useContext`](https://react.dev/reference/react/useContext) (Caveats, and
> § Optimizing re-renders when passing objects and functions) and
> [`createContext`](https://react.dev/reference/react/createContext).
> No sandbox script backs this page; claims are cited, not measured.

**Context has exactly one performance failure mode, and it is structural: a
consumer subscribes to the whole value, so any change to any part of it re-renders
every consumer. Everything here is a way of arranging code so that "the whole
value" is smaller.**

## The mechanism

> React **automatically re-renders all children that use a particular context**
> starting from the provider that receives a different `value`. The previous and
> next values are compared with `Object.is`.

Two consequences, and the second is the one that surprises:

**An inline object is a new value every render.** `value={{user, login}}` fails
`Object.is` every time, so every consumer re-renders on every render of the
provider's parent — even when nothing inside actually changed.

**Even a correct value re-renders everyone.** If `user` genuinely changes, every
component reading that context re-renders, including the ones that only ever use
`login`. There is no partial subscription.

## 🔴 There is no selector

Look at the signature:

```jsx
const value = useContext(SomeContext);
```

> **Parameters** — `SomeContext`: The context previously created with
> `createContext`.

One parameter. There is no second argument for "the part of the value I care
about", no equality function, and no way to say *re-render me only when
`value.theme` changes*. A consumer subscribes to the **context**, not to a field of
it.

This is why the fixes below are all about **splitting**, not about filtering. You
cannot make the subscription narrower, so you make the value narrower.

It is also the honest answer to "should I use context instead of a state library?"
— libraries like Zustand or Redux exist partly because they *do* offer selector
subscriptions. [Topic 11](11-what-context-is-and-is-not.md) takes that comparison
properly.

## `memo` does not help

> **Skipping re-renders with `memo` does not prevent the children from receiving
> fresh context values.**

`memo` compares props. A context update is not a prop change — it reaches consumers
directly, by design, because a memoized component displaying a stale theme would be
a correctness bug.

So the usual optimisation reflex fails here, and failing quietly: wrapping the
consumer in `memo` looks like it should work, changes nothing, and sends people
looking for a different explanation.

**`memo` does still help one thing** — it stops the *intermediate* components
between the provider and the consumer from re-rendering, if they do not read the
context themselves. It just cannot protect the consumer.

## Fix 1 — memoize the value

The floor, and the one the docs give directly:

```jsx
function MyApp() {
  const [currentUser, setCurrentUser] = useState(null);

  const login = useCallback((response) => {
    storeCredentials(response.credentials);
    setCurrentUser(response.user);
  }, []);

  const contextValue = useMemo(() => ({
    currentUser,
    login
  }), [currentUser, login]);

  return (
    <AuthContext value={contextValue}>
      <Page />
    </AuthContext>
  );
}
```

Both halves are required. `useMemo` gives the object a stable identity; `useCallback`
gives `login` one, or the memo's own dependency array would change every render and
the memo would do nothing.

This fixes the *spurious* re-renders — those caused by the provider's parent
re-rendering for unrelated reasons. It does **not** fix the structural problem: when
`currentUser` changes, every consumer still re-renders.

## Fix 2 — split state from dispatch

The highest-value move, and it exploits `dispatch` being stable
([topic 03](03-usereducer.md)):

```jsx
const AuthStateContext = createContext(null);
const AuthDispatchContext = createContext(null);

function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  return (
    <AuthStateContext value={state}>
      <AuthDispatchContext value={dispatch}>
        {children}
      </AuthDispatchContext>
    </AuthStateContext>
  );
}
```

`dispatch` never changes identity, so `AuthDispatchContext`'s value never changes,
so **its consumers never re-render because of it.** A logout button that only needs
to *cause* a change subscribes to dispatch alone and is completely insulated from
state updates.

This is the shape [topic 12](12-context-plus-reducer.md) builds on, and it is the
reason the phase gate asks for it specifically. Note it needs no memoization at
all — `dispatch` is stable for free, and `state` is a new object only when it
genuinely changed.

The same idea works without a reducer, using `useCallback` for the setters, but the
reducer version is cleaner precisely because stability comes free.

## Fix 3 — split by change frequency

If one context holds several unrelated things, every consumer pays for all of them:

```jsx
// 🔴 one context, three unrelated concerns
<AppContext value={{ theme, currentUser, notifications }}>
```

`notifications` arriving re-renders every component that only wanted `theme`. Split
into contexts that change at different rates:

```jsx
<ThemeContext value={theme}>
  <UserContext value={currentUser}>
    <NotificationsContext value={notifications}>
```

The rule of thumb: **one context per thing that changes for its own reasons.**
Theme changes when the user toggles it; notifications change constantly. Putting
them together means the slow-changing one inherits the fast one's re-render rate.

More providers is not a cost worth worrying about — a provider that does not
re-render is nearly free, and the nesting is a one-time readability tax you can
hide in a single `Providers` component.

## What is actually expensive

Worth keeping proportionate, because context re-renders are over-optimised as often
as they are ignored.

A re-render is not automatically a problem. React re-rendering a small component
that produces identical output costs a function call and a diff that finds nothing
to do. The cases that genuinely matter:

- a consumer high in the tree, so re-rendering it re-renders a large subtree;
- a consumer doing expensive work during render;
- a very frequently changing value — a mouse position, a timer, a live feed;
- a long list where every row is a consumer.

If none of those apply, memoize the value and stop. Measure with the Profiler
before splitting a context five ways
([Phase 0 · 12](../phase-0-how-react-runs/12-devtools-and-profiler.md)); Phase 6 is
where this becomes a whole subject.

## Gotchas

**Symptom:** every consumer re-renders whenever the provider's parent renders,
even with nothing changed.
**Cause:** an inline object as `value` — a new identity every render, failing
`Object.is`.
**Fix:** `useMemo` the value, `useCallback` the functions inside it.

**Symptom:** the value is memoized and consumers still re-render every time.
**Cause:** a function in the dependency array is recreated each render, so the
memo's own deps change.
**Fix:** `useCallback` that function too. The memo is only as stable as its
dependencies.

**Symptom:** wrapping a consumer in `memo` changes nothing.
**Cause:** `memo` compares props; context updates bypass it by design.
**Fix:** split the context. `memo` can only protect intermediate components that
do not read the context.

**Symptom:** a component that only uses one field re-renders when an unrelated
field changes.
**Cause:** there is no selector — a consumer subscribes to the whole context value.
**Fix:** split the context so that field lives in its own.

**Symptom:** a button that only dispatches re-renders on every state change.
**Cause:** it reads a combined `{state, dispatch}` context.
**Fix:** a separate dispatch context. `dispatch` is stable, so that context's value
never changes.

**Symptom:** a context was split five ways and the app is no faster.
**Cause:** the re-renders were cheap; the problem was elsewhere.
**Fix:** profile first. A re-render producing identical output is not the same as
a performance problem.

## Interview questions

**★ Why does changing one field of a context value re-render every consumer?**
Because a consumer subscribes to the context, not to part of its value.
`useContext` takes only the context as a parameter — there is no selector and no
equality function — so React re-renders every component reading that context when
the provider's value fails an `Object.is` comparison, regardless of which field
changed or which fields the component actually uses.

**★ Why doesn't `memo` fix context re-renders?**
`memo` compares props, and a context update is not a prop change. The docs state
directly that skipping re-renders with `memo` does not prevent children from
receiving fresh context values — which is required for correctness, since a
memoized component must not display a stale theme. `memo` can still stop
intermediate components that do not read the context from re-rendering, but it
cannot protect the consumer.

**★ What is the highest-value fix, and why does it work?**
Splitting state and dispatch into two contexts. `dispatch` from `useReducer` has a
stable identity, so the dispatch context's value never changes and its consumers
never re-render because of it — a logout button can cause changes while being
completely insulated from them. It also needs no memoization, because the
stability comes for free rather than from a `useCallback` you have to maintain.

**Is memoizing the context value enough?**
It fixes the spurious re-renders — the ones caused by the provider's parent
re-rendering for unrelated reasons — and it is the documented minimum. It does not
fix the structural problem: when the value legitimately changes, every consumer
still re-renders. That needs splitting, because you cannot narrow the
subscription, only the value.

**How do you decide where to split a context?**
By change frequency. One context per thing that changes for its own reasons —
theme when the user toggles it, notifications constantly. Combining them makes the
slow-changing value inherit the fast one's re-render rate. Extra providers are
close to free when they do not re-render, and the nesting can be hidden in a single
`Providers` component.

**When is a context re-render actually worth fixing?**
When the consumer is high in the tree so a large subtree re-renders, when it does
expensive work during render, when the value changes very frequently, or when every
row of a long list is a consumer. A re-render that produces identical output costs
a function call and a diff that finds nothing — profile before splitting a context
five ways.

---

← Prev: [`createContext` and `useContext`](04-createcontext-usecontext.md) · Index: [Phase 5](README.md) · Next → [Ref callbacks](06-ref-callbacks.md)
