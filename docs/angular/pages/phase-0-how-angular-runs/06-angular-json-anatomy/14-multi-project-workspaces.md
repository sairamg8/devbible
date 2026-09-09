---
title: "`defaultProject` was removed and nothing replaced it as a key — what replaced it is an algorithm that resolves a project from your current working directory, deterministically, by longest matching root"
sidebar_label: "14 · Multi-project workspaces"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `getProjectByCwd` and `findProjectByPath` in
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts)
> and the top-level `properties` block of
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the source excerpts are
> transcribed from the CLI repository, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

🔴 **`defaultProject` does not exist.** It appears nowhere in the workspace schema at 22.1.7, the top
level is `additionalProperties: false`, and any tutorial, blog post or Stack Overflow answer that
tells you to set it is describing Angular 13 or earlier. **What replaced it is not another key — it
is an algorithm.** The CLI resolves a project from `process.cwd()`, by the longest project `root`
that contains the current directory, with declaration order as the tie-break and an explicit refusal
to guess when two projects share a root. People describe this as "the CLI guesses"; it does not. It
is fully deterministic, and this page is the determination.

## What was removed, in one paragraph

The complete top level of `angular.json` is `$schema`, `version`, `cli`, `schematics`,
`newProjectRoot` and `projects`, with `additionalProperties: false` and only `version` required —
the full inventory is [01d](01d-version-and-the-six-top-level-keys.md). `defaultProject` is not on
that list and does not appear anywhere else in the schema, so it is a violation rather than a legacy
key that is politely ignored. Finding it in a file tells you the file predates Angular 14, which is
in turn a strong signal that the builder strings and target names in it are worth auditing at the
same time.

## The resolver, verbatim

```ts
export function getProjectByCwd(workspace: AngularWorkspace): string | null {
  if (workspace.projects.size === 1) {
    // If there is only one project, return that one.
    return Array.from(workspace.projects.keys())[0];
  }

  const project = findProjectByPath(workspace, process.cwd());
  if (project) {
    return project;
  }

  return null;
}
```

and the path matching it delegates to, with the source's own comments kept because they state the
rule better than a paraphrase would:

```ts
const projects = Array.from(workspace.projects)
  .map(([name, project]) => [project.root, name] as [string, string])
  .filter((tuple) => isInside(tuple[0], location))
  // Sort tuples by depth, with the deeper ones first. Since the first member is a path and
  // we filtered all invalid paths, the longest will be the deepest (and in case of equality
  // the sort is stable and the first declared project will win).
  .sort((a, b) => b[0].length - a[0].length);

if (projects.length === 0) {
  return null;
} else if (projects.length > 1) {
  const found = new Set<string>();
  const sameRoots = projects.filter((v) => { … });
  if (sameRoots.length > 0) {
    // Ambiguous location - cannot determine a project
    return null;
  }
}

return projects[0][1];
```

*(The predicate body inside `sameRoots.filter` is elided above — it is the duplicate-detection step,
and what matters for this page is the branch it guards, which returns `null`.)*

## Four rules, all provable from those two functions

1. **One project in the workspace → it always wins.** The size check short-circuits before the path
   logic runs, so the cwd is irrelevant in a single-project workspace. You can be anywhere on the
   filesystem.
2. **Otherwise, every project whose `root` contains the cwd is a candidate.** `isInside` is a
   containment test, not an equality test — being *anywhere below* a project's root qualifies.
3. **The deepest root wins, and ties break on declaration order.** The sort is by path length
   descending, and the comment states the tie-break explicitly: the sort is stable, so the first
   declared project wins among equal-length roots.
4. **Two projects with an identical `root` → ambiguous → `null`.** The resolver refuses rather than
   picking one, and the comment says so: *"Ambiguous location - cannot determine a project"*.

## The one input that makes all four rules bite

Rule 2 is a containment test, and the initial application created by `ng new` has `root: ""` — an
empty root that contains **every** path in the workspace. That single value is what turns a clean
algorithm into the behaviour people find surprising, and designing a workspace so that it does not
bite is [14d](14d-designing-for-unambiguous-resolution.md).

## What reads this answer

`getProjectByCwd` is not a build-time function. It is consulted wherever the CLI needs to know which
project a command or a setting belongs to when nothing named one — including which `cli` block
applies, which is [13f](13f-two-levels-of-cli.md) and [13g](13g-the-project-level-cli-block.md), and
which project a target command runs against, which is
[14b](14b-what-the-commands-do-with-it.md). The consequence worth carrying: *the same command, in
the same repository, can mean different things from different directories* — and nothing in the
output says which directory it resolved from.

## Gotchas

**★ Symptom: someone adds `"defaultProject": "admin"` from a tutorial and the key does nothing, or is
flagged.** Cause: it was removed and does not appear anywhere in the 22.1.7 schema; the top level is
closed at six keys. Fix: delete it, and select the project the way the current CLI does — by naming
it, or by the working directory:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": {
    "my-app": { "root": "",               "projectType": "application" },
    "admin":  { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: two projects have the same `root` and the CLI resolves neither.** Cause: the
duplicate-root branch returns `null` deliberately — the comment in the source is *"Ambiguous
location - cannot determine a project"*. Fix: give them distinct roots; a shared root is not a
supported layout:

```json
{
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: a command that always worked in a single-project workspace becomes directory-sensitive
right after `ng generate application`.** Cause: the size-one short circuit stops applying the moment
a second project exists, and resolution switches from unconditional to path-based. Nothing in the
generated diff says so. Fix: convert scripts to name their project at the same time as adding the
second one:

```json
{
  "scripts": {
    "start": "ng serve my-app",
    "build": "ng build my-app --configuration production",
    "test":  "ng test my-app"
  }
}
```

**Symptom: you are in a subdirectory well below a project's root — `projects/admin/src/app/users` —
and expect resolution to fail.** Cause: it does not; `isInside` is a containment test, so anywhere
below the root qualifies. Fix: nothing to repair — this is why running commands from inside a
project directory is a reliable way to select it:

```bash
cd projects/admin && ng build
```

**Symptom: you renamed a project's directory on disk and commands started resolving to the wrong
project.** Cause: resolution matches the cwd against the `root` values in `angular.json`, not against
what is on disk; a directory whose `root` no longer matches simply stops being a candidate, and the
empty-rooted initial app catches everything. Fix: update `root` — and every path derived from it —
when you move a project:

```json
{
  "projects": {
    "admin": {
      "root": "apps/admin",
      "sourceRoot": "apps/admin/src",
      "projectType": "application"
    }
  }
}
```

**Symptom: a library nested inside an application's directory resolves instead of the application.**
Cause: both roots contain the cwd, and the sort takes the longest — the deeper root is the more
specific one and it wins by design. Fix: nothing to repair, this is the rule working; but know that
standing anywhere below the nested project selects it, and name the outer project when you mean it:

```json
{
  "projects": {
    "web": { "root": "projects/web",           "projectType": "application" },
    "ui":  { "root": "projects/web/libs/ui",   "projectType": "library" }
  }
}
```

**Symptom: you expect the "first declared project wins" tie-break to matter and cannot construct a
case where it fires.** Cause: it only applies when two *different* roots of equal length both contain
the same directory, which is close to unconstructable with normalised paths — identical roots take
the ambiguity branch and return `null` instead. Fix: treat the tie-break as defensive code rather
than a rule to design around; the case you will actually meet is the identical-root ambiguity:

```json
{
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: a project you added by hand is never resolved from its own directory.** Cause: `root` is
missing or does not match the directory you are standing in — and `root` is the one property the
workspace reader refuses to infer. Fix: set it to the directory the project actually occupies,
relative to the workspace:

```json
{
  "projects": {
    "reports": { "root": "projects/reports", "projectType": "library" }
  }
}
```

**Symptom: two projects share a parent directory and you assume that is the ambiguity problem.**
Cause: siblings under one parent are fine — resolution only has more than one candidate when one
project's root *contains* another's, or when two roots are identical. Fix: nothing to change;
siblings are the normal shape:

```json
{
  "projects": {
    "web":   { "root": "apps/web",   "projectType": "application" },
    "admin": { "root": "apps/admin", "projectType": "application" }
  }
}
```

## Interview questions

**★ Angular removed `defaultProject`. What replaced it?**
Nothing, as a key — and that is the point. The top level of `angular.json` has six properties and is
`additionalProperties: false`, so `defaultProject` is now a violation rather than a legacy key. What
replaced its *function* is `getProjectByCwd`: if the workspace has exactly one project, that project
is returned unconditionally; otherwise the CLI collects every project whose `root` contains the
current working directory, sorts them by root length descending, and takes the first — with
declaration order breaking ties and an explicit `null` when two projects share a root. The
substitution is a behaviour rather than a setting, which is why so much older advice about this is
not merely outdated but unimplementable.

**★ Two projects in one workspace have the same `root`. What does the CLI do?**
It refuses. The resolver detects that more than one candidate shares a root and returns `null`
rather than choosing, and the source comment states the intent directly: *"Ambiguous location -
cannot determine a project"*. That refusal then surfaces at the command layer as an error naming the
projects that could have been meant. The design choice is worth noticing — the CLI would rather stop
than silently build the wrong thing, which is the opposite of what a "default project" key would
have done.

**★ In a single-project workspace, does the working directory matter at all?**
No. `getProjectByCwd` short-circuits on `workspace.projects.size === 1` and returns the only project
before any path logic runs, so you can invoke the CLI from anywhere. The reason to know this is that
it is a cliff edge rather than a rule: the moment a second project is generated, every command and
every project-level setting becomes directory-sensitive, and nothing in the generated diff announces
the change. A workspace that is about to gain a second project is a workspace whose scripts should
start naming projects first.

**How do the tie-break rules work when several projects contain the current directory?**
Candidates are sorted by root length, descending, so the deepest root wins — and because the roots
all contain the same path, the longest of them is necessarily the most specific. When two roots are
the same length, the sort is stable, so the project declared first in the `projects` object wins.
Relying on that second rule is unwise: JSON object key order is not something you want load-bearing
behaviour resting on, and the situation only arises with sibling projects at equal depth, where
naming the project explicitly costs nothing.

**Why is "the CLI guesses which project you meant" a wrong description of this behaviour?**
Because every step is deterministic and inspectable. There is a size check, a containment filter, a
length sort, a stable tie-break and an explicit ambiguity refusal — no heuristics, no scoring, no
most-recently-used state. What makes it *feel* like guessing is that the input is invisible: the
working directory is not on the command line and is not echoed in the output, so two people running
the same command in the same repository can legitimately see different results. Naming the input —
either by naming the project or by controlling the directory — removes the feeling entirely.

{/* FOOTER */}
