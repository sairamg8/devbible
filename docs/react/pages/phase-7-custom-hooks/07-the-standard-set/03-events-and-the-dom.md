---
title: "Listeners — useEventListener, useOnClickOutside"
sidebar_label: "03 · Listeners"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) (caveats) and
> [`createPortal`](https://react.dev/reference/react-dom/createPortal) (the
> event-propagation caveat).
> Where a recommendation is engineering judgement rather than documented, it says so.
> No sandbox script backs this page; claims are cited, not measured.

**Two hooks that attach a native listener. Both live or die on one question: what is in
the dependency array — because a caller's inline arrow is a new value every render, and
a listener that re-attaches on every render is a listener you cannot reason about.**

## `useEventListener`

```jsx
import { useEffect, useEffectEvent } from 'react';

export function useEventListener(eventName, handler, target = window, options) {
  const onEvent = useEffectEvent(handler);        // always the latest handler

  useEffect(() => {
    const node = target?.current ?? target;       // accepts a ref or a node
    if (!node?.addEventListener) return;

    const listener = (e) => onEvent(e);
    node.addEventListener(eventName, listener, options);
    return () => node.removeEventListener(eventName, listener, options);
  }, [eventName, target, options]);
}
```

**Gotcha 1 — the handler must not be a dependency.** Callers pass an inline arrow, which
is a new function every render, so listing `handler` in the dependency array tears down
and re-attaches the listener on every render of the calling component. `useEffectEvent`
is exactly the tool: the effect keeps `[eventName, target, options]` honest while
`onEvent` always calls the newest handler. This is the same pattern the docs apply to
`useChatRoom`'s `onReceiveMessage`
([Phase 7 · 06 · 01](../06-designing-a-hooks-api/01-the-name-and-the-arguments.md)).

The caveats that shape the design:

> **Effect Events can only be called from inside Effects or other Effect Events. Do not
> call them during rendering or pass them to other components or Hooks.** The
> `eslint-plugin-react-hooks` linter enforces this restriction.

> **Effect Event functions do not have a stable identity. Their identity intentionally
> changes on every render.**

So the effect event is created *inside* this hook and used *inside* this hook's effect.
You may not accept one as an argument or hand one out, and you must never put it in a
dependency array — its identity changes every render, which would defeat the purpose it
exists for.

And the line not to cross:

> **Do not use `useEffectEvent` to avoid specifying dependencies** in your Effect's
> dependency array.

It is for *event handlers* — code that should run with the latest values when something
happens — not a way to silence the linter about a reactive value the effect genuinely
depends on. The test: if the effect would need to **re-subscribe** when the value
changes, it is a dependency. If the value is only read *when the event fires*, it belongs
in the effect event.

**Gotcha 2 — `options` as an object literal.** A caller writing `{ passive: true }`
inline creates a new object every render, so `options` in the dependency array
re-subscribes constantly — the object-argument trap from
[Phase 7 · 06 · 01](../06-designing-a-hooks-api/01-the-name-and-the-arguments.md). Either
accept the individual booleans (`passive`, `capture`, `once`) as primitives, or document
that the options object must be stable. Accepting primitives is the better API, because
it removes a requirement the caller has to know about.

**Gotcha 3 — `window` as a default parameter runs on the server.** The default is
evaluated when the hook is *called*, which happens during render, including during SSR.
The guard inside the effect does not help, because the effect never runs on the server —
the crash is earlier. Take `target` explicitly, or default it lazily inside the effect
body.

**Gotcha 4 — `removeEventListener` must receive the same options.** `capture` is part of
the listener's identity: adding with `{ capture: true }` and removing with no options
removes nothing, and the listener leaks for the life of the page. Passing the same
`options` value to both calls, as above, is what makes the cleanup an exact inverse —
the symmetry requirement from
[Phase 4 · 04](../../phase-4-effects/04-cleanup/README.md).

**Gotcha 5 — a ref as `target` is not reactive.** Accepting `ref.current` inside the
effect is convenient, but `[target]` depends on the ref *object*, which never changes.
If the element is conditionally rendered, the effect will not re-run when it appears.
For anything mounted conditionally, prefer a ref callback —
[chunk 04](04-observing-an-element.md) works that through in full.

## `useOnClickOutside`

```jsx
import { useEffect, useEffectEvent } from 'react';

export function useOnClickOutside(refs, handler) {
  const onOutside = useEffectEvent(handler);
  const list = Array.isArray(refs) ? refs : [refs];

  useEffect(() => {
    function onPointerDown(e) {
      const inside = list.some((r) => r.current?.contains(e.target));
      if (inside) return;
      onOutside(e);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable objects
  }, []);
}
```

**Gotcha 1 — `click` is the wrong event, and this is engineering judgement rather than a
documented rule.** A `click` fires after `mouseup`, so if anything moves or removes an
element between press and release, the click's target is not what the user pressed on.
`pointerdown` (or `mousedown`) matches the intent "the user pressed somewhere else". The
trade-off is real and worth stating: with `pointerdown`, a drag that starts inside the
panel and ends outside it no longer dismisses — which is usually correct, since dragging
a text selection out of a panel should not close it.

**Gotcha 2 — the trigger closes and immediately reopens the panel.** The button that
opens the panel is *outside* the panel, so pressing it fires the outside handler (closing
it) and then the button's own handler (opening it), or the reverse — either way it flaps.
This is why the hook above takes an **array** of refs: the trigger is "inside" for the
purposes of this test. Racing the two handlers with a `setTimeout` is the fix to avoid;
it works on your machine and fails under load.

**🔴 Gotcha 3 — portals.** This is the one that makes the hook subtly wrong in real apps,
and it comes from an asymmetry the docs state explicitly:

> **Events from portals propagate according to the React tree rather than the DOM tree.**
> For example, if you click inside a portal, and the portal is wrapped in
> `<div onClick>`, that `onClick` handler will fire. If this causes issues, either stop
> the event propagation from inside the portal, or move the portal itself up in the
> React tree.

> A portal only changes the **physical placement** of the DOM node. In every other way,
> the JSX you render into a portal acts as a child node of the React component that
> renders it.

That describes **React's** synthetic events. This hook attaches a **native** listener to
`document`, which sees only the real DOM — and a portalled dropdown, tooltip or submenu
is physically somewhere else, usually directly under `<body>`. So
`ref.current.contains(e.target)` is `false` for a click the user experienced as inside
your component, and the panel closes underneath them.

The fixes, in order of preference:

1. **Hold a ref on the portalled content too**, and pass both refs — which the array
   signature above already supports. Explicit, and it survives someone moving the portal.
2. **Mark portal roots** with a data attribute and test
   `e.target.closest('[data-portal-root]')`. Useful when a component library owns the
   portal and you cannot get a ref to it.
3. **Use React's own `onClick` on a wrapper** instead of a document listener, and let the
   documented React-tree propagation do the work. This inverts the problem — now
   *inside* is what bubbles — and it is the cleanest option when the component's React
   tree already wraps the portal.

**Gotcha 4 — shadow DOM.** Inside a shadow root, `e.target` is retargeted to the host
element, so `contains` gives the wrong answer for anything inside a web component.
`e.composedPath()` is the escape hatch. Worth knowing it exists rather than adding
pre-emptively — it only matters if you are actually rendering into shadow roots.

**Gotcha 5 — `ref` objects are stable, so `[]` is honest.** A ref object from `useRef`
never changes identity, so an empty dependency array is truthful here rather than a
suppression — but the comment matters, because the next reader will assume it is a lie.
Do **not** depend on `ref.current`: it is not reactive, and the linter cannot see through
it either way.

## Gotchas

**Symptom:** a listener detaches and re-attaches on every render.
**Cause:** the handler, or an inline `options` object, is in the dependency array.
**Fix:** wrap handlers in `useEffectEvent`; accept primitives instead of option objects.

**Symptom:** `useEffectEvent` is used to drop a reactive value from the dependencies and
the effect goes stale.
**Cause:** the docs' explicit warning — it is not a dependency-silencing tool.
**Fix:** if the effect must re-subscribe when the value changes, it is a dependency.

**Symptom:** a listener is never removed and leaks for the life of the page.
**Cause:** `removeEventListener` called without the `capture` option used to add it.
**Fix:** pass the identical options to both calls.

**Symptom:** SSR crashes with `window is not defined` on a hook that guards for it.
**Cause:** the guard is inside the effect, but `target = window` is a default parameter
evaluated during render.
**Fix:** default it inside the effect, or require the caller to pass it.

**Symptom:** a click-outside handler closes the menu the instant the trigger is pressed.
**Cause:** the trigger sits outside the panel, so both handlers fire.
**Fix:** treat the trigger as inside — pass its ref too.

**Symptom:** clicking inside a portalled dropdown closes the parent panel.
**Cause:** the native document listener sees the real DOM; the portal is elsewhere.
React's own events propagate by the React tree, which is why React handlers work here
and a document listener does not.
**Fix:** include the portal's ref, mark portal roots, or use React's `onClick`.

**Symptom:** the outside handler never fires inside a web component.
**Cause:** shadow DOM retargets `e.target` to the host.
**Fix:** `e.composedPath()`.

## Interview questions

**★ How do you stop a custom hook re-subscribing when the caller passes an inline
handler?**
Wrap the handler in `useEffectEvent` inside the hook and call that from the effect. The
dependency array then holds only values the effect genuinely depends on, while the
handler is always the latest one. The constraints: effect events may only be called from
inside effects, may not be passed to other components or hooks, and must never appear in
a dependency array, since their identity intentionally changes every render.

**★ When is `useEffectEvent` the wrong tool?**
When the value is a real dependency. The docs say plainly not to use it to avoid
specifying dependencies. The test is whether the effect should *re-subscribe* when the
value changes — a room id or a URL should, so it stays in the array; a callback that is
only invoked when an event fires should not, so it goes in the effect event.

**★ Why does `useOnClickOutside` break with portals?**
Because it attaches a native listener to `document`, which sees the real DOM tree, while
a portal changes the physical placement of its content. `ref.current.contains(e.target)`
is therefore false for a click the user experienced as inside the component. React's own
synthetic events do not have this problem — the docs state that events from portals
propagate according to the React tree — so the fix is to test the portal's ref too, mark
portal roots, or use React's `onClick` on a wrapper instead.

**★ Why `pointerdown` rather than `click`?**
Judgement rather than a documented rule: `click` fires on release, so if the layout
changes between press and release the target is not what the user pressed.
`pointerdown` matches "the user pressed somewhere else". The trade-off is that a drag
beginning inside and ending outside no longer dismisses — which is usually the desired
behaviour, since dragging a selection out of a panel should not close it.

**A click-outside hook flaps open and closed when the trigger is pressed. Why?**
The trigger is outside the panel, so pressing it runs the outside handler and the
trigger's own handler in sequence. The correct fix is to treat the trigger as part of
"inside" by testing its ref as well; delaying one handler with a timeout appears to work
and fails under load.

**Is an empty dependency array ever honest in a hook that closes over a ref?**
Yes — a ref object from `useRef` is stable for the component's lifetime, so depending on
it is the same as depending on nothing. What is never honest is depending on
`ref.current`, which is not reactive: assigning it neither re-renders nor re-runs
effects, so an effect will not notice the node appearing.

---

← Prev: [Browser state](02-browser-state.md) ·
Index: [The standard set](README.md) ·
Next → [Observing an element](04-observing-an-element.md)
