---
title: "The five that only share a prefix"
sidebar_label: "09 · The five that share a prefix"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own rule pages** for
> `no-unsafe-enum-comparison`, `no-unsafe-declaration-merging`,
> `no-unsafe-function-type`, `no-unsafe-unary-minus` and
> `no-unsafe-type-assertion`; against the **TypeScript handbook** for the `Function`
> type and for declaration merging; and 🔴 against the **TypeScript 5.9.3 diagnostic
> table read from disk** for `TS2356` and `TS2395`, both quoted verbatim below.
> ⚠️ typescript-eslint is not installed here, so rule metadata is
> documentation-attributed; the two diagnostics are compiler-read.
> **No sandbox, no console block.**

[Chunk 08](./08-the-rules-that-track-any.md) covered the five rules that track
`any` and only work as a set. **These five have nothing to do with each other or
with those.** They are independent checks that share a naming convention, and the
useful thing to know about each is which real bug it corresponds to.

## `no-unsafe-enum-comparison`

Comparing an enum-typed value against a bare literal:

```ts
enum Status { Draft, Published, Archived }

if (post.status === 1) { … }        // ← "1" means Published. Today.
```

**The literal is a copy of a value that lives somewhere else.** Reorder the members,
insert one, or give an earlier member an explicit initialiser, and every bare
literal comparison in the codebase silently starts meaning something different —
with no error anywhere, because `1` is still a perfectly good `Status`.

**Fix:** `post.status === Status.Published`. 📌 The rule is really about **a
duplicated fact**: the numbering exists in the enum declaration, and a literal
comparison copies it to a second place that nothing keeps in sync.

⚠️ **String enums have the same shape and feel safer than they are** —
`status === 'published'` reads like the real thing and still breaks silently if the
member's value is edited.

## `no-unsafe-declaration-merging`

An `interface` and a `class` with the same name in the same scope **merge**, and the
interface's members are added to the class's *type* without anything requiring the
class to implement them:

```ts
class Store {}
interface Store { load(): void }     // merged in — nothing implements load()

new Store().load()                   // ✅ type-checks · 💥 TypeError at runtime
```

🔴 **This is the only entry in this chunk that produces a crash on a line where
every type is correct** — which puts it in the same category as the holes in
[topic 07](../07-unsound-by-design/README.md) rather than with the other lint rules
here.

🔴 **Read from the compiler, not recalled: the 5.9.3 message table has exactly one
merged-declaration diagnostic**, and it is about something else entirely —

> `TS2395` · *"Individual declarations in merged declaration '{0}' must be all
> exported or all local."*

**Export consistency is checked; unimplemented members are not.** So there is no
compiler diagnostic to wait for here, which is precisely why the rule exists.

⚠️ **Merging is not the problem — accidental merging is.** The deliberate use of the
same pattern is a legitimate and documented technique;
[phase 4 · Interface declaration merging](../../phase-4-classes-declarations/05-interface-declaration-merging/README.md)
covers when it is right, and the tell for the accident is that **nobody meant the
two declarations to be the same name**.

## `no-unsafe-function-type`

The `Function` type accepts any function and, per the handbook, **calling one
returns `any`** — so a single `Function`-typed value reopens everything
[chunk 08](./08-the-rules-that-track-any.md) is about:

```ts
function run(fn: Function) {
  return fn(1, 2, 3)     // arity unchecked, argument types unchecked, result is any
}
```

**Fix:** write the signature you actually accept — `(a: number, b: number) => void`.
Where the function truly is arbitrary, `(...args: never[]) => unknown` is a *bound*
that accepts any function while giving you nothing unsafe to call, and
`(...args: any[]) => unknown` is a signature you can actually invoke. 📌 The
difference is contravariance, and it is the same decision documented in
[phase 5 · Deriving one function's type from another](../../phase-5-type-level/10-deriving-function-types/README.md).

## `no-unsafe-unary-minus`

🔴 **The clearest case in this chunk, and the compiler states the hole itself.**
Read from the 5.9.3 table:

> `TS2356` · *"An arithmetic operand must be of type `'any'`, `'number'`,
> `'bigint'` or an enum type."*

**`'any'` is first in the compiler's own list of what it will accept.** So `-value`
on a `string` is `TS2356`, and `-value` on an `any` is silently permitted and
produces `NaN` at runtime. The rule closes exactly the gap the message advertises.

📌 It is worth reading that message as a general lesson rather than a one-off: **a
diagnostic that lists `any` among its accepted types is describing a hole**, and
several of the compiler's arithmetic and comparison errors are written that way.

## `no-unsafe-type-assertion`

Reports an `as` that widens what you are claiming beyond what the source type
supports. ⚠️ **It belongs to topic 12, not here** — the `as` count is that topic's
metric and the full argument lives there. **Topic 12 · Assertion discipline**
*(not written yet)* owns it; this chunk names it only so the ten-rule inventory is
complete.

## Gotchas

**Symptom:** a feature works until someone adds an enum member, then a different
branch runs.
**Cause:** a bare numeric literal comparison — the member was inserted above and
every literal shifted meaning.
**Fix:** compare against the member. 🔴 And note the change that caused it is
invisible in review: adding an enum member looks additive.

**Symptom:** a method exists on the type and does not exist at runtime.
**Cause:** an interface merged into a class of the same name and added a member
nothing implements.
**Fix:** rename one of them. There is no compiler diagnostic for this — `TS2395` is
about export consistency, not about members — so the lint rule is the only detector.

**Symptom:** a callback parameter typed `Function` passes review because it "is
typed".
**Cause:** `Function` is a type in the same sense `any` is — it accepts everything
and its call result is `any`.
**Fix:** write the signature. If it is genuinely arbitrary, take
`(...args: never[]) => unknown` and do not call it.

**Symptom:** `-x` produces `NaN` and nothing was reported.
**Cause:** `x` is `any`, and the compiler's arithmetic-operand rule accepts `any`
by design — its own message says so.
**Fix:** `no-unsafe-unary-minus`, and upstream, the chunk 08 rules that would have
caught the `any` before it reached the operator.

**Symptom:** the team disables "the `no-unsafe` rules" as a block after a noisy
adoption.
**Cause:** the shared prefix reads as a family.
**Fix:** 🔴 they are two unrelated groups. The five in chunk 08 are noisy because
they measure inherited `any`; these five are cheap, low-volume and mostly report
genuine defects. **Disabling them together throws away the quiet half to silence
the loud one.**

**Symptom:** `no-unsafe-type-assertion` is enabled and produces a large count.
**Cause:** it measures a different thing from the rest of this chunk — assertion
discipline, which is a codebase-wide habit rather than a bug class.
**Fix:** treat it as topic 12's metric and adopt it on that topic's terms, not as
part of a `no-unsafe-*` sweep.

## Interview questions

**What is actually unsafe about comparing an enum to a literal?**
The literal duplicates a fact that lives in the enum declaration, and nothing keeps
the copy in sync. Insert a member or add an initialiser and every bare literal
comparison silently changes meaning, with no error, because the literal is still a
valid member value. Comparing against the member name removes the duplicate.

**Why is class–interface merging unsafe when merging is a documented feature?**
Because the interface adds members to the class's *type* without anything requiring
the class to implement them, so a call type-checks and throws at runtime. The
feature is fine when it is deliberate; the rule targets the accident of two
same-named declarations meeting in one scope. The compiler will not help — its only
merged-declaration diagnostic, `TS2395`, is about whether the declarations are
consistently exported.

**What is wrong with the `Function` type?**
It accepts any function regardless of arity or parameter types, and calling it
returns `any` — so it reintroduces everything the `any`-tracking rules exist to
catch, while looking like an annotation. Write the real signature, or use
`(...args: never[]) => unknown` as a bound you cannot unsafely call.

**Why does `no-unsafe-unary-minus` need to exist at all?**
Because the compiler's own rule permits it. `TS2356` says an arithmetic operand
must be `any`, `number`, `bigint` or an enum type — `any` is first in that list. So
`-someString` is an error and `-someAny` is silently allowed and yields `NaN`. The
rule closes the gap the diagnostic advertises.

**These five share a prefix with the five in the previous chunk. Are they related?**
No, and treating them as one family is the common mistake. The chunk 08 rules track
`any` through a program and only work as a set; these five are independent checks on
unrelated language features. They also behave differently on adoption — the `any`
rules can produce thousands of reports on a codebase with untyped dependencies,
while these are typically quiet and mostly true positives.

**Which of these ten would you enable first on a legacy codebase?**
These five, because they are cheap: low report counts, each report a specific
defect, and no dependency on how well-typed the rest of the project is. The
`any`-tracking five are worth more in the long run but their initial count is a
function of your dependencies, so they need a plan rather than a switch.

---

← [08 · The rules that track `any`](./08-the-rules-that-track-any.md) · [Topic index](./README.md) · Next → **10 · Adoption and the CI cost** *(not written yet)*
