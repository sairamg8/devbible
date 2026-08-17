---
title: "Validating the result — you cannot check this from inside"
sidebar_label: "07 · Validating the result"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`arethetypeswrong` problem documentation**
> (`NoResolution.md`, `InternalResolutionError.md`, `UnexpectedModuleSyntax.md`,
> `FalseCJS.md`, `FalseESM.md`, `CJSResolvesToESM.md`, `NamedExports.md`,
> `FalseExportDefault.md` — quoted verbatim) and **publint's published rule
> list** on publint.dev, whose rule names are quoted exactly. **No sandbox, no
> console blocks** — no tool was run here, and no output is reproduced.

Everything in the previous six chunks is a claim your package makes to a consumer
you do not control. And here is the uncomfortable fact that makes this chunk
necessary:

> 🔴 **A green build of your own package proves almost nothing about its types.**

Your build compiles `src`. It never performs the consumer's `import`. It does not
read your `exports` map, does not choose a condition, does not apply extension
substitution, and does not run under `moduleResolution: node10`. Every failure in
this topic is invisible to it by construction.

## The two tools, and what each is for

They are complementary, not alternatives, and they answer different questions.

| | `arethetypeswrong` | `publint` |
|---|---|---|
| **Question** | *"Can a consumer resolve and use your types, from every resolution mode?"* | *"Is this `package.json` correct and complete?"* |
| **Method** | Resolves your entrypoints as a consumer would, under each mode | Lints the manifest and the published file tree |
| **Catches** | The masquerades, the export-form mismatches, resolution failures | Condition ordering, missing files, unpublished files, format contradictions |

```bash
npx @arethetypeswrong/cli --pack .
npx publint
```

📌 **`--pack` matters.** It runs `npm pack` first, so the analysis is of the
**tarball**, not your working tree. That is the only way to catch a `types`
target excluded by `files`/`.npmignore` — which
[chunk 03](./03-exports-and-the-types-condition.md) flagged as indistinguishable
from a typo, and which `publint` reports separately as `FILE_NOT_PUBLISHED`
(*"File exists locally but won't be included in npm package"*).

## The problem catalogue, and what each one means

Worth knowing by name, because the names are how the failure gets communicated in
an issue thread.

### The two masquerades

Covered in [chunk 01](./01-the-one-rule.md) — the types imply one module format
and Node resolves the other. **Fix: pair the declarations.**

### ESM-only entrypoint

*"a `require` call resolved to an ESM JavaScript file, which is an error in Node
and some bundlers."* **Not a bug in your types** — the types and implementation
agree. Ship a CommonJS build or document `await import()`.

### 💀 Resolution failed

> *"Import failed to resolve to type declarations or JavaScript files."*

The consequences are stated plainly: *"Consumers will see TypeScript errors on
imports/requires"*, and *"If the diagnosis is accurate, a runtime/bundle-time
error will occur."*

🔴 **Two causes, and the documentation separates them for you.**

**A false positive worth knowing about:** TypeScript does not record non-JS/TS
files as resolution results, so a subpath exposing a `.css` file *"will show up
as a failed resolution"*. The doc's own guidance: *"If the asset is intended to
be imported as a side-effect import (`import "pkg/styles.css"`), this problem can
safely be ignored."* — a point **16 · Typing non-code imports** *(not written
yet)* picks up.

**A true positive that only affects one column:** when it fires for `node10` and
nothing else, it usually means subpaths are mapped through `exports` into `dist`,
and `node10` does not read `exports`. That is chunk 02's `node10` audience seen
from the tool's side. The doc is candid about the trade — *"few libraries care
about supporting a long-past EOL version of Node"*, but *"many TypeScript users
are still using `--moduleResolution node`"*, and migrating away is hard for them
precisely because it *"introduces new errors caused by incorrect dependency
typings — the problem this tool was made to diagnose."*

📌 **There is a switch for deciding you do not care:** the CLI's `--profile
node16` ignores issues that only affect `node10`. Using it is a deliberate scope
decision, which is better than silencing rows one at a time.

### Internal resolution error

> *"Import found in a type declaration file failed to resolve. Either this
> indicates that runtime resolution errors will occur, or (more likely) the types
> misrepresent the contents of the JavaScript files."*

🔴 **The first consequence connects straight back to
[topic 10](../10-skiplibcheck/README.md):**

> *"Consumers without `skipLibCheck` enabled will see a TypeScript error reported
> on declaration files from the package in their node_modules."*

That is topic 10's whole argument arriving from the other direction. `skipLibCheck`
is how most consumers avoid seeing this — and the ones who have it off, correctly,
are the ones who report it to you. Second consequence: *"Some exported types may
be missing or substituted with `any`."*

The documented causes are worth quoting because they are specific:

- **Mismatched generation tools** — *"declarations generated via TypeScript under
  certain settings, while the JavaScript is generated by another tool entirely"*.
  A very common modern shape: `tsc` for types, esbuild/swc/Rollup for code.
- **Wrong compiler settings.** Library authors should compile with
  `--module node16 --moduleResolution node16` (or `nodenext`), because *"this is
  the only TypeScript mode that recognizes Node's strict module resolution
  algorithm for ESM."*
- 🔴 **A `package.json` dropped into the output directory after the build** that
  changes the format *"to/from `"type": "module"`"* — if it differs from what
  TypeScript saw while compiling. **That is exactly
  [chunk 04](./04-dual-esm-cjs.md)'s answer-1 marker**, and it means the marker
  must be consistent with what the compile assumed, not merely present.

### Unexpected module syntax

> *"Syntax detected in the module is incompatible with the module kind according
> to the package.json or file extension."*

CommonJS files containing `import`/`export`, or ESM files using `require()`. The
documented origin is *"packages that were only intended to be consumed by
bundlers for frontend use"* — bundlers are permissive where Node is not — and the
consequence is blunt: such a file *"will crash (or fail to bundle)"* under Node's
rules.

### Named exports · False export default

Both covered in [chunk 05](./05-export-equals-vs-default.md).

## What `publint` adds

Several of its error rules are this topic's earlier chunks, mechanised:

| Rule | Which chunk it enforces |
|---|---|
| `EXPORTS_TYPES_SHOULD_BE_FIRST` | [Chunk 03](./03-exports-and-the-types-condition.md)'s ordering rule |
| `EXPORTS_TYPES_INVALID_FORMAT` | *"Type files must match their context (ESM vs CJS)"* — the golden rule |
| `TYPES_NOT_EXPORTED` | *"TypeScript cannot locate types for exported modules"* |
| `FILE_NOT_PUBLISHED` | The `files`/`.npmignore` trap |
| `FILE_DOES_NOT_EXIST` | A `types` target that is not there |
| `EXPORTS_DEFAULT_SHOULD_BE_LAST` | The other half of condition ordering |
| `FILE_INVALID_EXPLICIT_FORMAT` | *"File format contradicts its extension (.mjs/.cjs)"* |
| `NESTED_PACKAGE_JSON_FIELD_IGNORED` | ⚠️ `exports`/`imports` in a nested manifest **are ignored by Node** |

🔴 **That last one is a genuine trap for chunk 04's answer 1.** The nested
`dist/cjs/package.json` marker is legitimate and necessary — but it may only
carry `"type"`. Putting `exports` in it does nothing, and `publint` says so.

📌 Its suggestions are worth reading once even though they are not correctness
issues — `USE_FILES`, `USE_TYPE`, `USE_ENGINES_NODE` and `USE_SIDE_EFFECTS` each
remove a class of ambiguity a consumer would otherwise have to guess at.

## Wire it into CI, not into your memory

```jsonc
// package.json
{
  "scripts": {
    "check:types":   "tsc --noEmit -p tsconfig.build.json",
    "check:package": "attw --pack . && publint",
    "prepublishOnly": "npm run build && npm run check:package"
  }
}
```

The ordering is the point: `check:types` uses `skipLibCheck: false`
([topic 10 chunk 08](../10-skiplibcheck/08-choosing-it.md)) so **your own**
declarations are validated, and `check:package` validates that a consumer can
reach them. Neither substitutes for the other.

⚠️ **`prepublishOnly` rather than a manual step**, because this is precisely the
class of mistake that is caught on the run where somebody was in a hurry.

## The manual check, when you want to see it yourself

The tools are better, but understanding what they do is worth ten minutes:

```
/tmp-consumer-esm/          package.json { "type": "module" }
                            tsconfig.json { "module": "nodenext",
                                            "moduleResolution": "nodenext" }
                            index.ts      import x from 'your-pkg'

/tmp-consumer-cjs/          package.json { "type": "commonjs" }
                            …same, and: import x = require('your-pkg')
```

Install the **packed tarball** (`npm pack`, then `npm i ../your-pkg-1.0.0.tgz`)
rather than linking the source directory — a symlink or workspace link resolves
differently and will not reproduce the failure you are hunting.

## Gotchas

**Symptom:** Everything passes locally and consumers report broken types.
**Cause:** Your build never performs a consumer's import.
**Fix:** `attw --pack .` and `publint`. There is no configuration of your own
build that substitutes for them.

**Symptom:** `attw` reports a failure that only appears in the `node10` column.
**Cause:** Subpaths mapped through `exports`, which `node10` does not read.
**Fix:** Decide whether you support that audience. If not, `--profile node16`
records the decision instead of ignoring rows individually.

**Symptom:** "Resolution failed" on a `.css` subpath.
**Cause:** Documented false positive — TypeScript does not record non-JS/TS files
as resolution results.
**Fix:** Safe to ignore for a side-effect import.

**Symptom:** "Internal resolution error", and the JavaScript is generated by
esbuild while the types come from `tsc`.
**Cause:** The named cause — two tools with different assumptions.
**Fix:** Compile declarations with `--module node16 --moduleResolution node16`,
and make sure both tools see the same `"type"`.

**Symptom:** A `dist/esm/package.json` marker was added and "internal resolution
error" appeared.
**Cause:** The marker changed the format *after* TypeScript compiled under a
different assumption.
**Fix:** The compile and the marker must agree. Chunk 04.

**Symptom:** `exports` was added to a nested `dist/*/package.json` and has no
effect.
**Cause:** Node ignores `exports`/`imports` in nested manifests —
`NESTED_PACKAGE_JSON_FIELD_IGNORED`.
**Fix:** Only `"type"` belongs there. The real map lives in the root manifest.

**Symptom:** Validation passes on the working tree and the published package is
broken.
**Cause:** You validated `dist/`, not the tarball.
**Fix:** `--pack`, always. `FILE_NOT_PUBLISHED` exists because this is common.

**Symptom:** Someone links the package with `npm link` to test and it works.
**Cause:** A link resolves through the source layout, not the published one.
**Fix:** Install the packed tarball into a scratch consumer.

**Symptom:** CI runs the checks and nobody looks at the output.
**Cause:** They were added as an informational step.
**Fix:** `prepublishOnly`, so a failure blocks the publish rather than annotating
it.

## Interview questions

**★ Why is a green build of your own package insufficient evidence that its types
are correct?**
Because your build compiles your source; it never performs a consumer's import.
It does not read your `exports` map, choose a condition, apply extension
substitution, or run under other resolution modes — so every publishing failure
is invisible to it by construction.

**★ What do `arethetypeswrong` and `publint` each check?**
`attw` resolves your entrypoints as a consumer would under every resolution mode
and reports mismatches between what the types imply and what resolves. `publint`
lints the manifest and the published file tree — condition ordering, missing or
unpublished files, format contradictions. Different questions; run both.

**★ Why run `attw --pack` rather than pointing it at your directory?**
Because it packs the tarball first, so the analysis covers exactly what
consumers receive. A `types` target excluded by `files` or `.npmignore` is
otherwise invisible — `publint` has a rule for it, `FILE_NOT_PUBLISHED`.

**★ "Internal resolution error" — what does it usually mean?**
That an import inside your `.d.ts` does not resolve, which more often means the
types misrepresent the JavaScript than that a runtime failure is coming.
Consumers *without* `skipLibCheck` see it as errors inside your package's files,
and some of your exported types may silently become `any`.

**★ How does that problem connect to `skipLibCheck`?**
It is the concrete case for topic 10: most consumers have `skipLibCheck: true` so
they never see it, which means the report reaches you only from the minority who
have it off — and it is your build's `skipLibCheck: false` pass that would have
caught it first.

**A failure appears only in the `node10` column. What does that tell you?**
That the problem is `exports`-related and affects only consumers on the legacy
resolution mode. Whether it matters is a scope decision — `--profile node16`
records "we do not support that" explicitly.

**What compiler settings does a library author's declaration build want, and
why?**
`--module node16 --moduleResolution node16` (or `nodenext`), because that is the
only mode that models Node's strict ESM resolution — so declarations generated
any other way can encode assumptions Node will not honour.

**Why does `npm link` fail to reproduce packaging bugs?**
Because a link resolves through the source layout rather than the published one,
so `exports`, `files` and the built output are all bypassed. Install the packed
tarball into a scratch consumer instead.

**What belongs in a nested `dist/*/package.json`?**
Only `"type"`. Node ignores `exports` and `imports` in nested manifests, and
`publint` reports it as `NESTED_PACKAGE_JSON_FIELD_IGNORED`.

---

← Prev: [06 · `typesVersions`](./06-typesversions.md) · Next → [08 · The checklist](./08-the-checklist.md)
