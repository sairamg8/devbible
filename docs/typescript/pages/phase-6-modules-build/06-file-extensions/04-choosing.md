---
title: "04 — Choosing an extension"
sidebar_label: "04 · Choosing an extension"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** and the extension
> behaviour established in chunks 01–03, all read from the installed **TypeScript
> 5.9.3** build. **No sandbox, no console blocks.**

Most files should be `.ts`. This chunk is about the cases where they should not
be, and about the one extension decision that is not about modules at all.

## The default, and why it is the default

**Use `.ts`.** Its format is decided by `package.json` `"type"`, which means the
whole package moves together and one line changes all of it. That is the right
granularity nearly always: a package is ESM or it is CommonJS, and mixing is a
cost, not a feature.

`.mts` and `.cts` buy you a **per-file override**, and an override is only worth
having when something genuinely differs.

## When `.cts` earns its place

A CommonJS island inside an ESM package. The recurring cases:

- **A config file a tool loads with `require`.** Plenty of tools still do,
  regardless of your package's `"type"`.
- **Code needing `__dirname`, `__filename` or `require.resolve`.** These exist in
  CommonJS and not in ESM, and `import.meta.url` is not always a drop-in.
- **A native addon wrapper.** `.node` bindings load through `require`.
- **A file that must be `require`-able by a consumer** who has not moved to ESM.

⚠️ **What `.cts` does *not* solve is interop.** The emitted `.cjs` is CommonJS,
so importing it from ESM gives you the interop shape — a default-wrapped
namespace — not a live binding. Topic 09 (`esModuleInterop`, lane D) owns that
argument; the extension only decides the format, never how the two formats meet.

## When `.mts` earns its place

Less often, and the asymmetry is worth noticing. `.mts` is for an ESM island in a
CommonJS package, which is a harder position to be in:

- **A file using top-level `await`.** It is ESM-only, full stop.
- **A file importing an ESM-only dependency** statically, in a package that has
  not migrated.
- **An entry point published as the ESM half** of a dual package — though lane
  D's topic 11 argues that `exports` conditions are usually the better tool.

🔴 **`.mts` inside a CommonJS package is often a signal the package should
migrate.** One ESM file tends to become three, and each one is a boundary where
`require` stops working. If you are reaching for a second `.mts`, price the
migration instead.

## The rule of thumb

| Situation | Extension |
|---|---|
| Ordinary source file | `.ts` |
| Contains JSX | `.tsx` |
| Must be CommonJS in an ESM package | `.cts` |
| Must be ESM in a CommonJS package | `.mts` |
| Hand-written declarations | `.d.ts` — or `.d.mts`/`.d.cts` to match a specific file |
| More than two or three overrides | **stop; the package's `"type"` is wrong** |

That last row is the useful one. The unambiguous extensions are an **escape
hatch**, and a codebase with many of them has usually made a package-level
decision badly and is paying for it file by file.

## `.tsx` is a different kind of decision

`.tsx` is not about modules at all — it is about **parsing**, and it costs you one
piece of syntax:

```ts
// in a .ts file
const el = <HTMLInputElement>document.getElementById("x");   // ✅ angle-bracket assertion

// in a .tsx file
const el = <HTMLInputElement>document.getElementById("x");   // ❌ parsed as JSX
const el = document.getElementById("x") as HTMLInputElement; // ✅ the only form
```

In `.tsx`, `<T>` opens a JSX element, so the angle-bracket type assertion is
unavailable. `as` is the only spelling.

The same ambiguity bites generic arrow functions:

```tsx
const identity = <T>(x: T) => x;        // ❌ in .tsx — <T> looks like an element
const identity = <T,>(x: T) => x;       // ✅ the trailing comma disambiguates
const identity = <T extends unknown>(x: T) => x;   // ✅ also works
```

⚠️ **The `<T,>` trailing comma is not a style choice — it is a parser hint**, and
it is the single most-Googled piece of `.tsx` syntax. Nothing else in TypeScript
requires a comma to mean anything.

**Use `.tsx` only for files containing JSX.** Renaming every file to `.tsx` "for
consistency" costs the angle-bracket assertion and the clean generic arrow
everywhere, in exchange for nothing.

## Declarations: which `.d.*` to write

- **`.d.ts`** for almost everything. It is format-ambiguous, like the `.ts` it
  parallels.
- **`.d.mts` / `.d.cts`** only when describing a specific `.mjs`/`.cjs` file, or
  when the declaration itself uses format-specific syntax — `export =` in a
  `.d.cts`, top-level `await` types in a `.d.mts`.

⚠️ **A `.d.ts` describing a `.mjs` is a common and quiet error.** It resolves
under `bundler`, and under `node16`/`nodenext` the format mismatch produces
confusing errors about import forms that look like your code's fault.

Lane D's [topic 07 · Authoring `.d.ts` files](../07-authoring-d-ts-files/README.md)
covers what goes *inside* them; this is only about which extension goes on the
outside.

## Migration order, if you are adding the family to a codebase

1. **Decide the package's `"type"` first.** Everything else is an exception to
   it, and exceptions are cheaper once the rule is settled.
2. **Convert the files that genuinely cannot follow it** to `.cts` or `.mts`.
   There should be few.
3. **Fix the specifiers** — chunk 03. Renaming to `.mts`/`.cts` breaks
   extensionless imports outright (chunk 02) and changes the output extension
   every other file must name.
4. **Widen your tooling globs** to `**/*.{ts,mts,cts}`. Linters, formatters,
   Jest `testMatch`, bundler entry patterns — all of them.
5. **Check the published surface** if it is a library. A consumer on `node10`
   resolution cannot see `.d.mts` at all.

## Gotchas

**Symptom:** a codebase with a dozen `.cts` files.
**Cause:** the package declared `"type": "module"` before its dependencies or its
tooling were ready.
**Fix:** the escape hatch is being used as the strategy. Revisit the
package-level decision.

**Symptom:** `<T>(x: T) => x` errors in a `.tsx` file.
**Cause:** `<T>` parses as the start of a JSX element.
**Fix:** `<T,>` or `<T extends unknown>`. The comma is a parser hint.

**Symptom:** an angle-bracket assertion stopped working after a rename.
**Cause:** the file became `.tsx`.
**Fix:** use `as`. There is no way to have both.

**Symptom:** `__dirname` is undefined in a file you converted to ESM.
**Cause:** it does not exist in ES modules.
**Fix:** `import.meta.dirname` on modern Node, or make that one file `.cts` if it
genuinely needs CommonJS.

**Symptom:** a consumer cannot find your types, and your `dist/` is full of
`.d.mts`.
**Cause:** their `moduleResolution` is `node10`, which predates the family.
**Fix:** ship a `.d.ts` alongside, or state the resolution requirement. Lane D's
topic 11 covers the packaging side.

**Symptom:** Jest stopped seeing tests after a rename to `.mts`.
**Cause:** `testMatch` globs `.ts`.
**Fix:** widen the glob. This category of breakage is the main practical cost of
the family.

**Symptom:** a `.d.ts` beside a `.mjs` produces errors about import forms.
**Cause:** the declaration is format-ambiguous while the implementation is
definitely ESM, so the compiler may resolve the pair to the wrong format.
**Fix:** name it `.d.mts`.

**Symptom:** every file in the repo is `.tsx`.
**Cause:** somebody normalised for consistency.
**Fix:** revert the non-JSX ones. The consistency is worth less than the syntax
it costs.

## Interview questions

**What extension should most files have?**
`.ts`. Its format follows `package.json` `"type"`, which is the right
granularity — a package is one format, and mixing costs more than it saves.

**When is `.cts` the right call?**
A CommonJS island in an ESM package: a config file loaded with `require`, code
needing `__dirname`, a native addon wrapper, or a file a CommonJS consumer must
`require`.

**Why is `.mts` rarer than `.cts`?**
Because an ESM island in a CommonJS package tends to spread — each one is a
boundary where `require` stops working — and the honest answer is usually to
migrate the package.

**What does `.tsx` cost you?**
The angle-bracket type assertion, since `<T>` opens a JSX element. `as` becomes
the only assertion form, and generic arrows need `<T,>` or an `extends` clause.

**Why does `<T,>` work?**
The trailing comma tells the parser this is a type parameter list rather than the
start of a JSX element. It is a parser hint, not a style convention.

**When would you write `.d.mts` rather than `.d.ts`?**
When describing a specific `.mjs` file, or when the declaration uses
format-specific syntax. A format-ambiguous `.d.ts` beside a definitely-ESM
implementation is a quiet source of import-form errors.

**What is the main practical cost of adopting `.mts`/`.cts`?**
Tooling globs. Linters, formatters, test matchers and bundler entry patterns all
tend to match `**/*.ts` and silently skip the rest.

**A dozen `.cts` files in one package — what does that tell you?**
That the package-level `"type"` decision was made too early. The unambiguous
extensions are an escape hatch, not a strategy.

## Where this connects

- **← [Topic 01 · Format detection, file by file](../01-module-and-moduleresolution/09-format-detection.md)**
  — how the ambiguous family's format is decided, and why `"type": "module"` is
  the most consequential line in the project.
- **← [Topic 01 · The bundler resolver](../01-module-and-moduleresolution/06-the-bundler-resolver.md)**
  — the strategy under which none of chunk 03's extension rules apply.
- **← [Topic 03 · Path aliases](../03-path-aliases/README.md)**
  — why `rewriteRelativeImportExtensions` cannot help an alias.
- **→ [Phase 7 · Who compiles](../../phase-7-server/01-tsconfig-for-a-node-service/01-who-compiles.md)**
  — `allowImportingTsExtensions` and `rewriteRelativeImportExtensions` argued on
  a real Node service, with the `TS5096` version table.
- **→ [Phase 6 · 07 · Authoring `.d.ts` files](../07-authoring-d-ts-files/README.md)**
  — what goes inside a declaration file, as opposed to which extension it carries.
- **→ Phase 6 · 16 · Typing non-code imports** *(not written yet, lane D)* —
  `allowArbitraryExtensions`, `.json`, CSS modules and bundler suffixes.

---

← [03 · The extension you type in an import](./03-the-specifier-extension.md) · [Topic index](./README.md)
