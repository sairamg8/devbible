---
title: "Living with it"
sidebar_label: "04 · Living with it"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **`lib.es5.d.ts`** in the installed **TypeScript
> 5.9.3** build — `Partial<T> = { [P in keyof T]?: T[P] }`,
> `Required<T> = { [P in keyof T]-?: T[P] }`, `Pick<T, K> = { [P in K]: T[P] }`,
> read rather than recalled — the **compiler's diagnostic table** for `TS2790`
> (*"The operand of a `'delete'` operator must be optional."*), and the
> **`tsconfig` reference** for `skipLibCheck`'s documented scope.
> **No sandbox, no console block.**

The flag is correct. Whether to turn it on today is a separate question, and it
has an honest answer that is not always yes.

> **Most of the errors this flag produces are imprecise types, not bugs.** A
> minority are genuine data bugs, and they are the ones worth the migration.
> Counting which is which, on your codebase, is the decision — not the principle.

## What it does to the utility types

Optionality is a **modifier**, and homomorphic mapped types preserve modifiers.
So the standard utilities change meaning under this flag without changing a
character of their definitions:

| Utility | Definition | Under the flag |
|---|---|---|
| `Partial<T>` | `{ [P in keyof T]?: T[P] }` | every property becomes **exactly** optional — rejects `{ k: undefined }` |
| `Required<T>` | `{ [P in keyof T]-?: T[P] }` | `-?` strips optionality **and** `undefined` from the property type |
| `Pick<T, K>` | `{ [P in K]: T[P] }` | homomorphic over `keyof T`, so `?` is carried through |
| `Omit<T, K>` | `Pick<T, Exclude<keyof T, K>>` | same — optionality survives |
| `Readonly<T>` | `{ readonly [P in keyof T]: T[P] }` | unaffected; a different modifier |

🔴 **`Required<T>` collapses a distinction the flag just created.** Both
`{ a?: string }` and `{ a?: string | undefined }` become `{ a: string }`,
because `-?` removes the optionality marker and the `undefined` along with it.
That is usually what you want, but it means `Required` is **not** the inverse of
`Partial` under this flag in the way it appears to be — the round trip
`Required<Partial<T>>` erases information about which properties were ever
allowed to hold an explicit `undefined`.

📌 **`Partial<T>` is where the errors are.** It is in almost every update, patch,
options and props signature, and every one of those call sites now rejects an
explicitly-`undefined` value. Expect this to be the largest single bucket in the
error list, and expect most of it to resolve to the conditional-spread idiom from
[chunk 03](./03-spread-defaults-and-construction.md).

## `delete` and the optionality it requires

```ts
interface A { x?: number }
interface B { x: number | undefined }

declare const a: A, b: B;
delete a.x;      // fine — the property is optional
delete b.x;      // TS2790: The operand of a 'delete' operator must be optional.
```

This rule predates the flag and is not part of it, but the two interact in a way
worth naming: **`delete` is the only operation that produces the "absent" state
after construction**, and it requires `?`. So a codebase that responded to the
flag by converting everything to `field: T | undefined` has also, quietly, made
those fields undeletable.

That is a reasonable trade if nothing deletes them. It is a bad surprise if
something does, and the error arrives in a different file from the change that
caused it.

## Third-party declarations you cannot fix

This is the objection that actually stops teams, so it deserves a precise answer.

A library declares `options?: Config`. Its `.d.ts` was written without this flag
in mind, and internally it constructs `{ options: undefined }` all day. You
enable the flag. What breaks?

- **Your calls into it** break, if you pass an explicitly-`undefined` value. That
  is your code and you can fix it.
- **Its own internals** do not break, because they are not type-checked as part
  of your program — only its `.d.ts` is.
- **Objects it hands back** may carry explicitly-`undefined` properties at
  runtime while its `.d.ts` declares them optional. The flag cannot detect this,
  and it is a real residual risk.

⚠️ **`skipLibCheck` does not help here and is often reached for anyway.** It
skips type checking *inside* declaration files. Assignability at **your** call
site is checked regardless — that is your code, not a `.d.ts`. If someone
proposes `skipLibCheck` as the fix for an `exactOptionalPropertyTypes` error,
the diagnosis is wrong. (`skipLibCheck` has real uses; they are in
[phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)
for correctness and in **phase 12 · Tooling, performance and testing** *(not
written yet)* for build time.)

The workable pattern is a **boundary module**: one file that maps the library's
shapes into yours, absorbs the difference, and is allowed the assertion that the
rest of the codebase is not.

## Where it fights you hardest

Three environments where the cost is real rather than theoretical:

- **JSX prop spreading.** `<C {...props} />` and `<C name={maybeName} />` both
  hit the flag when the prop is optional, and component libraries spread props
  constantly. This is the most-cited source of friction. React's typings are
  owned elsewhere in this corpus — the TypeScript-side fix is the same
  conditional spread as everywhere else.
- **ORMs and query builders**, which construct partially-filled row objects with
  `undefined` for absent columns and declare them `Partial`-shaped.
- **Test fixtures and factories**, where `makeUser({ name: undefined })` is a
  common way to say "the case where name is missing" — and now has to say it as
  `makeUser({})`, which is arguably clearer.

## Adopting it

The errors land **where objects are constructed**, which is in your own files. So
like [`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md), this flag
is directory-scoped-friendly: a second `tsconfig` covering a growing path list
works, and nothing ripples across module boundaries the way `strictNullChecks`
does.

A workable order:

1. **Turn it on for new services from day one.** The cost there is zero.
2. **On an existing codebase, enable it and count** before deciding. Sort the
   errors by file; a small number of factory and mapper files usually account for
   most of them.
3. **Fix the `Partial<T>` call sites first** — the largest bucket, and the fixes
   are mechanical.
4. **Watch the truthiness fixes.** `if (x)` instead of `if (x !== undefined)` is
   the fastest way to clear an error and the easiest way to introduce a `0`/`''`
   bug. Grep the diff for it.
5. **Count how many errors were real bugs.** If the answer is more than a handful,
   you have your argument for the rest of the codebase. If it is zero, you have
   learned something useful too — the flag is still correct, but its priority
   against everything else on the list just dropped.

🔴 **Do not adopt it with `as` or `!`.** `{ name: maybeName as string }` compiles
and reintroduces exactly the bug the flag exists to prevent, with a reviewer-proof
disguise on it. [Topic 12](../README.md) treats every such assertion as an
unresolved review comment, and this flag is a common way for a codebase to
acquire a batch of them in one afternoon.

## When not to enable it

An honest list, because "always turn it on" is not true:

- **`strictNullChecks` is off.** The flag does nothing. Fix that first.
- **The codebase is mid-migration on something larger.** Two strictness
  migrations at once produce an error list nobody can attribute.
- **A heavy dependency constructs `{ k: undefined }` and you have no boundary
  module.** Build the boundary first; the flag is much cheaper afterwards.
- **The team will close the errors with `!` and `as`.** Then the flag makes the
  codebase worse — it adds a claim of rigour and a batch of unauditable
  assertions, which is strictly worse than not having enabled it.

## Gotchas

**Symptom:** `Required<T>` accepted an object the un-`Required` type rejected.
**Cause:** `-?` strips both the optionality marker and `undefined` from the
property type, collapsing `?: T` and `?: T | undefined` into the same result.
**Fix:** none needed if that is what you meant. If you needed the distinction,
`Required` is the wrong tool.

**Symptom:** `delete o.x` started failing after a "fix" that removed optionality.
**Cause:** `TS2790` — `delete` requires an optional property, and the field was
converted to `x: T | undefined` to silence an earlier error.
**Fix:** put the `?` back and fix the original error at the construction site
instead.

**Symptom:** someone proposed `skipLibCheck: true` to fix these errors.
**Cause:** a misreading of what `skipLibCheck` covers — it skips checking inside
`.d.ts` files, not assignability at your own call sites.
**Fix:** the errors are in your code and must be fixed there. `skipLibCheck` will
change nothing.

**Symptom:** a library returns an object whose optional property is present and
`undefined`, and your code treats it as absent.
**Cause:** the flag constrains what your code constructs; it cannot police what
crosses the boundary at runtime.
**Fix:** normalise at the boundary. This residual risk is real and the flag does
not remove it.

**Symptom:** the error count is in the thousands and the team wants to revert.
**Cause:** almost certainly `Partial<T>` call sites, concentrated in a few
factory files.
**Fix:** sort errors by file before judging. The distribution is usually far more
concentrated than the total suggests.

**Symptom:** enabling the flag broke a `<Component {...props} />` spread.
**Cause:** an optional prop in `props` whose value type includes `undefined`.
**Fix:** the conditional-spread idiom, or declare that prop `?: T | undefined` if
passing `undefined` explicitly is genuinely part of the component's contract.

**Symptom:** a test fixture helper stopped compiling.
**Cause:** `makeUser({ name: undefined })` was the idiom for "no name".
**Fix:** `makeUser({})`, which is what it meant. This is one of the few places
the flag makes code shorter.

**Symptom:** the migration "succeeded" and the `as` count went up by two hundred.
**Cause:** the errors were asserted away rather than fixed.
**Fix:** the assertion count is the metric, exactly as the `!` count is for
`noUncheckedIndexedAccess`. Revert and redo with a budget.

## Interview questions

**Why does `Partial<T>` produce most of the errors when this flag is enabled?**
Because `Partial` is a homomorphic mapped type that adds `?` to every property,
and under this flag `?` is exact. Every call site passing `{ field: undefined }`
into a `Partial` parameter now fails, and `Partial` appears in most patch,
update, options and props signatures.

**Is `Required<Partial<T>>` the identity?**
Not quite, and the flag is what makes the difference visible. `-?` strips both
the optionality marker and `undefined` from the property type, so
`{ a?: string }` and `{ a?: string | undefined }` both become `{ a: string }`.
The round trip loses the information about which properties were allowed to hold
an explicit `undefined`.

**Someone suggests `skipLibCheck` to silence these errors. Are they right?**
No. `skipLibCheck` skips type checking inside declaration files; it has no effect
on assignability at your own call sites, which is where every
`exactOptionalPropertyTypes` error is raised. The errors are in your code and
have to be resolved there.

**What is the residual risk the flag does not remove?**
Runtime objects from code you do not control. A library can hand you an object
with an optional property present and set to `undefined` while its `.d.ts`
declares it optional — the flag constrains what your code constructs, not what
crosses the boundary. Normalising in a boundary module is the mitigation.

**How does adopting this compare with adopting `strictNullChecks`?**
It is much more local. `strictNullChecks` changes what every existing type means,
so its effects ripple across module boundaries and a partial adoption is awkward.
This flag's errors land at object construction sites, which are in the file you
are editing, so a directory-scoped rollout works cleanly — the same property that
makes `noUncheckedIndexedAccess` tractable.

**Give a case where you would not enable it.**
A codebase with `strictNullChecks` off, where it does nothing; a codebase already
mid-migration on something larger, where the error lists become unattributable;
or a team that will close the errors with `as` and `!`, where the result is a
config claiming a guarantee the code does not have plus a batch of unauditable
assertions.

**What single number would you use to judge whether the migration went well?**
The count of assertions added — `as` and `!` — divided by the count of errors
fixed. Near zero means the errors were genuinely resolved. Anything else means
the flag was enabled and then suppressed, which is worse than not enabling it,
because the codebase now advertises a guarantee it does not have.

---

← [03 · Spread, defaults and construction](./03-spread-defaults-and-construction.md) · [Topic index](./README.md) · Next → [06 · The other correctness flags](../06-the-other-correctness-flags/README.md)
