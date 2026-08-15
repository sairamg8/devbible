---
title: "Where it silently does nothing"
sidebar_label: "02 · Where it silently does nothing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (*const Type
> Parameters*) — the `fnGood`/`fnBad` examples and their comments are quoted
> verbatim, including the release notes' own explanation of why `fnBad` fails.
> Modifier-placement message text is read out of the **compiler's diagnostic
> table** at TypeScript **6.0.3**. **No console block** — no sandbox covers this
> phase.

Both failure modes below **compile**. One of them reports nothing at all. This is
the chunk that matters in review.

## 🔴 No-op #1 — the argument was written somewhere else

The release notes state the boundary flatly: the modifier affects inference of
object, array and primitive expressions **written within the call**.

```ts
declare function fnGood<const T extends readonly string[]>(args: T): void;

const arr = ["a", "b" ,"c"];
// 'T' is still 'string[]' -- the 'const' modifier has no effect here
fnGood(arr);
```

Follow the order of events. `const arr = ["a", "b", "c"]` is checked **first**,
on its own line, with no knowledge of any call it will later appear in. It infers
`string[]`. By the time `fnGood(arr)` is checked there is no literal left
anywhere — just a variable of type `string[]`.

⚠️ **`const` on a variable is not `as const`.** `const arr` stops the *binding*
being reassigned; it does nothing about the initialiser's type widening. That
collision of names is most of why this case confuses people.

### What counts as "written within the call"

Everything here follows from the stated rule rather than from separate
documentation, so reason it through rather than memorising a list: the modifier
acts on a literal expression the checker is inferring **at that argument
position**.

```ts
fnGood(["a", "b"]);                 // ✅ literal written at the call
fnGood([...arr]);                   // ❌ spread of an already-widened variable
fnGood(getDefaults());              // ❌ a call's return type is already fixed
fnGood(cond ? ["a"] : ["b"]);       // ⚠️ literals at the call, but the conditional's
                                    //    own type is computed first — do not rely on it
```

**The fix is always the same and always at the declaration**: `as const` where
the value is written.

```ts
const arr = ["a", "b", "c"] as const;
fnGood(arr);                        // T is readonly ["a", "b", "c"]
```

Which is worth noticing: the feature does **not** remove the need for `as const`.
It removes it for values written inline, and inline is the common case for the
config-and-table APIs the feature exists to serve.

## 🔴 No-op #2 — a mutable constraint, and no error at all

This is the worse one, because nothing tells you.

```ts
declare function fnBad<const T extends string[]>(args: T): void;
// 'T' is still 'string[]' since 'readonly ["a", "b", "c"]' is not assignable to 'string[]'
fnBad(["a", "b" ,"c"]);
```

The arithmetic, step by step:

1. `const` produces the inference candidate `readonly ["a", "b", "c"]`.
2. The constraint demands `string[]`, which is **mutable**.
3. A readonly array is **not** assignable to a mutable one — that direction is
   exactly what `readonly` exists to forbid, since the receiver could `push`.
4. The candidate fails the constraint, so inference **falls back to the
   constraint**, and `T` is `string[]`.

Nothing is reported. The `const` is present, spelled correctly, and inert. A
reviewer sees a `const` type parameter and reasonably assumes it is working.

```ts
declare function fnGood<const T extends readonly string[]>(args: T): void;
// T is readonly ["a", "b", "c"]
fnGood(["a", "b" ,"c"]);
```

### The rule that follows

**A `const` type parameter's constraint must be `readonly` all the way down.**

```ts
// ❌ silently inert — the array property is mutable
<const T extends { names: string[] }>

// ✅
<const T extends { names: readonly string[] }>

// ✅ the maximally permissive readonly bounds
<const T extends readonly unknown[]>
<const T extends readonly Record<string, unknown>[]>
```

This is why the handbook's own example type is `{ names: readonly string[] }` and
not `{ names: string[] }`. That `readonly` is not stylistic — delete it and
[chunk 01](./01-what-const-inference-does.md)'s opening example stops working,
with no diagnostic to say why.

**Reviewer's heuristic:** see `const` on a type parameter, look immediately at the
constraint. A mutable array or a mutable array-typed property anywhere in it means
the modifier is decorative.

## Where the modifier may be written

`const` goes on the type parameters of **functions, methods and constructors** —
declarations with call sites, because a call site is the only place this kind of
inference happens. A type alias or interface has no arguments to infer from; its
type arguments are written by hand or come from a
[default](../08-default-type-parameters.md).

The compiler's diagnostic table carries three placement messages:

| Code | Message text (verbatim from the table) |
|---|---|
| **TS1273** | *"'{0}' modifier cannot appear on a type parameter"* |
| **TS1274** | *"'{0}' modifier can only appear on a type parameter of a class, interface or type alias"* |
| **TS1277** | *"'{0}' modifier can only appear on a type parameter of a function, method or class"* |

TS1274's list — class, interface, type alias — is where the **variance**
annotations `in`/`out` belong ([topic 14](../14-variance.md)). TS1277's list is
where **`const`** belongs. The two modifiers sit on opposite lists, which is a
tidy way to remember both.

⚠️ **That mapping is derived from the message wording plus the documented
placement rules, not from watching each code fire.** The install inspected is the
Go-port compiler, whose checker is not readable from the JavaScript package the
way the string table is. Stated rather than glossed, per this phase's evidence
policy.

## What it does *not* do

**It does not freeze anything.** `<const T>` emits no code and is erased with
every other annotation. The array in `fnGood(["a","b","c"])` is an ordinary
mutable JavaScript array at runtime; only the compiler believes it is `readonly`.
Same bargain as `as const` itself — worth saying out loud, because `const` reads
as a runtime guarantee to anyone arriving from a language where it is one. If you
want the runtime behaviour, that is `Object.freeze`, and it is a separate
decision.

**It does not reject mutable values.** A caller passing an already-widened
variable gets the wide inference, not an error — no-op #1 restated from the other
side. If you need to *require* a literal, `const` is not the mechanism; a
constraint that only literals satisfy is.

**It does not override an explicit type argument.** The precedence from
[topic 08](../08-default-type-parameters.md) still holds — explicit type argument
first, then inference, then a default. `fnGood<string[]>(["a"])` gets `string[]`,
because the caller said so and there was nothing left to infer.

---

← [01 · What `const` inference does](./01-what-const-inference-does.md) · Next → [03 · Designing APIs with it](./03-designing-apis-with-it.md)
