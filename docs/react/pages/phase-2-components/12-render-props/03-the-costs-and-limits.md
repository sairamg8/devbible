---
title: "The costs and the limits"
sidebar_label: "03 · The costs and the limits"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — the legacy
> [Render Props](https://legacy.reactjs.org/docs/render-props.html) guide for the
> `PureComponent` caveat quoted below; react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) for the
> serializable-props list, **fetched 2026-08-17** and quoted;
> [`memo`](https://react.dev/reference/react/memo) and
> [`useCallback`](https://react.dev/reference/react/useCallback).
> ⚠️ The migration and testing guidance is engineering judgement built on those
> APIs, and is marked as such.
> No sandbox script backs this page; claims are cited, not measured.

**The nesting cost is the famous one. The Server Component boundary is the one
that will actually stop you.**

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

## 🔴 The Server Component boundary

**A render prop written in a Server Component cannot be passed to a Client
Component.** This is the modern limit on the pattern and it has no workaround
inside the pattern.

react.dev's `'use client'` reference lists what may cross the boundary:

> Serializable props include:
> * Primitives (string, number, bigint, boolean, undefined, null, symbol)
> * Iterables containing serializable values (String, Array, Map, Set, TypedArray, ArrayBuffer)
> * Date
> * Plain objects with serializable properties
> * Functions that are Server Functions
> * Client or Server Component elements (JSX)
> * Promises

and what may not:

> Notably, these are not supported:
> * Functions that are not exported from client-marked modules or marked with `'use server'`

An inline render prop is neither a Server Function nor an export from a
client-marked module, so this fails:

```jsx
// app/page.jsx — a Server Component
import { VirtualList } from './virtual-list';   // 'use client'

<VirtualList items={rows}>
  {(item) => <Row item={item} />}      {/* ❌ a plain function cannot cross */}
</VirtualList>
```

**Note what the same list permits: JSX elements.** So the slot form survives the
boundary where the function form does not:

```jsx
<Panel header={<Title />}>{<Body />}</Panel>     {/* ✅ elements are serializable */}
```

*(Judgement, and it is the practical takeaway:)* in an RSC application, **a
component whose API is a render prop is a Client Component API**. Either the
caller is also a Client Component, or the component's API has to be elements
rather than functions. This is a genuine reason the ecosystem has drifted toward
slots and `asChild`, and it is not a style preference.

⚠️ The error surfaces at the boundary, and its message points at serialization
rather than at your component's design — which makes it confusing the first time.

## Typing it

The value of a typed render prop is that the callback's parameters are inferred
from the component's own data:

```tsx
type VirtualListProps<T> = {
  items: T[];
  rowHeight: number;
  children: (item: T, style: React.CSSProperties) => React.ReactNode;
};

function VirtualList<T>({ items, rowHeight, children }: VirtualListProps<T>) {
  // …
}

<VirtualList items={users} rowHeight={32}>
  {(user, style) => <div style={style}>{user.email}</div>}
  {/*  ^^^^ inferred as User — no annotation needed */}
</VirtualList>
```

Three notes:

- **The return type should be `React.ReactNode`, not `JSX.Element`.** A render
  prop is allowed to return `null`, a string, or an array, and `JSX.Element`
  rejects all three.
- **Generic inference flows from `items` to the callback**, which is the whole
  ergonomic win — and it breaks if `items` is typed as `any[]` or if the generic
  is declared on the props type but not on the function.
- **Multiple render props each need their own signature**, and they are a
  frequent source of `implicit any` when a caller destructures a parameter the
  type did not describe.

## Testing

*(Judgement, but it is a real advantage of the pattern.)* The render prop is an
**observable seam** — you can assert exactly what the component passed out,
without rendering anything real:

```jsx
const renderRow = jest.fn(() => null);
render(<VirtualList items={rows} rowHeight={32}>{renderRow}</VirtualList>);

expect(renderRow).toHaveBeenCalledTimes(10);            // only visible rows
expect(renderRow).toHaveBeenCalledWith(rows[0], expect.objectContaining({ top: 0 }));
```

A custom hook needs `renderHook` to get at the same information. Here the
component hands it to you.

⚠️ Do not over-read this: it tests the values the component produced, not that
the resulting UI is correct.

## Migrating a render prop to a hook

*(Judgement — a recipe, not documentation.)*

1. **Does the component render anything of its own?** If it only computes and
   calls `children(...)`, the conversion is mechanical: move the body into a
   hook, return the object it was passing, delete the component.
2. **Does it decide placement, count, or a boundary?** Then it cannot be a hook —
   those are [chunk 02](02-where-it-still-wins.md)'s five cases, and the answer is
   to keep it.
3. **Both?** Split it. A hook for the logic, and a thin component that calls the
   hook and does the placement. This is what mature libraries ship, and it is why
   several expose `useX()` *and* `<X>{…}</X>` over one implementation.
4. **Migrate callers incrementally** by keeping the component as a wrapper over
   the new hook. The component becomes three lines and nothing breaks.

```jsx
// The component survives as a thin shim over the hook
function MouseTracker({ children }) {
  return children(useMousePosition());
}
```



## Gotchas

**The nesting cost is not linear.** Two render props are tolerable; four are
unreadable, because each adds indentation *and* a closure scope, and values from
the outer ones have to be threaded manually through every level below.

**`useCallback` on a render prop is usually pointless.** It only helps when the
receiving component is memoized. Check before wrapping — otherwise it is cost
with no benefit, and it introduces a dependency array that can go stale.

**The React Compiler changes the memoization advice, not the nesting advice.** It
can stabilise the function for you; it cannot flatten wrapper hell.

**Returning `JSX.Element` from a typed render prop rejects `null`**, which is
almost always a legal thing for the caller to return.

**Generic inference silently degrades to `unknown` or `any`** if the generic is
declared in the wrong place, and the caller loses every bit of type help without
an error.

**A render prop cannot cross the Server/Client boundary**, and the failure is a
serialization error whose message does not mention your component's design.

**JSX elements *can* cross it**, which is why converting a render prop to a slot
is often the actual fix in an RSC app rather than a stylistic downgrade.

**Testing the render prop tests the values, not the UI.** A component can pass
perfect values and still position everything wrong.

**Migrating a render prop away is not always possible**, and treating it as
technical debt to be eliminated leads to worse code in the five cases where it is
structurally required.

**Keeping the component as a shim over a new hook is nearly free** — three lines —
and is almost always better than a breaking change for callers.

## Interview questions

**What stops a render prop being used in a Server Component?**
Props crossing the Server/Client boundary must be serializable, and a plain
function is not — only Server Functions and functions exported from
client-marked modules qualify. An inline render prop is neither.

**What *can* cross that boundary instead?**
JSX elements are on the serializable list, so the slot form works where the
function form does not. That is a real reason modern APIs prefer element props
and `asChild`.

**Why does an inline render prop defeat memoization?**
It is a new function object every render, so a shallow prop comparison always
fails and the memoized child never skips. The legacy docs flag this against
`PureComponent`; `memo` is the modern equivalent.

**When is `useCallback` on a render prop worth it?**
Only when the receiving component is actually memoized. Otherwise it costs a
dependency array and buys nothing — and under the Compiler it is generally
handled anyway.

**How do you type one?**
Make the component generic over the item type and type the prop as a function
returning `React.ReactNode` — not `JSX.Element`, which rejects `null`, strings
and arrays. Inference then flows from the data prop into the callback's
parameters.

**What is the testing advantage?**
The render prop is an observable seam: pass a spy and assert exactly what the
component handed out, and how many times, without rendering real UI.

**How do you migrate one to a hook?**
If the component only computes and calls the function, move the body into a hook
and delete the component. If it decides placement, count or a boundary, keep it.
If both, split — hook for the logic, thin component for the placement — and leave
the old component as a shim so callers do not break.

**Is every render prop technical debt?**
No. In the five structural cases it is the only thing that works, and replacing
it produces worse code.

---

← Prev: [02 · Where it still wins](02-where-it-still-wins.md) · Index: [Render props](README.md)
