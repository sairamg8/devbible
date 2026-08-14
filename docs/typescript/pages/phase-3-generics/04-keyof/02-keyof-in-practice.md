---
title: "`keyof` in practice"
sidebar_label: "02 · In practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Keyof Type Operator*, *Typeof Type Operator*, *Mapped Types*). The
> distributive behaviour over unions and intersections follows the handbook's
> statement that `keyof (A | B)` yields the keys common to both. ⚠️ Any error
> codes quoted here were read from the compiler's diagnostic table — TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets. **No console block** — no
> sandbox run covers this phase.

[Chunk 01](./01-what-keyof-produces.md) covered what the operator produces. This
one is the four things you will actually do with it.

## 1. `keyof typeof` — by far the most common form

`keyof` needs a **type**. Most of the time what you have is a **value**. The
`typeof` type operator bridges them:

```ts
const routes = {
  home: '/',
  profile: '/users/:id',
  search: '/search',
};

type RouteName = keyof typeof routes;    // 'home' | 'profile' | 'search'

function navigate(name: RouteName) { … }
navigate('serch');                        // caught
```

Read it right to left: `typeof routes` lifts the value into the type world, and
`keyof` then reads its keys. **The object is the single source of truth** — add
a route and the union grows; delete one and every stale call site errors.

⚠️ **`typeof` here is the *type* operator, not JavaScript's.** They share a
spelling and have nothing to do with each other: the JavaScript one runs and
returns `'object'`, this one is erased and returns a type.
**Topic 07 · The `typeof` type operator** *(not written yet)* covers the pairing
properly.

This is also where [`satisfies`](../../phase-2-narrowing/10-satisfies/README.md)
earns its keep: annotate the object `Record<string, string>` and `RouteName`
collapses to `string`. Use `satisfies` and you get the checking **and** the keys.

```ts
const routes = { … } satisfies Record<string, `/${string}`>;
type RouteName = keyof typeof routes;    // still the three literals
```

## 2. The duality over unions and intersections

This one is genuinely counter-intuitive the first time, and it is worth
memorising because it explains a whole class of "why is this key missing?"
questions:

```ts
type A = { id: string; a: number };
type B = { id: string; b: boolean };

type KU = keyof (A | B);     // 'id'                 ← only the COMMON keys
type KI = keyof (A & B);     // 'id' | 'a' | 'b'     ← ALL the keys
```

**`keyof` a union gives the intersection of the keys; `keyof` an intersection
gives the union of the keys.** The operator flips which way the combination
goes.

It is not arbitrary. A value of type `A | B` might be *either*, so the only keys
you can safely read are the ones both have. A value of type `A & B` is
*both*, so every key of either is available. `keyof` is answering "what may I
safely access?", and that answer inverts with the combinator.

The practical consequence: **a helper constrained `K extends keyof T` becomes
nearly useless when `T` is a wide union**, because `keyof T` collapses to the
handful of shared keys — often just the discriminant. If that happens, the
answer is usually to narrow `T` first
([Phase 2](../../phase-2-narrowing/05-discriminated-unions.md)) rather than to
fight the constraint.

## 3. Typing a registry against its own keys

The shape that shows up in event emitters, command buses, reducers and route
handlers:

```ts
type EventMap = {
  click: { x: number; y: number };
  keypress: { key: string };
  close: undefined;
};

function on<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void,
): void { … }

on('click', p => p.x);          // p: { x: number; y: number }
on('keypress', p => p.key);     // p: { key: string }
on('clcik', p => p);            // caught at the string
```

Two separate wins, and people often notice only the first. The event name is
checked *and* the handler's payload is typed **from the name** — the `EventMap[K]`
indexed access resolves once `K` is fixed by the first argument, in exactly the
inference order from
[topic 01](../01-generic-functions-and-inference/02-where-inference-comes-from.md).

The same shape, for a reducer:

```ts
type Actions = {
  increment: { by: number };
  reset: undefined;
};

type Action = { [K in keyof Actions]: { type: K; payload: Actions[K] } }[keyof Actions];
```

That last line is a mapped type indexed by `keyof` — the standard way to turn a
map into a discriminated union. It belongs to Phase 5, and it is included here
only so the shape is recognisable when you meet it.

## 4. Narrowing a `string` into a key

`keyof` gives you a type, and outside data gives you a `string`. Getting from
one to the other needs a guard, not an assertion — the `isKeyOf` predicate from
[Phase 2 · topic 07](../../phase-2-narrowing/07-type-guards.md):

```ts
function isKeyOf<T extends object>(obj: T, k: PropertyKey): k is keyof T {
  return k in obj;
}

const raw: string = readFromQueryString();
if (isKeyOf(routes, raw)) {
  navigate(raw);          // raw is now 'home' | 'profile' | 'search'
}
```

The `in` operator narrows the *object* on its right, never the *key* on its left
([Phase 2 · topic 03](../../phase-2-narrowing/03-in-operator-narrowing.md)) —
which is precisely why the predicate exists. **Reaching for `raw as keyof typeof
routes` here is the common mistake**, and it is an unchecked claim about data you
did not control.

## Filtering keys by their value type

A preview of Phase 5, included because it is needed so often:

```ts
type KeysOfType<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never
}[keyof T];

type User = { id: string; name: string; age: number; active: boolean };

type StringKeys = KeysOfType<User, string>;    // 'id' | 'name'
type NumberKeys = KeysOfType<User, number>;    // 'age'
```

This is what lets you write `sumBy(users, 'age')` and have `'name'` rejected —
the constraint becomes `K extends KeysOfType<T, number>` instead of
`K extends keyof T`.

## Trade-off

**Deriving a union with `keyof typeof`** keeps one source of truth, so the type
cannot drift from the data. It costs you the ability to name the union
independently — every consumer is coupled to that object's shape, and renaming a
key is a breaking change with no deprecation step.

**Declaring the union separately** decouples the contract from the
implementation, at the cost of two places to update and no compiler check that
they agree — which is exactly the drift the first option removes.

Derive when the object *is* the definition (routes, event maps, config tables).
Declare when the union is a published contract that outlives any one table.

## Gotchas

**Symptom:** `keyof typeof x` is `string` rather than the literal keys
**Cause:** `x` is annotated with an index-signature type, which replaced the
inferred keys.
**Fix:** Use `satisfies` instead of the annotation.

**Symptom:** `keyof` a union has almost no members
**Cause:** It gives only the keys common to every member.
**Fix:** Narrow the union first; the operator is telling you what is actually
safe to access.

**Symptom:** `keyof (A & B)` has more keys than expected
**Cause:** That is the dual — an intersection has every key of both.
**Fix:** Nothing; this is the direction that matches intuition, unlike the union
case.

**Symptom:** A handler's payload is `any` in a registry pattern
**Cause:** The payload type is not expressed as an indexed access on the key
parameter.
**Fix:** `(payload: EventMap[K]) => void` with `K extends keyof EventMap`.

**Symptom:** `raw as keyof typeof obj` on a value from a query string
**Cause:** An assertion standing in for a check.
**Fix:** An `isKeyOf` type guard — `k in obj` returning `k is keyof T`.

**Symptom:** A key-taking helper accepts keys whose values are the wrong type
**Cause:** The constraint is `keyof T`, which says nothing about the values.
**Fix:** `KeysOfType<T, V>` — a mapped type filtered by a conditional.

## Interview questions

**★ What is `keyof typeof x` and why is it so common?**
`typeof x` lifts a *value* into the type world and `keyof` then reads its keys —
so an object literal becomes the single source of truth for a union of its keys.
Add a key and the union grows; remove one and every stale usage errors. Note
these are the *type* `typeof`, not JavaScript's.

**★ What is `keyof (A | B)`?**
The keys **common to both** — `keyof` a union gives the intersection of the keys,
and `keyof` an intersection gives the union of them. It follows from what is safe
to access: a value of `A | B` might be either, so only shared keys are readable;
a value of `A & B` is both, so everything is.

**★ How do you type an event emitter so the handler's payload follows the event
name?**
Keep a map type and index into it: `on<K extends keyof EventMap>(event: K,
handler: (payload: EventMap[K]) => void)`. `K` is fixed by the first argument, so
`EventMap[K]` resolves before the callback is checked and the payload is typed
without an annotation.

**How do you turn a `string` from outside into a key of an object?**
A type guard — `function isKeyOf<T extends object>(obj: T, k: PropertyKey): k is
keyof T { return k in obj }`. `in` narrows the object on its right, not the key
on its left, so the predicate is the only way to convince the compiler. An `as`
here is an unchecked claim about data you did not control.

**When should you *not* derive a union with `keyof typeof`?**
When the union is a published contract rather than a description of one table.
Deriving couples every consumer to that object's shape, so renaming a key becomes
a breaking change with no deprecation path. Derive for routes, event maps and
config; declare for contracts.

---

← Prev: [01 · What `keyof` produces](./01-what-keyof-produces.md) · Next → [05 · The `getProp` pattern](../05-getprop-pattern/README.md)
