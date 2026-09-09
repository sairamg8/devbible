---
title: "Two commands escape single-project resolution entirely — a multi-target command runs in every project that declares the target, sequentially and without stopping at a failure, and `ng run` names the project outright so nothing is resolved at all"
sidebar_label: "14c · Multi-target and `ng run`"
sidebar_position: 14.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the target loop in
> [`packages/angular/cli/src/command-builder/architect-command-module.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/command-builder/architect-command-module.ts)
> at tag `v22.1.7`, and
> [angular.dev — Configuring builder targets](https://angular.dev/reference/configs/workspace-config#configuring-builder-targets).
> ⚠️ Which commands set `multiTarget` was **not** enumerated by the sources read here and is written
> as unsettled. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The resolution ladder on [14b](14b-what-the-commands-do-with-it.md) is machinery for working out
what you meant. Two things bypass it.** A multi-target command does not want one project — it wants
all of them that declare the target, and it never consults the working directory. And `ng run` does
not need resolving, because the project, the target and the configuration are all in the argument.
Between them they cover the two situations where "which project?" is the wrong question, and knowing
which one you are in changes what a failure means.

## Multi-target commands run everywhere, one after another

```ts
// This runs each target sequentially.
const projectNames = this.getProjectNamesByTarget(target);
if (!projectNames) {
  return this.onMissingTarget('Cannot determine project or target for command.');
}

for (const project of projectNames) {
  process.title = `${originalProcessTitle} (${project})`;
  result |= await this.runSingleTarget({ configuration, target, project }, architectOptions);
}
```

Three facts from six lines:

- **Sequential, not parallel.** The source comment says so, and the loop `await`s each run. There is
  no concurrency control to tune here because there is no concurrency.
- **The process title is rewritten per project**, which is the only in-flight indication of which
  project is currently running — worth knowing when a long sweep appears to hang.
- **Results are accumulated with `|=`, and the excerpt contains no early exit.** Every project in the
  list is attempted and the command's overall result is the combination, so a failure in the second
  of five projects does not stop the remaining three.

That last point is a deliberate design for sweeps: one report covering everything beats a report
that stops at the first problem. The cost is that the first failure in the output is not necessarily
the only one, and a script that wants fail-fast semantics has to drive the projects itself.

⚠️ **Which commands are multi-target was not enumerated by the sources read for this page.**
`multiTarget` is a property of the command class rather than anything declared in `angular.json`, and
no source read here lists which commands set it. The observable rule is the useful one: **if a
command ran in every project that declares its target, it is a multi-target command** — and no amount
of changing directory will narrow it, because that branch returns before `getProjectByCwd` is ever
called.

## The configuration is passed through to every project

```ts
result |= await this.runSingleTarget({ configuration, target, project }, architectOptions);
```

The same `configuration` value is handed to each project's run. So a multi-target command with
`--configuration production` requires *every* project in the candidate set to define a `production`
configuration for that target — a project that does not will fail with the configuration error from
the Architect layer, `Configuration '<name>' for target '<target>' in project '<project>' is not set
in the workspace.`, while its neighbours succeed.

That is a common way a monorepo sweep half-fails after a new project is generated with a different
target shape.

## `ng run` is the explicit escape hatch

Everything on [14b](14b-what-the-commands-do-with-it.md) is machinery for figuring out what you
meant. `ng run` is how you say it outright. The documentation, verbatim:

> *"Other targets can be executed using the `ng run` command, and you can define your own targets."*

The argument is `project:target[:configuration]` — the same triple a `buildTarget` option uses to
point one target at another, which is [04](04-options-and-configurations.md). Nothing about `ng run`
consults the working directory, because nothing is left ambiguous:

```bash
ng run admin:build:production
ng run admin:serve:development
ng run ui:build
```

The target-bound commands take the project as a positional argument instead, described in the CLI's
own help text as *"The name of the project to build. Can be an application or a library."* The six
targets bound to commands are [03b](03b-the-six-command-bound-targets.md); every other target you
define is reachable **only** through `ng run`, which is the practical reason custom targets are
worth defining at all.

🔴 **`ng run` removes resolution, not defaults.** Omit the third component and the target's own
`defaultConfiguration` still applies — `ng run admin:build` runs the `production` configuration in a
generated project, because that is what the `build` target declares. If you want the base `options`
with no configuration merged in, that is a property of the target, not something the command can
switch off.

## Which form to reach for

| Situation | Form | Why |
|---|---|---|
| CI, any workspace with more than one project | `ng run <project>:<target>[:<config>]` | cannot be changed by the runner's working directory |
| A target the commands are not bound to | `ng run` | there is no other way to reach it |
| Interactive work inside one project | bare command, from the project directory | the cwd is the selector, and it is right there |
| A sweep across every project | the multi-target command | it is the only form that fans out |
| A sweep where the first failure should stop the rest | your own script over `ng run` | the built-in loop has no early exit |

## Gotchas

**★ Symptom: a command ran across every project in the workspace when you expected one.** Cause: it
is a multi-target command, and those return every project declaring the target without consulting
the working directory at all. Fix: changing directory will not narrow it — address one project and
target explicitly:

```bash
ng run admin:lint
```

**★ Symptom: a multi-target sweep reported a failure and later projects clearly still ran.** Cause:
the loop accumulates results with `|=` and the source shows no early exit, so every project in the
list is attempted and the outcomes are combined. Fix: read the whole output rather than stopping at
the first failure — and if you want fail-fast, drive the projects yourself:

```json
{
  "scripts": {
    "lint:all": "ng run web:lint && ng run admin:lint && ng run ui:lint"
  }
}
```

**★ Symptom: a multi-target command with `--configuration production` fails for one project and
succeeds for the others.** Cause: the same configuration name is passed to every project's run, and
one of them does not declare it. Fix: give the new project the configuration the sweep expects, or
run the projects individually:

```json
{
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "defaultConfiguration": "production",
          "options": { "tsConfig": "projects/admin/tsconfig.app.json" },
          "configurations": { "production": { "outputHashing": "all" } }
        }
      }
    }
  }
}
```

**★ Symptom: `ng run admin:build` applied optimisations you did not ask for.** Cause: the third
component is optional and, when omitted, the target's own `defaultConfiguration` applies — in a
generated project that is `production`. Fix: state the configuration you want, and check the
target's default before assuming `ng run` means "no configuration":

```bash
ng run admin:build:development
```

**Symptom: a target you defined yourself cannot be run.** Cause: only six target names are bound to
commands; anything else has no command to invoke it. Fix: `ng run` is the way, and it is the reason
custom targets exist:

```json
{
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "targets": {
        "verify-bundle": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "projects/admin/tsconfig.app.json", "statsJson": true }
        }
      }
    }
  }
}
```

```bash
ng run admin:verify-bundle
```

**Symptom: `ng run admin` fails.** Cause: the argument is a triple whose first two components are
required — a project name alone names no target. Fix:

```bash
ng run admin:build
```

**Symptom: a long multi-target sweep appears to hang and you cannot tell which project it is on.**
Cause: the runs are sequential and the only per-project indication is the process title, which the
loop rewrites as it goes. Fix: nothing to change in `angular.json` — but when you need per-project
visibility in CI logs, run the projects yourself so each invocation is a separate step:

```json
{
  "scripts": {
    "lint:web":   "ng run web:lint",
    "lint:admin": "ng run admin:lint",
    "lint:ui":    "ng run ui:lint"
  }
}
```

## Interview questions

**★ What is the difference between a multi-target command and a single-target one?**
A single-target command resolves to exactly one project, using the ladder: filter by target, take
the single candidate if there is one, otherwise consult the working directory. A multi-target
command skips all of that and returns *every* project that declares the target — the source comment
says *"For multi target commands, we always list all projects that have the target."* — and then runs
the target in each, sequentially. The practical difference is that changing directory cannot narrow
a multi-target command. Only addressing one project and target directly, with `ng run`, can.

**★ Does a multi-target command stop at the first project that fails?**
No. Results are combined with `result |= await this.runSingleTarget(...)` inside a loop with no early
exit, so each project in the list is attempted and the command's overall result is the accumulation.
That is usually what you want from a lint or test sweep — one report covering everything rather than
one that stops at the first problem — but it means the first failure in the output is not
necessarily the only one, and a pipeline that wants fail-fast has to drive the projects itself.

**★ Why can a multi-target command with `--configuration production` fail for exactly one project?**
Because the same configuration name is handed to every project's run. The loop passes
`{ configuration, target, project }` unchanged for each project in the candidate set, so a project
whose target does not declare that configuration fails at the Architect layer with `Configuration
'<name>' for target '<target>' in project '<project>' is not set in the workspace.` while its
neighbours succeed. This usually appears right after a new project is generated with a different
target shape, and the fix is to make the target shapes consistent rather than to change the command.

**★ When would you reach for `ng run` rather than a target-bound command?**
Whenever the target is not one of the six the commands are bound to, and whenever you want to remove
resolution from the equation. `ng run` takes `project:target[:configuration]`, so it names the
project, the target and optionally the configuration outright — no working directory, no candidate
filtering, no ambiguity. In CI it is the safer default precisely because it cannot be changed by
which directory the runner starts in, and because adding a project elsewhere in the workspace cannot
widen its candidate set.

**What does `ng run` *not* remove?**
Defaults. Omitting the configuration component does not mean "run with no configuration" — it means
the target's `defaultConfiguration` applies, which in a generated project is `production` for the
`build` target and `development` for `serve`. `ng run` removes the ambiguity about *which project
and target*, not the merging rules of the target it lands on. Anyone debugging "why is `ng run
app:build` minifying" is looking at the wrong layer: the answer is in the target's own
`defaultConfiguration`.

**How would you tell, without reading the CLI source, whether a command is multi-target?**
By what it did. A multi-target command runs the target in every project that declares it and ignores
the working directory entirely, so the observable signature is a command that fans out across the
workspace and cannot be narrowed by `cd`. A single-target command either resolves to one project or
fails with `Cannot determine project for command.` and a list of candidates. Since `multiTarget` is
a property of the command class rather than anything visible in `angular.json`, that behavioural test
is the honest way to answer — and it is worth saying so rather than reciting a list you cannot cite.

{/* FOOTER */}
