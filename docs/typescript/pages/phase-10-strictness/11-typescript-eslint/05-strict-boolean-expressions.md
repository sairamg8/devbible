---
title: "strict-boolean-expressions — the falsy-member rule"
sidebar_label: "05 · strict-boolean-expressions"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own rule page** for
> `strict-boolean-expressions` — its description, its eight options and every
> default, quoted from it — and against the **ECMAScript specification's
> `ToBoolean`** (and MDN's *Falsy*) for the truthiness table this page is built on.
> ⚠️ typescript-eslint is not installed in this repo, so rule metadata is
> documentation-attributed rather than read from source; the truthiness table is
> language semantics and is spec-attributed. **No sandbox, no console block.**

Description, verbatim: *"Disallow certain types in boolean expressions."*

> 🔴 **This rule is in the same category as `no-floating-promises`: the compiler has
> nothing.** There is no flag, in `strict` or outside it, that makes `if (str)` an
> error. Truthiness coercion is legal JavaScript and TypeScript has no opinion on
> it — the only conditions `tsc` objects to are the ones already *decided*
> ([chunk 04](./04-no-unnecessary-condition.md)), and a `string` that might be `""`
> is not decided. It is **ambiguous**, which is a different complaint that no
> compiler diagnostic makes.

## The two rules are complements, not neighbours

It is worth fixing this distinction before the options, because every argument
about "do we need both?" collapses once it is stated:

| | Complaint | Example |
|---|---|---|
| `no-unnecessary-condition` | **the check does nothing** — the answer is already known | `if (user)` after `if (!user) return` |
| `strict-boolean-expressions` | **the check does something, but maybe not what you meant** | `if (name)` where `name` is `""` |

📌 A codebase can trip both on the same line for opposite reasons, and the fixes
point in opposite directions: one deletes the condition, the other makes it
explicit.

## 🔴 The whole rule is one question about your type

JavaScript's `ToBoolean` has a **fixed, closed list** of values that convert to
`false`. Everything else in the language is `true`:

| Falsy value | Which type it belongs to |
|---|---|
| `false` | `boolean` |
| `0` and `-0` | `number` |
| `NaN` | `number` |
| `0n` | `bigint` |
| `""` | `string` |
| `null` | `null` |
| `undefined` | `undefined` |

That list is the rule. **Writing `if (x)` is safe exactly when the non-nullish part
of `x`'s type contains none of those values** — because then, and only then,
`if (x)` and `x != null` are the same test. Apply it type by type:

| Static type | Falsy members it can hold | Is `if (x)` a null check? |
|---|---|---|
| object, array, function, class instance | **none** | ✅ **yes, exactly** |
| `string` | `""` | ❌ empty string is indistinguishable from absent |
| `number` | `0`, `-0`, `NaN` | ❌ zero is indistinguishable from absent |
| `bigint` | `0n` | ❌ same |
| `boolean` | `false` | ❌ `false` is indistinguishable from absent |
| numeric `enum` | any member whose value is `0` | ❌ and it is usually the **first** member |
| string `enum` | any member whose value is `""` | ❌ rare, but legal |
| `any` | unknown | ❌ nothing is known |

🔴 **That single table explains the entire option matrix**, which is why the
options look arbitrary until you have it and obvious afterwards.

:::note The one falsy object, and it is real
`document.all` is an object that converts to `false`, specified in Annex B as the
`[[IsHTMLDDA]]` behaviour and kept only so that decades-old browser-sniffing code
keeps working. It is the sole exception to "objects are never falsy" and it will
never affect your code — but if you are going to teach the rule as *objects have no
falsy members*, it is worth knowing the standard disagrees in exactly one place.
:::

## The options, and what each one is really asking

| Option | Default | What allowing it costs you |
|---|---|---|
| `allowAny` | `false` | a condition on a value nothing is known about |
| `allowNullableBoolean` | `false` | `false` and `undefined` treated as the same answer |
| `allowNullableEnum` | `false` | the zero-valued member treated as absent |
| `allowNullableNumber` | `false` | `0` and `NaN` treated as absent |
| **`allowNullableObject`** | 🔴 **`true`** | **nothing** — the test is exact |
| `allowNullableString` | `false` | `""` treated as absent |
| **`allowNumber`** | 🔴 **`true`** | `0` and `NaN` treated as absent |
| **`allowString`** | 🔴 **`true`** | `""` treated as absent |

`allowNullableObject: true` is the matrix behaving correctly: objects have no falsy
members, so `if (user)` on `User | undefined` is *precisely* `user != null` and
there is nothing to warn about. **Forbidding it would be pure noise**, and the rule
does not.

## 🔴 The defaults draw the line at nullability, not at falsiness

That leaves `allowNumber: true` and `allowString: true`, and they are not the
matrix — they are **carve-outs made against it**, for ergonomics. `if (str)` and
`if (arr.length)` are too entrenched to forbid by default.

The consequence is worth stating plainly, because it is the opposite of what most
people assume when they turn the rule on:

```ts
declare const name: string
declare const maybeName: string | undefined

if (name) { … }        // ✅ allowed by default — and this is the classic "" bug
if (maybeName) { … }   // ❌ reported by default
```

**Out of the box this rule catches confusion about *absence*, and permits confusion
about *emptiness*.** The famous bugs — the empty-string username, the zero-value
config, the `0` that renders in JSX — all live in the permitted half. 🔴 **To buy
the protection the rule is famous for you must explicitly write
`allowString: false` and `allowNumber: false`.** The default configuration is not
the strict configuration.

📌 The pattern here is one this phase keeps meeting: a tool's default is a
*compatibility* decision, not a *correctness* decision, and the two are routinely
confused ([topic 01](../01-strict-flag-by-flag/README.md) makes the same point
about `strict` itself, and topic 06's `allowUnreachableCode` is a third instance).

## Why it is in no preset

⚠️ **Stated as an observation, not as a claim about intent:** unlike the other
rules in this topic, `strict-boolean-expressions`' documentation page **names no
preset** — where `no-floating-promises` and `no-misused-promises` name
`recommended-type-checked` and `no-unnecessary-condition` names
`strict-type-checked`. Treat it as opt-in.

The reasonable explanation is that it is the only rule of the four whose reports
are **stylistic in the majority and load-bearing in the minority**, and the ratio
depends on a codebase's conventions rather than on its correctness. A preset cannot
make that call for you.

## Where the type comes from matters more than the condition

🔴 **This rule reports at the `if`, but it is almost never about the `if`.** Every
report is downstream of a type decision made somewhere else, and the useful
response is to look there:

| The report | What it usually means upstream |
|---|---|
| `string \| undefined` in a condition | an optional property that should have been required, or a boundary value that was never validated |
| `number` in a condition | `.length` used as a truthiness proxy |
| `boolean \| undefined` | an optional flag with no default — the API has three states where it wanted two |
| nullable enum | a numeric enum whose first member means something real |
| `any` | see [topic 03](../03-containing-any.md); the condition is the symptom |

⚠️ **Interaction worth predicting before you enable anything:**
`noUncheckedIndexedAccess` ([topic 02](../02-nouncheckedindexedaccess.md)) turns
`arr[i]` from `T` into `T | undefined`, so every `if (arr[i])` on a `string[]`
becomes a *nullable string* — newly reported by this rule's defaults. **Enabling
that flag raises this rule's count**, and both findings are correct. Sequence them
deliberately rather than turning both on in one commit and concluding the lint is
broken.

## Gotchas

**Symptom:** the rule is enabled and the empty-string bug still ships.
**Cause:** `allowString` defaults to `true`. A plain `string` in a condition is
permitted out of the box.
**Fix:** set `allowString: false` explicitly. 🔴 **The default config is not the
strict config**, and this is the single most common misunderstanding of this rule.

**Symptom:** `if (user)` on `User | undefined` is not reported and someone files it
as a bug.
**Cause:** `allowNullableObject` defaults to `true`, deliberately.
**Fix:** none — the rule is right. Objects have no falsy members, so the test is
exactly `user != null` and there is nothing ambiguous about it.

**Symptom:** enabling the rule with the strict options produces thousands of
reports on a mature codebase.
**Cause:** truthiness is the default idiom in JavaScript; a codebase written
without the rule will use it everywhere.
**Fix:** enable the nullable options first (they are already the defaults), fix
those, then flip `allowString` and `allowNumber` as a separate, scheduled change.
⚠️ Do not do it in the same commit as a flag change — you will not be able to
attribute the reports.

**Symptom:** the rule reports a condition on a value that is obviously fine.
**Cause:** the declared type is wider than reality — most often `any` arriving
inherited from an untyped dependency.
**Fix:** the same answer [chunk 04](./04-no-unnecessary-condition.md) gives for
`no-unnecessary-condition`: **fix the type**. A report on `any` is
[topic 03](../03-containing-any.md)'s finding surfacing at a condition.

**Symptom:** the team disables the rule because "it just wants `!== undefined`
everywhere".
**Cause:** the reports are being read as a style preference.
**Fix:** separate the two halves. The nullable-object case is already allowed; what
remains is genuinely a question about whether `""`, `0` and `false` are real values
in your domain. If they are not, the rule is noise for you and the honest move is
to configure it, not to disable it.

**Symptom:** a `boolean | undefined` condition is reported and the fix looks
pointless.
**Cause:** an optional boolean has **three** states, and truthiness collapses two
of them.
**Fix:** usually the API is wrong, not the condition — give the flag a default so
its type is `boolean`. That removes the report and a whole class of *"is unset the
same as false?"* questions with it.

**Symptom:** the rule and `no-unnecessary-condition` disagree about the same line.
**Cause:** they answer different questions — decided versus ambiguous.
**Fix:** read which rule fired. If it is `no-unnecessary-condition`, delete the
check; if it is this rule, make it explicit. Doing the reverse in either case
produces a worse line than you started with.

**Symptom:** a numeric enum condition is reported and the member being tested is
not zero.
**Cause:** the rule reasons about the *type*, not about the value in front of it —
the enum has a zero-valued member somewhere, so the test is ambiguous for the type.
**Fix:** compare to the member you mean. ⚠️ And note that the zero member is
usually the **first** one declared, which is exactly the one that means "the normal
case".

## Interview questions

**What does `strict-boolean-expressions` actually forbid?**
Using a value in a boolean context when the value's type can hold a falsy member
that is not `null` or `undefined` — so an empty string, a zero, a `NaN`, a `false`
or a zero-valued enum member would be indistinguishable from absent. It does not
object to truthiness itself; it objects to truthiness on a type where the answer is
ambiguous.

**Does the compiler do any of this?**
No. There is no flag anywhere in TypeScript that makes `if (someString)` an error,
because it is not an error — it is legal JavaScript with a defined meaning. The
only conditions the compiler complains about are ones whose answer it can already
compute, which is a different thing entirely. This rule is in the same category as
`no-floating-promises`: the compiler has nothing to say, so a linter is the only
place the check can live.

**Why is `allowNullableObject` the one option that defaults to `true`?**
Because objects have no falsy members, so `if (user)` on `User | undefined` is
exactly `user != null`. There is no ambiguity to report, and forbidding it would
generate noise on the single most common and most correct use of truthiness in the
language.

**What does the default configuration actually catch?**
Confusion about *absence* — nullable strings, numbers, booleans and enums — while
permitting confusion about *emptiness*, because `allowString` and `allowNumber`
both default to `true`. So the bugs the rule is famous for, like an empty username
passing a presence check, are allowed by default. You have to set those two options
to `false` yourself, and that is the change people think they are getting when they
first enable the rule.

**How do you adopt it on an existing codebase?**
In two passes. The defaults are the cheap pass: nullable values in conditions are
usually few and each report is a real ambiguity. Then `allowString: false` and
`allowNumber: false` as a separate scheduled change, because that pass is large and
mostly mechanical. Doing both at once produces a review nobody can read and
guarantees the rule gets disabled.

**A report says a `string | undefined` condition is unsafe. What is the fix?**
It depends on what an empty string means in your domain, and that is the point of
the report. If `""` is not a real value, `value != null` is right. If it is, you
need to decide which case you are testing for and say so. ⚠️ Note that the two fixes
have **different runtime behaviour** — this is not a formatting change, which is
why it cannot be blindly auto-applied.

**Why is this rule in no preset when the other three are?**
Its own documentation page names none, so treat it as opt-in. The defensible reason
is that its reports are stylistic for most codebases and load-bearing for some, and
which one you are depends on your conventions rather than on your correctness — a
preset cannot decide that. Contrast `no-floating-promises`, where the report is a
bug in every codebase, and which is therefore in `recommended-type-checked`.

**Does enabling `noUncheckedIndexedAccess` interact with this rule?**
Yes, and predictably: it retypes `arr[i]` as `T | undefined`, so every truthiness
check on an indexed access becomes a nullable condition and is newly reported. Both
findings are correct, but the interaction is worth sequencing — turn the flag on,
fix its own fallout, then look at the lint count, or you will not be able to tell
which change caused what.

**Is `if (arr.length)` a problem?**
Not a correctness problem, but it is a `number` in a boolean context and
`allowNumber: false` will report it. `arr.length > 0` is what it means, is the same
number of characters, and does not depend on the reader knowing that `0` is falsy.
It is the clearest example of a report that is stylistic on its own and valuable as
a policy, because the same idiom applied to a value that can be `NaN` is a bug.

---

← [04 · `no-unnecessary-condition`](./04-no-unnecessary-condition.md) · [Topic index](./README.md) · Next → **06 · The conditions you get wrong** *(not written yet)*
