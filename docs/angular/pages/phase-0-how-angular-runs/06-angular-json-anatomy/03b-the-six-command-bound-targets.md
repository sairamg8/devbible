---
title: "Six target names are wired to CLI commands and everything else needs `ng run` — so renaming a target breaks a command that has nothing to do with the builder inside it"
sidebar_label: "03b · The six wired target names"
sidebar_position: 3.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the builder-target section of
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config),
> [angular.dev/tools/cli/cli-builder](https://angular.dev/tools/cli/cli-builder), and
> `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
> at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The Angular CLI has far fewer commands than it appears to, because most of them are one fixed
target name with argument parsing around it.** Six names are bound to commands. Everything else in a
project's target map is reachable only through `ng run <project>:<target>`. That single fact explains
why renaming a target silently deletes a command, why a fresh workspace has no `ng lint`, and why
custom jobs are invisible until someone wraps them in a script.

## The mapping, verbatim

> *"| `build` | Configures defaults for options of the `ng build` command. |"*
>
> *"| `serve` | Overrides build defaults and supplies extra serve defaults for the `ng serve`
> command. Besides the options available for the `ng build` command, it adds options related to
> serving the application. |"*
>
> *"| `e2e` | Overrides build defaults for building end-to-end testing applications using the
> `ng e2e` command. |"*
>
> *"| `test` | Overrides build defaults for test builds and supplies extra test-running defaults for
> the `ng test` command. |"*
>
> *"| `lint` | Configures defaults for options of the `ng lint` command, which performs static code
> analysis on project source files. |"*
>
> *"| `extract-i18n` | Configures defaults for options of the `ng extract-i18n` command, which
> extracts localized message strings from source code and outputs translation files for
> internationalization. |"*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

and then the sentence that makes the rest of the system make sense:

> *"Other targets can be executed using the `ng run` command, and you can define your own targets."*

🔴 **The target name is the contract, not the builder.** `ng test` runs the target *named* `test`
whatever builder sits inside it; renaming that target to `tests` breaks the command even though
nothing about the builder changed. Conversely, a target named `smoke` is invisible to every command
except `ng run <project>:smoke`.

## What a generated workspace actually contains

⚠️ **A freshly generated Angular 22 application has three targets — `build`, `serve` and `test`.**
The application schematic writes exactly those; there is no `lint` target and no `e2e` target,
because nothing generates them. `ng lint` in a new workspace has nothing to run until a linter's own
schematic adds one. That is a fact about the schematic, not a defect, and it accounts for a large
share of "the CLI is broken" reports on day one of a project.

So of the six documented names, three are present by default, two arrive with a tool you install, and
`extract-i18n` arrives when you add localization.

## Addressing a target

Targets are addressed with a colon-separated string. The dev-server builder's `buildTarget` option
documents the shape, and the same form is what `ng run` takes:

> *"A build builder target to serve in the format of `project:target[:configuration]`. You can also
> pass in more than one configuration name as a comma-separated list. Example:
> `project:target:production,staging`."*
> — the `buildTarget` description in the dev-server builder schema at `v22.1.7`

```json
{
  "scripts": {
    "smoke": "ng run storefront:smoke",
    "smoke:ci": "ng run storefront:smoke:ci"
  }
}
```

An `ng run` target that nobody has wrapped in a script is, in practice, undiscoverable: it appears in
no `--help`, no README and no command list.

## Options are camelCase in the file and dash-case on the command line

> *"HELPFUL: All options in the configuration file must use `camelCase`, rather than `dash-case` as
> used on the command line."*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

So `--output-hashing all` on a command line is `"outputHashing": "all"` in the file. This is a
top-five source of confusion and it fails **loudly**, because a builder's option schema declares
`additionalProperties: false` — a dash-case key is an unknown property, not an ignored one.

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": {
        "tsConfig": "tsconfig.app.json",
        "outputHashing": "all",
        "extractLicenses": true
      }
    }
  }
}
```

## Gotchas

**★ Symptom: `"output-hashing": "all"` in `angular.json` fails validation.** Cause: options are
camelCase in the file and dash-case only on the command line, and the builder's option schema is
`additionalProperties: false`, so the unknown key is an error rather than a no-op. Fix:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json", "outputHashing": "all" }
    }
  }
}
```

**★ Symptom: `Project target does not exist.`** Cause: the named target is not in the project's
targets map — `ng run storefront:lint` in a workspace with no `lint` target is the usual route.
Note the message does **not** name the target, which makes it far less helpful than the neighbouring
errors; the target you asked for is in your command line, not in the output. Fix: add the target, or
run one that exists:

```json
{
  "targets": {
    "lint": {
      "builder": "@angular-eslint/builder:lint",
      "options": { "lintFilePatterns": ["src/**/*.ts", "src/**/*.html"] }
    }
  }
}
```

**★ Symptom: `ng lint` reports a missing target in a brand-new Angular 22 workspace.** Cause: the
application schematic writes `build`, `serve` and `test` and nothing else. There has never been a
generated `lint` target in this shape of workspace. Fix: add a linter through its own schematic so
that it writes the target for you, or write it by hand:

```json
{
  "targets": {
    "lint": {
      "builder": "@angular-eslint/builder:lint",
      "options": { "lintFilePatterns": ["src/**/*.ts"] }
    }
  }
}
```

**★ Symptom: renaming a target from `test` to `tests` silently removes `ng test`.** Cause: the
command looks up a fixed target name. The builder inside is irrelevant to that lookup. Fix: keep the
six wired names exactly as documented, and give extra jobs new names reachable through `ng run`:

```json
{
  "targets": {
    "test": { "builder": "@angular/build:unit-test", "options": {} },
    "test-ci": { "builder": "@angular/build:unit-test", "options": { "watch": false } }
  }
}
```

**Symptom: a custom target runs with `ng run` and is unreachable any other way.** Cause: that is the
design — only the six documented names are bound to commands, and *"Other targets can be executed
using the `ng run` command"*. Fix: nothing to repair; wire it into a script so it is discoverable:

```json
{
  "scripts": {
    "smoke": "ng run storefront:smoke"
  }
}
```

**Symptom: `ng e2e` in a fresh workspace reports a missing target.** Cause: same as `lint` — no e2e
target is generated, because the CLI no longer picks an end-to-end tool for you. Fix: add the
target from your chosen tool's schematic, or write one that names its builder:

```json
{
  "targets": {
    "e2e": {
      "builder": "@acme/e2e-builder:run",
      "options": { "devServerTarget": "storefront:serve" }
    }
  }
}
```

**Symptom: a CI pipeline runs `ng run app:build` and a developer runs `ng build`, and they produce
different output.** Cause: they are the same target but not the same *configuration* selection — a
bare command applies `defaultConfiguration`, and so does `ng run` without a third segment, but any
difference in how the two are written shows up here. Fix: name the configuration explicitly on both
sides so neither depends on a default:

```json
{
  "scripts": {
    "build:prod": "ng run storefront:build:production"
  }
}
```

**Symptom: a target named `Build` or `SERVE` is never found by a command.** Cause: the command looks
up an exact lowercase name. Nothing normalises case. Fix:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

## Interview questions

**★ What is the relationship between an Angular CLI command and a target?**
Most commands are a fixed target name plus some argument parsing. `ng build` runs the target named
`build`, `ng serve` the one named `serve`, and so on for `test`, `lint`, `e2e` and `extract-i18n` —
six names in total, documented as such. Everything else is reached with `ng run <project>:<target>`,
and the documentation says outright that you can define your own targets. This is why renaming a
target breaks a command that has nothing to do with the builder inside it, and why a project can
carry arbitrary named jobs that no command will ever find.

**★ Why is it `--output-hashing` on the command line and `outputHashing` in `angular.json`?**
Because the documentation specifies exactly that: all options in the configuration file must use
camelCase rather than the dash-case used on the command line. The reason it matters more than a
style rule is that builder option schemas set `additionalProperties: false`, so `"output-hashing"`
is not silently ignored — it is an unrecognised property and the build fails validation. That is
better than the alternative, but only if you know to read the failure as a naming problem rather
than as a value problem.

**★ Why does a new Angular 22 workspace have no `lint` target?**
Because the application schematic writes `build`, `serve` and `test`, and nothing else. Linting and
end-to-end testing are supplied by separate packages whose own schematics add the corresponding
target when you install them. The consequence for a reader is that `ng lint` failing in a fresh
project is not a broken installation — it is a target that was never generated, and the fix is to add
the tool, not to repair the workspace file.

**How would you add a job to a project that is not one of the six commands?**
Give it a target name of your choosing and run it with `ng run <project>:<target>`. That is the
documented escape hatch — *"Other targets can be executed using the `ng run` command, and you can
define your own targets"* — and it is how custom builders are invoked. In practice the target also
gets an npm script wrapping the `ng run` invocation, because a target name that appears in no
command and no script is undiscoverable to everyone but its author.

**What does a target reference look like, and where else does that syntax appear?**
`project:target[:configuration]`, with the configuration segment optional and able to carry a
comma-separated list. It is what `ng run` takes, and it is also the value of the dev-server's
`buildTarget` option, whose schema description spells out the format and gives
`project:target:production,staging` as an example. The same three-part string therefore appears both
in your shell history and inside `angular.json`, which is worth remembering when a rename breaks
something: the references live in both places.

**If `ng test` and `ng run app:test` do the same thing, why do both exist?**
`ng test` is a command with its own option surface and help text, bound to a fixed target name;
`ng run` is the generic invoker for any target, including ones with no command. They coincide for
the six wired names, and only `ng run` can reach a seventh. The distinction matters when you write
CI: `ng run` is explicit about the project and the configuration, which is what you want in a
pipeline, whereas the bare command leans on project resolution and `defaultConfiguration` — two
defaults that are convenient locally and undesirable in a job that must be reproducible.

{/* FOOTER */}
