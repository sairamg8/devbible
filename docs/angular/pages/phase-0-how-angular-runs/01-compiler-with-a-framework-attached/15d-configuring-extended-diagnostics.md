---
title: "Every way this configuration goes wrong fails before the compiler reads a single template — three NG40xx codes, two of which print the complete list of legal values into the error text, and a migration that writes two suppressions into your tsconfig on your behalf"
sidebar_label: "15d · Configuring it, and getting it wrong"
sidebar_position: 15.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts) (`verifyCompatibleTypeCheckOptions`),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts) (`DiagnosticCategoryLabel`),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> and the [v22.0.0 · 22.1.3 · 22.1.5 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md);
> plus angular.dev [Extended diagnostics overview](https://angular.dev/extended-diagnostics).
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured from a terminal.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[15](15-extended-diagnostics.md) gave you the three categories and the shape of the block, and
[15b](15b-the-roster-of-checks.md) gave you the names that are legal inside it. This page is what
happens when the two do not line up. Every failure in this area is a *config-time* failure: the
compiler validates `extendedDiagnostics` against itself before it analyses a single decorator, so
the error names no file, no line and no symbol of yours. There are three codes, and two of them
print the entire list of values they would have accepted directly into the message — which makes
them the most reliable documentation of this feature that exists, better than the website, because
they are generated from the same enum the compiler is actually running.**

## The resolution order for one check

Every one of the eighteen checks resolves through the same four steps, in this order. Nothing else
participates:

| # | Step | If it decides |
|---|---|---|
| 1 | Is `strictTemplates` off? | the whole family is off. Nothing below runs |
| 2 | Is the check named in `extendedDiagnostics.checks`? | that category wins |
| 3 | Is `extendedDiagnostics.defaultCategory` set? | that category wins |
| 4 | neither | `warning` — the documented fallback |

The two consequences people trip on are at the ends. **Step 1 is total**: a `strictTemplates: false`
anywhere in the tsconfig your build actually resolved discards a fully-specified `checks` map without
comment, which is why [14g](14g-what-turning-strict-templates-off-costs.md) treats that flag as far
more expensive than it looks. **Step 4 means "not configured" is not "not running"** — since v22 flipped
`strictTemplates` to `true` by default, an application with no `angularCompilerOptions` block at all
is running all eighteen checks at `warning`.

⚠️ **Two of the eighteen reach the same result by a different route.**
`controlFlowPreventingContentProjection` and `unusedStandaloneImports` are fields of
`TypeCheckingConfig` whose category is plumbed across by hand — [15b](15b-the-roster-of-checks.md)
quotes that code. The four steps above still describe their behaviour exactly; only the
implementation differs.

## NG4003 — the asymmetry worth understanding

`verifyCompatibleTypeCheckOptions` refuses the combination *"`extendedDiagnostics` is configured"*
plus *"`strictTemplates` is disabled"*, verbatim:

```text
Angular compiler option "extendedDiagnostics" is configured, however "strictTemplates" is disabled.

Using "extendedDiagnostics" requires that "strictTemplates" is also enabled.

One of the following actions is required:
1. Remove "strictTemplates: false" to enable it.
2. Remove "extendedDiagnostics" configuration to disable them.
```

🔴 **Read that against step 1 above and the asymmetry appears.** Turning `strictTemplates` off
disables every extended diagnostic either way. Whether you are *told* depends on something
unrelated to the diagnostics — whether you happen to have written the block:

| `strictTemplates` | `extendedDiagnostics` block | Outcome |
|---|---|---|
| `false` | present | **NG4003, the build fails.** You find out immediately |
| `false` | absent | eighteen checks silently stop emitting. Nothing is reported |
| `true` / unset | either | the four-step resolution above |

So the loud failure is the *lucky* one. A team that turns off `strictTemplates` during an upgrade and
has never configured `extendedDiagnostics` loses the entire family with no signal — no error, no
warning, and a green build that is quieter than it was yesterday. **A build getting quieter is the
symptom**, and nothing in the toolchain will say so.

The full NG40xx family — six codes, including NG4001, NG4002 and NG4006, which have nothing to do
with diagnostics — is [13e · The option surface](13e-the-option-surface-and-config-time-diagnostics.md).
This page covers only the three that this block can produce.

## NG4004 and NG4005 print their own allowed list

Both remaining codes are typo-catchers, and both are self-documenting. NG4004 is the wrong
*category*, and it has two variants — the default and the per-check one, verbatim:

```text
Angular compiler option "extendedDiagnostics.defaultCategory" has an unknown diagnostic category: "X".

Allowed diagnostic categories are:
<the list>
```

```text
Angular compiler option "extendedDiagnostics.checks['X']" has an unknown diagnostic category: ...
```

NG4005 is the wrong *check name*, verbatim:

```text
Angular compiler option "extendedDiagnostics.checks" has an unknown check: "X".

Allowed check names are:
<the list>
```

🔴 **Both messages enumerate the legal values into the error text**, so you never need to look either
list up. That is worth more than convenience: the enumeration is produced from the compiler's own
enums at the version you are running, while angular.dev's table of checks is prose maintained by hand
and is a **subset** — sixteen entries against the enum's eighteen, per
[15b](15b-the-roster-of-checks.md). **When the error and the website disagree about what exists, the
error is right**, for the same reason the golden API file beats the reference page in
[13e](13e-the-option-surface-and-config-time-diagnostics.md).

There is a second reason NG4005 matters more than a typo check normally would. Inside
`angularCompilerOptions`, an unrecognised key is **not** an error — TypeScript does not own that
block and Angular ignores what it cannot read, which is how the eight stale pre-Ivy options in
[13e](13e-the-option-surface-and-config-time-diagnostics.md) fail silently. `extendedDiagnostics` is
the exception: the value of `defaultCategory` and **every key of `checks`** are validated against
enums, and a mistake in either fails the build. Two behaviours, one config file.

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "skipTemplateCodegen": true,          // pre-Ivy, gone in v22 — silently ignored
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBoxes": "error"   // 🔴 NG4005 — the build fails on this one
      }
    }
  }
}
```

⚠️ What the compiler does with an unrecognised key *beside* `checks` and `defaultCategory` — a
misspelling of `checks` itself, say — is not stated by the sources read for this page, and no claim
is made here either way.

## Gotchas

**★ Symptom: the build fails with a message about `extendedDiagnostics` and `strictTemplates`, naming
no file.** Cause: NG4003 — the two settings contradict each other, and this check runs before
analysis, so there is nothing to point at in your code. Fix: pick one of the two numbered actions the
error itself lists, and prefer the first:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "extendedDiagnostics": {"checks": {"invalidBananaInBox": "error"}}
  }
}
```

**★ Symptom: extended-diagnostic warnings vanished after an upgrade and no error was produced.**
Cause: `strictTemplates` was set to `false` somewhere in the tsconfig chain and you have no
`extendedDiagnostics` block, so NG4003 cannot fire — the family is simply gone. Fix: search the whole
chain, not just the file you edited, and remember that `ng build` and `ng test` can resolve different
tsconfigs:

```bash
grep -rn '"strictTemplates"' tsconfig*.json src/tsconfig*.json
```

**★ Symptom: `"checks": {"NG8101": "error"}` fails the build with NG4005.** Cause: `checks` is keyed
by the enum's string value, never the error code. Fix: use `invalidBananaInBox`, and read the allowed
list the error already printed for you rather than the docs table, which is a subset.

**★ Symptom: `"defaultCategory": "Error"` is rejected.** Cause: NG4004 — the labels are lowercase
`warning`, `error` and `suppress`; a capitalised or TypeScript-style category is not one of them. Fix:
lowercase it. The allowed values are in the message.

**★ Symptom: a check you configured under `checks` is ignored while the others obey.** Cause: the name
is misspelled in a way that is *also* a valid name, or you configured it in a tsconfig this target
does not extend. A genuinely unknown name is NG4005, so a *silent* miss is almost always the wrong
file rather than the wrong name. Fix: confirm which tsconfig the failing target resolves before
editing anything — the command is in [13e](13e-the-option-surface-and-config-time-diagnostics.md).

**Symptom: a pre-Ivy option in the same block does nothing and produces no error, while a typo inside
`extendedDiagnostics` fails the build.** Cause: both behaviours are correct. `angularCompilerOptions`
ignores keys it does not recognise; `extendedDiagnostics.defaultCategory` and the keys of `checks` are
validated against enums. Fix: expect no help from the config file for anything outside this block —
verify option names against the golden API file at your tag.

## Interview questions

**★ A project sets `strictTemplates: false`. What happens to its extended diagnostics, and will
anyone be told?**
They all stop emitting — the family is gated behind `strictTemplates` and that gate is total,
overriding any fully-specified `checks` map. Whether anyone is told depends on something unrelated:
if an `extendedDiagnostics` block is also present, the compiler refuses the configuration outright
with NG4003 and the build fails before analysis. If no block was ever written, there is no
contradiction to detect and eighteen checks go quiet with no error, no warning and a green build. The
loud outcome is the lucky one, and the symptom of the quiet one is a build that got *less* noisy for
no reason anybody logged.

**★ Why are NG4004 and NG4005 better documentation than angular.dev?**
Because both print the complete set of values they would have accepted into the error message, and
that enumeration is generated from the compiler's own enums at the version you are running.
angular.dev's table of checks is maintained by hand and lists sixteen where the enum has eighteen, so
two configurable checks — `unusedLetDeclaration` and `controlFlowPreventingContentProjection` — exist
with no entry anywhere on the site. When the error text and the website disagree about what exists,
the error text is right. It is the same principle that makes the golden public-API file, not the
reference page, the authority on which compiler options exist.

**★ `extendedDiagnostics` sits in a config block where unknown keys are silently ignored, yet a
misspelled check name fails the build. How do both hold?**
Because `angularCompilerOptions` is Angular's block, not TypeScript's, so TypeScript will not flag an
unknown key in it and the compiler simply has no field to read it into — which is why eight pre-Ivy
options that angular.dev still documents do nothing at all in v22. Inside `extendedDiagnostics`,
however, two things are validated against enums: the value of `defaultCategory`, against
`DiagnosticCategoryLabel`, and every key of `checks`, against `ExtendedTemplateDiagnosticName`. A
mistake in either is NG4004 or NG4005. So the same file contains keys where a typo is free and keys
where a typo is fatal, and knowing which is which is the difference between an option that is wrong
and an option that is absent.

**Where would you look first for a check that appears to be configured and ignored?**
At which tsconfig the failing target actually resolved, not at the name. An unknown check name
produces NG4005 and an unknown category produces NG4004, so a configuration mistake in this block is
loud by construction — a *silent* miss therefore points at the setting having been written somewhere
the build never read. `angular.json` selects a tsconfig per target, so a `checks` map added to
`tsconfig.app.json` is invisible to a test target pointing at `tsconfig.spec.json`, and shared Angular
options belong in the base config that both extend.

---

← Prev: [15c · The checks worth understanding](15c-the-checks-worth-understanding.md) · Index: [Topic index](README.md) · Next → [15e · What changes underneath you](15e-what-changes-underneath-you.md)
