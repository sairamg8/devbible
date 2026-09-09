---
title: "Three lowercase letters is the entire namespace a tool gets inside `angular.json`, which makes the interesting question not whether you may put configuration there but whether you should"
sidebar_label: "02f · Living with extension keys"
sidebar_position: 2.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the `project` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and the extension handling in
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The escape hatch works — and it is one of the narrowest extension points in any mainstream build
configuration.** [02e](02e-the-extension-escape-hatch.md) established the rule: a key of one to
three lowercase letters and a hyphen slips past `additionalProperties: false`. This page is about
what that constraint does to real repositories: the naming failures it produces, the collisions a
three-character namespace guarantees, and the case for keeping tool configuration out of the file
altogether.

## Why the prefixes are short

Every tool that extends `angular.json` has to fit inside `[a-z]{1,3}`, so the ecosystem converged on
two- and three-letter prefixes. That is a design constraint, not a style choice. **No source was
found stating the rationale for the three-letter limit**, so treat the pattern as a fact about the
format rather than as a principle with a documented argument behind it.

A well-behaved extension key looks like this:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "abc-deploy": { "bucket": "storefront-prod", "region": "eu-west-1" },
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "tsconfig.app.json" }
        }
      }
    }
  }
}
```

## The three-character namespace is not a namespace

`[a-z]{1,3}` gives 26 + 676 + 17,576 possible prefixes and no registry, no reservation mechanism and
no way to detect a clash except by reading the file. In practice a repository accumulates keys from
a monorepo tool, a deployment script, an internal generator and whatever a previous team added, all
competing for the same three characters.

Two habits make that survivable:

- **One key per tool, nested.** A tool that wants five settings takes one prefixed key holding an
  object, not five prefixed keys. A collision then costs one rename instead of five.
- **Point at a file rather than inlining.** The prefixed key holds a path; the configuration lives
  in a file that a formatter, a schema and a code review can all handle normally.

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "acm-tools": {
        "deploy": { "configFile": "deploy/storefront.json" },
        "coverage": { "lines": 80 }
      }
    }
  }
}
```

## The case against putting configuration here at all

`angular.json` is, in most repositories, the single most contended JSON file: it is edited by
schematics, rewritten by migrations, merged on every branch that adds a project, parsed as JSONC by
exactly one tool and as strict JSON by everything else ([01c](01c-the-file-is-jsonc-not-json.md)),
and validated by a schema that is closed by default. Adding unrelated configuration to it inherits
all of that, and buys discoverability that a well-named file at the repository root gets for free.

The hatch earns its place in one situation: configuration that is genuinely **per project** in a
multi-project workspace, where keeping it beside `root` and `targets` is the thing that makes it
correct. Even then, a path is usually a better value than an object.

## Gotchas

**★ Symptom: `mytool-config` is rejected and `nx-config` is not.** Cause: the count is on the letters
*before* the hyphen, not on the whole key — `mytool` is six letters. Fix: shorten the prefix, not the
rest of the name:

```json
{
  "projects": {
    "storefront": { "root": "", "projectType": "application", "myt-config": { "enabled": true } }
  }
}
```

**★ Symptom: `Nx-tags` or `NX-tags` is rejected while `nx-tags` is accepted.** Cause: the character
class is `[a-z]`, lowercase only. Fix:

```json
{
  "projects": {
    "storefront": { "root": "", "projectType": "application", "nx-tags": ["scope:shop"] }
  }
}
```

**★ Symptom: a large block of third-party configuration inside `angular.json` makes every review
noisy and every merge conflict worse.** Cause: the extension hatch makes it *possible* to keep tool
configuration in the workspace file, not advisable. Fix: keep a pointer in `angular.json` and the
configuration in its own file, where a formatter, a schema and a diff all behave normally:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "dep-config": { "configFile": "deploy/storefront.json" }
    }
  }
}
```

**Symptom: two tools want the same short prefix.** Cause: a three-character namespace is a small
space and nothing coordinates it. Fix: nest under one key per tool rather than spreading several
sibling keys, so a collision is a single rename:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "acm-tools": {
        "deploy": { "bucket": "storefront-prod" },
        "coverage": { "lines": 80 }
      }
    }
  }
}
```

**Symptom: an extension key survives a `ng generate` but its formatting and comments do not.**
Cause: the CLI rewrites `angular.json` during generation, and what happens to comments in a rewritten
region was not confirmed ([01c](01c-the-file-is-jsonc-not-json.md)). Fix: do not rely on comments
inside an extension block to explain it — the explanation belongs in the file the key points at:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "dep-config": { "configFile": "deploy/storefront.json" }
    }
  }
}
```

**Symptom: an internal tool reads its extension key from `projects.<name>` and finds nothing in a
workspace that uses `architect`.** Cause: nothing to do with extensions — the tool is walking the
project object correctly but a sibling lookup elsewhere assumed `targets`. Fix: read both names
wherever a script touches a project ([02d](02d-architect-or-targets.md)):

```js
const project = workspace.projects[projectName];
const settings = project['dep-config'] ?? {};
const targets = project.targets ?? project.architect ?? {};
```

**Symptom: an extension key was added to the workspace root because "it applies to everything".**
Cause: the top level has no `patternProperties` opening in the schema, so the key is schema-invalid
even though the reader accepts it ([02e](02e-the-extension-escape-hatch.md)). Fix: put it in each
project, or — better — in its own file, and reference that file from wherever the tool runs:

```json
{
  "version": 1,
  "projects": {
    "storefront": { "root": "", "projectType": "application", "dep-config": { "configFile": "deploy/storefront.json" } },
    "admin": { "root": "projects/admin", "projectType": "application", "dep-config": { "configFile": "deploy/admin.json" } }
  }
}
```

## Interview questions

**★ Would you put tool configuration in `angular.json` given that the hatch exists?**
Rarely. The hatch makes it legal, and legal is not the same as wise: the file is already the most
merge-conflicted JSON in an Angular repository, it is rewritten by schematics, it is parsed as JSONC
by exactly one tool and as JSON by everything else, and a three-character prefix is a very small
namespace. A key that points at a dedicated configuration file gets you the discoverability without
any of that, and it keeps `angular.json` a file about builds. The exception worth making is
genuinely per-project configuration in a multi-project workspace, where sitting beside `root` and
`targets` is what makes it correct.

**★ What is the failure mode of a badly named extension key, and why is it worse than an error?**
The reader emits a warning and carries on, so the build succeeds, the file loads, and the key is
simply classified as invalid. Nothing downstream that expects a valid extension will find it. The
symptom therefore appears in the *tool* — a deployment that used default settings, a coverage gate
that never ran — rather than at the point where the mistake was made, and the warning that would
have explained it scrolled past several hundred lines earlier.

**How would you design a tool's use of `angular.json` knowing the constraint?**
One prefixed key per tool, holding an object, containing as little as possible — ideally a path to a
real configuration file. That survives a prefix collision with a single rename, keeps the workspace
file small enough to review, avoids putting a second schema's worth of structure inside a file
validated by Angular's schema, and means the tool's own configuration can be linted and formatted by
tooling that understands it.

**Where does the three-letter limit come from?**
The `patternProperties` entry on the project definition, `^[a-z]{1,3}-.*`, and the identical regular
expression in the workspace reader. **No source was found stating why three**, so the honest answer
is that it is a fact about the format rather than a documented principle — the observable
consequence being that every tool in the ecosystem picks a two- or three-character prefix because
nothing longer is accepted.

**A repository has six prefixed keys across its projects. Is that a problem?**
Not by itself, but it is a signal worth reading. Six keys means six tools have decided the workspace
file is the right home for their settings, none of them can be validated by Angular's schema, and
all of them are exposed to schematic rewrites and to the JSONC-versus-JSON split. The question to
ask of each is whether it needs to be *per project*; the ones that do belong there, and the ones
that do not are usually a file in disguise.

---

← Prev: [The extension escape hatch](02e-the-extension-escape-hatch.md) · Index: [Topic index](README.md) · Next → [Targets and builders](03-targets-and-builders.md)
