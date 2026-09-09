---
title: "Every builder option schema is closed, so the two spelling mistakes — a typo and a command-line `dash-case` name — are hard failures rather than keys the CLI politely ignores"
sidebar_label: "15e · Closed schemas and spelling"
sidebar_position: 15.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` and `dev-server` option
> schemas under
> [`packages/angular/build/src/builders/`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`, and the `camelCase` rule in
> [angular.dev — Configuring builder targets](https://angular.dev/reference/configs/workspace-config#configuring-builder-targets).
> Documentation-validated; **no sandbox run** — no example failure message is reproduced; how to read
> one is [15d](15d-option-validation-failures.md).
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`additionalProperties: false` appears on every builder's option schema, which means the CLI has no
concept of an unrecognised option.** Anything the schema does not declare is a violation — so the two
mistakes that are purely about *spelling* stop a build rather than being quietly skipped. That is
the right trade, and it is worth being able to argue for: the alternative is a typo that lives in a
production configuration for a year, doing nothing, with no symptom except output that is subtly not
what anyone intended.

## The schemas are closed, and there is only one exception in the whole file

The `application` builder's schema declares it at the top level, alongside exactly one required
option:

```json
{ "title": "Application schema for Build Facade.", "required": ["tsConfig"], "additionalProperties": false }
```

The dev-server schema does the same over its own, much smaller property set. So does the workspace
schema, at its top level and inside the project object. There is exactly one place in the entire
configuration surface where unknown keys are welcome, and it is the `schematics` map —
[13h](13h-schematics-and-generator-defaults.md).

## 1 · A misspelled option is a hard failure, not a no-op

`"outputHasing"` does not quietly fall back to the default. It is an additional property, and the
schema forbids additional properties.

```json
{
  "configurations": {
    "production": { "outputHashing": "all" }
  }
}
```

This is the good outcome, and it is worth defending in a code review argument. A configuration format
that ignored unknown keys would let a typo sit in a production configuration for a year, doing
nothing, with the only symptom being output that is subtly not what anyone intended.

## 2 · `dash-case` is the command-line spelling, not the file's

The documentation states it explicitly:

> *"HELPFUL: All options in the configuration file must use `camelCase`, rather than `dash-case` as
> used on the command line."*

`--output-hashing all` on the command line is `"outputHashing": "all"` in the file — and because the
schema is closed, the dash-case spelling is rejected rather than ignored. This is the single most
common way an option copied out of a terminal history fails.

```json
{ "options": { "outputHashing": "none", "sourceMap": false, "extractLicenses": true } }
```

## The two spellings, side by side

The command line accepts a hyphenated form; the file's keys must be the schema's property names
exactly. The documentation states the rule without explaining the mechanism, and the observable
consequence is all you need:

| On the command line | In `angular.json` |
|---|---|
| `--output-hashing all` | `"outputHashing": "all"` |
| `--source-map` | `"sourceMap": true` |
| `--extract-licenses false` | `"extractLicenses": false` |
| `--delete-output-path false` | `"deleteOutputPath": false` |
| `--named-chunks` | `"namedChunks": true` |
| `--base-href /app/` | `"baseHref": "/app/"` |
| `--service-worker ngsw-config.json` | `"serviceWorker": "ngsw-config.json"` |

The conversion is mechanical, which is exactly why it is easy to skip when pasting from a terminal
history into a configuration.

The other two cases are not spelling at all — an option that belonged to the builder you migrated
away from, and a valid option on the wrong target — and they are
[15f](15f-migrated-and-misplaced-options.md).

## Gotchas

**★ Symptom: a misspelled option name fails the build instead of being ignored.** Cause: every
builder option schema is `additionalProperties: false`; there is no tolerated-unknown-key behaviour
anywhere in the option surface. Fix: correct the spelling — the parenthesised name in the message is
the only place the offending key appears:

```json
{ "configurations": { "production": { "outputHashing": "all" } } }
```

**★ Symptom: an option copied from a command line — `"output-hashing"`, `"source-map"` — is
rejected.** Cause: the configuration file uses `camelCase`; `dash-case` is the command-line form
only, and the closed schema turns the wrong spelling into a failure rather than a silent miss. Fix:

```json
{ "options": { "outputHashing": "none", "sourceMap": false } }
```

**★ Symptom: `"outputhashing"` — right letters, wrong casing — is rejected.** Cause: JSON keys are
case-sensitive and the schema declares exactly one spelling; there is no case-insensitive matching
anywhere in the option surface. Fix: match the schema's casing character for character:

```json
{ "options": { "outputHashing": "all" } }
```

**Symptom: an option nested one level too deep — inside a second `options` object — is rejected as an
unknown key.** Cause: the validated object is the *contents* of `options` merged with the applied
configurations; a nested `options` key is just another property, and an unknown one. Fix: flatten it:

```json
{
  "options": {
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json",
    "outputHashing": "all"
  }
}
```

**Symptom: a key with a stray trailing space is rejected and looks identical to the correct one in a
diff.** Cause: JSON keys are exact strings, and whitespace inside the quotes is part of the name. Fix:
re-type the key rather than editing around it — and note that the parenthesised name in the failure
message will show the space if you look closely:

```json
{ "options": { "sourceMap": true } }
```

**Symptom: an option you know exists is rejected, and you conclude the schema is out of date.**
Cause: far more often, the option exists on a *different* builder's schema — the surface is per
builder, not per CLI version. Fix: check which builder the target names before doubting the schema:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**Symptom: a value that is `"true"` in quotes is rejected where `true` would be accepted.** Cause:
the schema types booleans as booleans; a quoted value is a string, and closed schemas do not coerce.
Fix: drop the quotes — and note this is a *type* failure, so the message will carry no parenthesised
key:

```json
{ "options": { "sourceMap": true, "extractLicenses": true, "deleteOutputPath": true } }
```

**Symptom: you add an option to `options` to "have it everywhere" and a configuration silently stops
respecting it.** Cause: this is not a validation failure at all — a configuration that names the same
key replaces its value wholesale, arrays and nested objects included. Fix: repeat what you need in
the configuration; the merge rule is [04b](04b-the-merge-is-shallow.md):

```json
{
  "options": { "optimization": { "scripts": true, "styles": true } },
  "configurations": {
    "development": { "optimization": false }
  }
}
```

## Interview questions

**★ Why is a misspelled builder option a hard failure rather than being ignored?**
Because every builder's option schema declares `additionalProperties: false`, so an unrecognised key
is a schema violation rather than an extra. That is a deliberate and good design: a configuration
format that tolerated unknown keys would let `outputHasing` sit in a production configuration
indefinitely, doing nothing, and the only symptom would be output that is subtly not what anyone
intended. The cost is that every typo stops a build; the benefit is that no typo survives one.

**★ Why is `dash-case` accepted on the command line and rejected in the file?**
Because they are two different consumers of the same option set. The documentation states the rule
directly — all options in the configuration file must use `camelCase` rather than the `dash-case`
used on the command line — and what is observable is that the file's keys must be the schema's
property names exactly, with no translation step in between. The practical consequence is worse than
it sounds: because the schema is closed, the hyphenated spelling is not merely unrecognised, it is a
hard failure, so an option pasted out of a terminal history stops the build rather than silently
doing nothing.

**What would the cost be if Angular ignored unknown options instead?**
A class of bug that is invisible until it matters. A misspelled `outputHashing` in a production
configuration would leave hashing off, and nothing would say so — the build would succeed, the output
would be valid, and the only symptom would be stale assets in browsers weeks later. The same applies
to `budgets`, `optimization` and `fileReplacements`: every one of them fails *safe-looking* when
ignored. Closing the schema converts all of those into an immediate, specific, one-line failure, which
is a strictly better trade even though it means a typo stops a build.

**Why do people expect Angular to ignore an unknown option?**
Because most configuration formats they have used do. A `package.json` tolerates unknown top-level
keys, most linters ignore settings they do not recognise, and environment variables silently do
nothing when misspelled. That prior is what makes the failure feel like a bug rather than a feature.
The useful reframing is that `angular.json` is not a bag of settings — it is a typed input to a
specific function, validated against that function's declared parameter list, and the CLI knows
exactly which parameters exist. Once the file is understood as a call rather than as a document,
rejecting an unknown argument stops being surprising.

**Is there anywhere in `angular.json` where an unknown key is accepted?**
One place: the `schematics` map, whose definition is `additionalProperties: true` because the schema
cannot know the names of third-party schematics. Everywhere else is closed — the top level, the
project object, the `cli` block and its two nested objects, and every builder's option schema. The
short-prefix extension pattern is the only other way to put an unrecognised name in the file legally,
and it applies to key *names* at the workspace and project level rather than to options. Knowing that
the option surface has no escape hatch at all is what makes "it must be being ignored" a hypothesis
you can rule out immediately.

{/* FOOTER */}
