---
title: "`null` and `undefined`"
sidebar_label: "10 · null and undefined"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**, where `strict` (and therefore
> `strictNullChecks`) defaults to `true`. Errors from
> `sandbox/ts-p1/ex2-any-unknown-never-void.sh` and `ex4-strict.sh`
> (Phase 0 sandbox).

**Without `strictNullChecks`, `null` and `undefined` belong to every type and
your `| null` annotations are decoration. With it, they are ordinary union
members you must narrow.** Everything else on this page follows from that.

## What the flag changes

```ts
function findUser(id: number): { name: string } | null {
  return id === 1 ? { name: 'Asha' } : null;
}

const user = findUser(1);
console.log(user.name.toUpperCase());
```

```console
$ tsc --noEmit --strict src-ex4/loose.ts
src-ex4/loose.ts(6,13): error TS18047: 'user' is possibly 'null'.
```

With `--strict false`, that file compiles silently and crashes at runtime. The
flag is what makes the return type mean anything
([Phase 0 · strict](../phase-0-how-typescript-runs/05-strict.md)).

## Which one to use

They are different types, and JavaScript uses both for different reasons:

| | Comes from | Use it for |
|---|---|---|
| `undefined` | A missing property, an unset variable, a function with no return, a missing argument | "not provided" |
| `null` | An explicit "no value" — often a database column or a JSON payload | "deliberately empty" |

**A defensible house rule:** produce `undefined` from your own code, accept
`null` from the outside world (JSON, SQL), and normalise at the boundary so only
one of them travels inward. Two ways for a value to be absent is one too many.

What you cannot do is ignore the distinction — `JSON.stringify` drops
`undefined` properties and keeps `null`, so the choice survives to your API
responses ([Phase 9](../../syllabus/03-in-the-stack.md)).

## Narrowing

```ts
const user = findUser(1);

if (user === null) return;
user.name;              // narrowed

if (user != null) {     // != catches BOTH null and undefined
  user.name;
}

if (user) {             // truthiness: also excludes '' and 0
  user.name;
}
```

`!= null` is the one legitimate use of loose equality in TypeScript: it excludes
`null` and `undefined` and nothing else. Truthiness is fine for objects and a
trap for `string` and `number` — `if (count)` skips `0`.

## `?.` and `??`

```ts
const city = order?.address?.city;             // undefined if any link is missing
const shipping = order.shipping ?? 0;          // 0 only when null/undefined
const wrong = order.shipping || 0;             // 0 also when shipping is 0
```

`?.` short-circuits the whole chain to `undefined` — **not to `null`**, even when
the missing link was `null`. So the result of an optional chain is always
`T | undefined`.

`??` falls back only on `null`/`undefined`; `||` falls back on every falsy value,
which is the classic bug when `0` or `''` is legitimate data.

Optional call and index forms exist too:

```ts
callback?.();
list?.[0];
```

## Optional properties vs `| undefined`

```ts
type A = { retries?: number };
type B = { retries: number | undefined };

const a: A = {};                       // fine
const b: B = {};                       // error: Property 'retries' is missing
const b2: B = { retries: undefined };  // fine
```

`?` means the key may be absent; `| undefined` means the key must be present and
may hold `undefined`. Use `?` normally, and the union when you want callers to
make an explicit decision. `exactOptionalPropertyTypes` sharpens this further
([Phase 10](../../syllabus/04-rigour-and-tooling.md)).

## The non-null assertion `!`

```ts
const el = document.getElementById('root')!;   // "trust me, it exists"
el.append('hi');
```

`!` removes `null`/`undefined` from a type with no check whatsoever. It is
[`as`](../../syllabus/01-type-system.md) in miniature: a claim, not a proof.

**Legitimate uses are narrow** — a value the compiler cannot see is initialised
(a field set in `beforeEach`, an element the framework guarantees), and even
there a real check is usually better:

```ts
const el = document.getElementById('root');
if (!el) throw new Error('#root missing');     // fails loudly, at the right place
el.append('hi');
```

The version with `!` fails later, somewhere else, with
`Cannot read properties of null`. **Every `!` is a decision to lose the stack
trace's connection to the actual cause.**

## Where narrowing silently disappears

Measured on 7.0.2 — and the result is narrower than the folklore:

```ts
async function afterAwait() {
  if (order.shippedAt !== null) {
    await save(order);
    order.shippedAt.getTime();     // ✅ compiles — narrowing SURVIVES the await
  }
}

function inCallback() {
  if (order.shippedAt !== null) {
    order.items.forEach(() => {
      order.shippedAt.getTime();   // ❌ error
    });
  }
}
```

```console
$ tsc --noEmit --strict src-ex2/loss.ts
src-ex2/loss.ts(15,7): error TS18047: 'order.shippedAt' is possibly 'null'.
```

**One error, and it is the callback — not the `await`.** The compiler keeps the
narrowing across an `await` in the same function body, because control flow is
still linear there. It gives up inside a **callback**, which could be stored and
invoked later, long after the property changed.

Copying into a `const` fixes the callback case:

```ts
const shippedAt = order.shippedAt;
if (shippedAt !== null) {
  order.items.forEach(() => shippedAt.getTime());   // fine — a const cannot be reassigned
}
```

This is the most common "but I checked it" complaint, and the fix is always the
same. More in [Phase 2](../../syllabus/01-type-system.md).

## Trade-off

**`strictNullChecks`** finds a large class of real crashes and costs a narrowing
step at every optional value — which is the work the crash was made of.

**Turning it off** on a legacy codebase makes the errors disappear and the bugs
remain. The migration path is per-directory adoption, not a global `false`
([Phase 11](../../syllabus/04-rigour-and-tooling.md)).

## Gotchas

**Symptom:** `'x' is possibly 'null'` (`TS18047`) inside a callback, after you
checked it outside
**Cause:** Narrowing of a mutable property does not survive into a function body
the compiler cannot prove runs immediately. (Measured: it **does** survive an
`await` in the same function.)
**Fix:** Copy to a `const` before the check.

**Symptom:** A `0` or `''` was replaced by a default
**Cause:** `||` falls back on all falsy values.
**Fix:** `??`.

**Symptom:** An optional chain returned `undefined` where you expected `null`
**Cause:** `?.` always short-circuits to `undefined`.
**Fix:** Normalise at the boundary, or check for both with `!= null`.

**Symptom:** `Cannot read properties of null` in production despite a green build
**Cause:** A `!` assertion, or data that arrived unvalidated.
**Fix:** Replace the assertion with a real check; validate at the boundary.

**Symptom:** A JSON response lost its optional fields
**Cause:** `JSON.stringify` drops `undefined` properties but keeps `null`.
**Fix:** Decide which one your API contract uses and normalise before serialising.

## Interview questions

**★ What does `strictNullChecks` actually change?**
Without it, `null` and `undefined` are members of every type, so `| null` is
decoration and `user.name` on a possibly-null value compiles. With it they are
ordinary union members, so the same line is `TS18047: 'user' is possibly 'null'`
until you narrow. It is the flag that gives every other type its meaning.

**★ When is `||` wrong and `??` right?**
`||` falls back on every falsy value, so a legitimate `0`, `''` or `false` gets
replaced. `??` falls back only on `null` and `undefined`. Defaults for numeric or
string settings are where this bug lives.

**★ Where does a null check on a property stop working?**
Inside a **callback**. Measured on 7.0.2, the narrowing survives an `await` in
the same function body — control flow is still linear — but is discarded inside
a `forEach` callback, which could run later, after the property changed. Copying
the value into a `const` first keeps it, because a `const` cannot be reassigned.

**When is the `!` assertion acceptable?**
When you genuinely know something the compiler cannot — a field initialised by a
test hook or a framework — and even then an explicit throw is better, because it
fails at the real cause instead of producing
`Cannot read properties of null` somewhere downstream.

**Should your code produce `null` or `undefined`?**
Pick one and normalise the other at the boundary. `undefined` for "not provided"
matches how JavaScript itself behaves; `null` usually arrives from JSON or SQL.
It matters beyond style because `JSON.stringify` drops `undefined` and keeps
`null`.

---

← Prev: [Structural typing](./09-structural-typing.md) · Next → [Intersection types](./11-intersection-types.md)
