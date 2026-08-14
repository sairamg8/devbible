---
title: "Tearing"
sidebar_label: "15 · Tearing"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [React v18.0 release post](https://react.dev/blog/2022/03/29/react-v18) (the
> interruptibility and consistency statements),
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
> (definition, parameters, the immutability requirement and `subscribe` stability), and
> [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure).
> The step-by-step tearing walkthrough is **reasoning from those documented semantics**,
> not a quoted passage, and is labelled as such.
> No sandbox script backs this page; claims are cited, not measured.

**Tearing is one commit showing two different values for the same piece of data. It became
possible the moment renders became interruptible, it is invisible in development, and
`useSyncExternalStore` exists specifically to prevent it.**

## The gap in the guarantee

React's promise, from [topic 06](06-what-concurrent-rendering-means.md):

> React **guarantees that the UI will appear consistent even if a render is interrupted.**
> To do this, it **waits to perform DOM mutations until the end**, once the entire tree has
> been evaluated.

That covers React's own output. It cannot cover what your components *read* from outside
themselves, because React neither owns those values nor knows when they change. The
permission that opens the gap:

> **React may start rendering an update, pause in the middle, then continue later.**

Put the two together and the hole is obvious: if a render pauses, and a value outside React
changes during the pause, the components rendered before the pause saw the old value and
the ones after it see the new one. React then commits both — faithfully, and inconsistently.

## The walkthrough

⚠️ **Reasoning from the documented semantics above**, not a quoted example.

```jsx
// A module-level mutable value, read directly during render
let quantity = 1;

function Header()  { return <span>Items: {quantity}</span>; }
function Total()   { return <span>Total: {quantity * 9.99}</span>; }
```

1. React begins rendering a low-priority update. It renders `Header`, which reads
   `quantity` as **1**.
2. The user clicks "add", an urgent update arrives, and React **pauses** the low-priority
   render to handle it. `quantity` becomes **2**.
3. React resumes the interrupted render. It renders `Total`, which reads `quantity` as
   **2**.
4. React commits. The screen says **"Items: 1"** and **"Total: 19.98"**.

Nothing threw. Nothing is `undefined`. The commit is atomic and, by React's definition,
consistent — it committed exactly what the components returned. The *data* is what tore.

**Why it is hard to catch:** step 2 requires the interruption to land between two specific
components. That depends on how much work was queued, how fast the machine is, and what the
user did — so it may never happen on a developer's laptop and happen regularly on a phone
under load. It also cannot be reproduced on demand, which is why "we've never seen it" is
not evidence.

## What can tear

Anything read during render that React does not own:

| Source | Tears? |
|---|---|
| A module-level `let` or mutable object | ✅ Yes — the classic case |
| A store from an external library read directly | ✅ Yes, unless it uses `useSyncExternalStore` |
| The DOM (`offsetWidth`, `scrollTop`) read in render | ✅ Yes — and it is a purity violation anyway |
| `ref.current` read in render | ✅ Yes — and also a documented Pitfall |
| Props, state, context | 🔴 No — React owns them and keeps them consistent per render |
| A value read via `useSyncExternalStore` | 🔴 No — that is the guarantee |

The pattern: **React can only keep consistent what it hands you.** Props, state and context
are per-render values React controls. Everything else is a live reading of the outside
world, taken at whatever moment that component happened to render.

## The fix, and why it is the only one

> `useSyncExternalStore` is a React Hook that lets you **subscribe to an external store**.

```js
const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)
```

The hook does not merely subscribe — it lets React **take a snapshot and detect that the
store changed mid-render**, so it can restart rather than commit a torn result. That is
something userland cannot implement, which is precisely why it is a built-in rather than a
pattern.

The requirements from
[Phase 7 · 03 · 04](../phase-7-custom-hooks/03-share-logic-not-state/04-external-stores.md)
are what make the detection work:

> The store snapshot returned by `getSnapshot` **must be immutable.** If the underlying
> store has mutable data, **return a new immutable snapshot if the data has changed.
> Otherwise, return a cached last snapshot.**

Identity *is* the change signal. A snapshot that mutates in place is indistinguishable from
one that did not change, so React cannot tell the store moved — and the torn read is back.

> If a **different `subscribe` function is passed** during a re-render, React will
> **re-subscribe** … You can prevent this by declaring `subscribe` outside the component.

**The attempted fixes that do not work**, and why:

- **`useState` plus an effect that subscribes.** The initial read happens during render and
  the subscription after commit; between them, changes are missed, and the render itself
  still reads a live value. It narrows the window without closing it.
- **`useRef` to hold the value.** Refs do not re-render, and reading one during render is a
  documented Pitfall
  ([Phase 7 · 04 · 04](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/04-refs-and-the-dom-in-render.md)).
- **Reading it once at the top of the component.** Consistent within *that* component, and
  the next component still reads it separately. Tearing is between components.
- **`useMemo`.** A memo React may discard is not a barrier to anything.

## The connection to purity

Tearing is what the "no reading non-local mutable values in render" half of the purity
rules is protecting you from, expressed at runtime. A component that reads a module
variable during render is not idempotent — the same props, state and context can produce
different output — and
[Phase 7 · 04 · 01](../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/01-purity-and-idempotence.md)
already forbids it.

So the honest framing: **tearing is not a separate hazard you must additionally defend
against. It is the consequence of a rule you were already given**, and
`useSyncExternalStore` is the supported way to read outside state *while* obeying it.

## Gotchas

**Symptom:** two parts of the screen disagree about the same value, intermittently.
**Cause:** both read a mutable value outside React during render, and the render was
interrupted between them.
**Fix:** `useSyncExternalStore`. Nothing else closes the gap.

**Symptom:** it cannot be reproduced, and only appears on slow devices or under load.
**Cause:** it requires an interruption to land between two specific components.
**Fix:** treat irreproducibility as characteristic of this bug, not as evidence against it.

**Symptom:** a store was moved to `useState` plus a subscribing effect and it still
disagrees.
**Cause:** the render still reads a live value, and changes between render and commit are
missed.
**Fix:** the window was narrowed, not closed. Use the hook built for it.

**Symptom:** `useSyncExternalStore` is adopted and components stop updating.
**Cause:** `getSnapshot` mutates in place, so the reference never changes and React sees no
update.
**Fix:** replace rather than mutate — identity is the change signal.

**Symptom:** "The result of getSnapshot should be cached to avoid an infinite loop."
**Cause:** `getSnapshot` builds a new object every call.
**Fix:** return the stored reference; derive in the component.

**Symptom:** a third-party store integrates cleanly and never tears.
**Cause:** it uses `useSyncExternalStore` internally.
**Fix:** nothing — check for it when evaluating libraries; it is the mark of one built for
concurrent React.

## Interview questions

**★ What is tearing?**
One commit displaying two different values for the same piece of data. It happens when
components read a mutable value from outside React during render and the render is
interrupted between two of them — the first saw the old value, the second sees the new one,
and React commits both. Nothing throws, nothing is undefined, and the commit is atomic; it
is the data that tore.

**★ React guarantees UI consistency. Why doesn't that prevent it?**
Because the guarantee covers React's own output — it defers DOM mutations until the whole
tree is evaluated, so you never see a half-updated screen. It cannot cover values your
components read from outside themselves, because React neither owns them nor knows when
they change. The commit is faithfully consistent with what the components returned; the
components returned inconsistent things.

**★ Why is `useSyncExternalStore` the only correct fix?**
Because it lets React take a snapshot and detect that the store changed mid-render, so it
can restart instead of committing a torn result — which userland cannot implement, and is
why it is a built-in rather than a pattern. `useState` plus a subscribing effect narrows
the window without closing it, since the render still reads a live value; a ref does not
re-render and reading one in render is a documented Pitfall; and reading once per component
does nothing, because tearing happens *between* components.

**★ What makes the detection work, and how do people break it?**
Immutable snapshots. `getSnapshot` must return a new reference when the data changes and
the same cached one when it has not, because identity is the change signal. Mutating the
snapshot in place makes a changed store indistinguishable from an unchanged one, so nothing
re-renders; building a new object every call makes every call look like a change, which is
an infinite loop React reports explicitly.

**Why is tearing so hard to catch in development?**
It needs an interruption to land between two specific components, which depends on how much
work was queued, how fast the machine is, and what the user was doing. That combination may
never occur on a developer's laptop and occur regularly on a phone under load — so it does
not reproduce on demand, and "we have never seen it" is not evidence that it cannot happen.

**Is tearing a separate rule to learn?**
No. It is the runtime consequence of a rule already given: components must not read
non-local mutable values during render, because that makes them non-idempotent.
`useSyncExternalStore` is the supported way to read outside state while still obeying that
rule.

---

← Prev: [`<Activity>`](14-activity.md) ·
Index: [Phase 8](README.md) ·
Next → [Error boundaries and Suspense together](16-error-boundaries-and-suspense.md)
