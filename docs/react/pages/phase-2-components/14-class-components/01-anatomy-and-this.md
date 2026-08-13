---
title: "Anatomy, state and `this`"
sidebar_label: "01 · Anatomy and this"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`Component`](https://react.dev/reference/react/Component) and the
> [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
> (legacy context and string refs removed). No sandbox script backs this page;
> claims are cited, not measured.

**You will not write these. You will read them — in a codebase that predates
2019, in a library, and in the one place React still requires a class. This
chunk is the anatomy; the [next](02-lifecycle-and-hooks.md) is the lifecycle.**

## Status

react.dev is direct about it:

> `Component` is the base class for the React components defined as JavaScript
> classes. Class components are still supported by React, but we don't recommend
> using them in new code.

> We recommend defining components as functions instead of classes.

"Still supported" is not a deprecation. Classes work in React 19, receive no new
features, and are not scheduled for removal. Two things about them *did* change
in 19, both removals covered in [topic 09](../09-ref-as-a-prop.md): string refs
and legacy context (`contextTypes` / `getChildContext`) are gone, and both were
class-only. Class `defaultProps` survives — the upgrade guide says so
explicitly, *"since there is no ES6 alternative"*.

## The shape

```jsx
class Counter extends React.Component {
  constructor(props) {
    super(props);                          // required before touching `this`
    this.state = {count: 0};
    this.handleClick = this.handleClick.bind(this);   // see below
  }

  handleClick() {
    this.setState(s => ({count: s.count + 1}));
  }

  render() {
    return <button onClick={this.handleClick}>{this.state.count}</button>;
  }
}
```

Four things map onto function-component equivalents you already know:

| Class | Function |
|---|---|
| `render()` | the function body |
| `this.props` | the parameter |
| `this.state` + `this.setState` | `useState` |
| Lifecycle methods | `useEffect` and friends |

And two have no equivalent:

- **`this`** — an instance exists, and it persists across renders. That is the
  source of both the pattern's power and its bugs.
- **Error boundaries** — the [next chunk](02-lifecycle-and-hooks.md).

## `setState` is not `useState`'s setter

Three differences, and each produces a distinct bug when someone converts code
by muscle memory.

**1. It merges. `useState` replaces.**

```jsx
this.state = {name: 'a', age: 1};
this.setState({age: 2});                  // → {name: 'a', age: 2}  — merged

const [s, setS] = useState({name: 'a', age: 1});
setS({age: 2});                            // → {age: 2}  — name is GONE
```

This is the single most common conversion bug. The function-component equivalent
is an explicit spread: `setS(prev => ({...prev, age: 2}))`.

**2. It is asynchronous, and reading `this.state` afterwards is a trap.**

```jsx
this.setState({count: this.state.count + 1});
this.setState({count: this.state.count + 1});   // 🔴 both read the same value
console.log(this.state.count);                   // 🔴 still the old value
```

The updater form is the fix, exactly as with `useState`:

```jsx
this.setState(s => ({count: s.count + 1}));
this.setState(s => ({count: s.count + 1}));      // ✅ 2
```

**3. It takes a callback for "after the update".**

```jsx
this.setState({open: true}, () => this.inputRef.current.focus());
```

There is no equivalent second argument on `useState`'s setter. The function
equivalent is `useEffect` reacting to the value, or `flushSync` when the update
genuinely must be applied before the next line — which is rare and worth
resisting.

Mutating `this.state` directly is the class-flavoured version of the same purity
violation as everywhere else: `this.state.items.push(x)` does not re-render, and
it breaks `PureComponent` silently ([topic 15](../15-purecomponent.md)).

## The `this` problem

The reason `.bind(this)` appears in every pre-2019 constructor.

```jsx
class Counter extends React.Component {
  handleClick() {
    this.setState(…);          // 💥 `this` is undefined
  }
  render() {
    return <button onClick={this.handleClick}>…</button>;
  }
}
```

`this.handleClick` extracts the function from the instance and passes it as a
plain value. When React later calls it, there is no receiver — and class bodies
are strict mode, so `this` is `undefined` rather than the global object. The
error is `Cannot read properties of undefined (reading 'setState')`, which names
`setState` and not the actual cause.

Three fixes, in the order they appeared historically:

```jsx
// 1. Bind in the constructor — the classic
constructor(props) { super(props); this.handleClick = this.handleClick.bind(this); }

// 2. Class field with an arrow — the modern class answer
handleClick = () => { this.setState(…); };

// 3. Arrow at the call site — works, but a new function every render
<button onClick={() => this.handleClick()}>
```

Option 3 defeats `PureComponent` and `memo` on any child receiving it, for the
same reason an inline render prop does — a new function object each render makes
every shallow comparison fail. Option 2 is what you will see in code written
after class fields landed, and it is the one to use if you must write a class.

This entire category of bug is why "hooks removed `this` from React" is the
one-sentence summary people give. Function components have no receiver to lose.

## Refs, context and props in a class

**Refs.** `createRef` in the constructor, or a ref callback:

```jsx
this.inputRef = React.createRef();
<input ref={this.inputRef} />          // this.inputRef.current
```

String refs (`ref="input"` with `this.refs.input`) were **removed in React 19**.
Codemod: `npx codemod@latest react/19/replace-string-ref`.

**Context.** One context per class, via `static contextType`:

```jsx
class Child extends React.Component {
  static contextType = FooContext;
  render() { return <div>{this.context}</div>; }
}
```

The limit of one is real — a class needing two contexts must consume the second
through a render prop or a wrapper. Legacy context (`contextTypes` /
`getChildContext`) was **removed in React 19**; the upgrade guide gives the
migration to `contextType`.

**Props.** `this.props`, and `defaultProps` still works — the one place it
survives in React 19.

**`forceUpdate`.** Documented, and a code smell wherever it appears: it forces a
re-render without a state change, which almost always means state is being kept
somewhere React cannot see.

## Converting a class to a function

The mechanical order, which avoids most of the trouble:

1. `render()` body → the function body; `this.props.x` → `props.x`.
2. Each `this.state` field → its own `useState`. **Do not port the state object
   wholesale** — that reintroduces the merge problem, since `useState` replaces.
3. Handlers → plain functions inside the component. Every `this.` disappears.
4. Lifecycle methods → effects, per the table in the
   [next chunk](02-lifecycle-and-hooks.md).
5. `this.instanceField = …` (non-state values that persist) → `useRef`.
6. `static defaultProps` → default parameters.

Step 5 is the one people miss. A class instance can hold anything — a timer id,
a WebSocket, a cached calculation — and those are `useRef`, not `useState`,
because changing them should not re-render.

And the step that cannot be done: **if the class is an error boundary, it stays
a class.** Next chunk.

## Gotchas

**Symptom:** `Cannot read properties of undefined (reading 'setState')`.
**Cause:** an unbound method passed as a handler; `this` is lost.
**Fix:** a class-field arrow, or bind in the constructor.

**Symptom:** after converting to hooks, half the state object disappears.
**Cause:** `setState` merges, `useState` replaces.
**Fix:** separate `useState` calls, or an explicit spread in the updater.

**Symptom:** two `setState` calls in one handler produce one increment.
**Cause:** both read the same stale `this.state`.
**Fix:** the updater form.

**Symptom:** `this.state` is unchanged on the line after `setState`.
**Cause:** updates are asynchronous and batched.
**Fix:** the `setState` callback, or read the value in the next render.

**Symptom:** `this.refs` is empty after upgrading to React 19.
**Cause:** string refs removed.
**Fix:** `createRef` or a ref callback; there is a codemod.

**Symptom:** a `PureComponent` child re-renders on every parent render.
**Cause:** an arrow at the call site creating a new function each time.
**Fix:** a bound method or a class field.

## Interview questions

**★ Are class components deprecated?**
No. react.dev says they are still supported but not recommended for new code.
They get no new features. React 19 removed two class-only APIs — string refs and
legacy context — but class `defaultProps` was deliberately kept, because there
is no ES6 default-parameter equivalent for a class.

**★ How does `this.setState` differ from `useState`'s setter?**
It merges the partial object into existing state rather than replacing it; it
takes an optional callback that runs after the update is applied; and both are
asynchronous, so reading state immediately afterwards gives the old value. The
merge difference is the classic conversion bug — porting a state object
wholesale to `useState` silently drops every field you do not respread.

**★ Why does `this` need binding in a class component?**
Because `this.handleClick` passed as a prop is just the function, detached from
the instance. When React calls it there is no receiver, and class bodies are
strict mode, so `this` is `undefined`. Fixes are a class-field arrow, a
constructor `bind`, or an arrow at the call site — the last of which creates a
new function every render and defeats memoization on the child.

**Where do class instance fields go when converting to hooks?**
`useRef`, not `useState` — a timer id, a subscription, a cached value. Those
persist across renders but changing them should not trigger one, which is
exactly what a ref is for. Using state instead produces a render on every
assignment.

**How many contexts can a class component consume?**
One, through `static contextType`. More than that requires a render prop or a
wrapper component. Function components have no such limit — `useContext` can be
called as many times as needed, which is one of the quieter reasons hooks won.

**What is `forceUpdate` and when would you use it?**
It re-renders a component without a state change. Almost never the right answer:
it means state is being kept somewhere React cannot observe, and the fix is
usually to put that value in state or a store rather than to force renders.

---

← Index: [Class components](README.md) · Next → [The lifecycle, and the hook each one maps to](02-lifecycle-and-hooks.md)
