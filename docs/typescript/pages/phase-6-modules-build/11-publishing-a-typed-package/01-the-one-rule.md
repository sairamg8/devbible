---
title: "The one rule: one declaration file, one JavaScript file"
sidebar_label: "01 · The one rule"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`arethetypeswrong` problem documentation**
> (`docs/problems/FalseCJS.md` and `FalseESM.md`, quoted verbatim) and the
> **TypeScript handbook** — *Declaration Files → Publishing* and *Modules →
> Reference*. **No sandbox, no console blocks.**

Publishing a typed package has one rule underneath it, and every failure in this
topic is a violation of it. `arethetypeswrong`'s documentation states it as a
golden rule, and it is worth reading twice:

> 🔴 *"A golden rule of declaration files is that if they represent a module…
> they must represent **exactly** one JavaScript file."*

And, for the dual-format case:

> *"declaration files must represent **exactly** one JavaScript file. They
> **especially** cannot represent JavaScript files of two different module
> formats."*

## Why one file, and not "one API"

The instinct is that a `.d.ts` describes an *API*, so one file describing an API
implemented twice — once as ESM, once as CommonJS — sounds reasonable. It is the
single most common way a package ends up broken, and the reason is that a
declaration file does not only describe an API. It also declares, implicitly and
unavoidably, **what module format the thing is**.

A `.d.ts` file's format is decided the same way any file's is: its extension, and
the nearest `package.json`'s `"type"` field. So a declaration file is not
format-neutral even if its *contents* say nothing about formats. And once the
compiler decides your `index.d.ts` is an ES module, it will tell every consumer
that the runtime file behaves like one — including consumers whose `require` call
Node is about to resolve to a CommonJS file.

📌 **This is [topic 07 chunk 05](../07-authoring-d-ts-files/05-module-or-global.md)'s
module-versus-script question one level up.** That chunk was about whether a
declaration file is a module at all. This is about *which kind*.

## The two failures, named

`arethetypeswrong` gives them names, and knowing the names is most of the value
because they are otherwise very hard to tell apart from the symptoms.

### Masquerading as CJS

> *"the type declaration file implies that the corresponding runtime module is
> CommonJS, but it appears that Node will resolve to an ES module."*

Two consequences, both quoted from the same doc:

1. **TypeScript permits default imports that do not exist**, so the consumer's
   code crashes at runtime.
2. **Where a default does exist, TypeScript misdescribes how to reach it**,
   breaking code that would otherwise have worked.

### Masquerading as ESM

> *"a type declaration file implies that the corresponding runtime module is an
> ES module, but it appears that Node will resolve to a CommonJS module."*

The canonical broken shape, quoted verbatim:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.js",
      "require": "./index.cjs"
    }
  }
}
```

🔴 **That looks correct and is not.** `"type": "module"` makes `index.d.ts` an ES
module, but the `require` condition sends Node to `index.cjs`, which is
CommonJS. One declaration file has been asked to describe two files of different
formats — exactly what the rule forbids.

The fix is a second declaration file, and it is the shape the rest of this topic
builds on:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./index.d.ts",
        "default": "./index.js"
      },
      "require": {
        "types": "./index.d.cts",
        "default": "./index.cjs"
      }
    }
  }
}
```

**Notice what changed structurally**, because it is the important part: the
`types` condition moved *inside* each of `import` and `require`. A single
top-level `types` cannot be right for both — that is the rule restated as a
config shape. [Chunk 03](./03-exports-and-the-types-condition.md) is about that
nesting; [chunk 04](./04-dual-esm-cjs.md) is about producing the two files.

## The third case, which is not a masquerade

There is a related failure that is **not** a violation of the rule, and telling
them apart matters:

> **ESM-only entrypoint** — *"a `require` call resolved to an ESM JavaScript
> file, which is an error in Node and some bundlers."*

Here the types and the implementation agree — both ESM. Nothing is masquerading.
The consumer asked for CommonJS and your package genuinely does not offer it.
The tool's own note is that this *"accurately reflects an actual runtime
problem"* rather than a declaration bug, and that it *"typically occurs when
library authors consciously decide to support only ESM"*.

⚠️ **So the same-looking error has two very different causes**, and only one of
them is yours to fix in a `.d.ts`:

| Symptom | Cause | Fix |
|---|---|---|
| `require` gets ESM, types said CJS | **Masquerading as CJS** — one `.d.ts` for two formats | Pair the declarations |
| `require` gets ESM, types said ESM | **ESM-only** — you do not ship CommonJS | Either ship it, or document `await import()` |

For the second, the consumer's route is `const mod = await import("pkg")`, and
the tool is blunt about the cost: *"introducing asynchronicity into a large
synchronous codebase can be a prohibitively difficult refactor and a breaking
change for downstream APIs."* Going ESM-only is a legitimate choice; it is not a
free one.

## What follows from the rule

The whole of this topic is bookkeeping on one sentence:

- **One `.js`, one `.d.ts`.** Two implementations means two declaration files —
  [chunk 04](./04-dual-esm-cjs.md).
- **Each declaration file must be findable from the condition that leads to its
  implementation** — [chunk 03](./03-exports-and-the-types-condition.md).
- **Each must declare its exports the way its implementation actually does
  them** — `export =` versus `export default`,
  [chunk 05](./05-export-equals-vs-default.md).
- **And you cannot confirm any of it by building your own package**, because
  your build is not a consumer — [chunk 07](./07-validating-the-result.md).

## Gotchas

**Symptom:** One `index.d.ts` serves both `import` and `require`, and consumers
report contradictory errors.
**Cause:** It is describing two JavaScript files of different formats.
**Fix:** Pair them — `.d.ts` with `.js`, `.d.cts` with `.cjs`, `.d.mts` with
`.mjs`.

**Symptom:** The package works when you test it from a TypeScript file in the
same repo.
**Cause:** Your own build resolves through source or through paths a consumer
never uses.
**Fix:** Nothing in this topic can be validated from inside the package. Chunk 07.

**Symptom:** A consumer's default import is `undefined` at runtime and the types
were happy.
**Cause:** Masquerading as CJS — the types described a CommonJS module and Node
resolved ESM.
**Fix:** Split the declarations. This is the failure mode the golden rule exists
to prevent.

**Symptom:** `"type": "module"` was added and CommonJS consumers broke, with no
change to any `.d.ts`.
**Cause:** `"type"` changes what format your existing `index.d.ts` *is*, without
touching a byte of it.
**Fix:** The `.d.cts` pairing. The declaration file's format was never encoded in
its contents.

**Symptom:** `arethetypeswrong` reports "ESM-only entrypoint" and a maintainer
starts editing declaration files.
**Cause:** Reading it as a masquerade. It is not — the types are accurate.
**Fix:** Either ship a CommonJS build or document that consumers need
`await import()`. No `.d.ts` edit will help.

**Symptom:** A hand-written `.d.ts` is being written to cover "the package's
API", format-agnostically.
**Cause:** The reasonable-sounding assumption this chunk exists to break.
**Fix:** Declaration files are per-file, not per-API. Generate them from source
where you can — [topic 07 chunk 04](../07-authoring-d-ts-files/04-generated-or-handwritten.md).

**Symptom:** The package has three implementations (ESM, CJS, browser) and two
declaration files.
**Cause:** A condition without its own types entry falls back to one that is
wrong for it.
**Fix:** Every condition that resolves to a *differently formatted* file needs
its own `types`. Same format can share.

## Interview questions

**★ What is the golden rule of declaration files in a published package?**
A declaration file that represents a module must represent **exactly one**
JavaScript file — and especially cannot represent two files of different module
formats. Almost every "types are wrong" report is a violation of it.

**★ Why can't one `index.d.ts` describe both an ESM and a CommonJS build?**
Because a declaration file's own module format is decided by its extension and
the nearest `package.json` `"type"`, not by its contents. So it does not merely
describe an API — it asserts a format, and it can only assert one.

**★ What are "Masquerading as CJS" and "Masquerading as ESM"?**
Two mismatches between what the types imply and what Node resolves. CJS-side: the
types say CommonJS, Node resolves ESM — so TypeScript permits default imports
that do not exist. ESM-side: the types say ESM, Node resolves CommonJS — the
classic `"type": "module"` package with one top-level `types` and a `require`
condition.

**★ How is "ESM-only entrypoint" different from those two?**
It is not a masquerade — the types and the implementation agree, both ESM. The
consumer asked for CommonJS and the package genuinely has none. The fix is to
ship one or to tell consumers to use `await import()`, which makes their call
site asynchronous.

**Adding `"type": "module"` broke CommonJS consumers without changing any
`.d.ts`. How?**
`"type"` decides the format of every extensionless-ambiguous file under it,
declaration files included. The same bytes now assert ESM, so a `require` path
resolving to `.cjs` is being described by an ESM declaration.

**Where does the `types` condition have to sit in a dual package?**
Inside each of `import` and `require`, not once at the top. A single top-level
`types` is the shape that produces "Masquerading as ESM".

**Does a third condition — say `browser` — always need its own `types`?**
Only if it resolves to a file of a different module format from one already
covered. Conditions that resolve to the same format can share a declaration file
without violating the rule.

---

← [Topic index](./README.md) · Next → [02 · How a consumer finds your types](./02-how-a-consumer-finds-your-types.md)
