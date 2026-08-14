---
title: "Two callers, two states"
sidebar_label: "01 · Two callers, two states"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> (the section *"Custom Hooks let you share stateful logic, not state itself"*, the
> `useFormInput` example, and the Recap).
> No sandbox script backs this page; claims are cited, not measured.

**Calling the same custom hook from two components does not connect them. Each call
gets its own state, its own effects, its own everything. The hook shares the *code*
that manages state — never the state.**

One sentence from the docs is the entire topic:

> **Custom Hooks let you share *stateful logic* but not *state itself.* Each call to
> a Hook is completely independent from every other call to the same Hook.**

Everything in this topic is that sentence with its consequences worked out, because
the sentence is easy to nod at and hard to actually believe — the first example most
people meet looks like a counterexample.

## The example that teaches it wrong

`useOnlineStatus` from [Phase 7 · 02](../02-writing-a-custom-hook.md) is the standard
introduction, and it is genuinely misleading:

```jsx
function StatusBar() {
  const isOnline = useOnlineStatus();
  // ...
}

function SaveButton() {
  const isOnline = useOnlineStatus();
  // ...
}
```

Turn the network off and **both** components update, together, immediately. Every
instinct says one value is being shared. The docs stop and correct this directly:

> In the earlier example, when you turned the network on and off, both components
> updated together. However, **it's wrong to think that a single `isOnline` state
> variable is shared between them.**

Expand the hook back into its two call sites and the illusion has nowhere to hide:

```jsx
function StatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => { /* subscribe to online/offline */ }, []);
  // ...
}

function SaveButton() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => { /* subscribe to online/offline */ }, []);
  // ...
}
```

> These are **two completely independent state variables and Effects!** They happened
> to have the same value at the same time because you synchronized them with the same
> external value (whether the network is on).

That is the load-bearing phrase: *they happened to have the same value*. Two
independent states, two independent subscriptions, one shared **source outside
React**. The agreement is a property of `window`, not of the hook. Delete the
`window` subscription and the two values have nothing left holding them together.

## The example that teaches it right

The docs switch examples for exactly this reason, and the second one is unambiguous
because both calls live in **one** component:

```jsx
export function useFormInput(initialValue) {
  const [value, setValue] = useState(initialValue);

  function handleChange(e) {
    setValue(e.target.value);
  }

  const inputProps = {
    value: value,
    onChange: handleChange
  };

  return inputProps;
}
```

> Notice that it only declares *one* state variable called `value`.

And then:

```jsx
function Form() {
  const firstNameProps = useFormInput('Mary');
  const lastNameProps = useFormInput('Poppins');
  // ...
}
```

> This is why it works like declaring **two separate state variables**!

Type in the first-name field and the last name does not move. Nobody expects it to —
and that is the point. The hook body declares one `useState`; the *component* has two,
because it made two calls. Nothing about the second call knows the first exists.

**If you accept that within one component, you have already accepted it across
components.** There is no extra rule for the cross-component case; it is the same
mechanism seen from further away.

## Why: a hook call is a call, not a subscription

The mechanical answer belongs to [Phase 7 · 05](../05-why-the-rules-exist/README.md), but
the short version is what makes the behaviour obvious rather than memorised.

React stores hook state **positionally, on the component instance** — not on the
function you called. `useState` does not identify itself by name, by hook, or by
module; it takes the next slot in the list belonging to the fiber React is currently
rendering. So:

- Two components rendering ⇒ two fibers ⇒ two independent lists of slots.
- Two calls inside one component ⇒ one list, two different positions in it.
- The custom hook function is **inlined** into the caller's slot list. It has no
  storage of its own to share.

There is nowhere for shared state to live. A module-level function has no per-caller
memory, and React deliberately did not give hooks a registry that would let one call
find another. Which leads to a recap point people read past:

> **All Hooks re-run every time your component re-renders.**

A custom hook is not an object that is constructed once and then kept. It is a
function body re-executed top to bottom on every render of every component that calls
it. Nothing persists inside it between renders except what React's built-in hooks put
in the component's slots.

## Where the illusion holds and where it breaks

Whether two callers *appear* to agree depends entirely on what the hook synchronizes
with — never on the fact that it is one hook.

| What the hook does inside | Do two callers agree? | Why |
|---|---|---|
| Subscribes to a browser/global source (`online`, `matchMedia`, `resize`) | ✅ Always, coincidentally | One source outside React pushes to both subscriptions |
| Reads context with `useContext` | ✅ Always | The state lives in the provider, not in the hook |
| `useSyncExternalStore` over a shared store | ✅ Always | Same store object, and React guarantees no tearing |
| `useState(0)` — a counter, a toggle, a form field | 🔴 Never | Two independent slots; one `setState` re-renders one component |
| `useState` seeded from `localStorage`, plus a write | ⚠️ At first, then they diverge | Same initial read, two independent states afterwards |
| `useRef` for a mutable box | 🔴 Never | Same as state: one ref object per call |
| `useReducer` over a local reducer | 🔴 Never | The reducer is shared code; the store it feeds is per-call |

Rows 1–3 are the *only* ways two callers ever agree, and in all three the state lives
somewhere other than the hook. Rows 4–7 never agree. Row 5 is where the real bugs
live, because it *works in the demo* —
[chunk 02](02-the-localstorage-trap.md) takes it apart.

## Gotchas

**Symptom:** two components using the same hook show different values, and the bug
report says "state is not syncing".
**Cause:** the correct behaviour. Each call to a hook is completely independent.
**Fix:** decide where the state should live and put it there — lift it, provide it,
or move it to an external store. See
[chunk 03](03-when-you-wanted-shared-state.md).

**Symptom:** `useOnlineStatus` (or `useMediaQuery`) stays in sync everywhere, so the
team concludes hooks share state and the next hook is built on that assumption.
**Cause:** an external source pushing to every independent subscription.
**Fix:** the agreement is a property of `window`, not of the hook. Test the
assumption with a hook that owns plain `useState` — it will disagree immediately.

**Symptom:** a hook that "loses its state" when the component calling it unmounts.
**Cause:** the state lives on the component instance, so it dies with it.
**Fix:** expected. If the state must outlive the component, it must live above it —
in a parent, a provider, or a store.

**Symptom:** a hook is called twice in one component and the second call overwrites
the first.
**Cause:** almost always a real bug elsewhere — two calls cannot share a slot. Look
for state that was hoisted to a module, or a hook called inside a condition
([Phase 7 · 01](../01-the-rules-of-hooks.md)) so the slots shifted.
**Fix:** confirm the hook body owns only `useState`/`useRef`, then check rule 1.

**Symptom:** a custom hook is refactored into a class-like object (`const store =
useMemo(() => new Store(), [])`) so it can be "shared".
**Cause:** `useMemo` looks like a cache across components. It is per-component, same
as everything else, and [is not a guarantee](../../phase-6-performance/03-usememo.md).
**Fix:** a store that must be shared is created **outside** React and read with
`useSyncExternalStore`.

## Interview questions

**★ Two components call the same custom hook. Do they share state?**
No. Custom hooks share stateful *logic*, not state itself — every call to a hook is
completely independent of every other call. The hook body is inlined into each
caller's own list of hook slots on its own fiber, so `useState` inside it allocates
one slot per call site. There is no registry that would let two calls find each other.

**★ Then why do both components see the same value from `useOnlineStatus`?**
Because both maintain their own state and their own effect, and both subscribe to the
same external value — the browser's online/offline events. They happen to hold equal
values at the same time; nothing is shared. Replace the subscription with a plain
`useState` counter and the two immediately diverge.

**★ What is the clearest demonstration that no state is shared?**
Call one hook twice in a single component: `useFormInput('Mary')` and
`useFormInput('Poppins')`. The hook declares exactly one `useState`, yet the form has
two independent fields — because two calls means two slots. Once you accept it inside
one component, the cross-component case needs no extra rule.

**Does the hook itself hold anything between renders?**
No. Every hook re-runs on every render of the component that calls it; the function
body is re-executed top to bottom. Persistence lives in the component's hook slots,
which React owns — not in the custom hook's closure, which is rebuilt each time.

**If a hook needs to survive its component unmounting, what does that tell you?**
That the state is in the wrong place. Hook state lives on the component instance and
is discarded with it. State that must outlive a component belongs above it — a parent,
a context provider, or an external store read with `useSyncExternalStore`.

---

← Index: [Share logic, not state](README.md) ·
Prev: [Writing a custom hook](../02-writing-a-custom-hook.md) ·
Next → [The `useLocalStorage` trap](02-the-localstorage-trap.md)
