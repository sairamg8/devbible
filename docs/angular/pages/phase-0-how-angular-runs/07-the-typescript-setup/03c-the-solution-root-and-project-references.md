---
title: "The root `tsconfig.json` compiles nothing — `\"files\": []` with no `include` makes it a solution-style config whose `references` array is written by a *different* schematic than the one that wrote the file, conditionally, and by appending"
sidebar_label: "03c · The solution root and references"
sidebar_position: 3.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7` —
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
> (`addTsProjectReference` and its call sites) and
> [`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template) —
> and the TypeScript handbook,
> [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html),
> for the meaning of the solution-style pattern and the `composite` requirement.
> 🔴 **Not verified: whether `@angular/build` performs a referenced build.** Stated as uncertain below.
> Documentation-validated; **no sandbox run** — no workspace was generated and no compiler was run.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The root `tsconfig.json` ends with `"files": []` and declares no `include`, which means that on its own it compiles nothing at all — it is a solution-style, project-references root whose job is to hold shared options and to point at the projects that do have inputs. The pointing is the interesting part: the template in [03](03-the-three-tsconfig-files.md) has no `references` key, because the *workspace* schematic writes the file and the *application* schematic mutates it afterwards. So the file you read in the CLI repository is not the file you get on disk, the number of entries in `references` depends on flags you passed to `ng new`, and a workspace generated with `--create-application=false` has no `references` key whatsoever. All three of those surprise people, and the last one is why "just copy a working tsconfig" is such unreliable advice. And one thing surprises people who know TypeScript's project-references feature well: the generated leaves do not set `composite`, which the handbook states referenced projects must have — so this is the solution-style *shape* deployed for discovery, not a build-mode setup you should try to drive.**

## `"files": []` with no `include` — a config that compiles nothing

TypeScript decides a program's inputs from `files`, `include` and `exclude`. The generated root supplies an **empty** `files` and no `include`, so the set of root file names is empty by construction. That shape has a name and a documented purpose. From the TypeScript handbook's Project References page, verbatim:

> *"Another good practice is to have a 'solution' `tsconfig.json` file that simply has `references` to all of your leaf-node projects and sets `files` to an empty array (otherwise the solution file will cause double compilation of files). Note that starting with 3.0, it is no longer an error to have an empty `files` array if you have at least one `reference` in a `tsconfig.json` file."*

Two things in that sentence are worth extracting. **The empty array is not decorative — it prevents double compilation.** Without it, the root's own glob would sweep up the same sources the leaves already compile, and every file would be built twice under different options. And the empty array is only *legal* alongside at least one `reference`, which explains a shape that otherwise looks broken: the `--create-application=false` workspace has an empty `files` and no `references` at all, and is a config that is neither compiling anything nor pointing at anything.

The consequence to hold on to: **the root is not a config you build.** Pointing `tsc` at it produces no compilation and a complaint that the configuration has no inputs — which reads like a broken file and is a correctly configured one. Everything real happens in the leaves, and the leaves reach the root only through their own `extends` ([03b](03b-the-app-and-spec-configs.md)).

## The references are written afterwards, by a different schematic

From `packages/schematics/angular/application/index.ts` at `v22.1.7`, the helper in full:

```ts
function addTsProjectReference(...paths: string[]) {
  return (host: Tree) => {
    if (!host.exists('tsconfig.json')) {
      return host;
    }

    const newReferences = paths.map((path) => ({ path }));

    const file = new JSONFile(host, 'tsconfig.json');
    const jsonPath = ['references'];
    const value = file.get(jsonPath);
    file.modify(jsonPath, Array.isArray(value) ? [...value, ...newReferences] : newReferences);
  };
}
```

and its two call sites — the first three entries of the schematic's rule `chain`, which continues past what is shown here:

```ts
    return chain([
      addAppToWorkspaceFile(options, appDir),
      addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.app.json')),
      options.skipTests || options.minimal
        ? noop()
        : addTsProjectReference('./' + join(normalize(appDir), 'tsconfig.spec.json')),
```

Twenty lines of code, and four things nobody writes down fall out of them.

**1 · Two schematics write one file.** The *workspace* schematic renders `tsconfig.json` from the template; the *application* schematic then reads it back and inserts `references`. So the template is not the final artefact, and — because the helper opens with `if (!host.exists('tsconfig.json')) { return host; }` — the application schematic is written to tolerate the file being absent. The visible consequence: **`ng new --create-application=false` leaves a root config with `"files": []` and no `references` key at all**, because the schematic that adds them never ran.

**2 · The spec reference is conditional.** `options.skipTests || options.minimal ? noop() : addTsProjectReference(...)` means `ng new --minimal` or `--skip-tests` produces a root with exactly **one** reference. There is a matching condition in the file pipeline — under `--minimal` the `tsconfig.spec.json.template` is filtered out of the generated files entirely — so the spec config is neither generated nor referenced. **Two conditions, in two places, kept in step by hand**, which is the sort of arrangement that explains a lot of "my workspace does not look like the tutorial".

**3 · The paths are built, not literal.** `'./' + join(normalize(appDir), 'tsconfig.app.json')` yields `./tsconfig.app.json` for a root application and `./projects/my-app/tsconfig.app.json` for one under `projects/`. The `./` prefix is added explicitly rather than left to the reader's convention — worth matching if you ever add an entry by hand.

**4 · It appends; it never replaces.** `Array.isArray(value) ? [...value, ...newReferences] : newReferences` reads the existing array and spreads it. So `ng generate application` in an existing workspace **adds** to the list, and that is how a multi-project workspace's root config accumulates two entries per project. If a reference is missing from a real project, it was removed by hand — the schematic cannot lose one.

A two-application workspace therefore ends up like this:

```json
{
  "files": [],
  "references": [
    { "path": "./projects/admin/tsconfig.app.json" },
    { "path": "./projects/admin/tsconfig.spec.json" },
    { "path": "./projects/portal/tsconfig.app.json" },
    { "path": "./projects/portal/tsconfig.spec.json" }
  ]
}
```

## 🔴 The generated leaves are not `composite`, and that is the most interesting thing here

TypeScript's own requirement for a referenced project is unambiguous. From the same handbook page, verbatim:

> *"Referenced projects must have the new `composite` setting enabled. This setting is needed to ensure TypeScript can quickly determine where to find the outputs of the referenced project."*

and the handbook lists what enabling it changes:

> *"The `rootDir` setting, if not explicitly set, defaults to the directory containing the `tsconfig` file"*

> *"All implementation files must be matched by an `include` pattern or listed in the `files` array. If this constraint is violated, `tsc` will inform you which files weren't specified"*

> *"`declaration` must be turned on"*

**Neither generated leaf sets `composite`, and neither does the root.** Both templates are quoted in full in [03b](03b-the-app-and-spec-configs.md) — `tsconfig.app.json` sets `types`, `include` and `exclude`, `tsconfig.spec.json` sets `types` and `include`, and that is the whole of both files. So the workspace uses the *shape* of the solution-style pattern without meeting the condition that makes the referenced half of it function.

⚠️ **What follows from that, stated conservatively:** `tsc -b` over this workspace should not be assumed to work as generated, because build mode's contract is *"Find all referenced projects · Detect if they are up-to-date · Build out-of-date projects in the correct order"* and that machinery is defined over `composite` projects. **No `tsc -b` run was performed here**, so this page does not claim what it prints — only that the documented precondition is not met by the generated files.

It also makes the omission look deliberate rather than forgotten. `composite` forces `declaration` on and changes the default `rootDir`; an application build wants neither. Angular appears to be using the solution root for what a solution root is *cheap* at — being a single file that names every project in the workspace — without opting into the emit contract that a referenced build requires.

## ⚠️ What consumes the references, then

🔴 **It does not follow that `ng build` performs a referenced build, and this page does not claim that it does.** The evidence points the other way: the builder is handed a leaf config path directly, `tsConfig: "<projectRoot>tsconfig.app.json"` in `angular.json` ([03b](03b-the-app-and-spec-configs.md)), so nothing about a build requires the root to know the leaf exists. **Whether `@angular/build` reads `references` at all was not verified.** What the builder actually does with the config it is given belongs to [05 · The build: `@angular/build`](../05-the-build-angular-build/README.md).

That leaves editors as the consumer the array demonstrably serves: a tool handed the workspace root needs some way to discover which configuration governs a given file, and `references` is that list. **Whether a particular editor requires `composite` to follow the entries was not checked either** — so the honest summary is that the array is a manifest of the workspace's projects, reliably useful for discovery and not established as a working `tsc -b` setup.

The practical form of all that uncertainty is one rule of thumb: **a missing reference is an editor problem, not a build problem.** That matches the failure everybody actually reports — a project that builds and tests cleanly from the command line while the editor underlines half of a spec file.

## Gotchas

**★ Symptom: `Cannot find name 'describe'` underlined in a spec file in the editor, while `ng test` passes and `ng build` passes.** Cause: the editor resolved that file through a configuration that excludes it — `tsconfig.app.json` excludes `*.spec.ts` and sets `types: []` — instead of through `tsconfig.spec.json`. The usual reason there is nothing pointing it at the spec config is that the spec reference is conditional and this workspace was generated with `--minimal` or `--skip-tests`. Fix — make sure both projects are listed:

```json
"references": [
  { "path": "./tsconfig.app.json" },
  { "path": "./tsconfig.spec.json" }
]
```

**★ Symptom: running `tsc` in the workspace root compiles nothing and reports that the configuration has no inputs.** Cause: `"files": []` with no `include`, by design — the root is a solution config, and the empty array is there so the root does not double-compile what the leaves already build. Fix: point `tsc` at a leaf, which is the config that has inputs:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

⚠️ `tsc -b` is the other obvious thing to try and it is **not** a safe substitute here — see the next gotcha.

**★ Symptom: `tsc -b` at the workspace root does not behave like a referenced build.** Cause: the handbook is explicit that *"Referenced projects must have the new `composite` setting enabled"*, and neither generated leaf sets `composite` — `tsconfig.app.json` sets only `types`, `include` and `exclude`. The workspace has the solution *shape* without the precondition. Fix: do not reach for build mode on a generated Angular workspace. Use the leaf directly for a type-check, and the CLI for a build:

```bash
npx tsc -p tsconfig.app.json --noEmit
ng build
```

Turning `composite` on to "fix" this is a larger change than it looks — the handbook notes it forces `declaration` on and changes the default `rootDir`, neither of which an application build wants.

**★ Symptom: a `--minimal` workspace has no `tsconfig.spec.json`, and adding one by hand does not fix the editor.** Cause: two coordinated conditions, not one — the template is filtered out of the generated files *and* the reference is skipped. Creating the file addresses half of it. Fix: create the file **and** add the reference:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.d.ts", "src/**/*.spec.ts"]
}
```

then append `{ "path": "./tsconfig.spec.json" }` to the root's `references` array.

**★ Symptom: `ng new --create-application=false` produced a root `tsconfig.json` with no `references` key, and you are unsure whether the workspace is broken.** Cause: the key is added by the *application* schematic, which never ran. Fix: nothing — generating a project adds it. The helper handles both shapes, creating the array when it is absent and appending when it is present, so the first `ng generate application` writes a well-formed `references`.

**★ Symptom: you generated a second application and expected it to overwrite the first's entry, or you are trying to work out which project "owns" the root config.** Cause: neither — `addTsProjectReference` appends, so every project contributes its own entries and none of them owns the file. Fix: if an entry is missing from a project that exists, it was hand-deleted; re-add it in the generated form, with the explicit `./` prefix:

```json
"references": [
  { "path": "./projects/portal/tsconfig.app.json" },
  { "path": "./projects/portal/tsconfig.spec.json" }
]
```

**Symptom: you moved a project's folder by hand and the reference still points at the old path.** Cause: the path was computed once, at generation time, from the application's directory — nothing recomputes it. Fix: edit the entry to match the new location, keeping the `./` prefix and the file name (not just the directory) as the schematic writes it.

**Symptom: a reference points at a `tsconfig` that no longer exists because the project was deleted.** Cause: deleting a project's folder does not touch the root's array — no schematic removes entries. Fix: delete the stale entries by hand; they are the only record that the project was ever there.

**Symptom: someone concluded that `ng build` must be doing an incremental referenced build because the root lists `references`.** Cause: an inference from a TypeScript convention rather than from Angular's behaviour — and the build target names its leaf config directly, which is the opposite of how a referenced build is driven. Fix: do not design around it. **Whether `@angular/build` consults `references` was not established**, so treat the array as editor and `tsc -b` wiring until someone verifies otherwise.

**Symptom: a hand-written entry uses a directory path where the generated ones use a file path.** Cause: hand editing to a different convention. Fix: match the generated form — `"./projects/portal/tsconfig.app.json"` — because it is the shape every other tool in this workspace was generated against, and consistency here costs nothing.

**Symptom: you added `"composite": true` to the root `tsconfig.json` to make build mode work, and now leaf builds complain about files that are not in an `include` pattern.** Cause: `composite` is inherited through `extends`, and the handbook lists exactly this consequence — *"All implementation files must be matched by an `include` pattern or listed in the `files` array. If this constraint is violated, `tsc` will inform you which files weren't specified."* It also forces `declaration` on. Fix: take it back out of the root; if you genuinely need a composite project, set it on the specific leaf and accept the emit changes there:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

**Symptom: a workspace generated with `--create-application=false` has an empty `files` array and no `references` key, and a linter or an editor treats it as malformed.** Cause: the handbook's allowance is conditional — *"it is no longer an error to have an empty `files` array if you have at least one `reference`"* — and this workspace has neither inputs nor references until a project is generated. Fix: generate the project; the application schematic creates the array on its first run. Nothing needs hand-editing in the meantime.

## Interview questions

**★ What is `"files": []` doing in an Angular workspace's root `tsconfig.json`?**
Marking it as a solution-style, project-references root. `files`, `include` and `exclude` decide a program's inputs; an empty `files` with no `include` means the set is empty, so the config compiles nothing on its own. TypeScript's handbook recommends exactly this shape and gives the reason in one parenthesis — *"sets `files` to an empty array (otherwise the solution file will cause double compilation of files)"*. So the empty array is load-bearing: without it the root's glob would recompile every source the leaves already own, under a different set of options. Its two real jobs are to supply shared options to the leaves through their `extends`, and to enumerate the projects under `references`. The tell that someone has not understood this is treating a "no inputs" complaint from `tsc` at the root as a broken configuration — it is the configuration working.

**★ Angular generates the solution-style shape. Is it a working project-references setup?**
Not as generated, and this is a good question to be precise about. The handbook's requirement is flat — *"Referenced projects must have the new `composite` setting enabled"* — and neither `tsconfig.app.json` nor `tsconfig.spec.json` sets `composite`; both templates set `types`, globs, and nothing else. So the workspace has the solution root's shape without the precondition that makes build mode work over it. The omission reads as deliberate rather than accidental, because `composite` forces `declaration` on and changes the default `rootDir`, and an application build wants neither. The honest position is that the array is a reliable manifest of the workspace's projects, useful to anything doing discovery, and not something to design a `tsc -b` pipeline around — and that no `tsc -b` run was performed to establish exactly how it fails.

**★ Why is the root `tsconfig.json` written by one schematic and modified by another?**
Because the workspace and the applications inside it are separate concerns with separate schematics. The workspace schematic renders the root from a template that has no `references` key at all; the application schematic then reads the file back and appends one entry for the app and, conditionally, one for the specs. The consequences are all visible in generated projects: a workspace created with `--create-application=false` has no `references` key, a `--minimal` workspace has one entry instead of two, and every additional `ng generate application` appends rather than replaces. It also means the template you read in the CLI repository is not the file you get, which is a good general caution about reading generators for answers about output.

**★ You ran `ng new --minimal`. What is different about the tsconfigs?**
`tsconfig.spec.json` is not generated — the template is filtered out of the file pipeline — and the root's `references` array has one entry instead of two, because the second `addTsProjectReference` call is guarded by `options.skipTests || options.minimal`. Both halves of that are worth naming, because a developer who later adds tests to a `--minimal` workspace has to create the config *and* register it; doing only the first leaves the editor resolving spec files through the application config, which excludes them.

**★ Does `ng build` perform a referenced build over that `references` array?**
This is not established, and the honest answer says so. The evidence available points away from it: the build target names its own leaf configuration explicitly in `angular.json`, so the build never needs to discover projects from the root, and whether `@angular/build` reads `references` at all was not verified. Project references in general exist for `tsc -b` and for editors, and the safe working assumption is that they serve those consumers here too. The reason this matters practically is that it decides where to look when something breaks — a missing reference explains an editor that reports errors nothing else reports, and does not explain a failing build.

**Your editor reports errors in spec files that `ng test` does not. Where do you look first?**
At the root's `references` array, and then at whether the spec config exists at all. The editor has to pick a configuration for each file; if nothing points it at `tsconfig.spec.json`, the nearest plausible config is the application one, which excludes spec files and sets `types: []` — so the test framework's globals are unresolved and the whole file lights up. `ng test` is unaffected because its target names the spec config directly. The general shape of the diagnosis is worth stating: a discrepancy between the editor and the command line is almost always a question of *which config each one chose*, not of what any config contains.

**Why can adding a second application never clobber the first application's references?**
Because the helper reads the existing value first and spreads it — `Array.isArray(value) ? [...value, ...newReferences] : newReferences` — so it appends when there is an array and creates one when there is not. This is worth knowing as a diagnostic fact rather than as trivia: it means a missing reference in a real workspace was always a human edit, so the question to ask is "who removed this and why" rather than "did the CLI fail to write it".

---

← Prev: [The app and spec configs](03b-the-app-and-spec-configs.md) · Index: [Topic index](README.md) · Next → [angularCompilerOptions inheritance](04-angularcompileroptions-and-how-it-inherits.md)
