---
title: "Implied, enforced, and incompatible"
sidebar_label: "08 · Implied and enforced"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. The `esModuleInterop`, `allowSyntheticDefaultImports` and
> `resolvePackageJsonExports` `computeValue` functions and the
> `module`/`moduleResolution` compatibility checks were read out of the installed
> **TypeScript 5.9.3** build's `_computedOptions` table and option-validation
> code. `TS5095`, `TS5098`, `TS5109` and `TS5110` are verbatim from the same
> build's message table, cross-checked in the **7.0.2** native binary. The
> "implies and enforces" statements are verbatim from the **TypeScript
> handbook**, *Modules — Reference*. **No sandbox, no console block.**

[Chunk 07](./07-the-defaults-you-did-not-set.md) covered what the compiler fills
in when you leave a value out. This chunk covers the other half: what it fills in
that you **cannot** override, and which combinations are simply errors.

## The interop defaults, and their shadow

```js
esModuleInterop: {
  computeValue: (compilerOptions) => {
    if (compilerOptions.esModuleInterop !== void 0) return compilerOptions.esModuleInterop;
    switch (_computedOptions.module.computeValue(compilerOptions)) {
      case 100: case 101: case 102: case 199: case 200: return true;  // node16/18/20/nodenext/preserve
    }
    return false;
  }
}
```

So `esModuleInterop` is **on** for the Node family and `preserve`, and **off**
everywhere else — including `esnext`. That is worth sitting with: two configs
that both look "modern" differ on interop purely because one of them names a
host.

`allowSyntheticDefaultImports`, which governs only what the *checker* permits and
never the emit, is wider:

```js
allowSyntheticDefaultImports: {
  computeValue: (compilerOptions) => {
    if (compilerOptions.allowSyntheticDefaultImports !== void 0) return compilerOptions.allowSyntheticDefaultImports;
    return _computedOptions.esModuleInterop.computeValue(compilerOptions)
        || _computedOptions.module.computeValue(compilerOptions) === 4 /* System */
        || _computedOptions.moduleResolution.computeValue(compilerOptions) === 100 /* Bundler */;
  }
}
```

📌 Note the third clause: **`moduleResolution: bundler` turns on
`allowSyntheticDefaultImports` by itself**, which is the handbook's *"implies
`--allowSyntheticDefaultImports`"* seen from the inside. `system` gets it too,
for historical reasons nobody needs today.

⚠️ The pairing matters because the two flags do different jobs. `esModuleInterop`
changes the **emit** (the `__importDefault` / `__importStar` helpers) *and* the
checking; `allowSyntheticDefaultImports` changes only the checking. A config with
the second and not the first type-checks a default import and emits code that
does not produce one. Topic 09 — **Phase 6 · 09 · `esModuleInterop` and default
imports** *(not written yet)* — owns that argument in full; here it is enough to
know the defaults are not the same flag.

## A gate that runs *before* your value is read

```js
resolvePackageJsonExports: {
  dependencies: ["moduleResolution"],
  computeValue: (compilerOptions) => {
    const moduleResolution = _computedOptions.moduleResolution.computeValue(compilerOptions);
    if (!moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution)) {
      return false;                                    // ← before the user's value
    }
    if (compilerOptions.resolvePackageJsonExports !== void 0) {
      return compilerOptions.resolvePackageJsonExports;
    }
    // …otherwise true for node16, nodenext, bundler
  }
}
```

🔴 **Setting `"resolvePackageJsonExports": true` under `node10` is not an error.
It is silently ignored.** The capability check short-circuits before your value
is consulted. This is a good template for reading option records generally: the
order of the branches tells you whether a flag is a preference or a request that
can be denied.

## "Implied and enforced" is stronger than "defaulted"

Some values you can override. Some you cannot.

> `--module nodenext` implies and enforces `--moduleResolution nodenext`.

> `--module node18` or `node16` implies and enforces `--moduleResolution node16`.

Writing `"module": "nodenext", "moduleResolution": "bundler"` is not a
configuration — it is an error:

```text
TS5109  Option 'moduleResolution' must be set to '{0}' (or left unspecified)
        when option 'module' is set to '{1}'.

TS5110  Option 'module' must be set to '{0}' when option 'moduleResolution' is
        set to '{1}'.
```

📌 The pair is symmetric. One fires when `module` is Node-family and the
resolution is not; the other when the resolution is Node-family and the module is
not. Whichever you get, one edit fixes both — make them match, or delete the
`moduleResolution` line and let the implication do it.

⚠️ Plenty of published base configs still write `"module": "nodenext",
"moduleResolution": "nodenext"`. That is redundant rather than wrong, and it
reads as if it were meaningful, which is how the habit spreads.

## The asymmetric third member

```text
TS5095  Option '{0}' can only be used when 'module' is set to 'preserve' or to
        'es2015' or later.
```

This one fires on `moduleResolution: "bundler"` with an incompatible `module` —
the `{0}` is filled in with `"bundler"`. It is not symmetric with `TS5109`/
`TS5110` because `bundler` does not *imply* a `module` value; it merely rejects
some.

The implementation is one line, and it is wider than the documentation:

```js
if (moduleResolution === 100 /* Bundler */ && !emitModuleKindIsNonNodeESM(moduleKind)
                                           && moduleKind !== 200 /* Preserve */) { /* TS5095 */ }
```

`emitModuleKindIsNonNodeESM` is `>= ES2015 && <= ESNext`, so `es2015`, `es2020`
and `es2022` all pass — despite the handbook naming only `esnext` and `preserve`.

🔴 And in **7.0.2** the message reads *"…'preserve', **'commonjs'**, or 'es2015'
or later."* TypeScript 7 permits `bundler` with CommonJS emit
([chunk 06](./06-the-bundler-resolver.md)). **Take the doc as the recommendation
and the diagnostic as the rule, on the compiler version you actually run.**

There is a fourth, for the options that depend on modern resolution:

```text
TS5098  Option '{0}' can only be used when 'moduleResolution' is set to
        'node16', 'nodenext', or 'bundler'.
```

which is `customConditions` and its relatives hitting the same
can-read-`package.json` dividing line as everything else.

## The rule that follows from all of this

**Set `module` explicitly, and let `moduleResolution` follow — unless you are
using a bundler, in which case set both.**

```jsonc
// Node — one line is genuinely enough
{ "compilerOptions": { "module": "nodenext" } }

// A bundler — two lines, because `esnext` alone would give you `classic`
{ "compilerOptions": { "module": "esnext", "moduleResolution": "bundler" } }

// A bundler, alternative — one line, because `preserve` implies `bundler`
{ "compilerOptions": { "module": "preserve" } }
```

📌 That third form is the tidiest bundler config there is, and it is the reason
`preserve`'s implication is worth knowing rather than merely reading.

## The four-way summary

| Relationship | Example | Can you override it? |
|---|---|---|
| **Defaulted** | `module: commonjs` → `moduleResolution: node10` | ✅ yes |
| **Implied and enforced** | `module: nodenext` → `moduleResolution: nodenext` | ❌ `TS5109` / `TS5110` |
| **Implied** | `moduleResolution: bundler` → `allowSyntheticDefaultImports` | ✅ yes, explicitly |
| **Gated** | `resolvePackageJsonExports` under `node10` | ❌ silently ignored |

That last row is the one to watch. Three of the four tell you when you are wrong;
the gated one does not.

## Gotchas

**`esModuleInterop` is off under `esnext` and on under `nodenext`.** *Symptom:*
a default import from a CommonJS package type-checks in one project and not
another with "the same" modern config. *Cause:* the interop default keys off the
`module` family, and `esnext` is not in it. *Fix:* set it explicitly if you care;
do not infer it from how modern the config looks.

**Setting `resolvePackageJsonExports: true` under `node10` does nothing and does
not warn.** *Symptom:* an option that appears to have no effect. *Cause:* the
computed value short-circuits to `false` when the strategy cannot support
`"exports"`, before your value is consulted. *Fix:* change the strategy; the flag
is not the lever.

**`TS5109` and `TS5110` look like two problems and are one.** *Symptom:* a
confusing pair of errors about `module` and `moduleResolution`. *Cause:* they are
the two directions of the same mismatch. *Fix:* one edit resolves both.

**`allowSyntheticDefaultImports` without `esModuleInterop` type-checks code that
will not run.** *Symptom:* `import express from "express"` compiles and
`express` is `undefined` at runtime under CommonJS emit. *Cause:* only the
checker was told the default exists; no helper was emitted to create one. *Fix:*
`esModuleInterop`, or `import * as express`. See topic 09.

**`"module": "nodenext", "moduleResolution": "nodenext"` is redundant, and looks
deliberate.** *Symptom:* nothing — but the config teaches the next reader that
the second line is load-bearing. *Cause:* the implication already guarantees it.
*Fix:* delete the second line. It is one of the few config simplifications with
no downside.

**`TS5095` names an option in `{0}` that is not the one you edited.** *Symptom:*
an error about `bundler` after changing `module`. *Cause:* `bundler` is the
option being validated; the incompatible value is on the other line. *Fix:* read
the message as "these two disagree" rather than "this line is wrong".

**A `moduleResolution` line inherited through `extends` still counts.**
*Symptom:* `TS5109` in a project whose own `tsconfig.json` sets only `module`.
*Cause:* the base config set `moduleResolution`, and the enforcement applies to
the merged result. *Fix:* look at the base config — or set
`"moduleResolution": null`-equivalently by choosing a `module` that matches.

**Silently-gated options are invisible in code review.** *Symptom:* a config
carrying flags that have done nothing for two years. *Cause:* only three of the
four relationship kinds report. *Fix:* when auditing, check each flag's
prerequisites, not just its spelling.

## Interview questions

**What is the difference between an option being "implied" and being "implied
and enforced"?**
An implied option is a default you may override. An implied-and-enforced one you
may not: `module: nodenext` requires `moduleResolution: nodenext`, and writing
anything else is `TS5109` or `TS5110`, not a configuration choice.

**Why does `moduleResolution: bundler` switch on
`allowSyntheticDefaultImports`?**
Because bundlers synthesise a default export for CommonJS modules, so a default
import is legitimate under them. In the compiler it is a literal third clause in
`allowSyntheticDefaultImports`'s computed value, alongside `esModuleInterop`
being on and `module` being `system`.

**What is the difference between `esModuleInterop` and
`allowSyntheticDefaultImports`?**
`esModuleInterop` changes both the emit — it generates the `__importDefault` and
`__importStar` helpers — and the type checking. `allowSyntheticDefaultImports`
changes only the type checking. Enabling the second alone tells the checker a
default export exists while emitting nothing that creates one.

**A colleague sets `resolvePackageJsonExports: true` under
`"moduleResolution": "node"`. What happens?**
Nothing. The computed value checks whether the strategy supports `"exports"`
*before* it reads the user's value, and returns `false` if it does not. No error,
no warning, no effect — which makes it a good example of why the strategy is the
lever and the flag is not.

**How many kinds of relationship are there between these options, and which is
the dangerous one?**
Four: defaulted, implied, implied-and-enforced, and gated. The dangerous one is
gated, because it is the only one that fails silently — the other three either
apply a value you can inspect or produce a diagnostic.

**Is `"module": "nodenext", "moduleResolution": "nodenext"` wrong?**
Not wrong, just redundant — `nodenext` implies and enforces it. It is worth
removing because leaving it in implies to the next reader that the pairing is a
choice, which is how people end up trying `"module": "nodenext",
"moduleResolution": "bundler"` and meeting `TS5109`.

**You inherit a `tsconfig.json` that `extends` a shared base. What extra care do
the module options need?**
The enforcement rules apply to the merged result, not to the file you are
reading. A `TS5109` can be produced by a `module` in your file and a
`moduleResolution` in the base, so the effective configuration — not your local
one — is what has to be coherent.

---

← [07 · The defaults you did not set](./07-the-defaults-you-did-not-set.md) · Next → [09 · Format detection, file by file](./09-format-detection.md)
