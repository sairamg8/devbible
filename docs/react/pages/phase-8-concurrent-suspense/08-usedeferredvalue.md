---
title: "useDeferredValue"
sidebar_label: "08 · useDeferredValue"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useDeferredValue`](https://react.dev/reference/react/useDeferredValue) (definition,
> parameters, returns, the full Caveats list, and *How is deferring a value different from
> debouncing and throttling?*) and
> [`useTransition`](https://react.dev/reference/react/useTransition).
> No sandbox script backs this page; claims are cited, not measured.

**`useDeferredValue` is what you reach for when the thing that changed is not yours to
mark. It is not a debounce and it has no delay — it renders the old value now and the new
one in an interruptible background render, which is a different mechanism with different
guarantees.**

## The API

> `useDeferredValue` is a React Hook that lets you **defer updating a part of the UI**.

```js
const deferredValue = useDeferredValue(value, initialValue?)
```

> `value`: The value you want to defer. It can have any type.
>
> **optional** `initialValue`: A value to use during the initial render of a component.
> **If this option is omitted, `useDeferredValue` will not defer during the initial
> render**, because there's no previous version of `value` that it can render instead.

And what comes back:

> During the initial render, the returned deferred value will be the `initialValue`, or
> the same as the value you provided. **During updates, React will first attempt a
> re-render with the old value** (so it will return the old value), **and then try another
> re-render in the background with the new value.**

So the shape of every update is **two renders**: one that keeps the old value, and a
background one that has the new value. The first commits immediately; the second commits
when it finishes.

**`initialValue` exists because the first render has no "old value" to fall back on.**
Without it, a component mounting with an expensive subtree renders that subtree
immediately — the deferral does nothing on mount. Supply `initialValue` (an empty string,
an empty list) and the first render can be cheap too.

## 🔴 It is not a debounce

The docs answer this directly, and the distinction is the reason to use it.

> *Debouncing* means you'd wait for the user to stop typing (e.g. for a second) before
> updating the list. *Throttling* means you'd update the list every once in a while (e.g.
> at most once a second).

> **Unlike debouncing or throttling, it doesn't require choosing any fixed delay.** If the
> user's device is fast (e.g. powerful laptop), the deferred re-render would happen almost
> immediately and wouldn't be noticeable. If the user's device is **slow**, the list would
> "lag behind" the input **proportionally to how slow the device is.**

> **There is no fixed delay caused by `useDeferredValue` itself.** As soon as React
> finishes the original re-render, React will **immediately start working on the background
> re-render** with the new deferred value.

That is the first advantage: **a debounce guesses; this measures.** 300 ms is too long on
a fast laptop and too short on a cheap phone, and you cannot pick a number that is right
for both.

The second is stronger:

> Also, unlike with debouncing or throttling, deferred re-renders done by
> `useDeferredValue` are **interruptible by default.** … if React is in the middle of
> re-rendering a large list, but the user makes another keystroke, React will **abandon
> that re-render**, handle the keystroke, and then start rendering in the background
> again. By contrast, **debouncing and throttling still produce a janky experience because
> they're *blocking*: they merely postpone the moment when rendering blocks the
> keystroke.**

Read that last sentence carefully, because it is the part people miss: **a debounce does
not stop the render from blocking — it only moves when the block happens.** When the timer
finally fires, the expensive render runs synchronously and the next keystroke waits for
it. Deferring never blocks, because the background render is abandoned and restarted.

The same caveat, from the reference:

> The background re-render is **interruptible**: if there's another update to the `value`,
> React will **restart the background re-render from scratch.** For example, if the user is
> typing into an input faster than a chart receiving its deferred value can re-render, the
> chart will only re-render **after the user stops typing.**

Note the emergent behaviour: the chart updates when typing stops — the *outcome* people
want from a debounce — without a timer, and without blocking in between.

**And what it does not do:**

> `useDeferredValue` **does not by itself prevent extra network requests.**

> If the work you're optimizing **doesn't happen during rendering**, debouncing and
> throttling are still useful. For example, they can let you fire **fewer network
> requests.** You can also use these techniques together.

So the two tools solve different problems and compose: **defer to keep rendering
responsive, debounce to send fewer requests.** A search box that both re-renders an
expensive list and hits an API wants both, and choosing one because it "replaces" the
other is the mistake.

## Suspense integration

> `useDeferredValue` is integrated with `<Suspense>`. **If the background update caused by
> a new value suspends the UI, the user will not see the fallback.** They will see the
> **old deferred value** until the data loads.

This is the same suppression transitions get
([topic 02 · 02](02-suspense/02-state-effects-and-resuspending.md)) — the content the user
is reading is not replaced by a skeleton. It is why `useDeferredValue` appears in the
docs' own stale-content pattern, and why the staleness indicator matters: without one, the
user sees results that quietly do not match their input.

```jsx
<div style={{ opacity: query !== deferredQuery ? 0.5 : 1 }}>
  <SearchResults query={deferredQuery} />
</div>
```

**`query !== deferredQuery` is the staleness flag** and needs no extra state — the hook
hands you both halves of the comparison.

## Two caveats that bite

**Object identity.**

> The values you pass to `useDeferredValue` should either be **primitive values** (like
> strings and numbers) **or objects created outside of rendering.** If you create a new
> object during rendering and immediately pass it to `useDeferredValue`, it will be
> **different on every render, causing unnecessary background re-renders.**

`useDeferredValue({ query, sort })` written inline is a new object every render, so React
sees a changed value every time and spawns a background render every time — the exact
opposite of the intent. Defer the primitives separately, or build the object outside
render. This is the same identity trap as
[Phase 7 · 08](../phase-7-custom-hooks/08-hooks-that-wrap-effects/README.md), and the
comparison is by `Object.is`.

**Inside a transition it does nothing.**

> When an update is inside a Transition, `useDeferredValue` **always returns the new
> `value` and does not spawn a deferred render**, since the update is already deferred.

Sensible and worth knowing: layering both does not double the effect, and a
`useDeferredValue` that "stopped working" may simply be inside a transition already.

**Effects wait for the commit.**

> The background re-render caused by `useDeferredValue` **does not fire Effects until it's
> committed to the screen.** If the background re-render suspends, its Effects will run
> after the data loads and the UI updates.

So an effect keyed on the deferred value fires once, when that render actually reaches the
screen — not for abandoned attempts. That is the behaviour you want, and it is worth
knowing explicitly, because it means you cannot use an effect to observe the background
render.

## Choosing between it and `useTransition`

The rule from [topic 01 · 02](01-usetransition/02-ispending-and-which-tool.md), restated
from this side:

> You can wrap an update into a Transition only if you have access to the `set` function
> of that state. If you want to start a Transition in response to some **prop or a custom
> Hook value**, try `useDeferredValue` instead.

| | `useTransition` | `useDeferredValue` |
|---|---|---|
| You need | The `set` function | Only the value |
| You mark | An **update** | A **value** to lag behind |
| Feedback | `isPending` | `value !== deferredValue` |
| Typical use | Navigation, tab switch, sort you own | A prop, a hook's return, a text input's value |

The text-input case is the one that forces the choice: transitions cannot control text
inputs, so the input's state stays urgent and you defer the value the expensive subtree
receives.

## Gotchas

**Symptom:** a deferred value spawns a background render on every render.
**Cause:** an object or array created during render was passed in; it differs by
`Object.is` every time.
**Fix:** defer primitives, or create the object outside rendering.

**Symptom:** deferring does nothing on the first render.
**Cause:** with no `initialValue` there is no previous value to render instead, so React
does not defer on mount.
**Fix:** pass `initialValue`.

**Symptom:** `useDeferredValue` appears to have no effect.
**Cause:** the update is already inside a transition, where it returns the new value and
spawns no deferred render.
**Fix:** expected — one mechanism is enough.

**Symptom:** the list is responsive but the API is still hit per keystroke.
**Cause:** deferring does not prevent extra network requests; it optimises rendering.
**Fix:** debounce the request as well. The two compose.

**Symptom:** results shown do not match what the user typed, with no indication.
**Cause:** deferred content is stale by design, and Suspense fallbacks are suppressed.
**Fix:** compare `value !== deferredValue` and dim or label the stale content.

**Symptom:** a debounce was replaced with `useDeferredValue` and typing still stutters.
**Cause:** the render cost is genuinely too high; deferring stops it blocking, not
existing.
**Fix:** memoize, virtualize, or render less. Deferring is a scheduling tool.

**Symptom:** an effect on the deferred value does not run for every intermediate value.
**Cause:** background re-renders do not fire effects until committed, and abandoned ones
never commit.
**Fix:** correct behaviour — you cannot observe the background render from an effect.

## Interview questions

**★ How is `useDeferredValue` different from debouncing?**
Two ways, both documented. It requires no fixed delay — on a fast device the deferred
re-render happens almost immediately, on a slow one the content lags proportionally, so it
adapts instead of guessing. And its background re-render is interruptible: a keystroke
abandons the in-progress render and restarts it. Debouncing and throttling are *blocking* —
they only postpone the moment the render blocks the keystroke, so the jank still arrives,
just later.

**★ When would you still use a debounce?**
When the work is not rendering. Deferring does not by itself prevent extra network
requests, so a search box that hits an API still wants a debounce on the request while
`useDeferredValue` keeps the list responsive. The docs say explicitly that you can use
both together.

**★ What does `initialValue` do and why is it needed?**
It supplies a value for the initial render. Without it, `useDeferredValue` does not defer
on mount at all, because there is no previous version of the value to render instead — so
a component mounting with an expensive subtree renders it immediately. Passing an empty
string or empty list makes the first render cheap too.

**★ Why must you not pass a freshly-created object?**
Because comparison is by `Object.is`, so an object built during render differs every
render and spawns an unnecessary background re-render every time — the opposite of the
intent. Pass primitives, or create the object outside rendering.

**How does it interact with Suspense?**
It suppresses the fallback. If the background update suspends, the user keeps seeing the
old deferred value rather than a skeleton — the same protection transitions give. That
makes a staleness indicator part of the implementation rather than a nicety, and
`value !== deferredValue` gives you one with no extra state.

**When do you choose it over `useTransition`?**
When you do not own the `set` function — the value arrives as a prop or from a hook you do
not control — or when the source is a controlled text input, which transitions cannot
control at all. `useTransition` marks an update you make; `useDeferredValue` lags behind a
value you receive.

---

← Prev: [Urgent vs transition updates](07-urgent-vs-transition.md) ·
Index: [Phase 8](README.md) ·
Next → [Async transitions](09-async-transitions.md)
