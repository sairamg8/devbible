---
title: "Making an error recognisable"
sidebar_label: "02 · Making it recognisable"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 2.2 release notes** (*Support for
> `new.target`* — the ES5 downlevel prototype-chain break when extending
> built-ins, and the `Object.setPrototypeOf(this, new.target.prototype)`
> restoration, with the generated ES5 output quoted there) and the **TypeScript
> `lib` declarations shipped with the compiler**, where `ErrorOptions` carries
> `cause?: unknown` in **`lib.es2022.error.d.ts`**. **No sandbox, no console
> block.**

[Chunk 01](./01-proving-it-on-a-server.md) argued that identity checks degrade
in production. This chunk is the constructive half: **what an error class should
look like so that recognising it never depended on identity in the first
place.**

## Start with what a class buys you

```ts
export class NotFoundError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NotFoundError';
  }
}
```

Two lines of body, both earning their place:

- **`super(message, options)`** forwards `cause`. `ErrorOptions` is
  `{ cause?: unknown }` from `lib.es2022.error.d.ts`, and forwarding it is what
  makes wrapping possible at all ([chunk 03](./03-what-belongs-on-an-error.md)).
- **`this.name = 'NotFoundError'`** — without it, `name` is inherited as
  `'Error'` and every stack trace and log line says `Error:` regardless of which
  class you threw. **The class name is not automatically the `name` property.**

That is the baseline. It is also not yet enough.

## 🔴 The `setPrototypeOf` ritual — and when it is obsolete

Every tutorial on custom errors contains this line, and most do not say why:

```ts
Object.setPrototypeOf(this, new.target.prototype);
```

The reason is a **downlevel emit** problem, documented in the TypeScript 2.2
release notes: when class syntax is compiled to ES5, `super(message)` for a
built-in like `Error` **breaks the prototype chain**, because ES5's
`Error.call(this)` returns a fresh object rather than initialising `this`. The
notes are explicit that this affects extending `Error`, `Array` and `Map`, and
show the emitted helper restoring `__proto__` from `this.constructor`.

The visible symptom is precisely chunk 01's topic: `err instanceof NotFoundError`
returns `false` for an object you constructed one line earlier.

📌 **On a modern Node service this is dead code.** `module: nodenext` implies
`target: esnext`, class syntax is emitted as class syntax, `super` works, and
the prototype chain is intact. The ritual is a fossil of `target: es5` — which
[topic 01 chunk 03](../01-tsconfig-for-a-node-service/03-target-lib-and-types.md)
called the tell of a copied config.

⚠️ Two caveats before you delete it. It is still required if anything downlevels
your code to ES5 — an old bundler config, a library build targeting legacy
browsers — and it is harmless where it is not required. **Know why it is there
before removing it**: that is the difference between deleting dead code and
deleting a load-bearing line you did not understand.

## 🔴 The discriminant is the part that actually survives

Here is the move that makes the whole topic work:

```ts
export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(readonly resource: string, options?: ErrorOptions) {
    super(`${resource} not found`, options);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConflictError';
  }
}

export type AppError = NotFoundError | ConflictError;
```

`code` is a **literal-typed data property**, not an identity. That single
difference answers every failure mode in chunk 01's table:

| Failure | `instanceof` | `code` discriminant |
|---|---|---|
| Two copies of the package | ✗ | ✓ |
| Bundler duplicated the module | ✗ | ✓ |
| `vm` context / other realm | ✗ | ✓ |
| Serialised across a worker | ✗ | ✓ |
| Round-tripped through JSON | ✗ | ✓ |

**A string compares equal to a string everywhere.** That is the entire argument,
and it is why "the guard that survives bundling" is a data check rather than a
class check.

The guard is then structural, and returns your union:

```ts
const APP_ERROR_CODES = new Set(['NOT_FOUND', 'CONFLICT']);

export function isAppError(e: unknown): e is AppError {
  return typeof e === 'object' && e !== null
    && typeof (e as { code?: unknown }).code === 'string'
    && APP_ERROR_CODES.has((e as { code: string }).code);
}
```

⚠️ Note the `Set` membership test rather than a bare `typeof … === 'string'`.
Without it the guard claims `AppError` for **any** object with a string `code` —
including every `ENOENT` from the filesystem and every SQLSTATE from the database
driver, which is exactly the namespace collision chunk 01 warned about.

## And now exhaustiveness works

Because `AppError` is a discriminated union keyed on a literal, everything
[phase 2 · discriminated unions](../../phase-2-narrowing/05-discriminated-unions.md)
and [exhaustiveness](../../phase-2-narrowing/06-exhaustiveness.md) teach applies
unchanged:

```ts
function statusFor(e: AppError): number {
  switch (e.code) {
    case 'NOT_FOUND': return 404;
    case 'CONFLICT':  return 409;
    default: return assertNever(e);
  }
}
```

Add a third error class to the union and **the build fails at this switch** until
someone decides its status code. That is the property topic 13 is built on, and
it is unavailable to an `instanceof` chain, which degrades silently to the
`else` branch instead.

📌 The sentence worth carrying out of this chunk: **an error hierarchy is a
discriminated union that happens to extend `Error`.** The class gives you
`stack` and `cause`; the discriminant gives you the type system.

⚠️ The literal type is load-bearing and easy to lose. `readonly code = 'NOT_FOUND'`
on a class property infers the literal, but `code: string = 'NOT_FOUND'` — or a
base class declaring `readonly code: string` — widens it, and the switch silently
stops being exhaustive over anything. There is nothing to be exhaustive *over*
once the type is `string`.

## Gotchas

**Symptom:** every log line says `Error: …` regardless of which class threw.
**Cause:** `name` was never set; it is inherited as `'Error'` and is not derived
from the class name.
**Fix:** `this.name = 'NotFoundError'` in the constructor, or
`this.name = new.target.name` in a shared base.

**Symptom:** `instanceof` fails for an error you constructed one line earlier.
**Cause:** downlevel emit to ES5 broke the prototype chain in `super()`.
**Fix:** either stop targeting ES5 — correct on a Node service — or restore the
chain with `Object.setPrototypeOf(this, new.target.prototype)`.

**Symptom:** the error union's exhaustiveness check stopped failing when a new
error type was added.
**Cause:** either the new class was never added to the union, or the discriminant
is not a literal type — `code: string` rather than `'NOT_FOUND' as const`.
**Fix:** `as const` on every `code`, no widening annotation on a base class, and
every class in the union.

**Symptom:** a guard classifies a filesystem `ENOENT` as one of your application
errors.
**Cause:** the guard tests only that `code` is a string.
**Fix:** membership in a known set of your own codes.

**Symptom:** an error's `code` is right but a `switch` on it does not narrow.
**Cause:** the property is declared on a base class as `readonly code: string`,
so every subclass inherits the widened type.
**Fix:** declare the discriminant on each concrete class with its literal type,
or make the base generic over the code.

## Interview questions

**Why give an error class a `code` property when you already have the class?**
Because the class is an identity and the code is data. Identity fails across
duplicated modules, bundler copies, realms and any serialisation boundary; a
string compares equal everywhere. Making `code` a literal type also turns the
error hierarchy into a discriminated union, which brings exhaustiveness
checking — something an `instanceof` chain cannot provide, since it degrades to
the `else` branch silently.

**What is `Object.setPrototypeOf(this, new.target.prototype)` for, and do you
need it?**
It restores the prototype chain that ES5 downlevel emit breaks when a class
extends a built-in such as `Error` — the documented cause of `instanceof`
failing on a freshly constructed error. On a service targeting esnext (implied
by `module: nodenext`) it is unnecessary, because class syntax is emitted
directly. It is still required if anything downlevels the code to ES5.

**Why does `this.name = 'NotFoundError'` need writing at all?**
Because `name` is an inherited property whose value is `'Error'`, not something
derived from the class. Without setting it, the class is invisible in stack
traces and in any log line that formats `${err.name}: ${err.message}` — which is
most of them.

**Your exhaustive switch over the error union stopped catching new cases.
Diagnose.**
Almost certainly the discriminant widened to `string` — an explicit `: string`
annotation, or a base class declaring `readonly code: string` that the subclasses
inherit. A `switch` over `string` has infinitely many possible cases, so the
`default` branch is reachable and `assertNever` is never reached at compile time.

---

← [01 · Proving it on a server](./01-proving-it-on-a-server.md) · Next → [03 · What belongs on an error](./03-what-belongs-on-an-error.md)
