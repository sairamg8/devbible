---
title: "`architect` and `targets` are one field under two names — the schema declares an exclusive-or between them, the reader accepts either and quietly remembers which you used, and the two rules disagree about a file that has both"
sidebar_label: "02d · `architect` or `targets`"
sidebar_position: 2.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the `project` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> both at tag `v22.1.7`, with the `angular.json` example published on
> [angular.dev/tools/cli/serve](https://angular.dev/tools/cli/serve).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two names, one field, and a rule that only one of the two validators enforces.** Older workspaces
call the map of buildable things `architect`; newer ones call it `targets`. They are read by the
same branch of the same function and behave identically, which is why nobody notices the split — but
the schema declares them mutually exclusive, and the reader does not. That gap is small, easy to
create with a copy-pasted documentation snippet, and produces a file whose behaviour depends on JSON
key order.

## The schema declares an exclusive-or

Both names appear as ordinary properties of the project object:

```json
"architect": { "type": "object", "additionalProperties": { "$ref": "#/definitions/project/definitions/target" } },
"targets":   { "type": "object", "additionalProperties": { "$ref": "#/definitions/project/definitions/target" } }
```

and then an `anyOf` narrows the combination:

```json
"anyOf": [
  { "required": ["architect"], "not": { "required": ["targets"] } },
  { "required": ["targets"],   "not": { "required": ["architect"] } },
  { "not": { "required": ["targets", "architect"] } }
]
```

Read the three branches as a truth table: `architect` without `targets`, `targets` without
`architect`, or neither. **There is no branch permitting both** — this is a legal XOR expressed in
JSON Schema. Note also that the third branch makes a project with no targets at all perfectly valid.

Both names point at the same `target` definition, so whichever you use, every target inside is
validated identically.

## The reader treats them as one case and remembers which you wrote

```ts
case 'targets':
case 'architect': {
  const nodes = findNodeAtLocation(projectNode, [name]);
  if (!isJsonObject(value) || !nodes) {
    context.error(`Invalid "${name}" field found; expected an object.`, value);
    break;
  }
  hasTargets = true;
  targets = parseTargetsObject(projectName, nodes, context);
  jsonMetadata.hasLegacyTargetsName = name === 'architect';
  break;
}
```
— [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts) at `v22.1.7`

Three things fall out of those nine lines:

1. 🔴 **`architect` is the legacy name.** The flag the reader sets is literally called
   `hasLegacyTargetsName`. That is the maintainers' own classification, not an inference.
2. **The name you used is preserved on write-back.** Because the reader records which key it found,
   a command that rewrites `angular.json` — `ng generate library`, a migration — keeps your file
   speaking the name it already spoke. It will not be silently modernised, and it will not be
   silently regressed.
3. **The error for a wrong type is a `context.error` naming the key you used**:
   `Invalid "targets" field found; expected an object.` or the same sentence with `architect`. The
   message quotes back your own vocabulary, which is a small but useful diagnostic.

## What happens when both are present

The `case` block above reassigns `targets` for whichever key it meets, so **the reader would take
whichever appears later in the object**, and the earlier one is discarded without comment.

🔴 **The schema forbids both; the workspace reader would take whichever appears later. Whether the
CLI validates `angular.json` against its schema on every command was not confirmed — keep exactly
one key.**

That sentence is the whole safe statement, and it is worth being precise about why each half
matters. Your editor validates against the schema and will flag the file. The CLI's reader does not
enforce the XOR, so the command may well run. And *which* key is "later" is a property of byte order
in a JSON file — nothing in JSON, in the schema, or in any formatter guarantees it stays where you
left it. A configuration whose behaviour depends on key order is not a configuration you can reason
about.

## Which name to write

Use **`targets`** in anything new: it is the current name and the legacy flag names the other one.
Converting an existing file is a pure rename of one key — both names resolve to the same definition
and the same parse — but it is not free, because anything *outside* the CLI that reads
`angular.json` by key name breaks:

```js
// Reads either shape. Use this in any script that touches a workspace file.
const project = workspace.projects[projectName];
const targets = project.targets ?? project.architect ?? {};
```

⚠️ **angular.dev's own examples still use `architect`** — the `ng serve` page publishes an
`angular.json` snippet with an `"architect"` block in it. Copying such a snippet into a file that
uses `targets` is the most common way to end up with both.

## Gotchas

**★ Symptom: your editor flags `architect` and `targets` both being present, and `ng build` works
anyway.** Cause: the schema's `anyOf` forbids the combination; the reader's shared `case` does not.
Fix: keep exactly one — and do not decide by which one "seems to be working", because that is
decided by key order:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
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

**★ Symptom: a script that reads `angular.json` returns nothing for some projects.** Cause: it looks
up `.architect` (or `.targets`) by name, and the workspace uses the other one. Fix: read either,
always:

```js
import { readFileSync } from 'node:fs';
import { parseTree, getNodeValue } from 'jsonc-parser';

const workspace = getNodeValue(
  parseTree(readFileSync('angular.json', 'utf-8'), undefined, {
    allowTrailingComma: true,
    disallowComments: false,
  }),
);

for (const [name, project] of Object.entries(workspace.projects ?? {})) {
  const targets = project.targets ?? project.architect ?? {};
  process.stdout.write(`${name}: ${Object.keys(targets).join(', ')}\n`);
}
```

**★ Symptom: you believe `ng generate` rewrote `targets` to `architect`, or the reverse.** Cause: it
did not — the reader records `hasLegacyTargetsName` precisely so the name survives a write-back. If
the key changed, something other than the CLI edited the file: a codemod, a formatter with a
transform, or a merge that took the other side. Fix: find the real editor of the file in the history
rather than working around the CLI:

```bash
git log -p --follow -- angular.json
```

**★ Symptom: pasting a snippet from the documentation adds a second targets map.** Cause:
angular.dev's `ng serve` example uses `"architect"`, and a workspace generated recently uses
`"targets"`. Fix: translate the snippet as you paste it — the inner content is identical, only the
outer key changes:

```json
{
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "targets": {
        "serve": { "builder": "@angular/build:dev-server" }
      }
    }
  }
}
```

**Symptom: `Invalid "targets" field found; expected an object.`** Cause: the value is an array or a
string — most often an array, because "a list of targets" is the intuitive shape and the real one is
a map keyed by target name. Fix:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "targets": {
        "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } },
        "serve": { "builder": "@angular/build:dev-server" }
      }
    }
  }
}
```

**Symptom: a project with no `targets` at all is accepted, then every command against it fails.**
Cause: the schema's third `anyOf` branch explicitly permits a project with neither key, so a project
can exist purely as a named directory. It is valid and unbuildable. Fix: give it at least the target
the command you are running needs:

```json
{
  "projects": {
    "ui-kit": {
      "root": "projects/ui-kit",
      "projectType": "library",
      "targets": {
        "build": {
          "builder": "@angular/build:ng-packagr",
          "options": { "project": "projects/ui-kit/ng-package.json" }
        }
      }
    }
  }
}
```

**Symptom: a merge conflict resolution left both blocks in the file and nobody noticed for weeks.**
Cause: the CLI does not complain, and the discarded block is the *earlier* one, so the half that
keeps working is whichever the merge happened to put last. Fix: resolve to one key and add the check
to whatever validates the workspace in CI:

```js
for (const [name, project] of Object.entries(workspace.projects ?? {})) {
  if (project.targets && project.architect) {
    throw new Error(`Project "${name}" declares both "targets" and "architect"`);
  }
}
```

**Symptom: a formatter or a code generator reorders the keys of a project and the build changes
behaviour.** Cause: with both keys present, the effective target map is decided by which appears
later, and key order is not guaranteed by anything. Fix: there is no ordering to stabilise — remove
the duplicate key, which is the only state in which order is irrelevant.

## Interview questions

**★ What is the difference between `architect` and `targets` in `angular.json`?**
Nothing functional. They are two names for the same field, handled by a single shared `case` in the
workspace reader and pointing at the same `target` definition in the schema. `architect` is the
legacy name — the reader sets a flag called `hasLegacyTargetsName` when it sees it — and `targets`
is the current one. The one real difference is that the reader remembers which name your file used
and preserves it when the CLI writes the file back, so a workspace does not get silently modernised
by an unrelated `ng generate`.

**★ What happens if a project declares both `architect` and `targets`?**
The schema forbids it: the project definition carries an `anyOf` with three branches — one key, the
other key, or neither — and no branch admits both. The reader is more permissive; its shared `case`
simply reassigns the parsed targets for whichever key it encounters, so it would take whichever
appears later in the object and drop the earlier one. Whether the CLI validates `angular.json`
against its schema on every command was not confirmed, so the honest answer is that the two rules
disagree and the outcome depends on byte order in the file. Keep exactly one key.

**★ Should an existing workspace be converted from `architect` to `targets`?**
It is safe from the CLI's point of view — the two names parse identically, so the change is a pure
rename — but it is not free outside the CLI. Any script, CI step, code generator or internal tool
that reads `angular.json` by key name will stop finding anything, and the failure is usually silent
(an empty target list rather than an error). If you convert, convert the tooling in the same change,
and prefer `project.targets ?? project.architect` in anything that has to read both shapes.

**Is a project with no targets valid?**
Yes, and it is useless. The third branch of the schema's `anyOf` explicitly permits a project with
neither `targets` nor `architect`, so a project can consist of nothing but `root` and `projectType`.
It loads, appears in the workspace, and fails every command run against it — with a message about a
missing target rather than about an empty project. That is worth knowing when auditing a large
workspace: presence in `projects` is not evidence that anything can be built.

**Why does the CLI bother preserving the legacy key name instead of normalising it?**
Because rewriting a key the user did not ask to have rewritten produces surprising diffs in files
that people review. The reader captures `hasLegacyTargetsName` at parse time so that a write-back
after `ng generate library` — which has to add a project, not restructure existing ones — leaves the
rest of the file recognisable. It is a small decision with a large effect on trust: a command that
adds a library and also renames a key in four other projects looks like a bug, whether or not it is.

**How would you detect this problem across a large monorepo?**
Read every project with a JSONC-aware parser and assert that at most one of the two keys is present,
as a CI check rather than a review convention. The reason to automate it is that the failure mode is
invisible: the CLI does not warn, the effective configuration is whichever block came last, and a
formatter or a merge can flip that at any time without touching a single option value.

{/* FOOTER */}
