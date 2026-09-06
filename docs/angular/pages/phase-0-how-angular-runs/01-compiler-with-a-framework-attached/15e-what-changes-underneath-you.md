---
title: "The v22 upgrade writes two `suppress` entries into your tsconfig on your behalf and never mentions them again, and the checks themselves are retuned in patch releases in both directions — so a warning count is only comparable across two builds if the compiler version is pinned"
sidebar_label: "15e · What changes underneath you"
sidebar_position: 15.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the [v22.0.0 · 22.1.3 · 22.1.5 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) (compiler-cli and migrations sections, commits `6a435658e2`, `6f1171991a`, `d90698dae7`),
> `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts) (`DiagnosticCategoryLabel`),
> and angular.dev [Extended diagnostics overview](https://angular.dev/extended-diagnostics).
> Documentation-validated; **no sandbox run** — no `ng update` was executed and no diagnostic was captured from a terminal.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[15d](15d-configuring-extended-diagnostics.md) covered the ways this configuration fails loudly.
This page is the two ways it changes without failing at all. The v22 `ng update` migration adds two
`suppress` entries to your tsconfig — a permanent decision, made for you, with no reminder attached
— and the checks themselves are narrowed and widened in *patch* releases, so the same codebase can
report a different number of warnings on 22.1.2 and 22.1.5 with nothing in your repository having
changed. Neither is a defect. Both are invisible unless you know to look.**

## The migration that writes suppressions on your behalf

From the 22.0.0 CHANGELOG, migrations, verbatim: *"Disabling nullishCoalescingNotNullable &
optionalChainNotNullable on ng update"* (commit `6a435658e2`). After `ng update` your tsconfig can
contain a block nobody on the team wrote:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "nullishCoalescingNotNullable": "suppress",
        "optionalChainNotNullable": "suppress"
      }
    }
  }
}
```

The reasoning is legible from [14f](14f-what-stricttemplates-actually-switches.md).
`strictTemplates` became the default in v22, which turns the whole extended-diagnostic family on in
projects that never opted into it, and these two checks fire on `??` and `?.` applied to values that
were **never nullable** — defensive code that accumulates in any codebase compiled without strict
templates. Left enabled, they would have greeted the upgrade with hundreds of warnings that have
nothing to do with the upgrade. The migration chose a quiet upgrade, which is the right default for
a tool that has to work on every codebase.

🔴 **What it chose on your behalf is not "quiet", it is "off".** Per the category table in
[15](15-extended-diagnostics.md), `suppress` means the compiler *"does not emit the diagnostic at
all"* — so these two checks are absent, not muted, and they stay absent for the life of the project
unless somebody deletes those lines. A `warning` you ignore is still a warning you can count; a
`suppress` produces nothing to count.

## Why these two, and what they were hiding

Both checks answer a question about a *type*, which is why they need `strictTemplates` and why they
were dormant before v22:

| check | fires when |
|---|---|
| `nullishCoalescingNotNullable` | the left side of `??` is not nullable — `{{ name ?? 'anon' }}` where `name` is `string` |
| `optionalChainNotNullable` | the left side of `?.` is not nullable — `{{ user?.name }}` where `user` is `User` |

Every hit is one of exactly two things, and both are worth finding:

- **the operator is dead syntax** — the value cannot be `null` or `undefined`, so the `??` branch is
  unreachable and the `?.` is a guard against nothing; or
- **your type is wrong** — the value genuinely can be nullish and the type does not say so, which is
  a much more interesting bug and one that `?.` has been hiding.

That second case is the argument against leaving the suppressions in place indefinitely. A codebase
with `optionalChainNotNullable` suppressed cannot tell a redundant `?.` from a type that is lying,
because the check that distinguishes them is the one that was turned off.

## Unwinding it, in order

Demote before you delete, so you can measure the size of the problem before committing to it:

```jsonc
// step 1 — measure. Both checks report; nothing blocks the build
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "nullishCoalescingNotNullable": "warning",
        "optionalChainNotNullable": "warning"
      }
    }
  }
}
```

Then fix each hit at the source rather than at the template:

```html
<!-- before: user is `User`, never `User | null` — the ?. guards against nothing -->
<p>{{ user?.name }}</p>
<!-- after -->
<p>{{ user.name }}</p>
```

```ts
// the other outcome: the check is right and the TYPE was wrong.
// Fix the signature, not the template — the `?.` was load-bearing after all.
readonly user = signal<User | null>(null);
```

Only then delete the two entries entirely, so both checks fall back to the default category and stay
on for code written from here.

⚠️ **Do the demotion in its own commit.** It changes no behaviour and no output, which makes the
warning count it produces a clean measurement; folded into a commit that also edits templates, the
number means nothing.

## Auditing what you actually have on

Four facts settle it, and only the last needs a browser:

```bash
# 1. is the family gated off entirely, anywhere in the chain?
grep -rn '"strictTemplates"' tsconfig*.json src/tsconfig*.json

# 2. what is explicitly configured, and where
grep -rn -A15 '"extendedDiagnostics"' tsconfig*.json src/tsconfig*.json

# 3. which compiler version those settings are being read by
node -p "require('@angular/compiler-cli/package.json').version"
```

Then read the compiler-cli section of the CHANGELOG between the version you were on and the version
step 3 printed. Anything absent from step 2 is at `defaultCategory`, and absent that, at `warning`
— the resolution order is in [15d](15d-configuring-extended-diagnostics.md).

🔴 **Step 1 outranks everything else on the list.** A `strictTemplates: false` in the tsconfig your
build actually resolves makes steps 2 and 3 irrelevant, and if no `extendedDiagnostics` block exists
to contradict it, nothing reports that.

## Checks are tuned in patches, not only added in minors

[15](15-extended-diagnostics.md) covers the semver caveat in the direction everyone means by it:
Angular adds new checks in *minor* versions, and `defaultCategory: "error"` promotes those to build
failures. The quieter half is that **existing checks change behaviour in patches** — and the two
examples in the 22.1.x line moved in opposite directions:

| Version | CHANGELOG entry, compiler-cli | Direction |
|---|---|---|
| 22.1.3 | *"restrict possible event handler check to property names longer than 2 characters"* (`6f1171991a`) | **looser** — a false-positive fix |
| 22.1.5 | *"check uninvoked signal aliases in extended diagnostic"* (`d90698dae7`) | **stricter** — see [15c](15c-the-checks-worth-understanding.md) |

The 22.1.3 entry is the more instructive one, because of *why* it exists. A check firing on
two-character property names was producing false positives, and the response was to narrow the check
rather than document the exception. That is Angular's own stated bar being applied after release —
*"Have a low, preferably zero, false-positive rate"* — and it tells you which way this family is
maintained: a noisy check is treated as a defect in the check.

**Neither change is listed as breaking, and neither is.** At the default category both produce
warnings, and warnings do not affect the exit code. The change only becomes a build failure for a
project running `defaultCategory: "error"`, which is exactly the trade the semver caveat in
[15](15-extended-diagnostics.md) describes — except that here it happens in a *patch*, where nobody
is reading release notes.

## Gotchas

**★ Symptom: your tsconfig contains `suppress` entries nobody remembers adding.** Cause: the v22
`ng update` migration writes `nullishCoalescingNotNullable` and `optionalChainNotNullable` as
`suppress` so the `strictTemplates` default flip does not bury the upgrade in unrelated warnings.
Fix: demote both to `warning`, fix what they report, then delete the entries — leaving them is a
permanent decision that a migration made for you.

**★ Symptom: a patch upgrade changed the number of warnings in CI and nothing in the repo changed.**
Cause: checks are retuned in patches in both directions — 22.1.3 narrowed the event-handler check,
22.1.5 widened the signal check to follow aliases. Fix: nothing is wrong. Read the compiler-cli
CHANGELOG for the range you moved across, and pin the compiler version before comparing warning
counts between two builds.

**★ Symptom: a patch upgrade turned a green build red, on a project that treats diagnostics as
errors.** Cause: the same tuning, plus `defaultCategory: "error"` — a check that got stricter in a
patch becomes a compilation error rather than a new warning. Fix: demote that one check to `warning`
under `checks` to unblock, then fix the hits deliberately. This is the semver caveat arriving one
release channel lower than the documentation discusses it:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": {"interpolatedSignalNotInvoked": "warning"}
    }
  }
}
```

**★ Symptom: removing a `?.` on the compiler's advice caused a runtime `undefined` error.** Cause:
the check was right that the *declared* type is not nullable, and the declared type was wrong — the
value really can be absent at runtime, from an untyped API response, a `!` assertion, or a cast. Fix:
correct the type rather than restoring the `?.`; the template was compensating for a lie in the
signature.

**Symptom: a CI-only tsconfig with `"defaultCategory": "error"` passes locally and fails in CI.**
Cause: that is what a per-environment config does, and it is a deliberate pattern
([15](15-extended-diagnostics.md)) — but severity becomes a property of *which build ran* rather than
of the codebase. Fix: keep the check *names* in the base config and vary only `defaultCategory` per
environment, so the two configs cannot drift in which checks are enabled.

**Symptom: the demotion commit shows hundreds of warnings and nobody can tell which are new.** Cause:
the demotion was folded into a commit that also edited templates. Fix: land the category change on
its own — it alters no output, so the count it produces is a clean baseline to fix against.

## Interview questions

**★ After `ng update` to v22 you find two checks set to `suppress`. What are they, why are they
there, and what would you do?**
`nullishCoalescingNotNullable` and `optionalChainNotNullable`, written by the v22 migration.
`strictTemplates` became the default in v22, turning the whole family on in projects that never had
it, and those two fire on `??` and `?.` applied to values that were never nullable — defensive code
that accumulates in any codebase compiled without strict templates. Left on, they would have buried
the upgrade in warnings unrelated to it. What to do is unwind it deliberately: demote both to
`warning` in a commit of their own to measure the problem, fix what they report, then delete the
entries so the checks return to the default. `suppress` emits nothing at all, so leaving them is a
permanent decision made by a migration rather than by the team.

**★ Why is a suppressed `optionalChainNotNullable` worse than a noisy one?**
Because every hit is one of two things — a `?.` that guards against nothing, or a type that is
lying about nullability — and the check is the only thing that distinguishes them. Suppressed, a
codebase cannot tell a redundant operator from a genuine bug being hidden by one, since the signal
that separates the cases is exactly what was turned off. A noisy check costs attention; a suppressed
one costs the distinction.

**★ Can a patch release change how many extended-diagnostic warnings you get?**
Yes, in both directions, and the 22.1.x line has one of each: 22.1.3 restricted the event-handler
check to property names longer than two characters, a false-positive fix that *reduced* warnings,
while 22.1.5 taught the signal check to follow aliases, which *increased* them. Neither is listed as
breaking because at the default category neither affects the exit code — but on a project running
`defaultCategory: "error"` the second kind turns a patch upgrade into a red build. The documented
semver caveat is about new checks arriving in minors; this is the same hazard one release channel
lower, where nobody is reading the notes.

**How do you determine which extended diagnostics a project actually has enabled right now?**
Four things, in order. Whether `strictTemplates` is `false` anywhere in the tsconfig chain the build
resolves, because that disables the family regardless of everything else and reports nothing unless
an `extendedDiagnostics` block also exists to contradict it. Then what `checks` and `defaultCategory`
say, and in *which* tsconfig, since `ng build` and `ng test` can resolve different ones. Then the
resolved `@angular/compiler-cli` version, because the roster and the behaviour of individual checks
are both version-dependent. Anything not named in `checks` is at `defaultCategory`, and absent that,
at `warning`.

**What does the 22.1.3 change tell you about how this family is maintained?**
That a false positive is treated as a defect in the check rather than as something to document. The
event-handler check was firing on short property names, and the fix narrowed the check in a patch —
consistent with Angular's own published bar for adding a diagnostic, which requires *"a low,
preferably zero, false-positive rate"*. It is a useful thing to know when deciding whether to promote
checks to `error`: the maintenance direction is toward fewer false alarms, which makes the promotion
less risky than the semver caveat alone suggests, though not risk-free.

---

← Prev: [15d · Configuring it, and getting it wrong](15d-configuring-extended-diagnostics.md) · Index: [Topic index](README.md) · Next → [16 · Arriving from React, Vue or Svelte](16-arriving-from-react-vue-or-svelte.md)
