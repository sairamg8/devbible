---
title: "Overloads, and the handbook's two warnings"
sidebar_label: "07 · Overloads and the handbook"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Declaration Files → Do's and
> Don'ts*: the *Use Union Types* and *Use Optional Parameters* sections — the
> `Moment.utcOffset` example, the pass-through `fn` example, the `Example.diff`
> example, and both ❔ *Why* explanations — are **quoted verbatim**. `TS2769` is from
> the **compiler's own diagnostic table** (**TypeScript 5.9.3**) and confirmed in
> **7.0.2**. **No sandbox, no console block.** The decision table is **judgement**
> built from the two documented rules plus [chunk 02](./02-three-designs-one-mistake.md)'s
> mechanics.

[Chunk 02](./02-three-designs-one-mistake.md) showed overloads producing the richest
failure of the three designs: `TS2769` *"No overload matches this call."* plus one
reason per candidate. That is real, and it is why "replace the conditional with two
overloads" is such a common recommendation.

🔴 **It is also how people walk into two shapes the handbook explicitly tells them not
to write.** Read this before reaching for overloads.

## ❌ Don't write overloads that differ by type in only one argument position

> ❌ **Don't** write overloads that differ by type in only one argument position:
>
> ```ts
> /* WRONG */
> interface Moment {
>   utcOffset(): number;
>   utcOffset(b: number): Moment;
>   utcOffset(b: string): Moment;
> }
> ```
>
> ✅ **Do** use union types whenever possible:
>
> ```ts
> /* OK */
> interface Moment {
>   utcOffset(): number;
>   utcOffset(b: number | string): Moment;
> }
> ```
>
> Note that we didn't make `b` optional here because the return types of the signatures
> differ.

📌 **That closing note is the subtle part.** The no-argument form returns `number` and
the one-argument form returns `Moment`, so the parameter cannot be collapsed into an
optional one — the two remaining signatures are kept for a reason, and it is the return
type, not the argument.

## The pass-through problem — the reason, in the handbook's own code

> ❔ **Why:** This is important for people who are "passing through" a value to your
> function:
>
> ```ts
> function fn(x: string): Moment;
> function fn(x: number): Moment;
> function fn(x: number | string) {
>   // When written with separate overloads, incorrectly an error
>   // When written with union types, correctly OK
>   return moment().utcOffset(x);
> }
> ```

🔴 **This is the one place a conditional type genuinely beats overloads.** Overload
resolution needs a *single* candidate to accept the arguments, so a caller holding
`number | string` matches **neither** overload even though every member of their union
matches one.

Note what the example is: not a careless caller, but **another function's
implementation** passing its own parameter through. Any wrapper, adapter, decorator or
middleware is in exactly that position — which is why this bites hardest in the code
that has the least room to work around it.

**So when the return type must vary with the argument** — the case that made you write
the conditional in the first place — the honest options are:

- a **constrained generic with a conditional return**, which handles unions correctly and
  pays chunk 01's error-message cost; or
- a **union parameter with a wider return type** that callers then narrow, which keeps
  the error message good and moves the work to the caller.

Both are defensible. What is not defensible is overloads plus a stream of `as` at the
wrapper call sites.

## ❌ Don't write several overloads that differ only in trailing parameters

> ❌ **Don't** write several overloads that differ only in trailing parameters:
>
> ```ts
> /* WRONG */
> interface Example {
>   diff(one: string): number;
>   diff(one: string, two: string): number;
>   diff(one: string, two: string, three: boolean): number;
> }
> ```
>
> ✅ **Do** use optional parameters whenever possible:
>
> ```ts
> /* OK */
> interface Example {
>   diff(one: string, two?: string, three?: boolean): number;
> }
> ```
>
> Note that this collapsing should only occur when all overloads have the same return
> type.

And the reason, which is worth having because it explains why the overload version is not
merely verbose but **wrong**:

> ❔ **Why:** This is important for two reasons. TypeScript resolves signature
> compatibility by seeing if any signature of the target can be invoked with the arguments
> of the source, *and extraneous arguments are allowed*. Additionally, when using "strict
> null checking," unspecified parameters appear as `undefined` in JavaScript, so it's
> usually fine to pass an explicit `undefined` to a function with optional arguments.

⚠️ **"Extraneous arguments are allowed"** is the part people are surprised by: the
three-overload version does not actually stop a caller from passing more arguments than
one of its signatures declares, so the ceremony buys less than it appears to.

## So when *are* overloads the right replacement?

Judgement, assembled from the two documented rules plus chunk 02's mechanics:

| Situation | Write |
|---|---|
| Return type same, one argument varies in type | **union parameter** — handbook |
| Return type same, trailing arguments vary | **optional parameters** — handbook |
| Return type varies over a small closed set, callers pass literals | **overloads** — the signatures *are* the documentation |
| Return type varies **and** callers pass unions through | **constrained generic + conditional** — the conditional earns it |
| Return type varies over an open input set | **constrained generic + conditional** |
| Return type varies over a large closed set | **lookup interface** indexed by the kind ([chunk 08](./08-structure-and-tooling.md)) |

📌 **Two rows of that table are documentation and four are judgement.** The handbook
settles the first two; the rest follow from how overload resolution and conditional types
report failure, which is chunk 02's material.

## Gotchas

**Symptom:** Overloads replaced a conditional, and a caller passing a union now fails.
**Cause:** The documented pass-through problem — each overload must be satisfied
individually.
**Fix:** Union parameter if the return type is the same; a constrained generic with a
conditional return if it is not. This is the case where the conditional was right.

**Symptom:** A wrapper function cannot call the thing it wraps.
**Cause:** Same problem, in its most common location: the wrapper's own parameter is a
union spanning two overloads.
**Fix:** Widen the callee to a union parameter, or make the wrapper generic and forward the
type. Do not paper over it with `as` at the call site.

**Symptom:** Three overloads differ only in their last argument.
**Cause:** The handbook's ❌ *Use Optional Parameters* case.
**Fix:** One signature with optional parameters — valid only when every overload has the
same return type.

**Symptom:** Two overloads differ only in one argument's type and share a return type.
**Cause:** The handbook's ❌ *Use Union Types* case.
**Fix:** One signature with a union parameter. Keep them separate only when the return
types differ, as the handbook's `Moment` example does.

**Symptom:** You collapsed overloads into optional parameters and a return type is now
wrong.
**Cause:** The collapse rule requires all overloads to share a return type; one of them did
not.
**Fix:** Keep that signature separate. This is exactly why `utcOffset()` stays its own
overload in the handbook's ✅ version.

**Symptom:** Overload errors are so long the team stopped reading them.
**Cause:** Related information nests once per candidate; eight overloads gives eight
reasons.
**Fix:** Reduce the candidate count using the two handbook rules, or move to a lookup
interface. Do not hide the message.

**Symptom:** An implementation signature is broad (`any`) and a wrong call slipped
through.
**Cause:** The implementation signature is not callable from outside, but a loose one lets
the *body* do anything — the safety of overloads is only as good as the body's discipline.
**Fix:** Narrow the implementation signature to the union of the overloads, and narrow
inside the body.

**Symptom:** The overload set is documentation for callers and a maintenance burden for
you.
**Cause:** Shared parts of the signature are duplicated per overload.
**Fix:** That duplication is overloads' real cost. Past a handful of kinds, a lookup
interface keeps one source of truth and still reports at the call site.

**Symptom:** Callers get `TS2769` with a reason that is not the real problem.
**Cause:** The candidate list is printed in declaration order, and the *last* one's error is
the one `TS2770` surfaces — which is not necessarily the closest match.
**Fix:** Order overloads most-specific first, so the most relevant candidate is tried and
reported first.

## Interview questions

**★ Overloads produce better errors than a conditional type, so why does the handbook warn
against them?**
Because two specific shapes are wrong regardless of error quality. Overloads differing by
type in only one argument position should be a **union parameter**; overloads differing only
in trailing parameters should be **optional parameters** — the latter only when every
overload shares a return type. The deeper reason for the first is the pass-through problem,
which the handbook illustrates with `function fn(x: number | string)`: *"When written with
separate overloads, incorrectly an error / When written with union types, correctly OK"*.

**★ Explain the pass-through problem and why wrappers hit it hardest.**
Overload resolution requires one candidate to accept the arguments, so a caller holding a
union that spans two overloads matches neither, even though each member matches one. The
handbook's example is not a careless call site — it is another function forwarding its own
parameter. Every wrapper, adapter, decorator and piece of middleware is in that position, and
they are the code with the least freedom to restructure around it.

**★ When does a conditional type genuinely beat overloads?**
When the return type varies with the argument **and** callers pass unions through. That
combination defeats overloads (each candidate must be satisfied alone) and defeats a plain
union parameter (which cannot vary the return type). A constrained generic with a conditional
return handles both — and that is the case where chunk 01's error-message cost is worth
paying.

**★ Why is the `utcOffset` parameter not made optional in the handbook's corrected
version?**
Because the return types differ: the zero-argument form returns `number` and the
one-argument form returns `Moment`. Collapsing overloads into optional parameters is only
valid when all of them share a return type, which the handbook states explicitly in the
*Use Optional Parameters* section. So the fix there is a union *parameter*, not an *optional*
one.

**What does "extraneous arguments are allowed" mean for overload design?**
That signature compatibility is checked by asking whether any signature of the target can be
invoked with the source's arguments, and extra arguments do not disqualify a call. So a
three-overload set that differs only in trailing parameters is not buying the strictness it
appears to — which, together with `undefined` being what unspecified parameters look like at
runtime under strict null checks, is the handbook's stated reason for preferring optional
parameters.

**Why order overloads most-specific first?**
Because candidates are tried in declaration order, and the reason surfaced by
`TS2770` *"The last overload gave the following error."* is the last candidate's — which
may have nothing to do with what the caller meant. Most-specific first means the closest
match is tried and reported first, so the printed reason is the relevant one.

**Where do overloads stop scaling, and what replaces them?**
Once the closed set is more than a handful. Each member is another signature, and every
shared part of the signature is duplicated across all of them, so a change lands in N places
and the error message nests N reasons. Past that point, a lookup interface indexed by the
kind keeps one source of truth, reports at the call site, and prints a name rather than a
candidate list.

**Is a broad implementation signature a safety problem?**
Not for callers — the implementation signature is not part of the callable API. But it is a
problem inside the body, where `any`-ish parameters let the implementation contradict the
overloads it claims to satisfy, and nothing checks it. Narrow the implementation signature to
the union of the declared overloads and narrow again inside the body.

---

← Prev: [06 · Write the types out](./06-what-to-write-instead.md) ·
[Topic index](./README.md) · Next → [08 · Structure and tooling](./08-structure-and-tooling.md)
