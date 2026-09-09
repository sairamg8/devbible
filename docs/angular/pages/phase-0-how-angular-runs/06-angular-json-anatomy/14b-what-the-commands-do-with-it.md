---
title: "The candidate set is filtered by target before the working directory is consulted, so a five-project workspace can be unambiguous — and when it is not, the CLI stops and names every project you could have meant"
sidebar_label: "14b · What commands do with it"
sidebar_position: 14.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `getProjectNamesByTarget` and the target
> loop in
> [`packages/angular/cli/src/command-builder/architect-command-module.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/command-builder/architect-command-module.ts)
> at tag `v22.1.7`, cross-read against
> [angular.dev — Workspace configuration](https://angular.dev/reference/configs/workspace-config#configuring-builder-targets).
> Documentation-validated; **no sandbox run** — every message below is transcribed from that source
> file, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Project resolution is not the first step of running a command — it is the third.** The CLI starts
from the *target* the command is bound to, collects the projects that actually declare that target,
and only consults the working directory if more than one survives. That ordering explains two things
that otherwise look inconsistent: why `ng serve` needs no project name in a monorepo where only one
application has a `serve` target, and why a command can fail with `Cannot determine project for
command.` in a workspace where you were standing inside a project the whole time.

## The decision, verbatim

```ts
if (allProjectsForTargetName.length === 0) {
  return undefined;
}

if (this.multiTarget) {
  // For multi target commands, we always list all projects that have the target.
  return allProjectsForTargetName;
} else {
  if (allProjectsForTargetName.length === 1) {
    return allProjectsForTargetName;
  }

  const maybeProject = getProjectByCwd(workspace);
  if (maybeProject) {
    return allProjectsForTargetName.includes(maybeProject) ? [maybeProject] : undefined;
  }
}
```

Read it as a ladder:

1. **No project declares the target** → `undefined`, which becomes a missing-target failure.
2. **The command is multi-target** → *every* project that declares the target is returned. The cwd
   is never consulted.
3. **Exactly one project declares the target** → that one, regardless of where you are standing.
4. **More than one declares it** → now, and only now,
   [`getProjectByCwd`](14-multi-project-workspaces.md) runs.
5. 🔴 **The cwd's project must also declare the target.** `allProjectsForTargetName.includes(maybeProject)`
   — if the project you are standing in does not have the target, the result is `undefined`, not a
   fallback to some other project that does.

Step 5 is the counter-intuitive one, and it is the reason a command can fail while you are standing
inside a perfectly valid project: being *in* a project is not the same as that project supporting
the command.

## The message, in full

When resolution runs out of options, this is what is thrown:

```ts
throw new CommandModuleError(
  'Cannot determine project for command.\n' +
    'This is a multi-project workspace and more than one project supports this command. ' +
    `Run "ng ${this.command}" to execute the command for a specific project or change the current ` +
    'working directory to a project directory.\n\n' +
    `Available projects are:\n${allProjectsForTargetName.sort().map((p) => `- ${p}`).join('\n')}`,
);
```

Three things are worth extracting from that string.

- It states the **precondition** — *"This is a multi-project workspace and more than one project
  supports this command"* — which tells you the target-filtering step already ran and left more than
  one candidate.
- It names **both fixes**, in the CLI's own words: pass the project to the command, or change the
  working directory to a project directory.
- It ends with **the list of projects that declare the target**, sorted. That list is the most useful
  part and it is easy to scroll past: it is not "every project in the workspace", it is "every
  project this command could have meant".

There is a second, terser message from the same layer for the case where nothing resolves at all:

```ts
const projectNames = this.getProjectNamesByTarget(target);
if (!projectNames) {
  return this.onMissingTarget('Cannot determine project or target for command.');
}
```

`Cannot determine project or target for command.` is the *no candidates* case — either no project
declares the target, or the cwd resolved to a project that does not. The wording difference between
the two messages is the diagnosis: *"project"* alone means several candidates and no way to choose;
*"project or target"* means there was nothing to choose from.

## This layer runs before Architect, which is a diagnosis in itself

Both messages above come from the command layer, which sits **above** Architect. Nothing has been
resolved to a builder yet, no option schema has been consulted, and no target object has been read
beyond checking that the name exists on a project.

That ordering is useful when reading a failure. The Architect messages — `Project "<name>" does not
exist.`, `Project target does not exist.`, `Cannot find builder "<pkg>:<name>".` — are the ladder on
[03e](03e-the-error-ladder-of-an-invocation.md), and **seeing one of those proves that this layer
already succeeded**: a project was chosen, and a target name was carried forward. Conversely,
`Cannot determine project for command.` means nothing downstream ran at all, so there is no point
inspecting builder strings or option spellings.

| You see | What it proves | Where to look |
|---|---|---|
| `Cannot determine project for command.` | several candidates, cwd did not pick one | the project name you passed, or your cwd |
| `Cannot determine project or target for command.` | no candidates at all | whether the target exists on the project you mean |
| `Project "<name>" does not exist.` | this layer resolved, Architect disagrees about the name | the name passed to `ng run` |
| `Project target does not exist.` | project resolved, target name is wrong | the `targets` keys of that project |

## The candidate set changes when you add a target

Because filtering happens on the target rather than on the project, adding a target to a second
project changes the resolution behaviour of a command nobody edited. A workspace where only `web`
has a `serve` target lets `ng serve` run bare; adding `serve` to `admin` makes the same bare command
depend on the working directory, and makes it fail outright from the repository root.

This is the most common way a monorepo's commands "suddenly" become ambiguous, and the change that
caused it is in a different project's target list.

## Gotchas

**★ Symptom: `Cannot determine project for command.` in a workspace where every project looks
fine.** Cause: more than one project declares the target and the working directory did not resolve
to one of them — either it is outside every project root, or two projects share a root. Fix: use
either of the two fixes the message itself names — pass the project, or move into its directory:

```json
{
  "scripts": {
    "build:web":   "ng build web --configuration production",
    "build:admin": "ng build admin --configuration production"
  }
}
```

**★ Symptom: a command fails to resolve a project even though you are standing inside one.** Cause:
the cwd's project must also declare the target — `allProjectsForTargetName.includes(maybeProject)` —
and if it does not, the result is `undefined` rather than a fallback to a project that does. Fix:
name the project that actually has the target, or add the target to the one you are in:

```bash
ng run web:serve:development
```

**★ Symptom: `ng serve` works without a project name in a four-project monorepo, and you expected it
to be ambiguous.** Cause: the candidate set is filtered by target *before* the cwd is consulted, so
if only one project declares a `serve` target there is nothing to disambiguate. Fix: nothing to
repair — but do not read it as "the CLI picked my main app". Adding a `serve` target to a second
project changes the behaviour of a command you did not touch:

```json
{
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application", "targets": { "serve": { "builder": "@angular/build:dev-server" } } },
    "admin": { "root": "projects/admin", "projectType": "application" },
    "ui":    { "root": "projects/ui",    "projectType": "library" }
  }
}
```

**Symptom: `Cannot determine project or target for command.` instead of the longer message.** Cause:
this is the *no candidates* branch — no project declares the target, or the resolved project does
not. Fix: check the target actually exists on the project you mean, which is a spelling question as
often as a structural one:

```json
{
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "targets": {
        "build": { "builder": "@angular/build:application", "options": { "tsConfig": "projects/admin/tsconfig.app.json" } }
      }
    }
  }
}
```

**Symptom: you scrolled past the useful part of the error.** Cause: the message ends with
`Available projects are:` and a sorted list, which is the set of projects that declare the target —
not the set of projects in the workspace. Fix: read the list first; it usually makes the intended
project obvious, and it also reveals when a project you expected is *missing* the target entirely.

**Symptom: `ng test` reports that it cannot determine a project or target in a workspace generated
with `--skip-tests`.** Cause: no `test` target was written, so the candidate set is empty and the
command takes the no-candidates branch. Fix: add the target, or accept that the command has nothing
to run in this workspace:

```json
{
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "targets": {
        "test": { "builder": "@angular/build:unit-test", "options": {} }
      }
    }
  }
}
```

**Symptom: a bare command worked yesterday and is ambiguous today, and `git log` shows no change to
the project you run it against.** Cause: the candidate set is built from the *target*, so adding
that target to another project changed the outcome without touching yours. Fix: make the intent
explicit in scripts so a new project cannot change what an existing command means:

```json
{
  "scripts": {
    "start": "ng serve web",
    "build": "ng build web --configuration production"
  }
}
```

## Interview questions

**Where does this layer sit relative to the Architect errors, and why does that matter?**
Above them. The command layer chooses a project and a target name before Architect is involved at
all, so `Cannot determine project for command.` means nothing downstream ran — no builder was
resolved, no option schema was consulted. The corollary is more useful: seeing an Architect message
such as `Project target does not exist.` proves this layer already succeeded, which removes the cwd,
the project name and the candidate set from the investigation entirely. Reading errors by the layer
that emitted them is what turns a confusing failure into a bisection.

**A bare command that worked for months suddenly cannot determine a project, and the project you run
it against is unchanged. What happened?**
Somebody added the same target to another project. The candidate set is built by target, so a
`serve` target appearing on a second application converts a previously unambiguous command into one
that depends on the working directory — and from the repository root, into an error. Nothing in the
history of the project you care about shows it. This is the strongest practical argument for naming
projects in package scripts from the day a workspace acquires its second project, rather than
relying on a candidate set that other people's changes can widen.

**★ What does `Cannot determine project for command.` actually tell you, and what does it not?**
It tells you that the target-filtering step already ran and left **more than one** project declaring
the target, and that the working directory did not select among them — the message says exactly that
in its second sentence. It does not mean the workspace is misconfigured, and it does not mean the
CLI failed to find a project. The two fixes are in the message itself: pass the project name to the
command, or change the working directory into a project directory. The sorted list it ends with is
the set of projects that declare the target, which is often narrower than the set of projects in the
workspace and is the fastest way to see what the command could have meant.

**★ Why does `ng serve` need no project name in a monorepo with four projects?**
Because the candidate set is filtered by target before the working directory is ever consulted. The
CLI collects the projects that declare a `serve` target; if exactly one does, that one is returned
regardless of where you are standing. Nothing was guessed and no default was applied. The corollary
matters more than the fact: adding a `serve` target to a second project changes the behaviour of a
command nobody touched, and the first symptom will be an error message about determining a project.

**★ You are standing inside `projects/admin` and a command still cannot determine a project. How is
that possible?**
Because being inside a project is not the same as that project declaring the target. After
`getProjectByCwd` resolves `admin`, the code checks
`allProjectsForTargetName.includes(maybeProject)` and returns `undefined` when the resolved project
is not in the candidate set. It does not fall back to another project that does have the target —
which is the right decision, since falling back would mean running a command against a project you
were not in. The fix is to name the project that has the target, or to add the target to the project
you are in.

---

← Prev: [Multi-project workspaces](14-multi-project-workspaces.md) · Index: [Topic index](README.md) · Next → [Multi-target and `ng run`](14c-multi-target-commands-and-ng-run.md)
