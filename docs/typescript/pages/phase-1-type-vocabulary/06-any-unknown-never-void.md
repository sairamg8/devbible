---
title: "`any`, `unknown`, `never` and `void`"
sidebar_label: "06 · any, unknown, never, void"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Every error below is literal
> compiler output from `sandbox/ts-p1/ex2-any-unknown-never-void.sh`.

**Four types that people mix up, doing four unrelated jobs.** `any` switches the
checker off, `unknown` switches it on hardest, `never` means "cannot happen", and
`void` means "ignore my return value".

## The measurement

```ts
declare const a: any;
declare const u: unknown;

a.whatever.deeply.nested();      // 1
const n1: number = a;            // 2

u.toUpperCase();                 // 3
const n2: number = u;            // 4

if (typeof u === 'string') {
  u.toUpperCase();               // 5
}

function fail(msg: string): never { throw new Error(msg); }
const nv: never = fail('x');
const s: string = fail('x');     // 6

function log(): void { }
const v = log();
const bad: number = v;           // 7
```

```console
$ tsc --noEmit --strict src-ex2/four.ts
src-ex2/four.ts(7,1):  error TS18046: 'u' is of type 'unknown'.
src-ex2/four.ts(8,7):  error TS2322: Type 'unknown' is not assignable to type 'number'.
src-ex2/four.ts(22,7): error TS2322: Type 'void' is not assignable to type 'number'.
exit=1
```

Three errors from seven suspicious lines. **Lines 1 and 2 — the `any` ones —
produced nothing at all.** That is the whole argument against `any` in one
result: the two most dangerous lines in the file are the two the compiler had
nothing to say about.

## `any` — checking off

```ts
declare const a: any;
a.whatever.deeply.nested();   // silent
const n: number = a;          // silent
```

`any` is assignable **to** everything and everything is assignable **to** it.
Every property access, call and index on it is allowed and produces `any`.

The problem is that it spreads. One `any` at a boundary flows into a variable,
which is passed to a function, whose return type is inferred as `any`, and a
whole call chain loses its types with no error anywhere. `JSON.parse` returns
`any`; so does an untyped dependency ([Phase 0 · TS7016](../phase-0-how-typescript-runs/08-where-types-come-from.md)).

**Legitimate uses are rare:** genuinely dynamic internals of a library, a
migration in progress ([Phase 11](../../syllabus/04-rigour-and-tooling.md)), or a
type-level workaround with a comment explaining why. Anywhere else, reach for
`unknown`.

## `unknown` — checking on

```ts
declare const u: unknown;
u.toUpperCase();          // TS18046: 'u' is of type 'unknown'
const n: number = u;      // TS2322: Type 'unknown' is not assignable to type 'number'

if (typeof u === 'string') {
  u.toUpperCase();        // fine
}
```

Everything is assignable **to** `unknown`; `unknown` is assignable to **nothing**
(except `unknown` and `any`). You may hold it, pass it, and store it — you may not
*use* it until you prove what it is.

That makes it the correct type for every input you did not create:

```ts
async function loadOrder(id: string): Promise<Order> {
  const res = await fetch(`/orders/${id}`);
  const data: unknown = await res.json();   // NOT any
  return orderSchema.parse(data);           // prove it, then it is an Order
}
```

**The one-line policy that keeps a codebase honest:** `unknown` at the door,
never `any` ([Phase 9](../../syllabus/03-in-the-stack.md)).

`catch` is the built-in example — `useUnknownInCatchVariables` (part of `strict`)
types the caught value `unknown`, because JavaScript can throw anything:

```ts
try { risky(); }
catch (err) {
  if (err instanceof Error) console.error(err.message);
  else console.error('threw a non-Error:', err);
}
```

## `never` — cannot happen

`never` is the empty type: no value has it. It appears in three places.

**1. A function that never returns normally:**

```ts
function fail(msg: string): never { throw new Error(msg); }
function loop(): never { while (true) {} }
```

**2. As the assignable-to-everything type.** Because there are no values of type
`never`, assigning one to anything is vacuously safe:

```ts
const s: string = fail('x');   // no error
```

**3. As the result of narrowing everything away** — which is what makes
exhaustiveness checks work ([05 · Union types](./05-union-types.md)):

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
}
```

An unexpected `never` in an error message usually means **the compiler proved a
branch is unreachable** — often because a discriminant was narrowed away earlier
than you thought, or two intersected types have no overlap.

## `void` — return value not meant to be used

```ts
function log(): void { }
const v = log();
const bad: number = v;   // TS2322: Type 'void' is not assignable to type 'number'
```

`void` is not `undefined` and not `never`. A `void` function *does* return
(`undefined` at runtime); `void` says the value is not part of the contract.

The one behaviour worth memorising — **a function returning something is
assignable to a `void`-returning parameter type**:

```ts
type Handler = () => void;
const h: Handler = () => 42;   // fine — the extra return value is ignored
```

This is deliberate, and it is why `arr.forEach(x => list.push(x))` compiles even
though `push` returns a number. It is also the trap behind
`useEffect(() => fetchData())` in React: the arrow returns a promise, `void`
accepts it, and React sees a returned value where it expects a cleanup function.

## The four in one table

| | Assignable **to** it | Assignable **from** it | Means |
|---|---|---|---|
| `any` | everything | everything | stop checking |
| `unknown` | everything | nothing | prove it first |
| `never` | nothing | everything | cannot happen |
| `void` | `undefined` (and `null` without `strictNullChecks`) | nothing useful | return ignored |

## Trade-off

**`unknown` over `any`** costs a narrowing step at every boundary — a type guard,
a schema parse, an `instanceof`. That step is the work `any` skips and the bug
`any` ships.

**`any` in a migration** is a legitimate tool for keeping a codebase compiling
while it moves. The discipline is to make it visible: a named `type Todo = any`
alias, or a lint rule counting occurrences, rather than an invisible spread.

## Gotchas

**Symptom:** A whole call chain lost its types with no error
**Cause:** One `any` at the top; inference propagated it.
**Fix:** Find the entry point — usually `JSON.parse`, an untyped dependency, or a
cast — and make it `unknown` plus validation.

**Symptom:** `'x' is of type 'unknown'` (`TS18046`)
**Cause:** Working as designed — you must narrow first.
**Fix:** `typeof`, `instanceof`, a type predicate, or a schema parse.

**Symptom:** `Type 'unknown' is not assignable to type 'X'`
**Cause:** Trying to assign around the check.
**Fix:** Narrow, or validate. `as X` silences it and re-creates the `any` problem
with extra steps.

**Symptom:** A type resolves to `never` unexpectedly
**Cause:** Everything was narrowed away, or an intersection has no overlap
(`string & number`).
**Fix:** Read backwards for the check that eliminated the last branch.

**Symptom:** `useEffect` complains about a returned promise
**Cause:** `void` accepts any return value, so an `async` arrow slips through and
React receives a promise instead of a cleanup function.
**Fix:** Wrap the call in a block body: `useEffect(() => { void load(); }, [])`.

**Symptom:** `Type 'void' is not assignable to type 'number'`
**Cause:** Using the result of a function that declares it has none.
**Fix:** Give the function a real return type if the value matters.

## Interview questions

**★ What is the difference between `any` and `unknown`?**
Both accept any value. `any` then allows every operation and assigns to every
type — it turns checking off and spreads through inference. `unknown` allows
nothing until you narrow it, so it forces a check at the boundary. Measured: the
two `any` lines produced no diagnostics at all, while the two `unknown` lines
produced `TS18046` and `TS2322`.

**★ When does `never` show up in real code?**
As the return type of a function that always throws or never terminates; as the
type of a value after every union member has been narrowed away — which is how
`assertNever` gives exhaustiveness checking; and as an empty intersection like
`string & number`.

**★ Why can a function returning a value be assigned to a `() => void` type?**
Because `void` means the caller ignores the result, not that there is none. It is
what lets `forEach(x => arr.push(x))` compile. The cost is that an `async`
function slips into a `void` slot unnoticed, which is the React `useEffect`
cleanup bug.

**What should `JSON.parse` return, and what does it return?**
It should return `unknown`; it returns `any`, which is one of the most common
entry points for untyped data. Assign it to an `unknown` and validate before use.

**Is `void` the same as `undefined`?**
No. `undefined` is a type with one value; `void` describes a return position
whose value is not part of the contract. `let x: void = undefined` is legal, but
`void` is not usable as a general-purpose value type.

---

← Prev: [Union types](./05-union-types.md) · Next → [`type` vs `interface`](./07-type-vs-interface.md)
