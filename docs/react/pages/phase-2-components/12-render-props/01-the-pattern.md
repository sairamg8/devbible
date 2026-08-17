---
title: "The pattern, and why hooks replaced it"
sidebar_label: "01 · The pattern"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — the legacy
> [Render Props](https://legacy.reactjs.org/docs/render-props.html) guide for the
> definition and the `PureComponent` caveat, react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> and [`Children`](https://react.dev/reference/react/Children), which lists render
> props among the recommended alternatives to manipulating `children`.
> No sandbox script backs this page; claims are cited, not measured.

**A function prop a component calls to decide what to render. The pre-hooks
answer to logic sharing, and still the right answer to one specific question.**

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

## Naming: `children` or a named prop

Both are the same pattern. The choice is about how many there are.

```jsx
<Mouse>{(pos) => <Cat {...pos} />}</Mouse>              {/* children */}
<Mouse render={(pos) => <Cat {...pos} />} />             {/* named */}
```

*(Judgement:)* **`children` when there is exactly one**, because JSX puts it
where the content belongs and it reads as nesting. **Named props the moment there
are two or more**, because `children` can only be one thing:

```jsx
<DataTable
  rows={rows}
  renderRow={(row) => <Row {...row} />}
  renderEmpty={() => <Empty />}
  renderHeader={(col) => <Th>{col.label}</Th>}
/>
```

⚠️ **A component that takes both `children`-as-a-function and a `render` prop is
an API bug.** Pick one; supporting both means every caller has to check which one
wins, and you have to document a precedence nobody will remember.

**The `render*` prefix is worth keeping** even though the legacy docs point out
the name is arbitrary — it is the signal to a reader that the value is a function
returning JSX rather than a value or a component reference.

## Gotchas

**`children is not a function`.** The caller passed JSX where a function was
expected, or the reverse. The API is unusual enough to justify a development-time
`typeof children !== 'function'` check with a message naming the component —
types only help typed callers.

**A component defined *inside* the render prop remounts every render.** This is
the identity rule from
[function components](../01-function-components/02-identity-and-nesting.md), and the
render prop makes it unusually easy to hit because the function body looks like a
natural place to define a helper. The *function* being new each render is fine;
a *component type* being new each render destroys the subtree and its state.

```jsx
<Mouse>{(pos) => {
  const Dot = () => <div style={{left: pos.x}} />;   // ❌ new type every call
  return <Dot />;
}}</Mouse>
```

**The function can be called more than once per render**, and a component that
calls it per item calls it many times. Anything with a side effect inside it —
an id counter, a `console.count`, a push to an array — will not behave the way
the author expected.

**It can also be called zero times.** A component may decide not to render the
caller's content at all — while loading, when a list is empty, when a boundary
caught an error. Callers who assume their function always runs are surprised.

**Nothing guarantees when it runs.** The component chooses; it may be inside a
`Suspense` boundary that has not resolved, or a branch not taken this render.
Treat it as a description of output, never as a lifecycle hook.

**A render prop that closes over stale props is possible in class code**, which
is where you will meet most of them. In function components the closure is
recreated each render, so this is much rarer — but a `useCallback` with a wrong
dependency array reintroduces it.

**`children` as a function breaks `Children.map` and `Children.count`.** Those
helpers expect elements; a function child is a single opaque value. Any component
combining both APIs will behave oddly.

## Interview questions

**What is a render prop?**
A function prop a component calls to decide what to render, letting the component
own state and behaviour while the caller owns the markup. The prop does not have
to be called `render` — `children` as a function is the same pattern.

**Why did hooks replace it?**
Hooks give the same logic sharing without adding components to the tree, make the
values usable anywhere in the component rather than only inside one JSX subtree,
and compose linearly instead of nesting. Three render props are three levels of
indentation; three hooks are three lines.

**What is wrapper hell?**
The nesting produced by composing several render-prop components — each adds a
level of JSX and a closure, and by the fourth the code runs off the screen. It is
the specific problem custom hooks were introduced to solve.

**When do you use `children` and when a named prop?**
`children` when there is exactly one, because JSX puts it where content belongs.
Named `render*` props as soon as there are two or more, since `children` can only
be one thing. Never both on the same component.

**How many times does the function run?**
Any number, including zero. The component decides — once per render, once per
item, or not at all while loading or when a boundary is showing a fallback.

**What is the classic bug when a component is defined inside the render prop?**
A new component *type* on every call, so React unmounts and remounts that subtree
and its state is lost. The function itself being new is harmless; a new type is
not.

**Can a render prop be stale?**
In class components, yes — that is a common source of bugs. In function
components the closure is rebuilt each render, so it is rare unless someone wraps
it in `useCallback` with an incomplete dependency array.

---

Index: [Render props](README.md) · Next → [02 · Where it still wins](02-where-it-still-wins.md)
