---
title: "useLayoutEffect"
sidebar_label: "12 · useLayoutEffect"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect).
> No sandbox script backs this page; claims are cited, not measured.

**The same hook as `useEffect` with one difference — it fires before the browser
repaints — and that one difference is both the entire reason to use it and the
entire reason not to.**

> `useLayoutEffect` is a version of `useEffect` that **fires before the browser
> repaints the screen.**

The reference opens with a warning rather than a description, which tells you how
the API is meant to be used:

> ⚠️ `useLayoutEffect` **can hurt performance. Prefer `useEffect` when possible.**

## The guarantee, and its price

> React guarantees that the code inside `useLayoutEffect` and any state updates
> scheduled inside it will be processed **before the browser repaints the
> screen.** … In other words, **`useLayoutEffect` blocks the browser from
> painting.**

Those are one sentence, not two. The guarantee *is* the blocking: React can only
promise the user will not see an intermediate state by refusing to let the browser
paint until your code and its resulting re-render are finished.

> The code inside `useLayoutEffect` and all state updates scheduled from it block
> the browser from repainting the screen. **When used excessively, this makes your
> app slow.**

So the cost is not abstract. Whatever runs there is on the critical path between
the user acting and the user seeing anything — including a full extra render pass
if you set state.

[Topic 01](01-what-an-effect-is-for.md) noted that `useEffect`'s relationship to
paint is not guaranteed in either direction. `useLayoutEffect` is where the
guarantee exists, and it costs exactly what a guarantee like that must cost.

## The case it exists for: measure, then place

> Most components don't need to know their position and size on the screen to
> decide what to render. They only return some JSX. Then the browser calculates
> their *layout* (position and size) and repaints the screen.

The exception is anything that must position itself relative to its own measured
size — the canonical example being a tooltip that goes above the target if it
fits and below if it does not:

```jsx
function Tooltip() {
  const ref = useRef(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);

  useLayoutEffect(() => {
    const { height } = ref.current.getBoundingClientRect();
    setTooltipHeight(height);
  }, []);
  // ...
}
```

The documented sequence:

> 1. Render the tooltip anywhere (even with a wrong position)
> 2. Measure its height and decide where to place the tooltip
> 3. Render the tooltip *again* in the correct place
> 4. **All of this needs to happen before the browser repaints the screen.** You
>    don't want the user to see the tooltip moving.

Two renders happen either way. `useLayoutEffect` only decides whether the user
**sees** the first one. In `useEffect` the same code produces a visible flicker —
the tooltip appearing in the wrong place and jumping. That flicker is the entire
symptom this hook exists to remove.

> This lets you render the tooltip, measure it, and re-render the tooltip again
> **without the user noticing the first extra render.**

## The caveats

Everything else is inherited from `useEffect` and worth confirming rather than
assuming:

- **Hook rules.** Top level only — *"You can't call it inside loops or
  conditions. If you need that, extract a component and move the Effect there."*
- **`StrictMode`.** *"React will run one extra development-only setup+cleanup
  cycle before the first real setup"* — the same stress test, the same meaning
  ([topic 05](05-strictmode-double-invocation.md)).
- **Object and function dependencies.** *"there is a risk that they will cause the
  Effect to re-run more often than needed"* — the same identity problem and the
  same fixes ([topic 11 · 01](11-removing-dependencies/01-objects-and-functions.md)),
  and more costly here because each re-run blocks paint.
- **Client only.** *"Effects only run on the client. They don't run during server
  rendering."*

One caveat is specific and easy to miss:

> If you trigger a state update inside `useLayoutEffect`, React will execute **all
> remaining Effects immediately including `useEffect`.**

So a state update here does not merely add a render before paint — it drags every
pending passive effect forward into the blocking window with it. An expensive
`useEffect` elsewhere in the tree can end up on the critical path because of a
`useLayoutEffect` you wrote somewhere else.

## The server-rendering problem

The one error people meet without expecting it:

> **`useLayoutEffect` does nothing on the server**

> When you or your framework uses server rendering, your React app renders to HTML
> on the server for the initial render… The problem is that **on the server, there
> is no layout information.**

The hook's whole purpose is to read layout and adjust before paint; on the server
there is nothing to read and no paint to precede. React warns rather than failing
silently. The four documented ways out:

| Option | What it means |
|---|---|
| **Use `useEffect` instead** | *"This tells React that it's okay to display the initial render result without blocking the paint."* Accept the flicker. |
| **Mark the component client-only** | React replaces its content up to the nearest `<Suspense>` boundary with a fallback. |
| **Render only after hydration** | An `isMounted` boolean state, so the measuring branch never runs on the server. |
| **`useSyncExternalStore`** | If you are really synchronizing with an external store — it supports server rendering ([topic 16](16-external-store.md)). |

The first is the right answer more often than people expect: a brief flicker on an
initial page load is frequently a better trade than a client-only subtree or a
suspense fallback.

## Choosing between the two

Use `useLayoutEffect` when **the user would otherwise see something wrong** — a
measurement-dependent position, a scroll restored after a DOM change, a value
adjusted between commit and paint. Use `useEffect` for everything else, which is
almost everything: fetching, subscribing, logging, timers, connections.

The test is not "does this touch the DOM" — plenty of DOM work is fine in a
passive effect. It is **"would a paint in between be visibly wrong?"**

## Gotchas

**Symptom:** a tooltip, dropdown or popover flashes in the wrong position before
snapping into place.
**Cause:** measuring in `useEffect`, which may run after paint, so the user sees
the pre-measurement render.
**Fix:** `useLayoutEffect`. This is the case it exists for.

**Symptom:** `useLayoutEffect does nothing on the server` in a server-rendered
app.
**Cause:** there is no layout information on the server and no paint to precede.
**Fix:** one of the four documented options — most often just `useEffect`.

**Symptom:** interactions feel sluggish and a profile shows long gaps before
paint.
**Cause:** work in `useLayoutEffect` sits on the critical path between the
interaction and anything appearing on screen.
**Fix:** move everything that does not need the guarantee to `useEffect`.

**Symptom:** an unrelated, expensive `useEffect` starts running before paint.
**Cause:** a state update inside a `useLayoutEffect` — React then executes all
remaining effects immediately, including passive ones.
**Fix:** avoid setting state in a layout effect unless the visual correction
requires it.

**Symptom:** a layout effect re-runs far more than expected and the app janks.
**Cause:** an object or function dependency with a new identity each render.
**Fix:** the same moves as
[topic 11 · 01](11-removing-dependencies/01-objects-and-functions.md) — and they
matter more here, because each re-run blocks paint.

**Symptom:** `useLayoutEffect` used because "it runs earlier and that seems
safer".
**Cause:** treating it as a stricter `useEffect` rather than as a specific
trade-off.
**Fix:** the reference opens by telling you to prefer `useEffect`. Earlier is not
better; it is more expensive.

## Interview questions

**★ What is the difference between `useEffect` and `useLayoutEffect`?**
`useLayoutEffect` fires before the browser repaints, and React guarantees that its
code and any state updates scheduled inside it are processed before that paint.
That guarantee *is* the blocking — React can only promise the user will not see an
intermediate state by refusing to let the browser paint. `useEffect` makes no such
promise in either direction, which is why it is the default and the reference
opens by telling you to prefer it.

**★ Give the case that genuinely needs it.**
Anything that must measure itself to decide where to go — react.dev's tooltip,
which renders somewhere arbitrary, measures its own height, then re-renders in the
right place. Two renders happen either way; `useLayoutEffect` only decides whether
the user sees the first one. In `useEffect` the same code produces a visible jump.

**★ Why does react.dev warn about performance right at the top?**
Because everything in a layout effect sits on the critical path between the user
acting and anything appearing on screen, including a whole extra render if you set
state. There is also a knock-on: setting state inside a layout effect makes React
execute all remaining effects immediately, including passive `useEffect` ones — so
unrelated expensive work elsewhere in the tree can be dragged into the blocking
window.

**Why does `useLayoutEffect` warn during server rendering, and what are the
options?**
Because there is no layout information on the server and no paint to run before,
so the hook cannot do the only thing it exists for. The documented options are to
switch to `useEffect` and accept displaying the initial render without blocking
paint; mark the component client-only so React shows a `<Suspense>` fallback;
render only after hydration behind an `isMounted` flag; or, if you are really
reading an external store, use `useSyncExternalStore`, which supports server
rendering.

**What is the test for choosing between them?**
Not "does this touch the DOM" — plenty of DOM work belongs in a passive effect.
The question is whether a paint occurring in between would be *visibly wrong*. If
the user would see a flicker, a jump, or a wrong scroll position, the guarantee is
worth its cost. Otherwise `useEffect`.

**Do the other effect rules apply to `useLayoutEffect`?**
Yes, all of them — top-level Hook rules, the `StrictMode` extra setup/cleanup
cycle, cleanup semantics, client-only execution, and the object-identity
dependency trap. The only difference is timing relative to paint. The identity
trap is worse here, though, because every unnecessary re-run blocks a frame.

---

← Prev: [Removing dependencies legitimately](11-removing-dependencies/README.md) · Index: [Phase 4](README.md) · Next → [Effect ordering](13-effect-ordering.md)
