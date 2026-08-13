---
title: "The lifecycle, and the hook each one maps to"
sidebar_label: "02 · Lifecycle and hooks"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`Component`](https://react.dev/reference/react/Component), including its
> `getDerivedStateFromError` and `componentDidCatch` entries and the
> `rename-unsafe-lifecycles` note. No sandbox script backs this page; claims are
> cited, not measured.

**Eleven lifecycle methods, nine of which have a hook equivalent. The two that
do not are the reason error boundaries are still class components in React 19.**

## The mapping

| Class method | What it did | Function equivalent |
|---|---|---|
| `constructor` | Initialise state, bind methods | `useState` initialiser; nothing to bind |
| `render` | Return the UI | The function body |
| `componentDidMount` | After first paint — fetch, subscribe | `useEffect(fn, [])` |
| `componentDidUpdate` | After a re-render | `useEffect(fn, [deps])` |
| `componentWillUnmount` | Cleanup | The function returned from `useEffect` |
| `shouldComponentUpdate` | Skip a render | `memo` ([topic 15](../15-purecomponent.md)) |
| `getDerivedStateFromProps` | Adjust state when props change | Compute during render, or the update-during-render pattern |
| `getSnapshotBeforeUpdate` | Read the DOM before it changes | `useLayoutEffect` (approximately — see below) |
| `forceUpdate` | Re-render without a state change | No equivalent, and none wanted |
| **`getDerivedStateFromError`** | Set state when a child throws | **None** |
| **`componentDidCatch`** | Log the error | **None** |

Plus the three prefixed methods — `UNSAFE_componentWillMount`,
`UNSAFE_componentWillReceiveProps`, `UNSAFE_componentWillUpdate` — which each
carry the same note:

> This API has been renamed… The old name has been deprecated. In a future major
> version of React, only the new name will work. Run the
> `rename-unsafe-lifecycles` codemod to automatically update your components.

They were renamed rather than removed because they are unsafe under concurrent
rendering: they run before the commit, so a render that gets abandoned has
already executed them. Meeting one in a codebase is a signal that the code
predates React 16.3 and has not been audited since.

## The three mappings that are not one-to-one

**`componentDidMount` + `componentDidUpdate` + `componentWillUnmount` are one
effect, not three.** This is the conceptual shift, not a syntax change. The class
model asks "what happens at each moment in a component's life"; the effect model
asks "what needs to stay synchronised with what". An effect with a dependency
array covers mount and update and unmount together, and the cleanup is written
next to the setup it undoes rather than in a different method a hundred lines
away.

The mechanical translation produces correct-but-poor code:

```jsx
useEffect(() => { … }, []);          // componentDidMount
useEffect(() => { … });              // componentDidUpdate (every render)
useEffect(() => () => { … }, []);    // componentWillUnmount
```

Three effects that fire at the right times and completely miss the point. One
effect keyed on what it depends on is almost always the right answer. Phase 4 is
where that argument is made properly.

**`getSnapshotBeforeUpdate` has no exact equivalent.** It ran between render and
the DOM mutation, returning a value handed to `componentDidUpdate` — used for
preserving scroll position while content is inserted above. `useLayoutEffect`
runs *after* the DOM mutation but before paint, which covers most uses but not
the "read the old value first" part. The usual workaround is a ref written
during the previous commit.

**`getDerivedStateFromProps` mostly should not be translated at all.** Its
common use — copying a prop into state — is the duplication problem from
[controlled vs uncontrolled](../04-controlled-vs-uncontrolled/02-the-switch-warning.md).
Derive during render instead. The narrow legitimate case, adjusting state when a
prop changes, has a documented function-component pattern that Phase 3 covers.

## Error boundaries: the exception

The two class methods with no hook equivalent:

> If you define `static getDerivedStateFromError`, React will call it when a
> child component (including distant children) throws an error during rendering.
> This lets you display an error message instead of clearing the UI. Typically,
> it is used together with `componentDidCatch`… A component with these methods
> is called an *Error Boundary*.

And, stated twice in the reference:

> There is no direct equivalent for `componentDidCatch` in function components
> yet.

> **There is currently no way to write an Error Boundary as a function
> component.**

So this is the one place where, in React 19, a class is not merely tolerated but
required:

```jsx
class ErrorBoundary extends React.Component {
  state = {error: null};

  static getDerivedStateFromError(error) {
    return {error};                      // render phase — set state only
  }

  componentDidCatch(error, info) {
    logToService(error, info.componentStack);   // commit phase — side effects
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
```

The division of labour between the two is deliberate and worth knowing: the
static one runs during rendering and may only return state — it must be pure,
same as everything else in the render phase. The instance one runs after the
commit and is where logging belongs, receiving the component stack alongside the
error.

react.dev's own recommendation for avoiding classes:

> If you'd like to avoid creating class components, write a single
> `ErrorBoundary` component like above and use it throughout your app.
> Alternatively, you can use the `react-error-boundary` package which does that
> for you.

Which is the practical answer: one class in the codebase, or one dependency, and
function components everywhere else.

**What error boundaries do not catch** is worth stating, because the gaps are
where people assume coverage they do not have: event handlers, asynchronous code
(`setTimeout`, promise rejections), server-rendered errors, and errors thrown by
the boundary itself. Those need ordinary `try`/`catch` or a global handler.
React 19 added root-level `onUncaughtError` and `onCaughtError` options for
observing what boundaries do and do not handle — Phase 0's
[createRoot](../../phase-0-how-react-runs/06-createroot.md) covers those.

## Reading an old class

A checklist for the common cases, in the order they usually appear:

| What you see | What it means today |
|---|---|
| `UNSAFE_` prefix | Pre-16.3 code, unaudited for concurrent rendering |
| `this.setState` with an object | Merges — the function equivalent needs a spread |
| `.bind(this)` in the constructor | Pre-class-fields; no meaning beyond `this` |
| `componentWillReceiveProps` copying a prop to state | Almost always the duplication bug |
| `shouldComponentUpdate` with a deep compare | Documented as *not* recommended |
| `this.refs.something` | String ref — **removed in React 19**, this code is broken |
| `contextTypes` / `getChildContext` | Legacy context — **removed in React 19** |
| `forceUpdate` | State is being kept where React cannot see it |

The last three are not style observations. They are code that no longer runs on
React 19.

## Gotchas

**Symptom:** an effect fires on every render after converting from
`componentDidMount`.
**Cause:** the dependency array was omitted.
**Fix:** `[]` for a genuine mount-only effect — and then check whether it
actually is one, because most are not.

**Symptom:** a converted component fetches twice in development.
**Cause:** `StrictMode` double-mounting, exposing an effect whose cleanup does
not cancel the request. `componentDidMount` never had to be re-runnable.
**Fix:** an `AbortController` in the cleanup, not a `useRef` guard
([Phase 0 · StrictMode](../../phase-0-how-react-runs/07-strictmode.md)).

**Symptom:** an error boundary catches nothing from a click handler.
**Cause:** boundaries only catch errors thrown during rendering, in lifecycle
methods, and in constructors below them — not in event handlers or async code.
**Fix:** `try`/`catch` in the handler, and set error state explicitly.

**Symptom:** `getDerivedStateFromError` tries to log and nothing happens
reliably.
**Cause:** it runs during the render phase and must be pure.
**Fix:** log in `componentDidCatch`, which runs after commit and receives the
component stack.

**Symptom:** scroll position jumps after converting `getSnapshotBeforeUpdate`.
**Cause:** `useLayoutEffect` runs after the DOM mutation, so the pre-mutation
measurement is gone.
**Fix:** capture the value in a ref during the previous commit and read it in
the layout effect.

## Interview questions

**★ Which lifecycle methods have no hook equivalent?**
`getDerivedStateFromError` and `componentDidCatch` — the two that make a
component an error boundary. react.dev states plainly that there is currently no
way to write an error boundary as a function component, which is why a class is
still required for that one job in React 19. The usual answer is one
`ErrorBoundary` class for the whole app, or the `react-error-boundary` package.

**★ How do the three main lifecycle methods map to `useEffect`?**
They collapse into one effect: setup covers mount and update, the returned
cleanup covers unmount, and the dependency array decides when it re-runs.
Writing three separate effects to mimic the three methods is mechanically
correct and misses the point — the effect model asks what needs to stay
synchronised, not what happens at each moment.

**★ What is the difference between `getDerivedStateFromError` and
`componentDidCatch`?**
The static one runs during rendering and may only return new state, so it must
be pure — it is what lets you render a fallback. The instance one runs after the
commit and is where side effects belong, such as logging, and it receives the
component stack alongside the error. Most boundaries define both.

**Why are the `UNSAFE_` methods called that?**
They run before the commit, so under concurrent rendering a render that gets
interrupted or abandoned has already executed them. They were renamed rather
than removed to make the risk visible, and there is a
`rename-unsafe-lifecycles` codemod. Seeing one means the code predates React
16.3.

**What do error boundaries not catch?**
Errors in event handlers, in asynchronous code such as `setTimeout` or a
rejected promise, in server rendering, and errors thrown by the boundary
component itself. Those need ordinary `try`/`catch`. React 19's root-level
`onUncaughtError` and `onCaughtError` options exist to make the difference
observable.

**Which class lifecycle would you refuse to translate?**
`getDerivedStateFromProps`, in its common use of copying a prop into state. That
is duplicated state with all the sync problems that follow. The right
translation is usually to derive the value during render instead, and the narrow
legitimate case — adjusting state when a prop changes — has its own documented
function-component pattern.

---

← Prev: [Anatomy, state and `this`](01-anatomy-and-this.md) ·
Index: [Class components](README.md) ·
Next → [`Component` vs `PureComponent`](../15-purecomponent.md)
