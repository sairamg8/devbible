---
title: "Why expect-error wins"
sidebar_label: "02 · Why expect-error wins"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **compiler's diagnostic table** for `TS2578`,
> read rather than recalled, and the **typescript-eslint** rule documentation for
> `ban-ts-comment`, whose `descriptionFormat` and per-directive `'allow-with-description'`
> settings are the mechanism described here. **No sandbox, no console block.**

The argument for `@ts-expect-error` is usually given as "it is stricter". That is
not quite it, and the accurate version is more useful.

> **A suppression is a debt, and `@ts-expect-error` is the only one that comes
> with a repayment date.** `@ts-ignore` is a debt with no maturity — it does not
> come due, it does not accrue visibly, and nothing in the build ever mentions it
> again.

## The ratchet property

Every other tool in this phase reports a problem *that exists*. `TS2578` reports
a problem that has **stopped existing** — which makes it the only diagnostic in
TypeScript that gets you closer to correct without anyone deciding to work on it.

The mechanism is worth being precise about:

1. Someone suppresses an error they cannot fix today.
2. Time passes. A dependency is upgraded, a type is improved, the code is
   refactored, a compiler version fixes an inference gap.
3. The error goes away on its own.
4. **The build fails**, pointing at a line that is now correct, and the fix is to
   delete a comment.

📌 **Step 4 is the whole value, and it is free.** Nobody scheduled it, nobody
audited anything, and the codebase got smaller. A team using `@ts-ignore` reaches
step 3 identically and never learns about it.

🔴 **This also inverts the usual objection.** People resist `@ts-expect-error`
because "it will break the build later". That is not a side effect to tolerate —
**it is the feature being purchased.** A suppression that cannot break the build
later is a suppression that will still be there in five years.

## Always write a description

```ts
// @ts-expect-error — upstream types wrong until @acme/sdk@3, see ACME-412
sdk.connect(opts);
```

Two reasons, and the second is the one people miss:

- **A directive with no description is indistinguishable from a shrug.** The next
  reader cannot tell whether it was investigated or reached for.
- 🔴 **It bounds the "absorbs a different error" weakness from
  [chunk 01](./01-the-three-directives.md).** The directive suppresses whatever
  is on the next line, so if the error changes it silently keeps working. A
  written description means a reader comparing the comment to the current error
  can *notice* the mismatch. Without one, there is nothing to compare against.

`typescript-eslint`'s **`ban-ts-comment`** rule enforces this. It is worth
configuring rather than accepting the default:

```js
'@typescript-eslint/ban-ts-comment': ['error', {
  'ts-expect-error': 'allow-with-description',
  'ts-ignore': true,          // banned outright
  'ts-nocheck': true,         // banned outright
  'ts-check': false,          // harmless
  minimumDescriptionLength: 10,
}]
```

📌 **That configuration is the policy in five lines**: `@ts-ignore` and
`@ts-nocheck` unavailable, `@ts-expect-error` available but only with an
explanation long enough to be one. Everything in
[chunk 04](./04-a-policy-that-works.md) is downstream of this.

## Migrating `@ts-ignore` to `@ts-expect-error`

The conversion is mechanical and is a genuinely satisfying piece of work,
because a proportion of the directives simply disappear:

1. Replace every `@ts-ignore` with `@ts-expect-error`.
2. Build. Every `TS2578` is a **suppression that was already unnecessary** —
   delete those lines outright.
3. What remains are the live ones. Add a description to each, which forces
   someone to look at it and is where the real value is.
4. Turn on `ban-ts-comment` so no new `@ts-ignore` can be added.

⚠️ **Expect step 2 to remove a meaningful fraction on any codebase over a year
old.** Those are directives suppressing errors that no longer exist — pure noise
that had been reading as considered decisions. It is also the cheapest possible
argument for the change, because it costs one build and produces a number.

## What it does not fix

Being honest about the limits, because `@ts-expect-error` is sometimes offered as
a complete answer:

- **It does not make the suppressed code correct.** The type error is still real
  and still unchecked; you have only guaranteed you will hear about it when it
  stops being real.
- **It does not catch the error changing** — see the description convention
  above.
- **It suppresses everything on that line**, including errors introduced later by
  an unrelated edit. A line under a directive is an unchecked line.
- 🔴 **It is still worse than fixing the error**, and the ranking never changes:
  fix > narrow > guard > `@ts-expect-error` with a description > anything else.

## The one place a directive is never justified

[Topic 06](../06-the-other-correctness-flags/README.md)'s eight flags —
`noImplicitOverride`, the control-flow pair, the unused-code pair, index-signature
access, and the two `allow*` neighbours.

🔴 **Nothing in that group has a fix that requires an assertion or a
suppression.** The fixes are: add a keyword, add a `break`, add a `return`,
rename a parameter with a leading underscore, delete a dead local, add brackets.
Every one is a small mechanical edit with no judgement in it.

So a suppression over one of those errors is **never** a considered trade-off —
it is someone declining a two-character fix. That makes this group uniquely easy
to audit: a `@ts-expect-error` above a `TS4114` or a `TS6133` is always wrong, no
context required.

## Gotchas

**Symptom:** converting `@ts-ignore` to `@ts-expect-error` broke the build in
dozens of places.
**Cause:** those are `TS2578` — suppressions that were already unnecessary.
**Fix:** delete them. This is the migration working, not failing.

**Symptom:** a directive has a description and the description is now wrong.
**Cause:** the underlying error changed and the directive absorbed the new one.
**Fix:** exactly the case descriptions exist to make visible. Re-investigate and
rewrite or remove.

**Symptom:** `ban-ts-comment` rejects a directive that has a description.
**Cause:** `minimumDescriptionLength` — a description of "fixme" does not clear
the bar.
**Fix:** write a real one, naming the cause and the condition for removal.

**Symptom:** `@ts-expect-error` above a multi-line call reports `TS2578`.
**Cause:** the error is on a later line than the one the directive governs.
**Fix:** collapse the expression, or move the directive to the line that actually
errors.

**Symptom:** the team standardised on `@ts-expect-error` and the count keeps
growing.
**Cause:** the directive made suppression *respectable* rather than rare.
**Fix:** the count is the metric. `@ts-expect-error` is better than `@ts-ignore`
and is still worse than a fix.

**Symptom:** a library cannot adopt `@ts-expect-error` at all.
**Cause:** it builds against multiple TypeScript versions, so `TS2578` fires on
whichever version lacks the error.
**Fix:** the legitimate `@ts-ignore` case. Comment it as version-specific so a
future cleanup does not "fix" it.

## Interview questions

**Why is `@ts-expect-error` better than `@ts-ignore`, precisely?**
Because a suppression is a debt and `@ts-expect-error` is the only one with a
repayment date. When the underlying error is eventually fixed by a dependency
upgrade or a refactor, `TS2578` fails the build and the fix is to delete a
comment. `@ts-ignore` reaches the same state and never tells anyone.

**People object that `@ts-expect-error` will break the build later. What is the
response?**
That is the feature being bought, not a cost being tolerated. A suppression that
cannot break the build later is one that will still be present in five years,
long after the reason for it has gone.

**Why does a description matter beyond documentation?**
Because the directive suppresses whatever error is on the next line, not the one
you meant. If the error changes, the directive keeps working silently and
`TS2578` never fires. A written description gives a reader something to compare
the current error against — without one there is nothing to notice the mismatch
with.

**How would you migrate a codebase full of `@ts-ignore`?**
Replace them all with `@ts-expect-error` and build. Every `TS2578` is a
suppression that was already unnecessary — delete those. Add descriptions to what
remains, which forces someone to look at each. Then enable
`ban-ts-comment` so no new `@ts-ignore` can be introduced. On any codebase over a
year old, step one removes a meaningful fraction for the cost of a single build.

**Where is a suppression directive never justified?**
Above any error from the correctness-flag group — `noImplicitOverride`, the
control-flow flags, the unused-code flags, index-signature access. None of those
has a fix requiring an assertion; the fixes are a keyword, a `break`, a `return`,
a rename, a deletion. A suppression there is someone declining a two-character
change, so it can be audited with no context at all.

**What is the correct ranking of responses to a type error?**
Fix the code, then narrow the type, then write a type guard, then
`@ts-expect-error` with a description, then everything else. `@ts-expect-error`
being the best *suppression* does not make it a good outcome — it is the fourth
choice, and its virtue is only that it expires.

---

← [01 · The three directives](./01-the-three-directives.md) · Next → [03 · The suppression tiers](./03-the-suppression-tiers.md)
