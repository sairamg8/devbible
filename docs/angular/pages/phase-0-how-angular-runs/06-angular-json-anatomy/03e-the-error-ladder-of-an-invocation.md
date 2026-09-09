---
title: "Eight messages stand between typing a command and a builder starting, they fire in a fixed order, and each one proves that every earlier stage already succeeded"
sidebar_label: "03e · The error ladder"
sidebar_position: 3.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `findProjectTarget` and `resolveBuilder` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`. Documentation-validated; **no sandbox run** — every message below is transcribed
> from that source, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The most useful property of these errors is not what each one says — it is the order.** Project
lookup, then target lookup, then the builder key, then the package, then the manifest. Because they
throw rather than accumulate, the message you get proves that everything before it already worked,
which turns a confusing failure into a bisection you have already half completed. This page is the
ladder, top to bottom, and how to read a rung.

## Before the builder is resolved, the target has to be found

`findProjectTarget` runs first, with three errors of its own:

```ts
const projectDefinition = workspace.projects.get(project);
if (!projectDefinition) {
  throw new Error(`Project "${project}" does not exist.`);
}

const targetDefinition = projectDefinition.targets.get(target);
if (!targetDefinition) {
  throw new Error('Project target does not exist.');
}

if (!targetDefinition.builder) {
  throw new Error(`A builder is not set for target '${target}' in project '${project}'.`);
}
```

⚠️ **The middle message names nothing.** `Project "x" does not exist.` names the project and
`A builder is not set for target 'y' in project 'x'.` names both — but the target-not-found case
gives you a bare sentence. When you see it, the missing information is in your own command line.

## The full ladder, in order

| # | Message | Step that failed | What it proves already worked |
|---:|---|---|---|
| 1 | `Project "<name>" does not exist.` | project lookup | the workspace file loaded |
| 2 | `Project target does not exist.` | target lookup | the project exists |
| 3 | `A builder is not set for target '<t>' in project '<p>'.` | the target has no `builder` key | the target exists |
| 4 | `No builder name specified.` | the builder string had no `:` | a `builder` value is present |
| 5 | `Package "<pkg>" has no builders defined.` | the package has no `builders` field | the package resolved on disk |
| 6 | `Cannot find builder "<pkg>:<name>".` | the manifest has no such key | the package is a builder package |
| 7 | `Circular builder alias references detected: …` | an alias chain loops | the key exists and is an alias |
| 8 | `Package "<pkg>" has an invalid builders manifest path: …` | a packaging bug in the builder | everything above |

🔴 **Read the rung, not just the text.** Getting message 6 means the package name was correct and
installed — so reinstalling will not help, and the fix is the eight characters after the colon.
Getting message 5 means the opposite: the string is fine and the installation is not.

## Which of these can `angular.json` cause?

Rungs 1 to 4 are workspace-file problems: a wrong project key, a wrong target name, a missing
`builder` key, a malformed builder string. Rung 6 is half and half — the string is in the workspace
file, but so is the possibility that the package simply is not installed.

Rungs 5, 7 and 8 are **not** workspace-file problems at all. They describe a package on disk whose
`package.json` or `builders.json` is missing, looping or pointing outside itself. Editing
`angular.json` cannot fix any of them, and time spent there is time lost.

## Reading a failure the fast way

Given `Cannot find builder "@angular-devkit/build-angular:application".` in a v22 workspace, the
ladder tells you, without any further investigation:

1. the workspace file loaded — so it is not a `version` or JSON problem;
2. the project exists — so the project key is right;
3. the target exists and has a `builder` — so the shape of the target is fine;
4. the string contains a colon;
5. **the package resolved and is a builder package** — so it *is* installed;
6. and the name after the colon is not one of its keys.

For that particular string in a v22 workspace, the usual conclusion is different: the package is
*not* installed and rung 5 or the resolution step before it is what actually fired. Which of the two
you got is the whole diagnosis, and it is decided by reading the message rather than by guessing.

## Gotchas

**★ Symptom: `Project "storefront" does not exist.`** Cause: the project name in the command or in a
`buildTarget` string does not match a key in `projects`. In a shared checkout it is also worth
considering that the wrong workspace was resolved entirely
([01](01-the-file-the-cli-reads.md)). Fix: match the key exactly:

```json
{
  "projects": {
    "storefront": { "root": "", "projectType": "application" }
  }
}
```

**★ Symptom: `Project target does not exist.` and no indication of which target.** Cause: the message
is a bare string with no interpolation — a genuine asymmetry with its two neighbours. Fix: read the
third segment of your own invocation, then add the target or correct the name:

```json
{
  "targets": {
    "smoke": { "builder": "@acme/builders:smoke" }
  }
}
```

**★ Symptom: `ng serve` fails with `Project "shop" does not exist.` and you never typed `shop`.**
Cause: the name came from a `buildTarget` string inside the serve target, not from your command
line. A project rename that missed those strings produces exactly this. Fix: update the reference:

```json
{
  "targets": {
    "serve": {
      "builder": "@angular/build:dev-server",
      "configurations": {
        "development": { "buildTarget": "storefront:build:development" }
      }
    }
  }
}
```

**★ Symptom: CI reports a different message from the one you get locally for "the same" failure.**
Cause: a different rung is firing. Locally the package is installed and the name is wrong (rung 6);
in CI the install is incomplete and the package never resolves. Same symptom, different stage, and
the fixes are unrelated. Fix: compare the exact messages before comparing anything else, and pin the
builder package as a direct dependency so the install cannot be partial:

```json
{
  "devDependencies": {
    "@angular/build": "22.1.7"
  }
}
```

**Symptom: a reinstall is attempted for a `Cannot find builder` error and changes nothing.** Cause:
rung 6 proves the package resolved and its manifest loaded — the failure is a key lookup. Fix: the
name after the colon, not the installation:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**Symptom: `angular.json` is edited repeatedly to fix `Package "…" has no builders defined.`** Cause:
that rung describes a package on disk, not the workspace file — the `"builders"` key is missing from
the *package's* `package.json`. No edit to `angular.json` can affect it. Fix: repair the install:

```bash
rm -rf node_modules
npm ci
```

**Symptom: an `ng run` invocation with four colon-separated segments behaves unexpectedly.** Cause: a
target reference is `project:target[:configuration]` — three segments, with the third able to carry
a comma-separated list. There is no fourth position. Fix: put multiple configurations in the third
segment as a list, not as extra segments:

```json
{
  "scripts": {
    "build:staging-fr": "ng run storefront:build:staging,french"
  }
}
```

**Symptom: an error names a target that is not the one you invoked.** Cause: one target invoked
another — `ng serve` resolves a build target through `buildTarget`, so a failure in that second
lookup surfaces during a serve. Fix: read the *names in the message* rather than the command you
typed, and check the referenced target:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } },
    "serve": { "builder": "@angular/build:dev-server", "options": { "buildTarget": "storefront:build" } }
  }
}
```

## Interview questions

**★ What are the distinct "not found" errors, and what does each one narrow the problem to?**
`Project "<name>" does not exist.` means the project key is wrong or the wrong workspace was
resolved. `Project target does not exist.` means the project is right and the target name is wrong.
`A builder is not set for target '<t>' in project '<p>'.` means the target object exists but has no
`builder` key. `Package "<pkg>" has no builders defined.` means the package resolved but is not a
builder package — effectively a broken install. `Cannot find builder "<pkg>:<name>".` means the
package *is* a builder package and the name after the colon is not one of its keys. Each of the five
eliminates a different possibility, which is why quoting the exact message is worth more than
describing it.

**★ Why does the order of these errors matter more than the wording?**
Because they throw rather than accumulate, so each message is also an assertion about everything
before it. `Cannot find builder` proves the package is installed. `Package … has no builders defined`
proves the string is well formed. `A builder is not set for target` proves both the project and the
target exist. That turns every failure into a bisection you did not have to run: the rung you landed
on tells you which half of the problem space to ignore entirely.

**★ Which of these errors can be fixed by editing `angular.json`?**
The first four, and sometimes the sixth. A wrong project key, a wrong target name, a target with no
`builder`, and a builder string with no colon are all workspace-file defects. `Cannot find builder`
is ambiguous — either the name after the colon is wrong, which is a file fix, or the package is not
installed, which is not. The remaining three describe the contents of a package on disk: a missing
`builders` field, a looping alias chain, or a manifest pointing outside its own package. Those are
install or packaging problems, and editing the workspace file cannot touch them.

**`ng serve` fails with an error naming a project you did not type. What happened?**
The dev-server target reached a build target through its `buildTarget` option, and the reference in
that string is what failed to resolve. A target reference is `project:target[:configuration]`, so it
carries a project name — and a rename that updated the `projects` key without updating the references
leaves a serve target pointing at a project that no longer exists. The message is accurate; it is
just describing the second lookup rather than the first.

**Why is `Project target does not exist.` the weakest message of the eight?**
Because it interpolates nothing. Its two neighbours name the project, and one of them names the
target as well, so the asymmetry is conspicuous. In practice the information is recoverable — the
target you asked for is in your command line, or in the `buildTarget` string that led here — but it
is the one rung where the message does not carry its own context, and it is worth knowing that in
advance rather than re-reading the output looking for a name that was never printed.

---

← Prev: [Resolving a builder string](03d-how-a-builder-string-becomes-a-function.md) · Index: [Topic index](README.md) · Next → [A typo has no schema error](03f-a-typo-has-no-schema-error.md)
