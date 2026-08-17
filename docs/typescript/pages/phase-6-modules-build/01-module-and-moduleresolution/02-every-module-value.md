---
title: "Every `module` value"
sidebar_label: "02 · Every `module` value"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. The accepted values and their internal numbering were read
> out of the `module` **option record** in the installed **TypeScript 5.9.3**
> build (`name: "module"`, its `type` map, and `defaultValueDescription`).
> Descriptions are verbatim from the **TypeScript handbook**, *Modules —
> Reference*. Diagnostic text is from the compiler's own message table.
> **No sandbox, no console block.**

`module` accepts **fourteen spellings for twelve distinct behaviours.** Most of
them you will never set on purpose. Knowing which is which takes about ten
minutes and saves the recurring argument about whether `es2022` is "more modern"
than `nodenext` (it is not; it is a different axis entirely).

## The complete table

Read straight out of the compiler's option record, in the order the compiler
lists them:

| Value | Internal | What it emits | Verdict |
|---|---|---|---|
| `none` | 0 | Module syntax is an error | Scripts only. Vanishingly rare |
| `commonjs` | 1 | `require` / `exports`, whole program | Legacy. See below |
| `amd` | 2 | AMD `define(…)`, whole program | Dead |
| `umd` | 3 | UMD wrapper, whole program | Dead |
| `system` | 4 | SystemJS `System.register`, whole program | Dead |
| `es6` / `es2015` | 5 | ESM, whole program | Superseded |
| `es2020` | 6 | ESM + `import.meta` | Superseded |
| `es2022` | 7 | ESM + top-level `await` | Superseded by `esnext`/`preserve` |
| `esnext` | 99 | ESM, moving target | ✅ For bundlers |
| `node16` | 100 | **Per file**: CJS or ESM, Node v16 rules | ✅ Pinned Node 16 |
| `node18` | 101 | **Per file**, Node v18 rules | ✅ Pinned Node 18 (5.8+) |
| `node20` | 102 | **Per file**, Node v20 rules | ✅ Pinned Node 20 (5.9+) |
| `nodenext` | 199 | **Per file**, latest Node rules | ✅ The default answer for Node |
| `preserve` | 200 | **Per statement**: leaves what you wrote | ✅ For bundlers, since 5.4 |

📌 The numbering is not cosmetic. `node16` = 100 through `nodenext` = 199 is a
contiguous block the compiler tests as a range — `100 <= moduleKind <= 199` is
literally how it asks "is this a Node-family setting?" before enforcing the
matching `moduleResolution`. `preserve` = 200 sits deliberately outside it.

## The one family that behaves differently

Everything above the `node16` line forces **one format for the whole
compilation**. The handbook is explicit that this is the distinguishing property
of the Node family:

> `node16`, `node18`, and `nodenext` describe the full range of behavior for
> Node.js's dual-format module system, and **emit files in either CommonJS or ESM
> format**. This is different from every other `module` option, which are
> runtime-agnostic and force all output files into a single format, leaving it to
> the user to ensure the output is valid for their runtime.

And it pre-empts the misreading everybody makes:

> A common misconception is that `node16`—`nodenext` only emit ES modules. In
> reality, these modes describe versions of Node.js that *support* ES modules,
> not just projects that *use* ES modules. Both ESM and CommonJS emit are
> supported, based on the detected module format of each file.

🔴 **This is the single most useful correction in the topic.** `nodenext` is not
"the ESM setting". It is the *obey-Node* setting, and it is the right answer for
a project that emits nothing but CommonJS. How the per-file decision is made is
[chunk 06](./06-format-detection.md).

The granularity ladder is the clean way to hold the whole table:

```text
whole program   ──►  commonjs, amd, umd, system, es2015…esnext
per file        ──►  node16, node18, node20, nodenext
per statement   ──►  preserve
```

[Chunk 03](./03-preserve-and-the-node-family.md) takes the bottom two rungs.
This chunk finishes the top one.

## What the handbook says to do with the legacy values

The reference page does not hedge, so neither will this page.

**`commonjs`:**

> You probably shouldn't use this. Use `node16`, `node18`, or `nodenext` to emit
> CommonJS modules for Node.js.

That reads as a contradiction until you have chunk 06: `nodenext` on a project
without `"type": "module"` emits CommonJS *anyway*, and additionally enforces the
rules Node applies to CommonJS files. You get the same output plus the checking.
`"module": "commonjs"` is strictly less information for the same artefact.

**`amd`:** *"Designed for AMD loaders like RequireJS. You probably shouldn't use
this. Use a bundler instead."*
**`umd`:** *"Does not expose a global variable like most other UMD wrappers. You
probably shouldn't use this. Use a bundler instead."*
**`system`:** *"Designed for use with the SystemJS module loader."*

⚠️ The `umd` note is worth a second look, because it is the failure mode: people
reach for `"module": "umd"` expecting the classic UMD build that attaches a
global for a `<script>` tag, and TypeScript's UMD emit does not do that. If you
want a global-attaching bundle, you want a bundler, not this flag.

**`es2015`/`es2020`/`es2022`/`esnext`**, quoted in full because the guidance is
buried in the middle:

> Use `esnext` with `--moduleResolution bundler` for bundlers, Bun, and tsx. **Do
> not use for Node.js.** Use `node16`, `node18`, or `nodenext` with
> `"type": "module"` in package.json to emit ES modules for Node.js.

The version-numbered members differ only in which module-adjacent syntax they
permit: `es2020` adds `import.meta`, `es2022` adds top-level `await`, `esnext`
tracks Stage 3 proposals. There is no reason to pick `es2020` over `esnext` for a
bundled app — the bundler, not this flag, decides what the browser receives.

**`none`** makes module syntax an error outright. Its real use is a project of
pure global scripts — a `<script>`-tag codebase, or a set of ambient declaration
files with nothing importable in them. If you find it in a modern config it is
almost certainly an accident.

## The two syntax gates people trip

Both are about `import.meta`, both quoted from the compiler's own message table,
and the fact that there are **two** is the point:

```text
TS1343  The 'import.meta' meta-property is only allowed when the '--module'
        option is 'es2020', 'es2022', 'esnext', 'system', 'node16', 'node18',
        'node20', or 'nodenext'.

TS1470  The 'import.meta' meta-property is not allowed in files which will
        build into CommonJS output.
```

`TS1343` is a check on the **setting**. `TS1470` is a check on the **file**. Under
`nodenext` the setting is fine and an individual file can still fail, because the
file is CommonJS. Two errors, two layers, and knowing which one you have tells
you whether to edit `tsconfig.json` or `package.json`.

📌 `TS1343`'s message is also the most convenient authoritative list of which
`module` values are ESM-capable, straight from the compiler.

## Gotchas

**`"module": "esnext"` with no `moduleResolution` gives you `classic`.**
*Symptom:* `TS2307: Cannot find module 'lodash' or its corresponding type
declarations.` for a package that is unmistakably installed. *Cause:* the implied
`moduleResolution` for every non-Node, non-`preserve` value is `classic`, which
does not search `node_modules` at all. *Fix:* set
`"moduleResolution": "bundler"`. This is
[chunk 05](./05-the-defaults-you-did-not-set.md)'s headline and it catches
people every year.

**Switching `commonjs` → `nodenext` can change your emit format wholesale.**
*Symptom:* `dist/` suddenly contains `import` statements and Node throws
`Cannot use import statement outside a module`. *Cause:* the project has
`"type": "module"` in `package.json`, which `commonjs` ignored and `nodenext`
obeys. *Fix:* decide which you meant. `"type": "module"` is now load-bearing and
was previously inert.

**`import.meta` is gated on `module`, not on `target`.** *Symptom:* `TS1343`
after raising `target` to `es2022`. *Cause:* `target` governs language features;
module syntax is `module`'s business. *Fix:* raise `module`.

**…and gated again on the file's format.** *Symptom:* `TS1470` under `nodenext`,
where `TS1343` says the setting is fine. *Cause:* the file is CommonJS. *Fix:*
`.mts`, or `"type": "module"` — a `tsconfig.json` edit will not do it.

**`es6` and `es2015` are the same value.** *Symptom:* a code review argument.
*Cause:* both map to internal `5`. *Fix:* neither is more correct; prefer neither
and use `esnext` or the Node family.

**Named imports from JSON are format-dependent.** *Symptom:* `TS1544: Named
imports from a JSON file into an ECMAScript module are not allowed when 'module'
is set to '{0}'.` *Cause:* under Node's ESM rules a JSON module has only a
default export. *Fix:* `import data from "./x.json" with { type: "json" }` and
destructure afterwards. Covered properly in **Phase 6 · 16 · Typing non-code
imports** *(not written yet)*.

**Top-level `await` fails on a `module` value, not a `target` value.**
*Symptom:* `TS1309: The current file is a CommonJS module and cannot use 'await'
at the top level.` *Cause:* same layering as `import.meta` — the file is CJS.
*Fix:* make the file ESM; raising `target` does nothing.

**`export =` is illegal in an ESM file.** *Symptom:* `TS1203: Export assignment
cannot be used when targeting ECMAScript modules. Consider using 'export
default' or another module format instead.` *Cause:* `export =` is CommonJS
interop syntax with no ESM meaning. *Fix:* `export default`, or keep the file
CommonJS with a `.cts` extension.

**`"module": "umd"` does not produce the UMD bundle you are thinking of.**
*Symptom:* no global appears for a `<script>` consumer. *Cause:* per the
reference, TypeScript's UMD emit *"does not expose a global variable like most
other UMD wrappers"*. *Fix:* a bundler.

## Interview questions

**Which `module` values would you actually consider in 2026, and for what?**
Four: `nodenext` for an app running on Node you control; a pinned `node18`/
`node20` for a published library or a policy-pinned runtime; `esnext` with
`moduleResolution: bundler` for a bundled front end; `preserve` for a bundled
project that mixes `import` and `require` in the same file. Everything else is
legacy or dead.

**Is `"module": "nodenext"` the ESM setting?**
No, and this is the most common misconception in the area. It is the
*obey-Node.js* setting. It emits CommonJS for files Node would treat as CommonJS
and ESM for files Node would treat as ESM, per file. A project with no
`"type": "module"` and only `.ts` files emits 100% CommonJS under `nodenext`.

**Your team sets `"module": "es2022"` for a Node service. What do you say?**
That it forces every output file to ESM regardless of what `package.json` says,
so the compiler is no longer modelling Node's dual-format rules and cannot warn
you about CJS/ESM interop mistakes — and that the handbook's guidance for these
values is explicitly *"Do not use for Node.js"*. The replacement is `nodenext`,
plus `"type": "module"` if ESM output is genuinely wanted.

**What is the difference between `es2020`, `es2022` and `esnext`?**
Only which module-adjacent syntax is permitted: `es2020` allows `import.meta`,
`es2022` adds top-level `await`, `esnext` tracks Stage 3 proposals as they land.
All three force ESM output for the whole program. For a bundled app the choice is
close to irrelevant, because the bundler decides what ships.

**How does the compiler decide whether a `module` setting is "in the Node
family"?**
By numeric range: the Node values occupy 100–199 (`node16` = 100, `node18` = 101,
`node20` = 102, `nodenext` = 199) and the compiler tests `100 <= module <= 199`
before enforcing a matching `moduleResolution`. `preserve` = 200 sits outside the
range on purpose.

**Why are there two different errors for `import.meta`?**
Because there are two layers. `TS1343` says your `module` setting does not
support it at all. `TS1470` says the setting is fine but *this file* compiles to
CommonJS, where `import.meta` has no meaning. The first is fixed in
`tsconfig.json`, the second in `package.json` or by renaming to `.mts` — and
mistaking one for the other is how people end up changing the wrong file.

**Is `"module": "commonjs"` ever the right answer today?**
Rarely enough to treat as never. Whatever it emits, `nodenext` emits the same
artefact for a project without `"type": "module"`, plus the dual-format checking
`commonjs` cannot do. The honest exception is a build that must produce CommonJS
output from a package marked `"type": "module"` — but that is what a `.cts`
extension is for.

---

← [01 · The two questions](./01-the-two-questions.md) · Next → [03 · `preserve` and the Node family](./03-preserve-and-the-node-family.md)
