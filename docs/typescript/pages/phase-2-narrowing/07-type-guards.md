---
title: "User-defined type guards"
sidebar_label: "07 · Type guards"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Narrowed types revealed by
> assignment to `1`; `sandbox/ts-p2/ex2-guards-and-loss.sh`.

**A type predicate lets you package a check in a function and keep the
narrowing.** It is how narrowing crosses a function boundary — and the compiler
**trusts you** rather than verifying the body, which makes it the most quietly
dangerous feature in this phase.

## The syntax and the measurement

```ts
type Cat = { name: string; meow(): void };
type Dog = { name: string; bark(): void };

function isCat(p: Cat | Dog): p is Cat {
  return 'meow' in p;
}

declare const pet: Cat | Dog;
if (isCat(pet)) { const r: 1 = pet; }
```

```console
src-ex2/guards.ts(14,25): error TS2322: Type 'Cat' is not assignable to type '1'.
```

`p is Cat` is the return type. To a caller the function returns `boolean`; to the
**checker** it says "when this returns true, treat the argument as `Cat`".

Without the predicate — a plain `: boolean` return type — the `if` narrows
nothing, and that is the whole reason the feature exists.

## The compiler does not check the body

```ts
function isCat(p: Cat | Dog): p is Cat {
  return true;             // compiles. Every Dog is now a Cat.
}

function isString(v: unknown): v is string {
  return typeof v === 'number';   // compiles.
}
```

**Both of these are accepted.** A type predicate is an assertion in function
form, exactly like `as` ([08](./08-as-assertions/README.md)) — the difference is that it
is written once, reviewed once, and then trusted at every call site, which makes
a wrong one much more expensive than a wrong cast.

So the discipline is: **type guards are small, obvious, and tested.** A guard
with branching logic in it is a guard whose correctness nobody can see.

## Guarding `unknown`

The most valuable use is turning outside data into a domain type:

```ts
type Order = { id: string; total: number };

function isOrder(v: unknown): v is Order {
  return (
    typeof v === 'object' && v !== null &&
    'id' in v && typeof (v as Record<string, unknown>).id === 'string' &&
    'total' in v && typeof (v as Record<string, unknown>).total === 'number'
  );
}

const data: unknown = JSON.parse(body);
if (isOrder(data)) {
  data.total.toFixed(2);   // Order
}
```

That works, and it is verbose, and the `as Record<string, unknown>` casts inside
it are exactly the kind of thing a mistake hides in. **In production code, prefer
a schema validator** — zod, valibot — which generates the equivalent check *and*
the type from one declaration, with no hand-written predicate to get wrong
([Phase 9](../../syllabus/03-in-the-stack.md)):

```ts
const orderSchema = z.object({ id: z.string(), total: z.number() });
type Order = z.infer<typeof orderSchema>;

const order = orderSchema.parse(JSON.parse(body));   // throws, or gives you an Order
```

Hand-written guards earn their place for **narrow, structural checks** —
`isDefined`, `isError`, `isNonEmpty` — not for whole payloads.

## The guards worth having in every codebase

```ts
function isDefined<T>(v: T | null | undefined): v is T {
  return v != null;
}

const cleaned = maybeItems.filter(isDefined);   // T[] rather than (T | null)[]
```

That `filter` behaviour is the killer application: without the predicate,
`filter(v => v != null)` returns `(T | null)[]` and every consumer must re-check.

```ts
function isError(e: unknown): e is Error {
  return typeof e === 'object' && e !== null && 'message' in e && 'stack' in e;
}
```

Realm-safe, unlike `instanceof`
([04](./04-instanceof-narrowing.md)).

```ts
function isKeyOf<T extends object>(obj: T, k: PropertyKey): k is keyof T {
  return k in obj;
}
```

The one that narrows a **key** rather than an object — which `in` alone cannot do
([03](./03-in-operator-narrowing.md)).

## Guards on `this`

A method can narrow its own receiver:

```ts
class Result<T> {
  constructor(private value?: T, private error?: Error) {}

  isOk(): this is { value: T } {
    return this.error === undefined;
  }
}
```

Occasionally useful for fluent APIs; rarely worth the complexity in application
code.

## Trade-off

**A type predicate** reuses one check everywhere, works with `filter` and `find`,
and reads well at the call site. It costs verification — the compiler takes your
word for it, so a wrong guard corrupts every consumer with no error anywhere.

**Inline checks** are verified by the compiler at each site, and are repetitive.

**A schema validator** gives runtime verification *and* the type from one source,
at the cost of a dependency and a parse step — the right default for anything
crossing a boundary.

## Gotchas

**Symptom:** An `if` calling a boolean function does not narrow
**Cause:** The return type is `boolean`, not `x is T`.
**Fix:** Declare the predicate return type.

**Symptom:** `filter(v => v !== null)` still gives `(T | null)[]`
**Cause:** An inline arrow is not a type predicate.
**Fix:** A named `isDefined` guard, or `filter((v): v is T => v !== null)`.

**Symptom:** A guard passes for values it should reject
**Cause:** The body is wrong and the compiler never checked it.
**Fix:** Unit-test guards like any other logic; keep them small enough to read.

**Symptom:** `TS2677: A type predicate's type must be assignable to its
parameter's type`
**Cause:** The asserted type is not a subtype of the parameter type — e.g.
`(v: string): v is number`.
**Fix:** Widen the parameter to `unknown`, or fix the asserted type.

**Symptom:** The guard narrows in the `if` but not in the `else`
**Cause:** Predicates narrow the negative branch only by subtraction, which does
nothing when the parameter type is `unknown`.
**Fix:** Structure the code as an early return, or use a union parameter type.

## Interview questions

**★ What is a type predicate and why do you need one?**
A return type of the form `x is T`. To callers the function returns `boolean`; to
the checker it means "if this is true, `x` is a `T`", so narrowing survives the
function call. A plain `boolean` return narrows nothing, which is the whole
reason the syntax exists.

**★ Does the compiler verify a type guard's body?**
No. `function isCat(p: Cat | Dog): p is Cat { return true; }` compiles. A
predicate is an assertion in function form — written once and then trusted at
every call site, which makes a wrong one far more expensive than a wrong `as`.
Keep guards small and test them.

**★ Why does `filter` need a type predicate?**
Because an inline `v => v != null` returns `boolean`, so `filter` keeps the
original element type — `(T | null)[]`. A named `isDefined<T>(v): v is T` guard
lets the overload of `filter` narrow the result to `T[]`.

**When should you write a guard versus using a schema validator?**
Guards for small structural checks — `isDefined`, `isError`, `isKeyOf`. A
validator for anything crossing a boundary: it performs the runtime check and
derives the type from one declaration, so there is no hand-written predicate that
can silently disagree with the type it claims.

**How do you narrow a key rather than an object?**
A predicate returning `k is keyof T`. The `in` operator narrows the object on the
right, never the key on the left, so this is the only way to convince the
compiler that a `string` is a valid key.

---

← Prev: [Exhaustiveness](./06-exhaustiveness.md) · Next → [`as` assertions](./08-as-assertions/README.md)
