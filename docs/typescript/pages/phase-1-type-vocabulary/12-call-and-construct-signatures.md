---
title: "Call and construct signatures"
sidebar_label: "12 · Call and construct signatures"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output from
> `sandbox/ts-p1/ex5-functions.sh`.

**A function is an object that happens to be callable, and TypeScript lets you
say both parts.** Call signatures type the calling; construct signatures type
`new`; together they describe middleware with properties, factories, and "give me
the class, not an instance" parameters.

## Call signatures: a callable with properties

The arrow form cannot carry properties. The object form can:

```ts
type Formatter = (v: number) => string;              // callable only

interface Middleware {
  (req: Request, res: Response, next: NextFunction): void;   // call signature
  name: string;                                              // …and a property
  enabled: boolean;
}

const auth: Middleware = Object.assign(
  (req: Request, res: Response, next: NextFunction) => { next(); },
  { name: 'auth', enabled: true },
);

auth(req, res, next);
auth.name;
```

This is how Express middleware, memoised functions with a `.cache`, and
decorated handlers are typed. It is also why library types you read are full of
interfaces that look like objects but are called like functions.

Multiple call signatures in one type are **overloads**:

```ts
interface Parse {
  (input: string): string[];
  (input: string, limit: number): string[];
}
```

Resolution takes the first match in order, so the specific ones go first
([08 · Function types](./08-function-types.md) covers the declaration form and
the fact that the implementation signature is not callable).

## Construct signatures: typing the class itself

```ts
class Widget {
  constructor(public id: string) {}
}

type WidgetCtor = new (id: string) => Widget;

function build(Ctor: WidgetCtor, id: string): Widget {
  return new Ctor(id);
}

build(Widget, 'w-1');
```

`new (…) => T` describes a **constructor**, not an instance. The distinction
matters constantly:

```ts
declare function register(c: Widget): void;      // takes an instance
declare function register(c: typeof Widget): void; // takes the class
```

`typeof Widget` is the class's own type — its constructor plus its static
members. That is the idiom for "pass me the class".

For a generic factory:

```ts
function makeAll<T>(Ctor: new (id: string) => T, ids: string[]): T[] {
  return ids.map(id => new Ctor(id));
}
```

And for an abstract base you cannot instantiate:

```ts
type AbstractCtor<T> = abstract new (...args: any[]) => T;
```

`abstract new` accepts abstract classes, which a plain `new` signature rejects —
the signature you need when writing a mixin or a registry over base classes.

## The two sides of a class

Every class declaration creates **two** types:

| Expression | Type | Contains |
|---|---|---|
| `Widget` (as a type) | the instance type | instance properties and methods |
| `typeof Widget` | the static side | the constructor, plus `static` members |

```ts
class Repo {
  static create(): Repo { return new Repo(); }
  find(id: string) { … }
}

const r: Repo = new Repo();            // instance type
const R: typeof Repo = Repo;           // static side
R.create();
```

Getting these confused is the source of "Property 'create' does not exist on type
'Repo'" — the static lives on `typeof Repo`, not on an instance.

## Hybrid types

A type with a call signature, a construct signature and properties at once:

```ts
interface Counter {
  (start: number): string;        // callable
  interval: number;               // property
  reset(): void;                  // method
}
```

Rare in code you write, common in `.d.ts` files describing older JavaScript
libraries — jQuery's `$` is the canonical example. Worth recognising when reading
declarations ([Phase 6](../../syllabus/02-types-at-scale.md)).

## When to reach for these

| Need | Form |
|---|---|
| Plain callback or handler | `(a: A) => R` |
| Callable that also has properties | `interface` with a call signature |
| "Pass me the class" | `typeof MyClass` or `new (…) => T` |
| Generic factory | `<T>(Ctor: new (…args) => T) => T` |
| Accepts an abstract base | `abstract new (…args: any[]) => T` |
| Several argument shapes, different returns | Multiple call signatures |

## Trade-off

**The interface/call-signature form** expresses callables with properties and
overloads, which the arrow form cannot. It is more verbose and less obvious to
read — a type that looks like an object but is invoked.

**The arrow form** is immediately readable and covers the large majority of
cases. Use it until you actually need the other.

## Gotchas

**Symptom:** `Property 'x' does not exist on type '(…) => R'`
**Cause:** The arrow form describes only the call; properties need a call
signature inside an object type.
**Fix:** Declare an `interface` with a call signature and the property.

**Symptom:** `Type 'typeof Widget' is not assignable to type 'Widget'`
**Cause:** You passed the class where an instance was expected.
**Fix:** `new Widget(...)`, or change the parameter to `typeof Widget`.

**Symptom:** `Cannot assign an abstract constructor type to a non-abstract
constructor type`
**Cause:** A plain `new (…) => T` rejects abstract classes.
**Fix:** `abstract new (…args: any[]) => T`.

**Symptom:** A static member is invisible on an instance
**Cause:** Statics live on the static side, `typeof C`.
**Fix:** Call it on the class, or type the parameter as `typeof C`.

**Symptom:** `Object.assign` produced a type without the call signature
**Cause:** The inferred intersection can lose callability depending on the
argument order.
**Fix:** Annotate the target explicitly with the hybrid interface.

## Interview questions

**★ How do you type a function that also has properties?**
With a call signature inside an object type:
`interface M { (req, res, next): void; name: string }`. The arrow form
`(a: A) => R` describes only the call and cannot carry properties — which is why
library declarations for middleware and memoised functions use interfaces.

**★ What is the difference between `Widget` and `typeof Widget` as types?**
`Widget` is the instance type — the properties and methods an instance has.
`typeof Widget` is the class itself: its constructor signature plus its static
members. Pass `typeof Widget` when a function should receive the class and call
`new` on it.

**★ How do you write a generic factory that constructs a class?**
`function makeAll<T>(Ctor: new (id: string) => T, ids: string[]): T[]` — a
construct signature as the parameter type, with `T` inferred from it. Use
`abstract new (...args: any[]) => T` if abstract base classes must be accepted.

**What is a hybrid type?**
A type with both a call (or construct) signature and ordinary properties —
callable and object at once. Uncommon in new code, common in declaration files
describing pre-module JavaScript libraries.

**When are multiple call signatures preferable to a union parameter?**
When the *return* type depends on which argument shape was used. If the return
type is the same, a union parameter or an optional parameter is simpler and
participates in inference, which overloads do not.

---

← Prev: [Intersection types](./11-intersection-types.md) · Next → [`enum` vs union vs `const` object](./13-enum-vs-union.md)
