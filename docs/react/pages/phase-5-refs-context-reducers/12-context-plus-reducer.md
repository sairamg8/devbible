---
title: "Context plus reducer"
sidebar_label: "12 · Context plus reducer"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context).
> No sandbox script backs this page; claims are cited, not measured.

**React's own answer to "we need app state without a library". Two contexts, one
reducer, and a file that exports a provider and two hooks — after which no
component imports a context object again.**

## The three steps

> 1. **Create** the context.
> 2. **Put** state and dispatch into context.
> 3. **Use** context anywhere in the tree.

And the crucial detail is in step 1 — there are **two** of them:

```jsx
export const TasksContext = createContext(null);
export const TasksDispatchContext = createContext(null);
```

Not one context holding `{tasks, dispatch}`. Two, and the reason is
[topic 05](05-context-re-render-problem.md): `dispatch` has a stable identity
([topic 03](03-usereducer.md)), so a context whose value is *only* `dispatch` has a
value that **never changes**, and its consumers never re-render because of it.

A combined `{tasks, dispatch}` object would be a new identity whenever `tasks`
changed — dragging every dispatch-only component into every state update, and
requiring a `useMemo` to avoid dragging them into every render as well. Splitting
removes both problems and needs no memoization at all.

## The whole wiring in one file

> You can further declutter the components by **moving all wiring into one file.**

```jsx
export function TasksProvider({ children }) {
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);

  return (
    <TasksContext value={tasks}>
      <TasksDispatchContext value={dispatch}>
        {children}
      </TasksDispatchContext>
    </TasksContext>
  );
}

export function useTasks() {
  return useContext(TasksContext);
}

export function useTasksDispatch() {
  return useContext(TasksDispatchContext);
}
```

Three exports and the module is the entire public API:

```jsx
<TasksProvider>
  <TaskList />
</TasksProvider>
```

```jsx
function TaskList() {
  const tasks = useTasks();          // re-renders when tasks change
  // ...
}

function AddTask() {
  const dispatch = useTasksDispatch();   // never re-renders from state
  // ...
}
```

Note what a consumer no longer does: import a context object, know there are two of
them, or call `useContext` at all. **The contexts stop being part of the interface**
— which also means you could later swap the implementation for a store without
touching a single consumer.

On why the hooks are legal here:

> Functions like `useTasks` and `useTasksDispatch` are called *Custom Hooks*. Your
> function is considered a custom Hook **if its name starts with `use`. This lets
> you use other Hooks, like `useContext`, inside it.**

The naming convention is not decoration — it is what permits the hook call inside.
Custom hooks are Phase 7's subject; this is the first place they earn their keep.

## Why the split is the whole point

Trace one dispatch through both arrangements:

**One combined context.** `dispatch({type: 'added'})` → reducer returns new `tasks`
→ provider re-renders with a new `{tasks, dispatch}` object → **every consumer
re-renders**, including buttons that only ever dispatch.

**Two contexts.** Same dispatch → `TasksContext`'s value changes so its consumers
re-render → `TasksDispatchContext`'s value is the same `dispatch` function, fails no
`Object.is` comparison, so **its consumers are untouched.**

In a list where every row has a delete button, that is the difference between
re-rendering every button on every change and re-rendering none of them.

This is exactly the phase gate: *"an auth context that a consumer can read without
re-rendering when unrelated context state changes … and exposes `logout()` through a
dispatch context that never changes identity."*

## Many pairs, not one store

> You can have **many context-reducer pairs** like this in your app.

The natural mistake coming from a single-store mental model is one `AppContext`
holding everything. The docs point the other way, and
[topic 05](05-context-re-render-problem.md) says why: one pair per thing that
changes for its own reasons. `TasksProvider`, `AuthProvider`, `ThemeProvider` — each
with its own reducer, each re-rendering only its own consumers.

Nesting several providers is a readability tax you pay once, and it can be hidden:

```jsx
function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TasksProvider>{children}</TasksProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

## Where this stops being enough

Honestly, since this pattern is often presented as a complete Redux replacement. It
gives you: state in one place, transitions in one place, delivery to any depth, and
a testable reducer. It does **not** give you selectors
([topic 11](11-what-context-is-and-is-not.md)) — a consumer of `TasksContext`
re-renders when *any* task changes, even if it renders one of them.

The signal to move on is splitting contexts further and further to approximate
per-field subscriptions. Until then, this is React's built-in answer and it is
genuinely sufficient for most applications.

## Gotchas

**Symptom:** dispatch-only components re-render on every state change.
**Cause:** one context holding `{state, dispatch}`.
**Fix:** two contexts. The dispatch one then never changes value.

**Symptom:** the split was made and consumers still re-render together.
**Cause:** the dispatch context's value is an object or an arrow wrapping
`dispatch`, so it has a new identity each render.
**Fix:** pass `dispatch` itself. Its stability is the entire mechanism.

**Symptom:** `useTasks()` returns `null`.
**Cause:** the component is outside `TasksProvider`, so it gets the
`createContext(null)` default.
**Fix:** check the tree — and make it a loud error rather than a `null`
([topic 13](13-default-context-value.md)).

**Symptom:** every consumer imports two context objects and calls `useContext`
twice.
**Cause:** the wiring was not moved into one file.
**Fix:** export the provider and two custom hooks; keep the contexts unexported.

**Symptom:** one `AppContext` grows to hold everything.
**Cause:** a single-store mental model.
**Fix:** many context-reducer pairs, one per thing that changes for its own
reasons.

**Symptom:** contexts keep being split to stop unrelated re-renders.
**Cause:** approximating selectors, which context does not have.
**Fix:** that is the signal a state library is warranted.

## Interview questions

**★ Why two contexts rather than one holding `{state, dispatch}`?**
Because `dispatch` has a stable identity, so a context whose value is only
`dispatch` never changes — and its consumers therefore never re-render from state
updates. A combined object would be a new identity whenever the state changed,
dragging every dispatch-only component into every update and needing a `useMemo` on
top. Splitting removes both problems and requires no memoization.

**★ What does moving the wiring into one file buy you?**
The contexts stop being part of the interface. The module exports a provider and two
custom hooks — `useTasks`, `useTasksDispatch` — so consumers never import a context
object, never know there are two, and never call `useContext`. That also means the
implementation could be swapped for a store later without touching any consumer.

**★ Why must the custom hooks be named `use…`?**
Because that is what makes them custom Hooks, and only a Hook may call other Hooks
like `useContext` inside it. The docs state it directly: a function is considered a
custom Hook if its name starts with `use`, which is what lets it use other Hooks.

**Should an app have one context-reducer pair or several?**
Several — the docs say you can have many such pairs, and the re-render argument
requires it. One pair per thing that changes for its own reasons, so tasks changing
does not re-render theme consumers. The nesting of several providers can be hidden
in a single `Providers` component.

**When does this pattern stop being enough?**
When you need per-field subscriptions. It gives you centralised state, centralised
transitions, delivery at any depth and a testable reducer — but no selectors, so a
consumer re-renders when any part of that context's value changes. The signal is
splitting contexts further and further to approximate selectors; at that point a
state library is doing something React genuinely does not provide.

---

← Prev: [What context is and is not](11-what-context-is-and-is-not.md) · Index: [Phase 5](README.md) · Next → [The default context value](13-default-context-value.md)
