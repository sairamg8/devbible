---
title: "Freshness"
sidebar_label: "01 · Freshness"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own diagnostic table** in the
> **TypeScript 5.9.3** build — 🔴 **two** excess-property messages, not one:
> `TS2353` *"Object literal may only specify known properties, and `'{0}'` does
> not exist in type `'{1}'`."* and `TS2561` *"…but `'{0}'` does not exist in type
> `'{1}'`. Did you mean to write `'{2}'`?"* — plus `TS2322` and `TS2345` for the
> ordinary assignability failures this rule sits on top of. The **TypeScript
> handbook**'s *Object Types → Excess Property Checks* section is the reference
> for the rule itself. **No sandbox, no console block.**

The rule that makes an object literal error where an identically-shaped variable
does not. It looks like an inconsistency, and it is deliberate.

> **Excess property checking is not part of assignability.** It is a separate
> heuristic that fires only on a **fresh object literal**, and its entire purpose
> is catching typos that structural typing would otherwise permit.

## The behaviour, first

```ts
interface Options { retries?: number; timeoutMs?: number }
declare function connect(o: Options): void;

connect({ retries: 3, timeoutMS: 500 });   // TS2561 — capital S
//                     ~~~~~~~~~

const opts = { retries: 3, timeoutMS: 500 };
connect(opts);                              // ✅ no error
```

Same object, same target type, two different outcomes. The second is what
**assignability** says: `{ retries: number, timeoutMS: number }` has a `retries`
that fits and an extra property, and structural typing permits extra properties
([phase 1 · Structural typing](../../phase-1-type-vocabulary/09-structural-typing.md)).
The first is the extra rule.

## Why the extra rule exists

Structural typing has a consequence that is correct and unhelpful: **every object
is allowed to carry more than its type declares.** That is what makes
`{ x, y, z }` assignable to `{ x, y }`, which is a feature — and it is also what
makes `timeoutMS` a legal extra property rather than a typo.

So the compiler adds a heuristic in the one place where an extra property is
almost never intentional:

> **You just wrote this object literal, right here, for this parameter. If it has
> a property the target does not want, you probably misspelled something.**

📌 **That reasoning only holds for a literal at the point of use**, which is
exactly why the rule is limited to it. A variable might have been built for
several purposes and legitimately carry more; a literal written inline at a call
site was written for that call.

🔴 **So the "inconsistency" is the rule working as designed.** Excess property
checking trades away consistency for typo detection in the case where typos
actually happen, and declines to guess anywhere else.

## The two diagnostics, and the one worth noticing

| Code | Message | Fires when |
|---|---|---|
| `TS2353` | *"Object literal may only specify known properties, and `'{0}'` does not exist in type `'{1}'`."* | the extra property resembles nothing in the target |
| **`TS2561`** | *"Object literal may only specify known properties, but `'{0}'` does not exist in type `'{1}'`. **Did you mean to write `'{2}'`?**"* | the extra property is **close to a real one** |

🔴 **`TS2561` means the compiler ran a similarity check and found your intended
property.** That is the single most useful thing this rule produces — it does not
merely reject the object, it names the property you meant. `timeoutMS` →
*"Did you mean to write `timeoutMs`?"*

⚠️ **Which code you get tells you something diagnostically.** `TS2561` is almost
always a typo. `TS2353` is more often a genuine misunderstanding about the target
type — you are passing a property that type has never had, which usually means
you are looking at the wrong interface, or the object is meant for a different
function.

## What it is *not*

Three misreadings, each of which sends people the wrong way:

- **It is not a "no extra properties" rule.** The target type does not become
  exact. `Options` still accepts objects with extra properties; only *fresh
  literals* are checked.
- **It is not `exactOptionalPropertyTypes`.** That governs whether an optional
  property may hold `undefined`
  ([topic 05](../05-exactoptionalpropertytypes/README.md)); this governs whether
  a literal may carry an undeclared key. Different rules, easily confused because
  both involve optional properties and object literals.
- **It is not related to `readonly` or to excess *arguments*.** Passing too many
  arguments to a function is `TS2554`, an unrelated arity check.

## It applies to nested literals too

The check follows the literal down:

```ts
interface Config { server: { host: string; port: number } }

const c: Config = {
  server: { host: 'x', port: 1, protocal: 'https' },   // TS2561 on the INNER literal
};
```

📌 **Freshness is a property of each object literal, not of the outermost one.**
So a deeply-nested config object gets the typo check at every level — which is
where it earns the most, because nested config is exactly where a misspelled key
silently does nothing.

## And to arrays of literals

```ts
const items: Options[] = [
  { retries: 1 },
  { retries: 2, timeoutMS: 5 },     // TS2561 on this element
];
```

Each element is its own fresh literal. This matters more than it sounds, because
fixture arrays and seed data are written this way and a wrong key in one row is
otherwise invisible.

## Gotchas

**Symptom:** an object errors inline but the same object via a variable does not.
**Cause:** freshness. The check applies to literals at the point of use only.
**Fix:** none needed — but if you want the check on the variable, annotate it or
use `satisfies` ([chunk 04](./04-designing-for-it.md)).

**Symptom:** `TS2561` names a property you have never heard of.
**Cause:** the similarity check found the closest match, which may be from a part
of the type you did not know existed.
**Fix:** read the target type. `TS2561` is a strong hint, not a certainty.

**Symptom:** `TS2353` where you expected a "did you mean" suggestion.
**Cause:** your extra property resembles nothing in the target — usually the
wrong interface, not a typo.
**Fix:** check you are passing to the function you think you are.

**Symptom:** the typo is in a nested object and was still caught.
**Cause:** correct — freshness applies to every literal, at every depth.
**Fix:** none. This is the rule at its most valuable.

**Symptom:** the check is not firing anywhere in the project.
**Cause:** `suppressExcessPropertyErrors` — see
[topic 08 chunk 03](../08-suppression-directives/03-the-suppression-tiers.md).
**Fix:** remove it. It disables one of the highest-value checks TypeScript
performs, project-wide, with no per-site record.

**Symptom:** an extra property in an array element was not caught.
**Cause:** the array was built and then assigned, so the elements are no longer
fresh at the point of the annotation.
**Fix:** annotate at the declaration — `const items: Options[] = [ … ]` — so the
literals are checked in place.

## Interview questions

**Why does an object literal error where an identically-shaped variable does
not?**
Because excess property checking is not part of assignability — it is a separate
heuristic that fires only on a fresh object literal. Structural typing
deliberately permits extra properties, so the variable is genuinely assignable.
The literal gets an extra check because a literal written inline for this call
was written *for* this call, and an unexpected property in it is almost always a
typo.

**What are the two excess-property diagnostics and what does the difference tell
you?**
`TS2353` when the extra property resembles nothing in the target, and `TS2561`
when it is close to a real one — the latter includes *"Did you mean to write
'{2}'?"* with the intended name. `TS2561` is almost always a typo; `TS2353` more
often means you are passing to the wrong function or looking at the wrong
interface.

**Does the check make the target type exact?**
No. `Options` still accepts objects with extra properties; only fresh literals
are checked. It is a typo heuristic applied at one syntactic position, not a
change to what the type means.

**Does it apply to nested objects?**
Yes — freshness is a property of each object literal, at every depth, and of each
element in an array literal. That is where it earns the most, because a
misspelled key in nested configuration or in a fixture row is otherwise
completely silent.

**How does this differ from `exactOptionalPropertyTypes`?**
They are unrelated rules that are easy to confuse because both involve optional
properties and literals. `exactOptionalPropertyTypes` governs whether an optional
property may hold an explicit `undefined`. Excess property checking governs
whether a fresh literal may carry a key the target never declared.

---

← [Topic index](./README.md) · Next → [02 · Where freshness is lost](./02-where-freshness-is-lost.md)
