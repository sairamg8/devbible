---
title: "The second and third rules"
sidebar_label: "03 · The second and third rules"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own diagnostic table** in the
> **TypeScript 5.9.3** build for `TS2559` *"Type `'{0}'` has no properties in
> common with type `'{1}'`."*, `TS2739` *"Type `'{0}'` is missing the following
> properties from type `'{1}'`: {2}"* and `TS2741` *"Property `'{0}'` is missing
> in type `'{1}'` but required in type `'{2}'`."* 🔴 **Weak type detection and
> its exact limit were MEASURED in phase 1** and are cited from
> [phase 1 · Object types](../../phase-1-type-vocabulary/04-object-types.md)
> rather than re-derived — that page is **sandbox-proven** and carries the
> recorded output. **No sandbox and no console block on this page.**

Three different rules produce errors that all read as *"your object is wrong"*,
and telling them apart is what makes the error message useful rather than
annoying.

> **Excess property checking is one of three overlapping guards, and it is the
> only one limited to fresh literals.** The other two apply to variables as well —
> which is why "the variable was not checked" is true for typos in *some* target
> types and false in others.

## Rule 2 · Weak type detection

A **weak type** is one whose properties are *all* optional. Assigning a value
with **no properties in common** to such a type is rejected:

```ts
interface Options { retries?: number; timeoutMs?: number }
declare function run(o: Options): void;

const bad = { timeoutMS: 500 };   // capital S
run(bad);                          // TS2559 — even through a variable
```

`TS2559` — *"Type `'{ timeoutMS: number; }'` has no properties in common with
type `'Options'`."*

🔴 **This is why the freshness story from [chunk 01](./01-freshness.md) is not the
whole picture.** Passing the typo through a variable escapes excess property
checking and is caught anyway, because `Options` is weak.

**Why the rule exists:** without it, a type whose properties are all optional is
satisfied by literally every object, including `{}` and including one containing
nothing but typos. Weak type detection restores a minimum: you must have got *at
least one* property right.

### 🔴 Where it stops — measured, and worth knowing exactly

Add **one required property** and the rule no longer applies:

```ts
interface Mixed { id: string; timeoutMs?: number }
const m = { id: 'P-1', timeoutMS: 500 };   // typo in the optional property
runMixed(m);                                // ✅ no error. Silent.
```

The type is no longer weak, so `TS2559` does not fire; the object shares `id`, so
there is something in common; and the value came through a variable, so excess
property checking does not fire either. **All three guards miss it.**

📌 **The honest summary, which is the sentence to remember:** *a typo in an
optional property is caught on a literal always, and through a variable only when
every property of the target is optional.*

[Phase 1 · Object types](../../phase-1-type-vocabulary/04-object-types.md) is
where this was measured and owns the recorded evidence; this page owns its place
in the set of three rules.

## Rule 3 · Missing required properties

The opposite direction, and the only one of the three that is plain
assignability rather than a heuristic:

| Code | Message | Fires when |
|---|---|---|
| `TS2741` | *"Property `'{0}'` is missing in type `'{1}'` but required in type `'{2}'`."* | **one** property is missing |
| `TS2739` | *"Type `'{0}'` is missing the following properties from type `'{1}'`: {2}"* | **several** are missing, listed |

```ts
interface User { id: string; name: string; email: string }

const u: User = { id: 'a' };
// TS2739: … is missing the following properties from type 'User': name, email
```

📌 **`TS2739` lists them, which makes it one of the more pleasant errors to
read** — no property path to chase, the names are in the message. If you see
`TS2741` instead, exactly one is missing and it is named.

⚠️ **This rule applies to variables and literals equally.** It is not a
freshness heuristic; a missing required property is a genuine assignability
failure, and no refactor into a variable escapes it.

## Telling the three apart from the error alone

| You see | Rule | Applies to a variable? | What it means |
|---|---|---|---|
| `TS2353` / `TS2561` | excess property | ❌ literals only | an **extra** key — usually a typo, and `TS2561` names the intended one |
| `TS2559` | weak type | ✅ | **nothing** matched — the target is all-optional and you got none of it right |
| `TS2741` / `TS2739` | assignability | ✅ | a **required** key is missing, and the message names which |

🔴 **The diagnostic axis is: extra / nothing / missing.** Once you can place an
error on that axis from its code alone, the 40-line assignability messages from
[topic 04](../04-reading-a-typescript-error.md) become much faster to read —
because the innermost message is almost always one of these three.

## The gap all three leave

Collecting the negative result, since it is the practically useful part:

**A typo in an optional property, on a target that has at least one required
property, passed through a variable, is caught by nothing.**

That combination is not exotic — it is an options object with an `id` or a `url`
on it, built in a helper and passed on. Three defences:

1. **`satisfies` at the declaration** ([chunk 02](./02-where-freshness-is-lost.md))
   — restores the literal check where the object is written, which is the one
   place the information exists.
2. **Do not build option objects in helpers.** Write them at the call site where
   they are fresh.
3. **Avoid all-optional-plus-one-required shapes** where you can — either the
   options bag is genuinely all-optional (and weak type detection protects it) or
   the required field belongs somewhere else in the signature.

## Gotchas

**Symptom:** a typo through a variable was caught, contradicting "freshness only".
**Cause:** weak type detection — the target's properties are all optional.
**Fix:** none needed. Know that this second rule exists so the behaviour is not
mysterious.

**Symptom:** adding a required field to an interface made typos stop being
caught.
**Cause:** the type is no longer weak, so `TS2559` no longer applies.
**Fix:** the measured gap. Use `satisfies` where such objects are constructed.

**Symptom:** `TS2559` on an object that is obviously correct.
**Cause:** every property is misspelled, or the object is for a different type
entirely.
**Fix:** "no properties in common" is a strong signal you are passing the wrong
object, not that one key is wrong.

**Symptom:** `TS2739` lists properties that already exist on the value.
**Cause:** they exist with the wrong types, so they do not satisfy the target;
the message lists what is missing *as required*.
**Fix:** read the types, not just the names.

**Symptom:** refactoring a literal into a variable removed one error and left
another.
**Cause:** excess property checking is gone; the missing-required check is not.
The two behave differently on purpose.
**Fix:** expected. Only the extra-property rule is freshness-limited.

**Symptom:** an empty object `{}` satisfies an options type.
**Cause:** all properties are optional, and `{}` trivially conforms. Weak type
detection specifically permits this — it rejects *no properties in common*, and
an empty object has no properties to conflict.
**Fix:** if a field is genuinely required, make it required.

## Interview questions

**What is weak type detection and why does it exist?**
A rule that rejects a value with no properties in common with a target type whose
properties are all optional. Without it, an all-optional type is satisfied by
every object including `{}` and including one made entirely of typos. It
restores a minimum: you must have got at least one property right.

**Where does weak type detection stop?**
The moment the target has one required property, it is no longer a weak type and
the rule does not apply. So a typo in an optional property, on a type with one
required field, passed through a variable, is caught by none of the three rules —
which is a real and reachable gap, not a corner case.

**Which of the three rules apply to variables, and which only to literals?**
Only excess property checking is freshness-limited. Weak type detection and the
missing-required-property check both apply to variables, because both are about
what the value actually is rather than about where it was written.

**How do you read the three from the error code alone?**
`TS2353`/`TS2561` means an extra key — literals only, and `TS2561` names the
property you probably meant. `TS2559` means nothing matched, on an all-optional
target. `TS2741`/`TS2739` means required keys are missing, and the message names
them. Extra, nothing, missing — that axis covers the innermost message of most
object assignability errors.

**What is the practical defence for the gap the three rules leave?**
`satisfies` at the point the object is declared. That is the one place where the
literal is fresh and the information exists, and it restores the check without
widening the type. Failing that, construct option objects at the call site rather
than in helpers.

---

← [02 · Where freshness is lost](./02-where-freshness-is-lost.md) · Next → [04 · Designing for it](./04-designing-for-it.md)
