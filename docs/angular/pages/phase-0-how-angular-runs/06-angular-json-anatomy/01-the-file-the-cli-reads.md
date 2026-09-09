---
title: "The CLI does not read the `angular.json` next to you — it accepts two filenames, walks up from the working directory, then falls back to its own install path, so the workspace you configure is a search result rather than a place you chose"
sidebar_label: "01 · The file the CLI reads"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts)
> and [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> both at tag `v22.1.7`, cross-read against
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run** — every code block below is transcribed from the
> CLI's own source, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every Angular command begins with a filesystem search, and almost nobody knows it is happening.**
`ng build` does not require you to be at the workspace root, does not take the workspace path as an
argument, and does not read an environment variable to find it. It looks for one of **two**
filenames, starting at your current working directory and walking up the tree until it hits one —
and if that fails, it walks up from the CLI's *own* directory instead. That search is why the CLI
"just knows" where your project is, and it is also why a stray `angular.json` three directories
above you can silently redirect an entire build. Knowing the search order turns a whole class of
"it works on my machine" into a one-line diagnosis.

## Two accepted filenames, and they are not equal in visibility

The names are a constant in the CLI's config utility:

```ts
const configNames = ['angular.json', '.angular.json'];
const globalFileName = '.angular-config.json';
const defaultGlobalFilePath = path.join(os.homedir(), globalFileName);
```
— [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts) at `v22.1.7`

Three distinct names live in those four lines and they are three different things:

| Name | What it is | Where it lives |
|---|---|---|
| `angular.json` | the workspace file, the one this whole topic is about | workspace root |
| `.angular.json` | the same file, dot-prefixed — equally accepted | workspace root |
| `.angular-config.json` | the **global** CLI config, a different schema | your home directory (legacy path) |

The third of those is a different file with a different schema and it is easy to confuse with the
other two — [01b](01b-the-global-config-is-a-different-file.md) is about nothing else.

`.angular.json` is a genuine alternative, not a fallback for a corrupted file: both entries are in
the same array and both are searched. It is also hidden from a bare `ls`, invisible in the default
file tree of several editors, and skipped by a glob like `*.json`. If you inherit a repository
where `angular.json` appears to be missing yet `ng build` works, that is the first thing to check.

## The search: up from your cwd, then up from the CLI

```ts
async function projectFilePath(projectPath?: string): Promise<string | null> {
  // Find the configuration, either where specified, in the Angular CLI project
  // (if it's in node_modules) or from the current process.
  return (
    (projectPath && (await findUp(configNames, projectPath))) ||
    (await findUp(configNames, process.cwd())) ||
    (await findUp(configNames, __dirname))
  );
}
```

Three candidates, tried in order, first hit wins:

1. **An explicitly supplied path**, when the calling code has one.
2. **`process.cwd()`** — the directory the shell was in when you typed `ng`.
3. **`__dirname`** — the directory the CLI's own JavaScript is executing from.

`findUp` is an *ascending* search. It checks the starting directory for either filename, then the
parent, then that parent's parent, up to the filesystem root. So this holds:

> Running `ng build` from `src/app/features/checkout/` finds the workspace file four directories
> up, and behaves exactly as if you had run it from the root.

That is the convenience. The cost is that **the CLI cannot tell the difference between the
workspace you meant and the first `angular.json` it happened to meet.** A repository that carries
example apps, e2e fixtures or a scaffolding template under version control has more than one
`angular.json` in its tree, and which one a command resolves depends entirely on where your shell
was.

## The third fallback is the one people never predict

`findUp(configNames, __dirname)` walks up from **the CLI's own installed location**. Read the
comment the maintainers left on it — *"in the Angular CLI project (if it's in `node_modules`)"* —
and the behaviour follows mechanically:

- A **locally installed** CLI lives at `<workspace>/node_modules/@angular/cli/…`. Walking up from
  there passes through `node_modules`, reaches `<workspace>`, and finds that workspace's
  `angular.json`. So a locally installed `ng` can resolve its own workspace **even when your cwd is
  somewhere with no workspace above it at all.**
- A **globally installed** CLI lives under the package manager's global prefix, where there is no
  `angular.json` in any ancestor. The third fallback finds nothing and the command fails for want
  of a workspace.

This is why two developers running "the same command" can get different outcomes: one is invoking
the local binary through a package script or `npx`, the other a global `ng`.

## The search has no boundary except the filesystem root

Most JavaScript tooling that walks upward stops at a boundary — a `package.json`, a lockfile, a
`.git` directory, a workspace root declared by the package manager. **The CLI's search takes no
such argument.** Both call sites pass exactly two things: the list of filenames and a starting
directory.

```ts
(await findUp(configNames, process.cwd())) ||
(await findUp(configNames, __dirname))
```

There is no third parameter naming a stopping point, which has two consequences worth internalising:

- **A repository boundary does not contain the search.** If your checkout has no `angular.json` and
  one exists in a parent directory outside the repository — a scratch workspace in `~/projects`, or
  an old experiment left in your home directory — that is what a command resolves.
- **A package-manager workspace boundary does not contain it either.** Being inside a pnpm or yarn
  workspace package means nothing to this code; the walk continues past the package into the
  monorepo root and beyond it if necessary.

The practical rule that falls out: **treat every ancestor of your working directory, all the way to
`/`, as part of the build's configuration surface.** That is a larger surface than most people
assume they have.

## Gotchas

**★ Symptom: `ng build` builds an application you were not looking at, or reports targets you do
not recognise.** Cause: `findUp` from `process.cwd()` reached an `angular.json` belonging to a
fixture, example or template app before it reached yours — or your shell was inside one. Fix: keep
exactly one CLI-visible workspace file in any ancestor chain. A fixture workspace that must live
inside the repository can be renamed to something the CLI does not search for, since only two names
are accepted:

```bash
# The CLI searches for 'angular.json' and '.angular.json' only.
mv fixtures/demo-app/angular.json fixtures/demo-app/workspace.fixture.json
```

**★ Symptom: a CI job fails to find the workspace while the identical command works locally.**
Cause: the job's working directory is not the repository root, and there is no `angular.json` above
it. The search never consults the repository root as a concept — only the directory chain. Fix: set
the working directory explicitly on the step rather than relying on the runner's default:

```yaml
- name: Build
  working-directory: apps/storefront
  run: npx ng build
```

**★ Symptom: `Unable to read workspace file.`** Cause: no `angular.json` or `.angular.json` exists
in any ancestor of the cwd, and the CLI's own `__dirname` fallback found nothing either — which is
the normal outcome for a globally installed `ng` run outside a project. Fix: run the workspace's
own binary so the third fallback can rescue you, or move to the workspace root:

```bash
npx ng build          # resolves <workspace>/node_modules/.bin/ng
```

**Symptom: `angular.json` appears to be missing from a repository whose `ng` commands work.**
Cause: the workspace file is the dot-prefixed `.angular.json`, which `ls` hides and many editors
collapse into a "hidden files" group. Fix: list both names when you go looking:

```bash
ls -a | grep -E '^\.?angular\.json$'
```

**Symptom: both `angular.json` and `.angular.json` exist in the same directory and edits to one
have no effect.** Cause: only one of them is being read. Both names are in `configNames` and both
are accepted; **which one wins when they sit side by side in the same directory was not confirmed
against the source for this page** — `findUp`'s iteration order over the name list settles it and
it was not traced. Fix: never keep both. Delete or rename one:

```bash
git rm .angular.json      # keep the conventional name
```

**Symptom: a monorepo command run from a package directory configures the root workspace instead of
the package.** Cause: the package has no `angular.json` of its own, so the ascending search
continued past it to the root. Fix: this is usually correct and intended — Angular's own multi-app
model is *one* workspace with many entries in `projects`, not one workspace per directory. If you
genuinely want a separate workspace per package, each package needs its own `angular.json`, and
then the cwd of every command becomes load-bearing.

**Symptom: `ng build` in a directory with no project at all does not error — it builds something.**
Cause: the ascending search escaped the repository and found an `angular.json` in a parent
directory, commonly an old experiment sitting directly in your home directory. Nothing in the
search stops at a repository or package boundary. Fix: get rid of the stray file, because it will
keep doing this:

```bash
ls -a ~ | grep -E '^\.?angular\.json$'   # then remove or rename what it finds
```

**Symptom: a Docker build resolves a different workspace than the same command run locally.**
Cause: the image's `WORKDIR` is the cwd for the whole search, and a `COPY` that lands the project
under a path with another `angular.json` above it changes what wins. Fix: make the working
directory the workspace root explicitly in the Dockerfile, and copy the workspace file first so its
absence fails loudly:

```dockerfile
WORKDIR /app
COPY angular.json package.json package-lock.json ./
RUN npm ci
```

**Symptom: two developers get different results from `ng version` or `ng build` in the same
checkout.** Cause: one is running a globally installed CLI (whose `__dirname` fallback resolves
nothing) and the other the locally installed one (whose `__dirname` fallback resolves the
workspace). Fix: remove the ambiguity by always going through the local binary:

```json
{
  "scripts": {
    "build": "ng build",
    "start": "ng serve"
  }
}
```

## Interview questions

**★ How does the Angular CLI decide which `angular.json` a command applies to?**
It searches, in order: an explicitly supplied path if the calling code has one, then an ascending
`findUp` from `process.cwd()`, then an ascending `findUp` from the CLI's own `__dirname`. Each
search looks for either `angular.json` or `.angular.json` in the starting directory and then in
each parent up to the filesystem root, and the first match wins. Nothing about the search consults
a repository root, a git boundary, an environment variable or a command-line workspace flag — it is
purely a walk up the directory chain, which is why the cwd of the shell that launched `ng` is part
of the build's input.

**★ Why can a locally installed CLI succeed where a global one fails, from the same directory?**
The third fallback walks up from `__dirname`, the directory the CLI's code is executing from. A
locally installed CLI lives inside `<workspace>/node_modules/@angular/cli`, so walking up from it
arrives at the workspace and finds the file. A globally installed CLI lives under the package
manager's global prefix, where no ancestor contains an `angular.json`, so the fallback yields
nothing. The maintainers' own comment on that line names this case: *"in the Angular CLI project
(if it's in `node_modules`)"*.

**What would you check first when a colleague reports that `ng build` "built the wrong app"?**
Which `angular.json` the command resolved, which is a function of where they ran it. Any ancestor
of their working directory that contains `angular.json` or `.angular.json` is a candidate, and the
nearest one wins. Repositories that keep example apps, e2e fixtures or scaffolding templates in
tree are the common source; so is a shell left inside a sub-application. The fix is structural —
one CLI-visible workspace file per ancestor chain — rather than an argument to the command.

**Why is a dot-prefixed `.angular.json` worth knowing about even though nobody uses it?**
Because it is fully supported and completely invisible. It does not appear in `ls`, it is collapsed
or hidden by several editors, and it is missed by tooling that globs `*.json`. A repository that
uses it looks like a repository with no workspace configuration at all, which sends people looking
for a problem that does not exist. It also means an audit script that checks "does every project
have an `angular.json`" gives false negatives unless it checks both names.

**Does the workspace search stop at the repository root?**
No. The code passes `findUp` only a list of filenames and a starting directory — there is no
boundary argument, so the walk continues to the filesystem root. A `.git` directory, a lockfile or
a package-manager workspace root are all invisible to it. That is a meaningful difference from most
JavaScript tooling, which usually treats the nearest package boundary as a stopping point, and it
means an `angular.json` left in your home directory is reachable from any command run anywhere
below it.

**If the search is ascending, what stops `ng` inside a nested library from configuring the wrong
project?**
Nothing at the file level — and that is the point. Angular's model is a single workspace whose
`projects` map holds every application and library, so the ascending search reaching the root
workspace file is the *intended* behaviour, and project selection happens inside that file rather
than through the directory you are standing in. Directory-based project selection is a separate
mechanism layered on top of the resolved workspace, covered in **14 · Multi-project workspaces**
*(not written yet)*.

{/* FOOTER */}
