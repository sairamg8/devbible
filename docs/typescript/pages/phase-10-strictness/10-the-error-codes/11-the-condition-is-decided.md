---
title: "TS2367 and the conditions that are already decided"
sidebar_label: "11 · The condition is decided"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading `tryGiveBetterPrimaryError` and
> `errorAndMaybeSuggestAwait`** in the **TypeScript 5.9.3** build
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, around lines 84889
> and 52169) — so the four-operator restriction and the `await` related-information
> path are the compiler's own control flow. Codes and templates read from the
> numbered table in the same file: `TS2367`, `TS2365`, `TS2773`, `TS2774`,
> `TS2801`, `TS2839`, `TS2845`, `TS2872`, `TS2873`. All seven condition messages
> were **cross-checked against the string table in the TypeScript 7.0.2 native
> binary** and are present there too. **No sandbox, no console block.**

The one code in this topic's nine that is not about a type being wrong. It is
about a *branch* being pointless.

```text
This comparison appears to be unintentional because the types 'A' and 'B'
have no overlap.
```

> 🔴 **`TS2367` is a nicer wording of a more general error, and it exists for
> exactly four operators.** `tryGiveBetterPrimaryError` substitutes it for `===`,
> `==`, `!==` and `!=`. Every other operator with the same underlying failure
> reports `TS2365` — *"Operator '{0}' cannot be applied to types '{1}' and
> '{2}'."* So the two codes are the same finding, differentiated purely by whether
> a comparison reads better than an operator complaint.

## 🔴 The single most common cause is a forgotten `await`

This is the find that changes how you read `TS2367`. The error goes through
`errorAndMaybeSuggestAwait`, which does this:

```js
wouldWorkWithAwait = … isRelated(awaitedLeftType, awaitedRightType);
…
if (maybeMissingAwait) addRelatedInfo(diagnostic, Diagnostics.Did_you_forget_to_use_await);
```

**The compiler awaits both sides hypothetically, checks whether they would then
be comparable, and attaches `TS2773` — *"Did you forget to use 'await'?"* — as
related information if they would.**

```ts
if (getStatus() === "ready") { … }      // getStatus returns Promise<string>
```

`Promise<string>` and `"ready"` have no overlap, so `TS2367` fires — and the hint
is attached, because awaiting the left side would make them comparable.

⚠️ **The hint is related information, not part of the message**, so it prints on a
separate line and many CI log formats drop it entirely. 🔴 **The sight-read: if
either type in a `TS2367` starts with `Promise<`, the answer is `await` and there
is nothing else to work out.**

📌 **The same machinery attaches to `TS2339`** ([chunk 06](./06-the-name-is-wrong.md))
and to `TS2801` below. **A forgotten `await` is diagnosed under at least three
unrelated codes**, which is a reasonable measure of how often it happens.

## The seven "this condition is already decided" codes

`TS2367` is one member of a family, and the others are more useful than their
obscurity suggests:

| Code | Template | What it caught |
|---|---|---|
| `TS2367` | `This comparison appears to be unintentional because the types '{0}' and '{1}' have no overlap.` | a comparison that can never be true |
| `TS2774` | `This condition will always return true since this function is always defined. Did you mean to call it instead?` | 🔴 **a missing `()`** — see [chunk 05](./05-callable-or-not.md) |
| `TS2801` | `This condition will always return true since this '{0}' is always defined.` | 🔴 a missing `await` — a `Promise` in an `if` |
| 🔴 `TS2839` | `This condition will always return '{0}' since JavaScript compares objects by reference, not value.` | `{a:1} === {a:1}` |
| `TS2845` | `This condition will always return '{0}'.` | the general decided-condition case |
| 🔴 `TS2872` | `This kind of expression is always truthy.` | `if (someRegex)`, `if ([])`, `if (() => {})` |
| 🔴 `TS2873` | `This kind of expression is always falsy.` | the inverse |

**`TS2839` is a teaching diagnostic**, and it is unusual — the compiler is
explaining a *JavaScript* semantic rather than a type rule. It fires on comparing
two object literals or two freshly constructed objects, where reference equality
guarantees the answer.

## 🔴 `TS2872`/`TS2873` mean the compiler now does part of a lint rule's job

*"This kind of expression is always truthy"* is not a nullability check. It fires
on expressions whose **kind** guarantees truthiness — a function, a regex literal,
an array literal, a class:

```ts
if (isReady) { … }        // isReady is a function reference → TS2872
if (/^a/) { … }           // a regex literal is always truthy → TS2872
```

⚠️ **This overlaps typescript-eslint's `no-unnecessary-condition`**, which means
the honest framing for **11 · typescript-eslint type-aware rules** *(not written
yet)* is not *"the compiler will not do this"* — it is **"the compiler does a
slice of it, natively and for free, and here is the part that is left over."**

📌 **What is left over is substantial** and worth naming here so the later topic
can be precise: the compiler's checks fire on *kinds of expression* and on types
with **no overlap at all**. `no-unnecessary-condition` additionally catches a
condition that is decided because of **narrowing you already did** — an `if (x)`
after an earlier `if (!x) return`, or a check on a value whose type is
`string` rather than `string | undefined`. That is a different question, and the
compiler does not ask it.

## When `TS2367` is right, and when the type is the liar

**It is right, and the branch is dead:**

```ts
type Status = "active" | "archived";
declare const s: Status;
if (s === "deleted") { … }        // TS2367 — "deleted" was renamed or removed
```

This is the case the code exists for: a literal union changed and one comparison
was not updated. **Delete the branch.** 🔴 **And notice what this makes possible —
renaming a member of a string-literal union produces errors at every stale
comparison, which is the entire argument for literal unions over bare `string`.**

**It is right, and you over-narrowed:**

```ts
if (shape.kind === "circle") {
  if (shape.kind === "square") { … }   // TS2367 — already excluded
}
```

The outer check made the inner one impossible. **Delete the inner check**, or move
it out.

**It is wrong, and the type is lying:**

```ts
const raw = JSON.parse(body) as { status: "active" };
if (raw.status === "archived") { … }   // TS2367 — but the API can send that
```

🔴 **Here `TS2367` is a *consequence of an earlier assertion*, not a finding about
this line.** The `as` promised something narrower than reality, and the compiler is
faithfully reasoning from a false premise. **The fix is upstream** — validate the
input, or widen the type to what the API can actually send. Casting the comparison
to silence it compounds the original mistake:

```ts
if ((raw.status as string) === "archived") { … }   // ⛔ two lies now
```

📌 **This is the most valuable thing on the page.** A `TS2367` on a value that came
through an `as` or a `JSON.parse` is almost always the *assertion* being wrong, not
the comparison. It is the clearest example in the language of an unsound
assertion producing a confusing error somewhere else entirely — which is
[topic 07](../07-unsound-by-design/01-what-unsound-means.md)'s argument, arriving
as a concrete code.

## The wrong fixes, in the order people reach for them

1. **`as any` on one side.** Silences it, keeps the dead branch, and adds an `any`.
2. **`as string`** on a literal-union value. Same, slightly narrower.
3. **`String(x) === String(y)`.** Now nothing is checked and the comparison is
   stringly-typed.
4. **`@ts-expect-error`.** Tier 3 on
   [topic 08's ladder](../08-suppression-directives/03-the-suppression-tiers.md),
   and the one honest use is a deliberate runtime-only check on data you *know*
   the type lies about — in which case fix the type instead.

**The right fixes:** delete the branch, widen the type to the truth, or validate
at the boundary. All three end with the type and the code agreeing.

## Gotchas

**Symptom:** `TS2367` where one type is `Promise<something>`.
**Cause:** a missing `await`. The `TS2773` hint is attached but printed separately.
**Fix:** `await`. Do not read the types.

**Symptom:** `TS2367` comparing two values you are sure can be equal at runtime.
**Cause:** an upstream `as` or an over-narrow annotation made one of them lie.
**Fix:** go fix the declaration or add validation. Silencing this line leaves two
wrong things instead of one.

**Symptom:** the same comparison is fine in one function and an error in another.
**Cause:** narrowing. In the erroring one, an earlier check already excluded the
value.
**Fix:** read upward for the check that narrowed it, then delete whichever branch
is redundant.

**Symptom:** `{a:1} === {a:1}` produces an error you did not expect.
**Cause:** `TS2839` — reference equality. The compiler is explaining JavaScript,
not TypeScript.
**Fix:** compare fields, or use a deep-equality helper. There is no operator for
this in the language.

**Symptom:** an `if` on a function reference errors.
**Cause:** `TS2774` (you meant to call it) or `TS2872` (the expression kind is
always truthy).
**Fix:** add `()`. And prefer boolean *properties* to zero-argument predicate
methods on config-shaped objects, so this cannot happen.

**Symptom:** `TS2365` instead of `TS2367` on what feels like a comparison.
**Cause:** the operator is not one of `===`, `==`, `!==`, `!=` — `<`, `>` and the
arithmetic operators all report `TS2365`.
**Fix:** the same fixes; only the message differs.

**Symptom:** a lint rule flags a condition the compiler is happy with.
**Cause:** `no-unnecessary-condition` reasons about narrowing you already did;
`TS2872`/`TS2873` only reason about the kind of expression, and `TS2367` only about
types with zero overlap.
**Fix:** none needed — both are correct, and they cover different ground.

**Symptom:** `TS2367` comparing a `number` to an `enum` member.
**Cause:** numeric enums are not freely comparable to arbitrary numbers in newer
TypeScript.
**Fix:** compare against the enum member, or type the value as the enum. Do not
cast the enum to `number`.

## Interview questions

**What does `TS2367` mean, and what is the most common cause?**
That the two sides of an equality comparison have no overlapping values, so the
comparison can never be true. The most common cause is a forgotten `await` — the
compiler hypothetically awaits both sides, and if that would make them comparable
it attaches `TS2773`, *"Did you forget to use 'await'?"*, as related information.
So a `TS2367` mentioning a `Promise<…>` type needs no further analysis.

**Is `TS2367` its own check?**
Not exactly. It is a better wording substituted by `tryGiveBetterPrimaryError` for
four operators — `===`, `==`, `!==`, `!=`. The same underlying failure with any
other operator reports `TS2365`, *"Operator '{0}' cannot be applied to types
'{1}' and '{2}'"*. The finding is identical; the message is specialised because a
comparison deserves a clearer sentence than an operator complaint.

**When should you not trust a `TS2367`?**
When the value reached this line through an `as` or an untyped `JSON.parse`. The
compiler is reasoning correctly from a premise you asserted, and if the premise is
narrower than reality the comparison it rejects may be perfectly valid at runtime.
The fix is upstream — widen the type or validate the input. Casting the comparison
silences the symptom and leaves two wrong claims in the codebase instead of one.

**Does the compiler do any of what `no-unnecessary-condition` does?**
Yes, a slice of it, since the `TS2872`/`TS2873` pair — *"This kind of expression is
always truthy/falsy"* — plus `TS2774`, `TS2801`, `TS2839` and `TS2845`. What the
compiler does **not** do is reason about narrowing you have already performed: an
`if (x)` that is redundant because an earlier `if (!x) return` already handled it
is invisible to `tsc` and caught by the lint rule. So the two are complementary
rather than overlapping.

**Why does TypeScript have a diagnostic explaining that JavaScript compares
objects by reference?**
Because `{a:1} === {a:1}` is always `false` and looks like it should be `true`, and
no type-level rule would catch it — both sides have the same type. `TS2839` is the
compiler stepping outside its own subject to explain a language semantic, which is
rare enough to be worth noticing.

**What does `TS2367` on a string-literal union tell you about your API design?**
That the union is doing its job. When a member is renamed or removed, every stale
comparison becomes an error at exactly the line that needs updating — which is the
entire practical argument for `"active" | "archived"` over `string`. A bare
`string` would have accepted the stale comparison silently and shipped it.

---

← [10 · You have not proved it](./10-you-have-not-proved-it.md) · [Topic index](./README.md) · Next → [12 · Out of room](./12-out-of-room.md)
