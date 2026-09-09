---
title: "The schema names seventeen official builder strings in a `not.enum` clause, and that negative list is simultaneously the best inventory of what exists and the reason a typo'd builder string produces no editor warning at all"
sidebar_label: "03c · The seventeen builder strings"
sidebar_position: 3.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the `target` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The `target` definition is a `oneOf` with one branch per official builder plus a generic branch for
everyone else, and the generic branch identifies itself by *excluding* every official string.** That
`not.enum` is the most complete inventory of Angular's builders available in a machine-readable form
— seventeen strings at 22.1.7 — and its structure has a consequence nobody expects: because any
string that is *not* on the list is valid in the generic branch, a misspelled builder name is a
perfectly valid workspace file that fails at run time.

## The generic branch and its exclusion list

```json
{
  "$comment": "Extendable target with custom builder",
  "type": "object",
  "properties": {
    "builder": {
      "type": "string",
      "description": "The builder used for this package.",
      "not": {
        "enum": [
          "@angular/build:application",
          "@angular/build:dev-server",
          "@angular/build:extract-i18n",
          "@angular/build:karma",
          "@angular/build:ng-packagr",
          "@angular/build:unit-test",
          "@angular-devkit/build-angular:application",
          "@angular-devkit/build-angular:app-shell",
          "@angular-devkit/build-angular:browser",
          "@angular-devkit/build-angular:browser-esbuild",
          "@angular-devkit/build-angular:dev-server",
          "@angular-devkit/build-angular:extract-i18n",
          "@angular-devkit/build-angular:karma",
          "@angular-devkit/build-angular:ng-packagr",
          "@angular-devkit/build-angular:prerender",
          "@angular-devkit/build-angular:server",
          "@angular-devkit/build-angular:ssr-dev-server"
        ]
      }
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

Seventeen strings, in two families:

| Package | Builders |
|---|---|
| `@angular/build` | `application`, `dev-server`, `extract-i18n`, `karma`, `ng-packagr`, `unit-test` |
| `@angular-devkit/build-angular` | `application`, `app-shell`, `browser`, `browser-esbuild`, `dev-server`, `extract-i18n`, `karma`, `ng-packagr`, `prerender`, `server`, `ssr-dev-server` |

The second family is the webpack-era set, deprecated in v22 — that story belongs to
[topic 05 · 07](../05-the-build-angular-build/07-the-webpack-builders-are-deprecated.md), and the
release notes name **no removal version**.

## What an official branch looks like, and why it matters

When the builder string *is* on the list, a different branch of the `oneOf` applies and the target's
`options` becomes typed:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "builder": { "const": "@angular/build:application" },
    "defaultConfiguration": { "type": "string", "description": "A default named configuration to use when a target configuration is not provided." },
    "options": { "$ref": "../../../../angular/build/src/builders/application/schema.json" },
    "configurations": {
      "type": "object",
      "additionalProperties": { "$ref": "../../../../angular/build/src/builders/application/schema.json" }
    }
  }
}
```

Two things are load-bearing here.

🔴 **`configurations` entries `$ref` the *same* schema as `options`.** Every builder option is
therefore legal inside a configuration, and none is required there — the application schema's
`required: ["tsConfig"]` is not re-applied per configuration, because it applies to the merged
result. That is why `"production": { "budgets": [], "outputHashing": "all" }` is a complete, valid
configuration despite naming neither `tsConfig` nor `browser`. What "merged" means precisely is
[04](04-options-and-configurations.md).

⚠️ **`@angular-devkit/build-angular:application`'s branch `$ref`s the same
`angular/build/src/builders/application/schema.json`** as the new builder does. The two names
validate against one file — further evidence that the devkit entry is an alias rather than a second
implementation.

## The consequence: a typo has no schema error

The generic branch accepts **any string that is not one of the seventeen**. `@angular/build:aplication`
is not on the list, so it matches the generic branch, so the file is schema-valid — and because that
branch types `options` as a bare `{ "type": "object" }`, every option inside it becomes valid too.
You lose the error *and* the autocompletion in the same moment.

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:aplication",
      "options": { "tsConfig": "tsconfig.app.json", "anythingAtAll": 42 }
    }
  }
}
```

That file passes a schema check. It fails at run time with `Cannot find builder
"@angular/build:aplication".` from the resolver
([03d](03d-how-a-builder-string-becomes-a-function.md)).

🔴 **So "the editor is happy" is not evidence that a builder string is right. The disappearance of
autocompletion is the signal** — if a target stops offering option names, the builder string above it
is the first thing to read.

## Gotchas

**★ Symptom: your editor offers no autocompletion for options inside a target that used to have it.**
Cause: the builder string no longer matches any official branch of the `oneOf`, so the generic branch
applies and `options` is typed as a plain object. A typo is by far the most common reason; a genuinely
custom builder has the same effect legitimately. Fix: correct the string and the typing returns:

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

**★ Symptom: a misspelled builder string produces no error until the command runs.** Cause: the
generic branch is defined by exclusion, so anything not on the list of seventeen is a valid "custom"
builder as far as the schema is concerned. Fix: the run-time message names the string you wrote —
read it literally, character by character, rather than assuming the package is missing:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**★ Symptom: `Cannot find builder "@angular-devkit/build-angular:application".`** Cause: that string
is on the official list, but the package is not installed — a v22 workspace generated by `ng new`
installs `@angular/build` and not the devkit package. Fix: use the string for the package you
actually have:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**★ Symptom: options copied from a `browser` builder target are rejected under `application`.**
Cause: each official branch `$ref`s that builder's own option schema, and the two schemas are
different documents with different property sets. A file that validated under one does not validate
under the other. Fix: translate the options rather than moving them — the option renames are
[topic 05 · 08b](../05-the-build-angular-build/08b-the-option-renames.md):

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": {
        "tsConfig": "tsconfig.app.json",
        "browser": "src/main.ts",
        "outputPath": "dist/storefront"
      }
    }
  }
}
```

**Symptom: a configuration is rejected for missing `tsConfig`.** Cause: it is not — the outer
`required: ["tsConfig"]` is not applied to a configuration, because a configuration `$ref`s the same
schema in a context where the requirement is satisfied by the merged result. If you see this, the
missing option is genuinely missing from `options` as well. Fix: put the required option in
`options`, where it belongs, and let configurations carry only the differences:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" },
      "configurations": { "production": { "outputHashing": "all" } }
    }
  }
}
```

**Symptom: a workspace still names `@angular-devkit/build-angular:browser` and nothing warns at the
schema level.** Cause: the string is on the official list, so it is fully valid — deprecation is a
release-note fact, not a schema fact, and there is no `x-deprecated` marker on it. Fix: migrate; the
mechanics are [topic 05 · 08](../05-the-build-angular-build/08-migrating-off-webpack.md), and the
release notes do not state a removal version:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**Symptom: a custom builder's options get no validation in the editor.** Cause: expected — the
generic branch types `options` as `{ "type": "object" }` because the schema cannot know your
builder's option shape. The validation still happens, but at run time, against the `schema.json` your
builder's `builders.json` points at. Fix: nothing in `angular.json`; the typing you want comes from
your builder package's own schema, which the resolver loads.

**Symptom: someone adds a builder string with a trailing space or a capital letter and the message
is confusing.** Cause: the enum match, the resolver's package lookup and the manifest lookup are all
exact string operations, and none of them trims or normalises. Fix: compare the string against the
package's `builders.json` key exactly:

```json
{
  "targets": {
    "test": { "builder": "@angular/build:unit-test", "options": {} }
  }
}
```

## Interview questions

**★ How many official Angular builders are there, and where would you look for the list?**
Seventeen at 22.1.7, and the authoritative machine-readable list is a `not.enum` clause inside the
`target` definition of the CLI's workspace schema. It is a negative list: it exists to define the
*custom builder* branch of a `oneOf` by excluding every official string, so that an official string
falls into its own typed branch instead. Six of the seventeen live in `@angular/build`;
the other eleven are the `@angular-devkit/build-angular` set, deprecated in v22 with no removal
version stated.

**★ Why does a misspelled builder string produce no editor error?**
Because the generic branch of the `oneOf` is defined by exclusion. Any string that is not one of the
seventeen official ones is, by construction, a valid custom builder name, and the branch that accepts
it types `options` as an untyped object. So a typo produces a schema-valid file with no option
validation at all, and the first sign of trouble is the resolver failing at run time with
`Cannot find builder "…"`. The practical tell is the *loss of autocompletion* inside `options` — that
happens the instant the string stops matching an official branch.

**★ What does it mean that `configurations` entries reference the same schema as `options`?**
That every builder option is legal inside a configuration, and that none of the builder's required
options is required there. The `required: ["tsConfig"]` on the application schema applies to the
merged result, not to each fragment, which is why a configuration containing only `budgets` and
`outputHashing` is complete and valid. It also means an editor gives you the same autocompletion
inside a configuration as inside `options` — a small thing that makes configurations much easier to
write correctly.

**Why does `@angular-devkit/build-angular:application` exist alongside `@angular/build:application`?**
As an alias for compatibility. Both strings appear on the official list, and both branches `$ref`
the *same* option schema file under `angular/build/src/builders/application/`, which is about as
direct a piece of evidence as a schema can offer that they are two names for one thing. The reason
to prefer the `@angular/build` string in a modern workspace is simply that a v22 `ng new` installs
that package and not the devkit one, so the devkit string resolves only if you have installed it
yourself.

**A colleague says the schema will catch a bad builder name. What do you tell them?**
That it will catch a bad *option* under a recognised builder, and will not catch a bad builder name
at all. The two failures are asymmetric: with the correct string you get a typed `options` object and
immediate feedback on every key; with an incorrect string you get an untyped object and no feedback
on anything, until the resolver fails. It is worth teaching as a diagnostic rule — if `angular.json`
suddenly accepts nonsense inside a target, look up one line.

{/* FOOTER */}
