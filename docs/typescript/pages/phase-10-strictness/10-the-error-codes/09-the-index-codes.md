---
title: "TS7053 and the index-access ladder"
sidebar_label: "09 · The index codes"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the element-access branch of the checker** in the
> **TypeScript 5.9.3** build (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`,
> around line 66826) — so the ladder and its `noImplicitAny` gate are the
> compiler's own control flow. Codes and templates read from the numbered table in
> the same file: `TS7053`, `TS7054`, `TS7015`, `TS7017`, `TS7052`, `TS2339`,
> `TS2551`, `TS2576`. The `noImplicitAny` option record is read from the option
> table. **No sandbox, no console block** — this is a file read.

The one code in this topic's nine that is not in the 2xxx range, and the range
change is the whole point.

> 🔴 **`TS7053` is not a type error. It is `noImplicitAny` refusing to insert an
> implicit `any`.** The expression has no type the compiler can justify, so
> without the flag it would silently become `any` and the program would compile.
> **Turning the flag off does not fix the code; it removes the only evidence that
> the lookup is unchecked.**

```text
Element implicitly has an 'any' type because expression of type 'string'
can't be used to index type 'Config'.
```

Read the message's own structure: *"implicitly has an `'any'` type **because**…"*.
The finding is the `any`; the index expression is the reason.

## 🔴 The whole ladder is inside one `if (noImplicitAny)`

From the checker, the branch reads:

```js
} else if (noImplicitAny && !(accessFlags & SuppressNoImplicitAnyError)) {
```

**Everything below is unreachable with `noImplicitAny: false`.** Not "reported
differently" — not reported at all, and the expression's type becomes `any`.

📌 **That makes `TS7053` a strictness *symptom*, and it explains a real experience:
turning `noImplicitAny` on in an established codebase produces a flood of these
from code that has worked for years.** It worked because every one of those
lookups was silently `any`, and any `any` is a place the type system stopped
checking — [topic 03](../03-containing-any.md) is the inventory of how that
spreads.

⚠️ **`noImplicitAny` is one of the nine flags `strict` turns on**
([topic 01](../01-strict-flag-by-flag/README.md)), so this ladder is live on any
project that sets `strict: true` — which is the default for `tsc --init`.

## The ladder, in the compiler's order

Once the gate is passed, the checker walks these in sequence:

| # | Condition | What you get |
|---|---|---|
| 1 | the key is a block-scoped `globalThis` export | plain `TS2339` |
| 2 | the property exists as a **`static`** member | `TS2576`, in bracket form — *"Did you mean to access the static member `'Type[expr]'`"* |
| 3 | the type has a **numeric** index signature and your key is not a number | `TS7015` *"Element implicitly has an 'any' type because index expression is not of type 'number'."* |
| 4 | a **similar property name** exists | 🔴 `TS2551` *"…Did you mean '{2}'?"* — the spelling machinery works on bracket access too |
| 5 | the type has a method you could have **called** | `TS7052` *"…has no index signature. Did you mean to call '{1}'?"* |
| 6 | none of the above | 🔴 **`TS7053` wrapping a more specific inner line** |

📌 **Step 4 is worth knowing about.** `config["retires"]` gets *"Did you mean
'retries'?"* exactly as `config.retires` would — the budget from
[chunk 08](./08-the-spelling-budget.md) applies identically. Bracket access is
often reached for *to escape* type checking, and it does not escape this.

## 🔴 Step 6 is always two lines, and the inner one is the answer

`TS7053` is a **wrapper**. The checker builds a chain: a specific inner message
chosen by the *kind* of index you used, with `TS7053` on the outside.

| Your index is | Inner message | Code |
|---|---|---|
| a **string literal** — `obj["nmae"]` | `Property 'nmae' does not exist on type 'Config'.` | `TS2339` |
| a **number literal** — `obj[3]` | `Property '3' does not exist on type 'Config'.` | `TS2339` |
| an **enum member** | `Property '[MyEnum]' does not exist on type 'Config'.` | `TS2339` |
| a **`unique symbol`** | `Property '[Sym]' does not exist on type 'Config'.` | `TS2339` |
| a plain **`string`** or **`number`** variable | 🔴 `No index signature with a parameter of type 'string' was found on type 'Config'.` | `TS7054` |

**So the outer `TS7053` is generic by construction and the inner line is the
diagnosis** — which is exactly the reading discipline
[topic 04](../04-reading-a-typescript-error.md) established, applied to a code
where it is not optional.

🔴 **The inner code is the fork in the fix.** `TS2339` inside means you named a
key that does not exist — a typo or the wrong type, fixable in your code.
**`TS7054` inside means the key is a runtime value**, so no amount of key-fixing
helps and the answer is structural: either the type needs an index signature, or
the key needs to be narrowed to a union of literals.

## The two shapes, and the right fix for each

### The key is a literal you got wrong → fix the key

```ts
interface Config { retries: number; baseUrl: string }
declare const c: Config;

c["retires"];        // TS7053 wrapping TS2339, with TS2551's suggestion
c["retries"];        // fixed
```

### The key is a variable → the type is under-specified

```ts
declare const c: Config;
declare const key: string;

c[key];              // TS7053 wrapping TS7054
```

**Four honest fixes, in order of preference:**

1. **Narrow the key to the type's own keys.** The compiler then knows every
   possible result:

   ```ts
   declare const key: keyof Config;
   c[key];                                // string | number, no error
   ```

2. **Say the object is a dictionary, if it is one.** If arbitrary keys are
   genuinely legal, the type should say so:

   ```ts
   type Config = Record<string, number | string>;
   ```

   ⚠️ **And then `noUncheckedIndexedAccess` applies**, adding `| undefined` —
   which is [topic 02](../02-nouncheckedindexedaccess.md)'s subject and is
   correct: a lookup by an arbitrary key can miss.

3. **Narrow at runtime with `in`.** The check the type system was asking for:

   ```ts
   if (key in c) c[key as keyof Config];
   ```

   📌 Since TypeScript 4.9, `in` narrows an unlisted key on an object of a known
   type usefully; before that this pattern needed the assertion on its own.

4. **A typed lookup helper**, when the pattern repeats:

   ```ts
   function get<T extends object, K extends keyof T>(o: T, k: K): T[K] {
     return o[k];
   }
   ```

⛔ **Not on the list: `(c as any)[key]`.** It replaces a precise complaint about
one lookup with an `any` that propagates through everything downstream. Nor
`// @ts-ignore`, which is
[topic 08](../08-suppression-directives/03-the-suppression-tiers.md)'s tier 4 for
a problem with four real fixes.

## The two flags that used to turn this off, and one that still does

Two related options sit alongside this ladder:

- **`noPropertyAccessFromIndexSignature`** — the *opposite* direction. It forbids
  `config.someKey` when `someKey` comes only from an index signature, forcing
  `config["someKey"]` so that "declared property" and "dictionary lookup" look
  different in the source.
  [Topic 06](../06-the-other-correctness-flags/02-index-signature-access.md) owns
  it.
- 🔴 **`suppressImplicitAnyIndexErrors`** — designed to switch this entire ladder
  off project-wide. **It no longer works**, and that is
  [chunk 13](./13-the-suppress-codes-are-gone.md)'s subject.

⚠️ **The `SuppressNoImplicitAnyError` access flag in the condition above is
internal**, set by the checker for positions where an implicit `any` is
deliberately tolerated. It is not reachable from `tsconfig.json`, so do not read
the flag name in that source line as a user-facing option.

## Gotchas

**Symptom:** hundreds of `TS7053`s appear the moment you enable `strict`.
**Cause:** `noImplicitAny` gates the whole ladder, so every one of those lookups
was previously a silent `any`.
**Fix:** work through them. Each one is a place the type system was not checking.
Do not reach for the flag.

**Symptom:** `TS7053` on an object you are certain has that key.
**Cause:** read the **inner** line. `TS2339` means the key genuinely is not in the
type — the type is out of date, or you have the wrong object.
**Fix:** fix the type. This is not an indexing problem.

**Symptom:** `TS7053` where the key is a `string` variable.
**Cause:** the inner line is `TS7054` — no index signature accepts a `string`.
**Fix:** narrow the key to `keyof T`, or declare the object as a `Record`. Fixing
the key's *value* cannot help; its **type** is the problem.

**Symptom:** `arr[i]` complains that the index expression is not a number.
**Cause:** `TS7015` — the type has a numeric index signature and `i` is a
`string`, often from `Object.keys` or a `for…in`.
**Fix:** `Number(i)`, or iterate with `for…of` over `entries()`. ⚠️ Note that
`Object.keys` returning `string[]` is deliberate and correct, for reasons
[topic 07](../07-unsound-by-design/03-the-holes-in-your-data.md) settles.

**Symptom:** `obj[method]` complains about an index signature and mentions
calling something.
**Cause:** `TS7052` — `method` is a function on the type and you used it as a key.
**Fix:** `obj[method()]`, or you meant `obj.method()`.

**Symptom:** a bracket access gets a spelling suggestion you did not expect.
**Cause:** step 4 — bracket access goes through the same suggestion machinery as
dot access.
**Fix:** take the suggestion. And note that bracket syntax buys no escape from
checking here.

**Symptom:** `(obj as any)[key]` silences it and something breaks three files
later.
**Cause:** the `any` propagates. The complaint was about one lookup; the assertion
removed checking from everything derived from it.
**Fix:** one of the four fixes above. If the object really is a dictionary, say so
in its type once, rather than at every call site.

**Symptom:** a `TS7053` in a `.js` file under `allowJs`.
**Cause:** `noImplicitAny` applies to JavaScript too when `checkJs` is on.
**Fix:** a JSDoc `@type` annotation, or accept that this file is unchecked and be
explicit about it — `@ts-nocheck` in a `.ts` file is nearly always wrong, but a
`.js` file *is* the honest place for unchecked code
([topic 08](../08-suppression-directives/01-the-three-directives.md)).

## Interview questions

**What does `TS7053` actually mean?**
That the compiler could not justify a type for an index access and
`noImplicitAny` refused to fall back to `any`. It is not a type mismatch — it is
the absence of a type. The whole reporting branch sits inside
`if (noImplicitAny && …)`, so with the flag off the expression silently becomes
`any` and the program compiles with a hole in it.

**A `TS7053` is always two lines. Which one do you read?**
The inner one. `TS7053` is a wrapper; the inner message is chosen by the kind of
index you used. `TS2339` inside means you named a key that is not on the type —
fixable in your code. `TS7054` inside — *"No index signature with a parameter of
type 'string' was found"* — means the key is a runtime value, so the fix is
structural: narrow the key to `keyof T`, or declare the object as a `Record`.

**`obj[key]` where `key: string`. What are the real options?**
Narrow the key to `keyof T`, which is best when the set of keys is known.
Declare the object as `Record<string, V>` if arbitrary keys are genuinely legal —
and then accept `noUncheckedIndexedAccess` adding `| undefined`, which is correct
because the lookup can miss. Narrow at runtime with `in`. Or write a generic
lookup helper if the pattern repeats. Casting to `any` is not on the list: it
converts a precise complaint about one lookup into an untyped value that spreads.

**Why does enabling `strict` produce a flood of `TS7053` in an old codebase?**
Because `noImplicitAny` is one of the flags `strict` turns on, and it gates the
entire index-access reporting branch. Every one of those lookups was already
returning `any`; the flag did not create the problem, it revealed it. Each error
is a site where the type system had stopped checking, which is why suppressing
them defeats the purpose of the migration.

**Does bracket access let you bypass type checking?**
Not here. The index-access ladder runs the same spelling-suggestion machinery as
dot access, so `config["retires"]` gets the same *"Did you mean 'retries'?"* that
`config.retires` would. What bracket access does bypass is
`noPropertyAccessFromIndexSignature`, which is the opposite flag — it *requires*
brackets for keys that come only from an index signature, so the two notations
carry different meanings on purpose.

**Is `suppressImplicitAnyIndexErrors` a reasonable way to stage a migration?**
It was, and it is not any more — the option no longer functions and produces a
configuration error instead. [Chunk 13](./13-the-suppress-codes-are-gone.md) has
the exact behaviour by version. The staging tool that does still work is enabling
the flag per directory with a second `tsconfig`, or fixing the sites.

---

← [08 · The spelling budget](./08-the-spelling-budget.md) · [Topic index](./README.md) · Next → [10 · You have not proved it](./10-you-have-not-proved-it.md)
