---
title: "The global CLI config is a second file with a second schema that happens to share a key name with the first — so a `cli` block copied between them is a schema violation, not a preference that failed to apply"
sidebar_label: "01b · The global config file"
sidebar_position: 1.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts)
> and [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the source excerpts are
> transcribed from the CLI repository, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**There are two Angular config files on a developer's machine and only one of them belongs to the
project.** `angular.json` is the workspace file — projects, targets, builders, every option a build
reads. The other one holds machine-wide CLI preferences, has always had a confusing name, and has
moved location. Both carry a top-level `cli` key, and that shared key name is the entire source of
the confusion: the two `cli` blocks are typed by **different definitions in the same schema file**,
so a block that is valid in one is rejected by the other. Settings quietly landing in the wrong
file is the failure mode, and it looks exactly like "the CLI ignored my configuration".

## Where the global file actually is

The CLI's config utility declares the legacy name and location as constants:

```ts
const globalFileName = '.angular-config.json';
const defaultGlobalFilePath = path.join(os.homedir(), globalFileName);
```

and then computes the current one from the XDG base directory specification:

```ts
const xdgConfig = xdgConfigHome(home, 'config.json');   // $XDG_CONFIG_HOME/angular/config.json
```

A file still sitting at the legacy path is detected, and the CLI tells you where to put it —
verbatim from the same file:

```ts
console.warn(
  `Old configuration location detected: ${xdgConfigOld}\n` +
    `Please move the file to the new location ~/.config/angular/config.json`,
);
```

So there are three names in circulation for one concept, and only the last is current:

| Path | Status |
|---|---|
| `~/.angular-config.json` | legacy; detected, warned about |
| `$XDG_CONFIG_HOME/angular/config.json` | current, when the variable is set |
| `~/.config/angular/config.json` | current default, the path the warning names |

⚠️ **`$XDG_CONFIG_HOME` is read, so a dotfile manager that redefines it moves your Angular global
config with everything else.** If a global preference stops taking effect after a change to your
shell profile, that variable is the first thing to print.

**What happens when a file exists at both the legacy and the current path was not confirmed** — the
warning proves the legacy path is still *detected*, but the precedence between the two was not
traced against the source for this page. Keep exactly one.

## The two `cli` blocks are typed by different definitions

Both files carry a top-level `cli` object, and both definitions live in the *same* schema file,
`workspace-schema.json`:

- **`cliOptions`** types the `cli` block of `angular.json`. It includes **`cache`**.
- **`cliGlobalOptions`** types the `cli` block of the global file. It includes **`completion`**
  (`{ "prompted": boolean }`) and **does not** include `cache`.

The rest of the two definitions overlap; those two keys are the difference at `v22.1.7`. Because
the schema uses `additionalProperties: false`, "not in this definition" means **rejected**, not
ignored — the mistake surfaces as a validation failure or an editor squiggle rather than as silence.

```json
// ~/.config/angular/config.json — the GLOBAL file. Machine-wide preferences.
{
  "cli": {
    "completion": { "prompted": true },
    "packageManager": "pnpm"
  }
}
```

```json
// angular.json — the WORKSPACE file. "cache" is a property of this project.
{
  "version": 1,
  "cli": {
    "cache": { "enabled": true, "path": ".angular/cache" }
  },
  "projects": {}
}
```

The full contents of the workspace `cli` block, its interaction with a per-project `cli` block, and
the precedence between them belong to **13 · The `cli` block and workspace-wide defaults**
*(not written yet)*. This page is only about which of the two files a block goes in.

## The scoping question the file split is answering

The split is not arbitrary. Ask *"is this a property of the project, or of the person typing the
command?"*:

- **A property of the project** — where build artefacts cache, which schematic collections the
  workspace uses, what prefix generated selectors get. These are the same for everyone who checks
  out the repository, so they belong in `angular.json`, which is in version control.
- **A property of the machine** — whether the CLI has offered to install shell completion, which
  package manager this developer prefers. These differ per person and per laptop, so they belong in
  the global file, which is not in version control.

🔴 **The corollary is the one that bites in CI: a global config file is not in the repository, so
any behaviour that depends on it is not reproducible.** If a build works on one machine and not on
a runner, a setting living only in `~/.config/angular/config.json` is a candidate, and no amount of
reading `angular.json` will reveal it.

## Gotchas

**★ Symptom: `Old configuration location detected: …` printed before every command.** Cause: a
global config file is still at the legacy `~/.angular-config.json` path while the CLI now resolves
the XDG location. Fix: move it exactly where the message says, and do not leave a copy behind:

```bash
mkdir -p ~/.config/angular
mv ~/.angular-config.json ~/.config/angular/config.json
```

**★ Symptom: a `"completion"` block added to `angular.json` is rejected by the schema.** Cause:
`completion` is defined on `cliGlobalOptions`, the global file's shape, and the workspace `cli`
block is typed by `cliOptions`, which does not have it. Fix: move the block to the global file:

```json
{
  "cli": {
    "completion": { "prompted": true }
  }
}
```

**★ Symptom: a `"cache"` block in `~/.config/angular/config.json` has no effect on build caching.**
Cause: the mirror image — `cache` is a `cliOptions` key and is not part of `cliGlobalOptions`. Fix:
it is a project setting; put it in the workspace file:

```json
{
  "version": 1,
  "cli": { "cache": { "enabled": false } },
  "projects": {}
}
```

**★ Symptom: a build behaves differently on a CI runner than on every developer machine, and
`angular.json` is identical.** Cause: a setting that lives only in the per-machine global config,
which is not in the repository and therefore does not exist on the runner. Fix: move anything the
build depends on into the workspace file, which is committed:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {}
}
```

**Symptom: a global preference stops working after changing shell dotfiles.** Cause:
`$XDG_CONFIG_HOME` is honoured, so redefining it relocates the whole `angular/config.json` path.
Fix: print the variable and look where it actually points:

```bash
echo "${XDG_CONFIG_HOME:-$HOME/.config}/angular/config.json"
```

**Symptom: `projects` added to the global config file is rejected or ignored.** Cause: the global
file is not a workspace file. `projects` is a top-level key of `angular.json` only, and the global
file is a `cli` preferences document. Fix: there is no global equivalent — a project must be
declared in a workspace file:

```json
{
  "version": 1,
  "projects": {
    "storefront": { "root": "", "projectType": "application" }
  }
}
```

**Symptom: you have both `~/.angular-config.json` and `~/.config/angular/config.json` and edits to
one appear not to apply.** Cause: two candidate global files. The CLI detects the legacy path — that
is what emits the warning — but **the precedence between the two was not confirmed** for this page.
Fix: keep exactly one file and delete the other:

```bash
rm ~/.angular-config.json      # after merging anything you still want into the XDG path
```

**Symptom: someone commits `.angular-config.json` into the repository root expecting it to
configure the project.** Cause: the name looks like a workspace file and sits next to one, but it
is neither searched for as a workspace file (only `angular.json` and `.angular.json` are, see
[01](01-the-file-the-cli-reads.md)) nor read from a project directory as a global file. Fix: delete
it and put the settings where they belong:

```bash
git rm .angular-config.json
```

**Symptom: an editor offers no autocompletion inside the global config file.** Cause: the global
file has no `$schema` key written into it by any generator, so the editor has nothing to validate
against — unlike `angular.json`, which the workspace schematic writes a `$schema` pointer into. Fix:
add the pointer by hand, aiming it at the same schema file, which defines `cliGlobalOptions` as well:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "cli": { "completion": { "prompted": true } }
}
```

⚠️ That relative path only resolves if the global file happens to sit above a `node_modules`
containing the CLI, which for a home-directory config it usually does not; an absolute path to the
installed schema is the practical form.

## Interview questions

**★ What is the difference between `angular.json` and the global CLI config?**
They are different files with different schemas and different lifetimes. `angular.json` (or
`.angular.json`) is the workspace file — `version`, `projects`, targets, builders — found by an
ascending search from the working directory and committed to version control. The global file holds
machine-wide CLI preferences, lives at `~/.config/angular/config.json` under XDG (legacy path
`~/.angular-config.json`, which triggers a migration warning), and is not in version control. They
share a top-level `cli` key, but that key is typed by `cliOptions` in the workspace file and
`cliGlobalOptions` in the global one, and those definitions differ.

**★ Why does moving a `cli` block between the two files break it?**
Because the two definitions are not the same type. At 22.1.7 `cliGlobalOptions` carries
`completion` and lacks `cache`, and `cliOptions` is the reverse. The schema declares
`additionalProperties: false`, so a key that is not part of the definition is a validation error
rather than an ignored extra. The practical consequence is that the failure is loud in an editor
with schema support and confusing everywhere else, because "invalid key" and "key that did nothing"
look the same from a command line.

**How would you decide whether a setting belongs in the workspace file or the global one?**
Ask whether it is a property of the project or of the person. Anything that must be identical for
every developer and for CI — cache configuration, schematic defaults, the selector prefix — is a
project property and goes in `angular.json`, which is committed. Anything that is a personal or
per-machine preference — whether shell completion has been offered — is a machine property and goes
in the global file. The test that settles ambiguous cases: if CI would behave differently without
it, it must be in the repository.

**A build works locally and fails in CI, and `angular.json` is byte-identical. What is your first
hypothesis?**
That the behaviour depends on something not in the repository, and the global CLI config is one of
the two obvious candidates (the other being the lockfile and installed versions). The global file
exists per machine, is never committed, and is silently absent on a runner. Reproducing the failure
means either moving the setting into the workspace file or making the runner's environment
explicit — the first is almost always the right answer, because it makes the dependency visible.

**Why is `$XDG_CONFIG_HOME` worth knowing about here?**
Because the CLI computes the global config path from it rather than hard-coding `~/.config`. A
dotfile manager, a container image or a shell profile that sets the variable relocates the Angular
global config along with everything else, and the symptom is a preference that "reset itself". The
diagnosis is to print the resolved path rather than to look in the default one.

**The CLI still warns about `.angular-config.json`. Does that mean it still reads it?**
The warning proves the file is still *detected* at the legacy path, and it names the new location
as the place to move it to. Whether the legacy file is also still honoured, and what happens when
both files exist, was not confirmed against the source for this page. The safe reading is the one
the message itself implies: treat the legacy path as deprecated, move the file, and keep exactly
one.

{/* FOOTER */}
