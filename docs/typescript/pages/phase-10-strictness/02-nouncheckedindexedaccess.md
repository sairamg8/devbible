---
title: "noUncheckedIndexedAccess"
sidebar_label: "02 · noUncheckedIndexedAccess"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** on typescriptlang.org —
> `noUncheckedIndexedAccess`, *"Add `undefined` to index signatures to prevent
> unchecked indexed access"*, **default `false`**, released **4.1** — and the
> **compiler's own diagnostic table** for `TS18048` and `TS2532`, read rather
> than recalled. That it is **not** part of `strict` was established by
> enumerating the options carrying `strictFlag: true`
> ([topic 01 chunk 01](./01-strict-flag-by-flag/01-what-strict-actually-is.md)).
> **No sandbox, no console block.**

The most valuable flag `strict` does **not** turn on — and the one most likely
to be enabled, resented, and reverted within a week.

> **TypeScript assumes every index access succeeds.** `arr[0]` is typed `T` on
> an array that may be empty; `record[key]` is typed `T` for a key that may not
> be there. Neither is true, and the flag is the compiler admitting it.

## What it changes

```ts
const first = arr[0];              // T                  — without
const first = arr[0];              // T | undefined      — with

const cfg = record[key];           // T                  — without
const cfg = record[key];           // T | undefined      — with
```

That is the whole feature. `undefined` is added to the type of any read through
an **index signature** or a **numeric index into an array or tuple**.

⚠️ **It is off by default and it is not in `strict`.** Turning `strict: true`
on gets you the nine flags from
[topic 01](./01-strict-flag-by-flag/README.md) — this is not one of them, so a
codebase can be fully "strict" and still believe every array is non-empty.

### What it does *not* change

Worth knowing, because it bounds the noise:

- **Known properties.** `obj.name` on `{ name: string }` is untouched — that
  property is declared, not indexed.
- **Tuples at known positions.** `const [a, b]: [string, number]` stays exact.
  The flag understands tuple length.
- **`for…of`.** Iterating never produces `undefined`, so the idiomatic loop is
  unaffected — which is a large part of why the flag is more livable than its
  reputation suggests.

```ts
for (const item of items) item.name;   // fine, no undefined
items.forEach(i => i.name);            // fine
items[0].name;                         // error — this is the one it wants
```

📌 **That contrast is the argument in miniature.** The constructs that are safe
stay quiet; the one that is genuinely unchecked speaks up.

## Why it finds real bugs

Because the unchecked index is not a rare pattern — it is how most code reaches
into runtime-shaped data:

```ts
const [scheme, token] = header.split(' ');   // both string | undefined
if (scheme !== 'Bearer') return unauthorized();
verify(token);                               // error: possibly undefined
```

`''.split(' ')` returns `['']`, so `token` really can be `undefined`, and the
version without the flag passes `undefined` into `verify` — where it becomes a
confusing failure two frames down.

On a server this compounds, and
[phase 7 · the annotated configs](../phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md)
makes the applied case: **every `req.params.id`, every `req.headers['x-…']`,
every `rows[0]` is an index access into an object some runtime populated.** That
page argues it in context; this one owns the general rule.

The errors are the `strictNullChecks` family from
[topic 01 chunk 02](./01-strict-flag-by-flag/02-strictnullchecks.md) —
`TS18048` when the value has a name, `TS2532` when it does not.

## The four honest fixes

**1. Narrow it.** The intended response:

```ts
const token = parts[1];
if (token === undefined) return unauthorized();
verify(token);
```

**2. Destructure with a default**, when absence has a meaning:

```ts
const [scheme = '', token = ''] = header.split(' ');
```

**3. Use `.at()` and be explicit about it.** `Array.prototype.at` returns
`T | undefined` **regardless of the flag**, which makes it the honest accessor
and a good habit independent of this setting.

**4. Restructure so there is no index.** Often the best answer:

```ts
const first = items[0];              // needs a check
const [first] = items;               // still T | undefined — same thing
for (const item of items) { … }      // no index, no undefined
```

🔴 **The dishonest fix** is `!`:

```ts
verify(parts[1]!);                   // compiles. same bug, warning removed.
```

A migration that enables this flag and adds a `!` per error has achieved
**nothing except a claim of rigour** — and has made the remaining risk harder to
find, because a `!` reads as considered rather than as skipped.
[Topic 12](./README.md) treats each one as an unresolved review comment.

## The honest objections

**"It is noisy."** Sometimes, and the noise is concentrated where you index
into a `Record<string, T>` you personally populated three lines earlier. The
compiler cannot see that, and it is right not to guess.

The mitigation is usually a better type: a `Map` (whose `get` already returns
`T | undefined`, so nothing changes), or a type that encodes the guarantee —

```ts
type NonEmpty<T> = [T, ...T[]];
function head<T>(xs: NonEmpty<T>): T { return xs[0]; }   // no undefined
```

**"Our lookup tables are exhaustive."** Then say so in the type. A
`Record<Status, Handler>` keyed by a **union** rather than by `string` is not an
index signature — it is a set of known properties, and the flag leaves it alone.
That single change removes a large share of the errors in most codebases and
improves the types independently.

```ts
const handlers: Record<string, Handler> = { … };   // handlers[s] → | undefined
const handlers: Record<Status, Handler> = { … };   // handlers[s] → Handler
```

📌 **This is the most useful thing on the page.** Most `noUncheckedIndexedAccess`
pain is a `Record<string, T>` that should have been keyed by a union — and
fixing that also gives you exhaustiveness checking for free
([phase 2 · exhaustiveness](../phase-2-narrowing/06-exhaustiveness.md)).

**"It's unsound anyway."** True and not a defence: the flag does not make index
access sound — `arr[5]` on a 3-element array is still `T | undefined` rather
than an error, and mutation can still invalidate a check. It narrows the gap
without closing it, which is exactly what
[topic 07](./README.md) is about.

## Adopting it

Unlike `strictNullChecks`, this one is **directory-scoped-friendly** — the errors
are local to the file doing the indexing, so a second config covering a growing
path list works well and nothing ripples across module boundaries.

1. Enable it on new code first.
2. Fix the `Record<string, T>` keys before touching anything else — the error
   count often halves.
3. Count the `!` you add. If it is not near zero, stop and reconsider.

## Gotchas

**Symptom:** `for (const x of xs)` started reporting `possibly undefined`.
**Cause:** it did not — something else in the expression indexes. `for…of` is
unaffected by this flag.
**Fix:** read the error's column; it is pointing at an index elsewhere on the
line.

**Symptom:** hundreds of errors on lookup tables that are exhaustive by
construction.
**Cause:** they are typed `Record<string, T>`, so every read is an index-signature
access.
**Fix:** key them by a union. The flag then treats the properties as known, and
you gain exhaustiveness checking.

**Symptom:** a destructured tuple element is `undefined` when the tuple type says
otherwise.
**Cause:** the value is an *array*, not a tuple — `split()` returns `string[]`.
**Fix:** either check, or default in the destructuring pattern.

**Symptom:** the flag was enabled and the bug rate did not change.
**Cause:** every error was closed with `!`.
**Fix:** the `!` count is the metric, not the flag. Revert and redo, or fix them
properly.

**Symptom:** `arr[5]` on a three-element array is `T | undefined`, not an error.
**Cause:** the flag adds `undefined`; it does not do bounds analysis.
**Fix:** none — this is the documented extent of it. It narrows the soundness
gap rather than closing it.

## Interview questions

**What does `noUncheckedIndexedAccess` do, and why is it not part of `strict`?**
It adds `undefined` to reads through an index signature or a numeric array
index, because TypeScript otherwise assumes every index access succeeds. It is
not in `strict` — the nine `strictFlag` options do not include it — because it
produces a large number of errors on existing code and the team decided it was
too disruptive to enable by default.

**Which common patterns does it deliberately leave alone?**
Declared properties, tuple access at known positions, and `for…of` iteration.
That is why it is more livable than its reputation: the safe constructs stay
quiet and only genuinely unchecked indexing speaks up.

**Your team enabled it and error count exploded on lookup tables. What is the
fix?**
Usually the tables are typed `Record<string, T>` when the keys are a known
union. Keying by the union turns index-signature reads into known-property
reads, so the flag stops complaining — and you gain exhaustiveness checking on
the table as a side effect.

**A migration enabled the flag and added a `!` at every error. What was
achieved?**
Nothing, other than a config that now claims a guarantee the code does not have.
The unchecked accesses are unchanged and the warnings are gone, and each `!`
reads to a future reader as a considered decision rather than a skipped one.

---

← [Phase 10 index](./README.md) · Next → **03 · Containing `any`** *(not written yet)*
