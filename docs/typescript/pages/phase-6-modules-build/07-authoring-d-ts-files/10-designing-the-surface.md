---
title: "Designing the surface — the Do's and Don'ts"
sidebar_label: "10 · Designing the surface"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Declaration Files →
> Do's and Don'ts*. Every ❌/✅ pair and every *"Why"* sentence below is quoted
> from that page. **No sandbox, no console blocks.**

Everything so far has been about making a declaration file *valid*. This chunk
and the next are about making it *good* — the handbook has a dedicated page of
rules for it, written from years of reviewing DefinitelyTyped submissions. Here:
general types and callbacks. Next: overloads and naming.

They apply to declarations you generate as much as to ones you write, because a
generated `.d.ts` is a projection of your source: the mistakes below are made in
the `.ts` file and merely *appear* in the `.d.ts`.

## General types

### ❌ Never use `Number`, `String`, `Boolean`, `Symbol` or `Object`

> **❌ Don't** ever use the types `Number`, `String`, `Boolean`, `Symbol`, or
> `Object`. These types refer to non-primitive boxed objects that are almost
> never used appropriately in JavaScript code.

```ts
/* WRONG */
function reverse(s: String): String;

/* OK */
function reverse(s: string): string;
```

> **✅ Do** use the types `number`, `string`, `boolean`, and `symbol`.

And instead of `Object`, the handbook says use *"the non-primitive `object`
type"*. The capitalised forms are the boxed wrappers; `new String("x") !== "x"`,
and a parameter typed `String` accepts the wrapper object nobody passes.

⚠️ **This is the single most common mistake in hand-written declaration files**,
because the capitalised names are what an editor autocompletes first.

### ❌ A generic that does not use its type parameter

> **❌ Don't** ever have a generic type which doesn't use its type parameter.

```ts
/* WRONG */
declare function parse<T>(json: string): T;
```

That signature is `any` wearing a costume: `T` is not inferred from anything, so
the caller picks it, and the function returns whatever they asked for with no
check at all. The honest signature returns `unknown` and makes the caller narrow.

### ❌ `any`

> **❌ Don't** use `any` as a type unless you are in the process of migrating a
> JavaScript project to TypeScript. The compiler *effectively* treats `any` as
> "please turn off type checking for this thing". In cases where you don't know
> what type you want to accept, you can use `unknown`.

In a declaration file this matters more than anywhere else, because a single
`any` in a published signature turns off checking in *every consumer's* codebase,
not just yours.

## Callback types

### ✅ `void`, not `any`, for a return value you ignore

> **❌ Don't** use the return type `any` for callbacks whose value will be
> ignored […] **✅ Do** use the return type `void` for callbacks whose value will
> be ignored.

```ts
/* WRONG */
function fn(x: () => any) { x(); }

/* OK */
function fn(x: () => void) { x(); }
```

> **Why:** Using `void` is safer because it prevents you from accidentally using
> the return value of `x` in an unchecked way.

📌 **`void` here is a promise you make to the caller, not a restriction on them.**
A callback returning `number` is still assignable to `() => void` — that is
deliberate — so you lose nothing by declaring it, and you gain the compiler
stopping *you* from reading a value you said you would ignore.

### ✅ Callback parameters are not optional

> **❌ Don't** use optional parameters in callbacks unless you really mean it.

```ts
/* WRONG */
interface Fetcher {
  getObject(done: (data: unknown, elapsedTime?: number) => void): void;
}

/* OK */
interface Fetcher {
  getObject(done: (data: unknown, elapsedTime: number) => void): void;
}
```

The `?` says *"sometimes I will not pass this"*, which forces every caller to
handle `undefined`. If you always pass it, say so. **It is always legal for a
callback to ignore a parameter**, so a non-optional declaration costs the caller
nothing.

### ✅ One overload at maximum arity

> **❌ Don't** write separate overloads that differ only on callback arity […]
> **✅ Do** write a single overload using the maximum arity.

```ts
/* WRONG */
declare function beforeAll(action: () => void, timeout?: number): void;
declare function beforeAll(action: (done: DoneFn) => void, timeout?: number): void;

/* OK */
declare function beforeAll(action: (done: DoneFn) => void, timeout?: number): void;
```

> **Why:** It's always legal for a callback to disregard a parameter, so there's
> no need for the shorter overload.

## Still to come

The handbook's rules about **function overloads** — the ordering rule that is a
resolution rule rather than a style one, and the two cases where an overload set
should have been an optional parameter or a union — are
[chunk 11](./11-overloads-and-naming.md), along with three naming rules the
handbook leaves implicit.

## Gotchas

**Symptom:** A parameter typed `String` rejects a normal string literal in some
position, or accepts something odd.
**Cause:** `String` is the boxed wrapper object, not the primitive.
**Fix:** Lowercase it. Same for `Number`, `Boolean`, `Symbol`; use `object` for
`Object`.

**Symptom:** `parse<Config>(text)` returns exactly `Config` and the data is
wrong at runtime.
**Cause:** A generic that does not use its type parameter — the caller is
asserting, not inferring.
**Fix:** Return `unknown` and make the caller narrow or validate.

**Symptom:** One `any` in a published signature and consumers report lost
checking far from it.
**Cause:** `any` is contagious through inference.
**Fix:** `unknown` where the type is genuinely unknown, or a real type.

**Symptom:** Every caller of your callback has to handle `undefined` for a value
you always pass.
**Cause:** An optional parameter in the callback type.
**Fix:** Drop the `?`. A callback may always ignore a parameter it does not want.

## Interview questions

**★ Why should a declaration file never use `String`, `Number` or `Boolean`?**
Those are the boxed wrapper object types, not the primitives. The handbook calls
them *"non-primitive boxed objects that are almost never used appropriately"*.
Every normal value in JavaScript is the primitive, so the lowercase names are the
ones you mean.

**★ What is wrong with `declare function parse<T>(json: string): T`?**
The type parameter is not used by any argument, so nothing infers it — the caller
picks the return type and the compiler checks nothing. It is `any` with extra
steps. Return `unknown` and make the caller prove what it got.

**★ Why `void` rather than `any` as a callback return type?**
Because `void` says the value is ignored, and the handbook's reason is that it
*"prevents you from accidentally using the return value in an unchecked way"*.
Callbacks returning something else remain assignable, so it costs the caller
nothing.

**Why should callback parameters not be optional?**
`?` claims you sometimes will not pass the argument, which forces every consumer
to handle `undefined`. If you always pass it, declare it required — a callback
may ignore any parameter it likes.

---

← Prev: [09 · The rarer emit failures](./09-the-rarer-emit-failures.md) · Next → [11 · Overloads and naming](./11-overloads-and-naming.md)
