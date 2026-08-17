---
title: "A policy that works"
sidebar_label: "04 · A policy that works"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint**'s `ban-ts-comment` rule
> documentation — the per-directive `true` / `false` /
> `'allow-with-description'` settings and `minimumDescriptionLength` — and the
> **compiler's diagnostic table** for `TS2578`. Everything else summarises the
> three chunks before it. **No sandbox, no console block.**

Rules about suppression usually fail the same way: they are absolute, so they get
suspended the first time something urgent needs shipping, and never reinstated. A
policy that survives contact has to make the *acceptable* case easy.

## The policy, in four rules

**1 · `@ts-ignore` and `@ts-nocheck` are unavailable.** Not discouraged —
unavailable, enforced by lint. There is one exception, and it is
version-conditional errors in a library building against multiple compiler
versions ([chunk 01](./01-the-three-directives.md)).

**2 · `@ts-expect-error` is available and requires a description** that names the
cause and the condition for removal:

```ts
// @ts-expect-error — @acme/sdk@2 types `opts` as any; fixed in v3, tracked in ACME-412
sdk.connect(opts);
```

**3 · The count is tracked, not the presence.** A suppression is not a failure;
an *increasing* number of them is. One line in CI:

```bash
grep -rn "@ts-expect-error" src/ | wc -l
```

**4 · Never over a correctness-flag error.** Any diagnostic from
[topic 06](../06-the-other-correctness-flags/README.md) — `TS4111`–`TS4116`,
`TS7027`–`TS7030`, the seven unused-code codes — has a mechanical fix, so a
suppression there is declining a two-character change rather than making a trade.

📌 **Rule 4 is the one to state explicitly**, because the other three are
judgement calls and this one is not. It is the only part of the policy that can
be enforced without a conversation.

## Why the count rather than a ban

A ban produces one of two outcomes, both bad: the rule is honoured and someone
eventually ships a worse workaround — an `as unknown as`, a widened type, a
disabled flag — or the rule is suspended and does not come back.

Counting works better because:

- **It permits the legitimate case.** A genuinely broken upstream type is not a
  failure of discipline, and a policy that treats it as one loses credibility.
- **It makes the trend visible**, which is the actual thing you care about. Ten
  suppressions that have been ten for a year is a healthy codebase; four that
  became forty is a problem regardless of the absolute number.
- 🔴 **It cannot be gamed downward by moving to a worse tier**, provided the
  config is audited too — which is why
  [chunk 03](./03-the-suppression-tiers.md)'s config grep belongs in the same CI
  step. Without it, "reduce the `@ts-expect-error` count" is trivially satisfied
  by a `@ts-nocheck`.

## The review question

One question, and it works for every tier:

> **What has to become true for this line to be deleted?**

- *"@acme/sdk ships v3"* — good. It is a real condition, it will happen, and
  `TS2578` will announce it.
- *"we refactor the auth module"* — acceptable if it is on a plan.
- *"nothing, this is just how it is"* — that is not a suppression, it is a
  design decision written in the wrong place. Either the type is wrong and should
  be fixed, or the code is doing something the type system cannot express and
  needs a documented assertion at a boundary
  ([topic 07 chunk 05](../07-unsound-by-design/05-working-with-the-holes.md)).

⚠️ **The third answer is the common one**, and recognising it is most of the
value. A suppression with no removal condition is permanent, and permanent
suppressions should be visible as design decisions rather than hidden as comments
above one line.

## What this fits into

This topic is the third of the phase's three suppression-adjacent measurements,
and they are deliberately the same shape:

| Topic | Metric |
|---|---|
| [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md) | `!` count added per error fixed |
| [05 · `exactOptionalPropertyTypes`](../05-exactoptionalpropertytypes/README.md) | assertions added per error fixed |
| **08 · this topic** | `@ts-expect-error` count, tracked over time |

🔴 **All three are counting the same thing from different directions: how much of
the strictness was bought and how much was declared.** A migration that enables a
flag and closes every error with a suppression has changed the config and nothing
else — and each of these three numbers is a way of noticing that before it
becomes the codebase's character.

[Topic 12 · Assertion discipline](../README.md) is where this becomes a single
practice rather than three separate metrics.

## Gotchas

**Symptom:** the suppression count dropped sharply and nothing was fixed.
**Cause:** somebody moved to a wider tier — a `@ts-nocheck`, or a config option.
**Fix:** audit `tsconfig.json` in the same CI step. A count without a config
check is gameable.

**Symptom:** the lint rule was disabled "temporarily" during a release.
**Cause:** an absolute ban with no legitimate escape.
**Fix:** allow `@ts-expect-error` with a description. A policy that forbids the
reasonable case gets suspended and does not return.

**Symptom:** every directive has a description and they are all "TODO".
**Cause:** `minimumDescriptionLength` unset or too low.
**Fix:** raise it, and use the review question — *what has to become true for
this to be deleted?*

**Symptom:** a suppression has been there for two years and still suppresses a
real error.
**Cause:** its removal condition was never real.
**Fix:** it is a design decision, not a suppression. Fix the type, or move the
assertion to a documented boundary.

**Symptom:** `TS2578` appears in CI and the fix commit only deletes comments.
**Cause:** the ratchet working exactly as designed.
**Fix:** none — this is the outcome the policy exists to produce.

**Symptom:** the team argues about whether a specific suppression is acceptable.
**Cause:** it is a judgement call, and most are.
**Fix:** rule 4 is the only one that is not — over a correctness-flag error there
is nothing to discuss. For the rest, the review question resolves it faster than
a principle does.

## Interview questions

**Why count suppressions rather than ban them?**
Because a ban has two outcomes and both are bad: it is honoured and someone ships
a worse workaround — an `as unknown as`, a widened type, a disabled flag — or it
is suspended under pressure and never reinstated. Counting permits the
legitimate case, makes the trend visible, and keeps the policy credible.

**How do you stop the count being gamed?**
Audit `tsconfig.json` in the same CI step. Otherwise "reduce the
`@ts-expect-error` count" is satisfied by a `@ts-nocheck` or a `suppress*`
option, both of which have a far larger blast radius and neither of which any
directive grep will find.

**What single question should a reviewer ask about a suppression?**
*What has to become true for this line to be deleted?* A named upstream release
is a good answer; a planned refactor is acceptable; "nothing, this is just how it
is" means it is a permanent design decision written in the wrong place, and
should be either a fix or a documented assertion at a boundary.

**Which suppressions can be rejected without any discussion?**
Any over a correctness-flag error — `TS4111`–`TS4116`, `TS7027`–`TS7030`, the
unused-code codes. Every one of those has a mechanical fix: a keyword, a `break`,
a `return`, a rename, a deletion. A suppression there is declining a
two-character change, not making a trade, so it needs no context to judge.

**This phase has three different "count something" metrics. What are they
measuring?**
The same thing from three directions — how much of the claimed strictness was
actually bought. `!` count for `noUncheckedIndexedAccess`, assertions added for
`exactOptionalPropertyTypes`, `@ts-expect-error` count over time for
suppressions. A migration that enables flags and closes every error with a
suppression has changed the config and nothing else, and each number catches that
before it becomes permanent.

---

← [03 · The suppression tiers](./03-the-suppression-tiers.md) · [Topic index](./README.md) · Next → **09 · Excess property checks vs assignability** *(not written yet)*
