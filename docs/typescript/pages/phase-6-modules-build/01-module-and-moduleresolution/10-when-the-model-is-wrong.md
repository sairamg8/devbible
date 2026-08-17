---
title: "When the model is wrong"
sidebar_label: "10 · When the model is wrong"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. Every `TSxxxx` message below is quoted verbatim from the
> **compiler's own diagnostic table** in the installed **TypeScript 5.9.3**
> build, cross-checked against the **7.0.2** native binary's string table. The
> Node.js rules are verbatim from the **Node.js v24 ESM documentation**
> (*Mandatory file extensions*, *Interoperability with CommonJS*). ⚠️ The Node
> **error codes** named here are documented codes in the Node.js errors index,
> but their message text is **not quoted** — it was not obtainable from the
> primary source at the time of writing, and a plausible reconstruction is not
> evidence. **No sandbox, no console block.**

This chunk is the payoff. Everything before it was mechanism; this is the
catalogue of what goes wrong, in the order you meet it.

## The three places a mismatch comes from

This is the phase gate, and it is worth being able to recite:

1. **The resolution mode models a different algorithm than the loader uses.**
   `node10` where the runtime is ESM; `bundler` where the runtime is Node.
2. **The specifier is one the loader cannot resolve, even though the compiler
   could.** This is `paths`, and it is the subject of **Phase 6 · 03 · Path
   aliases** *(not written yet)*.
3. **The emit format does not match how the file is loaded.** ESM output loaded
   as CommonJS, or the reverse.

Every failure below is one of those three.

## Failures the compiler catches

These are the good ones. You get a diagnostic, at compile time, with a code.

| Code | Message (verbatim) | Real cause |
|---|---|---|
| `TS2307` | *Cannot find module '{0}' or its corresponding type declarations.* | Anything. The generic miss |
| `TS2792` | *Cannot find module '{0}'. Did you mean to set the 'moduleResolution' option to 'nodenext', or to add aliases to the 'paths' option?* | Mismatch #1 — the compiler has guessed the cause for you |
| `TS6280` | *There are types at '{0}', but this result could not be resolved under your current 'moduleResolution' setting…* | Mismatch #1. **Your** config |
| `TS6278` | *There are types at '{0}', but this result could not be resolved when respecting package.json "exports". The '{1}' library may need to update its package.json or typings.* | The **library's** `package.json` |
| `TS2834` | *Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'.* | Mismatch #1, caught early |
| `TS2835` | *…Did you mean '{0}'?* | The same, with the answer supplied |
| `TS1479` | *The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module and cannot be imported with 'require'. Consider writing a dynamic 'import("{0}")' call instead.* | Mismatch #3 |
| `TS1471` | *Module '{0}' cannot be imported using this construct. The specifier only resolves to an ES module, which cannot be imported with 'require'. Use an ECMAScript import instead.* | Mismatch #3, via `import x = require()` |
| `TS5109` / `TS5110` | *Option 'moduleResolution' must be set to '{0}'…* / *Option 'module' must be set to '{0}'…* | An incoherent config, caught before it can cause #1 or #3 |
| `TS5095` | *Option '{0}' can only be used when 'module' is set to 'preserve' or to 'es2015' or later.* | The same, for `bundler` |
| `TS1293` | *ECMAScript module syntax is not allowed in a CommonJS module when 'module' is set to 'preserve'.* | Mismatch #3 |
| `TS1295` | *ECMAScript imports and exports cannot be written in a CommonJS file under 'verbatimModuleSyntax'…* | Mismatch #3 |
| `TS2732` | *Cannot find module '{0}'. Consider using '--resolveJsonModule' to import module with '.json' extension.* | Not a module problem at all |

📌 **`TS1479` is the interesting one.** It is not "you cannot do this" — it is
"you cannot do this *synchronously*", and the message hands you the workaround:
`await import(…)`. Note also that whether it fires at all depends on your
`module` value: under `nodenext` it is suppressed, because Node 22 permits
`require(esm)`; under `node18` it is not
([chunk 03](./03-preserve-and-the-node-family.md)).

## Failures the compiler does not catch

These are the dangerous ones. The build is green, CI is green, and the process
exits on the first line.

The two Node rules that produce most of them, verbatim from the Node
documentation:

> A file extension must be provided when using the `import` keyword to resolve
> relative or absolute specifiers. Directory indexes (e.g. `'./startup/index.js'`)
> must also be fully specified.

> The CommonJS module `require` currently only supports loading synchronous ES
> modules (that is, ES modules that do not use top-level `await`).

From those, and from the specifier-emitted-as-written rule
([chunk 01](./01-the-two-questions.md)), the runtime failure set follows:

| What you see | What actually happened |
|---|---|
| `ERR_MODULE_NOT_FOUND` | A specifier the compiler resolved and Node cannot — an extensionless relative path, or a `paths` alias nothing re-implements at runtime |
| `ERR_UNSUPPORTED_DIR_IMPORT` | A directory import that resolved to `index.ts` at compile time; ESM does not do directory indexes |
| `Cannot use import statement outside a module` | ESM output being loaded as CommonJS — `module` says ESM, `package.json` does not |
| `exports is not defined` | The mirror image: CommonJS output loaded as ESM |
| `ERR_REQUIRE_ESM` | `require()` of an ES module on a Node version that does not permit it |
| `ERR_REQUIRE_ASYNC_MODULE` | `require()` of an ES module that uses top-level `await` — permitted-in-general, forbidden-in-this-case |
| `ERR_UNKNOWN_FILE_EXTENSION` | Node asked to load a file type it has no loader for |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | A subpath the package's `"exports"` does not expose — the one `node10` let you import happily |

⚠️ **These are documented Node error codes; their exact message text is not
quoted here** and should be read from Node's own errors page rather than from
memory. The mapping above is derived from the documented behaviour, not observed
in a run.

🔴 **The pattern worth internalising: every row in the second table has a row in
the first table that could have caught it.** `ERR_MODULE_NOT_FOUND` from an
extensionless import is `TS2834` you never enabled.
`ERR_PACKAGE_PATH_NOT_EXPORTED` is `TS6278`/`TS6280` you never enabled. Choosing
the resolution strategy that matches your loader is not a preference — it is the
difference between a compile error and a production incident.

## The debugging procedure

When something in this area breaks, this order gets there fastest.

**1. Read the artefact, not the config.** Open an emitted file. `require(` means
CommonJS; a top-level `import` means ESM. That is the ground truth and it takes
five seconds.

**2. Resolve the four values through the chain.** `module`, `moduleResolution`,
`target`, `esModuleInterop` — *including the ones nobody set*
([chunk 07](./07-the-defaults-you-did-not-set.md)). Most "mysterious" behaviour
is an implied default.

**3. Ask the compiler why the file has the format it has.** `TS1458`–`TS1461`
name the deciding `package.json` ([chunk 09](./09-format-detection.md)).

**4. Ask which file a specifier resolved to.** `--traceResolution` logs the
lookup; `--explainFiles` lists why each file is in the program. Both are large
outputs and both are worth it once.

**5. Compare against the loader.** If Node runs it, does Node's algorithm accept
that specifier? If a bundler runs it, does the bundler's own config add aliases
the compiler has never seen?

📌 Step 1 first, always. It is the only step that cannot be argued with, and it
frequently ends the investigation.

## Gotchas

**A green build is not evidence that the program starts.** *Symptom:* CI passes,
the deploy fails on boot. *Cause:* `tsc` answers "do the types check", not "will
this load". *Fix:* run the built artefact in CI, even if only `node dist/index.js
--version`. It is the cheapest test in the suite.

**`TS2307` is the least informative error in this area and the most common.**
*Symptom:* "Cannot find module" with no further hint. *Cause:* it is the generic
miss — wrong strategy, missing dependency, missing types, a sealed subpath.
*Fix:* look for a *second* diagnostic on the same import; `TS6278`/`TS6280`/
`TS2792` usually accompany it and each names a specific cause.

**`ERR_MODULE_NOT_FOUND` on a path alias is not a resolution bug.** *Symptom:*
`@/lib/db` works in the editor and throws in production. *Cause:* the compiler
resolved a mapping the runtime never learned. *Fix:* something must implement
the alias at runtime — a bundler, `package.json` `"imports"`, or a loader.
Details in **Phase 6 · 03 · Path aliases** *(not written yet)*.

**`TS1479` disappearing after a TypeScript upgrade is a real behaviour change.**
*Symptom:* an error that used to guard a `require` of ESM is gone. *Cause:*
`nodenext` now permits `require(esm)` because Node 22 does. *Fix:* confirm the
Node version you deploy on actually permits it — the compiler is modelling the
newest Node, not yours.

**Top-level `await` turns a working `require(esm)` into a runtime error.**
*Symptom:* a CommonJS caller breaks after an unrelated change to the ESM module.
*Cause:* Node's `require` supports only *synchronous* ES modules. *Fix:* the
caller has to use `await import(…)`. Nothing in the type system warns you,
because adding `await` at the top level of an ESM file is entirely legal.

**Deleting `node_modules` changes which errors you get.** *Symptom:* different
diagnostics before and after a clean install. *Cause:* resolution failures cascade
— one unresolved package can suppress or produce errors elsewhere. *Fix:* always
diagnose from a clean, complete install.

**The editor and the build can resolve differently.** *Symptom:* red squiggles
that CI does not report, or the reverse. *Cause:* the editor may be using a
different `tsconfig.json` (a nearer one, or the wrong project in a monorepo), or
a different TypeScript version. *Fix:* check which project and which version the
editor selected before believing either side.

**"It works locally" can mean a case-insensitive filesystem.** *Symptom:*
`ERR_MODULE_NOT_FOUND` in a Linux container for an import that resolves on
macOS. *Cause:* `./Utils` and `./utils` are the same file on one and not the
other. *Fix:* `forceConsistentCasingInFileNames`, which is on by default under
`strict`.

**Adding `"exports"` to your own package can break your own build.** *Symptom:*
internal imports stop resolving after publishing preparation. *Cause:*
`"exports"` seals subpaths, and your own tests may import sealed ones. *Fix:* that
is the feature working; add the paths you genuinely need, or use `"imports"`.

## Interview questions

**Why can code that type-checks still fail to start?**
Because the compiler answers "do the types check under my model of the module
system", not "will the loader resolve these specifiers". The specifier is emitted
as written, so if the configured resolution algorithm is more permissive than the
loader's — extensionless paths being the classic case — the compile succeeds and
the load fails.

**Name the three sources of a compile-passes-runtime-fails module error.**
A resolution mode that models a different algorithm than the loader uses; a
specifier the loader cannot resolve even though the compiler could (path
aliases); and an emit format that does not match how the file is loaded.

**You get `TS2307`. What is your next move?**
Look for a second diagnostic on the same import. `TS2307` is the generic miss;
`TS6280` (your `moduleResolution` is too old), `TS6278` (the package's
`"exports"` does not expose it) and `TS2792` (the compiler's own guess) each name
a specific cause, and they usually appear alongside it.

**What does `TS1479` mean and why might it not appear?**
It means a CommonJS file is trying to `require` an ES module. It may not appear
because `nodenext` models Node 22's `require(esm)` support and suppresses it —
so the absence of the error is a statement about the compiler's target Node
version, not about your deployment's.

**Node permits `require()` of an ES module now. Are the interop problems over?**
No. Node's support is for *synchronous* ES modules only — a module using
top-level `await` still cannot be required. That is a property of the imported
module's body, not of its interface, so it can appear in a patch release of a
dependency with no type-level signal at all.

**How do you find out which file an import actually resolved to?**
`--traceResolution` logs every step of the lookup, and `--explainFiles` reports
why each file is in the program. For the *format* question rather than the
*location* question, the compiler's `TS1458`–`TS1461` messages name the
`package.json` that decided it.

**What is the first thing you check when a build "is ESM" but Node disagrees?**
The emitted file. If it contains `require(`, it is CommonJS whatever
`tsconfig.json` claims. The artefact is authoritative and the config is only the
intent — and this check ends the investigation more often than any other.

**Why is running the built artefact in CI worth doing even with full type
coverage?**
Because every failure in this area is invisible to type checking by construction:
resolution and format mismatches are properties of the output and the loader, not
of the types. A single `node dist/index.js` in CI catches the entire class.

---

← [09 · Format detection](./09-format-detection.md) · Next → [11 · Choosing, and migrating](./11-choosing-and-migrating.md)
