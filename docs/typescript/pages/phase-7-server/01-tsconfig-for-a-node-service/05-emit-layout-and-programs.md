---
title: "Emit, layout and programs"
sidebar_label: "05 · Emit, layout and programs"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** on typescriptlang.org
> (`verbatimModuleSyntax`, `isolatedModules`, `rootDir`, `outDir`, `extends`)
> and the **Node.js API docs** (*Modules: TypeScript* — the `type` keyword
> requirement under type stripping). `TS6059`, `TS5055`, `TS5056` and the
> `verbatimModuleSyntax` option help were read out of the **compiler's own
> diagnostic table** — codes from the **5.9.3** numbered table, wording
> confirmed against the strings in the **TypeScript 7.0.2** binary. **No
> sandbox, no console block.**

[Chunk 04](./04-the-annotated-configs.md) showed both files whole. Three of their
lines carry more weight than a one-row table can hold, and each has its own
distinct failure mode:

- `verbatimModuleSyntax` — **the code runs differently without it**
- `rootDir` — **the output moves without it**
- one config per program — **the editor checks a different program without it**

## `verbatimModuleSyntax` — and why it is not optional on Path B

Default `false`. What it does is described by the compiler's own option help,
read out of the message table:

> Do not transform or elide any imports or exports not marked as type-only,
> ensuring they are written in the output file's format based on the 'module'
> setting.

Unpack "elide". Without this flag, TypeScript performs **import elision**: it
looks at every import, works out which bindings were only ever used in type
position, and quietly deletes them from the emitted output.

```ts
import { createUser, User } from './user.js';

const u: User = createUser();     // `User` used only as a type
```

`tsc` emits `import { createUser } from './user.js'` — `User` is gone, because
the compiler could see the whole program and prove it was never a value.

**That proof requires whole-program knowledge, and it is exactly what a
single-file tool cannot do.** Node's stripper, esbuild, SWC and Babel each see
one file at a time. They cannot know whether `User` is a class (a value that must
stay) or an interface (a type that must go), so they leave the import alone — and
Node then looks for an export named `User` that does not exist.

```ts
import { createUser, User } from './user.ts';        // ✗ runtime error on Path B
import { createUser, type User } from './user.ts';   // ✓
import type { User } from './user.ts';               // ✓
```

Node's documentation is explicit that the first form is a runtime error under
type stripping. `verbatimModuleSyntax` makes TypeScript reject it at check time
instead — it forces the *intent* to be written down rather than inferred.

📌 The general rule, worth carrying past this page: **any tool that compiles one
file at a time needs `verbatimModuleSyntax`.** Only `tsc`, which sees the whole
program, can get away without it — and even there the flag makes the output
predictable.

### The weaker sibling: `isolatedModules`

Default `false`. Enforces that each file can be transpiled *alone*, which is the
same underlying concern from a different angle. `verbatimModuleSyntax` subsumes
most of its import/export rules; `isolatedModules` additionally catches things
`verbatimModuleSyntax` does not, such as re-exporting a type without `export
type` and `const enum` across file boundaries.

Turning both on is common, harmless, and the honest default for any project whose
production build is not literally `tsc`.

## `rootDir`, `outDir`, and the layout that moves under you

`rootDir` defaults to **the longest common path of all non-declaration input
files**. That default is a trap, because it is computed from the file set rather
than declared:

```
src/server.ts                      rootDir inferred "src"  → dist/server.js
src/server.ts + scripts/seed.ts    rootDir inferred "."     → dist/src/server.js
```

Adding one file moved every output. Your `Dockerfile` still says
`node dist/server.js`, and now that path does not exist. Nothing in the type
system can catch this, because nothing about it is a type.

Set `rootDir` explicitly and the same situation becomes a compile error:

```text
error TS6059: File '{0}' is not under 'rootDir' '{1}'. 'rootDir' is expected to
contain all source files.
```

TypeScript 7 adds a more directive variant of the same advice, present in the
7.0.2 binary's message table and absent from 5.9.3's:

```text
The common source directory of '{0}' is '{1}'. The 'rootDir' setting must be
explicitly set to this or another path to adjust your output's file layout.
```

Two more that appear only when the layout is wrong:

```text
error TS5055: Cannot write file '{0}' because it would overwrite input file.
error TS5056: Cannot write file '{0}' because it would be overwritten by multiple input files.
```

`TS5055` is what you get with `allowJs` on and no `outDir` — `tsc` tries to write
`foo.js` over the `foo.js` it just read. `TS5056` is two inputs mapping to one
output: `a.ts` and `a.js` in the same directory, or `a.ts` and `a.tsx`.

⚠️ **`rootDir` does not add files to the program.** It only declares where the
output tree is rooted. A file outside it that something imports is still
compiled — it is the *emit path* that becomes an error. That distinction is the
same one `exclude` has ([chunk 03](./03-target-lib-and-types.md)): these options
shape layout and globbing, not program membership. **Imports decide membership.**

## One `tsconfig.json` per program

The final structural point, and the source of the "the editor disagrees with the
build" class of bug that
[phase 0 · editor vs build](../../phase-0-how-typescript-runs/09-language-server-vs-build.md)
covers in full.

A service usually needs three programs — source, tests, and build scripts — with
different `types` arrays and different `noEmit` settings. Trying to serve all
three from one config produces a config that is wrong for each of them:

```
tsconfig.base.json     module, lib, strict block, skipLibCheck — no layout
tsconfig.json          extends base; include ["src"]; rootDir/outDir
tsconfig.test.json     extends base; include ["src","test"]; noEmit; types +runner
```

⚠️ **`extends` merges shallowly, per option.** An `include` or a `types` array in
the child *replaces* the parent's — it does not concatenate. So
`tsconfig.test.json` must list `["node", "vitest"]`, not `["vitest"]`, or it
silently loses Node's globals and you get `TS2591` (the "add 'node' to the types
field" variant from [chunk 03](./03-target-lib-and-types.md)) rather than
anything that names the real cause.

`extends` also resolves relative paths in the *child's* directory for most
options, which is why layout options belong in the child and never in the base.

📌 **Project references** (`composite`, `references`) are the heavier version of
this, and worth reaching for only when the programs genuinely depend on each
other's *output* — a shared package built before the service that consumes it.
For one service with tests, three plain configs and one `extends` is enough.

## Gotchas

**Symptom:** works under `tsc`, but `ReferenceError` or "does not provide an
export named X" under `node src/server.ts`, esbuild or SWC.
**Cause:** import elision. `tsc` deleted a type-only import that a single-file
tool cannot recognise as type-only, so the tool emits a real import of a binding
that has no runtime existence.
**Fix:** `verbatimModuleSyntax: true`, plus `import type` or inline `type`
markers. The errors it raises are the list of places this was going to happen.

**Symptom:** the Docker image cannot find `dist/server.js` after a commit that
only *added* a file.
**Cause:** `rootDir` was inferred; a new file outside `src/` moved the common
source directory, and every output gained a directory level.
**Fix:** always set `rootDir` explicitly, so the change fails at build time with
`TS6059` instead of at container start.

**Symptom:** `tsc` refuses to write output, complaining it would overwrite an
input.
**Cause:** `TS5055` — `allowJs` with no `outDir`, so input and output paths
collide. Or `TS5056` — two source files mapping to the same emitted name.
**Fix:** an `outDir` that is not the source tree; and never keep `a.ts` beside a
generated `a.js`.

**Symptom:** the editor shows errors CI does not, or the reverse.
**Cause:** the editor loaded a different `tsconfig.json` — commonly the test
one, because its `include` is wider and it matched the file first.
**Fix:** one program per config, an explicit `include` in each, and check which
project the language server actually loaded before debugging anything else.

**Symptom:** the test config compiles but `process` and `Buffer` are suddenly
unknown.
**Cause:** `extends` replaced rather than merged the `types` array — the child
listed only the test runner.
**Fix:** repeat `"node"` in every child's `types`. Shallow merge is per option,
not per element.

## Interview questions

**Why is `verbatimModuleSyntax` mandatory when a single-file tool compiles your
code?**
Because import elision — deciding an imported binding was only ever a type and
deleting it — requires whole-program knowledge. A per-file stripper cannot
distinguish an interface from a class, so it leaves the binding in the import
statement and the runtime fails to find the export. The flag forces the intent
to be written as `import type`, which any tool can honour locally.

**What breaks if you delete `rootDir`?**
Nothing, until the input set changes shape. `rootDir` then defaults to the
longest common path of the inputs, so adding a file outside `src/` silently
re-parents every emitted file. It is a build-layout bug that no type error will
ever catch, and it typically surfaces as a container that will not start.

**Does `exclude` keep a file out of the program?**
No. `exclude` filters what `include` globbed; a file reached by an `import` from
an included file is compiled regardless. `rootDir` is the same shape of option —
it constrains the emit layout, not membership. **Imports decide membership.**

**How do `extends` and arrays interact?**
Shallowly, per option: a child's array *replaces* the parent's. The classic
casualty is `types` — a test config that lists only its runner loses `@types/node`
and starts reporting `TS2591` on `process`, which names a cause the reader will
not connect to `extends`.

**When do you reach for project references rather than three configs?**
When the programs depend on each other's *build output*, not merely on each
other's source — a shared package that must be built before the service that
consumes it. For one service plus its tests, `extends` is sufficient and far
cheaper to reason about.

---

← [04 · The annotated configs](./04-the-annotated-configs.md) · Next → [Phase 7 index](../README.md)
