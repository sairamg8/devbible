---
title: "🔴 `strictTemplates: false` does not step you back one tier — it disables `checkTemplateBodies` and takes extended diagnostics with it, and the intermediate mode the guide describes is unreachable in v22 because `fullTemplateTypeCheck` is gone"
sidebar_label: "14g · What turning it off costs"
sidebar_position: 14.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`, both branches),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts) —
> and [`adev/src/content/reference/configs/angular-compiler-options.md`](https://angular.dev/reference/configs/angular-compiler-options).
> ⚠️ Contradicts [angular.dev · Template type checking](https://angular.dev/tools/cli/template-typecheck), which still documents a three-mode model; the middle mode is not reachable at this version.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[14f](14f-what-stricttemplates-actually-switches.md) established that `strictTemplates` is on
unless you refuse it. This chunk is about the refusal, because it is the decision people actually
make — a wall of errors appears mid-upgrade, someone sets the flag to `false`, and the build goes
green. What they believe they have done is step back to the middle of three modes: bindings still
checked, inputs no longer checked against directive fields. What they have actually done is turn off
`checkTemplateBodies`, which is the flag that makes the compiler look inside a template at all, and
lose extended diagnostics on the way past. The middle mode is not a thing you can reach in v22. The
modes are two, and the second one is much further down than it looks.**

## The `else` branch turns off the thing that makes checking happen

`getTypeCheckingConfig` has two branches. The strict one sets a long list of fields to
`strictTemplates`, which is the composition rule the reference page states, verbatim: > *"Unless
otherwise commented, each following option is set to the value for `strictTemplates` (`true` when
`strictTemplates` is `true` and conversely, the other way around)."*

The non-strict branch is where the surprise lives. It turns **everything** off — including
`checkTemplateBodies`.

That field is not one strictness dial among many. It is the switch that decides whether the compiler
generates statements for the contents of a template at all. With it off, the machinery from
[14](14-template-type-checking.md) through [14e](14e-the-errors-that-never-arrive.md) still runs, but
there is almost nothing in the generated block to check. This is the *"nothing was generated"* case
from [14e](14e-the-errors-that-never-arrive.md) applied wholesale rather than per category.

🔴 **So the failure mode is silence, not looser errors.** You do not get weaker diagnostics; you get
far fewer of them. A typo in a property name inside an interpolation stops being an error. That is a
materially different bargain from the one the guide's three-mode framing implies, and it is why this
page exists as a decision aid rather than a reference table.

## There is no way back to the middle

The guide describes an intermediate mode selected by `fullTemplateTypeCheck`: template bodies
checked, input bindings not checked against directive field types. That was a real and useful
setting, and it is the one most teams actually want during a migration.

It is not reachable in v22. `fullTemplateTypeCheck` is gone from the public option surface, and the
v22 getter does not consult it — compare the two getters in
[14f](14f-what-stricttemplates-actually-switches.md). Setting it does nothing. **The modes are now
two: strict, or basic.**

⚠️ **This is the single most consequential thing the stale guide gets wrong.** A reader following it
believes there is a safety net one step below strict, plans a migration around occupying it, and
discovers on landing that the step down went two floors.

## The loss is not confined to type checking

`strictTemplates` also gates behaviour people do not associate with the name. Extended diagnostics —
the NG81xx family that flags code which is legal but almost certainly wrong — stop appearing, which
is why the escape hatch quietly removes warnings about `??` on a non-nullable value, unused
standalone imports, and control flow that prevents content projection. That connection is
**15 · Extended diagnostics** *(not written yet)*.

Meanwhile one thing you might expect to go does **not**: `typeCheckHostBindings` is a separate option
with its own default, so `host: {…}` expressions and `@HostBinding` / `@HostListener` stay checked.
Turning off template strictness while host bindings remain strict is a combination nobody chooses on
purpose, and it is what you get by default.

## What to do instead

Every individual flag can be set independently and otherwise inherits `strictTemplates`'s value. So
the narrow move is available and is almost always the right one:

```jsonc
// tsconfig.json — keep strictness, disable the ONE category that is blocking you
{
  "angularCompilerOptions": {
    // strictTemplates is true by default in v22 — do not restate it, and do not disable it
    "strictNullInputTypes": false
  }
}
```

rather than:

```jsonc
// tsconfig.json — turns off template body checking entirely, and extended diagnostics with it
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**A migration plan that works:** let `ng update` write `strictTemplates: true` so the version bump is
not the breaking change · count the errors by category · disable the two or three narrowest flags
covering the bulk, typically `strictNullInputTypes` and `strictAttributeTypes` · ship · re-enable one
flag per sprint. At no point does `strictTemplates: false` appear, because at no point is losing
template body checking the smallest thing that unblocks you.

The per-flag detail — which category of error each one produces, and which checks have no flag at
all — is **14j · The event, reference and generics flags** *(not written yet)* and
**14k · The checks with no switch** *(not written yet)*.

## Gotchas

**★ Symptom: you set `strictTemplates: false` and lost far more than you expected — errors you
*wanted* stopped appearing, including plain typos in interpolations.** Cause: the non-strict branch
disables `checkTemplateBodies`, so the compiler largely stops generating statements for template
contents. You did not step back one tier; you stepped past the tier the guide describes, because that
tier no longer exists. Fix: revert it and disable individual flags instead:

```jsonc
{
  "angularCompilerOptions": {
    "strictNullInputTypes": false,
    "strictAttributeTypes": false
  }
}
```

**★ Symptom: you turned strictness off to unblock a release and your NG81xx warnings vanished too.**
Cause: extended diagnostics are gated behind `strictTemplates`, despite having nothing to do with
type strictness by name. Fix: this is a strong argument for never using the blunt switch. If you have
already shipped with it, treat the missing warnings as a known blind spot until you get back to
per-flag configuration, and do not read the clean build as evidence of anything.

**★ Symptom: `strictTemplates: false` did not silence the specific error you were trying to
silence.** Cause: two possibilities, and they have opposite fixes. Either the check is in the
always-on group with no flag at all, or it is a host-binding error, which is governed by the separate
`typeCheckHostBindings`. Fix: identify which. For the always-on group the remedies are `$any()` and
the non-null assertion rather than configuration; for host bindings, the separate option:

```jsonc
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

**★ Symptom: a migration plan was built around `fullTemplateTypeCheck` as an intermediate step and
the step does nothing.** Cause: it is not in the public option surface at v22 and the getter no
longer consults it. Fix: rebuild the plan around individual flags, which is what the intermediate
mode was approximating anyway — `strictInputTypes: false` alone reproduces most of what
`fullTemplateTypeCheck` gave you, since input binding assignment checking was the main thing that
mode omitted.

**★ Symptom: turning strictness off made the build faster and someone wants to keep it that way.**
Cause: fewer generated statements means less for TypeScript to check, so yes, it is faster — you have
bought speed by deleting the feature. Fix: name the trade explicitly in the decision. If build time
is the real problem, the lever is template size, per
[14c](14c-the-type-check-file-and-how-errors-get-home.md): cost scales with total template
statements, not component count.

**Symptom: a library consumed by your app behaves as though strictness is off, or on, against your
setting.** Cause: these options are properties of *your* compilation. A library shipped in partial
compilation mode is finished by your compiler at your settings, per
[12f](12f-partial-compilation-and-the-linker.md) — but the library's own templates were checked at
the library author's settings, not yours. Fix: nothing to configure. It explains why a library can
ship template bugs your strict build never catches: your build is not checking their templates.

**Symptom: `strictTemplates: false` in one `tsconfig` and unset in another produces confusing
per-target results.** Cause: unset means strict, so the two targets genuinely differ. Fix: set
`angularCompilerOptions` once in the base config every target extends, and never rely on the absence
of the flag to mean anything other than "on".

## Interview questions

**★ You set `strictTemplates: false` on Angular 22 to unblock a release. What else did you just turn
off?**
More than intended. The non-strict branch turns everything off including `checkTemplateBodies`, which
is what makes the compiler generate statements for template contents at all — so you land in basic
mode, where even a typo in an interpolation stops being an error, not in the intermediate tier the
guide describes. That tier is unreachable at v22 because `fullTemplateTypeCheck` is gone from the
public option surface. Extended diagnostics go with it, so the NG81xx warnings stop too. One thing
does *not* go: `typeCheckHostBindings` is a separate option with its own default, so host bindings
stay checked. The correct move is to disable the single narrowest flag covering the errors that
blocked you, since each flag can be set independently and otherwise inherits `strictTemplates`'s
value.

**★ Angular's guide describes three type-checking modes. How many are there at v22, and what happened
to the missing one?**
Two — strict and basic. The middle mode was selected by `fullTemplateTypeCheck`, which is no longer in
the public option surface and is not consulted by the v22 `strictTemplates` getter; setting it has no
effect. That is the most consequential thing the stale guide gets wrong, because a migration plan
built around occupying the middle tier silently gets basic mode instead. The nearest reachable
equivalent is leaving `strictTemplates` on and setting `strictInputTypes: false`, since input binding
assignment checking was the main thing the middle mode omitted.

**★ Someone proposes turning off `strictTemplates` because it made the build noticeably faster. How
do you respond?**
Agree on the fact and reframe the trade. It is faster because fewer statements are generated, so
TypeScript has less to check — the speed came from deleting the feature, not from optimising it. Then
point at where the cost actually sits: type-checking time scales with total template statements
rather than component count, so the real lever is template size. Splitting the handful of very large
templates gets much of the speed without giving up the checks, and it is the only tuning available
since there is no type-checking-specific performance knob.

**Why do extended diagnostics disappear when you turn off template strictness, given they are not
type checks?**
Because they are gated behind the same flag despite the names being unrelated — the NG81xx checks
about legal-but-wrong code ride on the same configuration branch. It is worth knowing precisely
because it is not inferable from the option's name, and because it means a build that went green
after setting `strictTemplates: false` is quieter in two independent ways at once.

**Your strict app consumes a library with a buggy template. Why does your build not catch it?**
Because these options govern your compilation, not the library's. A library shipped in partial
compilation mode has its declarations finished by your compiler at your Angular version, but its
templates were type-checked by the library author's build at the library author's settings. You are
not checking their templates at any strictness level, which is one of the practical limits of the
locality model in [12](12-ivy-and-locality.md).

---

← Prev: [14f · `strictTemplates` is on by default](14f-what-stricttemplates-actually-switches.md) · Index: [Topic index](README.md) · Next → **14j · The event, reference and generics flags** *(not written yet)*
