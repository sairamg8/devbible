---
title: "Prop getters"
sidebar_label: "04 · Prop getters"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [Responding to Events](https://react.dev/learn/responding-to-events) for
> handler propagation and `preventDefault`,
> [`useId`](https://react.dev/reference/react/useId),
> [`useCallback`](https://react.dev/reference/react/useCallback), and the
> [React 19 release notes](https://react.dev/blog/2024/12/05/react-19) for `ref`
> as a prop. The ref-callback cleanup contract quoted below is from react.dev
> [Common components § `ref` callback](https://react.dev/reference/react-dom/components/common),
> fetched 2026-08-17. Spread semantics from the ECMAScript object-spread rules
> (later keys win).
> ⚠️ **"Prop getter" is a community convention, not a React API.** React does not
> document or name it. Judgements below are marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**A function that returns the props for one element, and merges in whatever the
caller passes instead of throwing it away.**

## The problem it fixes

[Headless components](../06-headless-components/README.md) hand the caller a props object
to spread:

```jsx
<button {...triggerProps}>Shipping</button>
```

That works right up until the caller needs their own handler:

```jsx
<button {...triggerProps} onClick={track}>Shipping</button>
```

**The toggle stops working.** Object spread in JSX follows the same rule as
object spread anywhere — later keys overwrite earlier ones — so `onClick={track}`
replaced the `onClick` inside `triggerProps`. Nothing warns. The button still
looks right, `aria-expanded` still renders, and the panel never opens.

Swap the order and you break the other one instead:

```jsx
<button onClick={track} {...triggerProps}>Shipping</button>   // track never runs
```

There is no ordering that keeps both, because a plain object cannot merge
handlers. That is the whole motivation.

## The pattern

Return a **function** instead of an object. It takes the caller's props and
returns the merged result.

```jsx
function callAll(...fns) {
  return (...args) => fns.forEach((fn) => fn?.(...args));
}

function useDisclosure() {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const getTriggerProps = useCallback(
    ({ onClick, ...rest } = {}) => ({
      'aria-expanded': isOpen,
      'aria-controls': contentId,
      ...rest,
      onClick: callAll(onClick, toggle),
    }),
    [isOpen, contentId, toggle],
  );

  return { isOpen, getTriggerProps };
}
```

The caller now gets both:

```jsx
<button {...getTriggerProps({ onClick: track, className: 'faq-trigger' })}>
  Shipping
</button>
```

`track` runs, then `toggle` runs, and the ARIA attributes are still there because
the caller never had the chance to forget them.

## The three decisions inside those six lines

**1 — Handlers are pulled out by name, everything else is spread.** `onClick` is
destructured so it can be composed; `...rest` carries `className`, `id`,
`data-*` and anything else straight through. Any handler you want composable has
to be named explicitly — there is no generic "merge all functions" that is safe,
because not every function-valued prop is an event handler.

**2 — The spread of `...rest` sits *between* your defaults and your handler.**
That ordering is deliberate and it encodes a policy:

```jsx
{
  'aria-expanded': isOpen,      // before ...rest → caller CAN override
  ...rest,
  onClick: callAll(onClick, toggle),   // after ...rest → caller CANNOT clobber
}
```

Anything above `...rest` is a **default**. Anything below is an **invariant**.
Deciding which of your props are which is the actual design work here. *(Where
to draw that line is a judgement; documentation does not settle it. A reasonable
default is that ARIA state you compute from your own state belongs below the
spread, because a caller overriding `aria-expanded` is almost always a bug.)*

**3 — The caller's handler runs first.** `callAll(onClick, toggle)` gives the
caller a chance to act before your behaviour fires. The refined version lets them
cancel it:

```jsx
onClick: (event) => {
  onClick?.(event);
  if (!event.defaultPrevented) toggle();
},
```

Now `event.preventDefault()` in the caller's handler suppresses the toggle. That
is a small, discoverable escape hatch built on a DOM convention the caller
already knows, and it is worth preferring over inventing a `disableToggle` prop.

## Merging refs is the hard case

Everything above merges cleanly because props are values. Refs are not — an
element has exactly one `ref`, and both you and the caller may want it.

Since React 19 `ref` is an ordinary prop, so it arrives in `...rest` like
anything else and your own ref silently loses (or wins, depending on order). The
fix is a merge function that fans one callback out to both:

```jsx
function mergeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') ref(node);
      else if (ref != null) ref.current = node;
    });
  };
}
```

⚠️ **That version is wrong in two ways**, and both come from the same React 19
change. The documentation for a ref callback's return value says:

> When the `ref` is detached, React will call the cleanup function. If a function
> is not returned by the `ref` callback, React will call the callback again with
> `null` as the argument when the `ref` gets detached. This behavior will be
> removed in a future version.

So: `forEach` throws away any cleanup an inner ref returned, and those cleanups
never run. And the moment you *do* return a cleanup from the merged callback,
**React stops calling it with `null`** — which means the object refs above are
never reset, because the code that reset them was the `null` call you just
suppressed.

Both are fixed by making every ref hand back its own detach step:

```jsx
function mergeRefs(...refs) {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === 'function') {
        const cleanup = ref(node);
        // A modern ref returns its own cleanup. A legacy one expects null.
        return typeof cleanup === 'function' ? cleanup : () => ref(null);
      }
      if (ref != null) {
        ref.current = node;
        return () => { ref.current = null; };
      }
      return () => {};
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  };
}
```

Each branch now answers "what does detaching *this* ref mean?" — run the cleanup
it gave us, call it with `null` if it is a legacy callback that gave us none, or
null the `.current` if it is an object ref. The merged callback returns one
cleanup that runs all of them, so React's own `null` call is correctly no longer
needed.

*(`() => ref(null)` is there for backwards compatibility only. The documentation
says the `null` call is going away in a future version, so that branch has a
shelf life.)*

[Ref callbacks](../../phase-5-refs-context-reducers/06-ref-callbacks.md) is the page
on that mechanism, and
[`ref` as a prop](../../phase-2-components/09-ref-as-a-prop.md) covers the React 19
change.

## When it is the wrong answer

**When nothing needs merging.** If your component exposes no handlers the caller
would want to extend, a plain props object is simpler and reads better. Do not
convert `contentProps` into `getContentProps()` for symmetry.

**When there is one caller.** Same argument as everywhere else in this section —
this is machinery, and machinery with one consumer is
[extracting too early](../../phase-7-custom-hooks/12-extracting-too-early.md).

**When the caller needs to know what they are getting.** A props object is
inspectable; a getter is opaque until you read its source. In TypeScript this
gets worse: typing a getter that accepts arbitrary element props *and* narrows
the handlers it composes is real work, and a wrong type erases the caller's
autocomplete.

## Gotchas

**Forgetting `= {}` on the parameter.** `getTriggerProps()` called with no
arguments destructures `undefined` and throws. The default in the signature above
is not decoration.

**Forgetting to call the caller's handler.** `onClick: toggle` instead of
`onClick: callAll(onClick, toggle)` silently drops it — the same bug the pattern
exists to fix, now hidden one level deeper where nobody looks.

**Optional chaining matters in `callAll`.** The caller usually passes no handler,
so `fn?.(...args)` rather than `fn(...args)`.

**The getter's identity changes when its dependencies change**, so a `memo`'d
child receiving the result re-renders. Whether that matters is a
[Phase 6](../../phase-6-performance/README.md) question, and under the React
Compiler it usually stops mattering — but do not assume it away.

**`key` cannot be passed through a spread.** If a caller puts `key` in the object
they hand your getter, it will not behave as a key — `key` is read by React from
JSX, not from props. It has to stay on the element.

**Composing two getters is not associative.** If a caller spreads the results of
two different getters onto one element, you are back to the original clobbering
problem between *them*. The usual answer is that a getter accepts the previous
result: `getB(getA({ onClick: track }))`.

## Interview questions

**What problem does a prop getter solve?**
Spreading a static props object lets the caller's own props overwrite the
component's — most damagingly its event handlers, silently, because object spread
takes the last key. A getter merges the caller's props instead of being replaced
by them.

**Why does the caller's handler usually run first?**
So they can observe the event before your behaviour fires, and — with a
`defaultPrevented` check — cancel it. It reuses a DOM convention rather than
adding a prop per opt-out.

**What decides whether one of your props sits above or below the `...rest`
spread?**
Whether it is a default or an invariant. Above the spread the caller can override
it; below, they cannot. Computed ARIA state generally belongs below.

**Why are refs the hard case?**
An element takes one `ref`, and since React 19 `ref` is an ordinary prop, so it
merges by clobbering like anything else. You need an explicit merge function, and
it has a trap: returning a cleanup from the merged callback stops React calling
it with `null`, so any object ref you were resetting on that `null` call is now
never reset. The merge has to give every ref its own detach step.

**When would you not use one?**
When no props need merging, when there is a single consumer, or when the loss of
inspectability and TypeScript ergonomics costs more than the clobbering bug it
prevents.

---

← Prev: [Polymorphic components](polymorphic-components.md) · Index: [React patterns](../README.md) · Next → [05 · Provider composition](provider-composition.md)
