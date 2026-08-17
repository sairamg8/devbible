---
title: "`package.json` `\"imports\"` — the standard replacement"
sidebar_label: "04 · Subpath imports"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the *package.json "imports" and self-name imports* section, quoted verbatim
> including the local-project remapping paragraph and its `rootDir`
> requirement) and the **Node.js v24** documentation on subpath imports.
> `TS5098` is verbatim from the compiler's message table in the installed
> **5.9.3** build. **No sandbox, no console block.**

The handbook recommends this over `paths` in one sentence:

> Both libraries and apps can consider package.json `"imports"` as a standard
> replacement for convenience `paths` aliases.

It is the only option in [chunk 03](./03-closing-the-gap.md) where the alias
survives into production *and* nothing extra has to run.

## What it is

A field in `package.json` that maps `#`-prefixed specifiers to files. Node
resolves them natively; there is no build step and no loader.

```jsonc
{
  "name": "my-service",
  "type": "module",
  "imports": {
    "#app/*": "./dist/*",
    "#config": "./dist/config/index.js"
  }
}
```

```ts
import { pool } from "#app/db/pool.js";
import { config } from "#config";
```

**The `#` prefix is mandatory**, and that is a feature: it is not a valid start
for a package name, so a subpath import can never be confused with a dependency
— which is exactly the collision `baseUrl` invites
([chunk 02](./02-baseurl.md)).

## How TypeScript reads it

> When `moduleResolution` is set to `node16`, `nodenext`, or `bundler`, and
> `resolvePackageJsonImports` is not disabled, TypeScript will attempt to resolve
> import paths beginning with `#` through the `"imports"` field of the nearest
> ancestor package.json of the importing file.

📌 So it is gated on the same can-read-`package.json` dividing line as everything
else in [topic 01](../01-module-and-moduleresolution/06-the-bundler-resolver.md).
Under `node10` or `classic`, `"imports"` is invisible and your `#` specifiers do
not resolve at all.

The same paragraph covers self-name imports — importing your own package by its
`"name"` — which resolve through `"exports"` by the same mechanism.

## 🔴 The requirement that makes it fail confusingly

This is the whole reason the chunk exists. TypeScript's resolution of `"imports"`
**forks** depending on whose `package.json` it is:

> TypeScript follows Node.js's resolution algorithm for `"imports"` and self
> references exactly up until a file path is resolved. At that point, TypeScript's
> resolution algorithm forks based on whether the package.json containing the
> `"imports"` or `"exports"` being resolved belongs to a `node_modules` dependency
> or the local project being compiled:
>
> - If the package.json is in `node_modules`, TypeScript will apply extension
>   substitution to the file path if it doesn't already have a recognized
>   TypeScript file extension, and check for the existence of the resulting file
>   paths.
> - If the package.json is part of the local project, an additional remapping
>   step is performed in order to find the *input* TypeScript implementation file
>   that will eventually produce the output JavaScript or declaration file path
>   that was resolved from `"imports"`. Without this step, any compilation that
>   resolves an `"imports"` path would be referencing output files from the
>   *previous compilation* instead of other input files that are intended to be
>   included in the current compilation. This remapping uses the
>   `outDir`/`declarationDir` and `rootDir` from the tsconfig.json, so using
>   `"imports"` usually requires an explicit `rootDir` to be set.

Unpack the middle of that, because it is the part that bites:

Your `"imports"` map points at `./dist/*` — it has to, because that is where Node
will find the files at runtime. But at *compile* time there is no `dist/` yet, or
worse, there is a stale one. So TypeScript walks the mapping backwards: it takes
`dist/db/pool.js`, uses `outDir` and `rootDir` to work out that the input which
produces it is `src/db/pool.ts`, and resolves to that.

🔴 **Without `rootDir`, the compiler cannot perform that walk, and you end up
compiling against the previous build's output.** The symptom is memorable once
you have seen it: edits have no effect, and deleting `dist/` breaks the build.

```jsonc
// The line that is not optional
{ "compilerOptions": { "rootDir": "src", "outDir": "dist" } }
```

## Why this beats `paths`

| | `paths` | `"imports"` |
|---|---|---|
| Who resolves it at runtime | nothing, by default | **Node, natively** |
| Extra build step | often | none |
| Extra config file | often (a bundler's) | none |
| Can collide with a package name | **yes** | no — `#` is reserved |
| Survives into a published package | breaks consumers | **works** |
| Read by the compiler | always | only under `node16`/`nodenext`/`bundler` |

🔴 **The published-package row is the decisive one.** A `.d.ts` containing
`@app/db` is broken for every consumer, because they have no `tsconfig.json` of
yours. A `.d.ts` containing `#app/db` resolves through *your* `package.json`,
which ships with the package — so it keeps working in someone else's project.

## The costs, honestly

- **The `#` prefix is not optional and not pretty.** `#app/db/pool.js` instead of
  `@app/db/pool`. Some teams dislike it enough to matter.
- **You must write the extension** if you are under `node16`/`nodenext`, because
  the values are runtime paths ([topic 01, chunk 05](../01-module-and-moduleresolution/05-the-node-resolver.md)).
- **It is per package.** In a monorepo each package gets its own `"imports"`, and
  cross-package imports are a different problem — that is **Phase 6 · 12 ·
  Sharing types across a monorepo** *(not written yet, lane D)*.
- **It is invisible under `node10` and `classic`**, so a project on a legacy
  resolver cannot adopt it without also fixing that — which it should be doing
  anyway.

## Conditions work here too

`"imports"` supports the same conditional syntax as `"exports"`, which makes it
the natural home for a "different file in the browser" mapping:

```jsonc
{
  "imports": {
    "#logger": {
      "browser": "./dist/logger.browser.js",
      "default": "./dist/logger.node.js"
    }
  }
}
```

⚠️ Which condition matches depends on `moduleResolution` — `nodenext` matches
`node`, `bundler` does not ([topic 01, chunk 06](../01-module-and-moduleresolution/06-the-bundler-resolver.md)).
Extra conditions need `customConditions`, which is gated:

```text
TS5098  Option '{0}' can only be used when 'moduleResolution' is set to
        'node16', 'nodenext', or 'bundler'.
```

## Gotchas

**`#internal/x` resolves to something in `dist/`.** *Symptom:* your edits have no
effect and deleting `dist/` breaks the build. *Cause:* `rootDir` is unset, so the
compiler cannot walk the output path back to an input file. *Fix:* set `rootDir`
explicitly. This is the single most confusing failure in the topic and the
handbook sentence above is the only place it is documented.

**Forgetting the `#` gives you a normal, failing bare specifier.** *Symptom:*
`TS2307` for `app/db/pool.js`. *Cause:* only `#`-prefixed specifiers are looked
up in `"imports"`. *Fix:* the prefix is part of the name.

**It does nothing under `moduleResolution: node`.** *Symptom:* `"imports"`
appears to be ignored. *Cause:* `node10` cannot read it, and
`resolvePackageJsonImports` is forced off ([topic 01, chunk 08](../01-module-and-moduleresolution/08-implied-and-enforced.md)).
*Fix:* the resolver, not the field.

**The values are runtime paths, so they point at `dist` and look wrong.**
*Symptom:* a reviewer asks why the map points at built output. *Cause:* it must —
Node reads it at runtime. *Fix:* it is correct; the compile-time walk backwards
is what `rootDir` is for.

**Extensions are required in the values and in the specifiers under `nodenext`.**
*Symptom:* `TS2834` or a runtime miss. *Cause:* ESM resolution rules apply.
*Fix:* write `.js` in both places.

**A conditional `"imports"` entry can resolve differently for your test runner.**
*Symptom:* tests get the browser build. *Cause:* the runner's resolution
conditions differ from Node's. *Fix:* check the runner's condition configuration;
this is a feature being used, not a bug.

**Migrating from `paths` is a specifier rename across the codebase.**
*Symptom:* reluctance. *Cause:* every `@app/...` becomes `#app/...` with an
extension. *Fix:* it is a mechanical find-and-replace, and it is the last time
you will need to think about alias resolution.

**Nested `package.json` files change which `"imports"` applies.** *Symptom:* a
subdirectory's `#` specifiers resolve differently. *Cause:* the *nearest ancestor*
`package.json` is used — the same rule as format detection
([topic 01, chunk 09](../01-module-and-moduleresolution/09-format-detection.md)).
*Fix:* be aware that a `package.json` added for a `"type"` override also changes
`"imports"` scope.

## Interview questions

**What is `package.json` `"imports"` and why does the handbook prefer it to
`paths`?**
A standard field mapping `#`-prefixed specifiers to files, resolved natively by
Node. It is preferred because it needs no build step, no second config, and it
ships with the package — so unlike `paths` it keeps working in a published
`.d.ts`, where the consumer has no `tsconfig.json` of yours.

**Why must a `"imports"` map point at `dist/` rather than `src/`?**
Because Node reads it at runtime, when only the output exists. TypeScript
compensates by walking the mapping backwards at compile time — taking the
resolved output path and using `outDir`/`rootDir` to find the input file that
produces it.

**What breaks if `rootDir` is not set?**
The backwards walk. TypeScript resolves the `"imports"` path to a file in
`dist/`, which means the current compilation depends on the *previous* build's
output. The symptom is that edits have no effect and deleting `dist/` breaks the
build.

**Why is the `#` prefix a feature rather than an annoyance?**
Because it cannot begin a package name, so a subpath import can never shadow or
be shadowed by a dependency. That is precisely the collision `baseUrl` invites,
where a directory called `utils` outranks the npm package.

**Under which `moduleResolution` settings does TypeScript read `"imports"`?**
`node16`, `nodenext` and `bundler` — the same three that can read `"exports"`.
Under `node10` or `classic` the field is invisible and `resolvePackageJsonImports`
is forced off regardless of what you set it to.

**Can `"imports"` do conditional resolution?**
Yes, with the same condition syntax as `"exports"` — a `browser` entry and a
`default`, for instance. Which conditions match depends on `moduleResolution`
(`nodenext` matches `node`, `bundler` does not), and extra ones require
`customConditions`, which is gated to those same three resolvers.

**What is the cost of migrating from `paths` to `"imports"`?**
A mechanical rename of every specifier from `@app/...` to `#app/...`, plus
writing extensions if you are under the Node family. In exchange you delete a
build step or a second config file, and you stop having to think about who
resolves aliases at runtime.

**Does `"imports"` work across packages in a monorepo?**
No — it is scoped to the nearest ancestor `package.json`, so each package has its
own. Cross-package resolution is a separate problem with separate answers
(workspaces, project references, or built `.d.ts`), and it is not what this field
is for.

---

← [03 · Closing the gap](./03-closing-the-gap.md) · Next → [05 · The decision](./05-the-decision.md)
