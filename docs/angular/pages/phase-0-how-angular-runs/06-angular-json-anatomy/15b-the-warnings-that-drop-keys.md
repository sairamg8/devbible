---
title: "Some of the reader's complaints do not stop anything — they drop the key and carry on, so the failure you eventually see comes from a different file, names something else, and describes a key that is visibly present in your `angular.json`"
sidebar_label: "15b · Warnings that drop keys"
sidebar_position: 15.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the key-walk branches of
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> and `findProjectTarget` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts),
> both at tag `v22.1.7`. Each message below is classified by **what its own source line does** —
> `throw`, `context.error` followed by `break`, or `context.warn` — rather than by a severity label.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The reader's thrown errors are the easy half: the command stops and the message names the
problem.** The other half is worse precisely because it is milder. Several branches report a problem
and then continue walking the file — and continuing means the key they were reading is not in the
parsed workspace. Nothing downstream knows it was ever written. So the failure you actually see
arrives later, from a different file, phrased as *"this does not exist"* about a key you are looking
at in your editor.

## Classify by what the source line does, not by a label

Three shapes appear in the reader's key walk, and only the first stops anything:

| Shape | Effect | Example message |
|---|---|---|
| `throw new Error(...)` | the read aborts; no command runs | `Project "<name>" is missing a required property "root".` |
| `context.error(...)` then `break` | **this key is abandoned**; the walk continues | `Invalid "targets" field found; expected an object.` |
| `context.warn(...)` | reported; the walk continues | `Project property "<name>" should be a string.` |

The five thrown messages are on [15](15-when-angular-json-is-wrong.md). This page is the other two
shapes, and the rule that makes them dangerous: **a message that does not stop the read has already
changed what the workspace contains.**

## The `targets` branch abandons the whole map

Verbatim, from the case that handles both spellings of the key:

```ts
case 'targets':
case 'architect': {
  const nodes = findNodeAtLocation(projectNode, [name]);
  if (!isJsonObject(value) || !nodes) {
    context.error(`Invalid "${name}" field found; expected an object.`, value);
    break;
  }
  hasTargets = true;
  targets = parseTargetsObject(projectName, nodes, context);
  jsonMetadata.hasLegacyTargetsName = name === 'architect';
  break;
}
```

`break` on the failure path means `targets` is never assigned for that project. Not one target —
**all** of them. A `targets` value written as an array, or as a string, removes every target the
project declares, and the message you get says only that the field was expected to be an object.

The parallel message for the top-level container, `Invalid "projects" field found; expected an
object.`, has the same wording and the same consequence one level up.

## `Skipping` says the outcome in the message

Two more messages state their effect in the first word:

- `Skipping invalid project value; expected an object.` — a `projects` entry that is not an object.
- `Skipping invalid target value; expected an object.` — a `targets` entry that is not an object.

There is no ambiguity to interpret here: the reader is telling you it dropped something. What it
does not tell you is what will happen next, which is the subject of the rest of this page.

## 🔴 The indirection, end to end

This is the sequence worth memorising, because every part of it is in a different file and only the
first part mentions the key you actually mistyped.

**Step 1 — the file.** A target written as a string instead of an object. It looks plausible; it is
the sort of thing that survives review:

```json
{
  "projects": {
    "web": {
      "root": "",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "tsconfig.app.json" }
        },
        "serve": "@angular/build:dev-server"
      }
    }
  }
}
```

**Step 2 — the reader.** `Skipping invalid target value; expected an object.` The walk continues, the
file loads, and every other command in the workspace works normally. In a CI log this line is
somewhere near the top, before the output anyone reads.

**Step 3 — the parsed workspace.** `web` has one target, `build`. There is no record that `serve` was
ever written.

**Step 4 — the failure, from a different file.** `findProjectTarget` in
`node-modules-architect-host.ts`:

```ts
const targetDefinition = projectDefinition.targets.get(target);
if (!targetDefinition) {
  throw new Error('Project target does not exist.');
}
```

`Project target does not exist.` — which is true, and does not name the target, and is emitted by
Architect rather than by the reader. Or, if the command was `ng serve` rather than `ng run`, the
failure comes from the command layer instead as `Cannot determine project or target for command.`,
because no project declares a `serve` target.

| What was dropped | Message at read time | Message you actually notice |
|---|---|---|
| one target (non-object value) | `Skipping invalid target value; expected an object.` | `Project target does not exist.` |
| every target (`targets` not an object) | `Invalid "targets" field found; expected an object.` | `Project target does not exist.` for whichever one you ran |
| one project (non-object value) | `Skipping invalid project value; expected an object.` | `Project "<name>" does not exist.` |
| every project (`projects` not an object) | `Invalid "projects" field found; expected an object.` | `Cannot determine project for command.` or a missing-project error |

The right-hand column is what lands in your terminal. The left-hand column is the only place the
actual mistake is named — and it scrolled past.

Not every non-fatal message from the reader means data loss — telling a deletion from a complaint is
[15c](15c-complaints-that-are-not-deletions.md).

## Why this is worse than an error would be

Three properties combine badly.

1. **The message is at the top and the failure is at the bottom.** They are separated by however much
   output the command produced in between.
2. **The failure names a different thing.** *"Project target does not exist"* sends you to look at the
   target you can see in the file, which is exactly the wrong place.
3. **Everything else keeps working.** A dropped `serve` target does not affect `ng build`, so the
   file passes every check you would run to convince yourself it is fine.

The habit that defeats all three: when a message says something does not exist and you can see it in
the file, **scroll up** before doing anything else.

## Gotchas

**★ Symptom: `Project target does not exist.` for a target that is plainly in `angular.json`.**
Cause: the reader skipped it because its value was not an object, and said so in a warning at the
top of the output. Fix: give the target an object with at least a `builder`:

```json
{
  "targets": {
    "serve": {
      "builder": "@angular/build:dev-server",
      "configurations": {
        "development": { "buildTarget": "web:build:development" }
      },
      "defaultConfiguration": "development"
    }
  }
}
```

**★ Symptom: every target in one project disappeared at once.** Cause: the `targets` (or `architect`)
value itself was not an object — an array, a string, `null` — so the branch reported and `break`ed
before parsing any of them. Fix: the key holds a map of target names to target objects:

```json
{
  "projects": {
    "web": {
      "root": "",
      "projectType": "application",
      "targets": {
        "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } },
        "serve": { "builder": "@angular/build:dev-server" }
      }
    }
  }
}
```

**★ Symptom: a project vanished — `Project "admin" does not exist.` — and the key is right there.**
Cause: `Skipping invalid project value; expected an object.`, because the entry was a string or an
array. Fix: a project entry is an object with at least `root`:

```json
{
  "projects": {
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: the failure is reproducible locally with a visible warning, and in CI there is no
warning at all.** Cause: the warning goes out early and CI log settings, quiet flags or log
collectors routinely discard or fold it. Fix: reproduce locally with full output before assuming the
two environments differ, and treat "no warning in CI" as "not captured", not as "not emitted".

**Symptom: one malformed project stops or degrades commands for every other project.** Cause: the
reader walks the whole file for every command; it has no way to scope itself to the project you
named. Fix: fix the broken entry — there is no "ignore this project" switch:

```json
{
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: you fixed the target's value and the error persists unchanged.** Cause: two entries were
skipped and only one was repaired — each skipped key produces its own warning, and the downstream
error names only the one the command happened to need. Fix: read every warning at the top of the
output, not the first:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } },
    "serve": { "builder": "@angular/build:dev-server" },
    "test":  { "builder": "@angular/build:unit-test", "options": {} }
  }
}
```

## Interview questions

**★ Why is a reader warning more dangerous than a reader error?**
Because an error stops the command and names the problem, while a warning changes what the workspace
contains and lets everything continue. The key that was reported is not in the parsed workspace, so
nothing downstream knows it was written — and the eventual failure is emitted by a different file,
about a different thing, phrased as *"does not exist"* about a key you can see in your editor. Add
that the warning is at the top of the output and the failure is at the bottom, and you have three
independent reasons the two are never connected by the person debugging.

**★ Trace what happens when a target is written as a string rather than an object.**
The reader hits the non-object value and emits `Skipping invalid target value; expected an object.`,
then continues; the parsed project simply has one fewer target. The file loads, every other command
works, and nothing else refers to the missing target. Later, `ng run web:serve` reaches
`findProjectTarget` in Architect, which does `projectDefinition.targets.get(target)`, finds nothing,
and throws `Project target does not exist.` — a message that does not name the target and comes from
a package the developer was not thinking about. If the command was `ng serve` instead, the failure
happens one layer earlier as `Cannot determine project or target for command.`, because no project
declares that target any more.

**★ How do you tell which of the reader's messages actually drop data?**
By what the source line does, not by whether the word "warning" appears. A `throw` stops everything.
A `context.error(...)` followed by `break` abandons the key it was reading — that is the
`targets`/`architect` case, and it costs you every target in the project. A message beginning
`Skipping` states the loss in its own wording. And a bare `context.warn` about a property's *type* or
an extension's *name* is a complaint rather than a deletion. Classifying by call site is the only way
to be right about this, because the CLI does not attach severity labels to these messages.

**What does the word "Skipping" in a reader message tell you, and what does it not?**
It tells you the entry was dropped from the parsed workspace — that part is unambiguous. It does not
tell you what will fail as a result, and that is the whole difficulty: the consequence appears later,
in another layer, as a "does not exist" error about the thing that was skipped. Reading `Skipping
invalid target value` correctly means immediately predicting `Project target does not exist.` or
`Cannot determine project or target for command.` further down, rather than treating it as noise.

**What single habit removes most of this class of bug?**
Scrolling up. When a message says something does not exist and you can see it in the file, the
explanation is almost always a reader diagnostic at the top of the same output, describing the real
mistake in the real vocabulary. The instinct is to re-read the key that the error named, which is
precisely the key that is fine. Making "read the first ten lines of output before the last ten" a
habit turns a confusing indirection into a two-line diagnosis.

{/* FOOTER */}
