---
title: "A project is a key in a map and an object with exactly two required properties — and the first application's `root` is the empty string, which is documented design rather than the placeholder everyone deletes"
sidebar_label: "02 · `projects` and the project object"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> and [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> all at tag `v22.1.7`, cross-read against
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`projects` is a map whose keys are project names and whose values are project objects, and both
halves are constrained more tightly than they look.** The key must match a regular expression that
happens to accept npm scopes; the value accepts nine properties and no others, of which exactly two
are required — and the two are required by *different* mechanisms, one of which will let you load a
file the other rejects. Almost every hand-edited `angular.json` that fails to load fails on one of
those points, and the messages are precise enough to tell you which. What the individual properties
mean is [02b](02b-root-sourceroot-and-prefix.md); this page is the shape of the map and the object.

## The key: a project name is a validated string

From the top-level schema:

```json
"projects": {
  "type": "object",
  "patternProperties": {
    "^(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+$": { "$ref": "#/definitions/project" }
  },
  "additionalProperties": false
}
```

Decompose the pattern, because it is doing real work:

| Fragment | Meaning |
|---|---|
| `^(?:@[a-zA-Z0-9._-]+/)?` | an optional npm scope — `@acme/` |
| `[a-zA-Z0-9._-]+$` | the name: letters, digits, dot, underscore, hyphen |

🔴 **Combined with `additionalProperties: false`, a key that does not match the pattern matches
nothing and is therefore an additional property — so it is rejected, not merely unconventional.** No
spaces, no slashes except the one that ends a scope, and nothing outside that character class.
Uppercase letters *are* permitted by the pattern even though nothing generated uses them.

Scoped names are genuinely supported, and the application schematic has an explicit branch for
turning one into a directory:

```ts
// If scoped project (i.e. "@foo/bar"), convert dir to "foo/bar".
let folderName = options.name.startsWith('@') ? options.name.slice(1) : options.name;
```
— [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts) at `v22.1.7`

So `@acme/ui` is a legal project name and lands on disk under `acme/ui`. The leading `@` is stripped
for the path and kept in the name.

## The value: nine properties, two required

```json
"project": {
  "type": "object",
  "properties": {
    "cli": { "schematicCollections": { "type": "array", "description": "The list of schematic collections to use.", "items": { "type": "string", "uniqueItems": true } } },
    "schematics": { "$ref": "#/definitions/schematicOptions" },
    "prefix": { "type": "string", "format": "html-selector", "description": "The prefix to apply to generated selectors." },
    "root": { "type": "string", "description": "Root of the project files." },
    "i18n": { "$ref": "#/definitions/project/definitions/i18n" },
    "sourceRoot": { "type": "string", "description": "The root of the source files, assets and index.html file structure." },
    "projectType": { "type": "string", "description": "Project type.", "enum": ["application", "library"] },
    "architect": { "type": "object", "additionalProperties": { "$ref": "#/definitions/project/definitions/target" } },
    "targets":   { "type": "object", "additionalProperties": { "$ref": "#/definitions/project/definitions/target" } }
  },
  "required": ["root", "projectType"],
  "anyOf": [
    { "required": ["architect"], "not": { "required": ["targets"] } },
    { "required": ["targets"],   "not": { "required": ["architect"] } },
    { "not": { "required": ["targets", "architect"] } }
  ],
  "additionalProperties": false,
  "patternProperties": { "^[a-z]{1,3}-.*": {} }
}
```

Three structural facts, each with its own page in this topic:

1. **Only `root` and `projectType` are required.** `sourceRoot`, `prefix`, `schematics`, `cli`,
   `i18n` and even `targets` are optional — a project with no targets is valid and simply cannot be
   built.
2. **That `anyOf` is a legal XOR over `architect` and `targets`** — the same field under two names,
   and having both is invalid. What the *reader* does about it is [02d](02d-architect-or-targets.md).
3. **`patternProperties` with `^[a-z]{1,3}-.*` is an escape hatch** that reopens the object to
   third-party keys. That is [02e](02e-the-extension-escape-hatch.md).

## `root` is required twice, by two different mechanisms

The schema requires `root` and `projectType`. The **reader** requires only `root`, and says so more
kindly:

```ts
const projectNodeValue = getNodeValue(projectNode);
if (!('root' in projectNodeValue)) {
  throw new Error(`Project "${projectName}" is missing a required property "root".`);
}
```

Both statements are true at different stages: `projectType` is a schema requirement your editor
enforces, `root` is a runtime requirement the CLI enforces. A project missing `projectType` is
schema-invalid and will still load; a project missing `root` stops the command with the message
above, naming the project.

The documented meaning, verbatim:

> *"| `root` | The root directory for this project's files, relative to the workspace directory.
> Empty for the initial application, which resides at the top level of the workspace. | `string` |
> None (required) |"*
>
> *"| `projectType` | One of "application" or "library" An application can run independently in a
> browser, while a library cannot. | `application` \| `library` | None (required) |"*
>
> *"| `sourceRoot` | The root directory for this project's source files. | `string` | `''` |"*
>
> *"| `prefix` | A string that Angular prepends to selectors when generating new components,
> directives, and pipes using `ng generate`. Can be customized to identify an application or feature
> area. | `string` | `'app'` |"*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

## Gotchas

**★ Symptom: `Project "storefront" is missing a required property "root".`** Cause: `root` was
removed — usually because `""` looked like an unfilled placeholder during a hand edit or a merge
resolution. The reader will not infer it. Fix: put the empty string back for the top-level
application:

```json
{
  "projects": {
    "storefront": { "root": "", "sourceRoot": "src", "projectType": "application" }
  }
}
```

**★ Symptom: a project loads and builds, but your editor flags it as invalid.** Cause: `projectType`
is missing. The schema lists it in `required`, the reader does not check it, and the two disagree.
Fix: it is one line and it is required by the format:

```json
{
  "projects": {
    "ui-kit": { "root": "projects/ui-kit", "projectType": "library" }
  }
}
```

**★ Symptom: a project key with a space, a slash or a `#` in it is rejected.** Cause: the
`patternProperties` regex plus `additionalProperties: false` — a non-matching key matches no
sub-schema and is therefore an unexpected property. Fix: rename it to something the pattern accepts,
and remember the scope form is the only legal use of `/`:

```json
{
  "projects": {
    "admin-portal": { "root": "projects/admin-portal", "projectType": "application" },
    "@acme/ui": { "root": "projects/acme/ui", "projectType": "library" }
  }
}
```

**★ Symptom: renaming a project key breaks `ng serve` with a message about a target that does not
exist.** Cause: target references are strings that embed the project name — `buildTarget` on the
serve target is written as `project:target:configuration`. Renaming the key does not rewrite them.
Fix: rename every reference in the same edit:

```json
{
  "projects": {
    "shop": {
      "root": "",
      "projectType": "application",
      "targets": {
        "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": { "development": { "buildTarget": "shop:build:development" } }
        }
      }
    }
  }
}
```

**★ Symptom: a key you added to a project object — `"description"`, `"port"`, `"outDir"` — is
rejected.** Cause: the project object declares nine properties and `additionalProperties: false`.
There is no free-form metadata slot, and the only opening is the short-prefix pattern in
[02e](02e-the-extension-escape-hatch.md). Fix: almost everything people try to put here is really a
builder option, and belongs inside a target:

```json
{
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "targets": {
        "serve": {
          "builder": "@angular/build:dev-server",
          "options": { "port": 4300 }
        }
      }
    }
  }
}
```

**Symptom: `"projectType": "App"` or `"applications"` is rejected.** Cause: the property carries an
`enum` with exactly two members, `application` and `library`, and it is case-sensitive. Fix: one of
the two literal strings:

```json
{
  "projects": {
    "ui-kit": { "root": "projects/ui-kit", "projectType": "library" }
  }
}
```

**Symptom: a scoped project was generated and the directory is nowhere near where you looked.**
Cause: the leading `@` is stripped when the name becomes a path — the application schematic's own
comment reads *"If scoped project (i.e. `@foo/bar`), convert dir to `foo/bar`"*. A project named
`@acme/admin` lands under a two-level path, not under a directory called `@acme`. Fix: nothing to
repair, but write `root` so the mapping is visible rather than implied:

```json
{
  "projects": {
    "@acme/admin": {
      "root": "projects/acme/admin",
      "sourceRoot": "projects/acme/admin/src",
      "projectType": "application"
    }
  }
}
```

## Interview questions

**★ Which properties of a project are required, and by what?**
The schema requires `root` and `projectType`. The workspace reader requires only `root`, and throws
`Project "<name>" is missing a required property "root".` when it is absent. So a project without
`projectType` is schema-invalid — your editor will say so — and still loads; a project without
`root` stops the command. That split between "the schema requires it" and "the CLI enforces it" runs
through the whole file and is worth stating in exactly those terms rather than saying "two required
fields".

**Can a project be named `@acme/ui`, and what happens on disk?**
Yes. The `projects` key pattern has an optional scope group, `^(?:@[a-zA-Z0-9._-]+/)?`, so a scoped
name is valid. The application schematic strips the leading `@` when it derives a directory —
its own comment says *"If scoped project (i.e. `@foo/bar`), convert dir to `foo/bar`"* — so the
name keeps the `@` and the path does not. This matters for libraries published under a scope, where
the workspace name and the npm package name are usefully the same string.

**★ Why does the CLI constrain project names with a regular expression at all?**
Because the name is not only a key — it is embedded in target reference strings. A target is named
`project:target[:configuration]`, so a project name containing a colon would make that string
ambiguous, and the same strings appear in `buildTarget` values, in `ng run` arguments and in CI
scripts. The pattern is stricter than that single requirement needs (it also excludes spaces and
most punctuation), which is the usual trade: a narrow character class that is trivially safe to
embed in paths, URLs and command lines.

**★ Where does the CLI enforce a project's shape, and where does the schema?**
In two different places with two different answers, and the split matters when you are debugging.
The schema — what an editor validates against — requires `root` and `projectType`, closes the object
with `additionalProperties: false`, and forbids having both `architect` and `targets`. The workspace
reader — the code that actually runs — requires only `root`, treats `projectType` as an extension it
carries along rather than a field it enforces, and tolerates both target keys. So "my editor is
happy" and "the CLI will load this" are two separate claims, and neither implies the other.

**What breaks when you rename a project?**
Every string that embeds the old name. Target references are written as
`project:target[:configuration]`, so a serve target's `buildTarget`, any `ng run` invocation in a
script, and any CI step naming the project all break at once — and the failure surfaces as a missing
target rather than as a missing project, which sends people looking in the wrong place. A rename is
a find-and-replace across `angular.json`, `package.json` scripts and CI configuration, not a
one-line edit.

---

← Prev: [The version gate](01e-the-version-gate.md) · Index: [Topic index](README.md) · Next → [`root`, `sourceRoot`, `prefix`](02b-root-sourceroot-and-prefix.md)
