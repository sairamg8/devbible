---
title: "Naming the project in every command removes the invisible input entirely, which is a smaller and more durable fix than any layout change — and it survives the fact that a project's name and its directory are allowed to disagree"
sidebar_label: "14e · Name the project"
sidebar_position: 14.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `getProjectByCwd` in
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts),
> the `projects` key pattern in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> and the scoped-name conversion in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> all at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every problem on the previous three pages has one shared cause: the resolution input is not on the
command line.** [14d](14d-designing-for-unambiguous-resolution.md) answers it structurally, by
changing which project the workspace resolves to. This page answers it behaviourally, by making
resolution unnecessary — and that is the cheaper, more durable half. It is a change to package
scripts, not to the filesystem; it is reviewable in a diff; and it holds even when a project's name
and its directory disagree, which they are allowed to do.

## The rule

**Name the project.** Every script, every CI step, every documented command:

```json
{
  "scripts": {
    "start":       "ng serve web",
    "build:web":   "ng build web --configuration production",
    "build:admin": "ng build admin --configuration production",
    "test:web":    "ng test web",
    "verify":      "ng run web:build:production && ng run admin:build:production"
  }
}
```

This is stronger than any layout change, for three reasons.

- **It is immune to the working directory.** A runner that starts anywhere behaves identically,
  because `getProjectByCwd` is never reached when the project is supplied.
- **It is immune to other people's changes.** Adding a target to another project cannot widen a
  candidate set that was never consulted — the candidate-filtering behaviour is
  [14b](14b-what-the-commands-do-with-it.md), and naming the project skips it.
- **It documents intent.** The next reader sees which project a command was written for without
  reconstructing a filesystem layout or knowing which directory CI starts in.

`ng run <project>:<target>[:<configuration>]` is the strongest form, because it removes the target
from the question as well as the project — [14c](14c-multi-target-commands-and-ng-run.md).

## Name and directory are different things

A project's **name** is its key in the `projects` object; its **directory** is the value of `root`.
Nothing forces them to agree, and two mechanisms actively pull them apart:

- **Scoped names.** The `projects` key pattern accepts npm-style scopes, so `@acme/ui` is a legal
  project name, and the application schematic converts the name to a path by stripping the leading
  `@`. A project named `@acme/ui` lands under `projects/acme/ui` — [13j](13j-newprojectroot.md).
- **Later edits.** Nothing stops anyone changing `root` afterwards, and nothing renames the project
  when they do.

Commands take the **name**; resolution matches the **directory**. Keeping them aligned is a
convention, not a rule, and a workspace where they have drifted is one where *"I am in the `admin`
folder"* and *"the CLI resolved `admin`"* are two different claims that happen to look the same.

That asymmetry is another argument for naming: a name is stable and is what the command actually
takes, whereas a directory is an implementation detail that a refactor can move.

## What "name the project" does not fix

Being precise about the limits keeps the rule credible.

| Still true after naming every project | Why |
|---|---|
| A multi-target command still fans out | it never consults the cwd, and a positional project name is not what narrows it — `ng run` is |
| `defaultConfiguration` still applies | naming the project and target does not switch off the target's own default |
| Project-level `cli` and `schematics` blocks still resolve by cwd | those are configuration lookups, not command targets — [13g](13g-the-project-level-cli-block.md) |
| A wrong `root` still breaks resolution for interactive use | naming fixes scripts, not the shell you are typing in |

The last row is worth dwelling on: naming projects in scripts is a fix for **automation**. It does
not make an incorrect `root` correct, and interactive work from inside a project directory still
depends on `root` matching where you are.

## Gotchas

**★ Symptom: a CI job builds correctly on one runner and the wrong project on another.** Cause: the
two jobs start in different working directories, and nothing on the command line pins the project.
Fix: use `ng run`, which cannot be affected by the starting directory:

```json
{
  "scripts": {
    "ci:build": "ng run web:build:production"
  }
}
```

**★ Symptom: a script that does `cd projects/admin && ng build` breaks when someone renames the
directory.** Cause: the script encodes the resolution *input* rather than the intent, so it depends
on a path that has nothing to do with the project's name. Fix: state the project instead of the
directory:

```json
{
  "scripts": {
    "build:admin": "ng build admin --configuration production"
  }
}
```

**★ Symptom: a project named `@acme/ui` lives two directories deep and your scripts refer to
`projects/ui`.** Cause: the schematic strips the leading `@` and uses the rest as a path, so the
scoped name became `projects/acme/ui`; the name and the directory legitimately differ. Fix: refer to
projects by **name** in commands, and to directories only in paths:

```json
{
  "scripts": {
    "build:ui": "ng build @acme/ui"
  }
}
```

**★ Symptom: a developer's editor task runs a different project from their terminal.** Cause:
editors frequently launch tasks from the workspace root regardless of which file is open, so the cwd
differs from the shell's. Fix: remove the cwd from the equation in the task definition, exactly as
in CI:

```json
{
  "scripts": {
    "task:build": "ng run web:build:development"
  }
}
```

**Symptom: you named the project everywhere and a lint or test sweep still runs across the whole
workspace.** Cause: multi-target commands never consult the working directory *or* narrow to a
single positional project — they return every project declaring the target. Fix: address one project
and target directly:

```bash
ng run admin:lint
```

**Symptom: you named the project and the build is still minified in a development check.** Cause:
naming the project and target does not remove the target's `defaultConfiguration`, which in a
generated project is `production` for `build`. Fix: name the configuration too:

```bash
ng run web:build:development
```

**Symptom: `ng build admin` reports that the project does not exist, although the directory
`projects/admin` is right there.** Cause: the command takes the project **name**, which is the key
in the `projects` object — a directory with a matching name is not a project until the key exists.
Fix: check the key, not the folder:

```json
{
  "projects": {
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: after renaming a project's key, half the scripts break and the other half do not.**
Cause: the ones that break named the project; the ones that survived were relying on the working
directory, which did not change. Fix: rename in one pass and prefer having *all* scripts named, so a
rename is a single, complete, greppable change:

```json
{
  "scripts": {
    "start":     "ng serve web",
    "build":     "ng build web --configuration production",
    "test":      "ng test web",
    "lint:web":  "ng run web:lint"
  }
}
```

## Interview questions

**★ Why is naming the project a better fix than restructuring the workspace?**
Because it removes the dependency rather than reshaping it. Naming the project is immune to the
working directory, so every runner behaves identically; it is immune to other people's changes,
since adding a target elsewhere cannot widen a candidate set that is never consulted; and it records
intent in the script, so the next reader does not have to reconstruct a filesystem layout to know
what the command was for. Restructuring changes *which* project is the catch-all; naming means there
is no catch-all to fall into. The two are compatible, and the naming half pays off immediately and
reverts cleanly.

**★ What is the difference between a project's name and its directory, and when does it matter?**
The name is the key in the `projects` object; the directory is the value of `root`. Commands take
the name, and resolution matches the directory, so they answer different questions. They diverge
routinely for two reasons: the key pattern accepts npm-style scopes and the schematic converts
`@acme/ui` into the directory `acme/ui`, and nothing stops anyone editing `root` afterwards without
renaming the project. It matters the moment someone reasons *"I am in the `admin` folder, so the CLI
will use `admin`"* — which is true only while the two happen to agree, and nothing enforces that.

**★ What single change would you make first to a monorepo whose commands behave inconsistently?**
Rewrite the package scripts so every Angular command names its project, preferring
`ng run <project>:<target>:<configuration>` where a configuration is involved. It is small,
reviewable and reversible, it removes the invisible input from every automated path at once, and it
does not require moving a single file. Layout changes — giving the first application a real root,
unnesting projects, aligning names with directories — are worth doing afterwards, but they change
which project the ambiguity resolves to rather than removing the ambiguity.

**What does naming the project *not* fix?**
Four things, and being honest about them keeps the advice credible. A multi-target command still
fans out across every project declaring the target, because it never narrows to one. A target's
`defaultConfiguration` still applies when you omit the configuration. Project-level `cli` and
`schematics` lookups still resolve by working directory, because those are configuration lookups
rather than command targets. And an incorrect `root` is still incorrect — naming projects fixes
automation, not the shell you are typing in. The rule is a fix for reproducibility, not a
substitute for a correct workspace.

**Someone argues that `cd`-ing into the project directory is equally explicit. What is wrong with
that?**
It is explicit about the *input* rather than the *intent*, which makes it fragile in three ways. It
breaks when the directory is renamed, even though the project was not. It depends on the shell's
starting point, so it composes badly with CI steps and editor tasks that may already be somewhere
else. And it is not visible in the command itself, so a reader of the script has to reconstruct the
resolution algorithm to know what it does. Naming the project is the same number of characters and
none of those failure modes.

**How would you make a project rename a safe operation?**
By making sure every command names the project, so the rename is a single greppable change across
package scripts, CI configuration and documentation, and nothing depends on the directory. The
failure mode to avoid is the mixed state — some scripts naming the project, others relying on the
working directory — because after the rename the named ones fail loudly and the unnamed ones keep
working, which reads like a partially broken rename rather than a fully applied one.

---

← Prev: [The empty root and layout](14d-designing-for-unambiguous-resolution.md) · Index: [Topic index](README.md) · Next → [When it is wrong](15-when-angular-json-is-wrong.md)
