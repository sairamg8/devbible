---
name: devbible-typescript-phase2
description: The load-bearing claims behind the 13 phase-2 (narrowing) pages, and the reusable evidence technique — reading error codes out of the TypeScript compiler's own diagnostic table instead of recalling them
metadata:
  type: reference
---

Phase 2 · **Narrowing and control flow analysis** — ✅ complete 2026-08-14,
**13 topics · 22 files · 4,261 lines · 0 over the 300-line cap · 0 broken links**
(clean rebuild, `[SUCCESS]` confirmed before the grep was read).

Pages 01–07 were written by an earlier session while `sandbox/ts-p2/ex1` and
`ex2` were live and keep their console blocks. **Topics 08–13 were written by
session `713ec3db` and carry none** — see the evidence section below.

## 🔴 The evidence technique — reuse this for the rest of TypeScript

**The compiler's own diagnostic table is documentation. Reading it is not a
sandbox run**, so it is fully allowed under [[devbible-no-new-sandbox-scripts]],
and it is the difference between a *quoted* error code and an *invented* one.

```bash
TS=/run/media/sairam/Storage/my-learning/eKommerce/ek-frontend/node_modules/typescript
grep -o 'Assertions require[^"]*' $TS/lib/typescript.js
node -e "s=require('fs').readFileSync('$TS/lib/typescript.js','utf8');
         i=s.indexOf('Type_0_does_not_satisfy_the_expected_type_1: diag(');
         console.log(s.slice(i,i+240))"
```

It yields the **code, the severity and the exact `{0}`/`{1}` message text**, and
for compiler options it also yields `strictFlag`, the description and the
default. ⚠️ **That install is TypeScript 6.0.3, not the 7.0.2 the corpus
targets** — every page that quotes a code says so rather than glossing it.
eKommerce is advisor-only; nothing there was modified, only read.

Same trick for library shapes, from devbible's **own** `node_modules`:
`@types/node` **26.2.0** (`assert.d.ts`), `lib.es5.d.ts`, `lib.es2022.error.d.ts`.

⚠️ **`sandbox/ts-p2/` saved NO output files** — only the scripts and `src-ex*`.
Findings from those runs are therefore stated **in prose, marked
sandbox-measured**, never reconstructed as a console block.

## The eleven codes read this way, and what each settles

| Code | Message | Settles |
|---|---|---|
| `TS2775` | *Assertions require every name in the call target to be declared with an explicit type annotation.* | An inferred `const` arrow cannot be an assertion target |
| `TS2776` | *Assertions require the call target to be an identifier or qualified name.* | Assertions cannot live in a lookup table |
| `TS1360` | *Type '{0}' does not satisfy the expected type '{1}'.* | `satisfies`' own failure |
| `TS2353` | *Object literal may only specify known properties, and '{0}' does not exist in type '{1}'.* | Excess-property checking still applies under `satisfies` |
| `TS9035` | *Add satisfies and a type assertion to this expression (satisfies T as T) to make the type explicit.* | What `isolatedDeclarations` demands of a `satisfies` export |
| `TS18047` | *'{0}' is possibly 'null'.* | Corroborates the recorded `forEach` finding exactly |
| `TS1196` | *Catch clause variable type annotation must be 'any' or 'unknown' if specified.* | Why `catch (e: Error)` is refused |
| `TS1197` | *Catch clause variable cannot have an initializer.* | — |
| `TS2564` | *Property '{0}' has no initializer and is not definitely assigned in the constructor.* | What `x!: T` on a field silences |
| `TS1255` | *A definite assignment assertion '!' is not permitted in this context.* | — |
| `TS8013` | *Non-null assertions can only be used in TypeScript files.* | `!` is TS-only syntax |

Plus the option record, read from the same source:
**`useUnknownInCatchVariables` is `strictFlag: true`**, described *"Default catch
clause variables as unknown instead of any"*, defaulting *"true unless strict is
false"*.

## 🔴 The measurement that reshaped a topic

`ex2` was written expecting **both** a callback and an `await` to destroy a
narrowing. **Only the callback did** — one `TS18047` on the `forEach` line,
nothing on the `await`.

That is not a detail, it is the spine of topic 11, because the two cases are
**opposite in character**:

- **Callback = FALSE POSITIVE.** `forEach` really does call its argument
  synchronously; nothing in its type says so, so the compiler drops the
  narrowing. The code was safe and it complained.
- **`await` = FALSE NEGATIVE.** Other code genuinely runs during the suspension,
  so a module-level or shared binding can have changed — and the compiler keeps
  the narrowing anyway. A real bug class with no diagnostic.

**One habit covers both: capture the narrowed value into a `const` immediately
after the check.** A narrowing crosses into a nested function only when the
binding cannot change. `!` and `as` silence the true positives as well as the
false ones, and nothing at the call site distinguishes them.

A claim already shipped on phase-1 page 10 was corrected because of this run.

## Claims worth carrying, by topic

**09 · Assertion functions**

- `asserts v` is **truthiness, not presence** — `''` and `0` fail it. The honest
  helper is `asserts v is NonNullable<T>` with a `v != null` body.
- `@types/node` 26.2.0: `assert`/`ok` are `asserts value`; **`strictEqual<T>` is
  `asserts actual is T`** (so it narrows a status string to a literal —
  a useful side effect nobody knows they are getting); `ifError` is
  `asserts value is null | undefined`.
- **An assertion function must THROW.** One that logs and returns leaves the
  compiler holding a narrowed type over a value that never satisfied it, and
  nothing in the type system can find that.
- TS2775's **error is at the call site, its cause is at the declaration.** The
  rule exists to break a circularity: CFA must know a call is an assertion
  *before* it analyses it, and an inferred binding type could depend on that
  analysis.
- Assertions cannot be passed to `filter` (they return `void`) and cannot be
  called through an element access (TS2776). Both are guard-only jobs.

**10 · `satisfies`**

- **It is the only one of annotation / `as` / `satisfies` that does not change
  the expression's type.** Annotation checks and replaces; `as` neither checks
  nor is checked; `satisfies` checks fully and leaves inference alone.
- **`satisfies Record<Union, T>` is `assertNever` for TABLES** — the
  highest-value use. Adding a union member breaks the build at the table.
- **`as const satisfies T`, in that order.** `as const` freezes the literals,
  `satisfies` checks the frozen version. Reversed it is not meaningful.
- `const X = [...] as const satisfies readonly string[]` then
  `type T = (typeof X)[number]` — one declaration gives the runtime list *and*
  the union, which cannot then drift apart.
- **It does not make anything `readonly`** (mutable is assignable to readonly) and
  validates **nothing** at runtime.
- Most `as` on an object literal in older code should have been `satisfies` — it
  was the only option before 4.9.

**11 · Narrowing you lose** — see the measurement section above, plus:

- **A property stays narrowed across an arbitrary function call.** TS does not
  analyse what a call mutates. Pragmatic, and a hole.
- **Aliased conditions (4.4) require `const`** — `const isString = typeof v ===
  'string'` narrows at the `if`; `let` does not. Element access (4.7) narrows
  only with a literal or `const` key.
- A **`catch` block sees no narrowings from its `try`** — it can be entered from
  any statement in the block.

**12 · `unknown` in `catch`**

- 🔴 **`.catch()` did NOT get the same treatment.** `lib.es5.d.ts` declares
  `catch(onrejected?: (reason: any) => …)`, so the strict flag does not reach the
  promise method that shares the name. **Two spellings of "handle the rejection"
  and only one is type-safe** — prefer `try`/`catch` around `await`, or annotate
  `(e: unknown)` yourself.
- `Error.cause` is `cause?: unknown` in `lib.es2022.error.d.ts` — for exactly the
  reason `catch` is `unknown`: the thing being wrapped need not be an `Error`.
- `catch (e: Error)` is refused (TS1196) because nothing checks what arrives; the
  annotation would be an assertion in disguise.
- Match Node errors on **`e.code`, never `e.message`** — the message text is not
  a stable interface.

**13 · The non-null assertion `!`**

- **`!` is `as NonNullable<T>` with better syntax and the same total absence of
  checking.** `a!.b` emits `a.b`.
- **Most `!` in real code is a lost narrowing** (topic 11), not knowledge. Reading
  it that way is the most useful habit in the topic.
- Legitimate when the guarantee is **local, visible in the same few lines, and
  fails loudly** — `getElementById('app')!`, `map.get(id)!` right after the
  `set`. Not for network data.
- `let x!: T` is a **different feature** — the definite assignment assertion,
  which silences TS2564.
- **With `strictNullChecks` off, `!` is meaningless.** A codebase full of `!` with
  `strict` disabled has decoration, not assertions.

## Structural decisions

- **Topics 09, 10 and 11 are chunk directories** (`README` + 2 chunks each);
  12 and 13 are single files at 291 and 245 lines.
- **Topic 09 was written flat, came out at 302 lines, and was split rather than
  trimmed** — and the depth the topic deserved was *added* on the way, per
  [[devbible-never-compress-to-fit-cap]]. Topics 10 and 11 were chunked from the
  start because Master tier plus a genuine two-subject seam.
- Every inbound link was repointed by hand when a topic became a directory —
  6 for topic 10, 6 for topic 11, 4 for topic 09 — and each target was resolved
  against the filesystem, never bulk-`sed`.
- The two existing syllabus links (`../pages/phase-0-.../`) were corrected from
  the **directory-slug form to the `.md` form** the hard rule requires.

Related: [[devbible-typescript-build-progress]] · [[devbible-typescript-phase1]] ·
[[devbible-typescript-phase0]] · [[devbible-no-new-sandbox-scripts]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-verify-your-own-measurements]]
