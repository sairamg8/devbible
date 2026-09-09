---
title: "`angular.json` is closed to unknown keys except through one regular expression — one to three lowercase letters and a hyphen — which is why every tool that extends the file has a suspiciously short prefix"
sidebar_label: "02e · The extension escape hatch"
sidebar_position: 2.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the `project` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and the extension handling in
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Both the workspace object and the project object are closed — `additionalProperties: false` — and
yet third-party tooling adds keys to `angular.json` all the time.** The opening is a single
`patternProperties` entry accepting a key of at most three lowercase letters followed by a hyphen,
and the workspace reader enforces the identical regular expression when it decides whether to warn
about a key it does not recognise. This page is the rule and where the two validators stop agreeing;
[02f](02f-living-with-extension-keys.md) is what to do with it.

## The pattern, in the schema

The project definition ends with:

```json
"additionalProperties": false,
"patternProperties": { "^[a-z]{1,3}-.*": {} }
```

The interaction between those two lines is the whole mechanism, and it is a JSON Schema subtlety
worth stating explicitly: **`additionalProperties` applies only to keys that were not already
matched by `properties` or `patternProperties`.** A key matching `^[a-z]{1,3}-.*` is matched by the
pattern, so it is not "additional", so the `false` does not reach it — and the schema it is validated
against is `{}`, which accepts any value at all.

Decompose the regex:

| Fragment | Meaning |
|---|---|
| `^[a-z]{1,3}` | one to three **lowercase** letters, at the start |
| `-` | a literal hyphen |
| `.*` | anything |

| Key | Legal? | Why |
|---|---|---|
| `nx-something` | ✅ | two letters, hyphen |
| `cli-cache` | ✅ | three letters, hyphen |
| `x-anything` | ✅ | one letter, hyphen |
| `mytool-config` | ❌ | six letters before the hyphen |
| `Nx-something` | ❌ | uppercase |
| `nx_something` | ❌ | underscore, not a hyphen |
| `nx` | ❌ | no hyphen |

## The same regex, enforced again by the reader

The reader keeps two frozen lists of keys it understands as Angular's own:

```ts
const ANGULAR_WORKSPACE_EXTENSIONS = Object.freeze(['cli', 'newProjectRoot', 'schematics']);
const ANGULAR_PROJECT_EXTENSIONS = Object.freeze(['cli', 'schematics', 'projectType', 'i18n']);
```

and warns about anything that is neither on the relevant list nor prefix-matching:

```ts
if (!context.unprefixedWorkspaceExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
  context.warn(`Workspace extension with invalid name (${name}) found.`, name);
}
```
```ts
if (!context.unprefixedProjectExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
  context.warn(
    `Project '${projectName}' contains extension with invalid name (${name}).`,
    name,
  );
}
```
— [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts) at `v22.1.7`

Two details are worth pulling out of that.

**It warns; it does not throw.** An unrecognised key with a bad name produces a line of output and
the workspace loads anyway. So the consequence of getting the prefix wrong is not a failed build —
it is a warning nobody reads and a key nothing consumes.

🔴 **`projectType` is on the project extension list.** The reader treats it as an *extension*, not as
a parsed structural field, which is exactly why it does not enforce it as required even though the
schema does ([02](02-projects-and-the-project-object.md)). The two lists are the reader's definition
of "an Angular key I know about" and nothing more.

## The two levels do not agree

The project object declares `patternProperties`. **The top-level workspace object, as quoted in
[01d](01d-version-and-the-six-top-level-keys.md), declares `additionalProperties: false` with no
`patternProperties` at all** — while the reader applies the same short-prefix regex at the workspace
level before deciding whether to warn.

The practical consequence: a key like `nx-workspace` placed at the **top level** passes the reader
silently and is still rejected by the schema, so an editor flags it and the CLI does not. At the
**project** level, both agree. Where they disagree, the editor is the stricter of the two — treat a
top-level prefixed key as something the format does not formally support.

## Gotchas

**★ Symptom: `Project 'storefront' contains extension with invalid name (deployConfig).`** Cause:
the key is neither one of `cli`, `schematics`, `projectType`, `i18n` nor a match for
`^[a-z]{1,3}-.*`. Fix: give it a legal prefix — one to three lowercase letters and a hyphen:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "dep-config": { "bucket": "storefront-prod" }
    }
  }
}
```

**★ Symptom: `Workspace extension with invalid name (myTool) found.`** Cause: the same rule at the
top level, where the known names are only `cli`, `newProjectRoot` and `schematics`. Fix: either use a
legal prefix, or — better at this level, where the schema has no pattern opening at all — put the
configuration in its own file:

```json
{
  "version": 1,
  "projects": {}
}
```

**★ Symptom: a prefixed key at the top level warns in the editor but not in the CLI.** Cause: the
project object declares `patternProperties` and the workspace object does not, while the reader
applies the regex at both levels. The two validators disagree, and the schema is the stricter one.
Fix: keep prefixed extension keys inside a **project**, where both agree:

```json
{
  "version": 1,
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "nx-tags": ["scope:shop"]
    }
  }
}
```

**Symptom: an extension key was added, the warning was ignored, and the tool that was supposed to
read it does nothing.** Cause: the warning is not decorative — a key that fails the pattern is one
the reader has classified as invalid, and whatever consumes extensions is looking for a valid one.
Fix: rename the key to a matching form and re-run the tool:

```json
{
  "projects": {
    "storefront": { "root": "", "projectType": "application", "cov-thresholds": { "lines": 80 } }
  }
}
```

**Symptom: `projectType` is described as an "extension" in a stack trace or a log line and that
looks like a bug.** Cause: it is on `ANGULAR_PROJECT_EXTENSIONS`, so the reader classifies it as a
known extension rather than as a structural field it parses. That is also why the reader never
enforces it while the schema requires it. Fix: nothing to change — but expect `projectType` problems
to surface from the schema and not from the CLI:

```json
{
  "projects": {
    "ui-kit": { "root": "projects/ui-kit", "projectType": "library" }
  }
}
```

## Interview questions

**★ How can a third-party tool legally add a key to `angular.json` when the schema is closed?**
Through one `patternProperties` entry on the project object: `^[a-z]{1,3}-.*`. In JSON Schema,
`additionalProperties` only governs keys that are not matched by `properties` or `patternProperties`,
so a key of one to three lowercase letters followed by a hyphen escapes the `false` and is validated
against an empty schema, which accepts anything. The workspace reader enforces the identical regex
when deciding whether to warn about a key it does not recognise. That single pattern is why the
prefixes you see in the wild are two or three characters long.

**★ Is the "invalid extension name" message an error?**
No — it is a `context.warn`, so the workspace still loads and the command still runs. That makes it
one of the more dangerous messages in the file, because the observable behaviour is "everything is
fine, plus a line of output nobody reads", while the actual state is a key the reader has classified
as invalid and that whatever was meant to consume it will not find. Treat it as an error with a
polite delivery.

**★ Do the schema and the reader agree about extension keys?**
At the project level, yes: the schema opens the object with `patternProperties` and the reader
applies the same regex. At the workspace level they do not — the top-level object declares
`additionalProperties: false` with no pattern opening, while the reader still applies the regex
before warning. So a prefixed key at the top level runs cleanly and is nonetheless schema-invalid.
This is the same schema-strict / reader-lenient split that appears with `projectType`, with
`architect` and `targets` ([02d](02d-architect-or-targets.md)), and with `version`
([01e](01e-the-version-gate.md)); it is a pattern of the file, not a one-off.

**What does "extension" mean in the workspace reader's vocabulary?**
Any key that is not one of the fields the reader parses structurally. It keeps two frozen lists of
the ones Angular owns — `cli`, `newProjectRoot` and `schematics` at the workspace level; `cli`,
`schematics`, `projectType` and `i18n` at the project level — and treats everything else as a
third-party extension subject to the naming rule. It is a classification about *who owns the key*,
not about whether the key matters.

**Why is `projectType` classified as an extension when the schema lists it as required?**
Because the two mechanisms are asking different questions. The schema describes the format and says
a project must declare its type. The reader parses the fields it needs in order to build a workspace
object — root, targets, prefix, source root — and treats everything else, including `projectType`, as
an extension it carries along. That is precisely why a project missing `projectType` loads fine and
is still flagged by an editor: the requirement exists in the format, not in the code path that reads
the file.

---

← Prev: [`architect` or `targets`](02d-architect-or-targets.md) · Index: [Topic index](README.md) · Next → [Living with extension keys](02f-living-with-extension-keys.md)
