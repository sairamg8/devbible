---
title: "Choosing and adopting"
sidebar_label: "05 · Choosing and adopting"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by enumerating these options in the **compiler's own option
> table** (TypeScript **5.9.3**) — every one carries
> `defaultValueDescription: false` except `allowUnreachableCode` and
> `allowUnusedLabels`, which carry `void 0`, and **none of them carries
> `strictFlag`**, which is what settles their absence from `strict`.
> **No sandbox, no console block.**

Six flags in this topic plus two neighbours, none of them in `strict`, all of
them defaulting off. This chunk is the decision, not the mechanics.

## The whole family in one table

| Flag | Default | Catches | Cost | Verdict |
|---|---|---|---|---|
| [`noImplicitOverride`](./01-noimplicitoverride.md) | `false` | a subclass that silently stopped overriding | mechanical — add a keyword where told | 🟢 **take it first** |
| [`noFallthroughCasesInSwitch`](./03-control-flow-flags.md) | `false` | a missing `break` | very low — stacked empty cases are exempt | 🟢 **take it** |
| [`noImplicitReturns`](./03-control-flow-flags.md) | `false` | a code path that falls off the end | low; each fix narrows an inferred type | 🟢 **take it** |
| [`allowUnreachableCode: false`](./04-unused-code-flags.md) | `undefined` | code after `return`/`throw` | low — already surfaced as editor suggestions | 🟢 **take it** |
| [`allowUnusedLabels: false`](./04-unused-code-flags.md) | `undefined` | a stray label | near zero, and near-zero value too | 🟡 harmless |
| [`noPropertyAccessFromIndexSignature`](./02-index-signature-access.md) | `false` | a typo that falls into an index signature | syntax churn, `process.env` especially | 🟡 **the one you may decline** |
| [`noUnusedLocals`](./04-unused-code-flags.md) | `false` | dead locals — **not a bug class** | breaks the build while debugging | 🟡 **CI config, not the watch build** |
| [`noUnusedParameters`](./04-unused-code-flags.md) | `false` | unread parameters | same, plus the `_` prefix to learn | 🟡 same |

📌 **The top four are close to free and should simply be on.** Between them they
cost a keyword, an exempt idiom, a narrowed return type and a setting that is
already being reported in your editor. There is no serious argument against any
of them for a codebase that has already taken `strict`.

## Why none of them is in `strict`

The compiler settles the *fact* — no `strictFlag` on any of these records — but
not the *reason*. Two different reasons are visible in the flags themselves, and
distinguishing them is more useful than the fact:

- **`noUnusedLocals` and `noUnusedParameters` are not correctness flags at all.**
  They report surplus code, not wrong code, so they do not belong in a
  correctness meta-flag regardless of their merit. Their exclusion is principled.
- **`noImplicitOverride`, `noImplicitReturns` and `noFallthroughCasesInSwitch`
  are correctness flags** and their exclusion is **historical**: `strict` is a
  compatibility surface, and adding to it breaks builds for everyone on upgrade.
  It has been added to twice — `useUnknownInCatchVariables` in 4.4,
  `strictBuiltinIteratorReturn` in 5.6, per
  [topic 01](../01-strict-flag-by-flag/README.md) — and the bar is high.

🔴 **So "it is not in `strict`" is not an argument about its value**, and it is
regularly used as one. `noImplicitOverride` catches a silent behavioural bug for
the price of a keyword and is not in `strict`; `strictBindCallApply` is. The
grouping records history, not a ranking.

## An adoption order that works

**On a new service, all eight, on day one.** The cost is zero because there is no
existing code to fix. Add them alongside `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes` — [topic 05](../05-exactoptionalpropertytypes/README.md)
and [topic 02](../02-nouncheckedindexedaccess.md) — and never think about it
again.

**On an existing codebase, in this order:**

1. **`noImplicitOverride`.** Purely mechanical, and a `TS4113` on the first run
   is a live bug you did not know about. Best evidence-per-hour in the group.
2. **`noFallthroughCasesInSwitch`.** Syntactic, so it works even on
   badly-typed files, and the common idiom is exempt so the error count is small.
3. **`allowUnreachableCode: false`.** You are already seeing these greyed out;
   this only moves them into CI. Watch the polarity — `false` is strict.
4. **`noImplicitReturns`.** Each fix either adds a real return or deliberately
   widens a return type, and both are improvements. Expect a few `TS7030`s that
   need a `default` clause or a terminal `throw`.
5. **`noPropertyAccessFromIndexSignature`, if you want it.** Decide the
   `process.env` question first — if you are going to parse the environment at
   startup anyway, do that, and this flag becomes cheap.
6. **`noUnusedLocals` / `noUnusedParameters`, in a CI-only config.** Keep the
   watch build free of them.

⚠️ **One flag at a time, each its own commit.** A single commit enabling six
flags produces an error list nobody can attribute, and the first failure becomes
an argument for reverting all of them. This matters more here than elsewhere
because these flags are individually cheap — the only way to make them expensive
is to batch them.

## What to measure

Two numbers, and they answer different questions:

- **`TS4113` count on the first `noImplicitOverride` run.** Any number above zero
  is a bug found. This is the number to show anyone who thinks the group is
  cosmetic.
- **Assertions added per error fixed.** Same metric as
  [topic 05](../05-exactoptionalpropertytypes/README.md) and
  [topic 02](../02-nouncheckedindexedaccess.md): if the errors were closed with
  `as`, `!` or `@ts-ignore`, the flags were enabled and suppressed. For *this*
  group the number should be essentially zero — none of these flags has a fix
  that requires an assertion, so any assertion added here is pure suppression.

🔴 **That last point is specific to this topic and worth stating.** Where
`noUncheckedIndexedAccess` at least tempts you toward `!`, nothing in this group
does: the fixes are a keyword, a `break`, a `return`, a rename, a deletion. **An
`@ts-ignore` above one of these errors is never the right answer**, which makes
this the easiest group to audit — see
[topic 08 · `@ts-expect-error` vs `@ts-ignore`](../README.md).

## Gotchas

**Symptom:** six flags enabled in one commit and the team wants to revert.
**Cause:** the error list has no attribution and the total looks enormous.
**Fix:** revert, then enable one per commit. Individually every one of these is
cheap.

**Symptom:** `allowUnreachableCode: true` was set to "enable the check".
**Cause:** inverted polarity — the `allow*` flags are strict at `false`.
**Fix:** `false`. Worth a comment in the config, since it reads backwards next to
every other option.

**Symptom:** someone argues a flag is unimportant because `strict` omits it.
**Cause:** treating `strict` as a ranking rather than a compatibility surface.
**Fix:** point at `noImplicitOverride` — a silent behavioural bug caught for the
price of a keyword, and not in `strict`.

**Symptom:** the flags are on in `tsconfig.json` and CI still passes with errors.
**Cause:** CI is not running `tsc`, or is running it with `noEmitOnError: false`
and checking for output rather than the exit code.
**Fix:** check the exit code —
[phase 7 · Shipping to production](../../phase-7-server/02-shipping-to-production/README.md).

**Symptom:** `noUnusedLocals` in the watch build makes debugging painful.
**Cause:** it is the one pair here that fires on temporarily-incomplete code.
**Fix:** a second CI-only config. This is the recommended answer for these two,
unusually.

**Symptom:** the flags were adopted and nothing improved.
**Cause:** plausible for `noUnusedLocals` and `noUnusedParameters`, which do not
catch bugs at all.
**Fix:** none needed — but if this is the observation, it was the wrong two flags
to start with. Start with `noImplicitOverride`.

## Interview questions

**Which of these flags would you enable first on a legacy codebase, and why?**
`noImplicitOverride`. The migration is purely mechanical — add a keyword wherever
`TS4114` says to — and any `TS4113` on the first run is a live bug: a method that
believes it overrides something and does not. Best evidence-per-hour of anything
in the group.

**Why is none of these in `strict`, and what does that tell you?**
None of their option records carries `strictFlag`. For the two unused-code flags
the exclusion is principled — they report surplus code, not wrong code. For the
correctness ones it is historical: `strict` is a compatibility surface and adding
to it breaks builds on upgrade, so the bar is high. Either way, "not in `strict`"
is a fact about history, not a ranking of value.

**Which one has a legitimate case for declining?**
`noPropertyAccessFromIndexSignature`. It has no runtime consequence, nothing it
rejects is a bug by itself, and on a codebase that has already replaced
`Record<string, T>` with union-keyed records it has almost nothing to act on. The
other five are hard to argue against once `strict` is already on.

**What would you measure to know whether the adoption went well?**
The `TS4113` count on the first `noImplicitOverride` run — every one is a bug
found — and the number of assertions added per error fixed. For this group in
particular that second number should be essentially zero, because none of these
flags has a fix that requires an assertion. Any `@ts-ignore` here is pure
suppression.

**How would you sequence enabling them?**
One per commit, never in a batch. Individually each is cheap; batched, the error
list becomes unattributable and the first failure turns into an argument for
reverting everything. Start with the syntactic and mechanical ones
(`noImplicitOverride`, `noFallthroughCasesInSwitch`), then the flow ones, and put
the unused-code pair in a CI-only config so they never break the watch build.

**Two of these options default to something other than `false`. What follows from
that?**
`allowUnreachableCode` and `allowUnusedLabels` default to `undefined`, which is a
suggestion state — the editor greys the code out, the build ignores it. So a team
is already receiving those reports and reading them as an editor feature. Making
them build errors means setting the option explicitly to `false`, and the
inverted polarity of the `allow*` naming is a genuine trap next to a config where
everything else is turned on.

---

← [04 · The unused-code flags](./04-unused-code-flags.md) · [Topic index](./README.md) · Next → **07 · Where TypeScript is unsound by design** *(not written yet)*
