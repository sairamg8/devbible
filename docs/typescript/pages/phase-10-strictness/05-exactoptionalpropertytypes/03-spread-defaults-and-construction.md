---
title: "Spread, defaults and construction"
sidebar_label: "03 · Spread and defaults"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **ECMAScript specification's** object spread and
> `Object.assign` semantics (both copy own enumerable properties, including ones
> whose value is `undefined`), the **TypeScript handbook** on object spread
> typing, and the **compiler's diagnostic table** for `TS2375` / `TS2379` /
> `TS2412`. `Partial` is read from `lib.es5.d.ts` in the installed **5.9.3**
> build. **No sandbox, no console block.**

Almost every error this flag produces is at an **object construction site**, and
the great majority of those are one of four patterns. Learn the four and the
migration stops being mysterious.

> **Object spread copies keys, not values-that-are-defined.** A property whose
> value is `undefined` is still a key, so it still overwrites — and that single
> fact is the most common way a "default" silently fails to apply.

## The defaults bug, which is the reason the flag exists

```ts
interface Options { timeout?: number; retries?: number }
const defaults = { timeout: 5000, retries: 3 };

function connect(opts: Options) {
  const config = { ...defaults, ...opts };
  setTimeout(fn, config.timeout);      // config.timeout: number
}
```

Read the type and this is airtight: `config.timeout` is `number`, because
`defaults` supplies one and `opts.timeout` is optional. Read the runtime and it
is not:

```ts
connect({ timeout: undefined });       // config.timeout === undefined
```

`{ timeout: undefined }` has a `timeout` key. The spread copies it. The default
is overwritten with `undefined`, `setTimeout` receives `undefined`, and the type
system said `number` the entire way down.

🔴 **This is a genuine soundness hole, and the flag closes it.** With
`exactOptionalPropertyTypes` on, `connect({ timeout: undefined })` is `TS2379`
at the call site — the argument no longer satisfies `Options`. The compiler can
then trust that an optional property never holds an explicit `undefined`, which
is what makes the spread's result type honest.

📌 **Say that back the other way, because it is the strongest argument for the
flag:** without it, TypeScript's type for object spread is *wrong* in a way
nothing else can detect. The flag is not pedantry bolted onto spread; spread is
the feature that needed it.

## The four patterns that error, and their fixes

### 1 · Passing a possibly-`undefined` value into an optional property

```ts
declare const maybeName: string | undefined;
const u: User = { id: 'a', name: maybeName };     // TS2375
```

The value's type includes `undefined`; the target's no longer does.

**Fix — conditional spread**, which is the idiom this flag pushes you toward:

```ts
const u: User = {
  id: 'a',
  ...(maybeName !== undefined && { name: maybeName }),
};
```

Spreading `false` contributes nothing, so the key is genuinely absent when the
value is. TypeScript types this correctly and it needs no helper.

**Fix — narrow first**, when the branch is doing other work anyway:

```ts
const u: User = maybeName === undefined
  ? { id: 'a' }
  : { id: 'a', name: maybeName };
```

**Fix — accept the state**, when explicit `undefined` really is meaningful:

```ts
interface User { id: string; name?: string | undefined }
```

⚠️ Reach for the third only when you can say what explicit `undefined` *means*
that absence does not. If you cannot, it is the compiler's suggestion applied
mechanically — [chunk 01](./01-absent-versus-undefined.md) on why that undoes
the flag.

### 2 · Spreading a wider object into a narrower one

```ts
function update(patch: Partial<User>) {
  return { ...current, ...patch };
}
update({ name: undefined });                       // TS2379
```

`Partial<T>` is `{ [P in keyof T]?: T[P] }` — it produces **optional**
properties, so under this flag `Partial<User>` no longer accepts
`{ name: undefined }` either. That is usually what you want, and it is also the
single largest source of errors in a migration, because `Partial` is everywhere.

**Fix — the caller stops passing `undefined`.** Usually the caller is doing
`{ name: form.name }` where `form.name` is optional, which is pattern 1 again.

**Fix — strip `undefined` at the seam** when the caller is out of your control:

```ts
function defined<T extends object>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as T;
}
update(defined(fromSomewhereElse));
```

🔴 **That `as T` is a lie and should be treated as one.** `Object.fromEntries`
returns `{ [k: string]: unknown }` and no amount of generics recovers the shape,
so this helper is an assertion with a runtime justification — the exact thing
[topic 12](../README.md) asks you to write a comment for. It is the right tool at
a boundary you do not own and the wrong tool anywhere inside it.

### 3 · Building an object across branches

```ts
const q: Query = { table: 'users' };
if (limit) q.limit = limit;            // TS2412 if limit is number | undefined
```

**Fix — assign only when defined**, which the `if` already nearly does:

```ts
if (limit !== undefined) q.limit = limit;
```

📌 **`if (limit)` and `if (limit !== undefined)` are not the same check**, and
the flag has a habit of surfacing that. `limit = 0` is falsy and legitimate; the
truthiness test silently drops it. This is a real bug the migration finds for
free, and it is worth counting how often it appears — it is a good argument for
the flag's value when someone asks.

### 4 · `Object.assign`, which behaves exactly like spread

```ts
Object.assign(config, { timeout: undefined });   // overwrites at runtime
```

`Object.assign` copies own enumerable properties, `undefined` values included —
identical semantics to spread, and identical consequences. Its `.d.ts` signature
is permissive enough that the flag catches less here than it does for spread, so
this pattern deserves a manual look during a migration.

## What destructuring defaults do — and do not — fix

```ts
function connect({ timeout = 5000 }: Options) { … }
```

A destructuring default fires when the value is `undefined`, **whether the
property was absent or explicitly `undefined`**. So this form is immune to the
defaults bug and always was:

```ts
connect({});                       // timeout = 5000
connect({ timeout: undefined });   // timeout = 5000  ← spread would not do this
```

📌 **That asymmetry is worth internalising.** Destructuring defaults are
value-based and safe; spread and `Object.assign` are key-based and are not. If a
codebase applies defaults by destructuring rather than by spreading, it never had
the bug this flag prevents — and the flag will still be worth enabling, for the
API-boundary reasons in [chunk 02](./02-the-json-boundary.md), just with a
smaller payoff.

The same value-based logic applies to `??`:

```ts
const timeout = opts.timeout ?? 5000;   // safe either way
const timeout = opts.timeout || 5000;   // drops 0
```

## Gotchas

**Symptom:** a default is not applied even though the caller passed no value.
**Cause:** the caller passed `{ key: undefined }` — a present key — and the
spread overwrote the default.
**Fix:** the flag rejects the call site; failing that, apply defaults by
destructuring or `??`, which are value-based.

**Symptom:** `TS2379` at a call site that "obviously" passes the right shape.
**Cause:** one property's value type includes `undefined`. The plural *"target's
properties"* wording is the marker.
**Fix:** conditional spread, or narrow before constructing.

**Symptom:** enabling the flag produced hundreds of errors on `Partial<T>`.
**Cause:** `Partial` produces optional properties, so it is now exact too. This
is the intended behaviour and usually the largest single bucket.
**Fix:** work outward from the constructors that feed those calls; most resolve
to one conditional spread each.

**Symptom:** the conditional-spread idiom is rejected as "not assignable".
**Cause:** spreading a boolean union where the false branch is not `false` but
something else falsy — `...(x && { k: x })` with `x: string` spreads `''`.
**Fix:** compare explicitly: `...(x !== undefined && { k: x })`.

**Symptom:** a numeric option of `0` stopped working after the migration.
**Cause:** you replaced an error with `if (limit)` rather than
`if (limit !== undefined)`.
**Fix:** compare against `undefined`. The flag did not cause this bug — it
exposed the site and the truthiness fix reintroduced it.

**Symptom:** a helper that strips `undefined` keys does not narrow the type.
**Cause:** `Object.fromEntries` returns an index-signature type; the shape is
unrecoverable and the helper needs an assertion.
**Fix:** keep the assertion, confine the helper to one boundary module, and
document why it is sound there.

**Symptom:** `Object.assign` still clobbers with `undefined` and no error is
reported.
**Cause:** its declared signature is permissive; the flag catches assignability,
not this overload's laxity.
**Fix:** prefer spread, which the compiler types precisely, and audit remaining
`Object.assign` calls by hand during the migration.

**Symptom:** a class field initialised from an optional constructor parameter
errors.
**Cause:** the parameter is `T | undefined` and the field is declared optional.
**Fix:** either declare the field `T | undefined` (required, explicit), or assign
it conditionally in the constructor body.

## Interview questions

**Show the bug `exactOptionalPropertyTypes` prevents in a defaults merge.**
`{ ...defaults, ...opts }` where `opts` is `{ timeout?: number }`. If a caller
passes `{ timeout: undefined }`, the key exists, the spread copies it, and the
default is overwritten with `undefined` — while the result type says `number`.
The flag rejects the call site, which is what makes the spread's type honest.

**Why is this a soundness argument rather than a style argument?**
Because without the flag, TypeScript's type for the spread result is provably
wrong at runtime and nothing else in the language can detect it. The type says
`number`, the value is `undefined`. The flag removes the state that makes the
inference wrong, rather than adding a check on top of it.

**What is the conditional-spread idiom and why does it work?**
`...(x !== undefined && { key: x })`. Spreading `false` contributes no
properties, so the key is genuinely absent when the value is undefined rather
than present-and-undefined. The compiler types it correctly with no helper and
no assertion.

**Why does `Partial<T>` produce so many errors under this flag?**
Because `Partial` is defined as `{ [P in keyof T]?: T[P] }` — it makes every
property optional, and under this flag optional means exact. Every caller that
was passing `{ field: undefined }` into a `Partial` parameter now fails, and
`Partial` appears in most update and patch signatures.

**Do destructuring defaults have the same problem as spread?**
No, and the contrast is the useful part. A destructuring default fires whenever
the value is `undefined`, so it handles both absent and explicitly-undefined
identically and never had the bug. Spread and `Object.assign` are key-based, so
they do. A codebase that applies defaults by destructuring gains less from this
flag — though it still gains the API-boundary correctness.

**A migration replaced `q.limit = limit` errors with `if (limit) q.limit =
limit`. What is wrong with that?**
It drops `limit = 0`, which is a valid value. The correct guard is
`limit !== undefined`. This is worth watching for during a migration, because
the truthiness fix is the fastest way to make the error go away and it quietly
introduces a new bug in the process.

**When is `field?: T | undefined` the right answer rather than a cop-out?**
When explicit `undefined` carries a meaning that absence does not — a
deliberately-passed "no opinion" in an options object, or a shape you do not
control that constructs such objects. If you cannot articulate the difference in
one sentence, it is the compiler's suggestion applied mechanically and it puts
you back where you started.

---

← [02 · The JSON boundary](./02-the-json-boundary.md) · Next → [04 · Living with it](./04-living-with-it.md)
