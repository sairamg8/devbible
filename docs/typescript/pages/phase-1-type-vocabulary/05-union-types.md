---
title: "Union types"
sidebar_label: "05 · Union types"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output from
> `sandbox/ts-p1/ex2-any-unknown-never-void.sh`.

**A union says "one of these". Until you prove which one, you may only touch what
every member has in common** — and that restriction is the feature, not an
obstacle.

## The shape

```ts
type Id = string | number;
type Status = 'pending' | 'shipped' | 'cancelled';
type Result = { ok: true; data: string } | { ok: false; error: Error };

function show(id: Id) {
  return id.toString();      // fine: both members have toString
}

function bad(id: Id) {
  return id.toUpperCase();   // error TS2339: Property 'toUpperCase' does not exist
                             // on type 'string | number'
}
```

The error names the union, not the branch. That is the compiler saying: *this is
sometimes a number, and numbers have no `toUpperCase`.*

## The common-members rule

A union's accessible members are the **intersection** of its branches' members:

```ts
type Cat = { name: string; meow(): void };
type Dog = { name: string; bark(): void };

function greet(pet: Cat | Dog) {
  pet.name;    // fine — both have it
  pet.meow();  // error: Property 'meow' does not exist on type 'Cat | Dog'
}
```

The fix is always narrowing — the whole of
[Phase 2](../../syllabus/01-type-system.md):

```ts
function greet(pet: Cat | Dog) {
  if ('meow' in pet) pet.meow();
  else pet.bark();
}
```

## Discriminated unions

Add a literal-typed field shared by every member and the compiler can tell them
apart from a simple `===`:

```ts
type Result =
  | { ok: true; data: string }
  | { ok: false; error: Error };

function handle(r: Result) {
  if (r.ok) {
    r.data;    // narrowed to the success branch
  } else {
    r.error;   // narrowed to the failure branch
  }
}
```

This is **the** modelling pattern of the language. Compare it with the shape
people reach for first:

```ts
// don't
type Result = { ok: boolean; data?: string; error?: Error };
```

That version permits `{ ok: true, error: new Error() }`, forces `data!` at every
use, and never tells you which combinations are real. The union makes the illegal
combinations unrepresentable.

## Exhaustiveness, measured

Once a union is discriminated, the compiler can prove you handled every case. The
mechanism is `never`: after the last check, the value has no possible type left.

```ts
type Status = 'pending' | 'shipped' | 'cancelled';

function complete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {} else if (x === 'cancelled') {}
  else { const impossible: 1 = x; }        // x is `never` here — assigns to anything
}

function incomplete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {}
  else { const impossible: 1 = x; }        // x is still 'cancelled'
}
```

```console
$ tsc --noEmit --strict src-ex2/exhaust.ts
src-ex2/exhaust.ts(13,16): error TS2322: Type '"cancelled"' is not assignable to type '1'.
exit=1
```

**The error names the case you forgot.** `complete` compiles silently because
`never` is assignable to everything; `incomplete` fails and says `"cancelled"`.

In real code the idiom is a helper rather than `const impossible: 1`:

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
}

function label(s: Status) {
  switch (s) {
    case 'pending':   return 'Awaiting dispatch';
    case 'shipped':   return 'On its way';
    case 'cancelled': return 'Cancelled';
    default:          return assertNever(s);
  }
}
```

Add a fourth status and this function fails to compile — **along with every other
place that must change**. That is the payoff, and it is the reason to prefer a
union of literals over a `string`.

## Unions of objects vs optional properties

| Model | Illegal states | Use when |
|---|---|---|
| `{ ok: true; data } \| { ok: false; error }` | impossible | The variants genuinely differ |
| `{ ok: boolean; data?; error? }` | representable | Never, if you can avoid it |

## Where unions come from without being written

```ts
const maybe = Math.random() > 0.5 ? 'yes' : null;   // string | null
const found = list.find(x => x.id === id);          // T | undefined
JSON.parse(text);                                    // any — the exception, and the problem
```

`strictNullChecks` is what makes the first two unions rather than lies
([Phase 0 · strict](../phase-0-how-typescript-runs/05-strict.md)).

## Trade-off

**Unions of literals** give exhaustiveness, autocompletion and typo errors. They
cost flexibility: every new variant touches every consumer — which is precisely
what you want for a domain that must stay consistent, and friction for a value
that is genuinely open-ended (a locale string, a free-text tag).

**A wider type** (`string`) is open and cheap, and gives you nothing.

## Gotchas

**Symptom:** `Property 'x' does not exist on type 'A | B'`
**Cause:** The member is not on every branch.
**Fix:** Narrow first — `in`, a discriminant, `typeof`, or a type guard.

**Symptom:** Adding a union member did not break anything
**Cause:** No exhaustiveness check; a `default` branch swallowed it.
**Fix:** `assertNever` in `default`. A `default` that returns a fallback is the
thing that hides new variants.

**Symptom:** `Type 'string' is not assignable to type 'Status'`
**Cause:** A widened literal ([02](./02-literal-types-and-as-const.md)).
**Fix:** `as const`, or `satisfies`.

**Symptom:** The union has a `?` field you must check everywhere
**Cause:** Optional properties standing in for variants.
**Fix:** Split into a discriminated union so each variant carries exactly its own
fields.

**Symptom:** A union of many object types produces enormous, unreadable errors
**Cause:** The compiler prints every branch it tried.
**Fix:** Add a discriminant field — it lets the compiler report one branch
instead of all of them.

## Interview questions

**★ Why can't you access a property that exists on only some union members?**
Because the value is one of them and the compiler does not yet know which. The
accessible members of a union are the ones common to every branch; anything else
requires narrowing to prove which branch you are in.

**★ What makes a union "discriminated", and why does it matter?**
A shared property with a distinct literal type in each member — `ok: true` /
`ok: false`, or `kind: 'circle'` / `kind: 'square'`. It lets the compiler narrow
from a plain `===` or `switch`, and it enables exhaustiveness checking.

**★ How do you make the compiler tell you when a new variant is added?**
Handle every case and pass the value to `assertNever(x: never)` in the default
branch. When all cases are handled the value is `never` and it compiles; when one
is missing, the error names it — measured here as
`Type '"cancelled"' is not assignable to type '1'`.

**Why prefer a discriminated union over an object with optional fields?**
The optional-field version can represent states that cannot happen —
`{ ok: true, error }` — and forces non-null assertions at every use. The union
makes illegal states unrepresentable and each branch fully typed.

**Where do unions appear without you writing one?**
`strictNullChecks` turns a possibly-missing result into `T | undefined`
(`Array.find`), a conditional expression unions its branches, and any
`| null`-returning API produces one. That is the type system reporting reality.

---

← Prev: [Object types](./04-object-types.md) · Next → [`any`, `unknown`, `never`, `void`](./06-any-unknown-never-void.md)
