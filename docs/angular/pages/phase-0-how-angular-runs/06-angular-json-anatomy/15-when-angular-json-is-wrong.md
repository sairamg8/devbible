---
title: "Every `angular.json` failure comes from one of four layers, the layer is printed in the wording rather than in a label, and knowing which one spoke tells you what to fix before you have read the message twice"
sidebar_label: "15 · When it is wrong"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts),
> [`packages/angular_devkit/core/src/json/schema/registry.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/json/schema/registry.ts)
> and
> [`packages/angular/cli/src/command-builder/architect-command-module.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/command-builder/architect-command-module.ts),
> all at tag `v22.1.7`. Documentation-validated; **no sandbox run** — every message quoted on this
> page is transcribed from the source line that constructs it, never from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Four different pieces of code can complain about `angular.json`, and none of them says which one it
is.** The workspace reader parses the file; the command layer decides which project and target you
meant; Architect turns a builder string into a function; and a JSON Schema validator checks the
options against that builder's own schema. Each layer has its own vocabulary, and the vocabulary is
the only label you get. Learning to place a message in its layer is the single highest-leverage skill
for this file, because the layer tells you what to fix — and, just as usefully, tells you which
layers already succeeded.

## The four layers, in the order they run

| # | Layer | Source | What it can complain about | Where it is taught |
|---|---|---|---|---|
| 1 | **The workspace reader** | `reader.ts` | the file parses, `version` is right, projects have `root`, structural shapes | this page and [15b](15b-the-warnings-that-drop-keys.md) |
| 2 | **The command layer** | `architect-command-module.ts` | which project, which target, which configuration | [14b](14b-what-the-commands-do-with-it.md) |
| 3 | **Architect resolution** | `node-modules-architect-host.ts` | the project exists, the target exists, the builder string resolves | [03e](03e-the-error-ladder-of-an-invocation.md) |
| 4 | **Option schema validation** | `registry.ts` | every option name and value, against the builder's schema | [15d](15d-option-validation-failures.md) |

The numbering is the running order, and running order is the diagnosis. Layer 1 happens for **every**
command, before anything is chosen. Layers 2 and 3 happen once a command knows what it wants. Layer 4
happens last, immediately before a builder runs — which is why a schema validation failure proves
that your project, target, configuration and builder were all resolved correctly.

🔴 **The corollary is what makes this worth memorising: an error from a later layer is a certificate
for every earlier one.** If you are looking at `Cannot find builder "@angular/build:application".`,
there is no point checking `version`, `root` or your working directory. All three already worked.

## Layer 1 first: the reader either loads the file or it does not

The reader runs before anything else and has no notion of commands, projects you named, or builders.
Its messages therefore carry **no file and no line number** — it is reporting on a document it has
already parsed, not on a syntax error your editor would have shown you.

Five of its messages are thrown, and a thrown message means the read stopped. Verbatim, in the order
the checks run:

```ts
const raw = await host.readFile(path);
if (raw === undefined) {
  throw new Error('Unable to read workspace file.');
}

const ast = parseTree(raw, undefined, { allowTrailingComma: true, disallowComments: false });
if (ast?.type !== 'object' || !ast.children) {
  throw new Error('Invalid workspace file - expected JSON object.');
}

// Version check
const versionNode = findNodeAtLocation(ast, ['version']);
if (!versionNode) {
  throw new Error('Unknown format - version specifier not found.');
}
const version = versionNode.value;
if (version !== 1) {
  throw new Error(`Invalid format version detected - Expected:[ 1 ] Found: [ ${version} ]`);
}
```

and one more, from the project walk:

```ts
const projectNodeValue = getNodeValue(projectNode);
if (!('root' in projectNodeValue)) {
  throw new Error(`Project "${projectName}" is missing a required property "root".`);
}
```

| Message | What it means |
|---|---|
| `Unable to read workspace file.` | the file could not be read at all |
| `Invalid workspace file - expected JSON object.` | the top level is not an object, or the JSONC would not parse |
| `Unknown format - version specifier not found.` | there is no `version` key |
| `Invalid format version detected - Expected:[ 1 ] Found: [ <v> ]` | `version` is present and is not the integer `1` |
| `Project "<name>" is missing a required property "root".` | a project object has no `root` |

Two details in that set repay attention, and both have their own page. The version check is
`!== 1` on the parsed value, so the string `"1"` fails with a message that looks like it is
complaining about the number `1` — [01e](01e-the-version-gate.md). And `root` is checked by the
reader while `projectType` is required only by the **schema**, so the two "required" properties fail
at different stages and only one of them stops the read —
[02](02-projects-and-the-project-object.md).

## The other half of layer 1 does not stop anything

The messages above are the loud half. The reader also reports problems and then **carries on**, which
is where the genuinely confusing failures come from — a key that was quietly dropped, and an error
half a layer away that names something else entirely.

That is [15b](15b-the-warnings-that-drop-keys.md), and it is the most useful page in this chunk.

## Vocabulary, layer by layer

Because the layer is not labelled, the words are the tell:

| If the message mentions | The layer is | The thing to check |
|---|---|---|
| a **data path** in quotes, or `Schema validation failed` | 4 — option validation | an option name or value; check `camelCase` |
| a **builder** string, or a package name | 3 — Architect | the `builder` value, and whether the package is installed |
| a **configuration** by name | 3 — Architect, target lookup | spelling, and `defaultConfiguration` |
| *"determine project"* | 2 — the command layer | the project you passed, or your working directory |
| `workspace file`, `format version`, `required property "root"` | 1 — the reader | the file's structure |
| nothing recognisable, and the behaviour is simply wrong | none | a dropped key ([15b](15b-the-warnings-that-drop-keys.md)) or a shallow merge ([04b](04b-the-merge-is-shallow.md)) |

The full walk-through of using this table under pressure — including the case where there is no
message at all — is [15g](15g-the-diagnostic-recipe.md).

## Gotchas

**★ Symptom: an `angular.json` error with no file name and no line number, and your editor shows no
problem.** Cause: it is a layer 1 message. The reader has already parsed the document successfully
enough to walk it and is complaining about its *content*, not its syntax — so there is no position to
report. Fix: read the message for which structural rule it names, and check that key:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": {
    "my-app": { "root": "", "projectType": "application" }
  }
}
```

**★ Symptom: you are checking `version` and `root` because a build failed, and the message was about
a builder.** Cause: layers run in order and each error is a certificate for the ones before it — an
Architect message proves the reader loaded the file and the command layer resolved a project and
target. Fix: stop at the layer that spoke; here that means the `builder` string and the package it
names:

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

**★ Symptom: the same underlying mistake produces different messages on different commands.** Cause:
which layer notices depends on how far the command got. A malformed `serve` target is invisible to
`ng build`, because layer 2 never selects it and layer 4 never validates it. Fix: reproduce with the
command that actually uses the target before concluding anything about the file:

```bash
ng run web:serve:development
```

**★ Symptom: the file "validates in the editor" but the CLI rejects it.** Cause: the editor validates
against the JSON Schema, which is layer 4's vocabulary applied statically; the reader is separate
code with its own rules and its own messages. The two disagree in both directions — the schema
requires `projectType`, which the reader does not check, and the reader enforces `version !== 1`
more strictly than the schema's `minimum: 1`. Fix: treat editor validation as a first pass, not as
proof:

```json
{
  "version": 1,
  "projects": {
    "my-app": { "root": "", "projectType": "application" }
  }
}
```

**Symptom: an error mentions a project you did not name on the command line.** Cause: layer 1 walks
*every* project in the file, so a malformed project you never build still stops every command. Fix:
fix the broken project — you cannot scope the reader to the project you care about:

```json
{
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: you added a comment to `angular.json` and a CI step broke while `ng build` kept working.**
Cause: the reader parses JSONC — `parseTree(raw, undefined, { allowTrailingComma: true,
disallowComments: false })` — so comments and trailing commas are legal for the CLI and illegal for
almost every other JSON consumer. Fix: know which tools read the file, and see
[01c](01c-the-file-is-jsonc-not-json.md):

```json
{
  "version": 1,
  // Legal for the Angular CLI; not legal for a plain JSON parser.
  "projects": {}
}
```

**Symptom: a failure appears only in CI, with no message that names `angular.json` at all.** Cause:
not every wrong-configuration outcome produces a message — a dropped key or a shallow merge changes
behaviour silently. Fix: work the last two rows of the vocabulary table rather than searching for an
error that does not exist; the procedure is [15g](15g-the-diagnostic-recipe.md).

## Interview questions

**★ Four different components can reject `angular.json`. Name them and say what each can complain
about.**
The workspace reader parses the file and checks its structure — that it is an object, that `version`
is the integer `1`, that each project has a `root`. The command layer decides which project and
target a command means, and complains when it cannot. Architect turns `package:name` into a builder
function and complains when the project, the target, the package or the builder entry does not
exist. Finally the JSON Schema validator checks the assembled options against that builder's own
schema. They run in that order, so an error from a later layer proves every earlier one succeeded.

**★ Why does knowing which layer produced a message matter more than the message itself?**
Because it converts an error into a bisection. The layers run in a fixed order, so a message from
layer 4 means the file parsed, a project resolved, a target resolved and a builder loaded — four
things you no longer have to check. It also tells you *where* to look: an option name for layer 4, a
builder string for layer 3, a project name or working directory for layer 2, and structural keys for
layer 1. Without the layer, every `angular.json` failure looks like "something in this large file is
wrong", which is how people end up rewriting configuration that was never involved.

**★ Why do the reader's messages carry no file name or line number?**
Because it is not a parser error. By the time those messages are produced, the JSONC has already been
parsed into a tree successfully and the reader is walking it, so what is failing is a rule about
content — a missing key, a wrong value type, a version that is not `1`. There is no position to
report because nothing is malformed at the syntax level. The practical consequence is that these
messages look unlike every other error a developer sees in a build, which is exactly why they get
misfiled as "something is wrong with my JSON" when the JSON is fine.

**A colleague says their `angular.json` "validates", so the problem must be elsewhere. What is wrong
with that reasoning?**
That editor validation is only one of the four layers, applied statically. The schema and the reader
are separate code with different rules, and they disagree in both directions: the schema requires
`projectType` while the reader only requires `root`, and the reader rejects any `version` that is not
exactly the integer `1` where the schema merely says it is an integer of at least `1`. A file can
therefore pass the schema and fail the reader, or vice versa. Editor validation is a cheap first
pass and it catches the largest class of mistakes — misspelled option names — but it is not proof.

**Why can the same mistake in `angular.json` produce different messages depending on the command?**
Because layers only run for what a command actually touches. A malformed `serve` target never reaches
Architect or the option validator during `ng build`, because the command layer selects the `build`
target and nothing looks at `serve`. Layer 1 is the exception — it walks the whole file for every
command, which is why a project you never build can still stop a command dead. When reproducing a
configuration bug, run the command that actually exercises the target, or you will conclude that a
broken target is fine.

**Which failures produce no message at all, and how do you find those?**
Two families. A key the reader dropped after reporting a non-fatal problem — the target that was
written as a string, the property that was not a string — where the eventual failure names something
else entirely or nothing at all. And the shallow merge between `options` and a configuration, where
a configuration that names a key replaces its whole value and the build is perfectly valid but not
what you intended. Neither is an error; both are behaviour. The way to find them is to work backwards
from the effective options rather than forwards from a message, which is the last step of the
recipe on [15g](15g-the-diagnostic-recipe.md).

---

← Prev: [Name the project](14e-name-the-project.md) · Index: [Topic index](README.md) · Next → [Warnings that drop keys](15b-the-warnings-that-drop-keys.md)
