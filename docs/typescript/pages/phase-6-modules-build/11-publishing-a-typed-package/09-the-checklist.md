---
title: "The checklist, and the dependency rules"
sidebar_label: "09 · The checklist"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Declaration Files →
> Publishing*, whose **Dependencies** guidance and **Red Flags** section are
> quoted verbatim — plus the sources named in the earlier chunks of this topic.
> **No sandbox, no console blocks.**

Eight chunks of mechanism. This is the part you keep.

## The dependency rules — easy to get wrong, expensive to fix

The handbook is direct about where type packages belong:

> *"Use `"dependencies"` (not `"devDependencies"`) so consumers of your package
> automatically receive necessary type declarations."*

with the worked example:

```json
{
  "name": "browserify-typescript-extension",
  "main": "./lib/main.js",
  "types": "./lib/main.d.ts",
  "dependencies": {
    "browserify": "latest",
    "@types/browserify": "latest",
    "typescript": "next"
  }
}
```

🔴 **The rule is about what your declarations *reference*, not about what your
code imports at runtime.** If `lib/main.d.ts` says `import { Foo } from
'other-pkg'`, then `other-pkg`'s types must arrive on the consumer's disk — and
`devDependencies` do not.

⚠️ **This is the most common cause of chunk 07's "internal resolution error"**
that is not a format problem: the declarations reference a package the consumer
never installed. It fails for them and never for you, because you have it.

📌 **`peerDependencies` is the honest home for `typescript` itself**, if your
declarations need a minimum version — see
[chunk 06](./06-typesversions.md)'s argument that raising the stated minimum
usually beats versioning declarations.

## The red flags, quoted

### `/// <reference path="..." />`

> **Don't:**
> ```ts
> /// <reference path="../typescript/lib/typescriptServices.d.ts" />
> ```
> **Do:**
> ```ts
> /// <reference types="typescript" />
> ```

A `path` reference points into a **relative file layout** that will not exist on
the consumer's disk. A `types` reference goes through package resolution and
does. [Topic 07 chunk 13](../07-authoring-d-ts-files/13-triple-slash-references.md)
covers the four directive forms; this is the one rule that matters at publish
time.

### Packaging somebody else's declarations

Three don'ts from the same section:

- **Don't** combine a dependency's declarations with yours.
- **Don't** copy the declarations into your package.
- **Do** depend on the npm type-declaration package.

🔴 **The reason is type identity.** A copied `Foo` is a *different* `Foo` from the
one the consumer gets from the real package — structurally identical, and
distinct wherever nominality leaks in. It is [chunk 04](./04-dual-esm-cjs.md)'s
dual-package hazard, created deliberately and for no benefit.

## The checklist

### Structure

- [ ] **One declaration file per JavaScript file** — the golden rule
      ([chunk 01](./01-the-one-rule.md)). No `.d.ts` describes two formats.
- [ ] **Extensions paired**: `.d.mts`↔`.mjs`, `.d.cts`↔`.cjs`, `.d.ts`↔`.js`
      with an explicit `"type"` ([chunk 04](./04-dual-esm-cjs.md)).
- [ ] If dual, **each output directory has its own `{"type": …}` marker** — and
      the marker agrees with what the compile assumed.
- [ ] Nested markers carry **`"type"` only**; `exports` there is ignored.

### The manifest

- [ ] **`types` first** in every conditions object; `default` last
      ([chunk 03](./03-exports-and-the-types-condition.md)).
- [ ] **A `types` condition inside each of `import` and `require`** where they
      resolve to different formats — one top-level `types` only where they do
      not.
- [ ] **Top-level `main` and `types`** for `node10` consumers, pointed at the
      CommonJS side ([chunk 02](./02-how-a-consumer-finds-your-types.md)).
- [ ] **`"./package.json": "./package.json"`** in `exports`.
- [ ] Every subpath consumers already use is **listed or pattern-matched** —
      adding `exports` is a breaking change.
- [ ] **`"type"` set explicitly** rather than inferred.

### The declarations

- [ ] `module.exports = x` is declared **`export = x`**, never `export default`
      ([chunk 05](./05-export-equals-vs-default.md)).
- [ ] Named exports are **analysable by `cjs-module-lexer`**, or carry the
      documented `0 &&` hint with a comment saying why.
- [ ] `@types/*` your declarations reference are in **`dependencies`**.
- [ ] **No `/// <reference path>`** anywhere.
- [ ] **No vendored copies** of another package's declarations.
- [ ] Declarations compiled with **`--module node16 --moduleResolution node16`**
      (or `nodenext`).

### The checks

- [ ] A build with **`skipLibCheck: false`** validates your own declarations
      ([topic 10 chunk 08](../10-skiplibcheck/08-choosing-it.md)).
- [ ] **`attw --pack .`** and **`publint`** both run.
- [ ] Both wired into **`prepublishOnly`** and into CI
      ([chunk 08](./08-wiring-the-checks-in.md)).
- [ ] Any `node10` scope decision recorded as **`--profile node16`**, not as
      suppressed rows.

## Three shapes that are correct

**A single-format ESM package** — the simplest thing that works, and the one to
prefer where your audience allows it:

```json
{
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./package.json": "./package.json"
  }
}
```

**A dual package with explicit extensions** — chunk 04's answer 2:

```json
{
  "main": "./dist/index.cjs",
  "types": "./dist/index.d.cts",
  "exports": {
    ".": {
      "import":  { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  }
}
```

**A CommonJS-only package** — still perfectly respectable, and ESM consumers can
`import` it:

```json
{
  "type": "commonjs",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./package.json": "./package.json"
  }
}
```

🔴 **Notice that the simplest correct package is the single-format one.** Every
additional format multiplies the failure surface, and nothing in this topic can
go wrong in a package that ships one.

## Gotchas

**Symptom:** Consumers get errors about a type your `.d.ts` imports.
**Cause:** The `@types` package is in `devDependencies`, so it never reaches
them.
**Fix:** Move it to `dependencies`. The rule is about what your declarations
reference.

**Symptom:** A `/// <reference path>` works locally and fails for consumers.
**Cause:** It points into a relative layout that does not exist on their disk.
**Fix:** `/// <reference types="…" />`, which resolves through the package
system.

**Symptom:** A vendored copy of another package's types causes assignability
errors.
**Cause:** Two distinct identities for the same nominal type.
**Fix:** Depend on the real package. Never copy declarations.

**Symptom:** `typescript` is in `dependencies` and consumers get a second copy.
**Cause:** It is a peer requirement, not a runtime dependency of your package.
**Fix:** `peerDependencies` with the minimum version your declarations need.

**Symptom:** The checklist passes and `attw` still reports a masquerade.
**Cause:** Something in the built output disagrees with the manifest — usually a
missing or contradictory `"type"` marker.
**Fix:** The tools are the authority; the checklist is a way to avoid needing
them.

**Symptom:** A package ships three formats and every release breaks something.
**Cause:** Multiplied failure surface.
**Fix:** Drop one. The simplest correct package ships a single format.

**Symptom:** `files` was added and the declarations disappeared from the tarball.
**Cause:** `files` is an allowlist.
**Fix:** Include `dist`. `attw --pack` and `publint`'s `FILE_NOT_PUBLISHED`
catch it.

**Symptom:** A major version added `exports` and issues arrived about missing
subpaths.
**Cause:** Expected — the presence of `exports` blocks everything unlisted.
**Fix:** Enumerate the old surface or add a `"./*"` pattern, and say so in the
changelog.

## Interview questions

**★ Where do `@types` packages your declarations reference belong?**
`dependencies`, not `devDependencies` — the handbook is explicit, because
consumers need those declarations to arrive on their disk. The rule is about what
your `.d.ts` files reference, not what your runtime code imports.

**★ Why is `/// <reference path="…" />` a red flag in a published package?**
It points into a relative file layout that will not exist on a consumer's disk.
`/// <reference types="…" />` resolves through package resolution and does.

**★ Why must you not copy a dependency's declarations into your package?**
Because the copied type is a distinct identity from the one the consumer gets
from the real package — structurally identical and non-interchangeable wherever
nominality applies. It manufactures the dual-package hazard for no benefit.

**★ What is the simplest package shape that cannot hit any problem in this
topic?**
A single-format package. Both masquerades, the two-identity hazard and the paired
declaration requirement all need two formats to exist.

**Where does `typescript` itself belong if your declarations need a minimum
version?**
`peerDependencies` — and often the better answer is simply to state the minimum
rather than ship versioned declarations at all.

**Which side should a dual package's top-level `main`/`types` point at?**
The CommonJS side, because they are read only by `node10` consumers, who are on
an old configuration and far more likely to be `require`-based.

**Why does `"./package.json": "./package.json"` belong in almost every `exports`
map?**
Because `exports` blocks unlisted subpaths, and a surprising amount of tooling
reads a dependency's manifest directly.

**What single check would you add to a package that has none?**
`attw --pack . && publint` in `prepublishOnly`. It covers the largest share of
this topic's failures for one line, and it blocks the publish rather than
annotating a build.

---

← Prev: [08 · Wiring the checks in](./08-wiring-the-checks-in.md) · Back to [the topic index](./README.md)
