---
title: "What an `as` is standing in for"
sidebar_label: "02 · What an `as` stands in for"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (type assertions, type
> predicates, `satisfies`) and the **5.5 release notes** for **inferred type
> predicates**, which is the one case where a claim the compiler used to take on
> trust became a claim it verifies. Diagnostics are read from the **5.9.3** table
> (`sandbox/ts-p0`). ⚠️ Mechanism lives in
> [Phase 2 · 08](../../phase-2-narrowing/08-as-assertions/README.md); this page is
> about the decision. **No sandbox run, no console block.**

An assertion is never the goal. **It is always standing in for something that would
have been better**, and naming that something is what turns a review argument into
a decision. There are six substitutions, and they need entirely different answers.

> 🔴 **The review question, and it is the only one worth asking:**
> *what would have to be true for this assertion to be deleted?*
>
> If the answer is a **guard**, write the guard. If it is a **validator**, write the
> validator. If it is **a better type upstream**, fix the type. If the answer is
> *"nothing — it can never be deleted"*, then it is a **design decision written in
> the wrong place**, which is the same verdict [topic 08](../08-suppression-directives/README.md)
> reaches about a permanent `@ts-ignore`.

## 1 · Standing in for a guard the compiler would have done for free

```ts
if (shape.kind === 'circle') {
  const c = shape as Circle       // ← the compiler already knew
  return Math.PI * c.radius ** 2
}
```

**Discriminated-union narrowing is automatic** ([phase 2 · 05](../../phase-2-narrowing/05-discriminated-unions.md)),
so this assertion buys nothing and costs the guarantee — if the union gains a member,
the narrowing adapts and the assertion does not.

⚠️ **The tell is an `as` immediately inside a matching `if`.** It usually means the
union is not discriminated (add a `kind`), or the check tested something the
compiler cannot follow ([phase 2 · 11 · narrowing lost](../../phase-2-narrowing/11-narrowing-lost/README.md)).

## 2 · Standing in for validation at a boundary

```ts
const user = await res.json() as User          // 🔴 a claim about data nobody has seen
const config = JSON.parse(raw) as Config
```

**The most common assertion in any codebase and the only one that is a lie about
the outside world.** Every other case on this page is a claim about values already
inside the program; this one asserts the shape of bytes that arrived over a
network, from a file, or from another team's deploy.

**Fix:** parse, do not assert. A validator returns a value the type describes; an
assertion describes a value nobody checked. ⚠️ And note the failure mode is not
"a type error later" — it is a `TypeError` in a component three layers away, with a
stack trace that points nowhere near the assertion.

📌 This is the applied argument in
[phase 7 · Typing `process.env`](../../phase-7-server/03-typing-process-env/03-why-parsing-wins.md),
where the same choice is made on a real server.

## 3 · Standing in for a type predicate — and 🔴 the one that became a check

Moving the assertion into a user-defined guard is better, because the claim is
written once and reviewed once instead of at every call site:

```ts
function isUser(v: unknown): v is User { … }
```

⚠️ **But be honest about what that buys.** A hand-written predicate is *still* an
assertion — the compiler does not verify that the body proves the claim, exactly as
it does not verify an assertion function's body
([phase 2 · 09](../../phase-2-narrowing/09-assertion-functions/README.md)). It
concentrates the risk; it does not remove it.

🔴 **TypeScript 5.5 changed this for the simple cases.** Where a function's body is
a straightforward narrowing and the return type is not annotated, the compiler now
**infers** the predicate:

```ts
function isDefined<T>(v: T | undefined) {
  return v !== undefined          // 5.5+ infers `v is T` — checked, not asserted
}
```

📌 **That is the only place in the language where a claim previously taken on trust
became one the compiler works out itself**, and it is a reason to *remove* explicit
`v is T` annotations from simple guards rather than add them: an inferred predicate
cannot disagree with its own body, and a written one can.

## 4 · Standing in for a better type upstream

```ts
const el = document.getElementById('root') as HTMLCanvasElement
const rows = await db.query(sql) as UserRow[]
```

Here the assertion is compensating for a signature that is wider than the call
site's knowledge. **The fix is upstream**: a generic parameter on the query helper,
a typed wrapper around the lookup, a narrower return type.

🔴 **The economic argument for fixing it there:** one assertion at a call site
protects one line; one better signature removes the assertion from every call site,
including the ones not written yet. **An `as` that appears more than twice against
the same function is a signature bug, not a call-site bug.**

## 5 · Standing in for `satisfies`

```ts
const routes = { home: '/', about: '/about' } as Record<string, string>
```

The `as` **widens** — `routes.home` is now `string`, and the literal types you had
are gone, along with the excess property check
([topic 09](../09-excess-property-checks/README.md)). `satisfies` checks the same
constraint and keeps them. This substitution is pure loss, and it is the easiest of
the six to fix: change the keyword.

## 6 · `as const`, which is not this family at all

```ts
const METHODS = ['GET', 'POST'] as const
```

⚠️ **`as const` shares the keyword and does the opposite thing.** It does not assert
a type the compiler doubts — it asks for a **more precise** inference than the
default, and `TS1355` restricts it to literals, so it cannot be aimed at anything
it might be wrong about. 🔴 **It is the one `as` that cannot be a lie.**

📌 **Practical consequence for any policy:** a metric that greps for `as ` will
count `as const` and report a codebase as undisciplined for using the safest
construct in the language. **Exclude it explicitly, in the tooling and in the rule
you write down.**

## The six, and what each one needs

| The `as` is standing in for | The real fix | Difficulty |
|---|---|---|
| a guard the compiler does automatically | discriminate the union, or restructure the check | small |
| **validation at a boundary** | a parser — 🔴 the highest-value fix on this page | medium |
| a type predicate | extract a guard; **prefer 5.5's inferred one** | small |
| a better type upstream | fix the signature, once, for every caller | medium, pays repeatedly |
| `satisfies` | change the keyword | trivial |
| **nothing — `as const`** | leave it alone, and exclude it from the count | none |

---

⚠️ **The one honest exception: test doubles.** A partial mock asserted into a full
interface is a real and common use, and it does not have a better spelling. But be
clear about the cost — the test now claims a contract it does not honour, so it
keeps passing when the real interface grows. **Prefer building the object from a
factory that the compiler checks**, and keep the asserted mocks where the alternative
is genuinely worse.

## Gotchas

**Symptom:** an `as` sits immediately inside an `if` that already checked the thing.
**Cause:** the union is not discriminated, or the check is one the compiler cannot
follow.
**Fix:** add the discriminant. The assertion adapts to nothing; narrowing adapts to
a new union member.

**Symptom:** the same `as` appears against one function in a dozen files.
**Cause:** the signature is wider than every call site's knowledge.
**Fix:** 🔴 fix the signature. Twelve assertions is twelve places to be wrong; one
generic parameter is one place to be right.

**Symptom:** `as` on a `JSON.parse` or `res.json()` result, and it looks harmless
because it has never failed.
**Cause:** it has never been given bad data yet.
**Fix:** parse it. This is the only assertion on the page that is a claim about the
outside world, and it is the one that fails in production rather than in CI.

**Symptom:** a config object lost its literal types after someone "added types" to
it.
**Cause:** `as Record<…>` widens.
**Fix:** `satisfies`. And note that the widening also removed the excess property
check, so a typo in a key is now silent too.

**Symptom:** the assertion count went up and it was all `as const`.
**Cause:** the metric greps for `as `.
**Fix:** exclude `as const` — it is a request for *more* precision and cannot be
wrong. A policy that penalises it is training people away from the safe construct.

**Symptom:** a hand-written `v is User` guard is wrong and nothing caught it.
**Cause:** the compiler does not check a predicate's body against its claim.
**Fix:** for simple guards, drop the annotation and let 5.5 infer the predicate —
an inferred one cannot disagree with the body. For complex ones, the guard is the
place to concentrate review, because it is now the only thing standing behind every
call site.

**Symptom:** every assertion in review gets the same comment and nothing changes.
**Cause:** "avoid `as`" is not actionable.
**Fix:** ask which of the six it is. Each has a different fix and two of them are
one-line changes, so the taxonomy converts an unwinnable style argument into a
short list of tasks.

## Interview questions

**Someone shows you an `as` in review. What do you ask?**
What would have to be true for it to be deleted. If the answer is a guard, a
validator or a better upstream type, that is the fix and the assertion is a
placeholder. If the answer is "nothing, it can never go", the assertion is encoding
a design decision in the wrong place — the same verdict this phase reaches about a
permanent suppression comment.

**Which assertion is the most dangerous, and why?**
`as` on parsed external data — `JSON.parse(...) as Config`, `await res.json() as
User`. Every other assertion is a claim about a value already inside the program;
that one is a claim about bytes nobody has inspected. It also fails at the worst
distance from its cause: a `TypeError` several layers away, with a stack that points
nowhere near the assertion.

**Is a type predicate safer than an inline assertion?**
Better, not safe. The compiler does not check that a hand-written predicate's body
proves its claim, so the risk is concentrated rather than removed — but concentrated
is a real improvement, because the claim is then written once and reviewed once. And
since 5.5, a simple unannotated guard gets its predicate **inferred**, which is
genuinely checked; that is the one case where the language turned an assertion into
a verification.

**When is an assertion a signature bug rather than a call-site bug?**
When the same one recurs against the same function. One assertion protects one line;
one better signature removes it from every caller including future ones. A rule of
thumb: the third occurrence is the signal to change the function rather than the
call.

**Why should a policy exclude `as const`?**
Because it is not an assertion in the same sense. It asks the compiler to infer more
precisely rather than to accept a claim, and `TS1355` restricts it to literals, so
it cannot be aimed at anything it could be wrong about. A metric that counts it
penalises the safest construct in the language and trains people away from it.

**What is wrong with `as SomeInterface` on a config object?**
It widens. The literal types are lost — `routes.home` becomes `string` — and the
excess property check goes with them, so a misspelled key is now silent. `satisfies`
checks the same constraint and keeps both. It is the substitution with the largest
gap between the cost and the difficulty of fixing it: one keyword.

**How do you make "use fewer assertions" actionable?**
By replacing it with the taxonomy. "Avoid `as`" produces the same unwinnable comment
on every pull request; "which of these six is it?" produces a specific task, and two
of the six are one-line changes. The count then measures something a team can move,
which is the precondition for it being worth measuring at all.

---

← [01 · Three ways to make a claim](./01-three-ways-to-make-a-claim.md) · [Topic index](./README.md) · Next → **03 · `!` and the definite assignment assertion** *(not written yet)*
