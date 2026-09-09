---
title: "Five questions, asked in order, place any `angular.json` failure on its layer before you edit anything — and the fifth one is for the case that produces no message at all"
sidebar_label: "15g · The diagnostic recipe"
sidebar_position: 15.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the message-producing lines of
> [`reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> [`node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts),
> [`registry.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/json/schema/registry.ts)
> and
> [`architect-command-module.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/command-builder/architect-command-module.ts),
> all at tag `v22.1.7`. Every message referenced here is quoted on one of the preceding pages from
> the source line that constructs it. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the payoff of the whole chunk: a fixed order of questions that turns any `angular.json`
failure into a bounded search.** The point is not that the questions are clever — they are not — but
that asking them *before* editing prevents the most expensive mistake in this file, which is changing
configuration that was never involved. Every question also tells you what it rules out, so a wrong
answer costs one step rather than a session.

## Step 0 — read the top of the output, not the bottom

Do this before the five questions, every time. The reader runs first, so anything it said is above
everything else — and its non-fatal messages are the ones that change what the workspace contains
without stopping the command
([15b](15b-the-warnings-that-drop-keys.md)).

If the failure at the bottom says something *does not exist* and you can see it in the file, the
explanation is almost certainly at the top, in the reader's own vocabulary, naming the real mistake.

## The five questions

**1 · Does the message contain a data path, or the phrase `Schema validation failed`?**
→ **Layer 4, option validation.** An option name or value is wrong. Read the parenthesised property
name, check `camelCase`, and check that the option belongs to *this* builder's schema.
[15d](15d-option-validation-failures.md) · [15e](15e-four-ways-to-fail-a-closed-schema.md) ·
[15f](15f-migrated-and-misplaced-options.md).
*Rules out:* the file's structure, the project, the target, the configuration and the builder — all
four were resolved to get here.

**2 · Does it name a builder or a package?**
→ **Layer 3, Architect resolution.** Check the `builder` string character by character, and check
that the package it names is installed. [03e](03e-the-error-ladder-of-an-invocation.md) is the ladder
of five messages this layer can produce.
*Rules out:* option names and values — nothing has looked at them yet.

**3 · Does it name a configuration?**
→ **Layer 3, target lookup.** `Configuration '<name>' for target '<target>' in project '<project>' is
not set in the workspace.` is thrown when the named configuration is absent — check the spelling and
check whether `defaultConfiguration` is supplying a name you did not intend.
[04f](04f-selecting-a-configuration.md).
*Rules out:* everything about options; the configuration was never found, so nothing was merged.

**4 · Does it talk about determining, or about a project or target existing?**
→ **Layer 2 or layer 1.** *"Cannot determine project"* is the command layer and the input is your
working directory or the project you passed ([14b](14b-what-the-commands-do-with-it.md)). *"Project
target does not exist"* is Architect, and the cause is often a key the reader dropped, which returns
you to step 0. Also check `root` and check that the target's value is an object.
*Rules out:* builders and options.

**5 · Is there no message at all, and the behaviour is simply wrong?**
→ **Nothing failed; something was replaced or dropped.** Two candidates, in this order:

- **A configuration replaced a whole value.** The merge between `options` and a configuration is a
  shallow spread, so a configuration naming `budgets`, `assets` or `optimization` replaces the entire
  value rather than adding to it — [04b](04b-the-merge-is-shallow.md).
- **A key was dropped at read time** and the reader said so in a line you scrolled past —
  [15b](15b-the-warnings-that-drop-keys.md).

## What each answer certifies

The order is the value. Because the layers run in sequence and each one throws rather than
accumulating, a message from a later layer is a receipt for every earlier one:

| The message you have | Already proven to be fine |
|---|---|
| option validation | the file, the project, the target, the configuration, the builder |
| builder resolution | the file, the project, the target |
| configuration lookup | the file, the project, the target |
| *"cannot determine project"* | the file parsed |
| a reader message | nothing downstream ran at all |

The practical use is negative. If you are looking at a schema validation failure, do not open the
`builder` string, do not check your working directory, and do not re-read `version` — all of them are
certified by the message you are holding.

## Two walk-throughs

**A target that is "not there".** `ng run web:serve:development` fails saying the target does not
exist, and `serve` is visibly in the file. Question 4 places it at Architect. Step 0 sends you to the
top of the output, where the reader reported skipping an invalid target value. The target's value was
a string rather than an object, so it never entered the parsed workspace. The fix is in the file, but
the diagnosis was in the first ten lines of the output rather than the last ten.

**An option that "does nothing".** `outputHashing` is set in `options` and the production build
produces unhashed filenames, with no error anywhere. Question 5 applies: nothing failed. The
`production` configuration names `outputHashing` too, and a configuration replaces the whole value —
so the base setting was never in play. Nothing is broken and nothing will report anything; the
effective value is simply the configuration's.

## Gotchas

**★ Symptom: half an hour spent on the wrong file after reading only the last error.** Cause: the
reader's non-fatal messages are printed first and describe the real mistake, while the failure at the
bottom describes its consequence in a different vocabulary. Fix: make step 0 a habit — read the first
ten lines of output before the last ten.

**★ Symptom: you edited `angular.json` before identifying the layer, and now two things are
different.** Cause: editing before diagnosing turns one unknown into two, and the second edit is
usually to configuration that was never involved. Fix: place the message on its layer, then make one
change, then re-run:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" }
    }
  }
}
```

**★ Symptom: there is no error at all and the output is wrong.** Cause: nothing failed — either a
configuration replaced a whole value, or a key was dropped at read time with a message you did not
see. Fix: check the configuration that applied, remembering that it replaces rather than merges:

```json
{
  "options": { "outputHashing": "all", "sourceMap": false },
  "configurations": {
    "production": { "outputHashing": "all", "budgets": [{ "type": "initial", "maximumError": "1MB" }] }
  }
}
```

**★ Symptom: you reproduced with a different command than the one that failed and concluded the file
is fine.** Cause: only layer 1 inspects the whole file; layers 2 to 4 only touch what the command
uses, so a broken `serve` target is invisible to `ng build`. Fix: reproduce with the command that
exercises the target in question:

```bash
ng run web:serve:development
```

**Symptom: a failure appears only in CI and the `angular.json` is identical.** Cause: two inputs
differ between environments and neither is in the file — the working directory, and the machine-wide
config file that is not in version control. Fix: remove the first from the equation by naming the
project, then check the second:

```json
{
  "scripts": {
    "ci:build": "ng run web:build:production"
  }
}
```

**Symptom: you fixed the symptom by adding the option to a configuration and it broke a different
configuration.** Cause: options set in a configuration apply only when that configuration is
selected, so the fix was scoped to one path. Fix: put values that should always apply in `options`,
and use configurations only for genuine differences:

```json
{
  "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json", "extractLicenses": true },
  "configurations": { "development": { "optimization": false, "sourceMap": true } }
}
```

**Symptom: the editor shows no problem, so the file is assumed correct.** Cause: an editor validates
against the schema, which is one of four layers and disagrees with the reader in both directions —
the schema requires `projectType` where the reader does not, and the reader rejects any `version`
that is not exactly the integer `1`. Fix: treat editor validation as a first pass and keep `$schema`
present so it is at least available:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": { "web": { "root": "", "projectType": "application" } }
}
```

**Symptom: you cannot tell whether a value came from `options` or from a configuration.** Cause: the
merged object is a runtime value and is not written down anywhere, so neither the file nor the error
message shows it. Fix: reason it out from the rule rather than searching — the configuration's value
wins for every key it names, and `options` supplies the rest:

```json
{
  "options": { "optimization": { "scripts": true, "styles": true } },
  "configurations": { "development": { "optimization": false } }
}
```

## Interview questions

**★ Walk me through diagnosing an `angular.json` failure you have not seen before.**
Start at the top of the output rather than the bottom, because the workspace reader runs first and
its non-fatal messages describe mistakes whose consequences appear much later in a different
vocabulary. Then ask five questions in order. Does the message contain a data path — that is option
validation, and everything upstream is already certified. Does it name a builder or a package — that
is Architect resolution. Does it name a configuration — that is the target lookup. Does it talk about
determining a project, or about a project or target existing — that is the command layer or the
reader. And if there is no message at all, nothing failed: look at the shallow merge between
`options` and a configuration, or at a key the reader dropped. Each answer bounds the search, and
several of them rule out most of the file.

**★ There is no error and the build output is wrong. What do you check?**
Two things, in order. First, the merge: a configuration is applied as a shallow spread over
`options`, so any key the configuration names has its entire value replaced — an array replaces an
array, an object replaces an object, and nothing is combined element-wise. That accounts for most
"my option is being ignored" reports, and it is not a failure of any kind. Second, a dropped key:
the reader reports some problems and continues, so a target or project written with the wrong value
type is simply absent from the parsed workspace, and the only trace is a line at the top of the
output. Neither produces an error, which is why both have to be checked deliberately rather than
searched for.

**★ Why is identifying the layer worth doing before you edit anything?**
Because an edit made before the diagnosis is usually to configuration that was not involved, and it
turns one unknown into two. The layers run in a fixed order and throw rather than accumulate, so the
message you are holding certifies everything upstream of it: a schema validation failure proves the
file parsed, the project and target resolved, the configuration existed and the builder loaded. That
is four things you can stop looking at. Editing first discards that information and replaces it with
a second change to reason about.

**What does a builder resolution error tell you about your options, and vice versa?**
A builder resolution error tells you the options have not been looked at yet, because the builder
must be loaded before its schema is available to validate against — so option names are irrelevant to
that failure. An option validation error tells you the builder resolved successfully, which means the
builder string is correct and the package is installed. The two errors are mutually exclusive
diagnoses, and knowing which one you have removes the other half of the file from consideration.

**How would you decide whether to reproduce a problem locally or in CI?**
By whether the suspected input differs between them. Layers 3 and 4 depend only on the file and the
installed packages, so they reproduce anywhere. Layer 2 depends on the working directory and on
whether a project was named, which is exactly what differs between a developer's shell and a runner —
so a "CI only" failure that mentions determining a project is almost always the cwd. And a setting
coming from the machine-wide config file, which is not in version control, will never reproduce on a
runner at all. Naming the project in scripts removes the first difference and makes the second easier
to see.

**Which single habit removes the most time from this class of debugging?**
Reading the first ten lines of output before the last ten. The reader's warnings are the only place a
dropped key is ever named, they are printed before anything else, and the failure they cause arrives
at the end of the output in unrelated wording. Everything else in the recipe is a refinement; that
one habit converts the single most confusing failure mode in `angular.json` — a key that is visibly
present and reported as not existing — into a two-line diagnosis.

{/* FOOTER */}
