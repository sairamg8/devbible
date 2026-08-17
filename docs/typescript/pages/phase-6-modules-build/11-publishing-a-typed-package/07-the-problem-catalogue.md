---
title: "You cannot check this from inside — the problem catalogue"
sidebar_label: "07 · The problem catalogue"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`arethetypeswrong` problem documentation** —
> `NoResolution.md`, `InternalResolutionError.md`, `UnexpectedModuleSyntax.md`,
> `FalseCJS.md`, `FalseESM.md`, `CJSResolvesToESM.md`, `NamedExports.md` and
> `FalseExportDefault.md`, each quoted verbatim. **No sandbox, no console
> blocks** — no tool was run here and no output is reproduced.

Everything in the previous six chunks is a claim your package makes to a consumer
you do not control. And here is the uncomfortable fact that makes this chunk and
the next one necessary:

> 🔴 **A green build of your own package proves almost nothing about its types.**

Your build compiles `src`. It never performs the consumer's `import`. It does not
read your `exports` map, does not choose a condition, does not apply extension
substitution, and does not run under `moduleResolution: node10`. Every failure in
this topic is invisible to it **by construction** — not because your build is
misconfigured, but because it is asking a different question.

This chunk is the catalogue of what can be wrong. [Chunk 08](./08-wiring-the-checks-in.md)
is how to detect it.

## Why the names matter

`arethetypeswrong` gives each failure a name, and the names are worth learning
even if you never run the tool — because they are how the problem gets
communicated. An issue titled *"Masquerading as CJS"* tells a maintainer exactly
where to look; one titled *"types are broken"* starts a week of back-and-forth.

They also sort into three groups that need different responses, and confusing the
groups is the commonest wasted effort:

| Group | Meaning | Response |
|---|---|---|
| **Masquerade** | Types imply one module format, Node resolves the other | Fix the declarations — pair them |
| **Honest limitation** | Types and implementation agree; the consumer wanted something you do not ship | A product decision, not a bug |
| **Broken artefact** | The published tree does not resolve, or contains invalid syntax | Fix the build or the manifest |

## Group 1 — the masquerades

### Masquerading as CJS · Masquerading as ESM

Both covered in [chunk 01](./01-the-one-rule.md): one declaration file describing
two JavaScript files of different formats. **Fix: pair the declarations**, and
nest the `types` condition inside each of `import` and `require`
([chunk 03](./03-exports-and-the-types-condition.md)).

### False export default

[Chunk 05](./05-export-equals-vs-default.md). *"The resolved types use
`export default` where the JavaScript file appears to use `module.exports =`."*
Fix: `export =`.

### Named exports

[Chunk 05](./05-export-equals-vs-default.md) again — the types claim named
exports that `cjs-module-lexer` cannot see. Fix: `exports.x =` form, or the
documented `0 &&` hint.

🔴 **All four are the same shape:** the declaration is a claim, the runtime is the
truth, and only the consumer's import compares them.

## Group 2 — the honest limitation

### ESM-only entrypoint

> *"a `require` call resolved to an ESM JavaScript file, which is an error in
> Node and some bundlers."*

**Nothing is masquerading** — the types and the implementation agree. The tool's
own framing is that this *"accurately reflects an actual runtime problem"*, and
that it *"typically occurs when library authors consciously decide to support
only ESM"*.

So the response is a decision, not a fix: ship a CommonJS build, or document
`await import()` and accept the documented cost — *"introducing asynchronicity
into a large synchronous codebase can be a prohibitively difficult refactor and a
breaking change for downstream APIs."*

⚠️ **Do not let this one send you editing declaration files.** It is the failure
most often misdiagnosed as a masquerade, because the consumer's error text looks
similar.

## Group 3 — the broken artefact

### 💀 Resolution failed

> *"Import failed to resolve to type declarations or JavaScript files."*

Consequences, stated plainly: *"Consumers will see TypeScript errors on
imports/requires"*, and *"If the diagnosis is accurate, a runtime/bundle-time
error will occur."*

🔴 **The documentation separates two very different causes, and you must too.**

**A documented false positive.** TypeScript does not record non-JS/TS files as
resolution results, so a subpath exposing a `.css` file *"will show up as a
failed resolution, when it might be more accurately described as an untyped
resolution of an unknown file type."* The guidance: *"If the asset is intended to
be imported as a side-effect import (`import "pkg/styles.css"`), this problem can
safely be ignored."* — which **16 · Typing non-code imports** *(not written yet)*
picks up.

**A true positive confined to one column.** When it fires for `node10` and
nothing else, it usually means subpaths are mapped through `exports` into `dist`
and `node10` does not read `exports` — chunk 02's legacy audience, seen from the
tool's side. The documentation is unusually candid about the trade: *"few
libraries care about supporting a long-past EOL version of Node"*, but *"many
TypeScript users are still using `--moduleResolution node`"*, and migrating away
is hard for them precisely because it *"introduces new errors caused by incorrect
dependency typings — the problem this tool was made to diagnose."*

📌 A circular problem, then: the packages that would push consumers off `node10`
are the same ones whose breakage keeps them there.

### Internal resolution error

> *"Import found in a type declaration file failed to resolve. Either this
> indicates that runtime resolution errors will occur, or (more likely) the types
> misrepresent the contents of the JavaScript files."*

🔴 **Its first consequence connects straight back to
[topic 10](../10-skiplibcheck/README.md):**

> *"Consumers without `skipLibCheck` enabled will see a TypeScript error reported
> on declaration files from the package in their node_modules."*

That is topic 10's argument arriving from the other direction, and it is worth
sitting with. Most consumers have `skipLibCheck: true`, so **they never see
this** — which means the report reaches you only from the minority who have it
off, and reaches you *late*. Second consequence: *"Some exported types may be
missing or substituted with `any`"* — silent, and far worse.

The documented causes are specific enough to act on:

- **Mismatched generation tools** — *"declarations generated via TypeScript under
  certain settings, while the JavaScript is generated by another tool entirely."*
  A very common modern shape: `tsc` for declarations, esbuild/swc/Rollup for the
  code.
- **Wrong compiler settings.** Compile declarations with
  `--module node16 --moduleResolution node16` (or `nodenext`), because *"this is
  the only TypeScript mode that recognizes Node's strict module resolution
  algorithm for ESM."*
- 🔴 **A `package.json` dropped into the output directory after the build**, one
  that changes the format *"to/from `"type": "module"`"* and differs from what
  TypeScript saw while compiling. **That is exactly
  [chunk 04](./04-dual-esm-cjs.md)'s answer-1 marker** — which means the marker
  must *agree with the compile*, not merely exist.

### Unexpected module syntax

> *"Syntax detected in the module is incompatible with the module kind according
> to the package.json or file extension."*

CommonJS files containing `import`/`export`, or ESM files using `module.exports`
or `require()`. The documented origin is *"packages that were only intended to be
consumed by bundlers for frontend use"* — bundlers are permissive where Node's
detection is strict, so the mismatch went unnoticed. The consequence is blunt: a
file triggering it *"will crash (or fail to bundle)"* under Node's rules.

## Reading the matrix

The tool reports per **entrypoint × resolution mode**, and the shape of the
result is itself diagnostic:

| Pattern | Reading |
|---|---|
| One row broken, all modes | That entrypoint's `exports` entry or its declarations |
| One column broken (`node10`) | An `exports`-only package meeting the legacy audience |
| One column broken (`node16` CJS) | Almost always a masquerade or a missing `.d.cts` |
| Everything broken | The manifest or the tarball, not the types — start with chunk 08's `publint` |

🔴 **Diagnose by the shape before reading any individual message.** A column
failure and a row failure have completely different causes, and the per-cell text
is the same either way.

## Gotchas

**Symptom:** Everything passes locally and consumers report broken types.
**Cause:** Your build never performs a consumer's import.
**Fix:** No configuration of your own build substitutes for resolving from
outside. Chunk 08.

**Symptom:** "ESM-only entrypoint" and a maintainer starts editing `.d.ts` files.
**Cause:** Misread as a masquerade.
**Fix:** The types are accurate. The decision is whether to ship CommonJS.

**Symptom:** "Resolution failed" on a `.css` subpath.
**Cause:** The documented false positive — TypeScript does not record non-JS/TS
files as resolution results.
**Fix:** Safe to ignore for a side-effect import.

**Symptom:** "Internal resolution error", with types from `tsc` and code from
esbuild.
**Cause:** The named cause — two tools with different assumptions about module
format.
**Fix:** Compile declarations with `node16`/`nodenext`, and make both tools see
the same `"type"`.

**Symptom:** Adding a `dist/esm/package.json` marker produced "internal
resolution error".
**Cause:** The marker changed the format after TypeScript compiled under a
different assumption.
**Fix:** The compile and the marker must agree — chunk 04.

**Symptom:** "Unexpected module syntax" in a package that works fine in a
bundler.
**Cause:** Bundlers are more permissive than Node's module detection.
**Fix:** It will crash under Node. Fix the emitted syntax or the declared format.

**Symptom:** Only the `node10` column fails and it is treated as urgent.
**Cause:** It affects only consumers on the legacy resolution mode.
**Fix:** A scope decision. Chunk 08 shows how to record it rather than ignore it.

**Symptom:** A consumer reports errors *inside* your package's `.d.ts` files.
**Cause:** Internal resolution error, and they have `skipLibCheck: false`.
**Fix:** Yours to fix — and your own `skipLibCheck: false` declaration build
would have caught it first ([topic 10 chunk 08](../10-skiplibcheck/08-choosing-it.md)).

## Interview questions

**★ Why is a green build of your own package insufficient evidence that its types
are correct?**
Because your build compiles your source and never performs a consumer's import.
It does not read your `exports` map, choose a condition, apply extension
substitution, or run under other resolution modes — so every publishing failure
is invisible to it by construction.

**★ Name the three groups the publishing problems fall into.**
Masquerades (the types imply one module format and Node resolves the other),
honest limitations (types and implementation agree; the consumer wanted something
you do not ship), and broken artefacts (the tree does not resolve, or contains
syntax invalid for its declared format). Each needs a different response.

**★ "Internal resolution error" — what does it usually mean?**
That an import inside your `.d.ts` does not resolve, which more often means the
types misrepresent the JavaScript than that a runtime failure is imminent.
Consumers without `skipLibCheck` see errors inside your package's files, and some
of your exported types may silently become `any`.

**★ How does that connect to `skipLibCheck`?**
Most consumers have it on, so they never see the error — which means it reaches
you only from the minority who have it off, and reaches you late. Your own
`skipLibCheck: false` declaration build is what should have caught it.

**★ What causes "internal resolution error" most often in a modern setup?**
Generating declarations with `tsc` while generating the JavaScript with something
else — esbuild, swc, Rollup — so the two disagree about module format. The
documented fix is to compile declarations under `node16`/`nodenext`, the only
mode that models Node's strict ESM resolution.

**A failure appears only in the `node10` column. What does that tell you?**
That it is `exports`-related and affects only the legacy resolution mode.
Whether it matters is a scope decision, not a bug report.

**Why is "resolution failed" on a `.css` subpath not necessarily a bug?**
Because TypeScript does not record non-JS/TS files as resolution results, so an
intentional asset subpath is indistinguishable from a missing file. For a
side-effect import it can safely be ignored.

**Why does "unexpected module syntax" so often come from frontend packages?**
Because they were built for bundlers, which are permissive about module syntax
where Node's detection is strict. The file works everywhere it was tested and
crashes under Node.

**What should you look at before reading any individual message in the matrix?**
The shape. A whole row failing points at one entrypoint; a whole column points at
one resolution mode; everything failing points at the manifest or the tarball
rather than the types.

---

← Prev: [06 · `typesVersions`](./06-typesversions.md) · Next → [08 · Wiring the checks in](./08-wiring-the-checks-in.md)
