---
title: "Not every non-fatal message from the reader means something was dropped — two of them complain about a value's type and a key's name while keeping both, and the way to tell them apart is what the branch does after it reports"
sidebar_label: "15c · Complaints, not deletions"
sidebar_position: 15.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `prefix`/`root`/`sourceRoot` case and the
> extension-name checks in
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> at tag `v22.1.7`, and `findProjectByPath` in
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts).
> 🔴 One claim is explicitly **not** made below — what the reader stores for a non-string `root` was
> not determined from the source read here, and the page says so instead of guessing.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[15b](15b-the-warnings-that-drop-keys.md) is about the reader's messages that delete something.
This page is the ones that do not — and confusing the two costs a debugging session in each
direction.** Reading a name warning as data loss sends you hunting for a key that is still there.
Reading a skip message as a mere style complaint leaves you staring at a target the CLI can no longer
see. The distinction is not in the wording and there is no severity label; it is in what the source
branch does after it reports.

## The decision procedure

For any non-fatal message from the reader, ask one question: **did the branch stop reading that
key?**

| Message | Branch behaviour | Was anything lost? |
|---|---|---|
| `Invalid "<targets\|architect>" field found; expected an object.` | `context.error` then `break` | 🔴 yes — every target in that project |
| `Invalid "projects" field found; expected an object.` | same wording, one level up | 🔴 yes — the whole projects map |
| `Skipping invalid project value; expected an object.` | states it in the message | 🔴 yes — that project |
| `Skipping invalid target value; expected an object.` | states it in the message | 🔴 yes — that target |
| `Project property "<name>" should be a string.` | `context.warn`, no break shown | ⚠️ a complaint about a **type** |
| `Workspace extension with invalid name (<name>) found.` | `context.warn`, no break shown | ⚠️ a complaint about a **name** |
| `Project '<p>' contains extension with invalid name (<name>).` | `context.warn`, no break shown | ⚠️ a complaint about a **name** |

The bottom three are this page. Their common property: they tell you the CLI is unhappy with
something you wrote, without telling you the CLI removed it.

## A wrong type on `prefix`, `root` or `sourceRoot`

One case handles all three, and it warns rather than throwing:

```ts
case 'prefix':
case 'root':
case 'sourceRoot':
  if (typeof value !== 'string') {
    context.warn(`Project property "${name}" should be a string.`, value);
  }
```

🔴 **What the reader stores for a non-string value here was not determined from the source read for
this page**, so this page does not claim the value is dropped, replaced or coerced. What *is*
determinable is the downstream consequence of each property, and that is what you can actually act
on:

| Property | Who consumes it | What a non-string value costs you |
|---|---|---|
| `root` | project resolution, and every relative path in the project | resolution matches the cwd against `root` **as a path**, so a non-string cannot match — the project becomes unselectable by working directory ([14](14-multi-project-workspaces.md)) |
| `sourceRoot` | schematics, when placing generated files | generation loses its anchor for this project |
| `prefix` | `ng generate`, when building selectors | generated selectors lose the project's prefix ([02b](02b-root-sourceroot-and-prefix.md)) |

The `root` row is the one that produces a genuinely baffling symptom. The build still works if you
name the project, generation still works if you name the project, and only *implicit* selection
breaks — so the project appears to exist except when you rely on standing in its directory.

```json
{
  "projects": {
    "web":   { "root": "",               "sourceRoot": "src",               "prefix": "app" },
    "admin": { "root": "projects/admin", "sourceRoot": "projects/admin/src", "prefix": "adm" }
  }
}
```

⚠️ Note the first row: the initial application's correct `root` is the **empty string**, which is a
string. Deleting the key entirely is a different failure — it is one of the reader's *thrown* errors,
`Project "<name>" is missing a required property "root".`

## An unrecognised key name

The reader treats any top-level or project-level key it does not parse structurally as an
*extension*, and it warns when the name is neither one it knows nor one matching a short-prefix
pattern:

```ts
if (!context.unprefixedWorkspaceExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
  context.warn(`Workspace extension with invalid name (${name}) found.`, name);
}
```

and the project-level twin produces `Project '<p>' contains extension with invalid name (<name>).`

Both are complaints about the **name**, not about the value. The rule is one to three lowercase
letters, a hyphen, then anything — the reasoning behind it and how to live with it are
[02e](02e-the-extension-escape-hatch.md) and [02f](02f-living-with-extension-keys.md).

The practical reading of these two messages is *"no Angular tool will use this key"*, not *"this key
was removed"*. And note the asymmetry with the schema: the schema's `additionalProperties: false`
would reject an unknown top-level name outright, while the reader merely warns — so an editor and
the CLI can disagree about the same key, in the direction of the editor being stricter.

```json
{
  "version": 1,
  "mt-config": { "kept, and the name passes the pattern": true },
  "projects": {}
}
```

## Why the distinction earns its own page

Because the two classes send you to opposite places.

- **Treating a deletion as a complaint** leaves you re-reading a target that the CLI cannot see, and
  every check you run — the file parses, the key is present, the editor is quiet — confirms the wrong
  conclusion.
- **Treating a complaint as a deletion** sends you looking for what was removed when nothing was, and
  the usual outcome is a rewrite of a perfectly good extension key, or a superstition that unknown
  keys are stripped.

The classification is cheap once you know the question to ask: *did the branch stop reading that
key?* Messages starting `Skipping` and the two `Invalid "<field>" field found` messages did.
Everything else did not.

## Gotchas

**★ Symptom: a project never resolves from its own directory, and there is a `Project property "root"
should be a string.` warning.** Cause: `root` is not a string, and resolution matches the working
directory against it as a path — a non-string cannot match. Fix: quote it, remembering that the
initial application's correct value is the empty string:

```json
{
  "projects": {
    "web":   { "root": "",               "projectType": "application" },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: a `Workspace extension with invalid name (myTool) found.` warning, and you start looking
for what was dropped.** Cause: nothing was — the message is about the *name* failing the
`^[a-z]{1,3}-.*` rule, not about the value being discarded. Fix: rename to a short hyphenated prefix
if you want the warning gone, or leave it and accept the noise:

```json
{
  "version": 1,
  "mt-config": { "anything": "kept, and no warning about the name" },
  "projects": {}
}
```

**★ Symptom: your editor rejects a top-level key that the CLI merely warns about.** Cause: the schema
declares the top level `additionalProperties: false`, while the reader only warns when an extension
name fails the prefix pattern — two different rules from two different components. Fix: satisfy the
stricter one, because it is the one that will fail a validation step in CI:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "nx-plugin": { "accepted by both": true },
  "projects": {}
}
```

**Symptom: generated components stop carrying the project's selector prefix, with a `Project property
"prefix" should be a string.` warning.** Cause: `prefix` is consumed by `ng generate` when building
selectors, and a non-string value cannot be used as one. Fix:

```json
{
  "projects": {
    "admin": { "root": "projects/admin", "projectType": "application", "prefix": "adm" }
  }
}
```

**Symptom: generated files land in unexpected places for one project, with a warning about
`sourceRoot`.** Cause: `sourceRoot` is the anchor schematics use when placing files, and a non-string
value gives them nothing to anchor to. Fix: set it to the project's source directory, as a string:

```json
{
  "projects": {
    "admin": {
      "root": "projects/admin",
      "sourceRoot": "projects/admin/src",
      "projectType": "application"
    }
  }
}
```

**Symptom: a `root` of `null` produces a warning rather than the missing-property error you
expected.** Cause: the two checks are different — the thrown error tests whether the key is *present*
(`'root' in projectNodeValue`), while the warning tests its *type*. A `null` value is present, so it
passes the first check and fails the second. Fix: a string, always:

```json
{
  "projects": {
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: warnings accumulate in every CI run and nobody reads them any more.** Cause: name warnings
are permanent until the key is renamed, so a workspace with a long-lived third-party key trains
everyone to ignore the reader's output — which is where the *deleting* messages also appear. Fix:
clear the harmless ones so the harmful ones stay visible:

```json
{
  "version": 1,
  "nx-plugin": { "renamed from nxPlugin so the warning stops": true },
  "projects": {}
}
```

## Interview questions

**★ How do you tell whether a reader message means something was dropped?**
By asking what the branch did after it reported. A `throw` stops everything and nothing is lost
because nothing ran. A `context.error(...)` followed by `break` abandons the key it was reading —
that is the `targets`/`architect` case, and it costs every target in the project. A message that
begins with `Skipping` states the loss in its own wording. A bare `context.warn` about a property's
*type* or an extension's *name* is a complaint that leaves the file's contents alone. There is no
severity label in the output to rely on, so classifying by call site is the only way to be right.

**★ A non-string `root` produces a warning rather than an error. What actually breaks?**
Implicit project selection. Resolution matches the working directory against `root` as a path, so a
value that is not a string cannot match anything, and the project stops being selectable by cwd.
Everything that names the project explicitly keeps working, which is what makes the symptom
confusing — the project clearly exists, builds when named, and is invisible from its own directory.
What the reader *stores* for that property is not something to assert without reading the branch in
full; the downstream consequence is the part you can act on.

**★ Why can your editor reject a key that the CLI only warns about?**
Because they are enforcing different rules from different components. The schema declares the top
level `additionalProperties: false`, so an unknown name is a violation to anything validating against
it — which is what an editor does through `$schema`. The reader is separate code, and for an unknown
name it only checks the `^[a-z]{1,3}-.*` extension pattern and warns when it fails. The two disagree
in the direction of the editor being stricter, so satisfying the editor also satisfies the reader,
and that is the version to aim for since a schema validation step in CI will not be as forgiving.

**Why does deleting `root` produce a thrown error while setting it to `null` produces a warning?**
Because the two checks are asking different questions at different points. The thrown check is a
presence test — `'root' in projectNodeValue` — and fires only when the key is absent. The warning is
a type test on the value, and a `null` value is present, so it passes the first and fails the second.
That is a small illustration of a general property of this file: "required" is enforced in more than
one place, by more than one component, with different strictness, and knowing which check produced a
message tells you what shape of mistake you made.

**What is the cost of misclassifying these two families in each direction?**
Treating a deletion as a complaint leaves you re-reading a target the CLI cannot see, while every
check you run confirms the wrong conclusion: the file parses, the key is visible, the editor is
quiet. Treating a complaint as a deletion sends you searching for something that was never removed,
and typically ends in rewriting a working extension key or acquiring the superstition that the CLI
strips unknown keys. Both waste the same amount of time, which is why the one-question procedure —
did the branch stop reading that key? — is worth having ready.

**Why is it worth clearing harmless name warnings even though nothing is broken?**
Because the reader's output is a shared channel, and the deleting messages appear in it too. A
workspace that emits the same two name warnings on every command trains everyone to skip that part
of the log, and the next `Skipping invalid target value; expected an object.` goes past unread. That
message is the only place the real mistake is ever named, so the cost of noise here is not
aesthetic — it is the loss of the one signal that would have made a later failure a two-line
diagnosis.

{/* FOOTER */}
