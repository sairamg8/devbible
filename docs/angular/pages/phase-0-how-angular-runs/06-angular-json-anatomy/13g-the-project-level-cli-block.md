---
title: "The project-level `cli` block is declared by a schema fragment that is missing its own wrapper, holds far less than the workspace-level one, and is selected by the directory you happen to be standing in"
sidebar_label: "13g · The project-level block"
sidebar_position: 13.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `project` definition of
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and `getConfiguredPackageManager` / `getProjectByCwd` in
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts),
> both at tag `v22.1.7`. 🔴 One claim on this page is explicitly **not** settled by the sources and
> is marked as such. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A `cli` block inside a project object is a different thing from the one at the top level: it is
typed by a different — and visibly incomplete — schema fragment, it holds a much smaller set of
settings, and it only applies when the CLI resolves to that project.** The precedence rule is
[13f](13f-two-levels-of-cli.md); this page is what the block may contain and when it is the one
being read, which is the part that turns a precedence rule into a debugging procedure.

## The declaration, verbatim, and why it needs a warning label

The workspace-level `cli` is typed by `cliOptions`, whose five properties are enumerated on
[13](13-the-cli-block-and-workspace-defaults.md). The project-level `cli` is declared inline inside
the `project` definition, and this is the whole of it:

```json
"cli": {
  "schematicCollections": {
    "type": "array",
    "description": "The list of schematic collections to use.",
    "items": { "type": "string", "uniqueItems": true }
  }
}
```

⚠️ **Read that before drawing conclusions from it.** There is no `"type": "object"` and no
`"properties"` wrapper, so `schematicCollections` sits where JSON Schema expects a *keyword* rather
than a property name. As written, the fragment does not constrain a project-level `cli` block the
way `cliOptions` constrains the workspace-level one.

🔴 **What this fragment actually validates could not be determined from the sources read for this
page**, and no source states the intended shape. That is a real gap, and the useful response is to
stop trying to reason from the schema here and reason from the code instead.

## What is settled, and it comes from the code

Two things are settled by `config.ts` and by the schema between them:

- **`packageManager` works at the project level**, because `getConfiguredPackageManager` explicitly
  reads `workspace.projects.get(project)?.extensions['cli']` and extracts it from there. That is
  behaviour, not inference.
- **`schematicCollections` is the only key the schema names at this level**, which is at least a
  statement of intent even in a fragment that does not enforce it.

Everything else at the project level is unsupported rather than merely undocumented. In particular
`cache` is a workspace concern: its `path` is workspace-relative, what it caches is the workspace's
build output, and nothing at the project level is declared to hold it.

Which gives a short, defensible placement rule:

| Setting | Level | Why |
|---|---|---|
| `schematicCollections` | project **or** workspace | the one key the project fragment names; genuinely differs per project |
| `packageManager` | workspace, normally | one installer per repository; the project level works but has no use case that beats putting it once at the top |
| `cache` | workspace only | workspace-relative path, workspace-wide build state — [13e](13e-the-cache-key.md) |
| `analytics` | workspace | a decision about the repository, not about one project inside it |
| `warnings` | workspace | about the CLI installation, not about a project |

## 🔴 Which project's block applies is a question about your shell

The project-level block is selected by `getProjectByCwd`, which resolves a project from
`process.cwd()`. Nothing about the command changes the answer; the directory does. So in a workspace
with a project-level `cli` block, the effective setting can differ between a shell at the repository
root and one inside a project directory — with no flag, no environment variable and no message
saying the answer moved.

Two behaviours make this sharper, and both are provable from the algorithm on
[14](14-multi-project-workspaces.md):

- **In a single-project workspace the cwd is irrelevant.** The resolver short-circuits when there is
  exactly one project and returns it, so that project's block always applies — even from a directory
  that has nothing to do with it.
- **In a multi-project workspace the initial application's `root` is `""`, and an empty root
  contains every path.** Standing at the repository root therefore resolves to the initial app, so
  the initial app's project-level `cli` block is the one consulted — including when the command you
  are running concerns a different project.

That second point is the one that matters for CI: a pipeline running commands from the repository
root of a monorepo is, by construction, reading the first application's project-level configuration.

## The cliff edge nobody sees in a diff

Put the two behaviours together and there is a transition worth naming explicitly. In a
single-project workspace, project-level configuration is deterministic — the cwd cannot change the
answer. The moment `ng generate application` adds a second project, resolution becomes
cwd-dependent, and configuration that behaved predictably for months starts depending on where a
shell happens to be.

Nothing in the diff of that generation shows it. The new project object appears, the existing one is
untouched, and the behaviour of the *existing* project's `cli` block silently changes from
unconditional to conditional. If you are about to add a second project to a workspace that has
project-level `cli` settings, that is the moment to move them to the workspace level or to make
every invocation name its project.

## Gotchas

**★ Symptom: the same command behaves differently depending on which directory you run it from, in
one repository.** Cause: the project-level block is selected by `getProjectByCwd`, so moving between
directories changes which project's `cli` block is read. Fix: stop depending on the cwd where it
matters — name the project explicitly in scripts:

```json
{
  "scripts": {
    "build:admin": "ng build admin --configuration production",
    "build:web": "ng build web --configuration production"
  }
}
```

**★ Symptom: in a monorepo, CI appears to read the wrong project's `cli` block even though the
command names a project.** Cause: naming a project tells Architect which target to run; it does not
change how the project is resolved for configuration purposes, which is still by cwd — and the
initial application's `root` is `""`, which contains every path. Fix: give every project a real root
so the initial app stops being a catch-all:

```json
{
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: project-level `cli` settings that were reliable for a year became unpredictable right
after someone ran `ng generate application`.** Cause: the resolver short-circuits only while there is
exactly one project; adding a second makes resolution cwd-dependent, and nothing in the generated
diff says so. Fix: move workspace-wide settings up a level at the same time as adding the project:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm", "cache": { "environment": "all" } },
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: `cache` in a project-level `cli` block has no effect.** Cause: caching is a workspace
concern — the cache path is workspace-relative, and the only key the project fragment names is
`schematicCollections`. Fix: move it to the top level:

```json
{
  "version": 1,
  "cli": { "cache": { "environment": "all" } },
  "projects": {
    "my-app": { "root": "", "projectType": "application" }
  }
}
```

**Symptom: `analytics` or `warnings` at the project level is neither rejected nor honoured.** Cause:
the project fragment names neither, and the fragment is missing the wrapper that would make it
reject anything — so the key sits in the file being read by nothing. Fix: put both at the workspace
level, where the definition that declares them applies:

```json
{
  "version": 1,
  "cli": { "analytics": false, "warnings": { "versionMismatch": true } },
  "projects": {
    "my-app": { "root": "", "projectType": "application" }
  }
}
```

**Symptom: your editor does not flag an obviously wrong key inside a project-level `cli` block, but
flags the same key at the workspace level.** Cause: the two are typed by different schema fragments,
and the project-level one lacks the `properties` wrapper that would let a validator apply
`additionalProperties` reasoning to it. Fix: do not treat "the editor is quiet" as validation at
this level — keep the block to `schematicCollections`, which is the only key the schema names there:

```json
{
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    }
  }
}
```

**Symptom: a library project has a `cli` block that nothing seems to read.** Cause: the block only
applies when the CLI resolves to that project, and a library's directory is where you would have to
be standing — commands run from the workspace root resolve elsewhere. Fix: if the setting should
apply to work on that library regardless of cwd, put it at the workspace level:

```json
{
  "version": 1,
  "cli": { "schematicCollections": ["@angular/material"] },
  "projects": {
    "ui": { "root": "projects/ui", "projectType": "library" }
  }
}
```

## Interview questions

**★ In a single-project workspace, does the directory you are standing in affect which `cli` block
applies?**
No. The resolver short-circuits when there is exactly one project and returns it regardless of the
cwd, so the single project's block always applies. The reason to know this is that it is a cliff
edge rather than a rule: the moment a second project is generated, resolution becomes
cwd-dependent, and configuration that behaved deterministically for months starts depending on where
a shell happens to be. That transition does not appear anywhere in the diff of the generation that
caused it.

**★ A monorepo's CI names the project on the command line. Can a project-level `cli` block still
surprise it?**
Yes, and this is the sharpest version of the problem. Naming the project tells Architect which
target to run; it does not change how the project is resolved for configuration lookups, which is
still by working directory. A pipeline running from the repository root resolves to the initial
application — whose `root` is `""`, and an empty root contains every path — so the initial app's
`cli` block is the one consulted no matter which project the build is for. Giving every project a
real root, or running from inside the project directory, removes the ambiguity.

**★ Why is the project-level `cli` definition narrower than the workspace-level one, and what
exactly does the schema say?**
The workspace-level block is typed by `cliOptions` with five enumerated properties. The
project-level block is declared inline inside the `project` definition, and as written it contains
`schematicCollections` without a surrounding `"type": "object"` and `"properties"` wrapper — so the
fragment does not constrain the block the way the workspace definition does, and what it validates
in practice cannot be determined from the schema text alone. What *is* settled is behaviour: the CLI
demonstrably reads `packageManager` from a project-level block, and `schematicCollections` is the
only key the schema names there. The defensible position is to use the project level for
`schematicCollections`, accept that `packageManager` works there because the code looks for it, and
treat everything else at that level as unsupported.

**Which settings genuinely belong at the project level, and which are workspace-wide by nature?**
`schematicCollections` is the one with a real per-project use case — different projects legitimately
generate from different collections, and it is the only key the project fragment names.
`packageManager` works there but rarely earns it, because a repository has one installer.
Everything else is workspace-wide by nature: `cache` because its path is workspace-relative and it
caches workspace build state, `analytics` because it is a decision about the repository, and
`warnings` because it is about the CLI installation rather than any project. Placing a
workspace-wide setting at the project level does not usually produce an error — it produces a
setting that applies only when the cwd happens to resolve there.

**Why should you be suspicious of a quiet editor inside a project-level `cli` block?**
Because the fragment that types it is missing its own wrapper, so the validation you get at the
workspace level does not carry over. At the top level, `cliOptions` is a closed object with five
declared properties, and a wrong key gets underlined. Inside a project, the declaration is not shaped
like an object schema at all, so silence is not evidence of correctness. Combined with the fact that
the reader never inspects `cli` at either level, the project-level block is the least-checked corner
of the file — which is a good reason to keep only the one key the schema names there.

{/* FOOTER */}
