---
title: "The unsafe shape"
sidebar_label: "02 · The unsafe shape"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Functions → Guidelines
> for Writing Good Generic Functions*, *Type Manipulation → Generics*) for the
> inference rules this chunk relies on. **No console block** — no sandbox run
> covers this phase.

[Chunk 01](./01-the-rule-and-the-guidelines.md) covered parameters that are
merely useless. This one is about the shape that is **actively unsafe**, and it
is the single most common bad generic in application code.

## `getJson<T>` — an unchecked `as` in angle brackets

```ts
declare function getJson<T>(url: string): Promise<T>;

const user = await getJson<User>('/api/me');   // user: User
```

`T` appears exactly once, in the **return** position. Nothing in the arguments
can determine it, so there is no inference to perform — the caller simply
*states* what the result will be, and the compiler agrees.

Compare what the caller could have written instead:

```ts
const user = (await getJson('/api/me')) as User;   // identical safety
```

These two are the same operation. The first looks like typed code and the second
looks like an assertion, which is why the first survives review and the second
gets questioned. **The angle brackets are doing the work of an `as`, with none of
the visual warning.**

## Why the compiler cannot help

From [topic 10](../10-inference-sites-and-contextual-typing.md): inference runs
from **arguments**. With no inference site, a type parameter falls back to
`unknown`, or to whatever a contextual type supplies. Here the contextual type is
supplied by the caller's own explicit type argument — so the "check" is the
caller checking their own claim against itself.

Nothing validated anything. If the endpoint returns
`{ error: 'unauthorized' }`, the program now holds a value typed `User` that is
not one. The failure surfaces later and elsewhere — at `user.name.trim()`, three
layers away, as a `TypeError` on `undefined`. That distance between cause and
symptom is what makes this shape expensive rather than merely wrong.

⚠️ **It is worse than a plain `as`**, for a reason worth spelling out: `as` at
least appears at the point of doubt, and `as unknown as User` announces that the
author knew. `getJson<User>(…)` is written by people who believe they are getting
a checked result, and it is written *everywhere*, because it is what the
signature invites.

## What to write instead

### Option 1 — return the truth

```ts
declare function getJson(url: string): Promise<unknown>;
```

No type parameter at all, because there is nothing to relate. The caller now has
`unknown` and **must** narrow it before use — which is exactly the phase-2
narrowing machinery doing its job. Honest, and it makes the missing validation
visible at every call site rather than hiding it.

The objection is real: it is more work at every call. That is the *point* — the
work was always required and was previously being skipped.

### Option 2 — take a validator

```ts
declare function getJson<T>(
  url: string,
  parse: (raw: unknown) => T,
): Promise<T>;
```

Now `T` appears **twice** — in the `parse` argument and in the return — and it is
**inferred** from `parse` rather than asserted by the caller. Something checks at
runtime, and the type follows from that check instead of preceding it.

```ts
const user = await getJson('/api/me', parseUser);
//    ^ inferred from parseUser's return type; no type argument written
```

Note the call site got *shorter*, not longer. The caller no longer writes
`<User>` because there is nothing left to guess — the same reassurance they
thought they had before, now earned.

This generalises to whatever validation you already use — a schema's `parse`
method, a hand-written type guard, a decoder. **Phase 9 (Types at the boundary)**
is where this becomes the design of an entire layer rather than one signature.

## The general rule this is an instance of

> **A type parameter that appears only in the return position is a promise the
> caller makes to themselves.**

Watch for the shape rather than the specific function. It recurs constantly:

```ts
declare function parse<T>(json: string): T;
declare function readConfig<T>(path: string): T;
declare function fromCache<T>(key: string): T | undefined;
declare function rpc<T>(method: string, params: unknown): Promise<T>;
declare function query<T>(sql: string): Promise<T[]>;
```

Every one of these is an `as` with better manners, and every one is fixed the
same two ways: return `unknown`, or accept something that does the checking.

⚠️ **`query<T>(sql)` deserves a specific note**, because ORM and driver APIs are
full of it and it is genuinely hard to do better — the shape of a row is decided
by a SQL string the type system cannot read. That does not make it safe; it makes
it a place to know you are trusting yourself. Treat the type argument as
documentation, and validate at the edge of the module rather than pretending the
boundary is typed.

## The counter-case: when the return position is fine

A parameter in the return position is only a problem when it is the parameter's
**only** position:

```ts
// fine — T is in the argument AND the return
declare function first<T>(items: readonly T[]): T | undefined;

// fine — T relates the input to the output through a mapping
declare function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T) => U,
): Record<string, U>;
```

In both, the return type is *computed* from something the caller actually passed.
That is a generic doing its job, and it is what makes the difference legible: ask
whether the compiler could work the type out if the caller wrote no type
arguments at all. If yes, it is inference. If no, it is an assertion.

---

← [01 · The rule and the guidelines](./01-the-rule-and-the-guidelines.md) · Next → [03 · Dismantling an over-generic API](./03-dismantling-an-over-generic-api.md)
