---
title: "`\"strictTemplates\": false` in an upgraded project was written by a tool on a specific day to keep a build green — it is a dated TODO with no owner, and v22 shipped the same manoeuvre twice, which is the pattern worth learning rather than the line"
sidebar_label: "05d · The opt-out is a dated TODO"
sidebar_position: 5.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` `CHANGELOG.md` at tag
> `v22.1.5` (the `22.0.0` and `22.1.0` sections), and
> [`packages/core/schematics/migrations/strict-templates-default/index.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations/strict-templates-default/index.ts)
> at that tag, read through the GitHub contents API. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A setting written by a migration is not a preference, and reading it as one is how it survives for
years.** [05c](05c-what-the-upgrade-wrote-into-your-file.md) showed the code that writes
`"strictTemplates": false` into an upgraded project. This page is what to do about the line: how to
recognise it in review, how to remove it without reinstating it wholesale, and why the same
manoeuvre appears **twice** in Angular 22.0.0 — which makes it a policy to recognise rather than a
one-off to fix.

## The line is a dated TODO, not a preference

`"strictTemplates": false` in an upgraded project was not chosen by anyone on the team. It was
written by a tool, on a specific day, to keep a build green through a version bump. It carries no
information about what the team wants; it carries information about what the codebase could not yet
do on that day.

That distinction changes three things:

- **In code review**, the right question is not *"why did we choose this?"* but *"when was this
  written, and who owns removing it?"*
- **In a decision record**, it belongs under debt, not under configuration.
- **In a grep**, it is indistinguishable from a deliberate `false` — which is exactly why the date
  has to come from `git log` on the file rather than from the file itself.

```jsonc
// tsconfig.app.json — the line the migration added
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

The `ng update` side of the same story — that the update hands you a debt silently, and what else it
handed you at the same time — is
[04 · 07 The v22 migration inventory](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md).

## Adopting the default is a deletion, in every file the migration touched

```jsonc
// tsconfig.app.json — after adopting v22's default
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

Delete it from `tsconfig.spec.json` too, or your tests keep the old behaviour and your build does
not — a split that is worse than either state, because a template error then reaches CI through the
build and passes through the test run.

## If deleting it produces a wall of errors

🔴 **Do not put it back wholesale.** Every individual strictness flag is applied *on top of* the
`strictTemplates` baseline, with a `!== undefined` guard, so you can keep the baseline and disable
the one check that is generating the noise:

```jsonc
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

That is a far smaller retreat than the all-or-nothing switch, and it is the difference between one
category of error deferred and every template check turned off. Which flag corresponds to which
class of error is
[06 · What `strictTemplates` switches on](06-what-stricttemplates-switches-on.md); the cost of the
all-or-nothing switch specifically is
[01 · 14g What turning it off costs](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md).

## The same policy, twice, in one release

`strictTemplates` is not the only v22 default that arrives with a migration to switch it back off.
The v22.0.0 changelog's breaking-changes section says this under `### compiler`, verbatim — the two
typos are upstream and are quoted as written:

> *"- This change will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable`
> diagnostics on exisiting projects. You might want to disable those 2 diagnotiscs in your
> `tsconfig` temporarily."*

and the paired migration is listed under `### migrations`:

> `| 6a435658e2 | feat | Disabling nullishCoalescingNotNullable & optionalChainNotNullable on ng update |`

🔴 **Two instances of one policy in a single release: new projects get the strict default; upgraded
projects get an explicit opt-out written for them.** Recognising the pattern is what stops the next
such line from being read as somebody's preference. What those two diagnostics actually catch, and
why the suppressions are worth removing, is
[01 · 15e What changes underneath you](../01-compiler-with-a-framework-attached/15e-what-changes-underneath-you.md).

## ⚠️ The changelog does not announce the default change

The only traces of `strictTemplates` becoming the default in `angular/angular`'s `CHANGELOG.md` at
`v22.1.5` are these, under `# 22.0.0 (2026-06-03)`, `### migrations`:

> `| 682aaf943f | feat | add strictTemplates to tsconfig during ng update |`
> `| 1415d86980 | fix | Fix typo for strict-template migration |`

and one follow-up under `# 22.1.0 (2026-07-29)`, `### language-service`:

> `| a99fb915c0 | fix | account for strictTemplates being enabled by default |`

The default flip is **not** listed in v22.0.0's `## Breaking Changes` section, which does carry
entries under `compiler`, `compiler-cli`, `core`, `forms`, `http`, `platform-browser`, `router` and
`upgrade`. That is stated here as an observation about the changelog, not as a claim about intent;
no source was found explaining the omission.

The practical lesson: **read the `### migrations` list as part of the breaking-change surface.** A
migration that writes a setting into your project is a behaviour change whether or not it is
labelled as one, and in v22 it was the only place the change was visible.

## Gotchas

**★ Symptom: `"strictTemplates": false` has been in the repository for a year and nobody can say
why.** Cause: it was written by a migration, not by a person, so there is no decision to recall.
Fix: date it from the commit that introduced it and give it an owner in the file — a comment is
cheap and survives the next upgrade:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**★ Symptom: you removed the opt-out from the build config, the build is strict, and the test run
still is not.** Cause: the migration wrote into both the build and the test tsconfigs. Fix: remove
it from both, or the two halves of CI disagree about what is an error:

```bash
grep -rn strictTemplates -- '**/tsconfig*.json'
```

**★ Symptom: removing the opt-out produces hundreds of errors, so it goes back in.** Cause: an
all-or-nothing switch was used to answer a question about one class of error. Fix: keep the
baseline, disable the specific check, and shrink the exception over time:

```jsonc
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

**Symptom: you disabled `strictTemplates` and the build now fails with a configuration error about
`extendedDiagnostics`.** Cause: the two are incompatible by design, and the check tests the resolved
`strictTemplates === false`. Fix: apply one of the two remedies the error text names — the full
message and the inheritance angle are in [04c](04c-what-the-shallow-merge-costs.md):

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**Symptom: after adopting the default you also find `nullishCoalescingNotNullable` and
`optionalChainNotNullable` suppressed and do not remember that either.** Cause: the second v22
migration, which the changelog describes as *Disabling nullishCoalescingNotNullable &
optionalChainNotNullable on ng update*. Fix: the same treatment — remove the suppressions
deliberately, one at a time:

```jsonc
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

⚠️ Remember that this object replaces any inherited `extendedDiagnostics` wholesale — write
`defaultCategory` in the same block if you rely on it ([04c](04c-what-the-shallow-merge-costs.md)).

**Symptom: you searched the v22 release notes for "strictTemplates is now the default" and found
nothing, so you concluded it was not.** Cause: the change is not in the breaking-changes list; the
only traces are two migration entries and a language-service fix. Fix: check the compiler's own
source or the option's JSDoc rather than the changelog when a default is in question
([05](05-stricttemplates-is-the-default-in-v22.md)).

**Symptom: a team writes `"strictTemplates": true` defensively into every project so the default can
never move under them.** Cause: reasonable instinct, real cost. Fix: know the trade — the explicit
value pins the behaviour and documents the decision, and it also makes every future migration treat
the project as having an opinion, so a migration that would have adjusted the setting will skip it
silently. Pick deliberately; both answers are defensible, and only one of them is usually chosen on
purpose.

**Symptom: the opt-out disappears from a project and nobody knows who removed it.** Cause: it is one
line in a JSON file with no ceremony around it. Fix: treat template strictness as a decision worth
a commit of its own, with the error count in the message, so the removal is findable later.

## Interview questions

**★ Someone points at `"strictTemplates": false` in a code review and asks why the team chose it.
What do you say?**
That nobody chose it. It was written by the required `strict-templates-default` migration on upgrade
day, so that the build would survive the version bump, and it records what the codebase could not
yet do rather than what the team wants. The right frame is a dated TODO: it should carry an owner
and a date, and removing it is a scheduled piece of work rather than a preference to be defended.
That is also why the migration is preserve-behaviour by design — adopting the new default is left as
an explicit, deliberate act.

**★ You delete the opt-out and get four hundred template errors. What now?**
Not reinstating it. Every individual strictness flag is applied on top of the `strictTemplates`
baseline with an `!== undefined` guard, so the correct move is to keep the baseline and disable the
one check producing most of the noise — most often `strictDomEventTypes`, which Angular's own source
flags as having *"an adverse effect on developer experience"* for expressions like
`$event.target.value`. That converts an all-or-nothing retreat into a single named exception with a
much smaller blast radius, and it leaves the rest of the checking in place while the exception is
worked down.

**★ Did the v22 changelog announce the default change as a breaking change?**
No. The only traces are the migration entry under v22.0.0's `### migrations`, *add strictTemplates
to tsconfig during ng update*, a follow-up typo fix, and a v22.1.0 language-service fix described as
*account for strictTemplates being enabled by default*. The `## Breaking Changes` section, which
does carry entries for seven other packages, does not mention it. The practical lesson is to read
the migrations list as part of the breaking-change surface: a migration that writes a setting into
your project is a behaviour change whether or not it is labelled as one.

**Is this pattern unique to `strictTemplates`?**
No — it happened twice in the same release. The v22.0.0 breaking-changes text warns that the change
*"will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable` diagnostics on
exisiting projects"* and suggests disabling them temporarily, and a paired migration named
*Disabling nullishCoalescingNotNullable & optionalChainNotNullable on ng update* does exactly that.
The generalisation worth carrying: in v22, new projects get the strict default and upgraded projects
get an explicit opt-out written for them — so any strictness `false` in an upgraded Angular project
should be assumed to be a migration's work until proven otherwise.

**How would you schedule the removal so it actually happens?**
Delete the line in a branch, count the errors, and let the count decide the shape of the work. If it
is small, fix it in one change. If it is large, land the baseline with one or two named flag
exceptions instead — that gets most of the checking immediately and leaves an exception list that is
visible, greppable and finite, which a single `strictTemplates: false` never is. Then remove one
exception per iteration, with the error count in each commit message so progress is legible.

**Why does writing `"strictTemplates": true` defensively have a cost?**
Because migrations read the resolved value to decide whether you already have an opinion. The v22
migration skips any file whose resolved `strictTemplates` is defined — that is the behaviour you
want here, since it prevents an opt-out being written. But the same mechanism means a future
migration that would have adjusted the setting for you will also pass the project by. An explicit
value buys stability and gives up automation; that is a fair trade, and it should be a decision
rather than a habit.

---

← Prev: [What the upgrade wrote](05c-what-the-upgrade-wrote-into-your-file.md) · Index: [Topic index](README.md) · Next → [The three guards](05e-the-three-guards.md)
