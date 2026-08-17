---
title: "The two flags, and how they differ"
sidebar_label: "02 · The two flags"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — 🔴 every default and every difference below is read out of
> the compiler's own **option records and computed-option table** in the installed
> **TypeScript 5.9.3** build (`_computedOptions.esModuleInterop` and
> `_computedOptions.allowSyntheticDefaultImports`), not recalled. Descriptions are
> the options' own `description` strings, quoted verbatim. **No sandbox, no
> console blocks.**

Two flags, both about the same mismatch, endlessly confused with each other. The
distinction is exact and the compiler's own option records state it in one word.

## The two records, side by side

| | `allowSyntheticDefaultImports` | `esModuleInterop` |
|---|---|---|
| Description | *"Allow `import x from y` when a module doesn't have a default export."* | *"Emit additional JavaScript to ease support for importing CommonJS modules. This enables `allowSyntheticDefaultImports` for type compatibility."* |
| `affectsSemanticDiagnostics` | ✓ | ✓ |
| 🔴 `affectsEmit` | — | ✓ |
| `affectsBuildInfo` | — | ✓ |
| Static default | *"`module === "system"` or `esModuleInterop`"* | `false` |

🔴 **The whole difference is that one line: `affectsEmit`.**

- **`allowSyntheticDefaultImports` is a type-system-only permission.** It stops
  the compiler complaining about `import x from 'cjs-pkg'`. It changes **nothing**
  in the emitted JavaScript. You are telling the compiler *"something else will
  make this work at runtime"* — a bundler, Node's own interop, or the fact that
  the file will be loaded as CommonJS anyway.
- **`esModuleInterop` also changes the output.** It emits the helper code that
  performs the synthetic-default rule at runtime, so the import works because
  *TypeScript made it work*. That emit is [chunk 03](./03-the-emit.md).

⚠️ **Which is why `allowSyntheticDefaultImports` alone can produce a green build
and a runtime `undefined`.** It is not a bug in the flag — the flag's entire
meaning is "trust me, the runtime handles it". If nothing handles it, the
compiler was told to stop asking.

📌 **And why `esModuleInterop` "enables `allowSyntheticDefaultImports` for type
compatibility"**, in its own description: it would be incoherent to emit the
interop helpers and still report the import as an error.

## 🔴 The defaults are computed, not constant

The option record says `esModuleInterop` defaults to `false`. **That is the
static description and it is not the whole story.** The computed-option table:

```js
esModuleInterop: {
  dependencies: ["module", "target"],
  computeValue: (compilerOptions) => {
    if (compilerOptions.esModuleInterop !== void 0) return compilerOptions.esModuleInterop;
    switch (_computedOptions.module.computeValue(compilerOptions)) {
      case Node16: case Node18: case Node20: case NodeNext: case Preserve:
        return true;
    }
    return false;
  }
}
```

**So `esModuleInterop` is ON by default whenever `module` is `node16`, `node18`,
`node20`, `nodenext` or `preserve`** — and off otherwise. An explicit setting
always wins.

That is worth stating plainly because of how often it is missed:

> 🔴 **If your `tsconfig.json` says `"module": "nodenext"` and nothing about
> `esModuleInterop`, the flag is on.** Adding `"esModuleInterop": true` to such a
> config changes nothing, and `"esModuleInterop": false` is a real, deliberate
> downgrade that people sometimes copy in without noticing.

And `allowSyntheticDefaultImports` computes from three things:

```js
allowSyntheticDefaultImports: {
  dependencies: ["module", "target", "moduleResolution"],
  computeValue: (compilerOptions) => {
    if (compilerOptions.allowSyntheticDefaultImports !== void 0) return compilerOptions.allowSyntheticDefaultImports;
    return _computedOptions.esModuleInterop.computeValue(compilerOptions)
      || _computedOptions.module.computeValue(compilerOptions) === System
      || _computedOptions.moduleResolution.computeValue(compilerOptions) === Bundler;
  }
}
```

Three ways to get it without asking: **`esModuleInterop` is on**, **`module` is
`system`**, or 🔴 **`moduleResolution` is `bundler`**.

⚠️ **That last one is the modern trap.** A Vite or bundler-targeting config with
`"moduleResolution": "bundler"` has `allowSyntheticDefaultImports` on and
`esModuleInterop` possibly off — which is *correct* for that setup (the bundler
does the interop, TypeScript should not emit anything) and completely
inscrutable if you do not know the rule. It is also exactly the configuration
where a type-checks-but-`undefined` failure appears the moment somebody runs a
file through plain `tsc` or Node instead.

## 🔴 The error names a different flag depending on your `module`

One more piece of the confusion, straight from the checker:

```js
const compilerOptionName = moduleKind >= ES2015 ? "allowSyntheticDefaultImports" : "esModuleInterop";
error2(node.name, Diagnostics.Module_0_can_only_be_default_imported_using_the_1_flag, …);
```

> **TS1259:** *"Module '{0}' can only be default-imported using the '{1}' flag"*

**`{1}` is not fixed.** With an ES-module `module` setting you are told
`allowSyntheticDefaultImports`; with a CommonJS-emitting one you are told
`esModuleInterop`. The compiler is being helpful — it names the flag that is
*sufficient for your configuration* — but it means two developers hitting the
same wall get different advice, and the internet's contradictory answers are
downstream of exactly this.

**The reasoning behind the switch is sound:** if you are emitting ES modules,
TypeScript is not going to write interop helpers anyway, so only the type-level
permission is available to you. If you are emitting CommonJS, the real fix is the
one that also emits the helper.

## Which one you want

| Situation | Flag |
|---|---|
| `tsc` emits the JavaScript you run | **`esModuleInterop`** — you want the helpers |
| A bundler emits it (Vite, webpack, esbuild, Rollup) | `allowSyntheticDefaultImports`, or nothing at all if `moduleResolution: bundler` is already giving it to you |
| `module` is `node16`/`nodenext`/`preserve` | Already on. Do not set it again, and do not set it to `false` |
| Writing a library others compile against | `esModuleInterop`, and read chunk 05 — this one leaks into consumers |

🔴 **Default to `esModuleInterop` unless you can say why not.** The type-only
flag is the specialised choice, for the case where something else is provably
doing the work.

## Gotchas

**Symptom:** `allowSyntheticDefaultImports` is on, the build is green, and the
import is `undefined`.
**Cause:** That flag changes only the type check. Its option record has no
`affectsEmit`.
**Fix:** `esModuleInterop` if `tsc` produces your output; otherwise find out why
the bundler or runtime is not doing the interop it was assumed to be doing.

**Symptom:** You set `esModuleInterop: true` under `module: nodenext` and nothing
changed.
**Cause:** It was already on — the computed default is `true` for the whole Node
family and `preserve`.
**Fix:** Nothing to fix. Worth deleting the line so the config stops implying it
was needed.

**Symptom:** Copying a `tsconfig.json` that sets `"esModuleInterop": false` broke
a `nodenext` project.
**Cause:** An explicit value always beats the computed default, so that line is a
deliberate downgrade.
**Fix:** Remove it. It is almost never intentional in a config that was copied.

**Symptom:** Default imports work with `moduleResolution: bundler` and nobody set
any interop flag.
**Cause:** `bundler` computes `allowSyntheticDefaultImports` to `true`.
**Fix:** Nothing — but know that it is *type-only*, so the same code run through
plain `tsc` or Node will fail.

**Symptom:** Two developers get different flag advice from the same error.
**Cause:** `TS1259`'s `{1}` is chosen by module kind — `allowSyntheticDefaultImports`
for ES-module targets, `esModuleInterop` for CommonJS ones.
**Fix:** Both are being told the truth for their configuration. Compare the
`module` settings, not the error text.

**Symptom:** The team cannot agree which flag is "the right one".
**Cause:** They answer different questions: permission versus emitted behaviour.
**Fix:** Ask who emits the JavaScript. `tsc` → `esModuleInterop`. A bundler →
the type-only flag is sufficient.

**Symptom:** `esModuleInterop` is on and the build output grew.
**Cause:** It has `affectsEmit` — the helpers are real code, added per file.
**Fix:** `importHelpers` with `tslib` pulls them from one place instead. Chunk 03.

**Symptom:** A config sets `allowSyntheticDefaultImports` *and*
`esModuleInterop`.
**Cause:** Cargo-culting; the second already implies the first, by its own
description.
**Fix:** Harmless, but delete the first — a redundant flag reads as a deliberate
distinction.

## Interview questions

**★ What is the difference between `esModuleInterop` and
`allowSyntheticDefaultImports`?**
`allowSyntheticDefaultImports` is a type-system permission only — its option
record has no `affectsEmit`, so it changes nothing in the output and simply stops
the compiler complaining. `esModuleInterop` also emits helper code that performs
the interop at runtime, and (by its own description) enables the first *"for type
compatibility"*.

**★ When is `allowSyntheticDefaultImports` alone the right choice?**
When something other than `tsc` produces the JavaScript you run — a bundler that
does its own interop. You are asserting that the runtime handles it. If nothing
does, you get a green build and `undefined`.

**★ Is `esModuleInterop` off by default?**
Its static description says `false`, but the computed default is `true` whenever
`module` is `node16`, `node18`, `node20`, `nodenext` or `preserve`. So a modern
Node config has it on without setting it — and an explicit `false` copied from
somewhere is a real downgrade.

**★ Why do two people hit the same error and get told to set different flags?**
Because `TS1259` picks the flag name from the module kind: an ES-module target is
told `allowSyntheticDefaultImports`, a CommonJS one is told `esModuleInterop`.
Both are correct for their configuration, which is why the internet's answers
disagree.

**★ Default imports work in your Vite project with no interop flag set. Why?**
`moduleResolution: bundler` computes `allowSyntheticDefaultImports` to `true`.
It is type-only — the bundler does the actual interop — so the same code checked
or run outside the bundler can still fail.

**Which flag should a new Node service set?**
Neither explicitly, if `module` is `nodenext` — it is already on. Otherwise
`esModuleInterop`, because `tsc` is emitting the JavaScript and you want the
helpers rather than a promise that something else will cope.

**Does setting both flags do anything?**
No. `esModuleInterop` enables the other by definition. The redundancy is harmless
but misleading — it reads as though a distinction is being drawn.

---

← Prev: [01 · What a default import means](./01-what-a-default-import-means.md) · Next → [03 · The emit](./03-the-emit.md)
