---
title: "When you actually wanted shared state"
sidebar_label: "03 · When you wanted shared state"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context),
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> No sandbox script backs this page; claims are cited, not measured.

**There are exactly three places shared state can live: in a common parent, in a
context provider, or in a store outside React. A custom hook is not a fourth place —
it is how components *reach* whichever one you chose.**

The two previous chunks establish that hook calls are independent. The useful
question is therefore not "how do I make the hook share" but **"where should this
state actually live?"** — and once you answer that, the hook becomes a thin reader
over it and every caller agrees automatically.

This chunk covers the two answers that stay inside React. The third — a store outside
it — is [chunk 04](04-external-stores.md).

## The decision, first

Work down this list and stop at the first row that fits. The order is by cost, and
each step down buys reach at the price of coupling.

| Where the state lives | Reach | Use it when | Cost |
|---|---|---|---|
| **A common parent** (lift state up) | The subtree it passes props to | The components have a close common ancestor | Props through intermediate layers |
| **A context provider** | Everything under the provider | Distant components, or too many layers to thread | Every reader re-renders on change |
| **An external store** | Anything, including outside React | State that outlives the tree, or non-React writers | You own subscription and immutability |

There is no row above the first: **props are the default**, and react.dev says so
before it teaches context.

## 1 · Lift the state up

> Sometimes, you want the state of two components to always change together. To do
> it, **remove state from both of them, move it to their closest common parent, and
> then pass it down to them via props.** This is known as *lifting state up,* and it's
> one of the most common things you will do writing React code.

The recipe, in three steps:

> 1. **Remove** state from the child components.
> 2. **Pass** hardcoded data from the common parent.
> 3. **Add** state to the common parent and pass it down together with the event
>    handlers.

Step 2 looks like busywork and is the step that catches mistakes: with hardcoded data
you can confirm the components render correctly from props alone, *before* wiring any
state. If they do not, the bug is in the rendering, not in the state ownership — and
you found that out while there was still only one thing to blame.

Applied to a custom hook, the change is small. The hook stops owning state and starts
taking it:

```jsx
// Before — each caller owns its own theme
function Panel() {
  const [theme, setTheme] = useTheme();      // 🔴 independent per caller
  // ...
}

// After — the parent owns it; the hook became a pure helper
function App() {
  const [theme, setTheme] = useState('light');
  return (
    <>
      <Panel theme={theme} onThemeChange={setTheme} />
      <Toolbar theme={theme} onThemeChange={setTheme} />
    </>
  );
}
```

The hook does not have to disappear. It keeps whatever logic was worth sharing —
validation, formatting, the effect that persists the value, the derived flags — and
simply no longer holds the state. That is the general move: **`useState` moves up,
the rest of the hook stays.** A hook that is left with nothing but a `useState` was
never carrying much logic, and deleting it is the honest outcome
([Phase 7 · 12](../12-extracting-too-early.md)).

The principle the docs attach to this names the thing you are actually deciding:

> **For each unique piece of state, you will choose the component that "owns" it.**
> This principle is also known as having a "single source of truth". It doesn't mean
> that all state lives in one place — but that for *each* piece of state, there is a
> *specific* component that holds that piece of information.

Read the second sentence carefully: "single source of truth" is a **per-piece**
property, not an instruction to hoist everything to the root. Lifting to the *closest*
common ancestor is the whole discipline; lifting higher costs render scope for nothing
([Phase 6 · 13](../../phase-6-performance/13-moving-state-down.md) is the same idea
running in the other direction).

And the vocabulary you will hit in review:

> It is common to call a component with some local state "uncontrolled" … In contrast,
> you might say a component is "controlled" when the important information in it is
> driven by props rather than its own local state.

> Uncontrolled components are easier to use within their parents because they require
> less configuration. But they're **less flexible** when you want to coordinate them
> together. Controlled components are maximally flexible, but they require the parent
> components to fully configure them with props.

A custom hook owning state is the uncontrolled option, **chosen implicitly** — nobody
decided it; it happened because that is where the `useState` was written. Lifting is
the deliberate switch to controlled. Note that "we need these two to agree" is exactly
the situation the docs say uncontrolled components are bad at, which is why this
particular refactor comes up so often.

## 2 · Put it in a context provider

Lifting stops being pleasant when the common ancestor is eight layers up. Context is
the answer, but react.dev is emphatic that it is not the *first* answer:

> **Start by passing props.** If your components are not trivial, it's not unusual to
> pass a dozen props down through a dozen components. It may feel like a slog, but it
> makes it very clear which components use which data! The person maintaining your
> code will be glad you've made the data flow explicit with props.

> **Extract components and pass JSX as `children` to them.** If you pass some data
> through many layers of intermediate components that don't use that data (and only
> pass it further down), this often means that you forgot to extract some components
> along the way. … Instead, make `Layout` take `children` as a prop, and render
> `<Layout><Posts posts={posts} /></Layout>`. This reduces the number of layers
> between the component specifying the data and the one that needs it.

> If neither of these approaches works well for you, consider context.

The second alternative is badly under-used and is often the real fix: the prop
drilling was a symptom of a **missing component boundary**, not of missing context.
Ten layers that each forward `posts` untouched are ten layers that should have been
one `children` slot. It is worth trying before context because it removes the
coupling instead of hiding it.

When context *is* right, the shape is a provider plus a reader hook — and this is
where the custom hook comes back, doing the job it is genuinely good at:

```jsx
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme must be used within a ThemeProvider');
  return value;
}
```

Four things are doing work here:

- **The state is declared once**, in the provider. Every `useTheme()` call reads the
  same value because it reads *context*, not its own slot. The hook is still
  completely independent per caller — it just has nothing of its own to be independent
  about. That is the resolution of the whole topic in one line.
- **The reader hook is the public API.** Consumers never import `ThemeContext`, so the
  provider can later switch to a reducer, split into two contexts, or move to an
  external store without touching a single call site.
- **The `null` check turns a missing provider into a loud error** at the boundary,
  instead of `undefined` propagating into a render and failing three components later
  with `Cannot read properties of undefined`.
  [Phase 5 · 13](../../phase-5-refs-context-reducers/13-default-context-value.md)
  covers when a real default value is better than throwing.
- **`useMemo` on the value** stops a fresh object identity on every provider render
  from waking every consumer —
  [Phase 5 · 05](../../phase-5-refs-context-reducers/05-context-re-render-problem.md).
  (With the Compiler on, this is one of the memos it can write for you;
  [Phase 6 · 11](../../phase-6-performance/11-do-you-still-write-usememo.md).)

React lists this among context's own use cases, so it is not a workaround:

> **Managing state:** As your app grows, you might end up with a lot of state closer
> to the top of your app. Many distant components below may want to change it. It is
> common to **use a reducer together with context** to manage complex state and pass
> it down to distant components without too much hassle.

For anything past a single value, that reducer-plus-context pairing is the shape to
reach for: [Phase 5 · 12](../../phase-5-refs-context-reducers/12-context-plus-reducer.md).
It also has a performance property worth knowing — `dispatch` is stable, so a
component that only dispatches never re-renders when the state changes, provided the
two are in separate contexts.

**The cost to know before you reach for it:** every component reading the context
re-renders when the value changes, whether or not it uses the part that changed. There
is no selector mechanism in `useContext`. Splitting one context into two — state and
dispatch, or by update frequency — is the standard mitigation and a genuine design
decision, not a micro-optimisation.

## Gotchas

**Symptom:** state is lifted, and now a dozen intermediate components pass props they
never read.
**Cause:** the ancestor is too far up, or a component boundary is missing.
**Fix:** try `children` first — pass the JSX that needs the data instead of the data
itself. Reach for context only if that does not help; the docs put those in that
order for a reason.

**Symptom:** a shared-state refactor makes an unrelated component slower.
**Cause:** state moved *up*, so every change now re-renders a larger subtree.
**Fix:** the closest common ancestor, not a convenient one near the root. Push it back
down as far as it will go
([Phase 6 · 13](../../phase-6-performance/13-moving-state-down.md)).

**Symptom:** context is added and unrelated components re-render on every keystroke.
**Cause:** every consumer re-renders when the provider's value changes, and the value
object is new on every provider render.
**Fix:** memoize the value, and split the context by update frequency — commonly a
state context and a dispatch context.

**Symptom:** `useTheme()` returns `undefined` in one part of the app.
**Cause:** the component is outside the provider, and the default context value is
`undefined`.
**Fix:** throw from the reader hook with a message naming the provider, or supply a
real default deliberately.

**Symptom:** two providers of the same context are mounted and the wrong one wins.
**Cause:** `useContext` reads the **closest** provider above it, which is a feature —
nested providers deliberately override.
**Fix:** confirm the tree, and if the nesting is accidental, hoist the provider above
both branches.

**Symptom:** after lifting, a child cannot update the value.
**Cause:** the state moved but the setter did not — only the value was passed down.
**Fix:** pass the handler with the value. The docs' step 3 says "together with the
event handlers" for exactly this reason.

**Symptom:** the reader hook is exported alongside the context object, and half the
codebase imports the context directly.
**Cause:** no enforced boundary.
**Fix:** export only the provider and the hook. The indirection is what lets the
implementation change later without touching consumers.

## Interview questions

**★ Two components need the same state. Walk through your options in order.**
Closest common parent first — lift the state up and pass it down together with the
handlers; that is the default and keeps the data flow explicit. If the ancestor is too
distant, try extracting components and passing JSX as `children` before anything else,
because prop drilling usually signals a missing boundary. Then context: state declared
once in a provider, read through a custom hook, accepting that every consumer
re-renders when the value changes. Finally an external store, when the state is not
owned by the tree or is written by non-React code.

**★ How does a custom hook fit into a shared-state design?**
As the reader, not the owner. A `useTheme()` that calls `useContext` gives every caller
the same value because the state lives in the provider; the hook is still completely
independent per call, it simply holds nothing of its own. The rule to carry through a
refactor: `useState` moves up, the rest of the hook stays put. It also becomes the
public API — consumers never touch the context object, so the provider can be
rewritten without touching call sites.

**★ Context makes every consumer re-render. Does that make it a bad choice?**
No, it makes it a choice with a known cost, and the design work is scoping. Split by
update frequency, keep dispatch separate from state (dispatch is stable, so
dispatch-only consumers never re-render when the state changes), memoize the provider
value so a provider render does not hand out a new object identity, and keep the
provider as low in the tree as the readers allow. React lists managing state — commonly
a reducer with context — as a first-class use case.

**What does "single source of truth" actually commit you to?**
That for each *piece* of state there is one specific component that owns it — not that
all state lives in one place. It is a per-piece property, so the correct home is the
closest common ancestor of the components that need it. Hoisting everything to the
root satisfies the words and costs you render scope for nothing.

**Why does the lifting recipe include "pass hardcoded data" as a separate step?**
Because it separates two failures that are easy to confuse. With hardcoded props you
verify the children render correctly from props alone; only then do you add state to
the parent. If something breaks after step 3, it is the state wiring, because step 2
already proved the rendering.

**What is the difference between a controlled and an uncontrolled component here?**
A component holding its own state is uncontrolled — easier to drop in, less
configuration, and poor at coordinating with a sibling. Driving it from props makes it
controlled — maximally flexible, at the cost of the parent having to configure it
fully. A custom hook that owns state makes every caller uncontrolled by default, which
is exactly why "these two must agree" turns into a lifting exercise.

---

← Prev: [The `useLocalStorage` trap](02-the-localstorage-trap.md) ·
Index: [Share logic, not state](README.md) ·
Next → [State outside React](04-external-stores.md)
