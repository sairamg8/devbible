---
title: "Component identity and the nesting rule"
sidebar_label: "02 · Identity and nesting"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Your First Component](https://react.dev/learn/your-first-component),
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
> and the legacy
> [Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html)
> caveats. No sandbox script backs this page; claims are cited, not measured.

**React decides whether to keep a subtree or destroy it by comparing the
component *function itself* between renders. Anything that produces a new
function each render destroys everything below it, every time.**

## The rule React actually applies

Reconciliation compares the element at a given position with the element that
was there before. For a component element, the comparison is on the `type`
field — the function reference. react.dev states the outcome in two halves:

> React preserves a component's state for as long as it's being rendered at its
> position in the UI tree.

> When you render a different component in the same position, it resets the
> state of its entire subtree.

"A different component" means `Object.is(prevType, nextType) === false`. It does
not mean a component with a different *name*, or different source, or different
props. Two functions with identical bodies are different components. **The same
function declaration evaluated twice is two different components.**

That last sentence is the entire nesting rule.

## Why nesting a definition is fatal

```jsx
export default function MyComponent() {
  const [counter, setCounter] = useState(0);

  function MyTextField() {              // 🔴 a NEW function every render
    const [text, setText] = useState('');
    return <input value={text} onChange={e => setText(e.target.value)} />;
  }

  return (
    <>
      <MyTextField />
      <button onClick={() => setCounter(counter + 1)}>
        Clicked {counter} times
      </button>
    </>
  );
}
```

react.dev is unusually blunt about this one:

> Components can render other components, but **you must never nest their
> definitions**

and

> Always declare component functions at the top level, and don't nest their
> definitions.

Each time `MyComponent` renders, the `function MyTextField` declaration is
evaluated again and produces a fresh function object. React compares it to the
previous one, finds a different type at that position, and takes the only
action available to it: unmount the old subtree entirely and mount a new one.

So clicking the button — which has nothing to do with the text field — wipes
whatever the user had typed.

## What "remount" costs, precisely

"It resets the state" undersells it. A type change at a position is a full
unmount/mount cycle, and every one of these happens:

| Step | Effect |
|---|---|
| `useState` / `useReducer` values | Destroyed, re-initialised from scratch |
| `useRef` values | Destroyed — `ref.current` is back to the initial value |
| Effect cleanups | All run, in the unmounting subtree |
| DOM nodes | Removed and recreated — not reused, not patched |
| Focus and selection | Lost, because the focused element no longer exists |
| Scroll position of any scroller inside | Reset |
| CSS transitions and animations | Restarted from their initial state |
| Uncontrolled input values | Lost, along with the DOM node holding them |
| Effects | Re-run their setup, with the mount-time dependency list |
| Child components | The whole subtree, recursively |

This is why the symptom is so hard to recognise: an input that clears itself
looks like a state bug, a video that restarts looks like a rendering bug, and a
`useRef` counter resetting looks like a hooks bug. They are all one cause.

There is a performance cost on top — react.dev calls the nested-definition
snippet "very slow" — but the correctness cost is what actually bites. Slow code
gets profiled; a subtree that silently resets gets debugged for an afternoon.

## The same mistake in four disguises

The nesting rule is usually taught with the literal `function` inside
`function` case. In real code it arrives in shapes that do not look like
nesting at all — but every one of them evaluates to a new function reference
each render.

**1. An arrow assigned to a local variable**

```jsx
function Page() {
  const Row = ({item}) => <li>{item.name}</li>;   // 🔴 same bug
  return <ul>{items.map(i => <Row key={i.id} item={i} />)}</ul>;
}
```

**2. A HOC applied during render**

```jsx
function Page(props) {
  const Enhanced = withRouter(MyComponent);        // 🔴 new type every render
  return <Enhanced {...props} />;
}
```

The legacy HOC documentation names this explicitly — *"Don't Use HOCs Inside the
render Method"* — and gives the same reason: a new `EnhancedComponent` is
created on every render, so React unmounts and remounts rather than updating.
Apply HOCs once, at module level ([topic 13](../13-higher-order-components/README.md)).

**3. A component chosen from an object literal**

```jsx
function Field({kind, ...rest}) {
  const map = {text: TextInput, date: DateInput};  // ✅ actually fine
  const C = map[kind];
  return <C {...rest} />;
}
```

This one is **safe** and worth knowing why: the object is new each render, but
its *values* are the same module-level function references. React compares the
type, not the map. The equivalent with inline definitions —
`{text: (p) => <input {...p} />}` — is not safe, for the usual reason.

**4. `React.memo` or `lazy` called inside a component**

```jsx
function Page() {
  const Heavy = React.lazy(() => import('./Heavy'));  // 🔴 new lazy type, always
  return <Suspense fallback={null}><Heavy /></Suspense>;
}
```

`lazy()` and `memo()` both *return a new component object*. Calling either
during render means a fresh type per render, so the lazy chunk re-suspends and
the memo boundary never has a previous render to compare against — it is worse
than useless, because you pay the comparison and never get a hit. Both belong at
module scope.

## The two legitimate exceptions

**A component computed once and stored.** If a component genuinely must be built
at runtime, build it where its identity is stable:

```jsx
const Enhanced = useMemo(() => withThing(Base), []);   // stable while mounted
```

`useMemo` is a performance hint and React is permitted to discard the cached
value — so relying on it for *correctness* is fragile. It survives ordinary
re-renders, which covers the usual case, but treat it as the option of last
resort rather than a pattern to reach for. If the component can be built at
module level instead, build it there.

**Deliberately remounting.** Sometimes destroying the subtree is exactly what
you want — a form that must reset when the record being edited changes. Do that
with `key`, not by changing the type:

```jsx
<EditForm key={record.id} record={record} />
```

react.dev:

> Specifying a `key` tells React to use the `key` itself as part of the
> position, instead of their order within the parent.

This is the same reconciliation rule aimed on purpose: a changed key at a
position is treated as a different position, so the old subtree unmounts. It is
covered as its own topic in Phase 3.

## How to detect it

There is no warning for this. React cannot distinguish "you nested a definition"
from "you deliberately swapped components", so it does nothing but obey. Three
practical detections:

- **React DevTools** — the component unmounts and remounts on every parent
  render. In the Profiler, its entry shows as a mount rather than an update.
- **`eslint-plugin-react`** — the `no-unstable-nested-components` rule catches
  the common shapes, including components passed as props. It is not in the
  recommended set; enable it explicitly.
- **The symptom test** — if state resets when an *unrelated* sibling updates,
  suspect identity before suspecting state.

## Gotchas

**Symptom:** an input clears itself whenever anything else on the page changes.
**Cause:** the input's component is defined inside the component that re-renders,
so it is a new type each time and React remounts it.
**Fix:** move the declaration to module top level. If it needs values from the
parent, pass them as props — that is what props are for.

**Symptom:** a `React.lazy` chunk shows its Suspense fallback on every render.
**Cause:** `lazy()` is being called during render, producing a new lazy type each
time, which has never resolved.
**Fix:** call `lazy()` once at module scope.

**Symptom:** a `memo`-wrapped component never skips a render.
**Cause:** either `memo()` is called during render, or the component is being
recreated by a HOC in render — in both cases the previous type is gone, so there
is nothing to compare against.
**Fix:** move `memo()` and the HOC application to module scope.

**Symptom:** a CSS enter-animation replays continuously.
**Cause:** the element is being recreated every render by a remounting ancestor,
so the animation starts over from mount.
**Fix:** the same one — find the unstable component type above it.

**Symptom:** state resets only in development, not in production.
**Cause:** this is *not* the nesting rule — that resets in both. It is almost
always `StrictMode`'s double-invocation exposing an impure component
([topic 02](../02-purity/README.md)).
**Fix:** treat it as a purity problem, not an identity one.

## Interview questions

**★ Why must you never define a component inside another component?**
Because the definition is re-evaluated on every render of the outer component,
producing a different function object each time. React compares element types by
reference to decide whether to update a subtree or replace it, so a new type at
the same position means unmount and remount: state destroyed, refs destroyed,
effect cleanups run, DOM nodes recreated, focus and scroll lost. It happens on
every single render of the parent, silently, with no warning.

**★ How does React decide whether to preserve or reset a component's state?**
By position in the render tree plus type. Same component type at the same
position → state is preserved, however much the props changed. Different type at
the same position → the entire subtree is torn down and rebuilt. `key`
participates as part of the position, which is how you reset state deliberately.

**★ A colleague wraps a component with a HOC inside `render`. What breaks?**
The HOC returns a new component on every render, so the wrapped subtree remounts
every time — losing all its state and re-running its effects — and any
memoization below it becomes useless. Apply HOCs once at module level. This is a
documented caveat of the HOC pattern, not an edge case.

**Is `const Row = () => …` inside a component different from `function Row()`
inside it?**
No. Both create a new function object per render and both trigger the remount.
The syntax is irrelevant; what matters is that the expression is evaluated
during render.

**Why is picking a component out of an object map safe, when the object is new
each render?**
Because React compares the element's `type` — the function that came *out* of
the map — not the map itself. As long as the map's values are stable
module-level components, the type is stable. It only becomes unsafe if the map's
values are themselves defined inline.

**How would you deliberately reset a subtree's state?**
Give it a `key` that changes when the identity of the thing it represents
changes — `<EditForm key={record.id} />`. This uses the same reconciliation rule
on purpose, and is far clearer than conditionally rendering two different
component types to force the reset.

---

← Prev: [What makes a function a component](01-what-makes-a-component.md) ·
Index: [Function components](README.md) ·
Next → [Purity](../02-purity/README.md)
