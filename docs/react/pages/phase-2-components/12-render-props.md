---
title: "Render props and function-as-children"
sidebar_label: "12 · Render props"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — the legacy
> [Render Props](https://legacy.reactjs.org/docs/render-props.html) guide and
> react.dev [`Children` — alternatives](https://react.dev/reference/react/Children),
> which lists render props as a recommended replacement for `Children`
> manipulation. No sandbox script backs this page; claims are cited, not
> measured.

**The pre-hooks answer to "how do two components share stateful logic". Mostly
replaced, still shipping in libraries you use, and still the only answer to one
specific question.**

## The pattern

> A render prop is a function prop that a component uses to know what to render.

```jsx
function MouseTracker({render}) {
  const [pos, setPos] = useState({x: 0, y: 0});
  useEffect(() => {
    const on = e => setPos({x: e.clientX, y: e.clientY});
    window.addEventListener('pointermove', on);
    return () => window.removeEventListener('pointermove', on);
  }, []);
  return render(pos);                 // the component decides WHEN and WITH WHAT
}

<MouseTracker render={({x, y}) => <Cat x={x} y={y} />} />
```

The inversion: `MouseTracker` owns the state and the subscription, but has no
idea what should appear on screen. The caller owns the markup but not the logic.
That is the sharing mechanism — and before hooks, it and HOCs were the only two
available.

The name is misleading and the legacy docs say so: the prop does not have to be
called `render`. `children` works and reads better, because JSX lets you put it
inside the element:

```jsx
<MouseTracker>
  {({x, y}) => <Cat x={x} y={y} />}
</MouseTracker>
```

Same pattern, one prop name different.

## Why hooks replaced it

```jsx
// The same capability, as a hook
function useMousePosition() {
  const [pos, setPos] = useState({x: 0, y: 0});
  useEffect(() => {
    const on = e => setPos({x: e.clientX, y: e.clientY});
    window.addEventListener('pointermove', on);
    return () => window.removeEventListener('pointermove', on);
  }, []);
  return pos;
}

function Cat() {
  const {x, y} = useMousePosition();      // ✅
  …
}
```

Every axis favours the hook:

| | Render prop | Custom hook |
|---|---|---|
| Components added to the tree | One per use | None |
| Values usable | Only inside that JSX subtree | Anywhere in the component |
| Composing three of them | Three levels of nesting | Three lines |
| Passing a value between two of them | Awkward — nest and close over | Trivial — it is a variable |
| Show up in DevTools | As tree noise | As hook state |
| TypeScript inference | Through a callback parameter | Direct |

The nesting cost compounds, and it has a name. Three render props produce:

```jsx
<Theme>{theme =>
  <User>{user =>
    <Mouse>{pos =>
      <Thing theme={theme} user={user} pos={pos} />
    }</Mouse>
  }</User>
}</Theme>
```

"Wrapper hell" — and the fourth one goes off the right-hand side of the screen.
The hook version is four lines with no nesting at all. This is the single
biggest reason hooks won.

## Where render props still win

Three cases, and they are genuinely not hook-shaped.

**1. The component controls placement, not just values.** A virtualised list
decides which rows exist and positions them; the caller only describes a row.
A hook cannot render anything, so it cannot do this.

```jsx
<VirtualList items={rows} rowHeight={32}>
  {(item, style) => <div style={style}>{item.name}</div>}
</VirtualList>
```

**2. The values are per-item.** A hook returns one set of values per component.
A render prop is called once per item, with that item's values.

**3. The rendering must be scoped to a boundary** the component owns — inside
its Suspense boundary, inside its error boundary, inside its portal. The
function runs where the component chooses to call it.

react.dev's `Children` reference lists render props as one of the recommended
alternatives to manipulating `children`, for exactly this reason: a `renderItem`
prop makes the data flow explicit, and the docs note the benefit as *"explicitly
traces where values come from"*.

## The `PureComponent` caveat, and its modern equivalent

The legacy docs flag a specific interaction:

> Using a render prop can negate the advantage that comes from using
> `React.PureComponent` if you create the function inside a `render` method.

> the shallow prop comparison will always return `false` for new props, and each
> `render` in this case will generate a new value for the render prop.

An inline arrow is a new function object every render, so a memoized child never
skips. The class-era fix was an instance method; the function-component
equivalent is `useCallback`:

```jsx
const renderRow = useCallback((item) => <Row item={item} />, []);
<VirtualList items={rows}>{renderRow}</VirtualList>
```

Worth knowing, and worth not over-applying. It only matters when the receiving
component is memoized — otherwise you are paying `useCallback` for nothing. And
under the React Compiler it is handled automatically.

## Reading it in existing code

Render props are not historical trivia; they are in current libraries. You will
meet them in:

- **Virtualisation** — `react-window`, `react-virtuoso`.
- **Charting** — `<ResponsiveContainer>{({width, height}) => …}`.
- **Form libraries** — Formik's `<Field>{({field, meta}) => …}`, and
  `react-hook-form`'s `<Controller render={…}>`.
- **Headless UI kits**, where a part exposes its state to the caller's markup.
- **Older data-fetching wrappers**, which are the ones worth migrating.

The recognition rule: if a prop's value is a function that returns JSX, it is a
render prop, whatever it is called.

## Gotchas

**Symptom:** `children is not a function`.
**Cause:** the caller passed JSX to a component expecting a function, or the
reverse.
**Fix:** the API is unusual enough to justify a development-time check with a
clear message. Types help, but only in typed callers.

**Symptom:** a memoized child re-renders on every parent render.
**Cause:** the render prop is an inline arrow, so the shallow comparison always
fails.
**Fix:** `useCallback`, or let the Compiler handle it — but check first whether
the child is actually memoized, or the wrap is pure cost.

**Symptom:** the JSX is unreadable four levels deep.
**Cause:** wrapper hell — the pattern does not compose with itself.
**Fix:** convert each to a custom hook. Hooks compose linearly.

**Symptom:** a value from an outer render prop is needed by an inner one, and
threading it is painful.
**Cause:** the pattern makes values available only inside a JSX subtree.
**Fix:** hooks, where both are plain variables in the same scope.

**Symptom:** state resets inside a render-prop child on every parent render.
**Cause:** the *component* rendered by the function is defined inline, not the
function itself — the nesting rule from
[topic 01](01-function-components/02-identity-and-nesting.md).
**Fix:** define the component at module level and call it from the render prop.

## Interview questions

**★ What is a render prop?**
A function prop that a component calls to decide what to render, letting the
component own state and behaviour while the caller owns the markup. The prop
does not have to be named `render` — using `children` is the same pattern and
reads better, since JSX lets you put the function directly inside the element.

**★ Why did hooks replace render props?**
Hooks give the same logic sharing without adding components to the tree, make
the values usable anywhere in the component rather than only inside one JSX
subtree, and compose linearly instead of nesting. Three render props produce
three levels of indentation; three hooks are three lines. Passing a value from
one to another is trivial with hooks and awkward with render props.

**★ When is a render prop still the right answer?**
When the component must control *where* the caller's markup goes, not just
supply values — virtualised lists are the standard example. When the values are
per-item rather than per-component. And when the render must happen inside a
boundary the component owns. A hook cannot render anything, so none of these are
hook-shaped.

**What is "wrapper hell"?**
The nesting that results from composing several render-prop components: each one
adds a level of JSX indentation and a closure, and by the fourth the code is
unreadable. It is the specific problem custom hooks were introduced to solve.

**Why can an inline render prop defeat memoization?**
Because it is a new function object on every render, so a shallow prop
comparison always returns `false` and the memoized child never skips. The legacy
docs flag this against `PureComponent`; the modern equivalent is a `memo`
component receiving an inline arrow. `useCallback` fixes it — if the child is
actually memoized.

**Where would you still meet render props today?**
Virtualisation libraries, charting libraries with responsive containers, form
libraries like Formik and `react-hook-form`'s `Controller`, and headless UI
kits. Any prop whose value is a function returning JSX is one, whatever it is
named.

---

← Prev: [Portals](11-portals.md) · Index: [Phase 2](README.md) · Next → [Higher-order components](13-higher-order-components.md)
