---
title: "Configuring extendedDiagnostics while strictTemplates is explicitly false is a build error whose message is better documentation than the documentation — and a v22 upgrade writes two suppressions into that same block for you, described as temporary by a release note that nothing enforces"
sidebar_label: "08d · …and the upgrade"
sidebar_position: 8.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`verifyCompatibleTypeCheckOptions`, whose `messageText` is quoted whole and unedited) — and the
> [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) for the two
> diagnostics a v22 upgrade newly triggers and the advice attached to them.
> Documentation-validated; **no sandbox run** — the error text below is quoted from the source that
> constructs it, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[08c](08c-configuring-extended-diagnostics.md) covered the block's shape and where it belongs. This
page is what happens to it under pressure: the one configuration the compiler flatly refuses, and the
two suppressions a v22 upgrade writes into it on your behalf and then forgets about.** Both are places
where the honest thing to do and the thing that makes the build green immediately are different, and
both are decided in the tsconfig rather than in any component.

## The one combination that is a build error

Configuring `extendedDiagnostics` while `strictTemplates` is explicitly `false` fails at config time,
before a single template is read. The message is unusually good documentation — it states the
constraint, the reason, and both remedies, numbered. Verbatim from the source that constructs it:

> ```
> Angular compiler option "extendedDiagnostics" is configured, however "strictTemplates" is disabled.
>
> Using "extendedDiagnostics" requires that "strictTemplates" is also enabled.
>
> One of the following actions is required:
> 1. Remove "strictTemplates: false" to enable it.
> 2. Remove "extendedDiagnostics" configuration to disable them.
> ```

⚠️ **The check tests `strictTemplates === false` — the explicit opt-out only.** Omitting the key, which
is the v22 default and means `true`, is fine. So this error can only fire in a project that *wrote*
`false`, which in practice means a project that was upgraded rather than generated. That mirrors the
`!== false` semantics of the `strictTemplates` getter exactly
([07c](07c-the-escape-hatches-are-ranked.md)): one place treats a missing key as strict, and the other
refuses to treat a missing key as an opt-out. Two guards, one policy — *an omission is never a
decision.*

**The two remedies are not equal, and the error does not say so.** Remedy 2 makes the build green in
one edit and permanently removes a class of checking from the project. Remedy 1 is the one you want
and costs a template migration. Choosing the cheap one under time pressure is how a project ends up
with neither strict templates nor extended diagnostics, and no record of when that was decided.
[15d](../01-compiler-with-a-framework-attached/15d-configuring-extended-diagnostics.md) has the error
code and the asymmetry in full.

## The suppressions a v22 upgrade writes for you

Two extended diagnostics — `nullishCoalescingNotNullable` and `optionalChainNotNullable` — become
reachable in v22 in code that never triggered them before. The release notes say so and give the advice
themselves, typos included, quoted as published:

> *"This change will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable`
> diagnostics on exisiting projects. You might want to disable those 2 diagnotiscs in your `tsconfig`
> temporarily."*

There is a migration that writes exactly that. If you are doing it by hand, it goes in the **root**:

```json
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

⚠️ **If you already had a `defaultCategory`, it must go in this same object** — the placement trap in
[08c](08c-configuring-extended-diagnostics.md) applies with full force here, because the migration is
adding a nested object to a file that may already have one elsewhere in the chain.

🔴 **Note the word *"temporarily"*.** A suppression written by a migration has no expiry and produces
no output — unlike a warning, it never reminds anyone it exists. The same v22 release also ships a
migration that writes `strictTemplates: false` into upgraded projects
([05](05-stricttemplates-is-the-default-in-v22.md)), which makes the policy legible: **new projects get
the strict default; upgraded projects get an explicit opt-out written for them.** Two independent
migrations doing the same thing in one release is a stance, not a coincidence, and the corollary is
that after any Angular major upgrade the tsconfig is the first file to read.
[04 · 07](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md) covers the full inventory
of what runs.

## Gotchas

**★ Symptom: the build fails with `Angular compiler option "extendedDiagnostics" is configured, however
"strictTemplates" is disabled.`** Cause: exactly what it says, and only when `strictTemplates` was
written as `false`. Fix: the message names both remedies and you must pick one. Adopting strictness —
delete the `strictTemplates` line and keep the block:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": { "defaultCategory": "error" }
  }
}
```

Or keep the opt-out and delete the block. There is no configuration that has both.

**★ Symptom: after upgrading to v22, `nullishCoalescingNotNullable` and `optionalChainNotNullable` fire
across the codebase.** Cause: a v22 compiler change makes both reachable where they were not before;
the release notes advise disabling them *"temporarily"*. Fix: the suppression block above, in the root
— and an issue to remove it, because nothing else will.

**★ Symptom: extended diagnostics stopped firing entirely and nobody changed the block.** Cause:
someone took remedy 2 of the compatibility error — they set `strictTemplates: false` for an unrelated
reason, hit the config error, and deleted the `extendedDiagnostics` block to get the build green. Fix:
restore the block and reverse the opt-out; `strictTemplates: false` costs far more than the errors it
silenced ([14g](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md)).

**★ Symptom: a suppression added during an upgrade is still there a year later.** Cause: the release
notes said *"temporarily"* and nothing enforces that; a `"suppress"` entry produces no output at all.
Fix: promote them one at a time — change `"suppress"` to `"warning"`, fix what appears, then
`"error"`, then delete the entry. Suppressions are the only diagnostic setting that gets quietly
permanent.

**Symptom: you deleted `strictTemplates: false` to clear the config error and got four hundred template
errors.** Cause: that is remedy 1 working as designed — the opt-out was holding those back. Fix: this
is the strictness migration, not a config problem. Take it one rejection class at a time with the
ladder in [07c](07c-the-escape-hatches-are-ranked.md), and if you need the build green today, revert
the deletion and schedule the work rather than reaching for remedy 2.

**Symptom: you removed a suppression from the root tsconfig and the diagnostic still does not fire.**
Cause: another copy of it elsewhere in the chain, or in a second project's config. Fix: grep the whole
workspace rather than the file you remember editing:

```bash
grep -rn 'nullishCoalescingNotNullable\|optionalChainNotNullable' --include='tsconfig*.json' .
```

**Symptom: a teammate's build reports these diagnostics and yours does not, on the same commit.**
Cause: different targets resolve different tsconfigs — `ng build` and `ng test` are named separately in
`angular.json` — so a suppression present in one chain and absent from the other produces exactly this.
Fix: check which config each target names before comparing anything else
([06 · 05c](../06-angular-json-anatomy/05c-the-build-target.md)).

## Interview questions

**★ Can you use `extendedDiagnostics` with `strictTemplates: false`?**
No. The compiler yields a configuration error at config time whose message names both remedies:
*"1. Remove "strictTemplates: false" to enable it. 2. Remove "extendedDiagnostics" configuration to
disable them."* The detail worth knowing is that the check tests `strictTemplates === false`
specifically — the explicit opt-out — so omitting the key entirely, which is the v22 default and means
`true`, is fine. Only a project that wrote `false` can hit this, which in practice means an upgraded
project rather than a generated one.

**★ The build fails with a config error naming two remedies. How do you choose?**
By noticing that the error presents them as equals and they are not. Remedy 2 — delete the
`extendedDiagnostics` block — makes the build green in one edit and permanently removes a class of
checking, with no record of the decision beyond a diff nobody will find. Remedy 1 — delete
`strictTemplates: false` — is the outcome you want and costs a template migration you have to schedule.
The right answer under time pressure is neither: revert whatever introduced the conflict, then plan
remedy 1. The wrong answer, and the common one, is remedy 2 at 5pm on a Friday.

**★ A migration wrote two suppressions into your tsconfig. What do you do with them?**
Treat them as a debt with a due date, because nothing else will. The release notes describe the
suppression as *"temporarily"*, but a `"suppress"` entry produces no output at all, so unlike a warning
it never reminds anyone it exists. Promote one at a time: `"suppress"` to `"warning"`, fix what appears,
then `"error"`, then delete the entry. Doing both at once produces a wall, and the wall produces a
revert.

**Why does Angular ship migrations that switch its own new defaults back off?**
Because the alternative is an upgrade that fails on day one for every existing project, which is how
teams end up several majors behind. v22 contains two instances of the same policy — a migration that
writes `strictTemplates: false`, and one that suppresses the two newly-reachable extended diagnostics —
so the stance is explicit: **new projects get the strict default; upgraded projects get an explicit
opt-out written for them.** The cost is that the tsconfig of an upgraded project no longer describes
the framework's defaults, it describes the history of its upgrades. That is why reading the tsconfig is
the first step in diagnosing any "this compiles for me and not for you" report.

**Why does the compiler refuse `extendedDiagnostics` under `strictTemplates: false` rather than just
ignoring it?**
Because the extended checks are gated on strict template checking being active, so with strictness off
the block cannot do anything — and a configuration that silently does nothing is worse than one that
fails. It would sit in the file looking like policy, survive code review, and be cited in a discussion
about coverage. Failing at config time converts an invisible no-op into a decision someone has to make
in writing, which is the same reasoning behind checking `=== false` rather than falsy: the compiler is
trying to make sure an omission is never mistaken for an intent.

---

← Prev: [Configuring extended diagnostics](08c-configuring-extended-diagnostics.md) · Index: [Topic index](README.md) · Next → [TypeScript 6 defaults](09-typescript-6-defaults-and-what-ng-new-writes.md)
