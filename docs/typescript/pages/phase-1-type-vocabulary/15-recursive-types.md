---
title: "Recursive type aliases"
sidebar_label: "15 · Recursive types"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Error text below is compiler output
> from `sandbox/ts-p1/ex6-recursive.sh`.

**A type may refer to itself.** That is how you describe JSON, a tree, a nested
menu, or a comment thread — data whose depth is not known when you write the
type.

## The canonical one: JSON

```ts
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const payload: JsonValue = {
  id: 'O-1',
  total: 4800,
  items: [{ sku: 'a', qty: 2 }],
  note: null,
};
```

This is the correct return type for a parser, and the correct parameter type for
anything that serialises. Use it in place of `any` for "arbitrary JSON" — it
still forces you to narrow before using a value, which is the point
([06 · any, unknown, never, void](./06-any-unknown-never-void.md)).

## Trees and nested structures

```ts
type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
};

type Comment = {
  id: string;
  body: string;
  replies: Comment[];
};

type MenuItem = {
  label: string;
  href?: string;
  items?: MenuItem[];
};
```

Recursion through a property is unrestricted, because the compiler only needs to
resolve the type when it is used, not to expand it eagerly.

## Recursion works with unions and conditionals too

```ts
type Flatten<T> = T extends readonly (infer U)[] ? Flatten<U> : T;

type A = Flatten<number[][][]>;   // number
```

This is [Phase 5](../../syllabus/02-types-at-scale.md) material — the point here
is that the recursion mechanism is the same, and so is its limit.

## The limit

```ts
type Deep<N extends number[], Stop extends number> =
  N['length'] extends Stop ? true : Deep<[...N, 0], Stop>;

type A = Deep<[], 50>;     // fine
type B = Deep<[], 500>;    // fine
type C = Deep<[], 5000>;   // too far
```

```console
$ tsc --noEmit --strict src-ex6/deep.ts
src-ex6/deep.ts(5,10): error TS2589: Type instantiation is excessively deep and possibly infinite.
exit=1
```

**The limit is a great deal higher than the folklore suggests.** 50 levels was
the first depth tried here and it did not even register; 500 was fine; only 5000
tripped it on 7.0.2. Ordinary data types (JSON, trees, menus) are nowhere near
it. `TS2589` in practice means **type-level arithmetic or a deep mapped type**
has outgrown what the checker will evaluate, not that your data is too nested.

The other failure mode is genuinely circular *without* going through a property:

```ts
type Bad = Bad[];             // fine, oddly — arrays defer
type Worse = Worse & { a: 1 }; // error: Type alias 'Worse' circularly references itself
```

An alias may refer to itself **inside** an object, array or function type — those
defer resolution. A direct self-reference in an intersection or a bare alias
cannot.

## Interfaces recurse too

```ts
interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
}
```

No difference in capability here. The `type` form is needed when the recursion
involves a union or a conditional, which an interface cannot express
([07 · type vs interface](./07-type-vs-interface.md)).

## Working with recursive data

The type describes the shape; traversing it is ordinary code — and it is where
narrowing does the real work:

```ts
function collect(node: MenuItem, out: string[] = []): string[] {
  if (node.href) out.push(node.href);
  for (const child of node.items ?? []) collect(child, out);
  return out;
}

function sizeOf(v: JsonValue): number {
  if (v === null || typeof v !== 'object') return 1;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + sizeOf(x), 0);
  return Object.values(v).reduce<number>((n, x) => n + sizeOf(x), 0);
}
```

`sizeOf` is a good demonstration of why `JsonValue` beats `any`: every branch had
to be handled, and the compiler confirmed nothing was missed.

**The explicit `reduce<number>` is not decoration.** Written as
`v.reduce((n, x) => n + sizeOf(x), 0)`, the accumulator is inferred from the
array's element type rather than from the initial value, and the first version of
this page shipped that mistake until the script was actually run:

```console
src-ex6/json.ts(9,51): error TS18047: 'n' is possibly 'null'.
src-ex6/json.ts(9,51): error TS2365: Operator '+' cannot be applied to types
  'string | number | boolean | JsonValue[] | { [key: string]: JsonValue; }' and 'number'.
```

Supplying the type argument pins the accumulator to `number` and it compiles
clean.

## Trade-off

**A recursive type** describes nested data exactly, so consumers must handle each
shape. It costs error-message quality — a mismatch deep in a recursive type
produces a long, nested message — and, for type-level recursion, compile time.

**Flattening the model** (`items: unknown[]`, or a depth-limited type) gives
simpler errors and loses the guarantee.

## Gotchas

**Symptom:** `TS2589: Type instantiation is excessively deep and possibly infinite`
**Cause:** Type-level recursion exceeded the compiler's depth limit — usually
type arithmetic or a deep mapped type, rarely plain data.
**Fix:** Bound the recursion, simplify the type, or accept a less precise one.

**Symptom:** `Type alias 'X' circularly references itself`
**Cause:** A direct self-reference not deferred by an object, array or function
type.
**Fix:** Wrap the recursive use in a property or array — `type X = { next: X }`.

**Symptom:** Huge unreadable errors from a recursive type
**Cause:** The compiler expands the path it walked.
**Fix:** Read the innermost line first
([09 · Structural typing](./09-structural-typing.md)); give intermediate types
names so messages have something short to print.

**Symptom:** `JsonValue` rejects an object you know is valid JSON
**Cause:** An interface (rather than a type alias) does not satisfy the index
signature `{ [k: string]: JsonValue }` — interfaces have no implicit index
signature.
**Fix:** Use a `type` alias for the object, or add an index signature to the
interface.

**Symptom:** Recursion into `unknown` forces a cast at every level
**Cause:** `unknown` needs narrowing each time.
**Fix:** A precise recursive type such as `JsonValue`, whose branches narrow
naturally.

## Interview questions

**★ How do you type arbitrary JSON?**
A recursive union: `type JsonValue = string | number | boolean | null |
JsonValue[] | { [k: string]: JsonValue }`. It is the honest alternative to `any`
— consumers must narrow before using a value, and every branch is accounted for.

**★ What does `TS2589` mean?**
The compiler's recursion depth limit was exceeded — the type instantiated itself
too many times. It comes from type-level recursion (arithmetic, deep mapped
types), not from ordinary recursive data types, and it means the type has grown
past what the checker will evaluate.

**★ Why does `type X = { next: X }` work but `type X = X & { a: 1 }` not?**
Object, array and function types defer resolution of their members, so the
self-reference is fine. An intersection must be resolved immediately, so the
alias references itself circularly and the compiler reports it.

**Why might a valid-looking object be rejected by `JsonValue`?**
If the object's type is an `interface`, it has no implicit index signature and so
does not satisfy `{ [k: string]: JsonValue }`. Type aliases of object literal
types do. It is one of the few practical differences between the two.

**What is the cost of a deeply recursive type?**
Compile time and error-message quality. A mismatch inside a recursive type
produces a long nested message describing the whole path, which is why naming the
intermediate types is worth doing.

---

← Prev: [`readonly` and immutability](./14-readonly-and-immutability.md) · Next → [`object`, `Object` and `{}`](./16-object-Object-braces.md)
