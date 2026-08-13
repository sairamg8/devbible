---
title: "Discriminated unions"
sidebar_label: "05 · Discriminated unions"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output from
> `sandbox/ts-p1/ex2-any-unknown-never-void.sh` and
> `sandbox/ts-p2/ex1-narrowing-basics.sh`.

**One literal-typed property shared by every member, and the compiler can tell
your variants apart from a plain `===`.** This is the highest-value pattern in
the language: it is how you make illegal states unrepresentable, and it is what
makes exhaustiveness checking possible.

## The shape

```ts
type State =
  | { status: 'loading' }
  | { status: 'ready'; data: string[] }
  | { status: 'error'; message: string };

function render(s: State) {
  switch (s.status) {
    case 'loading': return 'Loading…';
    case 'ready':   return s.data.join(', ');     // data exists here
    case 'error':   return s.message;             // message exists here
  }
}
```

Each branch is fully typed. `s.data` is unavailable in the `error` case — not
"possibly undefined", **unavailable**, because that variant does not have it.

## Compare with the shape people reach for first

```ts
// the version that causes the bugs
type State = {
  status: string;
  data?: string[];
  error?: string;
};
```

Three problems, all of which the union fixes:

1. **Illegal states are representable.** `{ status: 'ready', error: 'boom' }`
   type-checks. So does `{ status: 'typo' }`.
2. **Every access needs a non-null assertion or a check** — `s.data!.join()` —
   which is the compiler telling you the model is wrong.
3. **Nothing breaks when a variant is added**, so a new status silently falls
   through every consumer.

## What makes a discriminant work

The property must have a **literal type** in each member, and the members must
differ:

```ts
type A = { kind: 'a'; … };   // literal — works
type B = { kind: string; … }; // widened — does NOT discriminate
```

This is the widening rule from
[Phase 1](../phase-1-type-vocabulary/02-literal-types-and-as-const.md) doing real
work. A discriminant that arrives from an API and gets widened to `string`
narrows nothing — which is why you validate at the boundary and let the
validator produce the literal type
([Phase 9](../../syllabus/03-in-the-stack.md)).

Booleans work too, and read well for two-variant results:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

if (result.ok) result.data; else result.error;
```

## Naming the discriminant

`kind`, `type`, `status`, `ok`, `state` — all fine. Two constraints worth
respecting:

- **Be consistent across the codebase.** Mixing `kind` and `type` means every
  reader checks which one this union uses.
- **Avoid `type` if the objects cross a wire** where another system may attach
  meaning to it.

## Narrowing works with `if`, `switch` and destructuring

```ts
// if
if (s.status === 'ready') s.data;

// switch — preferred for three or more variants
switch (s.status) { case 'ready': return s.data; }

// destructuring the discriminant narrows the rest
const { status } = s;
if (status === 'ready') {
  s.data;   // ✅ narrowed — the compiler links `status` back to `s`
}
```

That last form works, but only when the discriminant is destructured from a
`const`; reassigning either variable breaks the link.

## Nested and composed unions

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number };

type Event =
  | { type: 'draw'; shape: Shape }
  | { type: 'clear' };

function area(e: Event): number {
  if (e.type === 'clear') return 0;
  const s = e.shape;                     // Shape
  return s.kind === 'circle'
    ? Math.PI * s.radius ** 2
    : s.width * s.height;
}
```

Discriminants compose — narrowing the outer union gives a fully-typed inner one.

## Where it pays off most

| Domain | Union |
|---|---|
| API responses | `{ ok: true; data } \| { ok: false; error }` |
| UI state | `loading \| ready \| error` |
| Reducer actions | `{ type: 'add'; item } \| { type: 'remove'; id }` |
| Parse results | `{ success: true; value } \| { success: false; issues }` |
| Domain events | one variant per event type |

The reducer case is where TypeScript most obviously pays for itself
([Phase 8](../../syllabus/03-in-the-stack.md)): the action union types both the
`dispatch` call and every `case` in the reducer from one declaration.

## The payoff: adding a variant breaks the right things

```ts
type Status = 'pending' | 'shipped' | 'cancelled';

function incomplete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {}
  else { const impossible: 1 = x; }
}
```

```console
src-ex2/exhaust.ts(13,16): error TS2322: Type '"cancelled"' is not assignable to type '1'.
```

**The error names the case you forgot.** Formalised with `assertNever` in
[06 · Exhaustiveness](./06-exhaustiveness.md).

## Trade-off

**A discriminated union** makes illegal states impossible, types every branch
precisely, and turns a new variant into a compile error at every site that must
change. It costs a property on every member and more verbose construction — you
must say `{ status: 'ready', data }` rather than just setting a field.

**Optional properties** are quicker to write and push the cost onto every reader,
forever.

## Gotchas

**Symptom:** Narrowing does not work on the discriminant
**Cause:** Its type widened to `string` — often from an object literal without
`as const`, or from unvalidated API data.
**Fix:** `as const`, `satisfies`, or a validator that produces the literal type.

**Symptom:** A property is `undefined` at runtime despite the type saying it
exists
**Cause:** The object was built to satisfy the union without a real discriminant
check — usually via `as`.
**Fix:** Construct through a factory per variant; ban `as` on union values.

**Symptom:** Adding a variant broke nothing
**Cause:** No exhaustiveness check, or a `default` branch that returns a
fallback.
**Fix:** `assertNever` in `default`.

**Symptom:** Destructuring lost the narrowing
**Cause:** The discriminant or the object was destructured into a `let`, or
reassigned.
**Fix:** Keep both as `const`, or narrow before destructuring.

**Symptom:** The union has grown to fifteen variants and the switches are
unreadable
**Cause:** One union is carrying two orthogonal decisions.
**Fix:** Split into two unions, or nest — an outer `kind` with an inner union.

## Interview questions

**★ What is a discriminated union and why is it the pattern to reach for?**
A union whose members share one property with a distinct **literal** type. It
lets the compiler narrow from a plain `===` or `switch`, makes each branch fully
typed, prevents illegal combinations from being representable, and enables
exhaustiveness checking so a new variant becomes a compile error everywhere it
matters.

**★ Why doesn't narrowing work when the discriminant is `string`?**
Narrowing on a literal comparison can only eliminate members whose literal type
differs. A widened `string` matches every member, so nothing is eliminated. This
is why data crossing a boundary must be validated into literal types rather than
asserted.

**★ How would you model an API result?**
`type Result<T> = { ok: true; data: T } | { ok: false; error: Error }` — one
check gives a fully-typed branch either way, and there is no state where both
`data` and `error` exist, which `{ ok: boolean; data?: T; error?: Error }`
happily allows.

**Does destructuring preserve narrowing?**
Yes, when both the object and the discriminant are `const` — the compiler links
the destructured discriminant back to the object. Reassigning either breaks it.

**When is a discriminated union the wrong tool?**
When the variants do not actually differ in shape — then it is ceremony around a
plain literal union. And when one union is encoding two independent decisions, at
which point it should be split or nested.

---

← Prev: [`instanceof` narrowing](./04-instanceof-narrowing.md) · Next → [Exhaustiveness with `never`](./06-exhaustiveness.md)
