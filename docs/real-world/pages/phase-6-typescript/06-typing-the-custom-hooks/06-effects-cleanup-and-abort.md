---
title: "EffectCallback returns void or a Destructor and nothing else, and the uninhabitable brand in that declaration is the only reason an async effect callback is a compile error"
sidebar_label: "06 · Effects and cleanup, typed"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `type EffectCallback = () => void | Destructor;`,
> `type Destructor = () => void | { [UNDEFINED_VOID_ONLY]: never };`, the
> comment *"NOTE: callbacks are _only_ allowed to return either void, or a
> destructor."*, and `function useEffect(effect: EffectCallback, deps?:
> DependencyList): void;` — and the TypeScript handbook on
> [assignability of functions returning `void`](https://www.typescriptlang.org/docs/handbook/2/functions.html).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**`useEffect(async () => { … })` is a compile error, and the reason is a
declaration trick rather than a special case in the compiler.** TypeScript
normally lets a function returning *anything* satisfy a `() => void` contextual
type — the handbook says so plainly — so React's types could not simply declare
the effect as `() => void`. They declare it as a union with an uninhabitable
branded member, which switches that permissiveness off and makes "returns a
promise", "returns a boolean" and "returns a Map" all errors. Understanding
that one declaration is worth more than memorising the error message, because
it explains three other effect errors that look unrelated.
[06b](06b-abort-and-the-unknown-rejection.md) takes the other half of the
effect: the signal, and the rejection that arrives as `unknown`.

## The declarations, verbatim

```ts
type Destructor = () => void | { [UNDEFINED_VOID_ONLY]: never };

// NOTE: callbacks are _only_ allowed to return either void, or a destructor.
type EffectCallback = () => void | Destructor;

function useEffect(effect: EffectCallback, deps?: DependencyList): void;
```

`UNDEFINED_VOID_ONLY` is a unique symbol the React types keep to themselves, so
no value you can construct has that property: the branded member of the union
is **uninhabitable**. Its only job is to stop the return type from being
*exactly* `void`, and that matters because of this rule, verbatim from the
handbook:

> *"Contextual typing with a return type of `void` does not force functions to
> not return something. A contextual function type with a `void` return type
> can be implemented by functions that return any other value, but that return
> value will be ignored."*

The handbook explains why the language works that way — *"This behavior exists
to allow code like `src.forEach((el) => dst.push(el))` to be valid, since
`Array.prototype.push` returns a number but `forEach` expects a function with
return type `void`."* — and that permissiveness is exactly wrong for an effect,
where a returned value is not ignored: React *calls* it as a cleanup. So the
React types opt out by making the target return type a union rather than plain
`void`.

## What that buys, in three errors you will actually hit

```ts
// ✗ 1 — the async effect. Promise<void> is not void | Destructor.
useEffect(async () => {
  const cart = await api.get('/cart');
  setItems(cart.items);
}, []);

// ✗ 2 — the concise-body cleanup whose expression returns a value.
useEffect(() => {
  listeners.add(listener);
  return () => listeners.delete(listener);   // Set.delete returns boolean
}, []);

// ✗ 3 — the concise-body effect that returns something React would CALL.
useEffect(() => cache.set(key, value), [key, value]);   // Map.set returns the Map
```

All three are the same failure: a value that is neither `void` nor a
`Destructor` reaching a position React treats as a cleanup function. Error 3 is
the dangerous one — without the union, React would try to invoke a `Map` as a
cleanup at unmount.

The fixes are mechanical and all consist of adding braces or a name:

```ts
// ✓ 1 — an async function declared inside, called immediately
useEffect(() => {
  let active = true;
  (async () => {
    const cart = await api.get('/cart');
    if (active) setItems(cart.items);
  })();
  return () => { active = false; };
}, []);

// ✓ 2 and 3 — braces make the body a statement, so the arrow returns undefined
return () => { listeners.delete(listener); };
useEffect(() => { cache.set(key, value); }, [key, value]);
```

## The shape of `useAsync`'s effect

```ts
useEffect(() => {
  if (fn === null) { setState({status: 'idle'}); return; }

  const controller = new AbortController();
  let active = true;

  setState({status: 'loading'});
  fnRef.current?.(controller.signal).then(
    (data) => { if (active) setState({status: 'success', data}); },
    (error: unknown) => {
      if (!active || isAbortError(error)) return;
      setState({status: 'error', error: toApiFailure(error)});
    },
  );

  return () => { active = false; controller.abort(); };
}, [...deps, nonce]);
```

**`return;` on the idle path is a `void` return**, which satisfies
`EffectCallback` — an effect may return a cleanup on one path and nothing on
another, because `void` is one member of the union. The rejection handler's
`unknown` annotation and `isAbortError` are
[06b](06b-abort-and-the-unknown-rejection.md).

## Gotchas

**★ 🔴 `useEffect(async () => …)` does not compile, and `void`-returning
assignability is why the fix is not "declare it `() => void`".** An `async`
arrow returns `Promise<void>`, which is not assignable to
`void | Destructor` — the union is deliberately not plain `void`, because a
plain `void` target would accept it. Declare the async function inside and call
it, or extract it and call it; do not reach for a cast.

**★ A concise-body arrow cleanup fails whenever its expression returns a
value.** `() => listeners.delete(l)`, `() => map.delete(k)`,
`() => arr.push(x)`, `() => el.classList.toggle('x')` — all return something.
Braces fix every one: `() => { listeners.delete(l); }`. The error message names
`Destructor`, which sends people looking for a React problem when the problem
is an implicit return.

**★ `useEffect(() => doSomething(), [])` is a returned value React will call at
cleanup time.** If `doSomething()` returns a function — a debounce factory, a
subscription remover, an unsubscribe from a library — it becomes the cleanup by
accident and is invoked at unmount, sometimes correctly and sometimes
catastrophically. If it returns anything else the union rejects it. Braces make
the intent explicit either way.

**★ Cleanup runs before every re-run, not only at unmount.** The types say
nothing about when the `Destructor` is called; they only constrain its shape.
A cleanup that assumes "the component is going away" — clearing a global,
resetting a store, restoring `document.title` to a hard-coded value —
misbehaves on every dependency change. That is a React semantics question the
type system will never raise.

**★ `deps` is optional in the declaration — `deps?: DependencyList` — and
omitting it is legal and almost always wrong.** `useEffect(fn)` runs after
every render, including renders caused by the effect's own `setState`. There is
no type error, because omitting an optional parameter is exactly what optional
means. `[]` and *omitted* are three characters apart and behave nothing alike.

**★ `useLayoutEffect` and `useInsertionEffect` take the same `EffectCallback`,
so every rule here applies unchanged.** `function useLayoutEffect(effect:
EffectCallback, deps?: DependencyList): void;` is the identical signature. If
an async callback is rejected in one, it is rejected in all of them, and the
fix is the same.

**★ A cleanup that closes over state captures that render's state.** The
`Destructor` type constrains the shape and says nothing about the values inside
it. A cleanup that reads `items` sees the array from the render that created
the effect, which for a cleanup running at unmount is usually the wrong one.
Read from a ref if the cleanup needs current values —
[chunk 05](05-useref-and-its-three-overloads.md).

## Interview questions

**★ Why does `useEffect(async () => {})` fail to compile?**
Because the effect parameter is typed `EffectCallback = () => void |
Destructor`, and an async arrow returns `Promise<void>`, which is not
assignable to that union. The subtle part is why the union is needed at all:
TypeScript deliberately lets a function returning any value satisfy a `() =>
void` contextual type — the handbook's example is `src.forEach((el) =>
dst.push(el))` — so a plain `void` return type would have accepted the async
callback. React's types defeat that by making the return type a union whose
second member is a function type with an uninhabitable branded return, so the
"ignore the return value" shortcut does not apply.

**★ What is `{ [UNDEFINED_VOID_ONLY]: never }` doing in `Destructor`?**
Making the return type of the destructor a union rather than plain `void`, with
a member nobody can construct because the key is a symbol the React types do
not export. The effect is that a cleanup function must genuinely return nothing
— `() => listeners.delete(l)` returns a boolean and is rejected — while
`() => { listeners.delete(l); }` returns `undefined` and is accepted. Without
the brand, every value-returning arrow would slip through.

**★ An effect returns a cleanup on one path and nothing on another. Legal?**
Yes. `void` is one member of the union, so `return;` and falling off the end
both satisfy `EffectCallback`, and the other path may return a `Destructor`.
That is exactly what the idle path of `useAsync` does: `if (fn === null) {
setState({status:'idle'}); return; }` before the controller is created.

**★ What is the correct way to run an async operation in an effect?**
Define the async function inside the effect and call it, keeping the effect's
own callback synchronous so it can still return a cleanup. The cleanup is what
you lose by making the effect itself `async` — a promise is not a destructor —
and cancellation is precisely what an async effect needs most. In this app the
cleanup aborts the controller and flips an `active` flag, neither of which is
expressible if the callback returns a promise.

**★ Someone writes `useEffect(fn)` with no dependency array. Will the compiler
help?**
No. `deps` is declared optional, so omitting it is a legal call and there is no
diagnostic. The effect then runs after every render, and if it sets state it
re-renders and runs again. This is the one effect mistake with no type-level
signal at all — an empty array and a missing array differ by two characters and
by an infinite loop.

---

← Prev: [`useRef` and its three overloads](05-useref-and-its-three-overloads.md) ·
[Overview](README.md) ·
Next → [Abort, and the rejection that arrives as `unknown`](06b-abort-and-the-unknown-rejection.md)
