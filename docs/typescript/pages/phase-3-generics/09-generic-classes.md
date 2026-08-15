---
title: "Generic classes"
sidebar_label: "09 · Generic classes"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Generic
> Classes*, *Classes*). `TS2302` (*"Static members cannot reference class type
> parameters."*), `TS2420` (*"Class '{0}' incorrectly implements interface
> '{1}'."*) and `TS2442` (*"Types have separate declarations of a private
> property '{0}'."*) were read out of the **compiler's own diagnostic table**.
> ⚠️ Install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets.
> **No console block** — no sandbox run covers this phase.

```ts
class Box<T> {
  constructor(public value: T) {}

  map<U>(fn: (value: T) => U): Box<U> {
    return new Box(fn(this.value));
  }
}

const b = new Box('hello');      // Box<string> — inferred from the argument
const n = b.map(s => s.length);  // Box<number>
```

Nothing here is new: `T` is a type parameter on the class, `U` is one on the
method, and the distinction is the one from
[topic 03](./03-generic-interfaces-and-aliases/02-parameter-placement-and-merging.md)
— `T` is fixed when the instance is created, `U` is chosen at every `map` call.

What *is* specific to classes is where the parameter cannot reach, and when a
class is the right shape at all.

## Inference comes from the constructor

```ts
new Box('hello');                 // Box<string>
new Box<string | null>(null);     // explicit, because inference would give null
```

Same rules as a function call ([topic 01](./01-generic-functions-and-inference/README.md)):
the constructor's arguments are the inference sites. A constructor that takes
nothing has none, so the parameter falls back — which is why an empty container
almost always needs an explicit argument:

```ts
const empty = new Box(undefined);       // Box<undefined> — probably not wanted
const items = new Stack<User>();        // say it
```

## 🔴 Statics cannot reference the class type parameter

```ts
class Box<T> {
  static empty: T;
  static make(v: T): Box<T> { … }
}
```

```text
error TS2302: Static members cannot reference class type parameters.
```

**This is not a limitation to work around — it is arithmetic.** `T` is fixed per
*instance*; a static member belongs to the constructor, of which there is exactly
one for every `T` at once. There is no `Box<string>` constructor distinct from
the `Box<number>` one — [topic 07](./07-typeof-type-operator.md) showed that
`typeof Box` is a single value.

The fix is to make the static itself generic, so each *call* gets its own
parameter:

```ts
class Box<T> {
  constructor(public value: T) {}

  static of<U>(value: U): Box<U> {      // U is the method's, not the class's
    return new Box(value);
  }
}

const b = Box.of(42);       // Box<number>
```

That is why factory statics in real libraries are always written `static of<U>`
rather than `static of(v: T)`.

## Implementing a generic interface

```ts
interface Repository<T, Id = string> {
  find(id: Id): Promise<T | null>;
  save(entity: T): Promise<T>;
}

class UserRepository implements Repository<User> { … }     // T fixed here

class MemoryRepo<T extends { id: string }> implements Repository<T> { … }
```

Both are common. The first *closes over* the parameter — this repository is for
users and nothing else. The second stays open, passing its own parameter through.
Choose by whether there will be one implementation per entity or one
implementation for all of them.

When the class does not satisfy the interface:

```text
error TS2420: Class 'UserRepository' incorrectly implements interface
'Repository<User>'.
```

⚠️ **`implements` is a check, not a source of types.** It verifies the class
against the interface and contributes nothing to the members' own types — an
unannotated parameter in a method body is still an implicit `any` even though
the interface declares it. That surprises people coming from Java, and it is why
methods are usually annotated even when `implements` is present.

## Where a generic class beats a generic function

The honest answer is: **less often than people reach for one.** A class earns its
place when there is **state that must carry a type between calls**.

```ts
// Yes — the type is carried across many operations on one instance.
class TypedCache<V> {
  private store = new Map<string, V>();
  get(k: string): V | undefined { return this.store.get(k); }
  set(k: string, v: V): this { this.store.set(k, v); return this; }
}

// Yes — a builder accumulating a type.
class QueryBuilder<T> {
  where(fn: (row: T) => boolean): this { … }
  select<K extends keyof T>(...keys: K[]): QueryBuilder<Pick<T, K>> { … }
}
```

Two details in there worth stealing. **`: this` as a return type** is what makes
chaining work correctly through a subclass — `return this` typed as
`TypedCache<V>` would lose a subclass's own methods. And `select` returning
`QueryBuilder<Pick<T, K>>` **changes the parameter as the builder narrows**,
which is the shape of every well-typed query API.

Where a class is *not* the answer:

```ts
class Result<T> {                      // ← a wrapper with no real state
  constructor(private value?: T, private error?: Error) {}
  isOk(): this is { value: T } { … }
}
```

A discriminated union does this better
([Phase 2 · topic 05](../phase-2-narrowing/05-discriminated-unions.md)): both
branches narrow with no method call, there is no runtime object, and the type
system verifies exhaustiveness. **Reach for the union first; use a class when
you genuinely need identity, mutation or a fluent chain.**

## Private members make a class nominal-ish

Everything else in TypeScript is structural
([Phase 1 · topic 09](../phase-1-type-vocabulary/09-structural-typing.md)). A
`private` (or `protected`) member is the exception:

```ts
class A<T> { private brand!: T }
class B<T> { private brand!: T }

declare const a: A<string>;
const b: B<string> = a;
```

```text
error TS2442: Types have separate declarations of a private property 'brand'.
```

Identical shapes, and they are **not** assignable, because private members are
compared by *declaration site* rather than by name and type. Two consequences:

- It is the mechanism behind branded types — a `private brand` makes a class
  genuinely distinct from a look-alike.
- It bites when a package appears twice in a build. Two copies of the same class
  from two `node_modules` paths are separate declarations, so instances of one
  are not assignable to the other — the same duplicate-bundle failure as
  `instanceof` in [Phase 2 · topic 04](../phase-2-narrowing/04-instanceof-narrowing.md),
  showing up as a type error instead of a runtime one.

## Extending and abstract

```ts
abstract class Store<T> {
  protected abstract serialise(value: T): string;
  save(value: T) { localStorage.setItem(this.key, this.serialise(value)); }
  constructor(protected key: string) {}
}

class UserStore extends Store<User> {
  protected serialise(u: User) { return JSON.stringify(u); }
}
```

A subclass may fix the parameter (`extends Store<User>`) or keep it open
(`class Cached<T> extends Store<T>`). An **abstract** class cannot be
instantiated, which is why `InstanceType` and `ConstructorParameters` are declared
with `abstract new (...)` in `lib.es5.d.ts`
([topic 07](./07-typeof-type-operator.md)) — that signature form matches both
abstract and concrete constructors.

## Trade-off

**A generic class** carries a type across many operations on one value, supports
fluent chaining with `this`, and gives you a place to hide private state. It
costs a runtime object, `this` semantics, and a structure that is harder to
narrow than a union — and it tempts you into wrapping things that did not need
wrapping.

**A generic function plus a plain type** has no runtime footprint, narrows with
ordinary control flow, and composes. It cannot carry state between calls, which
is exactly when the class wins.

## Gotchas

**Symptom:** `TS2302: Static members cannot reference class type parameters`
**Cause:** `T` belongs to the instance; the constructor is a single value shared
by every instantiation.
**Fix:** Make the static generic itself — `static of<U>(v: U): Box<U>`.

**Symptom:** `new Container()` infers an unusable type
**Cause:** A constructor with no arguments has no inference site.
**Fix:** Pass the type argument explicitly — `new Stack<User>()`.

**Symptom:** A method parameter is implicitly `any` despite `implements`
**Cause:** `implements` checks the class; it does not supply types to members.
**Fix:** Annotate the method. This is the main thing that surprises people
arriving from Java or C#.

**Symptom:** Chaining loses a subclass's methods
**Cause:** The method returns the base class rather than `this`.
**Fix:** Return type `this`.

**Symptom:** `TS2442: Types have separate declarations of a private property`
**Cause:** Private members are compared by declaration site, not structurally —
often two copies of a package in one build.
**Fix:** Deduplicate the dependency. As a *deliberate* technique, this is how
branding works.

**Symptom:** A `Result` class needs `isOk()` calls everywhere to narrow
**Cause:** A class where a discriminated union was the right shape.
**Fix:** `{ ok: true; value: T } | { ok: false; error: E }` — it narrows with a
plain `if` and checks exhaustiveness.

## Interview questions

**★ Why can't a static member reference the class's type parameter?**
Because `T` is fixed per instance and a static belongs to the constructor, of
which there is exactly one shared by every instantiation — there is no
`Box<string>` constructor separate from the `Box<number>` one. `TS2302`. The fix
is to give the static its own parameter: `static of<U>(v: U): Box<U>`.

**★ When is a generic class the right choice over a generic function?**
When a type must be carried across several operations on one value — a typed
cache, a query builder, a connection pool. If it is a one-shot transformation, a
function plus a type alias has no runtime cost and narrows better. A `Result`
class in particular is almost always better as a discriminated union.

**★ Does `implements` give a class's methods their types?**
No. It is a check only — the class is verified against the interface (`TS2420`
when it fails), but members get no types from it, so an unannotated parameter is
still an implicit `any`. This is the usual surprise for people arriving from
Java.

**Why are two structurally identical classes sometimes not assignable?**
Because `private` and `protected` members are compared by declaration site rather
than structurally — `TS2442`. It is what makes branding with a `private brand`
work, and it is also how a duplicated package in a build surfaces: two copies of
the same class are two declarations.

**What does a return type of `this` buy you?**
Correct chaining through subclasses. Returning the base class type from a fluent
method drops any subclass's own methods from the chain; `this` keeps the actual
receiver's type all the way along.

---

← Prev: [08 · Default type parameters](./08-default-type-parameters.md) · Next → **10 · Inference sites and contextual typing** *(not written yet)*
