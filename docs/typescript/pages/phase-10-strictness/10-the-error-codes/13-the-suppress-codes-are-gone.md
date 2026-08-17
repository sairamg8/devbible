---
title: "TS5101, TS5102, TS5023 — when the option itself is the error"
sidebar_label: "13 · The suppress codes are gone"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from **two compiler builds on disk, with a control**. In
> **TypeScript 5.9.3**
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`) the two `suppress*`
> options are referenced in exactly **three** places — their option records at
> lines 41974 and 41983, and `checkDeprecations("5.0", "5.5", …)` at 129438–129441.
> **The checker reads neither.** `checkDeprecations` (129373) and
> `getIgnoreDeprecationsVersion` (129363) supply the exact semantics below. In the
> **TypeScript 7.0.2** native binary the two option *names* are **absent
> entirely** — verified against a control in the same command:
> `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
> `ignoreDeprecations` are all present in that binary, while
> `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors`,
> `keyofStringsOnly` and `noStrictGenericChecks` are not. **No sandbox, no console
> block.**

:::warning A correction to three pages in this phase
🔴 **[Topic 03](../03-containing-any.md),
[topic 08 chunk 03](../08-suppression-directives/03-the-suppression-tiers.md) and
[topic 09 chunk 04](../09-excess-property-checks/04-designing-for-it.md) each
describe `suppressExcessPropertyErrors` and `suppressImplicitAnyIndexErrors` as
working project-wide suppressions.** That was true through TypeScript 4.9 and is
**not true on the versions this corpus targets**. Their *advice* — never use
these — survives and is in fact stronger than stated: you can no longer use them
at all. Their *mechanism* is out of date, and this chunk is the correction.
:::

The 5xxx range gets one chunk because a 5xxx code has a property no other range
has: **it means the compiler never got as far as your code.**

> 🔴 **Read the first five lines of `tsc` output before the last five hundred.** An
> option error can change which files are in the program, which library is loaded
> and therefore which type errors exist. A single `TS5023` above a wall of
> `TS2304`s is frequently the sole cause of the wall.

## The four codes

| Code | Template | Means |
|---|---|---|
| `TS5023` | `Unknown compiler option '{0}'.` | the option does not exist in this compiler |
| `TS5025` | `Unknown compiler option '{0}'. Did you mean '{1}'?` | …and it is a typo of one that does |
| `TS5101` | `Option '{0}' is deprecated and will stop functioning in TypeScript {1}. Specify compilerOption 'ignoreDeprecations: {2}' to silence this error.` | deprecated, still working, silenceable |
| `TS5102` | `Option '{0}' has been removed. Please remove it from your configuration.` | 🔴 **gone, and not silenceable** |

📌 **`TS5101` and `TS5102` are the same check with two outcomes**, decided by one
line in `checkDeprecations`:

```js
const mustBeRemoved = !(removedInVersion.compareTo(typescriptVersion) === GreaterThan);
const canBeSilenced = !mustBeRemoved && ignoreDeprecationsVersion.compareTo(deprecatedInVersion) === LessThan;
```

🔴 **`canBeSilenced` is only computed when `!mustBeRemoved`.** So once your
compiler is at or past the removal version, `ignoreDeprecations` is not consulted
at all — `TS5102` cannot be silenced by any configuration.

## 🔴 `ignoreDeprecations` accepts exactly one value

From `getIgnoreDeprecationsVersion`:

```js
if (ignoreDeprecations === "5.0") return new Version(ignoreDeprecations);
reportInvalidIgnoreDeprecations();      // TS5103
```

**The only accepted string is `"5.0"`.** Anything else — including `"5.5"`, which
is the natural guess, and `true`, which is the natural shape — produces
`TS5103` *"Invalid value for '--ignoreDeprecations'."*

⚠️ **It is not a version you are declaring compatibility with.** It is a literal
acknowledgement of the 5.0 deprecation cohort, and there has never been a second
value. Writing the removal version there is a hard error.

## 🔴 The correction: what `suppressExcessPropertyErrors` does now

The deprecation call names both versions itself —
`checkDeprecations("5.0", "5.5", …)` — so the compiler is the source for this
table:

| TypeScript | `"suppressExcessPropertyErrors": true` does |
|---|---|
| ≤ 4.9 | **works** — excess-property checking off project-wide, silently |
| 5.0 – 5.4 | **works**, plus `TS5101`; silenceable with `ignoreDeprecations: "5.0"` |
| 🔴 **5.5 – 5.9** | **nothing.** `TS5102` *"has been removed"*, **not silenceable** |
| 🔴 **7.0** | the option **does not exist** → `TS5023` *"Unknown compiler option"* |

The same table applies to `suppressImplicitAnyIndexErrors`, and to the rest of
the 5.0 cohort: `keyofStringsOnly`, `noStrictGenericChecks`, `noImplicitUseStrict`,
`charset`, `out`, `importsNotUsedAsValues`, `preserveValueImports`, and
`target: ES3`.

📌 **`out` and `importsNotUsedAsValues` get a `Use '{0}' instead` chain** naming
`outFile` and `verbatimModuleSyntax` respectively — so the removal message
sometimes carries the migration.

### What this changes about the advice, and what it does not

**Unchanged:** never set these. **Strengthened:** you cannot, so the audit
question shifts. [Topic 08](../08-suppression-directives/04-a-policy-that-works.md)
tells you to grep `tsconfig.json` *before* grepping for directives, because one
config line outranks every directive in the codebase. **That is still exactly
right** — but on a current compiler the config line announces itself as an error
rather than hiding, which is a genuine improvement.

⚠️ **The realistic way you meet these now is an upgrade**, not an audit. A project
moving from 5.4 to 5.9 gets `TS5102` and, if the excess-property check was
genuinely suppressed, a fresh set of `TS2353`/`TS2561`s the moment the option
stops working. 🔴 **Those errors are not new bugs introduced by the upgrade. They
are the bugs the option was hiding**, arriving all at once. Budget for them.

## 🔴 The methodological lesson: the option record lied

This matters beyond these two flags, because reading the option table is the
technique this phase has leaned on hardest —
[topic 05](../05-exactoptionalpropertytypes/README.md) used it to settle whether a
flag is in `strict`, and [topic 06](../06-the-other-correctness-flags/README.md)
found three behaviours in it that are not in the prose docs.

**In 5.9.3, both records still read:**

```js
{
  name: "suppressExcessPropertyErrors",
  type: "boolean",
  affectsSemanticDiagnostics: true,        // ← not true any more
  affectsBuildInfo: true,
  category: Diagnostics.Backwards_Compatibility,
  description: "Disable reporting of excess property errors during the creation of object literals",
  defaultValueDescription: false
}
```

`affectsSemanticDiagnostics: true` and a present-tense description, for an option
no code reads. **A stale declaration outlived the feature by four minor
versions.**

🔴 **So the rule for the rest of this corpus:** the option table is authoritative
about **defaults, categories and whether an option is accepted**, and **not**
about whether it still functions. **The cross-check is to grep for the option's
consumers, not its declaration:**

```bash
# the declaration — always present
grep -n 'name: "someOption"' <typescript.js>
# the consumers — this is the question
grep -n 'options\.someOption\|compilerOptions\.someOption' <typescript.js>
```

📌 **Two references and both inside `checkDeprecations` means the option is
inert.** That is the shape that caught this one.

## Gotchas

**Symptom:** a wall of `TS2304`/`TS2339` after a config change, all of it
inexplicable.
**Cause:** a 5xxx error above the wall changed the program — `lib`, `types`,
`include` or a removed option.
**Fix:** read the top of the output. This is the single highest-value habit in the
5xxx range.

**Symptom:** `ignoreDeprecations: "5.5"` is rejected.
**Cause:** `TS5103`. The only accepted value is the literal `"5.0"`.
**Fix:** use `"5.0"` — and note that if you are seeing `TS5102` rather than
`TS5101`, no value will help, because the option is removed rather than
deprecated.

**Symptom:** `TS5102` on an option you have relied on for years.
**Cause:** you upgraded past its removal version. It stopped functioning at 5.5
even though the name was still accepted.
**Fix:** delete the line, then deal with the errors it was hiding. They are
pre-existing.

**Symptom:** a batch of excess-property errors appears after a TypeScript upgrade
with no source change.
**Cause:** `suppressExcessPropertyErrors` stopped working. The typos it was hiding
are real.
**Fix:** work through them. `satisfies` is usually the right tool —
[topic 09](../09-excess-property-checks/04-designing-for-it.md).

**Symptom:** the docs and blog posts describe an option that produces `TS5023` for
you.
**Cause:** you are on 7.0 and the option was removed from the compiler entirely,
so it is not even recognised as deprecated.
**Fix:** find the replacement. `TS5025` will suggest one if the name is close to a
live option.

**Symptom:** an option appears in `tsc --help --all` but does nothing.
**Cause:** the help output is generated from the option table, and the table
outlived at least two features.
**Fix:** do not treat presence in the option table as evidence a flag works. Grep
for consumers.

**Symptom:** `TS5102` in CI but not locally.
**Cause:** different TypeScript versions. A removal is version-gated, so the same
`tsconfig.json` is valid on one machine and not the other.
**Fix:** pin TypeScript as a devDependency and use the local binary everywhere.

**Symptom:** you cannot find where a project disabled a check.
**Cause:** on an older compiler, a `suppress*` option is invisible from every
affected line — no directive, no comment, nothing local.
**Fix:** grep `tsconfig.json` and every file it `extends` first. On a current
compiler this is easier, because the option now reports itself.

## Interview questions

**What is the difference between `TS5101` and `TS5102`?**
They are the same deprecation check with two outcomes. `TS5101` means the option
is deprecated but still functioning, and it can be silenced with
`ignoreDeprecations`. `TS5102` means the option has been removed, and it cannot be
silenced at all — the compiler only consults `ignoreDeprecations` when the removal
version is still in the future.

**What value does `ignoreDeprecations` take?**
Exactly one: the string `"5.0"`. Anything else, including the removal version
`"5.5"` or a boolean, produces `TS5103`. It is not a compatibility level you
declare; it is a literal acknowledgement of the 5.0 deprecation cohort, and no
second value has ever existed.

**Does `suppressExcessPropertyErrors` work?**
Not on any current TypeScript. It worked through 4.9, was deprecated in 5.0, and
**stopped functioning in 5.5** — from there it produces `TS5102`, unsilenceable.
In 7.0 the option name is not in the compiler at all, so it is `TS5023`, an
unknown option. The advice never to use it is unchanged; the reason is now that
you cannot.

**A project upgrades TypeScript and suddenly has forty excess-property errors.
What happened?**
A `suppress*` option stopped working. Those forty errors are not caused by the
upgrade — they are the errors the option was hiding, arriving at once. They should
be treated as a backlog of real findings, most of which will be typos in object
literals, and `satisfies` is usually the right fix because it restores the check
without widening the type.

**You read a compiler option's record and it says `affectsSemanticDiagnostics:
true`. Does the option work?**
Not necessarily, and this is the trap. In TypeScript 5.9.3 both removed
`suppress*` options still carry `affectsSemanticDiagnostics: true` and their
original present-tense descriptions, four minor versions after the checker stopped
reading them. The option table is authoritative about defaults, categories and
whether a name is accepted — not about whether a flag functions. The cross-check
is to grep for the option's *consumers*; if the only references are inside the
deprecation check, it is inert.

**Why should you read the first lines of a failing `tsc` run rather than the
last?**
Because a 5xxx option error can change which files are in the program and which
library is loaded, so it can manufacture every type error beneath it. One unknown
or removed option above a wall of `Cannot find name` is a common and
easily-missed cause of the whole wall.

---

← [12 · Out of room](./12-out-of-room.md) · [Topic index](./README.md) · Next → [14 · A lookup routine](./14-a-lookup-routine.md)
