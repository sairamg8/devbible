---
title: "useDebugValue"
sidebar_label: "16 · useDebugValue"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useDebugValue`](https://react.dev/reference/react/useDebugValue).
> No sandbox script backs this page; claims are cited, not measured.

**A label for a custom hook in React DevTools. It affects nothing at runtime, it is
for library authors more than application authors, and the documentation says so
explicitly.**

> `useDebugValue` is a React Hook that lets you **add a label to a custom Hook in
> React DevTools.**

> `useDebugValue` does not return anything.

## The shape

```jsx
function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot);
  useDebugValue(isOnline ? 'Online' : 'Offline');
  return isOnline;
}
```

> Call `useDebugValue` **at the top level of your custom Hook** to display a
> readable debug value for React DevTools.

Without it, DevTools shows the hook's internal state — a bare `true` under
`SyncExternalStore` — which is accurate and unhelpful. With it, the inspector shows
`OnlineStatus: "Online"` next to the hook.

## The deferred format function

```jsx
useDebugValue(date, date => date.toDateString());
```

> Your formatting function will receive the debug value as a parameter and should
> return a formatted display value. **When your component is inspected, React
> DevTools will call this function** and display its result.

> This lets you **avoid running potentially expensive formatting logic unless the
> component is actually inspected.** For example, if `date` is a Date value, this
> avoids calling `toDateString()` on it for every render.

That is the whole reason the second argument exists, and it is the detail worth
remembering: **`useDebugValue(expensive())` runs the work every render;
`useDebugValue(value, expensive)` runs it only when someone looks.** If the label
needs any computation beyond reading a value, it belongs in the second argument.

## 🔴 Do not add it everywhere

> **Don't add debug values to every custom Hook.** It's most valuable for custom
> Hooks that are **part of shared libraries** and that have a **complex internal
> data structure that's difficult to inspect.**

Two conditions, and the docs require both: *shared library* **and** *hard to
inspect*. That excludes almost every hook in an application codebase, where you can
read the source and DevTools already shows the underlying `useState` values
meaningfully.

The failure mode of over-applying it is not performance — it is noise. A DevTools
panel where every hook carries a hand-written label is harder to scan than one where
three do.

## Where it genuinely helps

- **A hook wrapping an opaque subscription** — `useSyncExternalStore`
  ([topic 15](15-usesyncexternalstore.md)) shows the raw snapshot, which may be an
  internal shape nobody outside the library recognises.
- **A hook whose state is an encoded or normalised structure** — a form library
  holding fields, errors and touched state in one object, where a single derived
  word ("valid", "3 errors") is more useful than the tree.
- **A hook with several internal `useState` calls**, which DevTools lists as
  numbered anonymous entries with no indication of which is which.

If the hook is `const [x, setX] = useState(0); return x;`, DevTools already tells
the whole story.

## Gotchas

**Symptom:** `useDebugValue` called in a component rather than a custom hook.
**Cause:** it is documented for custom Hooks; a component's own state is already
visible in DevTools.
**Fix:** remove it, or move it into the hook it was describing.

**Symptom:** an expensive format runs on every render.
**Cause:** the formatting was done inline — `useDebugValue(date.toDateString())`.
**Fix:** pass the value and the formatter separately, so it only runs when
inspected.

**Symptom:** the DevTools panel is cluttered with labels.
**Cause:** applied to every custom hook rather than the ones that need it.
**Fix:** the documented bar is both *shared library* and *difficult to inspect*.

**Symptom:** the debug value is expected to appear in the console or in production.
**Cause:** it is a DevTools feature; it returns nothing and changes no behaviour.
**Fix:** use logging for logging.

**Symptom:** the label is missing in DevTools.
**Cause:** the function's name does not start with `use`, so it is not treated as a
custom Hook.
**Fix:** rename it ([topic 12](12-context-plus-reducer.md) — the `use` prefix is
what makes a function a Hook).

## Interview questions

**★ What does `useDebugValue` do?**
It adds a label to a custom Hook in React DevTools. It returns nothing and affects
no runtime behaviour — it exists purely so that inspecting a hook shows something
meaningful rather than its raw internal state.

**★ What is the second argument for?**
Deferred formatting. React DevTools calls the formatting function with the value
only when the component is actually inspected, so expensive formatting does not run
on every render — the docs' example is avoiding `toDateString()` on a Date each
time. If a label needs any computation, it belongs there rather than inline.

**★ When should you use it?**
Rarely, and the docs give two conditions together: hooks that are part of a shared
library, and that have a complex internal data structure that is difficult to
inspect. Most application hooks meet neither — you can read the source and DevTools
already shows the underlying state usefully. Over-applying it makes the DevTools
panel noisier, not more informative.

**Why might the label not show up?**
Because the function is not being treated as a custom Hook. A function only counts
as one if its name starts with `use`, which is also what permits it to call other
Hooks. A misnamed helper gets neither.

---

← Prev: [`useSyncExternalStore`](15-usesyncexternalstore.md) · Index: [Phase 5](README.md)
