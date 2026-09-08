---
title: "Failed to resolve import and does not provide an export named look like the same class of error and fail at completely different points in the resolution pipeline"
sidebar_label: "01m · Debugging resolution"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Troubleshooting](https://vite.dev/guide/troubleshooting), [CLI Reference — `--debug`](https://vite.dev/guide/cli), [Plugin API](https://vite.dev/guide/api-plugin#plugins-list). The exact debug-namespace string and the resolve plugin's internal log format are read directly from Vite's own source (`packages/vite/src/node/plugins/resolve.ts`, `main` branch, 2026-09-08) rather than a docs page — flagged as such. The `does not provide an export named` wording is a V8/Node ESM loader error, not Vite's own, observed verbatim in first-party project issue trackers and cited by URL. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Debugging a Bare-Specifier Resolution Failure

**Two error messages that both mean "an import didn't work" fail at completely different
points in the pipeline, and treating them as interchangeable wastes the time this page
exists to save: one means the specifier itself could never be found, the other means it was
found and the file it points to just doesn't have what you asked for. This page also covers
what changed about the engine actually doing the resolving in Vite 8 — and is explicit about
where the documentation stops answering that question.**

## `Failed to resolve import` — the specifier itself could not be located

This is Vite's own error, raised by its `import-analysis` plugin during the dev server's
static analysis of a module's imports, before the file is ever executed:

```text
[plugin:vite:import-analysis] Failed to resolve import "@acme/widgets" from
"src/App.tsx". Does the file exist?
```

(Wording observed verbatim in a real project issue,
[vitejs/vite#17501](https://github.com/vitejs/vite/issues/17501) — this is Vite's actual
error text, not a paraphrase.) It means exactly what it says: nothing in the resolution
chain — not `resolve.alias`, not `node_modules`, not any plugin's `resolveId` hook —
produced a file for that specifier. The causes are almost always one of:

- **The package genuinely isn't installed** — `npm install` never ran, or ran against a
  different lockfile than the one deployed.
- **A typo, wrong casing, or missing extension** for a custom file type Vite doesn't
  auto-resolve (`resolve.extensions` only covers the types listed there — see
  [01c](01c-resolve-extensions.md)).
- **A path alias Vite doesn't know about** — configured in `tsconfig.json`'s `paths` for the
  type-checker's benefit, never mirrored into `resolve.alias` for the actual resolver (see
  [01a](01a-tsconfig-paths-and-vite-alias.md)).
- **A CJS-only package the pre-bundler hasn't seen yet** — covered fully in
  [../11-optimization-and-performance/01a-dependency-pre-bundling.md](../11-optimization-and-performance/01a-dependency-pre-bundling.md).
- **The `exports` field genuinely does not expose that subpath** — this looks identical to a
  typo from the outside; see [01g](01g-the-exports-and-imports-fields.md) for the
  `ERR_PACKAGE_PATH_NOT_EXPORTED` version of the same underlying problem, which surfaces with
  different wording when it happens under plain Node (in `vite.config.ts`, say) rather than in
  Vite's own dev-server pipeline.

## `does not provide an export named` — the specifier resolved, the export didn't exist

This is a different failure, and it is not Vite's message at all — it is a standard V8/Node
ESM loader `SyntaxError`, observed verbatim across many first-party project issue trackers
(for example
[reduxjs/redux-toolkit#3864](https://github.com/reduxjs/redux-toolkit/issues/3864)):

```text
SyntaxError: The requested module '@reduxjs/toolkit' does not provide an export
named 'createSlice'
```

By the time this fires, resolution already succeeded — the specifier was found, a real file
was loaded — and the failure is in matching one specific named import against that file's
actual export list. For a genuine ESM target, the export list is determined statically from
the file's own `export` statements. For a CJS target loaded through an ESM-aware pipeline,
the named-export list is *detected*, not declared — via static analysis of the CJS module's
`module.exports` assignments (Node's own loader does this with `cjs-module-lexer`; Vite's
pre-bundler does its own version of the same idea, described in
[01l](01l-cjs-esm-interop-and-dual-packages.md) as *"smart import analysis"*). Detection can
miss exports that are assigned dynamically in a way static analysis cannot see — a spread
from a computed object, a loop building up `module.exports` — which is exactly the gap
Vite's smart import analysis exists to close for pre-bundled dependencies. The same import
hitting this error *outside* Vite's pipeline (a plain Node script requiring the same
package) is a strong signal the detection gap is real, not a Vite-specific bug.

| Error | Fired by | Means |
|---|---|---|
| `Failed to resolve import "X" from "Y"` | Vite's `import-analysis` plugin | The specifier `X` could not be turned into any file at all. |
| `does not provide an export named` | The JS engine's ESM loader | The specifier resolved to a real file; that file's detected/declared exports don't include the one requested. |

Confusing the two sends debugging in the wrong direction — adding the package to
`optimizeDeps.include` fixes an export-detection gap but does nothing for a genuinely
unresolvable specifier, and checking `resolve.alias` for a typo does nothing for a package
whose exports were only partially detected.

## `Module externalized for browser compatibility` — a warning, not a resolution failure

Covered in full in [01j](01j-node-builtins-in-browser-code.md); worth restating here only to
place it in the taxonomy — this one is neither of the above. The specifier resolves, the
import succeeds, and the failure (if any) is deferred to whichever method call on the
stubbed-out object gets executed later.

## The ESM-only-loaded-by-require failure — specific to `vite.config` itself

A fourth shape belongs on this page because it is easy to mistake for a source-code
resolution bug when it is actually about loading the *config file*:

> *"Failed to resolve "foo". This package is ESM only but it was tried to load by
> `require`."*
> `Error [ERR_REQUIRE_ESM]: require() of ES Module /path/to/dependency.js from
> /path/to/vite.config.js not supported.`
> `Instead change the require of index.js in /path/to/vite.config.js to a dynamic
> import() which is available in all CommonJS modules.`

This fires when `vite.config.js` (or a plugin it imports) is itself loaded as CommonJS by
plain Node — before Vite's own resolution pipeline exists to do anything — and that CJS code
tries to `require()` a package that ships ESM only:

> *"In Node.js `<=22`, ESM files cannot be loaded by `require` by default."*

The fix is at the config file's own module format, not at the dependency:

```json
// package.json — nearest one to vite.config.js
{ "type": "module" }
```

```bash
# or, without touching package.json's "type":
mv vite.config.js vite.config.mjs
mv vite.config.ts vite.config.mts
```

## Reading resolve-internal debug output

Vite's own resolve plugin exposes a dedicated debug channel — confirmed by reading the
plugin's source directly (`packages/vite/src/node/plugins/resolve.ts`, `main` branch, read
2026-09-08 — source code, not a documentation page):

```typescript
const debug = createDebugger('vite:resolve-details', { onlyWhenFocused: true })
```

**The namespace is `vite:resolve-details`, not `vite:resolve`.** This matters because the
`debug` package Vite uses for these channels matches namespace strings literally unless a
wildcard is present — `DEBUG=vite:resolve` will not surface this channel's output, while
`DEBUG=vite:resolve-details` or `DEBUG=vite:*` will. When enabled, the two log shapes the
resolve plugin emits are, per the same source read:

```text
[package entry] {input} -> {resolved_path}
[processResult] {original_id} -> {resolved_id}
```

⚠️ **The Vite documentation does not enumerate its own debug namespaces anywhere I could
find**, including in the CLI reference, which only documents the flag's existence:

> *"`-d, --debug [feat]` — [string | boolean] show debug logs"*

The one concrete, documented example of a namespace anywhere in the docs is for a different
subsystem entirely — the troubleshooting guide's HMR section says to run `vite --debug hmr`
to trace a circular-dependency-triggered full reload. **Whether `vite --debug resolve`
(without `-details`) does anything at all is not something the documentation settles, and I
could not confirm it independently of reading the source.** Treat `DEBUG=vite:resolve-details vite` (or `DEBUG=vite:* vite` to see everything, then narrow) as the
reliable form, sourced from the plugin's actual channel name rather than a guessed shorthand.

```bash
# reliable, sourced from the plugin's actual debug namespace
DEBUG=vite:resolve-details npx vite

# broad, always works, noisier — useful when the exact channel name is in doubt
DEBUG=vite:* npx vite
```

## What changed about the resolver itself in Vite 8 — and what the docs do not say

Two separate claims are documented, and it matters not to conflate them into a third,
unconfirmed one:

**Documented — the dependency pre-bundler's engine changed.**
> *"Rolldown is now used for dependency optimization instead of esbuild."*
This is specifically about `optimizeDeps` — the step that converts CJS/UMD dependencies to
ESM and collapses many-file packages into one, at cold start. Full mechanics in
[../11-optimization-and-performance/01a-dependency-pre-bundling.md](../11-optimization-and-performance/01a-dependency-pre-bundling.md).

**Documented — the plugin interface every resolution-affecting plugin is built against changed.**
> *"Vite plugins extends Rolldown's plugin interface with a few extra Vite-specific
> options. As a result, you can write a Vite plugin once and have it work for both dev and
> build."*
Vite's own resolve logic — `resolve.alias`, `exports`/`conditions` handling, `mainFields`,
the legacy `browser`-field object-form stubbing from [01i](01i-resolve-mainfields-and-the-browser-field.md) — is implemented as exactly this kind of plugin, using
the `resolveId` hook. On Vite 8 that hook's contract is Rolldown's, not Rollup's; this is a
change already established and validated elsewhere in this corpus (see the plugin-interface
chunk of the 2026 toolchain topic) and is repeated here only because it bears directly on
resolution: the interface a `resolveId` hook implements changed engines, even though the
resolution *rules* documented across this whole topic (conditions, mainFields, dedupe,
aliasing) did not change in kind.

**Not documented, and left uncertain here rather than invented — whether the underlying
resolution *algorithm* Vite's own plugin implements changed as part of the v8 rewrite,
independent of the interface it's now expressed through.** The migration guide documents
specific, itemised behaviour changes (the removed format-sniffing heuristic in
[01i](01i-resolve-mainfields-and-the-browser-field.md), the CJS default-import interop
change in [01l](01l-cjs-esm-interop-and-dual-packages.md), the preserved `require()` calls in
[01k](01k-externalization-and-the-two-builds.md)) rather than a single blanket statement that
"resolution is now Rolldown's own resolver." The safest, most precisely supportable claim is:
the engine executing plugins and bundling changed to Rolldown/Oxc, the plugin interface those
resolution-affecting hooks are written against changed to match, and several specific,
individually-documented resolution *behaviours* changed as part of the same release — but no
single sentence in the fetched documentation claims the resolution algorithm itself was
replaced wholesale by one belonging to Rolldown. Treat any stronger claim than that as
unconfirmed.

## Gotchas

**★ Symptom: `optimizeDeps.include` is added for a package throwing `does not provide an export named`, and it doesn't help.** Cause: that error means the export genuinely isn't
detected from the resolved file — which can mean the export truly doesn't exist under that
name (a typo, or the package renamed/removed it in a version bump), not only a detection gap
pre-bundling can close. Fix: check the package's actual, current export surface (its
`exports` map, its type declarations, or its own changelog) before assuming this is a
pre-bundling problem at all.

**★ Symptom: `DEBUG=vite:resolve` produces no output, and it's unclear whether debugging is broken or just quiet.** Cause: the resolve plugin's real channel name is
`vite:resolve-details`, confirmed from source — `vite:resolve` without the suffix matches
nothing, and the `debug` package does not do partial or prefix matching without an explicit
`*`. Fix: use the exact namespace, or `vite:*` to avoid needing to know it.
```bash
DEBUG=vite:resolve-details npx vite
```

**★ Symptom: `Failed to resolve "foo". This package is ESM only but it was tried to load by require` appears, and the fix attempted was inside application source code.** Cause: this
specific error is about `vite.config.js` (or something it imports) being loaded by plain
Node as CommonJS, before Vite's dev-server resolution exists — it has nothing to do with how
application modules resolve imports. Fix: change the *config file's* module format
(`"type": "module"` in the nearest `package.json`, or rename to `.mjs`/`.mts`), not anything
in `src/`.

**★ Symptom: a teammate insists Vite 8's resolver "is Rolldown now" as a blanket justification for an unexplained resolution difference.** Cause: conflating the documented
engine and plugin-interface changes with an undocumented claim about the resolution
algorithm itself. Fix: check the migration guide's itemised list of specific behaviour
changes first — format-sniffing removal, the CJS default-import rule, preserved `require()`
calls — because the actual cause of almost any v8 resolution surprise is one of those
named, specific changes, not a vague "it's Rolldown now" wave of the hand.

## Interview questions

**★ You see `Failed to resolve import` for one import and `does not provide an export named` for another, in the same file. Do you fix them the same way?**
No — they fail at different stages. `Failed to resolve import` means the specifier itself
never became a file: check installation, aliasing, casing, extensions, and the package's
`exports` map for that subpath. `does not provide an export named` means the specifier
already resolved to a real file, and the problem is that one particular named export
couldn't be matched against that file's export list — check whether the export genuinely
exists under that name in the installed version, and if the target is CJS, whether its
named-export detection (Node's `cjs-module-lexer`-based approach, or Vite's own smart import
analysis during pre-bundling) could plausibly have missed a dynamically-assigned export.
Treating both as "an import is broken, add it to `optimizeDeps.include`" fixes the second
category some of the time and does nothing for the first.

**★ Why can't you enable Vite's resolve-plugin debug output with `DEBUG=vite:resolve`?**
Because that is not the plugin's actual channel name — reading the source directly shows it
registers as `vite:resolve-details` via `createDebugger`. The `debug` package Vite's logging
is built on matches namespace strings exactly unless a wildcard is present, so a
near-miss like `vite:resolve` silently matches nothing rather than erroring or partially
matching. This is worth knowing generally about Vite's `DEBUG`-based logging: guessing a
namespace from an option or plugin name is unreliable, and `DEBUG=vite:*` is the safer
starting point when the exact channel isn't already known from having read the source or the
one namespace the troubleshooting guide happens to document (`hmr`).

**★ What is the most precisely supportable claim about "the resolver" changing in Vite 8, versus an overclaim to avoid?**
Supportable: the dependency pre-bundler switched engines from esbuild to Rolldown, and every
Vite plugin — including the ones implementing `resolve.alias`, conditions, and mainFields
handling via the `resolveId` hook — now extends Rolldown's plugin interface rather than
Rollup's, which is also why one plugin now behaves identically in dev and build. Also
supportable: several individually-documented resolution *behaviours* changed in the same
release — the format-sniffing heuristic between `browser` and `module` fields was removed,
the CJS default-import interop rule was tightened, and `require()` calls to externalised
modules stopped being rewritten to `import`. Not supportable from the fetched documentation:
a single blanket claim that "the resolution algorithm is now Rolldown's own resolver" —
nothing quoted here asserts that, and stating it as fact would be exactly the kind of
confident invention the evidence rules for this corpus rule out.

---

← [01l · CJS/ESM interop & dual packages](01l-cjs-esm-interop-and-dual-packages.md) · [Vite overview](../../README.md) · Next → [01 · Worker & WASM import surface](../13-worker-and-wasm-support/01-advanced-runtime-targets.md)
