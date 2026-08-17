---
title: "Mutation and variance"
sidebar_label: "04 · Mutation and variance"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build — `strictFunctionTypes` carries `strictFlag: true` and the
> description *"When assigning functions, check to ensure parameters and the
> return values are subtype compatible"* — and the **TypeScript handbook**, which
> documents that the check does **not** apply to parameters declared with method
> syntax. The method-bivariance case is the debt owed by
> [topic 01 chunk 03](../01-strict-flag-by-flag/03-the-other-eight.md).
> **No sandbox, no console block.**

The last two holes, and the only two that are neither opt-in nor closable by a
flag. Both come from the same source: **TypeScript checks types at assignment,
and mutation happens later.**

## Hole 7 · Mutation through an alias

### Array covariance

```ts
class Animal {}
class Dog extends Animal { fetch() {} }
class Cat extends Animal { meow() {} }

const dogs: Dog[] = [new Dog()];
const animals: Animal[] = dogs;      // legal — Dog[] is assignable to Animal[]

animals.push(new Cat());             // legal — a Cat is an Animal

dogs[1].fetch();                     // TypeError: dogs[1].fetch is not a function
```

Every line type-checks. `dogs` is declared `Dog[]`, contains a `Cat`, and nobody
wrote an assertion.

🔴 **The unsoundness is not the assignment — it is that the assignment creates
two names for one array with different opinions about it.** Reading through
`animals` is perfectly safe; it is the *write* that breaks the other alias's
promise.

**Why it is allowed:** `Dog[]` being assignable to `Animal[]` is what makes
`printAll(animals: Animal[])` accept a `Dog[]`, which is what nearly all code
does nearly all the time. The sound alternatives — making arrays immutable, or
adding variance annotations so `Array<T>` can be declared read-covariant and
write-invariant — were both available and both judged more expensive than the
bug.

### The same hole without arrays: aliasing away `readonly`

```ts
interface Frozen { readonly id: string }
interface Mutable { id: string }

const f: Frozen = { id: 'a' };
const m: Mutable = f;                // legal — structurally identical
m.id = 'b';                          // legal
f.id;                                // 'b'
```

**`readonly` is not part of assignability compatibility for properties.** Two
types differing only in `readonly` are mutually assignable, so the modifier can
be dropped by passing the value somewhere that does not declare it.

⚠️ **This surprises people who use `readonly` as a guarantee.** It is a guarantee
about *that reference*, not about the object. `Object.freeze` is the runtime
version and is the only one that survives an alias — at the cost of being a
runtime cost and a silent no-op on `#private` fields
([phase 4 · Access modifiers](../../phase-4-classes-declarations/02-access-modifiers/README.md)).

📌 **`readonly` arrays behave better**, and the contrast is instructive:
`readonly T[]` is *not* assignable to `T[]`, precisely because that direction
would hand out a mutable alias. Arrays got the stricter rule; properties did not.

### What to do about it

- **Prefer `readonly T[]` in parameters.** `function f(xs: readonly Dog[])` says
  "I will not mutate" and is enforced at the boundary. This closes the array case
  in the direction that matters, because the covariance bug needs a *write*.
- **Do not rely on `readonly` properties surviving a boundary.** Use them for
  intent within a module; use `Object.freeze` or a `#private` field where it must
  hold.
- **Prefer returning new objects to mutating shared ones**, which removes the
  second alias rather than trying to police it.

## Hole 8 · Method parameter bivariance

[Topic 01 chunk 03](../01-strict-flag-by-flag/03-the-other-eight.md) introduced
this and deferred the catalogue entry here. `strictFunctionTypes` — a real
`strict` flag, per its `strictFlag: true` record — makes function parameters
**contravariant**, so an unsafe callback assignment is rejected:

```ts
type Handler = (a: Animal) => void;
const dogHandler = (d: Dog) => d.fetch();

const h: Handler = dogHandler;       // error: a Cat may arrive
```

**And then it exempts methods:**

```ts
interface A { f(x: Dog): void }        // method syntax   → bivariant, unchecked
interface B { f: (x: Dog) => void }    // property syntax → contravariant, checked
```

```ts
interface AnimalHandler { handle(a: Animal): void }
const dogOnly: AnimalHandler = { handle(d: Dog) { d.fetch(); } };  // accepted
dogOnly.handle(new Cat());                                          // TypeError
```

🔴 **Same declaration, two spellings, two different levels of safety** — and the
unsafe one is the spelling most people reach for, because method syntax is what
you write in a class or an interface without thinking about it.

**Why it is allowed:** the same reason as array covariance, and in fact *for*
array covariance. `Array<Dog>` assignable to `Array<Animal>` requires
`Array<Dog>`'s methods — `push(item: Dog)`, `forEach(cb: (d: Dog) => void)` — to
be assignable to `Array<Animal>`'s, and under a contravariant rule they are not.
Making method parameters strict would break the standard library.

📌 **The practical rule is one line: if you want the check on a callback, declare
it as a property, not a method.** It costs nothing, it is a local decision, and
it is the only mitigation available since no flag governs it.

## Why these two are the ones to memorise

Of the seven holes:

- three are things **you write** (`any`, `as`, `!`) and are visible in a diff;
- two are **closable by a flag** (index access, object spread over optionals);
- `Object.keys` is a **consequence of structural typing** and is honest about it;
- **these two are neither.** Nobody opts into array covariance or method
  bivariance, no flag turns them off, and both produce a runtime `TypeError` from
  code where every line type-checks.

⚠️ **Both also share a failure signature worth recognising:** the crash happens
in a scope that never made a mistake. `dogs[1].fetch()` is correct code operating
on an array that was corrupted elsewhere; `dogOnly.handle(cat)` is a correct call
into a handler that lied about what it accepts. **When a `TypeError` occurs on a
line that reads as obviously right, an alias or a method signature is the first
place to look.**

## Gotchas

**Symptom:** an array typed `Dog[]` contains a `Cat` and no assertion exists.
**Cause:** it was assigned to an `Animal[]` alias and written through.
**Fix:** take `readonly Dog[]` in parameters. The bug requires a write, and
`readonly T[]` is not assignable to `T[]`.

**Symptom:** a `readonly` property was reassigned.
**Cause:** the object was passed to something typed without the modifier;
`readonly` does not affect property assignability.
**Fix:** `Object.freeze` for a runtime guarantee, or `#private` with an accessor.
`readonly` is intent within a module.

**Symptom:** `strictFunctionTypes` is on and an unsafe callback assignment is
still accepted.
**Cause:** the parameter is declared with **method** syntax, which stays
bivariant by design.
**Fix:** declare it as a property — `f: (x: Dog) => void`.

**Symptom:** switching an interface member from method to property syntax
produced a wave of new errors.
**Cause:** correct — the contravariant check is now running where it was exempt.
**Fix:** those errors are real. Each one is a callback accepting less than it
claims.

**Symptom:** `readonly T[]` is rejected where `T[]` is expected and it feels
inconsistent with `readonly` properties.
**Cause:** it is inconsistent, deliberately. Arrays got the stricter rule because
handing out a mutable alias to a read-only array is the whole bug.
**Fix:** none needed; it is the safer of the two behaviours.

**Symptom:** a `TypeError` on a line that is obviously correct.
**Cause:** typical of both holes on this page — the mistake was made through
another alias or another signature.
**Fix:** look for a second name for the same object, or a method-syntax callback
that narrowed its parameter.

## Interview questions

**Show an unsound program using only classes and arrays, no assertions.**
Assign a `Dog[]` to an `Animal[]` variable, `push` a `Cat` through the second
name, then call a `Dog` method on the first. Every line type-checks; the last one
throws. The assignment is legal because `Dog[]` is assignable to `Animal[]`, which
is what lets ordinary code pass subtype arrays to supertype parameters.

**Why was array covariance allowed?**
Because forbidding it would break the common case for the sake of the rare one.
The sound alternatives are immutable arrays or variance annotations, both of which
existed as options and both of which cost more than the bug in a language whose
job is typing existing JavaScript.

**How do you defend against it in practice?**
Take `readonly T[]` in parameters. The bug requires a *write* through the second
alias, and `readonly T[]` is not assignable to `T[]` — so the direction that
matters is closed at the boundary, with no runtime cost.

**Does `readonly` on a property guarantee immutability?**
No. Two types differing only in `readonly` are mutually assignable, so passing
the object somewhere that omits the modifier makes it writable, and the change is
visible through the original reference. `readonly` is a guarantee about that
reference; `Object.freeze` or a `#private` field is a guarantee about the object.

**Which strict flag has a deliberate exception, and why does the exception
exist?**
`strictFunctionTypes` makes parameters contravariant but exempts parameters
declared with **method** syntax, which stay bivariant. The exemption exists
because `Array<Dog>` must remain assignable to `Array<Animal>`, and that requires
`push(item: Dog)` to be assignable to `push(item: Animal)` — which a
contravariant rule forbids. Making methods strict would break the standard
library.

**What is the mitigation for method bivariance?**
Declare the callback as a property rather than a method — `f: (x: Dog) => void`
instead of `f(x: Dog): void`. There is no flag; it is a local declaration choice,
and it is free.

**Which of the seven holes would you tell a new team member to memorise?**
These two. The other five are either things you write and can grep for, or
defaults a flag turns off, or an honest consequence of structural typing. Array
covariance and method bivariance are the only ones nobody opts into, no
configuration removes, and both produce a runtime failure on a line where every
type is correct.

---

← [03 · The holes in your data](./03-the-holes-in-your-data.md) · Next → [05 · Working with the holes](./05-working-with-the-holes.md)
