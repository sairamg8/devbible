---
title: "`fileReplacements` swaps one source file for another before the build runs, and its schema regex quietly restricts it to thirteen extensions — so it is a TypeScript-program mechanism, not a general file substitution"
sidebar_label: "07 · fileReplacements"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> (`definitions.fileReplacement`) at tag `v22.1.7`, with the feature description quoted verbatim
> from [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`fileReplacements` is the only mechanism in `angular.json` that changes what your source code
*is* rather than how it is processed — and it can only do it to files the TypeScript program owns.**
The schema enforces that with a regex on both ends of every entry, which is why the first thing
most people try (replacing a stylesheet, an `index.html`, an `.env`) fails validation. This page is
the field itself: the schema, the regex, and what the documentation says the option is for.
[07b](07b-environments-in-practice.md) wires it up with `ng generate environments`,
[07c](07c-adding-a-new-environment.md) adds one of your own, and
[07d](07d-secrets-conflicts-and-the-alternative.md) covers the security note, the schematic's
conflict handling, and the mechanism that removes the need for it.

## The schema

Verbatim from `definitions.fileReplacement` in the `application` builder's schema at `v22.1.7`:

```json
{
  "fileReplacement": {
    "type": "object",
    "properties": {
      "replace": { "type": "string", "pattern": "\\.(([cm]?[jt])sx?|json)$" },
      "with":    { "type": "string", "pattern": "\\.(([cm]?[jt])sx?|json)$" }
    },
    "additionalProperties": false,
    "required": ["replace", "with"]
  }
}
```

The `fileReplacements` property that uses it is an array with `"default": []` and the description
*"Replace compilation source files with other compilation source files in the build."*

Two keys, both required, both constrained by the same pattern, and no third key. There is no
`enabled` flag, no glob support and no conditional form.

## The regex is the whole story

🔴 **`\.(([cm]?[jt])sx?|json)$` is a hard constraint that nobody expects until it rejects them.**
Decomposed:

| Fragment | Means |
|---|---|
| `[cm]?` | an optional `c` or `m` — the CommonJS / ESM extension prefix |
| `[jt]` | `j` or `t` — JavaScript or TypeScript |
| `s` | the literal `s` |
| `x?` | an optional `x` — the JSX/TSX suffix |
| `\|json` | or, instead of all of the above, the literal `json` |
| `$` | anchored at the end of the string |

So the accepted extensions are exactly: `.js`, `.jsx`, `.ts`, `.tsx`, `.cjs`, `.cjsx`, `.cts`,
`.ctsx`, `.mjs`, `.mjsx`, `.mts`, `.mtsx`, `.json`. Thirteen, four of which
(`.cjsx`, `.ctsx`, `.mjsx`, `.mtsx`) are permitted by the pattern without being extensions anyone
actually uses.

**Not accepted:** `.scss`, `.sass`, `.less`, `.css`, `.html`, `.svg`, `.env`, `.yaml`, `.txt`, and
anything else. You cannot file-replace a template, a stylesheet, an image or an environment file.

That restriction is not arbitrary, and the documentation names the reason in its own phrasing — the
option *"lets you replace any file in the **TypeScript program**"*. `fileReplacements` operates on
the compilation unit, so what it can replace is exactly what the compiler already treats as a
source file.

## What the documentation says it is for

> *"`@angular/build:application` supports file replacements, an option for substituting source files
> before executing a build. Using this in combination with `--configuration` provides a mechanism
> for configuring environment-specific data in your application."*

> *"The main CLI configuration file, `angular.json`, contains a `fileReplacements` section in the
> configuration for each build target, which lets you replace any file in the TypeScript program
> with a target-specific version of that file. This is useful for including target-specific code or
> variables in a build that targets a specific environment, such as production or staging."*

> *"By default no files are replaced, however `ng generate environments` sets up this configuration
> automatically."*

Three things follow from those three sentences, and each is load-bearing:

1. The substitution happens **before** the build, so nothing downstream — the compiler, the bundler,
   the optimiser — knows a replacement occurred. There is no runtime branch and no dead code to
   eliminate.
2. It is designed to be used **with a configuration**, not in `options`. A replacement that applies
   to every build is not a replacement.
3. **It defaults to nothing**, and a schematic exists to write it. Hand-writing the whole structure
   is legal and unnecessary.

## Gotchas

**★ Symptom: a `fileReplacements` entry for a `.scss` or `.html` file is rejected by schema
validation.** Cause: the `\.(([cm]?[jt])sx?|json)$` pattern accepts only JavaScript, TypeScript and
JSON extensions — this is a TypeScript-program mechanism. Fix: move the varying value into a `.ts`
file and consume it from the component that owns the stylesheet or template:

```ts
// src/environments/environment.ts
export const environment = { production: true, themeUrl: '/assets/theme-prod.css' };
```

**★ Symptom: `fileReplacements` was added to `options` and every build gets the replacement.**
Cause: `options` applies to every configuration; a replacement that is unconditional is just the
file you should have imported directly. Fix: move it into the configuration that needs it:

```json
{
  "configurations": {
    "development": {
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.development.ts" }
      ]
    }
  }
}
```

**★ Symptom: an entry with only `replace` is rejected.** Cause: the definition has
`"required": ["replace", "with"]` — both ends are mandatory, and there is no "remove this file"
form. Fix: point it at a real substitute, even an empty one:

```json
{ "replace": "src/analytics.ts", "with": "src/analytics.noop.ts" }
```

**★ Symptom: you add an `enabled: false` or a `condition` key to an entry to turn it off
temporarily, and the file fails validation.** Cause: `additionalProperties: false` on the
definition — there are exactly two allowed keys. Fix: express it as a separate configuration
instead, which is the mechanism that already means "sometimes":

```json
{
  "configurations": {
    "development": { "fileReplacements": [] },
    "development-real-api": {
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.development.ts" }
      ]
    }
  }
}
```

**★ Symptom: a glob such as `src/environments/*.ts` in `replace` does not match anything.** Cause:
there is no glob support; both values are plain paths and the pattern anchors on a real file
extension. Fix: write one entry per file:

```json
{
  "fileReplacements": [
    { "replace": "src/environments/environment.ts", "with": "src/environments/environment.staging.ts" },
    { "replace": "src/config/features.ts", "with": "src/config/features.staging.ts" }
  ]
}
```

**Symptom: the replacement path is written relative to `src/` and nothing is replaced.** Cause:
both paths are resolved from the workspace root, exactly as they appear in the generated entry
(`src/environments/environment.ts`), not from `sourceRoot`. Fix: write the full workspace-relative
path on both sides:

```json
{ "replace": "src/environments/environment.ts", "with": "src/environments/environment.staging.ts" }
```

**Symptom: a `.json` replacement works but a `.env` one does not.** Cause: `json` is explicitly
alternated into the pattern; `.env` is not, and no extension outside the thirteen is. Fix: convert
the values into a JSON or TypeScript module the compiler can see:

```json
{ "replace": "src/config/settings.json", "with": "src/config/settings.staging.json" }
```

**Symptom: someone expects the replaced file to be tree-shaken away in the other configuration.**
Cause: nothing downstream ever sees a replacement — the substitution happens before the build, so
there is no branch to eliminate and no second copy to remove. Both files exist in your repository;
exactly one reaches the compiler. Fix: nothing to do, but do not reason about it as dead-code
elimination:

```json
{ "fileReplacements": [{ "replace": "src/a.ts", "with": "src/b.ts" }] }
```

## Interview questions

**★ Why can `fileReplacements` not replace a stylesheet or a template?**
Because the schema constrains both `replace` and `with` with the pattern
`\.(([cm]?[jt])sx?|json)$`, which accepts only JavaScript, TypeScript and JSON extensions. That is
not a limitation someone forgot to lift — it follows from what the option is. The documentation
describes it as replacing *"any file in the TypeScript program"*, so its domain is exactly the
compilation unit. A stylesheet is not part of that program, so there is nothing for the mechanism
to substitute.

**★ Why should `fileReplacements` never appear in `options`?**
Because a replacement that applies to every build is not a replacement at all — the file being
substituted in is simply the file your code should import. The option exists to make one build
differ from another, and the documentation frames it exactly that way: *"Using this in combination
with `--configuration` provides a mechanism for configuring environment-specific data."* An entry
in `options` is a sign that two files exist where one would do.

**What happens to the replaced file — is it bundled, or tree-shaken out?**
Neither. The substitution happens *before* the build executes, so the compiler and the bundler only
ever see one of the two files. There is no conditional branch, no dead code and nothing to
eliminate. This matters when reasoning about bundle size: `fileReplacements` costs nothing at
runtime and produces no evidence in the output that a second file exists.

**Why does the entry definition set `additionalProperties: false` with only two keys?**
Because everything a conditional replacement would need is already expressed by the surrounding
mechanism. "Sometimes" is a configuration; "which build" is `--configuration`; "several files" is
several array entries. Adding an `enabled` or `condition` key would create a second, weaker way to
express what configurations already do, and the schema forecloses it — an unknown key on an entry
fails the build rather than being ignored.

**How would you replace two files for one environment?**
Two entries in the same configuration's array. There is no glob and no directory form, so each pair
is written out. That verbosity is a feature at review time — a diff shows exactly which files a new
environment substitutes, which is the sort of thing you want visible when someone adds a staging
build.

{/* FOOTER */}
