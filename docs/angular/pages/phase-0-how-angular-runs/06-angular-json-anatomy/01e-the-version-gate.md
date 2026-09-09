---
title: "The workspace reader checks `version` before it looks at anything else and demands the number `1` — so four distinct messages tell you exactly which gate closed, and one of them prints a value that looks correct"
sidebar_label: "01e · The version gate"
sidebar_position: 1.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> and the `fileVersion` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the error strings below are
> transcribed from the reader's source, not captured from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Before the CLI reads a single project, target or builder, it puts the file through four gates in a
fixed order, and each gate throws a different sentence.** Learning those four sentences is worth
more than it sounds, because a version failure aborts the read entirely — every other problem in
the file is invisible until it passes. One of the four also prints an "expected" and a "found" value
that are visually identical, which sends people looking for a digit when the defect is a type. This
page is the whole gate, in order, with the schema's more permissive view of `version` set beside the
reader's stricter one.

## The schema's `version` and the reader's `version` are not the same rule

The schema types the key through a definition that permits a range:

```json
"fileVersion": {
  "type": "integer",
  "description": "File format version",
  "minimum": 1
}
```

Read literally, that admits any integer at or above 1 — the shape of a format that expects to be
revised. The reader implements this release instead, and this release accepts one value.

## The four gates, in the order they run

Transcribed from `reader.ts` at `v22.1.7`:

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

Four gates, four messages, and each one localises the problem precisely:

| Message | What it means |
|---|---|
| `Unable to read workspace file.` | the path resolved but the contents could not be read |
| `Invalid workspace file - expected JSON object.` | it parsed, but the top level is not an object — an array, a scalar, or an empty file |
| `Unknown format - version specifier not found.` | no `version` key at all |
| `Invalid format version detected - Expected:[ 1 ] Found: [ … ]` | a `version` that is not the number `1` |

🔴 **`version !== 1` is a strict comparison against the number one.** The string `"1"` fails it, and
so does `2`. The schema's `"minimum": 1` describes the format; the reader's `!== 1` is what runs.

⚠️ **The message for the string case is visually identical to a correct file.** JSON quoting does
not survive into the interpolated message, so `"version": "1"` produces a message that reads as
though `1` was both expected and found. If you are staring at that line convinced it is right,
check the type, not the digit.

## Why the ordering is worth memorising

The gate is sequential and it throws — it does not collect problems. So a file with a bad `version`
**and** a project missing `root` **and** a misspelled builder reports only the version error, and
each fix reveals the next problem one at a time. Two habits follow:

- **Fix top-down.** Read the message, decide which of the four gates it came from, and repair that
  layer before looking anywhere else. A project-level message means the version gate already passed.
- **Do not read "the file is valid" into a message about a later stage.** The reverse is true and
  useful: a message that names a project by name proves the top level is sound.

The minimum file that clears all four gates is two lines:

```json
{
  "version": 1
}
```

That is a legal workspace with no projects in it — which is exactly the state `ng new` leaves after
its workspace schematic runs and before its application schematic adds anything
([01d](01d-version-and-the-six-top-level-keys.md)).

## Gotchas

**★ Symptom: `Unknown format - version specifier not found.`** Cause: no `version` key. The common
route to this is deleting a neighbouring line — people cleaning out a stale `defaultProject` take
`version` with it, because the two used to sit adjacent. Fix: it is the one required key:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {}
}
```

**★ Symptom: `Invalid format version detected - Expected:[ 1 ] Found: [ 1 ]` — the same number
twice.** Cause: the value is the *string* `"1"`, and JSON quoting is invisible in the interpolated
message. The reader compares with `!==` against the number. Fix: unquote it:

```json
{
  "version": 1
}
```

**★ Symptom: `"version": 22` — or 17, or whatever major you are on — is rejected.** Cause:
`version` is the **file format** version, not the Angular version. It has been `1` for every
release in the modern CLI, and the reader hard-codes that. Fix:

```json
{
  "version": 1,
  "projects": {}
}
```

**★ Symptom: your editor reports `angular.json` as valid and `ng` refuses to read it.** Cause: the
editor validates against the schema, which permits any integer at or above 1; the reader compares
strictly against 1. A file with `"version": 2` satisfies the schema and fails the CLI. Fix: the
schema is the weaker authority here — write what the reader accepts:

```json
{
  "version": 1,
  "projects": {}
}
```

**Symptom: `Invalid workspace file - expected JSON object.`** Cause: the file parsed but its root is
not an object — most often a zero-byte file left by a failed write, or a file whose entire contents
were replaced by an array during a scripted edit. Fix: the root must be an object; the minimum
acceptable file is:

```json
{
  "version": 1
}
```

**Symptom: `Unable to read workspace file.` even though the file is right there.** Cause: the read
itself failed — permissions, a broken symlink, or a path that resolved to a directory. This is a
different failure from "no workspace found", which happens earlier, during the search
([01](01-the-file-the-cli-reads.md)). Fix: check the file is readable as a file:

```bash
test -r angular.json && head -c 64 angular.json
```

**Symptom: you fix one error in `angular.json` and immediately hit a different one.** Cause: the
gate throws rather than accumulating, so problems surface strictly in the order the reader
encounters them — file, shape, version present, version value, then projects. Fix: work down the
layers deliberately instead of re-reading the whole file each time. Start from the minimum that is
known to pass and add back:

```json
{
  "version": 1,
  "projects": {}
}
```

**Symptom: JSON5-style syntax in `angular.json` is rejected even though "comments work".** Cause:
the reader enables exactly two leniencies — `allowTrailingComma` and comments. Unquoted keys and
single-quoted strings are not among them, and JSONC is not JSON5. Fix: keys and strings stay
double-quoted; only comments and the trailing comma are extra:

```json
{
  // a comment is fine
  "version": 1,
  "projects": {},
}
```

**Symptom: a code generator or template writes `"version"` as the *last* key and someone reorders
the file "to fix it".** Cause: misdiagnosis — the reader looks the key up by name with
`findNodeAtLocation(ast, ['version'])`, so its position in the object is irrelevant. Fix: nothing
to reorder; if there is a version error, it is about presence or type:

```json
{
  "projects": {},
  "version": 1
}
```

**Symptom: a script that patches `angular.json` writes `"version": null` or drops the value.**
Cause: a merge or templating step producing a null. `null !== 1`, so it fails the fourth gate and
prints `Found: [ null ]`, which at least names the problem accurately. Fix: guard the write:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTree, getNodeValue } from 'jsonc-parser';

const workspace = getNodeValue(
  parseTree(readFileSync('angular.json', 'utf-8'), undefined, {
    allowTrailingComma: true,
    disallowComments: false,
  }),
);
workspace.version = 1;
writeFileSync('angular.json', JSON.stringify(workspace, null, 2));
```

## Interview questions

**★ What does `version` in `angular.json` refer to, and what values are legal?**
It is the **workspace file format** version, not the Angular version and not the CLI version. The
schema types it as an integer with `"minimum": 1`, which would permit any integer from 1 upward,
but the workspace reader at 22.1.7 does a strict `version !== 1` and throws for anything else. So
the only value that works today is the number `1`. Both facts are worth carrying: the schema
describes a format that anticipates future versions, and the implementation accepts exactly one.

**★ Why does `"version": "1"` produce a message that looks like it is complaining about a correct
value?**
The message interpolates the parsed value into a template that reads `Expected:[ 1 ] Found: [ … ]`,
and interpolating the string `"1"` yields the characters `1` with no quotes. The comparison that
failed was a strict `!==` against the number, so a real type mismatch becomes invisible in the
output. The diagnostic habit generalises well beyond Angular: when a message shows expected and
actual as identical, suspect the type rather than the value.

**★ Your editor says `angular.json` is valid and `ng build` will not read it. How do you reason
about that?**
By remembering that two different validators are in play and that they do not agree. The editor
checks the JSON Schema, which is permissive about `version` and describes the format in general; the
CLI runs a hand-written reader that is stricter and describes this release. Where they diverge, the
reader wins, because it is the thing that runs. The same divergence appears elsewhere in the file —
the schema forbids having both `architect` and `targets` while the reader tolerates it
([02d](02d-architect-or-targets.md)) — so "schema-valid" and "the CLI will accept it" are two
different claims throughout `angular.json`.

**In what order does the reader validate, and why does the order matter when you are debugging?**
Read the file, parse it and require an object at the root, require a `version` key, require that key
to equal 1 — and only then walk into `projects`. It throws on the first failure rather than
collecting them, so any later problem is completely masked until the earlier one is fixed. In
practice that means an error naming a project proves the top level is already sound, and an error
about `version` tells you nothing at all about the rest of the file. Fixing top-down, one gate at a
time, is faster than re-reading the file after each attempt.

**What is the smallest legal `angular.json`?**
`{"version": 1}`. `projects` is not required, `$schema` is not required, and `cli`, `schematics` and
`newProjectRoot` are all optional. That is not a trick answer — it is close to the state the CLI
itself creates, because `ng new` runs a workspace schematic that writes an essentially empty
workspace before a second schematic adds the application. Knowing the minimum is useful for
bisecting a broken file: start from it and add sections back until the error returns.

**Does the position of `version` in the object matter?**
No. The reader locates it by name with `findNodeAtLocation(ast, ['version'])` rather than by
position, so it can appear anywhere in the top-level object. This matters mostly as a negative
result: reordering keys is a popular but useless response to a version error, and the actual causes
are only ever that the key is missing or that its value is not the number `1`.

{/* FOOTER */}
