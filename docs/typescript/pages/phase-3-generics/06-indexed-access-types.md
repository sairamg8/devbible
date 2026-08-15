---
title: "Indexed access types — `T[K]`"
sidebar_label: "06 · Indexed access `T[K]`"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Indexed Access Types*). `TS2713` — *"Cannot access '{0}.{1}' because '{0}' is a
> type, but not a namespace. Did you mean to retrieve the type of the property
> '{1}' in '{0}' with '{0}[\"{1}\"]'?"* — and `TS2536` were read out of the
> **compiler's own diagnostic table**, and `Awaited`/`ReturnType` directly from
> `lib.es5.d.ts`. ⚠️ Install inspected: TypeScript **6.0.3**, not the 7.0.2 this
> corpus targets. **No console block** — no sandbox run covers this phase.

`T[K]` reads **the type of a property out of a type**. It is the type-level
counterpart of `obj[key]`, and it has been doing quiet work on every page since
[topic 04](./04-keyof/README.md).

```ts
type User = { id: string; name: string; age: number };

type Id = User['id'];        // string
type Age = User['age'];      // number
```

## Square brackets, always — never a dot

```ts
type Id = User.id;
```

```text
error TS2713: Cannot access 'User.id' because 'User' is a type, but not a
namespace. Did you mean to retrieve the type of the property 'id' in 'User'
with 'User["id"]'?
```

The diagnostic tells you the fix, which is unusually helpful, and the reason is
worth knowing: **a dot in a type position means namespace access**, which is a
different feature. Types are indexed, never dotted.

The index must also be a **type**, not a value:

```ts
const key = 'id';
type Bad = User[key];        // error — `key` is a value
type Good = User[typeof key];  // string — lift the value first
type Also = User['id'];        // the literal type directly
```

That third line is the normal way. The second is the pairing with the `typeof`
type operator that [topic 07](./07-typeof-type-operator.md) covers.

## It distributes over a union of keys

```ts
type SomeValue = User['id' | 'name'];    // string
type Mixed = User['name' | 'age'];       // string | number
```

`T['a' | 'b']` is `T['a'] | T['b']`. This is not a special case — it is what
makes `getProp(user, cond ? 'name' : 'age')` correctly return `string | number`
([topic 05](./05-getprop-pattern/README.md)), because the compiler cannot know
which branch ran.

The limiting case is the one to remember:

```ts
type AnyValue = User[keyof User];        // string | number
```

**`T[keyof T]` is the union of every property type.** It is exactly what a
`getProp` written without its second type parameter is forced to return, and
seeing it in a hover is usually the sign that a type parameter went missing.

## 🔴 `T[number]` — the one you will use most

For arrays and tuples, `number` is the index type, so `T[number]` is the
**element type**:

```ts
type Names = string[];
type Name = Names[number];               // string

type Levels = readonly ['debug', 'info', 'warn'];
type Level = Levels[number];             // 'debug' | 'info' | 'warn'
```

Paired with `as const`, this is one of the highest-value two-line patterns in the
language:

```ts
const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

type Level = (typeof LEVELS)[number];    // 'debug' | 'info' | 'warn' | 'error'
```

**One declaration produces both the runtime array and the compile-time union.**
The array is what you iterate, render into a dropdown or validate against; the
union is what you type parameters with. Keeping two hand-written copies in sync
is one of the most reliable sources of stale code in a TypeScript project, and
this removes the possibility.

⚠️ **The parentheses are required.** `typeof LEVELS[number]` parses as
`typeof (LEVELS[number])`, which is not what you want; write
`(typeof LEVELS)[number]`.

A tuple can also be indexed by a literal position:

```ts
type Pair = [string, number];
type First = Pair[0];        // string
type Second = Pair[1];       // number
type Either = Pair[number];  // string | number
```

## Nesting, and where it stops

Indexed access composes as deeply as the type does:

```ts
type Api = {
  user: { profile: { email: string; verified: boolean } };
};

type Email = Api['user']['profile']['email'];    // string
```

Two limits worth knowing.

**Optional properties carry their `undefined` through.**

```ts
type Cfg = { db?: { host: string } };
type Db = Cfg['db'];              // { host: string } | undefined
type Host = Cfg['db']['host'];    // error — the union has no 'host'
```

The fix is `NonNullable<Cfg['db']>['host']`, using the utility read from
`lib.es5.d.ts` in [topic 03](./03-generic-interfaces-and-aliases/README.md).
There is no `?.` for types.

**An unconstrained type parameter cannot be an index.**

```ts
function get<T, K>(obj: T, key: K): T[K] { … }
```

```text
error TS2536: Type 'K' cannot be used to index type 'T'.
```

`K extends keyof T` is what fixes it — the constraint is what makes the indexed
access legal, which is the whole `getProp` argument seen from the other side.

## Deriving types you did not write

This is where indexed access earns its place in day-to-day code: **pulling a type
out of something you do not own, rather than re-declaring it.**

```ts
// The element type of whatever this function returns.
type Item = Awaited<ReturnType<typeof fetchUsers>>[number];

// One prop of a component you imported.
type ButtonVariant = React.ComponentProps<typeof Button>['variant'];

// The payload of one action in a map.
type ClickPayload = EventMap['click'];

// The argument type of a callback that is buried in an options object.
type OnChange = Options['onChange'];
type ChangeArg = Parameters<Options['onChange']>[0];
```

`ReturnType` and `Parameters` are themselves conditional types with `infer` in
them — their declarations are in `lib.es5.d.ts` and they are the subject of
**topic 11** *(not written yet)*. `Awaited<T>` unwraps a promise, recursively.

**The rule that makes this worth doing:** a derived type cannot go stale. Re-declare
`{ id: string; name: string }` next to the function that returns it and the two
drift apart silently; write `Awaited<ReturnType<typeof f>>` and the compiler
keeps them in step.

## Trade-off

**Deriving with indexed access** means one source of truth and no drift. It costs
readability — `Awaited<ReturnType<typeof fetchUsers>>[number]` says *how* the
type was obtained rather than *what it is*, and a reader has to unwrap it. It
also couples you to a shape someone else may change.

**Declaring the type explicitly** reads better at the point of use and gives you
a name to talk about, at the cost of a second definition nothing checks against
the first.

A reasonable middle: derive it once, `type User = Awaited<ReturnType<typeof
fetchUsers>>[number]`, and use the **name** everywhere else. You get one source
of truth and a readable identifier.

## Gotchas

**Symptom:** `TS2713: … 'User' is a type, but not a namespace`
**Cause:** `User.id` — a dot in a type position means namespace access.
**Fix:** `User['id']`. The diagnostic spells it out.

**Symptom:** `T[key]` where `key` is a `const` does not compile
**Cause:** The index must be a type, not a value.
**Fix:** `T[typeof key]`, or write the literal type directly.

**Symptom:** `typeof LEVELS[number]` gives something unexpected
**Cause:** It parses as `typeof (LEVELS[number])`.
**Fix:** `(typeof LEVELS)[number]`.

**Symptom:** `Cfg['db']['host']` errors on an optional property
**Cause:** `Cfg['db']` includes `| undefined`, and the union has no `host`.
**Fix:** `NonNullable<Cfg['db']>['host']`.

**Symptom:** `TS2536: Type 'K' cannot be used to index type 'T'`
**Cause:** An unconstrained type parameter used as an index.
**Fix:** `K extends keyof T`.

**Symptom:** A hover shows `string | number | boolean` where one type was
expected
**Cause:** Something resolved to `T[keyof T]` — usually a `getProp` missing its
second type parameter.
**Fix:** Add the `K` parameter and return `T[K]`.

## Interview questions

**★ What is `T[number]` and why does it matter?**
The element type of an array or tuple. Paired with `as const` it gives you a
runtime list and a compile-time union from one declaration —
`const LEVELS = [...] as const; type Level = (typeof LEVELS)[number]` — which
removes the classic drift between a hand-written union and the array it is
supposed to describe. Note the parentheses: `typeof LEVELS[number]` parses
differently.

**★ Why is it `User['id']` and not `User.id`?**
A dot in a type position means namespace access, which is a different feature —
`TS2713` says so and suggests the bracket form. Types are indexed, never dotted,
and the index has to be a type, so a value must be lifted with `typeof` first.

**★ What is `T[keyof T]`?**
The union of every property type in `T`. It is what a property accessor written
without a second type parameter is forced to return, so seeing it in a hover is
usually a sign that `<T, K extends keyof T>` was written as `(obj: T, key: keyof
T)`.

**How do you get the element type of whatever an async function returns?**
`Awaited<ReturnType<typeof fetchUsers>>[number]` — `typeof` lifts the function
into the type world, `ReturnType` extracts its return type, `Awaited` unwraps the
promise, and `[number]` takes the element. Give it a name once rather than
repeating the chain.

**Why does indexing an optional property fail?**
Because `Cfg['db']` includes `| undefined`, and a union without `host` on every
member cannot be indexed by `'host'`. There is no optional chaining for types;
use `NonNullable<Cfg['db']>['host']`.

---

← Prev: [05 · The `getProp` pattern](./05-getprop-pattern/README.md) · Next → [07 · The `typeof` type operator](./07-typeof-type-operator.md)
