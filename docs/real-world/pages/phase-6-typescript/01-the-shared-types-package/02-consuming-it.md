---
title: "Consuming it from both sides"
sidebar_label: "02 · Consuming it"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [Node.js `exports` field](https://nodejs.org/api/packages.html#exports) and
> [conditional exports](https://nodejs.org/api/packages.html#conditional-exports),
> and the TypeScript handbook's
> [`moduleResolution: "bundler"`](https://www.typescriptlang.org/tsconfig/#moduleResolution).
> The **service `tsconfig`** is
> [TypeScript 7·01](../../../../typescript/pages/phase-7-server/01-tsconfig-for-a-node-service/README.md).

## The question this chunk answers

The package exists. Now: **does it ship compiled JavaScript, or does each app
compile its source?**

It sounds like packaging trivia. It decides how fast the feedback loop is, what
breaks in CI, and whether a type change is visible immediately or after a build
step someone forgot to run.

## Two models, and the one this app uses

**Compiled** — the package has a `build` script emitting `dist/` with `.js` and
`.d.ts`, and both apps import the built output.

- ✅ Works with any consumer, including tools that will not read `.ts`.
- ✅ The published shape is what everyone gets — no per-app compiler differences.
- 🔴 **A stale `dist/` is a whole class of bug.** Edit a type, forget the build,
  and both apps compile happily against yesterday's shape. Fixing it means a
  watch process or a build orchestrator, and now the loop has a step in it.

**Source-consumed** — the package's entry points at `src/index.ts`, and each
app's own build compiles it.

- ✅ **No build step, so nothing can be stale.** Save a type and both sides see
  it on the next check.
- ✅ Go-to-definition lands on real source, not a `.d.ts` summary.
- 🔴 Every consumer must be able to compile TypeScript, and they must agree on
  the compiler settings that affect *shape* — `strict` above all.

🔴 **This app is source-consumed**, because both consumers are ours and both
already compile TypeScript. The staleness class is the more expensive one: it
produces confident wrong answers, whereas the source model's cost is a
constraint you can state once in a `tsconfig`.

```json
// packages/shared/package.json
{
  "name": "@storefront/shared",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./package.json": "./package.json"
  }
}
```

## The `exports` map is the boundary, mechanically

The previous chunk described what belongs in the package as a *rule*. The
`exports` field is what makes it a *fact*:

**Anything not listed is not importable.** `exports` replaces the old
"everything under the package root is reachable" behaviour, so
`@storefront/shared/src/internal/db-row` fails to resolve even though the file
exists. The single `"."` entry means the only way in is `index.ts`, which is
exactly the surface the previous chunk defined.

⚠️ **`"./package.json"` is listed on purpose.** Some tooling reads a
dependency's `package.json` at runtime, and with a strict `exports` map that
read fails unless the path is exposed. It costs nothing and it removes an
obscure failure.

**Conditional exports are how a package serves two runtimes** — and the
temptation this app deliberately refuses:

```jsonc
// NOT what this package does — shown because it is the wrong tool here
{
  "exports": {
    ".": {
      "node":    "./src/index.node.ts",   // could import pg types
      "browser": "./src/index.browser.ts"
    }
  }
}
```

🔴 **A conditional export would let server-only types back in through a side
door.** The whole boundary rests on there being *one* surface both sides share;
the moment there are two, "shared" stops meaning shared and the drift the
package prevents comes back in a form that looks intentional.

## What each side needs in its `tsconfig`

Both apps resolve the package through the workspace symlink, so the only real
requirement is that they agree where it matters:

```jsonc
// apps/web/tsconfig.json — and apps/api's differs only in lib/types
{
  "compilerOptions": {
    "strict": true,                    // MUST match across consumers
    "moduleResolution": "bundler",     // reads "exports"; no extension guessing
    "module": "preserve",
    "verbatimModuleSyntax": true,      // makes type-only imports explicit
    "skipLibCheck": true
  }
}
```

🔴 **`strict` must match, and this is not stylistic.** `strictNullChecks` is
part of it, and it changes what a type *means*: with it off, `string` includes
`null`. If the API compiles the shared source strictly and the client does not,
the two are reading different types from identical text — and the client's
"this cannot be null" is unfounded. **Set it in one place and extend from
there**, so it cannot drift:

```jsonc
// tsconfig.base.json at the root; both apps "extends" it
{"compilerOptions": {"strict": true, "moduleResolution": "bundler"}}
```

⚠️ **`verbatimModuleSyntax` earns its place in a source-consumed package.** It
requires `import type { Order } from '@storefront/shared'` when you mean a
type, which means the bundler can drop the import entirely instead of emitting
a runtime dependency on a module that may export nothing at runtime. Without
it, a types-only import can become a real one and pull the package into a
bundle it did not need to be in.

## Gotchas

**Symptom:** `Cannot find module '@storefront/shared'`
**Cause:** The workspace was not installed, so the symlink does not exist
**Fix:** Install at the root; workspace linking is an install-time action

**Symptom:** A deep import used to work and now fails to resolve
**Cause:** An `exports` map was added — that is it doing its job
**Fix:** Re-export it from `index.ts` if it is genuinely public; otherwise the
import was reaching into internals

**Symptom:** Types are correct in the editor and wrong at build
**Cause:** The editor uses the workspace TypeScript, the build uses another
version, or the two resolve different `tsconfig`s
**Fix:** One base config both extend; pin the compiler in the root

**Symptom:** The client treats a field as non-nullable and it arrives `null`
**Cause:** Mismatched `strict` between consumers, so identical text produced
different types
**Fix:** `strict` in the shared base config, never per app

**Symptom:** A type-only import ends up in the browser bundle
**Cause:** A value import where a type import was meant
**Fix:** `verbatimModuleSyntax` plus `import type`, which makes the intent
explicit and the erasure reliable

**Symptom:** Editing a shared type changes nothing until a rebuild
**Cause:** The package is compiled and `dist/` is stale
**Fix:** Source-consume it, or run the package build in watch — but prefer
removing the step over automating it

**Symptom:** The API bundle grows after adding a shared constant
**Cause:** A runtime value in the package, as the previous chunk warned
**Fix:** Expected and acceptable for the status array; not for helpers

## Interview questions

1. **★ Compiled `dist/` or source-consumed — which, and why?** Source-consumed
   here, because both consumers are ours and both compile TypeScript already.
   The compiled model's failure mode is a stale `dist/`, which makes both apps
   compile confidently against an old shape; the source model's cost is a
   compiler-settings constraint, which can be stated once and enforced.
2. **★ Why must `strict` match across consumers of a source-consumed package?**
   Because `strictNullChecks` changes what the types mean, not just how strictly
   they are checked — with it off, `string` admits `null`. Two consumers with
   different settings derive different types from the same file, and the looser
   one holds guarantees it has not earned.
3. **★ What does the `exports` map actually buy beyond tidiness?** It makes the
   package boundary mechanical. Anything unlisted is unresolvable, so
   "internals are private" stops being a convention that review has to enforce
   and becomes something the resolver enforces.
4. **Why refuse conditional exports here?** Because separate node and browser
   entry points reintroduce exactly what the package removes: two surfaces that
   can disagree. Server-only types would return through the node condition, and
   the split would look deliberate rather than accidental — which makes it
   harder to spot, not easier.
5. **Why list `"./package.json"` in the exports map?** Because a strict map
   otherwise blocks tooling that reads a dependency's manifest at runtime. It
   exposes nothing meaningful and removes a failure that is hard to diagnose.
6. **What does `verbatimModuleSyntax` change for this package?** It forces
   `import type` where a type is meant, so the import can be erased rather than
   emitted. Without it, a types-only dependency can become a runtime one and
   drag the package into a bundle unnecessarily.
7. **The editor shows correct types and the build disagrees. Where do you
   look?** At which TypeScript each is running and which `tsconfig` each
   resolves. The usual cause is the editor using the workspace version against
   the nearest config while the build uses a different pairing — which is why
   one base config that both extend is worth the indirection.
8. **What would make you switch this package to compiled output?** A consumer
   that cannot compile TypeScript — a plain-JavaScript app, an external
   package, or a runtime that loads it directly. The moment the audience is not
   entirely ours, the source model's constraint stops being enforceable.

---

← Prev: [Why a package](01-why-a-package.md) · [Overview](README.md)
