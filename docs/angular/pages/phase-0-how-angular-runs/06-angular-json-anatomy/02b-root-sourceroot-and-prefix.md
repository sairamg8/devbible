---
title: "`root`, `sourceRoot` and `prefix` describe where a project lives and what its generated code is called — and the first application's `root` is the empty string on purpose, because that application is the workspace"
sidebar_label: "02b · `root`, `sourceRoot`, `prefix`"
sidebar_position: 2.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> at tag `v22.1.7`, and the project-configuration table on
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Three of a project's nine properties are strings that describe position and naming, and all three
are routinely misunderstood in the same way — as things the CLI derives rather than things you
state.** `root` is the base every other relative path is written against, `sourceRoot` is a
different base used by a different set of options, and `prefix` affects nothing that already exists.
None of the three has a default the CLI supplies for you; what looks like a convention is a value
some schematic wrote. The special case of an *empty* `root` is
[02c](02c-the-empty-root-and-workspace-layout.md).

## `root` and `sourceRoot` answer different questions

- **`root`** is where the project's *files* live, relative to the workspace. It is the base almost
  every other relative path in the project is written against — `tsConfig`, the `assets` input
  directories, the project's own `tsconfig.app.json`.
- **`sourceRoot`** is where its *source* lives — the documentation says *"The root directory for
  this project's source files"*, and the schema description names assets and `index.html` alongside
  sources.

For the initial application that is `""` and `"src"`; for a generated second application it is
`"projects/admin"` and `"projects/admin/src"`. The two are not redundant: the generated build target
writes `browser` and `styles` paths against `sourceRoot`, and `tsConfig` against `root`.

The documented definitions, verbatim:

> *"| `root` | The root directory for this project's files, relative to the workspace directory.
> Empty for the initial application, which resides at the top level of the workspace. | `string` |
> None (required) |"*
>
> *"| `sourceRoot` | The root directory for this project's source files. | `string` | `''` |"*
>
> *"| `prefix` | A string that Angular prepends to selectors when generating new components,
> directives, and pipes using `ng generate`. Can be customized to identify an application or feature
> area. | `string` | `'app'` |"*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

Note the third column of the `sourceRoot` row: its default is the **empty string**, not `src`. The
`"src"` you see in a generated file was written there by the schematic; it is not a fallback the CLI
would supply if the key were missing.

## `prefix` only affects code that does not exist yet

The description is precise about tense: *"A string that Angular prepends to selectors when
generating **new** components, directives, and pipes"*. Changing it does not rename anything already
written, and it does not make the build reject an existing selector. Its `"format": "html-selector"`
in the schema constrains it to something usable as part of an element name.

## The reader warns about types here rather than throwing

All three properties get the same lenient treatment at load time:

```ts
case 'prefix':
case 'root':
case 'sourceRoot':
  if (typeof value !== 'string') {
    context.warn(`Project property "${name}" should be a string.`, value);
  }
```
— [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts) at `v22.1.7`

A warning, not an error — the workspace still loads with a number or an array sitting where a path
should be. The failure then happens much later and much further away, inside whatever tries to join
that value into a filesystem path. This is the same schema-strict / reader-lenient pattern that runs
through the file, and it is the reason a warning line in the output deserves a read rather than a
scroll.

## Gotchas

**★ Symptom: a directory was renamed and builds now fail on paths that look correct.** Cause: `root`
still points at the old location, and every relative path in the project is written against it. Fix:
`root`, `sourceRoot` and the per-project paths move together:

```json
{
  "projects": {
    "admin": {
      "root": "apps/admin",
      "sourceRoot": "apps/admin/src",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "apps/admin/tsconfig.app.json", "browser": "apps/admin/src/main.ts" }
        }
      }
    }
  }
}
```

**★ Symptom: `Project property "root" should be a string.` appears as a warning and the command keeps
going.** Cause: the reader warns rather than throws for the wrong type on `prefix`, `root` and
`sourceRoot` — the strictness is in the schema, not at runtime. The real failure arrives later, when
something tries to join that value into a path. Fix: give it a string:

```json
{
  "projects": {
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**★ Symptom: components generated in a second application get the same `app-` selector prefix as the
first.** Cause: `prefix` defaults to `app` for every generated project, and nothing makes it unique.
Fix: set it per project — it exists precisely to *"identify an application or feature area"*:

```json
{
  "projects": {
    "storefront": { "root": "", "projectType": "application", "prefix": "shop" },
    "admin": { "root": "projects/admin", "projectType": "application", "prefix": "adm" }
  }
}
```

**Symptom: changing `prefix` did not rename any existing selector.** Cause: it applies *"when
generating new components, directives, and pipes"* — it is an input to `ng generate`, not a
constraint the build enforces. Fix: existing selectors are changed by editing them; the setting only
governs what comes next.

**Symptom: `sourceRoot` was removed on the assumption that it defaults to `src`.** Cause: the
documented default is the empty string, not `src`. The `"src"` in a generated file is something the
schematic wrote, not a fallback. Fix: state it:

```json
{
  "projects": {
    "storefront": { "root": "", "sourceRoot": "src", "projectType": "application" }
  }
}
```

**Symptom: a `prefix` such as `"MyApp"` or `"my app"` is rejected by the schema.** Cause: the
property declares `"format": "html-selector"`, so it must be usable as part of an element name. Fix:
lowercase, hyphen-separated:

```json
{
  "projects": {
    "storefront": { "root": "", "projectType": "application", "prefix": "shop" }
  }
}
```

**Symptom: paths inside a project were written relative to `sourceRoot` and resolve to the wrong
place.** Cause: the two bases are used by different options and mixing them up is silent — the
generated target writes `tsConfig` against `root` and `browser`/`styles` against `sourceRoot`. Fix:
write every path from the workspace root and stop guessing which base applies:

```json
{
  "projects": {
    "admin": {
      "root": "projects/admin",
      "sourceRoot": "projects/admin/src",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "tsConfig": "projects/admin/tsconfig.app.json",
            "browser": "projects/admin/src/main.ts",
            "styles": ["projects/admin/src/styles.css"]
          }
        }
      }
    }
  }
}
```

## Interview questions

**★ What is the difference between `root` and `sourceRoot`?**
`root` is where the project's files begin, relative to the workspace directory; `sourceRoot` is where
its source files begin, and the schema's own description mentions assets and `index.html` alongside
sources. For the initial application they are `""` and `"src"`; for a generated second application,
`"projects/admin"` and `"projects/admin/src"`. They are not interchangeable because generated target
options are written against both — `tsConfig` relative to `root`, `browser` and `styles` relative to
`sourceRoot`.

**★ What does `prefix` actually control?**
Only code generation. The documented behaviour is that Angular prepends it to selectors *when
generating new* components, directives and pipes with `ng generate`, and it can be customised to
identify an application or feature area. It does not rename existing selectors, is not enforced by
the build, and is not a lint rule — although lint rules that check selector prefixes are commonly
configured to match it, which is where the belief that the build enforces it comes from.

**What does the CLI do when `root` is a number instead of a string?**
It warns — `Project property "root" should be a string.` — and carries on loading the workspace. The
same branch covers `prefix` and `sourceRoot`. That leniency is deliberate at the reader level and is
the opposite of what the schema says, so an editor will flag it as an error while the CLI merely
mentions it. The practical consequence is that the real failure lands somewhere else entirely, when
a path is constructed from the bad value, and the message at that point will not mention
`angular.json` at all.

**★ A path in a target option is wrong after a project moved. Which base is it relative to?**
Neither `root` nor `sourceRoot` — the target options that the generated file contains are written
relative to the **workspace** directory, and both `root` and `sourceRoot` are themselves workspace-
relative. The two properties describe where things are; they are not bases that later paths are
resolved against automatically. That is why moving a project means editing `root`, `sourceRoot` and
every path inside its targets separately: nothing derives from anything else.

**Is `src` the default `sourceRoot`?**
No. The documented default is `''`, the empty string. Every generated project has `"sourceRoot":
"src"` because the application schematic writes it, and that is easy to mistake for a convention the
CLI would apply on its own. Removing the key does not fall back to `src`; it falls back to the
workspace-relative empty path, which is almost never what a project wants.

{/* FOOTER */}
