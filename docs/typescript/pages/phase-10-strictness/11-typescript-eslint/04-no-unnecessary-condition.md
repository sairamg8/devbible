---
title: "no-unnecessary-condition — and what the compiler already does"
sidebar_label: "04 · no-unnecessary-condition"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own rule page** for
> `no-unnecessary-condition` — description, preset (`strict-type-checked`), every
> option default, and its `strictNullChecks` requirement, all quoted from it — and
> against the **TypeScript 5.9.3 diagnostic table**, from which the seven
> always-decided-condition codes were read
> ([topic 10 chunk 11](../10-the-error-codes/11-the-condition-is-decided.md)), all
> confirmed present in the **7.0.2** binary. ⚠️ typescript-eslint is not installed
> here, so rule metadata is from documentation. **No sandbox, no console block.**

Description, verbatim: *"Disallow conditionals where the type is always truthy or
always falsy."*

> 🔴 **The usual framing of this rule — "the compiler will not do this" — is
> wrong, and this page will not use it.** The compiler does a real slice of it,
> under seven codes. What is left over is a different question, and stating the
> boundary precisely is the only way to decide whether the rule is worth its cost.

## 🔴 What the compiler already reports

Seven codes, all read from the diagnostic table and all present in 7.0.2:

| Code | Template |
|---|---|
| `TS2872` | `This kind of expression is always truthy.` |
| `TS2873` | `This kind of expression is always falsy.` |
| `TS2774` | `This condition will always return true since this function is always defined. Did you mean to call it instead?` |
| `TS2801` | `This condition will always return true since this '{0}' is always defined.` |
| `TS2839` | `This condition will always return '{0}' since JavaScript compares objects by reference, not value.` |
| `TS2845` | `This condition will always return '{0}'.` |
| `TS2367` | `This comparison appears to be unintentional because the types '{0}' and '{1}' have no overlap.` |

So `if (someFunction)`, `if (/regex/)`, `if (promise)`, `{a:1} === {a:1}` and
`status === "deleted"` on a union that has no `"deleted"` are **already errors on a
plain `strict` project with no lint rule at all.**

## 🔴 What is left over — and it is the majority of the rule's value

**The compiler reasons about two things: the *kind* of an expression, and types
with *zero* overlap.** It does not reason about **narrowing you have already
performed**. That is the gap:

```ts
function f(user: User | undefined) {
  if (!user) return;
  // …fifty lines…
  if (user) {                 // ← always true. tsc says NOTHING.
    doSomething(user);
  }
}
```

`user`'s type here is `User`, not `User | undefined`, because the early return
narrowed it. `if (user)` is therefore decided — but its *kind* is an ordinary
identifier, and `User` is not a type with zero overlap with truthiness. **Neither
compiler check applies.**

The same gap, in the two forms you will actually meet:

```ts
// 1. a redundant guard on a non-optional field
interface Config { retries: number }        // not optional
if (config.retries) { … }                   // decided; tsc silent

// 2. optional chaining on something that cannot be nullish
user?.name                                  // decided; tsc silent
```

🔴 **Form 2 is the one that earns the rule on a real codebase.** `?.` spreads
defensively during refactors and then stays after the type stops being nullable, at
which point it is pure noise that also *hides* the fact that the value is
guaranteed. Nothing but this rule finds it.

📌 **So the honest summary:** the compiler catches the conditions that were *never*
meaningful; the rule additionally catches the conditions that **stopped** being
meaningful. **The second category is what accumulates as a codebase changes**, which
is why the rule keeps paying rather than firing once at adoption.

## Why it is in `strict-type-checked` and not `recommended`

Because it can report things that are not bugs — and its own documentation says so,
attributing it to the type system:

> the rule flags expressions that always evaluate to truthy or falsy per
> TypeScript's type analysis — however, **TypeScript's type system contains
> intentional unsoundness** regarding object types and primitives, potentially
> causing false positives.

🔴 **That is [topic 07](../07-unsound-by-design/README.md) arriving as a lint
problem, and the connection is exact.** The rule trusts the declared type. Where the
declared type is a lie, the rule confidently reports a check that is genuinely
necessary:

| The hole (from topic 07) | The false positive it produces |
|---|---|
| **index access** — `arr[i]` is `T`, not `T \| undefined`, without `noUncheckedIndexedAccess` | `if (arr[i])` reported as unnecessary, when it can absolutely be `undefined` |
| **an `as` upstream** | anything downstream of an assertion narrower than reality |
| **`Object.keys` → `string[]`** and untyped boundary data | a guard on a field the API can omit but the type says is required |
| **mutation through an alias** | a re-check after a call that could have nulled the field |

⚠️ **So the fix for a false positive is almost never to disable the rule.** It is to
fix the lie:

1. **Turn on `noUncheckedIndexedAccess`** ([topic 02](../02-nouncheckedindexedaccess.md))
   — this removes the largest single source of false positives from this rule, and
   it is the same fix topic 02 argues for on its own merits.
2. **Validate at the boundary** rather than asserting
   ([chunk 03 of topic 10](../10-the-error-codes/03-two-types-with-one-name.md)).
3. **Widen the type to the truth** if the field really is optional.

🔴 **This is the most useful thing on the page: `no-unnecessary-condition`'s false
positives are a *detector for unsound types*.** Every one points at a place where
the declared type and reality differ. Read them as findings, not noise.

## The options

| Option | Default |
|---|---|
| `allowConstantLoopConditions` | `'never'` — also `'always'`, or `'only-allowed-literals'` |
| `checkTypePredicates` | `false` |
| `allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing` | `false` — ⚠️ **deprecated, removed in the next major** |

📌 **`allowConstantLoopConditions: 'only-allowed-literals'` is the option most worth
knowing**: it permits the idiomatic `while (true)` and its `false`/`0`/`1`
equivalents, which are deliberate rather than mistaken. The default `'never'` flags
them.

## 🔴 The rule is nearly useless without `strictNullChecks`

Its documentation is blunt about this: without `strictNullChecks`, *"TypeScript
essentially erases `undefined` and `null` from the types"*, which makes the rule
non-functional — and the escape hatch is named
`allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing`, **deprecated and being
removed**.

📌 **An option name that long is a design statement.** Without `strictNullChecks`
every value looks non-nullable, so every null guard looks unnecessary — the rule
would report the entire codebase's defensive code as redundant, which is the
opposite of correct.

⚠️ **Consequence for adoption order:** `strictNullChecks` first (it is one of the
nine flags `strict` turns on — [topic 01](../01-strict-flag-by-flag/README.md)),
then `noUncheckedIndexedAccess`, then this rule. Turning it on before the flags is
how teams conclude the rule is broken.

## Gotchas

**Symptom:** the rule reports a null check you are certain is needed.
**Cause:** the declared type is narrower than reality — most often an unchecked
index access, or an `as` upstream.
**Fix:** `noUncheckedIndexedAccess`, or validation at the boundary. 🔴 **Treat the
report as a finding about your types**, not as a false alarm to suppress.

**Symptom:** enabling the rule reports hundreds of `?.` uses.
**Cause:** optional chaining that outlived the nullability it was defending
against.
**Fix:** delete the `?.`. This is the rule's highest-value output and nothing else
in the toolchain finds it.

**Symptom:** the rule flags a check that a colleague's `strict`-only project also
flags.
**Cause:** you are looking at one of the seven compiler codes, not the rule.
**Fix:** check the code in the message. If it is `TS2872`, `TS2801`, `TS2839` or one
of the others, the compiler found it and the rule is not what you are seeing.

**Symptom:** `while (true)` is reported.
**Cause:** `allowConstantLoopConditions` defaults to `'never'`.
**Fix:** `'only-allowed-literals'`, which permits `true`, `false`, `0` and `1` in
loop conditions.

**Symptom:** the rule reports almost everything and none of it makes sense.
**Cause:** `strictNullChecks` is off, so every type looks non-nullable and every
null guard looks redundant.
**Fix:** enable `strictNullChecks`. The escape hatch that lets the rule run without
it is deprecated and being removed, deliberately.

**Symptom:** a redundant check remains after a refactor and nobody notices.
**Cause:** exactly the gap this rule fills — the check was meaningful when written
and stopped being so.
**Fix:** the rule. And note that this is *why* the rule keeps finding things rather
than firing once: the category grows as the codebase changes.

**Symptom:** the team argues the rule is redundant because `strict` already flags
constant conditions.
**Cause:** partly true, and the boundary is precise.
**Fix:** the compiler reasons about expression *kind* and *zero-overlap* types; the
rule additionally reasons about narrowing already performed. The second is where
the value is, and it is invisible to `tsc`.

**Symptom:** a type predicate's argument is not checked.
**Cause:** `checkTypePredicates` defaults to `false`.
**Fix:** turn it on if you write your own guards; a predicate whose argument is
already the asserted type is a guard that does nothing.

## Interview questions

**Does TypeScript catch constant conditions on its own?**
Some of them, under seven codes: `TS2872`/`TS2873` for expressions whose *kind* is
always truthy or falsy, `TS2774` for an uncalled function, `TS2801` for a
non-awaited promise, `TS2839` for object reference equality, `TS2845` for the
general case, and `TS2367` for a comparison between types with no overlap. So
`if (someFn)`, `if (/re/)` and `{a:1} === {a:1}` are already errors on a plain
`strict` project.

**Then what does `no-unnecessary-condition` add?**
Narrowing-awareness. The compiler reasons about the kind of an expression and about
types with zero overlap; it does not reason about narrowing you have already done.
So an `if (user)` fifty lines after an `if (!user) return`, a truthiness check on a
non-optional field, and an `?.` on a value that can no longer be nullish are all
invisible to `tsc` and all caught by the rule. That category *grows* as a codebase
is refactored, which is why the rule keeps paying rather than firing once.

**Why is the rule in `strict-type-checked` rather than `recommended-type-checked`?**
Because it can report checks that are genuinely necessary. Its documentation
attributes this to TypeScript's intentional unsoundness around object types and
primitives — the rule trusts the declared type, and where the declared type is a
lie the report is wrong. The preset placement is a statement about confidence.

**How do you deal with its false positives?**
By fixing the types rather than suppressing the rule, because every false positive
points at a place where the declared type and reality differ. The largest single
source is unchecked index access — `arr[i]` is typed `T` rather than
`T | undefined` — so enabling `noUncheckedIndexedAccess` removes a whole class of
them. After that, the causes are upstream assertions and unvalidated boundary data,
both of which are worth fixing anyway.

**Why does the rule need `strictNullChecks`?**
Because without it TypeScript erases `null` and `undefined` from types, so every
value looks non-nullable and every null guard looks redundant — the rule would
report the codebase's entire defensive layer as unnecessary. The option that lets it
run anyway is named
`allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing`, and it is deprecated and
being removed, which is about as clear a design statement as an option name can
make.

**What is the single highest-value thing this rule finds?**
Optional chaining that has outlived its nullability. `?.` proliferates during
refactors and then stays after the value stops being nullable, at which point it is
noise that also conceals the fact that the value is guaranteed. Nothing else in the
toolchain finds it, and it is invisible to review because it looks like ordinary
caution.

---

← [03 · `no-misused-promises`](./03-no-misused-promises.md) · [Topic index](./README.md) · Next → [05 · `strict-boolean-expressions`](./05-strict-boolean-expressions.md)
