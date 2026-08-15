---
title: "The `typeof` type operator"
sidebar_label: "07 · `typeof` type operator"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Typeof Type Operator*). `TS2749` — *"'{0}' refers to a value, but is being used
> as a type here. Did you mean 'typeof {0}'?"* — and `TS2693` — *"'{0}' only
> refers to a type, but is being used as a value here."* — were read out of the
> **compiler's own diagnostic table**, as were the `InstanceType` and
> `ConstructorParameters` declarations from `lib.es5.d.ts`. ⚠️ Install
> inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No
> console block** — no sandbox run covers this phase.

TypeScript has **two `typeof` operators**. They share a spelling and have nothing
whatsoever to do with each other.

```ts
const user = { id: '1', name: 'Ada' };

const kind = typeof user;      // runs, produces the string 'object'
type U = typeof user;          // erased, produces { id: string; name: string }
```

**Which one you get is decided by position, not by syntax.** In an expression
position it is JavaScript's runtime operator, one of the six results from
[Phase 2 · topic 01](../phase-2-narrowing/01-typeof-narrowing.md). In a **type
position** it is a *type query*: it lifts a value into the type world and gives
you its type.

Everything on this page is the second one.

## Two errors mark the boundary

The compiler is unusually helpful about the confusion, in both directions:

```ts
const config = { retries: 3 };
function f(c: config) { }        // using a VALUE as a type
```

```text
error TS2749: 'config' refers to a value, but is being used as a type here.
Did you mean 'typeof config'?
```

```ts
type Config = { retries: number };
const c = Config;                // using a TYPE as a value
```

```text
error TS2693: 'Config' only refers to a type, but is being used as a value here.
```

**TS2749 is the one you will hit, and its suggested fix is the whole feature.**
If you remember one thing: when a name is a value and you need its type, put
`typeof` in front of it.

## What you may query

A type query takes an **identifier or a property access** — not an arbitrary
expression:

```ts
type A = typeof user;              // ✅
type B = typeof config.retries;    // ✅ property access
type C = typeof arr[0];            // ⚠️ parses as typeof (arr[0]) — see below
type D = typeof getUser();         // ❌ not a call
type E = typeof (a + b);           // ❌ not an expression
```

The restriction exists because a type query must be resolvable **without running
anything**. `getUser()` has no answer until the program runs, so the operator
cannot apply. When you want the type a call *would* return, that is
`ReturnType<typeof getUser>` — the function is the identifier, and `ReturnType`
does the rest.

## 🔴 On a class, `typeof` gives the *static* side

This trips people up more than any other case:

```ts
class Service {
  static version = '1.0';
  constructor(public url: string) {}
  connect() {}
}

type Instance = Service;            // { url: string; connect(): void }
type Ctor = typeof Service;         // { new (url: string): Service; version: string }
```

**A class declaration creates two things**: a *type* (the instance shape) and a
*value* (the constructor function). `Service` names the first, `typeof Service`
names the second.

That distinction is what lets you type a factory parameter:

```ts
function create(Ctor: typeof Service): Service {
  return new Ctor('http://…');
}

function make<T>(Ctor: new (...args: never[]) => T): T { … }
```

That second form is the generic escape from "you cannot write `new T()`"
([topic 01](./01-generic-functions-and-inference/README.md)) — the type flows
from a real runtime value, because there is no other mechanism.

And it is why `static` members appear on `typeof Service` but not on `Service` —
statics live on the constructor, exactly as they do at runtime.

The library pair for going back the other way, read from `lib.es5.d.ts`:

```ts
type InstanceType<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: any) => infer R ? R : any;

type ConstructorParameters<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: infer P) => any ? P : never;
```

So `InstanceType<typeof Service>` is `Service`, which matters when all you have
is the constructor type.

## The combinations that earn their keep

**`keyof typeof`** — the most common form in real code, covered in
[topic 04](./04-keyof/02-keyof-in-practice.md):

```ts
const routes = { home: '/', search: '/search' } satisfies Record<string, string>;
type RouteName = keyof typeof routes;      // 'home' | 'search'
```

**`(typeof arr)[number]`** — a runtime list and its union from one declaration
([topic 06](./06-indexed-access-types.md)):

```ts
const LEVELS = ['debug', 'info', 'warn'] as const;
type Level = (typeof LEVELS)[number];      // 'debug' | 'info' | 'warn'
```

⚠️ **The parentheses matter.** `typeof LEVELS[number]` parses as
`typeof (LEVELS[number])` — a query on an element rather than an index into the
array's type. It sometimes produces the same answer by accident, which is worse
than failing.

**`ReturnType<typeof f>` and friends** — deriving from a function you did not
write:

```ts
type User = Awaited<ReturnType<typeof fetchUser>>;
type Args = Parameters<typeof fetchUser>;
```

**`typeof import('./config')`** — the shape of a module without importing it as a
value:

```ts
type ConfigModule = typeof import('./config');
```

Useful in declaration files and for typing a dynamic `import()`.

## `as const`, `satisfies` and `typeof` are one toolchain

They are separate features that are almost always used together, and it is worth
seeing them in one place:

```ts
const THEME = {
  primary: '#0055ff',
  spacing: [4, 8, 16],
} as const satisfies Record<string, unknown>;

type Theme = typeof THEME;
type ThemeKey = keyof typeof THEME;              // 'primary' | 'spacing'
type Spacing = (typeof THEME)['spacing'][number]; // 4 | 8 | 16
```

- **`as const`** stops the widening, so the literals survive
  ([Phase 1 · topic 02](../phase-1-type-vocabulary/02-literal-types-and-as-const.md)).
- **`satisfies`** checks the object without replacing its inferred type
  ([Phase 2 · topic 10](../phase-2-narrowing/10-satisfies/README.md)).
- **`typeof`** lifts the result into the type world.

Drop any one and it degrades: without `as const` the literals widen; without
`satisfies` nothing is checked; with an *annotation* instead of `satisfies`, the
annotation replaces the inferred type and `typeof` gives you back the annotation
rather than the data.

## Value-first or type-first

`typeof` makes the **value** the source of truth. That is a design decision with
a real trade-off, not a free win.

**Value-first** — write the object, derive the type. One definition, no drift,
and the runtime data is available for iteration and validation. The cost is that
every consumer is coupled to that object's shape, a rename is a silent breaking
change with no deprecation path, and the derived type's name says how it was
computed rather than what it means.

**Type-first** — declare the type, then write values that conform. The contract
is independent of any implementation and reads clearly, at the cost of two
definitions that can disagree — which `satisfies` mitigates but does not remove.

Reach for value-first when the data genuinely is the definition: routes, config
tables, theme tokens, event maps. Reach for type-first for published contracts
and for anything with more than one implementation.

## Gotchas

**Symptom:** `TS2749: '{x}' refers to a value, but is being used as a type here`
**Cause:** A value's name used in a type position.
**Fix:** `typeof x`. The diagnostic says so.

**Symptom:** `TS2693: '{X}' only refers to a type, but is being used as a value`
**Cause:** The mirror image — a type used where a value belongs, often an
`import type` that should have been a plain import.
**Fix:** Import the value, or restructure so the type is not needed at runtime.

**Symptom:** `typeof getUser()` will not compile
**Cause:** A type query takes an identifier or property access, never a call.
**Fix:** `ReturnType<typeof getUser>`.

**Symptom:** `typeof arr[number]` gives an odd result
**Cause:** It parses as `typeof (arr[number])`.
**Fix:** `(typeof arr)[number]`.

**Symptom:** `static` members are missing from a class type
**Cause:** They live on the constructor — `typeof Service` — not on the instance
type `Service`.
**Fix:** Query the class: `typeof Service`, or `InstanceType<typeof Service>` to
go back.

**Symptom:** `keyof typeof x` is `string` rather than the literal keys
**Cause:** `x` carries an index-signature annotation, which replaced the inferred
keys.
**Fix:** `satisfies` instead of the annotation.

## Interview questions

**★ What is the difference between the two `typeof` operators?**
Position decides. In an expression position it is JavaScript's runtime operator
returning a string like `'object'`. In a type position it is a *type query*: it
is erased, and it lifts a value into the type world to give you its type. They
share nothing but a spelling.

**★ What does `typeof SomeClass` give you?**
The **constructor** type — the static side, including `static` members and the
`new` signature. The bare name `SomeClass` is the *instance* type. That is why a
factory parameter is typed `typeof Service`, and why `InstanceType<typeof
Service>` exists to go back the other way.

**★ Why can't you write `typeof getUser()`?**
Because a type query has to be resolvable without running anything, and a call
has no answer until runtime. The operator accepts an identifier or a property
access only. For the type a call would produce, use `ReturnType<typeof getUser>`.

**Why are the parentheses needed in `(typeof arr)[number]`?**
Without them it parses as `typeof (arr[number])` — a query on an element rather
than an index into the array's type. It occasionally gives the same answer by
coincidence, which makes the mistake harder to spot than an outright error.

**When should you derive a type with `typeof` rather than declare it?**
When the value genuinely is the definition — routes, config tables, theme tokens,
event maps — so there is one source of truth and no drift. Declare it instead
when it is a published contract or has more than one implementation, since
deriving couples every consumer to one object's shape and makes a rename a silent
breaking change.

---

← Prev: [06 · Indexed access types](./06-indexed-access-types.md) · Next → [08 · Default type parameters](./08-default-type-parameters.md)
