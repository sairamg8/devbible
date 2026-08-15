---
title: "Parameter properties"
sidebar_label: "03 · Parameter properties"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Classes → Parameter
> Properties*, *Initialization Order*, *strictPropertyInitialization*) — the
> `Params` example and the four-step initialization order are quoted verbatim —
> and the **TypeScript 5.8 release notes** for `erasableSyntaxOnly`. Error codes
> and their exact `{0}`-templated text are read out of the **compiler's own
> diagnostic table** (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2
> this corpus targets). **No console block** — the runtime failure is captured
> from a real run in
> [Phase 0 · 04](../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md);
> nothing is reproduced from memory here.

Every topic so far in this phase has been type-level. This one is the exception,
and that is the whole point of it: **parameter properties are the one class
feature in common use that emits code.** Everything interesting about them
follows from that.

## What they are

The handbook:

> TypeScript offers special syntax for turning a constructor parameter into a
> class property with the same name and value. These are called *parameter
> properties* and are created by prefixing a constructor argument with one of the
> visibility modifiers `public`, `private`, `protected`, or `readonly`. The
> resulting field gets those modifier(s):

```ts
class Params {
  constructor(
    public readonly x: number,
    protected y: number,
    private z: number
  ) {
    // No body necessary
  }
}

const a = new Params(1, 2, 3);
console.log(a.x);   // (property) Params.x: number
console.log(a.z);   // TS2341: Property 'z' is private and only accessible within class 'Params'.
```

Note *"No body necessary"* — that is the appeal. The longhand is three
declarations and three assignments for the same result.

**A modifier is what makes it a property.** A bare `constructor(x: number)` is an
ordinary parameter and creates no field. Adding any one of the four is the whole
trigger — and `readonly` alone counts, which is how you get a public readonly
field without writing `public`.

## 🔴 They emit code, and that is the whole story

Erasing a type annotation is a deletion. Erasing a parameter property is not —
the assignment has to be *inserted*:

```ts
// you write
class OrderService {
  constructor(private readonly repo: OrderRepo) {}
}

// the compiler emits, roughly
class OrderService {
  constructor(repo) {
    this.repo = repo;      // ← this line did not exist in your source
  }
}
```

[Phase 0 · 02 · Erasure](../phase-0-how-typescript-runs/02-erasure.md) is where
that boundary is drawn in general; parameter properties and `enum` are the two
constructs that cross it in everyday code.

The consequences are practical, not philosophical:

- **Node's type stripping refuses them.** Running `.ts` directly in strip-only
  mode fails, and the runtime names the construct exactly.
  [Phase 0 · 04](../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md)
  has the real captured error and the conversion patterns — it is not repeated
  here.
- **`erasableSyntaxOnly` (TypeScript 5.8) flags them at compile time**, so you
  find out from `tsc` rather than from a crash:
  > **TS1294:** *"This syntax is not allowed when 'erasableSyntaxOnly' is
  > enabled."*

  Turning that flag on is the cheap way to keep a codebase runnable by
  strip-only tooling. It is also a one-way door for a codebase that leans on the
  syntax — expect a large first diff.
- **Bundlers and transpilers must support them.** Anything doing a true
  TypeScript compile is fine; anything doing a strip is not.

## Initialization order

Worth knowing precisely, because a parameter property is assigned **in the
constructor**, not where a field initializer runs. The handbook states the
JavaScript order:

> * The base class fields are initialized
> * The base class constructor runs
> * The derived class fields are initialized
> * The derived class constructor runs

So a field initializer in the same class **cannot read a parameter property** —
the field runs first. This is the shape that produces:

> **TS2729:** *"Property '{0}' is used before its initialization."*

```ts
class Bad {
  private prefix = this.config.prefix;        // ← runs before the constructor
  constructor(private config: Config) {}
}
```

The fix is to move the derived value into the constructor body, where the
parameter property already exists.

⚠️ **And one flag changes the base-class picture.** The handbook: *"When `target
>= ES2022` or `useDefineForClassFields` is `true`, class fields are initialized
after the parent class constructor completes, overwriting any value set by the
parent class."* A base constructor that assigns to something a derived class also
declares as a field will have that assignment overwritten. It is a real
behavioural difference between targets, and it is worth checking the emitted
output rather than reasoning about it when a value mysteriously reverts.

## `readonly` here means the same as anywhere

`private readonly repo: OrderRepo` gives a field assignable only within the
constructor. Attempting otherwise:

> **TS2540:** *"Cannot assign to '{0}' because it is a read-only property."*

Combining `readonly` with a visibility modifier is one of the genuine reasons to
prefer `private` over `#` from
[topic 02](./02-access-modifiers/README.md) — **`#` fields cannot take an
accessibility modifier, and there is no `#` parameter property at all.** If you
want the shorthand, you are choosing soft privacy along with it.

## Why teams adopt them

Dependency injection, overwhelmingly. In NestJS, Angular and any constructor-
injected design, the constructor *is* the dependency list, and the longhand
triples its size:

```ts
// with parameter properties
constructor(
  private readonly orders: OrderRepo,
  private readonly payments: PaymentGateway,
  private readonly logger: Logger,
) {}
```

Six lines instead of eighteen, with no opportunity to typo an assignment or
forget one. In that setting the feature genuinely earns its place, and those
frameworks compile properly rather than stripping, so the portability cost does
not apply.

## Why others avoid them

- **Portability.** The strip-only story above. A library that wants to be
  consumable by the widest range of tooling avoids emitting syntax.
- **The field list stops being visible.** Reading a class, you expect its state
  at the top. Parameter properties move it into the signature, mixed in with
  ordinary parameters, distinguished only by a modifier keyword.
- **`strictPropertyInitialization` never applies to them.** The check exists to
  catch a field with no initializer and no constructor assignment
  (`TS2564: Property '{0}' has no initializer and is not definitely assigned in
  the constructor.`). A parameter property is always assigned, so the safety net
  is irrelevant here — fine, but do not read it as evidence the class is fully
  initialized.

## Trade-off

**Parameter properties** remove real boilerplate and a real class of mistakes,
and in a DI-heavy codebase they are the difference between a readable
constructor and a wall. They cost portability — the file can no longer be run by
type-stripping tooling — and they hide the class's state in the signature.

**Explicit fields** keep the class's state where a reader looks for it and keep
every file strip-compatible. They cost three lines per dependency and an
assignment you can forget.

The line worth holding: **use them where a framework already dictates a
constructor-injection style and compiles properly; avoid them in a library, and
in any codebase that wants `node file.ts` to work.** Set `erasableSyntaxOnly` if
the second is a goal, so the decision is enforced rather than remembered.

## Gotchas

**Symptom:** `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]` running a `.ts`
file directly
**Cause:** A parameter property cannot be stripped — the assignment has to be
inserted.
**Fix:** Convert to an explicit field and a constructor assignment. Patterns in
[Phase 0 · 04](../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md).

**Symptom:** `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is
enabled.`
**Cause:** The flag is on and the file uses a parameter property (or an `enum`,
or a namespace with a value).
**Fix:** Convert it. That is the flag doing its job.

**Symptom:** A constructor parameter did not become a property
**Cause:** No modifier. A bare parameter is just a parameter.
**Fix:** Add `private`, `public`, `protected` or `readonly` — any one is enough.

**Symptom:** `TS2729: Property 'x' is used before its initialization.`
**Cause:** A field initializer read a parameter property; fields initialize
before the constructor body runs.
**Fix:** Compute the derived value inside the constructor.

**Symptom:** A value set by a base constructor is `undefined` in the subclass
**Cause:** With `target >= ES2022` or `useDefineForClassFields`, derived class
fields initialize *after* the parent constructor and overwrite what it set.
**Fix:** Do not redeclare the field in the subclass, or assign in the derived
constructor instead.

**Symptom:** You want a `#` parameter property
**Cause:** There is no such thing; `#` fields take no accessibility modifier.
**Fix:** Declare `#x` explicitly and assign it in the constructor body.

**Symptom:** `TS2540: Cannot assign to 'repo' because it is a read-only
property.`
**Cause:** `readonly` on a parameter property behaves like `readonly` anywhere —
constructor-only assignment.
**Fix:** Assign it once, from the constructor, or drop `readonly`.

## Interview questions

**★ What is a parameter property?**
Constructor-parameter shorthand that declares and assigns a field in one place,
triggered by prefixing the parameter with `public`, `private`, `protected` or
`readonly`. The field gets those modifiers. Without a modifier it is an ordinary
parameter and no field is created.

**★ Why does Node refuse to run a file that uses one?**
Because they **emit code**. Erasing a type annotation is a deletion; a parameter
property has to *insert* `this.x = x` into the constructor, which is a transform.
Strip-only mode deletes and never transforms, so it rejects the syntax rather
than guessing — and `erasableSyntaxOnly` (5.8) surfaces the same constraint at
compile time as `TS1294`.

**★ Can a field initializer use a parameter property?**
No. JavaScript initializes the class's fields before the constructor body runs,
and a parameter property is assigned in the constructor — so the field would read
it too early. The compiler reports `TS2729: Property 'x' is used before its
initialization.` Move the derived value into the constructor.

**Is there a `#private` version?**
No. `#` fields cannot take an accessibility modifier and there is no `#`
parameter-property form. If you want the shorthand you are choosing TypeScript's
soft `private`; if you want hard privacy you write the field and the assignment
out.

**When would you avoid them?**
In a library, or in any codebase that wants `node file.ts` to work — both want
erasable-only syntax. Also when a class has enough state that hiding it in the
constructor signature costs more readability than the boilerplate did. In a
DI-framework codebase that compiles properly, they are usually the right call.

---

← Prev: [02 · Access modifiers](./02-access-modifiers/README.md) · Next → **04 · `implements` vs `extends`** *(not written yet)*
