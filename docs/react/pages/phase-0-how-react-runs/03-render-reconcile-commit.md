---
title: "Render, reconcile, commit"
sidebar_label: "03 · Render, reconcile, commit"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**, production
> build. The log is printed by `sandbox/react-p0/ex03-render-commit.mjs`.

**An update runs in three phases: React calls your components (*render*),
compares the result with the previous one (*reconcile*), then applies the
difference to the DOM (*commit*). Render can be repeated or discarded. Commit
cannot.**

Almost every rule React asks you to follow is a consequence of that last
sentence.

## The three phases

| Phase | What React does | Can it be thrown away? |
|---|---|---|
| **Render** | Calls your component functions to get elements | **Yes** — repeatedly, and the result may be discarded |
| **Reconcile** | Diffs the new element tree against the current one | Yes, it is part of render |
| **Commit** | Applies DOM operations, then runs refs and effects | **No** — the user can see it |

"Render" means *React called your function*. It does not mean anything appeared
on screen. That distinction is the whole page.

## Watching it happen

The probe below asks one question at each moment: **what does the committed DOM
say right now?** The component is a counter whose label reads `count 0` and then
`count 1`.

```jsx
const dom = () => JSON.stringify(document.querySelector('#label')?.textContent ?? null);

function Child({n}) {
  console.log('  3. Child renders. DOM #label =', dom());
  useLayoutEffect(() => { console.log('  5. Child useLayoutEffect. DOM #label =', dom()); });
  useEffect(()       => { console.log('  7. Child useEffect. DOM #label =', dom()); });
  return <span id="label" ref={(node) =>
    console.log('  4. Child ref callback, arg =',
                node === null ? 'null (detach)' : '<span> (attach)', '. DOM #label =', dom())
  }>count {n}</span>;
}

function Parent() {
  const [n, setN] = useState(0);
  console.log('  2. Parent renders. DOM #label =', dom());
  useLayoutEffect(() => { console.log('  6. Parent useLayoutEffect. DOM #label =', dom()); });
  useEffect(() => {
    console.log('  8. Parent useEffect. DOM #label =', dom());
    if (n === 0) setN(1);
  });
  return <div><Child n={n} /></div>;
}

console.log('  1. before render(). DOM #label =', dom());
createRoot(document.getElementById('root')).render(<Parent />);
console.log('  1b. immediately after render() returns. DOM #label =', dom());
```

```console
$ node ex03-render-commit.mjs
=== environment ===
  browser  Firefox/153.0
  mode     production build (StrictMode off, no double render)

=== ordering — number prefixes are written into the logs, not added here ===
  1. before render(). DOM #label = null
  1b. immediately after render() returns. DOM #label = null
  2. Parent renders. DOM #label = null
  3. Child renders. DOM #label = null
  4. Child ref callback, arg = <span> (attach) . DOM #label = "count 0"
  5. Child useLayoutEffect. DOM #label = "count 0"
  6. Parent useLayoutEffect. DOM #label = "count 0"
  7. Child useEffect. DOM #label = "count 0"
  8. Parent useEffect. DOM #label = "count 0"
--- second render, triggered by setN(1) ---
  2. Parent renders. DOM #label = "count 0"
  3. Child renders. DOM #label = "count 0"
  4. Child ref callback, arg = null (detach) . DOM #label = "count 1"
  4. Child ref callback, arg = <span> (attach) . DOM #label = "count 1"
  5. Child useLayoutEffect. DOM #label = "count 1"
  6. Parent useLayoutEffect. DOM #label = "count 1"
  7. Child useEffect. DOM #label = "count 1"
  8. Parent useEffect. DOM #label = "count 1"

=== final committed DOM ===
  <div><span id="label">count 1</span></div>
```

## What that log proves

**1. `root.render()` does not render.** Line `1b` runs immediately after the call
and the DOM is still `null`. `render()` *schedules* work; React does it when it
chooses.

**2. During render, the DOM still shows the previous UI.** Look at the second
pass: `Parent renders` reports `"count 0"` while it is computing `count 1`. Your
component body runs *before* anything is applied.

This is why reading the DOM during render is a bug: you get the previous frame.

**3. Commit is where the DOM changes, and refs see it first.** The ref callback
is the first thing to observe `"count 1"`, followed by layout effects, then
passive effects.

**4. Children commit before parents.** `Child`'s ref and layout effect run before
`Parent`'s. React finishes a subtree before its parent, so a parent's
`useLayoutEffect` can rely on its children's DOM existing — the reverse is not
true.

**5. An inline ref callback runs twice per update.** `arg = null (detach)` then
`arg = <span> (attach)`. The arrow function is a new identity every render, so
React detaches the old one and attaches the new one. Harmless for a logger,
expensive if the callback does real work — use `useCallback`, a `useRef`, or (in
React 19) return a cleanup function from the ref.

## Render must be pure

Because render can run repeatedly and be discarded, your component body must be
safe to call again with nothing observable happening. In practice:

```jsx
// ✗ Wrong — a side effect during render
let requestCount = 0;
function Profile({id}) {
  requestCount++;                 // mutation outside React
  document.title = `User ${id}`;  // DOM write during render
  analytics.track('profile_view'); // fires on a render that may be thrown away
  return <h1>{id}</h1>;
}

// ✓ Right — describe during render, act after commit
function Profile({id}) {
  useEffect(() => {
    document.title = `User ${id}`;
    analytics.track('profile_view');
  }, [id]);
  return <h1>{id}</h1>;
}
```

The rule is not stylistic. React genuinely calls components twice in development
([StrictMode](07-strictmode.md)) and genuinely abandons in-progress renders under
concurrent features, so an impure component produces double analytics events and
titles that lag one value behind.

## Where to put code that touches the DOM

| You want to | Use | Runs |
|---|---|---|
| Describe UI | the component body | Render — DOM not updated yet |
| Measure or mutate the DOM *before the user sees the frame* | `useLayoutEffect` | Commit, before paint — blocks painting |
| Everything else — fetching, subscriptions, logging, timers | `useEffect` | After paint |
| Grab a node when it attaches | a `ref` callback | Commit, before layout effects |

Default to `useEffect`. Reach for `useLayoutEffect` only when the user would see
a flicker otherwise — measuring a tooltip's height to position it, for example —
because it runs before the browser can paint.

## Gotchas

**Symptom:** you read `ref.current` in the component body and get `null`.
**Cause:** render happens before commit; the node does not exist yet on the
first pass.
**Fix:** read it in an effect or a ref callback.

**Symptom:** a measurement is always one update behind.
**Cause:** it is being taken during render, which sees the previous committed
DOM — exactly what line `2` of the log shows.
**Fix:** move it into `useLayoutEffect`.

**Symptom:** analytics events or API calls fire twice.
**Cause:** side effects in the render body, plus StrictMode's double render (dev)
or a discarded concurrent render (prod).
**Fix:** move them into `useEffect` with correct dependencies.

**Symptom:** a visible flicker — the element appears in the wrong place and then
jumps.
**Cause:** the correction is in `useEffect`, which runs *after* paint.
**Fix:** `useLayoutEffect`, accepting that it blocks painting.

**Symptom:** an expensive ref callback runs twice as often as expected.
**Cause:** an inline arrow ref gets a new identity each render, forcing
detach/attach.
**Fix:** memoize the callback, or use an object ref.

## Interview questions

**★ What are the phases of a React update?**
Render (React calls your components), reconciliation (diff against the previous
tree, part of render), and commit (apply DOM changes, then run refs, layout
effects, and passive effects). Render is repeatable and discardable; commit is
not.

**★ Why must render be pure?**
Because React may call it more than once for a single visible update and may
throw the result away. Anything observable in the body — a network call,
analytics, a DOM write, mutating a module variable — happens a number of times
you do not control.

**★ Difference between `useEffect` and `useLayoutEffect`?**
`useLayoutEffect` runs synchronously after DOM mutation but before the browser
paints, so it can measure and correct without a visible flicker — and it blocks
painting. `useEffect` runs after paint. Use `useEffect` unless the user would see
the intermediate frame.

**Do children or parents commit first?**
Children. Refs and layout effects run bottom-up, so a parent can assume its
children's DOM exists. Cleanup runs in the reverse direction.

**Does `root.render()` update the DOM synchronously?**
No. It schedules the work. The probe shows the DOM still `null` on the line
immediately after the call.

**Why does an inline `ref={node => …}` fire twice on update?**
Its function identity changes each render, so React detaches the previous
callback (calling it with `null`) and attaches the new one. Stabilise it with
`useCallback`, or return a cleanup function from the ref in React 19.

---

← Prev: [The element](02-the-element.md) · Index: [Phase 0](README.md) · Next → [Reconciliation](04-reconciliation.md)
