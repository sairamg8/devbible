---
title: "A target is a named job with exactly one required key — the builder string — and the CLI commands you type are mostly just fixed target names, which is why `ng run` exists for everything else"
sidebar_label: "03 · Targets and builders"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the `target` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> at tag `v22.1.7`, [angular.dev/tools/cli/cli-builder](https://angular.dev/tools/cli/cli-builder)
> and the builder-target section of
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything the Angular CLI can *do* to a project is a target, and a target is four keys of JSON of
which one is mandatory.** `ng build` is not a build system; it is a lookup of the target named
`build` followed by an invocation of whatever builder that target names. Six target names are wired
to commands ([03b](03b-the-six-command-bound-targets.md)) and the rest are reachable only through
`ng run`. Once that is the mental model, the file stops looking like configuration and starts
looking like what it is — a small graph of named jobs.

## The target object

The schema's `target` definition has a branch per official builder plus one generic branch. The
generic one gives the shape:

```json
{
  "$comment": "Extendable target with custom builder",
  "type": "object",
  "properties": {
    "builder": {
      "type": "string",
      "description": "The builder used for this package."
    },
    "defaultConfiguration": {
      "type": "string",
      "description": "A default named configuration to use when a target configuration is not provided."
    },
    "options": { "type": "object" },
    "configurations": {
      "type": "object",
      "description": "A map of alternative target options.",
      "additionalProperties": { "type": "object" }
    }
  },
  "additionalProperties": false,
  "required": ["builder"]
}
```

⚠️ The `builder` property in the real schema also carries a `not.enum` clause listing every official
builder string, which is omitted from the block above and reproduced in full in
[03c](03c-the-seventeen-builder-strings.md).

Four keys and no others:

| Key | Required | What it is |
|---|---|---|
| `builder` | **yes** | `<package>:<name>` — the program that runs |
| `options` | no | the builder's options, at their base values |
| `configurations` | no | named overrides of those options |
| `defaultConfiguration` | no | which configuration applies when none is asked for |

🔴 **`builder` is the only required key, so the minimum valid target is one line.** A target with a
builder and nothing else is legal — every option the builder needs would have to arrive from the
command line, but the file is valid.

```json
{
  "targets": {
    "serve": { "builder": "@angular/build:dev-server" }
  }
}
```

`additionalProperties: false` closes the object: there is no `description`, no `name`, no `enabled`.
The four keys above are the whole vocabulary of a target.

## What a builder actually is

angular.dev defines the concept precisely, and it is worth reading rather than paraphrasing:

> *"A number of Angular CLI commands run a complex process on your code, such as building, testing,
> or serving your application. The commands use an internal tool called Architect to run _CLI
> builders_, which invoke another tool (bundler, test runner, server) to accomplish the desired
> task. Custom builders can perform an entirely new task, or to change which third-party tool is
> used by an existing command."*
> — [angular.dev/tools/cli/cli-builder](https://angular.dev/tools/cli/cli-builder)

> *"The internal Architect tool delegates work to handler functions called _builders_. A builder
> handler function receives two arguments: … The `options` object is provided by the CLI user's
> options and configuration, while the `context` object is provided by the CLI Builder API
> automatically."*

> *"The builder handler function can be synchronous (return a value), asynchronous (return a
> `Promise`), or watch and return multiple values (return an `Observable`). The return values must
> always be of type `BuilderOutput`. This object contains a Boolean `success` field and an optional
> `error` field that can contain an error message."*

> *"Angular provides some builders that are used by the CLI for commands such as `ng build` and `ng
> test`. Default target configurations for these and other built-in CLI builders can be found and
> configured in the "architect" section of the [workspace configuration
> file](https://angular.dev/reference/configs/workspace-config), `angular.json`. Also, extend and
> customize Angular by creating your own builders, which you can run directly using the
> [`ng run` CLI command](https://angular.dev/cli/run)."*

So the layering is: **command → target → builder string → handler function**. Nothing in the CLI
special-cases Angular's own builders; they resolve through the same mechanism a custom one does
([03d](03d-how-a-builder-string-becomes-a-function.md)).

The file layout of a custom builder, from the same page: `src/my-builder.ts` (*"Main source file for
the builder definition."*), `src/schema.json` (*"Definition of builder input options."*),
`builders.json` (*"Builders definition."*), `package.json` and `tsconfig.json`.

## Gotchas

**★ Symptom: `A builder is not set for target 'build' in project 'storefront'.`** Cause: the target
object exists but has no `builder` key — usually because a merge kept the `options` block and lost
the line above it. Fix: `builder` is the only required key of a target:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json" }
    }
  }
}
```

**★ Symptom: `serve` does not pick up an option you set on `build`.** Cause: targets do not inherit
from one another. There is no parent target, no `extends`, and no implicit relationship between
`build` and `serve` — the dev-server builder reaches a build target only because a `buildTarget`
string names one. Fix: point the serve target at the build target explicitly, which is what the
generated file does
([topic 05 · 06b](../05-the-build-angular-build/06b-the-serve-to-build-coupling.md)):

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json", "outputHashing": "all" }
    },
    "serve": {
      "builder": "@angular/build:dev-server",
      "options": { "buildTarget": "storefront:build" }
    }
  }
}
```

**★ Symptom: `configurations` written as an array is rejected.** Cause: it is a **map** — the schema
declares `"configurations": { "type": "object", "additionalProperties": { "type": "object" } }`, so
the configuration name is the key. A list of named objects is the intuitive shape and the wrong one.
Fix:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json" },
      "configurations": {
        "production": { "outputHashing": "all" },
        "staging": { "outputHashing": "media" }
      }
    }
  }
}
```

**Symptom: a plural or near-miss key — `configuration`, `defaultConfigurations`, `builders` — is
rejected.** Cause: the target object is closed to exactly four names and none of them has a variant
spelling. Fix: the four are `builder`, `options`, `configurations`, `defaultConfiguration`:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json" },
      "configurations": { "production": { "outputHashing": "all" } },
      "defaultConfiguration": "production"
    }
  }
}
```

**Symptom: a target name containing a colon cannot be run.** Cause: the schema does not constrain
target names, but targets are *addressed* as `project:target[:configuration]`, so a colon inside the
name has no way to be expressed in that string. Fix: use a hyphen, which the six documented names
already do (`extract-i18n`):

```json
{
  "targets": {
    "build-ssr": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**Symptom: options written directly on the target object are ignored or rejected.** Cause: the
target object has exactly four keys; builder options live one level down, inside `options`. Fix:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json", "outputPath": "dist/storefront" }
    }
  }
}
```

**Symptom: a `"description"` added to a target to document it is rejected.** Cause:
`additionalProperties: false` on the target object — there is no free-form key, and the extension
pattern from [02e](02e-the-extension-escape-hatch.md) is declared on the *project* object, not on a
target. Fix: document it outside the file, or in a comment, which the parser does allow
([01c](01c-the-file-is-jsonc-not-json.md)):

```json
{
  "targets": {
    // Runs the nightly smoke suite; see docs/testing.md
    "smoke": { "builder": "@acme/builders:smoke" }
  }
}
```

## Interview questions

**★ What is a builder in Angular, in one paragraph?**
A handler function that Architect — the CLI's internal task runner — calls to do a job. The
documentation describes builders as the things CLI commands delegate to, which then *"invoke another
tool (bundler, test runner, server)"*. A builder receives an `options` object assembled from the
workspace file and the command line, plus a `context` object supplied by the Builder API, and
returns a `BuilderOutput` with a boolean `success` and an optional `error`. It may be synchronous,
return a `Promise`, or return an `Observable` that emits repeatedly, which is how watch mode works.
Angular's own builders are not privileged: they are resolved by the same mechanism as a custom one.

**★ Why is `builder` the only required key of a target?**
Because it is the only one the CLI cannot supply or do without. `options` has a defined meaning when
absent — the empty object — `configurations` has a defined meaning when absent, and
`defaultConfiguration` explicitly means "no configuration unless one is asked for". The builder
string, by contrast, is the entire content of the instruction: without it there is nothing to run,
and the CLI says so in those terms — `A builder is not set for target '<target>' in project
'<project>'.` The design point is that a target is a *reference* to a program plus some inputs, and
only the reference is irreducible.

**Do targets inherit from each other?**
No. There is no inheritance, no `extends`, and no implicit relationship between any two targets —
`serve` does not inherit from `build`, and a target you add does not inherit from anything. The only
link between targets is an explicit string: the dev-server builder takes a `buildTarget` option whose
value names a build target, and that is a builder option like any other, not a schema feature. This
is why the same option often has to be repeated across targets, and why a change to `build` can
appear to have no effect on `ng serve`.

**Can you extend the target object with your own metadata?**
Not directly. The target object sets `additionalProperties: false` over exactly four properties, and
the short-prefix extension pattern that opens the *project* object is not declared on a target. In
practice the options are a comment — legal, because the file is JSONC — or a key on the enclosing
project. This is a deliberate narrowness: a target is meant to be a call site, not a place to keep
information about a call site.

**What is the minimum valid target, and is it useful?**
`{"builder": "<package>:<name>"}`. `builder` is the only key in the schema's `required` list, so a
target with nothing else is valid. It is occasionally useful — a builder whose defaults are already
right, with any variation supplied from the command line — but mostly it is worth knowing because it
tells you what the CLI will and will not fill in: `options` defaults to nothing, and `?? {}` covers
its absence rather than any inference about what you meant.

---

← Prev: [Living with extension keys](02f-living-with-extension-keys.md) · Index: [Topic index](README.md) · Next → [The six wired target names](03b-the-six-command-bound-targets.md)
