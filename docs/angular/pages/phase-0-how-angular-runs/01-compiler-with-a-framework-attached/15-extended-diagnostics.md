---
title: "Extended diagnostics are the compiler's opinions about code that is technically valid — warnings by default, gated behind `strictTemplates` and therefore on by default since v22, and 🔴 promoting them to errors is a semver hazard the documentation warns you about in as many words"
sidebar_label: "15 · Extended diagnostics"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Extended diagnostics](https://angular.dev/extended-diagnostics) (read as `adev/src/content/reference/extended-diagnostics/overview.md` at `v22.1.5`) — and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts).
> Documentation-validated; **no sandbox run** — every code block is source read or doc text quoted from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every check in this topic so far has answered a question with a definite answer: does this
metadata resolve, does this type match, does this template parse. Extended diagnostics are a
different thing — they are the compiler telling you that something *compiles fine and is probably
not what you meant*. `<button (click)="save">` is valid Angular that never calls `save`.
`{{ count }}` where `count` is a signal renders a function's source text rather than a number. Both
are legal, both are bugs, and neither is a type error. This chunk is about that category: why it
exists as warnings rather than errors, why it is gated behind `strictTemplates` and therefore on by
default since v22, and the one genuinely load-bearing decision it asks of you — whether to promote
these warnings to errors, which the documentation explicitly frames as accepting a semver hazard.**

## What they are, in Angular's own framing

The overview page states the whole rationale, verbatim:

> *"There are many coding patterns that are technically valid to the compiler or runtime, but which
> may have complex nuances or caveats. These patterns may not have the intended effect expected by a
> developer, which often leads to bugs. The Angular compiler includes "extended diagnostics" which
> identify many of these patterns, in order to warn developers about the potential issues and enforce
> common best practices within a codebase."*

And the default posture, verbatim: > *"Extended diagnostics are warnings by default and do not block
compilation."*

🔴 **The line being drawn is "valid but probably wrong".** A compiler error means the code cannot be
compiled. An extended diagnostic means it compiled and the compiler thinks you will regret it. That
distinction is why they are a separate configurable family rather than more entries in the error
catalogue of [10](10-metadata-errors-one-by-one.md) — and it is why the category is user-configurable
in a way that real errors never are.

## The three categories

Verbatim from the overview's table:

| Category | Effect |
|---|---|
| `warning` | *"Default - The compiler emits the diagnostic as a warning but does not block compilation. The compiler will still exist with status code 0, even if warnings are emitted."* |
| `error` | *"The compiler emits the diagnostic as an error and fails the compilation. The compiler will exit with a non-zero status code if one or more errors are emitted."* |
| `suppress` | *"The compiler does not emit the diagnostic at all."* |

⚠️ *"will still exist"* is a typo for "exit" in the original. Quoted as-is, because silently
correcting a verbatim quote is how a page stops being checkable against its source.

Behind those strings is an enum in `public_options.ts`, verbatim:

```ts
/**
 * A label referring to a `ts.DiagnosticCategory` or `'suppress'`, meaning the associated diagnostic
 * should not be displayed at all.
 *
 * @publicApi
 */
export enum DiagnosticCategoryLabel {
  /** Treat the diagnostic as a warning, don't fail the compilation. */
  Warning = 'warning',

  /** Treat the diagnostic as a hard error, fail the compilation. */
  Error = 'error',

  /** Ignore the diagnostic altogether. */
  Suppress = 'suppress',
}
```

## Configuration

Verbatim from the overview:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "suppress"
      },
      "defaultCategory": "error"
    }
  }
}
```

> *"The `checks` field maps the name of individual diagnostics to their associated category."*

> *"The `defaultCategory` field is used for any diagnostics that are not explicitly listed under
> `checks`. If not set, such diagnostics will be treated as `warning`."*

So the model is a default plus per-check overrides. The names you write in `checks` come from an enum
in the compiler and are **not** the `NG` codes — that, and the full roster, is
[15b · The roster of checks](15b-the-roster-of-checks.md).

## They require `strictTemplates` — which changed what "require" means in v22

Verbatim: > *"Extended diagnostics will emit when `strictTemplates` is enabled. This is required to
allow the compiler to better understand Angular template types and provide accurate and meaningful
diagnostics."*

The reason is mechanical rather than policy: several checks need to know a type to decide anything.
`nullishCoalescingNotNullable` fires when the left side of `??` is *not nullable*, which is not a
question you can answer without types. Without `strictTemplates` the checker does not have them.

🔴 **The v22 consequence the documentation has not caught up with.**
[14f](14f-what-stricttemplates-actually-switches.md) established that `strictTemplates` now defaults
to `true`. So **extended diagnostics are on by default too**, in every project, whether or not anyone
configured them. Every per-check doc page still frames this as a prerequisite you arrange — NG8109's
page, verbatim: > *"`strictTemplates` must be enabled for any extended diagnostic to emit.
`interpolatedSignalNotInvoked` has no additional requirements beyond `strictTemplates`."* — which was
a condition to satisfy in v21 and is a description of the default in v22.

This also closes a loop from [14g](14g-what-turning-strict-templates-off-costs.md): turning
`strictTemplates` off does not merely relax type checking, it silently removes this entire family of
warnings. That is why the blunt escape hatch is worse than it looks.

## 🔴 The semver caveat — the reason this chunk exists

This is the one thing on this page that should change what you do. Verbatim, in full:

> *"The Angular team intends to add or enable new extended diagnostics in **minor** versions of
> Angular. This means that upgrading Angular may show new warnings in your existing codebase. This
> enables the team to deliver features more quickly and to make extended diagnostics more accessible
> to developers."*

> *"However, setting `"defaultCategory": "error"` will promote such warnings to hard errors. This can
> cause a minor version upgrade to introduce compilation errors, which may be seen as a semver
> non-compliant breaking change. Any new diagnostics can be suppressed or demoted to warnings via the
> above configuration, so the impact of a new diagnostic should be minimal to projects that treat
> extended diagnostics as errors by default. Defaulting to error is a very powerful tool; just be
> aware of this semver caveat when deciding if `error` is the right default for your project."*

Read what that actually concedes. **Angular is telling you it will add checks in minor releases, and
that if you have set `defaultCategory: "error"` you have opted into minor versions being able to
break your build.** The team is not apologising for it — the position is that the escape valve
(suppress or demote the new check) makes the cost small, and that the power is worth it. But the
decision is explicitly handed to you, and it is handed to you *because* the semver contract does not
cover it.

**The practical resolution most teams should reach:** leave `defaultCategory` at its default and
promote *specific* checks to `error` under `checks`. That gives you enforcement on the patterns you
care about, and a new diagnostic in a minor arrives as a warning rather than a red build.

```jsonc
// tsconfig.json — enforcement without signing up for future minors breaking the build
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "error",
        "uninvokedFunctionInEventBinding": "error",
        "interpolatedSignalNotInvoked": "error"
      }
      // no defaultCategory — new checks arrive as warnings
    }
  }
}
```

⚠️ **The one exception worth making deliberately:** a CI-only `tsconfig` with
`"defaultCategory": "error"` gives you a hard gate on the code you write while leaving the upgrade
path safe, provided the upgrade job is allowed to be red without blocking everything else. That is a
real pattern, but it is a choice about your pipeline, not a default.

## The bar a new check has to clear

Useful because it tells you what this family will and will not ever include. Verbatim:

> *"Extended diagnostics should generally: Detect a common, non-obvious developer mistake with
> Angular templates · Clearly articulate why this pattern can lead to bugs or unintended behavior ·
> Suggest one or more clear solutions · Have a low, preferably zero, false-positive rate · Apply to
> the vast majority of Angular applications (not specific to an unofficial library) · Improve
> program correctness or performance (not style, that responsibility falls to a linter)"*

🔴 **The last clause is the boundary: correctness and performance, never style.** So there will never
be an extended diagnostic about attribute ordering or quote style, and a team wanting those still
needs a linter. It also explains why every check in the roster is about something that *changes what
the program does*, which is a better mental index than the codes.

## Gotchas

**★ Symptom: a minor Angular upgrade broke the build with a warning-shaped message.** Cause: you have
`"defaultCategory": "error"` and the release added a new extended diagnostic. The documentation
states this outcome explicitly — new checks land in minors, and `error` promotes them. Fix:
suppress or demote the specific new check, then decide whether to fix or keep it:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": {"deferTriggerMisconfiguration": "warning"}
    }
  }
}
```

**★ Symptom: you turned off `strictTemplates` and every extended-diagnostic warning disappeared.**
Cause: the family is gated behind it — *"Extended diagnostics will emit when `strictTemplates` is
enabled"*. Fix: this is one of the strongest arguments against the blunt switch, per
[14g](14g-what-turning-strict-templates-off-costs.md). Disable individual strictness flags instead
and keep the warnings.

**★ Symptom: you turned off `strictTemplates` *and* had configured `extendedDiagnostics`, and now the
build fails outright.** Cause: that combination is NG4003, a config-time error rather than a silent
degradation — the compiler refuses a configuration that asks for diagnostics it cannot produce. Fix:
covered in **15d · Configuring it, and getting it wrong** *(not written yet)*; the
short version is that you must remove one or the other.

**★ Symptom: after `ng update` to v22 your `tsconfig` contains suppressions nobody wrote.** Cause:
the migration adds `nullishCoalescingNotNullable: "suppress"` and
`optionalChainNotNullable: "suppress"` for you, because the `strictTemplates` default flip was
expected to light both up across existing code. Fix: they are real diagnostics you now have turned
off. Schedule their removal rather than leaving them permanently — they usually indicate defensive
`?.` on values that were never nullable, which is dead code worth deleting.

**★ Symptom: you expected an extended diagnostic for a style issue and there is none.** Cause: the
stated bar excludes style outright — *"Improve program correctness or performance (not style, that
responsibility falls to a linter)"*. Fix: use a linter. This is a deliberate boundary, not a gap.

**★ Symptom: warnings appear in a project that never configured `extendedDiagnostics` at all.**
Cause: v22. `strictTemplates` defaults to `true`, the family is gated behind it, and the default
category is `warning` — so every project gets them without opting in. Fix: nothing is wrong. If the
volume is disruptive mid-upgrade, suppress specific checks rather than the whole mechanism.

**Symptom: the build exits 0 despite a wall of warnings, and CI treats it as green.** Cause: exactly
as documented — warnings do not block compilation and the compiler exits with status 0. Fix: if you
want them to gate, promote the checks you care about to `error` under `checks`, which is safer than
`defaultCategory: "error"` for the semver reason above.

## Interview questions

**★ What is the difference between an extended diagnostic and a compiler error, and why is the line
drawn there?**
A compiler error means the code cannot be compiled — the metadata does not resolve, the template does
not parse, the types do not match. An extended diagnostic means it compiled successfully and the
compiler believes you did not mean it: `<button (click)="save">` is valid Angular that never calls
`save`. The line is drawn at *validity*, which is why the category is user-configurable in a way real
errors are not — the compiler is offering an opinion, not reporting an impossibility. Angular's own
bar for adding one says it must detect a common, non-obvious mistake with a near-zero false-positive
rate, and must be about correctness or performance rather than style, which is left to linters.

**★ Why would promoting extended diagnostics to errors be a semver hazard, and whose semver is at
stake?**
Angular's. The documentation says the team intends to add or enable new extended diagnostics in
*minor* versions, and that setting `"defaultCategory": "error"` promotes those new warnings to hard
errors — so a minor upgrade can introduce compilation errors, which the docs themselves describe as
*"may be seen as a semver non-compliant breaking change"*. Angular's position is that the escape
valve makes the cost acceptable: any new diagnostic can be suppressed or demoted. The practical
resolution is to leave `defaultCategory` alone and promote individual checks under `checks`, so
enforcement applies to the patterns you chose and new checks arrive as warnings.

**★ Why do extended diagnostics require `strictTemplates`, and what changed about that in v22?**
The requirement is mechanical: several checks cannot decide anything without types.
`nullishCoalescingNotNullable` fires when the left side of `??` is *not* nullable, and that is a
question about a type. Without `strictTemplates` the checker does not have the information. What
changed in v22 is not the requirement but its practical meaning — `strictTemplates` now defaults to
`true`, so extended diagnostics are on by default in every project whether or not anyone configured
them. The per-check doc pages still describe enabling `strictTemplates` as a prerequisite you
arrange, which was true in v21 and is a description of the default now. It also means turning
`strictTemplates` off silently removes the whole family, which is a strong argument against that
escape hatch.

**Your team wants template mistakes to fail CI. How do you set that up without signing up for future
minors breaking the build?**
Promote the specific checks you care about to `error` inside `checks`, and leave `defaultCategory`
unset so it stays at `warning`. New diagnostics added in a minor then arrive as warnings, visible but
not blocking, and you promote them deliberately once you have looked at them. If you want the
stronger gate, the safer shape is a CI-only config with `"defaultCategory": "error"` and an upgrade
job that is allowed to be red on its own — that keeps the enforcement while making the semver hazard
land somewhere it does not block everyone.

**What happens to the exit code when extended diagnostics fire?**
Nothing, at the default category — the docs are explicit that the compiler *"will still exist"* (a
typo for "exit") *"with status code 0, even if warnings are emitted"*. So a CI job checking only the
exit status treats a wall of warnings as success. That is the intended behaviour and the reason
promoting to `error` is offered at all; if you need a gate, the category is the mechanism, not the
exit code.

---

← Prev: [14k · The checks with no switch](14k-the-checks-with-no-switch.md) · Index: [Topic index](README.md) · Next → [15b · The roster of checks](15b-the-roster-of-checks.md)
