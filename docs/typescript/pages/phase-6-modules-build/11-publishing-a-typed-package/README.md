---
title: "Publishing a typed package"
sidebar_label: "11 · Publishing a typed package"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files →
> Publishing*, *Modules → Reference*), the **`arethetypeswrong` problem
> documentation** — eight problem files quoted verbatim — and **publint's
> published rule list**, with the `exports`, `typesVersions` and interop
> diagnostics read out of the compiler's own table in the installed **TypeScript
> 5.9.3** build. **No sandbox, no console blocks** — no tool was run, and no tool
> output is reproduced anywhere in this topic.

## The one-sentence version

> **A declaration file that represents a module must represent exactly one
> JavaScript file** — and a green build of your own package cannot tell you
> whether you got that right, because it never performs a consumer's import.

## Five sentences worth keeping

1. **The golden rule is per-file, not per-API.** A `.d.ts` does not only describe
   an API; it asserts a module format, decided by its extension and the nearest
   `"type"`. So it can only ever describe one JavaScript file.
2. **The `types` condition must be listed first**, and nested inside each of
   `import` and `require` wherever they resolve to different formats. A single
   top-level `types` in a dual package is the canonical broken shape.
3. **`export default` describes `module.exports.default`.** If your JavaScript
   does `module.exports = x`, the declaration must say `export = x` — and
   `esModuleInterop` hides the mistake in exactly the configuration authors test
   in.
4. **Adding an `exports` field is a breaking change**, because its mere presence
   blocks every subpath not listed or pattern-matched.
5. **Nothing here is verifiable from inside the package.** `attw --pack .` and
   `publint` resolve it from outside; your own build cannot.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The one rule](./01-the-one-rule.md) | One `.d.ts`, one `.js` — and the two masquerades that violate it |
| 02 | [How a consumer finds your types](./02-how-a-consumer-finds-your-types.md) | The resolution order, extension substitution, and `TS6278` vs `TS6280` |
| 03 | [`exports` and the `types` condition](./03-exports-and-the-types-condition.md) | Which conditions TypeScript matches, the ordering rule, and when to nest |
| 04 | [Dual ESM/CJS](./04-dual-esm-cjs.md) | Producing two declaration sets, and the two ways to disambiguate the output |
| 05 | [`export =` vs `export default`](./05-export-equals-vs-default.md) | The `.default` that does not exist, and `cjs-module-lexer` |
| 06 | [`typesVersions`](./06-typesversions.md) | Version-specific declarations, and the `types@{selector}` form to prefer |
| 07 | [The problem catalogue](./07-the-problem-catalogue.md) | Every named failure, sorted by what response it needs |
| 08 | [Wiring the checks in](./08-wiring-the-checks-in.md) | `attw` vs `publint`, `--pack`, and why two checks are not redundant |
| 09 | [The checklist](./09-the-checklist.md) | The dependency rules, the red flags, and three shapes that are correct |

## 🔴 The load-bearing quotes

Each is verbatim, and each settles something the rest of the topic builds on:

1. *"A golden rule of declaration files is that if they represent a module…they
   must represent **exactly** one JavaScript file."* — and *"They **especially**
   cannot represent JavaScript files of two different module formats."*
2. *"TypeScript always matches the `"types"` and `"default"` conditions if
   present"*, and *"The `"types"` condition should be listed first."*
3. *"The mere presence of an `"exports"` field prevents resolving any subpaths not
   explicitly listed or matched by patterns."*
4. *"Consumers without `skipLibCheck` enabled will see a TypeScript error
   reported on declaration files from the package in their node_modules"* — which
   is [topic 10](../10-skiplibcheck/README.md)'s argument seen from the consumer's
   side.
5. *"Use `"dependencies"` (not `"devDependencies"`) so consumers of your package
   automatically receive necessary type declarations."*

## The decision that removes most of this topic

```
how many module formats do you ship?

├─ one  → the masquerades are impossible, the dual-package hazard is
│         impossible, and one declaration set is all there is
└─ two  → everything in chunks 01, 04, 05 and 07 becomes reachable
```

🔴 **Dual is chosen by default far more often than it is chosen deliberately.**
It is sometimes right — but it is a cost, and this topic is mostly the invoice.

## Where this connects

- **← [Topic 07 · Authoring `.d.ts` files](../07-authoring-d-ts-files/README.md)**
  — the file format itself. This topic is about shipping those files so somebody
  else can find them. `export =` versus `export default`
  ([chunk 06 there](../07-authoring-d-ts-files/06-the-export-forms.md)) becomes a
  correctness question about your *runtime* here.
- **← [Topic 09 · `esModuleInterop`](../09-esmoduleinterop-and-default-imports/README.md)**
  — the flag that hides `export default`/`export =` mismatches from you and not
  from your consumers.
- **← [Topic 10 · `skipLibCheck`](../10-skiplibcheck/README.md)** — the flag that
  excludes your published declarations from checking. The two-config split it
  argues for is step 1 of this topic's validation; `attw`/`publint` are step 2.
- **→ 12 · Sharing types across a monorepo** *(not written yet)* — the same
  questions without npm in between, and where the built-`.d.ts` route makes them
  identical.
- **→ 16 · Typing non-code imports** *(not written yet)* — the `.css`-subpath
  false positive in [chunk 07](./07-the-problem-catalogue.md).
- **→ Node.js · Modules** — TypeScript *models* what Node will do here; Node
  *does* it. Every failure in this topic is that model being wrong.

---

← [Phase 6 index](../README.md) · Start → [01 · The one rule](./01-the-one-rule.md)
