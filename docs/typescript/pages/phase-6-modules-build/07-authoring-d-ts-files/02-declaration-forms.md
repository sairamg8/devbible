---
title: "The declaration forms, and the three spaces"
sidebar_label: "02 · Forms and the three spaces"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Declaration Files →
> Declaration Reference* (every "Documentation → Declaration" pair below is
> quoted from it) and *Declaration Files → Deep Dive* (the three declaration
> spaces and the conflict rule, quoted verbatim). Diagnostic text is read out of
> the installed **TypeScript 5.9.3** message table. **No sandbox, no console
> blocks.**

Chunk 01 established *what* a declaration file is. This one is the part you
actually reach for while writing one: **given a shape of JavaScript API, which
declaration describes it.** The theory behind *why* some of these can be combined
and others collide is [chunk 03](./03-the-three-spaces.md) — read this one to
write a file, that one to understand why it behaves as it does.

## The lookup table

The handbook's *Declaration Reference* is organised as pairs: here is how the
library is used, here is what you write. Collapsed into a table:

| The library has… | You write… | Handbook example |
|---|---|---|
| A global variable | `declare var` / `declare const` / `declare let` | `declare var foo: number;` |
| A global function | `declare function` | `declare function greet(greeting: string): void;` |
| A function with several signatures | repeated `declare function` | `declare function getWidget(n: number): Widget;`<br/>`declare function getWidget(s: string): Widget[];` |
| An object accessed with dots | `declare namespace` | `declare namespace myLib { … }` |
| A constructible thing | `declare class` | `declare class Greeter { constructor(g: string); … }` |
| A shape passed as an option bag | `interface` | `interface GreetingSettings { greeting: string; … }` |
| "any of these three things" | `type` | `type GreetingLike = string \| (() => string) \| MyGreeter;` |

The handbook states the two least obvious choices explicitly:

> Use `declare namespace` to describe types or values accessed by dotted
> notation.

> Use `declare class` to describe a class or class-like object. Classes can have
> properties and methods as well as a constructor.

And on variables, the distinction that most declaration files get wrong by
habit:

> Use `declare var` to declare variables. If the variable is read-only, you can
> use `declare const`. You can also use `declare let` if the variable is
> block-scoped.

⚠️ **`declare const` is a claim about the consumer, not about the library.** It
says *nobody may assign to this*, which is usually what you want for a global the
host injects. It does not stop the host from changing it.

## The four shapes worth writing out

### An object accessed with dots

```ts
// used as:  myLib.makeGreeting("hello, world");  myLib.numberOfGreetings
declare namespace myLib {
  function makeGreeting(s: string): string;
  let numberOfGreetings: number;
}
```

Note there is no `declare` on the members — the namespace already made them
ambient (`TS1038`, chunk 01). Namespaces nest, and can be declared in one line:

```ts
declare namespace GreetingLib.Options {
  // referred to as GreetingLib.Options.Log
  interface Log { verbose?: boolean }
  interface Alert { modal: boolean; title?: string; color?: string }
}
```

### Something you can `new`, and `extends`

```ts
declare class Greeter {
  constructor(greeting: string);
  greeting: string;
  showGreeting(): void;
}
```

🔴 **`declare class` is the only form that gives you both an instance type and a
constructor.** The near-miss that people write instead —

```ts
interface Greeter { greeting: string; showGreeting(): void }
declare const Greeter: Greeter;        // ❌ describes an object, not a class
```

— type-checks perfectly and then fails the first time a consumer writes
`new Greeter("hi")` or `class Special extends Greeter {}`. If the JavaScript has
a prototype people are meant to extend, say so with `declare class`.

The two-declaration form *is* correct when you want to describe a constructor
explicitly, and it is what you fall back to when the constructor's type is
unusual:

```ts
interface Greeter { greeting: string; showGreeting(): void }
interface GreeterConstructor {
  new (greeting: string): Greeter;
  readonly defaultGreeting: string;    // a static
}
declare const Greeter: GreeterConstructor;
```

That split — **instance type and static side as two separate types** — is the
same idea as
[Phase 4 · Static members and the static side](../../phase-4-classes-declarations/12-static-members-and-the-static-side.md).

### Several signatures

```ts
declare function getWidget(n: number): Widget;
declare function getWidget(s: string): Widget[];
```

Overload *ordering* is load-bearing and the handbook has a strict rule about it —
[chunk 11](./11-overloads-and-naming.md) covers it, along with the two cases
where an overload set should have been a union or an optional parameter instead.

### An option bag

```ts
interface GreetingSettings {
  greeting: string;
  duration?: number;
  color?: string;
}
declare function greet(setting: GreetingSettings): void;
```

Use an `interface` here rather than an inline object type: it is nameable by
consumers, it merges (so they can extend it), and it shows up by name in error
messages instead of being printed structurally.

## The forms you deliberately do not reach for

Two shapes are legal in a declaration file and almost always the wrong choice:

- **`enum`** — it creates a *value*, meaning a real runtime object the library
  must actually have. Declaring one for a library with no such object is a lie
  that type-checks. Use a union of literal types for a type-only concept.
- **An inline anonymous object type on an export** — `export const config: {
  retries: number; url: string }`. It works, but consumers cannot name it, cannot
  extend it, and see it printed structurally in every error message. Name it.

⚠️ **`declare const enum` is worse still across a package boundary**, because a
const enum's members are meant to be inlined at each use site — which requires
the consumer's compiler to have read the declaration and to agree to inline. That
is the kind of coupling a published `.d.ts` should not have.

## Gotchas

**Symptom:** A consumer writes `class X extends TheLib {}` and it fails.
**Cause:** The declaration used `declare const` plus an `interface`, which
describes an object, not a constructor.
**Fix:** `declare class` — the only form giving both an instance type and a
constructor. Or declare an explicit constructor interface with a `new` signature.

**Symptom:** `TS1038: A 'declare' modifier cannot be used in an already ambient
context.` inside a namespace.
**Cause:** The namespace already made its members ambient.
**Fix:** Drop the inner `declare`.

**Symptom:** Statics on a declared class are not visible to consumers.
**Cause:** They were declared on the instance side, or omitted.
**Fix:** Put them in a merged `declare namespace` of the same name, or use a
constructor interface with the statics on it.

**Symptom:** A callable export loses its properties when consumers use it.
**Cause:** It was declared as `declare const f: (x: number) => string`, which is
a function type with no properties.
**Fix:** `declare function` plus a merged `declare namespace` of the same name.

## Interview questions

**★ When would you use `declare namespace` rather than an `interface`?**
When the API is accessed with dotted notation and the dots are a real container
rather than an object shape — `myLib.makeGreeting(...)`, or a library grouping
its option types under a name. An `interface` describes a value's shape; a
`namespace` creates a container types can live inside.

**What is the difference between `declare class Foo` and
`declare const Foo: FooType`?**
The first creates both an instance type and a constructor value; the second
creates only a value of an existing type. Only the first supports `new Foo()` and
`extends Foo` from a consumer, which is usually the deciding question.

**How would you describe a class's static members in a declaration file?**
Either inside `declare class` with the `static` keyword, or by merging a
`declare namespace` of the same name — the namespace form is what you need for
nested *types* on the static side, since a class body cannot hold an `interface`.

---

← Prev: [01 · What a `.d.ts` is](./01-what-a-declaration-file-is.md) · Next → [03 · The three declaration spaces](./03-the-three-spaces.md)
