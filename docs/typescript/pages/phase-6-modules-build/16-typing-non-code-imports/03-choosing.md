---
title: "Bundler suffixes, and choosing"
sidebar_label: "03 · Suffixes and choosing"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the mechanisms and diagnostics relied on here are
> [chunk 01](./01-the-three-mechanisms.md)'s and
> [chunk 02](./02-json.md)'s, each read from the installed **TypeScript 5.9.3**
> build. The `arethetypeswrong` note on non-JS asset subpaths is quoted from its
> `NoResolution.md`. **No sandbox, no console blocks.**

The last piece: query-suffix specifiers, which bundlers invented and TypeScript
has no opinion about.

```ts
import shaderSource from './shader.glsl?raw';   // the file's text
import logoUrl      from './logo.svg?url';      // a URL string
import Worker       from './worker.ts?worker';  // a constructor
```

## Why only the wildcard works here

🔴 **`allowArbitraryExtensions` cannot help**, and the reason is precise: its
lookup substitutes the *extension* — `foo.css` → `foo.d.css.ts`
([chunk 01](./01-the-three-mechanisms.md)). A specifier ending `?raw` does not
have a recognised extension at its end at all; the suffix is not part of any
filename on disk.

So the wildcard is the only mechanism that applies, and it works well because the
suffix is exactly the kind of thing a pattern matches:

```ts
declare module '*?raw' {
  const content: string;
  export default content;
}

declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*?worker' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}
```

📌 **Order the patterns most-specific first** if any overlap. `'*.svg?url'` and
`'*?url'` can both match, and a general `'*.svg'` declaring a URL string will
also match `./logo.svg?url` in some configurations — so if you use both forms,
declare the suffixed ones explicitly.

⚠️ **These declarations are pure fiction as far as the runtime is concerned.**
The suffix means something only because your bundler was configured to give it
meaning. Change bundler and the types keep type-checking while the imports stop
resolving — the failure mode [chunk 01](./01-the-three-mechanisms.md) opens
with, at its sharpest.

## If you publish a package with asset subpaths

One consequence worth knowing, from
[topic 11](../11-publishing-a-typed-package/README.md)'s tooling: a package whose
`exports` map exposes a `.css` file will show up in `arethetypeswrong` as a
resolution failure, because *"TypeScript doesn't record non-JS/TS files as
resolution results"*. Its own guidance:

> *"If the asset is intended to be imported as a side-effect import (`import
> "pkg/styles.css"`), this problem can safely be ignored."*

🔴 **A documented false positive**, and the only one in that tool's catalogue.
Worth recognising so it does not get "fixed".

## Choosing, in one place

```
does the FILE'S CONTENT need to affect the type?

├─ no — it is opaque (image, font, text, a URL)
│    → wildcard `declare module '*.ext'`
│      simplest, no flag, one shape for all of them. Correct.
│
├─ yes, and it is JSON
│    → resolveJsonModule
│      TypeScript reads it. Mind the widening and the program-input cost.
│
├─ yes, and it is not JSON (CSS-module class names, generated constants)
│    → allowArbitraryExtensions + a generator emitting foo.d.<ext>.ts
│      precise, and you now own a build step.
│
└─ it is a bundler query suffix (?raw, ?url, ?worker)
     → wildcard. Nothing else can match it.
```

## The rule that keeps this area sane

**Put every ambient declaration for non-code imports in one file, and say in a
comment what makes each one true.**

```ts
// src/assets.d.ts — ambient declarations for non-code imports.
// Each of these is a claim that our BUNDLER handles the specifier.
// If you change bundler, re-verify every one of them.

declare module '*.svg'  { const src: string; export default src; }
declare module '*?raw'  { const content: string; export default content; }
```

🔴 **The comment is the load-bearing part**, because these declarations are the
one place in a TypeScript codebase where the compiler is being *told* something
rather than working it out. Nothing will ever re-check them, and the day someone
swaps Vite for something else, that file is the checklist.

⚠️ **And remember the file must be a script, not a module** — no top-level
`import`/`export` — or none of it is ambient
([topic 07 chunk 07](../07-authoring-d-ts-files/07-declare-module-and-choosing.md)).

## Gotchas

**Symptom:** `allowArbitraryExtensions` does not help a `?raw` import.
**Cause:** Its lookup substitutes the extension; a query suffix is not one.
**Fix:** A wildcard `declare module '*?raw'`.

**Symptom:** Two wildcard patterns both match and the wrong shape wins.
**Cause:** Overlapping patterns.
**Fix:** Declare the more specific suffixed form explicitly.

**Symptom:** Imports type-check and fail after switching bundler.
**Cause:** The declarations asserted behaviour the old bundler provided.
**Fix:** They are claims, not facts. Re-verify each one — which is what the
comment is for.

**Symptom:** `arethetypeswrong` reports a resolution failure on a published
`.css` subpath.
**Cause:** The documented false positive — TypeScript does not record non-JS/TS
files as resolution results.
**Fix:** Safe to ignore for a side-effect import.

**Symptom:** The assets declaration file stopped working after someone added an
import to it.
**Cause:** It became a module, so the declarations are no longer ambient.
**Fix:** Keep it a script. Topic 07 chunk 07.

**Symptom:** A CSS-modules setup catches no class-name typos.
**Cause:** A wildcard `Record<string, string>` accepts every key.
**Fix:** Per-file declarations, if that precision is worth owning a generator.

**Symptom:** Generated `.d.css.ts` files are committed and drift.
**Cause:** A generated artefact treated as source.
**Fix:** Generate them in the build and gitignore, or commit and regenerate in
CI with a check that the diff is empty.

**Symptom:** Nobody can find where `*.svg` is declared.
**Cause:** Ambient declarations scattered across the repo.
**Fix:** One file, commented. It is a checklist, not just configuration.

## Interview questions

**★ Why can't `allowArbitraryExtensions` type a `?raw` import?**
Because its lookup works by substituting the *extension* — `foo.css` becomes
`foo.d.css.ts`. A query suffix is not an extension and corresponds to no file on
disk, so only a wildcard `declare module '*?raw'` can match it.

**★ What is the deciding question between the three mechanisms?**
Whether the file's **contents** should affect the type. If not — an image URL is
a `string` regardless — the wildcard is right and simplest. If so, it is
`resolveJsonModule` for JSON and `allowArbitraryExtensions` plus a generator for
anything else.

**★ What is the risk that runs through all of these?**
They are assertions about a bundler, not facts about a runtime. They keep
type-checking after the bundler changes, so the build stays green while the
imports stop resolving.

**★ Why keep them all in one commented file?**
Because they are the one place the compiler is *told* something rather than
deriving it, and nothing will ever re-check them. That file is the checklist for
the day the toolchain changes.

**A published package exposes a `.css` subpath and `arethetypeswrong` flags it.
Is that real?**
No — it is the documented false positive: TypeScript does not record non-JS/TS
files as resolution results. For a side-effect import it can safely be ignored.

**What breaks a wildcard `declare module` file most often?**
Someone adding a top-level `import` or `export`, which makes it a module — at
which point none of its declarations are ambient any more.

**Should generated `.d.css.ts` files be committed?**
Either works, but pick one deliberately: generate in the build and gitignore, or
commit and have CI regenerate and assert the diff is empty. Drift is the failure
either way.

---

← Prev: [02 · JSON](./02-json.md) · Back to [the topic index](./README.md)
