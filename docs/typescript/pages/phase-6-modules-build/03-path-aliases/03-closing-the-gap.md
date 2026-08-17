---
title: "Closing the gap at runtime"
sidebar_label: "03 · Closing the gap"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `paths` section's statement that it does not affect emit, and its
> recommendation of `package.json` `"imports"`) and the **Node.js v24
> documentation** on subpath imports and module customization hooks.
> ⚠️ Third-party tools are named because they are the options people actually
> reach for; their behaviour is described from their documented purpose and **no
> version-specific claims are made** about them. **No sandbox, no console
> block.**

You have an alias the compiler understands and the runtime does not. There are
exactly four ways to fix that, and they are not equivalent.

## The four options

| # | Approach | Where the mapping lives | Ships to production? |
|---|---|---|---|
| 1 | **A bundler alias** | the bundler's config | No — the bundle has no aliases left |
| 2 | **`package.json` `"imports"`** | `package.json`, a standard the runtime reads | Yes, and the runtime handles it |
| 3 | **A post-build rewrite** | a build step that edits the emitted specifiers | No — the output has real paths |
| 4 | **A runtime resolver hook** | a loader installed before your code | **Yes**, and that is the objection |

They differ on one axis that matters more than any other: **does the alias still
exist when the program runs?** In options 1 and 3 it does not. In option 2 it
does, but the runtime understands it natively. In option 4 it does, and something
must be running to interpret it.

## 1 · A bundler alias — the case `paths` was designed for

Vite's `resolve.alias`, Webpack's `resolve.alias`, esbuild's `alias`, Rollup's
alias plugin. The bundler resolves and inlines the specifier during the build, so
the emitted bundle contains no alias at all.

`paths` here is doing exactly what the handbook describes: teaching TypeScript to
follow a resolver that already exists.

⚠️ **The failure mode is drift.** The two configs are separate files, in different
languages, maintained by different instincts. Adding an alias to one and not the
other produces either a type error with a working build or a working build with
no types. Several bundlers offer a plugin that reads `tsconfig.json` directly —
using one removes the class of problem entirely, and is worth preferring over
duplicating the list by hand.

📌 **This option is only available if a bundler runs.** It is not an answer for a
`tsc`-built Node service, which is where most alias bugs actually live.

## 2 · `package.json` `"imports"` — the standard replacement

The handbook's own recommendation:

> Both libraries and apps can consider package.json `"imports"` as a standard
> replacement for convenience `paths` aliases.

Node resolves `#`-prefixed specifiers natively, from the `"imports"` field. No
build step, no loader, no second config to drift.

```jsonc
// package.json
{
  "imports": {
    "#app/*": "./dist/*"
  }
}
```

```ts
import { pool } from "#app/db/pool.js";   // Node resolves this unaided
```

🔴 **This is the option to reach for first**, and it gets its own chunk —
[04 · `package.json` `"imports"`](./04-subpath-imports.md) — because it has one
non-obvious requirement that makes it fail confusingly.

## 3 · A post-build rewrite

A step that runs after `tsc` and rewrites the emitted specifiers into real
relative paths, reading `paths` from your `tsconfig.json`. `tsc-alias` is the
tool people use.

**What it buys:** the output is ordinary JavaScript with ordinary paths. Nothing
special runs in production; the artefact is portable.

**What it costs:**

- A build step that must run everywhere the build runs — CI, local, Docker — and
  is easy to forget in one of them.
- It rewrites `.js` and `.d.ts`, so it has to be correct about both, and a
  published package depends on it having been.
- Sourcemaps and any downstream tooling now see paths that do not match the
  source.

📌 It is a reasonable answer for an existing codebase with hundreds of aliases
already in place. It is a poor answer for a new one, because option 2 achieves
the same thing with no step at all.

⚠️ **Related but different:** `rewriteRelativeImportExtensions` (TypeScript 5.7)
rewrites `.ts` → `.js` in *relative* import paths — the compiler's own message is
*"Rewrite '.ts', '.tsx', '.mts', and '.cts' file extensions in relative import
paths to their JavaScript equivalent in output files."* It does **not** touch
bare specifiers, so it does nothing for aliases. Do not reach for it here.

## 4 · A runtime resolver hook

Node's module customization hooks, or a `tsconfig-paths`-style registration that
teaches the runtime your `paths`. The alias survives into production and is
resolved as the program loads.

**What it buys:** no build step, no config duplication, and it works for `.ts`
run directly.

**What it costs, and this is the objection:**

- **Production depends on a resolution hook.** Every process that loads your code
  — the server, a migration script, a one-off `node -e`, a debugger — must
  install it first, or the alias fails.
- It is invisible in the artefact. Someone reading `dist/` cannot tell that the
  program requires a loader to start.
- Loader APIs have moved more than most of Node, so it is the option most likely
  to need attention at a major version bump.

📌 **Perfectly reasonable in development** — `tsx` and `ts-node` setups routinely
use it, and nothing ships. Much harder to defend in production.

## Choosing

```text
Is a bundler already producing your artefact?
  └─ yes → option 1, ideally via a plugin that reads tsconfig.json
  └─ no
      └─ Are you starting fresh, or willing to change specifiers?
          └─ yes → option 2, package.json "imports"
          └─ no
              └─ Do you control every process that runs the code?
                  └─ no  → option 3, post-build rewrite
                  └─ yes → option 3 still, unless dev-only, then option 4
```

🔴 **Option 4 appears once, at the bottom, for the narrowest case.** That ordering
is the recommendation.

## Gotchas

**Two alias lists drift and the symptoms are asymmetric.** *Symptom:* either "the
build works but the editor is red" or "the editor is fine and the build fails".
*Cause:* the bundler config and `tsconfig.json` disagree. *Fix:* a bundler plugin
that reads `tsconfig.json`, so there is one list.

**A post-build rewrite that is skipped in one environment fails only there.**
*Symptom:* works locally, fails in the container. *Cause:* the step is in the npm
script you use and not in the Dockerfile. *Fix:* make the rewrite part of the
build command itself, not a separate step anyone can omit.

**A rewrite tool must handle `.d.ts` too, and a published package depends on
it.** *Symptom:* consumers get `TS2307` for `@app/...` even though the runtime
works. *Cause:* the `.js` was rewritten and the declarations were not. *Fix:*
verify both outputs before publishing — this is the strongest argument for
option 2 in a library.

**A runtime hook makes every entry point a special case.** *Symptom:* the server
starts and a migration script does not. *Cause:* the hook is installed in one
entry point. *Fix:* every process needs it, which is the cost of the option
rather than a bug in it.

**`rewriteRelativeImportExtensions` looks like it solves this and does not.**
*Symptom:* enabling it changes nothing about aliases. *Cause:* it only touches
relative paths. *Fix:* it is for a different problem entirely — file extensions,
covered in **Phase 6 · 06 · File extensions** *(not written yet)*.

**Mixing options is worse than either alone.** *Symptom:* some aliases resolved
at build time and some at runtime. *Cause:* an incremental migration that
stopped halfway. *Fix:* finish it. A codebase where the answer to "how is this
alias resolved?" is "it depends which alias" has the costs of both approaches.

**Deciding this late is much more expensive than deciding it early.**
*Symptom:* a large refactor to remove aliases from a published package. *Cause:*
convenience aliases were introduced without asking who resolves them. *Fix:* the
question belongs at the moment the first alias is added.

## Interview questions

**You have `paths` aliases in a `tsc`-built Node service. What are your options?**
Four: a bundler alias (not available — nothing bundles); `package.json`
`"imports"`, which Node resolves natively; a post-build rewrite such as
`tsc-alias`; or a runtime resolver hook. For that specific case `"imports"` is
the handbook's own recommendation and the only one with no extra machinery.

**What is the axis that separates these four options?**
Whether the alias still exists when the program runs. A bundler and a post-build
rewrite eliminate it before production. `"imports"` keeps it but the runtime
understands it natively. A loader hook keeps it and requires something to be
running to interpret it — which is why it is the last resort.

**Why is a runtime resolver hook the weakest option for production?**
Because every process that loads the code must install it first — the server, a
migration script, a debugger, a one-off `node -e` — and the requirement is
invisible in the artefact. Someone reading `dist/` cannot tell that the program
needs a loader to start.

**What is the failure mode of a bundler alias?**
Drift. The alias list exists in two files, in two languages, and adding to one
and not the other gives you either a type error with a working build or a working
build with no types. A bundler plugin that reads `tsconfig.json` removes the
class of problem.

**Does `rewriteRelativeImportExtensions` help with path aliases?**
No. Its own description says it rewrites `.ts`/`.tsx`/`.mts`/`.cts` extensions in
*relative* import paths. Bare specifiers, which is what an alias is, are
untouched. It solves the extension problem, not the alias problem.

**When is `tsc-alias`-style post-build rewriting the right answer?**
For an existing codebase with a lot of aliases already in place, where changing
every specifier to `#app/...` is a bigger change than adding a build step. For a
new project it is strictly worse than `"imports"`, which needs no step at all.

**What must a rewrite tool get right that people forget?**
The `.d.ts` output as well as the `.js`. A published package whose JavaScript was
rewritten and whose declarations were not works at runtime and gives every
consumer `TS2307` — which is the worst combination, because the runtime tests
pass.

**Is it acceptable to use a loader hook in development only?**
Yes, and it is common — `tsx` and `ts-node` setups do exactly this and nothing
ships. The objection is entirely about production, where the hook becomes a
dependency of every entry point.

---

← [02 · `baseUrl`](./02-baseurl.md) · Next → [04 · `package.json` `"imports"`](./04-subpath-imports.md)
