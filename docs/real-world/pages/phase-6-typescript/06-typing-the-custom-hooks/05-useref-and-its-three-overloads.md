---
title: "useRef has three overloads, no zero-argument form in React 19's types, and a ref type that omits null is a lie the moment the component unmounts"
sidebar_label: "05 · useRef and its three overloads"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — the three `useRef` overloads with their `// convenience overload`
> comments, `interface RefObject<T> { current: T; }`,
> `/** @deprecated Use `RefObject` instead. */ interface MutableRefObject<T>`,
> `type Ref<T> = RefCallback<T> | RefObject<T | null> | null;` and the
> `RefAttributes.ref` doc comment — the React reference for
> [`useRef`](https://react.dev/reference/react/useRef); and the timer
> declarations `declare function setTimeout(handler: TimerHandler, timeout?:
> number, ...): number;` in `lib.dom.d.ts` (`typescript@6.0.3`) against
> `function setTimeout<TArgs extends any[]>(…): NodeJS.Timeout;` in this repo's
> `@types/node/web-globals/timers.d.ts`.
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**, Node
> **24.20.0**. Documentation-validated; **no console blocks, no timings**.

**Three of this app's hooks hold a ref, and every one of them is a different
overload.** `useRef` is the hook where the declaration genuinely decides what
your code looks like: which overload a call resolves to determines whether
`.current` includes `null`, whether it includes `undefined`, and whether the
zero-argument call you have written a hundred times still compiles. In
`@types/react` 19.2.18 it does not.

## The declarations, verbatim — comments included

```ts
function useRef<T>(initialValue: T): RefObject<T>;
// convenience overload for refs given as a ref prop as they typically start with a null value
function useRef<T>(initialValue: T | null): RefObject<T | null>;
// convenience overload for undefined initialValue
function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;

interface RefObject<T> {
    /** The current value of the ref. */
    current: T;
}
```

🔴 **There is no `useRef()` overload.** React 18's types had one; 19.2.18 does
not, so the argument is mandatory and the migration edit is mechanical:

```ts
const timer = useRef<number>();                    // ✗ no longer compiles
const timer = useRef<number | undefined>(undefined); // ✓ overload 1
const timer = useRef<number>(undefined);             // ✓ overload 3, same result
```

📌 **`RefObject<T>` has a plainly mutable `current: T`**, and
`MutableRefObject<T>` survives only as a deprecated alias — verbatim,
`/** @deprecated Use `RefObject` instead. */`. That deprecation is the residue
of an older arrangement in which the overloads produced two *different*
interfaces, one of them with a read-only `current`; under 19.2.18 they produce
one interface and the read-only variant is gone. If a tutorial tells you
`useRef<T>(null)` gives you something you cannot assign to, it is describing
types this repo does not have.

## Which overload does your call hit?

| Call | Overload | `.current` is |
|---|---|---|
| `useRef<HTMLInputElement>(null)` | 2 — `T` is `HTMLInputElement`, `null` matches `T \| null` | `HTMLInputElement \| null` |
| `useRef<HTMLInputElement \| null>(null)` | 1 — `T` is the whole union | `HTMLInputElement \| null` |
| `useRef(0)` | 1 — `T` inferred `number` | `number` — and `.current = undefined` will not compile |
| `useRef<number>(undefined)` | 3 | `number \| undefined` |
| `useRef<Fetcher<T> \| null>(fn)` | 1 | `Fetcher<T> \| null` |
| `useRef(null)` | 1, `T` inferred as `null` | `null` — and nothing else can ever be assigned |

⚠️ **The first two rows produce the same type in 19.2.18**, which is the part
most often mis-remembered. Where the type argument genuinely changes the answer
is rows 3 and 6: **the initial value's type becomes the ref's type**, so a ref
initialised with a real value cannot later hold `null` or `undefined`, and
`useRef(null)` with no type argument is a ref that can hold nothing at all.

**The rule that survives all six rows: the type argument describes every value
that will ever be in `.current`, not the one it starts with.**

## The DOM ref, and the null that is not optional

```tsx
// apps/web/src/components/SearchBox.tsx
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => { inputRef.current?.focus(); }, []);
return <input ref={inputRef} type="search" … />;
```

The `null` is not defensive programming, it is the contract. From
`RefAttributes` in `@types/react`, verbatim:

> *"Once the component unmounts, React will set `ref.current` to `null` (or
> call the ref with `null` if you passed a callback ref)."*

…and the prop's type is built for it:

```ts
type Ref<T> = RefCallback<T> | RefObject<T | null> | null;
```

So a ref whose declared type excludes `null` still *type-checks* as a `ref`
prop — property types are compared covariantly, so `RefObject<HTMLInputElement>`
is assignable to `RefObject<HTMLInputElement | null>` — and then React writes
`null` into it on unmount. **The type is not wrong at the assignment; it is
wrong afterwards**, and every `.current.focus()` in the file is now an
unguarded access to a value the runtime may have nulled. Include the `null`.

## The app's four refs

```ts
// 1. the latest fetcher, so the effect can depend on data and not on identity
const fnRef = useRef<Fetcher<T> | null>(fn);

// 2. the last confirmed server truth, for the cart's rollback
const serverItems = useRef<CartItem[]>([]);

// 3. the DOM node, for focus management
const inputRef = useRef<HTMLInputElement>(null);

// 4. a timer id — see below, this one is a trap
const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
```

🔴 **Never write `useRef<number>(undefined)` for a timer id.** The type of a
timer handle depends on which lib is in scope, and this repo has both:

```ts
// lib.dom.d.ts
declare function setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;

// @types/node/web-globals/timers.d.ts
function setTimeout<TArgs extends any[]>(
    callback: (...args: TArgs) => void,
    delay?: number,
    ...args: MakeVoidParameterOptional<TArgs>
): NodeJS.Timeout;
```

A browser app whose `tsconfig` pulls in `@types/node` — which happens the
moment a build script or a test runner needs it — resolves `setTimeout` to the
Node declaration, and `useRef<number>` stops compiling with an error about
`Timeout` not being assignable to `number`. `ReturnType<typeof setTimeout>` is
correct under either lib and needs no edit when the `tsconfig` changes.
[Chapter 08·01](../08-utility-types-in-app-code/01-derive-never-redeclare.md)
is the general form of that move.

## Gotchas

**★ 🔴 `useRef()` with no argument does not compile against `@types/react`
19.2.18.** There is no zero-argument overload. The fix is
`useRef<T | undefined>(undefined)` — explicit, and it makes the `undefined` in
`.current` visible at the declaration instead of hidden in a default type
parameter.

**★ `useRef(null)` without a type argument gives `RefObject<null>`.** `T` is
inferred as the type of `null`, so `.current` is `null` and every later
assignment fails with a message about the assigned type not being assignable to
`null`. Always supply the element type: `useRef<HTMLInputElement>(null)`.

**★ A ref type that omits `null` type-checks as a `ref` prop and then lies.**
`ref` accepts `RefObject<T | null>` and property assignability is covariant, so
`RefObject<HTMLInputElement>` passes — and React sets `.current` to `null` on
unmount regardless of what the type says. Nothing errors; a `.current.focus()`
in a cleanup function throws. The React types' own doc comment states the
unmount behaviour, so this is documented, not surprising.

**★ `.current?.focus()` and `.current!.focus()` are not the same risk.** The
optional chain is correct in an effect that may run after a conditional render
removed the node; the non-null assertion is a claim that React has not nulled
the ref, which you cannot know in a cleanup function. If `!` appears on a DOM
ref, the question to ask is "which lifecycle phase is this line in?".

**★ Timer ids are `number` in the DOM lib and `NodeJS.Timeout` under
`@types/node`, and adding a build dependency can flip which one you get.**
`ReturnType<typeof setTimeout>` is the portable spelling. The same applies to
`setInterval`. Do not "fix" the error with `as unknown as number` — the value
is a `Timeout` object at run time in Node and a number in the browser, and
`clearTimeout` accepts whichever it produced.

**★ Writing `fnRef.current = fn` in the render body is a documented React
violation and no type will flag it.** The `useRef` reference is explicit:

> *"Do not write _or read_ `ref.current` during rendering, except for
> initialization. This makes your component's behavior unpredictable."* …
> *"You can read or write refs **from event handlers or effects instead**."*

Phase 4's `useAsync` does exactly this, deliberately, because the alternative
in React 18 was worse. In React 19.2 the sanctioned replacement exists —
`useEffectEvent` ([chunk 02b](02b-the-dependency-array-the-compiler-cannot-check.md))
— and the honest position is that `fnRef.current = fn` is a known deviation
with a known replacement, not a pattern to spread.

**★ Refs do not trigger renders and the type cannot tell you that.**
`RefObject<CartItem[]>` and `useState<CartItem[]>` have indistinguishable value
types; the difference is that mutating `serverItems.current` updates nothing on
screen. From the React caveats: *"When you change the `ref.current` property,
React does not re-render your component."* Choosing a ref for something the UI
renders is a bug the compiler cannot see, and it presents as "the state is
right in the console and wrong on the page".

**★ `ref.current` in a dependency array is read during render and never
tracked.** `useEffect(fn, [inputRef.current])` reads the ref while rendering —
the violation above — and captures whatever it was at that moment; the effect
does not re-run when the node changes. If you need to act when a node attaches,
use a **callback ref**: `type RefCallback<T>` takes `instance: T | null` and
React calls it with the node and again with `null`, which is the API designed
for the question.

**★ Strict Mode creates each ref object twice in development.** From the
caveats: *"Each ref object will be created twice, but one of the versions will
be discarded."* Code that treats the ref object's identity as meaningful — a
`WeakMap` keyed by it, say — will misbehave in development only, and no type
distinguishes the surviving object from the discarded one.

**★ A ref holding a mutable object invites mutation of something that is
rendered.** The caveat is explicit: *"if it holds an object that is used for
rendering (for example, a piece of your state), then you shouldn't mutate that
object."* `serverItems.current` is safe because it holds the *last confirmed*
array and the render reads `state.items`; the moment someone assigns
`serverItems.current = state.items` those become the same array, and a later
`serverItems.current.push(…)` mutates rendered state. Declaring the ref
`useRef<readonly CartItem[]>([])` makes that push a compile error.

## Interview questions

**★ What are `useRef`'s three overloads and how does a call pick one?**
`useRef<T>(initialValue: T): RefObject<T>` for a value that is always present;
`useRef<T>(initialValue: T | null): RefObject<T | null>` — the React types call
it a *"convenience overload for refs given as a ref prop as they typically
start with a null value"*; and `useRef<T>(initialValue: T | undefined):
RefObject<T | undefined>` for the deferred-value case. Resolution is ordinary
overload resolution on the argument: `useRef<HTMLInputElement>(null)` skips the
first because `null` is not an `HTMLInputElement` and lands on the second.

**★ How do `useRef<T>(null)` and `useRef<T | null>(null)` differ?**
Under `@types/react` 19.2.18 they do not — both give `RefObject<T | null>`,
one via the second overload and one via the first. Historically they produced
different interfaces, one with a read-only `current`, which is why
`MutableRefObject<T>` still exists in the file marked
`@deprecated Use RefObject instead`. What *does* still differ is the case where
the initial value is a real value: `useRef(0)` gives `RefObject<number>`, and
`.current = undefined` on it is an error.

**★ Why does a DOM ref's type have to include `null`?**
Because React writes `null` into it when the component unmounts — the React
types say so in the `ref` prop's doc comment, and `Ref<T>` is declared to
accept `RefObject<T | null>` for that reason. A ref declared without the
`null` still type-checks as a `ref` prop, since property assignability is
covariant, so the compiler will not stop you; it simply means every
`.current.focus()` in the file is unguarded against a value React itself
assigns.

**★ Why is `useRef<number>(undefined)` the wrong type for a timer id?**
Because the type of a timer handle depends on which library declarations are in
scope. `lib.dom.d.ts` declares `setTimeout` returning `number`;
`@types/node`'s global declares it returning `NodeJS.Timeout`. A browser
project that adds `@types/node` for its build tooling gets the Node
declaration and the `number` annotation stops compiling.
`ReturnType<typeof setTimeout>` derives the type from whichever declaration is
actually in scope and never needs editing.

**★ `fnRef.current = fn` runs in the render body. What is wrong with it and
what replaces it?**
React's own documentation says not to write or read `ref.current` during
rendering except for initialisation, because the component body is expected to
be pure and this makes its behaviour unpredictable. Nothing in the types
objects. The phase-4 hook does it deliberately to keep the effect's dependency
array free of the fetcher's identity; the modern replacement is
`useEffectEvent`, which gives a stable function that always sees the latest
render's values and is excluded from dependency arrays.

**★ How would you re-run logic when a DOM node attaches, given a ref in a
dependency array does not work?**
With a callback ref. `RefCallback<T>` takes `instance: T | null`, and React
calls it with the node when it attaches and with `null` when it detaches, so
the callback *is* the notification. Putting `ref.current` in a dependency array
does two wrong things at once: it reads the ref during render, which the
documentation forbids, and it captures a value that changes without the effect
being re-run.

---

← Prev: [Wiring the reducer, and dispatch through context](04b-wiring-the-reducer-and-dispatch.md) ·
[Overview](README.md) ·
Next → [Effects, cleanup and abort](06-effects-cleanup-and-abort.md)
